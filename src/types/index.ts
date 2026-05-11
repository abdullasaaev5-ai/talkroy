import type { Timestamp } from "firebase/firestore";

export type UserRole = "user" | "moderator" | "owner";

export interface UserSettings {
  theme: "dark" | "light" | "system";
  soundEnabled: boolean;
  pushEnabled: boolean;
  onlineVisibility: "everyone" | "contacts" | "nobody";
  language: "ru" | "en";
}

export interface UserDoc {
  uid: string;
  displayName: string;
  username: string;
  usernameLower: string;
  photoURL: string | null;
  bio: string;
  email: string | null;
  createdAt: Timestamp;
  lastSeen: Timestamp;
  settings: UserSettings;
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  /** Cannot delete or block system official account */
  isSystem?: boolean;
}

export type ChatType = "private" | "group" | "system";

export interface ChatDoc {
  id: string;
  participants: string[];
  participantUsernames?: Record<string, string>;
  lastMessage: string;
  lastMessageTime: Timestamp | null;
  unreadCount: Record<string, number>;
  isPinned: Record<string, boolean>;
  pinnedMessageIds?: string[];
  type: ChatType;
  /** System chat with TalkRoy — read-only for user */
  systemReadOnly?: boolean;
  /** Group fields */
  title?: string;
  photoURL?: string | null;
  adminIds?: string[];
  archivedBy?: string[];
}

export type MessageType =
  | "text"
  | "image"
  | "file"
  | "voice"
  | "gif"
  | "system";

export interface MessageReplyPreview {
  id: string;
  text: string;
  senderId: string;
}

export interface MessageDoc {
  id: string;
  senderId: string;
  text: string;
  mediaURL?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  type: MessageType;
  createdAt: Timestamp;
  editedAt?: Timestamp | null;
  readBy: string[];
  replyTo?: MessageReplyPreview | null;
  reactions?: Record<string, string[]>;
  isDeleted?: boolean;
  deleteForAll?: boolean;
  forwardedFrom?: { senderId: string; originalChatId: string } | null;
  /** Disappearing message — stored server time + ms */
  disappearAt?: Timestamp | null;
  /** Soft-hide for "delete for me" */
  hiddenFor?: string[];
}

export interface SessionDoc {
  id: string;
  userId: string;
  device: string;
  browser: string;
  ip: string | null;
  loginAt: Timestamp;
  isActive: boolean;
}

export interface MonitoringDoc {
  id: string;
  ownerId: string;
  targetUsername: string;
  targetUid: string;
  startedAt: Timestamp;
}

export const RESERVED_USERNAMES = ["talkroy", "admin", "support"];
