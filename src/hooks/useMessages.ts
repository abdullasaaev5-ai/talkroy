"use client";

import { useEffect, useState } from "react";
import { subscribeMessages } from "@/lib/firestore";
import type { MessageDoc } from "@/types";

export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<MessageDoc[]>([]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    return subscribeMessages(chatId, setMessages, 50);
  }, [chatId]);

  return messages;
}
