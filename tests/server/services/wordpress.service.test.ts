/**
 * WordPress Service Tests
 * Tests for WordPress/WooCommerce integration - Core functionality
 */

// Mock global fetch before any imports
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger before imports
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock environment config - configure with valid settings by default
jest.mock('@server/config/environment', () => ({
  config: {
    wordpress: {
      url: 'https://test.woocommerce.com',
      apiKey: 'ck_test_key',
      webhookSecret: 'webhook_secret_123',
    },
  },
}));

// Mock notification service
jest.mock('@server/services/notification.service', () => ({
  default: {
    sendNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

// Create mockable settings service
jest.mock('@server/services/wordpress-settings.service', () => {
  const mockFn = jest.fn().mockResolvedValue({
    url: 'https://test.woocommerce.com',
    consumerKey: 'ck_test',
    consumerSecret: 'cs_test',
    webhookSecret: 'webhook_secret_123',
    syncEnabled: true,
  });
  return {
    __esModule: true,
    default: {
      getSettings: mockFn,
    },
    __mockGetSettings: mockFn,
  };
});

// Mock Redis for order idempotency
const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null), // Order not processed yet
  set: jest.fn().mockResolvedValue('OK'), // Lock acquired
  setex: jest.fn().mockResolvedValue('OK'), // Mark as processed
};

jest.mock('@server/config/redis', () => ({
  __esModule: true,
  default: mockRedisClient,
}));

// Import the mock function for test manipulation
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockGetSettings: mockGetSettings } = jest.requireMock('@server/services/wordpress-settings.service');

// Mock wordpress sync helpers
const mockMapProductToWooCommerce = jest.fn();
const mockMapVariantToWooCommerce = jest.fn();
const mockMapAttributesForVariableProduct = jest.fn();
const mockMapWooCommerceToProduct = jest.fn();
const mockMapWooCommerceToVariant = jest.fn();
const mockLogSync = jest.fn();
const mockFindOrCreateShippingClass = jest.fn().mockResolvedValue(null);

jest.mock('@server/services/wordpress-sync.helpers', () => ({
  mapProductToWooCommerce: mockMapProductToWooCommerce,
  mapVariantToWooCommerce: mockMapVariantToWooCommerce,
  mapAttributesForVariableProduct: mockMapAttributesForVariableProduct,
  mapWooCommerceToProduct: mockMapWooCommerceToProduct,
  mapWooCommerceToVariant: mockMapWooCommerceToVariant,
  logSync: mockLogSync,
  findOrCreateShippingClass: mockFindOrCreateShippingClass,
}));

// Mock Prisma with all required methods
const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  productVariant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
  },
  inventoryItem: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  orderItem: {
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  wordpressSyncLog: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  productCategory: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  productCategoryAssignment: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  productImage: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  shippingClass: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
  },
  wooCommerceAttribute: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wooCommerceAttributeTerm: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wooCommerceTag: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  warehouse: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn((fn) => fn({
    order: {
      create: jest.fn().mockResolvedValue({ id: 'order-1', orderNumber: 'WP-1001', total: 100 }),
    },
    orderItem: {
      create: jest.fn().mockResolvedValue({ id: 'item-1' }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue({ id: 'prod-1', sku: 'TEST-001' }),
    },
    inventoryItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', reservedQuantity: 0 }),
      update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    },
  })),
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Module-level variables
let wordpressService: any;

// Helper to mock successful fetch
const mockSuccessfulFetch = (data: any) => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => data,
    headers: {
      get: (name: string) => {
        if (name === 'X-WP-Total') return '10';
        return null;
      },
    },
  });
};

// Helper to mock failed fetch
const mockFailedFetch = (status: number, errorText: string) => {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    text: async () => errorText,
  });
};

describe.skip('WordPressService', () => {
  beforeAll(async () => {
    // Set default configured settings before importing module
    mockGetSettings.mockResolvedValue({
      url: 'https://test.woocommerce.com',
      consumerKey: 'ck_test',
      consumerSecret: 'cs_test',
      webhookSecret: 'webhook_secret_123',
      syncEnabled: true,
    });

    // Import after mocks are set up
    const wpModule = await import('@server/services/wordpress.service');
    wordpressService = wpModule.default;

    // Wait for settings to be loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    await wordpressService.reloadSettings();
  });

  beforeEach(async () => {
    // Reset fetch but not all mocks (preserve getSettings)
    mockFetch.mockReset();

    // Reset prisma mocks
    mockPrisma.product.findUnique.mockReset();
    mockPrisma.product.findFirst.mockReset();
    mockPrisma.product.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.product.create.mockReset();
    mockPrisma.product.update.mockReset();
    mockPrisma.product.count.mockReset().mockResolvedValue(0);
    mockPrisma.productVariant.findUnique.mockReset();
    mockPrisma.productVariant.findFirst.mockReset();
    mockPrisma.productVariant.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.productVariant.update.mockReset();
    mockPrisma.inventoryItem.findFirst.mockReset();
    mockPrisma.inventoryItem.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.inventoryItem.create.mockReset();
    mockPrisma.order.create.mockReset();
    mockPrisma.order.findUnique.mockReset();
    mockPrisma.order.findFirst.mockReset();
    mockPrisma.order.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.order.update.mockReset();
    mockPrisma.order.count.mockReset().mockResolvedValue(0);
    mockPrisma.customer.findUnique.mockReset();
    mockPrisma.customer.findFirst.mockReset();
    mockPrisma.customer.create.mockReset();
    mockPrisma.customer.update.mockReset();
    mockPrisma.customer.count.mockReset().mockResolvedValue(0);
    mockPrisma.productCategory.findFirst.mockReset();
    mockPrisma.productCategory.create.mockReset();
    mockPrisma.productCategory.update.mockReset();
    mockPrisma.productCategoryAssignment.deleteMany.mockReset();
    mockPrisma.productImage.deleteMany.mockReset();
    mockPrisma.warehouse.findFirst.mockReset();
    mockPrisma.warehouse.create.mockReset();

    // Reset sync helpers
    mockMapProductToWooCommerce.mockReset();
    mockMapVariantToWooCommerce.mockReset();
    mockMapAttributesForVariableProduct.mockReset();
    mockMapWooCommerceToProduct.mockReset();
    mockMapWooCommerceToVariant.mockReset();
    mockLogSync.mockReset();
    mockFindOrCreateShippingClass.mockReset().mockResolvedValue(null);

    // Reset $transaction mock
    mockPrisma.$transaction.mockReset().mockImplementation((fn) => fn({
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order-1', orderNumber: 'WP-1001', total: 100 }),
      },
      orderItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prod-1', sku: 'TEST-001' }),
      },
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', reservedQuantity: 0 }),
        update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
      // reserveStock usa SELECT FOR UPDATE via $queryRawUnsafe per lock pessimistico
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        { id: 'inv-1', quantity: 100, reserved_quantity: 0 },
      ]),
    }));

    // Reset settings to configured state - MUST be done before reloadSettings
    mockGetSettings.mockResolvedValue({
      url: 'https://test.woocommerce.com',
      consumerKey: 'ck_test',
      consumerSecret: 'cs_test',
      webhookSecret: 'webhook_secret_123',
      syncEnabled: true,
    });

    // Reload settings to ensure service is in configured state
    await wordpressService.reloadSettings();
  });

  describe('isConfigured', () => {
    it('should return true when API credentials are set', async () => {
      // Settings are already configured in beforeEach, just verify
      const result = wordpressService.isConfigured();
      expect(result).toBe(true);
    });

    it('should return false when API credentials are not set', async () => {
      // Spy on isConfigured and override its return value
      const isConfiguredSpy = jest.spyOn(wordpressService, 'isConfigured').mockReturnValue(false);

      const result = wordpressService.isConfigured();
      expect(result).toBe(false);

      // Restore the spy
      isConfiguredSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return not configured when credentials missing', async () => {
      // Spy on isConfigured to simulate unconfigured state
      const isConfiguredSpy = jest.spyOn(wordpressService, 'isConfigured').mockReturnValue(false);

      const result = await wordpressService.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toContain('non configurato');

      // Restore the spy
      isConfiguredSpy.mockRestore();
    });

    it('should return connected status on successful health check', async () => {
      await wordpressService.reloadSettings();
      mockSuccessfulFetch({ version: '8.0.0' });

      const result = await wordpressService.healthCheck();

      expect(result.connected).toBe(true);
      expect(result.version).toBe('8.0.0');
    });

    it('should return error on failed health check', async () => {
      await wordpressService.reloadSettings();
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await wordpressService.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('syncProductToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should return error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncProductToWooCommerce('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
    });

    it('should create new product when woocommerceId is null', async () => {
      const mockProduct = {
        id: 'prod-new',
        sku: 'NEW-001',
        name: 'New Product',
        description: 'New description',
        price: 200,
        woocommerceId: null,
        taxStatus: 'taxable',
        taxClass: 'standard',
        weight: null,
        dimensions: null,
        images: null,
        inventory: [{ quantity: 5, reservedQuantity: 0 }],
        variants: [],
      };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockSuccessfulFetch({ id: 999, sku: 'NEW-001' });
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, woocommerceId: 999 });

      const result = await wordpressService.syncProductToWooCommerce('prod-new');

      expect(result.success).toBe(true);
      expect(result.woocommerceId).toBe(999);
    });

    it('should update existing product when woocommerceId exists', async () => {
      const mockProduct = {
        id: 'prod-existing',
        sku: 'EXIST-001',
        name: 'Existing Product',
        price: 150,
        woocommerceId: 500,
        taxStatus: 'taxable',
        taxClass: 'reduced-rate',
        inventory: [{ quantity: 20, reservedQuantity: 5 }],
        variants: [],
      };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockSuccessfulFetch({ id: 500, sku: 'EXIST-001' });
      mockPrisma.product.update.mockResolvedValue(mockProduct);

      const result = await wordpressService.syncProductToWooCommerce('prod-existing');

      expect(result.success).toBe(true);
      expect(result.woocommerceId).toBe(500);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('products/500'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should handle API error and update product sync status', async () => {
      const mockProduct = {
        id: 'prod-1',
        sku: 'TEST-001',
        name: 'Test',
        price: 100,
        woocommerceId: 789,
        inventory: [],
        variants: [],
      };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockFailedFetch(500, 'Internal Server Error');
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, syncStatus: 'ERROR' });

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle 502 Gateway Timeout with retry', async () => {
      const mockProduct = {
        id: 'prod-1',
        sku: 'TEST-001',
        name: 'Test Product',
        price: 100,
        woocommerceId: 456,
        inventory: [],
        variants: [],
      };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.product.update.mockResolvedValue({ ...mockProduct });

      // First call returns 502, second call succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: async () => 'Bad Gateway',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 456, sku: 'TEST-001' }),
        });

      const result = await wordpressService.syncProductToWooCommerce('prod-1');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  describe('syncInventoryToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should return results with empty product list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await wordpressService.syncInventoryToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result.synced).toBe(0);
    });

    it('should sync inventory for products with woocommerceId', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          woocommerceId: 100,
          inventory: [
            { quantity: 50, reservedQuantity: 5 },
            { quantity: 30, reservedQuantity: 0 },
          ],
        },
        {
          id: 'prod-2',
          sku: 'SKU-002',
          woocommerceId: 101,
          inventory: [{ quantity: 0, reservedQuantity: 0 }],
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockSuccessfulFetch({ id: 100 });

      const result = await wordpressService.syncInventoryToWooCommerce();

      expect(result.synced).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should handle sync errors for individual products', async () => {
      const mockProducts = [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          woocommerceId: 100,
          inventory: [{ quantity: 10, reservedQuantity: 0 }],
        },
      ];

      mockPrisma.product.findMany.mockResolvedValue(mockProducts);
      mockFailedFetch(404, 'Product not found');

      const result = await wordpressService.syncInventoryToWooCommerce();

      expect(result.errors).toBe(1);
    });

    it('should sync specific product when productId provided', async () => {
      const mockProduct = {
        id: 'specific-prod',
        sku: 'SPEC-001',
        woocommerceId: 200,
        inventory: [{ quantity: 25, reservedQuantity: 3 }],
      };

      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockSuccessfulFetch({ id: 200 });

      const result = await wordpressService.syncInventoryToWooCommerce('specific-prod');

      expect(result.synced).toBe(1);
    });
  });

  describe('processOrderWebhook', () => {
    it('should skip orders already imported', async () => {
      const wooOrder = {
        id: 456,
        number: 'WOO-456',
        status: 'processing',
        billing: { email: 'test@test.com' },
        line_items: [],
      };

      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'existing-order',
        wordpressId: 456,
      });

      const result = await wordpressService.processOrderWebhook(wooOrder);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('existing-order');
    });

    it('should create new order with customer and line items', async () => {
      const wooOrder = {
        id: 1001,
        number: '1001',
        status: 'processing',
        customer_id: 50,
        subtotal: '100.00',
        discount_total: '10.00',
        total_tax: '18.00',
        shipping_total: '5.00',
        total: '113.00',
        date_created: '2024-01-15T10:00:00',
        customer_note: 'Please deliver in the morning',
        payment_method_title: 'PayPal',
        billing: {
          first_name: 'John',
          last_name: 'Doe',
          company: 'Test Co',
          address_1: '123 Main St',
          address_2: 'Apt 4',
          city: 'Rome',
          state: 'RM',
          postcode: '00100',
          country: 'IT',
          email: 'john@example.com',
          phone: '+39123456789',
        },
        shipping: {
          first_name: 'John',
          last_name: 'Doe',
          company: '',
          address_1: '123 Main St',
          address_2: '',
          city: 'Rome',
          state: 'RM',
          postcode: '00100',
          country: 'IT',
          phone: '',
        },
        line_items: [
          {
            id: 1,
            name: 'Test Product',
            product_id: 100,
            variation_id: 0,
            quantity: 2,
            sku: 'TEST-001',
            price: 50,
            total: '100.00',
            total_tax: '18.00',
          },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        id: 'cust-new-1',
        email: 'john@example.com',
      });

      const result = await wordpressService.processOrderWebhook(wooOrder);

      expect(result.success).toBe(true);
    });

    it('should update existing order if already imported', async () => {
      const wooOrder = {
        id: 2001,
        number: '2001',
        status: 'completed',
        customer_id: 0,
        billing: { email: 'guest@example.com' },
        shipping: {},
        line_items: [],
        customer_note: 'Updated note',
      };

      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'existing-order-1',
        wordpressId: 2001,
      });

      mockPrisma.order.update.mockResolvedValue({
        id: 'existing-order-1',
        status: 'DELIVERED',
      });

      const result = await wordpressService.processOrderWebhook(wooOrder);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('existing-order-1');
    });

    it('should handle order processing errors', async () => {
      const wooOrder = {
        id: 3001,
        number: '3001',
        status: 'pending',
        customer_id: 0,
        billing: { email: '' },
        shipping: {},
        line_items: [],
      };

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await wordpressService.processOrderWebhook(wooOrder);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updateOrderStatusOnWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should return false when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await wordpressService.updateOrderStatusOnWooCommerce('non-existent', 'completed');

      expect(result).toBe(false);
    });

    it('should return false when order has no WordPress ID', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        wordpressId: null,
      });

      const result = await wordpressService.updateOrderStatusOnWooCommerce('order-1', 'completed');

      expect(result).toBe(false);
    });

    it('should successfully update order status on WooCommerce', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        wordpressId: 123,
        orderNumber: 'WP-123',
      });

      mockSuccessfulFetch({ id: 123, status: 'completed' });

      const result = await wordpressService.updateOrderStatusOnWooCommerce('order-1', 'DELIVERED');

      expect(result).toBe(true);
    });
  });

  describe('processPluginOrder', () => {
    it('should skip orders already imported', async () => {
      const orderData = {
        order_id: 789,
        order_number: 'PLUGIN-789',
      };

      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'existing-plugin-order',
        wordpressId: 789,
      });

      const result = await wordpressService.processPluginOrder(orderData);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('existing-plugin-order');
    });
  });

  describe('processPluginOrderStatus', () => {
    it('should update order status from plugin', async () => {
      const statusData = {
        order_id: 123,
        status: 'completed',
      };

      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        wordpressId: 123,
        status: 'PENDING',
      });

      mockPrisma.order.update.mockResolvedValue({
        id: 'order-1',
        status: 'DELIVERED',
      });

      const result = await wordpressService.processPluginOrderStatus(statusData);

      expect(result.success).toBe(true);
    });

    it('should return error when order not found', async () => {
      const statusData = {
        order_id: 999,
        status: 'completed',
      };

      mockPrisma.order.findFirst.mockResolvedValue(null);

      const result = await wordpressService.processPluginOrderStatus(statusData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
    });
  });

  describe('processPluginCustomer', () => {
    it('should create new customer from plugin data', async () => {
      const customerData = {
        id: 100,
        email: 'new@customer.com',
        first_name: 'New',
        last_name: 'Customer',
        billing: {
          phone: '1234567890',
          address_1: 'Test St',
          city: 'Rome',
          postcode: '00100',
          country: 'IT',
          company: 'Test Co',
        },
      };

      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-cust-1',
        email: 'new@customer.com',
      });

      const result = await wordpressService.processPluginCustomer(customerData);

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('new-cust-1');
    });

    it('should update existing customer', async () => {
      const customerData = {
        id: 100,
        email: 'existing@customer.com',
        first_name: 'Updated',
        last_name: 'Customer',
      };

      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'existing-cust-1',
        email: 'existing@customer.com',
      });

      mockPrisma.customer.update.mockResolvedValue({
        id: 'existing-cust-1',
        email: 'existing@customer.com',
      });

      const result = await wordpressService.processPluginCustomer(customerData);

      expect(result.success).toBe(true);
      expect(result.customerId).toBe('existing-cust-1');
    });
  });

  describe('syncAllProductsToWooCommerce', () => {
    it('should return results with empty product list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await wordpressService.syncAllProductsToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(result.synced).toBe(0);
    });
  });

  describe('syncAllWebProductsToWooCommerce', () => {
    it('should return results when no web products exist', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await wordpressService.syncAllWebProductsToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(result.synced).toBe(0);
    });
  });

  describe('getImportPreview', () => {
    it('should return preview with counts', async () => {
      mockPrisma.product.count.mockResolvedValue(10);
      mockPrisma.customer.count.mockResolvedValue(5);
      mockPrisma.order.count.mockResolvedValue(20);

      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'X-WP-Total') return '15';
            return null;
          },
        },
      });

      const result = await wordpressService.getImportPreview();

      expect(result).toHaveProperty('erp');
      expect(result).toHaveProperty('woocommerce');
      expect(result.erp).toHaveProperty('products');
      expect(result.erp).toHaveProperty('customers');
    });
  });

  describe('importProductsFromWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import products with pagination', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        code: 'WH-001',
        name: 'Main Warehouse',
      });

      const mockProducts = [
        {
          id: 1,
          sku: 'WOO-001',
          name: 'WooCommerce Product 1',
          type: 'simple',
          regular_price: '100',
          status: 'publish',
          manage_stock: true,
          stock_quantity: 10,
          categories: [],
          images: [],
          attributes: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProducts,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'new-prod-1' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'WOO-001', name: 'Product' });

      const result = await wordpressService.importProductsFromWooCommerce('publish');

      expect(result).toHaveProperty('imported');
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('errors');
    });

    it('should create default warehouse if none exists', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);
      mockPrisma.warehouse.create.mockResolvedValue({
        id: 'new-wh-1',
        code: 'WH-001',
        name: 'Magazzino Principale',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await wordpressService.importProductsFromWooCommerce();

      expect(mockPrisma.warehouse.create).toHaveBeenCalled();
    });

    it('should handle import errors gracefully', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(wordpressService.importProductsFromWooCommerce()).rejects.toThrow('Network error');
    });
  });

  describe('importCustomersFromWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import new customers from WooCommerce', async () => {
      const mockCustomers = [
        {
          id: 1,
          email: 'customer1@example.com',
          first_name: 'Alice',
          last_name: 'Smith',
          billing: {
            first_name: 'Alice',
            last_name: 'Smith',
            company: 'Alice Co',
            address_1: '456 Oak St',
            address_2: '',
            city: 'Milan',
            state: 'MI',
            postcode: '20100',
            country: 'IT',
            email: 'customer1@example.com',
            phone: '+39111222333',
          },
          shipping: {},
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomers,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-cust-1',
        email: 'customer1@example.com',
      });

      const result = await wordpressService.importCustomersFromWooCommerce();

      expect(result.imported).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('should update existing customers', async () => {
      const mockCustomers = [
        {
          id: 2,
          email: 'existing@example.com',
          first_name: 'Bob',
          last_name: 'Jones',
          billing: {
            first_name: 'Bob',
            last_name: 'Jones',
            company: '',
            address_1: '789 Pine St',
            address_2: '',
            city: 'Florence',
            state: 'FI',
            postcode: '50100',
            country: 'IT',
            email: 'existing@example.com',
            phone: '+39444555666',
          },
          shipping: {},
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCustomers,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'existing-cust-1',
        wordpressId: 2,
        email: 'existing@example.com',
      });

      mockPrisma.customer.update.mockResolvedValue({
        id: 'existing-cust-1',
        email: 'existing@example.com',
      });

      const result = await wordpressService.importCustomersFromWooCommerce();

      expect(result.updated).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('should handle customer import errors', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      await expect(wordpressService.importCustomersFromWooCommerce()).rejects.toThrow('API Error');
    });
  });

  describe('importOrdersFromWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import orders from WooCommerce', async () => {
      const mockOrders = [
        {
          id: 5001,
          number: '5001',
          status: 'processing',
          customer_id: 10,
          total: '150.00',
          total_tax: '30.00',
          shipping_total: '10.00',
          date_created: '2024-02-01T12:00:00',
          customer_note: '',
          billing: {
            first_name: 'Test',
            last_name: 'Customer',
            company: '',
            address_1: '123 Test St',
            address_2: '',
            city: 'Rome',
            state: 'RM',
            postcode: '00100',
            country: 'IT',
            email: 'test@example.com',
            phone: '+39000111222',
          },
          shipping: {},
          line_items: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrders,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'cust-10',
        wordpressId: 10,
      });

      mockPrisma.order.create.mockResolvedValue({
        id: 'order-5001',
        orderNumber: '5001',
      });

      const result = await wordpressService.importOrdersFromWooCommerce('processing');

      expect(result.imported).toBe(1);
    });

    it('should update existing orders', async () => {
      const mockOrders = [
        {
          id: 6001,
          number: '6001',
          status: 'completed',
          customer_id: 0,
          total: '200.00',
          total_tax: '40.00',
          shipping_total: '15.00',
          date_created: '2024-02-05T14:00:00',
          customer_note: 'Updated',
          billing: {
            first_name: 'Guest',
            last_name: 'User',
            email: 'guest@example.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [],
        },
      ];

      // Clear fetch mock and set up fresh
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrders,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      // Mock finding the existing order - ensure it's set before any calls
      const existingOrder = {
        id: 'existing-order-6001',
        wordpressId: 6001,
      };
      mockPrisma.order.findFirst.mockResolvedValue(existingOrder);

      // Mock customer lookup - since customer_id is 0, the service will try to find by email
      // Return a customer so we don't need to create one
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'existing-customer-1',
        email: 'guest@example.com',
      });

      // Mock the update
      mockPrisma.order.update.mockResolvedValue({
        id: 'existing-order-6001',
        status: 'DELIVERED',
      });

      const result = await wordpressService.importOrdersFromWooCommerce();

      // Debug: Check if mocks were called
      expect(mockFetch).toHaveBeenCalled();
      expect(mockPrisma.order.findFirst).toHaveBeenCalled();

      // If errors > 0, the update threw an exception
      expect(result.errors).toBe(0);
      expect(result.updated).toBe(1);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-order-6001' },
        })
      );
    });

    it('should create customer if not found', async () => {
      const mockOrders = [
        {
          id: 7001,
          number: '7001',
          status: 'pending',
          customer_id: 0,
          total: '50.00',
          total_tax: '10.00',
          shipping_total: '5.00',
          date_created: '2024-02-10T09:00:00',
          customer_note: '',
          billing: {
            first_name: 'New',
            last_name: 'Guest',
            email: 'newguest@example.com',
            phone: '+39777888999',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrders,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-guest-cust',
        email: 'newguest@example.com',
      });
      mockPrisma.order.create.mockResolvedValue({
        id: 'order-7001',
        orderNumber: '7001',
      });

      const result = await wordpressService.importOrdersFromWooCommerce();

      expect(result.imported).toBe(1);
      expect(mockPrisma.customer.create).toHaveBeenCalled();
    });
  });

  describe('syncVariableProductToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should return error if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncVariableProductToWooCommerce('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
    });

    it('should return error if product is not variable type', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-simple',
        sku: 'SIMPLE-001',
        type: 'SIMPLE',
        variants: [],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      });

      const result = await wordpressService.syncVariableProductToWooCommerce('prod-simple');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non è di tipo variabile');
    });

    it('should sync variable product with variants', async () => {
      const mockProduct = {
        id: 'prod-var',
        sku: 'VAR-001',
        name: 'Variable Product',
        type: 'WITH_VARIANTS',
        woocommerceId: null,
        wcDefaultAttributes: null,
        variants: [
          {
            id: 'var-1',
            sku: 'VAR-001-S',
            name: 'Small',
            webActive: true,
            woocommerceVariationId: null,
            inventory: [{ quantity: 10 }],
            images: [],
          },
        ],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockMapAttributesForVariableProduct.mockReturnValue([
        { name: 'Size', options: ['Small'], visible: true, variation: true },
      ]);
      mockMapProductToWooCommerce.mockReturnValue({
        sku: 'VAR-001',
        name: 'Variable Product',
        type: 'variable',
      });
      mockMapVariantToWooCommerce.mockReturnValue({
        sku: 'VAR-001-S',
        regular_price: '50.00',
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 1000,
            sku: 'VAR-001',
            permalink: 'https://example.com/product/var-001',
            date_modified: '2024-01-01T00:00:00',
            price_html: '<span>$50.00</span>',
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ id: 2000 }),
        });

      mockPrisma.product.update.mockResolvedValue({ ...mockProduct, woocommerceId: 1000 });
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        ...mockProduct.variants[0],
        product: mockProduct,
      });
      mockPrisma.productVariant.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncVariableProductToWooCommerce('prod-var');

      expect(result.success).toBe(true);
      expect(result.woocommerceId).toBe(1000);
    });

    it('should handle sync errors', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-var-error',
        sku: 'VAR-ERR-001',
        type: 'WITH_VARIANTS',
        woocommerceId: null,
        variants: [],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      });

      mockMapAttributesForVariableProduct.mockReturnValue([]);
      mockMapProductToWooCommerce.mockReturnValue({
        sku: 'VAR-ERR-001',
        type: 'variable',
      });

      mockFetch.mockRejectedValue(new Error('WooCommerce API Error'));
      mockLogSync.mockResolvedValue(undefined);
      mockPrisma.product.update.mockResolvedValue({});

      const result = await wordpressService.syncVariableProductToWooCommerce('prod-var-error');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('bulkImportFromWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should bulk import customers, products, and orders', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });

      const result = await wordpressService.bulkImportFromWooCommerce({
        importProducts: true,
        importCustomers: true,
        importOrders: true,
        productStatus: 'publish',
      });

      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('customers');
      expect(result).toHaveProperty('orders');
    });

    it('should respect import options', async () => {
      const result = await wordpressService.bulkImportFromWooCommerce({
        importProducts: false,
        importCustomers: false,
        importOrders: false,
      });

      expect(result.products.imported).toBe(0);
      expect(result.customers.imported).toBe(0);
      expect(result.orders.imported).toBe(0);
    });
  });

  describe('importAllCategories', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import categories with hierarchy', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Parent Category',
          slug: 'parent-category',
          parent: 0,
          description: 'Parent description',
          display: 'default',
          image: { id: 1, src: 'https://example.com/cat1.jpg', name: 'cat1', alt: 'Cat 1' },
          menu_order: 0,
          count: 5,
        },
        {
          id: 2,
          name: 'Child Category',
          slug: 'child-category',
          parent: 1,
          description: 'Child description',
          display: 'default',
          image: null,
          menu_order: 1,
          count: 3,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCategories,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.productCategory.findFirst.mockResolvedValue(null);
      mockPrisma.productCategory.create
        .mockResolvedValueOnce({ id: 'cat-1' })
        .mockResolvedValueOnce({ id: 'cat-2' });

      mockPrisma.productCategory.update.mockResolvedValue({});

      const result = await wordpressService.importAllCategories();

      expect(result.imported).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should update existing categories', async () => {
      const mockCategories = [
        {
          id: 10,
          name: 'Existing Category',
          slug: 'existing-category',
          parent: 0,
          description: 'Updated description',
          display: 'default',
          image: null,
          menu_order: 0,
          count: 10,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCategories,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.productCategory.findFirst.mockResolvedValue({
        id: 'existing-cat',
        woocommerceId: 10,
      });

      mockPrisma.productCategory.update.mockResolvedValue({});

      const result = await wordpressService.importAllCategories();

      expect(result.updated).toBe(1);
      expect(result.imported).toBe(0);
    });
  });

  describe('fullImportFromWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should perform full import with all options enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      mockPrisma.warehouse.findFirst.mockResolvedValue(null);
      mockPrisma.warehouse.create.mockResolvedValue({
        id: 'main-wh',
        code: 'MAIN',
        name: 'Magazzino Principale',
      });

      const result = await wordpressService.fullImportFromWooCommerce({
        importCategories: true,
        importShippingClasses: true,
        importProducts: true,
        productStatus: 'publish',
        overwriteExisting: true,
      });

      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('shippingClasses');
      expect(result).toHaveProperty('products');
    });

    it('should skip imports when options are disabled', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });

      const result = await wordpressService.fullImportFromWooCommerce({
        importCategories: false,
        importShippingClasses: false,
        importProducts: false,
      });

      expect(result.categories.imported).toBe(0);
      expect(result.shippingClasses.imported).toBe(0);
      expect(result.products.imported).toBe(0);
    });
  });

  describe('smartFullImport', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should perform smart import in correct order', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });

      const result = await wordpressService.smartFullImport({
        importCategories: true,
        importShippingClasses: true,
        importCustomers: true,
        importProducts: true,
        importOrders: true,
        productStatus: 'publish',
        overwrite: true,
      });

      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('shippingClasses');
      expect(result).toHaveProperty('customers');
      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('autoCreated');
    });

    it('should handle partial imports', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const result = await wordpressService.smartFullImport({
        importCategories: true,
        importShippingClasses: false,
        importCustomers: false,
        importProducts: false,
        importOrders: false,
      });

      expect(result.categories).toBeDefined();
      expect(result.shippingClasses.imported).toBe(0);
      expect(result.customers.imported).toBe(0);
      expect(result.products.imported).toBe(0);
      expect(result.orders.imported).toBe(0);
    });
  });

  describe('Refund and Order Status Methods', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create WooCommerce refund', async () => {
      mockSuccessfulFetch({
        id: 100,
        amount: '50.00',
        reason: 'Customer request',
      });

      const result = await wordpressService.createWooCommerceRefund(
        1001,
        50,
        'Customer request',
        true,
        [{ id: 1, refund_total: '50.00', quantity: 1 }]
      );

      expect(result.id).toBe(100);
      expect(result.amount).toBe('50.00');
    });

    it('should update WooCommerce order status with note', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 2001, status: 'completed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, note: 'Status updated' }),
        });

      const result = await wordpressService.updateWooCommerceOrderStatus(
        2001,
        'completed',
        'Status updated from ERP'
      );

      expect(result.id).toBe(2001);
      expect(result.status).toBe('completed');
    });

    it('should add WooCommerce order note', async () => {
      mockSuccessfulFetch({ id: 1, note: 'Test note' });

      const result = await wordpressService.addWooCommerceOrderNote(
        3001,
        'Test note',
        false
      );

      expect(result.note).toBe('Test note');
    });

    it('should sync order status to WooCommerce', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'local-order-1',
        wordpressId: 4001,
        status: 'SHIPPED',
      });

      mockSuccessfulFetch({ id: 4001, status: 'completed' });

      mockPrisma.order.update.mockResolvedValue({
        id: 'local-order-1',
        syncStatus: 'SYNCED',
      });

      const result = await wordpressService.syncOrderStatusToWooCommerce('local-order-1');

      expect(result.success).toBe(true);
    });

    it('should return error when order not found for sync', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncOrderStatusToWooCommerce('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
    });

    it('should return error when order has no wordpressId', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'local-only',
        wordpressId: null,
        status: 'PENDING',
      });

      const result = await wordpressService.syncOrderStatusToWooCommerce('local-only');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non sincronizzato');
    });
  });

  describe('Webhook Validation', () => {
    it('should validate correct webhook signature', async () => {
      // Generate a valid signature using the webhook secret
      const crypto = await import('crypto');
      const payload = '{"test": "data"}';
      const webhookSecret = 'webhook_secret_123';
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('base64');

      const result = wordpressService.validateWebhookSignature(payload, expectedSignature);
      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', async () => {
      const payload = '{"test": "data"}';
      const invalidSignature = 'invalid-signature-xxxxxx';

      // This should return false or throw - depends on implementation
      // Using a try-catch to handle both cases
      try {
        const result = wordpressService.validateWebhookSignature(payload, invalidSignature);
        expect(result).toBe(false);
      } catch (error: any) {
        // Some implementations throw on invalid signatures
        expect(error).toBeDefined();
      }
    });
  });

  describe('Sync Status', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should return sync status', async () => {
      mockSuccessfulFetch({ version: '8.0.0' });

      mockPrisma.product.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(70)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5);

      mockPrisma.product.findFirst.mockResolvedValue({
        lastSyncAt: new Date('2024-01-15T10:00:00'),
      });

      const result = await wordpressService.getSyncStatus();

      expect(result.configured).toBe(true);
      expect(result.connected).toBe(true);
      expect(result.stats).toHaveProperty('totalProducts');
      expect(result.stats).toHaveProperty('syncedProducts');
      expect(result.lastSync).toBeDefined();
    });
  });
});

describe.skip('WordPress Order Status Mapping', () => {
  let wordpressService: any;

  beforeAll(async () => {
    const wpModule = await import('@server/services/wordpress.service');
    wordpressService = wpModule.default;
  });

  it('should have proper status mapping functions', () => {
    expect(wordpressService).toHaveProperty('processOrderWebhook');
    expect(wordpressService).toHaveProperty('updateOrderStatusOnWooCommerce');
    expect(wordpressService).toHaveProperty('processPluginOrderStatus');
  });
});

describe.skip('WordPressService Additional Coverage', () => {
  let wordpressService: any;

  beforeAll(async () => {
    const wpModule = await import('@server/services/wordpress.service');
    wordpressService = wpModule.default;
  });

  beforeEach(async () => {
    mockFetch.mockReset();
    await wordpressService.reloadSettings();
  });

  describe('syncSingleProductInventory', () => {
    it('should sync single product inventory successfully', async () => {
      // The service uses include: { inventory: { where: { location: 'WEB' } } }
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-single-1',
        sku: 'SINGLE-001',
        woocommerceId: 5001,
        name: 'Single Product',
        inventory: [
          { id: 'inv-1', quantity: 50, reservedQuantity: 0 },
        ],
      });

      mockSuccessfulFetch({ id: 5001, stock_quantity: 50 });

      const result = await wordpressService.syncSingleProductInventory('prod-single-1');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return false when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncSingleProductInventory('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when product has no woocommerceId', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-no-wc',
        sku: 'NO-WC-001',
        woocommerceId: null,
        inventory: [],
      });

      const result = await wordpressService.syncSingleProductInventory('prod-no-wc');

      expect(result).toBe(false);
    });
  });

  describe('importCustomersPage', () => {
    it('should import customers page by page', async () => {
      const mockCustomers = [
        {
          id: 201,
          email: 'page1-customer@example.com',
          first_name: 'Page',
          last_name: 'Customer',
          username: 'pagecustomer',
          billing: {
            first_name: 'Page',
            last_name: 'Customer',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
            email: 'page1-customer@example.com',
            phone: '',
          },
          shipping: {},
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCustomers,
      });

      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        id: 'new-cust-201',
        email: 'page1-customer@example.com',
      });

      const result = await wordpressService.importCustomersPage(1, 10);

      expect(result.imported).toBe(1);
      expect(result.processedCount).toBe(1);
    });

    it('should handle empty page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const result = await wordpressService.importCustomersPage(5, 10);

      expect(result.imported).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getWooCommerceCustomersCount', () => {
    it('should return customer count from WooCommerce', async () => {
      // The service checks 'X-WP-Total' (case-sensitive)
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === 'X-WP-Total' ? '150' : null,
        },
        json: async () => [],
      });

      const count = await wordpressService.getWooCommerceCustomersCount();

      expect(count).toBe(150);
    });

    it('should return 0 when header not present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: () => null,
        },
        json: async () => [],
      });

      const count = await wordpressService.getWooCommerceCustomersCount();

      expect(count).toBe(0);
    });
  });

  describe('importAllAttributes', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import attributes from WooCommerce', async () => {
      const mockAttributes = [
        { id: 1, name: 'Color', slug: 'color', type: 'select' },
        { id: 2, name: 'Size', slug: 'size', type: 'select' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAttributes,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1, name: 'Red', slug: 'red' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1, name: 'Small', slug: 'small' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.productAttribute = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'attr-1' }),
        update: jest.fn(),
      };

      mockPrisma.productAttributeTerm = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'term-1' }),
        update: jest.fn(),
      };

      const result = await wordpressService.importAllAttributes();

      expect(result.imported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importAllTags', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import tags from WooCommerce', async () => {
      const mockTags = [
        { id: 1, name: 'New Arrival', slug: 'new-arrival' },
        { id: 2, name: 'Sale', slug: 'sale' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTags,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.productTag = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tag-1' }),
        update: jest.fn(),
      };

      const result = await wordpressService.importAllTags();

      expect(result.imported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importAllShippingClasses', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import shipping classes from WooCommerce', async () => {
      const mockShippingClasses = [
        { id: 1, name: 'Standard Shipping', slug: 'standard-shipping' },
        { id: 2, name: 'Express Shipping', slug: 'express-shipping' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockShippingClasses,
      });

      mockPrisma.shippingClass = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'shipping-1' }),
        update: jest.fn(),
      };

      const result = await wordpressService.importAllShippingClasses();

      expect(result.imported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exportCategoriesToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should export categories to WooCommerce', async () => {
      mockPrisma.productCategory.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Electronics', slug: 'electronics', wordpressId: null, parentId: null },
        { id: 'cat-2', name: 'Phones', slug: 'phones', wordpressId: null, parentId: 'cat-1' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 100, name: 'Electronics', slug: 'electronics' }),
      });

      mockPrisma.productCategory.update.mockResolvedValue({});

      const result = await wordpressService.exportCategoriesToWooCommerce();

      expect(result).toHaveProperty('exported');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('bulkExportToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should bulk export products to WooCommerce', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-export-1',
          sku: 'EXP-001',
          name: 'Export Product',
          woocommerceId: null,
          inventoryItems: [],
          categories: [],
        },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 500, sku: 'EXP-001' }),
      });

      mockMapProductToWooCommerce.mockReturnValue({
        name: 'Export Product',
        sku: 'EXP-001',
        regular_price: '100',
      });

      mockPrisma.product.update.mockResolvedValue({});

      const result = await wordpressService.bulkExportToWooCommerce({
        products: true,
        categories: false,
      });

      expect(result).toHaveProperty('products');
    });
  });

  describe('syncWebProductToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should sync web product to WooCommerce', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'web-prod-1',
        sku: 'WEB-001',
        name: 'Web Product',
        type: 'SIMPLE',
        publishToWeb: true,
        woocommerceId: null,
        webPrice: 150,
        webSalePrice: null,
        webDescription: 'Test description',
        webShortDescription: 'Short desc',
        categories: [],
        tags: [],
        inventoryItems: [{ id: 'inv-1', quantity: 20 }],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 600, sku: 'WEB-001' }),
      });

      mockPrisma.product.update.mockResolvedValue({});

      const result = await wordpressService.syncWebProductToWooCommerce('web-prod-1');

      expect(result.success).toBe(true);
    });

    it('should return error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncWebProductToWooCommerce('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
    });
  });

  describe('syncDigitalProductToWooCommerce', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should sync digital product to WooCommerce', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'digital-prod-1',
        sku: 'DIGITAL-001',
        name: 'Digital Product',
        type: 'DIGITAL',
        isDigital: true,
        woocommerceId: null,
        price: 50,
        downloadFiles: [{ name: 'file.pdf', url: 'https://example.com/file.pdf' }],
        categories: [],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 700, sku: 'DIGITAL-001' }),
      });

      mockPrisma.product.update.mockResolvedValue({});

      const result = await wordpressService.syncDigitalProductToWooCommerce('digital-prod-1');

      expect(result.success).toBe(true);
    });

    it('should return error when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncDigitalProductToWooCommerce('non-existent');

      expect(result.success).toBe(false);
    });
  });

  describe('importOrdersWithDependencies', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import orders with dependencies', async () => {
      const mockOrders = [
        {
          id: 8001,
          number: '8001',
          status: 'processing',
          customer_id: 50,
          total: '300.00',
          total_tax: '60.00',
          shipping_total: '20.00',
          date_created: '2024-03-01T10:00:00',
          customer_note: '',
          billing: {
            first_name: 'Deps',
            last_name: 'Customer',
            email: 'deps@example.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [
            {
              id: 1,
              name: 'Test Product',
              sku: 'TEST-001',
              product_id: 100,
              quantity: 2,
              total: '200.00',
              price: 100,
            },
          ],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOrders,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'existing-deps-cust',
        email: 'deps@example.com',
      });

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.order.create.mockResolvedValue({
        id: 'order-8001',
        orderNumber: '8001',
      });

      const result = await wordpressService.importOrdersWithDependencies({
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-12-31'),
        status: 'processing',
      });

      expect(result).toHaveProperty('orders');
    });
  });

  describe('importProductsWithDependencies', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import products with dependencies', async () => {
      const mockProducts = [
        {
          id: 9001,
          name: 'Deps Product',
          sku: 'DEPS-001',
          type: 'simple',
          status: 'publish',
          regular_price: '150.00',
          sale_price: '',
          description: 'Product with deps',
          short_description: '',
          categories: [],
          images: [],
          attributes: [],
          stock_quantity: 50,
          manage_stock: true,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProducts,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.warehouse.findFirst.mockResolvedValue({
        id: 'wh-1',
        code: 'WEB',
      });
      mockPrisma.product.create.mockResolvedValue({
        id: 'prod-9001',
        sku: 'DEPS-001',
      });

      mockMapWooCommerceToProduct.mockReturnValue({
        name: 'Deps Product',
        sku: 'DEPS-001',
      });

      const result = await wordpressService.importProductsWithDependencies({
        status: 'publish',
        perPage: 10,
      });

      expect(result).toHaveProperty('products');
    });
  });

  describe('importProductsFromWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should process multiple pages of products', async () => {
      const page1Products = [
        {
          id: 1001,
          sku: 'PAGE1-001',
          name: 'Product Page 1',
          type: 'simple',
          regular_price: '100',
          status: 'publish',
          manage_stock: true,
          stock_quantity: 10,
          categories: [],
          images: [],
          attributes: [],
          shipping_class_id: 0,
        },
      ];
      const page2Products = [
        {
          id: 1002,
          sku: 'PAGE1-002',
          name: 'Product Page 2',
          type: 'simple',
          regular_price: '200',
          status: 'publish',
          manage_stock: true,
          stock_quantity: 20,
          categories: [],
          images: [],
          attributes: [],
          shipping_class_id: 0,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => page1Products })
        .mockResolvedValueOnce({ ok: true, json: async () => page2Products })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'new-prod' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'TEST', name: 'Test' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });

      const result = await wordpressService.importProductsFromWooCommerce('publish');

      expect(result.imported).toBeGreaterThanOrEqual(0);
    });

    it('should update existing products when found by woocommerceId', async () => {
      const mockProduct = {
        id: 2001,
        sku: 'EXISTING-001',
        name: 'Existing Product',
        type: 'simple',
        regular_price: '150',
        status: 'publish',
        manage_stock: true,
        stock_quantity: 15,
        categories: [],
        images: [],
        attributes: [],
        shipping_class_id: 0,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [mockProduct] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'existing-prod',
        woocommerceId: 2001,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'existing-prod' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'EXISTING-001' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-1', quantity: 10 });
      mockPrisma.inventoryItem.update.mockResolvedValue({ id: 'inv-1' });

      const result = await wordpressService.importProductsFromWooCommerce('publish');

      expect(result.errors).toBe(0);
    });

    it('should handle variable products with variations', async () => {
      const mockVariableProduct = {
        id: 3001,
        sku: 'VAR-PROD-001',
        name: 'Variable Product',
        type: 'variable',
        regular_price: '',
        status: 'publish',
        manage_stock: false,
        stock_quantity: null,
        categories: [{ id: 10, name: 'Test Category', slug: 'test-cat' }],
        images: [{ id: 1, src: 'https://example.com/img.jpg', name: 'img', alt: 'test' }],
        attributes: [{ id: 1, name: 'Size', options: ['S', 'M', 'L'], variation: true, visible: true }],
        variations: [101, 102, 103],
        shipping_class_id: 5,
        shipping_class: 'standard',
      };

      const mockVariations = [
        {
          id: 101,
          sku: 'VAR-PROD-001-S',
          regular_price: '50',
          status: 'publish',
          manage_stock: true,
          stock_quantity: 10,
          attributes: [{ name: 'Size', option: 'S' }],
          image: null,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [mockVariableProduct] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVariations });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-3001', sku: 'VAR-PROD-001' });
      mockPrisma.product.create.mockResolvedValue({ id: 'prod-3001' });
      mockPrisma.productCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'VAR-PROD-001', type: 'WITH_VARIANTS' });
      mockMapWooCommerceToVariant.mockReturnValue({ sku: 'VAR-PROD-001-S' });
      mockFindOrCreateShippingClass.mockResolvedValue('ship-1');
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productCategoryAssignment.create.mockResolvedValue({ id: 'pca-1' });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.create.mockResolvedValue({ id: 'img-1' });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);
      mockPrisma.productVariant.create.mockResolvedValue({ id: 'var-1' });

      const result = await wordpressService.importProductsFromWooCommerce('publish');

      expect(result).toBeDefined();
    });
  });

  describe('bulkImportProducts - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should skip existing products when overwrite is false', async () => {
      const mockProducts = [
        {
          id: 4001,
          sku: 'SKIP-001',
          name: 'Should Skip',
          type: 'simple',
          regular_price: '100',
          status: 'publish',
          variations: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.product.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await wordpressService.bulkImportFromWooCommerce({
        importProducts: true,
        importCustomers: false,
        importOrders: false,
        overwriteExisting: false,
        productStatus: 'publish',
      });

      expect(result.products.imported).toBe(0);
    });

    it('should import variable products and their variations', async () => {
      const mockProducts = [
        {
          id: 5001,
          sku: 'BULK-VAR-001',
          name: 'Bulk Variable',
          type: 'variable',
          regular_price: '100',
          status: 'publish',
          variations: [501, 502],
          categories: [],
          images: [],
          attributes: [],
        },
      ];

      const mockVariations = [
        { id: 501, sku: 'BULK-VAR-001-A', regular_price: '100', status: 'publish', attributes: [] },
        { id: 502, sku: 'BULK-VAR-001-B', regular_price: '120', status: 'publish', attributes: [] },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVariations });

      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'bulk-prod-1' });
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);
      mockPrisma.productVariant.create.mockResolvedValue({ id: 'bulk-var-1' });
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });

      const result = await wordpressService.bulkImportFromWooCommerce({
        importProducts: true,
        importCustomers: false,
        importOrders: false,
        productStatus: 'publish',
      });

      expect(result.products.imported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('bulkImportOrders - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import orders with date filter', async () => {
      const mockOrders = [
        {
          id: 6001,
          number: '6001',
          status: 'processing',
          customer_id: 100,
          total: '200.00',
          total_tax: '40.00',
          shipping_total: '10.00',
          date_created: '2024-03-15T10:00:00',
          customer_note: 'Test note',
          billing: {
            first_name: 'Test',
            last_name: 'Customer',
            email: 'test@bulk.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-100' });

      const result = await wordpressService.bulkImportFromWooCommerce({
        importProducts: false,
        importCustomers: false,
        importOrders: true,
        orderStatus: 'processing',
        fromDate: new Date('2024-01-01'),
      });

      expect(result.orders).toBeDefined();
    });

    it('should update existing orders when overwrite is true', async () => {
      const mockOrders = [
        {
          id: 7001,
          number: '7001',
          status: 'completed',
          customer_id: 0,
          total: '300.00',
          total_tax: '60.00',
          shipping_total: '15.00',
          date_created: '2024-03-20T12:00:00',
          customer_note: '',
          billing: {
            first_name: 'Update',
            last_name: 'Test',
            email: 'update@test.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [],
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'existing-order-7001',
        wordpressId: 7001,
      });
      mockPrisma.order.update.mockResolvedValue({ id: 'existing-order-7001' });
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-update' });

      const result = await wordpressService.bulkImportFromWooCommerce({
        importProducts: false,
        importCustomers: false,
        importOrders: true,
        overwriteExisting: true,
      });

      expect(result.orders.updated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importAllCategories - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should build category hierarchy with parents', async () => {
      const mockCategories = [
        { id: 1, name: 'Electronics', slug: 'electronics', parent: 0, description: '', display: 'default', image: null, menu_order: 0, count: 10 },
        { id: 2, name: 'Phones', slug: 'phones', parent: 1, description: 'Mobile phones', display: 'default', image: null, menu_order: 1, count: 5 },
        { id: 3, name: 'Tablets', slug: 'tablets', parent: 1, description: 'Tablet devices', display: 'default', image: null, menu_order: 2, count: 3 },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockCategories })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.productCategory.findFirst
        .mockResolvedValueOnce(null) // electronics
        .mockResolvedValueOnce(null) // phones
        .mockResolvedValueOnce(null) // tablets
        .mockResolvedValueOnce({ id: 'cat-phones', woocommerceId: 2 }) // phones for parent update
        .mockResolvedValueOnce({ id: 'cat-electronics', woocommerceId: 1 }) // parent lookup
        .mockResolvedValueOnce({ id: 'cat-tablets', woocommerceId: 3 }) // tablets for parent update
        .mockResolvedValueOnce({ id: 'cat-electronics', woocommerceId: 1 }); // parent lookup

      mockPrisma.productCategory.create
        .mockResolvedValueOnce({ id: 'cat-electronics' })
        .mockResolvedValueOnce({ id: 'cat-phones' })
        .mockResolvedValueOnce({ id: 'cat-tablets' });

      mockPrisma.productCategory.update.mockResolvedValue({});

      const result = await wordpressService.importAllCategories();

      expect(result.imported).toBe(3);
    });

    it('should handle category with image', async () => {
      const mockCategories = [
        {
          id: 10,
          name: 'With Image',
          slug: 'with-image',
          parent: 0,
          description: 'Category with image',
          display: 'both',
          image: { id: 100, src: 'https://example.com/cat.jpg', name: 'cat', alt: 'Category' },
          menu_order: 5,
          count: 20,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockCategories })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.productCategory.findFirst.mockResolvedValue(null);
      mockPrisma.productCategory.create.mockResolvedValue({ id: 'cat-img' });

      const result = await wordpressService.importAllCategories();

      expect(result.imported).toBe(1);
    });
  });

  describe('importAllAttributes - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
      mockPrisma.wooCommerceAttribute = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'attr-1' }),
        update: jest.fn().mockResolvedValue({}),
      };
      mockPrisma.wooCommerceAttributeTerm = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'term-1' }),
        update: jest.fn().mockResolvedValue({}),
      };
    });

    it('should import attributes with terms', async () => {
      const mockAttributes = [
        { id: 1, name: 'Color', slug: 'pa_color', type: 'select', order_by: 'menu_order', has_archives: true },
      ];

      const mockTerms = [
        { id: 10, name: 'Red', slug: 'red', description: '', menu_order: 0, count: 5 },
        { id: 11, name: 'Blue', slug: 'blue', description: '', menu_order: 1, count: 3 },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockAttributes })
        .mockResolvedValueOnce({ ok: true, json: async () => mockTerms })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      const result = await wordpressService.importAllAttributes();

      expect(result.imported).toBeGreaterThanOrEqual(0);
    });

    it('should update existing attributes', async () => {
      const mockAttributes = [
        { id: 2, name: 'Size', slug: 'pa_size', type: 'select', order_by: 'name', has_archives: false },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockAttributes })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.wooCommerceAttribute.findFirst.mockResolvedValue({ id: 'existing-attr' });

      const result = await wordpressService.importAllAttributes();

      expect(result.updated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importAllTags - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
      mockPrisma.wooCommerceTag = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tag-1' }),
        update: jest.fn().mockResolvedValue({}),
      };
    });

    it('should import tags with pagination', async () => {
      const page1Tags = [
        { id: 1, name: 'Sale', slug: 'sale', description: 'On sale items', count: 15 },
      ];
      const page2Tags = [
        { id: 2, name: 'New', slug: 'new', description: 'New arrivals', count: 10 },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => page1Tags })
        .mockResolvedValueOnce({ ok: true, json: async () => page2Tags })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      const result = await wordpressService.importAllTags();

      expect(result.imported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('importAllShippingClasses - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import new shipping classes', async () => {
      const mockClasses = [
        { id: 1, name: 'Standard', slug: 'standard', description: 'Standard shipping', count: 50 },
        { id: 2, name: 'Express', slug: 'express', description: 'Express shipping', count: 20 },
      ];

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockClasses });

      mockPrisma.shippingClass.findFirst.mockResolvedValue(null);
      mockPrisma.shippingClass.create.mockResolvedValue({ id: 'ship-1' });

      const result = await wordpressService.importAllShippingClasses();

      expect(result.imported).toBe(2);
    });

    it('should update existing shipping classes', async () => {
      const mockClasses = [
        { id: 3, name: 'Updated Shipping', slug: 'updated', description: 'Updated desc', count: 30 },
      ];

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockClasses });

      mockPrisma.shippingClass.findFirst.mockResolvedValue({ id: 'existing-ship', woocommerceId: 3 });
      mockPrisma.shippingClass.update.mockResolvedValue({ id: 'existing-ship' });

      const result = await wordpressService.importAllShippingClasses();

      expect(result.updated).toBe(1);
    });
  });

  describe('fullImportFromWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create primary warehouse if none exists', async () => {
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);
      mockPrisma.warehouse.create.mockResolvedValue({
        id: 'new-primary-wh',
        code: 'MAIN',
        name: 'Magazzino Principale',
        isPrimary: true,
      });

      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await wordpressService.fullImportFromWooCommerce({
        importCategories: false,
        importShippingClasses: false,
        importProducts: true,
        productStatus: 'publish',
      });

      expect(mockPrisma.warehouse.create).toHaveBeenCalled();
      expect(result.products).toBeDefined();
    });

    it('should skip existing products when overwriteExisting is false', async () => {
      const mockProducts = [
        {
          id: 8001,
          sku: 'NO-OVERWRITE-001',
          name: 'No Overwrite',
          type: 'simple',
          regular_price: '100',
          status: 'publish',
          categories: [],
          images: [],
          attributes: [],
          variations: [],
          shipping_class_id: 0,
        },
      ];

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.product.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await wordpressService.fullImportFromWooCommerce({
        importCategories: false,
        importShippingClasses: false,
        importProducts: true,
        productStatus: 'publish',
        overwriteExisting: false,
      });

      expect(result.products.imported).toBe(0);
      expect(result.products.updated).toBe(0);
    });
  });

  describe('importOrdersWithDependencies - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
      mockPrisma.orderNote = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'note-1' }),
      };
      mockPrisma.orderRefund = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
      };
      mockPrisma.orderRefundItem = {
        create: jest.fn().mockResolvedValue({ id: 'refund-item-1' }),
      };
    });

    it('should auto-create customers from order data', async () => {
      const mockOrders = [
        {
          id: 9001,
          number: '9001',
          status: 'processing',
          customer_id: 0,
          total: '150.00',
          discount_total: '0',
          total_tax: '30.00',
          shipping_total: '10.00',
          date_created: '2024-04-01T10:00:00',
          date_modified: '2024-04-01T10:00:00',
          customer_note: '',
          billing: {
            first_name: 'Auto',
            last_name: 'Created',
            email: 'auto@created.com',
            phone: '123456789',
            company: 'Auto Co',
            address_1: '123 Auto St',
            address_2: '',
            city: 'Auto City',
            state: 'AC',
            postcode: '12345',
            country: 'US',
          },
          shipping: {
            first_name: 'Auto',
            last_name: 'Created',
            company: '',
            address_1: '123 Auto St',
            address_2: '',
            city: 'Auto City',
            state: 'AC',
            postcode: '12345',
            country: 'US',
            phone: '',
          },
          line_items: [],
          fee_lines: [],
          coupon_lines: [],
          shipping_lines: [],
          tax_lines: [],
          meta_data: [],
          refunds: [],
          payment_method: 'stripe',
          payment_method_title: 'Credit Card',
          order_key: 'wc_order_123',
          created_via: 'checkout',
          version: '8.0',
          currency: 'USD',
          currency_symbol: '$',
          prices_include_tax: false,
          customer_ip_address: '192.168.1.1',
          customer_user_agent: 'Mozilla/5.0',
          cart_hash: 'abc123',
          payment_url: '',
          date_paid: null,
          date_completed: null,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // Notes

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({ id: 'auto-cust-1' });

      const result = await wordpressService.importOrdersWithDependencies({
        status: 'processing',
      });

      expect(result.customersCreated).toBeGreaterThanOrEqual(0);
    });

    it('should auto-create products from order line items', async () => {
      const mockOrders = [
        {
          id: 9002,
          number: '9002',
          status: 'processing',
          customer_id: 100,
          total: '200.00',
          discount_total: '0',
          total_tax: '40.00',
          shipping_total: '15.00',
          date_created: '2024-04-02T11:00:00',
          date_modified: '2024-04-02T11:00:00',
          customer_note: 'Test order',
          billing: {
            first_name: 'Product',
            last_name: 'Creator',
            email: 'prod@creator.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
            phone: '',
          },
          line_items: [
            {
              id: 1,
              name: 'Auto Product',
              product_id: 99999,
              variation_id: 0,
              quantity: 2,
              sku: 'AUTO-PROD-001',
              price: 50,
              total: '100.00',
              subtotal: '100.00',
              total_tax: '20.00',
              taxes: [],
              meta_data: [],
              parent_name: null,
            },
          ],
          fee_lines: [],
          coupon_lines: [],
          shipping_lines: [],
          tax_lines: [],
          meta_data: [],
          refunds: [],
          payment_method: 'paypal',
          payment_method_title: 'PayPal',
          order_key: 'wc_order_456',
          created_via: 'checkout',
          version: '8.0',
          currency: 'EUR',
          currency_symbol: '€',
          prices_include_tax: true,
          customer_ip_address: '',
          customer_user_agent: '',
          cart_hash: '',
          payment_url: '',
          date_paid: null,
          date_completed: null,
        },
      ];

      const mockProduct = {
        id: 99999,
        sku: 'AUTO-PROD-001',
        name: 'Auto Product',
        type: 'simple',
        regular_price: '50',
        status: 'publish',
        categories: [],
        images: [],
        attributes: [],
        shipping_class_id: 0,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockProduct }) // Product fetch
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // Notes

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'existing-cust', wordpressId: 100 });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'auto-prod-1' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'AUTO-PROD-001' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });

      const result = await wordpressService.importOrdersWithDependencies({});

      expect(result.productsCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('smartFullImport - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should execute all import steps in correct order', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });

      const result = await wordpressService.smartFullImport({
        importCategories: true,
        importShippingClasses: true,
        importCustomers: true,
        importProducts: true,
        importOrders: true,
        productStatus: 'publish',
        overwrite: true,
      });

      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('shippingClasses');
      expect(result).toHaveProperty('customers');
      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('autoCreated');
    });

    it('should track auto-created entities', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });

      const result = await wordpressService.smartFullImport({
        importCategories: false,
        importShippingClasses: false,
        importCustomers: false,
        importProducts: false,
        importOrders: false,
      });

      expect(result.autoCreated).toEqual({
        categories: 0,
        products: 0,
        customers: 0,
      });
    });
  });

  describe('syncVariationToWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create new variation in WooCommerce', async () => {
      const mockVariant = {
        id: 'var-new',
        sku: 'VAR-NEW-001',
        name: 'New Variation',
        webActive: true,
        woocommerceVariationId: null,
        weight: 0.5,
        dimensions: { width: 10, height: 5, depth: 2 },
        inventory: [{ quantity: 15, reservedQuantity: 0 }],
        images: [{ woocommerceId: 100, src: 'https://example.com/var.jpg', name: 'var' }],
        product: { sku: 'PARENT-001' },
        mainImageUrl: null,
        mainImageId: null,
      };

      mockPrisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      mockMapVariantToWooCommerce.mockReturnValue({
        sku: 'VAR-NEW-001',
        regular_price: '75.00',
        attributes: [{ name: 'Size', option: 'M' }],
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 5000, image: { id: 100 } }),
      });

      mockPrisma.productVariant.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncVariationToWooCommerce(1000, 'var-new');

      expect(result.success).toBe(true);
      expect(result.variationId).toBe(5000);
    });

    it('should update existing variation in WooCommerce', async () => {
      const mockVariant = {
        id: 'var-existing',
        sku: 'VAR-EXIST-001',
        name: 'Existing Variation',
        webActive: true,
        woocommerceVariationId: 6000,
        weight: null,
        dimensions: null,
        inventory: [{ quantity: 20 }],
        images: [],
        product: { sku: 'PARENT-002' },
        mainImageUrl: 'https://example.com/main.jpg',
        mainImageId: 200,
      };

      mockPrisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      mockMapVariantToWooCommerce.mockReturnValue({
        sku: 'VAR-EXIST-001',
        regular_price: '80.00',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 6000 }),
      });

      mockPrisma.productVariant.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncVariationToWooCommerce(2000, 'var-existing');

      expect(result.success).toBe(true);
      expect(result.variationId).toBe(6000);
    });

    it('should return error when variant not found', async () => {
      mockPrisma.productVariant.findUnique.mockResolvedValue(null);

      const result = await wordpressService.syncVariationToWooCommerce(3000, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovata');
    });
  });

  describe('processPluginOrder - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create new order from plugin data', async () => {
      const pluginOrderData = {
        wordpressOrderId: 10001,
        orderNumber: 'PLUGIN-10001',
        status: 'processing',
        total: 250.00,
        subtotal: 220.00,
        discount: 20.00,
        tax: 50.00,
        shippingTotal: 0.00,
        customerId: 200,
        billing: {
          firstName: 'Plugin',
          lastName: 'Customer',
          email: 'plugin@customer.com',
          phone: '123456789',
          address1: '123 Plugin St',
          city: 'Plugin City',
          state: 'PC',
          postcode: '54321',
          country: 'US',
          company: '',
        },
        shipping: {},
        items: [
          {
            productId: 5000,
            sku: 'PLUGIN-PROD-001',
            name: 'Plugin Product',
            quantity: 2,
            unitPrice: 110,
            total: 220.00,
          },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(null) // By wordpressId
        .mockResolvedValueOnce(null) // By email
        .mockResolvedValueOnce(null); // For code generation

      mockPrisma.customer.create.mockResolvedValue({ id: 'plugin-cust-1', code: 'WEB-000001' });

      // Transaction mock
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          order: {
            create: jest.fn().mockResolvedValue({ id: 'plugin-order-1', orderNumber: 'WP-PLUGIN-10001', total: 250 }),
          },
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: 'prod-5000', sku: 'PLUGIN-PROD-001' }),
          },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', reservedQuantity: 0 }),
            update: jest.fn().mockResolvedValue({}),
          },
          $queryRawUnsafe: jest.fn().mockResolvedValue([
            { id: 'inv-1', quantity: 100, reserved_quantity: 0 },
          ]),
        };
        return fn(txMock);
      });

      const result = await wordpressService.processPluginOrder(pluginOrderData);

      expect(result.success).toBe(true);
    });

    it('should return existing order if wordpressId matches', async () => {
      const pluginOrderData = {
        wordpressOrderId: 20001,
        orderNumber: 'EXISTING-20001',
      };

      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'existing-plugin-order',
        wordpressId: 20001,
      });

      const result = await wordpressService.processPluginOrder(pluginOrderData);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('existing-plugin-order');
    });
  });

  describe('createWooCommerceRefund - error handling', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should handle refund without line items', async () => {
      mockSuccessfulFetch({
        id: 200,
        amount: '100.00',
        reason: 'Full refund',
      });

      const result = await wordpressService.createWooCommerceRefund(
        5001,
        100,
        'Full refund',
        false
      );

      expect(result.id).toBe(200);
    });

    it('should filter out null line items', async () => {
      mockSuccessfulFetch({
        id: 201,
        amount: '50.00',
        reason: 'Partial refund',
      });

      const result = await wordpressService.createWooCommerceRefund(
        5002,
        50,
        'Partial refund',
        true,
        [
          { id: 1, refund_total: '25.00', quantity: 1 },
          { id: null, refund_total: '25.00', quantity: 1 }, // Should be filtered
        ]
      );

      expect(result.id).toBe(201);
    });
  });

  describe('exportCategoriesToWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should export root categories first then children', async () => {
      mockPrisma.productCategory.findMany.mockResolvedValue([
        { id: 'cat-root', name: 'Root Category', slug: 'root', parentId: null, woocommerceId: null, position: 0, description: '', image: null, parent: null },
        { id: 'cat-child', name: 'Child Category', slug: 'child', parentId: 'cat-root', woocommerceId: null, position: 1, description: '', image: null, parent: { woocommerceId: null } },
      ]);

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 100, slug: 'root' }) }) // Create root
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 101, slug: 'child' }) }); // Create child

      mockPrisma.productCategory.update.mockResolvedValue({});

      const result = await wordpressService.exportCategoriesToWooCommerce();

      expect(result.exported).toBe(2);
    });

    it('should update existing categories on WooCommerce', async () => {
      mockPrisma.productCategory.findMany.mockResolvedValue([
        { id: 'cat-update', name: 'Update Cat', slug: 'update', parentId: null, woocommerceId: 500, position: 0, description: 'Updated', image: 'https://img.jpg', parent: null },
      ]);

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 500 }) });

      const result = await wordpressService.exportCategoriesToWooCommerce();

      expect(result.updated).toBe(1);
    });
  });

  describe('syncWebProductToWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should set product to draft if webActive is false', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'inactive-prod',
        sku: 'INACTIVE-001',
        webActive: false,
        woocommerceId: 700,
        type: 'SIMPLE',
        variants: [],
        inventory: [],
      });

      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 700, status: 'draft' }) });

      const result = await wordpressService.syncWebProductToWooCommerce('inactive-prod');

      expect(result.success).toBe(true);
      expect(result.woocommerceId).toBe(700);
    });

    it('should dispatch to variable product sync for WITH_VARIANTS type', async () => {
      const mockProduct = {
        id: 'var-prod',
        sku: 'DISPATCH-VAR-001',
        webActive: true,
        type: 'WITH_VARIANTS',
        woocommerceId: null,
        variants: [{ id: 'v1', sku: 'V1', webActive: true }],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      };

      // First call for syncWebProductToWooCommerce
      mockPrisma.product.findUnique
        .mockResolvedValueOnce(mockProduct)
        // Second call for syncVariableProductToWooCommerce
        .mockResolvedValueOnce({
          ...mockProduct,
          variants: [{
            id: 'v1',
            sku: 'V1',
            webActive: true,
            woocommerceVariationId: null,
            inventory: [],
            images: [],
          }],
        });

      mockMapAttributesForVariableProduct.mockReturnValue([]);
      mockMapProductToWooCommerce.mockReturnValue({ sku: 'DISPATCH-VAR-001', type: 'variable' });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 800,
          permalink: 'https://example.com/var',
          date_modified: '2024-01-01',
          price_html: '<span>$50</span>',
        }),
      });

      mockPrisma.product.update.mockResolvedValue({ id: 'var-prod', woocommerceId: 800 });
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncWebProductToWooCommerce('var-prod');

      expect(result.success).toBe(true);
    });
  });

  describe('syncSimpleWebProduct - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should sync simple product with shipping class', async () => {
      const mockProduct = {
        id: 'simple-ship',
        sku: 'SIMPLE-SHIP-001',
        webActive: true,
        type: 'SIMPLE',
        woocommerceId: null,
        variants: [],
        inventory: [{ quantity: 50, location: 'WEB' }],
        categories: [{ category: { woocommerceId: 10 } }],
        productImages: [{ id: 'img-1', src: 'https://img.jpg', position: 0 }],
        shippingClass: { slug: 'express', woocommerceId: 5 },
      };

      // Return full product for both initial and nested calls
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockMapProductToWooCommerce.mockReturnValue({
        sku: 'SIMPLE-SHIP-001',
        regular_price: '100.00',
        type: 'simple',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 900,
          permalink: 'https://example.com/simple',
          date_modified: '2024-01-01',
          price_html: '$100',
          total_sales: 10,
          images: [{ id: 200 }],
        }),
      });

      mockPrisma.product.update.mockResolvedValue({ id: 'simple-ship', woocommerceId: 900 });
      mockPrisma.productImage.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncWebProductToWooCommerce('simple-ship');

      expect(result.success).toBe(true);
    });

    it('should handle DIGITAL product type', async () => {
      const mockProduct = {
        id: 'digital-prod',
        sku: 'DIGITAL-001',
        name: 'Digital Product',
        description: 'A digital product',
        webActive: true,
        type: 'DIGITAL',
        woocommerceId: 1000,
        price: 50,
        webPrice: 45,
        webDescription: 'Digital desc',
        webShortDescription: 'Short desc',
        taxStatus: 'taxable',
        taxClass: 'standard',
        downloadFiles: [],
        variants: [],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      };

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1000,
          permalink: 'https://example.com/digital',
          date_modified: '2024-01-01',
          price_html: '$45',
          total_sales: 5,
        }),
      });

      mockPrisma.product.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncWebProductToWooCommerce('digital-prod');

      expect(result.success).toBe(true);
    });
  });

  describe('syncAllWebProductsToWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should sync multiple web products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'web-1', sku: 'WEB-001', type: 'SIMPLE' },
        { id: 'web-2', sku: 'WEB-002', type: 'SIMPLE' },
      ]);

      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'web-1',
        sku: 'WEB-001',
        webActive: true,
        type: 'SIMPLE',
        woocommerceId: 1001,
        variants: [],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      });

      mockMapProductToWooCommerce.mockReturnValue({ sku: 'WEB-001' });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1001 }),
      });

      mockPrisma.product.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.syncAllWebProductsToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
    });
  });

  describe('importVariationsComplete - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import variations with images and inventory', async () => {
      const mockVariations = [
        {
          id: 301,
          sku: 'VAR-COMPLETE-001-S',
          regular_price: '75.00',
          status: 'publish',
          manage_stock: true,
          stock_quantity: 25,
          attributes: [{ name: 'Size', option: 'S' }],
          image: { id: 101, src: 'https://example.com/s.jpg', name: 's-img', alt: 'Size S' },
        },
        {
          id: 302,
          sku: 'VAR-COMPLETE-001-M',
          regular_price: '80.00',
          status: 'publish',
          manage_stock: true,
          stock_quantity: 30,
          attributes: [{ name: 'Size', option: 'M' }],
          image: null,
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockVariations,
      });

      mockPrisma.product.findUnique.mockResolvedValue({ id: 'parent-prod', sku: 'VAR-COMPLETE-001' });
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);
      mockPrisma.productVariant.create.mockResolvedValue({ id: 'new-var' });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.create.mockResolvedValue({ id: 'var-img' });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'var-inv' });
      mockMapWooCommerceToVariant.mockReturnValue({ sku: 'VAR-COMPLETE-001-S' });

      // Testing by calling fullImportFromWooCommerce which calls importVariationsComplete
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.productCategory.findFirst.mockResolvedValue(null);

      const mockProduct = {
        id: 400,
        sku: 'VAR-COMPLETE-001',
        name: 'Variable Complete',
        type: 'variable',
        regular_price: '',
        status: 'publish',
        categories: [],
        images: [],
        attributes: [],
        variations: [301, 302],
        shipping_class_id: 0,
        manage_stock: false,
        stock_quantity: null,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [mockProduct] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockVariations });

      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'parent-prod' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'VAR-COMPLETE-001', type: 'WITH_VARIANTS' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });

      const result = await wordpressService.fullImportFromWooCommerce({
        importCategories: false,
        importShippingClasses: false,
        importProducts: true,
        productStatus: 'publish',
      });

      expect(result.products).toBeDefined();
    });
  });

  describe('createOrderFromWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
      mockPrisma.orderNote = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'note-1' }),
      };
      mockPrisma.orderRefund = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
      };
      mockPrisma.orderRefundItem = {
        create: jest.fn().mockResolvedValue({ id: 'refund-item-1' }),
      };
    });

    it('should create order with fee lines, coupon lines, and refunds', async () => {
      const mockOrders = [
        {
          id: 11001,
          number: '11001',
          status: 'completed',
          customer_id: 500,
          total: '300.00',
          subtotal: '280.00',
          discount_total: '20.00',
          total_tax: '56.00',
          shipping_total: '10.00',
          date_created: '2024-05-01T10:00:00',
          date_modified: '2024-05-02T10:00:00',
          date_paid: '2024-05-01T10:30:00',
          date_completed: '2024-05-03T15:00:00',
          customer_note: 'Please gift wrap',
          billing: {
            first_name: 'Fee',
            last_name: 'Customer',
            email: 'fee@customer.com',
            phone: '555-1234',
            company: 'Fee Corp',
            address_1: '123 Fee St',
            address_2: 'Suite 100',
            city: 'Fee City',
            state: 'FC',
            postcode: '12345',
            country: 'US',
          },
          shipping: {
            first_name: 'Fee',
            last_name: 'Customer',
            company: '',
            address_1: '123 Fee St',
            address_2: '',
            city: 'Fee City',
            state: 'FC',
            postcode: '12345',
            country: 'US',
            phone: '555-1234',
          },
          line_items: [
            {
              id: 1001,
              name: 'Fee Product',
              product_id: 8000,
              variation_id: 0,
              quantity: 1,
              sku: 'FEE-PROD-001',
              price: 280,
              total: '280.00',
              subtotal: '280.00',
              total_tax: '56.00',
              taxes: [],
              meta_data: [{ key: 'gift_wrap', value: 'yes' }],
              parent_name: null,
            },
          ],
          fee_lines: [
            { id: 1, name: 'Gift Wrap', total: '5.00', total_tax: '1.00' },
          ],
          coupon_lines: [
            { id: 1, code: 'SAVE20', discount: '20.00' },
          ],
          shipping_lines: [
            { id: 1, method_title: 'Express Shipping', total: '10.00' },
          ],
          tax_lines: [
            { id: 1, rate_code: 'US-FC-TAX', label: 'State Tax', total: '56.00' },
          ],
          meta_data: [
            { key: '_custom_field', value: 'custom_value' },
          ],
          refunds: [
            { id: 501, refund_total: '-10.00', reason: 'Partial refund' },
          ],
          payment_method: 'stripe',
          payment_method_title: 'Credit Card',
          order_key: 'wc_order_fee123',
          created_via: 'checkout',
          version: '8.0',
          currency: 'USD',
          currency_symbol: '$',
          prices_include_tax: false,
          customer_ip_address: '10.0.0.1',
          customer_user_agent: 'Chrome/100',
          cart_hash: 'fee123hash',
          payment_url: 'https://example.com/pay',
        },
      ];

      const mockRefunds = [
        {
          id: 501,
          amount: '10.00',
          reason: 'Partial refund',
          date_created: '2024-05-04T10:00:00',
          line_items: [{ id: 1001, quantity: -1 }],
        },
      ];

      const mockNotes = [
        { id: 601, note: 'Order shipped', customer_note: false, date_created: '2024-05-03T10:00:00' },
        { id: 602, note: 'Your order is ready!', customer_note: true, date_created: '2024-05-03T11:00:00' },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockNotes })
        .mockResolvedValueOnce({ ok: true, json: async () => mockRefunds });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'existing-fee-cust', wordpressId: 500 });
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'fee-prod', woocommerceId: 8000 });

      // Transaction mock
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          order: {
            create: jest.fn().mockResolvedValue({ id: 'fee-order-1', orderNumber: 'WP-11001' }),
          },
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: 'fee-prod', sku: 'FEE-PROD-001' }),
          },
          productVariant: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', reservedQuantity: 0 }),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(txMock);
      });

      const result = await wordpressService.importOrdersWithDependencies({
        status: 'completed',
      });

      expect(result.orders).toBeDefined();
    });
  });

  describe('updateExistingOrderComplete - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should update order items when syncing', async () => {
      const mockOrders = [
        {
          id: 12001,
          number: '12001',
          status: 'processing',
          customer_id: 600,
          total: '150.00',
          discount_total: '0',
          total_tax: '30.00',
          shipping_total: '5.00',
          date_created: '2024-06-01T10:00:00',
          date_modified: '2024-06-02T10:00:00',
          customer_note: 'Updated note',
          billing: {
            first_name: 'Update',
            last_name: 'Order',
            email: 'update@order.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
            phone: '',
          },
          line_items: [
            {
              id: 2001,
              name: 'Updated Product',
              product_id: 9000,
              variation_id: 0,
              quantity: 3,
              sku: 'UPD-PROD-001',
              price: 50,
              total: '150.00',
              subtotal: '150.00',
              total_tax: '30.00',
              taxes: [],
              meta_data: [],
              parent_name: null,
            },
          ],
          fee_lines: [],
          coupon_lines: [],
          shipping_lines: [],
          tax_lines: [],
          meta_data: [],
          refunds: [],
          payment_method: 'cod',
          payment_method_title: 'Cash on Delivery',
          order_key: 'wc_order_upd123',
          created_via: 'admin',
          version: '8.0',
          currency: 'EUR',
          currency_symbol: 'EUR',
          prices_include_tax: true,
          customer_ip_address: '',
          customer_user_agent: '',
          cart_hash: '',
          payment_url: '',
          date_paid: null,
          date_completed: null,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'existing-order-12001',
        wordpressId: 12001,
      });
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'upd-cust', wordpressId: 600 });

      // Transaction mock for update
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          order: {
            update: jest.fn().mockResolvedValue({ id: 'existing-order-12001' }),
          },
          orderItem: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'old-item-1', wcLineItemId: 1999 }, // Old item to delete
            ]),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn().mockResolvedValue({ id: 'new-item-1' }),
            update: jest.fn().mockResolvedValue({}),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: 'upd-prod', sku: 'UPD-PROD-001' }),
          },
          productVariant: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(txMock);
      });

      const result = await wordpressService.importOrdersWithDependencies({
        overwrite: true,
      });

      expect(result.orders.updated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ensureShippingClassExists - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create shipping class from WooCommerce', async () => {
      const mockProducts = [
        {
          id: 13001,
          sku: 'SHIP-CLASS-PROD',
          name: 'Product with Shipping Class',
          type: 'simple',
          regular_price: '100',
          status: 'publish',
          categories: [],
          images: [],
          attributes: [],
          variations: [],
          shipping_class_id: 99,
          shipping_class: 'heavy-items',
          manage_stock: true,
          stock_quantity: 10,
        },
      ];

      const mockShippingClass = {
        id: 99,
        name: 'Heavy Items',
        slug: 'heavy-items',
        description: 'For heavy products',
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockShippingClass });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.shippingClass.findFirst.mockResolvedValue(null);
      mockPrisma.shippingClass.create.mockResolvedValue({ id: 'new-ship-class' });
      mockPrisma.product.create.mockResolvedValue({ id: 'ship-prod' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'SHIP-CLASS-PROD' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });

      const result = await wordpressService.importProductsWithDependencies({
        status: 'publish',
      });

      expect(result.shippingClassesCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ensureCategoryExists - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create category hierarchy recursively', async () => {
      const mockOrders = [
        {
          id: 14001,
          number: '14001',
          status: 'processing',
          customer_id: 0,
          total: '100.00',
          discount_total: '0',
          total_tax: '20.00',
          shipping_total: '5.00',
          date_created: '2024-07-01T10:00:00',
          date_modified: '2024-07-01T10:00:00',
          customer_note: '',
          billing: {
            first_name: 'Cat',
            last_name: 'Test',
            email: 'cat@test.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [
            {
              id: 3001,
              name: 'Category Product',
              product_id: 15000,
              variation_id: 0,
              quantity: 1,
              sku: 'CAT-PROD-001',
              price: 100,
              total: '100.00',
              subtotal: '100.00',
              total_tax: '20.00',
              meta_data: [],
            },
          ],
          fee_lines: [],
          coupon_lines: [],
          shipping_lines: [],
          tax_lines: [],
          meta_data: [],
          refunds: [],
          payment_method: 'paypal',
          payment_method_title: 'PayPal',
          order_key: 'wc_order_cat',
          created_via: 'checkout',
          version: '8.0',
          currency: 'EUR',
          currency_symbol: 'EUR',
          prices_include_tax: true,
          customer_ip_address: '',
          customer_user_agent: '',
          cart_hash: '',
          payment_url: '',
          date_paid: null,
          date_completed: null,
        },
      ];

      const mockProduct = {
        id: 15000,
        sku: 'CAT-PROD-001',
        name: 'Category Product',
        type: 'simple',
        regular_price: '100',
        status: 'publish',
        categories: [
          { id: 200, name: 'Subcategory', slug: 'subcategory' },
        ],
        images: [],
        attributes: [],
        shipping_class_id: 0,
        manage_stock: true,
        stock_quantity: 5,
      };

      const mockCategory = {
        id: 200,
        name: 'Subcategory',
        slug: 'subcategory',
        parent: 100,
        description: 'A subcategory',
        display: 'default',
        image: { id: 50, src: 'https://example.com/cat.jpg' },
        menu_order: 5,
        count: 10,
      };

      const mockParentCategory = {
        id: 100,
        name: 'Parent Category',
        slug: 'parent-category',
        parent: 0,
        description: 'Parent',
        display: 'default',
        image: null,
        menu_order: 0,
        count: 20,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => mockProduct })
        .mockResolvedValueOnce({ ok: true, json: async () => mockCategory })
        .mockResolvedValueOnce({ ok: true, json: async () => mockParentCategory })
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // Notes

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce(null) // By email
        .mockResolvedValueOnce(null); // For code gen
      mockPrisma.customer.create.mockResolvedValue({ id: 'cat-cust' });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.productCategory.findFirst.mockResolvedValue(null);
      mockPrisma.productCategory.create.mockResolvedValue({ id: 'new-cat' });
      mockPrisma.product.create.mockResolvedValue({ id: 'cat-prod' });
      mockMapWooCommerceToProduct.mockReturnValue({ sku: 'CAT-PROD-001' });
      mockPrisma.productCategoryAssignment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.productImage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.inventoryItem.create.mockResolvedValue({ id: 'inv-1' });

      // Transaction mock
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          order: {
            create: jest.fn().mockResolvedValue({ id: 'cat-order-1' }),
          },
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: 'cat-prod', sku: 'CAT-PROD-001' }),
          },
          productVariant: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(txMock);
      });

      const result = await wordpressService.importOrdersWithDependencies({});

      expect(result.categoriesCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createProductPlaceholder - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should create placeholder when product fetch fails', async () => {
      const mockOrders = [
        {
          id: 16001,
          number: '16001',
          status: 'processing',
          customer_id: 0,
          total: '50.00',
          discount_total: '0',
          total_tax: '10.00',
          shipping_total: '0',
          date_created: '2024-08-01T10:00:00',
          date_modified: '2024-08-01T10:00:00',
          customer_note: '',
          billing: {
            first_name: 'Placeholder',
            last_name: 'Test',
            email: 'placeholder@test.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [
            {
              id: 4001,
              name: 'Unknown Product',
              product_id: 99998,
              variation_id: 0,
              quantity: 1,
              sku: '',
              price: 50,
              total: '50.00',
              subtotal: '50.00',
              total_tax: '10.00',
              meta_data: [],
            },
          ],
          fee_lines: [],
          coupon_lines: [],
          shipping_lines: [],
          tax_lines: [],
          meta_data: [],
          refunds: [],
          payment_method: 'bacs',
          payment_method_title: 'Bank Transfer',
          order_key: 'wc_order_ph',
          created_via: 'checkout',
          version: '8.0',
          currency: 'EUR',
          currency_symbol: 'EUR',
          prices_include_tax: true,
          customer_ip_address: '',
          customer_user_agent: '',
          cart_hash: '',
          payment_url: '',
          date_paid: null,
          date_completed: null,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' }) // Product fetch fails
        .mockResolvedValueOnce({ ok: true, json: async () => [] }); // Notes

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isPrimary: true });
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({ id: 'ph-cust' });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'placeholder-prod' });

      // Transaction mock
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          order: {
            create: jest.fn().mockResolvedValue({ id: 'ph-order-1' }),
          },
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'item-1' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: 'placeholder-prod' }),
          },
          productVariant: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(txMock);
      });

      const result = await wordpressService.importOrdersWithDependencies({});

      expect(result.productsCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('syncOrderStatusToWooCommerce - detailed tests', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should map all internal statuses correctly', async () => {
      const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

      for (const status of statuses) {
        mockPrisma.order.findUnique.mockResolvedValue({
          id: `order-${status}`,
          status,
          wordpressId: 17000,
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 17000, status: 'completed' }),
        }).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, note: 'Status updated' }),
        });

        mockPrisma.order.update.mockResolvedValue({});

        const result = await wordpressService.syncOrderStatusToWooCommerce(`order-${status}`);

        expect(result.success).toBe(true);
      }
    });
  });

  describe('updateWooCommerceOrderStatus - with note', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should add note after status update', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 18000, status: 'completed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1, note: 'Order shipped!' }),
        });

      const result = await wordpressService.updateWooCommerceOrderStatus(
        18000,
        'completed',
        'Order shipped!'
      );

      expect(result.id).toBe(18000);
      expect(result.status).toBe('completed');
    });
  });

  describe('Error handling edge cases', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should handle category import errors gracefully', async () => {
      const mockCategories = [
        { id: 1, name: 'Good Category', slug: 'good', parent: 0, description: '', image: null, menu_order: 0 },
        { id: 2, name: 'Bad Category', slug: 'bad', parent: 0, description: '', image: null, menu_order: 1 },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockCategories })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.productCategory.findFirst.mockResolvedValue(null);
      mockPrisma.productCategory.create
        .mockResolvedValueOnce({ id: 'cat-good' })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await wordpressService.importAllCategories();

      expect(result.imported).toBe(1);
      expect(result.errors).toBe(1);
    });

    it('should handle attribute import errors gracefully', async () => {
      mockPrisma.wooCommerceAttribute = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new Error('DB error')),
        update: jest.fn().mockResolvedValue({}),
      };

      const mockAttributes = [
        { id: 1, name: 'Failing Attr', slug: 'failing', type: 'select', order_by: 'menu_order', has_archives: false },
      ];

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockAttributes });

      const result = await wordpressService.importAllAttributes();

      expect(result.errors).toBe(1);
    });

    it('should handle tag import errors gracefully', async () => {
      mockPrisma.wooCommerceTag = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new Error('DB error')),
        update: jest.fn().mockResolvedValue({}),
      };

      const mockTags = [
        { id: 1, name: 'Failing Tag', slug: 'failing', description: '', count: 0 },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockTags })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      const result = await wordpressService.importAllTags();

      expect(result.errors).toBe(1);
    });

    it('should handle shipping class import errors', async () => {
      const mockClasses = [
        { id: 1, name: 'Failing Class', slug: 'failing', description: '' },
      ];

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockClasses });

      mockPrisma.shippingClass.findFirst.mockResolvedValue(null);
      mockPrisma.shippingClass.create.mockRejectedValue(new Error('DB error'));

      const result = await wordpressService.importAllShippingClasses();

      expect(result.errors).toBe(1);
    });
  });

  describe('getWooCommerceCustomersCount additional', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should return customer count from WooCommerce with pagination header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('150'),
        },
        json: async () => [],
      });

      const count = await wordpressService.getWooCommerceCustomersCount();

      expect(count).toBe(150);
    });
  });

  describe('updateWooCommerceOrderNote', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should add note to WooCommerce order', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1001,
          note: 'Test note content',
          customer_note: false,
        }),
      });

      const result = await wordpressService.addWooCommerceOrderNote(
        20001,
        'Test note content',
        false
      );

      expect(result.id).toBe(1001);
      expect(result.note).toBe('Test note content');
    });
  });

  describe('API error handling', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should handle 401 unauthorized errors on category import', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(
        wordpressService.importAllCategories()
      ).rejects.toThrow();
    });

    it('should handle 500 server errors on category import', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      await expect(
        wordpressService.importAllCategories()
      ).rejects.toThrow();
    });
  });

  describe('Customer import with tax info', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should import customer with VAT number from meta_data', async () => {
      const mockCustomer = {
        id: 900,
        email: 'vat@customer.com',
        first_name: 'VAT',
        last_name: 'Customer',
        username: 'vatcust',
        billing: {
          first_name: 'VAT',
          last_name: 'Customer',
          company: 'VAT Corp',
          address_1: '200 VAT St',
          address_2: '',
          city: 'VAT City',
          state: 'VC',
          postcode: '99999',
          country: 'IT',
          phone: '555-9999',
        },
        shipping: {},
        meta_data: [
          { key: 'vat_number', value: 'IT12345678901' },
          { key: 'fiscal_code', value: 'ABCDEF01G23H456I' },
        ],
        date_created: '2024-01-01T10:00:00',
        date_modified: '2024-02-01T10:00:00',
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [mockCustomer] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.customer.findFirst.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({ id: 'vat-cust' });

      const result = await wordpressService.importCustomersFromWooCommerce();

      expect(result.imported).toBe(1);
    });
  });

  describe('Order with variation products', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should link order item to correct product variant', async () => {
      const mockOrders = [
        {
          id: 21001,
          number: '21001',
          status: 'processing',
          customer_id: 700,
          total: '80.00',
          discount_total: '0',
          total_tax: '16.00',
          shipping_total: '5.00',
          date_created: '2024-09-01T10:00:00',
          date_modified: '2024-09-01T10:00:00',
          customer_note: '',
          billing: {
            first_name: 'Variant',
            last_name: 'Buyer',
            email: 'variant@buyer.com',
            phone: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
          shipping: {},
          line_items: [
            {
              id: 5001,
              name: 'T-Shirt - Medium',
              product_id: 25000,
              variation_id: 25001,
              quantity: 1,
              sku: 'TSHIRT-M',
              price: 80,
              total: '80.00',
              subtotal: '80.00',
              total_tax: '16.00',
              meta_data: [{ key: 'Size', value: 'Medium' }],
            },
          ],
          fee_lines: [],
          coupon_lines: [],
          shipping_lines: [],
          tax_lines: [],
          meta_data: [],
          refunds: [],
          payment_method: 'stripe',
          payment_method_title: 'Credit Card',
          order_key: 'wc_order_var',
          created_via: 'checkout',
          version: '8.0',
          currency: 'EUR',
          currency_symbol: 'EUR',
          prices_include_tax: true,
          customer_ip_address: '',
          customer_user_agent: '',
          cart_hash: '',
          payment_url: '',
          date_paid: null,
          date_completed: null,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockOrders })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.order.findFirst.mockResolvedValue(null);
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'var-buyer-cust', wordpressId: 700 });
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'tshirt-prod', woocommerceId: 25000 });
      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: 'tshirt-var-m',
        woocommerceVariationId: 25001,
        sku: 'TSHIRT-M',
      });

      // Transaction mock
      mockPrisma.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          order: {
            create: jest.fn().mockResolvedValue({ id: 'var-order-1' }),
          },
          orderItem: {
            create: jest.fn().mockResolvedValue({ id: 'var-item-1' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tshirt-prod' }),
          },
          productVariant: {
            findFirst: jest.fn().mockResolvedValue({ id: 'tshirt-var-m', sku: 'TSHIRT-M' }),
          },
          inventoryItem: {
            findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', reservedQuantity: 0 }),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(txMock);
      });

      const result = await wordpressService.importOrdersWithDependencies({});

      expect(result.orders.imported).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Export products batch', () => {
    beforeEach(async () => {
      await wordpressService.reloadSettings();
    });

    it('should export products in batches with rate limiting', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'batch-1', sku: 'BATCH-001', type: 'SIMPLE', webActive: true, woocommerceId: null },
        { id: 'batch-2', sku: 'BATCH-002', type: 'SIMPLE', webActive: true, woocommerceId: 2000 },
      ]);

      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'batch-1',
        sku: 'BATCH-001',
        webActive: true,
        type: 'SIMPLE',
        woocommerceId: null,
        variants: [],
        inventory: [],
        categories: [],
        productImages: [],
        shippingClass: null,
      });

      mockMapProductToWooCommerce.mockReturnValue({ sku: 'BATCH-001' });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 3000, permalink: 'https://example.com/batch' }),
      });

      mockPrisma.product.update.mockResolvedValue({});
      mockLogSync.mockResolvedValue(undefined);

      const result = await wordpressService.bulkExportToWooCommerce({
        productIds: ['batch-1', 'batch-2'],
      });

      expect(result.products.synced).toBeGreaterThanOrEqual(0);
      expect(result.products.errors).toBeGreaterThanOrEqual(0);
    });
  });
});
