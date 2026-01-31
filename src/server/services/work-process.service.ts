// Imports
import { PrismaClient } from '@prisma/client';
import { getWorkProcessRepository } from '../repositories/work-process.repository';
import { logger } from '../config/logger';

// Types/Interfaces
interface CreateWorkProcessInput {
  productId: string;
  operationName: string;
  sequence: number;
  standardTime: number; // minuti
  hourlyRate: number;
  setupTime?: number;
  description?: string;
}

interface UpdateWorkProcessInput {
  operationName?: string;
  sequence?: number;
  standardTime?: number;
  hourlyRate?: number;
  setupTime?: number;
  description?: string;
}

// Service Class
export class WorkProcessService {
  private workProcessRepo;

  constructor(private prisma: PrismaClient) {
    this.workProcessRepo = getWorkProcessRepository(prisma);
  }

  /**
   * Recupera tutte le lavorazioni di un prodotto
   */
  async getProductWorkProcesses(productId: string) {
    try {
      // Verifica che il prodotto esista
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Prodotto non trovato');
      }

      return await this.workProcessRepo.findByProduct(productId);
    } catch (error) {
      logger.error('Error in WorkProcessService.getProductWorkProcesses:', error);
      throw error;
    }
  }

  /**
   * Recupera lavorazione per ID
   */
  async getWorkProcessById(id: string) {
    try {
      const workProcess = await this.workProcessRepo.findById(id);
      if (!workProcess) {
        throw new Error('Lavorazione non trovata');
      }
      return workProcess;
    } catch (error) {
      logger.error('Error in WorkProcessService.getWorkProcessById:', error);
      throw error;
    }
  }

  /**
   * Crea nuova lavorazione
   */
  async createWorkProcess(data: CreateWorkProcessInput) {
    try {
      // Verifica che il prodotto esista
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new Error('Prodotto non trovato');
      }

      // Valida i dati
      if (data.standardTime <= 0) {
        throw new Error('Il tempo standard deve essere maggiore di zero');
      }

      if (data.hourlyRate < 0) {
        throw new Error('Il costo orario non può essere negativo');
      }

      return await this.workProcessRepo.create(data);
    } catch (error) {
      logger.error('Error in WorkProcessService.createWorkProcess:', error);
      throw error;
    }
  }

  /**
   * Aggiorna lavorazione
   */
  async updateWorkProcess(id: string, data: UpdateWorkProcessInput) {
    try {
      // Verifica che la lavorazione esista
      await this.getWorkProcessById(id);

      // Valida i dati
      if (data.standardTime !== undefined && data.standardTime <= 0) {
        throw new Error('Il tempo standard deve essere maggiore di zero');
      }

      if (data.hourlyRate !== undefined && data.hourlyRate < 0) {
        throw new Error('Il costo orario non può essere negativo');
      }

      return await this.workProcessRepo.update(id, data);
    } catch (error) {
      logger.error('Error in WorkProcessService.updateWorkProcess:', error);
      throw error;
    }
  }

  /**
   * Elimina lavorazione
   */
  async deleteWorkProcess(id: string) {
    try {
      // Verifica che la lavorazione esista
      await this.getWorkProcessById(id);

      return await this.workProcessRepo.delete(id);
    } catch (error) {
      logger.error('Error in WorkProcessService.deleteWorkProcess:', error);
      throw error;
    }
  }

  /**
   * Riordina le lavorazioni di un prodotto
   */
  async reorderWorkProcesses(productId: string, operationIds: string[]) {
    try {
      // Verifica che il prodotto esista
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Prodotto non trovato');
      }

      // Verifica che tutte le operazioni appartengano al prodotto
      const operations = await this.workProcessRepo.findByProduct(productId);
      const operationIdSet = new Set(operations.map((op) => op.id));

      for (const opId of operationIds) {
        if (!operationIdSet.has(opId)) {
          throw new Error(`Lavorazione ${opId} non appartiene al prodotto`);
        }
      }

      return await this.workProcessRepo.reorderSequences(productId, operationIds);
    } catch (error) {
      logger.error('Error in WorkProcessService.reorderWorkProcesses:', error);
      throw error;
    }
  }

  /**
   * Calcola il costo totale di lavorazione per un prodotto
   */
  async calculateProductOperationCost(productId: string) {
    try {
      return await this.workProcessRepo.calculateProductOperationCost(productId);
    } catch (error) {
      logger.error('Error in WorkProcessService.calculateProductOperationCost:', error);
      throw error;
    }
  }

  /**
   * Duplica le lavorazioni da un prodotto a un altro
   */
  async duplicateWorkProcesses(sourceProductId: string, targetProductId: string) {
    try {
      // Verifica che entrambi i prodotti esistano
      const [sourceProduct, targetProduct] = await Promise.all([
        this.prisma.product.findUnique({ where: { id: sourceProductId } }),
        this.prisma.product.findUnique({ where: { id: targetProductId } }),
      ]);

      if (!sourceProduct) {
        throw new Error('Prodotto sorgente non trovato');
      }

      if (!targetProduct) {
        throw new Error('Prodotto destinazione non trovato');
      }

      // Verifica che il prodotto destinazione non abbia già lavorazioni
      const existingOperations = await this.workProcessRepo.findByProduct(targetProductId);
      if (existingOperations.length > 0) {
        throw new Error(
          'Il prodotto destinazione ha già delle lavorazioni configurate. Eliminarle prima di duplicare.'
        );
      }

      return await this.workProcessRepo.duplicateFromProduct(sourceProductId, targetProductId);
    } catch (error) {
      logger.error('Error in WorkProcessService.duplicateWorkProcesses:', error);
      throw error;
    }
  }

  /**
   * Calcola il tempo totale di produzione per un prodotto
   */
  async calculateProductionTime(productId: string, quantity: number = 1) {
    try {
      const operations = await this.workProcessRepo.findByProduct(productId);

      let setupTime = 0;
      let cycleTime = 0;

      for (const op of operations) {
        setupTime += op.setupTime || 0; // Setup è fisso, una volta sola
        cycleTime += op.standardTime * quantity; // Tempo ciclo per quantità
      }

      return {
        setupTime, // minuti
        cycleTime, // minuti
        totalTime: setupTime + cycleTime, // minuti
        totalHours: Number(((setupTime + cycleTime) / 60).toFixed(2)),
      };
    } catch (error) {
      logger.error('Error in WorkProcessService.calculateProductionTime:', error);
      throw error;
    }
  }
}

// Export singleton instance factory
let workProcessService: WorkProcessService;

export const getWorkProcessService = (prisma: PrismaClient) => {
  if (!workProcessService) {
    workProcessService = new WorkProcessService(prisma);
  }
  return workProcessService;
};
