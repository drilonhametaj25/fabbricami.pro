import { prisma } from '../config/database';
import { ImportJobStatus, ImportJobType, ImportJob } from '@prisma/client';
import logger from '../config/logger';

/**
 * Filtri per la lista dei job
 */
export interface ImportJobFilters {
  type?: ImportJobType;
  status?: ImportJobStatus;
  limit?: number;
  offset?: number;
}

/**
 * Dati per aggiornare il progresso
 */
export interface ImportJobProgress {
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  imported?: number;
  updated?: number;
  errors?: number;
  errorLog?: any[];
}

/**
 * Import Job Service
 * Gestisce la persistenza dei job di importazione nel database
 */
class ImportJobService {
  /**
   * Crea un nuovo job di importazione
   */
  async create(
    type: ImportJobType,
    bullmqJobId: string,
    userId?: string
  ): Promise<ImportJob> {
    const job = await prisma.importJob.create({
      data: {
        type,
        status: 'RUNNING',
        bullmqJobId,
        createdBy: userId,
        startedAt: new Date(),
      },
    });

    logger.info(`[ImportJob] Created job ${job.id} of type ${type}`);
    return job;
  }

  /**
   * Aggiorna il progresso del job
   * Chiamato ad ogni pagina processata
   */
  async updateProgress(id: string, data: ImportJobProgress): Promise<ImportJob> {
    const job = await prisma.importJob.update({
      where: { id },
      data: {
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        totalItems: data.totalItems,
        imported: data.imported,
        updated: data.updated,
        errors: data.errors,
        errorLog: data.errorLog ?? undefined,
      },
    });

    return job;
  }

  /**
   * Cambia lo stato del job
   */
  async setStatus(id: string, status: ImportJobStatus): Promise<ImportJob> {
    const updateData: any = { status };

    if (status === 'PAUSED') {
      updateData.pausedAt = new Date();
    } else if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      updateData.completedAt = new Date();
    }

    const job = await prisma.importJob.update({
      where: { id },
      data: updateData,
    });

    logger.info(`[ImportJob] Job ${id} status changed to ${status}`);
    return job;
  }

  /**
   * Ottiene un job attivo (RUNNING o PAUSED) per tipo
   */
  async getActiveByType(type: ImportJobType): Promise<ImportJob | null> {
    return prisma.importJob.findFirst({
      where: {
        type,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Ottiene un job per ID
   */
  async getById(id: string): Promise<ImportJob | null> {
    return prisma.importJob.findUnique({
      where: { id },
    });
  }

  /**
   * Ottiene un job per BullMQ Job ID
   */
  async getByBullmqJobId(bullmqJobId: string): Promise<ImportJob | null> {
    return prisma.importJob.findFirst({
      where: { bullmqJobId },
    });
  }

  /**
   * Lista storico importazioni con filtri
   */
  async list(filters: ImportJobFilters = {}): Promise<{ items: ImportJob[]; total: number }> {
    const { type, status, limit = 20, offset = 0 } = filters;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.importJob.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.importJob.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Ottiene tutti i job interrotti (PAUSED o FAILED) che possono essere ripresi
   */
  async getResumableJobs(type?: ImportJobType): Promise<ImportJob[]> {
    return prisma.importJob.findMany({
      where: {
        type: type ?? undefined,
        status: { in: ['PAUSED', 'FAILED'] },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Crea un job di ripresa da uno precedente
   */
  async createResumeJob(
    originalJobId: string,
    bullmqJobId: string,
    userId?: string
  ): Promise<ImportJob> {
    const originalJob = await this.getById(originalJobId);
    if (!originalJob) {
      throw new Error(`Job ${originalJobId} not found`);
    }

    // Marca il job originale come completato (parzialmente)
    await prisma.importJob.update({
      where: { id: originalJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Crea nuovo job che continua da dove si era fermato
    const newJob = await prisma.importJob.create({
      data: {
        type: originalJob.type,
        status: 'RUNNING',
        currentPage: originalJob.currentPage,
        totalPages: originalJob.totalPages,
        totalItems: originalJob.totalItems,
        imported: originalJob.imported,
        updated: originalJob.updated,
        errors: originalJob.errors,
        errorLog: originalJob.errorLog ?? undefined,
        bullmqJobId,
        resumedFrom: originalJobId,
        createdBy: userId,
        startedAt: new Date(),
      },
    });

    logger.info(`[ImportJob] Created resume job ${newJob.id} from ${originalJobId}, starting at page ${originalJob.currentPage}`);
    return newJob;
  }

  /**
   * Pulisce i job vecchi (più di 30 giorni)
   */
  async cleanOldJobs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.importJob.deleteMany({
      where: {
        startedAt: { lt: cutoffDate },
        status: { in: ['COMPLETED', 'CANCELLED'] },
      },
    });

    logger.info(`[ImportJob] Cleaned ${result.count} old jobs`);
    return result.count;
  }

  /**
   * Statistiche sui job
   */
  async getStats(): Promise<{
    total: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    cancelled: number;
    byType: Record<ImportJobType, number>;
  }> {
    const [total, running, paused, completed, failed, cancelled, byTypeResults] = await Promise.all([
      prisma.importJob.count(),
      prisma.importJob.count({ where: { status: 'RUNNING' } }),
      prisma.importJob.count({ where: { status: 'PAUSED' } }),
      prisma.importJob.count({ where: { status: 'COMPLETED' } }),
      prisma.importJob.count({ where: { status: 'FAILED' } }),
      prisma.importJob.count({ where: { status: 'CANCELLED' } }),
      prisma.importJob.groupBy({
        by: ['type'],
        _count: true,
      }),
    ]);

    const byType: Record<ImportJobType, number> = {
      CUSTOMERS: 0,
      PRODUCTS: 0,
      ORDERS: 0,
    };

    for (const result of byTypeResults) {
      byType[result.type] = result._count;
    }

    return {
      total,
      running,
      paused,
      completed,
      failed,
      cancelled,
      byType,
    };
  }
}

const importJobService = new ImportJobService();
export { importJobService, ImportJobService };
export default importJobService;
