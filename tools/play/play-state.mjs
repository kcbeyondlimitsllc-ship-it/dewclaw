#!/usr/bin/env node
/* Asks Google Play what it already has for an app, so CI can pick the next versionCode
 * and the release status Play will accept. Read-only: it opens an edit, reads, and
 * deletes the edit again without committing anything.
 *
 *   PLAY_SERVICE_ACCOUNT_JSON='{...}' node tools/play/play-state.mjs <packageName>
 *
 * Optional environment:
 *   VERSION_CODE_OVERRIDE  use this versionCode (must be above what Play has, when Play can be read;
 *                          used as-is when Play cannot be read)
 *   STATUS_INPUT           auto (default) | draft | completed
 *   GITHUB_OUTPUT          when set (in GitHub Actions), writes version_code, status, highest, draft_app
 *
 * No dependencies: the service-account token is made with node:crypto. The key is never printed. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const LIVE = new Set(['completed', 'inProgress', 'halted']);
export const MAX_VERSION_CODE = 2100000000;

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** A signed JWT assertion for the OAuth token endpoint (RFC 7523). */
export function makeAssertion(sa, now = Math.floor(Date.now() / 1000)) {
  if (!sa || sa.type !== 'service_account' || !sa.client_email || !sa.private_key) {
    throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not a service-account key file (needs type, client_email, private_key)');
  }
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(header + '.' + claims).sign(sa.private_key);
  return header + '.' + claims + '.' + b64url(sig);
}

/** Highest versionCode Play knows about, from track releases and uploaded bundles/APKs. */
export function highestVersionCode({ tracks = [], bundles = [], apks = [] }) {
  const codes = [];
  for (const t of tracks) for (const r of t.releases || []) for (const c of r.versionCodes || []) codes.push(Number(c));
  for (const b of bundles) codes.push(Number(b.versionCode));
  for (const a of apks) codes.push(Number(a.versionCode));
  const ok = codes.filter(n => Number.isInteger(n) && n > 0);
  return ok.length ? Math.max(...ok) : 0;
}

/** True while nothing has ever been rolled out on any track: Play then only accepts draft releases. */
export function isDraftApp(tracks = []) {
  return !tracks.some(t => (t.releases || []).some(r => LIVE.has(r.status)));
}

/** Pure decision: what versionCode and status to use. */
export function decide({ state, error, override, statusInput = 'auto' }) {
  const want = String(statusInput || 'auto');
  if (!['auto', 'draft', 'completed'].includes(want)) throw new Error(`status must be auto, draft or completed, not "${want}"`);
  let code;
  if (override !== undefined && override !== null && String(override).trim() !== '') {
    code = Number(String(override).trim());
    if (!Number.isInteger(code) || code < 1 || code > MAX_VERSION_CODE) throw new Error(`version code override "${override}" is not a whole number from 1 to ${MAX_VERSION_CODE}`);
  }
  if (!state) {
    if (code === undefined) throw new Error('could not read Play (' + error + ') and no version code override was given');
    return { versionCode: code, status: want === 'auto' ? 'draft' : want, highest: null, draftApp: null, source: 'override (Play not readable)' };
  }
  const highest = highestVersionCode(state);
  const draftApp = isDraftApp(state.tracks);
  if (code !== undefined && code <= highest) throw new Error(`version code override ${code} is not above ${highest}, the highest Play already has`);
  const versionCode = code !== undefined ? code : highest + 1;
  if (versionCode > MAX_VERSION_CODE) throw new Error('versionCode would pass Play\'s limit');
  let status = want === 'auto' ? (draftApp ? 'draft' : 'completed') : want;
  if (draftApp && status !== 'draft') throw new Error('this app has never been rolled out on any track, so Play only accepts status draft; roll out its first release in Play Console once, or pick status draft/auto');
  return { versionCode, status, highest, draftApp, source: code !== undefined ? 'override' : 'Play highest + 1' };
}

async function call(fetchFn, method, url, token, body) {
  const res = await fetchFn(url, {
    method, headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).error.message; } catch { /* keep text */ }
    const e = new Error(`${method} ${url.replace(API, '')} -> ${res.status} ${String(msg).slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return text ? JSON.parse(text) : {};
}

/** Reads tracks, bundles and APKs through a throwaway edit, which is always deleted. */
export async function readPlayState(packageName, sa, fetchFn = globalThis.fetch) {
  const tokenRes = await fetchFn(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: makeAssertion(sa) }).toString(),
  });
  const tok = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tok.access_token) throw new Error(`Google sign-in for the service account failed (${tokenRes.status} ${tok.error || ''})`);
  const token = tok.access_token;
  const base = API + encodeURIComponent(packageName) + '/edits';
  const edit = await call(fetchFn, 'POST', base, token, {});
  try {
    const [t, b, a] = await Promise.all([
      call(fetchFn, 'GET', `${base}/${edit.id}/tracks`, token),
      call(fetchFn, 'GET', `${base}/${edit.id}/bundles`, token),
      call(fetchFn, 'GET', `${base}/${edit.id}/apks`, token),
    ]);
    return { tracks: t.tracks || [], bundles: b.bundles || [], apks: a.apks || [] };
  } finally {
    await call(fetchFn, 'DELETE', `${base}/${edit.id}`, token).catch(() => {});
  }
}

export async function main({ env = process.env, argv = process.argv.slice(2), fetchFn = globalThis.fetch, log = console.log } = {}) {
  const pkg = argv[0];
  if (!pkg) throw new Error('usage: play-state.mjs <packageName>');
  let state = null, error = '';
  try {
    if (!env.PLAY_SERVICE_ACCOUNT_JSON) throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not set');
    let sa;
    try { sa = JSON.parse(env.PLAY_SERVICE_ACCOUNT_JSON); } catch { throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not valid JSON'); }
    state = await readPlayState(pkg, sa, fetchFn);
  } catch (e) {
    error = e.message;
    if (e.status === 404) error += ' (Play does not know this package yet: upload its first bundle by hand in Play Console)';
    log('could not read Play: ' + error);
  }
  if (state) {
    for (const t of state.tracks) {
      log(`track ${t.track}: ` + ((t.releases || []).map(r => `${r.status} [${(r.versionCodes || []).join(',')}]`).join('; ') || 'no releases'));
    }
    log(`bundles on Play: ${state.bundles.map(b => b.versionCode).join(', ') || 'none'}`);
  }
  const d = decide({ state, error, override: env.VERSION_CODE_OVERRIDE, statusInput: env.STATUS_INPUT });
  log(`versionCode ${d.versionCode} (${d.source}), release status ${d.status}` + (d.draftApp ? ' (draft app: nothing rolled out yet)' : ''));
  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `version_code=${d.versionCode}\nstatus=${d.status}\nhighest=${d.highest ?? ''}\ndraft_app=${d.draftApp ?? ''}\n`);
  }
  return d;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
}
