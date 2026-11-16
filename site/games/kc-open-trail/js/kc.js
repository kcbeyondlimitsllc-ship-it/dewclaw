/* KC: the low-poly dog model (also reused for the other dogs in town), her
   procedural animation, and the player controller. */
import { THREE, Geo, clamp, lerp, lerpAngle, angDiff, damp, TAU } from './util.js';
import { KC_COLORS, SPAWN, HALF, WATER_Y } from './data.js';

let sharedMat = null;
export const dogMaterial = () => (sharedMat ||= new THREE.MeshLambertMaterial({ vertexColors: true }));

/* Build a dog. pal: coat, shade, belly, ear, tailTip, nose, eye, harness, collar, tongue. */
export function buildDog(pal, opts = {}) {
  const mat = dogMaterial(), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mesh = (g, m = mat) => { const x = new THREE.Mesh(g.build(), m); x.castShadow = !!opts.shadows; return x; };
  const parts = { root, body, legs: [] };
  { const g = new Geo(); g.ball(0, 0.52, -0.02, 0.2, 0.2, 0.43, pal.coat, 8, 6, false, pal.belly); g.ball(0, 0.55, 0.2, 0.215, 0.225, 0.24, pal.coat, 8, 6, false, pal.belly); g.ball(0, 0.69, 0.36, 0.135, 0.17, 0.15, pal.coat, 7, 5); g.ball(0, 0.53, -0.3, 0.19, 0.19, 0.2, pal.shade || pal.coat, 7, 5, false, pal.belly); parts.torso = mesh(g); body.add(parts.torso); }
  const head = new THREE.Group(); head.position.set(0, 0.82, 0.44); body.add(head); parts.head = head;
  { const g = new Geo(); g.ball(0, 0.03, 0.06, 0.18, 0.17, 0.19, pal.coat, 8, 6); g.ball(0, -0.035, 0.24, 0.1, 0.085, 0.14, pal.belly, 7, 5); g.ball(0, 0.0, 0.375, 0.042, 0.036, 0.036, pal.nose, 5, 4); for (const s of [-1, 1]) { g.ball(s * 0.088, 0.085, 0.2, 0.03, 0.034, 0.024, pal.eye, 5, 4); g.ball(s * 0.092, 0.097, 0.215, 0.009, 0.009, 0.006, 0xffffff, 4, 3); } head.add(mesh(g)); }
  for (const s of [-1, 1]) { const ear = new THREE.Group(); ear.position.set(s * 0.15, 0.13, 0.02); const g = new Geo(); g.ball(s * 0.02, -0.12, 0.02, 0.045, 0.14, 0.09, pal.ear, 6, 4); ear.add(mesh(g)); head.add(ear); parts[s < 0 ? 'earL' : 'earR'] = ear; }
  { const g = new Geo(); g.box(0, -0.045, 0.05, 0.065, 0.018, 0.13, pal.tongue || 0xff8fa3); const t = mesh(g); t.position.set(0, -0.075, 0.26); head.add(t); parts.tongue = t; }
  const mouth = new THREE.Group(); mouth.position.set(0, -0.09, 0.36); head.add(mouth); parts.mouth = mouth;
  const hatAnchor = new THREE.Group(); hatAnchor.position.set(0, 0.19, 0.04); head.add(hatAnchor); parts.hatAnchor = hatAnchor;
  for (const [x, z, front] of [[-0.12, 0.27, 1], [0.12, 0.27, 1], [-0.12, -0.3, 0], [0.12, -0.3, 0]]) { const leg = new THREE.Group(); leg.position.set(x, 0.44, z); const g = new Geo(); g.cyl(0, -0.42, 0, 0.048, 0.062, 0.44, 6, front ? pal.coat : (pal.shade || pal.coat)); g.ball(0, -0.41, 0.025, 0.062, 0.04, 0.08, pal.belly, 6, 4); leg.add(mesh(g)); body.add(leg); parts.legs.push(leg); }
  { const tail = new THREE.Group(); tail.position.set(0, 0.62, -0.44); const g = new Geo(); g.ball(0, 0.05, -0.05, 0.045, 0.075, 0.06, pal.coat, 5, 4); g.ball(0, 0.16, -0.1, 0.04, 0.075, 0.05, pal.coat, 5, 4); g.ball(0, 0.27, -0.11, 0.036, 0.065, 0.045, pal.tailTip || pal.belly, 5, 4); tail.add(mesh(g)); body.add(tail); parts.tail = tail; }
  if (opts.gear !== false) {
    parts.harnessMat = new THREE.MeshLambertMaterial({ color: pal.harness ?? 0x1f1f22 });
    { const g = new Geo(); g.tf(0, 0.55, 0.2, Math.PI / 2, 0, 0); g.cyl(0, -0.04, 0, 0.238, 0.238, 0.08, 10, 0xffffff); g.tf(0, 0.53, 0.0, Math.PI / 2, 0, 0); g.cyl(0, -0.035, 0, 0.215, 0.215, 0.07, 10, 0xffffff); g.notf(); g.box(0, 0.755, 0.1, 0.08, 0.035, 0.26, 0xffffff); g.box(0, 0.79, 0.1, 0.035, 0.04, 0.13, 0xffffff); g.box(0, 0.33, 0.1, 0.07, 0.03, 0.24, 0xffffff); parts.harness = mesh(g, parts.harnessMat); body.add(parts.harness); }
    parts.collarMat = new THREE.MeshLambertMaterial({ color: pal.collar ?? 0x3f7fd6 });
    { const g = new Geo(); g.tf(0, 0.715, 0.375, Math.PI / 2 - 0.55, 0, 0); g.cyl(0, -0.028, 0, 0.152, 0.152, 0.056, 9, 0xffffff); parts.collar = mesh(g, parts.collarMat); body.add(parts.collar); }
    parts.tagMat = new THREE.MeshLambertMaterial({ color: 0xf0c040 });
    { const g = new Geo(); g.ball(0, 0.585, 0.475, 0.032, 0.032, 0.012, 0xffffff, 6, 3); parts.tag = mesh(g, parts.tagMat); body.add(parts.tag); }
    parts.bandanaMat = new THREE.MeshLambertMaterial({ color: 0xd9534f, side: THREE.DoubleSide });
    { const g = new Geo(); g.tri([-0.15, 0.7, 0.42], [0.15, 0.7, 0.42], [0, 0.46, 0.5], 0xffffff); g.tf(0, 0.72, 0.37, Math.PI / 2 - 0.55, 0, 0); g.cyl(0, -0.035, 0, 0.158, 0.158, 0.07, 9, 0xffffff); parts.bandana = mesh(g, parts.bandanaMat); parts.bandana.visible = false; body.add(parts.bandana); }
  }
  root.scale.setScalar(opts.scale || 1);
  return parts;
}

/* Procedural animation shared by KC and the other dogs. a: { t, speed, air, swim, sit, bark, dig, shake, pant, wag, ride } */
export function animateDog(p, a, dt) {
  const k = damp(14, dt), t = a.t, sp = a.speed || 0, legs = p.legs;
  const run = clamp(sp / 6, 0, 1.6), freq = 7 + sp * 1.25, ph = a.phase;
  let bodyY = 0, bodyRx = 0, bodyRz = 0, headRx = 0, headRy = 0, tailRx = 0.5, tailRy = 0, fl = 0, fr = 0, bl = 0, br = 0, earZ = 0, tongue = 0;
  if (a.swim) {
    bodyY = -0.06; bodyRx = -0.12; const s = Math.sin(t * 9), c = Math.cos(t * 9); fl = -1.0 + s * 0.55; fr = -1.0 - s * 0.55; bl = 0.6 + c * 0.5; br = 0.6 - c * 0.5; headRx = -0.3; tailRx = 1.1; tailRy = Math.sin(t * 6) * 0.4;
  } else if (a.air) {
    fl = fr = -0.95; bl = br = 0.9; bodyRx = clamp(-a.vy * 0.04, -0.35, 0.35); earZ = 0.7; tailRx = 0.9;
  } else if (a.sit || a.ride) {
    bodyRx = -0.5; bodyY = -0.13; bl = br = -0.95; fl = fr = -0.05; headRx = 0.42; tailRy = Math.sin(t * 9) * 0.7 * (a.wag ?? 1); tailRx = 1.2;
    if (a.ride) { headRy = Math.sin(t * 0.7) * 0.3; earZ = Math.min(1, sp / 9) * 0.9; tongue = 1; }
  } else if (a.dig > 0) {
    bodyRx = 0.34; bodyY = -0.05; const s = Math.sin(t * 26); fl = -0.6 + s * 0.6; fr = -0.6 - s * 0.6; bl = br = 0.25; headRx = 0.5; tailRy = Math.sin(t * 14) * 0.6; tailRx = 0.2;
  } else if (sp > 0.25) {
    const s = Math.sin(ph), c = Math.cos(ph), amp = 0.45 + run * 0.45;
    if (sp > 8) { fl = s * amp * 1.1 - 0.15; fr = Math.sin(ph + 0.5) * amp * 1.1 - 0.15; bl = -Math.sin(ph + 0.2) * amp * 1.1 + 0.15; br = -Math.sin(ph + 0.7) * amp * 1.1 + 0.15; bodyRx = Math.sin(ph) * 0.1; bodyY = Math.abs(Math.sin(ph)) * 0.07; }
    else { fl = s * amp; br = s * amp; fr = -s * amp; bl = -s * amp; bodyY = Math.abs(c) * 0.025 * run; bodyRz = c * 0.03; }
    earZ = clamp(sp / 11, 0, 1) * 0.9 + Math.sin(ph * 2) * 0.12; tailRy = Math.sin(t * 10) * 0.35; tailRx = 0.7 + run * 0.25; headRx = -0.05 * run; tongue = sp > 8 ? 1 : 0;
  } else {
    bodyY = Math.sin(t * 2.2) * 0.006; tailRy = Math.sin(t * (6 + (a.wag || 0) * 6)) * (0.35 + (a.wag || 0) * 0.5); headRy = Math.sin(t * 0.6) * 0.15;
  }
  if (a.pant) { tongue = 1; bodyY += Math.sin(t * 16) * 0.008; }
  if (a.bark > 0) { const b = Math.sin((1 - a.bark / 0.35) * Math.PI); headRx -= b * 0.55; bodyRx -= b * 0.08; tongue = 0; }
  if (a.shake > 0) { bodyRz += Math.sin(t * 38) * 0.28; headRy += Math.sin(t * 38 + 1) * 0.5; earZ = 0.9 + Math.sin(t * 40) * 0.5; }
  if (a.carry) { tongue = 0; headRx -= 0.08; }
  const b = p.body; b.position.y = lerp(b.position.y, bodyY, k); b.rotation.x = lerp(b.rotation.x, bodyRx, k); b.rotation.z = lerp(b.rotation.z, bodyRz, k);
  legs[0].rotation.x = lerp(legs[0].rotation.x, fl - bodyRx, k); legs[1].rotation.x = lerp(legs[1].rotation.x, fr - bodyRx, k); legs[2].rotation.x = lerp(legs[2].rotation.x, bl - bodyRx * (a.sit || a.ride ? 0 : 1), k); legs[3].rotation.x = lerp(legs[3].rotation.x, br - bodyRx * (a.sit || a.ride ? 0 : 1), k);
  p.head.rotation.x = lerp(p.head.rotation.x, headRx, k); p.head.rotation.y = lerp(p.head.rotation.y, headRy + (a.look || 0), k);
  p.tail.rotation.x = lerp(p.tail.rotation.x, -tailRx + 0.5, k); p.tail.rotation.y = tailRy;
  p.earL.rotation.z = lerp(p.earL.rotation.z, -earZ, k); p.earR.rotation.z = lerp(p.earR.rotation.z, earZ, k);
  if (p.tongue) { const ts = lerp(p.tongue.scale.z, tongue ? 1 + Math.sin(t * 16) * 0.12 : 0.05, k); p.tongue.scale.set(1, 1, ts); p.tongue.visible = ts > 0.1; }
}

/* cosmetic hats built from code; the shop agent can register more with kc.registerHat */
const HATS = {
  cap: (g, c = 0xd9534f) => { g.ball(0, 0, 0, 0.17, 0.11, 0.18, c, 7, 4); g.box(0, -0.02, 0.2, 0.2, 0.02, 0.16, c); },
  party: (g, c = 0x9a6fd0) => { g.cyl(0, -0.02, 0, 0.12, 0, 0.34, 7, c); g.ball(0, 0.34, 0, 0.04, 0.04, 0.04, 0xffe27a, 5, 3); },
  ranger: (g, c = 0x6f8f4f) => { g.cyl(0, -0.02, 0, 0.3, 0.3, 0.025, 10, c); g.cyl(0, 0, 0, 0.15, 0.12, 0.16, 8, c); g.cyl(0, 0.01, 0, 0.155, 0.155, 0.04, 8, 0x3a2a1a); },
  beanie: (g, c = 0x3f9fd6) => { g.ball(0, 0.0, 0, 0.175, 0.14, 0.18, c, 7, 4); g.ball(0, 0.15, 0, 0.05, 0.05, 0.05, 0xffffff, 5, 3); },
  crown: (g, c = 0xf0c040) => { g.cyl(0, -0.02, 0, 0.13, 0.15, 0.1, 8, c); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.cyl(Math.cos(a) * 0.13, 0.07, Math.sin(a) * 0.13, 0.03, 0, 0.09, 4, c); } },
  pumpkin: (g) => { g.ball(0, 0.06, 0, 0.17, 0.13, 0.17, 0xf08a2a, 7, 4, true); g.cyl(0, 0.17, 0, 0.03, 0.02, 0.07, 4, 0x4f7f3f); },
  flower: (g, c = 0xff8fb0) => { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.ball(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14, 0.05, 0.035, 0.05, i % 2 ? c : 0xffffff, 5, 3); } }
};

/* body outfits (slot 'outfit'): simple shapes built round her torso, in body space (torso centre about 0, 0.53, 0; nose towards +z).
   Modules add more with kc.registerOutfit(id, (geo, color) => ...). */
const both = (g, a, b, c, col) => { g.tri(a, b, c, col); g.tri(a, c, b, col); };
const OUTFITS = {
  cape: (g, c = 0xc9483a) => { const q = (a, b2, c2, d) => { both(g, a, b2, c2, c); both(g, a, c2, d, c); };
    q([-0.16, 0.775, 0.22], [0.16, 0.775, 0.22], [0.2, 0.755, -0.4], [-0.2, 0.755, -0.4]);                                   /* along her back */
    for (const s of [-1, 1]) q([s * 0.16, 0.775, 0.22], [s * 0.2, 0.755, -0.4], [s * 0.31, 0.52, -0.46], [s * 0.26, 0.6, 0.16]);   /* draped sides */
    q([-0.2, 0.755, -0.4], [0.2, 0.755, -0.4], [0.31, 0.52, -0.6], [-0.31, 0.52, -0.6]);                                     /* the tail of the cape */
    g.tf(0, 0.715, 0.375, Math.PI / 2 - 0.55, 0, 0); g.cyl(0, -0.035, 0, 0.16, 0.16, 0.07, 9, c, c, 1, 0); g.notf(); g.ball(0, 0.6, 0.47, 0.035, 0.035, 0.03, 0xffd23c, 5, 3); },
  wings: (g, c = 0x3a3046) => { for (const s of [-1, 1]) { both(g, [s * 0.08, 0.76, 0.14], [s * 0.62, 1.0, -0.02], [s * 0.1, 0.72, -0.2], c); both(g, [s * 0.62, 1.0, -0.02], [s * 0.5, 0.74, -0.26], [s * 0.1, 0.72, -0.2], c); } g.box(0, 0.775, -0.02, 0.2, 0.03, 0.3, c); },
  vest: (g, c = 0xf08a2a) => { g.tf(0, 0.54, 0.26, Math.PI / 2, 0, 0); g.cyl(0, -0.4, 0, 0.228, 0.243, 0.38, 10, c, c, 1, 0); g.notf(); g.box(0, 0.79, 0.04, 0.1, 0.02, 0.34, 0xfff3c0); },
  sheet: (g, c = 0xf4f4ef) => { g.ball(0, 0.6, -0.04, 0.3, 0.3, 0.52, c, 8, 5); for (const s of [-1, 1]) g.box(s * 0.31, 0.5, 0.05, 0.02, 0.5, 0.6, c); for (const s of [-1, 1]) g.ball(s * 0.12, 0.84, 0.2, 0.04, 0.02, 0.05, 0x2a2c30, 5, 3); },
  pumpkinsuit: (g, c = 0xf08a2a) => { g.ball(0, 0.56, -0.04, 0.31, 0.28, 0.4, c, 8, 5, true); g.cyl(0, 0.82, -0.04, 0.045, 0.03, 0.1, 5, 0x4f7f3f); g.box(0.08, 0.86, -0.04, 0.16, 0.015, 0.08, 0x5f9f4f); },
  scarecrow: (g, c = 0x9a6a42) => { g.tf(0, 0.54, 0.24, Math.PI / 2, 0, 0); g.cyl(0, -0.36, 0, 0.228, 0.24, 0.34, 10, c, c, 1, 0); g.notf(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.box(Math.cos(a) * 0.2, 0.62 + Math.sin(a) * 0.2, 0.33, 0.05, 0.05, 0.14, 0xe0c060); } g.box(0.12, 0.76, 0.02, 0.1, 0.02, 0.1, 0xd9534f); g.box(-0.1, 0.77, -0.12, 0.09, 0.02, 0.09, 0x3f7fd6); },
  saddlebags: (g, c = 0x6f8f4f) => { for (const s of [-1, 1]) { g.box(s * 0.25, 0.55, -0.06, 0.11, 0.2, 0.3, c, 0x4f6f3f); g.box(s * 0.25, 0.66, -0.06, 0.12, 0.03, 0.31, 0x3a2a1a); } g.box(0, 0.775, -0.06, 0.5, 0.03, 0.12, 0x3a2a1a); },
  scarf: (g, c = 0x3f7fd6) => { g.tf(0, 0.715, 0.375, Math.PI / 2 - 0.55, 0, 0); g.cyl(0, -0.05, 0, 0.165, 0.165, 0.1, 9, c, c, 1, 0); g.notf(); g.box(0.1, 0.56, 0.47, 0.08, 0.26, 0.03, c); },
  lanternvest: (g, c = 0x3a4f7a) => { g.tf(0, 0.54, 0.26, Math.PI / 2, 0, 0); g.cyl(0, -0.4, 0, 0.228, 0.243, 0.38, 10, c, c, 1, 0); g.notf(); for (const s of [-1, 1]) for (const z of [-0.06, 0.12]) g.box(s * 0.245, 0.58, z, 0.02, 0.09, 0.07, 0xffe27a); }
};
const MOD_MUL = ['speed', 'stamina', 'jump', 'magnet', 'sniff', 'carry', 'swim', 'bones'], MOD_ADD = ['carryAdd'];
const baseMods = () => ({ speed: 1, stamina: 1, jump: 1, magnet: 1, sniff: 1, carry: 1, swim: 1, bones: 1, carryAdd: 0 });

export function createKC(game) {
  const { world, bus, state, fx } = game;
  const parts = buildDog(KC_COLORS, { scale: 1.3 });
  const root = parts.root; root.name = 'kc'; game.scene.add(root);
  const R = 0.42;
  const kc = {
    parts, root, pos: root.position, vel: new THREE.Vector3(), yaw: SPAWN.yaw, radius: R,
    onGround: true, swimming: false, sprinting: false, exhausted: false, stamina: 100, staminaMax: 100,
    sit: false, bark: 0, dig: 0, shake: 0, wet: 0, ride: null, carried: [], frozen: false, speed: 0, phase: 0, t: 0, petT: 0,
    base: { walk: 3.4, run: 6.6, sprint: 11, jump: 7.6, drain: 20, regen: 17, magnet: 1.7 },
    mods: baseMods(),
    modSources: new Map(), cosmetics: { bandana: null, harness: null, collar: null, hat: null, tag: null, trail: null, outfit: null }, hats: HATS, outfits: OUTFITS,
    safe: { x: SPAWN.x, z: SPAWN.z }
  };
  let coyote = 0, sinceSprint = 9, safeT = 0, stepT = 0, trailT = 0, hatMesh = null, outfitMesh = null, autoShake = 0, timed = 0;
  const carryAnchor = parts.mouth, v = new THREE.Vector3();

  /* ----- stat modifiers. kc.setModifier('upgrade:legs', { speed: 1.1 }) ; kc.setModifier('treat:zoomie', { speed: 1.15 }, { seconds: 180 }) ; null removes.
     speed, stamina, jump, magnet (pickup radius), sniff (how far away bones start drifting to her), carry, swim, bones multiply across sources; carryAdd adds. ----- */
  const recompute = () => { const out = baseMods(); for (const src of kc.modSources.values()) { for (const key of MOD_MUL) if (Number.isFinite(src.m[key]) && src.m[key] >= 0) out[key] *= src.m[key]; for (const key of MOD_ADD) if (Number.isFinite(src.m[key])) out[key] += src.m[key]; }
    timed = 0; for (const src of kc.modSources.values()) if (src.left != null) timed++;
    kc.mods = out; kc.staminaMax = 100 * out.stamina; kc.stamina = Math.min(kc.stamina, kc.staminaMax); bus.emit('modsChanged', out); return out; };
  kc.setModifier = (id, m, o = {}) => { if (m && typeof m === 'object') kc.modSources.set(id, { m, left: Number.isFinite(o.seconds) && o.seconds > 0 ? o.seconds : null, total: o.seconds || null }); else kc.modSources.delete(id); return recompute(); };
  kc.getModifier = key => (key ? kc.mods[key] : { ...kc.mods });
  kc.modifierLeft = id => { const src = kc.modSources.get(id); return src ? (src.left ?? Infinity) : 0; };
  kc.removeModifier = id => kc.setModifier(id, null);
  /* ----- cosmetics: kc.setCosmetic('bandana', 0xff0000) / ('hat', 'cap' | {type:'cap', color}) / ('harness', color) / ('collar', color) / ('tag', color|null) / ('trail', color|null) ----- */
  kc.setCosmetic = (slot, value) => {
    kc.cosmetics[slot] = value ?? null;
    if (slot === 'bandana') { parts.bandana.visible = value != null; if (value != null) parts.bandanaMat.color.set(value); }
    else if (slot === 'harness') parts.harnessMat.color.set(value ?? KC_COLORS.harness);
    else if (slot === 'collar') parts.collarMat.color.set(value ?? KC_COLORS.collar);
    else if (slot === 'tag') { parts.tag.visible = value !== false; if (value != null && value !== false) parts.tagMat.color.set(value); }
    else if (slot === 'hat') {
      if (hatMesh) { parts.hatAnchor.remove(hatMesh); hatMesh.geometry.dispose(); hatMesh = null; }
      const type = value && (value.type || value), fn = type && kc.hats[type];
      if (fn) { const g = new Geo(); fn(g, value.color); hatMesh = new THREE.Mesh(g.build(), dogMaterial()); parts.hatAnchor.add(hatMesh); }
    }
    else if (slot === 'outfit') {
      if (outfitMesh) { parts.body.remove(outfitMesh); outfitMesh.geometry.dispose(); outfitMesh = null; }
      const type = value && (value.type || value), fn = type && kc.outfits[type];
      if (fn) { const g = new Geo(); fn(g, value.color); outfitMesh = new THREE.Mesh(g.build(), dogMaterial()); parts.body.add(outfitMesh); }
    }
    bus.emit('cosmeticChanged', { slot, value });
  };
  kc.registerHat = (id, fn) => { kc.hats[id] = fn; };
  kc.registerOutfit = (id, fn) => { kc.outfits[id] = fn; };
  /* hold a pose for a photo (the simulation is stopped in photo mode): 'sit' | 'bark' | 'beg' | 'play' | 'stand' | null */
  kc.pose = name => { const a = { t: kc.t, speed: 0, phase: 0, wag: 1 }; if (name === 'sit') a.sit = true; else if (name === 'bark') a.bark = 0.17; else if (name === 'beg') { a.sit = true; a.bark = 0.17; } else if (name === 'play') { a.dig = 1; a.t = 0.06; }
    kc.sit = name === 'sit' || name === 'beg'; animateDog(parts, a, 1); animateDog(parts, a, 1); kc.posed = name || null; bus.emit('pose', { name: name || null }); };

  /* ----- carrying ----- */
  kc.capacity = () => Math.max(1, Math.floor(kc.mods.carry) + Math.floor(kc.mods.carryAdd || 0) + (kc.ride && kc.ride.tune ? Math.floor(kc.ride.tune.carry || 0) : 0));
  kc.carry = item => {
    if (kc.carried.length >= kc.capacity()) return false;
    kc.carried.push(item);
    if (item.mesh) { item.mesh.visible = kc.carried.length === 1; carryAnchor.add(item.mesh); item.mesh.position.set(0, 0, 0.02); item.mesh.rotation.set(0, 0, 0); item.mesh.scale.setScalar((item.scale || 1) / 1.3); }
    bus.emit('carry', { item, id: item.id, kind: item.kind }); return true;
  };
  kc.drop = (silent) => {
    const item = kc.carried.pop(); if (!item) return null;
    if (item.mesh) { carryAnchor.remove(item.mesh); item.mesh.visible = true; item.mesh.scale.setScalar(item.scale || 1); }
    const top = kc.carried[kc.carried.length - 1]; if (top && top.mesh) top.mesh.visible = true;
    const x = kc.pos.x + Math.sin(kc.yaw) * 0.9, z = kc.pos.z + Math.cos(kc.yaw) * 0.9;
    if (!silent) bus.emit('drop', { item, id: item.id, kind: item.kind, x, z });
    return { item, x, z };
  };
  kc.isCarrying = kind => kc.carried.some(i => !kind || i.kind === kind || i.id === kind);

  kc.teleport = (x, z, yaw) => {
    if (kc.ride) game.vehicles.exit(true);
    kc.pos.x = clamp(x, -HALF + 4, HALF - 4); kc.pos.z = clamp(z, -HALF + 4, HALF - 4); kc.pos.y = Math.max(world.groundAt(kc.pos.x, kc.pos.z, 200), WATER_Y - 0.5); kc.vel.set(0, 0, 0);
    if (yaw != null) kc.yaw = yaw; if (kc.swimming) { kc.swimming = false; kc.hop = false; bus.emit('swimEnd', { x: kc.pos.x, z: kc.pos.z }); } kc.onGround = true; kc.safe.x = kc.pos.x; kc.safe.z = kc.pos.z; root.rotation.y = kc.yaw;
    game.cam.snap(); bus.emit('teleport', { x: kc.pos.x, z: kc.pos.z });
  };
  kc.doBark = () => { if (kc.bark > 0 || kc.frozen) return; kc.bark = 0.35; kc.sit = false; state.stats.barks++; game.audio.sfx('bark'); bus.emit('bark', { x: kc.pos.x, z: kc.pos.z }); };
  kc.doSit = () => { if (kc.ride || kc.swimming || !kc.onGround) return; kc.sit = !kc.sit; if (kc.sit) bus.emit('sit', { x: kc.pos.x, z: kc.pos.z }); };
  kc.doDig = () => { if (kc.ride || kc.swimming || !kc.onGround || kc.dig > 0) return; kc.sit = false; kc.dig = 1.3; game.audio.sfx('dig'); bus.emit('digStart', { x: kc.pos.x, z: kc.pos.z }); };
  kc.doShake = () => { if (kc.shake > 0 || kc.ride) return; kc.shake = 0.9; game.audio.sfx('shake'); if (kc.wet > 0) fx.burst('water', kc.pos.x, kc.pos.y + 0.7, kc.pos.z, 18); kc.wet = 0; bus.emit('shake', { x: kc.pos.x, z: kc.pos.z }); };

  kc.update = (dt, input) => {
    kc.t += dt; const b = kc.base, m = kc.mods;
    if (timed) { let gone = null; for (const [id, src] of kc.modSources) if (src.left != null && (src.left -= dt) <= 0) (gone ||= []).push(id); if (gone) { for (const id of gone) kc.modSources.delete(id); recompute(); for (const id of gone) bus.emit('modExpired', { id }); } }
    if (kc.bark > 0) kc.bark -= dt; if (kc.shake > 0) kc.shake -= dt; if (kc.petT > 0) kc.petT -= dt;
    if (kc.ride) { kc.speed = Math.abs(kc.ride.speed); animateDog(parts, { t: kc.t, speed: kc.speed, ride: true, bark: kc.bark, phase: 0, shake: kc.shake }, dt); kc.stamina = Math.min(kc.staminaMax, kc.stamina + b.regen * dt); return; }
    let mx = input.moveX, my = input.moveY; let mag = Math.min(1, Math.hypot(mx, my));
    if (kc.frozen) mag = 0;
    if (kc.dig > 0) { kc.dig -= dt; mag = 0; if (Math.random() < dt * 22) fx.burst('dirt', kc.pos.x + Math.sin(kc.yaw) * 0.5, kc.pos.y + 0.1, kc.pos.z + Math.cos(kc.yaw) * 0.5, 1, { vx: -Math.sin(kc.yaw) * 2, vz: -Math.cos(kc.yaw) * 2 }); if (kc.dig <= 0) { state.stats.digs++; bus.emit('dig', { x: kc.pos.x, z: kc.pos.z }); } }
    if (mag > 0.15 && kc.sit) kc.sit = false;
    if (kc.sit) mag = 0;
    const cy = game.cam.yaw, sy = Math.sin(cy), cc = Math.cos(cy);
    let dx = 0, dz = 0; if (mag > 0.08) { dx = (sy * my - cc * mx); dz = (cc * my + sy * mx); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
    /* stamina + speed */
    const wantSprint = input.sprint && mag > 0.3 && !kc.swimming && !kc.exhausted;
    kc.sprinting = wantSprint && kc.stamina > 0;
    if (kc.sprinting) { kc.stamina -= b.drain * dt; sinceSprint = 0; if (kc.stamina <= 0) { kc.stamina = 0; kc.exhausted = true; bus.emit('exhausted', {}); } }
    else { sinceSprint += dt; if (sinceSprint > 0.7) kc.stamina = Math.min(kc.staminaMax, kc.stamina + b.regen * (kc.sit ? 1.8 : 1) * dt); if (kc.exhausted && kc.stamina > kc.staminaMax * 0.3) kc.exhausted = false; }
    let target = mag < 0.08 ? 0 : kc.swimming ? 3.2 * m.swim * mag : kc.sprinting ? b.sprint * m.speed : (mag < 0.55 ? b.walk : b.run) * (kc.exhausted ? 0.7 : 1) * Math.sqrt(m.speed);
    if (!kc.swimming && world.waterDepth(kc.pos.x, kc.pos.z) > 0.25 && kc.onGround) target *= 0.7;
    const acc = damp(kc.onGround ? 11 : kc.swimming ? 4 : 3.5, dt);
    kc.vel.x = lerp(kc.vel.x, dx * target, acc); kc.vel.z = lerp(kc.vel.z, dz * target, acc);
    kc.speed = Math.hypot(kc.vel.x, kc.vel.z);
    if (kc.speed > 0.4 && mag > 0.08) kc.yaw = lerpAngle(kc.yaw, Math.atan2(kc.vel.x, kc.vel.z), damp(12, dt));
    /* jump */
    coyote = kc.onGround ? 0.12 : coyote - dt;
    if (input.pressed.jump && !kc.frozen && kc.dig <= 0) {
      if (kc.swimming) { /* a hop out of the water helps her climb onto docks and banks */ if (!kc.hop) { kc.vel.y = 7.4; kc.hop = true; fx.burst('splash', kc.pos.x, WATER_Y, kc.pos.z, 6); game.audio.sfx('splash'); } }
      else if (coyote > 0) { kc.vel.y = b.jump * Math.sqrt(m.jump); kc.onGround = false; coyote = 0; kc.sit = false; state.stats.jumps++; game.audio.sfx('jump'); bus.emit('jump', { x: kc.pos.x, z: kc.pos.z }); }
    }
    /* integrate */
    const px = kc.pos.x, pz = kc.pos.z;
    kc.pos.x += kc.vel.x * dt; kc.pos.z += kc.vel.z * dt;
    world.resolve(kc.pos, R, kc.pos.y, 0.85);
    kc.pos.x = clamp(kc.pos.x, -HALF + 3, HALF - 3); kc.pos.z = clamp(kc.pos.z, -HALF + 3, HALF - 3);
    let g = world.groundAt(kc.pos.x, kc.pos.z, kc.pos.y);
    if (kc.onGround && g - kc.pos.y > 0.62 + 0.05) { kc.pos.x = px; kc.pos.z = pz; g = world.groundAt(px, pz, kc.pos.y); kc.vel.x *= 0.3; kc.vel.z *= 0.3; }
    const deep = g < WATER_Y - 0.75;
    if ((deep && kc.pos.y <= WATER_Y - 0.3) || (kc.swimming && kc.hop)) {
      if (!kc.swimming) { kc.swimming = true; kc.hop = false; kc.onGround = false; kc.sit = false; state.stats.swims++; fx.burst('splash', kc.pos.x, WATER_Y, kc.pos.z, 14); game.audio.sfx('splash'); bus.emit('swimStart', { x: kc.pos.x, z: kc.pos.z }); }
      kc.wet = 1;
      if (kc.hop) {
        kc.vel.y -= 22 * dt; kc.pos.y += kc.vel.y * dt; const gg = world.groundAt(kc.pos.x, kc.pos.z, kc.pos.y + 0.3);
        if (gg > WATER_Y - 0.75 && kc.pos.y <= gg && kc.vel.y <= 0) { kc.pos.y = gg; kc.vel.y = 0; kc.hop = false; kc.swimming = false; kc.onGround = true; autoShake = 0.5; bus.emit('swimEnd', { x: kc.pos.x, z: kc.pos.z }); }
        else if (kc.pos.y <= WATER_Y - 0.5 && kc.vel.y < 0) { kc.pos.y = WATER_Y - 0.5; kc.vel.y = 0; kc.hop = false; }
      } else { kc.vel.y = 0; kc.pos.y = lerp(kc.pos.y, WATER_Y - 0.5, damp(8, dt)); }
      if (kc.speed > 1 && Math.random() < dt * 8) fx.burst('water', kc.pos.x - Math.sin(kc.yaw) * 0.5, WATER_Y, kc.pos.z - Math.cos(kc.yaw) * 0.5, 1, { up: 0.8, sp: 0.6 });
    } else {
      if (kc.swimming) { kc.swimming = false; autoShake = 0.5; bus.emit('swimEnd', { x: kc.pos.x, z: kc.pos.z }); }
      if (kc.onGround && kc.vel.y <= 0 && g >= kc.pos.y - 0.55) { kc.pos.y = g; kc.vel.y = 0; }
      else {
        kc.onGround = false; kc.vel.y -= 22 * dt; kc.pos.y += kc.vel.y * dt;
        const g2 = world.groundAt(kc.pos.x, kc.pos.z, kc.pos.y + 0.3);
        if (kc.pos.y <= g2 && kc.vel.y <= 0) { if (g2 > WATER_Y - 0.75) { kc.pos.y = g2; if (kc.vel.y < -6) { fx.burst('dust', kc.pos.x, g2, kc.pos.z, 5); game.audio.sfx('land'); } kc.vel.y = 0; kc.onGround = true; bus.emit('land', {}); } else if (kc.pos.y <= WATER_Y - 0.45) { kc.pos.y = WATER_Y - 0.45; } }
      }
    }
    if (autoShake > 0 && kc.onGround) { autoShake -= dt; if (autoShake <= 0 && kc.wet > 0) kc.doShake(); }
    if (!(kc.pos.y > -40 && kc.pos.y < 400) || !Number.isFinite(kc.pos.x + kc.pos.z)) { kc.teleport(kc.safe.x, kc.safe.z); bus.emit('respawn', {}); }
    safeT += dt; if (safeT > 2 && kc.onGround && !world.blockedAt(kc.pos.x, kc.pos.z, kc.pos.y)) { safeT = 0; kc.safe.x = kc.pos.x; kc.safe.z = kc.pos.z; }
    const moved = Math.hypot(kc.pos.x - px, kc.pos.z - pz); state.stats.distance += moved; kc.phase += moved * (kc.sprinting ? 2.3 : 3.6);
    /* effects */
    if (kc.onGround && kc.speed > 2) { stepT -= dt * kc.speed; if (stepT <= 0) { stepT = 2.4; game.audio.step(world.surfaceAt(kc.pos.x, kc.pos.z)); if (kc.sprinting) fx.burst('dust', kc.pos.x, kc.pos.y, kc.pos.z, 2); } }
    if (kc.sprinting) { trailT -= dt; if (trailT <= 0) { trailT = 0.04; fx.spawn(kc.pos.x - Math.sin(kc.yaw) * 0.5 + (Math.random() - 0.5) * 0.4, kc.pos.y + 0.3 + Math.random() * 0.6, kc.pos.z - Math.cos(kc.yaw) * 0.5 + (Math.random() - 0.5) * 0.4, { color: kc.cosmetics.trail ?? 0xffe27a, life: 0.45, size: 0.22, alpha: 0.8, grow: -0.6 }); } }
    else if (kc.cosmetics.trail != null && kc.speed > 3) { trailT -= dt; if (trailT <= 0) { trailT = 0.09; fx.spawn(kc.pos.x - Math.sin(kc.yaw) * 0.5, kc.pos.y + 0.4, kc.pos.z - Math.cos(kc.yaw) * 0.5, { color: kc.cosmetics.trail, life: 0.5, size: 0.16, alpha: 0.7 }); } }
    /* pose */
    root.rotation.y = kc.yaw;
    if (kc.onGround) { const f = world.heightAt(kc.pos.x + Math.sin(kc.yaw) * 0.5, kc.pos.z + Math.cos(kc.yaw) * 0.5), bk = world.heightAt(kc.pos.x - Math.sin(kc.yaw) * 0.5, kc.pos.z - Math.cos(kc.yaw) * 0.5); root.rotation.x = lerp(root.rotation.x, clamp(-Math.atan2(f - bk, 1), -0.5, 0.5) * (world.groundAt(kc.pos.x, kc.pos.z, kc.pos.y) > world.heightAt(kc.pos.x, kc.pos.z) + 0.05 ? 0 : 1), damp(10, dt)); }
    else root.rotation.x = lerp(root.rotation.x, 0, damp(6, dt));
    root.rotation.order = 'YXZ';
    animateDog(parts, { t: kc.t, speed: kc.speed, phase: kc.phase, air: !kc.onGround && (!kc.swimming || kc.hop), vy: kc.vel.y, swim: kc.swimming && !kc.hop, sit: kc.sit, bark: kc.bark, dig: kc.dig, shake: kc.shake, pant: kc.exhausted || (kc.stamina < kc.staminaMax * 0.35 && !kc.sprinting), wag: kc.petT > 0 ? 1 : 0.2, carry: kc.carried.length > 0 }, dt);
    if (!kc.swimming) fx.blob(kc.pos.x, world.groundAt(kc.pos.x, kc.pos.z, kc.pos.y + 0.2), kc.pos.z, 0.55 * clamp(1 - (kc.pos.y - g) * 0.25, 0.4, 1));
  };
  return kc;
}
