"use client";
import React, { useState, useEffect } from "react";
import {
  Bell,
  Check,
  UserPlus,
  MessageSquare,
  Sparkles,
  CheckCheck,
  X,
  ArrowRight,
  ExternalLink,
  Disc3,
  LoaderCircle,
  Music2,
} from "lucide-react";
import type { AccountData, AppNotification, FriendUser } from "@/types";
import { apiJson } from "@/lib/client-api";
import { useActivePolling } from "@/hooks/use-active-polling";
import { ChatAvatar } from "@/components/ChatHubView";
import type { UserProfileModalUser } from "@/components/UserProfileModal";
import type { SpotifyTab } from "@/components/SpotifyViews";
import { openSpotifyTrack } from "@/lib/spotify-redirect";

interface NotificationsViewProps {
  account: AccountData;
  onNavigate: (tab: SpotifyTab) => void;
  onOpenUserProfile: (user: UserProfileModalUser) => void;
  onStartDirectChat: (friend: FriendUser) => void;
  onNotificationRead?: () => void;
}

export function NotificationsView({
  account: _account,
  onNavigate,
  onOpenUserProfile,
  onStartDirectChat,
  onNotificationRead,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<"all" | "requests" | "messages" | "matches">("all");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  async function loadNotifications() {
      try {
        const data = await apiJson<{ notifications: AppNotification[] }>("/api/notifications");
        if (data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setLoading(false);
      }
  }
  useActivePolling(loadNotifications);

  // Mark all as read
  async function handleMarkAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (onNotificationRead) onNotificationRead();

    try {
      await apiJson("/api/notifications", "POST", {
        action: "mark_all_read",
        ids: notifications.map(n => n.id),
      });
    } catch {}
  }

  // Accept Friend Request from notification
  async function handleAccept(notif: AppNotification) {
    if (!notif.actionPayload) return;
    const { requestId, fromUserId } = notif.actionPayload as {
      requestId?: string;
      fromUserId?: string;
    };
    if (!fromUserId) return;

    setBusyActionId(notif.id);
    try {
      await apiJson("/api/friends", "POST", {
        action: "accept_request",
        requestId: requestId || `req-${fromUserId}`,
        fromUserId,
      });
      {
        setAcceptedIds(prev => new Set(prev).add(notif.id));
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
        );
      }
    } catch (err) {
      console.error("Error accepting friend request:", err);
    } finally {
      setBusyActionId(null);
    }
  }

  // Decline Friend Request from notification
  async function handleDecline(notif: AppNotification) {
    if (!notif.actionPayload) return;
    const { fromUserId } = notif.actionPayload as { fromUserId?: string };
    if (!fromUserId) return;

    setBusyActionId(notif.id);
    try {
      await apiJson("/api/friends", "POST", {
        action: "decline_request",
        targetId: fromUserId,
      });
      {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
      }
    } catch (err) {
      console.error("Error declining friend request:", err);
    } finally {
      setBusyActionId(null);
    }
  }

  // Filter notifications
  const filtered = notifications.filter(item => {
    if (filter === "requests") return item.type === "friend_request";
    if (filter === "messages") return item.type === "direct_message";
    if (filter === "matches") return item.type === "taste_match";
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fadeIn select-none">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#141414] border border-white/5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1db954]/15 border border-[#1db954]/30 flex items-center justify-center text-[#1db954] shadow">
            <Bell size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#1db954] animate-pulse" />
              )}
            </div>
            <p className="text-xs text-[#b3b3b3] mt-0.5">
              Stay updated on friend requests, track shares, and sonic matches
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#222222] hover:bg-[#2c2c2c] text-[#1ed760] hover:text-white border border-[#1db954]/30 rounded-full text-xs font-bold transition-all cursor-pointer shadow self-start sm:self-auto"
          >
            <CheckCheck size={14} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(
          [
            { id: "all", label: "All Activity" },
            { id: "requests", label: "Friend Requests" },
            { id: "messages", label: "Messages & Tracks" },
            { id: "matches", label: "Taste Matches" },
          ] as const
        ).map(tab => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-white text-black shadow-md scale-102"
                  : "bg-[#181818] hover:bg-[#242424] text-[#b3b3b3] hover:text-white border border-white/5"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-12 text-center space-y-3 bg-[#141414] rounded-2xl border border-white/5">
          <LoaderCircle size={28} className="spin text-[#1db954] mx-auto" />
          <p className="text-xs text-[#727272]">Checking for latest updates…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#141414] rounded-2xl border border-white/5">
          <div className="w-14 h-14 rounded-2xl bg-[#1e1e1e] flex items-center justify-center text-[#727272] mx-auto">
            <Bell size={24} />
          </div>
          <h3 className="text-base font-bold text-white">All caught up!</h3>
          <p className="text-xs text-[#b3b3b3] max-w-sm mx-auto">
            No new notifications right now. Explore Discover Matches to find listeners who share your musical frequency.
          </p>
          <button
            onClick={() => onNavigate("matches")}
            className="mt-2 px-5 py-2 text-xs font-bold bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full transition-all cursor-pointer shadow-lg inline-flex items-center gap-1.5"
          >
            <span>Discover Matches</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notif => {
            const isAccepted = acceptedIds.has(notif.id);
            const isBusy = busyActionId === notif.id;

            return (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition-all relative group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  notif.read
                    ? "bg-[#141414] border-white/5 opacity-85 hover:opacity-100"
                    : "bg-[#191919] border-[#1db954]/30 shadow-lg"
                }`}
              >
                {/* Left: Avatar + Notification Details */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <ChatAvatar
                      name={notif.senderName || "Spotimatch Listener"}
                      photoUrl={notif.senderAvatarUrl}
                      onClick={() =>
                        notif.senderId &&
                        onOpenUserProfile({
                          id: notif.senderId,
                          name: notif.senderName || "Listener",
                          username: notif.senderUsername || "listener",
                          avatarUrl: notif.senderAvatarUrl,
                          matchScore: notif.matchScore,
                          status: notif.type === "friend_request" ? "pending_received" : notif.type === "friend_accepted" ? "friends" : undefined,
                        })
                      }
                    />
                    {!notif.read && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#1db954] border-2 border-[#141414]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        onClick={() =>
                          notif.senderId &&
                          onOpenUserProfile({
                            id: notif.senderId,
                            name: notif.senderName || "Listener",
                            username: notif.senderUsername || "listener",
                            avatarUrl: notif.senderAvatarUrl,
                          matchScore: notif.matchScore,
                          status: notif.type === "friend_request" ? "pending_received" : notif.type === "friend_accepted" ? "friends" : undefined,
                          })
                        }
                        className="text-xs font-bold text-white hover:text-[#1db954] transition-colors cursor-pointer"
                      >
                        {notif.senderName || "Listener"}
                      </span>
                      {notif.senderUsername && (
                        <span className="text-[11px] text-[#727272]">
                          @{notif.senderUsername}
                        </span>
                      )}
                      {notif.matchScore && (
                        <span className="px-2 py-0.2 bg-[#1db954]/20 text-[#1ed760] font-black text-[9px] rounded-full">
                          {notif.matchScore}% Match
                        </span>
                      )}
                      <span className="text-[10px] text-[#666]">
                        {new Date(notif.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-[#d1d1d1] mt-1 leading-relaxed">
                      {notif.body}
                    </p>

                    {/* Track Attachment Preview if present */}
                    {notif.trackAttachment && (
                      <div
                        onClick={() => openSpotifyTrack(notif.trackAttachment!.name, notif.trackAttachment!.artist)}
                        className="mt-2 p-2 bg-[#202020] hover:bg-[#282828] border border-white/5 hover:border-[#1db954]/40 rounded-xl flex items-center gap-2.5 max-w-sm cursor-pointer transition-colors group"
                        title={`Listen to "${notif.trackAttachment.name}" by ${notif.trackAttachment.artist} on Spotify`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#282828] flex items-center justify-center text-[#1db954] shrink-0 group-hover:scale-105 transition-transform">
                          <Disc3 size={16} className="group-hover:animate-spin" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-white group-hover:text-[#1ed760] transition-colors truncate">
                            {notif.trackAttachment.name}
                          </span>
                          <span className="block text-[10px] text-[#b3b3b3] truncate">
                            {notif.trackAttachment.artist}
                          </span>
                        </div>
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-[#1db954] transition-opacity mr-1 shrink-0" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  {notif.type === "friend_request" && (
                    <>
                      {isAccepted ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-[#1db954]/20 text-[#1ed760] font-bold text-xs rounded-full flex items-center gap-1.5">
                            <Check size={14} /> Friends
                          </span>
                          <button
                            onClick={() => {
                              onStartDirectChat({
                                id: notif.senderId || "",
                                name: notif.senderName || "Friend",
                                username: notif.senderUsername || "friend",
                                avatarUrl: notif.senderAvatarUrl || "",
                                matchScore: notif.matchScore || 90,
                                vibe: "Shared music lover",
                                topTrack: "Top Track",
                                connectedAt: new Date().toISOString(),
                                status: "friends",
                              });
                              onNavigate("chat");
                            }}
                            className="px-4 py-1.5 bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-full transition-all cursor-pointer shadow"
                          >
                            Chat Now
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            disabled={isBusy}
                            onClick={() => handleAccept(notif)}
                            className="px-4 py-1.5 bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow"
                          >
                            {isBusy ? (
                              <LoaderCircle size={13} className="spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            <span>Accept</span>
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => handleDecline(notif)}
                            className="px-3 py-1.5 bg-[#242424] hover:bg-[#303030] text-[#b3b3b3] hover:text-rose-300 text-xs font-semibold rounded-full transition-all cursor-pointer"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {(notif.type === "direct_message" || notif.type === "friend_accepted") && (
                    <button
                      onClick={() => {
                        if (notif.senderId) {
                          onStartDirectChat({
                            id: notif.senderId,
                            name: notif.senderName || "Friend",
                            username: notif.senderUsername || "friend",
                            avatarUrl: notif.senderAvatarUrl || "",
                            matchScore: notif.matchScore || 92,
                            vibe: "Music conversation",
                            topTrack: notif.trackAttachment?.name || "Track",
                            connectedAt: new Date().toISOString(),
                            status: "friends",
                          });
                          onNavigate("chat");
                        }
                      }}
                      className="px-4 py-1.5 bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <MessageSquare size={13} />
                      <span>{notif.type === "friend_accepted" ? "Start Chat" : "Reply in Chat"}</span>
                    </button>
                  )}

                  {notif.type === "taste_match" && (
                    <button
                      onClick={() =>
                        notif.senderId &&
                        onOpenUserProfile({
                          id: notif.senderId,
                          name: notif.senderName || "Listener",
                          username: notif.senderUsername || "listener",
                          avatarUrl: notif.senderAvatarUrl,
                          matchScore: notif.matchScore,
                          status: notif.type === "friend_request" ? "pending_received" : notif.type === "friend_accepted" ? "friends" : undefined,
                        })
                      }
                      className="px-4 py-1.5 bg-[#262626] hover:bg-[#333] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                    >
                      <span>View Profile</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
