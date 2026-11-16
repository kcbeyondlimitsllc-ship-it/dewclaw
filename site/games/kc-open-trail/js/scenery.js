/* Buildings, street furniture and landmarks for Cedar Hollow, baked into a few
   vertex-coloured chunk meshes (plus one additive "glow" mesh per chunk for
   lit windows and lamp pools at night). All names are made up for this game. */
import { THREE, Geo, rng, TAU } from './util.js';
import { EXT, BUILDINGS, STALLS, SIGNPOSTS, FLOWER_BEDS, LOOKOUT, riverX, WATER_Y, ROADS } from './data.js';

const CH = 170, NCH = Math.ceil((EXT * 2) / CH);
const C = { wood: 0x9a6a42, woodD: 0x6e4a2e, woodL: 0xc49a6a, stone: 0x9a9a94, stoneD: 0x77777a, metal: 0x4a4f58, white: 0xf4f4ef, glass: 0x9fc4d8, door: 0x6a4630, red: 0xd9534f, green: 0x4f8f4f, yellow: 0xf0c040, blue: 0x3f7fd6, orange: 0xf08a2a, dark: 0x2a2c30, leaf: 0x4f9a4f, hay: 0xe0c060, sand: 0xdcc890, pink: 0xf08fb0 };

export function buildScenery(game, world) {
  const { scene } = game;
  /* ---------- sign atlas ---------- */
  const AT = 1024, atlasCv = document.createElement('canvas'); atlasCv.width = atlasCv.height = AT; const ax = atlasCv.getContext('2d');
  ax.fillStyle = '#fff'; ax.fillRect(0, 0, AT, 36);
  { const gr = ax.createRadialGradient(960, 104, 2, 960, 104, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ax.fillStyle = '#000'; ax.fillRect(894, 38, 130, 132); ax.fillStyle = gr; ax.fillRect(896, 40, 128, 128); }
  const BLOB = [896 / AT, 1 - 168 / AT, 1, 1 - 40 / AT];
  let shelfX = 2, shelfY = 40; const ROWH = 60;
  const atlasTex = new THREE.CanvasTexture(atlasCv); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
  const signCache = new Map();
  function makeSign(text, o = {}) {
    const ck = text + '|' + (o.bg || '') + '|' + (o.fg || '') + '|' + (o.size || ''); if (signCache.has(ck)) return signCache.get(ck);
    const r = makeSign0(text, o); signCache.set(ck, r); return r;
  }
  function makeSign0(text, o = {}) {
    const font = `800 ${o.size || 34}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ax.font = font; const w = Math.min(860, Math.ceil(ax.measureText(text).width) + 36);
    const limit = shelfY < 172 ? 890 : AT - 2;
    if (shelfX + w > limit) { shelfX = 2; shelfY += ROWH + 4; }
    if (shelfY + ROWH > AT) return { u0: 0.4, v0: 0.99, u1: 0.6, v1: 0.995, aspect: 4 };
    const x = shelfX, y = shelfY; shelfX += w + 4;
    ax.fillStyle = o.bg || '#2f3a33'; ax.fillRect(x, y, w, ROWH);
    ax.strokeStyle = o.fg || '#fff7df'; ax.lineWidth = 3; ax.strokeRect(x + 4.5, y + 4.5, w - 9, ROWH - 9);
    ax.fillStyle = o.fg || '#fff7df'; ax.font = font; ax.textAlign = 'center'; ax.textBaseline = 'middle'; ax.fillText(text, x + w / 2, y + ROWH / 2 + 2, w - 24);
    atlasTex.needsUpdate = true;
    return { u0: (x + 1) / AT, v0: 1 - (y + ROWH - 1) / AT, u1: (x + w - 1) / AT, v1: 1 - (y + 1) / AT, aspect: w / ROWH };
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTex });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, map: atlasTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  /* ---------- chunk geos ---------- */
  const chunks = new Map();
  const chunkAt = (x, z) => { const k = Math.floor((x + EXT) / CH) + NCH * Math.floor((z + EXT) / CH); let c = chunks.get(k); if (!c) chunks.set(k, c = { g: new Geo(), gl: new Geo() }); return c; };
  const hallow = { g: new Geo(), gl: new Geo() };
  const footprints = [], decks = [], anim = [];
  const hAt = (x, z) => world.heightAt(x, z);
  const R = rng(4242);

  /* ctx: where a builder writes. Baked props go to chunks, spawned props to their own geo. */
  const baked = { pick: (x, z) => chunkAt(x, z), col: [], solid: true };
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

  P.building = (ctx, b) => {
    const { g, gl } = ctx.pick(b.x, b.z), y0 = hAt(b.x, b.z), ry = ryOf(b.f), side = b.f === 'e' || b.f === 'w';
    const lw = side ? b.d : b.w, ld = side ? b.w : b.d, h = b.h, zf = ld / 2, lit = () => R() < 0.7;
    g.tf(b.x, y0, b.z, 0, ry, 0); gl.tf(b.x, y0, b.z, 0, ry, 0);
    g.box(0, h / 2 - 1, 0, lw, h + 2, ld, b.col);
    g.box(0, 0.25, 0, lw + 0.12, 0.5, ld + 0.12, C.stoneD);
    const roofCol = b.roofCol || 0x5a5f66;
    if (b.roof === 'gable') { g.gable(0, h, 0, lw + 1.2, ld + 1.2, b.kind === 'barn' ? 4.2 : 2.8, roofCol, true, b.col); }
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
    g.notf(); gl.notf();
    if (ctx.solid) ctx.col.push(world.addBox(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2));
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
    const { g, gl } = ctx.pick(s.x, s.z), y = hAt(s.x, s.z); g.tf(s.x, y, s.z);
    g.box(0, 0.5, 0, 4, 1.0, 1.6, C.woodL, C.woodD); for (const [px, pz] of [[-1.9, -0.7], [1.9, -0.7], [-1.9, 0.7], [1.9, 0.7]]) g.box(px, 1.5, pz, 0.12, 3, 0.12, C.woodD);
    for (let i = 0; i < 6; i++) { const x0 = -2.2 + i * (4.4 / 6), x1 = x0 + 4.4 / 6, col = i % 2 ? 0xffffff : s.col; g.quad([x0, 3.0, -1], [x1, 3.0, -1], [x1, 3.4, 0], [x0, 3.4, 0], col, [0, 0, 0]); g.quad([x0, 3.0, 1.2], [x1, 3.0, 1.2], [x1, 3.4, 0], [x0, 3.4, 0], col, [0, 0, 0]); }
    board(g, s.name, 2.6, 0.9, 3.6, 0.6, { bg: '#fff7df', fg: '#3a2a1a' });
    for (let i = 0; i < 5; i++) g.box(-1.5 + i * 0.75, 1.1, 0.2, 0.5, 0.2, 0.5, [s.col, C.yellow, C.woodL, C.white, C.orange][i]);
    gl.tf(s.x, y, s.z); gl.box(0, 2.9, 0, 0.3, 0.2, 0.3, 0xffe0a0); gl.notf(); g.notf(); pool(ctx, s.x, s.z + 1.5, 4);
    if (ctx.solid) ctx.col.push(world.addBox(s.x - 2, s.z - 0.8, s.x + 2, s.z + 0.8, y + 1.0));
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
    const flame = new THREE.Mesh(fg.build(), new THREE.MeshBasicMaterial({ vertexColors: true })); flame.position.set(x, y + 0.2, z); scene.add(flame);
    anim.push((dt, night, t) => { flame.scale.set(1 + Math.sin(t * 11) * 0.12, 0.9 + Math.sin(t * 17 + 1) * 0.2 + night * 0.25, 1 + Math.cos(t * 13) * 0.12); flame.rotation.y = t * 2; });
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
  P.pumpkin = (ctx, x, z, s = 1, face = false, tgt = null) => { const t = tgt || ctx.pick(x, z), y = world.groundAt(x, z, 50); t.g.tf(x, y, z, 0, R() * 6, 0, s); t.g.ball(0, 0.26, 0, 0.36, 0.28, 0.36, C.orange, 7, 4, true); t.g.cyl(0, 0.5, 0, 0.05, 0.03, 0.14, 4, 0x4f7f3f); if (face) { t.gl.tf(x, y, z, 0, 0, 0, s); for (const a of [0, 1.57, 3.14, 4.71]) { const cx = Math.cos(a) * 0.37, cz = Math.sin(a) * 0.37; t.gl.box(cx, 0.3, cz, 0.16, 0.12, 0.16, 0xffc040); } t.gl.notf(); } t.g.notf(); };
  P.haybale = (ctx, x, z, ry = 0, stack = 1) => { const { g } = ctx.pick(x, z), y = hAt(x, z); for (let i = 0; i < stack; i++) { g.tf(x, y + i * 0.9, z, 0, ry + i * 0.3, 0); g.box(0, 0.45, 0, 1.8, 0.9, 1.0, C.hay, 0xecd070); } g.notf(); if (ctx.solid) ctx.col.push(world.addBox(x - 0.8, z - 0.8, x + 0.8, z + 0.8, y + stack * 0.9)); };
  P.boulder = (ctx, x, z, s = 1.4) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z, 0, R() * 6, 0, s); g.ball(0, 0.4, 0, 1, 0.75, 0.85, C.stone, 6, 4, true); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.85 * s, y + 1.05 * s)); };
  P.flag = (ctx, x, z, col = C.blue, h = 7) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 0.08, 0.06, h, 5, C.white); g.box(0.75, h - 0.5, 0, 1.4, 0.9, 0.04, col); g.box(0.75, h - 0.5, 0, 0.5, 0.5, 0.06, 0xfff0c0); g.notf(); if (ctx.solid) ctx.col.push(world.addCircle(x, z, 0.15)); };
  P.crate = (ctx, x, z, s = 0.9, col = C.woodL) => { const { g } = ctx.pick(x, z), y = world.groundAt(x, z, 50); g.tf(x, y, z, 0, R(), 0); g.box(0, s / 2, 0, s, s, s, col, C.woodD); g.notf(); if (ctx.solid) ctx.col.push(world.addBox(x - s / 2, z - s / 2, x + s / 2, z + s / 2, y + s)); };
  P.marker = (ctx, x, z, col = C.yellow) => { const { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.box(0, 0.45, 0, 0.14, 0.9, 0.14, C.woodD); g.box(0, 0.95, 0, 0.2, 0.2, 0.2, col); g.notf(); };

  /* ================= place everything ================= */
  const ctx = baked;
  for (const b of BUILDINGS) P.building(ctx, b);
  /* Main Street furniture */
  for (const x of [-90, -66, -42, -22, 2, 26, 50, 74, 96]) P.lamp(ctx, x, 34.3);
  for (const x of [-78, -54, -30, 14, 38, 62, 86]) P.lamp(ctx, x, 45.7);
  for (const [x, z, ry] of [[-74, 31.2, 0], [-54, 31.2, 0], [22, 31.2, 0], [42, 31.2, 0], [-74, 48.8, Math.PI], [-54, 48.8, Math.PI]]) P.bench(ctx, x, z, ry);
  for (const [x, z] of [[-34.5, 31], [1, 31], [62, 31], [-34.5, 49]]) P.planter(ctx, x, z);
  P.hydrant(ctx, -18, 33.4); P.hydrant(ctx, 84, 46.6); P.hydrant(ctx, -18, -15); P.hydrant(ctx, 60, -24.6);
  P.bin(ctx, -70, 31); P.bin(ctx, 26, 31, 0x3f6f9f); P.bin(ctx, -50, 49); P.bin(ctx, 46, 66, 0x3f6f9f);
  P.postbox(ctx, -92, 48.6);
  P.table(ctx, 47, 31.4, { umbrella: C.green }); P.table(ctx, 57, 31.4, { umbrella: 0xfff0c0 });
  P.roadsign(ctx, -16.5, 34, 'Main St', 'Cedar Ave'); P.roadsign(ctx, 93, 34, 'Main St', 'Fern Ln'); P.roadsign(ctx, -16.5, -14, 'Fern Ln', 'Cedar Ave'); P.roadsign(ctx, -98, 47, 'Main St', 'Pinecone Rd');
  P.flag(ctx, 60.5, 31, C.blue, 8);
  /* welcome arch west of town */
  { const { g } = ctx.pick(-112, 40), y = hAt(-112, 40); g.tf(-112, y, 40, 0, Math.PI / 2, 0); for (const s of [-6.4, 6.4]) g.box(s, 2.8, 0, 0.5, 5.6, 0.5, C.woodD); g.box(0, 5.4, 0, 13.6, 0.9, 0.4, C.woodL); board(g, 'Cedar Hollow', 5.4, 0.22, 9, 0.8, { bg: '#7a5a36' }); g.tf(-112, y, 40, 0, -Math.PI / 2, 0); board(g, 'Happy Trails!', 5.4, 0.22, 9, 0.8, { bg: '#7a5a36' }); g.notf(); ctx.col.push(world.addCircle(-112, 33.6, 0.4), world.addCircle(-112, 46.4, 0.4)); }
  /* bus shelter + bikes */
  { const { g } = ctx.pick(-28, 50), y = hAt(-28, 50); g.tf(-28, y, 50.6); g.box(0, 1.25, 0.9, 3.2, 2.5, 0.1, 0x7fa6c0); g.box(0, 2.55, 0.4, 3.4, 0.12, 1.4, C.dark); for (const s of [-1.6, 1.6]) g.box(s, 1.25, 0, 0.1, 2.5, 0.1, C.metal); g.box(0, 0.5, 0.6, 2.6, 0.1, 0.4, C.woodL); g.notf(); ctx.col.push(world.addBox(-29.6, 51.3, -26.4, 51.7)); }
  /* houses: mailboxes, fences, dog house, garden bits */
  for (const b of BUILDINGS) if (b.kind === 'house' && b.id.startsWith('h')) {
    const s = b.f === 'n' ? -1 : 1; P.mailbox(ctx, b.x + 4.6, b.z + s * 8.2, [C.blue, C.red, C.green, C.white][Math.floor(R() * 4)]);
    if (R() < 0.6) P.fence(ctx, b.x - 7.5, b.z - s * 6.2, b.x + 7.5, b.z - s * 6.2, { h: 0.9 });
    if (R() < 0.5) P.planter(ctx, b.x - 3, b.z + s * 5.8, 2.4, 0.7);
    (world.plantRequests ||= []).push({ kind: 'leafy', x: b.x - 6.2 + R() * 2, z: b.z - s * (2 + R() * 3), s: 0.7 + R() * 0.3 });
  }
  { const { g } = ctx.pick(-28, -2), y = hAt(-28, -2); g.tf(-27, y, 3.5, 0, 0.4, 0); g.box(0, 0.5, 0, 1.3, 1.0, 1.6, 0xc94f3f); g.gable(0, 1.0, 0, 1.5, 1.8, 0.6, 0x5a3a2a, false); g.box(0, 0.4, 0.81, 0.6, 0.7, 0.04, C.dark); g.notf(); ctx.col.push(world.addCircle(-27, 3.5, 0.9)); }
  /* soccer field goals + trailhead */
  for (const s of [-1, 1]) { const { g } = ctx.pick(50, -70), gx = 50 + s * 22, y = hAt(gx, -71); g.tf(gx, y, -71); for (const zz of [-2.4, 2.4]) g.box(0, 1.0, zz, 0.12, 2, 0.12, C.white); g.box(0, 2, 0, 0.12, 0.12, 4.9, C.white); g.notf(); ctx.col.push(world.addCircle(gx, -73.4, 0.15), world.addCircle(gx, -68.6, 0.15)); }
  P.bench(ctx, 50, -54.5, 0); P.bench(ctx, 40, -54.5, 0);
  P.signpost(ctx, -20, -90, 'Trailhead Parking', { ry: 0 }); P.bench(ctx, -2, -88, Math.PI); P.bin(ctx, 2, -80);
  /* ---------- park ---------- */
  for (const s of STALLS) P.stall(ctx, s);
  { /* fountain */
    const { g } = ctx.pick(49, 100), y = hAt(49, 100); g.tf(49, y, 100);
    g.cyl(0, 0, 0, 4.2, 4.2, 0.7, 14, C.stone, C.stoneD); g.cyl(0, 0.62, 0, 3.7, 3.7, 0.1, 14, 0x5fb0e0); g.cyl(0, 0, 0, 0.5, 0.4, 2.2, 8, C.stone); g.cyl(0, 2.2, 0, 1.5, 0.5, 0.35, 10, C.stone); g.cyl(0, 2.5, 0, 1.3, 1.3, 0.06, 10, 0x7fc4f0); g.cyl(0, 2.5, 0, 0.2, 0.15, 1.0, 6, C.stone); g.ball(0, 3.7, 0, 0.32, 0.32, 0.32, 0xbfe4ff, 6, 4, true);
    g.notf(); ctx.col.push(world.addCircle(49, 100, 4.25, y + 0.7), world.addCircle(49, 100, 0.6));
    for (const a of [0.8, 2.35, 3.95, 5.5]) P.bench(ctx, 49 + Math.cos(a) * 8.5, 100 + Math.sin(a) * 8.5, Math.atan2(-Math.cos(a), -Math.sin(a)));
    for (const a of [0, 1.57, 3.14, 4.71]) P.lamp(ctx, 49 + Math.cos(a + 0.4) * 10.5, 100 + Math.sin(a + 0.4) * 10.5, { h: 3.4, r: 7 });
  }
  for (const [bx, bz, bw, bd] of FLOWER_BEDS) { const { g } = ctx.pick(bx, bz), y = hAt(bx, bz); g.notf(); for (let i = 0; i < 26; i++) { const fx = bx + (R() - 0.5) * (bw - 0.6), fz = bz + (R() - 0.5) * (bd - 0.6); g.cyl(fx, y, fz, 0.03, 0.03, 0.35, 3, C.leaf); g.ball(fx, y + 0.42, fz, 0.13, 0.13, 0.13, [C.red, C.yellow, C.pink, C.white, 0x9a6fd0, C.orange][i % 6], 5, 3, true); } for (const [ex, ez, ew, ed] of [[bx, bz - bd / 2, bw, 0.14], [bx, bz + bd / 2, bw, 0.14], [bx - bw / 2, bz, 0.14, bd], [bx + bw / 2, bz, 0.14, bd]]) g.box(ex, y + 0.1, ez, ew, 0.2, ed, C.woodD); }
  { /* gazebo */
    const gx = 64, gz = 130, { g, gl } = ctx.pick(gx, gz), y = hAt(gx, gz); g.tf(gx, y, gz); g.cyl(0, 0, 0, 3.6, 3.6, 0.35, 8, C.woodL, C.white);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.39; g.box(Math.cos(a) * 3.2, 1.75, Math.sin(a) * 3.2, 0.2, 2.8, 0.2, C.white); ctx.col.push(world.addCircle(gx + Math.cos(a) * 3.2, gz + Math.sin(a) * 3.2, 0.2)); }
    g.cyl(0, 3.1, 0, 4.2, 0.3, 1.8, 8, 0x4f7f6f); g.cyl(0, 4.9, 0, 0.12, 0.02, 0.8, 4, C.yellow);
    gl.tf(gx, y, gz); gl.box(0, 3.0, 0, 0.4, 0.3, 0.4, 0xffe0a0); gl.notf(); g.notf(); pool(ctx, gx, gz, 6); ctx.col.push(world.addCircle(gx, gz, 3.6, y + 0.35));
  }
  { /* dog agility corner */
    const { g } = ctx.pick(32, 127), y = hAt(32, 127); g.notf();
    for (const [hx, hz] of [[26, 124], [31, 124]]) { for (const s of [-0.9, 0.9]) g.box(hx, y + 0.45, hz + s, 0.1, 0.9, 0.1, C.white); g.box(hx, y + 0.5, hz, 0.08, 0.08, 1.8, C.red); ctx.col.push(world.addBox(hx - 0.1, hz - 0.9, hx + 0.1, hz + 0.9, y + 0.55)); }
    g.tf(37, y, 124); for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU, a1 = ((i + 1) / 12) * TAU, r0 = 0.95, r1 = 1.15; g.quad([0, 1.5 + Math.sin(a0) * r0, Math.cos(a0) * r0], [0, 1.5 + Math.sin(a1) * r0, Math.cos(a1) * r0], [0, 1.5 + Math.sin(a1) * r1, Math.cos(a1) * r1], [0, 1.5 + Math.sin(a0) * r1, Math.cos(a0) * r1], i % 2 ? C.yellow : C.blue); g.quad([0.02, 1.5 + Math.sin(a0) * r0, Math.cos(a0) * r0], [0.02, 1.5 + Math.sin(a1) * r0, Math.cos(a1) * r0], [0.02, 1.5 + Math.sin(a1) * r1, Math.cos(a1) * r1], [0.02, 1.5 + Math.sin(a0) * r1, Math.cos(a0) * r1], i % 2 ? C.yellow : C.blue, [-5, 1.5, 0]); }
    g.box(0, 0.2, 0, 0.14, 0.5, 0.14, C.metal); g.notf();
    g.tf(30, y, 131, 0, 0, 0); g.quad([-2, 0, -0.7], [-2, 0, 0.7], [0, 1.0, 0.7], [0, 1.0, -0.7], C.blue, [-1, -1, 0]); g.quad([2, 0, -0.7], [2, 0, 0.7], [0, 1.0, 0.7], [0, 1.0, -0.7], C.yellow, [1, -1, 0]); g.tri([-2, 0, 0.7], [2, 0, 0.7], [0, 1, 0.7], C.woodD, [0, 0, 0]); g.tri([-2, 0, -0.7], [2, 0, -0.7], [0, 1, -0.7], C.woodD, [0, 0, 0]); g.notf();
    for (let i = -3; i <= 3; i++) ctx.col.push(world.addBox(30 + i * 0.5 - 0.25, 130.3, 30 + i * 0.5 + 0.25, 131.7, y + 1.0 - Math.abs(i) * 0.25));
    g.tf(38, y + 0.7, 131, Math.PI / 2, Math.PI / 2, 0); g.cyl(0, -1.6, 0, 0.75, 0.75, 3.2, 8, 0x3f9fd6); g.notf(); ctx.col.push(world.addBox(36.4, 130.3, 39.6, 131.7, y + 1.45));
    P.signpost(ctx, 21, 121, 'Zoomies Zone', { ry: Math.PI / 2 });
  }
  /* park edges, benches, lamps */
  P.hedge(ctx, 14, 141.5, 44, 141.5); P.hedge(ctx, 54, 141.5, 84, 141.5); P.hedge(ctx, 85.5, 80, 85.5, 96); P.hedge(ctx, 85.5, 104, 85.5, 141.5); P.hedge(ctx, 12.5, 68, 12.5, 96); P.hedge(ctx, 12.5, 104, 12.5, 141.5);
  for (const [x, z, ry] of [[20, 97.6, 0], [78, 97.6, 0], [46.6, 74, Math.PI / 2], [46.6, 126, Math.PI / 2], [20, 138, Math.PI], [76, 70, 0]]) P.bench(ctx, x, z, ry);
  for (const [x, z] of [[18, 66], [80, 66], [18, 134], [80, 134], [49, 74], [49, 126], [24, 102.4], [74, 102.4]]) P.lamp(ctx, x, z, { h: 3.4, r: 6 });
  /* skate spot: little quarter ramps */
  { const { g } = ctx.pick(24, 72), y = hAt(24, 72); g.notf(); g.box(22, y + 0.04, 73, 9, 0.08, 7, 0xb8b4aa); for (let i = 0; i < 5; i++) { g.box(18 + i * 0.4, y + 0.1 + i * 0.1, 73, 0.4, 0.2 + i * 0.2, 5, 0x9a968c); ctx.col.push(world.addBox(17.8 + i * 0.4, 70.5, 18.2 + i * 0.4, 75.5, y + 0.2 + i * 0.2)); } g.box(27.5, y + 0.3, 70.4, 4, 0.12, 0.12, C.metal); for (const s of [-1.8, 1.8]) g.box(27.5 + s, y + 0.15, 70.4, 0.1, 0.3, 0.1, C.metal); P.signpost(ctx, 27.5, 76.6, 'Skate Spot', { ry: Math.PI }); }
  /* ranger station yard */
  P.flag(ctx, 97.5, 70, 0x3f7f4f, 6.5); P.signpost(ctx, 86.5, 68.5, 'Leashes Save Sausages', { ry: 0, bg: '#3f5f3f' }); P.bench(ctx, 88, 73.5, Math.PI); P.lamp(ctx, 98, 56, { h: 3.6 });
  /* ---------- river: bridge, footbridge, docks ---------- */
  {
    const bx0 = riverX(40) - 17, bx1 = riverX(40) + 17, top = 3.25, { g } = ctx.pick(118, 40); g.notf();
    g.box((bx0 + bx1) / 2, top - 0.3, 40, bx1 - bx0, 0.6, 10, C.stone, 0x5d6068);
    for (const px of [riverX(40) - 6.5, riverX(40) + 6.5]) { g.box(px, 0.2, 40, 1.8, 6.0, 9.4, C.stoneD); ctx.col.push(world.addBox(px - 0.9, 35.3, px + 0.9, 44.7, 2.7)); }
    for (let i = 0; i < 3; i++) { const cx = bx0 + (bx1 - bx0) * (i + 0.5) / 3; for (const zz of [35.1, 44.9]) g.box(cx, top - 1.0, zz, (bx1 - bx0) / 3 - 2.2, 0.9, 0.3, C.stoneD); }
    ctx.col.push(world.addBox(bx0, 35, bx1, 45, top, top - 0.6)); decks.push([bx0, 35, bx1, 45]);
    P.rail(ctx, bx0, 35.25, bx1, 35.25, top, 1.1, C.stoneD); P.rail(ctx, bx0, 44.75, bx1, 44.75, top, 1.1, C.stoneD);
    for (const px of [bx0 + 1, bx1 - 1]) for (const zz of [35.25, 44.75]) { const { g: g2, gl } = ctx.pick(px, zz); g2.notf(); g2.cyl(px, top, zz, 0.12, 0.1, 3.2, 5, C.metal); g2.box(px, top + 3.3, zz, 0.4, 0.4, 0.4, 0xfff0c0); gl.notf(); gl.box(px, top + 3.3, zz, 0.5, 0.5, 0.5, 0xffe0a0); }
    pool(ctx, bx0 + 3, 40, 6); pool(ctx, bx1 - 3, 40, 6);
    P.signpost(ctx, bx0 - 2, 46.8, 'Cedar Bridge', { ry: -Math.PI / 2 });
  }
  { const fx0 = riverX(-60) - 20, fx1 = riverX(-60) + 20, top = 3.25; P.deck(ctx, fx0, -61.7, fx1, -58.3, top, { rail: true }); P.rail(ctx, fx0, -61.6, fx1, -61.6, top, 1.0); P.rail(ctx, fx0, -58.4, fx1, -58.4, top, 1.0); }
  { const dz = 70, dx0 = riverX(dz) + 2.5, dx1 = riverX(dz) + 13.6; P.deck(ctx, dx0, dz - 1.4, dx1, dz + 1.4, 1.0); world.dockCanoe = { x: dx0 + 1.6, z: dz + 3.2 };
    P.signpost(ctx, dx1 + 3, dz + 3, 'Canoes: hop in!', { ry: -Math.PI / 2, bg: '#3f6f8f' }); P.crate(ctx, dx1 + 2.5, dz - 3); P.crate(ctx, dx1 + 3.6, dz - 3.4, 0.7, 0x7fa6c0); P.lamp(ctx, dx1 + 1.2, dz - 2.4, { h: 3.2 });
    { const { g } = ctx.pick(152, 92), y = hAt(152, 93); for (let i = 0; i < 2; i++) { g.tf(151 + i * 0.2, y + 0.5 + i * 0.7, 93.5, 0, 0.1, 0); g.box(0, 0, 0, 0.9, 0.4, 4.6, [C.red, 0x3f9f7f][i]); } g.notf(); for (const s of [-1.8, 1.8]) g.box(151.1, y + 0.6, 93.5 + s, 1.4, 1.2, 0.12, C.woodD); ctx.col.push(world.addBox(150.4, 91.2, 151.8, 95.8)); } }
  { const pz = 100, px1 = riverX(pz) - 3.5, px0 = riverX(pz) - 14.2; P.deck(ctx, px0, pz - 1.3, px1, pz + 1.3, 1.0); P.bench(ctx, 117, 97.4, 0); P.signpost(ctx, 119, 103, 'Fishing Pier', { ry: Math.PI / 2 }); }
  /* salmon steps: boulders across the river */
  for (let i = 0; i < 9; i++) { const z = -214 + (R() - 0.5) * 12, x = riverX(z) + (i - 4) * 2.6 + (R() - 0.5) * 2; const { g } = ctx.pick(x, z); g.tf(x, -0.4, z, 0, R() * 6, 0, 1.2 + R() * 0.9); g.ball(0, 0.4, 0, 1, 0.8, 0.9, C.stone, 6, 4, true); g.notf(); g.box(x, 0.05, z + 1.6, 1.8, 0.06, 1.2, 0xeaf6ff); }
  P.bench(ctx, 138, -210, Math.PI / 2 * 3); P.bench(ctx, 96, -86, Math.PI / 2); P.table(ctx, 84, -66, { picnic: true }); P.bench(ctx, 150, -34, 0.8);
  /* ---------- camp ---------- */
  P.campfire(ctx, -204, 2);
  for (const a of [0.3, 1.9, 3.4, 5.0]) P.log(ctx, -204 + Math.cos(a) * 3.2, 2 + Math.sin(a) * 3.2, -a, 2.4);
  P.tent(ctx, -220, -10, 0xf08a2a, 0.5); P.tent(ctx, -224, 6, 0x3f9fd6, 1.4); P.tent(ctx, -214, 20, 0x5fae5f, 2.4); P.tent(ctx, -198, -16, 0xd9534f, -0.4); P.tent(ctx, -212, -22, 0xf0c040, 0);
  P.table(ctx, -208, 10, { picnic: true, ry: 0.3 }); P.table(ctx, -194, -5, { picnic: true, ry: 1.2 });
  P.lamp(ctx, -196, 6, { h: 3, col: C.woodD }); P.lamp(ctx, -212, -4, { h: 3, col: C.woodD }); P.lamp(ctx, -186, -11, { h: 3, col: C.woodD });
  P.crate(ctx, -179.5, -11); { const { g } = ctx.pick(-176, -20), y = hAt(-176.5, -21); g.notf(); for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) { g.tf(-176.5, y + 0.25 + i * 0.42, -22 + j * 0.5 + i * 0.25, 0, 0, Math.PI / 2); g.cyl(0, -0.6, 0, 0.24, 0.24, 1.2, 6, 0x7a5a3a, 0xc9a67a); } g.notf(); ctx.col.push(world.addBox(-177.2, -22.4, -175.8, -20.6, y + 1.2)); }
  { const { g } = ctx.pick(-200, -134), x = -200, z = -134, y = hAt(x, z); g.tf(x, y - 0.5, z); g.cyl(0, 0, 0, 1.9, 1.3, 9, 9, 0x6a4a30); for (let i = 0; i < 5; i++) g.cyl(0, 7 + i * 4.4, 0, 7.2 - i * 1.25, 0.6, 6.2, 9, i % 2 ? 0x2f6a3f : 0x3a7a48); g.notf(); ctx.col.push(world.addCircle(x, z, 1.8)); P.signpost(ctx, -196, -130, 'The Old Fir', { ry: 0.8 }); P.bench(ctx, -204, -128, 2.6); }
  /* logs + mushrooms along forest trails */
  { const fr = world.roadById('forest').path; for (let i = 4; i < fr.length - 2; i += 5) { const p = fr[i], q = fr[i + 1], nx = -(q[1] - p[1]), nz = q[0] - p[0], l = Math.hypot(nx, nz) || 1, s = i % 2 ? 1 : -1, x = p[0] + (nx / l) * s * (4 + R() * 3), z = p[1] + (nz / l) * s * (4 + R() * 3);
      if (i % 3 === 0) P.log(ctx, x, z, R() * 3, 2.6 + R()); else { const { g } = ctx.pick(x, z), y = hAt(x, z); g.notf(); for (let m = 0; m < 4; m++) { const mx = x + (R() - 0.5) * 1.6, mz = z + (R() - 0.5) * 1.6, my = hAt(mx, mz), ms = 0.6 + R() * 0.8; g.cyl(mx, my, mz, 0.06 * ms, 0.05 * ms, 0.3 * ms, 5, 0xf4ead8); g.cyl(mx, my + 0.3 * ms, mz, 0.22 * ms, 0.02, 0.16 * ms, 6, m % 2 ? 0xd9534f : 0xc98a4a); } }
      if (i % 10 === 4) P.marker(ctx, p[0] + (nx / l) * 2.4, p[1] + (nz / l) * 2.4, 0x4fae6f); } }
  /* ---------- mountain + lookout ---------- */
  { const mr = world.roadById('mountain').path; for (let i = 3; i < mr.length - 1; i += 6) { const p = mr[i], q = mr[i + 1], nx = -(q[1] - p[1]), nz = q[0] - p[0], l = Math.hypot(nx, nz) || 1; P.marker(ctx, p[0] + (nx / l) * 2.4, p[1] + (nz / l) * 2.4, C.red); }
    P.bench(ctx, 6, -143.5, Math.PI); P.bench(ctx, -62, -164, Math.PI / 2);
    const lx = LOOKOUT.x, lz = LOOKOUT.z, y = hAt(lx, lz);
    P.rail(ctx, lx - 8, lz - 7, lx + 8, lz - 7, hAt(lx, lz - 7), 1.1); P.rail(ctx, lx - 8, lz - 7, lx - 8, lz + 3, hAt(lx - 8, lz - 2), 1.1); P.rail(ctx, lx + 8, lz - 7, lx + 8, lz + 3, hAt(lx + 8, lz - 2), 1.1);
    P.bench(ctx, lx - 3, lz - 5, 0); P.bench(ctx, lx + 3, lz - 5, 0); P.flag(ctx, lx + 6.5, lz - 5.6, C.orange, 6);
    { const { g } = ctx.pick(lx, lz); g.tf(lx - 6, y, lz - 5.4); g.cyl(0, 0, 0, 0.1, 0.14, 1.2, 6, C.metal); g.tf(lx - 6, y + 1.3, lz - 5.4, 0.3 + Math.PI / 2, Math.PI, 0); g.cyl(0, -0.5, 0, 0.14, 0.2, 1.0, 7, 0x3f6f9f); g.notf(); ctx.col.push(world.addCircle(lx - 6, lz - 5.4, 0.25));
      for (let i = 0; i < 5; i++) { g.tf(lx + 1, y + i * 0.34, lz + 4, 0, i, 0); g.ball(0, 0.2, 0, 0.7 - i * 0.11, 0.2, 0.6 - i * 0.09, i % 2 ? C.stone : C.stoneD, 6, 3, true); } g.notf(); ctx.col.push(world.addCircle(lx + 1, lz + 4, 0.7, y + 1.7)); }
  }
  /* ---------- lake + beach ---------- */
  for (const [x, z, c] of [[186, 157, C.red], [198, 161, C.blue], [214, 158, C.yellow], [236, 162, 0x4fae8f], [246, 158, C.pink]]) P.umbrella(ctx, x, z, c);
  P.log(ctx, 222, 164, 1.2, 3.2); P.log(ctx, 182, 162, 0.3, 2.4); P.table(ctx, 226, 158, { picnic: true, ry: 0.2 }); P.table(ctx, 240, 152.5, { umbrella: C.orange }); P.lamp(ctx, 226, 153, { h: 3.4 });
  { const { g } = ctx.pick(207, 162), y = hAt(207, 162); g.tf(207, y, 162); for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) g.box(sx, 1.2, sz, 0.1, 2.4, 0.1, C.white); g.box(0, 2.4, 0, 1.5, 0.1, 1.5, C.white); g.box(0, 2.9, -0.7, 1.5, 1.0, 0.1, C.red); g.notf(); ctx.col.push(world.addCircle(207, 162, 0.9));
    g.tf(190, hAt(190, 166.5), 166.5); g.cyl(0, 0, 0, 0.9, 0.6, 0.6, 8, C.sand); g.cyl(0, 0.6, 0, 0.4, 0.3, 0.5, 6, C.sand); g.cyl(0, 1.1, 0, 0.03, 0.03, 0.4, 3, C.woodD); g.box(0.15, 1.4, 0, 0.3, 0.2, 0.02, C.red); g.notf();
    for (const s of [-4, 4]) { g.tf(244 + s, hAt(244, 166), 166); g.cyl(0, 0, 0, 0.07, 0.07, 2.2, 5, C.white); g.notf(); } g.tf(244, hAt(244, 166), 166); g.box(0, 1.8, 0, 8, 0.8, 0.03, 0xfafafa); g.notf(); ctx.col.push(world.addCircle(240, 166, 0.15), world.addCircle(248, 166, 0.15)); }
  P.deck(ctx, 194.6, 165, 197.4, 186, 1.0); P.signpost(ctx, 199.5, 164, 'Mirror Lake Pier', { ry: 0 });
  for (const [x, z] of [[176, 214], [222, 196], [244, 232], [206, 262], [168, 248]]) { const { g } = ctx.pick(x, z); g.notf(); g.cyl(x, -0.2, z, 0.4, 0.3, 0.8, 7, C.red); g.cyl(x, 0.6, z, 0.3, 0.1, 0.4, 7, C.white); ctx.col.push(world.addCircle(x, z, 0.45, 0.6)); }
  for (const [x, z, ry] of [[262, 172, -1.2], [280, 226, -1.57], [250, 280, 2.6], [150, 271, 2.2], [130, 232, 1.4]]) P.bench(ctx, x, z, ry);
  P.signpost(ctx, 198, 233, 'Biscuit Island', { ry: 0 });
  /* ---------- farm ---------- */
  { const { g } = ctx.pick(-180, 246), x = -180, z = 246, y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 3, 3, 11, 10, 0xd8d8d2); g.ball(0, 11, 0, 3, 2.2, 3, 0x9aa0a8, 10, 4, true); g.notf(); ctx.col.push(world.addCircle(x, z, 3)); footprints.push([x - 3, z - 3, x + 3, z + 3]); }
  P.fence(ctx, -198, 186, -146, 186, { col: C.woodL, h: 1.1 }); P.fence(ctx, -198, 222, -146, 222, { col: C.woodL, h: 1.1 }); P.fence(ctx, -198, 186, -198, 222, { col: C.woodL, h: 1.1 }); P.fence(ctx, -146, 186, -146, 199, { col: C.woodL, h: 1.1 }); P.fence(ctx, -146, 207, -146, 222, { col: C.woodL, h: 1.1 });
  P.fence(ctx, -141, 247, -131, 247, { col: C.woodL, h: 0.8 }); P.fence(ctx, -141, 247, -141, 258, { col: C.woodL, h: 0.8 });
  P.haybale(ctx, -150, 236, 0.2, 2); P.haybale(ctx, -152.5, 238, 1.2, 1); P.haybale(ctx, -147.6, 237.6, 0.8, 1); P.haybale(ctx, -172, 214, 0.1, 1); P.haybale(ctx, -186, 196, 1.0, 1);
  { const { g } = ctx.pick(-143, 230), x = -142, z = 228, y = hAt(x, z); g.tf(x, y, z, 0, 0.5, 0); g.box(0, 1.1, 0, 1.4, 1.0, 2.8, 0x3f9f4f); g.box(0, 2.0, -0.8, 1.3, 1.2, 1.2, 0x3f9f4f); g.box(0, 2.7, -0.8, 1.5, 0.12, 1.4, C.dark); for (const [wx, wz, wr] of [[-0.85, -0.8, 0.85], [0.85, -0.8, 0.85], [-0.8, 1.1, 0.5], [0.8, 1.1, 0.5]]) { g.tf(x, y, z, 0, 0.5, 0); const m = g.m.clone(); g.m.multiply(new THREE.Matrix4().makeTranslation(wx, wr, wz)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)); g.cyl(0, -0.2, 0, wr, wr, 0.4, 9, C.dark, C.yellow); g.m.copy(m); } g.cyl(0.4, 1.6, 1.0, 0.08, 0.08, 1.0, 5, C.dark); g.notf(); ctx.col.push(world.addCircle(x, z, 1.7)); }
  { const { g } = ctx.pick(-128, 268), x = -128, z = 268, y = hAt(x, z); g.tf(x, y, z); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.quad([sx, 0, sz], [sx * 0.82, 0, sz * 0.82], [sx * 0.2, 8, sz * 0.2], [sx * 0.32, 8, sz * 0.32], C.metal).quad([sx, 0, sz], [sx * 0.82, 0, sz], [sx * 0.2, 8, sz * 0.2], [sx * 0.32, 8, sz * 0.2], C.metal); g.box(0, 8, 0, 0.8, 0.5, 0.8, C.metal); g.box(0, 4, 0, 1.3, 0.08, 1.3, C.metal); g.notf();
    const bg = new Geo(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, a2 = a + 0.42; bg.quad([Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.1], [Math.cos(a2) * 2.4, Math.sin(a2) * 2.4, -0.1], [Math.cos(a2) * 0.4, Math.sin(a2) * 0.4, 0], 0xd8d8d2); bg.quad([Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.01], [Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.11], [Math.cos(a2) * 2.4, Math.sin(a2) * 2.4, -0.09], [Math.cos(a2) * 0.4, Math.sin(a2) * 0.4, 0.01], 0xb8b8b2, [0, 0, -9]); }
    const blades = new THREE.Mesh(bg.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); blades.position.set(x, y + 8, z + 0.6); scene.add(blades); anim.push((dt) => { blades.rotation.z += dt * 1.4; }); ctx.col.push(world.addCircle(x, z, 1.1)); }
  { const { g } = ctx.pick(-92, 252), x = -92, z = 252, y = hAt(x, z); g.tf(x, y, z, 0, 2.6, 0); g.box(0, 1.1, 0, 0.1, 2.2, 0.1, C.woodD); g.box(0, 1.6, 0, 1.8, 0.1, 0.1, C.woodD); g.box(0, 1.4, 0, 0.7, 0.8, 0.3, 0xc94f3f); g.ball(0, 2.1, 0, 0.26, 0.28, 0.26, C.hay, 6, 4, true); g.cyl(0, 2.3, 0, 0.42, 0.1, 0.3, 7, 0x7a5a36); g.notf(); ctx.col.push(world.addCircle(x, z, 0.2)); }
  for (let i = 0; i < 16; i++) P.pumpkin(ctx, -96 + (i % 6) * 5.6 + R() * 2, 178.4 + Math.floor(i / 6) * 9 + R() * 3, 0.9 + R() * 0.9);
  { const s = { x: -124, z: 206, name: 'Farm Stand: Eggs', col: 0x5f9f4f }; P.stall(ctx, s); }
  { const { g } = ctx.pick(-160, 204), y = hAt(-152, 190); g.notf(); g.box(-152, y + 0.3, 190, 2.6, 0.6, 0.9, C.woodD); g.box(-152, y + 0.56, 190, 2.3, 0.08, 0.6, 0x5fb0e0); ctx.col.push(world.addBox(-153.3, 189.5, -150.7, 190.5, y + 0.6)); }
  for (const x of [-118, -104, -90, -76]) (world.plantRequests ||= []).push({ kind: 'leafy', x, z: 221.5, s: 0.85, fruit: true });
  P.lamp(ctx, -134, 218.5, { h: 3.4, col: C.woodD }); P.lamp(ctx, -156, 230, { h: 3.4, col: C.woodD });
  /* ---------- meadows, valley ---------- */
  { const cx = 244, cz = -160; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, x = cx + Math.cos(a) * 9, z = cz + Math.sin(a) * 9, { g } = ctx.pick(x, z), y = hAt(x, z), hh = 2.2 + R() * 1.6; g.tf(x, y - 0.3, z, (R() - 0.5) * 0.16, a, (R() - 0.5) * 0.16); g.box(0, hh / 2, 0, 1.3, hh, 0.7, i % 2 ? C.stone : C.stoneD); g.notf(); ctx.col.push(world.addCircle(x, z, 0.7)); } P.signpost(ctx, 232, -152, 'The Old Stones', { ry: -0.6 }); }
  for (let i = 0; i < 4; i++) { const x = 168 + i * 2.2, z = -84 + (i % 2) * 2.4, { g } = ctx.pick(x, z), y = hAt(x, z); g.tf(x, y, z); g.box(0, 0.25, 0, 0.1, 0.5, 0.1, C.woodD); g.box(0, 0.8, 0, 0.8, 0.9, 0.8, [C.white, C.yellow, 0x9fc4d8, C.white][i]); g.box(0, 1.3, 0, 0.95, 0.1, 0.95, C.woodD); g.notf(); ctx.col.push(world.addCircle(x, z, 0.5, y + 1.35)); }
  P.signpost(ctx, 165, -79, 'Honey Hut Hives', { ry: -1 });
  P.bench(ctx, 236, -66, -0.6); (world.plantRequests ||= []).push({ kind: 'leafy', x: 238, z: -74, s: 1.9 });
  P.boulder(ctx, 60, 198, 2.6); P.boulder(ctx, 63.5, 196.5, 1.7); P.signpost(ctx, 56, 193, 'Split Rock', { ry: 0.5 });
  { const { g } = ctx.pick(40, 188), x = 36, z = 190, y = hAt(x, z); g.tf(x, y, z); g.cyl(0, 0, 0, 1.1, 1.1, 0.9, 9, C.stone, 0x3f6f9f); for (const s of [-1, 1]) g.box(s, 1.5, 0, 0.14, 2.2, 0.14, C.woodD); g.gable(0, 2.5, 0, 2.8, 1.6, 0.7, 0x8a3a2a, true); g.notf(); ctx.col.push(world.addCircle(x, z, 1.15)); }
  P.bench(ctx, 98, 202, 2.9); P.bench(ctx, -60, 196, 0.4); P.bench(ctx, -150, 30, 0.2); P.lamp(ctx, -128, 44.5, { h: 3.6, col: C.woodD });
  for (const s of SIGNPOSTS) P.signpost(ctx, s.x, s.z, s.title, { ry: s.ry || 0, bg: '#6a4a2e' });
  /* ---------- halloween extras (hidden unless enabled) ---------- */
  for (const b of BUILDINGS) if (b.kind === 'shop' || b.kind === 'house' || b.kind === 'hall') { const s = b.f === 'n' ? -1 : b.f === 's' ? 1 : 0; if (!s) continue; P.pumpkin(ctx, b.x - 2.2, b.z + s * (b.d / 2 + 1.0), 1.1, true, hallow); if (R() < 0.5) P.pumpkin(ctx, b.x + 2.6, b.z + s * (b.d / 2 + 0.8), 0.8, true, hallow); }
  for (const a of [0, 1.2, 2.5, 3.7, 5]) P.pumpkin(ctx, 49 + Math.cos(a) * 5.4, 100 + Math.sin(a) * 5.4, 1.2, true, hallow);
  for (const [x, z] of [[-66, 34.3], [26, 34.3], [-30, 45.7], [38, 45.7], [49, 74], [18, 66]]) { const g = hallow.g, y = hAt(x, z); g.tf(x + 0.5, y + 2.6, z, 0, R() * 6, 0); g.cyl(0, 0, 0, 0.5, 0.28, 1.0, 7, 0xf4f4f4); g.ball(0, 1.0, 0, 0.3, 0.3, 0.3, 0xf4f4f4, 6, 4, true); g.box(-0.1, 1.05, 0.27, 0.08, 0.1, 0.04, C.dark); g.box(0.1, 1.05, 0.27, 0.08, 0.1, 0.04, C.dark); g.notf(); }

  /* ---------- build meshes ---------- */
  const meshes = [], glowMeshes = [];
  for (const [, c] of chunks) {
    if (c.g.tris) { const m = new THREE.Mesh(c.g.build(), material); m.matrixAutoUpdate = false; m.receiveShadow = true; m.name = 'static'; scene.add(m); meshes.push(m); }
    if (c.gl.tris) { const m = new THREE.Mesh(c.gl.build(), glowMat); m.matrixAutoUpdate = false; m.renderOrder = 3; m.name = 'glow'; scene.add(m); glowMeshes.push(m); }
  }
  const hm = new THREE.Mesh(hallow.g.build(), material), hg = new THREE.Mesh(hallow.gl.build(), new THREE.MeshBasicMaterial({ vertexColors: true })); hm.visible = hg.visible = false; scene.add(hm, hg);

  let t = 0;
  const api = {
    material, glowMat, footprints, decks, makeSign, builders: P, tris: () => meshes.reduce((s, m) => s + m.geometry.attributes.position.count / 3, 0),
    setShadows(on) { for (const m of meshes) m.castShadow = on; },
    setHalloween(on) { hm.visible = hg.visible = !!on; },
    update(dt, night) { t += dt; glowMat.opacity = night; for (const m of glowMeshes) m.visible = night > 0.02; for (const f of anim) f(dt, night, t); },
    /* runtime props for other modules: returns { mesh, remove() } */
    spawn(kind, x, z, opts = {}) {
      const g = new Geo(), gl = new Geo(), c = { pick: () => ({ g, gl }), col: [], solid: opts.solid !== false };
      const fn = P[kind]; if (!fn) throw new Error('unknown prop ' + kind);
      if (kind === 'building' || kind === 'stall') fn(c, { ...opts, x, z }); else if (kind === 'signpost') fn(c, x, z, opts.text || '', opts); else if (kind === 'fence' || kind === 'hedge') fn(c, x, z, opts.x1, opts.z1, opts);
      else if (kind === 'deck') fn(c, x, z, opts.x1, opts.z1, opts.top ?? 1, opts); else if (kind === 'tent' || kind === 'umbrella' || kind === 'bin' || kind === 'mailbox' || kind === 'flag' || kind === 'marker') fn(c, x, z, opts.col, opts.ry ?? opts.h);
      else if (kind === 'bench' || kind === 'log') fn(c, x, z, opts.ry || 0, opts.len); else if (kind === 'pumpkin' || kind === 'boulder' || kind === 'crate') fn(c, x, z, opts.s || 1); else if (kind === 'haybale') fn(c, x, z, opts.ry || 0, opts.stack || 1); else fn(c, x, z, opts);
      const group = new THREE.Group(); const m = new THREE.Mesh(g.build(), material); m.receiveShadow = true; group.add(m);
      if (gl.tris) { const m2 = new THREE.Mesh(gl.build(), glowMat); m2.renderOrder = 3; group.add(m2); glowMeshes.push(m2); }
      scene.add(group);
      return { mesh: group, colliders: c.col, remove() { scene.remove(group); m.geometry.dispose(); for (const k of c.col) k.remove(); } };
    }
  };
  return api;
}
