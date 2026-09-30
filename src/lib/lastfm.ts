import { createHash } from "node:crypto";
import { ApiError } from "@/lib/server";
import type { MusicItem, MusicSnapshot, NowPlayingTrack } from "@/types";
import { normalizeItems, imageFrom, artworkCandidates, enrichArtwork } from "@/lib/catalog";
import { safeMusicUrl } from "@/lib/music";
import { formatGenreTitle, getArtistGenres } from "@/lib/music-matching";

export function lastfmConfig() {
  const key = process.env.LASTFM_API_KEY,
    secret = process.env.LASTFM_SHARED_SECRET;
  if (!key || !secret)
    throw new ApiError(
      "Last.fm is not configured yet. You can add favorites or import Spotify history for now.",
      503
    );
  return { key, secret };
}

type Result = Record<string, unknown>;

export async function lastfm(
  method: string,
  values: Record<string, string>,
  signed = false,
  cacheSeconds = 0
): Promise<Result> {
  const { key, secret } = lastfmConfig();
  const params: Record<string, string> = { method, api_key: key, ...values };
  if (signed)
    params.api_sig = createHash("md5")
      .update(
        Object.keys(params)
          .sort()
          .map(k => k + params[k])
          .join("") + secret
      )
      .digest("hex");
  params.format = "json";
  let response;
  try {
    response = await fetch("https://ws.audioscrobbler.com/2.0/?" + new URLSearchParams(params), {
      ...(cacheSeconds && !signed
        ? { next: { revalidate: cacheSeconds } }
        : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(cacheSeconds ? 3000 : 8000),
    });
  } catch {
    throw new ApiError("Last.fm is taking too long to respond. Please try again.", 502);
  }
  if (!response.ok)
    throw new ApiError("Last.fm is temporarily unavailable. Please try again.", 502);
  const data = await response.json();
  if (data.error)
    throw new ApiError(
      data.error === 14 || data.error === 15
        ? "Your Last.fm connection request expired. Please connect again."
        : "Last.fm could not complete the request. Please try again.",
      502
    );
  return data;
}

/** Real-time Last.fm recent tracks and Now Playing status */
const topMonthCache = new Map<string, { time: number; topSongs: MusicItem[]; topArtists: MusicItem[]; monthlyScrobbleCount: number }>();

export async function getLiveLastfm(username: string): Promise<{
  nowPlaying: NowPlayingTrack | null;
  recentTracks: MusicItem[]; // Now actually topSongs (1 month)
  recentArtists: MusicItem[]; // Now actually topArtists (1 month)
  monthlyScrobbleCount: number;
  monthlyTopGenre: string | null;
}> {
  // 1. Fetch recent tracks for now playing (limit 2)
  const recentData = await lastfm(
    "user.getRecentTracks",
    { user: username, limit: "2", extended: "1", autocache: "0", _ts: Date.now().toString() },
    false, 0
  ).catch(() => null);

  let nowPlaying: NowPlayingTrack | null = null;
  if (recentData?.recenttracks) {
    const rawList = (recentData.recenttracks as Result).track;
    const rows = Array.isArray(rawList) ? rawList : rawList && typeof rawList === "object" ? [rawList] : [];
    if (rows.length > 0) {
      const row = rows[0] as Record<string, any>;
      const attr = (row["@attr"] || row.attr) as Record<string, any> | undefined;
      const isNowPlaying = attr?.nowplaying === "true" || attr?.nowplaying === "1" || attr?.nowplaying === true;
      if (isNowPlaying) {
        nowPlaying = {
          kind: "track",
          name: typeof row.name === "string" ? row.name.trim() : "",
          artist: typeof row.artist === "object" ? row.artist.name || row.artist["#text"] || "" : typeof row.artist === "string" ? row.artist.trim() : "",
          album: typeof row.album === "object" ? row.album.name || row.album["#text"] || "" : typeof row.album === "string" ? row.album.trim() : "",
          image: imageFrom(row.image),
          url: safeMusicUrl(row.url),
          nowPlaying: true
        };
      }
    }
  }

  // 2. Fetch Top Tracks / Artists (cached for 15 minutes to avoid rate limits during live polling)
  const now = Date.now();
  let topSongs: MusicItem[] = [];
  let topArtists: MusicItem[] = [];
  let monthlyScrobbleCount = 0;
  
  const cacheKey = username.toLowerCase();
  const cached = topMonthCache.get(cacheKey);
  
  if (cached && now - cached.time < 15 * 60 * 1000) {
    topSongs = cached.topSongs;
    topArtists = cached.topArtists;
    monthlyScrobbleCount = cached.monthlyScrobbleCount;
  } else {
    try {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const from = String(Math.floor(monthStart.getTime() / 1000));
      const to = String(Math.floor(Date.now() / 1000));
      const [tracksData, artistsData, monthData] = await Promise.all([
        lastfm("user.getWeeklyTrackChart", { user: username, from, to, limit: "5" }, false, 0),
        lastfm("user.getWeeklyArtistChart", { user: username, from, to, limit: "5" }, false, 0),
        lastfm("user.getRecentTracks", { user: username, from, to, limit: "1" }, false, 0)
      ]);
      topSongs = normalizeItems((tracksData.weeklytrackchart as Result)?.track, "track", true).slice(0, 5);
      topArtists = normalizeItems((artistsData.weeklyartistchart as Result)?.artist, "artist", true).slice(0, 5);
      const total = Number(((monthData.recenttracks as Result | undefined)?.["@attr"] as Result | undefined)?.total);
      monthlyScrobbleCount = Number.isSafeInteger(total) && total >= 0 ? total : 0;
      topMonthCache.set(cacheKey, { time: now, topSongs, topArtists, monthlyScrobbleCount });
    } catch {
      // Fallback to cache or empty
      if (cached) {
        topSongs = cached.topSongs;
        topArtists = cached.topArtists;
      }
    }
  }

  const genreWeights = new Map<string, number>();
  for (const artist of topArtists) {
    for (const genre of getArtistGenres(artist.name)) {
      genreWeights.set(genre, (genreWeights.get(genre) || 0) + (artist.plays || 1));
    }
  }
  const topGenre = [...genreWeights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // Fast in-memory cache to make 3s polling instantaneous and eliminate repetitive Deezer calls
  await Promise.all([
    (async () => {
      if (nowPlaying && !nowPlaying.image) {
        const key = `${nowPlaying.name.toLowerCase()}:::${nowPlaying.artist.toLowerCase()}`;
        if (trackPhotoCache.has(key)) nowPlaying.image = trackPhotoCache.get(key);
        else {
          try {
            const c = await artworkCandidates("track", `${nowPlaying.name} ${nowPlaying.artist}`);
            const e = enrichArtwork([nowPlaying as MusicItem], c);
            if (e[0]?.image) { nowPlaying.image = e[0].image; trackPhotoCache.set(key, e[0].image); }
          } catch {}
        }
      }
    })(),
    ...topArtists.map(async artistItem => {
      const key = artistItem.name.trim().toLowerCase();
      if (artistPhotoCache.has(key)) { artistItem.image = artistPhotoCache.get(key); artistItem.imageSource = "deezer"; return; }
      try {
        const c = await artworkCandidates("artist", artistItem.name);
        const e = enrichArtwork([artistItem], c);
        if (e[0]?.image) { artistItem.image = e[0].image; artistItem.imageSource = "deezer"; artistPhotoCache.set(key, e[0].image); }
      } catch {}
    })
  ]);

  return {
    nowPlaying,
    recentTracks: topSongs,
    recentArtists: topArtists,
    monthlyScrobbleCount,
    monthlyTopGenre: topGenre ? formatGenreTitle(topGenre) : null,
  };
}

// In-memory artwork caches to accelerate polling
const artistPhotoCache = new Map<string, string>();
const trackPhotoCache = new Map<string, string>();

export async function musicSnapshot(username: string): Promise<MusicSnapshot> {
  const results = await Promise.all(
    (["artist", "track", "album"] as const).map(async kind => {
      const data = await lastfm(
        `user.getTop${kind[0].toUpperCase() + kind.slice(1)}s`,
        { user: username, period: "overall", limit: "50" }
      );
      const container = data[`top${kind}s`] as Result | undefined;
      return normalizeItems(container?.[kind], kind, true);
    })
  );
  // Counts here cover the fetched top tracks, not the user's complete listening history.
  return {
    items: results.flat(),
    updatedAt: new Date().toISOString(),
    totalPlays: results[1].reduce((sum, item) => sum + (item.plays || 0), 0),
    from: null,
    to: null,
  };
}
