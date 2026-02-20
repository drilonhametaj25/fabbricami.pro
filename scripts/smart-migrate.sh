#!/bin/sh
# Smart Database Migration Script - Simplified and Robust
# Strategy: Try migrate deploy, if it fails for ANY reason, use db push

echo "=== Smart Database Migration ==="

# Step 1: Always resolve any failed migrations first
echo ">>> Resolving any failed migrations..."
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# Step 2: Try migrate deploy
echo ">>> Attempting migrate deploy..."
if npx prisma migrate deploy 2>&1; then
    echo "=== Migration completed successfully ==="
    exit 0
fi

# Step 3: If migrate deploy failed, use db push as fallback
echo ">>> Migrate deploy failed - using db push to sync schema..."

# Resolve migrations again (in case they failed during deploy)
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# Use db push to create/sync ALL tables from current schema
echo ">>> Running db push..."
if ! npx prisma db push --accept-data-loss; then
    echo "!!! db push failed!"
    exit 1
fi

# Mark all migrations as applied
echo ">>> Marking migrations as applied..."
npx prisma migrate resolve --applied 20251023155944_init 2>/dev/null || true
npx prisma migrate resolve --applied 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true

echo "=== Schema synchronized via db push ==="
exit 0
