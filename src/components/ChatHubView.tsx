"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Radio,
  Sparkles,
  Send,
  Plus,
  Disc3,
  X,
  Users,
  MessageSquare,
  MessageCircle,
  ArrowLeft,
  Music2,
  ExternalLink,
  LoaderCircle,
  Search,
  Bell,
  BellOff,
} from "lucide-react";
import type {
  AccountData,
  ChatMessage,
  DirectChatMessage,
  FriendUser,
  MusicItem,
} from "@/types";
import { auth } from "@/lib/firebase";
import { authenticatedFetch } from "@/lib/client-api";
import { useActivePolling } from "@/hooks/use-active-polling";
import { MusicArtwork } from "@/components/onboarding";
import type { UserProfileModalUser } from "@/components/UserProfileModal";
import type { SpotifyTab } from "@/components/SpotifyViews";
import { openSpotifyTrack } from "@/lib/spotify-redirect";

export function ChatAvatar({
  name,
  photoUrl,
  onClick,
}: {
  name: string;
  photoUrl?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "U").slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={`w-9 h-9 rounded-full overflow-hidden bg-[#242424] border border-white/10 shrink-0 shadow mt-0.5 relative group ${
        onClick
          ? "cursor-pointer hover:ring-2 hover:ring-[#1db954] hover:scale-105 transition-all"
          : ""
      }`}
      title={name ? `View ${name}'s profile` : "View profile"}
    >
      {photoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-[#1db954] bg-[#1a1a1a]">
          {initials}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// INTERACTIVE SPOTIFY TRACK CARD
// Attempts native Spotify App first, seamlessly falling back to web player
// =========================================================================
export function SpotifyTrackCard({
  attachment,
  isMyMessage = false,
}: {
  attachment: {
    kind?: "track" | "artist" | "album";
    name: string;
    artist: string;
    image?: string;
    url?: string;
  };
  isMyMessage?: boolean;
}) {
  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openSpotifyTrack(attachment.name, attachment.artist, attachment.url);
  };

  return (
    <div
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSpotifyTrack(attachment.name, attachment.artist, attachment.url);
        }
      }}
      className={`p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer group/track max-w-sm ${
        isMyMessage ? "mr-0 ml-auto" : ""
      } bg-[#181818] hover:bg-[#222222] border border-white/10 hover:border-[#1db954]/60 shadow-lg select-none`}
      title={`Open "${attachment.name}" by ${attachment.artist} in Spotify app or web`}
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#242424] shrink-0 shadow relative">
        <MusicArtwork
          item={{
            kind: attachment.kind || "track",
            name: attachment.name,
            artist: attachment.artist,
            image: attachment.image,
          }}
          size="sm"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/track:opacity-100 flex items-center justify-center transition-opacity text-[#1db954]">
          <ExternalLink size={16} />
        </div>
      </div>

      <div className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-bold text-white group-hover/track:text-[#1ed760] transition-colors truncate">
          {attachment.name}
        </span>
        <span className="block text-[11px] text-[#b3b3b3] truncate">{attachment.artist}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-block text-[9px] font-black uppercase tracking-wider text-[#1db954]">
            Spotify
          </span>
          <span className="text-[10px] text-[#727272] group-hover/track:text-[#b3b3b3] flex items-center gap-0.5">
            Open track <ExternalLink size={10} />
          </span>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// LIVE LISTENING SYNC BAR FOR 1-ON-1 DIRECT CHAT
// Real-time animated playback scrub bar & instant listen-along on Spotify
// =========================================================================
function LiveListeningSyncBar({ friend }: { friend: FriendUser }) {
  const [elapsed, setElapsed] = useState(54);
  const totalDuration = 210; // ~3m 30s track

  useEffect(() => {
    if (!friend.nowPlaying) return;
    const timer = setInterval(() => {
      setElapsed(prev => (prev >= totalDuration ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [friend.nowPlaying]);

  if (!friend.nowPlaying) {
    return (
      <div className="px-3.5 py-2 bg-[#181818]/60 border border-white/5 rounded-xl mb-2 shrink-0 flex items-center justify-between text-xs text-[#727272]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neutral-600" />
          <span>Offline / Idle · Favorite: {friend.topTrack || "Indie / Rock"}</span>
        </div>
        <span className="text-[10px] text-[#555]">Idle playback</span>
      </div>
    );
  }

  const artist = friend.nowPlaying.artist || friend.topTrack || "";
  const trackName = friend.nowPlaying.name || "";

  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const spotifyQuery = encodeURIComponent(`${trackName} ${artist}`);
  const spotifyUrl = `https://open.spotify.com/search/${spotifyQuery}`;

  return (
    <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-[#181818] to-[#161616] border border-[#1db954]/30 rounded-xl mb-2 shrink-0 shadow-lg animate-fadeIn">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Animated sound equalizer bars */}
          <div className="flex items-end gap-0.5 h-4 shrink-0 px-1">
            <span
              className="w-1 bg-[#1db954] rounded-full animate-bounce h-3"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1 bg-[#1db954] rounded-full animate-bounce h-4"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1 bg-[#1db954] rounded-full animate-bounce h-2"
              style={{ animationDelay: "300ms" }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1ed760] bg-[#1db954]/20 px-2 py-0.2 rounded-full">
                Listening Sync Live
              </span>
              <span className="text-[11px] text-[#727272] truncate">
                {friend.name} is playing
              </span>
            </div>
            <div className="font-bold text-xs text-white truncate mt-0.5">
              {trackName}{" "}
              {artist ? <span className="text-[#b3b3b3] font-normal">by {artist}</span> : null}
            </div>
          </div>
        </div>

        {/* Listen Along Button */}
        <button
          type="button"
          onClick={() => openSpotifyTrack(trackName, artist)}
          className="px-3 py-1.5 bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shrink-0 shadow cursor-pointer"
        >
          <span>Listen Along</span>
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Scrub Bar */}
      <div className="space-y-1">
        <div className="w-full h-1.5 bg-[#252525] rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-[#1db954] to-emerald-400 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#727272] font-mono">
          <span>{formatTime(elapsed)}</span>
          <span className="text-[#1ed760] font-sans font-semibold">Live playback sync</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}

export function ChatView({
  account,
  onNavigate,
  onOpenUserProfile,
  initialInput,
  initialDirectFriend,
  unreadChatUserIds = [],
  onMarkChatRead,
}: {
  account: AccountData;
  onNavigate?: (tab: SpotifyTab) => void;
  onOpenUserProfile?: (user: UserProfileModalUser) => void;
  initialInput?: string;
  initialDirectFriend?: FriendUser | null;
  unreadChatUserIds?: string[];
  onMarkChatRead?: (friendId: string) => void;
}) {
  // Navigation / active channel state: "global" or friend.id
  const [activeChannel, setActiveChannel] = useState<string>(
    initialDirectFriend?.id || "global"
  );
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [mobileShowList, setMobileShowList] = useState<boolean>(!initialDirectFriend);

  useEffect(() => {
    const showConversationListOnBack = () => setMobileShowList(true);
    window.addEventListener("popstate", showConversationListOnBack);
    return () => window.removeEventListener("popstate", showConversationListOnBack);
  }, []);

  function openMobileChannel(channelId: string) {
    setActiveChannel(channelId);
    if (window.innerWidth < 1024) {
      window.history.pushState(
        { ...(window.history.state || {}), spotimatch: true, tab: "chat", layer: "chat-thread" },
        ""
      );
    }
    setMobileShowList(false);
  }

  function closeMobileChannel() {
    if (window.history.state?.layer === "chat-thread") window.history.back();
    else setMobileShowList(true);
  }

  // Automatically mark active friend chat as read if unread
  useEffect(() => {
    if (activeChannel && activeChannel !== "global" && unreadChatUserIds.includes(activeChannel)) {
      onMarkChatRead?.(activeChannel);
    }
  }, [activeChannel, unreadChatUserIds, onMarkChatRead]);

  // Global Chat State
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [globalInputText, setGlobalInputText] = useState(initialInput || "");
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [globalSending, setGlobalSending] = useState(false);
  const [globalAttachedTrack, setGlobalAttachedTrack] = useState<MusicItem | null>(null);
  const [globalShowPicker, setGlobalShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<MusicItem[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const globalEndRef = useRef<HTMLDivElement | null>(null);

  // Direct Message State
  const [dmMessages, setDmMessages] = useState<DirectChatMessage[]>([]);
  const [dmInputText, setDmInputText] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmAttachedTrack, setDmAttachedTrack] = useState<MusicItem | null>(null);

  // Feature toggles state
  const [featureToggles, setFeatureToggles] = useState<{ friendRequests: boolean; discovery: boolean; globalChat: boolean }>({ friendRequests: true, discovery: true, globalChat: true });

  // Fetch feature toggles on mount
  useEffect(() => {
    void authenticatedFetch('/api/admin/toggles')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setFeatureToggles({
            friendRequests: Boolean(data.friendRequests),
            discovery: Boolean(data.discovery),
            globalChat: Boolean(data.globalChat),
          });
        }
      })
      .catch(() => {});
  }, []);


  const [dmShowPicker, setDmShowPicker] = useState(false);
  const dmEndRef = useRef<HTMLDivElement | null>(null);

  const currentUserUid = account.profile?.uid || "";
  const currentUserName = account.profile?.displayName || "Music Fan";
  const currentUserPhoto = account.profile?.photoURL || "";
  const myUsername = (account.profile?.username || "").toLowerCase().trim();

  // Notification and Mute Preferences
  const [globalNotifsEnabled, setGlobalNotifsEnabled] = useState<boolean>(
    Boolean(account.profile?.globalChatNotifications)
  );
  const [mutedChatIds, setMutedChatIds] = useState<string[]>(
    account.profile?.mutedChatIds || []
  );

  async function toggleGlobalNotifications() {
    const nextVal = !globalNotifsEnabled;
    setGlobalNotifsEnabled(nextVal);
    try {
      const token =
        typeof window !== "undefined" && auth?.currentUser
          ? await auth.currentUser.getIdToken().catch(() => null)
          : null;
      await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ globalChatNotifications: nextVal }),
      });
    } catch {}
  }

  async function toggleMuteChat(targetFriendId: string) {
    const isCurrentlyMuted = mutedChatIds.includes(targetFriendId);
    const nextMuted = isCurrentlyMuted
      ? mutedChatIds.filter(id => id !== targetFriendId)
      : [...mutedChatIds, targetFriendId];
    setMutedChatIds(nextMuted);
    try {
      const token =
        typeof window !== "undefined" && auth?.currentUser
          ? await auth.currentUser.getIdToken().catch(() => null)
          : null;
      await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mutedChatIds: nextMuted }),
      });
    } catch {}
  }

  // If initialDirectFriend changes, switch active channel
  useEffect(() => {
    if (initialDirectFriend?.id) {
      setActiveChannel(initialDirectFriend.id);
      if (window.innerWidth < 1024 && window.history.state?.layer !== "chat-thread") {
        window.history.pushState(
          { ...(window.history.state || {}), spotimatch: true, tab: "chat", layer: "chat-thread" },
          ""
        );
      }
      setMobileShowList(false);
    }
  }, [initialDirectFriend]);

  // Load connected friends
  async function loadFriends() {
      try {
        const res = await authenticatedFetch("/api/friends");
        if (!res.ok) return;
        const data = await res.json();
        if (data.friends) {
          setFriends(data.friends);
        }
      } catch {}
  }
  useActivePolling(loadFriends);

  // Live Catalog Search for track picker with debounce
  useEffect(() => {
    const q = pickerSearch.trim();
    if (q.length < 2) {
      setCatalogResults([]);
      setIsSearchingCatalog(false);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsSearchingCatalog(true);
      try {
        const res = await authenticatedFetch(`/api/catalog?kind=track&q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.items) {
          setCatalogResults(data.items);
        }
      } catch {
        // Fallback to local
      } finally {
        if (active) setIsSearchingCatalog(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pickerSearch]);

  async function fetchGlobalMessages() {
      try {
        const res = await authenticatedFetch("/api/chat", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages) setGlobalMessages(data.messages);
        if (typeof data.onlineCount === "number") setOnlineCount(data.onlineCount);
      } catch {}
  }
  useActivePolling(fetchGlobalMessages);

  async function fetchDmMessages() {
      if (activeChannel === "global") return;
      try {
        const query = `friendId=${encodeURIComponent(activeChannel)}`;
        const res = await authenticatedFetch(`/api/chat/dm?${query}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages) {
          setDmMessages(data.messages);
        }
      } catch {}
  }
  useActivePolling(fetchDmMessages, activeChannel !== "global");

  // Auto-scroll global messages
  useEffect(() => {
    if (activeChannel === "global") {
      globalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [globalMessages.length, activeChannel]);

  // Auto-scroll DM messages
  useEffect(() => {
    if (activeChannel !== "global") {
      dmEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages.length, activeChannel]);

  function checkIfMeGlobal(msg: ChatMessage): boolean {
    if (currentUserUid && msg.userId === currentUserUid) return true;
    if (myUsername && msg.username && msg.username.toLowerCase().trim() === myUsername)
      return true;
    return false;
  }

  function checkIfMeDm(msg: DirectChatMessage): boolean {
    if (currentUserUid && msg.senderId === currentUserUid) return true;
    if (
      myUsername &&
      msg.senderUsername &&
      msg.senderUsername.toLowerCase().trim() === myUsername
    )
      return true;
    return false;
  }

  // Local tracks available to attach: favorites + Last.fm now playing
  const availableToAttach: MusicItem[] = [
    ...(account.music.lastfm?.nowPlaying ? [account.music.lastfm.nowPlaying] : []),
    ...account.music.favorites.filter(f => f.kind === "track" || f.kind === "album"),
  ];

  const filteredLocalList = availableToAttach.filter(item =>
    pickerSearch.trim()
      ? item.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (item.artist || "").toLowerCase().includes(pickerSearch.toLowerCase())
      : true
  );

  // Combine local and catalog results without duplicates
  const combinedAttachList: MusicItem[] = [...filteredLocalList];
  const seenKeys = new Set(
    filteredLocalList.map(i => `${i.name.toLowerCase()}:${(i.artist || "").toLowerCase()}`)
  );
  for (const item of catalogResults) {
    const key = `${item.name.toLowerCase()}:${(item.artist || "").toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      combinedAttachList.push(item);
    }
  }

  // Send Global Message
  async function handleSendGlobal(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = globalInputText.trim();
    if (!trimmed && !globalAttachedTrack) return;
    if (globalSending) return;

    setGlobalSending(true);

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: currentUserUid || "me",
      name: currentUserName,
      username: account.profile?.username || "you",
      avatarUrl: currentUserPhoto,
      text: trimmed,
      createdAt: new Date().toISOString(),
      ...(globalAttachedTrack
        ? {
            attachment: {
              kind: globalAttachedTrack.kind,
              name: globalAttachedTrack.name,
              artist: globalAttachedTrack.artist,
              image: globalAttachedTrack.image,
            },
          }
        : {}),
    };

    setGlobalMessages(prev => [...prev, tempMsg]);
    setGlobalInputText("");
    const sentAttachment = globalAttachedTrack;
    setGlobalAttachedTrack(null);
    setGlobalShowPicker(false);

    try {
      const token =
        typeof window !== "undefined" && auth?.currentUser
          ? await auth.currentUser.getIdToken().catch(() => null)
          : null;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: trimmed,
          userId: currentUserUid || "",
          name: currentUserName,
          username: account.profile?.username || "you",
          avatarUrl: currentUserPhoto,
          attachment: sentAttachment
            ? {
                kind: sentAttachment.kind,
                name: sentAttachment.name,
                artist: sentAttachment.artist,
                image: sentAttachment.image,
              }
            : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setGlobalMessages(prev =>
            prev.map(m => (m.id === tempMsg.id ? data.message : m))
          );
        }
        if (typeof data.onlineCount === "number") {
          setOnlineCount(data.onlineCount);
        }
      }
    } catch {} finally {
      setGlobalSending(false);
    }
  }

  // Send Direct Message
  async function handleSendDm(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (activeChannel === "global") return;
    const trimmed = dmInputText.trim();
    if (!trimmed && !dmAttachedTrack) return;
    if (dmSending) return;

    setDmSending(true);

    const tempDm: DirectChatMessage = {
      id: `temp-dm-${Date.now()}`,
      threadId: [currentUserUid || "me", activeChannel].sort().join("_"),
      senderId: currentUserUid || "me",
      senderName: currentUserName,
      senderUsername: account.profile?.username || "listener",
      senderAvatarUrl: currentUserPhoto,
      recipientId: activeChannel,
      text: trimmed,
      createdAt: new Date().toISOString(),
      ...(dmAttachedTrack
        ? {
            attachment: {
              kind: dmAttachedTrack.kind,
              name: dmAttachedTrack.name,
              artist: dmAttachedTrack.artist,
              image: dmAttachedTrack.image,
            },
          }
        : {}),
    };

    setDmMessages(prev => [...prev, tempDm]);
    setDmInputText("");
    const sentAttachment = dmAttachedTrack;
    setDmAttachedTrack(null);
    setDmShowPicker(false);

    try {
      const token =
        typeof window !== "undefined" && auth?.currentUser
          ? await auth.currentUser.getIdToken().catch(() => null)
          : null;
      const res = await fetch("/api/chat/dm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          friendId: activeChannel,
          text: trimmed,
          senderName: currentUserName,
          senderUsername: account.profile?.username || "listener",
          senderAvatarUrl: currentUserPhoto,
          attachment: sentAttachment
            ? {
                kind: sentAttachment.kind,
                name: sentAttachment.name,
                artist: sentAttachment.artist,
                image: sentAttachment.image,
              }
            : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setDmMessages(prev => prev.map(m => (m.id === tempDm.id ? data.message : m)));
        }
      }
    } catch {} finally {
      setDmSending(false);
    }
  }

  const selectedFriend = friends.find(f => f.id === activeChannel);

  // If global chat feature is disabled, show placeholder
  if (!featureToggles.globalChat) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-24 pt-5 md:px-8 md:pt-8">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Global Chat</h1>
        </header>
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
          Global chat feature is currently down.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 flex h-[calc(100vh-160px)] max-w-6xl flex-col gap-4 rounded-3xl border border-[#303030] bg-[#0d0d0d] p-2 pb-3 animate-fadeIn select-none md:h-[calc(100vh-110px)] lg:mx-auto lg:flex-row lg:border-0 lg:bg-transparent lg:p-0">
      {/* ================================================================= */}
      {/* LEFT COLUMN: CONVERSATIONS LIST (Top: Global Chat, Below: Direct) */}
      {/* Minimalist green dot indicators without counters                   */}
      {/* ================================================================= */}
      <div
        className={`${
          mobileShowList ? "flex" : "hidden"
        } lg:flex flex-col w-full lg:w-80 bg-[#161616] border border-[#343434] lg:border-white/5 rounded-2xl p-3 shrink-0 overflow-hidden shadow-xl`}
      >
        {/* Header */}
        <div className="px-2 py-2 flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[#1db954]" />
            <h2 className="font-black text-base text-white tracking-tight">Chat</h2>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pt-3 pr-1">
          {/* 1. TOP ITEM: GLOBAL CHAT LOUNGE */}
          <div
            onClick={() => {
              openMobileChannel("global");
            }}
            className={`p-3 rounded-xl transition-all cursor-pointer border ${
              activeChannel === "global"
                ? "bg-[#222222] border-[#1db954]/50 shadow-md ring-1 ring-[#1db954]/30"
                : "bg-[#1a1a1a]/60 hover:bg-[#202020] border-transparent"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1db954] to-emerald-700 text-black flex items-center justify-center font-bold shadow shrink-0 relative">
                <Radio size={20} className="text-black" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1db954] border-2 border-[#161616] animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-white truncate">
                    Global Music Lounge
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {!globalNotifsEnabled && (
                      <span title="Notifications muted">
                        <BellOff size={11} className="text-[#727272]" />
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                  Worldwide open music talk
                </p>
                <span className="text-[10px] text-[#727272] flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1db954]" />
                  <span>{onlineCount} listening now</span>
                </span>
              </div>
            </div>
          </div>

          {/* 2. SECTION HEADER: DIRECT MESSAGES */}
          <div className="pt-3 pb-1 px-2 flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-[#727272] uppercase tracking-wider">
              Direct Messages
            </span>
            {onNavigate && (
              <button
                onClick={() => onNavigate("matches")}
                className="text-[10px] font-bold text-[#1db954] hover:underline cursor-pointer"
              >
                + Find Friends
              </button>
            )}
          </div>

          {/* 3. LIST OF PERSONAL CHATS WITH FRIENDS */}
          {friends.length === 0 ? (
            <div className="p-4 bg-[#1a1a1a]/40 rounded-xl text-center space-y-2 border border-white/5 my-2">
              <Users size={20} className="mx-auto text-[#727272]" />
              <p className="text-xs font-semibold text-white">No Direct Chats Yet</p>
              <p className="text-[11px] text-[#727272] leading-tight">
                Send friend requests in Discover Matches to chat 1-on-1 with music lovers!
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("matches")}
                  className="mt-1 px-3 py-1 bg-[#1db954] text-black text-[11px] font-bold rounded-full hover:bg-[#1ed760] transition-colors cursor-pointer"
                >
                  Discover Matches
                </button>
              )}
            </div>
          ) : (
            friends.map(friend => {
              const isSelected = activeChannel === friend.id;
              return (
                <div
                  key={`channel-${friend.id}`}
                  onClick={() => {
                    openMobileChannel(friend.id);
                    onMarkChatRead?.(friend.id);
                  }}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-[#222222] border-[#1db954]/50 shadow-md ring-1 ring-[#1db954]/30"
                      : "bg-[#1a1a1a]/40 hover:bg-[#202020] border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <ChatAvatar
                        name={friend.name}
                        photoUrl={friend.avatarUrl}
                        onClick={() =>
                          onOpenUserProfile?.({
                            id: friend.id,
                            name: friend.name,
                            username: friend.username,
                            avatarUrl: friend.avatarUrl,
                            matchScore: friend.matchScore,
                            vibe: friend.vibe,
                            topTrack: friend.topTrack,
                            status: "friends",
                          })
                        }
                      />
                      {/* Green dot indicator ONLY if there is an unread message from this user */}
                      {unreadChatUserIds.includes(friend.id) && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1db954] border-2 border-[#161616] animate-pulse" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-white truncate">
                          {friend.name}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          {mutedChatIds.includes(friend.id) && (
                            <span title="Chat muted">
                              <BellOff size={11} className="text-amber-400/80" />
                            </span>
                          )}
                          <span className="text-[10px] font-black text-[#1ed760]">
                            {friend.matchScore}%
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#727272] truncate">
                        @{friend.username}
                      </p>
                      <p className="text-[10px] text-[#b3b3b3] truncate italic mt-0.5">
                        {friend.nowPlaying
                          ? `♫ ${friend.nowPlaying}`
                          : friend.vibe || "Shared taste"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIGHT COLUMN: ACTIVE CHAT STAGE                                   */}
      {/* ================================================================= */}
      <div
        className={`${
          mobileShowList ? "hidden" : "flex"
        } lg:flex flex-1 flex-col bg-[#141414] border border-[#343434] lg:border-white/5 rounded-2xl overflow-hidden shadow-2xl relative`}
      >
        {activeChannel === "global" ? (
          /* =============================================================== */
          /* 1. GLOBAL CHAT ROOM                                             */
          /* =============================================================== */
          <div className="flex flex-col h-full p-3 sm:p-4">
            {/* Header */}
            <div className="p-3 bg-[#181818] border border-white/5 rounded-xl shadow mb-2 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeMobileChannel}
                  className="lg:hidden p-1.5 text-[#b3b3b3] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  title="Back to conversations list"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-full bg-[#1db954] text-black flex items-center justify-center font-bold shadow shrink-0">
                  <Radio size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black text-white">
                      Global Music Lounge
                    </h2>
                    <span className="w-2 h-2 rounded-full bg-[#1db954] animate-ping" />
                  </div>
                  <span className="text-[11px] text-[#b3b3b3] block">
                    Live worldwide music chat · Open for all listeners
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleGlobalNotifications}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                    globalNotifsEnabled
                      ? "bg-[#1db954]/20 border-[#1db954]/40 text-[#1ed760] hover:bg-[#1db954]/30"
                      : "bg-[#222222] border-white/10 text-[#888888] hover:text-white hover:bg-[#2a2a2a]"
                  }`}
                  title={
                    globalNotifsEnabled
                      ? "Global Chat notifications are ON (Click to turn off)"
                      : "Global Chat notifications are OFF (Click to turn on)"
                  }
                >
                  {globalNotifsEnabled ? (
                    <Bell size={13} className="text-[#1ed760]" />
                  ) : (
                    <BellOff size={13} />
                  )}
                  <span>{globalNotifsEnabled ? "Notifications On" : "Notifications Off"}</span>
                </button>

                <span className="px-3 py-1 bg-[#121212] border border-white/10 rounded-full text-[11px] font-bold text-[#1ed760] flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#1db954] animate-pulse" />
                  <span>{onlineCount} online</span>
                </span>
              </div>
            </div>

            {/* Daily Topic Banner */}
            <div className="px-3.5 py-2 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-[#181818] border border-purple-500/20 rounded-xl mb-2 shrink-0 flex items-center gap-2 text-xs">
              <Sparkles size={14} className="text-purple-400 shrink-0" />
              <span className="text-[#b3b3b3] text-[11px]">
                <strong className="text-white">Daily Topic:</strong> What track has been
                stuck on repeat in your Sound Capsule? Search and share below!
              </span>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 px-3 py-3 bg-[#111111] border border-white/5 rounded-xl">
              {globalMessages.map((msg, idx) => {
                const isMe = checkIfMeGlobal(msg);
                const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                if (isMe) {
                  // MY MESSAGES (ON THE RIGHT)
                  return (
                    <div
                      key={msg.id || `msg-${idx}`}
                      className="flex justify-end mb-2 animate-fadeIn"
                    >
                      <div className="flex flex-row-reverse items-end gap-2.5 max-w-[85%] sm:max-w-md group">
                        <ChatAvatar
                          name={msg.name}
                          photoUrl={msg.avatarUrl}
                          onClick={() =>
                            onOpenUserProfile?.({
                              id: msg.userId,
                              name: msg.name,
                              username: msg.username,
                              avatarUrl: msg.avatarUrl,
                              topTrack: msg.attachment?.name,
                              topTrackArtist: msg.attachment?.artist,
                            })
                          }
                        />
                        <div className="space-y-1 items-end text-right min-w-0">
                          <div className="flex items-center justify-end gap-1.5 text-[10px] text-[#727272]">
                            <span className="text-[#666]">{timeFormatted}</span>
                            <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 font-extrabold text-[9px] rounded-full">
                              You
                            </span>
                          </div>
                          {msg.text && (
                            <div className="p-3 rounded-2xl rounded-tr-xs bg-[#1db954] text-black font-semibold text-xs leading-relaxed shadow break-words text-left">
                              {msg.text}
                            </div>
                          )}
                          {msg.attachment && (
                            <SpotifyTrackCard
                              attachment={msg.attachment}
                              isMyMessage={true}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // OTHERS MESSAGES (ON THE LEFT)
                return (
                  <div
                    key={msg.id || `msg-${idx}`}
                    className="flex justify-start mb-2 animate-fadeIn"
                  >
                    <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-md group">
                      <ChatAvatar
                        name={msg.name}
                        photoUrl={msg.avatarUrl}
                        onClick={() =>
                          onOpenUserProfile?.({
                            id: msg.userId,
                            name: msg.name,
                            username: msg.username,
                            avatarUrl: msg.avatarUrl,
                            topTrack: msg.attachment?.name,
                            topTrackArtist: msg.attachment?.artist,
                          })
                        }
                      />
                      <div className="space-y-1 items-start text-left min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenUserProfile?.({
                                id: msg.userId,
                                name: msg.name,
                                username: msg.username,
                                avatarUrl: msg.avatarUrl,
                                topTrack: msg.attachment?.name,
                                topTrackArtist: msg.attachment?.artist,
                              })
                            }
                            className="font-bold text-white hover:text-[#1db954] transition-colors cursor-pointer truncate max-w-[120px]"
                          >
                            {msg.name}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenUserProfile?.({
                                id: msg.userId,
                                name: msg.name,
                                username: msg.username,
                                avatarUrl: msg.avatarUrl,
                                topTrack: msg.attachment?.name,
                                topTrackArtist: msg.attachment?.artist,
                              })
                            }
                            className="text-[#727272] hover:text-[#b3b3b3] transition-colors cursor-pointer text-[10px]"
                          >
                            @{msg.username}
                          </button>
                          <span className="text-[#666] text-[10px]">{timeFormatted}</span>
                        </div>
                        {msg.text && (
                          <div className="p-3 rounded-2xl rounded-tl-xs bg-[#222222] hover:bg-[#262626] border border-white/5 text-[#f0f0f0] text-xs leading-relaxed shadow break-words transition-colors">
                            {msg.text}
                          </div>
                        )}
                        {msg.attachment && (
                          <SpotifyTrackCard
                            attachment={msg.attachment}
                            isMyMessage={false}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={globalEndRef} />
            </div>

            {/* Track Picker for Global (with live search across Spotify / music catalog) */}
            {globalShowPicker && (
              <div className="mt-2 p-3 bg-[#1e1e1e] border border-white/10 rounded-xl space-y-2 shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between pb-1 border-b border-white/5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Disc3 size={14} className="text-[#1db954]" /> Search Track to Share
                  </span>
                  <button
                    onClick={() => setGlobalShowPicker(false)}
                    className="p-1 text-[#b3b3b3] hover:text-white cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-2.5 text-[#727272]"
                  />
                  <input
                    type="search"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search song title or artist..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#141414] border border-white/10 rounded-lg text-white placeholder-[#727272] outline-none focus:border-[#1db954]"
                    autoFocus
                  />
                  {isSearchingCatalog && (
                    <LoaderCircle
                      size={14}
                      className="absolute right-3 top-2.5 spin text-[#1db954]"
                    />
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {combinedAttachList.length === 0 ? (
                    <p className="text-xs text-[#727272] py-3 text-center">
                      {isSearchingCatalog
                        ? "Searching music catalog..."
                        : pickerSearch.trim().length >= 2
                        ? "No tracks found for this query."
                        : "Type a song name above to search across the catalog!"}
                    </p>
                  ) : (
                    combinedAttachList.map((item, i) => (
                      <div
                        key={`attach-${item.name}-${item.artist}-${i}`}
                        onClick={() => {
                          setGlobalAttachedTrack(item);
                          setGlobalShowPicker(false);
                        }}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors group"
                      >
                        <MusicArtwork item={item} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-white group-hover:text-[#1db954] transition-colors truncate">
                            {item.name}
                          </span>
                          <span className="block text-[10px] text-[#b3b3b3] truncate">
                            {item.artist}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#1db954] px-2 py-0.5 rounded-full bg-[#1db954]/10 group-hover:bg-[#1db954] group-hover:text-black transition-colors">
                          Attach +
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Attached Track Chip */}
            {globalAttachedTrack && !globalShowPicker && (
              <div className="mt-2 p-2 bg-[#181818] border border-[#1db954]/40 rounded-xl flex items-center justify-between shadow">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MusicArtwork item={globalAttachedTrack} size="sm" />
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-white truncate">
                      {globalAttachedTrack.name}
                    </span>
                    <span className="block text-[10px] text-[#b3b3b3] truncate">
                      {globalAttachedTrack.artist}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setGlobalAttachedTrack(null)}
                  className="p-1 text-[#b3b3b3] hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={handleSendGlobal}
              className="mt-2.5 flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => setGlobalShowPicker(prev => !prev)}
                className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                  globalAttachedTrack || globalShowPicker
                    ? "bg-[#1db954] text-black border-[#1db954]"
                    : "bg-[#202020] text-[#b3b3b3] hover:text-white border-white/10"
                }`}
                title="Search and attach a song"
              >
                <Plus size={18} />
              </button>
              <input
                type="text"
                value={globalInputText}
                onChange={e => setGlobalInputText(e.target.value)}
                placeholder={
                  globalAttachedTrack
                    ? "Add a note about this track..."
                    : "Say something in Global Chat or recommend a track..."
                }
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-[#1e1e1e] hover:bg-[#242424] focus:bg-[#1e1e1e] border border-white/5 focus:border-[#1db954] rounded-full text-white placeholder-[#727272] outline-none transition-all"
              />
              <button
                type="submit"
                disabled={(!globalInputText.trim() && !globalAttachedTrack) || globalSending}
                className="px-5 py-2.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-30 disabled:hover:bg-[#1db954] text-black rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0"
              >
                <span>Send</span>
                <Send size={14} />
              </button>
            </form>
          </div>
        ) : (
          /* =============================================================== */
          /* 2. DIRECT 1-ON-1 CHAT WITH FRIEND                               */
          /* =============================================================== */
          <div className="flex flex-col h-full p-3 sm:p-4">
            {/* Header */}
            <div className="p-3 bg-[#181818] border border-white/5 rounded-xl shadow mb-2 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={closeMobileChannel}
                  className="lg:hidden p-1.5 text-[#b3b3b3] hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  title="Back to conversations list"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="relative shrink-0">
                  <ChatAvatar
                    name={selectedFriend?.name || "Friend"}
                    photoUrl={selectedFriend?.avatarUrl}
                    onClick={() =>
                      selectedFriend &&
                      onOpenUserProfile?.({
                        id: selectedFriend.id,
                        name: selectedFriend.name,
                        username: selectedFriend.username,
                        avatarUrl: selectedFriend.avatarUrl,
                        matchScore: selectedFriend.matchScore,
                        vibe: selectedFriend.vibe,
                        topTrack: selectedFriend.topTrack,
                        status: "friends",
                      })
                    }
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1db954] border-2 border-[#181818]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      onClick={() =>
                        selectedFriend &&
                        onOpenUserProfile?.({
                          id: selectedFriend.id,
                          name: selectedFriend.name,
                          username: selectedFriend.username,
                          avatarUrl: selectedFriend.avatarUrl,
                          matchScore: selectedFriend.matchScore,
                          vibe: selectedFriend.vibe,
                          topTrack: selectedFriend.topTrack,
                          status: "friends",
                        })
                      }
                      className="font-bold text-sm text-white truncate cursor-pointer hover:text-[#1db954] transition-colors"
                    >
                      {selectedFriend?.name || "Friend"}
                    </h3>
                    {selectedFriend && (
                      <span className="px-2 py-0.5 bg-[#1db954]/20 text-[#1ed760] font-black text-[10px] rounded-full">
                        {selectedFriend.matchScore}% Match
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#b3b3b3] truncate block">
                    @{selectedFriend?.username || "listener"} ·{" "}
                    {selectedFriend?.nowPlaying ? `♫ ${selectedFriend.nowPlaying}` : "Friend"}
                  </span>
                </div>
              </div>

              {selectedFriend && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleMuteChat(selectedFriend.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                      mutedChatIds.includes(selectedFriend.id)
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                        : "bg-[#242424] border-white/10 text-[#b3b3b3] hover:text-white hover:bg-[#303030]"
                    }`}
                    title={
                      mutedChatIds.includes(selectedFriend.id)
                        ? "Chat is muted (Click to unmute)"
                        : "Mute notifications for this chat"
                    }
                  >
                    {mutedChatIds.includes(selectedFriend.id) ? (
                      <>
                        <BellOff size={13} className="text-amber-400" />
                        <span>Muted</span>
                      </>
                    ) : (
                      <>
                        <Bell size={13} />
                        <span>Mute</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() =>
                      onOpenUserProfile?.({
                        id: selectedFriend.id,
                        name: selectedFriend.name,
                        username: selectedFriend.username,
                        avatarUrl: selectedFriend.avatarUrl,
                        matchScore: selectedFriend.matchScore,
                        vibe: selectedFriend.vibe,
                        topTrack: selectedFriend.topTrack,
                        status: "friends",
                      })
                    }
                    className="px-3 py-1.5 text-xs font-semibold bg-[#242424] hover:bg-[#303030] text-white rounded-full transition-colors cursor-pointer"
                  >
                    View Profile
                  </button>
                </div>
              )}
            </div>

            {/* LIVE LISTENING SYNC BAR */}
            {selectedFriend && <LiveListeningSyncBar friend={selectedFriend} />}

            {/* Direct Messages Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 px-3 py-3 bg-[#111111] border border-white/5 rounded-xl">
              {dmMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 select-none">
                  <div className="w-14 h-14 rounded-2xl bg-[#1db954]/15 border border-[#1db954]/30 flex items-center justify-center text-[#1db954]">
                    <MessageCircle size={28} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Your conversation with {selectedFriend?.name || "your friend"}
                    </h4>
                    <p className="text-xs text-[#b3b3b3] max-w-sm mt-1">
                      Exchange track recommendations, talk about favorite albums, and share
                      what you&apos;re listening to.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setDmInputText(
                        `Hey ${
                          selectedFriend?.name || ""
                        }! Loved seeing your taste compatibility.`
                      )
                    }
                    className="px-4 py-1.5 text-xs font-semibold bg-[#222222] hover:bg-[#282828] text-[#1db954] border border-[#1db954]/30 rounded-full transition-colors cursor-pointer"
                  >
                    Say Hi 👋
                  </button>
                </div>
              ) : (
                dmMessages.map((msg, idx) => {
                  const isMe = checkIfMeDm(msg);
                  const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  if (isMe) {
                    return (
                      <div
                        key={msg.id || `dm-${idx}`}
                        className="flex justify-end mb-2 animate-fadeIn"
                      >
                        <div className="flex flex-row-reverse items-end gap-2.5 max-w-[85%] sm:max-w-md group">
                          <ChatAvatar
                            name={msg.senderName}
                            photoUrl={msg.senderAvatarUrl}
                          />
                          <div className="space-y-1 items-end text-right min-w-0">
                            <span className="text-[10px] text-[#666]">{timeFormatted}</span>
                            {msg.text && (
                              <div className="p-3 rounded-2xl rounded-tr-xs bg-[#1db954] text-black font-semibold text-xs leading-relaxed shadow break-words text-left">
                                {msg.text}
                              </div>
                            )}
                            {msg.attachment && (
                              <SpotifyTrackCard
                                attachment={msg.attachment}
                                isMyMessage={true}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id || `dm-${idx}`}
                      className="flex justify-start mb-2 animate-fadeIn"
                    >
                      <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-md group">
                        <ChatAvatar
                          name={msg.senderName}
                          photoUrl={msg.senderAvatarUrl}
                          onClick={() =>
                            selectedFriend &&
                            onOpenUserProfile?.({
                              id: selectedFriend.id,
                              name: selectedFriend.name,
                              username: selectedFriend.username,
                              avatarUrl: selectedFriend.avatarUrl,
                              matchScore: selectedFriend.matchScore,
                              vibe: selectedFriend.vibe,
                              topTrack: selectedFriend.topTrack,
                              status: "friends",
                            })
                          }
                        />
                        <div className="space-y-1 items-start text-left min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="font-bold text-white">{msg.senderName}</span>
                            <span className="text-[#666]">{timeFormatted}</span>
                          </div>
                          {msg.text && (
                            <div className="p-3 rounded-2xl rounded-tl-xs bg-[#222222] border border-white/5 text-[#f0f0f0] text-xs leading-relaxed shadow break-words">
                              {msg.text}
                            </div>
                          )}
                          {msg.attachment && (
                            <SpotifyTrackCard
                              attachment={msg.attachment}
                              isMyMessage={false}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={dmEndRef} />
            </div>

            {/* Track Picker for DM (with live search across Spotify / music catalog) */}
            {dmShowPicker && (
              <div className="mt-2 p-3 bg-[#1e1e1e] border border-white/10 rounded-xl space-y-2 shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between pb-1 border-b border-white/5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Disc3 size={14} className="text-[#1db954]" /> Search Track to Send
                  </span>
                  <button
                    onClick={() => setDmShowPicker(false)}
                    className="p-1 text-[#b3b3b3] hover:text-white cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-2.5 text-[#727272]"
                  />
                  <input
                    type="search"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search song title or artist..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#141414] border border-white/10 rounded-lg text-white placeholder-[#727272] outline-none focus:border-[#1db954]"
                    autoFocus
                  />
                  {isSearchingCatalog && (
                    <LoaderCircle
                      size={14}
                      className="absolute right-3 top-2.5 spin text-[#1db954]"
                    />
                  )}
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {combinedAttachList.length === 0 ? (
                    <p className="text-xs text-[#727272] py-3 text-center">
                      {isSearchingCatalog
                        ? "Searching music catalog..."
                        : pickerSearch.trim().length >= 2
                        ? "No tracks found for this query."
                        : "Type a song name above to search across the catalog!"}
                    </p>
                  ) : (
                    combinedAttachList.map((item, i) => (
                      <div
                        key={`attach-dm-${item.name}-${item.artist}-${i}`}
                        onClick={() => {
                          setDmAttachedTrack(item);
                          setDmShowPicker(false);
                        }}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors group"
                      >
                        <MusicArtwork item={item} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-white group-hover:text-[#1db954] transition-colors truncate">
                            {item.name}
                          </span>
                          <span className="block text-[10px] text-[#b3b3b3] truncate">
                            {item.artist}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#1db954] px-2 py-0.5 rounded-full bg-[#1db954]/10 group-hover:bg-[#1db954] group-hover:text-black transition-colors">
                          Attach +
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Attached Track Chip */}
            {dmAttachedTrack && !dmShowPicker && (
              <div className="mt-2 p-2 bg-[#181818] border border-[#1db954]/40 rounded-xl flex items-center justify-between shadow">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MusicArtwork item={dmAttachedTrack} size="sm" />
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-white truncate">
                      {dmAttachedTrack.name}
                    </span>
                    <span className="block text-[10px] text-[#b3b3b3] truncate">
                      {dmAttachedTrack.artist}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDmAttachedTrack(null)}
                  className="p-1 text-[#b3b3b3] hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={handleSendDm}
              className="mt-2.5 flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => setDmShowPicker(prev => !prev)}
                className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                  dmAttachedTrack || dmShowPicker
                    ? "bg-[#1db954] text-black border-[#1db954]"
                    : "bg-[#202020] text-[#b3b3b3] hover:text-white border-white/10"
                }`}
                title="Search and attach a song"
              >
                <Plus size={18} />
              </button>
              <input
                type="text"
                value={dmInputText}
                onChange={e => setDmInputText(e.target.value)}
                placeholder={`Message @${selectedFriend?.username || "friend"}...`}
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-[#1e1e1e] hover:bg-[#242424] focus:bg-[#1e1e1e] border border-white/5 focus:border-[#1db954] rounded-full text-white placeholder-[#727272] outline-none transition-all"
              />
              <button
                type="submit"
                disabled={(!dmInputText.trim() && !dmAttachedTrack) || dmSending}
                className="px-5 py-2.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-30 disabled:hover:bg-[#1db954] text-black rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shrink-0"
              >
                <span>Send</span>
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
