-- ============================================================================
-- TENANT CLEANUP — Rimozione record con tenant_id NULL
-- ============================================================================
--
-- Contesto: dopo il leak documentato in S577–S586, parte dei record creati
-- dallo shop pubblico/job rotti sono salvati con tenant_id = NULL. Sono dati
-- ambigui che NON possiamo riassegnare automaticamente a un tenant — la
-- decisione utente è di eliminarli (vedi piano Fase 2 §6.1).
--
-- DESTRUCTIVE — viene eseguita in transazione singola: se un constraint blocca
-- il delete, l'intera migration roll-back-a (`BEGIN`/`COMMIT` impliciti di
-- Prisma migrate).
--
-- Le FK con `ON DELETE CASCADE` (default Prisma per @relation) propagano la
-- cancellazione ai child. Per gli scoped che hanno child senza tenant_id e
-- senza cascade esplicito facciamo DELETE espliciti PRIMA del padre.
--
-- Tabelle escluse: tenants/tenant_members/tenant_invites/subscription_plans/
-- saas_subscriptions/billing_history/system_settings/_prisma_migrations.

-- ============================================================================
-- 1) CHILDREN ESPLICITI PRIMA DEL PADRE
-- ============================================================================
-- Customer children senza tenant_id proprio (verranno comunque cancellati in
-- cascade quando cancelliamo customers, ma li dichiariamo per chiarezza).
DELETE FROM "customer_contacts" WHERE customer_id IN (SELECT id FROM "customers" WHERE tenant_id IS NULL);
DELETE FROM "customer_bank_info" WHERE customer_id IN (SELECT id FROM "customers" WHERE tenant_id IS NULL);

-- Order children
DELETE FROM "order_items"    WHERE order_id IN (SELECT id FROM "orders" WHERE tenant_id IS NULL);
DELETE FROM "order_notes"    WHERE order_id IN (SELECT id FROM "orders" WHERE tenant_id IS NULL);
DELETE FROM "order_refunds"  WHERE order_id IN (SELECT id FROM "orders" WHERE tenant_id IS NULL);

-- Cart children
DELETE FROM "cart_items" WHERE cart_id IN (SELECT id FROM "shopping_carts" WHERE tenant_id IS NULL);

-- Production children
DELETE FROM "production_phases" WHERE production_order_id IN (SELECT id FROM "production_orders" WHERE tenant_id IS NULL);

-- ============================================================================
-- 2) SCOPED MODELS — DELETE WHERE tenant_id IS NULL
-- ============================================================================
-- Ordine: figli (FK su altri scoped) prima dei padri.

-- E-commerce
DELETE FROM "wishlist_items"           WHERE tenant_id IS NULL;
DELETE FROM "coupons"                  WHERE tenant_id IS NULL;
DELETE FROM "payment_transactions"     WHERE tenant_id IS NULL;
DELETE FROM "shop_shipping_zones"      WHERE tenant_id IS NULL;
DELETE FROM "product_reviews"          WHERE tenant_id IS NULL;
DELETE FROM "loyalty_accounts"         WHERE tenant_id IS NULL;
DELETE FROM "age_verifications"        WHERE tenant_id IS NULL;
DELETE FROM "user_events"              WHERE tenant_id IS NULL;
DELETE FROM "newsletter_subscriptions" WHERE tenant_id IS NULL;
DELETE FROM "shopping_carts"           WHERE tenant_id IS NULL;

-- Orders & purchasing
DELETE FROM "orders"             WHERE tenant_id IS NULL;
DELETE FROM "purchase_orders"    WHERE tenant_id IS NULL;
DELETE FROM "goods_receipts"     WHERE tenant_id IS NULL;
DELETE FROM "invoices"           WHERE tenant_id IS NULL;
DELETE FROM "supplier_invoices"  WHERE tenant_id IS NULL;
DELETE FROM "ddt"               WHERE tenant_id IS NULL;
DELETE FROM "rmas"               WHERE tenant_id IS NULL;

-- Payments
DELETE FROM "payment_plans" WHERE tenant_id IS NULL;
DELETE FROM "payment_dues"  WHERE tenant_id IS NULL;
DELETE FROM "overhead_costs" WHERE tenant_id IS NULL;

-- Inventory & catalog
DELETE FROM "inventory_movements"      WHERE tenant_id IS NULL;
DELETE FROM "inventory_items"          WHERE tenant_id IS NULL;
DELETE FROM "stock_alerts"             WHERE tenant_id IS NULL;
DELETE FROM "shipping_classes"         WHERE tenant_id IS NULL;
DELETE FROM "woocommerce_attributes"   WHERE tenant_id IS NULL;
DELETE FROM "woocommerce_tags"         WHERE tenant_id IS NULL;

-- Manufacturing
DELETE FROM "production_orders"     WHERE tenant_id IS NULL;
DELETE FROM "manufacturing_phases"  WHERE tenant_id IS NULL;
DELETE FROM "operation_types"       WHERE tenant_id IS NULL;
DELETE FROM "workflows"             WHERE tenant_id IS NULL;

-- HR & operations
DELETE FROM "tasks"      WHERE tenant_id IS NULL;
DELETE FROM "employees"  WHERE tenant_id IS NULL;

-- System & notifications
DELETE FROM "notifications"               WHERE tenant_id IS NULL;
DELETE FROM "calendar_events"             WHERE tenant_id IS NULL;
DELETE FROM "audit_logs"                  WHERE tenant_id IS NULL;
DELETE FROM "suggestions"                 WHERE tenant_id IS NULL;
DELETE FROM "daily_summaries"             WHERE tenant_id IS NULL;
DELETE FROM "user_dashboard_preferences"  WHERE tenant_id IS NULL;
DELETE FROM "physical_count_sessions"     WHERE tenant_id IS NULL;
DELETE FROM "scheduled_reports"           WHERE tenant_id IS NULL;
DELETE FROM "import_jobs"                 WHERE tenant_id IS NULL;
DELETE FROM "wordpress_plugin_auth"      WHERE tenant_id IS NULL;
DELETE FROM "wordpress_sync_logs"         WHERE tenant_id IS NULL;

-- Customers & pricing (dopo orders/cart che li referenziano)
DELETE FROM "customer_addresses" WHERE tenant_id IS NULL;
DELETE FROM "price_lists"        WHERE tenant_id IS NULL;
DELETE FROM "customers"          WHERE tenant_id IS NULL;
DELETE FROM "suppliers"          WHERE tenant_id IS NULL;

-- Catalog parents
DELETE FROM "products"           WHERE tenant_id IS NULL;
DELETE FROM "product_categories" WHERE tenant_id IS NULL;
DELETE FROM "materials"          WHERE tenant_id IS NULL;
DELETE FROM "warehouses"         WHERE tenant_id IS NULL;

-- Company settings (un record per tenant; orfani = config "globale" anomala)
DELETE FROM "company_settings" WHERE tenant_id IS NULL;

-- Users orfani: solo quelli che NON hanno membership in tenant_members.
-- (Quelli con membership esistente potrebbero essere super-admin senza tenantId
-- attivo: li lasciamo, anche se il fix S577 li blocca a livello auth middleware.)
DELETE FROM "users"
WHERE tenant_id IS NULL
  AND id NOT IN (
    SELECT DISTINCT user_id FROM "tenant_members" WHERE user_id IS NOT NULL
  );
