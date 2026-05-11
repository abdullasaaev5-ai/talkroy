"use client";

import { useEffect, useState } from "react";
import { subscribeChat } from "@/lib/firestore";
import type { ChatDoc } from "@/types";

export function useChat(chatId: string | null) {
  const [chat, setChat] = useState<ChatDoc | null>(null);

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      return;
    }
    return subscribeChat(chatId, setChat);
  }, [chatId]);

  return chat;
}
