import { admin, failure, json, readBody, requireUser } from "@/lib/server";
import type { AppNotification, FriendRequest, FriendUser } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { db } = admin();
    const notifications: AppNotification[] = [];

    // Read persistent read notification IDs and user settings for this user
    let persistedReadIds = new Set<string>();
    let socialData: Record<string, unknown> | null = null;
    let userDoc: Record<string, unknown> | null = null;
    try {
      const [socialSnap, uSnap] = await Promise.all([
        db.doc(`social/${uid}`).get(),
        db.doc(`users/${uid}`).get(),
      ]);
      if (socialSnap.exists) {
        socialData = socialSnap.data() as Record<string, unknown>;
        const stored = (socialData?.readNotifications || []) as string[];
        persistedReadIds = new Set(stored);
      }
      if (uSnap.exists) {
        userDoc = uSnap.data() as Record<string, unknown>;
      }
    } catch {}

    const mutedChatIds = new Set<string>([
      ...((userDoc?.mutedChatIds || []) as string[]),
    ]);
    const blockedUserIds = new Set<string>([
      ...((userDoc?.blockedUserIds || socialData?.blockedUserIds || []) as string[]),
    ]);
    const globalChatNotifications = Boolean(userDoc?.globalChatNotifications);

    // 1. Fetch incoming friend requests from social/{uid}
    if (socialData) {
      const incoming = (socialData.incomingRequests || []) as FriendRequest[];
      for (const req of incoming) {
        if (blockedUserIds.has(req.fromUserId)) continue;
        const notifId = `req-${req.id || req.fromUserId}`;
        notifications.push({
          id: notifId,
          type: "friend_request",
          title: "New Friend Request",
          body: req.message
            ? `${req.fromName} sent a friend request: “${req.message}”`
            : `${req.fromName} (@${req.fromUsername}) sent you a friend request (${req.matchScore}% Match).`,
          createdAt: req.createdAt || new Date().toISOString(),
          read: persistedReadIds.has(notifId),
          senderId: req.fromUserId,
          senderName: req.fromName,
          senderUsername: req.fromUsername,
          senderAvatarUrl: req.fromAvatarUrl,
          matchScore: req.matchScore,
          actionPayload: {
            requestId: req.id,
            fromUserId: req.fromUserId,
            ...(req.matchReason ? { matchReason: req.matchReason } : {}),
          },
        });
      }

      // Friend accepted notifications (friends connected recently)
      const friends = (socialData.friends || []) as FriendUser[];
      for (const friend of friends) {
        if (blockedUserIds.has(friend.id)) continue;
        const connectedTime = new Date(friend.connectedAt || 0).getTime();
        // If connected in the last 72 hours
        if (connectedTime > Date.now() - 72 * 3600000) {
          const notifId = `friend-accept-${friend.id}`;
          notifications.push({
            id: notifId,
            type: "friend_accepted",
            title: "Friend Request Accepted!",
            body: `${friend.name} (@${friend.username}) accepted your friend request. You can now chat 1-on-1!`,
            createdAt: friend.connectedAt || new Date().toISOString(),
            read: persistedReadIds.has(notifId),
            senderId: friend.id,
            senderName: friend.name,
            senderUsername: friend.username,
            senderAvatarUrl: friend.avatarUrl,
            matchScore: friend.matchScore,
            actionPayload: {
              friendId: friend.id,
            },
          });
        }
      }
    }

    // 2. Fetch direct message threads where the user was the recipient of the last message
    // NOTE: Filter out muted chats and blocked users!
    try {
      const dmSnap = await db
        .collection("direct_messages")
        .where("participantIds", "array-contains", uid)
        .limit(25)
        .get();

      const threads = dmSnap.docs
        .map(d => d.data())
        .filter(
          t =>
            t.lastSenderId &&
            t.lastSenderId !== uid &&
            !blockedUserIds.has(t.lastSenderId) &&
            !mutedChatIds.has(t.lastSenderId) &&
            !mutedChatIds.has(t.threadId)
        );

      // Sort in-memory by lastMessageAt descending
      threads.sort(
        (a, b) =>
          new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
      );

      for (const thread of threads.slice(0, 10)) {
        const notifId = `dm-${thread.threadId}-${thread.lastMessageAt}`;
        let senderName = "A friend";
        let senderUsername = "friend";
        let senderAvatarUrl = "";
        try {
          const senderSnap = await db.doc(`users/${thread.lastSenderId}`).get();
          if (senderSnap.exists) {
            const u = senderSnap.data();
            senderName = u?.displayName || senderName;
            senderUsername = u?.username || senderUsername;
            senderAvatarUrl = u?.photoURL || "";
          }
        } catch {}

        notifications.push({
          id: notifId,
          type: "direct_message",
          title: `New Message from ${senderName}`,
          body: thread.lastMessage || "Sent you a message",
          createdAt: thread.lastMessageAt || new Date().toISOString(),
          read: persistedReadIds.has(notifId),
          senderId: thread.lastSenderId,
          senderName,
          senderUsername,
          senderAvatarUrl,
          actionPayload: {
            friendId: thread.lastSenderId,
          },
        });
      }
    } catch (err) {
      console.error("Error loading dm notifications:", err);
    }

    // 3. Global Chat Notifications: ONLY if user explicitly enabled them
    if (globalChatNotifications) {
      try {
        const chatSnap = await db
          .collection("chat_messages")
          .orderBy("createdAt", "desc")
          .limit(5)
          .get();

        for (const doc of chatSnap.docs) {
          const msg = doc.data();
          if (msg.userId && msg.userId !== uid && !blockedUserIds.has(msg.userId)) {
            const notifId = `global-${msg.id || doc.id}`;
            notifications.push({
              id: notifId,
              type: "taste_match",
              title: `Global Chat: ${msg.name}`,
              body: msg.text || "Shared a track recommendation",
              createdAt: msg.createdAt || new Date().toISOString(),
              read: persistedReadIds.has(notifId),
              senderId: msg.userId,
              senderName: msg.name,
              senderUsername: msg.username,
              senderAvatarUrl: msg.avatarUrl,
              trackAttachment: msg.attachment
                ? {
                    name: msg.attachment.name,
                    artist: msg.attachment.artist,
                    image: msg.attachment.image,
                  }
                : undefined,
            });
            break; // One latest global message is enough
          }
        }
      } catch (err) {
        console.error("Error loading global chat notifications:", err);
      }
    }

    // Sort descending by date
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const unreadCount = notifications.filter(n => !n.read).length;
    return json({ notifications, unreadCount, hasUnread: unreadCount > 0 });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const action = String(body.action || "").trim();
    const { uid } = await requireUser(request);

    if (action === "mark_all_read") {
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
      const { db } = admin();
      const socialRef = db.doc(`social/${uid}`);
      const sSnap = await socialRef.get();
      const existing = (sSnap.data()?.readNotifications || []) as string[];
      await socialRef.set(
        { readNotifications: Array.from(new Set([...existing, ...ids])) },
        { merge: true }
      );
      return json({ success: true });
    }

    if (action === "mark_read" && typeof body.id === "string") {
      const { db } = admin();
      const socialRef = db.doc(`social/${uid}`);
      const sSnap = await socialRef.get();
      const existing = (sSnap.data()?.readNotifications || []) as string[];
      await socialRef.set(
        { readNotifications: Array.from(new Set([...existing, body.id])) },
        { merge: true }
      );
      return json({ success: true });
    }

    if (action === "mark_chat_read" && typeof body.senderId === "string") {
      const senderId = body.senderId;
      const { db } = admin();
      const dmSnap = await db
        .collection("direct_messages")
        .where("participantIds", "array-contains", uid)
        .limit(20)
        .get();
      const threadIds = dmSnap.docs
        .map(d => d.data())
        .filter(t => t.lastSenderId === senderId)
        .map(t => `dm-${t.threadId}-${t.lastMessageAt}`);
      const socialRef = db.doc(`social/${uid}`);
      const sSnap = await socialRef.get();
      const existing = (sSnap.data()?.readNotifications || []) as string[];
      await socialRef.set(
        { readNotifications: Array.from(new Set([...existing, ...threadIds])) },
        { merge: true }
      );
      return json({ success: true });
    }

    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
