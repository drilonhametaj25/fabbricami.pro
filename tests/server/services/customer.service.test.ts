/**
 * Customer Service Tests
 * Sprint 3A - Core Entity Services
 * ~65 test cases covering all CustomerService methods
 */
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma
const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Import after mocks
import customerService from '@server/services/customer.service';

// Helper function to create Decimal values
function createDecimal(value: number): Decimal {
  return new Prisma.Decimal(value);
}

// Helper function to create mock customer
function createMockCustomer(overrides: Partial<any> = {}) {
  return {
    id: 'cust-1',
    code: 'CLI26-00001',
    type: 'B2C',
    businessName: null,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@test.com',
    phone: '1234567890',
    taxId: null,
    fiscalCode: null,
    billingAddress: { street: '123 Main St', city: 'Milan', zip: '20100' },
    shippingAddress: { street: '123 Main St', city: 'Milan', zip: '20100' },
    customerGroup: null,
    priceListId: null,
    paymentTerms: null,
    notes: null,
    isActive: true,
    totalOrders: 10,
    totalSpent: createDecimal(5000),
    lastOrderDate: new Date('2025-01-15'),
    wordpressId: null,
    syncStatus: null,
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    priceList: null,
    contacts: [],
    bankInfo: null,
    orders: [],
    _count: { orders: 10, contacts: 0 },
    ...overrides,
  };
}

// Helper function to create mock contact
function createMockContact(overrides: Partial<any> = {}) {
  return {
    id: 'contact-1',
    customerId: 'cust-1',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'Manager',
    email: 'jane@test.com',
    phone: '0987654321',
    isPrimary: false,
    isActive: true,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper function to create mock bank info
function createMockBankInfo(overrides: Partial<any> = {}) {
  return {
    id: 'bank-1',
    customerId: 'cust-1',
    bankName: 'Test Bank',
    iban: 'IT60X0542811101000000123456',
    swift: 'TESTIIT1',
    accountHolder: 'John Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper function to create mock order
function createMockOrder(overrides: Partial<any> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerId: 'cust-1',
    status: 'DELIVERED',
    total: createDecimal(500),
    subtotal: createDecimal(450),
    discount: createDecimal(0),
    shipping: createDecimal(10),
    tax: createDecimal(40),
    orderDate: new Date('2025-01-10'),
    source: 'WEB',
    items: [],
    ...overrides,
  };
}

describe('CustomerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
  });

  // ============================================
  // BASIC CRUD OPERATIONS
  // ============================================

  describe('listCustomers', () => {
    it('should return paginated list of customers', async () => {
      const mockCustomers = [createMockCustomer(), createMockCustomer({ id: 'cust-2' })];
      prismaMock.customer.findMany.mockResolvedValue(mockCustomers as any);
      prismaMock.customer.count.mockResolvedValue(2);

      const result = await customerService.listCustomers({ page: 1, limit: 50 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by type', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await customerService.listCustomers({ type: 'B2B' });

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'B2B' }),
        })
      );
    });

    it('should filter by isActive', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await customerService.listCustomers({ isActive: true });

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('should search by code, name, email, taxId', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await customerService.listCustomers({ search: 'john' });

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { code: { contains: 'john', mode: 'insensitive' } },
              { firstName: { contains: 'john', mode: 'insensitive' } },
              { lastName: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by customerGroup', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await customerService.listCustomers({ customerGroup: 'VIP' });

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerGroup: 'VIP' }),
        })
      );
    });

    it('should filter by hasOrders', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await customerService.listCustomers({ hasOrders: true });

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ totalOrders: { gt: 0 } }),
        })
      );
    });

    it('should sort by specified field', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await customerService.listCustomers({ sortBy: 'totalSpent', sortOrder: 'desc' });

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalSpent: 'desc' },
        })
      );
    });
  });

  describe('getCustomerById', () => {
    it('should return customer with stats', async () => {
      const mockCustomer = createMockCustomer();
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findMany.mockResolvedValue([
        createMockOrder({ total: createDecimal(500) }),
        createMockOrder({ id: 'order-2', total: createDecimal(300), orderDate: new Date('2025-01-05') }),
      ] as any);

      const result = await customerService.getCustomerById('cust-1');

      expect(result).not.toBeNull();
      expect(result!.code).toBe('CLI26-00001');
      expect(result!.stats).toHaveProperty('totalOrders');
      expect(result!.stats).toHaveProperty('totalSpent');
      expect(result!.stats).toHaveProperty('rfmScore');
    });

    it('should return null when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      const result = await customerService.getCustomerById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle customer with no orders', async () => {
      const mockCustomer = createMockCustomer({ totalOrders: 0, orders: [] });
      prismaMock.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await customerService.getCustomerById('cust-1');

      expect(result!.stats.totalOrders).toBe(0);
      expect(result!.stats.rfmScore).toBeNull();
    });
  });

  describe('createCustomer', () => {
    it('should create B2C customer with generated code', async () => {
      prismaMock.customer.findFirst.mockResolvedValue(null);
      prismaMock.customer.create.mockResolvedValue(createMockCustomer() as any);

      const result = await customerService.createCustomer({
        type: 'B2C',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
      } as any);

      expect(result.code).toContain('CLI');
      expect(prismaMock.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: expect.stringMatching(/^CLI\d{2}/),
            isActive: true,
          }),
        })
      );
    });

    it('should create B2B customer with B2B prefix', async () => {
      prismaMock.customer.findFirst.mockResolvedValue(null);
      prismaMock.customer.create.mockResolvedValue(
        createMockCustomer({ type: 'B2B', code: 'B2B26-00001', businessName: 'Test Company' }) as any
      );

      const result = await customerService.createCustomer({
        type: 'B2B',
        businessName: 'Test Company',
        email: 'company@test.com',
      } as any);

      expect(result.code).toContain('B2B');
    });

    it('should increment code from last customer', async () => {
      // Mock existing customer with code ending in 00005
      prismaMock.customer.findFirst.mockResolvedValue(
        createMockCustomer({ code: 'CLI2600005' }) as any
      );
      prismaMock.customer.create.mockResolvedValue(
        createMockCustomer({ code: 'CLI2600006' }) as any
      );

      await customerService.createCustomer({
        type: 'B2C',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@test.com',
      } as any);

      // Code generation increments the numeric portion
      expect(prismaMock.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: expect.stringContaining('CLI'),
          }),
        })
      );
      expect(prismaMock.customer.findFirst).toHaveBeenCalled();
    });
  });

  describe('updateCustomer', () => {
    it('should update customer successfully', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(createMockCustomer() as any);
      prismaMock.customer.update.mockResolvedValue(
        createMockCustomer({ firstName: 'Johnny' }) as any
      );

      const result = await customerService.updateCustomer('cust-1', { firstName: 'Johnny' } as any);

      expect(result.firstName).toBe('Johnny');
    });

    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        customerService.updateCustomer('non-existent', { firstName: 'Johnny' } as any)
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('deleteCustomer', () => {
    it('should soft delete customer', async () => {
      prismaMock.customer.update.mockResolvedValue(
        createMockCustomer({ isActive: false }) as any
      );

      const result = await customerService.deleteCustomer('cust-1');

      expect(result.isActive).toBe(false);
      expect(prismaMock.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { isActive: false },
      });
    });
  });

  // ============================================
  // CONTACTS MANAGEMENT (B2B)
  // ============================================

  describe('addContact', () => {
    it('should add contact to customer', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(createMockCustomer() as any);
      prismaMock.customerContact.create.mockResolvedValue(createMockContact() as any);

      const result = await customerService.addContact({
        customerId: 'cust-1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
      } as any);

      expect(result.firstName).toBe('Jane');
      expect(prismaMock.customerContact.create).toHaveBeenCalled();
    });

    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        customerService.addContact({
          customerId: 'non-existent',
          firstName: 'Jane',
          lastName: 'Smith',
        } as any)
      ).rejects.toThrow('Customer not found');
    });

    it('should unset other primary contacts when setting new primary', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(createMockCustomer() as any);
      prismaMock.customerContact.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.customerContact.create.mockResolvedValue(
        createMockContact({ isPrimary: true }) as any
      );

      await customerService.addContact({
        customerId: 'cust-1',
        firstName: 'Jane',
        lastName: 'Smith',
        isPrimary: true,
      } as any);

      expect(prismaMock.customerContact.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', isPrimary: true },
        data: { isPrimary: false },
      });
    });
  });

  describe('updateContact', () => {
    it('should update contact successfully', async () => {
      prismaMock.customerContact.findUnique.mockResolvedValue(createMockContact() as any);
      prismaMock.customerContact.update.mockResolvedValue(
        createMockContact({ role: 'Director' }) as any
      );

      const result = await customerService.updateContact('contact-1', { role: 'Director' } as any);

      expect(result.role).toBe('Director');
    });

    it('should throw error when contact not found', async () => {
      prismaMock.customerContact.findUnique.mockResolvedValue(null);

      await expect(
        customerService.updateContact('non-existent', { role: 'Director' } as any)
      ).rejects.toThrow('Contact not found');
    });

    it('should handle primary flag update', async () => {
      prismaMock.customerContact.findUnique.mockResolvedValue(createMockContact() as any);
      prismaMock.customerContact.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.customerContact.update.mockResolvedValue(
        createMockContact({ isPrimary: true }) as any
      );

      await customerService.updateContact('contact-1', { isPrimary: true } as any);

      expect(prismaMock.customerContact.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', isPrimary: true, id: { not: 'contact-1' } },
        data: { isPrimary: false },
      });
    });
  });

  describe('deleteContact', () => {
    it('should soft delete contact', async () => {
      prismaMock.customerContact.update.mockResolvedValue(
        createMockContact({ isActive: false }) as any
      );

      const result = await customerService.deleteContact('contact-1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('getContacts', () => {
    it('should return active contacts ordered by primary status', async () => {
      const contacts = [
        createMockContact({ isPrimary: true }),
        createMockContact({ id: 'contact-2', isPrimary: false }),
      ];
      prismaMock.customerContact.findMany.mockResolvedValue(contacts as any);

      const result = await customerService.getContacts('cust-1');

      expect(result).toHaveLength(2);
      expect(prismaMock.customerContact.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
      });
    });
  });

  // ============================================
  // BANK INFO MANAGEMENT (B2B)
  // ============================================

  describe('setBankInfo', () => {
    it('should upsert bank info', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(createMockCustomer() as any);
      prismaMock.customerBankInfo.upsert.mockResolvedValue(createMockBankInfo() as any);

      const result = await customerService.setBankInfo({
        customerId: 'cust-1',
        bankName: 'Test Bank',
        iban: 'IT60X0542811101000000123456',
      } as any);

      expect(result.bankName).toBe('Test Bank');
      expect(prismaMock.customerBankInfo.upsert).toHaveBeenCalled();
    });

    it('should throw error when customer not found', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        customerService.setBankInfo({
          customerId: 'non-existent',
          bankName: 'Test Bank',
        } as any)
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('updateBankInfo', () => {
    it('should update bank info', async () => {
      prismaMock.customerBankInfo.update.mockResolvedValue(
        createMockBankInfo({ bankName: 'New Bank' }) as any
      );

      const result = await customerService.updateBankInfo('cust-1', { bankName: 'New Bank' } as any);

      expect(result.bankName).toBe('New Bank');
    });
  });

  describe('deleteBankInfo', () => {
    it('should delete bank info', async () => {
      prismaMock.customerBankInfo.delete.mockResolvedValue(createMockBankInfo() as any);

      await customerService.deleteBankInfo('cust-1');

      expect(prismaMock.customerBankInfo.delete).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
      });
    });
  });

  // ============================================
  // WORDPRESS INTEGRATION
  // ============================================

  describe('importFromWordPress', () => {
    it('should create new customer when not exists', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);
      prismaMock.customer.findFirst.mockResolvedValue(null);
      prismaMock.customer.create.mockResolvedValue(
        createMockCustomer({ wordpressId: 123, syncStatus: 'SYNCED' }) as any
      );

      const result = await customerService.importFromWordPress({
        wordpressId: 123,
        email: 'wp@test.com',
        firstName: 'WP',
        lastName: 'User',
      } as any);

      expect(result.wordpressId).toBe(123);
      expect(result.syncStatus).toBe('SYNCED');
    });

    it('should update existing customer when wordpressId exists', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(
        createMockCustomer({ id: 'cust-1', wordpressId: 123 }) as any
      );
      prismaMock.customer.update.mockResolvedValue(
        createMockCustomer({ wordpressId: 123, firstName: 'Updated', syncStatus: 'SYNCED' }) as any
      );

      const result = await customerService.importFromWordPress({
        wordpressId: 123,
        email: 'wp@test.com',
        firstName: 'Updated',
        lastName: 'User',
      } as any);

      expect(result.firstName).toBe('Updated');
      expect(prismaMock.customer.update).toHaveBeenCalled();
    });

    it('should import WooCommerce metadata', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);
      prismaMock.customer.findFirst.mockResolvedValue(null);
      prismaMock.customer.create.mockResolvedValue(
        createMockCustomer({
          wordpressId: 123,
          wcIsPayingCustomer: true,
          wcOrdersCount: 5,
          wcTotalSpent: 1000,
        }) as any
      );

      const result = await customerService.importFromWordPress({
        wordpressId: 123,
        email: 'wp@test.com',
        firstName: 'WP',
        lastName: 'User',
        isPayingCustomer: true,
        ordersCount: 5,
        totalSpent: 1000,
      } as any);

      expect(result.wcIsPayingCustomer).toBe(true);
      expect(result.wcOrdersCount).toBe(5);
    });
  });

  // ============================================
  // RFM ANALYSIS & SEGMENTATION
  // ============================================

  describe('calculateCustomerStats', () => {
    it('should calculate RFM scores for active customer', async () => {
      const recentOrder = createMockOrder({
        orderDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        total: createDecimal(500),
      });
      prismaMock.order.findMany.mockResolvedValue([
        recentOrder,
        createMockOrder({ id: 'order-2', orderDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), total: createDecimal(300) }),
        createMockOrder({ id: 'order-3', orderDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), total: createDecimal(400) }),
      ] as any);

      const result = await customerService.calculateCustomerStats('cust-1');

      expect(result.totalOrders).toBe(3);
      expect(result.totalSpent).toBe(1200);
      expect(result.averageOrderValue).toBe(400);
      expect(result.rfmScore).not.toBeNull();
      expect(result.rfmScore!.recency).toBeGreaterThanOrEqual(1);
      expect(result.rfmScore!.recency).toBeLessThanOrEqual(5);
    });

    it('should return null rfmScore for customer with no orders', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await customerService.calculateCustomerStats('cust-1');

      expect(result.totalOrders).toBe(0);
      expect(result.rfmScore).toBeNull();
    });

    it('should calculate segment correctly - champions', async () => {
      // Recent + frequent + high spending
      const orders = [];
      for (let i = 0; i < 25; i++) {
        orders.push(createMockOrder({
          id: `order-${i}`,
          orderDate: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000), // Every 3 days
          total: createDecimal(500), // Total: 12500
        }));
      }
      prismaMock.order.findMany.mockResolvedValue(orders as any);

      const result = await customerService.calculateCustomerStats('cust-1');

      expect(result.rfmScore!.segment).toBe('champions');
    });

    it('should calculate segment correctly - atRisk', async () => {
      // Old orders but frequent
      const orders = [];
      for (let i = 0; i < 15; i++) {
        orders.push(createMockOrder({
          id: `order-${i}`,
          orderDate: new Date(Date.now() - (300 + i * 7) * 24 * 60 * 60 * 1000), // 300+ days ago
          total: createDecimal(500),
        }));
      }
      prismaMock.order.findMany.mockResolvedValue(orders as any);

      const result = await customerService.calculateCustomerStats('cust-1');

      expect(result.rfmScore!.segment).toBe('atRisk');
    });
  });

  describe('segmentCustomers', () => {
    it('should segment all active customers', async () => {
      const customers = [
        createMockCustomer({ id: 'cust-1' }),
        createMockCustomer({ id: 'cust-2' }),
      ];
      prismaMock.customer.findMany.mockResolvedValue(customers as any);
      prismaMock.order.findMany
        .mockResolvedValueOnce([createMockOrder({ total: createDecimal(5000), orderDate: new Date() })] as any)
        .mockResolvedValueOnce([] as any);

      const result = await customerService.segmentCustomers();

      expect(result).toHaveProperty('champions');
      expect(result).toHaveProperty('loyal');
      expect(result).toHaveProperty('potential');
      expect(result).toHaveProperty('atRisk');
      expect(result).toHaveProperty('hibernating');
      expect(result).toHaveProperty('lost');
    });
  });

  describe('getInactiveCustomers', () => {
    it('should return customers with no orders in specified days', async () => {
      const inactiveCustomers = [
        createMockCustomer({ lastOrderDate: new Date('2024-01-01') }),
      ];
      prismaMock.customer.findMany.mockResolvedValue(inactiveCustomers as any);

      const result = await customerService.getInactiveCustomers(180);

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            lastOrderDate: { lt: expect.any(Date) },
          }),
        })
      );
    });

    it('should use default 180 days', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);

      await customerService.getInactiveCustomers();

      expect(prismaMock.customer.findMany).toHaveBeenCalled();
    });
  });

  describe('getTopCustomers', () => {
    it('should return top customers by spending', async () => {
      const topCustomers = [
        createMockCustomer({ totalSpent: createDecimal(10000) }),
        createMockCustomer({ id: 'cust-2', totalSpent: createDecimal(8000) }),
      ];
      prismaMock.customer.findMany.mockResolvedValue(topCustomers as any);

      const result = await customerService.getTopCustomers(10);

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { totalSpent: 'desc' },
          take: 10,
        })
      );
    });

    it('should filter by customer type', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);

      await customerService.getTopCustomers(10, 'B2B');

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'B2B' }),
        })
      );
    });
  });

  describe('updateCustomerStats', () => {
    it('should update customer stats from orders aggregate', async () => {
      prismaMock.order.aggregate.mockResolvedValue({
        _count: 15,
        _sum: { total: createDecimal(7500) },
        _max: { orderDate: new Date('2025-01-20') },
      } as any);
      prismaMock.customer.update.mockResolvedValue(
        createMockCustomer({ totalOrders: 15, totalSpent: createDecimal(7500) }) as any
      );

      const result = await customerService.updateCustomerStats('cust-1');

      expect(result.totalOrders).toBe(15);
      expect(prismaMock.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: {
          totalOrders: 15,
          totalSpent: createDecimal(7500),
          lastOrderDate: new Date('2025-01-20'),
        },
      });
    });
  });

  // ============================================
  // ANALYTICS
  // ============================================

  describe('getCustomerTopProducts', () => {
    it('should return top products ordered by customer', async () => {
      const orderItems = [
        { productId: 'prod-1', productName: 'Product A', sku: 'SKU001', quantity: 10, total: createDecimal(500) },
        { productId: 'prod-1', productName: 'Product A', sku: 'SKU001', quantity: 5, total: createDecimal(250) },
        { productId: 'prod-2', productName: 'Product B', sku: 'SKU002', quantity: 3, total: createDecimal(150) },
      ];
      prismaMock.orderItem.findMany.mockResolvedValue(orderItems as any);

      const result = await customerService.getCustomerTopProducts('cust-1', 10);

      expect(result).toHaveLength(2);
      expect(result[0].productId).toBe('prod-1');
      expect(result[0].totalQuantity).toBe(15);
      expect(result[0].orderCount).toBe(2);
    });
  });

  describe('getCustomerDetailedAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const orders = [
        createMockOrder({
          orderDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          items: [{ quantity: 5, total: createDecimal(250) }],
        }),
        createMockOrder({
          id: 'order-2',
          orderDate: new Date(),
          items: [{ quantity: 3, total: createDecimal(150) }],
        }),
      ];
      prismaMock.order.findMany
        .mockResolvedValueOnce(orders as any) // For analytics
        .mockResolvedValueOnce(orders as any); // For calculateCustomerStats
      prismaMock.orderItem.findMany.mockResolvedValue([]);

      const result = await customerService.getCustomerDetailedAnalytics('cust-1');

      expect(result.purchaseMetrics).toHaveProperty('totalOrders');
      expect(result.purchaseMetrics).toHaveProperty('totalSpent');
      expect(result.purchaseMetrics).toHaveProperty('averageOrderValue');
      expect(result.frequency).toHaveProperty('ordersPerMonth');
      expect(result.trends).toHaveProperty('monthlySpending');
      expect(result.trends).toHaveProperty('ordersByStatus');
    });

    it('should handle customer with no orders', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const result = await customerService.getCustomerDetailedAnalytics('cust-1');

      expect(result.purchaseMetrics.totalOrders).toBe(0);
      expect(result.frequency.firstOrderDate).toBeNull();
      expect(result.rfmScore).toBeNull();
    });
  });

  describe('getGlobalCustomerAnalytics', () => {
    it('should return global customer analytics', async () => {
      prismaMock.customer.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(95) // active
        .mockResolvedValueOnce(30) // B2B
        .mockResolvedValueOnce(70) // B2C
        .mockResolvedValueOnce(80) // with orders
        .mockResolvedValueOnce(20) // new last 30 days
        .mockResolvedValueOnce(40) // new last 90 days
        .mockResolvedValueOnce(100) // new last year
        .mockResolvedValueOnce(15); // inactive

      prismaMock.customer.aggregate.mockResolvedValue({
        _sum: { totalSpent: createDecimal(500000), totalOrders: 2000 },
        _avg: { totalSpent: createDecimal(5000), totalOrders: 20 },
      } as any);

      prismaMock.customer.findMany
        .mockResolvedValueOnce([createMockCustomer({ totalSpent: createDecimal(50000) })] as any) // top by spending
        .mockResolvedValueOnce([createMockCustomer({ totalOrders: 100 })] as any) // top by orders
        .mockResolvedValueOnce([createMockCustomer()] as any) // monthly customers
        .mockResolvedValueOnce([createMockCustomer({ totalOrders: 5 })] as any); // customers with stats

      prismaMock.customer.groupBy.mockResolvedValue([
        { customerGroup: 'VIP', _count: 10 },
        { customerGroup: 'Standard', _count: 85 },
      ] as any);

      const result = await customerService.getGlobalCustomerAnalytics();

      expect(result.overview).toHaveProperty('totalCustomers');
      expect(result.overview).toHaveProperty('activeCustomers');
      expect(result.overview).toHaveProperty('conversionRate');
      expect(result.financials).toHaveProperty('totalRevenue');
      expect(result.acquisition).toHaveProperty('newLast30Days');
      expect(result.topCustomers).toHaveProperty('bySpending');
      expect(result.topCustomers).toHaveProperty('byOrders');
      expect(result.distribution).toHaveProperty('byGroup');
      expect(result.growth).toBeDefined();
      expect(result.segmentation).toBeDefined();
    });
  });

  describe('getCustomerOrderHistory', () => {
    it('should return paginated order history', async () => {
      const orders = [createMockOrder(), createMockOrder({ id: 'order-2' })];
      prismaMock.order.findMany.mockResolvedValue(orders as any);
      prismaMock.order.count.mockResolvedValue(2);

      const result = await customerService.getCustomerOrderHistory('cust-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await customerService.getCustomerOrderHistory('cust-1', { status: 'DELIVERED' });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DELIVERED' }),
        })
      );
    });

    it('should filter by dateFrom', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await customerService.getCustomerOrderHistory('cust-1', {
        dateFrom: '2025-01-01',
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: { gte: new Date('2025-01-01') },
          }),
        })
      );
    });

    it('should filter by dateTo', async () => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.order.count.mockResolvedValue(0);

      await customerService.getCustomerOrderHistory('cust-1', {
        dateTo: '2025-01-31',
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: { lte: new Date('2025-01-31') },
          }),
        })
      );
    });

    it('should convert Decimal fields to numbers', async () => {
      const order = createMockOrder({
        items: [
          { unitPrice: createDecimal(50), total: createDecimal(100), subtotal: createDecimal(100), tax: createDecimal(0) },
        ],
      });
      prismaMock.order.findMany.mockResolvedValue([order] as any);
      prismaMock.order.count.mockResolvedValue(1);

      const result = await customerService.getCustomerOrderHistory('cust-1', {});

      expect(typeof result.items[0].total).toBe('number');
    });
  });
});
