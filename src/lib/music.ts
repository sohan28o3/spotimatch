import type { MonthlyCapsule, MusicItem, MusicKind, SpotifyImport } from "../types/index";
const IMPORT_GENRES: Record<string, string[]> = {
  radiohead: ["art rock", "alternative rock"],
  "kendrick lamar": ["hip hop", "conscious hip hop"],
  "the weeknd": ["r&b", "pop"],
  "taylor swift": ["pop", "singer-songwriter"],
  "billie eilish": ["alternative pop", "pop"],
  "beach house": ["dream pop", "indie"],
  "arctic monkeys": ["indie rock", "alternative rock"],
  "frank ocean": ["alternative r&b", "neo soul"],
  "daft punk": ["electronic", "house"],
  "lana del rey": ["alternative pop", "dream pop"],
  "tame impala": ["psychedelic rock", "indie"],
  sza: ["r&b", "neo soul"],
};
const importGenresFor = (artist: string) => IMPORT_GENRES[artist.trim().toLowerCase()] || [];
const genreTitle = (genre: string) => genre.split(/\s+/).map(word => word ? word[0].toUpperCase() + word.slice(1) : word).join(" ");
export const itemKey = (item: MusicItem) => JSON.stringify([item.kind, item.name.trim().toLocaleLowerCase("en"), item.artist.trim().toLocaleLowerCase("en")]);
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function safeMusicImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1500 || value.includes("2a96cbd8b46e442fc41c2b86b821562f")) return;
  try {
    const url = new URL(value);
    const isAllowedHost =
      url.hostname.endsWith(".mzstatic.com") ||
      url.hostname === "mzstatic.com" ||
      url.hostname.endsWith(".dzcdn.net") ||
      url.hostname === "dzcdn.net" ||
      url.hostname.endsWith(".spotifycdn.com") ||
      url.hostname === "i.scdn.co" ||
      url.hostname === "mosaic.scdn.co" ||
      url.hostname === "images.unsplash.com" ||
      url.hostname.includes("fastly.net") ||
      url.hostname.includes("akamaized.net");
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && isAllowedHost) return url.href;
  } catch { /* Missing or invalid artwork uses a neutral icon. */ }
}
export function safeMusicUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1500) return;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.port && ["www.last.fm", "last.fm", "www.deezer.com", "deezer.com"].includes(url.hostname)) {
      url.protocol = "https:"; return url.href;
    }
  } catch { /* Invalid provider links are discarded. */ }
}

/** Only music metadata is retained. Device information, IP addresses and account names are discarded. */
export async function parseSpotifyFiles(files: { name: string; text: string }[]): Promise<SpotifyImport> {
  if (!files.length || files.length > 30) throw new Error("Choose between 1 and 30 Spotify history JSON files.");
  const seen = new Set<string>(), items = new Map<string, MusicItem>();
  const albumRecorded = new Set<string>();
  let duplicateCount = 0, ignoredCount = 0, totalPlays = 0;
  let from = Infinity, to = -Infinity;

  interface MonthlyBucket {
    totalMs: number;
    artists: Map<string, { name: string; count: number; ms: number }>;
    tracks: Map<string, { name: string; artist: string; album?: string; count: number; ms: number }>;
    albums: Map<string, { name: string; artist: string; count: number }>;
  }
  const monthlyBuckets = new Map<string, MonthlyBucket>();

  function add(kind: MusicKind, name: string, artist = "") {
    const item = { kind, name, artist, plays: 1 }, key = itemKey(item);
    const previous = items.get(key);
    if (previous) previous.plays = (previous.plays || 0) + 1;
    else items.set(key, item);
  }
  for (const file of files) {
    let rows: unknown;
    try { rows = JSON.parse(file.text.replace(/^\uFEFF/, "")); } catch { throw new Error(file.name + " is not valid JSON. Extract the ZIP and select history JSON files inside."); }
    if (!Array.isArray(rows)) throw new Error(file.name + " is not a Spotify streaming history file.");
    let recognized = rows.length === 0;
    for (const value of rows) {
      if (!value || typeof value !== "object") { ignoredCount++; continue; }
      const row = value as Record<string, unknown>;
      const extended = "ts" in row && "ms_played" in row;
      const basic = "endTime" in row && "msPlayed" in row;
      if (!extended && !basic) { ignoredCount++; continue; }
      recognized = true;
      const name = text(extended ? row.master_metadata_track_name : row.trackName);
      const artist = text(extended ? row.master_metadata_album_artist_name : row.artistName);
      const album = text(row.master_metadata_album_album_name);
      const duration = extended ? row.ms_played : row.msPlayed;
      const stamp = text(extended ? row.ts : row.endTime);
      const time = Date.parse(basic ? stamp.replace(" ", "T") + "Z" : stamp);
      // Count music plays of at least 30 seconds, excluding podcasts and malformed records.
      if (!name || !artist || typeof duration !== "number" || duration < 30000 || !Number.isFinite(time)) { ignoredCount++; continue; }
      const key = JSON.stringify([Math.floor(time / 60000), name.toLowerCase(), artist.toLowerCase(), duration]);
      if (seen.has(key)) {
        // An extended export can enrich a previously seen basic record with its album.
        if (album && !albumRecorded.has(key)) { add("album", album, artist); albumRecorded.add(key); }
        duplicateCount++; continue;
      }
      seen.add(key); totalPlays++; from = Math.min(from, time); to = Math.max(to, time);
      add("track", name, artist); add("artist", artist);
      if (album) { add("album", album, artist); albumRecorded.add(key); }

      // Track month-by-month capsule data
      const monthKey = new Date(time).toISOString().slice(0, 7);
      let bucket = monthlyBuckets.get(monthKey);
      if (!bucket) {
        bucket = { totalMs: 0, artists: new Map(), tracks: new Map(), albums: new Map() };
        monthlyBuckets.set(monthKey, bucket);
      }
      bucket.totalMs += duration;

      const artistKey = artist.toLowerCase();
      const prevArtist = bucket.artists.get(artistKey);
      if (prevArtist) {
        prevArtist.count += 1;
        prevArtist.ms += duration;
      } else {
        bucket.artists.set(artistKey, { name: artist, count: 1, ms: duration });
      }

      const trackKey = `${name.toLowerCase()}:::${artist.toLowerCase()}`;
      const prevTrack = bucket.tracks.get(trackKey);
      if (prevTrack) {
        prevTrack.count += 1;
        prevTrack.ms += duration;
        if (album && !prevTrack.album) prevTrack.album = album;
      } else {
        bucket.tracks.set(trackKey, { name, artist, album: album || undefined, count: 1, ms: duration });
      }

      if (album) {
        const albumKey = `${album.toLowerCase()}:::${artist.toLowerCase()}`;
        const prevAlbum = bucket.albums.get(albumKey);
        if (prevAlbum) {
          prevAlbum.count += 1;
        } else {
          bucket.albums.set(albumKey, { name: album, artist, count: 1 });
        }
      }
    }
    if (!recognized) throw new Error(file.name + " has no Spotify streaming history records.");
  }
  if (!totalPlays) throw new Error("No music plays of at least 30 seconds were found. Try another history file.");

  const monthlyCapsules: Record<string, MonthlyCapsule> = {};
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  for (const [monthKey, bucket] of monthlyBuckets.entries()) {
    const [yearStr, monthNumStr] = monthKey.split("-");
    const d = new Date(Number(yearStr), Number(monthNumStr) - 1, 1);
    const monthName = d.toLocaleDateString("en-US", { month: "long" });
    const top5Artists: MusicItem[] = [...bucket.artists.values()]
      .sort((a, b) => b.count - a.count || b.ms - a.ms)
      .slice(0, 5)
      .map(a => ({ kind: "artist", name: a.name, artist: "", plays: a.count }));
    const top5Songs: MusicItem[] = [...bucket.tracks.values()]
      .sort((a, b) => b.count - a.count || b.ms - a.ms)
      .slice(0, 5)
      .map(t => ({ kind: "track", name: t.name, artist: t.artist, album: t.album, plays: t.count }));
    const albumsCollage: MusicItem[] = [...bucket.albums.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(al => ({ kind: "album", name: al.name, artist: al.artist, plays: al.count }));

    if (top5Artists.length && top5Songs.length) {
      const genreCounts = new Map<string, number>();
      for (const artist of top5Artists) {
        for (const genre of importGenresFor(artist.name)) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + (artist.plays || 1));
        }
      }
      const topGenreEntry = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      monthlyCapsules[monthKey] = {
        monthKey,
        monthName,
        year: yearStr,
        label: `${monthName} ${yearStr}`,
        minutesListened: Math.round(bucket.totalMs / 60000),
        metric: "minutes",
        topGenre: topGenreEntry ? genreTitle(topGenreEntry[0]) : null,
        topArtist: top5Artists[0],
        topSong: top5Songs[0],
        top5Artists,
        top5Songs,
        albumsCollage,
        isCurrentMonth: monthKey === currentMonthKey,
      };
    }
  }

  const albumDetails = [...items.values()].filter(item => item.kind === "album").map(item => itemKey(item) + ":" + item.plays).sort();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([[...seen].sort(), albumDetails])));
  return {
    items: (["artist", "track", "album"] as const).flatMap(kind => [...items.values()].filter(item => item.kind === kind).sort((a, b) => (b.plays || 0) - (a.plays || 0) || a.name.localeCompare(b.name)).slice(0, 50)),
    totalPlays, from: new Date(from).toISOString(), to: new Date(to).toISOString(),
    updatedAt: new Date().toISOString(), fileCount: files.length, duplicateCount, ignoredCount,
    fingerprint: Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join(""),
    monthlyCapsules,
  };
}
export function validateItems(value: unknown, max = 100, counts = false): MusicItem[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("Choose at most " + max + " music items.");
  const result = new Map<string, MusicItem>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") throw new Error("Invalid music item.");
    const item = raw as Record<string, unknown>;
    if (!["artist", "track", "album"].includes(String(item.kind))) throw new Error("Invalid music category.");
    const name = text(item.name), artist = item.kind === "artist" ? "" : text(item.artist);
    if (!name || name.length > 200 || artist.length > 200 || (item.kind !== "artist" && !artist)) throw new Error("Add a title and artist (up to 200 characters each).");
    const clean: MusicItem = { kind: item.kind as MusicKind, name, artist };
    const image = safeMusicImage(item.image), url = safeMusicUrl(item.url);
    if (image) clean.image = image;
    if (url) clean.url = url;
    if (typeof item.album === "string" && item.album.trim()) clean.album = item.album.trim().slice(0, 200);
    if (image && (item.imageSource === "lastfm" || item.imageSource === "deezer")) clean.imageSource = item.imageSource;
    if (counts) {
      if (!Number.isSafeInteger(item.plays) || Number(item.plays) < 1) throw new Error("Invalid play count.");
      clean.plays = Number(item.plays);
    }
    result.set(itemKey(clean), clean);
  }
  return [...result.values()];
}
export function validateImport(value: unknown): SpotifyImport {
  if (!value || typeof value !== "object") throw new Error("Invalid Spotify summary.");
  const data = value as SpotifyImport;
  if (!/^[a-f0-9]{64}$/.test(data.fingerprint)) throw new Error("Invalid import fingerprint.");
  for (const field of ["totalPlays", "fileCount", "duplicateCount", "ignoredCount"] as const) {
    if (!Number.isSafeInteger(data[field]) || data[field] < 0) throw new Error("Invalid import counts.");
  }
  if (!data.totalPlays || data.fileCount < 1 || data.fileCount > 30) throw new Error("Empty import.");
  if (!data.from || !data.to || !Number.isFinite(Date.parse(data.from)) || !Number.isFinite(Date.parse(data.to)) || Date.parse(data.from) > Date.parse(data.to)) throw new Error("Invalid date coverage.");
  return {
    items: validateItems(data.items, 150, true),
    totalPlays: data.totalPlays,
    fileCount: data.fileCount,
    duplicateCount: data.duplicateCount,
    ignoredCount: data.ignoredCount,
    fingerprint: data.fingerprint,
    from: data.from,
    to: data.to,
    updatedAt: new Date().toISOString(),
    ...(data.monthlyCapsules ? { monthlyCapsules: data.monthlyCapsules } : {}),
  };
}

