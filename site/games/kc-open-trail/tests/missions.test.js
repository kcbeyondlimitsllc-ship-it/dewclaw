/* KC: Open Trail: missions test (Playwright + Chromium).
     NODE_PATH=$(npm root -g) node tests/missions.test.js [screenshot-folder]
   Serves this folder on its own port, boots the game with ?debug=1 and then, for each of the 16 missions and the
   8 festival activities: walks KC to the giver, uses the real "Talk to" prompt, presses the real start button and
   plays the mission through with debug teleports plus the real triggers (zones, pickups, prompts, bark / sit / dig /
   shake / jump, timed-run checkpoints), checking that the reward lands in the wallet. Also covers the kind
   fail-and-retry path, replay pay, the festival gate, "show me the way", the daily and weekly trail tasks, saving,
   the journal at 390x844 and 844x390, and that nothing is requested from outside the origin.
   Exits non-zero if any check fails. MISSION=<id> runs just that one (plus the shared checks it needs). */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..'), PORT = +(process.env.PORT || 8953), BASE = `http://localhost:${PORT}/`;
const OUT = path.resolve(process.argv[2] && process.argv[2] !== '.' ? process.argv[2] : path.join(require('os').tmpdir(), 'kc-open-trail-missions'));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
});
let failed = 0; const ok = (name, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra !== '' ? '  [' + extra + ']' : '')); return !!cond; };
const ONLY = process.env.MISSION || '';
const wait = (page, ms) => page.waitForTimeout(ms);

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block', ...opts });
  const page = await ctx.newPage(), errors = [], requests = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => requests.push(r.url()));
  await page.goto(BASE + '?debug=1&nosw=1');
  await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 });
  await page.evaluate(() => { __ot.start(); __ot.step(5); window.__w = []; __ot.game.on('wallet', e => window.__w.push({ cur: e.currency, delta: e.delta, reason: e.reason })); });
  return { ctx, page, errors, requests };
}
const M = (page, fn, arg) => page.evaluate(([src, arg]) => { const m = __ot.game.modules.missions; return (0, eval)('(' + src + ')')(m, __ot, arg); }, [fn.toString(), arg]);
const bones = page => page.evaluate(() => __ot.state().wallet.bones);
const fadeDone = page => page.waitForFunction(() => !__ot.game.ui.fading, null, { timeout: 5000 });

/* talk to the giver with the real prompt and press the real start button */
async function startAtGiver(page, id) {
  const info = await M(page, (m, ot, id) => { const d = m.list().find(x => x.id === id); ot.teleport(d.x + 1.1, d.z + 1.1, 0); ot.step(10); const prompt = ot.state().prompt; ot.press('interact'); ot.step(3); return { prompt, giver: d.giver, modal: ot.state().modal, pays: d.pays }; }, id);
  if (info.modal !== 'mission-offer') return { ...info, started: false };
  const title = await page.textContent('#modalTitle'); await page.click('#modalActions .btn.go'); await page.evaluate(() => __ot.step(3));
  const a = await M(page, m => m.active());
  return { ...info, title, started: !!a && a.id === id };
}
/* one autopilot move: go where the HUD objective points and do what the step asks for */
const pilot = page => page.evaluate(() => {
  const m = __ot.game.modules.missions, a = m.active(); if (!a) return null; if (__ot.game.ui.fading) return { ...a, fading: true }; if (__ot.state().modal) return { ...a, modal: __ot.state().modal };
  if (a.need === 'nudge' && a.drive) { const d = a.drive; __ot.teleport(d.x, d.z, d.yaw); __ot.setCam(d.yaw, 0.3, 8); __ot.step(4); __ot.hold('KeyW', true); __ot.step(d.steps); __ot.hold('KeyW', false); __ot.step(200); return m.active(); }
  if (a.target) __ot.teleport(a.target.x + 0.7, a.target.z + 0.7);
  __ot.step(8); if (a.need && a.need !== 'nudge') __ot.press(a.need); __ot.step(24);
  return m.active();
});
/* really run it: hold forward at plain running speed (no sprint), steering at the HUD objective every third of a second, obstacles and all */
async function playOnFoot(page) {
  const r = await page.evaluate(() => { const ms = __ot.game.modules.missions; let n = 0, last = null, left = null; __ot.hold('KeyW', true);
    while (n < 6000) { const a = ms.active(); if (!a) break; last = a; if (__ot.game.run && __ot.game.run.left != null) left = __ot.game.run.left; if (a.target) { const p = __ot.state().pos; __ot.setCam(Math.atan2(a.target.x - p.x, a.target.z - p.z), 0.3, 8); } __ot.step(10); n += 10; }
    __ot.hold('KeyW', false); return { moves: n, last, left }; });
  return { ...r, still: await page.evaluate(() => __ot.game.modules.missions.active()) };
}
async function play(page, id, o = {}) {
  if (o.onFoot) return playOnFoot(page);
  let last = null, n = 0;
  for (; n < (o.max || 400); n++) { const a = await pilot(page); if (!a) break; last = a; if (a.fading) await wait(page, 80); if (a.modal) break; if (o.each) await o.each(a, n); }
  return { moves: n, last, still: await M(page, m => m.active()) };
}
/* a whole mission: giver prompt, start button, play, reward */
async function runMission(page, id, label, o = {}) {
  const before = await bones(page), w0 = await page.evaluate(() => window.__w.length), s = await startAtGiver(page, id);
  if (!ok(`${label}: the giver's prompt opens the offer and the start button starts it`, s.started, `${s.prompt} / ${s.title || s.modal}`)) { await page.evaluate(() => __ot.game.ui.closeAll()); return null; }
  if (o.afterStart) await o.afterStart();
  const r = await play(page, id, o); await page.evaluate(() => __ot.step(20));
  const after = await bones(page), st = await M(page, (m, ot, id) => ({ done: m.count(id), active: m.active(), obj: !!ot.game.api.objective, timer: !!ot.game.run, left: [...ot.game.seams.placed.keys()].filter(k => k.startsWith('ms:' + id + ':')), blocked: ot.game.travel.blocked }), id);
  const want = s.pays + (o.bonus || 0), w = (await page.evaluate(n => window.__w.slice(n), w0)).filter(e => e.cur === 'bones'), paid = w.filter(e => /^(mission|activity):/.test(e.reason)), other = w.filter(e => !/^(mission|activity):/.test(e.reason)).reduce((t, e) => t + e.delta, 0);
  ok(`${label}: played through with real triggers and finished`, !r.still && st.done >= 1, `${r.moves} moves, last step "${r.last && r.last.step}"`);
  ok(`${label}: the reward lands in the wallet (${want} bones through game.economy.grant)`, paid.length === 1 && paid[0].delta === want && paid[0].reason.endsWith(':' + id) && after - before === want + other, `${before} -> ${after}` + (other ? ` (${other} more from bones found on the way)` : ''));
  if (o.onFoot) ok(`${label}: beaten by really running the route at plain run speed, no sprint, with time to spare`, !r.still && r.left > 3, r.left != null ? r.left.toFixed(1) + ' s left on the clock' : '');
  ok(`${label}: cleans up after itself (no props, objective, timer or travel block left)`, st.left.length === 0 && !st.obj && !st.timer && !st.blocked, JSON.stringify({ left: st.left.slice(0, 4), obj: st.obj, timer: st.timer, blocked: st.blocked }));
  return { before, after, pays: s.pays, got: paid.length ? paid[0].delta : 0 };
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const { ctx, page, errors, requests } = await open(browser);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  /* ---------- the module and its list ---------- */
  const list = await M(page, m => m.list());
  const story = list.filter(d => !d.festival), fest = list.filter(d => d.festival);
  ok('missions module: 16 missions and 8 festival activities are defined', story.length === 16 && fest.length === 8, `${story.length} + ${fest.length}`);
  ok('missions module: public API', await M(page, m => ['list', 'get', 'start', 'retry', 'leave', 'open', 'showWay', 'ferry', 'stats', 'active', 'isDone', 'count', 'complete', 'tasks'].every(k => typeof m[k] === 'function')));
  const sum = story.reduce((s, d) => s + d.reward, 0);
  ok('rewards: the 16 first-time rewards add up to the spec target of about 1,800 bones (300 an hour over stage B), tutorial 50', sum === 1800 && story[0].reward === 50, String(sum));
  ok('rewards: every mission and activity pays bones and is replayable at a lower job rate', list.every(d => d.reward > 0 && d.again > 0 && d.again <= d.reward));
  const placing = await M(page, (m, ot) => m.list().map(d => ({ id: d.id, fest: d.festival, zone: ot.zoneAt(d.x, d.z), clear: ot.game.place.clear(d.x, d.z, 0.5), npc: !!ot.game.place.get('msg:' + d.id), marker: ot.game.api.markers.has('msg:' + d.id) })));
  const ZONE = { bell: ['plaza', 'oldtown'], paper: ['oldtown'], patrol: ['cvpark', 'oldtown', 'sthelens'], shuttle: ['marina'], castle: ['sand'], lunch: ['farm', 'sauvie'], sniff: ['nobhill', 'sthelens'], creek: ['mccormick'], echo: ['quarry', 'sthelens'], mill: ['mill'], train: ['hwy30', 'mill', 'bottoms'], haul: ['farm'], corn: ['farm'], flags: ['cathedral'], walk: ['linnton', 'forestpark'], carts: ['carts'] };
  ok('placement: every giver stands on clear ground in the right district', placing.every(p => p.clear && (p.fest || (ZONE[p.id] || []).includes(p.zone))), placing.filter(p => !p.clear || (!p.fest && !(ZONE[p.id] || []).includes(p.zone))).map(p => p.id + ':' + p.zone + ':' + p.clear).join(' '));
  ok('placement: story givers and their map markers are in the world; festival givers are not (festival off)', placing.every(p => (p.fest ? !p.npc && !p.marker : p.npc && p.marker)));
  ok('festival gate: an activity cannot be started while the festival flag is off', await M(page, m => m.start('stack') === false && !m.active()));

  /* ---------- the journal ---------- */
  await M(page, m => { m.open(); });
  await page.waitForSelector('.ms-journal .tabstrip');
  const j0 = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.tabstrip [data-tab]')].map(b => b.dataset.tab), cards: document.querySelectorAll('.tabpane .item').length, pause: __ot.state().paused }));
  ok('journal: opens with Missions and Trail tasks tabs (no Festival tab while it is off) and lists all 16', j0.tabs.join() === 'missions,tasks' && j0.cards === 16, JSON.stringify(j0));
  await page.click('.tabpane .item[data-item="ms-creek"] .btn');
  const way = await M(page, (m, ot) => ({ modal: ot.state().modal, obj: ot.game.api.objective, way: m.data.way }));
  ok('journal: "Show me the way" closes the screen and points the compass / map objective at the giver', !way.modal && way.obj && Math.abs(way.obj.x - (-384)) < 1 && way.way === 'creek', JSON.stringify(way.obj));
  const near = await M(page, (m, ot) => { const d = m.list().find(x => x.id === 'creek'); ot.teleport(d.x + 4.5, d.z, 0); ot.step(80); return { obj: !!ot.game.api.objective, way: m.data.way, prompt: ot.state().prompt }; });
  ok('journal: 4.5 m from the giver, before the talk prompt shows, the pointer is still up', near.obj && near.way === 'creek' && !/Talk to/.test(near.prompt || ''), JSON.stringify(near));
  const arrive = await M(page, (m, ot) => { const d = m.list().find(x => x.id === 'creek'); ot.teleport(d.x + 1.4, d.z + 1.4, 0); ot.step(80); return { obj: ot.game.api.objective, way: m.data.way, prompt: ot.state().prompt }; });
  ok('journal: the waypoint clears itself on arrival, where the talk prompt is showing', !arrive.obj && !arrive.way && /Talk to/.test(arrive.prompt || ''), JSON.stringify(arrive));
  ok('pause menu: a Missions entry exists', await page.evaluate(() => __ot.game.ui.menuItems.some(i => i.id === 'missions')));

  /* ---------- kind failure: run out the clock on the paper round, then retry from the modal ---------- */
  if (!ONLY || ONLY === 'paper') {
    const b0 = await bones(page), s = await startAtGiver(page, 'paper');
    ok('fail / retry: the paper round starts as a timed run', s.started && await page.evaluate(() => !!__ot.game.run && __ot.game.run.left > 70));
    await page.evaluate(() => { __ot.teleport(-300, -120, 0); for (let i = 0; i < 40 && __ot.game.modules.missions.active(); i++) __ot.step(100); __ot.step(3); });
    const f = await M(page, (m, ot) => ({ active: m.active(), modal: ot.state().modal, done: m.count('paper'), wallet: ot.state().wallet.bones }));
    ok('fail / retry: when the clock wins nothing is taken away and a "Try again" screen opens', !f.active && f.modal === 'mission-retry' && f.done === 0 && f.wallet >= b0, JSON.stringify(f));
    const txt = await page.textContent('#modalBody');
    ok('fail / retry: the wording is kind', /nothing (is|was) (lost|taken)/i.test(txt), txt.slice(0, 90));
    await page.click('#modalActions .btn.go'); await wait(page, 700); await fadeDone(page); await page.evaluate(() => __ot.step(5));
    const again = await M(page, (m, ot) => ({ a: m.active(), pos: ot.state().pos }));
    ok('fail / retry: "Try again" puts KC back at the giver with the mission running', again.a && again.a.id === 'paper' && Math.hypot(again.pos.x + 205, again.pos.z + 201) < 6, JSON.stringify(again.pos));
    const r = await play(page, 'paper', { onFoot: true }); const b1 = await bones(page), got = (await page.evaluate(() => window.__w)).filter(e => e.reason === 'mission:paper');
    ok('fail / retry: the retry can be won by really running door to door (no sprint) and pays the full first-time reward', !r.still && r.left > 3 && got.length === 1 && got[0].delta === 90 && b1 >= b0 + 90, `${b0} -> ${b1}, ${r.left && r.left.toFixed(1)} s left`);
  }

  /* ---------- the 16 missions ---------- */
  for (const d of story) {
    if (ONLY && ONLY !== d.id) continue; if (d.id === 'paper') continue;   /* paper was played in the retry check above */
    const extra = { onFoot: d.id === 'train' };
    if (d.id === 'shuttle') extra.afterStart = async () => ok('Island Shuttle: the shuttle prompt is locked until KC carries the tent bag', await M(page, (m, ot) => { ot.teleport(m.FERRY.marina.x + 0.5, m.FERRY.marina.z + 0.5); ot.step(10); return !/shuttle/i.test(ot.state().prompt || ''); }));
    const r = await runMission(page, d.id, `mission ${d.n} ${d.name}`, extra);
    if (d.id === 'shuttle' && r) {
      const f = await M(page, (m, ot) => { ot.teleport(m.FERRY.island.x + 0.5, m.FERRY.island.z + 0.5); ot.step(10); const p = ot.state().prompt; ot.press('interact'); ot.step(2); return { p, ferry: m.data.ferry }; });
      await wait(page, 700); await fadeDone(page);
      const pos = await page.evaluate(() => { __ot.step(5); return __ot.state().pos; });
      ok('Island Shuttle: afterwards the shuttle runs for KC for good (rode it back to North Marina)', f.ferry && /shuttle/i.test(f.p || '') && Math.hypot(pos.x + 103, pos.z + 349) < 4, f.p);
    }
    if (d.id === 'carts' && r) ok('Cart Runner: marks the first payment toward a treat cart (flag cartRunner)', await page.evaluate(() => __ot.state().flags.cartRunner === true));
  }
  if (!ONLY) { const st = await M(page, m => m.stats()); ok('all 16 missions are completed and counted', st.done === 16 && st.total === 16, JSON.stringify(st)); }

  /* ---------- replay pay ---------- */
  if (!ONLY || ONLY === 'creek') {
    await page.evaluate(() => { __ot.game.modules.missions.data.clock += 40 * 60; });
    const a = await runMission(page, 'creek', 'replay: Creek Chase again (40 minutes of play later)');
    ok('replay: a finished mission pays the job rate (50) once 40 minutes of play have passed', a && a.pays === 50 && a.got === 50, a && `${a.pays}`);
    const b = await runMission(page, 'creek', 'replay: Creek Chase a third time (straight away)');
    ok('replay: one extra run in between pays a tenth (5), and the card says so', b && b.pays === 5 && b.got === 5, b && `${b.pays}`);
    await page.evaluate(() => { __ot.game.world.day += 3; __ot.setTime(23.9); __ot.step(60); });
    const c3 = await runMission(page, 'creek', 'replay: Creek Chase a fourth time (after a new game day and a nap)');
    ok('replay: any more runs pay 1 bone, and a new game day or a nap does not bring full pay round sooner', c3 && c3.pays === 1 && c3.got === 1, c3 && `${c3.pays}`);
    ok('replay: mission pay does not move with ECON_SCALE (the price knob)', await page.evaluate(() => { const m = __ot.game.modules.missions, e = __ot.game.economy, was = e.ECON_SCALE, before = m.list().map(d => d.pays).join(); e.ECON_SCALE = 2; const after = m.list().map(d => d.pays).join(); e.ECON_SCALE = was; return before === after; }));
  }

  /* ---------- a mission can be set aside ---------- */
  if (!ONLY) {
    const s = await startAtGiver(page, 'flags'); const b0 = await bones(page);
    await M(page, m => { m.open(); }); await page.waitForSelector('.ms-journal .ms-aside');
    const now = await page.evaluate(() => ({ tag: document.querySelector('.item[data-item="ms-flags"] .tag2').textContent, btn: document.querySelector('.item[data-item="ms-flags"] .btn.go').textContent }));
    await page.click('.ms-journal .ms-aside'); await page.evaluate(() => { __ot.game.ui.closeAll(); __ot.step(5); });
    const st = await M(page, (m, ot) => ({ a: m.active(), left: [...ot.game.seams.placed.keys()].filter(k => k.startsWith('ms:flags:')).length, obj: !!ot.game.api.objective }));
    ok('set aside: the journal shows the active mission ("Now", "Show the next step") and "Set aside" ends it with no penalty', s.started && now.tag === 'Now' && /next step/i.test(now.btn) && !st.a && st.left === 0 && !st.obj && (await bones(page)) === b0, JSON.stringify(now));
  }

  /* ---------- festival activities ---------- */
  await page.evaluate(() => { __ot.festival(true); __ot.step(5); });
  const fp = await M(page, (m, ot) => m.list().filter(d => d.festival).map(d => ({ id: d.id, clear: ot.game.place.clear(d.x, d.z, 0.5), npc: !!ot.game.place.get('msg:' + d.id), zone: ot.zoneAt(d.x, d.z) })));
  ok('festival on: the eight activity givers appear on clear ground in old town, and the market stalls are set up', fp.length === 8 && fp.every(p => p.npc && p.clear) && await page.evaluate(() => [0, 1, 2, 3, 4, 5].every(i => !!__ot.game.place.get('fest:stall:' + i))), JSON.stringify(fp.filter(p => !p.npc || !p.clear)));
  for (const d of fest) {
    if (ONLY && ONLY !== d.id) continue;
    const extra = {};
    if (d.id === 'haymaze') {   /* visit the six hidden treats (3 bones each) before leaving by the south gap */
      const cells = [[1, 1], [7, 3], [1, 5], [3, 9], [7, 11], [4, 15]]; let did = false; extra.bonus = 18;
      extra.afterStart = async () => ok('Hay Maze: every treat and the way out can be reached on foot between the bales', await page.evaluate(cells => { const MAP = 17, W = 9, w = __ot.game.world, P = __ot.game.place, at = (k, r) => [-160.4 + k * 1.8, -266.4 + r * 1.8], free = (k, r) => { const [x, z] = at(k, r); return !w.blockedAt(x, z, P.groundY(x, z) - 0.6, 0.42); }, seen = new Set(['4,0']), q = [[4, 0]];
        while (q.length) { const [k, r] = q.shift(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = k + a, nr = r + b, key = nk + ',' + nr; if (nk < 0 || nr < 0 || nk >= W || nr >= MAP || seen.has(key) || !free(nk, nr)) continue; seen.add(key); q.push([nk, nr]); } }
        return free(4, 0) && seen.has('4,16') && cells.every(c => seen.has(c.join(','))) && !free(0, 0) && !free(3, 0) && seen.size === 67; }, cells));
      extra.each = async (a) => { if (did || !/treats/.test(a.step)) return; const inside = await page.evaluate(() => { const o = __ot.game.api.objective; return o && o.z > -240; }); if (!inside) return; did = true;
        await page.evaluate(cells => { for (const [k, r] of cells) { __ot.teleport(-160.4 + k * 1.8, -266.4 + r * 1.8); __ot.step(12); } }, cells); };
    }
    const r = await runMission(page, d.id, `festival ${d.n} ${d.name}`, extra);
    if (d.id === 'bowling' && r) ok('Pumpkin Bowling: the nosed pumpkin really knocks gourds over', await M(page, m => (m.list().find(x => x.id === 'bowling').best || 0) >= 1), String(await M(page, m => m.list().find(x => x.id === 'bowling').best)));
    if (d.id === 'windows' && r) ok('Window Contest: the five finished displays stay on the street', await page.evaluate(() => ['pets', 'bakery', 'hardware', 'toys', 'icecream'].every(id => !!__ot.game.place.get('fest:win:' + id))));
  }
  if (!ONLY) {
    const st = await M(page, m => m.stats()); ok('all 8 festival activities are completed and counted', st.festivalDone === 8, JSON.stringify(st));
    await M(page, m => { m.open('festival'); }); await page.waitForSelector('.ms-journal .tabstrip');
    ok('journal: a Festival tab lists the eight activities while the festival is on', await page.evaluate(() => [...document.querySelectorAll('.tabstrip [data-tab]')].some(b => b.dataset.tab === 'festival') && document.querySelectorAll('.tabpane .item').length === 8));
    await page.evaluate(() => __ot.game.ui.closeAll());
    /* turning the festival off mid-activity sets it aside and removes the givers and the stalls */
    const s = await startAtGiver(page, 'market');
    const off = await M(page, (m, ot) => { ot.festival(false); ot.step(5); return { a: m.active(), npc: !!ot.game.place.get('msg:market'), stalls: !!ot.game.place.get('fest:stall:0'), run: !!ot.game.run, wins: !!ot.game.place.get('fest:win:pets') }; });
    ok('festival off: a running activity is set aside, givers, stalls and displays go away, nothing is lost', s.started && !off.a && !off.npc && !off.stalls && !off.run && !off.wins, JSON.stringify(off));
  }

  /* ---------- daily sniff-outs (owned by the economy module, shown here) and weekly trail tasks ---------- */
  if (!ONLY) {
    const t0 = await M(page, m => { m._setClock(() => new Date(2026, 10, 16, 10)); return m.tasks(); });
    ok('trail tasks: three weekly tasks are made on the device from the date, and the three daily sniff-outs come from the economy module', t0.daily && t0.daily.goals.length === 3 && t0.weekly.tasks.length === 3 && t0.weekly.key === '2026-W47' && new Set(t0.weekly.tasks.map(t => t.type)).size === 3, (t0.daily ? t0.daily.goals.map(t => t.text).join(' | ') : 'no daily') + ' || ' + t0.weekly.tasks.map(t => t.text).join(' | '));
    ok('trail tasks: the same week gives the same tasks', await M(page, (m, ot, a) => { m.data.weekly = null; m._setClock(() => new Date(2026, 10, 19, 22)); return JSON.stringify(m.tasks().weekly.tasks.map(t => [t.type, t.n])) === a; }, JSON.stringify(t0.weekly.tasks.map(t => [t.type, t.n]))));
    const EV = { bones: ['boneCollected', {}], dig: ['pickup', { kind: 'dig' }], talk: ['talk', {}], dog: ['dogPlay', {}], swim: ['swimStart', {}], ride: ['vehicleEnter', {}], photo: ['photoTaken', {}], fetch: ['fetch', {}], job: ['missionComplete', {}] };
    /* finish the economy's three sniff-outs through the stats it counts, and check gems are paid once, by the economy alone */
    const res = await M(page, (m, ot) => { const st = ot.game.state.stats; for (const g of m.tasks().daily.goals) st[g.stat] = (Number(st[g.stat]) || 0) + (g.need - g.have); ot.step(400); const d = m.tasks().daily, gems = window.__w.filter(e => e.cur === 'gems' && e.delta > 0); return { done: d.done, paid: d.paid, daily: gems.filter(e => e.reason === 'daily').map(e => e.delta), mine: gems.filter(e => /^(mission|activity|weekly|daily:)/.test(e.reason)).length }; });
    ok('trail tasks: over the whole run the three sniff-outs paid 2 gems (spec 3.4) exactly once, from the economy module and never from this one', res.done && res.paid && res.daily.length === 1 && res.daily[0] === 2 && res.mine === 0, JSON.stringify(res));
    const again = await M(page, (m, ot) => { const g0 = ot.state().wallet.gems; for (let i = 0; i < 30; i++) { ot.emit('boneCollected', {}); ot.emit('fogBell', {}); ot.emit('talk', {}); } ot.step(400); return ot.state().wallet.gems - g0; });
    ok('trail tasks: nothing from this module ever pays gems', again === 0);
    await M(page, m => { m.open('tasks'); }); await page.waitForSelector('.ms-tasks');
    const tp = await page.evaluate(() => ({ rows: document.querySelectorAll('.ms-task').length, done: document.querySelectorAll('.ms-task.done').length, text: document.querySelector('.tabpane').textContent }));
    ok('trail tasks: the screen lists six tasks with progress, says there is no streak, and shows no countdown', tp.rows === 6 && tp.done >= 3 && /no streak/i.test(tp.text) && !/\d+\s*(h|hours?|min|minutes?)\s*(left|remaining)/i.test(tp.text) && !/hurry|only today|expires/i.test(tp.text), `${tp.rows} rows, ${tp.done} done`);
    await page.screenshot({ path: path.join(OUT, 'tasks-1280.png') }); await page.evaluate(() => __ot.game.ui.closeAll());
    const wk = await M(page, (m, ot, EV) => { const n0 = window.__w.length, w0 = { ...ot.state().wallet }, t = m.tasks().weekly.tasks, todo = t.filter(k => !k.done).length; for (const k of t) { if (k.done) continue; if (k.type === 'explore') { for (let i = 0; i < k.n; i++) ot.emit('enterZone', { district: true, id: 'test-zone-' + i }); continue; } const e = EV[k.type]; for (let i = k.have; i < k.n; i++) ot.emit(e[0], e[1]); } const w = m.tasks().weekly; return { delta: window.__w.slice(n0).filter(e => /^weekly/.test(e.reason)).reduce((s, e) => s + e.delta, 0), gems: ot.state().wallet.gems - w0.gems, want: todo * 50 + 50, todo, paid: w.paid }; }, EV);
    ok('trail tasks: weekly tasks pay 50 bones each and 50 more for all three (bones only)', wk.paid && wk.todo >= 1 && wk.delta === wk.want && wk.gems === 0, JSON.stringify(wk));
    const twice = await M(page, (m, ot, EV) => { const n0 = window.__w.length; for (const k of Object.keys(EV)) for (let i = 0; i < 200; i++) ot.emit(EV[k][0], EV[k][1]); return window.__w.slice(n0).filter(e => /^weekly/.test(e.reason)).length; }, EV);
    ok('trail tasks: finished weekly tasks do not pay twice', twice === 0);
    const next = await M(page, (m, ot) => { const w0 = ot.state().wallet.bones; m._setClock(() => new Date(2026, 10, 30, 9)); const d = m.tasks(); return { key: d.weekly.key, fresh: d.weekly.tasks.every(t => !t.done && t.have === 0) && !d.weekly.paid, delta: ot.state().wallet.bones - w0 }; });
    ok('trail tasks: skipping a whole week just brings three new ones (no streak, no penalty)', next.key === '2026-W49' && next.fresh && next.delta === 0, JSON.stringify(next));
    await M(page, (m, ot) => { m.open('board'); }); await page.waitForSelector('.ms-journal .tabpane .item');
    ok('planning board: open("board") (the den\'s board in the Shop) opens the journal on the mission list', await page.evaluate(() => /Planning board/.test(document.querySelector('.modal .card').textContent) && document.querySelectorAll('.tabpane .item').length === 16));
    await page.evaluate(() => __ot.game.ui.closeAll());
    await M(page, m => m._setClock(null));
  }

  /* ---------- saving ---------- */
  if (!ONLY) {
    const before = await M(page, (m, ot) => { ot.save(); return { done: m.list().map(d => d.done), ferry: m.data.ferry, bones: ot.state().wallet.bones }; });
    await page.reload(); await page.waitForFunction(() => window.__ot && window.__ot.ready, null, { timeout: 120000 }); await page.evaluate(() => { __ot.start(); __ot.step(5); });
    const after = await M(page, (m, ot) => ({ done: m.list().map(d => d.done), ferry: m.data.ferry, bones: ot.state().wallet.bones, active: m.active() }));
    ok('saving: completions, the shuttle unlock and the wallet survive a reload; no mission is left half-running', JSON.stringify(before.done) === JSON.stringify(after.done) && after.ferry === true && after.bones === before.bones && !after.active, JSON.stringify(after.done));
  }

  /* ---------- phone layouts ---------- */
  for (const [w, h] of ONLY ? [] : [[390, 844], [844, 390]]) {
    const ph = await open(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), p = ph.page, tag = `${w}x${h}`;
    await p.evaluate(() => { __ot.festival(true); __ot.step(5); const m = __ot.game.modules.missions; m.open('missions'); });
    await p.waitForSelector('.ms-journal .tabpane .item'); await wait(p, 150);
    const lay = await p.evaluate(() => { const card = document.querySelector('.modal .card').getBoundingClientRect(), body = document.querySelector('#modalBody'); const small = [...document.querySelectorAll('.modal button')].filter(b => b.offsetParent && (b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44)).map(b => (b.id || b.className) + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height));
      const wide = [...document.querySelectorAll('.tabpane *')].filter(e => e.getBoundingClientRect().right > card.right + 1).length; return { fits: card.left >= 0 && card.right <= innerWidth && card.bottom <= innerHeight && card.top >= 0, hscroll: body.scrollWidth > body.clientWidth + 1, small, wide, items: document.querySelectorAll('.tabpane .item').length }; });
    ok(`${tag}: the journal fits the screen, nothing spills sideways, every button is at least 44 px`, lay.fits && !lay.hscroll && lay.small.length === 0 && lay.wide === 0 && lay.items === 16, JSON.stringify(lay));
    await p.screenshot({ path: path.join(OUT, `journal-${tag}.png`) });
    await p.tap('.tabstrip [data-tab="tasks"]'); await p.waitForSelector('.ms-tasks'); await wait(p, 100);
    const lay2 = await p.evaluate(() => { const card = document.querySelector('.modal .card').getBoundingClientRect(), body = document.querySelector('#modalBody'); return { hscroll: body.scrollWidth > body.clientWidth + 1, wide: [...document.querySelectorAll('.tabpane *')].filter(e => e.getBoundingClientRect().right > card.right + 1).length, rows: document.querySelectorAll('.ms-task').length }; });
    ok(`${tag}: the trail tasks page fits`, !lay2.hscroll && lay2.wide === 0 && lay2.rows === 6, JSON.stringify(lay2));
    await p.screenshot({ path: path.join(OUT, `tasks-${tag}.png`) }); await p.evaluate(() => __ot.game.ui.closeAll());
    /* the offer card, opened with a real tap on the prompt */
    await p.evaluate(() => { const d = __ot.game.modules.missions.list().find(x => x.id === 'carts'); __ot.teleport(d.x + 1.1, d.z + 1.1, 0); __ot.step(10); });
    await p.tap('#prompt'); await p.evaluate(() => __ot.step(3)); await p.waitForSelector('.ms-offer'); await wait(p, 120);
    const off = await p.evaluate(() => { const card = document.querySelector('.modal .card').getBoundingClientRect(), bs = [...document.querySelectorAll('#modalActions .btn')].map(b => b.getBoundingClientRect()); return { fits: card.left >= 0 && card.right <= innerWidth && card.bottom <= innerHeight && card.top >= 0, btn: bs.every(r => r.height >= 44 && r.bottom <= innerHeight), title: document.querySelector('#modalTitle').textContent }; });
    ok(`${tag}: tapping the giver's prompt opens an offer card that fits, with 44 px buttons in reach`, off.fits && off.btn && off.title === 'Cart Runner', JSON.stringify(off));
    await p.screenshot({ path: path.join(OUT, `offer-${tag}.png`) });
    await p.tap('#modalActions .btn.go'); await p.evaluate(() => __ot.step(40)); await wait(p, 200);
    /* in play: the objective chip, the timer chip and the HUD must not sit on top of each other or leave the screen */
    await p.evaluate(() => { const c = __ot.game.place.cart('Biscuit Wheel', 3.2); __ot.teleport(c.x, c.z); __ot.step(12); }); await wait(p, 200);
    const hud = await p.evaluate(() => { const vis = e => e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0, r = id => { const e = document.getElementById(id); return vis(e) ? e.getBoundingClientRect() : null; };
      const o = r('objective'), t = r('runTimer'), others = ['wallet', 'hudBtns', 'minimap', 'pad', 'stick', 'prompt', 'stamina'].map(id => [id, r(id)]).filter(x => x[1]);
      const hit = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; const inside = a => !a || (a.left >= 0 && a.right <= innerWidth && a.top >= 0 && a.bottom <= innerHeight);
      return { o: !!o, t: !!t, text: document.getElementById('objective').textContent, timer: document.getElementById('runTimer') && document.getElementById('runTimer').textContent, clash: others.filter(x => hit(o, x[1]) || hit(t, x[1])).map(x => x[0]), ot: hit(o, t), inside: inside(o) && inside(t) }; });
    ok(`${tag}: in a timed step the objective and the timer are on screen and overlap nothing on the HUD`, hud.o && hud.t && hud.clash.length === 0 && !hud.ot && hud.inside, JSON.stringify(hud));
    await p.screenshot({ path: path.join(OUT, `play-${tag}.png`) });
    ok(`${tag}: no console errors`, ph.errors.length === 0, ph.errors.slice(0, 3).join(' | '));
    await ph.ctx.close();
  }

  /* ---------- hygiene ---------- */
  const outside = requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok('network: nothing was requested from outside the origin', outside.length === 0, outside.slice(0, 3).join(' '));
  ok('no console errors or page errors during the whole run', errors.length === 0, errors.slice(0, 4).join(' | '));
  const src = ['js/missions.js', 'js/activities.js', 'css/missions.css'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ok('source: no network calls, no storage access, no outside URLs in the missions files', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|https?:\/\//.test(src));
  ok('source: nothing from the do-not-copy list', !new RegExp(['hallo' + 'ween' + ' ?town', 'crom' + 'well', 'kala' + 'bar', 'jack[- ]o', 'wanted level', 'police', 'weapon', '\\bgun\\b'].join('|'), 'i').test(src));
  await page.screenshot({ path: path.join(OUT, 'end-1280.png') });
  await ctx.close(); await browser.close(); server.close();
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll mission checks passed'); console.log('screenshots: ' + OUT);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
