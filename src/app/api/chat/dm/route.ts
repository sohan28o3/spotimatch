import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import type { DirectChatMessage } from "@/types";
import { logUserActivity } from "@/lib/activity-log";

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

    const cached = dmCache.get(threadId) || [];

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

    await logUserActivity({ kind: "direct_message_sent", actorId: uid, targetId: friendId, resourceId: threadId, summary: text ? text.slice(0, 120) : "Shared a music attachment" });

    return json({ message: newMsg, ok: true });
  } catch (error) {
    return failure(error);
  }
}
