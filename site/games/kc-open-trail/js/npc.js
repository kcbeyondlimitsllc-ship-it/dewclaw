/* Life along the river: townspeople who wave, chat and pet KC, other dogs
   that play, and wildlife that scatters. */
import { THREE, Geo, clamp, lerp, lerpAngle, angDiff, damp, rng, TAU, smoothPath } from './util.js';
import { PED_ROUTES, DOG_SPOTS, CRITTERS, CHATTER, WATER_Y, HALF } from './data.js';
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
  if (look.hat === 'cap') { g.ball(0, 1.76, 0, 0.165, 0.1, 0.17, look.hatCol, 7, 3); g.box(0, 1.74, 0.2, 0.2, 0.02, 0.14, look.hatCol); }
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
  const npcs = { peds: [], dogs: [], groups: [], standers: [], followers: [], maxFollowers: 2 };
  const hereY = (x, z, y) => world.groundAt(x, z, y + 0.4);

  /* ---------------- pedestrians ---------------- */
  function addPed(route, i, look, name) {
    const pts = route.loop ? smoothPath([...route.pts, route.pts[0]], 6) : smoothPath(route.pts, 6);
    const p = buildPerson(look), ped = { id: 'ped-' + npcs.peds.length, name, parts: p, pts, loop: !!route.loop, idx: Math.floor(R() * (pts.length - 1)), dir: R() < 0.5 ? 1 : -1, x: 0, z: 0, y: 0, yaw: 0, speed: 1.25 + R() * 0.5, state: 'walk', t: R() * 10, timer: 0, cool: 0, petCool: 0, side: (R() - 0.5) * 1.6, anim: 0, home: route };
    ped.x = pts[ped.idx][0]; ped.z = pts[ped.idx][1]; ped.y = world.heightAt(ped.x, ped.z); scene.add(p.root); npcs.peds.push(ped);
    game.api.addInteractable({ id: ped.id, getPos: () => ped, r: 2.4, label: () => 'Talk to ' + ped.name, icon: 'hand', prio: 2, enabled: () => ped.state !== 'pet' && ped.petCool <= 0 && !kc.ride && p.root.visible, onInteract: () => talk(ped) });
    return ped;
  }
  /* a short line of chat (by where they are walking), then a pat */
  function talk(ped) {
    const pool = [...(CHATTER[ped.home.where] || []), ...(CHATTER[ped.home.where] || []), ...CHATTER.any], line = pool[(ped.said = (ped.said ?? Math.floor(R() * pool.length)) + 1) % pool.length];
    game.ui.toast(ped.name + ': \u201c' + line + '\u201d', { icon: 'hand', ms: 4200 }); bus.emit('npcTalk', { id: ped.id, name: ped.name, line, where: ped.home.where }); pet(ped);
  }
  function pet(ped) {
    ped.state = 'pet'; ped.timer = 2.2; ped.petCool = 14; kc.petT = 2.4; kc.sit = true; state.stats.pets++;
    fx.burst('heart', kc.pos.x, kc.pos.y + 1.2, kc.pos.z, 7); game.audio.sfx('pet');
    bus.emit('npcPet', { id: ped.id, name: ped.name, x: ped.x, z: ped.z });
  }
  PED_ROUTES.forEach((r, ri) => { for (let i = 0; i < r.n; i++) { const over = r.hiker ? { pack: true, hat: R() < 0.6 ? 'cap' : null, packCol: SHIRT[Math.floor(R() * SHIRT.length)] } : r.farmer ? { hat: 'straw', shirt: 0x3f7fd6, pants: 0x3a4a6a } : r.worker ? { hat: 'cap', hatCol: 0xf0c040, shirt: 0xf08a2a, pants: 0x3a4a6a } : r.beach ? { pants: [0xf08a2a, 0x3f9fd6, 0xd9534f][i % 3] } : {}; addPed(r, i, randomLook(R, over), NAMES[npcs.peds.length % NAMES.length]); } });

  function updatePed(ped, dt) {
    const p = ped.parts, dx = kc.pos.x - ped.x, dz = kc.pos.z - ped.z, dk = Math.hypot(dx, dz);
    if (dk > 170) { p.root.visible = false; return; }     /* far away: frozen until KC comes near */
    p.root.visible = dk < 95;
    ped.t += dt; if (ped.cool > 0) ped.cool -= dt; if (ped.petCool > 0) ped.petCool -= dt;
    let moving = false;
    if (ped.state === 'walk') {
      if (dk < 4.2 && ped.cool <= 0 && kc.speed < 8 && !kc.swimming && Math.abs(kc.pos.y - ped.y) < 2) { ped.state = 'greet'; ped.timer = 2.4; ped.cool = 16; bus.emit('npcWave', { id: ped.id, name: ped.name }); }
      else if (kc.sit && dk < 2.8 && ped.petCool <= 0 && !kc.ride) pet(ped);
      else {
        const tgt = ped.pts[ped.idx], tx = tgt[0], tz = tgt[1], ex = tx - ped.x, ez = tz - ped.z, d = Math.hypot(ex, ez);
        if (d < 0.6) { ped.idx += ped.dir; if (ped.idx >= ped.pts.length || ped.idx < 0) { if (ped.loop) ped.idx = ped.idx < 0 ? ped.pts.length - 2 : 1; else { ped.dir *= -1; ped.idx += ped.dir * 2; } } }
        else {
          /* look before stepping out: wait for any moving car (or ridden van / board) about to pass */
          let wait = false; const ax = ped.x + (ex / d) * 1.6, az = ped.z + (ez / d) * 1.6;
          for (const c of game.vehicles.cars) if (c.speed > 0.8 && (c.x - ax) ** 2 + (c.z - az) ** 2 < 12) { wait = true; break; }
          const rd = kc.ride; if (rd && !rd.cfg.water && Math.abs(rd.speed) > 1.5 && (rd.x - ax) ** 2 + (rd.z - az) ** 2 < 10) wait = true;
          if (!wait) { const step = ped.speed * dt; ped.x += (ex / d) * step; ped.z += (ez / d) * step; moving = true; }
          ped.yaw = lerpAngle(ped.yaw, Math.atan2(ex, ez), damp(6, dt));
        }
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
  npcs.obstacles = out => { for (const p of npcs.peds) if (p.parts.root.visible) out.push(p); for (const p of npcs.standers) if (p.parts.root.visible) out.push(p); for (const d of npcs.dogs) if (!(d.follow && kc.ride)) out.push(d); for (const g of npcs.groups) if (g.active && (g.kind === 'chicken' || g.kind === 'sheep')) for (const c of g.items) out.push(c); return out; };
  npcs.stepAside = (o, fx_, fz) => { if (!o.parts || !o.pts || o.state === 'pet') return; o.state = 'aside'; o.timer = 1.1; const s = ((o.x - fx_.x) * -fz.z + (o.z - fx_.z) * fz.x) > 0 ? 1 : -1; o.ax = -fz.z * s; o.az = fz.x * s; };

  /* ---------------- other dogs ---------------- */
  function makeDog(s, id) {
    const parts = buildDog({ coat: s.coat, shade: s.coat, belly: s.belly, ear: s.ear, tailTip: s.belly, nose: 0x2a2020, eye: 0x1a1210, tongue: 0xff8fa3 }, { scale: 1.15 * s.s, gear: false });
    const collar = new Geo(); collar.tf(0, 0.715, 0.375, Math.PI / 2 - 0.55, 0, 0); collar.cyl(0, -0.028, 0, 0.152, 0.152, 0.056, 8, [0xd9534f, 0x4fae6f, 0xf0c040, 0x9a6fd0, 0xf08a2a][npcs.dogs.length % 5]); parts.body.add(new THREE.Mesh(collar.build(), dogMaterial()));
    const d = { id: id || 'dog-' + s.name.toLowerCase(), name: s.name, parts, home: s, x: s.x, z: s.z, y: world.heightAt(s.x, s.z), yaw: R() * TAU, tx: s.x, tz: s.z, speed: 0, wait: R() * 3, t: R() * 9, phase: 0, bark: 0, barkIn: 0, playCool: 0, playing: false, orbit: R() * TAU };
    scene.add(parts.root); npcs.dogs.push(d); return d;
  }
  for (const s of DOG_SPOTS) makeDog(s);

  /* ---------------- followers: a dog that walks with KC (Trail Buddies, the Buddy Whistle, party treats, dog-walking jobs) ----------------
     npcs.addFollower({ dog: 'dog-biscuit' | 'Biscuit' }) borrows a town dog; { name, look: { coat, belly, ear, s } } makes a new one.
     Options: id, seconds (leaves by itself after that long), onLeave(reason). Returns { id, name, dog, left(), dismiss() } or null (unknown dog / party full). */
  const nearDry = (x, z) => { for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 1.6 + i * 0.25, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = world.heightAt(px, pz); if (h > WATER_Y + 0.2 && !world.blockedAt(px, pz, h, 0.4)) return [px, pz]; } return [x, z]; };
  npcs.addFollower = (o = {}) => {
    let d = null, own = false;
    if (o.dog) { const key = String(o.dog).toLowerCase(); d = npcs.dogs.find(x => x.id === key || x.name.toLowerCase() === key); if (!d) return null; }
    if (d && d.follow) return d.follow.handle;
    if (npcs.followers.length >= npcs.maxFollowers) return null;
    if (!d) { const L = o.look || {}, [px, pz] = nearDry(kc.pos.x, kc.pos.z); own = true;
      d = makeDog({ name: o.name || 'Buddy', x: px, z: pz, r: 6, s: L.s || 0.9, coat: L.coat ?? 0xc9a67a, belly: L.belly ?? 0xf4ead8, ear: L.ear ?? 0x8a6a42 }, o.id || 'buddy-' + Math.random().toString(36).slice(2, 8)); }
    const f = { id: o.id || d.id, own, left: Number.isFinite(o.seconds) && o.seconds > 0 ? o.seconds : Infinity, onLeave: o.onLeave, data: o.data };
    f.handle = { id: f.id, name: d.name, dog: d, left: () => f.left, dismiss: () => npcs.removeFollower(f.id, 'dismissed') };
    d.follow = f; d.returning = false; d.playing = false; npcs.followers.push(d);
    fx.burst('heart', d.x, d.y + 1, d.z, 5); bus.emit('followerJoin', { id: f.id, name: d.name, dog: d.id, count: npcs.followers.length });
    return f.handle;
  };
  /* npcs.removeFollower(id?) : one follower by id (its own id, the dog id or the dog's name), or all of them with no id */
  npcs.removeFollower = (id, reason = 'dismissed') => {
    const key = id == null ? null : String(id).toLowerCase(); let n = 0;
    for (const d of [...npcs.followers]) { const f = d.follow; if (key != null && f.id !== id && d.id !== key && d.name.toLowerCase() !== key) continue;
      npcs.followers.splice(npcs.followers.indexOf(d), 1); d.follow = null; n++;
      if (f.own) { fx.burst('spark', d.x, d.y + 0.8, d.z, 8); scene.remove(d.parts.root); d.parts.root.traverse(m => { if (m.geometry) m.geometry.dispose(); }); const i = npcs.dogs.indexOf(d); if (i >= 0) npcs.dogs.splice(i, 1); }
      else { d.returning = true; d.wait = 0; }
      bus.emit('followerLeave', { id: f.id, name: d.name, dog: d.id, reason, count: npcs.followers.length }); if (f.onLeave) try { f.onLeave(reason); } catch (e) { console.error(e); } }
    return n;
  };
  function updateFollower(d, dt) {
    const f = d.follow, i = npcs.followers.indexOf(d), ride = kc.ride, bx = ride ? ride.x : kc.pos.x, bz = ride ? ride.z : kc.pos.z, byaw = ride ? ride.yaw : kc.yaw;
    if (f.left !== Infinity && (f.left -= dt) <= 0) { npcs.removeFollower(f.id, 'timeout'); return; }
    d.t += dt; if (d.bark > 0) d.bark -= dt; if (d.barkIn > 0) { d.barkIn -= dt; if (d.barkIn <= 0) { d.bark = 0.35; game.audio.sfx('bark', { pitch: 0.75 + d.home.s * 0.35, vol: 0.5 }); } }
    const back = (ride ? ride.r + 1.6 : 1.7) + i * 0.9, side = (i % 2 ? 1 : -1) * (0.9 + i * 0.3);
    d.tx = bx - Math.sin(byaw) * back + Math.cos(byaw) * side; d.tz = bz - Math.cos(byaw) * back - Math.sin(byaw) * side;
    let ex = d.tx - d.x, ez = d.tz - d.z, dist = Math.hypot(ex, ez); const dk = Math.hypot(bx - d.x, bz - d.z), lead = ride ? Math.abs(ride.speed) : kc.speed;
    /* left far behind (a teleport, a fast ride): she catches up out of sight */
    if (dk > 48 || !Number.isFinite(dist)) { const [px, pz] = nearDry(d.tx, d.tz); d.x = px; d.z = pz; d.y = hereY(px, pz, kc.pos.y); d.speed = 0; ex = ez = dist = 0; }
    const want = dist > 9 ? Math.max(12.5, lead + 3) : dist > 2.2 ? Math.max(4.5, lead + 1.2) : dist > 0.7 ? Math.max(1.6, lead * 0.9) : 0;
    if (dist > 0.7) { d.speed = lerp(d.speed, want, damp(6, dt)); const pos = { x: d.x + (ex / dist) * d.speed * dt, z: d.z + (ez / dist) * d.speed * dt }; world.resolve(pos, 0.35, d.y, 0.7); d.x = clamp(pos.x, -HALF + 3, HALF - 3); d.z = clamp(pos.z, -HALF + 3, HALF - 3); d.yaw = lerpAngle(d.yaw, Math.atan2(ex, ez), damp(9, dt)); d.phase += d.speed * dt * 3.4; }
    else { d.speed = lerp(d.speed, 0, damp(8, dt)); d.yaw = lerpAngle(d.yaw, byaw, damp(4, dt)); }
    const g = hereY(d.x, d.z, d.y), swim = g < WATER_Y - 0.6; d.y = lerp(d.y, swim ? WATER_Y - 0.5 : g, damp(14, dt));
    d.parts.root.visible = true; d.parts.root.position.set(d.x, d.y, d.z); d.parts.root.rotation.y = d.yaw;
    animateDog(d.parts, { t: d.t, speed: d.speed, phase: d.phase, bark: d.bark, swim, sit: !swim && kc.sit && d.speed < 0.4 && dist < 1.5, wag: 1, pant: d.speed > 9 }, dt);
    if (!swim) fx.blob(d.x, d.y, d.z, 0.5 * d.home.s);
  }
  function updateDog(d, dt) {
    if (d.follow) return updateFollower(d, dt);
    const dk = Math.hypot(kc.pos.x - d.x, kc.pos.z - d.z), hk = Math.hypot(kc.pos.x - d.home.x, kc.pos.z - d.home.z);
    /* a buddy sent home trots off, and is back on her own patch once KC is not looking */
    if (d.returning) { const hd = Math.hypot(d.home.x - d.x, d.home.z - d.z); if (hd < d.home.r) d.returning = false; else if (dk > 34) { d.x = d.home.x; d.z = d.home.z; d.y = world.heightAt(d.x, d.z); d.returning = false; d.speed = 0; } else { d.tx = d.home.x; d.tz = d.home.z; d.wait = 2; } }
    if (dk > 170) { d.parts.root.visible = false; return; }
    d.parts.root.visible = dk < 95; d.t += dt; if (d.bark > 0) d.bark -= dt; if (d.playCool > 0) d.playCool -= dt;
    if (d.barkIn > 0) { d.barkIn -= dt; if (d.barkIn <= 0) { d.bark = 0.35; if (dk < 40) game.audio.sfx('bark', { pitch: 0.75 + d.home.s * 0.35, vol: clamp(1 - dk / 40, 0.1, 0.7) }); } }
    const wantPlay = !d.returning && dk < 10 && hk < d.home.r * 2.2 && !kc.swimming && !kc.ride;
    if (wantPlay && !d.playing) { d.playing = true; if (d.playCool <= 0) { d.playCool = 40; fx.burst('spark', d.x, d.y + 0.8, d.z, 6); bus.emit('dogPlay', { id: d.id, name: d.name, x: d.x, z: d.z }); } }
    if (!wantPlay) d.playing = false;
    let want = 0;
    if (d.playing) { d.orbit += dt * (kc.speed > 2 ? 0.4 : 1.3); d.tx = kc.pos.x + Math.cos(d.orbit) * 2.6; d.tz = kc.pos.z + Math.sin(d.orbit) * 2.6; want = kc.speed > 5 ? 8.5 : 5; }
    else { d.wait -= dt; if (d.wait <= 0) { const a = R() * TAU, r = R() * d.home.r; d.tx = d.home.x + Math.cos(a) * r; d.tz = d.home.z + Math.sin(a) * r; d.wait = 3 + R() * 5; } want = d.returning ? 7 : 2.6; }
    const ex = d.tx - d.x, ez = d.tz - d.z, dist = Math.hypot(ex, ez);
    if (dist > 0.5) { d.speed = lerp(d.speed, want, damp(5, dt)); const nx = d.x + (ex / dist) * d.speed * dt, nz = d.z + (ez / dist) * d.speed * dt; const pos = { x: nx, z: nz }; world.resolve(pos, 0.35, d.y, 0.7); if (world.heightAt(pos.x, pos.z) > WATER_Y - 0.2) { d.x = pos.x; d.z = pos.z; } else d.wait = 0; d.yaw = lerpAngle(d.yaw, Math.atan2(ex, ez), damp(8, dt)); d.phase += d.speed * dt * 3.4; }
    else { d.speed = lerp(d.speed, 0, damp(8, dt)); if (d.playing) d.yaw = lerpAngle(d.yaw, Math.atan2(kc.pos.x - d.x, kc.pos.z - d.z), damp(6, dt)); }
    d.y = lerp(d.y, hereY(d.x, d.z, d.y), damp(14, dt));
    if (!d.parts.root.visible) return;
    d.parts.root.position.set(d.x, d.y, d.z); d.parts.root.rotation.y = d.yaw;
    animateDog(d.parts, { t: d.t, speed: d.speed, phase: d.phase, bark: d.bark, wag: d.playing ? 1 : 0.2, pant: d.playing && d.speed < 0.5 }, dt);
    fx.blob(d.x, d.y, d.z, 0.5 * d.home.s);
  }
  bus.on('bark', e => { for (const d of npcs.dogs) if (Math.hypot(e.x - d.x, e.z - d.z) < 14) d.barkIn = 0.35 + Math.random() * 0.5; for (const p of npcs.standers) if (Math.hypot(e.x - p.x, e.z - p.z) < 14) p.heardBark = game.time; for (const g of npcs.groups) if (Math.hypot(e.x - g.x, e.z - g.z) < g.r + 13) spook(g, e.x, e.z, true); });

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

  /* ---------------- standers: a person who waits in one place (shopkeepers, mission givers, lost children) ----------------
     npcs.addStander({ id, x, z, yaw, look, name, scale }) -> { id, name, x, z, yaw, walkTo(x, z, speed?, onArrive?), follow(on, gap?), wave(), remove() }
     They turn to face KC when she is close and wave once; give them a prompt with game.place.npc(...) or addInteractable({ getPos: () => stander }). */
  npcs.addStander = (o = {}) => {
    const look = o.look && o.look.skin != null ? o.look : randomLook(R, o.look || {}); if (o.scale) look.h = o.scale;
    const p = buildPerson(look), st = { id: o.id || 'npc-' + Math.random().toString(36).slice(2, 8), name: o.name || NAMES[npcs.standers.length % NAMES.length], parts: p, x: o.x, z: o.z, y: world.groundAt(o.x, o.z, 200), yaw: o.yaw || 0, yaw0: o.yaw || 0, t: R() * 9, anim: 0, waveT: 0, greeted: false, target: null, following: 0, speed: 0, r: 0.4 };
    p.root.position.set(st.x, st.y, st.z); p.root.rotation.y = st.yaw; scene.add(p.root); npcs.standers.push(st);
    st.walkTo = (x, z, speed = 1.6, onArrive) => { st.target = { x, z, speed, onArrive }; return st; };
    st.follow = (on = true, gap = 2.4) => { st.following = on ? gap : 0; if (!on) st.target = null; return st; };
    st.wave = () => { st.waveT = 2.2; return st; };
    st.remove = () => { const i = npcs.standers.indexOf(st); if (i < 0) return; npcs.standers.splice(i, 1); scene.remove(p.root); p.root.traverse(m => { if (m.geometry) m.geometry.dispose(); }); };
    return st;
  };
  function updateStander(st, dt) {
    const p = st.parts, dx = kc.pos.x - st.x, dz = kc.pos.z - st.z, dk = Math.hypot(dx, dz);
    if (dk > 170 && !st.target) { p.root.visible = false; return; }
    p.root.visible = dk < 95; st.t += dt; if (st.waveT > 0) st.waveT -= dt; let moving = false;
    if (st.following) st.target = dk > st.following ? { x: kc.pos.x, z: kc.pos.z, speed: Math.max(1.8, Math.min(5, kc.speed * 0.9)), stop: st.following } : null;
    if (st.target) { const tg = st.target, ex = tg.x - st.x, ez = tg.z - st.z, d = Math.hypot(ex, ez);
      if (d < (tg.stop || 0.4)) { st.target = null; if (tg.onArrive) try { tg.onArrive(st); } catch (e) { console.error(e); } }
      else { const pos = { x: st.x + (ex / d) * tg.speed * dt, z: st.z + (ez / d) * tg.speed * dt }; world.resolve(pos, 0.3, st.y, 1.2); if (world.heightAt(pos.x, pos.z) > WATER_Y + 0.1 || world.groundAt(pos.x, pos.z, st.y + 0.5) > WATER_Y + 0.1) { st.x = pos.x; st.z = pos.z; } st.yaw = lerpAngle(st.yaw, Math.atan2(ex, ez), damp(7, dt)); st.speed = tg.speed; moving = true; } }
    else if (dk < 7) { st.yaw = lerpAngle(st.yaw, Math.atan2(dx, dz), damp(5, dt)); if (!st.greeted && dk < 5) { st.greeted = true; st.waveT = 2; } }
    else { st.yaw = lerpAngle(st.yaw, st.yaw0, damp(2, dt)); if (dk > 14) st.greeted = false; }
    st.y = lerp(st.y, hereY(st.x, st.z, st.y), damp(12, dt));
    if (!p.root.visible) return;
    p.root.position.set(st.x, st.y, st.z); p.root.rotation.y = st.yaw;
    const k = damp(12, dt); let ll = 0, lr = 0, al = Math.sin(st.t * 1.3) * 0.04, ar = -al, arz = 0;
    if (moving) { st.anim += dt * st.speed * 4.4; const sn = Math.sin(st.anim); ll = sn * 0.55; lr = -sn * 0.55; al = -sn * 0.4; ar = sn * 0.4; }
    if (st.waveT > 0) arz = 2.5 + Math.sin(st.t * 11) * 0.35;
    p.legL.rotation.x = lerp(p.legL.rotation.x, ll, k); p.legR.rotation.x = lerp(p.legR.rotation.x, lr, k); p.armL.rotation.x = lerp(p.armL.rotation.x, al, k); p.armR.rotation.x = lerp(p.armR.rotation.x, ar, k); p.armR.rotation.z = lerp(p.armR.rotation.z, arz, k);
    fx.blob(st.x, st.y, st.z, 0.42);
  }

  npcs.update = dt => { for (const p of npcs.peds) updatePed(p, dt); for (const p of [...npcs.standers]) updateStander(p, dt); for (const d of [...npcs.dogs]) updateDog(d, dt); for (const k in meshes) meshes[k].on = false; for (const g of npcs.groups) { updateGroup(g, dt); if (g.active) meshes[g.kind].on = true; } for (const k in meshes) meshes[k].mesh.visible = meshes[k].on; };
  npcs.addPed = (route, look, name) => addPed({ n: 1, ...route }, 0, look || randomLook(R), name || NAMES[npcs.peds.length % NAMES.length]);
  return npcs;
}
