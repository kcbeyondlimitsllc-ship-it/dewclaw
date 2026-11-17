#!/usr/bin/env bash
# Builds, signs and checks the KC: Open Trail Play app.
#
#   ./build.sh /path/to/kc-open-trail-upload.keystore [output-folder]
#
# Needs: Node 18+, JDK 17 or 21, Gradle 8.11+, the Android SDK (platforms;android-36 and
# build-tools;35.0.0) with ANDROID_HOME set, and `npm install @bubblewrap/core` run once
# in this folder. The keystore password is asked for, or taken from KC_KEYSTORE_PASS.
# Output: <output-folder>/kc-open-trail-<version>-<code>.aab (upload this to Play)
#         <output-folder>/kc-open-trail-<version>-<code>-test.apk (install on a phone to test)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
KEYSTORE="${1:?usage: ./build.sh /path/to/kc-open-trail-upload.keystore [output-folder]}"
KEYSTORE="$(cd "$(dirname "$KEYSTORE")" && pwd)/$(basename "$KEYSTORE")"
OUT="${2:-$HERE/project-out}"; mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
PROJECT="${KC_PROJECT_DIR:-$HERE/project}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK folder}"
BT="$ANDROID_HOME/build-tools/${KC_BUILD_TOOLS:-35.0.0}"
[ -x "$BT/apksigner" ] || { echo "missing $BT (install build-tools;35.0.0)"; exit 1; }
[ -f "$KEYSTORE" ] || { echo "no keystore at $KEYSTORE"; exit 1; }
if [ -z "${KC_KEYSTORE_PASS:-}" ]; then read -r -s -p "Keystore password: " KC_KEYSTORE_PASS; echo; fi
export KC_KEYSTORE_PASS

ALIAS="$(node -p "require('$HERE/twa-manifest.json').signingKey.alias")"
VERSION="$(node -p "require('$HERE/twa-manifest.json').appVersionName")"
CODE="$(node -p "require('$HERE/twa-manifest.json').appVersionCode")"
PACKAGE="$(node -p "require('$HERE/twa-manifest.json').packageId")"
NAME="kc-open-trail-$VERSION-$CODE"

echo "== 1/4 writing the Android project ($PACKAGE $VERSION, code $CODE)"
rm -rf "$PROJECT"
node "$HERE/generate.js" "$KEYSTORE" "$PROJECT"

echo "== 2/4 building (the first run downloads libraries and takes a few minutes)"
(cd "$PROJECT" && "${GRADLE:-gradle}" --no-daemon -q bundleRelease assembleRelease)

echo "== 3/4 signing"
cp "$PROJECT/app/build/outputs/bundle/release/app-release.aab" "$OUT/$NAME.aab"
jarsigner -keystore "$KEYSTORE" -storepass:env KC_KEYSTORE_PASS -sigalg SHA256withRSA -digestalg SHA-256 \
  "$OUT/$NAME.aab" "$ALIAS" > /dev/null
"$BT/zipalign" -f -p 4 "$PROJECT/app/build/outputs/apk/release/app-release-unsigned.apk" "$OUT/$NAME-test.apk"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --ks-pass env:KC_KEYSTORE_PASS \
  --key-pass env:KC_KEYSTORE_PASS "$OUT/$NAME-test.apk"
rm -f "$OUT/$NAME-test.apk.idsig"

echo "== 4/4 checking"
jarsigner -verify "$OUT/$NAME.aab" | grep -q "jar verified" || { echo "AAB signature did not verify"; exit 1; }
"$BT/apksigner" verify --print-certs "$OUT/$NAME-test.apk" | grep "SHA-256"
BADGING="$("$BT/aapt2" dump badging "$OUT/$NAME-test.apk")"
echo "$BADGING" | grep -E "^package:|^sdkVersion|^targetSdkVersion|^launchable-activity|^uses-permission"
echo "$BADGING" | grep -q "name='$PACKAGE' versionCode='$CODE' versionName='$VERSION'" || { echo "package or version is wrong"; exit 1; }
echo "$BADGING" | grep -q "com.android.vending.BILLING" || { echo "Play Billing permission is missing"; exit 1; }
echo "Upload key SHA-256 (must be in site/.well-known/assetlinks.json):"
keytool -list -v -keystore "$KEYSTORE" -storepass:env KC_KEYSTORE_PASS -alias "$ALIAS" 2>/dev/null | grep "SHA256:"
echo "Done:"; ls -l "$OUT/$NAME.aab" "$OUT/$NAME-test.apk"
