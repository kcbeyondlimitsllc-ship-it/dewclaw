# Dewclaw for Android (Google Play)

The Play app is a Trusted Web Activity: a thin Android shell that opens
`https://dewclaw-app.netlify.app` full screen. This folder is the recipe; the
generated Android project and the signing key are not in the repo.

- Package: `com.kcbeyondlimits.dewclaw`
- Targets Android 16 (API 36), minimum Android 7.0 (API 24)
- Play Billing and location delegation are on (`twa-manifest.json`, `features`)

## Build a new version

Needs Node 18+, JDK 17 or 21, Gradle 8.9+, and the Android SDK
(`platforms;android-36`, `build-tools;35.0.0`) with `ANDROID_HOME` set.

```
npm install @bubblewrap/core
node generate.js /path/to/dewclaw-upload.keystore   # writes ./project
cd project
sed -i 's/jcenter()/mavenCentral()/g' build.gradle app/build.gradle   # jcenter is gone
echo "sdk.dir=$ANDROID_HOME" > local.properties
gradle bundleRelease
jarsigner -keystore /path/to/dewclaw-upload.keystore -sigalg SHA256withRSA -digestalg SHA-256 \
  app/build/outputs/bundle/release/app-release.aab dewclaw
```

Before each new upload raise `appVersionCode` (1, 2, 3 …) and `appVersionName`
in `generate.js`. Google Play rejects a bundle whose version code it has seen.

## The signing key

`dewclaw-upload.keystore` is the **upload key**. Every future update must be
signed with it. Keep the file and its passwords somewhere safe and backed up,
outside this repo. If it is lost, Google can reset the upload key from Play
Console, but that takes a support request and a couple of days.

Its SHA-256 fingerprint is in `site/.well-known/assetlinks.json`. Google Play
re-signs the app with its own **app signing key**; that key's SHA-256
fingerprint (Play Console) must be added to the same file, or the app opens
with a browser address bar.
