#!/bin/sh
set -e

require_public_env() {
  key="$1"
  value="$(printenv "$key" || true)"
  if [ -z "$value" ]; then
    echo "Missing required runtime env: $key" >&2
    exit 1
  fi
}

if [ "$NODE_ENV" = "production" ]; then
  require_public_env NEXT_PUBLIC_YANDEX_MAPS_API_KEY
fi

exec "$@"
