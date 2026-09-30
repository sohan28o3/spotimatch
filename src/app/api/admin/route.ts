import { FieldValue } from "firebase-admin/firestore";
import { admin, ApiError, failure, json, readBody, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";

function iso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}

async function audit(adminUid: string, action: string, targetId: string, details?: Record<string, unknown>) {
  await admin().db.collection("adminAudit").add({ adminUid, action, targetId, details: details || {}, createdAt: FieldValue.serverTimestamp() });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { db, auth } = admin();
    const [usersSnap, musicSnap, socialSnap, reportsSnap, messagesSnap, dmSnap, auditSnap, activitySnap, authUsers] = await Promise.all([
      db.collection("users").limit(200).get(), db.collection("music").limit(200).get(), db.collection("social").limit(200).get(),
      db.collection("matchReports").orderBy("createdAt", "desc").limit(100).get(),
      db.collection("chat_messages").orderBy("createdAt", "desc").limit(100).get(),
      db.collection("direct_messages").orderBy("lastMessageAt", "desc").limit(30).get(),
      db.collection("adminAudit").orderBy("createdAt", "desc").limit(100).get(),
      db.collection("activityLogs").orderBy("createdAt", "desc").limit(250).get(), auth.listUsers(1000),
    ]);
    const musicMap = new Map(musicSnap.docs.map(doc => [doc.id, doc.data()]));
    const emailMap = new Map(authUsers.users.map(user => [user.uid, user.email || ""]));
    const profileMap = new Map(usersSnap.docs.map(doc => [doc.id, doc.data()]));
    const socialMap = new Map(socialSnap.docs.map(doc => [doc.id, doc.data()]));
    const nameFor = (uid: string) => { const profile = profileMap.get(uid); return profile?.displayName ? `${profile.displayName} (@${profile.username || "listener"})` : uid; };
    const users = usersSnap.docs.map(doc => {
      const profile = doc.data(), music = musicMap.get(doc.id), social = socialMap.get(doc.id) || {};
      return { uid: doc.id, displayName: profile.displayName || "Music Lover", username: profile.username || "listener", email: emailMap.get(doc.id) || profile.email || "", photoURL: profile.photoURL || "", createdAt: iso(profile.createdAt) || profile.createdAt || null, hasSpotify: Boolean(music?.spotify), hasLastfm: Boolean(music?.lastfm), friendCount: (social.friends || []).length, pendingCount: (social.incomingRequests || []).length, blockedCount: (social.blockedUserIds || []).length };
    });
    const friendRequests = socialSnap.docs.flatMap(doc => ((doc.data()?.incomingRequests || []) as Array<Record<string, unknown>>).map(item => ({ id: String(item.id || `${item.fromUserId}-${doc.id}`), fromUserId: String(item.fromUserId || ""), fromName: String(item.fromName || nameFor(String(item.fromUserId || ""))), toUserId: doc.id, toName: nameFor(doc.id), message: String(item.message || ""), matchScore: Number(item.matchScore || 0), createdAt: iso(item.createdAt) || String(item.createdAt || "") }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: iso(doc.data().createdAt) || doc.data().createdAt || "" }));
    const directThreads = await Promise.all(dmSnap.docs.map(async doc => {
      const data = doc.data(), participantIds = (data.participantIds || []) as string[];
      const conversation = await doc.ref.collection("messages").orderBy("createdAt", "asc").limitToLast(60).get();
      return { id: doc.id, participantIds, participantNames: participantIds.map(nameFor), lastMessage: data.lastMessage || "", lastMessageAt: iso(data.lastMessageAt) || data.lastMessageAt || "", messages: conversation.docs.map(message => ({ id: message.id, ...message.data(), createdAt: iso(message.data().createdAt) || message.data().createdAt || "" })) };
    }));
    const reports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: iso(doc.data().createdAt) }));
    const auditLog = auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: iso(doc.data().createdAt) }));
    const activityLog = activitySnap.docs.map(doc => { const data = doc.data(); return { id: doc.id, ...data, actorName: nameFor(String(data.actorId || "")), targetName: data.targetId ? nameFor(String(data.targetId)) : "", createdAt: iso(data.createdAt) }; });
    return json({ summary: { users: usersSnap.size, connectedListeners: musicSnap.docs.filter(doc => doc.data()?.spotify || doc.data()?.lastfm).length, openReports: reportsSnap.docs.filter(doc => doc.data()?.status !== "resolved" && doc.data()?.status !== "dismissed").length, globalMessages: messagesSnap.size, directThreads: dmSnap.size, pendingRequests: friendRequests.length }, users, reports, messages, directThreads, friendRequests, activityLog, auditLog });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const administrator = await requireAdmin(request), body = await readBody(request), action = String(body.action || ""), targetId = String(body.targetId || "").trim();
    if (!targetId) throw new ApiError("A target is required.");
    const { db, auth } = admin();
    if (action === "delete_global_message") await db.doc(`chat_messages/${targetId}`).delete();
    else if (action === "delete_dm_thread") await db.recursiveDelete(db.doc(`direct_messages/${targetId}`));
    else if (action === "remove_friend_request") {
      const senderId = String(body.secondaryId || "").trim();
      if (!senderId) throw new ApiError("The friend-request sender is required.");
      const [recipientSnap, senderSnap] = await Promise.all([db.doc(`social/${targetId}`).get(), db.doc(`social/${senderId}`).get()]);
      await Promise.all([
        db.doc(`social/${targetId}`).set({ incomingRequests: (((recipientSnap.data() || {}).incomingRequests || []) as Array<{ fromUserId?: string }>).filter(item => item.fromUserId !== senderId) }, { merge: true }),
        db.doc(`social/${senderId}`).set({ outgoingRequests: (((senderSnap.data() || {}).outgoingRequests || []) as string[]).filter(id => id !== targetId) }, { merge: true }),
      ]);
    } else if (action === "resolve_report" || action === "dismiss_report") await db.doc(`matchReports/${targetId}`).set({ status: action === "resolve_report" ? "resolved" : "dismissed", resolvedAt: FieldValue.serverTimestamp(), resolvedBy: administrator.uid }, { merge: true });
    else if (action === "delete_user") {
      if (targetId === administrator.uid) throw new ApiError("You cannot delete the active administrator account.");
      const [socialSnap, targetProfileSnap, globalMessages, reportsByUser, reportsAboutUser, threads] = await Promise.all([db.collection("social").limit(500).get(), db.doc(`users/${targetId}`).get(), db.collection("chat_messages").where("userId", "==", targetId).get(), db.collection("matchReports").where("reporterId", "==", targetId).get(), db.collection("matchReports").where("candidateId", "==", targetId).get(), db.collection("direct_messages").where("participantIds", "array-contains", targetId).get()]);
      const batch = db.batch(), targetUsername = String(targetProfileSnap.data()?.username || "").toLowerCase();
      for (const path of [`users/${targetId}`, `music/${targetId}`, `connections/${targetId}`, `social/${targetId}`, `rateLimits/${targetId}_sync`]) batch.delete(db.doc(path));
      if (targetUsername) batch.delete(db.doc(`usernames/${targetUsername}`));
      for (const doc of [...globalMessages.docs, ...reportsByUser.docs, ...reportsAboutUser.docs]) batch.delete(doc.ref);
      for (const socialDoc of socialSnap.docs) {
        if (socialDoc.id === targetId) continue;
        const data = socialDoc.data();
        batch.set(socialDoc.ref, { friends: ((data.friends || []) as Array<{ id?: string }>).filter(item => item.id !== targetId), incomingRequests: ((data.incomingRequests || []) as Array<{ fromUserId?: string }>).filter(item => item.fromUserId !== targetId), outgoingRequests: ((data.outgoingRequests || []) as string[]).filter(id => id !== targetId), blockedUserIds: ((data.blockedUserIds || []) as string[]).filter(id => id !== targetId) }, { merge: true });
      }
      await batch.commit();
      await Promise.all([db.recursiveDelete(db.doc(`dailyMatches/${targetId}`)), db.recursiveDelete(db.doc(`matchSkips/${targetId}`)), db.recursiveDelete(db.doc(`matchNotifications/${targetId}`)), db.recursiveDelete(db.doc(`emailNotifications/${targetId}`)), ...threads.docs.map(doc => db.recursiveDelete(doc.ref))]);
      await auth.deleteUser(targetId).catch(error => { if (error?.code !== "auth/user-not-found") throw error; });
    } else throw new ApiError("Unsupported administrator action.");
    await audit(administrator.uid, action, targetId, typeof body.secondaryId === "string" ? { secondaryId: body.secondaryId } : undefined);
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
