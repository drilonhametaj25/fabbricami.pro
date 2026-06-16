-- ============================================================================
-- BILLING ADD-ONS (AddonCatalog globale + TenantAddon per-tenant)
--
-- Come per PrestaShop, queste due tabelle erano state introdotte solo via
-- `prisma db push` in sviluppo, senza una migration: in produzione non esistono
-- e qualunque accesso alla feature add-on fallirebbe con P2022/P2021.
-- Migration idempotente (no-op sicuro dove gli oggetti esistono già).
-- ============================================================================

-- 1) Catalogo add-on (GLOBALE: nessun tenant_id, niente RLS).
CREATE TABLE IF NOT EXISTS "addon_catalog" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "type"          TEXT NOT NULL DEFAULT 'RESOURCE_LIMIT',
  "resource"      TEXT,
  "increment"     INTEGER NOT NULL DEFAULT 0,
  "feature_key"   TEXT,
  "price_monthly" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "price_yearly"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "sort_order"    INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "addon_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "addon_catalog_code_key"
  ON "addon_catalog"("code");

-- 2) Add-on sottoscritti dal tenant (per-tenant, scoped).
CREATE TABLE IF NOT EXISTS "tenant_addons" (
  "id"         TEXT NOT NULL,
  "tenant_id"  TEXT NOT NULL,
  "addon_id"   TEXT NOT NULL,
  "quantity"   INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tenant_addons_tenant_id_idx"
  ON "tenant_addons"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_addons_tenant_id_addon_id_key"
  ON "tenant_addons"("tenant_id", "addon_id");

-- FK verso addon_catalog (guardia DO: ADD CONSTRAINT non ha IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_addons_addon_id_fkey'
  ) THEN
    ALTER TABLE "tenant_addons"
      ADD CONSTRAINT "tenant_addons_addon_id_fkey"
      FOREIGN KEY ("addon_id") REFERENCES "addon_catalog"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) RLS su tenant_addons (modello tenant-scoped, vedi TENANT_SCOPED_MODELS).
--    addon_catalog resta globale (nessuna RLS).
ALTER TABLE "tenant_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_addons" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_addons";
CREATE POLICY tenant_isolation ON "tenant_addons"
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
