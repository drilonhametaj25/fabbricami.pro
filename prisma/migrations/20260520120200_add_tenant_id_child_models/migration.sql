-- ============================================================================
-- ADD tenant_id ai child models (FK indiretta a Tenant)
-- ============================================================================
--
-- Contesto: ~37 modelli figli (order_items, customer_bank_info, payments,
-- material_movements, employees, tasks, ecc.) NON hanno colonna tenant_id
-- propria — sono raggiungibili solo via JOIN al padre. Il middleware Prisma
-- `$extends` non può iniettare il filtro su quei modelli; le raw query li
-- scoprono per ID globale. Aggiungiamo `tenant_id` + backfill dal padre +
-- NOT NULL + FK + index.
--
-- ORDINE TOPOLOGICO: ogni tabella deve venire DOPO il proprio padre.
--   1) Child di parent già scoped (Order, Customer, Material, Product, ecc.)
--   2) Tabelle scoped che non avevano tenant_id originalmente
--      (Employee, AuditLog, Notification, Task, StockAlert, CalendarEvent)
--   3) Child di #2 (TimeEntry, TaskOperation, ecc.)
--   4) Child di child (ProductionPhase → MaterialConsumption)
--
-- Le RLS policy che attiveremo dopo (20260520120400_enable_rls) si applicano
-- a queste tabelle solo dopo che hanno la colonna.

-- ----------------------------------------------------------------------------
-- Helper: add_tenant_id_to_child(child, fk_col, parent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.add_tenant_id_to_child(
  child TEXT, fk_col TEXT, parent TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = child AND column_name = 'tenant_id'
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id TEXT', child);
  END IF;

  EXECUTE format(
    'UPDATE %I c SET tenant_id = p.tenant_id ' ||
    'FROM %I p WHERE c.%I = p.id AND c.tenant_id IS NULL',
    child, parent, fk_col
  );

  EXECUTE format('DELETE FROM %I WHERE tenant_id IS NULL', child);

  EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', child);

  EXECUTE format(
    'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
    child, child || '_tenant_id_fkey'
  );
  EXECUTE format(
    'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) ' ||
    'REFERENCES tenants(id) ON DELETE CASCADE',
    child, child || '_tenant_id_fkey'
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id)',
    child || '_tenant_id_idx', child
  );

  RAISE NOTICE 'Added tenant_id to %', child;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- LIVELLO 1 — Child di parent già scoped (depth 1)
-- ============================================================================

-- Orders & ricevimento merce
SELECT pg_temp.add_tenant_id_to_child('order_items',           'order_id',           'orders');
SELECT pg_temp.add_tenant_id_to_child('order_notes',           'order_id',           'orders');
SELECT pg_temp.add_tenant_id_to_child('order_refunds',         'order_id',           'orders');
SELECT pg_temp.add_tenant_id_to_child('purchase_order_items',  'purchase_order_id',  'purchase_orders');
SELECT pg_temp.add_tenant_id_to_child('goods_receipt_items',   'goods_receipt_id',   'goods_receipts');
SELECT pg_temp.add_tenant_id_to_child('supplier_invoice_items','supplier_invoice_id','supplier_invoices');
SELECT pg_temp.add_tenant_id_to_child('ddt_items',             'ddt_id',             'ddt');
SELECT pg_temp.add_tenant_id_to_child('rma_items',             'rma_id',             'rmas');
SELECT pg_temp.add_tenant_id_to_child('three_way_matches',     'purchase_order_id',  'purchase_orders');

-- Customer children
SELECT pg_temp.add_tenant_id_to_child('customer_contacts',     'customer_id', 'customers');
SELECT pg_temp.add_tenant_id_to_child('customer_bank_info',    'customer_id', 'customers');

-- Material children
SELECT pg_temp.add_tenant_id_to_child('material_inventory',    'material_id', 'materials');
SELECT pg_temp.add_tenant_id_to_child('material_movements',    'material_id', 'materials');

-- Product children
SELECT pg_temp.add_tenant_id_to_child('product_variants',          'product_id',        'products');
SELECT pg_temp.add_tenant_id_to_child('product_ideation_costs',    'product_id',        'products');
SELECT pg_temp.add_tenant_id_to_child('product_operations',        'product_id',        'products');
SELECT pg_temp.add_tenant_id_to_child('product_materials',         'product_id',        'products');
SELECT pg_temp.add_tenant_id_to_child('product_images',            'product_id',        'products');
SELECT pg_temp.add_tenant_id_to_child('product_category_assignments','product_id',      'products');
SELECT pg_temp.add_tenant_id_to_child('bom_items',                 'parent_product_id', 'products');

-- WooCommerce attribute terms ← attributes
SELECT pg_temp.add_tenant_id_to_child('woocommerce_attribute_terms','attribute_id', 'woocommerce_attributes');

-- Supplier children
SELECT pg_temp.add_tenant_id_to_child('supplier_items',            'supplier_id', 'suppliers');
SELECT pg_temp.add_tenant_id_to_child('supplier_scorecards',       'supplier_id', 'suppliers');

-- Pricing children
SELECT pg_temp.add_tenant_id_to_child('price_list_items',          'price_list_id', 'price_lists');
SELECT pg_temp.add_tenant_id_to_child('category_discounts',        'price_list_id', 'price_lists');

-- Manufacturing depth-1 children (parents già scoped)
SELECT pg_temp.add_tenant_id_to_child('phase_materials',           'phase_id',            'manufacturing_phases');
SELECT pg_temp.add_tenant_id_to_child('production_phases',         'production_order_id', 'production_orders');

-- Payments depth-1
SELECT pg_temp.add_tenant_id_to_child('payment_plan_installments', 'payment_plan_id', 'payment_plans');
SELECT pg_temp.add_tenant_id_to_child('payment_due_payments',      'payment_due_id',  'payment_dues');

-- E-commerce children
SELECT pg_temp.add_tenant_id_to_child('cart_items',                'cart_id',             'shopping_carts');
SELECT pg_temp.add_tenant_id_to_child('coupon_usages',             'coupon_id',           'coupons');
SELECT pg_temp.add_tenant_id_to_child('shop_shipping_methods',     'zone_id',             'shop_shipping_zones');
SELECT pg_temp.add_tenant_id_to_child('loyalty_transactions',      'account_id',          'loyalty_accounts');
SELECT pg_temp.add_tenant_id_to_child('physical_count_items',      'session_id',          'physical_count_sessions');

-- ============================================================================
-- LIVELLO 1B — Child di child appena promossi (order_refund_items ← order_refunds)
-- ============================================================================
SELECT pg_temp.add_tenant_id_to_child('order_refund_items',  'refund_id',       'order_refunds');
SELECT pg_temp.add_tenant_id_to_child('supplier_volume_discounts', 'supplier_item_id', 'supplier_items');

-- ============================================================================
-- Payment: parent variabile (invoice O supplier_invoice). Custom backfill.
-- ============================================================================
DO $payments$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "payments" ADD COLUMN tenant_id TEXT;
  END IF;

  UPDATE "payments" pm
  SET tenant_id = inv.tenant_id
  FROM invoices inv
  WHERE pm.invoice_id = inv.id AND pm.tenant_id IS NULL;

  UPDATE "payments" pm
  SET tenant_id = sinv.tenant_id
  FROM supplier_invoices sinv
  WHERE pm.supplier_invoice_id = sinv.id AND pm.tenant_id IS NULL;

  DELETE FROM "payments" WHERE tenant_id IS NULL;

  ALTER TABLE "payments" ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS payments_tenant_id_fkey;
  ALTER TABLE "payments" ADD CONSTRAINT payments_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS payments_tenant_id_idx ON "payments"(tenant_id);
  RAISE NOTICE 'Added tenant_id to payments';
END
$payments$;

-- ============================================================================
-- LIVELLO 2 — Modelli scoped che NON avevano tenant_id originalmente.
-- Backfill da users.tenant_id (post-NOT-NULL della migration 20260520120100).
-- ============================================================================

SELECT pg_temp.add_tenant_id_to_child('employees',     'user_id',        'users');
SELECT pg_temp.add_tenant_id_to_child('audit_logs',    'user_id',        'users');
SELECT pg_temp.add_tenant_id_to_child('notifications', 'user_id',        'users');
SELECT pg_temp.add_tenant_id_to_child('tasks',         'created_by_id',  'users');

-- StockAlert: due possibili parent (product O material). Custom backfill.
DO $stockalert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_alerts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "stock_alerts" ADD COLUMN tenant_id TEXT;
  END IF;

  UPDATE "stock_alerts" s
  SET tenant_id = p.tenant_id
  FROM products p
  WHERE s.product_id = p.id AND s.tenant_id IS NULL;

  UPDATE "stock_alerts" s
  SET tenant_id = m.tenant_id
  FROM materials m
  WHERE s.material_id = m.id AND s.tenant_id IS NULL;

  DELETE FROM "stock_alerts" WHERE tenant_id IS NULL;

  ALTER TABLE "stock_alerts" ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE "stock_alerts" DROP CONSTRAINT IF EXISTS stock_alerts_tenant_id_fkey;
  ALTER TABLE "stock_alerts" ADD CONSTRAINT stock_alerts_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS stock_alerts_tenant_id_idx ON "stock_alerts"(tenant_id);
  RAISE NOTICE 'Added tenant_id to stock_alerts';
END
$stockalert$;

-- CalendarEvent: nessun FK al tenant → cancellare orfani esistenti.
DO $calendar$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE "calendar_events" ADD COLUMN tenant_id TEXT;
  END IF;

  DELETE FROM "calendar_events" WHERE tenant_id IS NULL;

  ALTER TABLE "calendar_events" ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE "calendar_events" DROP CONSTRAINT IF EXISTS calendar_events_tenant_id_fkey;
  ALTER TABLE "calendar_events" ADD CONSTRAINT calendar_events_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  CREATE INDEX IF NOT EXISTS calendar_events_tenant_id_idx ON "calendar_events"(tenant_id);
  RAISE NOTICE 'Added tenant_id to calendar_events (orphans deleted)';
END
$calendar$;

-- ============================================================================
-- LIVELLO 3 — Child dei modelli appena promossi (Employee, Task)
-- ============================================================================

SELECT pg_temp.add_tenant_id_to_child('time_entries',              'employee_id',       'employees');
SELECT pg_temp.add_tenant_id_to_child('employee_leaves',           'employee_id',       'employees');
SELECT pg_temp.add_tenant_id_to_child('operation_type_employees',  'operation_type_id', 'operation_types');
SELECT pg_temp.add_tenant_id_to_child('phase_employees',           'phase_id',          'manufacturing_phases');
SELECT pg_temp.add_tenant_id_to_child('task_operations',           'task_id',           'tasks');

-- ============================================================================
-- LIVELLO 4 — Child di child (MaterialConsumption ← ProductionPhase)
-- ============================================================================

SELECT pg_temp.add_tenant_id_to_child('material_consumptions',     'material_id', 'materials');
