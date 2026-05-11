import {
  ensureTalkRoyChatForUser,
  getSystemConfig,
  setSystemTalkRoyUid,
} from "./firestore";
import { parseUa } from "./utils";

/** Admin panel: совпадает с OWNER_EMAIL / NEXT_PUBLIC_OWNER_EMAIL */
export function ownerEmailPublic(): string {
  return (process.env.NEXT_PUBLIC_OWNER_EMAIL || "").toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const o = ownerEmailPublic();
  if (!o) return false;
  return email.toLowerCase() === o;
}

/** Официальный аккаунт @TalkRoy: SYSTEM_EMAIL / NEXT_PUBLIC_SYSTEM_EMAIL */
export function systemEmailPublic(): string {
  return (process.env.NEXT_PUBLIC_SYSTEM_EMAIL || "").toLowerCase();
}

export function isSystemAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const s = systemEmailPublic();
  if (!s) return false;
  return email.toLowerCase() === s;
}

/** ID чата с @TalkRoy или null, если бот ещё не зарегистрирован в config. */
export async function syncTalkRoyDm(userUid: string): Promise<string | null> {
  const cfg = await getSystemConfig();
  const talkRoyUid = cfg?.talkRoyUid;
  if (!talkRoyUid || talkRoyUid === userUid) return null;
  return ensureTalkRoyChatForUser(userUid, talkRoyUid);
}

export async function registerTalkRoyUid(uid: string): Promise<void> {
  await setSystemTalkRoyUid(uid);
}

export type LoginNotifyKind = "login" | "register" | "onboarding";

/**
 * Письмо владельцу через Cloud Function (Gmail). Задайте NEXT_PUBLIC_LOGIN_NOTIFY_URL
 * на HTTPS-адрес функции `loginNotify`, иначе вызов пропускается.
 */
export async function recordSessionAndNotifyApi(
  idToken: string,
  uid: string,
  opts?: { kind?: LoginNotifyKind },
): Promise<void> {
  const url = (process.env.NEXT_PUBLIC_LOGIN_NOTIFY_URL || "").trim();
  if (!url) return;

  const { browser, device } = parseUa();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        browser,
        device,
        uid,
        kind: opts?.kind ?? "login",
      }),
    });
  } catch {
    /* сеть / таймаут */
  } finally {
    clearTimeout(t);
  }
}
