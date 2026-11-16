/* KC: Open Trail smoke test (Playwright + Chromium).
     node tests/smoke.js            (from site/games/kc-open-trail; NODE_PATH must reach 'playwright')
   Starts its own static server for the site root, so nothing else needs to run.
   Headless Chromium renders WebGL in software, so timings here say nothing about real devices. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const SITE = path.resolve(__dirname, '..', '..', '..'), PORT = +(process.env.PORT || 8947), ORIGIN = `http://localhost:${PORT}`, BASE = ORIGIN + '/games/kc-open-trail/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(SITE, p); if (!f.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(d); });
});
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); if (!cond) failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(browser, opts = {}, query = '?debug=1&nosw=1&q=low') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', acceptDownloads: true, ...opts });
  const page = await ctx.newPage(); const errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE + query);
  if (query.includes('debug=1')) await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 90000 });
  return { ctx, page, errors, requests };
}
const st = page => page.evaluate(() => __ot.state());
const until = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ARGS });
  try {
    /* ---------- 1. desktop: load, play, keys, mouse, pause ---------- */
    let { ctx, page, errors, requests } = await open(browser);
    ok('loads and exposes debug hooks with ?debug=1', await page.evaluate(() => !!(window.__ot && __ot.ready)));
    ok('title screen is showing before Play', await page.isVisible('#title') && !(await st(page)).started);
    await page.click('#playBtn');
    ok('Play starts the game and shows the HUD', (await st(page)).started && await page.isVisible('#hud') && !(await page.isVisible('#title')));
    await page.evaluate(() => { __ot.game.state.settings.autoQuality = false; __ot.teleport(30, 100, 0); });
    let a = await st(page);
    await page.keyboard.down('KeyW'); const moved = await until(page, ([x, z]) => { const s = __ot.state(); return Math.hypot(s.pos.x - x, s.pos.z - z) > 2; }, [a.pos.x, a.pos.z]); await page.keyboard.up('KeyW');
    ok('KC moves with the keyboard (W)', moved);
    a = await st(page); await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyD');
    const sprint = await until(page, () => __ot.state().sprinting && __ot.state().stamina < 99); await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft');
    ok('sprint (zoomies) drains stamina', sprint);
    await page.evaluate(() => __ot.step(30)); a = await st(page); await page.keyboard.press('Space');
    ok('jump leaves the ground and lands again', await until(page, () => !__ot.state().onGround, null, 5000) && await until(page, () => __ot.state().onGround, null, 8000));
    a = await st(page); await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(820, 330, { steps: 6 }); await page.mouse.up(); await sleep(400);
    let b = await st(page);
    ok('camera orbits with a mouse drag', Math.abs(b.cam.yaw - a.cam.yaw) > 0.3, `yaw ${a.cam.yaw.toFixed(2)} -> ${b.cam.yaw.toFixed(2)}`);
    ok('camera stays above the ground', b.cam.y > await page.evaluate(() => __ot.game.world.heightAt(__ot.state().cam.x, __ot.state().cam.z)));
    /* camera does not end up inside a building when KC stands against a shop front */
    const inside = await page.evaluate(() => { __ot.teleport(12, 31.2, Math.PI); __ot.setCam(0, 0.3, 9); __ot.step(40); const s = __ot.state(); return __ot.game.world.blockedAt(s.cam.x, s.cam.z, s.cam.y - 0.3, 0.05) || s.cam.z < 30; });
    ok('camera is collision-aware next to a building', !inside);
    /* pause */
    await page.keyboard.press('Escape'); await sleep(300); a = await st(page);
    const t0 = a.time; await sleep(900); b = await st(page);
    ok('Esc pauses (menu open, clock stopped)', a.paused && a.modal === 'pause' && b.time === t0);
    await page.keyboard.press('Escape'); await sleep(300);
    ok('Esc resumes', !(await st(page)).paused);
    await page.click('#btnPause'); await sleep(200); ok('pause button opens the menu', (await st(page)).modal === 'pause');
    await page.click('#modalBody .menu button:has-text("Settings")'); await sleep(200); ok('settings screen opens from pause', (await st(page)).modal === 'settings');
    await page.click('#modalBody [data-q="low"]'); ok('quality can be set', (await st(page)).quality === 'low');
    await page.click('#modalActions .go'); await sleep(150); ok('closing settings returns to pause', (await st(page)).modal === 'pause');
    await page.click('#modalBody .menu button:has-text("Map")'); await sleep(200); ok('world map opens', (await st(page)).modal === 'map' && await page.isVisible('#mapCanvas'));
    await page.click('#modalClose'); await page.click('#modalClose'); await sleep(200); ok('modals close back to the game', (await st(page)).modal === null && !(await st(page)).paused);
    /* tab hidden pauses */
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(200); ok('hiding the tab pauses the game', (await st(page)).paused); await page.keyboard.press('Escape'); await sleep(200);

    /* ---------- 2. rideables ---------- */
    const rides = await page.evaluate(() => __ot.rides());
    ok('there are skateboards, canoes and a camper van', ['skateboard', 'canoe', 'van'].every(k => rides.some(r => r.kind === k)), rides.map(r => r.id).join(','));
    for (const r of rides) {
      await page.evaluate(r => { const R = __ot.game.vehicles.byId(r.id); __ot.game.vehicles.reset(r.id); let x = R.x + 2, z = R.z; if (r.kind === 'canoe') { /* stand on the nearest dry spot */ let best = 1e9; for (let a = 0; a < 6.3; a += 0.3) for (const d of [1.5, 2, 2.4]) { const px = R.x + Math.sin(a) * d, pz = R.z + Math.cos(a) * d, g = __ot.game.world.groundAt(px, pz, 3); if (g > 0.2 && d < best) { best = d; x = px; z = pz; } } } __ot.teleport(x, z, 0); __ot.step(4); }, r);
      const prompt = (await st(page)).prompt;
      await page.keyboard.press('KeyF'); await until(page, id => __ot.state().ride === id, r.id, 6000);
      a = await st(page); ok(`enters ${r.id} with the interact key`, a.ride === r.id, 'prompt: ' + prompt);
      await page.evaluate(() => { __ot.setCam(__ot.game.kc.ride ? __ot.game.kc.ride.yaw : 0, 0.3, 6); __ot.hold('KeyW', true); __ot.step(90); __ot.hold('KeyW', false); });
      b = await st(page); ok(`${r.id} moves when steered`, Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > 1.5, `moved ${Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z).toFixed(1)}`);
      await page.keyboard.press('KeyF'); await until(page, () => __ot.state().ride === null, null, 6000); await page.evaluate(() => __ot.step(30));
      b = await st(page); const sane = await page.evaluate(() => { const s = __ot.state(); return !__ot.game.world.blockedAt(s.pos.x, s.pos.z, s.pos.y) && s.pos.y > -1 && s.pos.y < 80; });
      ok(`leaves ${r.id} with the same key and stands somewhere sane`, b.ride === null && sane, `y=${b.pos.y.toFixed(2)} swimming=${b.swimming}`);
    }

    /* ---------- 3. world rules ---------- */
    a = await page.evaluate(() => { const bone = __ot.game.collect.bones[0]; __ot.teleport(bone.x + 3, bone.z, 0); const w0 = __ot.state().wallet.bones; __ot.teleport(bone.x, bone.z, 0); __ot.step(10); return { w0, w1: __ot.state().wallet.bones, ev: __ot.events.filter(e => e.type === 'pickup').length }; });
    ok('walking over a bone adds to the wallet and emits pickup', a.w1 > a.w0 && a.ev > 0, `${a.w0} -> ${a.w1}`);
    ok('wallet readout in the HUD follows state', (await page.textContent('#wBones')).trim() === String((await st(page)).wallet.bones));
    a = await page.evaluate(() => { __ot.teleport(200, 204, 0); __ot.step(40); const s = __ot.state(); return { swimming: s.swimming, y: s.pos.y }; });
    ok('KC swims in deep water instead of sinking', a.swimming && a.y > -1 && a.y < 0, 'y=' + a.y.toFixed(2));
    a = await page.evaluate(() => { __ot.teleport(118, 40, 0); __ot.step(10); return __ot.state().pos.y; });
    ok('KC stands on the bridge deck', a > 3 && a < 3.6, 'y=' + a.toFixed(2));
    a = await page.evaluate(() => { let minOver = 9; const pts = [[20, 47], [-60, 30], [-200, -100], [-24, -214], [-140, 214], [210, 160], [100, -100], [240, -70], [0, 170], [-250, 100]]; for (const [x, z] of pts) { __ot.teleport(x, z, 1); __ot.hold('KeyW', true); __ot.hold('ShiftLeft', true); for (let i = 0; i < 60; i++) { __ot.step(3, 1 / 30); if (i % 20 === 5) __ot.press('jump'); const s = __ot.state(); minOver = Math.min(minOver, s.pos.y - Math.min(s.ground, -0.5)); } __ot.hold('KeyW', false); __ot.hold('ShiftLeft', false); } return minOver; });
    ok('never falls through the world while running around ten districts', a > -0.2, 'min height over ground ' + a.toFixed(2));
    a = await page.evaluate(() => { __ot.teleport(20, 47, 0); __ot.step(5); const b0 = __ot.give({ bones: 50 }).bones; __ot.mischief(2); const R = __ot.game.npcs.ranger; __ot.teleport(R.x + 1, R.z, 0); __ot.step(20); const s = __ot.state(); return { b0, b1: s.wallet.bones, m: s.mischief, caught: __ot.events.some(e => e.type === 'caught') }; });
    await sleep(900);
    b = await st(page);
    ok('ranger catching KC costs a few bones, clears mischief and resets her to the station', a.caught && a.b1 < a.b0 && a.b0 - a.b1 <= 15 && a.m === 0 && Math.hypot(b.pos.x - 90, b.pos.z - 74.5) < 6, `fine ${a.b0 - a.b1}, at ${b.pos.x.toFixed(0)},${b.pos.z.toFixed(0)}`);
    a = await page.evaluate(() => { __ot.mischief(1); __ot.teleport(-250, 250, 0); for (let i = 0; i < 40; i++) __ot.step(30, 1 / 30); return { m: __ot.state().mischief, esc: __ot.events.some(e => e.type === 'escaped') }; });
    ok('mischief wears off when KC gets away', a.m === 0 && a.esc);
    a = await page.evaluate(() => { const e0 = __ot.events.length; __ot.teleport(30, 100, 0); __ot.press('bark'); __ot.step(3); __ot.press('sit'); __ot.step(10); const sit = __ot.state().sit; __ot.press('sit'); __ot.step(3); __ot.press('dig'); __ot.step(60); __ot.press('shake'); __ot.step(5); return { sit, types: [...new Set(__ot.events.slice(e0).map(e => e.type))] }; });
    ok('bark, sit, dig and shake work and emit events', a.sit && ['bark', 'sit', 'dig', 'shake'].every(t => a.types.includes(t)), a.types.join(','));
    a = await page.evaluate(() => { const g = __ot.game, h = g.addMarker({ id: 't-m', x: 0, z: 0, label: 'T' }), z = g.addZone({ id: 't-z', x: 60, z: 180, r: 5 }), i = g.addInteractable({ id: 't-i', x: 60, z: 180, r: 3, label: 'Test thing', onInteract: () => { window.__hit = true; } }); g.setObjective({ x: 60, z: 180, label: 'Go' }); g.setModifier('t', { speed: 1.5 }); g.setCosmetic('bandana', 0xff0000); g.setCosmetic('hat', 'cap'); g.setSkin('skateboard', { primary: 0x00ff00 }); const p = g.spawnProp('bench', 62, 182, {}); __ot.teleport(60, 180, 0); __ot.step(10); const pr = __ot.state().prompt; __ot.press('interact'); __ot.step(2); const d = g.moduleData('test', { n: 1 }); d.n++; const r = { pr, hit: !!window.__hit, zone: __ot.events.some(e => e.type === 'enterZone' && e.d.id === 't-z'), speed: __ot.state().mods.speed, band: g.kc.parts.bandana.visible, n: g.state.modules.test.n }; h.remove(); z.remove(); i.remove(); p.remove(); g.setObjective(null); g.setModifier('t', null); g.setCosmetic('bandana', null); g.setCosmetic('hat', null); return r; });
    ok('registry API: marker, zone, interactable, objective, modifier, cosmetic, skin, prop, module data', a.pr === 'Test thing' && a.hit && a.zone && a.speed === 1.5 && a.band && a.n === 2, JSON.stringify(a));
    /* photo mode saves a PNG */
    await page.keyboard.press('KeyK'); await sleep(300);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.click('#photoSnap')]);
    ok('photo mode saves a PNG', !!dl && /\.png$/.test(dl.suggestedFilename()), dl ? dl.suggestedFilename() : 'no download');
    await page.click('#photoExit'); await sleep(200);

    /* ---------- 4. save survives reload; corrupt save tolerated ---------- */
    await page.evaluate(() => { __ot.give({ bones: 7, gems: 2 }); __ot.teleport(-140, 214, 1); __ot.game.moduleData('smoke', { x: 0 }).x = 42; __ot.save(); });
    const before = await st(page);
    await page.reload(); await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 90000 }); await page.click('#playBtn');
    b = await st(page);
    ok('save survives a reload (wallet, position, module data)', b.wallet.bones === before.wallet.bones && b.wallet.gems === before.wallet.gems && Math.hypot(b.pos.x + 140, b.pos.z - 214) < 3 && await page.evaluate(() => __ot.game.state.modules.smoke.x === 42), `${b.wallet.bones} bones, ${b.wallet.gems} gems`);
    for (const junk of ['{not json', '[]', '{"v":1,"wallet":"lots","pos":{"x":"NaN"},"settings":{"quality":7},"stats":null,"collected":{"balls":{}}}', 'null']) {
      await page.evaluate(j => localStorage.setItem('kc-open-trail-save-v1', j), junk);
      const n0 = errors.length; await page.reload(); const ready = await until(page, () => window.__ot && window.__ot.ready, null, 90000);
      if (ready) { await page.click('#playBtn'); await page.evaluate(() => __ot.step(5)); }
      b = ready ? await st(page) : null;
      ok(`corrupt save does not crash: ${junk.slice(0, 22)}`, ready && errors.length === n0 && b.started && Number.isFinite(b.pos.x) && b.wallet.bones < 10 && b.wallet.gems === 0, b ? `bones ${b.wallet.bones}` : 'not ready');
    }
    ok('no console errors on desktop run', errors.length === 0, errors.slice(0, 3).join(' | '));
    ok('no request left the origin (desktop)', requests.every(u => u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')), requests.filter(u => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')).slice(0, 3).join(' '));
    await ctx.close();

    /* ---------- 5. phone: touch stick, touch camera, HUD layout ---------- */
    for (const [w, h] of [[360, 640], [844, 390]]) {
      ({ ctx, page, errors, requests } = await open(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }));
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
      await touch('touchStart', [[4, h - 4, 9]]); await touch('touchEnd', []); await sleep(100);
      await page.evaluate(() => document.getElementById('playBtn').click());
      await page.evaluate(() => { __ot.game.state.settings.autoQuality = false; __ot.teleport(30, 100, 0); __ot.step(2); });
      a = await st(page);
      const sx = w * 0.22, sy = h * 0.72;
      await touch('touchStart', [[sx, sy, 1]]); await touch('touchMove', [[sx, sy - 30, 1]]); await touch('touchMove', [[sx, sy - 70, 1]]);
      const tm = await until(page, ([x, z]) => { const s = __ot.state(); return Math.hypot(s.pos.x - x, s.pos.z - z) > 1.5; }, [a.pos.x, a.pos.z]);
      ok(`${w}x${h}: KC moves with the touch stick`, tm);
      /* second finger orbits the camera while the first keeps the stick (multi-touch) */
      a = await st(page); const cx = w * 0.7, cy = h * 0.35;
      await touch('touchStart', [[sx, sy - 70, 1], [cx, cy, 2]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[sx, sy - 70, 1], [cx + i * 14, cy + i * 2, 2]]);
      await sleep(400); b = await st(page);
      ok(`${w}x${h}: second finger orbits the camera while the stick is held`, Math.abs(b.cam.yaw - a.cam.yaw) > 0.25 && await page.evaluate(() => __ot.game.input.stick.active), `yaw ${a.cam.yaw.toFixed(2)} -> ${b.cam.yaw.toFixed(2)}`);
      await touch('touchEnd', []); await sleep(200);
      ok(`${w}x${h}: stick releases`, !(await page.evaluate(() => __ot.game.input.stick.active)));
      /* jump button */
      const jb = await page.locator('#pad .b-jump').boundingBox();
      await page.evaluate(() => __ot.step(20)); await touch('touchStart', [[jb.x + jb.width / 2, jb.y + jb.height / 2, 3]]); const jumped = await until(page, () => !__ot.state().onGround, null, 5000); await touch('touchEnd', []);
      ok(`${w}x${h}: touch jump button works`, jumped);
      /* layout: HUD pieces on screen, big enough, not overlapping */
      const lay = await page.evaluate(() => {
        const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
        const ids = ['#minimapBtn', '#wallet', '#hudBtns', '#compass', '#stamina', '#pad'], rects = Object.fromEntries(ids.map(i => [i, r(i)]));
        const btns = [...document.querySelectorAll('#pad button, #hudBtns button')].map(e => e.getBoundingClientRect()).map(b => Math.min(b.width, b.height));
        const hit = (a, b) => a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
        const overlaps = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (hit(rects[ids[i]], rects[ids[j]])) overlaps.push(ids[i] + ids[j]);
        const off = ids.filter(i => { const b = rects[i]; return !b || b.x < -1 || b.y < -1 || b.r > innerWidth + 1 || b.b > innerHeight + 1; });
        return { minBtn: Math.min(...btns), overlaps, off };
      });
      ok(`${w}x${h}: HUD fits, nothing overlaps, touch targets are 44px+`, lay.minBtn >= 44 && !lay.overlaps.length && !lay.off.length, JSON.stringify(lay));
      ok(`${w}x${h}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await ctx.close();
    }

    /* ---------- 6. no debug hooks without the flag ---------- */
    ({ ctx, page, errors, requests } = await open(browser, {}, '?nosw=1'));
    await page.waitForFunction(() => { const b = document.getElementById('playBtn'); return b && !b.disabled; }, null, { timeout: 90000 });
    ok('window.__ot does not exist without ?debug=1', await page.evaluate(() => typeof window.__ot === 'undefined'));
    await ctx.close();

    /* ---------- 7. offline reload through the service worker ---------- */
    ({ ctx, page, errors, requests } = await open(browser, { serviceWorkers: 'allow' }, '?debug=1&q=low'));
    const swOk = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; const names = await caches.keys(); const c = await caches.open(names.find(n => n.startsWith('kc-open-trail-'))); return { scope: reg.scope, names, n: (await c.keys()).length }; });
    ok('service worker installs and precaches the shell', swOk.n >= 25 && swOk.names.every(n => n.startsWith('kc-open-trail-')), JSON.stringify(swOk));
    await page.reload(); await page.waitForFunction(() => window.__ot && window.__ot.ready && navigator.serviceWorker.controller, null, { timeout: 90000 });
    await ctx.setOffline(true); await page.reload().catch(() => {});
    const off = await until(page, () => window.__ot && window.__ot.ready, null, 90000);
    if (off) { await page.click('#playBtn'); await page.evaluate(() => __ot.step(10)); }
    ok('offline reload works', off && (await st(page)).started);
    ok('no console errors with the service worker', errors.length === 0, errors.slice(0, 3).join(' | '));
    ok('no request left the origin (service worker run)', requests.every(u => u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')));
    await ctx.close();
  } catch (e) { ok('test run completed without throwing', false, e.message.split('\n')[0]); }
  await browser.close(); server.close();
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
