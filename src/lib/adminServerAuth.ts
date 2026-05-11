import { getAdminAuth } from "@/lib/firebase-admin";

export type AdminVerifyResult =
  | { ok: true; uid: string }
  | { ok: false; status: number; body: string };

export async function verifyTalkRoyAdminBearer(
  authorizationHeader: string | null,
): Promise<AdminVerifyResult> {
  const token = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : "";
  if (!token) return { ok: false, status: 401, body: "missing_token" };
  const adm = getAdminAuth();
  if (!adm) return { ok: false, status: 503, body: "admin_sdk_unconfigured" };
  try {
    const decoded = await adm.verifyIdToken(token);
    if (decoded.talkroyAdmin !== true) {
      return { ok: false, status: 403, body: "forbidden" };
    }
    return { ok: true, uid: decoded.uid };
  } catch {
    return { ok: false, status: 401, body: "invalid_token" };
  }
}
