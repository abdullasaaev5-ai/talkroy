import ChatDetailGate from "./ChatDetailGate";

/** Единственный прегенерируемый путь; остальные открываются через rewrite → этот HTML. */
export function generateStaticParams() {
  return [{ chatId: "_" }];
}

export default function ChatDetailPage() {
  return <ChatDetailGate />;
}
