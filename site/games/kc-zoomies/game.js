/* KC Zoomies: an original momentum platformer starring KC (KC Beyond Limits).
   Plain canvas + Web Audio, no dependencies, no network requests. */
(() => {
"use strict";
const DEBUG = /[?&]debug=1\b/.test(location.search);
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const tri = a => { a = a / TAU; a -= Math.floor(a); return Math.abs(a * 2 - 1); };
const REDUCED = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

/* KC's look, matched to studio/kc-dash: cream coat, tan ears, black harness, blue collar. */
const KCC = { coat: "#f1dcae", shade: "#dcc08a", belly: "#fcf5e6", ear: "#d9a866", tailTip: "#fbf1dc",
              nose: "#b57f78", eye: "#4a2e1c", harness: "#1f1f22", collar: "#3f7fd6" };
const BALL_O = "#f26a1b", BALL_B = "#2f6fd0";

/* ---------- tuning ---------- */
const DT = 1 / 120, G = 2000, JUMP = 660, JUMP_CUT = 250, RUN_MAX = 380, ZOOM_MAX = 640, HARD_MAX = 820;
const ACC = 1100, AIR_ACC = 760, SKID = 2300, FRIC = 950, SLOPE_G = 1500, COYOTE = 0.11, BUFFER = 0.13;
const BOUNCE = 940, ZOOM_TIME = 5, ZOOM_BALLS = 14;
const MUD = 1, PUDDLE = 2, SNOW = 3, CHUTE = 4;

/* ---------- save ---------- */
const SAVE_KEY = "kcZoomies.v1";
const save = { mute: false, lv: [null, null, null] };
(function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || typeof s !== "object") return;
    save.mute = !!s.mute;
    if (Array.isArray(s.lv)) for (let i = 0; i < 3; i++) {
      const r = s.lv[i];
      if (r && typeof r.best === "number") save.lv[i] = { best: r.best, stars: clamp(r.stars | 0, 1, 3), bones: clamp(r.bones | 0, 0, 3), balls: r.balls | 0 };
    }
  } catch (e) { /* private mode or bad data: start fresh */ }
})();
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ } }
const unlocked = i => i === 0 || !!save.lv[i - 1];

/* ---------- themes ---------- */
const TH = [
  { name: "Forest Trail", sub: "Learn to run, jump and zoom", sky: ["#4fb0ea", "#a6dcf3", "#e8f7dc"], sun: "#fff6c4", sunX: 0.76, sunY: 0.17, sunR: 30,
    far: "#8fb4c4", far2: "#6f9fae", snow: "#f6fbff", mid: "#3d7f59", mid2: "#2b6649", fore: "#123a2a",
    earth: "#7b5335", earth2: "#63412a", earth3: "#93683f", grass: "#47a544", grassHi: "#93dd60", under: "#573823",
    water: "#3d9ed0", water2: "#2a74ad", foam: "#dcf4ff", amb: "#f7ffb8" },
  { name: "River Canyon", sub: "Water gaps, logs and geese", sky: ["#2c97d4", "#86d2ea", "#dcf4e8"], sun: "#ffffff", sunX: 0.2, sunY: 0.14, sunR: 26,
    far: "#b3a3a8", far2: "#96889a", snow: "#e9f6ff", mid: "#42845f", mid2: "#2d674c", fore: "#143a30",
    earth: "#716774", earth2: "#5a515e", earth3: "#887d8b", grass: "#59a853", grassHi: "#a9e26e", under: "#4a424e",
    water: "#25aeb2", water2: "#15838e", foam: "#e3fffb", amb: "#ffffff" },
  { name: "Mountain Ridge", sub: "Fast slopes and big sunset jumps", sky: ["#2a2157", "#a3427c", "#ffac5a"], sun: "#ffe89a", sunX: 0.7, sunY: 0.5, sunR: 44,
    far: "#8a5791", far2: "#5d3d7c", snow: "#ffd6cc", mid: "#2d2349", mid2: "#231b3c", fore: "#150f29",
    earth: "#514c6b", earth2: "#3e3955", earth3: "#666082", grass: "#8e9159", grassHi: "#f3d98b", under: "#2f2a44",
    water: "#6272c8", water2: "#3e4b96", foam: "#ffdbe8", amb: "#ffffff" }
];

/* ---------- level builder: a height profile sampled every SS px, plus things placed on it ---------- */
const SS = 8;
let lvl = null;
function gy(x) {
  let f = x / SS; const m = lvl.n - 1.001;
  if (f < 0) f = 0; else if (f > m) f = m;
  const i = f | 0, ys = lvl.ys;
  return ys[i] + (ys[i + 1] - ys[i]) * (f - i);
}
function slopeAt(x) { return (gy(x + 6) - gy(x - 6)) / 12; }
function gapAt(x) { const gs = lvl.gaps; for (let i = 0; i < gs.length; i++) { const g = gs[i]; if (x > g.x0 && x < g.x1) return g; if (g.x0 > x) break; } return null; }
function zoneAt(x) { const zs = lvl.zones; for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (x >= z.x0 && x <= z.x1) return z.t; } return 0; }

function makeBuilder(theme) {
  const hs = [0]; let cx = 0, ch = 0;
  const L = { ti: theme, gaps: [], balls: [], bones: [], plats: [], zones: [], brambles: [], cones: [], geese: [], shrooms: [], springs: [], signs: [], hints: [], goalX: 0, decoB: [], decoF: [] };
  const seg = (len, f) => { const n = Math.max(1, Math.round(len / SS)), h0 = ch, x0 = cx; for (let i = 1; i <= n; i++) hs.push(h0 + f(i / n)); cx += n * SS; ch = h0 + f(1); return x0; };
  const b = {
    flat: len => seg(len, () => 0),
    slope: (len, dh) => seg(len, t => dh * (0.5 - 0.5 * Math.cos(Math.PI * t))),
    hill: (len, h) => seg(len, t => h * Math.pow(Math.sin(Math.PI * t), 2)),
    kick: (len, h) => seg(len, t => h * t * t),
    drop: dh => { ch -= dh; },
    gap: (len, dh) => { const x0 = seg(len, t => (dh || 0) * t); L.gaps.push({ x0, x1: cx, wy: 0 }); return x0; },
    ball: (x, up) => L.balls.push({ x, y: 0, up, got: false }),
    balls: (x, n, sp, up) => { for (let i = 0; i < n; i++) b.ball(x + i * (sp || 46), up || 34); },
    arc: (x0, x1, peak, n, up) => { for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; b.ball(lerp(x0, x1, t), (up || 34) + peak * Math.sin(Math.PI * t)); } },
    bone: (x, up) => L.bones.push({ x, y: 0, up, got: false }),
    plat: (x, up, w, mx, my, per, ph) => L.plats.push({ x0: x, y0: 0, up, w, mx: mx || 0, my: my || 0, om: TAU / (per || 4), ph: ph || 0, cx: x, cy: 0, pcx: x, pcy: 0, rx: x, ry: 0 }),
    zone: (t, x, w) => L.zones.push({ t, x0: x, x1: x + w }),
    bramble: (x, w) => L.brambles.push({ x0: x, x1: x + w, y: 0, burst: false }),
    cone: (x0, x1, sp) => L.cones.push({ x0, x1, x: x1, v: -sp, sp, y: 0, px: x1, py: 0, rot: 0, off: 0, fx: 0, fy: 0, fvy: 0 }),
    goose: x => L.geese.push({ x0: x, x, px: x, y: 0, face: -1, cd: 0, off: 0, fx: 0, fy: 0, alert: 0, w: 0 }),
    shroom: x => L.shrooms.push({ x, y: 0, sq: 0 }),
    spring: x => L.springs.push({ x, y: 0, t: 0 }),
    sign: x => L.signs.push({ x, y: 0, on: false, t: 0 }),
    hint: (x, w, i) => L.hints.push({ x0: x, x1: x + w, i }),
    goal: x => { L.goalX = x; },
    done: () => {
      L.n = hs.length; L.len = cx; L.ys = new Float32Array(L.n);
      for (let i = 0; i < L.n; i++) L.ys[i] = -hs[i];
      lvl = L;
      for (const g of L.gaps) g.wy = Math.max(gy(g.x0), gy(g.x1)) + 62;
      for (const o of L.balls) o.y = gy(o.x) - o.up;
      for (const o of L.bones) o.y = gy(o.x) - o.up;
      for (const p of L.plats) { p.y0 = gy(p.x0 + p.w / 2) - p.up; p.cy = p.pcy = p.ry = p.y0; }
      for (const o of L.brambles) o.y = gy((o.x0 + o.x1) / 2);
      for (const k of ["shrooms", "springs", "signs", "geese", "cones"]) for (const o of L[k]) o.y = gy(o.x);
      L.balls.sort((p, q) => p.x - q.x); L.zones.sort((p, q) => p.x0 - q.x0);
      L.goalY = gy(L.goalX); L.total = L.balls.length;
      decorate(L);
      return L;
    }
  };
  return b;
}
function decorate(L) {
  const busy = x => {
    if (x < 60 || Math.abs(x - L.goalX) < 190 || x > L.len - 40) return true;
    for (const g of L.gaps) if (x > g.x0 - 34 && x < g.x1 + 34) return true;
    for (const s of L.signs) if (Math.abs(s.x - x) < 70) return true;
    return false;
  };
  let k = 0;
  for (let x = 140; x < L.len; x += 150 + hash(k * 3.1 + L.ti) * 190, k++) {
    if (busy(x) || Math.abs(slopeAt(x)) > 0.5) continue;
    L.decoB.push({ x, y: gy(x) + 10, v: (hash(k * 7.7) * 3) | 0, s: 0.75 + hash(k * 1.3) * 0.5 });
  }
  k = 0;
  for (let x = 60; x < L.len; x += 46 + hash(k * 5.3 + 9 + L.ti) * 90, k++) {
    if (busy(x) || zoneAt(x)) continue;
    let bad = false;
    for (const o of L.brambles) if (x > o.x0 - 30 && x < o.x1 + 30) bad = true;
    for (const o of L.shrooms) if (Math.abs(o.x - x) < 50) bad = true;
    for (const o of L.springs) if (Math.abs(o.x - x) < 60) bad = true;
    if (bad) continue;
    L.decoF.push({ x, y: gy(x) + 4, v: (hash(k * 2.9 + 4) * 4) | 0, s: 0.7 + hash(k * 8.1) * 0.5 });
  }
}

/* ---------- the three trails ---------- */
function level1() {
  const b = makeBuilder(0); let a;
  a = b.flat(900); b.hint(a + 60, 660, 0); b.balls(a + 430, 6);
  a = b.hill(800, 84); b.balls(a + 130, 12, 48); b.hint(a + 340, 520, 1);
  a = b.flat(620); b.hint(a + 110, 560, 2); b.balls(a + 130, 4);
  a = b.gap(96); b.arc(a - 46, a + 142, 62, 4);
  a = b.flat(420); b.balls(a + 150, 3);
  a = b.slope(900, -200); b.hint(a - 80, 800, 3); b.balls(a + 120, 12, 60);
  b.flat(160);
  a = b.slope(460, 110); b.balls(a + 60, 6, 60);
  a = b.flat(800); b.sign(a + 200); b.hint(a + 70, 360, 4); b.zone(MUD, a + 540, 190); b.hint(a + 440, 360, 5);
  a = b.flat(720); b.bramble(a + 340, 60); b.hint(a + 60, 440, 6); b.arc(a + 290, a + 450, 66, 4);
  a = b.flat(800); b.shroom(a + 330); b.hint(a + 40, 440, 7); b.plat(a + 420, 178, 160); b.bone(a + 500, 232); b.balls(a + 440, 3, 60, 214);
  a = b.slope(760, -210); b.hint(a - 180, 640, 8); b.balls(a + 80, 10, 64);
  a = b.flat(320); b.balls(a + 20, 6, 50);
  a = b.slope(700, 190);
  a = b.flat(900); b.cone(a + 300, a + 800, 90); b.hint(a + 40, 560, 9); b.balls(a + 330, 5, 90);
  a = b.flat(580); b.sign(a + 110); b.spring(a + 500); b.hint(a + 170, 380, 10);
  a = b.gap(210); b.arc(a - 30, a + 270, 130, 6);
  a = b.flat(700); b.balls(a + 110, 4); b.hint(a + 90, 460, 12);
  b.plat(a + 300, 84, 124); b.plat(a + 480, 166, 124); b.bone(a + 542, 218); b.ball(a + 362, 122);
  b.flat(240);
  a = b.slope(1000, -240); b.zone(CHUTE, a + 60, 900); b.hint(a - 220, 520, 11); b.balls(a + 100, 12, 72);
  b.kick(230, 70); b.drop(110);
  a = b.gap(170); b.arc(a - 70, a + 330, 120, 7);
  a = b.flat(1000); b.balls(a + 430, 4); b.shroom(a + 700); b.plat(a + 470, 186, 140); b.bone(a + 540, 240);
  a = b.hill(700, 60); b.balls(a + 100, 10, 52);
  a = b.flat(900); b.goal(a + 520);
  return b.done();
}
function level2() {
  const b = makeBuilder(1); let a;
  a = b.flat(640); b.balls(a + 300, 5);
  a = b.slope(420, -90); b.balls(a + 60, 6, 60);
  b.flat(200); a = b.gap(130); b.arc(a - 40, a + 170, 66, 4);
  b.flat(300); a = b.gap(150); b.arc(a - 40, a + 190, 72, 4);
  a = b.flat(920); b.goose(a + 580); b.hint(a + 120, 520, 13); b.balls(a + 120, 5);
  a = b.gap(470); b.plat(a + 80, 6, 130); b.plat(a + 280, 6, 130); b.arc(a + 60, a + 430, 50, 7, 50);
  b.plat(a + 300, 96, 96); b.bone(a + 348, 150);
  a = b.flat(420); b.balls(a + 100, 5);
  a = b.hill(700, 100); b.zone(PUDDLE, a + 530, 150); b.balls(a + 90, 8, 54);
  a = b.flat(660); b.sign(a + 150); b.hint(a + 210, 420, 14);
  a = b.gap(540); b.plat(a + 195, 4, 150, 140, 0, 5.4); b.ball(a + 110, 60); b.ball(a + 270, 60); b.ball(a + 430, 60);
  a = b.flat(560); b.bramble(a + 270, 60); b.arc(a + 220, a + 380, 66, 4);
  a = b.slope(900, -230); b.zone(CHUTE, a + 80, 780); b.balls(a + 100, 10, 76);
  b.kick(220, 66); b.drop(100);
  a = b.gap(210); b.arc(a - 60, a + 360, 120, 7);
  a = b.flat(1000); b.goose(a + 760); b.balls(a + 420, 4);
  a = b.slope(520, 120); b.cone(a + 40, a + 480, 110);
  a = b.flat(640); b.sign(a + 140); b.balls(a + 300, 5);
  a = b.gap(620); b.plat(a + 70, 0, 120, 0, 44, 3.6, 0); b.plat(a + 250, 0, 120, 0, 44, 3.6, 2.1); b.plat(a + 430, 0, 120, 0, 44, 3.6, 4.2);
  b.bone(a + 310, 176); b.ball(a + 130, 70); b.ball(a + 490, 70);
  a = b.flat(360); b.balls(a + 80, 4);
  a = b.slope(600, -150); b.balls(a + 80, 7, 70);
  a = b.flat(520); b.goose(a + 300); b.zone(PUDDLE, a + 40, 120);
  a = b.slope(600, 150); b.cone(a + 60, a + 560, 120);
  a = b.flat(420); b.sign(a + 130);
  a = b.gap(170); b.arc(a - 30, a + 200, 70, 4);
  a = b.flat(150); b.shroom(a + 78);
  a = b.gap(220); b.arc(a - 50, a + 250, 170, 5); b.bone(a + 96, 262);
  a = b.flat(720); b.goose(a + 300); b.balls(a + 100, 4);
  a = b.gap(560); b.plat(a + 150, 4, 140, 90, 0, 4.4, 0); b.plat(a + 400, 4, 140, 0, 40, 3.2, 1); b.ball(a + 220, 64); b.ball(a + 470, 80);
  a = b.flat(300);
  a = b.hill(640, 80); b.balls(a + 90, 9, 52);
  a = b.flat(380); b.spring(a + 310);
  a = b.gap(220); b.arc(a - 30, a + 280, 130, 6);
  a = b.flat(1000); b.balls(a + 140, 4); b.goal(a + 620);
  return b.done();
}
function level3() {
  const b = makeBuilder(2); let a;
  a = b.flat(600); b.balls(a + 300, 5);
  a = b.slope(1300, -360); b.zone(SNOW, a + 480, 520); b.balls(a + 120, 14, 84); b.hint(a + 300, 600, 15);
  b.kick(240, 76); b.drop(120);
  a = b.gap(260); b.arc(a - 80, a + 420, 130, 8); b.plat(a + 40, 8, 120);
  a = b.slope(600, -100); b.balls(a + 260, 5, 60);
  a = b.slope(700, 210);
  a = b.flat(700); b.bramble(a + 250, 64); b.arc(a + 200, a + 364, 66, 4); b.sign(a + 520);
  a = b.hill(700, 130); b.balls(a + 300, 5, 40, 60);
  a = b.hill(600, 110); b.zone(SNOW, a + 300, 300); b.balls(a + 260, 5, 40, 70);
  a = b.hill(500, 90); b.balls(a + 220, 4, 40, 70);
  a = b.flat(700); b.goose(a + 360); b.balls(a + 80, 4);
  a = b.gap(580); b.plat(a + 70, 0, 120, 0, 50, 3.4, 0); b.plat(a + 250, 50, 110); b.plat(a + 400, 0, 120, 0, 50, 3.4, 2.4);
  b.plat(a + 240, 150, 100, 60, 0, 4.2); b.bone(a + 290, 204); b.ball(a + 130, 70); b.ball(a + 305, 80); b.ball(a + 460, 70);
  a = b.flat(520); b.sign(a + 150); b.balls(a + 260, 4);
  a = b.slope(1400, -380); b.zone(CHUTE, a + 80, 1260); b.balls(a + 120, 14, 90);
  b.kick(240, 80); b.drop(140);
  a = b.gap(340); b.arc(a - 80, a + 500, 140, 9); b.plat(a + 44, 8, 170);
  a = b.flat(1000); b.zone(SNOW, a + 240, 420); b.balls(a + 700, 5);
  a = b.slope(640, 200); b.cone(a + 60, a + 600, 130);
  a = b.flat(760); b.cone(a + 400, a + 590, 100); b.bramble(a + 200, 64); b.sign(a + 60); b.shroom(a + 330); b.plat(a + 400, 190, 130); b.bone(a + 466, 244);
  a = b.gap(200); b.arc(a - 30, a + 230, 80, 4);
  a = b.flat(480); b.goose(a + 200);
  a = b.gap(480); b.plat(a + 150, 6, 130, 80, 0, 3.8); b.plat(a + 330, 60, 100, 0, 40, 3, 1.2); b.ball(a + 215, 70); b.ball(a + 380, 130);
  a = b.flat(460); b.spring(a + 380); b.balls(a + 80, 4);
  a = b.gap(250); b.arc(a - 30, a + 310, 110, 7); b.bone(a + 100, 186);
  a = b.flat(500); b.sign(a + 200);
  a = b.hill(800, 150); b.zone(SNOW, a + 420, 340); b.balls(a + 120, 8, 44);
  a = b.flat(520); b.goose(a + 330); b.bramble(a + 80, 60);
  a = b.slope(1100, -300); b.balls(a + 100, 12, 84);
  b.kick(200, 56); b.drop(90);
  a = b.gap(200); b.arc(a - 60, a + 340, 110, 6);
  a = b.flat(1300); b.balls(a + 520, 5); b.goal(a + 900);
  return b.done();
}
const LEVELS = [level1, level2, level3];
const HINTS = [
  ["Hold the arrow buttons to run", "Arrow keys or A / D to run"],
  ["Running downhill builds speed!"],
  ["Tap JUMP to hop. Hold it to jump higher!", "Space to jump. Hold it to jump higher!"],
  ["Keep your speed and it carries you up the next hill"],
  ["Trail signs save your spot"],
  ["Mud is slow going. Hop over it!"],
  ["Blackberry brambles are prickly. Jump over!"],
  ["Mushrooms are bouncy! Hold JUMP to bounce higher", "Mushrooms are bouncy! Hold jump to bounce higher"],
  ["Fetch balls to fill the ZOOMIES meter"],
  ["Rolling pine cones! Hop over them"],
  ["Log ramps fling you across"],
  ["Slides make you super fast. Wheee!"],
  ["Golden bones hide off the trail. Can you find all 3?"],
  ["A grumpy goose! Hop over it"],
  ["Wait for the swinging log, then hop on"],
  ["Snow is slippery. Enjoy the slide!"]
];

/* ---------- canvas + view ---------- */
const cv = $("c"), ctx = cv.getContext("2d", { alpha: false });
if (!ctx.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { this.rect(x, y, w, h); };
let W = 0, H = 0, DPR = 1, SC = 1, VW = 560, VH = 400, ANCH = 0.66, LOOKK = 0.15, layersDirty = true, skyDirty = true;
/* Backing-store size is the main frame cost, so it is capped by a pixel budget rather than a flat ratio,
   and qCap steps down (see quality()) on devices that cannot hold 60 fps at the sharper setting. */
const PIX_BUDGET = 1.5e6;
let qCap = 2;
function resize() {
  const w = Math.max(200, window.innerWidth), h = Math.max(200, window.innerHeight), tall = h > w;
  const d = Math.min(window.devicePixelRatio || 1, qCap, Math.max(1, Math.sqrt(PIX_BUDGET / (w * h))));
  /* portrait shows a wider slice of trail (680 world px, not 560) so fast sections give fair warning */
  let s = Math.min(w / (tall ? 680 : 560), h / 400);
  if (s > 1.25) s = Math.max(1.25, Math.min(w / 800, h / 460));
  /* with touch controls up, lift the ground line so the river and landing logs stay above the buttons */
  let a = tall ? 0.7 : 0.68;
  if (touchUI) a = Math.min(tall ? 0.64 : a, Math.max(0.54, (h - 124 - 62 * s) / h));
  if (w === W && h === H && d === DPR && a === ANCH) return;        /* address-bar and no-op resize events */
  const res0 = SC * DPR, oVH = VH;
  W = w; H = h; DPR = d; SC = s; VW = W / s; VH = H / s; ANCH = a; LOOKK = tall ? 0.23 : 0.15;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  if (SC * DPR !== res0) layersDirty = true;
  skyDirty = true;
  if (!lvl) return;
  if (mode === "play" || mode === "pause") {                         /* keep KC where she is on screen: no camera jolt */
    cam.x = cam.px = clamp(P.x + cam.look - VW * 0.5, 0, Math.max(0, lvl.len - VW));
    cam.y = cam.py = P.y - (P.y - cam.y) * VH / oVH;
  } else snapCam();
  placeHint(); cardMore();
}

/* ---------- sprites and parallax layers (all drawn in code, cached to offscreen canvases) ---------- */
function mk(w, h, res, draw) {
  const c = document.createElement("canvas"); c.width = Math.ceil(w * res); c.height = Math.ceil(h * res);
  const g = c.getContext("2d"); g.scale(res, res); draw(g, w, h); c.lw = w; c.lh = h; return c;
}
/* like mk, but a whole number of device pixels wide so the layer tiles seamlessly when blitted 1:1 */
function mkTile(w, h, res, draw) {
  const c = document.createElement("canvas"); c.width = Math.max(8, Math.round(w * res)); c.height = Math.ceil(h * res);
  const g = c.getContext("2d"); g.scale(c.width / w, res); draw(g, w, h); c.lw = w; c.lh = h; return c;
}
function fir(g, w, h, c1, c2, trunk, snow) {
  const cx = w / 2; g.fillStyle = trunk; g.fillRect(cx - w * 0.045, h * 0.5, w * 0.09, h * 0.5);
  const n = 7;
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1), y0 = lerp(0, h * 0.6, t), y1 = y0 + h * 0.27, hw = lerp(w * 0.14, w * 0.5, t);
    g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(cx, y0);
    g.quadraticCurveTo(cx + hw * 0.35, y0 + (y1 - y0) * 0.75, cx + hw, y1); g.quadraticCurveTo(cx, y1 - h * 0.05, cx - hw, y1);
    g.quadraticCurveTo(cx - hw * 0.35, y0 + (y1 - y0) * 0.75, cx, y0); g.fill();
    if (snow) { g.fillStyle = snow; g.beginPath(); g.moveTo(cx, y0); g.quadraticCurveTo(cx + hw * 0.3, y0 + (y1 - y0) * 0.5, cx + hw * 0.55, y0 + (y1 - y0) * 0.72);
      g.quadraticCurveTo(cx, y0 + (y1 - y0) * 0.5, cx - hw * 0.55, y0 + (y1 - y0) * 0.72); g.quadraticCurveTo(cx - hw * 0.3, y0 + (y1 - y0) * 0.5, cx, y0); g.fill(); }
  }
}
function leafy(g, w, h, c1, c2, trunk) {
  const cx = w / 2; g.strokeStyle = trunk; g.lineWidth = w * 0.07; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, h * 0.45); g.moveTo(cx, h * 0.62); g.lineTo(cx - w * 0.2, h * 0.42); g.moveTo(cx, h * 0.56); g.lineTo(cx + w * 0.22, h * 0.36); g.stroke();
  for (let i = 0; i < 16; i++) {
    const a = hash(i * 3.3) * TAU, r = hash(i * 9.1) * w * 0.3;
    g.fillStyle = i % 3 ? c1 : c2; g.beginPath(); g.arc(cx + Math.cos(a) * r, h * 0.32 + Math.sin(a) * r * 0.75, w * (0.13 + hash(i) * 0.08), 0, TAU); g.fill();
  }
}
function fern(g, w, h, c1, c2) {
  g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = lerp(-1.25, 1.25, i / 6), len = h * (0.7 + hash(i * 4.4) * 0.3), ex = w / 2 + Math.sin(a) * len * 0.8, ey = h - Math.cos(a) * len * 0.8 + Math.abs(a) * h * 0.2;
    g.strokeStyle = i % 2 ? c1 : c2; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + Math.sin(a) * len * 0.5, h - len * 0.8, ex, ey); g.stroke();
  }
}
function rock(g, w, h, c1, c2) {
  g.fillStyle = c1; g.beginPath(); g.moveTo(2, h); g.lineTo(w * 0.12, h * 0.4); g.lineTo(w * 0.42, h * 0.08); g.lineTo(w * 0.8, h * 0.3); g.lineTo(w - 2, h); g.fill();
  g.fillStyle = c2; g.beginPath(); g.moveTo(w * 0.42, h * 0.08); g.lineTo(w * 0.8, h * 0.3); g.lineTo(w * 0.56, h * 0.5); g.lineTo(w * 0.3, h * 0.38); g.fill();
}
function flowers(g, w, h, stem, c1, c2, spike) {
  g.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const x = w * (0.14 + i * 0.18), top = h * (0.12 + hash(i * 6.6) * 0.4);
    g.strokeStyle = stem; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, h); g.lineTo(x + (hash(i) - 0.5) * 6, top + 4); g.stroke();
    g.fillStyle = i % 2 ? c1 : c2;
    if (spike) for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (hash(i) - 0.5) * 6 * (1 - k / 5), top + k * 5, 4.4 - k * 0.5, 0, TAU); g.fill(); }
    else { for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + (hash(i) - 0.5) * 6, top + 3, 3, 6.5, k * TAU / 3, 0, TAU); g.fill(); } g.fillStyle = "#ffd94a"; g.beginPath(); g.arc(x + (hash(i) - 0.5) * 6, top + 3, 2, 0, TAU); g.fill(); }
  }
}
function tuft(g, w, h, c1, c2) {
  g.lineCap = "round"; g.lineWidth = 3.4;
  for (let i = 0; i < 8; i++) { g.strokeStyle = i % 2 ? c1 : c2; const x = w * (0.1 + i * 0.115); g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x, h * 0.5, x + (i - 3.5) * 2.5, h * (0.1 + hash(i * 2.2) * 0.4)); g.stroke(); }
}
const SPR = [];
function buildSprites() {
  const R = 2;
  SPR[0] = { back: [mk(150, 330, R, (g, w, h) => fir(g, w, h, "#2f7350", "#27644a", "#6b4a31")), mk(120, 260, R, (g, w, h) => fir(g, w, h, "#3a8257", "#2f7350", "#6b4a31")), mk(170, 220, R, (g, w, h) => leafy(g, w, h, "#5aa850", "#77c05a", "#7a5a3c"))],
    front: [mk(70, 44, R, (g, w, h) => fern(g, w, h, "#3f9a45", "#5dbb52")), mk(60, 30, R, (g, w, h) => flowers(g, w, h, "#3f9a45", "#ffffff", "#ffe9f3")), mk(46, 22, R, (g, w, h) => tuft(g, w, h, "#5dbb52", "#3f9a45")), mk(50, 26, R, (g, w, h) => rock(g, w, h, "#8d8a84", "#b1aea6"))] };
  SPR[1] = { back: [mk(170, 230, R, (g, w, h) => leafy(g, w, h, "#4f9d55", "#74bd5c", "#6f5a48")), mk(130, 300, R, (g, w, h) => fir(g, w, h, "#2f7658", "#27674e", "#5f4a3a")), mk(150, 190, R, (g, w, h) => leafy(g, w, h, "#69b356", "#8fd066", "#6f5a48"))],
    front: [mk(70, 44, R, (g, w, h) => fern(g, w, h, "#3f9a45", "#62bf55")), mk(60, 30, R, (g, w, h) => rock(g, w, h, "#8b8090", "#aca2b0")), mk(46, 22, R, (g, w, h) => tuft(g, w, h, "#6bc45a", "#459f4a")), mk(60, 30, R, (g, w, h) => flowers(g, w, h, "#3f9a45", "#ffd94a", "#fff2a8"))] };
  SPR[2] = { back: [mk(96, 300, R, (g, w, h) => fir(g, w, h, "#3b3f5c", "#32354f", "#2a2238", "#f3ecff")), mk(80, 220, R, (g, w, h) => fir(g, w, h, "#434868", "#3b3f5c", "#2a2238", "#f3ecff")), mk(120, 70, R, (g, w, h) => rock(g, w, h, "#5d5878", "#8a7fa6"))],
    front: [mk(60, 34, R, (g, w, h) => flowers(g, w, h, "#70784a", "#9a7df0", "#c9a4ff", true)), mk(60, 30, R, (g, w, h) => rock(g, w, h, "#6a6486", "#9a8fb8")), mk(46, 22, R, (g, w, h) => tuft(g, w, h, "#c9b66a", "#8e9159")), mk(60, 34, R, (g, w, h) => flowers(g, w, h, "#70784a", "#ff7a4a", "#ffb04a", true))] };
  SPR.bone = mk(64, 64, R, (g) => {
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, "rgba(255,236,150,.85)"); gr.addColorStop(1, "rgba(255,236,150,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.translate(32, 32); g.rotate(-0.5);
    g.fillStyle = "#c58a12"; bonePath(g, 1.5); g.fillStyle = "#ffd23c"; bonePath(g, 0); g.fillStyle = "#fff3b0"; g.beginPath(); g.roundRect(-11, -4, 20, 3, 1.5); g.fill();
  });
  SPR.cloud = mk(220, 80, 1, (g) => { g.fillStyle = "rgba(255,255,255,.9)"; for (const [x, y, r] of [[50, 52, 26], [88, 40, 34], [130, 44, 30], [168, 54, 22], [110, 58, 24]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } });
}
function bonePath(g, o) {
  g.beginPath(); g.roundRect(-14 - o, -5 - o, 28 + o * 2, 10 + o * 2, 4); g.fill();
  for (const sx of [-15, 15]) for (const sy of [-5.5, 5.5]) { g.beginPath(); g.arc(sx, sy, 6.5 + o, 0, TAU); g.fill(); }
}
const TW = 1040;
let LAY = null, earthPat = null, patN = 128, skyC = null;
function ridgePath(g, h, base, amp, sd, k1, k2, k3) {
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= TW; x += 4) { const u = x / TW * TAU; g.lineTo(x, h - (base + amp * (0.55 * tri(u * k1 + sd) + 0.3 * tri(u * k2 + sd * 2.3) + 0.15 * tri(u * k3 + sd * 4.1)))); }
  g.lineTo(TW, h); g.closePath();
}
function treeLine(g, h, baseF, col, step, hMin, hMax, sd) {
  const n = Math.round(TW / step);
  g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= TW; x += 8) g.lineTo(x, h - baseF(x));
  g.lineTo(TW, h); g.fill();
  for (let i = -1; i <= n; i++) {
    const j = ((i % n) + n) % n, x = i * step + hash(j + sd) * step * 0.5, th = lerp(hMin, hMax, hash(j * 3.7 + sd)), y = h - baseF(((x % TW) + TW) % TW) + 4, w = th * 0.2;
    g.beginPath(); g.moveTo(x, y - th); g.lineTo(x + w, y - th * 0.55); g.lineTo(x + w * 0.6, y - th * 0.55); g.lineTo(x + w * 1.5, y - th * 0.18); g.lineTo(x + w * 0.9, y - th * 0.18); g.lineTo(x + w * 1.9, y);
    g.lineTo(x - w * 1.9, y); g.lineTo(x - w * 0.9, y - th * 0.18); g.lineTo(x - w * 1.5, y - th * 0.18); g.lineTo(x - w * 0.6, y - th * 0.55); g.lineTo(x - w, y - th * 0.55); g.fill();
  }
}
function drawEarth(g, w, h, th) {
    g.fillStyle = th.earth; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 ? th.earth2 : th.earth3; g.globalAlpha = 0.55; g.beginPath(); const x = hash(i * 1.7) * w, y = hash(i * 5.3) * h, r = 3 + hash(i * 9.9) * 7;
      g.ellipse(x, y, r * 1.5, r, 0, 0, TAU); g.fill(); if (x < 16) { g.beginPath(); g.ellipse(x + w, y, r * 1.5, r, 0, 0, TAU); g.fill(); } if (y < 12) { g.beginPath(); g.ellipse(x, y + h, r * 1.5, r, 0, 0, TAU); g.fill(); } }
    g.globalAlpha = 0.22; g.fillStyle = th.earth2; g.fillRect(0, 40, w, 5); g.fillRect(0, 100, w, 4); g.globalAlpha = 1;
}
function buildLayers() {
  const th = TH[lvl.ti], res = SC * DPR, ti = lvl.ti;
  const far = mkTile(TW, 360, res, (g, w, h) => {
    if (ti === 1) {                                           /* basalt canyon walls with a waterfall */
      g.fillStyle = th.far; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= TW; x += 26) { const t = 250 + 44 * hash(Math.floor(x / 104) % 10 + 3) + 10 * hash(x % TW); g.lineTo(x, h - t); g.lineTo(x + 26, h - t); }
      g.lineTo(TW, h); g.fill();
      g.save(); g.clip(); g.strokeStyle = "rgba(60,40,70,.16)"; g.lineWidth = 3;
      for (let x = 13; x < TW; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = "rgba(255,240,220,.13)"; for (let y = 90; y < h; y += 74) g.fillRect(0, y, TW, 16);
      const wf = g.createLinearGradient(0, 0, 0, h); wf.addColorStop(0, "rgba(255,255,255,.95)"); wf.addColorStop(1, "rgba(200,240,255,.7)");
      g.fillStyle = wf; g.fillRect(430, 0, 30, h); g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(436, 0, 5, h); g.fillRect(450, 0, 3, h);
      g.restore();
      g.fillStyle = th.far2; ridgePath(g, h, 60, 70, 2.2, 2, 5, 9); g.fill();
    } else {
      g.fillStyle = th.far; ridgePath(g, h, 120, 150, 1.3, 2, 5, 11); g.fill();
      g.save(); g.clip(); g.fillStyle = th.snow; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h - 228);
      for (let x = 0; x <= TW; x += 20) g.lineTo(x, h - 228 + (x / 20 % 2 ? 16 : -6));
      g.lineTo(TW, 0); g.fill(); g.restore();
      if (ti === 0) {                                         /* one big snowy volcano */
        const px = 640; g.fillStyle = "#9cbccb"; g.beginPath(); g.moveTo(px - 260, h); g.quadraticCurveTo(px - 90, h - 190, px - 16, h - 330); g.lineTo(px + 20, h - 326); g.quadraticCurveTo(px + 100, h - 180, px + 280, h); g.fill();
        g.save(); g.clip(); g.fillStyle = th.snow; g.beginPath(); g.moveTo(px - 200, 0); g.lineTo(px - 120, h - 240); g.lineTo(px - 80, h - 270); g.lineTo(px - 50, h - 226); g.lineTo(px - 14, h - 280); g.lineTo(px + 24, h - 232); g.lineTo(px + 60, h - 276); g.lineTo(px + 96, h - 236); g.lineTo(px + 200, 0); g.fill(); g.restore();
      }
      g.fillStyle = th.far2; ridgePath(g, h, 50, 110, 4.4, 3, 7, 13); g.fill();
    }
    /* valley haze over the foot of the mountains, baked in (the sky layer carries the same band) */
    g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.28; g.fillStyle = th.sky[2]; g.fillRect(0, 220, TW, h - 220);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  });
  const mid = mkTile(TW, 250, res, (g, w, h) => {
    const u = x => x / TW * TAU;
    treeLine(g, h, x => 110 + 26 * Math.sin(u(x) * 2 + 1) + 10 * Math.sin(u(x) * 5), th.mid, ti === 2 ? 52 : 26, ti === 2 ? 50 : 60, ti === 2 ? 110 : 120, 1);
    treeLine(g, h, x => 56 + 22 * Math.sin(u(x) * 3 + 4) + 8 * Math.sin(u(x) * 7), th.mid2, ti === 2 ? 65 : 40, 70, 150, 40);
  });
  const fore = mkTile(TW, 70, res, (g, w, h) => {
    g.strokeStyle = th.fore; g.fillStyle = th.fore; g.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const x = i * 40 + hash(i * 2.2) * 20;
      if (ti === 2) { g.beginPath(); g.moveTo(x - 30, h); g.lineTo(x - 8, h - 22 - hash(i) * 26); g.lineTo(x + 12, h - 16); g.lineTo(x + 30, h); g.fill(); }
      else for (let k = 0; k < 6; k++) { const a = lerp(-1.2, 1.2, k / 5), len = 34 + hash(i * 6 + k) * 30; g.lineWidth = 5; g.beginPath(); g.moveTo(x, h + 4); g.quadraticCurveTo(x + Math.sin(a) * len * 0.5, h - len, x + Math.sin(a) * len, h - len * 0.55); g.stroke(); }
    }
    g.fillRect(0, h - 6, w, 6);
  });
  /* earth texture at exactly device resolution: the terrain fill becomes an unscaled, pixel-aligned blit */
  patN = Math.max(32, Math.round(128 * res));
  const tile = document.createElement("canvas");
  tile.width = tile.height = patN;
  { const g = tile.getContext("2d"); g.setTransform(patN / 128, 0, 0, patN / 128, 0, 0); drawEarth(g, 128, 128, th); }
  earthPat = ctx.createPattern(tile, "repeat");
  LAY = { far, mid, fore, ti };
  layersDirty = false; skyDirty = true;
}
/* sky gradient, sun and valley haze in one opaque screen-sized layer: one blit per frame instead of three fills */
function buildSky() {
  const th = TH[lvl.ti], u = SC * DPR, hz = VH * ANCH;
  if (!skyC) skyC = document.createElement("canvas");
  skyC.width = cv.width; skyC.height = cv.height;
  const g = skyC.getContext("2d", { alpha: false }); g.setTransform(u, 0, 0, u, 0, 0);
  const gr = g.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.5, th.sky[1]); gr.addColorStop(0.82, th.sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, VW + 1, VH + 1);
  g.fillStyle = th.sun; g.globalAlpha = 0.28; g.beginPath(); g.arc(VW * th.sunX, hz * th.sunY * 1.5, th.sunR * 1.9, 0, TAU); g.fill();
  g.globalAlpha = 1; g.beginPath(); g.arc(VW * th.sunX, hz * th.sunY * 1.5, th.sunR, 0, TAU); g.fill();
  g.fillStyle = th.sky[2]; g.globalAlpha = 0.28; g.fillRect(0, hz - 80, VW + 1, 200); g.globalAlpha = 1;
  skyDirty = false;
}

/* ---------- audio: everything synthesized, nothing plays before a user gesture ---------- */
const Snd = (() => {
  let ac = null, master = null, mus = null, nbuf = null, timer = 0, song = null, stepI = 0, nextT = 0, tempo = 1, wantMusic = false;
  const SONGS = [
    { bpm: 112, sc: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81], lead: [0, -1, 2, 4, 5, -1, 4, 2, 0, 2, 4, -1, 2, -1, -1, -1, 4, -1, 5, 7, 9, -1, 7, 5, 4, 5, 2, -1, 0, -1, -1, -1], bass: [48, 45, 41, 43] },
    { bpm: 122, sc: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83], lead: [4, -1, 4, 5, 7, -1, 5, 4, 2, -1, 4, 2, 0, -1, 2, -1, 4, -1, 4, 5, 7, -1, 9, 7, 5, 4, 2, 4, 5, -1, -1, -1], bass: [50, 47, 43, 45] },
    { bpm: 132, sc: [57, 60, 62, 64, 67, 69, 72, 74, 76, 79], lead: [5, -1, 7, 5, 4, -1, 2, 4, 5, -1, -1, 4, 2, -1, 0, -1, 2, -1, 4, 5, 7, -1, 8, 7, 5, 4, 5, -1, 5, -1, -1, -1], bass: [45, 41, 48, 43] }
  ];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = save.mute ? 0 : 0.9; master.connect(ac.destination);
    mus = ac.createGain(); mus.gain.value = 0.5; mus.connect(master);
    nbuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const ok = () => ac && !save.mute && ac.state === "running";
  function tone(type, f0, f1, dur, vol, delay, dest, at) {
    if (!ok()) return;
    const t = at || (ac.currentTime + (delay || 0)), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, f0, f1, q, delay, dest, at) {
    if (!ok()) return;
    const t = at || (ac.currentTime + (delay || 0)), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; f.type = "bandpass"; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || master); s.start(t); s.stop(t + dur + 0.03);
  }
  function sched() {
    if (!ok() || !song) return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    const sd = 30 / song.bpm;
    while (nextT < ac.currentTime + 0.3) {
      const i = stepI % 32, n = song.lead[i], root = song.bass[(i >> 3) & 3];
      if (n >= 0) tone("triangle", hz(song.sc[n]), hz(song.sc[n]), sd * 1.7, 0.085, 0, mus, nextT);
      if (i % 2 === 0) tone("sine", hz(i % 4 === 0 ? root : root + 7), hz(i % 4 === 0 ? root : root + 7), sd * 1.5, 0.13, 0, mus, nextT);
      if (i % 2 === 1) noise(0.04, 0.03, 7000, 5000, 2, 0, mus, nextT);
      nextT += sd / tempo; stepI++;
    }
  }
  return {
    unlock() { if (init() && ac.state === "suspended" && !document.hidden) ac.resume().catch(() => {}); },
    setMute(m) { save.mute = m; if (master) master.gain.value = m ? 0 : 0.9; writeSave(); },
    music(i) { song = i == null ? null : SONGS[i]; stepI = 0; nextT = 0; wantMusic = song != null; if (!timer && wantMusic) timer = setInterval(sched, 90); if (!wantMusic && timer) { clearInterval(timer); timer = 0; } },
    pauseMusic(p) { if (p) { if (timer) { clearInterval(timer); timer = 0; } } else if (wantMusic && !timer) { nextT = 0; timer = setInterval(sched, 90); } },
    tempo(t) { tempo = t; },
    hide(h) { if (!ac) return; if (h) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); },
    get state() { return ac ? ac.state : "none"; },
    jump() { tone("sine", 330, 660, 0.16, 0.16); },
    land() { noise(0.08, 0.12, 300, 120, 0.8); },
    ball(n) { const f = 660 * Math.pow(1.06, Math.min(n, 12)); tone("triangle", f, f, 0.09, 0.14); tone("triangle", f * 1.5, f * 1.5, 0.12, 0.12, 0.06); },
    bone() { [784, 988, 1175, 1568].forEach((f, i) => tone("triangle", f, f, 0.2, 0.16, i * 0.07)); },
    bump() { tone("sine", 220, 90, 0.2, 0.22); noise(0.12, 0.16, 500, 150, 0.7); },
    honk() { tone("sawtooth", 470, 410, 0.16, 0.12); tone("square", 235, 205, 0.16, 0.06); tone("sawtooth", 430, 340, 0.24, 0.12, 0.2); tone("square", 215, 170, 0.24, 0.06, 0.2); },
    splash() { noise(0.45, 0.3, 1400, 300, 0.6); noise(0.2, 0.15, 3000, 1200, 1, 0.05); },
    boing() { tone("sine", 180, 560, 0.24, 0.2); tone("triangle", 360, 1120, 0.2, 0.07); },
    spring() { tone("square", 150, 700, 0.22, 0.08); noise(0.1, 0.1, 900, 2400, 1.2); },
    zoom() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone("sawtooth", f, f * 1.02, 0.16, 0.08, i * 0.055)); },
    sign() { tone("triangle", 880, 880, 0.14, 0.15); tone("triangle", 1319, 1319, 0.26, 0.15, 0.12); },
    rustle() { noise(0.2, 0.14, 2600, 900, 0.9); },
    win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, i === 5 ? 0.5 : 0.16, 0.17, i * 0.13)); [262, 330, 392].forEach(f => tone("sine", f, f, 0.6, 0.08, 0.65)); },
    click() { tone("triangle", 520, 620, 0.06, 0.1); }
  };
})();

/* ---------- state ---------- */
let mode = "title", lvI = 0, run = "run", lvT = 0, VT = 0, rsT = 0, goalT = 0, ballN = 0, boneN = 0, combo = 0, comboT = 0, cp = 0, cpX = 120, fade = 0, shakeT = 0, bgRef = 0, bumps = 0, splashes = 0, rsDone = false;
const P = { x: 120, y: 0, px: 120, py: 0, vx: 0, vy: 0, on: 1, plat: null, face: 1, coy: 0, buf: 0, jumping: false, inv: 0, shake: 0, lock: 0, zoom: 0, meter: 0, paws: 3, phase: 0, skid: 0, squash: 0, tilt: 0, hidden: false };
const cam = { x: 0, y: 0, px: 0, py: 0, look: 0 };
const inp = { left: false, right: false, jump: false };
const src = { kL: false, kR: false, kJ: false, tL: false, tR: false, tJ: false, gL: false, gR: false, gJ: false, bL: false, bR: false, bJ: false };
let touchUI = false, speedMul = 1;
function syncInp() {
  const j = src.kJ || src.tJ || src.gJ || src.bJ;
  if (j && !inp.jump && mode === "play") P.buf = BUFFER;
  inp.jump = j; inp.left = src.kL || src.tL || src.gL || src.bL; inp.right = src.kR || src.tR || src.gR || src.bR;
}

/* particles and popup text: fixed pools, nothing allocated while playing */
const NP = 170, parts = [];
for (let i = 0; i < NP; i++) parts.push({ live: false, t: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 4, c: "#fff", r: 0 });
let pI = 0;
function puff(t, x, y, vx, vy, life, s, c) {
  const p = parts[pI]; pI = (pI + 1) % NP;
  p.live = true; p.t = t; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.s = s; p.c = c; p.r = x * 0.37;
}
function burst(t, n, x, y, sp, life, s, c, up) {
  if (REDUCED.matches) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) { const a = hash(i * 7.3 + x + VT) * TAU, v = sp * (0.4 + hash(i * 3.1 + y) * 0.6); puff(t, x, y, Math.cos(a) * v, Math.sin(a) * v - (up || 0), life * (0.6 + hash(i + x) * 0.4), s, c); }
}
const POP_FACE = "px ui-rounded, 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif", POP_BIG = "900 34" + POP_FACE, POP_SM = "900 19" + POP_FACE;
const pops = [];
for (let i = 0; i < 8; i++) pops.push({ t: 0, x: 0, y: 0, s: "", c: "#fff", big: false });
let popI = 0;
function pop(x, y, s, c, big) { const p = pops[popI]; popI = (popI + 1) % 8; p.t = big ? 1.5 : 1; p.x = x; p.y = y; p.s = s; p.c = c; p.big = !!big; }
const AMB = [];
for (let i = 0; i < 26; i++) AMB.push({ x: hash(i * 1.1), y: hash(i * 2.3), s: 0.5 + hash(i * 4.7), ph: hash(i * 9.2) * TAU });

/* ---------- level flow ---------- */
function snapCam() {
  if (!lvl) return;
  cam.look = 0; cam.x = cam.px = clamp(P.x - VW * 0.42, 0, Math.max(0, lvl.len - VW)); cam.y = cam.py = P.y - VH * ANCH; bgRef = cam.y;
}
function placeKC(x) {
  P.x = P.px = x; P.y = P.py = gy(x); P.vx = P.vy = 0; P.on = 1; P.plat = null; P.face = 1; P.coy = 0; P.buf = 0; P.jumping = false; P.skid = 0; P.squash = 0; P.tilt = 0; P.hidden = false;
}
function loadLevel(i) {
  lvI = i; LEVELS[i](); layersDirty = true;
  run = "run"; lvT = 0; ballN = 0; boneN = 0; combo = 0; cp = -1; cpX = 120; fade = 0; goalT = 0; bumps = 0; splashes = 0;
  P.paws = 3; P.meter = 0; P.zoom = 0; P.inv = 0; P.shake = 0; P.lock = 0;
  placeKC(120); snapCam();
  for (const p of parts) p.live = false; for (const p of pops) p.t = 0;
  hintI = -1; hudAll();
}
function startLevel(i) {
  loadLevel(i); setMode("play"); Snd.music(i); Snd.tempo(1); last = performance.now(); acc = 0; qN = 0; qSum = 0; qHold = 30;
}
function bump(fromX) {
  if (P.inv > 0 || run !== "run") return;
  P.paws--; bumps++; P.inv = 1.7; P.shake = 0.6; P.lock = 0.32;
  P.vx = (P.x < fromX ? -1 : 1) * 250; P.vy = -340; P.on = 0; P.plat = null; P.jumping = false; shakeT = 0.25;
  Snd.bump(); burst(0, 8, P.x, P.y - 26, 120, 0.4, 5, "#fff"); hudPaws();
  if (P.paws <= 0) { run = "respawn"; rsT = 1.1; rsDone = false; }
}
function river(g) {
  if (run !== "run") return;
  splashes++; Snd.splash(); burst(2, 16, P.x, g.wy, 260, 0.7, 5, TH[lvl.ti].foam, 240);
  P.hidden = true; P.paws = Math.max(0, P.paws - 1); hudPaws(); run = "respawn"; rsT = 1.0; rsDone = false; P.vx = P.vy = 0;
}
function respawn() {
  if (P.paws <= 0) P.paws = 3;
  if (P.zoom > 0) P.meter = 0;                 /* a dunk ends the zoomies; balls already banked towards the next one are kept */
  placeKC(cpX); P.inv = 2; P.shake = 0; P.lock = 0; P.zoom = 0; run = "run"; snapCam(); hudPaws(); Snd.tempo(1);
}
function finish() {
  const bonesAll = boneN >= 3, ballsOk = ballN >= Math.ceil(lvl.total * 0.7);
  const stars = 1 + (ballsOk ? 1 : 0) + (bonesAll ? 1 : 0), old = save.lv[lvI], isBest = !old || lvT < old.best;
  save.lv[lvI] = { best: old ? Math.min(old.best, lvT) : lvT, stars: Math.max(stars, old ? old.stars : 0), bones: Math.max(boneN, old ? old.bones : 0), balls: Math.max(ballN, old ? old.balls : 0) };
  writeSave();
  $("resTitle").textContent = TH[lvI].name + " complete!";
  const st = $("resStars").children, gl = $("resGoals").children, got = [true, ballsOk, bonesAll];
  for (let i = 0; i < 3; i++) { st[i].classList.toggle("on", i < stars); gl[i].classList.toggle("on", got[i]); }
  $("resTime").textContent = fmtTime(lvT); $("resBalls").textContent = ballN + " / " + lvl.total; $("resBones").textContent = boneN + " / 3"; $("resPaws").textContent = P.paws + " / 3";
  $("resBest").textContent = isBest ? "New best time!" : "Best time " + fmtTime(save.lv[lvI].best);
  $("btnNext").hidden = lvI >= 2;
  setMode("results"); Snd.music(null);
}
const fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); };

/* ---------- simulation: fixed 120 Hz step ---------- */
function step() {
  const L = lvl;
  VT += DT;
  for (let i = 0; i < L.plats.length; i++) {
    const p = L.plats[i]; p.pcx = p.cx; p.pcy = p.cy;
    if (p.mx) p.cx = p.x0 + p.mx * Math.sin(VT * p.om + p.ph);
    if (p.my) p.cy = p.y0 + p.my * Math.sin(VT * p.om + p.ph);
  }
  P.px = P.x; P.py = P.y; cam.px = cam.x; cam.py = cam.y;
  if (DBG && DBG.onStep) DBG.onStep();

  if (run === "respawn") {
    rsT -= DT; fade = clamp(1 - Math.abs(rsT - 0.35) / 0.35, 0, 1);
    if (!P.hidden) { P.vy += G * DT; P.y += P.vy * DT; P.x += P.vx * DT; const g0 = gapAt(P.x); if (!g0 && P.y > gy(P.x)) { P.y = gy(P.x); P.vy = 0; P.vx = 0; } }
    if (rsT <= 0.35 && !rsDone) { respawn(); run = "respawn"; rsDone = true; }
    if (rsT <= 0) { run = "run"; fade = 0; }
    stepWorld(); return;
  }
  if (run === "goal") {
    goalT += DT; P.vx *= 0.94; if (P.on === 1) { P.x += P.vx * DT; P.y = gy(P.x); } else { P.vy += G * DT; P.y += P.vy * DT; if (P.y >= gy(P.x)) { P.y = gy(P.x); P.on = 1; } }
    if (goalT > 0.3 && (goalT * 120 | 0) % 9 === 0) puff(1, L.goalX + (hash(goalT * 31) - 0.5) * 260, P.y - 150 - hash(goalT * 77) * 90, (hash(goalT * 13) - 0.5) * 80, 30, 1.4, 6, hash(goalT * 5) > 0.5 ? BALL_O : BALL_B);
    if (goalT > 2.1) finish();
    stepCam(); stepWorld(); return;
  }
  lvT += DT;

  if (P.buf > 0) P.buf -= DT;
  if (P.coy > 0) P.coy -= DT;
  if (P.inv > 0) P.inv -= DT;
  if (P.shake > 0) P.shake -= DT;
  if (P.lock > 0) P.lock -= DT;
  if (P.skid > 0) P.skid -= DT;
  if (P.squash > 0) P.squash -= DT * 4;
  if (comboT > 0) { comboT -= DT; if (comboT <= 0) combo = 0; }
  const zooming = P.zoom > 0;
  if (zooming) {
    P.zoom -= DT; P.meter = Math.max(0, P.zoom / ZOOM_TIME);
    if (P.zoom <= 0) { P.meter = 0; Snd.tempo(1); }
    if (!REDUCED.matches && (lvT * 120 | 0) % 5 === 0) puff(3, P.x - P.face * 26, P.y - 12 - hash(lvT * 91) * 34, -P.vx * 0.2, 0, 0.35, 5, (lvT * 24 | 0) % 2 ? BALL_O : BALL_B);
  }
  let dir = P.lock > 0 ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let top = zooming ? ZOOM_MAX : RUN_MAX, accel = zooming ? 1900 : ACC;

  /* jump (buffered, with coyote time) */
  if (P.buf > 0 && P.lock <= 0 && (P.on || P.coy > 0)) {
    const s0 = P.on === 1 ? slopeAt(P.x) : 0;
    P.vy = -JUMP + Math.min(0, s0 * P.vx) * 0.55; P.on = 0; P.plat = null; P.coy = 0; P.buf = 0; P.jumping = true;
    Snd.jump(); puff(0, P.x - 8, P.y - 2, -40, -20, 0.35, 7, "#fff"); puff(0, P.x + 8, P.y - 2, 40, -20, 0.35, 7, "#fff");
  }

  if (P.on) {
    const s = P.on === 1 ? slopeAt(P.x) : 0, inv = 1 / (1 + s * s), sinc = s * inv;
    const zn = P.on === 1 ? zoneAt(P.x) : 0;
    let fr = FRIC, drag = 1.1;
    if ((zn === MUD || zn === PUDDLE) && !zooming) { top = zn === MUD ? 150 : 190; fr = 2400; drag = 9; if (Math.abs(P.vx) > 60 && (lvT * 120 | 0) % 12 === 0) puff(2, P.x, P.y - 4, -P.vx * 0.2, -150, 0.4, 4, zn === MUD ? "#6b4a2c" : TH[L.ti].foam); }
    else if (zn === SNOW) { fr = 200; accel *= 0.6; }
    if (dir && s * dir < 0) top *= 1 - 0.6 * Math.abs(s) * Math.sqrt(inv);
    let ax = SLOPE_G * sinc;
    if (zn === CHUTE) ax += 640;
    if (dir) {
      if (P.vx * dir < -30) { ax += dir * SKID; if (P.skid <= 0 && Math.abs(P.vx) > 160) puff(0, P.x + P.face * 16, P.y - 3, P.vx * 0.3, -30, 0.4, 8, "#fff"); P.skid = 0.14; }
      else if (P.vx * dir < top) ax += dir * accel;
      P.face = dir;
    } else {
      const f = fr * DT;
      if (Math.abs(P.vx) <= f + 2 && Math.abs(ax) < fr * 0.92) { P.vx = 0; ax = 0; }
      else P.vx -= Math.sign(P.vx) * f;
    }
    P.vx += ax * DT;
    const sp = Math.abs(P.vx), over = sp - top;
    if (over > 0) P.vx -= Math.sign(P.vx) * Math.min(over, (drag * over + 60) * DT);
    P.vx = clamp(P.vx, -HARD_MAX, HARD_MAX);
    P.phase += Math.min(Math.abs(P.vx) * 0.055, 30) * DT;
    P.tilt += (Math.atan(s) * 0.85 - P.tilt) * 0.2;
    if (P.on === 1) {
      let nx = clamp(P.x + P.vx * DT, 26, L.len - 26);
      if (gapAt(nx)) { P.on = 0; P.vy = s * P.vx; P.coy = COYOTE; P.x = nx; P.y += P.vy * DT; }
      else {
        const ny = gy(nx);
        if (ny < P.y - (Math.abs(nx - P.x) * 2.6 + 3)) { P.vx = 0; }
        else {
          const vyG = s * P.vx, by = P.y + vyG * DT + 0.5 * G * DT * DT;
          if (ny > by + 0.3) { P.on = 0; P.vy = vyG; P.coy = COYOTE; P.x = nx; P.y = by; }
          else { P.x = nx; P.y = ny; P.vy = vyG; }
        }
      }
      if (P.on === 1) {
        for (let i = 0; i < L.springs.length; i++) { const o = L.springs[i]; if (Math.abs(P.x - (o.x + 6)) < 24 && P.vx > -60) { P.vx = Math.max(P.vx * 1.05, 480); P.vy = -780; P.on = 0; P.jumping = false; o.t = 1; Snd.spring(); burst(0, 6, o.x, o.y - 10, 120, 0.4, 6, "#fff"); pop(o.x, o.y - 70, "BOING!", "#fff"); } }
        for (let i = 0; i < L.shrooms.length; i++) { const o = L.shrooms[i]; if (Math.abs(P.x - o.x) < 20) shroomBounce(o); }
      }
    } else {
      const pl = P.plat; P.x += P.vx * DT + (pl.cx - pl.pcx); P.y = pl.cy; P.vy = 0;
      if (P.x < pl.cx - 10 || P.x > pl.cx + pl.w + 10) { P.on = 0; P.plat = null; P.coy = COYOTE; }
    }
  } else {
    if (dir) { if (P.vx * dir < top) P.vx += dir * (zooming ? 1100 : AIR_ACC) * DT; P.face = dir; }
    else P.vx -= P.vx * 0.5 * DT;
    const over = Math.abs(P.vx) - top;
    if (over > 0) P.vx -= Math.sign(P.vx) * over * 0.3 * DT;
    if (P.jumping) { if (!inp.jump && P.vy < -JUMP_CUT) { P.vy = -JUMP_CUT; P.jumping = false; } else if (P.vy >= 0) P.jumping = false; }
    P.vy = Math.min(P.vy + G * DT, 1500);
    P.tilt += (0 - P.tilt) * 0.1;
    let nx = clamp(P.x + P.vx * DT, 26, L.len - 26), ny = P.y + P.vy * DT, landed = false;
    /* log platforms: one-way, land from above */
    if (P.vy >= 0) for (let i = 0; i < L.plats.length; i++) {
      const p = L.plats[i];
      if (nx > p.cx - 8 && nx < p.cx + p.w + 8 && P.y <= p.pcy + 7 && ny >= p.cy) { P.on = 2; P.plat = p; P.x = nx; P.y = p.cy; land(P.vy); P.vy = 0; landed = true; break; }
    }
    if (!landed && P.vy > 0) for (let i = 0; i < L.shrooms.length; i++) {
      const o = L.shrooms[i];
      if (Math.abs(nx - o.x) < 32 && ny >= o.y - 36 && P.y <= o.y - 20) { P.x = nx; P.y = o.y - 36; shroomBounce(o); landed = true; break; }
    }
    if (!landed) {
      const g = gapAt(nx);
      if (g) {
        if (ny > gy(g.x0) + 16 && nx < g.x0 + 20) { nx = g.x0 + 20; if (P.vx < 0) P.vx = 0; }
        if (ny > gy(g.x1) + 16 && nx > g.x1 - 20) { nx = g.x1 - 20; if (P.vx > 0) P.vx = 0; }
        P.x = nx; P.y = ny;
        if (ny > g.wy + 10) river(g);
      } else {
        let gv = gy(nx);
        if (ny >= gv) {
          if (ny - gv > 22 && P.y < gy(P.x) + 1) { nx = P.x; P.vx = 0; gv = gy(nx); }   /* ran into a ledge wall */
          if (ny >= gv) {
            const s = slopeAt(nx), into = P.vy - s * P.vx;
            P.x = nx; P.y = gv;
            if (into >= -1) { P.vx = clamp((P.vx + P.vy * s) / (1 + s * s), -HARD_MAX, HARD_MAX); P.on = 1; land(into); P.vy = s * P.vx; }
          } else { P.x = nx; P.y = ny; }
        } else { P.x = nx; P.y = ny; }
      }
    }
  }

  if (run === "run") {
    const cyb = P.y - 26;
    /* balls, bones */
    for (let i = 0; i < L.balls.length; i++) {
      const o = L.balls[i]; if (o.got) continue; const dx = o.x - P.x;
      if (dx > 40) break; if (dx < -40) continue;
      if (Math.abs(o.y - cyb) < 38 && Math.abs(dx) < 32) {
        o.got = true; ballN++; combo++; comboT = 1.2; Snd.ball(combo); burst(3, 5, o.x, o.y, 110, 0.35, 5, BALL_O);
        if (P.zoom <= 0) { P.meter = Math.min(1, P.meter + 1 / ZOOM_BALLS); if (P.meter >= 1) { P.zoom = ZOOM_TIME; Snd.zoom(); Snd.tempo(1.25); pop(P.x, P.y - 90, "ZOOMIES!", "#ffd23c", true); } }
        hudBalls();
      }
    }
    for (let i = 0; i < L.bones.length; i++) {
      const o = L.bones[i];
      if (!o.got && Math.abs(o.x - P.x) < 36 && Math.abs(o.y - cyb) < 42) { o.got = true; boneN++; Snd.bone(); burst(3, 14, o.x, o.y, 170, 0.6, 6, "#ffd23c"); pop(o.x, o.y - 30, "Golden bone!", "#ffd23c"); hudBalls(); }
    }
    /* trail-sign checkpoints */
    for (let i = cp + 1; i < L.signs.length; i++) { const o = L.signs[i]; if (P.x > o.x) { cp = i; cpX = o.x; o.on = true; Snd.sign(); pop(o.x, o.y - 96, "Spot saved!", "#fff"); burst(3, 8, o.x, o.y - 70, 120, 0.5, 5, "#7fd0ff"); } else break; }
    /* brambles */
    for (let i = 0; i < L.brambles.length; i++) {
      const o = L.brambles[i]; if (o.burst || P.x < o.x0 - 12 || P.x > o.x1 + 12 || P.y < o.y - 22) continue;
      if (zooming) { o.burst = true; Snd.rustle(); burst(1, 14, (o.x0 + o.x1) / 2, o.y - 14, 220, 0.8, 6, "#3f8f46", 120); }
      else bump((o.x0 + o.x1) / 2);
    }
    if (P.x >= L.goalX - 70 && P.y > L.goalY - 260) { run = "goal"; goalT = 0; P.lock = 9; P.zoom = 0; P.meter = 0; Snd.tempo(1); Snd.win(); }
  }
  stepWorld(); stepCam();
}
function land(v) {
  P.jumping = false;
  if (v > 320) { P.squash = Math.min(1, v / 900); Snd.land(); puff(0, P.x - 10, P.y - 2, -50, -20, 0.35, 7, "#fff"); puff(0, P.x + 10, P.y - 2, 50, -20, 0.35, 7, "#fff"); }
}
function shroomBounce(o) {
  P.vy = -(inp.jump ? BOUNCE + 100 : BOUNCE); P.on = 0; P.plat = null; P.jumping = false; P.coy = 0; o.sq = 1; Snd.boing();
  burst(0, 6, o.x, o.y - 30, 110, 0.4, 5, "#fff3c2");
}
/* things that move on their own: cones, geese, squash timers */
function stepWorld() {
  const L = lvl, live = run === "run", zooming = P.zoom > 0;
  for (let i = 0; i < L.cones.length; i++) {
    const o = L.cones[i]; o.px = o.x; o.py = o.y;
    if (o.off > 0) { o.off -= DT; o.fvy += G * DT; o.fx += o.v * DT; o.fy += o.fvy * DT; if (o.off <= 0) { o.x = o.x1; o.v = -o.sp; } continue; }
    if (Math.abs(o.x - P.x) > 1400) continue;
    o.x += o.v * DT; if (o.x < o.x0) { o.x = o.x0; o.v = o.sp; } else if (o.x > o.x1) { o.x = o.x1; o.v = -o.sp; }
    o.y = gy(o.x); o.rot += o.v / 13 * DT;
    if (live && Math.abs(o.x - P.x) < 30 && P.y > o.y - 24 && P.y < o.y + 30) {
      if (zooming) { o.off = 2.5; o.fx = o.x; o.fy = o.y - 13; o.fvy = -620; o.v = P.face * 300; Snd.rustle(); }
      else if (P.inv <= 0) bump(o.x);
    }
  }
  for (let i = 0; i < L.geese.length; i++) {
    const o = L.geese[i]; o.px = o.x;
    if (o.cd > 0) o.cd -= DT;
    if (o.off > 0) { o.off -= DT; o.fy -= 260 * DT; o.fx -= o.face * 120 * DT; if (o.off <= 0) { o.x = o.x0; } continue; }
    const dx = P.x - o.x, ad = Math.abs(dx);
    if (ad > 1200) continue;
    if (live && ad < 240 && Math.abs(P.y - o.y) < 170) {
      o.face = dx < 0 ? -1 : 1; o.alert = Math.min(1, o.alert + DT * 5); o.w += DT * 9;
      if (o.cd <= 0) { o.cd = 1.5; Snd.honk(); pop(o.x, o.y - 84, "HONK!", "#fff"); }
      o.x = clamp(o.x + o.face * 62 * DT, o.x0 - 70, o.x0 + 70);
    } else { o.alert = Math.max(0, o.alert - DT * 2); if (Math.abs(o.x - o.x0) > 1) { const d = o.x0 > o.x ? 1 : -1; o.x += d * 30 * DT; o.face = d; o.w += DT * 5; } }
    o.y = gy(o.x);
    if (live && ad < 36 && P.y > o.y - 54 && P.y < o.y + 24) {
      if (zooming) { o.off = 5; o.fx = o.x; o.fy = o.y; Snd.honk(); pop(o.x, o.y - 84, "HONK?!", "#fff"); burst(1, 8, o.x, o.y - 30, 150, 0.7, 5, "#fff"); }
      else if (P.inv <= 0) { bump(o.x); P.vx *= 1.5; if (o.cd < 0.9) { Snd.honk(); pop(o.x, o.y - 84, "HONK!", "#fff"); } o.cd = 1.2; }
    }
  }
  for (let i = 0; i < L.shrooms.length; i++) { const o = L.shrooms[i]; if (o.sq > 0) o.sq -= DT * 3; }
  for (let i = 0; i < L.springs.length; i++) { const o = L.springs[i]; if (o.t > 0) o.t -= DT * 2.5; }
  for (let i = 0; i < L.signs.length; i++) { const o = L.signs[i]; if (o.on && o.t < 1) o.t = Math.min(1, o.t + DT * 3); }
  if (shakeT > 0) shakeT -= DT;
}
function stepCam() {
  const L = lvl, want = P.face * VW * (0.07 + LOOKK * Math.min(Math.abs(P.vx) / 700, 1));
  cam.look += (want - cam.look) * 2.6 * DT;
  cam.x = clamp(P.x + cam.look - VW * 0.5, 0, Math.max(0, L.len - VW));
  const ax = clamp(P.x + cam.look * 1.2, 0, L.len), ahead = gapAt(ax) ? P.y : gy(ax);
  const ty = (P.on ? P.y * 0.65 + ahead * 0.35 : P.y * 0.8 + ahead * 0.2) - VH * ANCH;
  cam.y += (ty - cam.y) * (P.on ? 5 : 3.2) * DT;
  cam.y = clamp(cam.y, P.y - VH * 0.82, P.y - VH * 0.3);
  bgRef += (cam.y - bgRef) * 0.6 * DT;
}

/* ---------- drawing ---------- */
function drawBall(x, y, r) {
  ctx.fillStyle = BALL_O; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = BALL_B; ctx.lineWidth = r * 0.32; ctx.beginPath(); ctx.arc(x - r * 0.8, y, r, -0.75, 0.75); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.4, r * 0.22, 0, TAU); ctx.fill();
}
function kcLeg(o, bob, lx, ph, back, front) {
  let a = o.air ? (front ? -0.95 : 0.95) : o.idle ? 0 : Math.sin(o.phase + ph) * 0.9;
  if (o.skid) a = front ? -0.8 : -0.35;
  ctx.save(); ctx.translate(lx, -16 + bob); ctx.rotate(a);
  ctx.fillStyle = back ? KCC.shade : KCC.coat; ctx.beginPath(); ctx.roundRect(-4, 0, 8, 17, 4); ctx.fill();
  ctx.fillStyle = KCC.belly; ctx.beginPath(); ctx.roundRect(-4, 12, 9, 5, 2.5); ctx.fill(); ctx.restore();
}
/* KC, extended from the kc-dash drawing: same coat, ears, harness, collar, tongue. o = pose flags */
function drawKC(x, y, face, tilt, o) {
  const c = KCC, air = o.air, t = VT, run = o.phase, idle = o.idle;
  const bob = air || idle ? (idle ? Math.sin(t * 3) * 0.8 : 0) : Math.sin(run * 2) * 2;
  const sq = o.squash > 0 ? 1 - o.squash * 0.22 : 1;
  ctx.save(); ctx.translate(x, y - (o.hop || 0)); ctx.rotate(tilt); ctx.scale(face, 1);
  if (air) ctx.rotate(clamp(o.vy / 1500, -0.45, 0.5));
  if (o.skid) ctx.rotate(-0.2);
  if (o.shake > 0) ctx.rotate(Math.sin(t * 46) * 0.2 * Math.min(1, o.shake * 3));
  ctx.scale(1 / Math.sqrt(sq), sq);
  if (o.zoom) {
    ctx.strokeStyle = "rgba(255,226,122,.85)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) { const yy = -8 - i * 10, l = 30 + hash(i + Math.floor(t * 20)) * 46; ctx.strokeStyle = i % 2 ? "rgba(255,226,122,.85)" : "rgba(120,190,255,.85)"; ctx.beginPath(); ctx.moveTo(-34, yy); ctx.lineTo(-34 - l, yy); ctx.stroke(); }
  }
  kcLeg(o, bob, -15, 0, true, false); kcLeg(o, bob, 14, Math.PI, true, true);
  ctx.save(); ctx.translate(-24, -30 + bob); ctx.rotate(-0.9 + Math.sin(t * (o.happy ? 26 : 14)) * (o.happy ? 0.55 : 0.35));    /* wagging tail */
  ctx.strokeStyle = c.coat; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3, -16, 6, -22); ctx.stroke();
  ctx.strokeStyle = c.tailTip; ctx.beginPath(); ctx.moveTo(3, -20); ctx.lineTo(6, -22); ctx.stroke(); ctx.restore();
  ctx.fillStyle = c.coat; ctx.beginPath(); ctx.ellipse(0, -26 + bob, 26, 13, 0, 0, TAU); ctx.fill();            /* body */
  ctx.fillStyle = c.belly; ctx.beginPath(); ctx.ellipse(4, -20 + bob, 17, 6, 0, 0, Math.PI); ctx.fill();
  kcLeg(o, bob, -11, Math.PI, false, false); kcLeg(o, bob, 18, 0, false, true);
  ctx.strokeStyle = c.harness; ctx.lineWidth = 5; ctx.lineCap = "round";                                        /* black harness */
  ctx.beginPath(); ctx.moveTo(7, -38 + bob); ctx.lineTo(10, -15 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -36 + bob); ctx.lineTo(21, -22 + bob); ctx.stroke();
  ctx.strokeStyle = c.collar; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(15, -43 + bob); ctx.lineTo(23, -29 + bob); ctx.stroke(); /* blue collar */
  ctx.fillStyle = c.coat; ctx.beginPath(); ctx.arc(25, -41 + bob, 12, 0, TAU); ctx.fill();                      /* head */
  ctx.fillStyle = c.belly; ctx.beginPath(); ctx.ellipse(35, -38 + bob, 9, 6.5, 0, 0, TAU); ctx.fill();          /* muzzle */
  ctx.fillStyle = c.nose; ctx.beginPath(); ctx.arc(43, -40 + bob, 3, 0, TAU); ctx.fill();                       /* nose */
  ctx.fillStyle = c.eye;
  if (o.shake > 0) { ctx.strokeStyle = c.eye; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(28, -44 + bob, 2.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }   /* eyes squeezed shut mid-shake */
  else { ctx.beginPath(); ctx.arc(28, -45 + bob, 2.2, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(28.8, -45.8 + bob, 0.8, 0, TAU); ctx.fill(); }
  ctx.fillStyle = "#ff8fa3"; ctx.beginPath(); ctx.ellipse(36, -32 + bob + (o.happy ? Math.sin(t * 18) : 0), 3, 4.5, 0.2, 0, TAU); ctx.fill(); /* happy tongue */
  ctx.save(); ctx.translate(18, -49 + bob); ctx.rotate(-0.5 + (o.shake > 0 ? Math.sin(t * 46) * 0.9 : air ? -0.7 : idle ? 0 : Math.sin(run * 2) * 0.2));   /* floppy ear */
  ctx.fillStyle = c.ear; ctx.beginPath(); ctx.ellipse(0, 7, 5.5, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
}
const pose = { air: false, phase: 0, idle: false, squash: 0, hop: 0, skid: false, shake: 0, zoom: false, happy: false, vy: 0 };

function drawPerson(x, y, cheer) {
  const t = VT, wave = cheer ? Math.sin(t * 10) * 0.25 : Math.sin(t * 2) * 0.08;
  ctx.save(); ctx.translate(x, y);
  /* picnic blanket and basket */
  ctx.fillStyle = "#e9503f"; ctx.beginPath(); ctx.roundRect(-110, -5, 190, 9, 4); ctx.fill();
  ctx.fillStyle = "#fff4e2"; for (let i = 0; i < 6; i++) ctx.fillRect(-98 + i * 31, -5, 13, 9);
  ctx.fillStyle = "#b9803f"; ctx.beginPath(); ctx.roundRect(-96, -30, 40, 26, 6); ctx.fill(); ctx.strokeStyle = "#8a5a26"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-76, -30, 16, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = "#8a5a26"; ctx.fillRect(-96, -20, 40, 3);
  /* bunting between two poles */
  ctx.strokeStyle = "#7a5a3c"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-140, 0); ctx.lineTo(-140, -150); ctx.moveTo(110, 0); ctx.lineTo(110, -150); ctx.stroke();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-140, -146); ctx.quadraticCurveTo(-15, -112, 110, -146); ctx.stroke();
  for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9, bx = lerp(-140, 110, u), by = -146 + 34 * 4 * u * (1 - u) * 0.5; ctx.fillStyle = i % 2 ? BALL_O : BALL_B; ctx.beginPath(); ctx.moveTo(bx - 9, by); ctx.lineTo(bx + 9, by); ctx.lineTo(bx, by + 18); ctx.fill(); }
  /* KC's person */
  const px = 30, hop = cheer ? Math.abs(Math.sin(t * 7)) * 6 : 0;
  ctx.translate(px, -hop);
  ctx.strokeStyle = "#2d3a5e"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-6, -44); ctx.lineTo(-8, -4); ctx.moveTo(6, -44); ctx.lineTo(9, -4); ctx.stroke();
  ctx.fillStyle = "#5a3b28"; ctx.beginPath(); ctx.roundRect(-16, -7, 14, 7, 3); ctx.roundRect(3, -7, 14, 7, 3); ctx.fill();
  ctx.fillStyle = "#1f9a8a"; ctx.beginPath(); ctx.roundRect(-14, -84, 28, 44, 10); ctx.fill();
  ctx.strokeStyle = "#1f9a8a"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-10, -78); ctx.lineTo(-24, -58 - wave * 30); ctx.stroke();
  ctx.save(); ctx.translate(10, -78); ctx.rotate(-2.3 + wave); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(30, 0); ctx.stroke(); ctx.fillStyle = "#f0c39a"; ctx.beginPath(); ctx.arc(32, 0, 5.5, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = "#f0c39a"; ctx.beginPath(); ctx.arc(0, -97, 13, 0, TAU); ctx.fill();
  ctx.fillStyle = "#6b3f24"; ctx.beginPath(); ctx.arc(0, -101, 13.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); ctx.beginPath(); ctx.ellipse(13, -92, 5, 12, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = "#3a2a20"; ctx.beginPath(); ctx.arc(-5, -96, 1.6, 0, TAU); ctx.arc(4, -96, 1.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#a8523c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-0.5, -92, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  const a = -2.3 + wave; drawBall(10 + Math.cos(a) * 40, -78 + Math.sin(a) * 40, 10);
  ctx.restore();
}
function drawGoose(o, x, y) {
  const fl = o.off > 0, f = o.face, al = o.alert;
  ctx.save(); ctx.translate(x, y); ctx.scale(f, 1);
  if (fl) ctx.rotate(-0.3);
  ctx.strokeStyle = "#e8912c"; ctx.lineWidth = 4; ctx.lineCap = "round";
  const lw = fl ? 0.6 : Math.sin(o.w) * 0.5;
  ctx.beginPath(); ctx.moveTo(-5, -16); ctx.lineTo(-5 + lw * 8, 0); ctx.moveTo(6, -16); ctx.lineTo(6 - lw * 8, 0); ctx.stroke();
  ctx.fillStyle = "#8b7765"; ctx.beginPath(); ctx.ellipse(-2, -27, 24, 15, -0.12, 0, TAU); ctx.fill();
  ctx.fillStyle = "#f3efe6"; ctx.beginPath(); ctx.ellipse(-20, -24, 9, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#6d5c4d"; ctx.save(); ctx.translate(-4, -31); ctx.rotate(fl ? -1 + Math.sin(VT * 30) * 0.7 : -0.1 - al * 0.5 * Math.abs(Math.sin(VT * 12))); ctx.beginPath(); ctx.ellipse(-8, 2, 18, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
  const nx = 16 + al * 12, ny = -62 + al * 18;
  ctx.strokeStyle = "#22201f"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(14, -32); ctx.quadraticCurveTo(12, -50, nx, ny); ctx.stroke();
  ctx.fillStyle = "#22201f"; ctx.beginPath(); ctx.ellipse(nx + 3, ny - 2, 8.5, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#f3efe6"; ctx.beginPath(); ctx.ellipse(nx + 1, ny + 2, 4.5, 3, 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "#33302e"; ctx.beginPath(); ctx.moveTo(nx + 9, ny - 4); ctx.lineTo(nx + 21, ny - 1 - al * 3); ctx.lineTo(nx + 9, ny + 1); ctx.fill();
  if (al > 0.4) { ctx.beginPath(); ctx.moveTo(nx + 9, ny + 1); ctx.lineTo(nx + 19, ny + 4); ctx.lineTo(nx + 9, ny + 3); ctx.fill(); }
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(nx + 5, ny - 4, 2.2, 0, TAU); ctx.fill(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(nx + 5.6, ny - 4, 1.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#000"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(nx + 1, ny - 8); ctx.lineTo(nx + 8, ny - 6); ctx.stroke();   /* grumpy brow */
  ctx.restore();
}
function drawCone(x, y, rot) {
  ctx.save(); ctx.translate(x, y - 13); ctx.rotate(rot);
  ctx.fillStyle = "#7a4d2a"; ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#a9713f"; ctx.lineWidth = 2.4;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 8 - 6, 0, 9, -0.9, 0.9); ctx.stroke(); }
  ctx.fillStyle = "#54341c"; ctx.beginPath(); ctx.arc(-14, 0, 3.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawBramble(o) {
  const cx = (o.x0 + o.x1) / 2, w = o.x1 - o.x0;
  if (o.burst) { ctx.fillStyle = "#2f7a3a"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(o.x0 + w * (i + 0.5) / 5, o.y - 3, 10, 4, 0, 0, TAU); ctx.fill(); } return; }
  for (let i = 0; i < 5; i++) { const u = i / 4; ctx.fillStyle = i % 2 ? "#2b7438" : "#1f5f2e"; ctx.beginPath(); ctx.arc(o.x0 + 6 + (w - 12) * u, o.y - 13 - Math.sin(u * Math.PI) * 12, 17, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = "#8a5fa0"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) { const bx = o.x0 + 4 + i * (w - 8) / 3; ctx.beginPath(); ctx.moveTo(bx, o.y); ctx.quadraticCurveTo(bx + 14, o.y - 44, bx + 30, o.y - 6); ctx.stroke(); }
  ctx.strokeStyle = "#f3e9c8"; ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) { const bx = o.x0 + 6 + hash(i * 3.3 + o.x0) * (w - 12), by = o.y - 10 - hash(i * 5.1 + o.x0) * 26; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 4, by - 5); ctx.stroke(); }
  ctx.fillStyle = "#4b2a6e";
  for (let i = 0; i < 5; i++) { const bx = cx + (hash(i * 7.7 + o.x0) - 0.5) * (w - 6), by = o.y - 11 - hash(i * 2.9 + o.x0) * 24; ctx.beginPath(); ctx.arc(bx, by, 3.6, 0, TAU); ctx.fill(); }
}
function drawShroom(o) {
  const s = o.sq > 0 ? Math.sin(o.sq * Math.PI) : 0, h = 36 - s * 12, w = 34 + s * 8;
  ctx.fillStyle = "#f6e7c4"; ctx.beginPath(); ctx.roundRect(o.x - 9, o.y - h + 6, 18, h - 4, 7); ctx.fill();
  ctx.fillStyle = "#f29a1f"; ctx.beginPath(); ctx.ellipse(o.x, o.y - h + 8, w, 17, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#d97a0c"; ctx.beginPath(); ctx.roundRect(o.x - w, o.y - h + 6, w * 2, 6, 3); ctx.fill();
  ctx.fillStyle = "#ffd98a"; ctx.beginPath(); ctx.ellipse(o.x - 14, o.y - h - 2, 6, 4, -0.3, 0, TAU); ctx.ellipse(o.x + 10, o.y - h - 5, 7, 4, 0.2, 0, TAU); ctx.ellipse(o.x + 22, o.y - h + 3, 4, 3, 0, 0, TAU); ctx.fill();
}
function drawSpring(o) {
  const k = o.t > 0 ? Math.sin(o.t * Math.PI) : 0;
  ctx.fillStyle = "#8d8a84"; ctx.beginPath(); ctx.ellipse(o.x + 2, o.y - 6, 17, 13, 0, Math.PI, 0); ctx.fill();
  ctx.save(); ctx.translate(o.x + 2, o.y - 17); ctx.rotate(-0.42 - k * 0.5);
  ctx.fillStyle = "#9a6a3d"; ctx.beginPath(); ctx.roundRect(-44, -8, 88, 15, 7); ctx.fill();
  ctx.fillStyle = "#b98550"; ctx.beginPath(); ctx.roundRect(-40, -8, 80, 5, 3); ctx.fill();
  ctx.fillStyle = "#e9c896"; ctx.beginPath(); ctx.ellipse(43, -0.5, 4.5, 7.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ffd23c"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-22 + i * 18, 4); ctx.lineTo(-13 + i * 18, -1); ctx.lineTo(-22 + i * 18, -6); ctx.lineTo(-18 + i * 18, -1); ctx.fill(); }
  ctx.restore();
}
function drawSign(o) {
  const x = o.x, y = o.y, k = o.t;
  ctx.fillStyle = "#7a5a3c"; ctx.fillRect(x - 4, y - 78, 8, 80);
  ctx.fillStyle = o.on ? "#ffe9a8" : "#d9b98a"; ctx.strokeStyle = "#7a5a3c"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 30, y - 74); ctx.lineTo(x + 24, y - 74); ctx.lineTo(x + 38, y - 60); ctx.lineTo(x + 24, y - 46); ctx.lineTo(x - 30, y - 46); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.on ? BALL_O : "#9a7a52";                         /* paw print on the board */
  ctx.beginPath(); ctx.ellipse(x - 2, y - 56, 6, 5, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 9 + i * 7, y - 65 - (i === 1 ? 2 : 0), 2.6, 0, TAU); ctx.fill(); }
  if (k > 0) {                                                       /* blue bandana flag pops up */
    ctx.strokeStyle = "#7a5a3c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 78); ctx.lineTo(x, y - 78 - 34 * k); ctx.stroke();
    const wv = REDUCED.matches ? 0 : Math.sin(VT * 6) * 3;
    ctx.fillStyle = KCC.collar; ctx.beginPath(); ctx.moveTo(x, y - 78 - 34 * k); ctx.lineTo(x + 28 * k, y - 70 - 34 * k + wv); ctx.lineTo(x, y - 60 - 34 * k); ctx.fill();
  }
}
function drawPlat(p, x, y) {
  ctx.strokeStyle = "rgba(90,70,50,.6)"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x + 14, y + 4); ctx.lineTo(x + 14, y - 900); ctx.moveTo(x + p.w - 14, y + 4); ctx.lineTo(x + p.w - 14, y - 900); ctx.stroke();
  ctx.fillStyle = "#8a5d36"; ctx.beginPath(); ctx.roundRect(x, y, p.w, 22, 11); ctx.fill();
  ctx.fillStyle = "#6f4827"; ctx.beginPath(); ctx.roundRect(x + 4, y + 13, p.w - 8, 8, 4); ctx.fill();
  ctx.fillStyle = TH[lvl.ti].grass; ctx.beginPath(); ctx.roundRect(x + 5, y - 3, p.w - 10, 8, 4); ctx.fill();
  ctx.fillStyle = "#e3c08c"; ctx.beginPath(); ctx.ellipse(x + p.w - 5, y + 11, 5, 10, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#b98a55"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + p.w - 5, y + 11, 2.4, 5.5, 0, 0, TAU); ctx.stroke();
}
function topPath(a, b, st, dy) {
  ctx.beginPath(); ctx.moveTo(a, gy(a) + dy);
  for (let x = Math.ceil((a + 0.01) / st) * st; x < b; x += st) ctx.lineTo(x, gy(x) + dy);
  ctx.lineTo(b, gy(b) + dy);
}
function drawRun(a, b, st, bot, th) {
  if (b <= a) return;
  /* the path is laid down in world space; the texture is then filled unscaled on whole device pixels (fast path) */
  topPath(a, b, st, 0); ctx.lineTo(b, bot); ctx.lineTo(a, bot); ctx.closePath(); ctx.fillStyle = earthPat || th.earth;
  ctx.setTransform(1, 0, 0, 1, patX, patY); ctx.fill(); ctx.setTransform(u0, 0, 0, u0, wtx, wty);
  ctx.lineJoin = "round"; ctx.lineCap = "butt";
  topPath(a, b, st, 13); ctx.strokeStyle = th.under; ctx.globalAlpha = 0.5; ctx.lineWidth = 14; ctx.stroke(); ctx.globalAlpha = 1;
  topPath(a, b, st, 2); ctx.strokeStyle = th.grass; ctx.lineWidth = 13; ctx.stroke();
  topPath(a, b, st, -3); ctx.strokeStyle = th.grassHi; ctx.lineWidth = 3; ctx.stroke();
}
function drawZone(z, x0, x1, st) {
  const a = Math.max(z.x0, x0), b = Math.min(z.x1, x1); if (b <= a) return;
  ctx.lineCap = "round";
  if (z.t === MUD) { topPath(a, b, st, 1); ctx.strokeStyle = "#4e3420"; ctx.lineWidth = 15; ctx.stroke(); topPath(a, b, st, -3); ctx.strokeStyle = "#7a5636"; ctx.lineWidth = 3; ctx.stroke(); }
  else if (z.t === PUDDLE) { topPath(a, b, st, 1); ctx.strokeStyle = "#2f86c9"; ctx.lineWidth = 14; ctx.stroke(); topPath(a, b, st, -3); ctx.strokeStyle = "#bfe9ff"; ctx.lineWidth = 3; ctx.stroke(); }
  else if (z.t === SNOW) { topPath(a, b, st, -1); ctx.strokeStyle = "#f4f6ff"; ctx.lineWidth = 18; ctx.stroke(); topPath(a, b, st, 6); ctx.strokeStyle = "#c9cdf0"; ctx.lineWidth = 4; ctx.stroke(); }
  else {
    topPath(a, b, st, 1); ctx.strokeStyle = "#c79253"; ctx.lineWidth = 15; ctx.stroke(); topPath(a, b, st, -4); ctx.strokeStyle = "#e9c58c"; ctx.lineWidth = 3; ctx.stroke();
    const off = REDUCED.matches ? 0 : (VT * 160) % 64; ctx.strokeStyle = "#fff3c2"; ctx.lineWidth = 3.5; ctx.lineJoin = "round";
    for (let x = Math.floor(a / 64) * 64 + off; x < b - 12; x += 64) { if (x < z.x0 + 6) continue; const s = slopeAt(x), y = gy(x) + 1; ctx.beginPath(); ctx.moveTo(x - 6, y - 5 - s * 6); ctx.lineTo(x + 1, y + s * 1); ctx.lineTo(x - 6, y + 5 - s * 6); ctx.stroke(); }
  }
}
/* parallax layers are built at device resolution and blitted 1:1 on whole pixels (call with the identity transform set) */
function tileLayer(img, par, y) {
  const wd = img.width, yd = Math.round(y * u0);
  let ox = -(Math.round(cam.rx * par * u0) % wd); if (ox > 0) ox -= wd;
  for (let x = ox; x < cv.width; x += wd) ctx.drawImage(img, x, yd);
}
let u0 = 0, wtx = 0, wty = 0, patX = 0, patY = 0;   /* this frame: DPR*SC unit scale, world translation, earth texture offset */
function render(al) {
  if (!lvl) return;
  if (layersDirty || LAY.ti !== lvl.ti) buildLayers();
  if (skyDirty) buildSky();
  const L = lvl, th = TH[L.ti], t = VT, red = REDUCED.matches;
  cam.rx = lerp(cam.px, cam.x, al); cam.ry = lerp(cam.py, cam.y, al);
  if (shakeT > 0 && !red) { cam.rx += Math.sin(t * 90) * 4 * shakeT * 4; cam.ry += Math.cos(t * 70) * 3 * shakeT * 4; }
  const cxr = cam.rx, cyr = cam.ry;
  u0 = SC * DPR;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(skyC, 0, 0);                                         /* sky, sun and haze: one opaque blit */
  const hz = VH * ANCH, vy = clamp((bgRef - cyr) * 0.1, -40, 40);
  ctx.setTransform(u0, 0, 0, u0, 0, 0);
  ctx.globalAlpha = L.ti === 2 ? 0.35 : 0.8;
  for (let i = 0; i < 4; i++) { const cw = 150 + i * 30; let x = (i * 330 + 80 - cxr * 0.03 - (red ? 0 : t * (4 + i))) % (VW + 300); if (x < -300) x += VW + 300; ctx.drawImage(SPR.cloud, x, hz * (0.08 + i * 0.09), cw, cw * 0.36); }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  tileLayer(LAY.far, 0.06, hz - 300 + vy * 0.4);
  tileLayer(LAY.mid, 0.22, hz - 150 + vy);
  ctx.setTransform(u0, 0, 0, u0, 0, 0);
  /* forest floor under the tree line, only as far down as the lowest ground or water on screen (the rest is covered anyway) */
  let low = -1e9;
  for (let x = cxr - 24; x <= cxr + VW + 24; x += 24) { const y = gy(x); if (y > low) low = y; }
  for (let i = 0; i < L.gaps.length; i++) { const g = L.gaps[i]; if (g.x0 > cxr + VW) break; if (g.x1 > cxr && g.wy > low) low = g.wy; }
  const fy = hz + 99 + vy, fb = Math.min(VH + 1, low - cyr + 26);
  if (fb > fy) { ctx.fillStyle = th.mid2; ctx.fillRect(0, fy, VW + 1, fb - fy); }

  /* world */
  wtx = -cxr * u0; wty = -cyr * u0;
  patX = -(Math.round(cxr * u0) % patN); patY = -(Math.round(cyr * u0) % patN);
  ctx.setTransform(u0, 0, 0, u0, wtx, wty);
  const x0 = cxr - 30, x1 = cxr + VW + 30, bot = cyr + VH + 10, st = SC < 1 ? 16 : 8;
  for (let i = 0; i < L.decoB.length; i++) { const d = L.decoB[i]; if (d.x > x1 + 120) break; if (d.x < x0 - 120) continue; const s = SPR[L.ti].back[d.v]; ctx.drawImage(s, d.x - s.lw * d.s / 2, d.y - s.lh * d.s, s.lw * d.s, s.lh * d.s); }
  for (let i = 0; i < L.gaps.length; i++) {
    const g = L.gaps[i]; if (g.x1 < x0 || g.x0 > x1) continue;
    ctx.fillStyle = th.water; ctx.fillRect(g.x0 - 2, g.wy, g.x1 - g.x0 + 4, bot - g.wy);
    ctx.fillStyle = th.water2; ctx.fillRect(g.x0 - 2, g.wy + 34, g.x1 - g.x0 + 4, bot - g.wy);
    ctx.strokeStyle = th.foam; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    for (let x = g.x0; x <= g.x1; x += 12) { const y = g.wy + Math.sin(x * 0.06 + (red ? 0 : t * 3)) * 2.5; if (x === g.x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.globalAlpha = 0.4; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = g.x0 + 10 + ((red ? 0 : t * 30) % 46); x < g.x1 - 22; x += 46) { ctx.moveTo(x, g.wy + 16); ctx.lineTo(x + 18, g.wy + 16); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (let i = 0; i < L.signs.length; i++) { const o = L.signs[i]; if (o.x > x0 - 50 && o.x < x1 + 50) drawSign(o); }
  for (let i = 0; i < L.plats.length; i++) { const p = L.plats[i]; p.rx = lerp(p.pcx, p.cx, al); p.ry = lerp(p.pcy, p.cy, al); if (p.rx + p.w > x0 && p.rx < x1) drawPlat(p, p.rx, p.ry); }
  /* terrain between the water gaps */
  let a = x0;
  for (let i = 0; i < L.gaps.length; i++) { const g = L.gaps[i]; if (g.x1 < x0) continue; if (g.x0 > x1) break; drawRun(a, Math.min(g.x0, x1), st, bot, th); a = Math.max(a, g.x1); }
  drawRun(Math.max(a, 0), Math.min(x1, L.len), st, bot, th);
  for (let i = 0; i < L.zones.length; i++) { const z = L.zones[i]; if (z.x1 > x0 && z.x0 < x1) drawZone(z, x0, x1, st); }
  if (L.goalX > x0 - 200 && L.goalX < x1 + 200) drawPerson(L.goalX, L.goalY, run === "goal" || mode === "results");
  for (let i = 0; i < L.decoF.length; i++) { const d = L.decoF[i]; if (d.x > x1 + 50) break; if (d.x < x0 - 50) continue; const s = SPR[L.ti].front[d.v]; ctx.drawImage(s, d.x - s.lw * d.s / 2, d.y - s.lh * d.s, s.lw * d.s, s.lh * d.s); }
  for (let i = 0; i < L.springs.length; i++) { const o = L.springs[i]; if (o.x > x0 - 60 && o.x < x1 + 60) drawSpring(o); }
  for (let i = 0; i < L.shrooms.length; i++) { const o = L.shrooms[i]; if (o.x > x0 - 50 && o.x < x1 + 50) drawShroom(o); }
  for (let i = 0; i < L.brambles.length; i++) { const o = L.brambles[i]; if (o.x1 > x0 && o.x0 < x1) drawBramble(o); }
  for (let i = 0; i < L.balls.length; i++) { const o = L.balls[i]; if (o.x > x1) break; if (o.got || o.x < x0) continue; drawBall(o.x, o.y + (red ? 0 : Math.sin(t * 4 + o.x * 0.05) * 2.5), 10); }
  for (let i = 0; i < L.bones.length; i++) { const o = L.bones[i]; if (o.got || o.x < x0 - 40 || o.x > x1 + 40) continue; ctx.drawImage(SPR.bone, o.x - 32, o.y - 32 + (red ? 0 : Math.sin(t * 3 + i) * 4), 64, 64); }
  for (let i = 0; i < L.cones.length; i++) { const o = L.cones[i]; if (o.off > 0) { drawCone(o.fx, o.fy + 13, o.rot + t * 12); continue; } const x = lerp(o.px, o.x, al); if (x > x0 - 30 && x < x1 + 30) drawCone(x, gy(x), o.rot); }
  for (let i = 0; i < L.geese.length; i++) { const o = L.geese[i]; if (o.off > 0) { drawGoose(o, o.fx, o.fy); continue; } const x = lerp(o.px, o.x, al); if (x > x0 - 60 && x < x1 + 60) drawGoose(o, x, gy(x)); }

  /* KC */
  /* brief invulnerability: KC blinks, or with reduced motion stays solid inside a steady soft halo (no flashing) */
  const safe = P.inv > 0 && P.shake <= 0 && run === "run";
  if (!P.hidden && !(safe && !red && Math.floor(t * 14) % 2)) {
    const kx = lerp(P.px, P.x, al), ky = lerp(P.py, P.y, al), goal = run === "goal" || mode === "results";
    pose.air = !P.on; pose.phase = P.phase; pose.idle = !!P.on && Math.abs(P.vx) < 14; pose.squash = P.squash; pose.skid = P.skid > 0 && !!P.on; pose.shake = P.shake; pose.zoom = P.zoom > 0; pose.vy = P.vy;
    pose.happy = goal || P.zoom > 0 || mode === "title"; pose.hop = goal && P.on ? Math.abs(Math.sin(t * 7)) * 16 : 0;
    if (P.zoom > 0) { ctx.globalAlpha = 0.25; ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.ellipse(kx, ky - 26, 50, 36, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else if (safe && red) { ctx.globalAlpha = 0.3; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(kx + P.face * 6, ky - 28, 54, 38, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.globalAlpha = 1; }
    drawKC(kx, ky, P.face, P.on === 1 ? P.tilt : 0, pose);
  }
  /* particles */
  for (let i = 0; i < NP; i++) {
    const p = parts[i]; if (!p.live) continue;
    const k = p.life / p.max; ctx.globalAlpha = k < 0.5 ? k * 2 : 1; ctx.fillStyle = p.c;
    if (p.t === 0) { ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.6 - k * 0.8), 0, TAU); ctx.fill(); }
    else if (p.t === 1) { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s, p.s * 0.45, p.r + p.life * 6, 0, TAU); ctx.fill(); }
    else if (p.t === 2) { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.6, 0, TAU); ctx.fill(); }
    else { const s = p.s * k; ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s * 0.6, p.y); ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s * 0.6, p.y); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  for (let i = 0; i < 8; i++) {
    const p = pops[i]; if (p.t <= 0) continue;
    const k = p.big ? p.t / 1.5 : p.t; ctx.globalAlpha = Math.min(1, k * 3);
    ctx.font = p.big ? POP_BIG : POP_SM;
    ctx.lineWidth = p.big ? 7 : 5; ctx.strokeStyle = "rgba(25,45,38,.9)"; const y = p.y - (1 - k) * 34;
    ctx.strokeText(p.s, p.x, y); ctx.fillStyle = p.c; ctx.fillText(p.s, p.x, y);
  }
  ctx.globalAlpha = 1;

  /* screen space: foreground ferns, drifting motes, zoomies speed lines, fade */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  tileLayer(LAY.fore, 1.3, VH - 38);
  ctx.setTransform(u0, 0, 0, u0, 0, 0);
  if (!red) {
    ctx.fillStyle = th.amb;
    for (let i = 0; i < AMB.length; i++) {
      const m = AMB[i]; let x = (m.x * (VW + 40) - cxr * 0.4 * m.s + Math.sin(t * 0.7 + m.ph) * 20) % (VW + 40); if (x < -20) x += VW + 40;
      let y = (m.y * VH + (L.ti === 2 ? t * 40 * m.s : Math.sin(t * 0.5 + m.ph) * 16) - cyr * 0.3) % VH; if (y < 0) y += VH;
      ctx.globalAlpha = L.ti === 2 ? 0.8 : 0.35 + 0.3 * Math.sin(t * 2 + m.ph); ctx.beginPath(); ctx.arc(x, y, L.ti === 2 ? 1.6 + m.s : 1.2 + m.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (P.zoom > 0 || Math.abs(P.vx) > 600) {
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const y = hash(i * 3.3 + Math.floor(t * 14)) * VH * 0.8, x = hash(i * 8.1 + Math.floor(t * 14)) * VW, l = 60 + hash(i) * 80; ctx.moveTo(x, y); ctx.lineTo(x + l, y); }
      ctx.stroke();
    }
  }
  if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = "#12261f"; ctx.fillRect(0, 0, VW + 1, VH + 1); ctx.globalAlpha = 1; }
}
function stepFx(dt) {
  for (let i = 0; i < NP; i++) {
    const p = parts[i]; if (!p.live) continue;
    p.life -= dt; if (p.life <= 0) { p.live = false; continue; }
    if (p.t === 1) { p.vy += 240 * dt; p.vx *= 1 - dt; } else if (p.t === 2) p.vy += 900 * dt; else if (p.t === 0) { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = 0; i < 8; i++) if (pops[i].t > 0) pops[i].t -= dt;
}

/* ---------- HUD + screens ---------- */
let hintI = -1, lastTenth = -1, lastMeter = -1, lastFull = false;
function hudPaws() { const k = $("paws").children; for (let i = 0; i < 3; i++) k[i].classList.toggle("off", i >= P.paws); }
function hudBalls() { $("ballN").textContent = ballN; const k = $("boneHud").children; for (let i = 0; i < 3; i++) k[i].classList.toggle("on", i < boneN); }
function hudAll() { hudPaws(); hudBalls(); lastTenth = -1; lastMeter = -1; lastFull = false; $("meter").classList.remove("full"); hudTick(); setHint(-1); }
function hudTick() {
  const tt = Math.floor(lvT * 10);
  if (tt !== lastTenth) { lastTenth = tt; $("time").textContent = fmtTime(tt / 10); }
  const m = Math.round(P.meter * 100);
  if (m !== lastMeter) { lastMeter = m; $("meterFill").style.transform = "scaleX(" + m / 100 + ")"; }
  const full = P.zoom > 0;
  if (full !== lastFull) { lastFull = full; $("meter").classList.toggle("full", full); }
  let h = -1;
  if (run === "run" && lvl) for (let i = 0; i < lvl.hints.length; i++) { const z = lvl.hints[i]; if (P.x >= z.x0 && P.x <= z.x1) h = z.i; }
  if (h !== hintI) setHint(h);
}
function setHint(h) {
  hintI = h; const el = $("hint");
  if (h < 0 || mode !== "play") { el.classList.add("out"); return; }
  const v = HINTS[h]; el.textContent = v.length > 1 && !touchUI ? v[1] : v[0]; el.classList.remove("out"); placeHint();
}
/* the hint bubble sits just under whatever the HUD currently occupies (one row or two) */
function placeHint() {
  const hud = $("hud"); if (hud.hidden) return;
  let b = 0; for (let i = 0; i < hud.children.length; i++) { const r = hud.children[i].getBoundingClientRect(); if (r.bottom > b) b = r.bottom; }
  if (b > 0) $("hint").style.top = Math.round(b + 8) + "px";
}
/* cards whose body overflows show a "more below" cue above their buttons */
function cardMore() {
  if (mode === "play" || mode === "title") return;
  const b = $(mode).querySelector(".body"); if (!b) return;
  b.parentNode.classList.toggle("more", b.scrollHeight - b.scrollTop - b.clientHeight > 6);
}
for (const b of document.querySelectorAll(".card > .body")) b.addEventListener("scroll", cardMore, { passive: true });
const PANELS = ["title", "howto", "select", "pause", "results"];
function setMode(m) {
  mode = m;
  const panel = m === "play" ? null : m;
  for (const p of PANELS) $(p).hidden = p !== panel;
  $("hud").hidden = !(m === "play" || m === "pause" || m === "results");
  $("touch").hidden = !(touchUI && m === "play");
  if (m !== "play") { setHint(-1); for (const k in src) src[k] = false; syncInp(); for (const id of ["tL", "tR", "tJ"]) $(id).classList.remove("on"); }
  else { keysToSrc(); if (src.kJ) inp.jump = true; syncInp(); }     /* keys still held from before a pause or restart keep working; a held jump does not re-fire */
  Snd.pauseMusic(m !== "play");
  if (panel) { const bd = $(panel).querySelector(".body"); if (bd) bd.scrollTop = 0; cardMore(); }
  const f = { title: "btnPlay", howto: "btnHowBack", pause: "btnResume", results: lvI < 2 ? "btnNext" : "btnAgain" }[m];
  if (f && !touchUI) { try { $(f).focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
  if (m === "play" && document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function showSelect() {
  const box = $("lvList"); box.textContent = "";
  for (let i = 0; i < 3; i++) {
    const r = save.lv[i], open = unlocked(i), b = document.createElement("button");
    b.className = "lv t" + i + (open ? "" : " locked"); b.disabled = !open; b.dataset.lv = i;
    let stars = "";
    for (let k = 0; k < 3; k++) stars += '<svg class="i' + (r && k < r.stars ? " on" : "") + '"><use href="#i-star"/></svg>';
    b.innerHTML = '<span class="th"></span><span><b></b><small></small></span><span class="st">' + (open ? stars : '<svg class="i"><use href="#i-lock"/></svg>') + "</span>";
    b.querySelector("b").textContent = (i + 1) + ". " + TH[i].name;
    b.querySelector("small").textContent = !open ? "Finish " + TH[i - 1].name + " to unlock" : r ? "Best " + fmtTime(r.best) + "  ·  bones " + r.bones + "/3" : TH[i].sub;
    b.addEventListener("click", () => { Snd.click(); startLevel(i); });
    box.appendChild(b);
  }
  setMode("select"); cardMore();
  const first = box.querySelector("button:not([disabled])"); if (first && !touchUI) first.focus();
}
function toTitle() { Snd.music(null); loadLevel(0); setMode("title"); }
function pauseGame() { if (mode === "play") { setMode("pause"); } }
function resumeGame() { if (mode === "pause") { setMode("play"); last = performance.now(); acc = 0; qN = 0; qSum = 0; qHold = 10; } }
function refreshMute() {
  for (const b of document.querySelectorAll(".muteBtn")) {
    b.querySelector("use").setAttribute("href", save.mute ? "#i-mute" : "#i-snd"); b.setAttribute("aria-pressed", save.mute ? "true" : "false");
    b.setAttribute("aria-label", save.mute ? "Turn sound on" : "Mute sound");
    const s = b.querySelector("span"); if (s) s.textContent = save.mute ? "Sound off" : "Sound on";
  }
}
function toggleMute() { Snd.setMute(!save.mute); refreshMute(); if (!save.mute) Snd.click(); }
/* Buttons act on click. The in-game Pause and Mute buttons also act on touch pointerdown: a browser never sends
   a click for a second finger, and the first one is normally resting on the run pad. The one click that a lone
   finger produces afterwards, at the same spot, is swallowed so nothing fires twice. */
let fastPid = -1, fastT = -1e9, fastX = 0, fastY = 0;
const press = (el, fn) => { Snd.unlock(); if (!el.classList.contains("muteBtn")) Snd.click(); fn(); if (mode === "play" && el.blur) el.blur(); };
const on = (id, fn, fast) => {
  const el = $(id);
  el.addEventListener("click", () => press(el, fn));
  if (fast) el.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" || fastPid !== -1) return; e.preventDefault(); fastPid = e.pointerId; fastT = performance.now(); fastX = e.clientX; fastY = e.clientY; press(el, fn); });
};
for (const ev of ["pointerup", "pointercancel"]) window.addEventListener(ev, e => { if (e.pointerId === fastPid) { fastPid = -1; fastT = performance.now(); } }, true);
window.addEventListener("click", e => {
  if (!e.isTrusted || e.detail === 0 || performance.now() - fastT > (fastPid !== -1 ? 3000 : 600)) return;
  if (Math.abs(e.clientX - fastX) < 40 && Math.abs(e.clientY - fastY) < 40) { fastT = -1e9; e.stopPropagation(); e.preventDefault(); }
}, true);
on("btnPlay", () => { if (save.lv[0]) showSelect(); else startLevel(0); });
on("btnHow", () => setMode("howto"));
on("btnHowBack", () => setMode("title"));
on("btnSelBack", toTitle);
on("btnPause", pauseGame, true);
on("btnResume", resumeGame);
on("btnRestart", () => startLevel(lvI));
on("btnLevels", () => { Snd.music(null); showSelect(); });
on("btnNext", () => startLevel(Math.min(2, lvI + 1)));
on("btnAgain", () => startLevel(lvI));
on("btnResLevels", showSelect);
on("btnMute", toggleMute, true); on("btnMuteT", toggleMute); on("btnMuteP", toggleMute);

/* ---------- input ---------- */
const KEYS = { ArrowLeft: "kL", KeyA: "kL", ArrowRight: "kR", KeyD: "kR", Space: "kJ", ArrowUp: "kJ", KeyW: "kJ" };
/* which run/jump keys are physically down, tracked in every mode so a key held through a pause still counts */
const heldKeys = new Set();
function keysToSrc() { src.kL = src.kR = src.kJ = false; for (const c of heldKeys) src[KEYS[c]] = true; }
window.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  Snd.unlock();
  const k = KEYS[e.code];
  if (k) heldKeys.add(e.code);
  if (mode === "play") {
    if (k) { e.preventDefault(); if (!src[k]) { src[k] = true; syncInp(); } return; }
    if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) { e.preventDefault(); pauseGame(); }
    else if (e.code === "KeyR" && !e.repeat) startLevel(lvI);
    else if (e.code === "KeyM" && !e.repeat) toggleMute();
  } else if (mode === "pause") {
    if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) { e.preventDefault(); resumeGame(); }
    else if (e.code === "KeyR" && !e.repeat) startLevel(lvI);
    else if (e.code === "KeyM" && !e.repeat) toggleMute();
  } else {
    if (e.code === "Escape") { if (mode === "howto" || mode === "select") toTitle(); }
    else if (e.code === "KeyM" && !e.repeat) toggleMute();
    if (e.code === "Space" && e.target === document.body) e.preventDefault();
  }
});
window.addEventListener("keyup", e => { if (KEYS[e.code]) { heldKeys.delete(e.code); if (mode === "play") { keysToSrc(); syncInp(); } } });
window.addEventListener("blur", () => { heldKeys.clear(); src.kL = src.kR = src.kJ = false; syncInp(); });
function useTouch() { if (touchUI) return; touchUI = true; $("touch").hidden = mode !== "play"; resize(); if (hintI >= 0) setHint(hintI); }
if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) touchUI = true;
window.addEventListener("pointerdown", e => { Snd.unlock(); if (e.pointerType === "touch") useTouch(); }, true);
(function touchPad() {
  const pad = $("pad"), jb = $("tJ"); let pid = -1, jid = -1;
  const set = e => { const r = pad.getBoundingClientRect(), left = e.clientX < r.left + r.width / 2; src.tL = left; src.tR = !left; $("tL").classList.toggle("on", left); $("tR").classList.toggle("on", !left); syncInp(); };
  const clr = () => { pid = -1; src.tL = src.tR = false; $("tL").classList.remove("on"); $("tR").classList.remove("on"); syncInp(); };
  pad.addEventListener("pointerdown", e => { e.preventDefault(); pid = e.pointerId; try { pad.setPointerCapture(pid); } catch (x) { /* fine */ } set(e); });
  pad.addEventListener("pointermove", e => { if (e.pointerId === pid) set(e); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) pad.addEventListener(ev, e => { if (e.pointerId === pid) clr(); });
  jb.addEventListener("pointerdown", e => { e.preventDefault(); jid = e.pointerId; try { jb.setPointerCapture(jid); } catch (x) { /* fine */ } src.tJ = true; jb.classList.add("on"); syncInp(); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) jb.addEventListener(ev, e => { if (e.pointerId === jid) { jid = -1; src.tJ = false; jb.classList.remove("on"); syncInp(); } });
})();
/* no page scroll, pinch zoom, long-press menu or text selection while playing */
document.addEventListener("touchmove", e => { if (!(e.target.closest && e.target.closest(".panel"))) e.preventDefault(); }, { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());
document.addEventListener("selectstart", e => e.preventDefault());
let padPause = false, padOn = false;
window.addEventListener("gamepadconnected", () => { padOn = true; });
function pollPad() {
  if (!padOn || !navigator.getGamepads) return;                     /* nothing is polled (or allocated) until a pad announces itself */
  let gp = null; const all = navigator.getGamepads();
  for (let i = 0; i < all.length; i++) if (all[i] && all[i].connected) { gp = all[i]; break; }
  if (!gp) { padOn = false; if (src.gL || src.gR || src.gJ) { src.gL = src.gR = src.gJ = false; syncInp(); } return; }
  const ax = gp.axes[0] || 0, b = gp.buttons, pr = i => !!(b[i] && b[i].pressed);
  const l = ax < -0.4 || pr(14), r = ax > 0.4 || pr(15), j = pr(0) || pr(1), ps = pr(9);
  if (l !== src.gL || r !== src.gR || j !== src.gJ) { src.gL = l; src.gR = r; src.gJ = j; syncInp(); }
  if (ps && !padPause) { if (mode === "play") pauseGame(); else if (mode === "pause") resumeGame(); }
  padPause = ps;
}
document.addEventListener("visibilitychange", () => { if (document.hidden) { pauseGame(); Snd.hide(true); } else { Snd.hide(false); last = performance.now(); } });
let rzT = 0;
const onResize = () => { resize(); clearTimeout(rzT); rzT = setTimeout(resize, 250); };   /* the second look catches late orientation metrics; it is a no-op if nothing changed */
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", onResize);
if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);

/* ---------- main loop: fixed-step physics, interpolated render ---------- */
let last = 0, acc = 0, qN = 0, qSum = 0, qHold = 30;
/* If play cannot hold 60 fps, render fewer pixels: step the backing-store ratio down (2 > 1.5 > 1.25 > 1) and stay there. */
function quality(dt) {
  if (qHold > 0) { qHold--; return; }
  qSum += dt; if (++qN < 90) return;
  const avg = qSum / qN; qN = 0; qSum = 0;
  if (avg > 0.0215 && DPR > 1) { qCap = DPR > 1.5 ? 1.5 : DPR > 1.25 ? 1.25 : 1; qHold = 30; resize(); }
}
const DBG = DEBUG ? { onStep: null, ft: new Float32Array(600), cpu: new Float32Array(600), fi: 0, frames: 0 } : null;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1; else if (dt < 0) dt = 0;
  const c0 = DBG ? performance.now() : 0;
  pollPad();
  if (mode === "play") {
    acc += dt * speedMul; let n = 0; const cap = 14 * speedMul;
    while (acc >= DT && n < cap && mode === "play") { step(); acc -= DT; n++; }
    if (n >= cap) acc = 0;
    stepFx(dt * speedMul); hudTick(); if (speedMul === 1) quality(dt);
  } else { acc = 0; if (mode !== "pause") { VT += dt; stepFx(dt); P.px = P.x; P.py = P.y; cam.px = cam.x; cam.py = cam.y; } }
  render(mode === "play" ? acc / DT : 1);
  if (DBG) { DBG.ft[DBG.fi] = dt * 1000; DBG.cpu[DBG.fi] = performance.now() - c0; DBG.fi = (DBG.fi + 1) % 600; DBG.frames++; }
}

/* ---------- boot ---------- */
/* Installed (home-screen or store-wrapped) copies show the credit as plain text: no link out of the app. */
(function credit() {
  const dm = q => window.matchMedia && window.matchMedia("(display-mode: " + q + ")").matches;
  if (!(dm("standalone") || dm("fullscreen") || dm("minimal-ui") || navigator.standalone === true || /^android-app:/.test(document.referrer))) return;
  const a = document.querySelector("#made a"); if (!a) return;
  const sp = document.createElement("span"); sp.textContent = a.textContent; a.parentNode.replaceChild(sp, a);
})();
buildSprites();
LEVELS[0]();
resize(); loadLevel(0); refreshMute(); setMode("title");
last = performance.now(); requestAnimationFrame(frame);
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {}); });
}

/* ---------- test hooks: only with ?debug=1 ---------- */
if (DEBUG) {
  window.__kc = {
    P, cam, src, save, DBG, TH, consts: { DT, G, JUMP, RUN_MAX, ZOOM_MAX, HARD_MAX, AIR_ACC },
    get level() { return lvl; }, get mode() { return mode; },
    get state() { return { mode, run, level: lvI, t: lvT, x: P.x, y: P.y, vx: P.vx, vy: P.vy, on: P.on, paws: P.paws, balls: ballN, total: lvl.total, bones: boneN, meter: P.meter, zoom: P.zoom, cp, cpX, goalX: lvl.goalX, len: lvl.len, bumps, splashes, touchUI, VW, VH, SC, audio: Snd.state }; },
    gy, gapAt, slopeAt, zoneAt,
    start(i) { startLevel(i); },
    warp(x) { placeKC(x); P.inv = 1; snapCam(); },
    input(l, r, j) { src.bL = !!l; src.bR = !!r; src.bJ = !!j; syncInp(); },
    setSpeed(n) { speedMul = n; },
    onStep(fn) { DBG.onStep = fn; },
    zoomies() { P.meter = 1; P.zoom = ZOOM_TIME; },
    unlockAll() { for (let i = 0; i < 3; i++) if (!save.lv[i]) save.lv[i] = { best: 599.9, stars: 1, bones: 0, balls: 0 }; writeSave(); },
    frameStats() { const n = Math.min(DBG.frames, 600); let s = 0, mx = 0, c = 0, cm = 0; const a = []; for (let i = 0; i < n; i++) { s += DBG.ft[i]; c += DBG.cpu[i]; mx = Math.max(mx, DBG.ft[i]); cm = Math.max(cm, DBG.cpu[i]); a.push(DBG.ft[i]); } a.sort((p, q) => p - q); return { n, avgMs: s / n, p95Ms: a[Math.floor(n * 0.95)] || 0, maxMs: mx, cpuAvgMs: c / n, cpuMaxMs: cm }; },
    resetStats() { DBG.frames = 0; DBG.fi = 0; }
  };
}
})();
