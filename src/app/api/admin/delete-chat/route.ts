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

  let body: { chatId?: string };
  try {
    body = (await req.json()) as { chatId?: string };
  } catch {
    return new NextResponse("invalid_json", { status: 400 });
  }
  const chatId = (body.chatId || "").trim();
  if (!chatId) return new NextResponse("missing_chatId", { status: 400 });

  const messagesRef = db.collection("chats").doc(chatId).collection("messages");
  for (;;) {
    const snap = await messagesRef.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const typingSnap = await db
    .collection("chats")
    .doc(chatId)
    .collection("typing")
    .get();
  if (!typingSnap.empty) {
    const batch = db.batch();
    typingSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await db.collection("chats").doc(chatId).delete();
  return NextResponse.json({ ok: true });
}
