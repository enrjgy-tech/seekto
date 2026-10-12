// Keeps a copy of the app on the device so it opens without a connection. Only the app's own
// files are cached; nothing you create passes through here (it lives in the browser's storage).
const VERSION = "__VERSION__";
const FILES = __FILES__;
const CACHE = `seekto-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("seekto-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// The app's files: answer from the cache, fall back to the network. Anything else (AI services,
// storage, the connection server) goes straight to the network.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => (e.request.mode === "navigate" ? caches.match("./") : Response.error()))),
  );
});
