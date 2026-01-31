// Imports
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

// Types/Interfaces
interface CreateWorkProcessDTO {
  productId: string;
  operationName: string;
  sequence: number;
  standardTime: number; // minuti
  hourlyRate: number;
  setupTime?: number;
  description?: string;
}

interface UpdateWorkProcessDTO {
  operationName?: string;
  sequence?: number;
  standardTime?: number;
  hourlyRate?: number;
  setupTime?: number;
  description?: string;
}

// Repository Class
export class WorkProcessRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Trova tutte le lavorazioni di un prodotto
   */
  async findByProduct(productId: string) {
    try {
      return await this.prisma.productOperation.findMany({
        where: { productId },
        orderBy: { sequence: 'asc' },
      });
    } catch (error) {
      logger.error('Error in WorkProcessRepository.findByProduct:', error);
      throw error;
    }
  }

  /**
   * Trova lavorazione per ID
   */
  async findById(id: string) {
    try {
      return await this.prisma.productOperation.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error in WorkProcessRepository.findById:', error);
      throw error;
    }
  }

  /**
   * Crea nuova lavorazione
   */
  async create(data: CreateWorkProcessDTO) {
    try {
      return await this.prisma.productOperation.create({
        data,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error in WorkProcessRepository.create:', error);
      throw error;
    }
  }

  /**
   * Aggiorna lavorazione
   */
  async update(id: string, data: UpdateWorkProcessDTO) {
    try {
      return await this.prisma.productOperation.update({
        where: { id },
        data,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error in WorkProcessRepository.update:', error);
      throw error;
    }
  }

  /**
   * Elimina lavorazione
   */
  async delete(id: string) {
    try {
      return await this.prisma.productOperation.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Error in WorkProcessRepository.delete:', error);
      throw error;
    }
  }

  /**
   * Riordina le lavorazioni di un prodotto
   */
  async reorderSequences(_productId: string, operationIds: string[]) {
    try {
      const operations = operationIds.map((id, index) => {
        return this.prisma.productOperation.update({
          where: { id },
          data: { sequence: index + 1 },
        });
      });

      return await this.prisma.$transaction(operations);
    } catch (error) {
      logger.error('Error in WorkProcessRepository.reorderSequences:', error);
      throw error;
    }
  }

  /**
   * Calcola il costo totale di lavorazione per un prodotto
   */
  async calculateProductOperationCost(productId: string): Promise<{
    setupCost: number;
    cycleCost: number;
    totalCost: number;
  }> {
    try {
      const operations = await this.findByProduct(productId);

      let setupCost = 0;
      let cycleCost = 0;

      for (const op of operations) {
        const setupHours = (op.setupTime || 0) / 60;
        const cycleHours = op.standardTime / 60;
        const rate = Number(op.hourlyRate);

        setupCost += setupHours * rate;
        cycleCost += cycleHours * rate;
      }

      return {
        setupCost,
        cycleCost,
        totalCost: setupCost + cycleCost,
      };
    } catch (error) {
      logger.error('Error in WorkProcessRepository.calculateProductOperationCost:', error);
      throw error;
    }
  }

  /**
   * Duplica le lavorazioni da un prodotto a un altro
   */
  async duplicateFromProduct(sourceProductId: string, targetProductId: string) {
    try {
      const sourceOperations = await this.findByProduct(sourceProductId);

      const createOperations = sourceOperations.map((op) =>
        this.prisma.productOperation.create({
          data: {
            productId: targetProductId,
            operationName: op.operationName,
            sequence: op.sequence,
            standardTime: op.standardTime,
            hourlyRate: op.hourlyRate,
            setupTime: op.setupTime || 0,
            description: op.description,
          },
        })
      );

      return await this.prisma.$transaction(createOperations);
    } catch (error) {
      logger.error('Error in WorkProcessRepository.duplicateFromProduct:', error);
      throw error;
    }
  }
}

// Export singleton instance
let workProcessRepository: WorkProcessRepository;

export const getWorkProcessRepository = (prisma: PrismaClient) => {
  if (!workProcessRepository) {
    workProcessRepository = new WorkProcessRepository(prisma);
  }
  return workProcessRepository;
};
