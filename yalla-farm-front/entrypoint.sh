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

prepare_one_c_exchange_dir() {
  dir="${ONE_C_EXCHANGE_DIR:-/data/1c-exchange}"
  mkdir -p "$dir"
  chown -R nextjs:nodejs "$dir"
  chmod -R u+rwX,g+rwX "$dir"
}

if [ "$(id -u)" = "0" ]; then
  prepare_one_c_exchange_dir
  exec su-exec nextjs:nodejs "$@"
fi

exec "$@"
