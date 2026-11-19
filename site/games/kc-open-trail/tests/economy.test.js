/* KC: Open Trail economy test (Playwright + Chromium): js/economy.js, js/upgrades.js, js/shop.js, css/economy.css.
     NODE_PATH=$(npm root -g) node tests/economy.test.js [screenshot-folder]
   Run from site/games/kc-open-trail. Serves this folder on its own port and proves, with numbers read from the running game:
     1. the price table matches the spec (30 ladders, 214,400 bones; every row total; cosmetics 13,890; decor 6,000)
     2. a balance can never go below zero, whatever is asked of it
     3. every one of the 46 purchasable tracks (30 ladders) can be bought tier by tier, each charge is exact, and each
        effect is measurably applied through the core hooks (speed, stamina, ride tuning, rewards, tills, followers ...)
     4. items: cosmetics, the bones-for-gems bridge (one way), Undo, treats, den decor with a full refund
     5. everything survives a reload, nothing is earned while away, and a damaged save still boots
     6. the six Shop tabs work by touch at 390 x 844 and 844 x 390 (44 px targets, no sideways scroll, a clear
        "not enough bones" state, two-step confirm)
   ECON_ISOLATE=1 serves the missions / store / merch modules as empty stubs (useful while those files are being edited).
   Exits non-zero if any check fails. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
let PORT = +(process.env.PORT || 0), BASE = '';   /* no PORT given: any free port, so this test can run beside the others */
const OUT = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'kc-open-trail-economy-shots'));
fs.mkdirSync(OUT, { recursive: true });
const ISOLATE = process.env.ECON_ISOLATE === '1', STUB = 'export function init() { return {}; }\n', OTHERS = ['/js/missions.js', '/js/store.js', '/js/merch.js'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (ISOLATE && OTHERS.includes(p)) { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); return res.end(STUB); }
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
let failed = 0, passed = 0;
const ok = (name, cond, extra = '') => { if (cond) passed++; else failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra !== '' ? '  [' + extra + ']' : '')); return !!cond; };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (name, got, want, tol = 1e-6) => ok(name, Math.abs(got - want) <= tol, `got ${got}, want ${want}`);

/* the spec's table (MONETIZATION-EXPANSION-SPEC.md section 2): [row, tier costs] and what section 3.2 says the cosmetics add up to */
const SPEC = { 1: [120, 350, 900, 2200], 2: [100, 300, 800, 2000], 3: [150, 450, 1200], 4: [80, 250, 700, 1800], 5: [150, 450, 1200], 6: [400, 1200, 3000, 7000], 7: [250, 700, 1800], 8: [200, 600, 1500], 9: [300, 900, 2400], 10: [200, 600, 1500], 11: [250, 700, 1800],
  12: [200, 500, 1200], 13: [200, 500, 1200], 14: [200, 500, 1200], 15: [250, 600, 1500], 16: [250, 600, 1500], 17: [250, 600, 1500], 18: [300, 800, 2000], 19: [300, 800, 2000], 20: [300, 800, 2000], 21: [0, 400, 1200, 3000, 7000, 15000], 22: [500, 1000, 2000, 4000],
  23: [40, 120, 300], 24: [500, 1500, 4000], 25: [800, 400, 640, 960], 26: [2500, 1250, 2000, 3000], 27: [6000, 3000, 4800, 7200], 28: [300, 800, 2000, 5000, 12000], 29: [1500], 30: [500, 2000, 5000, 12000, 25000] };
const ROW_TOTALS = [3570, 3200, 1800, 2830, 1800, 11600, 2750, 2300, 3600, 2300, 2750, 1900, 1900, 1900, 2350, 2350, 2350, 3100, 3100, 3100, 26600, 7500, 4600, 6000, 2800, 8750, 21000, 20100, 12000, 44500];
const SPEC_TOTAL = 214400, SLOT_TOTALS = { bandana: 480, collar: 480, tag: 480, harness: 600, hat: 3450, trail: 1800, paint: 3600, costume: 3000 };

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', ...opts });
  const page = await ctx.newPage(), errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  const boot = async () => { await page.goto(BASE + '?debug=1&nosw=1'); await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 }); await page.evaluate(() => { __ot.start(); __ot.step(5); }); };
  await boot();
  return { ctx, page, errors, requests, boot };
}
const clean = (name, o) => { const ext = o.requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')); ok(`${name}: no console errors or page errors`, o.errors.length === 0, o.errors.slice(0, 3).join(' | ')); ok(`${name}: nothing was requested from outside the game folder`, ext.length === 0, ext.slice(0, 3).join(' ')); };

(async () => {
  await new Promise(r => server.listen(PORT, r)); PORT = server.address().port; BASE = `http://localhost:${PORT}/`;
  const browser = await chromium.launch();
  console.log(`economy test on ${BASE}${ISOLATE ? ' (missions / store / merch stubbed)' : ''}`);

  /* ---------- 0. the files themselves ---------- */
  for (const f of ['js/economy.js', 'js/upgrades.js', 'js/shop.js']) { const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(`${f}: makes no network call`, !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/.test(src));
    ok(`${f}: no banned name, no link out of the game`, !new RegExp('hallow' + 'eentown', 'i').test(src) && !/target\s*=|https?:\/\//.test(src)); }
  ok('css/economy.css exists and loads nothing from elsewhere', !/url\(|@import/.test(fs.readFileSync(path.join(ROOT, 'css/economy.css'), 'utf8')));

  const A = await open(browser), page = A.page;

  /* ---------- 1. the price table ---------- */
  const T = await page.evaluate(() => { const e = __ot.game.economy, rows = {}; for (const l of e.ladders()) (rows[l.no] = rows[l.no] || []).push({ id: l.id, costs: l.costs, fx: l.fx.length, group: l.group });
    const sum = f => e.items(f).reduce((s, i) => s + (i.bones || 0), 0), slot = s => sum(i => i.slot === s && !i.premium && !i.festival);
    return { scale: e.ECON_SCALE, totals: e.totals(), rows, catalog: e.catalog.length, catOk: e.catalog.every(r => r.id && r.category && Number.isInteger(r.bones) && r.bones >= 0 && (r.gems === null || r.gems % 40 === 0)),
      slots: { bandana: slot('bandana'), collar: slot('collar'), tag: slot('tag'), harness: slot('harness'), hat: slot('hat'), trail: slot('trail'), paint: sum(i => i.paint), costume: sum(i => i.festival) },
      counts: { bandana: e.items(i => i.slot === 'bandana' && !i.premium).length, collar: e.items(i => i.slot === 'collar' && !i.premium).length, tag: e.items(i => i.slot === 'tag').length, harness: e.items(i => i.slot === 'harness').length, hat: e.items(i => i.slot === 'hat' && !i.premium).length, trail: e.items(i => i.slot === 'trail' && !i.premium).length, paint: e.items(i => i.paint).length, costume: e.items(i => i.festival).length },
      decor: e.items(i => i.cat === 'decor' && !i.premium).map(i => i.bones), gems: e.items(i => i.gems).map(i => [i.gems, e.itemPrice(i.id).bones]), usd: [40, 80, 120, 160].map(g => e.usd(g)), treats: e.items('treat').map(i => [i.id, i.bones]), maxIncome: __ot.game.modules.upgrades.maxIncome(), tabs: __ot.game.shop.tabs.map(t => t.id) }; });
  eq('ECON_SCALE starts at 1', T.scale, 1);
  eq('30 ladder rows', Object.keys(T.rows).length, 30); eq('46 purchasable tracks (10 dogs, 8 trail markers)', T.totals.tracks, 46);
  let rowsOk = true, grand = 0; const bad = [];
  for (let no = 1; no <= 30; no++) { const tracks = T.rows[no] || [], total = tracks.reduce((s, t) => s + t.costs.reduce((a, c) => a + c, 0), 0); grand += total; if (total !== ROW_TOTALS[no - 1] || !tracks.every(t => JSON.stringify(t.costs) === JSON.stringify(SPEC[no]) && t.fx === t.costs.length)) { rowsOk = false; bad.push(no); } }
  ok('every ladder has the spec\'s tier costs, an effect for every tier and the spec\'s row total', rowsOk, 'rows ' + bad.join(','));
  eq('ten Trail Buddies and eight Trail Markers', [T.rows[23].length, T.rows[29].length], [10, 8]);
  eq('sum of all ladder costs', grand, SPEC_TOTAL); eq('economy.totals().ladders', T.totals.ladders, SPEC_TOTAL);
  eq('the six ability ladders cost 24,800', [1, 2, 3, 4, 5, 6].reduce((s, n) => s + ROW_TOTALS[n - 1], 0), 24800);
  eq('bones cosmetics by shelf', T.slots, SLOT_TOTALS); eq('bones cosmetics counts', T.counts, { bandana: 12, collar: 8, tag: 6, harness: 6, hat: 7, trail: 6, paint: 18, costume: 5 });
  eq('bones cosmetics total', T.totals.cosmetics, 13890);
  ok('30 den props from 40 to 600 bones, 6,000 in all', T.decor.length === 30 && Math.min(...T.decor) === 40 && Math.max(...T.decor) === 600 && T.decor.reduce((a, b) => a + b, 0) === 6000, `${T.decor.length} props, ${T.decor.reduce((a, b) => a + b, 0)}`);
  eq('ladders + cosmetics + decor + the 14 twins (7,300, sold by the merch module) = 241,590', T.totals.ladders + T.totals.cosmetics + T.totals.decor + 7300, 241590);
  ok('every gem price is a multiple of 40 and has a bones price at 50 a gem', T.gems.length >= 32 && T.gems.every(([g, b]) => g % 40 === 0 && b === g * 50), T.gems.length + ' gem items');
  eq('"about $X" at the smallest pack\'s rate, half-cents rounded up', T.usd, ['$0.50', '$0.99', '$1.49', '$1.98']);
  eq('bakery treat prices', T.treats, [['treat:zoomie', 60], ['treat:jerky', 120], ['treat:party', 80]]);
  near('three businesses fully upgraded make 19.25 bones a minute', T.maxIncome, 19.25);
  ok('the catalogue is filled, every row with an id, a category and a whole bones price', T.catalog > 200 && T.catOk, T.catalog + ' rows');
  ok('shop tabs registered: upgrades, wardrobe, rides, den, businesses, funds', ['upgrades', 'wardrobe', 'rides', 'den', 'businesses', 'funds'].every(t => T.tabs.includes(t)), T.tabs.join(','));

  /* ---------- 2. a balance never goes below zero ---------- */
  const N = await page.evaluate(() => { const g = __ot.game, e = g.economy, w = g.wallet, s = g.state, out = {}; let min = { bones: 0, gems: 0 }, whole = true; const off = g.on('wallet', ev => { min[ev.currency] = Math.min(min[ev.currency], ev.amount); if (!Number.isInteger(ev.amount)) whole = false; });
    s.wallet.bones = 0; s.wallet.gems = 0;
    out.broke = [e.buyLevel('legs'), e.level('legs'), e.buyItem('bandana:red'), e.owns('bandana:red'), e.buyItem('hat:moss-beanie', 'gems'), e.spend({ bones: 1 }), w.spend('bones', 1), e.pay('den', 50), w.get('bones'), w.get('gems')];
    out.check = e.check('legs');
    w.add('bones', 119); out.oneShort = [e.buyLevel('legs'), w.get('bones'), e.check('legs').short]; w.add('bones', 1); out.exact = [e.buyLevel('legs'), w.get('bones'), e.level('legs')];
    w.add('bones', 50); e.spend({ bones: NaN }); e.spend({ bones: -5 }); e.spend({ bones: 51 }); e.spend({ bones: 10, gems: 1 }); out.odd = [w.get('bones'), w.spend('bones', -1), w.spend('bones', Infinity), w.spend('gems', 1e12), e.spend(null), e.buyLevel('nope'), e.buyLevel(null), e.buyItem('nope'), e.pay('den', -10), e.pay('den', NaN), e.pay('legs', 10), w.add('bones', -1e9), w.get('bones')];
    /* a few hundred random purchases with small random pocket money: the wallet listener records the lowest balance ever seen */
    let seed = 12345; const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed % n; }; const lads = e.ladders().map(l => l.id), its = e.items().map(i => i.id); let bought = 0;
    for (const d of e.ladders('companions')) if (d.eff.dog) __ot.emit('dogPlay', { id: 'dog-' + d.eff.dog, name: d.eff.name });
    for (let i = 0; i < 600; i++) { if (rnd(3) === 0) w.add(rnd(2) ? 'bones' : 'gems', rnd(400)); const k = rnd(5); if (k === 0) bought += e.buyLevel(lads[rnd(lads.length)]) ? 1 : 0; else if (k === 1) bought += e.buyItem(its[rnd(its.length)], rnd(2) ? 'gems' : 'bones') ? 1 : 0; else if (k === 2) e.pay('den', rnd(300)); else if (k === 3) e.spend({ bones: rnd(500), gems: rnd(50) }); else w.spend(rnd(2) ? 'bones' : 'gems', rnd(900)); }
    off(); out.fuzz = { min, whole, bought, bones: w.get('bones'), gems: w.get('gems'), owed: e.owed('den') }; return out; });
  eq('with empty pockets nothing can be bought or paid, and the balance stays 0', N.broke, [false, 0, false, false, false, false, false, 0, 0, 0]);
  ok('check() says how many bones are missing', N.check.ok === false && N.check.reason === 'bones' && N.check.short === 120 && /120 more/.test(N.check.text), JSON.stringify(N.check));
  eq('one bone short: refused, nothing taken', N.oneShort, [false, 119, 1]); eq('the exact price: bought, balance 0', N.exact, [true, 0, 1]);
  eq('NaN, negative, infinite, unknown and oversized requests are all refused; a huge debit stops at 0', N.odd, [50, false, false, false, false, false, false, false, 0, 0, 0, 0, 0]);
  ok('600 random purchases: the lowest balance ever seen is 0, balances stay whole numbers', N.fuzz.min.bones === 0 && N.fuzz.min.gems === 0 && N.fuzz.whole && N.fuzz.bones >= 0 && N.fuzz.gems >= 0 && N.fuzz.owed >= 0 && N.fuzz.bought > 0, JSON.stringify(N.fuzz));

  /* ---------- 3. every ladder, tier by tier, with the effect measured ---------- */
  await page.evaluate(() => { __ot.game.save.reset(); }); await A.boot();
  const L = await page.evaluate(async () => {
    const g = __ot.game, e = g.economy, w = g.wallet, U = g.modules.upgrades, s = g.state, kc = g.kc, out = { tracks: {}, spent: 0, charges: true, firstTier: [] };
    s.wallet.bones = 0; s.wallet.gems = 0;
    const spendOff = g.on('spend', ev => { if (String(ev.reason).startsWith('upgrade:')) out.spent += ev.bones; });
    /* buy the next tier with exactly its price in the pocket: true only if the level rose by one and exactly the price left the wallet */
    const tier = id => { const cost = e.nextCost(id), lv = e.level(id); w.spend('bones', w.get('bones')); w.add('bones', cost); const before = w.get('bones'), okBuy = e.buyLevel(id), l = e.ladder(id); let paid = before - w.get('bones'); if (l.payLater) { const due = e.owed(id); paid = e.pay(id, due); if (due !== cost || e.owed(id) !== 0) out.charges = false; }
      const good = okBuy && e.level(id) === lv + 1 && paid === cost && w.get('bones') === 0; if (!good) out.charges = false; if (lv === 0) out.firstTier.push([id, good]); return good; };
    const all = id => { let n = 0; while (e.level(id) < e.maxLevel(id) && n < 9) { if (!tier(id)) break; n++; } return e.level(id); };
    const sprint = () => { __ot.teleport(-168, -166, Math.PI / 2); __ot.setCam(Math.PI / 2, 0.3, 8); __ot.step(8); kc.stamina = kc.staminaMax; __ot.hold('KeyW', true); __ot.hold('ShiftLeft', true); let top = 0; for (let i = 0; i < 70; i++) { __ot.step(1, 1 / 30); top = Math.max(top, kc.speed); kc.stamina = kc.staminaMax; } __ot.hold('KeyW', false); __ot.hold('ShiftLeft', false); __ot.step(12); return top; };

    /* --- 1 to 6: KC's abilities, through game.setModifier --- */
    const ab = { legs: ['speed', [1.05, 1.10, 1.15, 1.20], 'distance', 5000], lungs: ['stamina', [1.15, 1.30, 1.45, 1.60], 'barks', 50], paws: ['jump', [1.07, 1.14, 1.20], 'jumps', 200], sniffer: ['magnet', [1.25, 1.5, 1.75, 2.0], 'bones', 200], paddle: ['swim', [1.10, 1.20, 1.30], 'swims', 10], nose: ['bones', [1.10, 1.20, 1.30, 1.40], 'digs', 25] };
    out.sprint0 = sprint(); out.stamina0 = kc.staminaMax;
    for (const id in ab) { const [key, v, stat, need] = ab[id], seen = [g.getModifier(key)]; s.stats[stat] = 0;
      for (let i = 0; i < v.length - 1; i++) { tier(id); seen.push(g.getModifier(key)); }
      const locked = e.check(id); w.add('bones', e.nextCost(id)); const refused = e.buyLevel(id) === false && e.level(id) === v.length - 1; w.spend('bones', w.get('bones'));
      s.stats[stat] = need; tier(id); seen.push(g.getModifier(key));
      out.tracks[id] = { seen, want: [1, ...v], milestone: locked.reason === 'locked' && refused, level: e.level(id) };
      if (id === 'legs') out.sprint4 = sprint(); if (id === 'lungs') out.stamina4 = kc.staminaMax; }
    /* --- 7, 8: gear, through game.rewards --- */
    out.dig = [g.rewards.dig.slice()]; for (let i = 0; i < 3; i++) { tier('mitts'); out.dig.push(g.rewards.dig.slice()); }
    out.fetch = [g.rewards.fetch]; for (let i = 0; i < 3; i++) { tier('ball'); out.fetch.push(g.rewards.fetch); }
    /* --- 9: saddlebags, measured as carry slots --- */
    out.carry = [kc.capacity()]; for (let i = 0; i < 3; i++) { tier('saddlebags'); out.carry.push(kc.capacity()); }
    /* --- 10: treat pouch, measured by what the bakery will sell --- */
    const fill = () => { for (const id of ['treat:zoomie', 'treat:jerky', 'treat:party']) while (e.count(id)) e.use(id); let n = 0; w.add('bones', 5000); while (n < 20 && e.buyItem('treat:zoomie')) n++; w.spend('bones', w.get('bones')); return [n, e.treatCap(), e.checkItem('treat:zoomie').reason]; };
    out.pouch = [fill()]; for (let i = 0; i < 3; i++) { tier('pouch'); out.pouch.push(fill()); } while (e.count('treat:zoomie')) e.use('treat:zoomie');
    /* --- 11: trail camera, through game.photo --- */
    const cam = () => [g.photo.available('frame').length, g.photo.available('filter').length, !!g.photo.available('zoom'), g.photo.available('sticker').length, g.photo.available('pose').length];
    out.camera = [cam()]; for (let i = 0; i < 3; i++) { tier('camera'); out.camera.push(cam()); }
    /* --- 12 to 20: ride parts, through game.vehicles.setTuning --- */
    const tune = (id, kind, key) => { const seen = [g.vehicles.getTuning(kind)[key]], top = [g.vehicles.getTuning(kind).topSpeed]; for (let i = 0; i < 3; i++) { tier(id); seen.push(g.vehicles.getTuning(kind)[key]); top.push(g.vehicles.getTuning(kind).topSpeed); } return { seen, top, base: g.vehicles.getTuning(kind).base }; };
    out.tune = { wheels: tune('wheels', 'skateboard', 'max'), trucks: tune('trucks', 'skateboard', 'turn'), cedar: tune('cedar', 'canoe', 'max'), keel: tune('keel', 'canoe', 'turn'), drybox: tune('drybox', 'canoe', 'carry'), engine: tune('engine', 'van', 'max'), tyres: tune('tyres', 'van', 'offroad'), rack: tune('rack', 'van', 'carry') };
    const aboard = kind => { const r = __ot.rides().find(x => x.kind === kind); if (!r) return null; const foot = kc.capacity(); __ot.enter(r.id); __ot.step(3); const on = kc.capacity(); __ot.exit(); __ot.step(3); return on - foot; };
    out.aboard = { canoe: aboard('canoe'), van: aboard('van'), skateboard: aboard('skateboard') };
    /* 14: Pop Deck pays per ollie, at most once every 5 seconds */
    const ollie = (speed = 9) => { const b = w.get('bones'); __ot.emit('trick', { kind: 'ollie', id: 't', speed }); return w.get('bones') - b; }, pop = () => { __ot.step(170, 1 / 30); const a = ollie(), b = ollie(); __ot.step(90, 1 / 30); const c = ollie(); __ot.step(170, 1 / 30); const d = ollie(); return [a, b, c, d]; };
    out.pop = [pop()]; for (let i = 0; i < 3; i++) { tier('popdeck'); out.pop.push(pop()); }
    /* tier 3: a parked board pays nothing, and no more than 30 payouts in any 10 minutes of play */
    __ot.step(170, 1 / 30); out.popParked = [ollie(0), ollie(2)]; { let n = 0; for (let i = 0; i < 60; i++) { __ot.step(160, 1 / 30); if (ollie() > 0) n++; } out.popCap = n; }
    /* --- 21, 22: the den (move in first, pay on a bar) and den storage --- */
    const den = () => ({ stage: g.place.get('eco:den').level, slots: U.denSlots(), outfits: U.outfitSlots(), travel: g.travel.list().some(p => p.id === 'den'), nap: U.nap(3) === true, bowl: U.bowlReady(), paintFree: e.itemPrice('skin:van:river').bones === 0 });
    out.den = [den()]; out.denstoreEarly = e.check('denstore').reason;
    w.spend('bones', w.get('bones')); out.denFree = [e.buyLevel('den'), e.level('den'), w.get('bones'), e.owed('den')]; out.firstTier.push(['den', out.denFree[0] && out.denFree[1] === 1]); out.den.push(den());
    /* stage 2 by hand: delivered at once, 400 owed, the next stage waits, part-payments, never more than is owed or held */
    const d2 = { buy: e.buyLevel('den'), level: e.level('den'), owed: e.owed('den'), next: e.check('den').reason, blocked: e.buyLevel('den') }; d2.payBroke = e.pay('den', 100); w.add('bones', 150); d2.pay150 = e.pay('den', 150); d2.left = e.owed('den'); w.add('bones', 60); d2.payAll = e.pay('den'); d2.left2 = e.owed('den'); w.add('bones', 1000); d2.payRest = e.pay('den', 1e9); d2.left3 = e.owed('den'); d2.change = w.get('bones'); w.spend('bones', w.get('bones')); d2.over = e.pay('den', 10); out.d2 = d2; out.den.push(den());
    for (let i = 3; i <= 6; i++) { tier('den'); out.den.push(den()); }
    await new Promise(r => setTimeout(r, 500)); __ot.step(2); out.napTime = g.world.time;
    out.bowl = [U.bowl(), U.bowl(), U.bowlReady()]; w.spend('bones', w.get('bones'));
    out.store = [[U.denSlots(), U.outfitSlots()]]; for (let i = 0; i < 4; i++) { tier('denstore'); out.store.push([U.denSlots(), U.outfitSlots()]); }
    /* --- 23, 24: buddies and the whistle --- */
    const dogs = U.dogs.slice(); out.dogs = dogs; out.buddyLocked = e.check('buddy:' + dogs[0]).reason; out.whistleEarly = e.check('whistle').reason;
    for (const d of dogs) __ot.emit('dogPlay', { id: 'dog-' + d, name: e.ladder('buddy:' + d).eff.name });
    out.hearts = {}; for (const d of dogs) { const id = 'buddy:' + d, seen = []; tier(id); seen.push(!!g.place.get('eco:buddydig:' + d)); tier(id); seen.push(!!g.place.get('eco:buddydig:' + d)); const noWhistle = U.callBuddy(d); tier(id); out.hearts[d] = { level: e.level(id), marks: seen, noWhistle, fav: U.favourite(d) }; }
    const wh = {}; g.followers.dismiss(); tier('whistle'); const a = dogs[0], b = dogs[1];
    wh.call1 = U.callBuddy(a); wh.left1 = Math.round(g.followers.list()[0].left()); wh.second1 = U.callBuddy(b); wh.count1 = g.followers.list().length; wh.home = U.sendHome(a); __ot.step(3); wh.after = U.called().length;
    tier('whistle'); wh.call2 = U.callBuddy(a); wh.left2 = g.followers.list()[0].left(); wh.second2 = U.callBuddy(b); wh.count2 = U.called().length;
    tier('whistle'); wh.call3 = U.callBuddy(b); wh.count3 = U.called().length; wh.walking = g.followers.list().map(f => f.name); out.whistle = wh;
    /* --- 25 to 27: the businesses. 60 simulated seconds of real play per tier; the till is whole bones only when collected --- */
    out.biz = {}; const minute = () => __ot.step(900, 1 / 15);
    for (const id of U.biz) { const rows = []; for (let i = 0; i < 4; i++) { tier(id); U.collect(id); const t0 = U.till(id); minute(); rows.push({ rate: U.rate(id), cap: U.cap(id), earned: +(U.till(id) - t0).toFixed(4), stage: g.place.get('eco:' + id).level }); }
      for (let i = 0; i < 4000; i++) g.emit('second', { t: 0 }); const fullTill = U.till(id), b0 = w.get('bones'), got = U.collect(id), again = U.collect(id); out.biz[id] = { rows, fullTill, got, paid: w.get('bones') - b0, again, left: U.till(id) }; w.spend('bones', w.get('bones')); }
    /* --- 28: lantern fund --- */
    out.lantern = []; const costumes = ['costume:sheet', 'costume:scarecrow', 'costume:wings', 'costume:lanternvest', 'costume:pumpkinsuit'], lan = () => ({ stage: g.place.get('eco:lantern').level, open: costumes.map(c => e.checkItem(c).reason !== 'locked'), top: !!e.getFlag('lantern:top') });
    out.lantern.push(lan()); for (let i = 0; i < 5; i++) { tier('lantern'); out.lantern.push(lan()); }
    /* --- 29: trail markers --- */
    out.markers = {}; s.collected.signs.length = 0;
    for (const l of e.ladders('town').filter(x => x.eff.type === 'marker')) { const before = g.travel.list().some(p => p.id === l.id), locked = e.check(l.id).reason; s.collected.signs.push(l.eff.sign); tier(l.id); const p = g.travel.list().find(q => q.id === l.id), sg = g.place.sign(l.eff.sign); out.markers[l.id] = { before, locked, after: !!p, dist: p ? Math.hypot(p.x - sg.x, p.z - sg.z) : 99 }; }
    /* --- 30: town fund --- */
    out.town = [{ stage: g.place.get('eco:town').level, remote: U.remote() }]; for (let i = 0; i < 5; i++) { tier('town'); out.town.push({ stage: g.place.get('eco:town').level, remote: U.remote() }); }
    __ot.teleport(-168, -166, 0); U.collectAll(); w.spend('bones', w.get('bones')); for (let i = 0; i < 30; i++) g.emit('second', { t: 0 }); out.hydrant = { near: U.biz.map(id => U.near(id)), got: U.collectAll() };
    spendOff(); out.levels = e.ladders().every(l => e.level(l.id) === l.max); out.wallet = { ...s.wallet };
    for (let i = 0; i < 40 && g.ui.fading; i++) await new Promise(r => setTimeout(r, 100));   /* let the nap's fade finish: no timer has run since */
    out.go = [g.ui.fading, g.travel.blocked, g.travel.go('marker:tabor')]; for (let i = 0; i < 40 && Math.abs(kc.pos.x + 168) < 1; i++) await new Promise(r => setTimeout(r, 100)); __ot.step(3); out.at = { x: kc.pos.x, z: kc.pos.z, sign: g.place.sign('tabor') };
    return out;
  });
  ok('every track\'s first tier was bought for exactly its price (46 of 46)', L.firstTier.length === 46 && L.firstTier.every(([, g]) => g), L.firstTier.filter(([, g]) => !g).map(([id]) => id).join(',') || L.firstTier.length);
  ok('every tier of every ladder charged exactly its price', L.charges);
  eq('bones spent on ladders, read from the `spend` events', L.spent, SPEC_TOTAL);
  ok('every ladder is at its top level', L.levels);
  for (const id of Object.keys(L.tracks)) { const t = L.tracks[id]; ok(`${id}: modifier after each tier ${t.seen.map(v => +v.toFixed(3)).join(' / ')}`, t.seen.every((v, i) => Math.abs(v - t.want[i]) < 1e-9)); ok(`${id}: the top tier waits for a free play milestone, bones alone do not buy it`, t.milestone); }
  ok(`Trail Legs measured on the ground: top sprint speed ${L.sprint0.toFixed(2)} -> ${L.sprint4.toFixed(2)} (x${(L.sprint4 / L.sprint0).toFixed(3)}, want x1.20)`, Math.abs(L.sprint4 / L.sprint0 - 1.2) < 0.02);
  eq('Big Lungs measured: stamina pool 100 -> 160', [Math.round(L.stamina0), Math.round(L.stamina4)], [100, 160]);
  eq('Dig Mitts: game.rewards.dig per tier', L.dig, [[3, 8], [4, 9], [5, 11], [6, 13]]); eq('Fetch Ball: game.rewards.fetch per tier', L.fetch, [2, 3, 4, 6]);
  eq('Saddlebags: carry slots per tier', L.carry, [1, 2, 3, 4]);
  eq('Treat Pouch: treats the bakery will sell before the pouch is full, per tier', L.pouch, [[1, 1, 'full'], [2, 2, 'full'], [4, 4, 'full'], [6, 6, 'full']]);
  eq('Trail Camera: frames / filters / zoom / stickers / poses per tier', L.camera, [[0, 0, false, 0, 0], [6, 0, false, 0, 0], [6, 5, true, 0, 0], [6, 5, true, 7, 4]]);
  const tn = L.tune, r3 = a => a.map(v => +v.toFixed(4));
  eq('Smooth Wheels: skateboard top speed x', r3(tn.wheels.seen), [1, 1.08, 1.16, 1.24]); near('Smooth Wheels: top speed in units a second 13 -> 16.12', tn.wheels.top[3], 13 * 1.24, 0.01);
  eq('Carving Trucks: skateboard turn x', r3(tn.trucks.seen), [1, 1.1, 1.2, 1.3]);
  eq('Cedar Paddle: canoe top speed x', r3(tn.cedar.seen), [1, 1.08, 1.16, 1.24]); eq('Steady Keel: canoe turn x', r3(tn.keel.seen), [1, 1.1, 1.2, 1.3]);
  eq('Dry Box: extra carry in a canoe', tn.drybox.seen, [0, 1, 2, 3]); eq('Tuned Engine: van top speed x', r3(tn.engine.seen), [1, 1.05, 1.1, 1.15]);
  eq('Trail Tyres: share of the off-road slowdown removed', r3(tn.tyres.seen), [0, 0.3333, 0.6667, 1]); eq('Roof Rack: extra carry in a van', tn.rack.seen, [0, 1, 2, 3]);
  eq('measured aboard: carry slots gained by hopping on (canoe +3, van +3, skateboard +0)', L.aboard, { canoe: 3, van: 3, skateboard: 0 });
  eq('Pop Deck: bones for [an ollie, another at once, one 3 s later, one 5.7 s after that] per tier', L.pop, [[0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 0, 2], [3, 0, 0, 3]]);
  eq('Pop Deck: an ollie on a parked or crawling board pays nothing, and 60 ollies in a row stop paying at 30 payouts in 10 minutes (6 were paid just before)', [L.popParked, L.popCap], [[0, 0], 24]);
  eq('KC\'s Den: the Pup Tent is free', L.denFree, [true, 1, 0, 0]);
  eq('KC\'s Den: world stage and decor spots per stage', L.den.map(d => [d.stage, d.slots]), [[0, 0], [1, 4], [2, 8], [3, 12], [4, 18], [5, 26], [6, 36]]);
  eq('KC\'s Den: nap from the Doghouse, fast travel from the Garden Shed, bone bowl from the Trail Cabin, free paint at the Bluff Lodge', L.den.map(d => [d.nap, d.travel, d.bowl, d.paintFree].map(Number).join('')), ['0000', '0000', '1000', '1100', '1110', '1110', '1111']);
  eq('KC\'s Den pay-later bar: delivered at once, the next stage waits, part-payments, no overpaying, never negative', L.d2, { buy: true, level: 2, owed: 400, next: 'owed', blocked: false, payBroke: 0, pay150: 150, left: 250, payAll: 60, left2: 190, payRest: 190, left3: 0, change: 810, over: 0 });
  near('a nap set the time of day', L.napTime, 3, 0.2); eq('bone bowl: 25 bones once a day', L.bowl, [25, 0, false]);
  eq('Den Storage needs a den first', L.denstoreEarly, 'locked'); eq('Den Storage: decor spots and saved outfits per tier', L.store, [[36, 1], [42, 2], [48, 3], [54, 4], [60, 5]]);
  eq('a buddy needs a play first; the whistle needs a three-heart buddy', [L.buddyLocked, L.whistleEarly], ['locked', 'locked']);
  ok('ten buddies: three hearts each, the favourite dig spot goes on the map at heart 2, no calling without the whistle', L.dogs.length === 10 && L.dogs.every(d => { const h = L.hearts[d]; return h.level === 3 && h.marks[0] === false && h.marks[1] === true && h.noWhistle !== true && h.fav; }));
  const wh = L.whistle; eq('Buddy Whistle tier 1: one buddy for 10 minutes', [wh.call1, wh.left1, wh.second1 === true, wh.count1, wh.home, wh.after], [true, 600, false, 1, true, 0]);
  eq('Buddy Whistle tier 2: the buddy stays until sent home (still one at a time)', [wh.call2, wh.left2 === null || wh.left2 > 1e9, wh.second2 === true, wh.count2], [true, true, false, 1]);
  eq('Buddy Whistle tier 3: two buddies at once', [wh.call3, wh.count3, wh.walking.length], [true, 2, 2]);
  const BZ = { 'biz:cart': [2, 60], 'biz:canoes': [3, 90], 'biz:pumpkins': [6, 180] };
  for (const id of Object.keys(BZ)) { const [r, c] = BZ[id], b = L.biz[id]; eq(`${id}: bones a minute and till size per tier`, b.rows.map(x => [x.rate, x.cap]), [[r, c], [r * 1.5, c], [r * 1.5, c * 2], [r * 1.75, c * 2]]);
    ok(`${id}: 60 s of play earned ${b.rows.map(x => x.earned).join(' / ')} bones`, b.rows.every(x => Math.abs(x.earned - x.rate) <= x.rate / 60 + 0.001)); eq(`${id}: the world object changes with each tier`, b.rows.map(x => x.stage), [1, 2, 3, 4]);
    eq(`${id}: the till stops when full, pays out once, and is then empty`, [b.fullTill, b.got, b.paid, b.again, b.left], [c * 2, c * 2, c * 2, 0, 0]); }
  eq('Lantern Fund: rings lit and costumes unlocked per tier', L.lantern.map(x => [x.stage, x.open.filter(Boolean).length, x.top]), [[-1, 0, false], [0, 1, false], [1, 2, false], [2, 3, false], [3, 4, false], [4, 5, true]]);
  ok('Trail Markers: locked until the sign is read, then a fast-travel point beside the signpost', Object.keys(L.markers).length === 8 && Object.values(L.markers).every(m => !m.before && m.locked === 'locked' && m.after && m.dist < 5), JSON.stringify(Object.values(L.markers).map(m => +m.dist.toFixed(1))));
  ok('fast travel to a Trail Marker moved KC there', L.go[2] === true && Math.hypot(L.at.x - L.at.sign.x, L.at.z - L.at.sign.z) < 6, JSON.stringify([L.go, L.at.x, L.at.z]));
  eq('Town Fund: one more thing in the world per tier; the Golden Hydrant is the last', L.town.map(x => [x.stage, x.remote]), [[-1, false], [0, false], [1, false], [2, false], [3, false], [4, true]]);
  ok('Golden Hydrant: every till collected from the den, far from all three businesses', L.hydrant.near.every(n => !n) && L.hydrant.got === 1 + 2 + 5, JSON.stringify(L.hydrant));
  await page.screenshot({ path: path.join(OUT, 'economy-world-marker.png') });

  /* ---------- 4. items ---------- */
  const I = await page.evaluate(() => { const g = __ot.game, e = g.economy, w = g.wallet, U = g.modules.upgrades, s = g.state, out = {}; g.followers.dismiss(); __ot.step(3); w.spend('bones', w.get('bones')); w.spend('gems', w.get('gems'));
    out.contract = [typeof e.grant, typeof e.owns, typeof e.setFlag, typeof e.getFlag, Array.isArray(e.catalog), typeof e.spend, typeof e.canAfford, typeof e.level, typeof e.buyLevel, typeof e.count, typeof e.use];
    const got = e.grant({ bones: 5, gems: 2, items: ['test:thing', { id: 'test:stack', n: 3 }] }, 'test'); out.grant = [got.bones, got.gems, got.items.length, e.owns('test:thing'), e.count('test:stack'), e.setFlag('eco-test', 7), e.getFlag('eco-test'), e.canAfford({ bones: 5, gems: 2 }), e.canAfford({ bones: 6 })]; w.spend('bones', 5); w.spend('gems', 2);
    /* a bones cosmetic */
    w.add('bones', 40); out.bandana = [e.buyItem('bandana:red'), w.get('bones'), e.owns('bandana:red'), g.cosmetics.equip('bandana:red'), g.cosmetics.equipped('bandana'), e.buyItem('bandana:red'), g.cosmetics.equip('hat:crown')];
    /* gems: cosmetics only, a bones price for every gem price, Undo within ten minutes, and no way to turn gems into bones */
    w.add('gems', 119); out.gemShort = [e.buyItem('hat:moss-beanie', 'gems'), w.get('gems')]; w.add('gems', 1); out.gem = [e.buyItem('hat:moss-beanie', 'gems'), w.get('gems'), e.owns('hat:moss-beanie'), !!e.undoable('hat:moss-beanie'), g.cosmetics.equip('hat:moss-beanie')];
    out.undo = [e.undo('hat:moss-beanie'), w.get('gems'), e.owns('hat:moss-beanie'), g.cosmetics.equipped('hat'), e.undo('hat:moss-beanie'), w.get('bones')];
    w.add('bones', 6000); out.dual = [e.itemPrice('hat:moss-beanie'), e.buyItem('hat:moss-beanie', 'bones'), w.get('bones'), w.get('gems'), e.undoable('hat:moss-beanie')]; w.spend('gems', w.get('gems'));
    out.gemOnly = [e.buyItem('treat:zoomie', 'gems'), e.buyItem('bandana:sky', 'gems'), e.ladders().every(l => l.costs.every(Number.isFinite)), e.items().filter(i => i.gems).every(i => i.cat === 'cosmetic' || i.cat === 'decor')];
    /* treats */
    w.add('bones', 260); out.treatBuy = ['treat:zoomie', 'treat:jerky', 'treat:party'].map(id => e.buyItem(id)); out.treatWallet = w.get('bones');
    const sp0 = g.getModifier('speed'), bn0 = g.getModifier('bones'); out.zoomie = [U.useTreat('treat:zoomie'), +(g.getModifier('speed') / sp0).toFixed(4), Math.round(g.kc.modifierLeft('treat:zoomie')), e.count('treat:zoomie'), U.useTreat('treat:zoomie') === true];
    out.jerky = [U.useTreat('treat:jerky'), +(g.getModifier('bones') / bn0).toFixed(4), Math.round(g.kc.modifierLeft('treat:jerky'))]; const f0 = g.followers.list().length; out.party = [U.useTreat('treat:party'), g.followers.list().length - f0, Math.round(g.followers.list()[g.followers.list().length - 1].left()), e.count('treat:party')];
    g.setModifier('treat:zoomie', null); g.setModifier('treat:jerky', null); g.followers.dismiss(); __ot.step(3);
    /* den decor: bought, stood by the den, every bone back when put away; the number of spots is a hard limit */
    w.spend('bones', w.get('bones')); w.add('bones', 6000); const ids = e.items(i => i.cat === 'decor' && !i.premium).map(i => i.id), placed = []; for (const id of ids) { if (!e.buyItem(id)) { placed.push('nobuy'); continue; } placed.push(U.placeDecor(id)); }
    out.decor = { all: placed.every(p => p === true), n: U.decorPlaced().length, spent: 6000 - w.get('bones'), inWorld: ids.filter(id => U.decorStanding(id)).length };
    const back = U.removeDecor('decor:stage'); out.refund = [back, w.get('bones'), e.owns('decor:stage'), U.decorStanding('decor:stage'), U.removeDecor('decor:stage')];
    for (const id of U.decorPlaced().slice(0, 20)) U.removeDecor(id); out.afterClear = [U.decorPlaced().length, w.get('bones') > 0];
    /* free gems: one for each new place */
    const g0 = w.get('gems'); __ot.emit('discover', { id: 'eco-test-zone', name: 'Test' }); out.discover = w.get('gems') - g0; out.daily = e.daily(); return out; });
  ok('the core contract still works: grant({ bones, gems, items }), owns, count, setFlag / getFlag, catalog, spend, canAfford, level, buyLevel', I.contract.join() === 'function,function,function,function,true,function,function,function,function,function,function' && JSON.stringify(I.grant) === JSON.stringify([5, 2, 2, true, 3, 7, 7, true, false]), JSON.stringify(I.grant));
  eq('a 40-bone bandana: bought, owned, worn; not sold twice; an unowned hat cannot be worn', I.bandana, [true, 0, true, true, 'bandana:red', false, false]);
  eq('a gem cosmetic: refused one gem short, bought at 120', [I.gemShort, I.gem], [[false, 119], [true, 0, true, true, true]]);
  eq('Undo: the gems come back, the item goes (and comes off), only once, no bones appear', I.undo, [true, 120, false, null, false, 0]);
  eq('the same item for bones at 50 a gem; a bones purchase leaves the gems alone and has no Undo', I.dual, [{ gems: 120, bones: 6000, either: true }, true, 0, 120, null]);
  eq('gems buy cosmetics only: no treat, no bones-priced item, no ladder', I.gemOnly, [false, false, true, true]);
  eq('treats: 60 + 120 + 80 bones', [I.treatBuy, I.treatWallet], [[true, true, true], 0]);
  eq('Zoomie Biscuit: speed x1.15 for 180 s, used up', I.zoomie, [true, 1.15, 180, 0, false]); eq('Lucky Jerky: bones x1.5 for 300 s', I.jerky, [true, 1.5, 300]); eq('Party Treat: a town dog walks with KC for 600 s', I.party, [true, 1, 600, 0]);
  eq('den decor: all 30 props bought for 6,000 and standing by the den', I.decor, { all: true, n: 30, spent: 6000, inWorld: 30 });
  eq('putting a prop away gives every bone back', I.refund, [{ bones: 600, gems: 0 }, 600, false, false, null]);
  eq('a new place pays one gem', I.discover, 1); ok('three daily sniff-outs worth 2 gems, with progress', I.daily.goals.length === 3 && I.daily.gems === 2 && I.daily.goals.every(g => g.need > 0 && g.have >= 0), JSON.stringify(I.daily.goals.map(g => g.text)));

  /* ---------- 5. saving, reloading, nothing earned while away, a damaged save ---------- */
  const S0 = await page.evaluate(() => { const g = __ot.game, e = g.economy, U = g.modules.upgrades; g.followers.dismiss(); for (let i = 0; i < 50; i++) g.emit('second', { t: 0 }); g.cosmetics.equip('bandana:red'); __ot.save(); return { tills: U.biz.map(id => +U.till(id).toFixed(3)), decor: U.decorPlaced().length }; });
  await page.waitForTimeout(600);
  await A.ctx.addInitScript(() => { const D = Date, off = 8 * 3600 * 1000; class Later extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } } window.Date = Later; });   /* the device clock says eight hours went by */
  await A.boot();
  const S1 = await page.evaluate(() => { const g = __ot.game, e = g.economy, U = g.modules.upgrades; return { clock: +((Date.now() - performance.timeOrigin - performance.now()) / 3600000).toFixed(2), levels: e.ladders().every(l => e.level(l.id) === l.max), speed: g.getModifier('speed'), stamina: g.kc.staminaMax, carry: g.kc.capacity(), dig: g.rewards.dig, fetch: g.rewards.fetch, wheels: g.vehicles.getTuning('skateboard').max, tyres: g.vehicles.getTuning('van').offroad, rack: g.vehicles.getTuning('van').carry,
    frames: g.photo.available('frame').length, stickers: g.photo.available('sticker').length, den: g.place.get('eco:den').level, town: g.place.get('eco:town').level, lantern: g.place.get('eco:lantern').level, cart: g.place.get('eco:biz:cart').level, travel: g.travel.list().length,
    tills: U.biz.map(id => +U.till(id).toFixed(3)), decor: U.decorPlaced().length, decorWorld: U.decorPlaced().filter(id => U.decorStanding(id)).length, bandana: g.cosmetics.equipped('bandana'), owns: e.owns('hat:moss-beanie'), bones: g.wallet.get('bones'), marks: U.dogs.filter(d => g.place.get('eco:buddydig:' + d)).length }; });
  ok('after a reload every level is back and every effect is re-applied', S1.levels && Math.abs(S1.speed - 1.2) < 1e-9 && Math.round(S1.stamina) === 160 && S1.carry === 4 && JSON.stringify(S1.dig) === '[6,13]' && S1.fetch === 6 && Math.abs(S1.wheels - 1.24) < 1e-9 && S1.tyres === 1 && S1.rack === 3 && S1.frames === 6 && S1.stickers === 7 && S1.den === 6 && S1.town === 4 && S1.lantern === 4 && S1.cart === 4 && S1.travel >= 9 && S1.marks === 10, JSON.stringify(S1));
  ok(`nothing is earned while away: tills ${S0.tills.join(' / ')} before, ${S1.tills.join(' / ')} after a reload with the device clock moved on 8 hours (caps 120 / 180 / 360)`, S1.clock > 7 && S1.tills.every((t, i) => t >= S0.tills[i] - 0.01 && t - S0.tills[i] < 1.5), 'clock moved ' + S1.clock + ' h');
  eq('decor, the outfit and owned items come back', [S1.decor, S1.decorWorld, S1.bandana, S1.owns], [S0.decor, S0.decor, 'bandana:red', true]);
  /* a damaged save */
  await page.evaluate(() => { const key = __ot.game.save.key, s = JSON.parse(localStorage.getItem(key)); s.wallet = { bones: -50, gems: 'lots' };
    s.upgrades = { legs: 99, lungs: -3, paws: 'x', sniffer: 2.7, den: null, nose: {}, 'biz:cart': 3, ball: 2, unknown: 5, 'marker:tabor': true };
    s.modules.economy = 'oops'; s.modules.upgrades = { tills: 'x', decor: [1, 2], paid: 4, bowl: 9, called: { a: 1 }, wall: 'https://example.invalid/x.png' }; s.modules.shop = 7; s.owned = { 'decor:stage': true, 'bandana:red': true, 'treat:zoomie': -4 }; s.equipped = { bandana: 'bandana:red', hat: 12 };
    __ot.game.save.save = () => false; localStorage.setItem(key, JSON.stringify(s)); });
  await A.boot();
  const S2 = await page.evaluate(() => { const g = __ot.game, e = g.economy, U = g.modules.upgrades; const before = { legs: e.level('legs'), lungs: e.level('lungs'), paws: e.level('paws'), sniffer: e.level('sniffer'), den: e.level('den'), nose: e.level('nose'), cart: e.level('biz:cart'), ball: e.level('ball'), tabor: e.level('marker:tabor'), speed: g.getModifier('speed'), fetch: g.rewards.fetch, bones: g.wallet.get('bones'), gems: g.wallet.get('gems'), till: U.till('biz:cart') < 2 ? 0 : U.till('biz:cart'), decor: U.decorPlaced().length, wall: U.wall(), tabs: g.shop.tabs.length, slots: U.denSlots() };
    g.wallet.add('bones', 500); for (let i = 0; i < 121; i++) g.emit('second', { t: 0 }); before.works = [e.buyLevel('lungs'), g.getModifier('stamina'), Math.floor(U.till('biz:cart')), U.collect('biz:cart'), e.buyLevel('den'), U.denSlots()]; for (const t of ['upgrades', 'wardrobe', 'rides', 'den', 'businesses', 'funds']) { g.shop.open(t); } g.ui.closeAll(); return before; });
  eq('a damaged save boots: bad levels are clamped or dropped, the wallet is never negative, bad module data is rebuilt', [S2.legs, S2.lungs, S2.paws, S2.sniffer, S2.den, S2.nose, S2.cart, S2.ball, S2.tabor, S2.bones, S2.gems, S2.till, S2.decor, S2.wall, S2.slots],
    [4, 0, 0, 2, 0, 0, 3, 2, 1, 0, 0, 0, 0, null, 0]);
  ok('... and the game still plays on it: effects from the repaired levels, purchases, tills, all six tabs', Math.abs(S2.speed - 1.2) < 1e-9 && S2.fetch === 4 && S2.tabs >= 6 && JSON.stringify(S2.works) === JSON.stringify([true, 1.15, 6, 6, true, 4]), JSON.stringify(S2.works));
  clean('logic run', A); await A.ctx.close();

  /* ---------- 6. the screens, by touch, on a phone both ways up ---------- */
  for (const [name, vp] of [['390x844', { width: 390, height: 844 }], ['844x390', { width: 844, height: 390 }]]) {
    const B = await open(browser, { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), p = B.page;
    await p.evaluate(() => { const g = __ot.game; g.state.wallet.bones = 0; g.state.wallet.gems = 0; __ot.setTime(13); });
    const openTab = async (tab, sec) => { await p.evaluate(([tab, sec]) => { __ot.game.ui.closeAll(); __ot.game.modules.shop.open(tab, sec); }, [tab, sec]); await p.waitForTimeout(160); };
    const audit = () => p.evaluate(() => { const body = document.getElementById('modalBody'), card = document.querySelector('#modal .card').getBoundingClientRect(), small = [], wide = [];
      for (const b of document.querySelectorAll('#modalBody .tabpane button, #modalBody .tabpane .art[role=button]')) { const r = b.getBoundingClientRect(); if (!r.width) continue; if (r.width < 43.5 || r.height < 43.5) small.push((b.textContent || b.className).trim().slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
      for (const c of document.querySelectorAll('#modalBody .item, #modalBody .eco-row, #modalBody .note, #modalBody .sech')) { const r = c.getBoundingClientRect(); if (r.right > card.right + 1 || r.left < card.left - 1) wide.push(c.className); }
      return { small, wide, overflow: body.scrollWidth - body.clientWidth, cards: body.querySelectorAll('.item').length, inView: card.left >= 0 && card.right <= innerWidth + 0.5 && card.top >= 0 && card.bottom <= innerHeight + 0.5, tabs: document.querySelectorAll('.tabstrip button').length }; });
    /* broke: a clear "not enough bones" state on every ladder that costs something */
    await openTab('upgrades');
    const broke = await p.evaluate(() => { const c = document.querySelector('.item[data-ladder="legs"]'), b = c.querySelector('[data-act="buy"]'); return { short: c.classList.contains('short'), why: (c.querySelector('.why') || {}).textContent || '', label: b.textContent, disabled: b.disabled, pips: c.querySelectorAll('.eco-pips i').length, on: c.querySelectorAll('.eco-pips i.on').length, next: (c.querySelector('.eco-next') || {}).textContent || '', price: c.querySelector('.prices').textContent.trim(), daily: !!document.querySelector('.eco-daily li') }; });
    eq(`${name}: with no bones the Trail Legs card says so, shows 4 empty pips, the first effect and the price, and its button is off`, broke, { short: true, why: 'Not enough bones: 120 more to go', label: 'Not enough bones', disabled: true, pips: 4, on: 0, next: 'First: Sprint speed x1.05', price: '120', daily: true });
    await p.screenshot({ path: path.join(OUT, `economy-${name}-upgrades-broke.png`) });
    /* every tab: fits, 44 px targets, no sideways scroll */
    await p.evaluate(() => { const g = __ot.game, e = g.economy; g.wallet.add('bones', 4000); g.wallet.add('gems', 200); e.buyLevel('den'); e.buyLevel('den'); e.buyLevel('biz:cart'); e.buyLevel('camera'); for (let i = 0; i < 2000; i++) g.emit('second', { t: 0 }); for (const d of ['Biscuit', 'Pepper']) __ot.emit('dogPlay', { id: 'dog-' + d.toLowerCase(), name: d }); for (let i = 0; i < 3; i++) e.buyLevel('buddy:biscuit'); e.buyLevel('whistle'); g.state.collected.signs.push('welcome'); });
    for (const [tab, sec] of [['upgrades'], ['upgrades', 'treats'], ['wardrobe'], ['wardrobe', 'premium'], ['rides'], ['den'], ['den', 'decor'], ['den', 'buddies'], ['businesses'], ['funds']]) { await openTab(tab, sec); const a = await audit();
      ok(`${name}: ${tab}${sec ? ' / ' + sec : ''}: ${a.cards} cards, inside the screen, no sideways scroll, every target 44 px or more`, a.cards > 0 && a.inView && a.overflow <= 1 && a.wide.length === 0 && a.small.length === 0 && a.tabs >= 6, [a.small.slice(0, 3).join('; '), a.wide.slice(0, 2).join(';'), 'overflow ' + a.overflow].join(' | '));
      await p.screenshot({ path: path.join(OUT, `economy-${name}-${tab}${sec ? '-' + sec : ''}.png`) }); }
    /* buy a ladder tier by touch: tap, confirm screen with the price and the balance afterwards, yes */
    await openTab('upgrades'); const w0 = await p.evaluate(() => __ot.game.wallet.get('bones'));
    await p.tap('.item[data-ladder="lungs"] [data-act="buy"]'); await p.waitForSelector('#modal.spend');
    const conf = await p.evaluate(() => ({ title: document.getElementById('modalTitle').textContent, price: document.querySelector('#modal.spend .prices').textContent.trim(), after: (document.querySelector('#modal.spend .after') || {}).textContent || '', level: __ot.game.economy.level('lungs') }));
    ok(`${name}: the confirm screen shows the item, the price and the balance afterwards, and nothing is bought yet`, conf.price === '100' && conf.after.includes(String(w0 - 100)) && conf.level === 0, JSON.stringify(conf));
    await p.screenshot({ path: path.join(OUT, `economy-${name}-confirm.png`) });
    await p.tap('#modalActions .btn.go'); await p.waitForTimeout(200);
    const after = await p.evaluate(() => { const c = document.querySelector('.item[data-ladder="lungs"]'); return { level: __ot.game.economy.level('lungs'), bones: __ot.game.wallet.get('bones'), stamina: __ot.game.kc.staminaMax, on: c ? c.querySelectorAll('.eco-pips i.on').length : -1, now: c ? (c.querySelector('.eco-now') || {}).textContent : '', modal: __ot.state().modal }; });
    eq(`${name}: yes buys it: level 1, 100 bones gone, stamina pool 115, one pip lit, back in the shop`, [after.level, w0 - after.bones, Math.round(after.stamina), after.on, after.now, after.modal], [1, 100, 115, 1, 'Now: Stamina x1.15', 'shop']);
    /* "not now" buys nothing */
    await p.tap('.item[data-ladder="paws"] [data-act="buy"]'); await p.waitForSelector('#modal.spend'); await p.tap('#modalActions .btn.alt'); await p.waitForTimeout(150);
    eq(`${name}: "Not now" spends nothing`, await p.evaluate(() => [__ot.game.economy.level('paws'), __ot.game.wallet.get('bones')]), [0, after.bones]);
    /* wardrobe: try on (not saved, not owned), then get and wear */
    await openTab('wardrobe', 'bandana');
    await p.tap('.item[data-item="bandana:river"] .art'); await p.waitForTimeout(120);
    const tryOn = await p.evaluate(() => ({ peek: document.getElementById('modal').classList.contains('eco-peek'), owned: __ot.game.economy.owns('bandana:river'), saved: __ot.game.cosmetics.equipped('bandana') }));
    eq(`${name}: tapping the picture is a try-on: the shop fades back, nothing is owned or saved`, tryOn, { peek: true, owned: false, saved: null });
    await p.tap('#modalTitle'); await p.waitForTimeout(120);
    await p.tap('.item[data-item="bandana:river"] .side .btn'); await p.waitForSelector('#modal.spend'); await p.tap('#modalActions .btn.go'); await p.waitForTimeout(200);
    eq(`${name}: a 40-bone bandana bought by touch is owned and worn`, await p.evaluate(() => { const e = __ot.game.economy; return [e.owns('bandana:river'), __ot.game.cosmetics.equipped('bandana'), (document.querySelector('.item[data-item="bandana:river"] .tag2') || {}).textContent]; }), [true, 'bandana:river', 'Wearing']);
    /* a gem item: the choice of bones or gems, then Undo on the card */
    await openTab('wardrobe', 'premium'); const gemText = await p.evaluate(() => document.querySelector('.item[data-item="bandana:fern"] .mid').textContent);
    ok(`${name}: a gem price shows no dollar hint (the web sells nothing: Google Play Billing only, owner decision 2026-11-19)`, !/\$|gems is about/.test(gemText), gemText);
    await p.tap('.item[data-item="bandana:fern"] .side .btn'); await p.waitForFunction(() => __ot.state().modal === 'eco-pay'); await p.tap('#modalActions .btn.alt'); await p.waitForSelector('#modal.spend'); await p.tap('#modalActions .btn.go'); await p.waitForTimeout(200);
    await openTab('wardrobe', 'bandana');
    const gemBuy = await p.evaluate(() => ({ owns: __ot.game.economy.owns('bandana:fern'), gems: __ot.game.wallet.get('gems'), undo: !!document.querySelector('.item[data-item="bandana:fern"] [data-act="undo"]') }));
    eq(`${name}: bought with 80 gems, and the card offers Undo`, gemBuy, { owns: true, gems: 120, undo: true });
    await p.tap('.item[data-item="bandana:fern"] [data-act="undo"]'); await p.waitForFunction(() => __ot.state().modal === 'confirm'); await p.tap('#modalActions .btn.go'); await p.waitForTimeout(200);
    eq(`${name}: Undo by touch gives the 80 gems back`, await p.evaluate(() => [__ot.game.economy.owns('bandana:fern'), __ot.game.wallet.get('gems')]), [false, 200]);
    /* the den's pay bar by touch */
    await openTab('den'); const owed0 = await p.evaluate(() => __ot.game.economy.owed('den'));
    await p.tap('[data-act="pay-some"]'); await p.waitForSelector('#modal.spend'); await p.tap('#modalActions .btn.go'); await p.waitForTimeout(200);
    const paid = await p.evaluate(() => ({ owed: __ot.game.economy.owed('den'), bar: (document.querySelector('#modalBody .prog span') || {}).textContent }));
    eq(`${name}: "Pay 100" on the den bar`, [owed0, paid.owed, paid.bar], [400, 300, '100 of 400 bones paid']);
    /* decor by touch: get, it stands by the den, put away, the bones return */
    await openTab('den', 'decor'); const b1 = await p.evaluate(() => __ot.game.wallet.get('bones'));
    await p.tap('.item[data-item="decor:bench"] .side .btn'); await p.waitForSelector('#modal.spend'); await p.tap('#modalActions .btn.go'); await p.waitForTimeout(250);
    const dec = await p.evaluate(() => ({ world: __ot.game.modules.upgrades.decorStanding('decor:bench'), bones: __ot.game.wallet.get('bones'), tag: (document.querySelector('.item[data-item="decor:bench"] .tag2') || {}).textContent }));
    await p.tap('.item[data-item="decor:bench"] .side .btn'); await p.waitForTimeout(200);
    eq(`${name}: a garden bench: 100 bones, out by the den, put away for 100 bones back`, [dec.world, b1 - dec.bones, dec.tag, await p.evaluate(() => __ot.game.wallet.get('bones')), await p.evaluate(() => __ot.game.modules.upgrades.decorStanding('decor:bench'))], [true, 100, 'Out by the den', b1, false]);
    /* a till: collect is refused in the screen when KC is far away, allowed at the cart */
    await openTab('businesses'); const far = await p.evaluate(() => { const b = document.querySelector('[data-till="biz:cart"] [data-act="collect"]'); return [b.disabled, b.textContent]; });
    eq(`${name}: far from the cart the till can only be looked at`, far, [true, 'Visit it to collect']);
    await p.evaluate(() => { const s = __ot.game.modules.upgrades.sites['biz:cart']; __ot.game.ui.closeAll(); __ot.teleport(s.x, s.z + 3.2, Math.PI); __ot.setCam(Math.PI, 0.3, 8); __ot.step(12); });
    await p.waitForTimeout(150); await p.screenshot({ path: path.join(OUT, `economy-${name}-world-cart.png`) });
    const at = await p.evaluate(() => { const g = __ot.game, pr = g.api.prompt, b0 = g.wallet.get('bones'), till = Math.floor(g.modules.upgrades.till('biz:cart')); __ot.press('interact'); __ot.step(2); return { label: pr && pr.label, till, got: g.wallet.get('bones') - b0, modal: __ot.state().modal }; });
    ok(`${name}: at the cart the prompt empties the till (${at.till} bones)`, /Empty the till \(60 bones\)/.test(at.label || '') && at.got === 60 && at.modal === null, JSON.stringify(at));
    /* the shop doors open the right tab; the den has a prompt and a place on the map */
    const doors = await p.evaluate(() => { const g = __ot.game, out = {}; for (const [id, tab] of [['tailor', 'wardrobe'], ['pets', 'upgrades'], ['bakery', 'upgrades'], ['toys', 'wardrobe'], ['bikes', 'rides'], ['chandlery', 'rides'], ['fuel', 'rides'], ['bandanas', 'wardrobe'], ['collars', 'wardrobe'], ['tags', 'wardrobe']]) { const h = g.place.get('eco:shop:' + id); g.ui.closeAll(); if (!h) { out[id] = 'missing'; continue; } const it = g.api.interactables.get('ct:eco:shop:' + id); it.onInteract(); out[id] = g.shop.current === tab && __ot.state().modal === 'shop' && g.place.clear(h.x, h.z, 0.5); } g.ui.closeAll(); out.den = !!g.place.get('eco:den:door') && !!g.place.get('eco:cityhall'); return out; });
    ok(`${name}: ten shop doors and stalls open the right tab from clear ground; the den and City Hall have prompts`, Object.values(doors).every(v => v === true), JSON.stringify(doors));
    await p.evaluate(() => { const g = __ot.game, e = g.economy, h = g.modules.upgrades.home; for (let i = 0; i < 4; i++) { e.pay('den', 1e9); g.wallet.add('bones', 30000); e.buyLevel('den'); } e.pay('den', 1e9); g.ui.closeAll(); __ot.teleport(h.x, h.z + 12, Math.PI); __ot.setCam(Math.PI, 0.3, 13); __ot.step(14); });
    await p.waitForTimeout(150); await p.screenshot({ path: path.join(OUT, `economy-${name}-world-den.png`) });
    const hud = await p.evaluate(() => ({ modal: __ot.state().modal, extra: [...document.querySelectorAll('#hudBtns .extra')].map(b => b.id || b.textContent), peek: document.getElementById('modal').classList.contains('eco-peek') }));
    ok(`${name}: back in the world nothing of the shop is left on the HUD`, hud.modal === null && !hud.peek, JSON.stringify(hud));
    clean(name, B); await B.ctx.close();
  }

  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots: ${OUT}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
