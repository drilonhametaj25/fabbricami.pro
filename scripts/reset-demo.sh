#!/bin/bash
# Reset Demo Environment
# Eseguito quotidianamente alle 03:00 per resettare i dati demo
#
# Cron: 0 3 * * * /opt/ecommerceerp/scripts/reset-demo.sh >> /var/log/demo-reset.log 2>&1

set -e

echo "=============================================="
echo "DEMO RESET - $(date)"
echo "=============================================="

# Directory del progetto
PROJECT_DIR="/opt/ecommerceerp"
cd "$PROJECT_DIR"

# Esegui il seed script nel container backend
echo "🔄 Resetting demo data..."
docker compose -f docker-compose.prod.yml exec -T backend npx tsx scripts/seed-demo-tenant.ts

echo "✅ Demo reset completed at $(date)"
echo "=============================================="
