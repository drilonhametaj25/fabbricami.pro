-- Multi-tenant unique constraints: SKU, codes, numeri documenti diventano composite (tenantId, ...)
-- Questo permette a due tenant diversi di avere lo stesso SKU/codice/numero ordine.

-- ============================================================================
-- DROP existing single-column unique constraints
-- ============================================================================

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_barcode_key";
DROP INDEX IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_barcode_key";

ALTER TABLE "materials" DROP CONSTRAINT IF EXISTS "materials_sku_key";
DROP INDEX IF EXISTS "materials_sku_key";

ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_code_key";
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_tax_id_key";
DROP INDEX IF EXISTS "customers_code_key";
DROP INDEX IF EXISTS "customers_tax_id_key";

ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_code_key";
ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_tax_id_key";
DROP INDEX IF EXISTS "suppliers_code_key";
DROP INDEX IF EXISTS "suppliers_tax_id_key";

ALTER TABLE "warehouses" DROP CONSTRAINT IF EXISTS "warehouses_code_key";
DROP INDEX IF EXISTS "warehouses_code_key";

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_order_number_key";
DROP INDEX IF EXISTS "orders_order_number_key";

ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_order_number_key";
DROP INDEX IF EXISTS "purchase_orders_order_number_key";

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_invoice_number_key";
DROP INDEX IF EXISTS "invoices_invoice_number_key";

ALTER TABLE "supplier_invoices" DROP CONSTRAINT IF EXISTS "supplier_invoices_invoice_number_key";
DROP INDEX IF EXISTS "supplier_invoices_invoice_number_key";

-- ============================================================================
-- CREATE composite unique constraints (tenantId, ...)
-- ============================================================================

CREATE UNIQUE INDEX "product_tenant_sku_unique" ON "products"("tenant_id", "sku");
CREATE UNIQUE INDEX "product_tenant_barcode_unique" ON "products"("tenant_id", "barcode");

CREATE UNIQUE INDEX "material_tenant_sku_unique" ON "materials"("tenant_id", "sku");

CREATE UNIQUE INDEX "customer_tenant_code_unique" ON "customers"("tenant_id", "code");
CREATE UNIQUE INDEX "customer_tenant_taxid_unique" ON "customers"("tenant_id", "tax_id");

CREATE UNIQUE INDEX "supplier_tenant_code_unique" ON "suppliers"("tenant_id", "code");
CREATE UNIQUE INDEX "supplier_tenant_taxid_unique" ON "suppliers"("tenant_id", "tax_id");

CREATE UNIQUE INDEX "warehouse_tenant_code_unique" ON "warehouses"("tenant_id", "code");

CREATE UNIQUE INDEX "order_tenant_number_unique" ON "orders"("tenant_id", "order_number");

CREATE UNIQUE INDEX "purchase_order_tenant_number_unique" ON "purchase_orders"("tenant_id", "order_number");

CREATE UNIQUE INDEX "invoice_tenant_number_unique" ON "invoices"("tenant_id", "invoice_number");

CREATE UNIQUE INDEX "supplier_invoice_tenant_number_unique" ON "supplier_invoices"("tenant_id", "invoice_number");

-- ============================================================================
-- CREATE tenant-scoped indexes for hot query paths
-- ============================================================================

CREATE INDEX IF NOT EXISTS "products_tenant_id_created_at_idx" ON "products"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "materials_tenant_id_created_at_idx" ON "materials"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_created_at_idx" ON "customers"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_created_at_idx" ON "suppliers"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "warehouses_tenant_id_idx" ON "warehouses"("tenant_id");
CREATE INDEX IF NOT EXISTS "orders_tenant_id_order_date_idx" ON "orders"("tenant_id", "order_date");
CREATE INDEX IF NOT EXISTS "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_id_created_at_idx" ON "purchase_orders"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_issue_date_idx" ON "invoices"("tenant_id", "issue_date");
CREATE INDEX IF NOT EXISTS "supplier_invoices_tenant_id_issue_date_idx" ON "supplier_invoices"("tenant_id", "issue_date");
