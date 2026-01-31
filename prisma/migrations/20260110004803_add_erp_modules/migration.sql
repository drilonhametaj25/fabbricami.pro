-- CreateEnum
CREATE TYPE "PurchaseOrderType" AS ENUM ('MATERIAL', 'FINISHED_PRODUCT', 'MIXED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'PARTIAL_DELIVERY');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PASSED', 'FAILED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "B2BPaymentMethod" AS ENUM ('BONIFICO', 'RIBA', 'CONTANTI', 'FIDO', 'ASSEGNO', 'CARTA', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentDueType" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "PaymentDueStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_product_id_fkey";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "default_payment_method" "B2BPaymentMethod",
ADD COLUMN     "payment_plan_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "b2b_payment_due_date" TIMESTAMP(3),
ADD COLUMN     "b2b_payment_method" "B2BPaymentMethod",
ADD COLUMN     "b2b_payment_terms" INTEGER;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "allocated_to_orders" JSONB,
ADD COLUMN     "last_purchase_price" DECIMAL(10,4),
ADD COLUMN     "material_id" TEXT,
ADD COLUMN     "price_variance" DECIMAL(10,4),
ADD COLUMN     "quality_notes" TEXT,
ADD COLUMN     "quality_status" "QualityStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "product_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "actual_delivery_date" TIMESTAMP(3),
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "delivery_notes" TEXT,
ADD COLUMN     "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "estimated_delivery_date" TIMESTAMP(3),
ADD COLUMN     "order_type" "PurchaseOrderType" NOT NULL DEFAULT 'MATERIAL',
ADD COLUMN     "related_order_ids" JSONB,
ADD COLUMN     "shipped_date" TIMESTAMP(3),
ADD COLUMN     "tracking_number" TEXT,
ADD COLUMN     "tracking_url" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "avg_delivery_days" INTEGER,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "default_lead_time_days" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "defective_deliveries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "late_deliveries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "on_time_delivery_rate" DECIMAL(5,2),
ADD COLUMN     "payment_plan_id" TEXT,
ADD COLUMN     "quality_rating" DECIMAL(3,2),
ADD COLUMN     "swift" TEXT,
ADD COLUMN     "total_deliveries" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plan_installments" (
    "id" TEXT NOT NULL,
    "payment_plan_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "days_from_invoice" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_plan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_dues" (
    "id" TEXT NOT NULL,
    "type" "PaymentDueType" NOT NULL,
    "status" "PaymentDueStatus" NOT NULL DEFAULT 'PENDING',
    "invoice_id" TEXT,
    "supplier_invoice_id" TEXT,
    "order_id" TEXT,
    "customer_id" TEXT,
    "supplier_id" TEXT,
    "description" TEXT NOT NULL,
    "installment_number" INTEGER,
    "total_installments" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "payment_method" "B2BPaymentMethod",
    "bank_reference" TEXT,
    "riba_reference" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_dues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_due_payments" (
    "id" TEXT NOT NULL,
    "payment_due_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "method" "B2BPaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_due_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_items" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT,
    "material_id" TEXT,
    "supplier_sku" TEXT,
    "last_purchase_price" DECIMAL(10,4) NOT NULL,
    "avg_purchase_price" DECIMAL(10,4),
    "min_order_quantity" INTEGER NOT NULL DEFAULT 1,
    "packaging_unit" INTEGER NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "last_purchase_date" TIMESTAMP(3),
    "total_purchased" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_volume_discounts" (
    "id" TEXT NOT NULL,
    "supplier_item_id" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "fixed_price" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_volume_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document_date" TIMESTAMP(3),
    "supplier_doc_number" TEXT,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "delivery_note" TEXT,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "inspection_required" BOOLEAN NOT NULL DEFAULT false,
    "inspection_status" "InspectionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "inspection_date" TIMESTAMP(3),
    "inspection_notes" TEXT,
    "inspected_by" TEXT,
    "attachments" JSONB,
    "received_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT NOT NULL,
    "product_id" TEXT,
    "material_id" TEXT,
    "expected_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL,
    "accepted_quantity" INTEGER NOT NULL,
    "rejected_quantity" INTEGER NOT NULL DEFAULT 0,
    "quality_status" "QualityStatus" NOT NULL DEFAULT 'PENDING',
    "quality_notes" TEXT,
    "lot_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "storage_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_notes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_visible_to_customer" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "wc_note_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_refunds" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "wc_refund_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "restock_items" BOOLEAN NOT NULL DEFAULT true,
    "processed_at" TIMESTAMP(3),
    "processed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_refund_items" (
    "id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "order_refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_plans_code_key" ON "payment_plans"("code");

-- CreateIndex
CREATE INDEX "payment_plan_installments_payment_plan_id_idx" ON "payment_plan_installments"("payment_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_plan_installments_payment_plan_id_sequence_key" ON "payment_plan_installments"("payment_plan_id", "sequence");

-- CreateIndex
CREATE INDEX "payment_dues_type_idx" ON "payment_dues"("type");

-- CreateIndex
CREATE INDEX "payment_dues_status_idx" ON "payment_dues"("status");

-- CreateIndex
CREATE INDEX "payment_dues_due_date_idx" ON "payment_dues"("due_date");

-- CreateIndex
CREATE INDEX "payment_dues_customer_id_idx" ON "payment_dues"("customer_id");

-- CreateIndex
CREATE INDEX "payment_dues_supplier_id_idx" ON "payment_dues"("supplier_id");

-- CreateIndex
CREATE INDEX "payment_dues_invoice_id_idx" ON "payment_dues"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_due_payments_payment_due_id_idx" ON "payment_due_payments"("payment_due_id");

-- CreateIndex
CREATE INDEX "supplier_items_supplier_id_idx" ON "supplier_items"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_items_product_id_idx" ON "supplier_items"("product_id");

-- CreateIndex
CREATE INDEX "supplier_items_material_id_idx" ON "supplier_items"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_supplier_id_product_id_key" ON "supplier_items"("supplier_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_items_supplier_id_material_id_key" ON "supplier_items"("supplier_id", "material_id");

-- CreateIndex
CREATE INDEX "supplier_volume_discounts_supplier_item_id_idx" ON "supplier_volume_discounts"("supplier_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_volume_discounts_supplier_item_id_min_quantity_key" ON "supplier_volume_discounts"("supplier_item_id", "min_quantity");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_receipt_number_key" ON "goods_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("purchase_order_id");

-- CreateIndex
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts"("supplier_id");

-- CreateIndex
CREATE INDEX "goods_receipts_status_idx" ON "goods_receipts"("status");

-- CreateIndex
CREATE INDEX "goods_receipts_receipt_date_idx" ON "goods_receipts"("receipt_date");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_items_purchase_order_item_id_idx" ON "goods_receipt_items"("purchase_order_item_id");

-- CreateIndex
CREATE INDEX "order_notes_order_id_idx" ON "order_notes"("order_id");

-- CreateIndex
CREATE INDEX "order_refunds_order_id_idx" ON "order_refunds"("order_id");

-- CreateIndex
CREATE INDEX "order_refund_items_refund_id_idx" ON "order_refund_items"("refund_id");

-- CreateIndex
CREATE INDEX "order_refund_items_order_item_id_idx" ON "order_refund_items"("order_item_id");

-- CreateIndex
CREATE INDEX "customers_payment_plan_id_idx" ON "customers"("payment_plan_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_material_id_idx" ON "purchase_order_items"("material_id");

-- CreateIndex
CREATE INDEX "purchase_orders_delivery_status_idx" ON "purchase_orders"("delivery_status");

-- CreateIndex
CREATE INDEX "purchase_orders_order_type_idx" ON "purchase_orders"("order_type");

-- CreateIndex
CREATE INDEX "suppliers_payment_plan_id_idx" ON "suppliers"("payment_plan_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dues" ADD CONSTRAINT "payment_dues_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dues" ADD CONSTRAINT "payment_dues_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dues" ADD CONSTRAINT "payment_dues_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dues" ADD CONSTRAINT "payment_dues_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dues" ADD CONSTRAINT "payment_dues_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_due_payments" ADD CONSTRAINT "payment_due_payments_payment_due_id_fkey" FOREIGN KEY ("payment_due_id") REFERENCES "payment_dues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_volume_discounts" ADD CONSTRAINT "supplier_volume_discounts_supplier_item_id_fkey" FOREIGN KEY ("supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refund_items" ADD CONSTRAINT "order_refund_items_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "order_refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refund_items" ADD CONSTRAINT "order_refund_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

