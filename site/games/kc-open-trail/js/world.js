/* Cedar Hollow: terrain heightfield, painted ground texture, water, colliders,
   zones, sky / day-night / weather. Buildings and props live in scenery.js,
   trees and plants in flora.js. */
import { THREE, clamp, lerp, smooth, fbm, polyDist, smoothPath, rng } from './util.js';
import { HALF, EXT, WATER_Y, BASE_Y, RIVER, LAKE, MOUNTAIN, LOOKOUT, ROADS, ZONES, FLOWER_BEDS } from './data.js';
import { buildScenery } from './scenery.js';
import { buildFlora } from './flora.js';

const N = 128, CELL = (EXT * 2) / N;
const softRect = (x, z, x0, z0, x1, z1, e) => smooth(x0 - e, x0, x) * (1 - smooth(x1, x1 + e, x)) * smooth(z0 - e, z0, z) * (1 - smooth(z1, z1 + e, z));
const softCirc = (x, z, cx, cz, r, e) => 1 - smooth(r, r + e, Math.hypot(x - cx, z - cz));

export function createWorld(game) {
  const { scene } = game;
  const world = { HALF, EXT, WATER_Y, roads: [], time: 9.5, day: 1, night: 0, rain: 0, dayLength: 720 };
  const mtn = (x, z) => { const m = MOUNTAIN, d2 = (x - m.x) ** 2 + (z - m.z) ** 2; return m.h * Math.exp(-d2 / (2 * m.s * m.s)); };
  const lookoutH = mtn(LOOKOUT.x, LOOKOUT.z);
  world.riverDist = (x, z) => polyDist(x, z, RIVER);

  function flatMask(x, z) {
    return Math.max(softRect(x, z, -125, -62, 162, 160, 22), softRect(x, z, -205, 170, -58, 285, 18), softCirc(x, z, -204, 0, 34, 18), softRect(x, z, 176, 138, 252, 172, 10), softRect(x, z, 84, -68, 130, -52, 10));
  }
  function rawHeight(x, z) {
    const flat = flatMask(x, z);
    const forest = smooth(-100, -160, x) * (1 - smooth(150, 200, z));
    const amp = 2.0 + 3.6 * forest;
    let h = BASE_Y + (fbm(x * 0.013 + 7.3, z * 0.013 + 3.1, 3) - 0.5) * 2 * amp * (1 - flat) + 0.6 * (1 - flat);
    let m = mtn(x, z);
    m *= 0.86 + 0.28 * fbm(x * 0.03 + 11, z * 0.03 + 5, 2);
    const lk = 1 - smooth(8, 17, Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z));
    m = lerp(m, lookoutH, lk);
    h += m * (1 - softRect(x, z, -125, -62, 162, 160, 22));
    const hd2 = (x - 234) ** 2 + (z + 70) ** 2; h += 9 * Math.exp(-hd2 / (2 * 38 * 38));
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (r > 288) h += ((r - 288) / 52) ** 2 * 34 * (0.7 + 0.6 * fbm(x * 0.02, z * 0.02, 2));
    const e = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) + (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 0.14;
    h = lerp(h, -4, 1 - smooth(0.82, 1.3, e));
    h += 6.4 * Math.exp(-((x - LAKE.x) ** 2 + (z - LAKE.z) ** 2) / (2 * 5.5 * 5.5));
    const rd = world.riverDist(x, z) + (fbm(x * 0.05 + 2, z * 0.05, 2) - 0.5) * 3;
    h = lerp(h, -2.6, 1 - smooth(6, 17, rd));
    return h;
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

  /* surface grid: 0 grass, 1 road, 2 trail/gravel, 3 sand, 4 water, 5 paving */
  const SG = 400, SCELL = (EXT * 2) / SG, surf = new Uint8Array(SG * SG);
  {
    const c = document.createElement('canvas'); c.width = c.height = SG; const x = c.getContext('2d', { willReadFrequently: true });
    const px = v => (v + EXT) / SCELL;
    x.fillStyle = '#000'; x.fillRect(0, 0, SG, SG); x.lineCap = 'round'; x.lineJoin = 'round';
    x.fillStyle = '#00f'; x.fillRect(px(12), px(52), px(86) - px(12), 3); /* nothing: keeps blue channel used */
    const stroke = (path, w, col) => { x.strokeStyle = col; x.lineWidth = Math.max(1.5, w / SCELL); x.beginPath(); path.forEach((p, i) => i ? x.lineTo(px(p[0]), px(p[1])) : x.moveTo(px(p[0]), px(p[1]))); x.stroke(); };
    for (const r of world.roads) if (r.kind !== 'road') stroke(r.path, r.w, '#0f0');
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w, '#f00');
    const d = x.getImageData(0, 0, SG, SG).data;
    for (let j = 0; j < SG; j++) for (let i = 0; i < SG; i++) {
      const o = (j * SG + i) * 4, wx = -EXT + (i + 0.5) * SCELL, wz = -EXT + (j + 0.5) * SCELL, h = world.heightAt(wx, wz);
      surf[j * SG + i] = h < -0.05 ? 4 : d[o] > 120 ? 1 : d[o + 1] > 120 ? 2 : h < 1.1 ? 3 : 0;
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

  /* camera only minds big solid things (buildings, big trunks, tents), never lamp posts or saplings */
  world.camBlocked = (x, z, y) => {
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
    const B = 256, bc = document.createElement('canvas'); bc.width = bc.height = B; const bx = bc.getContext('2d'), img = bx.createImageData(B, B), d = img.data;
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const GR = [108, 172, 84], FO = [72, 128, 70], SA = [222, 202, 150], RK = [140, 136, 126], RK2 = [176, 174, 168], MU = [150, 130, 96], WA = [70, 140, 176], FA = [150, 182, 88], TOWN = [124, 186, 98];
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
      const wx = -EXT + (i + 0.5) * (2 * EXT / B), wz = -EXT + (j + 0.5) * (2 * EXT / B), h = world.heightAt(wx, wz), s = world.slopeAt(wx, wz);
      const forest = smooth(-104, -130, wx) * (1 - smooth(150, 185, wz)) * (1 - softCirc(wx, wz, -204, 0, 30, 10) * 0.6);
      let c = mix(GR, FO, clamp(forest + smooth(288, 300, Math.max(Math.abs(wx), Math.abs(wz))), 0, 1) * 0.9);
      c = mix(c, TOWN, softRect(wx, wz, -112, -52, 104, 150, 10) * 0.6);
      c = mix(c, FA, softRect(wx, wz, -204, 170, -56, 286, 8) * 0.7);
      const n = fbm(wx * 0.06, wz * 0.06, 3); c = mix(c, [c[0] * 0.82, c[1] * 0.86, c[2] * 0.8], n);
      c = mix(c, RK, smooth(0.45, 0.8, s)); c = mix(c, RK, smooth(30, 44, h) * 0.8); c = mix(c, RK2, smooth(46, 56, h));
      c = mix(c, SA, 1 - smooth(0.7, 1.7, h)); c = mix(c, MU, 1 - smooth(-0.6, 0.2, h)); c = mix(c, WA, 1 - smooth(-1.6, -0.5, h));
      const o = (j * B + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    bx.putImageData(img, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(bc, 0, 0, T, T);
    const k = T / (2 * EXT), px = v => (v + EXT) * k, R = rng(77);
    /* grass speckle */
    for (let i = 0; i < T * 5; i++) { const sx = R() * T, sz = R() * T; x.fillStyle = R() < 0.5 ? 'rgba(255,255,220,.05)' : 'rgba(0,40,10,.06)'; x.fillRect(sx, sz, 1 + R() * 3, 1 + R() * 3); }
    const rect = (x0, z0, x1, z1, col) => { x.fillStyle = col; x.fillRect(px(x0), px(z0), (x1 - x0) * k, (z1 - z0) * k); };
    /* farm fields */
    rect(-122, 226, -62, 280, '#9a7648');
    for (let fx = -120; fx < -62; fx += 3) rect(fx, 227, fx + 1.4, 279, fx % 2 ? '#7fae4c' : '#c9b24a');
    rect(-98, 176, -64, 202, '#8a6a42'); for (let fz = 178; fz < 202; fz += 3) rect(-97, fz, -65, fz + 1.2, '#6f9a45');
    rect(-198, 186, -146, 222, '#8fbf60');
    rect(-176, 228, -150, 233, '#b59a6a');
    /* park lawn, paving and beds */
    rect(12, 52, 86, 142, '#7fc668');
    rect(14, 55.5, 84, 64.5, '#cfc6b4');
    x.fillStyle = '#d6cdbb'; x.beginPath(); x.arc(px(49), px(100), 11 * k, 0, 7); x.fill();
    x.strokeStyle = '#d6cdbb'; x.lineWidth = 3.4 * k; x.lineCap = 'round';
    for (const [a, b, c2, e] of [[49, 62, 49, 138], [16, 100, 84, 100], [18, 64, 80, 136], [80, 64, 18, 136]]) { x.beginPath(); x.moveTo(px(a), px(b)); x.lineTo(px(c2), px(e)); x.stroke(); }
    for (const [bxm, bz, bw, bd] of FLOWER_BEDS) rect(bxm - bw / 2, bz - bd / 2, bxm + bw / 2, bz + bd / 2, '#6f4a30');
    rect(22, 120, 42, 134, '#c9b98f');   /* dog agility sand */
    /* lots */
    rect(196, 141, 224, 150, '#6a6c72'); rect(-26, -92, 4, -78, '#8f887a'); rect(-200, 8, -180, 24, '#9a9284'); rect(-34, 60, -16, 72, '#6a6c72');
    rect(84, 54, 100, 76, '#cfc6b4');    /* ranger yard */
    rect(26, -86, 74, -56, '#6fb85c'); x.strokeStyle = '#eef3e6'; x.lineWidth = 0.35 * k; x.strokeRect(px(28), px(-84), 44 * k, 26 * k); x.beginPath(); x.moveTo(px(50), px(-84)); x.lineTo(px(50), px(-58)); x.stroke(); x.beginPath(); x.arc(px(50), px(-71), 4 * k, 0, 7); x.stroke();
    /* camp clearing */
    x.fillStyle = 'rgba(170,150,110,.55)'; x.beginPath(); x.arc(px(-204), px(0), 22 * k, 0, 7); x.fill();
    x.fillStyle = 'rgba(190,180,160,.7)'; x.beginPath(); x.arc(px(LOOKOUT.x), px(LOOKOUT.z), 9 * k, 0, 7); x.fill();
    const stroke = (path, w, col, dash) => { x.strokeStyle = col; x.lineWidth = w * k; x.lineJoin = 'round'; x.lineCap = 'round'; x.setLineDash(dash ? dash.map(v => v * k) : []); x.beginPath(); path.forEach((p, i) => i ? x.lineTo(px(p[0]), px(p[1])) : x.moveTo(px(p[0]), px(p[1]))); x.stroke(); x.setLineDash([]); };
    for (const r of world.roads) if (r.kind === 'trail') { stroke(r.path, r.w + 0.8, 'rgba(120,96,60,.55)'); stroke(r.path, r.w, '#c4a26c'); }
    for (const r of world.roads) if (r.kind === 'gravel') { stroke(r.path, r.w + 1, '#8a8474'); stroke(r.path, r.w, '#b3ab98'); }
    /* sidewalks in town, then asphalt, then markings */
    x.save(); x.beginPath(); x.rect(px(-112), px(-52), (104 + 112) * k, (150 + 52) * k); x.clip();
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w + 5.5, '#cfc8ba');
    x.restore();
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w + 0.6, '#4a4c52');
    for (const r of world.roads) if (r.kind === 'road') stroke(r.path, r.w, '#5d6068');
    for (const r of world.roads) if (r.kind === 'road') { x.lineCap = 'butt'; stroke(r.path, 0.28, '#f0d98a', [2.4, 2.4]); }
    /* zebra crossings on Main Street */
    for (const cx of [-22, 2, 46, 88]) for (let s = -4; s <= 4; s += 1.6) rect(cx - 1.6, 40 + s - 0.45, cx + 1.6, 40 + s + 0.45, '#eeeeea');
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
  const waterTex = new THREE.CanvasTexture(wc); waterTex.colorSpace = THREE.SRGBColorSpace; waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(60, 60);
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
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556644, 1.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); scene.add(sun); scene.add(sun.target);
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -42; sun.shadow.camera.right = 42; sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42; sun.shadow.camera.near = 10; sun.shadow.camera.far = 260; sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.6;
  scene.fog = new THREE.Fog(0xcfe6f5, 60, 200);
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
    scene.fog.color.copy(cHor); sun.color.copy(cSun); sun.intensity = si; hemi.intensity = hi; hemi.color.copy(cAmb); hemi.groundColor.setRGB(cAmb.r * 0.45, cAmb.g * 0.5, cAmb.b * 0.42);
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 120);
    sky.position.copy(camPos); stars.position.copy(camPos); stars.material.opacity = world.night * 0.9 * (1 - world.rain);
    cloudMat.color.copy(cHor).lerp(new THREE.Color(0xffffff), 0.55 * (1 - world.night)).multiplyScalar(1 - world.rain * 0.25); cloudMat.opacity = 0.55 + world.rain * 0.35;
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
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.drawImage(world.groundCanvas, 0, 0, S, S);
    const k = S / (2 * EXT), px = v => (v + EXT) * k;
    for (const t of flora.trees) { x.fillStyle = t[2] ? 'rgba(58,128,62,.8)' : 'rgba(38,92,58,.8)'; x.beginPath(); x.arc(px(t[0]), px(t[1]), 1.6 * t[3] * k, 0, 7); x.fill(); }
    x.fillStyle = '#8a5a3c'; x.strokeStyle = '#4a3020'; x.lineWidth = 1;
    for (const b of scenery.footprints) { x.fillRect(px(b[0]), px(b[1]), (b[2] - b[0]) * k, (b[3] - b[1]) * k); x.strokeRect(px(b[0]), px(b[1]), (b[2] - b[0]) * k, (b[3] - b[1]) * k); }
    x.fillStyle = '#b08a5a'; for (const b of scenery.decks) x.fillRect(px(b[0]), px(b[1]), (b[2] - b[0]) * k, (b[3] - b[1]) * k);
    return c;
  })();
  world.mapScale = 1024 / (2 * EXT);

  world.applyQuality = q => {
    scene.fog.near = q.fog * 0.42; scene.fog.far = q.fog;
    game.renderer.shadowMap.enabled = !!q.shadows; sun.castShadow = !!q.shadows;
    scenery.setShadows(!!q.shadows); flora.setQuality(q);
    terrain.material.needsUpdate = true; scenery.material.needsUpdate = true;
    clouds.visible = q.clouds !== false;
  };
  world.setHalloween = on => scenery.setHalloween(on);

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
    scenery.update(dt, world.night, camPos); flora.update(camPos);
    camPosPrev.copy(camPos);
  };
  world.setTime = t => { world.time = ((t % 24) + 24) % 24; };
  world.repaint = () => { groundTex.needsUpdate = true; };
  return world;
}
