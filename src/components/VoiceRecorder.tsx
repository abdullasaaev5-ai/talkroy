"use client";

import { useRef, useState } from "react";

export function VoiceRecorder({
  onBlob,
  disabled,
}: {
  onBlob: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const [rec, setRec] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunks.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      if (blob.size) onBlob(blob);
    };
    mr.start();
    mediaRef.current = mr;
    setRec(true);
  }

  function stop() {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRec(false);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={() => rec && stop()}
      onTouchStart={(e) => {
        e.preventDefault();
        start();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        stop();
      }}
      className="flex h-11 min-w-11 items-center justify-center rounded-xl text-lg text-tr-muted hover:bg-white/5 active:bg-white/10 disabled:opacity-40"
      title="Удерживайте для записи"
    >
      🎤
    </button>
  );
}
