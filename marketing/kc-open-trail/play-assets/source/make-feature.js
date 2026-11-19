/* Renders feature-graphic.html to ../feature-graphic-1024x500.png.  NODE_PATH=$(npm root -g) node make-feature.js */
const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, 'feature-graphic.html')); await p.waitForTimeout(300);
  await p.locator('#fg').screenshot({ path: path.join(__dirname, '..', 'feature-graphic-1024x500.png'), omitBackground: false }); await b.close(); })();
