/* Things to find: bones (currency, respawning), golden tennis balls (rare,
   fixed), dig spots, photo spots, signposts, the Old Fog Bell, and carriable items
   such as KC's orange-and-blue ball. Everything is placed from data. */
import { THREE, Geo, rng, TAU, clamp } from './util.js';
import { GOLDEN_BALLS, DIG_SPOTS, PHOTO_SPOTS, SIGNPOSTS, KC_COLORS, WATER_Y, SPAWN, HALF } from './data.js';
import { dogMaterial } from './kc.js';

export function createCollect(game) {
  const { world, bus, state, fx, kc, scene, api } = game, R = rng(8080), mat = dogMaterial();
  /* tunable by the economy agent */
  game.rewards = { bone: 1, goldenBall: { gems: 1, bones: 10 }, dig: [3, 8], photo: 5, sign: 2, fetch: 2, zone: 3, digCooldown: 240, boneRespawn: [100, 140], fetchPaid: 0, fetchWindow: 600 };   /* fetchPaid: how many fetches pay in each fetchWindow seconds of play (0 = every one) */
  const C = { bones: [], balls: [], digs: [], photos: PHOTO_SPOTS, items: new Map() };

  /* ---------- bones ---------- */
  const spots = [];
  const tryAdd = (x, z) => { if (Math.abs(x) > HALF - 8 || Math.abs(z) > HALF - 8) return;   /* KC cannot walk past the edge of the map */ const h = world.heightAt(x, z); if (h < WATER_Y + 0.3) return; if (world.blockedAt(x, z, h, 0.8)) return; for (const s of spots) if ((s[0] - x) ** 2 + (s[1] - z) ** 2 < 16) return; spots.push([x, z]); };
  for (const r of world.roads) { const step = r.kind === 'road' ? 7 : 5; for (let i = 2; i < r.path.length - 1; i += step) { const p = r.path[i], q = r.path[i + 1], nx = -(q[1] - p[1]), nz = q[0] - p[0], l = Math.hypot(nx, nz) || 1, side = (r.kind === 'road' ? r.w / 2 + 2.2 : (R() - 0.5) * 2) * (R() < 0.5 ? -1 : 1); tryAdd(p[0] + (nx / l) * side, p[1] + (nz / l) * side); } }
  for (const [cx, cz, rad, n] of [[-170, -250, 22, 10], [-150, -152, 26, 10], [-46, -298, 16, 8], [-46, -240, 12, 5], [-246, -132, 12, 5], [-152, -404, 14, 5], [-330, -438, 12, 6], [-386, -100, 30, 10], [-356, -10, 14, 4], [-272, 62, 16, 5], [90, 100, 28, 8], [2, 100, 26, 10], [-34, -92, 9, 4], [180, 56, 18, 6], [100, 250, 5, 4], [180, 288, 26, 8], [200, 352, 28, 9], [282, 430, 16, 6], [360, 440, 14, 7], [-50, 430, 24, 9], [50, 420, 30, 10], [46, 490, 14, 5], [-250, 452, 12, 5], [-230, 340, 30, 6]]) for (let i = 0; i < n * 3; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * rad; tryAdd(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr); }
  for (let i = 0; i < 260; i++) tryAdd((R() - 0.5) * (HALF * 2 - 30), (R() - 0.5) * (HALF * 2 - 30));
  { const g = new Geo(); g.tf(0, 0, 0, 0, 0, Math.PI / 2); g.cyl(0, -0.2, 0, 0.055, 0.055, 0.4, 5, 0xfff6e0, null, 1, 0); g.notf(); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.ball(sx * 0.22, sz * 0.055, 0, 0.078, 0.078, 0.072, 0xfff6e0, 4, 3);
    const m = new THREE.InstancedMesh(g.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x554422 }), spots.length); m.frustumCulled = false; m.name = 'bones'; scene.add(m); C.boneMesh = m; }
  spots.forEach((s, i) => C.bones.push({ id: 'bone-' + i, x: s[0], z: s[1], y: world.groundAt(s[0], s[1], 200) + 0.55, t: 0, ph: R() * TAU }));
  /* ---------- golden tennis balls ---------- */
  { const g = new Geo(); g.ball(0, 0, 0, 0.26, 0.26, 0.26, 0xffd23c, 8, 6); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, a2 = ((i + 1) / 10) * TAU; g.quad([Math.cos(a) * 0.265, 0.03 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.265], [Math.cos(a2) * 0.265, 0.03 + Math.sin(a2 * 2) * 0.08, Math.sin(a2) * 0.265], [Math.cos(a2) * 0.265, -0.03 + Math.sin(a2 * 2) * 0.08, Math.sin(a2) * 0.265], [Math.cos(a) * 0.265, -0.03 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.265], 0xfffbe0, [0, 0, 0]); }
    const m = new THREE.InstancedMesh(g.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x7a5a00 }), GOLDEN_BALLS.length); m.frustumCulled = false; m.name = 'goldenBalls'; scene.add(m); C.ballMesh = m; }
  GOLDEN_BALLS.forEach((b, i) => C.balls.push({ id: 'ball-' + i, x: b[0], z: b[1], y: Math.max(world.groundAt(b[0], b[1], 200), WATER_Y) + 0.8, got: false }));
  /* ---------- dig spots ---------- */
  { const g = new Geo(); g.ball(0, 0.02, 0, 0.75, 0.2, 0.75, 0x7a5a3a, 7, 3, true); g.box(0.2, 0.22, 0.1, 0.5, 0.05, 0.07, 0xc9a67a); g.tf(0, 0, 0, 0, 1.2, 0); g.box(-0.1, 0.22, 0.15, 0.5, 0.05, 0.07, 0xc9a67a); g.notf();
    const m = new THREE.InstancedMesh(g.build(), mat, DIG_SPOTS.length); m.frustumCulled = false; m.name = 'digSpots'; scene.add(m); C.digMesh = m; }
  DIG_SPOTS.forEach((d, i) => { const s = { id: 'dig-' + i, x: d[0], z: d[1], y: world.heightAt(d[0], d[1]), t: 0 }; C.digs.push(s); api.addInteractable({ id: s.id, kind: 'digSpot', x: s.x, z: s.z, r: 2.2, label: 'Dig here', icon: 'dig', prio: 1, enabled: () => s.t <= 0 && !kc.ride && kc.dig <= 0, onInteract: () => kc.doDig() }); });
  /* ---------- photo spots: a chunky yellow camera on a short pale post, so it reads as a camera at phone size ---------- */
  { const g = new Geo(), Y = 0xffd23c, D = 0x2a2c30; g.cyl(0, 0, 0, 0.3, 0.34, 0.1, 8, 0xb8bcc2); g.cyl(0, 0.1, 0, 0.07, 0.09, 1.0, 6, 0xc9cdd2);
    g.box(0, 1.36, 0, 0.74, 0.5, 0.36, Y, 0xffe27a); g.box(-0.16, 1.67, 0, 0.26, 0.12, 0.2, Y); g.box(0.24, 1.65, 0, 0.12, 0.08, 0.1, 0xd9534f); g.box(0, 1.36, -0.19, 0.4, 0.26, 0.03, D);
    g.tf(0, 1.36, 0.18, Math.PI / 2, 0, 0); g.cyl(0, 0, 0, 0.19, 0.17, 0.16, 10, D); g.cyl(0, 0.16, 0, 0.13, 0.13, 0.02, 10, 0x8fc4e8); g.notf();
    const m = new THREE.InstancedMesh(g.build(), mat, PHOTO_SPOTS.length); m.frustumCulled = false; m.name = 'photoSpots'; scene.add(m); const m4 = new THREE.Matrix4();
    PHOTO_SPOTS.forEach((p, i) => { let x = p.x + 2.2, z = p.z + 1.5; for (const [ox, oz] of [[2.2, 1.5], [-2.2, -1.5], [2.2, -1.5], [-2.2, 1.5], [0, 3], [0, -3], [3.4, 0], [-3.4, 0]]) { const tx = p.x + ox, tz = p.z + oz, th = world.heightAt(tx, tz); if (th > WATER_Y + 0.2 && !world.blockedAt(tx, tz, th, 0.9) && world.groundAt(tx, tz, 200) < th + 0.05) { x = tx; z = tz; break; } } p.mx = x; p.mz = z; m4.makeRotationY(i); m4.setPosition(x, world.groundAt(x, z, 200), z); m.setMatrixAt(i, m4);
      api.addInteractable({ id: 'photo:' + p.id, kind: 'photoSpot', x, z, r: 2.6, label: 'Photo spot: ' + p.name, icon: 'camera', enabled: () => !(game.travel && game.travel.blocked) /* not while a mission is on: its own prompt (the bell, a giver) must win; the camera button still works */, onInteract: () => game.ui.photoMode(true) }); }); }
  bus.on('photoTaken', e => {
    for (const p of PHOTO_SPOTS) if (Math.hypot(kc.pos.x - p.x, kc.pos.z - p.z) < 14) { const first = !state.collected.photos.includes(p.id); if (first) { state.collected.photos.push(p.id); game.economy.grant({ bones: game.rewards.photo }, 'photo'); game.ui.toast(`Photo spot found: ${p.name}  +${game.rewards.photo} bones`, { icon: 'camera', kind: 'good' }); } bus.emit('pickup', { kind: 'photo', id: p.id, name: p.name, first, value: first ? game.rewards.photo : 0, x: p.x, z: p.z }); return; }
  });
  /* ---------- signposts ---------- */
  for (const s of SIGNPOSTS) api.addInteractable({ id: 'sign:' + s.id, kind: 'signpost', x: s.x, z: s.z, r: 2.6, label: 'Read the sign', icon: 'flag', onInteract: () => {
    const first = !state.collected.signs.includes(s.id); if (first) { state.collected.signs.push(s.id); game.economy.grant({ bones: game.rewards.sign }, 'sign'); }
    game.ui.openModal({ id: 'sign', title: s.title, html: `<p class="signtext">${s.text}</p>${first ? `<p class="reward">First read: +${game.rewards.sign} bones</p>` : ''}`, actions: [{ label: 'Woof!', primary: true }] });
    bus.emit('pickup', { kind: 'sign', id: s.id, first, value: first ? game.rewards.sign : 0, x: s.x, z: s.z });
  } });

  /* ---------- carriables ---------- */
  function makeMesh(kind) {
    const g = new Geo();
    if (kind === 'ball') { g.ball(0, 0, 0, 0.13, 0.13, 0.13, KC_COLORS.ballA, 8, 6); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, a2 = ((i + 1) / 8) * TAU; g.quad([Math.cos(a) * 0.133, 0.035, Math.sin(a) * 0.133], [Math.cos(a2) * 0.133, 0.035, Math.sin(a2) * 0.133], [Math.cos(a2) * 0.133, -0.035, Math.sin(a2) * 0.133], [Math.cos(a) * 0.133, -0.035, Math.sin(a) * 0.133], KC_COLORS.ballB, [0, 0, 0]); } }
    else if (kind === 'treat') { g.tf(0, 0, 0, 0, 0, Math.PI / 2); g.cyl(0, -0.2, 0, 0.055, 0.055, 0.4, 6, 0xb5553a); g.notf(); g.ball(-0.2, 0, 0, 0.055, 0.055, 0.055, 0xb5553a, 5, 3); g.ball(0.2, 0, 0, 0.055, 0.055, 0.055, 0xb5553a, 5, 3); }
    else if (kind === 'stick') { g.tf(0, 0, 0, 0, 0, Math.PI / 2); g.cyl(0, -0.35, 0, 0.03, 0.04, 0.7, 5, 0x8a6a42); g.notf(); }
    else { g.box(0, 0, 0, 0.26, 0.2, 0.2, 0xc9a67a); g.box(0, 0.0, 0, 0.28, 0.05, 0.22, 0xd9534f); }
    return new THREE.Mesh(g.build(), mat);
  }
  /* api.addCarriable({ id, kind: ball|treat|stick|parcel, label, x, z, mesh?, onUse?, useLabel? }) */
  api.addCarriable = o => {
    const it = { id: o.id || 'c' + Math.random().toString(36).slice(2), kind: o.kind || 'parcel', label: o.label || 'thing', mesh: o.mesh || makeMesh(o.kind || 'parcel'), x: o.x, z: o.z, y: 0, held: false, vx: 0, vy: 0, vz: 0, flying: false, scale: o.scale || 1, onUse: o.onUse, useLabel: o.useLabel, data: o.data, ownMesh: !o.mesh };
    it.y = (o.y ?? world.groundAt(it.x, it.z, 200)) + 0.14; it.mesh.position.set(it.x, it.y, it.z); scene.add(it.mesh); C.items.set(it.id, it);
    it.inter = api.addInteractable({ id: 'carry:' + it.id, kind: 'carriable', getPos: () => it, r: 2.0, label: () => (o.pickLabel || 'Pick up the ' + it.label), icon: 'paw', prio: 3, enabled: () => !it.held && !it.flying && !(it.hidden > 0) && !kc.ride && kc.carried.length < kc.capacity(), onInteract: () => { if (kc.carry(it)) { it.held = true; game.audio.sfx('pickup'); } } });
    it.remove = () => { if (it.held) { const i = kc.carried.indexOf(it); if (i >= 0) kc.carried.splice(i, 1); } if (it.mesh.parent) it.mesh.parent.remove(it.mesh); scene.remove(it.mesh); if (it.ownMesh) it.mesh.geometry.dispose(); it.held = false; it.inter.remove(); C.items.delete(it.id); };
    it.throwTo = (tx, tz) => { const d = Math.hypot(tx - it.x, tz - it.z) || 1, T = 1.1; it.vx = (tx - it.x) / T; it.vz = (tz - it.z) / T; it.vy = 6.5; it.y += 1.2; it.flying = true; it.thrown = true; };
    return it;
  };
  bus.on('drop', e => { const it = e.item; if (!it || !C.items.has(it.id)) return; it.held = false; it.x = e.x; it.z = e.z; it.y = Math.max(world.groundAt(e.x, e.z, kc.pos.y + 0.6), WATER_Y - 0.05) + 0.14; scene.add(it.mesh); it.mesh.position.set(it.x, it.y, it.z); it.mesh.scale.setScalar(it.scale); });
  bus.on('carry', e => { const it = e.item; if (it && it.thrown) { it.thrown = false; state.stats.fetches = (state.stats.fetches || 0) + 1; if (fetchT - fetchT0 >= (+game.rewards.fetchWindow || 600)) { fetchT0 = fetchT; fetchN = 0; } const cap = +game.rewards.fetchPaid || 0, value = !cap || fetchN < cap ? game.rewards.fetch : 0; fetchN++;
    if (value) game.economy.grant({ bones: value }, 'fetch'); fx.burst('spark', kc.pos.x, kc.pos.y + 0.8, kc.pos.z, 6); bus.emit('fetch', { id: it.id, value }); } });
  let fetchT = 0, fetchT0 = 0, fetchN = 0; bus.on('tick', e => { fetchT += e.dt; });
  C.ball = api.addCarriable({ id: 'kc-ball', kind: 'ball', label: 'ball', x: SPAWN.x + 5, z: SPAWN.z - 0.5 });
  /* a person KC drops her ball next to will throw it for her */
  bus.on('drop', e => { if (e.kind !== 'ball' && e.item?.kind !== 'ball') return; for (const p of game.npcs.peds) if (p.parts.root.visible && Math.hypot(p.x - e.x, p.z - e.z) < 3.4) { setTimeout(() => { const it = e.item; if (it.held || it.flying) return; for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, d = 11 + Math.random() * 7, tx = it.x + Math.sin(a) * d, tz = it.z + Math.cos(a) * d, h = world.heightAt(tx, tz); if (h > WATER_Y + 0.2 && !world.blockedAt(tx, tz, h, 1)) { it.throwTo(tx, tz); p.state = 'greet'; p.timer = 1.2; game.audio.sfx('jump'); game.ui.toast('Fetch!', { icon: 'ball' }); bus.emit('throw', { id: it.id, by: p.id }); break; } } }, 700); return; } });
  /* free treat samples on two counters: carry one off or eat it for a stamina top-up */
  for (const s of [{ id: 'cart', x: 270.3, z: 422, y: 1.34 }, { id: 'plaza', x: -182, z: -233.6, y: 1.34 }]) { const it = api.addCarriable({ id: 'treat-' + s.id, kind: 'treat', label: 'treat sample', pickLabel: 'Take a free treat sample', x: s.x, z: s.z, y: world.heightAt(s.x, s.z) + s.y - 0.14, useLabel: 'Eat the treat', scale: 1.2,
    onUse: item => { kc.drop(true); item.held = false; item.hidden = 150; item.mesh.visible = false; scene.add(item.mesh); if (item.home) { item.x = item.home.x; item.y = item.home.y; item.z = item.home.z; item.mesh.position.set(item.x, item.y, item.z); item.mesh.rotation.set(0, 0, 0); item.mesh.scale.setScalar(item.scale); } kc.stamina = kc.staminaMax; kc.exhausted = false; fx.burst('spark', kc.pos.x, kc.pos.y + 0.8, kc.pos.z, 8, { color: 0xffb070 }); game.audio.sfx('eat'); game.ui.toast('Yum! Stamina topped up.', { icon: 'bolt', kind: 'good' }); bus.emit('eat', { id: item.id, kind: 'treat' }); } }); it.home = { x: it.x, y: it.y, z: it.z }; }
  /* the Old Fog Bell: ring it (other modules can listen for 'fogBell' to start a timed run) */
  if (world.fogBell) { let cool = 0; bus.on('tick', e => { if (cool > 0) cool -= e.dt; }); api.addInteractable({ id: 'fogbell', kind: 'landmark', x: world.fogBell.x, z: world.fogBell.z, r: 3, label: 'Ring the Old Fog Bell', icon: 'bark', prio: 2, enabled: () => cool <= 0 && !kc.ride, onInteract: () => { cool = 4; game.audio.sfx('bell'); fx.burst('spark', world.fogBell.x, world.heightAt(world.fogBell.x, world.fogBell.z) + 1.6, world.fogBell.z - 1.8, 10, { color: 0xffd27a }); game.ui.toast('BONG! The Old Fog Bell rings out over the river.', { icon: 'bark' }); bus.emit('fogBell', { x: world.fogBell.x, z: world.fogBell.z }); } }); }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let t = 0, boneFrac = 0;
  state.collected.balls.forEach(id => { const b = C.balls.find(x => x.id === id); if (b) b.got = true; });
  C.refresh = () => { for (const b of C.balls) b.got = state.collected.balls.includes(b.id); };
  bus.on('dig', e => {
    for (const s of C.digs) if (s.t <= 0 && Math.hypot(e.x - s.x, e.z - s.z) < 2.4) { s.t = Math.max(1, +game.rewards.digCooldown || 240); const [lo, hi] = game.rewards.dig, v = Math.round((lo + Math.floor(Math.random() * (hi - lo + 1))) * kc.mods.bones); game.economy.grant({ bones: v }, 'dig'); fx.burst('spark', s.x, s.y + 0.4, s.z, 10); game.audio.sfx('reward'); game.ui.toast(`KC dug up ${v} bones!`, { icon: 'bone', kind: 'good' }); bus.emit('pickup', { kind: 'dig', id: s.id, value: v, x: s.x, z: s.z }); return; }
  });

  C.update = dt => {
    t += dt; const kx = kc.pos.x, kz = kc.pos.z, ky = kc.pos.y, rad = kc.base.magnet * kc.mods.magnet, pull = rad * (kc.mods.magnet > 1.05 ? 2.2 : 1.3) * (kc.mods.sniff || 1);
    const bm = C.boneMesh; let slot = 0;
    for (let i = 0; i < C.bones.length; i++) {
      const b = C.bones[i];
      if (b.t > 0) { b.t -= dt; if (b.t <= 0) { b.px = b.pz = undefined; } else continue; }
      const dx = kx - (b.px ?? b.x), dz = kz - (b.pz ?? b.z), d2 = dx * dx + dz * dz;
      if (d2 > 4900) continue;                      /* only bones within 70 units are drawn */
      let x = b.px ?? b.x, z = b.pz ?? b.z, y = b.y + Math.sin(t * 2.4 + b.ph) * 0.12;
      const d = Math.sqrt(d2);
      if (d < pull && Math.abs(ky + 0.5 - b.y) < 2.2) { const k = Math.min(1, dt * 9); x += dx * k; z += dz * k; b.px = x; b.pz = z; y = b.y + (ky + 0.6 - b.y) * 0.5; }
      if (Math.hypot(kx - x, kz - z) < Math.max(0.9, rad * 0.6) + (b.px != null ? 0.5 : 0) && Math.abs(ky + 0.5 - b.y) < 2.4) {
        { const rs = game.rewards.boneRespawn || [100, 140]; b.t = rs[0] + Math.random() * Math.max(0, rs[1] - rs[0]); }
        boneFrac += game.rewards.bone * kc.mods.bones; const v = Math.floor(boneFrac); boneFrac -= v; state.stats.bones += v;
        game.economy.grant({ bones: v }, 'pickup'); fx.burst('spark', x, y, z, 5); game.audio.sfx('pickup');
        bus.emit('pickup', { kind: 'bone', id: b.id, value: v, x: b.x, z: b.z }); continue;
      }
      e3.set(0.4, t * 1.8 + b.ph, 0); q.setFromEuler(e3); p3.set(x, y, z); s3.setScalar(1.4); m4.compose(p3, q, s3); bm.setMatrixAt(slot++, m4);
    }
    bm.count = slot; bm.instanceMatrix.needsUpdate = true;
    const gm = C.ballMesh;
    for (let i = 0; i < C.balls.length; i++) {
      const b = C.balls[i]; if (b.got) { if (!b.hid) { b.hid = true; gm.setMatrixAt(i, zero); gm.instanceMatrix.needsUpdate = true; } continue; } b.hid = false;
      const d = Math.hypot(kx - b.x, kz - b.z); if (d > 90 && b.placed) continue; b.placed = true;
      e3.set(0, t * 1.4 + i, 0.3); q.setFromEuler(e3); p3.set(b.x, b.y + Math.sin(t * 2 + i) * 0.18, b.z); s3.setScalar(1.25); m4.compose(p3, q, s3); gm.setMatrixAt(i, m4); gm.instanceMatrix.needsUpdate = true;
      if (d < 30 && Math.random() < dt * 3) fx.spawn(b.x + (Math.random() - 0.5) * 0.8, b.y + (Math.random() - 0.5) * 0.8, b.z + (Math.random() - 0.5) * 0.8, { color: 0xfff0a0, life: 0.7, size: 0.14, vy: 0.5 });
      if (d < 1.5 && Math.abs(ky + 0.5 - b.y) < 2.6) {
        b.got = true; state.collected.balls.push(b.id); state.stats.balls++; const rw = game.rewards.goldenBall;
        game.economy.grant({ gems: rw.gems, bones: rw.bones }, 'goldenBall'); fx.burst('spark', b.x, b.y, b.z, 22); game.audio.sfx('gold');
        game.ui.toast(`Golden tennis ball! ${state.collected.balls.length}/${C.balls.length}  +${rw.gems} gem`, { icon: 'ball', kind: 'gold', ms: 3800 });
        bus.emit('pickup', { kind: 'goldenBall', id: b.id, value: rw.gems, found: state.collected.balls.length, total: C.balls.length, x: b.x, z: b.z });
      }
    }
    for (let i = 0; i < C.digs.length; i++) { const s = C.digs[i]; if (s.t > 0) { s.t -= dt; if (!s.hid) { s.hid = true; C.digMesh.setMatrixAt(i, zero); C.digMesh.instanceMatrix.needsUpdate = true; } } else if (s.hid !== false) { s.hid = false; m4.makeRotationY(i * 1.3); m4.setPosition(s.x, s.y, s.z); C.digMesh.setMatrixAt(i, m4); C.digMesh.instanceMatrix.needsUpdate = true; } }
    for (const it of C.items.values()) {
      if (it.hidden > 0) { it.hidden -= dt; if (it.hidden <= 0 && it.home) { it.x = it.home.x; it.y = it.home.y; it.z = it.home.z; it.mesh.visible = true; it.mesh.position.set(it.x, it.y, it.z); it.mesh.scale.setScalar(it.scale); } continue; }
      if (it.held) { it.x = kx; it.z = kz; continue; }
      if (it.flying) { it.vy -= 16 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; const g = Math.max(world.groundAt(it.x, it.z, it.y + 0.5), WATER_Y - 0.05) + 0.14; if (it.y <= g && it.vy < 0) { it.y = g; if (Math.abs(it.vy) > 3) { it.vy *= -0.4; it.vx *= 0.5; it.vz *= 0.5; } else { it.flying = false; } } it.mesh.rotation.x += dt * 9; it.mesh.position.set(it.x, it.y, it.z); }
    }
  };
  C.counts = () => ({ balls: state.collected.balls.length, ballsTotal: C.balls.length, photos: state.collected.photos.length, photosTotal: PHOTO_SPOTS.length, signs: state.collected.signs.length, signsTotal: SIGNPOSTS.length, zones: state.collected.zones.length, bonesInWorld: C.bones.length });
  return C;
}
