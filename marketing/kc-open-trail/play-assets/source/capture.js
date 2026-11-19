/* Store screenshots for Google Play, taken from the real game. Nothing is drawn on top: every picture is the game's own
   frame with its own HUD, as a phone or tablet shows it. Dev tool only; needs Playwright.

     cd site/games/kc-open-trail && python3 -m http.server 8931        # in one terminal
     NODE_PATH=$(npm root -g) node marketing/kc-open-trail/play-assets/source/capture.js            # everything
     NODE_PATH=$(npm root -g) node marketing/kc-open-trail/play-assets/source/capture.js phone-portrait plaza,canoe

   BASE=http://localhost:8931/ by default. The game is opened as the Play app (?src=play) with the debug hooks (?debug=1),
   which add window.__ot and draw nothing on screen. Each picture starts from a new, empty save.

   What the script does to the game before a picture, all through the game's own code:
   - finishes the two first steps (the first job and the first upgrade), so the "go here" chip of a brand-new save is gone;
   - moves KC, sets the time of day, hops on a ride, starts a job, opens the Shop, or switches the festival on;
   - raises the 3D sharpness to the size of the picture (the game normally caps it for speed);
   - waits out the passing notices (place-name banner, toasts, the first-run "drag here" tip) by hiding them. */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8931/';
const OUT = path.join(__dirname, '..');
const SETS = {                       /* css size x scale = picture size */
  'phone-portrait': { w: 432, h: 768, dsf: 2.5, ids: ['plaza', 'mission', 'bridge', 'canoe', 'skate', 'upgrades', 'wardrobe', 'festival'] },   /* 1080 x 1920 */
  'phone-landscape': { w: 768, h: 432, dsf: 2.5, ids: ['plaza', 'mission', 'bridge', 'canoe', 'skate', 'festival', 'dressed'] },               /* 1920 x 1080 */
  'tablet-7': { w: 960, h: 600, dsf: 2, ids: ['plaza', 'bridge', 'canoe', 'festival'] },                                                       /* 1920 x 1200 */
  'tablet-10': { w: 1280, h: 800, dsf: 1.5, ids: ['plaza', 'bridge', 'canoe', 'festival'] }                                                    /* 1920 x 1200 */
};
/* bones-only cosmetics from the in-game tailor (Ranger hat, red bandana): nothing from the paid sets is shown */
const wear = `__ot.grant({items:['hat:ranger','bandana:red']}); g.cosmetics.equip('hat:ranger'); g.cosmetics.equip('bandana:red');`;
const SCENES = {
  plaza: `__ot.setTime(10.5); __ot.teleport(-172,-238, 2.2); __ot.setCam(2.2+2.75,PORT?0.2:0.14,PORT?6:5.2); __ot.step(20);`,
  mission: `__ot.setTime(9.5); const d=M.list().find(m=>m.id==='paper'); __ot.teleport(d.x, d.z+1.8, Math.PI); __ot.setCam(Math.PI,PORT?0.3:0.25,8); __ot.step(8); M.start('paper',{force:true}); __ot.step(40);`,
  bridge: `__ot.setTime(16); __ot.teleport(44,250.5, Math.PI/2); __ot.setCam(Math.PI/2-0.25,PORT?0.2:0.16,PORT?10:9); __ot.step(20);`,
  canoe: `__ot.setTime(15); g.vehicles.reset('canoe-cathedral'); __ot.teleport(115,297,0); __ot.step(6); __ot.enter('canoe-cathedral'); __ot.setCam(Math.PI,0.2,10); __ot.hold('KeyW',true); __ot.step(110); __ot.hold('KeyW',false); __ot.setCam(Math.PI+0.5, 0.1, PORT?8:6.5); __ot.step(3);`,
  skate: `${wear} __ot.setTime(11); g.vehicles.reset('board-park'); __ot.teleport(-160,-159,Math.PI); __ot.step(6); __ot.enter('board-park'); __ot.setCam(Math.PI,0.3,8); __ot.hold('KeyW',true); __ot.step(45); const y=__ot.state().pos.yaw; __ot.setCam(y+2.6,0.12,PORT?5.4:4.6); __ot.step(4); __ot.hold('KeyW',false);`,
  upgrades: `__ot.setTime(11); __ot.teleport(-168,-166,Math.PI/2); __ot.step(4); __ot.give({bones:450}); g.modules.shop.open('upgrades');`,
  wardrobe: `${wear} __ot.setTime(11); __ot.teleport(-168,-166,Math.PI/2); __ot.step(4); __ot.give({bones:450}); g.modules.shop.open('wardrobe');`,
  dressed: `${wear} __ot.setTime(11); __ot.teleport(-150,-176,Math.PI/2); __ot.setCam(Math.PI/2+2.6,0.16,PORT?4.6:3.8); __ot.step(12);`,
  festival: `__ot.setTime(19.2); __ot.festival(true); __ot.teleport(-186,-250, Math.PI/2); __ot.setCam(Math.PI/2,0.16,7); __ot.step(100);`
};
const hideNotices = page => page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.classList.remove('on'); for (const id of ['coach', 'toasts']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } });
(async () => {
  const [, , onlySet, onlyIds] = process.argv; let bad = 0;
  for (const [set, o] of Object.entries(SETS)) {
    if (onlySet && onlySet !== 'all' && onlySet !== set) continue;
    for (const id of o.ids) {
      if (onlyIds && !onlyIds.split(',').includes(id)) continue;
      const b = await chromium.launch();
      const ctx = await b.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dsf, hasTouch: true, isMobile: true });
      const page = await ctx.newPage(); const errs = [];
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push(e.message));
      try {
        await page.goto(BASE + '?src=play&debug=1&nosw&q=high');
        await page.waitForFunction(() => window.__ot && __ot.ready, null, { timeout: 120000 });
        const st = await page.evaluate(`(async () => { const g = __ot.game, PORT = innerHeight > innerWidth;
          __ot.start(); __ot.setQuality('high'); g.quality.pr = ${o.dsf}; dispatchEvent(new Event('resize'));
          const M = g.modules.missions; M.start('bell', { force: true }); __ot.step(5); M.complete(); __ot.step(20); __ot.give({ bones: 150 }); g.modules.economy.buyLevel('sniffer'); __ot.step(10); g.ui.closeAll();
          ${SCENES[id]}
          const s = __ot.state(); return { channel: __ot.channel, zone: s.zone, ride: s.ride, modal: s.modal, wallet: s.wallet }; })()`);
        await page.waitForTimeout(500); await hideNotices(page); await page.evaluate(() => __ot.step(1)); await page.waitForTimeout(250); await hideNotices(page);
        await page.screenshot({ path: path.join(OUT, set, id + '.png') });
        const usd = await page.evaluate(() => /\$\s?\d/.test(document.body.innerText));
        if (st.channel !== 'play' || usd || errs.length) { bad++; console.log('CHECK', set, id, JSON.stringify({ st, usd, errs })); } else console.log('ok', set, id, JSON.stringify(st));
      } catch (e) { bad++; console.log('FAIL', set, id, e.message.slice(0, 300)); }
      await b.close();
    }
  }
  process.exit(bad ? 1 : 0);
})();
