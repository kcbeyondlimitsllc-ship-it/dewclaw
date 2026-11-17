const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');
const path = require('path');
(async () => {
  const url = 'https://dewclaw-app.netlify.app/manifest.webmanifest';
  const m = await TwaManifest.fromWebManifest(url);
  m.packageId = 'com.kcbeyondlimits.dewclaw';
  m.name = 'Dewclaw'; m.launcherName = 'Dewclaw';
  m.appVersionCode = 1; m.appVersionName = '1.0.0';
  m.signingKey = { path: process.argv[2], alias: 'dewclaw' };
  m.features = { locationDelegation: { enabled: true }, playBilling: { enabled: true } };
  m.enableNotifications = false;
  m.fallbackType = 'customtabs';
  m.minSdkVersion = 24;
  m.generatorApp = 'bubblewrap-core';
  console.log(JSON.stringify({ host: m.host, startUrl: m.startUrl, icon: m.iconUrl, mask: m.maskableIconUrl, display: m.display, orientation: m.orientation, theme: m.themeColor.hex(), bg: m.backgroundColor.hex(), shortcuts: m.shortcuts.length, validate: m.validate() }, null, 1));
  const out = path.resolve('project');   /* generated, not committed */
  await new TwaGenerator().createTwaProject(out, m, new ConsoleLog('gen'));
  await m.saveToFile(path.join(out, 'twa-manifest.json'));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
