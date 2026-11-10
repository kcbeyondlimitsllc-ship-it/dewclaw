/* Dewclaw service worker: the app shell works with no signal, and settings
   changes still reach the phone. Bump VERSION whenever index.html changes. */
const VERSION = "dewclaw-2026.11.09d";
const SHELL = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./privacy.html", "./terms.html",
               "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./vendor/three.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Same-origin files: network first, so an edited config.js or a new build
   lands on the next open; the cache answers when there is no signal.
   Everything else (map tiles, fonts, research lookups) goes straight out. */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req);
      if (res && res.ok && (req.mode === "navigate" || SHELL.some(s => url.pathname.endsWith(s.replace("./", "/"))))) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") { const shell = await cache.match("./index.html"); if (shell) return shell; }
      throw new Error("offline");
    }
  })());
});
