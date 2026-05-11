"use client";

import { useState } from "react";
import { searchUsersForChat, ensurePrivateChat } from "@/lib/firestore";
import type { UserDoc } from "@/types";
import { cn } from "@/lib/utils";

export function UserSearch({
  myUid,
  onPick,
  onClose,
}: {
  myUid: string;
  onPick: (chatId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const r = await searchUsersForChat(myUid, q);
      setResults(r);
    } finally {
      setLoading(false);
    }
  }

  async function pick(u: UserDoc) {
    const id = await ensurePrivateChat(myUid, u.uid);
    onPick(id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 p-0 md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-search-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default md:hidden"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(85dvh,32rem)] w-full max-w-md overflow-hidden rounded-t-3xl bg-tr-panel pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-2xl md:max-h-[80vh] md:rounded-2xl md:pb-0">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] md:pt-3">
          <h2 id="user-search-title" className="font-semibold text-tr-text">
            Новый чат
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 min-w-11 items-center justify-center rounded-xl text-lg text-tr-muted hover:bg-white/5 active:bg-white/10"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2 border-b border-white/10 p-3">
          <input
            className="min-h-11 flex-1 rounded-xl border border-white/10 bg-tr-card px-3 py-2.5 text-base text-tr-text outline-none focus:border-tr-accent md:text-sm"
            placeholder="@username или имя"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            autoFocus
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={search}
            className="flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-tr-accent px-4 font-semibold text-white active:opacity-90"
          >
            {loading ? "…" : "Найти"}
          </button>
        </div>
        <ul className="max-h-[min(50dvh,16rem)] overflow-y-auto tr-scroll pb-[env(safe-area-inset-bottom,0px)] md:max-h-64">
          {results.map((u) => (
            <li key={u.uid}>
              <button
                type="button"
                className={cn(
                  "flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/10 hover:bg-white/5 md:min-h-0 md:py-3",
                )}
                onClick={() => pick(u)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.photoURL || "/images/icon.png"}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <div className="font-medium text-tr-text">{u.displayName}</div>
                  <div className="text-sm text-tr-muted">{u.username}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
