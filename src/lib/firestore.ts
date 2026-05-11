import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentSnapshot,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ChatDoc,
  MessageDoc,
  UserDoc,
  UserSettings,
  MessageType,
} from "@/types";
import { privateChatId } from "./chat-utils";

export { privateChatId };

const USERS = "users";
const USERNAMES = "usernames";
const CHATS = "chats";
const SESSIONS = "sessions";
const MONITORING = "monitoring";
const CONFIG = "config";
const LOGIN_EVENTS = "loginEvents";
/** Публичные поля профиля: users/{uid}/profile/details */
const USER_PROFILE = "profile";
const USER_PROFILE_DETAILS = "details";

type UserProfileDetailsDoc = {
  name?: string;
  avatar?: string | null;
  bio?: string;
};

async function readProfileDetails(
  uid: string,
): Promise<UserProfileDetailsDoc | null> {
  const s = await getDoc(doc(db, USERS, uid, USER_PROFILE, USER_PROFILE_DETAILS));
  if (!s.exists()) return null;
  return s.data() as UserProfileDetailsDoc;
}

function applyProfileDetailsToUser(
  uid: string,
  base: Omit<UserDoc, "uid">,
  p: UserProfileDetailsDoc | null,
): UserDoc {
  const out: UserDoc = { uid, ...base };
  if (!p) return out;
  if (p.name != null && String(p.name).trim() !== "") {
    out.displayName = String(p.name).trim();
  }
  if (p.avatar !== undefined) out.photoURL = p.avatar ?? null;
  if (p.bio !== undefined) out.bio = p.bio;
  return out;
}

export type LoginEventMethod = "google" | "password";

/** Запись факта входа (для истории и будущих Cloud Functions: SMS / email). */
export async function recordLoginEvent(
  uid: string,
  data: {
    method: LoginEventMethod;
    email: string | null;
    phone: string | null;
    displayName: string | null;
    userAgent: string;
  },
): Promise<void> {
  await addDoc(collection(db, USERS, uid, LOGIN_EVENTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export const defaultUserSettings = (): UserSettings => ({
  theme: "dark",
  soundEnabled: true,
  pushEnabled: true,
  onlineVisibility: "everyone",
  language: "ru",
});

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  const base = snap.data() as Omit<UserDoc, "uid">;
  const p = await readProfileDetails(uid);
  return applyProfileDetailsToUser(uid, base, p);
}

export function subscribeUser(
  uid: string,
  cb: (user: UserDoc | null) => void,
): Unsubscribe {
  let parent: Omit<UserDoc, "uid"> | null = null;
  let seq = 0;
  const flush = () => {
    const my = ++seq;
    void (async () => {
      if (my !== seq) return;
      if (!parent) {
        cb(null);
        return;
      }
      const p = await readProfileDetails(uid);
      if (my !== seq) return;
      cb(applyProfileDetailsToUser(uid, parent, p));
    })();
  };
  const unsubUser = onSnapshot(doc(db, USERS, uid), (snap) => {
    if (!snap.exists()) {
      parent = null;
      flush();
      return;
    }
    parent = snap.data() as Omit<UserDoc, "uid">;
    flush();
  });
  const unsubProfile = onSnapshot(
    doc(db, USERS, uid, USER_PROFILE, USER_PROFILE_DETAILS),
    () => {
      flush();
    },
  );
  return () => {
    seq += 1;
    unsubUser();
    unsubProfile();
  };
}

export async function getUserByUsername(
  username: string,
): Promise<UserDoc | null> {
  const lower = username.replace(/^@/, "").toLowerCase();
  const nameSnap = await getDoc(doc(db, USERNAMES, lower));
  if (!nameSnap.exists()) return null;
  const uid = nameSnap.data()?.uid as string;
  return getUser(uid);
}

async function getUsernameDocOnce(
  usernameLower: string,
): Promise<DocumentSnapshot> {
  const ms = 14000;
  return Promise.race([
    getDoc(doc(db, USERNAMES, usernameLower)),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("firestore_timeout")), ms),
    ),
  ]);
}

export async function isUsernameAvailable(
  usernameLower: string,
  excludeUid?: string,
): Promise<boolean> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const snap = await getUsernameDocOnce(usernameLower);
      if (!snap.exists()) return true;
      const uid = snap.data()?.uid as string;
      return excludeUid !== undefined && uid === excludeUid;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("firestore_unreachable");
}

function usernameFreeOrMine(
  snapExists: boolean,
  ownerUid: string | undefined,
  excludeUid: string | undefined,
): boolean {
  if (!snapExists) return true;
  return excludeUid !== undefined && ownerUid === excludeUid;
}

export function subscribeUsernameAvailability(
  usernameLower: string,
  excludeUid: string | undefined,
  cb: (available: boolean | null) => void,
): Unsubscribe {
  if (!usernameLower || usernameLower.length < 4) {
    cb(null);
    return () => {};
  }
  return onSnapshot(doc(db, USERNAMES, usernameLower), (snap) => {
    const ownerUid = snap.exists()
      ? (snap.data()?.uid as string)
      : undefined;
    cb(usernameFreeOrMine(snap.exists(), ownerUid, excludeUid));
  });
}

export async function createUserProfile(
  uid: string,
  data: {
    displayName: string;
    username: string;
    photoURL: string | null;
    email: string | null;
    role?: UserDoc["role"];
    isVerified?: boolean;
    isSystem?: boolean;
    language?: UserSettings["language"];
  },
): Promise<void> {
  const userRef = doc(db, USERS, uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    return;
  }

  const usernameLower = data.username.replace(/^@/, "").toLowerCase();
  const batch = writeBatch(db);
  const settings = defaultUserSettings();
  if (data.language) settings.language = data.language;
  const userDoc: Omit<UserDoc, "uid"> = {
    displayName: data.displayName,
    username: data.username.startsWith("@")
      ? data.username
      : `@${data.username}`,
    usernameLower,
    photoURL: data.photoURL,
    bio: "",
    email: data.email,
    createdAt: Timestamp.now(),
    lastSeen: Timestamp.now(),
    settings,
    role: data.role ?? "user",
    isVerified: data.isVerified ?? false,
    isBlocked: false,
    isSystem: data.isSystem,
  };
  batch.set(userRef, userDoc);
  batch.set(doc(db, USERNAMES, usernameLower), { uid });
  batch.set(doc(db, USERS, uid, USER_PROFILE, USER_PROFILE_DETAILS), {
    name: data.displayName,
    avatar: data.photoURL,
    bio: "",
  });
  await batch.commit();
}

/** Несколько попыток записи профиля при нестабильной сети. */
export async function createUserProfileWithRetry(
  uid: string,
  data: {
    displayName: string;
    username: string;
    photoURL: string | null;
    email: string | null;
    role?: UserDoc["role"];
    isVerified?: boolean;
    isSystem?: boolean;
    language?: UserSettings["language"];
  },
  maxAttempts = 6,
): Promise<boolean> {
  let last: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await createUserProfile(uid, data);
      return true;
    } catch (e) {
      last = e;
      await new Promise((r) =>
        setTimeout(r, Math.min(5000, 400 * 2 ** i)),
      );
    }
  }
  console.warn("[TalkRoy] createUserProfileWithRetry failed", last);
  return false;
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<
    Pick<
      UserDoc,
      | "displayName"
      | "photoURL"
      | "bio"
      | "settings"
      | "lastSeen"
      | "isVerified"
      | "isBlocked"
      | "role"
    >
  > & {
    username?: string;
    usernameLower?: string;
  },
): Promise<void> {
  const ref = doc(db, USERS, uid);
  const prev = await getDoc(ref);
  const prevData = prev.data() as UserDoc | undefined;
  const { username, usernameLower, ...rest } = patch;
  const updates: Record<string, unknown> = { ...rest };
  if (username !== undefined && usernameLower !== undefined) {
    updates.username = username.startsWith("@")
      ? username
      : `@${username}`;
    updates.usernameLower = usernameLower;
  }
  await updateDoc(ref, updates);

  if (
    patch.displayName !== undefined ||
    patch.photoURL !== undefined ||
    patch.bio !== undefined
  ) {
    const prof: Record<string, unknown> = {};
    if (patch.displayName !== undefined) prof.name = patch.displayName;
    if (patch.photoURL !== undefined) prof.avatar = patch.photoURL;
    if (patch.bio !== undefined) prof.bio = patch.bio;
    await setDoc(
      doc(db, USERS, uid, USER_PROFILE, USER_PROFILE_DETAILS),
      prof,
      { merge: true },
    );
  }

  if (
    usernameLower !== undefined &&
    prevData?.usernameLower &&
    prevData.usernameLower !== usernameLower
  ) {
    const batch = writeBatch(db);
    batch.delete(doc(db, USERNAMES, prevData.usernameLower));
    batch.set(doc(db, USERNAMES, usernameLower), { uid });
    await batch.commit();
  }
}

export async function setLastSeen(uid: string): Promise<void> {
  await updateDoc(doc(db, USERS, uid), {
    lastSeen: serverTimestamp(),
  });
}

export async function getSystemConfig(): Promise<{
  talkRoyUid?: string;
} | null> {
  const snap = await getDoc(doc(db, CONFIG, "system"));
  if (!snap.exists()) return null;
  return snap.data() as { talkRoyUid?: string };
}

export async function setSystemTalkRoyUid(uid: string): Promise<void> {
  await setDoc(
    doc(db, CONFIG, "system"),
    { talkRoyUid: uid },
    { merge: true },
  );
}

/** DM chat document reference helpers */
export async function ensurePrivateChat(
  myUid: string,
  otherUid: string,
): Promise<string> {
  const id = privateChatId(myUid, otherUid);
  const ref = doc(db, CHATS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const participants = [myUid, otherUid].sort();
    await setDoc(ref, {
      participants,
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
      unreadCount: participants.reduce(
        (acc, u) => {
          acc[u] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
      isPinned: participants.reduce(
        (acc, u) => {
          acc[u] = false;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
      type: "private",
      systemReadOnly: false,
      archivedBy: [],
    });
  }
  return id;
}

export async function ensureTalkRoyChatForUser(
  userUid: string,
  talkRoyUid: string,
): Promise<string> {
  const id = privateChatId(userUid, talkRoyUid);
  const ref = doc(db, CHATS, id);
  const snap = await getDoc(ref);
  const participants = [userUid, talkRoyUid].sort();
  if (!snap.exists()) {
    await setDoc(ref, {
      participants,
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
      unreadCount: participants.reduce(
        (acc, u) => {
          acc[u] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
      isPinned: participants.reduce(
        (acc, u) => {
          acc[u] = u === userUid;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
      type: "system",
      systemReadOnly: true,
      title: "TalkRoy",
      archivedBy: [],
    });
  } else {
    await updateDoc(ref, {
      type: "system",
      systemReadOnly: true,
      [`isPinned.${userUid}`]: true,
    });
  }
  return id;
}

const TALKROY_WELCOME_RU =
  "🎉 Добро пожаловать в TalkRoy!\n\n" +
  "Это ваш личный мессенджер. Здесь вы будете получать важные уведомления.\n" +
  "Начните общение — найдите друзей по @username или создайте группу!";

/**
 * Первое системное сообщение в DM с TalkRoy (read-only для пользователя).
 * Пишется от имени участника с type: system — правила Firestore разрешают senderId == auth.
 */
export async function seedTalkRoyWelcomeMessages(
  chatId: string,
  userUid: string,
): Promise<void> {
  const msgsCol = collection(db, CHATS, chatId, "messages");
  const anySnap = await getDocs(query(msgsCol, limit(1)));
  if (!anySnap.empty) return;

  const chatRef = doc(db, CHATS, chatId);
  const chatSnap = await getDoc(chatRef);
  const chat = chatSnap.data() as ChatDoc | undefined;
  if (!chat?.participants?.includes(userUid) || !chat.systemReadOnly) return;

  const preview = "🎉 Добро пожаловать в TalkRoy!";
  const msgRef = doc(collection(db, CHATS, chatId, "messages"));
  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderId: userUid,
    text: TALKROY_WELCOME_RU,
    type: "system" as MessageType,
    mediaURL: null,
    mediaName: null,
    mediaSize: null,
    createdAt: serverTimestamp(),
    editedAt: null,
    readBy: [userUid],
    replyTo: null,
    reactions: {},
    isDeleted: false,
    forwardedFrom: null,
    disappearAt: null,
  });

  const unreadUpdates: Record<string, unknown> = {};
  (chat.participants ?? []).forEach((p) => {
    if (p !== userUid) unreadUpdates[`unreadCount.${p}`] = increment(1);
  });

  batch.update(chatRef, {
    lastMessage: preview.slice(0, 200),
    lastMessageTime: serverTimestamp(),
    ...unreadUpdates,
  });

  await batch.commit();
}

export function subscribeChat(
  chatId: string,
  cb: (chat: ChatDoc | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, CHATS, chatId), (snap) => {
    if (!snap.exists()) cb(null);
    else cb({ id: snap.id, ...(snap.data() as Omit<ChatDoc, "id">) });
  });
}

export function subscribeAllChats(
  cb: (chats: ChatDoc[]) => void,
  max = 400,
): Unsubscribe {
  const qy = query(collection(db, CHATS), limit(max));
  return onSnapshot(qy, (snap) => {
    const list: ChatDoc[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<ChatDoc, "id">) });
    });
    list.sort((a, b) => {
      const ta = a.lastMessageTime?.toMillis?.() ?? 0;
      const tb = b.lastMessageTime?.toMillis?.() ?? 0;
      return tb - ta;
    });
    cb(list);
  });
}

export function subscribeChats(
  uid: string,
  cb: (chats: ChatDoc[]) => void,
): Unsubscribe {
  const qy = query(
    collection(db, CHATS),
    where("participants", "array-contains", uid),
  );
  return onSnapshot(qy, (snap) => {
    const list: ChatDoc[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<ChatDoc, "id">) });
    });
    list.sort((a, b) => {
      const ta = a.lastMessageTime?.toMillis?.() ?? 0;
      const tb = b.lastMessageTime?.toMillis?.() ?? 0;
      return tb - ta;
    });
    cb(list);
  });
}

export async function searchUsersForChat(
  uid: string,
  term: string,
  max = 20,
): Promise<UserDoc[]> {
  const t = term.replace(/^@/, "").toLowerCase();
  if (t.length < 1) return [];
  const snap = await getDocs(collection(db, USERS));
  const out: UserDoc[] = [];
  snap.forEach((d) => {
    const u = { uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) };
    if (u.uid === uid || u.isBlocked) return;
    if (u.isSystem || u.usernameLower === "talkroy") return;
    if (
      u.usernameLower.includes(t) ||
      u.displayName.toLowerCase().includes(t)
    ) {
      out.push(u);
    }
  });
  return out.slice(0, max);
}

export function subscribeMessages(
  chatId: string,
  cb: (messages: MessageDoc[]) => void,
  pageSize = 50,
): Unsubscribe {
  const qy = query(
    collection(db, CHATS, chatId, "messages"),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );
  return onSnapshot(qy, (snap) => {
    const list: MessageDoc[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Omit<MessageDoc, "id">) });
    });
    list.reverse();
    cb(list);
  });
}

export async function loadOlderMessages(
  chatId: string,
  cursor: DocumentSnapshot | null,
  pageSize: number,
): Promise<{ messages: MessageDoc[]; lastSnap: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const qy = query(
    collection(db, CHATS, chatId, "messages"),
    ...constraints,
  );
  const snap = await getDocs(qy);
  const list: MessageDoc[] = [];
  let last: DocumentSnapshot | null = null;
  snap.forEach((d) => {
    list.push({ id: d.id, ...(d.data() as Omit<MessageDoc, "id">) });
    last = d;
  });
  list.reverse();
  return { messages: list, lastSnap: last };
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  payload: {
    text: string;
    type?: MessageType;
    mediaURL?: string | null;
    mediaName?: string | null;
    mediaSize?: number | null;
    replyTo?: MessageDoc["replyTo"];
    forwardedFrom?: MessageDoc["forwardedFrom"];
    disappearAt?: Date | null;
  },
): Promise<string> {
  const chatRef = doc(db, CHATS, chatId);
  const chatSnap = await getDoc(chatRef);
  const chat = chatSnap.data() as ChatDoc | undefined;
  if (chat?.systemReadOnly) {
    const cfg = await getSystemConfig();
    if (!cfg?.talkRoyUid || senderId !== cfg.talkRoyUid) {
      throw new Error("read_only_chat");
    }
  }

  const msgRef = doc(collection(db, CHATS, chatId, "messages"));
  const batch = writeBatch(db);
  batch.set(msgRef, {
    senderId,
    text: payload.text,
    type: payload.type ?? "text",
    mediaURL: payload.mediaURL ?? null,
    mediaName: payload.mediaName ?? null,
    mediaSize: payload.mediaSize ?? null,
    createdAt: serverTimestamp(),
    editedAt: null,
    readBy: [senderId],
    replyTo: payload.replyTo ?? null,
    reactions: {},
    isDeleted: false,
    forwardedFrom: payload.forwardedFrom ?? null,
    disappearAt: payload.disappearAt
      ? Timestamp.fromDate(payload.disappearAt)
      : null,
  });

  const preview =
    payload.type === "image"
      ? "📷 Photo"
      : payload.type === "file"
        ? `📎 ${payload.mediaName ?? "File"}`
        : payload.type === "voice"
          ? "🎤 Voice message"
          : payload.type === "gif"
            ? "GIF"
            : payload.text;

  const unreadUpdates: Record<string, unknown> = {};
  (chat?.participants ?? []).forEach((p) => {
    if (p !== senderId)
      unreadUpdates[`unreadCount.${p}`] = increment(1);
  });

  batch.update(chatRef, {
    lastMessage: preview.slice(0, 200),
    lastMessageTime: serverTimestamp(),
    ...unreadUpdates,
  });

  await batch.commit();
  return msgRef.id;
}

export async function editMessage(
  chatId: string,
  messageId: string,
  senderId: string,
  text: string,
): Promise<void> {
  await updateDoc(doc(db, CHATS, chatId, "messages", messageId), {
    text,
    editedAt: serverTimestamp(),
  });
}

export async function deleteMessage(
  chatId: string,
  messageId: string,
  mode: "me" | "all",
  senderId: string,
): Promise<void> {
  if (mode === "me") {
    await updateDoc(doc(db, CHATS, chatId, "messages", messageId), {
      hiddenFor: arrayUnion(senderId),
    });
  } else {
    await updateDoc(doc(db, CHATS, chatId, "messages", messageId), {
      isDeleted: true,
      deleteForAll: true,
      text: "",
      mediaURL: null,
    });
  }
}

export async function markChatRead(
  chatId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, CHATS, chatId), {
    [`unreadCount.${uid}`]: 0,
  });
}

export async function markMessagesRead(
  chatId: string,
  messageIds: string[],
  uid: string,
): Promise<void> {
  const batch = writeBatch(db);
  messageIds.forEach((mid) => {
    batch.update(doc(db, CHATS, chatId, "messages", mid), {
      readBy: arrayUnion(uid),
    });
  });
  await batch.commit();
}

export async function setTyping(
  chatId: string,
  uid: string,
  typing: boolean,
): Promise<void> {
  await setDoc(
    doc(db, CHATS, chatId, "typing", uid),
    { typing, at: serverTimestamp() },
    { merge: true },
  );
}

export function subscribeTyping(
  chatId: string,
  myUid: string,
  cb: (uids: string[]) => void,
): Unsubscribe {
  const col = collection(db, CHATS, chatId, "typing");
  return onSnapshot(col, (snap) => {
    const uids: string[] = [];
    const now = Date.now();
    snap.forEach((d) => {
      if (d.id === myUid) return;
      const t = d.data()?.typing;
      const at = d.data()?.at?.toMillis?.() ?? 0;
      if (t && now - at < 5000) uids.push(d.id);
    });
    cb(uids);
  });
}

export async function toggleReaction(
  chatId: string,
  messageId: string,
  uid: string,
  emoji: string,
): Promise<void> {
  const ref = doc(db, CHATS, chatId, "messages", messageId);
  const snap = await getDoc(ref);
  const r = (snap.data()?.reactions ?? {}) as Record<string, string[]>;
  const users = r[emoji] ?? [];
  const has = users.includes(uid);
  const next = { ...r };
  if (has) next[emoji] = users.filter((u) => u !== uid);
  else next[emoji] = [...users, uid];
  await updateDoc(ref, { reactions: next });
}

export async function pinMessage(
  chatId: string,
  messageId: string,
  pin: boolean,
): Promise<void> {
  const ref = doc(db, CHATS, chatId);
  await updateDoc(ref, {
    pinnedMessageIds: pin ? arrayUnion(messageId) : arrayRemove(messageId),
  });
}

export async function toggleArchiveChat(
  chatId: string,
  uid: string,
  archived: boolean,
): Promise<void> {
  await updateDoc(doc(db, CHATS, chatId), {
    archivedBy: archived ? arrayUnion(uid) : arrayRemove(uid),
  });
}

export async function togglePinChat(
  chatId: string,
  uid: string,
  pinned: boolean,
): Promise<void> {
  await updateDoc(doc(db, CHATS, chatId), {
    [`isPinned.${uid}`]: pinned,
  });
}

export async function logSession(
  uid: string,
  browser: string,
  device: string,
): Promise<string> {
  const ref = doc(collection(db, SESSIONS));
  await setDoc(ref, {
    userId: uid,
    browser,
    device,
    ip: null,
    loginAt: serverTimestamp(),
    isActive: true,
  });
  return ref.id;
}

export async function listSessions(uid: string): Promise<
  {
    id: string;
    browser: string;
    device: string;
    loginAt: Timestamp;
    isActive: boolean;
  }[]
> {
  const qy = query(collection(db, SESSIONS), where("userId", "==", uid));
  const snap = await getDocs(qy);
  const rows: {
    id: string;
    browser: string;
    device: string;
    loginAt: Timestamp;
    isActive: boolean;
  }[] = [];
  snap.forEach((d) => {
    rows.push({
      id: d.id,
      ...(d.data() as Omit<(typeof rows)[0], "id">),
    });
  });
  rows.sort((a, b) => b.loginAt.toMillis() - a.loginAt.toMillis());
  return rows;
}

export async function deactivateSessions(uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, SESSIONS), where("userId", "==", uid)),
  );
  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { isActive: false }));
  await batch.commit();
}

export async function deleteUserAccount(uid: string): Promise<void> {
  const u = await getUser(uid);
  if (u?.isSystem) throw new Error("cannot_delete_system");
  const batch = writeBatch(db);
  if (u?.usernameLower)
    batch.delete(doc(db, USERNAMES, u.usernameLower));
  batch.delete(doc(db, USERS, uid));
  await batch.commit();
}

export function subscribeAllUsers(cb: (users: UserDoc[]) => void): Unsubscribe {
  return onSnapshot(collection(db, USERS), (snap) => {
    const list: UserDoc[] = [];
    snap.forEach((d) =>
      list.push({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) }),
    );
    cb(list);
  });
}

export async function listAllUsersOnce(): Promise<UserDoc[]> {
  const snap = await getDocs(collection(db, USERS));
  const list: UserDoc[] = [];
  snap.forEach((d) =>
    list.push({ uid: d.id, ...(d.data() as Omit<UserDoc, "uid">) }),
  );
  return list;
}

export async function addMonitoringTarget(
  ownerId: string,
  target: UserDoc,
): Promise<void> {
  const ref = doc(collection(db, MONITORING));
  await setDoc(ref, {
    ownerId,
    targetUsername: target.username,
    targetUid: target.uid,
    startedAt: serverTimestamp(),
  });
}

export function subscribeMonitoring(
  ownerId: string,
  cb: (rows: { id: string; targetUid: string; targetUsername: string }[]) => void,
): Unsubscribe {
  const qy = query(
    collection(db, MONITORING),
    where("ownerId", "==", ownerId),
  );
  return onSnapshot(qy, (snap) => {
    const list: { id: string; targetUid: string; targetUsername: string }[] =
      [];
    snap.forEach((d) => {
      const x = d.data();
      list.push({
        id: d.id,
        targetUid: x.targetUid,
        targetUsername: x.targetUsername,
      });
    });
    cb(list);
  });
}

export async function removeMonitoring(id: string): Promise<void> {
  await deleteDoc(doc(db, MONITORING, id));
}

export async function createGroupChat(
  creatorId: string,
  memberIds: string[],
  title: string,
  photoURL: string | null,
): Promise<string> {
  const ref = doc(collection(db, CHATS));
  const participants = [...new Set([creatorId, ...memberIds])];
  await setDoc(ref, {
    participants,
    lastMessage: "",
    lastMessageTime: serverTimestamp(),
    unreadCount: participants.reduce(
      (acc, u) => {
        acc[u] = 0;
        return acc;
      },
      {} as Record<string, number>,
    ),
    isPinned: participants.reduce(
      (acc, u) => {
        acc[u] = false;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
    type: "group",
    title,
    photoURL,
    adminIds: [creatorId],
    archivedBy: [],
  });
  return ref.id;
}

export async function adminDeleteChat(chatId: string): Promise<void> {
  const msgs = await getDocs(
    collection(db, CHATS, chatId, "messages"),
  );
  const batch = writeBatch(db);
  msgs.forEach((m) => batch.delete(m.ref));
  batch.delete(doc(db, CHATS, chatId));
  await batch.commit();
}
