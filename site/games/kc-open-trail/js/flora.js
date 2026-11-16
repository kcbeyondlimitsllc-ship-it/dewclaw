/* Trees, rocks, bushes and flowers as instanced meshes, chunked so far-away
   chunks are skipped entirely. Trees and rocks are solid; bushes and flowers thin
   out on lower quality settings. */
import { THREE, Geo, rng, TAU } from './util.js';
import { EXT, HALF, FIELDS, PATCHES, RIDGE_W, CLEARINGS } from './data.js';

const CH = 90, NCH = Math.ceil((EXT * 2) / CH);

export function buildFlora(game, world) {
  const { scene } = game, R = rng(20240);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const protos = {};
  { const g = new Geo(); g.cyl(0, -0.4, 0, 0.3, 0.2, 2.2, 4, 0x6e4a30, null, 1, 0); g.cyl(0, 1.4, 0, 2.3, 0, 3.4, 5, 0x2f6f43, 0x275c38); g.cyl(0, 3.3, 0, 1.8, 0, 3.0, 5, 0x37804c, 0x2f6f43); g.cyl(0, 5.2, 0, 1.25, 0, 2.6, 5, 0x3f8c54, 0x37804c); protos.fir = g.build(); }
  { const g = new Geo(); g.cyl(0, -0.4, 0, 0.32, 0.22, 2.8, 4, 0x7a5638, null, 1, 0); g.ball(0, 4.0, 0, 2.2, 1.9, 2.2, 0x58a84e, 6, 4, true); g.ball(1.2, 3.2, 0.5, 1.4, 1.2, 1.4, 0x4c9a46, 5, 3, true); g.ball(-1.1, 3.4, -0.6, 1.5, 1.2, 1.4, 0x64b458, 5, 3, true); protos.leafy = g.build(); }
  { const g = new Geo(); g.ball(0, 0.35, 0, 1, 0.7, 0.85, 0x94948e, 6, 4, true); protos.rock = g.build(); }
  { const g = new Geo(); g.ball(0, 0.35, 0, 0.8, 0.5, 0.8, 0x4f9a50, 5, 3, true); g.ball(0.5, 0.3, 0.3, 0.5, 0.4, 0.5, 0x5aa85a, 4, 3, true); protos.bush = g.build(); }
  { const g = new Geo(); for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU, x = Math.cos(a) * 0.22, z = Math.sin(a) * 0.22; g.tri([x - 0.03, 0, z], [x + 0.03, 0, z], [x, 0.42, z], 0x4f9a50); g.tri([x + 0.03, 0, z], [x - 0.03, 0, z], [x, 0.42, z], 0x4f9a50); g.cyl(x, 0.38, z, 0.02, 0.13, 0.1, 4, 0xffffff, null, 1, 2); } protos.flower = g.build(); }
  const solid = { fir: true, leafy: true, rock: true };

  const lists = {}, trees = []; /* key chunk|kind -> [{x,y,z,s,ry,tint}] */
  const add = (kind, x, z, s, tint) => {
    const cx = Math.min(NCH - 1, Math.max(0, Math.floor((x + EXT) / CH))), cz = Math.min(NCH - 1, Math.max(0, Math.floor((z + EXT) / CH))), k = cx + '|' + cz + '|' + kind;
    (lists[k] ||= { kind, cx, cz, items: [] }).items.push({ x, y: world.heightAt(x, z), z, s, ry: R() * TAU, tint });
    if (kind === 'fir' || kind === 'leafy') { world.addCircle(x, z, 0.42 * s); trees.push([x, z, kind === 'fir' ? 0 : 1, s]);
      /* the camera keeps out of the foliage (slightly shrunk, so brushing a canopy does not make it jump) */
      const y = world.heightAt(x, z); world.addView(kind === 'fir' ? { x, z, r: 2.0 * s, bottom: y + 1.5 * s, top: y + 7.4 * s, shape: 'cone' } : { x, z, r: 2.25 * s, bottom: y + 2.0 * s, top: y + 5.8 * s, shape: 'ball' }); }
    else if (kind === 'rock') world.addCircle(x, z, 0.8 * s, world.heightAt(x, z) + 0.95 * s);
  };
  const inRect = (x, z, r) => x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3];
  const nearPath = (x, z, m) => { for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]]) { const s = world.surfaceAt(x + dx, z + dz); if (s === 1 || s === 2 || s === 5) return true; } return world.railDist(x, z) < m + 3.2; };
  const inField = (x, z) => { for (const f of FIELDS) if (x > f[0] - 2 && z > f[1] - 2 && x < f[2] + 2 && z < f[3] + 2) return true; return false; };
  const inPatch = (x, z) => { for (const c of CLEARINGS) if ((x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2]) return true; for (const f of PATCHES) if ((f[5] === 5 || f[5] === 3) && x > f[0] - 1 && z > f[1] - 1 && x < f[2] + 1 && z < f[3] + 1) return true; return false; };
  const TOWNS = [[-470, -420, -96, -190], [-320, 10, -226, 114], [-150, 296, 9, 505], [120, 236, 330, 505]];
  const OPEN = [[-200, -188, -96, -120], [-442, -146, -328, -58], [132, 262, 232, 312], [166, 318, 234, 386], [9, 300, 112, 505], [-198, -276, -104, -226], [-268, 432, -230, 470]];   /* lawns: hand-placed trees only */
  const WOODS = [[-246, -136, 40, 0.42, 0.9], [-232, -456, 70, 0.3, 0.6], [-152, -404, 34, 0.1, 0.8], [360, 440, 60, 0.3, 0.35], [-46, -298, 100, 0.2, 0.9], [-34, -92, 34, 0.12, 0.7], [112, -6, 70, 0.13, 0.8], [-330, -438, 44, 0.22, 0.3]];   /* x, z, r, density, leafy share */
  /* returns [tree density, share of leafy trees] */
  function zoneDensity(x, z, h) {
    if (h < 0.9 || inField(x, z) || inPatch(x, z)) return [0, 0];
    for (const o of OPEN) if (inRect(x, z, o)) return [0.012, 1];
    if (Math.hypot(x + 330, z + 438) < 15) return [0, 0];
    for (const w of WOODS) if (Math.hypot(x - w[0], z - w[1]) < w[2] && !(w[0] === -46 && Math.abs(x + 46) > 22)) return [w[3], w[4]];
    for (const t of TOWNS) if (inRect(x, z, t)) return [0.03, 0.9];
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (r > HALF - 12) return [0.5, 0.08];
    const dx = world.ridgeDx(x, z);
    if (dx < RIDGE_W) return [h > 30 ? 0.6 : 0.74, 0.08];
    if (dx < RIDGE_W + 50) return [0.3, 0.3];
    const far = world.farShore(x, z); if (far > 0) return [0.2 + far * 0.34, 0.15];
    if (x > -150 && x < 225 && z > -115 && z < 195) return [0.035, 0.95];                 /* Sauvie Island farmland */
    if (world.riverDist(x, z) < 26) return [0.2, 0.85];
    return [0.13, 0.6];
  }
  const SPAN = 2 * (EXT - 4);
  for (let i = 0; i < 32000; i++) {
    const x = (R() - 0.5) * SPAN, z = (R() - 0.5) * SPAN, h = world.heightAt(x, z), [d, leafy] = zoneDensity(x, z, h);
    if (R() >= d || nearPath(x, z, 2.6) || world.blockedAt(x, z, h, 2.2)) continue;
    const kind = R() < leafy ? 'leafy' : 'fir', s = (0.75 + R() * 0.7) * (Math.max(Math.abs(x), Math.abs(z)) > HALF - 10 ? 1.35 : 1);
    add(kind, x, z, s, kind === 'fir' ? [0.85 + R() * 0.3, 0.9 + R() * 0.2, 0.85 + R() * 0.25] : (R() < 0.2 ? [1.55, 1.0, 0.45] : R() < 0.12 ? [1.5, 1.25, 0.5] : [0.85 + R() * 0.35, 0.9 + R() * 0.2, 0.8 + R() * 0.3]));
  }
  /* requested trees (street trees, orchards, park specimens) */
  for (const p of world.plantRequests || []) { const h = world.heightAt(p.x, p.z); if (h < 0.5 || world.blockedAt(p.x, p.z, h, 0.8)) continue; add(p.kind, p.x, p.z, p.s || 1, p.fruit ? [1.0, 1.05, 0.9] : [1, 1, 1]); }
  for (let i = 0; i < 4200; i++) {
    const x = (R() - 0.5) * SPAN, z = (R() - 0.5) * SPAN, h = world.heightAt(x, z);
    if (h < -0.4 || inField(x, z) || inPatch(x, z)) continue;
    let d = world.riverDist(x, z) < 12 ? 0.22 : Math.hypot(x + 330, z + 438) < 34 ? 0.5 : world.ridgeDx(x, z) < RIDGE_W ? 0.1 : world.farShore(x, z) > 0.3 ? 0.12 : 0.03;
    for (const t of TOWNS) if (inRect(x, z, t)) d = 0; for (const o of OPEN) if (inRect(x, z, o)) d = 0;
    if (R() >= d || nearPath(x, z, 2.2) || world.blockedAt(x, z, h, 1.6)) continue;
    add('rock', x, z, 0.5 + R() * 1.1, [0.8 + R() * 0.25, 0.82 + R() * 0.25, 0.88 + R() * 0.25]);
  }
  for (let i = 0; i < 11000; i++) {
    const x = (R() - 0.5) * SPAN, z = (R() - 0.5) * SPAN, h = world.heightAt(x, z);
    if (h < 1.0 || nearPath(x, z, 1.4) || inField(x, z) || inPatch(x, z)) continue;
    let town = false; for (const t of TOWNS) if (inRect(x, z, t)) town = true; let open = false; for (const o of OPEN) if (inRect(x, z, o)) open = true;
    if ((town && !open && R() < 0.75) || world.blockedAt(x, z, h, 1.2)) continue;
    if (!open && R() < 0.42) add('bush', x, z, 0.6 + R() * 0.8, [0.8 + R() * 0.4, 0.9 + R() * 0.2, 0.8 + R() * 0.3]);
    else { const c = [[1, 0.35, 0.35], [1, 0.85, 0.3], [1, 1, 1], [0.75, 0.5, 1], [1, 0.6, 0.8]][Math.floor(R() * 5)]; add('flower', x, z, 0.55 + R() * 0.45, c); }
  }

  const meshes = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s3 = new THREE.Vector3(), col = new THREE.Color();
  let total = 0;
  for (const k in lists) {
    const L = lists[k], n = L.items.length, im = new THREE.InstancedMesh(protos[L.kind], mat, n);
    L.items.forEach((it, i) => { e.set(0, it.ry, 0); q.setFromEuler(e); p.set(it.x, it.y, it.z); s3.set(it.s, it.s * (L.kind === 'rock' ? 0.8 + (i % 5) * 0.12 : 1), it.s); m4.compose(p, q, s3); im.setMatrixAt(i, m4); col.setRGB(it.tint[0], it.tint[1], it.tint[2]); im.setColorAt(i, col); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.receiveShadow = L.kind !== 'flower'; im.name = 'flora-' + L.kind;
    im.userData = { kind: L.kind, full: n, cx: -EXT + (L.cx + 0.5) * CH, cz: -EXT + (L.cz + 0.5) * CH, tris: protos[L.kind].attributes.position.count / 3 };
    scene.add(im); meshes.push(im); total += n;
  }
  let far = 200, dens = 1;
  return {
    count: total, meshes, trees,
    setQuality(qv) { dens = qv.veg; for (const m of meshes) { const u = m.userData; m.count = solid[u.kind] ? u.full : Math.floor(u.full * dens); m.castShadow = !!qv.shadows && (u.kind === 'fir' || u.kind === 'leafy'); } },
    update(cam, viewFar) { if (viewFar) far = viewFar; for (const m of meshes) { const u = m.userData, dx = Math.max(0, Math.abs(cam.x - u.cx) - CH / 2), dz = Math.max(0, Math.abs(cam.z - u.cz) - CH / 2); const lim = u.kind === 'flower' || u.kind === 'bush' ? Math.min(far, 120) : far + 10; m.visible = dx * dx + dz * dz < lim * lim; } }
  };
}
