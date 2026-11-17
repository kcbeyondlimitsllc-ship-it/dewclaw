/* Photo mode extras: frames, colour filters, stickers, zoom and KC poses (the Trail Camera ladder).
   Everything is drawn in code on a 2D canvas: no image files. The live view shows the same overlay the saved
   picture gets. Presets start locked; a module unlocks what the player has earned:
     game.photo.unlock('frame', ['postcard', 'polaroid'])   kinds: frame, filter, sticker, pose, zoom
     game.photo.registerFrame('mine', { name: 'Mine', draw(ctx, w, h, info) {} })   (registered things are unlocked)
   See ARCHITECTURE.md, "Module seams". */
import { el, icon, clamp, TAU } from './util.js';

const $ = id => document.getElementById(id);

export function createPhotoKit(game, ui) {
  const { bus } = game;
  const lib = { frame: new Map(), filter: new Map(), sticker: new Map(), pose: new Map() };
  const st = { frame: null, filter: null, stickers: [], zoom: 1, pose: null };
  let zoomOk = false, shown = false, tray = false;
  const layer = $('photoLayer'), fcv = $('photoFrame'), tools = $('phototools'), trayEl = $('phototray'), canvas = $('game');

  /* ---------- presets ---------- */
  const text = (x, s, px, py, size, col, align = 'center', weight = 800) => { x.font = `${weight} ${size}px system-ui, sans-serif`; x.textAlign = align; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(s, px, py); };
  const pawAt = (x, px, py, r, rot, col) => { x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = col; x.beginPath(); x.ellipse(0, r * 0.3, r * 0.55, r * 0.46, 0, 0, TAU); x.fill(); for (const [ox, oy] of [[-0.62, -0.2], [-0.24, -0.62], [0.24, -0.62], [0.62, -0.2]]) { x.beginPath(); x.ellipse(ox * r, oy * r, r * 0.21, r * 0.28, 0, 0, TAU); x.fill(); } x.restore(); };
  const leafAt = (x, px, py, r, rot, col) => { x.save(); x.translate(px, py); x.rotate(rot); x.fillStyle = col; x.beginPath(); x.moveTo(0, -r); x.quadraticCurveTo(r * 0.8, -r * 0.2, 0, r); x.quadraticCurveTo(-r * 0.8, -r * 0.2, 0, -r); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = Math.max(1, r * 0.06); x.beginPath(); x.moveTo(0, -r * 0.8); x.lineTo(0, r * 0.9); x.stroke(); x.restore(); };
  const FRAMES = {
    postcard: { name: 'Postcard', inset: [5, 15], draw(x, w, h, info) { const u = Math.min(w, h) / 100, b = 3 * u, band = 11 * u; x.fillStyle = '#fbf3df'; x.fillRect(0, 0, w, b); x.fillRect(0, 0, b, h); x.fillRect(w - b, 0, b, h); x.fillRect(0, h - band, w, band); x.strokeStyle = '#c9483a'; x.lineWidth = 0.5 * u; x.strokeRect(b + u, b + u, w - 2 * b - 2 * u, h - band - b - 2 * u); text(x, 'Greetings from ' + info.place, b + 2 * u, h - band / 2, 4.6 * u, '#2a3a30', 'left'); pawAt(x, w - b - 6 * u, h - band / 2, 3.2 * u, -0.3, '#c9483a'); } },
    polaroid: { name: 'Instant', inset: [6, 19], draw(x, w, h, info) { const u = Math.min(w, h) / 100, b = 4.5 * u, band = 16 * u; x.fillStyle = '#fdfdf8'; x.fillRect(0, 0, w, b); x.fillRect(0, 0, b, h); x.fillRect(w - b, 0, b, h); x.fillRect(0, h - band, w, band); text(x, info.place + '  ·  Day ' + info.day, w / 2, h - band / 2, 5 * u, '#3a3a40', 'center', 700); } },
    trail: { name: 'Trail map', inset: [6, 6], draw(x, w, h) { const u = Math.min(w, h) / 100, b = 4 * u; x.strokeStyle = '#12261e'; x.lineWidth = b * 2; x.strokeRect(0, 0, w, h); x.strokeStyle = '#ffb238'; x.lineWidth = 0.7 * u; x.strokeRect(b + u, b + u, w - 2 * b - 2 * u, h - 2 * b - 2 * u); for (const [px, py, r] of [[b + 6 * u, b + 6 * u, 0.5], [w - b - 6 * u, b + 6 * u, -0.5], [b + 6 * u, h - b - 6 * u, 2.4], [w - b - 6 * u, h - b - 6 * u, -2.4]]) pawAt(x, px, py, 3 * u, r, 'rgba(255,178,56,.92)'); } },
    film: { name: 'Film strip', inset: [3, 13], draw(x, w, h) { const u = Math.min(w, h) / 100, bar = 10 * u; x.fillStyle = '#101214'; x.fillRect(0, 0, w, bar); x.fillRect(0, h - bar, w, bar); x.fillStyle = '#e9e4d6'; const n = Math.max(6, Math.round(w / (9 * u))); for (let i = 0; i < n; i++) { const px = (i + 0.5) * (w / n) - 2 * u; x.fillRect(px, 3 * u, 4 * u, 4 * u); x.fillRect(px, h - 7 * u, 4 * u, 4 * u); } } },
    lanterns: { name: 'Lantern string', inset: [3, 3], draw(x, w, h) { const u = Math.min(w, h) / 100, n = Math.max(5, Math.round(w / (16 * u))), y = t => 4 * u + Math.sin(t * Math.PI) * 7 * u; x.strokeStyle = '#2a2c30'; x.lineWidth = 0.5 * u; x.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40; if (i) x.lineTo(t * w, y(t)); else x.moveTo(0, y(0)); } x.stroke(); const cols = ['#ffb238', '#ff7a4a', '#ffe27a', '#f08a2a']; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, px = t * w, py = y(t) + 3.4 * u; x.fillStyle = 'rgba(255,220,140,.28)'; x.beginPath(); x.arc(px, py, 5.4 * u, 0, TAU); x.fill(); x.fillStyle = cols[i % cols.length]; x.beginPath(); x.ellipse(px, py, 2.4 * u, 3 * u, 0, 0, TAU); x.fill(); x.fillStyle = '#2a2c30'; x.fillRect(px - 1.1 * u, py - 3.6 * u, 2.2 * u, 0.9 * u); } const g = x.createLinearGradient(0, h * 0.72, 0, h); g.addColorStop(0, 'rgba(20,14,40,0)'); g.addColorStop(1, 'rgba(20,14,40,.38)'); x.fillStyle = g; x.fillRect(0, h * 0.72, w, h * 0.28); } },
    leaves: { name: 'Autumn leaves', inset: [3, 3], draw(x, w, h) { const u = Math.min(w, h) / 100, cols = ['#e07a2a', '#c9483a', '#f0c040', '#a8602f']; let k = 0; for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) for (let i = 0; i < 6; i++) { const a = (i / 5) * 1.57, r = (6 + (i % 3) * 5) * u; leafAt(x, cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy, (4 + (i % 2) * 1.6) * u, a * 2.3 + i, cols[k++ % cols.length]); } } }
  };
  const FILTERS = {
    warm: { name: 'Golden hour', css: 'saturate(1.15) sepia(.2) brightness(1.03)', tint: ['#ffb060', 0.14, 'soft-light'] },
    cool: { name: 'River mist', css: 'saturate(1.05) hue-rotate(-8deg) brightness(1.03)', tint: ['#7fb8ff', 0.16, 'soft-light'] },
    sepia: { name: 'Old photo', css: 'sepia(.85) contrast(1.04)', tint: ['#704214', 0.4, 'color'] },
    mono: { name: 'Black and white', css: 'grayscale(1) contrast(1.08)', tint: ['#808080', 1, 'saturation'] },
    dusk: { name: 'Lantern dusk', css: 'saturate(1.2) contrast(1.05) hue-rotate(-12deg) brightness(.94)', tint: ['#6a4fa0', 0.22, 'soft-light'] }
  };
  const outline = (x, s) => { x.lineJoin = 'round'; x.lineWidth = s * 0.07; x.strokeStyle = '#fff'; x.stroke(); };
  const STICKERS = {
    paw: { name: 'Paw print', draw(x, s) { x.save(); x.fillStyle = '#fff'; pawAt(x, 0, 0, s * 0.5, 0, '#fff'); pawAt(x, 0, 0, s * 0.43, 0, '#ffb238'); x.restore(); } },
    bone: { name: 'Bone', draw(x, s) { const r = s * 0.14, l = s * 0.26; x.save(); x.rotate(-0.5); const shape = k => { x.beginPath(); x.rect(-l, -r * 0.6 * k, l * 2, r * 1.2 * k); for (const sx of [-1, 1]) for (const sy of [-1, 1]) { x.moveTo(sx * l + r * k, sy * r * 0.7); x.arc(sx * l, sy * r * 0.7, r * k, 0, TAU); } x.fill(); }; x.fillStyle = '#2a1a00'; shape(1.25); x.fillStyle = '#fff6e0'; shape(1); x.restore(); } },
    heart: { name: 'Heart', draw(x, s) { const r = s * 0.42; x.beginPath(); x.moveTo(0, r * 0.9); x.bezierCurveTo(-r * 1.5, -r * 0.2, -r * 0.6, -r * 1.2, 0, -r * 0.4); x.bezierCurveTo(r * 0.6, -r * 1.2, r * 1.5, -r * 0.2, 0, r * 0.9); x.closePath(); outline(x, s); x.fillStyle = '#e8566a'; x.fill(); } },
    star: { name: 'Star', draw(x, s) { const R = s * 0.48; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); outline(x, s); x.fillStyle = '#ffd23c'; x.fill(); } },
    ball: { name: 'Golden ball', draw(x, s) { const r = s * 0.42; x.beginPath(); x.arc(0, 0, r, 0, TAU); outline(x, s); x.fillStyle = '#ffd23c'; x.fill(); x.strokeStyle = '#fffbe0'; x.lineWidth = s * 0.05; x.beginPath(); x.arc(-r * 1.1, 0, r, -0.9, 0.9); x.stroke(); x.beginPath(); x.arc(r * 1.1, 0, r, Math.PI - 0.9, Math.PI + 0.9); x.stroke(); } },
    leaf: { name: 'Leaf', draw(x, s) { leafAt(x, 0, 0, s * 0.5, 0.5, '#fff'); leafAt(x, 0, 0, s * 0.43, 0.5, '#e07a2a'); } },
    woof: { name: 'Woof!', draw(x, s) { const w = s * 0.98, h = s * 0.56; x.beginPath(); x.ellipse(0, -h * 0.1, w / 2, h / 2, 0, 0, TAU); x.moveTo(-w * 0.2, h * 0.3); x.lineTo(-w * 0.34, h * 0.72); x.lineTo(-w * 0.02, h * 0.36); x.fillStyle = '#fff'; x.fill(); x.lineWidth = s * 0.035; x.strokeStyle = '#2a1a00'; x.stroke(); text(x, 'Woof!', 0, -h * 0.08, s * 0.25, '#2a1a00', 'center', 900); } }
  };
  const POSES = { sit: 'Sit', bark: 'Speak', beg: 'Sit and speak', play: 'Play bow' };
  for (const k in FRAMES) lib.frame.set(k, { ...FRAMES[k], id: k, locked: true });
  for (const k in FILTERS) lib.filter.set(k, { ...FILTERS[k], id: k, locked: true });
  for (const k in STICKERS) lib.sticker.set(k, { ...STICKERS[k], id: k, locked: true });
  for (const k in POSES) lib.pose.set(k, { id: k, name: POSES[k], locked: true });

  const info = () => ({ place: game.api.zone ? game.api.zone.name : 'St. Helens', day: game.world.day });
  const open = kind => [...lib[kind].values()].filter(v => !v.locked && (!v.enabled || v.enabled()));
  const cycle = (kind, cur) => { const list = [null, ...open(kind).map(v => v.id)], i = list.indexOf(cur); return list[(i + 1) % list.length]; };

  /* ---------- live overlay ---------- */
  function paintFrame() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr); if (fcv.width !== w || fcv.height !== h) { fcv.width = w; fcv.height = h; }
    const x = fcv.getContext('2d'); x.clearRect(0, 0, w, h); const f = st.frame && lib.frame.get(st.frame); if (f) { x.save(); try { f.draw(x, w, h, info()); } catch (e) { console.error('[photo frame]', e); } x.restore(); }
  }
  function placeSticker(s) { const m = Math.min(innerWidth, innerHeight), px = s.size * m; s.el.style.width = s.el.style.height = px + 'px'; s.el.style.left = (s.x * innerWidth - px / 2) + 'px'; s.el.style.top = (s.y * innerHeight - px / 2) + 'px'; }
  function makeStickerEl(s) {
    const def = lib.sticker.get(s.id), c = el('canvas', { class: 'stk', width: 160, height: 160, 'aria-label': def.name }); const x = c.getContext('2d'); x.translate(80, 80); try { def.draw(x, 150); } catch (e) { console.error('[photo sticker]', e); }
    let drag = null;
    c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } drag = [e.clientX - s.x * innerWidth, e.clientY - s.y * innerHeight]; });
    c.addEventListener('pointermove', e => { if (!drag) return; s.x = clamp((e.clientX - drag[0]) / innerWidth, 0.03, 0.97); s.y = clamp((e.clientY - drag[1]) / innerHeight, 0.03, 0.97); placeSticker(s); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) c.addEventListener(ev, () => { drag = null; });
    s.el = c; layer.appendChild(c); placeSticker(s);
  }
  function applyLive() {
    if (!shown) return; const f = st.filter && lib.filter.get(st.filter); canvas.style.filter = f && f.css ? f.css : ''; game.cam.photoZoom = st.zoom; paintFrame(); for (const s of st.stickers) placeSticker(s); drawTools();
  }
  function drawTools() {
    tools.innerHTML = ''; const mk = (id, label, fn, on) => { const b = el('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'data-tool': id }); b.textContent = label; b.addEventListener('click', () => { game.audio.sfx('ui'); fn(); }); tools.appendChild(b); };
    if (open('frame').length) mk('frame', 'Frame: ' + (st.frame ? lib.frame.get(st.frame).name : 'none'), () => kit.setFrame(cycle('frame', st.frame)), !!st.frame);
    if (open('filter').length) mk('filter', 'Colour: ' + (st.filter ? lib.filter.get(st.filter).name : 'natural'), () => kit.setFilter(cycle('filter', st.filter)), !!st.filter);
    if (zoomOk) mk('zoom', 'Zoom: ' + st.zoom + '×', () => kit.setZoom(st.zoom >= 3 ? 1 : st.zoom >= 2 ? 3 : st.zoom >= 1.5 ? 2 : 1.5), st.zoom > 1);
    if (open('pose').length) mk('pose', 'Pose: ' + (st.pose ? lib.pose.get(st.pose).name : 'as she is'), () => kit.setPose(cycle('pose', st.pose)), !!st.pose);
    if (open('sticker').length) mk('sticker', tray ? 'Stickers: close' : 'Stickers', () => { tray = !tray; drawTools(); }, tray);
    tools.hidden = !tools.children.length;
    trayEl.innerHTML = ''; trayEl.hidden = !(tray && open('sticker').length);
    if (!trayEl.hidden) { for (const d of open('sticker')) { const b = el('button', { type: 'button', class: 'stkpick', 'aria-label': 'Add sticker: ' + d.name, 'data-sticker': d.id }), c = el('canvas', { width: 72, height: 72 }), x = c.getContext('2d'); x.translate(36, 36); try { d.draw(x, 66); } catch (e) { /* ignore */ } b.appendChild(c); b.addEventListener('click', () => { game.audio.sfx('ui'); kit.addSticker(d.id); }); trayEl.appendChild(b); }
      const undo = el('button', { type: 'button', class: 'chip', 'data-tool': 'undo' }); undo.textContent = 'Undo'; undo.addEventListener('click', () => kit.removeSticker()); trayEl.appendChild(undo);
      const clr = el('button', { type: 'button', class: 'chip', 'data-tool': 'clear' }); clr.textContent = 'Clear'; clr.addEventListener('click', () => kit.clearStickers()); trayEl.appendChild(clr); }
  }
  addEventListener('resize', () => { if (shown) applyLive(); });

  const kit = game.photo = {
    /* registerFrame(id, { name, draw(ctx, w, h, { place, day }), inset?: [x%, y%] (how far the caption moves in from the bottom right) }) */
    registerFrame(id, def) { lib.frame.set(id, { name: id, ...def, id, locked: false }); if (shown) drawTools(); return id; },
    /* registerFilter(id, { name, css (a CSS filter string), tint?: [colour, alpha, blend mode] (used where canvas filters are missing) }) */
    registerFilter(id, def) { lib.filter.set(id, { name: id, ...def, id, locked: false }); if (shown) drawTools(); return id; },
    /* registerSticker(id, { name, draw(ctx, size) }) : draw centred on 0,0 inside a size x size box */
    registerSticker(id, def) { lib.sticker.set(id, { name: id, ...def, id, locked: false }); if (shown) drawTools(); return id; },
    /* unlock('frame' | 'filter' | 'sticker' | 'pose', id | [ids] | '*') ; unlock('zoom') */
    unlock(kind, ids = '*') { if (kind === 'zoom') { zoomOk = true; if (shown) drawTools(); return true; } const m = lib[kind]; if (!m) return false; for (const v of m.values()) if (ids === '*' || ids === v.id || (Array.isArray(ids) && ids.includes(v.id))) v.locked = false; if (shown) drawTools(); return true; },
    lock(kind, ids = '*') { if (kind === 'zoom') { zoomOk = false; kit.setZoom(1); return true; } const m = lib[kind]; if (!m) return false; for (const v of m.values()) if (ids === '*' || ids === v.id || (Array.isArray(ids) && ids.includes(v.id))) v.locked = true;
      if (st.frame && lib.frame.get(st.frame).locked) st.frame = null; if (st.filter && lib.filter.get(st.filter).locked) st.filter = null; if (st.pose && lib.pose.get(st.pose).locked) st.pose = null; applyLive(); return true; },
    /* what the player can pick right now / everything that exists: [{ id, name, locked }] */
    available: kind => (kind === 'zoom' ? zoomOk : lib[kind] ? open(kind).map(v => ({ id: v.id, name: v.name })) : []),
    all: kind => (lib[kind] ? [...lib[kind].values()].map(v => ({ id: v.id, name: v.name, locked: !!v.locked })) : []),
    setFrame(id) { st.frame = id && lib.frame.has(id) && !lib.frame.get(id).locked ? id : null; applyLive(); bus.emit('photoStyle', kit.state()); return st.frame; },
    setFilter(id) { st.filter = id && lib.filter.has(id) && !lib.filter.get(id).locked ? id : null; applyLive(); bus.emit('photoStyle', kit.state()); return st.filter; },
    /* addSticker(id, { x: 0..1, y: 0..1, size: 0.06..0.5 of the short side }) -> index, or -1. At most 12 on a photo; the player can drag them. */
    addSticker(id, o = {}) { const d = lib.sticker.get(id); if (!d || d.locked || st.stickers.length >= 12) return -1; const n = st.stickers.length, s = { id, x: clamp(o.x ?? 0.3 + (n % 4) * 0.13, 0.03, 0.97), y: clamp(o.y ?? 0.3 + (Math.floor(n / 4) % 3) * 0.14, 0.03, 0.97), size: clamp(o.size ?? 0.17, 0.06, 0.5), el: null }; st.stickers.push(s); if (shown) makeStickerEl(s); bus.emit('photoStyle', kit.state()); return n; },
    removeSticker(i = st.stickers.length - 1) { const s = st.stickers[i]; if (!s) return false; if (s.el) s.el.remove(); st.stickers.splice(i, 1); bus.emit('photoStyle', kit.state()); return true; },
    clearStickers() { for (const s of st.stickers) if (s.el) s.el.remove(); st.stickers.length = 0; bus.emit('photoStyle', kit.state()); },
    setZoom(z) { st.zoom = zoomOk ? clamp(+z || 1, 1, 3) : 1; applyLive(); return st.zoom; },
    setPose(name) { st.pose = name && lib.pose.has(name) && !lib.pose.get(name).locked ? name : null; if (shown) game.kc.pose(st.pose); drawTools(); return st.pose; },
    state: () => ({ frame: st.frame, filter: st.filter, stickers: st.stickers.map(s => s.id), zoom: st.zoom, pose: st.pose }),
    /* ---- used by the HUD ---- */
    show(on) {
      shown = !!on; layer.hidden = !shown; tray = false;
      if (shown) { for (const s of st.stickers) if (!s.el) makeStickerEl(s); if (st.pose) game.kc.pose(st.pose); applyLive(); }
      else { canvas.style.filter = ''; game.cam.photoZoom = 1; for (const s of st.stickers) if (s.el) s.el.remove(); st.stickers.length = 0; if (st.pose) { game.kc.sit = false; game.kc.posed = null; } tools.hidden = true; trayEl.hidden = true; }
    },
    /* paint the saved picture: the 3D view through the filter, then the frame, then the stickers */
    compose(x, src, w, h) {
      const f = st.filter && lib.filter.get(st.filter);
      if (f && f.css && 'filter' in x) { x.filter = f.css; x.drawImage(src, 0, 0, w, h); x.filter = 'none'; }
      else { x.drawImage(src, 0, 0, w, h); if (f && f.tint) { x.save(); x.globalCompositeOperation = f.tint[2] || 'source-over'; x.globalAlpha = f.tint[1]; x.fillStyle = f.tint[0]; x.fillRect(0, 0, w, h); x.restore(); } }
      const fr = st.frame && lib.frame.get(st.frame); if (fr) { x.save(); try { fr.draw(x, w, h, info()); } catch (e) { console.error('[photo frame]', e); } x.restore(); }
      const m = Math.min(w, h); for (const s of st.stickers) { const d = lib.sticker.get(s.id); if (!d) continue; x.save(); x.translate(s.x * w, s.y * h); try { d.draw(x, s.size * m); } catch (e) { console.error('[photo sticker]', e); } x.restore(); }
    },
    captionInset(w, h) { const fr = st.frame && lib.frame.get(st.frame), u = Math.min(w, h) / 100; return fr && fr.inset ? [fr.inset[0] * u, fr.inset[1] * u] : [0, 0]; }
  };
  return kit;
}
