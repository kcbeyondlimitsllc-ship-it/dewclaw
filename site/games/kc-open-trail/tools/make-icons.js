/* Generates the PWA icons (KC's face) into ../icons. Dev tool only:
     node tools/make-icons.js
   Needs Playwright's Chromium (it just uses a canvas). */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
function draw(size, maskable) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = size / 512;
  const K = { coat: '#f1dcae', shade: '#dcc08a', belly: '#fcf5e6', ear: '#d9a866', nose: '#b57f78', eye: '#4a2e1c', collar: '#3f7fd6', tongue: '#ff8fa3' };
  x.scale(s, s);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#5fb0e8'); g.addColorStop(0.62, '#cfe6f5'); g.addColorStop(0.62, '#3f7f4f'); g.addColorStop(1, '#27563a');
  x.fillStyle = g; if (maskable) x.fillRect(0, 0, 512, 512); else { x.beginPath(); x.roundRect(0, 0, 512, 512, 96); x.fill(); x.clip(); }
  x.fillStyle = '#2f6a43'; for (const [tx, th] of [[60, 150], [120, 110], [420, 160], [470, 120]]) { x.beginPath(); x.moveTo(tx, 318 - th); x.lineTo(tx + 44, 318); x.lineTo(tx - 44, 318); x.fill(); }
  x.fillStyle = '#8d8a80'; x.beginPath(); x.moveTo(170, 318); x.lineTo(256, 150); x.lineTo(350, 318); x.fill(); x.fillStyle = '#f4f4f0'; x.beginPath(); x.moveTo(228, 205); x.lineTo(256, 150); x.lineTo(287, 205); x.lineTo(262, 194); x.lineTo(248, 212); x.fill();
  const k = maskable ? 0.78 : 0.95; x.translate(256, 300); x.scale(k, k);
  const ell = (cx, cy, rx, ry, col, rot = 0) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fill(); };
  ell(0, 150, 120, 90, K.coat); ell(0, 96, 82, 30, K.collar);
  ell(-112, -10, 46, 108, K.ear, 0.28); ell(112, -10, 46, 108, K.ear, -0.28);
  ell(0, -20, 122, 116, K.coat); ell(0, 34, 72, 58, K.belly);
  ell(0, 74, 22, 30, K.tongue); x.strokeStyle = '#e0607a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 60); x.lineTo(0, 92); x.stroke();
  ell(0, 6, 24, 18, K.nose); x.strokeStyle = K.eye; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 22); x.lineTo(0, 40); x.moveTo(-34, 46); x.quadraticCurveTo(-16, 62, 0, 40); x.quadraticCurveTo(16, 62, 34, 46); x.stroke();
  ell(-48, -44, 15, 18, K.eye); ell(48, -44, 15, 18, K.eye); ell(-43, -50, 5, 5, '#fff'); ell(53, -50, 5, 5, '#fff');
  ell(0, 126, 14, 14, '#f0c040');
  return c.toDataURL('image/png');
}
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const out = path.join(__dirname, '..', 'icons'); fs.mkdirSync(out, { recursive: true });
  for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true]]) {
    const url = await p.evaluate(`(${draw.toString()})(${size}, ${mask})`); fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', name);
  }
  await b.close();
})();
