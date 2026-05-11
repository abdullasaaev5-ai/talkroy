"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createUserProfile,
  createUserProfileWithRetry,
  isUsernameAvailable,
  seedTalkRoyWelcomeMessages,
  subscribeUsernameAvailability,
} from "@/lib/firestore";
import { savePendingProfile, clearPendingProfile } from "@/lib/pendingProfileStorage";
import { uploadFile } from "@/lib/storage";
import { RESERVED_USERNAMES, type UserRole } from "@/types";
import {
  USERNAME_RE,
  TALKROY_AVATAR_DATA_URI,
  isUsernameBlocked,
  isValidPassword,
  normalizeUsernameInput,
  PASSWORD_MIN_LENGTH,
} from "@/lib/constants";
import { TalkRoyLogo } from "@/components/TalkRoyLogo";
import { useAuth } from "@/hooks/useAuth";
import {
  isSystemAccountEmail,
  recordSessionAndNotifyApi,
  registerTalkRoyUid,
  syncTalkRoyDm,
} from "@/lib/systemBot";
import { cn } from "@/lib/utils";
import type { UserSettings } from "@/types";
import {
  formatAuthError,
  linkEmailPasswordToCurrentUser,
  userHasPasswordProvider,
} from "@/lib/auth";

function initialsAvatar(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient></defs><rect fill="url(#g)" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="white" font-size="36" font-family="system-ui" font-weight="600">${letters || "?"}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading: authLoading, refreshProfile } =
    useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nameOk, setNameOk] = useState<boolean | null>(null);
  const [language, setLanguage] = useState<UserSettings["language"]>("ru");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const systemAccount = isSystemAccountEmail(firebaseUser?.email);
  const needsPassword =
    !!firebaseUser &&
    !systemAccount &&
    !userHasPasswordProvider(firebaseUser);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace("/");
      return;
    }
    if (profile) {
      router.push("/chat");
      return;
    }
    void firebaseUser.getIdTokenResult().then((t) => {
      if (t.claims.talkroyAdmin === true) router.push("/admin/stats");
    });
  }, [authLoading, firebaseUser, profile, router]);

  useEffect(() => {
    const u = normalizeUsernameInput(username);
    if (!USERNAME_RE.test(u)) {
      setNameOk(null);
      return;
    }
    if (!firebaseUser) return;
    const unsub = subscribeUsernameAvailability(
      u,
      firebaseUser.uid,
      setNameOk,
    );
    return () => unsub();
  }, [username, firebaseUser]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const usernameNorm = normalizeUsernameInput(username);
  const usernameFormatOk = USERNAME_RE.test(usernameNorm);
  const usernamePolicyOk =
    usernameFormatOk &&
    !isUsernameBlocked(usernameNorm) &&
    !RESERVED_USERNAMES.includes(usernameNorm);

  type NickIndicator = "idle" | "wait" | "ok" | "bad";
  const nickIndicator: NickIndicator = systemAccount
    ? "idle"
    : !usernameFormatOk
      ? "idle"
      : !usernamePolicyOk
        ? "bad"
        : nameOk === null
          ? "wait"
          : nameOk
            ? "ok"
            : "bad";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const u = firebaseUser;
    if (!u) return;

    let un = normalizeUsernameInput(username);
    const dn = displayName.trim();
    if (!systemAccount && dn.length < 2) {
      setErr("Введите отображаемое имя (минимум 2 символа)");
      return;
    }
    if (systemAccount) {
      un = "talkroy";
    } else {
      if (needsPassword) {
        if (!isValidPassword(password)) {
          setErr(`Пароль не короче ${PASSWORD_MIN_LENGTH} символов.`);
          return;
        }
        if (password !== password2) {
          setErr("Пароли не совпадают.");
          return;
        }
      }
      if (!USERNAME_RE.test(un)) {
        setErr(
          "Никнейм: 4–15 символов, a–z, цифры, _ и -, с буквы, не только цифры.",
        );
        return;
      }
      if (isUsernameBlocked(un)) {
        setErr("Такой никнейм недопустим");
        return;
      }
      if (RESERVED_USERNAMES.includes(un)) {
        setErr("Этот никнейм зарезервирован");
        return;
      }
    }

    let free = true;
    if (!systemAccount) {
      try {
        free = await isUsernameAvailable(un, u.uid);
      } catch {
        /* сеть/Firestore — не блокируем, профиль можно сохранить локально */
        free = true;
      }
    }
    if (!systemAccount && !free) {
      setErr("Никнейм занят");
      return;
    }

    setBusy(true);
    try {
      if (!systemAccount && needsPassword) {
        await linkEmailPasswordToCurrentUser(password);
      }

      let photoURL: string | null = null;
      if (systemAccount) {
        photoURL = TALKROY_AVATAR_DATA_URI;
      } else if (file) {
        photoURL = await uploadFile(`avatars/${u.uid}/profile`, file, file.type);
      } else {
        photoURL = initialsAvatar(dn);
      }

      const role: UserRole = "user";

      if (systemAccount) {
        await createUserProfile(u.uid, {
          displayName: "TalkRoy",
          username: un,
          photoURL,
          email: u.email,
          role,
          isVerified: true,
          isSystem: true,
          language,
        });
        await registerTalkRoyUid(u.uid);
      } else {
        const ok = await createUserProfileWithRetry(u.uid, {
          displayName: dn,
          username: un,
          photoURL,
          email: u.email,
          role,
          isVerified: false,
          isSystem: false,
          language,
        });
        if (!ok) {
          savePendingProfile({
            uid: u.uid,
            displayName: dn,
            usernameLower: un,
            photoURL,
            email: u.email ?? null,
            language,
          });
        } else {
          clearPendingProfile(u.uid);
        }
      }

      try {
        const dmId = await syncTalkRoyDm(u.uid);
        if (dmId && !systemAccount) {
          await seedTalkRoyWelcomeMessages(dmId, u.uid);
        }
      } catch {
        // Не блокируем онбординг, если системный чат пока недоступен.
      }

      await refreshProfile();
      if (!systemAccount) {
        try {
          const token = await u.getIdToken();
          await recordSessionAndNotifyApi(token, u.uid, {
            kind: "onboarding",
          });
        } catch {
          /* письмо опционально */
        }
      }
      router.push("/chat");
    } catch (e: unknown) {
      setErr(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tr-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-tr-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-tr-bg px-4 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] pt-[max(1.25rem,env(safe-area-inset-top,0px))] md:py-10">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <div className="flex flex-col items-center text-center">
          <TalkRoyLogo size={56} className="mb-4" />
          <h1 className="text-2xl font-bold text-tr-text">Ваш профиль</h1>
          <p className="text-tr-muted">
            {systemAccount
              ? "Официальный аккаунт TalkRoy (SYSTEM_EMAIL)."
              : "Заполните данные для входа в мессенджер"}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/5 bg-tr-panel p-6 shadow-xl"
        >
          <label className="mb-2 block text-sm font-medium text-tr-muted">
            Язык интерфейса
          </label>
          <select
            className="mb-4 min-h-12 w-full rounded-xl border border-white/10 bg-tr-card px-4 py-3 text-base text-tr-text outline-none focus:border-tr-accent md:text-sm"
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value as UserSettings["language"])
            }
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>

          <label className="mb-2 block text-sm font-medium text-tr-muted">
            Отображаемое имя
          </label>
          <input
            className="mb-4 w-full rounded-xl border border-white/10 bg-tr-card px-4 py-3.5 text-base text-tr-text outline-none focus:border-tr-accent md:py-3 md:text-sm"
            value={systemAccount ? "TalkRoy" : displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={systemAccount}
            placeholder="Как показывать в чате (не никнейм)"
          />

          <label className="mb-2 block text-sm font-medium text-tr-muted">
            Никнейм {!systemAccount && "(4–15: a–z, цифры, _, -, с буквы)"}
          </label>
          <div className="relative mb-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tr-muted">
              @
            </span>
            <input
              className="w-full rounded-xl border border-white/10 bg-tr-card py-3.5 pl-8 pr-12 text-base text-tr-text outline-none focus:border-tr-accent disabled:opacity-60 md:py-3 md:text-sm"
              value={systemAccount ? "talkroy" : username}
              onChange={(e) =>
                setUsername(normalizeUsernameInput(e.target.value))
              }
              disabled={systemAccount}
              placeholder="alex1"
              maxLength={15}
            />
            {!systemAccount && usernameFormatOk && (
              <span
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 text-lg tabular-nums",
                  nickIndicator === "ok" && "text-emerald-400",
                  nickIndicator === "bad" && "text-red-400",
                  nickIndicator === "wait" && "text-tr-muted text-base",
                )}
                title={
                  nickIndicator === "wait"
                    ? "Проверяем, свободен ли ник в базе"
                    : nickIndicator === "bad" && !usernamePolicyOk
                      ? "Ник зарезервирован или недопустим по правилам сервиса"
                      : undefined
                }
              >
                {nickIndicator === "ok"
                  ? "✓"
                  : nickIndicator === "bad"
                    ? "✗"
                    : "…"}
              </span>
            )}
          </div>

          {!systemAccount && needsPassword && (
            <>
              <label className="mb-2 mt-4 block text-sm font-medium text-tr-muted">
                Пароль для входа по email
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="mb-2 w-full rounded-xl border border-white/10 bg-tr-card px-4 py-3.5 text-base text-tr-text outline-none focus:border-tr-accent md:py-3 md:text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`минимум ${PASSWORD_MIN_LENGTH} символов`}
              />
              <label className="mb-2 block text-sm font-medium text-tr-muted">
                Повтор пароля
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="mb-4 w-full rounded-xl border border-white/10 bg-tr-card px-4 py-3.5 text-base text-tr-text outline-none focus:border-tr-accent md:py-3 md:text-sm"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </>
          )}

          {!systemAccount && (
            <>
              <label className="mb-2 mt-4 block text-sm font-medium text-tr-muted">
                Аватар (необязательно)
              </label>
              <input
                type="file"
                accept="image/*"
                className="mb-4 w-full text-base text-tr-muted file:mr-4 file:rounded-lg file:border-0 file:bg-tr-accent file:px-4 file:py-2.5 file:text-sm file:text-white md:text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="mb-4 h-20 w-20 rounded-full object-cover"
                />
              )}
            </>
          )}

          {systemAccount && (
            <div className="mb-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={TALKROY_AVATAR_DATA_URI}
                alt="TalkRoy"
                className="h-24 w-24 rounded-full ring-2 ring-tr-accent/40"
              />
            </div>
          )}

          {err && (
            <p className="mb-4 text-sm text-red-400" role="alert">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={
              busy ||
              (!systemAccount &&
                (!usernameFormatOk ||
                  !usernamePolicyOk ||
                  nameOk === false ||
                  nickIndicator === "wait" ||
                  (needsPassword &&
                    (!isValidPassword(password) ||
                      password !== password2))))
            }
            className="w-full rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] py-3.5 text-base font-semibold text-white disabled:opacity-40 md:py-3 md:text-sm"
          >
            {busy ? "Сохранение…" : "Продолжить"}
          </button>
        </form>
      </div>
    </main>
  );
}
