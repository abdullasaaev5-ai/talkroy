/**
 * Почта с аккаунта Gmail (например talkroynotification@gmail.com) через пароль приложения.
 *
 * Перед деплоем:
 *   firebase functions:secrets:set GMAIL_APP_PASSWORD
 * (значение — «Пароль приложения» Google для этого Gmail, не обычный пароль.)
 *
 * Параметры (задаются при первом деплое или в консоли Firebase → Functions → Configuration):
 *   OWNER_NOTIFY_EMAIL — куда слать уведомления о входах / регистрациях (обычно владелец).
 *   NOTIFY_SENDER_EMAIL — от кого (по умолчанию talkroynotification@gmail.com).
 */
import * as admin from "firebase-admin";
import type { Request, Response } from "express";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret, defineString } from "firebase-functions/params";
import nodemailer from "nodemailer";

/** Пароль для входа @Admin на сайте; переопределите в Firebase → Functions params при необходимости. */
const adminPanelPassPlain = defineString("ADMIN_PANEL_PASSWORD", {
  default: "Bur4t1n0!",
});
const adminGateUid = defineString("ADMIN_GATE_UID", { default: "" });

if (!admin.apps.length) {
  admin.initializeApp();
}

const gmailPassword = defineSecret("GMAIL_APP_PASSWORD");
const senderEmail = defineString("NOTIFY_SENDER_EMAIL", {
  default: "talkroynotification@gmail.com",
});
const ownerNotifyEmail = defineString("OWNER_NOTIFY_EMAIL", {
  default: "",
});

const fnOpts = {
  region: "us-central1" as const,
  cors: true,
  secrets: [gmailPassword],
  memory: "256MiB" as const,
  timeoutSeconds: 120,
};

function millisFromFirestore(val: unknown): number {
  if (val && typeof val === "object" && "toMillis" in val) {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val && typeof val === "object" && "seconds" in val) {
    const s = (val as { seconds: number }).seconds;
    return s * 1000;
  }
  return 0;
}

async function sendOwnerMail(opts: {
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const owner = ownerNotifyEmail.value().trim();
  if (!owner) {
    throw new Error("OWNER_NOTIFY_EMAIL is not set (Firebase Functions params)");
  }
  const from = senderEmail.value().trim();
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: from,
      pass: gmailPassword.value(),
    },
  });
  await transport.sendMail({
    from: `"TalkRoy" <${from}>`,
    to: owner,
    replyTo: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
  });
}

/** Уведомление владельцу: вход, регистрация и т.п. */
export const loginNotify = onRequest(fnOpts, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const authz = req.headers.authorization || "";
    const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "missing_token" });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const body = req.body as {
      browser?: string;
      device?: string;
      uid?: string;
      kind?: string;
    };
    const rawKind = body?.kind;
    const kind =
      rawKind === "register"
        ? "register"
        : rawKind === "onboarding"
          ? "onboarding"
          : "login";
    const when = new Date().toLocaleString("ru-RU", { timeZone: "UTC" }) + " UTC";

    const subject =
      kind === "register"
        ? "TalkRoy — новая регистрация"
        : kind === "onboarding"
          ? "TalkRoy — завершён онбординг"
          : "TalkRoy — новый вход в аккаунт";

    const text =
      kind === "register"
        ? [
            "Зарегистрирован новый аккаунт (email + пароль).",
            `UID: ${decoded.uid}`,
            `Email: ${decoded.email || "—"}`,
            `Время: ${when}`,
            `Браузер / устройство: ${body?.browser || "—"} / ${body?.device || "—"}`,
          ].join("\n")
        : kind === "onboarding"
          ? [
              "Пользователь завершил онбординг (профиль в TalkRoy).",
              `UID: ${decoded.uid}`,
              `Email: ${decoded.email || "—"}`,
              `Время: ${when}`,
              `Браузер / устройство: ${body?.browser || "—"} / ${body?.device || "—"}`,
            ].join("\n")
          : [
              "Пользователь вошёл в TalkRoy (новая сессия / смена аккаунта).",
              `UID: ${decoded.uid}`,
              `Email: ${decoded.email || "—"}`,
              `Время: ${when}`,
              `Браузер / устройство: ${body?.browser || "—"} / ${body?.device || "—"}`,
            ].join("\n");

    await sendOwnerMail({
      subject,
      text,
      replyTo: decoded.email || undefined,
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    logger.error("loginNotify", e);
    res.status(500).json({ error: String(e) });
  }
});

const DAY_MS = 86_400_000;

/** Рассылка писем пользователям с email в Firestore (только владелец). */
export const broadcastEmail = onRequest(fnOpts, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const authz = req.headers.authorization || "";
    const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "missing_token" });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const owner = ownerNotifyEmail.value().trim().toLowerCase();
    const isGate = decoded.talkroyAdmin === true;
    const isNotifyOwner = !!owner && decoded.email?.toLowerCase() === owner;
    if (!isGate && !isNotifyOwner) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const body = req.body as { text?: string; filter?: string };
    const text = (body?.text || "").trim();
    const filter = body?.filter || "all";
    if (!text) {
      res.status(400).json({ error: "empty_text" });
      return;
    }

    const db = admin.firestore();
    const snap = await db.collection("users").limit(800).get();
    const now = Date.now();
    const from = senderEmail.value().trim();
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: from,
        pass: gmailPassword.value(),
      },
    });

    const MAX = 100;
    let sent = 0;

    for (const doc of snap.docs) {
      if (sent >= MAX) break;
      const d = doc.data();
      const email = typeof d.email === "string" ? d.email.trim() : "";
      if (!email || !email.includes("@")) continue;

      const createdMs = millisFromFirestore(d.createdAt);
      const lastMs = millisFromFirestore(d.lastSeen) || createdMs;

      if (filter === "new") {
        if (!createdMs || now - createdMs > 7 * DAY_MS) continue;
      } else if (filter === "active") {
        if (!lastMs || now - lastMs > 3 * DAY_MS) continue;
      } else if (filter === "inactive") {
        if (lastMs && now - lastMs <= 3 * DAY_MS) continue;
      }

      await transport.sendMail({
        from: `"TalkRoy" <${from}>`,
        to: email,
        subject: "TalkRoy — сообщение",
        text: `${text}\n\n—\nВы получили это письмо, потому что зарегистрированы в TalkRoy.`,
      });
      sent++;
      await new Promise((r) => setTimeout(r, 120));
    }

    await sendOwnerMail({
      subject: "TalkRoy — рассылка выполнена",
      text: `Отправлено писем: ${sent} (лимит за запуск: ${MAX}).\nФильтр: ${filter}\nТекст:\n${text}`,
    });

    res.status(200).json({
      sent,
      truncated: snap.size >= 800 || sent >= MAX,
    });
  } catch (e) {
    logger.error("broadcastEmail", e);
    res.status(500).json({ error: String(e) });
  }
});

const adminIssueOpts = {
  region: "us-central1" as const,
  cors: false,
  memory: "256MiB" as const,
  timeoutSeconds: 30,
  invoker: "public" as const,
};

/** Gen2 + ручной OPTIONS без заголовков даёт провал preflight в браузере — выставляем явно. */
function setAdminIssueCorsHeaders(req: Request, res: Response): void {
  const origin = String(req.headers.origin ?? "").trim();
  const allowed =
    /^https:\/\/(www\.)?talkroy\.com$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) ||
    /^https:\/\/talkroy-bdc29\.web\.app$/i.test(origin) ||
    /^https:\/\/talkroy-bdc29\.firebaseapp\.com$/i.test(origin);
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowed && origin ? origin : "https://talkroy.com",
  );
  if (allowed && origin) {
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

async function resolveAdminGateUid(): Promise<string | null> {
  const fromParam = adminGateUid.value().trim();
  if (fromParam) return fromParam;
  const db = admin.firestore();
  const cfg = await db.doc("config/system").get();
  const fromCfg = cfg.data()?.talkRoyUid;
  if (typeof fromCfg === "string" && fromCfg.length > 0) return fromCfg;
  const q = await db
    .collection("users")
    .where("usernameLower", "==", "talkroy")
    .limit(1)
    .get();
  if (!q.empty) return q.docs[0].id;
  return null;
}

/**
 * Спец-вход в админку (логин @Admin / Admin): POST { "password" } → { token }.
 * Пароль по умолчанию задаётся параметром ADMIN_PANEL_PASSWORD (дефолт Bur4t1n0!).
 * UID: ADMIN_GATE_UID или config/system.talkRoyUid или пользователь @talkroy.
 */
function parseAdminPostBody(req: {
  body?: unknown;
  rawBody?: Buffer;
}): { password?: string } {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) {
    return b as { password?: string };
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString("utf8")) as { password?: string };
    } catch {
      return {};
    }
  }
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as { password?: string };
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.rawBody)) {
    try {
      return JSON.parse(req.rawBody.toString("utf8")) as { password?: string };
    } catch {
      return {};
    }
  }
  return {};
}

export const adminIssueToken = onRequest(adminIssueOpts, async (req, res) => {
  setAdminIssueCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  try {
    const body = parseAdminPostBody(req as { body?: unknown; rawBody?: Buffer });
    const pwd = String(body.password ?? "");
    const expected = adminPanelPassPlain.value();
    if (!pwd || pwd !== expected) {
      res.status(401).json({ error: "bad_password" });
      return;
    }
    const uid = await resolveAdminGateUid();
    if (!uid) {
      res.status(500).json({
        error: "configure_ADMIN_GATE_UID_or_seed_talkroy",
      });
      return;
    }
    const token = await admin.auth().createCustomToken(uid, {
      talkroyAdmin: true,
    });
    res.status(200).json({ token });
  } catch (e) {
    logger.error("adminIssueToken", e);
    res.status(500).json({ error: String(e) });
  }
});
