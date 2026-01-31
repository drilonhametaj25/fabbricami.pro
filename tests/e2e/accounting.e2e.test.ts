/**
 * Accounting E2E Tests
 * Tests for accounting API endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@server/config/database', async () => {
  return {
    prisma: {
      paymentDue: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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
          amount: { toNumber: () => 10000 },
          dueDate: new Date('2026-01-15'),
          status: 'PENDING',
        },
      ];

      const mockPayables = [
        {
          id: '2',
          amount: { toNumber: () => 3000 },
          dueDate: new Date('2026-01-20'),
          status: 'PENDING',
        },
      ];

      vi.mocked(prisma.paymentDue.findMany)
        .mockResolvedValueOnce(mockReceivables as any)
        .mockResolvedValueOnce(mockPayables as any);

      const result = await accountingService.getCashFlowForecast(30);

      expect(result).toHaveProperty('scenarios');
      expect(result.scenarios).toHaveProperty('optimistic');
      expect(result.scenarios).toHaveProperty('realistic');
      expect(result.scenarios).toHaveProperty('pessimistic');

      // Optimistic should have higher collection rate
      expect(result.scenarios.optimistic.expectedIncome).toBeGreaterThanOrEqual(
        result.scenarios.pessimistic.expectedIncome
      );
    });

    it('should project cash flow weekly', async () => {
      vi.mocked(prisma.paymentDue.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await accountingService.getCashFlowForecast(30);

      expect(result).toHaveProperty('weeklyProjection');
      expect(Array.isArray(result.weeklyProjection)).toBe(true);
    });
  });

  describe('Financial Dashboard', () => {
    it('should return complete financial KPIs', async () => {
      vi.mocked(prisma.paymentDue.aggregate)
        .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 50000 } } } as any)
        .mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 20000 } } } as any);

      vi.mocked(prisma.paymentDue.findMany).mockResolvedValue([]);
      vi.mocked(prisma.paymentDue.count).mockResolvedValue(10);

      const result = await accountingService.getFinancialDashboard();

      expect(result).toHaveProperty('totalReceivables');
      expect(result).toHaveProperty('totalPayables');
      expect(result).toHaveProperty('netPosition');
      expect(result.netPosition).toBe(30000); // 50000 - 20000
    });
  });

  describe('Aging Report', () => {
    it('should categorize into aging buckets', async () => {
      const today = new Date();
      const overdue30 = new Date(today);
      overdue30.setDate(overdue30.getDate() - 20);

      const overdue60 = new Date(today);
      overdue60.setDate(overdue60.getDate() - 45);

      vi.mocked(prisma.paymentDue.findMany).mockResolvedValue([
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
      expect(result.totalOutstanding).toBe(3000);
    });
  });

  describe('Financial Recommendations', () => {
    it('should generate recommendations for overdue receivables', async () => {
      const overdueDate = new Date();
      overdueDate.setDate(overdueDate.getDate() - 45);

      vi.mocked(prisma.paymentDue.findMany).mockResolvedValue([
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

      vi.mocked(prisma.paymentDue.aggregate).mockResolvedValue({
        _sum: { amount: { toNumber: () => 10000 } },
      } as any);

      const result = await accountingService.getFinancialRecommendations();

      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('cashFlowHealth');
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
      };

      vi.mocked(prisma.paymentDue.create).mockResolvedValue(mockPaymentDue as any);

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
        amount: { toNumber: () => 1000 },
        paidAmount: { toNumber: () => 0 },
        status: 'PENDING',
      };

      vi.mocked(prisma.paymentDue.findUnique).mockResolvedValue(existingDue as any);
      vi.mocked(prisma.paymentDue.update).mockResolvedValue({
        ...existingDue,
        paidAmount: { toNumber: () => 500 },
        status: 'PARTIAL',
      } as any);
      vi.mocked(prisma.paymentDuePayment.create).mockResolvedValue({} as any);

      const result = await accountingService.recordPaymentDuePayment('pd-1', {
        amount: 500,
        paymentDate: new Date(),
        paymentMethod: 'BONIFICO',
      });

      expect(vi.mocked(prisma.paymentDuePayment.create)).toHaveBeenCalled();
      expect(vi.mocked(prisma.paymentDue.update)).toHaveBeenCalled();
    });
  });
});
