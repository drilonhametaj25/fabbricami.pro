import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';

// Mock prisma
const prismaMock = mockDeep<PrismaClient>();
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
  logger: mockLogger,
}));

// Mock notification service
const mockNotificationService = {
  notifyLowStock: jest.fn().mockResolvedValue(undefined),
  notifyPaymentDue: jest.fn().mockResolvedValue(undefined),
  notifyPaymentOverdue: jest.fn().mockResolvedValue(undefined),
  notifyTaskOverdue: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@server/services/notification.service', () => ({
  __esModule: true,
  default: mockNotificationService,
}));

// Mock queue manager
const mockQueueManager = {
  createWorker: jest.fn().mockReturnValue({ on: jest.fn() }),
  addRecurringJob: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@server/services/queue.service', () => ({
  __esModule: true,
  default: mockQueueManager,
}));

// Helper to create Decimal mock
const createDecimalMock = (value: number | string): Prisma.Decimal => {
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  return {
    toNumber: () => numVal,
    toString: () => String(numVal),
    toFixed: (dp?: number) => numVal.toFixed(dp),
    valueOf: () => numVal,
  } as unknown as Prisma.Decimal;
};

// Import after mocks
import {
  checkLowStockJob,
  checkPaymentsDueJob,
  checkOverdueTasksJob,
  checkCalendarRemindersJob,
  initNotificationJobs,
} from '@server/jobs/notification.job';

describe('Notification Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReset(prismaMock);
  });

  describe('checkLowStockJob', () => {
    it('should find low stock products and send notifications', async () => {
      const lowStockProducts = [
        { id: 'prod-1', name: 'Product 1', sku: 'SKU-001', min_stock: 10, current_stock: 5 },
        { id: 'prod-2', name: 'Product 2', sku: 'SKU-002', min_stock: 20, current_stock: 0 },
      ];

      prismaMock.$queryRaw.mockResolvedValue(lowStockProducts);

      await checkLowStockJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Checking low stock levels...');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 products with low stock');
      expect(mockNotificationService.notifyLowStock).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.notifyLowStock).toHaveBeenCalledWith(
        'prod-1',
        'Product 1',
        5,
        10
      );
      expect(mockNotificationService.notifyLowStock).toHaveBeenCalledWith(
        'prod-2',
        'Product 2',
        0,
        20
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Low stock check completed');
    });

    it('should handle no low stock products', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await checkLowStockJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Found 0 products with low stock');
      expect(mockNotificationService.notifyLowStock).not.toHaveBeenCalled();
    });

    it('should handle null current_stock', async () => {
      const lowStockProducts = [
        { id: 'prod-1', name: 'Product 1', sku: 'SKU-001', min_stock: 10, current_stock: null },
      ];

      prismaMock.$queryRaw.mockResolvedValue(lowStockProducts);

      await checkLowStockJob({});

      expect(mockNotificationService.notifyLowStock).toHaveBeenCalledWith(
        'prod-1',
        'Product 1',
        0, // Should default to 0
        10
      );
    });

    it('should throw error on database failure', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('Database error'));

      await expect(checkLowStockJob({})).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Low stock check failed: Database error');
    });
  });

  describe('checkPaymentsDueJob', () => {
    it('should find invoices due in 3 days and send notifications', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);

      const dueInvoices = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          total: createDecimalMock(1000),
          dueDate: futureDate,
          status: 'ISSUED',
          customer: { businessName: 'ACME Corp' },
        },
      ];

      prismaMock.invoice.findMany
        .mockResolvedValueOnce(dueInvoices as any) // Due invoices
        .mockResolvedValueOnce([]); // Overdue invoices

      await checkPaymentsDueJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Checking payments due...');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 1 invoices due in 3 days');
      expect(mockNotificationService.notifyPaymentDue).toHaveBeenCalledWith(
        'inv-1',
        'INV-001',
        1000,
        futureDate
      );
    });

    it('should find overdue invoices and update status', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const overdueInvoices = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          total: createDecimalMock(500),
          dueDate: pastDate,
          status: 'ISSUED',
        },
      ];

      prismaMock.invoice.findMany
        .mockResolvedValueOnce([]) // Due invoices
        .mockResolvedValueOnce(overdueInvoices as any); // Overdue invoices
      prismaMock.invoice.update.mockResolvedValue(overdueInvoices[0] as any);

      await checkPaymentsDueJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Found 1 overdue invoices');
      expect(prismaMock.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'OVERDUE' },
      });
      expect(mockNotificationService.notifyPaymentOverdue).toHaveBeenCalledWith(
        'inv-1',
        'INV-001',
        500
      );
    });

    it('should not update status if already OVERDUE', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const overdueInvoices = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-001',
          total: createDecimalMock(500),
          dueDate: pastDate,
          status: 'OVERDUE', // Already overdue
        },
      ];

      prismaMock.invoice.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(overdueInvoices as any);

      await checkPaymentsDueJob({});

      expect(prismaMock.invoice.update).not.toHaveBeenCalled();
      expect(mockNotificationService.notifyPaymentOverdue).toHaveBeenCalled();
    });

    it('should handle no invoices due', async () => {
      prismaMock.invoice.findMany.mockResolvedValue([]);

      await checkPaymentsDueJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Found 0 invoices due in 3 days');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 0 overdue invoices');
      expect(mockNotificationService.notifyPaymentDue).not.toHaveBeenCalled();
      expect(mockNotificationService.notifyPaymentOverdue).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      prismaMock.invoice.findMany.mockRejectedValue(new Error('Database error'));

      await expect(checkPaymentsDueJob({})).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Payments due check failed: Database error');
    });
  });

  describe('checkOverdueTasksJob', () => {
    it('should find overdue tasks and send notifications', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const overdueTasks = [
        {
          id: 'task-1',
          title: 'Complete report',
          status: 'TODO',
          dueDate: pastDate,
          assignedToId: 'user-1',
          assignedTo: { id: 'user-1', email: 'user@example.com' },
        },
        {
          id: 'task-2',
          title: 'Review code',
          status: 'IN_PROGRESS',
          dueDate: pastDate,
          assignedToId: 'user-2',
          assignedTo: { id: 'user-2', email: 'user2@example.com' },
        },
      ];

      prismaMock.task.findMany.mockResolvedValue(overdueTasks as any);

      await checkOverdueTasksJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Checking overdue tasks...');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 overdue tasks');
      expect(mockNotificationService.notifyTaskOverdue).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.notifyTaskOverdue).toHaveBeenCalledWith(
        'user-1',
        'task-1',
        'Complete report'
      );
      expect(mockNotificationService.notifyTaskOverdue).toHaveBeenCalledWith(
        'user-2',
        'task-2',
        'Review code'
      );
    });

    it('should skip tasks without assignedTo', async () => {
      const overdueTasks = [
        {
          id: 'task-1',
          title: 'Unassigned task',
          status: 'TODO',
          dueDate: new Date(),
          assignedToId: null,
          assignedTo: null,
        },
      ];

      prismaMock.task.findMany.mockResolvedValue(overdueTasks as any);

      await checkOverdueTasksJob({});

      expect(mockNotificationService.notifyTaskOverdue).not.toHaveBeenCalled();
    });

    it('should handle no overdue tasks', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await checkOverdueTasksJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Found 0 overdue tasks');
      expect(mockNotificationService.notifyTaskOverdue).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      prismaMock.task.findMany.mockRejectedValue(new Error('Database error'));

      await expect(checkOverdueTasksJob({})).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Overdue tasks check failed: Database error');
    });
  });

  describe('checkCalendarRemindersJob', () => {
    it('should find upcoming events with reminders', async () => {
      const upcomingEvents = [
        {
          id: 'event-1',
          title: 'Team Meeting',
          startDate: new Date(),
          reminderMinutes: 15,
        },
        {
          id: 'event-2',
          title: 'Client Call',
          startDate: new Date(),
          reminderMinutes: 30,
        },
      ];

      prismaMock.calendarEvent.findMany.mockResolvedValue(upcomingEvents as any);

      await checkCalendarRemindersJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Checking calendar reminders...');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 upcoming events with reminders');
      expect(mockLogger.info).toHaveBeenCalledWith('Reminder for event: Team Meeting');
      expect(mockLogger.info).toHaveBeenCalledWith('Reminder for event: Client Call');
    });

    it('should handle no upcoming events', async () => {
      prismaMock.calendarEvent.findMany.mockResolvedValue([]);

      await checkCalendarRemindersJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Found 0 upcoming events with reminders');
    });

    it('should throw error on database failure', async () => {
      prismaMock.calendarEvent.findMany.mockRejectedValue(new Error('Database error'));

      await expect(checkCalendarRemindersJob({})).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Calendar reminders check failed: Database error');
    });
  });

  describe('initNotificationJobs', () => {
    it('should create worker for notifications queue', () => {
      initNotificationJobs();

      expect(mockQueueManager.createWorker).toHaveBeenCalledWith(
        'notifications',
        expect.any(Function),
        2
      );
    });

    it('should schedule low-stock check every hour', () => {
      initNotificationJobs();

      expect(mockQueueManager.addRecurringJob).toHaveBeenCalledWith(
        'notifications',
        'check-low-stock',
        { type: 'low-stock' },
        '0 * * * *'
      );
    });

    it('should schedule payment-due check daily at 9:00', () => {
      initNotificationJobs();

      expect(mockQueueManager.addRecurringJob).toHaveBeenCalledWith(
        'notifications',
        'check-payments-due',
        { type: 'payment-due' },
        '0 9 * * *'
      );
    });

    it('should schedule overdue tasks check every 2 hours', () => {
      initNotificationJobs();

      expect(mockQueueManager.addRecurringJob).toHaveBeenCalledWith(
        'notifications',
        'check-overdue-tasks',
        { type: 'task-overdue' },
        '0 */2 * * *'
      );
    });

    it('should schedule calendar reminders every 15 minutes', () => {
      initNotificationJobs();

      expect(mockQueueManager.addRecurringJob).toHaveBeenCalledWith(
        'notifications',
        'check-calendar-reminders',
        { type: 'calendar-reminder' },
        '*/15 * * * *'
      );
    });

    it('should log initialization complete', () => {
      initNotificationJobs();

      expect(mockLogger.info).toHaveBeenCalledWith('Notification jobs initialized');
    });

    describe('worker job processing', () => {
      it('should process low-stock job type', async () => {
        initNotificationJobs();

        // Get the worker callback
        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        prismaMock.$queryRaw.mockResolvedValue([]);

        await workerCallback({ data: { type: 'low-stock' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Checking low stock levels...');
      });

      it('should process payment-due job type', async () => {
        initNotificationJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        prismaMock.invoice.findMany.mockResolvedValue([]);

        await workerCallback({ data: { type: 'payment-due' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Checking payments due...');
      });

      it('should process task-overdue job type', async () => {
        initNotificationJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        prismaMock.task.findMany.mockResolvedValue([]);

        await workerCallback({ data: { type: 'task-overdue' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Checking overdue tasks...');
      });

      it('should process calendar-reminder job type', async () => {
        initNotificationJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        prismaMock.calendarEvent.findMany.mockResolvedValue([]);

        await workerCallback({ data: { type: 'calendar-reminder' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Checking calendar reminders...');
      });

      it('should warn for unknown job type', async () => {
        initNotificationJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        await workerCallback({ data: { type: 'unknown-type' } });

        expect(mockLogger.warn).toHaveBeenCalledWith('Unknown notification job type: unknown-type');
      });
    });
  });
});
