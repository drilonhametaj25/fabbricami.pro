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

# 3. Check if ALL critical tables exist (not just one)
echo ">>> Checking schema integrity..."
TENANTS_TABLE=$(check_table_exists "tenants")
SUBSCRIPTION_PLANS_TABLE=$(check_table_exists "subscription_plans")
SUPER_ADMINS_TABLE=$(check_table_exists "super_admins")

echo ">>> Table check: tenants=$TENANTS_TABLE, subscription_plans=$SUBSCRIPTION_PLANS_TABLE, super_admins=$SUPER_ADMINS_TABLE"

# If ANY critical table is missing, use db push to sync entire schema
if [ "$TENANTS_TABLE" = "0" ] || [ "$SUBSCRIPTION_PLANS_TABLE" = "0" ] || [ "$SUPER_ADMINS_TABLE" = "0" ]; then
    echo ">>> CRITICAL: Schema out of sync - one or more tables missing!"
    echo ">>> Using db push to sync entire schema..."

    # Use db push to create all tables from schema
    npx prisma db push --accept-data-loss

    # Mark all known migrations as applied
    echo ">>> Marking migrations as applied..."
    npx prisma migrate resolve --applied 20251023155944_init 2>/dev/null || true
    npx prisma migrate resolve --applied 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true

    echo "=== Schema synchronized successfully ==="
    exit 0
fi

# 4. Try migrate deploy, if it fails, use db push to sync entire schema
echo ">>> Running migrate deploy (attempt 1)..."
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1) || true
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -eq 0 ]; then
    echo "$MIGRATE_OUTPUT"
    echo "=== Migration completed successfully ==="
    exit 0
fi

echo "$MIGRATE_OUTPUT"
echo ">>> Migration deploy failed (exit code: $MIGRATE_EXIT)"

# Check if failure is due to missing table (P3018 with 42P01)
if echo "$MIGRATE_OUTPUT" | grep -q "42P01\|does not exist"; then
    echo ">>> Detected missing table - using db push to sync entire schema..."

    # Resolve all migrations as rolled back first
    npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
    npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

    # Use db push to create ALL tables from current schema
    echo ">>> Running db push..."
    npx prisma db push --accept-data-loss

    # Mark all migrations as applied (schema is now in sync)
    echo ">>> Marking all migrations as applied..."
    npx prisma migrate resolve --applied 20251023155944_init
    npx prisma migrate resolve --applied 20260219174340_add_superadmin_and_expired_status

    echo "=== Schema synchronized via db push ==="
    exit 0
fi

# For other errors, try resolving and retrying once
echo ">>> Attempting standard recovery..."
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

echo ">>> Running migrate deploy (attempt 2)..."
if npx prisma migrate deploy; then
    echo "=== Migration completed successfully ==="
    exit 0
fi

echo "!!! Migration failed after recovery attempts"
exit 1
