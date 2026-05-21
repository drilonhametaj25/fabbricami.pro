-- Quick RLS isolation verification (vedi piano §8)
DELETE FROM products WHERE id IN ('p-A1','p-B1');
DELETE FROM tenants WHERE id IN ('tenant-A','tenant-B');

INSERT INTO tenants (id, slug, name, status, created_at, updated_at) VALUES
  ('tenant-A', 'tenant-a', 'A', 'ACTIVE', NOW(), NOW()),
  ('tenant-B', 'tenant-b', 'B', 'ACTIVE', NOW(), NOW());

SELECT set_config('app.tenant_id', 'tenant-A', false);

INSERT INTO products (id, tenant_id, sku, name, price, cost, type, unit, is_active, is_sellable, min_stock, min_stock_level, reorder_point, reorder_quantity, lead_time_days, sync_status, tax_class, tax_rate, tax_status, wc_backorders, created_at, updated_at, images)
VALUES ('p-A1', 'tenant-A', 'A-SKU-1', 'Product A', 10, 5, 'FINISHED_PRODUCT', 'pz', true, true, 0, 0, 0, 0, 0, 'PENDING', 'standard', 22, 'taxable', 'no', NOW(), NOW(), '[]');

SELECT set_config('app.tenant_id', 'tenant-B', false);

INSERT INTO products (id, tenant_id, sku, name, price, cost, type, unit, is_active, is_sellable, min_stock, min_stock_level, reorder_point, reorder_quantity, lead_time_days, sync_status, tax_class, tax_rate, tax_status, wc_backorders, created_at, updated_at, images)
VALUES ('p-B1', 'tenant-B', 'B-SKU-1', 'Product B', 20, 10, 'FINISHED_PRODUCT', 'pz', true, true, 0, 0, 0, 0, 0, 'PENDING', 'standard', 22, 'taxable', 'no', NOW(), NOW(), '[]');

SELECT 'tenant-B sees:' AS scope, id, tenant_id, sku FROM products;

SELECT set_config('app.tenant_id', 'tenant-A', false);
SELECT 'tenant-A sees:' AS scope, id, tenant_id, sku FROM products;

SELECT 'tenant-A query p-B1 directly:' AS scope, COUNT(*) AS count FROM products WHERE id = 'p-B1';
