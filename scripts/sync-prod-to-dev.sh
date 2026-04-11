#!/bin/bash
# ============================================
# Sync PROD → DEV (one-way only)
# Copies database and images from production
# to local development environment
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load prod env
if [ ! -f "$PROJECT_DIR/.env.prod" ]; then
  echo "ERROR: .env.prod not found"
  exit 1
fi
source "$PROJECT_DIR/.env.prod"

# Parse prod DB connection string
PROD_HOST=$(echo "$DB_CONNECTION_STRING" | grep -oP 'Host=\K[^;]+')
PROD_PORT=$(echo "$DB_CONNECTION_STRING" | grep -oP 'Port=\K[^;]+')
PROD_DB=$(echo "$DB_CONNECTION_STRING" | grep -oP 'Database=\K[^;]+')
PROD_USER=$(echo "$DB_CONNECTION_STRING" | grep -oP 'Username=\K[^;]+')
PROD_PASS=$(echo "$DB_CONNECTION_STRING" | grep -oP 'Password=\K[^;]+')

# Local dev settings
DEV_HOST="localhost"
DEV_PORT="5433"
DEV_DB="app_db"
DEV_USER="postgres"
DEV_PASS="postgres"

DUMP_FILE="/tmp/yalla_prod_dump.sql"

echo "=========================================="
echo "  PROD → DEV sync"
echo "=========================================="
echo ""

# ── Step 1: Sync Database ──
echo "[1/2] Syncing database..."
echo "  Dumping from prod ($PROD_HOST/$PROD_DB)..."

PGPASSWORD="$PROD_PASS" pg_dump \
  -h "$PROD_HOST" -p "$PROD_PORT" -U "$PROD_USER" -d "$PROD_DB" \
  --data-only --column-inserts --no-owner --no-privileges \
  --exclude-table='__EFMigrationsHistory' \
  --exclude-table='sms_outbox_messages' \
  --exclude-table='sms_verification_sessions' \
  --exclude-table='telegram_auth_sessions' \
  > "$DUMP_FILE" 2>/dev/null

LINES=$(wc -l < "$DUMP_FILE")
echo "  Dump: $LINES lines"

# Ensure local postgres is running
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d postgres 2>/dev/null
sleep 2

echo "  Clearing local DB..."
PGPASSWORD="$DEV_PASS" psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" -d "$DEV_DB" -q -c "
  SET session_replication_role = 'replica';
  TRUNCATE
    payment_histories, order_positions, payment_intent_positions,
    payment_intents, basket_positions, refund_requests,
    orders, offers, medicine_images, medicine_attributes,
    medicines, categories, delivery_data, checkout_requests,
    users, pharmacies
  CASCADE;
  SET session_replication_role = 'origin';
" 2>/dev/null

echo "  Importing to local DB..."
# Wrap with replica role to bypass FK constraints
{
  echo "SET session_replication_role = 'replica';"
  grep "^INSERT INTO" "$DUMP_FILE"
  echo "SET session_replication_role = 'origin';"
} | PGPASSWORD="$DEV_PASS" psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" -d "$DEV_DB" -q 2>/dev/null

# Verify
COUNTS=$(PGPASSWORD="$DEV_PASS" psql -h "$DEV_HOST" -p "$DEV_PORT" -U "$DEV_USER" -d "$DEV_DB" -t -A -c "
  SELECT 'users=' || (SELECT COUNT(*) FROM users)
    || ' medicines=' || (SELECT COUNT(*) FROM medicines)
    || ' pharmacies=' || (SELECT COUNT(*) FROM pharmacies)
    || ' offers=' || (SELECT COUNT(*) FROM offers)
    || ' images=' || (SELECT COUNT(*) FROM medicine_images);
")
echo "  Done: $COUNTS"

rm -f "$DUMP_FILE"

# ── Step 2: Sync Images (S3 → MinIO) ──
echo ""
echo "[2/2] Syncing images (S3 → local MinIO)..."

# Ensure local minio is running
docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d minio 2>/dev/null
sleep 2

python3 -c "
from minio import Minio

prod = Minio('$MINIO_ENDPOINT',
  access_key='$MINIO_ACCESS_KEY',
  secret_key='$MINIO_SECRET_KEY',
  secure=True)

dev = Minio('localhost:9000',
  access_key='minioadmin',
  secret_key='minioadmin',
  secure=False)

# Ensure local bucket exists
if not dev.bucket_exists('yalla-farm-medicines'):
    dev.make_bucket('yalla-farm-medicines')

# List prod objects
prod_objects = list(prod.list_objects('$MINIO_BUCKET', prefix='medicines/', recursive=True))
print(f'  Prod has {len(prod_objects)} images')

# List local objects for diff
local_keys = set()
for obj in dev.list_objects('yalla-farm-medicines', prefix='medicines/', recursive=True):
    local_keys.add(obj.object_name)
print(f'  Local has {len(local_keys)} images')

# Copy only missing
copied = 0
skipped = 0
errors = 0
for obj in prod_objects:
    if obj.object_name in local_keys:
        skipped += 1
        continue
    try:
        data = prod.get_object('$MINIO_BUCKET', obj.object_name)
        dev.put_object('yalla-farm-medicines', obj.object_name, data, obj.size,
                       content_type=obj.content_type or 'application/octet-stream')
        copied += 1
        if copied % 100 == 0:
            print(f'    {copied} copied...')
    except Exception as e:
        errors += 1
        if errors <= 3:
            print(f'    Error: {obj.object_name}: {e}')

print(f'  Done: {copied} copied, {skipped} skipped (already exists), {errors} errors')
" 2>&1

echo ""
echo "=========================================="
echo "  Sync complete!"
echo "=========================================="
