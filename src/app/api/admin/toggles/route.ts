// src/app/api/admin/toggles/route.ts
import { admin, json, failure, readBody, requireAdmin, requireUser } from "@/lib/server";

export const dynamic = "force-dynamic";

const TOGGLES_DOC = "featureToggles/flags";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const { db } = admin();
    const snap = await db.doc(TOGGLES_DOC).get();
    const data = snap.data() || {};
    return json({
      friendRequests: data.friendRequests !== false,
      discovery: data.discovery !== false,
      globalChat: data.globalChat !== false,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readBody(request);
    const name: string = String(body.name);
    const value: boolean = Boolean(body.value);
    if (!["friendRequests", "discovery", "globalChat"].includes(name)) {
      throw new Error("Invalid toggle name");
    }
    const { db } = admin();
    await db.doc(TOGGLES_DOC).set({ [name]: value }, { merge: true });
    // Optionally audit the change
    // await db.collection("adminAudit").add({ adminUid: administrator.uid, action: "toggle", targetId: name, details: { value } });
    return json({ ok: true, [name]: value });
  } catch (error) {
    return failure(error);
  }
}
