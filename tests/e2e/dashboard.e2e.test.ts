/**
 * Dashboard E2E Tests
 * End-to-end tests for intelligent dashboard and suggestion engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@server/config/database', async () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
      task: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      productionOrder: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      invoice: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      customer: {
        count: vi.fn(),
      },
      suggestion: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
        groupBy: vi.fn(),
      },
      calendarEvent: {
        findMany: vi.fn(),
      },
      userDashboardPreference: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      $queryRaw: vi.fn(),
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
import { prisma } from '@server/config/database';
import { dashboardService } from '@server/services/dashboard.service';
import { suggestionEngineService } from '@server/services/suggestion-engine.service';

describe('Dashboard E2E - Complete User Flow', () => {
  const mockUser = {
    id: 'user-1',
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario@test.com',
    role: 'ADMIN',
    employee: null,
    dashboardPreference: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:30:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('User Login and Dashboard Load', () => {
    it('should load complete dashboard for admin user', async () => {
      // Setup mocks
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.order.count).mockResolvedValue(5);
      vi.mocked(prisma.task.count).mockResolvedValue(3);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(2);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 10,
        _sum: { total: 5000 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(5) }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(2);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(10);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(5);
      vi.mocked(prisma.suggestion.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      // Verify all sections are present
      expect(dashboard).toHaveProperty('greeting');
      expect(dashboard).toHaveProperty('dailyKpis');
      expect(dashboard).toHaveProperty('urgentTasks');
      expect(dashboard).toHaveProperty('dayPlan');
      expect(dashboard).toHaveProperty('suggestions');
      expect(dashboard).toHaveProperty('quickStats');

      // Verify greeting
      expect(dashboard.greeting.message).toContain('Buongiorno');
      expect(dashboard.greeting.message).toContain('Mario');
      expect(dashboard.greeting.subMessage).toContain('5 nuovi ordini');
    });

    it('should load role-specific KPIs for warehouse manager', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role: 'MAGAZZINIERE',
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.task.count).mockResolvedValue(0);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(0);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 5,
        _sum: { total: 2500 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(8), value: 15000 }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(0);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      // Warehouse manager should see low stock and shipping KPIs
      const kpiIds = dashboard.dailyKpis.items.map(k => k.id);
      expect(kpiIds).toContain('low_stock');
      expect(kpiIds).toContain('to_ship');
    });

    it('should load role-specific KPIs for accountant', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role: 'CONTABILE',
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.task.count).mockResolvedValue(0);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(0);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 5,
        _sum: { total: 2500 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(0) }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(5);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      // Accountant should see overdue invoices
      const kpiIds = dashboard.dailyKpis.items.map(k => k.id);
      expect(kpiIds).toContain('overdue_invoices');
    });
  });

  describe('Urgent Tasks Flow', () => {
    it('should show urgent tasks with correct priority sorting', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.task.count).mockResolvedValue(3);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(0);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { total: 0 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(0) }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(0);

      // Mock tasks with different priorities
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { id: 't1', title: 'Low Priority', priority: 'MEDIUM', dueDate: new Date() },
        { id: 't2', title: 'High Priority', priority: 'HIGH', dueDate: new Date() },
        { id: 't3', title: 'Urgent', priority: 'URGENT', dueDate: new Date() },
      ] as any);

      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      // First task should be CRITICAL (mapped from URGENT)
      expect(dashboard.urgentTasks.items[0].priority).toBe('CRITICAL');
      expect(dashboard.urgentTasks.items[1].priority).toBe('HIGH');
      expect(dashboard.urgentTasks.items[2].priority).toBe('MEDIUM');
    });

    it('should include payment due alerts for accountant', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        role: 'CONTABILE',
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.task.count).mockResolvedValue(0);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(0);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { total: 0 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(0) }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(0);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);

      // Mock invoices due soon
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FT-001',
          total: 1000,
          paidAmount: 0,
          dueDate,
          customer: { businessName: 'Test Customer' },
        },
      ] as any);

      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      const paymentTasks = dashboard.urgentTasks.items.filter(t => t.type === 'PAYMENT');
      expect(paymentTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Suggestions Flow', () => {
    it('should generate and display stockout alerts', async () => {
      // Mock cleanup
      vi.mocked(prisma.suggestion.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.suggestion.updateMany).mockResolvedValue({ count: 0 });

      // Mock critical products
      vi.mocked(prisma.$queryRaw).mockResolvedValue([
        {
          product_id: 'prod-1',
          product_name: 'Critical Product',
          sku: 'SKU001',
          total_stock: 0,
          min_stock: 10,
          reorder_point: 20,
          cost: 50,
        },
      ]);

      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.suggestion.create).mockResolvedValue({
        id: 'sug-1',
        type: 'STOCKOUT_ALERT',
        priority: 'CRITICAL',
      } as any);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result.created).toBeGreaterThan(0);
      expect(vi.mocked(prisma.suggestion.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'STOCKOUT_ALERT',
            priority: 'CRITICAL',
          }),
        })
      );
    });

    it('should generate trend suggestions', async () => {
      vi.mocked(prisma.suggestion.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.suggestion.updateMany).mockResolvedValue({ count: 0 });

      // First 3 calls return empty, 4th call (trend) returns data
      let callCount = 0;
      vi.mocked(prisma.$queryRaw).mockImplementation(() => {
        callCount++;
        if (callCount === 4) {
          return Promise.resolve([
            {
              product_id: 'prod-trend',
              product_name: 'Trending Product',
              sku: 'SKU-TREND',
              current_period_sales: 100,
              previous_period_sales: 50,
              change_percent: 100, // +100%
            },
          ]);
        }
        return Promise.resolve([]);
      });

      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.suggestion.create).mockResolvedValue({
        id: 'sug-trend',
        type: 'TREND_UP',
      } as any);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result.created).toBeGreaterThan(0);
    });

    it('should dismiss suggestion', async () => {
      vi.mocked(prisma.suggestion.update).mockResolvedValue({
        id: 'sug-1',
        status: 'DISMISSED',
      } as any);

      await suggestionEngineService.dismiss('sug-1', 'user-1', 'Not relevant');

      expect(vi.mocked(prisma.suggestion.update)).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: expect.objectContaining({
          status: 'DISMISSED',
          dismissedBy: 'user-1',
          dismissReason: 'Not relevant',
        }),
      });
    });

    it('should mark suggestion as acted', async () => {
      vi.mocked(prisma.suggestion.update).mockResolvedValue({
        id: 'sug-1',
        status: 'ACTED',
      } as any);

      await suggestionEngineService.markActed('sug-1', 'user-1');

      expect(vi.mocked(prisma.suggestion.update)).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: expect.objectContaining({
          status: 'ACTED',
          actedBy: 'user-1',
        }),
      });
    });
  });

  describe('Day Plan Flow', () => {
    it('should combine calendar events and tasks', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.task.count).mockResolvedValue(0);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(0);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { total: 0 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(0) }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(0);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.findMany).mockResolvedValue([]);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      // Mock calendar events
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([
        {
          id: 'event-1',
          title: 'Team Meeting',
          description: 'Daily standup',
          startDate: new Date('2026-02-01T09:00:00'),
          eventType: 'meeting',
        },
      ] as any);

      // Mock tasks - using mockImplementation to handle multiple calls
      vi.mocked(prisma.task.findMany).mockImplementation((args: any) => {
        if (args?.where?.dueDate) {
          return Promise.resolve([
            {
              id: 'task-1',
              title: 'Complete Report',
              dueDate: new Date('2026-02-01T14:00:00'),
              status: 'IN_PROGRESS',
            },
          ] as any);
        }
        return Promise.resolve([]);
      });

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      expect(dashboard.dayPlan.items.length).toBe(2);
      expect(dashboard.dayPlan.items.some(i => i.type === 'MEETING')).toBe(true);
      expect(dashboard.dayPlan.items.some(i => i.type === 'TASK')).toBe(true);
    });
  });

  describe('User Preferences Flow', () => {
    it('should save and retrieve user preferences', async () => {
      vi.mocked(prisma.userDashboardPreference.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.userDashboardPreference.findUnique).mockResolvedValue({
        userId: 'user-1',
        emailDailyDigest: false,
        emailWeeklyDigest: true,
        emailUrgentAlerts: true,
        showSuggestions: false,
        defaultDateRange: '30d',
        showKpis: true,
        showUrgentTasks: true,
        showDayPlan: true,
        compactMode: true,
      } as any);

      const updated = await dashboardService.updatePreferences('user-1', {
        emailDailyDigest: false,
        compactMode: true,
        defaultDateRange: '30d',
      });

      expect(updated.emailDailyDigest).toBe(false);
      expect(updated.compactMode).toBe(true);
      expect(updated.defaultDateRange).toBe('30d');
    });

    it('should hide suggestions when disabled in preferences', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        dashboardPreference: { showSuggestions: false },
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.task.count).mockResolvedValue(0);
      vi.mocked(prisma.productionOrder.count).mockResolvedValue(0);
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _count: 0,
        _sum: { total: 0 },
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: BigInt(0) }]);
      vi.mocked(prisma.invoice.count).mockResolvedValue(0);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productionOrder.findMany).mockResolvedValue([]);
      vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.count).mockResolvedValue(0);
      vi.mocked(prisma.suggestion.groupBy).mockResolvedValue([]);

      const dashboard = await dashboardService.getTodayDashboard('user-1');

      expect(dashboard.suggestions.items).toEqual([]);
      expect(dashboard.suggestions.total).toBe(0);
    });
  });

  describe('KPI Aggregation Flow', () => {
    it('should calculate KPIs with period comparison', async () => {
      vi.mocked(prisma.order.count)
        .mockResolvedValueOnce(100) // Current period
        .mockResolvedValueOnce(80); // Previous period
      vi.mocked(prisma.order.aggregate)
        .mockResolvedValueOnce({ _sum: { total: 10000 } } as any)
        .mockResolvedValueOnce({ _sum: { total: 8000 } } as any);
      vi.mocked(prisma.customer.count)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40);

      const kpis = await dashboardService.getKpis({ dateRange: '30d' });

      expect(kpis.current.orders).toBe(100);
      expect(kpis.previous.orders).toBe(80);
      expect(kpis.changes.orders).toBe(25); // (100-80)/80 * 100
      expect(kpis.changes.revenue).toBe(25); // (10000-8000)/8000 * 100
    });
  });

  describe('Error Handling', () => {
    it('should handle user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(dashboardService.getTodayDashboard('non-existent'))
        .rejects.toThrow('Utente non trovato');
    });

    it('should handle suggestion engine errors gracefully', async () => {
      vi.mocked(prisma.suggestion.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.suggestion.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Database error'));
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);

      const result = await suggestionEngineService.runAllAlgorithms();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Database error');
    });
  });
});
