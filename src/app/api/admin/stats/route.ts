import { NextResponse } from "next/server";
import { verifyTalkRoyAdminBearer } from "@/lib/adminServerAuth";
import { getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function millisFromFirestore(val: unknown): number {
  if (val && typeof val === "object" && "toMillis" in val) {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val && typeof val === "object" && "seconds" in val) {
    return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export async function GET(req: Request) {
  const v = await verifyTalkRoyAdminBearer(req.headers.get("authorization"));
  if (!v.ok) {
    return new NextResponse(v.body, { status: v.status });
  }
  const db = getAdminDb();
  if (!db) {
    return new NextResponse("admin_sdk_unconfigured", { status: 503 });
  }

  const now = Date.now();
  const startDay = new Date();
  startDay.setUTCHours(0, 0, 0, 0);
  const startWeek = now - 7 * 86_400_000;
  const startMonth = now - 30 * 86_400_000;

  const usersSnap = await db.collection("users").get();
  let totalUsers = 0;
  let newToday = 0;
  let newWeek = 0;
  let newMonth = 0;
  let onlineNow = 0;

  usersSnap.forEach((d) => {
    totalUsers++;
    const createdMs = millisFromFirestore(d.data().createdAt);
    if (createdMs >= startDay.getTime()) newToday++;
    if (createdMs >= startWeek) newWeek++;
    if (createdMs >= startMonth) newMonth++;
    const lastMs = millisFromFirestore(d.data().lastSeen) || createdMs;
    if (lastMs && now - lastMs < 60_000) onlineNow++;
  });

  let messagesTotal = 0;
  const chatsSnap = await db.collection("chats").limit(500).get();
  for (const doc of chatsSnap.docs) {
    try {
      const agg = await doc.ref.collection("messages").count().get();
      messagesTotal += agg.data().count;
    } catch {
      /* пропуск чата с битой схемой */
    }
  }

  return NextResponse.json({
    totalUsers,
    newToday,
    newWeek,
    newMonth,
    onlineNow,
    messagesTotal,
  });
}
