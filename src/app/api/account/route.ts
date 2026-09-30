import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import { emptyMusic, type VisibilityLevel } from "@/types";

const VALID_VISIBILITY: VisibilityLevel[] = ["public", "friends", "none"];
function toVisibility(val: unknown, fallback: VisibilityLevel = "none"): VisibilityLevel {
  if (typeof val === "string" && VALID_VISIBILITY.includes(val as VisibilityLevel)) return val as VisibilityLevel;
  // Legacy boolean migration
  if (val === true) return "friends";
  if (val === false) return "none";
  return fallback;
}

export async function GET(request: Request) {
  try {
    const viewer = await requireUser(request);
    const url = new URL(request.url);
    const targetUid = url.searchParams.get("uid");
    const targetUsername = url.searchParams.get("username");

    const { db } = admin();

    // If query params are provided, return that user's public profile and taste
    if (targetUid || targetUsername) {
      let targetDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (targetUid) {
        targetDoc = await db.doc(`users/${targetUid}`).get();
      }
      if ((!targetDoc || !targetDoc.exists) && targetUsername) {
        const cleanName = targetUsername.toLowerCase().trim().replace(/^@/, "");
        const resDoc = await db.doc(`usernames/${cleanName}`).get();
        if (resDoc.exists && resDoc.data()?.uid) {
          targetDoc = await db.doc(`users/${resDoc.data()?.uid}`).get();
        }
      }

      if (targetDoc && targetDoc.exists) {
        const p = targetDoc.data();
        if (p) {
          const isSelf = viewer.uid === targetDoc.id;
          const [viewerSocial, targetSocial] = isSelf
            ? [null, null]
            : await Promise.all([
                db.doc(`social/${viewer.uid}`).get(),
                db.doc(`social/${targetDoc.id}`).get(),
              ]);
          const viewerFriends = (viewerSocial?.data()?.friends || []) as Array<{ id?: string }>;
          const viewerBlocks = new Set((viewerSocial?.data()?.blockedUserIds || []) as string[]);
          const targetBlocks = new Set((targetSocial?.data()?.blockedUserIds || []) as string[]);
          if (!isSelf && (viewerBlocks.has(targetDoc.id) || targetBlocks.has(viewer.uid))) {
            return json({ profile: null, music: emptyMusic() }, 404);
          }
          const isFriend = isSelf || viewerFriends.some(friend => friend.id === targetDoc?.id);
          const musicSnap = await db.doc(`music/${p.uid}`).get();
          const musicData = musicSnap.exists ? musicSnap.data() : emptyMusic();
          const showTopSongs = toVisibility(p.showTopSongs ?? p.showRecentToFriends);
          const showTopArtists = toVisibility(p.showTopArtists ?? p.showRecentToFriends);
          const showNowPlaying = toVisibility(p.showNowPlaying ?? p.showRecentToFriends);
          const canView = (visibility: VisibilityLevel) =>
            isSelf || visibility === "public" || (visibility === "friends" && isFriend);

          // Derive this month's top songs/artists
          const allTracks: any[] = [];
          const allArtists: any[] = [];
          if (musicData) {
            const seenSongs = new Set<string>();
            const seenArtists = new Set<string>();
            const addTrack = (track: any) => {
              if (track && track.name && !seenSongs.has(track.name.toLowerCase())) {
                seenSongs.add(track.name.toLowerCase());
                allTracks.push(track);
              }
            };
            const addArtist = (artist: any) => {
              if (artist && artist.name && !seenArtists.has(artist.name.toLowerCase())) {
                seenArtists.add(artist.name.toLowerCase());
                allArtists.push(artist);
              }
            };

            // 1. Monthly Capsules (highest priority for "This Month's" top 5)
            const monthlyCaps = (musicData.spotify as any)?.monthlyCapsules || (musicData as any).monthlyCapsules;
            if (monthlyCaps && typeof monthlyCaps === "object") {
              const months = Object.keys(monthlyCaps).sort().reverse();
              if (months.length > 0) {
                const latest = monthlyCaps[months[0]];
                if (latest?.top5Songs && Array.isArray(latest.top5Songs)) {
                  latest.top5Songs.forEach(addTrack);
                }
                if (latest?.top5Artists && Array.isArray(latest.top5Artists)) {
                  latest.top5Artists.forEach(addArtist);
                }
              }
            }

            // 2. Last.fm recent scrobbles (which are current/this month)
            if (musicData.lastfm) {
              if (Array.isArray(musicData.lastfm.recentTracks)) musicData.lastfm.recentTracks.forEach(addTrack);
              if (Array.isArray(musicData.lastfm.recentArtists)) musicData.lastfm.recentArtists.forEach(addArtist);
            }

            // 3. Fallbacks if user doesn't have monthly capsules or recent scrobbles yet
            if (allTracks.length === 0 && musicData.spotify?.items) {
              musicData.spotify.items.filter((i: any) => i.kind === "track").slice(0, 5).forEach(addTrack);
            }
            if (allArtists.length === 0 && musicData.spotify?.items) {
              musicData.spotify.items.filter((i: any) => i.kind === "artist").slice(0, 5).forEach(addArtist);
            }
            if (allTracks.length === 0 && musicData.favorites) {
              musicData.favorites.filter((i: any) => i.kind === "track").slice(0, 5).forEach(addTrack);
            }
            if (allArtists.length === 0 && musicData.favorites) {
              musicData.favorites.filter((i: any) => i.kind === "artist").slice(0, 5).forEach(addArtist);
            }
          }

          return json({
            profile: {
              uid: p.uid,
              username: p.username,
              displayName: p.displayName,
              bio: p.bio,
              photoURL: p.photoURL,
              avatar: p.avatar,
              createdAt: p.createdAt,
              showTopSongs,
              showTopArtists,
              showNowPlaying,
            },
            music: {
              favorites: [],
              spotify: null,
              lastfm:
                canView(showNowPlaying) && musicData?.lastfm
                  ? { nowPlaying: musicData.lastfm.nowPlaying || null }
                  : null,
              topSongs: canView(showTopSongs) ? allTracks.slice(0, 5) : [],
              topArtists: canView(showTopArtists) ? allArtists.slice(0, 5) : [],
              showTopSongs,
              showTopArtists,
              showNowPlaying,
            },
          });
        }
      }

      return json({ profile: null, music: emptyMusic() });
    }

    // Default: return current authenticated user's profile
    const [profile, music] = await Promise.all([db.doc(`users/${viewer.uid}`).get(), db.doc(`music/${viewer.uid}`).get()]);
    const pData = profile.data() || null;
    if (pData) {
      // Migrate legacy boolean fields
      if (!VALID_VISIBILITY.includes(pData.showTopSongs)) {
        pData.showTopSongs = toVisibility(pData.showRecentToFriends ?? pData.showRecentTracks);
      }
      if (!VALID_VISIBILITY.includes(pData.showTopArtists)) {
        pData.showTopArtists = toVisibility(pData.showRecentToFriends ?? pData.showRecentArtists);
      }
      if (!VALID_VISIBILITY.includes(pData.showNowPlaying)) {
        pData.showNowPlaying = toVisibility(pData.showRecentToFriends);
      }
    }
    return json({ profile: pData, music: { ...emptyMusic(), ...music.data() } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request), body = await readBody(request), { db } = admin();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@/, "") : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new ApiError("Use 3–24 letters, numbers or underscores for your username.");
    if (!displayName || displayName.length > 60 || bio.length > 240) throw new ApiError("Add a name (up to 60 characters) and a bio of up to 240 characters.");
    const step = typeof body.onboardingStep === "number" ? body.onboardingStep : 1;
    if (!Number.isInteger(step) || Number(step) < 1 || Number(step) > 4) throw new ApiError("Invalid onboarding step.");
    const profile = await db.runTransaction(async tx => {
      const ref = db.doc(`users/${user.uid}`), reservation = db.doc(`usernames/${username}`);
      const [old, reserved] = await Promise.all([tx.get(ref), tx.get(reservation)]);
      if (reserved.exists && reserved.data()?.uid !== user.uid) throw new ApiError("That username is already taken. Try another.", 409);
      const previous = old.data();
      const now = new Date().toISOString();
      const rawPhoto = typeof body.photoURL === "string" ? body.photoURL.trim() : "";
      if (rawPhoto.length > 150000) throw new ApiError("Profile photo data is too large.");
      const customPhoto = (rawPhoto.startsWith("data:image/") || rawPhoto.startsWith("https://") || rawPhoto.startsWith("http://")) ? rawPhoto : "";
      const avatar = body.avatar === "initials" ? "initials" : body.avatar === "google" ? "google" : (customPhoto || body.avatar === "custom") ? "custom" : (previous?.avatar || "google");
      const photoURL = avatar === "custom" && customPhoto ? customPhoto : (avatar === "google" && typeof user.picture === "string" ? user.picture : (customPhoto || previous?.photoURL || (typeof user.picture === "string" ? user.picture : "")));
      const saved = {
        uid: user.uid,
        username,
        displayName,
        bio,
        photoURL,
        avatar,
        onboardingStep: Math.max(previous?.onboardingStep || 1, Number(step)),
        showTopSongs: toVisibility(body.showTopSongs ?? previous?.showTopSongs),
        showTopArtists: toVisibility(body.showTopArtists ?? previous?.showTopArtists),
        showNowPlaying: toVisibility(body.showNowPlaying ?? previous?.showNowPlaying),
        globalChatNotifications: typeof body.globalChatNotifications === "boolean" ? body.globalChatNotifications : (previous?.globalChatNotifications ?? false),
        emailMatchNotifications: typeof body.emailMatchNotifications === "boolean" ? body.emailMatchNotifications : (previous?.emailMatchNotifications ?? false),
        mutedChatIds: Array.isArray(body.mutedChatIds) ? body.mutedChatIds : (previous?.mutedChatIds || []),
        blockedUserIds: Array.isArray(body.blockedUserIds) ? body.blockedUserIds : (previous?.blockedUserIds || []),
        createdAt: previous?.createdAt || now,
        updatedAt: now
      };
      if (previous?.username && previous.username !== username) tx.delete(db.doc(`usernames/${previous.username}`));
      tx.set(reservation, { uid: user.uid }); tx.set(ref, saved);
      return saved;
    });
    return json({ profile });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request), { db, auth } = admin();
    const userRef = db.doc(`users/${user.uid}`);
    const userDoc = await userRef.get();
    const username = userDoc.data()?.username;

    const batch = db.batch();
    batch.delete(userRef);
    batch.delete(db.doc(`music/${user.uid}`));
    batch.delete(db.doc(`connections/${user.uid}`));
    batch.delete(db.doc(`social/${user.uid}`));
    batch.delete(db.doc(`rateLimits/${user.uid}_sync`));
    if (typeof username === "string" && username.trim()) {
      batch.delete(db.doc(`usernames/${username.trim().toLowerCase()}`));
    }
    await batch.commit();

    try {
      await auth.deleteUser(user.uid);
    } catch {
      // If user is already removed from Auth or using custom token, continue
    }

    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readBody(request);
    const { db } = admin();
    const userRef = db.doc(`users/${user.uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new ApiError("User profile not found.", 404);
    const prev = userSnap.data() || {};
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.showTopSongs !== undefined) updates.showTopSongs = toVisibility(body.showTopSongs);
    if (body.showTopArtists !== undefined) updates.showTopArtists = toVisibility(body.showTopArtists);
    if (body.showNowPlaying !== undefined) updates.showNowPlaying = toVisibility(body.showNowPlaying);
    if (typeof body.globalChatNotifications === "boolean") updates.globalChatNotifications = body.globalChatNotifications;
    if (typeof body.emailMatchNotifications === "boolean") updates.emailMatchNotifications = body.emailMatchNotifications;
    if (Array.isArray(body.mutedChatIds)) updates.mutedChatIds = body.mutedChatIds;
    if (Array.isArray(body.blockedUserIds)) updates.blockedUserIds = body.blockedUserIds;
    if (typeof body.bio === "string" && body.bio.length <= 240) updates.bio = body.bio.trim();
    if (typeof body.displayName === "string" && body.displayName.trim() && body.displayName.length <= 60) updates.displayName = body.displayName.trim();
    if (typeof body.photoURL === "string" && body.photoURL.length <= 150000) updates.photoURL = body.photoURL.trim();
    const saved = { ...prev, ...updates };
    await userRef.set(saved);
    return json({ profile: saved });
  } catch (error) {
    return failure(error);
  }
}
