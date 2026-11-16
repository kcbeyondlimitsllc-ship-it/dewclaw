/* Shared helpers: maths, seeded noise, and a small geometry builder for the
   procedural low-poly art (everything in the game is built from code). */
import * as THREE from '../vendor/three/three.module.min.js';
export { THREE };

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
export const lerpAngle = (a, b, t) => a + angDiff(a, b) * t;
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
export function fbm(x, y, oct = 3) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }

/* distance from a point to a segment; returns [distance, t] */
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  const cx = ax + dx * t - px, cz = az + dz * t - pz;
  return [Math.sqrt(cx * cx + cz * cz), t];
}
export function polyDist(px, pz, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) { const d = segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])[0]; if (d < best) best = d; }
  return best;
}
/* Catmull-Rom resample of a polyline so roads and trails curve */
export function smoothPath(pts0, step = 4) {
  /* add control points along long straights first, so the spline only rounds the corners */
  const pts = [pts0[0]];
  for (let i = 1; i < pts0.length; i++) { const a = pts0[i - 1], b = pts0[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 22); for (let k = 1; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  if (pts.length < 3) { const out = []; const [a, b] = pts; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let i = 0; i <= n; i++) out.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); return out; }
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, o = [0, 0];
      for (let c = 0; c < 2; c++) o[c] = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
      out.push(o);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

const _col = new THREE.Color(), _colCache = new Map();
function rgbOf(hex) {
  let c = _colCache.get(hex);
  if (!c) { _col.set(hex); c = [_col.r, _col.g, _col.b]; _colCache.set(hex, c); }
  return c;
}
const _v = new THREE.Vector3(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

/* Geometry builder: flat-shaded, vertex-coloured triangles with optional atlas UVs.
   Faces are wound automatically so they point away from a reference point. */
export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.m = null; this.white = [0.5, 0.992]; }
  /* set a local transform applied to everything added afterwards */
  tf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    if (!this.m) this.m = new THREE.Matrix4();
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(s, s, s);
    this.m.compose(_v.set(x, y, z), _q, _s); return this;
  }
  notf() { this.m = null; return this; }
  _pt(a) { if (!this.m) return a; _v.set(a[0], a[1], a[2]).applyMatrix4(this.m); return [_v.x, _v.y, _v.z]; }
  tri(a, b, c, col, ref, uvs, nrm) {
    const A = this._pt(a), B = this._pt(b), C = this._pt(c);
    let ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let flip = false;
    if (ref) { const R = this._pt(ref); if ((A[0] - R[0]) * nx + (A[1] - R[1]) * ny + (A[2] - R[2]) * nz < 0) flip = true; }
    const k = rgbOf(col);
    const order = flip ? [A, C, B] : [A, B, C];
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    for (const P of order) { this.p.push(P[0], P[1], P[2]); this.c.push(k[0], k[1], k[2]); }
    if (nrm) {
      const N = flip ? [nrm[0], nrm[2], nrm[1]] : nrm;
      for (const q of N) { if (this.m) { _v.set(q[0], q[1], q[2]).transformDirection(this.m); this.n.push(_v.x, _v.y, _v.z); } else this.n.push(q[0], q[1], q[2]); }
    } else this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    if (uvs) { const U = flip ? [uvs[0], uvs[2], uvs[1]] : uvs; for (const q of U) this.uv.push(q[0], q[1]); }
    else this.uv.push(this.white[0], this.white[1], this.white[0], this.white[1], this.white[0], this.white[1]);
    return this;
  }
  quad(a, b, c, d, col, ref, uvs) {
    this.tri(a, b, c, col, ref, uvs && [uvs[0], uvs[1], uvs[2]]);
    this.tri(a, c, d, col, ref, uvs && [uvs[0], uvs[2], uvs[3]]);
    return this;
  }
  /* axis-aligned box centred at cx,cy,cz (before tf) */
  box(cx, cy, cz, sx, sy, sz, col, topCol) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, r = [cx, cy, cz];
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], topCol ?? col, r);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, r);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], col, r);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, r);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, r);
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], col, r);
    return this;
  }
  /* cylinder / cone along +Y from y0 to y0+h; r0 bottom radius, r1 top radius */
  cyl(cx, y0, cz, r0, r1, h, seg, col, capCol, sxz = 1, caps = 3) {
    const r = [cx, y0 + h / 2, cz], y1 = y0 + h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0) * sxz, c1 = Math.cos(a1), s1 = Math.sin(a1) * sxz;
      const p0 = [cx + r0 * c0, y0, cz + r0 * s0], p1 = [cx + r0 * c1, y0, cz + r0 * s1];
      const t0 = [cx + r1 * c0, y1, cz + r1 * s0], t1 = [cx + r1 * c1, y1, cz + r1 * s1];
      if (r1 > 0.0001 && r0 > 0.0001) this.quad(p0, t0, t1, p1, col, r);
      else if (r0 > 0.0001) this.tri(p0, [cx, y1, cz], p1, col, r);
      else this.tri(t0, [cx, y0, cz], t1, col, r);
      if (r1 > 0.0001 && (caps & 2)) this.tri([cx, y1, cz], t1, t0, capCol ?? col, [cx, y0, cz]);
      if (r0 > 0.0001 && (caps & 1)) this.tri([cx, y0, cz], p0, p1, capCol ?? col, [cx, y1, cz]);
    }
    return this;
  }
  /* ellipsoid, smooth-shaded by default */
  ball(cx, cy, cz, rx, ry, rz, col, seg = 8, rings = 6, flat = false, col2 = null) {
    const P = (i, j) => { const th = (j / rings) * Math.PI, ph = (i / seg) * TAU; const s = Math.sin(th); return [s * Math.cos(ph), Math.cos(th), s * Math.sin(ph)]; };
    const r = [cx, cy, cz];
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const n = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      const v = n.map(q => [cx + q[0] * rx, cy + q[1] * ry, cz + q[2] * rz]);
      const k = col2 && n[0][1] + n[2][1] < -0.5 ? col2 : col;
      const nn = flat ? null : n.map(q => { const a = q[0] / rx, b = q[1] / ry, c = q[2] / rz, l = Math.hypot(a, b, c) || 1; return [a / l, b / l, c / l]; });
      if (j > 0) this.tri(v[0], v[1], v[2], k, r, null, nn && [nn[0], nn[1], nn[2]]);
      if (j < rings - 1) this.tri(v[0], v[2], v[3], k, r, null, nn && [nn[0], nn[2], nn[3]]);
    }
    return this;
  }
  /* gable roof prism: ridge runs along X when alongX, else along Z */
  gable(cx, y0, cz, sx, sz, h, col, alongX = true, endCol = null) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, r = [cx, y0, cz], y1 = y0 + h;
    if (alongX) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, cz], [x0, y1, cz], col, r);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, cz], [x0, y1, cz], col, r);
      this.tri([x0, y0, z0], [x0, y0, z1], [x0, y1, cz], endCol ?? col, r);
      this.tri([x1, y0, z0], [x1, y0, z1], [x1, y1, cz], endCol ?? col, r);
    } else {
      this.quad([x0, y0, z0], [x0, y0, z1], [cx, y1, z1], [cx, y1, z0], col, r);
      this.quad([x1, y0, z0], [x1, y0, z1], [cx, y1, z1], [cx, y1, z0], col, r);
      this.tri([x0, y0, z0], [x1, y0, z0], [cx, y1, z0], endCol ?? col, r);
      this.tri([x0, y0, z1], [x1, y0, z1], [cx, y1, z1], endCol ?? col, r);
    }
    return this;
  }
  get tris() { return this.p.length / 9; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/* Small inline SVG icon set for the HUD (no emoji fonts, no external images). */
const I = {
  bone: '<path d="M6.5 4a2.5 2.5 0 0 1 2.4 3.2l8 8A2.5 2.5 0 1 1 20 17.5a2.5 2.5 0 1 1-4.9 1.4l-8-8A2.5 2.5 0 1 1 4 6.5 2.5 2.5 0 0 1 6.5 4z"/>',
  gem: '<path d="M7 3h10l4 6-9 12L3 9z"/><path d="M3 9h18M9 3l-2 6 5 12 5-12-2-6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>',
  paw: '<ellipse cx="12" cy="15.5" rx="5" ry="4.2"/><ellipse cx="5.2" cy="10.5" rx="2.1" ry="2.8"/><ellipse cx="9.4" cy="6.4" rx="2.1" ry="2.9"/><ellipse cx="14.6" cy="6.4" rx="2.1" ry="2.9"/><ellipse cx="18.8" cy="10.5" rx="2.1" ry="2.8"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14" stroke="rgba(0,0,0,.35)" stroke-width="1.2" fill="none"/>',
  camera: '<path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6" fill="rgba(0,0,0,.35)"/>',
  jump: '<path d="M12 3l7 8h-4v9H9v-9H5z"/>',
  bolt: '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  bark: '<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sit: '<path d="M7 4h4v8h6a2 2 0 0 1 2 2v6h-3v-5H9a2 2 0 0 1-2-2z"/><rect x="5" y="19" width="8" height="2" rx="1"/>',
  dig: '<path d="M14 3l7 7-3 3-2.5-2.5-8.5 8.5a2 2 0 0 1-3-3l8.5-8.5L10 5z"/>',
  shake: '<path d="M4 8c2-3 4-3 6 0s4 3 6 0 3-2 4 0M4 15c2-3 4-3 6 0s4 3 6 0 3-2 4 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  hand: '<path d="M8 11V5a1.5 1.5 0 0 1 3 0v5h1V4a1.5 1.5 0 0 1 3 0v6h1V6a1.5 1.5 0 0 1 3 0v9c0 4-3 6-6.5 6S6 19 5 16l-2-5a1.6 1.6 0 0 1 3-1z"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm9 3.5l-2.2-.8a7 7 0 0 0-.7-1.7l1-2.1-1.5-1.5-2.1 1a7 7 0 0 0-1.7-.7L13 4h-2l-.8 2.2a7 7 0 0 0-1.7.7l-2.1-1-1.5 1.5 1 2.1a7 7 0 0 0-.7 1.7L3 12v2l2.2.8c.2.6.4 1.2.7 1.7l-1 2.1 1.5 1.5 2.1-1c.5.3 1.1.5 1.7.7L11 22h2l.8-2.2c.6-.2 1.2-.4 1.7-.7l2.1 1 1.5-1.5-1-2.1c.3-.5.5-1.1.7-1.7L21 14z" fill-rule="evenodd"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M4.5 7.5c4 2 4 7 0 9M19.5 7.5c-4 2-4 7 0 9" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.6"/>',
  whistle: '<path d="M3 9h11l3-3 2 2-2.2 2.2A5.5 5.5 0 1 1 8 14.5V12H3z"/>',
  flag: '<path d="M5 3v18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>'
};
export function icon(name, size = 22) {
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${I[name] || I.paw}</svg>`;
}
export function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]); }
  if (html) e.innerHTML = html;
  return e;
}
