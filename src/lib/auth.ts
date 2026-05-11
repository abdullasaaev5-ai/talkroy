import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  linkWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

function authErrorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    return String((e as { code: string }).code);
  }
  return "";
}

/**
 * Сначала popup (остаёмся в SPA — нет полного перезагруза и «битого» кеша HTML на Hosting),
 * при блокировке окна — redirect.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");

  if (typeof window !== "undefined") {
    try {
      await signInWithPopup(auth, provider);
      return;
    } catch (e: unknown) {
      const code = authErrorCode(e);
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code ===
          "auth/account-exists-with-different-credential"
      ) {
        const err = e as { customData?: { email?: string } };
        const email = err.customData?.email;
        if (email) {
          const methods = await fetchSignInMethodsForEmail(auth, email).catch(
            () => [] as string[],
          );
          if (methods.includes("password")) {
            throw new Error(
              "Этот Google уже привязан к аккаунту с email и паролем. Войдите через «Email и пароль», затем при необходимости привяжите Google в настройках.",
            );
          }
        }
        throw new Error(
          "Аккаунт с такими данными уже существует. Войдите способом, который использовали при регистрации.",
        );
      }
      throw e;
    }
  }

  try {
    await signInWithRedirect(auth, provider);
  } catch (e: unknown) {
    if (authErrorCode(e) === "auth/account-exists-with-different-credential") {
      const err = e as { customData?: { email?: string } };
      const email = err.customData?.email;
      if (email) {
        const methods = await fetchSignInMethodsForEmail(auth, email).catch(
          () => [] as string[],
        );
        if (methods.includes("password")) {
          throw new Error(
            "Этот Google уже привязан к аккаунту с email и паролем. Войдите через «Email и пароль», затем при необходимости привяжите Google в настройках.",
          );
        }
      }
      throw new Error(
        "Аккаунт с такими данными уже существует. Войдите способом, который использовали при регистрации.",
      );
    }
    throw e;
  }
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

/** Вход в админку: токен выдаёт Cloud Function `adminIssueToken`. */
export async function signInWithAdminGateToken(customToken: string) {
  return signInWithCustomToken(auth, customToken);
}

export async function registerWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return cred.user;
}

/** Добавить email+пароль к текущему пользователю (например после Google). Email = тот же, что в Google. */
export async function linkEmailPasswordToCurrentUser(password: string) {
  const u = auth.currentUser;
  if (!u?.email) {
    throw new Error(
      "У аккаунта Google нет email — включите email в настройках Google или зарегистрируйтесь по email.",
    );
  }
  const cred = EmailAuthProvider.credential(u.email, password);
  await linkWithCredential(u, cred);
}

export function userHasPasswordProvider(u: User | null): boolean {
  if (!u) return false;
  return u.providerData.some((p) => p.providerId === "password");
}

export async function signOutApp() {
  await signOut(auth);
}

/** Код ошибки Firebase Auth из объекта ошибки или из текста `Firebase: Error (auth/...)`. */
export function authErrorCodeFromUnknown(err: unknown): string {
  const direct = authErrorCode(err);
  if (direct) return direct;
  if (err instanceof Error) {
    const m =
      err.message.match(/\((auth\/[a-z0-9-]+)\)/i) ||
      err.message.match(/\b(auth\/[a-z0-9-]+)\b/i);
    if (m) return m[1].toLowerCase();
  }
  return "";
}

export function formatAuthError(err: unknown): string {
  const code = authErrorCodeFromUnknown(err);
  const map: Record<string, string> = {
    "auth/operation-not-allowed":
      "Этот способ входа не активирован. Войдите через Google или включите провайдер Email/Password в Firebase Console: Authentication → Sign-in method.",
    "auth/email-already-in-use": "Этот email уже зарегистрирован.",
    "auth/weak-password":
      "Пароль слишком слабый (минимум 6 символов по настройкам Firebase).",
    "auth/user-not-found": "Пользователь не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/invalid-credential":
      "Неверный email или пароль (или аккаунт создан только через Google — войдите через Google).",
    "auth/popup-closed-by-user": "Окно входа было закрыто.",
    "auth/network-request-failed":
      "Ошибка сети. Проверьте подключение.",
    "auth/invalid-email": "Некорректный email.",
    "auth/user-disabled": "Аккаунт отключён.",
    "auth/too-many-requests": "Слишком много попыток. Подождите.",
    "auth/provider-already-linked": "Пароль уже задан для этого аккаунта.",
    "auth/requires-recent-login":
      "Выйдите и войдите снова, затем повторите действие.",
  };
  if (code && map[code]) return map[code];
  if (code?.startsWith("auth/")) {
    return "Произошла ошибка. Попробуйте позже";
  }
  if (err instanceof Error) {
    if (
      err.message === "firestore_timeout" ||
      err.message === "firestore_unreachable"
    ) {
      return "Сервер данных временно не отвечает. Проверьте сеть и расширения браузера или попробуйте позже.";
    }
    const trimmed = err.message.trim();
    if (trimmed && !trimmed.startsWith("Firebase:")) {
      return trimmed;
    }
    if (trimmed) {
      return "Произошла ошибка. Попробуйте позже";
    }
  }
  return "Произошла ошибка. Попробуйте позже";
}
