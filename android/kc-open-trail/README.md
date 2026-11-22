# KC: Open Trail for Android (Google Play)

The Play app is a Trusted Web Activity: a thin Android shell that opens
`https://dewclaw-app.netlify.app/games/kc-open-trail/?src=play` full screen.
The game itself is the web game in `site/games/kc-open-trail`; changing the game
needs a site deploy, not a new Android build. This folder is the recipe. The
generated Android project, the signing key and the built files are not in the repo.

- Package: `com.kcbeyondlimits.kcopentrail`
- Store name "KC: Open Trail", home-screen name "KC Open Trail"
- Targets Android 16 (API 36, required for new apps since 31 Aug 2026), minimum Android 7.0 (API 24)
- Full screen (immersive), portrait and landscape
- Play Billing is switched on in the shell (Billing Library 8.3.0). No location, no notifications, no advertising ID.
- Permissions in the built app: `INTERNET`, `ACCESS_NETWORK_STATE`, `com.android.vending.BILLING`
- `?src=play` on the start address is how the game can tell it was opened from the Play app.

**Ship a new version from GitHub:** see [`../PLAY-CI.md`](../PLAY-CI.md)
(Actions → Android Play upload → Run workflow → app `kc-open-trail`). The very first
upload has to be done by hand in Play Console; after that, GitHub can do it.

## Files

| File | What it is |
|---|---|
| `twa-manifest.json` | Every setting: package, names, address, colours, version. Edit this. |
| `generate.js` | Writes the Android project from `twa-manifest.json`. Icons and splash come from `site/games/kc-open-trail/icons` in this repo, not from the live site. |
| `build.sh` | One command: write the project, build, sign, check. The same script as in `../dewclaw`. |

## Build a new version

Needs Node 18+, JDK 17 or 21, and the Android SDK
(`platforms;android-36`, `build-tools;35.0.0`) with `ANDROID_HOME` set. Gradle comes
from the project's own wrapper (8.11.1); `GRADLE=gradle` uses an installed one instead.

```
cd android && npm ci && cd kc-open-trail    # once; node_modules is git-ignored
./build.sh /path/to/kc-open-trail-upload.keystore /path/to/output-folder
```

It asks for the keystore password (or set `KC_KEYSTORE_PASS`). It writes:

- `kc-open-trail-<version>-<code>.aab`: upload this to Play Console.
- `kc-open-trail-<version>-<code>-test.apk`: the same app as one installable file,
  for trying on a phone (`adb install`). Do not upload it.

The script stops with an error if the signature, package name, version, target SDK,
the billing permission or `DelegationService` is not what it should be, or if the app
asks for location, notifications or the advertising ID. Keep the output folder outside the repo.

By hand, the same steps are:

```
node generate.js /path/to/kc-open-trail-upload.keystore      # writes ./project
cd project
./gradlew bundleRelease assembleRelease
jarsigner -keystore /path/to/kc-open-trail-upload.keystore -sigalg SHA256withRSA -digestalg SHA-256 \
  app/build/outputs/bundle/release/app-release.aab kcopentrail
```

## Raise the version

The GitHub workflow picks the version code by itself. For a hand-built upload,
edit two lines in `twa-manifest.json` first:

- `appVersionCode`: add 1 every time (1, 2, 3 …). Google Play rejects a bundle whose code it has seen.
- `appVersionName`: what people see, for example `1.0.1`.

Then run `build.sh` again.

## The signing key

`kc-open-trail-upload.keystore` (alias `kcopentrail`) is the **upload key**. Every
future update must be signed with it. Keep the file and its password somewhere safe
and backed up, outside this repo (`.gitignore` already blocks `*.keystore` and
`KEYSTORE-PASSWORDS.txt`). If it is lost, Google can reset the upload key from Play
Console, but that takes a support request and a couple of days.

## assetlinks.json: do this after the first upload

`site/.well-known/assetlinks.json` tells Chrome the app and the website belong
together. It already lists this app with the upload key's SHA-256 fingerprint:

`F7:BD:DD:4C:C2:9F:68:43:97:6E:8E:BA:0C:16:30:42:DA:58:AA:A6:6E:BA:65:84:03:E7:FB:D8:E4:57:5F:63`

Google Play re-signs the app with its own **app signing key**, so the copy people
install from Play has a different fingerprint. After the first upload:

1. Play Console > the app > Test and release > App integrity > App signing
   (called Setup > App signing in older layouts).
2. Copy the "SHA-256 certificate fingerprint" under **App signing key certificate**.
3. Add it as a second line in `sha256_cert_fingerprints` for
   `com.kcbeyondlimits.kcopentrail` (keep the upload-key line, and keep the Dewclaw entry).
4. Deploy the site, then check
   `https://dewclaw-app.netlify.app/.well-known/assetlinks.json` shows it.

**Until that is done, the app installed from Play opens with a browser address bar
at the top instead of full screen.** Check on an internal-testing install before
sending the app for review. If the bar still shows after the deploy, clear Chrome's
storage for the site on the test phone or reinstall the app; Chrome remembers a
failed check for a while.

## Things to know

- **Purchases.** Payments for this game are Google Play Billing only (owner
  decision 2026-11-19; no Stripe anywhere). The shell has Play Billing on (Digital
  Goods API). The game keeps its store hidden while `PLAY_BILLING = 'off'` in
  `site/games/kc-open-trail/js/store-config.js`; turning it on is a website change,
  not a new app build (`marketing/kc-open-trail/PLAY-STORE-LAUNCH.md`, Part 2).
- **Billing needs the delegation service.** The tool that writes the project only
  switches that service on together with notifications. `generate.js` switches it
  on by itself, so billing can work without the app asking for notifications.
  The game must not request notification permission in the Play app.
- **The Play Billing library ships Google's own small reporting component**
  (`com.google.android.datatransport`). It is part of Google's library, not
  something this app added, and cannot be removed while billing is on.
- **Store listing icon.** Play wants a 512x512 square with no rounded corners;
  use `site/games/kc-open-trail/icons/maskable-512.png`.
- **Both apps share one website.** The Dewclaw app also answers links to
  `dewclaw-app.netlify.app`, so a phone with both installed may ask which app
  should open a game link.
