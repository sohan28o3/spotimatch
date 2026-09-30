import { admin, ApiError, failure, json, requireUser, throttle } from "@/lib/server";
import { getLiveLastfm, musicSnapshot } from "@/lib/lastfm";
import { notifyCompatibleListeners } from "@/lib/match-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// In-memory cache & throttle to avoid heavy Firestore transactions and 429 lockouts on rapid polling
type CachedLive = { timestamp: number; live: unknown };
const liveCache = new Map<string, CachedLive>();

/** Real-time polling endpoint for live now-playing track & 5 recent tracks / artists */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryUser = url.searchParams.get("user");
    let targetUsername = "";
    let cacheKey = "";

    if (queryUser) {
      targetUsername = queryUser.trim();
      cacheKey = `user:${targetUsername}`;
    } else {
      const user = await requireUser(request),
        { db } = admin();
      const ref = db.doc(`connections/${user.uid}`);
      const connection = (await ref.get()).data();
      if (!connection || !connection.username) {
        return json({ connected: false, live: null });
      }
      targetUsername = connection.username;
      cacheKey = user.uid;
    }

    // Serve from in-memory cache if polled within 1.5s (debounce rapid focus / multi-tab triggers)
    const cached = liveCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < 1500) {
      return json({ connected: true, username: targetUsername, live: cached.live });
    }

    try {
      const live = await getLiveLastfm(targetUsername);
      liveCache.set(cacheKey, { timestamp: now, live });
      return json({ connected: true, username: targetUsername, live });
    } catch {
      // Gracefully return last known live data on upstream timeout to keep client responsive
      return json({ connected: true, username: targetUsername, live: cached?.live ?? null });
    }
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request),
      { db } = admin();
    const ref = db.doc(`connections/${user.uid}`),
      connection = (await ref.get()).data();
    if (!connection) throw new ApiError("Connect Last.fm first.");

    // Cooldown of 15 seconds (reduced from 5 minutes for real-time responsiveness)
    await throttle(user.uid, "sync", 2, 30000);

    const [live, snapshot] = await Promise.all([
      getLiveLastfm(connection.username).catch(() => null),
      musicSnapshot(connection.username).catch(() => null),
    ]);

    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (!current || current.connectedAt !== connection.connectedAt)
        throw new ApiError("Your Last.fm connection changed. Please refresh the page.", 409);

      const updates: Record<string, unknown> = {
        "lastfm.snapshot": snapshot,
      };
      if (live) {
        updates["lastfm.nowPlaying"] = live.nowPlaying;
        updates["lastfm.recentTracks"] = live.recentTracks;
        updates["lastfm.recentArtists"] = live.recentArtists;
        updates["lastfm.monthlyScrobbleCount"] = live.monthlyScrobbleCount;
        updates["lastfm.monthlyTopGenre"] = live.monthlyTopGenre;
      }
      tx.update(db.doc(`music/${user.uid}`), updates);
    });

    await notifyCompatibleListeners(user.uid);

    return json({ snapshot, live });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request),
      { db } = admin(),
      batch = db.batch();
    batch.delete(db.doc(`connections/${user.uid}`));
    batch.set(db.doc(`music/${user.uid}`), { lastfm: null }, { merge: true });
    await batch.commit();
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

