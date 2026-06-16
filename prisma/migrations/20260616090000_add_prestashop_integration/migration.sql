-- ============================================================================
-- PRESTASHOP INTEGRATION (per-tenant)
--
-- Le modifiche schema PrestaShop (giugno 2026) erano state applicate SOLO via
-- `prisma db push` agli ambienti di sviluppo: nessuna migration era mai stata
-- generata. In produzione `prisma migrate deploy` non aveva quindi nulla da
-- applicare, ma il Prisma Client deployato si aspetta comunque le colonne →
-- runtime error P2022 "The column products.prestashop_id does not exist".
--
-- Questa migration colma il gap. È scritta in modo IDEMPOTENTE (IF NOT EXISTS /
-- guardie su pg_constraint) così da essere un no-op sicuro sugli ambienti che
-- avevano già ricevuto questi oggetti tramite db push (dev, dev2).
-- ============================================================================

-- 1) Enum OrderSource: aggiungi il valore PRESTASHOP (per gli ordini importati).
--    Idempotente via IF NOT EXISTS (PostgreSQL 12+).
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'PRESTASHOP';

-- 2) Identificatori PrestaShop sui modelli esistenti (nullable, per-tenant).
--    Niente unique: non tutti i prodotti/clienti/ordini sono su PrestaShop.
ALTER TABLE "products"  ADD COLUMN IF NOT EXISTS "prestashop_id" INTEGER;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "prestashop_id" INTEGER;
ALTER TABLE "orders"    ADD COLUMN IF NOT EXISTS "prestashop_id" INTEGER;

-- 3) Config PrestaShop per-tenant (analoga a wordpress_tenant_config).
CREATE TABLE IF NOT EXISTS "prestashop_tenant_config" (
  "id"                   TEXT NOT NULL,
  "tenant_id"            TEXT NOT NULL,
  "api_url"              TEXT NOT NULL,
  "api_key"              TEXT NOT NULL,
  "sync_enabled"         BOOLEAN NOT NULL DEFAULT false,
  "sync_interval"        INTEGER NOT NULL DEFAULT 600000,
  "push_products"        BOOLEAN NOT NULL DEFAULT true,
  "push_inventory"       BOOLEAN NOT NULL DEFAULT true,
  "import_orders"        BOOLEAN NOT NULL DEFAULT true,
  "last_sync_at"         TIMESTAMP(3),
  "last_order_import_id" INTEGER,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "prestashop_tenant_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "prestashop_tenant_config_tenant_id_key"
  ON "prestashop_tenant_config"("tenant_id");
CREATE INDEX IF NOT EXISTS "prestashop_tenant_config_sync_enabled_idx"
  ON "prestashop_tenant_config"("sync_enabled");

-- FK verso tenants (ADD CONSTRAINT non supporta IF NOT EXISTS → guardia DO).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prestashop_tenant_config_tenant_id_fkey'
  ) THEN
    ALTER TABLE "prestashop_tenant_config"
      ADD CONSTRAINT "prestashop_tenant_config_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Log sincronizzazione PrestaShop (analogo a wordpress_sync_logs, niente FK).
CREATE TABLE IF NOT EXISTS "prestashop_sync_logs" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "direction"   TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "message"     TEXT,
  "count"       INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "prestashop_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prestashop_sync_logs_tenant_id_idx"
  ON "prestashop_sync_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "prestashop_sync_logs_created_at_idx"
  ON "prestashop_sync_logs"("created_at");

-- 5) Row Level Security — difesa in profondità multi-tenant.
--    Coerente con la migration 20260520120400_enable_rls:
--      - prestashop_sync_logs È tenant-scoped (vedi TENANT_SCOPED_MODELS) → RLS ON
--      - prestashop_tenant_config NON va sotto RLS (letta da job/middleware senza
--        tenant context, esattamente come wordpress_tenant_config).
ALTER TABLE "prestashop_sync_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prestashop_sync_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "prestashop_sync_logs";
CREATE POLICY tenant_isolation ON "prestashop_sync_logs"
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
