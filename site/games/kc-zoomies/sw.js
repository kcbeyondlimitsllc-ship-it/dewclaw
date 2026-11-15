/* KC Zoomies service worker: cache-first offline shell for this folder only.
   Bump VERSION whenever index.html or game.js changes. */
const VERSION = "kc-zoomies-v2";
const PREFIX = "kc-zoomies-";
const SHELL = ["./", "./index.html", "./game.js", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

/* Only ever remove this game's own old caches; the rest of the site keeps its own. */
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const scope = new URL("./", self.location).pathname;
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") {
        cache.put(req, res.clone()).catch(() => {});
        /* A cache miss on the page itself means the shell is gone (storage cleared, or another worker on this
           origin pruned it): put the whole shell back while we are online, so the next offline open works. */
        if (req.mode === "navigate") e.waitUntil(cache.addAll(SHELL).catch(() => {}));
      }
      return res;
    } catch (err) {
      if (req.mode === "navigate") { const shell = await cache.match("./index.html"); if (shell) return shell; }
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
