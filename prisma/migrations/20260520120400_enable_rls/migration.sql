-- ============================================================================
-- POSTGRES ROW LEVEL SECURITY — Difesa in profondità multi-tenant
-- ============================================================================
--
-- Una query Prisma che sfugge al middleware $extends (tipicamente raw query
-- mal scritte, oppure futuri bug) viene fermata dal DB: la POLICY filtra
-- per tenant_id = current_setting('app.tenant_id', true).
--
-- Setup runtime: ogni transazione/connection deve eseguire prima:
--   SELECT set_config('app.tenant_id', '<tenant-uuid>', true);
-- Lo fa automaticamente il $extends modificato in src/server/config/database.ts
-- (vedi migration code 20260520120500_*_prisma_set_local non-SQL — è la logica
-- TS in database.ts).
--
-- Tabelle GLOBALI escluse da RLS (devono restare leggibili senza tenant context):
--   tenants, tenant_members, tenant_invites, subscription_plans,
--   saas_subscriptions, billing_history, system_settings, super_admins,
--   super_admin_audit_logs, signup_coupons, signup_coupon_usages, tickets,
--   _prisma_migrations
--
-- FORCE ROW LEVEL SECURITY: applica RLS anche al table owner (utente migration).
-- Senza FORCE, l'owner Postgres bypassa le policy.

DO $migration$
DECLARE
  t TEXT;
  scoped_tables TEXT[] := ARRAY[
    -- Parent scoped (tenant_id NOT NULL post 20260520120100)
    'users','company_settings','warehouses','materials','products',
    'product_categories','inventory_items','inventory_movements','shipping_classes',
    'woocommerce_attributes','woocommerce_tags','customers','price_lists',
    'customer_addresses','suppliers','orders','purchase_orders','goods_receipts',
    'invoices','supplier_invoices','payment_plans','payment_dues','overhead_costs',
    'employees','tasks','workflows','operation_types','manufacturing_phases',
    'production_orders','notifications','calendar_events','stock_alerts',
    'audit_logs','suggestions','daily_summaries','user_dashboard_preferences',
    'physical_count_sessions','scheduled_reports','import_jobs',
    'wordpress_plugin_auth','wordpress_sync_logs','ddt','rmas',
    'shopping_carts','wishlist_items','coupons','payment_transactions',
    'shop_shipping_zones','product_reviews','loyalty_accounts','age_verifications',
    'user_events','newsletter_subscriptions',
    -- Child scoped (tenant_id added in 20260520120200)
    'order_items','order_notes','order_refunds','order_refund_items',
    'purchase_order_items','goods_receipt_items','supplier_invoice_items',
    'ddt_items','rma_items',
    'customer_contacts','customer_bank_info',
    'material_inventory','material_movements','material_consumptions',
    'time_entries','employee_leaves','operation_type_employees','task_operations',
    'phase_materials','phase_employees','production_phases',
    'payments','payment_plan_installments','payment_due_payments',
    'price_list_items','category_discounts',
    'product_variants','product_ideation_costs','product_operations',
    'product_materials','product_images','product_category_assignments',
    'bom_items','woocommerce_attribute_terms',
    'supplier_items','supplier_scorecards','supplier_volume_discounts',
    'cart_items','coupon_usages','shop_shipping_methods','loyalty_transactions',
    'physical_count_items','three_way_matches'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    -- Skip se la tabella o la colonna tenant_id non esistono
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'tenant_id'
    ) THEN
      RAISE NOTICE 'Skip RLS su %: nessuna colonna tenant_id', t;
      CONTINUE;
    END IF;

    -- ENABLE + FORCE RLS (idempotente)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    -- DROP policy esistente per idempotenza, ricrea
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I ' ||
      'USING (tenant_id::text = current_setting(''app.tenant_id'', true)) ' ||
      'WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))',
      t
    );

    RAISE NOTICE 'RLS enabled on %', t;
  END LOOP;
END
$migration$;

-- ----------------------------------------------------------------------------
-- Default per la setting (evita errore "unrecognized configuration parameter")
-- quando il client non ha ancora chiamato set_config. Postgres permette il
-- placeholder usando ALTER DATABASE — qui usiamo invece il pattern del
-- secondo argomento `true` di current_setting() che ritorna NULL anziché
-- errore se non settato. Le policy con `= NULL` matchano zero righe — esatto.
-- ----------------------------------------------------------------------------
-- (no-op: vedi current_setting('app.tenant_id', true) nella POLICY sopra)
