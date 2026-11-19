/* KC: Open Trail. Boot, main loop, quality management and debug hooks.
   Structure and extension points are described in ARCHITECTURE.md. */
import { THREE, clamp } from './util.js';
import { createBus } from './events.js';
import { createSave } from './save.js';
import { createWorld } from './world.js';
import { createFx } from './fx.js';
import { createKC } from './kc.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createApi } from './api.js';
import { createHud } from './hud.js';
import { createNPCs } from './npc.js';
import { createVehicles } from './vehicles.js';
import { createCollect } from './collect.js';
import { createAudio } from './audio.js';
import { SPAWN, HALF } from './data.js';
import { createSeams } from './seams.js';
import { detectChannel } from './channel.js';
/* feature modules: each exports init(game) and never edits a core file (ARCHITECTURE.md, "Module seams") */
import * as economy from './economy.js';
import * as upgrades from './upgrades.js';
import * as shop from './shop.js';
import * as missions from './missions.js';
import * as store from './store.js';
import * as merch from './merch.js';
import * as guide from './guide.js';   /* first steps for a new player; booted last because it only points at what the others built */

export const VERSION = '0.3.0';
/* the debug hooks (window.__ot can hand out gems and items) exist on a developer's own machine only: on any other host ?debug=1 does nothing */
const params = new URLSearchParams(location.search), DEBUG = params.get('debug') === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const QUALITY = {
  low: { name: 'low', pr: 1, fog: 130, veg: 0.3, shadows: false, texSize: 1024 },
  medium: { name: 'medium', pr: 1.5, fog: 190, veg: 0.65, shadows: false, texSize: 2048 },
  high: { name: 'high', pr: 2, fog: 280, veg: 1, shadows: true, texSize: 2048 }
};
const $ = id => document.getElementById(id);

function boot() {
  const canvas = $('game'), playBtn = $('playBtn');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2.5, powerPreference: 'high-performance' }); }
  catch (e) { playBtn.textContent = 'This device cannot run 3D (WebGL) games'; return; }
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* if the GPU drops the context (common on phones after a long background), reload cleanly; the save is already on disk */
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); }); canvas.addEventListener('webglcontextrestored', () => location.reload());
  const scene = new THREE.Scene();
  const bus = createBus();
  const game = { VERSION, THREE, renderer, scene, bus, on: bus.on, off: bus.off, emit: bus.emit, debug: DEBUG, time: 0, paused: false, modules: {} };
  /* 'play' inside the Google Play app, 'web' anywhere else (js/channel.js). The store, the dollar hints and the Settings wording follow it. */
  game.channel = detectChannel(window); game.showUsd = game.channel !== 'play';
  game.save = createSave(game); const had = game.save.load(); const state = game.state = game.save.state;
  if (!had) { const coarse = matchMedia('(pointer: coarse)').matches; state.settings.quality = coarse ? ((navigator.deviceMemory || 4) <= 2 ? 'low' : 'medium') : 'high'; }
  if (params.get('q') && QUALITY[params.get('q')]) state.settings.quality = params.get('q');
  game.quality = { ...QUALITY[state.settings.quality] }; game.quality.boot = game.quality.name; let resScale = 1;
  /* the ground texture is painted once at boot: 1024 when booting on Low, 2048 on Medium / High, 4096 on desktop-class GPUs only */
  { const coarse = matchMedia('(pointer: coarse)').matches, q = state.settings.quality; if (renderer.capabilities.maxTextureSize >= 8192 && q !== 'low' && (!coarse || (q === 'high' && (navigator.deviceMemory || 4) >= 6))) game.quality.texSize = 4096; }
  const input = game.input = createInput(game, canvas);
  game.audio = createAudio(game);
  game.fx = createFx(game);
  const world = game.world = createWorld(game);
  world.time = state.time; world.day = state.day;
  const cam = game.cam = createCamera(game);
  game.camera = cam.three;
  const api = game.api = createApi(game);
  const ui = game.ui = createHud(game);
  const kc = game.kc = createKC(game);
  const npcs = game.npcs = createNPCs(game);
  const vehicles = game.vehicles = createVehicles(game);
  const collect = game.collect = createCollect(game);
  /* flat aliases so other modules can write game.addMarker(...) etc. */
  for (const k of ['addInteractable', 'removeInteractable', 'addMarker', 'removeMarker', 'addZone', 'removeZone', 'spawnProp', 'setObjective', 'addCarriable']) game[k] = api[k];
  game.setModifier = kc.setModifier; game.getModifier = kc.getModifier; game.setCosmetic = kc.setCosmetic; game.setSkin = vehicles.setSkin;
  game.openModal = ui.openModal; game.closeModal = ui.closeModal; game.toast = ui.toast; game.banner = ui.banner;
  game.moduleData = game.save.moduleData;
  game.seams = createSeams(game);   /* game.cosmetics, game.place, game.timedRun, game.travel, game.fastTravel, game.followers */
  /* friendlier names for a few core events, so modules can listen for what the design documents call them */
  bus.on('pickup', e => { if (e.kind === 'bone') bus.emit('boneCollected', e); });
  bus.on('npcTalk', e => bus.emit('talk', e));
  bus.on('timeOfDay', e => { if (e.phase === 'night' || e.phase === 'dawn') bus.emit('dayNight', { night: e.phase === 'night', phase: e.phase, time: e.time, day: e.day }); });
  bus.on('swimStart', e => bus.emit('swim', { ...e, on: true })); bus.on('swimEnd', e => bus.emit('swim', { ...e, on: false }));
  bus.on('vehicleEnter', e => bus.emit('ride', { ...e, on: true })); bus.on('vehicleExit', e => bus.emit('ride', { ...e, on: false }));

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, game.quality.pr) * resScale); renderer.setSize(w, h, false); cam.resize(w, h);
  }
  game.setQuality = (name, manual) => {
    if (!QUALITY[name]) return; const tex = game.quality.texSize, boot = game.quality.boot; game.quality = { ...QUALITY[name], texSize: tex, boot }; state.settings.quality = name; resScale = 1;
    if (manual) { state.settings.autoQuality = false; game.save.save(); }
    world.applyQuality(game.quality); game.fx.setBlobs(true); resize(); bus.emit('quality', { name });
  };
  world.applyQuality(game.quality); world.setFestival(!!state.flags.festival); bus.on('flag', e => { if (e.key === 'festival') world.setFestival(!!e.value); }); resize(); addEventListener('resize', resize);
  if (state.pos && Number.isFinite(state.pos.x) && Number.isFinite(state.pos.z)) kc.teleport(state.pos.x, state.pos.z, Number.isFinite(state.pos.yaw) ? state.pos.yaw : SPAWN.yaw); else kc.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
  if (Number.isFinite(state.settings.camDist)) cam.dist = clamp(state.settings.camDist, 2.6, 13);
  cam.yaw = kc.yaw; cam.snap();
  /* saved while riding: KC is put down beside the ride (which keeps its own saved spot), not inside it */
  bus.on('beforeSave', s => { const r = kc.ride, off = r ? r.r + 1.3 : 0, x = r ? r.x + Math.cos(r.yaw) * off : kc.pos.x, z = r ? r.z - Math.sin(r.yaw) * off : kc.pos.z; if (!Number.isFinite(x) || !Number.isFinite(z)) return; s.pos = { x: +x.toFixed(2), z: +z.toFixed(2), yaw: Number.isFinite(kc.yaw) ? +kc.yaw.toFixed(2) : SPAWN.yaw }; if (!ui.photo) s.settings.camDist = +clamp(cam.dist, 2.6, 13).toFixed(2); });

  /* feature modules: each exports init(game); boot order matters (economy before everything that prices or grants) */
  for (const [name, mod] of [['economy', economy], ['upgrades', upgrades], ['shop', shop], ['missions', missions], ['store', store], ['merch', merch], ['guide', guide]]) { try { game.modules[name] = (mod.init && mod.init(game)) || mod; } catch (e) { console.error('[module ' + name + ']', e); } }
  game.cosmetics.restore(); bus.emit('modulesReady', { names: Object.keys(game.modules) });

  /* ---------- loop ---------- */
  const frameStats = { n: 0, sum: 0, max: 0, cpuSum: 0 };
  let last = performance.now(), acc1 = 0, saveT = 0, ema = 16, slowT = 0, coolT = 8, pausedDraw = 0, fpsEma = 60;
  function sim(dt) {
    game.time += dt; input.poll(dt);
    if (input.pressed.pause) { ui.pause(); input.endFrame(); return; }
    if (input.pressed.map) { ui.map(); input.endFrame(); return; }
    if (input.pressed.photo) { ui.photoMode(true); input.endFrame(); return; }
    if (input.pressed.bark) kc.doBark(); if (input.pressed.sit) kc.doSit(); if (input.pressed.dig) kc.doDig(); if (input.pressed.shake) kc.doShake();
    api.update(dt, input); kc.update(dt, input); vehicles.update(dt, input); npcs.update(dt); collect.update(dt);
    cam.update(dt, input); world.update(dt, cam.three.position, kc.pos); game.fx.update(dt); game.audio.update(dt); ui.update(dt);
    state.stats.playTime += dt; bus.emit('tick', { dt, t: game.time });
    acc1 += dt; if (acc1 >= 1) { acc1 -= 1; bus.emit('second', { t: game.time }); }
    saveT += dt; if (saveT > 20) { saveT = 0; game.save.save(); }
    input.endFrame();
  }
  const render = game.renderNow = () => renderer.render(scene, cam.three);
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000; last = now;
    if (document.hidden || raw <= 0) return;
    const dt = Math.min(0.1, raw); game.paused = !ui.started || ui.isPaused() || ui.photo;
    if (!ui.started) { input.poll(dt); input.endFrame(); cam.yaw += dt * 0.07; cam.update(dt, { camX: 0, camY: 0, zoom: 0 }); kc.update(dt, { moveX: 0, moveY: 0, pressed: {}, sprint: false }); npcs.update(dt); vehicles.update(dt, { moveX: 0, moveY: 0, pressed: {} }); collect.update(dt); world.update(dt, cam.three.position, kc.pos); game.fx.update(dt); render(); return; }
    if (ui.photo) { input.poll(dt); if (input.pressed.pause || input.pressed.photo) ui.photoMode(false); if (input.pressed.interact || input.pressed.jump) ui.snap(); input.enabled = true; cam.update(dt, input); world.update(0, cam.three.position, kc.pos); input.endFrame(); render(); return; }
    if (game.paused) { input.poll(dt); if (input.pressed.pause && ui.current && ui.current.dismissable !== false) ui.closeModal(); input.endFrame(); pausedDraw -= dt; if (pausedDraw <= 0) { pausedDraw = 0.5; render(); } return; }
    input.enabled = !ui.modalOpen;
    const c0 = performance.now(); const steps = Math.min(3, Math.ceil(dt / 0.034)); for (let i = 0; i < steps; i++) sim(dt / steps);
    render();
    frameStats.n++; frameStats.sum += raw * 1000; frameStats.max = Math.max(frameStats.max, raw * 1000); frameStats.cpuSum += performance.now() - c0;
    /* automatic step-down when frames stay slow */
    ema += (raw * 1000 - ema) * 0.05; fpsEma = 1000 / ema; coolT -= raw;
    if (state.settings.autoQuality && coolT <= 0) {
      if (ema > 36) { slowT += raw; if (slowT > 3) { slowT = 0; coolT = 7; const q = state.settings.quality;
        if (q === 'high') { game.setQuality('medium'); ui.toast('Graphics set to Medium for smoother play'); } else if (q === 'medium') { game.setQuality('low'); ui.toast('Graphics set to Low for smoother play'); } else if (resScale > 0.62) { resScale = resScale > 0.8 ? 0.75 : 0.6; resize(); } } }
      else slowT = Math.max(0, slowT - raw);
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { game.save.save(); game.audio.suspend(); input.debugKeys.clear(); } else { last = performance.now(); if (ui.started && !ui.modalOpen && !ui.photo) ui.pause(); game.audio.resume(); } });
  addEventListener('pagehide', () => game.save.save());
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => game.audio.unlock(), { passive: true });

  /* a save that has never been played (first run, or straight after Start over) is a new game */
  const fresh = !had || (!state.pos && state.stats.playTime < 1);
  playBtn.disabled = false; playBtn.textContent = fresh ? 'Play' : 'Continue';
  playBtn.addEventListener('click', () => { game.audio.unlock(); game.audio.sfx('ui'); cam.yaw = kc.yaw; cam.snap(); ui.start(); if (fresh) { ui.toast('Welcome to St. Helens! Clockkeeper Odile on the plaza has a first job for KC.', { icon: 'paw', ms: 4200 }); } });
  requestAnimationFrame(frame);
  window.dispatchEvent(new CustomEvent('kc-open-trail-ready', { detail: { version: VERSION } }));

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});

  /* ---------- debug hooks: only with ?debug=1, and only on localhost ---------- */
  if (DEBUG) {
    const log = []; bus.on('*', (d, type) => { if (type === 'tick' || type === 'second') return; log.push({ type, t: +game.time.toFixed(2), d: d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v !== 'object' && typeof v !== 'function')) : d }); if (log.length > 400) log.shift(); });
    window.__ot = {
      game, ready: true, events: log, channel: game.channel,
      state: () => ({ version: VERSION, started: ui.started, paused: game.paused, modal: ui.current ? ui.current.id || true : null, photo: ui.photo, pos: { x: kc.pos.x, y: kc.pos.y, z: kc.pos.z, yaw: kc.yaw }, speed: kc.speed, onGround: kc.onGround, swimming: kc.swimming, sprinting: kc.sprinting, sit: kc.sit, stamina: kc.stamina, staminaMax: kc.staminaMax,
        run: game.run ? { id: game.run.id, time: game.run.time, left: game.run.left, index: game.run.index } : null, followers: npcs.followers.length, equipped: { ...state.equipped }, spending: !!state.settings.spending,
        ride: kc.ride ? kc.ride.id : null, rideSpeed: kc.ride ? kc.ride.speed : 0, carrying: kc.carried.map(i => i.id), zone: api.zone && api.zone.id, prompt: api.prompt && api.prompt.label, wallet: { ...state.wallet }, festival: world.festival, flags: { ...state.flags }, time: world.time, day: world.day, night: world.night, rain: world.rain,
        quality: state.settings.quality, resScale, fps: Math.round(fpsEma), cam: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.cur, x: cam.three.position.x, y: cam.three.position.y, z: cam.three.position.z }, mods: { ...kc.mods }, stats: { ...state.stats }, collected: collect.counts(), ground: world.heightAt(kc.pos.x, kc.pos.z) }),
      start: () => { if (!ui.started) playBtn.click(); },
      teleport: (x, z, yaw) => { kc.teleport(x, z, yaw); if (yaw != null) cam.yaw = yaw; cam.snap(); },
      give: (o = {}) => { game.economy.grant(o, 'debug'); return { ...state.wallet }; },
      setTime: t => { world.setTime(t); },
      setRain: v => world.setRain(v),
      setQuality: q => { state.settings.autoQuality = false; game.setQuality(q); },
      setCam: (yaw, pitch, dist) => { if (yaw != null) cam.yaw = yaw; if (pitch != null) cam.pitch = pitch; if (dist != null) cam.dist = dist; cam.manualT = 0; cam.snap(); },
      step: (n = 1, dt = 1 / 30) => { input.enabled = !ui.modalOpen; for (let i = 0; i < n; i++) sim(dt); render(); return true; },
      info: () => { render(); const r = renderer.info.render; return { calls: r.calls, triangles: r.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; },
      press: a => input.press(a), hold: (code, down) => { if (down) input.debugKeys.add(code); else input.debugKeys.delete(code); },
      festival: on => game.economy.setFlag('festival', on !== false), setFlag: (k, v) => game.economy.setFlag(k, v), grant: (what, src) => game.economy.grant(what, src || 'debug'),
      districts: () => api.districts.map(z => ({ id: z.id, name: z.name })), zoneAt: (x, z) => world.zoneAt(x, z).id, surfaceAt: (x, z) => world.SURF[world.surfaceAt(x, z)], heightAt: (x, z) => world.heightAt(x, z),
      frameStats: () => ({ ...frameStats }), resetFrameStats: () => { frameStats.n = 0; frameStats.sum = 0; frameStats.max = 0; frameStats.cpuSum = 0; },
      enter: id => vehicles.enter(id), exit: () => vehicles.exit(), rides: () => vehicles.rides.map(r => ({ id: r.id, kind: r.kind, x: r.x, z: r.z, y: r.y })), transit: () => vehicles.transit.map(t => ({ id: t.id, kind: t.kind, x: t.x, z: t.z, speed: t.speed, dir: t.dir, wait: t.wait })),
      save: () => game.save.save(), toast: t => ui.toast(t),
      startMission: id => { const m = game.modules.missions; return m && m.start ? m.start(id) : false; },
      completeMission: () => { const m = game.modules.missions; return m && m.complete ? m.complete() : false; },
      emit: (type, d) => bus.emit(type, d),
      follow: o => !!game.followers.add(o || {}), unfollow: id => game.followers.dismiss(id), followers: () => npcs.followers.map(d => ({ id: d.follow.id, name: d.name, x: d.x, z: d.z, y: d.y, left: d.follow.left })),
      tune: (kind, patch, src) => vehicles.setTuning(kind, patch, src), tuning: kind => vehicles.getTuning(kind),
      mod: (id, m, o) => kc.setModifier(id, m, o), travel: (x, z, yaw, o) => game.fastTravel(x, z, yaw, o), modules: () => Object.keys(game.modules)
    };
  }
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(boot, 30)); else setTimeout(boot, 30);
