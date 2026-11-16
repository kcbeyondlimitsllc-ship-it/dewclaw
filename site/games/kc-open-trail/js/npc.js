/* Life in Cedar Hollow: pedestrians who wave and pet KC, other dogs that play,
   critters that scatter, and the friendly ranger with the mischief meter. */
import { THREE, Geo, clamp, lerp, lerpAngle, angDiff, damp, rng, TAU, smoothPath } from './util.js';
import { PED_ROUTES, DOG_SPOTS, CRITTERS, RANGER_POST, FLOWER_BEDS, WATER_Y, HALF } from './data.js';
import { buildDog, animateDog, dogMaterial } from './kc.js';

const SKIN = [0xf2c9a0, 0xe0ac7e, 0xc68a5a, 0x9a6a42, 0x6e4a2e, 0xf6d6b8];
const HAIR = [0x2a1e16, 0x5a3a20, 0xa8702f, 0xd9b45a, 0x8a8a8a, 0x1a1a1a, 0xb04a2a];
const SHIRT = [0xd9534f, 0x3f7fd6, 0x4fae6f, 0xf0c040, 0x9a6fd0, 0xf08a2a, 0x4fb0b0, 0xf4f4ef, 0xe07a9a, 0x5a6a7a];
const PANTS = [0x3a4a6a, 0x5a4a3a, 0x2a2a30, 0x6a7a5a, 0x7a6a8a, 0x8a7a5a];
const NAMES = ['Maya', 'Otis', 'June', 'Theo', 'Ruth', 'Felix', 'Nora', 'Gus', 'Ivy', 'Hank', 'Wren', 'Milo', 'Opal', 'Jasper', 'Tess', 'Arlo', 'Dot', 'Cal', 'Fern', 'Reed'];

export function buildPerson(look) {
  const mat = dogMaterial(), root = new THREE.Group(), g = new Geo(), h = look.h || 1;
  g.box(0, 1.17, 0, 0.44, 0.62, 0.25, look.shirt); g.box(0, 0.86, 0, 0.42, 0.14, 0.25, look.pants);
  g.cyl(0, 1.46, 0, 0.07, 0.07, 0.08, 6, look.skin); g.ball(0, 1.66, 0, 0.15, 0.17, 0.155, look.skin, 7, 5);
  g.ball(0, 1.72, -0.02, 0.162, 0.14, 0.165, look.hair, 7, 4); if (look.long) g.box(0, 1.52, -0.12, 0.26, 0.3, 0.08, look.hair);
  for (const s of [-1, 1]) g.ball(s * 0.055, 1.67, 0.14, 0.02, 0.024, 0.012, 0x2a2a2a, 4, 3);
  if (look.hat === 'ranger') { g.cyl(0, 1.78, 0, 0.3, 0.3, 0.03, 10, 0x7a6a3a); g.cyl(0, 1.8, 0, 0.16, 0.13, 0.16, 8, 0x7a6a3a); g.box(0, 1.25, 0.13, 0.08, 0.08, 0.02, 0xf0c040); }
  else if (look.hat === 'cap') { g.ball(0, 1.76, 0, 0.165, 0.1, 0.17, look.hatCol, 7, 3); g.box(0, 1.74, 0.2, 0.2, 0.02, 0.14, look.hatCol); }
  else if (look.hat === 'straw') { g.cyl(0, 1.78, 0, 0.34, 0.34, 0.03, 10, 0xe0c060); g.cyl(0, 1.8, 0, 0.16, 0.14, 0.12, 8, 0xe0c060); }
  if (look.pack) g.box(0, 1.2, -0.2, 0.34, 0.46, 0.16, look.packCol || 0x4f6f3f);
  const body = new THREE.Mesh(g.build(), mat); root.add(body);
  const limb = (x, y, len, r, col, endCol) => { const grp = new THREE.Group(); grp.position.set(x, y, 0); const lg = new Geo(); lg.cyl(0, -len, 0, r * 0.9, r, len, 5, col); lg.box(0, -len - 0.02, endCol === look.skin ? 0 : 0.05, r * 2, 0.1, endCol === look.skin ? r * 2 : 0.24, endCol); grp.add(new THREE.Mesh(lg.build(), mat)); root.add(grp); return grp; };
  const p = { root, body, legL: limb(-0.11, 0.84, 0.8, 0.085, look.pants, 0x3a2a20), legR: limb(0.11, 0.84, 0.8, 0.085, look.pants, 0x3a2a20), armL: limb(-0.28, 1.42, 0.56, 0.06, look.shirt, look.skin), armR: limb(0.28, 1.42, 0.56, 0.06, look.shirt, look.skin) };
  root.scale.setScalar(h); return p;
}
export function randomLook(R, over = {}) {
  return { skin: SKIN[Math.floor(R() * SKIN.length)], hair: HAIR[Math.floor(R() * HAIR.length)], shirt: SHIRT[Math.floor(R() * SHIRT.length)], pants: PANTS[Math.floor(R() * PANTS.length)], h: 0.9 + R() * 0.2, long: R() < 0.4, hat: R() < 0.22 ? 'cap' : null, hatCol: SHIRT[Math.floor(R() * SHIRT.length)], ...over };
}

export function createNPCs(game) {
  const { world, bus, state, fx, kc, scene } = game, R = rng(555);
  const npcs = { peds: [], dogs: [], groups: [], ranger: null, mischief: { level: 0, heat: 0, timer: 0, chasing: false } };
  const hereY = (x, z, y) => world.groundAt(x, z, y + 0.4);

  /* ---------------- pedestrians ---------------- */
  function addPed(route, i, look, name) {
    const pts = route.loop ? smoothPath([...route.pts, route.pts[0]], 6) : smoothPath(route.pts, 6);
    const p = buildPerson(look), ped = { id: 'ped-' + npcs.peds.length, name, parts: p, pts, loop: !!route.loop, idx: Math.floor(R() * (pts.length - 1)), dir: R() < 0.5 ? 1 : -1, x: 0, z: 0, y: 0, yaw: 0, speed: 1.25 + R() * 0.5, state: 'walk', t: R() * 10, timer: 0, cool: 0, petCool: 0, side: (R() - 0.5) * 1.6, anim: 0, home: route };
    ped.x = pts[ped.idx][0]; ped.z = pts[ped.idx][1]; ped.y = world.heightAt(ped.x, ped.z); scene.add(p.root); npcs.peds.push(ped);
    game.api.addInteractable({ id: ped.id, getPos: () => ped, r: 2.4, label: () => 'Say hi to ' + ped.name, icon: 'hand', prio: 2, enabled: () => ped.state !== 'pet' && ped.petCool <= 0 && !kc.ride && p.root.visible, onInteract: () => pet(ped) });
    return ped;
  }
  function pet(ped) {
    ped.state = 'pet'; ped.timer = 2.2; ped.petCool = 14; kc.petT = 2.4; kc.sit = true; state.stats.pets++;
    fx.burst('heart', kc.pos.x, kc.pos.y + 1.2, kc.pos.z, 7); game.audio.sfx('pet');
    bus.emit('npcPet', { id: ped.id, name: ped.name, x: ped.x, z: ped.z });
  }
  PED_ROUTES.forEach((r, ri) => { for (let i = 0; i < r.n; i++) { const over = r.hiker ? { pack: true, hat: R() < 0.6 ? 'cap' : null, packCol: SHIRT[Math.floor(R() * SHIRT.length)] } : r.farmer ? { hat: 'straw', shirt: 0x3f7fd6, pants: 0x3a4a6a } : r.beach ? { pants: [0xf08a2a, 0x3f9fd6, 0xd9534f][i % 3] } : {}; addPed(r, i, randomLook(R, over), NAMES[npcs.peds.length % NAMES.length]); } });

  function updatePed(ped, dt) {
    const p = ped.parts, dx = kc.pos.x - ped.x, dz = kc.pos.z - ped.z, dk = Math.hypot(dx, dz);
    p.root.visible = dk < 95; if (!p.root.visible && dk > 130) { /* far away: just advance cheaply */ }
    ped.t += dt; if (ped.cool > 0) ped.cool -= dt; if (ped.petCool > 0) ped.petCool -= dt;
    let moving = false;
    if (ped.state === 'walk') {
      if (dk < 4.2 && ped.cool <= 0 && kc.speed < 8 && !kc.swimming && Math.abs(kc.pos.y - ped.y) < 2) { ped.state = 'greet'; ped.timer = 2.4; ped.cool = 16; bus.emit('npcWave', { id: ped.id, name: ped.name }); }
      else if (kc.sit && dk < 2.8 && ped.petCool <= 0 && !kc.ride) pet(ped);
      else {
        const tgt = ped.pts[ped.idx], tx = tgt[0], tz = tgt[1], ex = tx - ped.x, ez = tz - ped.z, d = Math.hypot(ex, ez);
        if (d < 0.6) { ped.idx += ped.dir; if (ped.idx >= ped.pts.length || ped.idx < 0) { if (ped.loop) ped.idx = ped.idx < 0 ? ped.pts.length - 2 : 1; else { ped.dir *= -1; ped.idx += ped.dir * 2; } } }
        else { const step = ped.speed * dt; ped.x += (ex / d) * step; ped.z += (ez / d) * step; ped.yaw = lerpAngle(ped.yaw, Math.atan2(ex, ez), damp(6, dt)); moving = true; }
      }
    } else if (ped.state === 'aside') {
      ped.timer -= dt; const nx = ped.x + ped.ax * 2.4 * dt, nz = ped.z + ped.az * 2.4 * dt;
      if (!world.blockedAt(nx, nz, ped.y, 0.3) && world.heightAt(nx, nz) > WATER_Y + 0.2) { ped.x = nx; ped.z = nz; } ped.yaw = lerpAngle(ped.yaw, Math.atan2(ped.ax, ped.az), damp(8, dt)); moving = true;
      if (ped.timer <= 0) ped.state = 'walk';
    } else {
      ped.timer -= dt; ped.yaw = lerpAngle(ped.yaw, Math.atan2(dx, dz), damp(7, dt));
      if (ped.state === 'greet' && kc.sit && dk < 2.8 && ped.petCool <= 0 && !kc.ride) pet(ped);
      if (ped.timer <= 0 || dk > 9) ped.state = 'walk';
    }
    ped.y = lerp(ped.y, hereY(ped.x, ped.z, ped.y), damp(12, dt));
    if (!p.root.visible) return;
    p.root.position.set(ped.x, ped.y, ped.z); p.root.rotation.y = ped.yaw;
    const k = damp(12, dt); let ll = 0, lr = 0, al = 0, ar = 0, arz = 0, lean = 0;
    if (moving) { ped.anim += dt * ped.speed * 4.4; const s = Math.sin(ped.anim); ll = s * 0.55; lr = -s * 0.55; al = -s * 0.4; ar = s * 0.4; }
    if (ped.state === 'greet') { arz = 2.5 + Math.sin(ped.t * 11) * 0.35; }
    if (ped.state === 'pet') { lean = 0.55; ar = -1.1 + Math.sin(ped.t * 9) * 0.25; al = -0.3; }
    p.legL.rotation.x = lerp(p.legL.rotation.x, ll, k); p.legR.rotation.x = lerp(p.legR.rotation.x, lr, k); p.armL.rotation.x = lerp(p.armL.rotation.x, al, k); p.armR.rotation.x = lerp(p.armR.rotation.x, ar, k); p.armR.rotation.z = lerp(p.armR.rotation.z, arz, k);
    p.body.rotation.x = lerp(p.body.rotation.x, lean, k); p.armL.position.z = p.armR.position.z = Math.sin(p.body.rotation.x) * 0.5; p.armL.position.y = p.armR.position.y = 1.42 - (1 - Math.cos(p.body.rotation.x)) * 0.5;
    fx.blob(ped.x, ped.y, ped.z, 0.42);
  }
  /* anyone a vehicle should stop for */
  npcs.obstacles = out => { for (const p of npcs.peds) if (p.parts.root.visible) out.push(p); for (const d of npcs.dogs) out.push(d); if (npcs.ranger && npcs.ranger.parts.root.visible) out.push(npcs.ranger); for (const g of npcs.groups) if (g.active && (g.kind === 'chicken' || g.kind === 'sheep')) for (const c of g.items) out.push(c); return out; };
  npcs.stepAside = (o, fx_, fz) => { if (!o.parts || !o.pts || o.state === 'pet') return; o.state = 'aside'; o.timer = 1.1; const s = ((o.x - fx_.x) * -fz.z + (o.z - fx_.z) * fz.x) > 0 ? 1 : -1; o.ax = -fz.z * s; o.az = fz.x * s; };

  /* ---------------- other dogs ---------------- */
  for (const s of DOG_SPOTS) {
    const parts = buildDog({ coat: s.coat, shade: s.coat, belly: s.belly, ear: s.ear, tailTip: s.belly, nose: 0x2a2020, eye: 0x1a1210, tongue: 0xff8fa3 }, { scale: 1.15 * s.s, gear: false });
    const collar = new Geo(); collar.tf(0, 0.715, 0.375, Math.PI / 2 - 0.55, 0, 0); collar.cyl(0, -0.028, 0, 0.152, 0.152, 0.056, 8, [0xd9534f, 0x4fae6f, 0xf0c040, 0x9a6fd0, 0xf08a2a][npcs.dogs.length % 5]); parts.body.add(new THREE.Mesh(collar.build(), dogMaterial()));
    const d = { id: 'dog-' + s.name.toLowerCase(), name: s.name, parts, home: s, x: s.x, z: s.z, y: world.heightAt(s.x, s.z), yaw: R() * TAU, tx: s.x, tz: s.z, speed: 0, wait: R() * 3, t: R() * 9, phase: 0, bark: 0, barkIn: 0, playCool: 0, playing: false, orbit: R() * TAU };
    scene.add(parts.root); npcs.dogs.push(d);
  }
  function updateDog(d, dt) {
    const dk = Math.hypot(kc.pos.x - d.x, kc.pos.z - d.z), hk = Math.hypot(kc.pos.x - d.home.x, kc.pos.z - d.home.z);
    d.parts.root.visible = dk < 95; d.t += dt; if (d.bark > 0) d.bark -= dt; if (d.playCool > 0) d.playCool -= dt;
    if (d.barkIn > 0) { d.barkIn -= dt; if (d.barkIn <= 0) { d.bark = 0.35; if (dk < 40) game.audio.sfx('bark', { pitch: 0.75 + d.home.s * 0.35, vol: clamp(1 - dk / 40, 0.1, 0.7) }); } }
    const wantPlay = dk < 10 && hk < d.home.r * 2.2 && !kc.swimming && !kc.ride;
    if (wantPlay && !d.playing) { d.playing = true; if (d.playCool <= 0) { d.playCool = 40; fx.burst('spark', d.x, d.y + 0.8, d.z, 6); bus.emit('dogPlay', { id: d.id, name: d.name, x: d.x, z: d.z }); } }
    if (!wantPlay) d.playing = false;
    let want = 0;
    if (d.playing) { d.orbit += dt * (kc.speed > 2 ? 0.4 : 1.3); d.tx = kc.pos.x + Math.cos(d.orbit) * 2.6; d.tz = kc.pos.z + Math.sin(d.orbit) * 2.6; want = kc.speed > 5 ? 8.5 : 5; }
    else { d.wait -= dt; if (d.wait <= 0) { const a = R() * TAU, r = R() * d.home.r; d.tx = d.home.x + Math.cos(a) * r; d.tz = d.home.z + Math.sin(a) * r; d.wait = 3 + R() * 5; } want = 2.6; }
    const ex = d.tx - d.x, ez = d.tz - d.z, dist = Math.hypot(ex, ez);
    if (dist > 0.5) { d.speed = lerp(d.speed, want, damp(5, dt)); const nx = d.x + (ex / dist) * d.speed * dt, nz = d.z + (ez / dist) * d.speed * dt; const pos = { x: nx, z: nz }; world.resolve(pos, 0.35, d.y, 0.7); if (world.heightAt(pos.x, pos.z) > WATER_Y - 0.2) { d.x = pos.x; d.z = pos.z; } else d.wait = 0; d.yaw = lerpAngle(d.yaw, Math.atan2(ex, ez), damp(8, dt)); d.phase += d.speed * dt * 3.4; }
    else { d.speed = lerp(d.speed, 0, damp(8, dt)); if (d.playing) d.yaw = lerpAngle(d.yaw, Math.atan2(kc.pos.x - d.x, kc.pos.z - d.z), damp(6, dt)); }
    d.y = lerp(d.y, hereY(d.x, d.z, d.y), damp(14, dt));
    if (!d.parts.root.visible) return;
    d.parts.root.position.set(d.x, d.y, d.z); d.parts.root.rotation.y = d.yaw;
    animateDog(d.parts, { t: d.t, speed: d.speed, phase: d.phase, bark: d.bark, wag: d.playing ? 1 : 0.2, pant: d.playing && d.speed < 0.5 }, dt);
    fx.blob(d.x, d.y, d.z, 0.5 * d.home.s);
  }
  bus.on('bark', e => { for (const d of npcs.dogs) if (Math.hypot(e.x - d.x, e.z - d.z) < 14) d.barkIn = 0.35 + Math.random() * 0.5; for (const g of npcs.groups) if (Math.hypot(e.x - g.x, e.z - g.z) < g.r + 13) spook(g, e.x, e.z, true); });

  /* ---------------- critters (instanced) ---------------- */
  const protos = {};
  { const g = new Geo(); g.ball(0, 0.14, 0, 0.09, 0.09, 0.14, 0x6a7a8a, 5, 4, true); g.ball(0, 0.24, 0.12, 0.06, 0.06, 0.06, 0x5a6a7a, 5, 3, true); g.cyl(0, 0.22, 0.17, 0.02, 0, 0.06, 3, 0xf0a030); g.tri([0, 0.16, -0.1], [0.04, 0.12, -0.26], [-0.04, 0.12, -0.26], 0x4a5a6a); g.tri([0.07, 0.17, 0.02], [0.3, 0.2, -0.04], [0.07, 0.17, -0.1], 0x7a8a9a); g.tri([-0.07, 0.17, 0.02], [-0.3, 0.2, -0.04], [-0.07, 0.17, -0.1], 0x7a8a9a); protos.bird = g.build(); }
  { const g = new Geo(); g.ball(0, 0.12, 0, 0.17, 0.13, 0.26, 0xf4f4ee, 6, 4, true); g.ball(0, 0.3, 0.2, 0.09, 0.1, 0.09, 0x2f7f4f, 5, 4, true); g.box(0, 0.28, 0.31, 0.07, 0.03, 0.1, 0xf0a030); g.tri([0, 0.2, -0.24], [0.06, 0.28, -0.34], [-0.06, 0.28, -0.34], 0xdadad2); protos.duck = g.build(); }
  { const g = new Geo(); g.ball(0, 0.14, 0, 0.08, 0.09, 0.15, 0xa8642f, 5, 4, true); g.ball(0, 0.22, 0.14, 0.06, 0.06, 0.07, 0xa8642f, 5, 3, true); g.ball(0, 0.26, -0.18, 0.07, 0.16, 0.08, 0xc98a4a, 5, 4, true); for (const s of [-1, 1]) g.cyl(s * 0.03, 0.27, 0.13, 0.015, 0, 0.05, 3, 0x8a4a20); protos.squirrel = g.build(); }
  { const g = new Geo(); g.ball(0, 0.22, 0, 0.14, 0.14, 0.18, 0xf4ead8, 6, 4, true); g.ball(0, 0.4, 0.13, 0.07, 0.08, 0.07, 0xf4ead8, 5, 3, true); g.cyl(0, 0.38, 0.19, 0.02, 0, 0.06, 3, 0xf0a030); g.box(0, 0.48, 0.12, 0.02, 0.06, 0.08, 0xd9534f); g.tri([0, 0.28, -0.14], [0, 0.42, -0.26], [0, 0.22, -0.26], 0xe0d6c0); for (const s of [-1, 1]) g.cyl(s * 0.05, 0, 0, 0.012, 0.012, 0.1, 3, 0xf0a030); protos.chicken = g.build(); }
  { const g = new Geo(); g.ball(0, 0.62, 0, 0.36, 0.34, 0.52, 0xf4f1e8, 7, 5, true); g.ball(0, 0.78, 0.5, 0.15, 0.17, 0.2, 0x3a3432, 6, 4, true); for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) g.cyl(x, 0, z, 0.045, 0.05, 0.4, 4, 0x3a3432); for (const s of [-1, 1]) g.ball(s * 0.16, 0.82, 0.44, 0.07, 0.035, 0.05, 0x3a3432, 4, 3, true); protos.sheep = g.build(); }
  const CFG = { bird: { trig: 6.5, sp: 9, back: 11 }, duck: { trig: 4.5, sp: 3.2, back: 6 }, squirrel: { trig: 5.5, sp: 8, back: 7 }, chicken: { trig: 3.6, sp: 5.5, back: 4 }, sheep: { trig: 0, sp: 3.2, back: 5 } };
  const meshes = {}, counts = {};
  for (const c of CRITTERS) counts[c[0]] = (counts[c[0]] || 0) + c[4];
  for (const k in counts) { const m = new THREE.InstancedMesh(protos[k], dogMaterial(), counts[k]); m.frustumCulled = false; m.name = 'critters-' + k; scene.add(m); meshes[k] = { mesh: m, n: 0 }; }
  CRITTERS.forEach(([kind, x, z, r, n], gi) => {
    const g = { id: kind + '-' + gi, kind, x, z, r, items: [], active: false, cool: 0, spooked: 0 };
    for (let i = 0; i < n; i++) { let a = R() * TAU, rr = Math.sqrt(R()) * r, hx = x + Math.cos(a) * rr, hz = z + Math.sin(a) * rr;
      for (let tries = 0; tries < 12; tries++) { const h = world.heightAt(hx, hz), ok = kind === 'duck' ? h < WATER_Y - 0.5 : h > WATER_Y + 0.3 && !world.blockedAt(hx, hz, h, 0.5); if (ok) break; a = R() * TAU; rr = Math.sqrt(R()) * r; hx = x + Math.cos(a) * rr; hz = z + Math.sin(a) * rr; }
      g.items.push({ slot: meshes[kind].n++, hx, hz, x: hx, z: hz, y: 0, yaw: R() * TAU, state: 'idle', t: R() * 10, timer: R() * 4, vx: 0, vz: 0, fly: 0, tx: hx, tz: hz, r: kind === 'sheep' ? 0.6 : 0.2 }); }
    npcs.groups.push(g);
  });
  function spook(g, fromX, fromZ, byBark) {
    if (!g.active) return; let any = false;
    for (const c of g.items) { if (c.state === 'flee') continue; const dx = c.x - fromX, dz = c.z - fromZ, d = Math.hypot(dx, dz) || 1; if (d > (byBark ? 14 : CFG[g.kind].trig + 3)) continue; c.state = 'flee'; c.timer = g.kind === 'bird' ? 2.6 : 1.4 + Math.random(); const a = Math.atan2(dx, dz) + (Math.random() - 0.5) * 1.2; c.vx = Math.sin(a); c.vz = Math.cos(a); any = true; }
    if (any && g.cool <= 0) { g.cool = 20; if (g.kind === 'sheep') game.audio.sfx('baa'); else if (g.kind === 'duck') game.audio.sfx('quack'); else if (g.kind === 'chicken') game.audio.sfx('cluck'); else if (g.kind === 'bird') game.audio.sfx('flap'); bus.emit('scatter', { id: g.id, kind: g.kind, count: g.items.length, byBark: !!byBark, x: g.x, z: g.z }); }
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  function updateGroup(g, dt) {
    const dk = Math.hypot(kc.pos.x - g.x, kc.pos.z - g.z), act = dk < g.r + 80, cfg = CFG[g.kind], mesh = meshes[g.kind].mesh;
    if (g.cool > 0) g.cool -= dt;
    if (!act) { if (g.active) { g.active = false; for (const c of g.items) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(c.slot, m4); } mesh.instanceMatrix.needsUpdate = true; } return; }
    g.active = true;
    const kx = kc.pos.x, kz = kc.pos.z;
    for (const c of g.items) {
      c.t += dt; const d = Math.hypot(kx - c.x, kz - c.z); let sc = 1, bob = 0, tilt = 0;
      if (c.state === 'idle') {
        if (cfg.trig && d < cfg.trig && (kc.speed > 1.5 || d < cfg.trig * 0.5)) { spook(g, kx, kz, false); }
        c.timer -= dt;
        if (c.timer <= 0) { c.timer = 1.5 + Math.random() * 4; const a = Math.random() * TAU, rr = g.kind === 'sheep' || g.kind === 'duck' ? 2.5 : 1.2; c.tx = clamp(c.x + Math.cos(a) * rr, c.hx - 4, c.hx + 4); c.tz = clamp(c.z + Math.sin(a) * rr, c.hz - 4, c.hz + 4); }
        const ex = c.tx - c.x, ez = c.tz - c.z, ed = Math.hypot(ex, ez);
        if (ed > 0.15) { const sp = g.kind === 'bird' || g.kind === 'squirrel' ? 1.6 : 0.7, nx = c.x + (ex / ed) * sp * dt, nz = c.z + (ez / ed) * sp * dt, h = world.heightAt(nx, nz); if (g.kind === 'duck' ? h < WATER_Y - 0.4 : h > WATER_Y + 0.25) { c.x = nx; c.z = nz; } else c.timer = 0; c.yaw = lerpAngle(c.yaw, Math.atan2(ex, ez), damp(6, dt)); bob = Math.abs(Math.sin(c.t * 9)) * 0.05; }
        else if (g.kind !== 'duck' && g.kind !== 'sheep') tilt = Math.max(0, Math.sin(c.t * 5)) * 0.6;
        else if (g.kind === 'sheep') tilt = Math.max(0, Math.sin(c.t * 0.9)) * 0.25;
      } else if (c.state === 'flee') {
        c.timer -= dt; const nx = c.x + c.vx * cfg.sp * dt, nz = c.z + c.vz * cfg.sp * dt, h = world.heightAt(nx, nz);
        if (g.kind === 'bird') { c.x = nx; c.z = nz; c.fly = Math.min(9, c.fly + dt * 5.5); tilt = -0.4; bob = Math.sin(c.t * 30) * 0.06; }
        else if ((g.kind === 'duck' ? h < WATER_Y - 0.4 : h > WATER_Y + 0.25) && !world.blockedAt(nx, nz, h, 0.3) && Math.abs(nx) < HALF && Math.abs(nz) < HALF) { c.x = nx; c.z = nz; bob = Math.abs(Math.sin(c.t * 16)) * 0.1; }
        c.yaw = lerpAngle(c.yaw, Math.atan2(c.vx, c.vz), damp(10, dt));
        if (c.timer <= 0) { c.state = g.kind === 'bird' ? 'away' : 'idle'; c.timer = g.kind === 'bird' ? cfg.back : 2 + Math.random() * 2; c.hx = g.kind === 'bird' ? c.hx : clamp(c.x, g.x - g.r, g.x + g.r); c.hz = g.kind === 'bird' ? c.hz : clamp(c.z, g.z - g.r, g.z + g.r); c.tx = c.x; c.tz = c.z; }
      } else if (c.state === 'away') {
        sc = 0; c.timer -= dt; if (c.timer <= 0 && Math.hypot(kx - c.hx, kz - c.hz) > 12) { c.state = 'land'; c.x = c.hx; c.z = c.hz; c.fly = 7; }
      } else if (c.state === 'land') { c.fly -= dt * 4; bob = Math.sin(c.t * 30) * 0.05; if (c.fly <= 0) { c.fly = 0; c.state = 'idle'; c.timer = 1; c.tx = c.x; c.tz = c.z; } }
      c.y = g.kind === 'duck' ? WATER_Y - 0.03 + Math.sin(c.t * 2) * 0.02 : world.heightAt(c.x, c.z) + c.fly + bob;
      e4.set(tilt, c.yaw, g.kind === 'bird' && c.fly > 0 ? Math.sin(c.t * 24) * 0.3 : 0, 'YXZ'); q4.setFromEuler(e4); p4.set(c.x, c.y, c.z); s4.setScalar(sc * (g.kind === 'bird' ? 1.5 : g.kind === 'sheep' ? 1.15 : 1.35)); m4.compose(p4, q4, s4); mesh.setMatrixAt(c.slot, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  for (const k in meshes) { const m = meshes[k].mesh; for (let i = 0; i < m.count; i++) { m4.makeScale(0, 0, 0); m.setMatrixAt(i, m4); } }

  /* ---------------- ranger + mischief ---------------- */
  const M = npcs.mischief;
  const rg = { id: 'ranger', name: 'Ranger Juniper', parts: buildPerson({ skin: SKIN[2], hair: HAIR[0], shirt: 0x6f8f4f, pants: 0x4a4a36, h: 1.02, hat: 'ranger', long: true }), x: RANGER_POST.x, z: RANGER_POST.z, y: 0, yaw: Math.PI, t: 0, anim: 0, speed: 0, r: 0.4, stuck: 0 };
  rg.y = world.heightAt(rg.x, rg.z); scene.add(rg.parts.root); npcs.ranger = rg;
  M.add = (n = 1, reason = 'mischief') => {
    const before = Math.floor(M.level); M.level = clamp(M.level + n, 0, 3); M.timer = 0;
    if (!M.chasing) { M.chasing = true; game.audio.sfx('whistle'); const d = Math.hypot(kc.pos.x - rg.x, kc.pos.z - rg.z);
      if (d > 70) { /* she was "nearby": start from behind the camera, on dry land */ for (let i = 0; i < 16; i++) { const a = game.cam.yaw + Math.PI + (i % 2 ? 1 : -1) * i * 0.2, x = kc.pos.x + Math.sin(a) * 42, z = kc.pos.z + Math.cos(a) * 42, h = world.heightAt(x, z); if (h > WATER_Y + 0.3 && !world.blockedAt(x, z, h, 0.6) && Math.abs(x) < HALF - 5 && Math.abs(z) < HALF - 5) { rg.x = x; rg.z = z; rg.y = h; break; } } }
      game.ui.toast('Uh oh! ' + rg.name + ' is coming with the leash. Outrun her!', { icon: 'whistle', kind: 'warn' }); bus.emit('chaseStart', { level: M.level, reason }); }
    if (Math.floor(M.level) !== before) bus.emit('mischief', { level: M.level, reason });
    return M.level;
  };
  M.clear = (silent) => { const was = M.chasing; M.level = 0; M.chasing = false; M.timer = 0; bus.emit('mischief', { level: 0 }); if (was && !silent) bus.emit('chaseEnd', {}); };
  M.fine = level => Math.min(state.wallet.bones, 5 * Math.max(1, Math.ceil(level)));
  function caught() {
    const level = M.level, fine = M.fine(level); game.wallet.add('bones', -fine, 'caught'); state.stats.caught++;
    while (kc.carried.length) { const d = kc.drop(true); bus.emit('confiscated', { item: d.item, id: d.item.id, kind: d.item.kind }); }
    M.clear(true); game.audio.sfx('caught');
    game.ui.fade(() => { kc.teleport(RANGER_POST.x - 2, RANGER_POST.z + 3.5, Math.PI); rg.x = RANGER_POST.x; rg.z = RANGER_POST.z; rg.y = world.heightAt(rg.x, rg.z); rg.yaw = Math.PI; });
    game.ui.toast(fine > 0 ? `Leash on! ${rg.name} walked KC back to the station. -${fine} bones` : `Leash on! ${rg.name} walked KC back to the station.`, { icon: 'whistle', kind: 'warn', ms: 4500 });
    bus.emit('caught', { level, fine });
  }
  bus.on('dig', e => { for (const [bx, bz, bw, bd] of FLOWER_BEDS) if (Math.abs(e.x - bx) < bw / 2 + 0.6 && Math.abs(e.z - bz) < bd / 2 + 0.6) { fx.burst('leaf', e.x, kc.pos.y + 0.3, e.z, 10, { color: 0xff8fb0 }); game.ui.toast('Oops, the flower bed!', { icon: 'dig' }); M.add(1, 'flowerbed'); return; } });
  function updateRanger(dt) {
    const dx = kc.pos.x - rg.x, dz = kc.pos.z - rg.z, d = Math.hypot(dx, dz); rg.t += dt; let moving = false, wave = false;
    rg.parts.root.visible = d < 110;
    if (M.chasing) {
      const inVan = kc.ride && kc.ride.kind === 'van', sp = (5.4 + Math.ceil(M.level) * 0.75);
      if (d > 1.3) {
        const step = sp * dt, pos = { x: rg.x + (dx / d) * step, z: rg.z + (dz / d) * step }; const hit = world.resolve(pos, 0.4, rg.y, 1.6);
        if (hit) { rg.stuck += dt; if (rg.stuck > 0.25) { const s = Math.sin(rg.t * 0.5) > 0 ? 1 : -1; pos.x += (-dz / d) * s * step * 1.5; pos.z += (dx / d) * s * step * 1.5; world.resolve(pos, 0.4, rg.y, 1.6); } } else rg.stuck = Math.max(0, rg.stuck - dt);
        const g = world.groundAt(pos.x, pos.z, rg.y + 0.4);
        if (g > WATER_Y - 0.25 && g - rg.y < 0.75) { rg.x = pos.x; rg.z = pos.z; moving = true; }
        rg.yaw = lerpAngle(rg.yaw, Math.atan2(dx, dz), damp(8, dt));
      }
      const close = d < 1.5 && Math.abs(kc.pos.y - rg.y) < 1.6;
      if (close && !inVan && !kc.swimming && !game.ui.fading) caught();
      else {
        const hidden = d > 30 || kc.swimming || inVan;
        M.timer = hidden ? M.timer + dt * (inVan || d > 60 ? 2 : 1) : Math.max(0, M.timer - dt * 0.5);
        if (M.timer > 9) { M.timer = 0; M.level = Math.max(0, Math.ceil(M.level) - 1); bus.emit('mischief', { level: M.level });
          if (M.level <= 0) { M.chasing = false; state.stats.escapes++; game.ui.toast('KC gave the ranger the slip!', { icon: 'paw', kind: 'good' }); bus.emit('escaped', {}); bus.emit('chaseEnd', {}); } }
      }
    } else {
      const hx = RANGER_POST.x - rg.x, hz = RANGER_POST.z - rg.z, hd = Math.hypot(hx, hz);
      if (hd > 1) { if (d > 80) { rg.x = RANGER_POST.x; rg.z = RANGER_POST.z; } else { const pos = { x: rg.x + (hx / hd) * 2.2 * dt, z: rg.z + (hz / hd) * 2.2 * dt }; world.resolve(pos, 0.4, rg.y, 1.6); if (world.heightAt(pos.x, pos.z) > WATER_Y) { rg.x = pos.x; rg.z = pos.z; } rg.yaw = lerpAngle(rg.yaw, Math.atan2(hx, hz), damp(6, dt)); moving = true; } }
      else if (d < 6) { rg.yaw = lerpAngle(rg.yaw, Math.atan2(dx, dz), damp(5, dt)); wave = d < 4; }
    }
    rg.y = lerp(rg.y, hereY(rg.x, rg.z, rg.y), damp(12, dt));
    if (!rg.parts.root.visible) return;
    const p = rg.parts, k = damp(12, dt); p.root.position.set(rg.x, rg.y, rg.z); p.root.rotation.y = rg.yaw;
    let ll = 0, lr = 0, al = 0, ar = 0, arz = 0;
    if (moving) { rg.anim += dt * (M.chasing ? 13 : 6); const s = Math.sin(rg.anim), a = M.chasing ? 0.95 : 0.5; ll = s * a; lr = -s * a; al = -s * a * 0.8; ar = M.chasing ? -1.3 : s * a * 0.8; }
    if (wave) arz = 2.5 + Math.sin(rg.t * 10) * 0.3;
    p.legL.rotation.x = lerp(p.legL.rotation.x, ll, k); p.legR.rotation.x = lerp(p.legR.rotation.x, lr, k); p.armL.rotation.x = lerp(p.armL.rotation.x, al, k); p.armR.rotation.x = lerp(p.armR.rotation.x, ar, k); p.armR.rotation.z = lerp(p.armR.rotation.z, arz, k);
    fx.blob(rg.x, rg.y, rg.z, 0.42);
  }

  npcs.update = dt => { for (const p of npcs.peds) updatePed(p, dt); for (const d of npcs.dogs) updateDog(d, dt); for (const k in meshes) meshes[k].on = false; for (const g of npcs.groups) { updateGroup(g, dt); if (g.active) meshes[g.kind].on = true; } for (const k in meshes) meshes[k].mesh.visible = meshes[k].on; updateRanger(dt); };
  npcs.addPed = (route, look, name) => addPed({ n: 1, ...route }, 0, look || randomLook(R), name || NAMES[npcs.peds.length % NAMES.length]);
  return npcs;
}
