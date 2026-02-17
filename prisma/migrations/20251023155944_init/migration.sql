-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'CONTABILE', 'MAGAZZINIERE', 'OPERATORE', 'COMMERCIALE', 'VIEWER');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'WITH_VARIANTS', 'RAW_MATERIAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "IdeationCostType" AS ENUM ('DESIGN', 'RESEARCH', 'TOOLING', 'MARKETING', 'CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryLocation" AS ENUM ('WEB', 'B2B', 'EVENTI', 'TRANSITO');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'PRODUCTION', 'RETURN');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('B2C', 'B2B');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WORDPRESS', 'B2B', 'MANUAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

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
CREATE TYPE "InvoiceType" AS ENUM ('SALE', 'PURCHASE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SdiStatus" AS ENUM ('NOT_SENT', 'PENDING', 'DELIVERED', 'ACCEPTED', 'REJECTED', 'NOT_DELIVERABLE');

-- CreateEnum
CREATE TYPE "FatturapaDocumentType" AS ENUM ('TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD24', 'TD25', 'TD26', 'TD27');

-- CreateEnum
CREATE TYPE "PaymentMethodPA" AS ENUM ('MP01', 'MP02', 'MP03', 'MP04', 'MP05', 'MP06', 'MP07', 'MP08', 'MP09', 'MP10', 'MP11', 'MP12', 'MP13', 'MP14', 'MP15', 'MP16', 'MP17', 'MP18', 'MP19', 'MP20', 'MP21', 'MP22', 'MP23');

-- CreateEnum
CREATE TYPE "ThreeWayMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'DISCREPANCY', 'APPROVED', 'REJECTED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "MatchResolutionStatus" AS ENUM ('PENDING', 'APPROVED', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PRICE_ADJUSTMENT', 'QUANTITY_ADJUSTMENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'PAYPAL', 'OTHER');

-- CreateEnum
CREATE TYPE "B2BPaymentMethod" AS ENUM ('BONIFICO', 'RIBA', 'CONTANTI', 'FIDO', 'ASSEGNO', 'CARTA', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentDueType" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "PaymentDueStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OverheadCategory" AS ENUM ('RENT', 'UTILITIES', 'INSURANCE', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TimeEntryType" AS ENUM ('WORK', 'OVERTIME', 'BREAK');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK', 'REORDER_POINT', 'EXPIRING_SOON', 'TASK_ASSIGNED', 'TASK_OVERDUE', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'ORDER_RECEIVED', 'SYSTEM', 'CALENDAR_EVENT', 'PRODUCTION_PHASE_COMPLETED', 'PRODUCTION_ORDER_COMPLETED', 'MATERIAL_SHORTAGE');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionPhaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RmaStatus" AS ENUM ('REQUESTED', 'PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RmaReason" AS ENUM ('DEFECTIVE', 'WRONG_ITEM', 'DAMAGED_SHIPPING', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'WRONG_SIZE', 'DUPLICATE_ORDER', 'OTHER');

-- CreateEnum
CREATE TYPE "RmaResolution" AS ENUM ('REFUND', 'PARTIAL_REFUND', 'EXCHANGE', 'REPAIR', 'STORE_CREDIT', 'REJECTED');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('FIXED', 'PERCENTAGE', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('ENTIRE_ORDER', 'CATEGORY', 'PRODUCT', 'FIRST_ORDER');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShippingType" AS ENUM ('FLAT_RATE', 'WEIGHT_BASED', 'PRICE_BASED', 'FREE_ABOVE', 'PICKUP');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SPAM');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "LoyaltyTxType" AS ENUM ('EARN', 'REDEEM', 'EXPIRE', 'BONUS', 'ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('REORDER', 'STOCKOUT_ALERT', 'MARGIN_ALERT', 'TREND_UP', 'TREND_DOWN', 'SEASONAL_PEAK', 'BATCH_PRODUCTION', 'ORDER_GROUPING', 'DEAD_STOCK', 'PAYMENT_DUE', 'SUPPLIER_ISSUE');

-- CreateEnum
CREATE TYPE "SuggestionPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTED', 'EXPIRED', 'AUTO_RESOLVED');

-- CreateEnum
CREATE TYPE "PhysicalCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhysicalCountItemStatus" AS ENUM ('NOT_COUNTED', 'COUNTED', 'VERIFIED', 'DISCREPANCY', 'RECONCILED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('CUSTOMERS', 'PRODUCTS', 'ORDERS');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "settings" JSONB,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_yearly" DECIMAL(10,2) NOT NULL,
    "features" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_customer_id" TEXT,
    "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billing_interval" TEXT NOT NULL DEFAULT 'monthly',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_history" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "stripe_invoice_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "invoice_url" TEXT,
    "invoice_pdf_url" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "refresh_token" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verify_token" TEXT,
    "email_verify_token_expires" TIMESTAMP(3),
    "reset_token" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "company_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "vat_number" TEXT NOT NULL,
    "fiscal_code" TEXT,
    "rea_number" TEXT,
    "capital_amount" DECIMAL(12,2),
    "legal_form" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" VARCHAR(2) NOT NULL,
    "postal_code" VARCHAR(5) NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'IT',
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "pec" TEXT,
    "website" TEXT,
    "sdi_code" VARCHAR(7),
    "sdi_pec" TEXT,
    "sdi_provider" TEXT,
    "sdi_provider_api_key" TEXT,
    "sdi_provider_api_secret" TEXT,
    "sdi_provider_endpoint" TEXT,
    "tax_regime" TEXT NOT NULL DEFAULT 'RF01',
    "social_security_type" TEXT,
    "social_security_rate" DECIMAL(5,2),
    "withholding_tax_type" TEXT,
    "withholding_tax_rate" DECIMAL(5,2),
    "logo_url" TEXT,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'FV',
    "invoice_next_number" INTEGER NOT NULL DEFAULT 1,
    "credit_note_prefix" TEXT NOT NULL DEFAULT 'NC',
    "credit_note_next_number" INTEGER NOT NULL DEFAULT 1,
    "ddt_prefix" TEXT NOT NULL DEFAULT 'DDT',
    "ddt_next_number" INTEGER NOT NULL DEFAULT 1,
    "invoice_footer_notes" TEXT,
    "payment_instructions" TEXT,
    "bank_name" TEXT,
    "iban" VARCHAR(34),
    "bic" VARCHAR(11),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "cost" DECIMAL(10,4) NOT NULL,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "reorder_point" INTEGER NOT NULL DEFAULT 0,
    "reorder_quantity" INTEGER NOT NULL DEFAULT 0,
    "lead_time_days" INTEGER NOT NULL DEFAULT 7,
    "supplier_id" TEXT,
    "category" TEXT,
    "is_consumable" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_inventory" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "location" "InventoryLocation" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "lot_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_movements" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "from_location" "InventoryLocation",
    "to_location" "InventoryLocation",
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lot_number" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "performed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'SIMPLE',
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "barcode" TEXT,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "weight" DECIMAL(10,3),
    "dimensions" JSONB,
    "min_stock_level" INTEGER NOT NULL DEFAULT 0,
    "reorder_quantity" INTEGER NOT NULL DEFAULT 0,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sellable" BOOLEAN NOT NULL DEFAULT true,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "max_stock" INTEGER,
    "reorder_point" INTEGER NOT NULL DEFAULT 0,
    "wordpress_id" INTEGER,
    "woocommerce_id" INTEGER,
    "sync_status" TEXT NOT NULL DEFAULT 'NOT_SYNCED',
    "last_sync_at" TIMESTAMP(3),
    "wc_date_created" TIMESTAMP(3),
    "wc_date_modified" TIMESTAMP(3),
    "wc_permalink" TEXT,
    "wc_status" TEXT,
    "wc_featured" BOOLEAN NOT NULL DEFAULT false,
    "wc_catalog_visibility" TEXT NOT NULL DEFAULT 'visible',
    "wc_menu_order" INTEGER NOT NULL DEFAULT 0,
    "wc_sale_price" DECIMAL(10,2),
    "wc_on_sale" BOOLEAN NOT NULL DEFAULT false,
    "wc_date_on_sale_from" TIMESTAMP(3),
    "wc_date_on_sale_to" TIMESTAMP(3),
    "wc_price_html" TEXT,
    "wc_stock_status" TEXT NOT NULL DEFAULT 'instock',
    "wc_backorders" TEXT NOT NULL DEFAULT 'no',
    "wc_backorders_allowed" BOOLEAN NOT NULL DEFAULT false,
    "wc_sold_individually" BOOLEAN NOT NULL DEFAULT false,
    "shipping_class" TEXT,
    "shipping_class_id" TEXT,
    "tax_status" TEXT NOT NULL DEFAULT 'taxable',
    "tax_class" TEXT NOT NULL DEFAULT 'standard',
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 22,
    "wc_purchasable" BOOLEAN NOT NULL DEFAULT true,
    "wc_reviews_allowed" BOOLEAN NOT NULL DEFAULT true,
    "wc_average_rating" DECIMAL(3,2),
    "wc_rating_count" INTEGER NOT NULL DEFAULT 0,
    "wc_total_sales" INTEGER NOT NULL DEFAULT 0,
    "wc_related_ids" JSONB,
    "wc_upsell_ids" JSONB,
    "wc_cross_sell_ids" JSONB,
    "wc_purchase_note" TEXT,
    "wc_external_url" TEXT,
    "wc_button_text" TEXT,
    "wc_parent_id" INTEGER,
    "wc_grouped_products" JSONB,
    "wc_virtual" BOOLEAN NOT NULL DEFAULT false,
    "wc_downloadable" BOOLEAN NOT NULL DEFAULT false,
    "wc_download_limit" INTEGER NOT NULL DEFAULT -1,
    "wc_download_expiry" INTEGER NOT NULL DEFAULT -1,
    "wc_global_unique_id" TEXT,
    "wc_default_attributes" JSONB,
    "wc_tags" JSONB,
    "wc_meta_data" JSONB,
    "main_image_url" TEXT,
    "main_image_id" INTEGER,
    "web_price" DECIMAL(10,2),
    "web_description" TEXT,
    "web_short_description" TEXT,
    "web_active" BOOLEAN NOT NULL DEFAULT false,
    "web_slug" TEXT,
    "web_meta_title" TEXT,
    "web_meta_description" TEXT,
    "web_attributes" JSONB,
    "download_files" JSONB,
    "images" JSONB NOT NULL DEFAULT '[]',
    "supplier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ideation_costs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "IdeationCostType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amortized_units" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_ideation_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "barcode" TEXT,
    "cost_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "weight" DECIMAL(10,3),
    "dimensions" JSONB,
    "woocommerce_variation_id" INTEGER,
    "web_price" DECIMAL(10,2),
    "web_active" BOOLEAN NOT NULL DEFAULT true,
    "main_image_url" TEXT,
    "main_image_id" INTEGER,
    "web_description" TEXT,
    "wc_sale_price" DECIMAL(10,2),
    "wc_on_sale" BOOLEAN NOT NULL DEFAULT false,
    "wc_date_on_sale_from" TIMESTAMP(3),
    "wc_date_on_sale_to" TIMESTAMP(3),
    "wc_stock_status" TEXT NOT NULL DEFAULT 'instock',
    "wc_backorders" TEXT NOT NULL DEFAULT 'no',
    "wc_manage_stock" BOOLEAN NOT NULL DEFAULT false,
    "wc_virtual" BOOLEAN NOT NULL DEFAULT false,
    "wc_downloadable" BOOLEAN NOT NULL DEFAULT false,
    "wc_downloads" JSONB,
    "wc_download_limit" INTEGER NOT NULL DEFAULT -1,
    "wc_download_expiry" INTEGER NOT NULL DEFAULT -1,
    "wc_menu_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "parent_product_id" TEXT NOT NULL,
    "component_product_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "scrap_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_materials" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "material_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "percentage" DECIMAL(5,2),
    "is_main_ingredient" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT,
    "certifications" JSONB,
    "allergens" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_operations" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "operation_name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "standard_time" INTEGER NOT NULL,
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "setup_time" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "woocommerce_id" INTEGER,
    "image" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "wc_display" TEXT NOT NULL DEFAULT 'default',
    "wc_count" INTEGER NOT NULL DEFAULT 0,
    "wc_image_id" INTEGER,
    "sync_status" TEXT NOT NULL DEFAULT 'NOT_SYNCED',
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category_assignments" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_category_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "woocommerce_id" INTEGER,
    "src" TEXT NOT NULL,
    "alt" TEXT,
    "name" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_classes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "woocommerce_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "woocommerce_attributes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "woocommerce_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'select',
    "order_by" TEXT NOT NULL DEFAULT 'menu_order',
    "has_archives" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "woocommerce_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "woocommerce_attribute_terms" (
    "id" TEXT NOT NULL,
    "attribute_id" TEXT NOT NULL,
    "woocommerce_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "menu_order" INTEGER NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "woocommerce_attribute_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "woocommerce_tags" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "woocommerce_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "woocommerce_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "location" "InventoryLocation" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "lot_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "last_count_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "from_location" "InventoryLocation",
    "to_location" "InventoryLocation",
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lot_number" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "performed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "type" "CustomerType" NOT NULL,
    "code" TEXT NOT NULL,
    "business_name" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "fiscal_code" TEXT,
    "sdi_code" TEXT,
    "pec_email" TEXT,
    "password" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "reset_token" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "email_verify_token" TEXT,
    "email_verify_token_expires" TIMESTAMP(3),
    "date_of_birth" TIMESTAMP(3),
    "billing_address" JSONB,
    "shipping_address" JSONB,
    "address" JSONB,
    "payment_terms" INTEGER NOT NULL DEFAULT 30,
    "credit_limit" DECIMAL(10,2),
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "price_list_id" TEXT,
    "payment_plan_id" TEXT,
    "default_payment_method" "B2BPaymentMethod",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "wordpress_id" INTEGER,
    "wc_username" TEXT,
    "wc_avatar_url" TEXT,
    "wc_role" TEXT,
    "wc_date_created" TIMESTAMP(3),
    "wc_date_modified" TIMESTAMP(3),
    "wc_is_paying_customer" BOOLEAN NOT NULL DEFAULT false,
    "wc_orders_count" INTEGER NOT NULL DEFAULT 0,
    "wc_total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wc_meta_data" JSONB,
    "sync_status" TEXT NOT NULL DEFAULT 'NOT_SYNCED',
    "last_sync_at" TIMESTAMP(3),
    "last_order_date" TIMESTAMP(3),
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customer_group" TEXT,
    "acquisition_source" TEXT,
    "tags" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "global_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "fixed_price" DECIMAL(10,2),
    "discount_percent" DECIMAL(5,2),
    "min_quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_discounts" (
    "id" TEXT NOT NULL,
    "price_list_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_bank_info" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "bank_name" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_bank_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "order_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "shipping_address" JSONB,
    "billing_address" JSONB,
    "payment_method" TEXT,
    "payment_method_title" TEXT,
    "payment_status" TEXT DEFAULT 'pending',
    "transaction_id" TEXT,
    "notes" TEXT,
    "customer_note" TEXT,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipped_date" TIMESTAMP(3),
    "delivered_date" TIMESTAMP(3),
    "wordpress_id" INTEGER,
    "wc_number" TEXT,
    "wc_status" TEXT,
    "wc_date_created" TIMESTAMP(3),
    "wc_date_modified" TIMESTAMP(3),
    "wc_date_paid" TIMESTAMP(3),
    "wc_date_completed" TIMESTAMP(3),
    "wc_currency" TEXT NOT NULL DEFAULT 'EUR',
    "wc_currency_symbol" TEXT NOT NULL DEFAULT '€',
    "wc_prices_include_tax" BOOLEAN NOT NULL DEFAULT true,
    "wc_customer_ip_address" TEXT,
    "wc_customer_user_agent" TEXT,
    "wc_cart_hash" TEXT,
    "wc_fee_lines" JSONB,
    "wc_coupon_lines" JSONB,
    "wc_shipping_lines" JSONB,
    "wc_tax_lines" JSONB,
    "wc_refunds" JSONB,
    "wc_meta_data" JSONB,
    "wc_created_via" TEXT,
    "wc_version" TEXT,
    "wc_order_key" TEXT,
    "wc_payment_url" TEXT,
    "sync_status" TEXT NOT NULL DEFAULT 'NOT_SYNCED',
    "last_sync_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "estimated_delivery" TIMESTAMP(3),
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "carrier" TEXT,
    "internal_notes" TEXT,
    "b2b_payment_method" "B2BPaymentMethod",
    "b2b_payment_due_date" TIMESTAMP(3),
    "b2b_payment_terms" INTEGER,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "product_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 22,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_class" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "price_source" TEXT,
    "allocated_location" TEXT,
    "allocated_quantity" INTEGER,
    "wc_line_item_id" INTEGER,
    "wc_product_id" INTEGER,
    "wc_variation_id" INTEGER,
    "wc_meta_data" JSONB,
    "wc_parent_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "website" TEXT,
    "address" JSONB,
    "payment_terms" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "avg_delivery_days" INTEGER,
    "on_time_delivery_rate" DECIMAL(5,2),
    "quality_rating" DECIMAL(3,2),
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "late_deliveries" INTEGER NOT NULL DEFAULT 0,
    "defective_deliveries" INTEGER NOT NULL DEFAULT 0,
    "default_lead_time_days" INTEGER NOT NULL DEFAULT 7,
    "bank_name" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "payment_plan_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_scorecards" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "on_time_deliveries" INTEGER NOT NULL DEFAULT 0,
    "late_deliveries" INTEGER NOT NULL DEFAULT 0,
    "on_time_delivery_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avg_lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "avg_late_days" INTEGER NOT NULL DEFAULT 0,
    "total_receipts" INTEGER NOT NULL DEFAULT 0,
    "passed_inspections" INTEGER NOT NULL DEFAULT 0,
    "failed_inspections" INTEGER NOT NULL DEFAULT 0,
    "quality_rate" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "total_items_received" INTEGER NOT NULL DEFAULT 0,
    "rejected_items" INTEGER NOT NULL DEFAULT 0,
    "rejection_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avg_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_variance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overall_score" INTEGER NOT NULL DEFAULT 0,
    "delivery_score" INTEGER NOT NULL DEFAULT 0,
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "cost_score" INTEGER NOT NULL DEFAULT 0,
    "reliability_score" INTEGER NOT NULL DEFAULT 0,
    "rating" TEXT NOT NULL DEFAULT 'C',
    "notes" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "order_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "expected_date" TIMESTAMP(3),
    "received_date" TIMESTAMP(3),
    "payment_terms" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "shipped_date" TIMESTAMP(3),
    "actual_delivery_date" TIMESTAMP(3),
    "carrier" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "estimated_delivery_date" TIMESTAMP(3),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_notes" TEXT,
    "order_type" "PurchaseOrderType" NOT NULL DEFAULT 'MATERIAL',
    "related_order_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "material_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "last_purchase_price" DECIMAL(10,4),
    "price_variance" DECIMAL(10,4),
    "quality_status" "QualityStatus" NOT NULL DEFAULT 'PENDING',
    "quality_notes" TEXT,
    "allocated_to_orders" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "customer_id" TEXT,
    "order_id" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "document_type" "FatturapaDocumentType",
    "sdi_status" "SdiStatus" NOT NULL DEFAULT 'NOT_SENT',
    "sdi_id" TEXT,
    "sdi_file_name" TEXT,
    "sdi_sent_at" TIMESTAMP(3),
    "sdi_received_at" TIMESTAMP(3),
    "sdi_error_code" TEXT,
    "sdi_error_message" TEXT,
    "xml_file_path" TEXT,
    "pdf_file_path" TEXT,
    "payment_method_pa" "PaymentMethodPA",
    "bollo_amount" DECIMAL(5,2),
    "bollo_virtual" BOOLEAN NOT NULL DEFAULT false,
    "social_security_type" TEXT,
    "social_security_rate" DECIMAL(5,2),
    "social_security_amount" DECIMAL(10,2),
    "social_security_taxable" BOOLEAN NOT NULL DEFAULT true,
    "withholding_tax_type" TEXT,
    "withholding_tax_rate" DECIMAL(5,2),
    "withholding_tax_amount" DECIMAL(10,2),
    "withholding_tax_reason" TEXT,
    "ddt_reference" TEXT,
    "transport_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_date" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "match_status" "ThreeWayMatchStatus" NOT NULL DEFAULT 'PENDING',
    "matched_at" TIMESTAMP(3),
    "matched_by" TEXT,
    "auto_matched" BOOLEAN NOT NULL DEFAULT false,
    "price_tolerance" DECIMAL(5,2),
    "quantity_tolerance" DECIMAL(5,2),

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_items" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT,
    "product_id" TEXT,
    "material_id" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,4) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "match_status" "ThreeWayMatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "three_way_matches" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "goods_receipt_id" TEXT,
    "status" "ThreeWayMatchStatus" NOT NULL DEFAULT 'PENDING',
    "match_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_by" TEXT,
    "po_total" DECIMAL(10,2) NOT NULL,
    "po_quantity" INTEGER NOT NULL,
    "gr_total" DECIMAL(10,2),
    "gr_quantity" INTEGER,
    "invoice_total" DECIMAL(10,2) NOT NULL,
    "invoice_quantity" INTEGER NOT NULL,
    "price_variance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price_variance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "qty_variance" INTEGER NOT NULL DEFAULT 0,
    "qty_variance_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "within_tolerance" BOOLEAN NOT NULL DEFAULT false,
    "tolerance_used" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "resolution_status" "MatchResolutionStatus",
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "three_way_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
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
    "tenant_id" TEXT,
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
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "supplier_invoice_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_costs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "category" "OverheadCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT,
    "allocation_method" TEXT NOT NULL DEFAULT 'labor_hours',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overhead_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" "TimeEntryType" NOT NULL DEFAULT 'WORK',
    "clock_in" TIMESTAMP(3) NOT NULL,
    "clock_out" TIMESTAMP(3),
    "duration" INTEGER,
    "task_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_leaves" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_id" TEXT,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "workflow_step" INTEGER,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimated_hours" DECIMAL(5,2),
    "actual_hours" DECIMAL(5,2),
    "due_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_operations" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "actual_time" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order_source" "OrderSource",
    "steps" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "related_id" TEXT,
    "reminder_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "material_id" TEXT,
    "alert_type" TEXT NOT NULL,
    "current_value" DECIMAL(10,2) NOT NULL,
    "threshold_value" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_types" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "default_hourly_rate" DECIMAL(10,2),
    "requires_liquid_product" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_type_employees" (
    "id" TEXT NOT NULL,
    "operation_type_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "certified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_type_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_phases" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "product_id" TEXT NOT NULL,
    "operation_type_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standard_time" INTEGER NOT NULL,
    "setup_time" INTEGER NOT NULL DEFAULT 0,
    "external_cost_per_unit" DECIMAL(10,2),
    "supplier_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturing_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_materials" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "scrap_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_consumable" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phase_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase_employees" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "certified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "order_number" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "sales_order_id" TEXT,
    "sales_order_item_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "planned_start_date" TIMESTAMP(3),
    "planned_end_date" TIMESTAMP(3),
    "actual_start_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_phases" (
    "id" TEXT NOT NULL,
    "production_order_id" TEXT NOT NULL,
    "manufacturing_phase_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "ProductionPhaseStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_employee_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "actual_time" INTEGER,
    "labor_cost" DECIMAL(10,2),
    "material_cost" DECIMAL(10,2),
    "external_cost" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_consumptions" (
    "id" TEXT NOT NULL,
    "production_phase_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "planned_quantity" DECIMAL(10,4) NOT NULL,
    "actual_quantity" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "location" "InventoryLocation" NOT NULL,
    "lot_number" TEXT,
    "movement_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordpress_plugin_auth" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wordpress_plugin_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordpress_sync_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "direction" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request" JSONB,
    "response" JSONB,
    "error" TEXT,
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wordpress_sync_logs_pkey" PRIMARY KEY ("id")
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
    "tenant_id" TEXT,
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

-- CreateTable
CREATE TABLE "rmas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "rma_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "RmaStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" "RmaReason" NOT NULL,
    "reason_detail" TEXT,
    "resolution" "RmaResolution",
    "resolution_notes" TEXT,
    "refund_amount" DECIMAL(10,2),
    "exchange_order_id" TEXT,
    "store_credit_code" TEXT,
    "return_shipping_method" TEXT,
    "return_tracking_number" TEXT,
    "return_carrier" TEXT,
    "return_label_url" TEXT,
    "shipped_by_customer_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "received_by" TEXT,
    "inspection_notes" TEXT,
    "inspection_photos" JSONB,
    "inspected_at" TIMESTAMP(3),
    "inspected_by" TEXT,
    "item_condition" TEXT,
    "refund_id" TEXT,
    "internal_notes" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "customer_email" TEXT,
    "emails_sent" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rma_items" (
    "id" TEXT NOT NULL,
    "rma_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "sku" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity_requested" INTEGER NOT NULL,
    "quantity_received" INTEGER,
    "quantity_restocked" INTEGER,
    "item_status" TEXT NOT NULL DEFAULT 'PENDING',
    "condition" TEXT,
    "condition_notes" TEXT,
    "can_restock" BOOLEAN NOT NULL DEFAULT false,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_value" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rma_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_carts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "customer_id" TEXT,
    "session_id" TEXT,
    "coupon_id" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping_method_id" TEXT,
    "shipping_address" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "reserved_until" TIMESTAMP(3),
    "reserved_qty" INTEGER,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "notify_restock" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "type" "CouponType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "scope" "CouponScope" NOT NULL DEFAULT 'ENTIRE_ORDER',
    "applicable_ids" JSONB,
    "excluded_ids" JSONB,
    "minimum_order_amount" DECIMAL(10,2),
    "maximum_discount" DECIMAL(10,2),
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "max_uses_per_customer" INTEGER,
    "customer_ids" JSONB,
    "customer_tiers" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "order_id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "transaction_id" TEXT,
    "session_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "amount_refunded" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "payment_method" TEXT,
    "last4" TEXT,
    "three_d_secure" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "webhook_data" JSONB,
    "risk_score" INTEGER,
    "risk_level" TEXT,
    "authorized_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_shipping_zones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "countries" JSONB NOT NULL,
    "regions" JSONB,
    "postcodes" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_shipping_methods" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "type" "ShippingType" NOT NULL,
    "base_cost" DECIMAL(10,2) NOT NULL,
    "cost_per_kg" DECIMAL(10,4),
    "cost_per_item" DECIMAL(10,2),
    "free_above_amount" DECIMAL(10,2),
    "min_weight" DECIMAL(10,3),
    "max_weight" DECIMAL(10,3),
    "min_order_amount" DECIMAL(10,2),
    "max_order_amount" DECIMAL(10,2),
    "estimated_days_min" INTEGER NOT NULL DEFAULT 1,
    "estimated_days_max" INTEGER NOT NULL DEFAULT 5,
    "carrier_service_code" TEXT,
    "description" TEXT,
    "logo_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "product_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "order_item_id" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "pros" JSONB,
    "cons" JSONB,
    "images" JSONB,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "moderated_by" TEXT,
    "moderated_at" TIMESTAMP(3),
    "moderation_note" TEXT,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "report_count" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "responded_at" TIMESTAMP(3),
    "responded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "tier_expires_at" TIMESTAMP(3),
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "LoyaltyTxType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "expires_at" TIMESTAMP(3),
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "age_verifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "session_id" TEXT,
    "customer_id" TEXT,
    "verified" BOOLEAN NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "device_hash" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "age_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "session_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "page_url" TEXT,
    "referrer" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "device_type" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "email" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "preferences" JSONB,
    "tags" JSONB,
    "confirm_token" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "unsubscribe_reason" TEXT,
    "source" TEXT,
    "mailchimp_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "company" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "type" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'RUNNING',
    "current_page" INTEGER NOT NULL DEFAULT 1,
    "total_pages" INTEGER,
    "total_items" INTEGER,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paused_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "resumed_from" TEXT,
    "created_by" TEXT,
    "bullmq_job_id" TEXT,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdi_notifications" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "message_id" TEXT,
    "file_name" TEXT,
    "content" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "is_processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sdi_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ddt" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "ddt_number" TEXT NOT NULL,
    "order_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "transport_date" TIMESTAMP(3) NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "carrier" TEXT,
    "carrier_notes" TEXT,
    "number_of_packages" INTEGER NOT NULL DEFAULT 1,
    "total_weight" DECIMAL(10,3),
    "transport_reason" TEXT NOT NULL DEFAULT 'VENDITA',
    "shipment_appearance" TEXT,
    "notes" TEXT,
    "internal_notes" TEXT,
    "invoice_id" TEXT,
    "is_invoiced" BOOLEAN NOT NULL DEFAULT false,
    "pdf_file_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ddt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ddt_items" (
    "id" TEXT NOT NULL,
    "ddt_id" TEXT NOT NULL,
    "product_id" TEXT,
    "variant_id" TEXT,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "lot_number" TEXT,
    "serial_number" TEXT,
    "unit_price" DECIMAL(10,2),
    "line_number" INTEGER NOT NULL,

    CONSTRAINT "ddt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "type" "SuggestionType" NOT NULL,
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action_label" TEXT,
    "product_id" TEXT,
    "material_id" TEXT,
    "supplier_id" TEXT,
    "customer_id" TEXT,
    "order_id" TEXT,
    "data" JSONB,
    "action_url" TEXT,
    "potential_saving" DECIMAL(10,2),
    "potential_revenue" DECIMAL(10,2),
    "expires_at" TIMESTAMP(3),
    "dismissed_by" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismiss_reason" TEXT,
    "acted_by" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "date" DATE NOT NULL,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "orders_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orders_avg_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "new_customers" INTEGER NOT NULL DEFAULT 0,
    "returning_customers" INTEGER NOT NULL DEFAULT 0,
    "production_orders_started" INTEGER NOT NULL DEFAULT 0,
    "production_orders_completed" INTEGER NOT NULL DEFAULT 0,
    "items_produced" INTEGER NOT NULL DEFAULT 0,
    "inventory_movements" INTEGER NOT NULL DEFAULT 0,
    "stock_alerts_count" INTEGER NOT NULL DEFAULT 0,
    "low_stock_products_count" INTEGER NOT NULL DEFAULT 0,
    "invoices_issued" INTEGER NOT NULL DEFAULT 0,
    "invoices_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoices_paid" INTEGER NOT NULL DEFAULT 0,
    "invoices_paid_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "purchase_orders_created" INTEGER NOT NULL DEFAULT 0,
    "purchase_orders_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "goods_receipts_count" INTEGER NOT NULL DEFAULT 0,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_overdue" INTEGER NOT NULL DEFAULT 0,
    "suggestions_generated" INTEGER NOT NULL DEFAULT 0,
    "suggestions_acted" INTEGER NOT NULL DEFAULT 0,
    "suggestions_dismissed" INTEGER NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(10,2),
    "margin_percentage" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_dashboard_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT NOT NULL,
    "layout" JSONB,
    "email_daily_digest" BOOLEAN NOT NULL DEFAULT true,
    "email_weekly_digest" BOOLEAN NOT NULL DEFAULT true,
    "email_urgent_alerts" BOOLEAN NOT NULL DEFAULT true,
    "show_suggestions" BOOLEAN NOT NULL DEFAULT true,
    "suggestion_types" JSONB,
    "default_date_range" TEXT NOT NULL DEFAULT '7d',
    "show_kpis" BOOLEAN NOT NULL DEFAULT true,
    "show_urgent_tasks" BOOLEAN NOT NULL DEFAULT true,
    "show_day_plan" BOOLEAN NOT NULL DEFAULT true,
    "compact_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_dashboard_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_count_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "PhysicalCountStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countType" TEXT NOT NULL DEFAULT 'FULL',
    "planned_date" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "require_double_count" BOOLEAN NOT NULL DEFAULT false,
    "freeze_inventory" BOOLEAN NOT NULL DEFAULT false,
    "allow_blind_count" BOOLEAN NOT NULL DEFAULT true,
    "filters" JSONB,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "counted_items" INTEGER NOT NULL DEFAULT 0,
    "discrepancy_count" INTEGER NOT NULL DEFAULT 0,
    "total_variance_value" DECIMAL(12,2),
    "created_by_id" TEXT NOT NULL,
    "started_by_id" TEXT,
    "completed_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_count_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_count_items" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "product_id" TEXT,
    "variant_id" TEXT,
    "material_id" TEXT,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "location" TEXT,
    "expected_quantity" INTEGER NOT NULL,
    "counted_quantity" INTEGER,
    "verified_quantity" INTEGER,
    "final_quantity" INTEGER,
    "variance" INTEGER DEFAULT 0,
    "variance_value" DECIMAL(10,2),
    "status" "PhysicalCountItemStatus" NOT NULL DEFAULT 'NOT_COUNTED',
    "counted_at" TIMESTAMP(3),
    "counted_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "notes" TEXT,
    "unit_cost" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL DEFAULT 'WEEKLY',
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "recipients" TEXT[],
    "parameters" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run" TIMESTAMP(3),
    "next_run" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_user_id_key" ON "tenant_members"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invites_token_key" ON "tenant_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_tenant_id_key" ON "saas_subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_subscriptions_stripe_subscription_id_key" ON "saas_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_sku_key" ON "materials"("sku");

-- CreateIndex
CREATE INDEX "materials_sku_idx" ON "materials"("sku");

-- CreateIndex
CREATE INDEX "materials_supplier_id_idx" ON "materials"("supplier_id");

-- CreateIndex
CREATE INDEX "materials_category_idx" ON "materials"("category");

-- CreateIndex
CREATE INDEX "material_inventory_material_id_idx" ON "material_inventory"("material_id");

-- CreateIndex
CREATE INDEX "material_inventory_warehouse_id_idx" ON "material_inventory"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_inventory_material_id_warehouse_id_location_lot_nu_key" ON "material_inventory"("material_id", "warehouse_id", "location", "lot_number");

-- CreateIndex
CREATE INDEX "material_movements_material_id_idx" ON "material_movements"("material_id");

-- CreateIndex
CREATE INDEX "material_movements_type_idx" ON "material_movements"("type");

-- CreateIndex
CREATE INDEX "material_movements_created_at_idx" ON "material_movements"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_wordpress_id_key" ON "products"("wordpress_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_woocommerce_id_key" ON "products"("woocommerce_id");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_type_idx" ON "products"("type");

-- CreateIndex
CREATE INDEX "products_is_sellable_idx" ON "products"("is_sellable");

-- CreateIndex
CREATE INDEX "products_supplier_id_idx" ON "products"("supplier_id");

-- CreateIndex
CREATE INDEX "products_woocommerce_id_idx" ON "products"("woocommerce_id");

-- CreateIndex
CREATE INDEX "products_sync_status_idx" ON "products"("sync_status");

-- CreateIndex
CREATE INDEX "products_shipping_class_id_idx" ON "products"("shipping_class_id");

-- CreateIndex
CREATE INDEX "product_ideation_costs_product_id_idx" ON "product_ideation_costs"("product_id");

-- CreateIndex
CREATE INDEX "product_ideation_costs_type_idx" ON "product_ideation_costs"("type");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_woocommerce_variation_id_key" ON "product_variants"("woocommerce_variation_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_woocommerce_variation_id_idx" ON "product_variants"("woocommerce_variation_id");

-- CreateIndex
CREATE INDEX "bom_items_parent_product_id_idx" ON "bom_items"("parent_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_items_parent_product_id_component_product_id_key" ON "bom_items"("parent_product_id", "component_product_id");

-- CreateIndex
CREATE INDEX "product_materials_product_id_idx" ON "product_materials"("product_id");

-- CreateIndex
CREATE INDEX "product_materials_variant_id_idx" ON "product_materials"("variant_id");

-- CreateIndex
CREATE INDEX "product_materials_material_id_idx" ON "product_materials"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_materials_product_id_variant_id_material_id_key" ON "product_materials"("product_id", "variant_id", "material_id");

-- CreateIndex
CREATE INDEX "product_operations_product_id_idx" ON "product_operations"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_woocommerce_id_key" ON "product_categories"("woocommerce_id");

-- CreateIndex
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories"("parent_id");

-- CreateIndex
CREATE INDEX "product_categories_woocommerce_id_idx" ON "product_categories"("woocommerce_id");

-- CreateIndex
CREATE INDEX "product_categories_sync_status_idx" ON "product_categories"("sync_status");

-- CreateIndex
CREATE INDEX "product_category_assignments_product_id_idx" ON "product_category_assignments"("product_id");

-- CreateIndex
CREATE INDEX "product_category_assignments_category_id_idx" ON "product_category_assignments"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_assignments_product_id_category_id_key" ON "product_category_assignments"("product_id", "category_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_images_variant_id_idx" ON "product_images"("variant_id");

-- CreateIndex
CREATE INDEX "product_images_woocommerce_id_idx" ON "product_images"("woocommerce_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_classes_slug_key" ON "shipping_classes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_classes_woocommerce_id_key" ON "shipping_classes"("woocommerce_id");

-- CreateIndex
CREATE INDEX "shipping_classes_tenant_id_idx" ON "shipping_classes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_attributes_woocommerce_id_key" ON "woocommerce_attributes"("woocommerce_id");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_attributes_slug_key" ON "woocommerce_attributes"("slug");

-- CreateIndex
CREATE INDEX "woocommerce_attributes_tenant_id_idx" ON "woocommerce_attributes"("tenant_id");

-- CreateIndex
CREATE INDEX "woocommerce_attribute_terms_attribute_id_idx" ON "woocommerce_attribute_terms"("attribute_id");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_attribute_terms_attribute_id_woocommerce_id_key" ON "woocommerce_attribute_terms"("attribute_id", "woocommerce_id");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_attribute_terms_attribute_id_slug_key" ON "woocommerce_attribute_terms"("attribute_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_tags_woocommerce_id_key" ON "woocommerce_tags"("woocommerce_id");

-- CreateIndex
CREATE UNIQUE INDEX "woocommerce_tags_slug_key" ON "woocommerce_tags"("slug");

-- CreateIndex
CREATE INDEX "woocommerce_tags_tenant_id_idx" ON "woocommerce_tags"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_items_warehouse_id_idx" ON "inventory_items"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_items_product_id_idx" ON "inventory_items"("product_id");

-- CreateIndex
CREATE INDEX "inventory_items_location_idx" ON "inventory_items"("location");

-- CreateIndex
CREATE INDEX "inventory_items_tenant_id_idx" ON "inventory_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_warehouse_id_product_id_variant_id_location_key" ON "inventory_items"("warehouse_id", "product_id", "variant_id", "location", "lot_number");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_idx" ON "inventory_movements"("product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_variant_id_idx" ON "inventory_movements"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_movements_type_idx" ON "inventory_movements"("type");

-- CreateIndex
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements"("created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_tenant_id_idx" ON "inventory_movements"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tax_id_key" ON "customers"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_wordpress_id_key" ON "customers"("wordpress_id");

-- CreateIndex
CREATE INDEX "customers_type_idx" ON "customers"("type");

-- CreateIndex
CREATE INDEX "customers_code_idx" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_wordpress_id_idx" ON "customers"("wordpress_id");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_sync_status_idx" ON "customers"("sync_status");

-- CreateIndex
CREATE INDEX "customers_price_list_id_idx" ON "customers"("price_list_id");

-- CreateIndex
CREATE INDEX "customers_payment_plan_id_idx" ON "customers"("payment_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_code_key" ON "price_lists"("code");

-- CreateIndex
CREATE INDEX "price_list_items_price_list_id_idx" ON "price_list_items"("price_list_id");

-- CreateIndex
CREATE INDEX "price_list_items_product_id_idx" ON "price_list_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_price_list_id_product_id_min_quantity_key" ON "price_list_items"("price_list_id", "product_id", "min_quantity");

-- CreateIndex
CREATE INDEX "category_discounts_price_list_id_idx" ON "category_discounts"("price_list_id");

-- CreateIndex
CREATE INDEX "category_discounts_category_id_idx" ON "category_discounts"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_discounts_price_list_id_category_id_key" ON "category_discounts"("price_list_id", "category_id");

-- CreateIndex
CREATE INDEX "customer_contacts_customer_id_idx" ON "customer_contacts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_bank_info_customer_id_key" ON "customer_bank_info"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_wordpress_id_key" ON "orders"("wordpress_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_idx" ON "orders"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_source_idx" ON "orders"("source");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "orders_wordpress_id_idx" ON "orders"("wordpress_id");

-- CreateIndex
CREATE INDEX "orders_sync_status_idx" ON "orders"("sync_status");

-- CreateIndex
CREATE INDEX "orders_priority_idx" ON "orders"("priority");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tax_id_key" ON "suppliers"("tax_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_payment_plan_id_idx" ON "suppliers"("payment_plan_id");

-- CreateIndex
CREATE INDEX "supplier_scorecards_supplier_id_idx" ON "supplier_scorecards"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_scorecards_period_idx" ON "supplier_scorecards"("period");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scorecards_supplier_id_period_period_type_key" ON "supplier_scorecards"("supplier_id", "period", "period_type");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_delivery_status_idx" ON "purchase_orders"("delivery_status");

-- CreateIndex
CREATE INDEX "purchase_orders_order_type_idx" ON "purchase_orders"("order_type");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_idx" ON "purchase_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_material_id_idx" ON "purchase_order_items"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE INDEX "invoices_sdi_status_idx" ON "invoices"("sdi_status");

-- CreateIndex
CREATE INDEX "invoices_document_type_idx" ON "invoices"("document_type");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_invoice_number_key" ON "supplier_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_status_idx" ON "supplier_invoices"("status");

-- CreateIndex
CREATE INDEX "supplier_invoices_due_date_idx" ON "supplier_invoices"("due_date");

-- CreateIndex
CREATE INDEX "supplier_invoices_match_status_idx" ON "supplier_invoices"("match_status");

-- CreateIndex
CREATE INDEX "supplier_invoices_tenant_id_idx" ON "supplier_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_items_supplier_invoice_id_idx" ON "supplier_invoice_items"("supplier_invoice_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_items_purchase_order_item_id_idx" ON "supplier_invoice_items"("purchase_order_item_id");

-- CreateIndex
CREATE INDEX "three_way_matches_supplier_invoice_id_idx" ON "three_way_matches"("supplier_invoice_id");

-- CreateIndex
CREATE INDEX "three_way_matches_purchase_order_id_idx" ON "three_way_matches"("purchase_order_id");

-- CreateIndex
CREATE INDEX "three_way_matches_status_idx" ON "three_way_matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "three_way_matches_supplier_invoice_id_purchase_order_id_key" ON "three_way_matches"("supplier_invoice_id", "purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_plans_code_key" ON "payment_plans"("code");

-- CreateIndex
CREATE INDEX "payment_plans_tenant_id_idx" ON "payment_plans"("tenant_id");

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
CREATE INDEX "payment_dues_type_status_idx" ON "payment_dues"("type", "status");

-- CreateIndex
CREATE INDEX "payment_dues_type_status_due_date_idx" ON "payment_dues"("type", "status", "due_date");

-- CreateIndex
CREATE INDEX "payment_dues_tenant_id_idx" ON "payment_dues"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_due_payments_payment_due_id_idx" ON "payment_due_payments"("payment_due_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_supplier_invoice_id_idx" ON "payments"("supplier_invoice_id");

-- CreateIndex
CREATE INDEX "overhead_costs_category_idx" ON "overhead_costs"("category");

-- CreateIndex
CREATE INDEX "overhead_costs_tenant_id_idx" ON "overhead_costs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "time_entries_employee_id_idx" ON "time_entries"("employee_id");

-- CreateIndex
CREATE INDEX "time_entries_clock_in_idx" ON "time_entries"("clock_in");

-- CreateIndex
CREATE INDEX "employee_leaves_employee_id_idx" ON "employee_leaves"("employee_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_id_idx" ON "tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_order_id_idx" ON "tasks"("order_id");

-- CreateIndex
CREATE INDEX "task_operations_task_id_idx" ON "task_operations"("task_id");

-- CreateIndex
CREATE INDEX "workflows_tenant_id_idx" ON "workflows"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "calendar_events_start_date_idx" ON "calendar_events"("start_date");

-- CreateIndex
CREATE INDEX "calendar_events_eventType_idx" ON "calendar_events"("eventType");

-- CreateIndex
CREATE INDEX "stock_alerts_product_id_idx" ON "stock_alerts"("product_id");

-- CreateIndex
CREATE INDEX "stock_alerts_material_id_idx" ON "stock_alerts"("material_id");

-- CreateIndex
CREATE INDEX "stock_alerts_alert_type_idx" ON "stock_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "stock_alerts_status_idx" ON "stock_alerts"("status");

-- CreateIndex
CREATE INDEX "stock_alerts_created_at_idx" ON "stock_alerts"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "operation_types_code_key" ON "operation_types"("code");

-- CreateIndex
CREATE INDEX "operation_types_tenant_id_idx" ON "operation_types"("tenant_id");

-- CreateIndex
CREATE INDEX "operation_type_employees_operation_type_id_idx" ON "operation_type_employees"("operation_type_id");

-- CreateIndex
CREATE INDEX "operation_type_employees_employee_id_idx" ON "operation_type_employees"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_type_employees_operation_type_id_employee_id_key" ON "operation_type_employees"("operation_type_id", "employee_id");

-- CreateIndex
CREATE INDEX "manufacturing_phases_product_id_idx" ON "manufacturing_phases"("product_id");

-- CreateIndex
CREATE INDEX "manufacturing_phases_operation_type_id_idx" ON "manufacturing_phases"("operation_type_id");

-- CreateIndex
CREATE INDEX "manufacturing_phases_tenant_id_idx" ON "manufacturing_phases"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturing_phases_product_id_sequence_key" ON "manufacturing_phases"("product_id", "sequence");

-- CreateIndex
CREATE INDEX "phase_materials_phase_id_idx" ON "phase_materials"("phase_id");

-- CreateIndex
CREATE INDEX "phase_materials_material_id_idx" ON "phase_materials"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "phase_materials_phase_id_material_id_key" ON "phase_materials"("phase_id", "material_id");

-- CreateIndex
CREATE INDEX "phase_employees_phase_id_idx" ON "phase_employees"("phase_id");

-- CreateIndex
CREATE INDEX "phase_employees_employee_id_idx" ON "phase_employees"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "phase_employees_phase_id_employee_id_key" ON "phase_employees"("phase_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_order_number_key" ON "production_orders"("order_number");

-- CreateIndex
CREATE INDEX "production_orders_product_id_idx" ON "production_orders"("product_id");

-- CreateIndex
CREATE INDEX "production_orders_sales_order_id_idx" ON "production_orders"("sales_order_id");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_tenant_id_idx" ON "production_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "production_phases_production_order_id_idx" ON "production_phases"("production_order_id");

-- CreateIndex
CREATE INDEX "production_phases_manufacturing_phase_id_idx" ON "production_phases"("manufacturing_phase_id");

-- CreateIndex
CREATE INDEX "production_phases_status_idx" ON "production_phases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "production_phases_production_order_id_sequence_key" ON "production_phases"("production_order_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "material_consumptions_movement_id_key" ON "material_consumptions"("movement_id");

-- CreateIndex
CREATE INDEX "material_consumptions_production_phase_id_idx" ON "material_consumptions"("production_phase_id");

-- CreateIndex
CREATE INDEX "material_consumptions_material_id_idx" ON "material_consumptions"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "wordpress_plugin_auth_username_key" ON "wordpress_plugin_auth"("username");

-- CreateIndex
CREATE INDEX "wordpress_plugin_auth_tenant_id_idx" ON "wordpress_plugin_auth"("tenant_id");

-- CreateIndex
CREATE INDEX "wordpress_sync_logs_entity_idx" ON "wordpress_sync_logs"("entity");

-- CreateIndex
CREATE INDEX "wordpress_sync_logs_entity_id_idx" ON "wordpress_sync_logs"("entity_id");

-- CreateIndex
CREATE INDEX "wordpress_sync_logs_status_idx" ON "wordpress_sync_logs"("status");

-- CreateIndex
CREATE INDEX "wordpress_sync_logs_created_at_idx" ON "wordpress_sync_logs"("created_at");

-- CreateIndex
CREATE INDEX "wordpress_sync_logs_tenant_id_idx" ON "wordpress_sync_logs"("tenant_id");

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
CREATE INDEX "goods_receipts_tenant_id_idx" ON "goods_receipts"("tenant_id");

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
CREATE UNIQUE INDEX "rmas_rma_number_key" ON "rmas"("rma_number");

-- CreateIndex
CREATE INDEX "rmas_order_id_idx" ON "rmas"("order_id");

-- CreateIndex
CREATE INDEX "rmas_customer_id_idx" ON "rmas"("customer_id");

-- CreateIndex
CREATE INDEX "rmas_status_idx" ON "rmas"("status");

-- CreateIndex
CREATE INDEX "rmas_requested_at_idx" ON "rmas"("requested_at");

-- CreateIndex
CREATE INDEX "rmas_tenant_id_idx" ON "rmas"("tenant_id");

-- CreateIndex
CREATE INDEX "rma_items_rma_id_idx" ON "rma_items"("rma_id");

-- CreateIndex
CREATE INDEX "rma_items_order_item_id_idx" ON "rma_items"("order_item_id");

-- CreateIndex
CREATE INDEX "shopping_carts_customer_id_idx" ON "shopping_carts"("customer_id");

-- CreateIndex
CREATE INDEX "shopping_carts_expires_at_idx" ON "shopping_carts"("expires_at");

-- CreateIndex
CREATE INDEX "shopping_carts_tenant_id_idx" ON "shopping_carts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shopping_carts_session_id_key" ON "shopping_carts"("session_id");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_variant_id_key" ON "cart_items"("cart_id", "product_id", "variant_id");

-- CreateIndex
CREATE INDEX "wishlist_items_customer_id_idx" ON "wishlist_items"("customer_id");

-- CreateIndex
CREATE INDEX "wishlist_items_product_id_idx" ON "wishlist_items"("product_id");

-- CreateIndex
CREATE INDEX "wishlist_items_tenant_id_idx" ON "wishlist_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_customer_id_product_id_variant_id_key" ON "wishlist_items"("customer_id", "product_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_valid_from_valid_to_idx" ON "coupons"("is_active", "valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_idx" ON "coupons"("tenant_id");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_idx" ON "coupon_usages"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_usages_customer_id_idx" ON "coupon_usages"("customer_id");

-- CreateIndex
CREATE INDEX "coupon_usages_order_id_idx" ON "coupon_usages"("order_id");

-- CreateIndex
CREATE INDEX "payment_transactions_provider_idx" ON "payment_transactions"("provider");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_transaction_id_idx" ON "payment_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "payment_transactions_tenant_id_idx" ON "payment_transactions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_order_id_key" ON "payment_transactions"("order_id");

-- CreateIndex
CREATE INDEX "shop_shipping_zones_is_active_idx" ON "shop_shipping_zones"("is_active");

-- CreateIndex
CREATE INDEX "shop_shipping_zones_tenant_id_idx" ON "shop_shipping_zones"("tenant_id");

-- CreateIndex
CREATE INDEX "shop_shipping_methods_zone_id_idx" ON "shop_shipping_methods"("zone_id");

-- CreateIndex
CREATE INDEX "shop_shipping_methods_carrier_idx" ON "shop_shipping_methods"("carrier");

-- CreateIndex
CREATE INDEX "shop_shipping_methods_is_active_idx" ON "shop_shipping_methods"("is_active");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_reviews_customer_id_idx" ON "product_reviews"("customer_id");

-- CreateIndex
CREATE INDEX "product_reviews_status_idx" ON "product_reviews"("status");

-- CreateIndex
CREATE INDEX "product_reviews_rating_idx" ON "product_reviews"("rating");

-- CreateIndex
CREATE INDEX "product_reviews_tenant_id_idx" ON "product_reviews"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_reviews_product_id_customer_id_order_id_key" ON "product_reviews"("product_id", "customer_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_customer_id_key" ON "loyalty_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "loyalty_accounts_tier_idx" ON "loyalty_accounts"("tier");

-- CreateIndex
CREATE INDEX "loyalty_accounts_points_idx" ON "loyalty_accounts"("points");

-- CreateIndex
CREATE INDEX "loyalty_accounts_tenant_id_idx" ON "loyalty_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_account_id_idx" ON "loyalty_transactions"("account_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_order_id_idx" ON "loyalty_transactions"("order_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_type_idx" ON "loyalty_transactions"("type");

-- CreateIndex
CREATE INDEX "loyalty_transactions_expires_at_expired_idx" ON "loyalty_transactions"("expires_at", "expired");

-- CreateIndex
CREATE INDEX "age_verifications_session_id_idx" ON "age_verifications"("session_id");

-- CreateIndex
CREATE INDEX "age_verifications_customer_id_idx" ON "age_verifications"("customer_id");

-- CreateIndex
CREATE INDEX "age_verifications_device_hash_idx" ON "age_verifications"("device_hash");

-- CreateIndex
CREATE INDEX "age_verifications_tenant_id_idx" ON "age_verifications"("tenant_id");

-- CreateIndex
CREATE INDEX "user_events_session_id_idx" ON "user_events"("session_id");

-- CreateIndex
CREATE INDEX "user_events_customer_id_idx" ON "user_events"("customer_id");

-- CreateIndex
CREATE INDEX "user_events_eventType_idx" ON "user_events"("eventType");

-- CreateIndex
CREATE INDEX "user_events_created_at_idx" ON "user_events"("created_at");

-- CreateIndex
CREATE INDEX "user_events_tenant_id_idx" ON "user_events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_status_idx" ON "newsletter_subscriptions"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_customer_id_idx" ON "newsletter_subscriptions"("customer_id");

-- CreateIndex
CREATE INDEX "newsletter_subscriptions_tenant_id_idx" ON "newsletter_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_type_is_default_idx" ON "customer_addresses"("customer_id", "type", "is_default");

-- CreateIndex
CREATE INDEX "customer_addresses_tenant_id_idx" ON "customer_addresses"("tenant_id");

-- CreateIndex
CREATE INDEX "import_jobs_type_idx" ON "import_jobs"("type");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_jobs_created_by_idx" ON "import_jobs"("created_by");

-- CreateIndex
CREATE INDEX "import_jobs_started_at_idx" ON "import_jobs"("started_at");

-- CreateIndex
CREATE INDEX "import_jobs_tenant_id_idx" ON "import_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "sdi_notifications_invoice_id_idx" ON "sdi_notifications"("invoice_id");

-- CreateIndex
CREATE INDEX "sdi_notifications_notification_type_idx" ON "sdi_notifications"("notification_type");

-- CreateIndex
CREATE INDEX "sdi_notifications_received_at_idx" ON "sdi_notifications"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "ddt_ddt_number_key" ON "ddt"("ddt_number");

-- CreateIndex
CREATE INDEX "ddt_customer_id_idx" ON "ddt"("customer_id");

-- CreateIndex
CREATE INDEX "ddt_order_id_idx" ON "ddt"("order_id");

-- CreateIndex
CREATE INDEX "ddt_issue_date_idx" ON "ddt"("issue_date");

-- CreateIndex
CREATE INDEX "ddt_is_invoiced_idx" ON "ddt"("is_invoiced");

-- CreateIndex
CREATE INDEX "ddt_tenant_id_idx" ON "ddt"("tenant_id");

-- CreateIndex
CREATE INDEX "ddt_items_ddt_id_idx" ON "ddt_items"("ddt_id");

-- CreateIndex
CREATE INDEX "ddt_items_product_id_idx" ON "ddt_items"("product_id");

-- CreateIndex
CREATE INDEX "suggestions_type_idx" ON "suggestions"("type");

-- CreateIndex
CREATE INDEX "suggestions_priority_idx" ON "suggestions"("priority");

-- CreateIndex
CREATE INDEX "suggestions_status_idx" ON "suggestions"("status");

-- CreateIndex
CREATE INDEX "suggestions_product_id_idx" ON "suggestions"("product_id");

-- CreateIndex
CREATE INDEX "suggestions_material_id_idx" ON "suggestions"("material_id");

-- CreateIndex
CREATE INDEX "suggestions_created_at_idx" ON "suggestions"("created_at");

-- CreateIndex
CREATE INDEX "suggestions_expires_at_idx" ON "suggestions"("expires_at");

-- CreateIndex
CREATE INDEX "suggestions_tenant_id_idx" ON "suggestions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_date_key" ON "daily_summaries"("date");

-- CreateIndex
CREATE INDEX "daily_summaries_date_idx" ON "daily_summaries"("date");

-- CreateIndex
CREATE INDEX "daily_summaries_tenant_id_idx" ON "daily_summaries"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_dashboard_preferences_user_id_key" ON "user_dashboard_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_dashboard_preferences_tenant_id_idx" ON "user_dashboard_preferences"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "physical_count_sessions_code_key" ON "physical_count_sessions"("code");

-- CreateIndex
CREATE INDEX "physical_count_sessions_warehouse_id_idx" ON "physical_count_sessions"("warehouse_id");

-- CreateIndex
CREATE INDEX "physical_count_sessions_status_idx" ON "physical_count_sessions"("status");

-- CreateIndex
CREATE INDEX "physical_count_sessions_planned_date_idx" ON "physical_count_sessions"("planned_date");

-- CreateIndex
CREATE INDEX "physical_count_sessions_tenant_id_idx" ON "physical_count_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "physical_count_items_session_id_idx" ON "physical_count_items"("session_id");

-- CreateIndex
CREATE INDEX "physical_count_items_product_id_idx" ON "physical_count_items"("product_id");

-- CreateIndex
CREATE INDEX "physical_count_items_material_id_idx" ON "physical_count_items"("material_id");

-- CreateIndex
CREATE INDEX "physical_count_items_status_idx" ON "physical_count_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "physical_count_items_session_id_product_id_variant_id_mater_key" ON "physical_count_items"("session_id", "product_id", "variant_id", "material_id", "location");

-- CreateIndex
CREATE INDEX "scheduled_reports_enabled_idx" ON "scheduled_reports"("enabled");

-- CreateIndex
CREATE INDEX "scheduled_reports_next_run_idx" ON "scheduled_reports"("next_run");

-- CreateIndex
CREATE INDEX "scheduled_reports_report_type_idx" ON "scheduled_reports"("report_type");

-- CreateIndex
CREATE INDEX "scheduled_reports_tenant_id_idx" ON "scheduled_reports"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "saas_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory" ADD CONSTRAINT "material_inventory_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_inventory" ADD CONSTRAINT "material_inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_movements" ADD CONSTRAINT "material_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shipping_class_id_fkey" FOREIGN KEY ("shipping_class_id") REFERENCES "shipping_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ideation_costs" ADD CONSTRAINT "product_ideation_costs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_parent_product_id_fkey" FOREIGN KEY ("parent_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_operations" ADD CONSTRAINT "product_operations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "woocommerce_attribute_terms" ADD CONSTRAINT "woocommerce_attribute_terms_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "woocommerce_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_discounts" ADD CONSTRAINT "category_discounts_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_discounts" ADD CONSTRAINT "category_discounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_bank_info" ADD CONSTRAINT "customer_bank_info_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_scorecards" ADD CONSTRAINT "supplier_scorecards_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "three_way_matches" ADD CONSTRAINT "three_way_matches_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_leaves" ADD CONSTRAINT "employee_leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_operations" ADD CONSTRAINT "task_operations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_operations" ADD CONSTRAINT "task_operations_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "product_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_type_employees" ADD CONSTRAINT "operation_type_employees_operation_type_id_fkey" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_type_employees" ADD CONSTRAINT "operation_type_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_phases" ADD CONSTRAINT "manufacturing_phases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_phases" ADD CONSTRAINT "manufacturing_phases_operation_type_id_fkey" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturing_phases" ADD CONSTRAINT "manufacturing_phases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_materials" ADD CONSTRAINT "phase_materials_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "manufacturing_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_materials" ADD CONSTRAINT "phase_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_employees" ADD CONSTRAINT "phase_employees_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "manufacturing_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_employees" ADD CONSTRAINT "phase_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_phases" ADD CONSTRAINT "production_phases_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_phases" ADD CONSTRAINT "production_phases_manufacturing_phase_id_fkey" FOREIGN KEY ("manufacturing_phase_id") REFERENCES "manufacturing_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_phases" ADD CONSTRAINT "production_phases_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_production_phase_id_fkey" FOREIGN KEY ("production_phase_id") REFERENCES "production_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_consumptions" ADD CONSTRAINT "material_consumptions_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "material_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rmas" ADD CONSTRAINT "rmas_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_items" ADD CONSTRAINT "rma_items_rma_id_fkey" FOREIGN KEY ("rma_id") REFERENCES "rmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_items" ADD CONSTRAINT "rma_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_items" ADD CONSTRAINT "rma_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_shipping_method_id_fkey" FOREIGN KEY ("shipping_method_id") REFERENCES "shop_shipping_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "shopping_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_shipping_methods" ADD CONSTRAINT "shop_shipping_methods_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "shop_shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sdi_notifications" ADD CONSTRAINT "sdi_notifications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddt" ADD CONSTRAINT "ddt_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddt" ADD CONSTRAINT "ddt_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddt_items" ADD CONSTRAINT "ddt_items_ddt_id_fkey" FOREIGN KEY ("ddt_id") REFERENCES "ddt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddt_items" ADD CONSTRAINT "ddt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddt_items" ADD CONSTRAINT "ddt_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_preferences" ADD CONSTRAINT "user_dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_sessions" ADD CONSTRAINT "physical_count_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "physical_count_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

