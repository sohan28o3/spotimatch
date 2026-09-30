import type { MusicItem, MusicKind } from "../types/index";
import { itemKey, safeMusicImage, safeMusicUrl } from "./music";

type Row = Record<string, unknown>;
function object(value: unknown): Row { return value && typeof value === "object" ? value as Row : {}; }
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
export function imageFrom(value: unknown): string | undefined {
  const images = Array.isArray(value) ? value : [];
  // Largest API-provided image first; do not display Last.fm's generic star as an artist photo.
  for (const size of ["extralarge", "large", "medium", "small"]) {
    const image = safeMusicImage(object(images.find(row => object(row).size === size))["#text"]);
    if (image) return image;
  }
}
export function normalizeItems(raw: unknown, kind: MusicKind, counts = false): MusicItem[] {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [], seen = new Set<string>();
  return rows.flatMap(value => {
    const row = object(value), name = text(row.name).slice(0, 200);
    const artist = kind === "artist" ? "" : (text(row.artist) || text(object(row.artist).name)).slice(0, 200);
    if (!name || (kind !== "artist" && !artist)) return [];
    const item: MusicItem = { kind, name, artist };
    const key = itemKey(item);
    if (seen.has(key)) return [];
    seen.add(key);
    const image = imageFrom(row.image), url = safeMusicUrl(row.url);
    if (image) { item.image = image; item.imageSource = "lastfm"; }
    if (url) item.url = url;
    if (counts) item.plays = Math.max(1, Number.parseInt(String(row.playcount), 10) || 1);
    return [item];
  });
}

const identity = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
// Match exact titles AND artists, so a similarly named cover doesn't get the wrong artwork.
export function enrichArtwork(items: MusicItem[], response: unknown): MusicItem[] {
  const raw = object(response).data;
  if (!Array.isArray(raw)) return items;
  return items.map(item => {
    const matched = raw.map(object).find(row => item.kind === "artist"
      ? identity(text(row.name)) === identity(item.name)
      : identity(text(row.title)) === identity(item.name) && identity(text(object(row.artist).name)) === identity(item.artist))
      || (item.kind === "artist" && raw.length > 0 ? object(raw[0]) : null);
    if (!matched) return item;
    const album = object(matched.album);
    const image = safeMusicImage(item.kind === "artist" ? (matched.picture_big || matched.picture_medium) : item.kind === "album" ? matched.cover_medium : album.cover_medium);
    const result = { ...item };
    if (!result.image && image) {
      result.image = image; result.imageSource = "deezer";
      const url = safeMusicUrl(matched.link);
      if (url) result.url = url;
    }
    if (item.kind === "track" && text(album.title)) result.album = text(album.title).slice(0, 200);
    return result;
  });
}

export async function artworkCandidates(kind: MusicKind, query: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  try {
    const url = new URL(`https://api.deezer.com/search/${kind}`);
    url.search = new URLSearchParams({ q: query, limit: "25" }).toString();
    const response = await fetcher(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } });
    return response.ok ? await response.json() : null;
  } catch { return null; } // Artwork failures must not block search or reorder results.
}

export async function enrichTrackDetails(items: MusicItem[], load: (item: MusicItem) => Promise<unknown>): Promise<MusicItem[]> {
  const output = [...items];
  let next = 0;
  // Bound concurrency and keep each result at its original relevance rank.
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++, item = items[index];
      if (item.kind !== "track" || (item.image && item.album)) continue;
      try {
        const track = object(object(await load(item)).track), artist = object(track.artist);
        if (identity(text(track.name)) !== identity(item.name) || identity(text(artist.name)) !== identity(item.artist)) continue;
        const album = object(track.album), image = imageFrom(album.image), url = safeMusicUrl(track.url);
        const enriched = { ...item };
        if (!enriched.image && image) { enriched.image = image; enriched.imageSource = "lastfm"; }
        if (text(album.title)) enriched.album = text(album.title).slice(0, 200);
        if (url) enriched.url = url;
        output[index] = enriched;
      } catch { /* Keep the result even when its optional artwork lookup fails. */ }
    }
  }));
  return output;
}
