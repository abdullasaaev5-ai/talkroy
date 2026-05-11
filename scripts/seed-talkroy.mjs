/**
 * Синхронизирует профиль @TalkRoy в Firestore для уже существующего
 * Firebase Auth пользователя с email из SYSTEM_EMAIL.
 *
 * Требуется:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — одной строкой JSON ключа сервисного аккаунта
 *   SYSTEM_EMAIL — тот же email, что у Google-аккаунта TalkRoy
 *
 * Запуск: npm run seed:talkroy
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const p = join(__dirname, "..", ".env.local");
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (!m) continue;
      const k = m[1].trim();
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const systemEmail = (process.env.SYSTEM_EMAIL || "").trim().toLowerCase();

if (!rawJson) {
  console.error("Укажите FIREBASE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}
if (!systemEmail) {
  console.error("Укажите SYSTEM_EMAIL");
  process.exit(1);
}

const cred = JSON.parse(rawJson);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: cred.project_id,
      clientEmail: cred.client_email,
      privateKey: cred.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

let userRecord;
try {
  userRecord = await auth.getUserByEmail(systemEmail);
} catch (e) {
  console.error(
    `Нет пользователя Auth с email ${systemEmail}. Сначала войдите через Google этим аккаунтом в приложении (или создайте пользователя в консоли Firebase).`,
  );
  console.error(e);
  process.exit(1);
}

const uid = userRecord.uid;
const batch = db.batch();
const userRef = db.doc(`users/${uid}`);
batch.set(
  userRef,
  {
    displayName: "TalkRoy",
    username: "@talkroy",
    usernameLower: "talkroy",
    photoURL:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#5b21b6"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#g)"/><text x="50" y="62" text-anchor="middle" fill="#fff" font-size="42" font-family="system-ui,sans-serif" font-weight="700">T</text></svg>`,
      ),
    bio: "",
    email: systemEmail,
    createdAt: FieldValue.serverTimestamp(),
    lastSeen: FieldValue.serverTimestamp(),
    settings: {
      theme: "dark",
      soundEnabled: true,
      pushEnabled: true,
      onlineVisibility: "everyone",
      language: "ru",
    },
    role: "user",
    isVerified: true,
    isBlocked: false,
    isSystem: true,
  },
  { merge: true },
);

batch.set(db.doc("usernames/talkroy"), { uid }, { merge: true });
batch.set(db.doc("config/system"), { talkRoyUid: uid }, { merge: true });

await batch.commit();
console.log("Seed OK: talkRoyUid =", uid);
