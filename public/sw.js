/* eslint-disable no-restricted-globals */
/**
 * Навигации всегда с сети — после деплоя не остаётся старый HTML с чужими chunk-URL
 * (типичная причина «сломанного сайта» после входа через Google redirect).
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => fetch(event.request.url, { cache: "reload" })),
    );
  }
});
