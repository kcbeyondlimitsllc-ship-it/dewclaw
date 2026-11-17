/* KC: Open Trail service worker: cache-first offline shell for this folder only.
   Bump VERSION whenever any file in SHELL changes.
   The real-product thumbnails (the merch pictures under img/) are deliberately NOT in SHELL: they load only when a grown-up opens the
   real-gear list (spec 5.5) and are then kept by the runtime cache below. */
const VERSION = "kc-open-trail-v7";
const PREFIX = "kc-open-trail-";
const SHELL = ["./", "./index.html", "./style.css", "./manifest.webmanifest",
  "./vendor/three/three.module.min.js",
  "./js/main.js", "./js/util.js", "./js/events.js", "./js/save.js", "./js/data.js", "./js/world.js", "./js/scenery.js", "./js/flora.js",
  "./js/fx.js", "./js/kc.js", "./js/camera.js", "./js/input.js", "./js/api.js", "./js/hud.js", "./js/npc.js", "./js/vehicles.js",
  "./js/collect.js", "./js/audio.js", "./js/uikit.js", "./js/photo.js", "./js/seams.js",
  "./js/economy.js", "./js/upgrades.js", "./js/shop.js", "./js/missions.js", "./js/activities.js", "./js/store.js", "./js/store-config.js", "./js/channel.js", "./js/merch.js", "./js/guide.js",
  "./css/economy.css", "./css/missions.css", "./css/store.css", "./css/merch.css", "./merch.json",
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
  /* same-origin game files only; anything else (e.g. the purchase worker) goes straight to the network */
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") {
        cache.put(req, res.clone()).catch(() => {});
        if (req.mode === "navigate") e.waitUntil(cache.addAll(SHELL).catch(() => {}));
      }
      return res;
    } catch (err) {
      if (req.mode === "navigate") { const shell = await cache.match("./index.html"); if (shell) return shell; }
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
