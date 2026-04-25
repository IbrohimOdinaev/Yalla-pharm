#!/usr/bin/env bash
# Upload pharmacy avatars to prod MinIO and update pharmacies."IconUrl".
# Run this against PROD with prod env vars set.
#
# Required env vars:
#   PROD_PG_DSN      e.g. postgresql://user:pass@host:5432/db
#   PROD_S3_ENDPOINT e.g. https://minio.yalla-farm.tj
#   PROD_S3_KEY      MinIO access key
#   PROD_S3_SECRET   MinIO secret key
#   PROD_S3_BUCKET   e.g. yalla-farm-medicines
#
# This script is idempotent — re-running will overwrite the same keys but
# leave a fresh `IconUrl` pointing at them. It skips pharmacies whose
# IconUrl is already set unless FORCE=1.

set -euo pipefail

: "${PROD_PG_DSN:?PROD_PG_DSN is required}"
: "${PROD_S3_ENDPOINT:?PROD_S3_ENDPOINT is required}"
: "${PROD_S3_KEY:?PROD_S3_KEY is required}"
: "${PROD_S3_SECRET:?PROD_S3_SECRET is required}"
: "${PROD_S3_BUCKET:?PROD_S3_BUCKET is required}"

DIR="$(cd "$(dirname "$0")" && pwd)"
DATE_PATH="medicines/$(date -u +%Y/%m/%d)"

# pharmacy_id : avatar file
declare -A PHARMS=(
  [2c508c69-7ea1-4213-8dae-7b9d49b70d68]="novafarma.jpg"
  [305d3bb2-20fa-42fd-b751-b21cb9be3548]="oriyonfarma.jpg"
  [4b1ab8a3-6120-43bb-9405-edec146dce4e]="sifatfarma.jpg"
)

# Configure mc once
mc alias set prod "$PROD_S3_ENDPOINT" "$PROD_S3_KEY" "$PROD_S3_SECRET" --api S3v4

for PHID in "${!PHARMS[@]}"; do
  FILE="${PHARMS[$PHID]}"
  [ -f "$DIR/$FILE" ] || { echo "Missing $DIR/$FILE"; exit 1; }

  # Skip if already has icon (unless forced)
  if [ "${FORCE:-0}" != "1" ]; then
    EXISTING=$(psql "$PROD_PG_DSN" -At -c "SELECT \"IconUrl\" FROM pharmacies WHERE id = '$PHID'")
    if [ -n "$EXISTING" ]; then
      echo "Skipping $PHID — IconUrl already set ($EXISTING). Pass FORCE=1 to overwrite."
      continue
    fi
  fi

  KEY="$DATE_PATH/$(uuidgen | tr -d '-' | tr 'A-Z' 'a-z').jpg"
  echo "Uploading $FILE -> $KEY"
  mc cp "$DIR/$FILE" "prod/$PROD_S3_BUCKET/$KEY"

  echo "Updating pharmacy $PHID"
  psql "$PROD_PG_DSN" -c "UPDATE pharmacies SET \"IconUrl\" = '$KEY' WHERE id = '$PHID';"
done

echo "Done. Verifying:"
psql "$PROD_PG_DSN" -c 'SELECT title, "IconUrl" FROM pharmacies ORDER BY title;'
