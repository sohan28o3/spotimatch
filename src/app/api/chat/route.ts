import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import type { ChatMessage } from "@/types";

export const dynamic = "force-dynamic";

// In-memory fallback / live cache
const liveMessages: ChatMessage[] = [];

// Real-time active presence tracker (tracks active chat connections over a 25-second rolling window)
const activePresence = new Map<string, number>();

function pingPresence(clientId: string) {
  const now = Date.now();
  if (clientId) activePresence.set(clientId, now);
  for (const [id, ts] of activePresence.entries()) {
    if (now - ts > 25000) activePresence.delete(id);
  }
}

function getOnlineCount(): number {
  const now = Date.now();
  for (const [id, ts] of activePresence.entries()) {
    if (now - ts > 25000) activePresence.delete(id);
  }
  return activePresence.size;
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const { db } = admin();
    const flags = (await db.doc("featureToggles/flags").get()).data() || {};
    if (flags.globalChat === false) throw new ApiError("Global chat is temporarily unavailable.", 503);
    const url = new URL(request.url);
    const clientId = url.searchParams.get("cid") || currentUser.uid;
    pingPresence(clientId);

    try {
      const snap = await db.collection("chat_messages").orderBy("createdAt", "asc").limitToLast(60).get();
      if (!snap.empty) {
        const fromDb: ChatMessage[] = snap.docs.map(doc => doc.data() as ChatMessage);
        return json({ messages: fromDb, onlineCount: getOnlineCount() });
      }
    } catch {
      // In-memory fallback if Firestore table not yet created
    }

    return json({ messages: liveMessages, onlineCount: getOnlineCount() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const { db } = admin();
    const flags = (await db.doc("featureToggles/flags").get()).data() || {};
    if (flags.globalChat === false) throw new ApiError("Global chat is temporarily unavailable.", 503);

    const body = await readBody(request);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text && !body.attachment) {
      throw new ApiError("Please enter a message or attach a track.");
    }
    if (text.length > 500) {
      throw new ApiError("Message too long (max 500 characters).");
    }

    const resolvedUid = currentUser.uid;
    pingPresence(resolvedUid);

    const profile = (await db.doc(`users/${resolvedUid}`).get()).data();
    if (!profile?.username) throw new ApiError("Complete your profile before chatting.", 409);
    const name = String(profile.displayName || "Music Fan").trim().slice(0, 40);
    const username = String(profile.username).trim().toLowerCase().replace(/^@/, "").slice(0, 24);
    const avatarUrl = String(profile.photoURL || "");

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: resolvedUid,
      name: name || "Music Fan",
      username: username || "listener",
      avatarUrl,
      text,
      createdAt: new Date().toISOString(),
      ...(body.attachment ? { attachment: body.attachment as ChatMessage["attachment"] } : {}),
    };

    // Store in live cache
    liveMessages.push(newMsg);
    if (liveMessages.length > 100) liveMessages.shift();

    // Persist to Firestore if possible
    try {
      await db.collection("chat_messages").doc(newMsg.id).set(newMsg);
    } catch {
      // Memory persistence active
    }

    return json({ message: newMsg, ok: true, onlineCount: getOnlineCount() });
  } catch (error) {
    return failure(error);
  }
}
