import materialRepository from '../repositories/material.repository';
import notificationService from './notification.service';
import logger from '../config/logger';
import { prisma } from '../config/database';

interface CreateMaterialInput {
  sku: string;
  name: string;
  description?: string;
  unit?: string;
  cost: number;
  minStock?: number;
  currentStock?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  supplierId?: string;
  category?: string;
  isConsumable?: boolean;
}

interface UpdateMaterialInput {
  sku?: string;
  name?: string;
  description?: string;
  unit?: string;
  cost?: number;
  minStock?: number;
  currentStock?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  supplierId?: string;
  category?: string;
  isConsumable?: boolean;
}

interface GetAllMaterialsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  supplierId?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Material Service
 * Business logic per gestione materiali
 */
class MaterialService {
  /**
   * Lista tutti i materiali con paginazione e filtri
   */
  async getAllMaterials(params: GetAllMaterialsParams) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.supplierId) {
      where.supplierId = params.supplierId;
    }

    if (params.search) {
      where.OR = [
        { sku: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    if (params.sortBy) {
      orderBy[params.sortBy] = params.sortOrder || 'asc';
    } else {
      orderBy.name = 'asc';
    }

    let result = await materialRepository.findAll({ skip, take: limit, where, orderBy });

    // Filtra per low stock se richiesto
    if (params.lowStock) {
      result.items = result.items.filter(m => m.currentStock <= m.minStock);
      result.total = result.items.length;
    }

    logger.debug(`Retrieved ${result.items.length} materials`);

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Ottieni materiale per ID
   */
  async getMaterialById(id: string) {
    const material = await materialRepository.findById(id);

    if (!material) {
      throw new Error('Materiale non trovato');
    }

    return material;
  }

  /**
   * Ottieni materiale per SKU
   */
  async getMaterialBySku(sku: string) {
    return materialRepository.findBySku(sku);
  }

  /**
   * Crea nuovo materiale
   */
  async createMaterial(data: CreateMaterialInput) {
    // Verifica SKU univoco
    const existing = await materialRepository.findBySku(data.sku);
    if (existing) {
      throw new Error(`Materiale con SKU ${data.sku} esiste già`);
    }

    const material = await materialRepository.create({
      sku: data.sku,
      name: data.name,
      description: data.description,
      unit: data.unit || 'pz',
      cost: data.cost,
      minStock: data.minStock || 0,
      currentStock: data.currentStock || 0,
      reorderPoint: data.reorderPoint || 0,
      reorderQuantity: data.reorderQuantity || 0,
      leadTimeDays: data.leadTimeDays || 7,
      category: data.category,
      isConsumable: data.isConsumable || false,
      ...(data.supplierId && {
        supplier: { connect: { id: data.supplierId } },
      }),
    });

    logger.info(`Created material: ${material.sku} - ${material.name}`);

    return material;
  }

  /**
   * Aggiorna materiale
   */
  async updateMaterial(id: string, data: UpdateMaterialInput) {
    const existing = await materialRepository.findById(id);
    if (!existing) {
      throw new Error('Materiale non trovato');
    }

    // Se cambia SKU, verifica unicità
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await materialRepository.findBySku(data.sku);
      if (skuExists) {
        throw new Error(`Materiale con SKU ${data.sku} esiste già`);
      }
    }

    const updateData: any = { ...data };

    // Gestione supplier
    if (data.supplierId !== undefined) {
      if (data.supplierId) {
        updateData.supplier = { connect: { id: data.supplierId } };
      } else {
        updateData.supplier = { disconnect: true };
      }
      delete updateData.supplierId;
    }

    const material = await materialRepository.update(id, updateData);

    logger.info(`Updated material: ${material.sku}`);

    // Check scorte basse dopo update
    if (material.currentStock <= material.minStock) {
      await this.notifyLowStockMaterial(material);
    }

    return material;
  }

  /**
   * Elimina materiale (soft delete)
   */
  async deleteMaterial(id: string) {
    // Verifica che non sia usato in fasi
    const isUsed = await materialRepository.isUsedInPhases(id);
    if (isUsed) {
      throw new Error('Impossibile eliminare: materiale utilizzato in fasi di produzione');
    }

    await materialRepository.delete(id);

    logger.info(`Deleted material: ${id}`);

    return { success: true };
  }

  /**
   * Modifica stock materiale
   */
  async adjustStock(
    id: string,
    quantity: number,
    type: 'IN' | 'OUT',
    reference?: string,
    notes?: string,
    performedBy?: string
  ) {
    const material = await materialRepository.findById(id);
    if (!material) {
      throw new Error('Materiale non trovato');
    }

    const delta = type === 'IN' ? quantity : -quantity;

    // Verifica che non vada in negativo
    if (material.currentStock + delta < 0) {
      throw new Error('Stock insufficiente');
    }

    // Aggiorna stock
    await materialRepository.updateStock(id, delta);

    // Crea movimento
    await materialRepository.createMovement({
      materialId: id,
      type,
      quantity,
      toLocation: type === 'IN' ? 'WEB' : undefined,
      fromLocation: type === 'OUT' ? 'WEB' : undefined,
      reference,
      notes,
      performedBy,
    });

    logger.info(`Adjusted stock for material ${material.sku}: ${type} ${quantity}`);

    // Check low stock dopo scarico
    const updated = await materialRepository.findById(id);
    if (updated && updated.currentStock <= updated.minStock) {
      await this.notifyLowStockMaterial(updated);
    }

    return updated;
  }

  /**
   * Verifica e notifica materiali sotto soglia
   */
  async checkLowStock() {
    const lowStockItems = await materialRepository.getLowStockMaterials();

    logger.info(`Found ${lowStockItems.length} materials with low stock`);

    for (const material of lowStockItems) {
      await this.notifyLowStockMaterial(material);
    }

    return lowStockItems;
  }

  /**
   * Notifica scorta bassa per singolo materiale
   */
  private async notifyLowStockMaterial(material: { id: string; sku: string; name: string; currentStock: number; minStock: number }) {
    await notificationService.notifyRoles(['MAGAZZINIERE', 'ADMIN', 'MANAGER'], {
      type: 'LOW_STOCK',
      title: 'Materiale Sotto Soglia',
      message: `Il materiale "${material.name}" (${material.sku}) ha raggiunto la scorta minima. Stock: ${material.currentStock}/${material.minStock}`,
      link: `/materials/${material.id}`,
    });

    logger.warn(`Low stock alert for material: ${material.sku} (${material.currentStock}/${material.minStock})`);
  }

  /**
   * Ottieni materiali sotto soglia
   */
  async getLowStockMaterials() {
    return materialRepository.getLowStockMaterials();
  }

  /**
   * Ottieni materiali che richiedono riordino
   */
  async getMaterialsRequiringReorder() {
    return materialRepository.getMaterialsRequiringReorder();
  }

  /**
   * Cerca materiali
   */
  async searchMaterials(query: string, limit?: number) {
    return materialRepository.search(query, limit);
  }

  /**
   * Ottieni tutte le categorie
   */
  async getCategories() {
    return materialRepository.getCategories();
  }

  /**
   * Ottieni storico movimenti
   */
  async getMovementHistory(materialId: string, limit?: number) {
    return materialRepository.getMovements(materialId, limit);
  }

  /**
   * Ottieni utilizzo del materiale nelle fasi
   */
  async getMaterialUsage(materialId: string) {
    return materialRepository.getMaterialUsage(materialId);
  }

  /**
   * Consumo materiale per produzione
   * Chiamato quando una fase di produzione viene completata
   */
  async consumeForProduction(
    materialId: string,
    quantity: number,
    productionOrderNumber: string,
    phaseSequence: number,
    performedBy?: string
  ) {
    const material = await materialRepository.findById(materialId);
    if (!material) {
      throw new Error('Materiale non trovato');
    }

    if (material.currentStock < quantity) {
      throw new Error(`Stock insufficiente per ${material.name}. Richiesto: ${quantity}, Disponibile: ${material.currentStock}`);
    }

    // Scala stock
    await materialRepository.updateStock(materialId, -quantity);

    // Crea movimento
    const movement = await materialRepository.createMovement({
      materialId,
      type: 'PRODUCTION',
      quantity,
      fromLocation: 'WEB',
      reference: productionOrderNumber,
      notes: `Consumo per produzione - Fase ${phaseSequence}`,
      performedBy,
    });

    logger.info(`Consumed ${quantity} ${material.unit} of ${material.sku} for production ${productionOrderNumber}`);

    // Check low stock
    const updated = await materialRepository.findById(materialId);
    if (updated && updated.currentStock <= updated.minStock) {
      await this.notifyLowStockMaterial(updated);
    }

    return { movement, material: updated };
  }

  /**
   * Ottieni statistiche materiali per dashboard
   */
  async getMaterialStats() {
    const [total, lowStock, reorderRequired, categories] = await Promise.all([
      prisma.material.count({ where: { isActive: true } }),
      materialRepository.getLowStockMaterials(),
      materialRepository.getMaterialsRequiringReorder(),
      materialRepository.getCategories(),
    ]);

    // Calcola valore totale inventario materiali
    const materials = await prisma.material.findMany({
      where: { isActive: true },
      select: { cost: true, currentStock: true },
    });

    const totalValue = materials.reduce(
      (sum, m) => sum + Number(m.cost) * m.currentStock,
      0
    );

    return {
      totalMaterials: total,
      lowStockCount: lowStock.length,
      reorderRequiredCount: reorderRequired.length,
      categoriesCount: categories.length,
      totalInventoryValue: totalValue,
    };
  }
}

export default new MaterialService();
