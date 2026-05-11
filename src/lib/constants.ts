/** Официальная аватарка @TalkRoy. */
export const TALKROY_AVATAR_DATA_URI = "/images/talkroy-avatar.png";

/**
 * Никнейм: 4–15 символов, a–z, цифры, _ и -, начинается с буквы,
 * не может состоять только из цифр.
 */
export const USERNAME_RE =
  /^(?=.*[a-z])(?!^\d+$)[a-z][a-z0-9_\-]{3,14}$/;

/** Подстроки (латиница), запрещённые в нике — нечувствительны к регистру. */
const USERNAME_BLOCKED_SUBSTRINGS = [
  "fuck",
  "shit",
  "sex",
  "sexy",
  "porn",
  "nazi",
  "hitler",
  "slut",
  "whore",
  "dick",
  "cock",
  "cunt",
  "rape",
  "nigga",
  "nigger",
  "admin",
  "root",
];

export function isUsernameBlocked(unameLower: string): boolean {
  const s = unameLower.toLowerCase();
  return USERNAME_BLOCKED_SUBSTRINGS.some((b) => s.includes(b));
}

export const PASSWORD_MIN_LENGTH = 8;

export function normalizeUsernameInput(raw: string): string {
  return raw
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "");
}

export function isValidPassword(pw: string): boolean {
  return pw.length >= PASSWORD_MIN_LENGTH;
}
