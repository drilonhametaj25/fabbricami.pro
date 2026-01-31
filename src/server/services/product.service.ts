import productRepository from '../repositories/product.repository';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';
import { prisma } from '../config/database';

/**
 * Product Service
 * Business logic per gestione prodotti
 */
class ProductService {
  /**
   * Ottieni tutti i prodotti con filtri
   */
  async getAllProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.category && { category: params.category }),
      ...(params.search && {
        OR: [
          { sku: { contains: params.search, mode: 'insensitive' } },
          { name: { contains: params.search, mode: 'insensitive' } },
          { barcode: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: any = {
      [params.sortBy || 'createdAt']: params.sortOrder || 'desc',
    };

    return productRepository.findAll({ skip, take: limit, where, orderBy });
  }

  /**
   * Ottieni prodotto per ID
   */
  async getProductById(id: string) {
    return productRepository.findById(id);
  }

  /**
   * Ottieni prodotto per SKU
   */
  async getProductBySku(sku: string) {
    return productRepository.findBySku(sku);
  }

  /**
   * Crea nuovo prodotto
   */
  async createProduct(data: CreateProductInput) {
    // Verifica che SKU sia univoco
    const existing = await productRepository.findBySku(data.sku);
    if (existing) {
      throw new Error(`Product with SKU ${data.sku} already exists`);
    }

    return productRepository.create(data as any);
  }

  /**
   * Aggiorna prodotto
   */
  async updateProduct(id: string, data: UpdateProductInput) {
    // Verifica che il prodotto esista
    const existing = await productRepository.findById(id);
    if (!existing) {
      throw new Error('Product not found');
    }

    // Se si cambia SKU, verifica che sia univoco
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await productRepository.findBySku(data.sku);
      if (skuExists) {
        throw new Error(`Product with SKU ${data.sku} already exists`);
      }
    }

    return productRepository.update(id, data as any);
  }

  /**
   * Elimina prodotto (soft delete)
   */
  async deleteProduct(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    // Verifica che non ci siano ordini pending per questo prodotto
    const pendingOrders = await prisma.orderItem.count({
      where: {
        productId: id,
        order: {
          status: {
            in: ['PENDING', 'CONFIRMED', 'PROCESSING'],
          },
        },
      },
    });

    if (pendingOrders > 0) {
      throw new Error('Cannot delete product with pending orders');
    }

    return productRepository.delete(id);
  }

  /**
   * Ottieni prodotti con scorte basse
   */
  async getLowStockProducts() {
    return productRepository.getLowStockProducts();
  }

  /**
   * Calcola costo prodotto completo (materiali + lavorazioni + overhead)
   */
  async calculateProductCost(productId: string, includeOverhead: boolean = true) {
    const baseCost = await productRepository.calculateProductCost(productId);

    if (!includeOverhead) {
      return baseCost;
    }

    // Calcola overhead
    const overhead = await this.calculateOverhead(productId, baseCost.laborCost);

    return {
      materialCost: baseCost.materialCost,
      laborCost: baseCost.laborCost,
      overheadCost: overhead,
      totalCost: baseCost.totalCost + overhead,
    };
  }

  /**
   * Calcola overhead cost (costi generali spalmati)
   */
  private async calculateOverhead(productId: string, laborCost: number): Promise<number> {
    // Ottieni metodo di ripartizione costi generali
    const allocationMethod = process.env.OVERHEAD_ALLOCATION_METHOD || 'labor_hours';

    if (allocationMethod === 'labor_hours') {
      // Calcola overhead basato su ore lavorate
      // Ottieni totale costi generali mensili
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const totalOverhead = await prisma.overheadCost.aggregate({
        where: {
          startDate: { lte: endOfMonth },
          OR: [
            { endDate: null },
            { endDate: { gte: startOfMonth } },
          ],
        },
        _sum: {
          amount: true,
        },
      });

      const monthlyOverhead = Number(totalOverhead._sum.amount) || 0;

      // TODO: Implement TaskTime model for tracking actual labor hours
      // For now use a placeholder calculation
      const totalHours = 160; // Standard monthly hours placeholder

      // Calcola ore per questo prodotto
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { operations: true },
      });

      if (!product) return 0;

      const productHours = product.operations.reduce((sum: number, op: any) => {
        return sum + ((op.setupTime || 0) + op.standardTime) / 60;
      }, 0);

      // Ripartizione proporzionale
      const overheadRate = monthlyOverhead / totalHours;
      return overheadRate * productHours;
    }

    // Metodo alternativo: percentuale sul costo lavoro
    return laborCost * 0.3; // 30% overhead default
  }

  /**
   * Esplode BOM multi-livello
   */
  async explodeBom(productId: string, quantity: number = 1) {
    return productRepository.explodeBom(productId, quantity);
  }

  /**
   * Calcola marginalità prodotto
   */
  async calculateProductMargin(productId: string) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const cost = await this.calculateProductCost(productId, true);
    const price = Number(product.price);
    const margin = price - cost.totalCost;
    const marginPercentage = price > 0 ? (margin / price) * 100 : 0;

    return {
      price,
      cost: cost.totalCost,
      margin,
      marginPercentage,
      breakdown: {
        materialCost: cost.materialCost,
        laborCost: cost.laborCost,
        overheadCost: 'overheadCost' in cost ? cost.overheadCost : 0,
      },
    };
  }

  /**
   * Cerca prodotti
   */
  async searchProducts(query: string, limit?: number) {
    return productRepository.search(query, limit);
  }

  /**
   * Ottieni prodotti vendibili
   */
  async getSellableProducts() {
    return productRepository.findSellable();
  }

  /**
   * Ottieni prodotti da riordinare (MRP semplificato)
   */
  async getProductsRequiringReorder() {
    return productRepository.getProductsRequiringReorder();
  }

  /**
   * Calcola fabbisogno materiali (MRP - Material Requirements Planning)
   */
  async calculateMaterialRequirements(productId: string, requiredQuantity: number, requiredDate: Date) {
    // Esplode BOM per ottenere tutti i componenti necessari
    const components = await this.explodeBom(productId, requiredQuantity);

    // Per ogni componente, verifica giacenza disponibile
    const requirements = await Promise.all(
      components.map(async (component) => {
        // Ottieni giacenza attuale
        const inventory = await prisma.inventoryItem.findMany({
          where: {
            productId: component.componentId,
          },
        });

        const totalAvailable = inventory.reduce((sum: number, inv: any) => {
          return sum + (Number(inv.quantity) - Number(inv.reservedQuantity));
        }, 0);

        const shortage = Math.max(0, component.totalQuantity - totalAvailable);

        // Lead time placeholder (TODO: add leadTime field to Product model)
        const leadTimeDays = 7;
        const orderDate = new Date(requiredDate);
        orderDate.setDate(orderDate.getDate() - leadTimeDays);

        return {
          componentId: component.componentId,
          sku: component.sku,
          name: component.name,
          required: component.totalQuantity,
          available: totalAvailable,
          shortage,
          unit: component.unit,
          level: component.level,
          shouldOrder: shortage > 0,
          orderQuantity: shortage > 0 ? Math.ceil(shortage) : 0,
          orderDate: shortage > 0 ? orderDate : null,
          leadTimeDays,
        };
      })
    );

    return requirements;
  }

  /**
   * Aggiorna costo prodotto basato su BOM e lavorazioni
   */
  async updateProductCostFromBom(productId: string) {
    const cost = await this.calculateProductCost(productId, true);

    await prisma.product.update({
      where: { id: productId },
      data: {
        cost: cost.totalCost,
      },
    });

    return cost;
  }
}

export default new ProductService();
