export type MusicKind = "artist" | "track" | "album";
export interface MusicItem {
  kind: MusicKind; name: string; artist: string; plays?: number;
  image?: string; album?: string; url?: string;
  imageSource?: "lastfm" | "deezer";
}
export interface MusicSnapshot {
  items: MusicItem[]; updatedAt: string; totalPlays: number; from: string | null; to: string | null;
}
export interface MonthlyCapsule {
  monthKey: string;
  monthName: string;
  year: string;
  label: string;
  minutesListened: number;
  topArtist: MusicItem;
  topSong: MusicItem;
  top5Artists: MusicItem[];
  top5Songs: MusicItem[];
  albumsCollage: MusicItem[];
  isCurrentMonth?: boolean;
}

export interface SpotifyImport extends MusicSnapshot {
  fingerprint: string; fileCount: number; duplicateCount: number; ignoredCount: number;
  monthlyCapsules?: Record<string, MonthlyCapsule>;
}

/** Who can see a piece of profile data */
export type VisibilityLevel = "public" | "friends" | "none";

export interface UserProfile {
  uid: string; username: string; displayName: string; bio: string; photoURL: string;
  avatar: "google" | "initials" | "custom";
  onboardingStep: number;
  createdAt: string; updatedAt: string;
  /** Visibility for This Month's Top 5 Songs */
  showTopSongs?: VisibilityLevel;
  /** Visibility for This Month's Top 5 Artists */
  showTopArtists?: VisibilityLevel;
  /** Visibility for Now Playing indicator */
  showNowPlaying?: VisibilityLevel;
  /** Legacy – kept for backwards compat with old data */
  showRecentToFriends?: boolean;
  globalChatNotifications?: boolean;
  mutedChatIds?: string[];
  blockedUserIds?: string[];
}

export interface NowPlayingTrack {
  kind: "track";
  name: string;
  artist: string;
  album?: string;
  image?: string;
  url?: string;
  nowPlaying: boolean;
}

export interface MusicData {
  favorites: MusicItem[];
  spotify: SpotifyImport | null;
  lastfm: {
    username: string;
    connectedAt: string;
    nowPlaying?: NowPlayingTrack | null;
    recentTracks?: MusicItem[];
    recentArtists?: MusicItem[];
    snapshot: MusicSnapshot | null;
  } | null;
}
export interface AccountData { profile: UserProfile | null; music: MusicData }
export const emptyMusic = (): MusicData => ({ favorites: [], spotify: null, lastfm: null });

export type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface TasteMatch {
  id: string;
  name: string;
  username: string;
  matchScore: number;
  avatarUrl: string;
  vibe: string;
  sharedArtists: string[];
  topTrack: string;
  topTrackArtist?: string;
  city: string;
  status?: FriendStatus;
  bio?: string;
  showTopSongs?: VisibilityLevel;
  showTopArtists?: VisibilityLevel;
  showNowPlaying?: VisibilityLevel;
  /** Legacy */
  showRecentToFriends?: boolean;
  isBlocked?: boolean;
  topSongs?: MusicItem[];
  topArtists?: MusicItem[];
  nowPlaying?: NowPlayingTrack | null;
  matchReason?: string;
  matchDetail?: string;
  matchSection?: "best" | "current" | "artist" | "genre" | "expand";
}

export interface FriendUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  matchScore: number;
  vibe: string;
  topTrack: string;
  connectedAt: string;
  status: "friends";
  isMuted?: boolean;
  showTopSongs?: VisibilityLevel;
  showTopArtists?: VisibilityLevel;
  showNowPlaying?: VisibilityLevel;
  /** Legacy */
  showRecentToFriends?: boolean;
  topSongs?: MusicItem[];
  topArtists?: MusicItem[];
  nowPlaying?: NowPlayingTrack | null;
  nowPlayingText?: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  fromUsername: string;
  fromAvatarUrl: string;
  toUserId: string;
  createdAt: string;
  matchScore: number;
  vibe: string;
  sharedArtists: string[];
  message?: string;
  matchReason?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
  attachment?: {
    kind: "track" | "artist" | "album";
    name: string;
    artist: string;
    image?: string;
  };
}

export interface DirectChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl?: string;
  recipientId: string;
  text: string;
  createdAt: string;
  attachment?: {
    kind: "track" | "artist" | "album";
    name: string;
    artist: string;
    image?: string;
  };
}

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "direct_message"
  | "taste_match";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
  matchScore?: number;
  trackAttachment?: {
    name: string;
    artist: string;
    image?: string;
  };
  actionPayload?: Record<string, unknown>;
}
