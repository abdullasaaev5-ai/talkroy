import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** Заполняется при ошибке initializeApp — AuthProvider может показать лендинг вместо вечного спиннера. */
export let firebaseBootstrapError: string | null = null;

function getFirebaseApp(): FirebaseApp {
  try {
    if (!getApps().length) {
      return initializeApp(firebaseConfig);
    }
    return getApps()[0]!;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    firebaseBootstrapError = msg;
    console.error("[TalkRoy Firebase]", msg);
    if (getApps().length) return getApps()[0]!;
    throw e;
  }
}

export const app = getFirebaseApp();
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence).catch(() => {
    /* редкий отказ — сессия всё равно может работать в рамках вкладки */
  });
}

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

export const storage = getStorage(app);

export async function getFirebaseMessaging() {
  if (typeof window === "undefined") return null;
  const ok = await isSupported().catch(() => false);
  if (!ok) return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}
