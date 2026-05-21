-- ============================================================================
-- ADD tenant_id ai child models (FK indiretta a Tenant)
-- ============================================================================
--
-- Contesto: ~37 modelli figli (order_items, customer_bank_info, payments,
-- material_movements, ecc.) NON hanno colonna tenant_id propria — sono
-- raggiungibili solo via JOIN al padre. Il middleware Prisma `$extends` non
-- può iniettare il filtro su quei modelli; le raw query li scoprono per ID
-- globale. Aggiungiamo `tenant_id` + backfill dal padre + NOT NULL + FK + index.
--
-- Le RLS policy che attiveremo dopo (20260520120400_enable_rls) si applicano
-- a queste tabelle solo dopo che hanno la colonna.

-- ----------------------------------------------------------------------------
-- Helper: add_tenant_id_to_child(child, fk_col, parent)
--   1) ADD COLUMN tenant_id se manca
--   2) UPDATE backfill: child.tenant_id := parent.tenant_id via FK
--   3) DELETE righe che restano NULL (parent orfano già cancellato)
--   4) ALTER COLUMN SET NOT NULL
--   5) FK su tenants(id) ON DELETE CASCADE
--   6) INDEX su tenant_id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.add_tenant_id_to_child(
  child TEXT, fk_col TEXT, parent TEXT
) RETURNS VOID AS $$
DECLARE
  null_count INTEGER;
BEGIN
  -- 1. ADD COLUMN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = child AND column_name = 'tenant_id'
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id TEXT', child);
  END IF;

  -- 2. Backfill dal padre
  EXECUTE format(
    'UPDATE %I c SET tenant_id = p.tenant_id ' ||
    'FROM %I p WHERE c.%I = p.id AND c.tenant_id IS NULL',
    child, parent, fk_col
  );

  -- 3. DELETE righe ancora orfane (parent inesistente)
  EXECUTE format('DELETE FROM %I WHERE tenant_id IS NULL', child);

  -- 4. SET NOT NULL
  EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', child);

  -- 5. FK su tenants
  EXECUTE format(
    'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
    child, child || '_tenant_id_fkey'
  );
  EXECUTE format(
    'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) ' ||
    'REFERENCES tenants(id) ON DELETE CASCADE',
    child, child || '_tenant_id_fkey'
  );

  -- 6. Index
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id)',
    child || '_tenant_id_idx', child
  );

  RAISE NOTICE 'Added tenant_id to %', child;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Applica a tutti i child models
-- ----------------------------------------------------------------------------

-- Orders & ricevimento merce
SELECT pg_temp.add_tenant_id_to_child('order_items',           'order_id',     'orders');
SELECT pg_temp.add_tenant_id_to_child('order_notes',           'order_id',     'orders');
SELECT pg_temp.add_tenant_id_to_child('order_refunds',         'order_id',     'orders');
SELECT pg_temp.add_tenant_id_to_child('order_refund_items',    'refund_id',    'order_refunds');
SELECT pg_temp.add_tenant_id_to_child('purchase_order_items',  'order_id',     'purchase_orders');
SELECT pg_temp.add_tenant_id_to_child('goods_receipt_items',   'receipt_id',   'goods_receipts');
SELECT pg_temp.add_tenant_id_to_child('supplier_invoice_items','invoice_id',   'supplier_invoices');
SELECT pg_temp.add_tenant_id_to_child('ddt_items',             'ddt_id',       'ddt');
SELECT pg_temp.add_tenant_id_to_child('rma_items',             'rma_id',       'rmas');

-- Customers
SELECT pg_temp.add_tenant_id_to_child('customer_contacts',     'customer_id', 'customers');
SELECT pg_temp.add_tenant_id_to_child('customer_bank_info',    'customer_id', 'customers');

-- Materials
SELECT pg_temp.add_tenant_id_to_child('material_inventory',    'material_id', 'materials');
SELECT pg_temp.add_tenant_id_to_child('material_movements',    'material_id', 'materials');
SELECT pg_temp.add_tenant_id_to_child('material_consumptions', 'material_id', 'materials');

-- HR
SELECT pg_temp.add_tenant_id_to_child('time_entries',          'employee_id', 'employees');
SELECT pg_temp.add_tenant_id_to_child('employee_leaves',       'employee_id', 'employees');
SELECT pg_temp.add_tenant_id_to_child('operation_type_employees', 'operation_type_id', 'operation_types');
SELECT pg_temp.add_tenant_id_to_child('task_operations',       'task_id',     'tasks');

-- Manufacturing
SELECT pg_temp.add_tenant_id_to_child('phase_materials',       'phase_id',    'manufacturing_phases');
SELECT pg_temp.add_tenant_id_to_child('phase_employees',       'phase_id',    'manufacturing_phases');
SELECT pg_temp.add_tenant_id_to_child('production_phases',     'production_order_id', 'production_orders');

-- Payments
SELECT pg_temp.add_tenant_id_to_child('payments',              'payment_plan_id', 'payment_plans');
SELECT pg_temp.add_tenant_id_to_child('payment_plan_installments', 'payment_plan_id', 'payment_plans');
SELECT pg_temp.add_tenant_id_to_child('payment_due_payments',  'payment_due_id', 'payment_dues');

-- Pricing & catalog
SELECT pg_temp.add_tenant_id_to_child('price_list_items',      'price_list_id', 'price_lists');
SELECT pg_temp.add_tenant_id_to_child('category_discounts',    'price_list_id', 'price_lists');
SELECT pg_temp.add_tenant_id_to_child('product_variants',          'product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('product_ideation_costs',    'product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('product_operations',        'product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('product_materials',         'product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('product_images',            'product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('product_category_assignments','product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('bom_items',                 'product_id', 'products');
SELECT pg_temp.add_tenant_id_to_child('woocommerce_attribute_terms','attribute_id','woocommerce_attributes');

-- Supplier sub-models
SELECT pg_temp.add_tenant_id_to_child('supplier_items',            'supplier_id', 'suppliers');
SELECT pg_temp.add_tenant_id_to_child('supplier_scorecards',       'supplier_id', 'suppliers');
SELECT pg_temp.add_tenant_id_to_child('supplier_volume_discounts', 'supplier_item_id','supplier_items');

-- E-commerce
SELECT pg_temp.add_tenant_id_to_child('cart_items',                'cart_id',     'shopping_carts');
SELECT pg_temp.add_tenant_id_to_child('coupon_usages',             'coupon_id',   'coupons');
SELECT pg_temp.add_tenant_id_to_child('shop_shipping_methods',     'zone_id',     'shop_shipping_zones');
SELECT pg_temp.add_tenant_id_to_child('loyalty_transactions',      'loyalty_account_id', 'loyalty_accounts');

-- Physical count
SELECT pg_temp.add_tenant_id_to_child('physical_count_items',      'session_id',  'physical_count_sessions');

-- 3-way match: lookup tramite purchase_order_id
SELECT pg_temp.add_tenant_id_to_child('three_way_matches',         'purchase_order_id', 'purchase_orders');
