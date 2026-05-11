"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  deactivateSessions,
  deleteUserAccount,
  listSessions,
  updateUserProfile,
  subscribeUsernameAvailability,
} from "@/lib/firestore";
import type { UserSettings } from "@/types";
import {
  USERNAME_RE,
  isUsernameBlocked,
  normalizeUsernameInput,
} from "@/lib/constants";
import { uploadFile } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { signOutApp } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { firebaseUser, profile, loading, refreshProfile } = useAuth();
  const { setTheme } = useTheme();
  const [sessions, setSessions] = useState<
    Awaited<ReturnType<typeof listSessions>>
  >([]);
  const [nameOk, setNameOk] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");

  const lang = profile?.settings.language ?? "ru";

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.push("/login");
      return;
    }
    if (profile) return;
    void firebaseUser.getIdTokenResult().then((t) => {
      if (t.claims.talkroyAdmin === true) router.push("/admin/stats");
      else router.push("/onboarding");
    });
  }, [firebaseUser, profile, loading, router]);

  useEffect(() => {
    if (profile?.uid) listSessions(profile.uid).then(setSessions);
  }, [profile?.uid]);

  useEffect(() => {
    if (!firebaseUser || !profile || profile.isSystem) return;
    const u = normalizeUsernameInput(username);
    if (!USERNAME_RE.test(u)) {
      setNameOk(null);
      return;
    }
    return subscribeUsernameAvailability(
      u,
      firebaseUser.uid,
      setNameOk,
    );
  }, [username, firebaseUser, profile?.isSystem]);

  async function saveSettings(next: Partial<UserSettings>) {
    if (!profile) return;
    const merged = { ...profile.settings, ...next };
    await updateUserProfile(profile.uid, { settings: merged });
    if (merged.theme) {
      setTheme(merged.theme);
      localStorage.setItem("talkroy_theme", merged.theme);
    }
    await refreshProfile();
  }

  if (!profile || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tr-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-tr-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-tr-bg px-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pt-[max(1.5rem,env(safe-area-inset-top,0px))] md:py-8">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <Link
            href="/chat"
            className="inline-flex min-h-11 items-center rounded-xl px-2 text-tr-muted hover:bg-white/5 hover:text-tr-text active:bg-white/10"
          >
            ← {lang === "ru" ? "Назад" : "Back"}
          </Link>
          <h1 className="text-xl font-bold text-tr-text">
            {lang === "ru" ? "Настройки" : "Settings"}
          </h1>
        </div>

        <section className="rounded-2xl border border-white/10 bg-tr-panel p-5">
          <h2 className="mb-4 font-semibold text-tr-text">
            {lang === "ru" ? "Профиль" : "Profile"}
          </h2>
          {!profile.isSystem && (
            <>
              <label className="mb-1 block text-sm text-tr-muted">
                {lang === "ru" ? "Имя" : "Name"}
              </label>
              <input
                className="mb-3 w-full rounded-xl border border-white/10 bg-tr-card px-3 py-3 text-base text-tr-text md:py-2 md:text-sm"
                defaultValue={profile.displayName}
                id="dn"
              />
              <label className="mb-1 block text-sm text-tr-muted">
                @username
              </label>
              <div className="relative mb-3">
                <input
                  className="w-full rounded-xl border border-white/10 bg-tr-card px-3 py-3 pr-10 text-base text-tr-text md:py-2 md:text-sm"
                  value={username || profile.username.replace(/^@/, "")}
                  onChange={(e) =>
                    setUsername(normalizeUsernameInput(e.target.value))
                  }
                  maxLength={15}
                />
                {nameOk !== null &&
                  USERNAME_RE.test(
                    normalizeUsernameInput(
                      username || profile.username.replace(/^@/, ""),
                    ),
                  ) && (
                  <span
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 text-lg",
                      nameOk ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {nameOk ? "✓" : "✗"}
                  </span>
                )}
              </div>
              <label className="mb-1 block text-sm text-tr-muted">
                {lang === "ru" ? "Био" : "Bio"}
              </label>
              <textarea
                className="mb-3 w-full rounded-xl border border-white/10 bg-tr-card px-3 py-3 text-base text-tr-text md:py-2 md:text-sm"
                rows={3}
                defaultValue={profile.bio}
                id="bio"
              />
              <label className="mb-2 block text-sm text-tr-muted">
                {lang === "ru" ? "Аватар" : "Avatar"}
              </label>
              <input
                type="file"
                accept="image/*"
                className="mb-4"
                id="av"
              />
            </>
          )}
          <button
            type="button"
            className="w-full rounded-xl bg-tr-accent py-3.5 text-base font-medium text-white active:opacity-90 md:py-2 md:text-sm"
            onClick={async () => {
              const dn = (
                document.getElementById("dn") as HTMLInputElement | null
              )?.value;
              const bio = (
                document.getElementById("bio") as HTMLInputElement | null
              )?.value;
              const unRaw = normalizeUsernameInput(
                username || profile.username.replace(/^@/, ""),
              );
              const prevLower = profile.usernameLower;
              const wantsUsernameChange =
                USERNAME_RE.test(unRaw) && unRaw !== prevLower;
              if (wantsUsernameChange && isUsernameBlocked(unRaw)) {
                alert(
                  lang === "ru"
                    ? "Такой никнейм недопустим."
                    : "This username is not allowed.",
                );
                return;
              }
              const av = (document.getElementById("av") as HTMLInputElement)
                ?.files?.[0];
              let photoURL = profile.photoURL;
              if (av && firebaseUser) {
                photoURL = await uploadFile(
                  `avatars/${firebaseUser.uid}/profile`,
                  av,
                  av.type,
                );
              }
              if (!profile.isSystem) {
                await updateUserProfile(profile.uid, {
                  displayName: dn ?? profile.displayName,
                  bio: bio ?? "",
                  photoURL,
                  ...(wantsUsernameChange && nameOk
                    ? {
                        username: `@${unRaw}`,
                        usernameLower: unRaw,
                      }
                    : {}),
                });
              }
              await refreshProfile();
            }}
          >
            {lang === "ru" ? "Сохранить профиль" : "Save profile"}
          </button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-tr-panel p-5">
          <h2 className="mb-4 font-semibold text-tr-text">
            {lang === "ru" ? "Тема" : "Theme"}
          </h2>
          <div className="flex gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  "min-h-11 flex-1 rounded-xl py-2.5 text-sm capitalize md:min-h-0 md:py-2",
                  profile.settings.theme === t
                    ? "bg-tr-accent text-white"
                    : "bg-tr-card text-tr-muted",
                )}
                onClick={() => saveSettings({ theme: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-tr-panel p-5">
          <h2 className="mb-4 font-semibold text-tr-text">
            {lang === "ru" ? "Уведомления" : "Notifications"}
          </h2>
          <label className="flex items-center justify-between py-2">
            <span>{lang === "ru" ? "Звук" : "Sound"}</span>
            <input
              type="checkbox"
              checked={profile.settings.soundEnabled}
              onChange={(e) => saveSettings({ soundEnabled: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between py-2">
            <span>Push</span>
            <input
              type="checkbox"
              checked={profile.settings.pushEnabled}
              onChange={(e) => saveSettings({ pushEnabled: e.target.checked })}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-white/10 bg-tr-panel p-5">
          <h2 className="mb-4 font-semibold text-tr-text">
            {lang === "ru" ? "Конфиденциальность" : "Privacy"}
          </h2>
          <select
            className="min-h-12 w-full rounded-xl border border-white/10 bg-tr-card px-3 py-2 text-base text-tr-text md:min-h-0 md:text-sm"
            value={profile.settings.onlineVisibility}
            onChange={(e) =>
              saveSettings({
                onlineVisibility: e.target.value as UserSettings["onlineVisibility"],
              })
            }
          >
            <option value="everyone">
              {lang === "ru" ? "Все видят онлайн" : "Everyone"}
            </option>
            <option value="contacts">
              {lang === "ru" ? "Только контакты" : "Contacts"}
            </option>
            <option value="nobody">
              {lang === "ru" ? "Никто" : "Nobody"}
            </option>
          </select>
        </section>

        <section className="rounded-2xl border border-white/10 bg-tr-panel p-5">
          <h2 className="mb-4 font-semibold text-tr-text">
            {lang === "ru" ? "Язык" : "Language"}
          </h2>
          <select
            className="min-h-12 w-full rounded-xl border border-white/10 bg-tr-card px-3 py-2 text-base text-tr-text md:min-h-0 md:text-sm"
            value={profile.settings.language}
            onChange={(e) =>
              saveSettings({
                language: e.target.value as UserSettings["language"],
              })
            }
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </section>

        <section className="rounded-2xl border border-white/10 bg-tr-panel p-5">
          <h2 className="mb-4 font-semibold text-tr-text">
            {lang === "ru" ? "Сессии" : "Sessions"}
          </h2>
          <ul className="mb-4 space-y-2 text-sm text-tr-muted">
            {sessions.map((s) => (
              <li key={s.id}>
                {s.browser}, {s.device}{" "}
                {s.isActive ? "" : `(${lang === "ru" ? "неактивна" : "inactive"})`}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="w-full rounded-xl bg-tr-card py-3.5 text-base text-tr-text active:bg-white/5 md:py-2 md:text-sm"
            onClick={async () => {
              if (!profile) return;
              await deactivateSessions(profile.uid);
              await signOutApp();
            }}
          >
            {lang === "ru"
              ? "Завершить все сессии и выйти"
              : "End all sessions & sign out"}
          </button>
        </section>

        {!profile.isSystem && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <button
              type="button"
              className="w-full rounded-xl bg-red-600 py-3.5 text-base font-medium text-white active:opacity-90 md:py-2 md:text-sm"
              onClick={async () => {
                if (
                  !confirm(
                    lang === "ru"
                      ? "Удалить аккаунт безвозвратно?"
                      : "Delete account permanently?",
                  )
                )
                  return;
                if (!firebaseUser) return;
                await deleteUserAccount(firebaseUser.uid);
                await signOutApp();
                router.push("/login");
              }}
            >
              {lang === "ru" ? "Удалить аккаунт" : "Delete account"}
            </button>
          </section>
        )}

        <button
          type="button"
          className="rounded-xl py-3 text-tr-muted hover:text-tr-text"
          onClick={() => signOutApp()}
        >
          {lang === "ru" ? "Выйти" : "Sign out"}
        </button>
      </div>
    </main>
  );
}
