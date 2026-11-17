/* Core seams for the feature modules (economy, upgrades, shop, missions, store, merch). The modules never
   edit core files; what they need from the world is here and documented in ARCHITECTURE.md, "Module seams":
     game.cosmetics   define / equip / unequip / preview wearables and ride skins by id (saved in state.equipped)
     game.place       put things in the world: marker, prop, stand, shelf, npc, pickup, zone, staged objects; find doors and stalls
     game.timedRun    a timed or stop-watch run with checkpoints, a HUD timer and an objective
     game.travel      fast-travel points (shown on the world map) and game.fastTravel(x, z, yaw, opts)
     game.followers   dogs that walk with KC (wraps npcs.addFollower)
   Created by main.js after the world, KC, the HUD, the NPCs, the rides and the collectibles exist. */
import { THREE, Geo, clamp, TAU } from './util.js';
import { BUILDINGS, STALLS, CARTS, SIGNPOSTS, WATER_Y, HALF } from './data.js';
import { dogMaterial } from './kc.js';

export function createSeams(game) {
  const { bus, state, world, kc, scene, fx } = game, api = game.api, ui = game.ui;

  /* ================= cosmetics by id =================
     define({ id, slot, name, value, free? }) or an array of them. Slots and what `value` is:
       bandana | harness | collar | trail   a colour (0xrrggbb)
       tag                                  a colour, or false to hide the tag
       hat | outfit                         'cap' | { type: 'cap', color } (kc.registerHat / kc.registerOutfit add shapes)
       skin:skateboard | skin:canoe | skin:van   { primary, secondary }
     equip(id) wears it and saves it (state.equipped[slot] = id); it needs game.economy.owns(id) unless the definition is
     free or { force: true } is passed. A definition that arrives after the save was loaded is put on at once if the
     save says KC is wearing it, so modules need no restore step. preview(id) shows it without saving (try-on). */
  const defs = new Map(), SKIN0 = JSON.parse(JSON.stringify(game.vehicles.skins)); let previewing = null;
  const show = (slot, value) => {
    if (slot.startsWith('skin:')) { const kind = slot.slice(5); if (game.vehicles.skins[kind]) game.vehicles.setSkin(kind, value || SKIN0[kind]); return; }
    if (slot === 'tag') kc.setCosmetic('tag', value == null ? 0xf0c040 : value); else kc.setCosmetic(slot, value ?? null);
  };
  const C = game.cosmetics = {
    slots: ['bandana', 'harness', 'collar', 'hat', 'tag', 'trail', 'outfit', 'skin:skateboard', 'skin:canoe', 'skin:van'],
    define(d) { if (Array.isArray(d)) { for (const x of d) C.define(x); return; } if (!d || !d.id || !d.slot) throw new Error('cosmetic needs an id and a slot'); defs.set(d.id, d); if (state.equipped[d.slot] === d.id && !previewing) show(d.slot, d.value); },
    get: id => defs.get(id) || null,
    list: slot => [...defs.values()].filter(d => !slot || d.slot === slot),
    equipped: slot => (slot ? state.equipped[slot] || null : { ...state.equipped }),
    canWear: id => { const d = defs.get(id); return !!d && (!!d.free || game.economy.owns(id)); },
    equip(id, o = {}) { const d = defs.get(id); if (!d) return false; if (!o.force && !C.canWear(id)) return false; C.endPreview(); state.equipped[d.slot] = id; show(d.slot, d.value); if (o.save !== false) game.save.save(); bus.emit('equip', { slot: d.slot, id }); return true; },
    unequip(slot, o = {}) { if (!(slot in state.equipped)) return false; C.endPreview(); delete state.equipped[slot]; show(slot, null); if (o.save !== false) game.save.save(); bus.emit('unequip', { slot }); return true; },
    /* try-on: shows the item without saving or owning it; endPreview() (or equip / unequip) puts back what she really wears */
    preview(id) { const d = defs.get(id); if (!d) return false; if (previewing && previewing !== d.slot) C.endPreview(); previewing = d.slot; show(d.slot, d.value); bus.emit('preview', { slot: d.slot, id }); return true; },
    endPreview() { if (!previewing) return; const slot = previewing, d = defs.get(state.equipped[slot]); previewing = null; show(slot, d ? d.value : null); bus.emit('preview', { slot, id: null }); },
    /* put on everything the save says she wears (called once by main.js after the modules have defined their items) */
    restore() { for (const slot of Object.keys(state.equipped)) { const d = defs.get(state.equipped[slot]); if (d && d.slot === slot) show(slot, d.value); } }
  };
  bus.on('modalClose', () => { if (previewing && !ui.modalOpen) C.endPreview(); });

  /* ================= followers ================= */
  game.followers = {
    add: o => game.npcs.addFollower(o), dismiss: (id, reason) => game.npcs.removeFollower(id, reason), list: () => game.npcs.followers.map(d => d.follow.handle),
    get max() { return game.npcs.maxFollowers; }, set max(n) { game.npcs.maxFollowers = clamp(Math.floor(n) || 0, 0, 4); },
    dogs: () => game.npcs.dogs.filter(d => !d.follow || !d.follow.own).map(d => ({ id: d.id, name: d.name, x: d.x, z: d.z, home: { x: d.home.x, z: d.home.z }, following: !!d.follow }))
  };

  /* ================= placing things ================= */
  const placed = new Map();
  const track = (id, remove, extra = {}) => { if (placed.has(id)) placed.get(id).remove(); let gone = false; const h = { id, ...extra, remove() { if (gone) return; gone = true; if (placed.get(id) === h) placed.delete(id); try { remove(); } catch (e) { console.error(e); } } }; placed.set(id, h); return h; };
  const uid = p => p + Math.random().toString(36).slice(2, 8);
  const DIR = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
  const front = (x, z, ry, off) => ({ x: x + Math.sin(ry) * off, z: z + Math.cos(ry) * off, yaw: Math.atan2(-Math.sin(ry), -Math.cos(ry)) });
  const P = game.place = {
    /* where things are: all return { x, z, yaw } (yaw = KC facing the thing) or null */
    building: id => BUILDINGS.find(b => b.id === id) || null,
    door(id, off = 2.6) { const b = P.building(id); if (!b) return null; const d = DIR[b.f] || DIR.s, half = (d[0] ? b.w : b.d) / 2 + off; return { x: b.x + d[0] * half, z: b.z + d[1] * half, yaw: Math.atan2(-d[0], -d[1]), building: b }; },
    /* side: -1 / 1 picks a spot along the shop front beside the door (for a shelf or a stand that must not block the way in) */
    beside(id, side = 1, off = 1.4, along = 4.2) { const b = P.building(id); if (!b) return null; const d = DIR[b.f] || DIR.s, half = (d[0] ? b.w : b.d) / 2 + off; return { x: b.x + d[0] * half + d[1] * along * side, z: b.z + d[1] * half - d[0] * along * side, ry: Math.atan2(d[0], d[1]), yaw: Math.atan2(-d[0], -d[1]), building: b }; },
    stall(name, off = 3.6) { const s = STALLS.find(t => t.name === name); return s ? { ...front(s.x, s.z, s.ry || 0, off), stall: s } : null; },
    cart(name, off = 3.6) { const c = CARTS.find(t => t[2] === name); return c ? { ...front(c[0], c[1], c[4] || 0, off), cart: c } : null; },
    sign: id => { const s = SIGNPOSTS.find(t => t.id === id); return s ? { x: s.x, z: s.z, yaw: 0, sign: s } : null; },
    groundY: (x, z) => world.groundAt(x, z, 200),
    /* is this a sound, dry, unblocked spot to stand something on? */
    clear: (x, z, r = 0.8) => { const h = world.heightAt(x, z); return h > WATER_Y + 0.2 && !world.blockedAt(x, z, h, r) && Math.abs(x) < HALF - 4 && Math.abs(z) < HALF - 4; },

    /* marker({ id, x, z | getPos, label, icon, color, beacon, minimap, edge, compass, prompt, r, prio, enabled, onInteract })
       A dot on the minimap and the map (with `label`), a light pillar with beacon: true, a compass pin with compass: true,
       and, if `prompt` is given, an interact prompt that calls onInteract. -> { id, remove() } */
    marker(o) { const id = o.id || uid('mk-'), m = api.addMarker({ id, x: o.x, z: o.z, getPos: o.getPos, icon: o.icon, color: o.color || '#ffb238', label: o.label, beacon: !!o.beacon, minimap: o.minimap !== false, edge: !!o.edge, compass: !!o.compass });
      const it = o.prompt ? api.addInteractable({ id: 'mk:' + id, kind: o.kind || 'marker', x: o.x, z: o.z, getPos: o.getPos, r: o.r || 2.6, label: o.prompt, icon: o.icon || 'paw', prio: o.prio ?? 2, enabled: o.enabled, onInteract: o.onInteract }) : null;
      return track(id, () => { m.remove(); if (it) it.remove(); }, { x: o.x, z: o.z }); },
    /* prop(kind, x, z, opts) = game.spawnProp, tracked so place.remove(id) / place.removeAll(prefix) can clear it. opts.id names it. */
    prop(kind, x, z, opts = {}) { const p = world.scenery.spawn(kind, x, z, opts), id = opts.id || uid('pr-'); return track(id, () => p.remove(), { x, z, mesh: p.mesh, colliders: p.colliders }); },
    /* stand({ id, kind: 'stall' | 'cart' | 'shelf' | 'table' | 'noticeboard' | 'crate' | ..., x, z, ry, name, col, opts, prompt, icon, onInteract, enabled, marker, off })
       A prop with an interact prompt on the open ground in front of it (off units out along its facing). marker: true | { label, color, beacon } adds a map dot.
       -> { id, x, z, front: { x, z, yaw }, remove() } */
    stand(o) { const id = o.id || uid('st-'), kind = o.kind || 'stall', ry = o.ry || 0, popts = { ...(o.opts || {}), ry, name: o.name || '', col: o.col ?? (kind === 'stall' || kind === 'cart' ? 0x4f9a94 : undefined), title: o.name };
      const p = world.scenery.spawn(kind, o.x, o.z, popts), f = front(o.x, o.z, ry, o.off ?? (kind === 'shelf' ? 1.5 : kind === 'stall' || kind === 'cart' ? 2.6 : 1.8));
      const it = o.prompt ? api.addInteractable({ id: 'st:' + id, kind: 'stand', x: f.x, z: f.z, r: o.r || 2.4, label: o.prompt, icon: o.icon || 'paw', prio: o.prio ?? 3, enabled: o.enabled, onInteract: o.onInteract }) : null;
      const mk = o.marker ? api.addMarker({ id: 'st:' + id, x: o.x, z: o.z, color: '#7fe08f', label: o.name, ...(o.marker === true ? {} : o.marker) }) : null;
      return track(id, () => { p.remove(); if (it) it.remove(); if (mk) mk.remove(); }, { x: o.x, z: o.z, front: f, mesh: p.mesh }); },
    shelf: o => P.stand({ ...o, kind: 'shelf' }),
    /* counter({ id, x, z, r, prompt, icon, onInteract, enabled, marker }): just the prompt (and map dot), for a shop door or an existing stall */
    counter(o) { const id = o.id || uid('ct-'), it = api.addInteractable({ id: 'ct:' + id, kind: 'counter', x: o.x, z: o.z, r: o.r || 2.8, label: o.prompt || 'Look', icon: o.icon || 'paw', prio: o.prio ?? 3, enabled: o.enabled, onInteract: o.onInteract });
      const mk = o.marker ? api.addMarker({ id: 'ct:' + id, x: o.x, z: o.z, color: '#7fe08f', ...(o.marker === true ? {} : o.marker) }) : null; return track(id, () => { it.remove(); if (mk) mk.remove(); }, { x: o.x, z: o.z }); },
    /* npc({ id, x, z, yaw, look, name, scale, prompt, icon, onInteract, enabled, marker }) : a person who stands there, turns to KC and waves.
       -> the stander ({ x, z, walkTo(), follow(), wave() }) with id and remove() */
    npc(o) { const id = o.id || uid('np-'), s = game.npcs.addStander({ id, x: o.x, z: o.z, yaw: o.yaw, look: o.look, name: o.name, scale: o.scale });
      const it = o.prompt || o.onInteract ? api.addInteractable({ id: 'np:' + id, kind: 'npc', getPos: () => s, r: o.r || 2.6, label: typeof o.prompt === 'function' ? o.prompt : o.prompt || 'Talk to ' + s.name, icon: o.icon || 'hand', prio: o.prio ?? 3, enabled: o.enabled, onInteract: () => { s.wave(); bus.emit('talk', { id, name: s.name }); if (o.onInteract) o.onInteract(s); } }) : null;
      const mk = o.marker ? api.addMarker({ id: 'np:' + id, getPos: () => s, color: '#ffd23c', label: o.name, ...(o.marker === true ? {} : o.marker) }) : null;
      const off = s.remove; track(id, () => { off(); if (it) it.remove(); if (mk) mk.remove(); }); s.remove = () => placed.has(id) ? placed.get(id).remove() : off(); return s; },
    /* zone({ id, x, z, r } | { id, rect: [x0, z0, x1, z1] }, onEnter?, onExit?) with once: true to fire one time -> { id, remove() } */
    zone(o, onEnter, onExit) { const id = o.id || uid('zn-'), z = api.addZone({ ...o, id }, onEnter, onExit); return track(id, () => z.remove(), { x: o.x, z: o.z }); },
    /* pickup({ id, x, z, y?, kind, color, r, bob, onCollect, marker }) : a floating thing KC collects by touching it (on foot, swimming or riding).
       kinds: flag, disc, lantern, litter, star, parcel, paper, bucket, glove, pumpkin, treat. Emits `collect` { id, kind, x, z }. -> { id, remove() } */
    pickup(o) { const id = o.id || uid('pk-'), kind = o.kind || 'star', mesh = new THREE.Mesh(pickupGeo(kind, o.color), dogMaterial());
      const h = Math.max(world.groundAt(o.x, o.z, 200), WATER_Y), it = { id, kind, x: o.x, z: o.z, y: (o.y ?? h) + (o.lift ?? 0.75), r: o.r || 1.5, t: Math.random() * 6, bob: o.bob !== false, mesh, onCollect: o.onCollect };
      mesh.position.set(it.x, it.y, it.z); scene.add(mesh); pickups.set(id, it);
      const mk = o.marker ? api.addMarker({ id: 'pk:' + id, x: o.x, z: o.z, color: '#ffd23c', ...(o.marker === true ? {} : o.marker) }) : null;
      return track(id, () => { pickups.delete(id); scene.remove(mesh); mesh.geometry.dispose(); if (mk) mk.remove(); }, { x: o.x, z: o.z }); },
    /* staged({ id, x, z, ry, level, additive, stages: [stage0, stage1, ...] }) : a world object that changes look by level (KC's den, a business, the fund).
       A stage is one part or an array of parts: { kind, dx, dz, ...opts } (any spawnProp kind; dx, dz are in the object's own space, turned by ry;
       for kind 'building' give style: 'cabin' | 'shed' | 'house' | 'shop' ... plus w, d, h, col, roof, f, sign),
       or a function (x, z, ry, level) => thing-with-remove() | array of them. additive: true keeps every stage up to the level (a fund that adds benches,
       then a fountain); otherwise only the current stage stands. level -1 = nothing yet. -> { id, level, setLevel(n), remove() } */
    staged(o) { const id = o.id || uid('sg-'), ry = o.ry || 0, stages = o.stages || []; let parts = [], level = -1;
      const build = (i) => { const out = [], st = stages[i]; if (!st) return out; if (typeof st === 'function') { const r = st(o.x, o.z, ry, i); for (const q of Array.isArray(r) ? r : [r]) if (q && q.remove) out.push(q); return out; }
        for (const part of Array.isArray(st) ? st : [st]) { const { kind, dx = 0, dz = 0, style, ...opts } = part; if (style) opts.kind = style; const x = o.x + Math.cos(ry) * dx + Math.sin(ry) * dz, z = o.z - Math.sin(ry) * dx + Math.cos(ry) * dz; try { out.push(world.scenery.spawn(kind, x, z, { ...opts, ry: (opts.ry || 0) + ry })); } catch (e) { console.error('[staged ' + id + ']', e); } } return out; };
      const h = track(id, () => { for (const p of parts) p.remove(); parts = []; }, { x: o.x, z: o.z });
      h.setLevel = (n, quiet) => { n = clamp(Math.floor(n), -1, stages.length - 1); if (n === level) return level; for (const p of parts) p.remove(); parts = []; level = n; if (n >= 0) for (let i = o.additive ? 0 : n; i <= n; i++) parts.push(...build(i));
        if (!quiet) { fx.burst('spark', o.x, world.groundAt(o.x, o.z, 200) + 1.2, o.z, 16); bus.emit('stageChanged', { id, level }); } return level; };
      Object.defineProperty(h, 'level', { get: () => level }); h.setLevel(o.level ?? 0, true); return h; },
    get: id => placed.get(id) || null,
    remove: id => { const h = placed.get(id); if (h) h.remove(); return !!h; },
    /* remove everything whose id starts with the prefix (a mission cleaning up after itself: place.removeAll('m3:')) */
    removeAll: prefix => { let n = 0; for (const [id, h] of [...placed]) if (id.startsWith(prefix)) { h.remove(); n++; } return n; }
  };
  const pickups = new Map();
  function pickupGeo(kind, col) {
    const g = new Geo();
    if (kind === 'flag') { g.cyl(0, -0.5, 0, 0.03, 0.03, 1.0, 5, 0xf4f4ef); g.box(0.24, 0.3, 0, 0.46, 0.3, 0.03, col ?? 0xd9534f); }
    else if (kind === 'disc') { g.cyl(0, -0.03, 0, 0.3, 0.3, 0.06, 10, col ?? 0x3f9fd6, 0xffffff); }
    else if (kind === 'lantern') { g.cyl(0, -0.2, 0, 0.16, 0.2, 0.4, 7, col ?? 0xffb238, 0x2a2c30); g.cyl(0, 0.2, 0, 0.08, 0.02, 0.1, 5, 0x2a2c30); }
    else if (kind === 'litter') { g.ball(0, 0, 0, 0.16, 0.13, 0.15, col ?? 0xdadad2, 5, 3, true); }
    else if (kind === 'parcel') { g.box(0, 0, 0, 0.42, 0.3, 0.32, col ?? 0xc9a67a); g.box(0, 0, 0, 0.44, 0.06, 0.34, 0xd9534f); }
    else if (kind === 'paper') { g.tf(0, 0, 0, 0, 0, Math.PI / 2); g.cyl(0, -0.22, 0, 0.08, 0.08, 0.44, 7, col ?? 0xf4f1e8, 0xdadad2); g.notf(); g.box(0, 0, 0, 0.05, 0.17, 0.17, 0x3f7fd6); }
    else if (kind === 'bucket') { g.cyl(0, -0.18, 0, 0.14, 0.2, 0.36, 8, col ?? 0xd9534f, 0xe8d9a8); }
    else if (kind === 'glove') { g.box(0, 0, 0, 0.2, 0.26, 0.09, col ?? 0x3f7fd6); g.box(0.14, -0.02, 0, 0.09, 0.14, 0.08, col ?? 0x3f7fd6); }
    else if (kind === 'pumpkin') { g.ball(0, 0, 0, 0.24, 0.2, 0.24, col ?? 0xf08a2a, 7, 4, true); g.cyl(0, 0.18, 0, 0.03, 0.02, 0.08, 4, 0x4f7f3f); }
    else if (kind === 'treat') { g.tf(0, 0, 0, 0, 0, Math.PI / 2); g.cyl(0, -0.2, 0, 0.055, 0.055, 0.4, 6, col ?? 0xb5553a); g.notf(); for (const s of [-1, 1]) g.ball(s * 0.2, 0, 0, 0.075, 0.075, 0.06, col ?? 0xb5553a, 5, 3); }
    else { const c = col ?? 0xffd23c; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5, a1 = a + TAU / 10, a0 = a - TAU / 10, R = 0.3, r = 0.13; for (const z of [0.05, -0.05]) g.tri([Math.cos(a) * R, -Math.sin(a) * R, 0], [Math.cos(a0) * r, -Math.sin(a0) * r, z], [Math.cos(a1) * r, -Math.sin(a1) * r, z], c, [0, 0, -z * 9]); } g.ball(0, 0, 0, 0.14, 0.14, 0.07, c, 5, 3); }
    return g.build();
  }

  /* ================= timed runs =================
     game.timedRun({ id, label, seconds (count down; leave out for a stop-watch), checkpoints: [{ x, z, r, label }], onCheckpoint(i, run), onFinish({ ok, time, left, reason }),
                     color, keepObjective }) -> run: { id, time, left, index, total, finish(ok, reason), cancel(), addTime(s) }
     The HUD shows the label and the clock under the compass, and the next checkpoint is the objective (compass, minimap, map, light pillar).
     Reaching the last checkpoint finishes the run (ok: true); the clock running out fails it (reason 'time'). With no checkpoints the module
     calls run.finish(true) itself. One run at a time: starting another ends the first with reason 'replaced'. game.run is the current one. */
  game.run = null;
  const mmss = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
  game.timedRun = (o = {}) => {
    if (game.run) game.run.finish(false, 'replaced');
    const cps = (o.checkpoints || []).map(c => ({ r: 3, ...c })), prevObj = api.objective;
    const run = { id: o.id || uid('run-'), label: o.label || '', time: 0, left: Number.isFinite(o.seconds) ? o.seconds : null, index: 0, total: cps.length, done: false };
    const aim = () => { const c = cps[run.index]; if (c) api.setObjective({ x: c.x, z: c.z, label: c.label || o.label || 'Next', color: o.color, progress: null }); };
    run.addTime = s => { if (run.left != null) run.left += s; };
    run.finish = (ok, reason) => { if (run.done) return; run.done = true; if (game.run === run) game.run = null; ui.setTimer(null); if (cps.length && !o.keepObjective) api.setObjective(prevObj || null);
      const res = { id: run.id, ok: !!ok, time: +run.time.toFixed(2), left: run.left == null ? null : Math.max(0, +run.left.toFixed(2)), reason: reason || (ok ? 'done' : 'cancelled') }; bus.emit('runEnd', res); if (o.onFinish) try { o.onFinish(res); } catch (e) { console.error(e); } };
    run.cancel = () => run.finish(false, 'cancelled');
    run.tick = dt => { if (run.done) return; run.time += dt; if (run.left != null) { run.left -= dt; if (run.left <= 0) { run.left = 0; return run.finish(false, 'time'); } }
      const c = cps[run.index]; if (c && Math.hypot(kc.pos.x - c.x, kc.pos.z - c.z) <= c.r) { const i = run.index++; game.audio.sfx('pickup'); fx.burst('spark', c.x, kc.pos.y + 1, c.z, 10); bus.emit('runCheckpoint', { id: run.id, index: i, total: cps.length }); if (o.onCheckpoint) try { o.onCheckpoint(i, run); } catch (e) { console.error(e); } if (run.done) return; if (run.index >= cps.length) return run.finish(true, 'done'); aim(); }
      ui.setTimer((run.label ? run.label + '  ' : '') + mmss(run.left != null ? run.left : run.time) + (cps.length ? `  ·  ${run.index}/${cps.length}` : ''), { warn: run.left != null && run.left < 10 }); };
    game.run = run; aim(); run.tick(0); bus.emit('runStart', { id: run.id, seconds: run.left, checkpoints: cps.length }); return run;
  };

  /* ================= fast travel =================
     game.travel.add({ id, name, x, z, yaw, color, enabled() }) -> remove()   a point on the world map (blue diamond) with a button under the map
     game.travel.go(id)                                                         travel to a registered point (closes the map)
     game.fastTravel(x, z, yaw, { name, id, toast }) -> boolean                 fade out, move KC (she steps off any ride), fade in. Emits `fastTravel`.
     game.travel.blocked = 'Finish the delivery first'                           a module can hold travel (during a mission); null lets it go again */
  const points = new Map();
  game.travel = {
    blocked: null,
    add(p) { if (!p || !p.id) throw new Error('travel point needs an id'); points.set(p.id, p); return () => { if (points.get(p.id) === p) points.delete(p.id); }; },
    remove: id => points.delete(id),
    list: () => [...points.values()].filter(p => !p.enabled || p.enabled()).map(p => ({ id: p.id, name: p.name || p.id, x: p.x, z: p.z, yaw: p.yaw, color: p.color })),
    go(id) { const p = points.get(id); if (!p || (p.enabled && !p.enabled())) return false; return game.fastTravel(p.x, p.z, p.yaw, { name: p.name, id: p.id }); }
  };
  game.fastTravel = (x, z, yaw, o = {}) => {
    if (game.travel.blocked) { ui.toast(typeof game.travel.blocked === 'string' ? game.travel.blocked : 'KC cannot travel right now.', { icon: 'flag', kind: 'warn' }); return false; }
    if (!Number.isFinite(x) || !Number.isFinite(z) || ui.fading) return false;
    ui.closeAll(); const from = { x: kc.pos.x, z: kc.pos.z };
    ui.fade(() => { kc.teleport(x, z, yaw); if (yaw != null) game.cam.yaw = yaw; game.cam.snap(); for (const d of game.npcs.followers) { d.x = kc.pos.x - 1.2; d.z = kc.pos.z - 1.2; }
      if (o.toast !== false && o.name) ui.toast('Arrived: ' + o.name, { icon: 'flag' }); bus.emit('fastTravel', { id: o.id || null, name: o.name || null, x: kc.pos.x, z: kc.pos.z, from }); });
    return true;
  };

  /* per-frame work */
  bus.on('tick', e => {
    if (game.run) game.run.tick(e.dt);
    if (pickups.size) { const kx = kc.pos.x, kz = kc.pos.z, ky = kc.pos.y;
      for (const it of [...pickups.values()]) { it.t += e.dt; const d = Math.hypot(kx - it.x, kz - it.z); if (d > 120) { it.mesh.visible = false; continue; } it.mesh.visible = true; it.mesh.rotation.y = it.t * 1.6; if (it.bob) it.mesh.position.y = it.y + Math.sin(it.t * 2.4) * 0.12;
        if (d < it.r && Math.abs(ky + 0.5 - it.y) < 3) { const h = placed.get(it.id); fx.burst('spark', it.x, it.y, it.z, 8); game.audio.sfx('pickup'); if (h) h.remove(); bus.emit('collect', { id: it.id, kind: it.kind, x: it.x, z: it.z }); if (it.onCollect) try { it.onCollect(it); } catch (err) { console.error(err); } } } }
  });
  return { placed, pickups, points };
}
