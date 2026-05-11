/** Сообщение, если Firestore не отвечает (блокировщики, сеть, кэш). */
export const FIRESTORE_UNAVAILABLE_RU =
  "Не удалось связаться с Firestore. Это обычно не блокировка IP: чаще мешают расширения (блокировщики), «строгая» защита трекинга, старые данные сайта или другая вкладка TalkRoy. Попробуйте обновить страницу, закрыть лишние вкладки talkroy.com, для talkroy.com очистить данные сайта или зайти без расширений.";

export function isFirestoreTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message === "firestore_timeout";
}

export function isFirestoreUnreachableError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === "firestore_timeout" ||
      err.message === "firestore_unreachable" ||
      err.message === "timeout")
  );
}

export function friendlyFirestoreOrNetworkError(err: unknown): string {
  if (isFirestoreUnreachableError(err)) return FIRESTORE_UNAVAILABLE_RU;
  if (err instanceof Error) return err.message;
  return FIRESTORE_UNAVAILABLE_RU;
}
