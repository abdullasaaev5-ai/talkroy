"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiPickerPop } from "@/components/EmojiPicker";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { uploadFile } from "@/lib/storage";
import type { MessageDoc } from "@/types";
import { cn } from "@/lib/utils";

export function MessageInput({
  disabled,
  chatId,
  myUid,
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  lang,
}: {
  disabled?: boolean;
  chatId: string;
  myUid: string;
  onSend: (
    payload: {
      text: string;
      replyTo?: MessageDoc["replyTo"];
      mediaURL?: string | null;
      mediaName?: string | null;
      mediaSize?: number | null;
      type?: MessageDoc["type"];
    },
  ) => Promise<void>;
  onTyping: (v: boolean) => void;
  replyTo: MessageDoc | null;
  onCancelReply: () => void;
  lang: "ru" | "en";
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpTyping = useCallback(
    (typing: boolean) => {
      if (tRef.current) clearTimeout(tRef.current);
      onTyping(typing);
      if (typing) {
        tRef.current = setTimeout(() => onTyping(false), 2500);
      }
    },
    [onTyping],
  );

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  async function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    bumpTyping(false);
    await onSend({
      text: t,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            text: replyTo.text || replyTo.mediaName || "",
            senderId: replyTo.senderId,
          }
        : undefined,
      type: "text",
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || disabled) return;
    const path = `chats/${chatId}/files/${Date.now()}_${f.name}`;
    const url = await uploadFile(path, f, f.type);
    const isImg = f.type.startsWith("image/");
    await onSend({
      text: isImg ? "" : f.name,
      mediaURL: url,
      mediaName: f.name,
      mediaSize: f.size,
      type: isImg ? "image" : "file",
      replyTo: replyTo
        ? {
            id: replyTo.id,
            text: replyTo.text || "",
            senderId: replyTo.senderId,
          }
        : undefined,
    });
  }

  async function onVoice(blob: Blob) {
    if (disabled) return;
    const path = `chats/${chatId}/voice/${Date.now()}.webm`;
    const url = await uploadFile(path, blob, "audio/webm");
    await onSend({
      text: " ",
      mediaURL: url,
      type: "voice",
    });
  }

  return (
    <div className="relative border-t border-white/10 bg-tr-panel p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-tr-card px-3 py-2 text-sm text-tr-muted">
          <span className="line-clamp-2">
            ↩ {(replyTo.text || replyTo.mediaName || "").slice(0, 120)}
          </span>
          <button
            type="button"
            className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
            onClick={onCancelReply}
            aria-label={lang === "ru" ? "Отменить ответ" : "Cancel reply"}
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5 md:gap-2">
        <label className="flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl hover:bg-white/5 active:bg-white/10">
          📎
          <input type="file" className="hidden" onChange={onFile} />
        </label>
        <VoiceRecorder onBlob={onVoice} disabled={disabled} />
        <button
          type="button"
          className="flex h-11 min-w-11 items-center justify-center rounded-xl text-lg hover:bg-white/5 active:bg-white/10"
          onClick={() => setEmojiOpen((v) => !v)}
          aria-label="Emoji"
        >
          😊
        </button>
        {emojiOpen && (
          <EmojiPickerPop
            onSelect={(em) => {
              setText((t) => t + em);
              setEmojiOpen(false);
            }}
            onClose={() => setEmojiOpen(false)}
          />
        )}
        <textarea
          rows={1}
          disabled={disabled}
          className={cn(
            "max-h-32 min-h-[48px] flex-1 resize-none rounded-xl border border-white/10 bg-tr-card px-3 py-2.5 text-base text-tr-text outline-none focus:border-tr-accent md:min-h-[44px] md:text-sm",
            disabled && "opacity-50",
          )}
          placeholder={
            lang === "ru" ? "Сообщение…" : "Message…"
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            bumpTyping(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-tr-accent px-4 py-2 text-lg font-semibold text-white disabled:opacity-40 active:opacity-90"
          aria-label={lang === "ru" ? "Отправить" : "Send"}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
