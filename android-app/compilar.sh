#!/usr/bin/env bash
# Compila el APK firmado. Lo llama .github/workflows/android.yml. Todo queda en $RUNNER_TEMP/log.txt.
set -euo pipefail
cd "$(dirname "$0")"
echo "== Instalar Capacitor"; npm ci --no-audit --no-fund
echo "== Sincronizar Android"; npx cap sync android
echo "== Llave de firma"
if [ -z "${MF_FIRMA:-}" ]; then echo "ERROR: falta el secreto MF_FIRMA"; exit 1; fi
TODO=$(printf '%s' "$MF_FIRMA" | tr -d ' \r\n\t')
echo "Largo del secreto sin espacios: ${#TODO} (esperado 5796)"
printf '%s' "${TODO:32}" | base64 -d > "$RUNNER_TEMP/mf.jks" || { echo "ERROR: la llave no es base64 válido"; exit 1; }
echo "Llave: $(stat -c %s "$RUNNER_TEMP/mf.jks") bytes (esperado 4322)"
export MF_KEYSTORE="$RUNNER_TEMP/mf.jks" MF_KEYSTORE_PASSWORD="${TODO:0:32}" MF_KEY_PASSWORD="${TODO:0:32}" MF_KEY_ALIAS=misfinanzas
unset MF_FIRMA TODO
echo "== Compilar APK"
cd android && chmod +x gradlew
./gradlew --no-daemon assembleRelease
cp app/build/outputs/apk/release/app-release.apk "$RUNNER_TEMP/mis-finanzas-$MF_VERSION_NAME.apk"
echo "== APK listo: mis-finanzas-$MF_VERSION_NAME.apk"
