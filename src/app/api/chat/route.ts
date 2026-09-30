import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import type { ChatMessage } from "@/types";

export const dynamic = "force-dynamic";

// Initial seed messages in the global lounge to make the chat immediately active and welcoming
const seedMessages: ChatMessage[] = [
  {
    id: "msg-seed-1",
    userId: "user-maya",
    name: "Maya Chen",
    username: "mayasound",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces",
    text: "Welcome to the global lounge! Has anyone checked out their Sound Capsule for this month yet? My top artist was Radiohead again 🎧",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    attachment: {
      kind: "track",
      name: "Weird Fishes / Arpeggi",
      artist: "Radiohead",
    },
  },
  {
    id: "msg-seed-2",
    userId: "user-sam",
    name: "Sam Takahashi",
    username: "samtune",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=faces",
    text: "Texas Sun by Khruangbin & Leon Bridges is the ultimate sunset track. Who else is into neo-psychedelia?",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    attachment: {
      kind: "track",
      name: "Texas Sun",
      artist: "Khruangbin & Leon Bridges",
    },
  },
  {
    id: "msg-seed-3",
    userId: "user-leo",
    name: "Leo Rivera",
    username: "leovibes",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces",
    text: "Just imported my Spotify history and matched 91% with people here. Loving this app! Drop your favorite track recommendation below 👇",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    attachment: {
      kind: "track",
      name: "I Like Me Better",
      artist: "Lauv",
    },
  },
  {
    id: "msg-seed-4",
    userId: "user-chloe",
    name: "Chloe Martin",
    username: "chloelofi",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=300&fit=crop&crop=faces",
    text: "Alvvays live shows are unmatched. If you haven't heard Archie Marry Me on good headphones you're missing out ✨",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    attachment: {
      kind: "track",
      name: "Archie, Marry Me",
      artist: "Alvvays",
    },
  },
];

// In-memory fallback / live cache
const liveMessages: ChatMessage[] = [...seedMessages];

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
  // Dynamic count: base of 15-18 active community lounge listeners + real live active tabs
  const base = 15;
  return base + activePresence.size;
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const url = new URL(request.url);
    const clientId = url.searchParams.get("cid") || currentUser.uid;
    pingPresence(clientId);

    try {
      const { db } = admin();
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

    const name = String(body.name || currentUser?.displayName || "Music Fan").trim().slice(0, 40);
    const username = String(body.username || "listener").trim().toLowerCase().replace(/^@/, "").slice(0, 24);
    const avatarUrl = String(body.avatarUrl || currentUser?.photoURL || "");

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
      const { db } = admin();
      await db.collection("chat_messages").doc(newMsg.id).set(newMsg);
    } catch {
      // Memory persistence active
    }

    return json({ message: newMsg, ok: true, onlineCount: getOnlineCount() });
  } catch (error) {
    return failure(error);
  }
}
