-- ============================================================================
-- WordPress / WooCommerce — per-tenant isolation
--
-- BEFORE this migration, WordPress credentials, plugin Basic Auth usernames,
-- and external Woo IDs (Product.wordpressId, Product.woocommerceId,
-- Customer.wordpressId, Order.wordpressId) were globally unique across the
-- whole platform. In a multi-tenant SaaS that meant:
--   - Two tenants couldn't have the same Woo product ID (they will, normally)
--   - One tenant configuring WP settings overwrote the other's
--   - Plugin auth usernames had to be globally unique
--
-- This migration introduces composite (tenant_id, X) uniques and a dedicated
-- per-tenant config table.
-- ============================================================================

-- 1) Drop legacy globally-unique constraints / indexes
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_wordpress_id_key";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_woocommerce_id_key";
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_wordpress_id_key";
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_wordpress_id_key";
ALTER TABLE "wordpress_plugin_auth" DROP CONSTRAINT IF EXISTS "wordpress_plugin_auth_username_key";

-- Some Prisma 5 versions name the auto-generated unique index with a different
-- suffix; drop those too, idempotently.
DROP INDEX IF EXISTS "products_wordpress_id_key";
DROP INDEX IF EXISTS "products_woocommerce_id_key";
DROP INDEX IF EXISTS "customers_wordpress_id_key";
DROP INDEX IF EXISTS "orders_wordpress_id_key";
DROP INDEX IF EXISTS "wordpress_plugin_auth_username_key";

-- 2) Composite (tenant_id, X) unique indexes.
-- NOTE: PostgreSQL default UNIQUE treats NULLs as distinct, so multiple rows
-- with NULL wordpress_id within the same tenant remain allowed (correct: not
-- every product is synced to Woo).
CREATE UNIQUE INDEX "product_tenant_wordpress_unique"
  ON "products"("tenant_id", "wordpress_id");
CREATE UNIQUE INDEX "product_tenant_woocommerce_unique"
  ON "products"("tenant_id", "woocommerce_id");
CREATE UNIQUE INDEX "customer_tenant_wordpress_unique"
  ON "customers"("tenant_id", "wordpress_id");
CREATE UNIQUE INDEX "order_tenant_wordpress_unique"
  ON "orders"("tenant_id", "wordpress_id");
CREATE UNIQUE INDEX "wpauth_tenant_username_unique"
  ON "wordpress_plugin_auth"("tenant_id", "username");

-- 3) New per-tenant config table (replaces global system_settings row).
CREATE TABLE "wordpress_tenant_config" (
  "id"              TEXT NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "url"             TEXT NOT NULL,
  "consumer_key"    TEXT NOT NULL,
  "consumer_secret" TEXT NOT NULL,
  "webhook_secret"  TEXT NOT NULL,
  "sync_enabled"    BOOLEAN NOT NULL DEFAULT false,
  "sync_interval"   INTEGER NOT NULL DEFAULT 300000,
  "last_sync_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wordpress_tenant_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wordpress_tenant_config_tenant_id_key"
  ON "wordpress_tenant_config"("tenant_id");
CREATE INDEX "wordpress_tenant_config_sync_enabled_idx"
  ON "wordpress_tenant_config"("sync_enabled");

ALTER TABLE "wordpress_tenant_config"
  ADD CONSTRAINT "wordpress_tenant_config_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Drop the legacy global config row from system_settings, if present.
-- The new path is `wordpress_tenant_config` keyed by tenant_id.
DELETE FROM "system_settings" WHERE "key" = 'wordpress_config';
