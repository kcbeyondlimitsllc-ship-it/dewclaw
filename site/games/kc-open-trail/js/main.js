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
import * as missions from './missions.js';
import * as economy from './economy.js';
import * as shop from './shop.js';
import * as store from './store.js';

export const VERSION = '0.1.0';
const params = new URLSearchParams(location.search), DEBUG = params.get('debug') === '1';
const QUALITY = {
  low: { name: 'low', pr: 1, fog: 120, veg: 0.35, shadows: false, texSize: 1024 },
  medium: { name: 'medium', pr: 1.5, fog: 175, veg: 0.7, shadows: false, texSize: 2048 },
  high: { name: 'high', pr: 2, fog: 250, veg: 1, shadows: true, texSize: 2048 }
};
const $ = id => document.getElementById(id);

function boot() {
  const canvas = $('game'), playBtn = $('playBtn');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2.5, powerPreference: 'high-performance' }); }
  catch (e) { playBtn.textContent = 'This device cannot run 3D (WebGL) games'; return; }
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const bus = createBus();
  const game = { VERSION, THREE, renderer, scene, bus, on: bus.on, off: bus.off, emit: bus.emit, debug: DEBUG, time: 0, paused: false, modules: {} };
  game.save = createSave(game); const had = game.save.load(); const state = game.state = game.save.state;
  if (!had) { const coarse = matchMedia('(pointer: coarse)').matches; state.settings.quality = coarse ? ((navigator.deviceMemory || 4) <= 2 ? 'low' : 'medium') : 'high'; }
  if (params.get('q') && QUALITY[params.get('q')]) state.settings.quality = params.get('q');
  game.quality = { ...QUALITY[state.settings.quality] }; let resScale = 1;
  /* sharper ground on desktop-class GPUs only; phones keep the 2048 / 1024 texture */
  if (state.settings.quality === 'high' && !matchMedia('(pointer: coarse)').matches && renderer.capabilities.maxTextureSize >= 8192) game.quality.texSize = 4096;
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
  game.mischief = npcs.mischief;
  const vehicles = game.vehicles = createVehicles(game);
  const collect = game.collect = createCollect(game);
  /* flat aliases so other modules can write game.addMarker(...) etc. */
  for (const k of ['addInteractable', 'removeInteractable', 'addMarker', 'removeMarker', 'addZone', 'removeZone', 'spawnProp', 'setObjective', 'addCarriable']) game[k] = api[k];
  game.setModifier = kc.setModifier; game.setCosmetic = kc.setCosmetic; game.setSkin = vehicles.setSkin;
  game.openModal = ui.openModal; game.closeModal = ui.closeModal; game.toast = ui.toast;
  game.moduleData = game.save.moduleData;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, game.quality.pr) * resScale); renderer.setSize(w, h, false); cam.resize(w, h);
  }
  game.setQuality = (name, manual) => {
    if (!QUALITY[name]) return; const tex = game.quality.texSize; game.quality = { ...QUALITY[name], texSize: tex }; state.settings.quality = name; resScale = 1;
    if (manual) { state.settings.autoQuality = false; game.save.save(); }
    world.applyQuality(game.quality); game.fx.setBlobs(true); resize(); bus.emit('quality', { name });
  };
  world.applyQuality(game.quality); world.setHalloween(state.settings.halloween); resize(); addEventListener('resize', resize);
  if (state.pos) kc.teleport(state.pos.x, state.pos.z, state.pos.yaw ?? SPAWN.yaw); else kc.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
  cam.yaw = kc.yaw; cam.snap();
  bus.on('beforeSave', s => { const r = kc.ride; s.pos = { x: +(r ? r.x : kc.pos.x).toFixed(2), z: +(r ? r.z : kc.pos.z).toFixed(2), yaw: +kc.yaw.toFixed(2) }; });

  /* other agents' modules: each exports init(game) */
  for (const [name, mod] of [['economy', economy], ['missions', missions], ['shop', shop], ['store', store]]) { try { game.modules[name] = (mod.init && mod.init(game)) || mod; } catch (e) { console.error('[module ' + name + ']', e); } }

  /* ---------- loop ---------- */
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
    if (ui.photo) { input.poll(dt); if (input.pressed.pause || input.pressed.photo) ui.photoMode(false); if (input.pressed.interact || input.pressed.jump) ui.snap(); input.enabled = true; cam.update(dt, input); world.update(0, cam.three.position, kc.pos); game.fx.update(0); input.endFrame(); render(); return; }
    if (game.paused) { input.poll(dt); if (input.pressed.pause && ui.current && ui.current.dismissable !== false) ui.closeModal(); input.endFrame(); pausedDraw -= dt; if (pausedDraw <= 0) { pausedDraw = 0.5; render(); } return; }
    input.enabled = !ui.modalOpen;
    const steps = Math.min(3, Math.ceil(dt / 0.034)); for (let i = 0; i < steps; i++) sim(dt / steps);
    render();
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

  playBtn.disabled = false; playBtn.textContent = had ? 'Continue' : 'Play';
  playBtn.addEventListener('click', () => { game.audio.unlock(); game.audio.sfx('ui'); cam.yaw = kc.yaw; cam.snap(); ui.start(); if (!had) { ui.toast('Welcome to Cedar Hollow! Follow your nose.', { icon: 'paw', ms: 4200 }); } });
  requestAnimationFrame(frame);
  window.dispatchEvent(new CustomEvent('kc-open-trail-ready', { detail: { version: VERSION } }));

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw')) navigator.serviceWorker.register('sw.js').catch(() => {});

  /* ---------- debug hooks: only with ?debug=1 ---------- */
  if (DEBUG) {
    const log = []; bus.on('*', (d, type) => { if (type === 'tick' || type === 'second') return; log.push({ type, t: +game.time.toFixed(2), d: d && typeof d === 'object' ? Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v !== 'object' && typeof v !== 'function')) : d }); if (log.length > 400) log.shift(); });
    window.__ot = {
      game, ready: true, events: log,
      state: () => ({ version: VERSION, started: ui.started, paused: game.paused, modal: ui.current ? ui.current.id || true : null, photo: ui.photo, pos: { x: kc.pos.x, y: kc.pos.y, z: kc.pos.z, yaw: kc.yaw }, speed: kc.speed, onGround: kc.onGround, swimming: kc.swimming, sprinting: kc.sprinting, sit: kc.sit, stamina: kc.stamina, staminaMax: kc.staminaMax,
        ride: kc.ride ? kc.ride.id : null, rideSpeed: kc.ride ? kc.ride.speed : 0, carrying: kc.carried.map(i => i.id), zone: api.zone && api.zone.id, prompt: api.prompt && api.prompt.label, wallet: { ...state.wallet }, mischief: npcs.mischief.level, chasing: npcs.mischief.chasing, time: world.time, day: world.day, night: world.night, rain: world.rain,
        quality: state.settings.quality, resScale, fps: Math.round(fpsEma), cam: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.cur, x: cam.three.position.x, y: cam.three.position.y, z: cam.three.position.z }, mods: { ...kc.mods }, stats: { ...state.stats }, collected: collect.counts(), ground: world.heightAt(kc.pos.x, kc.pos.z) }),
      start: () => { if (!ui.started) playBtn.click(); },
      teleport: (x, z, yaw) => { kc.teleport(x, z, yaw); if (yaw != null) cam.yaw = yaw; cam.snap(); },
      give: (o = {}) => { for (const k of ['bones', 'gems']) if (o[k]) game.wallet.add(k, o[k], 'debug'); return { ...state.wallet }; },
      setTime: t => { world.setTime(t); },
      setRain: v => world.setRain(v),
      setQuality: q => { state.settings.autoQuality = false; game.setQuality(q); },
      setCam: (yaw, pitch, dist) => { if (yaw != null) cam.yaw = yaw; if (pitch != null) cam.pitch = pitch; if (dist != null) cam.dist = dist; cam.manualT = 0; cam.snap(); },
      step: (n = 1, dt = 1 / 30) => { input.enabled = !ui.modalOpen; for (let i = 0; i < n; i++) sim(dt); render(); return true; },
      info: () => { render(); const r = renderer.info.render; return { calls: r.calls, triangles: r.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; },
      press: a => input.press(a), hold: (code, down) => { if (down) input.debugKeys.add(code); else input.debugKeys.delete(code); },
      mischief: n => npcs.mischief.add(n, 'debug'), clearMischief: () => npcs.mischief.clear(),
      enter: id => vehicles.enter(id), exit: () => vehicles.exit(), rides: () => vehicles.rides.map(r => ({ id: r.id, kind: r.kind, x: r.x, z: r.z, y: r.y })),
      save: () => game.save.save(), toast: t => ui.toast(t),
      startMission: id => { const m = game.modules.missions; return m && m.start ? m.start(id) : false; },
      completeMission: () => { const m = game.modules.missions; return m && m.complete ? m.complete() : false; },
      emit: (type, d) => bus.emit(type, d)
    };
  }
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(boot, 30)); else setTimeout(boot, 30);
