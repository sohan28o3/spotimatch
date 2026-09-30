import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function admin() {
  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new ApiError("Firebase server setup is missing. Follow SETUP.md to enable account saving.", 503);
  }
  const app = getApps()[0] || initializeApp({ credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }) });
  return { auth: getAuth(app), db: getFirestore(app) };
}
export async function requireUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError("Sign in with Google to continue.", 401);
  const { auth } = admin();
  try {
    const user = await auth.verifyIdToken(token, true);
    if (user.firebase.sign_in_provider !== "google.com") throw new Error("Wrong provider");
    return user;
  } catch { throw new ApiError("Your session expired. Please sign in again.", 401); }
}

export const ADMIN_EMAIL = "sohanmutra28@gmail.com";

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  const email = String(user.email || "").toLowerCase();
  if (!user.email_verified || email !== ADMIN_EMAIL) {
    throw new ApiError("Administrator access required.", 403);
  }
  return user;
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 180000) throw new ApiError("This request is too large.", 413);
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new ApiError("Invalid request body."); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error("API operation failed:", error instanceof Error ? error.name : "unknown");
  return json({ error: "Something went wrong while saving or loading your account. Please try again." }, 500);
}
// A Firestore transaction makes limits apply across serverless instances.
export async function throttle(uid: string, action: string, limit: number, windowMs: number) {
  const { db } = admin(), now = Date.now();
  const ref = db.doc(`rateLimits/${uid}_${action}`);
  await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data();
    const active = old && now - old.start < windowMs;
    if (active && old.count >= limit) throw new ApiError("Please wait a little before trying again.", 429);
    tx.set(ref, { start: active ? old.start : now, count: active ? old.count + 1 : 1 });
  });
}
