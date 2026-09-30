"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  Home as HomeIcon,
  Users,
  Sparkles,
  Library as LibraryIcon,
  Heart,
  Plus,
  Disc3,
  Music2,
  Camera,
  Settings2,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  LogOut,
  X,
  LoaderCircle,
  CheckCircle2,
  MessageSquare,
  Bell,
  Trash2,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  emptyMusic,
  type AccountData,
  type FriendUser,
  type MusicItem,
  type SpotifyImport,
  type UserProfile,
} from "@/types";
import {
  api,
  Avatar,
  MusicArtwork,
  ProfileForm,
  Favorites,
  LastfmCard,
  SpotifyImportCard,
} from "@/components/onboarding";
import {
  HomeView,
  CapsuleView,
  ChatView,
  NotificationsView,
  LibraryView,
  ProfileView,
  type SpotifyTab, getCombinedTopSongs, getCombinedTopArtists } from "@/components/SpotifyViews";
import { PhotoUploadModal } from "@/components/PhotoUploadModal";
import { OnboardingFlow } from "@/components/OnboardingFlow";
import { UserProfileModal, type UserProfileModalUser } from "@/components/UserProfileModal";
import { MatchesView } from "@/components/MatchesDiscoveryView";
import { AdminDashboard } from "@/components/AdminDashboard";
import { authenticatedFetch } from "@/lib/client-api";
import { useActivePolling } from "@/hooks/use-active-polling";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<AccountData>({ profile: null, music: emptyMusic() });
  const [loading, setLoading] = useState(Boolean(auth));
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Navigation tab
  const [activeTab, setActiveTab] = useState<SpotifyTab>("home");
  const [tabHistory, setTabHistory] = useState<SpotifyTab[]>(["home"]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Modals
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfileModalUser | null>(null);
  const [activeDirectChatFriend, setActiveDirectChatFriend] = useState<FriendUser | null>(null);
  const [activeSourceModal, setActiveSourceModal] = useState<
    "favorites" | "lastfm" | "spotify" | null
  >(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [unreadChatUserIds, setUnreadChatUserIds] = useState<string[]>([]);
  const [incomingToast, setIncomingToast] = useState<{
    id: string;
    title: string;
    body: string;
    type?: string;
  } | null>(null);
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const initialNotifFetchDone = useRef(false);

  // Live track scrobbled from Last.fm
  const liveNowPlaying = account.music.lastfm?.nowPlaying ?? null;
  const lastfmUsername = account.music.lastfm?.username;

  const autoSynced = useRef("");

  // Auth & Account State
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async next => {
      setUser(next);
      setError("");
      setLoadFailed(false);
      if (!next) {
        setAccount({ profile: null, music: emptyMusic() });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await api("/api/account");
        if (auth?.currentUser?.uid !== next.uid) return;
        setAccount(data);
        const result = new URLSearchParams(window.location.search).get("lastfm");
        if (result) {
          const errors: Record<string, string> = {
            "invalid-request": "Last.fm verification failed. Please reconnect.",
            expired: "Your Last.fm request expired. Please connect again.",
            "provider-error": "Last.fm authorization failed. Please try again.",
            "save-error": "Could not save connection.",
            error: "Last.fm connection error.",
          };
          if (errors[result]) setError(errors[result]);
          else setNotice("Last.fm connected! Listening data will sync in the background.");
          window.history.replaceState({}, "", "/");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account.");
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const pollLiveLastfm = useCallback(async () => {
      if (!user || !lastfmUsername) return;
      if (!user) return;
      try {
        const res = await authenticatedFetch("/api/lastfm", {
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.live) return;

        setAccount(prev => {
          if (!prev.music.lastfm) return prev;
          const oldNp = prev.music.lastfm.nowPlaying;
          const newNp = data.live.nowPlaying;
          const npEqual =
            (!oldNp && !newNp) ||
            (oldNp?.name === newNp?.name && oldNp?.artist === newNp?.artist);
          const tracksEqual =
            JSON.stringify(prev.music.lastfm.recentTracks || []) ===
            JSON.stringify(data.live.recentTracks || []);
          const artistsEqual =
            JSON.stringify(prev.music.lastfm.recentArtists || []) ===
            JSON.stringify(data.live.recentArtists || []);

          if (npEqual && tracksEqual && artistsEqual) return prev;

          return {
            ...prev,
            music: {
              ...prev.music,
              lastfm: {
                ...prev.music.lastfm,
                nowPlaying: data.live.nowPlaying,
                recentTracks: data.live.recentTracks,
                recentArtists: data.live.recentArtists,
              },
            },
          };
        });
      } catch {
        // Ignore background polling errors
      }
  }, [user, lastfmUsername]);
  useActivePolling(pollLiveLastfm, Boolean(user && lastfmUsername));

  // Initial snapshot sync if missing
  useEffect(() => {
    const connection = account.music.lastfm;
    if (!user || !connection || connection.snapshot) return;

    const syncKey = user.uid + ":" + connection.connectedAt;
    if (autoSynced.current === syncKey) return;
    autoSynced.current = syncKey;

    api("/api/lastfm", "POST")
      .then(data => {
        setAccount(old =>
          old.music.lastfm?.connectedAt === connection.connectedAt
            ? {
                ...old,
                music: {
                  ...old.music,
                  lastfm: {
                    ...old.music.lastfm,
                    snapshot: data.snapshot,
                    nowPlaying: data.live?.nowPlaying ?? old.music.lastfm.nowPlaying,
                    recentTracks: data.live?.recentTracks ?? old.music.lastfm.recentTracks,
                    recentArtists: data.live?.recentArtists ?? old.music.lastfm.recentArtists,
                  },
                },
              }
            : old
        );
      })
      .catch(() => {});
  }, [account.music.lastfm, user]);

  // Real-time notification check (fast 3.5s polling + live toast triggers)
  const checkNotifications = useCallback(async () => {
      if (!user) return;
      try {
        const res = await authenticatedFetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();

        if (typeof data.hasUnread === "boolean") {
          setHasUnreadNotifications(data.hasUnread);
        }

        if (Array.isArray(data.notifications)) {
          const chatUnreadSenders = data.notifications
            .filter((n: any) => !n.read && n.type === "direct_message" && (n.senderId || n.actionPayload?.friendId))
            .map((n: any) => (n.senderId || n.actionPayload?.friendId) as string);
          setUnreadChatUserIds(Array.from(new Set(chatUnreadSenders)));

          // Detect brand new notifications that arrive during the session
          if (initialNotifFetchDone.current) {
            const fresh = data.notifications.find(
              (n: any) => !n.read && !knownNotificationIds.current.has(n.id)
            );
            if (fresh) {
              setIncomingToast({
                id: fresh.id,
                title: fresh.title,
                body: fresh.body,
                type: fresh.type,
              });
            }
          }
          for (const n of data.notifications) {
            knownNotificationIds.current.add(n.id);
          }
          initialNotifFetchDone.current = true;
        }
      } catch {}
  }, [user]);
  useActivePolling(checkNotifications, Boolean(user));

  // Auto-dismiss incoming notification toast after 6 seconds
  useEffect(() => {
    if (!incomingToast) return;
    const timer = setTimeout(() => {
      setIncomingToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [incomingToast]);

  const handleMarkChatRead = useCallback(async (friendId: string) => {
    setUnreadChatUserIds(prev => prev.filter(id => id !== friendId));
    try {
      await authenticatedFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          action: "mark_chat_read",
          senderId: friendId,
        }),
      });
    } catch {}
  }, []);

  // Tab Navigation with history
  function navigateTo(tab: SpotifyTab) {
    const targetTab = tab === "search" ? "home" : tab;
    if (targetTab === activeTab) return;
    const newHistory = tabHistory.slice(0, historyIndex + 1);
    newHistory.push(targetTab);
    setTabHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setActiveTab(targetTab);
  }

  function goBack() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setActiveTab(tabHistory[historyIndex - 1]);
    }
  }

  function goForward() {
    if (historyIndex < tabHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setActiveTab(tabHistory[historyIndex + 1]);
    }
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(
    fields: Partial<UserProfile>,
    nextStep = account.profile?.onboardingStep || 4
  ) {
    const now = new Date().toISOString();
    const profile: UserProfile = {
      uid: user?.uid || "",
      username: "",
      displayName: "",
      bio: "",
      photoURL: user?.photoURL || "",
      avatar: "google",
      createdAt: now,
      ...account.profile,
      ...fields,
      onboardingStep: nextStep,
      updatedAt: now,
    };
    const data = await api("/api/account", "PUT", profile);
    setAccount(old => ({ ...old, profile: data.profile }));
    setNotice("Profile updated successfully.");
  }

  async function handleSavePhoto(
    photoURL: string,
    avatarType: "custom" | "google" | "initials"
  ) {
    await saveProfile({ photoURL, avatar: avatarType });
  }

  async function saveMusic(
    source: "favorites" | "spotify",
    value: MusicItem[] | SpotifyImport | null
  ) {
    const data = await api(
      "/api/music",
      "PUT",
      source === "favorites" ? { source, items: value } : { source, snapshot: value }
    );
    setAccount(old => ({ ...old, music: { ...old.music, ...data } }));
    setNotice(
      source === "favorites"
        ? "Favorites saved."
        : value
        ? "Spotify history saved."
        : "Spotify history removed."
    );
  }

  const loggedIn = Boolean(user);

  // Gradient based on active tab
  const gradientClass = {
    home: "spotify-gradient-home",
    search: "spotify-gradient-search",
    matches: "spotify-gradient-matches",
    capsule: "spotify-gradient-capsule",
    chat: "spotify-gradient-chat",
    notifications: "spotify-gradient-chat",
    library: "spotify-gradient-library",
    profile: "spotify-gradient-profile",
    admin: "spotify-gradient-chat",
  }[activeTab];

  // Full-screen branded loading state while resolving authentication & account
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-3 font-sans select-none">
        <div className="w-12 h-12 rounded-full bg-[#1db954] flex items-center justify-center text-black shadow-xl mb-2 animate-pulse">
          <Music2 size={24} />
        </div>
        <LoaderCircle size={28} className="spin text-[#1db954]" />
        <p className="text-xs font-semibold text-[#b3b3b3]">Tuning your music profileâ€¦</p>
      </div>
    );
  }

  // Account loading failure screen
  if (loadFailed) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-4 font-sans p-6 text-center select-none">
        <h2 className="text-xl font-bold text-white">We couldnâ€™t load your profile.</h2>
        <p className="text-xs text-[#b3b3b3]">Your account is safe. Please check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white font-sans overflow-hidden flex flex-col select-none">
      {/* Top Navigation Bar */}
      <nav className="h-16 shrink-0 bg-black/95 md:bg-black border-b border-white/10 flex items-center justify-between px-4 md:px-6 relative z-30 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1db954] flex items-center justify-center text-black shadow-md">
              <Sparkles size={16} />
            </div>
            <span className="font-black text-lg tracking-tight hidden sm:block">Spotimatch</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            <button
              disabled={historyIndex <= 0}
              onClick={() => {
                if (historyIndex > 0) {
                  setHistoryIndex(prev => prev - 1);
                  setActiveTab(tabHistory[historyIndex - 1]);
                }
              }}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 disabled:opacity-30 disabled:hover:bg-black/60 text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Go back"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={historyIndex >= tabHistory.length - 1}
              onClick={() => {
                if (historyIndex < tabHistory.length - 1) {
                  setHistoryIndex(prev => prev + 1);
                  setActiveTab(tabHistory[historyIndex + 1]);
                }
              }}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 disabled:opacity-30 disabled:hover:bg-black/60 text-white flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Go forward"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loggedIn && account.profile ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 hover:bg-[#282828] p-1 pr-3 rounded-full transition-colors group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#242424] shrink-0 border border-transparent group-hover:border-white/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {account.profile.photoURL ? (
                      <img src={account.profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={16} className="m-auto h-full text-[#b3b3b3]" />
                    )}
                  </div>
                  <span className="text-sm font-bold max-w-[120px] truncate hidden md:block">
                    {account.profile.displayName}
                  </span>
                  <Settings2 size={14} className="text-[#b3b3b3] group-hover:text-white" />
                </button>
                {showProfileDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                    <div className="absolute right-0 top-12 w-56 bg-[#282828] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 text-sm animate-fadeIn origin-top-right">
                      <div className="px-3 py-2 border-b border-white/10 mb-1">
                        <p className="font-bold text-white truncate">{account.profile.displayName}</p>
                        <p className="text-xs text-[#b3b3b3] truncate">@{account.profile.username}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigateTo("home");
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#383838] flex items-center gap-2"
                      >
                        <UserIcon size={14} /> View profile
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProfileUser({
                            id: account.profile?.uid,
                            name: account.profile?.displayName || "You",
                            username: account.profile?.username || "listener",
                            avatarUrl: account.profile?.photoURL,
                            photoURL: account.profile?.photoURL,
                            bio: account.profile?.bio,
                            vibe: account.profile?.bio,
                            showTopSongs: account.profile?.showTopSongs,
                            showTopArtists: account.profile?.showTopArtists,
                            showNowPlaying: account.profile?.showNowPlaying,
                            topSongs: getCombinedTopSongs(account.music).slice(0, 5),
                            topArtists: getCombinedTopArtists(account.music).slice(0, 5),
                            nowPlaying: account.music.lastfm?.nowPlaying || null,
                            forceEditMode: true,
                          });
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#383838] flex items-center gap-2 text-[#1ed760]"
                      >
                        <Settings2 size={14} /> Edit profile
                      </button>
                      <button
                        onClick={() => {
                          setIsAccountSettingsOpen(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#383838] flex items-center gap-2"
                      >
                        <Settings2 size={14} /> Account settings
                      </button>
                      {user?.emailVerified && user.email?.toLowerCase() === "sohanmutra28@gmail.com" && (
                        <button
                          onClick={() => {
                            navigateTo("admin");
                            setShowProfileDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-rose-300 hover:bg-[#383838] flex items-center gap-2"
                        >
                          <ShieldAlert size={14} /> Admin dashboard
                        </button>
                      )}
                      <div className="my-1 border-t border-[#383838]" />
                      <button
                        onClick={() =>
                          run(async () => {
                            if (auth && user) await signOut(auth);
                            setAccount({ profile: null, music: emptyMusic() });
                            setShowProfileDropdown(false);
                          })
                        }
                        className="w-full text-left px-4 py-2 hover:bg-[#383838] text-red-300 flex items-center gap-2"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                disabled={!isFirebaseConfigured || busy}
                onClick={() =>
                  run(async () => {
                    if (auth) await signInWithPopup(auth, googleProvider);
                  })
                }
                className="px-5 py-2 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all shadow-md"
              >
                Log In
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* DESKTOP SIDEBAR */}
        {loggedIn && account.profile && (
          <aside className="hidden md:flex flex-col w-72 bg-[#000000] p-2 gap-2 shrink-0 select-none z-20">
            {/* Top Navigation Box */}
            <div className="bg-[#121212] rounded-xl flex flex-col p-3 gap-1">
              <button
                onClick={() => navigateTo("home")}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "home" ? "text-white bg-white/10 shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                }`}
              >
                <HomeIcon size={22} className={activeTab === "home" ? "text-white fill-current" : "text-[#b3b3b3]"} />
                <span>Home</span>
              </button>
              <button
                onClick={() => navigateTo("matches")}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "matches" ? "text-white bg-white/10 shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                }`}
              >
                <Users size={22} className={activeTab === "matches" ? "text-white fill-current" : "text-[#b3b3b3]"} />
                <span>Matches</span>
              </button>
              <button
                onClick={() => navigateTo("capsule")}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "capsule" ? "text-white bg-white/10 shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles size={22} className={activeTab === "capsule" ? "text-white fill-current" : "text-[#b3b3b3]"} />
                <span>Capsule</span>
              </button>
              <button
                onClick={() => navigateTo("chat")}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "chat" ? "text-white bg-white/10 shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="relative">
                  <MessageSquare size={22} className={activeTab === "chat" ? "text-white fill-current" : "text-[#b3b3b3]"} />
                  {unreadChatUserIds.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#121212]" />
                  )}
                </div>
                <span>Chat</span>
              </button>
              <button
                onClick={() => navigateTo("notifications")}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "notifications" ? "text-white bg-white/10 shadow-sm" : "text-[#b3b3b3] hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="relative">
                  <Bell size={22} className={activeTab === "notifications" ? "text-white fill-current" : "text-[#b3b3b3]"} />
                  {hasUnreadNotifications && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1db954] rounded-full border-2 border-[#121212]" />
                  )}
                </div>
                <span>Alerts</span>
              </button>
            </div>

            {/* Bottom "Your Library" Box */}
            <div className="bg-[#121212] rounded-xl flex-1 flex flex-col p-3 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between text-[#b3b3b3] px-2 py-1.5 mb-2">
                <button
                  onClick={() => navigateTo("library")}
                  className={`flex items-center gap-3 font-bold text-sm transition-colors cursor-pointer ${
                    activeTab === "library" ? "text-white" : "hover:text-white"
                  }`}
                >
                  <LibraryIcon size={24} className={activeTab === "library" ? "text-white" : ""} />
                  <span>Your Library</span>
                </button>
                <button
                  onClick={() => setActiveSourceModal("lastfm")}
                  className="p-1 hover:text-white hover:bg-white/10 rounded-full transition-colors text-[#b3b3b3] cursor-pointer"
                  title="Connect or add music source"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* Quick source pills */}
              <div className="flex items-center gap-1.5 px-1 mb-3 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => navigateTo("library")}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer shrink-0"
                >
                  All
                </button>
                <button
                  onClick={() => setActiveSourceModal("favorites")}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  Favorites
                </button>
                <button
                  onClick={() => setActiveSourceModal("spotify")}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  Spotify
                </button>
                <button
                  onClick={() => setActiveSourceModal("lastfm")}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  Last.fm
                </button>
              </div>

              {/* Spotify-style vertical library items */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {/* Liked / Favorites */}
                <div
                  onClick={() => setActiveSourceModal("favorites")}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-md bg-gradient-to-br from-indigo-700 via-purple-600 to-pink-500 flex items-center justify-center shrink-0 shadow-md">
                    <Heart size={20} className="text-white fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                      Liked & Favorites
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate">
                      Playlist • {account.music.favorites?.length || 0} songs
                    </p>
                  </div>
                </div>

                {/* Spotify History */}
                <div
                  onClick={() => setActiveSourceModal("spotify")}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-md bg-[#1ed760]/15 border border-[#1ed760]/30 flex items-center justify-center shrink-0 shadow-md">
                    <Disc3 size={22} className="text-[#1ed760]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                      Spotify History
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate">
                      {account.music.spotify ? `${account.music.spotify.totalPlays.toLocaleString()} plays` : "Not connected"}
                    </p>
                  </div>
                </div>

                {/* Last.fm Scrobbler */}
                <div
                  onClick={() => setActiveSourceModal("lastfm")}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-md bg-[#d51007]/15 border border-[#d51007]/30 flex items-center justify-center shrink-0 shadow-md">
                    <Radio size={20} className="text-[#d51007]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                      Last.fm Scrobbler
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate">
                      {account.music.lastfm?.username ? `@${account.music.lastfm.username} • Live` : "Not connected"}
                    </p>
                  </div>
                </div>

                {/* Sound Capsule */}
                <div
                  onClick={() => navigateTo("capsule")}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-900 to-indigo-950 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles size={20} className="text-[#d946ef]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                      Sound Capsules
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate">
                      Monthly Rewind • Highlights
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

      {/* ================================================================= */}
      {/* MAIN CONTENT AREA */}
      {/* ================================================================= */}
      <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden relative scroll-smooth bg-black">
        <div className="w-full min-w-0 max-w-[1400px] mx-auto min-h-full flex flex-col">
          {activeTab === "home" && (
            <HomeView
              account={account}
              onNavigate={navigateTo}
              onOpenSourceModal={setActiveSourceModal}
              onOpenUserProfile={u => {
                setSelectedProfileUser(u);
              }}
              
            />
          )}
          {activeTab === "matches" && (
            <MatchesView
              account={account}
              onNavigate={navigateTo}
              onOpenUserProfile={u => {
                setSelectedProfileUser(u);
              }}
              onStartDirectChat={f => {
                setActiveDirectChatFriend(f);
                navigateTo("chat");
              }}
              onOpenSourceModal={setActiveSourceModal}
            />
          )}
          {activeTab === "capsule" && (
            <CapsuleView
              account={account}
              onNavigate={navigateTo}
            />
          )}
          {activeTab === "chat" && (
            <ChatView
              account={account}
              onNavigate={navigateTo}
              onOpenUserProfile={u => {
                setSelectedProfileUser(u);
              }}
              initialInput=""
              initialDirectFriend={activeDirectChatFriend || undefined}
              unreadChatUserIds={unreadChatUserIds}
              onMarkChatRead={handleMarkChatRead}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsView
              account={account}
              onNavigate={navigateTo}
              onOpenUserProfile={u => {
                setSelectedProfileUser(u);
              }}
              onStartDirectChat={f => {
                setActiveDirectChatFriend(f);
                navigateTo("chat");
              }}
            />
          )}
          {activeTab === "library" && (
            <LibraryView account={account} onOpenSourceModal={setActiveSourceModal} />
          )}
          {activeTab === "admin" && user?.emailVerified && user.email?.toLowerCase() === "sohanmutra28@gmail.com" && (
            <AdminDashboard />
          )}
        </div>
      </main>
      </div>

      {/* ================================================================= */}
      {/* BOTTOM NAVIGATION BAR */}
      {/* ================================================================= */}
      {loggedIn && account.profile && (
        <nav className="md:hidden h-[72px] bg-[#121212]/95 border-t border-white/10 flex items-center justify-around px-2 shrink-0 z-40 pb-safe backdrop-blur-xl shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
          <button onClick={() => navigateTo("home")} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors ${activeTab === "home" ? "bg-white/10 text-white" : "text-[#a7a7a7] hover:text-white"}`}>
            <HomeIcon size={20} className={activeTab === "home" ? "fill-current" : ""} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button onClick={() => navigateTo("matches")} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors ${activeTab === "matches" ? "bg-white/10 text-white" : "text-[#a7a7a7] hover:text-white"}`}>
            <Users size={20} className={activeTab === "matches" ? "fill-current" : ""} />
            <span className="text-[10px] font-medium">Matches</span>
          </button>
          <button onClick={() => navigateTo("capsule")} className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors ${activeTab === "capsule" ? "bg-white/10 text-white" : "text-[#a7a7a7] hover:text-white"}`}>
            <Sparkles size={20} className={activeTab === "capsule" ? "fill-current" : ""} />
            <span className="text-[10px] font-medium">Capsule</span>
          </button>
          <button onClick={() => navigateTo("chat")} className={`relative flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors ${activeTab === "chat" ? "bg-white/10 text-white" : "text-[#a7a7a7] hover:text-white"}`}>
            <div className="relative">
              <MessageSquare size={20} className={activeTab === "chat" ? "fill-current" : ""} />
              {unreadChatUserIds.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#121212]" />
              )}
            </div>
            <span className="text-[10px] font-medium">Chat</span>
          </button>
          <button onClick={() => navigateTo("notifications")} className={`relative flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors ${activeTab === "notifications" ? "bg-white/10 text-white" : "text-[#a7a7a7] hover:text-white"}`}>
            <div className="relative">
              <Bell size={20} className={activeTab === "notifications" ? "fill-current" : ""} />
              {hasUnreadNotifications && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#1db954] rounded-full border border-[#121212]" />
              )}
            </div>
            <span className="text-[10px] font-medium">Alerts</span>
          </button>
        </nav>
      )}

      {/* ================================================================= */}
      {/* DESKTOP BOTTOM TRACKBAR (Only rendered when something is playing on Last.fm) */}
      {/* Purely informational display of current playing song - NO play/pause/volume buttons */}
      {/* ================================================================= */}
      {liveNowPlaying && loggedIn && (
        <footer className="hidden md:flex h-[76px] bg-[#121212] border-t border-[#282828] px-6 items-center justify-between shrink-0 z-40 animate-in slide-in-from-bottom duration-300">
          {/* Left: Track artwork & details */}
          <div className="flex items-center gap-3.5 min-w-[240px] max-w-md">
            <div className="w-12 h-12 rounded-lg bg-[#181818] overflow-hidden shrink-0 shadow-lg relative">
              <MusicArtwork
                item={{
                  kind: "track",
                  name: liveNowPlaying.name,
                  artist: liveNowPlaying.artist,
                  album: liveNowPlaying.album,
                  image: liveNowPlaying.image,
                }}
                size="sm"
              />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-white truncate">
                {liveNowPlaying.name}
              </span>
              <span className="block text-[11px] text-[#b3b3b3] truncate">
                {liveNowPlaying.artist}
                {liveNowPlaying.album ? ` â€¢ ${liveNowPlaying.album}` : ""}
              </span>
            </div>
          </div>

          {/* Center: Live equalizer badge (NO play, pause, volume, or scrubber controls!) */}
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#1db954]/10 border border-[#1db954]/30 text-[#1db954]">
            <div className="flex items-end gap-0.5 h-3.5">
              <span className="w-0.5 bg-[#1db954] rounded-full animate-bounce h-2.5" style={{ animationDelay: "0ms" }} />
              <span className="w-0.5 bg-[#1db954] rounded-full animate-bounce h-3.5" style={{ animationDelay: "150ms" }} />
              <span className="w-0.5 bg-[#1db954] rounded-full animate-bounce h-2" style={{ animationDelay: "300ms" }} />
              <span className="w-0.5 bg-[#1db954] rounded-full animate-bounce h-3" style={{ animationDelay: "450ms" }} />
            </div>
            <span className="text-xs font-black tracking-wider uppercase">
              NOW PLAYING ON LAST.FM
            </span>
          </div>

          {/* Right: Live scrobble status indicator */}
          <div className="flex items-center justify-end gap-2 text-xs min-w-[200px]">
            <span className="w-2 h-2 rounded-full bg-[#1db954] animate-pulse" />
            <span className="text-[11px] font-medium text-[#727272]">Real-time scrobble</span>
          </div>
        </footer>
      )}
      {/* ================================================================= */}
      {/* MODALS */}
      {/* ================================================================= */}

      {/* 1. Photo Upload & Edit Modal */}
      <PhotoUploadModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        profile={account.profile}
        googlePhotoURL={user?.photoURL}
        onSavePhoto={handleSavePhoto}
      />

      {/* 2b. Account Settings Modal */}
      {isAccountSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsAccountSettingsOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-[#181818] border border-[#282828] rounded-2xl shadow-2xl p-6 text-white space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#282828] pb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Settings2 size={16} className="text-[#727272]" />
                Account settings
              </h2>
              <button
                onClick={() => setIsAccountSettingsOpen(false)}
                className="p-1 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Danger zone: Delete Account */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-0.5">
                  <Trash2 size={13} /> Danger zone
                </h3>
                <p className="text-[11px] text-[#727272]">
                  Actions here are permanent and cannot be undone.
                </p>
              </div>
              <div className="p-4 bg-red-950/20 border border-red-800/40 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-red-300">Delete account</h4>
                    <p className="text-[11px] text-[#727272] mt-0.5">
                      Permanently erase your profile, music taste, and all connections.
                    </p>
                  </div>
                  {!confirmDeleteAccount ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccount(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-red-400 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 rounded-full transition-all shrink-0 cursor-pointer"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAccount(false)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#b3b3b3] hover:text-white bg-[#282828] hover:bg-[#383838] rounded-full transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          run(async () => {
                            setConfirmDeleteAccount(false);
                            await api("/api/account", "DELETE");
                            if (auth && user) await signOut(auth);
                            setAccount({ profile: null, music: emptyMusic() });
                            setIsAccountSettingsOpen(false);
                            setNotice("Your account and all personal data have been permanently erased.");
                          })
                        }
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-full transition-all shadow-md cursor-pointer"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
                {confirmDeleteAccount && (
                  <p className="text-[11px] text-red-300 bg-red-950/40 p-2.5 rounded-lg border border-red-900/60">
                    Are you sure? This will permanently erase your profile, release your @{account.profile?.username || "handle"} handle, and clear all data.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 3. Source Editor Modal (Favorites / Last.fm / Spotify) */}
      {activeSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#181818] border border-[#282828] rounded-2xl shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#282828] pb-3">
              <h2 className="text-base font-bold">
                {activeSourceModal === "favorites"
                  ? "Manage Favorites"
                  : activeSourceModal === "spotify"
                  ? "Import Spotify History"
                  : "Last.fm Scrobbler"}
              </h2>
              <button
                onClick={() => setActiveSourceModal(null)}
                className="p-1 text-[#b3b3b3] hover:text-white rounded-full hover:bg-[#282828]"
              >
                <X size={18} />
              </button>
            </div>

            {activeSourceModal === "favorites" && (
              <Favorites
                initial={account.music.favorites}
                onDirty={() => {}}
                onSave={items =>
                  run(async () => {
                    await saveMusic("favorites", items);
                    setActiveSourceModal(null);
                  })
                }
              />
            )}

            {activeSourceModal === "spotify" && (
              <SpotifyImportCard
                existing={account.music.spotify}
                onSave={async snapshot => {
                  await run(() => saveMusic("spotify", snapshot));
                  setActiveSourceModal(null);
                }}
              />
            )}

            {activeSourceModal === "lastfm" && (
              <LastfmCard
                connection={account.music.lastfm}
                run={run}
                onUpdate={lastfm => {
                  setAccount(old => ({ ...old, music: { ...old.music, lastfm } }));
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* 4. Full User Profile Modal (Clicking any user's avatar or handle) */}
      <UserProfileModal
        key={`${selectedProfileUser?.id || selectedProfileUser?.uid || "closed"}:${selectedProfileUser?.forceEditMode ? "edit" : "view"}`}
        isOpen={Boolean(selectedProfileUser)}
        onClose={() => setSelectedProfileUser(null)}
        targetUser={selectedProfileUser}
        currentUser={account.profile}
        onSendFriendRequest={async targetUser => {
          const token =
            typeof window !== "undefined" && auth?.currentUser
              ? await auth.currentUser.getIdToken().catch(() => null)
              : null;
          await fetch("/api/friends", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "send_request",
              targetId: targetUser.id || targetUser.uid,
              senderName: account.profile?.displayName || "Music Friend",
              senderUsername: account.profile?.username || "listener",
              senderAvatarUrl: account.profile?.photoURL || "",
              matchScore: targetUser.matchScore || 92,
              sharedArtists: targetUser.sharedArtists || [],
            }),
          });
          setNotice(`Friend request sent to ${targetUser.name}!`);
        }}
        onAcceptRequest={async (requestId, fromUserId) => {
          const token =
            typeof window !== "undefined" && auth?.currentUser
              ? await auth.currentUser.getIdToken().catch(() => null)
              : null;
          await fetch("/api/friends", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "accept_request",
              requestId,
              fromUserId,
            }),
          });
          setNotice("Friend request accepted!");
        }}
        onCancelRequest={async targetId => {
          const token =
            typeof window !== "undefined" && auth?.currentUser
              ? await auth.currentUser.getIdToken().catch(() => null)
              : null;
          await fetch("/api/friends", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "cancel_request",
              targetId,
            }),
          });
          setNotice("Friend request canceled.");
        }}
        onRemoveFriend={async (friendId, name) => {
          const token =
            typeof window !== "undefined" && auth?.currentUser
              ? await auth.currentUser.getIdToken().catch(() => null)
              : null;
          await fetch("/api/friends", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "remove_friend",
              friendId,
            }),
          });
          setNotice(`Removed ${name} from friends.`);
        }}
        onOpenChatWithUser={targetUser => {
          setSelectedProfileUser(null);
          setActiveDirectChatFriend({
            id: targetUser.id || targetUser.uid || "friend",
            name: targetUser.name,
            username: targetUser.username,
            avatarUrl: targetUser.avatarUrl || targetUser.photoURL || "",
            matchScore: targetUser.matchScore || 94,
            vibe: targetUser.vibe || "Connected via Spotimatch",
            topTrack: targetUser.topTrack || "Shared Taste",
            connectedAt: new Date().toISOString(),
            status: "friends",
          });
          navigateTo("chat");
        }}
        onOpenPhotoModal={() => {
          setSelectedProfileUser(null);
          setIsPhotoModalOpen(true);
        }}
        onBlockUser={async targetUser => {
          setSelectedProfileUser(null);
          const targetId = targetUser.id || targetUser.uid;
          if (!targetId) return;
          const token =
            typeof window !== "undefined" && auth?.currentUser
              ? await auth.currentUser.getIdToken().catch(() => null)
              : null;
          await fetch("/api/friends", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "block_user",
              targetId,
            }),
          });
          setNotice(`Blocked ${targetUser.name}.`);
        }}
        onUnblockUser={async userId => {
          setSelectedProfileUser(null);
          const token =
            typeof window !== "undefined" && auth?.currentUser
              ? await auth.currentUser.getIdToken().catch(() => null)
              : null;
          await fetch("/api/friends", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "unblock_user",
              targetId: userId,
            }),
          });
          setNotice("Unblocked listener.");
        }}
        onUpdateProfile={async updated => {
          await saveProfile(updated);
          setAccount(old => ({
            ...old,
            profile: old.profile ? { ...old.profile, ...updated } : null,
          }));
        }}
      />
    </div>
  );
}




