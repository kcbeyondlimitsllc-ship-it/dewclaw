/* Renders the app icons from KC's face (drawn in www/art.js) with Playwright.
   Run: node tools/make-icons.js   -> www/icons/icon-192.png, icon-512.png, maskable-512.png */
"use strict";
const path = require("path");
const { chromium } = require("playwright");
const A = require(path.join(__dirname, "..", "www", "art.js"));
function page(size, maskable) {
  const face = maskable ? 62 : 82, off = (100 - face) / 2;
  return '<!doctype html><html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 100 100">' +
    '<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#a6e4ff"/><stop offset="1" stop-color="#2a8de0"/></radialGradient></defs>' +
    '<rect width="100" height="100" rx="' + (maskable ? 0 : 22) + '" fill="url(#g)"/>' +
    '<g opacity=".35" fill="#fff"><path d="M50 50 L20 -10 L36 -10Z"/><path d="M50 50 L64 -10 L80 -10Z"/><path d="M50 50 L110 20 L110 36Z"/><path d="M50 50 L-10 20 L-10 36Z"/><path d="M50 50 L110 70 L110 86Z"/><path d="M50 50 L-10 70 L-10 86Z"/></g>' +
    '<svg x="' + off + '" y="' + (off + (maskable ? 0 : 2)) + '" width="' + face + '" height="' + face + '" viewBox="0 0 100 100">' + A.kcFaceInner() + "</svg></svg></body></html>";
}
(async () => {
  const browser = await chromium.launch();
  for (const [name, size, mask] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true]]) {
    const pg = await browser.newPage({ viewport: { width: size, height: size } });
    await pg.setContent(page(size, mask));
    await pg.screenshot({ path: path.join(__dirname, "..", "www", "icons", name), omitBackground: true });
    await pg.close();
    console.log("wrote www/icons/" + name);
  }
  await browser.close();
})();
