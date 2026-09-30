import { admin, ApiError, failure, json, readBody, requireUser } from "@/lib/server";
import type { FriendRequest, FriendUser, TasteMatch } from "@/types";
import {
  buildTasteVector,
  calculateTasteMatch,
} from "@/lib/music-matching";

export const dynamic = "force-dynamic";

interface SocialDoc {
  friends: FriendUser[];
  incomingRequests: FriendRequest[];
  outgoingRequests: string[];
  blockedUsers?: TasteMatch[];
  blockedUserIds?: string[];
}

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { db } = admin();
    const docRef = db.doc(`social/${uid}`);
    const [snap, callerMusicSnap] = await Promise.all([
      docRef.get(),
      db.doc(`music/${uid}`).get(),
    ]);

    let social: SocialDoc;
    if (!snap.exists) {
      social = {
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
        blockedUsers: [],
        blockedUserIds: [],
      };
      await docRef.set(social);
    } else {
      social = snap.data() as SocialDoc;
      if (!social.friends) social.friends = [];
      if (!social.incomingRequests) social.incomingRequests = [];
      if (!social.outgoingRequests) social.outgoingRequests = [];
      if (!social.blockedUsers) social.blockedUsers = [];
      if (!social.blockedUserIds) social.blockedUserIds = [];
    }

    const callerMusic = callerMusicSnap.exists ? callerMusicSnap.data() : null;
    const callerTaste = buildTasteVector(callerMusic);

    // Determine current status for all candidates
    const friendIds = new Set(social.friends.map(f => f.id));
    const incomingSenderIds = new Set(social.incomingRequests.map(r => r.fromUserId));
    const outgoingIds = new Set(social.outgoingRequests || []);

    // Load real users from users collection and batch fetch their music data
    const realCandidates: TasteMatch[] = [];
    try {
      const usersSnap = await db.collection("users").limit(40).get();
      const validCandidateDocs = usersSnap.docs.filter(uDoc => uDoc.id !== uid && uDoc.data()?.username);

      const candidateMusicRefs = validCandidateDocs.map(uDoc => db.doc(`music/${uDoc.id}`));
      const candidateMusicSnaps = candidateMusicRefs.length > 0 ? await db.getAll(...candidateMusicRefs) : [];
      const musicMap = new Map<string, any>();
      for (let i = 0; i < validCandidateDocs.length; i++) {
        const cSnap = candidateMusicSnaps[i];
        if (cSnap && cSnap.exists) {
          musicMap.set(validCandidateDocs[i].id, cSnap.data());
        }
      }

      for (const uDoc of validCandidateDocs) {
        const p = uDoc.data();
        const candMusic = musicMap.get(uDoc.id);
        const matchResult = calculateTasteMatch(callerTaste, candMusic, {
          userBName: p.displayName || p.username,
          userBBio: p.bio,
          userBTopTrackFallback: "Discovering Sound",
        });

        // If no direct shared artists, display candidate's own top artists if available
        let displayArtists = matchResult.sharedArtists;
        if (displayArtists.length === 0 && candMusic?.favorites) {
          displayArtists = candMusic.favorites
            .filter((f: any) => f.kind === "artist" || f.artist)
            .map((f: any) => (f.kind === "artist" ? f.name : f.artist))
            .slice(0, 3);
        }

        realCandidates.push({
          id: uDoc.id,
          name: p.displayName || p.username,
          username: p.username,
          matchScore: matchResult.matchScore,
          avatarUrl: p.photoURL || "",
          vibe: matchResult.vibe || p.bio || "Active Spotimatch listener",
          sharedArtists: displayArtists,
          topTrack: matchResult.topTrack || "Shared Taste",
          topTrackArtist: matchResult.topTrackArtist,
          city: "Spotimatch",
          status: "none",
          bio: p.bio || "",
        });
      }
    } catch (err) {
      console.error("Failed to load real candidates with music:", err);
    }

    const allCandidates = realCandidates;

    // Sort by matchScore descending so users with the highest compatibility appear first
    allCandidates.sort((a, b) => b.matchScore - a.matchScore);

    const blockedIds = new Set(social.blockedUserIds || []);
    const rawFriends = social.friends.filter(f => !blockedIds.has(f.id));

    // Enrich friends with recent music and opt-in settings
    const activeFriends: FriendUser[] = [];
    for (const f of rawFriends) {
      try {
        const [fUserSnap, fMusicSnap] = await Promise.all([
          db.doc(`users/${f.id}`).get(),
          db.doc(`music/${f.id}`).get(),
        ]);
        if (!fUserSnap.exists) continue;
        const fUser = fUserSnap.data();
        const fMusic = fMusicSnap.exists ? fMusicSnap.data() : null;
        
        const showTopSongs = fUser?.showTopSongs ?? (fUser?.showRecentToFriends ? "friends" : "none");
        const showTopArtists = fUser?.showTopArtists ?? (fUser?.showRecentToFriends ? "friends" : "none");
        const showNowPlaying = fUser?.showNowPlaying ?? (fUser?.showRecentToFriends ? "friends" : "none");

        // Helper to dedupe tracks/artists
        const dedupe = (arrays: (any[] | undefined)[], kind: "track" | "artist") => {
          const seen = new Set<string>();
          const result: any[] = [];
          for (const arr of arrays) {
            if (!arr) continue;
            for (const item of arr) {
              if (item.kind !== kind) continue;
              const key = kind === "track" 
                ? `${item.name.toLowerCase()}:::${(item.artist || "").toLowerCase()}` 
                : item.name.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                result.push(item);
              }
            }
          }
          return result;
        };

        activeFriends.push({
            ...f,
            avatarUrl: fUser?.photoURL || f.avatarUrl,
          showTopSongs,
          showTopArtists,
          showNowPlaying,
          nowPlaying: fMusic?.lastfm?.nowPlaying || null,
          topSongs: dedupe([
            fMusic?.lastfm?.recentTracks,
            (Object.values(fMusic?.spotify?.monthlyCapsules || {}).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey))[0] as any)?.top5Songs || fMusic?.spotify?.items?.filter((i: any) => i.kind === "track")?.slice(0, 50),
            fMusic?.favorites?.filter((i: any) => i.kind === "track")
          ], "track").sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0)).slice(0, 5),
          topArtists: dedupe([
            fMusic?.lastfm?.recentArtists,
            (Object.values(fMusic?.spotify?.monthlyCapsules || {}).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey))[0] as any)?.top5Artists || fMusic?.spotify?.items?.filter((i: any) => i.kind === "artist")?.slice(0, 50),
            fMusic?.favorites?.filter((i: any) => i.kind === "artist")
          ], "artist").sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0)).slice(0, 5),
        });

      } catch {
        activeFriends.push(f);
      }
    }

    const activeIncoming = social.incomingRequests.filter(r => !blockedIds.has(r.fromUserId));

    const matches = allCandidates
      .filter(candidate => !blockedIds.has(candidate.id))
      .map(candidate => {
        let status: TasteMatch["status"] = "none";
        if (friendIds.has(candidate.id)) status = "friends";
        else if (incomingSenderIds.has(candidate.id)) status = "pending_received";
        else if (outgoingIds.has(candidate.id)) status = "pending_sent";
        return { ...candidate, status };
      });

    return json({
      friends: activeFriends,
      incomingRequests: activeIncoming,
      outgoingRequests: social.outgoingRequests,
      matches,
      blockedUsers: social.blockedUsers || [],
      blockedUserIds: social.blockedUserIds || [],
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const action = String(body.action || "");
    const { uid } = await requireUser(request);

    const { db } = admin();
    const docRef = db.doc(`social/${uid}`);
    const snap = await docRef.get();
    const social: SocialDoc = (snap.data() as SocialDoc) || {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };
    if (!social.friends) social.friends = [];
    if (!social.incomingRequests) social.incomingRequests = [];
    if (!social.outgoingRequests) social.outgoingRequests = [];

    if (action === "send_request") {
      const flags = (await db.doc("featureToggles/flags").get()).data() || {};
      if (flags.friendRequests === false) throw new ApiError("Friend requests are temporarily unavailable.", 503);
      let targetId = String(body.targetId || "").trim();
      if (!targetId && body.targetUsername) {
        targetId = String(body.targetUsername).trim();
      }
      if (!targetId) throw new ApiError("Missing target user ID or username.");
      const requestMessage = String(body.message || "").trim();
      if (requestMessage.length > 180) throw new ApiError("Request messages must be 180 characters or fewer.");
      const matchReason = String(body.matchReason || "").trim().slice(0, 180);

      // Resolve username to actual Firebase UID if targetId is not a real user UID
      if (!targetId.startsWith("user-")) {
        const directDoc = await db.doc(`users/${targetId}`).get();
        if (!directDoc.exists) {
          const cleanUsername = String(body.targetUsername || targetId || "")
            .toLowerCase()
            .trim()
            .replace(/^@/, "");
          const usernameDoc = await db.doc(`usernames/${cleanUsername}`).get();
          if (usernameDoc.exists && usernameDoc.data()?.uid) {
            targetId = usernameDoc.data()!.uid;
          }
        }
      }

      if (!social.outgoingRequests.includes(targetId)) {
        social.outgoingRequests.push(targetId);
      }

      // If target is another real user, write to their incomingRequests
      if (targetId !== uid && !targetId.startsWith("user-")) {
        try {
          const targetRef = db.doc(`social/${targetId}`);
          const targetSnap = await targetRef.get();
          const targetSocial: SocialDoc = (targetSnap.data() as SocialDoc) || {
            friends: [],
            incomingRequests: [],
            outgoingRequests: [],
          };
          if (!targetSocial.friends) targetSocial.friends = [];
          if (!targetSocial.incomingRequests) targetSocial.incomingRequests = [];
          if (!targetSocial.outgoingRequests) targetSocial.outgoingRequests = [];

          // Query sender profile from users/
          const senderProfileSnap = await db.doc(`users/${uid}`).get();
          const senderProfile = senderProfileSnap.data();

          const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          let matchScore = Number(body.matchScore) || 0;
          let sharedArtists = Array.isArray(body.sharedArtists) ? body.sharedArtists : [];
          let vibe = String(body.vibe || "");

          if (!matchScore || sharedArtists.length === 0) {
            try {
              const [senderMusicSnap, targetMusicSnap] = await Promise.all([
                db.doc(`music/${uid}`).get(),
                db.doc(`music/${targetId}`).get(),
              ]);
              const dynamicMatch = calculateTasteMatch(
                senderMusicSnap.exists ? senderMusicSnap.data() : null,
                targetMusicSnap.exists ? targetMusicSnap.data() : null
              );
              if (!matchScore) matchScore = dynamicMatch.matchScore;
              if (sharedArtists.length === 0) sharedArtists = dynamicMatch.sharedArtists;
              if (!vibe) vibe = dynamicMatch.vibe;
            } catch {}
          }

          if (!matchScore) matchScore = 92;
          if (!vibe) vibe = senderProfile?.bio || "Connecting through music taste";

          const newIncoming: FriendRequest = {
            id: reqId,
            fromUserId: uid,
            fromName: senderProfile?.displayName || String(body.senderName || "Music Friend"),
            fromUsername: senderProfile?.username || String(body.senderUsername || "listener"),
            fromAvatarUrl: senderProfile?.photoURL || String(body.senderAvatarUrl || ""),
            toUserId: targetId,
            createdAt: new Date().toISOString(),
            matchScore,
            vibe,
            sharedArtists,
            ...(requestMessage ? { message: requestMessage } : {}),
            ...(matchReason ? { matchReason } : {}),
          };

          // Filter out existing request from this user and add fresh request
          targetSocial.incomingRequests = targetSocial.incomingRequests.filter(r => r.fromUserId !== uid);
          targetSocial.incomingRequests.unshift(newIncoming);
          await targetRef.set(targetSocial);
        } catch (err) {
          console.error("Failed to write incoming friend request to target:", err);
        }
      }
    } else if (action === "accept_request") {
      const requestId = String(body.requestId || "").trim();
      const fromUserId = String(body.fromUserId || "").trim();

      const reqIdx = social.incomingRequests.findIndex(
        r => r.id === requestId || (fromUserId && r.fromUserId === fromUserId)
      );

      let acceptedReq: FriendRequest | null = null;
      if (reqIdx !== -1) {
        acceptedReq = social.incomingRequests[reqIdx];
        social.incomingRequests.splice(reqIdx, 1);
      }

      const friendUid = fromUserId || acceptedReq?.fromUserId || "";
      if (friendUid && !social.friends.some(f => f.id === friendUid)) {
        // Query sender profile
        let friendName = acceptedReq?.fromName || "Music Friend";
        let friendUsername = acceptedReq?.fromUsername || "listener";
        let friendAvatar = acceptedReq?.fromAvatarUrl || "";
        let friendVibe = acceptedReq?.vibe || "Connected via Spotimatch";

        if (!friendUid.startsWith("user-")) {
          try {
            const fSnap = await db.doc(`users/${friendUid}`).get();
            if (fSnap.exists) {
              const data = fSnap.data();
              if (data?.displayName) friendName = data.displayName;
              if (data?.username) friendUsername = data.username;
              if (data?.photoURL) friendAvatar = data.photoURL;
              if (data?.bio) friendVibe = data.bio;
            }
          } catch {}
        }

        social.friends.unshift({
          id: friendUid,
          name: friendName,
          username: friendUsername,
          avatarUrl: friendAvatar,
          matchScore: acceptedReq?.matchScore || 94,
          vibe: friendVibe,
          topTrack: "Shared Favorites",
          connectedAt: new Date().toISOString(),
          status: "friends",
        });
      }

      // Reciprocate friend on requester's social doc
      if (friendUid && !friendUid.startsWith("user-")) {
        try {
          const requesterRef = db.doc(`social/${friendUid}`);
          const requesterSnap = await requesterRef.get();
          const requesterSocial = (requesterSnap.data() as SocialDoc) || {
            friends: [],
            incomingRequests: [],
            outgoingRequests: [],
          };
          if (!requesterSocial.friends) requesterSocial.friends = [];
          if (!requesterSocial.incomingRequests) requesterSocial.incomingRequests = [];
          if (!requesterSocial.outgoingRequests) requesterSocial.outgoingRequests = [];

          requesterSocial.outgoingRequests = requesterSocial.outgoingRequests.filter(id => id !== uid);

          const myProfileSnap = await db.doc(`users/${uid}`).get();
          const myProfile = myProfileSnap.data();

          if (!requesterSocial.friends.some(f => f.id === uid)) {
            requesterSocial.friends.unshift({
              id: uid,
              name: myProfile?.displayName || "Music Friend",
              username: myProfile?.username || "listener",
              avatarUrl: myProfile?.photoURL || "",
              matchScore: acceptedReq?.matchScore || 94,
              vibe: myProfile?.bio || "Connected via Spotimatch",
              topTrack: "Shared Favorites",
              connectedAt: new Date().toISOString(),
              status: "friends",
            });
          }
          await requesterRef.set(requesterSocial);
        } catch (err) {
          console.error("Failed to reciprocate friend acceptance:", err);
        }
      }
    } else if (action === "decline_request") {
      const requestId = String(body.requestId || "").trim();
      const fromUserId = String(body.fromUserId || "").trim();
      social.incomingRequests = social.incomingRequests.filter(
        r => r.id !== requestId && (!fromUserId || r.fromUserId !== fromUserId)
      );

      // Clean up target's outgoing request
      if (fromUserId && !fromUserId.startsWith("user-")) {
        try {
          const senderRef = db.doc(`social/${fromUserId}`);
          const senderSnap = await senderRef.get();
          if (senderSnap.exists) {
            const senderSocial = senderSnap.data() as SocialDoc;
            senderSocial.outgoingRequests = (senderSocial.outgoingRequests || []).filter(id => id !== uid);
            await senderRef.set(senderSocial);
          }
        } catch {}
      }
    } else if (action === "cancel_request") {
      const targetId = String(body.targetId || "").trim();
      social.outgoingRequests = social.outgoingRequests.filter(id => id !== targetId);

      // Clean up target's incoming request
      if (targetId && !targetId.startsWith("user-")) {
        try {
          const targetRef = db.doc(`social/${targetId}`);
          const targetSnap = await targetRef.get();
          if (targetSnap.exists) {
            const targetSocial = targetSnap.data() as SocialDoc;
            targetSocial.incomingRequests = (targetSocial.incomingRequests || []).filter(r => r.fromUserId !== uid);
            await targetRef.set(targetSocial);
          }
        } catch {}
      }
    } else if (action === "remove_friend") {
      const friendId = String(body.friendId || "").trim();
      social.friends = social.friends.filter(f => f.id !== friendId);

      // Reciprocally remove from friend's social doc
      if (friendId && !friendId.startsWith("user-")) {
        try {
          const friendRef = db.doc(`social/${friendId}`);
          const friendSnap = await friendRef.get();
          if (friendSnap.exists) {
            const friendSocial = friendSnap.data() as SocialDoc;
            friendSocial.friends = (friendSocial.friends || []).filter(f => f.id !== uid);
            await friendRef.set(friendSocial);
          }
        } catch {}
      }
    } else if (action === "block_user") {
      const targetId = String(body.targetId || "").trim();
      if (!targetId) throw new ApiError("Missing targetId to block.");

      if (!social.blockedUserIds) social.blockedUserIds = [];
      if (!social.blockedUsers) social.blockedUsers = [];

      if (!social.blockedUserIds.includes(targetId)) {
        social.blockedUserIds.push(targetId);
        social.blockedUsers.push({
          id: targetId,
          name: String(body.targetName || "Listener"),
          username: String(body.targetUsername || "listener"),
          avatarUrl: String(body.targetAvatarUrl || ""),
          vibe: String(body.targetVibe || "Blocked"),
          matchScore: Number(body.matchScore) || 50,
          sharedArtists: [],
          topTrack: "Blocked Profile",
          city: "",
          isBlocked: true,
        });
      }

      social.friends = social.friends.filter(f => f.id !== targetId);
      social.incomingRequests = social.incomingRequests.filter(r => r.fromUserId !== targetId);
      social.outgoingRequests = social.outgoingRequests.filter(id => id !== targetId);

      if (targetId && !targetId.startsWith("user-")) {
        try {
          const targetRef = db.doc(`social/${targetId}`);
          const targetSnap = await targetRef.get();
          if (targetSnap.exists) {
            const targetSocial = targetSnap.data() as SocialDoc;
            targetSocial.friends = (targetSocial.friends || []).filter(f => f.id !== uid);
            targetSocial.incomingRequests = (targetSocial.incomingRequests || []).filter(r => r.fromUserId !== uid);
            targetSocial.outgoingRequests = (targetSocial.outgoingRequests || []).filter(id => id !== uid);
            await targetRef.set(targetSocial);
          }
        } catch {}
      }
    } else if (action === "unblock_user") {
      const targetId = String(body.targetId || "").trim();
      social.blockedUserIds = (social.blockedUserIds || []).filter(id => id !== targetId);
      social.blockedUsers = (social.blockedUsers || []).filter(u => u.id !== targetId);
    } else {
      throw new ApiError("Unknown action.");
    }

    await docRef.set(social);
    return json({
      ok: true,
      friends: social.friends,
      incomingRequests: social.incomingRequests,
      outgoingRequests: social.outgoingRequests,
      blockedUsers: social.blockedUsers || [],
      blockedUserIds: social.blockedUserIds || [],
    });
  } catch (error) {
    return failure(error);
  }
}

