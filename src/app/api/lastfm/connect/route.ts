import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { admin, ApiError, failure, json, requireUser, throttle } from "@/lib/server";
import { lastfmConfig } from "@/lib/lastfm";
import { lastfmOrigin } from "@/lib/lastfm-auth";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request), { key } = lastfmConfig();
    let origin: string;
    try {
      origin = lastfmOrigin(request.url, process.env.APP_URL, process.env.NODE_ENV === "development");
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Invalid APP_URL.", 400);
    }
    const userDoc = await admin().db.doc(`users/${user.uid}`).get();
    if (!userDoc.exists) {
      const fallbackUsername = `user_${user.uid.slice(0, 8).toLowerCase()}`;
      const now = new Date().toISOString();
      const defaultProfile = {
        uid: user.uid,
        username: fallbackUsername,
        displayName: (user as { name?: string }).name || "Music Listener",
        bio: "",
        photoURL: typeof (user as { picture?: string }).picture === "string" ? (user as { picture?: string }).picture : "",
        avatar: "google",
        onboardingStep: 1,
        createdAt: now,
        updatedAt: now,
      };
      await admin().db.runTransaction(async tx => {
        const reservation = admin().db.doc(`usernames/${fallbackUsername}`);
        const resSnap = await tx.get(reservation);
        if (!resSnap.exists || resSnap.data()?.uid === user.uid) {
          tx.set(reservation, { uid: user.uid });
        }
        tx.set(admin().db.doc(`users/${user.uid}`), defaultProfile);
      });
    }
    const state = randomBytes(32).toString("hex");
    await admin().db.doc(`lastfmPending/${state}`).set({ uid: user.uid, origin, expiresAt: Date.now() + 600000 });
    (await cookies()).set("lastfm_state", state, { httpOnly: true, secure: new URL(origin).protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/lastfm" });
    const callback = new URL("/api/lastfm/callback", origin); callback.searchParams.set("state", state);
    return json({ url: "https://www.last.fm/api/auth/?" + new URLSearchParams({ api_key: key, cb: callback.toString() }) });
  } catch (error) { return failure(error); }
}
