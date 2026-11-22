/* Dry run of the "Android Play upload" workflow's logic, without Google credentials.
 *
 *   node --test tools/play/
 *
 * - versionCode / status choice against mocked Play API responses (no network)
 * - keystore.sh: secret -> private file -> checked -> removed, with a throwaway keystore
 * - with the real upload keys present in release-upload/ (only on the owner's machine):
 *   each keystore's fingerprint equals android/play-apps.json, and a bundle signed with
 *   the other app's key is refused. Skipped when those files are not there (as in CI). */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide, highestVersionCode, isDraftApp, main, makeAssertion } from './play-state.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'android', 'play-apps.json'), 'utf8'));
const KEYSTORE_SH = path.join(ROOT, 'tools', 'play', 'keystore.sh');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'play-ci-'));

/* What Play returned for Dewclaw-like and new-app-like states (shape from the v3 REST reference). */
const DEWCLAW_STATE = {
  tracks: [
    { track: 'production', releases: [] },
    { track: 'beta', releases: [{ status: 'completed', versionCodes: ['1'] }] },
    { track: 'internal', releases: [{ status: 'completed', versionCodes: ['1'] }, { status: 'draft', versionCodes: ['3'] }] },
  ],
  bundles: [{ versionCode: 1 }, { versionCode: 3 }, { versionCode: 2 }],
  apks: [],
};
const NEW_APP_STATE = { tracks: [{ track: 'internal', releases: [{ status: 'draft', versionCodes: ['1'] }] }], bundles: [{ versionCode: 1 }], apks: [] };

test('highest versionCode looks at every track, bundle and APK', () => {
  assert.equal(highestVersionCode(DEWCLAW_STATE), 3);
  assert.equal(highestVersionCode({ tracks: [], bundles: [], apks: [{ versionCode: 9 }] }), 9);
  assert.equal(highestVersionCode({}), 0);
});

test('released app: next code, status completed', () => {
  assert.equal(isDraftApp(DEWCLAW_STATE.tracks), false);
  assert.deepEqual(decide({ state: DEWCLAW_STATE }), { versionCode: 4, status: 'completed', highest: 3, draftApp: false, source: 'Play highest + 1' });
});

test('draft app (nothing rolled out yet): status draft, completed refused', () => {
  assert.equal(isDraftApp(NEW_APP_STATE.tracks), true);
  assert.equal(decide({ state: NEW_APP_STATE }).status, 'draft');
  assert.equal(decide({ state: NEW_APP_STATE }).versionCode, 2);
  assert.throws(() => decide({ state: NEW_APP_STATE, statusInput: 'completed' }), /only accepts status draft/);
});

test('override: must be above Play, used as-is when Play cannot be read', () => {
  assert.equal(decide({ state: DEWCLAW_STATE, override: '10' }).versionCode, 10);
  assert.throws(() => decide({ state: DEWCLAW_STATE, override: '3' }), /not above 3/);
  assert.throws(() => decide({ state: DEWCLAW_STATE, override: '2.5' }), /whole number/);
  assert.deepEqual(decide({ state: null, error: 'x', override: '7' }), { versionCode: 7, status: 'draft', highest: null, draftApp: null, source: 'override (Play not readable)' });
  assert.equal(decide({ state: null, error: 'x', override: '7', statusInput: 'completed' }).status, 'completed');
  assert.throws(() => decide({ state: null, error: 'boom' }), /could not read Play \(boom\)/);
  assert.throws(() => decide({ state: DEWCLAW_STATE, statusInput: 'inProgress' }), /status must be/);
});

/* A fake Play: checks the calls the script makes, in order, and that the edit is deleted. */
function fakePlay(pkg, state, { notFound = false } = {}) {
  const calls = [];
  const res = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body });
  const fetchFn = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url === 'https://oauth2.googleapis.com/token') {
      const assertion = new URLSearchParams(init.body).get('assertion');
      assert.equal(assertion.split('.').length, 3);
      return res(200, { access_token: 'tok' });
    }
    assert.equal(init.headers.Authorization, 'Bearer tok');
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/edits`;
    if (notFound) return res(404, { error: { message: 'Package not found: ' + pkg } });
    if (init.method === 'POST' && url === base) return res(200, { id: 'e1' });
    if (url === `${base}/e1/tracks`) return res(200, { tracks: state.tracks });
    if (url === `${base}/e1/bundles`) return res(200, { bundles: state.bundles });
    if (url === `${base}/e1/apks`) return res(200, {});
    if (init.method === 'DELETE' && url === `${base}/e1`) return res(204, {});
    throw new Error('unexpected call ' + url);
  };
  return { fetchFn, calls };
}
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({ type: 'service_account', client_email: 'ci@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' });

test('main(): reads Play through a throwaway edit, deletes it, writes GitHub outputs, never logs the key', async () => {
  const pkg = APPS.dewclaw.packageId;
  const { fetchFn, calls } = fakePlay(pkg, DEWCLAW_STATE);
  const dir = tmp(); const out = path.join(dir, 'out');
  const lines = [];
  const d = await main({ env: { PLAY_SERVICE_ACCOUNT_JSON: SA, GITHUB_OUTPUT: out }, argv: [pkg], fetchFn, log: s => lines.push(s) });
  assert.equal(d.versionCode, 4);
  assert.equal(calls.at(-1), `DELETE https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/edits/e1`);
  assert.equal(fs.readFileSync(out, 'utf8'), 'version_code=4\nstatus=completed\nhighest=3\ndraft_app=false\n');
  assert.ok(!lines.join('\n').includes('PRIVATE KEY'));
  fs.rmSync(dir, { recursive: true });
});

test('main(): "Package not found" falls back to the override and says why', async () => {
  const pkg = APPS['kc-open-trail'].packageId;
  const { fetchFn } = fakePlay(pkg, NEW_APP_STATE, { notFound: true });
  const lines = [];
  const d = await main({ env: { PLAY_SERVICE_ACCOUNT_JSON: SA, VERSION_CODE_OVERRIDE: '2' }, argv: [pkg], fetchFn, log: s => lines.push(s) });
  assert.equal(d.versionCode, 2);
  assert.match(lines.join('\n'), /upload its first bundle by hand/);
  await assert.rejects(main({ env: { PLAY_SERVICE_ACCOUNT_JSON: SA }, argv: [pkg], fetchFn, log: () => {} }), /no version code override/);
});

test('service-account assertion is a valid RS256 JWT', () => {
  const sa = JSON.parse(SA);
  const [h, c, s] = makeAssertion(sa, 1000).split('.');
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/androidpublisher');
  assert.equal(claims.exp - claims.iat, 600);
  assert.ok(crypto.createVerify('RSA-SHA256').update(h + '.' + c).verify(crypto.createPublicKey(sa.private_key), Buffer.from(s, 'base64url')));
  assert.throws(() => makeAssertion({ type: 'authorized_user' }), /not a service-account key/);
});

function runKeystore(args, env) {
  return spawnSync('bash', [KEYSTORE_SH, ...args], { env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env }, encoding: 'utf8' });
}

test('keystore.sh: decode -> private file -> remove; secrets never printed', () => {
  const dir = tmp();
  const ks = path.join(dir, 'throwaway.keystore');
  const pass = 'throwaway-' + crypto.randomBytes(8).toString('hex');
  execFileSync('keytool', ['-genkeypair', '-keystore', ks, '-storepass', pass, '-keypass', pass, '-alias', 'ci',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '2', '-dname', 'CN=throwaway'], { stdio: 'ignore' });
  const b64 = fs.readFileSync(ks).toString('base64');
  const target = path.join(dir, 'runner-temp', 'upload.keystore');
  const env = { KEYSTORE_B64: b64.replace(/(.{76})/g, '$1\n'), KEYSTORE_PASSWORD: pass, KEY_ALIAS: 'ci' };

  const ok = runKeystore(['decode', target], env);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(!(ok.stdout + ok.stderr).includes(pass), 'password printed');
  assert.ok(!(ok.stdout + ok.stderr).includes(b64.slice(0, 40)), 'keystore printed');
  assert.match(ok.stdout, /certificate SHA256: ([0-9A-F]{2}:){31}[0-9A-F]{2}/);
  assert.deepEqual(fs.readFileSync(target), fs.readFileSync(ks));
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);

  const rm = runKeystore(['remove', target], {});
  assert.equal(rm.status, 0);
  assert.equal(fs.existsSync(target), false);
  assert.equal(runKeystore(['remove', target], {}).status, 0, 'remove is safe to repeat');

  for (const [bad, re] of [[{ ...env, KEYSTORE_PASSWORD: 'wrong' }, /could not open/], [{ ...env, KEY_ALIAS: 'nope' }, /could not open/],
    [{ ...env, KEYSTORE_B64: '%%%' }, /not valid base64/], [{ ...env, KEYSTORE_B64: '' }, /empty or not set/]]) {
    const r = runKeystore(['decode', target], bad);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, re);
    assert.equal(fs.existsSync(target), false, 'nothing left behind after a failed decode');
    assert.ok(!(r.stdout + r.stderr).includes(pass));
  }
  fs.rmSync(dir, { recursive: true });
});

/* Owner's machine only: the real upload keys. */
const KEYS = path.join(ROOT, 'release-upload', 'keys-KEEP-PRIVATE');
const realPass = app => {
  const f = path.join(KEYS, `${app}-KEYSTORE-PASSWORDS.txt`);
  const line = fs.readFileSync(f, 'utf8').split('\n').find(l => /^Keystore pass/i.test(l));
  return line.replace(/^[^:]*:\s*/, '').split(/\s/)[0];
};
for (const [app, cfg] of Object.entries(APPS).filter(([k]) => !k.startsWith('_'))) {
  const ksFile = path.join(KEYS, `${app}-upload.keystore`);
  test(`real ${app} upload key matches play-apps.json`, { skip: !fs.existsSync(ksFile) && 'real keys not here' }, () => {
    const dir = tmp(); const target = path.join(dir, 'upload.keystore');
    const alias = JSON.parse(fs.readFileSync(path.join(ROOT, cfg.dir, 'twa-manifest.json'), 'utf8')).signingKey.alias;
    const r = runKeystore(['decode', target], { KEYSTORE_B64: fs.readFileSync(ksFile).toString('base64'), KEYSTORE_PASSWORD: realPass(app), KEY_ALIAS: alias });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.match(/SHA256: (\S+)/)[1], cfg.uploadKeySha256);
    assert.equal(runKeystore(['remove', target], {}).status, 0);
    assert.equal(fs.existsSync(target), false);
    fs.rmSync(dir, { recursive: true });
  });
}

const DEW_AAB = path.join(ROOT, 'release-upload', 'dewclaw-1.0.1-2.aab');
test('signer guard: the Dewclaw bundle passes with its key and is refused for the other app\'s key',
  { skip: (!fs.existsSync(DEW_AAB) || !process.env.BUNDLETOOL) && 'needs release-upload/dewclaw-1.0.1-2.aab and BUNDLETOOL' }, () => {
    const check = path.join(ROOT, 'tools', 'android', 'check-aab.mjs');
    const twa = path.join(ROOT, 'android', 'dewclaw', 'twa-manifest.json');
    const env = { ...process.env, KC_VERSION_CODE: '2', KC_VERSION_NAME: '1.0.1' };
    const good = spawnSync('node', [check, DEW_AAB, twa, '--expect-sha256', APPS.dewclaw.uploadKeySha256], { env, encoding: 'utf8' });
    assert.equal(good.status, 0, good.stderr);
    const bad = spawnSync('node', [check, DEW_AAB, twa, '--expect-sha256', APPS['kc-open-trail'].uploadKeySha256], { env, encoding: 'utf8' });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /signed with 09:F8.*but this app's upload key is F7:BD/);
  });
