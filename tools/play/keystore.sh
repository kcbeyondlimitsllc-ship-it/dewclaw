#!/usr/bin/env bash
# Writes the upload keystore from a GitHub secret to a private file, and removes it again.
#
#   KEYSTORE_B64=... KEYSTORE_PASSWORD=... KEY_ALIAS=... tools/play/keystore.sh decode <file>
#   tools/play/keystore.sh remove <file>
#
# decode: base64-decodes KEYSTORE_B64 into <file> (mode 600) and checks that the password
#         opens it and that KEY_ALIAS is in it. Prints only the alias and the SHA-256
#         fingerprint of the certificate, which are public (they are in assetlinks.json).
# remove: overwrites and deletes <file>. Safe to run when the file is not there.
# Never run this with `set -x`: the values would be printed.
set -euo pipefail
set +x
cmd="${1:-}"; file="${2:-}"
[ -n "$file" ] || { echo "usage: keystore.sh decode|remove <file>" >&2; exit 2; }

case "$cmd" in
  decode)
    : "${KEYSTORE_B64:?the keystore secret (…_KEYSTORE_B64) is empty or not set}"
    : "${KEYSTORE_PASSWORD:?the keystore password secret (…_KEYSTORE_PASSWORD) is empty or not set}"
    : "${KEY_ALIAS:?the key alias secret (…_KEY_ALIAS) is empty or not set}"
    umask 077
    mkdir -p "$(dirname "$file")"
    # tolerate line breaks and spaces from copy-paste
    if ! printf '%s' "$KEYSTORE_B64" | tr -d ' \r\n\t' | base64 -d > "$file" 2>/dev/null; then
      rm -f "$file"; echo "the keystore secret is not valid base64" >&2; exit 1
    fi
    [ -s "$file" ] || { rm -f "$file"; echo "the keystore secret decoded to nothing" >&2; exit 1; }
    if ! listing="$(keytool -list -v -keystore "$file" -storepass:env KEYSTORE_PASSWORD -alias "$KEY_ALIAS" 2>&1)"; then
      rm -f "$file"
      echo "keytool could not open the keystore with that password and alias (wrong password, alias, or file)" >&2
      exit 1
    fi
    echo "keystore written; alias $KEY_ALIAS"
    printf '%s\n' "$listing" | grep -E '^\s*SHA256:' | head -1 | sed 's/^\s*/certificate /'
    ;;
  remove)
    if [ -e "$file" ]; then
      if command -v shred > /dev/null; then shred -u "$file"; else rm -f "$file"; fi
    fi
    [ ! -e "$file" ] || { echo "could not delete $file" >&2; exit 1; }
    echo "keystore file removed"
    ;;
  *) echo "usage: keystore.sh decode|remove <file>" >&2; exit 2 ;;
esac
