"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Check, FileWarning, MessageCircle, RefreshCw, Search, Shield, Trash2, Users } from "lucide-react";
import { authenticatedFetch } from "@/lib/client-api";

type AdminTab = "overview" | "users" | "chat" | "reports" | "audit";
interface AdminUser { uid: string; displayName: string; username: string; email: string; photoURL: string; createdAt: string | null; hasSpotify: boolean; hasLastfm: boolean }
interface AdminData {
  summary: { users: number; connectedListeners: number; openReports: number; globalMessages: number; directThreads: number };
  users: AdminUser[];
  reports: Array<Record<string, unknown> & { id: string }>;
  messages: Array<Record<string, unknown> & { id: string }>;
  directThreads: Array<Record<string, unknown> & { id: string }>;
  auditLog: Array<Record<string, unknown> & { id: string }>;
}

export function AdminDashboard() {
  const [error, setError] = useState("");
  const [toggles, setToggles] = useState<{ friendRequests: boolean; discovery: boolean; globalChat: boolean }>({
    friendRequests: true,
    discovery: true,
    globalChat: true,
  });

  // Update toggle on server
  const updateToggle = useCallback(async (name: keyof typeof toggles, value: boolean) => {
    try {
      const response = await authenticatedFetch('/api/admin/toggles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to update toggle');
      setToggles((prev) => ({ ...prev, [name]: value }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update toggle');
    }
  }, []);

  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [response, togglesRes] = await Promise.all([
      authenticatedFetch("/api/admin"),
      authenticatedFetch("/api/admin/toggles")
    ]);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load administrator data.");
    setData(payload);

    if (togglesRes.ok) {
      const tPayload = await togglesRes.json();
      setToggles({
        friendRequests: tPayload.friendRequests !== undefined ? Boolean(tPayload.friendRequests) : true,
        discovery: tPayload.discovery !== undefined ? Boolean(tPayload.discovery) : true,
        globalChat: tPayload.globalChat !== undefined ? Boolean(tPayload.globalChat) : true,
      });
    }
  }, []);

  useEffect(() => {
    void load().catch(error => setError(error instanceof Error ? error.message : "Unable to load dashboard."));
  }, [load]);

  async function act(action: string, targetId: string, prompt: string) {
    if (!window.confirm(prompt)) return;
    setBusy(`${action}:${targetId}`);
    setError("");
    const response = await authenticatedFetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId }),
    });
    const payload = await response.json();
    setBusy("");
    if (!response.ok) {
      setError(payload.error || "Administrator action failed.");
      return;
    }
    await load();
  }

  const filteredUsers = useMemo(() => {
    const value = query.toLowerCase().trim();
    if (!value) return data?.users || [];
    return (data?.users || []).filter(user => `${user.displayName} ${user.username} ${user.email} ${user.uid}`.toLowerCase().includes(value));
  }, [data?.users, query]);

  if (!data && !error) return <AdminSkeleton />;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-24 pt-5 md:px-8 md:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-rose-300"><Shield size={14} />Restricted administration</p><h1 className="mt-1 text-3xl font-black text-white md:text-4xl">SpotiMatch Control Room</h1><p className="mt-2 text-sm text-[#b3b3b3]">Users, conversations, reports, and moderation activity.</p></div>
        <button onClick={() => void load()} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#181818] px-4 py-2 text-xs font-bold text-white"><RefreshCw size={14} />Refresh</button>
      </header>
      {error && <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
      <div className="mt-4 flex flex-wrap gap-4">
  {Object.entries(toggles).map(([key, value]) => (
    <div key={key} className="flex items-center">
      <span className="capitalize text-sm text-[#b3b3b3]">{key.replace(/([A-Z])/g, ' $1')}</span>
      <button
        onClick={() => updateToggle(key as any, !value)}
        className={`ml-2 rounded px-2 py-1 text-xs font-bold ${value ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'}`}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  ))}
</div>

      {tab === "overview" && data && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
        ["Registered users", data.summary.users, Users], ["Connected listeners", data.summary.connectedListeners, Check], ["Open reports", data.summary.openReports, FileWarning], ["Recent global messages", data.summary.globalMessages, MessageCircle], ["Direct threads", data.summary.directThreads, MessageCircle],
      ].map(([label, count, Icon]) => { const MetricIcon = Icon as typeof Users; return <div key={String(label)} className="rounded-2xl border border-white/10 bg-[#181818] p-5"><MetricIcon size={18} className="text-[#1db954]" /><p className="mt-4 text-3xl font-black text-white">{String(count)}</p><p className="mt-1 text-xs text-[#727272]">{String(label)}</p></div>; })}</div>}

      {tab === "users" && data && <section className="space-y-3"><div className="relative"><Search className="absolute left-3 top-3 text-[#727272]" size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, username, email, or UID" className="w-full rounded-xl border border-white/10 bg-[#181818] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#1db954]" /></div>{filteredUsers.map(user => <article key={user.uid} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#181818] p-4 md:flex-row md:items-center"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#282828] text-xs font-black text-[#1ed760]">{user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : user.displayName.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-white">{user.displayName} <span className="font-normal text-[#727272]">@{user.username}</span></p><p className="truncate text-xs text-[#727272]">{user.email || user.uid}</p></div><div className="flex gap-2 text-[10px] font-bold"><span className={`rounded-full px-2 py-1 ${user.hasLastfm ? "bg-red-500/15 text-red-300" : "bg-white/5 text-[#555]"}`}>Last.fm</span><span className={`rounded-full px-2 py-1 ${user.hasSpotify ? "bg-[#1db954]/15 text-[#1ed760]" : "bg-white/5 text-[#555]"}`}>Spotify</span></div><button disabled={busy.endsWith(user.uid)} onClick={() => void act("delete_user", user.uid, `Permanently delete ${user.displayName}, their account data, friendships, and direct messages? This cannot be undone.`)} className="flex items-center justify-center gap-2 rounded-full border border-rose-400/25 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-400/10"><Trash2 size={14} />Delete user</button></article>)}</section>}

      {tab === "chat" && data && <div className="grid gap-5 lg:grid-cols-2"><ModerationList title="Global messages" empty="No global messages found.">{data.messages.map(message => <ModerationRow key={message.id} title={String(message.name || message.username || "Listener")} detail={String(message.text || "Attachment or empty message")} meta={String(message.createdAt || "")} actionLabel="Delete" busy={busy.endsWith(message.id)} onAction={() => void act("delete_global_message", message.id, "Delete this global message permanently?")} />)}</ModerationList><ModerationList title="Direct-message threads" empty="No direct-message threads found.">{data.directThreads.map(thread => <ModerationRow key={thread.id} title={(thread.participantNames as string[] | undefined)?.join(" ↔ ") || thread.id} detail={String(thread.lastMessage || "Direct conversation")} meta={String(thread.updatedAt || "")} actionLabel="Delete thread" busy={busy.endsWith(thread.id)} onAction={() => void act("delete_dm_thread", thread.id, "Delete this entire direct-message thread and every message inside it?")} />)}</ModerationList></div>}

      {tab === "reports" && data && <ModerationList title="Match reports" empty="No reports have been submitted.">{data.reports.map(report => <ModerationRow key={report.id} title={`Reported user: ${String(report.candidateId || "Unknown")}`} detail={`Reporter: ${String(report.reporterId || "Unknown")} · Status: ${String(report.status || "open")}`} meta={String(report.day || "")} actionLabel="Resolve" busy={busy.endsWith(report.id)} secondaryAction={() => void act("dismiss_report", report.id, "Dismiss this report?")} onAction={() => void act("resolve_report", report.id, "Mark this report as resolved?")} />)}</ModerationList>}

      {tab === "audit" && data && <ModerationList title="Administrator audit log" empty="No administrator actions recorded.">{data.auditLog.map(entry => <ModerationRow key={entry.id} title={String(entry.action || "Action").replaceAll("_", " ")} detail={`Target: ${String(entry.targetId || "Unknown")}`} meta={String(entry.createdAt || "")} />)}</ModerationList>}
    </div>
  );
}

function ModerationList({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) { return <section className="space-y-3"><h2 className="text-lg font-black text-white">{title}</h2>{children.length ? children : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-[#727272]">{empty}</div>}</section>; }
function ModerationRow({ title, detail, meta, actionLabel, busy, onAction, secondaryAction }: { title: string; detail: string; meta: string; actionLabel?: string; busy?: boolean; onAction?: () => void; secondaryAction?: () => void }) { return <article className="rounded-2xl border border-white/10 bg-[#181818] p-4"><div className="flex items-start gap-3"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold capitalize text-white">{title}</p><p className="mt-1 line-clamp-2 text-xs text-[#b3b3b3]">{detail}</p><p className="mt-2 text-[10px] text-[#555]">{meta}</p></div>{secondaryAction && <button onClick={secondaryAction} className="text-xs font-bold text-[#b3b3b3]">Dismiss</button>}{onAction && <button disabled={busy} onClick={onAction} className="rounded-full border border-rose-400/25 px-3 py-1.5 text-xs font-bold text-rose-300">{actionLabel}</button>}</div></article>; }
function AdminSkeleton() { return <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 md:px-8"><div className="h-20 animate-pulse rounded-2xl bg-[#181818]" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[1,2,3,4,5].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-[#181818]" />)}</div><div className="h-72 animate-pulse rounded-3xl bg-[#181818]" /></div>; }
