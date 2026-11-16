/* Shared game state + localStorage persistence (versioned key, tolerant load). */
export const SAVE_KEY = 'kc-open-trail-save-v1';

export function defaultState() {
  return {
    v: 1,
    wallet: { bones: 0, gems: 0 },
    owned: {},            /* itemId -> true / count   (shop agent) */
    upgrades: {},         /* upgradeId -> level       (economy agent) */
    equipped: {},         /* slot -> itemId: bandana, harness, hat, tag, trail, skin:<rideable> */
    stats: { distance: 0, bones: 0, balls: 0, digs: 0, barks: 0, pets: 0, photos: 0, jumps: 0, swims: 0, rides: 0, caught: 0, escapes: 0, days: 1, playTime: 0 },
    collected: { balls: [], photos: [], signs: [], zones: [] },
    pos: null,            /* {x,z,yaw} */
    time: 9.5,
    day: 1,
    settings: { quality: 'medium', autoQuality: true, sound: 0.8, music: 0.5, invertY: false, invertX: false, leftHanded: false, rain: true, halloween: false },
    modules: {}           /* moduleId -> any JSON, owned by that module */
  };
}

/* copy only fields whose type matches the default, so a damaged save cannot poison state */
function merge(def, src) {
  if (Array.isArray(def)) return Array.isArray(src) ? src.filter(v => v === null || ['string', 'number', 'boolean'].includes(typeof v)).slice(0, 5000) : def;
  if (def && typeof def === 'object') {
    const out = {};
    const s = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], s[k]);
    return out;
  }
  if (def === null) return src && typeof src === 'object' ? src : null;
  if (typeof src !== typeof def) return def;
  if (typeof def === 'number' && !Number.isFinite(src)) return def;
  return src;
}
const openMap = v => { const o = {}; if (v && typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v).slice(0, 2000)) o[k] = v[k]; return o; };

export function createSave(game) {
  const state = defaultState();
  let storageOk = true, lastError = null;
  const api = {
    state, key: SAVE_KEY,
    load() {
      let raw = null;
      try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { storageOk = false; }
      if (!raw) return false;
      try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
        const def = defaultState(), m = merge(def, data);
        m.owned = openMap(data.owned); m.upgrades = openMap(data.upgrades); m.equipped = openMap(data.equipped); m.modules = openMap(data.modules);
        m.wallet.bones = Math.max(0, Math.floor(m.wallet.bones)); m.wallet.gems = Math.max(0, Math.floor(m.wallet.gems));
        if (!['low', 'medium', 'high'].includes(m.settings.quality)) m.settings.quality = 'medium';
        if (m.pos && !(Number.isFinite(m.pos.x) && Number.isFinite(m.pos.z))) m.pos = null;
        m.time = ((m.time % 24) + 24) % 24; m.v = 1;
        for (const k of Object.keys(state)) delete state[k];
        Object.assign(state, m);
        return true;
      } catch (e) {
        lastError = String(e);
        try { localStorage.setItem(SAVE_KEY + '-corrupt', raw.slice(0, 20000)); } catch (e2) { /* ignore */ }
        return false;
      }
    },
    save() {
      if (!storageOk) return false;
      try { game.bus.emit('beforeSave', state); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); game.bus.emit('saved', state); return true; }
      catch (e) { lastError = String(e); return false; }
    },
    reset() {
      const s = defaultState(), keep = state.settings;
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, s); state.settings = keep;
      api.save();
    },
    /* per-module storage for the mission / economy / shop agents */
    moduleData(id, defaults = {}) {
      const cur = state.modules[id];
      if (!cur || typeof cur !== 'object') state.modules[id] = JSON.parse(JSON.stringify(defaults));
      else for (const k of Object.keys(defaults)) if (!(k in cur)) cur[k] = JSON.parse(JSON.stringify(defaults[k]));
      return state.modules[id];
    },
    get lastError() { return lastError; }
  };
  return api;
}
