import type { MusicData } from "@/types";
import { aggregateGenreStats, type GenreStats } from "@/lib/genre-stats";
import { admin, failure, requireUser } from "@/lib/server";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isFreshStats(value: unknown): value is GenreStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as GenreStats;
  const updated = Date.parse(stats.updatedAt);
  return (
    Number.isFinite(updated) &&
    Date.now() - updated < ONE_DAY_MS &&
    Number.isInteger(stats.totalListeners) &&
    Array.isArray(stats.genres)
  );
}

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const { db } = admin();
    const cacheRef = db.doc("appStats/genres");
    const cached = (await cacheRef.get()).data()?.value;

    if (isFreshStats(cached)) {
      return Response.json(cached, { headers: { "Cache-Control": "private, max-age=300" } });
    }

    const [usersSnapshot, musicSnapshot] = await Promise.all([
      db.collection("users").select().get(),
      db.collection("music").get(),
    ]);
    const realUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));
    const musicByUser = musicSnapshot.docs
      .filter(doc => realUserIds.has(doc.id))
      .map(doc => doc.data() as Partial<MusicData>);
    const stats = aggregateGenreStats(musicByUser);

    await cacheRef.set({ value: stats }, { merge: false });
    return Response.json(stats, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    return failure(error);
  }
}
