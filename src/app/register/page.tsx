"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TalkRoyLogo } from "@/components/TalkRoyLogo";
import { useAuth } from "@/hooks/useAuth";
import {
  authErrorCodeFromUnknown,
  formatAuthError,
  registerWithEmail,
  signInWithGoogle,
} from "@/lib/auth";
import { auth } from "@/lib/firebase";
import {
  createUserProfileWithRetry,
  isUsernameAvailable,
  seedTalkRoyWelcomeMessages,
} from "@/lib/firestore";
import {
  friendlyFirestoreOrNetworkError,
  isFirestoreUnreachableError,
} from "@/lib/firestoreErrors";
import {
  clearPendingProfile,
  savePendingProfile,
} from "@/lib/pendingProfileStorage";
import { RESERVED_USERNAMES } from "@/types";
import {
  USERNAME_RE,
  isUsernameBlocked,
  isValidPassword,
  normalizeUsernameInput,
  PASSWORD_MIN_LENGTH,
} from "@/lib/constants";
import { recordSessionAndNotifyApi, syncTalkRoyDm } from "@/lib/systemBot";

export default function RegisterPage() {
  const router = useRouter();
  const { firebaseUser, profile, authResolved, loading, refreshProfile } =
    useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submitLock = useRef(false);
  /** Пока идёт вход через Google — не даём useEffect увести до refreshProfile. */
  const oauthPending = useRef(false);

  useEffect(() => {
    if (!authResolved || loading) return;
    if (oauthPending.current) return;
    if (!firebaseUser) return;
    void firebaseUser.getIdTokenResult().then((t) => {
      if (t.claims.talkroyAdmin === true) router.push("/admin/stats");
      else if (profile) router.push("/chat");
      else router.push("/onboarding");
    });
  }, [authResolved, loading, firebaseUser, profile, router]);

  async function onGoogleRegister() {
    if (submitLock.current) return;
    setErr(null);
    setBusy(true);
    submitLock.current = true;
    oauthPending.current = true;
    try {
      await signInWithGoogle();
      const u = auth.currentUser;
      if (!u) return;
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
    } catch (er) {
      setErr(formatAuthError(er));
    } finally {
      oauthPending.current = false;
      setBusy(false);
      submitLock.current = false;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const un = normalizeUsernameInput(username);
    if (!USERNAME_RE.test(un)) {
      setErr(
        "Никнейм: 4–15 символов, a–z, цифры и _, начинается с буквы, не только цифры.",
      );
      return;
    }
    if (isUsernameBlocked(un)) {
      setErr("Такой никнейм недопустим.");
      return;
    }
    if (RESERVED_USERNAMES.includes(un)) {
      setErr("Этот никнейм зарезервирован.");
      return;
    }
    if (!isValidPassword(password)) {
      setErr(`Пароль не короче ${PASSWORD_MIN_LENGTH} символов.`);
      return;
    }
    if (password !== password2) {
      setErr("Пароли не совпадают.");
      return;
    }

    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    try {
      let free = true;
      try {
        free = await isUsernameAvailable(un);
      } catch {
        /* Firestore недоступен — не блокируем: уникальность проверится при записи */
        free = true;
      }
      if (!free) {
        setErr("Никнейм занят.");
        return;
      }
      const u = await registerWithEmail(email, password);
      const displayName =
        un.length >= 2 ? un.charAt(0).toUpperCase() + un.slice(1) : un;
      const ok = await createUserProfileWithRetry(u.uid, {
        displayName,
        username: un,
        photoURL: null,
        email: u.email ?? null,
      });
      if (!ok) {
        savePendingProfile({
          uid: u.uid,
          displayName,
          usernameLower: un,
          photoURL: null,
          email: u.email ?? null,
        });
      } else {
        clearPendingProfile(u.uid);
      }
      try {
        const dmId = await syncTalkRoyDm(u.uid);
        if (dmId) await seedTalkRoyWelcomeMessages(dmId, u.uid);
      } catch {
        /* системный чат опционален */
      }
      await refreshProfile();
      try {
        const token = await u.getIdToken();
        await recordSessionAndNotifyApi(token, u.uid, { kind: "register" });
      } catch {
        /* письмо опционально */
      }
      router.push("/chat");
    } catch (er) {
      if (authErrorCodeFromUnknown(er) === "auth/operation-not-allowed") {
        setErr(
          "Регистрация по email временно недоступна. Войдите через Google.",
        );
      } else {
        setErr(
          isFirestoreUnreachableError(er)
            ? friendlyFirestoreOrNetworkError(er)
            : formatAuthError(er),
        );
      }
    } finally {
      setBusy(false);
      submitLock.current = false;
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
          <h1 className="text-2xl font-bold text-white">Регистрация</h1>
          <p className="mt-2 text-sm text-[#94a3b8]">
            Быстрее всего — через Google. Либо email, никнейм и пароль ниже.
          </p>
        </div>

        {err && (
          <p className="mb-4 text-center text-sm text-red-400" role="alert">
            {err}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void onGoogleRegister()}
          className="mb-6 w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-900/30 disabled:opacity-50 md:py-3 md:text-sm"
        >
          {busy ? "…" : "Войти через Google"}
        </button>

        <p className="mb-4 text-center text-xs text-[#64748b]">
          Рекомендуемый способ: один клик, без пароля на этом шаге. Если аккаунт
          уже есть, вы попадёте в чаты; если нет — на заполнение профиля.
        </p>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-[#2d2d4a] bg-[#131325] p-6"
        >
          <p className="text-center text-xs font-medium uppercase tracking-wide text-[#64748b]">
            Или новый аккаунт по email
          </p>
          <label className="block text-sm text-[#94a3b8]">Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[#2d2d4a] bg-[#0f0f1a] px-4 py-3.5 text-base outline-none focus:border-[#7c3aed] md:text-sm"
            required
          />
          <label className="block text-sm text-[#94a3b8]">Никнейм</label>
          <div className="flex min-h-[3rem] items-center rounded-xl border border-[#2d2d4a] bg-[#0f0f1a]">
            <span className="flex items-center pl-3 text-[#64748b]">@</span>
            <input
              value={username}
              onChange={(e) =>
                setUsername(normalizeUsernameInput(e.target.value))
              }
              className="w-full bg-transparent py-3 pr-3 pl-1 text-base outline-none md:text-sm"
              placeholder="alex1"
              maxLength={15}
              autoComplete="username"
              required
            />
          </div>
          <p className="text-xs text-[#64748b]">
            4–15 символов: a–z, цифры, _ и -, с буквы, не только цифры. Если
            облако не отвечает, профиль временно сохранится в браузере и
            догрузится при следующем входе.
          </p>
          <label className="block text-sm text-[#94a3b8]">Пароль</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[#2d2d4a] bg-[#0f0f1a] px-4 py-3.5 text-base outline-none focus:border-[#7c3aed] md:text-sm"
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
          <label className="block text-sm text-[#94a3b8]">Повтор пароля</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full rounded-xl border border-[#2d2d4a] bg-[#0f0f1a] px-4 py-3.5 text-base outline-none focus:border-[#7c3aed] md:text-sm"
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] py-3.5 text-base font-semibold text-white disabled:opacity-50 md:py-3 md:text-sm"
          >
            {busy ? "Создание…" : "Создать аккаунт"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[#64748b]">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-[#c4b5fd] hover:underline">
            Войти
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-[#64748b]">
          Чтобы регистрация по email работала, в Firebase Console включите
          провайдер Email/Password: Authentication → Sign-in method.
        </p>
      </div>
    </main>
  );
}
