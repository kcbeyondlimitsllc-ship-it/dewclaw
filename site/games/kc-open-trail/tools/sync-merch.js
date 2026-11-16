#!/usr/bin/env node
/* KC: Open Trail merch sync. THE OWNER RUNS THIS; players' browsers never do.

   It writes ../merch.json (the game's own list of the real KC Beyond Limits products) and small thumbnails into
   ../img/merch/<product id>.jpg, so the game never has to ask the shop for anything while it runs.

     node tools/sync-merch.js                    build from marketing/kc-open-trail/merch-catalog.json, fetch missing thumbnails
     node tools/sync-merch.js --live             read every product page on the shop first (title, price, sale price, picture)
     node tools/sync-merch.js --live --accept    ... and accept prices that moved (they are written with today's date)
     node tools/sync-merch.js --catalog <file>   use another catalogue file
     node tools/sync-merch.js --no-images        leave img/merch alone
     node tools/sync-merch.js --force-images     download every thumbnail again
     node tools/sync-merch.js --check            change nothing; exit 1 if merch.json or a thumbnail is missing or out of step

   Run it before every release and before and after every shop sale (spec 5.5). With --live it FAILS LOUDLY (exit 1,
   nothing written) when a product page is gone or a price moved, so a stale price cannot ship by accident.

   "price" is the lowest-priced variant ("from $X"). With --live it is read from the product page's own variant list and the
   row is marked "live": true; a later run without --live keeps such a price instead of going back to the catalogue file.

   Kept by hand in merch.json and never overwritten here: "retired" on a product, "notice" (one dated line of text such as
   "Shop sale, 20 to 27 November"), and shop.tracking ("unknown" | "none" | "on").

   Thumbnails are resized to 240 px JPEGs. That needs either `sharp` (npm i -g sharp) or `playwright`
   (run with NODE_PATH=$(npm root -g) if it is installed globally). Behind a proxy use Node 22.21+ with NODE_USE_ENV_PROXY=1.
   No keys, no logins: only public pages are read. */
'use strict';
const fs = require('fs'), path = require('path');

const GAME = path.resolve(__dirname, '..');
const OUT = path.join(GAME, 'merch.json'), IMG_DIR = path.join(GAME, 'img', 'merch');
const SHOP = 'https://kcbeyondlimits.com';
const THUMB = 240, QUALITY = 0.74;
const args = process.argv.slice(2), has = f => args.includes(f), val = f => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const CATALOG = path.resolve(val('--catalog') || path.join(GAME, '..', '..', '..', 'marketing', 'kc-open-trail', 'merch-catalog.json'));

/* ---- the design tables (spec 5.1 to 5.3). js/merch.js holds the same twin ids; tests/merch.test.js checks they agree. ---- */
const FEATURED = ['34460072', '34460076', '34341309', '34395138', '34399813', '34399669', '34399759', '34395132'];
const TWINS = {
  '34460071': 'hat:trucker', '34460072': 'hat:mountain-paw', '34460075': 'hat:flatbill', '34460076': 'hat:compass-beanie', '34460077': 'hat:pom-beanie',
  '34395138': 'collar:river', '34395135': 'tag:moon-compass', '34395136': 'harness:explore', '34399813': 'harness:camp-kc', '34341309': 'bandana:river-logo',
  '34395112': 'skin:van:adventure-club', '34399759': 'skin:skateboard:squatch', '34395132': 'decor:river-bed', '34399669': 'decor:camp-mug'
};
/* which shelf a product stands on, decided from its title; the first rule that matches wins */
const SHELF_RULES = [
  ['winter', /christmas|ornament|stocking|snow globe|gift wrap|gift bag/i],
  ['pets', /dog collar|dog leash|pet tank|dog tank|feeding mat|pet bed/i],
  ['cafe', /mug|can cooler/i],
  ['tailor', /cap\b|snapback|beanie|hoodie|sweatshirt|tee\b|crewneck|jacket/i],
  ['market', /decal|sticker|magnet|tote|phone case|laptop sleeve|mouse pad|acrylic panel/i]
];
const SHELF_COUNTS = { tailor: 18, pets: 6, cafe: 6, market: 12, winter: 12 };   /* spec 5.1; a warning is printed if the sort drifts */

const die = msg => { console.error('\nSYNC FAILED: ' + msg + '\n'); process.exit(1); };
const today = () => new Date().toISOString().slice(0, 10);
const cleanTitle = t => String(t || '').replace(/\s*[—–-]\s*KC Beyond Limits\s*$/i, '').replace(/\s+/g, ' ').trim();
const shelfOf = title => { for (const [id, re] of SHELF_RULES) if (re.test(title)) return id; return null; };
const money = v => { const n = Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null; };
const decode = s => String(s).replace(/&amp;/g, '&').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function get(url, as = 'text') {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { redirect: 'follow' }); if (r.status === 404 || r.status === 410) return { gone: true, status: r.status }; if (!r.ok) throw new Error('HTTP ' + r.status);
      return { body: as === 'buffer' ? Buffer.from(await r.arrayBuffer()) : await r.text(), type: r.headers.get('content-type') || '' }; }
    catch (e) { lastErr = e; await new Promise(res => setTimeout(res, 600 * (i + 1))); }
  }
  throw new Error(url + ': ' + (lastErr && (lastErr.cause && lastErr.cause.message || lastErr.message)));
}
async function pool(items, n, fn) { const out = new Array(items.length); let k = 0; await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } })); return out; }

/* read one product page of the shop: { title, price, was, img } or { gone } */
async function readPage(id) {
  const r = await get(`${SHOP}/product/${id}`); if (r.gone) return { gone: true };
  const h = r.body, m = re => { const x = h.match(re); return x ? decode(x[1]) : null; };
  const title = m(/<meta property="og:title" content="([^"]*)"/), shown = money(m(/data-testid="variantPrice"[^>]*>\s*\$?([0-9.,]+)/) || ''), was = money(m(/data-testid="originalVariantPrice"[^>]*>\s*\$?([0-9.,]+)/) || '');
  /* "from $X" must be the lowest-priced variant, which is not always the one the page shows first: the page data lists every variant's price in cents */
  const cents = [...h.matchAll(/retailPrice\\?":\s*(\d{2,7})\b/g)].map(x => +x[1]).filter(n => n > 0), price = cents.length ? (Math.min(...cents) / 100).toFixed(2) : shown;
  const img = (m(/<meta property="og:image" content="([^"]*)"/) || '').split('?')[0] || null;
  if (!title || !price) return { gone: true, why: 'the page has no title or no price' };
  return { title, price, was, img };
}

/* ---- thumbnails: sharp if it is installed, else a headless browser canvas through playwright ---- */
async function makeResizer() {
  try { const sharp = require('sharp'); return { name: 'sharp', resize: buf => sharp(buf).resize(THUMB, THUMB, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).jpeg({ quality: Math.round(QUALITY * 100), mozjpeg: true }).toBuffer(), close: async () => {} }; } catch (e) { /* not installed */ }
  try { const { chromium } = require('playwright'); const browser = await chromium.launch(), page = await browser.newPage(); await page.setContent('<!doctype html><title>resize</title>');
    return { name: 'playwright', close: () => browser.close(), resize: async (buf, type) => { const b64 = await page.evaluate(async ({ data, type, size, q }) => {
      const bin = atob(data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([u8], { type })), c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.imageSmoothingQuality = 'high'; const s = Math.min(size / bmp.width, size / bmp.height), w = bmp.width * s, hh = bmp.height * s; x.drawImage(bmp, (size - w) / 2, (size - hh) / 2, w, hh);
      return c.toDataURL('image/jpeg', q).split(',')[1]; }, { data: buf.toString('base64'), type: type || 'image/jpeg', size: THUMB, q: QUALITY }); return Buffer.from(b64, 'base64'); } }; } catch (e) { /* not installed */ }
  return null;
}

(async () => {
  if (!fs.existsSync(CATALOG)) die('catalogue file not found: ' + CATALOG);
  const cat = JSON.parse(fs.readFileSync(CATALOG, 'utf8')); if (!cat || !Array.isArray(cat.products) || !cat.products.length) die('the catalogue has no products');
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null, prevById = new Map(((prev && prev.products) || []).map(p => [p.id, p]));
  const LIVE = has('--live'), CHECK = has('--check');
  let checkedOn = /^\d{4}-\d{2}-\d{2}$/.test(cat.readOn || '') ? cat.readOn : today();
  let rows = cat.products.map(p => ({ id: String(p.id), title: p.title, price: money(p.price), was: money(p.was || ''), img: p.img || null }));
  for (const r of rows) { if (!/^\d{5,12}$/.test(r.id)) die('odd product id: ' + r.id); if (!r.price) die('product ' + r.id + ' has no price in the catalogue'); }
  if (new Set(rows.map(r => r.id)).size !== rows.length) die('the catalogue lists a product twice');

  if (LIVE) {
    console.log(`Reading ${rows.length} product pages on ${SHOP} ...`);
    const pages = await pool(rows, 4, r => readPage(r.id).catch(e => ({ error: e.message })));
    const gone = [], errors = [], moved = [];
    rows = rows.map((r, i) => { const pg = pages[i]; if (pg.error) { errors.push(`${r.id} ${cleanTitle(r.title)}: ${pg.error}`); return r; } if (pg.gone) { gone.push(`${r.id} ${cleanTitle(r.title)}${pg.why ? ' (' + pg.why + ')' : ''}`); return r; }
      const before = prevById.get(r.id) ? prevById.get(r.id).price : r.price; if (before !== pg.price) moved.push(`${r.id} ${cleanTitle(pg.title)}: $${before} -> $${pg.price}`);
      return { id: r.id, title: pg.title, price: pg.price, was: pg.was, img: pg.img || r.img, live: true }; });
    if (errors.length) die('could not read these pages (network?):\n  ' + errors.join('\n  '));
    if (gone.length) die('these product pages are GONE. Set "retired": true for them in merch.json and take them out of the catalogue file, then run again:\n  ' + gone.join('\n  '));
    if (moved.length && !has('--accept')) die('these PRICES MOVED since the last sync. Look at them, then run again with --accept:\n  ' + moved.join('\n  '));
    if (moved.length) console.log('Accepted price changes:\n  ' + moved.join('\n  '));
    checkedOn = today();
  }

  /* ---- the rows the game ships ---- */
  const products = [], noShelf = [];
  for (const r of rows) { const title = cleanTitle(r.title), shelf = shelfOf(title), old = prevById.get(r.id); if (!shelf) { noShelf.push(r.id + ' ' + title); continue; }
    /* without --live, a price this file already holds from a later look at the shop is kept: the catalogue file never overwrites newer news */
    const newer = !r.live && old && old.price && old.live && old.checkedOn >= checkedOn;
    products.push({ id: r.id, title, shelf, price: newer ? old.price : r.price, checkedOn: newer ? old.checkedOn : checkedOn, onSale: newer ? !!old.onSale : !!(r.was && Number(r.was) > Number(r.price)), url: `${SHOP}/product/${r.id}`, twin: TWINS[r.id] || null, featured: FEATURED.includes(r.id), retired: !!(old && old.retired), live: !!(r.live || newer), img: null, _src: r.img }); }
  if (noShelf.length) die('no shelf rule matches these titles (add one to SHELF_RULES):\n  ' + noShelf.join('\n  '));
  /* a product that left the catalogue but is still in merch.json stays, retired, so its twin and its claim keep working */
  for (const old of prevById.values()) if (!products.some(p => p.id === old.id)) { console.warn(`NOTE: ${old.id} ${old.title} is no longer in the catalogue: kept as retired.`); products.push({ ...old, retired: true, _src: null }); }
  for (const id of Object.keys(TWINS)) if (!products.some(p => p.id === id)) die('twin product ' + id + ' (' + TWINS[id] + ') is missing from the catalogue');
  for (const id of FEATURED) if (!products.some(p => p.id === id)) die('featured product ' + id + ' is missing from the catalogue');
  const counts = {}; for (const p of products) counts[p.shelf] = (counts[p.shelf] || 0) + 1;
  for (const k of Object.keys(SHELF_COUNTS)) if (counts[k] !== SHELF_COUNTS[k]) console.warn(`NOTE: shelf "${k}" has ${counts[k] || 0} products; the spec's sort had ${SHELF_COUNTS[k]}.`);

  /* ---- thumbnails ---- */
  const file = p => path.join(IMG_DIR, p.id + '.jpg'), rel = p => 'img/merch/' + p.id + '.jpg';
  if (CHECK) {
    const problems = []; if (!prev) problems.push('merch.json is missing');
    for (const p of products) { const o = prevById.get(p.id); if (!o) { problems.push(p.id + ' is not in merch.json'); continue; } if (o.title !== p.title || o.twin !== p.twin || o.shelf !== p.shelf || o.featured !== p.featured || o.url !== p.url) problems.push(p.id + ' differs from the catalogue'); else if (o.price !== p.price && !(o.live && o.checkedOn >= checkedOn)) problems.push(p.id + ' has another price than the catalogue'); if (!o.retired && !fs.existsSync(file(p))) problems.push(p.id + ' has no thumbnail'); }
    if (problems.length) die('out of step:\n  ' + problems.join('\n  ')); console.log(`OK: merch.json and ${products.length} thumbnails match the catalogue (prices checked on ${prev.checkedOn}).`); return;
  }
  let made = 0, kept = 0; const failed = [];
  if (!has('--no-images')) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
    const todo = products.filter(p => p._src && !p.retired && (has('--force-images') || !fs.existsSync(file(p)))); kept = products.length - todo.length;
    if (todo.length) {
      const rz = await makeResizer(); if (!rz) die('cannot make thumbnails: install sharp (npm i -g sharp) or run with playwright available (NODE_PATH=$(npm root -g)). Or pass --no-images.');
      console.log(`Fetching ${todo.length} thumbnails (resized with ${rz.name}) ...`);
      try { await pool(todo, 3, async p => { try { const u = new URL(p._src); if (u.protocol !== 'https:') throw new Error('not https'); const r = await get(u.href, 'buffer'); if (r.gone) throw new Error('picture is gone'); const out = await rz.resize(r.body, r.type.split(';')[0]); if (!out || out.length < 400) throw new Error('empty picture'); fs.writeFileSync(file(p), out); made++; } catch (e) { failed.push(`${p.id} ${p.title}: ${e.message}`); } }); }
      finally { await rz.close(); }
    }
  }
  let bytes = 0; for (const p of products) { if (fs.existsSync(file(p))) { p.img = rel(p); bytes += fs.statSync(file(p)).size; } delete p._src; }
  /* tidy: a thumbnail whose product is no longer listed */
  if (fs.existsSync(IMG_DIR)) for (const f of fs.readdirSync(IMG_DIR)) if (/^\d+\.jpg$/.test(f) && !products.some(p => p.id + '.jpg' === f)) { fs.unlinkSync(path.join(IMG_DIR, f)); console.log('Removed old thumbnail ' + f); }

  const doc = {
    about: 'Made by tools/sync-merch.js. Do not edit prices here: run the script. By hand: "retired" on a product, "notice", shop.tracking.',
    generatedOn: today(), checkedOn,
    shop: { name: 'KC Beyond Limits', home: SHOP, tracking: (prev && prev.shop && prev.shop.tracking) || 'unknown' },
    notice: (prev && prev.notice) || null,
    products
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${products.length} products (${products.filter(p => p.twin).length} with a twin, ${products.filter(p => p.featured).length} featured, ${products.filter(p => p.onSale).length} at a sale price, ${products.filter(p => p.retired).length} retired), prices checked on ${checkedOn}.`);
  console.log(`Thumbnails: ${made} fetched, ${kept} already there, ${(bytes / 1024).toFixed(0)} KB in all.`);
  if (failed.length) { console.error('\nThese thumbnails could NOT be fetched; the game draws a plain tile for them:\n  ' + failed.join('\n  ')); process.exitCode = 2; }
})().catch(e => die(e && e.stack || String(e)));
