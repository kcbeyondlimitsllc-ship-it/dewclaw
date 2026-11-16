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
  ['waterfront', 40, 430, Math.PI, { dist: 12 }], ['makers', 46, 482, 0, { dist: 9 }], ['mansion', -241, 452, -Math.PI / 2, { dist: 11, pitch: 0.25 }], ['forestpark', -232, 300, 0.5, { dist: 9 }]
];

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
  const saved = await page.evaluate(() => { __ot.exit(); __ot.game.vehicles.reset('van-park'); __ot.teleport(-181, -172, 0); __ot.step(3); __ot.enter('van-park'); __ot.setCam(Math.PI / 2, 0.3, 9); __ot.hold('KeyW', true); __ot.step(90); __ot.hold('KeyW', false); __ot.exit(); const v = __ot.game.vehicles.byId('van-park'); window.__van = [v.x, v.z]; __ot.teleport(-272, 50, 0.3); __ot.step(4); __ot.save(); return { wallet: __ot.state().wallet, raw: !!localStorage.getItem('kc-open-trail-save-v2'), van: window.__van }; });
  await page.reload(); await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 120000 });
  const back = await page.evaluate(() => ({ van: (v => [v.x, v.z])(__ot.game.vehicles.byId('van-park')), s: __ot.state(), btn: document.getElementById('playBtn').textContent, owned: __ot.game.economy.owns('test-bandana'), flag: __ot.game.economy.getFlag('smoke-flag') }));
  ok(`${name}: save survives a reload (wallet, place, owned item, flag)`, saved.raw && back.s.wallet.bones >= saved.wallet.bones && Math.hypot(back.s.pos.x + 272, back.s.pos.z - 50) < 3 && back.btn === 'Continue' && back.owned && back.flag === 7, `${back.s.wallet.bones} bones at ${back.s.pos.x.toFixed(0)},${back.s.pos.z.toFixed(0)}`);
  ok(`${name}: a ride left away from home is still there after a reload`, Math.hypot(saved.van[0] + 181, saved.van[1] + 177) > 4 && Math.hypot(back.van[0] - saved.van[0], back.van[1] - saved.van[1]) < 0.5, `van at ${back.van[0].toFixed(0)},${back.van[1].toFixed(0)}`);

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
    ok('no network calls in the game code (fetch / XHR / WebSocket / beacon)', !shipped.some(([f, t]) => f.startsWith('js/') && /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(t)));

    /* ---------- the three viewports ---------- */
    await runViewport(browser, 'phone-portrait', { width: 390, height: 844 }, true, 'medium', [0, 1, 2, 8, 10, 15, 16]);
    await runViewport(browser, 'phone-landscape', { width: 844, height: 390 }, true, 'medium', [1, 3, 5, 7, 11, 13, 18]);
    await runViewport(browser, 'desktop', { width: 1280, height: 720 }, false, 'high', TOUR.map((_, i) => i));
    ok('every district on the tour was reached in some viewport', report.districts.size === TOUR.length, `${report.districts.size}/${TOUR.length}`);

    /* ---------- a damaged save must not break the game ---------- */
    { const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.addInitScript(() => { try { localStorage.setItem('kc-open-trail-save-v2', '{"v":2,"wallet":"lots","pos":{"x":"NaN"},"settings":7,"flags":[1,2],"collected":null'); } catch (e) { /* ignore */ } });
      await page.goto(BASE + '?debug=1&nosw=1&q=low'); await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 120000 }); await page.click('#playBtn'); await page.waitForTimeout(300);
      const s = await st(page); ok('a damaged save falls back to a fresh game', s.started && s.wallet.bones < 20 && s.zone === 'cvpark' && errs.length === 0, `${s.zone} ${s.wallet.bones} ` + errs.join(' | ')); await ctx.close(); }

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
