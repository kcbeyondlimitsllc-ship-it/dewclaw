/* The registry other modules build on: interactables, markers, zones, the
   objective pointer, the wallet and prop spawning. Documented in ARCHITECTURE.md. */
import { THREE, clamp } from './util.js';
import { ZONES } from './data.js';

export function createApi(game) {
  const { bus, state, scene } = game;
  const inter = new Map(), markers = new Map(), zones = new Map();
  const api = { interactables: inter, markers, zones, objective: null, prompt: null, zone: null };
  const posOf = o => (o.getPos ? o.getPos() : o);

  /* ---- wallet ---- */
  game.wallet = {
    get: cur => state.wallet[cur] || 0,
    can: (cur, n) => (state.wallet[cur] || 0) >= n,
    add(cur, n, reason = '') { if (!(cur in state.wallet) || !Number.isFinite(n) || n === 0) return state.wallet[cur] || 0; const before = state.wallet[cur]; state.wallet[cur] = Math.max(0, Math.round(before + n)); bus.emit('wallet', { currency: cur, amount: state.wallet[cur], delta: state.wallet[cur] - before, reason }); return state.wallet[cur]; },
    spend(cur, n, reason = '') { if (!(cur in state.wallet) || !Number.isFinite(n) || n < 0 || !game.wallet.can(cur, n)) return false; if (n > 0) game.wallet.add(cur, -n, reason); return true; }
  };

  /* ---- economy seam: the default implementation the economy / shop modules build on or replace ----
     grant({ bones, gems, items: [id | { id, n }] }, source), owns(id), catalog (array the economy module fills),
     setFlag(key, value) / getFlag(key): saved world flags; the core reacts to 'festival'. */
  game.economy = {
    catalog: [],
    grant(what, source = '') {
      what = what && typeof what === 'object' ? what : {};
      const out = { bones: 0, gems: 0, items: [] }, list = Array.isArray(what.items) ? what.items : what.items && typeof what.items === 'object' ? [what.items] : typeof what.items === 'string' ? [what.items] : [];
      for (const cur of ['bones', 'gems']) if (Number.isFinite(what[cur]) && what[cur] !== 0) { const before = state.wallet[cur]; game.wallet.add(cur, what[cur], source); out[cur] = state.wallet[cur] - before; }
      for (const it of list) { const id = typeof it === 'string' ? it : it && it.id, raw = it && typeof it === 'object' && it.n != null ? Math.floor(Number(it.n)) : 1; if (!id || typeof id !== 'string') continue; if (!Number.isFinite(raw) || raw < 1) continue; const n = raw, cur = state.owned[id]; state.owned[id] = n > 1 || typeof cur === 'number' ? (typeof cur === 'number' ? cur : cur ? 1 : 0) + n : true; out.items.push(id); }
      bus.emit('grant', { ...out, source }); return out;
    },
    owns: id => !!state.owned[id],
    setFlag(key, value = true) { if (state.flags[key] === value) return value; state.flags[key] = value; bus.emit('flag', { key, value }); return value; },
    getFlag: key => state.flags[key]
  };
  /* ---- shop seam: tabs registered here appear in the Shop screen (pause menu) once there is at least one ---- */
  game.shop = {
    tabs: [],
    registerTab(tab) { if (!tab || !tab.id) throw new Error('shop tab needs an id'); const i = game.shop.tabs.findIndex(t => t.id === tab.id); if (i >= 0) game.shop.tabs[i] = tab; else game.shop.tabs.push(tab); bus.emit('shopTab', { id: tab.id }); return () => { const k = game.shop.tabs.indexOf(tab); if (k >= 0) game.shop.tabs.splice(k, 1); }; },
    open: id => game.ui && game.ui.shop && game.ui.shop(id)
  };

  /* ---- interactables: { id, x, z | getPos(), r, label | () => string, icon, prio, enabled(), onInteract() } ---- */
  api.addInteractable = o => { if (!o.id) o.id = 'i' + Math.random().toString(36).slice(2); inter.set(o.id, o); return { id: o.id, remove: () => inter.delete(o.id) }; };
  api.removeInteractable = id => inter.delete(id);
  /* ---- markers: { id, x, z | getPos(), icon, color, label, beacon, minimap } ---- */
  api.addMarker = o => { if (!o.id) o.id = 'm' + Math.random().toString(36).slice(2); markers.set(o.id, { minimap: true, color: '#ffb238', icon: 'paw', ...o }); return { id: o.id, remove: () => markers.delete(o.id) }; };
  api.removeMarker = id => markers.delete(id);
  /* ---- zones: { id, x, z, r } or { id, rect: [x0, z0, x1, z1] }, optional onEnter / onExit ---- */
  api.addZone = o => { if (!o.id) o.id = 'z' + Math.random().toString(36).slice(2); zones.set(o.id, { ...o, inside: false }); return { id: o.id, remove: () => zones.delete(o.id) }; };
  api.removeZone = id => zones.delete(id);
  /* ---- objective: { x, z | getPos(), label, color } or null ---- */
  api.setObjective = o => { api.objective = o || null; bus.emit('objective', api.objective); };
  /* ---- props: any builder in scenery.js (bench, lamp, signpost, stall, tent, crate, building, ...) ---- */
  api.spawnProp = (kind, x, z, opts) => game.world.scenery.spawn(kind, x, z, opts);

  /* beacons: light pillars over the objective and beacon markers */
  const BN = 8, bgeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 10, 1, true); bgeo.translate(0, 0.5, 0);
  const beams = new THREE.InstancedMesh(bgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }), BN);
  beams.frustumCulled = false; beams.renderOrder = 4; beams.name = 'beacons'; beams.count = 0; scene.add(beams);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), list = [];
  let t = 0, zoneT = 0;

  api.update = (dt, input) => {
    const { kc, world } = game; t += dt;
    /* zones */
    zoneT -= dt;
    if (zoneT <= 0) {
      zoneT = 0.2;
      const z = world.zoneAt(kc.pos.x, kc.pos.z);
      if (z !== api.zone) {
        if (api.zone) bus.emit('exitZone', { id: api.zone.id, name: api.zone.name, district: true });
        api.zone = z; const first = !state.collected.zones.includes(z.id);
        if (first) state.collected.zones.push(z.id);
        bus.emit('enterZone', { id: z.id, name: z.name, district: true, first });
        if (first) bus.emit('discover', { id: z.id, name: z.name });
      }
      for (const zn of zones.values()) {
        const inside = zn.rect ? kc.pos.x >= zn.rect[0] && kc.pos.z >= zn.rect[1] && kc.pos.x <= zn.rect[2] && kc.pos.z <= zn.rect[3] : Math.hypot(kc.pos.x - zn.x, kc.pos.z - zn.z) <= (zn.r || 5);
        if (inside !== zn.inside) { zn.inside = inside; bus.emit(inside ? 'enterZone' : 'exitZone', { id: zn.id, name: zn.name, custom: true, zone: zn }); const cb = inside ? zn.onEnter : zn.onExit; if (cb) try { cb(zn); } catch (e) { console.error(e); } }
      }
    }
    /* nearest interactable */
    let best = null, bs = 1e9;
    if (!game.ui.modalOpen) for (const o of inter.values()) {
      const p = posOf(o); if (!p) continue; const d = Math.hypot(kc.pos.x - p.x, kc.pos.z - p.z), r = o.r || 2.2; if (d > r) continue;
      if (o.enabled && !o.enabled()) continue;
      const s = d / r - (o.prio || 0) * 0.35; if (s < bs) { bs = s; best = o; }
    }
    api.prompt = kc.ride ? { id: 'ride-exit', label: kc.ride.kind === 'van' ? 'Hop out' : 'Hop off', icon: 'paw' } : best ? { id: best.id, label: typeof best.label === 'function' ? best.label() : best.label || 'Sniff', icon: best.icon || 'paw', target: best } : kc.carried.length ? { id: 'carry', label: kc.carried[kc.carried.length - 1].useLabel || 'Drop it', icon: 'paw' } : null;
    if (input.pressed.interact && api.prompt) {
      const p = api.prompt;
      if (p.id === 'ride-exit') game.vehicles.exit();
      else if (p.target) { bus.emit('interact', { id: p.target.id, kind: p.target.kind || 'interactable', target: p.target }); try { p.target.onInteract && p.target.onInteract(p.target); } catch (e) { console.error(e); } }
      else if (p.id === 'carry') { const it = kc.carried[kc.carried.length - 1]; if (it.onUse) it.onUse(it); else kc.drop(); }
    }
    /* beacons */
    list.length = 0;
    if (api.objective) { const p = posOf(api.objective); if (p) list.push({ x: p.x, z: p.z, c: api.objective.color || '#ffd23c', big: true }); }
    for (const m of markers.values()) if (m.beacon && list.length < BN) { const p = posOf(m); if (p && Math.hypot(kc.pos.x - p.x, kc.pos.z - p.z) < 170) list.push({ x: p.x, z: p.z, c: m.color }); }
    for (let i = 0; i < list.length; i++) { const b = list[i], y = world.groundAt(b.x, b.z, 200), w = (b.big ? 1.5 : 1) * (1 + Math.sin(t * 3 + i) * 0.12); m4.makeScale(w, b.big ? 60 : 26, w); m4.setPosition(b.x, y, b.z); beams.setMatrixAt(i, m4); beams.setColorAt(i, col.set(b.c)); }
    beams.count = list.length; beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  };
  api.districts = ZONES;
  return api;
}
