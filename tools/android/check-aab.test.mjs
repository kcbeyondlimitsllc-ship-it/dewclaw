/* node --test tools/android/check-aab.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseManifest, checkManifest, parseSha256, normalizeSha256 } from './check-aab.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const twa = app => JSON.parse(fs.readFileSync(path.join(ROOT, 'android', app, 'twa-manifest.json'), 'utf8'));

function xml({ pkg, code = '2', name = '1.0.1', target = '36', perms = [], delegation = 'true' }) {
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android" android:versionCode="${code}" android:versionName="${name}" package="${pkg}">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="${target}"/>
${perms.map(p => `  <uses-permission android:name="${p}"/>`).join('\n')}
  <application>
    <service android:enabled="${delegation}" android:exported="${delegation}" android:name="${pkg}.DelegationService">
    </service>
  </application>
</manifest>`;
}

test('Dewclaw as built by build.sh passes', () => {
  const t = twa('dewclaw');
  const m = parseManifest(xml({ pkg: t.packageId, code: String(t.appVersionCode), name: t.appVersionName,
    perms: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'com.android.vending.BILLING', 'android.permission.INTERNET'] }));
  assert.deepEqual(checkManifest(m, t), []);
});

test('the Dewclaw 1.0.0 bug (DelegationService off) is caught', () => {
  const t = twa('dewclaw');
  const m = parseManifest(xml({ pkg: t.packageId, code: String(t.appVersionCode), name: t.appVersionName,
    perms: ['android.permission.ACCESS_FINE_LOCATION', 'com.android.vending.BILLING'], delegation: '@bool/enableNotification' }));
  assert.match(checkManifest(m, t).join('\n'), /DelegationService is enabled=@bool\/enableNotification/);
});

test('KC: Open Trail must not ask for location, AD_ID or notifications', () => {
  const t = twa('kc-open-trail');
  const good = parseManifest(xml({ pkg: t.packageId, code: '1', name: '1.0.0', perms: ['com.android.vending.BILLING', 'android.permission.INTERNET'] }));
  assert.deepEqual(checkManifest(good, t), []);
  const bad = parseManifest(xml({ pkg: t.packageId, code: '1', name: '1.0.0', perms: ['com.android.vending.BILLING',
    'android.permission.ACCESS_FINE_LOCATION', 'com.google.android.gms.permission.AD_ID', 'android.permission.POST_NOTIFICATIONS'] }));
  const p = checkManifest(bad, t).join('\n');
  assert.match(p, /ACCESS_FINE_LOCATION/);
  assert.match(p, /AD_ID/);
  assert.match(p, /POST_NOTIFICATIONS/);
});

test('wrong package, version, target SDK and missing billing are all reported', () => {
  const t = twa('kc-open-trail');
  const m = parseManifest(xml({ pkg: 'com.example.other', code: '7', name: '9', target: '35', perms: [] }));
  const p = checkManifest(m, t, { code: 5, name: '1.2.3' }).join('\n');
  for (const re of [/package is com.example.other/, /versionCode is 7, expected 5/, /versionName is 9, expected 1.2.3/,
    /targetSdkVersion is 35/, /BILLING permission is missing/, /no DelegationService/]) assert.match(p, re);
});

test('version override from CI is what the bundle must carry', () => {
  const t = twa('dewclaw');
  const m = parseManifest(xml({ pkg: t.packageId, code: '41', name: '1.0.1',
    perms: ['com.android.vending.BILLING', 'android.permission.ACCESS_FINE_LOCATION'] }));
  assert.deepEqual(checkManifest(m, t, { code: '41' }), []);
  assert.equal(checkManifest(m, t).length, 1);
});

test('signer fingerprint parsing and normalising', () => {
  const out = 'Signer #1:\n\nCertificate #1:\nOwner: CN=x\n\t SHA1: AA\n\t SHA256: 09:F8:09:8A:0A:1C:81:5A:83:69:1E:4B:A1:40:F1:7B:72:07:AB:79:6C:FE:6F:34:41:CE:D1:D9:68:5E:91:B1\n';
  assert.equal(parseSha256(out), '09:F8:09:8A:0A:1C:81:5A:83:69:1E:4B:A1:40:F1:7B:72:07:AB:79:6C:FE:6F:34:41:CE:D1:D9:68:5E:91:B1');
  assert.equal(normalizeSha256('09f8098a0a1c815a83691e4ba140f17b7207ab796cfe6f3441ced1d9685e91b1'), parseSha256(out));
  assert.throws(() => parseSha256('no certificate here'), /exactly one signer/);
  const two = out + out.replace('09:F8', '0A:F8');
  assert.throws(() => parseSha256(two), /exactly one signer/);
});
