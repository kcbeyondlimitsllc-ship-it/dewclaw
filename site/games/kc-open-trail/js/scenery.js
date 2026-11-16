/* Buildings, bridges, street furniture and landmarks, baked into a few
   vertex-coloured chunk meshes (plus one additive "glow" mesh per chunk for
   lit windows and lamp pools at night), and the Fog Bell Festival dressing
   layer. Real public landmarks are drawn from scratch in a generic low-poly
   style; every business name is invented for this game. */
import { THREE, Geo, rng, TAU, lerp, clamp } from './util.js';
import { EXT, BUILDINGS, STALLS, CARTS, SIGNPOSTS, WATER_Y, PLAZA, COURTHOUSE, SJB, MORRISON, WAPATO, LIGHTHOUSE, MAZE, TILIKUM, TRAM, CROSSWALKS, RAIL_CROSSINGS } from './data.js';
import { smoothPath } from './util.js';

const CH = 170, NCH = Math.ceil((EXT * 2) / CH);
const C = { wood: 0x9a6a42, woodD: 0x6e4a2e, woodL: 0xc49a6a, stone: 0x9a9a94, stoneD: 0x77777a, metal: 0x4a4f58, white: 0xf4f4ef, glass: 0x9fc4d8, door: 0x6a4630, red: 0xd9534f, green: 0x4f8f4f, yellow: 0xf0c040, blue: 0x3f7fd6, orange: 0xf08a2a, dark: 0x2a2c30, leaf: 0x4f9a4f, hay: 0xe0c060, sand: 0xdcc890, pink: 0xf08fb0 };

export function buildScenery(game, world) {
  const { scene } = game;
  /* ---------- sign atlas ---------- */
  /* 2048 px, or 1024 px (everything drawn at half size) when the game boots on Low: a quarter of the memory */
  const AT = game.quality && game.quality.boot === 'low' ? 1024 : 2048, SC = AT / 2048, atlasCv = document.createElement('canvas'); atlasCv.width = atlasCv.height = AT; const ax = atlasCv.getContext('2d');
  ax.fillStyle = '#fff'; ax.fillRect(0, 0, AT, 36 * SC);
  { const gr = ax.createRadialGradient(960 * SC, 104 * SC, 2 * SC, 960 * SC, 104 * SC, 62 * SC); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ax.fillStyle = '#000'; ax.fillRect(894 * SC, 38 * SC, 130 * SC, 132 * SC); ax.fillStyle = gr; ax.fillRect(896 * SC, 40 * SC, 128 * SC, 128 * SC); }
  const BLOB = [896 / 2048, 1 - 168 / 2048, 1024 / 2048, 1 - 40 / 2048];
  let shelfX = 2, shelfY = Math.round(40 * SC); const ROWH = Math.round(60 * SC);
  const atlasTex = new THREE.CanvasTexture(atlasCv); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
  const signCache = new Map();
  function makeSign(text, o = {}) {
    const ck = text + '|' + (o.bg || '') + '|' + (o.fg || '') + '|' + (o.size || ''); if (signCache.has(ck)) return signCache.get(ck);
    const r = makeSign0(text, o); signCache.set(ck, r); return r;
  }
  function makeSign0(text, o = {}) {
    const font = `800 ${Math.round((o.size || 34) * SC)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ax.font = font; const w = Math.min(Math.round(860 * SC), Math.ceil(ax.measureText(text).width) + Math.round(36 * SC));
    const limit = shelfY < 172 * SC ? Math.round(890 * SC) : AT - 2; if (w > limit - 4) return { u0: 0.4, v0: 0.99, u1: 0.6, v1: 0.995, aspect: 4 };
    if (shelfX + w > limit) { shelfX = 2; shelfY += ROWH + 4; }
    if (shelfY + ROWH > AT) return { u0: 0.4, v0: 0.99, u1: 0.6, v1: 0.995, aspect: 4 };
    const x = shelfX, y = shelfY; shelfX += w + 4;
    ax.fillStyle = o.bg || '#2f3a33'; ax.fillRect(x, y, w, ROWH);
    ax.strokeStyle = o.fg || '#fff7df'; ax.lineWidth = 3 * SC; ax.strokeRect(x + 4.5 * SC, y + 4.5 * SC, w - 9 * SC, ROWH - 9 * SC);
    ax.fillStyle = o.fg || '#fff7df'; ax.font = font; ax.textAlign = 'center'; ax.textBaseline = 'middle'; ax.fillText(text, x + w / 2, y + ROWH / 2 + 2 * SC, w - 24 * SC);
    atlasTex.needsUpdate = true;
    return { u0: (x + 1) / AT, v0: 1 - (y + ROWH - 1) / AT, u1: (x + w - 1) / AT, v1: 1 - (y + 1) / AT, aspect: w / ROWH };
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTex });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: atlasTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  /* ---------- chunk geos ---------- */
  const chunks = new Map();
  const chunkAt = (x, z) => { const k = Math.floor((x + EXT) / CH) + NCH * Math.floor((z + EXT) / CH); let c = chunks.get(k); if (!c) chunks.set(k, c = { g: new Geo(), gl: new Geo(), d: new Geo() }); return c; };
  const footprints = [], decks = [], anim = [];
  const hAt = (x, z) => world.heightAt(x, z);
  const R = rng(4242);

  /* ctx: where a builder writes. Baked props go to chunks, spawned props to their own geo. */
  const baked = { pick: (x, z) => chunkAt(x, z), col: [], solid: true, views: [], extra: [], anims: [] };
  /* a prop's own animated mesh (a flame, say): tracked on the ctx so a spawned prop can take it away again */
  const own = (ctx, mesh, fn) => { scene.add(mesh); (ctx.extra ||= []).push(mesh); if (fn) { anim.push(fn); (ctx.anims ||= []).push(fn); } };
  const view = (ctx, v) => { const q = world.addView(v); (ctx.views ||= []).push(q); return q; };
  const P = {};

  /* text board facing local +z, centred at (0, y, z) */
  function board(g, text, y, z, maxW, hgt, o) {
    const s = makeSign(text, o); let w = hgt * s.aspect, h = hgt; if (w > maxW) { h *= maxW / w; w = maxW; }
    g.quad([-w / 2, y - h / 2, z], [w / 2, y - h / 2, z], [w / 2, y + h / 2, z], [-w / 2, y + h / 2, z], 0xffffff, [0, y, z - 1], [[s.u0, s.v0], [s.u1, s.v0], [s.u1, s.v1], [s.u0, s.v1]]);
    return [w, h];
  }
  function glowQuad(gl, a, b, c, d, col, ref) { gl.quad(a, b, c, d, col, ref); }
  function pool(ctx, x, z, r = 5, col = 0xffd9a0) {
    const gl = ctx.pick(x, z).gl, y = world.groundAt(x, z, 50) + 0.09; gl.notf();
    gl.quad([x - r, y, z - r], [x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], col, [x, y - 1, z], [[BLOB[0], BLOB[1]], [BLOB[0], BLOB[3]], [BLOB[2], BLOB[3]], [BLOB[2], BLOB[1]]]);
  }
  const ryOf = f => (f === 's' ? 0 : f === 'e' ? Math.PI / 2 : f === 'n' ? Math.PI : -Math.PI / 2);

  /* ---------- special building fronts (local frame: +z is the front, x spans lw) ---------- */
  const KIND = {};
  const gridWindows = (g, gl, lw, ld, h, y0 = 4.6, litP = 0.36) => {
    const fl = Math.max(1, Math.floor((h - y0 + 1.2) / 3));
    for (const [ax, half, len] of [[0, ld / 2, lw], [1, lw / 2, ld]]) for (const s of [1, -1]) {
      const n = Math.max(2, Math.floor(len / 3.4));
      for (let f = 0; f < fl; f++) for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) / n) * len - len / 2, y = y0 + f * 3, q = o => (ax === 0 ? [[u - 1, y - 0.9, o], [u + 1, y - 0.9, o], [u + 1, y + 0.9, o], [u - 1, y + 0.9, o]] : [[o, y - 0.9, u - 1], [o, y - 0.9, u + 1], [o, y + 0.9, u + 1], [o, y + 0.9, u - 1]]);
        const a = q(s * (half + 0.03)); g.quad(a[0], a[1], a[2], a[3], 0x7fa6c0, [0, y, 0]);
        if (R() < litP) { const b2 = q(s * (half + 0.07)); gl.quad(b2[0], b2[1], b2[2], b2[3], 0xffd98a, [0, y, 0]); }
      }
    }
  };
  KIND.block = (g, gl, b, lw, ld, h, zf) => {
    gridWindows(g, gl, lw, ld, h);
    g.box(0, 1.3, zf + 0.04, 2.4, 2.6, 0.14, C.dark); g.box(0, 1.4, zf + 0.09, 1.9, 2.2, 0.1, 0x7fa6c0);
    for (const s of [-1, 1]) { const ww = lw * 0.5 - 2.6; if (ww > 1.5) { g.box(s * (1.8 + ww / 2), 1.6, zf + 0.05, ww, 2.2, 0.1, 0x7fa6c0); gl.box(s * (1.8 + ww / 2), 1.6, zf + 0.09, ww, 2.2, 0.06, 0xffe6b0); } }
    g.box(0, 3.3, zf + 0.5, lw * 0.9, 0.2, 1.0, b.kind === 'bookshop' ? 0x3f6f4f : C.dark);
    if (b.sign) { const big = b.kind === 'bookshop'; g.box(0, big ? 5.2 : 4.1, zf + 0.12, Math.min(lw * 0.86, big ? 30 : 14), big ? 2.2 : 1.2, 0.2, C.dark); board(g, b.sign, big ? 5.2 : 4.1, zf + 0.24, Math.min(lw * 0.82, big ? 28 : 13), big ? 1.9 : 1.0, { bg: big ? '#243a2c' : '#2b2f2c' }); }
    for (let i = 0; i < 2; i++) g.box((R() - 0.5) * lw * 0.5, h + 0.9, (R() - 0.5) * ld * 0.5, 2 + R() * 2, 1.2, 2 + R() * 2, 0x8a8f96);
    if (b.neon) {
      /* original rooftop neon: a wading heron under the words RAIN OR SHINE (nothing here is modelled on a real sign) */
      const y = h + 1.2, z = zf - 1.2; for (const s of [-1, 1]) g.box(s * lw * 0.36, y + 2.4, z - 0.3, 0.2, 5.6, 0.2, C.metal);
      g.box(0, y + 2.2, z - 0.1, lw * 0.8, 1.9, 0.12, 0x1a2030); board(g, 'RAIN OR SHINE', y + 2.2, z, lw * 0.76, 1.6, { bg: '#1a2030', fg: '#7fe8ff' }); board(gl, 'RAIN OR SHINE', y + 2.2, z + 0.03, lw * 0.76, 1.6, { bg: '#1a2030', fg: '#7fe8ff' });
      const heron = (t, c) => { t.box(0, y + 5.2, z, 2.2, 0.9, 0.12, c); t.box(1.2, y + 6.2, z, 0.22, 1.6, 0.12, c); t.box(1.7, y + 7.0, z, 1.1, 0.22, 0.12, c); t.box(-0.3, y + 4.2, z, 0.14, 1.4, 0.12, c); t.box(0.4, y + 4.2, z, 0.14, 1.4, 0.12, c); t.box(-1.5, y + 5.0, z, 0.9, 0.3, 0.12, c); };
      heron(g, 0x4a6a7a); const m = gl.m.clone(); gl.m.multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.04)); heron(gl, 0xffb0d8); gl.m.copy(m);
    }
  };
  KIND.bookshop = KIND.block;
  KIND.civic = (g, gl, b, lw, ld, h, zf, win) => {
    g.box(0, 1.4, zf + 0.04, 2.6, 2.8, 0.14, C.door);
    for (const x of [-lw * 0.36, -lw * 0.13, lw * 0.13, lw * 0.36]) g.cyl(x, 0, zf + 1.4, 0.36, 0.32, h - 1.6, 8, C.white);
    g.box(0, h - 1.3, zf + 0.9, lw * 0.9, 0.6, 2.4, C.white); g.box(0, 0.15, zf + 1.2, lw * 0.9, 0.3, 2.8, C.stone);
    for (const x of [-lw * 0.3, lw * 0.3]) { win(x, 2.2, 1.8, 2.2); win(x, 5.6, 1.8, 1.6); } win(0, 5.6, 1.8, 1.6);
    g.box(0, h - 0.4, zf + 2.15, lw * 0.7, 1.0, 0.16, 0x3f4f6f); board(g, b.sign, h - 0.4, zf + 2.25, lw * 0.66, 0.86, { bg: '#3f4f6f' });
  };
  KIND.courthouse = (g, gl, b, lw, ld, h, zf, win) => {
    /* basalt block, white trim, hipped roof and the white clock tower on the plaza side */
    g.box(0, h + 0.25, 0, lw + 0.6, 0.5, ld + 0.6, C.white); g.box(0, 5.2, 0, lw + 0.3, 0.35, ld + 0.3, C.white);
    g.gable(0, h + 0.5, 0, lw + 0.4, ld + 0.4, 3.2, 0x4a5058, true, 0x5a6068);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx * (lw / 2 - 0.3), h / 2, sz * (ld / 2 - 0.3), 0.9, h, 0.9, 0x8a8e96);
    for (let i = 0; i < 6; i++) { const x = (i - 2.5) * (lw / 6.6); if (Math.abs(x) < 3) continue; for (const [y, hh] of [[2.6, 2.4], [7.4, 2.0]]) { win(x, y, 1.6, hh); g.box(x, y + hh / 2 + 0.32, zf + 0.06, 2.1, 0.3, 0.14, C.white); win(x, y, 1.6, hh, -zf - 0.14, false); } }
    for (const y of [2.6, 7.4]) for (const s of [-1, 1]) for (const z of [-ld * 0.22, ld * 0.22]) { g.box(s * (lw / 2 + 0.05), y, z, 0.12, 2.2, 1.6, 0x7fa6c0); }
    g.box(0, 1.6, zf + 0.06, 2.6, 3.2, 0.16, C.door); g.box(0, 3.5, zf + 0.9, 6.4, 0.5, 2.2, C.white);
    for (const x of [-2.6, 2.6]) g.cyl(x, 0.6, zf + 1.7, 0.32, 0.28, 2.7, 8, C.white);
    for (let i = 0; i < 3; i++) g.box(0, 0.1 + i * 0.2, zf + 1.2 + (2 - i) * 0.5, 7.4, 0.2, 2.6 + (2 - i), C.stone);
    g.box(0, 4.5, zf + 2.02, 6, 0.9, 0.12, 0x3f4f6f); board(g, b.sign, 4.5, zf + 2.1, 5.8, 0.72, { bg: '#3f4f6f', size: 26 });
    const ty = h + 0.5; g.box(0, ty + 3.6, zf - 3.4, 5.2, 7.2, 5.2, C.white); g.box(0, ty + 7.3, zf - 3.4, 5.9, 0.4, 5.9, 0xdcdcd4);
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, cx = Math.sin(a) * 2.63, cz = zf - 3.4 + Math.cos(a) * 2.63; const m = g.m.clone(); g.m.multiply(new THREE.Matrix4().makeTranslation(cx, ty + 4.9, cz)).multiply(new THREE.Matrix4().makeRotationY(a));
      for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU, a1 = ((i + 1) / 12) * TAU; g.tri([0, 0, 0], [Math.cos(a0) * 1.5, Math.sin(a0) * 1.5, 0], [Math.cos(a1) * 1.5, Math.sin(a1) * 1.5, 0], 0xfff7df, [0, 0, -1]); }
      for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU; g.box(Math.cos(a0) * 1.28, Math.sin(a0) * 1.28, 0.02, 0.1, 0.1, 0.04, C.dark); }
      g.box(0, 0.45, 0.04, 0.14, 1.0, 0.05, C.dark); g.box(0.36, 0, 0.04, 0.8, 0.12, 0.05, C.dark); g.m.copy(m);
      const m2 = gl.m.clone(); gl.m.multiply(new THREE.Matrix4().makeTranslation(cx, ty + 4.9, cz)).multiply(new THREE.Matrix4().makeRotationY(a)); gl.box(0, 0, -0.02, 2.6, 2.6, 0.02, 0x6a5a30); gl.m.copy(m2); }
    for (const s of [-1, 1]) for (const t of [-1, 1]) g.box(s * 1.9, ty + 8.9, zf - 3.4 + t * 1.9, 0.5, 2.8, 0.5, C.white);
    g.box(0, ty + 10.4, zf - 3.4, 4.8, 0.35, 4.8, 0xdcdcd4); g.cyl(0, ty + 10.5, zf - 3.4, 2.6, 0.5, 2.4, 8, 0x8fa6a0); g.cyl(0, ty + 12.9, zf - 3.4, 0.12, 0.04, 1.8, 5, C.yellow);
    gl.box(0, ty + 8.9, zf - 3.4, 2.4, 2.2, 2.4, 0xffe0a0);
  };
  KIND.cinema = (g, gl, b, lw, ld, h, zf) => {
    /* an open, busy single-screen picture house: lit marquee, posters, ticket booth */
    for (const x of [-1.5, 1.5]) { g.box(x, 1.3, zf + 0.05, 2.2, 2.6, 0.14, 0x7a2f2a); g.box(x, 1.6, zf + 0.1, 1.5, 1.4, 0.1, 0xffe6b0); gl.box(x, 1.6, zf + 0.14, 1.5, 1.4, 0.04, 0xffe0a0); }
    g.box(0, 1.2, zf + 1.3, 1.5, 2.4, 1.5, 0x9a3a32); g.box(0, 1.7, zf + 2.07, 1.1, 1.0, 0.06, 0xbfe4ff); gl.box(0, 1.7, zf + 2.1, 1.1, 1.0, 0.04, 0xffe6b0);
    g.box(0, 3.5, zf + 2.0, 13, 1.0, 4.0, 0xa8322c, 0x7a2420);
    for (const [bx, bz, ry] of [[0, zf + 4.02, 0], [-6.52, zf + 2.0, -Math.PI / 2], [6.52, zf + 2.0, Math.PI / 2]]) { const m = g.m.clone(), m2 = gl.m.clone(), T = new THREE.Matrix4().makeTranslation(bx, 3.5, bz).multiply(new THREE.Matrix4().makeRotationY(ry)); g.m.multiply(T); gl.m.multiply(T);
      const txt = ry === 0 ? 'NOW SHOWING  ·  A DOG\'S DAY OUT  ·  ALL PAWS WELCOME' : 'MATINEE TODAY'; board(g, txt, 0, 0.02, ry === 0 ? 12.4 : 3.6, 0.8, { bg: '#fff7df', fg: '#3a2a1a', size: 26 }); board(gl, txt, 0, 0.05, ry === 0 ? 12.4 : 3.6, 0.8, { bg: '#fff7df', fg: '#3a2a1a', size: 26 }); g.m.copy(m); gl.m.copy(m2); }
    for (let i = 0; i < 13; i++) { const x = -6 + i; g.box(x, 2.96, zf + 3.7, 0.16, 0.1, 0.16, 0xfff0c0); gl.box(x, 2.96, zf + 3.7, 0.22, 0.14, 0.22, 0xffd070); }
    for (const x of [-9, -5.2, 5.2, 9]) { g.box(x, 1.8, zf + 0.05, 1.7, 2.4, 0.1, C.dark); g.box(x, 1.8, zf + 0.1, 1.4, 2.1, 0.06, [0xe07a5a, 0x4fae8f, 0xf0c040, 0x7f9fd6][Math.round(x + 9) % 4]); gl.box(x, 3.15, zf + 0.2, 1.5, 0.1, 0.1, 0xffe0a0); }
    g.box(0, h - 1.6, zf + 0.5, 15, 2.2, 0.5, 0x7a2420); board(g, b.sign, h - 1.6, zf + 0.78, 14.4, 1.7, { bg: '#7a2420', fg: '#ffe9a8' }); board(gl, b.sign, h - 1.6, zf + 0.81, 14.4, 1.7, { bg: '#7a2420', fg: '#ffe9a8' });
    g.box(0, h + 1.9, zf + 0.3, 2.2, 3.4, 0.8, 0xa8322c); for (let i = 0; i < 4; i++) { g.box(0, h + 0.8 + i * 0.75, zf + 0.72, 1.2, 0.5, 0.06, 0xffe9a8); gl.box(0, h + 0.8 + i * 0.75, zf + 0.76, 1.2, 0.5, 0.04, 0xffc060); }
    for (const x of [-lw * 0.38, lw * 0.38]) for (const y of [6.2]) { g.box(x, y, zf + 0.04, 1.6, 1.8, 0.1, 0x7fa6c0); }
  };
  KIND.victorian = (g, gl, b, lw, ld, h, zf, win) => {
    g.box(lw * 0.16, 1.15, zf + 0.04, 1.3, 2.3, 0.14, 0x5a3f6a); win(-lw * 0.22, 1.9, 1.5, 1.8); win(-lw * 0.22, 5.4, 1.4, 1.6); win(lw * 0.2, 5.4, 1.4, 1.6); win(0, h + 1.2, 1.0, 1.1);
    g.cyl(-lw / 2 + 0.4, -1, zf - 0.4, 1.9, 1.9, h + 2.6, 8, b.col); g.cyl(-lw / 2 + 0.4, h + 1.6, zf - 0.4, 2.3, 0, 3.6, 8, b.roofCol || 0x4a4a5a); g.cyl(-lw / 2 + 0.4, h + 5.2, zf - 0.4, 0.05, 0.02, 0.8, 4, C.yellow);
    g.box(lw * 0.14, 0.25, zf + 1.3, lw * 0.62, 0.5, 2.6, C.woodL); g.box(lw * 0.14, 3.2, zf + 1.3, lw * 0.66, 0.2, 2.8, b.roofCol || 0x4a4a5a);
    for (const x of [-lw * 0.15, lw * 0.14, lw * 0.43]) { g.box(x, 1.8, zf + 2.5, 0.16, 2.8, 0.16, C.white); }
    g.box(lw * 0.14, 2.95, zf + 2.5, lw * 0.6, 0.18, 0.08, C.white); g.box(0, h, zf + 0.06, lw, 0.2, 0.1, C.white); g.box(0, 3.7, zf + 0.06, lw, 0.16, 0.1, C.white);
    g.box(lw * 0.3, h + 2.8, -ld * 0.2, 0.9, 2.6, 0.9, 0x8a5a4a);
  };
  KIND.mill = (g, gl, b, lw, ld, h, zf, win) => {
    for (let i = 0; i < 4; i++) { const x = -lw / 2 + (i + 0.5) * (lw / 4); g.quad([x - lw / 8, h + 0.4, -ld / 2], [x + lw / 8, h + 0.4, -ld / 2], [x + lw / 8, h + 0.4, ld / 2], [x - lw / 8, h + 0.4, ld / 2], 0x5a5f66, [x, 0, 0]); g.quad([x - lw / 8, h + 0.4, -ld / 2], [x - lw / 8, h + 0.4, ld / 2], [x - lw / 8, h + 2.6, ld / 2], [x - lw / 8, h + 2.6, -ld / 2], 0x9fc4d8, [x, h, 0]); g.quad([x - lw / 8, h + 2.6, -ld / 2], [x - lw / 8, h + 2.6, ld / 2], [x + lw / 8, h + 0.4, ld / 2], [x + lw / 8, h + 0.4, -ld / 2], 0x6a7078, [x, 0, 0]); }
    for (const x of [-lw * 0.3, lw * 0.3]) { g.box(x, 2.2, zf + 0.05, 5, 4.4, 0.14, 0x4a4f58); g.box(x, 4.8, zf + 0.1, 5.4, 0.3, 0.2, C.yellow); g.box(x, 0.5, zf + 1.6, 5.6, 1.0, 3.2, C.stone); }
    board(g, 'BAY 1', 5.6, zf + 0.12, 3, 0.7, { bg: '#2b2f2c', size: 28 }); g.box(0, 7.6, zf + 0.12, 12, 1.5, 0.2, C.dark); board(g, b.sign, 7.6, zf + 0.24, 11.4, 1.2, { bg: '#2b2f2c' });
    for (const x of [-lw * 0.4, -lw * 0.1, lw * 0.1, lw * 0.4]) win(x, 7.4, 1.6, 1.2, -zf - 0.14, false);
    g.cyl(-lw / 2 - 3, -1, -ld * 0.2, 1.7, 1.15, 27, 10, 0xa8604a); g.cyl(-lw / 2 - 3, 23, -ld * 0.2, 1.24, 1.16, 1.6, 10, C.white); g.cyl(-lw / 2 - 3, 20, -ld * 0.2, 1.32, 1.26, 1.2, 10, C.white);
  };
  KIND.mansion = (g, gl, b, lw, ld, h, zf, win) => {
    g.gable(0, h + 0.4, 0, lw + 1.2, ld + 1.2, 3.6, 0xa8503a, true, 0xd8c8a4);
    for (const s of [-1, 1]) { g.cyl(s * (lw / 2 - 0.6), -1, zf - 0.6, 2.8, 2.8, h + 3.4, 10, 0xd8c8a4); g.cyl(s * (lw / 2 - 0.6), h + 2.4, zf - 0.6, 3.2, 0, 4.4, 10, 0xa8503a); for (const y of [2.4, 6.4]) g.box(s * (lw / 2 - 0.6), y, zf + 2.2, 1.2, 1.8, 0.14, 0x7fa6c0); }
    g.box(0, 1.6, zf + 0.06, 2.4, 3.2, 0.16, C.door); g.box(0, 3.55, zf + 0.06, 2.8, 0.6, 0.16, 0x7fa6c0);
    for (const x of [-9, -6, -3, 3, 6, 9]) { win(x, 2.4, 1.5, 2.2); win(x, 6.4, 1.5, 1.8); win(x, 4.4, 1.4, 1.8, -zf - 0.14, false); }
    g.box(0, 0.2, zf + 3, lw + 4, 0.4, 6, 0xc9c0ae); for (let i = -4; i <= 4; i++) g.cyl(i * (lw / 9), 0.4, zf + 5.8, 0.16, 0.16, 0.9, 6, C.white); g.box(0, 1.35, zf + 5.8, lw, 0.14, 0.3, C.white);
    for (const x of [-lw * 0.2, lw * 0.25]) g.box(x, h + 3.6, -1, 1.1, 3.2, 1.1, 0xb8a888);
    g.box(0, 9.6, zf + 0.12, 7, 0.9, 0.14, 0x5a4a3a); board(g, b.sign, 9.6, zf + 0.2, 6.6, 0.74, { bg: '#5a4a3a' });
  };

  P.building = (ctx, b) => {
    const { g, gl } = ctx.pick(b.x, b.z), y0 = hAt(b.x, b.z), ry = ryOf(b.f), side = b.f === 'e' || b.f === 'w';
    const lw = side ? b.d : b.w, ld = side ? b.w : b.d, h = b.h, zf = ld / 2, lit = () => R() < 0.7;
    g.tf(b.x, y0, b.z, 0, ry, 0); gl.tf(b.x, y0, b.z, 0, ry, 0);
    g.box(0, h / 2 - 1, 0, lw, h + 2, ld, b.col);
    g.box(0, 0.25, 0, lw + 0.12, 0.5, ld + 0.12, C.stoneD);
    const roofCol = b.roofCol || 0x5a5f66;
    if (b.kind === 'courthouse' || b.kind === 'mansion') { /* own roof */ }
    else if (b.roof === 'gable') { g.gable(0, h, 0, lw + 1.2, ld + 1.2, b.kind === 'barn' ? 4.2 : 2.8, roofCol, true, b.col); }
    else { g.box(0, h + 0.2, 0, lw + 0.5, 0.4, ld + 0.5, 0x4a4f58); g.box(0, h + 0.65, zf + 0.1, lw + 0.5, 0.6, 0.3, b.col); }
    const win = (x, y, w, hh, z = zf, glowOk = true) => {
      g.box(x, y, z + 0.02, w + 0.24, hh + 0.24, 0.1, C.white); g.box(x, y, z + 0.06, w, hh, 0.1, 0x7fa6c0);
      if (glowOk && lit()) glowQuad(gl, [x - w / 2, y - hh / 2, z + 0.13], [x + w / 2, y - hh / 2, z + 0.13], [x + w / 2, y + hh / 2, z + 0.13], [x - w / 2, y + hh / 2, z + 0.13], 0xffd98a, [x, y, z - 1]);
    };
    if (b.kind === 'shop') {
      g.box(0, 1.15, zf + 0.04, 1.6, 2.3, 0.14, C.door); g.box(0, 1.5, zf + 0.09, 1.0, 1.0, 0.1, 0x7fa6c0);
      const ww = lw * 0.3; win(-lw * 0.3, 1.55, ww, 1.7); win(lw * 0.3, 1.55, ww, 1.7);
      if (b.awn != null) {
        const n = b.stripe ? 8 : 1, aw = lw - 1.2;
        for (let i = 0; i < n; i++) { const x0 = -aw / 2 + (aw * i) / n, x1 = -aw / 2 + (aw * (i + 1)) / n, col = b.stripe && i % 2 ? 0xffffff : b.awn; g.quad([x0, 3.25, zf], [x1, 3.25, zf], [x1, 2.75, zf + 1.7], [x0, 2.75, zf + 1.7], col, [0, 0, zf]); g.quad([x0, 2.75, zf + 1.7], [x1, 2.75, zf + 1.7], [x1, 2.5, zf + 1.7], [x0, 2.5, zf + 1.7], col, [0, 2.6, 0]); }
      }
      if (b.sign) { g.box(0, 4.15, zf + 0.12, lw * 0.86, 1.3, 0.2, C.dark); board(g, b.sign, 4.15, zf + 0.24, lw * 0.82, 1.1, { bg: '#2b2f2c' }); }
      if (h > 6.2) for (const x of [-lw * 0.3, 0, lw * 0.3]) win(x, h - 1.1, 1.5, 1.3);
    } else if (b.kind === 'house' || b.kind === 'cabin' || b.kind === 'shed') {
      g.box(lw * 0.18, 1.05, zf + 0.04, 1.3, 2.1, 0.14, b.kind === 'house' ? [0xa8402f, 0x3f6f9f, 0x4f7f4f, 0x7a4a2a][Math.floor(R() * 4)] : C.door);
      if (b.kind !== 'shed') { win(-lw * 0.22, 1.7, 1.7, 1.4); g.box(lw * 0.18, 0.12, zf + 0.7, 2.2, 0.24, 1.2, C.stone); }
      if (b.kind === 'house') { win(-lw * 0.25, 1.7, 1.5, 1.3, -zf - 0.14, false); g.box(-lw * 0.3, h + 2.2, -ld * 0.15, 0.9, 2.4, 0.9, 0x8a5a4a); }
      if (b.sign) { g.box(0, h - 0.5, zf + 0.5, Math.min(lw * 0.8, 7), 1.0, 0.16, C.woodD); board(g, b.sign, h - 0.5, zf + 0.6, Math.min(lw * 0.76, 6.6), 0.86, { bg: '#3f5f3f' }); }
    } else if (b.kind === 'hall') {
      g.box(0, 1.3, zf + 0.04, 2.4, 2.6, 0.14, C.door);
      for (const x of [-lw * 0.36, -lw * 0.14, lw * 0.14, lw * 0.36]) { g.cyl(x, 0, zf + 1.3, 0.34, 0.3, h - 0.4, 8, C.white); }
      g.box(0, h - 0.2, zf + 0.8, lw, 0.5, 2.2, C.white); g.box(0, 0.15, zf + 1.1, lw, 0.3, 2.6, C.stone);
      for (const x of [-lw * 0.3, lw * 0.3]) { win(x, 2.2, 1.6, 2.2); win(x, 6.0, 1.6, 1.6); }
      g.box(0, h + 4.2, 0, 3.6, 5.2, 3.6, C.white); g.cyl(0, h + 6.8, 0, 3.0, 0, 3.2, 4, 0x4f6f8f);
      { /* clock faces as flat discs on front and back of the tower */
        for (const s of [1, -1]) { const zc = s * 1.83; for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU, a1 = ((i + 1) / 12) * TAU; g.tri([0, h + 4.9, zc], [Math.cos(a0) * 1.15, h + 4.9 + Math.sin(a0) * 1.15, zc], [Math.cos(a1) * 1.15, h + 4.9 + Math.sin(a1) * 1.15, zc], 0xfff7df, [0, h + 4.9, 0]); }
          g.box(0, h + 5.3, zc + s * 0.03, 0.12, 0.9, 0.05, C.dark); g.box(0.3, h + 4.9, zc + s * 0.03, 0.7, 0.12, 0.05, C.dark); }
      }
      g.box(0, 4.7, zf + 1.95, lw * 0.7, 1.0, 0.16, 0x3f4f6f); board(g, b.sign, 4.7, zf + 2.05, lw * 0.66, 0.86, { bg: '#3f4f6f' });
    } else if (b.kind === 'barn') {
      g.box(0, 2.0, zf + 0.04, 5, 4, 0.14, 0x8a2f24); for (const s of [-1, 1]) g.box(s * 2.5, 2, zf + 0.1, 0.25, 4, 0.1, C.white); g.box(0, 4, zf + 0.1, 5.2, 0.25, 0.1, C.white); g.box(0, 0.1, zf + 0.1, 5.2, 0.25, 0.1, C.white);
      g.quad([-2.4, 0.2, zf + 0.12], [-2.1, 0.2, zf + 0.12], [2.4, 3.9, zf + 0.12], [2.1, 3.9, zf + 0.12], C.white, [0, 2, 0]);
      g.quad([2.4, 0.2, zf + 0.12], [2.1, 0.2, zf + 0.12], [-2.4, 3.9, zf + 0.12], [-2.1, 3.9, zf + 0.12], C.white, [0, 2, 0]);
      g.box(0, 6.4, zf + 0.12, lw * 0.6, 1.1, 0.16, C.white); board(g, b.sign, 6.4, zf + 0.22, lw * 0.56, 0.9, { bg: '#f4f4ef', fg: '#8a2f24' });
      win(0, 9.4, 1.4, 1.2);
    }
    else if (KIND[b.kind]) KIND[b.kind](g, gl, b, lw, ld, h, zf, win);
    g.notf(); gl.notf();
    if (ctx.solid) ctx.col.push(world.addBox(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2));
    if (b.kind === 'cinema') { /* keep the camera out of the marquee */ const fx = Math.sin(ry), fz = Math.cos(ry), cx = b.x + fx * (zf + 2), cz = b.z + fz * (zf + 2), hx = Math.abs(fx) * 2 + Math.abs(fz) * 6.6, hz = Math.abs(fz) * 2 + Math.abs(fx) * 6.6; view(ctx, { box: [cx - hx, cz - hz, cx + hx, cz + hz], bottom: y0 + 2.7, top: y0 + 4.3 }); }
    footprints.push([b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2]);
  };

  P.lamp = (ctx, x, z, o = {}) => {
    const { g, gl } = ctx.pick(x, z), y = world.groundAt(x, z, 50), h = o.h || 4.2;
    g.tf(x, y, z); g.cyl(0, 0, 0, 0.16, 0.1, h, 6, o.col || C.metal); g.box(0, h + 0.1, 0, 0.7, 0.14, 0.7, C.dark); g.box(0, h - 0.25, 0, 0.42, 0.5, 0.42, 0xfff0c0);
    gl.tf(x, y, z); gl.box(0, h - 0.25, 0, 0.5, 0.56, 0.5, 0xffe0a0); gl.notf(); g.notf();
    pool(ctx, x, z, o.r || 6);
    if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.22));
  };
  P.bench = (ctx, x, z, ry = 0) => {
    const { g } = ctx.pick(x, z), y = world.groundAt(x, z, 50); g.tf(x, y, z, 0, ry, 0);
    g.box(0, 0.5, 0, 1.9, 0.12, 0.6, C.woodL); g.box(0, 0.9, -0.28, 1.9, 0.5, 0.1, C.woodL); for (const s of [-0.8, 0.8]) g.box(s, 0.25, 0, 0.12, 0.5, 0.55, C.metal); g.notf();
    if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.75, y + 0.56));
  };
  P.hydrant = (ctx, x, z) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 0.2, 0.18, 0.7, 7, C.red); g.ball(0, 0.75, 0, 0.2, 0.16, 0.2, C.red, 6, 4); g.box(0, 0.5, 0, 0.6, 0.14, 0.14, C.red); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.26, y + 0.85)); };
  P.bin = (ctx, x, z, col = C.green) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 0.32, 0.36, 0.9, 8, col, C.dark); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.38, y + 0.9)); };
  P.planter = (ctx, x, z, w = 2, d = 0.8) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.box(0, 0.3, 0, w, 0.6, d, C.woodD); g.box(0, 0.62, 0, w - 0.15, 0.08, d - 0.15, 0x5a3f2a);
    for (let i = 0; i < 5; i++) { const fx = (i / 4 - 0.5) * (w - 0.5); g.ball(fx, 0.85, (R() - 0.5) * 0.2, 0.2, 0.2, 0.2, C.leaf, 5, 3, true); g.ball(fx, 1.05, 0, 0.11, 0.11, 0.11, [C.red, C.yellow, C.pink, C.white, 0x9a6fd0][i % 5], 5, 3, true); }
    g.notf(); if (ctx.solid) ctx.col.push(world.addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y + 0.62));
  };
  P.mailbox = (ctx, x, z, col = C.blue) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.box(0, 0.5, 0, 0.12, 1, 0.12, C.woodD); g.box(0, 1.1, 0, 0.36, 0.3, 0.55, col); g.box(0.2, 1.2, 0.1, 0.04, 0.26, 0.12, C.red); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.2, y + 1.25)); };
  P.postbox = (ctx, x, z) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 0.4, 0.4, 1.3, 8, C.blue); g.ball(0, 1.3, 0, 0.4, 0.22, 0.4, C.blue, 8, 3); g.box(0, 1.0, 0.38, 0.4, 0.08, 0.06, C.dark); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.45)); };
  P.table = (ctx, x, z, o = {}) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, o.ry || 0, 0);
    if (o.picnic) { g.box(0, 0.78, 0, 2.0, 0.1, 0.9, C.woodL); for (const s of [-0.75, 0.75]) { g.box(0, 0.45, s, 2.0, 0.08, 0.3, C.woodL); } for (const s of [-0.8, 0.8]) { g.box(s, 0.4, 0, 0.1, 0.8, 1.7, C.woodD); } }
    else { g.cyl(0, 0, 0, 0.08, 0.08, 0.75, 6, C.metal); g.cyl(0, 0.75, 0, 0.55, 0.55, 0.06, 8, C.white); for (const a of [0.6, 3.7]) { g.cyl(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, 0.2, 0.2, 0.45, 6, C.woodL); }
      if (o.umbrella) { g.cyl(0, 0.8, 0, 0.04, 0.04, 1.6, 5, C.metal); g.cyl(0, 2.1, 0, 1.3, 0, 0.5, 8, o.umbrella); } }
    g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, o.picnic ? 1.0 : 0.6, y + (o.picnic ? 0.84 : 0.8)));
  };
  P.fence = (ctx, x0, z0, x1, z1, o = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.4)), ry = Math.atan2(x1 - x0, z1 - z0), col = o.col || C.white, h = o.h || 1.0;
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n, { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, ry, 0); g.box(0, h / 2, 0, 0.14, h, 0.14, col);
      if (i < n) { const yn = hAt(x0 + ((x1 - x0) * (i + 1)) / n, z0 + ((z1 - z0) * (i + 1)) / n) - y, sl = len / n; for (const k of [0.45, 0.85]) g.quad([-0.04, h * k - 0.07, 0], [-0.04, h * k + 0.07, 0], [-0.04, h * k + 0.07 + yn, sl], [-0.04, h * k - 0.07 + yn, sl], col).quad([0.04, h * k - 0.07, 0], [0.04, h * k + 0.07, 0], [0.04, h * k + 0.07 + yn, sl], [0.04, h * k - 0.07 + yn, sl], col); }
      g.notf(); }
    if (ctx.solid) { const y = Math.max(hAt(x0, z0), hAt(x1, z1)); const m = Math.max(1, Math.round(len / 1.2)); for (let i = 0; i <= m; i++) ctx.col.push(world.addCircle(x0 + ((x1 - x0) * i) / m, z0 + ((z1 - z0) * i) / m, 0.32, y + h)); }
  };
  P.hedge = (ctx, x0, z0, x1, z1) => {
    const { g } = ctx.pick((x0 + x1) / 2, (z0 + z1) / 2), y = hAt((x0 + x1) / 2, (z0 + z1) / 2), w = Math.abs(x1 - x0) + 1.1, d = Math.abs(z1 - z0) + 1.1;
    g.notf(); g.box((x0 + x1) / 2, y + 0.5, (z0 + z1) / 2, w, 1.0, d, 0x3f7f3f, 0x4f9a4f);
    if (ctx.solid) ctx.col.push(world.addBox(Math.min(x0, x1) - 0.55, Math.min(z0, z1) - 0.55, Math.max(x0, x1) + 0.55, Math.max(z0, z1) + 0.55, y + 1.0));
  };
  P.signpost = (ctx, x, z, text, o = {}) => {
    const { g } = ctx.pick(x, z), y = world.groundAt(x, z, 50); g.tf(x, y, z, 0, o.ry || 0, 0);
    g.box(0, 0.9, 0, 0.16, 1.8, 0.16, C.woodD); g.box(0, 1.7, 0.06, 2.3, 0.75, 0.1, C.woodL);
    board(g, text, 1.7, 0.12, 2.2, 0.62, { bg: o.bg || '#7a5a36', size: 30 }); g.tf(x, y, z, 0, (o.ry || 0) + Math.PI, 0); board(g, text, 1.7, 0.0, 2.2, 0.62, { bg: o.bg || '#7a5a36', size: 30 }); g.notf();
    if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.25));
  };
  P.roadsign = (ctx, x, z, a, b) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 0.07, 0.07, 3.2, 5, C.metal);
    board(g, a, 3.0, 0.03, 2.2, 0.42, { bg: '#2f6f4f', size: 30 }); g.tf(x, y, z, 0, Math.PI, 0); board(g, a, 3.0, 0.03, 2.2, 0.42, { bg: '#2f6f4f', size: 30 });
    if (b) { g.tf(x, y, z, 0, Math.PI / 2, 0); board(g, b, 2.5, 0.03, 2.2, 0.42, { bg: '#2f6f4f', size: 30 }); g.tf(x, y, z, 0, -Math.PI / 2, 0); board(g, b, 2.5, 0.03, 2.2, 0.42, { bg: '#2f6f4f', size: 30 }); }
    g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.15));
  };
  P.stall = (ctx, s) => {
    const { g, gl } = ctx.pick(s.x, s.z), y = hAt(s.x, s.z), sr = s.ry || 0; g.tf(s.x, y, s.z, 0, sr, 0);
    g.box(0, 0.5, 0, 4, 1.0, 1.6, C.woodL, C.woodD); for (const [px, pz] of [[-1.9, -0.7], [1.9, -0.7], [-1.9, 0.7], [1.9, 0.7]]) g.box(px, 1.5, pz, 0.12, 3, 0.12, C.woodD);
    for (let i = 0; i < 6; i++) { const x0 = -2.2 + i * (4.4 / 6), x1 = x0 + 4.4 / 6, col = i % 2 ? 0xffffff : s.col; g.quad([x0, 3.0, -1], [x1, 3.0, -1], [x1, 3.4, 0], [x0, 3.4, 0], col, [0, 0, 0]); g.quad([x0, 3.0, 1.2], [x1, 3.0, 1.2], [x1, 3.4, 0], [x0, 3.4, 0], col, [0, 0, 0]); }
    board(g, s.name, 2.6, 0.9, 3.6, 0.6, { bg: '#fff7df', fg: '#3a2a1a' });
    for (let i = 0; i < 5; i++) g.box(-1.5 + i * 0.75, 1.1, 0.2, 0.5, 0.2, 0.5, [s.col, C.yellow, C.woodL, C.white, C.orange][i]);
    gl.tf(s.x, y, s.z, 0, sr, 0); gl.box(0, 2.9, 0, 0.3, 0.2, 0.3, 0xffe0a0); gl.notf(); g.notf(); pool(ctx, s.x + Math.sin(sr) * 1.5, s.z + Math.cos(sr) * 1.5, 4);
    if (ctx.solid) { if (Math.abs(Math.sin(sr)) < 0.1) ctx.col.push(world.addBox(s.x - 2, s.z - 0.8, s.x + 2, s.z + 0.8, y + 1.0)); else for (const t of [-1.3, 0, 1.3]) ctx.col.push(world.addCircle(s.x + Math.cos(sr) * t, s.z - Math.sin(sr) * t, 0.9, y + 1.0)); }
    view(ctx, { x: s.x, z: s.z, r: 2.5, bottom: y - 0.5, top: y + 3.7 });   /* the camera stays outside the awning */
  };
  P.tent = (ctx, x, z, col, ry = 0) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, ry, 0); g.gable(0, 0, 0, 3.2, 2.8, 1.9, col, false, 0x3a3a3a); g.box(0, 0.03, 0, 3.2, 0.06, 2.8, 0x4a4a4a); g.notf();
    if (ctx.solid) ctx.col.push(world.addCircle(x, z, 1.45));
  };
  P.log = (ctx, x, z, ry = 0, len = 3) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y + 0.35, z, Math.PI / 2, ry, 0); g.cyl(0, -len / 2, 0, 0.36, 0.34, len, 7, 0x7a5a3a, 0xc9a67a); g.notf();
    if (ctx.solid) { const dx = Math.sin(ry), dz = Math.cos(ry); for (let t = -len / 2 + 0.3; t <= len / 2 - 0.2; t += 0.6) ctx.col.push(world.addCircle(x + dx * t, z + dz * t, 0.36, y + 0.7)); }
  };
  P.campfire = (ctx, x, z) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.ball(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8, 0.24, 0.18, 0.24, C.stone, 5, 3, true); }
    for (let i = 0; i < 3; i++) { g.tf(x, y + 0.18, z, Math.PI / 2, (i / 3) * Math.PI, 0); g.cyl(0, -0.55, 0, 0.1, 0.1, 1.1, 5, 0x4a3020); } g.notf();
    const fg = new Geo(); fg.cyl(0, 0, 0, 0.36, 0, 1.0, 6, 0xffa030); fg.cyl(0.12, 0, 0.1, 0.2, 0, 0.7, 5, 0xffe070); fg.cyl(-0.14, 0, -0.08, 0.18, 0, 0.6, 5, 0xff6a20);
    const flame = new THREE.Mesh(fg.build(), new THREE.MeshBasicMaterial({ vertexColors: true })); flame.position.set(x, y + 0.2, z);
    own(ctx, flame, (dt, night, t) => { flame.scale.set(1 + Math.sin(t * 11) * 0.12, 0.9 + Math.sin(t * 17 + 1) * 0.2 + night * 0.25, 1 + Math.cos(t * 13) * 0.12); flame.rotation.y = t * 2; });
    pool(ctx, x, z, 8, 0xffa860);
    if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.95, y + 0.3));
  };
  P.deck = (ctx, x0, z0, x1, z1, top, o = {}) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, { g } = ctx.pick(cx, cz), col = o.col || C.woodL; g.notf();
    g.box(cx, top - 0.12, cz, x1 - x0, 0.24, z1 - z0, col, o.topCol || col);
    const alongX = x1 - x0 > z1 - z0, n = Math.ceil((alongX ? x1 - x0 : z1 - z0) / 4);
    for (let i = 0; i <= n; i++) for (const s of [0, 1]) { const px = alongX ? x0 + ((x1 - x0) * i) / n : (s ? x1 - 0.15 : x0 + 0.15), pz = alongX ? (s ? z1 - 0.15 : z0 + 0.15) : z0 + ((z1 - z0) * i) / n, gy = Math.min(hAt(px, pz), WATER_Y) - 2.5; if (top - gy > 0.5) g.cyl(px, gy, pz, 0.18, 0.18, top - gy + (o.rail ? 0 : 0.3), 6, C.woodD); }
    if (ctx.solid) ctx.col.push(world.addBox(x0, z0, x1, z1, top, top - 0.5));
    decks.push([x0, z0, x1, z1]);
  };
  P.rail = (ctx, x0, z0, x1, z1, base, h = 1.05, col = C.woodD) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.2)), ry = Math.atan2(x1 - x0, z1 - z0), { g } = ctx.pick((x0 + x1) / 2, (z0 + z1) / 2);
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; g.notf(); g.box(x, base + h / 2, z, 0.16, h, 0.16, col); }
    g.tf(x0, base, z0, 0, ry, 0); g.box(0, h, len / 2, 0.12, 0.12, len, col); g.box(0, h * 0.5, len / 2, 0.08, 0.08, len, col); g.notf();
    if (ctx.solid) ctx.col.push(world.addBox(Math.min(x0, x1) - 0.14, Math.min(z0, z1) - 0.14, Math.max(x0, x1) + 0.14, Math.max(z0, z1) + 0.14, base + h, base - 0.4));
  };
  P.umbrella = (ctx, x, z, col) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0.12, R() * 6, 0); g.cyl(0, 0, 0, 0.05, 0.05, 2.2, 5, C.white); for (let i = 0; i < 8; i++) { const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU; g.tri([0, 2.5, 0], [Math.cos(a0) * 1.6, 2.0, Math.sin(a0) * 1.6], [Math.cos(a1) * 1.6, 2.0, Math.sin(a1) * 1.6], i % 2 ? 0xffffff : col, [0, 0, 0]); } g.tf(x + 1.2, y + 0.04, z + 0.4, 0, R() * 3, 0); g.box(0, 0, 0, 0.9, 0.05, 1.8, [C.red, C.blue, C.yellow, C.pink][Math.floor(R() * 4)]); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.15)); };
  P.haybale = (ctx, x, z, ry = 0, stack = 1) => { const { g } = ctx.pick(x, z), y = hAt(x, z); for (let i = 0; i < stack; i++) { g.tf(x, y + i * 0.9, z, 0, ry + i * 0.3, 0); g.box(0, 0.45, 0, 1.8, 0.9, 1.0, C.hay, 0xecd070); } g.notf(); if (ctx.solid) ctx.col.push(world.addBox(x - 0.8, z - 0.8, x + 0.8, z + 0.8, y + stack * 0.9)); };
  P.boulder = (ctx, x, z, s = 1.4) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, R() * 6, 0, s); g.ball(0, 0.4, 0, 1, 0.75, 0.85, C.stone, 6, 4, true); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.85 * s, y + 1.05 * s)); };
  P.flag = (ctx, x, z, col = C.blue, h = 7) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 0.08, 0.06, h, 5, C.white); g.box(0.75, h - 0.5, 0, 1.4, 0.9, 0.04, col); g.box(0.75, h - 0.5, 0, 0.5, 0.5, 0.06, 0xfff0c0); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.15)); };
  P.crate = (ctx, x, z, s = 0.9, col = C.woodL) => { const { g } = ctx.pick(x, z), y = world.groundAt(x, z, 50); g.tf(x, y, z, 0, R(), 0); g.box(0, s / 2, 0, s, s, s, col, C.woodD); g.notf(); if (ctx.solid) ctx.col.push(world.addBox(x - s / 2, z - s / 2, x + s / 2, z + s / 2, y + s)); };
  P.marker = (ctx, x, z, col = C.yellow) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.box(0, 0.45, 0, 0.14, 0.9, 0.14, C.woodD); g.box(0, 0.95, 0, 0.2, 0.2, 0.2, col); g.notf(); };
  /* ---------- more builders ---------- */
  P.cart = (ctx, x, z, name, col, ry = 0) => {
    const { g, gl } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, ry, 0); gl.tf(x, y, z, 0, ry, 0);
    g.box(0, 1.55, 0, 4.4, 2.3, 2.3, col); g.box(0, 2.78, 0, 4.6, 0.16, 2.5, C.white); g.box(0, 0.3, 0, 3.6, 0.2, 1.6, C.dark);
    for (const s of [-1.5, 1.5]) for (const t of [-1.05, 1.05]) { g.tf(x, y, z, 0, ry, 0); const m = g.m.clone(); g.m.multiply(new THREE.Matrix4().makeTranslation(s, 0.42, t)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)); g.cyl(0, -0.12, 0, 0.42, 0.42, 0.24, 8, C.dark, 0x9a9aa0); g.m.copy(m); }
    g.box(0, 1.75, 1.17, 2.6, 1.0, 0.06, 0x2c3a48); gl.box(0, 1.75, 1.2, 2.6, 1.0, 0.04, 0xffe0a0); g.box(0, 1.2, 1.4, 2.8, 0.1, 0.5, C.woodL);
    for (let i = 0; i < 6; i++) { const x0 = -1.7 + i * (3.4 / 6), x1 = x0 + 3.4 / 6, c2 = i % 2 ? 0xffffff : col; g.quad([x0, 2.7, 1.15], [x1, 2.7, 1.15], [x1, 2.3, 2.3], [x0, 2.3, 2.3], c2, [0, 0, 0]); }
    g.box(0, 3.3, 0.6, 3.4, 0.8, 0.12, C.dark); board(g, name, 3.3, 0.68, 3.2, 0.66, { bg: '#fff7df', fg: '#3a2a1a', size: 30 });
    g.notf(); gl.notf(); pool(ctx, x + Math.sin(ry) * 2.6, z + Math.cos(ry) * 2.6, 4.5);
    if (ctx.solid) ctx.col.push(world.addCircle(x + Math.cos(ry) * 1.1, z - Math.sin(ry) * 1.1, 1.35), world.addCircle(x - Math.cos(ry) * 1.1, z + Math.sin(ry) * 1.1, 1.35));
  };
  P.railcar = (ctx, x, z, ry, loco, col) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, ry, 0);
    g.box(0, 0.75, 0, 2.4, 0.5, 12, C.dark);
    if (loco) { g.box(0, 2.3, -1.5, 2.6, 2.6, 8, col); g.box(0, 3.0, 4, 2.7, 3.4, 3, col); g.box(0, 3.5, 5.52, 2.2, 1.0, 0.06, 0x2c3a48); g.box(0, 2.3, -1.5, 2.66, 0.5, 8.04, 0xf4ead8); g.cyl(0, 3.6, -3.5, 0.4, 0.5, 0.8, 8, C.dark); }
    else { g.box(0, 2.6, 0, 2.6, 3.2, 11.4, col); g.box(0, 2.6, 0, 2.66, 0.5, 11.44, 0xf4ead8); for (const s of [-1, 1]) g.box(s * 1.32, 2.4, 0, 0.06, 2.4, 2.6, 0x5a5f66); }
    for (const t of [-4, 4]) for (const s of [-1, 1]) { const m = g.m.clone(); g.m.multiply(new THREE.Matrix4().makeTranslation(s * 1.0, 0.5, t)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)); g.cyl(0, -0.1, 0, 0.5, 0.5, 0.2, 8, 0x3a3a3e); g.m.copy(m); }
    g.notf(); if (ctx.solid) for (const t of [-4.6, -2.3, 0, 2.3, 4.6]) ctx.col.push(world.addCircle(x + Math.sin(ry) * t, z + Math.cos(ry) * t, 1.5));
  };
  P.boat = (ctx, x, z, ry, col) => {
    const { g } = ctx.pick(x, z); g.tf(x, 0, z, 0, ry, 0);
    const sec = [[-3.2, 0.9], [-1.5, 1.25], [1.2, 1.2], [3.4, 0.08]];
    for (let i = 0; i < sec.length - 1; i++) { const [z0, w0] = sec[i], [z1, w1] = sec[i + 1]; for (const s of [-1, 1]) g.quad([s * w0, 0.9, z0], [s * w1, 0.9, z1], [s * w1 * 0.6, -0.3, z1], [s * w0 * 0.6, -0.3, z0], C.white, [0, 0.4, 0]); g.quad([-w0, 0.86, z0], [w0, 0.86, z0], [w1, 0.86, z1], [-w1, 0.86, z1], C.woodL, [0, -9, 0]); }
    g.quad([-0.9, 0.9, -3.2], [0.9, 0.9, -3.2], [0.54, -0.3, -3.2], [-0.54, -0.3, -3.2], C.white, [0, 0, 0]);
    g.box(0, 1.5, -0.4, 1.7, 1.2, 2.4, col); g.box(0, 1.6, 0.82, 1.5, 0.7, 0.05, 0x2c3a48); g.box(0, 2.15, -0.4, 1.9, 0.1, 2.7, C.white); g.box(0, 0.75, 0, 2.52, 0.14, 6.2, col);
    g.notf(); if (ctx.solid) for (const t of [-1.8, 0, 1.8]) ctx.col.push(world.addCircle(x + Math.sin(ry) * t, z + Math.cos(ry) * t, 1.3, 2.2));
  };
  P.noticeboard = (ctx, x, z, ry, title) => {
    const { g } = ctx.pick(x, z), y = world.groundAt(x, z, 50); g.tf(x, y, z, 0, ry, 0);
    for (const s of [-1.2, 1.2]) g.box(s, 1.2, 0, 0.16, 2.4, 0.16, C.woodD); g.box(0, 1.55, 0, 2.4, 1.5, 0.12, 0xc9a67a); g.gable(0, 2.35, 0, 2.9, 0.6, 0.45, 0x5a3a2a, true);
    for (let i = 0; i < 6; i++) g.box(-0.8 + (i % 3) * 0.8, 1.25 + Math.floor(i / 3) * 0.55, 0.07, 0.6, 0.42, 0.02, [0xfff7df, 0xffe08a, 0xbfe4ff, 0xffc0c0, 0xd8f0c0, 0xfff7df][i]);
    board(g, title, 2.12, 0.08, 2.2, 0.36, { bg: '#5a3a2a', size: 28 }); g.notf();
    if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.5));
  };
  P.fountain = (ctx, x, z, r = 4.2) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z);
    g.cyl(0, 0, 0, r, r, 0.7, 14, C.stone, C.stoneD); g.cyl(0, 0.62, 0, r - 0.5, r - 0.5, 0.1, 14, 0x5fb0e0); g.cyl(0, 0, 0, 0.5, 0.4, 2.2, 8, C.stone); g.cyl(0, 2.2, 0, 1.5, 0.5, 0.35, 10, C.stone); g.cyl(0, 2.5, 0, 1.3, 1.3, 0.06, 10, 0x7fc4f0); g.cyl(0, 2.5, 0, 0.2, 0.15, 1.0, 6, C.stone); g.ball(0, 3.7, 0, 0.32, 0.32, 0.32, 0xbfe4ff, 6, 4, true);
    g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, r + 0.05, y + 0.7), world.addCircle(x, z, 0.6));
  };
  P.stage = (ctx, x, z, ry, col = 0x4f7f6f) => {
    const { g, gl } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, ry, 0); gl.tf(x, y, z, 0, ry, 0);
    g.box(0, 0.4, 0, 9, 0.8, 6, C.woodL, C.wood); g.box(0, 2.6, -2.9, 9, 3.6, 0.2, col); for (const s of [-4.3, 4.3]) for (const t of [-2.8, 2.8]) g.box(s, 2.6, t, 0.24, 3.6, 0.24, C.white);
    g.quad([-4.8, 4.4, -3.2], [4.8, 4.4, -3.2], [4.8, 5.4, 3.4], [-4.8, 5.4, 3.4], col, [0, 0, 0]); g.quad([-4.8, 4.5, -3.2], [4.8, 4.5, -3.2], [4.8, 5.5, 3.4], [-4.8, 5.5, 3.4], 0x3f5f55, [0, 20, 0]);
    for (let i = -3; i <= 3; i++) { g.box(i * 1.2, 5.1, 3.1, 0.14, 0.14, 0.14, 0xfff0c0); gl.box(i * 1.2, 5.1, 3.1, 0.2, 0.2, 0.2, 0xffd070); }
    g.box(0, 0.2, 3.6, 3, 0.4, 1.2, C.wood); g.notf(); gl.notf(); pool(ctx, x + Math.sin(ry) * 3, z + Math.cos(ry) * 3, 7);
    if (ctx.solid) { const c = Math.abs(Math.cos(ry)) > 0.5; ctx.col.push(world.addBox(x - (c ? 4.5 : 3), z - (c ? 3 : 4.5), x + (c ? 4.5 : 3), z + (c ? 3 : 4.5), y + 0.8)); ctx.col.push(world.addBox(x + Math.sin(ry) * 3.6 - 1.5, z + Math.cos(ry) * 3.6 - 1.5, x + Math.sin(ry) * 3.6 + 1.5, z + Math.cos(ry) * 3.6 + 1.5, y + 0.4)); }
    { const c = Math.abs(Math.cos(ry)) > 0.5; view(ctx, { box: [x - (c ? 4.9 : 3.5), z - (c ? 3.5 : 4.9), x + (c ? 4.9 : 3.5), z + (c ? 3.5 : 4.9)], bottom: y + 4.1, top: y + 5.8 }); }
  };
  /* dog agility set, laid out along +x from (x, z) */
  P.agility = (ctx, x, z) => {
    const { g } = ctx.pick(x, z), y = hAt(x, z); g.notf();
    for (const hx of [x, x + 5]) { for (const s of [-0.9, 0.9]) g.box(hx, y + 0.45, z + s, 0.1, 0.9, 0.1, C.white); g.box(hx, y + 0.5, z, 0.08, 0.08, 1.8, C.red); if (ctx.solid) ctx.col.push(world.addBox(hx - 0.1, z - 0.9, hx + 0.1, z + 0.9, y + 0.55)); }
    g.tf(x + 10, y, z); for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU, a1 = ((i + 1) / 12) * TAU, r0 = 0.95, r1 = 1.15; g.quad([0, 1.5 + Math.sin(a0) * r0, Math.cos(a0) * r0], [0, 1.5 + Math.sin(a1) * r0, Math.cos(a1) * r0], [0, 1.5 + Math.sin(a1) * r1, Math.cos(a1) * r1], [0, 1.5 + Math.sin(a0) * r1, Math.cos(a0) * r1], C.orange, [-3, 1.5, 0]); g.quad([0.02, 1.5 + Math.sin(a0) * r0, Math.cos(a0) * r0], [0.02, 1.5 + Math.sin(a1) * r0, Math.cos(a1) * r0], [0.02, 1.5 + Math.sin(a1) * r1, Math.cos(a1) * r1], [0.02, 1.5 + Math.sin(a0) * r1, Math.cos(a0) * r1], C.orange, [3, 1.5, 0]); }
    g.box(0, 0.2, 0, 0.14, 0.5, 0.14, C.metal); g.notf();
    g.tf(x + 3, y, z + 7); g.quad([-2, 0, -0.7], [-2, 0, 0.7], [0, 1.0, 0.7], [0, 1.0, -0.7], C.blue, [-1, -1, 0]); g.quad([2, 0, -0.7], [2, 0, 0.7], [0, 1.0, 0.7], [0, 1.0, -0.7], C.yellow, [1, -1, 0]); g.tri([-2, 0, 0.7], [2, 0, 0.7], [0, 1, 0.7], C.woodD, [0, 0, 0]); g.tri([-2, 0, -0.7], [2, 0, -0.7], [0, 1, -0.7], C.woodD, [0, 0, 0]); g.notf();
    if (ctx.solid) for (let i = -3; i <= 3; i++) ctx.col.push(world.addBox(x + 3 + i * 0.5 - 0.25, z + 6.3, x + 3 + i * 0.5 + 0.25, z + 7.7, y + 1.0 - Math.abs(i) * 0.25));
    g.tf(x + 11, y + 0.7, z + 7, Math.PI / 2, Math.PI / 2, 0); g.cyl(0, -1.6, 0, 0.75, 0.75, 3.2, 8, 0x3f9fd6); g.notf(); if (ctx.solid) ctx.col.push(world.addBox(x + 9.4, z + 6.3, x + 12.6, z + 7.7, y + 1.45));
  };
  /* hanging strings: flags (bunting) or paper lanterns between two points */
  const hang = (t, a, b, n, sag, kind, cols) => {
    const P3 = i => { const f = i / n; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * sag, a[2] + (b[2] - a[2]) * f]; }, dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    t.g.notf(); t.gl.notf();
    for (let i = 0; i < n; i++) { const p = P3(i), q = P3(i + 1), m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], c = cols[i % cols.length];
      t.g.quad([p[0], p[1], p[2]], [q[0], q[1], q[2]], [q[0], q[1] + 0.05, q[2]], [p[0], p[1] + 0.05, p[2]], 0x3a3a3a, [m[0] + nx, m[1], m[2] + nz]); t.g.quad([p[0], p[1], p[2]], [q[0], q[1], q[2]], [q[0], q[1] + 0.05, q[2]], [p[0], p[1] + 0.05, p[2]], 0x3a3a3a, [m[0] - nx, m[1], m[2] - nz]);
      if (kind === 'flag') { const w = Math.min(0.45, Math.hypot(q[0] - p[0], q[2] - p[2]) * 0.42), ux = (dx / l) * w, uz = (dz / l) * w, A = [m[0] - ux, m[1], m[2] - uz], B = [m[0] + ux, m[1], m[2] + uz], D = [m[0], m[1] - 0.8, m[2]]; t.g.tri(A, B, D, c, [m[0] + nx * 3, m[1], m[2] + nz * 3]); t.g.tri(A, B, D, c, [m[0] - nx * 3, m[1], m[2] - nz * 3]); }
      else { t.g.cyl(m[0], m[1] - 0.62, m[2], 0.2, 0.2, 0.5, 6, c, 0x3a2a1a); t.g.cyl(m[0], m[1] - 0.12, m[2], 0.012, 0.012, 0.14, 3, 0x3a3a3a); t.gl.box(m[0], m[1] - 0.37, m[2], 0.5, 0.58, 0.5, c); }
    }
  };
  const FLAGC = [0xf08a2a, 0xfff0d0, 0x4f9a94, 0x8a4fae, 0xf0c040, 0xd9534f], LANC = [0xffc870, 0xff9a5a, 0xfff0c0, 0xffb090, 0xf0d060];
  /* festival pumpkins are painted, not carved: plain orange, cream or teal with a little painted paw, star or stripes */
  P.pumpkin = (ctx, x, z, s = 1, deco = false, tgt = null, ci = -1) => {
    const t = tgt || ctx.pick(x, z), y = world.groundAt(x, z, 50), k = ci >= 0 ? ci : Math.floor(R() * 5), col = [C.orange, C.orange, 0xf4ead0, 0x6fa8a0, 0xe0a030][k], ry = R() * 6;
    t.g.tf(x, y, z, 0, ry, 0, s); t.g.ball(0, 0.26, 0, 0.36, 0.28, 0.36, col, 7, 4, true); t.g.cyl(0, 0.5, 0, 0.05, 0.03, 0.14, 4, 0x4f7f3f);
    if (deco) { const pc = k === 2 ? 0x3f7fd6 : 0xfff7df, m = Math.floor(R() * 3);
      if (m === 0) { t.g.box(0, 0.24, 0.355, 0.13, 0.11, 0.03, pc); for (const [px, py] of [[-0.13, 0.36], [-0.045, 0.41], [0.045, 0.41], [0.13, 0.36]]) t.g.box(px, py, 0.33, 0.055, 0.06, 0.03, pc); }
      else if (m === 1) { t.g.box(0, 0.28, 0.355, 0.2, 0.05, 0.03, pc); t.g.box(0, 0.28, 0.355, 0.05, 0.2, 0.03, pc); }
      else for (const py of [0.16, 0.28, 0.4]) t.g.box(0, py, 0.34 - Math.abs(py - 0.28) * 0.35, 0.34, 0.035, 0.03, pc); }
    t.g.notf();
  };
  const tree = (kind, x, z, s = 1, fruit) => (world.plantRequests ||= []).push({ kind, x, z, s, fruit });
  const local = (x, z, ry = 0, yy = null) => { const t = baked.pick(x, z), y = yy ?? hAt(x, z); t.g.tf(x, y, z, 0, ry, 0); t.gl.tf(x, y, z, 0, ry, 0); return { g: t.g, gl: t.gl, y }; };
  const along = (id, step, fn, from = 2) => { const p = world.roadById(id).path; for (let i = from; i < p.length - 1; i += step) { const a = p[i], b = p[i + 1], nx = -(b[1] - a[1]), nz = b[0] - a[0], l = Math.hypot(nx, nz) || 1; fn(a[0], a[1], nx / l, nz / l, i); } };
  const fest = { g: new Geo(), gl: new Geo() }, festCtx = { pick: () => fest, col: [], solid: false };

  /* a bridge deck with kerbs, rails and colliders; axis 'x' or 'z' */
  function deck(axis, a0, a1, c, w, top, col = 0x5d6068, o = {}) {
    const mid = (a0 + a1) / 2, len = a1 - a0, t = baked.pick(axis === 'x' ? mid : c, axis === 'x' ? c : mid).g; t.notf();
    const bx = (u, v, y, su, sv, sy, cc, tc) => (axis === 'x' ? t.box(u, y, v, su, sy, sv, cc, tc) : t.box(v, y, u, sv, sy, su, cc, tc));
    bx(mid, c, top - 0.35, len, w, 0.7, 0x7a7f86, col); for (const s of [-1, 1]) { bx(mid, c + s * (w / 2 - 0.7), top + 0.06, len, 1.4, 0.12, 0xcfc8ba); bx(mid, c + s * (w / 2 - 0.08), top + 0.55, len, 0.16, 1.1, o.rail || 0x5f8f7a); }
    if (!o.noDash) for (let u = a0 + 2; u < a1; u += 4.8) bx(u, c, top + 0.012, 2.2, 0.26, 0.02, 0xf0d98a);
    const add = (u0, v0, u1, v1, tp, bt) => baked.col.push(axis === 'x' ? world.addBox(u0, v0, u1, v1, tp, bt) : world.addBox(v0, u0, v1, u1, tp, bt));
    add(a0, c - w / 2, a1, c + w / 2, top, top - 0.8); for (const s of [-1, 1]) add(a0, c + s * (w / 2 - 0.08) - 0.1, a1, c + s * (w / 2 - 0.08) + 0.1, top + 1.1, top - 0.6);
    decks.push(axis === 'x' ? [a0, c - w / 2, a1, c + w / 2] : [c - w / 2, a0, c + w / 2, a1]);
  }

  /* ================= place everything ================= */
  const ctx = baked;
  for (const b of BUILDINGS) P.building(ctx, b);
  for (const s of STALLS) P.stall(ctx, s);
  for (const c of CARTS) P.cart(ctx, c[0], c[1], c[2], c[3], c[4]);

  /* ---------- St. Helens old town ---------- */
  for (let z = -332; z <= -196; z += 17) { if (Math.abs(z + 250) > 8) P.lamp(ctx, -211.4, z); P.lamp(ctx, -198.6, z + 8.5); }
  for (let z = -330; z <= -200; z += 26) P.lamp(ctx, -145.4, z);
  for (const [x, z, ry] of [[-212.6, -296, Math.PI / 2], [-212.6, -224, Math.PI / 2], [-197.4, -296, -Math.PI / 2], [-146.6, -314, Math.PI / 2], [-190, -229.5, 0], [-190, -270.5, Math.PI], [-152, -270.5, Math.PI], [-152, -229.5, 0]]) P.bench(ctx, x, z, ry);
  for (const [x, z] of [[-212.4, -277], [-212.4, -241], [-197.6, -313], [-197.6, -205]]) P.planter(ctx, x, z, 0.8, 2);
  P.hydrant(ctx, -199, -332); P.hydrant(ctx, -211, -196); P.hydrant(ctx, -345, -256); P.bin(ctx, -198, -276); P.bin(ctx, -212, -260, 0x3f6f9f); P.bin(ctx, -148, -228); P.postbox(ctx, -198, -222.6);
  P.table(ctx, -197.2, -326, { umbrella: C.green }); P.table(ctx, -197.2, -318, { umbrella: 0xfff0c0 }); P.table(ctx, -150, -216, { umbrella: C.red }); P.table(ctx, -212.8, -288, { umbrella: C.yellow });
  P.roadsign(ctx, -198.6, -256.4, 'S 1st St', 'Columbia Blvd'); P.roadsign(ctx, -198.6, -333.6, 'S 1st St', 'St. Helens St'); P.roadsign(ctx, -134.4, -333.6, 'The Strand', 'St. Helens St'); P.roadsign(ctx, -198.6, -191, 'S 1st St', 'Cowlitz St'); P.roadsign(ctx, -343.6, -256.4, 'Milton Way', 'Columbia Blvd');
  P.noticeboard(ctx, -180, -280.6, 0, 'TOWN JOBS'); P.flag(ctx, -150, -281, C.blue, 8);
  for (const z of [-300, -272, -236]) tree('leafy', -198.2, z, 0.72); for (const z of [-250, -205]) tree('leafy', -212, z, 0.72);
  /* the Lantern Stack: basalt base, spiral shelves, brass running-dog weathervane (original design) */
  { const { g, y } = local(PLAZA.x, PLAZA.z);
    g.cyl(0, 0, 0, 3.3, 3.5, 0.7, 8, C.stoneD, 0x5a5e66); g.cyl(0, 0.7, 0, 2.7, 2.9, 0.6, 8, 0x6a6e76, 0x5a5e66); g.cyl(0, 1.3, 0, 0.32, 0.22, 9.6, 6, C.woodD);
    for (let i = 0; i < 9; i++) { const r = 2.5 - i * 0.24, yy = 1.5 + i * 0.95; g.cyl(0, yy, 0, r, r, 0.1, 10, C.woodL, C.wood); for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + i * 0.7; g.box(Math.cos(a) * r * 0.5, yy - 0.2, Math.sin(a) * r * 0.5, 0.08, 0.4, 0.08, C.woodD); } }
    g.cyl(0, 10.9, 0, 0.05, 0.05, 1.5, 4, 0xc9a23a); g.box(0, 11.6, 0, 1.8, 0.05, 0.05, 0xc9a23a); g.box(0.95, 11.6, 0, 0.3, 0.24, 0.05, 0xc9a23a);
    /* running dog silhouette */
    g.box(0, 12.6, 0, 1.3, 0.42, 0.06, 0xd8b040); g.box(0.78, 12.86, 0, 0.44, 0.36, 0.06, 0xd8b040); g.box(1.06, 12.8, 0, 0.26, 0.16, 0.06, 0xd8b040); g.box(0.74, 13.1, 0, 0.12, 0.2, 0.06, 0xd8b040);
    g.box(-0.82, 12.9, 0, 0.5, 0.1, 0.06, 0xd8b040); g.box(0.5, 12.2, 0, 0.1, 0.5, 0.06, 0xd8b040); g.box(-0.5, 12.2, 0, 0.1, 0.5, 0.06, 0xd8b040); g.box(0.75, 12.3, 0, 0.36, 0.1, 0.06, 0xd8b040); g.box(-0.8, 12.3, 0, 0.36, 0.1, 0.06, 0xd8b040);
    g.notf(); ctx.col.push(world.addCircle(PLAZA.x, PLAZA.z, 3.4, y + 0.7), world.addCircle(PLAZA.x, PLAZA.z, 2.8, y + 1.3), world.addCircle(PLAZA.x, PLAZA.z, 0.5));
    for (const a of [0.8, 2.35, 3.95, 5.5]) P.lamp(ctx, PLAZA.x + Math.cos(a) * 12, PLAZA.z + Math.sin(a) * 12, { h: 3.6, r: 7 });
    /* festival layer: lanterns and painted pumpkins spiralling up the shelves, light strings to the lamp posts */
    for (let i = 0; i < 9; i++) { const r = 2.5 - i * 0.24, yy = y + 1.6 + i * 0.95, n = Math.max(4, Math.round(r * 5.5));
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + i * 0.45, px = PLAZA.x + Math.cos(a) * (r - 0.25), pz = PLAZA.z + Math.sin(a) * (r - 0.25);
        if ((k + i) % 2) { fest.g.tf(px, yy, pz, 0, R() * 6, 0, 0.62); fest.g.ball(0, 0.26, 0, 0.36, 0.28, 0.36, [C.orange, 0xf4ead0, 0x6fa8a0, 0xe0a030][(k + i * 3) % 4], 6, 3, true); fest.g.cyl(0, 0.5, 0, 0.05, 0.03, 0.14, 4, 0x4f7f3f); fest.g.notf(); }
        else { const c = LANC[(k + i) % LANC.length]; fest.g.notf(); fest.g.cyl(px, yy, pz, 0.15, 0.15, 0.36, 6, c, 0x3a2a1a); fest.gl.notf(); fest.gl.box(px, yy + 0.18, pz, 0.34, 0.38, 0.34, c); } } }
    for (const a of [0.8, 2.35, 3.95, 5.5]) { const ex = PLAZA.x + Math.cos(a) * 12, ez = PLAZA.z + Math.sin(a) * 12; hang(fest, [PLAZA.x, y + 10.6, PLAZA.z], [ex, y + 6.6, ez], 11, 0.5, 'lantern', LANC); fest.g.notf(); fest.g.cyl(ex, y + 3.7, ez, 0.05, 0.04, 3.0, 4, C.woodD); }
    for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + 0.2; P.pumpkin(festCtx, PLAZA.x + Math.cos(a) * 4.3, PLAZA.z + Math.sin(a) * 4.3, 1.0 + R() * 0.6, true, fest); }
    world.stack = { x: PLAZA.x, z: PLAZA.z };
  }
  /* courthouse forecourt: flag, the Old Fog Bell and the half-size lighthouse replica */
  P.flag(ctx, -133, -234, C.blue, 9); P.bench(ctx, -134, -262, -Math.PI / 2); P.lamp(ctx, -134.5, -240, { h: 3.6 }); P.lamp(ctx, -134.5, -260, { h: 3.6 });
  { const bx = -110, bz = -222, { g, y } = local(bx, bz); g.box(0, 0.35, 0, 2.6, 0.7, 2.0, C.stoneD); for (const s of [-1, 1]) g.box(s * 1.0, 1.7, 0, 0.2, 2.2, 0.2, C.woodD); g.box(0, 2.85, 0, 2.6, 0.22, 0.3, C.woodD); g.gable(0, 2.95, 0, 3.0, 1.0, 0.5, 0x5a3a2a, true);
    g.cyl(0, 1.35, 0, 0.62, 0.3, 1.0, 10, 0xb08a3a, 0x8a6a2a); g.cyl(0, 1.25, 0, 0.66, 0.62, 0.12, 10, 0xc9a23a); g.ball(0, 1.2, 0, 0.12, 0.12, 0.12, 0x5a4a2a, 5, 3, true); g.notf();
    ctx.col.push(world.addBox(bx - 1.3, bz - 1.0, bx + 1.3, bz + 1.0, y + 0.7), world.addCircle(bx - 1, bz, 0.2), world.addCircle(bx + 1, bz, 0.2)); world.fogBell = { x: bx, z: bz + 1.8 };
    const lx = -108, lz = -231, L = local(lx, lz); L.g.cyl(0, 0, 0, 1.3, 1.3, 0.5, 8, C.stoneD); L.g.cyl(0, 0.5, 0, 1.0, 0.8, 2.6, 8, C.white); L.g.cyl(0, 3.1, 0, 1.0, 1.0, 0.12, 8, C.dark); L.g.cyl(0, 3.2, 0, 0.6, 0.6, 0.8, 8, 0xfff0c0); L.g.cyl(0, 4.0, 0, 0.85, 0, 0.7, 8, C.red); L.gl.cyl(0, 3.2, 0, 0.66, 0.66, 0.8, 8, 0xffe0a0); L.g.notf(); L.gl.notf(); ctx.col.push(world.addCircle(lx, lz, 1.3)); pool(ctx, lx, lz, 6); }
  /* riverwalk + Courthouse Dock */
  for (let z = -326; z <= -200; z += 21) { P.lamp(ctx, -99.4, z, { h: 3.4, r: 6 }); if (z % 2) P.bench(ctx, -105.2, z + 10, Math.PI / 2); }
  P.rail(ctx, -98.4, -300, -98.4, -226, hAt(-99, -260), 1.0, C.metal);
  P.deck(ctx, -99, -214, -66, -210, 1.0); P.crate(ctx, -101, -217); P.crate(ctx, -102.3, -217.6, 0.7, 0x7fa6c0); P.signpost(ctx, -97, -206.5, 'Canoes: hop in!', { ry: Math.PI / 2, bg: '#3f6f8f' });
  /* Columbia View Park: stage, splash pad, lawn, parking */
  P.stage(ctx, -150, -150, Math.PI, 0x4f7f6f);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, { g } = ctx.pick(-122, -164); g.notf(); g.cyl(-122 + Math.cos(a) * 3.4, hAt(-122, -164), -164 + Math.sin(a) * 3.4, 0.09, 0.07, 0.5 + (i % 2) * 0.5, 5, 0x9fd8f4); }
  for (const [x, z, ry] of [[-176, -160, Math.PI / 2], [-132, -176, 0], [-112, -154, -Math.PI / 2], [-150, -128.5, Math.PI], [-170, -128.5, Math.PI]]) P.bench(ctx, x, z, ry);
  for (const [x, z] of [[-190, -168], [-160, -180], [-128, -180], [-104, -170], [-110, -134], [-140, -130], [-186, -132]]) P.lamp(ctx, x, z, { h: 3.4, r: 6 });
  P.table(ctx, -184, -146, { picnic: true, ry: 0.3 }); P.table(ctx, -176, -138, { picnic: true, ry: 1.2 }); P.bin(ctx, -166, -168); P.flag(ctx, -196, -188, 0x3f7f4f, 7);
  for (const [x, z] of [[-192, -156], [-178, -126.5], [-128, -146], [-106, -180], [-136, -126]]) tree('leafy', x, z, 1.0);
  /* welcome arch on Columbia Blvd */
  { const { g } = local(-232, -250, Math.PI / 2); for (const s of [-6.6, 6.6]) g.box(s, 2.9, 0, 0.5, 5.8, 0.5, C.stoneD); g.box(0, 5.6, 0, 13.8, 0.9, 0.4, C.woodL); board(g, 'Riverfront Old Town', 5.6, 0.22, 10, 0.8, { bg: '#3f4f6f' }); g.tf(-232, hAt(-232, -250), -250, 0, -Math.PI / 2, 0); board(g, 'St. Helens, Oregon', 5.6, 0.22, 10, 0.8, { bg: '#3f4f6f' }); g.notf(); ctx.col.push(world.addCircle(-232, -256.6, 0.4), world.addCircle(-232, -243.4, 0.4)); }
  /* North Marina: finger piers and moored boats */
  for (const z of [-362, -350, -338]) P.deck(ctx, -98, z - 1, -78, z + 1, 0.9);
  P.deck(ctx, -100, -364, -97, -336, 0.9); P.boat(ctx, -84, -356, Math.PI / 2, C.blue); P.boat(ctx, -86, -344, -Math.PI / 2, C.red); P.boat(ctx, -83, -332, Math.PI / 2, 0x4fae8f);
  P.crate(ctx, -104, -344); P.crate(ctx, -105.2, -345.4, 0.7, C.blue); P.lamp(ctx, -103, -356, { h: 3.2 }); P.lamp(ctx, -103, -334, { h: 3.2 }); P.bench(ctx, -110, -362, 0);
  /* Grey Cliffs: rail along the bluff, benches */
  P.rail(ctx, -121, -417, -121, -391, hAt(-122, -404), 1.0); P.bench(ctx, -125, -398, -Math.PI / 2); P.bench(ctx, -125, -410, -Math.PI / 2);
  /* the grey cliff itself: three stepped rows of basalt columns dropping from the lawn to the river bank */
  for (let row = 0; row < 3; row++) for (let z = -419; z <= -389; z += 2.3) { const x = -117.6 + row * 2.3 + (R() - 0.5) * 0.7, zz = z + (row % 2) * 1.1 + (R() - 0.5) * 0.5, gy = hAt(x, zz), top = 7.5 - row * 1.5 + R() * 0.9, rr = 1.15 + R() * 0.3; if (top < gy + 0.7) continue;
    const { g } = ctx.pick(x, zz); g.notf(); g.cyl(x, gy - 1.2, zz, rr, rr * 0.96, top - gy + 1.2, 6, [0x5f636b, 0x6a6e76, 0x74787f][Math.floor(R() * 3)], 0x868a92); ctx.col.push(world.addCircle(x, zz, rr * 0.92, top)); } P.table(ctx, -160, -404, { picnic: true }); P.lamp(ctx, -150, -388, { h: 3.2, col: C.woodD });
  /* Dalton Lake: viewing platform */
  P.deck(ctx, -214, -437, -206, -428, 0.9, { rail: true }); P.rail(ctx, -214, -437, -206, -437, 0.9, 1.0); P.bench(ctx, -246, -430, 0); P.bench(ctx, -286, -456, Math.PI / 2); P.log(ctx, -196, -486, 1.2, 3);
  /* the Old Quarry: cut basalt blocks, a derrick, terraces */
  { const qx = -330, qz = -438; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + R() * 0.3, r = 15 + R() * 6, x = qx + Math.cos(a) * r, z = qz + Math.sin(a) * r; if (Math.abs(a % TAU - 1.57) < 0.5) continue; const { g } = ctx.pick(x, z), y = hAt(x, z), s = 1.4 + R() * 1.6; g.tf(x, y - 0.3, z, 0, R() * 3, 0); g.box(0, s / 2, 0, s * 1.3, s, s, i % 2 ? 0x6a6e76 : 0x7a7e86, 0x868a92); g.notf(); ctx.col.push(world.addCircle(x, z, s * 0.75, y + s - 0.3)); }
    for (const [dx, dz, s] of [[-4, 2, 1.2], [-2.6, 3, 1.0], [3, -3, 1.4], [4.4, -2, 0.9], [-3.4, 2.6, 0.8]]) { const { g } = ctx.pick(qx + dx, qz + dz), y = world.groundAt(qx + dx, qz + dz, 50); g.tf(qx + dx, y, qz + dz, 0, R(), 0); g.box(0, s / 2, 0, s * 1.4, s, s, 0x74787f, 0x868a92); g.notf(); ctx.col.push(world.addBox(qx + dx - s * 0.7, qz + dz - s * 0.5, qx + dx + s * 0.7, qz + dz + s * 0.5, y + s)); }
    /* cut benches on the west wall: three big steps to climb */
    { const y0 = hAt(qx - 9, qz), tg = ctx.pick(qx - 16, qz).g; tg.notf(); let prev = y0; for (let i = 0; i < 3; i++) { const x0 = qx - 11.5 - i * 3.2, top = Math.max(prev + 1.0, hAt(x0 - 1.6, qz - 1) + 0.9); prev = top; tg.box(x0 - 1.6, (top + y0 - 2) / 2, qz - 1, 3.2, top - y0 + 2, 15 - i * 2.4, [0x70747b, 0x676b73, 0x5f636b][i], 0x8a8e96); ctx.col.push(world.addBox(x0 - 3.2, qz - 1 - (15 - i * 2.4) / 2, x0, qz - 1 + (15 - i * 2.4) / 2, top)); } }
    const { g } = local(qx + 7, qz + 5, 0.6); g.box(0, 4, 0, 0.4, 8, 0.4, C.woodD); g.tf(qx + 7, hAt(qx + 7, qz + 5), qz + 5, 0, 0.6, -0.8); g.box(0, 5.4, 0, 0.3, 9, 0.3, C.woodD); g.notf(); ctx.col.push(world.addCircle(qx + 7, qz + 5, 0.4)); }
  /* Nob Hill viewpoint */
  P.rail(ctx, -238, -124, -238, -140, hAt(-240, -132), 1.0); P.bench(ctx, -243, -128, -Math.PI / 2); P.bench(ctx, -243, -137, -Math.PI / 2);
  for (const b of BUILDINGS) if (b.yard) {
    const s = b.f === 'n' ? -1 : b.f === 's' ? 1 : 0, e = b.f === 'w' ? -1 : b.f === 'e' ? 1 : 0;
    P.mailbox(ctx, b.x + (s ? 4.6 : e * 7.6), b.z + (s ? s * 7.4 : 4.6), [C.blue, C.red, C.green, C.white][Math.floor(R() * 4)]);
    if (R() < 0.55) { if (s) P.fence(ctx, b.x - 7, b.z - s * 6.4, b.x + 7, b.z - s * 6.4, { h: 0.9 }); else P.fence(ctx, b.x - e * 6.4, b.z - 7, b.x - e * 6.4, b.z + 7, { h: 0.9 }); }
    if (R() < 0.6) tree('leafy', b.x - (s ? 6.6 : e * 3), b.z - (s ? s * 3 : 6.8), 0.7 + R() * 0.3);
    P.pumpkin(festCtx, b.x + (s ? -2.2 : e * (b.w / 2 + 1)), b.z + (s ? s * (b.d / 2 + 1) : -2.2), 1.1, true, fest); if (R() < 0.6) P.pumpkin(festCtx, b.x + (s ? 2.6 : e * (b.w / 2 + 0.9)), b.z + (s ? s * (b.d / 2 + 0.8) : 2.6), 0.8, true, fest);
  }
  /* ---------- McCormick Park ---------- */
  { const y = hAt(-420, -122), { g } = ctx.pick(-420, -122); g.notf();
    for (let i = 0; i < 5; i++) { g.box(-432 + i * 0.4, y + 0.1 + i * 0.1, -122, 0.4, 0.2 + i * 0.2, 6, 0x9a968c); ctx.col.push(world.addBox(-432.2 + i * 0.4, -125, -431.8 + i * 0.4, -119, y + 0.2 + i * 0.2)); g.box(-406 - i * 0.4, y + 0.1 + i * 0.1, -122, 0.4, 0.2 + i * 0.2, 6, 0x9a968c); ctx.col.push(world.addBox(-406.2 - i * 0.4, -125, -405.8 - i * 0.4, -119, y + 0.2 + i * 0.2)); }
    g.box(-419, y + 0.3, -112, 5, 0.6, 1.4, 0xa8a49a); ctx.col.push(world.addBox(-421.5, -112.7, -416.5, -111.3, y + 0.6)); g.box(-419, y + 0.45, -130, 6, 0.08, 0.08, C.metal); for (const s of [-2.8, 2.8]) g.box(-419 + s, y + 0.22, -130, 0.08, 0.45, 0.08, C.metal); ctx.col.push(world.addBox(-422, -130.1, -416, -129.9, y + 0.5)); }
  P.agility(ctx, -386, -100); P.signpost(ctx, -394, -114, 'Off-Leash Meadow', { ry: 0 });
  P.fence(ctx, -396, -112, -350, -112, { col: C.woodL, h: 1.0 }); P.fence(ctx, -396, -74, -350, -74, { col: C.woodL, h: 1.0 }); P.fence(ctx, -396, -112, -396, -98, { col: C.woodL, h: 1.0 }); P.fence(ctx, -396, -90, -396, -74, { col: C.woodL, h: 1.0 }); P.fence(ctx, -350, -112, -350, -74, { col: C.woodL, h: 1.0 });
  for (const [x, z] of [[-428, -96], [-412, -72], [-342, -88]]) { const { g, y } = local(x, z); g.cyl(0, 0, 0, 0.06, 0.06, 1.5, 5, C.metal); g.cyl(0, 0.8, 0, 0.4, 0.5, 0.5, 8, C.yellow, null, 1, 0); g.cyl(0, 1.5, 0, 0.5, 0.5, 0.06, 8, C.yellow); g.notf(); ctx.col.push(world.addCircle(x, z, 0.3, y + 1.5)); }
  P.table(ctx, -380, -134, { picnic: true }); P.table(ctx, -372, -128, { picnic: true, ry: 0.8 }); P.bench(ctx, -404, -140, 0); P.bench(ctx, -340, -120, -Math.PI / 2); P.lamp(ctx, -396, -146, { h: 3.4, col: C.woodD }); P.lamp(ctx, -426, -140, { h: 3.4, col: C.woodD });
  P.deck(ctx, -427, -90, -421, -83, hAt(-424, -86) + 0.3, {}); P.deck(ctx, -401, -90.5, -395, -86, hAt(-398, -88) + 0.3, {});
  /* ---------- the Paper Mill ---------- */
  for (let i = 0; i < 5; i++) { const x = -336 - (i % 3) * 2.4, z = 2 - Math.floor(i / 3) * 2.6, { g } = ctx.pick(x, z), y = hAt(x, z); g.notf(); g.cyl(x, y, z, 1.0, 1.0, 1.7, 10, 0xf4f0e4, 0xd8c8a4); ctx.col.push(world.addCircle(x, z, 1.0, y + 1.7)); }
  { const { g, y } = local(-372, -50); for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) { g.tf(-372, y + 0.4 + i * 0.7, -52 + j * 0.84 + i * 0.42, 0, 0, Math.PI / 2); g.cyl(0, -3, 0, 0.42, 0.42, 6, 7, 0x7a5a3a, 0xc9a67a); } g.notf(); ctx.col.push(world.addBox(-375, -52.6, -369, -49.6, y + 1.8)); }
  P.crate(ctx, -334, -44, 1.2); P.crate(ctx, -335.6, -42.6, 0.9, 0x7fa6c0); P.lamp(ctx, -330, -30, { h: 4 }); P.lamp(ctx, -330, -6, { h: 4 });
  /* ---------- Scappoose ---------- */
  { const { g, gl, y } = local(-300, 41, 0.33); g.box(0, 4.2, 0, 9, 0.4, 6, C.white, C.red); for (const s of [-3.6, 3.6]) g.box(s, 2.1, 0, 0.3, 4.2, 0.3, C.white); for (const s of [-1.6, 1.6]) { g.box(s, 0.9, 0, 0.7, 1.8, 0.5, C.red); g.box(s, 1.4, 0.26, 0.5, 0.4, 0.04, 0xbfe4ff); } gl.box(0, 3.95, 0, 8, 0.1, 5, 0xffe6b0); g.notf(); gl.notf(); ctx.col.push(world.addCircle(-301.5, 40.4, 0.5, y + 1.8), world.addCircle(-298.5, 41.5, 0.5, y + 1.8)); pool(ctx, -300, 41, 7); }
  P.noticeboard(ctx, -282, 28, 1.9, 'SIDE JOBS'); for (const [x, z] of [[-280, 36], [-272, 66], [-266, 92], [-250, 112]]) P.lamp(ctx, x, z); P.bench(ctx, -264, 54, -1.3); P.bin(ctx, -265, 78);
  { const { g } = local(-310, -8, 0.2); for (const s of [-3, 3]) g.box(s, 1.6, 0, 0.3, 3.2, 0.3, C.woodD); g.box(0, 3.0, 0, 7, 1.2, 0.3, 0x3f5f3f); board(g, 'Scappoose', 3.0, 0.17, 6.4, 0.9, { bg: '#3f5f3f' }); g.tf(-310, hAt(-310, -8), -8, 0, 0.2 + Math.PI, 0); board(g, 'Scappoose', 3.0, 0.17, 6.4, 0.9, { bg: '#3f5f3f' }); g.notf(); ctx.col.push(world.addCircle(-313, -8.6, 0.3), world.addCircle(-307, -7.4, 0.3)); }
  /* ---------- Highway 30: signs and lamps at the junctions (the freight train itself runs in vehicles.js) ---------- */
  const hsign = (x, z, ry, a, b2) => { const { g } = local(x, z, ry); for (const s of [-2.2, 2.2]) g.cyl(s, 0, 0, 0.1, 0.1, 4.6, 5, C.metal); g.box(0, 4.0, 0, 5.4, 1.9, 0.12, 0x2f6f4f); board(g, a, 4.4, 0.08, 5, 0.7, { bg: '#2f6f4f' }); if (b2) board(g, b2, 3.6, 0.08, 5, 0.7, { bg: '#2f6f4f' }); g.notf(); ctx.col.push(world.addCircle(x - Math.cos(ry) * 2.2, z + Math.sin(ry) * 2.2, 0.15), world.addCircle(x + Math.cos(ry) * 2.2, z - Math.sin(ry) * 2.2, 0.15)); };
  hsign(-460, -226, 0, 'Old Town  >', 'Scappoose  8'); hsign(-458, -374, Math.PI, 'St. Helens', '<  Marina'); hsign(-382, 28, 0.75, 'Scappoose', 'Portland  20'); hsign(-286.4, 126.4, -2.4, 'St. Helens  8', 'Old Portland Rd');
  hsign(-198.4, 214.4, 0.75, 'Sauvie Island  <', 'Portland  5'); hsign(-118, 332, 0.3, 'St. Johns Bridge  <', 'Downtown'); hsign(-92, 304, Math.PI, 'Highway 30', 'St. Helens  28');
  for (const [x, z] of [[-443, -256], [-443, -344], [-444, -156], [-342, 48], [-256, 156], [-156, 258], [-112, 316]]) P.lamp(ctx, x, z, { h: 5.2, r: 8 });
  /* ---------- the railway: sleepers and rails as thin geometry on the painted ballast, planked road crossings with a plain crossbuck, a buffer stop at Linnton ---------- */
  const walk = (path, step, fn) => { let carry = 0; for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-6) continue; const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l; let t = carry; while (t < l) { fn(a[0] + ux * t, a[1] + uz * t, ux, uz); t += step; } carry = t - l; } };
  const inMap = (x, z) => Math.abs(x) < EXT - 8 && Math.abs(z) < EXT - 8;
  /* a flat strip lying on the ground from (x0, z0) to (x1, z1) */
  const strip = (x0, z0, x1, z1, w, col, lift = 0.06, sides = 0) => { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, l = Math.hypot(x1 - x0, z1 - z0) || 1, px = (-(z1 - z0) / l) * w / 2, pz = ((x1 - x0) / l) * w / 2, y0 = hAt(x0, z0) + lift, y1 = hAt(x1, z1) + lift, g = ctx.pick(mx, mz).g; g.notf();
    g.quad([x0 - px, y0, z0 - pz], [x0 + px, y0, z0 + pz], [x1 + px, y1, z1 + pz], [x1 - px, y1, z1 - pz], col, [mx, y0 - 50, mz]);
    if (sides) for (const s of [-1, 1]) g.quad([x0 + px * s, y0, z0 + pz * s], [x1 + px * s, y1, z1 + pz * s], [x1 + px * s, y1 - sides, z1 + pz * s], [x0 + px * s, y0 - sides, z0 + pz * s], 0x5a5e66, [mx, y0, mz]); };
  walk(world.rail, 1.9, (x, z, ux, uz) => { if (!inMap(x, z) || world.surfaceAt(x, z) === 1) return; strip(x - uz * 1.2, z + ux * 1.2, x + uz * 1.2, z - ux * 1.2, 0.36, 0x6a5440, 0.07); });
  walk(world.rail, 5, (x, z, ux, uz) => { if (!inMap(x, z)) return; for (const s of [-0.72, 0.72]) strip(x - uz * s, z + ux * s, x - uz * s + ux * 5, z + ux * s + uz * 5, 0.13, 0x9a9fa6, 0.19, 0.13); });
  for (const [cx, cz, ryRoad] of RAIL_CROSSINGS) {
    let ry = 0, best = 1e9; for (let i = 0; i < world.rail.length - 1; i++) { const a = world.rail[i], b = world.rail[i + 1], d = Math.hypot((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cz); if (d < best) { best = d; ry = Math.atan2(b[0] - a[0], b[1] - a[1]); } }
    const { g } = local(cx, cz, ry); g.box(0, 0.08, 0, 3.4, 0.16, 12.5, 0x6e5a46, 0x7c6650); g.notf();
    const rx = Math.sin(ryRoad), rz = Math.cos(ryRoad), tx = Math.sin(ry), tz = Math.cos(ry);
    for (const side of [-1, 1]) { let sx = 0, sz = 0, okPos = false; for (const along of [7.6, -7.6, 9.4, -9.4]) { sx = cx + rx * side * 4.4 + tx * along * side; sz = cz + rz * side * 4.4 + tz * along * side; if (world.surfaceAt(sx, sz) !== 1 && !world.blockedAt(sx, sz, hAt(sx, sz), 2.2)) { okPos = true; break; } } if (!okPos) continue;
      const y = hAt(sx, sz), q = ctx.pick(sx, sz).g; q.tf(sx, y, sz, 0, ryRoad, 0); q.cyl(0, 0, 0, 0.08, 0.08, 3.5, 5, C.metal);
      for (const rz2 of [0.72, -0.72]) { q.tf(sx, y + 3.0, sz, 0, ryRoad, rz2); q.box(0, 0, 0, 1.9, 0.26, 0.07, C.white); } q.tf(sx, y, sz, 0, ryRoad, 0); q.box(0, 2.1, 0, 0.5, 0.5, 0.06, C.yellow); q.notf(); ctx.col.push(world.addCircle(sx, sz, 0.16)); }
  }
  { const n = world.rail.length, a = world.rail[n - 2], b = world.rail[n - 1], ry = Math.atan2(b[0] - a[0], b[1] - a[1]), { g, y } = local(b[0], b[1], ry); for (const s of [-0.9, 0.9]) g.box(s, 0.8, 0, 0.3, 1.6, 0.5, C.dark); g.box(0, 1.25, 0, 2.6, 0.5, 0.36, C.red); g.box(0, 1.25, -0.19, 0.7, 0.5, 0.04, C.white); g.notf(); ctx.col.push(world.addCircle(b[0], b[1], 1.3, y + 1.6)); }
  /* ---------- Wapato Bridge + Sauvie Island ---------- */
  deck('z', WAPATO.z0, WAPATO.z1, WAPATO.x, WAPATO.w, WAPATO.top);
  { const { g } = ctx.pick(WAPATO.x, 182); g.notf(); for (const s of [-1, 1]) { const x = WAPATO.x + s * (WAPATO.w / 2 + 0.2), n = 10; for (let i = 0; i < n; i++) { const f0 = i / n, f1 = (i + 1) / n, z0 = lerp(WAPATO.z0 + 4, WAPATO.z1 - 4, f0), z1 = lerp(WAPATO.z0 + 4, WAPATO.z1 - 4, f1), y0 = WAPATO.top + Math.sin(f0 * Math.PI) * 9, y1 = WAPATO.top + Math.sin(f1 * Math.PI) * 9; g.quad([x - 0.3, y0, z0], [x + 0.3, y0, z0], [x + 0.3, y1, z1], [x - 0.3, y1, z1], 0x6f9f8a, [x, -20, 182]); g.quad([x - 0.3, y0 - 0.5, z0], [x + 0.3, y0 - 0.5, z0], [x + 0.3, y1 - 0.5, z1], [x - 0.3, y1 - 0.5, z1], 0x5f8f7a, [x, 40, 182]); if (i > 0) g.box(x, (WAPATO.top + y0) / 2, z0, 0.1, y0 - WAPATO.top, 0.1, 0x5f8f7a); } }
    for (const z of [168, 198]) { g.box(WAPATO.x, 0.6, z, WAPATO.w - 1, 6.4, 2, C.stoneD); ctx.col.push(world.addBox(WAPATO.x - 4, z - 1, WAPATO.x + 4, z + 1, 3.2)); } }
  P.fence(ctx, 58, 76, 128, 76, { col: C.woodL, h: 1.0 }); P.fence(ctx, 128, 76, 128, 128, { col: C.woodL, h: 1.0 }); P.fence(ctx, 58, 128, 128, 128, { col: C.woodL, h: 1.0 }); P.fence(ctx, 58, 84, 58, 128, { col: C.woodL, h: 1.0 });
  for (let i = 0; i < 46; i++) P.pumpkin(ctx, 61 + (i % 10) * 6.6 + R() * 2.4, 79.6 + Math.floor(i / 10) * 9.6 + R() * 3, 0.9 + R() * 1.1, false, null, i % 7 === 3 ? 2 : i % 9 === 5 ? 3 : 0);
  P.fence(ctx, 100, 8, 134, 8, { col: C.woodL, h: 1.1 }); P.fence(ctx, 134, 8, 134, 44, { col: C.woodL, h: 1.1 }); P.fence(ctx, 100, 44, 134, 44, { col: C.woodL, h: 1.1 }); P.fence(ctx, 100, 8, 100, 22, { col: C.woodL, h: 1.1 }); P.fence(ctx, 100, 30, 100, 44, { col: C.woodL, h: 1.1 });
  P.fence(ctx, 87, 31, 97, 31, { col: C.woodL, h: 0.8 }); P.fence(ctx, 87, 31, 87, 40, { col: C.woodL, h: 0.8 });
  P.haybale(ctx, 58, 52, 0.2, 2); P.haybale(ctx, 60.5, 54, 1.2, 1); P.haybale(ctx, 55.6, 53.6, 0.8, 1); P.haybale(ctx, 66, 70, 0.1, 3); P.haybale(ctx, 68.4, 70.6, 1.0, 2); P.haybale(ctx, 70.6, 71, 0.4, 1); P.haybale(ctx, 40, 68, 0.3, 1);
  { /* corn maze: hedge-high corn walls on a 9 x 9 grid, carved by a seeded depth-first walk */
    const M = MAZE, nx = 9, nz = 9, cw = (M.x1 - M.x0) / nx, cd = (M.z1 - M.z0) / nz, vis = new Uint8Array(nx * nz), wallE = new Uint8Array(nx * nz).fill(1), wallS = new Uint8Array(nx * nz).fill(1), Rm = rng(61), st = [[5, 0]]; vis[5] = 1;
    while (st.length) { const [cx, cz] = st[st.length - 1], opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => { const ax = cx + dx, az = cz + dz; return ax >= 0 && az >= 0 && ax < nx && az < nz && !vis[az * nx + ax]; }); if (!opts.length) { st.pop(); continue; } const [dx, dz] = opts[Math.floor(Rm() * opts.length)]; if (dx === 1) wallE[cz * nx + cx] = 0; else if (dx === -1) wallE[cz * nx + cx - 1] = 0; else if (dz === 1) wallS[cz * nx + cx] = 0; else wallS[(cz - 1) * nx + cx] = 0; vis[(cz + dz) * nx + cx + dx] = 1; st.push([cx + dx, cz + dz]); }
    const wall = (x0, z0, x1, z1) => { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, { g } = ctx.pick(mx, mz), y = hAt(mx, mz); g.notf(); g.box(mx, y + 1.1, mz, Math.abs(x1 - x0) + 0.9, 2.2, Math.abs(z1 - z0) + 0.9, 0x9aa844, 0xc9b24a); ctx.col.push(world.addBox(Math.min(x0, x1) - 0.45, Math.min(z0, z1) - 0.45, Math.max(x0, x1) + 0.45, Math.max(z0, z1) + 0.45, y + 2.2)); };
    for (let c = 0; c < nx; c++) { if (c !== 5) wall(M.x0 + c * cw, M.z0, M.x0 + (c + 1) * cw, M.z0); if (c !== 3) wall(M.x0 + c * cw, M.z1, M.x0 + (c + 1) * cw, M.z1); }
    for (let r = 0; r < nz; r++) { wall(M.x0, M.z0 + r * cd, M.x0, M.z0 + (r + 1) * cd); wall(M.x1, M.z0 + r * cd, M.x1, M.z0 + (r + 1) * cd); }
    for (let r = 0; r < nz; r++) for (let c = 0; c < nx; c++) { if (c < nx - 1 && wallE[r * nx + c]) wall(M.x0 + (c + 1) * cw, M.z0 + r * cd, M.x0 + (c + 1) * cw, M.z0 + (r + 1) * cd); if (r < nz - 1 && wallS[r * nx + c]) wall(M.x0 + c * cw, M.z0 + (r + 1) * cd, M.x0 + (c + 1) * cw, M.z0 + (r + 1) * cd); }
    P.signpost(ctx, 16, 70.5, 'Corn Maze: this way in', { ry: 0 }); }
  { const { g } = ctx.pick(96, 62), x = 96, z = 66, y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 3, 3, 11, 10, 0xd8d8d2); g.ball(0, 11, 0, 3, 2.2, 3, 0x9aa0a8, 10, 4, true); g.notf(); ctx.col.push(world.addCircle(x, z, 3)); footprints.push([x - 3, z - 3, x + 3, z + 3]); }
  { const { g } = ctx.pick(52, 20), x = 68, z = 28, y = hAt(x, z); g.tf(x, y, z, 0, 0.5, 0); g.box(0, 1.1, 0, 1.4, 1.0, 2.8, 0x3f9f4f); g.box(0, 2.0, -0.8, 1.3, 1.2, 1.2, 0x3f9f4f); g.box(0, 2.7, -0.8, 1.5, 0.12, 1.4, C.dark); for (const [wx, wz, wr] of [[-0.85, -0.8, 0.85], [0.85, -0.8, 0.85], [-0.8, 1.1, 0.5], [0.8, 1.1, 0.5]]) { g.tf(x, y, z, 0, 0.5, 0); const m = g.m.clone(); g.m.multiply(new THREE.Matrix4().makeTranslation(wx, wr, wz)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)); g.cyl(0, -0.2, 0, wr, wr, 0.4, 9, C.dark, C.yellow); g.m.copy(m); } g.cyl(0.4, 1.6, 1.0, 0.08, 0.08, 1.0, 5, C.dark); g.notf(); ctx.col.push(world.addCircle(x, z, 1.7)); }
  { const x = 24, z = 44, { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.quad([sx, 0, sz], [sx * 0.82, 0, sz * 0.82], [sx * 0.2, 8, sz * 0.2], [sx * 0.32, 8, sz * 0.32], C.metal).quad([sx, 0, sz], [sx * 0.82, 0, sz], [sx * 0.2, 8, sz * 0.2], [sx * 0.32, 8, sz * 0.2], C.metal); g.box(0, 8, 0, 0.8, 0.5, 0.8, C.metal); g.box(0, 4, 0, 1.3, 0.08, 1.3, C.metal); g.notf();
    const bg = new Geo(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, a2 = a + 0.42; bg.quad([Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.1], [Math.cos(a2) * 2.4, Math.sin(a2) * 2.4, -0.1], [Math.cos(a2) * 0.4, Math.sin(a2) * 0.4, 0], 0xd8d8d2); bg.quad([Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.01], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.11], [Math.cos(a2) * 2.4, Math.sin(a2) * 2.4, -0.09], [Math.cos(a2) * 0.4, Math.sin(a2) * 0.4, 0.01], 0xb8b8b2, [0, 0, -9]); }
    const blades = new THREE.Mesh(bg.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); blades.position.set(x, y + 8, z + 0.6); scene.add(blades); anim.push((dt, night, t, cam) => { blades.visible = Math.hypot(cam.x - x, cam.z - z) < 220; blades.rotation.z += dt * 1.4; }); ctx.col.push(world.addCircle(x, z, 1.1)); }
  { const { g } = ctx.pick(52, 72), x = 54, z = 78, y = hAt(x, z); g.tf(x, y, z, 0, 2.6, 0); g.box(0, 1.1, 0, 0.1, 2.2, 0.1, C.woodD); g.box(0, 1.6, 0, 1.8, 0.1, 0.1, C.woodD); g.box(0, 1.4, 0, 0.7, 0.8, 0.3, 0xc94f3f); g.ball(0, 2.1, 0, 0.26, 0.28, 0.26, C.hay, 6, 4, true); g.cyl(0, 2.3, 0, 0.42, 0.1, 0.3, 7, 0x7a5a36); g.notf(); ctx.col.push(world.addCircle(x, z, 0.2)); }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) tree('leafy', 128 + i * 16, 104 + j * 16, 0.8, true);
  for (const [x, z] of [[40, 30], [70, 46], [-52, 110], [-80, 50]]) P.lamp(ctx, x, z, { h: 3.4, col: C.woodD });
  /* Warrior Rock Light: Oregon's smallest lighthouse, on its rock at the north tip */
  { const lx = LIGHTHOUSE.x, lz = LIGHTHOUSE.z, { g, gl, y } = local(lx, lz); g.cyl(0, -1.5, 0, 3.4, 3.0, 3.0, 9, C.stoneD, 0x8a8e96); g.cyl(0, 1.5, 0, 2.0, 1.6, 5.2, 8, C.white); g.cyl(0, 6.7, 0, 2.1, 2.1, 0.16, 8, C.dark); g.cyl(0, 6.86, 0, 1.1, 1.1, 1.3, 8, 0xfff0c0); g.cyl(0, 8.16, 0, 1.5, 0, 1.2, 8, C.red); g.box(0, 2.4, 1.86, 0.9, 1.8, 0.1, C.door); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.box(Math.cos(a) * 2.0, 7.3, Math.sin(a) * 2.0, 0.08, 0.9, 0.08, C.dark); }
    gl.cyl(0, 6.86, 0, 1.16, 1.16, 1.3, 8, 0xffe8a0); g.notf(); gl.notf(); ctx.col.push(world.addCircle(lx, lz, 3.3, y + 1.5), world.addCircle(lx, lz, 2.0)); pool(ctx, lx, lz, 10); footprints.push([lx - 2, lz - 2, lx + 2, lz + 2]);
    const bm = new Geo(); bm.tri([0, 0, 0], [26, 1.6, -2.4], [26, 1.6, 2.4], 0xffe8a0, [0, -9, 0]); bm.tri([0, 0, 0], [26, 1.6, -2.4], [26, 1.6, 2.4], 0xffe8a0, [0, 9, 0]); bm.tri([0, 0, 0], [-26, 1.6, -2.4], [-26, 1.6, 2.4], 0xffe8a0, [0, -9, 0]); bm.tri([0, 0, 0], [-26, 1.6, -2.4], [-26, 1.6, 2.4], 0xffe8a0, [0, 9, 0]);
    const beam = new THREE.Mesh(bm.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); beam.position.set(lx, y + 7.5, lz); beam.renderOrder = 3; scene.add(beam); anim.push((dt, night, t, cam) => { beam.visible = night > 0.05 && Math.hypot(cam.x - lx, cam.z - lz) < 320; beam.material.opacity = night * 0.22; beam.rotation.y = t * 0.7; }); }
  P.bench(ctx, -26, -98, 2.4); P.log(ctx, -44, -84, 0.7, 2.6);
  /* wildlife area platform, island beach driftwood */
  P.deck(ctx, 70, -12, 80, -4, 0.9, { rail: true }); P.rail(ctx, 80, -12, 80, -4, 0.9, 1.0); P.bench(ctx, 66, -24, 0.4); P.bench(ctx, 150, -20, -1.2);
  for (const [x, z, ry, l] of [[170, 44, 0.4, 3.4], [182, 62, 1.9, 2.6], [196, 50, 2.6, 3], [176, 72, 0.9, 2.2], [202, 68, 0.2, 2.8]]) P.log(ctx, x, z, ry, l);
  P.table(ctx, 162, 48, { picnic: true, ry: 0.4 });
  /* Sand Island: camp, dock and driftwood */
  P.deck(ctx, -68, -301.4, -58, -298.6, 0.9); P.campfire(ctx, -44, -312); for (const a of [0.3, 1.9, 3.4, 5.0]) P.log(ctx, -44 + Math.cos(a) * 3.2, -312 + Math.sin(a) * 3.2, -a, 2.4);
  P.tent(ctx, -38, -322, 0xf08a2a, 0.5); P.tent(ctx, -50, -326, 0x3f9fd6, 1.4); P.tent(ctx, -40, -302, 0x5fae5f, 2.4); P.table(ctx, -50, -306, { picnic: true, ry: 0.3 });
  { const { g } = local(-48, -244); g.cyl(0, 0, 0, 0.9, 0.6, 0.6, 8, C.sand); g.cyl(0, 0.6, 0, 0.4, 0.3, 0.5, 6, C.sand); g.cyl(0, 1.1, 0, 0.03, 0.03, 0.4, 3, C.woodD); g.box(0.15, 1.4, 0, 0.3, 0.2, 0.02, C.red); g.notf(); }
  P.log(ctx, -40, -238, 1.2, 3.2); P.log(ctx, -52, -270, 0.3, 2.4); P.log(ctx, -42, -356, 2.0, 2.8);
  /* ---------- Linnton + Forest Park ---------- */
  { const { g } = local(-160, 270, 0.9); for (const s of [-2.2, 2.2]) g.box(s, 1.6, 0, 0.3, 3.2, 0.3, C.woodD); g.box(0, 3.1, 0, 5.2, 0.8, 0.3, C.woodL); board(g, 'Wildwood Trail', 3.1, 0.17, 4.8, 0.62, { bg: '#3f5f3f' }); g.notf(); ctx.col.push(world.addCircle(-161.4, 271.7, 0.25), world.addCircle(-158.6, 268.3, 0.25)); }
  P.crate(ctx, -182, 250, 1.2); P.crate(ctx, -183.6, 251.4, 0.9, 0x7fa6c0); P.lamp(ctx, -150, 240, { h: 4 }); P.bench(ctx, -138, 276, -Math.PI / 2);
  along('wildwood', 6, (x, z, nx, nz, i) => { const s = i % 2 ? 1 : -1, px = x + nx * s * (4 + R() * 3), pz = z + nz * s * (4 + R() * 3);
    if (i % 3 === 0) P.log(ctx, px, pz, R() * 3, 2.6 + R()); else { const { g } = ctx.pick(px, pz); g.notf(); for (let m = 0; m < 4; m++) { const mx = px + (R() - 0.5) * 1.6, mz = pz + (R() - 0.5) * 1.6, my = hAt(mx, mz), ms = 0.6 + R() * 0.8; g.cyl(mx, my, mz, 0.06 * ms, 0.05 * ms, 0.3 * ms, 5, 0xf4ead8); g.cyl(mx, my + 0.28 * ms, mz, 0.24 * ms, 0.04, 0.16 * ms, 6, m % 2 ? 0xd9534f : 0xc98a4a); } }
    if (i % 12 === 2) P.marker(ctx, x + nx * 2.4, z + nz * 2.4, 0x4fae6f); }, 4);
  /* mansion terrace */
  P.rail(ctx, -236, 438, -236, 466, hAt(-237, 452), 1.0, C.white); P.bench(ctx, -240, 442, -Math.PI / 2); P.bench(ctx, -240, 462, -Math.PI / 2); P.lamp(ctx, -240, 436.5, { h: 3.4 }); P.lamp(ctx, -240, 467.5, { h: 3.4 });
  { const { g, y } = local(-238, 452); g.cyl(0, 0, 0, 0.1, 0.14, 1.2, 6, C.metal); g.tf(-238, y + 1.3, 452, 0.3 + Math.PI / 2, -Math.PI / 2, 0); g.cyl(0, -0.5, 0, 0.14, 0.2, 1.0, 7, 0x3f6f9f); g.notf(); ctx.col.push(world.addCircle(-238, 452, 0.25)); }
  /* ---------- St. Johns Bridge: steel suspension bridge with tall pointed towers ---------- */
  { const B = SJB, GREEN = 0x5f8f7a, GD = 0x4f7f6a, top = B.top; deck('x', B.x0, B.x1, B.z, B.w, top);
    const towers = [62, 136], TH = 34, cab = [];
    for (const tx of towers) { const { g } = ctx.pick(tx, B.z); g.notf();
      for (const s of [-1, 1]) { const z = B.z + s * (B.w / 2 + 1.1); g.box(tx, 2.2, z, 3.4, 12.4, 3.0, C.stoneD, C.stone); g.box(tx, top + TH / 2 - 2, z, 1.7, TH + 4, 1.7, GREEN); g.cyl(tx, top + TH, z, 1.25, 0, 5.4, 4, GD); g.cyl(tx, top + TH + 5.2, z, 0.06, 0.02, 1.6, 4, C.yellow);
        ctx.col.push(world.addBox(tx - 1.7, z - 1.5, tx + 1.7, z + 1.5, 60, -9)); }
      for (const yy of [top + 9.5, top + 19, top + 28]) { g.box(tx, yy, B.z, 1.3, 1.1, B.w + 2.2, GREEN);
        for (const s of [-1, 1]) { g.quad([tx - 0.6, yy - 0.5, B.z + s * (B.w / 2 + 0.3)], [tx + 0.6, yy - 0.5, B.z + s * (B.w / 2 + 0.3)], [tx + 0.6, yy - 4.6, B.z + s * (B.w / 2 + 0.3)], [tx - 0.6, yy - 4.6, B.z + s * (B.w / 2 + 0.3)], GD, [tx, yy, B.z]);
          g.tri([tx - 0.62, yy - 0.5, B.z + s * 0.3], [tx - 0.62, yy - 0.5, B.z + s * (B.w / 2 + 0.3)], [tx - 0.62, yy - 4.4, B.z + s * (B.w / 2 + 0.3)], GD, [tx + 9, yy, B.z]); g.tri([tx + 0.62, yy - 0.5, B.z + s * 0.3], [tx + 0.62, yy - 0.5, B.z + s * (B.w / 2 + 0.3)], [tx + 0.62, yy - 4.4, B.z + s * (B.w / 2 + 0.3)], GD, [tx - 9, yy, B.z]); } }
      footprints.push([tx - 1.7, B.z - 7.6, tx + 1.7, B.z + 7.6]); }
    /* main cables and hangers */
    const cy = x => { const [a, b] = towers, yt = top + TH - 0.5; if (x < a) return lerp(top + 1.2, yt, ((x - B.x0) / (a - B.x0)) ** 1.5); if (x > b) return lerp(top + 1.2, yt, ((B.x1 - x) / (B.x1 - b)) ** 1.5); const f = (x - a) / (b - a); return yt - Math.sin(f * Math.PI) * (TH - 6.5); };
    for (const s of [-1, 1]) { const z = B.z + s * (B.w / 2 + 1.1); for (let x = B.x0; x < B.x1; x += 4) { const x1 = Math.min(B.x1, x + 4), { g } = ctx.pick(x + 2, B.z), y0 = cy(x), y1 = cy(x1); g.notf(); g.quad([x, y0 - 0.22, z], [x1, y1 - 0.22, z], [x1, y1 + 0.22, z], [x, y0 + 0.22, z], GREEN, [x, y0, z - s * 9]); g.quad([x, y0 - 0.22, z], [x1, y1 - 0.22, z], [x1, y1 + 0.22, z], [x, y0 + 0.22, z], GREEN, [x, y0, z + s * 9]); g.quad([x, y0 + 0.22, z - 0.2], [x1, y1 + 0.22, z - 0.2], [x1, y1 + 0.22, z + 0.2], [x, y0 + 0.22, z + 0.2], GD, [x, -50, z]);
        if (y0 - top > 2.4 && Math.abs(x - towers[0]) > 2 && Math.abs(x - towers[1]) > 2) g.box(x, (y0 + top) / 2 + 0.3, z - s * 1.0, 0.09, y0 - top - 0.6, 0.09, GD); } }
    /* girders under the deck, the pointed-arch piers that give Cathedral Park its name, and lamps */
    { const { g } = ctx.pick(100, B.z); g.notf(); for (const s of [-1, 1]) g.box((B.x0 + B.x1) / 2, top - 1.5, B.z + s * (B.w / 2 - 0.6), B.x1 - B.x0, 1.6, 0.4, GD); }
    for (const px of [142, 152, 163]) { const { g } = ctx.pick(px, B.z), y = hAt(px, B.z); g.notf(); for (const s of [-1, 1]) { g.box(px, (y + top) / 2 - 0.9, B.z + s * 4.6, 1.5, top - y, 1.5, 0xb8b4aa); ctx.col.push(world.addCircle(px, B.z + s * 4.6, 0.95)); g.quad([px - 0.7, top - 0.8, B.z + s * 3.9], [px + 0.7, top - 0.8, B.z + s * 3.9], [px + 0.7, top - 0.8, B.z], [px - 0.7, top - 0.8, B.z], 0xb8b4aa, [px, 50, B.z]); g.tri([px - 0.72, top - 0.8, B.z + s * 3.9], [px - 0.72, top - 0.8, B.z], [px - 0.72, top - 3.6, B.z + s * 3.9], 0xa8a49a, [px + 9, top, B.z]); g.tri([px + 0.72, top - 0.8, B.z + s * 3.9], [px + 0.72, top - 0.8, B.z], [px + 0.72, top - 3.6, B.z + s * 3.9], 0xa8a49a, [px - 9, top, B.z]); } }
    for (let x = B.x0 + 6; x < B.x1; x += 22) for (const s of [-1, 1]) { const { g, gl } = ctx.pick(x, B.z), z = B.z + s * (B.w / 2 - 0.5); g.notf(); gl.notf(); g.cyl(x, top, z, 0.1, 0.08, 3.6, 5, GD); g.box(x, top + 3.7, z, 0.4, 0.4, 0.4, 0xfff0c0); gl.box(x, top + 3.7, z, 0.5, 0.5, 0.5, 0xffe0a0); const yq = top + 0.09; gl.quad([x - 5, yq, z - 5], [x - 5, yq, z + 5], [x + 5, yq, z + 5], [x + 5, yq, z - 5], 0xffd9a0, [x, yq - 1, z], [[BLOB[0], BLOB[1]], [BLOB[0], BLOB[3]], [BLOB[2], BLOB[3]], [BLOB[2], BLOB[1]]]); }
  }
  /* Cathedral Park under the east end */
  P.stage(ctx, 206, 296, -Math.PI / 2, 0x6a7f9f); P.deck(ctx, 110, 292.6, 132, 295.4, 0.9);
  for (const [x, z, ry] of [[160, 270, 0], [182, 300, Math.PI], [140, 300, Math.PI / 2], [222, 282, 0.6]]) P.bench(ctx, x, z, ry);
  for (const [x, z] of [[150, 268], [176, 290], [200, 308], [226, 296], [136, 302]]) P.lamp(ctx, x, z, { h: 3.4, r: 6 });
  P.table(ctx, 172, 274, { picnic: true, ry: 0.3 }); P.table(ctx, 188, 278, { picnic: true, ry: 1.1 }); P.signpost(ctx, 146, 298, 'Off-Leash Area', { ry: Math.PI / 2 });
  for (const [x, z] of [[158, 302], [214, 270], [230, 306], [140, 272]]) tree('leafy', x, z, 1.1);
  /* Chimney Park: fenced off-leash park and Trick School */
  { const X0 = 166, Z0 = 318, X1 = 234, Z1 = 386, o = { col: C.woodL, h: 1.1 }; P.fence(ctx, X0, Z0, X1, Z0, o); P.fence(ctx, X0, Z1, X1, Z1, o); P.fence(ctx, X0, Z0, X0, Z1, o); P.fence(ctx, X1, Z0, X1, 346, o); P.fence(ctx, X1, 356, X1, Z1, o);
    P.agility(ctx, 176, 330); P.agility(ctx, 196, 362); P.bench(ctx, 172, 352, Math.PI / 2); P.bench(ctx, 200, 322, 0); P.bench(ctx, 214, 382, Math.PI); P.lamp(ctx, 230, 344, { h: 3.4 }); P.lamp(ctx, 230, 358, { h: 3.4 }); P.lamp(ctx, 170, 322, { h: 3.4 }); P.lamp(ctx, 170, 382, { h: 3.4 });
    const { g, y } = local(206, 344); g.box(0, 0.3, 0, 2.6, 0.6, 0.9, C.woodD); g.box(0, 0.56, 0, 2.3, 0.08, 0.6, 0x5fb0e0); g.notf(); ctx.col.push(world.addBox(204.7, 343.5, 207.3, 344.5, y + 0.6));
    for (const [x, z] of [[176, 372], [222, 326], [186, 344]]) tree('leafy', x, z, 1.1); }
  /* food cart pod: string lights, tables */
  { const X0 = 262, Z0 = 402, X1 = 304, Z1 = 456; for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1], [283, Z0], [283, Z1]]) { const { g, y } = local(x, z); g.cyl(0, 0, 0, 0.1, 0.1, 5, 5, C.woodD); g.notf(); ctx.col.push(world.addCircle(x, z, 0.15)); }
    const y = hAt(283, 430) + 4.9, T = { g: ctx.pick(283, 430).g, gl: ctx.pick(283, 430).gl };
    for (const [a, b] of [[[X0, Z0], [283, Z1]], [[283, Z0], [X1, Z1]], [[X1, Z0], [283, Z1]], [[283, Z0], [X0, Z1]], [[X0, Z0], [X1, Z0]], [[X0, Z1], [X1, Z1]]]) { const n = 12; T.g.notf(); T.gl.notf(); for (let i = 0; i < n; i++) { const f0 = i / n, f1 = (i + 1) / n, p = [lerp(a[0], b[0], f0), y - Math.sin(f0 * Math.PI) * 0.9, lerp(a[1], b[1], f0)], q = [lerp(a[0], b[0], f1), y - Math.sin(f1 * Math.PI) * 0.9, lerp(a[1], b[1], f1)]; T.g.quad(p, q, [q[0], q[1] + 0.05, q[2]], [p[0], p[1] + 0.05, p[2]], 0x3a3a3a, [p[0], p[1], p[2] + 3]); T.g.quad(p, q, [q[0], q[1] + 0.05, q[2]], [p[0], p[1] + 0.05, p[2]], 0x3a3a3a, [p[0], p[1], p[2] - 3]); T.g.box(p[0], p[1] - 0.1, p[2], 0.14, 0.16, 0.14, 0xfff0c0); T.gl.box(p[0], p[1] - 0.1, p[2], 0.26, 0.26, 0.26, 0xffd070); } }
    for (const z of [414, 428, 442]) { P.table(ctx, 283, z, { picnic: true, ry: Math.PI / 2 }); pool(ctx, 283, z, 6); } P.bin(ctx, 276, 456, 0x3f6f9f); P.bin(ctx, 290, 400); }
  /* Mt. Tabor summit */
  P.bench(ctx, 356, 432, 0); P.bench(ctx, 366, 448, Math.PI); P.lamp(ctx, 352, 446, { h: 3.4, col: C.woodD }); P.table(ctx, 370, 436, { picnic: true, ry: 0.5 });
  for (const [x, z] of [[346, 428], [374, 428], [378, 452], [344, 452]]) tree('fir', x, z, 1.5);
  for (const [x, z] of [[250, 280], [252, 330], [252, 380], [238, 440], [200, 464], [300, 466]]) P.lamp(ctx, x, z);
  /* ---------- Hawthorne Bridge: a low steel truss with two lift towers ---------- */
  { const B = MORRISON, top = B.top, ST = 0x6f8f6a; deck('x', B.x0, B.x1, B.z, B.w, top, 0x666a72);
    const { g } = ctx.pick(132, B.z); g.notf();
    for (const s of [-1, 1]) { const z = B.z + s * (B.w / 2 + 0.25); g.box((B.x0 + B.x1) / 2, top + 6, z, B.x1 - B.x0 - 16, 0.4, 0.4, ST);
      for (let x = B.x0 + 8; x < B.x1 - 8; x += 8) { g.box(x, top + 3, z, 0.3, 6, 0.3, ST); const x1 = Math.min(B.x1 - 8, x + 8), up = Math.round((x - B.x0) / 8) % 2; g.quad([x, top + (up ? 0 : 6) - 0.15, z], [x1, top + (up ? 6 : 0) - 0.15, z], [x1, top + (up ? 6 : 0) + 0.15, z], [x, top + (up ? 0 : 6) + 0.15, z], ST, [x, top, z + s * 9]); g.quad([x, top + (up ? 0 : 6) - 0.15, z], [x1, top + (up ? 6 : 0) - 0.15, z], [x1, top + (up ? 6 : 0) + 0.15, z], [x, top + (up ? 0 : 6) + 0.15, z], ST, [x, top, z - s * 9]); }
      for (const tx of [112, 152]) { g.box(tx, top + 9, z, 1.0, 18, 1.0, ST); g.box(tx, top + 14, z - s * 0.2, 2.2, 3.0, 1.2, 0x4a4f58); ctx.col.push(world.addCircle(tx, z + s * 0.4, 0.7)); } }
    for (const tx of [112, 152]) { g.box(tx, top + 18.2, B.z, 1.4, 0.6, B.w + 1.4, ST); g.box(tx, 0.9, B.z, 3, 5.8, B.w + 2, C.stoneD); ctx.col.push(world.addBox(tx - 1.5, B.z - B.w / 2 - 1, tx + 1.5, B.z + B.w / 2 + 1, 3.3)); }
    P.signpost(ctx, 82, 477, 'Hawthorne Bridge', { ry: Math.PI / 2 }); }
  /* ---------- Tilikum Crossing: the car-free bridge, drawn as a plain white cable-stayed span, with the Heron Line track and its two stops ---------- */
  { const B = TILIKUM, top = B.top, WH = 0xf0f1ec; deck('x', B.x0, B.x1, B.z, B.w, top, 0xb4afa3, { noDash: true, rail: 0xdfe3e6 });
    const cable = (g, xa, ya, xb, yb, z) => { for (const r of [9, -9]) g.quad([xa, ya - 0.05, z], [xb, yb - 0.05, z], [xb, yb + 0.05, z], [xa, ya + 0.05, z], 0xe4e6e2, [(xa + xb) / 2, ya, z + r]); };
    for (const tx of [104, 138]) { const { g } = ctx.pick(tx, B.z); g.notf();
      for (const s of [-1, 1]) { const z = B.z + s * (B.w / 2 + 0.75); g.box(tx, 0.5, z, 2.8, 7.4, 1.7, C.stoneD, C.stone); g.box(tx, top + 10.5, z, 0.95, 21, 0.95, WH); g.cyl(tx, top + 21, z, 0.62, 0.12, 2.2, 4, WH);
        ctx.col.push(world.addBox(tx - 1.4, z - 0.85, tx + 1.4, z + 0.85, 60, -9));
        for (const dir of [-1, 1]) for (let k = 1; k <= 4; k++) cable(g, tx, top + 11 + k * 2.4, tx + dir * k * 4.1, top + 1.1, z - s * 0.55); }
      g.box(tx, top + 14.5, B.z, 0.7, 0.7, B.w + 1.5, WH); footprints.push([tx - 1.4, B.z - 6.2, tx + 1.4, B.z + 6.2]); }
    /* tram track: two rails in the paving from stop to stop */
    for (let x = TRAM.x0 - 4; x < TRAM.x1 + 4; x += 4) for (const s of [-0.72, 0.72]) { const x1 = Math.min(TRAM.x1 + 4, x + 4), z = TRAM.z + s, g = ctx.pick(x + 2, z).g, y0 = world.groundAt(x, z, 50) + 0.035, y1 = world.groundAt(x1, z, 50) + 0.035; g.notf(); g.quad([x, y0, z - 0.07], [x, y0, z + 0.07], [x1, y1, z + 0.07], [x1, y1, z - 0.07], 0x6f747c, [x, y0 - 50, z]); }
    for (const st of TRAM.stops) { const sx = st.x, sz = TRAM.z - 3.6, { g, gl, y } = local(sx, sz);
      g.box(0, 0.12, 1.2, 9, 0.24, 2.6, 0xd8d2c4); for (const s of [-3.6, 3.6]) g.box(s, 1.5, -0.6, 0.16, 2.8, 0.16, C.metal); g.box(0, 2.95, 0, 8.2, 0.14, 2.4, 0x4f8f8a, 0x5fa39d); g.box(0, 1.6, -0.66, 7, 1.7, 0.06, 0x9fc4d8);
      g.box(0, 0.5, -0.2, 3.2, 0.1, 0.5, C.woodL); for (const s of [-1.4, 1.4]) g.box(s, 0.37, -0.2, 0.1, 0.5, 0.45, C.metal);
      board(g, 'Heron Line  ·  ' + st.name, 2.55, 1.22, 6.4, 0.5, { bg: '#2f5f5a', fg: '#fff7df', size: 28 }); gl.box(0, 2.82, 0, 6, 0.06, 1.6, 0xffe6b0); g.notf(); gl.notf();
      ctx.col.push(world.addCircle(sx - 3.6, sz - 0.6, 0.2), world.addCircle(sx + 3.6, sz - 0.6, 0.2), world.addBox(sx - 1.6, sz - 0.45, sx + 1.6, sz + 0.05, y + 0.55), world.addBox(sx - 4.5, sz - 0.1, sx + 4.5, sz + 2.5, y + 0.24));
      view(ctx, { box: [sx - 4.3, sz - 1.4, sx + 4.3, sz + 1.4], bottom: y + 2.5, top: y + 3.4 }); pool(ctx, sx, sz + 1.6, 6); }
  }
  /* ---------- Portland west side ---------- */
  for (let z = 306; z <= 500; z += 24) { P.lamp(ctx, -93.4, z); P.lamp(ctx, -106.6, z + 12); if (z > 300) P.lamp(ctx, -1.4, z + 6); }
  for (const x of [-80, -56, -32, -8]) { P.lamp(ctx, x, 384); P.lamp(ctx, x + 12, 476); }
  P.roadsign(ctx, -93.6, 383.6, 'Burnside St', 'Highway 30'); P.roadsign(ctx, -1.6, 383.6, 'Burnside St', 'Naito Pkwy'); P.roadsign(ctx, -1.6, 463.6, 'Hawthorne Blvd', 'Naito Pkwy'); P.roadsign(ctx, -93.6, 463.6, 'Hawthorne Blvd', 'Highway 30');
  for (const [x, z, ry] of [[-92, 420, Math.PI / 2], [-92, 444, Math.PI / 2], [-3, 420, -Math.PI / 2], [-60, 381.6, 0], [-40, 381.6, 0]]) P.bench(ctx, x, z, ry);
  for (const z of [318, 342, 366, 414, 438, 486]) tree('leafy', -92.6, z, 0.75); for (const z of [330, 354, 414, 438]) tree('leafy', -2.4, z, 0.75);
  P.bin(ctx, -92, 396); P.bin(ctx, -3, 398, 0x3f6f9f); P.hydrant(ctx, -93, 462); P.postbox(ctx, -4, 478);
  /* Pioneer Courthouse Square: brick steps in an arc, podium, planters (no sculptures) */
  { const cx = -34, cz = 430, y = hAt(-50, 430);
    for (let s = 0; s < 4; s++) { const r = 34 - s * 3.2, n = 12; for (let i = 0; i < n; i++) { const a = Math.PI * 0.62 + (i + 0.5) / n * Math.PI * 0.76, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * 0.82; if (x < -85 || z < 402 || z > 458) continue; const { g } = ctx.pick(x, z); g.tf(x, y, z, 0, -a + Math.PI / 2, 0); g.box(0, (4 - s) * 0.16, 0, r * 0.215, (4 - s) * 0.32, 3.1, s % 2 ? 0xa85a44 : 0xb5694f, 0xc27a5f); g.notf(); ctx.col.push(world.addCircle(x, z, 1.9, y + (4 - s) * 0.32)); } }
    const { g, gl } = local(-28, 430); g.cyl(0, 0, 0, 3.2, 3.2, 0.5, 10, 0xa85a44, 0xc9c0ae); gl.cyl(0, 0.5, 0, 0.3, 0.3, 0.1, 6, 0xffe0a0); g.notf(); gl.notf(); ctx.col.push(world.addCircle(-28, 430, 3.2, y + 0.5)); pool(ctx, -28, 430, 8);
    for (const [x, z] of [[-20, 406], [-20, 454], [-60, 404.5], [-60, 455.5]]) P.planter(ctx, x, z, 3, 1); for (const [x, z] of [[-16, 418], [-16, 442], [-44, 404], [-44, 456], [-78, 430]]) P.lamp(ctx, x, z, { h: 3.6, r: 7 });
    P.table(ctx, -40, 412, { umbrella: C.red }); P.table(ctx, -48, 448, { umbrella: 0xfff0c0 }); P.table(ctx, -34, 448, { umbrella: C.blue }); P.flag(ctx, -18, 430, 0x3f7f4f, 9); P.noticeboard(ctx, -70, 458.6, Math.PI, 'ADOPTION DAY'); }
  /* Waterfront Park: generic fountain, promenade, lawn trees */
  P.fountain(ctx, 40, 414, 4.6); for (const a of [0.8, 2.35, 3.95, 5.5]) P.bench(ctx, 40 + Math.cos(a) * 8.5, 414 + Math.sin(a) * 8.5, Math.atan2(-Math.cos(a), -Math.sin(a)));
  along('promenade', 5, (x, z, nx, nz, i) => { const s = i % 2 ? 1 : -1; P.lamp(ctx, x + nx * 3 * s, z + nz * 3 * s, { h: 3.4, r: 6 }); if (i % 3 === 0) P.bench(ctx, x - nx * 3.2, z - nz * 3.2, Math.atan2(nx, nz)); }, 2);
  for (const [x, z] of [[18, 320], [20, 348], [18, 376], [22, 440], [18, 464], [30, 336], [34, 370], [52, 396], [58, 446], [30, 456]]) tree('leafy', x, z, 1.0 + R() * 0.3);
  P.stage(ctx, 28, 384, Math.PI / 2, 0x7a5f8f); P.table(ctx, 38, 450, { picnic: true, ry: 0.2 }); P.table(ctx, 52, 468, { picnic: true, ry: 1.4 });
  /* Bridgeside Makers Market: bunting over the stalls */
  { const y = hAt(46, 487) + 4.4; for (let x = 16; x < 76; x += 12) hang({ g: ctx.pick(x, 487).g, gl: ctx.pick(x, 487).gl }, [x, y, 479], [x + 12, y, 479], 9, 0.5, 'flag', FLAGC);
    for (let x = 16; x <= 76; x += 12) { const { g } = local(x, 479); g.cyl(0, 0, 0, 0.08, 0.08, 4.5, 5, C.woodD); g.notf(); ctx.col.push(world.addCircle(x, 479, 0.12)); }
    const { g } = local(12, 488, Math.PI / 2); for (const s of [-4, 4]) g.box(s, 2.2, 0, 0.3, 4.4, 0.3, C.woodD); g.box(0, 4.2, 0, 8.6, 1.0, 0.3, C.woodL); board(g, 'Bridgeside Makers Market', 4.2, 0.17, 8.2, 0.8, { bg: '#3f4f6f' }); g.tf(12, hAt(12, 488), 488, 0, -Math.PI / 2, 0); board(g, 'Bridgeside Makers Market', 4.2, 0.17, 8.2, 0.8, { bg: '#3f4f6f' }); g.notf(); ctx.col.push(world.addCircle(12, 484, 0.3), world.addCircle(12, 492, 0.3)); }
  for (const s of SIGNPOSTS) P.signpost(ctx, s.x, s.z, s.title, { ry: s.ry || 0, bg: '#6a4a2e' });

  /* ---------- crisp ground paint: zebra stripes, road lines and paving joints as thin geometry (the ground texture is too coarse for lines this fine) ---------- */
  { const dry = (x, z) => inMap(x, z) && hAt(x, z) > 0.35 && world.groundAt(x, z, 60) < hAt(x, z) + 0.3;
    for (const [cx, cz, ns] of CROSSWALKS) for (let s = -3.6; s <= 3.6; s += 1.6) ns ? strip(cx + s, cz - 1.6, cx + s, cz + 1.6, 0.9, 0xf0f0ea, 0.05) : strip(cx - 1.6, cz + s, cx + 1.6, cz + s, 0.9, 0xf0f0ea, 0.05);
    for (const r of world.roads) { if (r.kind !== 'road') continue;
      if (r.id === 'hwy30') walk(r.path, 3, (x, z, ux, uz) => { if (!dry(x, z) || !dry(x + ux * 3, z + uz * 3)) return; for (const [o, w, c] of [[-0.24, 0.16, 0xf0d98a], [0.24, 0.16, 0xf0d98a], [-(r.w / 2 - 0.55), 0.2, 0xeeeee8], [r.w / 2 - 0.55, 0.2, 0xeeeee8]]) strip(x - uz * o, z + ux * o, x - uz * o + ux * 3, z + ux * o + uz * 3, w, c, 0.065); });
      else walk(r.path, 4.8, (x, z, ux, uz) => { if (!dry(x, z) || !dry(x + ux * 2.3, z + uz * 2.3)) return; for (const [cx, cz, ns] of CROSSWALKS) if (Math.abs(x + ux - cx) < 3.4 && Math.abs(z + uz - cz) < 3.4) return; strip(x, z, x + ux * 2.3, z + uz * 2.3, 0.2, 0xf0d98a, 0.06); }); }
    for (const [x0, z0, x1, z1, col] of [[-198, -274, -146, -228, 0x9f8c77], [-86, 400, -14, 460, 0x9c5642]]) { for (let a = x0 + 4; a < x1; a += 4) for (let b = z0; b < z1; b += 8) strip(a, b, a, Math.min(z1, b + 8), 0.09, col, 0.035); for (let a = z0 + 4; a < z1; a += 4) for (let b = x0; b < x1; b += 8) strip(b, a, Math.min(x1, b + 8), a, 0.09, col, 0.035); } }

  /* ---------- Fog Bell Festival layer (hidden until the festival flag is set) ---------- */
  for (let z = -328; z <= -198; z += 13) hang(fest, [-213.6, hAt(-213, z) + 7.7, z], [-196.4, hAt(-197, z) + 7.7, z + 6.5], 12, 0.7, (Math.round(z) % 2) ? 'lantern' : 'flag', (Math.round(z) % 2) ? LANC : FLAGC);
  for (let z = -326; z <= -206; z += 24) hang(fest, [-147.4, hAt(-147, z) + 7.4, z], [-133, hAt(-133, z) + 7.4, z + 8], 10, 0.7, 'flag', FLAGC);
  /* strings along the north and south edges of the plaza only, hung high: nothing dangles between the street-side camera and KC */
  for (const [a, b] of [[[-198, -274], [-146, -274]], [[-198, -228], [-146, -228]]]) { const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 13); for (let i = 0; i < n; i++) { const p = [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)], q = [lerp(a[0], b[0], (i + 1) / n), lerp(a[1], b[1], (i + 1) / n)]; hang(fest, [p[0], hAt(p[0], p[1]) + 6.9, p[1]], [q[0], hAt(q[0], q[1]) + 6.9, q[1]], 9, 0.7, i % 2 ? 'flag' : 'lantern', i % 2 ? FLAGC : LANC); fest.g.notf(); fest.g.cyl(p[0], hAt(p[0], p[1]), p[1], 0.07, 0.05, 7.0, 5, C.woodD); if (i === n - 1) fest.g.cyl(q[0], hAt(q[0], q[1]), q[1], 0.07, 0.05, 7.0, 5, C.woodD); } }
  for (const b of BUILDINGS) if (b.kind === 'shop' && b.z < -100 && b.x > -240) { const s = b.f === 'n' ? -1 : b.f === 's' ? 1 : 0, e = b.f === 'w' ? -1 : b.f === 'e' ? 1 : 0; for (const o of [-3.2, 3.4]) P.pumpkin(festCtx, b.x + (s ? o : e * (b.w / 2 + 1.1)), b.z + (s ? s * (b.d / 2 + 1.1) : o), 0.9 + R() * 0.5, true, fest); }
  for (const [x, z] of [[-196, -272], [-148, -272], [-196, -230], [-148, -230], [-160, -288], [-172, -288], [-128, -244], [-128, -256]]) { P.haybale(festCtx, x, z, R() * 3, 1); const y = hAt(x, z) + 0.9; fest.g.tf(x, y, z, 0, R() * 6, 0, 1.0); fest.g.ball(0, 0.26, 0, 0.36, 0.28, 0.36, C.orange, 7, 4, true); fest.g.cyl(0, 0.5, 0, 0.05, 0.03, 0.14, 4, 0x4f7f3f); fest.g.notf(); P.pumpkin(festCtx, x + 1.3, z + 0.4, 0.8, true, fest); P.pumpkin(festCtx, x - 1.2, z - 0.5, 1.1, true, fest);
    fest.g.tf(x + 0.9, hAt(x, z), z - 1.0, 0, R() * 3, 0.12); for (let k = 0; k < 5; k++) fest.g.cyl((k - 2) * 0.09, 0, (k % 2) * 0.1, 0.03, 0.01, 2.2 + (k % 3) * 0.3, 3, 0xc9b24a); fest.g.notf(); }
  for (let z = -320; z <= -206; z += 19) { const x = -100.6, y = hAt(x, z); fest.g.notf(); fest.g.cyl(x, y, z, 0.05, 0.05, 1.5, 4, C.woodD); fest.g.cyl(x, y + 1.5, z, 0.2, 0.2, 0.44, 6, LANC[Math.abs(Math.round(z)) % 5], 0x3a2a1a); fest.gl.notf(); fest.gl.box(x, y + 1.72, z, 0.44, 0.48, 0.44, LANC[Math.abs(Math.round(z)) % 5]); }
  /* the festival arch spans S 1st Street with a post on each pavement; its colliders exist only while the festival is on */
  const ARCH = { x: -205, z: -226, half: 6.0 };
  { const { g } = fest, ay = hAt(ARCH.x, ARCH.z); g.tf(ARCH.x, ay, ARCH.z, 0, 0, 0); for (const s of [-ARCH.half, ARCH.half]) g.box(s, 3.3, 0, 0.34, 6.6, 0.34, C.woodD); g.box(0, 6.4, 0, ARCH.half * 2 + 0.6, 1.1, 0.2, 0x3a2f4a); board(g, 'Fog Bell Festival', 6.4, 0.12, 11, 0.9, { bg: '#3a2f4a', fg: '#ffd27a' }); g.tf(ARCH.x, ay, ARCH.z, 0, Math.PI, 0); board(g, 'Fog Bell Festival', 6.4, 0.12, 11, 0.9, { bg: '#3a2f4a', fg: '#ffd27a' }); g.notf(); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; P.pumpkin(festCtx, -150 + Math.cos(a) * 6.5, -150 + Math.sin(a) * 4.6 + 1.5, 0.9 + R() * 0.5, true, fest); }
  hang(fest, [-154.3, hAt(-150, -150) + 5, -147], [-145.7, hAt(-150, -150) + 5, -147], 8, 0.5, 'flag', FLAGC);

  /* the courthouse clock chimes the hour across old town */
  { let lastH = -1; anim.push((dt, night, t, cam) => { const h = Math.floor(world.time); if (h === lastH) return; const first = lastH < 0; lastH = h; if (first || !game.kc) return; const d = Math.hypot(game.kc.pos.x - COURTHOUSE.x, game.kc.pos.z - COURTHOUSE.z); if (d < 260) { const n = ((h + 11) % 12) + 1; for (let i = 0; i < Math.min(n, 4); i++) setTimeout(() => game.audio && game.audio.sfx('bell', { vol: clamp(1 - d / 260, 0.15, 1) * 0.7 }), i * 900); game.bus.emit('chime', { hour: h }); } }); }

  /* ---------- build meshes ---------- */
  const meshes = [], glowMeshes = [];
  for (const [, c] of chunks) {
    if (c.g.tris) { const m = new THREE.Mesh(c.g.build(), material); m.matrixAutoUpdate = false; m.receiveShadow = true; m.name = 'static'; scene.add(m); meshes.push(m); }
    if (c.gl.tris) { const m = new THREE.Mesh(c.gl.build(), glowMat); m.matrixAutoUpdate = false; m.renderOrder = 3; m.name = 'glow'; scene.add(m); glowMeshes.push(m); }
  }
  /* lantern light is an additive glow like the lit windows: faint by day, full after dark, so the lanterns read as shaded paper lanterns and not as flat squares */
  const festGlow = glowMat.clone(); festGlow.opacity = 0.2;
  const festTris = fest.g.tris + fest.gl.tris;
  const fm = new THREE.Mesh(fest.g.build(), material), fg = new THREE.Mesh(fest.gl.build(), festGlow); fg.renderOrder = 3; fm.name = 'festival'; fg.name = 'festival-glow'; fm.matrixAutoUpdate = fg.matrixAutoUpdate = false; fm.visible = fg.visible = false; scene.add(fm, fg);
  chunks.clear();   /* the builders have handed their data to the GPU buffers */
  const cullable = [...meshes, ...glowMeshes, fm, fg].map(m => ({ m, s: m.geometry.boundingSphere, glow: m.name === 'glow', fest: m === fm || m === fg }));

  let t = 0, festOn = false, archCol = [];
  const api = {
    material, glowMat, footprints, decks, makeSign, builders: P, tris: () => meshes.reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0), festivalTris: festTris,
    setShadows(on) { for (const m of meshes) m.castShadow = on; },
    setFestival(on) { festOn = !!on; fm.visible = fg.visible = festOn; for (const c of archCol) c.remove(); archCol = festOn ? [world.addCircle(ARCH.x - ARCH.half, ARCH.z, 0.3), world.addCircle(ARCH.x + ARCH.half, ARCH.z, 0.3)] : []; },
    get festival() { return festOn; },
    update(dt, night, cam, far = 250) {
      t += dt; glowMat.opacity = night; festGlow.opacity = 0.2 + 0.8 * night;
      /* distance culling: a chunk is skipped once the fog has swallowed it */
      for (const c of cullable) { const d = Math.hypot(cam.x - c.s.center.x, cam.z - c.s.center.z) - c.s.radius; c.m.visible = d < far + 12 && (!c.glow || night > 0.02) && (!c.fest || festOn); }
      for (const f of anim) f(dt, night, t, cam);
    },
    /* runtime props for other modules: returns { mesh, remove() } */
    spawn(kind, x, z, opts = {}) {
      const g = new Geo(), gl = new Geo(), c = { pick: () => ({ g, gl }), col: [], solid: opts.solid !== false, views: [], extra: [], anims: [] };
      const fn = P[kind]; if (!fn) throw new Error('unknown prop ' + kind);
      if (kind === 'building' || kind === 'stall') fn(c, { ...opts, x, z }); else if (kind === 'signpost') fn(c, x, z, opts.text || '', opts); else if (kind === 'fence' || kind === 'hedge') fn(c, x, z, opts.x1, opts.z1, opts);
      else if (kind === 'deck') fn(c, x, z, opts.x1, opts.z1, opts.top ?? 1, opts); else if (kind === 'tent' || kind === 'umbrella' || kind === 'bin' || kind === 'mailbox' || kind === 'flag' || kind === 'marker') fn(c, x, z, opts.col, opts.ry ?? opts.h);
      else if (kind === 'bench' || kind === 'log') fn(c, x, z, opts.ry || 0, opts.len); else if (kind === 'pumpkin' || kind === 'boulder' || kind === 'crate') fn(c, x, z, opts.s || 1, !!opts.deco); else if (kind === 'haybale') fn(c, x, z, opts.ry || 0, opts.stack || 1);
      else if (kind === 'cart') fn(c, x, z, opts.name || 'Cart', opts.col || 0xf0b860, opts.ry || 0); else if (kind === 'noticeboard') fn(c, x, z, opts.ry || 0, opts.title || 'NOTICES'); else if (kind === 'stage') fn(c, x, z, opts.ry || 0, opts.col); else if (kind === 'fountain') fn(c, x, z, opts.r); else fn(c, x, z, opts);
      const group = new THREE.Group(); const m = new THREE.Mesh(g.build(), material); m.receiveShadow = true; group.add(m);
      if (gl.tris) { const m2 = new THREE.Mesh(gl.build(), glowMat); m2.renderOrder = 3; group.add(m2); }
      scene.add(group);
      let gone = false;
      return { mesh: group, colliders: c.col, remove() {
        if (gone) return; gone = true;
        scene.remove(group); for (const k of group.children) k.geometry.dispose();
        for (const e of c.extra) { scene.remove(e); e.geometry.dispose(); if (e.material && e.material !== material && e.material !== glowMat) e.material.dispose(); }
        for (const f of c.anims) { const i = anim.indexOf(f); if (i >= 0) anim.splice(i, 1); }
        for (const v of c.views) v.remove(); for (const k of c.col) k.remove();
      } };
    }
  };
  return api;
}
