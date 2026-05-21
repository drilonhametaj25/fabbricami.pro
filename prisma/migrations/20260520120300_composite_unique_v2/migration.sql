-- ============================================================================
-- COMPOSITE UNIQUE v2 — UNIQUE constraint mancanti dalla precedente migration
-- ============================================================================
--
-- La migration 20260506110300 ha già fatto compositi: products(sku,barcode),
-- materials(sku), customers(code,taxId), suppliers(code,taxId), warehouses(code),
-- orders/purchase_orders/invoices/supplier_invoices(orderNumber/invoiceNumber).
--
-- Rimanevano globali (collisioni cross-tenant + IDOR):
--   * users.email
--   * coupons.code
--   * product_variants.sku / barcode  (richiede tenant_id added in 20260520120200)
--   * ddt.ddt_number
--   * rmas.rma_number
--   * production_orders.order_number
--   * woocommerce_attributes.slug / woocommerce_id
--   * woocommerce_tags.slug

-- ----------------------------------------------------------------------------
-- Pre-check: errore esplicito se ci sono duplicati che bloccherebbero la migration
-- ----------------------------------------------------------------------------
DO $check$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT email FROM users
    GROUP BY email
    HAVING COUNT(DISTINCT tenant_id) > 1
  ) x;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Migration aborted: % email user condivise tra più tenant. Rinominare prima di applicare composite unique.', dup_count;
  END IF;
END
$check$;

-- ============================================================================
-- DROP existing single-column UNIQUE
-- ============================================================================
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_email_key";

ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_code_key";
DROP INDEX IF EXISTS "coupons_code_key";

ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_sku_key";
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_barcode_key";
DROP INDEX IF EXISTS "product_variants_sku_key";
DROP INDEX IF EXISTS "product_variants_barcode_key";

ALTER TABLE "ddt" DROP CONSTRAINT IF EXISTS "ddt_ddt_number_key";
DROP INDEX IF EXISTS "ddt_ddt_number_key";

ALTER TABLE "rmas" DROP CONSTRAINT IF EXISTS "rmas_rma_number_key";
DROP INDEX IF EXISTS "rmas_rma_number_key";

ALTER TABLE "production_orders" DROP CONSTRAINT IF EXISTS "production_orders_order_number_key";
DROP INDEX IF EXISTS "production_orders_order_number_key";

ALTER TABLE "woocommerce_attributes" DROP CONSTRAINT IF EXISTS "woocommerce_attributes_slug_key";
ALTER TABLE "woocommerce_attributes" DROP CONSTRAINT IF EXISTS "woocommerce_attributes_woocommerce_id_key";
DROP INDEX IF EXISTS "woocommerce_attributes_slug_key";
DROP INDEX IF EXISTS "woocommerce_attributes_woocommerce_id_key";

ALTER TABLE "woocommerce_tags" DROP CONSTRAINT IF EXISTS "woocommerce_tags_slug_key";
DROP INDEX IF EXISTS "woocommerce_tags_slug_key";

-- ============================================================================
-- CREATE composite UNIQUE indexes (tenant_id, X)
-- ============================================================================
CREATE UNIQUE INDEX "user_tenant_email_unique"
  ON "users"("tenant_id", "email");

CREATE UNIQUE INDEX "coupon_tenant_code_unique"
  ON "coupons"("tenant_id", "code");

CREATE UNIQUE INDEX "product_variant_tenant_sku_unique"
  ON "product_variants"("tenant_id", "sku");
CREATE UNIQUE INDEX "product_variant_tenant_barcode_unique"
  ON "product_variants"("tenant_id", "barcode");

CREATE UNIQUE INDEX "ddt_tenant_number_unique"
  ON "ddt"("tenant_id", "ddt_number");

CREATE UNIQUE INDEX "rma_tenant_number_unique"
  ON "rmas"("tenant_id", "rma_number");

CREATE UNIQUE INDEX "production_order_tenant_number_unique"
  ON "production_orders"("tenant_id", "order_number");

CREATE UNIQUE INDEX "wc_attribute_tenant_slug_unique"
  ON "woocommerce_attributes"("tenant_id", "slug");
CREATE UNIQUE INDEX "wc_attribute_tenant_wcid_unique"
  ON "woocommerce_attributes"("tenant_id", "woocommerce_id");

CREATE UNIQUE INDEX "wc_tag_tenant_slug_unique"
  ON "woocommerce_tags"("tenant_id", "slug");
