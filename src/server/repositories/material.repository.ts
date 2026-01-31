import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export class MaterialRepository {
  /**
   * Find material by ID
   */
  async findById(id: string) {
    return prisma.material.findUnique({
      where: { id },
      include: {
        supplier: true,
        inventoryItems: {
          include: { warehouse: true },
        },
      },
    });
  }

  /**
   * Find material by SKU
   */
  async findBySku(sku: string) {
    return prisma.material.findUnique({
      where: { sku },
      include: {
        supplier: true,
      },
    });
  }

  /**
   * Find all materials with pagination
   */
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.MaterialWhereInput;
    orderBy?: Prisma.MaterialOrderByWithRelationInput;
  }) {
    const [items, total] = await Promise.all([
      prisma.material.findMany({
        ...params,
        include: {
          supplier: true,
          inventoryItems: true,
        },
      }),
      prisma.material.count({ where: params.where }),
    ]);

    return { items, total };
  }

  /**
   * Create material
   */
  async create(data: Prisma.MaterialCreateInput) {
    return prisma.material.create({
      data,
      include: { supplier: true },
    });
  }

  /**
   * Update material
   */
  async update(id: string, data: Prisma.MaterialUpdateInput) {
    return prisma.material.update({
      where: { id },
      data,
      include: { supplier: true },
    });
  }

  /**
   * Delete material (soft delete)
   */
  async delete(id: string) {
    return prisma.material.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get materials with low stock (currentStock <= minStock)
   */
  async getLowStockMaterials() {
    // Prisma doesn't support comparing two fields directly in where
    // So we fetch all active materials and filter in JS
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      include: { supplier: true },
    });

    return materials.filter(m => m.currentStock <= m.minStock);
  }

  /**
   * Update material stock
   */
  async updateStock(id: string, quantityDelta: number) {
    return prisma.material.update({
      where: { id },
      data: {
        currentStock: { increment: quantityDelta },
      },
    });
  }

  /**
   * Search materials (SKU, name)
   */
  async search(query: string, limit: number = 20) {
    return prisma.material.findMany({
      where: {
        isActive: true,
        OR: [
          { sku: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: { supplier: true },
    });
  }

  /**
   * Find materials by category
   */
  async findByCategory(category: string) {
    return prisma.material.findMany({
      where: {
        category,
        isActive: true,
      },
      include: { supplier: true },
    });
  }

  /**
   * Find materials by supplier
   */
  async findBySupplier(supplierId: string) {
    return prisma.material.findMany({
      where: {
        supplierId,
        isActive: true,
      },
      include: { supplier: true },
    });
  }

  /**
   * Get materials requiring reorder (currentStock <= reorderPoint)
   */
  async getMaterialsRequiringReorder() {
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      include: { supplier: true },
    });

    return materials.filter(m => m.currentStock <= m.reorderPoint);
  }

  /**
   * Check if material is used in any manufacturing phase
   */
  async isUsedInPhases(id: string): Promise<boolean> {
    const count = await prisma.phaseMaterial.count({
      where: { materialId: id },
    });
    return count > 0;
  }

  /**
   * Get material usage in phases
   */
  async getMaterialUsage(id: string) {
    return prisma.phaseMaterial.findMany({
      where: { materialId: id },
      include: {
        phase: {
          include: {
            product: true,
            operationType: true,
          },
        },
      },
    });
  }

  /**
   * Create material movement
   */
  async createMovement(data: {
    materialId: string;
    type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION' | 'RETURN';
    quantity: number;
    fromLocation?: 'WEB' | 'B2B' | 'EVENTI' | 'TRANSITO';
    toLocation?: 'WEB' | 'B2B' | 'EVENTI' | 'TRANSITO';
    lotNumber?: string;
    reference?: string;
    notes?: string;
    performedBy?: string;
  }) {
    return prisma.materialMovement.create({
      data: {
        materialId: data.materialId,
        type: data.type,
        quantity: data.quantity,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        lotNumber: data.lotNumber,
        reference: data.reference,
        notes: data.notes,
        performedBy: data.performedBy,
      },
    });
  }

  /**
   * Get material movements
   */
  async getMovements(materialId: string, limit: number = 50) {
    return prisma.materialMovement.findMany({
      where: { materialId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

    return materials
      .map(m => m.category)
      .filter((c): c is string => c !== null);
  }
}

export default new MaterialRepository();
