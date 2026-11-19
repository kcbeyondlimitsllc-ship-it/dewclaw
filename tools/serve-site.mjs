#!/usr/bin/env node
/* Serves the site folder on THIS computer only, so the game's store can be tried with Stripe's test side
   without publishing anything. Node 18 or newer, no packages to install.

     node tools/serve-site.mjs            then open http://localhost:8788/games/kc-open-trail/

   It listens on 127.0.0.1 only: nothing outside this computer can reach it. Stop it with Ctrl+C.
   The port must stay 8788: the test worker (worker/wrangler.toml, [env.test.vars]) only answers that address.
   Steps: marketing/kc-open-trail/GO-LIVE-STRIPE.md, Part B. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const PORT = 8788;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400); return res.end(); }
  let file = path.normalize(path.join(SITE, p));
  if (file !== SITE && !file.startsWith(SITE + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (e, st) => {
    if (!e && st.isDirectory()) {
      if (!p.endsWith("/")) { res.writeHead(301, { location: p + "/" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "") }); return res.end(); }
      file = path.join(file, "index.html");
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
});
server.on("error", e => { console.error(e.code === "EADDRINUSE" ? `Port ${PORT} is already in use. Close the other program (or an earlier copy of this one) and try again.` : String(e.message || e)); process.exit(1); });
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${SITE}\n\n  The game:  http://localhost:${PORT}/games/kc-open-trail/\n\nOnly this computer can open it. Press Ctrl+C to stop.`);
});
