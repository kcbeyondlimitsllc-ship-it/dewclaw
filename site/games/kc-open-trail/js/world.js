/* The world: terrain heightfield, rivers and lakes, painted ground texture,
   colliders, districts, sky / day-night / weather, far-off volcanoes and the
   festival fog. Buildings and props live in scenery.js, trees in flora.js. */
import { THREE, Geo, clamp, lerp, smooth, fbm, segDist, polyDist, smoothPath, rng, TAU } from './util.js';
import { HALF, EXT, WATER_Y, BASE_Y, RIVERS, LAKES, ISLANDS, CREEK, RAIL, BUMPS, PADS, FLATS, RIDGE, RIDGE_H, RIDGE_W, ROADS, ZONES, PATCHES, FIELDS, PLAZA, CROSSWALKS } from './data.js';
import { buildScenery } from './scenery.js';
import { buildFlora } from './flora.js';

const N = 144, CELL = (EXT * 2) / N;
const softRect = (x, z, x0, z0, x1, z1, e) => smooth(x0 - e, x0, x) * (1 - smooth(x1, x1 + e, x)) * smooth(z0 - e, z0, z) * (1 - smooth(z1, z1 + e, z));

export function createWorld(game) {
  const { scene } = game;
  const world = { HALF, EXT, WATER_Y, roads: [], time: 9.5, day: 1, night: 0, rain: 0, dayLength: 720, festival: false };

  /* ---------- water shapes ---------- */
  const riverSd1 = (r, x, z) => { let best = 1e9; const p = r.pts; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1], [d, t] = segDist(x, z, a[0], a[1], b[0], b[1]), v = d - (a[2] + (b[2] - a[2]) * t); if (v < best) best = v; } return best; };
  const riverById = {}; for (const r of RIVERS) riverById[r.id] = r;
  /* signed distance to a river bank (negative = in the river); all rivers when id is omitted */
  world.riverSd = (x, z, id) => { if (id) return riverSd1(riverById[id], x, z); let b = 1e9; for (const r of RIVERS) b = Math.min(b, riverSd1(r, x, z)); return b; };
  const lakeSd = (x, z) => { let b = 1e9; for (const l of LAKES) { const e = l.e; b = Math.min(b, (Math.hypot((x - e[0]) / e[2], (z - e[1]) / e[3]) - 1) * Math.min(e[2], e[3])); } return b; };
  world.riverDist = (x, z) => Math.max(0, Math.min(world.riverSd(x, z), lakeSd(x, z)));
  /* how far east of the Tualatin / Forest Park crest a point is (<= 0: on or behind the ridge) */
  world.ridgeDx = (x, z) => {
    const R = RIDGE; if (z <= R[0][1]) return x - (R[0][0] - (R[0][1] - z) * 1.4);
    for (let i = 0; i < R.length - 1; i++) if (z <= R[i + 1][1]) return x - (R[i][0] + (R[i + 1][0] - R[i][0]) * (z - R[i][1]) / (R[i + 1][1] - R[i][1]));
    return x - R[R.length - 1][0];
  };
  const colPts = riverById.columbia.pts.slice(3);
  const colZ = x => { for (let i = 0; i < colPts.length - 1; i++) if (x <= colPts[i + 1][0]) return colPts[i][1] + (colPts[i + 1][1] - colPts[i][1]) * (x - colPts[i][0]) / (colPts[i + 1][0] - colPts[i][0]); return colPts[colPts.length - 1][1]; };
  /* 0..1: on the far (Washington) bank of the Columbia */
  world.farShore = (x, z) => { const sd = riverSd1(riverById.columbia, x, z); if (sd <= 0) return 0; return (x > 30 ? z < colZ(x) : (z < -160 && x > 8)) ? smooth(0, 110, sd) : 0; };
  const sauvieMask = (x, z) => softRect(x, z, -150, -115, 225, 195, 22);
  const flatMask = (x, z) => { let m = 0; for (const f of FLATS) m = Math.max(m, softRect(x, z, f[0], f[1], f[2], f[3], f[4])); return m; };

  function rawHeight(x, z) {
    const flat = flatMask(x, z), hill = 1 - smooth(0, RIDGE_W, world.ridgeDx(x, z)), far = world.farShore(x, z), sv = sauvieMask(x, z);
    const amp = (1.4 + 3.4 * hill + 5 * far) * (1 - flat) * (1 - sv * 0.7);
    let h = lerp(BASE_Y, 2.5, sv) + (fbm(x * 0.012 + 7.3, z * 0.012 + 3.1, 3) - 0.5) * 2 * amp;
    h += RIDGE_H * hill * (0.78 + 0.44 * fbm(x * 0.02 + 11, z * 0.02 + 5, 2)) + far * (13 + 9 * fbm(x * 0.015 + 3, z * 0.015 + 9, 2));
    for (const b of BUMPS) h += b[2] * Math.exp(-((x - b[0]) ** 2 + (z - b[1]) ** 2) / (2 * b[3] * b[3]));
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (r > HALF - 8) h += ((r - HALF + 8) / 48) ** 2 * 30 * (0.7 + 0.6 * fbm(x * 0.02, z * 0.02, 2));
    for (const p of PADS) { const k = 1 - smooth(p[2], p[2] + p[3], Math.hypot(x - p[0], z - p[1])); if (k > 0) h = lerp(h, p[4], k); }
    let sd = Math.min(world.riverSd(x, z), lakeSd(x, z));
    for (const il of ISLANDS) { const e = il.e, k = 1 - smooth(0.72, 1.12, Math.hypot((x - e[0]) / e[2], (z - e[1]) / e[3])); if (k > 0) { sd = lerp(sd, 22, k); h = lerp(h, il.h + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 0.8, k); } }
    sd += (fbm(x * 0.05 + 2, z * 0.05, 2) - 0.5) * 5;
    return lerp(h, -3.4, 1 - smooth(-7, 7, sd));
  }

  /* ---------- heightfield ---------- */
  const H = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = rawHeight(-EXT + i * CELL, -EXT + j * CELL);
  world.heightAt = (x, z) => {
    const fx = clamp((x + EXT) / CELL, 0, N - 0.0001), fz = clamp((z + EXT) / CELL, 0, N - 0.0001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, o = j * (N + 1) + i;
    const a = H[o], b = H[o + 1], c = H[o + N + 1], d = H[o + N + 2];
    return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d);
  };
  world.normalAt = (x, z, out) => { const e = 1.2; const dx = world.heightAt(x + e, z) - world.heightAt(x - e, z), dz = world.heightAt(x, z + e) - world.heightAt(x, z - e); return out.set(-dx, 2 * e, -dz).normalize(); };
  world.slopeAt = (x, z) => { const e = 1.2; return Math.hypot(world.heightAt(x + e, z) - world.heightAt(x - e, z), world.heightAt(x, z + e) - world.heightAt(x, z - e)) / (2 * e); };
  world.waterDepth = (x, z) => WATER_Y - world.heightAt(x, z);

  /* ---------- roads ---------- */
  for (const r of ROADS) world.roads.push({ ...r, path: smoothPath(r.pts, r.kind === 'trail' ? 5 : 4) });
  world.roadById = id => world.roads.find(r => r.id === id);
  world.roadDist = (id, x, z) => polyDist(x, z, world.roadById(id).pts);
  /* the railway centre line (corners rounded); the train, the track geometry and the tree planter all use this one path */
  world.rail = smoothPath(RAIL, 4);
  world.railDist = (x, z) => polyDist(x, z, RAIL);

  /* surface grid: 0 grass, 1 road, 2 trail/gravel, 3 sand, 4 water, 5 paving */
  const SG = 720, SCELL = (EXT * 2) / SG, surf = new Uint8Array(SG * SG);
  {
    const c = document.createElement('canvas'); c.width = c.height = SG; const x = c.getContext('2d', { willReadFrequently: true });
    const px = v => (v + EXT) / SCELL;
    x.fillStyle = '#000'; x.fillRect(0, 0, SG, SG); x.lineCap = 'round'; x.lineJoin = 'round';
    for (const p of PATCHES) if (p[5] === 5 || p[5] === 3) { x.fillStyle = p[5] === 5 ? '#00f' : '#ff0'; x.fillRect(px(p[0]), px(p[1]), (p[2] - p[0]) / SCELL, (p[3] - p[1]) / SCELL); }
    const stroke = (path, w, col) => { x.strokeStyle = col; x.lineWidth = Math.max(1.5, w / SCELL); x.beginPath(); path.forEach((p, i) => i ? x.lineTo(px(p[0]), px(p[1])) : x.moveTo(px(p[0]), px(p[1]))); x.stroke(); };
    for (const r of world.roads) if (r.kind === 'walk') stroke(r.path, r.w, '#00f');
    for (const r of world.roads) if (r.kind === 'trail' || r.kind === 'gravel') stroke(r.path, r.w, '#0f0');
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w, '#f00');
    const d = x.getImageData(0, 0, SG, SG).data;
    for (let j = 0; j < SG; j++) for (let i = 0; i < SG; i++) {
      const o = (j * SG + i) * 4, wx = -EXT + (i + 0.5) * SCELL, wz = -EXT + (j + 0.5) * SCELL, h = world.heightAt(wx, wz);
      surf[j * SG + i] = h < -0.05 ? 4 : d[o] > 120 && d[o + 1] > 120 ? 3 : d[o] > 120 ? 1 : d[o + 1] > 120 ? 2 : d[o + 2] > 120 ? 5 : h < 1.1 ? 3 : 0;
    }
  }
  world.surfaceAt = (x, z) => surf[clamp(((z + EXT) / SCELL) | 0, 0, SG - 1) * SG + clamp(((x + EXT) / SCELL) | 0, 0, SG - 1)];
  world.SURF = ['grass', 'road', 'trail', 'sand', 'water', 'paving'];

  /* ---------- zones ---------- */
  world.zoneAt = (x, z) => {
    const h = world.heightAt(x, z);
    for (const zn of ZONES) {
      if (zn.rect) { if (x >= zn.rect[0] && z >= zn.rect[1] && x <= zn.rect[2] && z <= zn.rect[3]) return zn; }
      else if (zn.circle) { if (Math.hypot(x - zn.circle[0], z - zn.circle[1]) <= zn.circle[2]) return zn; }
      else if (zn.ellipse) { if (Math.hypot((x - zn.ellipse[0]) / zn.ellipse[2], (z - zn.ellipse[1]) / zn.ellipse[3]) <= 1) return zn; }
      else if (zn.fn(x, z, h, world)) return zn;
    }
    return ZONES[ZONES.length - 1];
  };

  /* ---------- colliders (spatial hash) ---------- */
  const CS = 16, grid = new Map(), key = (i, j) => i * 4096 + j;
  let cid = 0;
  function insert(c) {
    const i0 = Math.floor((c.minx - 1) / CS), i1 = Math.floor((c.maxx + 1) / CS), j0 = Math.floor((c.minz - 1) / CS), j1 = Math.floor((c.maxz + 1) / CS);
    c.cells = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i + 1000, j + 1000); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); c.cells.push(a); }
    c.remove = () => { for (const a of c.cells) { const n = a.indexOf(c); if (n >= 0) a.splice(n, 1); } };
    return c;
  }
  world.addBox = (minx, minz, maxx, maxz, top = 1e9, bottom = -1e9, tag = null) => insert({ id: ++cid, box: true, minx, minz, maxx, maxz, top, bottom, tag });
  world.addCircle = (x, z, r, top = 1e9, bottom = -1e9, tag = null) => insert({ id: ++cid, box: false, x, z, r, minx: x - r, maxx: x + r, minz: z - r, maxz: z + r, top, bottom, tag });
  const _seen = new Set();
  world.queryColliders = (x, z, r, fn) => {
    const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS), j0 = Math.floor((z - r) / CS), j1 = Math.floor((z + r) / CS);
    if (i0 === i1 && j0 === j1) { const a = grid.get(key(i0 + 1000, j0 + 1000)); if (a) for (let n = 0; n < a.length; n++) fn(a[n]); return; }
    _seen.clear();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = grid.get(key(i + 1000, j + 1000)); if (a) for (let n = 0; n < a.length; n++) { const c = a[n]; if (!_seen.has(c.id)) { _seen.add(c.id); fn(c); } } }
  };
  const STEP = 0.62;
  /* push a circle (pos.x, pos.z, radius r) standing at height y out of solid things. Returns true if it touched anything. */
  world.resolve = (pos, r, y, bodyH = 0.9) => {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) world.queryColliders(pos.x, pos.z, r + 0.5, c => {
      if (c.top <= y + STEP || c.bottom >= y + bodyH) return;
      if (c.box) {
        const nx = clamp(pos.x, c.minx, c.maxx), nz = clamp(pos.z, c.minz, c.maxz); let dx = pos.x - nx, dz = pos.z - nz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        hit = true;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
        else {
          const l = pos.x - c.minx, rr = c.maxx - pos.x, t = pos.z - c.minz, b = c.maxz - pos.z, m = Math.min(l, rr, t, b);
          if (m === l) pos.x = c.minx - r; else if (m === rr) pos.x = c.maxx + r; else if (m === t) pos.z = c.minz - r; else pos.z = c.maxz + r;
        }
      } else {
        const dx = pos.x - c.x, dz = pos.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) return;
        hit = true; const d = Math.sqrt(d2) || 0.001; pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr;
      }
    });
    return hit;
  };
  /* walkable surface under a point for something whose feet are at y */
  world.groundAt = (x, z, y = 1e9) => {
    let g = world.heightAt(x, z);
    world.queryColliders(x, z, 0.1, c => {
      if (c.top > y + STEP || c.top <= g) return;
      if (c.box ? (x >= c.minx && x <= c.maxx && z >= c.minz && z <= c.maxz) : ((x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r)) g = c.top;
    });
    return g;
  };
  /* is a point free of solid colliders (for spawning / exits / camera)? */
  world.blockedAt = (x, z, y, r = 0.4) => {
    let b = false;
    world.queryColliders(x, z, r, c => {
      if (b || c.top <= y + 0.2 || c.bottom >= y + 0.5) return;
      if (c.box) { const nx = clamp(x, c.minx, c.maxx), nz = clamp(z, c.minz, c.maxz); if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) b = true; }
      else if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) b = true;
    });
    return b;
  };

  /* view volumes: things the camera must not end up inside although KC can walk under or through them
     (tree canopies, stall and stage roofs, a marquee). { x, z, r, bottom, top, shape: 'cone' | 'ball' | 'cyl' } or { box: [minx, minz, maxx, maxz], bottom, top } */
  const vgrid = new Map();
  world.addView = v => {
    const b = v.box || [v.x - v.r, v.z - v.r, v.x + v.r, v.z + v.r], cells = [];
    for (let i = Math.floor(b[0] / CS); i <= Math.floor(b[2] / CS); i++) for (let j = Math.floor(b[1] / CS); j <= Math.floor(b[3] / CS); j++) { const k = key(i + 1000, j + 1000); let a = vgrid.get(k); if (!a) vgrid.set(k, a = []); a.push(v); cells.push(a); }
    v.remove = () => { for (const a of cells) { const n = a.indexOf(v); if (n >= 0) a.splice(n, 1); } };
    return v;
  };
  const viewBlocked = (x, z, y) => {
    const a = vgrid.get(key(Math.floor(x / CS) + 1000, Math.floor(z / CS) + 1000)); if (!a) return false;
    for (let n = 0; n < a.length; n++) {
      const v = a[n]; if (y < v.bottom || y > v.top) continue;
      if (v.box) { if (x > v.box[0] && x < v.box[2] && z > v.box[1] && z < v.box[3]) return true; continue; }
      const d2 = (x - v.x) ** 2 + (z - v.z) ** 2;
      if (v.shape === 'cone') { const rr = v.r * (1 - (y - v.bottom) / (v.top - v.bottom)); if (d2 < rr * rr) return true; }
      else if (v.shape === 'ball') { const dy = (y - (v.bottom + v.top) / 2) / ((v.top - v.bottom) / 2); if (d2 / (v.r * v.r) + dy * dy < 1) return true; }
      else if (d2 < v.r * v.r) return true;
    }
    return false;
  };
  /* camera only minds big solid things (buildings, big trunks, tents) and the view volumes above, never lamp posts or saplings */
  world.camBlocked = (x, z, y) => {
    if (viewBlocked(x, z, y + 0.3)) return true;
    let b = false;
    world.queryColliders(x, z, 0.4, c => {
      if (b || c.top <= y || c.bottom >= y + 0.3 || c.top - c.bottom < 2.5) return;   /* decks and low props never block the view */
      if (c.box) { if (c.maxx - c.minx < 1 || c.maxz - c.minz < 1) return; if (x > c.minx - 0.35 && x < c.maxx + 0.35 && z > c.minz - 0.35 && z < c.maxz + 0.35) b = true; }
      else if (c.r >= 1.3 && (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.2) ** 2) b = true;
    });
    return b;
  };

  /* ---------- ground texture (also the base of the minimap) ---------- */
  function paintGround(T) {
    const cv = document.createElement('canvas'); cv.width = cv.height = T; const x = cv.getContext('2d');
    const B = 384, bc = document.createElement('canvas'); bc.width = bc.height = B; const bx = bc.getContext('2d'), img = bx.createImageData(B, B), d = img.data;
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const GR = [112, 172, 86], FO = [66, 122, 68], SA = [222, 202, 150], RK = [124, 126, 130], MU = [150, 130, 96], WA = [70, 140, 176], FA = [156, 184, 92], TOWN = [124, 184, 100], LAWN = [128, 198, 106], DRY = [176, 178, 104];
    const towns = [[-470, -420, -96, -118], [-320, 10, -226, 114], [-150, 296, 9, 505], [120, 236, 330, 505]];
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
      const wx = -EXT + (i + 0.5) * (2 * EXT / B), wz = -EXT + (j + 0.5) * (2 * EXT / B), h = world.heightAt(wx, wz), s = world.slopeAt(wx, wz);
      const hill = 1 - smooth(0, RIDGE_W * 1.1, world.ridgeDx(wx, wz)), far = world.farShore(wx, wz), rim = smooth(HALF - 14, HALF, Math.max(Math.abs(wx), Math.abs(wz)));
      let c = mix(GR, FO, clamp(Math.max(hill, far, rim), 0, 1) * 0.92);
      for (const t of towns) c = mix(c, TOWN, softRect(wx, wz, t[0], t[1], t[2], t[3], 10) * 0.55);
      const sv = sauvieMask(wx, wz); c = mix(c, fbm(wx * 0.02 + 40, wz * 0.02, 2) > 0.52 ? DRY : FA, sv * 0.6);
      if (wx > 9 && wx < 112 && wz > 300 && wz < 505) c = mix(c, LAWN, 0.8);
      const n = fbm(wx * 0.06, wz * 0.06, 3); c = mix(c, [c[0] * 0.82, c[1] * 0.86, c[2] * 0.8], n);
      c = mix(c, RK, smooth(0.5, 0.85, s)); c = mix(c, RK, Math.exp(-((wx + 330) ** 2 + (wz + 438) ** 2) / (2 * 20 * 20)) * 0.9);
      c = mix(c, SA, 1 - smooth(0.7, 1.7, h)); c = mix(c, MU, 1 - smooth(-0.6, 0.2, h)); c = mix(c, WA, 1 - smooth(-1.6, -0.5, h));
      const o = (j * B + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    bx.putImageData(img, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(bc, 0, 0, T, T);
    const k = T / (2 * EXT), px = v => (v + EXT) * k, R = rng(77);
    /* grass speckle */
    for (let i = 0; i < T * 5; i++) { const sx = R() * T, sz = R() * T; x.fillStyle = R() < 0.5 ? 'rgba(255,255,220,.05)' : 'rgba(0,40,10,.06)'; x.fillRect(sx, sz, 1 + R() * 3, 1 + R() * 3); }
    const rect = (x0, z0, x1, z1, col) => { x.fillStyle = col; x.fillRect(px(x0), px(z0), (x1 - x0) * k, (z1 - z0) * k); };
    const stroke = (path, w, col, dash) => { x.strokeStyle = col; x.lineWidth = w * k; x.lineJoin = 'round'; x.lineCap = dash ? 'butt' : 'round'; x.setLineDash(dash ? dash.map(v => v * k) : []); x.beginPath(); path.forEach((p, i) => i ? x.lineTo(px(p[0]), px(p[1])) : x.moveTo(px(p[0]), px(p[1]))); x.stroke(); x.setLineDash([]); };
    /* crop fields */
    for (const [x0, z0, x1, z1, kind] of FIELDS) {
      if (kind === 'pumpkin') { rect(x0, z0, x1, z1, '#8a6a42'); for (let fz = z0 + 1.5; fz < z1 - 1; fz += 3.2) rect(x0 + 1, fz, x1 - 1, fz + 1.3, '#6f9a45'); }
      else if (kind === 'corn') rect(x0, z0, x1, z1, '#b9a85a');
      else if (kind === 'rows') { rect(x0, z0, x1, z1, '#9a7648'); const ax = x1 - x0 > z1 - z0; for (let f = (ax ? z0 : x0) + 1; f < (ax ? z1 : x1) - 1; f += 3) ax ? rect(x0 + 1, f, x1 - 1, f + 1.4, (Math.round(f) % 2) ? '#7fae4c' : '#c9b24a') : rect(f, z0 + 1, f + 1.4, z1 - 1, (Math.round(f) % 2) ? '#7fae4c' : '#c9b24a'); }
      else if (kind === 'pasture') rect(x0, z0, x1, z1, '#96c868');
      else rect(x0, z0, x1, z1, '#88bc62');
    }
    /* lawns, lots, plazas */
    for (const p of PATCHES) rect(p[0], p[1], p[2], p[3], p[4]);
    /* paving joints, road lines and zebra stripes are thin geometry (scenery.js): paint that fine would smear at this texture size */
    /* plaza ring around the Lantern Stack, splash pad, skate lines */
    x.fillStyle = '#d6c7ad'; x.beginPath(); x.arc(px(-170), px(-250), 8 * k, 0, 7); x.fill(); x.strokeStyle = '#8a5a42'; x.lineWidth = 0.5 * k; x.beginPath(); x.arc(px(-170), px(-250), 8 * k, 0, 7); x.stroke();
    x.fillStyle = '#7fc4e8'; x.beginPath(); x.arc(px(-122), px(-164), 6 * k, 0, 7); x.fill(); x.strokeStyle = '#eaf6ff'; x.lineWidth = 0.4 * k; for (const rr of [2, 4]) { x.beginPath(); x.arc(px(-122), px(-164), rr * k, 0, 7); x.stroke(); }
    x.fillStyle = '#c9b98f'; x.fillRect(px(-388), px(-104), 22 * k, 16 * k);   /* agility sand */
    /* creek and rails */
    stroke(CREEK, 4.2, 'rgba(120,150,110,.8)'); stroke(CREEK, 2.8, '#78b6d6'); stroke(CREEK, 0.5, 'rgba(255,255,255,.5)', [1.5, 3]);
    stroke(world.rail, 4.2, '#8f8878'); stroke(world.rail, 3.4, '#9a9488');   /* ballast bed only: sleepers and rails are real geometry (scenery.js), which stays sharp */
    for (const r of world.roads) if (r.kind === 'trail') { stroke(r.path, r.w + 0.8, 'rgba(120,96,60,.55)'); stroke(r.path, r.w, '#c4a26c'); }
    for (const r of world.roads) if (r.kind === 'gravel') { stroke(r.path, r.w + 1, '#8a8474'); stroke(r.path, r.w, '#b3ab98'); }
    for (const r of world.roads) if (r.kind === 'walk') { stroke(r.path, r.w + 0.6, '#a39c8c'); stroke(r.path, r.w, '#d2cab8'); }
    /* sidewalks in the towns, then asphalt, then markings */
    x.save(); x.beginPath(); for (const t of towns) x.rect(px(t[0]), px(t[1]), (t[2] - t[0]) * k, (t[3] - t[1]) * k); x.clip();
    for (const r of world.roads) if (r.kind === 'road' && r.id !== 'hwy30') stroke(r.path, r.w + 5.5, '#cfc8ba');
    x.restore();
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w + 0.8, '#4a4c52');
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w, '#5d6068');
    /* zebra crossings: a pale band for the map; the crisp stripes are geometry */
    for (const [cx, cz, ns] of CROSSWALKS) ns ? rect(cx - 4, cz - 1.6, cx + 4, cz + 1.6, 'rgba(238,238,234,.5)') : rect(cx - 1.6, cz - 4, cx + 1.6, cz + 4, 'rgba(238,238,234,.5)');
    /* the water wins back anything painted across it (bridges carry their own decks) */
    { const m = document.createElement('canvas'); m.width = m.height = B; const mx = m.getContext('2d'), mi = mx.createImageData(B, B);
      for (let q = 0; q < B * B; q++) { const hh = world.heightAt(-EXT + ((q % B) + 0.5) * (2 * EXT / B), -EXT + (((q / B) | 0) + 0.5) * (2 * EXT / B)); mi.data[q * 4] = WA[0]; mi.data[q * 4 + 1] = WA[1]; mi.data[q * 4 + 2] = WA[2]; mi.data[q * 4 + 3] = hh < -0.9 ? 255 : hh < -0.2 ? 255 * (-0.2 - hh) / 0.7 : 0; }
      mx.putImageData(mi, 0, 0); x.drawImage(m, 0, 0, T, T); }
    return cv;
  }

  let groundTex = null, terrain = null;
  const sunDir = new THREE.Vector3(0.4, 0.8, 0.3);
  function buildTerrain() {
    const g = new THREE.BufferGeometry(), pos = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2), idx = new Uint16Array(N * N * 6);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const o = j * (N + 1) + i; pos[o * 3] = -EXT + i * CELL; pos[o * 3 + 1] = H[o]; pos[o * 3 + 2] = -EXT + j * CELL; uv[o * 2] = i / N; uv[o * 2 + 1] = 1 - j / N; }
    let q = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    const cv = paintGround(game.quality.texSize);
    world.groundCanvas = cv;
    groundTex = new THREE.CanvasTexture(cv); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = Math.min(4, game.renderer.capabilities.getMaxAnisotropy());
    terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: groundTex }));
    terrain.receiveShadow = true; terrain.matrixAutoUpdate = false; terrain.name = 'terrain';
    scene.add(terrain);
  }
  buildTerrain();

  /* ---------- water ---------- */
  const wc = document.createElement('canvas'); wc.width = wc.height = 128;
  { const x = wc.getContext('2d'); x.fillStyle = '#4a97c9'; x.fillRect(0, 0, 128, 128); const R = rng(5); x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2; x.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const a = R() * 128, b = R() * 128, l = 8 + R() * 16; for (const ox of [-128, 0, 128]) { x.beginPath(); x.moveTo(a + ox, b); x.quadraticCurveTo(a + ox + l / 2, b - 3, a + ox + l, b); x.stroke(); } } }
  const waterTex = new THREE.CanvasTexture(wc); waterTex.colorSpace = THREE.SRGBColorSpace; waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(96, 96);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2, EXT * 2), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.86 }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; water.name = 'water'; water.renderOrder = 1; scene.add(water);

  /* ---------- sky, sun, lights ---------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 glow; varying vec3 vDir; void main(){ vec3 d = normalize(vDir); float t = pow(clamp(d.y*1.15+0.02,0.0,1.0),0.55); vec3 c = mix(hor, top, t); float s = max(dot(d, sunDir),0.0); c += glow * (pow(s,24.0)*0.35 + pow(s,400.0)*1.5); gl_FragColor = vec4(c,1.0); }'
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 20, 12), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; sky.name = 'sky'; scene.add(sky);
  const starGeo = new THREE.BufferGeometry(); { const R = rng(9), p = []; for (let i = 0; i < 260; i++) { const a = R() * 6.283, y = 0.08 + R() * 0.9, r = Math.sqrt(1 - y * y); p.push(Math.cos(a) * r * 560, y * 560, Math.sin(a) * r * 560); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); stars.frustumCulled = false; stars.renderOrder = -9; scene.add(stars);
  /* clouds: one instanced mesh of flat puffs */
  const cloudGeo = new THREE.SphereGeometry(1, 7, 5); const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.9, depthWrite: false });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 36); clouds.frustumCulled = false; clouds.renderOrder = -8; scene.add(clouds);
  const cloudData = []; { const R = rng(31); for (let i = 0; i < 12; i++) { const cx = (R() - 0.5) * 900, cz = (R() - 0.5) * 900, cy = 150 + R() * 60; for (let p = 0; p < 3; p++) cloudData.push({ x: cx + (p - 1) * 22 + R() * 8, y: cy + R() * 5, z: cz + R() * 12, sx: 20 + R() * 16, sy: 6 + R() * 4, sz: 14 + R() * 10 }); } }
  /* far-off volcanoes: they ride with the camera so they always sit on the horizon */
  const peaks = (() => {
    const g = new Geo(), R = rng(1980);
    /* each peak is a stack of rings; the lowest, widest ring is the colour of the horizon haze, so the mountain rises out of the haze instead of hanging above the rim hills */
    const peak = (ang, dist, baseR, h, topR, cols, crater) => {
      const cx = Math.sin(ang) * dist, cz = -Math.cos(ang) * dist, seg = 16, prof = [[-0.06, 1.7], [0.1, 1.08], [0.32, 0.62], [0.58, 0.36], [0.8, 0.17], [1, 0]], last = prof.length - 1, jit = [];
      for (let i = 0; i < seg; i++) jit.push(0.88 + R() * 0.26);
      const P = (ri, i) => { const [t, f] = prof[ri], r = (topR + (baseR - topR) * f) * (ri === last || ri === 0 ? 1 : jit[i % seg]), a = (i / seg) * TAU; return [cx + Math.cos(a) * r, -16 + t * h * (ri === last ? 0.94 + 0.08 * jit[(i * 3) % seg] : 1), cz + Math.sin(a) * r]; };
      for (let ri = 0; ri < last; ri++) for (let i = 0; i < seg; i++) { const c = cols[ri]; g.quad(P(ri, i), P(ri + 1, i), P(ri + 1, i + 1), P(ri, i + 1), (i + ri) % 2 ? c[0] : c[1], [cx, h * 0.3, cz]); }
      for (let i = 0; i < seg; i++) g.tri(P(last, i), [cx, -16 + h * (crater ? 0.9 : 1.02), cz], P(last, i + 1), crater ? 0xdfe6ee : 0xffffff, [cx, 0, cz]);
    };
    const HAZE = [0xd3e2ee, 0xcfdfec], C1 = [HAZE, [0x9db0bd, 0x97abb9], [0x8fa5b3, 0x869dac], [0xc3ced8, 0xb4c2ce], [0xffffff, 0xf0f4f8]];
    peak(0.72, 540, 150, 74, 40, C1, true);                                   /* Mount St. Helens, north-east: broad, flat-topped */
    peak(1.04, 580, 84, 44, 14, [HAZE, [0xa9bac6, 0xa3b5c2], [0x9fb2bf, 0x98acba], [0xd0d8e0, 0xc4d0da], [0xffffff, 0xf4f6fa]], false);   /* Mount Adams, further off behind it */
    peak(1.98, 560, 118, 78, 5, C1, false);                                  /* Mount Hood, east-south-east: sharp, on a broad base */
    const m = new THREE.Mesh(g.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false })); m.frustumCulled = false; m.renderOrder = -9; m.name = 'peaks'; scene.add(m); return m;
  })();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); scene.add(sun); scene.add(sun.target);
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42; sun.shadow.camera.near = 10; sun.shadow.camera.far = 260; sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.6;
  scene.fog = new THREE.Fog(0xcfe6f5, 60, 200);
  const festFog = new THREE.Color(0xb9a6a0), white = new THREE.Color(0xffffff); let fogBase = 200, festK = 0, festHere = 0;
  world.sun = sun; world.hemi = hemi; world.sunDir = sunDir;

  const KEYS = [
    [0, 0x0a1230, 0x1c2a4e, 0x9fb4e6, 0.95, 0.9, 0x7f8fc0],
    [5, 0x0a1230, 0x1c2a4e, 0x9fb4e6, 0.95, 0.9, 0x7f8fc0],
    [6.4, 0x4f74b8, 0xf2b08a, 0xffc59a, 1.7, 0.95, 0xffd0a8],
    [8, 0x3f8fe0, 0xb7d8f0, 0xfff3dc, 2.5, 1.25, 0xffffff],
    [17, 0x3f8fe0, 0xb7d8f0, 0xfff3dc, 2.5, 1.25, 0xffffff],
    [19, 0x3f4a8a, 0xf2946a, 0xffae78, 1.7, 1.05, 0xffc8a0],
    [20.6, 0x0a1230, 0x1c2a4e, 0x9fb4e6, 0.95, 0.9, 0x7f8fc0],
    [24, 0x0a1230, 0x1c2a4e, 0x9fb4e6, 0.95, 0.9, 0x7f8fc0]
  ].map(k => ({ t: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), si: k[4], hi: k[5], amb: new THREE.Color(k[6]) }));
  const cTop = new THREE.Color(), cHor = new THREE.Color(), cSun = new THREE.Color(), cAmb = new THREE.Color(), grey = new THREE.Color(0x8f9aa6), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3();
  world.phaseOf = t => (t < 5.5 || t >= 20.5 ? 'night' : t < 8 ? 'dawn' : t < 17.5 ? 'day' : 'dusk');
  let lastPhase = null;
  function applySky(camPos, focus) {
    const t = world.time; let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    cTop.lerpColors(a.top, b.top, f); cHor.lerpColors(a.hor, b.hor, f); cSun.lerpColors(a.sun, b.sun, f); cAmb.lerpColors(a.amb, b.amb, f);
    let si = lerp(a.si, b.si, f), hi = lerp(a.hi, b.hi, f);
    if (world.rain > 0) { cTop.lerp(grey, world.rain * 0.6); cHor.lerp(grey, world.rain * 0.5); si *= 1 - world.rain * 0.4; }
    world.night = clamp(t < 12 ? 1 - smooth(5.2, 6.8, t) : smooth(18.8, 20.6, t), 0, 1);
    const day = t >= 6 && t < 19.5, ang = day ? ((t - 6) / 13.5) * Math.PI : (((t + 24 - 19.5) % 24) / 10.5) * Math.PI;
    sunDir.set(Math.cos(ang) * 0.85, Math.max(0.16, Math.sin(ang)), 0.42).normalize();
    skyMat.uniforms.top.value.copy(cTop); skyMat.uniforms.hor.value.copy(cHor); skyMat.uniforms.sunDir.value.copy(sunDir); skyMat.uniforms.glow.value.copy(cSun).multiplyScalar(day ? 1 : 0.55);
    scene.fog.color.copy(cHor); if (festHere > 0) scene.fog.color.lerp(festFog, festHere * 0.35 * (1 - world.night * 0.6));
    peaks.position.copy(camPos); peaks.position.y = 0; peaks.material.color.copy(white).lerp(cHor, 0.42).multiplyScalar(1 - world.night * 0.55 - world.rain * 0.25); peaks.visible = world.rain < 0.75;
    sun.color.copy(cSun); sun.intensity = si; hemi.intensity = hi; hemi.color.copy(cAmb); hemi.groundColor.setRGB(cAmb.r * 0.45, cAmb.g * 0.5, cAmb.b * 0.42);
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 120);
    sky.position.copy(camPos); stars.position.copy(camPos); stars.renderOrder = -9.5; stars.material.opacity = world.night * 0.9 * (1 - world.rain);
    cloudMat.color.copy(cHor).lerp(white, 0.55 * (1 - world.night)).multiplyScalar(1 - world.rain * 0.25); cloudMat.opacity = 0.55 + world.rain * 0.35;
    water.material.color.setRGB(0.55 + 0.45 * (1 - world.night), 0.6 + 0.4 * (1 - world.night), 0.7 + 0.3 * (1 - world.night));
    const ph = world.phaseOf(t); if (ph !== lastPhase) { if (lastPhase) game.bus.emit('timeOfDay', { phase: ph, time: t, day: world.day }); lastPhase = ph; }
  }

  /* ---------- rain ---------- */
  const RN = 320, rainPos = new Float32Array(RN * 6), rainSeed = []; { const R = rng(3); for (let i = 0; i < RN; i++) rainSeed.push([R() * 44 - 22, R() * 26, R() * 44 - 22, 16 + R() * 8]); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMesh = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe0f0, transparent: true, opacity: 0.4, fog: false })); rainMesh.frustumCulled = false; rainMesh.visible = false; scene.add(rainMesh);
  let weatherT = 240 + Math.random() * 240, rainTarget = 0, cloudT = 0;
  world.setRain = v => { rainTarget = clamp(v, 0, 1); weatherT = 200; };

  /* ---------- scenery + flora ---------- */
  const scenery = buildScenery(game, world);
  const flora = buildFlora(game, world);
  world.scenery = scenery; world.flora = flora;
  world.mapCanvas = (() => {
    const S = game.quality.name === 'low' ? 1024 : 2048, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.drawImage(world.groundCanvas, 0, 0, S, S);
    const k = S / (2 * EXT), px = v => (v + EXT) * k;
    for (const t of flora.trees) { x.fillStyle = t[2] ? 'rgba(58,128,62,.8)' : 'rgba(38,92,58,.8)'; x.beginPath(); x.arc(px(t[0]), px(t[1]), 1.6 * t[3] * k, 0, 7); x.fill(); }
    x.fillStyle = '#b08a5a'; for (const b of scenery.decks) x.fillRect(px(b[0]), px(b[1]), (b[2] - b[0]) * k, (b[3] - b[1]) * k);
    x.fillStyle = '#8a5a3c'; x.strokeStyle = '#4a3020'; x.lineWidth = 1;
    for (const b of scenery.footprints) { x.fillRect(px(b[0]), px(b[1]), (b[2] - b[0]) * k, (b[3] - b[1]) * k); x.strokeRect(px(b[0]), px(b[1]), (b[2] - b[0]) * k, (b[3] - b[1]) * k); }
    return c;
  })();
  world.mapScale = world.mapCanvas.width / (2 * EXT);
  /* the painted ground now lives on the GPU and in the map copy: give its big CPU-side canvas back (a lost context reloads the page, so it is never re-uploaded) */
  try { game.renderer.initTexture(groundTex); world.groundCanvas.width = world.groundCanvas.height = 1; world.groundCanvas = null; } catch (e) { /* keep the canvas */ }

  /* the festival mist belongs to old town: full strength around the plaza, gone a few blocks out, thin by day and thick after dark */
  const setFog = () => { const far = fogBase * lerp(1, lerp(0.72, 0.62, world.night), festHere); scene.fog.near = far * lerp(0.42, lerp(0.4, 0.14, world.night), festHere); scene.fog.far = far; world.viewFar = far; };
  world.applyQuality = q => {
    fogBase = q.fog; setFog();
    game.renderer.shadowMap.enabled = !!q.shadows; sun.castShadow = !!q.shadows;
    scenery.setShadows(!!q.shadows); flora.setQuality(q);
    terrain.material.needsUpdate = true; scenery.material.needsUpdate = true;
    clouds.visible = q.clouds !== false;
  };
  /* the Fog Bell Festival dressing layer: lanterns, bunting, painted pumpkins and river fog */
  world.setFestival = on => { world.festival = !!on; scenery.setFestival(world.festival); };

  const camPosPrev = new THREE.Vector3();
  world.update = (dt, camPos, focus) => {
    /* day / night */
    const prev = world.time;
    world.time = (world.time + (dt * 24) / world.dayLength) % 24;
    if (world.time < prev) { world.day++; game.state.day = world.day; game.state.stats.days = world.day; game.bus.emit('dayChange', { day: world.day }); }
    game.state.time = world.time;
    /* weather */
    weatherT -= dt;
    if (weatherT <= 0) {
      weatherT = 150 + Math.random() * 200;
      const want = game.state.settings.rain && rainTarget === 0 && Math.random() < 0.28 ? 0.5 + Math.random() * 0.5 : 0;
      if (want !== rainTarget) { rainTarget = want; game.bus.emit('weather', { rain: want }); }
    }
    if (!game.state.settings.rain) rainTarget = 0;
    world.rain += clamp(rainTarget - world.rain, -dt * 0.1, dt * 0.1);
    const fk = world.festival ? 1 : 0; if (festK !== fk) festK += clamp(fk - festK, -dt * 0.5, dt * 0.5);
    { const h = festK > 0 ? festK * (1 - smooth(170, 330, Math.hypot(focus.x - PLAZA.x, focus.z - PLAZA.z))) : 0; if (h !== festHere || h > 0) { festHere = h; setFog(); } }
    applySky(camPos, focus);
    waterTex.offset.x += dt * 0.006; waterTex.offset.y += dt * 0.011;
    rainMesh.visible = world.rain > 0.02;
    if (rainMesh.visible) {
      rainMesh.material.opacity = 0.42 * world.rain; const tt = performance.now() / 1000; const n = Math.floor(RN * world.rain);
      for (let i = 0; i < RN; i++) {
        const s = rainSeed[i], y = i < n ? (((s[1] - tt * s[3]) % 26) + 26) % 26 - 6 : -999, o = i * 6;
        rainPos[o] = camPos.x + s[0]; rainPos[o + 1] = camPos.y + y; rainPos[o + 2] = camPos.z + s[2]; rainPos[o + 3] = camPos.x + s[0] + 0.12; rainPos[o + 4] = camPos.y + y + 0.9; rainPos[o + 5] = camPos.z + s[2];
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    cloudT += dt;
    if (clouds.visible) { for (let i = 0; i < cloudData.length; i++) { const c = cloudData[i]; _p.set(((c.x + cloudT * 2.2 + 600) % 1200) - 600 + camPos.x * 0.2, c.y, c.z + camPos.z * 0.2); _sc.set(c.sx, c.sy, c.sz); _m.compose(_p, _q, _sc); clouds.setMatrixAt(i, _m); } clouds.instanceMatrix.needsUpdate = true; }
    scenery.update(dt, world.night, camPos, world.viewFar); flora.update(camPos, world.viewFar);
    camPosPrev.copy(camPos);
  };
  world.setTime = t => { world.time = ((t % 24) + 24) % 24; };
  return world;
}
