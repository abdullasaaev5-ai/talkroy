import { NextResponse } from "next/server";
import { verifyTalkRoyAdminBearer } from "@/lib/adminServerAuth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const v = await verifyTalkRoyAdminBearer(req.headers.get("authorization"));
  if (!v.ok) {
    return new NextResponse(v.body, { status: v.status });
  }
  const db = getAdminDb();
  const auth = getAdminAuth();
  if (!db || !auth) {
    return new NextResponse("admin_sdk_unconfigured", { status: 503 });
  }

  let body: { action?: string; targetUid?: string };
  try {
    body = (await req.json()) as { action?: string; targetUid?: string };
  } catch {
    return new NextResponse("invalid_json", { status: 400 });
  }
  const action = (body.action || "").trim();
  const targetUid = (body.targetUid || "").trim();
  if (!action || !targetUid) {
    return new NextResponse("missing_fields", { status: 400 });
  }

  const ref = db.collection("users").doc(targetUid);
  const snap = await ref.get();
  if (!snap.exists) return new NextResponse("no_user", { status: 404 });
  const data = snap.data() as { isSystem?: boolean; usernameLower?: string };

  if (data.isSystem) {
    return new NextResponse("cannot_touch_system", { status: 403 });
  }

  switch (action) {
    case "block":
      await ref.update({ isBlocked: true });
      break;
    case "unblock":
      await ref.update({ isBlocked: false });
      break;
    case "verify":
      await ref.update({ isVerified: true });
      break;
    case "moderator":
      await ref.update({ role: "moderator" });
      break;
    case "unmoderator":
      await ref.update({ role: "user" });
      break;
    case "delete": {
      const un = data.usernameLower;
      if (un) await db.collection("usernames").doc(un).delete().catch(() => {});
      await ref.delete();
      await auth.deleteUser(targetUid).catch(() => {});
      break;
    }
    default:
      return new NextResponse("unknown_action", { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
