"use client";
import React, { useEffect, useState } from "react";
import {
  Search as SearchIcon,
  Users,
  Sparkles,
  Heart,
  Plus,
  Check,
  Disc3,
  Clock,
  Flame,
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Headphones,
  Music2,
  MessageSquare,
  UserPlus,
  UserCheck,
  UserX,
  ShieldAlert,
  MessageCircle,
} from "lucide-react";
import type {
  AccountData,
  FriendRequest,
  FriendUser,
  MonthlyCapsule,
  MusicItem,
  TasteMatch,
  UserProfile,
} from "@/types";
import { authenticatedFetch } from "@/lib/client-api";
import { useActivePolling } from "@/hooks/use-active-polling";
import { MusicArtwork, formatDate } from "@/components/onboarding";
import { UserCardContent, type UserProfileModalUser } from "@/components/UserProfileModal";
import {
  calculateTasteMatch,
  DEFAULT_CANDIDATE_MUSIC,
} from "@/lib/music-matching";
import { openSpotifyTrack, openSpotifyArtist } from "@/lib/spotify-redirect";

export type SpotifyTab =
  | "home"
  | "search"
  | "matches"
  | "capsule"
  | "chat"
  | "notifications"
  | "library"
  | "profile"
  | "admin";

export function dedupeItems(items: MusicItem[]): MusicItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.kind}:${item.name.trim().toLowerCase()}:${(item.artist || "").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const mockMatches: TasteMatch[] = [
  {
    id: "m-1",
    name: "Maya Chen",
    username: "mayasound",
    matchScore: 96,
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=faces",
    vibe: "Melancholic Art Rock & Dream Pop",
    sharedArtists: ["Radiohead", "Beach House", "Frank Ocean", "Tame Impala"],
    topTrack: "Weird Fishes / Arpeggi",
    city: "Brooklyn, NY",
    status: "none",
  },
  {
    id: "m-2",
    name: "Liam O'Connor",
    username: "liam_beats",
    matchScore: 91,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
    vibe: "Alternative Hip-Hop & Nu-Soul",
    sharedArtists: ["Kendrick Lamar", "Tyler, The Creator", "JID"],
    topTrack: "N95",
    city: "Chicago, IL",
    status: "none",
  },
  {
    id: "m-3",
    name: "Sofia Rossi",
    username: "sofia_r",
    matchScore: 87,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
    vibe: "Indie Pop & 90s Shoegaze",
    sharedArtists: ["Alvvays", "Slowdive", "The Japanese House"],
    topTrack: "Archie, Marry Me",
    city: "Austin, TX",
    status: "none",
  },
  {
    id: "m-4",
    name: "Devin Vance",
    username: "devinvibes",
    matchScore: 84,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
    vibe: "Psychedelic Rock & Neo-Soul",
    sharedArtists: ["Khruangbin", "Mac DeMarco", "Tame Impala"],
    topTrack: "Texas Sun",
    city: "Seattle, WA",
    status: "none",
  },
];

// --- Spotify Browse Categories ---
export const browseCategories = [
  { name: "Indie", color: "#1e3264", image: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¸" },
  { name: "Hip-Hop", color: "#ba5d07", image: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¤" },
  { name: "Rock", color: "#e91429", image: "ÃƒÂ¢Ã…Â¡Ã‚Â¡" },
  { name: "Dream Pop", color: "#8d67ab", image: "ÃƒÂ¢Ã…â€œÃ‚Â¨" },
  { name: "Electronic", color: "#503750", image: "ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬ÂºÃƒÂ¯Ã‚Â¸Ã‚Â" },
  { name: "Late Night", color: "#477d95", image: "ÃƒÂ°Ã…Â¸Ã…â€™Ã¢â€žÂ¢" },
  { name: "Chill", color: "#27856a", image: "ÃƒÂ¢Ã‹Å“Ã¢â‚¬Â¢" },
  { name: "Soul / R&B", color: "#d84000", image: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚·" },
  { name: "Focus & Ambient", color: "#509bf5", image: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â§" },
  { name: "90s Nostalgia", color: "#e1118c", image: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¼" },
  { name: "Sound Capsule", color: "#af2896", image: "ÃƒÂ¢Ã‚ÂÃ‚Â³" },
  { name: "Taste Matches", color: "#148a08", image: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¥" },
];

// =========================================================================
// SHARED HELPERS
// =========================================================================
const dedupeArrays = (arrays: (any[] | undefined)[], kind: "track" | "artist") => {
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

export const getCombinedTopSongs = (music: any) => {
  const latestCapsule = (Object.values(music?.spotify?.monthlyCapsules || {}).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey))[0] as any);
  const capsuleSongs: any[] = latestCapsule?.top5Songs || [];
  const lastfmRecent: any[] = music?.lastfm?.recentTracks || [];

  // Combine this month's capsule songs and recent scrobbles (keeping this month's rank)
  const combined = dedupeArrays([capsuleSongs, lastfmRecent], "track");
  if (combined.length > 0) return combined.slice(0, 5);

  // Fallback if no monthly capsule or recent tracks yet
  const fallback = dedupeArrays([
    music?.spotify?.items?.filter((i: any) => i.kind === "track")?.slice(0, 50),
    music?.favorites?.filter((i: any) => i.kind === "track")
  ], "track");
  return fallback.slice(0, 5);
};

export const getCombinedTopArtists = (music: any) => {
  const latestCapsule = (Object.values(music?.spotify?.monthlyCapsules || {}).sort((a: any, b: any) => b.monthKey.localeCompare(a.monthKey))[0] as any);
  const capsuleArtists: any[] = latestCapsule?.top5Artists || [];
  const lastfmRecent: any[] = music?.lastfm?.recentArtists || [];

  // Combine this month's capsule artists and recent scrobbles (keeping this month's rank)
  const combined = dedupeArrays([capsuleArtists, lastfmRecent], "artist");
  if (combined.length > 0) return combined.slice(0, 5);

  // Fallback if no monthly capsule or recent artists yet
  const fallback = dedupeArrays([
    music?.spotify?.items?.filter((i: any) => i.kind === "artist")?.slice(0, 50),
    music?.favorites?.filter((i: any) => i.kind === "artist")
  ], "artist");
  return fallback.slice(0, 5);
};

// =========================================================================
// 1. HOME VIEW
// =========================================================================
export function HomeView({
  account,
  onNavigate,
  onOpenSourceModal,
  onOpenUserProfile,
}: {
  account: AccountData;
  onNavigate: (tab: SpotifyTab) => void;
  onOpenSourceModal: (source: "favorites" | "lastfm" | "spotify") => void;
  onOpenUserProfile?: (user: UserProfileModalUser) => void;
}) {
  const profile = account.profile;
  const spotify = account.music.spotify;
  const lastfm = account.music.lastfm;
  const missingSources = Number(!lastfm) + Number(!spotify);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [genreStats, setGenreStats] = useState<{ genres: Array<{ genre: string; listeners: number }>; totalListeners: number } | null>(null);
  const [genresExpanded, setGenresExpanded] = useState(false);
  const [homeFriends, setHomeFriends] = useState<FriendUser[]>([]);
  const topSongs = getCombinedTopSongs(account.music).slice(0, 5);
  const topArtists = getCombinedTopArtists(account.music).slice(0, 5);
  const nowPlaying = lastfm?.nowPlaying || null;

  useEffect(() => {
    let active = true;
    authenticatedFetch("/api/stats/genres")
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (active && data && Array.isArray(data.genres)) setGenreStats(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    authenticatedFetch("/api/friends")
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (active && Array.isArray(data?.friends)) setHomeFriends(data.friends);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const cardUser: UserProfileModalUser = {
    uid: profile?.uid,
    name: profile?.displayName || "Music Lover",
    username: profile?.username || "listener",
    avatarUrl: profile?.photoURL,
    photoURL: profile?.photoURL,
    bio: profile?.bio,
    vibe: profile?.bio || "Eclectic soundscapes",
    matchScore: 100,
    topSongs,
    topArtists,
    nowPlaying,
    showTopSongs: profile?.showTopSongs,
    showTopArtists: profile?.showTopArtists,
    showNowPlaying: profile?.showNowPlaying,
  };

  const openProfileEditor = () => {
    if (!profile || !onOpenUserProfile) {
      onNavigate("profile");
      return;
    }

    onOpenUserProfile({
      uid: profile.uid,
      name: profile.displayName || "Music Lover",
      username: profile.username || "listener",
      avatarUrl: profile.photoURL || "",
      photoURL: profile.photoURL || "",
      bio: profile.bio || "",
      vibe: profile.bio || "Your music profile",
      matchScore: 100,
      showTopSongs: profile.showTopSongs,
      showTopArtists: profile.showTopArtists,
      showNowPlaying: profile.showNowPlaying,
      forceEditMode: true,
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6 px-4 pb-12 pt-5 md:px-8 md:pt-8">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)] lg:items-start">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-[#282828] bg-[#141414] text-white shadow-[0_16px_44px_rgba(0,0,0,0.38)]">
        <UserCardContent
          targetUser={cardUser}
          currentUser={profile}
          currentStatus="none"
          isMe={true}
          isBlocked={false}
          busy={false}
          score={100}
          vibe={cardUser.vibe || "Eclectic soundscapes"}
          hasShared={false}
          sharedList={[]}
          topTrackName={topSongs[0]?.name || "Shared Taste"}
          topTrackArtist={topSongs[0]?.artist || "SpotiMatch"}
          topSongs={topSongs}
          topArtists={topArtists}
          nowPlaying={nowPlaying}
          resolvedPhoto={profile?.photoURL || ""}
          avatarFailed={avatarFailed}
          setAvatarFailed={setAvatarFailed}
          onOpenEditProfile={openProfileEditor}
          isStandalonePage={true}
        />
      </section>

      <section className="rounded-3xl border border-[#282828] bg-[#141414] p-5 text-white shadow-[0_16px_44px_rgba(0,0,0,0.3)] lg:sticky lg:top-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1db954]">Across SpotiMatch</p>
            <h2 className="mt-1 text-xl font-black">Top genres</h2>
          </div>
          <div className="group relative">
            <button type="button" aria-label="About listener totals" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[#b3b3b3] hover:text-white">
              <HelpCircle size={15} />
            </button>
            <div className="pointer-events-none absolute right-0 top-9 z-20 hidden w-64 rounded-xl border border-white/10 bg-[#282828] p-3 text-xs leading-5 text-[#dedede] shadow-2xl group-hover:block group-focus-within:block">
              Includes only real users who connected Last.fm or imported Spotify listening history.
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {(genreStats?.genres || []).slice(0, 5).map((item, index) => (
            <div key={item.genre} className={`items-center gap-3 rounded-xl border border-white/5 bg-[#1b1b1b] px-3 py-3 ${index < 3 || genresExpanded ? "flex" : "hidden lg:flex"}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1db954]/15 text-xs font-black text-[#1ed760]">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.genre}</span>
              <span className="shrink-0 text-xs font-semibold text-[#b3b3b3]">{item.listeners} {item.listeners === 1 ? "person" : "people"}</span>
            </div>
          ))}
          {!genreStats && <div className="h-36 animate-pulse rounded-xl bg-[#1b1b1b]" />}
          {genreStats && genreStats.genres.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[#727272]">Genre totals will appear as listeners connect their history.</div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-[#b3b3b3]">
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} className="text-[#1db954]" />
            {genreStats?.totalListeners ?? 0} connected {genreStats?.totalListeners === 1 ? "listener" : "listeners"}
          </span>
          {(genreStats?.genres.length || 0) > 3 && (
            <button type="button" onClick={() => setGenresExpanded(value => !value)} className="inline-flex items-center gap-1 font-bold text-white lg:hidden">
              {genresExpanded ? "Show top 3" : "Show top 5"}
              <ChevronDown size={14} className={`transition-transform ${genresExpanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-[#727272]">Updated once per day · Each listener counts in their top 3 genres</p>
      </section>
      </div>

      {homeFriends.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1db954]">Your circle</p><h2 className="mt-1 text-xl font-black text-white">Music friends</h2></div>
            <button onClick={() => onNavigate("chat")} className="text-xs font-bold text-[#b3b3b3] hover:text-white">Open chat</button>
          </div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {homeFriends.slice(0, 8).map(friend => (
              <button key={friend.id} onClick={() => onNavigate("chat")} className="flex w-36 shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#181818] p-3 text-left hover:bg-[#222]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#282828] text-xs font-black text-[#1ed760]">
                  {friend.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : friend.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{friend.name}</p><p className="truncate text-[10px] text-[#727272]">@{friend.username}</p></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {missingSources > 0 && (
        <section aria-labelledby="setup-heading" className="space-y-4">
          <div className="px-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1db954]">
              {missingSources} {missingSources === 1 ? "step" : "steps"} left
            </p>
            <h2 id="setup-heading" className="mt-1 text-2xl font-black tracking-tight text-white">
              Finish setting up your music profile
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b3b3b3]">
              Last.fm keeps your recent listening current. Spotify history fills in the music you
              played before joining, giving your profile and matches a better foundation.
            </p>
          </div>

          {!lastfm && (
            <article className="rounded-2xl border border-white/10 bg-[#181818] p-5 shadow-[0_10px_28px_rgba(0,0,0,0.28)] md:p-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d51007] text-sm font-black text-white">
                  1
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-white">Connect Last.fm</h3>
                  <p className="mt-1 text-sm leading-6 text-[#b3b3b3]">
                    Create a free Last.fm account, connect Spotify in Last.fm, then return here and
                    connect it to SpotiMatch.
                  </p>
                  <ol className="mt-4 space-y-3 text-sm text-[#dedede]">
                    <li className="flex gap-3"><span className="font-bold text-[#727272]">1.</span><span>Create your Last.fm account.</span></li>
                    <li className="flex gap-3"><span className="font-bold text-[#727272]">2.</span><span>Turn on Spotify scrobbling so new plays are recorded.</span></li>
                    <li className="flex gap-3"><span className="font-bold text-[#727272]">3.</span><span>Connect that account here.</span></li>
                  </ol>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenSourceModal("lastfm")}
                      className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-black transition hover:scale-[1.02] hover:bg-[#f0f0f0]"
                    >
                      Connect Last.fm
                    </button>
                    <a
                      href="https://www.last.fm/join"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white"
                    >
                      Create account <ExternalLink size={14} />
                    </a>
                    <a
                      href="https://www.last.fm/about/trackmymusic"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-[#b3b3b3] transition hover:text-white"
                    >
                      Set up scrobbling <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          )}

          {!spotify && (
            <article className="rounded-2xl border border-white/10 bg-[#181818] p-5 shadow-[0_10px_28px_rgba(0,0,0,0.28)] md:p-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1db954] text-sm font-black text-black">
                  {lastfm ? 1 : 2}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-white">Import Spotify history</h3>
                  <p className="mt-1 text-sm leading-6 text-[#b3b3b3]">
                    Request your Extended Streaming History from Spotify. When Spotify sends it,
                    upload the downloaded ZIP or JSON files here.
                  </p>
                  <ol className="mt-4 space-y-3 text-sm text-[#dedede]">
                    <li className="flex gap-3"><span className="font-bold text-[#727272]">1.</span><span>Open Spotify&apos;s account privacy page.</span></li>
                    <li className="flex gap-3"><span className="font-bold text-[#727272]">2.</span><span>Request Extended Streaming History under Download your data.</span></li>
                    <li className="flex gap-3"><span className="font-bold text-[#727272]">3.</span><span>Import the files here after the download arrives.</span></li>
                  </ol>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <a
                      href="https://www.spotify.com/account/privacy/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1db954] px-5 py-2.5 text-sm font-extrabold text-black transition hover:scale-[1.02] hover:bg-[#1ed760]"
                    >
                      Request Spotify data <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => onOpenSourceModal("spotify")}
                      className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white"
                    >
                      Import downloaded files
                    </button>
                    <a
                      href="https://support.spotify.com/article/understanding-your-data/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-[#b3b3b3] transition hover:text-white"
                    >
                      What Spotify includes <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          )}
        </section>
      )}
    </div>
  );
}

// =========================================================================
// 2. SEARCH VIEW
// =========================================================================
export function SearchView({
  onAddFavorite,
  favorites,
}: {
  onAddFavorite: (item: MusicItem) => void;
  favorites: MusicItem[];
}) {
  const [kind, setKind] = useState<"artist" | "track" | "album">("track");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/catalog?kind=${kind}&q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search error");
      setResults(data.items || []);
      if (!data.items?.length) setError("No matching results found. Try another query.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Catalog search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Search Header Bar */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="relative max-w-xl">
          <SearchIcon size={18} className="absolute left-4 top-3 text-[#727272]" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full pl-11 pr-24 py-2.5 text-sm bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#242424] border border-transparent focus:border-white rounded-full text-white placeholder-[#727272] outline-none transition-all"
          />
          <button
            type="submit"
            disabled={searching}
            className="absolute right-1.5 top-1.5 px-4 py-1.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all"
          >
            {searching ? "..." : "Search"}
          </button>
        </form>

        {/* Filter Pills */}
        <div className="flex gap-2">
          {(["track", "artist", "album"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setKind(tab)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all capitalize ${
                kind === tab
                  ? "bg-white text-black"
                  : "bg-[#282828] text-[#b3b3b3] hover:text-white"
              }`}
            >
              {tab === "track" ? "Songs" : tab === "artist" ? "Artists" : "Albums"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-950/40 border border-red-800 text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Search Results Display */}
      {results.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white">Top Results</h2>
          <div className="space-y-1">
            {results.map((item, index) => {
              const isSaved = favorites.some(
                f => f.name.toLowerCase() === item.name.toLowerCase() && f.kind === item.kind
              );
              return (
                <div
                  key={`search-${item.kind}-${item.name}-${item.artist || ""}-${index}`}
                  className="group flex items-center justify-between p-2 rounded-md hover:bg-[#282828] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs text-[#727272] w-6 text-center">{index + 1}</span>
                    <MusicArtwork item={item} size="md" />
                    <div className="min-w-0 pr-4">
                      <span className="block text-sm font-bold text-white truncate">{item.name}</span>
                      <span className="block text-xs text-[#b3b3b3] truncate">
                        {item.kind === "artist" ? "Artist" : item.artist}
                        {item.album ? ` Ãƒâ€šÃ‚· ${item.album}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onAddFavorite(item)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${
                        isSaved
                          ? "bg-[#1db954] text-black"
                          : "bg-[#282828] text-white hover:bg-[#383838]"
                      }`}
                    >
                      {isSaved ? <Check size={13} /> : <Plus size={13} />}
                      {isSaved ? "Saved" : "Add"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Browse All Category Tiles */
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Browse all</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {browseCategories.map(cat => (
              <div
                key={cat.name}
                style={{ backgroundColor: cat.color }}
                onClick={() => {
                  setQuery(cat.name);
                }}
                className="relative h-32 p-4 rounded-xl font-bold text-lg text-white shadow-lg overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform select-none"
              >
                <span>{cat.name}</span>
                <span className="absolute bottom-2 right-2 text-4xl transform rotate-[25deg] opacity-90">
                  {cat.image}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3. MATCHES & FRIENDS VIEW (Spotimatch Community Hub)
// =========================================================================
export function MatchesView({
  account,
  onNavigate,
  onOpenUserProfile,
  onStartDirectChat,
}: {
  account?: AccountData;
  onNavigate?: (tab: SpotifyTab) => void;
  onOpenUserProfile?: (user: UserProfileModalUser) => void;
  onStartDirectChat?: (friend: FriendUser) => void;
}) {
  const [subTab, setSubTab] = useState<"matches" | "friends" | "requests" | "blocked">("matches");
  const [filter, setFilter] = useState<"all" | "high" | "indie" | "hiphop" | "electronic">("all");
  const [matches, setMatches] = useState<TasteMatch[]>(mockMatches);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<TasteMatch[]>([]);
  const [actionNotice, setActionNotice] = useState("");

  async function authFriendsFetch(url: string, options: RequestInit = {}) {
    return authenticatedFetch(url, options);
  }

  // Fetch initial friends & requests from /api/friends
  async function loadSocial() {
      try {
        const res = await authFriendsFetch("/api/friends");
        const data = await res.json();
        if (data.friends) setFriends(data.friends);
        if (data.incomingRequests) setIncomingRequests(data.incomingRequests);
        if (data.outgoingRequests) setOutgoingRequests(data.outgoingRequests);
        if (data.blockedUsers) setBlockedUsers(data.blockedUsers);
        if (data.matches) {
          const serverMatches = (data.matches as TasteMatch[]).map(candidate => {
            // If candidate is a demo profile and account has local music, compute instant match if needed
            if (DEFAULT_CANDIDATE_MUSIC[candidate.id] && account?.music) {
              const localMatch = calculateTasteMatch(
                account.music,
                DEFAULT_CANDIDATE_MUSIC[candidate.id],
                {
                  userBName: candidate.name,
                  userBBio: candidate.bio,
                  userBTopTrackFallback: candidate.topTrack,
                  userBTopTrackArtistFallback: candidate.topTrackArtist,
                }
              );
              return {
                ...candidate,
                matchScore: localMatch.matchScore,
                sharedArtists:
                  localMatch.sharedArtists.length > 0 ? localMatch.sharedArtists : candidate.sharedArtists,
                vibe: localMatch.vibe || candidate.vibe,
                topTrack: localMatch.topTrack || candidate.topTrack,
                topTrackArtist: localMatch.topTrackArtist || candidate.topTrackArtist,
              };
            }
            return candidate;
          });
          serverMatches.sort((a, b) => b.matchScore - a.matchScore);
          setMatches(serverMatches);
        }
      } catch {}
  }
  useActivePolling(loadSocial);

  // Handle actions: send request, accept, decline, cancel, remove
  async function handleSendRequest(target: TasteMatch) {
    setMatches(prev =>
      prev.map(m => (m.id === target.id ? { ...m, status: "pending_sent" } : m))
    );
    setOutgoingRequests(prev => [...prev, target.id]);
    setActionNotice(`Friend request sent to ${target.name}!`);
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_request",
        targetId: target.id,
        targetUsername: target.username,
        senderName: account?.profile?.displayName || "Music Friend",
        senderUsername: account?.profile?.username || "listener",
        senderAvatarUrl: account?.profile?.photoURL || "",
        matchScore: target.matchScore,
        sharedArtists: target.sharedArtists,
      }),
    }).catch(() => {});
  }

  async function handleCancelRequest(targetId: string) {
    setMatches(prev =>
      prev.map(m => (m.id === targetId ? { ...m, status: "none" } : m))
    );
    setOutgoingRequests(prev => prev.filter(id => id !== targetId));
    setActionNotice("Friend request canceled.");
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel_request",
        targetId,
      }),
    }).catch(() => {});
  }

  async function handleAcceptRequest(request: FriendRequest) {
    setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
    const newFriend: FriendUser = {
      id: request.fromUserId,
      name: request.fromName,
      username: request.fromUsername,
      avatarUrl: request.fromAvatarUrl,
      matchScore: request.matchScore,
      vibe: request.vibe,
      topTrack: "Shared Taste",
      connectedAt: new Date().toISOString(),
      status: "friends",
    };
    setFriends(prev => [newFriend, ...prev]);
    setMatches(prev =>
      prev.map(m => (m.id === request.fromUserId ? { ...m, status: "friends" } : m))
    );
    setActionNotice(`You are now friends with ${request.fromName}!`);
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept_request",
        requestId: request.id,
        fromUserId: request.fromUserId,
      }),
    }).catch(() => {});
  }

  async function handleDeclineRequest(requestId: string) {
    const targetReq = incomingRequests.find(r => r.id === requestId);
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    setActionNotice("Request declined.");
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "decline_request",
        requestId,
        fromUserId: targetReq?.fromUserId,
      }),
    }).catch(() => {});
  }

  async function handleRemoveFriend(friendId: string, friendName: string) {
    if (!window.confirm(`Are you sure you want to remove ${friendName} from your friends?`)) return;
    setFriends(prev => prev.filter(f => f.id !== friendId));
    setMatches(prev =>
      prev.map(m => (m.id === friendId ? { ...m, status: "none" } : m))
    );
    setActionNotice(`Removed ${friendName} from friends.`);
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "remove_friend",
        friendId,
      }),
    }).catch(() => {});
  }

  async function handleBlockUser(target: {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
  }) {
    if (
      !window.confirm(
        `Are you sure you want to block ${target.name}? They won't be able to message you or see your profile.`
      )
    )
      return;

    // Filter out of current social states
    setMatches(prev => prev.filter(m => m.id !== target.id));
    setFriends(prev => prev.filter(f => f.id !== target.id));
    setIncomingRequests(prev => prev.filter(r => r.fromUserId !== target.id));
    setOutgoingRequests(prev => prev.filter(id => id !== target.id));

    const blockedProfile: TasteMatch = {
      id: target.id,
      name: target.name,
      username: target.username || "user",
      matchScore: 0,
      avatarUrl: target.avatarUrl || "",
      vibe: "Blocked listener",
      sharedArtists: [],
      topTrack: "",
      city: "",
      status: "none",
      isBlocked: true,
    };
    setBlockedUsers(prev => [blockedProfile, ...prev.filter(b => b.id !== target.id)]);
    setActionNotice(`Blocked ${target.name}.`);
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "block_user",
        targetId: target.id,
      }),
    }).catch(() => {});
  }

  async function handleUnblockUser(targetId: string, targetName: string) {
    setBlockedUsers(prev => prev.filter(u => u.id !== targetId));
    setActionNotice(`Unblocked ${targetName}.`);
    setTimeout(() => setActionNotice(""), 3500);

    authFriendsFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unblock_user",
        targetId,
      }),
    }).catch(() => {});
  }

  // Filter matches
  const filteredMatches = matches.filter(m => {
    if (filter === "high") return m.matchScore >= 90;
    if (filter === "indie")
      return (
        m.vibe.toLowerCase().includes("indie") ||
        m.vibe.toLowerCase().includes("rock") ||
        m.vibe.toLowerCase().includes("pop")
      );
    if (filter === "hiphop")
      return (
        m.vibe.toLowerCase().includes("hip-hop") ||
        m.vibe.toLowerCase().includes("rap") ||
        m.vibe.toLowerCase().includes("r&b")
      );
    if (filter === "electronic")
      return (
        m.vibe.toLowerCase().includes("psychedelic") ||
        m.vibe.toLowerCase().includes("electronic") ||
        m.vibe.toLowerCase().includes("funk")
      );
    return true;
  }).sort((a, b) => b.matchScore - a.matchScore);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 px-4 pb-20 pt-5 animate-fadeIn select-none md:px-8 md:pt-8">
      {/* Hero Header */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#1db954]">
          SPOTIMATCH SOCIAL & DISCOVERY
        </span>
        <h1 className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
          Friends & Taste Matching
        </h1>
        <p className="text-xs md:text-sm text-[#b3b3b3] max-w-2xl">
          Connect with listeners based on harmonic overlap, shared favorite artists, and acoustic compatibility.
        </p>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3 bg-[#1db954]/20 border border-[#1db954]/40 text-[#1ed760] text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
          <Check size={15} /> {actionNotice}
        </div>
      )}

      {/* Sub Navigation Bar: Discover Matches, Friends, Requests */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-white/10 pb-3">
        <button
          onClick={() => setSubTab("matches")}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === "matches"
              ? "border-white bg-white text-black shadow-lg"
              : "border-white/10 bg-[#181818] text-[#b3b3b3] hover:text-white hover:bg-[#242424]"
          }`}
        >
          <Sparkles size={14} className={subTab === "matches" ? "text-black" : "text-[#1db954]"} />
          <span>Discover Matches</span>
        </button>

        <button
          onClick={() => setSubTab("friends")}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === "friends"
              ? "border-white bg-white text-black shadow-lg"
              : "border-white/10 bg-[#181818] text-[#b3b3b3] hover:text-white hover:bg-[#242424]"
          }`}
        >
          <UserCheck size={14} className={subTab === "friends" ? "text-black" : "text-[#1db954]"} />
          <span>My Friends</span>
          {friends.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                subTab === "friends" ? "bg-black text-white" : "bg-[#282828] text-[#1db954]"
              }`}
            >
              {friends.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab("requests")}
          className={`relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === "requests"
              ? "border-white bg-white text-black shadow-lg"
              : "border-white/10 bg-[#181818] text-[#b3b3b3] hover:text-white hover:bg-[#242424]"
          }`}
        >
          <Bell size={14} className={subTab === "requests" ? "text-black" : "text-amber-400"} />
          <span>Requests</span>
          {incomingRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSubTab("blocked")}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
            subTab === "blocked"
              ? "border-white bg-white text-black shadow-lg"
              : "border-white/10 bg-[#181818] text-[#b3b3b3] hover:text-white hover:bg-[#242424]"
          }`}
        >
          <ShieldAlert size={14} className={subTab === "blocked" ? "text-black" : "text-rose-400"} />
          <span>Blocked</span>
          {blockedUsers.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                subTab === "blocked" ? "bg-black text-white" : "bg-[#282828] text-rose-400"
              }`}
            >
              {blockedUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* =================================================================== */}
      {/* SUB-TAB 1: DISCOVER MATCHES                                         */}
      {/* =================================================================== */}
      {subTab === "matches" && (
        <div className="space-y-6">
          {/* Filter Chips */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "all", label: `All (${matches.length})` },
              { id: "high", label: "90%+ Compatibility" },
              { id: "indie", label: "Indie & Rock" },
              { id: "hiphop", label: "Hip-Hop & R&B" },
              { id: "electronic", label: "Psychedelic / Funk" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`shrink-0 border px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  filter === f.id
                    ? "border-white bg-white text-black shadow"
                    : "border-white/10 bg-[#202020] text-[#b3b3b3] hover:text-white hover:bg-[#282828]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Matches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredMatches.map(match => (
              <div
                key={match.id}
                className="group flex flex-col justify-between space-y-4 rounded-2xl border border-white/10 bg-[#181818] p-4 shadow-xl transition-all hover:border-white/20 hover:bg-[#202020] md:p-5"
              >
                <div className="flex items-start gap-4">
                  <div
                    onClick={() => onOpenUserProfile?.(match)}
                    className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 border-2 border-white/10 shadow-lg cursor-pointer hover:ring-2 hover:ring-[#1db954] hover:scale-105 transition-all"
                    title={`View ${match.name}'s profile`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={match.avatarUrl} alt={match.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <h3
                        onClick={() => onOpenUserProfile?.(match)}
                        className="font-bold text-base text-white truncate cursor-pointer hover:text-[#1db954] transition-colors"
                        title={`View ${match.name}'s profile`}
                      >
                        {match.name}
                      </h3>
                      <span className="shrink-0 rounded-full border border-[#1db954]/30 bg-[#1db954]/20 px-2 py-0.5 text-[10px] font-black text-[#1ed760] sm:px-2.5 sm:text-xs">
                        {match.matchScore}% Match
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenUserProfile?.(match)}
                      className="text-xs text-[#727272] hover:text-[#b3b3b3] transition-colors block text-left"
                    >
                      @{match.username} • {match.city}
                    </button>
                    <p className="text-xs font-medium text-[#b3b3b3] mt-2 italic">
                      &ldquo;{match.vibe}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Shared overlap section */}
                <div className="p-3 bg-[#121212] rounded-xl text-xs space-y-2 border border-white/5">
                  <div className="flex items-center gap-1.5 text-[#1ed760] font-bold">
                    <Flame size={14} />
                    <span>
                      {match.sharedArtists.length > 0
                        ? `Shared Artists (${match.sharedArtists.length}):`
                        : "Acoustic Overlap:"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {match.sharedArtists.length > 0 ? (
                      match.sharedArtists.map(artist => (
                        <span
                          key={artist}
                          className="px-2.5 py-1 bg-[#242424] text-white rounded-md text-[11px] font-semibold border border-white/5"
                        >
                          {artist}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#888888] italic text-[11px] py-0.5">
                        Exploring distinct sonic spaces • Potential for fresh music discoveries
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-[#b3b3b3] flex items-center gap-1.5 truncate pr-2">
                    <Disc3 size={14} className="text-[#1ed760] shrink-0" />
                    <span className="truncate">
                      Top: <strong className="text-white">{match.topTrack}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {match.status === "friends" ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 text-xs font-bold text-[#1ed760] bg-[#1db954]/10 border border-[#1db954]/30 rounded-full flex items-center gap-1">
                          <Check size={13} /> Friends
                        </span>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate("chat")}
                            className="px-3 py-1.5 text-xs font-bold bg-[#282828] hover:bg-[#383838] text-white rounded-full transition-colors cursor-pointer"
                          >
                            Chat
                          </button>
                        )}
                      </div>
                    ) : match.status === "pending_sent" ? (
                      <button
                        onClick={() => handleCancelRequest(match.id)}
                        className="px-4 py-1.5 text-xs font-bold bg-[#282828] hover:bg-rose-950/40 text-[#b3b3b3] hover:text-rose-300 border border-white/10 rounded-full transition-all cursor-pointer"
                        title="Click to cancel request"
                      >
                        Pending ÃƒÂ¢Ã‚ÂÃ‚Â³
                      </button>
                    ) : match.status === "pending_received" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const req = incomingRequests.find(r => r.fromUserId === match.id);
                            if (req) handleAcceptRequest(req);
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-colors cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            const req = incomingRequests.find(r => r.fromUserId === match.id);
                            if (req) handleDeclineRequest(req.id);
                          }}
                          className="px-3 py-1.5 text-xs font-bold bg-[#242424] hover:bg-[#303030] text-[#b3b3b3] rounded-full transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(match)}
                        className="px-4 py-1.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <UserPlus size={13} /> Connect
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleBlockUser(match)}
                      className="p-1.5 text-[#727272] hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors cursor-pointer"
                      title={`Block ${match.name}`}
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: MY FRIENDS LIST                                          */}
      {/* =================================================================== */}
      {subTab === "friends" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Connected Friends ({friends.length})</h2>
            {onNavigate && (
              <button
                onClick={() => onNavigate("chat")}
                className="px-4 py-1.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow"
              >
                <MessageSquare size={13} /> Open Global Lounge
              </button>
            )}
          </div>

          {friends.length === 0 ? (
            <div className="p-12 text-center bg-[#181818] border border-white/5 rounded-2xl space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#282828] flex items-center justify-center text-[#727272]">
                <Users size={24} />
              </div>
              <h3 className="text-base font-bold text-white">No Friends Connected Yet</h3>
              <p className="text-xs text-[#b3b3b3] max-w-sm mx-auto">
                Explore the Discover Matches tab to find people with high music compatibility and send friend requests!
              </p>
              <button
                onClick={() => setSubTab("matches")}
                className="px-5 py-2 text-xs font-bold bg-[#1db954] text-black rounded-full hover:bg-[#1ed760] transition-colors cursor-pointer"
              >
                Discover Matches
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map(friend => (
                <div
                  key={`friend-${friend.id}`}
                  className="p-5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl transition-all shadow-md flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      onClick={() => onOpenUserProfile?.(friend)}
                      className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow relative cursor-pointer hover:ring-2 hover:ring-[#1db954] hover:scale-105 transition-all"
                      title={`View ${friend.name}'s profile`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={friend.avatarUrl} alt={friend.name} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#1db954] border-2 border-[#181818]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4
                          onClick={() => onOpenUserProfile?.(friend)}
                          className="font-bold text-sm text-white truncate cursor-pointer hover:text-[#1db954] transition-colors"
                          title={`View ${friend.name}'s profile`}
                        >
                          {friend.name}
                        </h4>
                        <span className="px-2 py-0.5 bg-[#1db954]/20 text-[#1ed760] text-[10px] font-black rounded-full">
                          {friend.matchScore}% Match
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile?.(friend)}
                        className="text-xs text-[#727272] hover:text-[#b3b3b3] transition-colors cursor-pointer block text-left"
                      >
                        @{friend.username}
                      </button>
                      <div className="text-[11px] text-[#b3b3b3] truncate mt-1 flex items-center gap-1">
                        <Music2 size={12} className="text-[#1ed760] shrink-0" />
                        <span className="truncate">
                          {friend.nowPlaying
                            ? `${friend.nowPlaying.name} - ${friend.nowPlaying.artist}`
                            : friend.topTrack}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        if (onStartDirectChat) onStartDirectChat(friend);
                        else onNavigate?.("chat");
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <MessageCircle size={13} /> Chat
                    </button>
                    <button
                      onClick={() => handleRemoveFriend(friend.id, friend.name)}
                      className="px-3 py-1 text-[11px] font-semibold text-[#727272] hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => handleBlockUser(friend)}
                      className="px-3 py-1 text-[11px] font-semibold text-[#727272] hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Block
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 3: FRIEND REQUESTS (INCOMING & OUTGOING)                    */}
      {/* =================================================================== */}
      {subTab === "requests" && (
        <div className="space-y-8">
          {/* Incoming Requests */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bell size={18} className="text-amber-400" />
              Incoming Requests ({incomingRequests.length})
            </h2>

            {incomingRequests.length === 0 ? (
              <div className="p-8 text-center bg-[#181818] border border-white/5 rounded-2xl text-xs text-[#727272]">
                No pending incoming friend requests at the moment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingRequests.map(req => (
                  <div
                    key={`req-${req.id}`}
                    className="p-5 bg-[#181818] border border-white/10 rounded-2xl shadow-xl space-y-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        onClick={() =>
                          onOpenUserProfile?.({
                            id: req.fromUserId,
                            name: req.fromName,
                            username: req.fromUsername,
                            avatarUrl: req.fromAvatarUrl,
                            matchScore: req.matchScore,
                            vibe: req.vibe,
                            sharedArtists: req.sharedArtists,
                            status: "pending_received",
                          })
                        }
                        className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow cursor-pointer hover:ring-2 hover:ring-[#1db954] hover:scale-105 transition-all"
                        title={`View ${req.fromName}'s profile`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={req.fromAvatarUrl} alt={req.fromName} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4
                            onClick={() =>
                              onOpenUserProfile?.({
                                id: req.fromUserId,
                                name: req.fromName,
                                username: req.fromUsername,
                                avatarUrl: req.fromAvatarUrl,
                                matchScore: req.matchScore,
                                vibe: req.vibe,
                                sharedArtists: req.sharedArtists,
                                status: "pending_received",
                              })
                            }
                            className="font-bold text-sm text-white truncate cursor-pointer hover:text-[#1db954] transition-colors"
                            title={`View ${req.fromName}'s profile`}
                          >
                            {req.fromName}
                          </h4>
                          <span className="px-2 py-0.5 bg-[#1db954]/20 text-[#1ed760] text-[10px] font-black rounded-full">
                            {req.matchScore}% Match
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenUserProfile?.({
                              id: req.fromUserId,
                              name: req.fromName,
                              username: req.fromUsername,
                              avatarUrl: req.fromAvatarUrl,
                              matchScore: req.matchScore,
                              vibe: req.vibe,
                              sharedArtists: req.sharedArtists,
                              status: "pending_received",
                            })
                          }
                          className="text-xs text-[#727272] hover:text-[#b3b3b3] transition-colors cursor-pointer block text-left"
                        >
                          @{req.fromUsername}
                        </button>
                        <p className="text-xs text-[#b3b3b3] mt-1.5 italic">&ldquo;{req.vibe}&rdquo;</p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#121212] rounded-xl text-xs flex items-center gap-1.5 flex-wrap">
                      <span className="text-[#1ed760] font-bold">Shared:</span>
                      {req.sharedArtists.map(artist => (
                        <span key={artist} className="px-2 py-0.5 bg-[#282828] text-white rounded text-[10px]">
                          {artist}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="flex-1 py-2 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-colors cursor-pointer shadow"
                      >
                        Accept Request
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.id)}
                        className="px-3 py-2 text-xs font-bold bg-[#242424] hover:bg-[#303030] text-[#b3b3b3] rounded-full transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() =>
                          handleBlockUser({
                            id: req.fromUserId,
                            name: req.fromName,
                            username: req.fromUsername,
                            avatarUrl: req.fromAvatarUrl,
                          })
                        }
                        className="px-3 py-2 text-xs font-semibold text-[#727272] hover:text-rose-400 rounded-full transition-colors cursor-pointer"
                        title="Block this user"
                      >
                        Block
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent Requests */}
          {outgoingRequests.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-[#b3b3b3]">
                Sent Requests Awaiting Approval ({outgoingRequests.length})
              </h3>
              <div className="space-y-2">
                {outgoingRequests.map(targetId => {
                  const target = matches.find(m => m.id === targetId);
                  return (
                    <div
                      key={`outgoing-${targetId}`}
                      className="p-3 bg-[#181818] border border-white/5 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl overflow-hidden bg-[#242424]">
                          {target?.avatarUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={target.avatarUrl} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-white">{target?.name || "Listener"}</span>
                          <span className="block text-[11px] text-[#727272]">Request pending approval</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelRequest(targetId)}
                        className="px-3 py-1 text-xs text-[#b3b3b3] hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 4: BLOCKED PROFILES                                        */}
      {/* =================================================================== */}
      {subTab === "blocked" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-400" />
                Blocked Profiles ({blockedUsers.length})
              </h2>
              <p className="text-xs text-[#b3b3b3]">
                Blocked accounts cannot send you friend requests, direct message you, or view your profile.
              </p>
            </div>
          </div>

          {blockedUsers.length === 0 ? (
            <div className="p-12 text-center bg-[#181818] border border-white/5 rounded-2xl space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#282828] flex items-center justify-center text-[#727272]">
                <ShieldAlert size={22} />
              </div>
              <h3 className="text-sm font-bold text-white">No Blocked Profiles</h3>
              <p className="text-xs text-[#727272] max-w-sm mx-auto">
                You haven&apos;t blocked anyone. You can block any listener from their profile card or matches list.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blockedUsers.map(user => (
                <div
                  key={`blocked-${user.id}`}
                  className="p-4 bg-[#181818] border border-white/5 rounded-2xl flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-[#282828] border border-white/10 opacity-70">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#727272]">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-white truncate">{user.name}</h4>
                      <p className="text-xs text-[#727272] truncate">@{user.username}</p>
                      <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                        <ShieldAlert size={10} /> Blocked
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblockUser(user.id, user.name)}
                    className="px-4 py-1.5 text-xs font-bold bg-[#282828] hover:bg-white hover:text-black text-white border border-white/10 rounded-full transition-all cursor-pointer shrink-0"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3.5 CHAT HUB (Global Chat at Top + Direct Messages with Friends Below)
// =========================================================================
export { ChatView, ChatAvatar } from "./ChatHubView";
export { NotificationsView } from "./NotificationsView";

// =========================================================================
// 4. SOUND CAPSULE VIEW (Spotify-Accurate Sound Capsule Replication)
// =========================================================================

// High-fidelity fallback / demo monthly capsules matching the Spotify screenshot & app experience
const fallbackCollageMay: MusicItem[] = [
  { kind: "album", name: "Paper Trail", artist: "T.I.", plays: 48 },
  { kind: "album", name: "Recovery", artist: "Eminem", plays: 37 },
  { kind: "album", name: "Happier", artist: "Marshmello & Bastille", plays: 31 },
];

const fallbackCollageApril: MusicItem[] = [
  { kind: "album", name: "In Rainbows", artist: "Radiohead", plays: 54 },
  { kind: "album", name: "Bloom", artist: "Beach House", plays: 42 },
  { kind: "album", name: "Texas Sun", artist: "Khruangbin & Leon Bridges", plays: 29 },
];

export function getDemoCapsules(currentDate = new Date()): Record<string, MonthlyCapsule> {
  const currentYear = currentDate.getFullYear();
  const currentMonthNum = currentDate.getMonth() + 1;
  const currentMonthKey = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;
  const currentMonthName = currentDate.toLocaleDateString("en-US", { month: "long" });
  const dayOfMonth = currentDate.getDate();

  // Current month updates once daily based on the day of the month
  const currentMonthMinutes = Math.min(4800, 180 + dayOfMonth * 62);

  return {
    [currentMonthKey]: {
      monthKey: currentMonthKey,
      monthName: currentMonthName,
      year: String(currentYear),
      label: `${currentMonthName} ${currentYear}`,
      minutesListened: currentMonthMinutes,
      isCurrentMonth: true,
      topArtist: {
        kind: "artist",
        name: "Radiohead",
        artist: "",
      },
      topSong: {
        kind: "track",
        name: "Weird Fishes / Arpeggi",
        artist: "Radiohead",
        album: "In Rainbows",
      },
      top5Artists: [
        { kind: "artist", name: "Radiohead", artist: "", plays: 114 },
        { kind: "artist", name: "Beach House", artist: "", plays: 88 },
        { kind: "artist", name: "Kendrick Lamar", artist: "", plays: 64 },
        { kind: "artist", name: "Alvvays", artist: "", plays: 51 },
        { kind: "artist", name: "Khruangbin", artist: "", plays: 43 },
      ],
      top5Songs: [
        { kind: "track", name: "Weird Fishes / Arpeggi", artist: "Radiohead", album: "In Rainbows", plays: 42 },
        { kind: "track", name: "Myth", artist: "Beach House", album: "Bloom", plays: 34 },
        { kind: "track", name: "N95", artist: "Kendrick Lamar", album: "Mr. Morale & The Big Steppers", plays: 29 },
        { kind: "track", name: "Archie, Marry Me", artist: "Alvvays", album: "Alvvays", plays: 25 },
        { kind: "track", name: "Texas Sun", artist: "Khruangbin & Leon Bridges", album: "Texas Sun", plays: 21 },
      ],
      albumsCollage: fallbackCollageApril,
    },
    "2024-05": {
      monthKey: "2024-05",
      monthName: "May",
      year: "2024",
      label: "May 2024",
      minutesListened: 2621,
      isCurrentMonth: false,
      topArtist: {
        kind: "artist",
        name: "Rihanna",
        artist: "",
      },
      topSong: {
        kind: "track",
        name: "I Like Me Better",
        artist: "Lauv",
        album: "I met you when I was 18.",
      },
      top5Artists: [
        { kind: "artist", name: "Rihanna", artist: "", plays: 128 },
        { kind: "artist", name: "Lauv", artist: "", plays: 94 },
        { kind: "artist", name: "Eminem", artist: "", plays: 72 },
        { kind: "artist", name: "Adele", artist: "", plays: 65 },
        { kind: "artist", name: "Marshmello", artist: "", plays: 54 },
      ],
      top5Songs: [
        { kind: "track", name: "I Like Me Better", artist: "Lauv", album: "I met you when I was 18.", plays: 48 },
        { kind: "track", name: "Maneater", artist: "Daryl Hall & John Oates", album: "H2O", plays: 37 },
        { kind: "track", name: "Happier", artist: "Marshmello & Bastille", album: "Happier", plays: 31 },
        { kind: "track", name: "Skyfall", artist: "Adele", album: "Skyfall", plays: 28 },
        { kind: "track", name: "Space Song", artist: "Beach House", album: "Depression Cherry", plays: 22 },
      ],
      albumsCollage: fallbackCollageMay,
    },
    "2024-04": {
      monthKey: "2024-04",
      monthName: "April",
      year: "2024",
      label: "April 2024",
      minutesListened: 1984,
      isCurrentMonth: false,
      topArtist: {
        kind: "artist",
        name: "Beach House",
        artist: "",
      },
      topSong: {
        kind: "track",
        name: "Myth",
        artist: "Beach House",
        album: "Bloom",
      },
      top5Artists: [
        { kind: "artist", name: "Beach House", artist: "", plays: 102 },
        { kind: "artist", name: "Radiohead", artist: "", plays: 89 },
        { kind: "artist", name: "Frank Ocean", artist: "", plays: 68 },
        { kind: "artist", name: "Alvvays", artist: "", plays: 54 },
        { kind: "artist", name: "Khruangbin", artist: "", plays: 47 },
      ],
      top5Songs: [
        { kind: "track", name: "Myth", artist: "Beach House", album: "Bloom", plays: 44 },
        { kind: "track", name: "Reckoner", artist: "Radiohead", album: "In Rainbows", plays: 36 },
        { kind: "track", name: "Lost", artist: "Frank Ocean", album: "Channel Orange", plays: 30 },
        { kind: "track", name: "Archie, Marry Me", artist: "Alvvays", album: "Alvvays", plays: 24 },
        { kind: "track", name: "Texas Sun", artist: "Khruangbin & Leon Bridges", album: "Texas Sun", plays: 19 },
      ],
      albumsCollage: fallbackCollageApril,
    },
  };
}

export function CapsuleView({
  account,
  onNavigate,
}: {
  account: AccountData;
  onNavigate?: (tab: SpotifyTab) => void;
}) {
  // Navigation / view mode state
  const [activeDrilldown, setActiveDrilldown] = useState<{
    mode: "top-artists" | "top-songs" | "time-listened";
    capsule: MonthlyCapsule;
  } | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Available monthly data: either parsed from user's real Spotify history or demo capsules
  const userMonthlyMap = account.music.spotify?.monthlyCapsules;
  const hasUserHistory = Boolean(userMonthlyMap && Object.keys(userMonthlyMap).length > 0);

  const availableCapsulesMap = hasUserHistory
    ? (userMonthlyMap as Record<string, MonthlyCapsule>)
    : getDemoCapsules();

  // Sort available months descending (most recent / latest first)
  const availableMonths = Object.keys(availableCapsulesMap).sort().reverse();

  if (availableMonths.length === 0) {
    return (
      <div className="py-20 text-center text-[#727272]">
        <Sparkles size={32} className="mx-auto mb-3 text-[#555]" />
        <p className="text-sm">No Sound Capsule records available yet.</p>
      </div>
    );
  }

  // Handle Back arrow
  function handleBack() {
    if (activeDrilldown) {
      setActiveDrilldown(null);
    } else if (onNavigate) {
      onNavigate("home");
    }
  }

  // =========================================================================
  // SUB-VIEW: TOP 5 ARTISTS DRILLDOWN
  // =========================================================================
  if (activeDrilldown && activeDrilldown.mode === "top-artists") {
    const capsule = activeDrilldown.capsule;
    return (
      <div className="max-w-md mx-auto space-y-6 pb-20 animate-fadeIn select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setActiveDrilldown(null)}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Back to Sound Capsule"
          >
            <ChevronLeft size={28} />
          </button>
          <span className="text-xs font-bold text-[#b3b3b3]">{capsule.label}</span>
          <div className="w-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#509bf5]">
            SOUND CAPSULE RANKING
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Top 5 Artists
          </h1>
          <p className="text-xs text-[#b3b3b3] mt-1">
            Your most listened-to artists in {capsule.label}
          </p>
        </div>

        {/* 5 Ranked Artists List */}
        <div className="space-y-2">
          {capsule.top5Artists.slice(0, 5).map((artist, idx) => (
            <div
              key={`drilldown-artist-${artist.name}-${idx}`}
              onClick={() => openSpotifyArtist(artist.name)}
              className="flex items-center gap-4 p-3.5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl transition-all shadow-md group cursor-pointer"
              title={`Open ${artist.name}'s discography in Spotify`}
            >
              <span className={`text-base font-black w-6 text-center ${idx === 0 ? "text-[#509bf5]" : "text-[#727272]"}`}>
                #{idx + 1}
              </span>
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#242424] border border-white/10 shrink-0 shadow relative">
                <MusicArtwork item={artist} size="full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white truncate group-hover:text-[#509bf5] transition-colors">
                    {artist.name}
                  </h3>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 bg-[#509bf5]/20 text-[#509bf5] text-[10px] font-bold rounded-full">
                      #1 Artist
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#b3b3b3]">
                  {artist.plays ? `${artist.plays} streams` : "Heavy rotation"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUB-VIEW: TOP 5 SONGS DRILLDOWN
  // =========================================================================
  if (activeDrilldown && activeDrilldown.mode === "top-songs") {
    const capsule = activeDrilldown.capsule;
    return (
      <div className="max-w-md mx-auto space-y-6 pb-20 animate-fadeIn select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setActiveDrilldown(null)}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Back to Sound Capsule"
          >
            <ChevronLeft size={28} />
          </button>
          <span className="text-xs font-bold text-[#b3b3b3]">{capsule.label}</span>
          <div className="w-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#ffdb58]">
            SOUND CAPSULE RANKING
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Top 5 Songs
          </h1>
          <p className="text-xs text-[#b3b3b3] mt-1">
            Your most played tracks in {capsule.label}
          </p>
        </div>

        {/* 5 Ranked Songs List */}
        <div className="space-y-2">
          {capsule.top5Songs.slice(0, 5).map((song, idx) => (
            <div
              key={`drilldown-song-${song.name}-${idx}`}
              onClick={() => openSpotifyTrack(song.name, song.artist)}
              className="flex items-center gap-4 p-3.5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl transition-all shadow-md group cursor-pointer"
              title={`Listen to "${song.name}" by ${song.artist} on Spotify`}
            >
              <span className={`text-base font-black w-6 text-center ${idx === 0 ? "text-[#ffdb58]" : "text-[#727272]"}`}>
                #{idx + 1}
              </span>
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#242424] border border-white/10 shrink-0 shadow relative">
                <MusicArtwork item={song} size="full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white truncate group-hover:text-[#ffdb58] transition-colors">
                    {song.name}
                  </h3>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 bg-[#ffdb58]/20 text-[#ffdb58] text-[10px] font-bold rounded-full">
                      #1 Song
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#b3b3b3] truncate block">
                  {song.artist} {song.album ? `ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${song.album}` : ""}
                </span>
                <span className="text-[11px] text-[#727272]">
                  {song.plays ? `${song.plays} plays` : "Top spin"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUB-VIEW: TIME LISTENED DRILLDOWN
  // =========================================================================
  if (activeDrilldown && activeDrilldown.mode === "time-listened") {
    const capsule = activeDrilldown.capsule;
    const hours = (capsule.minutesListened / 60).toFixed(1);
    const dailyAvg = (capsule.minutesListened / 30).toFixed(0);

    return (
      <div className="max-w-md mx-auto space-y-6 pb-20 animate-fadeIn select-none">
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setActiveDrilldown(null)}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Back to Sound Capsule"
          >
            <ChevronLeft size={28} />
          </button>
          <span className="text-xs font-bold text-[#b3b3b3]">{capsule.label}</span>
          <div className="w-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#1ed760]">
            LISTENING ACTIVITY
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Time Listened
          </h1>
          <p className="text-xs text-[#b3b3b3] mt-1">
            Total minutes streamed during {capsule.label}
          </p>
        </div>

        <div className="p-6 bg-[#181818] border border-white/5 rounded-3xl text-center space-y-2">
          <span className="text-xs font-semibold text-[#b3b3b3]">Total Listening Time</span>
          <div className="text-5xl font-black text-[#1ed760] tracking-tight">
            {capsule.minutesListened.toLocaleString()}
          </div>
          <span className="text-sm font-bold text-white block">minutes streamed</span>
          <span className="text-xs text-[#727272] block">Approximately {hours} hours of music</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-4 bg-[#181818] border border-white/5 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-[#727272] uppercase">Daily Average</span>
            <p className="text-xl font-black text-white">{dailyAvg} mins / day</p>
          </div>
          <div className="p-4 bg-[#181818] border border-white/5 rounded-2xl space-y-1">
            <span className="text-[11px] font-bold text-[#727272] uppercase">Top Genre</span>
            <p className="text-xl font-black text-[#509bf5] truncate">Indie & Pop</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper to ensure 3 albums are always returned for each capsule
  function getTop3Albums(capsule: MonthlyCapsule): MusicItem[] {
    if (capsule.albumsCollage && capsule.albumsCollage.length > 0) {
      return capsule.albumsCollage.slice(0, 3);
    }
    return capsule.top5Songs.slice(0, 3).map(s => ({
      kind: "album" as const,
      name: s.album || s.name,
      artist: s.artist,
      plays: s.plays,
    }));
  }

  return (
    <>
      {/* ===================================================================== */}
      {/* 1. MOBILE PHONE UI (< md): Replicates Spotify phone layout exactly   */}
      {/* ===================================================================== */}
      <div className="block md:hidden max-w-md mx-auto space-y-6 pb-24 font-sans select-none animate-fadeIn">
        {/* Top Navigation Bar: Back Arrow `<` */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleBack}
            className="w-10 h-10 -ml-2 rounded-full hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft size={30} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-2 text-[#727272] hover:text-white transition-colors cursor-pointer"
            aria-label="About Sound Capsule"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        {/* Headline: Your Sound Capsule */}
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
            Your Sound Capsule
          </h1>
          <p className="text-xs text-[#b3b3b3] mt-1">
            Scroll down to journey through your past listening months
          </p>
          <p className="text-[11px] text-[#1ed760] font-medium mt-1">
            Note: For accurate sound capsule statistics, refer to your Spotify app.
          </p>
        </div>

        {/* Continuous Chronological Timeline Feed (Newest Month at Top) */}
        <div className="space-y-8">
          {availableMonths.map((monthKey, monthIdx) => {
            const capsule = availableCapsulesMap[monthKey];
            const top3Albums = getTop3Albums(capsule);

            return (
              <div key={`phone-capsule-${monthKey}`} className="space-y-4">
                {/* Month & Year Title */}
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-xl font-black text-white">
                    {capsule.monthName}{" "}
                    <span className="text-[#a7a7a7] font-bold">{capsule.year}</span>
                  </h2>
                  {capsule.isCurrentMonth && (
                    <span className="px-2.5 py-0.5 bg-[#1db954]/20 border border-[#1db954]/40 text-[#1db954] text-[10px] font-bold rounded-full">
                      Live daily updates
                    </span>
                  )}
                </div>

                {/* Card 1: Time listened (Big Vibrant Green Minutes) */}
                <div
                  onClick={() => setActiveDrilldown({ mode: "time-listened", capsule })}
                  className="p-5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl cursor-pointer transition-all space-y-1 shadow-lg group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#b3b3b3]">Time listened</span>
                    <ChevronRight size={18} className="text-[#727272] group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-3xl font-black text-[#1ed760] tracking-tight">
                    {capsule.minutesListened.toLocaleString()} minutes
                  </div>
                </div>

                {/* Card 2 & 3: Two Side-by-Side Cards (Top Artist & Top Song) */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Top artist card */}
                  <div
                    onClick={() => setActiveDrilldown({ mode: "top-artists", capsule })}
                    className="p-4 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between shadow-lg group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#b3b3b3]">Top artist</span>
                        <ChevronRight size={18} className="text-[#727272] group-hover:text-white transition-colors" />
                      </div>
                      <h3 className="text-base font-black text-[#509bf5] truncate">
                        {capsule.topArtist.name}
                      </h3>
                    </div>

                    <div className="my-4 relative flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#242424] shadow-2xl border border-white/10 relative">
                        <MusicArtwork item={capsule.topArtist} size="full" />
                      </div>
                      <span className="absolute bottom-0 right-2 sm:right-4 px-2.5 py-0.5 bg-[#282828] text-white text-[10px] font-bold rounded-full border border-white/10 shadow">
                        New
                      </span>
                    </div>
                  </div>

                  {/* Top song card */}
                  <div
                    onClick={() => setActiveDrilldown({ mode: "top-songs", capsule })}
                    className="p-4 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between shadow-lg group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#b3b3b3]">Top song</span>
                        <ChevronRight size={18} className="text-[#727272] group-hover:text-white transition-colors" />
                      </div>
                      <h3 className="text-base font-black text-[#ffdb58] truncate">
                        {capsule.topSong.name}
                      </h3>
                    </div>

                    <div className="my-4 relative flex items-center justify-center">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#242424] shadow-2xl border border-white/10 relative">
                        <MusicArtwork item={capsule.topSong} size="full" />
                      </div>
                      <span className="absolute bottom-0 right-2 sm:right-4 px-2.5 py-0.5 bg-[#282828] text-white text-[10px] font-bold rounded-full border border-white/10 shadow">
                        New
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: 3 Boxes for Most Listened Albums */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-[#727272] uppercase tracking-wider block">
                    Most Listened Albums
                  </span>
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    {top3Albums.map((album, idx) => (
                      <div
                        key={`phone-album-${capsule.monthKey}-${album.name}-${idx}`}
                        onClick={() => openSpotifyTrack(album.name, album.artist)}
                        className="p-2.5 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-xl flex flex-col justify-between shadow-md group relative cursor-pointer transition-colors"
                        title={`Listen to "${album.name}" on Spotify`}
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-[#242424] mb-2 shadow">
                          <MusicArtwork item={album} size="full" />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 backdrop-blur-xs text-[9px] font-black text-white rounded">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="block text-xs font-bold text-white truncate">{album.name}</span>
                          <span className="block text-[10px] text-[#b3b3b3] truncate">{album.artist}</span>
                          <span className="block text-[10px] text-[#1ed760] font-semibold mt-0.5">
                            {album.plays ? `${album.plays} plays` : "Top Album"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider between months */}
                {monthIdx < availableMonths.length - 1 && (
                  <div className="pt-6">
                    <hr className="border-white/10" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. DESKTOP UI (>= md): Immersive, Widescreen Spotify Desktop Hub      */}
      {/* ===================================================================== */}
      <div className="hidden md:block max-w-5xl mx-auto space-y-10 pb-28 font-sans select-none animate-fadeIn">
        {/* Top Header / Breadcrumb Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} /> Back to Home
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
          >
            <HelpCircle size={15} /> How Sound Capsule Works
          </button>
        </div>

        {/* Hero Banner with Spotify Desktop Glow */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950/50 via-[#181818] to-[#121212] p-8 border border-white/10 shadow-2xl">
          <div className="relative z-10 flex items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#1db954]/20 text-[#1ed760] border border-[#1db954]/30">
                <Sparkles size={13} /> Sound Capsule Archive
              </span>
              <h1 className="text-4xl font-black text-white tracking-tight">Your Sound Capsule</h1>
              <p className="text-sm text-[#b3b3b3] leading-relaxed">
                A chronological acoustic record of your musical evolution. Scroll through each month to explore your top artists, tracks, and most played records.
              </p>
              <p className="text-xs text-[#1ed760] font-medium mt-1">
                Note: For accurate sound capsule statistics, refer to your Spotify app.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center min-w-[130px]">
                <span className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block">Months</span>
                <span className="text-3xl font-black text-white mt-1 block">{availableMonths.length}</span>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center min-w-[140px]">
                <span className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block">Total Listened</span>
                <span className="text-3xl font-black text-[#1ed760] mt-1 block">
                  {Object.values(availableCapsulesMap).reduce((acc, c) => acc + c.minutesListened, 0).toLocaleString()} <span className="text-xs text-[#b3b3b3] font-normal">mins</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Month Quick-Jump Navigation Bar */}
        <div className="sticky top-2 z-20 py-2.5 px-4 bg-[#121212]/90 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2 overflow-x-auto shadow-xl">
          <span className="text-xs font-bold text-[#727272] shrink-0 uppercase tracking-wider pl-1">
            Jump to:
          </span>
          {availableMonths.map((mKey, idx) => {
            const cap = availableCapsulesMap[mKey];
            return (
              <button
                key={`jump-pill-${mKey}`}
                onClick={() => {
                  const el = document.getElementById(`desktop-capsule-${mKey}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  idx === 0
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-[#242424] hover:bg-[#323232] text-[#b3b3b3] hover:text-white border border-white/5"
                }`}
              >
                {cap.monthName} {cap.year}
                {cap.isCurrentMonth ? " Ãƒâ€šÃ‚· Live" : ""}
              </button>
            );
          })}
        </div>

        {/* Chronological Month Sections */}
        <div className="space-y-14">
          {availableMonths.map((monthKey, monthIdx) => {
            const capsule = availableCapsulesMap[monthKey];
            const top3Albums = getTop3Albums(capsule);

            return (
              <section
                key={`desktop-month-${monthKey}`}
                id={`desktop-capsule-${monthKey}`}
                className="scroll-mt-24 space-y-6 pt-2"
              >
                {/* Month Section Header */}
                <div className="flex items-end justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[#1db954]">
                      {capsule.isCurrentMonth ? "CURRENT LIVE MONTH" : "ARCHIVED MONTH"}
                    </span>
                    <h2 className="text-3xl font-black text-white tracking-tight mt-1">
                      {capsule.monthName} <span className="text-[#a7a7a7]">{capsule.year}</span>
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {capsule.isCurrentMonth && (
                      <span className="px-3 py-1 bg-[#1db954]/20 border border-[#1db954]/40 text-[#1db954] text-xs font-bold rounded-full animate-pulse">
                        Live daily stats
                      </span>
                    )}
                    <span className="text-xs text-[#b3b3b3] font-medium">
                      {capsule.minutesListened.toLocaleString()} mins (~{(capsule.minutesListened / 60).toFixed(1)} hrs)
                    </span>
                  </div>
                </div>

                {/* Row 1: Time Listened + Top Artist Spotlight + Top Song Spotlight */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Card 1: Time Listened */}
                  <div
                    onClick={() => setActiveDrilldown({ mode: "time-listened", capsule })}
                    className="p-6 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl cursor-pointer transition-all shadow-xl flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider flex items-center gap-1.5">
                          <Clock size={14} className="text-[#1ed760]" /> Time Listened
                        </span>
                        <ChevronRight size={18} className="text-[#727272] group-hover:text-white transition-colors" />
                      </div>
                      <div className="text-4xl font-black text-[#1ed760] tracking-tight mt-3">
                        {capsule.minutesListened.toLocaleString()}
                      </div>
                      <span className="text-sm font-bold text-white block mt-0.5">minutes streamed</span>
                      <p className="text-xs text-[#727272] mt-2">
                        Approximately {(capsule.minutesListened / 60).toFixed(1)} hours of audio recorded.
                      </p>
                    </div>

                    <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-[#b3b3b3]">Daily average</span>
                      <span className="font-bold text-white">~{(capsule.minutesListened / 30).toFixed(0)} mins / day</span>
                    </div>
                  </div>

                  {/* Card 2: Top Artist Spotlight */}
                  <div
                    onClick={() => setActiveDrilldown({ mode: "top-artists", capsule })}
                    className="p-6 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl cursor-pointer transition-all shadow-xl flex flex-col justify-between group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#509bf5] uppercase tracking-wider flex items-center gap-1.5">
                          <Headphones size={14} /> Top Artist
                        </span>
                        <ChevronRight size={18} className="text-[#727272] group-hover:text-white transition-colors" />
                      </div>
                      <h3 className="text-2xl font-black text-[#509bf5] truncate">
                        {capsule.topArtist.name}
                      </h3>
                      <span className="text-xs text-[#727272] block">
                        {capsule.top5Artists[0]?.plays ? `${capsule.top5Artists[0].plays} streams` : "#1 in rotation"}
                      </span>
                    </div>

                    <div className="my-5 flex items-center justify-center relative">
                      <div className="w-28 h-28 rounded-2xl overflow-hidden bg-[#242424] shadow-2xl border-2 border-white/10 relative">
                        <MusicArtwork item={capsule.topArtist} size="full" />
                      </div>
                      <span className="absolute bottom-0 right-1/4 px-2.5 py-0.5 bg-[#282828] text-white text-[10px] font-bold rounded-full border border-white/10 shadow">
                        New
                      </span>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-[#b3b3b3]">Ranking</span>
                      <span className="font-bold text-[#509bf5] group-hover:underline">Explore Top 5 Artists ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢</span>
                    </div>
                  </div>

                  {/* Card 3: Top Song Spotlight */}
                  <div
                    onClick={() => setActiveDrilldown({ mode: "top-songs", capsule })}
                    className="p-6 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl cursor-pointer transition-all shadow-xl flex flex-col justify-between group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#ffdb58] uppercase tracking-wider flex items-center gap-1.5">
                          <Music2 size={14} /> Top Song
                        </span>
                        <ChevronRight size={18} className="text-[#727272] group-hover:text-white transition-colors" />
                      </div>
                      <h3 className="text-2xl font-black text-[#ffdb58] truncate">
                        {capsule.topSong.name}
                      </h3>
                      <span className="text-xs text-[#727272] truncate block">
                        {capsule.topSong.artist}
                      </span>
                    </div>

                    <div className="my-5 flex items-center justify-center relative">
                      <div className="w-28 h-28 rounded-2xl overflow-hidden bg-[#242424] shadow-2xl border border-white/10 relative">
                        <MusicArtwork item={capsule.topSong} size="full" />
                      </div>
                      <span className="absolute bottom-0 right-1/4 px-2.5 py-0.5 bg-[#282828] text-white text-[10px] font-bold rounded-full border border-white/10 shadow">
                        New
                      </span>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-[#b3b3b3]">Ranking</span>
                      <span className="font-bold text-[#ffdb58] group-hover:underline">Explore Top 5 Songs ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢</span>
                    </div>
                  </div>
                </div>

                {/* Row 2: Top 3 Most Listened Albums */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Disc3 size={18} className="text-[#1db954]" />
                    <h3 className="text-base font-bold text-white">Most Listened Albums</h3>
                    <span className="text-xs text-[#727272]">Ãƒâ€šÃ‚· Top 3 albums on heavy repeat in {capsule.monthName}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {top3Albums.map((album, idx) => (
                      <div
                        key={`desktop-album-${capsule.monthKey}-${album.name}-${idx}`}
                        onClick={() => openSpotifyTrack(album.name, album.artist)}
                        className="p-4 bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl transition-all shadow-lg flex items-center gap-4 group cursor-pointer"
                        title={`Listen to "${album.name}" on Spotify`}
                      >
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#242424] shrink-0 shadow-md">
                          <MusicArtwork item={album} size="full" />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 backdrop-blur-xs text-[10px] font-black text-white rounded">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-white truncate group-hover:text-[#1db954] transition-colors">
                            {album.name}
                          </span>
                          <span className="block text-xs text-[#b3b3b3] truncate mt-0.5">
                            {album.artist}
                          </span>
                          <span className="inline-block mt-2 px-2 py-0.5 bg-white/5 text-[#1ed760] text-[11px] font-semibold rounded-md">
                            {album.plays ? `${album.plays} plays` : "Top Rotation"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Month Divider */}
                {monthIdx < availableMonths.length - 1 && (
                  <hr className="border-white/10 my-10" />
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: SOUND CAPSULE HELP / INFO                                      */}
      {/* ===================================================================== */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[#202020] border border-[#303030] rounded-2xl p-6 text-white space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Sparkles size={18} className="text-[#1db954]" />
              About Sound Capsule
            </h3>
            <p className="text-xs text-[#b3b3b3] leading-relaxed">
              Your Sound Capsule captures your listening habits month by month, highlighting your top artist, top song, listening duration, and most listened albums.
            </p>
            <p className="text-xs text-[#b3b3b3] leading-relaxed">
              Only months with listening data are unlocked. For the active month, your stats automatically refresh once a day.
            </p>
            <p className="text-xs text-[#1db954] font-medium leading-relaxed bg-[#1db954]/10 p-2.5 rounded-lg border border-[#1db954]/20">
              Note: For accurate sound capsule statistics, refer to your Spotify app.
            </p>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-xs rounded-full transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// =========================================================================
// 5. LIBRARY VIEW
// =========================================================================
export function LibraryView({
  account,
  onOpenSourceModal,
}: {
  account: AccountData;
  onOpenSourceModal: (source: "favorites" | "lastfm" | "spotify") => void;
}) {
  const [filter, setFilter] = useState<"all" | "favorites" | "spotify" | "lastfm">("all");

  const favorites = account.music.favorites;
  const spotify = account.music.spotify;
  const lastfm = account.music.lastfm;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-[#b3b3b3]">Manage your 3 connected music streams</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
            filter === "all" ? "bg-white text-black" : "bg-[#282828] text-[#b3b3b3] hover:text-white"
          }`}
        >
          All Sources
        </button>
        <button
          onClick={() => setFilter("favorites")}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
            filter === "favorites"
              ? "bg-white text-black"
              : "bg-[#282828] text-[#b3b3b3] hover:text-white"
          }`}
        >
          Favorites ({favorites.length})
        </button>
        <button
          onClick={() => setFilter("spotify")}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
            filter === "spotify"
              ? "bg-white text-black"
              : "bg-[#282828] text-[#b3b3b3] hover:text-white"
          }`}
        >
          Spotify History
        </button>
        <button
          onClick={() => setFilter("lastfm")}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
            filter === "lastfm"
              ? "bg-white text-black"
              : "bg-[#282828] text-[#b3b3b3] hover:text-white"
          }`}
        >
          Last.fm
        </button>
      </div>

      {/* 3 Main Source Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Favorites Card */}
        {(filter === "all" || filter === "favorites") && (
          <div className="p-5 bg-[#181818] border border-[#282828] rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center mb-3 shadow-lg">
                <Heart size={24} fill="white" />
              </div>
              <h3 className="font-bold text-base text-white">Handpicked Favorites</h3>
              <p className="text-xs text-[#b3b3b3] mt-1">
                {favorites.length} artists, tracks, and albums curated by you.
              </p>
            </div>
            <button
              onClick={() => onOpenSourceModal("favorites")}
              className="w-full py-2.5 text-xs font-bold text-black bg-white hover:bg-white/90 rounded-full transition-all"
            >
              Manage Favorites
            </button>
          </div>
        )}

        {/* Spotify Card */}
        {(filter === "all" || filter === "spotify") && (
          <div className="p-5 bg-[#181818] border border-[#282828] rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#1db954] text-black flex items-center justify-center mb-3 shadow-lg">
                <Disc3 size={24} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white">Spotify Streaming History</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    spotify ? "bg-[#1db954]/20 text-[#1db954]" : "bg-[#282828] text-[#727272]"
                  }`}
                >
                  {spotify ? "Imported" : "Optional"}
                </span>
              </div>
              <p className="text-xs text-[#b3b3b3] mt-1">
                {spotify
                  ? `${spotify.totalPlays.toLocaleString()} plays (${formatDate(spotify.from)} - ${formatDate(spotify.to)})`
                  : "Upload your Spotify privacy JSON export to add your full listening history."}
              </p>
            </div>
            <button
              onClick={() => onOpenSourceModal("spotify")}
              className="w-full py-2.5 text-xs font-bold text-black bg-[#1db954] hover:bg-[#1ed760] rounded-full transition-all"
            >
              {spotify ? "Re-import / Manage" : "Import History"}
            </button>
          </div>
        )}

        {/* Last.fm Card */}
        {(filter === "all" || filter === "lastfm") && (
          <div className="p-5 bg-[#181818] border border-[#282828] rounded-2xl flex flex-col justify-between space-y-4">
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center mb-3 shadow-lg font-serif font-black text-2xl">
                as
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white">Last.fm Scrobbler</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    lastfm ? "bg-[#1db954]/20 text-[#1db954]" : "bg-[#282828] text-[#727272]"
                  }`}
                >
                  {lastfm ? "Connected" : "Optional"}
                </span>
              </div>
              <p className="text-xs text-[#b3b3b3] mt-1">
                {lastfm
                  ? `Connected as @${lastfm.username}. Real-time Now Playing & 5 recent tracks synced.`
                  : "Connect your Last.fm account to sync listening scrobbles in real time."}
              </p>
            </div>
            <button
              onClick={() => onOpenSourceModal("lastfm")}
              className="w-full py-2.5 text-xs font-bold text-white bg-[#282828] hover:bg-[#383838] rounded-full transition-all"
            >
              {lastfm ? "Manage Connection" : "Connect Last.fm"}
            </button>
          </div>
        )}
      </div>

      {/* Last.fm Filtered View Details */}
      {filter === "lastfm" && lastfm && (
        <div className="space-y-6 pt-4 border-t border-[#282828]">
          {/* Now Playing if any */}
          {lastfm.nowPlaying && (
            <div
              onClick={() => openSpotifyTrack(lastfm.nowPlaying!.name, lastfm.nowPlaying!.artist)}
              className="p-4 rounded-xl bg-gradient-to-r from-[#181818] via-[#1db954]/10 to-[#181818] border border-[#1db954]/40 hover:border-[#1db954] flex items-center justify-between cursor-pointer transition-colors"
              title={`Listen to "${lastfm.nowPlaying.name}" on Spotify`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#242424] overflow-hidden shrink-0 shadow">
                  <MusicArtwork item={lastfm.nowPlaying} size="sm" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-[#1db954] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-ping" />
                    Now Playing
                  </span>
                  <p className="text-sm font-bold text-white">{lastfm.nowPlaying.name}</p>
                  <p className="text-xs text-[#b3b3b3]">{lastfm.nowPlaying.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1db954]/15 border border-[#1db954]/40 text-[#1db954]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-ping" />
                <span className="text-[9px] font-black uppercase tracking-wider">LIVE</span>
              </div>
            </div>
          )}

          {/* 5 Recent Tracks */}
          {lastfm.recentTracks && getCombinedTopSongs(account.music).length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">This Month's Top 5 Songs</h2>
              <div className="space-y-1">
                {getCombinedTopSongs(account.music).slice(0, 5).map((track, i) => (
                  <div
                    key={`lib-recent-track-${track.name}-${i}`}
                    onClick={() => openSpotifyTrack(track.name, track.artist)}
                    className="group flex items-center justify-between p-2 rounded-lg hover:bg-[#282828] transition-colors cursor-pointer"
                    title={`Listen to "${track.name}" by ${track.artist} on Spotify`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs text-[#727272] w-5 text-center font-mono group-hover:hidden">{i + 1}</span>
                      <span className="hidden group-hover:flex w-5 items-center justify-center text-[#1db954]">
                        <Disc3 size={13} className="animate-spin" />
                      </span>
                      <MusicArtwork item={track} size="sm" />
                      <div className="min-w-0 pr-4">
                        <span className="block text-xs font-bold text-white group-hover:text-[#1ed760] transition-colors truncate">{track.name}</span>
                        <span className="block text-[11px] text-[#b3b3b3] truncate">{track.artist}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#b3b3b3] shrink-0">
                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-[#1db954] transition-opacity mr-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5 Top Artists */}
          {lastfm.recentArtists && getCombinedTopArtists(account.music).length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">This Month's Top 5 Artists</h2>
              <div className="flex flex-wrap gap-2">
                {getCombinedTopArtists(account.music).slice(0, 5).map((artist, idx) => (
                  <div
                    key={`lib-recent-artist-${artist.name}-${idx}`}
                    onClick={() => openSpotifyArtist(artist.name)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#181818] hover:bg-[#282828] border border-[#282828] hover:border-[#1db954]/50 rounded-full cursor-pointer transition-colors group"
                    title={`Open ${artist.name}'s discography in Spotify`}
                  >
                    <div className="w-5 h-5 rounded-[4px] overflow-hidden bg-[#242424]">
                      <MusicArtwork item={artist} size="sm" />
                    </div>
                    <span className="text-xs font-semibold text-white group-hover:text-[#1ed760] transition-colors">{artist.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Playable Favorites List */}
      {favorites.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-lg font-bold text-white">Your Saved Favorites List</h2>
          <div className="space-y-1">
            {favorites.map((fav, i) => (
              <div
                key={`lib-fav-${fav.name}-${fav.artist || ""}-${i}`}
                onClick={() =>
                  fav.kind === "artist"
                    ? openSpotifyArtist(fav.name)
                    : openSpotifyTrack(fav.name, fav.artist || "")
                }
                className="group flex items-center justify-between p-2 rounded-lg hover:bg-[#282828] transition-colors cursor-pointer"
                title={`Listen to "${fav.name}" on Spotify`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs text-[#727272] w-6 text-center group-hover:hidden">{i + 1}</span>
                  <span className="hidden group-hover:flex w-6 items-center justify-center text-[#1db954]">
                    <Disc3 size={13} className="animate-spin" />
                  </span>
                  <MusicArtwork item={fav} size="sm" />
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-white group-hover:text-[#1ed760] transition-colors truncate">{fav.name}</span>
                    <span className="block text-[11px] text-[#b3b3b3] truncate">
                      {fav.artist || fav.kind}
                    </span>
                  </div>
                </div>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-[#1db954] transition-opacity mr-2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 6. PROFILE VIEW (Coherent with UserCard)
// =========================================================================
export function ProfileView({
  account,
  onOpenEditProfile,
  onOpenPhotoModal,
}: {
  account: AccountData;
  onOpenEditProfile: () => void;
  onOpenPhotoModal: () => void;
  onOpenSourceModal?: (source: "favorites" | "lastfm" | "spotify") => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
}) {
  const profile = account.profile;
  const lastfm = account.music.lastfm;

  const [avatarFailed, setAvatarFailed] = useState(false);

  // Derive top songs / artists from connected data (merged and deduped)
  const topSongs = getCombinedTopSongs(account.music).slice(0, 5);
  const topArtists = getCombinedTopArtists(account.music).slice(0, 5);

  const nowPlaying = lastfm?.nowPlaying || null;

  const topTrackName = topSongs[0]?.name || "Shared Taste";
  const topTrackArtist = topSongs[0]?.artist || "Spotimatch";

  const cardUser: UserProfileModalUser = {
    uid: profile?.uid,
    name: profile?.displayName || "Music Lover",
    username: profile?.username || "listener",
    avatarUrl: profile?.photoURL,
    photoURL: profile?.photoURL,
    bio: profile?.bio,
    vibe: profile?.bio || "Eclectic soundscapes",
    matchScore: 100,
    topSongs,
    topArtists,
    nowPlaying,
    showTopSongs: profile?.showTopSongs,
    showTopArtists: profile?.showTopArtists,
    showNowPlaying: profile?.showNowPlaying,
  };

  return (
    <div className="mx-auto max-w-5xl px-2 py-6">
      <div className="relative w-full bg-[#141414] border border-[#282828] rounded-3xl shadow-2xl overflow-hidden text-white">
        <UserCardContent
          targetUser={cardUser}
          currentUser={profile}
          currentStatus="none"
          isMe={true}
          isBlocked={false}
          busy={false}
          score={100}
          vibe={cardUser.vibe || "Eclectic soundscapes"}
          hasShared={false}
          sharedList={[]}
          topTrackName={topTrackName}
          topTrackArtist={topTrackArtist}
          topSongs={topSongs}
          topArtists={topArtists}
          nowPlaying={nowPlaying}
          resolvedPhoto={profile?.photoURL || ""}
          avatarFailed={avatarFailed}
          setAvatarFailed={setAvatarFailed}
          onOpenPhotoModal={onOpenPhotoModal}
          onOpenEditProfile={onOpenEditProfile}
          isStandalonePage={true}
        />
      </div>
    </div>
  );
}








