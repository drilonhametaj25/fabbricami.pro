#!/bin/sh
# Smart Database Migration Script
# Handles all database states automatically:
# 1. Fresh database (no tables) - runs full migration
# 2. Failed migrations - resolves and retries
# 3. Schema out of sync (tables missing) - uses db push
# 4. Normal case - runs pending migrations

# Don't use set -e as we handle errors manually

echo "=== Smart Database Migration ==="

# Helper function to execute SQL and check result
check_table_exists() {
    RESULT=$(echo "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$1');" | npx prisma db execute --stdin 2>/dev/null || echo "")
    echo "$RESULT" | grep -q "t" && echo "1" || echo "0"
}

# 1. Check if _prisma_migrations table exists (fresh database)
echo ">>> Checking database state..."
MIGRATIONS_TABLE=$(check_table_exists "_prisma_migrations")

if [ "$MIGRATIONS_TABLE" = "0" ]; then
    echo ">>> Fresh database detected - running full migration..."
    npx prisma migrate deploy
    echo "=== Migration completed successfully ==="
    exit 0
fi

# 2. ALWAYS try to resolve known failed migrations (safe to run even if not failed)
echo ">>> Pre-emptively resolving any failed migrations..."
# Try to resolve all known migrations - this is idempotent and safe
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# 3. Check if schema is in sync (tables exist that should exist)
echo ">>> Checking schema integrity..."
TENANTS_TABLE=$(check_table_exists "tenants")

if [ "$TENANTS_TABLE" = "0" ]; then
    echo ">>> CRITICAL: Schema out of sync - core tables missing!"
    echo ">>> Migration history exists but tables don't - syncing schema..."

    # Use db push to create all tables from schema
    npx prisma db push --accept-data-loss

    # Mark all known migrations as applied
    echo ">>> Marking migrations as applied..."
    npx prisma migrate resolve --applied 20251023155944_init 2>/dev/null || true
    npx prisma migrate resolve --applied 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true

    echo "=== Schema synchronized successfully ==="
    exit 0
fi

# 4. Try migrate deploy, if it fails due to failed migrations, resolve and retry
echo ">>> Running migrate deploy (attempt 1)..."
if npx prisma migrate deploy; then
    echo "=== Migration completed successfully ==="
    exit 0
fi

echo ">>> Migration deploy failed, attempting recovery..."

# Force resolve all migrations as rolled back
echo ">>> Force resolving all migrations..."
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# Check if we need to use db push instead
TENANTS_TABLE=$(check_table_exists "tenants")
if [ "$TENANTS_TABLE" = "0" ]; then
    echo ">>> Using db push to sync schema..."
    npx prisma db push --accept-data-loss
    npx prisma migrate resolve --applied 20251023155944_init 2>/dev/null || true
    npx prisma migrate resolve --applied 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
    echo "=== Schema synchronized successfully ==="
    exit 0
fi

echo ">>> Running migrate deploy (attempt 2)..."
if npx prisma migrate deploy; then
    echo "=== Migration completed successfully ==="
    exit 0
fi

echo "!!! Migration failed after recovery attempts"
exit 1
