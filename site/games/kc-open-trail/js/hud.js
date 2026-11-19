/* HUD + UI shell: minimap, compass, wallet, stamina, toasts,
   prompt, touch pad, the shared modal shell, pause / settings / help / world
   map, and photo mode. Other modules use game.ui.* (see ARCHITECTURE.md). */
import { icon, el, clamp, angDiff, TAU } from './util.js';
import { EXT, HALF, DISTRICT_LABELS, PHOTO_SPOTS, SIGNPOSTS } from './data.js';
import { createUiKit } from './uikit.js';
import { createPhotoKit } from './photo.js';
/* the game's privacy policy: a page of the same website, outside the game's folder */
const PRIVACY_URL = '/kc-open-trail/privacy.html';

const $ = id => document.getElementById(id);

export function createHud(game) {
  const { bus, state } = game;
  document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = icon(e.dataset.ic, e.closest('#pad') ? (e.closest('.lg') ? 28 : 22) : 22); });
  const hud = $('hud'), modal = $('modal'), body = $('modalBody'), actions = $('modalActions'), mm = $('minimap'), mctx = mm.getContext('2d'), cp = $('compass'), cctx = cp.getContext('2d');
  const ui = { modalOpen: false, fading: false, photo: false, started: false, stack: [], menuItems: [], hudButtons: [] };
  const sfx = () => game.audio.sfx('ui');

  /* ---------- toasts ---------- */
  ui.toast = (text, o = {}) => {
    const box = $('toasts'); while (box.children.length >= 3) box.firstChild.remove();
    const t = el('div', { class: 'toast ' + (o.kind || '') }, (o.icon ? icon(o.icon, 20) : '') + '<span></span>'); t.lastChild.textContent = text; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 380); }, o.ms || 2800);
    bus.emit('toast', { text }); ui._clearBanner(); return t;
  };
  /* a toast and the district / mission banner must not sit on top of each other: the banner steps down below the toasts */
  ui._clearBanner = () => { const b = $('banner'); if (!b.classList.contains('on')) return; b.style.top = ''; /* the same goes for the objective and the run timer chip */
    for (const e of [$('objective'), $('runTimer'), $('toasts')]) { if (e.hidden) continue; const r = e.getBoundingClientRect(), br = b.getBoundingClientRect(); if (r.height && br.height && br.top < r.bottom + 6 && br.bottom > r.top - 6) b.style.top = Math.round(r.bottom + 10) + 'px'; } };
  ui.banner = (title, sub) => { const b = $('banner'); b.innerHTML = (sub ? `<small>${sub}</small>` : '') + '<span></span>'; b.lastChild.textContent = title; b.classList.add('on'); ui._clearBanner(); clearTimeout(ui._bt); ui._bt = setTimeout(() => b.classList.remove('on'), 2600); };
  ui.fade = (mid, ms = 320) => { ui.fading = true; const f = $('fade'); f.classList.add('on'); setTimeout(() => { try { mid && mid(); } finally { setTimeout(() => { f.classList.remove('on'); ui.fading = false; }, 120); } }, ms); };

  /* ---------- modal shell ---------- */
  /* a small 'more below' fade while the body can still be scrolled (short landscape phones) */
  const moreCue = () => { $('modalMore').hidden = !(body.scrollHeight - body.scrollTop - body.clientHeight > 6); };
  body.addEventListener('scroll', moreCue, { passive: true }); addEventListener('resize', () => { if (ui.modalOpen) moreCue(); });
  const modalWallet = () => { $('modalWallet').innerHTML = `<span class="pc bones">${icon('bone', 16)}<b>${state.wallet.bones}</b></span><span class="pc gems">${icon('gem', 16)}<b>${state.wallet.gems}</b></span>`; };
  bus.on('wallet', () => { if (ui.current && ui.current.wallet) modalWallet(); });
  function show(m) {
    $('modalTitle').textContent = m.title || ''; body.innerHTML = ''; actions.innerHTML = ''; modal.className = 'modal' + (m.wide ? ' wide' : '') + (m.className ? ' ' + m.className : '');
    if (m.html) body.innerHTML = m.html; if (m.node) body.appendChild(m.node); if (m.render) m.render(body, m.handle);
    for (const a of m.actions || []) { const b = el('button', { type: 'button', class: 'btn ' + (a.primary ? 'go' : a.danger ? 'danger' : 'alt') }); b.textContent = a.label; b.addEventListener('click', () => { sfx(); let keep = a.keepOpen; if (a.onClick) { const r = a.onClick(m.handle); if (r === false) keep = true; } if (!keep) m.handle.close(); }); actions.appendChild(b); }
    $('modalWallet').hidden = !m.wallet; if (m.wallet) modalWallet();
    $('modalClose').hidden = m.dismissable === false; modal.hidden = false; ui.modalOpen = true; ui.current = m; body.scrollTop = 0; moreCue(); setTimeout(moreCue, 60);
    const f = actions.querySelector('.go') || body.querySelector('button') || $('modalClose'); if (f && game.input.lastDevice !== 'touch') setTimeout(() => f.focus({ preventScroll: true }), 30);
  }
  /* ui.openModal({ id, title, html | node | render(body, handle), actions: [{ label, primary, danger, onClick, keepOpen }], onClose, wide, dismissable, pause,
       wallet (show the bones / gems balance in the header), className }) -> { id, body, close(), refresh() (redraws, keeps the scroll position), setTitle(t) } */
  ui.openModal = o => {
    const m = { pause: true, dismissable: true, ...o };
    m.handle = { id: m.id, body, close: () => ui.closeModal(m), refresh: () => { if (ui.current === m) { const st = body.scrollTop; show(m); body.scrollTop = st; moreCue(); } }, setTitle: t => { m.title = t; if (ui.current === m) $('modalTitle').textContent = t; } };
    const dupe = ui.stack.findIndex(x => x.id && x.id === m.id); if (dupe >= 0) ui.stack.splice(dupe, 1);
    ui.stack.push(m); show(m); if (ui.started) game.save.save(); bus.emit('modalOpen', { id: m.id }); return m.handle;
  };
  ui.closeModal = which => {
    if (!ui.stack.length) return; const m = which && which.handle ? which : typeof which === 'string' ? ui.stack.find(x => x.id === which) : ui.stack[ui.stack.length - 1]; if (!m) return;
    const i = ui.stack.indexOf(m); if (i < 0) return; ui.stack.splice(i, 1);
    try { m.onClose && m.onClose(); } catch (e) { console.error(e); }
    bus.emit('modalClose', { id: m.id });
    if (ui.stack.length) show(ui.stack[ui.stack.length - 1]); else { modal.hidden = true; ui.modalOpen = false; ui.current = null; $('modalBody').textContent = ''; $('modalActions').textContent = ''; $('game').focus({ preventScroll: true }); }
  };
  ui.closeAll = () => { while (ui.stack.length) ui.closeModal(); };
  ui.resetNotes = [];
  /* keyboard focus stays inside an open screen: Tab from the last control goes to the first (and back), never to the HUD behind it */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !ui.modalOpen || modal.hidden) return;
    const list = [...modal.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && !x.hidden && x.getClientRects().length);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1], cur = document.activeElement, inside = modal.contains(cur);
    if (e.shiftKey ? (!inside || cur === first) : (!inside || cur === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus({ preventScroll: false }); }
  }, true);
  ui.isPaused = () => ui.stack.some(m => m.pause !== false);
  ui.confirm = (title, text, yes = 'Yes', no = 'Cancel') => new Promise(res => { let done = false; ui.openModal({ id: 'confirm', title, html: `<p>${text}</p>`, actions: [{ label: no, onClick: () => { done = true; res(false); } }, { label: yes, primary: true, onClick: () => { done = true; res(true); } }], onClose: () => { if (!done) res(false); } }); });
  $('modalClose').addEventListener('click', () => { sfx(); ui.closeModal(); });
  modal.addEventListener('pointerdown', e => { if (e.target === modal && ui.current && ui.current.dismissable !== false) ui.closeModal(); });
  /* shared screen pieces for modules: ui.tabs, ui.item, ui.price, ui.progress, ui.gate, ui.confirmSpend, ui.openExternal, ui.addSetting (js/uikit.js) */
  createUiKit(game, ui, { body, moreCue, sfx });
  const photo = createPhotoKit(game, ui);
  /* extension points for the mission / shop agents */
  ui.addMenuItem = item => { const it = { order: 50, ...item }; if (it.id) { const k = ui.menuItems.findIndex(x => x.id === it.id); if (k >= 0) ui.menuItems.splice(k, 1); } ui.menuItems.push(it); ui.menuItems.sort((a, b) => a.order - b.order); return () => { const k = ui.menuItems.indexOf(it); if (k >= 0) ui.menuItems.splice(k, 1); }; };
  ui.addHudButton = o => { const b = el('button', { type: 'button', class: o.label ? 'extra' : '', 'aria-label': o.title || o.label || o.id, id: 'hudbtn-' + o.id }, icon(o.icon || 'star', 22) + (o.label ? `<span>${o.label}</span>` : '')); b.addEventListener('click', () => { sfx(); o.onClick && o.onClick(); }); $('hudBtns').insertBefore(b, $('hudBtns').firstChild); ui.hudButtons.push(b); return b; };

  /* ---------- screens ---------- */
  ui.pause = () => {
    if (ui.photo) return ui.photoMode(false);
    if (!ui.started) return;
    const s = state.stats, c = game.collect.counts();
    ui.openModal({ id: 'pause', title: 'Paused', render: b => {
      const menu = el('div', { class: 'menu two' });
      const add = (label, ic, fn, go) => { const x = el('button', { type: 'button', class: 'btn ' + (go ? 'go' : 'alt') }, icon(ic, 20) + `<span>${label}</span>`); x.addEventListener('click', () => { sfx(); fn(); }); menu.appendChild(x); return x; };
      /* the first row: Resume and Photo mode (the camera lives here, not on the HUD); then the map and the sound switch */
      add('Resume', 'paw', () => ui.closeModal('pause'), true);
      add('Photo mode', 'camera', () => { ui.closeAll(); ui.photoMode(true); }).dataset.menu = 'photo';
      add('Map', 'map', () => ui.map());
      const mute = add(state.settings.muted ? 'Sound: off' : 'Sound: on', 'bark', () => { ui.setMuted(!state.settings.muted); mute.lastChild.textContent = state.settings.muted ? 'Sound: off' : 'Sound: on'; mute.setAttribute('aria-pressed', state.settings.muted ? 'true' : 'false'); });
      mute.dataset.menu = 'sound'; mute.setAttribute('aria-pressed', state.settings.muted ? 'true' : 'false');
      if (game.shop.tabs.length) add('Shop', 'bone', () => ui.shop());
      for (const it of ui.menuItems) add(it.label, it.icon || 'star', () => it.onSelect && it.onSelect());
      add('Settings', 'gear', () => ui.settings()); add('How to play', 'flag', () => ui.help());
      b.appendChild(menu);
      b.appendChild(el('div', { class: 'stats' }, `<span>Day <b>${game.world.day}</b></span><span>Distance <b>${(s.distance / 1000).toFixed(2)} km</b></span><span>Bones found <b>${s.bones}</b></span><span>Golden balls <b>${c.balls}/${c.ballsTotal}</b></span><span>Photo spots <b>${c.photos}/${c.photosTotal}</b></span><span>Signs read <b>${c.signs}/${c.signsTotal}</b></span><span>Places found <b>${c.zones}/${game.api.districts.length}</b></span><span>Pats <b>${s.pets}</b></span>`));
    } });
  };
  /* How to play: the controls for the device in the player's hands come first; touch rows show the real button icons and names */
  ui.help = () => {
    const touch = game.input.touch || document.body.classList.contains('touch'), k = (ic, name) => `<kbd>${ic ? icon(ic, 16) : ''}${name}</kbd>`;
    const touchRows = `<h3 class="helph">Touch</h3><div class="keys">
      ${k('', 'Left thumb')}<span>Drag anywhere on the ${state.settings.leftHanded ? 'right' : 'left'} half to move. The ring follows your thumb.</span>
      ${k('', 'Other thumb')}<span>Drag the other half to look around. Pinch with two fingers to zoom.</span>
      ${k('bolt', 'Run')}<span>Hold for zoomies: run fast while stamina lasts</span>
      ${k('jump', 'Jump')}<span>Jump (on a skateboard: ollie)</span>
      ${k('paw', 'Paw')}<span>Shows up only when KC can do something close by, and says what: sniff, pick up, talk, shop, take a job, hop on or off a ride</span>
      ${k('bark', 'Bark')}<span>Bark</span>
      ${k('more', 'Tricks')}<span>Opens Sit (sit by a person for a pat), Dig and Shake. Tap one, or tap anywhere else to fold them away</span>
      ${k('map', 'Map')}<span>Top right, or tap the little map</span>${k('pause', 'Pause')}<span>Photo mode, sound on or off, settings and this help</span></div>
      <p class="helpnote">The words under the buttons fade once you have used each one a few times.</p>`;
    const keyRows = `<h3 class="helph">Keyboard and mouse</h3><div class="keys"><kbd>W A S D</kbd><span>Move</span><kbd>Mouse drag</kbd><span>Look around (Q / E also turn, wheel zooms)</span><kbd>Shift</kbd><span>Zoomies! Sprint while stamina lasts</span><kbd>Space</kbd><span>Jump (on a skateboard: ollie)</span>
      <kbd>F</kbd><span>Paw: sniff, pick up, talk, hop on or off rides</span><kbd>B</kbd><span>Bark</span><kbd>C</kbd><span>Sit (sit by a person for a pat)</span><kbd>G</kbd><span>Dig</span><kbd>X</kbd><span>Shake</span><kbd>M</kbd><span>Map</span><kbd>K</kbd><span>Photo mode (also in the pause menu)</span><kbd>Esc</kbd><span>Pause: photo mode, sound, settings</span></div>`;
    return ui.openModal({ id: 'help', title: 'How to play', html: `<p>You are KC, loose in St. Helens, Oregon, with Highway 30, Sauvie Island and Portland down the road. Sniff out bones, find golden tennis balls, dig, swim, ride, and say hi to everyone.</p>
    ${touch ? touchRows + keyRows : keyRows + touchRows}
    <p>Gamepad: left stick move, right stick look, A jump, X paw, B bark, Y sit, d-pad down dig, d-pad up shake, right trigger zoomies, LB photo mode, Back map, Start pause.</p>
    <p>Rides: skateboards roll anywhere dry and ollie with Jump, canoes only float (find them at docks), the camper van likes roads (it crawls on grass), and the Heron Line tram in Portland takes passengers at its two stops.</p>`, actions: [{ label: 'Got it', primary: true }] });
  };
  ui.settings = () => ui.openModal({ id: 'settings', title: 'Settings', render: b => {
    const s = state.settings, sets = el('div', { class: 'sets' }), row = (label, ctl) => { const r = el('label', { class: 'set' }); r.appendChild(el('span', {}, label)); r.appendChild(ctl); sets.appendChild(r); return r; }; b.appendChild(sets);
    const seg = el('div', { class: 'seg', role: 'group' });
    for (const q of ['low', 'medium', 'high']) { const x = el('button', { type: 'button', class: s.quality === q ? 'on' : '', 'data-q': q }); x.textContent = q[0].toUpperCase() + q.slice(1); x.addEventListener('click', () => { game.setQuality(q, true); seg.querySelectorAll('button').forEach(k => k.classList.toggle('on', k === x)); }); seg.appendChild(x); }
    row('Graphics', seg);
    const check = (label, key, fn) => { const c = el('input', { type: 'checkbox', 'data-set': key }); c.checked = !!s[key]; c.addEventListener('change', () => { s[key] = c.checked; fn && fn(c.checked); game.save.save(); }); row(label, c); };
    const range = (label, key, fn) => { const c = el('input', { type: 'range', min: 0, max: 100, 'data-set': key }); c.value = Math.round(clamp(+s[key] || 0, 0, 1) * 100); c.addEventListener('input', () => { s[key] = c.value / 100; fn && fn(); }); c.addEventListener('change', () => game.save.save()); row(label, c); };
    check('Lower graphics automatically if slow', 'autoQuality');
    check('Mute all sound', 'muted', v => ui.setMuted(v));
    range('Sound', 'sound', () => game.audio.applyVolume()); range('Music', 'music', () => game.audio.applyVolume());
    { const c = el('input', { type: 'range', min: 26, max: 130, 'data-set': 'camDist' }); c.value = Math.round(game.cam.dist * 10); c.addEventListener('input', () => { game.cam.dist = s.camDist = c.value / 10; }); c.addEventListener('change', () => game.save.save()); row('Camera distance', c); }
    check('Invert camera up / down', 'invertY'); check('Invert camera left / right', 'invertX');
    check('Left-handed touch controls', 'leftHanded', v => document.body.classList.toggle('lefty', v));
    check('Rain showers', 'rain');
    { const c = el('input', { type: 'checkbox', 'data-set': 'festival' }); c.checked = !!game.economy.getFlag('festival'); c.addEventListener('change', () => { game.economy.setFlag('festival', c.checked); game.save.save(); }); row('Fog Bell Festival dressing', c); }
    /* rows added by modules (ui.addSetting) and the grown-up switch for the real-money shop (shown once a store module asks for it) */
    const extra = [...ui.settingRows]; if (game.grownUp.showSwitch) extra.push({ id: 'spending', label: game.grownUp.switchLabel || 'Real-money shop (grown-ups only)', type: 'check', get: () => game.grownUp.spending, set: v => game.grownUp.setSpending(v), order: 90 });
    for (const r of extra.sort((a, c) => (a.order ?? 50) - (c.order ?? 50))) {
      if (r.type === 'button') { const x = el('button', { type: 'button', class: 'btn alt', 'data-set': r.id }); x.textContent = r.button || 'Open'; x.addEventListener('click', () => { sfx(); r.onClick && r.onClick(); }); row(r.label, x); }
      else { const c = el('input', { type: 'checkbox', 'data-set': r.id }); c.checked = !!(r.get && r.get()); c.addEventListener('change', async () => { const want = c.checked; let ok = true; try { ok = (await (r.set && r.set(want))) !== false; } catch (e) { console.error(e); ok = false; } const now = r.get ? !!r.get() : ok ? want : !want; const live = document.querySelector(`[data-set="${r.id}"]`); if (live) live.checked = now; game.save.save(); }); row(r.label, c); }
    }
    /* the privacy policy: a page of this same website, so it stays inside the Play app with no address bar. No gate: it sells nothing.
       In a browser tab it opens beside the game; in the installed app it takes the game's place and Back returns. */
    { const a = el('a', { class: 'btn alt', href: PRIVACY_URL, 'data-set': 'privacy' }); a.textContent = 'Read';
      let tab = true; try { tab = matchMedia('(display-mode: browser)').matches; } catch (e) { /* treated as a tab */ }
      if (tab && game.channel === 'web') { a.target = '_blank'; a.rel = 'noopener'; }
      a.addEventListener('click', e => { sfx(); game.save.save(); if (navigator.onLine === false) { e.preventDefault(); ui.toast('The privacy policy needs an internet connection. Try again when this device is online.', { icon: 'hand', ms: 5000 }); } }); row('Privacy policy', a); }
    const reset = el('button', { type: 'button', class: 'btn danger', style: 'margin-top:12px;width:100%' }); reset.textContent = 'Start over (erase save)';
    reset.addEventListener('click', async () => {
      /* modules that keep something through a reset say so here (ui.resetNotes: [() => ({ text, gate }) | null]); anything bought with real money puts the grown-up gate first */
      const notes = (ui.resetNotes || []).map(fn => { try { return fn(); } catch (e) { return null; } }).filter(Boolean);
      if (notes.some(n => n.gate) && !(await ui.gate({ reason: 'Starting over erases this save. Things bought with real money are on this device, so a grown-up decides.' }))) return;
      const text = 'This erases the bones, upgrades, missions, the things bought with bones or free gems, and everything KC has found on this device. It cannot be undone.' + notes.map(n => ' ' + ui.esc(n.text)).join('');
      if (await ui.confirm('Start over?', text, 'Erase', 'Keep playing')) { game.save.reset(); location.reload(); } });
    b.appendChild(reset);
  }, actions: [{ label: 'Done', primary: true }] });

  /* sound on / off: the switch is in the pause menu and in Settings (M is the map, so there is no key for it) */
  ui.setMuted = v => { state.settings.muted = !!v; game.audio.applyVolume(); game.save.save(); };
  /* Shop shell: one screen with a scrolling strip of tabs (game.shop.registerTab); the open tab draws its own body with render(pane, game, handle).
     The strip stays pinned while the body scrolls, the balance sits in the header, and the last tab is remembered. */
  ui.shop = id => { const tabs = game.shop.tabs; if (!tabs.length) return null; if (id && tabs.some(t => t.id === id)) ui.shopTab = id;
    return ui.openModal({ id: 'shop', title: 'Shop', wide: true, wallet: true, className: 'shop', render: (b, handle) => {
      const sorted = [...tabs].sort((x, y) => (x.order ?? 50) - (y.order ?? 50));
      handle.tabs = ui.tabs(b, sorted.map(t => ({ id: t.id, title: t.title || t.id, icon: t.icon, badge: t.badge, render: pane => t.render && t.render(pane, game, handle) })), { current: ui.shopTab, errorText: 'This shelf is being restocked.', onChange: tid => { ui.shopTab = tid; bus.emit('shopTabOpen', { id: tid }); } });
    }, actions: [{ label: 'Close', primary: true }] }); };
  /* World map: north up. Drag to pan, pinch / wheel / the + and - buttons to zoom, the paw button centres on KC.
     Labels are drawn at a fixed readable size whatever the zoom, biggest first, and a label that would sit on
     another label, a dot or KC is nudged or left out until the player zooms in. */
  ui.map = () => {
    const w = game.world, k = w.mapScale, span = HALF + 6, view = { cx: 0, cz: 0, z: 1 }, ptrs = new Map();
    let cv = null, x = null, css = 300, pinch = 0, ro = null, onResize = null;
    const travelPts = game.travel ? game.travel.list() : [];
    const fit = () => { view.z = clamp(view.z, 1, 8); const lim = span - span / view.z; view.cx = clamp(view.cx, -lim, lim); view.cz = clamp(view.cz, -lim, lim); };
    const draw = () => {
      if (!cv || !cv.isConnected) return; css = cv.clientWidth || css; const S = Math.max(200, Math.min(1400, Math.round(css * Math.min(2, window.devicePixelRatio || 1)))); if (cv.width !== S) cv.width = cv.height = S;
      fit(); const half = span / view.z, u = S / css, px = v => ((v - view.cx + half) / (half * 2)) * S, pz = v => ((v - view.cz + half) / (half * 2)) * S, taken = [];
      x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#27402f'; x.fillRect(0, 0, S, S); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(w.mapCanvas, (view.cx - half + EXT) * k, (view.cz - half + EXT) * k, half * 2 * k, half * 2 * k, 0, 0, S, S);
      const dot = (wx, wz, col, r = 5) => { const X = px(wx), Y = pz(wz); if (X < -20 || Y < -20 || X > S + 20 || Y > S + 20) return; x.beginPath(); x.arc(X, Y, r * u, 0, 7); x.fillStyle = col; x.fill(); x.lineWidth = 2 * u; x.strokeStyle = '#12261e'; x.stroke(); taken.push([X - r * u - 2, Y - r * u - 2, X + r * u + 2, Y + r * u + 2]); };
      for (const p of PHOTO_SPOTS) if (state.collected.photos.includes(p.id)) dot(p.x, p.z, '#ffd23c', 4);
      for (const sp of SIGNPOSTS) if (state.collected.signs.includes(sp.id)) dot(sp.x, sp.z, '#c49a6a', 3.2);
      for (const r of game.vehicles.rides) dot(r.x, r.z, r.kind === 'van' ? '#4fb0a8' : r.kind === 'canoe' ? '#d9534f' : '#f08a2a', 4.2);
      for (const t of game.vehicles.transit || []) dot(t.x, t.z, '#b48ad6', 4.6);
      const named = [];
      for (const m of game.api.markers.values()) { const p = m.getPos ? m.getPos() : m; if (p) { dot(p.x, p.z, m.color, 6); if (m.label) named.push([m.label, p.x, p.z, 2, -11]); } }
      { const p = objPos(); if (p) dot(p.x, p.z, '#ffd23c', 8); }
      /* fast-travel points (game.travel): blue diamonds */
      for (const tp of travelPts) { const X = px(tp.x), Y = pz(tp.z), r = 7 * u; if (X < -20 || Y < -20 || X > S + 20 || Y > S + 20) continue; x.beginPath(); x.moveTo(X, Y - r); x.lineTo(X + r, Y); x.lineTo(X, Y + r); x.lineTo(X - r, Y); x.closePath(); x.fillStyle = tp.color || '#7fd4ff'; x.fill(); x.lineWidth = 2 * u; x.strokeStyle = '#12261e'; x.stroke(); taken.push([X - r - 2, Y - r - 2, X + r + 2, Y + r + 2]); }
      const kc = game.kc, KX = px(kc.pos.x), KY = pz(kc.pos.z); taken.push([KX - 12 * u, KY - 13 * u, KX + 12 * u, KY + 13 * u]);
      /* labels */
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      const hits = r => taken.some(t => r[0] < t[2] && t[0] < r[2] && r[1] < t[3] && t[1] < r[3]);
      const labels = [...named, ...DISTRICT_LABELS.filter(l => l[3]).map(l => [l[0], l[1], l[2], 1, 0]), ...DISTRICT_LABELS.filter(l => !l[3]).map(l => [l[0], l[1], l[2], 0, 0])];
      /* a label is drawn on its place or right beside it (one line up or down), kept whole inside the map; if that spot is taken it waits for a closer zoom */
      for (const [name, lx, lz, big, off] of labels) {
        const X0 = px(lx), Y0 = pz(lz) + off * u; if (X0 < 0 || Y0 < 0 || X0 > S || Y0 > S) continue;
        const fs = (big === 1 ? 15 : 12) * u; x.font = `800 ${fs}px system-ui, sans-serif`; const tw = x.measureText(name).width / 2 + 3 * u, th = fs * 0.62, step = fs * 1.12;
        const X = clamp(X0, tw + 2 * u, S - tw - 2 * u); if (Math.abs(X - X0) > tw * 0.9) continue;
        let Y = null; for (const dy of [0, step, -step]) { const yy = clamp(Y0 + dy, th + 2 * u, S - th - 2 * u), r = [X - tw, yy - th, X + tw, yy + th]; if (Math.abs(yy - Y0) > step * 1.05) continue; if (!hits(r)) { Y = yy; taken.push(r); break; } }
        if (Y == null) continue;
        x.lineWidth = 3.5 * u; x.strokeStyle = 'rgba(16,34,27,.9)'; x.strokeText(name, X, Y); x.fillStyle = big === 1 ? '#fff' : big === 2 ? '#ffe9a8' : '#f3f6f0'; x.fillText(name, X, Y);
      }
      x.save(); x.translate(KX, KY); x.rotate(Math.PI - kc.yaw); x.scale(u, u); x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 9); x.lineTo(0, 5); x.lineTo(-8, 9); x.closePath(); x.fillStyle = '#ffb238'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#12261e'; x.stroke(); x.restore();
    };
    const zoomAt = (f, mx, my) => { const half = span / view.z, wx = view.cx + (mx / css - 0.5) * half * 2, wz = view.cz + (my / css - 0.5) * half * 2; view.z = clamp(view.z * f, 1, 8); const h2 = span / view.z; view.cx = wx - (mx / css - 0.5) * h2 * 2; view.cz = wz - (my / css - 0.5) * h2 * 2; draw(); };
    return ui.openModal({ id: 'map', title: 'St. Helens to Portland', wide: true, render: b => {
      const lay = el('div', { class: 'maplay' }), box = el('div', { class: 'mapbox' }); cv = el('canvas', { id: 'mapCanvas', width: 600, height: 600, 'aria-label': 'Map of St. Helens, Highway 30, Sauvie Island and Portland' }); x = cv.getContext('2d'); box.appendChild(cv);
      const side = el('div', { class: 'mapside' }), zb = el('div', { class: 'mapzoom' }), mk = (txt, label, fn) => { const q = el('button', { type: 'button', 'aria-label': label }, txt); q.addEventListener('click', () => { sfx(); fn(); }); zb.appendChild(q); };
      mk('+', 'Zoom in', () => zoomAt(1.6, css / 2, css / 2)); mk('&minus;', 'Zoom out', () => zoomAt(1 / 1.6, css / 2, css / 2)); mk(icon('paw', 20), 'Centre on KC', () => { if (view.z < 2) view.z = 3; view.cx = game.kc.pos.x; view.cz = game.kc.pos.z; draw(); });
      lay.appendChild(box); side.appendChild(zb); lay.appendChild(side);
      const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } ptrs.set(e.pointerId, rel(e)); pinch = 0; });
      cv.addEventListener('pointermove', e => { const p0 = ptrs.get(e.pointerId); if (!p0) return; const p = rel(e);
        if (ptrs.size === 1) { const half = span / view.z; view.cx -= ((p[0] - p0[0]) / css) * half * 2; view.cz -= ((p[1] - p0[1]) / css) * half * 2; ptrs.set(e.pointerId, p); draw(); }
        else { ptrs.set(e.pointerId, p); const [a, c] = [...ptrs.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]); if (pinch > 0 && d > 0) zoomAt(d / pinch, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2); pinch = d; } });
      const up = e => { ptrs.delete(e.pointerId); pinch = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
      cv.addEventListener('wheel', e => { e.preventDefault(); const p = rel(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p[0], p[1]); }, { passive: false });
      const c = game.collect.counts();
      /* fast travel: one button per unlocked point (game.travel.add) */
      if (travelPts.length) { const tr = el('div', { class: 'travel' }); tr.appendChild(el('span', { class: 'travelh' }, 'Fast travel')); for (const tp of travelPts) { const q = el('button', { type: 'button', class: 'chip', 'data-travel': tp.id }); q.textContent = tp.name; q.addEventListener('click', () => { sfx(); game.travel.go(tp.id); }); tr.appendChild(q); } side.appendChild(tr); }
      side.appendChild(el('div', { class: 'legend' }, `<span>Places found <b>${c.zones}/${game.api.districts.length}</b></span><span>Golden balls <b>${c.balls}/${c.ballsTotal}</b></span><span>Photo spots <b>${c.photos}/${c.photosTotal}</b></span><span>Signs <b>${c.signs}/${c.signsTotal}</b></span><span>Orange arrow: KC</span><span>Dots: rides and things you have found</span>${travelPts.length ? '<span>Blue diamonds: fast travel</span>' : ''}<span>Drag to move the map. Pinch, or use + and &minus;, to zoom.</span>`));
      b.appendChild(lay);
      if (ro) ro.disconnect(); if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => { draw(); moreCue(); }); ro.observe(cv); }
      if (!onResize) { onResize = () => draw(); addEventListener('resize', onResize); }
      requestAnimationFrame(draw); setTimeout(draw, 80);
    }, onClose: () => { if (ro) ro.disconnect(); ro = null; if (onResize) removeEventListener('resize', onResize); onResize = null; cv = null; }, actions: [{ label: 'Close', primary: true }] });
  };

  /* ---------- photo mode (frames, filters, stickers, zoom and poses come from js/photo.js as game.photo) ---------- */
  ui.photoMode = on => {
    on = !!on; if (on === ui.photo) return; ui.photo = on; game.cam.mode = on ? 'photo' : 'follow'; hud.hidden = on || !ui.started; $('photobar').hidden = !on;
    if (!on) game.cam.dist = clamp(game.cam.dist, 3, 13); photo.show(on); { const bm = game.scene.getObjectByName('beacons'); if (bm) bm.visible = !on; } bus.emit('photoMode', { on });
  };
  ui.snap = () => {
    const src = game.renderer.domElement; game.renderNow();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
    photo.compose(x, src, c.width, c.height);
    const fs = Math.max(14, Math.round(c.height * 0.028)); x.font = `800 ${fs}px system-ui, sans-serif`; x.textAlign = 'right'; x.textBaseline = 'alphabetic'; x.lineWidth = fs * 0.22; x.strokeStyle = 'rgba(0,0,0,.55)'; x.fillStyle = '#fff';
    const inset = photo.captionInset(c.width, c.height), cap = `KC: Open Trail  ·  ${game.api.zone ? game.api.zone.name : 'St. Helens'}`; x.strokeText(cap, c.width - fs - inset[0], c.height - fs - inset[1]); x.fillText(cap, c.width - fs - inset[0], c.height - fs - inset[1]);
    game.audio.sfx('shutter'); state.stats.photos++; ui.lastPhoto = { w: c.width, h: c.height, ...photo.state() }; ui.lastPhotoCanvas = c;
    const done = url => { const a = el('a', { href: url, download: `kc-open-trail-${Date.now()}.png` }); document.body.appendChild(a); a.click(); a.remove(); if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 4000); };
    if (c.toBlob) c.toBlob(b => { if (b) done(URL.createObjectURL(b)); }, 'image/png'); else done(c.toDataURL('image/png'));
    $('fade').style.background = '#fff'; $('fade').classList.add('on'); setTimeout(() => { $('fade').classList.remove('on'); setTimeout(() => { $('fade').style.background = ''; }, 320); }, 90);
    bus.emit('photoTaken', { x: game.kc.pos.x, z: game.kc.pos.z, zone: game.api.zone && game.api.zone.id, ...photo.state() });
  };
  $('photoSnap').addEventListener('click', () => ui.snap()); $('photoExit').addEventListener('click', () => ui.photoMode(false));

  /* ---------- buttons ---------- */
  $('btnPause').addEventListener('click', () => { sfx(); ui.pause(); }); $('btnMap').addEventListener('click', () => { sfx(); ui.map(); }); $('minimapBtn').addEventListener('click', () => { sfx(); ui.map(); });
  $('prompt').addEventListener('click', () => game.input.press('interact'));
  /* touch pad. Each button's word fades once it has been used 3 times (counted in settings.hints, so it lasts and survives Start over).
     Paw has no fixed word: it shows what it will do, so its label never fades. */
  const H = () => state.settings.hints, LEARN = 3, pad = $('pad'), tricks = $('tricks'), more = $('btnMore');
  const learned = () => { pad.querySelectorAll('button').forEach(b => { const h = b.dataset.hint || b.dataset.btn; if (h in H()) b.classList.toggle('learned', H()[h] >= LEARN); }); $('stick').classList.toggle('learned', H().move >= LEARN); };
  const used = h => { const n = H(); if (!(h in n) || n[h] >= LEARN) return; n[h]++; if (n[h] >= LEARN) { learned(); game.save.save(); } };
  ui.hintsLearned = learned;
  /* the tricks fan: ... opens Sit, Dig and Shake; it folds away after one is used, on a second tap of ..., or on a tap anywhere else */
  const fan = open => { open = !!open; if (open === !tricks.hidden) return; tricks.hidden = !open; pad.classList.toggle('open', open); more.classList.toggle('down', open); };
  ui.tricks = fan;
  more.addEventListener('pointerdown', e => { e.preventDefault(); used('more'); sfx(); fan(tricks.hidden); });
  more.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerdown', e => { if (!tricks.hidden && !tricks.contains(e.target) && !more.contains(e.target)) fan(false); }, true);
  pad.querySelectorAll('button[data-btn]').forEach(b => {
    const name = b.dataset.btn, inFan = tricks.contains(b); let isDown = false;
    const set = d => { if (d === isDown) return; isDown = d; b.classList.toggle('down', d); game.input.setButton(name, d); if (!d && inFan) fan(false); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } used(name); set(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(false));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  learned();
  $('titleSettings').addEventListener('click', () => { sfx(); ui.settings(); }); $('titleHelp').addEventListener('click', () => { sfx(); ui.help(); });
  ui.start = () => { ui.started = true; $('title').hidden = true; hud.hidden = false; document.body.classList.toggle('lefty', !!state.settings.leftHanded); $('game').focus({ preventScroll: true }); tlb(); coachStart(); bus.emit('start', {}); };
  /* the toasts hang under the minimap / place name / clock column: publish where that column ends */
  const tlEl = $('tl'), tlb = () => { const r = tlEl.getBoundingClientRect(); if (r.height > 0) document.documentElement.style.setProperty('--tlb', Math.round(r.bottom) + 'px'); const cw = cp.clientWidth, ch = cp.clientHeight; if (cw && ch && (cp.width !== cw * 2 || cp.height !== ch * 2)) { cp.width = cw * 2; cp.height = ch * 2; } };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(tlb).observe(tlEl); addEventListener('resize', tlb);
  /* first-run touch coach: says what each half of the screen does until the player has moved and looked (saved in flags.coached) */
  const coach = $('coach'), coachDone = { move: false, look: false }; let coachOn = false, coachT = 0, coachMoved = -1;
  const coachStart = () => { if (state.flags.coached) return; coachOn = true; coachT = 0; coach.classList.add('show'); };
  const coachTick = dt => { coachT += dt; const inp = game.input;
    if (!coachDone.move && Math.hypot(inp.moveX, inp.moveY) > 0.3) { coachDone.move = true; coach.querySelector('.cl').classList.add('done'); }
    if (!coachDone.look && Math.abs(inp.camX) + Math.abs(inp.camY) > 0.004) { coachDone.look = true; coach.querySelector('.cr').classList.add('done'); }
    /* the camera follows by itself, so looking is optional: once she has moved the look hint gets 8 more seconds, and nothing stays past 20. Shown once per save. */
    if (coachDone.move && coachMoved < 0) coachMoved = coachT;
    if ((coachDone.move && coachDone.look) || (coachMoved >= 0 && coachT - coachMoved > 8) || coachT > 20) { coachOn = false; setTimeout(() => coach.classList.remove('show'), 500); if (coachDone.move || coachT > 20) game.economy.setFlag('coached', true); } };

  /* ---------- live readouts ---------- */
  const wB = $('wBones'), wG = $('wGems');
  const wallet = () => { wB.textContent = state.wallet.bones; wG.textContent = state.wallet.gems; };
  bus.on('wallet', e => { wallet(); const n = (e.currency === 'gems' ? wG : wB).parentNode; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); });
  bus.on('enterZone', e => { if (e.district) { $('zone').textContent = e.name; tlb(); if (ui.started) ui.banner(e.name, e.first ? 'Discovered' : ''); } });
  bus.on('discover', e => { if (ui.started && game.rewards.zone) { game.economy.grant({ bones: game.rewards.zone }, 'discover'); } });
  /* rows the objective and the run timer take under the minimap column on a narrow portrait phone (the toasts hang below them) */
  const rows = () => { const o = $('objective'), t = $('runTimer'), de = document.documentElement.style; de.setProperty('--objh', o.hidden ? '0px' : (o.offsetHeight + 6) + 'px'); de.setProperty('--tmrh', t.hidden ? '0px' : (t.offsetHeight + 6) + 'px'); };
  bus.on('objective', o => { const e = $('objective'); e.hidden = !o; if (o) { e.textContent = o.label || 'Objective'; } rows(); ui._clearBanner(); });
  /* where the objective is, or null for a text-only objective such as "Bark at the echo point  1/3" */
  const objPos = () => { const o = game.api.objective; if (!o) return null; const q = o.getPos ? o.getPos() : o; return q && Number.isFinite(q.x) && Number.isFinite(q.z) ? q : null; };
  ui.objPos = objPos;
  /* the run timer chip under the compass: ui.setTimer('Paper round  0:42', { warn: true }) ; ui.setTimer(null) hides it */
  let timerText = null; ui.setTimer = (text, o = {}) => { const e = $('runTimer'); if (text == null) { if (timerText != null) { e.hidden = true; timerText = null; rows(); } return; } if (text !== timerText) { const was = e.hidden; e.textContent = timerText = text; e.hidden = false; if (was) { rows(); ui._clearBanner(); } } e.classList.toggle('warn', !!o.warn); };
  const pawBtn = pad.querySelector('[data-btn="interact"]'); let pawIc = 'paw';
  let lastPrompt = '', clockT = 0, frame = 0, lastStam = -1, lastLow = null, stickWas = false;
  const stam = $('stamina'), stamBar = stam.querySelector('.bar i'), stickEl = $('stick'), knob = stickEl.firstChild;
  ui.update = dt => {
    const { kc, cam, api, world } = game; frame++;
    const f = kc.stamina / kc.staminaMax, fq = Math.round(f * 200), low = kc.exhausted || f < 0.25; if (fq !== lastStam) { lastStam = fq; stamBar.style.transform = `scaleX(${(fq / 200).toFixed(3)})`; stam.setAttribute('aria-valuenow', Math.round(f * 100)); } if (low !== lastLow) { lastLow = low; stam.classList.toggle('low', low); }
    if (coachOn) coachTick(dt);
    const p = api.prompt, key = p ? p.label : '';
    if (key !== lastPrompt) { lastPrompt = key; const pe = $('prompt'); pe.hidden = !p; if (p) pe.innerHTML = icon(p.icon || 'paw', 20) + `<span></span><kbd>${game.input.lastDevice === 'gamepad' ? 'X' : 'F'}</kbd>`, pe.children[1].textContent = p.label;
      /* the touch Paw button appears only while there is something to use, with the same icon and words as the prompt */
      if (pawIc !== (p && (p.icon || 'paw'))) { pawIc = p && (p.icon || 'paw'); if (pawIc) pawBtn.firstChild.innerHTML = icon(pawIc, 28); }
      pawBtn.hidden = !p; pawBtn.lastChild.textContent = p ? p.label : ''; if (!p && pawBtn.classList.contains('down')) pawBtn.dispatchEvent(new Event('pointercancel')); }
    clockT -= dt; if (clockT <= 0) { clockT = 1; const t = world.time, h = Math.floor(t), m = Math.floor((t - h) * 6) * 10, h12 = ((h + 11) % 12) + 1; $('clock').textContent = `Day ${world.day}  ·  ${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}${world.rain > 0.2 ? '  ·  rain' : ''}`; wallet(); }
    const s = game.input.stick; if (s.active) { if (!stickWas) { stickWas = true; used('move'); stickEl.classList.add('on'); stickEl.style.bottom = stickEl.style.right = 'auto'; } stickEl.style.left = (s.ox - 56) + 'px'; stickEl.style.top = (s.oy - 56) + 'px'; knob.style.transform = `translate(${s.x * 30}px, ${s.y * 30}px)`; } else if (stickWas) { stickWas = false; stickEl.classList.remove('on'); stickEl.style.left = stickEl.style.top = stickEl.style.bottom = stickEl.style.right = ''; knob.style.transform = ''; }
    if (api.objective && frame % 10 === 0) { const o = api.objective, q = objPos(), oe = $('objective'); oe.textContent = o.label ? o.label + ' ' : ''; const tail = o.progress != null ? String(o.progress) : q ? Math.round(Math.hypot(q.x - kc.pos.x, q.z - kc.pos.z)) + ' m' : ''; if (tail) { const bb = document.createElement('b'); bb.textContent = tail; oe.appendChild(bb); } }
    /* minimap (north up) */
    if (frame % 2 === 0) {
      const S = mm.width, span = 170, k = world.mapScale, sx = (kc.pos.x + EXT - span / 2) * k, sy = (kc.pos.z + EXT - span / 2) * k, sc = S / span, mx = wx => (wx - kc.pos.x) * sc + S / 2, mz = wz => (wz - kc.pos.z) * sc + S / 2;
      mctx.fillStyle = '#27402f'; mctx.fillRect(0, 0, S, S); mctx.drawImage(world.mapCanvas, sx, sy, span * k, span * k, 0, 0, S, S);
      const dot = (wx, wz, col, r, edge) => { let x = mx(wx), y = mz(wz); const out = x < 10 || y < 10 || x > S - 10 || y > S - 10; if (out && !edge) return; x = clamp(x, 12, S - 12); y = clamp(y, 12, S - 12); mctx.beginPath(); mctx.arc(x, y, out ? r * 0.75 : r, 0, 7); mctx.fillStyle = col; mctx.fill(); mctx.lineWidth = 2.5; mctx.strokeStyle = '#12261e'; mctx.stroke(); };
      /* district names that fall inside the view */
      mctx.font = '800 17px system-ui, sans-serif'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.lineWidth = 4; mctx.strokeStyle = 'rgba(16,34,27,.8)'; mctx.fillStyle = 'rgba(255,255,255,.95)';
      for (const [name, lx, lz, big] of DISTRICT_LABELS) { const x = mx(lx), y = mz(lz); if (x < 30 || y < 16 || x > S - 30 || y > S - 12) continue; mctx.font = big ? '800 19px system-ui, sans-serif' : '800 15px system-ui, sans-serif'; mctx.strokeText(name, x, y); mctx.fillText(name, x, y); }
      /* icons: rides (van = box, canoe = hull, board = bar), photo spots (ring), signposts read (flag) */
      const glyph = (wx, wz, kind, col) => { const x = mx(wx), y = mz(wz); if (x < 10 || y < 10 || x > S - 10 || y > S - 10) return; mctx.fillStyle = col; mctx.strokeStyle = '#12261e'; mctx.lineWidth = 2.5; mctx.beginPath();
        if (kind === 'van') mctx.rect(x - 8, y - 6, 16, 12); else if (kind === 'canoe') mctx.ellipse(x, y, 10, 4.5, -0.5, 0, 7); else if (kind === 'skateboard') mctx.rect(x - 9, y - 3, 18, 6); else if (kind === 'flag') { mctx.moveTo(x - 5, y + 8); mctx.lineTo(x - 5, y - 9); mctx.lineTo(x + 8, y - 4); mctx.lineTo(x - 5, y + 1); } else mctx.arc(x, y, 6, 0, 7);
        mctx.closePath(); mctx.fill(); mctx.stroke(); if (kind === 'photo') { mctx.beginPath(); mctx.arc(x, y, 2.4, 0, 7); mctx.fillStyle = '#12261e'; mctx.fill(); } };
      for (const r of game.vehicles.rides) if (r !== kc.ride) glyph(r.x, r.z, r.kind, r.kind === 'van' ? '#4fb0a8' : r.kind === 'canoe' ? '#e0685f' : '#f08a2a');
      for (const ps of PHOTO_SPOTS) glyph(ps.x, ps.z, 'photo', state.collected.photos.includes(ps.id) ? '#9aa39d' : '#ffd23c');
      for (const c of game.vehicles.cars) dot(c.x, c.z, '#dfe6ea', 4);
      for (const m of api.markers.values()) { if (m.minimap === false) continue; const q = m.getPos ? m.getPos() : m; if (q) dot(q.x, q.z, m.color, 8, m.edge); }
      { const q = objPos(); if (q) dot(q.x, q.z, '#ffd23c', 10, true); }
      mctx.save(); mctx.translate(S / 2, S / 2);
      mctx.rotate(Math.PI - cam.yaw); mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, 70, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); mctx.closePath(); mctx.fillStyle = 'rgba(255,255,255,.22)'; mctx.fill(); mctx.rotate(-(Math.PI - cam.yaw));
      mctx.rotate(Math.PI - kc.yaw); mctx.beginPath(); mctx.moveTo(0, -17); mctx.lineTo(12, 13); mctx.lineTo(0, 7); mctx.lineTo(-12, 13); mctx.closePath(); mctx.fillStyle = '#ffb238'; mctx.fill(); mctx.lineWidth = 3.5; mctx.strokeStyle = '#12261e'; mctx.stroke(); mctx.restore();
      /* compass */
      const W = cp.width, Hh = cp.height; cctx.clearRect(0, 0, W, Hh); cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
      const tick = (ang, label, col, big) => { const d = angDiff(cam.yaw, ang), x = W / 2 - d * (W / 3.7); if (x < 16 || x > W - 16) return; cctx.fillStyle = col; if (label) { cctx.font = `${big ? 900 : 800} ${Math.round(Hh * (big ? 0.6 : label.length > 1 ? 0.36 : 0.5))}px system-ui, sans-serif`; cctx.fillText(label, x, Hh / 2 + 2); } else cctx.fillRect(x - 1.5, Hh / 2 - 7, 3, 14); };
      tick(Math.PI, 'N', '#ffb238', true); tick(Math.PI / 2, 'E', '#fff'); tick(0, 'S', '#fff'); tick(-Math.PI / 2, 'W', '#fff'); tick(0.785, 'SE', 'rgba(255,255,255,.7)'); tick(2.356, 'NE', 'rgba(255,255,255,.7)'); tick(-0.785, 'SW', 'rgba(255,255,255,.7)'); tick(-2.356, 'NW', 'rgba(255,255,255,.7)');
      const pin = (q, col, s) => { const a = Math.atan2(q.x - kc.pos.x, q.z - kc.pos.z), d = clamp(angDiff(cam.yaw, a), -1.7, 1.7), x = W / 2 - d * (W / 3.7); cctx.fillStyle = col; cctx.beginPath(); cctx.moveTo(x, Hh - 4); cctx.lineTo(x - 10 * s, 6); cctx.lineTo(x + 10 * s, 6); cctx.closePath(); cctx.fill(); };
      for (const m of api.markers.values()) if (m.compass) { const q = m.getPos ? m.getPos() : m; if (q) pin(q, m.color, 0.7); }
      { const q = objPos(); if (q) pin(q, '#ffd23c', 1); }
      cctx.fillStyle = 'rgba(255,255,255,.9)'; cctx.fillRect(W / 2 - 1, 0, 2, 7);
    }
  };
  wallet();
  return ui;
}
