/* Keyboard + mouse, multi-touch (virtual stick, camera drag, buttons) and gamepad,
   folded into one state object the rest of the game reads. */
import { clamp } from './util.js';

const KEYMAP = { Space: 'jump', KeyF: 'interact', Enter: 'interact', KeyB: 'bark', KeyC: 'sit', KeyG: 'dig', KeyX: 'shake', KeyM: 'map', Escape: 'pause', KeyP: 'pause', KeyK: 'photo' };

export function createInput(game, canvas) {
  const input = {
    moveX: 0, moveY: 0, sprint: false, camX: 0, camY: 0, zoom: 0, enabled: true, touch: false, lastDevice: 'keyboard',
    pressed: {}, held: {}, stick: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }
  };
  const keys = new Set(); let camDX = 0, camDY = 0, zoom = 0, mouseDrag = false, camTouch = -1, cam2 = -1, lx = 0, ly = 0, pinch = 0, stickT = 0;
  const pts = new Map();   /* live touch positions, for the two-finger pinch that zooms the camera */
  const btn = {}; const padPrev = [];
  const press = a => { input.pressed[a] = true; };
  input.press = press;
  input.setButton = (name, down) => { if (down && !btn[name]) press(name); btn[name] = down; };

  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.repeat) { if (KEYMAP[e.code] || e.code.startsWith('Arrow')) e.preventDefault(); return; }
    keys.add(e.code); input.lastDevice = 'keyboard';
    const a = KEYMAP[e.code]; if (a) { press(a); if (e.code === 'Space' || e.code === 'Enter') { if (!document.querySelector('.modal:not([hidden])')) e.preventDefault(); } }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); for (const k in btn) btn[k] = false; input.stick.active = false; mouseDrag = false; camTouch = cam2 = -1; pinch = 0; pts.clear(); });

  /* show the thumb controls straight away on touch devices (and on the first touch anywhere on hybrids) */
  const touchOn = () => { input.touch = true; document.body.classList.add('touch'); };
  try { if (matchMedia('(pointer: coarse)').matches) touchOn(); } catch (e) { /* ignore */ }
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { touchOn(); input.lastDevice = 'touch'; } }, { passive: true, capture: true });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      input.touch = true; input.lastDevice = 'touch'; document.body.classList.add('touch');
      const left = e.clientX < innerWidth / 2, stickSide = game.state.settings.leftHanded ? !left : left;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (stickSide && !input.stick.active && game.cam.mode !== 'photo') { Object.assign(input.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 }); stickT = performance.now(); }
      else if (camTouch === -1) {
        camTouch = e.pointerId; lx = e.clientX; ly = e.clientY;
        /* two fingers landing together on the stick side are a pinch, not a move: hand the first finger over to the camera */
        const st = input.stick; if (stickSide && st.active && performance.now() - stickT < 350 && Math.hypot(st.x, st.y) < 0.4) { cam2 = st.id; st.active = false; st.id = -1; st.x = st.y = 0; pinch = 0; }
      }
      else if (cam2 === -1 && e.pointerId !== input.stick.id) { cam2 = e.pointerId; pinch = 0; }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    } else { mouseDrag = true; lx = e.clientX; ly = e.clientY; input.lastDevice = 'keyboard'; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') {
      const s = input.stick;
      if (s.active && e.pointerId === s.id) { const R = 56; let dx = e.clientX - s.ox, dy = e.clientY - s.oy; const l = Math.hypot(dx, dy); if (l > R) { s.ox += dx - (dx / l) * R; s.oy += dy - (dy / l) * R; dx = (dx / l) * R; dy = (dy / l) * R; } s.x = dx / R; s.y = dy / R; }
      else if (cam2 !== -1 && (e.pointerId === camTouch || e.pointerId === cam2)) {
        pts.set(e.pointerId, [e.clientX, e.clientY]); const a = pts.get(camTouch), b = pts.get(cam2);
        if (a && b) { const d = Math.max(12, Math.hypot(a[0] - b[0], a[1] - b[1])); if (pinch > 0) zoom += clamp(pinch / d - 1, -0.25, 0.25); pinch = d; }
        if (e.pointerId === camTouch) { lx = e.clientX; ly = e.clientY; }
      }
      else if (e.pointerId === camTouch) { camDX += (e.clientX - lx) * 0.0065; camDY += (e.clientY - ly) * 0.005; lx = e.clientX; ly = e.clientY; }
    } else if (mouseDrag) { camDX += (e.clientX - lx) * 0.0052; camDY += (e.clientY - ly) * 0.004; lx = e.clientX; ly = e.clientY; }
  });
  const up = e => {
    if (e.pointerType === 'touch') {
      pts.delete(e.pointerId);
      if (e.pointerId === input.stick.id) { input.stick.active = false; input.stick.id = -1; input.stick.x = input.stick.y = 0; }
      if (e.pointerId === cam2) { cam2 = -1; pinch = 0; }
      else if (e.pointerId === camTouch) { camTouch = cam2; cam2 = -1; pinch = 0; const q = pts.get(camTouch); if (q) { lx = q[0]; ly = q[1]; } }
    }
    else mouseDrag = false;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', e => { zoom += clamp(e.deltaY, -100, 100) * 0.0012; e.preventDefault(); }, { passive: false });

  input.poll = dt => {
    let mx = 0, my = 0, sprint = false, cx = camDX, cy = camDY, z = zoom; camDX = camDY = zoom = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) my -= 1;
    if (mx && my) { mx *= 0.7071; my *= 0.7071; }
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) sprint = true;
    if (keys.has('KeyQ')) cx -= dt * 2.2; if (keys.has('KeyE')) cx += dt * 2.2;
    if (input.stick.active) { mx = input.stick.x; my = -input.stick.y; }
    if (btn.sprint) sprint = true;
    /* gamepad */
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const dz = v => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82), ax = gp.axes;
      const gx = dz(ax[0] || 0), gy = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
      if (gx || gy) { mx = gx; my = -gy; input.lastDevice = 'gamepad'; }
      cx += rx * dt * 2.6; cy += ry * dt * 1.8;
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), map = [[0, 'jump'], [2, 'interact'], [1, 'bark'], [3, 'sit'], [9, 'pause'], [8, 'map'], [13, 'dig'], [12, 'shake'], [4, 'photo']];
      for (const [i, a] of map) { const d = b(i), k = gp.index * 32 + i; if (d && !padPrev[k]) { press(a); input.lastDevice = 'gamepad'; } padPrev[k] = d; }
      if (b(7) || b(5) || b(10)) sprint = true;
      break;
    }
    if (!input.enabled) { mx = my = 0; sprint = false; for (const k in input.pressed) if (k !== 'pause' && k !== 'map') delete input.pressed[k]; }
    input.moveX = clamp(mx, -1, 1); input.moveY = clamp(my, -1, 1); input.sprint = sprint; input.camX = cx; input.camY = cy; input.zoom = z;
  };
  input.endFrame = () => { for (const k in input.pressed) delete input.pressed[k]; };
  /* debug / tests: hold a virtual key state */
  input.debugKeys = keys;
  return input;
}
