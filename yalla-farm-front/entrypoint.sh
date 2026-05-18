#!/bin/sh
set -e

json_escape() {
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/"/\\"/g' \
    -e 's/\r/\\r/g'
}

runtime_config="/app/public/runtime-env.js"
{
  echo 'window.__YALLA_PHARM_RUNTIME_CONFIG__ = {'
  first=1
  for key in \
    NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SIGNALR_UPDATES_HUB_URL \
    NEXT_PUBLIC_SIGNALR_TELEGRAM_AUTH_HUB_URL \
    NEXT_PUBLIC_YANDEX_MAPS_API_KEY
  do
    value="$(printenv "$key" || true)"
    escaped_value="$(json_escape "$value")"
    if [ "$first" -eq 0 ]; then
      echo ','
    fi
    first=0
    printf '  "%s": "%s"' "$key" "$escaped_value"
  done
  echo
  echo '};'
} > "$runtime_config"

exec "$@"
