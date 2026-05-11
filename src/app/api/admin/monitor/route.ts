import { NextResponse } from "next/server";
import { verifyTalkRoyAdminBearer } from "@/lib/adminServerAuth";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const v = await verifyTalkRoyAdminBearer(req.headers.get("authorization"));
  if (!v.ok) {
    return new NextResponse(v.body, { status: v.status });
  }
  const db = getAdminDb();
  if (!db) {
    return new NextResponse("admin_sdk_unconfigured", { status: 503 });
  }

  let body: { username?: string };
  try {
    body = (await req.json()) as { username?: string };
  } catch {
    return new NextResponse("invalid_json", { status: 400 });
  }
  const raw = (body.username || "").trim().replace(/^@/, "").toLowerCase();
  if (!raw) {
    return NextResponse.json({ error: "empty_username" }, { status: 400 });
  }

  const unSnap = await db.collection("usernames").doc(raw).get();
  if (!unSnap.exists) {
    return NextResponse.json({ error: "user_not_found", user: null });
  }
  const uid = (unSnap.data() as { uid?: string }).uid;
  if (!uid) {
    return NextResponse.json({ error: "bad_username_doc", user: null });
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists
    ? { id: userSnap.id, ...userSnap.data() }
    : { id: uid };

  const chatsSnap = await db
    .collection("chats")
    .where("participants", "array-contains", uid)
    .limit(40)
    .get();

  const chats: { id: string; messages: Record<string, unknown>[] }[] = [];
  for (const ch of chatsSnap.docs) {
    const msgSnap = await ch.ref
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(60)
      .get();
    const messages: Record<string, unknown>[] = [];
    msgSnap.forEach((m) =>
      messages.push({ id: m.id, ...m.data() } as Record<string, unknown>),
    );
    chats.push({ id: ch.id, messages });
  }

  const sessSnap = await db
    .collection("sessions")
    .where("userId", "==", uid)
    .limit(50)
    .get();
  const sessions: Record<string, unknown>[] = [];
  sessSnap.forEach((s) =>
    sessions.push({ id: s.id, ...s.data() } as Record<string, unknown>),
  );

  return NextResponse.json({ user, chats, sessions });
}
