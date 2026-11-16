/* Trees, rocks, bushes and flowers as instanced meshes, chunked so far-away
   chunks are skipped entirely. Trees and rocks are solid; bushes and flowers thin
   out on lower quality settings. */
import { THREE, Geo, rng, TAU } from './util.js';
import { EXT, LAKE, MOUNTAIN } from './data.js';

const CH = 85, NCH = 8;

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
    if (kind === 'fir' || kind === 'leafy') { world.addCircle(x, z, 0.42 * s); trees.push([x, z, kind === 'fir' ? 0 : 1, s]); }
    else if (kind === 'rock') world.addCircle(x, z, 0.8 * s, world.heightAt(x, z) + 0.95 * s);
  };
  const inRect = (x, z, r) => x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3];
  const nearPath = (x, z, m) => { for (const [dx, dz] of [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]]) { const s = world.surfaceAt(x + dx, z + dz); if (s === 1 || s === 2) return true; } return false; };
  const mh = (x, z) => MOUNTAIN.h * Math.exp(-((x - MOUNTAIN.x) ** 2 + (z - MOUNTAIN.z) ** 2) / (2 * MOUNTAIN.s * MOUNTAIN.s));
  const TOWN = [-112, -52, 104, 150], PARK = [12, 52, 86, 142], FARM = [-204, 170, -56, 286], BEACH = [172, 140, 254, 180], FIELD = [24, -88, 76, -54], LOTS = [[-30, -94, 8, -76], [-36, 58, -14, 74], [-202, 6, -178, 26], [194, 139, 226, 152], [16, 68, 30, 78], [20, 118, 44, 136]];
  function zoneDensity(x, z, h) {
    const r = Math.max(Math.abs(x), Math.abs(z));
    if (h < 0.9) return [0, 0];
    if (inRect(x, z, FARM) || inRect(x, z, BEACH) || inRect(x, z, FIELD)) return [0, 0];
    for (const l of LOTS) if (inRect(x, z, l)) return [0, 0];
    if (Math.hypot(x + 204, z) < 24) return [0, 0];
    if (Math.hypot(x + 24, z + 220) < 12) return [0, 0];
    if (inRect(x, z, PARK)) return [0.1, 1];
    if (inRect(x, z, TOWN)) return [0.035, 1];
    if (r > 290) return [0.5, 0.05];
    if (x < -112 && z > -175 && z < 165) return [0.72, 0.08];
    const m = mh(x, z);
    if (m > 5) return [h > 50 ? 0.06 : h > 40 ? 0.25 : 0.55, 0.1];
    if (world.riverDist(x, z) < 24) return [0.22, 0.8];
    if (x > 130) return [0.11, 0.6];
    return [0.14, 0.55];
  }
  for (let i = 0; i < 9500; i++) {
    const x = (R() - 0.5) * 2 * (EXT - 4), z = (R() - 0.5) * 2 * (EXT - 4), h = world.heightAt(x, z), [d, leafy] = zoneDensity(x, z, h);
    if (R() >= d || nearPath(x, z, 2.6) || world.blockedAt(x, z, h, 2.2)) continue;
    const kind = R() < leafy ? 'leafy' : 'fir', s = (0.75 + R() * 0.7) * (Math.max(Math.abs(x), Math.abs(z)) > 290 ? 1.35 : 1);
    add(kind, x, z, s, kind === 'fir' ? [0.85 + R() * 0.3, 0.9 + R() * 0.2, 0.85 + R() * 0.25] : (R() < 0.12 ? [1.5, 1.0, 0.5] : [0.85 + R() * 0.35, 0.9 + R() * 0.2, 0.8 + R() * 0.3]));
  }
  /* street trees and requested trees */
  for (const x of [-96, -30, 6, 68]) for (const z of [32.2, 47.8]) if (!world.blockedAt(x, z, 3, 1)) add('leafy', x, z, 0.75, [1, 1, 1]);
  for (const p of world.plantRequests || []) add(p.kind, p.x, p.z, p.s || 1, p.fruit ? [1.0, 1.05, 0.9] : [1, 1, 1]);
  for (let i = 0; i < 2600; i++) {
    const x = (R() - 0.5) * 2 * (EXT - 6), z = (R() - 0.5) * 2 * (EXT - 6), h = world.heightAt(x, z);
    if (h < -0.4) continue;
    const m = mh(x, z), d = m > 8 ? 0.5 : world.riverDist(x, z) < 20 || Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz) < 1.35 ? 0.28 : inRect(x, z, TOWN) || inRect(x, z, FARM) || inRect(x, z, BEACH) ? 0 : 0.05;
    if (R() >= d || nearPath(x, z, 2.2) || world.blockedAt(x, z, h, 1.6)) continue;
    add('rock', x, z, 0.5 + R() * 1.1, [0.85 + R() * 0.3, 0.85 + R() * 0.3, 0.85 + R() * 0.3]);
  }
  for (let i = 0; i < 5200; i++) {
    const x = (R() - 0.5) * 2 * (EXT - 6), z = (R() - 0.5) * 2 * (EXT - 6), h = world.heightAt(x, z);
    if (h < 1.0 || h > 46 || nearPath(x, z, 1.4) || inRect(x, z, FIELD)) continue;
    const town = inRect(x, z, TOWN) && !inRect(x, z, PARK), farm = inRect(x, z, FARM);
    if (town || farm || inRect(x, z, BEACH) || world.blockedAt(x, z, h, 1.2)) continue;
    if (R() < 0.42) add('bush', x, z, 0.6 + R() * 0.8, [0.8 + R() * 0.4, 0.9 + R() * 0.2, 0.8 + R() * 0.3]);
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
    setQuality(qv) { far = qv.fog; dens = qv.veg; for (const m of meshes) { const u = m.userData; m.count = solid[u.kind] ? u.full : Math.floor(u.full * dens); m.castShadow = !!qv.shadows && (u.kind === 'fir' || u.kind === 'leafy'); } },
    update(cam) { for (const m of meshes) { const u = m.userData, dx = Math.max(0, Math.abs(cam.x - u.cx) - CH / 2), dz = Math.max(0, Math.abs(cam.z - u.cz) - CH / 2); const lim = u.kind === 'flower' || u.kind === 'bush' ? Math.min(far, 120) : far + 10; m.visible = dx * dx + dz * dz < lim * lim; } }
  };
}
