import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import { validateImport, validateItems } from "@/lib/music";

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request), body = await readBody(request), { db } = admin();
    const userDoc = await db.doc(`users/${user.uid}`).get();
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
      await db.runTransaction(async tx => {
        const reservation = db.doc(`usernames/${fallbackUsername}`);
        const resSnap = await tx.get(reservation);
        if (!resSnap.exists || resSnap.data()?.uid === user.uid) {
          tx.set(reservation, { uid: user.uid });
        }
        tx.set(db.doc(`users/${user.uid}`), defaultProfile);
      });
    }
    let update;
    try {
      if (body.source === "favorites") update = { favorites: validateItems(body.items) };
      else if (body.source === "spotify") update = { spotify: body.snapshot === null ? null : validateImport(body.snapshot) };
      else throw new Error("Unknown music source.");
    } catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid music data."); }
    await db.doc(`music/${user.uid}`).set(update, { merge: true });
    return json(update);
  } catch (error) { return failure(error); }
}
