/* KC: Open Trail smoke test (Playwright + Chromium).
     node tests/smoke.js [screenshot-folder]
   (run from site/games/kc-open-trail; NODE_PATH must reach 'playwright', e.g. NODE_PATH=$(npm root -g))
   Serves this folder on its own port, then at 390x844, 844x390 and 1280x720: loads the game, starts play,
   walks / swims / rides through the districts with the ?debug=1 hooks, checks the HUD fits, the seams work,
   nothing logs an error and nothing leaves the origin, measures frame time and saves screenshots.
   Exits non-zero if any check fails.
   Headless Chromium draws WebGL in software (SwiftShader), so the frame times printed here are a floor
   for regressions, not a statement about real phones. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..'), PORT = +(process.env.PORT || 8947), BASE = `http://localhost:${PORT}/`;
const OUT = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'kc-open-trail-shots'));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
let failed = 0; const report = { viewports: {}, districts: new Set() };
const ok = (name, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra !== '' ? '  [' + extra + ']' : '')); return !!cond; };
const st = page => page.evaluate(() => __ot.state());
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

async function open(browser, opts = {}, query = '?debug=1&nosw=1') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', acceptDownloads: true, ...opts });
  const page = await ctx.newPage(), errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE + query);
  if (query.includes('debug=1')) await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 });
  return { ctx, page, errors, requests };
}
/* go somewhere, settle, and say where the game thinks KC is */
const visit = (page, x, z, yaw = 0, o = {}) => page.evaluate(([x, z, yaw, o]) => { if (o.time != null) __ot.setTime(o.time); __ot.teleport(x, z, yaw); __ot.setCam(o.camYaw ?? yaw, o.pitch ?? 0.3, o.dist ?? 9); __ot.step(o.steps ?? 14); const s = __ot.state(); return { zone: s.zone, x: s.pos.x, y: s.pos.y, z: s.pos.z, swimming: s.swimming, ground: s.ground }; }, [x, z, yaw, o]);
/* hold forward (camera-relative) for n simulation steps */
const drive = (page, n, keys = ['KeyW']) => page.evaluate(([n, keys]) => { for (const k of keys) __ot.hold(k, true); __ot.step(n, 1 / 30); for (const k of keys) __ot.hold(k, false); const s = __ot.state(); return { x: s.pos.x, y: s.pos.y, z: s.pos.z, speed: s.speed, rideSpeed: s.rideSpeed, ride: s.ride, swimming: s.swimming, stamina: s.stamina, zone: s.zone }; }, [n, keys]);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* [district id, x, z, yaw, camera opts] : the tour every viewport takes (yaw 0 looks south, PI/2 looks east) */
const TOUR = [
  ['cvpark', -168, -166, Math.PI / 2, {}], ['plaza', -196, -250, Math.PI / 2, { dist: 12, pitch: 0.36 }], ['oldtown', -205, -206, Math.PI, { dist: 10 }], ['marina', -104, -340, Math.PI / 2, { dist: 10 }],
  ['nobhill', -246, -132, Math.PI / 2, { dist: 10 }], ['mccormick', -400, -100, Math.PI / 2, { dist: 11 }], ['hwy30', -400, 0, 0.8, { dist: 12 }], ['scappoose', -272, 50, 0.3, { dist: 12 }],
  ['farm', 46, 42, 0.8, { dist: 12, pitch: 0.4 }], ['lighthouse', -24, -78, -2.4, { dist: 13 }], ['stjohns', 44, 250, Math.PI / 2, { dist: 13, pitch: 0.22 }], ['cathedral', 196, 286, -Math.PI / 2, { dist: 13, pitch: 0.2 }],
  ['chimney', 200, 350, 0.6, { dist: 11 }], ['carts', 264, 430, Math.PI / 2, { dist: 9 }], ['tabor', 360, 444, -Math.PI / 2, { dist: 12 }], ['square', -10, 430, -Math.PI / 2, { dist: 12, pitch: 0.4 }],
  ['waterfront', 40, 430, Math.PI, { dist: 12 }], ['makers', 46, 481, 0, { dist: 9 }], ['mansion', -226, 456, -Math.PI / 2, { dist: 11, pitch: 0.25 }], ['forestpark', -232, 300, 0.5, { dist: 9 }]
];


/* ---------- module seams: every hook the feature modules build on (ARCHITECTURE.md, "Module seams") ---------- */
const wait = (page, ms) => page.waitForTimeout(ms);
const tapSel = (page, touch, sel) => (touch ? page.tap(sel) : page.click(sel));
async function passGate(page, touch, wrong = false) {
  await page.waitForSelector('.modal.gate .keypad');
  const q = await page.evaluate(() => { const m = /(\d+)\s*×\s*(\d+)/.exec(document.querySelector('.gateq').textContent); return m ? m[1] * m[2] : 0; });
  for (const d of String(wrong ? q + 1 : q)) await tapSel(page, touch, `.keypad [data-key="${d}"]`);
  await tapSel(page, touch, '.keypad [data-key="ok"]'); await wait(page, 60);
}
async function seamChecks(page, name, touch, vp) {
  const T = name + ': seam: ';
  /* a click on a link that would leave the game must never really open it during the test */
  await page.evaluate(() => { window.__ext = []; document.addEventListener('click', e => { const a = e.target && e.target.closest && e.target.closest('a[target="_blank"]'); if (a) { e.preventDefault(); window.__ext.push({ href: a.href, rel: a.rel }); } }, true); });

  /* modules + event names */
  const mods = await page.evaluate(() => ({ names: __ot.modules(), fns: ['setModifier', 'getModifier', 'setCosmetic', 'setSkin', 'timedRun', 'fastTravel', 'moduleData', 'openModal', 'toast', 'banner', 'addMarker', 'addInteractable', 'addZone', 'spawnProp', 'setObjective', 'addCarriable'].filter(k => typeof __ot.game[k] !== 'function'),
    objs: ['cosmetics', 'place', 'travel', 'followers', 'photo', 'grownUp', 'economy', 'shop', 'rewards'].filter(k => !__ot.game[k]), ui: ['tabs', 'item', 'grid', 'price', 'progress', 'note', 'heading', 'gate', 'confirmSpend', 'openExternal', 'addSetting', 'setTimer', 'confirm', 'addMenuItem', 'addHudButton'].filter(k => typeof __ot.game.ui[k] !== 'function') }));
  ok(T + 'main.js boots all six modules (economy, upgrades, shop, missions, store, merch) and every documented hook exists', ['economy', 'upgrades', 'shop', 'missions', 'store', 'merch'].every(m => mods.names.includes(m)) && !mods.fns.length && !mods.objs.length && !mods.ui.length, [...mods.fns, ...mods.objs, ...mods.ui].join(',') || mods.names.join(','));

  const ev = await page.evaluate(async () => { const g = __ot.game, seen = new Set(), off = g.on('*', (d, t) => seen.add(t)); __ot.exit();
    const b = g.collect.bones.find(q => !(q.t > 0)); __ot.teleport(b.x, b.z, 0); __ot.step(12);                                   /* bone */
    __ot.teleport(-386, -100, 0); __ot.step(10); g.state.collected.zones = g.state.collected.zones.filter(z => z !== 'quarry'); __ot.teleport(-330, -438, 0); __ot.step(12);   /* district */
    __ot.press('bark'); __ot.step(3); __ot.teleport(-150, -140, 0); __ot.step(8); __ot.press('dig'); __ot.step(50);                 /* bark, dig */
    __ot.teleport(-84, -250, 0); __ot.step(30); __ot.teleport(-150, -140, 0); __ot.step(20);                                       /* swim in, swim out */
    g.vehicles.reset('board-park'); __ot.enter('board-park'); __ot.step(3); __ot.exit(); __ot.step(3);                             /* ride on, ride off */
    g.ui.photoMode(true); g.ui.snap(); g.ui.photoMode(false);                                                                     /* photo */
    const fb = g.world.fogBell; __ot.teleport(fb.x, fb.z + 2.2, Math.PI); __ot.step(8); const bellPrompt = __ot.state().prompt; __ot.press('interact'); __ot.step(4);   /* fog bell */
    __ot.setTime(20.45); __ot.step(4); __ot.setTime(20.6); __ot.step(4); __ot.setTime(5.4); __ot.step(4); __ot.setTime(5.6); __ot.step(4); __ot.setTime(11); __ot.step(4);   /* night falls, dawn breaks */
    const p = g.npcs.peds.find(q => q.petCool <= 0) || g.npcs.peds[3]; p.petCool = 0; p.state = 'walk'; __ot.teleport(p.x + 1.2, p.z, 0); __ot.step(4); __ot.press('interact'); __ot.step(4);   /* talk */
    off(); return { seen: [...seen], bellPrompt }; });
  const need = ['pickup', 'boneCollected', 'discover', 'enterZone', 'bark', 'digStart', 'dig', 'swimStart', 'swimEnd', 'swim', 'vehicleEnter', 'vehicleExit', 'ride', 'photoMode', 'photoTaken', 'fogBell', 'timeOfDay', 'dayNight', 'npcTalk', 'talk', 'wallet', 'grant'];
  ok(T + 'events fire: bone collected, district discovered, bark, dig, swim, ride on / off, photo taken, fog bell, day / night, talk', need.every(e => ev.seen.includes(e)), need.filter(e => !ev.seen.includes(e)).join(',') || `"${ev.bellPrompt}"`);

  /* modifiers */
  const md = await page.evaluate(() => { const g = __ot.game, run = () => { __ot.teleport(-196, -262, Math.PI / 2); __ot.setCam(Math.PI / 2, 0.3, 9); g.kc.stamina = g.kc.staminaMax; g.kc.exhausted = false; __ot.hold('KeyW', true); __ot.hold('ShiftLeft', true); __ot.step(40); const v = __ot.state().speed; __ot.hold('KeyW', false); __ot.hold('ShiftLeft', false); __ot.step(30); return v; };
    const jump = () => { __ot.teleport(-150, -140, 0); __ot.step(10); const y0 = g.kc.pos.y; let top = 0; __ot.press('jump'); for (let i = 0; i < 40; i++) { __ot.step(1); top = Math.max(top, g.kc.pos.y - y0); } return top; };
    const v0 = run(), j0 = jump(), cap0 = g.kc.capacity(); g.setModifier('smoke:all', { speed: 1.2, stamina: 1.6, jump: 1.2, magnet: 2, sniff: 1.5, carry: 2, swim: 1.3, bones: 1.5, carryAdd: 1, nonsense: 9 }); g.setModifier('smoke:two', { speed: 1.05 });
    const v1 = run(), j1 = jump(), all = g.getModifier(), stam = g.kc.staminaMax, cap1 = g.kc.capacity(); g.setModifier('smoke:all', null); g.setModifier('smoke:two', null);
    g.setModifier('smoke:treat', { speed: 1.15 }, { seconds: 1 }); const during = g.getModifier('speed'), left = g.kc.modifierLeft('smoke:treat'); let expired = false; const off = g.on('modExpired', e => { if (e.id === 'smoke:treat') expired = true; }); __ot.step(40); off();
    return { v0, v1, j0, j1, all, stam, cap0, cap1, during, left, after: g.getModifier('speed'), expired, back: g.getModifier() }; });
  ok(T + 'setModifier / getModifier change speed, stamina, jump, swim, sniff and pickup radius, bone multiplier and carry; sources multiply; a timed one expires', md.v1 > md.v0 * 1.2 && md.j1 > md.j0 * 1.1 && Math.abs(md.all.speed - 1.26) < 1e-6 && md.all.swim === 1.3 && md.all.sniff === 1.5 && md.all.magnet === 2 && md.all.bones === 1.5 && md.stam === 160 && md.cap0 === 1 && md.cap1 === 3 && !('nonsense' in md.all) && md.during === 1.15 && md.left > 0 && md.after === 1 && md.expired && md.back.stamina === 1,
    `sprint ${md.v0.toFixed(1)} -> ${md.v1.toFixed(1)}, jump ${md.j0.toFixed(2)} -> ${md.j1.toFixed(2)}, carry ${md.cap0} -> ${md.cap1}`);

  /* ride tuning */
  const tn = await page.evaluate(() => { const g = __ot.game, V = g.vehicles, drive = (id, yaw, x, z, n) => { __ot.exit(); const v = V.byId(id); v.x = x; v.z = z; v.yaw = yaw; v.speed = 0; __ot.enter(id); __ot.setCam(yaw, 0.3, 9); __ot.hold('KeyW', true); __ot.step(n); const s = __ot.state().rideSpeed; __ot.hold('KeyW', false); __ot.exit(); return s; };
    const kinds = ['skateboard', 'canoe', 'van'].map(k => !!V.getTuning(k)), road0 = drive('van-park', 0, -140, -326, 150), grass0 = drive('van-park', 0, 330, 330, 90);
    let evs = 0; const off = g.on('tuningChanged', () => evs++); V.setTuning('van', { max: 1.15 }, 'smoke:engine'); V.setTuning('van', { offroad: 1 }, 'smoke:tyres'); const t = V.getTuning('van');
    const road1 = drive('van-park', 0, -140, -326, 150), grass1 = drive('van-park', 0, 330, 330, 90); V.setTuning('van', null, 'smoke:engine'); V.setTuning('van', null, 'smoke:tyres'); off();
    V.setTuning('skateboard', { max: 1.24, turn: 1.3, pop: 1.3 }, 'smoke'); V.setTuning('skateboard', { max: 9, turn: 1.1 }, 'smoke:2'); const sk = V.getTuning('skateboard'); V.setTuning('skateboard', null, 'smoke'); V.setTuning('skateboard', null, 'smoke:2');
    /* keep: the ball stays in her mouth in a canoe with a dry box; carry: one more slot while aboard */
    const ball = g.collect.ball, grab = () => { if (g.kc.carried.length) return; ball.held = false; ball.flying = false; __ot.teleport(ball.x + 0.4, ball.z, 0); __ot.step(4); __ot.press('interact'); __ot.step(3); };
    V.reset('canoe-dock'); grab(); const had = g.kc.carried.length; __ot.enter('canoe-dock'); __ot.step(2); const kept0 = g.kc.carried.length; __ot.exit(); __ot.step(2);
    V.setTuning('canoe', { keep: 1, carry: 1 }, 'smoke'); grab(); __ot.enter('canoe-dock'); __ot.step(2); const kept1 = g.kc.carried.length, capAboard = g.kc.capacity(); __ot.exit(); __ot.step(2); const capAshore = g.kc.capacity(); V.setTuning('canoe', null, 'smoke'); while (g.kc.carried.length) g.kc.drop(); V.reset(); 
    return { kinds, road0, road1, grass0, grass1, t, evs, sk, back: V.getTuning('van'), had, kept0, kept1, capAboard, capAshore }; });
  ok(T + 'vehicles.setTuning: top speed, off-road grip, turn, pop, keep and carry per ride kind, by source, clamped, removable', tn.kinds.every(Boolean) && tn.road1 > tn.road0 * 1.08 && tn.grass1 > tn.grass0 * 1.5 && Math.abs(tn.t.topSpeed - 21.85) < 0.01 && tn.t.offroad === 1 && tn.evs === 4 && tn.sk.max === 1.6 && Math.abs(tn.sk.turn - 1.43) < 1e-6 && tn.sk.pop === 1.3 && tn.back.max === 1 && tn.back.offroad === 0 && tn.had === 1 && tn.kept0 === 0 && tn.kept1 === 1 && tn.capAboard === 2 && tn.capAshore === 1,
    `van road ${tn.road0.toFixed(1)} -> ${tn.road1.toFixed(1)}, grass ${tn.grass0.toFixed(1)} -> ${tn.grass1.toFixed(1)}; canoe keeps ${tn.kept0} -> ${tn.kept1}`);

  /* followers */
  const fo = await page.evaluate(() => { const g = __ot.game, F = g.followers; __ot.exit(); __ot.teleport(-168, -166, Math.PI / 2); __ot.step(5); const log = []; const off1 = g.on('followerJoin', e => log.push('join:' + e.name)), off2 = g.on('followerLeave', e => log.push('leave:' + e.name + ':' + e.reason));
    const dogs = F.dogs(), town = F.add({ dog: dogs[0].id }), unknown = F.add({ dog: 'nobody' }), pup = F.add({ name: 'Pip', look: { coat: 0x333333, s: 0.8 }, seconds: 3 }), full = F.add({ name: 'Third' }), listed = F.list().length;
    __ot.setCam(Math.PI / 2, 0.3, 9); __ot.hold('KeyW', true); __ot.step(60); const mid = __ot.followers(), kp = __ot.state().pos; __ot.step(120); __ot.hold('KeyW', false); const afterTimeout = __ot.followers().length;
    __ot.teleport(-272, 50, 0); __ot.step(40); const far = __ot.followers(), kp2 = __ot.state().pos; const homeBefore = { x: town.dog.x, z: town.dog.z };
    g.vehicles.reset('board-park'); const bd = g.vehicles.byId('board-park'); bd.x = -272; bd.z = 44; __ot.enter('board-park'); __ot.setCam(0.3, 0.3, 9); __ot.hold('KeyW', true); __ot.step(90); __ot.hold('KeyW', false); const riding = __ot.followers(), kp3 = __ot.state().pos, moved = Math.hypot(kp3.x + 272, kp3.z - 50); __ot.exit(); g.vehicles.reset('board-park');
    const n = F.dismiss(); __ot.teleport(-168, -166, 0); __ot.step(20); off1(); off2();
    return { dogs: dogs.length, town: !!town, townName: town && town.name, unknown, pup: !!pup, full, listed, near: mid.map(f => Math.hypot(f.x - kp.x, f.z - kp.z)), afterTimeout, far: far.map(f => Math.hypot(f.x - kp2.x, f.z - kp2.z)), riding: riding.map(f => Math.hypot(f.x - kp3.x, f.z - kp3.z)), moved, n, left: __ot.followers().length, log, max: F.max, dogsAfter: F.dogs().length, home: Math.hypot(town.dog.x - town.dog.home.x, town.dog.z - town.dog.home.z) < town.dog.home.r + 1, homeBefore }; });
  ok(T + 'followers: a town dog and a new dog walk with KC, keep up on foot, after a teleport and beside a ride, leave on a timer or when dismissed', fo.town && fo.pup && fo.unknown === null && fo.full === null && fo.listed === 2 && fo.near.length === 2 && fo.near.every(d => d < 9) && fo.afterTimeout === 1 && fo.far.length === 1 && fo.far[0] < 9 && fo.moved > 10 && fo.riding[0] < 16 && fo.n === 1 && fo.left === 0 && fo.dogsAfter === fo.dogs && fo.home && fo.log.includes('leave:Pip:timeout') && fo.log.some(l => /dismissed/.test(l)) && fo.max === 2,
    `${fo.townName} + Pip, gaps ${fo.near.map(d => d.toFixed(1)).join('/')}, after teleport ${fo.far.map(d => d.toFixed(1))}, beside the board ${fo.riding.map(d => d.toFixed(1))}; ${fo.log.join(' ')}`);

  /* cosmetics by id */
  const co = await page.evaluate(() => { const g = __ot.game, C = g.cosmetics, kc = g.kc, e = g.economy, bodyN = () => kc.parts.body.children.length, hatN = () => kc.parts.hatAnchor.children.length, b0 = bodyN();
    C.define([{ id: 'smoke:hat', slot: 'hat', name: 'Test cap', value: { type: 'cap', color: 0x3f7fd6 } }, { id: 'smoke:bandana', slot: 'bandana', name: 'Red', value: 0xd9534f, free: true }, { id: 'smoke:collar', slot: 'collar', value: 0x00ff00 }, { id: 'smoke:harness', slot: 'harness', value: 0xff00ff }, { id: 'smoke:tag', slot: 'tag', value: 0x112233 }, { id: 'smoke:trail', slot: 'trail', value: 0x7fd4ff },
      { id: 'smoke:outfit', slot: 'outfit', value: { type: 'cape', color: 0xc9483a } }, { id: 'smoke:board', slot: 'skin:skateboard', value: { primary: 0x112233, secondary: 0xffffff } }, { id: 'smoke:van', slot: 'skin:van', value: { primary: 0x445566 } }, { id: 'smoke:canoe', slot: 'skin:canoe', value: { primary: 0x778899 } }]);
    kc.registerHat('smokehat', (geo, c = 0xff0000) => { geo.box(0, 0.1, 0, 0.3, 0.2, 0.3, c); }); kc.registerOutfit('smokesuit', (geo, c = 0x00ff00) => { geo.box(0, 0.8, 0, 0.3, 0.05, 0.5, c); }); C.define({ id: 'smoke:hat2', slot: 'hat', value: 'smokehat', free: true }); C.define({ id: 'smoke:suit', slot: 'outfit', value: 'smokesuit', free: true });
    const notOwned = C.equip('smoke:hat'), unknown = C.equip('nope'), free = C.equip('smoke:bandana'), bandana = kc.parts.bandana.visible && kc.parts.bandanaMat.color.getHex();
    const prev = C.preview('smoke:hat'), hatPrev = hatN(), savedDuring = g.state.equipped.hat; C.endPreview(); const hatAfterPrev = hatN();
    e.grant({ items: ['smoke:hat', 'smoke:collar', 'smoke:harness', 'smoke:tag', 'smoke:trail', 'smoke:outfit', 'smoke:board', 'smoke:van', 'smoke:canoe'] }, 'smoke');
    const all = ['smoke:hat', 'smoke:collar', 'smoke:harness', 'smoke:tag', 'smoke:trail', 'smoke:outfit', 'smoke:board', 'smoke:van', 'smoke:canoe'].map(id => C.equip(id));
    const worn = { hat: hatN(), body: bodyN() - b0, collar: kc.parts.collarMat.color.getHex(), harness: kc.parts.harnessMat.color.getHex(), tag: kc.parts.tagMat.color.getHex(), trail: kc.cosmetics.trail, board: g.vehicles.skins.skateboard.primary, van: g.vehicles.skins.van.primary, canoe: g.vehicles.skins.canoe.primary, eq: { ...g.state.equipped } };
    const custom = C.equip('smoke:hat2') && C.equip('smoke:suit') && hatN() === 1 && bodyN() - b0 === 1; C.equip('smoke:hat'); C.equip('smoke:outfit');
    const un = C.unequip('collar') && C.unequip('skin:van') && C.unequip('tag'), after = { collar: kc.parts.collarMat.color.getHex(), van: g.vehicles.skins.van.primary, eq: g.state.equipped.collar, slots: C.list('hat').length, wearing: C.equipped('hat') };
    return { notOwned, unknown, free, bandana, prev, hatPrev, savedDuring, hatAfterPrev, all, worn, custom, un, after }; });
  ok(T + 'cosmetics: define, try on, equip (owned or free only) and unequip hats, outfits, collars, bandanas, harness, tag, trail and ride skins by id', co.notOwned === false && co.unknown === false && co.free && co.bandana === 0xd9534f && co.prev && co.hatPrev === 1 && co.savedDuring === undefined && co.hatAfterPrev === 0 && co.all.every(Boolean) && co.worn.hat === 1 && co.worn.body === 1 && co.worn.collar === 0x00ff00 && co.worn.harness === 0xff00ff && co.worn.tag === 0x112233 && co.worn.trail === 0x7fd4ff && co.worn.board === 0x112233 && co.worn.van === 0x445566 && co.worn.canoe === 0x778899
    && co.worn.eq.hat === 'smoke:hat' && co.worn.eq['skin:skateboard'] === 'smoke:board' && co.custom && co.un && co.after.collar === 0x3f7fd6 && co.after.van === 0x4fb0a8 && co.after.eq === undefined && co.after.slots === 2 && co.after.wearing === 'smoke:hat', JSON.stringify(co.worn.eq));
  await page.evaluate(() => { __ot.teleport(-168, -166, Math.PI / 2); __ot.setCam(Math.PI / 2 + 2.6, 0.25, 4.2); __ot.step(10); }); await wait(page, 120); await shot(page, `${name}-60-cosmetics`);

  /* placing things in the world */
  const pl = await page.evaluate(() => { const g = __ot.game, P = g.place, w = g.world, inter0 = g.api.interactables.size, mark0 = g.api.markers.size, zone0 = g.api.zones.size, kids0 = g.scene.children.length; let hits = [];
    const door = P.door('bakery'), tailor = P.door('tailor'), cafe = P.door('cafe'), none = P.door('nope'), stall = P.stall('Tag & Stamp'), cart = P.cart('Biscuit Wheel'), sign = P.sign('makers'), side = P.beside('pets', 1);
    const spots = [door, tailor, cafe, stall, cart, side].map(p => !!p && P.clear(p.x, p.z, 0.5));
    const at = (p, steps = 6) => { __ot.teleport(p.x, p.z, p.yaw ?? 0); __ot.step(steps); return __ot.state().prompt; }, use = () => { __ot.press('interact'); __ot.step(3); };
    const shelf = P.shelf({ id: 'smk:shelf', x: side.x, z: side.z, ry: side.ry, name: 'Dog gear', prompt: 'Look at the dog gear shelf', onInteract: () => hits.push('shelf'), marker: true }); const pShelf = at(shelf.front); use();
    const stand = P.stand({ id: 'smk:stand', kind: 'stall', x: -160, z: -150, ry: 0, name: 'Test Stand', col: 0x8a4fae, prompt: 'Visit the test stand', onInteract: () => hits.push('stand') }); const pStand = at(stand.front); use();
    const counter = P.counter({ id: 'smk:counter', x: door.x, z: door.z, prompt: 'Sniff the bakery counter', onInteract: () => hits.push('counter') }); const pCounter = at(door); use();
    const npc = P.npc({ id: 'smk:npc', x: -150, z: -160, yaw: 0, name: 'Juniper the baker', prompt: 'Talk to Juniper', onInteract: () => hits.push('npc'), marker: { label: 'Baker' } }); let talk = 0; const offT = g.on('talk', e => { if (e.id === 'smk:npc') talk++; }); const pNpc = at({ x: -150, z: -158.6, yaw: Math.PI }); use(); offT();
    npc.walkTo(-150, -152, 3); __ot.step(90); const walked = Math.hypot(npc.x + 150, npc.z + 152); npc.follow(true, 2.2); __ot.teleport(-140, -150, 0); __ot.step(150); const followed = Math.hypot(npc.x - g.kc.pos.x, npc.z - g.kc.pos.z); npc.follow(false);
    const mk = P.marker({ id: 'smk:marker', x: -170, z: -160, label: 'Lost glove', color: '#ff66cc', beacon: true, compass: true, prompt: 'Sniff the glove', onInteract: () => hits.push('marker') }); const pMarker = at({ x: -170, z: -161 }); use(); const mkIn = g.api.markers.get('smk:marker');
    let zin = 0, zout = 0, once = 0; P.zone({ id: 'smk:zone', x: -120, z: -160, r: 5 }, () => zin++, () => zout++); P.zone({ id: 'smk:once', x: -120, z: -160, r: 5, once: true, onEnter: () => once++ }); __ot.teleport(-120, -160, 0); __ot.step(10); __ot.teleport(-150, -160, 0); __ot.step(10); __ot.teleport(-120, -160, 0); __ot.step(10); __ot.teleport(-150, -160, 0); __ot.step(10);
    let got = []; const offC = g.on('collect', e => got.push(e.kind)); for (const [i, k] of ['flag', 'disc', 'lantern', 'litter', 'star', 'parcel', 'paper', 'bucket', 'glove', 'pumpkin', 'treat'].entries()) P.pickup({ id: 'smk:pk' + i, kind: k, x: -176 + i * 3, z: -146, onCollect: () => hits.push('pk') });
    const pkShown = g.seams.pickups.size; __ot.teleport(-179, -146, Math.PI / 2); __ot.setCam(Math.PI / 2, 0.3, 8); __ot.hold('KeyW', true); for (let i = 0; i < 40 && got.length < 11; i++) __ot.step(10); __ot.hold('KeyW', false); offC();
    const den = P.staged({ id: 'smk:den', x: -150, z: -172, ry: 0, level: 0, stages: [{ kind: 'tent', col: 0xd9534f }, [{ kind: 'building', style: 'shed', w: 5, d: 4, h: 3, col: 0x9a6a42, roof: 'gable', f: 's' }, { kind: 'bench', dx: 4, dz: 1 }], (x, z) => g.spawnProp('campfire', x + 3, z + 3)] }); let stg = []; const offS = g.on('stageChanged', e => stg.push(e.level));
    const tri = h => { let n = 0; for (const p of [h]) n += 1; return n; }, blocked0 = w.blockedAt(-150, -172, w.heightAt(-150, -172), 0.3), l0 = den.level; den.setLevel(1); const l1 = den.level, blocked1 = w.blockedAt(-150, -172, w.heightAt(-150, -172), 0.3); den.setLevel(2); const l2 = den.level; den.setLevel(99); const l3 = den.level; offS();
    const fund = P.staged({ id: 'smk:fund', x: -160, z: -176, additive: true, level: -1, stages: [{ kind: 'bench' }, { kind: 'lamp', dx: 2 }, { kind: 'fountain', dx: -5, r: 1.6 }] }); const f0 = fund.level; fund.setLevel(2, true);
    const tracked = ['smk:shelf', 'smk:stand', 'smk:counter', 'smk:npc', 'smk:marker', 'smk:zone', 'smk:den', 'smk:fund'].every(id => !!P.get(id)), standers = g.npcs.standers.length;
    const removed = P.removeAll('smk:'), clean = { inter: g.api.interactables.size - inter0, mark: g.api.markers.size - mark0, zone: g.api.zones.size - zone0, kids: g.scene.children.length - kids0, standers: g.npcs.standers.length, pk: g.seams.pickups.size, free: !w.blockedAt(-150, -172, w.heightAt(-150, -172), 0.3) };
    return { door, none, stall: !!stall, cart: !!cart, sign: !!sign, spots, pShelf, pStand, pCounter, pNpc, pMarker, talk, walked, followed, mk: !!mkIn && mkIn.compass && mkIn.beacon, zin, zout, once, got, pkShown, hits, stg, l0, l1, l2, l3, blocked0, blocked1, f0, fl: fund.level, tracked, standers, removed, clean }; });
  ok(T + 'place.door / beside / stall / cart / sign find open ground at the shops and stalls', pl.door && pl.none === null && pl.stall && pl.cart && pl.sign && pl.spots.every(Boolean) && Math.abs(pl.door.x + 211.4) < 0.01, pl.spots.join(','));
  ok(T + 'place.shelf / stand / counter / npc / marker give a prompt that runs the callback', /dog gear/.test(pl.pShelf || '') && /test stand/.test(pl.pStand || '') && /bakery counter/.test(pl.pCounter || '') && /Juniper/.test(pl.pNpc || '') && /glove/.test(pl.pMarker || '') && ['shelf', 'stand', 'counter', 'npc', 'marker'].every(h => pl.hits.includes(h)) && pl.talk === 1 && pl.mk, [pl.pShelf, pl.pStand, pl.pCounter, pl.pNpc, pl.pMarker].join(' | '));
  ok(T + 'a placed person walks to a point and follows KC; zones fire on the way in and out (once: true only once)', pl.walked < 1 && pl.followed < 4 && pl.zin === 2 && pl.zout === 2 && pl.once === 1, `walk ${pl.walked.toFixed(1)}, follow gap ${pl.followed.toFixed(1)}, zone ${pl.zin}/${pl.zout}/${pl.once}`);
  ok(T + 'place.pickup: eleven kinds, collected by running through them', pl.pkShown === 11 && pl.got.length === 11 && pl.hits.filter(h => h === 'pk').length === 11, pl.got.join(','));
  ok(T + 'place.staged: a world object changes look by level (replace or additive) and place.removeAll leaves nothing behind', pl.l0 === 0 && pl.l1 === 1 && pl.l2 === 2 && pl.l3 === 2 && pl.stg.join() === '1,2' && pl.blocked0 && pl.blocked1 && pl.f0 === -1 && pl.fl === 2 && pl.tracked && pl.standers === 1 && pl.removed >= 8 && pl.clean.inter === 0 && pl.clean.mark === 0 && pl.clean.zone === 0 && pl.clean.kids === 0 && pl.clean.standers === 0 && pl.clean.pk === 0 && pl.clean.free, JSON.stringify(pl.clean));

  /* objective without a place, timed run with checkpoints, HUD timer */
  const tr = await page.evaluate(async () => { const g = __ot.game, log = []; __ot.exit(); __ot.teleport(-168, -166, Math.PI / 2); __ot.step(4); g.setObjective({ label: 'Bark at the echo point', progress: '1/3' }); __ot.step(12); const textObj = document.getElementById('objective').textContent; g.setObjective({ x: -100, z: -100, label: 'Earlier goal' });
    const offs = ['runStart', 'runCheckpoint', 'runEnd'].map(t => g.on(t, e => log.push(t + (e.index != null ? e.index : '') + (e.reason ? ':' + e.reason : '')))); let fin = null, cps = [];
    const run = g.timedRun({ id: 'smoke-run', label: 'Paper round', seconds: 95, checkpoints: [{ x: -160, z: -166, label: 'First doorstep' }, { x: -150, z: -166, r: 2 }, { x: -140, z: -166 }], onCheckpoint: i => cps.push(i), onFinish: r => { fin = r; } });
    __ot.step(12); const el = document.getElementById('runTimer'), obj = document.getElementById('objective'), rc = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
    const hud = ['minimapBtn', 'zone', 'clock', 'compass', 'objective', 'runTimer', 'wallet', 'hudBtns', 'bc'].map(id => ({ id, ...rc(document.getElementById(id)) })), pad = [...document.querySelectorAll('#pad button')].filter(e => e.offsetParent).map(e => ({ id: 'pad', ...rc(e) }));
    const during = { timer: el.textContent, hidden: el.hidden, objective: obj.textContent, same: g.run === run, state: __ot.state().run, hud, pad, vw: innerWidth, vh: innerHeight };
    __ot.teleport(-160, -166, 0); __ot.step(8); const aim2 = { ...g.api.objective }; __ot.teleport(-150, -166, 0); __ot.step(8); __ot.teleport(-140, -166, 0); __ot.step(8);
    const done = { fin, cps, timerHidden: el.hidden, cur: g.run, objBack: g.api.objective && g.api.objective.label };
    let fail = null; const r2 = g.timedRun({ id: 'smoke-short', label: 'Hay maze', seconds: 1.2, onFinish: r => { fail = r; } }); __ot.step(20); const warn = el.classList.contains('warn'); __ot.step(40);
    let rep = null, sw = null; const r3 = g.timedRun({ id: 'smoke-a', onFinish: r => { rep = r; } }), r4 = g.timedRun({ id: 'smoke-b', label: 'Stop-watch', onFinish: r => { sw = r; } }); __ot.step(30); const up = r4.time; r4.finish(true); g.setObjective(null); offs.forEach(f => f());
    return { textObj, during, aim2, done, fail, warn, rep, sw, up, log }; });
  { const d = tr.during, inside = b => b.x >= -1 && b.y >= -1 && b.r <= d.vw + 1 && b.b <= d.vh + 1, hit = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1; let clash = '';
    for (let i = 0; i < d.hud.length; i++) for (let j = i + 1; j < d.hud.length; j++) if (hit(d.hud[i], d.hud[j])) clash += d.hud[i].id + '/' + d.hud[j].id + ' '; for (const h of d.hud) for (const p of d.pad) if (hit(h, p)) clash += h.id + '/pad ';
    ok(T + 'a text-only objective shows its progress; the run timer and objective sit on the HUD without covering anything', /Bark at the echo point\s*1\/3/.test(tr.textObj) && !d.hidden && /Paper round\s+1:3\d\s+·\s+0\/3/.test(d.timer) && /First doorstep/.test(d.objective) && d.same && d.state && d.state.id === 'smoke-run' && d.hud.every(inside) && !clash, clash || `"${d.timer}" / "${d.objective}"`);
    ok(T + 'timedRun: checkpoints in order, finish, time-out, replace and stop-watch', tr.aim2.x === -150 && tr.done.fin && tr.done.fin.ok && tr.done.fin.left > 90 && tr.done.cps.join() === '0,1,2' && tr.done.timerHidden && tr.done.cur === null && tr.done.objBack === 'Earlier goal' && tr.fail && !tr.fail.ok && tr.fail.reason === 'time' && tr.warn && tr.rep && tr.rep.reason === 'replaced' && tr.sw && tr.sw.ok && tr.sw.left === null && tr.up > 0.9, tr.log.join(' ')); }
  await page.evaluate(() => { const g = __ot.game; g.timedRun({ id: 'shot', label: 'Paper round', seconds: 95, checkpoints: [{ x: -150, z: -166, label: 'Flour & Paw Bakery' }] }); __ot.step(12); }); await wait(page, 120); await shot(page, `${name}-61-timed-run`); await page.evaluate(() => { __ot.game.run.cancel(); __ot.game.setObjective(null); });

  /* fast travel and the map */
  await page.evaluate(() => { const g = __ot.game; window.__tr = []; g.on('fastTravel', e => window.__tr.push(e)); g.travel.add({ id: 'smoke-den', name: 'KC\'s Den', x: -160, z: -160, yaw: 0 }); g.travel.add({ id: 'smoke-sign', name: 'Scappoose sign', x: -272, z: 50, yaw: 0.3 }); g.travel.add({ id: 'smoke-locked', name: 'Locked', x: 0, z: 0, enabled: () => false }); __ot.teleport(-168, -166, 0); __ot.step(3); g.ui.map(); });
  await page.waitForSelector('#mapCanvas'); await wait(page, 200); await shot(page, `${name}-62-map-travel`);
  const mp = await page.evaluate(() => { const rc = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, cv = rc(document.getElementById('mapCanvas')), zs = [...document.querySelectorAll('.mapzoom button')].map(rc), chips = [...document.querySelectorAll('[data-travel]')].map(e => ({ id: e.dataset.travel, ...rc(e) })), card = rc(document.querySelector('#modal .card'));
    const over = zs.filter(z => z.x < cv.r - 1 && cv.x < z.r - 1 && z.y < cv.b - 1 && cv.y < z.b - 1).length; return { cv, zs: zs.length, over, small: zs.filter(z => z.w < 44 || z.h < 44).length, chips, card, vw: innerWidth, vh: innerHeight, list: __ot.game.travel.list().map(p => p.id) }; });
  ok(T + 'map: zoom buttons sit outside the map (no label hidden), 44 px, and unlocked fast-travel points get a button', mp.zs === 3 && mp.over === 0 && mp.small === 0 && mp.cv.w > 150 && mp.chips.length === 2 && mp.chips.every(c => c.h >= 44) && mp.list.join() === 'smoke-den,smoke-sign' && mp.card.r <= mp.vw + 1 && mp.card.b <= mp.vh + 1, `${mp.chips.length} travel buttons, map ${Math.round(mp.cv.w)} px`);
  await tapSel(page, touch, '[data-travel="smoke-sign"]'); await page.waitForFunction(() => window.__tr.length === 1 && !__ot.game.ui.fading, null, { timeout: 5000 }).catch(() => {});
  const ft = await page.evaluate(async () => { const g = __ot.game; __ot.step(5); const s = __ot.state(), ev = window.__tr[0]; g.travel.blocked = 'Finish the delivery first'; const refused = g.fastTravel(-160, -160, 0); g.travel.blocked = null; const bad = g.fastTravel(NaN, 0); for (const id of ['smoke-den', 'smoke-sign', 'smoke-locked']) g.travel.remove(id); return { pos: s.pos, modal: s.modal, ev, refused, bad, left: g.travel.list().length }; });
  ok(T + 'fast travel from the map moves KC, closes the map and can be held by a module', Math.hypot(ft.pos.x + 272, ft.pos.z - 50) < 2 && ft.modal === null && ft.ev && ft.ev.id === 'smoke-sign' && ft.refused === false && ft.bad === false && ft.left === 0, `${ft.pos.x.toFixed(0)},${ft.pos.z.toFixed(0)}`);

  /* the Shop with many tabs */
  await page.evaluate(() => { const g = __ot.game; window.__un = []; window.__drawn = []; const titles = ['Upgrades', 'Wardrobe', 'Rides', 'KC\'s Den', 'Trail Buddies', 'Businesses', 'Town Fund', 'Trail Journal', 'Real Gear', 'Grown-ups'];
    titles.forEach((t, i) => window.__un.push(g.shop.registerTab({ id: 'smoke' + i, title: t, order: i, icon: i === 0 ? 'bolt' : null, badge: i === 2 ? () => 3 : 0, render: (pane, game, handle) => { window.__drawn.push(i); pane.appendChild(g.ui.heading(t, 'Stitch & Sit Costume Tailor')); pane.appendChild(g.ui.grid(Array.from({ length: 16 }, (_, k) => ({ id: 's' + k, title: t + ' item ' + k, text: 'A wide brim for sunny trails', swatch: 0x6f8f4f + k * 4000, price: k % 3 ? { bones: 150 + k * 10 } : { gems: 40 }, tag: k === 1 ? 'Owned' : '', locked: k === 2 ? 'Needs 200 jumps' : '', button: { label: k === 1 ? 'Wear' : 'Get', onClick: () => { window.__clicked = k; } } })))); pane.appendChild(g.ui.progress(30, 100, '30 of 100 bones')); pane.appendChild(g.ui.note('Bones cannot be bought with money.')); } })));
    g.shop.open('smoke6'); });
  await page.waitForSelector('.tabstrip'); await wait(page, 250); await shot(page, `${name}-63-shop-tabs`);
  const sh = await page.evaluate(() => { const rc = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, strip = document.querySelector('.tabstrip'), body = document.getElementById('modalBody'), tabs = [...strip.children], on = strip.querySelector('.on'), card = rc(document.querySelector('#modal .card'));
    const a = { n: tabs.length, minH: Math.min(...tabs.map(t => rc(t).h)), order: tabs.map(t => t.dataset.tab).join(), on: on && on.dataset.tab, onVisible: on && rc(on).x >= rc(strip).x - 1 && rc(on).r <= rc(strip).r + 1, stripScrolls: strip.scrollWidth > strip.clientWidth + 4, bodyScrolls: body.scrollHeight > body.clientHeight + 40, badge: !!strip.querySelector('[data-tab="smoke2"] .badge'), wallet: !document.getElementById('modalWallet').hidden && /\d/.test(document.getElementById('modalWallet').textContent), card, vw: innerWidth, vh: innerHeight, items: document.querySelectorAll('.item').length, btnMin: Math.min(...[...document.querySelectorAll('.item .btn')].map(b => rc(b).h)), lockedOff: document.querySelector('[data-item="s2"] .btn').disabled, itemFits: [...document.querySelectorAll('.item')].every(i => rc(i).x >= card.x - 1 && rc(i).r <= card.r + 1) };
    body.scrollTop = 400; a.pinned = Math.abs(rc(strip).y - rc(body).y) < 3 && body.scrollTop > 300; a.current = __ot.game.shop.current; return a; });
  ok(T + 'Shop hosts ten tabs: a scrolling strip of 44 px tabs in order, pinned above a scrolling body, balance in the header, nothing off screen', sh.n === 10 && sh.minH >= 44 && sh.order === Array.from({ length: 10 }, (_, i) => 'smoke' + i).join() && sh.on === 'smoke6' && sh.onVisible && (sh.stripScrolls || sh.vw > 1000) && sh.bodyScrolls && sh.pinned && sh.badge && sh.wallet && sh.items === 16 && sh.btnMin >= 44 && sh.lockedOff && sh.itemFits && sh.card.x >= -1 && sh.card.r <= sh.vw + 1 && sh.card.y >= -1 && sh.card.b <= sh.vh + 1 && sh.current === 'smoke6',
    `${sh.n} tabs, min height ${Math.round(sh.minH)}, strip scrolls ${sh.stripScrolls}, body scrolls ${sh.bodyScrolls}, pinned ${sh.pinned}`);
  await page.evaluate(() => { const s = document.querySelector('.tabstrip'); s.style.scrollBehavior = 'auto'; s.scrollLeft = s.scrollWidth; }); await wait(page, 80); await tapSel(page, touch, '.tabstrip [data-tab="smoke9"]'); await wait(page, 150);
  await page.evaluate(() => { document.getElementById('modalBody').scrollTop = 0; }); await tapSel(page, touch, '[data-item="s0"] .btn'); await wait(page, 60);
  const sh2 = await page.evaluate(() => { const g = __ot.game, r = { on: document.querySelector('.tabstrip .on').dataset.tab, head: document.querySelector('.tabpane .sech').textContent, clicked: window.__clicked, current: g.shop.current, top: document.getElementById('modalBody').scrollTop };
    document.getElementById('modalBody').scrollTop = 300; g.shop.refresh(); r.keptScroll = document.getElementById('modalBody').scrollTop > 200; g.ui.closeAll(); g.shop.open(); r.remembered = document.querySelector('.tabstrip .on').dataset.tab; window.__un.forEach(f => f()); r.tabsLeft = g.shop.tabs.length; r.closed = __ot.state().modal; return r; });
  ok(T + 'tapping a tab swaps the pane, a card button works, refresh keeps the scroll place, the last tab is remembered, removing every tab closes the Shop', sh2.on === 'smoke9' && /Grown-ups/.test(sh2.head) && sh2.clicked === 0 && sh2.current === 'smoke9' && sh2.keptScroll && sh2.remembered === 'smoke9' && sh2.tabsLeft === 0 && sh2.closed === null, JSON.stringify(sh2));

  /* economy helpers and the two-step spend */
  const ec = await page.evaluate(async () => { const g = __ot.game, e = g.economy, w = g.wallet; e.grant({ bones: 500, gems: 20, items: [{ id: 'smoke:treat', n: 3 }] }, 'smoke'); const b0 = w.get('bones'), g0 = w.get('gems');
    const r = { count: e.count('smoke:treat'), use2: e.use('smoke:treat', 2), left: e.count('smoke:treat'), useTooMany: e.use('smoke:treat', 2), use1: e.use('smoke:treat'), gone: e.owns('smoke:treat'), can: e.canAfford({ bones: 100, gems: 5 }), cant: e.canAfford({ bones: 100, gems: 9999 }), spendNo: e.spend({ bones: 100, gems: 9999 }), unchanged: w.get('bones') === b0, spendYes: e.spend({ bones: 100, gems: 5 }, 'smoke'), after: [b0 - w.get('bones'), g0 - w.get('gems')] };
    let bought = null; const off = g.on('purchase', p => { bought = p; }); const p1 = g.ui.confirmSpend({ id: 'smoke:hat9', name: 'Ranger hat', text: 'A wide brim for sunny trails', price: { bones: 150 }, swatch: 0x6f8f4f, source: 'smoke' }); await new Promise(q => setTimeout(q, 60));
    r.screen = document.getElementById('modalBody').textContent; r.title = document.getElementById('modalTitle').textContent; r.btns = [...document.querySelectorAll('#modalActions .btn')].map(b => b.getBoundingClientRect().height); const b1 = w.get('bones'); document.querySelector('#modalActions .go').click(); r.yes = await p1; r.paid = b1 - w.get('bones'); r.bought = bought;
    const p2 = g.ui.confirmSpend({ name: 'Crown', price: { bones: 9999999 } }); await new Promise(q => setTimeout(q, 60)); r.short = document.getElementById('modalTitle').textContent + ' ' + document.getElementById('modalBody').textContent; const b2 = w.get('bones'); document.querySelector('#modalActions .go').click(); r.no = await p2; r.kept = w.get('bones') === b2;
    const p3 = g.ui.confirmSpend({ name: 'Bandana', price: 40 }); await new Promise(q => setTimeout(q, 60)); g.ui.closeModal(); r.dismissed = await p3; off(); return r; });
  ok(T + 'economy count / use / canAfford / spend, and ui.confirmSpend shows item, price and the balance afterwards before charging', ec.count === 3 && ec.use2 && ec.left === 1 && !ec.useTooMany && ec.use1 && !ec.gone && ec.can && !ec.cant && !ec.spendNo && ec.unchanged && ec.spendYes && ec.after.join() === '100,5' && /Ranger hat/.test(ec.screen) && /150/.test(ec.screen) && /Afterwards KC will have/.test(ec.screen) && ec.btns.every(h => h >= 40) && ec.yes === true && ec.paid === 150 && ec.bought && ec.bought.price.bones === 150 && /Not enough yet/.test(ec.short) && ec.no === false && ec.kept && ec.dismissed === false, ec.screen.slice(0, 80));

  /* grown-up gate, spending switch, leaving links */
  const g0 = await page.evaluate(() => { const g = __ot.game; window.__gate = []; g.on('gate', e => window.__gate.push(e.ok)); window.__keep = () => JSON.stringify(['settings', 'flags', 'modules', 'owned', 'equipped', 'wallet', 'upgrades'].map(k => g.state[k])); window.__before = window.__keep(); window.__g1 = null; g.ui.gate({ reason: 'This opens the real-money shop.' }).then(v => { window.__g1 = v; }); return { spending: g.grownUp.spending, saved: g.state.settings.spending, show: g.grownUp.showSwitch }; });
  await page.waitForSelector('.modal.gate .keypad'); await wait(page, 120); await shot(page, `${name}-64-grown-up-gate`);
  const gk = await page.evaluate(() => { const rc = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, keys = [...document.querySelectorAll('.keypad button')].map(rc), card = rc(document.querySelector('#modal .card')); return { n: keys.length, min: Math.min(...keys.map(k => Math.min(k.w, k.h))), fits: card.x >= -1 && card.y >= -1 && card.r <= innerWidth + 1 && card.b <= innerHeight + 1 && keys.every(k => k.b <= innerHeight && k.y >= 0), text: document.getElementById('modalBody').textContent, inputs: document.querySelectorAll('#modal input').length, paused: __ot.state().paused }; });
  await passGate(page, touch); await page.waitForFunction(() => window.__g1 !== null, null, { timeout: 3000 }).catch(() => {});
  const g1 = await page.evaluate(() => ({ ok: window.__g1, modal: __ot.state().modal, same: window.__keep() === window.__before, stored: Object.keys(localStorage).join(',') }));
  await page.evaluate(() => { window.__g2 = null; __ot.game.ui.gate({}).then(v => { window.__g2 = v; }); }); for (let i = 0; i < 3; i++) await passGate(page, touch, true); await page.waitForFunction(() => window.__g2 !== null, null, { timeout: 3000 }).catch(() => {});
  const g2 = await page.evaluate(async () => { const r = { wrong: window.__g2, modal: __ot.state().modal, shut: await __ot.game.ui.gate({}), events: window.__gate.join() }; return r; });
  ok(T + 'grown-up gate: a times-table question on a 44 px number pad (no text box), right answer passes, three wrong answers shut it; nothing is stored', g0.spending === false && g0.saved === false && gk.n === 12 && gk.min >= 44 && gk.fits && gk.inputs === 0 && gk.paused && /grown-up/i.test(gk.text) && /\d+\s*×\s*\d+/.test(gk.text) && g1.ok === true && g1.modal === null && g1.same && g2.wrong === false && g2.modal === null && g2.shut === false && g2.events === 'true,false,false' && !/gate/i.test(g1.stored), `keys ${Math.round(gk.min)} px; ${g2.events}`);
  /* the 30 s lock-out lives in memory only: a reload clears it, so the remaining gate checks run after the save / reload step (seamChecksAfterReload) */
}
/* after the reload: what was saved is back, and the gated flows (spending switch, leaving link, Settings rows) work */
async function seamChecksAfterReload(page, name, touch) {
  const T = name + ': seam: ';
  const bk = await page.evaluate(() => { const g = __ot.game, C = g.cosmetics, before = { eq: { ...g.state.equipped }, hat: g.kc.parts.hatAnchor.children.length, data: g.moduleData('smoke', { n: 0, list: [] }), owned: g.economy.owns('smoke:hat') };
    C.define({ id: 'smoke:hat', slot: 'hat', value: { type: 'cap', color: 0x3f7fd6 } }); C.define({ id: 'smoke:board', slot: 'skin:skateboard', value: { primary: 0x112233, secondary: 0xffffff } });
    return { before, hat: g.kc.parts.hatAnchor.children.length, board: g.vehicles.skins.skateboard.primary, spending: g.grownUp.spending }; });
  ok(T + 'after a reload: equipped ids, owned items and module data are back, and a cosmetic is put on as soon as its module defines it', bk.before.eq.hat === 'smoke:hat' && bk.before.eq['skin:skateboard'] === 'smoke:board' && bk.before.hat === 0 && bk.before.owned && bk.before.data.n === 7 && bk.before.data.list.join() === 'a,b' && bk.hat === 1 && bk.board === 0x112233 && bk.spending === false, JSON.stringify(bk.before.eq));
  if (!(await page.evaluate(() => __ot.state().started))) { await tapSel(page, touch, '#playBtn'); await page.waitForFunction(() => __ot.state().started); }
  await page.evaluate(() => { window.__ext = []; document.addEventListener('click', e => { const a = e.target && e.target.closest && e.target.closest('a[target="_blank"]'); if (a) { e.preventDefault(); window.__ext.push({ href: a.href, rel: a.rel }); } }, true);
    const g = __ot.game; window.__set = { v: false, clicks: 0 }; g.ui.addSetting({ id: 'smoke-check', label: 'Smoke test switch', type: 'check', get: () => window.__set.v, set: v => { window.__set.v = v; } }); g.ui.addSetting({ id: 'smoke-button', label: 'Restore purchases', type: 'button', button: 'Restore', onClick: () => { window.__set.clicks++; } });
    window.__sp = []; g.on('spending', e => window.__sp.push(e.on)); g.ui.settings(); });
  await page.waitForSelector('[data-set="smoke-check"]');
  const s0 = await page.evaluate(() => ({ sw: !!document.querySelector('[data-set="spending"]'), rows: !!document.querySelector('[data-set="smoke-button"]') }));
  await page.evaluate(() => { const g = __ot.game; document.querySelector('[data-set="smoke-check"]').click(); document.querySelector('[data-set="smoke-button"]').click(); g.ui.closeAll(); g.grownUp.showSwitch = true; g.ui.settings(); });
  await page.waitForSelector('[data-set="spending"]'); await page.evaluate(() => document.querySelector('[data-set="spending"]').scrollIntoView()); await tapSel(page, touch, '[data-set="spending"]');
  await passGate(page, touch); await page.waitForFunction(() => window.__sp.length === 1, null, { timeout: 3000 }).catch(() => {}); await wait(page, 80);
  const s1 = await page.evaluate(async () => { const g = __ot.game, r = { on: g.grownUp.spending, saved: JSON.parse(localStorage.getItem(g.save.key)).settings.spending, box: document.querySelector('[data-set="spending"]').checked, modal: __ot.state().modal, set: { ...window.__set }, ev: window.__sp.join() };
    r.off = await g.grownUp.setSpending(false); r.now = g.grownUp.spending; r.ev2 = window.__sp.join(); g.ui.closeAll(); g.grownUp.showSwitch = false; return r; });
  ok(T + 'real-money spending is off until a grown-up passes the gate; Settings shows the switch only when a store asks; ui.addSetting rows work', !s0.sw && s0.rows && s1.on === true && s1.saved === true && s1.box === true && s1.modal === 'settings' && s1.set.v === true && s1.set.clicks === 1 && s1.ev === 'true' && s1.off === true && s1.now === false && s1.ev2 === 'true,false', JSON.stringify(s1.set));
  const ex0 = await page.evaluate(async () => { const g = __ot.game; const bad = [await g.ui.openExternal({ url: 'http://example.com/' }), await g.ui.openExternal({ url: 'javascript:alert(1)' }), await g.ui.openExternal({ url: 'not a url' })]; window.__ex = null; g.ui.openExternal({ url: 'https://kcbeyondlimits.com/product/34460072', name: 'the KC Beyond Limits shop', note: 'Printed to order; shipping is added at checkout.' }).then(v => { window.__ex = v; }); return bad; });
  await passGate(page, touch); await page.waitForFunction(() => __ot.state().modal === 'leaving', null, { timeout: 3000 }).catch(() => {}); await wait(page, 120); await shot(page, `${name}-65-leaving-the-game`);
  const ex1 = await page.evaluate(() => ({ text: document.getElementById('modalBody').textContent, title: document.getElementById('modalTitle').textContent, opened: window.__ext.length }));
  await tapSel(page, touch, '#modalActions .go'); await page.waitForFunction(() => window.__ex !== null, null, { timeout: 3000 }).catch(() => {});
  const ex2 = await page.evaluate(() => ({ res: window.__ex, links: window.__ext, modal: __ot.state().modal }));
  ok(T + 'ui.openExternal: https only, gate first, a leaving screen that names the site, then a new tab with rel="noopener noreferrer"', ex0.every(v => v === false) && /Leaving the game/.test(ex1.title) && /separate website/.test(ex1.text) && /kcbeyondlimits\.com/.test(ex1.text) && ex1.opened === 0 && ex2.res === true && ex2.links.length === 1 && ex2.links[0].href === 'https://kcbeyondlimits.com/product/34460072' && /noopener/.test(ex2.links[0].rel) && /noreferrer/.test(ex2.links[0].rel) && ex2.modal === null, ex1.text.slice(0, 70));

  /* photo mode overlay */
  const ph0 = await page.evaluate(() => { const g = __ot.game, P = g.photo; __ot.teleport(-168, -166, Math.PI / 2); __ot.setCam(Math.PI / 2 + 2.6, 0.25, 5); __ot.step(8); const locked = ['frame', 'filter', 'sticker', 'pose'].map(k => P.available(k).length).join() + ',' + P.available('zoom'), all = ['frame', 'filter', 'sticker', 'pose'].map(k => P.all(k).length).join();
    const refused = [P.setFrame('postcard'), P.setFilter('warm'), P.addSticker('paw'), P.setZoom(2), P.setPose('sit')]; g.ui.photoMode(true); const bare = document.getElementById('phototools').hidden;
    P.unlock('frame', ['postcard', 'polaroid']); const some = P.available('frame').length; P.unlock('frame'); P.unlock('filter'); P.unlock('sticker'); P.unlock('pose'); P.unlock('zoom');
    P.registerFrame('smoke', { name: 'Smoke', draw(x, w, h) { x.fillStyle = '#ff00ff'; x.fillRect(0, 0, w, h * 0.1); } }); P.registerFilter('smokef', { name: 'Smoke', css: 'hue-rotate(90deg)' }); P.registerSticker('smokes', { name: 'Smoke', draw(x, s) { x.fillStyle = '#00ffff'; x.fillRect(-s / 2, -s / 2, s, s); } });
    P.setFrame('polaroid'); P.setFilter('sepia'); const st1 = P.addSticker('paw', { x: 0.3, y: 0.4 }), st2 = P.addSticker('woof'); P.addSticker('smokes', { x: 0.5, y: 0.5, size: 0.2 }); P.setZoom(2); P.setPose('sit'); return { locked, all, refused, bare, some, st1, st2 }; });
  await wait(page, 500); await tapSel(page, touch, '[data-tool="sticker"]'); await wait(page, 150); await shot(page, `${name}-66-photo-frame-stickers`);
  const ph1 = await page.evaluate(async () => { const g = __ot.game, P = g.photo, rc = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, tools = [...document.querySelectorAll('#phototools button')], tray = [...document.querySelectorAll('#phototray button')], bar = [document.getElementById('photoSnap'), document.getElementById('photoExit')].map(rc);
    const r = { tools: tools.map(t => t.dataset.tool).join(), toolMin: Math.min(...tools.map(t => rc(t).h)), trayN: tray.length, trayMin: Math.min(...tray.map(t => Math.min(rc(t).w, rc(t).h))), barIn: bar.every(b => b.x >= 0 && b.r <= innerWidth && b.b <= innerHeight && b.h >= 44), rowsIn: ['phototools', 'phototray'].every(id => { const b = rc(document.getElementById(id)); return b.x >= -1 && b.r <= innerWidth + 1 && b.b <= innerHeight + 1; }), stickers: document.querySelectorAll('#photoLayer .stk').length, css: document.getElementById('game').style.filter, fov: g.cam.three.fov, baseFov: g.cam.baseFov, sit: g.kc.sit, state: P.state(), hud: document.getElementById('hud').hidden };
    let taken = null; const off = g.on('photoTaken', e => { taken = e; }); g.ui.snap(); off(); const c = g.ui.lastPhotoCanvas, x = c.getContext('2d'), px = (fx, fy) => [...x.getImageData(Math.round(fx * (c.width - 1)), Math.round(fy * (c.height - 1)), 1, 1).data].slice(0, 3);
    r.border = px(0.5, 0.004); r.band = px(0.02, 0.97); r.sticker = px(0.5, 0.5); r.taken = taken; r.size = [c.width, c.height]; P.setFrame('smoke'); P.setFilter(null); g.ui.snap(); const c2 = g.ui.lastPhotoCanvas; r.custom = [...c2.getContext('2d').getImageData(c2.width >> 1, 2, 1, 1).data].slice(0, 3);
    P.removeSticker(); const n1 = P.state().stickers.length; P.clearStickers(); r.cleared = [n1, P.state().stickers.length]; P.lock('frame', 'smoke'); r.lockedOut = P.state().frame; g.ui.photoMode(false); __ot.step(20);
    r.after = { css: document.getElementById('game').style.filter, layer: document.getElementById('photoLayer').hidden, hud: document.getElementById('hud').hidden, fov: g.cam.three.fov, sit: g.kc.sit, photo: __ot.state().photo, beacons: g.scene.getObjectByName('beacons').visible }; P.lock('frame'); P.lock('filter'); P.lock('sticker'); P.lock('pose'); P.lock('zoom'); return r; });
  ok(T + 'photo presets start locked; a module unlocks or registers frames, filters, stickers, poses and zoom', ph0.locked === '0,0,0,0,false' && ph0.all === '6,5,7,4' && ph0.refused.join() === ',,-1,1,' && ph0.bare && ph0.some === 2 && ph0.st1 === 0 && ph0.st2 === 1, `${ph0.all} presets`);
  ok(T + 'photo tools are 44 px, on screen and scroll sideways; the live view shows filter, zoom, pose and draggable stickers', ph1.tools === 'frame,filter,zoom,pose,sticker' && ph1.toolMin >= 44 && ph1.trayN >= 9 && ph1.trayMin >= 44 && ph1.barIn && ph1.rowsIn && ph1.stickers === 3 && /sepia/.test(ph1.css) && ph1.fov < ph1.baseFov * 0.62 && ph1.sit && ph1.hud && ph1.state.frame === 'polaroid' && ph1.state.zoom === 2 && ph1.state.pose === 'sit', `${ph1.tools}; fov ${ph1.fov.toFixed(0)} of ${ph1.baseFov}`);
  ok(T + 'the saved photo carries the frame and stickers, photoTaken says which, and leaving photo mode puts the view back', ph1.border.every(v => v > 235) && ph1.band.every(v => v > 235) && ph1.sticker[0] < 40 && ph1.sticker[1] > 215 && ph1.sticker[2] > 215 && ph1.taken && ph1.taken.frame === 'polaroid' && ph1.taken.filter === 'sepia' && ph1.taken.stickers.length === 3 && ph1.size[0] > 300 && ph1.custom[0] > 240 && ph1.custom[1] < 20 && ph1.cleared.join() === '2,0' && ph1.lockedOut === null && ph1.after.css === '' && ph1.after.layer && !ph1.after.hud && Math.abs(ph1.after.fov - ph1.baseFov) < 8 && !ph1.after.sit && !ph1.after.photo && ph1.after.beacons, `border ${ph1.border}, sticker ${ph1.sticker}, custom ${ph1.custom}`);
}

async function runViewport(browser, name, vp, touch, quality, tourIdx) {
  console.log(`\n=== ${name} (${vp.width}x${vp.height}${touch ? ', touch' : ''}, quality ${quality}) ===`);
  const { ctx, page, errors, requests } = await open(browser, touch ? { viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: vp }, `?debug=1&nosw=1&q=${quality}`);
  const R = report.viewports[name] = { districts: [] };
  ok(`${name}: loads with debug hooks, title screen up`, await page.isVisible('#title') && !(await st(page)).started);
  ok(`${name}: audio is off until the first tap`, await page.evaluate(() => !__ot.game.audio.ready));
  await shot(page, `${name}-00-title`);
  if (touch) await page.tap('#playBtn'); else await page.click('#playBtn');
  await page.waitForFunction(() => __ot.state().started, null, { timeout: 10000 });
  const s0 = await st(page);
  ok(`${name}: Play starts the game, HUD shown, audio unlocked`, s0.started && await page.isVisible('#hud') && await page.evaluate(() => __ot.game.audio.ready));
  ok(`${name}: KC spawns on dry land in Columbia View Park`, s0.zone === 'cvpark' && s0.pos.y > 1, `${s0.zone} y=${s0.pos.y.toFixed(2)}`);

  if (touch) { const co = await page.evaluate(() => { const rc = q => { const e = document.querySelector(q), b = e.getBoundingClientRect(); return { q, x: b.left, y: b.top, r: b.right, b: b.bottom, on: getComputedStyle(e).display !== 'none' && b.width > 0 }; }, panels = [rc('#coach .cl'), rc('#coach .cr')], others = ['#minimapBtn', '#zone', '#clock', '#banner span', '#compass', '#wallet', '#hudBtns', '#stick', '#bc', ...[...document.querySelectorAll('#pad button')].map((_, i) => `#pad button:nth-child(${i + 1})`)].map(rc);
      const hits = []; for (const p of panels) for (const o of others) if (p.x < o.r - 1 && o.x < p.r - 1 && p.y < o.b - 1 && o.y < p.b - 1) hits.push(p.q + ' over ' + o.q); return { shown: panels.every(p => p.on), hits, inside: panels.every(p => p.x >= 0 && p.r <= innerWidth && p.b <= innerHeight) }; });
    ok(`${name}: first-run coach panels are shown and cover nothing (place name, clock, Discovered banner, stick, buttons)`, co.shown && co.inside && co.hits.length === 0, co.hits.join('; ')); }
  if (process.env.SEAMS_ONLY) { await seamChecks(page, name, touch, vp); await page.evaluate(() => { const d = __ot.game.moduleData('smoke', { n: 0, list: [] }); d.n = 7; d.list.push('a', 'b'); __ot.save(); }); await page.reload(); await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 120000 }); await seamChecksAfterReload(page, name, touch);
    const ext = requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')); ok(`${name}: no console errors or page errors`, errors.length === 0, errors.slice(0, 3).join(' | ')); ok(`${name}: nothing was requested from outside the game folder`, ext.length === 0, ext.slice(0, 3).join(' ')); await ctx.close(); return; }

  /* HUD fits and the thumb controls do not overlap */
  const boxes = await page.evaluate(() => { const r = q => [...document.querySelectorAll(q)].filter(e => e.offsetParent !== null).map(e => { const b = e.getBoundingClientRect(); return { id: e.id || e.dataset.btn || e.className, x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }); return { vw: innerWidth, vh: innerHeight, hud: r('#minimapBtn, #wallet, #hudBtns button, #stamina, #zone'), pad: r('#pad button') }; });
  const inside = b => b.x >= -1 && b.y >= -1 && b.r <= boxes.vw + 1 && b.b <= boxes.vh + 1, hit = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
  ok(`${name}: HUD (minimap, wallet, buttons, stamina) is inside the screen`, boxes.hud.length >= 7 && boxes.hud.every(inside), boxes.hud.filter(b => !inside(b)).map(b => b.id).join(','));
  if (touch) {
    let overlap = ''; for (let i = 0; i < boxes.pad.length; i++) for (let j = i + 1; j < boxes.pad.length; j++) if (hit(boxes.pad[i], boxes.pad[j])) overlap += boxes.pad[i].id + '/' + boxes.pad[j].id + ' ';
    for (const p of boxes.pad) for (const h of boxes.hud) if (hit(p, h)) overlap += p.id + '/' + h.id + ' ';
    ok(`${name}: all 7 touch buttons on screen, at least 44px, none overlapping`, boxes.pad.length === 7 && boxes.pad.every(inside) && boxes.pad.every(b => b.w >= 44 && b.h >= 44) && !overlap, overlap || boxes.pad.map(b => Math.round(b.w)).join(','));
    ok(`${name}: touch buttons sit in the lower part of the screen, within thumb reach of an edge`, boxes.pad.every(b => b.y > boxes.vh * 0.35 && (b.r > boxes.vw - 260 || b.x < 260)));
    /* real touches: left thumb stick moves KC, right-hand drag turns the camera, Jump button jumps */
    const cdp = await ctx.newCDPSession(page), tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
    const a = await st(page), sx = vp.width * 0.2, sy = vp.height * 0.7;
    await tp('touchStart', [[sx, sy, 1]]); await tp('touchMove', [[sx, sy - 60, 1]]); await page.waitForTimeout(1200);
    const cx = vp.width * 0.75, cy = vp.height * 0.4; await tp('touchStart', [[sx, sy - 60, 1], [cx, cy, 2]]); await tp('touchMove', [[sx, sy - 60, 1], [cx - 90, cy, 2]]); await page.waitForTimeout(250); await tp('touchEnd', [[sx, sy - 60, 1]]); await tp('touchEnd', []);
    const b = await st(page);
    ok(`${name}: on-screen joystick moves KC`, dist(a.pos, b.pos) > 1.5, dist(a.pos, b.pos).toFixed(1) + ' units');
    ok(`${name}: touch drag turns the camera`, Math.abs(b.cam.yaw - a.cam.yaw) > 0.1, (b.cam.yaw - a.cam.yaw).toFixed(2));
    await page.evaluate(() => __ot.step(20)); const j0 = (await st(page)).pos.y; await page.tap('#pad [data-btn="jump"]'); await page.waitForTimeout(220);
    ok(`${name}: Jump button lifts KC`, (await st(page)).pos.y > j0 + 0.2 || (await page.evaluate(() => __ot.events.some(e => e.type === 'jump'))));
  } else {
    await visit(page, -168, -166, Math.PI / 2); const a = await st(page);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW'); const b = await st(page);
    ok(`${name}: W walks KC forward`, dist(a.pos, b.pos) > 1.5, dist(a.pos, b.pos).toFixed(1) + ' units');
    await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(760, 300, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150);
    ok(`${name}: mouse drag turns the camera`, Math.abs((await st(page)).cam.yaw - b.cam.yaw) > 0.1);
  }

  /* KC's moves */
  await visit(page, -196, -262, Math.PI / 2);
  const walk = await drive(page, 60), spr0 = await st(page), sprint = await drive(page, 60, ['KeyW', 'ShiftLeft']);
  ok(`${name}: run, then sprint is faster and drains stamina`, walk.speed > 4 && sprint.speed > walk.speed + 2 && sprint.stamina < spr0.stamina - 5, `run ${walk.speed.toFixed(1)}, sprint ${sprint.speed.toFixed(1)}, stamina ${spr0.stamina.toFixed(0)} -> ${sprint.stamina.toFixed(0)}`);
  const moves = await page.evaluate(() => { __ot.teleport(-150, -140, 0); __ot.step(10); const y0 = __ot.state().pos.y; __ot.press('jump'); __ot.step(6); const y1 = __ot.state().pos.y; __ot.step(40); __ot.press('bark'); __ot.step(4); __ot.press('sit'); __ot.step(10); const sit = __ot.state().sit; __ot.press('sit'); __ot.step(10); __ot.press('dig'); __ot.step(80); const ev = t => __ot.events.some(e => e.type === t); return { jump: y1 - y0, sit, bark: ev('bark'), dig: ev('dig'), jumped: ev('jump') }; });
  ok(`${name}: jump, bark, sit and dig all work`, moves.jump > 0.3 && moves.bark && moves.sit && moves.dig, JSON.stringify(moves));

  /* the district tour */
  for (const i of tourIdx) { const [id, x, z, yaw, o] = TOUR[i], v = await visit(page, x, z, yaw, { time: 11, ...o });
    const label = await page.evaluate(() => document.getElementById('zone').textContent);
    if (ok(`${name}: district "${id}" is named on the HUD`, v.zone === id && label.length > 2 && v.y > 0.3, `${v.zone} / ${label} / y=${v.y.toFixed(1)}`)) { R.districts.push(id); report.districts.add(id); }
    await page.waitForTimeout(120); await shot(page, `${name}-10-${id}`); }
  ok(`${name}: visited at least four districts`, R.districts.length >= 4, R.districts.length);
  /* walking (not teleporting) from the park into the plaza crosses a district line */
  const hike = await page.evaluate(() => { __ot.teleport(-142, -200, Math.PI); __ot.setCam(Math.PI, 0.3, 8); const seen = new Set(); __ot.hold('KeyW', true); __ot.hold('ShiftLeft', true); for (let i = 0; i < 16; i++) { __ot.step(15, 1 / 30); seen.add(__ot.state().zone); } __ot.hold('KeyW', false); __ot.hold('ShiftLeft', false); return [...seen]; });
  ok(`${name}: running up the Strand passes from the park through old town into the plaza`, hike.length >= 2 && hike.includes('plaza'), hike.join(' > '));

  /* bridges carry KC over the water */
  const br = await page.evaluate(() => { __ot.teleport(20, 250, Math.PI / 2); __ot.setCam(Math.PI / 2, 0.3, 9); __ot.hold('KeyW', true); let mid = 0, swam = false; for (let i = 0; i < 60; i++) { __ot.step(15, 1 / 30); const s = __ot.state(); if (Math.abs(s.pos.x - 100) < 12) mid = s.pos.y; if (s.swimming) swam = true; if (s.pos.x > 176) break; } __ot.hold('KeyW', false); const s = __ot.state(); return { x: s.pos.x, mid, swam, zone: s.zone }; });
  ok(`${name}: KC can walk the St. Johns Bridge end to end, high over the Willamette`, br.x > 170 && br.mid > 7 && !br.swam, `x=${br.x.toFixed(0)}, deck y=${br.mid.toFixed(1)}`);
  /* swimming */
  const sw = await visit(page, -84, -250, Math.PI / 2, { steps: 30 }), sw2 = await drive(page, 60);
  ok(`${name}: KC swims in the Columbia`, sw.swimming && sw2.swimming && dist(sw, sw2) > 2 && Math.abs(sw2.y) < 1, `moved ${dist(sw, sw2).toFixed(1)}, y=${sw2.y.toFixed(2)}`);
  await page.waitForTimeout(120); await shot(page, `${name}-20-swim`);
  const out = await page.evaluate(() => { __ot.setCam(-Math.PI / 2, 0.3, 8); __ot.hold('KeyW', true); let s; for (let i = 0; i < 30 && (s = __ot.state()).swimming; i++) __ot.step(15, 1 / 30); __ot.hold('KeyW', false); return { swimming: s.swimming, y: s.pos.y }; });
  ok(`${name}: and climbs back out onto the bank`, !out.swimming && out.y > 0.2, `y=${out.y.toFixed(2)}`);

  /* rideables: [id, kind, camera yaw to drive along, expectations] */
  for (const [id, kind, yaw] of [['board-park', 'skateboard', Math.PI / 2], ['canoe-dock', 'canoe', Math.PI / 2], ['van-park', 'van', Math.PI / 2]]) {
    const r = await page.evaluate(([id, yaw]) => { const ride = __ot.rides().find(r => r.id === id); __ot.game.vehicles.reset(id); __ot.teleport(ride.x + 1.6, ride.z + 1.2, yaw); __ot.step(8); const prompt = __ot.state().prompt; __ot.press('interact'); __ot.step(3); const on = __ot.state().ride; __ot.setCam(yaw, 0.3, 9); const p0 = __ot.rides().find(r => r.id === id);
      __ot.hold('KeyW', true); __ot.step(150, 1 / 30); const s1 = __ot.state(), p1 = __ot.rides().find(r => r.id === id), surf = __ot.surfaceAt(p1.x, p1.z), h = __ot.heightAt(p1.x, p1.z); __ot.hold('KeyW', false); return { prompt, on, moved: Math.hypot(p1.x - p0.x, p1.z - p0.z), speed: s1.rideSpeed, surf, h, x: p1.x, z: p1.z }; }, [id, yaw]);
    await page.waitForTimeout(120); await shot(page, `${name}-30-${kind}`);
    ok(`${name}: ${kind}: prompt, hop on with the Paw button, and it drives`, /hop|ride/i.test(r.prompt || '') && r.on === id && r.moved > 8, `"${r.prompt}", moved ${r.moved.toFixed(1)}, speed ${r.speed.toFixed(1)}`);
    if (kind === 'canoe') ok(`${name}: canoe stays on the water`, r.h < -0.3 && r.surf === 'water', `h=${r.h.toFixed(2)} ${r.surf}`);
    if (kind === 'van') {
      const road = await page.evaluate(() => { __ot.exit(); __ot.step(2); const v = __ot.game.vehicles.byId('van-park'); v.x = -140; v.z = -326; v.yaw = 0; v.speed = 0; __ot.enter('van-park'); __ot.setCam(0, 0.3, 9); __ot.hold('KeyW', true); __ot.step(120, 1 / 30); const onRoad = __ot.state().rideSpeed; v.x = -300; v.z = -296; v.yaw = Math.PI / 2; v.speed = 0; __ot.setCam(Math.PI / 2, 0.3, 9); __ot.step(120, 1 / 30); const offRoad = __ot.state().rideSpeed; __ot.hold('KeyW', false); return { onRoad, offRoad, surf: __ot.surfaceAt(-140, -326) }; });
      ok(`${name}: van is quick on the road and crawls off it`, road.surf === 'road' && road.onRoad > 12 && road.offRoad < road.onRoad * 0.6, `road ${road.onRoad.toFixed(1)}, grass ${road.offRoad.toFixed(1)}`);
    }
    const off = await page.evaluate(() => { __ot.press('interact'); __ot.step(4); const s = __ot.state(); return { ride: s.ride, y: s.pos.y, swimming: s.swimming }; });
    ok(`${name}: ${kind}: hop off with the same button`, off.ride === null, JSON.stringify(off));
  }
  const skate = await page.evaluate(() => { __ot.game.vehicles.reset('board-park'); __ot.enter('board-park'); __ot.step(3); const y0 = __ot.rides().find(r => r.id === 'board-park').y; __ot.press('jump'); __ot.step(5); const y1 = __ot.rides().find(r => r.id === 'board-park').y; __ot.step(40); __ot.exit(); return y1 - y0; });
  ok(`${name}: skateboard ollies`, skate > 0.2, skate.toFixed(2));
  /* transit: board the tram at its stop and ride it over the car-free bridge; the freight train runs along the Highway 30 line */
  const tram = await page.evaluate(() => { __ot.exit(); const T = __ot.game.vehicles.tram; __ot.teleport(120, 300, 0); for (let i = 0; i < 120 && !(T.wait > 4); i++) __ot.step(30); const x0 = T.x, at0 = T.at; __ot.teleport(T.x, 435.4, 1.57); __ot.step(6); const prompt = __ot.state().prompt, on = __ot.enter('tram'); let maxY = 0; for (let i = 0; i < 90 && !(T.at !== at0 && T.wait > 0); i++) { __ot.step(30); maxY = Math.max(maxY, __ot.state().pos.y); } const ride = __ot.state().ride, far = Math.abs(T.x - x0); __ot.exit(); __ot.step(6); const s = __ot.state(); return { prompt, on, ride, far, maxY, off: s.ride, swimming: s.swimming, y: s.pos.y }; });
  ok(`${name}: tram: prompt at the stop, KC rides it over Tilikum Crossing and hops off on dry ground`, /Heron Line/.test(tram.prompt || '') && tram.on && tram.ride === 'tram' && tram.far > 140 && tram.maxY > 4.6 && tram.off === null && !tram.swimming, `"${tram.prompt}", ${tram.far.toFixed(0)} units, deck height ${tram.maxY.toFixed(1)}`);
  const train = await page.evaluate(() => { const T = __ot.game.vehicles.train, a = [T.x, T.z]; let moved = 0; __ot.teleport(T.x + 14, T.z, 0); for (let i = 0; i < 80 && moved < 40; i++) { __ot.step(30); moved = Math.hypot(T.x - a[0], T.z - a[1]); } const onRail = __ot.game.world.railDist(T.x, T.z); return { moved, onRail }; });
  ok(`${name}: freight train moves along the railway`, train.moved >= 40 && train.onRail < 3, `moved ${train.moved.toFixed(0)}, ${train.onRail.toFixed(1)} from the centre line`);

  /* camera never ends up inside a building: stand against shop fronts and walls and swing the camera right round */
  const camTest = await page.evaluate(() => { const w = __ot.game.world, fp = w.scenery.footprints; let bad = 0, n = 0, worst = '';
    for (const [x, z] of [[-212, -286], [-198, -304], [-180, -221], [-131, -250], [-176, -283], [-96, 352], [-116, 404], [-52, 331], [64, 60], [-212.6, -312]]) for (let k = 0; k < 12; k++) { const yaw = (k / 12) * Math.PI * 2; __ot.teleport(x, z, yaw); __ot.setCam(yaw, 0.25, 11); __ot.step(6); const c = __ot.state().cam; n++;
      if (fp.some(b => c.x > b[0] + 0.15 && c.x < b[2] - 0.15 && c.z > b[1] + 0.15 && c.z < b[3] - 0.15 && c.y < 5) || c.y < w.heightAt(c.x, c.z) + 0.2) { bad++; worst = `${x},${z} yaw ${yaw.toFixed(2)}`; } } return { bad, n, worst }; });
  ok(`${name}: follow camera never clips into a building or the ground (${camTest.n} poses)`, camTest.bad === 0, camTest.worst);

  /* the viewpoint photo spot and a market stall leave the camera room all round; no building stands on a road */
  const room = await page.evaluate(async () => { const g = __ot.game, D = await import('./js/data.js'), U = await import('./js/util.js'), swing = (x, z, want) => { let min = 99; for (let k = 0; k < 8; k++) { const yaw = k * Math.PI / 4; __ot.teleport(x, z, yaw); __ot.setCam(yaw, 0.3, want); __ot.step(8); min = Math.min(min, __ot.state().cam.dist); } return min; };
    const spot = D.PHOTO_SPOTS.find(p => p.id === 'mansion'), mansion = swing(spot.x, spot.z, 9), cam = swing(spot.mx, spot.mz + 1.4, 9), st = g.place.stall('Bandana Bay'), stall = swing(st.x, st.z, 5), bad = [];
    for (const b of D.BUILDINGS) for (const r of D.ROADS) { if (r.kind !== 'road') continue; let best = 1e9; for (const p of U.smoothPath(r.pts, 3)) best = Math.min(best, Math.hypot(Math.max(Math.abs(p[0] - b.x) - b.w / 2, 0), Math.max(Math.abs(p[1] - b.z) - b.d / 2, 0))); if (best < r.w / 2 + 1.5) bad.push(b.id + ' on ' + r.id + ' (' + best.toFixed(1) + ')'); }
    return { mansion, cam, stall, bad, n: D.BUILDINGS.length }; });
  ok(`${name}: the Pittock Mansion photo spot and a Makers Market stall front leave the camera room all the way round`, room.mansion > 8.5 && room.cam > 6 && room.stall > 4.4, `mansion ${room.mansion.toFixed(1)} of 9, at the camera post ${room.cam.toFixed(1)}, stall aisle ${room.stall.toFixed(1)} of 5`);
  ok(`${name}: no building stands on a road or its verge (${room.n} buildings)`, room.bad.length === 0, room.bad.join(', '));

  /* talk prompts, wildlife */
  const talk = await page.evaluate(() => { const g = __ot.game, p = g.npcs.peds[10]; __ot.teleport(p.x + 1.2, p.z, 0); __ot.step(4); const prompt = __ot.state().prompt; __ot.press('interact'); __ot.step(4); return { prompt, talked: __ot.events.some(e => e.type === 'npcTalk'), peds: g.npcs.peds.length, dogs: g.npcs.dogs.length, critters: g.npcs.groups.length }; });
  ok(`${name}: townspeople have a talk prompt and say something`, /talk to/i.test(talk.prompt || '') && talk.talked, `"${talk.prompt}", ${talk.peds} people, ${talk.dogs} dogs, ${talk.critters} wildlife groups`);
  const scat = await page.evaluate(() => { __ot.teleport(-170, -238, 0); __ot.step(20); __ot.press('bark'); __ot.step(30); return __ot.events.some(e => e.type === 'scatter'); });
  ok(`${name}: barking scatters the plaza birds`, scat);

  /* seams: economy feeds the wallet readout, flags switch the festival layer, the shop takes tabs */
  const seam = await page.evaluate(() => { const g = __ot.game, e = g.economy, b0 = g.state.wallet.bones; const got = e.grant({ bones: 25, gems: 2, items: ['test-bandana'] }, 'smoke'); __ot.step(2);
    const hud = { bones: +document.getElementById('wBones').textContent, gems: +document.getElementById('wGems').textContent }; let rendered = false; const un = g.shop.registerTab({ id: 'smoke', title: 'Smoke', badge: 3, render: body => { body.textContent = 'tab body'; rendered = true; } }); g.shop.open('smoke'); const shopOpen = !!document.querySelector('#modal:not([hidden]) [data-tab="smoke"]'); g.closeModal('shop'); un();
    e.setFlag('smoke-flag', 7); return { got, d: g.state.wallet.bones - b0, hud, wallet: { ...g.state.wallet }, owns: e.owns('test-bandana'), notOwns: e.owns('nope'), flag: e.getFlag('smoke-flag'), catalog: Array.isArray(e.catalog), rendered, shopOpen, tabsLeft: g.shop.tabs.length }; });
  ok(`${name}: economy seam: grant() pays the wallet and the HUD readouts follow`, seam.d === 25 && seam.hud.bones === seam.wallet.bones && seam.hud.gems === seam.wallet.gems && seam.owns && !seam.notOwns && seam.flag === 7 && seam.catalog, JSON.stringify(seam.hud));
  ok(`${name}: shop seam: registerTab() shows up in the Shop screen and renders`, seam.rendered && seam.shopOpen && seam.tabsLeft === 0);
  const fest = await page.evaluate(() => { const g = __ot.game, m = g.scene.getObjectByName('festival'); const before = m.visible; __ot.setTime(20.6); __ot.teleport(-196, -250, Math.PI / 2); __ot.setCam(Math.PI / 2, 0.36, 12); g.economy.setFlag('festival', true); __ot.step(100); return { before, on: m.visible, fog: g.scene.fog.far, night: __ot.state().night, tris: g.world.scenery.festivalTris }; });
  await page.waitForTimeout(150); await shot(page, `${name}-40-festival-night`);
  const fest2 = await page.evaluate(() => { const g = __ot.game; __ot.setTime(12); __ot.step(10); return g.scene.fog.far; });
  await page.waitForTimeout(120); await shot(page, `${name}-41-festival-day`);
  const festOff = await page.evaluate(() => { const g = __ot.game; g.economy.setFlag('festival', false); __ot.step(100); return { on: g.scene.getObjectByName('festival').visible, fog: g.scene.fog.far }; });
  ok(`${name}: festival flag switches the dressing layer and fog on and off, and night falls`, !fest.before && fest.on && fest.night > 0.9 && fest.tris > 2000 && !festOff.on && festOff.fog > fest2 * 1.3, `fog ${fest2.toFixed(0)} vs ${festOff.fog.toFixed(0)}, night ${fest.night.toFixed(2)}, ${fest.tris} festival triangles`);

  await seamChecks(page, name, touch, vp);

  /* pause, settings, mute, map */
  await page.evaluate(() => { __ot.teleport(-168, -166, Math.PI / 2); __ot.setCam(Math.PI / 2, 0.3, 9); __ot.step(5); });
  if (touch) await page.tap('#btnPause'); else await page.keyboard.press('Escape');
  await page.waitForSelector('#modal:not([hidden])'); const paused = (await st(page)).paused; await shot(page, `${name}-50-pause`);
  const menuFits = await page.evaluate(() => { const b = document.querySelector('#modal .card').getBoundingClientRect(); return b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1; });
  await page.evaluate(() => __ot.game.ui.settings()); await page.waitForSelector('[data-set="muted"]'); await shot(page, `${name}-51-settings`);
  const setOk = await page.evaluate(() => ['muted', 'sound', 'music', 'festival', 'invertY'].every(k => document.querySelector(`[data-set="${k}"]`)) && document.querySelectorAll('.seg [data-q]').length === 3);
  await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.game.ui.help(); }); const helpOk = await page.evaluate(() => /Move/.test(document.getElementById('modalBody').textContent)); await page.evaluate(() => __ot.game.ui.closeAll()); await page.waitForFunction(() => !__ot.state().paused, null, { timeout: 5000 }).catch(() => {});
  ok(`${name}: pause stops the game; menu fits; settings has sound, quality and controls help`, paused && menuFits && setOk && helpOk && !(await st(page)).paused, JSON.stringify({ paused, menuFits, setOk, helpOk }));
  if (touch) await page.tap('#btnMute'); else await page.click('#btnMute');
  const muted = await page.evaluate(() => __ot.game.state.settings.muted); if (touch) await page.tap('#btnMute'); else await page.click('#btnMute');
  ok(`${name}: mute switch toggles`, muted === true && await page.evaluate(() => __ot.game.state.settings.muted === false));
  await page.evaluate(() => __ot.game.ui.map()); await page.waitForSelector('#mapCanvas'); await shot(page, `${name}-52-map`);
  const mapFits = await page.evaluate(() => { const b = document.getElementById('mapCanvas').getBoundingClientRect(); return b.width > 150 && b.right <= innerWidth + 1 && b.left >= -1; }); await page.evaluate(() => __ot.game.ui.closeAll());
  ok(`${name}: world map opens and fits`, mapFits);

  /* frame time: real rAF frames while KC sprints through old town for 4 s */
  await page.evaluate(() => { __ot.setTime(11); __ot.teleport(-205, -196, Math.PI); __ot.setCam(Math.PI, 0.3, 9); __ot.step(5); __ot.hold('KeyW', true); __ot.resetFrameStats(); });
  await page.waitForTimeout(4000);
  const fs1 = await page.evaluate(() => { __ot.hold('KeyW', false); const f = __ot.frameStats(), i = __ot.info(), s = __ot.state(); return { ...f, calls: i.calls, tris: i.triangles, quality: s.quality, resScale: s.resScale, canvas: __ot.game.renderer.domElement.width + 'x' + __ot.game.renderer.domElement.height, gl: (() => { try { const gl = __ot.game.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; } catch (e) { return 'unknown'; } })() }; });
  const avg = fs1.sum / Math.max(1, fs1.n), cpu = fs1.cpuSum / Math.max(1, fs1.n);
  R.frame = { avgMs: +avg.toFixed(1), fps: +(1000 / avg).toFixed(1), maxMs: +fs1.max.toFixed(1), cpuMsPerFrame: +cpu.toFixed(2), frames: fs1.n, drawCalls: fs1.calls, triangles: fs1.tris, quality: fs1.quality, resScale: fs1.resScale, canvas: fs1.canvas, gl: fs1.gl };
  console.log(`      frame time: avg ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(1)} fps), worst ${fs1.max.toFixed(1)} ms, sim+render call ${cpu.toFixed(2)} ms, ${fs1.calls} draw calls, ${fs1.tris} triangles, ${fs1.canvas}, quality ${fs1.quality}, ${fs1.gl}`);
  ok(`${name}: frames keep coming (software GL floor: avg under 200 ms)`, fs1.n > 15 && avg < 200, `${fs1.n} frames`);
  ok(`${name}: scene stays inside the mobile budget (under 220 draw calls, under 260k triangles)`, fs1.calls < 220 && fs1.tris < 260000, `${fs1.calls} calls, ${fs1.tris} tris`);

  /* save and reload */
  const saved = await page.evaluate(() => { __ot.exit(); __ot.game.vehicles.reset('van-park'); __ot.teleport(-181, -172, 0); __ot.step(3); __ot.enter('van-park'); __ot.setCam(Math.PI / 2, 0.3, 9); __ot.hold('KeyW', true); __ot.step(90); __ot.hold('KeyW', false); __ot.exit(); const v = __ot.game.vehicles.byId('van-park'); window.__van = [v.x, v.z]; __ot.teleport(-272, 50, 0.3); __ot.step(4); { const d = __ot.game.moduleData('smoke', { n: 0, list: [] }); d.n = 7; d.list.push('a', 'b'); } __ot.save(); return { wallet: __ot.state().wallet, raw: !!localStorage.getItem('kc-open-trail-save-v2'), van: window.__van }; });
  await page.reload(); await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 120000 });
  const back = await page.evaluate(() => ({ van: (v => [v.x, v.z])(__ot.game.vehicles.byId('van-park')), s: __ot.state(), btn: document.getElementById('playBtn').textContent, owned: __ot.game.economy.owns('test-bandana'), flag: __ot.game.economy.getFlag('smoke-flag') }));
  ok(`${name}: save survives a reload (wallet, place, owned item, flag)`, saved.raw && back.s.wallet.bones >= saved.wallet.bones && Math.hypot(back.s.pos.x + 272, back.s.pos.z - 50) < 3 && back.btn === 'Continue' && back.owned && back.flag === 7, `${back.s.wallet.bones} bones at ${back.s.pos.x.toFixed(0)},${back.s.pos.z.toFixed(0)}`);
  ok(`${name}: a ride left away from home is still there after a reload`, Math.hypot(saved.van[0] + 181, saved.van[1] + 177) > 4 && Math.hypot(back.van[0] - saved.van[0], back.van[1] - saved.van[1]) < 0.5, `van at ${back.van[0].toFixed(0)},${back.van[1].toFixed(0)}`);

  await seamChecksAfterReload(page, name, touch);

  const ext = requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok(`${name}: no console errors or page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  ok(`${name}: nothing was requested from outside the game folder`, ext.length === 0, ext.slice(0, 3).join(' '));
  await ctx.close();
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  try {
    /* ---------- static checks ---------- */
    const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), sw = read('sw.js'), listed = [...sw.matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]).filter(Boolean);
    const real = ['index.html', 'style.css', 'manifest.webmanifest', ...fs.readdirSync(path.join(ROOT, 'js')).map(f => 'js/' + f), ...fs.readdirSync(path.join(ROOT, 'icons')).map(f => 'icons/' + f), 'vendor/three/three.module.min.js'];
    ok('service worker cache name is kc-open-trail-vN', /const VERSION = "kc-open-trail-v\d+"/.test(sw));
    ok('service worker file list matches the real files', real.every(f => listed.includes(f)) && listed.every(f => fs.existsSync(path.join(ROOT, f))), real.filter(f => !listed.includes(f)).concat(listed.filter(f => !fs.existsSync(path.join(ROOT, f)))).join(' '));
    const shipped = ['index.html', 'style.css', 'manifest.webmanifest', 'sw.js', 'README.md', 'ARCHITECTURE.md', ...fs.readdirSync(path.join(ROOT, 'js')).map(f => 'js/' + f), ...fs.readdirSync(path.join(ROOT, 'tools')).map(f => 'tools/' + f)].map(f => [f, read(f)]);
    /* the do-not-copy list from sections 2 and 3 of the setting brief, plus the prototype town name. Phrases are matched in any case;
       the film's character first names only as capitalised whole words, so colour names such as "sage" stay usable. This file is not scanned (it holds the list). */
    const banned = [/cedar\s*hollow/i, /halloween\s*town/i, /spirit of hallow/i, /pumpkin plaza/i, /jack the pumpkin/i, /boo bash/i, /portlandia/i, /keep portland weird/i, /cromwell/i, /kalabar/i,
      /mortal world/i, /talisman/i, /witch u\b/i, /monster high/i, /dalloway/i, /silas sinister/i, /periwinkle/i, /dr\.? grogg/i, /flanagan/i, /aneesa/i, /burp-urp/i,
      /petite jolie/i, /thunderbird and whale/i, /bloated toad/i, /bella'?s house/i, /white stag/i, /allow me/i, /13 nights/i, /lewis (and|&) clark/i, /ride shotgun/i, /linnton feed/i, /rose building/i, /stumptown/i,
      /\b(Marnie|Aggie|Gwen|Piper|Dylan|Sophie|Luke|Benny|Harriet|Kal|Astrid|Gort|Ethan|Cody|Cassie|Chester|Natalie|Bobby|Scarlett|Sage|Sapphire|Goodwin)\b/];
    const hits = shipped.flatMap(([f, t]) => banned.filter(b => b.test(t)).map(b => f + ':' + b.source));
    ok('no leftover prototype names and nothing from the do-not-copy list in shipped files', hits.length === 0, hits.join(' '));
    /* only the store and the merch claim may talk to the Dewclaw worker, and only after a grown-up has passed the gate and pressed a button */
    const NET_OK = ['js/store.js', 'js/merch.js'], netHits = shipped.filter(([f, t]) => f.startsWith('js/') && !NET_OK.includes(f) && /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(t)).map(([f]) => f);
    ok('no network calls in the core game code (fetch / XHR / WebSocket / beacon); only store.js and merch.js may call the worker', netHits.length === 0, netHits.join(' '));
    ok('main.js imports and boots economy, upgrades, shop, missions, store and merch, and each exports init', ['economy', 'upgrades', 'shop', 'missions', 'store', 'merch'].every(m => new RegExp(`import \\* as ${m} from './${m}\\.js'`).test(read('js/main.js')) && /export function init\s*\(/.test(read(`js/${m}.js`))));
    ok('ARCHITECTURE.md documents the module seams and the file-ownership rule', /## Module seams/.test(read('ARCHITECTURE.md')) && /never edit/i.test(read('ARCHITECTURE.md')) && ['game.place', 'game.cosmetics', 'game.timedRun', 'game.travel', 'game.followers', 'game.photo', 'game.grownUp', 'setTuning', 'registerTab', 'keepOnReset'].every(k => read('ARCHITECTURE.md').includes(k)));

    /* ---------- the three viewports ---------- */
    await runViewport(browser, 'phone-portrait', { width: 390, height: 844 }, true, 'medium', [0, 1, 2, 8, 10, 15, 16]);
    await runViewport(browser, 'phone-landscape', { width: 844, height: 390 }, true, 'medium', [1, 3, 5, 7, 11, 13, 18]);
    await runViewport(browser, 'desktop', { width: 1280, height: 720 }, false, 'high', TOUR.map((_, i) => i));
    ok('every district on the tour was reached in some viewport', report.districts.size === TOUR.length, `${report.districts.size}/${TOUR.length}`);

    /* ---------- a damaged save must not break the game ---------- */
    { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.addInitScript(() => { try { localStorage.setItem('kc-open-trail-save-v2', '{"v":2,"wallet":"lots","pos":{"x":"NaN"},"settings":7,"flags":[1,2],"collected":null'); } catch (e) { /* ignore */ } });
      await page.goto(BASE + '?debug=1&nosw=1&q=low'); await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 120000 }); await page.click('#playBtn'); await page.waitForTimeout(300);
      const s = await st(page); ok('a damaged save falls back to a fresh game', s.started && s.wallet.bones < 20 && s.zone === 'cvpark' && errs.length === 0, `${s.zone} ${s.wallet.bones} ` + errs.join(' | '));
      /* Start over wipes the game but keeps what a module asked to keep (purchase records) and the grown-up settings */
      const rs = await page.evaluate(() => { const g = __ot.game; g.save.keepOnReset('smoke-store'); g.moduleData('smoke-store', {}).install = 'abc'; g.moduleData('smoke-gone', {}).x = 1; g.economy.grant({ bones: 50, items: ['smoke:item'] }); g.state.settings.spending = true; g.state.equipped.hat = 'x'; g.save.reset(); const raw = JSON.parse(localStorage.getItem(g.save.key)); return { kept: raw.modules['smoke-store'], gone: raw.modules['smoke-gone'], bones: raw.wallet.bones, owned: Object.keys(raw.owned).length, eq: Object.keys(raw.equipped).length, spending: raw.settings.spending }; });
      ok('Start over keeps module data marked with save.keepOnReset and the settings, and clears the rest', rs.kept && rs.kept.install === 'abc' && rs.gone === undefined && rs.bones === 0 && rs.owned === 0 && rs.eq === 0 && rs.spending === true, JSON.stringify(rs)); await ctx.close(); }

    /* ---------- offline: second load comes from the service worker ---------- */
    { const { ctx, page, errors } = await open(browser, { serviceWorkers: 'allow' }, '?debug=1&q=low');
      const swOk = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; for (let i = 0; i < 100; i++) { const names = (await caches.keys()).filter(n => n.startsWith('kc-open-trail-v')); if (names.length) { const n = (await (await caches.open(names[0])).keys()).length; if (n > 20) return { scope: reg.scope, names, n }; } await new Promise(r => setTimeout(r, 100)); } return null; });
      await page.reload(); await page.waitForFunction(() => window.__ot && __ot.ready && navigator.serviceWorker.controller, null, { timeout: 120000 });
      await ctx.setOffline(true); await page.reload(); let off = true; try { await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 60000 }); await page.click('#playBtn'); await page.waitForTimeout(300); } catch (e) { off = false; }
      ok('plays offline after the first visit (service worker shell)', !!swOk && off && (await st(page)).started && errors.length === 0, swOk ? `${swOk.names.join(',')}: ${swOk.n} files` : 'no cache'); await ctx.close(); }
  } catch (e) { failed++; console.log('FAIL  test run crashed: ' + (e && e.stack || e)); }
  await browser.close(); server.close();
  console.log('\n=== summary ===');
  for (const [n, r] of Object.entries(report.viewports)) console.log(`${n}: ${r.frame ? `${r.frame.avgMs} ms/frame (${r.frame.fps} fps), worst ${r.frame.maxMs} ms, JS ${r.frame.cpuMsPerFrame} ms/frame, ${r.frame.drawCalls} calls, ${r.frame.triangles} tris, ${r.frame.canvas}, ${r.frame.quality}, ${r.frame.gl}` : 'no frame data'}; districts: ${r.districts.join(', ')}`);
  console.log(`screenshots: ${OUT}`);
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})();
