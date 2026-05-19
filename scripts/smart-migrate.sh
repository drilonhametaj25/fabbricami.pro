#!/bin/sh
# Smart Database Migration Script - Simplified and Robust
# Strategy:
#   1. Ensure the target database exists (idempotent CREATE on admin DB).
#   2. Try `prisma migrate deploy`; if it fails for ANY reason, fall back to `db push`.
#
# Compatibility: must run on Alpine's BusyBox /bin/sh (no bashisms — no `<<<`,
# no `[[ ]]`, no `&>`, no `mapfile`, etc.).

set -e

echo "=== Smart Database Migration ==="
echo ">>> Started at $(date)"

# Limit Node.js memory to prevent OOM kills in constrained containers
export NODE_OPTIONS="--max-old-space-size=256"

# ---------------------------------------------------------------------------
# Step 0: Ensure the target DB exists.
#
# Background: when the Postgres volume is reused across compose runs the
# POSTGRES_DB env var is ignored, so a rename of the DB in docker-compose
# leaves the new DB uncreated. This step is idempotent: it connects to the
# admin `postgres` DB and tries CREATE DATABASE, swallowing the "already
# exists" error (PostgreSQL has no `CREATE DATABASE IF NOT EXISTS`).
# ---------------------------------------------------------------------------
echo ">>> Ensuring target database exists..."

# Extract DB name and build an admin connection URL (same host/credentials,
# but pointing at the default `postgres` DB).
DB_NAME=$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(decodeURIComponent(u.pathname.replace(/^\//, "").split("?")[0]))' 2>/dev/null || echo "")
ADMIN_URL=$(node -e 'const u=new URL(process.env.DATABASE_URL); u.pathname="/postgres"; u.search=""; console.log(u.toString())' 2>/dev/null || echo "")

if [ -n "$DB_NAME" ] && [ -n "$ADMIN_URL" ]; then
    echo "    target database: $DB_NAME"
    # Use printf instead of `<<<` (which is bash-only and breaks on Alpine sh)
    if printf 'CREATE DATABASE "%s";\n' "$DB_NAME" | npx prisma db execute --stdin --url "$ADMIN_URL" >/dev/null 2>&1; then
        echo ">>> Database \"$DB_NAME\" created"
    else
        echo ">>> Database \"$DB_NAME\" already exists (or could not be created) — continuing"
    fi
else
    echo ">>> Could not parse DATABASE_URL; skipping database auto-create"
fi

# ---------------------------------------------------------------------------
# Step 1: Quick check - see if we can connect to the database
# ---------------------------------------------------------------------------
echo ">>> Testing database connection..."
if ! printf 'SELECT 1;\n' | npx prisma db execute --stdin >/dev/null 2>&1; then
    echo "!!! Cannot connect to database - waiting 5s and retrying..."
    sleep 5
    if ! printf 'SELECT 1;\n' | npx prisma db execute --stdin >/dev/null 2>&1; then
        echo "!!! Database still not available - exiting"
        exit 1
    fi
fi
echo ">>> Database connection OK"

# ---------------------------------------------------------------------------
# Step 2: Check migration status
# ---------------------------------------------------------------------------
echo ">>> Checking migration status..."
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)

if echo "$MIGRATION_STATUS" | grep -q "Database schema is up to date"; then
    echo "=== Database already up to date - skipping migration ==="
    exit 0
fi

# ---------------------------------------------------------------------------
# Step 3: Resolve any failed migrations
# ---------------------------------------------------------------------------
echo ">>> Resolving any failed migrations..."
npx prisma migrate resolve --rolled-back 20260219174340_add_superadmin_and_expired_status 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20251023155944_init 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 4: Try migrate deploy
# ---------------------------------------------------------------------------
echo ">>> Attempting migrate deploy..."
if npx prisma migrate deploy 2>&1; then
    echo "=== Migration completed successfully ==="
    echo ">>> Finished at $(date)"
    exit 0
fi

# ---------------------------------------------------------------------------
# Step 5: If migrate deploy failed, use db push as fallback
# ---------------------------------------------------------------------------
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
