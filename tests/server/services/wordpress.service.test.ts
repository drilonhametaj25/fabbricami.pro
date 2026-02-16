/**
 * WordPress Service Tests
 * Tests for WordPress/WooCommerce integration - Core functionality
 */

// Mock logger before imports
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock environment config
jest.mock('@server/config/environment', () => ({
  config: {
    wordpress: {
      apiUrl: '',
      consumerKey: '',
      consumerSecret: '',
      webhookSecret: 'webhook_secret_123',
    },
  },
}));

// Mock notification service
jest.mock('@server/services/notification.service', () => ({
  default: {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock wordpress settings service
jest.mock('@server/services/wordpress-settings.service', () => ({
  default: {
    getSettings: jest.fn().mockResolvedValue({
      apiUrl: '',
      consumerKey: '',
      consumerSecret: '',
      webhookSecret: 'webhook_secret_123',
      syncEnabled: true,
    }),
  },
}));

// Mock wordpress sync helpers
jest.mock('@server/services/wordpress-sync.helpers', () => ({
  mapProductToWooCommerce: jest.fn(),
  mapVariantToWooCommerce: jest.fn(),
  mapAttributesForVariableProduct: jest.fn(),
  mapWooCommerceToProduct: jest.fn(),
  mapWooCommerceToVariant: jest.fn(),
  logSync: jest.fn(),
  findOrCreateShippingClass: jest.fn().mockResolvedValue(''),
}));

// Mock Prisma
jest.mock('@server/config/database', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    productVariant: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([]),
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
      createMany: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    wordpressSyncLog: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    productCategory: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    wpCategory: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    wpAttribute: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    wpAttributeTerm: {
      upsert: jest.fn(),
    },
    wpTag: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    wpShippingClass: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    warehouse: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((fn) => fn({
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
      orderItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    })),
  },
}));

// Need to use dynamic import since the module has side effects
let wordpressService: any;
let prisma: any;

describe('WordPressService', () => {
  beforeAll(async () => {
    // Import after mocks are set up
    const wpModule = await import('@server/services/wordpress.service');
    wordpressService = wpModule.default;
    const dbModule = await import('@server/config/database');
    prisma = dbModule.prisma;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return false when API credentials are not set', () => {
      const result = wordpressService.isConfigured();
      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return not configured when credentials missing', async () => {
      const result = await wordpressService.healthCheck();

      expect(result.connected).toBe(false);
      expect(result.error).toContain('non configurato');
    });
  });

  describe('syncProductToWooCommerce', () => {
    it('should return error when product not found', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await wordpressService.syncProductToWooCommerce('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
    });
  });

  describe('syncInventoryToWooCommerce', () => {
    it('should return results with empty product list', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      const result = await wordpressService.syncInventoryToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result.synced).toBe(0);
    });
  });

  describe('processOrderWebhook - basic validation', () => {
    it('should skip orders already imported', async () => {
      const wooOrder = {
        id: 456,
        number: 'WOO-456',
        status: 'processing',
        billing: { email: 'test@test.com' },
        line_items: [],
      };

      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-order',
        wordpressId: 456,
      });

      const result = await wordpressService.processOrderWebhook(wooOrder);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('existing-order');
    });
  });

  describe('updateOrderStatusOnWooCommerce', () => {
    it('should return false when order not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await wordpressService.updateOrderStatusOnWooCommerce('non-existent', 'completed');

      expect(result).toBe(false);
    });

    it('should return false when order has no WordPress ID', async () => {
      const mockOrder = {
        id: 'order-1',
        wordpressId: null,
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await wordpressService.updateOrderStatusOnWooCommerce('order-1', 'completed');

      expect(result).toBe(false);
    });
  });

  describe('processPluginOrder - basic validation', () => {
    it('should skip orders already imported', async () => {
      const orderData = {
        order_id: 789,
        order_number: 'PLUGIN-789',
      };

      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
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

      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        wordpressId: 123,
        status: 'PENDING',
      });

      (prisma.order.update as jest.Mock).mockResolvedValue({
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

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

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

      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue({
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

      (prisma.customer.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-cust-1',
        email: 'existing@customer.com',
      });

      (prisma.customer.update as jest.Mock).mockResolvedValue({
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
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      const result = await wordpressService.syncAllProductsToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(result.synced).toBe(0);
    });
  });

  describe('syncAllWebProductsToWooCommerce', () => {
    it('should return results when no web products exist', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      const result = await wordpressService.syncAllWebProductsToWooCommerce();

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(result.synced).toBe(0);
    });
  });

  describe('getImportPreview', () => {
    it('should return preview with counts', async () => {
      (prisma.product.count as jest.Mock).mockResolvedValue(10);
      (prisma.customer.count as jest.Mock).mockResolvedValue(5);
      (prisma.order.count as jest.Mock).mockResolvedValue(20);

      const result = await wordpressService.getImportPreview();

      // Result has erp and woocommerce sections
      expect(result).toHaveProperty('erp');
      expect(result).toHaveProperty('woocommerce');
      expect(result.erp).toHaveProperty('products');
      expect(result.erp).toHaveProperty('customers');
      expect(result.erp.products).toBe(10);
    });
  });
});

describe('WordPress Order Status Mapping', () => {
  let wordpressService: any;

  beforeAll(async () => {
    const wpModule = await import('@server/services/wordpress.service');
    wordpressService = wpModule.default;
  });

  // Test the order status mapping logic
  it('should have proper status mapping functions', () => {
    // Verify the service has the expected structure
    expect(wordpressService).toHaveProperty('processOrderWebhook');
    expect(wordpressService).toHaveProperty('updateOrderStatusOnWooCommerce');
    expect(wordpressService).toHaveProperty('processPluginOrderStatus');
  });
});
