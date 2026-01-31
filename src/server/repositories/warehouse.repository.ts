// Imports
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

// Types/Interfaces
interface CreateWarehouseDTO {
  code: string;
  name: string;
  description?: string;
  address?: any;
  isActive?: boolean;
  isPrimary?: boolean;
}

interface UpdateWarehouseDTO {
  code?: string;
  name?: string;
  description?: string;
  address?: any;
  isActive?: boolean;
  isPrimary?: boolean;
}

interface WarehouseFilters {
  isActive?: boolean;
  search?: string;
}

// Repository Class
export class WarehouseRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Trova tutti i magazzini con filtri opzionali
   */
  async findAll(filters?: WarehouseFilters, page = 1, limit = 20) {
    try {
      const where: any = {};

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.search) {
        where.OR = [
          { code: { contains: filters.search, mode: 'insensitive' } },
          { name: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        this.prisma.warehouse.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            { isPrimary: 'desc' }, // Magazzino principale per primo
            { name: 'asc' },
          ],
          include: {
            _count: {
              select: { inventoryItems: true },
            },
          },
        }),
        this.prisma.warehouse.count({ where }),
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      };
    } catch (error) {
      logger.error('Error in WarehouseRepository.findAll:', error);
      throw error;
    }
  }

  /**
   * Trova magazzino per ID
   */
  async findById(id: string) {
    try {
      return await this.prisma.warehouse.findUnique({
        where: { id },
        include: {
          _count: {
            select: { inventoryItems: true },
          },
        },
      });
    } catch (error) {
      logger.error('Error in WarehouseRepository.findById:', error);
      throw error;
    }
  }

  /**
   * Trova magazzino per codice
   */
  async findByCode(code: string) {
    try {
      return await this.prisma.warehouse.findUnique({
        where: { code },
      });
    } catch (error) {
      logger.error('Error in WarehouseRepository.findByCode:', error);
      throw error;
    }
  }

  /**
   * Trova il magazzino principale
   */
  async findPrimary() {
    try {
      return await this.prisma.warehouse.findFirst({
        where: { isPrimary: true, isActive: true },
      });
    } catch (error) {
      logger.error('Error in WarehouseRepository.findPrimary:', error);
      throw error;
    }
  }

  /**
   * Crea nuovo magazzino
   */
  async create(data: CreateWarehouseDTO) {
    try {
      // Se viene creato come primary, rimuovi il flag da altri magazzini
      if (data.isPrimary) {
        await this.prisma.warehouse.updateMany({
          where: { isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return await this.prisma.warehouse.create({
        data,
      });
    } catch (error) {
      logger.error('Error in WarehouseRepository.create:', error);
      throw error;
    }
  }

  /**
   * Aggiorna magazzino
   */
  async update(id: string, data: UpdateWarehouseDTO) {
    try {
      // Se viene impostato come primary, rimuovi il flag da altri magazzini
      if (data.isPrimary) {
        await this.prisma.warehouse.updateMany({
          where: { isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }

      return await this.prisma.warehouse.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error('Error in WarehouseRepository.update:', error);
      throw error;
    }
  }

  /**
   * Elimina magazzino (soft delete)
   */
  async delete(id: string) {
    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      logger.error('Error in WarehouseRepository.delete:', error);
      throw error;
    }
  }

  /**
   * Verifica se un magazzino può essere eliminato
   * (non ha giacenze associate)
   */
  async canDelete(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.inventoryItem.count({
        where: { warehouseId: id },
      });
      return count === 0;
    } catch (error) {
      logger.error('Error in WarehouseRepository.canDelete:', error);
      throw error;
    }
  }
}

// Export singleton instance
let warehouseRepository: WarehouseRepository;

export const getWarehouseRepository = (prisma: PrismaClient) => {
  if (!warehouseRepository) {
    warehouseRepository = new WarehouseRepository(prisma);
  }
  return warehouseRepository;
};
