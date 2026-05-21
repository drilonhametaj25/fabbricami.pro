-- ============================================================================
-- TENANT ID NOT NULL — Constraint hardening sui modelli tenant-scoped
-- ============================================================================
--
-- Dopo cleanup_orphans (20260520120000) ogni record ha tenant_id valorizzato.
-- Questa migration forza l'invariante a livello DB: NOT NULL + FK ON DELETE
-- CASCADE + index hot-path. Idempotente — può essere ri-eseguita.

DO $migration$
DECLARE
  t TEXT;
  null_count INTEGER;
  -- NB: stock_alerts, employees, tasks, notifications, calendar_events, audit_logs
  -- non avevano tenant_id originalmente — sono trattati come child models
  -- e ricevono tenant_id nella migration 20260520120200_add_tenant_id_child_models.
  scoped_tables TEXT[] := ARRAY[
    'users','company_settings','warehouses','materials','products',
    'product_categories','inventory_items','inventory_movements','shipping_classes',
    'woocommerce_attributes','woocommerce_tags','customers','price_lists',
    'customer_addresses','suppliers','orders','purchase_orders','goods_receipts',
    'invoices','supplier_invoices','payment_plans','payment_dues','overhead_costs',
    'workflows','operation_types','manufacturing_phases',
    'production_orders','suggestions','daily_summaries','user_dashboard_preferences',
    'physical_count_sessions','scheduled_reports','import_jobs',
    'wordpress_plugin_auth','wordpress_sync_logs','ddt','rmas',
    'shopping_carts','wishlist_items','coupons','payment_transactions',
    'shop_shipping_zones','product_reviews','loyalty_accounts','age_verifications',
    'user_events','newsletter_subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    -- 1. Tabella o colonna inesistente → skip (defense in depth)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'tenant_id'
    ) THEN
      RAISE NOTICE 'Tabella % senza colonna tenant_id, skip', t;
      CONTINUE;
    END IF;

    -- 2. Verifica zero NULL residui prima di SET NOT NULL
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE tenant_id IS NULL', t) INTO null_count;
    IF null_count > 0 THEN
      RAISE EXCEPTION
        'Migration aborted: % righe con tenant_id NULL in tabella %. Eseguire prima cleanup_orphans.',
        null_count, t;
    END IF;

    -- 3. SET NOT NULL
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);

    -- 4. FK (con ON DELETE CASCADE) — drop esistente, ricrea
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_tenant_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) ' ||
      'REFERENCES tenants(id) ON DELETE CASCADE',
      t, t || '_tenant_id_fkey'
    );

    -- 5. Index hot-path
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I(tenant_id)',
      t || '_tenant_id_idx', t
    );

    RAISE NOTICE 'Hardened table %', t;
  END LOOP;
END
$migration$;
