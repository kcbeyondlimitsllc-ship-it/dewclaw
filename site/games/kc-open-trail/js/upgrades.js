/* Upgrades: what the 30 ladders *do*. economy.js owns prices and levels and emits `upgrade` { id, level, ladder };
   this file turns a level into an effect through the core hooks, and re-applies everything from the save at boot
   (the core does not save modifiers, ride tuning, photo unlocks, followers, travel points or placed objects).

     abilities, saddlebags      game.setModifier('upgrade:<id>', ...)
     Dig Mitts, Fetch Ball      game.rewards.dig / .fetch
     ride parts                 game.vehicles.setTuning(kind, patch, 'upgrade:<id>'); Pop Deck listens for `trick`
     Trail Camera               game.photo.unlock(...)
     KC's Den                   game.place.staged + nap, fast travel home, bone bowl, decor, planning board, trophy wall
     Trail Buddies / Whistle    hearts, a favourite dig spot on the map, game.followers.add
     the three businesses       a till that fills only while the game is being played and stops when it is full
     Lantern Fund, Town Fund    game.place.staged({ additive: true })
     Trail Markers              game.travel.add
     bakery treats              timed modifiers, a party buddy
   Returns the API shop.js draws from (game.modules.upgrades). No network, nothing random that is paid for. */
import { THREE, Geo } from './util.js';
import { DIG_SPOTS, SIGNPOSTS, PLAZA } from './data.js';
import { dogMaterial } from './kc.js';

const BIZ = {
  'biz:cart': { near: [283, 462], label: 'Biscuit Cart', col: 0xf0b860, col2: 0xe8566a, sign: 'BISCUIT CART PITCH', stall: 'cart' },
  'biz:canoes': { near: [-124, -326], label: 'Canoe Hire', col: 0x3f9fd6, col2: 0x2f8f88, sign: 'CANOE HIRE PITCH', stall: 'stall', extra: 'boat' },
  'biz:pumpkins': { near: [54, 64], label: 'Pumpkin Stand', col: 0xf08a2a, col2: 0x7a4f9a, sign: 'PUMPKIN STAND PITCH', stall: 'stall', extra: 'pumpkin' }
};
const NAP = [['Dawn', 6.2], ['Midday', 12], ['Dusk', 19.2], ['Night', 22.5]];
const FRAMES = ['postcard', 'polaroid', 'trail', 'film', 'lanterns', 'leaves'];

export function init(game) {
  const { state, bus, place } = game, eco = game.economy, world = game.world;
  const U = game.moduleData('upgrades', { tills: {}, decor: {}, paid: {}, bowl: '', called: [], wall: null, planning: false });
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(U.tills)) U.tills = {}; if (!obj(U.decor)) U.decor = {}; if (!obj(U.paid)) U.paid = {}; if (typeof U.bowl !== 'string') U.bowl = ''; if (!Array.isArray(U.called)) U.called = [];
  if (typeof U.wall !== 'string' || !U.wall.startsWith('data:image/')) U.wall = null;
  U.called = U.called.filter(k => typeof k === 'string').slice(0, 2);
  const lv = id => eco.level(id), base = { dig: game.rewards.dig.slice(), fetch: game.rewards.fetch };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  /* ---------- where things stand: the nearest dry, unblocked ground to a wished-for point (never hard-coded on top of scenery) ---------- */
  const free = (x, z, r) => { if (!place.clear(x, z, Math.min(r, 1.6))) return false; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (!place.clear(x + Math.cos(a) * r, z + Math.sin(a) * r, 0.9)) return false; const s = world.surfaceAt(x + Math.cos(a) * r, z + Math.sin(a) * r); if (s === 1 || s === 4) return false; } const s = world.surfaceAt(x, z); return s !== 1 && s !== 4; };
  const site = (x, z, r, reach = 46) => { for (let d = 0; d <= reach; d += 2.5) { const n = d ? Math.max(6, Math.round(d * 1.6)) : 1; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n + d * 0.37, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (free(px, pz, r)) return { x: Math.round(px * 10) / 10, z: Math.round(pz * 10) / 10 }; } } return { x, z }; };
  const sites = { den: site(-150, -172, 7.5), lantern: { x: PLAZA.x, z: PLAZA.z } };
  for (const id in BIZ) sites[id] = site(BIZ[id].near[0], BIZ[id].near[1], 4);

  /* ---------- a few props of our own (built like the core's pickups: a Geo and the shared vertex-colour material) ----------
     'planter' and 'boat' exist in the core, but game.spawnProp hands them their options in the wrong shape, so they are drawn here;
     the telescope and the golden hydrant have no core prop at all. No colliders: KC can walk through them. */
  const CUSTOM = {
    planter(g, o) { g.box(0, 0.28, 0, 1.5, 0.56, 0.62, 0x8a5a3a); g.box(0, 0.57, 0, 1.36, 0.06, 0.48, 0x4a3524); const cols = o.cols || [0xe8566a, 0xffd23c, 0xf4f4ef, 0xff9ac8, 0x7fd4ff]; cols.forEach((c, i) => { const x = -0.54 + i * 0.27, z = i % 2 ? 0.09 : -0.09; g.cyl(x, 0.58, z, 0.02, 0.02, 0.16, 4, 0x4f8f4f); g.ball(x, 0.8, z, 0.12, 0.11, 0.12, c, 5, 3); }); },
    boat(g, o) { const c = o.col ?? 0x3f7fd6; g.ball(0, 0.32, 0, 0.72, 0.34, 1.7, c, 8, 4); g.box(0, 0.5, 0, 1.0, 0.08, 2.5, 0xc9a67a); for (const z of [-0.6, 0.5]) g.box(0, 0.6, z, 1.1, 0.06, 0.26, 0x8a5a3a); g.box(0.9, 0.62, 0.1, 0.06, 0.06, 2.2, 0xe8dcc0); },
    goldhydrant(g) { const c = 0xf0c040; g.cyl(0, 0, 0, 0.24, 0.26, 0.1, 8, 0xc99a20); g.cyl(0, 0.1, 0, 0.17, 0.17, 0.62, 8, c); g.ball(0, 0.78, 0, 0.19, 0.16, 0.19, c, 7, 4); g.ball(0, 0.96, 0, 0.07, 0.07, 0.07, 0xfff0a0, 5, 3); for (const sx of [-1, 1]) g.box(sx * 0.22, 0.5, 0, 0.14, 0.13, 0.13, 0xc99a20); g.box(0, 0.5, 0.2, 0.15, 0.15, 0.12, 0xc99a20); },
    bed(g, o) { g.ball(0, 0.12, 0, 0.8, 0.14, 0.6, o.col ?? 0x2f6fb0, 8, 3); g.ball(0, 0.2, 0, 0.58, 0.1, 0.4, 0xcfe6f5, 8, 3); },
    mug(g, o) { g.box(0, 0.2, 0, 0.5, 0.4, 0.5, 0x8a5a3a); g.cyl(0, 0.4, 0, 0.13, 0.11, 0.26, 8, o.col ?? 0xf4ead8, 0x4f8f4f); g.box(0.17, 0.53, 0, 0.08, 0.14, 0.04, o.col ?? 0xf4ead8); },
    /* Supporter set: a gold-trimmed arch over the path to the den door (den:gold-trim). Looks only. */
    goldtrim(g) { const c = 0xf0c040, d = 0xc99a20; for (const sx of [-1.5, 1.5]) { g.cyl(sx, 0, 0, 0.09, 0.11, 2.3, 7, c); g.ball(sx, 2.38, 0, 0.16, 0.16, 0.16, d, 6, 4); } g.box(0, 2.2, 0, 3.1, 0.1, 0.12, c); for (let i = 0; i < 5; i++) g.box(-1.1 + i * 0.55, 1.93, 0, 0.3, 0.42, 0.04, i % 2 ? 0xf4ead8 : c); },
    telescope(g) { g.cyl(0, 0, 0, 0.09, 0.14, 1.15, 7, 0x3a4046); g.ball(0, 1.2, 0, 0.14, 0.14, 0.14, 0xe0b040, 6, 4); g.tf(0, 1.3, 0, Math.PI / 2 - 0.25, 0, 0); g.cyl(0, -0.55, 0, 0.11, 0.08, 1.1, 8, 0xe0b040, 0x2a2c30); g.notf(); }
  };
  function custom(kind, x, z, o = {}) { const g = new Geo(); CUSTOM[kind](g, o); const mesh = new THREE.Mesh(g.build(), dogMaterial()); mesh.position.set(x, place.groundY(x, z), z); mesh.rotation.y = o.ry || 0; mesh.castShadow = true; game.scene.add(mesh); let gone = false; return { mesh, remove() { if (gone) return; gone = true; game.scene.remove(mesh); mesh.geometry.dispose(); } }; }
  const spawnAny = (kind, x, z, o = {}) => (CUSTOM[kind] ? custom(kind, x, z, o) : game.spawnProp(kind, x, z, o));
  /* a staged-object stage made of parts ({ kind, dx, dz, style, ...opts }) that may use the props above */
  const parts = list => (x, z) => list.map(p => { const { kind, dx = 0, dz = 0, style, ...o } = p; if (style) o.kind = style; return spawnAny(kind, x + dx, z + dz, o); });

  /* ================= KC's Den ================= */
  const D = sites.den, home = { x: D.x, z: D.z + 7.2, yaw: Math.PI };
  const denStages = [
    { kind: 'signpost', text: 'A SPOT FOR A DEN' },
    { kind: 'tent', col: 0xd9534f },
    [{ kind: 'building', style: 'shed', w: 3, d: 3, h: 2.1, col: 0xb07a4a, roof: 'gable', f: 's' }],
    [{ kind: 'building', style: 'shed', w: 5, d: 4, h: 3, col: 0x9a6a42, roof: 'gable', f: 's' }, { kind: 'crate', dx: 3.6, dz: 1.4 }],
    [{ kind: 'building', style: 'cabin', w: 6.5, d: 5, h: 3.4, col: 0x8a5a3a, roof: 'gable', f: 's' }, { kind: 'bench', dx: 4.6, dz: 2.2 }],
    [{ kind: 'building', style: 'house', w: 8, d: 6, h: 4, col: 0xe8dcc0, roof: 'gable', f: 's' }, { kind: 'lamp', dx: -5, dz: 3.6 }, { kind: 'bench', dx: 5.6, dz: 3.4 }],
    [{ kind: 'building', style: 'house', w: 10, d: 7, h: 5, col: 0xc9a67a, roof: 'gable', f: 's' }, { kind: 'lamp', dx: -6, dz: 4.2 }, { kind: 'lamp', dx: 6, dz: 4.2 }, { kind: 'flag', dx: -6.4, dz: -2, col: 0xffb238 }]
  ];
  const den = place.staged({ id: 'eco:den', x: D.x, z: D.z, ry: 0, level: lv('den'), stages: denStages });
  place.counter({ id: 'eco:den:door', x: home.x, z: home.z - 1.2, r: 3.4, prompt: () => (lv('den') ? "Go into KC's den" : 'Look at the den spot'), icon: 'star', onInteract: () => game.shop.open('den'), marker: { label: "KC's Den", color: '#ffb238', icon: 'star' } });
  let trim = null; const syncTrim = () => { const want = lv('den') >= 1 && game.economy.owns('den:gold-trim'); if (want && !trim) trim = custom('goldtrim', home.x, home.z + 1.6); else if (!want && trim) { trim.remove(); trim = null; } };
  syncTrim(); game.on('grant', syncTrim); game.on('upgrade', e => { if (e && e.id === 'den') syncTrim(); }); game.on('modulesReady', syncTrim);
  game.travel.add({ id: 'den', name: "KC's Den", x: home.x, z: home.z, yaw: home.yaw, color: '#ffb238', enabled: () => lv('den') >= 3 });
  const denSlots = () => { const l = eco.ladder('den'), n = lv('den'); return (n ? l.eff.slots[n - 1] : 0) + (n ? lv('denstore') * eco.ladder('denstore').eff.slots : 0); };
  const outfitSlots = () => (lv('den') ? 1 + lv('denstore') : 0);
  /* 60 spots on four rings round the den; the path to the door stays open */
  const SLOTS = []; for (const [r, n] of [[10, 10], [13, 14], [16, 16], [19, 20]]) for (let i = 0; i < n; i++) { const a = (i + 0.5) * Math.PI * 2 / n; SLOTS.push({ x: D.x + Math.sin(a) * r, z: D.z + Math.cos(a) * r, ry: a + Math.PI, front: Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0 }); }
  const stood = new Map(), placedCount = () => Object.keys(U.decor).length, unstand = id => { const h = stood.get(id); if (h) h.remove(); stood.delete(id); };
  function stand(id, slot) {
    const it = eco.item(id), s = SLOTS[slot]; if (!it || !s) return false; const o = { ...(it.opts || {}) }; unstand(id);
    if (it.kind === 'hedge') { o.x1 = s.x + Math.cos(s.ry) * 3; o.z1 = s.z - Math.sin(s.ry) * 3; } else if (!['pumpkin', 'boulder', 'crate', 'fountain', 'signpost', 'campfire'].includes(it.kind)) o.ry = s.ry;
    try { stood.set(id, spawnAny(it.kind, s.x, s.z, o)); return true; } catch (e) { console.error('[decor ' + id + ']', e); return false; }
  }
  const slotFree = i => !Object.values(U.decor).includes(i) && !SLOTS[i].front && place.clear(SLOTS[i].x, SLOTS[i].z, 1.1);
  /* placeDecor(id) -> true | reason. The prop must be owned (bought in the den catalogue, or granted by a set); it takes the next open spot. */
  function placeDecor(id) {
    const it = eco.item(id); if (!it || it.cat !== 'decor') return 'Not den decor'; if (!eco.owns(id)) return 'Not yours yet'; if (id in U.decor) return true;
    if (!lv('den')) return 'KC needs a den first'; if (placedCount() >= denSlots()) return `All ${denSlots()} decor spots are in use`;
    const i = SLOTS.findIndex((s, k) => slotFree(k)); if (i < 0) return 'No open ground left round the den';
    if (!stand(id, i)) return 'That would not fit'; U.decor[id] = i; bus.emit('decor', { id, on: true }); game.save.save(); return true;
  }
  /* removeDecor(id) -> { bones, gems } handed back (everything that was paid for it), or null */
  function removeDecor(id) {
    if (!(id in U.decor)) return null; unstand(id); delete U.decor[id];
    const p = U.paid[id], back = { bones: 0, gems: 0 }; if (obj(p) && p.n > 0 && (p.c === 'bones' || p.c === 'gems')) { back[p.c] = Math.floor(p.n); delete state.owned[id]; game.wallet.add(p.c, back[p.c], 'refund:' + id); } delete U.paid[id];
    bus.emit('decor', { id, on: false, refund: back }); game.save.save(); return back;
  }
  bus.on('itemBought', e => { if (e.item && e.item.cat === 'decor') U.paid[e.id] = { c: e.currency, n: e.cost }; });
  bus.on('itemUndone', e => { if (e.id in U.decor) { unstand(e.id); delete U.decor[e.id]; } delete U.paid[e.id]; });
  for (const id of Object.keys(U.decor)) { const i = U.decor[id]; if (!Number.isInteger(i) || !SLOTS[i] || !eco.item(id) || !eco.owns(id) || !lv('den') || !stand(id, i)) { delete U.decor[id]; } }
  for (const id of Object.keys(U.paid)) if (!eco.owns(id)) delete U.paid[id];

  const nap = hour => { if (lv('den') < 2 || !Number.isFinite(hour)) return false; const go = () => { world.setTime(((hour % 24) + 24) % 24); bus.emit('nap', { hour }); }; if (game.ui.fade && game.ui.started) { game.ui.closeAll(); game.ui.fade(go); } else go(); return true; };
  const bowlReady = () => lv('den') >= 4 && U.bowl !== today();
  const bowl = () => { if (!bowlReady()) return 0; U.bowl = today(); const got = eco.grant({ bones: 25 }, 'den:bowl').bones; game.audio.sfx('eat'); game.save.save(); return got; };
  const planning = () => { if (lv('den') < 5) return false; if (!U.planning) { U.planning = true; eco.setFlag('den:planning', true); bus.emit('planningBoard', {}); } return true; };
  const trophies = () => { const c = state.collected, s = state.stats, done = eco.ladders().filter(l => lv(l.id) >= l.max).length;
    return [['Golden balls found', c.balls.length], ['Places discovered', c.zones.length], ['Photo spots snapped', c.photos.length], ['Signposts read', c.signs.length], ['Ladders finished', done], ['Digs', s.digs || 0], ['Days on the trail', state.day || 1]]; };

  /* photo wall (Trail Camera tier 3): one small copy of the last photo, kept in the save */
  bus.on('photoTaken', () => { if (lv('camera') < 3 || !lv('den')) return; try { const src = game.ui.lastPhotoCanvas; if (!src || !src.width) return; const w = 240, h = Math.max(1, Math.round(w * src.height / src.width)), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h); U.wall = c.toDataURL('image/jpeg', 0.7); bus.emit('photoWall', {}); } catch (e) { /* a tainted or missing canvas: keep the old picture */ } });

  /* ================= the three businesses ================= */
  const rate = id => { const l = eco.ladder(id), n = lv(id); return l && n ? l.eff.rate * (1 + (n >= 2 ? 0.5 : 0) + (n >= 4 ? 0.25 : 0)) : 0; };   /* bones a minute */
  const cap = id => { const l = eco.ladder(id), n = lv(id); return l && n ? l.eff.cap * (n >= 3 ? 2 : 1) : 0; };
  const till = id => { const v = Number(U.tills[id]); return Number.isFinite(v) && v > 0 ? Math.min(v, cap(id)) : 0; };
  const near = id => { const s = sites[id]; return !!s && Math.hypot(game.kc.pos.x - s.x, game.kc.pos.z - s.z) < 14; };
  const remote = () => lv('town') >= 5;
  /* collect(id) -> bones paid out (whole bones only; the fraction stays in the till). Paid straight to the wallet: Lucky Nose does not touch tills. */
  const collect = id => { const n = Math.floor(till(id)); if (n <= 0) return 0; U.tills[id] = till(id) - n; full.delete(id); const got = eco.grant({ bones: n }, 'till:' + id).bones; bus.emit('till', { id, bones: got }); return got; };
  const collectAll = () => Object.keys(BIZ).reduce((s, id) => s + collect(id), 0);
  const full = new Set();
  bus.on('second', () => { for (const id in BIZ) { const r = rate(id); if (!r) continue; const c = cap(id), v = Math.min(c, till(id) + r / 60); U.tills[id] = v; if (v >= c && !full.has(id)) { full.add(id); game.toast(`The ${BIZ[id].label} till is full.`, { icon: 'bone' }); } } });
  for (const id in BIZ) { const b = BIZ[id], s = sites[id], name = b.label, shop = (c, deco) => parts([{ kind: b.stall, name, col: c, ry: 0 }, ...deco]);
    const stock = b.extra ? [{ kind: b.extra, dx: 3.6, dz: 0.6, col: b.col2 }] : [{ kind: 'crate', dx: 2.6, dz: 0.4 }];
    U.tills[id] = till(id);
    place.staged({ id: 'eco:' + id, x: s.x, z: s.z, level: lv(id), stages: [
      parts([{ kind: 'signpost', text: b.sign }]), shop(b.col, []), shop(b.col, stock), shop(b.col, [...stock, { kind: 'building', style: 'shed', w: 1.6, d: 1.6, h: 1.2, col: 0xb07a4a, roof: 'gable', f: 's', dx: -3.4, dz: 0.2 }, { kind: 'umbrella', col: b.col2, dx: -3.2, dz: 2.4 }]),
      shop(b.col2, [...stock, { kind: 'building', style: 'shed', w: 1.6, d: 1.6, h: 1.2, col: 0xb07a4a, roof: 'gable', f: 's', dx: -3.4, dz: 0.2 }, { kind: 'umbrella', col: b.col, dx: -3.2, dz: 2.4 }, { kind: 'flag', col: b.col2, dx: 3.6, dz: 2.6 }])] });
    place.counter({ id: 'eco:' + id + ':till', x: s.x, z: s.z + 3.2, r: 3.4, icon: 'bone', prompt: () => (lv(id) ? (Math.floor(till(id)) > 0 ? `Empty the till (${Math.floor(till(id))} bones)` : `Check on the ${name}`) : `Look at the ${name} pitch`),
      onInteract: () => { const got = lv(id) ? collect(id) : 0; if (got) { game.audio.sfx('reward'); game.toast(`${name}: ${got} bones from the till`, { icon: 'bone', kind: 'good' }); } else game.shop.open('businesses'); }, marker: { label: name, color: '#7fe08f', icon: 'bone' } }); }

  /* ================= Lantern Fund and Town Fund ================= */
  const ring = (cx, cz, r, n, off) => () => { const out = []; for (let i = 0; i < n; i++) { const a = off + i * Math.PI * 2 / n, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (place.clear(x, z, 0.7)) out.push(game.spawnProp('lamp', x, z, { h: 2.2, r: 4 })); } return out; };
  const L0 = sites.lantern, plaque = site(L0.x + 6, L0.z + 9, 1.4, 20);
  const lantern = place.staged({ id: 'eco:lantern', x: L0.x, z: L0.z, additive: true, level: lv('lantern') - 1, stages: [ring(L0.x, L0.z, 7.5, 5, 0.3), ring(L0.x, L0.z, 9.8, 6, 0.8), ring(L0.x, L0.z, 15.5, 7, 0.5), ring(L0.x, L0.z, 18.5, 8, 0.2),
    () => [game.spawnProp('signpost', plaque.x, plaque.z, { text: 'LANTERN FUND: LIT BY KC AND FRIENDS' }), game.spawnProp('lamp', plaque.x + 1.6, plaque.z, {})]] });
  const hall = place.door('cityhall') || { x: -166, z: -284 }, T = { bench: site(hall.x - 7, hall.z + 3, 1.6, 24), fountain: site(hall.x + 8, hall.z + 4, 2.2, 24), scope: site(-226, -136, 1.6, 30), hydrant: site(hall.x + 3.5, hall.z + 1.5, 1.2, 20) };
  function telescope(x, z) {
    const t = custom('telescope', x, z, { ry: Math.PI / 2 });
    const it = game.addInteractable({ id: 'eco:scope', x, z, r: 2.4, label: 'Look through the telescope', icon: 'camera', prio: 2, onInteract: () => game.toast('KC can see all the way down the river to the bridge.', { icon: 'camera' }) }), mk = game.addMarker({ id: 'eco:scope', x, z, label: 'Lookout telescope', color: '#7fd4ff', icon: 'camera' });
    return { remove() { t.remove(); it.remove(); mk.remove(); } };
  }
  const town = place.staged({ id: 'eco:town', x: hall.x, z: hall.z, additive: true, level: lv('town') - 1, stages: [
    () => game.spawnProp('bench', T.bench.x, T.bench.z, { ry: 0 }), () => game.spawnProp('fountain', T.fountain.x, T.fountain.z, { r: 1.1 }),
    () => { const out = []; for (let i = 0; i < 7; i++) { const x = -106, z = -244 + i * 9; if (place.clear(x, z, 0.7)) out.push(game.spawnProp('lamp', x, z, {})); } return out; },
    () => telescope(T.scope.x, T.scope.z), () => custom('goldhydrant', T.hydrant.x, T.hydrant.z)] });
  place.counter({ id: 'eco:cityhall', x: hall.x, z: hall.z, r: 3, prompt: 'Chip in at City Hall', icon: 'star', onInteract: () => game.shop.open('funds'), marker: { label: 'Town Fund', color: '#ffd23c', icon: 'star' } });

  /* ================= Trail Markers: eight signposts become fast-travel points ================= */
  for (const l of eco.ladders('town')) { if (l.eff.type !== 'marker') continue; const s = SIGNPOSTS.find(x => x.id === l.eff.sign); if (!s) continue;
    const p = [[0, 2.2], [2.2, 0], [0, -2.2], [-2.2, 0], [3, 3], [-3, -3]].map(([dx, dz]) => ({ x: s.x + dx, z: s.z + dz })).find(q => place.clear(q.x, q.z, 0.8)) || { x: s.x, z: s.z + 2.2 };
    game.travel.add({ id: l.id, name: l.eff.name, x: p.x, z: p.z, yaw: 0, enabled: () => lv(l.id) >= 1 }); }

  /* ================= Trail Buddies and the Buddy Whistle ================= */
  const dogs = eco.ladders('companions').filter(l => l.eff.type === 'buddy').map(l => l.eff.dog), hearts = dog => lv('buddy:' + String(dog).toLowerCase());
  const favourite = dog => { const d = game.followers.dogs().find(x => x.name.toLowerCase() === dog); if (!d) return null; let best = null, bd = 1e9; for (const [x, z] of DIG_SPOTS) { const q = Math.hypot(x - d.home.x, z - d.home.z); if (q < bd) { bd = q; best = { x, z }; } } return best; };
  const digMarks = () => { for (const dog of dogs) { const id = 'eco:buddydig:' + dog, on = hearts(dog) >= 2; if (on && !place.get(id)) { const f = favourite(dog), l = eco.ladder('buddy:' + dog); if (f) place.marker({ id, x: f.x, z: f.z, label: `${l.eff.name}'s favourite dig spot`, icon: 'dig', color: '#ff9ac8' }); } else if (!on && place.get(id)) place.remove(id); } };
  const mine = new Map();   /* dog key -> follower handle called with the whistle */
  const called = () => { for (const [k, h] of [...mine]) if (!game.followers.list().some(f => f.id === h.id)) mine.delete(k); return [...mine.keys()]; };
  /* callBuddy(dog) -> true | reason */
  function callBuddy(dog, quiet) {
    dog = String(dog).toLowerCase(); const w = lv('whistle'), l = eco.ladder('buddy:' + dog); if (!l) return 'No such buddy'; if (!w) return 'KC needs the Buddy Whistle';
    if (hearts(dog) < 3) return `${l.eff.name} needs three hearts first`; if (called().includes(dog)) return true; const room = w >= 3 ? 2 : 1; if (called().length >= room) return room > 1 ? 'Two buddies are already with KC' : 'A buddy is already with KC';
    if (game.followers.max < room) game.followers.max = room;
    const h = game.followers.add({ dog: 'dog-' + dog, seconds: w >= 2 ? undefined : 600, onLeave: () => { mine.delete(dog); U.called = U.called.filter(k => k !== dog); bus.emit('buddy', { dog, on: false }); } });
    if (!h) return 'KC already has a full party'; mine.set(dog, h); if (w >= 2 && !U.called.includes(dog)) U.called.push(dog); if (!quiet) { game.audio.sfx('whistle'); game.toast(`${l.eff.name} is coming along${w >= 2 ? '' : ' for 10 minutes'}.`, { icon: 'whistle', kind: 'good' }); } bus.emit('buddy', { dog, on: true }); return true;
  }
  const sendHome = dog => { dog = String(dog).toLowerCase(); const h = mine.get(dog); mine.delete(dog); U.called = U.called.filter(k => k !== dog); if (!h) return false; h.dismiss(); return true; };
  bus.on('start', () => { for (const dog of U.called.slice()) if (lv('whistle') < 2 || callBuddy(dog, true) !== true) U.called = U.called.filter(k => k !== dog); });
  const greeted = new Map(); let simT = 0;
  bus.on('second', () => { simT++; if (simT % 2) return; const k = game.kc.pos; for (const d of game.followers.dogs()) { const key = d.name.toLowerCase(); if (d.following || hearts(key) < 1 || Math.hypot(d.x - k.x, d.z - k.z) > 7 || simT - (greeted.get(key) ?? -999) < 90) continue;
    const first = !greeted.has(key); greeted.set(key, simT); game.fx.burst('heart', d.x, place.groundY(d.x, d.z) + 1, d.z, 5); if (first) game.toast(`${d.name} wags hello!`, { icon: 'paw' }); bus.emit('buddyGreet', { dog: key }); } });

  /* ================= Pop Deck: bones for ollies, at most one payout every 5 seconds ================= */
  let lastTrick = -99, clock = 0; bus.on('tick', e => { clock += e.dt; });
  bus.on('trick', () => { const n = lv('popdeck'); if (!n || clock - lastTrick < eco.ladder('popdeck').eff.every) return; lastTrick = clock; eco.grant({ bones: eco.ladder('popdeck').eff.v[n - 1] }, 'trick'); });

  /* ================= bakery treats ================= */
  /* useTreat(id) -> true | reason */
  function useTreat(id) {
    const it = eco.item(id); if (!it || it.cat !== 'treat') return 'Not a treat'; if (eco.count(id) < 1) return 'None in the pouch';
    if (it.eff.party) { if (game.followers.max < 1) game.followers.max = 1; const pool = game.followers.dogs().filter(d => !d.following); if (!pool.length) return 'Every dog in town is already with KC';
      const k = game.kc.pos, d = pool.sort((a, b) => Math.hypot(a.x - k.x, a.z - k.z) - Math.hypot(b.x - k.x, b.z - k.z))[0], h = game.followers.add({ dog: d.id, seconds: it.eff.seconds }); if (!h) return 'KC already has a full party';
      for (let i = 0; i < 3; i++) game.fx.burst(i === 1 ? 'heart' : 'spark', k.x, k.y + 1.2 + i * 0.3, k.z, 14); game.toast(`${d.name} is coming to the party for 10 minutes.`, { icon: 'paw', kind: 'good' }); }
    else { game.setModifier(id, it.eff.mod, { seconds: it.eff.seconds }); game.toast(`${it.name}: ${it.text}`, { icon: 'bolt', kind: 'good' }); }
    eco.use(id, 1); game.audio.sfx('eat'); bus.emit('treatUsed', { id }); return true;
  }

  /* ================= levels -> effects ================= */
  function apply(l, quiet) {
    const n = lv(l.id), e = l.eff, src = 'upgrade:' + l.id;
    if (e.type === 'mod') game.setModifier(src, n ? { [e.key]: e.v[n - 1] } : null);
    else if (e.type === 'reward') game.rewards[e.key] = n ? (Array.isArray(e.v[n - 1]) ? e.v[n - 1].slice() : e.v[n - 1]) : (Array.isArray(base[e.key]) ? base[e.key].slice() : base[e.key]);
    else if (e.type === 'tune') game.vehicles.setTuning(e.kind, n ? (e.key === 'carry' ? { carry: e.v[n - 1], keep: e.v[n - 1] } : { [e.key]: e.v[n - 1] }) : null, src);
    else if (e.type === 'camera') { if (n >= 1) game.photo.unlock('frame', FRAMES); else game.photo.lock('frame', FRAMES); for (const k of ['filter', 'zoom']) (n >= 2 ? game.photo.unlock : game.photo.lock)(k); for (const k of ['sticker', 'pose']) (n >= 3 ? game.photo.unlock : game.photo.lock)(k); }
    else if (e.type === 'den') { den.setLevel(n, quiet); if (n >= 5 && !quiet) planning(); }
    else if (e.type === 'biz') { const h = place.get('eco:' + l.id); if (h) h.setLevel(n, quiet); U.tills[l.id] = till(l.id); }
    else if (e.type === 'lantern') { lantern.setLevel(n - 1, quiet); if (n >= 5) eco.setFlag('lantern:top', true); }
    else if (e.type === 'town') town.setLevel(n - 1, quiet);
    else if (e.type === 'buddy') digMarks();
    else if (e.type === 'whistle') { if (n >= 3 && game.followers.max < 2) game.followers.max = 2; }
  }
  for (const l of eco.ladders()) try { apply(l, true); } catch (e) { console.error('[upgrade ' + l.id + ']', e); }
  bus.on('upgrade', e => { const l = eco.ladder(e.id); if (l) try { apply(l, false); } catch (err) { console.error('[upgrade ' + e.id + ']', err); } });

  const maxIncome = () => Object.keys(BIZ).reduce((s, id) => s + eco.ladder(id).eff.rate * 1.75, 0);
  return { goldTrim: () => !!trim, sites, biz: Object.keys(BIZ), bizName: id => (BIZ[id] ? BIZ[id].label : id), rate, cap, till, collect, collectAll, near, remote, maxIncome,
    home, nap, napTimes: NAP, bowl, bowlReady, planning, trophies, wall: () => U.wall, denSlots, decorPlaced: () => Object.keys(U.decor), decorOn: id => id in U.decor, decorStanding: id => { const h = stood.get(id); return !!(h && h.mesh && h.mesh.parent); }, placeDecor, removeDecor, outfitSlots,
    dogs, hearts, favourite, callBuddy, sendHome, called, useTreat, apply: id => { const l = eco.ladder(id); if (l) apply(l, true); } };
}
