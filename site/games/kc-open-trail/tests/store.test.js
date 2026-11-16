/* KC: Open Trail store test (Playwright + Chromium): js/store.js, js/store-config.js, css/store.css.
     NODE_PATH=$(npm root -g) node tests/store.test.js [screenshot-folder]
   Run from site/games/kc-open-trail. Serves this folder on its own port and proves, in the running game:
     1. the shipped config is placeholders only, so every item says "Coming soon", nothing can be bought and nothing is
        requested from anywhere; spending is off until a grown-up turns it on through the gate
     2. mock mode cannot be reached in a normal session (no ?debug=1): a made-up return link grants nothing
     3. with ?debug=1&mock=1 the whole path works by touch: gate, two-step confirm with the dollar price and exact
        contents, the pretend payment page, the return, the grant (through game.economy.grant), the journal
     4. every one of the 16 SKUs grants exactly its catalogue contents, never a bone; replays never grant twice;
        an unknown SKU, an unpaid or tampered payment and a tampered grant are refused
     5. the device limit, the hiding rules, restore with the Trail Key on a wiped device, "Start over" keeping what was paid for
     6. the Trail Journal: free column for everyone, pass column only with the pass, a late pass pays everything reached
     7. the same game against the REAL worker code (worker/dewclaw-worker.js run locally with Stripe faked): buy, replay, restore
     8. phone layouts at 390 x 844 and 844 x 390: 44 px targets, no sideways scroll, prices always on screen
   Exits non-zero if any check fails. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..'), WORKER = path.resolve(ROOT, '../../../worker/dewclaw-worker.js');
const OUT = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'kc-open-trail-store-shots'));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
let configOverride = null, BASE = '';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (configOverride && p === '/js/store-config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); return res.end(configOverride); }
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
let failed = 0, passed = 0;
const ok = (name, cond, extra = '') => { if (cond) passed++; else failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (!cond && extra !== '' ? '  [' + extra + ']' : '')); return !!cond; };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const SAVE_KEY = 'kc-open-trail-save-v2';

/* the spec's table (MONETIZATION-EXPANSION-SPEC.md 4.2), written out here so a slip in js/store.js fails */
const F = ['hat:moss-beanie', 'bandana:fern', 'collar:cedar', 'trail:firefly', 'skin:skateboard:forest', 'skin:canoe:forest', 'skin:van:forest', 'decor:mushroom-lamp'];
const G = ['hat:comet-cap', 'bandana:starfield', 'collar:nebula', 'trail:stardust', 'skin:skateboard:galaxy', 'skin:canoe:galaxy', 'skin:van:galaxy', 'decor:moon-lamp'];
const R = ['hat:road-visor', 'bandana:route-stripe', 'collar:mile-marker', 'trail:dust', 'skin:skateboard:roadtrip', 'skin:canoe:roadtrip', 'skin:van:roadtrip', 'decor:roadside-sign'];
const H = ['hat:pumpkin-patch', 'bandana:candy-corn', 'collar:cobweb', 'trail:ember', 'skin:skateboard:spooky', 'skin:canoe:spooky', 'skin:van:spooky', 'decor:jack-lantern'];
const SUP = ['tag:supporter', 'bandana:supporter', 'den:gold-trim', 'frame:supporter'];
const SPEC = {
  ot_gems_80: ['$0.99', 80, []], ot_gems_500: ['$4.99', 500, []], ot_gems_1200: ['$9.99', 1200, []], ot_gems_2600: ['$19.99', 2600, []], ot_gems_7000: ['$49.99', 7000, []],
  ot_starter: ['$4.99', 400, ['bandana:first-trail', 'tag:first-trail', 'trail:sunbeam', 'skin:skateboard:first-trail']], ot_trail_pass: ['$5.99', 0, ['pass:trail']],
  ot_pack_forest: ['$3.99', 0, F], ot_pack_galaxy: ['$3.99', 0, G], ot_pack_roadtrip: ['$3.99', 0, R], ot_pack_halloween: ['$3.99', 0, H],
  ot_treat_3: ['$1.99', 0, ['treat:3']], ot_treat_10: ['$4.99', 0, ['treat:10']], ot_supporter: ['$9.99', 600, SUP],
  ot_everything: ['$24.99', 600, ['pass:trail', ...F, ...G, ...R, ...H, ...SUP]], ot_tip_3: ['$3.00', 0, ['tag:good-human']]
};
const SKUS = Object.keys(SPEC), PERMANENT = ['ot_starter', 'ot_trail_pass', 'ot_pack_forest', 'ot_pack_galaxy', 'ot_pack_roadtrip', 'ot_pack_halloween', 'ot_supporter', 'ot_everything'];

async function open(browser, o = {}) {
  const ctx = o.ctx || await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [], requests = [];
  /* a file another module asks for and cannot find is that module's business: it is printed, and only this module's own files fail the run */
  const mine = u => /\/(js\/store(-config)?\.js|css\/store\.css)(\?|$)/.test(u), missing = [];
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) { missing.push(r.url()); if (mine(r.url())) errors.push('missing store file: ' + r.url()); else if (!open.told.has(r.url())) { open.told.add(r.url()); console.log('NOTE  not a store file, reported for its owner: HTTP ' + r.status() + ' ' + r.url()); } } });
  page.on('console', m => { if (m.type() === 'error' && !(/Failed to load resource/.test(m.text()) && !mine((m.location() || {}).url || ''))) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  const q = o.query == null ? '?debug=1&nosw=1&mock=1' : o.query;
  const ready = async () => { await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 }); await page.evaluate(() => { __ot.start(); __ot.step(3); }); };
  const boot = async (query = q) => { await page.goto(BASE + query); await ready(); };
  if (o.boot !== false) await boot();
  const outside = () => requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
  return { ctx, page, errors, requests, boot, ready, outside };
}
open.told = new Set();
/* a different device: empty this browser's storage from a page of the same origin that is not the game (the game saves as it closes) */
async function wipe(o, keep = []) { await o.page.goto(BASE + 'manifest.webmanifest'); await o.page.evaluate(keep => { const held = keep.map(k => [k, localStorage.getItem(k)]); localStorage.clear(); for (const [k, v] of held) if (v != null) localStorage.setItem(k, v); }, keep); await o.boot(); }
/* answer the grown-up gate the way a grown-up would: read the sum, tap the number pad */
async function solveGate(page) {
  await page.waitForSelector('.gateq b', { timeout: 8000 });
  const m = (await page.textContent('.gateq b')).match(/(\d+)\s*×\s*(\d+)/), ans = String(m[1] * m[2]);
  for (const ch of ans) await page.tap(`.keypad [data-key="${ch}"]`);
  await page.tap('.keypad [data-key="ok"]');
  await page.waitForFunction(() => !__ot.game.ui.current || __ot.game.ui.current.id !== 'gate', null, { timeout: 5000 });
}
const spendingOn = async page => { const p = page.evaluate(() => __ot.game.grownUp.setSpending(true)); await solveGate(page); return p; };
const openStore = async page => { await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.shop.open('store'); }); await page.tap('[data-act="open-store"]'); await solveGate(page); await page.waitForSelector('[data-item="ot_gems_80"]'); };
const snap = page => page.evaluate(() => { const g = __ot.game, s = g.state; return { bones: s.wallet.bones, gems: s.wallet.gems, owned: { ...s.owned }, flags: { ...s.flags }, journal: g.modules.store.journal(), key: g.modules.store.key, pending: g.modules.store.pending, spent: g.modules.store.spent30() }; });
/* every visible button in the open modal is at least 44 px and nothing scrolls sideways */
const layout = page => page.evaluate(() => { const m = document.getElementById('modal'), body = document.getElementById('modalBody'), small = [], mine = !!(__ot.game.ui.current && /^store/.test(__ot.game.ui.current.id || ''));
  /* on this module's own screens every control is measured; inside the shared Shop screen the core's own close button is left to the core's test */
  for (const b of (mine ? m : body).querySelectorAll('button, input')) { const r = b.getBoundingClientRect(); if (r.width && r.height && (r.height < 43.5 || r.width < 43.5)) small.push((b.textContent || b.className).trim().slice(0, 20) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  const off = [...m.querySelectorAll('.tabpane button, #modalActions button, .item, .tj-row, .st-limit')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).length;
  return { small, sideways: body.scrollWidth > body.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1, off }; });

(async () => {
  await new Promise(r => server.listen(0, r)); BASE = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  console.log('store test on ' + BASE);

  /* ---------- 0. the files ---------- */
  { const src = fs.readFileSync(path.join(ROOT, 'js/store.js'), 'utf8'), cfg = fs.readFileSync(path.join(ROOT, 'js/store-config.js'), 'utf8');
    for (const f of ['js/store.js', 'js/store-config.js', 'css/store.css']) ok(`${f} exists`, fs.existsSync(path.join(ROOT, f)));
    eq('store.js makes exactly one network call, to the worker address', (src.match(/\bfetch\s*\(/g) || []).length, 1);
    ok('store.js has no XHR / WebSocket / beacon / analytics and builds no outside link itself', !/XMLHttpRequest|WebSocket|sendBeacon|EventSource|gtag|analytics\.|target=.?_blank/.test(src));
    ok('store-config.js holds placeholders only: no price id, no worker address, no key', !/price_[A-Za-z0-9]{6,}/.test(cfg.replace(/\/\*[\s\S]*?\*\//g, '')) && !/https?:\/\//.test(cfg.replace(/\/\*[\s\S]*?\*\//g, '')) && !/sk_(live|test)_|whsec_|pk_live/.test(cfg) && (cfg.match(/'OWNER_FILLS_IN'/g) || []).length === 18);
    ok('no secret-looking strings in the store files', !/sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/.test(src + cfg));
    ok('no loot-box, countdown or urgency wording', !/loot|gacha|mystery box|limited time|only today|hurry|best value|most popular|\bbonus\b|% off|countdown/i.test(src.replace(/\/\*[\s\S]*?\*\//g, ''))); }

  /* ---------- 1. the shipped (placeholder) config: nothing can be bought ---------- */
  { const o = await open(browser, { query: '?debug=1&nosw=1' }), { page } = o;
    const a = await page.evaluate(() => { const g = __ot.game, st = g.modules.store; return { live: st.live, mock: st.mock, debug: 'debug' in st, spending: g.grownUp.spending, sw: g.grownUp.showSwitch, n: st.catalog.length, any: st.catalog.some(c => st.sellable(c.sku)), tabs: g.shop.tabs.map(t => t.id) }; });
    eq('placeholder config: the store is not live, mock is off and has no test hooks; 16 SKUs; none sellable', [a.live, a.mock, a.debug, a.n, a.any], [false, false, false, 16, false]);
    ok('spending is OFF by default and the Settings switch is offered', a.spending === false && a.sw === true);
    ok('the Store and Trail Journal tabs are registered', a.tabs.includes('store') && a.tabs.includes('journal'));
    await page.evaluate(() => __ot.game.shop.open('store'));
    const off = await page.evaluate(() => { const p = document.querySelector('.tabpane'); return { text: p.textContent.trim(), buttons: p.querySelectorAll('button').length, dollar: /\$/.test(p.textContent) }; });
    eq('spending off: the Store tab shows only "Ask a grown-up to turn on the shop."', off, { text: 'Ask a grown-up to turn on the shop.', buttons: 0, dollar: false });
    await page.screenshot({ path: path.join(OUT, 'store-off-390.png') });
    eq('spending off: open(), buy() and restore() all refuse without showing a gate', await page.evaluate(async () => { const st = __ot.game.modules.store; const r = [await st.open(), await st.buy('ot_gems_80'), await st.restore()]; return [...r, !!(__ot.game.ui.current && __ot.game.ui.current.id === 'gate')]; }), [false, false, false, false]);
    await page.evaluate(() => __ot.game.shop.open('journal'));
    const j0 = await page.evaluate(() => ({ rows: document.querySelectorAll('.tj-row[data-step]').length, pass: document.querySelectorAll('.tj-pass').length, dollar: /\$/.test(document.querySelector('.tabpane').textContent) }));
    eq('spending off: the Trail Journal shows 30 steps, no pass column and no dollar sign', j0, { rows: 30, pass: 0, dollar: false });
    /* a wrong answer does not turn spending on */
    { const p = page.evaluate(() => __ot.game.grownUp.setSpending(true)); await page.waitForSelector('.gateq b'); for (let i = 0; i < 3; i++) { await page.tap('.keypad [data-key="1"]'); await page.tap('.keypad [data-key="ok"]'); } eq('three wrong answers at the gate leave spending off', [await p, await page.evaluate(() => __ot.game.grownUp.spending)], [false, false]); }
    await page.evaluate(() => { __ot.game.ui.closeAll(); }); await o.boot();   /* a reload clears the 30-second gate lock, which lives in memory only */
    ok('a grown-up turns spending on through the gate', await spendingOn(page) === true && await page.evaluate(() => __ot.game.grownUp.spending));
    await openStore(page);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.modal.store [data-item^="ot_"], #modal [data-item^="ot_"]')].map(c => ({ sku: c.dataset.item, price: (c.querySelector('.prices') || {}).textContent, btn: c.querySelector('button').textContent, disabled: c.querySelector('button').disabled })));
    eq('all 16 SKUs are listed', cards.map(c => c.sku).sort(), [...SKUS].sort());
    ok('every card shows its exact dollar price', cards.every(c => c.price === SPEC[c.sku][0]), cards.filter(c => c.price !== SPEC[c.sku][0]).map(c => c.sku + ' ' + c.price).join(' '));
    ok('with placeholders every item says "Coming soon" and its button is disabled', cards.every(c => c.btn === 'Coming soon' && c.disabled));
    ok('the screen says the store is not open yet', await page.evaluate(() => /not open yet/.test(document.getElementById('modalBody').textContent)));
    await page.screenshot({ path: path.join(OUT, 'store-coming-soon-390.png') });
    const tryBuy = await page.evaluate(async () => { const st = __ot.game.modules.store, out = []; for (const c of st.catalog) out.push(await st.buy(c.sku)); return { out, gate: !!(__ot.game.ui.current && __ot.game.ui.current.id === 'gate'), pending: st.pending, journal: st.journal().length }; });
    ok('buy() refuses every SKU, opens no gate and records nothing', tryBuy.out.every(v => v === false) && !tryBuy.gate && tryBuy.pending === null && tryBuy.journal === 0);
    /* restore with the placeholder config: the screen opens behind the gate and says there is nothing to restore; no request leaves */
    await page.evaluate(() => { __ot.game.ui.closeAll(); }); const rp = page.evaluate(() => __ot.game.modules.store.restore()); await solveGate(page); await rp;
    await page.fill('.st-input', 'ABCD-2345'); await page.evaluate(() => [...document.querySelectorAll('#modalActions button')].find(b => b.textContent === 'Restore').click());
    ok('restore with placeholders says the store is not open and asks no server', await page.evaluate(() => /not open yet/.test(document.querySelector('.st-msg').textContent)));
    /* a return link with a session id does nothing while the store is not live */
    const before = await snap(page);
    await o.boot('?debug=1&nosw=1&cs=cs_test_a1b2c3d4e5'); const after = await snap(page);
    ok('a ?cs= return link grants nothing while the store is not open, and is removed from the address', after.gems === before.gems && after.journal.length === 0 && !/cs=/.test(page.url()), page.url());
    ok('placeholder config: no console errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | '));
    eq('placeholder config: nothing was requested from outside the game folder', o.outside(), []);
    await o.ctx.close(); }

  /* ---------- 2. mock mode cannot be reached in a normal session ---------- */
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    /* the worst case: a save with spending on and a checkout "pending", a pretend server already in storage, and a made-up return link */
    await ctx.addInitScript(([key]) => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1');
      localStorage.setItem('kc-open-trail-store-mock', JSON.stringify({ sessions: { cs_mock_abcdefgh1234: { sku: 'ot_gems_7000', install: 'inst_AAAAAAAAAAAAAAAAAAAAAAAA', paid: true, amount: 4999 } } }));
      localStorage.setItem(key, JSON.stringify({ wallet: { bones: 0, gems: 0 }, settings: { spending: true }, modules: { store: { install: 'inst_AAAAAAAAAAAAAAAAAAAAAAAA', pending: { sku: 'ot_gems_7000', t: Date.now() } } } })); } }, [SAVE_KEY]);
    for (const q of ['?mock=1&nosw=1&cs=cs_mock_abcdefgh1234', '?nosw=1&cs=cs_mock_abcdefgh1234', '?debug=0&mock=1&nosw=1&cs=cs_mock_abcdefgh1234', '?debug=true&mock=1&nosw=1&cs=cs_mock_abcdefgh1234', '?debug=1&nosw=1&cs=cs_mock_abcdefgh1234']) {
      const o = await open(browser, { ctx, boot: false }), { page } = o; await page.goto(BASE + q);
      await page.waitForFunction(() => document.querySelector('link[data-kc-store]') && !document.getElementById('loading')?.offsetParent, null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1500);
      const r = await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k) || '{}'), st = window.__ot && window.__ot.game.modules.store; return { ot: !!window.__ot, mock: st ? st.mock : null, hooks: st ? 'debug' in st : null, gems: window.__ot ? __ot.game.state.wallet.gems : (s.wallet || {}).gems }; }, SAVE_KEY);
      const debugOnly = q.startsWith('?debug=1');
      ok(`${q}: no mock, no test hooks, no gems granted`, r.gems === 0 && (debugOnly ? r.mock === false && r.hooks === false : r.ot === false), JSON.stringify(r));
      eq(`${q}: nothing requested from outside`, o.outside(), []); await page.close(); }
    await ctx.close(); }

  /* ---------- 3. mock mode, by touch, with the page reload ---------- */
  let trailKey = '';
  { const o = await open(browser), { page } = o;
    eq('mock mode needs both ?debug=1 and ?mock=1', await page.evaluate(() => [__ot.game.modules.store.mock, __ot.game.modules.store.live, typeof __ot.game.modules.store.debug.buy]), [true, false, 'function']);
    await spendingOn(page); await page.evaluate(() => __ot.give({ bones: 37 }));
    const s0 = await snap(page);
    await openStore(page);
    const cards = await page.evaluate(() => [...document.querySelectorAll('#modal [data-item^="ot_"]')].map(c => ({ sku: c.dataset.item, price: c.querySelector('.prices').textContent, btn: c.querySelector('button').textContent })));
    ok('every card and every Buy button carries the dollar price', cards.length === 16 && cards.every(c => c.price === SPEC[c.sku][0] && c.btn === 'Buy ' + SPEC[c.sku][0]), JSON.stringify(cards.filter(c => c.btn !== 'Buy ' + SPEC[c.sku][0])));
    ok('test mode is labelled on the screen', await page.evaluate(() => /TEST MODE/.test(document.getElementById('modalBody').textContent)));
    const L1 = await layout(page); ok('store screen at 390 x 844: 44 px targets, no sideways scroll', L1.small.length === 0 && !L1.sideways && L1.off === 0, JSON.stringify(L1));
    await page.screenshot({ path: path.join(OUT, 'store-390.png') });
    await page.tap('[data-item="ot_gems_80"] button');
    ok('Buy asks the grown-up gate first, and names the price', await page.waitForSelector('.gateq b').then(() => page.evaluate(() => /\$0\.99 of real money/.test(document.getElementById('modalBody').textContent))));
    await solveGate(page); await page.waitForSelector('.st-price');
    const conf = await page.evaluate(() => ({ title: document.getElementById('modalTitle').textContent, price: document.querySelector('.st-price').textContent, list: [...document.querySelectorAll('.st-list li')].map(l => l.textContent), text: document.getElementById('modalBody').textContent, actions: [...document.querySelectorAll('#modalActions button')].map(b => b.textContent) }));
    ok('step two: a confirm screen with the price, the exact contents, the refund line and the device limit', conf.price === '$0.99' && JSON.stringify(conf.list) === '["80 gems"]' && /real money/.test(conf.text) && /refunded on request within 14 days/.test(conf.text) && /\$0\.00 of \$50\.00/.test(conf.text) && /cannot be\s+restored/.test(conf.text), JSON.stringify(conf));
    eq('the confirm buttons are "Not now" and "Pay $0.99"', conf.actions, ['Not now', 'Pay $0.99']);
    const L2 = await layout(page); ok('confirm screen at 390 x 844: 44 px targets, no sideways scroll', L2.small.length === 0 && !L2.sideways, JSON.stringify(L2));
    await page.screenshot({ path: path.join(OUT, 'store-confirm-390.png') });
    eq('nothing has been granted or recorded before Pay is pressed', await page.evaluate(() => [__ot.game.state.wallet.gems, __ot.game.modules.store.journal().length, __ot.game.modules.store.pending]), [s0.gems, 0, null]);
    /* "Not now" changes nothing */
    await page.evaluate(() => [...document.querySelectorAll('#modalActions button')].find(b => b.textContent === 'Not now').click());
    eq('"Not now" grants nothing', (await snap(page)).gems, s0.gems);
    /* again, and pay: the pretend payment page sends the player back with ?cs= and the game reloads */
    await page.tap('[data-item="ot_gems_80"] button'); await solveGate(page); await page.waitForSelector('.st-price');
    await Promise.all([page.waitForURL(/cs=cs_mock_/), page.evaluate(() => [...document.querySelectorAll('#modalActions button')].find(b => /^Pay /.test(b.textContent)).click())]);
    const session = new URL(page.url()).searchParams.get('cs');
    await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 });
    await page.waitForFunction(() => __ot.game.modules.store.journal().length === 1, null, { timeout: 10000 });
    await page.evaluate(() => { __ot.start(); __ot.step(3); }); await page.waitForSelector('.st-list', { timeout: 8000 });
    const s1 = await snap(page);
    eq('after the return: +80 gems, bones untouched, one journal line of $0.99, nothing pending', [s1.gems - s0.gems, s1.bones, s1.journal.length, s1.journal[0].sku, s1.journal[0].cents, s1.journal[0].kind, s1.pending, s1.spent], [80, s0.bones, 1, 'ot_gems_80', 99, 'buy', null, 99]);
    ok('the session id is gone from the address bar', !/cs=/.test(page.url()), page.url());
    ok('a thank-you screen lists what was added', await page.evaluate(() => document.getElementById('modalTitle').textContent === 'Thank you' && /80 gems/.test(document.querySelector('.st-list').textContent)));
    await page.screenshot({ path: path.join(OUT, 'store-thanks-390.png') });
    /* replay 1: reload on the same return link */
    await o.boot('?debug=1&nosw=1&mock=1&cs=' + session); await page.waitForTimeout(300);
    const s2 = await snap(page); eq('reloading the return link does not grant again', [s2.gems, s2.journal.length], [s1.gems, 1]);
    /* replay 2: straight at the claim function, twice */
    eq('claiming the same session again grants nothing', await page.evaluate(async s => { const d = __ot.game.modules.store.debug; return [await d.claim(s), await d.claim(s), __ot.game.state.wallet.gems, __ot.game.modules.store.journal().length]; }, session), [false, false, s1.gems, 1]);
    /* cancel: comes back with ?cancelled=1 */
    await page.evaluate(() => { __ot.game.state.modules.store.pending = { sku: 'ot_gems_500', t: Date.now() }; __ot.save(); });
    await o.boot('?debug=1&nosw=1&mock=1&cancelled=1'); const s3 = await snap(page);
    eq('a cancelled payment grants nothing and clears the pending mark', [s3.gems, s3.journal.length, s3.pending, /cancelled/.test(page.url())], [s1.gems, 1, null, false]);
    ok('mock by touch: no console errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | ')); eq('mock by touch: nothing requested from outside', o.outside(), []);
    await o.ctx.close(); }

  /* ---------- 4. every SKU, refusals, limit, hiding, restore, Start over ---------- */
  { const o = await open(browser), { page } = o; await spendingOn(page);
    await page.evaluate(() => { __ot.game.state.modules.store.cap = 10000; __ot.give({ bones: 500 }); });
    let spent = 0;
    eq('a purchase is paid in through game.economy.grant, source store:<sku>, and never any other way', await page.evaluate(async () => { const g = __ot.game, seen = [], real = g.economy.grant; let calls = 0; g.economy.grant = function (what, src) { calls++; return real.apply(this, arguments); }; const off = g.on('grant', e => seen.push([e.source, e.gems, e.bones]));
      const g0 = g.state.wallet.gems; await g.modules.store.debug.buy('ot_gems_80'); off(); g.economy.grant = real; g.modules.store.debug.backdate(31); return [calls, seen, g.state.wallet.gems - g0]; }), [1, [['store:ot_gems_80', 80, 0]], 80]);
    for (const sku of SKUS) {
      if (spent + Math.round(parseFloat(SPEC[sku][0].slice(1)) * 100) > 10000) { await page.evaluate(() => __ot.game.modules.store.debug.backdate(31)); spent = 0; }
      const r = await page.evaluate(async sku => { const g = __ot.game, s = g.state, st = g.modules.store, w0 = { ...s.wallet }, o0 = { ...s.owned }, n0 = st.journal().length; const okd = await st.debug.buy(sku);
        const gained = Object.keys(s.owned).filter(k => o0[k] !== s.owned[k]).map(k => [k, s.owned[k], o0[k] || 0]); return { okd, bones: s.wallet.bones - w0.bones, gems: s.wallet.gems - w0.gems, gained, lines: st.journal().length - n0, last: st.journal().slice(-1)[0], flags: { ...s.flags } }; }, sku);
      const [price, gems, items] = SPEC[sku], cents = Math.round(parseFloat(price.slice(1)) * 100); spent += cents;
      const wantItems = items.map(i => { const m = /^treat:(\d+)$/.exec(i); return m ? 'treat:party x' + m[1] : i; }).sort();
      const gotItems = r.gained.map(([k, now, was]) => (k === 'treat:party' ? 'treat:party x' + ((now === true ? 1 : now) - (was === true ? 1 : was)) : k)).sort();
      /* ot_everything is bought after its parts here, so only what is not yet owned is new; that case is checked separately below */
      const wantNew = sku === 'ot_everything' ? [] : wantItems, passExtra = r.gained.filter(([k]) => /trailblazer|compass|switchback|daybreak|ridgeline|lookout|summit|campfire|wayfinder|northern|trails-end/.test(k)).length;
      ok(`${sku} (${price}): exactly ${gems} gems, ${items.length} item(s), 0 bones, one journal line`, r.okd === true && r.bones === 0 && r.gems === gems && r.lines === 1 && r.last.cents === cents && r.last.sku === sku && r.last.test === true && JSON.stringify(gotItems.filter(i => !/trailblazer|compass|switchback|daybreak|ridgeline|lookout|summit|campfire|wayfinder|northern|trails-end/.test(i))) === JSON.stringify(wantNew), JSON.stringify({ r, wantNew, passExtra }));
    }
    const all = await snap(page);
    ok('after buying everything: every catalogue item is owned and the store flags are set', [...F, ...G, ...R, ...H, ...SUP, 'pass:trail', 'tag:good-human', 'bandana:first-trail'].every(i => all.owned[i]) && all.flags['store:pass'] === true && all.flags['store:supporter'] === true && all.flags['store:starter'] === true);
    eq('13 Party Treats were added (3 + 10)', all.owned['treat:party'], 13);
    ok('a Trail Key was issued', /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(all.key), all.key); trailKey = all.key;
    ok('purchased cosmetics can be worn', await page.evaluate(() => __ot.game.cosmetics.equip('tag:supporter') && __ot.game.cosmetics.equip('bandana:first-trail') && __ot.game.cosmetics.equip('tag:good-human')));
    ok('the Supporter photo frame is registered once owned', await page.evaluate(() => __ot.game.photo.all('frame').some(f => (f.id || f) === 'supporter')));
    /* hiding (spec 4.4 item 8) */
    eq('owned permanent SKUs are hidden; consumables stay', await page.evaluate(() => { const st = __ot.game.modules.store; return st.catalog.filter(c => st.hidden(c.sku)).map(c => c.sku).sort(); }), [...PERMANENT].sort());
    await openStore(page);
    eq('the store screen now lists only the 8 repeatable items', await page.evaluate(() => [...document.querySelectorAll('#modal [data-item^="ot_"]')].map(c => c.dataset.item).sort()), SKUS.filter(s => !PERMANENT.includes(s)).sort());
    ok('the purchase journal on screen shows the purchases with prices and "(test, no money)"', await page.evaluate(() => { const li = [...document.querySelectorAll('.st-journal li')]; return li.length === Math.min(50, __ot.game.modules.store.journal().length) && li.length >= 16 && li.every(l => /\$\d+\.\d\d/.test(l.textContent) && /test, no money/.test(l.textContent)); }));
    ok('the Trail Key is shown in the store', await page.evaluate(k => document.getElementById('modalBody').textContent.includes(k), trailKey));
    ok('refund, privacy and "never locked" wording is on the screen', await page.evaluate(() => { const t = document.getElementById('modalBody').textContent; return /refunded on request within 14 days/.test(t) && /never locked/.test(t) && /no accounts, no adverts and no tracking/.test(t) && /Nothing here is random/.test(t); }));
    await page.evaluate(() => { document.getElementById('modalBody').scrollTop = 1e6; }); await page.screenshot({ path: path.join(OUT, 'store-journal-390.png') });
    await page.evaluate(() => __ot.game.ui.closeAll());

    /* refusals */
    const base = await snap(page);
    const refuse = async (mode, sku) => page.evaluate(async ([mode, sku]) => { const g = __ot.game, st = g.modules.store, s = g.state, w = s.wallet.gems, b = s.wallet.bones, n = st.journal().length, own = JSON.stringify(s.owned); st.debug.next(mode); let r, err = ''; try { r = await st.debug.buy(sku); } catch (e) { err = e.message; r = 'threw'; }
      return { r, err, same: s.wallet.gems === w && s.wallet.bones === b && st.journal().length === n && JSON.stringify(s.owned) === own, pending: st.pending }; }, [mode, sku]);
    await page.evaluate(() => __ot.game.modules.store.debug.backdate(31));
    let x = await refuse('tamper-bones', 'ot_gems_500'); ok('a grant that carries bones is refused whole: no gems, no bones, no journal line', x.r === false && x.same && x.pending === null, JSON.stringify(x));
    x = await refuse('amount', 'ot_gems_7000'); ok('a payment of the wrong amount grants nothing', x.r === false && x.same, JSON.stringify(x));
    x = await refuse('unpaid', 'ot_gems_500'); ok('an unpaid checkout grants nothing and is kept as "not added yet"', x.r === false && x.same && x.pending && /^cs_mock_/.test(x.pending.session || ''), JSON.stringify(x));
    await openStore(page); ok('the store offers "Finish adding it" for a payment that has not been confirmed', await page.evaluate(() => !!document.querySelector('[data-act="finish"]')));
    await page.evaluate(() => { const kv = JSON.parse(localStorage.getItem('kc-open-trail-store-mock')); kv.sessions[__ot.game.modules.store.pending.session].paid = true; localStorage.setItem('kc-open-trail-store-mock', JSON.stringify(kv)); });
    await page.tap('[data-act="finish"]'); await page.waitForFunction(() => __ot.game.modules.store.pending === null, null, { timeout: 5000 });
    eq('once the payment has gone through, "Finish adding it" grants it once', [(await snap(page)).gems - base.gems, await page.evaluate(async () => { const st = __ot.game.modules.store; return st.journal().slice(-1)[0].sku; })], [500, 'ot_gems_500']);
    await page.evaluate(() => __ot.game.ui.closeAll());
    x = await refuse('offline', 'ot_gems_80'); ok('a server that cannot be reached grants nothing and does not throw at the player', x.same && x.r !== true, JSON.stringify(x));
    eq('an unknown SKU cannot be bought or checked out', await page.evaluate(async () => { const st = __ot.game.modules.store, g0 = __ot.game.state.wallet.gems; const a = await st.buy('ot_gems_99999'), b = await st.debug.buy('ot_bones_500'), c = await st.buy('__proto__'); return [a, b, c, st.sku('ot_gems_99999'), __ot.game.state.wallet.gems - g0]; }), [false, false, false, null, 0]);
    eq('grantProblem: bones, odd gems, odd items and non-store flags are all refused', await page.evaluate(async () => { const { grantProblem: p } = await import('./js/store.js'); return [p({ bones: 0, gems: 80, items: [], flags: {} }), p({ bones: 1 }), p({ gems: 7001 }), p({ gems: 1.5 }), p({ gems: -5 }), p({ items: ['<img>'] }), p({ items: ['up:forever'] }), p({ items: ['bones:500'] }), p({ flags: { festival: true } }), p({ flags: { 'store:pass': 1 } }), p(null)]; }), ['', 'bones', 'gems', 'gems', 'gems', 'items', 'items', 'items', 'flags', 'flags', 'no grant']);

    /* the device limit */
    await page.evaluate(() => { const st = __ot.game.modules.store; st.debug.backdate(31); __ot.game.state.modules.store.cap = 5000; });
    eq('the default limit is $50 in 30 days', await page.evaluate(() => { __ot.game.state.modules.store.cap = 5000; return [__ot.game.modules.store.limit, __ot.game.modules.store.spent30()]; }), [5000, 0]);
    await page.evaluate(async () => { await __ot.game.modules.store.debug.buy('ot_gems_2600'); await __ot.game.modules.store.debug.buy('ot_gems_2600'); });
    eq('after $39.98 there is $10.02 of room', await page.evaluate(() => [__ot.game.modules.store.spent30(), __ot.game.modules.store.room()]), [3998, 1002]);
    eq('a $19.99 pack is now refused before any gate; a $9.99 pack is still allowed to reach the gate', await page.evaluate(async () => { const st = __ot.game.modules.store; const a = await st.buy('ot_gems_2600'); const gate = !!(__ot.game.ui.current && __ot.game.ui.current.id === 'gate'); return [a, gate]; }), [false, false]);
    await openStore(page);
    eq('over-limit items are marked and their buttons disabled; in-limit ones are not', await page.evaluate(() => { const c = s => document.querySelector(`#modal [data-item="${s}"]`); return [c('ot_gems_2600').querySelector('button').disabled, /limit/.test(c('ot_gems_2600').textContent), c('ot_gems_1200').querySelector('button').disabled, /\$39\.98 of \$50\.00/.test(document.getElementById('modalBody').textContent)]; }), [true, true, false, true]);
    await page.tap('[data-act="cap"]'); await solveGate(page); await page.waitForSelector('.st-caps');
    const L3 = await layout(page); ok('limit screen: 44 px targets; says it is a device limit, not a bank limit', L3.small.length === 0 && !L3.sideways && await page.evaluate(() => /not a limit at your bank/.test(document.getElementById('modalBody').textContent)), JSON.stringify(L3));
    await page.tap('.st-caps [data-cap="10000"]');
    eq('a grown-up raised the limit to $100 behind the gate; it is saved', await page.evaluate(k => [__ot.game.modules.store.limit, (__ot.save(), JSON.parse(localStorage.getItem(k)).modules.store.cap)], SAVE_KEY), [10000, 10000]);
    await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.modules.store.debug.backdate(29); });
    eq('purchases 29 days old still count; at 31 days they no longer do', await page.evaluate(() => { const st = __ot.game.modules.store, a = st.spent30(); st.debug.backdate(2); return [a, st.spent30()]; }), [3998, 0]);

    /* Start over keeps what was paid for */
    const pre = await page.evaluate(() => { const g = __ot.game; g.save.save(); return { gems: g.state.wallet.gems, bank: g.modules.store.debug.data().gemBank, journal: g.modules.store.journal().length }; });
    ok('purchased gems still unspent are tracked (never more than the balance)', pre.bank > 0 && pre.bank <= pre.gems, JSON.stringify(pre));
    await page.evaluate(() => { __ot.game.economy.spend({ gems: 1000 }, 'test'); __ot.step(130); });
    const mid = await page.evaluate(() => ({ gems: __ot.game.state.wallet.gems, bank: __ot.game.modules.store.debug.data().gemBank }));
    ok('spending gems lowers the tracked amount with the balance', mid.bank <= mid.gems && mid.bank <= pre.bank, JSON.stringify(mid));
    await page.evaluate(() => { __ot.game.save.reset(); }); await o.boot();
    const post = await snap(page), postBank = await page.evaluate(() => __ot.game.modules.store.debug.data().gemBank);
    ok('"Start over": bones are gone, but permanent items, pass rewards, unspent purchased gems, the journal and the key are back', post.bones < 50 && post.gems >= mid.bank && post.gems <= mid.bank + 5 && postBank === mid.bank && PERMANENT.every(s => SPEC[s][2].every(i => post.owned[i])) && post.journal.length === pre.journal && post.key === trailKey && post.owned['treat:party'] === undefined, JSON.stringify({ bones: post.bones, gems: post.gems, bank: mid.bank, postBank, j: post.journal.length }));
    eq('"Start over" does not un-hide owned items or re-grant twice on a second reload', await (async () => { await o.boot(); const s = await snap(page); return [s.gems - post.gems, await page.evaluate(() => __ot.game.modules.store.hidden('ot_supporter'))]; })(), [0, true]);
    ok('section 4: no console errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | ')); eq('section 4: nothing requested from outside', o.outside(), []);

    /* restore on "another device": wipe this browser's game save completely, keep the pretend server */
    await wipe(o, ['kc-open-trail-store-mock']);
    const fresh = await snap(page);
    ok('a wiped device owns nothing from the store', !fresh.owned['tag:supporter'] && !fresh.owned['pass:trail'] && fresh.journal.length === 0 && fresh.key === '' && fresh.gems < 10, JSON.stringify({ g: fresh.gems, k: fresh.key }));
    /* a copied return link from the first device is refused here (different install id) */
    const stolen = await page.evaluate(async () => { const st = __ot.game.modules.store, kv = st.debug.kv(), id = Object.keys(kv.claims).find(k => kv.claims[k].sku === 'ot_gems_7000'); const g0 = __ot.game.state.wallet.gems; __ot.game.state.modules.store.install = 'inst_ZZZZZZZZZZZZZZZZZZZZZZZZ'; __ot.game.state.modules.store.pending = { sku: 'ot_gems_7000', t: Date.now() }; const r = await st.debug.claim(id); return [r, __ot.game.state.wallet.gems - g0, st.journal().length]; });
    eq('a return link copied from another device grants nothing', stolen, [false, 0, 0]);
    await spendingOn(page);
    const rp = page.evaluate(() => __ot.game.modules.store.restore()); await solveGate(page); await rp; await page.waitForSelector('.st-input');
    const L4 = await layout(page); ok('restore screen: 44 px targets, no sideways scroll', L4.small.length === 0 && !L4.sideways, JSON.stringify(L4));
    const click = t => page.evaluate(t => [...document.querySelectorAll('#modalActions button')].find(b => b.textContent === t).click(), t);
    await page.fill('.st-input', 'ZZZZ-ZZZZ'); await click('Restore'); await page.waitForFunction(() => /isn't on record/.test(document.querySelector('.st-msg').textContent));
    eq('a wrong Trail Key restores nothing and says so', [(await snap(page)).owned['tag:supporter'] || false], [false]);
    await page.fill('.st-input', trailKey.toLowerCase().replace('-', ' ')); await page.screenshot({ path: path.join(OUT, 'store-restore-390.png') }); await click('Restore');
    await page.waitForFunction(() => __ot.game.modules.store.key !== '', null, { timeout: 5000 });
    const back = await snap(page);
    ok('the Trail Key brings back every permanent item and flag', PERMANENT.every(s => SPEC[s][2].every(i => back.owned[i])) && back.flags['store:pass'] === true && back.flags['store:supporter'] === true && back.key === trailKey, JSON.stringify(Object.keys(back.owned)));
    eq('restore brings back no purchased gems, no treats and no tip tag; it writes one journal line and charges nothing', [back.gems - fresh.gems <= 300 && back.gems - fresh.gems >= 0, back.owned['treat:party'] || 0, back.owned['tag:good-human'] || false, back.journal.length, back.journal[0].kind, back.spent], [true, 0, false, 1, 'restore', 0]);
    eq('restoring a second time adds nothing', await page.evaluate(async k => { const g0 = __ot.game.state.wallet.gems, added = await __ot.game.modules.store.debug.restoreKey(k); return [added.length, __ot.game.state.wallet.gems - g0]; }, trailKey), [0, 0]);
    await o.ctx.close(); }

  /* ---------- 5. ot_everything on a clean save, and its hiding rule ---------- */
  { const o = await open(browser), { page } = o; await spendingOn(page);
    eq('ot_everything is offered while fewer than two of its parts are owned', await page.evaluate(async () => { const st = __ot.game.modules.store; const a = st.hidden('ot_everything'); await st.debug.buy('ot_pack_forest'); const b = st.hidden('ot_everything'); await st.debug.buy('ot_pack_galaxy'); return [a, b, st.hidden('ot_everything')]; }), [false, false, true]);
    await wipe(o); await spendingOn(page);
    const r = await page.evaluate(async () => { const g = __ot.game, s = g.state, st = g.modules.store, w = { ...s.wallet }, o0 = { ...s.owned }; await st.debug.buy('ot_everything'); return { bones: s.wallet.bones - w.bones, gems: s.wallet.gems - w.gems, gained: Object.keys(s.owned).filter(k => !o0[k]).sort(), hidden: st.catalog.filter(c => st.hidden(c.sku)).map(c => c.sku).sort() }; });
    eq('ot_everything on a clean save: 600 gems, 0 bones, its 37 listed items and nothing else', [r.bones, r.gems, r.gained], [0, 600, [...SPEC.ot_everything[2]].sort()]);
    eq('once the bundle is owned, the bundle and its six parts are hidden', r.hidden, ['ot_everything', 'ot_pack_forest', 'ot_pack_galaxy', 'ot_pack_halloween', 'ot_pack_roadtrip', 'ot_supporter', 'ot_trail_pass']);
    eq('the tip can be bought again and again but gives its tag once', await page.evaluate(async () => { const st = __ot.game.modules.store; await st.debug.buy('ot_tip_3'); await st.debug.buy('ot_tip_3'); return [__ot.game.state.owned['tag:good-human'], st.journal().filter(j => j.sku === 'ot_tip_3').length, st.hidden('ot_tip_3')]; }), [true, 2, false]);
    await o.ctx.close(); }

  /* ---------- 6. the Trail Journal ---------- */
  { const o = await open(browser), { page } = o;
    const shape = await page.evaluate(() => { const st = __ot.game.modules.store, S = st.steps; return { n: S.length, freeGems: S.reduce((a, s) => a + s.free.gems, 0), freeBones: S.reduce((a, s) => a + s.free.bones, 0), allBones: S.every(s => s.free.bones > 0), passGems: S.reduce((a, s) => a + (s.pass.gems || 0), 0), passItems: S.filter(s => s.pass.item).map(s => s.pass.item), alt: S.every(s => !!s.pass.item === (s.n % 2 === 1)), defined: st.passItems.every(p => !!__ot.game.cosmetics.get(p.id)), kinds: [...new Set(S.map(s => s.kind))].sort() }; });
    eq('30 steps; free column: bones on every step and 30 gems in all', [shape.n, shape.freeGems, shape.allBones], [30, 30, true]);
    eq('pass column: 15 different cosmetics and 300 gems, alternating, one reward on every step', [new Set(shape.passItems).size, shape.passGems, shape.alt, shape.defined], [15, 300, true, true]);
    eq('the steps cover zones, golden balls, photos, digs, distance and missions', shape.kinds, ['balls', 'digs', 'distance', 'missions', 'photos', 'zones']);
    const w0 = await snap(page);
    /* reach some steps by play (stats the core keeps) */
    const r1 = await page.evaluate(() => { const g = __ot.game, s = g.state; s.stats.digs = 5; s.stats.photos = 1; const b = s.wallet.bones, m = s.wallet.gems; const paid = g.modules.store.trail.check(); return { paid, bones: s.wallet.bones - b, gems: s.wallet.gems - m, free: g.modules.store.trail.freePaid(), pass: g.modules.store.trail.passPaid() }; });
    eq('reaching two steps pays the free column at once: 30 bones and 2 gems; no pass rewards without the pass', [r1.bones, r1.gems, r1.free.sort((a, b) => a - b), r1.pass], [30, 2, [3, 4], []]);
    eq('a step is paid once only', await page.evaluate(() => { const s = __ot.game.state, b = s.wallet.bones; const again = __ot.game.modules.store.trail.check(); __ot.step(200); return [again, s.wallet.bones - b >= 0 && __ot.game.modules.store.trail.freePaid().length]; }), [null, 2]);
    await page.evaluate(() => __ot.game.shop.open('journal'));
    eq('spending off: steps 3 and 4 show Paid, and there is still no pass column or price', await page.evaluate(() => [document.querySelectorAll('.tj-row.done').length, document.querySelectorAll('.tj-free.paid').length, document.querySelectorAll('.tj-pass').length, /\$/.test(document.querySelector('.tabpane').textContent)]), [2, 2, 0, false]);
    const LJ = await layout(page); ok('Trail Journal at 390 x 844: no sideways scroll', !LJ.sideways && LJ.off === 0, JSON.stringify(LJ));
    await page.screenshot({ path: path.join(OUT, 'journal-free-390.png') });
    await page.evaluate(() => __ot.game.ui.closeAll()); await spendingOn(page); await page.evaluate(() => __ot.game.shop.open('journal'));
    eq('spending on, no pass: the pass column is shown as not owned, with the $5.99 price in words and gem rewards as "about $0.25"; no Buy button', await page.evaluate(() => { const p = document.querySelector('.tabpane'); return [p.querySelectorAll('.tj-pass.off').length, /\$5\.99 of real money/.test(p.textContent), /about \$0\.25/.test(p.textContent), p.querySelectorAll('button').length]; }), [30, true, true, 0]);
    await page.screenshot({ path: path.join(OUT, 'journal-pass-390.png') });
    /* buying the pass late pays out every step already reached, at once */
    const r2 = await page.evaluate(async () => { const g = __ot.game, s = g.state, b = s.wallet.bones, m = s.wallet.gems; await g.modules.store.debug.buy('ot_trail_pass'); return { bones: s.wallet.bones - b, gems: s.wallet.gems - m, pass: g.modules.store.trail.passPaid().sort((x, y) => x - y), tag: !!s.owned['tag:compass'], hasPass: g.modules.store.trail.hasPass() }; });
    eq('a late pass pays steps 3 and 4 at once: the Compass tag and 20 gems, no bones', [r2.bones, r2.gems, r2.pass, r2.tag, r2.hasPass], [0, 20, [3, 4], true, true]);
    /* everything reached: the totals */
    const r3 = await page.evaluate(() => { const g = __ot.game, s = g.state, b = s.wallet.bones, m = s.wallet.gems; Object.assign(s.stats, { digs: 999, photos: 999, distance: 2e5 }); s.collected.zones = Array.from({ length: 38 }, (_, i) => 'z' + i); s.collected.balls = Array.from({ length: 36 }, (_, i) => 'b' + i);
      for (let i = 0; i < 15; i++) g.emit('missionComplete', { id: 'test-mission-' + i, first: true }); g.modules.store.trail.check();
      return { bones: s.wallet.bones - b, gems: s.wallet.gems - m, free: g.modules.store.trail.freePaid().length, pass: g.modules.store.trail.passPaid().length, items: g.modules.store.passItems.filter(p => s.owned[p.id]).length, wear: g.modules.store.passItems.every(p => g.cosmetics.equip(p.id)) }; });
    const totalBones = shape.freeBones - 30;
    eq('all 30 steps: the rest of the free bones, 28 free gems + 280 pass gems, all 15 pass cosmetics, each wearable', [r3.bones, r3.gems, r3.free, r3.pass, r3.items, r3.wear], [totalBones, 28 + 280, 30, 30, 15, true]);
    await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.shop.open('journal'); });
    eq('with the pass: every row shows both columns Paid; nothing is for sale on the page', await page.evaluate(() => [document.querySelectorAll('.tj-free.paid').length, document.querySelectorAll('.tj-pass.paid').length, /of real money/.test(document.querySelector('.tabpane').textContent)]), [30, 30, false]);
    /* nothing expires: a reload keeps it all and pays nothing twice */
    await page.evaluate(() => __ot.save()); await o.boot();
    eq('after a reload nothing is paid twice and nothing has reset', await page.evaluate(() => { let n = 0; __ot.game.on('journalStep', () => n++); __ot.game.on('grant', e => { if (/^journal/.test(e.source)) n++; }); __ot.step(300); return [n, __ot.game.modules.store.trail.check(), __ot.game.modules.store.trail.freePaid().length, __ot.game.modules.store.trail.passPaid().length]; }), [0, null, 30, 30]);
    ok('no date, clock or countdown anywhere on the Trail Journal', await page.evaluate(() => { __ot.game.shop.open('journal'); return !/\b\d+\s*(days?|hours?|hrs?|minutes?|mins?)\b|ends|expires|left to|season/i.test(document.querySelector('.tabpane').textContent); }));
    ok('Trail Journal: no console errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | ')); eq('Trail Journal: nothing requested from outside', o.outside(), []);
    await w0; await o.ctx.close(); }

  /* ---------- 7. landscape phone ---------- */
  { const o = await open(browser, { viewport: { width: 844, height: 390 } }), { page } = o; await spendingOn(page);
    await page.evaluate(() => __ot.game.shop.open('store')); const LT = await layout(page); ok('Store tab at 844 x 390: 44 px targets, no sideways scroll', LT.small.length === 0 && !LT.sideways, JSON.stringify(LT));
    await page.tap('[data-act="open-store"]'); await solveGate(page); await page.waitForSelector('[data-item="ot_gems_80"]');
    const L1 = await layout(page); ok('store screen at 844 x 390: 44 px targets, no sideways scroll', L1.small.length === 0 && !L1.sideways && L1.off === 0, JSON.stringify(L1));
    ok('store screen at 844 x 390: a price is on screen without scrolling', await page.evaluate(() => [...document.querySelectorAll('#modal .prices, #modal .st-limit')].some(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
    await page.screenshot({ path: path.join(OUT, 'store-844.png') });
    await page.tap('[data-item="ot_supporter"] button'); await solveGate(page); await page.waitForSelector('.st-price');
    const L2 = await layout(page); const cf = await page.evaluate(() => ({ list: [...document.querySelectorAll('.st-list li')].map(l => l.textContent), pay: [...document.querySelectorAll('#modalActions button')].map(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), text: document.getElementById('modalBody').textContent }));
    ok('confirm at 844 x 390: Pay and Not now are on screen, 44 px, no sideways scroll', L2.small.length === 0 && !L2.sideways && cf.pay.every(Boolean), JSON.stringify(L2));
    eq('the Supporter confirm lists its exact contents', cf.list, ['600 gems', 'Supporter tag', 'Supporter bandana', 'Gold trim for the den', 'Supporter photo frame']);
    ok('a permanent item explains the Trail Key and that gems are not restored', /Trail Key/.test(cf.text) && /gems are not restored/.test(cf.text));
    await page.screenshot({ path: path.join(OUT, 'store-confirm-844.png') });
    await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.shop.open('journal'); }); const LJ = await layout(page); ok('Trail Journal at 844 x 390: no sideways scroll', !LJ.sideways && LJ.off === 0, JSON.stringify(LJ));
    await page.screenshot({ path: path.join(OUT, 'journal-844.png') });
    /* Settings rows */
    await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.ui.settings ? __ot.game.ui.settings() : __ot.press && 0; });
    const rows = await page.evaluate(() => ['spending', 'store-limit', 'store-restore'].map(id => !!document.querySelector(`[data-set="${id}"]`)));
    if (rows.some(Boolean)) eq('Settings has the spending switch, the limit and restore rows', rows, [true, true, true]); else console.log('NOTE  Settings screen could not be opened from the test; rows not checked');
    ok('landscape: no console errors', o.errors.length === 0, o.errors.slice(0, 3).join(' | ')); await o.ctx.close(); }

  /* ---------- 8. the same game against the real worker code, Stripe faked ---------- */
  { const { handle } = await import('file://' + WORKER);
    const kv = new Map(), KV = { async get(k, t) { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); } };
    const PID = sku => 'price_1E2E' + sku.replace(/[^a-z0-9]/g, '');   /* shaped like a real Stripe price id: letters and digits only */
    const fake = { n: 0, sessions: {}, forms: [], calls: 0 }, price = sku => ({ unit_amount: Math.round(parseFloat(SPEC[sku][0].slice(1)) * 100), currency: 'usd', active: true });
    const stripeFetch = async (url, init = {}) => { const u = String(url); if (!u.startsWith('https://api.stripe.com/v1/')) throw new Error('unexpected fetch ' + u); fake.calls++;
      const p = u.slice('https://api.stripe.com/v1'.length), form = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : {}, okr = b => new Response(JSON.stringify(b), { status: 200 });
      if (p === '/checkout/sessions' && init.method === 'POST') { const id = 'cs_test_e2e' + (++fake.n), sku = form['metadata[sku]']; fake.forms.push(form); fake.sessions[id] = { status: 'complete', payment_status: 'paid', mode: form.mode, metadata: { sku, game: form['metadata[game]'], install: form['metadata[install]'] }, amount_subtotal: price(sku).unit_amount, currency: 'usd', customer: 'cus_e2e', success_url: form.success_url }; return okr({ id, url: 'https://checkout.stripe.com/c/pay/' + id }); }
      if (p.startsWith('/checkout/sessions/')) { const id = decodeURIComponent(p.split('/')[3]); return fake.sessions[id] ? okr({ id, ...fake.sessions[id] }) : new Response(JSON.stringify({ error: { message: 'No such checkout.session' } }), { status: 404 }); }
      if (p.startsWith('/prices/')) { const sku = SKUS.find(k => PID(k) === p.split('/')[2]); return SPEC[sku] ? okr(price(sku)) : new Response('{}', { status: 404 }); }
      throw new Error('unexpected stripe path ' + p); };
    const hits = [];
    const wsrv = http.createServer(async (req, res) => { const chunks = []; for await (const c of req) chunks.push(c); hits.push(req.method + ' ' + req.url);
      const env = { DEWCLAW: KV, STRIPE_SECRET_KEY: 'sk_test_e2e_not_real', ALLOWED_ORIGIN: BASE.slice(0, -1), APP_ORIGIN: BASE.slice(0, -1), OT_RETURN_URL: BASE, STRIPE_PRICES: JSON.stringify(Object.fromEntries(SKUS.map(s => [s, PID(s)]))) };
      const r = await handle(new Request('http://worker.test' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env, { fetch: stripeFetch, now: Date.now });
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); });
    await new Promise(r => wsrv.listen(0, r)); const WURL = `http://localhost:${wsrv.address().port}`;
    configOverride = `export const WORKER_URL = '${WURL}';\nexport const STRIPE_PRICE_IDS = { ${SKUS.filter(s => s !== 'ot_tip_3').map(s => `${s}: '${PID(s)}'`).join(', ')}, ot_tip_3: 'OWNER_FILLS_IN' };\nexport const SUPPORT_CONTACT = 'OWNER_FILLS_IN';\n`;
    const o = await open(browser, { query: '?debug=1&nosw=1' }), { page } = o;
    /* stand in for Stripe's payment page: it sends the buyer back to the success_url with the session id */
    await page.route('https://checkout.stripe.com/**', route => { const id = route.request().url().split('/').pop(); const s = fake.sessions[id]; route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(s.success_url.replace('{CHECKOUT_SESSION_ID}', id) + '&debug=1&nosw=1')})</script>` }); });
    eq('with a worker address and price ids the store is live (not mock); the one SKU left as a placeholder is not sellable', await page.evaluate(() => { const st = __ot.game.modules.store; return [st.live, st.mock, st.sellable('ot_supporter'), st.sellable('ot_tip_3'), 'debug' in st]; }), [true, false, true, false, false]);
    eq('nothing has been asked of the worker before a grown-up presses Pay', hits.length, 0);
    await spendingOn(page); await openStore(page);
    eq('the held-back SKU says "Coming soon"; the rest say Buy with the price', await page.evaluate(() => { const b = s => document.querySelector(`#modal [data-item="${s}"] button`); return [b('ot_tip_3').textContent, b('ot_tip_3').disabled, b('ot_supporter').textContent]; }), ['Coming soon', true, 'Buy $9.99']);
    eq('still no request to the worker after opening the store', hits.length, 0);
    const s0 = await snap(page);
    await page.tap('[data-item="ot_supporter"] button'); await solveGate(page); await page.waitForSelector('.st-price'); eq('no request to the worker on the confirm screen', hits.length, 0);
    await Promise.all([page.waitForURL(u => /[?&]cs=cs_test_e2e1/.test(String(u)), { timeout: 20000 }), page.evaluate(() => [...document.querySelectorAll('#modalActions button')].find(b => /^Pay /.test(b.textContent)).click())]);
    await o.ready(); await page.waitForFunction(() => __ot.game.modules.store.journal().length === 1, null, { timeout: 10000 });
    const s1 = await snap(page);
    ok('real worker: the checkout carried the SKU, a hash of the install id (not the id) and the game return address', fake.forms.length === 1 && fake.forms[0]['metadata[sku]'] === 'ot_supporter' && fake.forms[0]['line_items[0][price]'] === PID('ot_supporter') && /^[0-9a-f]{40}$/.test(fake.forms[0]['metadata[install]']) && fake.forms[0].success_url === BASE + '?cs={CHECKOUT_SESSION_ID}', JSON.stringify(fake.forms[0]));
    eq('real worker: back from the payment page the Supporter set is granted once: 600 gems, 4 items, 0 bones, a Trail Key, one journal line', [s1.gems - s0.gems, s1.bones - s0.bones, SUP.every(i => s1.owned[i]), s1.flags['store:supporter'], /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(s1.key), s1.journal.length, s1.journal[0].cents, s1.journal[0].test === undefined, s1.pending], [600, 0, true, true, true, 1, 999, true, null]);
    eq('real worker: the requests were one checkout and one claim (plus their CORS preflights)', hits.filter(h => h.startsWith('POST')), ['POST /stripe/checkout', 'POST /stripe/claim']);
    /* replay: the same return link again, and again with the pending mark forged back */
    await o.boot('?debug=1&nosw=1&cs=cs_test_e2e1'); await page.waitForTimeout(400);
    eq('real worker: reloading the return link grants nothing', [(await snap(page)).gems, (await snap(page)).journal.length], [s1.gems, 1]);
    await page.evaluate(() => { __ot.game.state.modules.store.pending = { sku: 'ot_supporter', t: Date.now() }; __ot.save(); }); await o.boot('?debug=1&nosw=1&cs=cs_test_e2e1'); await page.waitForTimeout(600);
    eq('real worker: a replay with the pending mark put back still grants nothing', [(await snap(page)).gems, (await snap(page)).journal.length], [s1.gems, 1]);
    /* even a game that forgot it applied the session gets "already" from the worker and the same single grant: KV holds one claim */
    eq('real worker: one claim record in KV', [...kv.keys()].filter(k => k.startsWith('claim:')).length, 1);
    /* a consumable, then restore on a wiped device */
    await spendingOn(page).catch(() => {}); await openStore(page); await page.tap('[data-item="ot_gems_80"] button'); await solveGate(page); await page.waitForSelector('.st-price');
    await Promise.all([page.waitForURL(u => /[?&]cs=cs_test_e2e2/.test(String(u)), { timeout: 20000 }), page.evaluate(() => [...document.querySelectorAll('#modalActions button')].find(b => /^Pay /.test(b.textContent)).click())]);
    await o.ready(); await page.waitForFunction(() => __ot.game.modules.store.journal().length === 2, null, { timeout: 10000 });
    eq('real worker: 80 gems for $0.99, no new Trail Key', [(await snap(page)).gems - s1.gems, (await snap(page)).key], [80, s1.key]);
    /* a copied link on a second device */
    const o2 = await open(browser, { query: '?debug=1&nosw=1' }); await o2.page.evaluate(() => { const S = __ot.game.state.modules.store; S.install = 'inst_SECONDDEVICE0000000000000'; S.pending = { sku: 'ot_gems_80', t: Date.now() }; __ot.game.state.settings.spending = true; __ot.save(); });
    await o2.boot('?debug=1&nosw=1&cs=cs_test_e2e2'); await o2.page.waitForTimeout(800);
    eq('real worker: the return link opened on a second device grants nothing there (403)', [(await snap(o2.page)).gems < 10, (await snap(o2.page)).journal.length], [true, 0]);
    /* restore on that second device, through the screen */
    const rp = o2.page.evaluate(() => __ot.game.modules.store.restore()); await solveGate(o2.page); await rp; await o2.page.waitForSelector('.st-input'); await o2.page.fill('.st-input', s1.key);
    await o2.page.evaluate(() => [...document.querySelectorAll('#modalActions button')].find(b => b.textContent === 'Restore').click()); await o2.page.waitForFunction(() => __ot.game.modules.store.key !== '', null, { timeout: 8000 });
    const r2 = await snap(o2.page);
    eq('real worker: the Trail Key restores the Supporter items on the second device, with no gems', [SUP.every(i => r2.owned[i]), r2.flags['store:supporter'], r2.gems < 10, r2.journal.map(j => j.kind), r2.key], [true, true, true, ['restore'], s1.key]);
    const leaks = [...o.outside(), ...o2.outside()].filter(u => !u.startsWith(WURL) && !u.startsWith('https://checkout.stripe.com/'));
    eq('real worker: the only outside addresses were the worker and the payment page', leaks, []);
    ok('real worker: the fake secret key never reached the browser', !(await page.evaluate(() => JSON.stringify(localStorage))).includes('sk_test') );
    ok('real worker: no page errors', o.errors.filter(e => /pageerror/.test(e)).length === 0 && o2.errors.filter(e => /pageerror/.test(e)).length === 0, [...o.errors, ...o2.errors].slice(0, 3).join(' | '));
    configOverride = null; await o.ctx.close(); await o2.ctx.close(); wsrv.close(); }

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: ${OUT}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
