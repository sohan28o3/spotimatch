import type { MusicData, MusicItem, TasteMatch } from "@/types";
import { buildTasteVector, calculateTasteMatch, formatGenreTitle } from "@/lib/music-matching";

export const DAILY_MATCH_LIMIT = 5;
export const MIN_MATCH_SCORE = 70;

function itemKey(item: MusicItem): string {
  return `${item.name.toLowerCase().trim()}:::${(item.artist || "").toLowerCase().trim()}`;
}

function connected(music: Partial<MusicData> | null | undefined): boolean {
  return Boolean(music?.spotify || music?.lastfm);
}

export function explainMatch(
  callerMusic: Partial<MusicData>,
  candidateMusic: Partial<MusicData>,
  sharedArtists: string[]
): Pick<TasteMatch, "matchReason" | "matchDetail" | "matchSection"> {
  const callerNow = callerMusic.lastfm?.nowPlaying;
  const candidateNow = candidateMusic.lastfm?.nowPlaying;
  if (callerNow && candidateNow && itemKey(callerNow) === itemKey(candidateNow)) {
    return {
      matchReason: "Same current obsession",
      matchDetail: `You are both listening to “${callerNow.name}” by ${callerNow.artist}.`,
      matchSection: "current",
    };
  }

  const callerTracks = new Map<string, MusicItem>();
  const collectTracks = (music: Partial<MusicData>, target?: Map<string, MusicItem>) => {
    const result = target || new Map<string, MusicItem>();
    for (const item of [
      ...(music.lastfm?.recentTracks || []),
      ...(music.spotify?.items || []).filter(entry => entry.kind === "track"),
    ]) result.set(itemKey(item), item);
    return result;
  };
  collectTracks(callerMusic, callerTracks);
  const sharedTrack = Array.from(collectTracks(candidateMusic).entries()).find(([key]) => callerTracks.has(key))?.[1];
  if (sharedTrack) {
    return {
      matchReason: "You love the same song",
      matchDetail: `You both listen to “${sharedTrack.name}” by ${sharedTrack.artist}.`,
      matchSection: "current",
    };
  }

  if (sharedArtists.length >= 2) {
    return {
      matchReason: `${sharedArtists.length} shared artists`,
      matchDetail: sharedArtists.slice(0, 3).join(" · "),
      matchSection: sharedArtists.length >= 3 ? "best" : "artist",
    };
  }
  if (sharedArtists.length === 1) {
    return {
      matchReason: `Both love ${sharedArtists[0]}`,
      matchDetail: "A strong artist overlap in your listening.",
      matchSection: "artist",
    };
  }

  const callerGenres = buildTasteVector(callerMusic).genreWeights;
  const candidateGenres = buildTasteVector(candidateMusic).genreWeights;
  const sharedGenre = Array.from(callerGenres.keys())
    .filter(genre => candidateGenres.has(genre))
    .sort((a, b) => (callerGenres.get(b) || 0) + (candidateGenres.get(b) || 0) - (callerGenres.get(a) || 0) - (candidateGenres.get(a) || 0))[0];
  if (sharedGenre) {
    const title = formatGenreTitle(sharedGenre);
    return { matchReason: `Both love ${title}`, matchDetail: `${title} is prominent in both of your listening histories.`, matchSection: "genre" };
  }

  return {
    matchReason: "Expand your sound",
    matchDetail: "A compatible listener with music outside your usual rotation.",
    matchSection: "expand",
  };
}

export function buildDiscoveryCandidate(args: {
  id: string;
  profile: Record<string, unknown>;
  callerMusic: Partial<MusicData>;
  candidateMusic: Partial<MusicData>;
}): TasteMatch | null {
  if (!connected(args.candidateMusic)) return null;
  const result = calculateTasteMatch(args.callerMusic, args.candidateMusic, {
    userBName: String(args.profile.displayName || args.profile.username || "Listener"),
    userBBio: String(args.profile.bio || ""),
  });
  if (result.matchScore < MIN_MATCH_SCORE) return null;
  const explanation = explainMatch(args.callerMusic, args.candidateMusic, result.sharedArtists);
  return {
    id: args.id,
    name: String(args.profile.displayName || args.profile.username || "Listener"),
    username: String(args.profile.username || "listener"),
    avatarUrl: String(args.profile.photoURL || ""),
    bio: String(args.profile.bio || ""),
    vibe: result.vibe,
    matchScore: result.matchScore,
    sharedArtists: result.sharedArtists,
    topTrack: result.topTrack,
    topTrackArtist: result.topTrackArtist,
    city: "SpotiMatch",
    status: "none",
    ...explanation,
  };
}
