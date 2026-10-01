"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { ArrowLeft, ArrowRight, Check, Headphones, LoaderCircle, LogOut, Music2, Radio, Search, Upload } from "lucide-react";
import { api, LastfmCard, MusicArtwork, SpotifyImportCard } from "@/components/onboarding";
import type { AccountData, MusicItem, SpotifyImport, UserProfile } from "@/types";

export function suggestUsername(user: { email?: string | null; displayName?: string | null } | null): string {
  if (!user) return "listener";
  let base = (user.email?.split("@")[0] || user.displayName || "listener").toLowerCase();
  base = base.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (base.length < 3) base = `${base || "music"}_fan`;
  base = base.slice(0, 24);
  return /^[a-z0-9_]{3,24}$/.test(base) ? base : "listener";
}

interface Props {
  user: User;
  account: AccountData;
  onSaveProfile: (fields: Partial<UserProfile>, nextStep?: number) => Promise<void>;
  onSaveMusic: (source: "favorites" | "spotify", value: MusicItem[] | SpotifyImport | null) => Promise<void>;
  onUpdateAccount: React.Dispatch<React.SetStateAction<AccountData>>;
  onComplete: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

const STARTERS = ["Radiohead", "Kendrick Lamar", "The Weeknd", "Taylor Swift", "Billie Eilish", "Beach House", "Arctic Monkeys", "Frank Ocean", "Daft Punk", "Lana Del Rey", "Tame Impala", "SZA"];

export function OnboardingFlow({ user, account, onSaveProfile, onSaveMusic, onUpdateAccount, onComplete, onSignOut }: Props) {
  const [step, setStep] = useState(Math.min(Math.max(account.profile?.onboardingStep || 1, 1), 4));
  const [displayName, setDisplayName] = useState(account.profile?.displayName || user.displayName || "");
  const [username, setUsername] = useState(account.profile?.username || suggestUsername(user));
  const [bio, setBio] = useState(account.profile?.bio || "");
  const [favorites, setFavorites] = useState<MusicItem[]>(account.music.favorites || []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to error when it appears so mobile users see what went wrong
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!displayName.trim()) {
      setError("Add a display name to continue.");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError("Use 3–24 letters, numbers, or underscores for your username.");
      return;
    }
    await perform(async () => {
      await onSaveProfile(
        {
          displayName: displayName.trim(),
          username: cleanUsername,
          bio: bio.trim(),
          photoURL: user.photoURL || "",
          avatar: "google",
        },
        2
      );
      setStep(2);
    });
  }

  function toggle(item: MusicItem) {
    const key = `${item.kind}:${item.name.toLowerCase()}:${item.artist.toLowerCase()}`;
    setFavorites(current =>
      current.some(old => `${old.kind}:${old.name.toLowerCase()}:${old.artist.toLowerCase()}` === key)
        ? current.filter(old => `${old.kind}:${old.name.toLowerCase()}:${old.artist.toLowerCase()}` !== key)
        : [...current, item]
    );
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    await perform(async () => {
      const data = await api(`/api/catalog?${new URLSearchParams({ kind: "artist", q: query.trim() })}`);
      setResults(data.items || []);
    });
  }

  async function advance(next: number) {
    await perform(async () => {
      if (step === 2) await onSaveMusic("favorites", favorites);
      await onSaveProfile({}, next);
      setStep(next);
    });
  }

  const labels = ["Profile", "Favorites", "Last.fm", "Spotify"];

  return (
    <main className="min-h-[100dvh] w-full bg-black px-4 py-5 text-white sm:px-8 sm:py-8 overflow-y-auto pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1ed760] text-black shadow-md">
              <Music2 size={18} />
            </div>
            <span className="text-lg font-black tracking-tight">SpotiMatch</span>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="flex items-center gap-2 rounded-full bg-[#242424] hover:bg-[#303030] px-3.5 py-1.5 text-xs font-bold text-[#dedede] transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </header>

        {/* Interactive step navigation bar for easy jumping on mobile */}
        <nav aria-label="Onboarding progress" className="mb-6 grid grid-cols-4 gap-2">
          {labels.map((label, index) => {
            const stepNum = index + 1;
            const canJump = stepNum <= Math.max(step, account.profile?.onboardingStep || 1);
            return (
              <button
                key={label}
                type="button"
                disabled={!canJump}
                onClick={() => {
                  if (canJump) {
                    setError("");
                    setStep(stepNum);
                  }
                }}
                className={`min-w-0 text-left transition-opacity ${
                  canJump ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-60"
                }`}
              >
                <div className={`h-1.5 rounded-full ${stepNum <= step ? "bg-[#1ed760]" : "bg-[#282828]"}`} />
                <p className={`mt-2 truncate text-[10px] font-bold sm:text-xs ${stepNum === step ? "text-white" : "text-[#727272]"}`}>
                  {stepNum}. {label}
                </p>
              </button>
            );
          })}
        </nav>

        {/* Global error banner */}
        {error && (
          <div
            ref={errorRef}
            className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200 animate-fadeIn"
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-5 shadow-2xl sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ed760]">Step 1 of 4 · Required</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Create your music profile</h1>
            <p className="mt-2 text-sm text-[#b3b3b3]">This is how other listeners will recognize you in SpotiMatch.</p>

            <form onSubmit={saveProfile} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#b3b3b3]">
                  Display name <span className="text-red-400">*</span>
                  <input
                    value={displayName}
                    maxLength={60}
                    onChange={e => {
                      setDisplayName(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="Your name or nickname"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-base sm:text-sm text-white outline-none focus:border-[#1ed760] transition-colors"
                  />
                </label>

                <label className="text-xs font-bold text-[#b3b3b3]">
                  Username <span className="text-red-400">*</span>
                  <div className="mt-2 flex rounded-xl border border-white/10 bg-[#181818] px-4 focus-within:border-[#1ed760] transition-colors">
                    <span className="py-3 text-[#727272] select-none">@</span>
                    <input
                      value={username}
                      maxLength={24}
                      onChange={e => {
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                        if (error) setError("");
                      }}
                      placeholder="handle"
                      className="min-w-0 flex-1 bg-transparent py-3 text-base sm:text-sm outline-none"
                    />
                  </div>
                </label>
              </div>

              <label className="text-xs font-bold text-[#b3b3b3] block">
                Short bio
                <textarea
                  value={bio}
                  maxLength={240}
                  onChange={e => setBio(e.target.value)}
                  placeholder="What kind of music are you into? Favorite concerts, genres, or artists…"
                  className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-[#181818] p-4 text-base sm:text-sm text-white outline-none focus:border-[#1ed760] transition-colors"
                />
              </label>

              {/* Inline error right by the button */}
              {error && (
                <p className="text-xs font-semibold text-red-400 -mt-2">
                  ⚠️ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1ed760] hover:bg-[#1db954] active:scale-[0.99] py-3.5 text-sm font-black text-black transition-all disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {busy ? (
                  <LoaderCircle size={18} className="spin text-black" />
                ) : (
                  <>
                    <span>Continue to Favorites</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </section>
        )}

        {step === 2 && (
          <SetupCard
            eyebrow="Step 2 of 4 · Optional"
            title="Add a few favorites"
            description="Favorites personalize your profile, but real listening data gives you the strongest matches."
            icon={<Headphones size={22} />}
          >
            <form onSubmit={search} className="flex gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search artists"
                className="min-w-0 flex-1 rounded-full bg-[#242424] px-4 py-2.5 text-base sm:text-sm outline-none focus:ring-1 focus:ring-[#1ed760]"
              />
              <button
                type="submit"
                className="rounded-full bg-white px-4 text-xs font-black text-black hover:bg-[#eaeaea] transition-colors"
                aria-label="Search"
              >
                <Search size={15} />
              </button>
            </form>

            {results.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {results.slice(0, 6).map(item => (
                  <button
                    key={`${item.name}-${item.artist}`}
                    type="button"
                    onClick={() => toggle(item)}
                    className="flex items-center gap-3 rounded-xl bg-[#181818] hover:bg-[#222222] p-3 text-left transition-colors"
                  >
                    <MusicArtwork item={item} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.name}</span>
                    <Check
                      size={15}
                      className={
                        favorites.some(f => f.name.toLowerCase() === item.name.toLowerCase())
                          ? "text-[#1ed760]"
                          : "text-[#444]"
                      }
                    />
                  </button>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs text-[#727272] mb-2 font-semibold">Popular picks to tap:</p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map(name => {
                  const item: MusicItem = { kind: "artist", name, artist: "" };
                  const selected = favorites.some(f => f.name.toLowerCase() === name.toLowerCase());
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle(item)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                        selected
                          ? "border-[#1ed760] bg-[#1ed760]/15 text-[#1ed760]"
                          : "border-white/10 bg-[#181818] hover:bg-[#252525] text-[#b3b3b3]"
                      }`}
                    >
                      {name} {selected && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            <Actions
              onBack={() => setStep(1)}
              onSkip={() => void advance(3)}
              onContinue={() => void advance(3)}
              busy={busy}
              error={error}
            />
          </SetupCard>
        )}

        {step === 3 && (
          <SetupCard
            eyebrow="Step 3 of 4 · Optional"
            title="Connect Last.fm"
            description="Keep future listening current through scrobbling. You can also connect it later in Settings."
            icon={<Radio size={22} />}
          >
            <LastfmCard
              connection={account.music.lastfm}
              run={perform}
              onUpdate={lastfm => onUpdateAccount(old => ({ ...old, music: { ...old.music, lastfm } }))}
            />
            <Actions
              onBack={() => setStep(2)}
              onSkip={() => void advance(4)}
              onContinue={() => void advance(4)}
              busy={busy}
              error={error}
            />
          </SetupCard>
        )}

        {step === 4 && (
          <SetupCard
            eyebrow="Step 4 of 4 · Optional"
            title="Import Spotify history"
            description="Add earlier listening for stronger matches and accurate monthly Sound Capsules. You can upload this anytime."
            icon={<Upload size={22} />}
          >
            <label className="flex items-start gap-3 rounded-xl bg-[#181818] p-4 text-xs leading-5 text-[#dedede] cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-1 accent-[#1ed760]"
              />
              <span>
                I understand and consent to SpotiMatch processing this file into music summaries. Device, IP, and account-identifying fields are not retained.
              </span>
            </label>

            {consent && (
              <SpotifyImportCard
                existing={account.music.spotify}
                onSave={snapshot => onSaveMusic("spotify", snapshot)}
              />
            )}

            {error && (
              <p className="text-xs font-semibold text-red-400">
                ⚠️ {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors"
              >
                <ArrowLeft size={15} /> Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void perform(onComplete)}
                  className="rounded-full px-4 py-2.5 text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void perform(onComplete)}
                  className="flex items-center gap-2 rounded-full bg-[#1ed760] hover:bg-[#1db954] active:scale-[0.99] px-5 py-2.5 text-xs font-black text-black disabled:opacity-50 transition-all shadow-md"
                >
                  {busy ? <LoaderCircle size={14} className="spin text-black" /> : <><span>Enter SpotiMatch</span><ArrowRight size={14} /></>}
                </button>
              </div>
            </div>

            {!account.music.lastfm && !account.music.spotify && (
              <p className="rounded-xl border border-white/10 bg-[#181818] p-3 text-xs leading-5 text-[#b3b3b3]">
                💡 You can explore SpotiMatch now and connect Last.fm or Spotify at any time from your profile or library.
              </p>
            )}
          </SetupCard>
        )}

        <details className="mt-6 rounded-2xl border border-white/10 bg-[#121212] p-4 text-xs leading-5 text-[#b3b3b3]">
          <summary className="cursor-pointer text-sm font-bold text-white">How setup and SpotiMatch work</summary>
          <div className="mt-3 space-y-2">
            <p>Favorites personalize your profile. Last.fm supplies current listening. Spotify history supplies long-term listening and monthly capsules.</p>
            <p>Matches use shared artists, songs, albums, and genres. Chat unlocks after a friend request is accepted.</p>
            <p>You can disconnect either source and remove its saved summary later.</p>
          </div>
        </details>
      </div>
    </main>
  );
}

function SetupCard({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#121212] p-5 shadow-2xl sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1ed760]/15 text-[#1ed760]">
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ed760]">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#b3b3b3]">{description}</p>
        </div>
      </div>
      <div className="mt-7 space-y-5">{children}</div>
    </section>
  );
}

function Actions({
  onBack,
  onSkip,
  onContinue,
  busy,
  error,
}: {
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  busy: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-3 border-t border-white/10 pt-5">
      {error && <p className="text-xs font-semibold text-red-400">⚠️ {error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="rounded-full px-4 py-2.5 text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onContinue}
            className="flex items-center gap-2 rounded-full bg-[#1ed760] hover:bg-[#1db954] active:scale-[0.99] px-5 py-2.5 text-xs font-black text-black disabled:opacity-50 transition-all shadow-md"
          >
            {busy ? <LoaderCircle size={14} className="spin text-black" /> : <><span>Continue</span><ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
