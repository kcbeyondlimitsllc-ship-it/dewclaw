#!/usr/bin/env bash
# Builds, signs and checks this folder's Play app (a Trusted Web Activity).
# The same script sits in every app folder under android/; it works out the app from
# the folder it is in and from twa-manifest.json beside it.
#
#   ./build.sh /path/to/upload.keystore [output-folder]
#
# Needs: Node 18+, JDK 17 or 21, the Android SDK (platforms;android-36 and
# build-tools;35.0.0) with ANDROID_HOME set, and `npm ci` run once in android/.
# Gradle comes from the project's own wrapper (8.11.1, downloaded on first use);
# set GRADLE=gradle to use an installed Gradle 8.11+ instead (not Gradle 9).
#
# Environment (all optional):
#   KC_KEYSTORE_PASS   keystore password (asked for when not set)
#   KC_KEY_PASS        key password (default: the keystore password)
#   KC_KEY_ALIAS       key alias (default: signingKey.alias in twa-manifest.json)
#   KC_VERSION_CODE    versionCode (default: appVersionCode in twa-manifest.json)
#   KC_VERSION_NAME    versionName (default: appVersionName in twa-manifest.json)
#   KC_EXPECT_SHA256   fail unless the bundle is signed by the key with this SHA-256
#   BUNDLETOOL         bundletool-all jar (default: downloaded once to ~/.cache, checksum checked)
#
# Output: <output-folder>/<app>-<version>-<code>.aab       (upload this to Play)
#         <output-folder>/<app>-<version>-<code>-test.apk  (install on a phone to test)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(basename "$HERE")"
ROOT="$(cd "$HERE/../.." && pwd)"
KEYSTORE="${1:?usage: ./build.sh /path/to/upload.keystore [output-folder]}"
KEYSTORE="$(cd "$(dirname "$KEYSTORE")" && pwd)/$(basename "$KEYSTORE")"
OUT="${2:-$HERE/project-out}"; mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
PROJECT="${KC_PROJECT_DIR:-$HERE/project}"
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK folder}"
BT="$ANDROID_HOME/build-tools/${KC_BUILD_TOOLS:-35.0.0}"
[ -x "$BT/apksigner" ] || { echo "missing $BT (install build-tools;35.0.0)"; exit 1; }
[ -f "$KEYSTORE" ] || { echo "no keystore at $KEYSTORE"; exit 1; }
if [ -z "${KC_KEYSTORE_PASS:-}" ]; then read -r -s -p "Keystore password: " KC_KEYSTORE_PASS; echo; fi
export KC_KEYSTORE_PASS
export KC_KEY_PASS="${KC_KEY_PASS:-$KC_KEYSTORE_PASS}"

BUNDLETOOL_VERSION=1.18.1
BUNDLETOOL_SHA256=675786493983787ffa11550bdb7c0715679a44e1643f3ff980a529e9c822595c
if [ -z "${BUNDLETOOL:-}" ]; then
  BUNDLETOOL="${XDG_CACHE_HOME:-$HOME/.cache}/kc-android/bundletool-all-$BUNDLETOOL_VERSION.jar"
  if [ ! -f "$BUNDLETOOL" ]; then
    mkdir -p "$(dirname "$BUNDLETOOL")"
    curl -fsSL -o "$BUNDLETOOL.part" \
      "https://github.com/google/bundletool/releases/download/$BUNDLETOOL_VERSION/bundletool-all-$BUNDLETOOL_VERSION.jar"
    echo "$BUNDLETOOL_SHA256  $BUNDLETOOL.part" | sha256sum -c --quiet - || { rm -f "$BUNDLETOOL.part"; echo "bundletool checksum mismatch"; exit 1; }
    mv "$BUNDLETOOL.part" "$BUNDLETOOL"
  fi
fi
export BUNDLETOOL

manifest() { node -p "require('$HERE/twa-manifest.json')$1"; }
ALIAS="${KC_KEY_ALIAS:-$(manifest .signingKey.alias)}"
VERSION="${KC_VERSION_NAME:-$(manifest .appVersionName)}"
CODE="${KC_VERSION_CODE:-$(manifest .appVersionCode)}"
PACKAGE="$(manifest .packageId)"
export KC_VERSION_CODE="$CODE" KC_VERSION_NAME="$VERSION"
NAME="$APP-$VERSION-$CODE"

echo "== 1/4 writing the Android project ($PACKAGE $VERSION, code $CODE)"
rm -rf "$PROJECT"
node "$HERE/generate.js" "$KEYSTORE" "$PROJECT"

echo "== 2/4 building (the first run downloads Gradle and libraries and takes a few minutes)"
(cd "$PROJECT" && ${GRADLE:-./gradlew} --no-daemon -q bundleRelease assembleRelease)

echo "== 3/4 signing"
cp "$PROJECT/app/build/outputs/bundle/release/app-release.aab" "$OUT/$NAME.aab"
jarsigner -keystore "$KEYSTORE" -storepass:env KC_KEYSTORE_PASS -keypass:env KC_KEY_PASS \
  -sigalg SHA256withRSA -digestalg SHA-256 "$OUT/$NAME.aab" "$ALIAS" > /dev/null
"$BT/zipalign" -f -p 4 "$PROJECT/app/build/outputs/apk/release/app-release-unsigned.apk" "$OUT/$NAME-test.apk"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" --ks-pass env:KC_KEYSTORE_PASS \
  --key-pass env:KC_KEY_PASS "$OUT/$NAME-test.apk"
rm -f "$OUT/$NAME-test.apk.idsig"

echo "== 4/4 checking"
# The bundle (what Play gets): package, version, target SDK 36, billing + DelegationService,
# no notification / location / advertising-ID permission it should not have, signature.
node "$ROOT/tools/android/check-aab.mjs" "$OUT/$NAME.aab" "$HERE/twa-manifest.json" \
  ${KC_EXPECT_SHA256:+--expect-sha256 "$KC_EXPECT_SHA256"}
# The test APK: same package, version and target SDK.
"$BT/apksigner" verify --print-certs "$OUT/$NAME-test.apk" | grep "SHA-256"
BADGING="$("$BT/aapt2" dump badging "$OUT/$NAME-test.apk")"
echo "$BADGING" | grep -E "^package:|^sdkVersion|^targetSdkVersion|^uses-permission"
echo "$BADGING" | grep -q "name='$PACKAGE' versionCode='$CODE' versionName='$VERSION'" || { echo "test APK: package or version is wrong"; exit 1; }
echo "$BADGING" | grep -q "^targetSdkVersion:'36'" || { echo "test APK: targetSdkVersion is not 36"; exit 1; }
echo "Upload key SHA-256 (must be in site/.well-known/assetlinks.json):"
keytool -list -v -keystore "$KEYSTORE" -storepass:env KC_KEYSTORE_PASS -alias "$ALIAS" 2>/dev/null | grep "SHA256:"
echo "Done:"; ls -l "$OUT/$NAME.aab" "$OUT/$NAME-test.apk"
