# Dewclaw for Android (Google Play)

The Play app is a Trusted Web Activity: a thin Android shell that opens
`https://dewclaw-app.netlify.app` full screen. This folder is the recipe; the
generated Android project and the signing key are not in the repo.

- Package: `com.kcbeyondlimits.dewclaw`
- Targets Android 16 (API 36), minimum Android 7.0 (API 24)
- Play Billing and location delegation are on (`twa-manifest.json`, `features`)
- Permissions in the built app: `INTERNET`, `ACCESS_NETWORK_STATE`,
  `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `com.android.vending.BILLING`.
  No notifications, no advertising ID.

**Ship a new version from GitHub:** see [`../PLAY-CI.md`](../PLAY-CI.md)
(Actions → Android Play upload → Run workflow → app `dewclaw`).

## Files

| File | What it is |
|---|---|
| `twa-manifest.json` | Every setting: package, names, address, colours, version. Edit this. |
| `generate.js` | Writes the Android project from `twa-manifest.json`. Icons and the web manifest come from `site/` in this repo, not from the live site. |
| `build.sh` | One command: write the project, build, sign, check. The same script as in `../kc-open-trail`. |

## Version 1.0.1 (code 2): Play Billing fix

In 1.0.0 (code 1) Play Billing could not work. Bubblewrap switches on
`DelegationService`, the part of the app that Play Billing (the Digital Goods API)
goes through, only together with notifications. Notifications are off in this app,
so the service was off too. `generate.js` now switches the service on by itself.
Notifications stay off: the app still does not ask for the notification permission.
The same service also carries location delegation, so from 1.0.1 the web app's
location requests should go through the app (Android's own location prompt) instead
of Chrome's site permission. Worth a quick check on a phone with the test APK.

`build.sh` checks this on every build: billing permission present,
`DelegationService` enabled and exported, target SDK 36, no notification or
advertising-ID permission.

## Build a new version by hand

Needs Node 18+, JDK 17 or 21, and the Android SDK (`platforms;android-36`,
`build-tools;35.0.0`) with `ANDROID_HOME` set. Gradle comes from the project's own
wrapper (8.11.1).

```
cd android && npm ci && cd dewclaw          # once; node_modules is git-ignored
./build.sh /path/to/dewclaw-upload.keystore /path/to/output-folder
```

It asks for the keystore password (or set `KC_KEYSTORE_PASS`). It writes:

- `dewclaw-<version>-<code>.aab`: upload this to Play Console.
- `dewclaw-<version>-<code>-test.apk`: the same app as one installable file,
  for trying on a phone (`adb install`). Do not upload it.

Before a hand-built upload, raise `appVersionCode` (and, if you like,
`appVersionName`) in `twa-manifest.json`. Google Play rejects a bundle whose version
code it has seen. The GitHub workflow picks the code by itself.

## The signing key

`dewclaw-upload.keystore` is the **upload key**. Every future update must be
signed with it. Keep the file and its passwords somewhere safe and backed up,
outside this repo. If it is lost, Google can reset the upload key from Play
Console, but that takes a support request and a couple of days.

Its SHA-256 fingerprint is in `site/.well-known/assetlinks.json`. Google Play
re-signs the app with its own **app signing key**; that key's SHA-256
fingerprint (Play Console) must be added to the same file, or the app opens
with a browser address bar.
