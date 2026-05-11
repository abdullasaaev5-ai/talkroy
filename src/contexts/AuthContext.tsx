"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import { getRedirectResult, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUser, recordLoginEvent } from "@/lib/firestore";
import {
  readPendingProfile,
  tryFlushPendingProfileToCloud,
  userDocFromPending,
} from "@/lib/pendingProfileStorage";
import type { UserDoc } from "@/types";
import {
  recordSessionAndNotifyApi,
  syncTalkRoyDm,
} from "@/lib/systemBot";

type AuthCtx = {
  firebaseUser: User | null;
  profile: UserDoc | null;
  /** true пока не получен первый колбэк Firebase Auth (user или null). */
  authResolved: boolean;
  /** true пока тянем документ пользователя из Firestore (только если есть firebaseUser). */
  profileLoading: boolean;
  /** Удобный флаг для экранов вроде /chat: ждём auth и профиль. */
  loading: boolean;
  /** Возвращает профиль из Firestore или локальный черновик; объединяет параллельные вызовы для одного uid. */
  refreshProfile: () => Promise<UserDoc | null>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const GET_USER_ATTEMPT_MS = 5500;
/** Если Auth не ответил (блокировщики / сеть), не держим вечный спиннер на корне. */
const AUTH_STATE_FALLBACK_MS = 3000;

async function getUserOnce(uid: string): Promise<UserDoc | null> {
  try {
    return await Promise.race([
      getUser(uid),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), GET_USER_ATTEMPT_MS),
      ),
    ]);
  } catch {
    return null;
  }
}

async function loadProfileWithRetry(uid: string): Promise<UserDoc | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = await getUserOnce(uid);
    if (p) return p;
    if (attempt === 1) return null;
    await new Promise((r) => setTimeout(r, 280 * (attempt + 1)));
  }
  return null;
}

async function loadProfileOrPending(
  uid: string,
  setProfile: Dispatch<SetStateAction<UserDoc | null>>,
): Promise<UserDoc | null> {
  const p = await loadProfileWithRetry(uid);
  if (p) return p;
  if (typeof window === "undefined") return null;
  const pending = readPendingProfile(uid);
  if (!pending) return null;
  void tryFlushPendingProfileToCloud(uid, pending, (fresh) => {
    setProfile(fresh);
  });
  return userDocFromPending(uid, pending);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const authEmittedOnce = useRef(false);
  /** Первый колбэк onAuthStateChanged (даже если Firebase ответил позже таймаута). */
  const initialAuthFromFirebase = useRef(false);
  const prevUid = useRef<string | null>(null);
  /** Один активный refresh на uid — меньше зависаний при двойных кликах. */
  const profileRefreshRef = useRef<{
    uid: string;
    promise: Promise<UserDoc | null>;
  } | null>(null);

  const loading = !authResolved || profileLoading;

  const refreshProfile = useCallback(async (): Promise<UserDoc | null> => {
    const u = auth.currentUser;
    if (!u) {
      setProfile(null);
      setProfileLoading(false);
      profileRefreshRef.current = null;
      return null;
    }
    const cur = profileRefreshRef.current;
    if (cur && cur.uid === u.uid) {
      return cur.promise;
    }

    const run = async (): Promise<UserDoc | null> => {
      setProfileLoading(true);
      try {
        const p = await loadProfileOrPending(u.uid, setProfile);
        setProfile(p ?? null);
        return p ?? null;
      } finally {
        setProfileLoading(false);
        const slot = profileRefreshRef.current;
        if (slot?.uid === u.uid && slot.promise === promiseOut) {
          profileRefreshRef.current = null;
        }
      }
    };
    const promiseOut = run();
    profileRefreshRef.current = { uid: u.uid, promise: promiseOut };
    return promiseOut;
  }, []);

  useEffect(() => {
    void getRedirectResult(auth).catch(() => {
      /* нет редиректа или отмена — норма */
    });

    const fallback = setTimeout(() => {
      if (initialAuthFromFirebase.current) return;
      const cur = auth.currentUser;
      if (cur) {
        initialAuthFromFirebase.current = true;
        prevUid.current = cur.uid;
        setFirebaseUser(cur);
        setAuthResolved(true);
        setProfileLoading(true);
        void (async () => {
          const p = await loadProfileOrPending(cur.uid, setProfile);
          setProfile(p ?? null);
          setProfileLoading(false);
          if (p) {
            try {
              await syncTalkRoyDm(cur.uid);
            } catch {
              /* ignore */
            }
          }
        })();
        return;
      }
      setAuthResolved(true);
      setProfileLoading(false);
    }, AUTH_STATE_FALLBACK_MS);

    const unsub = onAuthStateChanged(auth, async (u) => {
      initialAuthFromFirebase.current = true;
      clearTimeout(fallback);
      const hadPrior = authEmittedOnce.current;
      authEmittedOnce.current = true;
      const priorUid = hadPrior ? prevUid.current : undefined;
      const freshLogin =
        hadPrior && !!u && priorUid !== undefined && priorUid !== u.uid;

      prevUid.current = u?.uid ?? null;

      setFirebaseUser(u);

      if (!u) {
        setProfile(null);
        setProfileLoading(false);
        setAuthResolved(true);
        return;
      }

      setProfileLoading(true);
      setAuthResolved(true);

      const p = await loadProfileOrPending(u.uid, setProfile);
      setProfile(p ?? null);
      setProfileLoading(false);

      if (freshLogin) {
        const method = u.providerData.some((pr) => pr.providerId === "google.com")
          ? "google"
          : "password";
        void recordLoginEvent(u.uid, {
          method,
          email: u.email ?? null,
          phone: u.phoneNumber ?? null,
          displayName: u.displayName ?? null,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
        }).catch(() => {});
      }

      if (p) {
        void (async () => {
          try {
            await syncTalkRoyDm(u.uid);
          } catch {
            /* системный чат не должен ломать вход */
          }
          if (freshLogin) {
            try {
              const token = await u.getIdToken();
              await recordSessionAndNotifyApi(token, u.uid, { kind: "login" });
            } catch {
              /* optional backend */
            }
          }
        })();
      }
    });

    return () => {
      clearTimeout(fallback);
      unsub();
    };
  }, []);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      authResolved,
      profileLoading,
      loading,
      refreshProfile,
    }),
    [firebaseUser, profile, authResolved, profileLoading, loading, refreshProfile],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
