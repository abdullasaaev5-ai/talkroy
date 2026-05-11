"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LandingDemoChat } from "@/components/LandingDemoChat";
import { TalkRoyLogo } from "@/components/TalkRoyLogo";
import { signOutApp } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const router = useRouter();
  const { firebaseUser, profile, authResolved, loading } = useAuth();
  /** Для пользователя без профиля: дождались проверки talkroyAdmin, чтобы не мигать экраном. */
  const [sessionGateReady, setSessionGateReady] = useState(false);

  useEffect(() => {
    if (!authResolved || loading) return;
    if (!firebaseUser) {
      setSessionGateReady(false);
      return;
    }
    if (profile) {
      setSessionGateReady(true);
      router.push("/chat");
      return;
    }
    setSessionGateReady(false);
    void firebaseUser.getIdTokenResult().then((t) => {
      if (t.claims.talkroyAdmin === true) {
        router.push("/admin/stats");
        return;
      }
      setSessionGateReady(true);
    });
  }, [authResolved, loading, firebaseUser, profile, router]);

  if (!authResolved || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0f0f1a] text-[#94a3b8]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
        <p className="text-sm">Загрузка…</p>
      </div>
    );
  }

  if (firebaseUser && profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0f0f1a] text-[#94a3b8]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
        <p className="text-sm">Перенаправление в чаты…</p>
      </div>
    );
  }

  if (firebaseUser && !profile && !sessionGateReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0f0f1a] text-[#94a3b8]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
        <p className="text-sm">Проверка сессии…</p>
      </div>
    );
  }

  if (firebaseUser && !profile && sessionGateReady) {
    const em = firebaseUser.email?.trim();
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[#0f0f1a] px-4 py-12 text-center text-[#e2e8f0]">
        <TalkRoyLogo size={64} className="mb-1" />
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold text-white">Профиль ещё не заполнен</h1>
          <p className="text-sm leading-relaxed text-[#94a3b8]">
            Вы вошли в аккаунт
            {em ? (
              <>
                {" "}
                (<span className="text-[#cbd5e1]">{em}</span>)
              </>
            ) : null}
            . В Firebase Auth сессия есть, а в базе мессенджера для вас ещё нет карточки
            пользователя (никнейм и имя). Поэтому с главной страницы вас направляют на
            онбординг — это не сбой, а обязательный шаг один раз после регистрации.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-sm sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30"
          >
            Заполнить профиль
          </button>
          <button
            type="button"
            onClick={() => void signOutApp().then(() => router.replace("/"))}
            className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-[#94a3b8] hover:bg-white/5 hover:text-white"
          >
            Выйти
          </button>
        </div>
        <p className="max-w-md text-xs text-[#64748b]">
          Если вы уже проходили онбординг на этом устройстве, подождите сеть или
          обновите страницу: профиль подгружается из Firestore.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#e2e8f0]">
      <header className="border-b border-white/5 bg-[#131325]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex shrink-0 items-center">
            <TalkRoyLogo variant="wordmark" size={44} className="max-h-9 sm:max-h-11" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-[#94a3b8] hover:bg-white/5 hover:text-white"
            >
              Вход
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30"
            >
              Регистрация
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <section className="space-y-6">
            <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
              Мессенджер с акцентом на{" "}
              <span className="bg-gradient-to-r from-[#c4b5fd] to-[#7c3aed] bg-clip-text text-transparent">
                приватность
              </span>{" "}
              и скорость
            </h1>
            <p className="max-w-xl text-base text-[#94a3b8]">
              Чаты в реальном времени, уведомления от TalkRoy и знакомый
              двухпанельный интерфейс — как в привычных мессенджерах, но под вашим
              контролем.
            </p>
            <ul className="grid gap-3 text-sm text-[#cbd5e1] sm:grid-cols-2">
              <li className="rounded-xl border border-white/5 bg-[#131325] px-4 py-3">
                🔒 Сессии и вход по Google или email
              </li>
              <li className="rounded-xl border border-white/5 bg-[#131325] px-4 py-3">
                ⚡ Firestore в реальном времени
              </li>
              <li className="rounded-xl border border-white/5 bg-[#131325] px-4 py-3">
                @username для поиска людей
              </li>
              <li className="rounded-xl border border-white/5 bg-[#131325] px-4 py-3">
                🌙 Тёмная тема по умолчанию
              </li>
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] px-6 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Создать аккаунт
              </Link>
              <Link
                href="/login"
                className="inline-flex rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-white hover:bg-white/5"
              >
                Уже есть аккаунт
              </Link>
            </div>
          </section>

          <LandingDemoChat />
        </div>
      </main>
    </div>
  );
}
