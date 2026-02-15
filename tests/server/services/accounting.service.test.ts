/**
 * Accounting Service Tests
 * Comprehensive tests for accounting, invoices, payment plans, and financial forecasting
 */

import { prismaMock, createDecimal } from '../__mocks__/prisma';

// Mock prisma
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
jest.mock('@server/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Transaction mock
prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));

// Import after mocks
import accountingService from '@server/services/accounting.service';

// Helper functions
const createMockInvoice = (overrides: any = {}) => ({
  id: 'inv-1',
  invoiceNumber: 'FT2026/00001',
  type: 'SALE',
  customerId: 'cust-1',
  orderId: 'order-1',
  issueDate: new Date('2026-01-15'),
  dueDate: new Date('2026-02-15'),
  subtotal: createDecimal(1000),
  tax: createDecimal(220),
  total: createDecimal(1220),
  paidAmount: createDecimal(0),
  status: 'ISSUED',
  customer: { id: 'cust-1', code: 'C001', businessName: 'Test Customer', firstName: null, lastName: null },
  order: { id: 'order-1', orderNumber: 'ORD-001' },
  payments: [],
  ...overrides,
});

const createMockPaymentDue = (overrides: any = {}) => ({
  id: 'pd-1',
  type: 'RECEIVABLE',
  invoiceId: 'inv-1',
  customerId: 'cust-1',
  supplierId: null,
  description: 'Invoice payment',
  amount: createDecimal(1000),
  paidAmount: createDecimal(0),
  dueDate: new Date('2026-02-15'),
  status: 'PENDING',
  paymentMethod: null,
  customer: { id: 'cust-1', code: 'C001', businessName: 'Test Customer' },
  supplier: null,
  invoice: { id: 'inv-1', invoiceNumber: 'FT2026/00001' },
  payments: [],
  ...overrides,
});

const createMockPaymentPlan = (overrides: any = {}) => ({
  id: 'pp-1',
  code: 'PP30',
  name: '30 giorni',
  description: 'Pagamento a 30 giorni',
  isDefault: false,
  isActive: true,
  installments: [
    { id: 'inst-1', sequence: 1, percentage: createDecimal(100), daysFromInvoice: 30 },
  ],
  ...overrides,
});

describe('AccountingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // INVOICE METHODS
  // ============================================

  describe('listInvoices', () => {
    it('should return paginated invoices list', async () => {
      const mockInvoices = [createMockInvoice()];
      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);
      prismaMock.invoice.count.mockResolvedValue(1);

      const result = await accountingService.listInvoices({ page: 1, limit: 50 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by type', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.invoice.count.mockResolvedValue(0);

      await accountingService.listInvoices({ type: 'SALE' });

      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'SALE' }),
        })
      );
    });

    it('should filter by date range', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.invoice.count.mockResolvedValue(0);

      await accountingService.listInvoices({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });

      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('getInvoiceById', () => {
    it('should return invoice with details', async () => {
      const mockInvoice = createMockInvoice({ payments: [] });
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      const result = await accountingService.getInvoiceById('inv-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('inv-1');
      expect(prismaMock.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
        })
      );
    });

    it('should return null for non-existent invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      const result = await accountingService.getInvoiceById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createInvoiceFromOrder', () => {
    it('should create invoice from delivered order', async () => {
      const mockOrder = {
        id: 'order-1',
        customerId: 'cust-1',
        status: 'DELIVERED',
        subtotal: createDecimal(1000),
        tax: createDecimal(220),
        total: createDecimal(1220),
        customer: { paymentTerms: 30 },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);
      prismaMock.invoice.findFirst.mockResolvedValue(null); // For number generation
      prismaMock.invoice.create.mockResolvedValue(createMockInvoice() as any);

      const result = await accountingService.createInvoiceFromOrder('order-1');

      expect(result).toBeDefined();
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SALE',
            customerId: 'cust-1',
            orderId: 'order-1',
            status: 'ISSUED',
          }),
        })
      );
    });

    it('should throw error for non-existent order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(accountingService.createInvoiceFromOrder('non-existent'))
        .rejects.toThrow('Order not found');
    });

    it('should throw error for non-delivered order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PROCESSING',
        customer: {},
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder as any);

      await expect(accountingService.createInvoiceFromOrder('order-1'))
        .rejects.toThrow('Cannot invoice order in status PROCESSING');
    });
  });

  describe('createInvoice', () => {
    it('should create manual invoice', async () => {
      prismaMock.invoice.findFirst.mockResolvedValue(null);
      prismaMock.invoice.create.mockResolvedValue(createMockInvoice() as any);

      const result = await accountingService.createInvoice({
        type: 'SALE',
        customerId: 'cust-1',
        issueDate: '2026-01-15',
        subtotal: 1000,
        tax: 220,
        total: 1220,
      } as any);

      expect(result).toBeDefined();
      expect(prismaMock.invoice.create).toHaveBeenCalled();
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice', async () => {
      const updatedInvoice = createMockInvoice({ status: 'PARTIALLY_PAID' });
      prismaMock.invoice.update.mockResolvedValue(updatedInvoice as any);

      const result = await accountingService.updateInvoice('inv-1', { status: 'PARTIALLY_PAID' } as any);

      expect(result.status).toBe('PARTIALLY_PAID');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
        })
      );
    });
  });

  describe('recordPayment', () => {
    it('should record payment and update invoice status', async () => {
      const mockInvoice = createMockInvoice();
      const mockPayment = { id: 'pay-1', amount: createDecimal(500) };
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      // Mock the transaction to simulate the internal operations
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
            findMany: jest.fn().mockResolvedValue([{ amount: createDecimal(500) }]),
          },
          invoice: {
            update: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'PARTIALLY_PAID' }),
          },
        };
        return fn(tx);
      });

      const result = await accountingService.recordPayment({
        invoiceId: 'inv-1',
        amount: 500,
        method: 'BONIFICO',
        paidAt: '2026-01-20',
      } as any);

      expect(result).toBeDefined();
      expect(result.id).toBe('pay-1');
    });

    it('should throw error for non-existent invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      await expect(accountingService.recordPayment({
        invoiceId: 'non-existent',
        amount: 500,
        method: 'BONIFICO',
      } as any)).rejects.toThrow('Invoice not found');
    });

    it('should mark invoice as PAID when fully paid', async () => {
      const mockInvoice = createMockInvoice({ total: createDecimal(1000) });
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      let updateCalledWithPaid = false;
      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue({ id: 'pay-1', amount: createDecimal(1000) }),
            findMany: jest.fn().mockResolvedValue([{ amount: createDecimal(1000) }]),
          },
          invoice: {
            update: jest.fn().mockImplementation((args: any) => {
              if (args.data.status === 'PAID') {
                updateCalledWithPaid = true;
              }
              return { ...mockInvoice, status: 'PAID' };
            }),
          },
        };
        return fn(tx);
      });

      await accountingService.recordPayment({
        invoiceId: 'inv-1',
        amount: 1000,
        method: 'BONIFICO',
      } as any);

      expect(updateCalledWithPaid).toBe(true);
    });
  });

  // ============================================
  // RECEIVABLES & PAYABLES
  // ============================================

  describe('getReceivables', () => {
    it('should return receivables with remaining amounts', async () => {
      const mockInvoices = [
        createMockInvoice({
          status: 'ISSUED',
          total: createDecimal(1000),
          payments: [{ amount: createDecimal(200) }],
        }),
      ];

      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);

      const result = await accountingService.getReceivables({});

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].remainingAmount).toBe(800);
    });

    it('should filter overdue receivables', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await accountingService.getReceivables({ overdue: true });

      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });
  });

  describe('getPayables', () => {
    it('should return payables with remaining amounts', async () => {
      const mockInvoices = [
        createMockInvoice({
          type: 'PURCHASE',
          status: 'ISSUED',
          total: createDecimal(2000),
          payments: [{ amount: createDecimal(1000) }],
        }),
      ];

      prismaMock.invoice.findMany.mockResolvedValue(mockInvoices as any);

      const result = await accountingService.getPayables({});

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].remainingAmount).toBe(1000);
    });
  });

  // ============================================
  // OVERHEAD COSTS
  // ============================================

  describe('getOverheadCosts', () => {
    it('should return overhead costs for year', async () => {
      const mockCosts = [
        { id: 'oc-1', category: 'RENT', description: 'Office rent', amount: createDecimal(2000) },
      ];
      prismaMock.overheadCost.findMany.mockResolvedValue(mockCosts as any);

      const result = await accountingService.getOverheadCosts(2026);

      expect(Array.isArray(result)).toBe(true);
      expect(prismaMock.overheadCost.findMany).toHaveBeenCalled();
    });

    it('should filter by month', async () => {
      prismaMock.overheadCost.findMany.mockResolvedValue([]);

      await accountingService.getOverheadCosts(2026, 1);

      expect(prismaMock.overheadCost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: expect.objectContaining({ gte: expect.any(Date) }),
            endDate: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        })
      );
    });
  });

  describe('createOverheadCost', () => {
    it('should create overhead cost', async () => {
      const mockCost = {
        id: 'oc-1',
        category: 'UTILITIES',
        description: 'Electricity',
        amount: createDecimal(500),
      };
      prismaMock.overheadCost.create.mockResolvedValue(mockCost as any);

      const result = await accountingService.createOverheadCost({
        category: 'UTILITIES',
        name: 'Electricity',
        amount: 500,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        frequency: 'MONTHLY',
        allocationMethod: 'PRODUCTION_VOLUME',
      } as any);

      expect(result).toBeDefined();
      expect(prismaMock.overheadCost.create).toHaveBeenCalled();
    });
  });

  describe('allocateOverheadCosts', () => {
    it('should allocate costs based on labor hours', async () => {
      const mockCosts = [
        { amount: createDecimal(1000) },
      ];
      const mockOrders = [
        {
          items: [
            {
              productId: 'prod-1',
              quantity: 10,
              product: {
                sku: 'SKU001',
                name: 'Product 1',
                operations: [{ setupTime: 0, standardTime: 60 }],
              },
            },
          ],
        },
      ];

      prismaMock.overheadCost.findMany.mockResolvedValue(mockCosts as any);
      prismaMock.order.findMany.mockResolvedValue(mockOrders as any);

      const result = await accountingService.allocateOverheadCosts(2026, 1, 'LABOR_HOURS');

      expect(result).toHaveProperty('totalOverhead');
      expect(result).toHaveProperty('allocations');
    });

    it('should return empty allocations when no overhead', async () => {
      prismaMock.overheadCost.findMany.mockResolvedValue([]);

      const result = await accountingService.allocateOverheadCosts(2026, 1, 'EQUAL');

      expect(result.totalOverhead).toBe(0);
      expect(result.allocations).toEqual([]);
    });
  });

  describe('calculateBreakEven', () => {
    it('should calculate break-even point', async () => {
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU001',
        name: 'Product 1',
        price: createDecimal(100),
        bomItems: [
          {
            componentProduct: { cost: createDecimal(20) },
            quantity: createDecimal(2),
          },
        ],
        operations: [
          { setupTime: 0, standardTime: 30, hourlyRate: createDecimal(20) },
        ],
      };

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);

      const result = await accountingService.calculateBreakEven('prod-1', 5000);

      expect(result).toHaveProperty('breakEvenUnits');
      expect(result).toHaveProperty('breakEvenRevenue');
      expect(result).toHaveProperty('contributionMargin');
      expect(result.breakEvenUnits).toBeGreaterThan(0);
    });

    it('should throw error for non-existent product', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(accountingService.calculateBreakEven('non-existent', 5000))
        .rejects.toThrow('Product not found');
    });

    it('should throw error for negative contribution margin', async () => {
      const mockProduct = {
        id: 'prod-1',
        sku: 'SKU001',
        name: 'Product 1',
        price: createDecimal(10), // Price lower than costs
        bomItems: [
          {
            componentProduct: { cost: createDecimal(50) },
            quantity: createDecimal(1),
          },
        ],
        operations: [],
      };

      prismaMock.product.findUnique.mockResolvedValue(mockProduct as any);

      await expect(accountingService.calculateBreakEven('prod-1', 5000))
        .rejects.toThrow('Product has negative contribution margin');
    });
  });

  // ============================================
  // PAYMENT PLANS
  // ============================================

  describe('listPaymentPlans', () => {
    it('should return active payment plans', async () => {
      const mockPlans = [createMockPaymentPlan()];
      prismaMock.paymentPlan.findMany.mockResolvedValue(mockPlans as any);

      const result = await accountingService.listPaymentPlans(true);

      expect(Array.isArray(result)).toBe(true);
      expect(prismaMock.paymentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });

    it('should return all payment plans when activeOnly is false', async () => {
      prismaMock.paymentPlan.findMany.mockResolvedValue([]);

      await accountingService.listPaymentPlans(false);

      expect(prismaMock.paymentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });

  describe('getPaymentPlanById', () => {
    it('should return payment plan with installments', async () => {
      const mockPlan = createMockPaymentPlan({ customers: [], suppliers: [] });
      prismaMock.paymentPlan.findUnique.mockResolvedValue(mockPlan as any);

      const result = await accountingService.getPaymentPlanById('pp-1');

      expect(result).toBeDefined();
      expect(result?.installments).toBeDefined();
    });
  });

  describe('createPaymentPlan', () => {
    it('should create payment plan with installments', async () => {
      const mockPlan = createMockPaymentPlan();
      prismaMock.paymentPlan.create.mockResolvedValue(mockPlan as any);

      const result = await accountingService.createPaymentPlan({
        code: 'PP60',
        name: '60 giorni',
        installments: [
          { sequence: 1, percentage: 50, daysFromInvoice: 30 },
          { sequence: 2, percentage: 50, daysFromInvoice: 60 },
        ],
      });

      expect(result).toBeDefined();
      expect(prismaMock.paymentPlan.create).toHaveBeenCalled();
    });

    it('should throw error if percentages do not sum to 100', async () => {
      await expect(accountingService.createPaymentPlan({
        code: 'PP-BAD',
        name: 'Invalid Plan',
        installments: [
          { sequence: 1, percentage: 30, daysFromInvoice: 30 },
          { sequence: 2, percentage: 50, daysFromInvoice: 60 },
        ],
      })).rejects.toThrow(/percentuali devono sommare a 100/);
    });

    it('should set as default and unset others', async () => {
      const mockPlan = createMockPaymentPlan({ isDefault: true });
      prismaMock.paymentPlan.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.paymentPlan.create.mockResolvedValue(mockPlan as any);

      await accountingService.createPaymentPlan({
        code: 'PP-DEFAULT',
        name: 'Default Plan',
        isDefault: true,
        installments: [{ sequence: 1, percentage: 100, daysFromInvoice: 30 }],
      });

      expect(prismaMock.paymentPlan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      );
    });
  });

  describe('deletePaymentPlan', () => {
    it('should soft delete unused payment plan', async () => {
      prismaMock.customer.count.mockResolvedValue(0);
      prismaMock.paymentPlan.update.mockResolvedValue({ id: 'pp-1', isActive: false } as any);

      const result = await accountingService.deletePaymentPlan('pp-1');

      expect(result.isActive).toBe(false);
    });

    it('should throw error if plan is in use', async () => {
      prismaMock.customer.count.mockResolvedValue(5);

      await expect(accountingService.deletePaymentPlan('pp-1'))
        .rejects.toThrow(/Piano usato da 5 clienti/);
    });
  });

  // ============================================
  // PAYMENT DUES
  // ============================================

  describe('listPaymentDues', () => {
    it('should return paginated payment dues', async () => {
      const mockDues = [createMockPaymentDue()];
      prismaMock.paymentDue.findMany.mockResolvedValue(mockDues as any);
      prismaMock.paymentDue.count.mockResolvedValue(1);

      const result = await accountingService.listPaymentDues({ page: 1, limit: 50 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toHaveProperty('daysOverdue');
      expect(result.items[0]).toHaveProperty('remainingAmount');
    });

    it('should filter by status', async () => {
      prismaMock.paymentDue.findMany.mockResolvedValue([]);
      prismaMock.paymentDue.count.mockResolvedValue(0);

      await accountingService.listPaymentDues({ status: 'OVERDUE' as any });

      expect(prismaMock.paymentDue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OVERDUE' }),
        })
      );
    });

    it('should filter overdue only', async () => {
      prismaMock.paymentDue.findMany.mockResolvedValue([]);
      prismaMock.paymentDue.count.mockResolvedValue(0);

      await accountingService.listPaymentDues({ overdue: true });

      expect(prismaMock.paymentDue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ lt: expect.any(Date) }),
            status: { in: ['PENDING', 'PARTIAL'] },
          }),
        })
      );
    });
  });

  describe('getPaymentDueById', () => {
    it('should return payment due with enriched data', async () => {
      const mockDue = createMockPaymentDue();
      prismaMock.paymentDue.findUnique.mockResolvedValue(mockDue as any);

      const result = await accountingService.getPaymentDueById('pd-1');

      expect(result).toHaveProperty('daysOverdue');
      expect(result).toHaveProperty('remainingAmount');
    });

    it('should throw error for non-existent payment due', async () => {
      prismaMock.paymentDue.findUnique.mockResolvedValue(null);

      await expect(accountingService.getPaymentDueById('non-existent'))
        .rejects.toThrow('Scadenza non trovata');
    });
  });

  describe('createPaymentDue', () => {
    it('should create payment due', async () => {
      const mockDue = createMockPaymentDue();
      prismaMock.paymentDue.create.mockResolvedValue(mockDue as any);

      const result = await accountingService.createPaymentDue({
        type: 'RECEIVABLE',
        amount: 1000,
        dueDate: new Date('2026-02-15'),
        customerId: 'cust-1',
        description: 'Test payment due',
      } as any);

      expect(result).toBeDefined();
      expect(prismaMock.paymentDue.create).toHaveBeenCalled();
    });
  });

  describe('updatePaymentDue', () => {
    it('should update payment due', async () => {
      const mockDue = createMockPaymentDue({ status: 'PARTIAL' });
      prismaMock.paymentDue.update.mockResolvedValue(mockDue as any);

      const result = await accountingService.updatePaymentDue('pd-1', { status: 'PARTIAL' } as any);

      expect(result.status).toBe('PARTIAL');
    });
  });

  describe('deletePaymentDue', () => {
    it('should delete payment due without payments', async () => {
      const mockDue = createMockPaymentDue({ payments: [] });
      prismaMock.paymentDue.findUnique.mockResolvedValue(mockDue as any);
      prismaMock.paymentDue.delete.mockResolvedValue(mockDue as any);

      const result = await accountingService.deletePaymentDue('pd-1');

      expect(result).toBeDefined();
      expect(prismaMock.paymentDue.delete).toHaveBeenCalledWith({ where: { id: 'pd-1' } });
    });

    it('should throw error if payment due has payments', async () => {
      const mockDue = createMockPaymentDue({
        payments: [{ id: 'pay-1' }],
      });
      prismaMock.paymentDue.findUnique.mockResolvedValue(mockDue as any);

      await expect(accountingService.deletePaymentDue('pd-1'))
        .rejects.toThrow('Impossibile eliminare scadenza con pagamenti registrati');
    });

    it('should throw error for non-existent payment due', async () => {
      prismaMock.paymentDue.findUnique.mockResolvedValue(null);

      await expect(accountingService.deletePaymentDue('non-existent'))
        .rejects.toThrow('Scadenza non trovata');
    });
  });

  describe('createPaymentDuesFromInvoice', () => {
    it('should create single payment due without plan', async () => {
      const mockInvoice = createMockInvoice({ customerId: 'cust-1' });
      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.customer.findUnique.mockResolvedValue({ paymentPlanId: null });
      prismaMock.paymentDue.create.mockResolvedValue(createMockPaymentDue() as any);

      const result = await accountingService.createPaymentDuesFromInvoice('inv-1');

      expect(prismaMock.paymentDue.create).toHaveBeenCalledTimes(1);
    });

    it('should create multiple payment dues with plan', async () => {
      const mockInvoice = createMockInvoice({
        customerId: 'cust-1',
        total: createDecimal(1000),
      });
      const mockPlan = createMockPaymentPlan({
        installments: [
          { sequence: 1, percentage: 50, daysFromInvoice: 30 },
          { sequence: 2, percentage: 50, daysFromInvoice: 60 },
        ],
      });

      prismaMock.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      prismaMock.customer.findUnique.mockResolvedValue({ paymentPlanId: 'pp-1' });
      prismaMock.paymentPlan.findUnique.mockResolvedValue(mockPlan as any);
      prismaMock.paymentDue.create.mockResolvedValue(createMockPaymentDue() as any);

      const result = await accountingService.createPaymentDuesFromInvoice('inv-1', 'pp-1');

      expect(prismaMock.paymentDue.create).toHaveBeenCalledTimes(2);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error for non-existent invoice', async () => {
      prismaMock.invoice.findUnique.mockResolvedValue(null);

      await expect(accountingService.createPaymentDuesFromInvoice('non-existent'))
        .rejects.toThrow('Fattura non trovata');
    });
  });

  describe('recordPaymentDuePayment', () => {
    it('should record partial payment', async () => {
      const mockDue = createMockPaymentDue({
        amount: createDecimal(1000),
        paidAmount: createDecimal(0)
      });
      const mockPayment = { id: 'pdp-1', amount: 500 };
      prismaMock.paymentDue.findUnique.mockResolvedValue(mockDue as any);

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          paymentDuePayment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          paymentDue: {
            update: jest.fn().mockResolvedValue({ ...mockDue, status: 'PARTIAL' }),
          },
        };
        return fn(tx);
      });

      const result = await accountingService.recordPaymentDuePayment({
        paymentDueId: 'pd-1',
        amount: 500,
        paymentDate: new Date(),
        method: 'BONIFICO',
      });

      expect(result).toHaveProperty('payment');
      expect(result).toHaveProperty('newStatus');
      expect(result.newStatus).toBe('PARTIAL');
    });

    it('should mark as PAID when fully paid', async () => {
      const mockDue = createMockPaymentDue({
        amount: createDecimal(1000),
        paidAmount: createDecimal(500)
      });
      const mockPayment = { id: 'pdp-1', amount: 500 };
      prismaMock.paymentDue.findUnique.mockResolvedValue(mockDue as any);

      prismaMock.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          paymentDuePayment: {
            create: jest.fn().mockResolvedValue(mockPayment),
          },
          paymentDue: {
            update: jest.fn().mockResolvedValue({ ...mockDue, status: 'PAID' }),
          },
        };
        return fn(tx);
      });

      const result = await accountingService.recordPaymentDuePayment({
        paymentDueId: 'pd-1',
        amount: 500,
        paymentDate: new Date(),
        method: 'BONIFICO',
      });

      expect(result.newStatus).toBe('PAID');
    });

    it('should throw error when amount exceeds remaining', async () => {
      const mockDue = createMockPaymentDue({
        amount: createDecimal(1000),
        paidAmount: createDecimal(800)
      });
      prismaMock.paymentDue.findUnique.mockResolvedValue(mockDue as any);

      await expect(accountingService.recordPaymentDuePayment({
        paymentDueId: 'pd-1',
        amount: 500, // Exceeds remaining 200
        paymentDate: new Date(),
        method: 'BONIFICO',
      })).rejects.toThrow(/Importo eccede il residuo/);
    });

    it('should throw error for non-existent payment due', async () => {
      prismaMock.paymentDue.findUnique.mockResolvedValue(null);

      await expect(accountingService.recordPaymentDuePayment({
        paymentDueId: 'non-existent',
        amount: 500,
        paymentDate: new Date(),
        method: 'BONIFICO',
      })).rejects.toThrow('Scadenza non trovata');
    });
  });

  // ============================================
  // FINANCIAL DASHBOARD & REPORTS
  // ============================================

  describe('getFinancialDashboard', () => {
    it('should return comprehensive financial KPIs', async () => {
      // Mock aggregates
      prismaMock.paymentDue.aggregate
        .mockResolvedValueOnce({ _sum: { amount: createDecimal(50000), paidAmount: createDecimal(10000) }, _count: 20 } as any)
        .mockResolvedValueOnce({ _sum: { amount: createDecimal(5000), paidAmount: createDecimal(0) }, _count: 5 } as any)
        .mockResolvedValueOnce({ _sum: { amount: createDecimal(15000), paidAmount: createDecimal(5000) } } as any)
        .mockResolvedValueOnce({ _sum: { amount: createDecimal(30000), paidAmount: createDecimal(5000) }, _count: 15 } as any)
        .mockResolvedValueOnce({ _sum: { amount: createDecimal(3000), paidAmount: createDecimal(0) }, _count: 3 } as any)
        .mockResolvedValueOnce({ _sum: { amount: createDecimal(10000), paidAmount: createDecimal(2000) } } as any);

      // Mock for calculateAgingBuckets (called twice - for receivables and payables)
      prismaMock.paymentDue.aggregate
        .mockResolvedValue({ _sum: { amount: createDecimal(1000), paidAmount: createDecimal(0) }, _count: 1 } as any);

      const result = await accountingService.getFinancialDashboard();

      expect(result).toHaveProperty('cashPosition');
      expect(result).toHaveProperty('receivables');
      expect(result).toHaveProperty('payables');
      expect(result).toHaveProperty('aging');
    });
  });

  describe('getAgingReport', () => {
    it('should return aging buckets and details', async () => {
      // Mock for calculateAgingBuckets
      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(1000), paidAmount: createDecimal(0) },
        _count: 1,
      } as any);

      prismaMock.paymentDue.findMany.mockResolvedValue([
        createMockPaymentDue({
          dueDate: new Date(),
          customer: { id: 'cust-1', code: 'C001', businessName: 'Customer A' },
        }),
      ] as any);

      const result = await accountingService.getAgingReport('RECEIVABLE');

      expect(result).toHaveProperty('buckets');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('totals');
    });
  });

  describe('getCashFlowForecast', () => {
    it('should return cash flow forecast with scenarios', async () => {
      // Mock for getHistoricalCashFlowData - it calls findMany twice
      // Then for futureReceivables and futurePayables
      // Then for calculateAverageCollectionRate - another findMany call
      prismaMock.paymentDue.findMany
        .mockResolvedValueOnce([]) // historical receivables (getHistoricalCashFlowData)
        .mockResolvedValueOnce([]) // historical payables (getHistoricalCashFlowData)
        .mockResolvedValueOnce([]) // future receivables
        .mockResolvedValueOnce([]) // future payables
        .mockResolvedValueOnce([]); // calculateAverageCollectionRate

      // Mock for getCurrentCashPosition (called in getCashFlowForecast)
      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(10000), paidAmount: createDecimal(0) },
      } as any);

      const result = await accountingService.getCashFlowForecast(3);

      expect(result).toHaveProperty('initialBalance');
      expect(result).toHaveProperty('collectionRate');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.forecast)).toBe(true);
    });

    it('should identify critical months', async () => {
      // Set up mocks to create negative cash flow scenario
      prismaMock.paymentDue.findMany
        .mockResolvedValueOnce([]) // historical receivables
        .mockResolvedValueOnce([]) // historical payables
        .mockResolvedValueOnce([]) // future receivables (no receivables)
        .mockResolvedValueOnce([
          createMockPaymentDue({
            type: 'PAYABLE',
            amount: createDecimal(100000),
            paidAmount: createDecimal(0),
            dueDate: new Date(),
          }),
        ]) // Large payable
        .mockResolvedValueOnce([]); // calculateAverageCollectionRate

      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(0), paidAmount: createDecimal(0) },
      } as any);

      const result = await accountingService.getCashFlowForecast(3);

      expect(result.summary).toHaveProperty('criticalMonths');
    });
  });

  describe('getFinancialRecommendations', () => {
    it('should return recommendations and summary', async () => {
      // Mock financial dashboard
      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(10000), paidAmount: createDecimal(0) },
        _count: 5,
      } as any);

      prismaMock.paymentDue.findMany.mockResolvedValue([
        createMockPaymentDue(),
      ] as any);

      const result = await accountingService.getFinancialRecommendations();

      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('byPriority');
      expect(result.summary).toHaveProperty('byType');
    });

    it('should generate high priority warning for critical receivables', async () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 90); // 90 days overdue

      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: createDecimal(50000), paidAmount: createDecimal(0) },
        _count: 10,
      } as any);

      prismaMock.paymentDue.findMany.mockResolvedValue([
        createMockPaymentDue({
          dueDate: overdueDate,
          amount: createDecimal(50000),
          customer: { id: 'cust-1', businessName: 'Critical Customer' },
        }),
      ] as any);

      const result = await accountingService.getFinancialRecommendations();

      const warnings = result.recommendations.filter((r: any) => r.type === 'WARNING');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
