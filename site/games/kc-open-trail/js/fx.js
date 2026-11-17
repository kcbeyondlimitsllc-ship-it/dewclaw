/* Cheap effects shared by everything: one pooled point-sprite particle system
   and one instanced mesh of soft blob shadows. */
import { THREE } from './util.js';

export function createFx(game) {
  const { scene } = game, MAX = 420;
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), size = new Float32Array(MAX);
  const P = []; for (let i = 0; i < MAX; i++) P.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, s: 1, grow: 0, a: 1 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('pcolor', new THREE.BufferAttribute(col, 4)); geo.setAttribute('psize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { scale: { value: 300 } },
    vertexShader: 'attribute vec4 pcolor; attribute float psize; uniform float scale; varying vec4 vC; void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(0.25, 0.12, r)); }'
  });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; points.renderOrder = 5; points.name = 'particles'; scene.add(points);
  let cursor = 0; const c = new THREE.Color();
  function spawn(x, y, z, o) {
    const i = cursor; cursor = (cursor + 1) % MAX; const p = P[i];
    p.life = p.max = o.life || 0.6; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.g = o.g ?? 0; p.s = o.size || 0.2; p.grow = o.grow || 0; p.a = o.alpha ?? 1;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; c.set(o.color ?? 0xffffff); col[i * 4] = c.r; col[i * 4 + 1] = c.g; col[i * 4 + 2] = c.b; col[i * 4 + 3] = p.a; size[i] = p.s;
  }
  const KINDS = {
    dust: { color: 0xd8c8a8, life: 0.5, size: 0.28, grow: 0.5, sp: 0.8, up: 0.6, g: 0, alpha: 0.6 },
    splash: { color: 0xdff2ff, life: 0.6, size: 0.2, sp: 2.2, up: 3.2, g: -9, alpha: 0.9 },
    dirt: { color: 0x7a5a3a, life: 0.7, size: 0.2, sp: 1.8, up: 3.4, g: -11, alpha: 1 },
    heart: { color: 0xff6f8f, life: 1.1, size: 0.3, sp: 0.5, up: 1.6, g: 0, alpha: 1 },
    spark: { color: 0xffe27a, life: 0.6, size: 0.22, sp: 2.4, up: 2.2, g: -5, alpha: 1 },
    leaf: { color: 0x7fbf5f, life: 1.0, size: 0.2, sp: 1.4, up: 1.6, g: -3, alpha: 1 },
    water: { color: 0xbfe4ff, life: 0.5, size: 0.16, sp: 3.0, up: 2.0, g: -9, alpha: 0.9 },
    zoom: { color: 0xffe27a, life: 0.45, size: 0.3, sp: 0.3, up: 0.3, g: 0, alpha: 0.8 }
  };
  /* blobs */
  const BN = 72, bgeo = new THREE.CircleGeometry(1, 20); bgeo.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(bgeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), BN);
  blobs.frustumCulled = false; blobs.renderOrder = 2; blobs.name = 'blobs'; scene.add(blobs);
  let bn = 0; const m4 = new THREE.Matrix4();
  return {
    burst(kind, x, y, z, n = 6, over = {}) {
      const k = { ...(KINDS[kind] || KINDS.dust), ...over };
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = k.sp * (0.4 + Math.random() * 0.6); spawn(x + (Math.random() - 0.5) * 0.3, y + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.3, { ...k, vx: Math.cos(a) * s + (over.vx || 0), vz: Math.sin(a) * s + (over.vz || 0), vy: k.up * (0.5 + Math.random() * 0.6) }); }
    },
    spawn,
    /* call every frame for each thing that wants a shadow */
    blob(x, y, z, r) { if (bn >= BN) return; m4.makeScale(r, 1, r); m4.setPosition(x, y + 0.05, z); blobs.setMatrixAt(bn++, m4); },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = P[i]; if (p.life <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
        p.life -= dt; p.vy += p.g * dt; pos[i * 3] += p.vx * dt; pos[i * 3 + 1] += p.vy * dt; pos[i * 3 + 2] += p.vz * dt;
        const f = Math.max(0, p.life / p.max); size[i] = p.life > 0 ? p.s * (1 + p.grow * (1 - f)) : 0; col[i * 4 + 3] = p.a * Math.min(1, f * 2);
      }
      geo.attributes.position.needsUpdate = geo.attributes.pcolor.needsUpdate = geo.attributes.psize.needsUpdate = true;
      mat.uniforms.scale.value = game.renderer.domElement.height * 0.9;
      blobs.count = bn; blobs.instanceMatrix.needsUpdate = true; bn = 0;
    },
    setBlobs(on) { blobs.visible = on; }
  };
}
