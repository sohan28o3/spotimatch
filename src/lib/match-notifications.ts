import { admin } from "@/lib/server";
import { buildDiscoveryCandidate, MIN_MATCH_SCORE } from "@/lib/match-discovery";
import type { MusicData } from "@/types";

const MAX_USERS_TO_CHECK = 200;

function connected(music: Partial<MusicData> | undefined): boolean {
  return Boolean(music?.spotify || music?.lastfm);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

async function sendMatchEmail(recipientUid: string, name: string, reason: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MATCH_EMAIL_FROM;
  if (!apiKey || !from) return;

  const { auth, db } = admin();
  const day = new Date().toISOString().slice(0, 10);
  const marker = db.doc(`emailNotifications/${recipientUid}/days/${day}`);
  const shouldSend = await db.runTransaction(async transaction => {
    const sent = await transaction.get(marker);
    if (sent.exists) return false;
    transaction.create(marker, { createdAt: new Date().toISOString(), type: "new_match" });
    return true;
  });
  if (!shouldSend) return;

  const recipient = await auth.getUser(recipientUid);
  if (!recipient.email) return;
  const appUrl = process.env.APP_URL || "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      subject: "A new music match is waiting on SpotiMatch",
      html: `<p>A new listener may be a strong music match for you.</p><p><strong>${escapeHtml(reason)}</strong></p><p><a href="${escapeHtml(appUrl)}">Open SpotiMatch</a> to meet ${escapeHtml(name)}.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Match email provider returned ${response.status}.`);
}

/** Notify existing listeners when this user's refreshed listening data creates a strong new match. */
export async function notifyCompatibleListeners(newUserId: string): Promise<void> {
  const { db } = admin();
  const [newProfileSnap, newMusicSnap, newSocialSnap, usersSnap] = await Promise.all([
    db.doc(`users/${newUserId}`).get(),
    db.doc(`music/${newUserId}`).get(),
    db.doc(`social/${newUserId}`).get(),
    db.collection("users").limit(MAX_USERS_TO_CHECK).get(),
  ]);
  const newProfile = newProfileSnap.data();
  const newMusic = newMusicSnap.data() as Partial<MusicData> | undefined;
  if (!newProfile?.username || !connected(newMusic)) return;

  const newBlocked = new Set<string>((newSocialSnap.data()?.blockedUserIds || []) as string[]);
  const recipients = usersSnap.docs.filter(document => document.id !== newUserId && document.data()?.username && !newBlocked.has(document.id));
  if (!recipients.length) return;
  const [musicSnaps, socialSnaps] = await Promise.all([
    db.getAll(...recipients.map(document => db.doc(`music/${document.id}`))),
    db.getAll(...recipients.map(document => db.doc(`social/${document.id}`))),
  ]);

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    const recipientMusic = musicSnaps[index].data() as Partial<MusicData> | undefined;
    if (!connected(recipientMusic)) continue;
    const social = socialSnaps[index].data() || {};
    const excluded = new Set<string>([
      ...((social.blockedUserIds || []) as string[]),
      ...((social.outgoingRequests || []) as string[]),
      ...((social.friends || []) as Array<{ id: string }>).map(friend => friend.id),
      ...((social.incomingRequests || []) as Array<{ fromUserId: string }>).map(request => request.fromUserId),
    ]);
    if (excluded.has(newUserId)) continue;

    const match = buildDiscoveryCandidate({ id: newUserId, profile: newProfile, callerMusic: recipientMusic || {}, candidateMusic: newMusic || {} });
    if (!match || match.matchScore < MIN_MATCH_SCORE) continue;
    const notificationRef = db.doc(`matchNotifications/${recipient.id}/items/${newUserId}`);
    const existing = await notificationRef.get();
    if (existing.exists) continue;
    const createdAt = new Date().toISOString();
    await notificationRef.set({
      id: `new-match-${newUserId}`,
      candidateId: newUserId,
      candidateName: match.name,
      candidateUsername: match.username,
      candidateAvatarUrl: match.avatarUrl,
      matchScore: match.matchScore,
      matchReason: match.matchReason,
      createdAt,
    });
    const day = new Date().toISOString().slice(0, 10);
    const dailyRef = db.doc(`dailyMatches/${recipient.id}/days/${day}`);
    await db.runTransaction(async transaction => {
      const daily = await transaction.get(dailyRef);
      if (!daily.exists) return;
      const data = daily.data() || {};
      const skipped = new Set<string>((data.skippedIds || []) as string[]);
      const current = (data.matches || []) as Array<{ id: string; matchScore: number }>;
      if (skipped.has(newUserId) || current.some(item => item.id === newUserId) || current.length >= 5) return;
      const updated = [...current, match].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
      transaction.update(dailyRef, { matches: updated, initialMatchCount: updated.length, updatedAt: createdAt });
    });
    if (recipient.data()?.emailMatchNotifications === true) {
      await sendMatchEmail(recipient.id, match.name, match.matchReason || `${match.matchScore}% music match`).catch(error => console.error("Failed to send match email:", error));
    }
  }
}
