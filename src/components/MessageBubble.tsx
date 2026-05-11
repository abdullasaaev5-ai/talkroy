"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { MessageDoc } from "@/types";
import { cn } from "@/lib/utils";

export function MessageBubble({
  msg,
  mine,
  peerRead,
  lang,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onCopy,
  onForward,
}: {
  msg: MessageDoc;
  mine: boolean;
  peerRead: boolean;
  lang: "ru" | "en";
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: (mode: "me" | "all") => void;
  onReact?: (emoji: string) => void;
  onCopy?: () => void;
  onForward?: () => void;
}) {
  const locale = lang === "ru" ? ru : undefined;
  const time =
    msg.createdAt?.toDate?.() instanceof Date
      ? format(msg.createdAt.toDate(), "HH:mm", { locale })
      : "";

  if (msg.hiddenFor?.length && mine === false) {
    /* visibility handled by parent */
  }

  return (
    <div
      className={cn(
        "group relative max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-md",
        mine
          ? "ml-auto tr-gradient-msg text-white"
          : "mr-auto border border-white/10 bg-tr-card text-tr-text dark:bg-[#1e293b] dark:text-[#e2e8f0]",
      )}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      {msg.replyTo && (
        <div
          className={cn(
            "mb-1 border-l-2 pl-2 text-xs opacity-80",
            mine ? "border-white/50" : "border-tr-accent",
          )}
        >
          {msg.replyTo.text.slice(0, 120)}
        </div>
      )}
      {msg.type === "image" && msg.mediaURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={msg.mediaURL}
          alt=""
          className="mb-1 max-h-60 rounded-lg"
        />
      )}
      {msg.type === "file" && (
        <a
          href={msg.mediaURL ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="mb-1 flex items-center gap-2 underline"
        >
          📎 {msg.mediaName} ({Math.round((msg.mediaSize ?? 0) / 1024)} KB)
        </a>
      )}
      {msg.type === "voice" && msg.mediaURL && (
        <audio controls src={msg.mediaURL} className="mb-1 max-w-full" />
      )}
      {msg.type === "gif" && msg.mediaURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={msg.mediaURL} alt="" className="mb-1 max-h-60 rounded-lg" />
      )}
      {!msg.isDeleted && (msg.type === "text" || msg.type === "system") && (
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
      )}
      {msg.isDeleted && (
        <p className="italic opacity-70">
          {lang === "ru" ? "Сообщение удалено" : "Message deleted"}
        </p>
      )}
      {msg.editedAt && !msg.isDeleted && (
        <span className="text-[10px] opacity-60">
          {lang === "ru" ? "изм." : "edited"}
        </span>
      )}
      <div
        className={cn(
          "mt-1 flex items-center justify-end gap-2 text-[10px] opacity-70",
          mine ? "text-white/80" : "",
        )}
      >
        <span>{time}</span>
        {mine && (
          <span title={peerRead ? "read" : "sent"}>
            {peerRead ? "✓✓" : "✓"}
          </span>
        )}
      </div>
      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(msg.reactions).map(([emoji, users]) =>
            users.length ? (
              <button
                type="button"
                key={emoji}
                className="rounded-full bg-black/20 px-2 py-0.5 text-xs"
                onClick={() => onReact?.(emoji)}
              >
                {emoji} {users.length}
              </button>
            ) : null,
          )}
        </div>
      )}

      <div
        className="mt-1.5 flex flex-wrap gap-1 md:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <BubbleAction label="↩" onClick={onReply} touch />
        <BubbleAction label="📋" onClick={onCopy} touch />
        {mine && <BubbleAction label="✎" onClick={onEdit} touch />}
        <BubbleAction label="↪" onClick={onForward} touch />
        {mine && (
          <BubbleAction
            label="🗑"
            onClick={() => onDelete?.("all")}
            touch
          />
        )}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 hidden gap-1 rounded-lg bg-black/70 p-1 group-hover:pointer-events-auto md:group-hover:flex">
        <BubbleAction label="↩" onClick={onReply} />
        <BubbleAction label="📋" onClick={onCopy} />
        {mine && <BubbleAction label="✎" onClick={onEdit} />}
        <BubbleAction label="↪" onClick={onForward} />
        {mine && (
          <BubbleAction label="🗑" onClick={() => onDelete?.("all")} />
        )}
      </div>
    </div>
  );
}

function BubbleAction({
  label,
  onClick,
  touch,
}: {
  label: string;
  onClick?: () => void;
  touch?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "pointer-events-auto rounded hover:bg-white/10",
        touch
          ? "flex min-h-10 min-w-10 items-center justify-center bg-black/15 text-base dark:bg-white/10"
          : "px-1 text-xs",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {label}
    </button>
  );
}
