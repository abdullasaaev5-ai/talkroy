"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

export function Monitor() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function watch() {
    const u = auth.currentUser;
    if (!u) return;
    setBusy(true);
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/admin/monitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });
      setData(await res.json());
    } finally {
      setBusy(false);
    }
  }

  const parsed = data as {
    chats?: { id: string; messages: Record<string, unknown>[] }[];
    sessions?: Record<string, unknown>[];
    user?: Record<string, unknown>;
    error?: string;
  } | null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-white/10 bg-tr-panel px-3 py-2 text-tr-text"
          placeholder="@username для мониторинга"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-tr-accent px-4 py-2 font-medium text-white disabled:opacity-50"
          onClick={watch}
        >
          Следить
        </button>
      </div>

      {parsed?.error && (
        <p className="text-sm text-red-400">{String(parsed.error)}</p>
      )}

      {parsed?.user && (
        <div className="rounded-xl border border-white/10 bg-tr-panel p-4 text-sm text-tr-muted">
          <pre className="overflow-auto whitespace-pre-wrap text-xs text-tr-text">
            {JSON.stringify(parsed.user, null, 2)}
          </pre>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {parsed?.chats?.map((ch) => (
          <div
            key={ch.id}
            className="max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-tr-panel p-3 tr-scroll"
          >
            <div className="mb-2 font-semibold text-tr-accent">{ch.id}</div>
            {ch.messages.map((m, idx) => (
              <div
                key={`${ch.id}-${idx}-${String(m.id)}`}
                className="mb-2 rounded-lg bg-tr-card p-2 text-xs text-tr-text ring-1 ring-emerald-500/20"
              >
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(m, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ))}
      </div>

      {parsed?.sessions && (
        <div className="rounded-xl border border-white/10 bg-tr-panel p-4">
          <h3 className="mb-2 font-semibold text-tr-text">Сессии / устройства</h3>
          <ul className="space-y-1 text-xs text-tr-muted">
            {parsed.sessions.map((s) => (
              <li key={String(s.id)}>
                <pre className="whitespace-pre-wrap text-tr-text">
                  {JSON.stringify(s)}
                </pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
