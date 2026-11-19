/* Writes the Android project for the KC: Open Trail Play app (a Trusted Web Activity).
 *
 *   node generate.js /path/to/kc-open-trail-upload.keystore [output-folder]
 *
 * Every setting comes from twa-manifest.json beside this file; edit that, not this.
 * The icons and the web manifest are read from this repo (site/games/kc-open-trail),
 * through a throwaway server on 127.0.0.1, so the build does not depend on what is
 * currently deployed. Nothing is sent anywhere. */
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');
const fs = require('fs');
const http = require('http');
const path = require('path');

const SITE = path.resolve(__dirname, '..', '..', 'site');
const TYPES = { '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function serveSite() {
  const server = http.createServer((req, res) => {
    const file = path.normalize(path.join(SITE, decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

(async () => {
  const keystore = process.argv[2];
  if (!keystore) throw new Error('usage: node generate.js /path/to/kc-open-trail-upload.keystore [output-folder]');
  const out = path.resolve(process.argv[3] || path.join(__dirname, 'project'));   /* generated, not committed */

  const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'twa-manifest.json'), 'utf8'));
  json.appVersion = json.appVersionName;            /* bubblewrap reads the name from "appVersion" */
  json.signingKey = { path: path.resolve(keystore), alias: json.signingKey.alias };

  const server = await serveSite();
  const live = 'https://' + json.host;
  const local = 'http://127.0.0.1:' + server.address().port;
  const toLocal = u => u.replace(live, local);
  try {
    const m = new TwaManifest(Object.assign({}, json, {
      iconUrl: toLocal(json.iconUrl),
      maskableIconUrl: toLocal(json.maskableIconUrl),
      webManifestUrl: toLocal(json.webManifestUrl),
    }));
    const problem = m.validate();
    if (problem) throw new Error('twa-manifest.json: ' + problem);
    console.log(JSON.stringify({
      package: m.packageId, host: m.host, startUrl: m.startUrl, scope: String(m.fullScopeUrl),
      version: m.appVersionName, versionCode: m.appVersionCode, display: m.display,
      orientation: m.orientation, minSdk: m.minSdkVersion, features: Object.keys(m.features), out,
    }, null, 1));
    await new TwaGenerator().createTwaProject(out, m, new ConsoleLog('gen'));
  } finally {
    server.close(); server.closeAllConnections();
  }
  /* Three fixes to what bubblewrap wrote. */
  const edit = (file, fn) => {
    const p = path.join(out, file), before = fs.readFileSync(p, 'utf8'), after = fn(before);
    if (after === before) throw new Error('expected to change ' + file + ' but nothing matched');
    fs.writeFileSync(p, after);
  };
  /* 1. The app must carry the real web manifest address, not the throwaway local one. */
  edit('app/build.gradle', s => s.split(local).join(live));
  /* 2. jcenter() was shut down; mavenCentral() has the same libraries. */
  edit('build.gradle', s => s.replace(/jcenter\(\)/g, 'mavenCentral()'));
  /* 3. Play Billing reaches the app through DelegationService, which bubblewrap only switches
        on together with notifications. Switch the service on by itself, so billing can work
        while the app still asks for no notification permission. */
  if (json.features.playBilling && json.features.playBilling.enabled && !json.enableNotifications) {
    edit('app/src/main/AndroidManifest.xml', s => s.replace(
      /android:enabled="@bool\/enableNotification"\s+android:exported="@bool\/enableNotification"/,
      'android:enabled="true"\n            android:exported="true"'));
  }
  if (process.env.ANDROID_HOME) fs.writeFileSync(path.join(out, 'local.properties'), 'sdk.dir=' + process.env.ANDROID_HOME + '\n');

  /* Keep a copy of the settings the project was made from, with the real web addresses. */
  json.signingKey.path = './' + path.basename(keystore);
  fs.writeFileSync(path.join(out, 'twa-manifest.json'), JSON.stringify(json, null, 2) + '\n');
  process.exit(0);   /* bubblewrap's downloader keeps a connection pool open */
})().catch(e => { console.error('FAIL', e); process.exit(1); });
