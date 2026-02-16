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
}));

// Mock alert service
const mockAlertService = {
  checkAllStockAlerts: jest.fn(),
  filterRecentAlerts: jest.fn(),
  sendAlertNotifications: jest.fn(),
  getAlertStats: jest.fn(),
};

jest.mock('@server/services/alert.service', () => ({
  __esModule: true,
  default: mockAlertService,
}));

// Mock queue manager
const mockQueueManager = {
  createWorker: jest.fn().mockReturnValue({ on: jest.fn() }),
  addRecurringJob: jest.fn().mockResolvedValue(undefined),
  addJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

jest.mock('@server/services/queue.service', () => ({
  __esModule: true,
  default: mockQueueManager,
}));

// Import after mocks
import {
  checkStockAlertsJob,
  checkExpiringLotsJob,
  postShipmentCheckJob,
  getAlertStatsJob,
  initStockAlertJobs,
  triggerStockCheck,
  triggerPostShipmentCheck,
} from '@server/jobs/stock-alert.job';

describe('Stock Alert Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkStockAlertsJob', () => {
    it('should check all stock alerts and send notifications', async () => {
      const alerts = [
        { type: 'OUT_OF_STOCK', entityType: 'product', entityId: 'prod-1' },
        { type: 'LOW_STOCK', entityType: 'product', entityId: 'prod-2' },
      ];

      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts,
      });
      mockAlertService.filterRecentAlerts.mockResolvedValue(alerts);
      mockAlertService.sendAlertNotifications.mockResolvedValue(2);

      await checkStockAlertsJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Starting stock alerts check...');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stock check completed: 100 products, 50 materials, 2 alerts found'
      );
      expect(mockAlertService.filterRecentAlerts).toHaveBeenCalledWith(alerts);
      expect(mockAlertService.sendAlertNotifications).toHaveBeenCalledWith(alerts);
      expect(mockLogger.info).toHaveBeenCalledWith('Sent 2 alert notifications');
      expect(mockLogger.info).toHaveBeenCalledWith('Stock alerts check completed');
    });

    it('should skip when no alerts found', async () => {
      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts: [],
      });

      await checkStockAlertsJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('No stock alerts to send');
      expect(mockAlertService.filterRecentAlerts).not.toHaveBeenCalled();
      expect(mockAlertService.sendAlertNotifications).not.toHaveBeenCalled();
    });

    it('should skip when all alerts already notified in last 24h', async () => {
      const alerts = [
        { type: 'OUT_OF_STOCK', entityType: 'product', entityId: 'prod-1' },
      ];

      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts,
      });
      mockAlertService.filterRecentAlerts.mockResolvedValue([]); // All filtered out

      await checkStockAlertsJob({});

      expect(mockLogger.info).toHaveBeenCalledWith(
        'All alerts already notified in last 24h, skipping'
      );
      expect(mockAlertService.sendAlertNotifications).not.toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      mockAlertService.checkAllStockAlerts.mockRejectedValue(new Error('Service error'));

      await expect(checkStockAlertsJob({})).rejects.toThrow('Service error');
      expect(mockLogger.error).toHaveBeenCalledWith('Stock alerts check failed: Service error');
    });
  });

  describe('checkExpiringLotsJob', () => {
    it('should check expiring lots and send notifications', async () => {
      const alerts = [
        { type: 'EXPIRING_SOON', entityType: 'product', entityId: 'prod-1' },
        { type: 'EXPIRING_SOON', entityType: 'material', entityId: 'mat-1' },
        { type: 'LOW_STOCK', entityType: 'product', entityId: 'prod-2' }, // Should be filtered out
      ];

      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts,
      });
      const expiringAlerts = alerts.filter((a) => a.type === 'EXPIRING_SOON');
      mockAlertService.filterRecentAlerts.mockResolvedValue(expiringAlerts);
      mockAlertService.sendAlertNotifications.mockResolvedValue(2);

      await checkExpiringLotsJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Starting expiring lots check...');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 expiring lots');
      expect(mockAlertService.filterRecentAlerts).toHaveBeenCalledWith(expiringAlerts);
      expect(mockAlertService.sendAlertNotifications).toHaveBeenCalledWith(expiringAlerts);
      expect(mockLogger.info).toHaveBeenCalledWith('Sent 2 expiring lot notifications');
    });

    it('should skip when no expiring lots found', async () => {
      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts: [
          { type: 'OUT_OF_STOCK', entityType: 'product', entityId: 'prod-1' },
        ],
      });

      await checkExpiringLotsJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('No expiring lots found');
      expect(mockAlertService.filterRecentAlerts).not.toHaveBeenCalled();
    });

    it('should skip notifications when all alerts already notified', async () => {
      const alerts = [
        { type: 'EXPIRING_SOON', entityType: 'product', entityId: 'prod-1' },
      ];

      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts,
      });
      mockAlertService.filterRecentAlerts.mockResolvedValue([]);

      await checkExpiringLotsJob({});

      expect(mockAlertService.sendAlertNotifications).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Expiring lots check completed');
    });

    it('should throw error on failure', async () => {
      mockAlertService.checkAllStockAlerts.mockRejectedValue(new Error('Service error'));

      await expect(checkExpiringLotsJob({})).rejects.toThrow('Service error');
      expect(mockLogger.error).toHaveBeenCalledWith('Expiring lots check failed: Service error');
    });
  });

  describe('postShipmentCheckJob', () => {
    it('should check critical alerts after shipment and send notifications', async () => {
      const alerts = [
        { type: 'OUT_OF_STOCK', entityType: 'product', entityId: 'prod-1' },
        { type: 'LOW_STOCK', entityType: 'product', entityId: 'prod-2' },
        { type: 'REORDER_POINT', entityType: 'product', entityId: 'prod-3' }, // Not critical
      ];

      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts,
      });
      mockAlertService.sendAlertNotifications.mockResolvedValue(2);

      await postShipmentCheckJob({ data: { orderId: 'order-123' } });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Post-shipment stock check for order order-123...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 critical alerts after shipment');
      expect(mockAlertService.sendAlertNotifications).toHaveBeenCalledWith([
        { type: 'OUT_OF_STOCK', entityType: 'product', entityId: 'prod-1' },
        { type: 'LOW_STOCK', entityType: 'product', entityId: 'prod-2' },
      ]);
    });

    it('should skip notifications when no critical alerts found', async () => {
      mockAlertService.checkAllStockAlerts.mockResolvedValue({
        productsChecked: 100,
        materialsChecked: 50,
        alerts: [
          { type: 'REORDER_POINT', entityType: 'product', entityId: 'prod-1' },
        ],
      });

      await postShipmentCheckJob({ data: { orderId: 'order-123' } });

      expect(mockAlertService.sendAlertNotifications).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Post-shipment check completed');
    });

    it('should throw error on failure', async () => {
      mockAlertService.checkAllStockAlerts.mockRejectedValue(new Error('Service error'));

      await expect(
        postShipmentCheckJob({ data: { orderId: 'order-123' } })
      ).rejects.toThrow('Service error');
      expect(mockLogger.error).toHaveBeenCalledWith('Post-shipment check failed: Service error');
    });
  });

  describe('getAlertStatsJob', () => {
    it('should return alert stats', async () => {
      const stats = {
        totalAlerts: 10,
        byType: { OUT_OF_STOCK: 3, LOW_STOCK: 5, REORDER_POINT: 2 },
        byEntityType: { product: 7, material: 3 },
      };

      mockAlertService.getAlertStats.mockResolvedValue(stats);

      const result = await getAlertStatsJob({});

      expect(mockLogger.info).toHaveBeenCalledWith('Getting alert stats...');
      expect(mockLogger.info).toHaveBeenCalledWith('Alert stats: 10 total alerts');
      expect(result).toEqual(stats);
    });

    it('should throw error on failure', async () => {
      mockAlertService.getAlertStats.mockRejectedValue(new Error('Stats error'));

      await expect(getAlertStatsJob({})).rejects.toThrow('Stats error');
      expect(mockLogger.error).toHaveBeenCalledWith('Get alert stats failed: Stats error');
    });
  });

  describe('initStockAlertJobs', () => {
    it('should create worker for stock-alerts queue', () => {
      initStockAlertJobs();

      expect(mockQueueManager.createWorker).toHaveBeenCalledWith(
        'stock-alerts',
        expect.any(Function),
        1
      );
    });

    it('should schedule stock-check every hour', () => {
      initStockAlertJobs();

      expect(mockQueueManager.addRecurringJob).toHaveBeenCalledWith(
        'stock-alerts',
        'check-stock-alerts',
        { type: 'stock-check' },
        '0 * * * *'
      );
    });

    it('should schedule expiry-check daily at 8:00', () => {
      initStockAlertJobs();

      expect(mockQueueManager.addRecurringJob).toHaveBeenCalledWith(
        'stock-alerts',
        'check-expiring-lots',
        { type: 'expiry-check' },
        '0 8 * * *'
      );
    });

    it('should log initialization complete', () => {
      initStockAlertJobs();

      expect(mockLogger.info).toHaveBeenCalledWith('Stock alert jobs initialized');
    });

    describe('worker job processing', () => {
      it('should process stock-check job type', async () => {
        initStockAlertJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        mockAlertService.checkAllStockAlerts.mockResolvedValue({
          productsChecked: 0,
          materialsChecked: 0,
          alerts: [],
        });

        await workerCallback({ data: { type: 'stock-check' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Starting stock alerts check...');
      });

      it('should process expiry-check job type', async () => {
        initStockAlertJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        mockAlertService.checkAllStockAlerts.mockResolvedValue({
          productsChecked: 0,
          materialsChecked: 0,
          alerts: [],
        });

        await workerCallback({ data: { type: 'expiry-check' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Starting expiring lots check...');
      });

      it('should process shipment-triggered job type', async () => {
        initStockAlertJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        mockAlertService.checkAllStockAlerts.mockResolvedValue({
          productsChecked: 0,
          materialsChecked: 0,
          alerts: [],
        });

        await workerCallback({ data: { type: 'shipment-triggered', orderId: 'order-1' } });

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Post-shipment stock check for order order-1...'
        );
      });

      it('should process get-stats job type', async () => {
        initStockAlertJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        mockAlertService.getAlertStats.mockResolvedValue({ totalAlerts: 0 });

        await workerCallback({ data: { type: 'get-stats' } });

        expect(mockLogger.info).toHaveBeenCalledWith('Getting alert stats...');
      });

      it('should warn for unknown job type', async () => {
        initStockAlertJobs();

        const workerCallback = mockQueueManager.createWorker.mock.calls[0][1];

        await workerCallback({ data: { type: 'unknown-type' } });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Unknown stock alert job type: unknown-type'
        );
      });
    });
  });

  describe('triggerStockCheck', () => {
    it('should add manual stock check job to queue', async () => {
      await triggerStockCheck();

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'stock-alerts',
        'manual-stock-check',
        expect.objectContaining({
          type: 'stock-check',
          manual: true,
          triggeredAt: expect.any(String),
        })
      );
    });
  });

  describe('triggerPostShipmentCheck', () => {
    it('should add post-shipment check job to queue', async () => {
      await triggerPostShipmentCheck('order-123');

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'stock-alerts',
        'post-shipment-order-123',
        expect.objectContaining({
          type: 'shipment-triggered',
          orderId: 'order-123',
          triggeredAt: expect.any(String),
        })
      );
    });
  });
});
