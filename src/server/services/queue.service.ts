// Imports
import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import logger from '../config/logger';

// Types/Interfaces
export interface JobData {
  [key: string]: any;
}

export interface QueueConfig {
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

// Constants
const DEFAULT_CONFIG: QueueConfig = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100, // Mantieni ultimi 100 job completati
  removeOnFail: 500, // Mantieni ultimi 500 job falliti
};

/**
 * Queue Manager
 * Gestione centrale code BullMQ per operazioni asincrone
 */
class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  /**
   * Crea o ottieni una queue
   */
  getQueue(name: string, config: QueueConfig = {}): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: redisConnection,
        defaultJobOptions: {
          ...DEFAULT_CONFIG,
          ...config,
        },
      });

      this.queues.set(name, queue);
      logger.info(`Queue created: ${name}`);
    }

    return this.queues.get(name)!;
  }

  /**
   * Crea worker per processare job
   */
  createWorker(
    name: string,
    processor: (job: any) => Promise<any>,
    concurrency: number = 5
  ): Worker {
    if (this.workers.has(name)) {
      logger.warn(`Worker ${name} already exists`);
      return this.workers.get(name)!;
    }

    const worker = new Worker(name, processor, {
      connection: redisConnection,
      concurrency,
    });

    // Event handlers
    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed in queue ${name}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed in queue ${name}: ${err.message}`);
    });

    worker.on('error', (err) => {
      logger.error(`Worker error in queue ${name}: ${err.message}`);
    });

    this.workers.set(name, worker);
    logger.info(`Worker created for queue: ${name} with concurrency ${concurrency}`);

    return worker;
  }

  /**
   * Aggiungi job alla queue
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options?: any
  ) {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, options);

    logger.debug(`Job ${jobName} added to queue ${queueName} with id ${job.id}`);

    return job;
  }

  /**
   * Aggiungi job ritardato
   */
  async addDelayedJob(
    queueName: string,
    jobName: string,
    data: JobData,
    delayMs: number
  ) {
    return this.addJob(queueName, jobName, data, { delay: delayMs });
  }

  /**
   * Aggiungi job ricorrente (cron)
   */
  async addRecurringJob(
    queueName: string,
    jobName: string,
    data: JobData,
    cronExpression: string
  ) {
    const queue = this.getQueue(queueName);
    
    await queue.add(jobName, data, {
      repeat: {
        pattern: cronExpression,
      },
    });

    logger.info(`Recurring job ${jobName} added to queue ${queueName} with cron ${cronExpression}`);
  }

  /**
   * Rimuovi job ricorrente
   */
  async removeRecurringJob(queueName: string, jobKey: string) {
    const queue = this.getQueue(queueName);
    await queue.removeRepeatableByKey(jobKey);
    logger.info(`Recurring job ${jobKey} removed from queue ${queueName}`);
  }

  /**
   * Ottieni statistiche queue
   */
  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Pulisci job completati/falliti vecchi
   */
  async cleanQueue(queueName: string, grace: number = 3600000) {
    const queue = this.getQueue(queueName);
    
    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 100, 'failed');

    logger.info(`Queue ${queueName} cleaned (grace period: ${grace}ms)`);
  }

  /**
   * Pausa queue
   */
  async pauseQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  /**
   * Riprendi queue
   */
  async resumeQueue(queueName: string) {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  /**
   * Chiudi tutte le queue e workers
   */
  async closeAll() {
    logger.info('Closing all queues and workers...');

    for (const [name, worker] of this.workers.entries()) {
      await worker.close();
      logger.info(`Worker ${name} closed`);
    }

    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }

    this.workers.clear();
    this.queues.clear();
  }
}

// Main logic & Exports
export default new QueueManager();
