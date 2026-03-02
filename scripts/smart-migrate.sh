#!/bin/sh
# Smart Database Migration Script - Simplified and Robust
# Strategy: Try migrate deploy, if it fails for ANY reason, use db push

set -e

echo "=== Smart Database Migration ==="
echo ">>> Started at $(date)"

# Limit Node.js memory to prevent OOM kills in constrained containers
export NODE_OPTIONS="--max-old-space-size=256"

# Step 1: Quick check - see if we can connect to the database
echo ">>> Testing database connection..."
if ! npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; then
    echo "!!! Cannot connect to database - waiting 5s and retrying..."
    sleep 5
    if ! npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; then
        echo "!!! Database still not available - exiting"
        exit 1
    fi
fi
echo ">>> Database connection OK"

# Step 2: Check migration status
echo ">>> Checking migration status..."
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)

if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
    echo "=== Database already up to date - skipping migration ==="
    exit 0
fi

# Step 3: Resolve any failed migrations
echo ">>> Resolving any failed migrations..."
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# Step 4: Try migrate deploy
echo ">>> Attempting migrate deploy..."
if npx prisma migrate deploy 2>&1; then
    echo "=== Migration completed successfully ==="
    echo ">>> Finished at $(date)"
    exit 0
fi

# Step 5: If migrate deploy failed, use db push as fallback
echo ">>> Migrate deploy failed - using db push to sync schema..."

# Resolve migrations again (in case they failed during deploy)
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# Use db push to create/sync ALL tables from current schema
echo ">>> Running db push..."
if ! npx prisma db push --accept-data-loss 2>&1; then
    echo "!!! db push failed!"
    echo ">>> Finished at $(date)"
    exit 1
fi

# Mark all migrations as applied
echo ">>> Marking migrations as applied..."
npx prisma migrate resolve --applied 20251023155944_init 2>/dev/null || true
npx prisma migrate resolve --applied 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true

echo "=== Schema synchronized via db push ==="
echo ">>> Finished at $(date)"
exit 0
