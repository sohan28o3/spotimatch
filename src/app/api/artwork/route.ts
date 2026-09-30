import { imageFrom } from "@/lib/catalog";
import { safeMusicImage } from "@/lib/music";

export const dynamic = "force-dynamic";

// In-memory cache to make repeated calls instantaneous
const artworkCache = new Map<string, string | null>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") || "track") as "artist" | "track" | "album";
  const name = (url.searchParams.get("name") || "").trim();
  const artist = (url.searchParams.get("artist") || "").trim();

  if (!name) {
    return Response.json({ image: null }, { status: 400 });
  }

  const cacheKey = `${kind}:::${name.toLowerCase()}:::${artist.toLowerCase()}`;
  if (artworkCache.has(cacheKey)) {
    return Response.json(
      { image: artworkCache.get(cacheKey) },
      { headers: { "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" } }
    );
  }

  let image: string | null = null;
  const lastfmKey = process.env.LASTFM_API_KEY;

  try {
    // 1. If artist: Deezer artist search provides reliable high-res (500x500) artist portraits
    if (kind === "artist") {
      const res = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`,
        { signal: AbortSignal.timeout(3000) }
      )
        .then(r => r.json())
        .catch(() => null);
      const pic = res?.data?.[0]?.picture_big || res?.data?.[0]?.picture_medium;
      if (pic) image = safeMusicImage(pic) || null;
    }

    // 2. If track: iTunes Search API first (crisp 600x600 covers, no API key required), then Last.fm, then Deezer
    if (kind === "track") {
      const query = artist ? `${name} ${artist}` : name;
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`,
        { signal: AbortSignal.timeout(3000) }
      )
        .then(r => r.json())
        .catch(() => null);
      const rawArt = itunesRes?.results?.[0]?.artworkUrl100;
      if (rawArt) {
        const hiRes = rawArt.replace("100x100bb", "600x600bb");
        image = safeMusicImage(hiRes) || null;
      }

      if (!image && lastfmKey) {
        const queryParams = new URLSearchParams({
          method: "track.getInfo",
          api_key: lastfmKey,
          track: name,
          format: "json",
          ...(artist ? { artist } : {}),
        });
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${queryParams}`, {
          signal: AbortSignal.timeout(3000),
        })
          .then(r => r.json())
          .catch(() => null);
        const img = imageFrom(res?.track?.album?.image);
        if (img) image = safeMusicImage(img) || null;
      }

      if (!image) {
        const res = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(3000) }
        )
          .then(r => r.json())
          .catch(() => null);
        const pic = res?.data?.[0]?.album?.cover_big || res?.data?.[0]?.album?.cover_medium;
        if (pic) image = safeMusicImage(pic) || null;
      }
    }

    // 3. If album: iTunes Search API first (crisp 600x600 covers), then Last.fm, then Deezer
    if (kind === "album") {
      const query = artist ? `${name} ${artist}` : name;
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=1`,
        { signal: AbortSignal.timeout(3000) }
      )
        .then(r => r.json())
        .catch(() => null);
      const rawArt = itunesRes?.results?.[0]?.artworkUrl100;
      if (rawArt) {
        const hiRes = rawArt.replace("100x100bb", "600x600bb");
        image = safeMusicImage(hiRes) || null;
      }

      if (!image && lastfmKey) {
        const queryParams = new URLSearchParams({
          method: "album.getInfo",
          api_key: lastfmKey,
          album: name,
          format: "json",
          ...(artist ? { artist } : {}),
        });
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${queryParams}`, {
          signal: AbortSignal.timeout(3000),
        })
          .then(r => r.json())
          .catch(() => null);
        const img = imageFrom(res?.album?.image);
        if (img) image = safeMusicImage(img) || null;
      }

      if (!image) {
        const res = await fetch(
          `https://api.deezer.com/search?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(3000) }
        )
          .then(r => r.json())
          .catch(() => null);
        const pic = res?.data?.[0]?.cover_big || res?.data?.[0]?.cover_medium;
        if (pic) image = safeMusicImage(pic) || null;
      }
    }
  } catch {
    // Fail silently on timeout or network error
  }

  artworkCache.set(cacheKey, image);

  return Response.json(
    { image },
    { headers: { "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400" } }
  );
}
