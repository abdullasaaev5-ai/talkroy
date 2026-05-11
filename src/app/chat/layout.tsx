export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-tr-bg">{children}</div>
  );
}
