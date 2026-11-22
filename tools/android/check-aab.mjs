#!/usr/bin/env node
/* Checks a built, signed Play bundle (.aab) against the app's twa-manifest.json.
 *
 *   node tools/android/check-aab.mjs <app.aab> <twa-manifest.json> [--expect-sha256 AA:BB:...]
 *
 * Needs `java` and `keytool` on PATH and BUNDLETOOL set to a bundletool-all jar.
 * KC_VERSION_CODE / KC_VERSION_NAME, when set, are the version the bundle must carry
 * (otherwise the ones in twa-manifest.json). Exits non-zero with a list of problems.
 *
 * What it checks, all read from the bundle itself, not from the Android project:
 *  - package name, versionCode, versionName, targetSdkVersion 36
 *  - Play Billing on  -> BILLING permission present and DelegationService enabled + exported
 *    (Play Billing reaches the app only through DelegationService)
 *  - Play Billing off -> no BILLING permission
 *  - notifications off -> no POST_NOTIFICATIONS permission
 *  - location delegation off -> no location permission
 *  - never the advertising ID permission
 *  - jarsigner verifies, and (with --expect-sha256) the signer is the app's upload key */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TARGET_SDK = '36';
const LOCATION = ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION'];
const AD_ID = 'com.google.android.gms.permission.AD_ID';
const NOTIFY = 'android.permission.POST_NOTIFICATIONS';
const BILLING = 'com.android.vending.BILLING';

const attr = (tag, name) => {
  const m = tag.match(new RegExp('\\s' + name.replace(':', '\\:') + '="([^"]*)"'));
  return m ? m[1] : undefined;
};

/** Reads the parts of a bundletool `dump manifest` XML that the checks need. */
export function parseManifest(xml) {
  const root = xml.match(/<manifest\b[^>]*>/);
  if (!root) throw new Error('no <manifest> element in the bundle manifest');
  const sdk = xml.match(/<uses-sdk\b[^>]*>/);
  const permissions = [...xml.matchAll(/<uses-permission(?:-sdk-23)?\b[^>]*>/g)].map(m => attr(m[0], 'android:name'));
  const services = [...xml.matchAll(/<service\b[^>]*>/g)].map(m => ({
    name: attr(m[0], 'android:name'), enabled: attr(m[0], 'android:enabled'), exported: attr(m[0], 'android:exported'),
  }));
  return {
    package: attr(root[0], 'package'),
    versionCode: attr(root[0], 'android:versionCode'),
    versionName: attr(root[0], 'android:versionName'),
    minSdk: sdk ? attr(sdk[0], 'android:minSdkVersion') : undefined,
    targetSdk: sdk ? attr(sdk[0], 'android:targetSdkVersion') : undefined,
    permissions, services,
  };
}

/** Returns a list of problems (empty when the bundle is right). */
export function checkManifest(m, twa, version = {}) {
  const problems = [];
  const code = String(version.code ?? twa.appVersionCode);
  const name = String(version.name ?? twa.appVersionName);
  const on = f => !!(twa.features && twa.features[f] && twa.features[f].enabled);
  const has = p => m.permissions.includes(p);
  if (m.package !== twa.packageId) problems.push(`package is ${m.package}, expected ${twa.packageId}`);
  if (m.versionCode !== code) problems.push(`versionCode is ${m.versionCode}, expected ${code}`);
  if (m.versionName !== name) problems.push(`versionName is ${m.versionName}, expected ${name}`);
  if (m.targetSdk !== TARGET_SDK) problems.push(`targetSdkVersion is ${m.targetSdk}, Play needs ${TARGET_SDK}`);
  if (String(twa.minSdkVersion) !== m.minSdk) problems.push(`minSdkVersion is ${m.minSdk}, expected ${twa.minSdkVersion}`);

  const delegation = m.services.find(s => s.name === `${twa.packageId}.DelegationService`);
  if (on('playBilling')) {
    if (!has(BILLING)) problems.push('Play Billing is on but the BILLING permission is missing');
    if (!delegation) problems.push('Play Billing is on but there is no DelegationService');
    else if (delegation.enabled !== 'true' || delegation.exported !== 'true') {
      problems.push(`Play Billing is on but DelegationService is enabled=${delegation.enabled} exported=${delegation.exported} (must both be true)`);
    }
  } else if (has(BILLING)) problems.push('Play Billing is off but the app asks for the BILLING permission');
  if (!twa.enableNotifications && has(NOTIFY)) problems.push('notifications are off but the app asks for POST_NOTIFICATIONS');
  if (!on('locationDelegation')) {
    for (const p of LOCATION) if (has(p)) problems.push(`location delegation is off but the app asks for ${p}`);
  }
  if (has(AD_ID)) problems.push('the app asks for the advertising ID (AD_ID); it must not');
  return problems;
}

/** Pulls the SHA-256 certificate fingerprint out of `keytool -printcert` output. */
export function parseSha256(keytoolOutput) {
  const all = [...keytoolOutput.matchAll(/SHA256:\s*([0-9A-F]{2}(?::[0-9A-F]{2}){31})/gi)].map(m => m[1].toUpperCase());
  const unique = [...new Set(all)];
  if (unique.length !== 1) throw new Error(`expected exactly one signer certificate, found ${unique.length}`);
  return unique[0];
}

export const normalizeSha256 = s => String(s || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '').replace(/(..)(?!$)/g, '$1:');

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
}

function main(argv) {
  const [aab, twaPath, ...rest] = argv;
  if (!aab || !twaPath) throw new Error('usage: check-aab.mjs <app.aab> <twa-manifest.json> [--expect-sha256 FP]');
  const i = rest.indexOf('--expect-sha256');
  const expect = i >= 0 ? rest[i + 1] : '';
  if (i >= 0 && !expect) throw new Error('--expect-sha256 needs a fingerprint');
  if (!process.env.BUNDLETOOL) throw new Error('set BUNDLETOOL to a bundletool-all jar');
  const twa = JSON.parse(fs.readFileSync(twaPath, 'utf8'));
  const version = { code: process.env.KC_VERSION_CODE || undefined, name: process.env.KC_VERSION_NAME || undefined };

  const m = parseManifest(run('java', ['-jar', process.env.BUNDLETOOL, 'dump', 'manifest', '--bundle', aab]));
  console.log(`bundle: ${m.package} versionCode=${m.versionCode} versionName=${m.versionName} minSdk=${m.minSdk} targetSdk=${m.targetSdk}`);
  console.log('permissions: ' + m.permissions.join(', '));
  const d = m.services.find(s => s.name === `${twa.packageId}.DelegationService`);
  console.log(`DelegationService: enabled=${d && d.enabled} exported=${d && d.exported}`);
  const problems = checkManifest(m, twa, version);

  const verify = run('jarsigner', ['-verify', aab]);
  if (!/jar verified/.test(verify)) problems.push('jarsigner could not verify the bundle signature');
  const sha = parseSha256(run('keytool', ['-printcert', '-jarfile', aab]));
  console.log('signer SHA-256: ' + sha);
  if (expect && sha !== normalizeSha256(expect)) {
    problems.push(`signed with ${sha}, but this app's upload key is ${normalizeSha256(expect)}`);
  }
  if (problems.length) {
    for (const p of problems) console.error('PROBLEM: ' + p);
    process.exit(1);
  }
  console.log('bundle checks passed' + (expect ? ' (signed with the expected upload key)' : ''));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('FAIL: ' + e.message); process.exit(1); }
}
