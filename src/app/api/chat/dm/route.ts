import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import type { DirectChatMessage } from "@/types";

export const dynamic = "force-dynamic";

// In-memory fallback cache for DM messages
const dmCache = new Map<string, DirectChatMessage[]>();

function getThreadId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join("_");
}

async function requireDirectMessageAccess(uid: string, friendId: string) {
  const { db } = admin();
  const [mine, theirs] = await Promise.all([
    db.doc(`social/${uid}`).get(),
    db.doc(`social/${friendId}`).get(),
  ]);
  const myData = mine.data() || {};
  const theirData = theirs.data() || {};
  const friends = (myData.friends || []) as Array<{ id?: string }>;
  const myBlocks = new Set((myData.blockedUserIds || []) as string[]);
  const theirBlocks = new Set((theirData.blockedUserIds || []) as string[]);
  if (!friends.some(friend => friend.id === friendId) || myBlocks.has(friendId) || theirBlocks.has(uid)) {
    throw new ApiError("Direct messages are only available between connected friends.", 403);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const friendId = url.searchParams.get("friendId");
    if (!friendId) throw new ApiError("Missing friendId parameter.");

    const { uid } = await requireUser(request);
    await requireDirectMessageAccess(uid, friendId);

    const threadId = getThreadId(uid, friendId);

    // Try reading from Firestore
    try {
      const { db } = admin();
      const messagesSnap = await db
        .collection("direct_messages")
        .doc(threadId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .limit(100)
        .get();

      if (!messagesSnap.empty) {
        const msgs = messagesSnap.docs.map(d => d.data() as DirectChatMessage);
        return json({ messages: msgs, threadId });
      }
    } catch {
      // In-memory fallback
    }

    // In-memory fallback or seed for initial friend conversation
    let cached = dmCache.get(threadId);
    if (!cached || cached.length === 0) {
      if (friendId === "user-sam") {
        cached = [
          {
            id: `seed-dm-${Date.now()}-1`,
            threadId,
            senderId: "user-sam",
            senderName: "Sam Takahashi",
            senderUsername: "samtune",
            senderAvatarUrl:
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=faces",
            recipientId: uid,
            text: "Hey! Loved seeing that we matched on neo-soul and Khruangbin. What have you been listening to lately?",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            attachment: {
              kind: "track",
              name: "Texas Sun",
              artist: "Khruangbin & Leon Bridges",
            },
          },
        ];
        dmCache.set(threadId, cached);
      } else if (friendId === "user-maya") {
        cached = [
          {
            id: `seed-dm-${Date.now()}-2`,
            threadId,
            senderId: "user-maya",
            senderName: "Maya Chen",
            senderUsername: "mayasound",
            senderAvatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces",
            recipientId: uid,
            text: "Hi! Glad we connected. Radiohead fan here — have you checked out your Sound Capsule for this month?",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ];
        dmCache.set(threadId, cached);
      } else {
        cached = [];
      }
    }

    return json({ messages: cached, threadId });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const friendId = String(body.friendId || "").trim();
    if (!friendId) throw new ApiError("Missing friendId.");

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text && !body.attachment) {
      throw new ApiError("Please enter a message or attach a track.");
    }
    if (text.length > 500) {
      throw new ApiError("Message too long (max 500 characters).");
    }

    const { uid } = await requireUser(request);
    await requireDirectMessageAccess(uid, friendId);
    let senderProfile: { displayName?: string; username?: string; photoURL?: string } | undefined;
    try {
      const { db } = admin();
      const pSnap = await db.doc(`users/${uid}`).get();
      if (pSnap.exists) senderProfile = pSnap.data() as {
        displayName?: string;
        username?: string;
        photoURL?: string;
      };
    } catch {}

    const threadId = getThreadId(uid, friendId);
    const senderName =
      senderProfile?.displayName || String(body.senderName || "Music Lover").trim().slice(0, 40);
    const senderUsername =
      senderProfile?.username || String(body.senderUsername || "listener").trim().toLowerCase().slice(0, 24);
    const senderAvatarUrl = senderProfile?.photoURL || String(body.senderAvatarUrl || "");

    const newMsg: DirectChatMessage = {
      id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      threadId,
      senderId: uid,
      senderName: senderName || "Music Lover",
      senderUsername: senderUsername || "listener",
      senderAvatarUrl,
      recipientId: friendId,
      text,
      createdAt: new Date().toISOString(),
      ...(body.attachment ? { attachment: body.attachment as DirectChatMessage["attachment"] } : {}),
    };

    // Store in memory
    const existing = dmCache.get(threadId) || [];
    existing.push(newMsg);
    dmCache.set(threadId, existing);

    // Persist to Firestore
    try {
      const { db } = admin();
      await db
        .collection("direct_messages")
        .doc(threadId)
        .collection("messages")
        .doc(newMsg.id)
        .set(newMsg);

      await db
        .collection("direct_messages")
        .doc(threadId)
        .set(
          {
            threadId,
            participantIds: [uid, friendId],
            lastMessage:
              text ||
              (body.attachment && typeof body.attachment === "object" && "name" in body.attachment
                ? `Shared a track: ${(body.attachment as { name: string }).name}`
                : "Shared an attachment"),
            lastMessageAt: newMsg.createdAt,
            lastSenderId: uid,
          },
          { merge: true }
        );
    } catch (err) {
      console.error("Failed to write DM to Firestore:", err);
    }

    // If friend is a mock demo friend (e.g. Sam or Maya), simulate an automated music reply
    if (friendId.startsWith("user-")) {
      setTimeout(async () => {
        try {
          const replies: Record<string, string> = {
            "user-sam":
              "Awesome! Adding that to my queue right now. Keep the recommendations coming 🎶",
            "user-maya":
              "Love this track! Always down to discover more music with you.",
          };
          const replyText = replies[friendId] || "Thanks for sharing! Listening to it right now.";
          const replyMsg: DirectChatMessage = {
            id: `dm-reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            threadId,
            senderId: friendId,
            senderName: friendId === "user-sam" ? "Sam Takahashi" : "Maya Chen",
            senderUsername: friendId === "user-sam" ? "samtune" : "mayasound",
            senderAvatarUrl:
              friendId === "user-sam"
                ? "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=faces"
                : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces",
            recipientId: uid,
            text: replyText,
            createdAt: new Date().toISOString(),
          };
          const cur = dmCache.get(threadId) || [];
          cur.push(replyMsg);
          dmCache.set(threadId, cur);

          try {
            const { db } = admin();
            await db
              .collection("direct_messages")
              .doc(threadId)
              .collection("messages")
              .doc(replyMsg.id)
              .set(replyMsg);
          } catch {}
        } catch {}
      }, 1200);
    }

    return json({ message: newMsg, ok: true });
  } catch (error) {
    return failure(error);
  }
}
