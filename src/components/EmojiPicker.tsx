"use client";

import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { Theme } from "emoji-picker-react";
import { useTheme } from "@/contexts/ThemeContext";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function EmojiPickerPop({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const { resolved } = useTheme();

  function handleEmoji(d: EmojiClickData) {
    onSelect(d.emoji);
    onClose();
  }

  return (
    <div className="absolute bottom-14 left-0 z-40 rounded-xl shadow-2xl ring-1 ring-white/10">
      <button
        type="button"
        className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-tr-panel text-tr-muted shadow"
        onClick={onClose}
      >
        ✕
      </button>
      <Picker
        onEmojiClick={handleEmoji}
        theme={resolved === "dark" ? Theme.DARK : Theme.LIGHT}
      />
    </div>
  );
}
