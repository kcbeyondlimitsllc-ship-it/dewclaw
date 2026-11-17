/* End-to-end check with Playwright (Chromium).
   1. serve the app:   cd www && python3 -m http.server 8852
   2. run:             node tests/e2e.js [http://localhost:8852] [folder-for-screenshots]
   Plays every activity through a full round with real taps at phone-portrait, phone-landscape and tablet
   sizes, and checks: no console errors, no request to anything but the local files, gentle wrong answers,
   big-enough touch targets, the parental gate, saving, and reset. */
"use strict";
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://localhost:8852").replace(/\/$/, "");
const SHOTS = process.argv[3] || null;
const VIEWS = { portrait: [390, 844], landscape: [844, 390], tablet: [1024, 768], small: [360, 640] };
const ACTS = ["count", "letters", "colors", "patterns", "memory", "compare"];
let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log("  FAIL: " + msg); } }
const st = pg => pg.evaluate(() => window.__kc.state());
const wait = (pg, fn, arg, t) => pg.waitForFunction(fn, arg, { timeout: t || 8000 });
/* real touch points through the DevTools protocol: press-and-hold, several fingers, sliding */
async function touch(pg, type, points) { const c = pg._cdp || (pg._cdp = await pg.context().newCDPSession(pg)); await c.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: p[2] || i + 1 })) }); }
async function hold(pg, x, y, ms) { await touch(pg, "touchStart", [[x, y]]); await pg.waitForTimeout(ms); }
const centre = async (pg, sel) => { const b = await pg.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

async function checkTargets(pg, sel, label, min) {
  const r = await pg.evaluate(([sel, min]) => {
    const W = innerWidth, H = innerHeight, out = [], boxes = [];
    document.querySelectorAll(sel).forEach(el => {
      const b = el.getBoundingClientRect(); if (!b.width || el.closest("[hidden]") || getComputedStyle(el).visibility === "hidden") return;
      if (b.width < min - 0.5 || b.height < min - 0.5) out.push("small " + Math.round(b.width) + "x" + Math.round(b.height) + " " + (el.id || el.className));
      if (b.left < 7 || b.top < 7 || b.right > W - 7 || b.bottom > H - 7) out.push("near edge/off screen " + (el.id || el.className) + " " + [b.left, b.top, b.right, b.bottom].map(Math.round));
      boxes.push(b);
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push("overlap " + i + "/" + j);
    }
    return out;
  }, [sel, min || 72]);
  ok(r.length === 0, label + ": " + r.slice(0, 4).join("; "));
}

async function playRound(pg, act, view, opts) {
  opts = opts || {};
  let guard = 0, triedWrong = false, kinds = {};
  for (;;) {
    const s = await st(pg);
    if (s.reward) break;
    if (++guard > 60) { ok(false, act + ": round did not finish"); break; }
    const q = await pg.evaluate(() => window.__kc.question());
    kinds[q.kind] = 1;
    ok((await pg.evaluate(() => window.__kc.validate())).length === 0, act + ": question failed validation");
    if (q.kind === "memory") {
      await checkTargets(pg, "#options .mcard, #homeBtn, #play .bar .muteBtn, #sayBtn", view + " " + act + " cards");
      const animals = q.cards;
      if (!triedWrong) {                       /* a mismatch must simply turn back over */
        triedWrong = true;
        const j = animals.findIndex((a, i) => i > 0 && a !== animals[0]);
        await pg.locator(".mcard").nth(0).tap(); await pg.locator(".mcard").nth(j).tap();
        ok((await st(pg)).wrong === 1, "memory: mismatch counted");
        await wait(pg, () => document.querySelectorAll(".mcard.up").length === 0);
        ok((await st(pg)).done === s.done, "memory: nothing lost after a mismatch");
      }
      const seen = {};
      for (let i = 0; i < animals.length; i++) {
        if (seen[animals[i]] === undefined) { seen[animals[i]] = i; continue; }
        await pg.locator(".mcard").nth(seen[animals[i]]).tap();
        await pg.locator(".mcard").nth(i).tap();
        await pg.waitForTimeout(30);
      }
      ok(await pg.locator(".mcard.matched").count() === animals.length, "memory: all cards matched");
    } else if (q.kind === "give") {
      await checkTargets(pg, "#options .treat, #doneBtn, #sayBtn, #homeBtn, #play .bar .muteBtn", view + " give targets");
      const nb = await pg.locator("#prompt.give > svg.txt").boundingBox(), bb = await pg.locator("#bowl").boundingBox();
      ok(nb && Math.min(nb.width, nb.height) >= 56, view + " give: the numeral is big enough to read (" + (nb ? Math.round(nb.width) + "x" + Math.round(nb.height) : "missing") + ")");
      ok(bb && bb.height >= 56 && bb.width >= 120, view + " give: the bowl is big enough (" + (bb ? Math.round(bb.width) + "x" + Math.round(bb.height) : "missing") + ")");
      if (!opts.gaveWrong) {                   /* wrong amount twice: gentle, then guided */
        opts.gaveWrong = true;
        await pg.locator("#doneBtn").tap();
        let s2 = await st(pg);
        ok(s2.index === s.index && s2.miss === 1 && !s2.locked, "give: wrong amount keeps the same question");
        ok(await pg.locator("#bowl.wobble").count() === 1, "give: bowl wobbles gently");
        await pg.locator("#doneBtn").tap();
        ok(await pg.locator(".treat.glow").count() === q.target, "give: after two misses exactly the needed treats glow");
      }
      const need = q.target - (await st(pg)).placed;
      for (let i = 0; i < need; i++) await pg.locator(".treat:not(.gone)").first().tap();
      if (q.target > 1 && !opts.tookBack) {    /* tap-to-take-back works */
        opts.tookBack = true;
        await pg.locator("#bowl").tap(); ok((await st(pg)).placed === q.target - 1, "give: tapping the bowl takes one back");
        await pg.locator(".treat:not(.gone)").first().tap();
      }
      ok((await st(pg)).placed === q.target, "give: placed the target number");
      await pg.locator("#doneBtn").tap();
    } else {
      await checkTargets(pg, "#options .opt, #sayBtn, #homeBtn, #play .bar .muteBtn", view + " " + act + "/" + q.kind + " options");
      if (q.kind === "qty") {
        const small = await pg.evaluate(() => { let m = 1e9; document.querySelectorAll("#options .opt > svg").forEach(e => { const b = e.getBoundingClientRect(), vb = e.viewBox.baseVal; m = Math.min(m, 92 * Math.min(b.width / vb.width, b.height / vb.height)); }); return m; });   /* each thing is drawn in a 92-unit square of its 100-unit cell */
        ok(small >= 36, view + " " + q.options.length + " groups: each thing to count gets at least a 36 px square (" + Math.round(small) + ")");
      }
      if (q.kind === "size") ok(new Set(q.options.map(o => o.name)).size === q.options.length, "size choices have different spoken names");
      ok(await pg.locator('.opt[data-correct="1"]').count() === 1, act + ": exactly one option marked correct");
      const box = await pg.locator("#prompt").boundingBox();
      ok(box && box.width > 100 && box.height > 60, act + ": prompt visible");
      if (!triedWrong) {                       /* wrong taps: wobble, hint, try again; highlight after two */
        triedWrong = true;
        const wrongs = pg.locator('.opt:not([data-correct="1"])');
        await wrongs.first().tap();
        let s2 = await st(pg);
        ok(s2.index === s.index && s2.done === s.done && s2.miss === 1 && !s2.locked && !s2.reward, act + ": first wrong tap keeps the question open");
        ok(await pg.locator(".opt.wobble").count() === 1, act + ": wrong option wobbles");
        ok(await pg.locator(".opt.glow").count() === 0, act + ": no highlight after one miss");
        if (q.options.length > 2) {
          await pg.locator('.opt:not([data-correct="1"]):not(.tried)').first().tap();
          ok(await pg.locator('.opt.glow[data-correct="1"]').count() === 1, act + ": right answer highlighted after two misses");
          ok((await st(pg)).index === s.index, act + ": still the same question after two misses");
        }
        if (q.kind === "count") {              /* tapping the things counts them */
          await pg.locator("#prompt .cnt").first().tap();
          ok(await pg.locator("#prompt .cnt.on").count() === 1, "count: tapping an object marks it");
        }
      }
      await pg.locator('.opt[data-correct="1"]').tap();
      ok(await pg.locator(".opt.right").count() === 1, act + ": right answer celebrated");
      ok(await pg.locator("#kc svg.happy").count() === 1, act + ": KC is happy");
    }
    const before = s.index, isLast = s.index === s.of - 1;
    await wait(pg, ([i, last]) => { const t = window.__kc.state(); return t.reward || t.index > i || t.screen !== "play"; }, [before, isLast], 12000);
  }
  return kinds;
}

async function run(name, extra) {
  const [w, h] = VIEWS[name];
  const browser = await chromium.launch();
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, hasTouch: true, isMobile: name !== "tablet", deviceScaleFactor: 2 }, extra || {}));
  const pg = await ctx.newPage();
  const errors = [], requests = [];
  pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  pg.on("pageerror", e => errors.push("pageerror: " + e.message));
  pg.on("request", r => requests.push(r.url()));
  pg.on("requestfailed", r => errors.push("requestfailed: " + r.url()));
  const shot = async n => { if (SHOTS) await pg.screenshot({ path: SHOTS + "/" + name + "-" + n + ".png" }); };
  const label = name + (extra && extra.reducedMotion ? " (reduced motion)" : "");
  console.log(label + " " + w + "x" + h);

  await pg.goto(BASE + "/index.html?debug=1&fast=1");
  await pg.waitForFunction(() => window.__kc);
  let s = await st(pg);
  ok(s.screen === "home" && s.audio === "none", "starts on the trail map with no audio context before a touch");
  ok((await pg.evaluate(() => window.__kc.spoken.length)) === 0, "nothing is spoken before a touch");
  await checkTargets(pg, "#home .stop, #bookBtn, #home .muteBtn, #gateBtn", label + " home targets");
  ok(await pg.locator("#home .stop").count() === 6, "six stops on the map");
  await shot("home");

  /* play all six activities to their sticker */
  const giveOpts = {};
  for (const act of ACTS) {
    await pg.locator('.stop[data-act="' + act + '"]').tap();
    await wait(pg, a => window.__kc.state().screen === "play" && window.__kc.state().act === a, act);
    s = await st(pg);
    ok(s.audio !== "none", "audio starts after the first touch");
    await shot(act);
    const kinds = await playRound(pg, act, label, giveOpts);
    s = await st(pg);
    ok(s.reward && !!s.sticker, act + ": round ends with a sticker");
    ok(await pg.locator("#rewardSticker svg").count() === 1, act + ": sticker is drawn");
    await checkTargets(pg, "#rHome, #rAgain, #rBook, #rMute", label + " reward buttons");
    ok(await pg.evaluate(() => { const b = document.getElementById("rMute").getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2).closest("#rMute") !== null && document.getElementById("stage").inert === true; }), act + ": reward has its own reachable mute button and the round underneath is inert");
    if (act === "count") await shot("reward");
    await pg.locator("#rHome").tap();
    await wait(pg, () => window.__kc.state().screen === "home");
  }
  let save = await pg.evaluate(() => window.__kc.save());
  ok(Object.keys(save.stickers).length === 6, "six different stickers after six rounds (got " + Object.keys(save.stickers).length + ")");
  ok(ACTS.every(a => save.rounds[a] === 1), "each activity recorded one round");
  ok(ACTS.every(a => save.lv[a] >= 1 && save.lv[a] <= 3), "levels stay within 1..3");

  /* harder levels render and play too (count 2 and 3 include the give-treats task) */
  for (const [act, lv] of [["count", 2], ["count", 3], ["letters", 3], ["colors", 2], ["colors", 3], ["patterns", 3], ["memory", 2], ["memory", 3], ["compare", 2], ["compare", 3]]) {
    await pg.evaluate(([a, l]) => window.__kc.start(a, l), [act, lv]);
    await pg.waitForTimeout(60);
    await shot(act + lv);
    await playRound(pg, act, label + " L" + lv, giveOpts);
    ok((await st(pg)).reward, act + " level " + lv + ": finished");
  }
  ok(giveOpts.gaveWrong && giveOpts.tookBack, "give-treats task was exercised");
  /* adaptive difficulty: a clean round moves up, a hard round moves down */
  await pg.evaluate(() => window.__kc.start("patterns", 0));
  const lv0 = (await pg.evaluate(() => window.__kc.save())).lv.patterns;
  for (let i = 0; i < 5; i++) { await pg.evaluate(() => window.__kc.answer()); await wait(pg, i => { const t = window.__kc.state(); return t.reward || t.index > i; }, i); }
  const lv1 = (await pg.evaluate(() => window.__kc.save())).lv.patterns;
  ok(lv1 === Math.min(3, lv0 + 1), "clean round moves the level up (" + lv0 + " -> " + lv1 + ")");
  await pg.evaluate(() => window.__kc.start("patterns", 0));
  for (let i = 0; i < 5; i++) { await pg.evaluate(() => { window.__kc.wrong(); window.__kc.wrong(); window.__kc.answer(); }); await wait(pg, i => { const t = window.__kc.state(); return t.reward || t.index > i; }, i); }
  const lv2 = (await pg.evaluate(() => window.__kc.save())).lv.patterns;
  ok(lv2 === Math.max(1, lv1 - 1), "hard round moves the level down (" + lv1 + " -> " + lv2 + ")");
  save = await pg.evaluate(() => window.__kc.save());
  ok(Object.keys(save.stickers).length === 18, "stickers never repeat while some are missing (" + Object.keys(save.stickers).length + ")");

  /* sticker book */
  await pg.locator("#rBook").tap();
  await wait(pg, () => window.__kc.state().screen === "book");
  ok(await pg.locator("#bookGrid .slot").count() >= 24, "book has at least 24 sticker places");
  ok(await pg.locator("#bookGrid .slot.got").count() === 18, "book shows the earned stickers");
  await checkTargets(pg, "#bookBack, #book .muteBtn", label + " book buttons");
  ok(await pg.evaluate(() => { const g = document.querySelectorAll("#bookGrid .slot"); let bad = 0; g.forEach(e => { if (e.offsetWidth < 72 || Math.abs(e.offsetWidth - e.offsetHeight) > 2) bad++; }); return bad === 0; }), "sticker places are round and at least 72 px");
  await pg.locator("#bookGrid .slot.got").first().tap();
  await shot("book");
  await pg.locator("#bookBack").tap();

  /* mute button */
  await pg.locator("#home .muteBtn").tap();
  ok((await pg.evaluate(() => window.__kc.save())).set.muted === true, "mute button mutes");
  await pg.locator("#home .muteBtn").tap();

  /* progress survives a reload */
  await pg.reload(); await pg.waitForFunction(() => window.__kc);
  const save2 = await pg.evaluate(() => window.__kc.save());
  const sorted = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  ok(sorted(save2.stickers) === sorted(save.stickers) && sorted(save2.lv) === sorted(save.lv) && sorted(save2.rounds) === sorted(save.rounds) && save2.set.muted === false, "progress persists across reload");

  /* the parental gate must not open by random tapping */
  let opened = false, seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gb = await pg.locator("#gateBtn").boundingBox();
  for (let i = 0; i < 220; i++) {
    const onGate = i % 4 === 0;
    const x = onGate ? gb.x + rnd() * gb.width : rnd() * w, y = onGate ? gb.y + rnd() * gb.height : rnd() * h;
    await pg.touchscreen.tap(x, y);
    await pg.waitForTimeout(90);               /* let a tapped stop finish opening its activity */
    const t = await st(pg);
    if (t.screen === "grown" || t.gate) opened = true;
    if (t.screen !== "home") await pg.evaluate(() => window.__kc.home());
  }
  ok(!opened, "220 random taps (55 on the gate button) never open the gate");
  const cx = gb.x + gb.width / 2, cy = gb.y + gb.height / 2;
  await hold(pg, cx, cy, 1500); await touch(pg, "touchEnd", []); await pg.waitForTimeout(1800);
  ok(!(await st(pg)).gate, "a 1.5 second press does not open the gate");
  await hold(pg, cx + 3, cy + 3, 3500);
  ok((await st(pg)).gate, "a 3 second finger hold shows the grown-up question");
  await touch(pg, "touchEnd", []); await pg.waitForTimeout(700);
  ok((await st(pg)).gate, "the question stays open when the finger lifts");
  ok(await pg.evaluate(() => document.getElementById("home").inert === true && !!document.activeElement.closest("#gate")), "the map behind the question is inert and focus is inside it");
  ok(await pg.evaluate(() => { const c = document.getElementById("gateCancel").getBoundingClientRect(); return c.bottom <= innerHeight - 4 && c.top >= 0; }), "the Cancel button is on screen");
  await shot("gate");
  await pg.touchscreen.tap(6, h / 2); await pg.waitForTimeout(250);
  ok(!(await st(pg)).gate, "a fresh tap outside the box closes it");
  await hold(pg, cx + 2, cy - 2, 3500); await touch(pg, "touchEnd", []); await pg.waitForTimeout(300);
  const ans = await pg.evaluate(() => window.__kc.gateAnswer());
  const qText = await pg.locator("#gateQ").textContent();
  const m = /(\d+)\s*×\s*(\d+)/.exec(qText);
  ok(m && +m[1] * +m[2] === ans, "gate question is a multiplication (" + qText + ")");
  for (const d of String(ans + 1)) await pg.locator('#gatePad [data-k="' + d + '"]').tap();
  await pg.locator('#gatePad [data-k="ok"]').tap();
  await pg.waitForTimeout(1100);
  s = await st(pg);
  ok(s.screen === "home" && !s.gate, "a wrong answer closes the gate");
  await hold(pg, cx - 3, cy - 3, 3500); await touch(pg, "touchEnd", []); await pg.waitForTimeout(300);
  const ans2 = await pg.evaluate(() => window.__kc.gateAnswer());
  for (const d of String(ans2)) await pg.locator('#gatePad [data-k="' + d + '"]').tap();
  await pg.locator('#gatePad [data-k="ok"]').tap();
  await wait(pg, () => window.__kc.state().screen === "grown");
  await shot("grownups");
  const txt = await pg.locator("#grownBody").innerText();
  ok(/Level \d of 3/.test(txt) && /Nothing leaves this device/.test(txt), "grown-ups corner shows progress and the privacy note");
  ok(await pg.locator("#grownBody .row").count() === 6, "progress listed for all six skills");
  await pg.locator('.sw[data-set="voice"]').tap();
  ok((await pg.evaluate(() => window.__kc.save())).set.voice === false, "voice can be switched off");
  await pg.locator('.sw[data-set="music"]').tap();
  await pg.locator("#resetAsk").scrollIntoViewIfNeeded();
  await pg.locator("#resetAsk").tap();
  ok(Object.keys((await pg.evaluate(() => window.__kc.save())).stickers).length === 18, "reset asks before erasing");
  await pg.locator("#resetYes").tap();
  let save3 = await pg.evaluate(() => window.__kc.save());
  ok(Object.keys(save3.stickers).length === 0 && ACTS.every(a => save3.lv[a] === 1 && save3.rounds[a] === 0), "reset clears levels and stickers");
  await pg.reload(); await pg.waitForFunction(() => window.__kc);
  save3 = await pg.evaluate(() => window.__kc.save());
  ok(Object.keys(save3.stickers).length === 0 && save3.set.voice === false && save3.set.music === false, "reset and settings persist across reload");

  /* no links anywhere, no forms, no text inputs, nothing external */
  const dom = await pg.evaluate(() => ({ a: document.querySelectorAll("a, [href]:not(link), form, input, textarea, iframe, img, video, audio").length, ext: /https?:\/\//i.test(document.documentElement.outerHTML.replace(/xmlns="[^"]*"/g, "")) }));
  ok(dom.a === 0, "no links, forms, inputs, iframes or media elements in the page");
  ok(!dom.ext, "no http(s) URL anywhere in the rendered page");
  const outside = requests.filter(u => !u.startsWith(BASE + "/"));
  ok(outside.length === 0, "no request outside the local files: " + outside.slice(0, 3).join(", "));
  const files = Array.from(new Set(requests.map(u => u.replace(BASE, "").replace(/\?.*/, "")))).sort();
  ok(errors.length === 0, "console clean: " + errors.slice(0, 3).join(" | "));
  console.log("  requests (" + requests.length + "): " + files.join(" "));
  await ctx.close(); await browser.close();
}

async function extras() {
  const browser = await chromium.launch();
  /* real timing (no fast mode), tab hidden, rotation */
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let pg = await ctx.newPage(); const errors = [];
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); pg.on("pageerror", e => errors.push(e.message));
  await pg.goto(BASE + "/index.html?debug=1"); await pg.waitForFunction(() => window.__kc);
  console.log("normal speed, rotation, hidden tab");
  let t0 = Date.now();
  await pg.locator('.stop[data-act="colors"]').tap();
  await wait(pg, () => window.__kc.state().screen === "play");
  ok(Date.now() - t0 < 2500, "activity opens within 2.5 s of the tap (" + (Date.now() - t0) + " ms)");
  ok((await pg.evaluate(() => window.__kc.spoken.length)) >= 1, "the instruction is spoken (or queued) once the activity opens");
  await pg.waitForTimeout(2600);
  ok(await pg.evaluate(() => { const p = document.getElementById("paw"); return getComputedStyle(p).opacity !== "0" || p.classList.contains("point"); }), "pointing-paw demonstration shows on first play");
  t0 = Date.now();
  await pg.locator('.opt[data-correct="1"]').tap();
  await wait(pg, () => window.__kc.state().index === 1, null, 12000);
  const dt = Date.now() - t0; ok(dt >= 1200 && dt < 9000, "next question follows the celebration after " + dt + " ms");
  await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(300);
  await checkTargets(pg, "#options .opt, #sayBtn, #homeBtn, #play .bar .muteBtn", "after rotating to landscape");
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
  await checkTargets(pg, "#options .opt, #sayBtn, #homeBtn, #play .bar .muteBtn", "after rotating back to portrait");
  ok((await st(pg)).audio === "running", "audio context running while visible");
  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await pg.waitForTimeout(300);
  ok((await st(pg)).audio === "suspended", "audio suspends when the tab is hidden");
  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await pg.waitForTimeout(300);
  ok((await st(pg)).audio === "running", "audio resumes when the tab is shown again");
  /* keyboard */
  await pg.keyboard.press("Escape"); ok((await st(pg)).screen === "home", "Escape returns to the map");
  await pg.keyboard.press("2"); await wait(pg, () => window.__kc.state().act === "letters");
  const ci = (await pg.evaluate(() => window.__kc.question())).correct;
  await pg.keyboard.press(String(ci + 1)); ok((await st(pg)).locked, "number keys choose an answer");
  ok(errors.length === 0, "console clean: " + errors.join(" | "));
  await ctx.close();

  /* no speech engine and no localStorage at all (like a locked-down WebView): still playable, silently */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  pg = await ctx.newPage(); const errors2 = [];
  pg.on("console", m => { if (m.type() === "error") errors2.push(m.text()); }); pg.on("pageerror", e => errors2.push(e.message));
  await pg.addInitScript(() => {
    try { delete window.speechSynthesis; Object.defineProperty(window, "speechSynthesis", { get() { return undefined; }, configurable: true }); } catch (e) {}
    try { delete window.SpeechSynthesisUtterance; window.SpeechSynthesisUtterance = undefined; } catch (e) {}
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); }, configurable: true });
  });
  console.log("no speech engine, no storage");
  await pg.goto(BASE + "/index.html?debug=1&fast=1"); await pg.waitForFunction(() => window.__kc);
  ok((await st(pg)).voice === false, "missing speech engine is detected");
  for (const act of ACTS) {
    await pg.locator('.stop[data-act="' + act + '"]').tap();
    await wait(pg, a => window.__kc.state().act === a && window.__kc.state().screen === "play", act);
    await playRound(pg, act, "no-voice", { gaveWrong: true, tookBack: true });
    ok((await st(pg)).reward, "no voice/storage: " + act + " finishes");
    await pg.locator("#rHome").tap();
  }
  ok(errors2.length === 0, "console clean without speech or storage: " + errors2.join(" | "));
  await ctx.close(); await browser.close();
}

/* regression checks for things found in review */
async function review() {
  const browser = await chromium.launch();
  const open = async (w, h, qs, init) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const pg = await ctx.newPage(); pg.errors = [];
    pg.on("console", m => { if (m.type() === "error") pg.errors.push(m.text()); }); pg.on("pageerror", e => pg.errors.push(e.message));
    if (init) await pg.addInitScript(init);
    await pg.goto(BASE + "/index.html?debug=1" + (qs || "")); await pg.waitForFunction(() => window.__kc);
    return pg;
  };
  const toKind = async (pg, kind) => { for (let i = 0; i < 6; i++) { const s = await st(pg); if (s.kind === kind) return true; if (s.reward) return false; await pg.evaluate(() => window.__kc.answer()); await wait(pg, i => { const t = window.__kc.state(); return t.reward || t.index > i; }, s.index); } return false; };
  console.log("review regressions");

  /* the give-treats numeral and the groups to compare, at many sizes */
  for (const [w, h] of [[360, 640], [375, 667], [412, 732], [414, 736], [600, 960], [768, 1024], [820, 1180], [800, 1280], [640, 360], [740, 360], [1366, 1024]]) {
    const pg = await open(w, h, "&fast=1");
    for (const lv of [2, 3]) {
      await pg.evaluate(l => window.__kc.start("count", l), lv);
      ok(await toKind(pg, "give"), "reached a give question");
      const nb = await pg.locator("#prompt.give > svg.txt").boundingBox(), bb = await pg.locator("#bowl").boundingBox(), pb = await pg.locator("#prompt").boundingBox();
      ok(nb && Math.min(nb.width, nb.height) >= 60, w + "x" + h + " L" + lv + ": give numeral at least 60 px (" + (nb ? Math.round(nb.width) + "x" + Math.round(nb.height) : "none") + ")");
      ok(bb && bb.height >= 56 && nb && nb.x >= pb.x && nb.y >= pb.y && bb.x + bb.width <= pb.x + pb.width + 1 && bb.y + bb.height <= pb.y + pb.height + 1, w + "x" + h + ": numeral and bowl both inside the card");
      if (SHOTS && lv === 3) await pg.screenshot({ path: SHOTS + "/give-" + w + "x" + h + ".png" });
    }
    let min3 = 1e9, tries = 0;
    while (min3 === 1e9 && tries++ < 12) {
      await pg.evaluate(() => window.__kc.start("compare", 3));
      for (let i = 0; i < 5; i++) {
        const s = await st(pg), q = await pg.evaluate(() => window.__kc.question());
        if (q.kind === "qty") {
          const m = await pg.evaluate(() => { let m = 1e9; document.querySelectorAll("#options .opt > svg").forEach(e => { const b = e.getBoundingClientRect(), vb = e.viewBox.baseVal; m = Math.min(m, 92 * Math.min(b.width / vb.width, b.height / vb.height)); }); return m; });   /* each thing is drawn in a 92-unit square of its 100-unit cell */
          ok(m >= 36, w + "x" + h + ": " + q.options.length + " groups: each thing to count gets at least a 36 px square (" + Math.round(m) + ")");
          if (q.options.length === 3) { min3 = Math.min(min3, m); if (SHOTS) await pg.screenshot({ path: SHOTS + "/qty3-" + w + "x" + h + ".png" }); }
        }
        await pg.evaluate(() => window.__kc.answer()); await wait(pg, i => { const t = window.__kc.state(); return t.reward || t.index > i; }, s.index);
      }
    }
    ok(min3 < 1e9, w + "x" + h + ": saw a three-group question");
    ok(pg.errors.length === 0, "console clean: " + pg.errors.join(" | "));
    await pg.context().close();
  }

  /* fingers: a resting thumb, a small slide, two taps at once */
  let pg = await open(390, 844, "&fast=1");
  await pg.evaluate(() => window.__kc.start("patterns", 1)); await pg.waitForTimeout(80);
  let [ox, oy] = await centre(pg, '.opt[data-correct="1"]');
  await touch(pg, "touchStart", [[8, 600, 1]]);
  await touch(pg, "touchStart", [[8, 600, 1], [ox, oy, 2]]);
  await touch(pg, "touchEnd", [[ox, oy, 2]]);                /* the tapping finger lifts, the thumb stays */
  await pg.waitForTimeout(60);
  ok((await st(pg)).done === 1, "a tap counts while a thumb rests on the screen edge");
  await touch(pg, "touchEnd", []);
  await wait(pg, () => window.__kc.state().index === 1);
  [ox, oy] = await centre(pg, '.opt[data-correct="1"]');
  await touch(pg, "touchStart", [[ox - 12, oy - 8]]); await touch(pg, "touchMove", [[ox, oy]]); await touch(pg, "touchMove", [[ox + 10, oy + 8]]); await touch(pg, "touchEnd", []);
  await pg.waitForTimeout(60);
  ok((await st(pg)).done === 2, "a finger that slides 25 px inside the same choice still counts");
  await wait(pg, () => window.__kc.state().index === 2);
  [ox, oy] = await centre(pg, '.opt[data-correct="1"]');
  const [wx, wy] = await centre(pg, '.opt:not([data-correct="1"])');
  await touch(pg, "touchStart", [[wx, wy]]); await touch(pg, "touchMove", [[ox, oy]]); await touch(pg, "touchEnd", []);
  await pg.waitForTimeout(60);
  let s = await st(pg);
  ok(s.done === 2 && s.wrong === 0, "sliding from one choice to another chooses neither");
  /* "say it again" after two misses must not count the question as hard twice */
  await pg.evaluate(() => { window.__kc.wrong(); window.__kc.wrong(); });
  const hard1 = (await st(pg)).hard;
  await pg.locator("#sayBtn").tap(); await pg.locator("#sayBtn").tap();
  ok(hard1 === 1 && (await st(pg)).hard === 1, "repeating the instruction after two misses does not count the question as hard again");
  ok(await pg.locator('.opt.glow[data-correct="1"]').count() === 1, "the answer is still highlighted after repeating");
  /* a tap handled at finger-up must not also click what the next screen puts under the finger */
  await pg.evaluate(() => window.__kc.home());
  await pg.locator("#bookBtn").tap(); await pg.waitForTimeout(500);
  ok((await st(pg)).screen === "book", "opening the book does not fall through to its Home button");
  await pg.locator("#bookBack").tap();
  ok(pg.errors.length === 0, "console clean: " + pg.errors.join(" | "));
  await pg.context().close();

  /* normal speed: stop then book, Escape; hidden tab; letters deck */
  pg = await open(390, 844, "");
  await pg.locator('.stop[data-act="colors"]').tap(); await pg.waitForTimeout(120); await pg.locator("#bookBtn").tap(); await pg.waitForTimeout(1300);
  ok((await st(pg)).screen === "home" || (await st(pg)).screen === "play", "tapping the book while KC walks to a stop does not open the book and then yank the child out");
  await pg.evaluate(() => window.__kc.home());
  await pg.locator('.stop[data-act="colors"]').tap(); await pg.waitForTimeout(120); await pg.keyboard.press("Escape"); await pg.waitForTimeout(1300);
  ok((await st(pg)).screen === "home", "Escape during the walk cancels the activity");
  await pg.locator('.stop[data-act="colors"]').tap(); await pg.waitForTimeout(120); await pg.evaluate(() => window.__kc.home()); await pg.locator("#bookBtn").tap(); await pg.waitForTimeout(1300);
  ok((await st(pg)).screen === "book", "leaving the map cancels the pending activity");
  await pg.evaluate(() => { window.__kc.home(); localStorage.clear(); }); await pg.reload(); await pg.waitForFunction(() => window.__kc);
  await pg.locator('.stop[data-act="patterns"]').tap(); await wait(pg, () => window.__kc.state().screen === "play");
  await pg.evaluate(() => window.__kc.hide(true)); await pg.waitForTimeout(1500);
  ok(!(await pg.evaluate(() => window.__kc.save())).demo["patterns.pattern"], "the first-time paw is not used up while the app is hidden");
  await pg.evaluate(() => window.__kc.hide(false)); await pg.waitForTimeout(2600);
  ok(await pg.evaluate(() => { const p = document.getElementById("paw"); return (getComputedStyle(p).opacity !== "0" || p.classList.contains("point")) && window.__kc.save().demo["patterns.pattern"] === 1; }), "the paw demonstration plays once the app is visible again");
  await pg.locator('.opt[data-correct="1"]').tap(); await pg.waitForTimeout(200);
  await pg.evaluate(() => { window.__kc.spoken.length = 0; window.__kc.hide(true); }); await pg.waitForTimeout(4500);
  s = await st(pg);
  ok(s.index === 0 && s.paused, "the round does not move on while the app is hidden (index " + s.index + ")");
  await pg.evaluate(() => window.__kc.hide(false));
  await wait(pg, () => window.__kc.state().index === 1, null, 9000);
  ok(await pg.evaluate(() => window.__kc.spoken.indexOf("What comes next?") >= 0), "the next question is spoken after coming back");
  await pg.evaluate(() => { window.__kc.spoken.length = 0; window.__kc.hide(true); }); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__kc.hide(false)); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => window.__kc.spoken.indexOf("What comes next?") >= 0), "an open question is said again after coming back");
  /* letters: abandoned rounds do not use up the deck */
  await pg.evaluate(() => { window.__kc.home(); window.__kc.start("letters"); });
  const first = await pg.evaluate(() => window.__kc.question().meta.L);
  await pg.evaluate(() => { window.__kc.home(); window.__kc.start("letters"); window.__kc.home(); });
  let sv = await pg.evaluate(() => window.__kc.save());
  ok(sv.deck.length === 26 && new Set(sv.deck).size === 26 && sv.deck.indexOf(first) >= 16, "two abandoned Letters rounds leave all 26 letters in the deck, the unplayed ones moved to the back");
  /* Android Back hook */
  ok(await pg.evaluate(() => window.KCBack()) === false, "KCBack on the map lets the app close");
  await pg.evaluate(() => window.__kc.start("count"));
  ok(await pg.evaluate(() => window.KCBack()) === true && (await st(pg)).screen === "home", "KCBack in an activity returns to the map");
  ok(pg.errors.length === 0, "console clean: " + pg.errors.join(" | "));
  await pg.context().close();

  /* say-again and the level: two misses on one question only must not lower the level */
  pg = await open(390, 844, "&fast=1", () => { try { localStorage.setItem("kcLearningTrail.v1", JSON.stringify({ v: 1, lv: { patterns: 2 } })); } catch (e) {} });
  await pg.evaluate(() => window.__kc.start("patterns"));
  await pg.evaluate(() => { window.__kc.wrong(); window.__kc.wrong(); }); await pg.locator("#sayBtn").tap(); await pg.locator("#sayBtn").tap();
  for (let i = 0; i < 5; i++) { await pg.evaluate(() => window.__kc.answer()); await wait(pg, i => { const t = window.__kc.state(); return t.reward || t.index > i; }, i); }
  ok((await pg.evaluate(() => window.__kc.save())).lv.patterns === 2, "one hard question plus say-again keeps the level");
  await pg.context().close();

  /* letters deck is used up only by finished rounds */
  pg = await open(390, 844, "&fast=1");
  await pg.evaluate(() => window.__kc.start("letters"));
  for (let i = 0; i < 5; i++) { await pg.evaluate(() => window.__kc.answer()); await wait(pg, i => { const t = window.__kc.state(); return t.reward || t.index > i; }, i); }
  ok((await pg.evaluate(() => window.__kc.save())).deck.length === 21, "a finished Letters round takes its five letters out of the deck");
  await pg.context().close();

  /* the Android shell's voice (window.KCNative) is used when the WebView has no speechSynthesis */
  pg = await open(390, 844, "&fast=1", () => {
    try { delete window.speechSynthesis; Object.defineProperty(window, "speechSynthesis", { get() { return undefined; }, configurable: true }); } catch (e) {}
    window.__native = { said: [], stops: 0, ready: false };
    window.KCNative = { canSpeak() { return window.__native.ready; }, speak(t, r, p) { window.__native.said.push([t, r, p]); }, stopSpeaking() { window.__native.stops++; } };
  });
  ok((await st(pg)).voice === false, "native voice not ready yet: reported as no voice");
  await pg.evaluate(() => { window.__native.ready = true; });
  await pg.locator('.stop[data-act="letters"]').tap(); await wait(pg, () => window.__kc.state().screen === "play");
  let nat = await pg.evaluate(() => window.__native);
  ok(nat.said.length >= 1 && /This is the letter/.test(nat.said[nat.said.length - 1][0]) && Math.abs(nat.said[0][1] - 0.85) < 0.01, "the instruction is spoken through KCNative once it is ready, at a slow rate");
  const before = nat.said.length;
  await pg.locator("#sayBtn").tap(); await pg.locator('.opt:not([data-correct="1"])').first().tap(); await pg.locator('.opt[data-correct="1"]').tap();
  nat = await pg.evaluate(() => window.__native);
  ok(nat.said.length === before + 3, "repeat, hint and praise all go through KCNative (" + (nat.said.length - before) + ")");
  await wait(pg, () => window.__kc.state().index === 1, null, 6000);
  ok(true, "the round moves on after native speech");
  const stops0 = nat.stops; await pg.evaluate(() => window.KCBack());
  ok((await pg.evaluate(() => window.__native.stops)) > stops0, "leaving the activity stops native speech");
  ok(pg.errors.length === 0, "console clean with KCNative: " + pg.errors.join(" | "));
  await pg.context().close();

  /* damaged saves never stop the game from starting */
  for (const raw of ['{"v":1,"set":null,"lv":"x","stickers":5,"deck":"abc"}', '{"v":1,"deck":["zz",1,null,"a","b","c"]}', '{"v":1,"set":"abc","rounds":[1,2],"demo":7,"last":{}}', "{{{", "null", '{"v":1,"lv":{"count":99,"letters":-4},"stickers":{"pine":"x","nope":3}}']) {
    pg = await open(390, 844, "&fast=1", "try { localStorage.setItem('kcLearningTrail.v1', " + JSON.stringify(raw) + "); } catch (e) {}");
    await pg.evaluate(() => window.__kc.start("letters"));
    sv = await pg.evaluate(() => window.__kc.save());
    ok((await st(pg)).screen === "play" && typeof sv.set.voice === "boolean" && sv.lv.count >= 1 && sv.lv.count <= 3 && pg.errors.length === 0, "damaged save is survived: " + raw.slice(0, 40) + " " + pg.errors.join(" | "));
    await pg.context().close();
  }

  /* real keyboard on the gate: holding Enter (with key repeat) opens it and does not answer it */
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  pg = await ctx.newPage(); await pg.goto(BASE + "/index.html?debug=1"); await pg.waitForFunction(() => window.__kc);
  await pg.focus("#gateBtn"); await pg.keyboard.down("Enter");
  for (let i = 0; i < 40; i++) { await pg.waitForTimeout(100); await pg.keyboard.down("Enter"); }
  ok((await st(pg)).gate, "holding Enter for 3 s opens the question");
  await pg.waitForTimeout(1500); ok((await st(pg)).gate && (await pg.locator("#gateOut").textContent()) === "", "the held key is not taken as an answer");
  await pg.keyboard.up("Enter");
  await pg.keyboard.press("Tab"); ok(await pg.evaluate(() => !!document.activeElement.closest("#gate")), "Tab stays inside the question");
  await pg.keyboard.type(String(await pg.evaluate(() => window.__kc.gateAnswer()))); await pg.keyboard.press("Enter");
  ok((await st(pg)).screen === "grown", "typing the answer and Enter opens the grown-ups corner");
  await pg.keyboard.press("Escape");
  /* mouse hold still works, and the mouse plays the game */
  const gb = await pg.locator("#gateBtn").boundingBox();
  await pg.mouse.move(gb.x + 20, gb.y + 20); await pg.mouse.down(); await pg.waitForTimeout(3400); await pg.mouse.up(); await pg.waitForTimeout(400);
  ok((await st(pg)).gate, "mouse hold opens the question and it stays open on release");
  await pg.locator("#gateCancel").click(); ok(!(await st(pg)).gate, "Cancel closes it");
  await pg.locator('.stop[data-act="count"]').click(); await wait(pg, () => window.__kc.state().screen === "play");
  await pg.locator('.opt[data-correct="1"]').click(); ok((await st(pg)).done === 1, "mouse click answers once");
  await ctx.close();
  await browser.close();
}

(async () => {
  const only = process.env.VIEWS ? process.env.VIEWS.split(",") : null;      /* e.g. VIEWS=tablet to run one size */
  for (const v of only || ["portrait", "landscape", "tablet", "small"]) if (VIEWS[v]) await run(v);
  if (!only) { await run("portrait", { reducedMotion: "reduce" }); await extras(); await review(); }
  else if (only.indexOf("review") >= 0) await review();
  console.log(checks + " checks, " + failures + " failures");
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
