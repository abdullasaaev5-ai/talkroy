"use client";

import { useEffect, useRef, useState } from "react";
import {
  markChatRead,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  setTyping,
  subscribeChat,
  subscribeTyping,
} from "@/lib/firestore";
import type { ChatDoc, MessageDoc } from "@/types";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageInput } from "@/components/MessageInput";
import { useMessages } from "@/hooks/useMessages";
import { formatLastSeen, usePeerPresence } from "@/hooks/usePresence";

export function ChatWindow({
  chatId,
  myUid,
  lang,
  onBack,
  soundEnabled,
  chatInFocus,
  talkRoyUid,
}: {
  chatId: string;
  myUid: string;
  lang: "ru" | "en";
  onBack?: () => void;
  soundEnabled: boolean;
  chatInFocus: boolean;
  /** UID официального аккаунта из config/system */
  talkRoyUid?: string;
}) {
  const [chat, setChat] = useState<ChatDoc | null>(null);
  const [replyTo, setReplyTo] = useState<MessageDoc | null>(null);
  const [qMsg, setQMsg] = useState("");
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDown, setShowDown] = useState(false);
  const prevLen = useRef(0);

  const messages = useMessages(chatId);

  useEffect(() => {
    return subscribeChat(chatId, setChat);
  }, [chatId]);

  useEffect(() => {
    return subscribeTyping(chatId, myUid, setTypingUids);
  }, [chatId, myUid]);

  const peerUid =
    chat?.type === "group"
      ? null
      : chat?.participants.find((p) => p !== myUid) ?? null;
  const peer = usePeerPresence(peerUid);

  const displayTitle =
    chat?.type === "group"
      ? chat.title || "Group"
      : peer?.displayName || "TalkRoy";

  const subtitle = peer
    ? formatLastSeen(peer.lastSeen.toMillis())
    : chat?.type === "system"
      ? lang === "ru"
        ? "Официальный аккаунт"
        : "Official"
      : "";

  const readOnly =
    !!chat?.systemReadOnly &&
    !!talkRoyUid &&
    myUid !== talkRoyUid;

  useEffect(() => {
    if (!chatId || !myUid) return;
    markChatRead(chatId, myUid).catch(() => {});
  }, [chatId, myUid, messages.length]);

  useEffect(() => {
    if (messages.length > prevLen.current && prevLen.current > 0) {
      const last = messages[messages.length - 1];
      if (last && last.senderId !== myUid) {
        if (!chatInFocus && soundEnabled) {
          try {
            const ctx = new AudioContext();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.value = 880;
            g.gain.value = 0.05;
            o.start();
            setTimeout(() => o.stop(), 120);
          } catch {
            /* ignore */
          }
        }
      }
    }
    prevLen.current = messages.length;
  }, [messages, myUid, chatInFocus, soundEnabled]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatId, messages.length]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowDown(dist > 200);
  }

  const visibleMessages = messages.filter((m) => {
    if (m.hiddenFor?.includes(myUid)) return false;
    if (qMsg.trim()) {
      const t = (m.text || "").toLowerCase();
      if (!t.includes(qMsg.toLowerCase())) return false;
    }
    return true;
  });

  const pinnedIds = chat?.pinnedMessageIds ?? [];
  const pinnedList = messages.filter((m) => pinnedIds.includes(m.id));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-tr-bg">
      <header className="tr-safe-top flex items-center gap-2 border-b border-white/10 bg-tr-panel px-2 py-1.5 md:gap-3 md:px-3 md:py-2">
        {onBack && (
          <button
            type="button"
            className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-lg text-tr-muted hover:bg-white/5 active:bg-white/10 md:hidden"
            onClick={onBack}
            aria-label={lang === "ru" ? "Назад к списку" : "Back to chats"}
          >
            ←
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              chat?.type === "group"
                ? chat.photoURL || "/images/icon.png"
                : peer?.photoURL || "/images/icon.png"
            }
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1 truncate font-semibold text-tr-text">
              {displayTitle}
              {peer?.isVerified && (
                <span className="text-sky-400" title="verified">
                  ✓
                </span>
              )}
            </div>
            <div className="truncate text-xs text-tr-muted">
              {typingUids.length > 0
                ? lang === "ru"
                  ? "печатает…"
                  : "typing…"
                : subtitle}
            </div>
          </div>
        </div>
      </header>

      {pinnedList.length > 0 && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-tr-muted">
          📌 {lang === "ru" ? "Закреплено:" : "Pinned:"}{" "}
          {pinnedList.map((p) => (
            <span key={p.id} className="mr-2">
              {(p.text || "").slice(0, 80)}
            </span>
          ))}
        </div>
      )}

      <div className="border-b border-white/5 px-2 py-1.5">
        <input
          className="w-full rounded-xl border border-white/10 bg-tr-card px-3 py-2.5 text-base text-tr-text outline-none focus:border-tr-accent md:py-1.5 md:text-xs"
          placeholder={lang === "ru" ? "Поиск в чате…" : "Search in chat…"}
          value={qMsg}
          onChange={(e) => setQMsg(e.target.value)}
          enterKeyHint="search"
        />
      </div>

      <div
        className="tr-scroll relative flex-1 overflow-y-auto px-3 py-4"
        ref={scrollRef}
        onScroll={onScroll}
      >
        <div className="flex flex-col gap-2">
          {visibleMessages.map((m) => {
            const mine =
              m.senderId === myUid &&
              !(chat?.systemReadOnly && m.type === "system");
            let peerRead = false;
            if (mine && chat) {
              peerRead = chat.participants.every((p) =>
                p === myUid ? true : (m.readBy ?? []).includes(p),
              );
            }
            return (
              <MessageBubble
                key={m.id}
                msg={m}
                mine={mine}
                peerRead={peerRead}
                lang={lang}
                onReply={() => setReplyTo(m)}
                onCopy={() =>
                  navigator.clipboard.writeText(m.text || "").catch(() => {})
                }
                onEdit={
                  mine
                    ? () => {
                        const t = prompt(
                          lang === "ru" ? "Новый текст" : "New text",
                          m.text,
                        );
                        if (t != null)
                          editMessage(chatId, m.id, myUid, t).catch(() => {});
                      }
                    : undefined
                }
                onDelete={
                  mine
                    ? (mode) =>
                        deleteMessage(chatId, m.id, mode, myUid).catch(() => {})
                    : undefined
                }
                onForward={() => {
                  sessionStorage.setItem(
                    "talkroy_forward",
                    JSON.stringify({
                      text: m.text,
                      mediaURL: m.mediaURL,
                      type: m.type,
                    }),
                  );
                  alert(
                    lang === "ru"
                      ? "Откройте другой чат и отправьте сообщение — пересылка в буфере (упрощённо)."
                      : "Open another chat to forward (demo).",
                  );
                }}
                onReact={(emoji) =>
                  toggleReaction(chatId, m.id, myUid, emoji).catch(() => {})
                }
              />
            );
          })}
          <div ref={endRef} />
        </div>
        {showDown && (
          <button
            type="button"
            className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] right-3 flex h-12 w-12 items-center justify-center rounded-full bg-tr-accent text-lg text-white shadow-lg active:scale-95 md:bottom-4 md:right-4 md:h-10 md:w-10"
            onClick={() =>
              endRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            aria-label={lang === "ru" ? "Вниз" : "Scroll down"}
          >
            ↓
          </button>
        )}
      </div>

      {readOnly ? (
        <div className="border-t border-white/10 bg-tr-panel px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] text-center text-sm text-tr-muted">
          {lang === "ru"
            ? "Ответы в этот чат отключены. Уведомления от TalkRoy."
            : "You cannot reply in this chat. TalkRoy notifications only."}
        </div>
      ) : (
        <MessageInput
          chatId={chatId}
          myUid={myUid}
          disabled={false}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          lang={lang}
          onTyping={(v) => setTyping(chatId, myUid, v).catch(() => {})}
          onSend={async (payload) => {
            try {
              await sendMessage(chatId, myUid, {
                text: payload.text,
                type: payload.type,
                mediaURL: payload.mediaURL,
                mediaName: payload.mediaName,
                mediaSize: payload.mediaSize,
                replyTo: payload.replyTo,
              });
              setReplyTo(null);
            } catch (e) {
              if ((e as Error).message === "read_only_chat")
                alert(
                  lang === "ru" ? "Нельзя писать в этот чат" : "Read-only chat",
                );
            }
          }}
        />
      )}
    </div>
  );
}
