"use client";

import { useParams } from "next/navigation";
import { ChatShell } from "@/components/ChatShell";

/** Для static export: реальный id берётся из URL (в т.ч. после rewrite Firebase). */
export default function ChatDetailGate() {
  const params = useParams();
  const chatId =
    typeof params.chatId === "string"
      ? params.chatId
      : Array.isArray(params.chatId)
        ? params.chatId[0]
        : undefined;
  return <ChatShell chatId={chatId} />;
}
