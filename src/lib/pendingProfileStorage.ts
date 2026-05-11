import { Timestamp } from "firebase/firestore";
import type { UserDoc, UserSettings } from "@/types";

const STORAGE_KEY = "talkroy_pending_profile_v1";

export type PendingProfileV1 = {
  v: 1;
  uid: string;
  displayName: string;
  /** без @ */
  usernameLower: string;
  photoURL: string | null;
  email: string | null;
  language?: UserSettings["language"];
  savedAt: number;
};

function readAll(): Record<string, PendingProfileV1> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, PendingProfileV1>;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PendingProfileV1>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* квота / приватный режим */
  }
}

export function savePendingProfile(p: Omit<PendingProfileV1, "v" | "savedAt">) {
  const map = readAll();
  map[p.uid] = {
    v: 1,
    ...p,
    savedAt: Date.now(),
  };
  writeAll(map);
}

export function readPendingProfile(uid: string): PendingProfileV1 | null {
  const map = readAll();
  const row = map[uid];
  if (!row || row.v !== 1) return null;
  return row;
}

export function clearPendingProfile(uid: string) {
  const map = readAll();
  if (map[uid]) {
    delete map[uid];
    writeAll(map);
  }
}

const defaultSettings = (): UserSettings => ({
  theme: "dark",
  soundEnabled: true,
  pushEnabled: true,
  onlineVisibility: "everyone",
  language: "ru",
});

/** Временный профиль для UI, пока Firestore недоступен. */
export function userDocFromPending(uid: string, p: PendingProfileV1): UserDoc {
  const now = Timestamp.now();
  const settings = defaultSettings();
  if (p.language) settings.language = p.language;
  return {
    uid,
    displayName: p.displayName,
    username: `@${p.usernameLower}`,
    usernameLower: p.usernameLower,
    photoURL: p.photoURL,
    bio: "",
    email: p.email,
    createdAt: now,
    lastSeen: now,
    settings,
    role: "user",
    isVerified: false,
    isBlocked: false,
  };
}

/** Пытается записать профиль в Firestore и снять локальный черновик. */
export async function tryFlushPendingProfileToCloud(
  uid: string,
  pending: PendingProfileV1,
  onSynced: (doc: UserDoc) => void,
): Promise<void> {
  const { createUserProfileWithRetry, getUser } = await import("./firestore");
  try {
    const ok = await createUserProfileWithRetry(uid, {
      displayName: pending.displayName,
      username: pending.usernameLower,
      photoURL: pending.photoURL,
      email: pending.email,
      language: pending.language,
    });
    if (!ok) return;
    for (let i = 0; i < 5; i++) {
      const fresh = await getUser(uid);
      if (fresh) {
        clearPendingProfile(uid);
        onSynced(fresh);
        return;
      }
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    }
  } catch {
    /* оставляем pending для следующей попытки */
  }
}
