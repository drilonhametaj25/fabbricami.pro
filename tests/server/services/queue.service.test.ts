// Mock logger (default export)
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock redis connection
jest.mock('@server/config/redis', () => ({
  redisConnection: { host: 'localhost', port: 6379 },
}));

// Mock Queue and Worker
const mockQueueAdd = jest.fn();
const mockQueueClean = jest.fn();
const mockQueuePause = jest.fn();
const mockQueueResume = jest.fn();
const mockQueueClose = jest.fn();
const mockQueueRemoveRepeatableByKey = jest.fn();
const mockQueueGetWaitingCount = jest.fn();
const mockQueueGetActiveCount = jest.fn();
const mockQueueGetCompletedCount = jest.fn();
const mockQueueGetFailedCount = jest.fn();
const mockQueueGetDelayedCount = jest.fn();

const createMockQueue = () => ({
  add: mockQueueAdd,
  clean: mockQueueClean,
  pause: mockQueuePause,
  resume: mockQueueResume,
  close: mockQueueClose,
  removeRepeatableByKey: mockQueueRemoveRepeatableByKey,
  getWaitingCount: mockQueueGetWaitingCount,
  getActiveCount: mockQueueGetActiveCount,
  getCompletedCount: mockQueueGetCompletedCount,
  getFailedCount: mockQueueGetFailedCount,
  getDelayedCount: mockQueueGetDelayedCount,
});

const mockWorkerOn = jest.fn();
const mockWorkerClose = jest.fn();

const createMockWorker = () => ({
  on: mockWorkerOn,
  close: mockWorkerClose,
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => createMockQueue()),
  Worker: jest.fn().mockImplementation(() => createMockWorker()),
}));

// Import after mocks - need fresh instance for each test
// Since queueManager is a singleton, we need to reset module between tests
let queueManager: typeof import('@server/services/queue.service').default;

describe('Queue Service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset the module to get a fresh instance
    jest.resetModules();
    // Re-apply mocks after reset
    jest.mock('@server/config/logger', () => ({
      __esModule: true,
      default: mockLogger,
    }));
    jest.mock('@server/config/redis', () => ({
      redisConnection: { host: 'localhost', port: 6379 },
    }));
    jest.mock('bullmq', () => ({
      Queue: jest.fn().mockImplementation(() => createMockQueue()),
      Worker: jest.fn().mockImplementation(() => createMockWorker()),
    }));
    // Import fresh instance
    const module = await import('@server/services/queue.service');
    queueManager = module.default;

    // Default mock return values
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });
    mockQueueClean.mockResolvedValue(undefined);
    mockQueuePause.mockResolvedValue(undefined);
    mockQueueResume.mockResolvedValue(undefined);
    mockQueueClose.mockResolvedValue(undefined);
    mockQueueRemoveRepeatableByKey.mockResolvedValue(undefined);
    mockQueueGetWaitingCount.mockResolvedValue(5);
    mockQueueGetActiveCount.mockResolvedValue(2);
    mockQueueGetCompletedCount.mockResolvedValue(100);
    mockQueueGetFailedCount.mockResolvedValue(3);
    mockQueueGetDelayedCount.mockResolvedValue(1);
    mockWorkerClose.mockResolvedValue(undefined);
  });

  // =============================================
  // GET QUEUE
  // =============================================
  describe('getQueue', () => {
    it('should create new queue when it does not exist', () => {
      const queue = queueManager.getQueue('test-queue');

      expect(queue).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Queue created: test-queue');
    });

    it('should return existing queue when already created', () => {
      const queue1 = queueManager.getQueue('existing-queue');
      const queue2 = queueManager.getQueue('existing-queue');

      expect(queue1).toBe(queue2);
      // Info should only be called once for creation
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should apply custom config', () => {
      const { Queue } = require('bullmq');

      queueManager.getQueue('custom-queue', {
        attempts: 5,
        backoff: { type: 'fixed', delay: 1000 },
      });

      expect(Queue).toHaveBeenCalledWith(
        'custom-queue',
        expect.objectContaining({
          connection: { host: 'localhost', port: 6379 },
          defaultJobOptions: expect.objectContaining({
            attempts: 5,
            backoff: { type: 'fixed', delay: 1000 },
          }),
        })
      );
    });
  });

  // =============================================
  // CREATE WORKER
  // =============================================
  describe('createWorker', () => {
    it('should create worker with default concurrency', () => {
      const processor = jest.fn();
      const { Worker } = require('bullmq');

      const worker = queueManager.createWorker('worker-queue', processor);

      expect(worker).toBeDefined();
      expect(Worker).toHaveBeenCalledWith(
        'worker-queue',
        processor,
        expect.objectContaining({
          connection: { host: 'localhost', port: 6379 },
          concurrency: 5,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Worker created for queue: worker-queue with concurrency 5'
      );
    });

    it('should create worker with custom concurrency', () => {
      const processor = jest.fn();
      const { Worker } = require('bullmq');

      queueManager.createWorker('high-concurrency-queue', processor, 10);

      expect(Worker).toHaveBeenCalledWith(
        'high-concurrency-queue',
        processor,
        expect.objectContaining({
          concurrency: 10,
        })
      );
    });

    it('should return existing worker when already created', () => {
      const processor = jest.fn();

      const worker1 = queueManager.createWorker('duplicate-queue', processor);
      const worker2 = queueManager.createWorker('duplicate-queue', processor);

      expect(worker1).toBe(worker2);
      expect(mockLogger.warn).toHaveBeenCalledWith('Worker duplicate-queue already exists');
    });

    it('should register event handlers', () => {
      const processor = jest.fn();

      queueManager.createWorker('events-queue', processor);

      expect(mockWorkerOn).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorkerOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  // =============================================
  // ADD JOB
  // =============================================
  describe('addJob', () => {
    it('should add job to queue successfully', async () => {
      const result = await queueManager.addJob('job-queue', 'process-order', {
        orderId: 'order-123',
      });

      expect(result).toEqual({ id: 'job-1' });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'process-order',
        { orderId: 'order-123' },
        undefined
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Job process-order added to queue job-queue with id job-1'
      );
    });

    it('should add job with options', async () => {
      const options = { priority: 1, attempts: 5 };

      await queueManager.addJob('priority-queue', 'urgent-job', { data: 'test' }, options);

      expect(mockQueueAdd).toHaveBeenCalledWith('urgent-job', { data: 'test' }, options);
    });
  });

  // =============================================
  // ADD DELAYED JOB
  // =============================================
  describe('addDelayedJob', () => {
    it('should add job with delay', async () => {
      await queueManager.addDelayedJob('delayed-queue', 'delayed-job', { data: 'test' }, 5000);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'delayed-job',
        { data: 'test' },
        { delay: 5000 }
      );
    });
  });

  // =============================================
  // ADD RECURRING JOB
  // =============================================
  describe('addRecurringJob', () => {
    it('should add job with cron pattern', async () => {
      await queueManager.addRecurringJob('cron-queue', 'hourly-job', { type: 'cleanup' }, '0 * * * *');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'hourly-job',
        { type: 'cleanup' },
        { repeat: { pattern: '0 * * * *' } }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Recurring job hourly-job added to queue cron-queue with cron 0 * * * *'
      );
    });
  });

  // =============================================
  // REMOVE RECURRING JOB
  // =============================================
  describe('removeRecurringJob', () => {
    it('should remove repeatable job by key', async () => {
      await queueManager.removeRecurringJob('cron-queue', 'job-key-123');

      expect(mockQueueRemoveRepeatableByKey).toHaveBeenCalledWith('job-key-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Recurring job job-key-123 removed from queue cron-queue'
      );
    });
  });

  // =============================================
  // GET QUEUE STATS
  // =============================================
  describe('getQueueStats', () => {
    it('should return all queue statistics', async () => {
      const result = await queueManager.getQueueStats('stats-queue');

      expect(result).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        total: 111,
      });
      expect(mockQueueGetWaitingCount).toHaveBeenCalled();
      expect(mockQueueGetActiveCount).toHaveBeenCalled();
      expect(mockQueueGetCompletedCount).toHaveBeenCalled();
      expect(mockQueueGetFailedCount).toHaveBeenCalled();
      expect(mockQueueGetDelayedCount).toHaveBeenCalled();
    });

    it('should calculate total correctly', async () => {
      mockQueueGetWaitingCount.mockResolvedValue(10);
      mockQueueGetActiveCount.mockResolvedValue(5);
      mockQueueGetCompletedCount.mockResolvedValue(50);
      mockQueueGetFailedCount.mockResolvedValue(2);
      mockQueueGetDelayedCount.mockResolvedValue(3);

      const result = await queueManager.getQueueStats('calc-queue');

      expect(result.total).toBe(70);
    });
  });

  // =============================================
  // CLEAN QUEUE
  // =============================================
  describe('cleanQueue', () => {
    it('should clean queue with default grace period', async () => {
      await queueManager.cleanQueue('dirty-queue');

      expect(mockQueueClean).toHaveBeenCalledWith(3600000, 100, 'completed');
      expect(mockQueueClean).toHaveBeenCalledWith(3600000, 100, 'failed');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Queue dirty-queue cleaned (grace period: 3600000ms)'
      );
    });

    it('should clean queue with custom grace period', async () => {
      await queueManager.cleanQueue('custom-clean-queue', 7200000);

      expect(mockQueueClean).toHaveBeenCalledWith(7200000, 100, 'completed');
      expect(mockQueueClean).toHaveBeenCalledWith(7200000, 100, 'failed');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Queue custom-clean-queue cleaned (grace period: 7200000ms)'
      );
    });
  });

  // =============================================
  // PAUSE QUEUE
  // =============================================
  describe('pauseQueue', () => {
    it('should pause queue', async () => {
      await queueManager.pauseQueue('pause-queue');

      expect(mockQueuePause).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Queue pause-queue paused');
    });
  });

  // =============================================
  // RESUME QUEUE
  // =============================================
  describe('resumeQueue', () => {
    it('should resume queue', async () => {
      await queueManager.resumeQueue('resume-queue');

      expect(mockQueueResume).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Queue resume-queue resumed');
    });
  });

  // =============================================
  // CLOSE ALL
  // =============================================
  describe('closeAll', () => {
    it('should close all workers and queues', async () => {
      // Create a queue and worker first
      queueManager.getQueue('close-queue');
      queueManager.createWorker('close-queue', jest.fn());

      await queueManager.closeAll();

      expect(mockWorkerClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Closing all queues and workers...');
      expect(mockLogger.info).toHaveBeenCalledWith('Worker close-queue closed');
      expect(mockLogger.info).toHaveBeenCalledWith('Queue close-queue closed');
    });

    it('should clear internal maps after closing', async () => {
      queueManager.getQueue('map-test-queue');

      await queueManager.closeAll();

      // Creating a new queue should create fresh instance
      jest.clearAllMocks();
      queueManager.getQueue('map-test-queue');
      expect(mockLogger.info).toHaveBeenCalledWith('Queue created: map-test-queue');
    });
  });
});
