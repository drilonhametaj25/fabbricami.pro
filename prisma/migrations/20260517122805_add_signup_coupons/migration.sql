-- CreateEnum
CREATE TYPE "SignupCouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_TRIAL_DAYS');

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_fkey";

-- DropIndex
DROP INDEX "payment_dues_due_date_status_idx";

-- DropIndex
DROP INDEX "payment_dues_dunning_level_idx";

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "signup_coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "type" "SignupCouponType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "applicable_plans" JSONB,
    "applicable_billing_cycles" JSONB,
    "duration_months" INTEGER,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "max_uses_per_tenant" INTEGER DEFAULT 1,
    "stripe_coupon_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signup_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_coupon_usages" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "signup_coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signup_coupons_code_key" ON "signup_coupons"("code");

-- CreateIndex
CREATE INDEX "signup_coupons_code_idx" ON "signup_coupons"("code");

-- CreateIndex
CREATE INDEX "signup_coupons_is_active_valid_from_valid_to_idx" ON "signup_coupons"("is_active", "valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "signup_coupon_usages_tenant_id_idx" ON "signup_coupon_usages"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "signup_coupon_usages_coupon_id_tenant_id_key" ON "signup_coupon_usages"("coupon_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_coupon_usages" ADD CONSTRAINT "signup_coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "signup_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "customer_tenant_code_unique" RENAME TO "customers_tenant_id_code_key";

-- RenameIndex
ALTER INDEX "customer_tenant_taxid_unique" RENAME TO "customers_tenant_id_tax_id_key";

-- RenameIndex
ALTER INDEX "invoice_tenant_number_unique" RENAME TO "invoices_tenant_id_invoice_number_key";

-- RenameIndex
ALTER INDEX "material_tenant_sku_unique" RENAME TO "materials_tenant_id_sku_key";

-- RenameIndex
ALTER INDEX "order_tenant_number_unique" RENAME TO "orders_tenant_id_order_number_key";

-- RenameIndex
ALTER INDEX "product_tenant_barcode_unique" RENAME TO "products_tenant_id_barcode_key";

-- RenameIndex
ALTER INDEX "product_tenant_sku_unique" RENAME TO "products_tenant_id_sku_key";

-- RenameIndex
ALTER INDEX "purchase_order_tenant_number_unique" RENAME TO "purchase_orders_tenant_id_order_number_key";

-- RenameIndex
ALTER INDEX "supplier_invoice_tenant_number_unique" RENAME TO "supplier_invoices_tenant_id_invoice_number_key";

-- RenameIndex
ALTER INDEX "supplier_tenant_code_unique" RENAME TO "suppliers_tenant_id_code_key";

-- RenameIndex
ALTER INDEX "supplier_tenant_taxid_unique" RENAME TO "suppliers_tenant_id_tax_id_key";

-- RenameIndex
ALTER INDEX "warehouse_tenant_code_unique" RENAME TO "warehouses_tenant_id_code_key";
