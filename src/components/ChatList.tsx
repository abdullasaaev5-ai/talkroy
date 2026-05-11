"use client";

import { formatDistanceToNow } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeChats, getUser } from "@/lib/firestore";
import type { ChatDoc, UserDoc } from "@/types";
import { cn } from "@/lib/utils";

export function ChatList({
  myUid,
  talkRoyUid,
  selectedChatId,
  lang,
}: {
  myUid: string;
  talkRoyUid?: string;
  selectedChatId?: string | null;
  lang: "ru" | "en";
}) {
  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [peers, setPeers] = useState<Record<string, UserDoc | undefined>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    return subscribeChats(myUid, setChats);
  }, [myUid]);

  useEffect(() => {
    let cancelled = false;
    async function loadPeers() {
      const needed = new Set<string>();
      for (const c of chats) {
        const pid =
          c.type === "group"
            ? null
            : c.participants.find((p) => p !== myUid);
        if (pid) needed.add(pid);
      }
      const entries = await Promise.all(
        Array.from(needed).map(async (pid) => [pid, await getUser(pid)] as const),
      );
      if (cancelled) return;
      setPeers((prev) => {
        const next = { ...prev };
        for (const [pid, u] of entries) next[pid] = u ?? undefined;
        return next;
      });
    }
    loadPeers();
    return () => {
      cancelled = true;
    };
  }, [chats, myUid]);

  const sorted = useMemo(() => {
    const lc = q.trim().toLowerCase();
    const filt = chats.filter((c) => {
      if (!lc) return true;
      if (c.type === "group") return (c.title ?? "").toLowerCase().includes(lc);
      const pid = c.participants.find((p) => p !== myUid);
      const u = pid ? peers[pid] : undefined;
      if (!u) return true;
      return (
        u.displayName.toLowerCase().includes(lc) ||
        u.usernameLower.includes(lc)
      );
    });

    return [...filt].sort((a, b) => {
      const aRoy =
        talkRoyUid &&
        a.type === "system" &&
        a.participants.includes(talkRoyUid);
      const bRoy =
        talkRoyUid &&
        b.type === "system" &&
        b.participants.includes(talkRoyUid);
      if (aRoy && !bRoy) return -1;
      if (!aRoy && bRoy) return 1;
      const pa = a.isPinned?.[myUid] ? 1 : 0;
      const pb = b.isPinned?.[myUid] ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = a.lastMessageTime?.toMillis?.() ?? 0;
      const tb = b.lastMessageTime?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [chats, myUid, peers, q, talkRoyUid]);

  const locale = lang === "ru" ? ru : enUS;

  return (
    <div className="flex h-full flex-col bg-tr-panel">
      <div className="border-b border-white/10 p-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-tr-card px-3 py-3 text-base text-tr-text outline-none focus:border-tr-accent md:py-2 md:text-sm"
          placeholder={lang === "ru" ? "Поиск…" : "Search…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
        />
      </div>
      <div className="tr-scroll flex-1 overflow-y-auto">
        {sorted.map((c) => {
          const unread = c.unreadCount?.[myUid] ?? 0;
          const peerUid =
            c.type === "group"
              ? null
              : c.participants.find((p) => p !== myUid);
          const peer = peerUid ? peers[peerUid] : undefined;
          const title =
            c.type === "group"
              ? c.title || "Group"
              : peer?.displayName || "…";
          const subtitle =
            c.type === "group"
              ? `${c.participants.length} members`
              : peer?.username || "";
          const photo =
            c.type === "group"
              ? c.photoURL || "/images/icon.png"
              : peer?.photoURL || "/images/icon.png";

          const time =
            c.lastMessageTime?.toDate?.() instanceof Date
              ? formatDistanceToNow(c.lastMessageTime.toDate(), {
                  addSuffix: true,
                  locale,
                })
              : "";

          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={cn(
                "flex min-h-[4.25rem] gap-3 border-b border-white/5 px-3 py-3.5 transition active:bg-white/10 hover:bg-white/5 md:min-h-0 md:py-3",
                selectedChatId === c.id && "bg-white/10",
              )}
              onClick={() => {
                /* mobile handled via navigation */
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo || "/images/icon.png"}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-tr-text">
                    {title}
                  </span>
                  <span className="shrink-0 text-[11px] text-tr-muted">
                    {time}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-tr-muted">
                    {c.lastMessage || subtitle}
                  </span>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-tr-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
