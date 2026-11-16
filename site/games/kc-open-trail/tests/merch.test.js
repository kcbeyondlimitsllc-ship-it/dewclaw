/* KC: Open Trail merch test (Playwright + Chromium): js/merch.js, merch.json, img/merch/*, css/merch.css, tools/sync-merch.js.
     NODE_PATH=$(npm root -g) node tests/merch.test.js [screenshot-folder]
   Run from site/games/kc-open-trail. Serves this folder on its own port. Every request the browser makes is watched:
   anything that leaves the origin is recorded, and the shop's address is answered by a stand-in page from this test,
   so nothing here ever reaches the real shop. It proves:
     1. the shipped files: 54 products, 8 featured, 14 twins, local thumbnails only, no iframe, no tracking parameter
     2. the shelves stand in the world and their prompts open the KC Gear tab
     3. the children's side shows bones only: no real-money price, no product picture, no outside request
     4. a twin can be bought with bones, the charge is exact and KC is wearing it (also after a reload)
     5. the real products stay shut until the real-money switch is on and the grown-up gate is passed
     6. the link opens only after "You are leaving the game", and the address is exactly https://kcbeyondlimits.com/product/<id>
        in a new tab with rel="noopener noreferrer"
     7. the claim gives the twin and the Real Gear tag once per twin, never bones or gems, and does not keep the order number
     8. old prices drop the number, a retired product loses its card and link, a broken merch.json leaves the twins working
     9. it fits a phone both ways up (390 x 844 and 844 x 390): 44 px targets, no sideways scroll
   Exits non-zero if any check fails. */
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
let PORT = +(process.env.PORT || 0), BASE = '';
const OUT = path.resolve(process.argv[2] && process.argv[2] !== '.' ? process.argv[2] : path.join(require('os').tmpdir(), 'kc-open-trail-merch-shots'));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
let failed = 0, passed = 0;
const ok = (name, cond, extra = '') => { if (cond) passed++; else failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra !== '' ? '  [' + extra + ']' : '')); return !!cond; };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SHOP = 'https://kcbeyondlimits.com';
const SPEC_TWINS = { '34460071': ['hat:trucker', 600], '34460072': ['hat:mountain-paw', 600], '34460075': ['hat:flatbill', 600], '34460076': ['hat:compass-beanie', 600], '34460077': ['hat:pom-beanie', 600], '34395138': ['collar:river', 400], '34395135': ['tag:moon-compass', 400],
  '34395136': ['harness:explore', 500], '34399813': ['harness:camp-kc', 500], '34341309': ['bandana:river-logo', 400], '34395112': ['skin:van:adventure-club', 500], '34399759': ['skin:skateboard:squatch', 500], '34395132': ['decor:river-bed', 800], '34399669': ['decor:camp-mug', 300] };
const SPEC_FEATURED = ['34460072', '34460076', '34341309', '34395138', '34399813', '34399669', '34399759', '34395132'];

/* one browser context. `merchJson`: undefined = the shipped file, a function = the shipped file changed by it, null = a 404. */
async function open(browser, opts = {}, merchJson) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', ...opts });
  const off = [], popups = [];
  await ctx.route('**/*', route => { const u = route.request().url();
    if (u.startsWith(BASE)) { if (merchJson !== undefined && /\/merch\.json(\?|$)/.test(u)) { if (merchJson === null) return route.fulfill({ status: 404, body: 'gone' }); const j = JSON.parse(read('merch.json')); merchJson(j); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); } return route.continue(); }
    if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return route.continue();
    off.push({ url: u, frame: (() => { try { return route.request().frame().page() === page ? 'game' : 'new tab'; } catch (e) { return 'new tab'; } })(),   /* a brand-new tab has no frame yet */ nav: route.request().isNavigationRequest(), referer: route.request().headers().referer || '' });
    if (u.startsWith(SHOP)) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stand-in shop page</title><p>stand-in</p>' });
    return route.abort(); });
  const page = await ctx.newPage(), errors = [], requests = [];
  ctx.on('page', p => { if (p !== page) popups.push(p); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  /* note every link the game clicks open */
  await page.addInitScript(() => { window.__clicks = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { window.__clicks.push({ href: this.href, target: this.target, rel: this.rel }); return c.call(this); }; const o = window.open; window.open = function (...a) { window.__clicks.push({ open: String(a[0]) }); return o.apply(this, a); }; });
  const boot = async () => { await page.goto(BASE + '?debug=1&nosw=1'); await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 }); await page.evaluate(async () => { __ot.start(); __ot.step(5); await __ot.game.modules.merch.ready; }); };
  await boot();
  return { ctx, page, errors, requests, off, popups, boot };
}
const modal = page => page.evaluate(() => __ot.state().modal);
const waitModal = (page, id) => page.waitForFunction(want => __ot.state().modal === want, id, { timeout: 15000 });
const action = (page, label) => page.click(`#modalActions button:text-is("${label}")`);
/* the grown-up gate: read the sum off the screen and tap it in on the number pad */
async function gate(page, right = true) {
  await waitModal(page, 'gate');
  const [a, b] = (await page.textContent('.gateq b')).match(/\d+/g).map(Number), ans = String(right ? a * b : a * b + 1);
  for (const ch of ans) await page.click(`.keypad [data-key="${ch}"]`);
  await page.click('.keypad [data-key="ok"]');
}
/* nothing wider than the screen, and every button, field and tab at least 44 px tall */
const fit = page => page.evaluate(() => { const b = document.getElementById('modalBody'), small = [];
  const coreShop = document.getElementById('modal').classList.contains('shop');   /* the Shop screen's own close button belongs to the core (40 px on a short landscape phone; reported to the integrator) */
  for (const e of document.querySelectorAll('#modal button, #modal input, #modal select, #modal [role=button]')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; if (coreShop && e.id === 'modalClose') continue; if (e.getAttribute('role') === 'button' && !/^(BUTTON|INPUT|SELECT)$/.test(e.tagName)) { if (r.height < 44 || r.width < 44) small.push('art ' + Math.round(r.width) + 'x' + Math.round(r.height)); continue; } if (r.height < 43.5) small.push((e.textContent || e.id || e.tagName).trim().slice(0, 24) + ' ' + Math.round(r.height)); }
  const card = document.querySelector('#modal .card').getBoundingClientRect(); return { sideways: b.scrollWidth - b.clientWidth, pageSideways: document.documentElement.scrollWidth - innerWidth, small, cardInside: card.left >= -0.5 && card.right <= innerWidth + 0.5 && card.top >= -0.5 && card.bottom <= innerHeight + 0.5 }; });
const fits = async (name, page) => { const f = await fit(page); ok(`${name}: fits the screen, no sideways scroll, every target at least 44 px`, f.sideways <= 1 && f.pageSideways <= 1 && f.cardInside && !f.small.length, JSON.stringify(f)); };

(async () => {
  await new Promise(r => server.listen(PORT, r)); PORT = server.address().port; BASE = `http://localhost:${PORT}/`;
  const browser = await chromium.launch();
  console.log(`merch test on ${BASE}, screenshots in ${OUT}`);

  /* ---------- 1. the shipped files ---------- */
  const src = read('js/merch.js'), css = read('css/merch.css'), tool = read('tools/sync-merch.js'), M = JSON.parse(read('merch.json')), code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('merch.js: no iframe, no window.open, no XHR / WebSocket / beacon', !/<iframe|createElement\(\s*['"]iframe|window\.open|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(code));
  ok('merch.js: its only request is for the game\'s own merch.json', (code.match(/\bfetch\s*\(/g) || []).length === 1 && /fetch\(asset\('merch\.json'\)\)/.test(code));
  ok('merch.js and merch.css: no tracking parameter, no outside address except the shop\'s home', !/utm_|fbclid|gclid|[?&]ref=/.test(src + css) && (src + css).match(/https?:\/\/[^\s'"`)]+/g).every(u => u.startsWith(SHOP)), ((src + css).match(/https?:\/\/[^\s'"`)]+/g) || []).filter(u => !u.startsWith(SHOP)).join(' '));
  ok('merch.js, merch.css, merch.json, sync-merch.js: the forbidden film name is nowhere', !new RegExp(['hallo', 'ween', 'town'].join(''), 'i').test(src + css + tool + JSON.stringify(M)));
  ok('merch.css: nothing is loaded from outside (no @import, no url())', !/@import|url\(/.test(css));
  eq('merch.json: 54 products, 8 featured, 14 with a twin', [M.products.length, M.products.filter(p => p.featured).length, M.products.filter(p => p.twin).length], [54, 8, 14]);
  eq('merch.json: the featured eight are the spec\'s', M.products.filter(p => p.featured).map(p => p.id).sort(), SPEC_FEATURED.slice().sort());
  eq('merch.json: every twin row is the spec\'s', Object.fromEntries(M.products.filter(p => p.twin).map(p => [p.id, p.twin])), Object.fromEntries(Object.entries(SPEC_TWINS).map(([k, v]) => [k, v[0]])));
  eq('merch.json: shelves are 18 hats and clothes, 6 dog gear, 6 mugs, 12 small things, 12 winter', ['tailor', 'pets', 'cafe', 'market', 'winter'].map(s => M.products.filter(p => p.shelf === s).length), [18, 6, 6, 12, 12]);
  ok('merch.json: every row has id, title, shelf, price, checkedOn, onSale, url, twin, retired', M.products.every(p => /^\d+$/.test(p.id) && p.title && p.shelf && /^\d+\.\d\d$/.test(p.price) && /^\d{4}-\d\d-\d\d$/.test(p.checkedOn) && typeof p.onSale === 'boolean' && 'twin' in p && typeof p.retired === 'boolean'));
  ok('merch.json: every address is exactly the shop\'s product page, with nothing added', M.products.every(p => p.url === `${SHOP}/product/${p.id}`));
  ok('merch.json: one product is not at a sale price (the pom-pom beanie); no "was" price is shipped', M.products.filter(p => !p.onSale).map(p => p.id).join() === '34460077' && !/"was"/.test(JSON.stringify(M)));
  const imgs = M.products.map(p => ({ p, f: path.join(ROOT, p.img || 'missing') })), sizes = imgs.filter(i => fs.existsSync(i.f)).map(i => fs.statSync(i.f).size);
  ok('thumbnails: every product has its own local picture, and merch.json points at nothing outside the game', imgs.every(i => /^img\/merch\/\d+\.jpg$/.test(i.p.img || '') && fs.existsSync(i.f)) && !/https?:\/\/(?!kcbeyondlimits\.com)/.test(JSON.stringify(M)), imgs.filter(i => !fs.existsSync(i.f)).map(i => i.p.id).join(' '));
  ok('thumbnails: all small JPEGs (each under 30 KB, under 600 KB together)', sizes.length === 54 && sizes.every(s => s > 500 && s < 30000) && sizes.reduce((a, b) => a + b, 0) < 600000 && imgs.every(i => fs.readFileSync(i.f).subarray(0, 3).toString('hex') === 'ffd8ff'), `total ${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB, largest ${(Math.max(...sizes) / 1024).toFixed(1)} KB`);
  ok('sw.js does not precache the thumbnails', !/img\/merch/.test(read('sw.js')));
  let checkOut = ''; try { checkOut = execFileSync(process.execPath, [path.join(ROOT, 'tools/sync-merch.js'), '--check'], { encoding: 'utf8' }); } catch (e) { checkOut = 'exit ' + e.status + ' ' + (e.stderr || ''); }
  ok('tools/sync-merch.js --check: merch.json and the thumbnails match the catalogue file', /^OK:/.test(checkOut), checkOut.trim().slice(0, 200));

  /* ---------- 2. boot on a phone: the API, the twins, the shelves ---------- */
  const A = await open(browser), page = A.page;
  const info = await page.evaluate(() => { const g = __ot.game, m = g.modules.merch; return { fns: ['open', 'buyTwin', 'openReal', 'openProduct', 'openClaim', 'claimed', 'isClaimed', 'product', 'products', 'twin', 'twinFor', 'url', 'priceLine', 'winterOpen', 'places'].filter(k => typeof m[k] !== 'function'),
    loaded: m.loaded, n: m.products().length, twins: m.twins.map(t => [t.product, t.id, t.bones]), defined: m.twins.filter(t => t.slot !== 'decor').every(t => { const d = g.cosmetics.get(t.id); return d && d.slot === t.slot; }), decorKnown: m.twins.filter(t => t.slot === 'decor').every(t => g.modules.economy.item && g.modules.economy.item(t.id)), tag: !!g.cosmetics.get('tag:real-gear'),
    hats: ['merch-trucker', 'merch-flatbill', 'merch-pom', 'cap', 'beanie'].every(h => typeof g.kc.hats[h] === 'function'), tab: g.shop.tabs.map(t => t.id || t), spending: g.grownUp.spending, show: g.grownUp.showSwitch, owned: m.twins.filter(t => g.economy.owns(t.id)).length, url: m.url('34460072'), bad: [m.url('34460072?utm_source=x'), m.url('../x'), m.url('')] }; });
  ok('the module returns its API and loaded merch.json (54 products)', !info.fns.length && info.loaded && info.n === 54, JSON.stringify(info.fns));
  eq('the 14 twins and their bones prices are the spec\'s', Object.fromEntries(info.twins.map(t => [t[0], [t[1], t[2]]])), SPEC_TWINS);
  ok('every wearable twin is a defined cosmetic, the two den props are known to the economy, the hats have shapes, the Real Gear tag exists', info.defined && info.decorKnown && info.hats && info.tag);
  ok('a "KC Gear" tab is registered in the Shop', info.tab.includes('merch'), info.tab.join(' '));
  ok('real-money spending starts off, no twin is owned, and the Settings switch is shown', info.spending === false && info.owned === 0 && info.show === true);
  eq('url(id) builds only the exact product address and refuses anything else', [info.url, info.bad], [`${SHOP}/product/34460072`, [null, null, null]]);

  const season = await page.evaluate(() => { const m = __ot.game.modules.merch, d = (y, mo, da) => m.winterOpen(new Date(y, mo - 1, da)); return { now: m.winterOpen(), dates: [d(2026, 10, 31), d(2026, 11, 1), d(2026, 12, 25), d(2027, 1, 5), d(2027, 1, 6), d(2027, 7, 4)] }; });
  eq('the winter shelf is out from 1 November to 5 January only', season.dates, [false, true, true, true, false, false]);
  const places = await page.evaluate(() => { const g = __ot.game, P = g.place, out = [];
    for (const [shelf, list] of Object.entries(g.modules.merch.places())) for (const s of list) { const h = P.get(s.id), f = h.front; __ot.teleport(f.x, f.z, f.yaw); __ot.step(8); const prompt = __ot.state().prompt; __ot.press('interact'); __ot.step(3); const st = __ot.state();
      out.push({ shelf, id: s.id, x: Math.round(s.x), z: Math.round(s.z), prompt, opened: st.modal === 'shop' && g.shop.current === 'merch', clear: P.clear(f.x, f.z, 0.5) }); g.ui.closeAll(); __ot.step(2); }
    return out; });
  console.log('      shelves: ' + places.map(p => `${p.id} (${p.x}, ${p.z})`).join(', '));
  eq('shelves stand at the tailor, the pet supply, the coffee shop and twice at the makers market' + (season.now ? ', plus the winter stall (in season today)' : ' (no winter stall today)'), places.map(p => p.id).sort(), ['merch:shelf:cafe', 'merch:shelf:market', 'merch:shelf:market:2', 'merch:shelf:pets', 'merch:shelf:tailor', ...(season.now ? ['merch:shelf:winter'] : [])].sort());
  ok('KC can stand in front of every shelf, each shows its own prompt, and using it opens the KC Gear tab', places.every(p => p.clear && /^Look at the /.test(p.prompt || '') && p.opened), JSON.stringify(places.filter(p => !(p.clear && /^Look at the /.test(p.prompt || '') && p.opened))));
  await page.evaluate(() => { const s = __ot.game.place.get('merch:shelf:tailor'); __ot.teleport(s.front.x + 2.2, s.front.z + 0.6, s.front.yaw); __ot.setTime(12); __ot.step(20); });
  await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, '01-shelf-at-the-tailor.png') });

  /* ---------- 3. the children's side: bones only ---------- */
  await page.evaluate(() => __ot.game.modules.merch.open('tailor')); await waitModal(page, 'shop');
  const kid = await page.evaluate(() => { const b = document.getElementById('modalBody'), cards = [...b.querySelectorAll('.item[data-item]')]; return { cards: cards.map(c => c.dataset.item), text: b.innerText, imgs: b.querySelectorAll('img').length, links: b.querySelectorAll('a, iframe').length, reals: b.querySelectorAll('.mreal').length,
    prices: cards.map(c => +((c.querySelector('.pc.bones b') || {}).textContent || 0)), heads: [...b.querySelectorAll('.sech')].map(h => h.dataset.shelf).filter(Boolean), btns: [...b.querySelectorAll('.mgrown button')].map(x => x.textContent) }; });
  eq('the tab lists the 14 twins, each priced in bones', [kid.cards.length, kid.prices.slice().sort((a, b) => a - b)], [14, Object.values(SPEC_TWINS).map(v => v[1]).sort((a, b) => a - b)]);
  ok('the children\'s side shows no real-money price, no product picture, no link and no real product', !/\$\s?\d/.test(kid.text) && kid.imgs === 0 && kid.links === 0 && kid.reals === 0, kid.text.match(/\$\s?\d+/) || '');
  ok('with the switch off it says to ask a grown-up, and offers the claim', /Ask a grown-up to turn on the shop/.test(kid.text) && kid.btns.length === 2 && /claim a twin/i.test(kid.btns[1]), kid.btns.join(' | '));
  await fits('KC Gear tab at 390 x 844', page); await page.screenshot({ path: path.join(OUT, '02-kc-gear-tab-390.png') });
  ok('browsing the shelves and the tab asked for nothing outside the game', A.off.length === 0 && A.requests.every(u => u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')), A.off.map(o => o.url).join(' '));

  /* ---------- 4. buy a twin with bones; KC wears it ---------- */
  const card = id => `#modalBody .item[data-item="${id}"]`;
  await page.click(card('hat:trucker') + ' .side button'); await waitModal(page, 'spend');
  ok('with no bones the screen says "Not enough yet" and offers no way to pay', (await page.textContent('#modalTitle')) === 'Not enough yet' && (await page.$$eval('#modalActions button', b => b.map(x => x.textContent))).join() === 'OK' && !/\$/.test(await page.innerText('#modalBody')));
  await action(page, 'OK'); await waitModal(page, 'shop');
  await page.evaluate(() => { __ot.give({ bones: 1000 }); __ot.game.shop.refresh(); });
  const before = await page.evaluate(() => ({ ...__ot.game.state.wallet }));
  await page.click(card('hat:trucker') + ' .art'); const prev = await page.evaluate(() => ({ worn: __ot.game.kc.cosmetics.hat, saved: __ot.game.cosmetics.equipped('hat'), owns: __ot.game.economy.owns('hat:trucker') }));
  ok('tapping the picture tries the hat on without owning or saving it', prev.worn && prev.worn.type === 'merch-trucker' && !prev.saved && !prev.owns, JSON.stringify(prev));
  await page.click(card('hat:trucker') + ' .side button'); await waitModal(page, 'spend');
  const spendText = await page.innerText('#modalBody');
  ok('the two-step screen shows the price in bones and what will be left', /600/.test(spendText) && /Afterwards KC will have/.test(spendText) && spendText.includes(String(before.bones - 600)), spendText.replace(/\s+/g, ' ').slice(0, 160));
  await page.screenshot({ path: path.join(OUT, '03-buy-a-twin.png') });
  await action(page, 'Not now'); await waitModal(page, 'shop');
  eq('"Not now" charges nothing and grants nothing', await page.evaluate(() => [__ot.game.state.wallet.bones, __ot.game.economy.owns('hat:trucker')]), [before.bones, false]);
  await page.click(card('hat:trucker') + ' .side button'); await waitModal(page, 'spend'); await action(page, 'Yes, get it'); await waitModal(page, 'shop');
  const after = await page.evaluate(() => { const g = __ot.game, hat = g.kc.parts && g.kc.parts.hatAnchor; return { wallet: { ...g.state.wallet }, owns: g.economy.owns('hat:trucker'), equipped: g.cosmetics.equipped('hat'), state: __ot.state().equipped.hat, worn: g.kc.cosmetics.hat, mesh: hat ? hat.children.length : -1, verts: hat && hat.children[0] ? hat.children[0].geometry.attributes.position.count : 0,
    tag: (document.querySelector('#modalBody .item[data-item="hat:trucker"] .tag2') || {}).textContent, btn: document.querySelector('#modalBody .item[data-item="hat:trucker"] .side button').textContent }; });
  eq('the twin costs exactly 600 bones and no gems', [before.bones - after.wallet.bones, before.gems - after.wallet.gems], [600, 0]);
  ok('the twin is owned and KC is wearing it: saved as equipped, and the hat is on her head', after.owns && after.equipped === 'hat:trucker' && after.state === 'hat:trucker' && after.worn && after.worn.type === 'merch-trucker' && (after.mesh === -1 || (after.mesh === 1 && after.verts > 30)), JSON.stringify(after));
  eq('its card now says "Wearing" with a "Take off" button', [after.tag, after.btn], ['Wearing', 'Take off']);
  await page.evaluate(() => __ot.game.ui.closeAll()); await page.evaluate(() => { __ot.setCam && __ot.setCam(Math.PI * 0.85, 0.25, 4.2); __ot.step(10); }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, '04-kc-wearing-the-trucker-cap.png') });
  /* every other wearable twin goes on, and the den props are granted (not worn) */
  const all = await page.evaluate(async () => { const g = __ot.game, m = g.modules.merch, out = []; __ot.give({ bones: 8000 });
    for (const t of m.twins) { if (g.economy.owns(t.id)) continue; const b0 = g.state.wallet.bones, pr = m.buyTwin(t.id); await new Promise(r => setTimeout(r, 30)); const yes = [...document.querySelectorAll('#modalActions button')].find(b => b.textContent === 'Yes, get it'); if (yes) yes.click(); const r = await pr;
      out.push({ id: t.id, r, paid: b0 - g.state.wallet.bones, want: t.bones, owns: g.economy.owns(t.id), on: t.slot === 'decor' ? null : g.cosmetics.equipped(t.slot) === t.id }); }
    g.ui.closeAll(); return { out, skin: { van: g.cosmetics.equipped('skin:van'), board: g.cosmetics.equipped('skin:skateboard') }, hat: g.kc.cosmetics.hat, gems: g.state.wallet.gems }; });
  ok('the other 13 twins can each be bought for their exact bones price; wearables go straight on', all.out.length === 13 && all.out.every(o => o.r === true && o.paid === o.want && o.owns && o.on !== false), JSON.stringify(all.out.filter(o => !(o.r === true && o.paid === o.want && o.owns && o.on !== false))));
  eq('the ride paints are on the van and the skateboard, and no gems moved', [all.skin, all.gems], [{ van: 'skin:van:adventure-club', board: 'skin:skateboard:squatch' }, before.gems]);
  await page.evaluate(() => { __ot.game.cosmetics.equip('hat:trucker'); __ot.save(); }); await A.boot();
  eq('after a reload KC still owns and wears the twin', await page.evaluate(() => [__ot.game.economy.owns('hat:trucker'), __ot.game.cosmetics.equipped('hat'), (__ot.game.kc.cosmetics.hat || {}).type]), [true, 'hat:trucker', 'merch-trucker']);

  /* ---------- 5. the real products: switch off, then the gate ---------- */
  const realCards = () => page.evaluate(() => document.querySelectorAll('.mreal').length);
  eq('switch off: openProduct() refuses, no screen opens, no tab opens', [await page.evaluate(() => __ot.game.modules.merch.openProduct('34460072')), await modal(page), A.popups.length], [false, null, 0]);
  await page.evaluate(() => __ot.game.modules.merch.open()); await waitModal(page, 'shop');
  await page.click('.mgrown button:has-text("turn it on and see the real gear")'); await waitModal(page, 'gate');
  ok('the first tap brings the grown-up gate, not the products', (await page.textContent('#modalTitle')) === 'Grown-ups only' && (await realCards()) === 0);
  await gate(page, false); await page.waitForTimeout(150);
  eq('a wrong answer keeps the gate shut: no products, switch still off, nothing opened', [await modal(page), await realCards(), await page.evaluate(() => __ot.game.grownUp.spending), A.popups.length, A.off.length], ['gate', 0, false, 0, 0]);
  await action(page, 'Go back'); await waitModal(page, 'shop');
  eq('"Go back" returns to the bones shop with nothing unlocked', [await realCards(), await page.evaluate(() => __ot.game.grownUp.spending), await page.evaluate(() => __ot.game.modules.merch.debug.unlocked)], [0, false, false]);
  await page.click('.mgrown button:has-text("turn it on and see the real gear")'); await gate(page, true); await waitModal(page, 'merch-real');
  const real = await page.evaluate(() => { const b = document.getElementById('modalBody'), cards = [...b.querySelectorAll('.mreal')]; return { spending: __ot.game.grownUp.spending, n: cards.length, ids: cards.map(c => c.dataset.product), first8: cards.slice(0, 8).map(c => c.dataset.product).sort(),
    prices: cards.map(c => c.querySelector('.mprice').textContent), imgs: cards.map(c => (c.querySelector('img') || {}).src || ''), ship: cards.every(c => /Printed to order\. Shipping is added at checkout\. No returns\./.test(c.textContent)), twins: cards.filter(c => c.querySelector('.mtwin')).length, links: b.querySelectorAll('a, iframe').length, strike: b.querySelectorAll('s, del, strike').length, text: b.innerText }; });
  ok('past the gate: the switch is on and all 54 real products are listed, the featured eight first', real.spending === true && real.n === 54 && new Set(real.ids).size === 54 && JSON.stringify(real.first8) === JSON.stringify(SPEC_FEATURED.slice().sort()), `n ${real.n}`);
  ok('every card shows "from $X, checked on <date>" from merch.json; the one non-sale product does not say "sale"', real.prices.every(t => /^from \$\d+\.\d\d, checked on \d{1,2} [A-Z][a-z]{2} \d{4}( \(a sale price when checked\))?; today's price is on the shop page$/.test(t)) && real.prices.filter(t => !/sale price/.test(t)).length === 1 && M.products.every(p => real.prices[real.ids.indexOf(p.id)].startsWith(`from $${p.price},`)), real.prices[0]);
  ok('every picture is the game\'s own file; no link, no iframe, no struck-through price, no countdown', real.imgs.every(s => s.startsWith(BASE + 'img/merch/')) && real.links === 0 && real.strike === 0 && !/\b(hurry|only \d+ left|ends in|last chance|\d+:\d\d)\b/i.test(real.text));
  ok('every card says printed to order, shipping extra, no returns; 14 cards name their twin', real.ship && real.twins === 14);
  await page.waitForFunction(() => [...document.querySelectorAll('.mreal img')].slice(0, 4).every(i => i.complete && i.naturalWidth === 240), null, { timeout: 15000 }).catch(() => {});
  ok('the thumbnails load from the game folder (240 px)', await page.evaluate(() => [...document.querySelectorAll('.mreal img')].slice(0, 4).every(i => i.complete && i.naturalWidth === 240)));
  await fits('real-gear list at 390 x 844', page); await page.screenshot({ path: path.join(OUT, '05-real-gear-390.png') });
  ok('listing the real products asked for nothing outside the game', A.off.length === 0 && A.requests.every(u => u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')), A.off.map(o => o.url).join(' '));

  /* ---------- 6. the leaving screen and the link ---------- */
  const PID = '34460072', URL1 = `${SHOP}/product/${PID}`;
  await page.click(`.mreal[data-product="${PID}"] button`); await waitModal(page, 'merch-leaving');
  const lv = await page.evaluate(() => ({ title: document.getElementById('modalTitle').textContent, text: document.getElementById('modalBody').innerText, acts: [...document.querySelectorAll('#modalActions button')].map(b => b.textContent), links: document.querySelectorAll('#modal a, #modal iframe').length }));
  ok('the screen is titled "You are leaving the game", names the separate website, and shows the address and the price', lv.title === 'You are leaving the game' && /You are leaving the game for the KC Beyond Limits shop, a separate website\./.test(lv.text) && lv.text.includes('kcbeyondlimits.com/product/' + PID) && /from \$\d+\.\d\d, checked on/.test(lv.text) && /No returns/.test(lv.text) && /sends the shop nothing/.test(lv.text), lv.text.replace(/\s+/g, ' ').slice(0, 200));
  eq('it offers Stay, the shop home page and the product page', lv.acts, ['Stay in the game', 'Shop home page', 'Open the product page']);
  eq('nothing has opened yet', [A.popups.length, A.off.length, await page.evaluate(() => __clicks.length)], [0, 0, 0]);
  await fits('leaving screen at 390 x 844', page); await page.screenshot({ path: path.join(OUT, '06-leaving-the-game-390.png') });
  await action(page, 'Stay in the game'); await waitModal(page, 'merch-real'); await page.waitForTimeout(200);
  eq('"Stay in the game" opens nothing', [A.popups.length, A.off.length], [0, 0]);
  await page.click(`.mreal[data-product="${PID}"] button`); await waitModal(page, 'merch-leaving');
  const [pop] = await Promise.all([A.ctx.waitForEvent('page'), action(page, 'Open the product page')]); await pop.waitForLoadState('domcontentloaded');
  const link = await page.evaluate(() => __clicks.slice()), popInfo = await pop.evaluate(() => ({ opener: window.opener === null, ref: document.referrer, title: document.title }));
  eq('the new tab\'s address is exactly the product page', pop.url(), URL1);
  eq('the link was opened as target="_blank" rel="noopener noreferrer" with that exact address', link, [{ href: URL1, target: '_blank', rel: 'noopener noreferrer' }]);
  ok('the new tab cannot reach the game (no opener) and was told nothing about where it came from (no referrer)', popInfo.opener && popInfo.ref === '' && A.off.every(o => !o.referer), JSON.stringify(popInfo));
  eq('the only request that left the origin is that one page, made by the new tab and not by the game', A.off.map(o => [o.url, o.frame, o.nav]), [[URL1, 'new tab', true]]);
  await pop.close(); await waitModal(page, 'merch-real');
  /* the home-page fallback on the leaving screen */
  await page.click(`.mreal[data-product="34399669"] button`); await waitModal(page, 'merch-leaving');
  const [pop2] = await Promise.all([A.ctx.waitForEvent('page'), action(page, 'Shop home page')]); await pop2.waitForLoadState('domcontentloaded');
  eq('"Shop home page" opens the shop\'s front page and nothing else', [pop2.url(), A.off.length], [SHOP + '/', 2]); await pop2.close();
  /* closing the list locks the grown-up side again */
  await page.evaluate(() => __ot.game.ui.closeAll());
  eq('closing the real-gear list locks it again', await page.evaluate(() => __ot.game.modules.merch.debug.unlocked), false);
  const n0 = A.popups.length; let res = page.evaluate(() => __ot.game.modules.merch.openProduct('34395138')); await waitModal(page, 'gate');
  eq('openProduct() from code meets the gate first: no leaving screen, no tab', [await modal(page), A.popups.length - n0], ['gate', 0]);
  await action(page, 'Go back');
  eq('backing out of the gate opens nothing and resolves false', [await res, A.popups.length - n0, await modal(page)], [false, 0, null]);
  res = page.evaluate(() => __ot.game.modules.merch.openProduct('34395138')); await gate(page, true); await waitModal(page, 'merch-leaving');
  const [pop3] = await Promise.all([A.ctx.waitForEvent('page'), action(page, 'Open the product page')]); await pop3.waitForLoadState('domcontentloaded');
  eq('after the gate and the leaving screen it opens exactly that product page', [pop3.url(), await res], [`${SHOP}/product/34395138`, true]); await pop3.close();
  eq('an unknown or made-up product id opens nothing', [await page.evaluate(() => __ot.game.modules.merch.openProduct('99999999')), await page.evaluate(() => __ot.game.modules.merch.openProduct('34460072/../../x?utm=1')), await modal(page)], [false, false, null]);
  ok('every outside request in the whole run was one of the three link taps', A.off.length === 3 && A.off.every(o => o.frame === 'new tab' && o.nav && o.url.startsWith(SHOP)) && A.requests.every(u => u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')), A.off.map(o => o.url).join(' '));

  /* ---------- 7. the claim ---------- */
  /* a fresh save, so the claim is seen granting */
  await page.evaluate(() => { const g = __ot.game; for (const t of g.modules.merch.twins) { delete g.state.owned[t.id]; } for (const s of ['hat', 'bandana', 'collar', 'tag', 'harness', 'skin:van', 'skin:skateboard']) g.cosmetics.unequip(s); __ot.save(); });
  await page.evaluate(() => __ot.game.modules.merch.open()); await waitModal(page, 'shop');
  await page.click('.mgrown button:has-text("claim a twin")'); await waitModal(page, 'gate');
  ok('the claim is behind the grown-up gate', (await modal(page)) === 'gate' && (await page.$('#merchOrder')) === null);
  await gate(page, true); await waitModal(page, 'merch-claim');
  const cl = await page.evaluate(() => ({ text: document.getElementById('modalBody').innerText, opts: [...document.querySelectorAll('#merchWhat option')].map(o => o.value).filter(Boolean) }));
  ok('the claim screen says plainly that it works on trust, keeps and sends nothing, and gives a twin and a tag only', /works on trust/.test(cl.text) && /cannot check an order number/.test(cl.text) && /does not send it anywhere and does not keep it/.test(cl.text) && /never bones, gems/.test(cl.text) && /once on this device/.test(cl.text));
  eq('all 14 twins can be picked', cl.opts.length, 14);
  await fits('claim screen at 390 x 844', page); await page.screenshot({ path: path.join(OUT, '07-claim-390.png') });
  const w0 = await page.evaluate(() => ({ ...__ot.game.state.wallet }));
  await page.fill('#merchOrder', 'abc'); await page.selectOption('#merchWhat', 'hat:compass-beanie'); await action(page, 'Claim the twin'); await page.waitForTimeout(100);
  eq('a silly order number is refused with a plain message and grants nothing', [await modal(page), /does not look like an order number/.test(await page.textContent('.mmsg')), await page.evaluate(() => __ot.game.economy.owns('hat:compass-beanie') || __ot.game.economy.owns('tag:real-gear'))], ['merch-claim', true, false]);
  const ORDER = 'KC-7731-204486';
  await page.fill('#merchOrder', ORDER); await page.evaluate(() => { document.querySelector('#merchWhat').value = ''; document.querySelector('#merchWhat').dispatchEvent(new Event('change')); }); await action(page, 'Claim the twin'); await page.waitForTimeout(100);
  eq('with nothing picked it asks what was bought', [await modal(page), await page.textContent('.mmsg')], ['merch-claim', 'Pick what was bought.']);
  await page.fill('#merchOrder', ORDER); await page.selectOption('#merchWhat', 'hat:compass-beanie'); await action(page, 'Claim the twin'); await waitModal(page, 'shop');
  const c1 = await page.evaluate(() => { const g = __ot.game; return { twin: g.economy.count('hat:compass-beanie'), tag: g.economy.count('tag:real-gear'), wallet: { ...g.state.wallet }, on: g.cosmetics.equipped('hat'), claimed: g.modules.merch.claimed(), others: g.modules.merch.twins.filter(t => g.economy.owns(t.id)).map(t => t.id), canTag: g.cosmetics.equip('tag:real-gear') && g.cosmetics.equipped('tag') }; });
  ok('the claim grants the twin and the Real Gear tag, puts the hat on, and nothing else', c1.twin === 1 && c1.tag === 1 && c1.on === 'hat:compass-beanie' && c1.others.join() === 'hat:compass-beanie' && c1.canTag === 'tag:real-gear', JSON.stringify(c1));
  eq('a claim gives no bones and no gems', c1.wallet, w0);
  await page.evaluate(() => __ot.save());
  const saved = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n'));
  ok('the order number is not kept anywhere (only the twin id and a date), and nothing was sent', !saved.includes(ORDER) && !saved.includes('7731') && /"claimed":\{"hat:compass-beanie":"\d{4}-\d\d-\d\d"\}/.test(saved) && A.off.length === 3);
  /* once per twin */
  const again = await page.evaluate(() => { const g = __ot.game, m = g.modules.merch, grants = []; const off = g.on('grant', e => grants.push(e)); const r = m.debug.claim('KC-7731-204486', 'hat:compass-beanie'), r2 = m.debug.claim('ZZ-9000-1111', 'hat:compass-beanie'); off(); return { r, r2, grants: grants.length, twin: g.economy.count('hat:compass-beanie'), tag: g.economy.count('tag:real-gear'), n: Object.keys(m.claimed()).length }; });
  ok('the same twin cannot be claimed twice (same or another order number): nothing more is granted', again.r.ok === false && again.r2.ok === false && /already claimed/.test(again.r.reason) && again.grants === 0 && again.twin === 1 && again.tag === 1 && again.n === 1, JSON.stringify(again));
  await page.click('.mgrown button:has-text("claim a twin")'); await gate(page, true); await waitModal(page, 'merch-claim');
  eq('the claimed twin is no longer offered on the claim screen (13 left)', await page.$$eval('#merchWhat option', o => o.map(x => x.value).filter(Boolean).length), 13);
  await page.fill('#merchOrder', 'KC-7731-204487'); await page.selectOption('#merchWhat', 'decor:camp-mug'); await action(page, 'Claim the twin'); await waitModal(page, 'shop');
  const c2 = await page.evaluate(() => { const g = __ot.game; return { mug: g.economy.count('decor:camp-mug'), tag: g.economy.count('tag:real-gear'), wallet: { ...g.state.wallet }, n: Object.keys(g.modules.merch.claimed()).length, tagCard: (document.querySelector('#modalBody .item[data-item="decor:camp-mug"] .tag2') || {}).textContent }; });
  ok('a second, different twin can be claimed; the tag is not given twice; still no bones or gems', c2.mug === 1 && c2.tag === 1 && c2.n === 2 && JSON.stringify(c2.wallet) === JSON.stringify(w0), JSON.stringify(c2));
  /* a twin KC already bought with bones: the claim adds the tag record only, no refund, no second copy */
  const c3 = await page.evaluate(() => { const g = __ot.game, m = g.modules.merch; g.economy.grant({ items: ['collar:river'] }, 'test'); const b = g.state.wallet.bones, r = m.debug.claim('KC-1111-2222', 'collar:river'); return { r: r.ok, had: r.had, n: g.economy.count('collar:river'), bones: g.state.wallet.bones - b }; });
  eq('claiming a twin KC already has adds no second copy and no bones', c3, { r: true, had: true, n: 1, bones: 0 });
  await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.save(); }); await A.boot();
  eq('after a reload the claims are remembered and cannot be repeated', await page.evaluate(() => { const g = __ot.game, m = g.modules.merch; return [Object.keys(m.claimed()).sort(), g.economy.owns('hat:compass-beanie'), g.economy.owns('tag:real-gear'), m.debug.claim('KC-7731-204486', 'hat:compass-beanie').ok]; }), [['collar:river', 'decor:camp-mug', 'hat:compass-beanie'], true, true, false]);
  /* "Start over" wipes the save; a claim is a permanent gift, so it comes back from the module's own record */
  await page.evaluate(() => { __ot.game.wallet.add('bones', 50, 'test'); __ot.game.save.reset(); }); await A.boot();
  const rs = await page.evaluate(() => { const g = __ot.game, m = g.modules.merch; return { bones: g.state.wallet.bones, claimed: Object.keys(m.claimed()).sort(), owns: ['hat:compass-beanie', 'decor:camp-mug', 'collar:river', 'tag:real-gear'].map(i => g.economy.count(i)), others: m.twins.filter(t => g.economy.owns(t.id)).length, again: m.debug.claim('KC-7731-204486', 'hat:compass-beanie').ok, spending: g.grownUp.spending }; });
  ok('after "Start over" the claimed twins and the tag are back (once each), nothing else is, and they still cannot be claimed again', rs.bones < 50 && rs.claimed.length === 3 && rs.owns.join() === '1,1,1,1' && rs.others === 3 && rs.again === false, JSON.stringify(rs));

  /* ---------- 8. old prices, the sale line, a retired product, bad data, a missing file ---------- */
  const lines = await page.evaluate(() => { const m = __ot.game.modules.merch, p = m.product('34460077'), q = m.product('34460072'), t = Date.parse(p.checkedOn + 'T00:00:00Z'), D = 86400000; return [m.priceLine(p, t + 29 * D), m.priceLine(p, t + 31 * D), m.priceLine(q, t + D), m.priceLine({ price: 'x', checkedOn: p.checkedOn }, t), m.priceLine({ price: '5.00', checkedOn: 'never' }, t)]; });
  ok('a price checked within 30 days is shown with its date; an older or unreadable one drops the number', /^from \$19\.70, checked on 16 Nov 2026; today's price/.test(lines[0]) && lines[1] === "See today's price on the shop page" && /\(a sale price when checked\)/.test(lines[2]) && lines[3] === lines[1] && lines[4] === lines[1], JSON.stringify(lines));
  ok('game: no console errors or page errors in the whole main run', A.errors.length === 0, A.errors.slice(0, 3).join(' | '));
  await A.ctx.close();

  const B = await open(browser, {}, j => { j.notice = 'Shop sale, 20 to 27 November'; j.shop.tracking = 'on';
    const bed = j.products.find(p => p.id === '34395132'); bed.retired = true;
    const cap = j.products.find(p => p.id === '34460072'); cap.url = 'https://evil.example/product/34460072?utm_source=game&ref=kc'; cap.img = 'https://evil.example/pixel.gif'; cap.checkedOn = '2026-01-02';
    const mug = j.products.find(p => p.id === '34399669'); mug.img = 'img/merch/00000000.jpg';
    j.products.push({ id: '12345678', title: 'Not ours', shelf: 'nowhere', price: '1.00', checkedOn: '2026-11-16', url: 'https://evil.example/' }, { id: 'abc', title: 'Bad id', shelf: 'cafe', price: '1.00', checkedOn: '2026-11-16' }); });
  await B.page.evaluate(() => __ot.game.modules.merch.open()); await waitModal(B.page, 'shop');
  const rt = await B.page.evaluate(() => { const b = document.getElementById('modalBody'), heads = [...b.querySelectorAll('.sech')].map(h => h.textContent); const i = heads.findIndex(h => /^Retired designs/.test(h)); return { heads, bedCard: !!b.querySelector('.item[data-item="decor:river-bed"]'), price: +b.querySelector('.item[data-item="decor:river-bed"] .pc.bones b').textContent, rare: /rare|limited|last chance/i.test(b.innerText), i }; });
  ok('a retired product\'s twin stays on sale for bones at the same price on a "Retired designs" shelf, never called rare', rt.i >= 0 && rt.bedCard && rt.price === 800 && !rt.rare, JSON.stringify(rt.heads));
  await B.page.click('.mgrown button:has-text("turn it on and see the real gear")'); await gate(B.page, true); await waitModal(B.page, 'merch-real');
  const bad = await B.page.evaluate(() => { const b = document.getElementById('modalBody'), c = id => b.querySelector(`.mreal[data-product="${id}"]`); return { n: b.querySelectorAll('.mreal').length, bed: !!c('34395132'), notOurs: !!c('12345678') || !!c('abc'), capPrice: c('34460072').querySelector('.mprice').textContent, capImg: !!c('34460072').querySelector('img'), capTile: !!c('34460072').querySelector('.mthumb.none'), notice: b.innerText.includes('Shop sale, 20 to 27 November'), timer: /\d+\s*(days?|hours?|h|m|s)\s+left|ends in/i.test(b.innerText), url: __ot.game.modules.merch.product('34460072').url }; });
  ok('the retired product has no card and no link; rows with a bad id or shelf are dropped (53 cards)', bad.n === 53 && !bad.bed && !bad.notOurs, JSON.stringify(bad));
  eq('a retired product cannot be opened from code either', await B.page.evaluate(() => __ot.game.modules.merch.openProduct('34395132')), false);
  ok('a price checked long ago shows no number; the sale line is shown as plain dated text with no timer', bad.capPrice === "See today's price on the shop page" && bad.notice && !bad.timer, bad.capPrice);
  ok('an outside picture address in merch.json is ignored (a plain tile is drawn instead)', !bad.capImg && bad.capTile);
  await B.page.evaluate(() => document.querySelector('.mreal[data-product="34399669"]').scrollIntoView()); await B.page.waitForFunction(() => !!document.querySelector('.mreal[data-product="34399669"] .mthumb.none'), null, { timeout: 10000 }).catch(() => {});
  ok('a missing local picture falls back to a plain tile', await B.page.evaluate(() => !!document.querySelector('.mreal[data-product="34399669"] .mthumb.none')));
  await B.page.click('.mreal[data-product="34460072"] button'); await waitModal(B.page, 'merch-leaving');
  ok('the leaving screen passes on that the shop uses tracking when merch.json says so', /uses tracking and cookies of its own/.test(await B.page.innerText('#modalBody')));
  const [pb] = await Promise.all([B.ctx.waitForEvent('page'), action(B.page, 'Open the product page')]); await pb.waitForLoadState('domcontentloaded');
  eq('a tampered address in merch.json is ignored: the link is still exactly the shop\'s product page', [pb.url(), bad.url, B.off.map(o => o.url)], [`${SHOP}/product/34460072`, `${SHOP}/product/34460072`, [`${SHOP}/product/34460072`]]); await pb.close();
  ok('bad-data run: nothing was asked of any other site, and no page errors', B.requests.every(u => u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) && !B.errors.some(e => /pageerror/.test(e)), B.errors.slice(0, 2).join(' | '));
  await B.ctx.close();

  const Cx = await open(browser, {}, null);
  const miss = await Cx.page.evaluate(async () => { const g = __ot.game, m = g.modules.merch; __ot.give({ bones: 700 }); const pr = m.buyTwin('hat:pom-beanie'); await new Promise(r => setTimeout(r, 30)); [...document.querySelectorAll('#modalActions button')].find(b => b.textContent === 'Yes, get it').click(); const bought = await pr; g.ui.closeAll();
    return { loaded: m.loaded, err: !!m.loadError, n: m.products().length, bought, on: g.cosmetics.equipped('hat'), claim: m.debug.claim('KC-5555-0001', 'hat:flatbill').ok, shelves: Object.keys(m.places()).length, open: await m.openProduct('34460072') }; });
  ok('with merch.json missing (first run offline) the twins, the shelves and the claim still work, and no link can open', !miss.loaded && miss.err && miss.n === 0 && miss.bought === true && miss.on === 'hat:pom-beanie' && miss.claim === true && miss.shelves >= 4 && miss.open === false && Cx.popups.length === 0, JSON.stringify(miss));
  await Cx.page.evaluate(() => __ot.game.modules.merch.open()); await waitModal(Cx.page, 'shop'); await Cx.page.click('.mgrown button:has-text("see the real gear")'); await gate(Cx.page, true); await waitModal(Cx.page, 'merch-real');
  ok('the real-gear list then says it could not be loaded and offers only the shop\'s home page', /could not be loaded/.test(await Cx.page.innerText('#modalBody')) && (await Cx.page.$$eval('.mreal', c => c.length)) === 0 && (await Cx.page.$$eval('#modalBody button', b => b.map(x => x.textContent))).join() === 'Go to the shop home page');
  ok('missing-file run: no outside request, no page errors', Cx.off.length === 0 && !Cx.errors.some(e => /pageerror/.test(e)), Cx.errors.slice(0, 2).join(' | '));
  await Cx.ctx.close();

  /* ---------- 9. landscape phone ---------- */
  const L = await open(browser, { viewport: { width: 844, height: 390 } });
  await L.page.evaluate(() => { __ot.give({ bones: 600 }); __ot.game.modules.merch.open('pets'); }); await waitModal(L.page, 'shop');
  await fits('KC Gear tab at 844 x 390', L.page); await L.page.screenshot({ path: path.join(OUT, '08-kc-gear-tab-844.png') });
  ok('opening from the pet shelf scrolls to the dog gear', await L.page.evaluate(() => { const h = document.querySelector('#modalBody .sech[data-shelf="pets"]'), b = document.getElementById('modalBody').getBoundingClientRect(), r = h.getBoundingClientRect(); return r.top >= b.top - 60 && r.top < b.bottom; }));
  await L.page.click('.mgrown button:has-text("turn it on and see the real gear")'); await gate(L.page, true); await waitModal(L.page, 'merch-real');
  eq('opened from a shelf, the real list starts with that shelf', await L.page.evaluate(() => document.querySelector('#modalBody .sech').dataset.shelf), 'pets');
  await fits('real-gear list at 844 x 390', L.page); await L.page.screenshot({ path: path.join(OUT, '09-real-gear-844.png') });
  await L.page.click('.mreal button'); await waitModal(L.page, 'merch-leaving'); await fits('leaving screen at 844 x 390', L.page); await L.page.screenshot({ path: path.join(OUT, '10-leaving-844.png') });
  await action(L.page, 'Stay in the game'); await waitModal(L.page, 'merch-real'); await L.page.click('#modalBody button:has-text("Claim a twin from a real order")'); await waitModal(L.page, 'merch-claim');
  ok('from inside the unlocked list the claim opens without a second gate', (await modal(L.page)) === 'merch-claim'); await fits('claim screen at 844 x 390', L.page); await L.page.screenshot({ path: path.join(OUT, '11-claim-844.png') });
  ok('landscape run: no outside request, no console errors', L.off.length === 0 && L.errors.length === 0, L.errors.slice(0, 2).join(' | '));
  await L.ctx.close();

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
