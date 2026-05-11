"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutApp } from "@/lib/auth";
import { subscribeChats, getSystemConfig } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { TalkRoyLogo } from "@/components/TalkRoyLogo";
import { ChatList } from "@/components/ChatList";
import { ChatWindow } from "@/components/ChatWindow";
import { UserSearch } from "@/components/UserSearch";
import { useTalkRoyAdminClaim } from "@/hooks/useTalkRoyAdminClaim";
import { cn } from "@/lib/utils";

export function ChatShell({ chatId }: { chatId?: string }) {
  const router = useRouter();
  const { firebaseUser, profile, loading, authResolved } = useAuth();
  const { resolved, toggleLightDark } = useTheme();
  const [newOpen, setNewOpen] = useState(false);
  const [talkRoyUid, setTalkRoyUid] = useState<string | undefined>();

  const lang = profile?.settings?.language ?? "ru";

  useEffect(() => {
    getSystemConfig().then((c) => setTalkRoyUid(c?.talkRoyUid));
  }, []);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push("/login");
    else if (!loading && firebaseUser && !profile) router.push("/onboarding");
  }, [firebaseUser, profile, loading, router]);

  useEffect(() => {
    if (!profile?.uid) return;
    return subscribeChats(profile.uid, (list) => {
      const n = list.reduce(
        (s, c) => s + (c.unreadCount?.[profile.uid] ?? 0),
        0,
      );
      document.title = n ? `(${n}) TalkRoy Messenger` : "TalkRoy Messenger";
    });
  }, [profile?.uid]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (loading || !firebaseUser || !profile) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-tr-bg">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-tr-accent border-t-transparent" />
      </div>
    );
  }

  const { adminOperator, adminClaimResolved } = useTalkRoyAdminClaim(
    firebaseUser,
    authResolved && !loading,
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overscroll-none md:flex-row">
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-white/10 md:h-full md:w-96 md:border-r",
          chatId ? "hidden md:flex" : "flex min-h-0 flex-1",
        )}
      >
        <div className="tr-safe-top flex min-h-[52px] items-center gap-2 border-b border-white/10 bg-tr-panel px-3 py-2 md:py-3">
          <TalkRoyLogo size={36} />
          <span className="flex-1 font-semibold text-tr-text">TalkRoy</span>
          <button
            type="button"
            title="Тема"
            className="flex h-11 min-w-11 items-center justify-center rounded-xl text-xl hover:bg-white/5 active:bg-white/10"
            onClick={toggleLightDark}
          >
            {resolved === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            type="button"
            className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-tr-accent text-lg font-semibold text-white active:opacity-90"
            onClick={() => setNewOpen(true)}
            aria-label={lang === "ru" ? "Новый чат" : "New chat"}
          >
            +
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <ChatList
            myUid={profile.uid}
            talkRoyUid={talkRoyUid}
            selectedChatId={chatId}
            lang={lang}
          />
        </div>
        <nav className="tr-safe-bottom flex gap-2 border-t border-white/10 bg-tr-panel p-2">
          <Link
            href="/settings"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-tr-card py-2.5 text-center text-sm font-medium text-tr-text active:bg-white/10"
          >
            {lang === "ru" ? "Настройки" : "Settings"}
          </Link>
          {adminClaimResolved && adminOperator && (
            <Link
              href="/admin"
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-violet-900/40 py-2.5 text-center text-sm font-medium text-violet-200 active:bg-violet-900/60"
            >
              {lang === "ru" ? "Админ" : "Admin"}
            </Link>
          )}
          <button
            type="button"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-tr-card px-3 text-lg text-tr-muted active:bg-white/10"
            title={lang === "ru" ? "Выйти" : "Sign out"}
            onClick={() => signOutApp()}
          >
            ⏻
          </button>
        </nav>
      </aside>

      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-tr-bg",
          chatId ? "flex" : "hidden md:flex",
        )}
      >
        {chatId ? (
          <ChatWindow
            chatId={chatId}
            myUid={profile.uid}
            lang={lang}
            talkRoyUid={talkRoyUid}
            soundEnabled={profile.settings.soundEnabled}
            chatInFocus
            onBack={() => router.push("/chat")}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-tr-muted">
            <TalkRoyLogo size={72} />
            <p className="max-w-sm px-2">
              {lang === "ru"
                ? "Выберите чат из списка или нажмите «+», чтобы написать кому-то."
                : "Pick a chat from the list or tap «+» to message someone."}
            </p>
          </div>
        )}
      </section>

      {newOpen && (
        <UserSearch
          myUid={profile.uid}
          onPick={(id) => router.push(`/chat/${id}`)}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  );
}
