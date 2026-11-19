/* KC: Open Trail channel test (Playwright + Chromium): js/channel.js and the faces of js/store.js (web, Play, iOS).
     NODE_PATH=$(npm root -g) node tests/play.test.js [screenshot-folder]
   Run from site/games/kc-open-trail. Google Play's Digital Goods API and Payment Request sheet are faked in the page.
   It proves:
     1. channel detection (pure function): ?src=play, the Android referrer, the session, the installed app; a browser tab is the web
     2. the files a Trusted Web Activity needs: manifest fields and icons, the offline shell lists the new file, the config default
     3. WEB channel: no real-money store at all (owner decision: Google Play Billing only, no Stripe), even with a filled-in config;
        Google Play is never asked, the privacy policy is one tap from Settings; the localhost test double still works for the tests
     4. PLAY channel as shipped (PLAY_BILLING 'off'): no store, no price, no Stripe, no request anywhere, a Stripe return link is ignored;
        the real-gear shelf, its link out and the claim are not in the build (PLAY_REAL_GEAR 'off'); with it 'on' they sit behind the switch and the gate
     5. PLAY channel with Google Play Billing on (pretend worker): prices come from Google Play, an item Google does not return
        says "Coming soon", the gate and the two steps are kept, every SKU grants exactly its contents and never a bone, replays and
        wrong / pending / refunded / foreign tokens grant nothing, the device limit holds, restore works through listPurchases
     6. PLAY channel without the Digital Goods API: every item says "Coming soon" and nothing can be bought
     7. PLAY channel against the REAL worker code (worker/dewclaw-worker.js run locally, Google faked): buy, replay, restore
     8. IOS channel (?src=ios or the flag the iOS shell injects): like PLAY with billing off, for good: no store, no price,
        no word of buying elsewhere, even with Google Play Billing switched on in the config and in the test double
   Exits non-zero if any check fails. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..'), WORKER = path.resolve(ROOT, '../../../worker/dewclaw-worker.js');
const OUT = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'kc-open-trail-play-shots'));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
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
const MOCK_KV = 'kc-open-trail-store-mock';

const F = ['hat:moss-beanie', 'bandana:fern', 'collar:cedar', 'trail:firefly', 'skin:skateboard:forest', 'skin:canoe:forest', 'skin:van:forest', 'decor:mushroom-lamp'];
const G = ['hat:comet-cap', 'bandana:starfield', 'collar:nebula', 'trail:stardust', 'skin:skateboard:galaxy', 'skin:canoe:galaxy', 'skin:van:galaxy', 'decor:moon-lamp'];
const R = ['hat:road-visor', 'bandana:route-stripe', 'collar:mile-marker', 'trail:dust', 'skin:skateboard:roadtrip', 'skin:canoe:roadtrip', 'skin:van:roadtrip', 'decor:roadside-sign'];
const H = ['hat:pumpkin-patch', 'bandana:candy-corn', 'collar:cobweb', 'trail:ember', 'skin:skateboard:spooky', 'skin:canoe:spooky', 'skin:van:spooky', 'decor:jack-lantern'];
const SUP = ['tag:supporter', 'bandana:supporter', 'den:gold-trim', 'frame:supporter'];
/* sku -> [US cents, gems, items] from the spec */
const SPEC = {
  ot_gems_80: [99, 80, []], ot_gems_500: [499, 500, []], ot_gems_1200: [999, 1200, []], ot_gems_2600: [1999, 2600, []], ot_gems_7000: [4999, 7000, []],
  ot_starter: [499, 400, ['bandana:first-trail', 'tag:first-trail', 'trail:sunbeam', 'skin:skateboard:first-trail']], ot_trail_pass: [599, 0, ['pass:trail']],
  ot_pack_forest: [399, 0, F], ot_pack_galaxy: [399, 0, G], ot_pack_roadtrip: [399, 0, R], ot_pack_halloween: [399, 0, H],
  ot_treat_3: [199, 0, ['treat:3']], ot_treat_10: [499, 0, ['treat:10']], ot_supporter: [999, 600, SUP],
  ot_everything: [2499, 600, ['pass:trail', ...F, ...G, ...R, ...H, ...SUP]], ot_tip_3: [300, 0, ['tag:good-human']]
};
const SKUS = Object.keys(SPEC), CONSUMABLE = SKUS.filter(k => /^ot_(gems|treat|tip)_/.test(k)), PERMANENT = SKUS.filter(k => !CONSUMABLE.includes(k));

/* the pretend Google Play inside the page. cfg: { skus: [ids Google returns], prefix: token prefix }. Prices are NOT the catalogue's dollars
   (euros, eleven cents more), so a price on screen can only have come from here. */
function fakePlay(cfg) {
  const D = window.__dg = { cfg, service: 0, details: 0, lists: 0, consumed: [], shown: [], completed: [], purchases: [], cancel: false, nextToken: '', n: 0 };
  const cents = { ot_gems_80: 99, ot_gems_500: 499, ot_gems_1200: 999, ot_gems_2600: 1999, ot_gems_7000: 4999, ot_starter: 499, ot_trail_pass: 599, ot_pack_forest: 399, ot_pack_galaxy: 399, ot_pack_roadtrip: 399, ot_pack_halloween: 399, ot_treat_3: 199, ot_treat_10: 499, ot_supporter: 999, ot_everything: 2499, ot_tip_3: 300 };
  window.getDigitalGoodsService = async method => {
    D.service++; if (method !== 'https://play.google.com/billing') throw new Error('unsupported payment method');
    return {
      async getDetails(ids) { D.details++; return ids.filter(i => D.cfg.skus.includes(i)).map(i => ({ itemId: i, title: i, description: '', price: { currency: 'EUR', value: ((cents[i] + 11) / 100).toFixed(2) } })); },
      async listPurchases() { D.lists++; return D.purchases.map(p => ({ ...p })); },
      async consume(token) { D.consumed.push(token); D.purchases = D.purchases.filter(p => p.purchaseToken !== token); }
    };
  };
  window.PaymentRequest = class {
    constructor(methods, details) { this.m = methods; this.d = details; }
    async show() {
      const m = this.m[0], sku = m.data && m.data.sku; D.shown.push({ method: m.supportedMethods, sku, total: this.d && this.d.total && this.d.total.amount });
      if (D.cancel) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; }
      const token = D.nextToken || `${D.cfg.prefix}.${sku}.n${++D.n}x${Math.random().toString(36).slice(2, 10)}`; D.nextToken = '';
      D.purchases.push({ itemId: sku, purchaseToken: token });
      return { details: { purchaseToken: token }, complete: async s => { D.completed.push(s); } };
    }
  };
}

async function open(browser, o = {}) {
  const ctx = o.ctx || await browser.newContext({ viewport: o.viewport || { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  if (o.play && !o.ctx) await ctx.addInitScript(fakePlay, { skus: o.play.skus || SKUS, prefix: o.play.prefix || 'mockplay' });
  const page = await ctx.newPage(), errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  const q = o.query;
  const ready = async () => { await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 }); await page.evaluate(() => { __ot.start(); __ot.step(3); }); };
  const boot = async (query = q) => { await page.goto(BASE + query); await ready(); };
  await boot();
  const outside = () => requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
  return { ctx, page, errors, requests, boot, ready, outside };
}
/* a different device: empty this browser's storage (keeping the pretend server), from a page of the same origin that is not the game */
async function wipe(o, keep = [MOCK_KV]) { await o.page.goto(BASE + 'manifest.webmanifest'); await o.page.evaluate(keep => { const held = keep.map(k => [k, localStorage.getItem(k)]); localStorage.clear(); for (const [k, v] of held) if (v != null) localStorage.setItem(k, v); }, keep); await o.boot(); }
async function solveGate(page) {
  await page.waitForSelector('.gateq b', { timeout: 8000 });
  const m = (await page.textContent('.gateq b')).match(/(\d+)\s*×\s*(\d+)/), ans = String(m[1] * m[2]);
  for (const ch of ans) await page.tap(`.keypad [data-key="${ch}"]`);
  await page.tap('.keypad [data-key="ok"]');
  await page.waitForFunction(() => !__ot.game.ui.current || __ot.game.ui.current.id !== 'gate', null, { timeout: 5000 });
}
const spendingOn = async page => { const p = page.evaluate(() => __ot.game.grownUp.setSpending(true)); await solveGate(page); return p; };
const openStore = async page => { await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.shop.open('store'); }); await page.tap('[data-act="open-store"]'); await solveGate(page); await page.waitForSelector('[data-item="ot_gems_80"]'); };
const snap = page => page.evaluate(() => { const g = __ot.game, s = g.state, st = g.modules.store; return { bones: s.wallet.bones, gems: s.wallet.gems, owned: { ...s.owned }, journal: st.journal(), key: st.key, spent: st.spent30() }; });
const gateCount = page => page.evaluate(() => { if (!window.__gates) { window.__gates = []; __ot.game.on('gate', e => window.__gates.push(!!(e && e.ok))); } return window.__gates.length; });
const layout = page => page.evaluate(() => { const m = document.getElementById('modal'), body = document.getElementById('modalBody'), small = [];
  for (const b of m.querySelectorAll('button, input:not([type=checkbox]):not([type=range]), a.btn')) { const r = b.getBoundingClientRect(); if (r.width && r.height && (r.height < 43.5 || r.width < 43.5)) small.push((b.textContent || b.className).trim().slice(0, 20) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
  return { small, sideways: body.scrollWidth > body.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1 }; });
/* every word a player can read in the Shop screen's tabs and in Settings */
const allText = page => page.evaluate(async () => { const g = __ot.game, out = {}; g.ui.closeAll();
  for (const t of g.shop.tabs.map(t => t.id)) { g.shop.open(t); await new Promise(r => setTimeout(r, 60)); out['tab:' + t] = document.getElementById('modal').textContent; }
  g.ui.closeAll(); g.ui.settings(); out.settings = document.getElementById('modal').textContent; g.ui.closeAll(); return out; });
const MONEY = /[$€£¥]|\bUSD\b|\bdollars?\b/i, ELSEWHERE = /\bStripe\b|[Cc]heckout|by card|payment page|[Bb]uy .{0,24}(web|site)\b|on the website/;

(async () => {
  await new Promise(r => server.listen(0, r)); BASE = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  console.log('play test on ' + BASE);

  /* ---------- 1. channel detection, as a pure function ---------- */
  { const { detectChannel, CHANNEL_KEY } = await import('file://' + path.join(ROOT, 'js/channel.js'));
    const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
    const win = (o = {}) => ({ location: { search: o.search || '' }, document: { referrer: o.referrer || '' }, sessionStorage: o.session || store(), localStorage: o.local || store(), matchMedia: q => ({ matches: q === '(display-mode: browser)' ? o.tab !== false : false }) });
    eq('a plain browser tab is the web', detectChannel(win()), 'web');
    { const w = win({ search: '?src=play', tab: false }); eq('?src=play in the installed app is the Play app', detectChannel(w), 'play'); eq('... and it is remembered for the session and for later launches', [w.sessionStorage.getItem(CHANNEL_KEY), w.localStorage.getItem(CHANNEL_KEY)], ['play', 'play']); }
    { const local = store(), w = win({ search: '?src=play', local }); eq('?src=play is the Play app even in a browser tab', detectChannel(w), 'play'); eq('... remembered for that tab only, not for later launches', [w.sessionStorage.getItem(CHANNEL_KEY), local.getItem(CHANNEL_KEY)], ['play', null]);
      eq('... so a web app installed later from that browser is still the web', detectChannel(win({ local, tab: false })), 'web'); }
    { const OURS = 'android-app://com.kcbeyondlimits.kcopentrail', local = store(), w = win({ search: '?src=play', referrer: OURS + '/', local, tab: true });
      eq('the Play app shown as a Custom Tab (link check not passed yet), start address: the Play app, remembered', [detectChannel(w), local.getItem(CHANNEL_KEY)], ['play', 'play']);
      eq('the Play app shown as a Custom Tab, opened by a link with no ?src=play: still the Play app', [detectChannel(win({ referrer: OURS + '/', tab: true })), detectChannel(win({ referrer: OURS, tab: true }))], ['play', 'play']);
      eq('another app whose package name only starts the same way is not ours', detectChannel(win({ referrer: OURS + 'x/', tab: true })), 'web'); }
    eq('?src=web, ?src= and other words are the web', ['?src=web', '?src=', '?src=PLAY', '?source=play', '?debug=1'].map(s => detectChannel(win({ search: s }))), ['web', 'web', 'web', 'web', 'web']);
    eq('opened by an Android app and not in a browser tab: the Play app', detectChannel(win({ referrer: 'android-app://com.example.opentrail/', tab: false })), 'play');
    { const w = win({ referrer: 'android-app://com.google.android.gm/', tab: true }); eq('a link tapped in another Android app that opens a browser tab is the web', detectChannel(w), 'web'); eq('... and nothing is remembered', [w.sessionStorage.getItem(CHANNEL_KEY), w.localStorage.getItem(CHANNEL_KEY)], [null, null]); }
    eq('an https referrer is the web', detectChannel(win({ referrer: 'https://example.com/', tab: false })), 'web');
    { const w = win({ session: store({ [CHANNEL_KEY]: 'play' }) }); eq('the same tab after a reload without the query stays the Play app', detectChannel(w), 'play'); eq('... a session alone does not mark later launches', w.localStorage.getItem(CHANNEL_KEY), null); }
    eq('a later launch of the installed app (no query, no referrer, not a tab) is still the Play app', detectChannel(win({ local: store({ [CHANNEL_KEY]: 'play' }), tab: false })), 'play');
    eq('Chrome on the same phone shares storage with the app but is a browser tab: the web', detectChannel(win({ local: store({ [CHANNEL_KEY]: 'play' }), tab: true })), 'web');
    eq('an installed web app that was never the Play app is the web', detectChannel(win({ tab: false })), 'web');
    /* the iOS app (ios/kc-open-trail): the injected flag, ?src=ios, and remembering */
    { const local = store(), w = { ...win({ local, tab: false }), KC_IOS_APP: true }; eq('the flag the iOS shell injects is the iOS app', detectChannel(w), 'ios'); eq('... remembered for the session and for later launches', [w.sessionStorage.getItem(CHANNEL_KEY), local.getItem(CHANNEL_KEY)], ['ios', 'ios']);
      eq('... a later launch with no flag and no query (not a tab) is still the iOS app', detectChannel(win({ local, tab: false })), 'ios');
      eq('... but a browser tab sharing that storage is the web', detectChannel(win({ local, tab: true })), 'web'); }
    eq('the injected flag wins even in what looks like a browser tab', detectChannel({ ...win({ tab: true }), KC_IOS_APP: true }), 'ios');
    eq('the Dewclaw iOS app\'s flag also counts as an App Store app', detectChannel({ ...win(), DEWCLAW_IOS_APP: true }), 'ios');
    eq('a flag that is not exactly true does not count', ['1', 'true', 1, {}].map(v => detectChannel({ ...win(), KC_IOS_APP: v })), ['web', 'web', 'web', 'web']);
    { const w = win({ search: '?src=ios', tab: false }); eq('?src=ios in the installed app is the iOS app, remembered', [detectChannel(w), w.sessionStorage.getItem(CHANNEL_KEY), w.localStorage.getItem(CHANNEL_KEY)], ['ios', 'ios', 'ios']); }
    { const local = store(), w = win({ search: '?src=ios', local }); eq('?src=ios in a browser tab: the iOS app for that tab only', [detectChannel(w), w.sessionStorage.getItem(CHANNEL_KEY), local.getItem(CHANNEL_KEY)], ['ios', 'ios', null]); }
    eq('?src=IOS and ?src=iphone are the web', ['?src=IOS', '?src=iphone', '?source=ios'].map(s => detectChannel(win({ search: s }))), ['web', 'web', 'web']);
    eq('a reload in the same tab stays the iOS app', detectChannel(win({ session: store({ [CHANNEL_KEY]: 'ios' }) })), 'ios');
    { const w = { ...win({ session: store({ [CHANNEL_KEY]: 'play' }), local: store({ [CHANNEL_KEY]: 'play' }), tab: false }), KC_IOS_APP: true };
      eq('the iOS flag wins over a remembered Play app, and replaces what is remembered', [detectChannel(w), w.sessionStorage.getItem(CHANNEL_KEY), w.localStorage.getItem(CHANNEL_KEY)], ['ios', 'ios', 'ios']); }
    eq('blocked storage with ?src=ios still gives the iOS app', detectChannel({ location: { search: '?src=ios' }, document: {}, get sessionStorage() { throw new Error('blocked'); }, get localStorage() { throw new Error('blocked'); } }), 'ios');
    const broken = { location: { search: '?src=play' }, document: {}, get sessionStorage() { throw new Error('blocked'); }, get localStorage() { throw new Error('blocked'); } };
    eq('blocked storage and no matchMedia do not break it', [detectChannel(broken), detectChannel({})], ['play', 'web']); }

  /* ---------- 2. the files ---------- */
  { const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), man = JSON.parse(read('manifest.webmanifest')), sw = read('sw.js'), cfg = read('js/store-config.js'), src = read('js/store.js'), chan = read('js/channel.js');
    ok('manifest: name, short_name, start_url and scope inside this folder', man.name === 'KC: Open Trail' && man.short_name.length <= 12 && man.start_url === './' && man.scope === './');
    ok('manifest: display is fullscreen or standalone, any orientation, theme and background colours', ['fullscreen', 'standalone'].includes(man.display) && man.orientation === 'any' && /^#[0-9a-f]{6}$/i.test(man.theme_color) && /^#[0-9a-f]{6}$/i.test(man.background_color));
    const icons = man.icons.map(i => { const b = fs.readFileSync(path.join(ROOT, i.src)); return { sizes: i.sizes, purpose: i.purpose, png: b.slice(1, 4).toString() === 'PNG', w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; });
    ok('manifest: real 192 and 512 PNG icons and a 512 maskable one', icons.every(i => i.png && i.sizes === `${i.w}x${i.h}`) && icons.some(i => i.w === 192 && i.purpose === 'any') && icons.some(i => i.w === 512 && i.purpose === 'any') && icons.some(i => i.w === 512 && i.purpose === 'maskable'), JSON.stringify(icons));
    ok('the offline shell lists js/channel.js', sw.includes('"./js/channel.js"'));
    ok('index.html links the manifest and registers nothing outside this folder', /<link rel="manifest" href="manifest\.webmanifest">/.test(read('index.html')) && /serviceWorker\.register\('sw\.js'\)/.test(read('js/main.js')));
    ok('store-config.js ships with Google Play Billing off', /export const PLAY_BILLING = 'off';/.test(cfg));
    ok('channel.js makes no request and reads nothing but the address, the referrer and its one stored word', !/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.userAgent|cookie/.test(chan));
    eq('store.js still makes exactly one kind of network call, to the worker', (src.match(/\bfetch\s*\(/g) || []).length, 1);
    ok('no analytics, adverts or tracking code anywhere in js/', fs.readdirSync(path.join(ROOT, 'js')).every(f => !/googletagmanager|google-analytics|gtag\(|doubleclick|admob|facebook\.net|sendBeacon/.test(read('js/' + f)))); }

  /* ---------- 3. the web channel: no store at all (owner decision 2026-11-19: Google Play Billing only, no Stripe) ---------- */
  { const o = await open(browser, { query: '?debug=1&nosw=1', play: {} }), { page } = o;
    const a = await page.evaluate(() => { const g = __ot.game, st = g.modules.store; return { ch: g.channel, ot: __ot.channel, st: st.channel, has: st.hasStore, pb: st.playBilling, usd: g.showUsd, tabs: g.shop.tabs.map(t => t.id), off: g.grownUp.storeOff, label: g.grownUp.switchLabel, any: st.catalog.some(c => st.sellable(c.sku)), prices: st.catalog.map(c => st.price(c.sku)).join('') }; });
    eq('web: the channel is web, there is no real-money store, nothing is sellable, Google Play Billing is not in play, no dollar hints', [a.ch, a.ot, a.st, a.has, a.pb, a.usd, a.off, a.label, a.any], ['web', 'web', 'web', false, false, false, true, 'Real KC gear shelf (grown-ups only)', false]);
    ok('web: no Store tab; the Trail Journal and the KC Gear tab are there', !a.tabs.includes('store') && a.tabs.includes('journal') && a.tabs.includes('merch'), a.tabs.join(','));
    await page.evaluate(() => __ot.game.ui.settings());
    const set = await page.evaluate(() => { const a = document.querySelector('[data-set="privacy"]'), r = a && a.getBoundingClientRect(); return a ? { href: a.getAttribute('href'), same: new URL(a.href).origin === location.origin, tag: a.tagName, h: Math.round(r.height) >= 44, label: a.closest('.set').querySelector('span').textContent, rows: [...document.querySelectorAll('[data-set]')].map(e => e.getAttribute('data-set')) } : null; });
    ok('web: Settings has a "Privacy policy" link to /kc-open-trail/privacy.html on the same origin, 44 px tall', set && set.href === '/kc-open-trail/privacy.html' && set.same && set.tag === 'A' && set.h && set.label === 'Privacy policy', JSON.stringify(set));
    ok('web: Settings keeps the grown-ups switch (for the real-gear shelf) and has no limit or restore rows', set && set.rows.includes('spending') && !set.rows.includes('store-limit') && !set.rows.includes('store-restore'), set && set.rows.join(','));
    await page.screenshot({ path: path.join(OUT, 'web-settings-390.png') });
    await page.evaluate(() => __ot.game.ui.closeAll());
    eq('web: open(), buy(), restore(), the limit screen and setLimit all refuse, with no gate shown', await page.evaluate(async () => { const st = __ot.game.modules.store; return [await st.open(), await st.buy('ot_gems_80'), await st.restore(), await st.limitScreen(), await st.setLimit(1000), !!__ot.game.ui.current]; }), [false, false, false, false, false, false]);
    for (const sw of [false, true]) { if (sw) await spendingOn(page);
      const text = await allText(page), bad = Object.entries(text).filter(([k, t]) => k !== 'tab:merch' && (MONEY.test(t) || ELSEWHERE.test(t) || /can also buy|Real-money|Restore purchases/.test(t))).map(([k, t]) => k + ': ' + ((t.match(MONEY) || t.match(ELSEWHERE) || t.match(/can also buy|Real-money|Restore purchases/) || [''])[0]));
      ok(`web, switch ${sw ? 'on' : 'off'}: no money sign, no Stripe, no "can also buy" and no store rows in any Shop tab or in Settings`, bad.length === 0, bad.join('; '));
      ok(`web, switch ${sw ? 'on' : 'off'}: the Trail Journal has no pass column`, !/Pass/.test(text['tab:journal'])); }
    eq('web: the Wardrobe note about gems does not say they can be bought', await page.evaluate(() => { __ot.game.shop.open('wardrobe'); const t = document.getElementById('modal').textContent, m = t.match(/Gems come free[^.]*\.[^.]*\./); __ot.game.ui.closeAll(); return m ? m[0] : 'no note'; }), 'Gems come free from golden balls, new places and the daily sniff-outs. Any gem price can be paid in bones instead, at 50 bones a gem.');
    eq('web: Google Play was never asked for anything', await page.evaluate(() => [__dg.service, __dg.details, __dg.lists, __dg.shown.length]), [0, 0, 0, 0]);
    eq('web: nothing was requested outside the game', o.outside(), []); eq('web: no console errors', o.errors, []);
    await o.ctx.close(); }
  { /* even with a worker address and Stripe price ids filled in, the web sells nothing, asks no server and ignores a Stripe return link */
    const shipped = fs.readFileSync(path.join(ROOT, 'js/store-config.js'), 'utf8');
    configOverride = shipped.replace("export const WORKER_URL = 'OWNER_FILLS_IN';", "export const WORKER_URL = 'https://worker.invalid';").replace(/'OWNER_FILLS_IN'(,?\s*\/\*)/g, (m, c) => "'price_TESTabcdef123456'" + c);
    ok('the filled-in test config has a worker address and 16 price ids', configOverride.includes('worker.invalid') && (configOverride.match(/price_TESTabcdef123456/g) || []).length === 16);
    const o = await open(browser, { query: '?debug=1&nosw=1', play: {} }), { page } = o;
    await page.evaluate(() => { const S = __ot.game.state.modules.store; S.install = 'inst_AAAAAAAAAAAAAAAAAAAAAAAA'; S.pending = { sku: 'ot_gems_7000', t: Date.now() }; __ot.game.state.settings.spending = true; __ot.save(); });
    const g0 = await page.evaluate(() => __ot.game.state.wallet.gems);
    await o.boot('?debug=1&nosw=1&cs=cs_test_abcdefgh1234'); await page.waitForTimeout(600);
    const r = await page.evaluate(g0 => { const g = __ot.game, st = g.modules.store; return [st.live, st.hasStore, st.catalog.some(c => st.sellable(c.sku)), g.shop.tabs.some(t => t.id === 'store'), new URLSearchParams(location.search).has('cs'), g.state.wallet.gems - g0 < 7000, st.journal().length]; }, g0);
    eq('web, filled-in config: still no store, nothing sellable, the return link is dropped and grants nothing', r, [true, false, false, false, false, true, 0]);
    eq('web, filled-in config: buy() refuses every item', await page.evaluate(async () => { const st = __ot.game.modules.store, out = []; for (const c of st.catalog) out.push(await st.buy(c.sku)); return out.every(v => v === false); }), true);
    eq('web, filled-in config: nothing was requested outside the game (no worker, no Stripe)', o.outside(), []);
    configOverride = null; await o.ctx.close(); }
  {
    /* the localhost-only test double (?debug=1&mock=1) still runs the old Stripe path, which the store tests use; the live site never can */
    const m = await open(browser, { query: '?debug=1&nosw=1&mock=1', play: {} });
    await spendingOn(m.page); const before = await snap(m.page);
    ok('web (localhost test double): a pretend purchase is granted as before', await m.page.evaluate(() => __ot.game.modules.store.debug.buy('ot_gems_80')) === true && (await snap(m.page)).gems === before.gems + 80);
    eq('web (test mode): the Play path refuses to run on the web', await m.page.evaluate(async () => { const d = __ot.game.modules.store.debug; return [await d.payPlay('ot_gems_80'), await d.claimPlay('ot_gems_80', 'mockplay.ot_gems_80.abc123'), await d.playSync(true), __dg.service, __dg.shown.length]; }), [false, 'failed', null, 0, 0]);
    await m.ctx.close(); }

  /* ---------- 4. the Play channel as shipped: no store ---------- */
  { const o = await open(browser, { query: '?src=play&debug=1&nosw=1', play: {} }), { page } = o;
    const a = await page.evaluate(() => { const g = __ot.game, st = g.modules.store; return { ch: g.channel, st: st.channel, has: st.hasStore, pb: st.playBilling, usd: g.showUsd, tabs: g.shop.tabs.map(t => t.id), off: g.grownUp.storeOff, sw: g.grownUp.showSwitch, real: g.modules.merch.realGear, spending: g.grownUp.spending, any: st.catalog.some(c => st.sellable(c.sku)), prices: st.catalog.map(c => st.price(c.sku)).join('') }; });
    eq('play (shipped): the channel is play and there is no store', [a.ch, a.st, a.has, a.pb, a.usd, a.off, a.any, a.prices], ['play', 'play', false, false, false, true, false, '']);
    ok('play (shipped): no Store tab; the Trail Journal and the KC Gear tab are still there', !a.tabs.includes('store') && a.tabs.includes('journal') && a.tabs.includes('merch'), a.tabs.join(','));
    ok('play (shipped): spending is off and Settings gets no real-money or real-gear switch', a.spending === false && a.sw === false && a.real === false);
    const gates = await gateCount(page);
    eq('play (shipped): open(), buy(), restore(), the limit screen and setLimit all refuse, with no gate shown', await page.evaluate(async () => { const st = __ot.game.modules.store; return [await st.open(), await st.buy('ot_gems_80'), await st.restore(), await st.limitScreen(), await st.setLimit(1000), !!__ot.game.ui.current]; }), [false, false, false, false, false, false]);
    let text = await allText(page);
    ok('play (shipped), switch off: no money sign and no word of Stripe, cards or buying elsewhere in any Shop tab', Object.entries(text).filter(([k]) => k !== 'settings').every(([, t]) => !MONEY.test(t) && !ELSEWHERE.test(t)), Object.entries(text).filter(([, t]) => MONEY.test(t) || ELSEWHERE.test(t)).map(([k, t]) => k + ': ' + ((t.match(MONEY) || t.match(ELSEWHERE) || [''])[0])).join('; '));
    ok('play (shipped): Settings has the privacy policy and no switch, limit or restore rows', /Privacy policy/.test(text.settings) && !/Real KC gear|Real-money|Restore purchases|limit|grown-up/i.test(text.settings), text.settings.slice(0, 600));
    { const SELL = /grown-?up|\bcan also buy\b|real (KC )?gear|real thing|website|\bclaim|Beyond Limits|kcbeyondlimits|\btwins?\b/i, bad = Object.entries(text).filter(([, t]) => SELL.test(t)).map(([k, t]) => k + ': ' + t.match(SELL)[0]);
      ok('play (shipped): no Shop tab or Settings line speaks of buying, grown-ups, real products, a website, a claim or a twin', bad.length === 0, bad.join('; ')); }
    eq('play (shipped): the Wardrobe note about gems does not say they can be bought', await page.evaluate(() => { __ot.game.shop.open('wardrobe'); const t = document.getElementById('modal').textContent, m = t.match(/Gems come free[^.]*\.[^.]*\./); __ot.game.ui.closeAll(); return m ? m[0] : 'no note'; }), 'Gems come free from golden balls, new places and the daily sniff-outs. Any gem price can be paid in bones instead, at 50 bones a gem.');
    eq('play (shipped): the KC Gear tab is the 14 bones-only items: no grown-ups box, no claim button, no link, no winter shelf', await page.evaluate(() => { __ot.game.modules.merch.open(); const b = document.getElementById('modalBody'); const r = [b.querySelectorAll('.item[data-item]').length, b.querySelectorAll('.mgrown, .mgrown button, a, iframe, img, .mreal').length, [...b.querySelectorAll('.sech')].some(h => h.dataset.shelf === 'winter' || h.dataset.shelf === 'grownups'), !!__ot.game.place.get('merch:shelf:winter')]; __ot.game.ui.closeAll(); return r; }), [14, 0, false, false]);
    await page.evaluate(() => __ot.game.ui.settings()); await page.screenshot({ path: path.join(OUT, 'play-off-settings-390.png') });
    eq('play (shipped): Settings buttons are 44 px and nothing scrolls sideways', await layout(page), { small: [], sideways: false });
    eq('play (shipped): the privacy link stays in this window (no new tab inside the app)', await page.evaluate(() => { const a = document.querySelector('[data-set="privacy"]'); return [a.getAttribute('href'), a.target]; }), ['/kc-open-trail/privacy.html', '']);
    await page.evaluate(() => __ot.game.ui.closeAll());
    /* the real-gear side is not part of this build: nothing opens, with the switch off or (forced through the API) on, and no gate is ever shown */
    eq('play (shipped): the real-gear list, a product page and the claim screen do not open and no gate is shown', [await page.evaluate(async () => { const m = __ot.game.modules.merch; return [await m.openReal(), await m.openProduct('34341309'), await m.openClaim(), !!__ot.game.ui.current]; }), await gateCount(page) - gates], [[false, false, false, false], 0]);
    ok('play (shipped): even with the spending setting forced on, they still do not open', await spendingOn(page) === true);
    eq('play (shipped): ... real-gear list, product page, claim', await page.evaluate(async () => { const m = __ot.game.modules.merch; return [await m.openReal(), await m.openProduct('34341309'), await m.openClaim(), __ot.game.ui.current ? __ot.game.ui.current.id : null]; }), [false, false, false, null]);
    await page.evaluate(() => __ot.game.ui.closeAll());
    text = await allText(page);
    ok('play (shipped), switch on: still no Store, no pass column and no price in the Trail Journal', !('tab:store' in text) && !/Pass/.test(text['tab:journal']) && !MONEY.test(text['tab:journal']));
    ok('play (shipped), switch on: gem prices carry no "about $" hint anywhere in the Shop', Object.entries(text).every(([, t]) => !/is about|about \$/.test(t)));
    eq('play (shipped): the journal tab shows 30 steps', await page.evaluate(() => { __ot.game.shop.open('journal'); return document.querySelectorAll('.tj-row[data-step]').length; }), 30);
    await page.screenshot({ path: path.join(OUT, 'play-off-journal-390.png') });
    eq('play (shipped): Google Play was never asked and nothing left the game', [await page.evaluate(() => [__dg.service, __dg.details, __dg.lists, __dg.shown.length].join()), o.outside().length], ['0,0,0,0', 0]);
    /* the channel is remembered in this tab, and a Stripe return link means nothing here */
    await o.boot('?debug=1&nosw=1&cs=cs_test_a1b2c3d4e5');
    eq('play (shipped): a reload without ?src=play is still the Play app, and a Stripe return link is dropped unasked', await page.evaluate(() => [__ot.game.channel, __ot.game.modules.store.hasStore, new URLSearchParams(location.search).has('cs'), __ot.game.modules.store.pending]), ['play', false, false, null]);
    await page.waitForTimeout(400);
    eq('play (shipped): still nothing requested outside the game, and no console errors', [o.outside(), o.errors], [[], []]);
    await o.ctx.close(); }
  { /* the owner's choice PLAY_REAL_GEAR = 'on': the grown-ups' shelf comes back, behind the switch and then the gate */
    const shipped = fs.readFileSync(path.join(ROOT, 'js/store-config.js'), 'utf8');
    configOverride = shipped.replace("export const PLAY_REAL_GEAR = 'off';", "export const PLAY_REAL_GEAR = 'on';");
    ok('store-config.js ships with the real-gear shelf off in the Play app', configOverride !== shipped);
    const o = await open(browser, { query: '?src=play&debug=1&nosw=1', play: {} }), { page } = o, gates = await gateCount(page);
    const a = await page.evaluate(() => { const g = __ot.game; g.ui.settings(); const t = document.getElementById('modal').textContent; g.ui.closeAll(); return [g.channel, g.modules.store.hasStore, g.modules.merch.realGear, g.grownUp.showSwitch, g.grownUp.storeOff, /Real KC gear shelf \(grown-ups only\)/.test(t), /Real-money|Restore purchases/.test(t)]; });
    eq('play, real gear on: still no store; Settings has the one switch, worded for what it does', a, ['play', false, true, true, true, true, false]);
    eq('play, real gear on: with the switch off the real-gear list does not open and no gate is shown', [await page.evaluate(() => __ot.game.modules.merch.openReal()), await gateCount(page) - gates], [false, 0]);
    ok('play, real gear on: a grown-up turns the switch on through the gate', await spendingOn(page) === true);
    { const p = page.evaluate(() => __ot.game.modules.merch.openReal()); await solveGate(page); const opened = await p; const t = await page.evaluate(() => (__ot.game.ui.current ? __ot.game.ui.current.id : '') + '|' + document.getElementById('modal').textContent);
      ok('play, real gear on: the real-gear list opens only after the gate, and says it is a separate website and real money', opened === true && /^merch-real\|/.test(t) && /separate website/.test(t) && /real money/.test(t), t.slice(0, 200)); }
    eq('play, real gear on: nothing left the game', o.outside().length, 0);
    configOverride = null; await o.ctx.close(); }
  { /* the pretend-server mode cannot switch a store on by itself when billing is asked off, and a normal session has no test hooks */
    const o = await open(browser, { query: '?src=play&debug=1&nosw=1&mock=1&billing=off', play: {} });
    eq('play (test mode, billing off): no store', await o.page.evaluate(() => [__ot.game.modules.store.hasStore, __ot.game.shop.tabs.some(t => t.id === 'store')]), [false, false]); await o.ctx.close();
    const n = await open(browser, { query: '?src=play&debug=1&nosw=1', play: {} });
    eq('play (shipped): no test hooks on the store', await n.page.evaluate(() => 'debug' in __ot.game.modules.store), false); await n.ctx.close(); }

  /* ---------- 8. the iOS channel: like the Play app with billing off, for good ---------- */
  { const shipped = fs.readFileSync(path.join(ROOT, 'js/store-config.js'), 'utf8');
    const filled = shipped.replace("export const WORKER_URL = 'OWNER_FILLS_IN';", "export const WORKER_URL = 'https://worker.invalid';").replace("export const PLAY_BILLING = 'off';", "export const PLAY_BILLING = 'on';");
    ok('the iOS test config switches Google Play Billing on and fills in a worker', filled.includes("PLAY_BILLING = 'on'") && filled.includes('worker.invalid'));
    for (const [how, query, flag, cfg] of [['?src=ios', '?src=ios&debug=1&nosw=1', false, null], ['the injected flag', '?debug=1&nosw=1', true, null], ['the injected flag, billing on in the config', '?debug=1&nosw=1', true, filled], ['?src=ios, test double', '?src=ios&debug=1&nosw=1&mock=1', false, null]]) {
      configOverride = cfg;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
      await ctx.addInitScript(fakePlay, { skus: SKUS, prefix: 'mockplay' });
      if (flag) await ctx.addInitScript(() => { window.KC_IOS_APP = true; });
      const o = await open(browser, { ctx, query }), { page } = o;
      const a = await page.evaluate(() => { const g = __ot.game, st = g.modules.store; return { ch: g.channel, ot: __ot.channel, st: st.channel, has: st.hasStore, pb: st.playBilling, usd: g.showUsd, tabs: g.shop.tabs.map(t => t.id), off: g.grownUp.storeOff, sw: g.grownUp.showSwitch, real: g.modules.merch.realGear, any: st.catalog.some(c => st.sellable(c.sku)), prices: st.catalog.map(c => st.price(c.sku)).join('') }; });
      eq(`ios (${how}): the channel is ios, no store, nothing sellable, no price, no dollar hint`, [a.ch, a.ot, a.st, a.has, a.pb, a.usd, a.off, a.any, a.prices], ['ios', 'ios', 'ios', false, false, false, true, false, '']);
      ok(`ios (${how}): no Store tab; the Trail Journal and the KC Gear tab are there; no switch; no real-gear shelf`, !a.tabs.includes('store') && a.tabs.includes('journal') && a.tabs.includes('merch') && a.sw === false && a.real === false, JSON.stringify(a));
      eq(`ios (${how}): open(), buy(), restore(), the limit screen and setLimit all refuse, with no gate shown`, await page.evaluate(async () => { const st = __ot.game.modules.store; return [await st.open(), await st.buy('ot_gems_80'), await st.restore(), await st.limitScreen(), await st.setLimit(1000), !!__ot.game.ui.current]; }), [false, false, false, false, false, false]);
      const text = await allText(page), SELL = /grown-?up|\bcan also buy\b|real (KC )?gear|real thing|website|\bclaim|Beyond Limits|kcbeyondlimits|\btwins?\b|Google Play|Real-money|Restore purchases/i;
      const bad = Object.entries(text).filter(([, t]) => MONEY.test(t) || ELSEWHERE.test(t) || SELL.test(t)).map(([k, t]) => k + ': ' + ((t.match(MONEY) || t.match(ELSEWHERE) || t.match(SELL) || [''])[0]));
      ok(`ios (${how}): no money sign, no Stripe, no Google Play, no buying elsewhere, no grown-ups shelf in any Shop tab or in Settings`, bad.length === 0, bad.join('; '));
      ok(`ios (${how}): Settings has the privacy policy, opening in the same window`, /Privacy policy/.test(text.settings) && await page.evaluate(() => { __ot.game.ui.settings(); const l = document.querySelector('[data-set="privacy"]'); const r = l && l.getAttribute('href') === '/kc-open-trail/privacy.html' && l.target === ''; __ot.game.ui.closeAll(); return r; }));
      eq(`ios (${how}): the real-gear list, a product page and the claim screen do not open`, await page.evaluate(async () => { const m = __ot.game.modules.merch; return [await m.openReal(), await m.openProduct('34341309'), await m.openClaim(), !!__ot.game.ui.current]; }), [false, false, false, false]);
      eq(`ios (${how}): Google Play was never asked, nothing left the game, no console errors`, [await page.evaluate(() => [__dg.service, __dg.details, __dg.lists, __dg.shown.length].join()), o.outside(), o.errors], ['0,0,0,0', [], []]);
      if (how === '?src=ios') { await o.boot('?debug=1&nosw=1'); eq('ios: a reload without ?src=ios in the same tab is still the iOS app with no store', await page.evaluate(() => [__ot.game.channel, __ot.game.modules.store.hasStore]), ['ios', false]); }
      if (how.startsWith('the injected flag') && !cfg) { await page.evaluate(() => __ot.game.ui.settings()); await page.screenshot({ path: path.join(OUT, 'ios-settings-390.png') }); }
      configOverride = null; await ctx.close(); } }

  /* ---------- 5. the Play channel with Google Play Billing on (pretend worker) ---------- */
  { const HELD = ['ot_gems_7000', 'ot_tip_3'];   /* two items Google Play does not return */
    const o = await open(browser, { query: '?src=play&debug=1&nosw=1&mock=1', play: { skus: SKUS.filter(k => !HELD.includes(k)) } }), { page } = o;
    const a = await page.evaluate(() => { const g = __ot.game, st = g.modules.store; return { ch: st.channel, has: st.hasStore, pb: st.playBilling, ready: st.playReady, tabs: g.shop.tabs.map(t => t.id), spending: g.grownUp.spending, off: g.grownUp.storeOff, any: st.catalog.some(c => st.sellable(c.sku)) }; });
    eq('play billing: the store exists, spending is off, and nothing is sellable before Google Play has been asked', [a.ch, a.has, a.pb, a.ready, a.spending, a.off, a.any, a.tabs.includes('store')], ['play', true, true, false, false, false, false, true]);
    await page.evaluate(() => __ot.game.shop.open('store'));
    eq('play billing, spending off: the Store tab shows only "Ask a grown-up to turn on the shop."', await page.evaluate(() => { const p = document.querySelector('.tabpane'); return [p.textContent.trim(), p.querySelectorAll('button').length]; }), ['Ask a grown-up to turn on the shop.', 0]);
    eq('play billing, spending off: buy and restore refuse without a gate, and Google Play has not been asked', await page.evaluate(async () => { const st = __ot.game.modules.store; return [await st.open(), await st.buy('ot_gems_80'), await st.restore(), await st.debug.payPlay('ot_gems_80'), __dg.service, __dg.shown.length]; }), [false, false, false, false, 0, 0]);
    await spendingOn(page);
    eq('play billing: turning the switch on asks Google Play nothing either', await page.evaluate(() => __dg.service), 0);
    await openStore(page);
    eq('play billing: Google Play is asked for its prices once, after the gate', await page.evaluate(() => [__dg.service, __dg.details]), [1, 1]);
    const cards = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-item]')].map(c => [c.getAttribute('data-item'), { text: c.textContent, btn: (c.querySelector('button') || {}).textContent || '', dis: !!(c.querySelector('button') || {}).disabled }])));
    ok('play billing: every returned item shows Google Play\'s price, not the catalogue\'s dollars', SKUS.filter(k => !HELD.includes(k)).every(k => { const want = '€' + ((SPEC[k][0] + 11) / 100).toFixed(2); return cards[k] && cards[k].text.includes(want) && cards[k].btn === 'Buy ' + want && !cards[k].dis && !/\$/.test(cards[k].text.replace(/\$31\.94/, '')); }), JSON.stringify(cards.ot_gems_80));
    ok('play billing: an item Google Play does not return says "Coming soon", shows no price and cannot be bought', HELD.every(k => cards[k] && cards[k].btn === 'Coming soon' && cards[k].dis && !MONEY.test(cards[k].text)) && await page.evaluate(async () => (await __ot.game.modules.store.buy('ot_gems_7000')) === false && (await __ot.game.modules.store.debug.payPlay('ot_gems_7000')) === false && __dg.shown.length === 0), JSON.stringify(cards.ot_gems_7000));
    const body = await page.textContent('#modalBody');
    ok('play billing: the store page speaks of Google Play, never of Stripe, cards or another place to buy', /Google Play/.test(body) && !ELSEWHERE.test(body), (body.match(ELSEWHERE) || [''])[0]);
    await page.screenshot({ path: path.join(OUT, 'play-store-390.png'), fullPage: false });
    eq('play billing: store buttons are 44 px and nothing scrolls sideways', await layout(page), { small: [], sideways: false });
    /* a whole purchase by touch: Buy, gate, confirm with Google's price and the exact contents, Google's sheet, thanks */
    const before = await snap(page);
    await page.tap('[data-item="ot_gems_80"] button'); await solveGate(page); await page.waitForFunction(() => __ot.game.ui.current && __ot.game.ui.current.id === 'store-confirm');
    const conf = await page.textContent('#modal');
    ok('play billing: the confirm screen shows Google Play\'s price, "real money", the exact contents and the device limit', /€1\.10/.test(conf) && /real money/.test(conf) && /through Google Play/.test(conf) && /80 gems/.test(conf) && /Device limit/.test(conf) && !ELSEWHERE.test(conf), conf.slice(0, 300));
    eq('play billing: nothing has been bought before Pay is pressed', await page.evaluate(() => __dg.shown.length), 0);
    await page.screenshot({ path: path.join(OUT, 'play-confirm-390.png') });
    await page.evaluate(() => { for (const b of document.querySelectorAll('#modalActions button')) if (/^Pay /.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => __ot.game.ui.current && __ot.game.ui.current.id === 'store-thanks', null, { timeout: 8000 });
    const after = await snap(page), dg1 = await page.evaluate(() => ({ shown: __dg.shown, consumed: __dg.consumed.length, completed: __dg.completed, left: __dg.purchases.length }));
    eq('play billing: Google\'s sheet was opened once, for that SKU, by the Play Billing method', dg1.shown.map(s => [s.method, s.sku]), [['https://play.google.com/billing', 'ot_gems_80']]);
    eq('play billing: 80 gems and no bones were added; the purchase is in the journal at the US list price for the limit', [after.gems - before.gems, after.bones - before.bones, after.journal.length, after.journal[0].sku, after.journal[0].cents, after.journal[0].price, after.journal[0].via, after.spent], [80, 0, 1, 'ot_gems_80', 99, '€1.10', 'play', 99]);
    eq('play billing: the used-up item was consumed and the sheet completed with success', [dg1.consumed, dg1.completed, dg1.left], [1, ['success'], 0]);
    ok('play billing: the thank-you names Google Play for the receipt (test mode says so)', /TEST MODE/.test(await page.textContent('#modal')));
    await page.evaluate(() => __ot.game.ui.closeAll());

    /* every SKU, token by token: exactly the catalogue contents, never a bone */
    const rows = await page.evaluate(async skus => { const g = __ot.game, d = g.modules.store.debug, out = {};
      for (const sku of skus) { const b0 = g.state.wallet.bones, g0 = g.state.wallet.gems, treats0 = g.economy.count('treat:party'), token = `mockplay.${sku}.each${Math.random().toString(36).slice(2, 10)}`;
        const r = await d.claimPlay(sku, token), again = await d.claimPlay(sku, token), c = g.modules.store.sku(sku);
        out[sku] = { r, again, bones: g.state.wallet.bones - b0, gems: g.state.wallet.gems - g0, treats: g.economy.count('treat:party') - treats0, owns: c.grant.items.filter(i => !/^treat:/.test(i)).every(i => g.economy.owns(i)) }; }
      return out; }, SKUS.filter(k => k !== 'ot_everything').concat('ot_everything'));
    ok('play billing: all 16 SKUs are granted once ("added") and a replay of the same token adds nothing ("already")', SKUS.every(k => rows[k].r === 'added' && rows[k].again === 'already'), JSON.stringify(Object.fromEntries(SKUS.map(k => [k, rows[k].r + '/' + rows[k].again]))));
    ok('play billing: no purchase ever adds a bone', SKUS.every(k => rows[k].bones === 0), JSON.stringify(Object.fromEntries(SKUS.map(k => [k, rows[k].bones]))));
    ok('play billing: gem packs add exactly their gems; every item in every set is owned afterwards', ['ot_gems_80', 'ot_gems_500', 'ot_gems_1200', 'ot_gems_2600', 'ot_gems_7000'].every(k => rows[k].gems === SPEC[k][1]) && SKUS.every(k => rows[k].owns && rows[k].gems >= SPEC[k][1]), JSON.stringify(Object.fromEntries(SKUS.map(k => [k, rows[k].gems]))));
    eq('play billing: treat packs add 3 and 10 Party Treats', [rows.ot_treat_3.treats, rows.ot_treat_10.treats], [3, 10]);
    const s1 = await snap(page);
    ok('play billing: a Trail Key was given with the permanent items', /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(s1.key), s1.key);

    /* tokens that must grant nothing */
    const bad = await page.evaluate(async () => { const g = __ot.game, d = g.modules.store.debug, w = () => JSON.stringify([g.state.wallet, Object.keys(g.state.owned).length, g.modules.store.journal().length]), w0 = w(), out = {};
      out.wrongSku = await d.claimPlay('ot_gems_7000', 'mockplay.ot_gems_80.wrong1234');
      out.pending = await d.claimPlay('ot_gems_500', 'mockplay.ot_gems_500.wait1234.pending');
      out.refunded = await d.claimPlay('ot_gems_500', 'mockplay.ot_gems_500.back1234.refunded');
      out.otherApp = await d.claimPlay('ot_gems_500', 'mockplay.ot_gems_500.away1234.otherapp');
      out.madeUp = await d.claimPlay('ot_gems_500', 'not-a-google-play-token');
      out.unknownSku = await d.claimPlay('ot_bones_500', 'mockplay.ot_bones_500.nope1234');
      out.short = await d.claimPlay('ot_gems_80', 'x');
      d.next('tamper-bones'); window.__refused = 0; g.on('storeRefused', () => window.__refused++); out.tampered = await d.claimPlay('ot_gems_80', 'mockplay.ot_gems_80.tamper123');
      d.next('offline'); out.offline = await d.claimPlay('ot_gems_80', 'mockplay.ot_gems_80.offline12');
      out.same = w() === w0; out.refusedEvents = window.__refused; return out; });
    eq('play billing: a token for another SKU, a pending, refunded, foreign, made-up or tampered purchase, and an unreachable server, all grant nothing', bad, { wrongSku: 'failed', pending: 'pending', refunded: 'pending', otherApp: 'pending', madeUp: 'pending', unknownSku: 'failed', short: 'failed', tampered: 'failed', offline: 'failed', same: true, refusedEvents: 1 });

    /* the sheet is cancelled; the device limit; the switch turned off again */
    eq('play billing: cancelling Google\'s sheet adds nothing', await page.evaluate(async () => { const g = __ot.game, g0 = g.state.wallet.gems, n = g.modules.store.journal().length; __dg.cancel = true; const r = await g.modules.store.debug.payPlay('ot_gems_500'); __dg.cancel = false; return [r, g.state.wallet.gems - g0, g.modules.store.journal().length - n, __dg.completed.length]; }), [false, 0, 0, 1]);
    { const spent = (await snap(page)).spent; ok('play billing: the limit counts every purchase at its US list price', spent === SKUS.reduce((n, k) => n + SPEC[k][0], 0) + 99, String(spent));
      const shown = await page.evaluate(() => __dg.shown.length);
      eq('play billing: over the device limit nothing is offered to Google Play at all', await page.evaluate(async () => { const st = __ot.game.modules.store; return [st.room() < 99, await st.buy('ot_gems_80'), await st.debug.payPlay('ot_gems_80'), __dg.shown.length]; }), [true, false, false, shown]); }
    await o.ctx.close();

    /* a second device signed in to the same Google account: listPurchases brings the permanent items back, without their gems */
    const d1 = await open(browser, { query: '?src=play&debug=1&nosw=1&mock=1', play: {} }); await spendingOn(d1.page); await openStore(d1.page);
    const TOK = 'mockplay.ot_supporter.keep12345', TOK2 = 'mockplay.ot_pack_forest.keep67890', GEMTOK = 'mockplay.ot_gems_500.lost12345';
    await d1.page.evaluate(async ([a, b]) => { __dg.nextToken = a; await __ot.game.modules.store.debug.payPlay('ot_supporter'); __dg.nextToken = b; await __ot.game.modules.store.debug.payPlay('ot_pack_forest'); __ot.game.ui.closeAll(); }, [TOK, TOK2]);
    const first = await snap(d1.page);
    ok('play billing: device one bought the Supporter set (600 gems) and a pack; permanent items stay on Google\'s list', first.gems >= 600 && first.owned['tag:supporter'] && first.owned['hat:moss-beanie'] && await d1.page.evaluate(() => __dg.purchases.length === 2 && __dg.consumed.length === 0));
    eq('play billing: opening the store again asks Google Play what is owned and adds nothing twice', await (async () => { const g0 = first.gems; await openStore(d1.page); await d1.page.waitForFunction(() => __dg.lists >= 2); await d1.page.waitForTimeout(300); const s = await snap(d1.page); return [s.gems - g0, s.journal.length]; })(), [0, 2]);
    await wipe(d1);   /* a new device: empty save, new install id; the pretend server and the Google account are the same */
    const blank = await snap(d1.page); await spendingOn(d1.page);
    await d1.page.evaluate(([a, b, c]) => { __dg.purchases = [{ itemId: 'ot_supporter', purchaseToken: a }, { itemId: 'ot_pack_forest', purchaseToken: b }, { itemId: 'ot_gems_500', purchaseToken: c }, { itemId: 'not_ours', purchaseToken: 'whatever-token-123' }]; }, [TOK, TOK2, GEMTOK]);
    { const p = d1.page.evaluate(() => __ot.game.modules.store.restore()); await solveGate(d1.page); await p; await d1.page.waitForSelector('[data-act="restore-play"]');
      const t = await d1.page.textContent('#modal'); ok('play billing: the restore screen offers "Restore from Google Play" and the Trail Key, and names no other shop', /Restore from Google Play/.test(t) && /Trail Key/.test(t) && !ELSEWHERE.test(t));
      await d1.page.screenshot({ path: path.join(OUT, 'play-restore-390.png') });
      eq('play billing: restore buttons are 44 px and nothing scrolls sideways', await layout(d1.page), { small: [], sideways: false });
      await d1.page.tap('[data-act="restore-play"]'); await d1.page.waitForFunction(() => /Restored:|already here|did not work/.test(document.querySelector('.st-msg').textContent), null, { timeout: 8000 }); }
    const back = await snap(d1.page), msg = await d1.page.textContent('.st-msg');
    ok('play billing: the new device got the permanent items back', blank.gems <= 1 && !blank.owned['tag:supporter'] && back.owned['tag:supporter'] && back.owned['hat:moss-beanie'] && /Supporter set/.test(msg) && /Whispering Firs set/.test(msg), msg + ' gems ' + back.gems);
    eq('play billing: an unfinished gem purchase found on Google\'s list is added once and consumed; the Supporter set\'s 600 gems are not given again and no bones are added', [back.gems - blank.gems, back.bones - blank.bones, await d1.page.evaluate(() => __dg.consumed.length)], [500, 0, 1]);
    eq('play billing: the journal shows two restores from Google Play and one purchase; restores cost nothing against the limit', [back.journal.filter(j => j.kind === 'restore' && j.via === 'play').length, back.journal.filter(j => j.kind === 'buy').length, back.spent], [2, 1, 499]);
    eq('play billing: restoring again adds nothing', await d1.page.evaluate(async () => { const g = __ot.game, g0 = g.state.wallet.gems, r = await g.modules.store.debug.playSync(false); return [r, g.state.wallet.gems - g0]; }), [[], 0]);
    /* a used-up item claimed on one device is refused on another */
    eq('play billing: a gem purchase already used on another device grants nothing here', await (async () => { await wipe(d1); return d1.page.evaluate(async t => { const g = __ot.game, g0 = g.state.wallet.gems, r = await g.modules.store.debug.claimPlay('ot_gems_500', t); return [r, g.state.wallet.gems - g0]; }, GEMTOK); })(), ['failed', 0]);
    /* Stripe is out of reach in the Play app even in test mode */
    eq('play billing: the Stripe path does nothing in the Play app (no session is made, the page does not leave)', await d1.page.evaluate(async () => { const d = __ot.game.modules.store.debug, href = location.href; await d.pay('ot_gems_80'); return [Object.keys(d.kv().sessions || {}).length, location.href === href, __ot.game.modules.store.pending]; }), [0, true, null]);
    eq('play billing: nothing was requested outside the game on either device, and no console errors', [o.outside(), d1.outside(), o.errors, d1.errors], [[], [], [], []]);
    await d1.ctx.close(); }

  /* ---------- 6. the Play channel without the Digital Goods API (a browser that is not the Android shell) ---------- */
  { const o = await open(browser, { query: '?src=play&debug=1&nosw=1&mock=1' }), { page } = o;
    await page.evaluate(() => { delete window.PaymentRequest; });
    await spendingOn(page); await openStore(page);
    const cards = await page.evaluate(() => [...document.querySelectorAll('[data-item]')].map(c => ({ btn: c.querySelector('button').textContent, dis: c.querySelector('button').disabled, text: c.textContent })));
    ok('no Digital Goods API: all 16 items say "Coming soon", none can be pressed and none shows a price', cards.length === 16 && cards.every(c => c.btn === 'Coming soon' && c.dis && !/[€£¥]|\$(?!31\.94)/.test(c.text)), JSON.stringify(cards[0]));
    eq('no Digital Goods API: nothing is sellable and buying is refused', await page.evaluate(async () => { const st = __ot.game.modules.store; return [st.playReady, st.catalog.some(c => st.sellable(c.sku)), await st.buy('ot_gems_80'), await st.debug.payPlay('ot_gems_80'), await st.debug.playSync(true), st.journal().length]; }), [false, false, false, false, null, 0]);
    ok('no Digital Goods API: the store says it cannot reach Google Play', /could not reach Google Play/.test(await page.textContent('#modalBody')));
    await page.screenshot({ path: path.join(OUT, 'play-no-dg-390.png') });
    eq('no Digital Goods API: no console errors', o.errors, []); await o.ctx.close(); }

  /* ---------- 7. the Play channel against the real worker code, Google faked ---------- */
  { const { handle } = await import('file://' + WORKER);
    const { privateKey } = require('crypto').generateKeyPairSync('rsa', { modulusLength: 2048 }), PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const kv = new Map(), KV = { async get(k, t) { const v = kv.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); } };
    const PKG = 'com.example.opentrail', google = { purchases: {}, gets: 0, acks: 0, consumes: 0, stripe: 0, urls: [] };
    /* Google knows a token of the shape e2e.<sku>.<n...>; anything else is unknown to it */
    const googleFetch = async (url, init = {}) => { const u = String(url);
      if (u.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'ya29.e2e', expires_in: 3600 }), { status: 200 });
      if (u.startsWith('https://api.stripe.com/')) { google.stripe++; return new Response('{}', { status: 500 }); }
      const m = u.match(/\/applications\/([^/]+)\/purchases\/products\/([^/]+)\/tokens\/([^/:]+)(:acknowledge|:consume)?$/); if (!m) throw new Error('unexpected fetch ' + u);
      google.urls.push(u); const token = decodeURIComponent(m[3]), t = /^e2e\.(ot_[a-z0-9_]+)\.n\d+x[a-z0-9]+$/.exec(token);
      if (decodeURIComponent(m[1]) !== PKG || !t) return new Response('{}', { status: 404 });
      const p = google.purchases[token] = google.purchases[token] || { sku: t[1], ack: 0, consumed: 0 };
      if (m[4] === ':consume') { google.consumes++; p.consumed = 1; return new Response('{}', { status: 200 }); } if (m[4]) { google.acks++; p.ack = 1; return new Response('{}', { status: 200 }); }
      google.gets++; return new Response(JSON.stringify({ purchaseState: 0, consumptionState: p.consumed, acknowledgementState: p.ack, orderId: 'GPA.e2e', productId: p.sku, purchaseType: 0 }), { status: 200 }); };
    const hits = [];
    const wsrv = http.createServer(async (req, res) => { const chunks = []; for await (const c of req) chunks.push(c); hits.push(req.method + ' ' + req.url);
      const env = { DEWCLAW: KV, ALLOWED_ORIGIN: BASE.slice(0, -1), APP_ORIGIN: BASE.slice(0, -1), PLAY_PACKAGE: 'com.example.dewclaw', OT_PLAY_PACKAGE: PKG, GOOGLE_SA_EMAIL: 'svc@e2e.iam.gserviceaccount.com', GOOGLE_SA_KEY: PEM };
      const r = await handle(new Request('http://worker.test' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env, { fetch: googleFetch, now: Date.now });
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); });
    await new Promise(r => wsrv.listen(0, r)); const WURL = `http://localhost:${wsrv.address().port}`;
    const shipped = fs.readFileSync(path.join(ROOT, 'js/store-config.js'), 'utf8');
    configOverride = shipped.replace("export const WORKER_URL = 'OWNER_FILLS_IN';", `export const WORKER_URL = '${WURL}';`).replace("export const PLAY_BILLING = 'off';", "export const PLAY_BILLING = 'on';");
    ok('the test config differs from the shipped one only in the worker address and the Play switch', configOverride !== shipped && configOverride.includes(WURL) && configOverride.includes("PLAY_BILLING = 'on'") && !/price_[A-Za-z0-9]{6,}/.test(configOverride.replace(/\/\*[\s\S]*?\*\//g, '')));
    const o = await open(browser, { query: '?src=play&debug=1&nosw=1', play: { prefix: 'e2e' } }), { page } = o;
    eq('real worker: the store is live in the Play app with no Stripe price id set, and is not the test double', await page.evaluate(() => { const st = __ot.game.modules.store; return [st.channel, st.live, st.mock, st.hasStore, st.playBilling, 'debug' in st]; }), ['play', true, false, true, true, false]);
    await spendingOn(page); eq('real worker: nothing has been asked of the worker before a grown-up opens the store and buys', hits.length, 0);
    await openStore(page);
    const buyByTouch = async sku => { await page.evaluate(() => { __ot.game.ui.closeAll(); }); await openStore(page); await page.tap(`[data-item="${sku}"] button`); await solveGate(page); await page.waitForFunction(() => __ot.game.ui.current && __ot.game.ui.current.id === 'store-confirm');
      await page.evaluate(() => { for (const b of document.querySelectorAll('#modalActions button')) if (/^Pay /.test(b.textContent)) b.click(); }); await page.waitForFunction(() => __ot.game.ui.current && __ot.game.ui.current.id === 'store-thanks', null, { timeout: 10000 }); const t = await page.textContent('#modal'); await page.evaluate(() => __ot.game.ui.closeAll()); return t; };
    const s0 = await snap(page), t1 = await buyByTouch('ot_gems_80'), s1 = await snap(page);
    eq('real worker: a gem pack bought by touch adds 80 gems, no bones, and is consumed with Google', [s1.gems - s0.gems, s1.bones - s0.bones, google.consumes, google.acks, s1.journal.length], [80, 0, 1, 0, 1]);
    ok('real worker: the thank-you says the receipt comes from Google Play', /receipt comes from Google Play/.test(t1) && !ELSEWHERE.test(t1), t1.slice(0, 200));
    const t2 = await buyByTouch('ot_pack_galaxy'), s2 = await snap(page);
    ok('real worker: a permanent set is granted, acknowledged with Google, and comes with a Trail Key', G.every(i => s2.owned[i]) && google.acks === 1 && /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(s2.key) && t2.includes(s2.key), s2.key);
    eq('real worker: the worker was asked only for /ot/play-claim, with the game\'s package and never Dewclaw\'s; Stripe was never called', [[...new Set(hits.filter(h => !h.startsWith('OPTIONS')))], google.urls.every(u => u.includes('/applications/' + PKG + '/')), google.stripe], [['POST /ot/play-claim'], true, 0]);
    ok('real worker: the purchase token is not kept by the worker or in the save, only a hash', await page.evaluate(() => { const toks = __dg.shown.length && Object.values(localStorage).join(' '); return !/e2e\.ot_/.test(toks); }) && ![...kv.values()].some(v => /e2e\.ot_/.test(v)));
    /* replay: opening the store again finds the permanent item on Google's list and adds nothing */
    await page.evaluate(() => { __ot.game.ui.closeAll(); }); const posts = hits.filter(h => h.startsWith('POST')).length; await openStore(page); await page.waitForFunction(() => __dg.lists >= 3); await page.waitForTimeout(300);
    eq('real worker: looking again asks the worker nothing and adds nothing', [hits.filter(h => h.startsWith('POST')).length - posts, (await snap(page)).gems - s2.gems], [0, 0]);
    /* another device, same Google account */
    const held = await page.evaluate(() => __dg.purchases.map(p => ({ ...p })));
    const o2 = await open(browser, { query: '?src=play&debug=1&nosw=1', play: { prefix: 'e2e' } }); await spendingOn(o2.page); const r0 = await snap(o2.page);
    await o2.page.evaluate(h => { __dg.purchases = h; }, held);
    { const p = o2.page.evaluate(() => __ot.game.modules.store.restore()); await solveGate(o2.page); await p; await o2.page.tap('[data-act="restore-play"]'); await o2.page.waitForFunction(() => /Restored:|already here|did not work/.test(document.querySelector('.st-msg').textContent), null, { timeout: 10000 }); }
    const r2 = await snap(o2.page);
    ok('real worker: a second device restores the set from Google Play, with no gems and no purchase in its journal', G.every(i => r2.owned[i]) && r2.gems === r0.gems && r2.journal.length === 1 && r2.journal[0].kind === 'restore' && r2.key === s2.key, JSON.stringify(r2.journal));
    /* a made-up token straight at the worker */
    const forged = await (await fetch(WURL + '/ot/play-claim', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE.slice(0, -1) }, body: JSON.stringify({ sku: 'ot_gems_7000', token: 'forged-token-0123456789', install: 'x'.repeat(24) }) })).json();
    ok('real worker: a made-up token grants nothing', forged.error && !forged.grant, JSON.stringify(forged));
    eq('real worker: no console errors on either device', [o.errors, o2.errors], [[], []]);
    eq('real worker: the only outside address the game called was the worker', [...new Set([...o.outside(), ...o2.outside()].map(u => new URL(u).origin))], [WURL]);
    configOverride = null; await o.ctx.close(); await o2.ctx.close(); wsrv.close(); }

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  console.log('screenshots: ' + OUT);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL  test run crashed: ' + (e && e.stack || e)); process.exit(1); });
