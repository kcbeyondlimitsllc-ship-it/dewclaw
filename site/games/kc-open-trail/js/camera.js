/* Third-person follow camera: orbit with drag / right stick, zoom, gentle
   auto-follow, and collision so it never ends up inside a hill or a shop. */
import { THREE, clamp, lerp, angDiff, damp } from './util.js';
import { WATER_Y } from './data.js';

export function createCamera(game) {
  const cam3 = new THREE.PerspectiveCamera(60, 1, 0.2, 900);
  const cam = { three: cam3, yaw: Math.PI / 2, pitch: 0.34, dist: 6.5, cur: 6.5, mode: 'follow', manualT: 9, target: new THREE.Vector3(), shake: 0, lift: 0 };
  const dir = new THREE.Vector3(), p = new THREE.Vector3(), look = new THREE.Vector3();
  let tgtInit = false;
  cam.resize = (w, h) => { cam3.aspect = w / h; cam.baseFov = w < h ? 74 : 60; cam3.fov = cam.baseFov; cam3.updateProjectionMatrix(); };
  /* solid things (buildings, big trunks) shorten the boom; hills only lift it, so the view rises over a slope instead of zooming into KC */
  let liftNeed = 0;
  function freeDist(tx, ty, tz, want) {
    const { world } = game, steps = Math.max(6, Math.ceil(want / 0.6)); let ok = want;
    for (let i = 1; i <= steps; i++) {
      const d = (want * i) / steps, x = tx + dir.x * d, y = ty + dir.y * d, z = tz + dir.z * d;
      if (world.camBlocked(x, z, y - 0.3)) { ok = Math.max(0.55, (want * (i - 1)) / steps - 0.3); break; }
    }
    liftNeed = 0; const n = Math.max(4, Math.ceil(ok / 0.7));
    for (let i = 1; i <= n; i++) { const f = i / n, x = tx + dir.x * ok * f, z = tz + dir.z * ok * f, need = Math.max(world.heightAt(x, z) + 0.5, WATER_Y + 0.3) - (ty + dir.y * ok * f); if (need > 0) liftNeed = Math.max(liftNeed, need / Math.max(f, 0.35)); }
    if (liftNeed > ok * 1.3) { ok = Math.max(1.2, ok * (ok * 1.3) / liftNeed); liftNeed = Math.min(liftNeed, ok * 1.3); }
    return ok;
  }
  cam.snap = () => { tgtInit = false; cam.cur = cam.dist; cam.lift = 0; };
  cam.update = (dt, input) => {
    const { kc, state } = game, s = state.settings, ride = kc.ride;
    const ix = input.camX * (s.invertX ? -1 : 1), iy = input.camY * (s.invertY ? -1 : 1);
    if (Math.abs(ix) + Math.abs(iy) > 0.0005) cam.manualT = 0; else cam.manualT += dt;
    cam.yaw -= ix; cam.pitch = clamp(cam.pitch + iy, cam.mode === 'photo' ? -0.5 : -0.2, 1.35);
    if (input.zoom) cam.dist = clamp(cam.dist * (1 + input.zoom), 2.6, cam.mode === 'photo' ? 22 : 13);
    /* auto-follow behind KC when the player is not steering the camera */
    if (cam.mode === 'follow' && cam.manualT > (ride ? 0.8 : 1.6) && kc.speed > 1.2) {
      const heading = ride ? ride.yaw + (ride.speed < -0.2 ? Math.PI : 0) : kc.yaw, d = angDiff(cam.yaw, heading);
      if (Math.abs(d) < 2.5) cam.yaw += d * Math.min(1, dt * (ride ? 2.2 : 0.9));
      cam.pitch = lerp(cam.pitch, ride ? 0.3 : 0.34, Math.min(1, dt * 0.35));
    }
    const base = ride ? ride.cfg.camY : (kc.swimming ? 1.0 : 1.05), tx = kc.pos.x, ty = kc.pos.y + base, tz = kc.pos.z;
    if (!tgtInit) { cam.target.set(tx, ty, tz); tgtInit = true; }
    cam.target.x = lerp(cam.target.x, tx, damp(18, dt)); cam.target.z = lerp(cam.target.z, tz, damp(18, dt)); cam.target.y = lerp(cam.target.y, ty, damp(7, dt));
    const cp = Math.cos(cam.pitch);
    dir.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
    const want = cam.dist + (ride ? ride.cfg.camDist : 0);
    const ok = freeDist(cam.target.x, cam.target.y, cam.target.z, want);
    cam.cur = ok < cam.cur ? lerp(cam.cur, ok, damp(26, dt)) : lerp(cam.cur, ok, damp(3.5, dt));
    if (cam.cur > ok + 0.6) cam.cur = ok + 0.6;
    cam.lift = liftNeed > cam.lift ? lerp(cam.lift, liftNeed, damp(14, dt)) : lerp(cam.lift, liftNeed, damp(3, dt));
    p.copy(cam.target).addScaledVector(dir, cam.cur); p.y += cam.lift;
    const floor = Math.max(game.world.heightAt(p.x, p.z) + 0.4, WATER_Y + 0.28); if (p.y < floor) p.y = floor;
    if (cam.shake > 0) { cam.shake -= dt; p.x += (Math.random() - 0.5) * 0.12; p.y += (Math.random() - 0.5) * 0.12; }
    cam3.position.copy(p); look.copy(cam.target); look.y += 0.25; cam3.lookAt(look);
    const fov = cam.baseFov + (kc.sprinting ? 7 : 0) + (ride ? Math.min(6, Math.abs(ride.speed) * 0.4) : 0);
    if (Math.abs(cam3.fov - fov) > 0.05) { cam3.fov = lerp(cam3.fov, fov, damp(5, dt)); cam3.updateProjectionMatrix(); }
  };
  return cam;
}
