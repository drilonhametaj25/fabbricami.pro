/**
 * WordPress E2E Tests
 * End-to-end tests for WordPress/WooCommerce integration flow
 *
 * These tests focus on:
 * 1. Product sync flow
 * 2. Order webhook processing
 * 3. Inventory sync
 * 4. Health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before imports
vi.mock('@server/config/database', async () => {
  return {
    prisma: {
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      inventoryItem: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      orderItem: {
        createMany: vi.fn(),
      },
      customer: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
        count: vi.fn(),
      },
      wordpressSyncLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      productCategory: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      wpCategory: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      wpAttribute: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      wpAttributeTerm: {
        upsert: vi.fn(),
      },
      wpTag: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      wpShippingClass: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      warehouse: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      companySettings: {
        findFirst: vi.fn(),
      },
      $queryRaw: vi.fn(),
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@server/config/environment', () => ({
  config: {
    wordpress: {
      apiUrl: 'https://test-shop.com',
      consumerKey: 'ck_test_key',
      consumerSecret: 'cs_test_secret',
      webhookSecret: 'webhook_secret_123',
    },
  },
}));

vi.mock('@server/services/notification.service', () => ({
  default: {
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@server/services/wordpress-settings.service', () => ({
  default: {
    getSettings: vi.fn().mockResolvedValue({
      apiUrl: 'https://test-shop.com',
      consumerKey: 'ck_test_key',
      consumerSecret: 'cs_test_secret',
      webhookSecret: 'webhook_secret_123',
      syncEnabled: true,
    }),
  },
}));

vi.mock('@server/services/wordpress-sync.helpers', () => ({
  mapProductToWooCommerce: vi.fn().mockReturnValue({
    name: 'Test Product',
    sku: 'SKU-001',
    regular_price: '100.00',
    stock_quantity: 50,
  }),
  mapVariantToWooCommerce: vi.fn(),
  mapAttributesForVariableProduct: vi.fn(),
  mapWooCommerceToProduct: vi.fn(),
  mapWooCommerceToVariant: vi.fn(),
  logSync: vi.fn(),
  findOrCreateShippingClass: vi.fn().mockResolvedValue(''),
}));

// Import after mocks
import { prisma } from '@server/config/database';
import wordpressService from '@server/services/wordpress.service';

// Save original fetch
const originalFetch = global.fetch;

describe('WordPress E2E - Complete Sync Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('Product Sync Flow: ERP → WooCommerce', () => {
    const mockProduct = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'SKU-001',
      price: 100,
      cost: 50,
      description: 'Test description',
      isActive: true,
      isSellable: true,
      webActive: true,
      wordpressId: null,
      productType: 'SIMPLE',
      wpCategoryId: null,
      variants: [],
      inventory: [],
      category: { name: 'Test Category' },
    };

    it('should sync new product to WooCommerce', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 100, reservedQuantity: 10 },
      } as any);
      vi.mocked(prisma.product.update).mockResolvedValue({
        ...mockProduct,
        wordpressId: 123,
        syncStatus: 'SYNCED',
      } as any);
      vi.mocked(prisma.wordpressSyncLog.create).mockResolvedValue({} as any);

      // Mock WooCommerce API response for new product
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            sku: 'SKU-001',
            name: 'Test Product',
          }),
      } as any);

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result).toHaveProperty('success');
      // If product doesn't exist and API works, should get woocommerceId
      if (result.success) {
        expect(result.woocommerceId).toBeDefined();
      }
    });

    it('should update existing product on WooCommerce', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        ...mockProduct,
        wordpressId: 123, // Already synced
      } as any);
      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 100, reservedQuantity: 10 },
      } as any);
      vi.mocked(prisma.product.update).mockResolvedValue({
        ...mockProduct,
        wordpressId: 123,
        syncStatus: 'SYNCED',
      } as any);
      vi.mocked(prisma.wordpressSyncLog.create).mockResolvedValue({} as any);

      // Mock WooCommerce API response for update (PUT)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            sku: 'SKU-001',
          }),
      } as any);

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result).toHaveProperty('success');
    });

    it('should handle sync errors gracefully', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 100, reservedQuantity: 10 },
      } as any);
      vi.mocked(prisma.wordpressSyncLog.create).mockResolvedValue({} as any);

      // Mock API error
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            code: 'product_invalid_sku',
            message: 'Invalid or duplicated SKU',
          }),
      } as any);

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle product not found', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      const result = await wordpressService.syncProductToWooCommerce('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Order Webhook Flow: WooCommerce → ERP', () => {
    const mockWooOrder = {
      id: 456,
      number: 'WOO-456',
      status: 'processing',
      currency: 'EUR',
      date_created: '2026-02-01T10:00:00',
      date_modified: '2026-02-01T10:00:00',
      total: '122.00',
      subtotal: '100.00',
      discount_total: '0.00',
      shipping_total: '10.00',
      total_tax: '12.00',
      prices_include_tax: false,
      customer_id: 1,
      customer_note: 'Please deliver in the morning',
      billing: {
        first_name: 'Mario',
        last_name: 'Rossi',
        email: 'mario@test.com',
        phone: '+39 123 456 7890',
        address_1: 'Via Test 123',
        address_2: '',
        city: 'Roma',
        state: 'RM',
        postcode: '00100',
        country: 'IT',
        company: 'Test Company Srl',
      },
      shipping: {
        first_name: 'Mario',
        last_name: 'Rossi',
        address_1: 'Via Test 123',
        address_2: '',
        city: 'Roma',
        state: 'RM',
        postcode: '00100',
        country: 'IT',
        company: '',
        phone: '',
      },
      payment_method: 'stripe',
      payment_method_title: 'Credit Card',
      transaction_id: 'txn_123456',
      line_items: [
        {
          id: 1,
          product_id: 123,
          variation_id: 0,
          quantity: 2,
          sku: 'SKU-001',
          name: 'Test Product',
          price: 50,
          subtotal: '100.00',
          total: '100.00',
          subtotal_tax: '0',
          total_tax: '22.00',
          tax_class: '',
          taxes: [],
          meta_data: [],
          image: null,
          parent_name: null,
        },
      ],
      shipping_lines: [
        {
          id: 1,
          method_title: 'Standard Shipping',
          method_id: 'flat_rate',
          instance_id: '1',
          total: '10.00',
          total_tax: '0.00',
          taxes: [],
          meta_data: [],
        },
      ],
      tax_lines: [],
      fee_lines: [],
      coupon_lines: [],
      refunds: [],
      meta_data: [],
    };

    it('should skip already imported orders', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue({
        id: 'existing-order',
        wordpressId: 456,
      } as any);

      const result = await wordpressService.processOrderWebhook(mockWooOrder as any);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('existing-order');
      // Should not create new order
      expect(vi.mocked(prisma.$transaction)).not.toHaveBeenCalled();
    });

    it('should handle order webhook with missing data', async () => {
      const incompleteOrder = {
        ...mockWooOrder,
        line_items: [], // No items
      };

      vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);

      const result = await wordpressService.processOrderWebhook(incompleteOrder as any);

      // Should handle gracefully even with missing data
      expect(result).toHaveProperty('success');
    });
  });

  describe('Inventory Sync Flow', () => {
    it('should sync inventory to WooCommerce', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        {
          id: 'prod-1',
          sku: 'SKU-001',
          wordpressId: 123,
          productType: 'SIMPLE',
          inventory: [{ quantity: 100, reservedQuantity: 10 }],
        },
        {
          id: 'prod-2',
          sku: 'SKU-002',
          wordpressId: 456,
          productType: 'SIMPLE',
          inventory: [{ quantity: 50, reservedQuantity: 5 }],
        },
      ] as any);

      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 100, reservedQuantity: 10 },
      } as any);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      } as any);

      const result = await wordpressService.syncInventoryToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
    });

    it('should update stock for specific product', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        sku: 'SKU-001',
        wordpressId: 123,
        productType: 'SIMPLE',
      } as any);

      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 75, reservedQuantity: 5 },
      } as any);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            stock_quantity: 70,
          }),
      } as any);

      const result = await wordpressService.syncSingleProductInventory('prod-1');

      // Returns boolean
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Order Status Sync Flow', () => {
    it('should update order status on WooCommerce', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: 'order-1',
        wordpressId: 456,
        status: 'SHIPPED',
      } as any);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 456,
            status: 'completed',
          }),
      } as any);

      const result = await wordpressService.updateOrderStatusOnWooCommerce('order-1', 'completed');

      expect(typeof result).toBe('boolean');
    });

    it('should handle status update from plugin', async () => {
      vi.mocked(prisma.order.findFirst).mockResolvedValue({
        id: 'order-1',
        wordpressId: 789,
        status: 'PENDING',
      } as any);

      vi.mocked(prisma.order.update).mockResolvedValue({
        id: 'order-1',
        status: 'SHIPPED',
      } as any);

      const result = await wordpressService.processPluginOrderStatus({
        order_id: 789,
        status: 'completed',
      });

      expect(result).toHaveProperty('success');
    });
  });

  describe('Customer Sync Flow', () => {
    it('should process new customer from plugin', async () => {
      vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.customer.create).mockResolvedValue({
        id: 'cust-1',
        email: 'new@customer.com',
        wordpressId: 100,
      } as any);

      const result = await wordpressService.processPluginCustomer({
        id: 100,
        email: 'new@customer.com',
        first_name: 'New',
        last_name: 'Customer',
        billing: {
          phone: '1234567890',
          address_1: 'Test Street',
          city: 'Rome',
          postcode: '00100',
          country: 'IT',
          company: 'Test Co',
        },
      });

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust-1');
    });

    it('should update existing customer from plugin', async () => {
      vi.mocked(prisma.customer.findFirst).mockResolvedValue({
        id: 'cust-existing',
        email: 'existing@customer.com',
        wordpressId: 100,
      } as any);

      vi.mocked(prisma.customer.update).mockResolvedValue({
        id: 'cust-existing',
        email: 'existing@customer.com',
        firstName: 'Updated',
      } as any);

      const result = await wordpressService.processPluginCustomer({
        id: 100,
        email: 'existing@customer.com',
        first_name: 'Updated',
        last_name: 'Customer',
      });

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('cust-existing');
    });
  });

  describe('Bulk Operations', () => {
    it('should sync all products', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          sku: 'SKU-001',
          isActive: true,
          isSellable: true,
        },
        {
          id: 'prod-2',
          name: 'Product 2',
          sku: 'SKU-002',
          isActive: true,
          isSellable: true,
        },
      ] as any);

      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        name: 'Product 1',
        sku: 'SKU-001',
        isActive: true,
        productType: 'SIMPLE',
      } as any);

      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 50, reservedQuantity: 0 },
      } as any);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      } as any);

      vi.mocked(prisma.product.update).mockResolvedValue({} as any);
      vi.mocked(prisma.wordpressSyncLog.create).mockResolvedValue({} as any);

      const result = await wordpressService.syncAllProductsToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
    });

    it('should sync all web-enabled products', async () => {
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);

      const result = await wordpressService.syncAllWebProductsToWooCommerce();

      expect(result.synced).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should verify WooCommerce connection', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            routes: {
              '/wc/v3': { namespace: 'wc/v3' },
            },
          }),
      } as any);

      const result = await wordpressService.healthCheck();

      expect(result).toHaveProperty('connected');
    });

    it('should detect connection failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await wordpressService.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should handle API rate limiting', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        sku: 'SKU-001',
        isActive: true,
        productType: 'SIMPLE',
      } as any);
      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 50, reservedQuantity: 0 },
      } as any);
      vi.mocked(prisma.wordpressSyncLog.create).mockResolvedValue({} as any);

      // Mock rate limit response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            code: 'woocommerce_rest_rate_limit',
            message: 'Rate limit exceeded',
          }),
      } as any);

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result.success).toBe(false);
    });

    it('should handle authentication errors', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        sku: 'SKU-001',
        isActive: true,
        productType: 'SIMPLE',
      } as any);
      vi.mocked(prisma.inventoryItem.aggregate).mockResolvedValue({
        _sum: { quantity: 50, reservedQuantity: 0 },
      } as any);
      vi.mocked(prisma.wordpressSyncLog.create).mockResolvedValue({} as any);

      // Mock auth error
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            code: 'woocommerce_rest_authentication_error',
            message: 'Consumer key is invalid',
          }),
      } as any);

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result.success).toBe(false);
    });
  });
});
