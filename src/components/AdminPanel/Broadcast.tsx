"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

export function Broadcast() {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "active" | "inactive">(
    "all",
  );
  const [status, setStatus] = useState<string | null>(null);

  async function send() {
    const u = auth.currentUser;
    if (!u || !text.trim()) return;
    const base = (process.env.NEXT_PUBLIC_BROADCAST_NOTIFY_URL || "").trim();
    if (!base) {
      setStatus(
        "Не задан NEXT_PUBLIC_BROADCAST_NOTIFY_URL (Cloud Function broadcastEmail).",
      );
      return;
    }
    const token = await u.getIdToken();
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, filter }),
    });
    let j: { sent?: number; error?: string; truncated?: boolean } = {};
    try {
      j = (await res.json()) as typeof j;
    } catch {
      j = {};
    }
    setStatus(
      res.ok
        ? `Писем отправлено: ${j.sent ?? 0}${j.truncated ? " (есть лимит за один запуск)" : ""}`
        : j.error || `Ошибка ${res.status}`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        className="min-h-[120px] rounded-xl border border-white/10 bg-tr-panel px-3 py-2 text-tr-text"
        placeholder="Текст от имени @TalkRoy…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <select
        className="max-w-xs rounded-xl border border-white/10 bg-tr-panel px-3 py-2 text-tr-text"
        value={filter}
        onChange={(e) => setFilter(e.target.value as typeof filter)}
      >
        <option value="all">Всем пользователям</option>
        <option value="new">Новые (7 дней)</option>
        <option value="active">Активные (3 дня)</option>
        <option value="inactive">Неактивные</option>
      </select>
      <button
        type="button"
        className="max-w-xs rounded-xl bg-tr-accent py-2 font-semibold text-white"
        onClick={send}
      >
        Отправить рассылку
      </button>
      {status && <p className="text-sm text-tr-muted">{status}</p>}
    </div>
  );
}
