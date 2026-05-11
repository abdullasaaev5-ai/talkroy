"use client";

import { useEffect, useState } from "react";
import { subscribeUser } from "@/lib/firestore";
import type { UserDoc } from "@/types";

export function usePeerPresence(peerUid: string | null) {
  const [peer, setPeer] = useState<UserDoc | null>(null);

  useEffect(() => {
    if (!peerUid) {
      setPeer(null);
      return;
    }
    return subscribeUser(peerUid, setPeer);
  }, [peerUid]);

  return peer;
}

export function formatLastSeen(lastSeenMs: number): string {
  const diff = Date.now() - lastSeenMs;
  if (diff < 60_000) return "в сети";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `был(а) ${m} мин. назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `был(а) ${h} ч. назад`;
  const d = Math.floor(h / 24);
  return `был(а) ${d} дн. назад`;
}
