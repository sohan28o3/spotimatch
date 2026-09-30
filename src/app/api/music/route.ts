import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import { validateImport, validateItems } from "@/lib/music";
import { notifyCompatibleListeners } from "@/lib/match-notifications";

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request), body = await readBody(request), { db } = admin();
    const userDoc = await db.doc(`users/${user.uid}`).get();
    if (!userDoc.exists) throw new ApiError("Create your profile before adding listening data.", 409);
    let update;
    try {
      if (body.source === "favorites") update = { favorites: validateItems(body.items) };
      else if (body.source === "spotify") update = { spotify: body.snapshot === null ? null : validateImport(body.snapshot) };
      else throw new Error("Unknown music source.");
    } catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid music data."); }
    await db.doc(`music/${user.uid}`).set(update, { merge: true });
    if (body.source === "spotify" && body.snapshot !== null) await notifyCompatibleListeners(user.uid);
    return json(update);
  } catch (error) { return failure(error); }
}
