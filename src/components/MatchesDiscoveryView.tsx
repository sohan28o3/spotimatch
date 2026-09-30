"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Flag,
  Info,
  MessageCircle,
  LoaderCircle,
  Send,
  ShieldOff,
  SkipForward,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { AccountData, FriendRequest, FriendUser, TasteMatch } from "@/types";
import type { SpotifyTab } from "@/components/SpotifyViews";
import type { UserProfileModalUser } from "@/components/UserProfileModal";
import { authenticatedFetch } from "@/lib/client-api";

type MatchTab = "discover" | "requests" | "friends" | "previous";

interface DiscoveryResponse {
  locked: boolean;
  sourceCount: number;
  day: string;
  matches: TasteMatch[];
  dailyTotal?: number;
  limitedSupply?: boolean;
  previousMatches?: TasteMatch[];
}

const sectionLabels: Record<string, string> = {
  best: "Best Matches",
  current: "Same Obsession",
  artist: "Same Top Artist",
  genre: "Same Top Genre",
  expand: "Expand Your Sound",
};

function localDay(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function MatchAvatar({ match }: { match: Pick<TasteMatch, "avatarUrl" | "name"> }) {
  return match.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={match.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    <span className="text-xl font-black text-[#1ed760]">{match.name.slice(0, 2).toUpperCase()}</span>
  );
}

export function MatchesView({
  account,
  onNavigate,
  onOpenUserProfile,
  onStartDirectChat,
  onOpenSourceModal,
}: {
  account: AccountData;
  onNavigate: (tab: SpotifyTab) => void;
  onOpenUserProfile?: (user: UserProfileModalUser) => void;
  onStartDirectChat?: (friend: FriendUser) => void;
  onOpenSourceModal: (source: "favorites" | "lastfm" | "spotify") => void;
}) {
  const [tab, setTab] = useState<MatchTab>("discover");
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [composerTarget, setComposerTarget] = useState<TasteMatch | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [featureToggles, setFeatureToggles] = useState<{ friendRequests: boolean; discovery: boolean; globalChat: boolean }>({ 
    friendRequests: true, 
    discovery: true, 
    globalChat: true 
  });

  const load = useCallback(async () => {
    const [matchesResponse, socialResponse] = await Promise.all([
      authenticatedFetch(`/api/matches?day=${localDay()}`),
      authenticatedFetch("/api/friends"),
    ]);
    if (matchesResponse.ok) setDiscovery(await matchesResponse.json());
    if (socialResponse.ok) {
      const social = await socialResponse.json();
      setFriends(social.friends || []);
      setRequests(social.incomingRequests || []);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

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

  const groups = useMemo(() => {
    const result = new Map<string, TasteMatch[]>();
    for (const match of discovery?.matches || []) {
      const section = match.matchSection || "best";
      result.set(section, [...(result.get(section) || []), match]);
    }
    return Array.from(result.entries());
  }, [discovery?.matches]);

  function openProfile(match: TasteMatch) {
    onOpenUserProfile?.({ ...match, uid: match.id, photoURL: match.avatarUrl });
  }

  async function skip(match: TasteMatch) {
    if (!discovery) return;
    setDiscovery(current => current ? { ...current, matches: current.matches.filter(item => item.id !== match.id), previousMatches: [match, ...(current.previousMatches || []).filter(item => item.id !== match.id)] } : current);
    await authenticatedFetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", candidateId: match.id, day: discovery.day }),
    });
  }

  async function report(match: TasteMatch) {
    if (!discovery || !window.confirm(`Report ${match.name} and remove them from discovery?`)) return;
    setDiscovery(current => current ? { ...current, matches: current.matches.filter(item => item.id !== match.id) } : current);
    await authenticatedFetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report", candidateId: match.id, day: discovery.day }),
    });
    setNotice("Report submitted. This profile has been removed from discovery.");
  }

  async function block(match: TasteMatch) {
    if (!window.confirm(`Block ${match.name}? You will no longer see each other in discovery or chat.`)) return;
    setDiscovery(current => current ? { ...current, matches: current.matches.filter(item => item.id !== match.id), previousMatches: (current.previousMatches || []).filter(item => item.id !== match.id) } : current);
    await authenticatedFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "block_user", targetId: match.id }),
    });
    setNotice(`${match.name} was blocked.`);
  }

  // Guard sendRequest with friendRequests toggle
  async function sendRequest() {
    if (!featureToggles.friendRequests) {
      setNotice('Friend request feature is currently down.');
      return;
    }
    if (!composerTarget) return;
    setBusyId(composerTarget.id);
    const response = await authenticatedFetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_request',
        targetId: composerTarget.id,
        targetUsername: composerTarget.username,
        matchScore: composerTarget.matchScore,
        sharedArtists: composerTarget.sharedArtists,
        vibe: composerTarget.vibe,
        matchReason: composerTarget.matchReason,
        message: requestMessage.trim(),
      }),
    });
    setBusyId('');
    if (!response.ok) return;
    setDiscovery(current =>
      current ? { ...current, matches: current.matches.filter(item => item.id !== composerTarget.id) } : current
    );
    setNotice(`Request sent to ${composerTarget.name}.`);
    setComposerTarget(null);
    setRequestMessage('');
  }

  async function respond(request: FriendRequest, action: "accept_request" | "decline_request") {
    setBusyId(request.id);
    const response = await authenticatedFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId: request.id, fromUserId: request.fromUserId }),
    });
    setBusyId("");
    if (response.ok) {
      setRequests(current => current.filter(item => item.id !== request.id));
      setNotice(action === "accept_request" ? `You and ${request.fromName} are now friends.` : "Request ignored.");
      if (action === "accept_request") void load();
    }
  }

  const connectedSource = account.music.lastfm ? "Last.fm" : "Spotify history";

  // If discovery feature is disabled, show placeholder and skip rest of UI
  if (!featureToggles.discovery) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-24 pt-5 md:px-8 md:pt-8">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Discovery</h1>
        </header>
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
          Discovery feature is currently down.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-24 pt-5 md:px-8 md:pt-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1db954]">Music discovery</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Your Daily Music Matches</h1>
            <p className="mt-2 text-sm text-[#b3b3b3]">Up to five people selected from genuine listening compatibility. Refreshes tomorrow.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-[#181818] px-3 py-1.5 text-xs font-bold text-[#b3b3b3]">
            {discovery?.matches.length || 0} remaining today
          </span>
        </div>
      </header>

      {notice && <div className="flex items-center gap-2 rounded-xl border border-[#1db954]/30 bg-[#1db954]/10 px-4 py-3 text-sm font-bold text-[#1ed760]"><Check size={16} />{notice}</div>}

      <nav className="no-scrollbar flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
        {([
          ["discover", "Discover", discovery?.matches.length || 0],
          ["requests", "Requests", requests.length],
          ["friends", "Friends", friends.length],
          ["previous", "Previous", discovery?.previousMatches?.length || 0],
        ] as Array<[MatchTab, string, number]>).map(([value, label, count]) => (
          <button key={value} onClick={() => setTab(value)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${tab === value ? "border-white bg-white text-black" : "border-white/10 bg-[#181818] text-[#b3b3b3]"}`}>
            {label}{count > 0 ? ` ${count}` : ""}
          </button>
        ))}
      </nav>

      {!discovery && (
        <section className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#141414] p-8 text-center">
          <LoaderCircle className="spin text-[#1ed760]" size={32} />
          <h2 className="mt-4 text-lg font-black text-white">Finding your music matches</h2>
          <p className="mt-1 text-sm text-[#727272]">Comparing listening history and shared taste…</p>
        </section>
      )}

      {discovery?.locked && tab === "discover" && (
        <section className="relative min-h-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[#141414]">
          <div className="absolute inset-0 grid grid-cols-1 gap-4 p-6 opacity-30 blur-md md:grid-cols-2" aria-hidden="true">
            {[1, 2, 3, 4].map(item => <div key={item} className="rounded-2xl bg-[#282828]" />)}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-5">
            <div className="max-w-lg rounded-3xl border border-white/15 bg-[#181818]/95 p-7 text-center shadow-2xl backdrop-blur-xl">
              <Sparkles className="mx-auto text-[#1db954]" size={28} />
              <h2 className="mt-4 text-2xl font-black text-white">Connect your listening to discover people</h2>
              <p className="mt-2 text-sm leading-6 text-[#b3b3b3]">Matches require real listening data. Connect Last.fm for current activity or import Spotify history for long-term taste.</p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <button onClick={() => onOpenSourceModal("lastfm")} className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-black">Connect Last.fm</button>
                <button onClick={() => onOpenSourceModal("spotify")} className="rounded-full bg-[#1db954] px-5 py-2.5 text-sm font-black text-black">Import Spotify history</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {!discovery?.locked && discovery?.sourceCount === 1 && tab === "discover" && (
        <div className="flex gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
          <Info className="mt-0.5 shrink-0 text-amber-300" size={17} />
          <div><strong>Matches currently use {connectedSource}.</strong><p className="mt-1 text-xs leading-5 text-amber-100/70">Connect the other source for a more accurate mix of long-term taste and current listening.</p></div>
        </div>
      )}

      {tab === "discover" && !discovery?.locked && Boolean(discovery?.matches.length) && discovery?.limitedSupply && (
        <div className="flex gap-3 rounded-2xl border border-[#1db954]/25 bg-[#1db954]/10 p-4 text-sm text-[#d8fce5]">
          <Users className="mt-0.5 shrink-0 text-[#1ed760]" size={17} />
          <div><strong>More listeners are joining.</strong><p className="mt-1 text-xs leading-5 text-[#b3d9c1]">These are the compatible profiles available right now. We&apos;ll add more matches as new listeners finish setting up.</p></div>
        </div>
      )}

      {tab === "discover" && !discovery?.locked && groups.map(([section, items]) => (
        <section key={section} className="space-y-3">
          <div><h2 className="text-xl font-black text-white">{sectionLabels[section]}</h2><p className="text-xs text-[#727272]">Chosen by the strongest reason you connect.</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map(match => (
              <article key={match.id} onClick={() => openProfile(match)} className="group cursor-pointer rounded-2xl border border-white/10 bg-[#181818] p-4 shadow-lg transition hover:border-white/20 hover:bg-[#202020]">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#242424]"><MatchAvatar match={match} /></div>
                  <div className="min-w-0 flex-1"><h3 className="truncate font-extrabold text-white">{match.name}</h3><p className="truncate text-xs text-[#727272]">@{match.username}</p></div>
                  <span className="rounded-full bg-[#1db954]/15 px-2.5 py-1 text-xs font-black text-[#1ed760]">{match.matchScore}%</span>
                </div>
                <div className="mt-4 rounded-xl border border-white/5 bg-[#141414] p-3"><p className="text-sm font-bold text-white">{match.matchReason}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#b3b3b3]">{match.matchDetail}</p></div>
                <div className="mt-4 flex gap-2 border-t border-white/5 pt-3">
                  <button onClick={event => { event.stopPropagation(); setComposerTarget(match); }} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1db954] px-3 py-2 text-xs font-black text-black"><UserCheck size={14} />Connect</button>
                  <button onClick={event => { event.stopPropagation(); void skip(match); }} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-[#b3b3b3] hover:text-white"><SkipForward size={14} />Skip</button>
                  <button aria-label={`Report ${match.name}`} title="Report" onClick={event => { event.stopPropagation(); void report(match); }} className="rounded-full border border-white/10 p-2 text-[#727272] hover:border-rose-400/40 hover:text-rose-300"><Flag size={14} /></button>
                  <button aria-label={`Block ${match.name}`} title="Block" onClick={event => { event.stopPropagation(); void block(match); }} className="rounded-full border border-white/10 p-2 text-[#727272] hover:border-rose-400/40 hover:text-rose-300"><ShieldOff size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {tab === "discover" && !discovery?.locked && discovery?.matches.length === 0 && (
        <section className="rounded-3xl border border-white/10 bg-[#141414] p-8 text-center md:p-12">
          <Clock className="mx-auto text-[#1db954]" size={30} /><h2 className="mt-4 text-2xl font-black text-white">You&apos;re caught up for now</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#b3b3b3]">Waiting for more listeners to join and generate new matches. We&apos;ll notify you when someone compatible becomes available.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><button onClick={() => onNavigate("chat")} className="rounded-full bg-[#1db954] px-5 py-2.5 text-sm font-black text-black">Open Global Chat</button>{Boolean(discovery?.previousMatches?.length) && <button onClick={() => setTab("previous")} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white">Review skipped profiles</button>}</div>
        </section>
      )}

      {tab === "requests" && <section className="space-y-3">{requests.length === 0 ? <EmptyState title="No pending requests" text="New connection requests and their messages will appear here." /> : requests.map(request => <article key={request.id} className="rounded-2xl border border-white/10 bg-[#181818] p-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#242424]"><MatchAvatar match={{ name: request.fromName, avatarUrl: request.fromAvatarUrl }} /></div><div className="min-w-0 flex-1"><p className="font-bold text-white">{request.fromName}</p><p className="text-xs text-[#727272]">@{request.fromUsername} · {request.matchScore}% match</p></div></div>{request.matchReason && <p className="mt-3 text-xs font-bold text-[#1ed760]">{request.matchReason}</p>}{request.message && <blockquote className="mt-3 rounded-xl border border-white/5 bg-[#141414] p-3 text-sm text-[#dedede]">“{request.message}”</blockquote>}<div className="mt-4 flex gap-2"><button disabled={busyId === request.id} onClick={() => void respond(request, "accept_request")} className="rounded-full bg-[#1db954] px-5 py-2 text-xs font-black text-black">Accept</button><button disabled={busyId === request.id} onClick={() => void respond(request, "decline_request")} className="rounded-full border border-white/10 px-5 py-2 text-xs font-bold text-white">Ignore</button></div></article>)}</section>}

      {tab === "friends" && <section className="grid gap-3 md:grid-cols-2">{friends.length === 0 ? <div className="md:col-span-2"><EmptyState title="No friends yet" text="Your accepted music connections will appear here." /></div> : friends.map(friend => <article key={friend.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#181818] p-4"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#242424]"><MatchAvatar match={{ name: friend.name, avatarUrl: friend.avatarUrl }} /></div><button onClick={() => onOpenUserProfile?.({ ...friend, uid: friend.id, photoURL: friend.avatarUrl })} className="min-w-0 flex-1 text-left"><p className="truncate font-bold text-white">{friend.name}</p><p className="truncate text-xs text-[#727272]">@{friend.username}</p></button><button onClick={() => onStartDirectChat?.(friend)} className="rounded-full bg-[#282828] p-2.5 text-white"><MessageCircle size={16} /></button></article>)}</section>}

      {tab === "previous" && <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(discovery?.previousMatches || []).length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState title="No previous matches yet" text="Skipped and earlier daily recommendations remain available here for seven days." /></div> : (discovery?.previousMatches || []).map(match => <button key={match.id} onClick={() => openProfile(match)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#181818] p-4 text-left hover:bg-[#222]"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-[#242424]"><MatchAvatar match={match} /></div><div className="min-w-0 flex-1"><p className="truncate font-bold text-white">{match.name}</p><p className="truncate text-xs text-[#1ed760]">{match.matchReason}</p></div><ArrowRight size={16} className="text-[#727272]" /></button>)}</section>}

      {composerTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setComposerTarget(null)}><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#1db954]">Connection request</p><h2 className="mt-1 text-xl font-black text-white">Say hello to {composerTarget.name}</h2></div><button onClick={() => setComposerTarget(null)} className="rounded-full bg-[#282828] p-2 text-white"><X size={16} /></button></div><p className="mt-3 text-sm leading-6 text-[#b3b3b3]">Add one optional message. You can continue chatting after they accept.</p><textarea autoFocus value={requestMessage} onChange={event => setRequestMessage(event.target.value.slice(0, 180))} placeholder="What connected with you about their music taste?" className="mt-4 h-28 w-full resize-none rounded-2xl border border-white/10 bg-[#111] p-4 text-sm text-white outline-none focus:border-[#1db954]" /><div className="mt-2 text-right text-xs text-[#727272]">{requestMessage.length}/180</div><button disabled={busyId === composerTarget.id} onClick={() => void sendRequest()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#1db954] py-3 text-sm font-black text-black disabled:opacity-50"><Send size={15} />Send request</button></div></div>}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-3xl border border-dashed border-white/10 bg-[#141414] p-8 text-center"><Users className="mx-auto text-[#727272]" size={26} /><h2 className="mt-3 text-lg font-black text-white">{title}</h2><p className="mt-1 text-sm text-[#727272]">{text}</p></div>;
}
