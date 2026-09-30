import { lastfm } from "@/lib/lastfm";
import { artworkCandidates, enrichArtwork, enrichTrackDetails, normalizeItems } from "@/lib/catalog";
import { ApiError, failure, json, requireUser, throttle } from "@/lib/server";
import type { MusicKind } from "@/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") as MusicKind, q = url.searchParams.get("q")?.trim() || "";
    if (!["artist", "track", "album"].includes(kind) || q.length < 2 || q.length > 100) throw new ApiError("Enter between 2 and 100 characters to search.");
    const user = await requireUser(request);
    await throttle(user.uid, "search", 40, 60000);
    const [data, artwork] = await Promise.all([
      lastfm(`${kind}.search`, { [kind]: q, limit: "12" }),
      kind === "artist" ? artworkCandidates(kind, q) : Promise.resolve(null),
    ]);
    const results = data.results as Record<string, Record<string, unknown>> | undefined;
    let items = enrichArtwork(normalizeItems(results?.[`${kind}matches`]?.[kind], kind), artwork);
    if (kind === "track") items = await enrichTrackDetails(items, item => lastfm("track.getInfo", { artist: item.artist, track: item.name }, false, 86400));
    return json({ items });
  } catch (error) { return failure(error); }
}
