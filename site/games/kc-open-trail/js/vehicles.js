/* Slow, polite traffic that always yields, plus the things KC can ride:
   skateboards, canoes and the camper van her human drives (KC rides up front,
   the player steers), the Heron Line tram she can board at its two stops, and
   the freight train on the Highway 30 line. Hop on / hop off is the interact button. */
import { THREE, Geo, clamp, lerp, lerpAngle, angDiff, damp, smoothPath, TAU } from './util.js';
import { RIDEABLES, TRAFFIC, ROADS, WATER_Y, HALF, TRAIN, TRAM } from './data.js';
import { dogMaterial } from './kc.js';

const wheel = (g, x, y, z, r, w = 0.28) => { const m = g.m ? g.m.clone() : new THREE.Matrix4(); const keep = g.m; g.m = m.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)); g.cyl(0, -w / 2, 0, r, r, w, 8, 0x26262a, 0x9a9aa0); g.m = keep; };

function carGeo(style, col) {
  const g = new Geo(), glass = 0x2c3a48;
  if (style === 'hatch') { g.box(0, 0.7, 0, 1.8, 0.7, 3.9, col); g.box(0, 1.3, -0.2, 1.62, 0.62, 2.2, col); g.box(0, 1.32, 0.92, 1.5, 0.5, 0.06, glass); g.box(0, 1.32, -1.31, 1.5, 0.5, 0.06, glass); for (const s of [-1, 1]) g.box(s * 0.82, 1.32, -0.2, 0.04, 0.46, 1.9, glass); }
  else if (style === 'pickup') { g.box(0, 0.75, 0, 1.9, 0.7, 4.6, col); g.box(0, 1.4, 0.5, 1.75, 0.7, 1.6, col); g.box(0, 1.42, 1.31, 1.6, 0.5, 0.06, glass); for (const s of [-1, 1]) { g.box(s * 0.89, 1.42, 0.5, 0.04, 0.5, 1.3, glass); g.box(s * 0.9, 1.25, -1.3, 0.1, 0.4, 1.9, col); } g.box(0, 1.25, -2.25, 1.9, 0.4, 0.1, col); g.box(0, 1.2, -1.2, 1.2, 0.3, 1.2, 0xe0c060); }
  else { g.box(0, 1.15, 0, 1.9, 1.6, 4.4, col); g.box(0, 1.5, 2.21, 1.6, 0.6, 0.05, glass); for (const s of [-1, 1]) { g.box(s * 0.96, 1.5, 1.4, 0.04, 0.6, 1.0, glass); g.box(s * 0.96, 1.0, -0.4, 0.04, 0.35, 2.6, 0x3f7fd6); } }
  const L = style === 'hatch' ? 1.2 : style === 'pickup' ? 1.5 : 1.4;
  for (const s of [-1, 1]) { wheel(g, s * 0.92, 0.38, L, 0.38); wheel(g, s * 0.92, 0.38, -L, 0.38); const f = style === 'hatch' ? 1.96 : style === 'pickup' ? 2.31 : 2.21; g.box(s * 0.6, 0.78, f, 0.34, 0.2, 0.04, 0xfff3c0); g.box(s * 0.6, 0.78, -f, 0.34, 0.18, 0.04, 0xd94040); }
  return g.build();
}
/* freight stock and the tram: plain colour bands, invented livery, no lettering or logos */
function railcarGeo(loco, col) {
  const g = new Geo(), cream = 0xf4ead8, dark = 0x2a2c30;
  g.box(0, 0.75, 0, 2.4, 0.5, 12, dark);
  if (loco) { g.box(0, 2.3, -1.5, 2.6, 2.6, 8, col); g.box(0, 3.0, 4, 2.7, 3.4, 3, col); g.box(0, 3.6, 5.52, 2.2, 1.0, 0.06, 0x2c3a48); for (const s of [-1, 1]) g.box(s * 1.36, 3.6, 4, 0.04, 1.0, 1.8, 0x2c3a48); g.box(0, 2.3, -1.5, 2.66, 0.5, 8.04, cream); g.cyl(0, 3.6, -3.5, 0.4, 0.5, 0.8, 8, dark); g.box(0, 1.25, 5.56, 2.2, 0.34, 0.14, 0xf0c040); for (const s of [-0.7, 0.7]) g.box(s, 2.1, 5.52, 0.3, 0.3, 0.06, 0xfff3c0); }
  else { g.box(0, 2.6, 0, 2.6, 3.2, 11.4, col); g.box(0, 2.6, 0, 2.66, 0.5, 11.44, cream); for (const s of [-1, 1]) g.box(s * 1.32, 2.4, 0, 0.06, 2.4, 2.6, 0x5a5f66); }
  for (const t of [-4, 4]) for (const s of [-1, 1]) wheel(g, s * 0.82, 0.5, t, 0.5, 0.2);
  return g.build();
}
function tramGeo() {
  const g = new Geo(), teal = 0x3f8f8a, cream = 0xf4ead8, glass = 0x2c3a48;
  g.box(0, 0.45, 0, 2.5, 0.3, 10.4, 0x2a2c30); g.box(0, 0.72, 0, 2.6, 0.24, 10.2, teal);
  for (const e of [-1, 1]) { g.box(0, 1.5, e * 3.5, 2.6, 1.3, 3.2, teal); g.box(0, 2.55, e * 3.5, 2.6, 0.8, 3.2, cream); g.box(0, 2.5, e * 5.11, 2.1, 0.8, 0.05, glass); for (const s of [-1, 1]) g.box(s * 1.31, 2.5, e * 3.5, 0.04, 0.7, 2.6, glass); g.box(0, 1.2, e * 5.12, 1.2, 0.28, 0.06, 0xfff3c0); }
  /* open middle platform: KC rides here where everyone can see her */
  for (const s of [-1, 1]) for (const e of [-1, 1]) g.box(s * 1.22, 1.9, e * 1.85, 0.12, 2.1, 0.12, cream); for (const s of [-1, 1]) g.box(s * 1.24, 1.45, 0, 0.06, 0.08, 3.6, 0xf0c040);
  g.box(0, 3.02, 0, 2.7, 0.16, 10.3, cream, 0x5fa39d); g.box(0, 3.3, 0, 0.5, 0.4, 1.6, 0x5a5f66);
  for (const t of [-3.4, 3.4]) for (const s of [-1, 1]) wheel(g, s * 0.82, 0.36, t, 0.36, 0.2);
  return g.build();
}
const SKINS = {
  skateboard: { primary: 0xf08a2a, secondary: 0x3f7fd6 },
  canoe: { primary: 0xd9534f, secondary: 0xf4ead8 },
  van: { primary: 0x4fb0a8, secondary: 0xf7f1e0 }
};
function rideGeo(kind, skin) {
  const g = new Geo(), a = skin.primary, b = skin.secondary;
  if (kind === 'skateboard') {
    g.box(0, 0.16, 0, 0.5, 0.05, 1.35, a); g.box(0, 0.19, 0, 0.12, 0.012, 1.3, b); g.tf(0, 0, 0, -0.35, 0, 0); g.box(0, 0.42, 0.66, 0.5, 0.05, 0.3, a); g.tf(0, 0, 0, 0.35, 0, 0); g.box(0, 0.42, -0.66, 0.5, 0.05, 0.3, a); g.notf();
    for (const z of [0.45, -0.45]) { g.box(0, 0.1, z, 0.42, 0.05, 0.08, 0x9a9aa0); for (const s of [-1, 1]) wheel(g, s * 0.24, 0.07, z, 0.07, 0.07); }
  } else if (kind === 'canoe') {
    const sec = [[-2.3, 0.02, 0.5], [-1.5, 0.42, 0.42], [0, 0.56, 0.4], [1.5, 0.42, 0.42], [2.3, 0.02, 0.5]];
    for (let i = 0; i < sec.length - 1; i++) { const [z0, w0, h0] = sec[i], [z1, w1, h1] = sec[i + 1];
      g.quad([-w0, h0, z0], [-w1, h1, z1], [-w1 * 0.5, -0.12, z1], [-w0 * 0.5, -0.12, z0], a, [0, 0.3, 0]); g.quad([w0, h0, z0], [w1, h1, z1], [w1 * 0.5, -0.12, z1], [w0 * 0.5, -0.12, z0], a, [0, 0.3, 0]);
      g.quad([-w0 * 0.5, -0.12, z0], [-w1 * 0.5, -0.12, z1], [w1 * 0.5, -0.12, z1], [w0 * 0.5, -0.12, z0], a, [0, 0.3, 0]);
      g.quad([-w0 * 0.9, h0 - 0.04, z0], [-w1 * 0.9, h1 - 0.04, z1], [-w1 * 0.45, -0.06, z1], [-w0 * 0.45, -0.06, z0], b, [-9, 0.3, 0]); g.quad([w0 * 0.9, h0 - 0.04, z0], [w1 * 0.9, h1 - 0.04, z1], [w1 * 0.45, -0.06, z1], [w0 * 0.45, -0.06, z0], b, [9, 0.3, 0]);
      g.quad([-w0 * 0.45, -0.06, z0], [-w1 * 0.45, -0.06, z1], [w1 * 0.45, -0.06, z1], [w0 * 0.45, -0.06, z0], b, [0, -9, 0]); }
    g.box(0, 0.3, 0.9, 0.82, 0.04, 0.2, 0x9a6a42); g.box(0, 0.3, -0.9, 0.82, 0.04, 0.2, 0x9a6a42);
    g.tf(0.5, 0.42, -0.2, 0.2, 0.3, 1.2); g.cyl(0, -0.8, 0, 0.025, 0.025, 1.6, 4, 0x9a6a42); g.box(0, -0.95, 0, 0.16, 0.4, 0.03, 0x9a6a42); g.notf();
  } else {
    /* camper van: open cab so KC and her human are visible */
    g.box(0, 0.95, 0, 2.0, 0.9, 4.9, a); g.box(0, 1.42, 0, 2.04, 0.1, 4.94, b);
    g.box(0, 1.95, -1.05, 2.0, 1.1, 2.8, b); g.box(0, 2.56, -0.3, 2.06, 0.14, 4.4, b); g.box(0, 2.72, -0.9, 1.5, 0.22, 2.2, a);
    for (const s of [-1, 1]) { g.box(s * 0.95, 2.0, 2.05, 0.1, 1.1, 0.1, b); g.box(s * 0.95, 2.0, 0.42, 0.1, 1.1, 0.14, b); g.box(s * 1.01, 2.0, -1.1, 0.03, 0.55, 1.5, 0x2c3a48); g.box(s * 0.6, 1.0, 2.46, 0.36, 0.3, 0.04, 0xfff3c0); g.box(s * 0.6, 1.0, -2.46, 0.3, 0.22, 0.04, 0xd94040); wheel(g, s * 1.0, 0.45, 1.5, 0.45, 0.3); wheel(g, s * 1.0, 0.45, -1.5, 0.45, 0.3); }
    g.box(0, 1.55, 2.3, 1.9, 0.3, 0.3, a); g.box(0, 0.6, 2.5, 2.1, 0.16, 0.1, 0x9a9aa0); g.box(0, 0.6, -2.5, 2.1, 0.16, 0.1, 0x9a9aa0);
    g.box(-0.48, 1.45, 0.95, 0.75, 0.12, 0.7, 0x5a4a3a); g.box(0.48, 1.45, 0.95, 0.75, 0.12, 0.7, 0x5a4a3a); g.box(0, 1.85, 0.55, 1.8, 0.75, 0.1, 0x5a4a3a);
    g.tf(-0.48, 1.9, 1.75, 1.1, 0, 0); g.cyl(0, 0, 0, 0.22, 0.22, 0.05, 8, 0x2a2a2a); g.notf();
    /* her human at the wheel */
    g.box(-0.48, 1.85, 0.95, 0.42, 0.62, 0.26, 0xe07a5a); g.ball(-0.48, 2.3, 0.97, 0.15, 0.17, 0.155, 0xe0ac7e, 7, 5); g.ball(-0.48, 2.36, 0.94, 0.165, 0.14, 0.17, 0x5a3a20, 7, 4); g.box(-0.48, 2.2, 0.82, 0.26, 0.3, 0.08, 0x5a3a20);
    g.tf(-0.3, 2.0, 1.1, -1.2, 0, 0); g.cyl(0, 0, 0, 0.055, 0.05, 0.55, 5, 0xe07a5a); g.tf(-0.66, 2.0, 1.1, -1.2, 0, 0); g.cyl(0, 0, 0, 0.055, 0.05, 0.55, 5, 0xe07a5a); g.notf();
    g.box(-0.48, 1.56, 1.2, 0.36, 0.14, 0.5, 0x3a4a6a);
  }
  return g.build();
}
const CFG = {
  skateboard: { max: 13, acc: 8, turn: 3.4, r: 0.5, seat: [0, 0.2, -0.05], camY: 1.2, camDist: 0.6, label: 'Hop on the skateboard', name: 'Skateboard', land: true },
  canoe: { max: 7.5, acc: 4, turn: 2.0, r: 0.8, seat: [0, 0.02, 0.2], camY: 1.2, camDist: 1.5, label: 'Hop in the canoe', name: 'Canoe', water: true },
  van: { max: 19, acc: 6.5, turn: 1.7, r: 1.75, seat: [0.5, 1.12, 0.9], camY: 2.4, camDist: 4, label: 'Hop in the van', name: 'Camper van', land: true }
};

export function createVehicles(game) {
  const { world, bus, state, fx, kc, scene } = game, mat = dogMaterial();
  const V = { cars: [], rides: [], skins: JSON.parse(JSON.stringify(SKINS)) };
  const obstacles = [];

  /* ---------------- traffic ---------------- */
  function lanePath(center, closed) {
    const off = 2.1, out = [];
    const offset = (pts) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [p[0] + (-dz / l) * off, p[1] + (dx / l) * off]; });
    if (closed) { /* smooth through the join, then drop the duplicated first span so the loop closes cleanly */ const sm = smoothPath([...center, center[0], center[1]], 3); sm.length -= Math.max(1, Math.ceil(Math.hypot(center[1][0] - center[0][0], center[1][1] - center[0][1]) / 3)) + 1; return offset([...sm, sm[0]]).slice(0, -1); }
    const sm = smoothPath(center, 3); out.push(...offset(sm)); out.push(...offset(sm.slice().reverse())); return out;
  }
  for (const t of TRAFFIC) {
    let center; if (t.loop) center = t.pts; else { const r = ROADS.find(x => x.id === t.road); center = r.pts.slice(t.from || 0, (t.to ?? r.pts.length - 1) + 1); }
    const path = lanePath(center, !!t.loop), cum = [0]; for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const mesh = new THREE.Mesh(carGeo(t.style, t.col), mat); mesh.name = t.id; scene.add(mesh);
    const car = { id: t.id, mesh, path, cum, len: cum[cum.length - 1], s: (t.t0 || 0) * cum[cum.length - 1], seg: 0, speed: 0, max: 6 + (V.cars.length % 3) * 0.6, x: 0, z: 0, y: 0, yaw: 0, r: 1.5, blocked: 0, ignore: 0, honkT: 0, n: V.cars.length };
    place(car); car.y = world.heightAt(car.x, car.z); car.yaw = car.tyaw; V.cars.push(car);
  }
  function place(car) {
    car.s = ((car.s % car.len) + car.len) % car.len; let i = car.seg; if (car.cum[i] > car.s) i = 0; while (i < car.path.length - 1 && car.cum[i + 1] < car.s) i++; car.seg = i;
    const a = car.path[i], b = car.path[(i + 1) % car.path.length], f = (car.s - car.cum[i]) / Math.max(0.001, car.cum[i + 1] - car.cum[i]);
    car.x = lerp(a[0], b[0], f); car.z = lerp(a[1], b[1], f); car.tyaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  function updateCar(car, dt) {
    const fx_ = Math.sin(car.yaw), fz = Math.cos(car.yaw); let block = null, hard = false, byKC = false;
    if (car.ignore > 0) car.ignore -= dt;
    for (const o of obstacles) {
      if (o === car) continue; if (o.isCar && car.ignore > 0) continue;
      const dx = o.x - car.x, dz = o.z - car.z, f = dx * fx_ + dz * fz; if (f < -0.5 || f > 9 + car.speed) continue;
      const l = Math.abs(-dx * fz + dz * fx_), rr = (o.r || 0.4) + 1.25; if (l > rr) continue;
      block = o; if (f < 3.6 + (o.r || 0.4)) hard = true; if (o.isKC) byKC = true;
    }
    if (block) { car.speed = hard ? 0 : Math.max(0, car.speed - 14 * dt); car.blocked += dt; if (byKC && car.speed < 0.2) { car.honkT -= dt; if (car.blocked > 1.6 && car.honkT <= 0) { car.honkT = 5; game.audio.sfx('honk', { vol: 0.5 }); bus.emit('honk', { id: car.id }); } } if (block.isCar && car.blocked > 4 && car.n < block.n) car.ignore = 2.5; }
    else { car.blocked = 0; car.speed = Math.min(car.max, car.speed + 3 * dt); }
    car.s += car.speed * dt; place(car);
    car.yaw = lerpAngle(car.yaw, car.tyaw, damp(5, dt));
    const yf = world.groundAt(car.x + fx_ * 1.3, car.z + fz * 1.3, car.y + 0.5), yb = world.groundAt(car.x - fx_ * 1.3, car.z - fz * 1.3, car.y + 0.5);
    car.y = lerp(car.y, (yf + yb) / 2, damp(10, dt));
    car.mesh.visible = Math.hypot(kc.pos.x - car.x, kc.pos.z - car.z) < 190;
    car.mesh.position.set(car.x, car.y, car.z); car.mesh.rotation.set(-Math.atan2(yf - yb, 2.6), car.yaw, 0, 'YXZ');
    if (car.mesh.visible) fx.blob(car.x, car.y, car.z, 1.7);
    /* KC cannot walk through a car */
    if (!kc.ride) { const dx = kc.pos.x - car.x, dz = kc.pos.z - car.z, d = Math.hypot(dx, dz); if (d < 1.7 && d > 0.01 && Math.abs(kc.pos.y - car.y) < 1.4) { kc.pos.x = car.x + (dx / d) * 1.7; kc.pos.z = car.z + (dz / d) * 1.7; } }
  }

  /* ---------------- rideables ---------------- */
  for (const d of RIDEABLES) {
    const cfg = CFG[d.kind], home = { x: d.x, z: d.z, yaw: d.yaw };
    const mesh = new THREE.Mesh(rideGeo(d.kind, V.skins[d.kind]), mat); mesh.name = d.id; scene.add(mesh);
    const r = { id: d.id, kind: d.kind, cfg, mesh, home, x: home.x, z: home.z, y: 0, yaw: home.yaw, speed: 0, vy: 0, air: false, r: cfg.r, active: false, honkT: 0, roll: 0, pitch: 0, t: 0 };
    r.y = cfg.water ? WATER_Y : world.groundAt(r.x, r.z, 200); V.rides.push(r);
    game.api.addInteractable({ id: 'ride:' + r.id, getPos: () => r, r: d.kind === 'van' ? 3.6 : 2.4, label: cfg.label, icon: 'paw', prio: 5, enabled: () => !kc.ride && !kc.swimming || (!kc.ride && d.kind === 'canoe'), onInteract: () => V.enter(r.id) });
    syncMesh(r, 1);
  }
  function syncMesh(r, dt) {
    r.mesh.position.set(r.x, r.y, r.z); r.mesh.rotation.set(r.pitch, r.yaw, r.roll, 'YXZ');
  }
  const okLand = (x, z, y, van) => { const g = world.groundAt(x, z, y + 0.3); return g > WATER_Y - 0.3 && g - y < 0.9 && (!van || world.slopeAt(x, z) < 0.8); };
  const okWater = (x, z) => world.heightAt(x, z) < WATER_Y - 0.42;
  V.enter = id => {
    const r = V.rides.find(v => v.id === id) || (id === 'tram' ? tram : null); if (!r || kc.ride) return false;
    while (kc.carried.length && r.kind !== 'van' && r.kind !== 'tram') kc.drop();
    kc.ride = r; r.active = true; r.speed = 0; kc.sit = false; kc.vel.set(0, 0, 0); kc.swimming = false; kc.onGround = true; state.stats.rides++;
    game.audio.sfx(r.kind === 'van' || r.kind === 'tram' ? 'door' : 'pickup'); game.cam.manualT = 9;
    bus.emit('vehicleEnter', { id: r.id, kind: r.kind }); return true;
  };
  V.exit = (silent) => {
    const r = kc.ride; if (!r) return false;
    let px = r.x, pz = r.z, found = false;
    for (const rad of [r.r + 1.0, r.r + 2.2, r.r + 4, r.r + 6.5]) { for (let i = 0; i < 12 && !found; i++) { const a = r.yaw + Math.PI / 2 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (TAU / 12), x = r.x + Math.sin(a) * rad, z = r.z + Math.cos(a) * rad, g = world.groundAt(x, z, r.y + 1.2); if (g > WATER_Y - 0.3 && g - r.y < 1.6 && !world.blockedAt(x, z, g, 0.45)) { px = x; pz = z; found = true; } } if (found) break; }
    if (!found && r.cfg.water) { px = r.x + Math.cos(r.yaw) * 1.4; pz = r.z - Math.sin(r.yaw) * 1.4; }
    kc.ride = null; r.active = false; r.speed = 0;
    kc.pos.x = px; kc.pos.z = pz; const g = world.groundAt(px, pz, r.y + 1.2); kc.pos.y = g > WATER_Y - 0.5 ? g : WATER_Y - 0.5; kc.vel.set(0, 0, 0); kc.onGround = g > WATER_Y - 0.5; kc.root.rotation.set(0, kc.yaw, 0);
    if (!silent) { game.audio.sfx(r.kind === 'van' ? 'door' : 'jump'); bus.emit('vehicleExit', { id: r.id, kind: r.kind, x: r.x, z: r.z }); }
    return true;
  };
  /* rides stay where they were left: positions of moved rides are saved (state.rides) and restored if the spot is still sound */
  for (const r of V.rides) { const sv = state.rides && state.rides[r.id]; if (!sv || !Number.isFinite(sv.x) || !Number.isFinite(sv.z)) continue;
    const g = world.groundAt(sv.x, sv.z, 200), ok = r.cfg.water ? okWater(sv.x, sv.z) : world.heightAt(sv.x, sv.z) > WATER_Y + 0.15 || g > WATER_Y + 0.5;
    if (ok && Math.abs(sv.x) < HALF - 4 && Math.abs(sv.z) < HALF - 4) { r.x = sv.x; r.z = sv.z; r.yaw = Number.isFinite(sv.yaw) ? sv.yaw : r.home.yaw; r.y = r.cfg.water ? WATER_Y : g; syncMesh(r, 1); } }
  bus.on('beforeSave', s => { s.rides = {}; for (const r of V.rides) if (Math.hypot(r.x - r.home.x, r.z - r.home.z) > 1.5) s.rides[r.id] = { x: +r.x.toFixed(2), z: +r.z.toFixed(2), yaw: +r.yaw.toFixed(2) }; });
  V.setSkin = (kind, skin) => { V.skins[kind] = { ...V.skins[kind], ...skin }; for (const r of V.rides) if (r.kind === kind) { r.mesh.geometry.dispose(); r.mesh.geometry = rideGeo(kind, V.skins[kind]); } bus.emit('skinChanged', { kind, skin: V.skins[kind] }); };
  V.byId = id => V.rides.find(v => v.id === id);
  V.reset = id => { for (const r of V.rides) if ((!id || r.id === id) && kc.ride !== r) { r.x = r.home.x; r.z = r.home.z; r.yaw = r.home.yaw; r.y = r.cfg.water ? WATER_Y : world.groundAt(r.x, r.z, 200); r.speed = 0; syncMesh(r, 1); } };

  function updateRide(r, dt, input) {
    const cfg = r.cfg; r.t += dt;
    if (!r.active) {
      /* wander home if abandoned far from where it belongs */
      if (Math.hypot(r.x - r.home.x, r.z - r.home.z) > 60 && Math.hypot(kc.pos.x - r.x, kc.pos.z - r.z) > 130) V.reset(r.id);
      if (cfg.water) { r.y = WATER_Y + Math.sin(r.t * 1.6) * 0.03; r.roll = Math.sin(r.t * 1.1) * 0.03; }
      r.mesh.visible = Math.hypot(kc.pos.x - r.x, kc.pos.z - r.z) < 170; if (r.mesh.visible) { syncMesh(r, dt); if (!cfg.water) fx.blob(r.x, r.y, r.z, cfg.r * 1.1); }
      if (r.kind === 'van' && !kc.ride) { let dx = kc.pos.x - r.x, dz = kc.pos.z - r.z, d = Math.hypot(dx, dz); if (d <= 0.01) { dx = Math.cos(r.yaw); dz = -Math.sin(r.yaw); d = 1; } if (d < 2.1 && Math.abs(kc.pos.y - r.y) < 1.5) { kc.pos.x = r.x + (dx / d) * 2.1; kc.pos.z = r.z + (dz / d) * 2.1; } }
      return;
    }
    const cy = game.cam.yaw, sy = Math.sin(cy), cc = Math.cos(cy), mx = input.moveX, my = input.moveY, mag = Math.min(1, Math.hypot(mx, my));
    let target = 0, turnTo = r.yaw;
    if (mag > 0.12) { const want = Math.atan2(sy * my - cc * mx, cc * my + sy * mx), diff = angDiff(r.yaw, want);
      if (r.kind === 'van' && Math.abs(diff) > 2.3 && r.speed < 1.5) { target = -4.5 * mag; turnTo = want + Math.PI; }
      else { turnTo = want; target = cfg.max * mag * (Math.abs(diff) > 1.6 ? 0.35 : 1); } }
    const surf = world.surfaceAt(r.x, r.z);
    if (r.kind === 'skateboard') target *= surf === 1 || surf === 2 || surf === 5 ? 1 : world.groundAt(r.x, r.z, r.y + 0.3) > world.heightAt(r.x, r.z) + 0.1 ? 1 : 0.62;
    /* the van is a road vehicle: fine on asphalt and bridge decks, slow on gravel and paving, crawling on grass and sand */
    if (r.kind === 'van') target *= surf === 1 || world.groundAt(r.x, r.z, r.y + 0.3) > world.heightAt(r.x, r.z) + 0.1 ? 1 : surf === 2 || surf === 5 ? 0.7 : 0.32;
    /* nobody gets bumped: brake for anyone in front and let them step aside */
    if (cfg.land && Math.abs(r.speed) > 0.3) {
      const s = Math.sign(r.speed), fxx = Math.sin(r.yaw) * s, fzz = Math.cos(r.yaw) * s;
      for (const o of obstacles) { if (o.isKC || o === r) continue; const dx = o.x - r.x, dz = o.z - r.z, f = dx * fxx + dz * fzz; if (f < 0 || f > cfg.r + 2.6 + Math.abs(r.speed) * 0.45) continue; if (Math.abs(-dx * fzz + dz * fxx) > cfg.r + (o.r || 0.4) + 0.35) continue;
        target = 0; r.speed *= Math.max(0, 1 - dt * 14); if (f < cfg.r + (o.r || 0.4) + 0.8) r.speed = 0; r.honkT -= dt; if (r.honkT <= 0) { r.honkT = 2.2; if (r.kind === 'van') game.audio.sfx('honk', { vol: 0.6 }); bus.emit('honk', { id: r.id }); game.npcs.stepAside(o, r, { x: fxx, z: fzz }); } break; }
    }
    r.speed = lerp(r.speed, target, damp(Math.abs(target) < Math.abs(r.speed) ? cfg.acc * 0.5 : cfg.acc * 0.22, dt));
    const steer = r.kind === 'van' ? clamp(Math.abs(r.speed) / 3, 0, 1) : clamp(0.45 + Math.abs(r.speed) / 4, 0, 1), dyaw = clamp(angDiff(r.yaw, turnTo), -cfg.turn * dt, cfg.turn * dt) * steer * (mag > 0.12 ? 1 : 0);
    r.yaw += dyaw;
    const nx = r.x + Math.sin(r.yaw) * r.speed * dt, nz = r.z + Math.cos(r.yaw) * r.speed * dt, pos = { x: nx, z: nz };
    const hit = world.resolve(pos, cfg.r, r.y, r.kind === 'van' ? 2.4 : 1.0); if (hit) r.speed *= Math.max(0, 1 - dt * 6);
    pos.x = clamp(pos.x, -HALF + 4, HALF - 4); pos.z = clamp(pos.z, -HALF + 4, HALF - 4);
    const ok = (x, z) => (cfg.water ? okWater(x, z) && okWater(x + Math.sin(r.yaw) * 1.2 * Math.sign(r.speed || 1), z + Math.cos(r.yaw) * 1.2 * Math.sign(r.speed || 1)) : okLand(x, z, r.y, r.kind === 'van'));
    if (ok(pos.x, pos.z)) { r.x = pos.x; r.z = pos.z; } else if (ok(pos.x, r.z)) { r.x = pos.x; r.speed *= 0.9; } else if (ok(r.x, pos.z)) { r.z = pos.z; r.speed *= 0.9; } else r.speed *= 0.5;
    if (cfg.water) { r.y = WATER_Y + Math.sin(r.t * 1.8) * 0.03; r.roll = lerp(r.roll, -dyaw / dt * 0.05 + Math.sin(r.t * 1.3) * 0.03, damp(4, dt)); r.pitch = 0; if (Math.abs(r.speed) > 1.5 && Math.random() < dt * 9) fx.burst('water', r.x - Math.sin(r.yaw) * 2, WATER_Y, r.z - Math.cos(r.yaw) * 2, 1, { up: 0.7, sp: 0.5 }); }
    else {
      const g = world.groundAt(r.x, r.z, r.y + 0.35);
      if (r.kind === 'skateboard') {
        if (input.pressed.jump && !r.air) { r.vy = 6.2; r.air = true; game.audio.sfx('jump'); bus.emit('trick', { kind: 'ollie', id: r.id }); }
        if (r.air) { r.vy -= 20 * dt; r.y += r.vy * dt; if (r.y <= g) { r.y = g; r.air = false; r.vy = 0; fx.burst('dust', r.x, g, r.z, 3); } } else if (g < r.y - 0.4) { r.air = true; r.vy = 0; } else r.y = lerp(r.y, g, damp(22, dt));
        r.roll = lerp(r.roll, -dyaw / dt * 0.12, damp(8, dt)); if (Math.abs(r.speed) > 6 && !r.air && Math.random() < dt * 10) fx.burst('dust', r.x, r.y, r.z, 1);
      } else { r.y = lerp(r.y, g, damp(14, dt)); r.roll = lerp(r.roll, -dyaw / dt * 0.04 * clamp(r.speed / 8, 0, 1), damp(5, dt)); if (Math.abs(r.speed) > 5 && surf !== 1 && Math.random() < dt * 8) fx.burst('dust', r.x - Math.sin(r.yaw) * 2.2, r.y, r.z - Math.cos(r.yaw) * 2.2, 1); }
      const f = world.groundAt(r.x + Math.sin(r.yaw) * 1.3, r.z + Math.cos(r.yaw) * 1.3, r.y + 0.6), b = world.groundAt(r.x - Math.sin(r.yaw) * 1.3, r.z - Math.cos(r.yaw) * 1.3, r.y + 0.6);
      r.pitch = lerp(r.pitch, r.air ? -0.15 : clamp(-Math.atan2(f - b, 2.6), -0.5, 0.5), damp(8, dt)); fx.blob(r.x, g, r.z, cfg.r * 1.1);
    }
    state.stats.distance += Math.abs(r.speed) * dt;
    syncMesh(r, dt); r.mesh.visible = true;
    /* seat KC */
    const s = cfg.seat, sx = Math.sin(r.yaw), cz = Math.cos(r.yaw);
    kc.pos.set(r.x + cz * s[0] + sx * s[2], r.y + s[1], r.z - sx * s[0] + cz * s[2]); kc.yaw = r.yaw; kc.root.rotation.set(r.pitch, r.yaw, r.roll, 'YXZ'); kc.vel.set(0, 0, 0);
    if (r.kind === 'van') game.audio.engine(Math.abs(r.speed) / cfg.max);
  }

  /* ---------------- transit: the freight train and the Heron Line tram. Both stop for anyone on the track ---------------- */
  const railP = (() => { const pts = world.rail, cum = [0]; for (let i = 0; i < pts.length - 1; i++) cum.push(cum[i] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])); return { pts, cum, len: cum[cum.length - 1] }; })();
  const railAt = (s, out) => { const P = railP; s = clamp(s, 0, P.len); let i = out.i || 0; if (i > P.pts.length - 2 || P.cum[i] > s) i = 0; while (i < P.pts.length - 2 && P.cum[i + 1] < s) i++; out.i = i; const a = P.pts[i], b = P.pts[i + 1], f = (s - P.cum[i]) / Math.max(1e-6, P.cum[i + 1] - P.cum[i]); out.x = lerp(a[0], b[0], f); out.z = lerp(a[1], b[1], f); out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); return out; };
  const pushKC = (x, z, y, rad) => { if (kc.ride) return; const dx = kc.pos.x - x, dz = kc.pos.z - z, d = Math.hypot(dx, dz); if (d < rad && d > 0.01 && Math.abs(kc.pos.y - y) < 3.2) { kc.pos.x = x + (dx / d) * rad; kc.pos.z = z + (dz / d) * rad; } };
  /* is anyone (not part of `self`) within `rad` of a point? */
  const someoneAt = (x, z, rad, self) => { for (const o of obstacles) { if (o.owner === self || (o.isKC && kc.ride === self)) continue; if ((o.x - x) ** 2 + (o.z - z) ** 2 < (rad + (o.r || 0.4)) ** 2) return o; } return null; };
  const CARCOL = [0x4f8a84, 0xa8604a, 0x5f7f9f, 0x8a7a4a, 0x3f6f6a], tp = {};
  const train = { id: 'train', kind: 'train', name: 'Freight train', x: 0, z: 0, s: 0, dir: 1, speed: 0, wait: TRAIN.dwell * 0.4, honkT: 0, cars: [], circles: [] };
  train.sMin = TRAIN.from + TRAIN.cars * TRAIN.gap; train.sMax = railP.len - TRAIN.endPad; train.s = train.sMin + (train.sMax - train.sMin) * 0.62;
  for (let i = 0; i < TRAIN.cars; i++) { const mesh = new THREE.Mesh(railcarGeo(i === 0, CARCOL[i % CARCOL.length]), mat); mesh.name = 'train-' + i; scene.add(mesh); const car = { mesh, x: 0, z: 0, y: 0, yaw: 0, i: 0 }; train.cars.push(car); for (const t of [-4, 0, 4]) train.circles.push({ car, t, x: 0, z: 0, r: 1.7, owner: train, isTrain: true }); }
  function placeTrain() {
    for (let i = 0; i < train.cars.length; i++) { const c = train.cars[i]; railAt(train.s - 6 - i * TRAIN.gap, c); c.y = world.heightAt(c.x, c.z) + 0.14; }
    for (const q of train.circles) { q.x = q.car.x + Math.sin(q.car.yaw) * q.t; q.z = q.car.z + Math.cos(q.car.yaw) * q.t; }
    train.x = train.cars[0].x; train.z = train.cars[0].z;
  }
  function updateTrain(dt) {
    const T = train;
    if (T.wait > 0) { T.wait -= dt; T.speed = 0; if (T.wait <= 0) T.dir = T.s > (T.sMin + T.sMax) / 2 ? -1 : 1; }
    else {
      const left = T.dir > 0 ? T.sMax - T.s : T.s - T.sMin, lead = T.dir > 0 ? T.s : T.s - TRAIN.cars * TRAIN.gap; let target = Math.min(TRAIN.speed, Math.sqrt(Math.max(0, 2 * 0.9 * left)) + 0.25), blocked = null;
      for (const a of [1.5, 5, 9, 13]) { railAt(lead + T.dir * a, tp); blocked = someoneAt(tp.x, tp.z, 2.0, T); if (blocked) break; }
      if (blocked) { target = 0; T.honkT -= dt; if (T.honkT <= 0 && T.speed < 0.5) { T.honkT = 6; if (Math.hypot(kc.pos.x - T.x, kc.pos.z - T.z) < 90) game.audio.sfx('honk', { vol: 0.5 }); bus.emit('honk', { id: 'train' }); } }
      T.speed += clamp(target - T.speed, -(blocked ? 9 : 2.4) * dt, 0.9 * dt); if (T.speed < 0) T.speed = 0;
      T.s = clamp(T.s + T.dir * T.speed * dt, T.sMin, T.sMax);
      if (left < 0.2) { T.speed = 0; T.wait = TRAIN.dwell; }
    }
    placeTrain(); const far = (world.viewFar || 200) + 30;
    for (const c of T.cars) { const vis = Math.hypot(kc.pos.x - c.x, kc.pos.z - c.z) < far; c.mesh.visible = vis; if (!vis) continue; const f = world.heightAt(c.x + Math.sin(c.yaw) * 4, c.z + Math.cos(c.yaw) * 4), b = world.heightAt(c.x - Math.sin(c.yaw) * 4, c.z - Math.cos(c.yaw) * 4); c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.set(-Math.atan2(f - b, 8), c.yaw, 0, 'YXZ'); }
    for (const q of T.circles) pushKC(q.x, q.z, q.car.y, 2.0);
  }
  /* the tram: a ride KC boards at a stop (kc.ride = tram); it drives itself */
  const tram = { id: TRAM.id, kind: 'tram', name: TRAM.name, cfg: { camY: 2.5, camDist: 5.5, r: 2.4, name: TRAM.name, max: TRAM.speed }, x: TRAM.stops[0].x, z: TRAM.z, y: 0, yaw: Math.PI / 2, dir: 1, speed: 0, wait: TRAM.dwell, r: 2.4, active: false, honkT: 0, at: 0, circles: [], home: { x: TRAM.stops[0].x, z: TRAM.z, yaw: Math.PI / 2 } };
  tram.y = world.groundAt(tram.x, tram.z, 60); tram.mesh = new THREE.Mesh(tramGeo(), mat); tram.mesh.name = 'tram'; scene.add(tram.mesh);
  for (const t of [-3.4, 0, 3.4]) tram.circles.push({ t, x: tram.x + t, z: tram.z, r: 1.7, owner: tram, isTram: true });
  game.api.addInteractable({ id: 'ride:tram', kind: 'ride', getPos: () => tram, r: 4.6, label: () => 'Ride the ' + TRAM.name + ' to ' + TRAM.stops[tram.at ? 0 : 1].name, icon: 'paw', prio: 5, enabled: () => !kc.ride && !kc.swimming && tram.speed < 0.6, onInteract: () => V.enter('tram') });
  function updateTram(dt) {
    const M = tram, to = TRAM.stops[M.dir > 0 ? 1 : 0].x;
    if (M.wait > 0) { M.wait -= dt; M.speed = 0; if (M.wait <= 0) { M.dir = M.at ? -1 : 1; if (M.active) game.audio.sfx('door'); } }
    else {
      const left = (to - M.x) * M.dir; let target = Math.min(TRAM.speed, Math.sqrt(Math.max(0, 2 * 1.3 * left)) + 0.25), blocked = null;
      for (const a of [6, 9, 12.5]) { blocked = someoneAt(M.x + M.dir * a, M.z, 1.25, M); if (blocked) break; }
      if (blocked) { target = 0; M.honkT -= dt; if (M.honkT <= 0 && M.speed < 0.5) { M.honkT = 5; if (Math.hypot(kc.pos.x - M.x, kc.pos.z - M.z) < 60) game.audio.sfx('ui'); bus.emit('honk', { id: 'tram' }); } }
      M.speed += clamp(target - M.speed, -(blocked ? 9 : 2.6) * dt, 1.3 * dt); if (M.speed < 0) M.speed = 0;
      M.x += M.dir * M.speed * dt;
      if (left < 0.15) { M.x = to; M.speed = 0; M.wait = TRAM.dwell; M.at = M.dir > 0 ? 1 : 0; bus.emit('tramStop', { stop: TRAM.stops[M.at].name, index: M.at, riding: M.active }); if (M.active) { game.audio.sfx('door'); game.ui.toast(TRAM.name + ': ' + TRAM.stops[M.at].name, { icon: 'flag' }); } }
    }
    M.yaw = M.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const g = world.groundAt(M.x, M.z, M.y + 1.2), f = world.groundAt(M.x + 3.4, M.z, M.y + 1.6), b = world.groundAt(M.x - 3.4, M.z, M.y + 1.6); M.y = lerp(M.y, Math.max(g, (f + b) / 2), damp(12, dt));
    for (const q of M.circles) { q.x = M.x + q.t; q.z = M.z; if (!M.active) pushKC(q.x, q.z, M.y, 1.9); }
    M.mesh.visible = Math.hypot(kc.pos.x - M.x, kc.pos.z - M.z) < (world.viewFar || 200) + 20;
    M.mesh.position.set(M.x, M.y, M.z); M.mesh.rotation.set(-Math.atan2(f - b, 6.8), Math.PI / 2, 0, 'YXZ');
    if (M.active) { kc.pos.set(M.x, M.y + 0.86, M.z); kc.yaw = M.yaw; kc.root.rotation.set(0, M.yaw, 0, 'YXZ'); kc.vel.set(0, 0, 0); state.stats.distance += M.speed * dt; }
  }
  V.transit = [train, tram]; V.train = train; V.tram = tram; placeTrain();

  const kcOb = { x: 0, z: 0, r: 0.5, isKC: true };
  V.update = (dt, input) => {
    obstacles.length = 0;
    kcOb.x = kc.pos.x; kcOb.z = kc.pos.z; kcOb.r = kc.ride ? kc.ride.r : 0.5; obstacles.push(kcOb);
    game.npcs.obstacles(obstacles);
    for (const c of V.cars) { c.isCar = true; obstacles.push(c); }
    for (const r of V.rides) if (!r.active && r.kind === 'van') obstacles.push(r);
    for (const q of train.circles) obstacles.push(q); for (const q of tram.circles) obstacles.push(q);
    for (const c of V.cars) updateCar(c, dt);
    for (const r of V.rides) updateRide(r, dt, input);
    updateTrain(dt); updateTram(dt);
    if (!kc.ride) game.audio.engine(0);
  };
  return V;
}
