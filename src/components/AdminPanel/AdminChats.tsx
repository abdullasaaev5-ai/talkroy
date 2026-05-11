"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeAllChats } from "@/lib/firestore";
import type { ChatDoc } from "@/types";
import { auth } from "@/lib/firebase";

export function AdminChats() {
  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    return subscribeAllChats(setChats);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return chats;
    return chats.filter(
      (c) =>
        c.id.toLowerCase().includes(t) ||
        (c.lastMessage ?? "").toLowerCase().includes(t),
    );
  }, [chats, q]);

  return (
    <div className="flex flex-col gap-4">
      <input
        className="rounded-xl border border-white/10 bg-tr-panel px-3 py-2 text-tr-text"
        placeholder="Поиск по id чата или последнему сообщению…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="space-y-2">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-tr-panel p-3"
          >
            <div className="min-w-0">
              <div className="font-mono text-xs text-tr-accent">{c.id}</div>
              <div className="truncate text-sm text-tr-muted">
                {c.lastMessage || "—"}
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-300 hover:bg-red-500/30"
              onClick={async () => {
                if (!confirm(`Удалить чат ${c.id}?`)) return;
                const u = auth.currentUser;
                if (!u) return;
                const token = await u.getIdToken();
                await fetch("/api/admin/delete-chat", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ chatId: c.id }),
                }).catch(() => {});
              }}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
