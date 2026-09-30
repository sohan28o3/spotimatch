import { FieldValue } from "firebase-admin/firestore";
import { admin, ApiError, failure, json, readBody, requireAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";

async function audit(adminUid: string, action: string, targetId: string, details?: Record<string, unknown>) {
  await admin().db.collection("adminAudit").add({ adminUid, action, targetId, details: details || {}, createdAt: FieldValue.serverTimestamp() });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { db, auth } = admin();
    const [usersSnap, musicSnap, reportsSnap, messagesSnap, dmSnap, auditSnap, authUsers] = await Promise.all([
      db.collection("users").limit(100).get(),
      db.collection("music").get(),
      db.collection("matchReports").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("chat_messages").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("direct_messages").orderBy("updatedAt", "desc").limit(50).get(),
      db.collection("adminAudit").orderBy("createdAt", "desc").limit(30).get(),
      auth.listUsers(1000),
    ]);

    const musicMap = new Map(musicSnap.docs.map(doc => [doc.id, doc.data()]));
    const emailMap = new Map(authUsers.users.map(user => [user.uid, user.email || ""]));
    const users = usersSnap.docs.map(doc => {
      const profile = doc.data();
      const music = musicMap.get(doc.id);
      return {
        uid: doc.id,
        displayName: profile.displayName || "Music Lover",
        username: profile.username || "listener",
        email: emailMap.get(doc.id) || profile.email || "",
        photoURL: profile.photoURL || "",
        createdAt: profile.createdAt || null,
        hasSpotify: Boolean(music?.spotify),
        hasLastfm: Boolean(music?.lastfm),
      };
    });
    const reports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const directThreads = dmSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const auditLog = auditSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return json({
      summary: {
        users: usersSnap.size,
        connectedListeners: musicSnap.docs.filter(doc => doc.data()?.spotify || doc.data()?.lastfm).length,
        openReports: reports.filter((report: Record<string, unknown>) => report.status !== "resolved").length,
        globalMessages: messagesSnap.size,
        directThreads: dmSnap.size,
      },
      users,
      reports,
      messages,
      directThreads,
      auditLog,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const administrator = await requireAdmin(request);
    const body = await readBody(request);
    const action = String(body.action || "");
    const targetId = String(body.targetId || "").trim();
    if (!targetId) throw new ApiError("A target is required.");
    const { db, auth } = admin();

    if (action === "delete_global_message") {
      await db.doc(`chat_messages/${targetId}`).delete();
    } else if (action === "delete_dm_thread") {
      await db.recursiveDelete(db.doc(`direct_messages/${targetId}`));
    } else if (action === "resolve_report") {
      await db.doc(`matchReports/${targetId}`).set({ status: "resolved", resolvedAt: FieldValue.serverTimestamp(), resolvedBy: administrator.uid }, { merge: true });
    } else if (action === "dismiss_report") {
      await db.doc(`matchReports/${targetId}`).set({ status: "dismissed", resolvedAt: FieldValue.serverTimestamp(), resolvedBy: administrator.uid }, { merge: true });
    } else if (action === "delete_user") {
      if (targetId === administrator.uid) throw new ApiError("You cannot delete the active administrator account.");
      const [socialSnap, targetProfileSnap] = await Promise.all([
        db.collection("social").get(),
        db.doc(`users/${targetId}`).get(),
      ]);
      const batch = db.batch();
      const targetUsername = String(targetProfileSnap.data()?.username || "").toLowerCase();
      batch.delete(db.doc(`users/${targetId}`));
      batch.delete(db.doc(`music/${targetId}`));
      batch.delete(db.doc(`social/${targetId}`));
      if (targetUsername) batch.delete(db.doc(`usernames/${targetUsername}`));
      for (const socialDoc of socialSnap.docs) {
        if (socialDoc.id === targetId) continue;
        const data = socialDoc.data();
        const friends = (data.friends || []).filter((item: { id?: string }) => item.id !== targetId);
        const incomingRequests = (data.incomingRequests || []).filter((item: { fromUserId?: string }) => item.fromUserId !== targetId);
        const outgoingRequests = (data.outgoingRequests || []).filter((id: string) => id !== targetId);
        const blockedUserIds = (data.blockedUserIds || []).filter((id: string) => id !== targetId);
        batch.set(socialDoc.ref, { friends, incomingRequests, outgoingRequests, blockedUserIds }, { merge: true });
      }
      await batch.commit();
      await Promise.all([
        db.recursiveDelete(db.doc(`dailyMatches/${targetId}`)),
        db.recursiveDelete(db.doc(`matchSkips/${targetId}`)),
      ]);
      const threads = await db.collection("direct_messages").where("participantIds", "array-contains", targetId).get();
      await Promise.all(threads.docs.map(doc => db.recursiveDelete(doc.ref)));
      await auth.deleteUser(targetId).catch(error => {
        if (error?.code !== "auth/user-not-found") throw error;
      });
    } else {
      throw new ApiError("Unsupported administrator action.");
    }

    await audit(administrator.uid, action, targetId);
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
