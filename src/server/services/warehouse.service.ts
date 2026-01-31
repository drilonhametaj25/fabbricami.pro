// Imports
import { PrismaClient } from '@prisma/client';
import { getWarehouseRepository } from '../repositories/warehouse.repository';
import { logger } from '../config/logger';

// Types/Interfaces
interface CreateWarehouseInput {
  code: string;
  name: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  isActive?: boolean;
  isPrimary?: boolean;
}

interface UpdateWarehouseInput {
  code?: string;
  name?: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  isActive?: boolean;
  isPrimary?: boolean;
}

interface WarehouseFilters {
  isActive?: boolean;
  search?: string;
}

// Service Class
export class WarehouseService {
  private warehouseRepo;

  constructor(private prisma: PrismaClient) {
    this.warehouseRepo = getWarehouseRepository(prisma);
  }

  /**
   * Recupera tutti i magazzini con filtri
   */
  async getAllWarehouses(filters?: WarehouseFilters, page = 1, limit = 20) {
    try {
      return await this.warehouseRepo.findAll(filters, page, limit);
    } catch (error) {
      logger.error('Error in WarehouseService.getAllWarehouses:', error);
      throw new Error('Impossibile recuperare i magazzini');
    }
  }

  /**
   * Recupera magazzino per ID
   */
  async getWarehouseById(id: string) {
    try {
      const warehouse = await this.warehouseRepo.findById(id);
      if (!warehouse) {
        throw new Error('Magazzino non trovato');
      }
      return warehouse;
    } catch (error) {
      logger.error('Error in WarehouseService.getWarehouseById:', error);
      throw error;
    }
  }

  /**
   * Recupera il magazzino principale
   */
  async getPrimaryWarehouse() {
    try {
      const warehouse = await this.warehouseRepo.findPrimary();
      if (!warehouse) {
        throw new Error('Nessun magazzino principale configurato');
      }
      return warehouse;
    } catch (error) {
      logger.error('Error in WarehouseService.getPrimaryWarehouse:', error);
      throw error;
    }
  }

  /**
   * Crea nuovo magazzino
   */
  async createWarehouse(data: CreateWarehouseInput) {
    try {
      // Verifica che il codice non esista già
      const existing = await this.warehouseRepo.findByCode(data.code);
      if (existing) {
        throw new Error('Un magazzino con questo codice esiste già');
      }

      // Se non ci sono magazzini, questo diventa automaticamente primary
      if (data.isPrimary === undefined) {
        const all = await this.warehouseRepo.findAll({}, 1, 1);
        if (all.pagination.total === 0) {
          data.isPrimary = true;
        }
      }

      return await this.warehouseRepo.create(data);
    } catch (error) {
      logger.error('Error in WarehouseService.createWarehouse:', error);
      throw error;
    }
  }

  /**
   * Aggiorna magazzino
   */
  async updateWarehouse(id: string, data: UpdateWarehouseInput) {
    try {
      // Verifica che il magazzino esista
      await this.getWarehouseById(id);

      // Se cambia il codice, verifica che non esista già
      if (data.code) {
        const existing = await this.warehouseRepo.findByCode(data.code);
        if (existing && existing.id !== id) {
          throw new Error('Un magazzino con questo codice esiste già');
        }
      }

      return await this.warehouseRepo.update(id, data);
    } catch (error) {
      logger.error('Error in WarehouseService.updateWarehouse:', error);
      throw error;
    }
  }

  /**
   * Elimina magazzino (soft delete)
   */
  async deleteWarehouse(id: string) {
    try {
      // Verifica che il magazzino esista
      const warehouse = await this.getWarehouseById(id);

      // Non permettere eliminazione del magazzino principale se è l'unico attivo
      if (warehouse.isPrimary) {
        const activeCount = await this.warehouseRepo.findAll({ isActive: true }, 1, 100);
        if (activeCount.pagination.total <= 1) {
          throw new Error('Non è possibile eliminare l\'unico magazzino principale attivo');
        }
      }

      // Verifica che non ci siano giacenze associate
      const canDelete = await this.warehouseRepo.canDelete(id);
      if (!canDelete) {
        throw new Error(
          'Impossibile eliminare il magazzino: sono presenti giacenze associate. Trasferire le giacenze prima di procedere.'
        );
      }

      return await this.warehouseRepo.delete(id);
    } catch (error) {
      logger.error('Error in WarehouseService.deleteWarehouse:', error);
      throw error;
    }
  }

  /**
   * Imposta un magazzino come principale
   */
  async setPrimaryWarehouse(id: string) {
    try {
      await this.getWarehouseById(id);

      return await this.warehouseRepo.update(id, { isPrimary: true });
    } catch (error) {
      logger.error('Error in WarehouseService.setPrimaryWarehouse:', error);
      throw error;
    }
  }

  /**
   * Ottiene statistiche del magazzino
   */
  async getWarehouseStats(id: string) {
    try {
      const warehouse = await this.getWarehouseById(id);

      // Conta prodotti totali nel magazzino
      const totalProducts = await this.prisma.inventoryItem.count({
        where: { warehouseId: id },
      });

      // Valore totale giacenze
      const inventory = await this.prisma.inventoryItem.findMany({
        where: { warehouseId: id },
        include: {
          product: {
            select: { cost: true },
          },
        },
      });

      const totalValue = inventory.reduce((sum, item) => {
        return sum + Number(item.product.cost) * item.quantity;
      }, 0);

      // Prodotti sotto scorta minima
      const lowStockItems = await this.prisma.inventoryItem.findMany({
        where: {
          warehouseId: id,
          product: {
            isActive: true,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              minStockLevel: true,
            },
          },
        },
      });

      const lowStockCount = lowStockItems.filter(
        (item) => item.quantity <= item.product.minStockLevel
      ).length;

      return {
        warehouse,
        stats: {
          totalProducts,
          totalValue: Number(totalValue.toFixed(2)),
          lowStockCount,
        },
      };
    } catch (error) {
      logger.error('Error in WarehouseService.getWarehouseStats:', error);
      throw error;
    }
  }
}

// Export singleton instance factory
let warehouseService: WarehouseService;

export const getWarehouseService = (prisma: PrismaClient) => {
  if (!warehouseService) {
    warehouseService = new WarehouseService(prisma);
  }
  return warehouseService;
};
