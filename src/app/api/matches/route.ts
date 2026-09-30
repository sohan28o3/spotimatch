import { FieldValue } from "firebase-admin/firestore";
import type { MusicData, TasteMatch } from "@/types";
import { buildDiscoveryCandidate, DAILY_MATCH_LIMIT } from "@/lib/match-discovery";
import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SKIP_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

interface SocialState {
  friends?: Array<{ id: string }>;
  incomingRequests?: Array<{ fromUserId: string }>;
  outgoingRequests?: string[];
  blockedUserIds?: string[];
}

function dayFrom(request: Request): string {
  const value = new URL(request.url).searchParams.get("day") || new Date().toISOString().slice(0, 10);
  if (!DAY.test(value)) throw new ApiError("Invalid discovery date.");
  return value;
}

function exclusions(social: SocialState): Set<string> {
  return new Set([
    ...(social.friends || []).map(item => item.id),
    ...(social.incomingRequests || []).map(item => item.fromUserId),
    ...(social.outgoingRequests || []),
    ...(social.blockedUserIds || []),
  ]);
}

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { db } = admin();
    const flags = (await db.doc("featureToggles/flags").get()).data() || {};
    if (flags.discovery === false) return json({ disabled: true, locked: false, sourceCount: 0, day: dayFrom(request), matches: [], previousMatches: [] }, 503);
    const day = dayFrom(request);
    const [musicSnap, socialSnap] = await Promise.all([db.doc(`music/${uid}`).get(), db.doc(`social/${uid}`).get()]);
    const callerMusic = (musicSnap.data() || {}) as Partial<MusicData>;
    const sourceCount = Number(Boolean(callerMusic.spotify)) + Number(Boolean(callerMusic.lastfm));
    if (sourceCount === 0) return json({ locked: true, sourceCount, day, matches: [], previousMatches: [] });

    const social = (socialSnap.data() || {}) as SocialState;
    const excluded = exclusions(social);
    const dayRef = db.doc(`dailyMatches/${uid}/days/${day}`);
    const saved = await dayRef.get();
    let matches = (saved.data()?.matches || []) as TasteMatch[];

    if (!saved.exists) {
      const [usersSnap, skipsSnap] = await Promise.all([
        db.collection("users").limit(200).get(),
        db.collection(`matchSkips/${uid}/users`).get(),
      ]);
      const now = Date.now();
      for (const skip of skipsSnap.docs) if (Number(skip.data()?.until || 0) > now) excluded.add(skip.id);
      excluded.add(uid);

      const candidateDocs = usersSnap.docs.filter(doc => !excluded.has(doc.id) && doc.data()?.username);
      const musicSnaps = candidateDocs.length ? await db.getAll(...candidateDocs.map(doc => db.doc(`music/${doc.id}`))) : [];
      const socialSnaps = candidateDocs.length ? await db.getAll(...candidateDocs.map(doc => db.doc(`social/${doc.id}`))) : [];
      const candidates: TasteMatch[] = [];
      for (let index = 0; index < candidateDocs.length; index += 1) {
        const candidateId = candidateDocs[index].id;
        const candidateSocial = (socialSnaps[index]?.data() || {}) as SocialState;
        if ((candidateSocial.blockedUserIds || []).includes(uid)) continue;
        const candidate = buildDiscoveryCandidate({
          id: candidateId,
          profile: candidateDocs[index].data(),
          callerMusic,
          candidateMusic: (musicSnaps[index]?.data() || {}) as Partial<MusicData>,
        });
        if (candidate) candidates.push(candidate);
      }
      candidates.sort((a, b) => b.matchScore - a.matchScore || a.id.localeCompare(b.id));
      matches = candidates.slice(0, DAILY_MATCH_LIMIT);
      await dayRef.set({ day, matches, skippedIds: [], createdAt: new Date().toISOString() });
    }

    const skippedIds = new Set<string>((saved.data()?.skippedIds || []) as string[]);
    matches = matches.filter(match => !excluded.has(match.id) && !skippedIds.has(match.id));
    const historySnap = await db.collection(`dailyMatches/${uid}/days`).get();
    const previousById = new Map<string, TasteMatch>();
    const historyCutoff = new Date(`${day}T12:00:00.000Z`);
    historyCutoff.setUTCDate(historyCutoff.getUTCDate() - 6);
    const oldestVisibleDay = historyCutoff.toISOString().slice(0, 10);
    for (const historyDoc of historySnap.docs
      .filter(doc => doc.id <= day && doc.id >= oldestVisibleDay)
      .sort((a, b) => b.id.localeCompare(a.id))
      .slice(0, 7)) {
      const history = historyDoc.data();
      const historicalMatches = (history.matches || []) as TasteMatch[];
      const historicalSkipped = new Set<string>((history.skippedIds || []) as string[]);
      for (const match of historicalMatches) {
        const isPrevious = historyDoc.id < day || historicalSkipped.has(match.id);
        if (isPrevious && !excluded.has(match.id) && !previousById.has(match.id)) previousById.set(match.id, match);
      }
    }
    return json({ locked: false, sourceCount, day, matches, previousMatches: Array.from(previousById.values()) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readBody(request);
    const action = String(body.action || "");
    if (action !== "skip" && action !== "report") throw new ApiError("Unsupported match action.");
    const candidateId = String(body.candidateId || "").trim();
    const day = String(body.day || "");
    if (!candidateId || !DAY.test(day) || candidateId === uid) throw new ApiError("Invalid match selection.");
    const { db } = admin();
    const writes: Array<Promise<unknown>> = [
      db.doc(`matchSkips/${uid}/users/${candidateId}`).set({ skippedAt: Date.now(), until: Date.now() + SKIP_COOLDOWN_MS, day }),
      db.doc(`dailyMatches/${uid}/days/${day}`).set({ skippedIds: FieldValue.arrayUnion(candidateId) }, { merge: true }),
    ];
    if (action === "report") {
      writes.push(db.collection("matchReports").add({ reporterId: uid, candidateId, day, createdAt: FieldValue.serverTimestamp(), status: "open" }));
    }
    await Promise.all(writes);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
