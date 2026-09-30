import { cookies } from "next/headers";
import { admin } from "@/lib/server";
import { lastfm } from "@/lib/lastfm";
import { lastfmOrigin, validLastfmToken } from "@/lib/lastfm-auth";

export async function GET(request: Request) {
  let origin: string;
  try { origin = lastfmOrigin(request.url, process.env.APP_URL, process.env.NODE_ENV === "development"); }
  catch { return new Response("Open the app at the configured APP_URL and reconnect Last.fm.", { status: 400 }); }
  const destination = new URL("/", origin), jar = await cookies();
  let failureReason = "invalid-request";
  try {
    const url = new URL(request.url), state = url.searchParams.get("state"), token = url.searchParams.get("token");
    if (!state || !/^[a-f0-9]{64}$/.test(state) || state !== jar.get("lastfm_state")?.value || !validLastfmToken(token)) throw new Error("Invalid callback");
    const { db } = admin(), pending = db.doc(`lastfmPending/${state}`);
    failureReason = "expired";
    const uid = await db.runTransaction(async tx => {
      const doc = await tx.get(pending), data = doc.data();
      if (!data || data.expiresAt < Date.now() || (data.origin && data.origin !== origin)) throw new Error("Expired callback");
      tx.delete(pending); return data.uid as string;
    });
    failureReason = "provider-error";
    const data = await lastfm("auth.getSession", { token }, true);
    const session = data.session as { name?: string } | undefined;
    if (!session?.name) throw new Error("No Last.fm user");
    // Only public read methods are used. Discard the session key immediately.
    const now = new Date().toISOString();
    failureReason = "save-error";
    const batch = db.batch();
    batch.set(db.doc(`connections/${uid}`), { username: session.name, connectedAt: now });
    batch.set(db.doc(`music/${uid}`), { lastfm: { username: session.name, connectedAt: now, snapshot: null } }, { merge: true });
    await batch.commit();
    // Return immediately; the app syncs in the background without blocking onboarding.
    destination.searchParams.set("lastfm", "connected");
  } catch {
    console.warn("Last.fm callback failed:", failureReason); // Never log tokens or callback URLs.
    destination.searchParams.set("lastfm", failureReason);
  }
  jar.set("lastfm_state", "", { maxAge: 0, path: "/api/lastfm", httpOnly: true, sameSite: "lax" });
  return Response.redirect(destination, 303);
}
