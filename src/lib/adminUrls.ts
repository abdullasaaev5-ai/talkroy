/** Спец-логин админки: @Admin или Admin (без учёта регистра, @ необязателен). */
export function isAdminGateLogin(raw: string): boolean {
  const s = raw.trim().replace(/^@+/, "").toLowerCase();
  return s === "admin";
}

/** URL HTTPS-функции adminIssueToken (спец-вход @Admin + пароль). */
export function getAdminIssueTokenUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_ADMIN_ISSUE_TOKEN_URL || "").trim();
  if (explicit) return explicit;
  const pid = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
  if (!pid) return "";
  return `https://us-central1-${pid}.cloudfunctions.net/adminIssueToken`;
}
