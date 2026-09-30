"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  Check,
  CheckCircle2,
  Disc3,
  Headphones,
  Heart,
  Music2,
  Search,
  Upload,
  X,
  ExternalLink,
  RefreshCw,
  Plus,
  LoaderCircle,
  Camera,
  Play,
  Trash2,
} from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";
import { apiJson } from "@/lib/client-api";
import { auth } from "@/lib/firebase";
import { itemKey, parseSpotifyFiles, validateItems } from "@/lib/music";
import type { MusicData, MusicItem, MusicKind, MusicSnapshot, SpotifyImport, UserProfile } from "@/types";

export const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "All time";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

export async function api(path: string, method = "GET", body?: unknown) {
  return apiJson(path, method, body);
}

export function Avatar({
  profile,
  size = "md",
  onClick,
  editable,
}: {
  profile: UserProfile | null;
  size?: "sm" | "md" | "lg" | "xl";
  onClick?: () => void;
  editable?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-28 h-28 md:w-36 md:h-36 text-3xl font-extrabold shadow-2xl",
  }[size];

  const hasPhoto =
    profile?.photoURL &&
    !failed &&
    (profile.avatar === "custom" || profile.avatar === "google" || !profile.avatar);

  return (
    <div
      onClick={onClick}
      className={`relative group rounded-full overflow-hidden flex items-center justify-center font-bold bg-[#282828] text-white border border-white/10 shrink-0 ${sizeClasses} ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.photoURL}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[#1db954] tracking-tight">
          {(profile?.displayName || "You").slice(0, 2).toUpperCase()}
        </span>
      )}

      {editable && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[11px] font-semibold gap-1">
          <Camera size={size === "xl" ? 28 : 16} />
          {size === "xl" && <span>Choose photo</span>}
        </div>
      )}
    </div>
  );
}

export function ProfileForm({
  profile,
  user,
  busy,
  editing,
  onSave,
  onOpenPhotoModal,
}: {
  profile: UserProfile | null;
  user: User | null;
  busy: boolean;
  editing: boolean;
  onSave: (fields: Partial<UserProfile>) => void;
  onOpenPhotoModal?: () => void;
}) {
  const [name, setName] = useState(profile?.displayName || user?.displayName || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatar, setAvatar] = useState<"google" | "initials" | "custom">(
    profile?.avatar || "google"
  );
  const [showTopSongs, setShowTopSongs] = useState<import("@/types").VisibilityLevel>(
    profile?.showTopSongs ?? "none"
  );
  const [showTopArtists, setShowTopArtists] = useState<import("@/types").VisibilityLevel>(
    profile?.showTopArtists ?? "none"
  );
  const [showNowPlaying, setShowNowPlaying] = useState<import("@/types").VisibilityLevel>(
    profile?.showNowPlaying ?? "none"
  );

  // Sync if profile changes (e.g. re-opened modal)
  const prevUid = useRef(profile?.uid);
  if (profile?.uid !== prevUid.current) {
    prevUid.current = profile?.uid;
  }

  const resolvedPhoto = profile?.photoURL || user?.photoURL || "";

  const VisibilitySelectComponent = ({
    label,
    hint,
    value,
    onChange,
  }: {
    label: string;
    hint: string;
    value: import("@/types").VisibilityLevel;
    onChange: (v: import("@/types").VisibilityLevel) => void;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs font-semibold text-white block">{label}</span>
        <p className="text-[11px] text-[#727272]">{hint}</p>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value as import("@/types").VisibilityLevel)}
        className="shrink-0 bg-[#242424] border border-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-[#1db954] cursor-pointer appearance-none pr-6"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23727272' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
      >
        <option value="none">🔒 Private</option>
        <option value="friends">👥 Friends only</option>
        <option value="public">🌍 Public</option>
      </select>
    </div>
  );

  return (
    <form
      className="space-y-0"
      onSubmit={e => {
        e.preventDefault();
        onSave({
          displayName: name.trim(),
          username: username.toLowerCase().trim(),
          bio: bio.trim(),
          avatar,
          showTopSongs,
          showTopArtists,
          showNowPlaying,
          showRecentToFriends: showTopSongs !== "none" || showTopArtists !== "none",
        });
      }}
    >
      <fieldset disabled={busy} className="space-y-0">
        {/* === Cover Banner === */}
        <div className="h-28 bg-gradient-to-r from-emerald-950 via-[#181818] to-purple-950 rounded-t-2xl relative">
          <div className="absolute top-3 left-4">
            <span className="px-3 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-extrabold tracking-wider uppercase text-[#1ed760] flex items-center gap-1.5 shadow">
              ⚙️ Edit Profile
            </span>
          </div>
        </div>

        {/* === Avatar + Name block === */}
        <div className="px-5 pb-4 space-y-4">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative group shrink-0 -mt-10">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#141414] bg-[#222] shadow-2xl">
                {resolvedPhoto && avatar !== "initials" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolvedPhoto} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-xl text-[#1db954] bg-[#242424]">
                    {(name || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              {onOpenPhotoModal && (
                <button
                  type="button"
                  onClick={onOpenPhotoModal}
                  className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                  title="Change profile picture"
                >
                  <Camera size={18} />
                  <span className="text-[9px] font-bold mt-0.5">Change</span>
                </button>
              )}
            </div>

            {/* Name + Username inputs */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <label className="block text-[10px] font-bold text-[#727272] uppercase tracking-wider mb-1">
                  Display name <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  maxLength={60}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="w-full px-3 py-2 text-sm bg-[#1b1b1b] border border-[#282828] focus:border-[#1db954] rounded-xl text-white placeholder-[#727272] outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#727272] uppercase tracking-wider mb-1">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-[#727272] text-sm">@</span>
                  <input
                    required
                    pattern="[a-z0-9_]{3,24}"
                    minLength={3}
                    maxLength={24}
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase())}
                    placeholder="handle"
                    autoComplete="username"
                    className="w-full pl-7 pr-3 py-2 text-sm bg-[#1b1b1b] border border-[#282828] focus:border-[#1db954] rounded-xl text-white placeholder-[#727272] outline-none transition-colors"
                  />
                </div>
                <p className="text-[10px] text-[#727272] mt-0.5">3-24 letters, numbers, or underscores</p>
              </div>
            </div>
          </div>

          {/* Use initials checkbox */}
          <label className="flex items-center gap-2 text-xs text-[#b3b3b3] cursor-pointer">
            <input
              type="checkbox"
              checked={avatar === "initials"}
              onChange={e => setAvatar(e.target.checked ? "initials" : "google")}
              className="accent-[#1db954]"
            />
            Use initials instead of photo
          </label>

          {/* === Vibe / Bio === */}
          <div className="p-3.5 bg-[#1b1b1b] border border-white/5 rounded-2xl space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-[#727272] uppercase tracking-wider">Musical Vibe / Bio</span>
              <span className="text-[10px] text-[#727272]">{bio.length}/240</span>
            </div>
            <textarea
              rows={3}
              maxLength={240}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Always listening toâ€¦ / Favorite concert memoriesâ€¦"
              className="w-full px-0 py-1 text-xs bg-transparent text-white placeholder-[#555] outline-none resize-none leading-relaxed"
            />
          </div>

          {/* === Privacy · Profile Visibility === */}
          <div className="p-3.5 bg-[#1b1b1b] border border-white/5 rounded-2xl space-y-3.5">
            <div>
              <span className="text-[10px] font-bold text-[#727272] uppercase tracking-wider block mb-0.5">
                Privacy · Profile Visibility
              </span>
              <p className="text-[11px] text-[#727272]">
                Choose who can see each section on your profile card.
              </p>
            </div>

            <VisibilitySelectComponent
              label="This Month's Top 5 Songs"
              hint="Your monthly top tracks on your profile card"
              value={showTopSongs}
              onChange={setShowTopSongs}
            />

            <VisibilitySelectComponent
              label="This Month's Top 5 Artists"
              hint="Your monthly top artists on your profile card"
              value={showTopArtists}
              onChange={setShowTopArtists}
            />

            <VisibilitySelectComponent
              label="Now Playing"
              hint="Show your currently playing track in real time"
              value={showNowPlaying}
              onChange={setShowNowPlaying}
            />
          </div>

          {/* === Save button === */}
          <div className="pt-1 border-t border-[#242424]">
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-bold text-black bg-[#1db954] hover:bg-[#1ed760] hover:scale-[1.01] active:scale-[0.99] rounded-full transition-all shadow-md cursor-pointer"
            >
              {editing ? "Save profile" : "Create Profile"}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

const clientArtworkCache = new Map<string, string>();

export function MusicArtwork({
  item,
  size = "md",
}: {
  item: MusicItem;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  const [resolvedImage, setResolvedImage] = useState<string>(item.image || "");
  const [failedUrl, setFailedUrl] = useState("");

  const sizeClasses = {
    sm: "w-8 h-8 rounded",
    md: "w-11 h-11 rounded-md",
    lg: "w-16 h-16 rounded-md",
    xl: "w-24 h-24 sm:w-28 sm:h-28",
    full: "w-full h-full",
  }[size] || "w-11 h-11 rounded-md";

  const isArtist = item.kind === "artist";

  useEffect(() => {
    if (item.image) {
      setResolvedImage(item.image);
      return;
    }

    const key = `${item.kind}:::${item.name.toLowerCase()}:::${(item.artist || "").toLowerCase()}`;
    if (clientArtworkCache.has(key)) {
      setResolvedImage(clientArtworkCache.get(key) || "");
      return;
    }

    let active = true;
    const params = new URLSearchParams({
      kind: item.kind,
      name: item.name,
      ...(item.artist ? { artist: item.artist } : {}),
    });

    fetch(`/api/artwork?${params}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (data.image) {
          clientArtworkCache.set(key, data.image);
          setResolvedImage(data.image);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [item.kind, item.name, item.artist, item.image]);

  const activeImage = item.image || resolvedImage;

  return (
    <span
      className={`relative flex items-center justify-center shrink-0 bg-[#282828] text-[#b3b3b3] overflow-hidden ${sizeClasses} ${
        isArtist ? "rounded-full" : ""
      }`}
    >
      {activeImage && failedUrl !== activeImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeImage}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(activeImage)}
          className="w-full h-full object-cover animate-fadeIn"
        />
      ) : isArtist ? (
        <Headphones size={size === "sm" ? 14 : size === "lg" || size === "xl" || size === "full" ? 32 : 18} />
      ) : item.kind === "album" ? (
        <Disc3 size={size === "sm" ? 14 : size === "lg" || size === "xl" || size === "full" ? 32 : 18} />
      ) : (
        <Music2 size={size === "sm" ? 14 : size === "lg" || size === "xl" || size === "full" ? 32 : 18} />
      )}
    </span>
  );
}

export function MusicChips({
  items,
  onRemove,
  onPlay,
}: {
  items: MusicItem[];
  onRemove?: (item: MusicItem) => void;
  onPlay?: (item: MusicItem) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {items.map((item, index) => (
        <div
          key={`chip-${itemKey(item)}-${index}`}
          className="group relative flex items-center gap-3 p-2 bg-[#181818] hover:bg-[#282828] border border-[#282828] rounded-md transition-colors"
        >
          <MusicArtwork item={item} size="sm" />
          <div className="flex-1 min-w-0 pr-6">
            <span className="block text-xs font-semibold text-white truncate">{item.name}</span>
            <span className="block text-[11px] text-[#b3b3b3] truncate">
              {item.artist || (item.kind === "artist" ? "Artist" : "Music")}
              {item.plays ? ` · ${item.plays.toLocaleString()} plays` : ""}
            </span>
          </div>

          {onPlay && (
            <button
              onClick={() => onPlay(item)}
              aria-label={`Play ${item.name}`}
              className="absolute right-8 opacity-0 group-hover:opacity-100 p-1.5 bg-[#1db954] text-black rounded-full hover:scale-110 transition-all shadow-md"
            >
              <Play size={11} fill="currentColor" />
            </button>
          )}

          {onRemove && (
            <button
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item.name}`}
              className="p-1 text-[#727272] hover:text-white rounded hover:bg-[#333] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Favorites({
  initial,
  onSave,
  onDirty,
}: {
  initial: MusicItem[];
  onSave: (items: MusicItem[]) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<MusicKind>("artist");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const searchVersion = useRef(0);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError("");
    setResults([]);
    const version = ++searchVersion.current;
    try {
      const data = await api("/api/catalog?" + new URLSearchParams({ kind, q: query }));
      if (version !== searchVersion.current) return;
      setResults(data.items);
      if (!data.items.length) setError("No catalog matches found. You can add it manually below.");
    } catch (err) {
      if (version === searchVersion.current) setError(message(err));
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  }

  function resetSearch() {
    searchVersion.current++;
    setResults([]);
    setError("");
    setSearching(false);
  }

  function add(item: MusicItem) {
    try {
      update(validateItems([...items.filter(old => itemKey(old) !== itemKey(item)), item]));
      setError("");
    } catch (err) {
      setError(message(err));
    }
  }

  function update(next: MusicItem[]) {
    setItems(next);
    onDirty(JSON.stringify(next) !== JSON.stringify(initial));
  }

  return (
    <section className="bg-[#181818] border border-[#282828] rounded-xl p-5 md:p-6 space-y-6 text-white shadow-xl">
      {/* Category Pills */}
      <div className="flex gap-2 border-b border-[#282828] pb-4">
        {(["artist", "track", "album"] as const).map(value => (
          <button
            key={value}
            onClick={() => {
              setKind(value);
              resetSearch();
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${
              kind === value
                ? "bg-white text-black"
                : "bg-[#282828] text-[#b3b3b3] hover:text-white"
            }`}
          >
            {value === "artist" ? (
              <Headphones size={13} />
            ) : value === "track" ? (
              <Music2 size={13} />
            ) : (
              <Disc3 size={13} />
            )}
            {value === "track" ? "Tracks" : value === "album" ? "Albums" : "Artists"}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <form onSubmit={search} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-[#727272]" />
          <input
            required
            minLength={2}
            maxLength={100}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              resetSearch();
            }}
            placeholder={`Search for your favorite ${kind}sâ€¦`}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#242424] border border-transparent focus:border-white rounded-full text-white placeholder-[#727272] outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-5 py-2.5 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all shrink-0"
        >
          {searching ? "Searchingâ€¦" : "Search"}
        </button>
      </form>

      {error && <p className="text-xs text-amber-400 bg-amber-950/40 p-3 rounded-lg border border-amber-900/60">{error}</p>}

      {searching && (
        <div className="flex items-center gap-2 text-xs text-[#b3b3b3] py-2">
          <LoaderCircle size={15} className="spin text-[#1db954]" />
          Searching Spotify & Last.fm catalogsâ€¦
        </div>
      )}

      {!!results.length && <CatalogResults results={results} items={items} onAdd={add} />}

      {/* Manual Entry Collapsible */}
      <details className="bg-[#121212] border border-[#282828] rounded-xl p-4 text-xs">
        <summary className="font-semibold text-[#b3b3b3] hover:text-white cursor-pointer select-none">
          + Add a favorite manually
        </summary>
        <form
          onSubmit={e => {
            e.preventDefault();
            add({
              kind,
              name: name.trim(),
              artist: kind === "artist" ? "" : artist.trim(),
            });
            setName("");
            setArtist("");
          }}
          className="mt-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#727272] mb-1">
                {kind === "artist" ? "Artist Name" : kind === "track" ? "Song Title" : "Album Title"}
              </label>
              <input
                required
                maxLength={200}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={kind === "artist" ? "Radiohead" : kind === "track" ? "Reckoner" : "In Rainbows"}
                className="w-full px-3 py-2 bg-[#181818] border border-[#282828] rounded-md text-white outline-none focus:border-[#1db954]"
              />
            </div>
            {kind !== "artist" && (
              <div>
                <label className="block text-[11px] text-[#727272] mb-1">Artist Name</label>
                <input
                  required
                  maxLength={200}
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  placeholder="Radiohead"
                  className="w-full px-3 py-2 bg-[#181818] border border-[#282828] rounded-md text-white outline-none focus:border-[#1db954]"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold bg-[#282828] hover:bg-[#383838] text-white rounded-full transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Add {kind}
          </button>
        </form>
      </details>

      {/* Selected Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">
            Selected Favorites
          </h3>
          <span className="text-xs text-[#727272]">{items.length} / 100 picks</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[#282828] rounded-xl text-[#727272]">
            <Heart size={24} className="mx-auto mb-2 text-[#444]" />
            <p className="text-xs">No favorites picked yet. Search or add a few!</p>
          </div>
        ) : (
          <MusicChips
            items={items}
            onRemove={item => update(items.filter(old => itemKey(old) !== itemKey(item)))}
          />
        )}
      </div>

      {/* Save Action */}
      <div className="flex items-center justify-between pt-4 border-t border-[#282828]">
        <span className="text-xs text-[#727272]">
          {dirty ? "Unsaved changes." : "All favorites saved."}
        </span>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => onSave(items)}
          className="px-6 py-2.5 text-xs font-bold text-black bg-[#1db954] hover:bg-[#1ed760] disabled:bg-[#282828] disabled:text-[#727272] rounded-full transition-all flex items-center gap-1.5 shadow-md"
        >
          <Check size={14} /> Save favorites
        </button>
      </div>
    </section>
  );
}

export function Snapshot({
  snapshot,
  source,
}: {
  snapshot: MusicSnapshot;
  source: "lastfm" | "spotify";
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-[#727272]">
        <span>
          {source === "spotify"
            ? `${formatDate(snapshot.from)} â€“ ${formatDate(snapshot.to)}`
            : "Top artists & tracks"}
        </span>
        <span>Updated {formatDate(snapshot.updatedAt)}</span>
      </div>
      <MusicChips items={snapshot.items.filter(item => item.kind === "artist").slice(0, 6)} />
      <details className="text-xs text-[#727272]">
        <summary className="cursor-pointer hover:text-white py-1">View tracks and albums</summary>
        <div className="mt-2">
          <MusicChips items={snapshot.items.filter(item => item.kind !== "artist").slice(0, 18)} />
        </div>
      </details>
    </div>
  );
}

export function LastfmCard({
  connection,
  run,
  onUpdate,
}: {
  connection: MusicData["lastfm"];
  run: (task: () => Promise<void>) => Promise<void>;
  onUpdate: (value: MusicData["lastfm"]) => void;
}) {
  return (
    <section className="bg-[#181818] border border-[#282828] rounded-xl p-5 md:p-6 space-y-5 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#b90000]/20 text-[#ff4d4d] font-serif font-black text-xl flex items-center justify-center">
            as
          </div>
          <div>
            <h2 className="text-sm font-bold">Last.fm Live Scrobbler</h2>
            <p className="text-xs text-[#b3b3b3]">Real-time Now Playing & 5 Recent Tracks</p>
          </div>
        </div>
        {connection && (
          <span className="px-3 py-1 bg-[#1db954]/20 text-[#1db954] text-xs font-semibold rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1db954] animate-ping" />
            Live Sync
          </span>
        )}
      </div>

      {connection ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[#121212] rounded-lg text-xs">
            <span className="font-semibold text-white">@{connection.username}</span>
            <span className="text-[#727272]">Connected {formatDate(connection.connectedAt)}</span>
          </div>

          {/* Live Now Playing Banner */}
          {connection.nowPlaying ? (
            <div className="p-3.5 bg-gradient-to-r from-[#121212] to-[#1a2e1d] border border-[#1db954]/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1db954]">
                  <span className="w-2 h-2 rounded-full bg-[#1db954] animate-pulse" />
                  Currently Scrobbled (Now Playing)
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-[#1db954]/20 text-[#1db954] font-bold rounded-full">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#242424] overflow-hidden shrink-0 shadow">
                  <MusicArtwork item={connection.nowPlaying} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white truncate">
                    {connection.nowPlaying.name}
                  </span>
                  <span className="block text-[11px] text-[#b3b3b3] truncate">
                    {connection.nowPlaying.artist}
                    {connection.nowPlaying.album ? ` â€¢ ${connection.nowPlaying.album}` : ""}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#121212] border border-[#242424] rounded-xl flex items-center justify-between text-xs text-[#727272]">
              <span>Playback status</span>
              <span className="text-[#b3b3b3]">Idle (No track scrobbling right now)</span>
            </div>
          )}

          {/* 5 Recently Played Tracks */}
          {connection.recentTracks && connection.recentTracks.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#b3b3b3] flex items-center justify-between">
                <span>5 Recently Played Tracks</span>
                <span className="text-[10px] text-[#727272] lowercase font-normal">latest scrobbles</span>
              </h3>
              <div className="space-y-1">
                {connection.recentTracks.slice(0, 5).map((track, idx) => (
                  <div
                    key={`lastfm-card-track-${track.name}-${idx}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[#121212] hover:bg-[#1a1a1a] transition-colors"
                  >
                    <span className="text-xs font-mono text-[#727272] w-4 text-center">
                      {idx + 1}
                    </span>
                    <MusicArtwork item={track} size="sm" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-white truncate">
                        {track.name}
                      </span>
                      <span className="block text-[11px] text-[#b3b3b3] truncate">
                        {track.artist}
                        {track.album ? ` â€¢ ${track.album}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5 Recently Played Artists */}
          {connection.recentArtists && connection.recentArtists.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#b3b3b3]">
                5 Recently Played Artists
              </h3>
              <div className="flex flex-wrap gap-2">
                {connection.recentArtists.slice(0, 5).map((artist, idx) => (
                  <div
                    key={`lastfm-card-artist-${artist.name}-${idx}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] rounded-full border border-[#242424]"
                  >
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-[#242424] shrink-0">
                      <MusicArtwork item={artist} size="sm" />
                    </div>
                    <span className="text-xs font-semibold text-white">{artist.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!connection.recentTracks?.length && !connection.nowPlaying && (
            <p className="text-xs text-[#727272] py-2">
              Connected. Your real-time listening history will appear once you scrobble tracks on Last.fm.
            </p>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-[#242424]">
            <button
              onClick={() =>
                run(async () => {
                  const storageKey = `lastfm_synced_${auth?.currentUser?.uid || ""}`;
                  let lastSynced = 0;
                  try {
                    lastSynced = Number(sessionStorage.getItem(storageKey) || 0);
                  } catch {
                    // Ignore storage errors
                  }
                  const elapsed = Date.now() - lastSynced;
                  if (elapsed < 15000) {
                    const remainingSecs = Math.ceil((15000 - elapsed) / 1000);
                    throw new Error(`Real-time data recently updated. Please wait ${remainingSecs}s before manual refresh.`);
                  }
                  try {
                    sessionStorage.setItem(storageKey, Date.now().toString());
                  } catch {
                    // Ignore storage errors
                  }

                  const data = await api("/api/lastfm", "POST");
                  onUpdate({
                    ...connection,
                    snapshot: data.snapshot,
                    nowPlaying: data.live?.nowPlaying ?? connection.nowPlaying,
                    recentTracks: data.live?.recentTracks ?? connection.recentTracks,
                    recentArtists: data.live?.recentArtists ?? connection.recentArtists,
                  });
                })
              }
              className="px-4 py-2 text-xs font-semibold bg-[#282828] hover:bg-[#383838] text-white rounded-full flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} /> Refresh Now
            </button>
            <button
              onClick={() =>
                run(async () => {
                  if (
                    !window.confirm(
                      "Disconnect Last.fm and remove its summary? Favorites and Spotify history stay."
                    )
                  )
                    return;
                  await api("/api/lastfm", "DELETE");
                  onUpdate(null);
                })
              }
              className="text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="text-xs text-[#b3b3b3] space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#1db954]" />
              Real-time Now Playing track displayed in bottom soundtrack bar
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#1db954]" />
              5 most recently played tracks & 5 recent artists synced live
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#1db954]" />
              Connects directly without Spotify developer keys
            </li>
          </ul>

          <button
            onClick={() =>
              run(async () => {
                const data = await api("/api/lastfm/connect", "POST");
                window.location.assign(data.url);
              })
            }
            className="px-6 py-2.5 text-xs font-bold text-black bg-[#1db954] hover:bg-[#1ed760] rounded-full transition-all flex items-center gap-1.5 shadow-md"
          >
            Connect Last.fm <ExternalLink size={14} />
          </button>
        </div>
      )}
    </section>
  );
}

export function SpotifyImportCard({
  existing,
  onSave,
}: {
  existing: SpotifyImport | null;
  onSave: (snapshot: SpotifyImport | null) => Promise<void>;
}) {
  const [pending, setPending] = useState<SpotifyImport | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    setParsing(true);
    setError("");
    setPending(null);
    try {
      const selected = [...files];
      const extractedFiles: { name: string; text: string }[] = [];

      for (const file of selected) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".zip")) {
          const buf = await file.arrayBuffer();
          const unzipped = unzipSync(new Uint8Array(buf));
          for (const [path, content] of Object.entries(unzipped)) {
            const fileName = path.split("/").pop() || path;
            const pathLower = path.toLowerCase();
            if (pathLower.includes("__macosx") || fileName.startsWith(".") || !pathLower.endsWith(".json")) {
              continue;
            }
            const textContent = strFromU8(content);
            if (
              pathLower.includes("streaming") ||
              pathLower.includes("endsong") ||
              pathLower.includes("history") ||
              textContent.includes("master_metadata_track_name") ||
              textContent.includes("msPlayed") ||
              textContent.includes("ms_played")
            ) {
              extractedFiles.push({ name: fileName, text: textContent });
            }
          }
        } else if (lower.endsWith(".json")) {
          extractedFiles.push({ name: file.name, text: await file.text() });
        } else {
          throw new Error("Upload your Spotify ZIP download directly or streaming history JSON files.");
        }
      }

      if (!extractedFiles.length) {
        throw new Error(
          "No Spotify streaming history files were found in the uploaded file(s). Please ensure your ZIP archive contains your Spotify StreamingHistory*.json or Streaming_History_Audio_*.json files."
        );
      }

      const totalSize = extractedFiles.reduce((sum, f) => sum + f.text.length, 0);
      if (totalSize > 80 * 1024 * 1024) {
        throw new Error("History files exceed 80 MB. Select a smaller archive or fewer files.");
      }

      const parsed = await parseSpotifyFiles(extractedFiles);
      if (parsed.fingerprint === existing?.fingerprint) {
        throw new Error("This history is already imported. Nothing was added twice.");
      }
      setPending(parsed);
    } catch (err) {
      setError(message(err));
    } finally {
      setParsing(false);
    }
  }

  const saved = pending && pending.fingerprint === existing?.fingerprint;

  return (
    <section className="bg-[#181818] border border-[#282828] rounded-xl p-5 md:p-6 space-y-5 text-white shadow-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1db954]/20 text-[#1db954] flex items-center justify-center">
          <Upload size={20} />
        </div>
        <div>
          <h2 className="text-sm font-bold">Spotify History Import</h2>
          <p className="text-xs text-[#b3b3b3]">
            Upload your Spotify data ZIP directly or individual JSON files
          </p>
        </div>
      </div>

      <label
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          void readFiles(e.dataTransfer.files);
        }}
        className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center group ${
          isDragging
            ? "border-[#1db954] bg-[#1db954]/10"
            : "border-[#282828] hover:border-[#1db954] bg-[#121212]"
        }`}
      >
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed,.json,application/json"
          multiple
          disabled={parsing}
          onChange={e => {
            void readFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
            isDragging
              ? "bg-[#1db954] text-black"
              : "bg-[#282828] group-hover:bg-[#1db954] text-[#b3b3b3] group-hover:text-black"
          }`}
        >
          {parsing ? <LoaderCircle size={22} className="spin" /> : <Upload size={22} />}
        </div>
        <strong className="text-sm font-bold text-white mb-1">
          {parsing ? "Extracting & parsing streamsâ€¦" : "Drop your Spotify ZIP or JSON files here"}
        </strong>
        <span className="text-xs text-[#727272]">
          Directly upload my_spotify_data.zip or StreamingHistory*.json files
        </span>
      </label>

      {error && <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-lg border border-red-900/60">{error}</p>}

      {pending && !saved && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">Parsed Summary ({pending.fileCount} files)</span>
            <span className="text-[#1db954] font-bold">
              {pending.totalPlays.toLocaleString()} plays found
            </span>
          </div>
          <Snapshot snapshot={pending} source="spotify" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSave(pending)}
              className="px-6 py-2.5 text-xs font-bold text-black bg-[#1db954] hover:bg-[#1ed760] rounded-full transition-all shadow-md flex items-center gap-1.5"
            >
              <Check size={14} /> Save this history
            </button>
            <button
              onClick={() => setPending(null)}
              className="text-xs text-[#b3b3b3] hover:text-white"
            >
              Discard preview
            </button>
          </div>
        </div>
      )}

      {existing && (!pending || saved) && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#1db954] flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Currently saved ({existing.totalPlays.toLocaleString()} plays)
            </span>
            <button
              onClick={async () => {
                if (window.confirm("Remove imported Spotify history?")) {
                  await onSave(null);
                  setPending(null);
                }
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove history
            </button>
          </div>
          <Snapshot snapshot={existing} source="spotify" />
        </div>
      )}
    </section>
  );
}

export function CatalogResults({
  results,
  items,
  onAdd,
}: {
  results: MusicItem[];
  items: MusicItem[];
  onAdd: (item: MusicItem) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[#727272] px-1">
        <span>Results</span>
        <span>Ranked by relevance</span>
      </div>
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {results.map((item, index) => {
          const selected = items.some(old => itemKey(old) === itemKey(item));
          return (
            <div
              key={`cat-${itemKey(item)}-${index}`}
              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                selected ? "bg-[#282828] border border-[#1db954]/40" : "bg-[#121212] hover:bg-[#202020]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs text-[#727272] w-4 text-center">{index + 1}</span>
                <MusicArtwork item={item} size="sm" />
                <div className="min-w-0 pr-2">
                  <span className="block text-xs font-semibold text-white truncate">{item.name}</span>
                  <span className="block text-[11px] text-[#b3b3b3] truncate">
                    {item.kind === "artist" ? "Artist" : item.artist}
                    {item.album ? ` · ${item.album}` : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onAdd(item)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1 ${
                    selected
                      ? "bg-[#1db954] text-black"
                      : "bg-[#282828] text-white hover:bg-[#333]"
                  }`}
                >
                  {selected ? <Check size={13} /> : <Plus size={13} />}
                  <span>{selected ? "Added" : "Add"}</span>
                </button>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-[#727272] hover:text-white"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

