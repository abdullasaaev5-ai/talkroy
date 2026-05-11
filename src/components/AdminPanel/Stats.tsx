"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export function Stats() {
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      setData(await res.json());
    }
    load();
  }, []);

  if (err) {
    return (
      <p className="text-sm text-red-400">
        {err}. На сервере нужен FIREBASE_SERVICE_ACCOUNT_JSON (Vercel / Node) и
        задеплоены правила Firestore с claim talkroyAdmin.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-tr-accent border-t-transparent" />
      </div>
    );
  }

  const rows = [
    ["Всего пользователей", data.totalUsers],
    ["Новых за сегодня", data.newToday],
    ["Новых за неделю", data.newWeek],
    ["Новых за месяц", data.newMonth],
    ["Онлайн сейчас (<1 мин)", data.onlineNow],
    ["Сообщений (в первых 500 чатах)", data.messagesTotal],
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div
          key={String(k)}
          className="rounded-xl border border-white/10 bg-tr-panel p-4 shadow-md"
        >
          <div className="text-sm text-tr-muted">{k}</div>
          <div className="text-3xl font-bold text-tr-text">{v}</div>
        </div>
      ))}
      <div className="rounded-xl border border-dashed border-white/15 bg-tr-card p-4 text-sm text-tr-muted sm:col-span-2">
        Графики роста можно добавить при подключении Chart.js / Recharts к тем же
        данным.
      </div>
    </div>
  );
}
