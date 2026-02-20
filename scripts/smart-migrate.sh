#!/bin/sh
# Smart Database Migration Script
# Handles all database states automatically:
# 1. Fresh database (no tables) - runs full migration
# 2. Failed migrations - resolves and retries
# 3. Schema out of sync (tables missing) - uses db push
# 4. Normal case - runs pending migrations

set -e

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

# 2. Check for failed migrations and resolve them
echo ">>> Checking for failed migrations..."
FAILED=$(echo "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL;" | npx prisma db execute --stdin 2>/dev/null || echo "")

if echo "$FAILED" | grep -q "20"; then
    echo ">>> Found failed migrations, resolving..."
    # Extract migration names and resolve each
    echo "$FAILED" | grep "20" | while read -r migration; do
        migration=$(echo "$migration" | tr -d ' |')
        if [ -n "$migration" ]; then
            echo ">>> Resolving failed: $migration"
            npx prisma migrate resolve --rolled-back "$migration" 2>/dev/null || true
        fi
    done
fi

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

# 4. Normal case - run pending migrations
echo ">>> Running migrate deploy..."
npx prisma migrate deploy

echo "=== Migration completed successfully ==="
