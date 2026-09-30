"use client";
import React, { useState, useEffect } from "react";
import {
  X,
  UserPlus,
  Check,
  Clock,
  MessageCircle,
  Sparkles,
  Disc3,
  Heart,
  UserX,
  LoaderCircle,
  Camera,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Radio,
  Music2,
  Mic2,
  ChevronDown,
} from "lucide-react";
import type { FriendStatus, MusicItem, NowPlayingTrack, UserProfile, VisibilityLevel } from "@/types";
import { MusicArtwork } from "@/components/onboarding";
import { openSpotifyTrack, openSpotifyArtist } from "@/lib/spotify-redirect";
import { auth } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/client-api";

export interface UserProfileModalUser {
  forceEditMode?: boolean;
  id?: string;
  uid?: string;
  name: string;
  username: string;
  avatarUrl?: string;
  photoURL?: string;
  bio?: string;
  vibe?: string;
  matchScore?: number;
  sharedArtists?: string[];
  topTrack?: string;
  topTrackArtist?: string;
  status?: FriendStatus;
  /** Legacy */
  showRecentToFriends?: boolean;
  showTopSongs?: VisibilityLevel;
  showTopArtists?: VisibilityLevel;
  showNowPlaying?: VisibilityLevel;
  isBlocked?: boolean;
  topSongs?: MusicItem[];
  topArtists?: MusicItem[];
  nowPlaying?: NowPlayingTrack | null;
  matchReason?: string;
  matchDetail?: string;
}

export interface UserCardContentProps {
  isEditing?: boolean;
  setIsEditing?: (val: boolean) => void;
  onUpdateProfile?: (updated: Partial<import('../types').UserProfile>) => Promise<void>;
  targetUser: UserProfileModalUser;
  currentUser: UserProfile | null;
  currentStatus: FriendStatus;
  isMe: boolean;
  isBlocked: boolean;
  busy: boolean;
  score: number;
  vibe: string;
  hasShared: boolean;
  sharedList: string[];
  topTrackName: string;
  topTrackArtist: string;
  topSongs: MusicItem[];
  topArtists: MusicItem[];
  nowPlaying?: NowPlayingTrack | null;
  resolvedPhoto: string;
  avatarFailed: boolean;
  setAvatarFailed: (val: boolean) => void;
  onOpenPhotoModal?: () => void;
  onSend?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onRemove?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  onOpenChatWithUser?: (user: UserProfileModalUser) => void;
  onOpenEditProfile?: () => void;
  onClose?: () => void;
  isStandalonePage?: boolean;
  horizontalOnDesktop?: boolean;
}

/** Helper: can a viewer see this section? */
function canView(
  visibility: VisibilityLevel | undefined,
  isMe: boolean,
  currentStatus: FriendStatus
): boolean {
  if (isMe) return true;
  const v = visibility ?? "none";
  if (v === "public") return true;
  if (v === "friends") return currentStatus === "friends";
  return false;
}

export function UserCardContent({
  isEditing,
  setIsEditing,
  onUpdateProfile,
  targetUser,
  currentStatus,
  isMe,
  isBlocked,
  busy,
  score,
  vibe,
  hasShared,
  sharedList,
  topTrackName,
  topTrackArtist,
  topSongs,
  topArtists,
  nowPlaying,
  resolvedPhoto,
  avatarFailed,
  setAvatarFailed,
  onOpenPhotoModal,
  onSend,
  onCancel,
  onAccept,
  onRemove,
  onBlock,
  onUnblock,
  onOpenChatWithUser,
  onOpenEditProfile,
  onClose,
  isStandalonePage = false,
  horizontalOnDesktop = false,
}: UserCardContentProps) {
  const [editName, setEditName] = useState(targetUser.name || "");
  const [editUsername, setEditUsername] = useState(targetUser.username || "");
  const [editBio, setEditBio] = useState(targetUser.vibe || targetUser.bio || "");
  const [editShowTopSongs, setEditShowTopSongs] = useState<VisibilityLevel>(targetUser.showTopSongs ?? "none");
  const [editShowTopArtists, setEditShowTopArtists] = useState<VisibilityLevel>(targetUser.showTopArtists ?? "none");
  const [editShowNowPlaying, setEditShowNowPlaying] = useState<VisibilityLevel>(targetUser.showNowPlaying ?? "none");
  const [saving, setSaving] = useState(false);
  const [compatibilityExpanded, setCompatibilityExpanded] = useState(false);

  useEffect(() => {
    setEditName(targetUser.name || "");
    setEditUsername(targetUser.username || "");
    setEditBio(targetUser.vibe || targetUser.bio || "");
    setEditShowTopSongs(targetUser.showTopSongs ?? "none");
    setEditShowTopArtists(targetUser.showTopArtists ?? "none");
    setEditShowNowPlaying(targetUser.showNowPlaying ?? "none");
  }, [targetUser, isEditing]);

  const showTopSongsVis = targetUser.showTopSongs ?? "none";
  const showTopArtistsVis = targetUser.showTopArtists ?? "none";
  const showNowPlayingVis = targetUser.showNowPlaying ?? "none";

  const canSeeSongs = canView(showTopSongsVis, isMe, currentStatus);
  const canSeeArtists = canView(showTopArtistsVis, isMe, currentStatus);
  const canSeeNowPlaying = canView(showNowPlayingVis, isMe, currentStatus);

  
  async function handleSaveProfile() {
    if (!onUpdateProfile || !setIsEditing) return;
    setSaving(true);
    try {
      await onUpdateProfile({
        displayName: editName.trim(),
        username: editUsername.toLowerCase().trim(),
        bio: editBio.trim(),
        showTopSongs: editShowTopSongs,
        showTopArtists: editShowTopArtists,
        showNowPlaying: editShowNowPlaying,
        showRecentToFriends: editShowTopSongs !== 'none' || editShowTopArtists !== 'none'
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const VisibilitySelectComponent = ({ label, value, onChange }: any) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-white">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="shrink-0 bg-[#242424] border border-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1db954] cursor-pointer"
      >
        <option value="none">🔒 Private</option>
        <option value="friends">👥 Friends only</option>
        <option value="public">🌍 Public</option>
      </select>
    </div>
  );

  const visibilityLabel = (v: VisibilityLevel) =>
    v === "public" ? "Public" : v === "friends" ? "Friends only" : "Private";

  return (
    <div>
      {/* Top Cover Banner */}
      <div className={`h-32 bg-gradient-to-r from-emerald-950 via-[#181818] to-purple-950 relative p-4 flex items-start justify-between shrink-0 ${isStandalonePage || horizontalOnDesktop ? "lg:h-24" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-extrabold tracking-wider uppercase text-[#1ed760] flex items-center gap-1.5 shadow">
            <Sparkles size={12} />
            {isMe ? "Your Profile Card" : "Spotimatch Listener"}
          </span>
          {isBlocked && (
            <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black rounded-full">
              Blocked
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isStandalonePage && onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Profile Card Body */}
      <div className={`px-5 pb-6 pt-0 space-y-4 ${isStandalonePage || horizontalOnDesktop ? "lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:px-7 lg:pb-5" : ""}`}>

        {/* â”€â”€ Avatar + Name Row â”€â”€ */}
        <div className={`flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 relative ${isStandalonePage || horizontalOnDesktop ? "lg:col-span-2" : ""}`}>
          {/* Avatar */}
          <div className="relative group shrink-0 w-20 h-20 -mt-10 mx-auto sm:mx-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-[#141414] bg-[#222222] shadow-2xl">
              {resolvedPhoto && !avatarFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedPhoto}
                  alt={targetUser.name}
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-black text-xl text-[#1db954] bg-[#242424]">
                  {(targetUser.name || "U").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            {isMe && onOpenPhotoModal && (
              <button
                type="button"
                onClick={onOpenPhotoModal}
                className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                title="Change profile picture"
              >
                <Camera size={18} />
                <span className="text-[9px] font-bold mt-0.5">Change</span>
              </button>
            )}
          </div>

          {/* Name / username / score */}
          <div className="flex-1 min-w-0 pb-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              {isEditing ? (
    <input
      value={editName}
      onChange={e => setEditName(e.target.value)}
      className="bg-[#242424] border border-[#333] text-white text-lg font-black rounded-lg px-2 py-1 outline-none w-full max-w-[200px]"
    />
  ) : (
    <h2 className="text-lg font-black text-white leading-tight truncate max-w-[180px] sm:max-w-none">
      {targetUser.name}
    </h2>
  )}
              {isMe ? (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-black rounded-full shrink-0">
                  You
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-[#1db954]/20 text-[#1ed760] text-[10px] font-black rounded-full shrink-0">
                  {score}% Match
                </span>
              )}
            </div>
            <span className="text-xs text-[#727272]">@{targetUser.username}</span>
          </div>
        </div>

        {/* â”€â”€ Now Playing â”€â”€ */}
        {(canSeeNowPlaying || isMe) && nowPlaying && (
          <div className="flex items-center gap-3 p-2.5 bg-[#1db954]/10 border border-[#1db954]/30 rounded-xl">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#222]">
                <MusicArtwork item={{ kind: "track", name: nowPlaying.name, artist: nowPlaying.artist }} size="full" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#1db954] rounded-full border-2 border-[#141414] animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Radio size={10} className="text-[#1db954] shrink-0 animate-pulse" />
                <span className="text-[10px] font-bold text-[#1db954] uppercase tracking-wider">Now Playing</span>
              </div>
              <p className="text-xs font-bold text-white truncate">{nowPlaying.name}</p>
              <p className="text-[10px] text-[#b3b3b3] truncate">{nowPlaying.artist}</p>
            </div>
          </div>
        )}

        {/* â”€â”€ Vibe / Bio â”€â”€ */}
        <div className="p-3.5 bg-[#1b1b1b] border border-white/5 rounded-2xl space-y-1.5">
          <span className="text-[10px] font-bold text-[#727272] uppercase tracking-wider block">
            Bio
          </span>
          {isEditing ? (
    <textarea
      value={editBio}
      onChange={e => setEditBio(e.target.value)}
      className="w-full bg-[#242424] border border-[#333] text-xs text-[#e0e0e0] rounded-lg px-2 py-1.5 outline-none resize-none h-16"
    />
  ) : (
    <p className="text-xs text-[#e0e0e0] leading-relaxed">
      {vibe}
    </p>
  )}
        </div>

        {/* Visibility & Privacy Controls (Only in Edit Mode) */}
        {isEditing && (
          <div className="p-3.5 bg-[#1b1b1b] border border-white/5 rounded-2xl space-y-3 animate-fadeIn">
            <span className="text-[10px] font-bold text-[#727272] uppercase tracking-wider block">
              Visibility Settings
            </span>
            <VisibilitySelectComponent
              label="This Month's Top 5 Songs"
              value={editShowTopSongs}
              onChange={(val: VisibilityLevel) => setEditShowTopSongs(val)}
            />
            <VisibilitySelectComponent
              label="This Month's Top 5 Artists"
              value={editShowTopArtists}
              onChange={(val: VisibilityLevel) => setEditShowTopArtists(val)}
            />
            <VisibilitySelectComponent
              label="Now Playing Status"
              value={editShowNowPlaying}
              onChange={(val: VisibilityLevel) => setEditShowNowPlaying(val)}
            />
          </div>
        )}

        {/* â”€â”€ Compatibility (not self) â”€â”€ */}
        {!isMe && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#181818]">
            <button
              type="button"
              onClick={() => setCompatibilityExpanded(value => !value)}
              className="w-full p-4 text-left transition hover:bg-[#1d1d1d]"
              aria-expanded={compatibilityExpanded}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <Heart size={14} className="text-rose-400" /> Taste Compatibility
                </span>
                <span className="flex items-center gap-2 font-extrabold text-[#1ed760]">
                  {score}% Sound Match
                  <ChevronDown size={14} className={`transition-transform ${compatibilityExpanded ? "rotate-180" : ""}`} />
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#242424]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#1db954] to-emerald-400 transition-all duration-500" style={{ width: `${score}%` }} />
              </div>
              {!compatibilityExpanded && <p className="mt-2 text-[10px] text-[#727272]">Tap to see what connects your music taste</p>}
            </button>

            {compatibilityExpanded && (
              <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3 animate-fadeIn">
                <div>
                  <p className="text-xs font-bold text-white">
                    {targetUser.matchReason || (hasShared ? `${sharedList.length} shared artists` : score >= 85 ? "Strong listening overlap" : "Compatible music taste")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#b3b3b3]">
                    {targetUser.matchDetail || (hasShared
                      ? `Your compatibility is supported by shared listening around ${sharedList.slice(0, 3).join(", ")}.`
                      : "Your artist and genre listening patterns produced a compatible overall score.")}
                  </p>
                </div>
                {sharedList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sharedList.map(artist => (
                      <button
                        type="button"
                        key={artist}
                        onClick={() => openSpotifyArtist(artist)}
                        className="rounded-lg border border-white/5 bg-[#222222] px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#2c2c2c] hover:text-[#1db954]"
                        title={`Open ${artist} on Spotify`}
                      >
                        {artist}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] leading-4 text-[#727272]">Calculated from shared artists, genres, tracks, and listening patterns. No generative AI is used.</p>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ This Month's Top Anthem â”€â”€ */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-[#727272] uppercase tracking-wider block">
            This Month's Top Anthem
          </span>
          <div
            onClick={() => openSpotifyTrack(topTrackName, topTrackArtist)}
            className="p-2.5 bg-[#1c1c1c] hover:bg-[#252525] border border-white/5 hover:border-[#1db954]/40 rounded-xl flex items-center justify-between transition-colors cursor-pointer group"
            title={`Listen to "${topTrackName}" by ${topTrackArtist} on Spotify`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#242424] shrink-0 shadow">
                <MusicArtwork item={{ kind: "track", name: topTrackName, artist: topTrackArtist }} size="full" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white group-hover:text-[#1ed760] transition-colors truncate">
                  {topTrackName}
                </span>
                <span className="block text-[11px] text-[#b3b3b3] truncate">{topTrackArtist}</span>
                <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider text-[#1ed760] mt-0.5">
                  Top Listener Track
                </span>
              </div>
            </div>
            <Disc3 size={14} className="text-[#727272] group-hover:text-[#1db954] group-hover:animate-spin mr-2 shrink-0" />
          </div>
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* THIS MONTH'S TOP 5 SECTION                     */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {(canSeeSongs || canSeeArtists || isMe) && (
          <div className={`space-y-3 pt-2 border-t border-[#242424] ${isStandalonePage || horizontalOnDesktop ? "lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0" : ""}`}>
            <span className={`text-[10px] font-bold text-[#727272] uppercase tracking-wider block ${isStandalonePage || horizontalOnDesktop ? "lg:col-span-2" : ""}`}>
              This Month&apos;s Highlights
            </span>

            {/* This Month's Top 5 Songs */}
            {(canSeeSongs || isMe) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Music2 size={12} className="text-[#1db954]" />
                  <span className="text-[10px] font-extrabold text-[#b3b3b3] uppercase tracking-wider">
                    This Month's Top 5 Songs
                  </span>
                </div>
                {topSongs.length > 0 ? (
                  <div className="space-y-1">
                    {topSongs.slice(0, 5).map((track, i) => (
                      <div
                        key={`top-song-${track.name}-${i}`}
                        onClick={() => openSpotifyTrack(track.name, track.artist)}
                        className="group flex items-center gap-2.5 p-2 bg-[#191919] hover:bg-[#252525] border border-white/5 hover:border-[#1db954]/30 rounded-xl transition-colors cursor-pointer"
                        title={`Listen to "${track.name}" on Spotify`}
                      >
                        <span className="text-[10px] font-black text-[#555] w-4 text-center shrink-0">{i + 1}</span>
                        <div className="w-7 h-7 rounded-md overflow-hidden bg-[#242424] shrink-0">
                          <MusicArtwork item={track} size="full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-white group-hover:text-[#1ed760] transition-colors truncate">
                            {track.name}
                          </span>
                          <span className="block text-[10px] text-[#727272] truncate">{track.artist}</span>
                        </div>
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 text-[#1db954] shrink-0 mr-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#181818] border border-white/5 rounded-xl text-center text-[11px] text-[#555]">
                    {isMe ? "Connect Last.fm or Spotify to see your top songs." : "No top songs recorded yet."}
                  </div>
                )}
              </div>
            )}

            {/* This Month's Top 5 Artists */}
            {(canSeeArtists || isMe) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Mic2 size={12} className="text-[#1db954]" />
                  <span className="text-[10px] font-extrabold text-[#b3b3b3] uppercase tracking-wider">
                    This Month's Top 5 Artists
                  </span>
                </div>
                {topArtists.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2">
                    {topArtists.slice(0, 5).map((artist, idx) => (
                      <div
                        key={`top-artist-${artist.name}-${idx}`}
                        onClick={() => openSpotifyArtist(artist.name)}
                        className="group flex flex-col items-center gap-1 cursor-pointer"
                        title={`Open ${artist.name}'s discography`}
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden bg-[#242424] group-hover:ring-2 group-hover:ring-[#1db954] transition-all">
                          <MusicArtwork item={artist} size="full" />
                        </div>
                        <span className="text-[9px] text-[#b3b3b3] group-hover:text-white truncate w-full text-center">
                          {artist.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#181818] border border-white/5 rounded-xl text-center text-[11px] text-[#555]">
                    {isMe ? "Connect Last.fm or Spotify to see your top artists." : "No top artists recorded yet."}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

        {/* â”€â”€ Action Buttons Bar â”€â”€ */}
        <div className={`pt-2 border-t border-[#242424] ${isStandalonePage || horizontalOnDesktop ? "mx-5 mb-5 lg:mx-7" : ""}`}>
          {isMe ? (
            isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveProfile}
                  className="flex-1 py-2.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsEditing?.(false)}
                  className="px-4 py-2.5 text-xs font-bold bg-[#282828] hover:bg-[#333] text-white rounded-full transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing ? setIsEditing(true) : onOpenEditProfile?.()}
                className="w-full py-2.5 text-xs font-bold bg-[#282828] hover:bg-[#333] text-white rounded-full transition-colors cursor-pointer"
              >
                Edit profile
              </button>
            )
          ) : isBlocked ? (
            <button
              disabled={busy}
              onClick={onUnblock}
              className="w-full py-2.5 text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>Unblock Listener</span>
            </button>
          ) : currentStatus === "friends" ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 py-2 px-3 bg-[#1db954]/15 border border-[#1db954]/30 rounded-full text-xs font-bold text-[#1ed760] flex items-center justify-center gap-1.5">
                <Check size={14} /> Friends
              </div>
              {onOpenChatWithUser && (
                <button
                  onClick={() => {
                    if (onClose) onClose();
                    onOpenChatWithUser(targetUser);
                  }}
                  className="flex-1 py-2 px-3 bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <MessageCircle size={14} /> Chat
                </button>
              )}
              <button
                disabled={busy}
                onClick={onRemove}
                className="px-3 py-2 text-xs font-semibold text-[#727272] hover:text-rose-400 transition-colors cursor-pointer"
                title="Remove friend"
              >
                Remove
              </button>
              <button
                disabled={busy}
                onClick={onBlock}
                className="px-2.5 py-2 text-xs font-semibold text-[#727272] hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
                title="Block this user"
              >
                <UserX size={13} />
                <span className="hidden sm:inline">Block</span>
              </button>
            </div>
          ) : currentStatus === "pending_sent" ? (
            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={onCancel}
                className="flex-1 py-2.5 text-xs font-bold bg-[#242424] hover:bg-rose-950/40 text-[#b3b3b3] hover:text-rose-300 border border-white/10 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Clock size={14} />}
                <span>Request Sent - Cancel</span>
              </button>
              <button
                disabled={busy}
                onClick={onBlock}
                className="px-3 py-2 text-xs font-semibold text-[#727272] hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
                title="Block this user"
              >
                <UserX size={13} />
                <span>Block</span>
              </button>
            </div>
          ) : currentStatus === "pending_received" ? (
            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={onAccept}
                className="flex-1 py-2.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Accept Friend Request</span>
              </button>
              <button
                disabled={busy}
                onClick={onCancel}
                className="px-3 py-2.5 text-xs font-bold bg-[#242424] hover:bg-[#303030] text-[#b3b3b3] rounded-full transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button
                disabled={busy}
                onClick={onBlock}
                className="p-2.5 text-xs font-semibold text-[#727272] hover:text-rose-400 transition-colors cursor-pointer"
                title="Block this user"
              >
                <UserX size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                disabled={busy}
                onClick={onSend}
                className="flex-1 py-3 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all shadow-xl hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {busy ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <>
                    <UserPlus size={15} />
                    <span>Send Friend Request</span>
                  </>
                )}
              </button>
              <button
                disabled={busy}
                onClick={onBlock}
                className="px-3.5 py-3 text-xs font-semibold text-[#727272] hover:text-rose-400 border border-transparent hover:border-rose-500/30 rounded-full transition-all cursor-pointer flex items-center gap-1"
                title="Block this user"
              >
                <UserX size={14} />
                <span>Block</span>
              </button>
            </div>
          )}
        </div>

    </div>
  );
}

interface UserProfileModalProps {
  initialEditMode?: boolean;
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfileModalUser | null;
  currentUser: UserProfile | null;
  onSendFriendRequest: (user: UserProfileModalUser) => Promise<void>;
  onAcceptRequest: (requestId: string, fromUserId: string) => Promise<void>;
  onCancelRequest: (targetId: string) => Promise<void>;
  onRemoveFriend: (friendId: string, name: string) => Promise<void>;
  onBlockUser?: (user: UserProfileModalUser) => Promise<void>;
  onUnblockUser?: (userId: string) => Promise<void>;
  onOpenChatWithUser?: (user: UserProfileModalUser) => void;
  onOpenEditProfile?: () => void;
  onOpenPhotoModal?: () => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => Promise<void>;
}

export function UserProfileModal({
  isOpen,
  onClose,
  targetUser,
  initialEditMode = false,
  currentUser,
  onSendFriendRequest,
  onAcceptRequest,
  onCancelRequest,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onOpenChatWithUser,
  onOpenEditProfile,
  onOpenPhotoModal,
    onUpdateProfile,
  }: UserProfileModalProps) {
  const [currentStatus, setCurrentStatus] = useState<FriendStatus>("none");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Top music data for target user
  const [topSongs, setTopSongs] = useState<MusicItem[]>([]);
  const [topArtists, setTopArtists] = useState<MusicItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(null);
  const [targetVis, setTargetVis] = useState<{showTopSongs?: VisibilityLevel; showTopArtists?: VisibilityLevel; showNowPlaying?: VisibilityLevel;}>({});
    const [isEditing, setIsEditing] = useState(initialEditMode || (targetUser?.forceEditMode ?? false));

  const resolvedUserId = targetUser?.id || targetUser?.uid || "";
  const resolvedPhoto = targetUser?.avatarUrl || targetUser?.photoURL || "";
  const isMe = Boolean(
    currentUser &&
      ((resolvedUserId && resolvedUserId === currentUser.uid) ||
        (targetUser?.username &&
          targetUser.username.toLowerCase().trim() === currentUser.username.toLowerCase().trim()))
  );

  useEffect(() => {
    if (!targetUser) return;
    setCurrentStatus(targetUser.status || "none");
    setAvatarFailed(false);
    setIsBlocked(Boolean(targetUser.isBlocked || currentUser?.blockedUserIds?.includes(resolvedUserId)));

    // Init from targetUser data
    setTopSongs(targetUser.topSongs || []);
    setTopArtists(targetUser.topArtists || []);
    setNowPlaying(targetUser.nowPlaying || null);
    setTargetVis({
      showTopSongs: targetUser.showTopSongs,
      showTopArtists: targetUser.showTopArtists,
      showNowPlaying: targetUser.showNowPlaying,
    });

    let active = true;
    async function loadPublicData() {
      if (!resolvedUserId && !targetUser?.username) return;
      try {
        const query = resolvedUserId
          ? `uid=${encodeURIComponent(resolvedUserId)}`
          : `username=${encodeURIComponent(targetUser?.username || "")}`;
        const res = await authenticatedFetch(`/api/account?${query}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          if (Array.isArray(data.music?.topSongs)) setTopSongs(data.music.topSongs);
          if (Array.isArray(data.music?.topArtists)) setTopArtists(data.music.topArtists);
          if (data.music?.lastfm?.nowPlaying) setNowPlaying(data.music.lastfm.nowPlaying);
          if (data.music?.showTopSongs || data.profile?.showTopSongs) {
            setTargetVis({
              showTopSongs: data.music?.showTopSongs ?? data.profile?.showTopSongs,
              showTopArtists: data.music?.showTopArtists ?? data.profile?.showTopArtists,
              showNowPlaying: data.music?.showNowPlaying ?? data.profile?.showNowPlaying,
            });
          }
        }
      } catch {}
    }

    void loadPublicData();
    return () => { active = false; };
  }, [targetUser, resolvedUserId, currentUser, isMe]);

  if (!isOpen || !targetUser) return null;

  const score = targetUser.matchScore || 92;
  const vibe = targetUser.vibe || targetUser.bio || "Eclectic Listener · Exploring alternative and indie tracks";
  const hasShared = Boolean(targetUser.sharedArtists && targetUser.sharedArtists.length > 0);
  const sharedList = hasShared ? targetUser.sharedArtists! : topArtists.map(a => a.name).slice(0, 4);
  const topTrackFromSongs = topSongs[0];
  const topTrackName =
    targetUser.topTrack ||
    topTrackFromSongs?.name ||
    (sharedList[0] ? `Top ${sharedList[0]} Track` : "Shared Taste");
  const topTrackArtist =
    targetUser.topTrackArtist || topTrackFromSongs?.artist || sharedList[0] || "Spotimatch";

  // Merge visibility: self uses profile settings, others use what API returned
  const mergedUser: UserProfileModalUser = {
    ...targetUser,
    showTopSongs: isMe ? (currentUser?.showTopSongs ?? "none") : (targetVis.showTopSongs ?? targetUser.showTopSongs),
    showTopArtists: isMe ? (currentUser?.showTopArtists ?? "none") : (targetVis.showTopArtists ?? targetUser.showTopArtists),
    showNowPlaying: isMe ? (currentUser?.showNowPlaying ?? "none") : (targetVis.showNowPlaying ?? targetUser.showNowPlaying),
  };

  async function handleSend() {
    if (!targetUser) return;
    setBusy(true);
    try { await onSendFriendRequest(targetUser); setCurrentStatus("pending_sent"); }
    finally { setBusy(false); }
  }
  async function handleCancel() {
    if (!resolvedUserId) return;
    setBusy(true);
    try { await onCancelRequest(resolvedUserId); setCurrentStatus("none"); }
    finally { setBusy(false); }
  }
  async function handleAccept() {
    if (!resolvedUserId) return;
    setBusy(true);
    try { await onAcceptRequest(`req-${resolvedUserId}`, resolvedUserId); setCurrentStatus("friends"); }
    finally { setBusy(false); }
  }
  async function handleRemove() {
    if (!resolvedUserId || !targetUser) return;
    if (!window.confirm(`Remove ${targetUser.name} from your friends?`)) return;
    setBusy(true);
    try { await onRemoveFriend(resolvedUserId, targetUser.name); setCurrentStatus("none"); }
    finally { setBusy(false); }
  }
  async function handleBlock() {
    if (!targetUser) return;
    if (!window.confirm(`Block ${targetUser.name || "this user"}? They won't be able to message you or see you in matches.`)) return;
    setBusy(true);
    try { if (onBlockUser) await onBlockUser(targetUser); setIsBlocked(true); setCurrentStatus("none"); }
    finally { setBusy(false); }
  }
  async function handleUnblock() {
    if (!resolvedUserId) return;
    setBusy(true);
    try { if (onUnblockUser) await onUnblockUser(resolvedUserId); setIsBlocked(false); }
    finally { setBusy(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg lg:max-w-5xl bg-[#141414] border border-[#282828] rounded-3xl shadow-2xl overflow-hidden text-white animate-scaleIn max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <UserCardContent
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onUpdateProfile={onUpdateProfile}
            targetUser={mergedUser}
          currentUser={currentUser}
          currentStatus={currentStatus}
          isMe={isMe}
          isBlocked={isBlocked}
          busy={busy}
          score={score}
          vibe={vibe}
          hasShared={hasShared}
          sharedList={sharedList}
          topTrackName={topTrackName}
          topTrackArtist={topTrackArtist}
          topSongs={topSongs}
          topArtists={topArtists}
          nowPlaying={nowPlaying}
          resolvedPhoto={resolvedPhoto}
          avatarFailed={avatarFailed}
          setAvatarFailed={setAvatarFailed}
          onOpenPhotoModal={onOpenPhotoModal}
          onSend={handleSend}
          onCancel={handleCancel}
          onAccept={handleAccept}
          onRemove={handleRemove}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onOpenChatWithUser={onOpenChatWithUser}
          onOpenEditProfile={onOpenEditProfile}
          onClose={onClose}
          isStandalonePage={false}
          horizontalOnDesktop={true}
        />
      </div>
    </div>
  );
}


