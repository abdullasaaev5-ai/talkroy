"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TalkRoyLogo } from "@/components/TalkRoyLogo";
import { useAuth } from "@/hooks/useAuth";
import {
  formatAuthError,
  signInWithAdminGateToken,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { getAdminIssueTokenUrl, isAdminGateLogin } from "@/lib/adminUrls";

export default function LoginPage() {
  const router = useRouter();
  const { firebaseUser, profile, authResolved, loading, refreshProfile } =
    useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const authActionLock = useRef(false);
  /** Пока пользователь только что нажал «Войти» / Google — не даём useEffect увести на онбординг до refreshProfile. */
  const manualSignIn = useRef(false);

  useEffect(() => {
    if (!authResolved || loading) return;
    if (manualSignIn.current) return;
    if (!firebaseUser) return;
    void firebaseUser.getIdTokenResult().then((t) => {
      if (t.claims.talkroyAdmin === true) {
        router.push("/admin/stats");
        return;
      }
      if (profile) router.push("/chat");
      else router.push("/onboarding");
    });
  }, [authResolved, loading, firebaseUser, profile, router]);

  async function routeAfterAuth() {
    const u = auth.currentUser;
    if (!u) return;
    try {
      await u.getIdToken(true);
    } catch {
      /* редкий сбой токена — всё равно пробуем профиль */
    }
    const doc = await refreshProfile();
    if (!auth.currentUser) return;
    if (doc) router.push("/chat");
    else router.push("/onboarding");
  }

  async function onEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (authActionLock.current) return;
    setErr(null);
    setBusy(true);
    authActionLock.current = true;
    manualSignIn.current = true;
    try {
      const login = email.trim();
      if (isAdminGateLogin(login)) {
        const url = getAdminIssueTokenUrl();
        if (!url) {
          setErr(
            "Не задан NEXT_PUBLIC_FIREBASE_PROJECT_ID или NEXT_PUBLIC_ADMIN_ISSUE_TOKEN_URL (функция adminIssueToken).",
          );
          return;
        }
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: password.trim() }),
            mode: "cors",
          });
        } catch {
          setErr(
            "Не удалось связаться с сервером входа в админку. Обычно это значит, что в Firebase ещё не задеплоена функция adminIssueToken (нужен план Blaze и команда firebase deploy --only functions), либо блокирует сеть/расширение.",
          );
          return;
        }
        const raw = await res.text();
        let j: { token?: string; error?: string } = {};
        try {
          j = raw ? (JSON.parse(raw) as typeof j) : {};
        } catch {
          j = {};
        }
        if (!res.ok || !j.token) {
          if (res.status === 404) {
            setErr(
              "Админ-вход не настроен: по адресу функции приходит 404. Включите план Blaze в Firebase и выполните: firebase deploy --only functions (или npm run deploy:google).",
            );
            return;
          }
          if (j.error === "bad_password") {
            setErr("Неверный пароль для входа в админку.");
            return;
          }
          if (j.error === "configure_ADMIN_GATE_UID_or_seed_talkroy") {
            setErr(
              "На сервере не найден пользователь для админ-входа. Создайте аккаунт @TalkRoy (скрипт seed) или задайте параметр ADMIN_GATE_UID в настройках функции adminIssueToken.",
            );
            return;
          }
          setErr(
            j.error ||
              (raw && raw.length < 200
                ? raw
                : `Ошибка сервера (${res.status}). Проверьте логи функции adminIssueToken в Firebase Console.`),
          );
          return;
        }
        await signInWithAdminGateToken(j.token);
        await auth.currentUser?.getIdToken(true);
        await refreshProfile();
        router.push("/admin/stats");
        return;
      }
      await signInWithEmail(login, password);
      await routeAfterAuth();
    } catch (er) {
      setErr(formatAuthError(er));
    } finally {
      manualSignIn.current = false;
      setBusy(false);
      authActionLock.current = false;
    }
  }

  async function onGoogle() {
    if (authActionLock.current) return;
    setErr(null);
    setBusy(true);
    authActionLock.current = true;
    manualSignIn.current = true;
    try {
      await signInWithGoogle();
      /** После popup редирект здесь: иначе useEffect может не сработать из‑за manualSignIn. Redirect уводит со страницы. */
      const u = auth.currentUser;
      if (u) {
        try {
          await u.getIdToken(true);
        } catch {
          /* ignore */
        }
        const doc = await refreshProfile();
        const t = await u.getIdTokenResult();
        if (t.claims.talkroyAdmin === true) router.push("/admin/stats");
        else if (doc) router.push("/chat");
        else router.push("/onboarding");
      }
    } catch (er) {
      setErr(formatAuthError(er));
    } finally {
      manualSignIn.current = false;
      setBusy(false);
      authActionLock.current = false;
    }
  }

  if (!authResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
      </div>
    );
  }

  if (firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] text-[#94a3b8]">
        Перенаправление…
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#0f0f1a] px-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(2rem,env(safe-area-inset-top,0px))] text-[#e2e8f0] md:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex text-sm font-medium text-[#94a3b8] hover:text-white"
        >
          ← Назад на главную
        </Link>
        <div className="mb-10 flex flex-col items-center text-center">
          <TalkRoyLogo size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-white">Вход</h1>
          <p className="mt-2 text-sm text-[#94a3b8]">TalkRoy Messenger</p>
        </div>

        {err && (
          <p className="mb-4 text-center text-sm text-red-400" role="alert">
            {err}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onGoogle}
          className="mb-6 w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-900/30 disabled:opacity-50 md:py-3 md:text-sm"
        >
          {busy ? "…" : "Войти через Google"}
        </button>

        <details className="mb-8 rounded-2xl border border-[#2d2d4a] bg-[#131325] [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer select-none px-6 py-4 text-center text-sm font-medium text-[#94a3b8] hover:text-[#e2e8f0]">
            Вход по email и пароль{" "}
            <span className="text-[#64748b]">(если регистрировались на сайте)</span>
          </summary>
          <form
            onSubmit={onEmailLogin}
            noValidate
            className="space-y-4 border-t border-[#2d2d4a] px-6 pb-6 pt-4"
          >
            <label className="block text-sm text-[#94a3b8]">
              Логин или email
            </label>
            <p className="text-xs leading-relaxed text-[#64748b]">
              Обычный вход: ваш <strong className="text-[#94a3b8]">email</strong> и пароль от
              аккаунта. Вход в{" "}
              <strong className="text-[#94a3b8]">панель администратора</strong>: в это поле
              напишите <span className="font-mono text-violet-300">@Admin</span>, ниже — пароль
              администратора (тот, что задан при настройке сервера).
            </p>
            <p className="text-xs leading-relaxed text-[#64748b]">
              После первого входа по email откроется экран с никнеймом и именем (онбординг) —
              пока его не пройдёте, при заходе на главную сайт будет предлагать заполнить профиль.
              Это нормальное поведение, не ошибка в консоли.
            </p>
            <input
              type="text"
              name="talkroy-login"
              autoComplete="username"
              inputMode="text"
              placeholder="@Admin или email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#2d2d4a] bg-[#0f0f1a] px-4 py-3.5 text-base outline-none focus:border-[#7c3aed] md:text-sm"
              required
            />
            <label className="block text-sm text-[#94a3b8]">Пароль</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#2d2d4a] bg-[#0f0f1a] px-4 py-3.5 text-base outline-none focus:border-[#7c3aed] md:text-sm"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl border border-[#2d2d4a] bg-[#0f0f1a] py-3.5 text-base font-semibold text-white hover:border-[#7c3aed]/50 disabled:opacity-50 md:py-3 md:text-sm"
            >
              {busy ? "…" : "Войти"}
            </button>
          </form>
        </details>

        <p className="text-center text-sm text-[#64748b]">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-[#c4b5fd] hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </main>
  );
}
