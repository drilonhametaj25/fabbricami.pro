/**
 * Dashboard Service Tests
 * Tests for the intelligent "What to do today" dashboard
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

// Mock suggestion engine service
jest.mock('@server/services/suggestion-engine.service', () => ({
  suggestionEngineService: {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getStats: jest.fn().mockResolvedValue({
      total: 0,
      pending: 0,
      byType: {},
      byPriority: {},
    }),
  },
}));

// Mock Prisma
jest.mock('@server/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    task: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productionOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    customer: {
      count: jest.fn(),
    },
    suggestion: {
      count: jest.fn(),
    },
    calendarEvent: {
      findMany: jest.fn(),
    },
    userDashboardPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

import { dashboardService } from '@server/services/dashboard.service';
import { prisma } from '@server/config/database';
import { suggestionEngineService } from '@server/services/suggestion-engine.service';

describe('DashboardService', () => {
  const mockUser = {
    id: 'user-1',
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario@test.com',
    role: 'ADMIN' as const,
    employee: null,
    dashboardPreference: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Date to a known time for consistent greeting tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T10:30:00'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getTodayDashboard', () => {
    it('should return complete dashboard data', async () => {
      // Mock user lookup
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Mock context queries for greeting
      (prisma.order.count as jest.Mock).mockResolvedValue(5);
      (prisma.task.count as jest.Mock).mockResolvedValue(3);
      (prisma.productionOrder.count as jest.Mock).mockResolvedValue(2);

      // Mock KPI queries
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _count: 10,
        _sum: { total: 5000 },
      });

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(5) }]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(2);

      // Mock urgent tasks
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.productionOrder.findMany as jest.Mock).mockResolvedValue([]);

      // Mock day plan
      (prisma.calendarEvent.findMany as jest.Mock).mockResolvedValue([]);

      // Mock quick stats
      (prisma.customer.count as jest.Mock).mockResolvedValue(10);
      (prisma.suggestion.count as jest.Mock).mockResolvedValue(5);

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result).toHaveProperty('greeting');
      expect(result).toHaveProperty('dailyKpis');
      expect(result).toHaveProperty('urgentTasks');
      expect(result).toHaveProperty('dayPlan');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('quickStats');
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(dashboardService.getTodayDashboard('non-existent'))
        .rejects.toThrow('Utente non trovato');
    });
  });

  describe('greeting', () => {
    it('should return "Buongiorno" before noon', async () => {
      jest.setSystemTime(new Date('2024-06-15T09:00:00'));
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockAllPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.greeting.message).toContain('Buongiorno');
      expect(result.greeting.message).toContain('Mario');
    });

    it('should return "Buon pomeriggio" in the afternoon', async () => {
      jest.setSystemTime(new Date('2024-06-15T15:00:00'));
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockAllPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.greeting.message).toContain('Buon pomeriggio');
    });

    it('should return "Buonasera" in the evening', async () => {
      jest.setSystemTime(new Date('2024-06-15T19:00:00'));
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockAllPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.greeting.message).toContain('Buonasera');
    });

    it('should include contextual sub-message with orders and tasks', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.order.count as jest.Mock).mockResolvedValue(7);
      (prisma.task.count as jest.Mock).mockResolvedValue(4);
      (prisma.productionOrder.count as jest.Mock).mockResolvedValue(3);
      mockRemainingPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.greeting.subMessage).toContain('7 nuovi ordini oggi');
      expect(result.greeting.subMessage).toContain('4 task in scadenza');
      expect(result.greeting.subMessage).toContain('3 produzioni attive');
    });

    it('should return default message when no activities', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      (prisma.task.count as jest.Mock).mockResolvedValue(0);
      (prisma.productionOrder.count as jest.Mock).mockResolvedValue(0);
      mockRemainingPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.greeting.subMessage).toBe('Ecco la tua panoramica giornaliera.');
    });
  });

  describe('dailyKpis', () => {
    it('should return orders and revenue KPIs', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockContextQueries();

      // Today's orders
      (prisma.order.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _count: 10, _sum: { total: 5000 } })
        .mockResolvedValueOnce({ _count: 8, _sum: { total: 4000 } });

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(3) }]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(2);

      mockUrgentTasksQueries();
      mockDayPlanQueries();
      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.dailyKpis.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'orders_today', value: 10 }),
          expect.objectContaining({ id: 'revenue_today', value: expect.stringContaining('5000') }),
        ])
      );
    });

    it('should calculate change percentage correctly', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockContextQueries();

      (prisma.order.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _count: 15, _sum: { total: 3000 } })
        .mockResolvedValueOnce({ _count: 10, _sum: { total: 2000 } });

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(0) }]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      mockUrgentTasksQueries();
      mockDayPlanQueries();
      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      const ordersKpi = result.dailyKpis.items.find(k => k.id === 'orders_today');
      expect(ordersKpi?.changePercent).toBe(50); // (15-10)/10 * 100 = 50%
      expect(ordersKpi?.trend).toBe('up');
    });

    it('should include low stock KPI for warehouse roles', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'MAGAZZINIERE',
      });
      mockContextQueries();

      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _count: 5,
        _sum: { total: 1000 },
      });

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(8) }]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      mockUrgentTasksQueries();
      mockDayPlanQueries();
      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.dailyKpis.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'low_stock', value: 8 }),
        ])
      );
    });
  });

  describe('urgentTasks', () => {
    it('should return user assigned tasks', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockContextQueries();
      mockKpiQueries();

      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'task-1',
          title: 'Urgent Task',
          description: 'Test description',
          priority: 'URGENT',
          dueDate: new Date('2024-06-15'),
        },
      ]);

      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.productionOrder.findMany as jest.Mock).mockResolvedValue([]);

      mockDayPlanQueries();
      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.urgentTasks.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'TASK',
            title: 'Urgent Task',
            priority: 'CRITICAL',
          }),
        ])
      );
    });

    it('should include urgent orders for commercial roles', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'COMMERCIALE',
      });
      mockContextQueries();
      mockKpiQueries();

      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          total: 500,
          priority: 2,
          orderDate: new Date(),
          customerId: 'cust-1',
          customer: { businessName: 'Test Company', firstName: null, lastName: null },
        },
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.productionOrder.findMany as jest.Mock).mockResolvedValue([]);

      mockDayPlanQueries();
      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.urgentTasks.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'ORDER',
            title: 'Ordine ORD-001',
            priority: 'CRITICAL',
          }),
        ])
      );
    });

    it('should sort tasks by priority', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockContextQueries();
      mockKpiQueries();

      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { id: 't1', title: 'Medium', priority: 'MEDIUM', dueDate: new Date() },
        { id: 't2', title: 'High', priority: 'HIGH', dueDate: new Date() },
        { id: 't3', title: 'Urgent', priority: 'URGENT', dueDate: new Date() },
      ]);
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.productionOrder.findMany as jest.Mock).mockResolvedValue([]);

      mockDayPlanQueries();
      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      const priorities = result.urgentTasks.items.map(t => t.priority);
      expect(priorities).toEqual(['CRITICAL', 'HIGH', 'MEDIUM']);
    });
  });

  describe('dayPlan', () => {
    it('should return calendar events and tasks for today', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockContextQueries();
      mockKpiQueries();
      mockUrgentTasksQueries();

      (prisma.calendarEvent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'event-1',
          title: 'Team Meeting',
          description: 'Daily standup',
          startDate: new Date('2024-06-15T09:00:00'),
          eventType: 'meeting',
        },
      ]);

      (prisma.task.findMany as jest.Mock).mockImplementation((args) => {
        if (args.where?.assignedToId === 'user-1' && args.where?.dueDate) {
          return Promise.resolve([
            {
              id: 'task-day-1',
              title: 'Complete report',
              dueDate: new Date('2024-06-15T14:00:00'),
              status: 'IN_PROGRESS',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.dayPlan.items).toHaveLength(2);
      expect(result.dayPlan.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'MEETING', title: 'Team Meeting' }),
          expect.objectContaining({ type: 'TASK', title: 'Complete report' }),
        ])
      );
    });

    it('should track completed count', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockContextQueries();
      mockKpiQueries();
      mockUrgentTasksQueries();

      (prisma.calendarEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.task.findMany as jest.Mock).mockImplementation((args) => {
        if (args.where?.dueDate) {
          return Promise.resolve([
            { id: 't1', title: 'Task 1', status: 'COMPLETED' },
            { id: 't2', title: 'Task 2', status: 'IN_PROGRESS' },
          ]);
        }
        return Promise.resolve([]);
      });

      mockQuickStatsQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.dayPlan.completedCount).toBe(1);
      expect(result.dayPlan.totalCount).toBe(2);
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences if they exist', async () => {
      (prisma.userDashboardPreference.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        emailDailyDigest: false,
        emailWeeklyDigest: true,
        emailUrgentAlerts: true,
        showSuggestions: false,
        defaultDateRange: '30d',
        showKpis: true,
        showUrgentTasks: false,
        showDayPlan: true,
        compactMode: true,
      });

      const result = await dashboardService.getPreferences('user-1');

      expect(result.emailDailyDigest).toBe(false);
      expect(result.showSuggestions).toBe(false);
      expect(result.compactMode).toBe(true);
    });

    it('should return default preferences if none exist', async () => {
      (prisma.userDashboardPreference.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await dashboardService.getPreferences('user-1');

      expect(result.emailDailyDigest).toBe(true);
      expect(result.showSuggestions).toBe(true);
      expect(result.compactMode).toBe(false);
      expect(result.defaultDateRange).toBe('7d');
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      (prisma.userDashboardPreference.upsert as jest.Mock).mockResolvedValue({});
      (prisma.userDashboardPreference.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        emailDailyDigest: false,
        emailWeeklyDigest: true,
        emailUrgentAlerts: true,
        showSuggestions: true,
        defaultDateRange: '30d',
        showKpis: true,
        showUrgentTasks: true,
        showDayPlan: true,
        compactMode: true,
      });

      const result = await dashboardService.updatePreferences('user-1', {
        emailDailyDigest: false,
        compactMode: true,
        defaultDateRange: '30d',
      });

      expect(prisma.userDashboardPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        })
      );
      expect(result.emailDailyDigest).toBe(false);
      expect(result.compactMode).toBe(true);
    });
  });

  describe('getKpis', () => {
    it('should return KPIs for specified date range', async () => {
      (prisma.order.count as jest.Mock).mockResolvedValue(50);
      (prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { total: 10000 },
      });
      (prisma.customer.count as jest.Mock).mockResolvedValue(15);

      const result = await dashboardService.getKpis({ dateRange: '7d' });

      expect(result).toHaveProperty('current');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('changes');
      expect(result.dateRange).toBe('7d');
    });

    it('should calculate changes correctly', async () => {
      // Current period: 100 orders, 10000 revenue
      // Previous period: 80 orders, 8000 revenue
      (prisma.order.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);
      (prisma.order.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { total: 10000 } })
        .mockResolvedValueOnce({ _sum: { total: 8000 } });
      (prisma.customer.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40);

      const result = await dashboardService.getKpis({ dateRange: '30d' });

      expect(result.changes.orders).toBe(25); // (100-80)/80 * 100
      expect(result.changes.revenue).toBe(25); // (10000-8000)/8000 * 100
      expect(result.changes.newCustomers).toBe(25); // (50-40)/40 * 100
    });
  });

  describe('suggestions integration', () => {
    it('should include suggestions from suggestion engine', async () => {
      const mockSuggestions = [
        {
          id: 'sug-1',
          type: 'STOCKOUT_ALERT',
          title: 'Low stock warning',
          priority: 'HIGH',
        },
      ];

      (suggestionEngineService.list as jest.Mock).mockResolvedValue({
        items: mockSuggestions,
        total: 1,
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      mockAllPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.suggestions.items).toEqual(mockSuggestions);
      expect(result.suggestions.total).toBe(1);
    });

    it('should hide suggestions when preferences disable them', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        dashboardPreference: { showSuggestions: false },
      });
      mockAllPrismaQueries();

      const result = await dashboardService.getTodayDashboard('user-1');

      expect(result.suggestions.items).toEqual([]);
      expect(result.suggestions.total).toBe(0);
    });
  });

  // Helper functions to mock Prisma queries
  function mockAllPrismaQueries() {
    mockContextQueries();
    mockKpiQueries();
    mockUrgentTasksQueries();
    mockDayPlanQueries();
    mockQuickStatsQueries();
  }

  function mockContextQueries() {
    (prisma.order.count as jest.Mock).mockResolvedValue(0);
    (prisma.task.count as jest.Mock).mockResolvedValue(0);
    (prisma.productionOrder.count as jest.Mock).mockResolvedValue(0);
  }

  function mockRemainingPrismaQueries() {
    mockKpiQueries();
    mockUrgentTasksQueries();
    mockDayPlanQueries();
    mockQuickStatsQueries();
  }

  function mockKpiQueries() {
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({
      _count: 0,
      _sum: { total: 0 },
    });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(0) }]);
    (prisma.invoice.count as jest.Mock).mockResolvedValue(0);
  }

  function mockUrgentTasksQueries() {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.productionOrder.findMany as jest.Mock).mockResolvedValue([]);
  }

  function mockDayPlanQueries() {
    (prisma.calendarEvent.findMany as jest.Mock).mockResolvedValue([]);
  }

  function mockQuickStatsQueries() {
    (prisma.customer.count as jest.Mock).mockResolvedValue(0);
    (prisma.suggestion.count as jest.Mock).mockResolvedValue(0);
  }
});
