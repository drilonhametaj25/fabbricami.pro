/**
 * Accounting E2E Tests
 * Tests for accounting API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are set up before module imports
const mockPrisma = vi.hoisted(() => ({
  paymentDue: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  paymentDuePayment: {
    create: vi.fn(),
  },
  paymentPlan: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

// Mock modules before imports
vi.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import accountingService from '@server/services/accounting.service';
import { prisma } from '@server/config/database';

describe('Accounting API E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cash Flow Forecast', () => {
    it('should return forecast with three scenarios', async () => {
      const mockReceivables = [
        {
          id: '1',
          amount: 10000,
          paidAmount: 0,
          dueDate: new Date('2026-03-15'),
          status: 'PENDING',
        },
      ];

      const mockPayables = [
        {
          id: '2',
          amount: 3000,
          paidAmount: 0,
          dueDate: new Date('2026-03-20'),
          status: 'PENDING',
        },
      ];

      // Mock for getHistoricalCashFlowData (2 calls)
      // Mock for getCashFlowForecast future receivables/payables (2 calls)
      // Mock for calculateAverageCollectionRate (1 call)
      vi.mocked(mockPrisma.paymentDue.findMany)
        .mockResolvedValueOnce([]) // historical receivables (PAID)
        .mockResolvedValueOnce([]) // historical payables (PAID)
        .mockResolvedValueOnce(mockReceivables as any) // future receivables
        .mockResolvedValueOnce(mockPayables as any) // future payables
        .mockResolvedValueOnce([] as any); // for calculateAverageCollectionRate

      // Mock for getCurrentCashPosition (2 aggregate calls)
      vi.mocked(mockPrisma.paymentDue.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 } } as any)
        .mockResolvedValueOnce({ _sum: { amount: 3000, paidAmount: 0 } } as any);

      const result = await accountingService.getCashFlowForecast(6);

      // Check that forecast array has scenarios per month
      expect(result).toHaveProperty('forecast');
      expect(Array.isArray(result.forecast)).toBe(true);
      expect(result.forecast.length).toBeGreaterThan(0);

      // Each forecast month should have scenarios
      const firstMonth = result.forecast[0];
      expect(firstMonth).toHaveProperty('scenarios');
      expect(firstMonth.scenarios).toHaveProperty('optimistic');
      expect(firstMonth.scenarios).toHaveProperty('realistic');
      expect(firstMonth.scenarios).toHaveProperty('pessimistic');
    });

    it('should project cash flow monthly', async () => {
      // Mock for getHistoricalCashFlowData
      vi.mocked(mockPrisma.paymentDue.findMany)
        .mockResolvedValueOnce([]) // historical receivables
        .mockResolvedValueOnce([]) // historical payables
        .mockResolvedValueOnce([]) // future receivables
        .mockResolvedValueOnce([]) // future payables
        .mockResolvedValueOnce([]); // for calculateAverageCollectionRate

      // Mock for getCurrentCashPosition
      vi.mocked(mockPrisma.paymentDue.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 } } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 } } as any);

      const result = await accountingService.getCashFlowForecast(6);

      expect(result).toHaveProperty('forecast');
      expect(Array.isArray(result.forecast)).toBe(true);
    });
  });

  describe('Financial Dashboard', () => {
    it('should return complete financial KPIs', async () => {
      // The dashboard calls 6 aggregate queries + calculateAgingBuckets
      // receivablesTotal, receivablesOverdue, receivablesDue30, payablesTotal, payablesOverdue, payablesDue30
      // Plus 5 aggregate calls for each aging bucket for receivables + 5 for payables = 10 more
      vi.mocked(mockPrisma.paymentDue.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: 50000, paidAmount: 0 }, _count: 10 } as any) // receivablesTotal
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 }, _count: 2 } as any) // receivablesOverdue
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 } } as any) // receivablesDue30
        .mockResolvedValueOnce({ _sum: { amount: 20000, paidAmount: 0 }, _count: 5 } as any) // payablesTotal
        .mockResolvedValueOnce({ _sum: { amount: 2000, paidAmount: 0 }, _count: 1 } as any) // payablesOverdue
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 } } as any) // payablesDue30
        // Aging buckets for receivables (5 buckets)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 2 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 15000, paidAmount: 0 }, _count: 3 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 2 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 2 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 }, _count: 1 } as any)
        // Aging buckets for payables (5 buckets)
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 8000, paidAmount: 0 }, _count: 2 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 2000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any);

      const result = await accountingService.getFinancialDashboard();

      expect(result).toHaveProperty('receivables');
      expect(result).toHaveProperty('payables');
      expect(result).toHaveProperty('cashPosition');
      expect(result.receivables.total).toBe(50000);
      expect(result.payables.total).toBe(20000);
      expect(result.cashPosition.current).toBe(30000); // 50000 - 20000
    });
  });

  describe('Aging Report', () => {
    it('should categorize into aging buckets', async () => {
      const today = new Date();
      const overdue30 = new Date(today);
      overdue30.setDate(overdue30.getDate() - 20);

      const overdue60 = new Date(today);
      overdue60.setDate(overdue60.getDate() - 45);

      // Mock aging bucket aggregates (5 buckets)
      vi.mocked(mockPrisma.paymentDue.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any) // current
        .mockResolvedValueOnce({ _sum: { amount: 1000, paidAmount: 0 }, _count: 1 } as any) // 1-30 days
        .mockResolvedValueOnce({ _sum: { amount: 2000, paidAmount: 0 }, _count: 1 } as any) // 31-60 days
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any) // 61-90 days
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any); // over 90 days

      vi.mocked(mockPrisma.paymentDue.findMany).mockResolvedValue([
        {
          id: '1',
          amount: 1000,
          paidAmount: 0,
          dueDate: overdue30,
          status: 'PENDING',
          customerId: 'cust-1',
          customer: { id: 'cust-1', code: 'C001', businessName: 'Customer A' },
          supplier: null,
          invoice: null,
          supplierInvoice: null,
        },
        {
          id: '2',
          amount: 2000,
          paidAmount: 0,
          dueDate: overdue60,
          status: 'PENDING',
          customerId: 'cust-2',
          customer: { id: 'cust-2', code: 'C002', businessName: 'Customer B' },
          supplier: null,
          invoice: null,
          supplierInvoice: null,
        },
      ] as any);

      const result = await accountingService.getAgingReport('RECEIVABLE');

      expect(result).toHaveProperty('buckets');
      expect(Array.isArray(result.buckets)).toBe(true);
      expect(result.buckets.length).toBe(5);
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('totals');
      expect(result.totals.total).toBe(3000);
    });
  });

  describe('Financial Recommendations', () => {
    it('should generate recommendations for overdue receivables', async () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 65); // More than 60 days overdue

      // getFinancialRecommendations calls:
      // 1. getFinancialDashboard (many aggregate calls)
      // 2. getAgingReport for RECEIVABLE (5 aggregate + 1 findMany)
      // 3. getAgingReport for PAYABLE (5 aggregate + 1 findMany)
      // 4. getCashFlowForecast (2 findMany + 2 aggregate + 3 findMany for historical/collection rate)

      // Dashboard aggregates (16 calls)
      vi.mocked(mockPrisma.paymentDue.aggregate)
        // Dashboard: receivablesTotal, receivablesOverdue, receivablesDue30, payablesTotal, payablesOverdue, payablesDue30
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 } } as any)
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 2000, paidAmount: 0 } } as any)
        // Dashboard aging receivables (5 buckets)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        // Dashboard aging payables (5 buckets)
        .mockResolvedValueOnce({ _sum: { amount: 2000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 3000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        // Aging report RECEIVABLE (5 buckets)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        // Aging report PAYABLE (5 buckets)
        .mockResolvedValueOnce({ _sum: { amount: 2000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 3000, paidAmount: 0 }, _count: 1 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        .mockResolvedValueOnce({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 } as any)
        // Cash flow getCurrentCashPosition (2 calls)
        .mockResolvedValueOnce({ _sum: { amount: 10000, paidAmount: 0 } } as any)
        .mockResolvedValueOnce({ _sum: { amount: 5000, paidAmount: 0 } } as any);

      // findMany calls
      vi.mocked(mockPrisma.paymentDue.findMany)
        // Aging report RECEIVABLE details
        .mockResolvedValueOnce([
          {
            id: '1',
            type: 'RECEIVABLE',
            amount: 10000,
            paidAmount: 0,
            dueDate: overdueDate,
            status: 'PENDING',
            description: 'Test invoice',
            customerId: 'cust-1',
            supplierId: null,
            customer: { id: 'cust-1', code: 'C001', businessName: 'Delinquent Customer' },
            supplier: null,
            invoice: { invoiceNumber: 'INV-001' },
            supplierInvoice: null,
          },
        ] as any)
        // Aging report PAYABLE details
        .mockResolvedValueOnce([
          {
            id: '2',
            type: 'PAYABLE',
            amount: 5000,
            paidAmount: 0,
            dueDate: new Date(),
            status: 'PENDING',
            description: 'Supplier invoice',
            customerId: null,
            supplierId: 'sup-1',
            customer: null,
            supplier: { id: 'sup-1', code: 'S001', businessName: 'Supplier A' },
            invoice: null,
            supplierInvoice: { invoiceNumber: 'SUP-001' },
          },
        ] as any)
        // Cash flow historical receivables (PAID)
        .mockResolvedValueOnce([])
        // Cash flow historical payables (PAID)
        .mockResolvedValueOnce([])
        // Cash flow future receivables
        .mockResolvedValueOnce([])
        // Cash flow future payables
        .mockResolvedValueOnce([])
        // Cash flow calculateAverageCollectionRate
        .mockResolvedValueOnce([]);

      const result = await accountingService.getFinancialRecommendations();

      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('byPriority');
      expect(result.summary).toHaveProperty('byType');
    });
  });

  describe('Payment Due Management', () => {
    it('should create payment due', async () => {
      const mockPaymentDue = {
        id: 'pd-1',
        type: 'RECEIVABLE',
        amount: 1000,
        dueDate: new Date('2026-02-01'),
        status: 'PENDING',
        customerId: 'cust-1',
        description: 'Invoice #123',
        customer: { id: 'cust-1', businessName: 'Test Customer' },
        supplier: null,
      };

      vi.mocked(mockPrisma.paymentDue.create).mockResolvedValue(mockPaymentDue as any);

      const result = await accountingService.createPaymentDue({
        type: 'RECEIVABLE',
        amount: 1000,
        dueDate: new Date('2026-02-01'),
        customerId: 'cust-1',
        description: 'Invoice #123',
      });

      expect(result.id).toBe('pd-1');
      expect(result.type).toBe('RECEIVABLE');
    });

    it('should record payment and update status', async () => {
      const existingDue = {
        id: 'pd-1',
        amount: 1000,
        paidAmount: 0,
        status: 'PENDING',
      };

      vi.mocked(mockPrisma.paymentDue.findUnique).mockResolvedValue(existingDue as any);

      // Mock $transaction to execute the callback with mock tx
      vi.mocked(mockPrisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          paymentDuePayment: {
            create: vi.fn().mockResolvedValue({ id: 'payment-1', amount: 500 }),
          },
          paymentDue: {
            update: vi.fn().mockResolvedValue({
              ...existingDue,
              paidAmount: 500,
              status: 'PARTIAL',
            }),
          },
        };
        return callback(mockTx);
      });

      const result = await accountingService.recordPaymentDuePayment({
        paymentDueId: 'pd-1',
        amount: 500,
        paymentDate: new Date(),
        method: 'BONIFICO',
      });

      expect(result).toHaveProperty('payment');
      expect(result).toHaveProperty('newPaidAmount');
      expect(result.newPaidAmount).toBe(500);
      expect(result.newStatus).toBe('PARTIAL');
    });
  });
});
