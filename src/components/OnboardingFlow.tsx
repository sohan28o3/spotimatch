"use client";
import React, { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import {
  Music2,
  Headphones,
  Check,
  Plus,
  ArrowRight,
  LogOut,
  Camera,
  Heart,
  Radio,
  Disc3,
  LoaderCircle,
  Search,
  Sparkles,
  ChevronLeft,
  X,
} from "lucide-react";
import {
  api,
  Avatar,
  Favorites,
  LastfmCard,
  MusicArtwork,
  SpotifyImportCard,
} from "@/components/onboarding";
import { PhotoUploadModal } from "@/components/PhotoUploadModal";
import type {
  AccountData,
  MusicItem,
  MusicKind,
  SpotifyImport,
  UserProfile,
} from "@/types";

// Curated popular starter artists across varied genres for 1-tap onboarding
const STARTER_ARTISTS: { name: string; genre: string }[] = [
  { name: "Radiohead", genre: "Art Rock" },
  { name: "Kendrick Lamar", genre: "Hip-Hop" },
  { name: "The Weeknd", genre: "R&B / Pop" },
  { name: "Taylor Swift", genre: "Pop" },
  { name: "Billie Eilish", genre: "Alt Pop" },
  { name: "Beach House", genre: "Dream Pop" },
  { name: "Arctic Monkeys", genre: "Indie Rock" },
  { name: "Frank Ocean", genre: "R&B / Soul" },
  { name: "Daft Punk", genre: "Electronic" },
  { name: "Lana Del Rey", genre: "Cinematic Pop" },
  { name: "Tame Impala", genre: "Psychedelic Rock" },
  { name: "SZA", genre: "R&B" },
];

export function suggestUsername(user: { email?: string | null; displayName?: string | null } | null): string {
  if (!user) return "listener";
  let base = "";
  if (user.email) {
    base = user.email.split("@")[0].toLowerCase();
  } else if (user.displayName) {
    base = user.displayName.toLowerCase().replace(/\s+/g, "_");
  }
  // Sanitize: allow only a-z, 0-9, and _
  base = base.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) return "listener";
  if (base.length < 3) {
    base = `${base}_fan`.replace(/^_+/, "");
  }
  if (base.length < 3 || !/^[a-z0-9_]{3,24}$/.test(base)) base = "listener";
  if (base.length > 24) base = base.slice(0, 24);
  return base;
}

interface OnboardingFlowProps {
  user: User;
  account: AccountData;
  onSaveProfile: (fields: Partial<UserProfile>, nextStep?: number) => Promise<void>;
  onSaveMusic: (source: "favorites" | "spotify", value: any) => Promise<void>;
  onUpdateAccount: React.Dispatch<React.SetStateAction<AccountData>>;
  onComplete: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function OnboardingFlow({
  user,
  account,
  onSaveProfile,
  onSaveMusic,
  onUpdateAccount,
  onComplete,
  onSignOut,
}: OnboardingFlowProps) {
  // Determine starting step based on current profile state
  const initialStep = !account.profile
    ? 1
    : account.profile.onboardingStep === 2
    ? 2
    : account.profile.onboardingStep === 3
    ? 3
    : 1;

  const [step, setStep] = useState<number>(initialStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Profile form state
  const [displayName, setDisplayName] = useState(
    account.profile?.displayName || user.displayName || ""
  );
  const [username, setUsername] = useState(
    account.profile?.username || suggestUsername(user)
  );
  const [bio, setBio] = useState(account.profile?.bio || "");
  const [avatar, setAvatar] = useState<"google" | "initials" | "custom">(
    account.profile?.avatar || "google"
  );
  const [photoURL, setPhotoURL] = useState(
    account.profile?.photoURL || user.photoURL || ""
  );
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Step 2: Music taste state
  const [musicTab, setMusicTab] = useState<"favorites" | "lastfm" | "spotify">("favorites");
  const [selectedFavorites, setSelectedFavorites] = useState<MusicItem[]>(
    account.music.favorites || []
  );
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<MusicItem[]>([]);
  const [catalogSearching, setCatalogSearching] = useState(false);

  // Search catalog in Step 2
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogQuery.trim()) return;
    setCatalogSearching(true);
    setError("");
    try {
      const data = await api("/api/catalog?" + new URLSearchParams({ kind: "artist", q: catalogQuery }));
      setCatalogResults(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setCatalogSearching(false);
    }
  }

  function toggleStarterArtist(name: string) {
    const exists = selectedFavorites.some(
      f => f.kind === "artist" && f.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setSelectedFavorites(prev =>
        prev.filter(f => !(f.kind === "artist" && f.name.toLowerCase() === name.toLowerCase()))
      );
    } else {
      setSelectedFavorites(prev => [
        ...prev,
        { kind: "artist", name, artist: "" },
      ]);
    }
  }

  function toggleCatalogItem(item: MusicItem) {
    const exists = selectedFavorites.some(
      f => f.kind === item.kind && f.name.toLowerCase() === item.name.toLowerCase()
    );
    if (exists) {
      setSelectedFavorites(prev =>
        prev.filter(
          f => !(f.kind === item.kind && f.name.toLowerCase() === item.name.toLowerCase())
        )
      );
    } else {
      setSelectedFavorites(prev => [...prev, item]);
    }
  }

  // Handle Step 1 Submit
  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError("Username must be 3–24 characters (letters, numbers, underscores).");
      return;
    }
    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }

    setBusy(true);
    try {
      await onSaveProfile(
        {
          displayName: displayName.trim(),
          username: cleanUsername,
          bio: bio.trim(),
          photoURL,
          avatar,
        },
        2
      );
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  }

  // Handle Step 2 Submit
  async function handleStep2Submit() {
    setBusy(true);
    setError("");
    try {
      // Save favorites if any selected
      if (selectedFavorites.length > 0) {
        await onSaveMusic("favorites", selectedFavorites);
      }
      await onSaveProfile({}, 3);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save taste preferences.");
    } finally {
      setBusy(false);
    }
  }

  // Skip Step 2
  async function handleSkipStep2() {
    setBusy(true);
    setError("");
    try {
      await onSaveProfile({}, 3);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to proceed.");
    } finally {
      setBusy(false);
    }
  }

  // Handle Step 3 Finish
  async function handleFinish() {
    setBusy(true);
    setError("");
    try {
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding.");
      setBusy(false);
    }
  }

  const currentProfilePreview: UserProfile = {
    uid: user.uid,
    displayName: displayName || user.displayName || "Music Fan",
    username: username || "listener",
    bio: bio || "",
    photoURL: photoURL || user.photoURL || "",
    avatar,
    onboardingStep: step,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col font-sans select-none overflow-y-auto">
      {/* Top Bar */}
      <header className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-[#121212]/90 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1db954] flex items-center justify-center text-black shadow-lg">
            <Music2 size={18} />
          </div>
          <span className="font-black text-lg tracking-tight">
            spoti<span className="text-[#1db954]">match</span>
          </span>
        </div>

        {/* Stepper Dots / Labels */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-bold">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
              step === 1
                ? "bg-[#1db954] text-black"
                : step > 1
                ? "bg-[#1db954]/20 text-[#1ed760]"
                : "text-[#727272]"
            }`}
          >
            <span>1</span>
            <span>Profile</span>
          </div>
          <div className="w-4 h-0.5 bg-white/10" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
              step === 2
                ? "bg-[#1db954] text-black"
                : step > 2
                ? "bg-[#1db954]/20 text-[#1ed760]"
                : "text-[#727272]"
            }`}
          >
            <span>2</span>
            <span>Music Taste</span>
          </div>
          <div className="w-4 h-0.5 bg-white/10" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
              step === 3 ? "bg-[#1db954] text-black" : "text-[#727272]"
            }`}
          >
            <span>3</span>
            <span>Ready</span>
          </div>
        </div>

        {/* User Info & Sign Out */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#727272] hidden md:inline truncate max-w-[180px]">
            {user.email}
          </span>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#b3b3b3] hover:text-white bg-[#1e1e1e] hover:bg-[#282828] rounded-full transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 max-w-4xl mx-auto w-full">
        {/* Error notification */}
        {error && (
          <div className="w-full mb-6 p-3 text-xs bg-red-950/60 border border-red-800 text-red-200 rounded-xl flex items-center justify-between animate-fadeIn">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 1: CREATE PROFILE                                            */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className="w-full max-w-xl bg-[#121212] border border-[#282828] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1db954]/15 text-[#1db954] mb-1">
                <Sparkles size={24} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Welcome to Spotimatch!
              </h1>
              <p className="text-xs sm:text-sm text-[#b3b3b3]">
                Let&apos;s build your public music identity. You can change these details anytime.
              </p>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-5">
              {/* Avatar Box */}
              <div className="flex items-center gap-5 p-4 bg-[#181818] border border-[#282828] rounded-xl">
                <Avatar
                  profile={currentProfilePreview}
                  size="lg"
                  editable={true}
                  onClick={() => setIsPhotoModalOpen(true)}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">Your profile photo</h3>
                  <p className="text-xs text-[#727272] mb-2 truncate">
                    {avatar === "google" && user.photoURL
                      ? "Google account photo linked"
                      : avatar === "initials"
                      ? "Initials avatar active"
                      : "Custom avatar active"}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPhotoModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#282828] hover:bg-[#383838] text-white rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera size={13} />
                      Change photo
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-[#b3b3b3] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={avatar === "initials"}
                        onChange={e => setAvatar(e.target.checked ? "initials" : "google")}
                        className="accent-[#1db954]"
                      />
                      Use initials
                    </label>
                  </div>
                </div>
              </div>

              {/* Display Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#b3b3b3] mb-1.5">
                    Display name <span className="text-[#1db954]">*</span>
                  </label>
                  <input
                    required
                    maxLength={60}
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name or nickname"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#181818] border border-[#282828] focus:border-[#1db954] rounded-lg text-white placeholder-[#727272] outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#b3b3b3] mb-1.5">
                    Username <span className="text-[#1db954]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-[#727272] text-sm">@</span>
                    <input
                      required
                      pattern="[a-z0-9_]{3,24}"
                      minLength={3}
                      maxLength={24}
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="handle"
                      className="w-full pl-8 pr-3.5 py-2.5 text-sm bg-[#181818] border border-[#282828] focus:border-[#1db954] rounded-lg text-white placeholder-[#727272] outline-none transition-colors"
                    />
                  </div>
                  <span className="text-[10px] text-[#727272] mt-1 block">
                    3–24 letters, numbers, or underscores
                  </span>
                </div>
              </div>

              {/* Bio */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-[#b3b3b3]">About you / Vibe</label>
                  <span className="text-[10px] text-[#727272]">{bio.length}/240</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={240}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Always listening to indie rock & bedroom pop... Looking for new track recommendations 🎧"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#181818] border border-[#282828] focus:border-[#1db954] rounded-lg text-white placeholder-[#727272] outline-none transition-colors resize-none"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 text-sm font-bold bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-50 text-black rounded-full transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                {busy ? (
                  <>
                    <LoaderCircle size={18} className="spin" />
                    <span>Saving profile…</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Music Taste</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: MUSIC TASTE & SOURCES                                    */}
        {/* ================================================================= */}
        {step === 2 && (
          <div className="w-full max-w-2xl bg-[#121212] border border-[#282828] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/15 text-purple-400 mb-1">
                <Headphones size={24} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                What are you listening to?
              </h1>
              <p className="text-xs sm:text-sm text-[#b3b3b3]">
                Pick a few favorite artists or connect your streaming sources to unlock matches.
              </p>
            </div>

            {/* Source Selection Tabs */}
            <div className="flex border-b border-[#282828] gap-2 pb-2">
              <button
                onClick={() => setMusicTab("favorites")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  musicTab === "favorites"
                    ? "bg-[#282828] text-white"
                    : "text-[#b3b3b3] hover:text-white"
                }`}
              >
                <Heart size={14} className={musicTab === "favorites" ? "text-rose-400" : ""} />
                <span>Quick Favorites</span>
                {selectedFavorites.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-[#1db954] text-black text-[10px] font-black rounded-full">
                    {selectedFavorites.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setMusicTab("lastfm")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  musicTab === "lastfm"
                    ? "bg-[#282828] text-white"
                    : "text-[#b3b3b3] hover:text-white"
                }`}
              >
                <Radio size={14} className={musicTab === "lastfm" ? "text-red-400" : ""} />
                <span>Last.fm</span>
                {account.music.lastfm && (
                  <span className="w-2 h-2 rounded-full bg-[#1db954]" />
                )}
              </button>

              <button
                onClick={() => setMusicTab("spotify")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                  musicTab === "spotify"
                    ? "bg-[#282828] text-white"
                    : "text-[#b3b3b3] hover:text-white"
                }`}
              >
                <Disc3 size={14} className={musicTab === "spotify" ? "text-[#1db954]" : ""} />
                <span>Spotify ZIP / JSON</span>
                {account.music.spotify && (
                  <span className="w-2 h-2 rounded-full bg-[#1db954]" />
                )}
              </button>
            </div>

            {/* Tab 1: Quick Favorites */}
            {musicTab === "favorites" && (
              <div className="space-y-5">
                {/* Search Bar */}
                <form onSubmit={handleSearch} className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-3 text-[#727272]" />
                    <input
                      value={catalogQuery}
                      onChange={e => setCatalogQuery(e.target.value)}
                      placeholder="Search for any artist or band…"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#181818] border border-[#282828] focus:border-[#1db954] rounded-full text-white placeholder-[#727272] outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={catalogSearching}
                    className="px-4 py-2.5 text-xs font-bold bg-[#282828] hover:bg-[#333] text-white rounded-full transition-colors shrink-0"
                  >
                    {catalogSearching ? "Searching…" : "Search"}
                  </button>
                </form>

                {/* Catalog Search Results if any */}
                {catalogResults.length > 0 && (
                  <div className="space-y-2 p-3 bg-[#181818] rounded-xl border border-[#282828]">
                    <span className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block">
                      Search Results
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {catalogResults.map(item => {
                        const isSelected = selectedFavorites.some(
                          f => f.kind === item.kind && f.name.toLowerCase() === item.name.toLowerCase()
                        );
                        return (
                          <button
                            key={`cat-${item.kind}-${item.name}`}
                            type="button"
                            onClick={() => toggleCatalogItem(item)}
                            className={`p-2 rounded-lg flex items-center gap-2 text-left border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#1db954]/20 border-[#1db954] text-white"
                                : "bg-[#121212] border-white/5 hover:border-white/20 text-[#b3b3b3]"
                            }`}
                          >
                            <MusicArtwork item={item} size="sm" />
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-bold truncate text-white">
                                {item.name}
                              </span>
                              <span className="block text-[10px] text-[#727272] truncate">
                                {item.artist || item.kind}
                              </span>
                            </div>
                            {isSelected && <Check size={14} className="text-[#1db954] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Add Starter Artists Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-[#b3b3b3] uppercase tracking-wider">
                      Quick Add Popular Artists
                    </span>
                    <span className="text-xs text-[#727272]">
                      {selectedFavorites.length} selected
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {STARTER_ARTISTS.map(artist => {
                      const isSelected = selectedFavorites.some(
                        f => f.kind === "artist" && f.name.toLowerCase() === artist.name.toLowerCase()
                      );
                      return (
                        <button
                          key={artist.name}
                          type="button"
                          onClick={() => toggleStarterArtist(artist.name)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? "bg-[#1db954]/15 border-[#1db954] text-white shadow-md shadow-[#1db954]/10"
                              : "bg-[#181818] border-white/5 hover:bg-[#202020] hover:border-white/20 text-[#b3b3b3]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-white truncate">
                              {artist.name}
                            </span>
                            <span className="block text-[10px] text-[#727272] truncate">
                              {artist.genre}
                            </span>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? "bg-[#1db954] text-black"
                                : "bg-[#282828] text-[#727272]"
                            }`}
                          >
                            {isSelected ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Chips */}
                {selectedFavorites.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-[#727272] uppercase tracking-wider block mb-2">
                      Selected Favorites ({selectedFavorites.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFavorites.map(fav => (
                        <span
                          key={`chip-${fav.name}`}
                          className="px-2.5 py-1 bg-[#1db954]/15 border border-[#1db954]/30 text-white text-xs font-semibold rounded-full flex items-center gap-1.5"
                        >
                          <span>{fav.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleStarterArtist(fav.name)}
                            className="p-0.5 text-[#1db954] hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Last.fm Card */}
            {musicTab === "lastfm" && (
              <div className="space-y-4">
                <LastfmCard
                  connection={account.music.lastfm}
                  run={async task => {
                    setBusy(true);
                    try {
                      await task();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onUpdate={lastfm =>
                    onUpdateAccount(prev => ({
                      ...prev,
                      music: { ...prev.music, lastfm },
                    }))
                  }
                />
              </div>
            )}

            {/* Tab 3: Spotify Import Card */}
            {musicTab === "spotify" && (
              <div className="space-y-4">
                <SpotifyImportCard
                  existing={account.music.spotify}
                  onSave={async snapshot => {
                    setBusy(true);
                    try {
                      await onSaveMusic("spotify", snapshot);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#282828] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-bold text-[#b3b3b3] hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSkipStep2}
                  className="px-4 py-2 text-xs font-semibold text-[#727272] hover:text-[#b3b3b3] transition-colors cursor-pointer"
                >
                  Skip for now
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleStep2Submit}
                  className="px-6 py-2.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-50 text-black rounded-full transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
                >
                  {busy ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: READY TO MATCH & LAUNCH                                  */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className="w-full max-w-lg bg-[#121212] border border-[#282828] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-fadeIn">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1db954] text-black shadow-xl">
              <Sparkles size={28} />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                You&apos;re All Set!
              </h1>
              <p className="text-xs sm:text-sm text-[#b3b3b3] mt-1">
                Your sound profile is ready. Here is what listeners will see.
              </p>
            </div>

            {/* Profile Card Preview */}
            <div className="p-6 bg-gradient-to-b from-[#1c1c1c] to-[#141414] border border-white/10 rounded-2xl text-left shadow-2xl space-y-4">
              <div className="flex items-center gap-4">
                <Avatar profile={currentProfilePreview} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-black text-white truncate">
                    {currentProfilePreview.displayName}
                  </h3>
                  <span className="text-xs text-[#1ed760] font-bold">
                    @{currentProfilePreview.username}
                  </span>
                  <p className="text-xs text-[#b3b3b3] mt-1 line-clamp-2">
                    {currentProfilePreview.bio || "Music enthusiast & listener."}
                  </p>
                </div>
              </div>

              {/* Badges / Stats Preview */}
              <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-white rounded-full">
                  🎧 {selectedFavorites.length || account.music.favorites.length} Favorites
                </span>
                {account.music.lastfm && (
                  <span className="px-2.5 py-1 bg-red-500/15 border border-red-500/30 text-red-300 rounded-full">
                    Last.fm: @{account.music.lastfm.username}
                  </span>
                )}
                {account.music.spotify && (
                  <span className="px-2.5 py-1 bg-[#1db954]/15 border border-[#1db954]/30 text-[#1ed760] rounded-full">
                    Spotify Vault Loaded
                  </span>
                )}
                <span className="px-2.5 py-1 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-full">
                  Capsule Ready
                </span>
              </div>
            </div>

            {/* Launch CTA */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleFinish}
                className="w-full py-3.5 text-sm font-bold bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-50 text-black rounded-full transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {busy ? (
                  <>
                    <LoaderCircle size={18} className="spin" />
                    <span>Entering Spotimatch…</span>
                  </>
                ) : (
                  <>
                    <span>Launch Spotimatch</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-[#727272] hover:text-white"
              >
                ← Edit taste selections
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        profile={currentProfilePreview}
        googlePhotoURL={user.photoURL}
        onSavePhoto={async (url, type) => {
          setPhotoURL(url);
          setAvatar(type);
          if (step > 1) {
            await onSaveProfile({ photoURL: url, avatar: type });
          }
        }}
      />
    </div>
  );
}
