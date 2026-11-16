/* HUD + UI shell: minimap, compass, wallet, stamina, mischief meter, toasts,
   prompt, touch pad, the shared modal shell, pause / settings / help / world
   map, and photo mode. Other modules use game.ui.* (see ARCHITECTURE.md). */
import { icon, el, clamp, angDiff, TAU } from './util.js';
import { EXT, HALF, DISTRICT_LABELS, PHOTO_SPOTS, SIGNPOSTS } from './data.js';

const $ = id => document.getElementById(id);

export function createHud(game) {
  const { bus, state } = game;
  document.querySelectorAll('[data-ic]').forEach(e => { e.innerHTML = icon(e.dataset.ic, e.closest('#pad') ? (e.closest('.lg') ? 28 : 22) : e.closest('#mischief') ? 16 : 22); });
  const hud = $('hud'), modal = $('modal'), body = $('modalBody'), actions = $('modalActions'), mm = $('minimap'), mctx = mm.getContext('2d'), cp = $('compass'), cctx = cp.getContext('2d');
  const ui = { modalOpen: false, fading: false, photo: false, started: false, stack: [], menuItems: [], hudButtons: [] };
  const sfx = () => game.audio.sfx('ui');

  /* ---------- toasts ---------- */
  ui.toast = (text, o = {}) => {
    const box = $('toasts'); while (box.children.length >= 3) box.firstChild.remove();
    const t = el('div', { class: 'toast ' + (o.kind || '') }, (o.icon ? icon(o.icon, 20) : '') + '<span></span>'); t.lastChild.textContent = text; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 380); }, o.ms || 2800);
    bus.emit('toast', { text }); return t;
  };
  ui.banner = (title, sub) => { const b = $('banner'); b.innerHTML = (sub ? `<small>${sub}</small>` : '') + '<span></span>'; b.lastChild.textContent = title; b.classList.add('on'); clearTimeout(ui._bt); ui._bt = setTimeout(() => b.classList.remove('on'), 2600); };
  ui.fade = (mid, ms = 320) => { ui.fading = true; const f = $('fade'); f.classList.add('on'); setTimeout(() => { try { mid && mid(); } finally { setTimeout(() => { f.classList.remove('on'); ui.fading = false; }, 120); } }, ms); };

  /* ---------- modal shell ---------- */
  function show(m) {
    $('modalTitle').textContent = m.title || ''; body.innerHTML = ''; actions.innerHTML = ''; modal.className = 'modal' + (m.wide ? ' wide' : '') + (m.className ? ' ' + m.className : '');
    if (m.html) body.innerHTML = m.html; if (m.node) body.appendChild(m.node); if (m.render) m.render(body, m.handle);
    for (const a of m.actions || []) { const b = el('button', { type: 'button', class: 'btn ' + (a.primary ? 'go' : a.danger ? 'danger' : 'alt') }); b.textContent = a.label; b.addEventListener('click', () => { sfx(); let keep = a.keepOpen; if (a.onClick) { const r = a.onClick(m.handle); if (r === false) keep = true; } if (!keep) m.handle.close(); }); actions.appendChild(b); }
    $('modalClose').hidden = m.dismissable === false; modal.hidden = false; ui.modalOpen = true; ui.current = m;
    const f = actions.querySelector('.go') || body.querySelector('button') || $('modalClose'); if (f && game.input.lastDevice !== 'touch') setTimeout(() => f.focus({ preventScroll: true }), 30);
  }
  /* ui.openModal({ id, title, html | node | render(body, handle), actions: [{ label, primary, danger, onClick, keepOpen }], onClose, wide, dismissable, pause }) */
  ui.openModal = o => {
    const m = { pause: true, dismissable: true, ...o };
    m.handle = { id: m.id, body, close: () => ui.closeModal(m), refresh: () => { if (ui.current === m) show(m); }, setTitle: t => { m.title = t; if (ui.current === m) $('modalTitle').textContent = t; } };
    const dupe = ui.stack.findIndex(x => x.id && x.id === m.id); if (dupe >= 0) ui.stack.splice(dupe, 1);
    ui.stack.push(m); show(m); if (ui.started) game.save.save(); bus.emit('modalOpen', { id: m.id }); return m.handle;
  };
  ui.closeModal = which => {
    if (!ui.stack.length) return; const m = which && which.handle ? which : typeof which === 'string' ? ui.stack.find(x => x.id === which) : ui.stack[ui.stack.length - 1]; if (!m) return;
    const i = ui.stack.indexOf(m); if (i < 0) return; ui.stack.splice(i, 1);
    try { m.onClose && m.onClose(); } catch (e) { console.error(e); }
    bus.emit('modalClose', { id: m.id });
    if (ui.stack.length) show(ui.stack[ui.stack.length - 1]); else { modal.hidden = true; ui.modalOpen = false; ui.current = null; $('game').focus({ preventScroll: true }); }
  };
  ui.closeAll = () => { while (ui.stack.length) ui.closeModal(); };
  ui.isPaused = () => ui.stack.some(m => m.pause !== false);
  ui.confirm = (title, text, yes = 'Yes', no = 'Cancel') => new Promise(res => { let done = false; ui.openModal({ id: 'confirm', title, html: `<p>${text}</p>`, actions: [{ label: no, onClick: () => { done = true; res(false); } }, { label: yes, primary: true, onClick: () => { done = true; res(true); } }], onClose: () => { if (!done) res(false); } }); });
  $('modalClose').addEventListener('click', () => { sfx(); ui.closeModal(); });
  modal.addEventListener('pointerdown', e => { if (e.target === modal && ui.current && ui.current.dismissable !== false) ui.closeModal(); });
  /* extension points for the mission / shop agents */
  ui.addMenuItem = item => { ui.menuItems.push({ order: 50, ...item }); ui.menuItems.sort((a, b) => a.order - b.order); return () => { ui.menuItems = ui.menuItems.filter(x => x !== item); }; };
  ui.addHudButton = o => { const b = el('button', { type: 'button', class: o.label ? 'extra' : '', 'aria-label': o.title || o.label || o.id, id: 'hudbtn-' + o.id }, icon(o.icon || 'star', 22) + (o.label ? `<span>${o.label}</span>` : '')); b.addEventListener('click', () => { sfx(); o.onClick && o.onClick(); }); $('hudBtns').insertBefore(b, $('hudBtns').firstChild); ui.hudButtons.push(b); return b; };

  /* ---------- screens ---------- */
  ui.pause = () => {
    if (ui.photo) return ui.photoMode(false);
    if (!ui.started) return;
    const s = state.stats, c = game.collect.counts();
    ui.openModal({ id: 'pause', title: 'Paused', render: b => {
      const menu = el('div', { class: 'menu two' });
      const add = (label, ic, fn, go) => { const x = el('button', { type: 'button', class: 'btn ' + (go ? 'go' : 'alt') }, icon(ic, 20) + `<span>${label}</span>`); x.addEventListener('click', () => { sfx(); fn(); }); menu.appendChild(x); return x; };
      add('Resume', 'paw', () => ui.closeModal('pause'), true).style.gridColumn = '1 / -1';
      add('Map', 'map', () => ui.map()); add('Photo mode', 'camera', () => { ui.closeAll(); ui.photoMode(true); });
      for (const it of ui.menuItems) add(it.label, it.icon || 'star', () => it.onSelect && it.onSelect());
      add('Settings', 'gear', () => ui.settings()); add('How to play', 'flag', () => ui.help());
      b.appendChild(menu);
      b.appendChild(el('div', { class: 'stats' }, `<span>Day <b>${game.world.day}</b></span><span>Distance <b>${(s.distance / 1000).toFixed(2)} km</b></span><span>Bones found <b>${s.bones}</b></span><span>Golden balls <b>${c.balls}/${c.ballsTotal}</b></span><span>Photo spots <b>${c.photos}/${c.photosTotal}</b></span><span>Signs read <b>${c.signs}/${c.signsTotal}</b></span><span>Pats <b>${s.pets}</b></span><span>Ranger escapes <b>${s.escapes}</b></span>`));
    } });
  };
  ui.help = () => ui.openModal({ id: 'help', title: 'How to play', html: `<p>Explore Cedar Hollow as KC. Sniff out bones, find golden tennis balls, dig, swim, ride, say hi to everyone.</p>
    <div class="keys"><kbd>W A S D</kbd><span>Move (touch: left thumb stick)</span><kbd>Mouse drag</kbd><span>Look around (touch: drag the other side; Q / E also turn)</span><kbd>Shift</kbd><span>Zoomies! Sprint while stamina lasts</span><kbd>Space</kbd><span>Jump (on a skateboard: ollie)</span>
    <kbd>F</kbd><span>Paw: sniff, pick up, say hi, hop on or off rides</span><kbd>B</kbd><span>Bark</span><kbd>C</kbd><span>Sit (sit by a person for a pat)</span><kbd>G</kbd><span>Dig</span><kbd>X</kbd><span>Shake</span><kbd>M</kbd><span>Map</span><kbd>K</kbd><span>Photo mode</span><kbd>Esc</kbd><span>Pause</span></div>
    <p style="margin-top:10px">Gamepad: left stick move, right stick look, A jump, X paw, B bark, Y sit, right trigger zoomies.</p>
    <p>Mischief (like nabbing a sausage) brings the ranger jogging over with a leash. Outrun her or go for a swim.</p>`, actions: [{ label: 'Got it', primary: true }] });
  ui.settings = () => ui.openModal({ id: 'settings', title: 'Settings', render: b => {
    const s = state.settings, row = (label, ctl) => { const r = el('label', { class: 'set' }); r.appendChild(el('span', {}, label)); r.appendChild(ctl); b.appendChild(r); return r; };
    const seg = el('div', { class: 'seg', role: 'group' });
    for (const q of ['low', 'medium', 'high']) { const x = el('button', { type: 'button', class: s.quality === q ? 'on' : '', 'data-q': q }); x.textContent = q[0].toUpperCase() + q.slice(1); x.addEventListener('click', () => { game.setQuality(q, true); seg.querySelectorAll('button').forEach(k => k.classList.toggle('on', k === x)); }); seg.appendChild(x); }
    row('Graphics', seg);
    const check = (label, key, fn) => { const c = el('input', { type: 'checkbox', 'data-set': key }); c.checked = !!s[key]; c.addEventListener('change', () => { s[key] = c.checked; fn && fn(c.checked); game.save.save(); }); row(label, c); };
    const range = (label, key, fn) => { const c = el('input', { type: 'range', min: 0, max: 100, 'data-set': key }); c.value = Math.round(s[key] * 100); c.addEventListener('input', () => { s[key] = c.value / 100; fn && fn(); }); c.addEventListener('change', () => game.save.save()); row(label, c); };
    check('Lower graphics automatically if slow', 'autoQuality');
    range('Sound', 'sound', () => game.audio.applyVolume()); range('Music', 'music', () => game.audio.applyVolume());
    check('Invert camera up / down', 'invertY'); check('Invert camera left / right', 'invertX');
    check('Left-handed touch controls', 'leftHanded', v => document.body.classList.toggle('lefty', v));
    check('Rain showers', 'rain'); check('Spooky season town', 'halloween', v => game.world.setHalloween(v));
    const reset = el('button', { type: 'button', class: 'btn danger', style: 'margin-top:12px;width:100%' }); reset.textContent = 'Start over (erase save)';
    reset.addEventListener('click', async () => { if (await ui.confirm('Start over?', 'This erases KC\'s bones, gems and everything she has found on this device.', 'Erase', 'Keep playing')) { game.save.reset(); location.reload(); } });
    b.appendChild(reset);
  }, actions: [{ label: 'Done', primary: true }] });

  ui.map = () => ui.openModal({ id: 'map', title: 'Cedar Hollow', wide: true, render: b => {
    const S = 720, cv = el('canvas', { id: 'mapCanvas', width: S, height: S }), x = cv.getContext('2d'), w = game.world, k = w.mapScale, span = HALF + 6, src = (EXT - span) * k, sw = span * 2 * k, px = v => ((v + span) / (span * 2)) * S;
    x.drawImage(w.mapCanvas, src, src, sw, sw, 0, 0, S, S);
    x.textAlign = 'center'; x.font = '800 17px system-ui, sans-serif'; x.lineWidth = 4; x.strokeStyle = 'rgba(16,34,27,.85)'; x.fillStyle = '#fff';
    for (const [name, lx, lz] of DISTRICT_LABELS) { x.strokeText(name, px(lx), px(lz)); x.fillText(name, px(lx), px(lz)); }
    const dot = (wx, wz, col, r = 5) => { x.beginPath(); x.arc(px(wx), px(wz), r, 0, 7); x.fillStyle = col; x.fill(); x.lineWidth = 2; x.strokeStyle = '#12261e'; x.stroke(); };
    for (const p of PHOTO_SPOTS) if (state.collected.photos.includes(p.id)) dot(p.x, p.z, '#ffd23c', 4);
    for (const s of SIGNPOSTS) if (state.collected.signs.includes(s.id)) dot(s.x, s.z, '#c49a6a', 3.5);
    for (const r of game.vehicles.rides) dot(r.x, r.z, r.kind === 'van' ? '#4fb0a8' : r.kind === 'canoe' ? '#d9534f' : '#f08a2a', 4.5);
    for (const m of game.api.markers.values()) { const p = m.getPos ? m.getPos() : m; if (p) { dot(p.x, p.z, m.color, 6); if (m.label) { x.font = '700 12px system-ui, sans-serif'; x.lineWidth = 3; x.strokeStyle = 'rgba(16,34,27,.85)'; x.strokeText(m.label, px(p.x), px(p.z) - 9); x.fillStyle = '#fff'; x.fillText(m.label, px(p.x), px(p.z) - 9); } } }
    const o = game.api.objective; if (o) { const p = o.getPos ? o.getPos() : o; dot(p.x, p.z, '#ffd23c', 8); }
    const kc = game.kc; x.save(); x.translate(px(kc.pos.x), px(kc.pos.z)); x.rotate(Math.PI - kc.yaw); x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 9); x.lineTo(0, 5); x.lineTo(-8, 9); x.closePath(); x.fillStyle = '#ffb238'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#12261e'; x.stroke(); x.restore();
    b.appendChild(cv); const c = game.collect.counts();
    b.appendChild(el('div', { class: 'legend' }, `<span>Places found <b>${c.zones}/12</b></span><span>Golden balls <b>${c.balls}/${c.ballsTotal}</b></span><span>Photo spots <b>${c.photos}/${c.photosTotal}</b></span><span>Signs <b>${c.signs}/${c.signsTotal}</b></span><span>Orange arrow: KC</span><span>Dots: rides and things you have found</span>`));
  }, actions: [{ label: 'Close', primary: true }] });

  /* ---------- photo mode ---------- */
  ui.photoMode = on => {
    if (on === ui.photo) return; ui.photo = on; game.cam.mode = on ? 'photo' : 'follow'; hud.hidden = on || !ui.started; $('photobar').hidden = !on;
    if (!on) game.cam.dist = clamp(game.cam.dist, 3, 13); bus.emit('photoMode', { on });
  };
  ui.snap = () => {
    const src = game.renderer.domElement; game.renderNow();
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const fs = Math.max(14, Math.round(c.height * 0.028)); x.font = `800 ${fs}px system-ui, sans-serif`; x.textAlign = 'right'; x.lineWidth = fs * 0.22; x.strokeStyle = 'rgba(0,0,0,.55)'; x.fillStyle = '#fff';
    const cap = `KC: Open Trail  ·  ${game.api.zone ? game.api.zone.name : 'Cedar Hollow'}`; x.strokeText(cap, c.width - fs, c.height - fs); x.fillText(cap, c.width - fs, c.height - fs);
    game.audio.sfx('shutter'); state.stats.photos++; ui.lastPhoto = { w: c.width, h: c.height };
    const done = url => { const a = el('a', { href: url, download: `kc-open-trail-${Date.now()}.png` }); document.body.appendChild(a); a.click(); a.remove(); if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 4000); };
    if (c.toBlob) c.toBlob(b => { if (b) done(URL.createObjectURL(b)); }, 'image/png'); else done(c.toDataURL('image/png'));
    $('fade').style.background = '#fff'; $('fade').classList.add('on'); setTimeout(() => { $('fade').classList.remove('on'); setTimeout(() => { $('fade').style.background = ''; }, 320); }, 90);
    bus.emit('photoTaken', { x: game.kc.pos.x, z: game.kc.pos.z, zone: game.api.zone && game.api.zone.id });
  };
  $('photoSnap').addEventListener('click', () => ui.snap()); $('photoExit').addEventListener('click', () => ui.photoMode(false));

  /* ---------- buttons ---------- */
  $('btnPause').addEventListener('click', () => { sfx(); ui.pause(); }); $('btnMap').addEventListener('click', () => { sfx(); ui.map(); }); $('minimapBtn').addEventListener('click', () => { sfx(); ui.map(); });
  $('btnPhoto').addEventListener('click', () => { sfx(); ui.photoMode(true); });
  $('prompt').addEventListener('click', () => game.input.press('interact'));
  document.querySelectorAll('#pad button').forEach(b => {
    const name = b.dataset.btn, set = d => { b.classList.toggle('down', d); game.input.setButton(name, d); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } set(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(false));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('titleSettings').addEventListener('click', () => { sfx(); ui.settings(); }); $('titleHelp').addEventListener('click', () => { sfx(); ui.help(); });
  ui.start = () => { ui.started = true; $('title').hidden = true; hud.hidden = false; document.body.classList.toggle('lefty', !!state.settings.leftHanded); $('game').focus({ preventScroll: true }); bus.emit('start', {}); };

  /* ---------- live readouts ---------- */
  const wB = $('wBones'), wG = $('wGems');
  const wallet = () => { wB.textContent = state.wallet.bones; wG.textContent = state.wallet.gems; };
  bus.on('wallet', e => { wallet(); const n = (e.currency === 'gems' ? wG : wB).parentNode; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); });
  bus.on('enterZone', e => { if (e.district) { $('zone').textContent = e.name; if (ui.started) ui.banner(e.name, e.first ? 'Discovered' : ''); } });
  bus.on('discover', e => { if (ui.started && game.rewards.zone) { game.wallet.add('bones', game.rewards.zone, 'discover'); } });
  bus.on('objective', o => { $('objective').hidden = !o; });
  const paws = [...document.querySelectorAll('#mischief .paws i')];
  let lastPrompt = '', clockT = 0, frame = 0;
  const stam = $('stamina'), stamBar = stam.querySelector('.bar i'), stickEl = $('stick'), knob = stickEl.firstChild;
  ui.update = dt => {
    const { kc, cam, api, world } = game; frame++;
    const f = kc.stamina / kc.staminaMax; stamBar.style.transform = `scaleX(${f.toFixed(3)})`; stam.classList.toggle('low', kc.exhausted || f < 0.25); stam.setAttribute('aria-valuenow', Math.round(f * 100));
    const p = api.prompt, key = p ? p.label : '';
    if (key !== lastPrompt) { lastPrompt = key; const pe = $('prompt'); pe.hidden = !p; if (p) pe.innerHTML = icon(p.icon || 'paw', 20) + `<span></span><kbd>${game.input.lastDevice === 'gamepad' ? 'X' : 'F'}</kbd>`, pe.children[1].textContent = p.label; }
    const M = game.npcs.mischief, lv = Math.ceil(M.level); $('mischief').hidden = lv <= 0; for (let i = 0; i < 3; i++) paws[i].classList.toggle('on', i < lv);
    clockT -= dt; if (clockT <= 0) { clockT = 1; const t = world.time, h = Math.floor(t), m = Math.floor((t - h) * 6) * 10, h12 = ((h + 11) % 12) + 1; $('clock').textContent = `Day ${world.day}  ·  ${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}${world.rain > 0.2 ? '  ·  rain' : ''}`; wallet(); }
    const s = game.input.stick; stickEl.classList.toggle('on', s.active); if (s.active) { stickEl.style.left = s.ox + 'px'; stickEl.style.top = s.oy + 'px'; knob.style.transform = `translate(${s.x * 30}px, ${s.y * 30}px)`; }
    if (api.objective) { const o = api.objective, q = o.getPos ? o.getPos() : o, d = Math.hypot(q.x - kc.pos.x, q.z - kc.pos.z); if (frame % 10 === 0) $('objective').innerHTML = `${o.label ? o.label + ' ' : ''}<b>${Math.round(d)} m</b>`; }
    /* minimap (north up) */
    if (frame % 2 === 0) {
      const S = mm.width, span = 150, k = world.mapScale, sx = (kc.pos.x + EXT - span / 2) * k, sy = (kc.pos.z + EXT - span / 2) * k, sc = S / span, mx = wx => (wx - kc.pos.x) * sc + S / 2, mz = wz => (wz - kc.pos.z) * sc + S / 2;
      mctx.fillStyle = '#27402f'; mctx.fillRect(0, 0, S, S); mctx.drawImage(world.mapCanvas, sx, sy, span * k, span * k, 0, 0, S, S);
      const dot = (wx, wz, col, r, edge) => { let x = mx(wx), y = mz(wz); const out = x < 10 || y < 10 || x > S - 10 || y > S - 10; if (out && !edge) return; x = clamp(x, 12, S - 12); y = clamp(y, 12, S - 12); mctx.beginPath(); mctx.arc(x, y, out ? r * 0.75 : r, 0, 7); mctx.fillStyle = col; mctx.fill(); mctx.lineWidth = 2.5; mctx.strokeStyle = '#12261e'; mctx.stroke(); };
      for (const r of game.vehicles.rides) if (r !== kc.ride) dot(r.x, r.z, r.kind === 'van' ? '#4fb0a8' : r.kind === 'canoe' ? '#d9534f' : '#f08a2a', 6);
      for (const c of game.vehicles.cars) dot(c.x, c.z, '#dfe6ea', 4);
      for (const m of api.markers.values()) { if (m.minimap === false) continue; const q = m.getPos ? m.getPos() : m; if (q) dot(q.x, q.z, m.color, 8, m.edge); }
      if (M.chasing) dot(game.npcs.ranger.x, game.npcs.ranger.z, '#ff6a4a', 8, true);
      if (api.objective) { const q = api.objective.getPos ? api.objective.getPos() : api.objective; dot(q.x, q.z, '#ffd23c', 10, true); }
      mctx.save(); mctx.translate(S / 2, S / 2);
      mctx.rotate(Math.PI - cam.yaw); mctx.beginPath(); mctx.moveTo(0, 0); mctx.arc(0, 0, 70, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); mctx.closePath(); mctx.fillStyle = 'rgba(255,255,255,.22)'; mctx.fill(); mctx.rotate(-(Math.PI - cam.yaw));
      mctx.rotate(Math.PI - kc.yaw); mctx.beginPath(); mctx.moveTo(0, -17); mctx.lineTo(12, 13); mctx.lineTo(0, 7); mctx.lineTo(-12, 13); mctx.closePath(); mctx.fillStyle = '#ffb238'; mctx.fill(); mctx.lineWidth = 3.5; mctx.strokeStyle = '#12261e'; mctx.stroke(); mctx.restore();
      /* compass */
      const W = cp.width, Hh = cp.height; cctx.clearRect(0, 0, W, Hh); cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
      const tick = (ang, label, col, big) => { const d = angDiff(cam.yaw, ang), x = W / 2 - d * (W / 2.6); if (x < 12 || x > W - 12) return; cctx.fillStyle = col; if (label) { cctx.font = `${big ? 900 : 700} ${big ? 26 : 19}px system-ui, sans-serif`; cctx.fillText(label, x, Hh / 2 + 1); } else cctx.fillRect(x - 1.5, Hh / 2 - 7, 3, 14); };
      tick(Math.PI, 'N', '#ffb238', true); tick(Math.PI / 2, 'E', '#fff'); tick(0, 'S', '#fff'); tick(-Math.PI / 2, 'W', '#fff'); for (const a of [0.785, 2.356, -0.785, -2.356]) tick(a, '', 'rgba(255,255,255,.5)');
      if (api.objective) { const q = api.objective.getPos ? api.objective.getPos() : api.objective, a = Math.atan2(q.x - kc.pos.x, q.z - kc.pos.z), d = clamp(angDiff(cam.yaw, a), -1.25, 1.25), x = W / 2 - d * (W / 2.6); cctx.fillStyle = '#ffd23c'; cctx.beginPath(); cctx.moveTo(x, Hh - 4); cctx.lineTo(x - 10, 6); cctx.lineTo(x + 10, 6); cctx.closePath(); cctx.fill(); }
      cctx.fillStyle = 'rgba(255,255,255,.9)'; cctx.fillRect(W / 2 - 1, 0, 2, 7);
    }
  };
  wallet();
  return ui;
}
