/**
 * Accounting Service Tests
 * Tests for cash flow forecasting and financial recommendations
 */

import { prismaMock } from '../__mocks__/prisma';

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

// Import after mocks
import accountingService from '@server/services/accounting.service';

describe('AccountingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCashFlowForecast', () => {
    it('should return cash flow forecast with three scenarios', async () => {
      const mockReceivables = [
        {
          id: '1',
          amount: { toNumber: () => 1000 },
          dueDate: new Date('2026-01-15'),
          status: 'PENDING',
        },
        {
          id: '2',
          amount: { toNumber: () => 2000 },
          dueDate: new Date('2026-01-20'),
          status: 'PENDING',
        },
      ];

      const mockPayables = [
        {
          id: '3',
          amount: { toNumber: () => 500 },
          dueDate: new Date('2026-01-18'),
          status: 'PENDING',
        },
      ];

      prismaMock.paymentDue.findMany
        .mockResolvedValueOnce(mockReceivables as any)
        .mockResolvedValueOnce(mockPayables as any);

      const result = await accountingService.getCashFlowForecast(30);

      expect(result).toHaveProperty('scenarios');
      expect(result.scenarios).toHaveProperty('optimistic');
      expect(result.scenarios).toHaveProperty('realistic');
      expect(result.scenarios).toHaveProperty('pessimistic');
      expect(result).toHaveProperty('weeklyProjection');
      expect(Array.isArray(result.weeklyProjection)).toBe(true);
    });

    it('should handle empty data gracefully', async () => {
      prismaMock.paymentDue.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await accountingService.getCashFlowForecast(30);

      expect(result.scenarios.optimistic.expectedIncome).toBe(0);
      expect(result.scenarios.optimistic.expectedExpenses).toBe(0);
    });

    it('should calculate different collection rates for each scenario', async () => {
      const mockReceivables = [
        {
          id: '1',
          amount: { toNumber: () => 10000 },
          dueDate: new Date('2026-01-15'),
          status: 'PENDING',
        },
      ];

      prismaMock.paymentDue.findMany
        .mockResolvedValueOnce(mockReceivables as any)
        .mockResolvedValueOnce([]);

      const result = await accountingService.getCashFlowForecast(30);

      // Optimistic should have higher expected income than pessimistic
      expect(result.scenarios.optimistic.expectedIncome).toBeGreaterThan(
        result.scenarios.pessimistic.expectedIncome
      );
    });
  });

  describe('getFinancialRecommendations', () => {
    it('should return recommendations array', async () => {
      // Mock aging data
      prismaMock.paymentDue.findMany.mockResolvedValue([
        {
          id: '1',
          type: 'RECEIVABLE',
          amount: { toNumber: () => 5000 },
          paidAmount: { toNumber: () => 0 },
          dueDate: new Date('2025-12-01'), // Overdue
          status: 'OVERDUE',
          customer: { businessName: 'Test Customer' },
        },
      ] as any);

      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 5000 } },
      } as any);

      const result = await accountingService.getFinancialRecommendations();

      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result).toHaveProperty('summary');
    });

    it('should generate high priority recommendations for overdue receivables', async () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 45); // 45 days overdue

      prismaMock.paymentDue.findMany.mockResolvedValue([
        {
          id: '1',
          type: 'RECEIVABLE',
          amount: { toNumber: () => 10000 },
          paidAmount: { toNumber: () => 0 },
          dueDate: overdueDate,
          status: 'OVERDUE',
          customer: { businessName: 'Delinquent Customer' },
        },
      ] as any);

      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: { toNumber: () => 10000 } },
      } as any);

      const result = await accountingService.getFinancialRecommendations();

      const highPriorityRecs = result.recommendations.filter(
        (r: any) => r.priority === 'HIGH'
      );
      expect(highPriorityRecs.length).toBeGreaterThan(0);
    });

    it('should include cash flow health indicator', async () => {
      prismaMock.paymentDue.findMany.mockResolvedValue([]);
      prismaMock.paymentDue.aggregate.mockResolvedValue({
        _sum: { amount: null },
      } as any);

      const result = await accountingService.getFinancialRecommendations();

      expect(result.summary).toHaveProperty('cashFlowHealth');
      expect(['HEALTHY', 'WARNING', 'CRITICAL']).toContain(
        result.summary.cashFlowHealth
      );
    });
  });

  describe('getAgingReport', () => {
    it('should categorize receivables into aging buckets', async () => {
      const today = new Date();
      const overdue30 = new Date(today);
      overdue30.setDate(overdue30.getDate() - 20);
      const overdue60 = new Date(today);
      overdue60.setDate(overdue60.getDate() - 45);

      prismaMock.paymentDue.findMany.mockResolvedValue([
        {
          id: '1',
          amount: { toNumber: () => 1000 },
          paidAmount: { toNumber: () => 0 },
          dueDate: overdue30,
          status: 'OVERDUE',
          customer: { businessName: 'Customer A' },
        },
        {
          id: '2',
          amount: { toNumber: () => 2000 },
          paidAmount: { toNumber: () => 0 },
          dueDate: overdue60,
          status: 'OVERDUE',
          customer: { businessName: 'Customer B' },
        },
      ] as any);

      const result = await accountingService.getAgingReport('RECEIVABLE');

      expect(result).toHaveProperty('buckets');
      expect(result.buckets).toHaveProperty('current');
      expect(result.buckets).toHaveProperty('days1to30');
      expect(result.buckets).toHaveProperty('days31to60');
      expect(result.buckets).toHaveProperty('days61to90');
      expect(result.buckets).toHaveProperty('over90');
    });

    it('should calculate total outstanding correctly', async () => {
      prismaMock.paymentDue.findMany.mockResolvedValue([
        {
          id: '1',
          amount: { toNumber: () => 1000 },
          paidAmount: { toNumber: () => 200 },
          dueDate: new Date(),
          status: 'PARTIAL',
          customer: { businessName: 'Customer A' },
        },
        {
          id: '2',
          amount: { toNumber: () => 2000 },
          paidAmount: { toNumber: () => 0 },
          dueDate: new Date(),
          status: 'PENDING',
          customer: { businessName: 'Customer B' },
        },
      ] as any);

      const result = await accountingService.getAgingReport('RECEIVABLE');

      // Total should be (1000-200) + (2000-0) = 2800
      expect(result.totalOutstanding).toBe(2800);
    });
  });

  describe('getFinancialDashboard', () => {
    it('should return comprehensive financial KPIs', async () => {
      prismaMock.paymentDue.aggregate
        .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 50000 } } } as any) // receivables
        .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 30000 } } } as any); // payables

      prismaMock.paymentDue.findMany.mockResolvedValue([]);
      prismaMock.paymentDue.count.mockResolvedValue(10);

      const result = await accountingService.getFinancialDashboard();

      expect(result).toHaveProperty('totalReceivables');
      expect(result).toHaveProperty('totalPayables');
      expect(result).toHaveProperty('netPosition');
      expect(result.netPosition).toBe(20000); // 50000 - 30000
    });
  });
});

describe('PaymentDue CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentDue', () => {
    it('should create a new payment due', async () => {
      const mockPaymentDue = {
        id: 'pd-1',
        type: 'RECEIVABLE',
        amount: 1000,
        dueDate: new Date('2026-02-01'),
        status: 'PENDING',
        customerId: 'cust-1',
        description: 'Invoice #123',
      };

      prismaMock.paymentDue.create.mockResolvedValue(mockPaymentDue as any);

      const result = await accountingService.createPaymentDue({
        type: 'RECEIVABLE',
        amount: 1000,
        dueDate: new Date('2026-02-01'),
        customerId: 'cust-1',
        description: 'Invoice #123',
      });

      expect(result).toEqual(mockPaymentDue);
      expect(prismaMock.paymentDue.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordPayment', () => {
    it('should record partial payment and update status', async () => {
      const existingDue = {
        id: 'pd-1',
        amount: { toNumber: () => 1000 },
        paidAmount: { toNumber: () => 0 },
        status: 'PENDING',
      };

      prismaMock.paymentDue.findUnique.mockResolvedValue(existingDue as any);
      prismaMock.paymentDue.update.mockResolvedValue({
        ...existingDue,
        paidAmount: { toNumber: () => 500 },
        status: 'PARTIAL',
      } as any);
      prismaMock.paymentDuePayment.create.mockResolvedValue({} as any);

      const result = await accountingService.recordPaymentDuePayment('pd-1', {
        amount: 500,
        paymentDate: new Date(),
        paymentMethod: 'BONIFICO',
      });

      expect(prismaMock.paymentDuePayment.create).toHaveBeenCalled();
      expect(prismaMock.paymentDue.update).toHaveBeenCalled();
    });

    it('should mark as PAID when fully paid', async () => {
      const existingDue = {
        id: 'pd-1',
        amount: { toNumber: () => 1000 },
        paidAmount: { toNumber: () => 500 },
        status: 'PARTIAL',
      };

      prismaMock.paymentDue.findUnique.mockResolvedValue(existingDue as any);
      prismaMock.paymentDue.update.mockResolvedValue({
        ...existingDue,
        paidAmount: { toNumber: () => 1000 },
        status: 'PAID',
      } as any);
      prismaMock.paymentDuePayment.create.mockResolvedValue({} as any);

      await accountingService.recordPaymentDuePayment('pd-1', {
        amount: 500,
        paymentDate: new Date(),
        paymentMethod: 'BONIFICO',
      });

      expect(prismaMock.paymentDue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
          }),
        })
      );
    });
  });
});
