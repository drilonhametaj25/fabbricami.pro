import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export class ProductRepository {
  /**
   * Find product by ID
   */
  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        bomItems: {
          include: {
            componentProduct: true,
          },
        },
        operations: {
          orderBy: {
            sequence: 'asc',
          },
        },
        inventory: {
          include: {
            warehouse: true,
          },
        },
        productImages: {
          orderBy: { position: 'asc' },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  /**
   * Find product by SKU
   */
  async findBySku(sku: string) {
    return prisma.product.findUnique({
      where: { sku },
      include: {
        variants: true,
        bomItems: {
          include: {
            componentProduct: true,
          },
        },
      },
    });
  }

  /**
   * Find all products with pagination
   */
  async findAll(params: {
    skip: number;
    take: number;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }) {
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        ...params,
        include: {
          variants: true,
          inventory: {
            include: {
              warehouse: true,
            },
          },
          supplier: true,
          productImages: {
            orderBy: { position: 'asc' },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
      }),
      prisma.product.count({ where: params.where }),
    ]);

    return { items, total };
  }

  /**
   * Create product
   */
  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({
      data,
      include: {
        variants: true,
        bomItems: true,
        operations: true,
      },
    });
  }

  /**
   * Update product
   */
  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({
      where: { id },
      data,
      include: {
        variants: true,
        bomItems: true,
        operations: true,
      },
    });
  }

  /**
   * Delete product (soft delete)
   */
  async delete(id: string) {
    return prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get products with low stock
   */
  async getLowStockProducts() {
    const products = await prisma.product.findMany({
      where: { isActive: true } as any,
      include: { inventory: true },
    });

    return products.filter(p => {
      const minLevel = (p as any).minStockLevel ?? 0;
      return (p.inventory || []).some((inv: any) => Number(inv.quantity) <= Number(minLevel));
    });
  }

  /**
   * Calculate product cost
   */
  async calculateProductCost(productId: string): Promise<{
    materialCost: number;
    laborCost: number;
    totalCost: number;
  }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        bomItems: {
          include: {
            componentProduct: true,
          },
        },
        operations: true,
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Costo materiali (ricorsivo per BOM multi-livello)
    let materialCost = 0;
    for (const bomItem of product.bomItems) {
      let componentCost = Number(bomItem.componentProduct.cost);
      
      // Se il componente ha a sua volta BOM, calcola ricorsivamente
      // Verifica se il componente ha a sua volta BOM (parentProductId)
      const componentBom = await prisma.bomItem.count({
        where: { parentProductId: bomItem.componentProduct.id }
      });
      
      if (componentBom > 0) {
        const subCost = await this.calculateProductCost(bomItem.componentProduct.id);
        componentCost = subCost.totalCost;
      }
      
      // Considera scarto
      const adjustedQuantity = Number(bomItem.quantity) * (1 + (Number(bomItem.scrapPercentage) || 0) / 100);
      materialCost += componentCost * adjustedQuantity;
    }

    // Costo lavorazioni
    let laborCost = 0;
    for (const operation of product.operations) {
      const setupHours = (operation.setupTime || 0) / 60;
      const cycleHours = operation.standardTime / 60;
      laborCost += (setupHours + cycleHours) * Number(operation.hourlyRate);
    }

    return {
      materialCost,
      laborCost,
      totalCost: materialCost + laborCost,
    };
  }

  /**
   * Explode BOM multi-level (get all components required)
   */
  async explodeBom(productId: string, quantity: number = 1): Promise<Array<{
    componentId: string;
    sku: string;
    name: string;
    totalQuantity: number;
    unit: string;
    level: number;
  }>> {
    const components = new Map<string, {
      sku: string;
      name: string;
      quantity: number;
      unit: string;
      level: number;
    }>();

    await this.explodeBomRecursive(productId, quantity, 0, components, new Set());

    return Array.from(components.entries()).map(([id, data]) => ({
      componentId: id,
      sku: data.sku,
      name: data.name,
      totalQuantity: data.quantity,
      unit: data.unit,
      level: data.level,
    }));
  }

  /**
   * Recursive BOM explosion
   */
  private async explodeBomRecursive(
    productId: string,
    quantity: number,
    level: number,
    result: Map<string, { sku: string; name: string; quantity: number; unit: string; level: number }>,
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(productId)) return;
    visited.add(productId);

    // Trova i BomItem dove il prodotto è il parent
    const bomItems = await prisma.bomItem.findMany({
      where: { parentProductId: productId },
      include: {
        componentProduct: true,
      },
    });

    for (const item of bomItems) {
      const component = item.componentProduct;
      const adjustedQuantity = Number(item.quantity) * (1 + (Number(item.scrapPercentage) || 0) / 100) * quantity;

      const existing = result.get(component.id);
      if (existing) {
        existing.quantity += adjustedQuantity;
        existing.level = Math.min(existing.level, level + 1);
      } else {
        result.set(component.id, {
          sku: component.sku,
          name: component.name,
          quantity: adjustedQuantity,
    unit: (component as any).unit || 'pz',
          level: level + 1,
        });
      }

      // Check if component has sub-BOM
      const subBomCount = await prisma.bomItem.count({
        where: { parentProductId: component.id }
      });

      if (subBomCount > 0) {
        await this.explodeBomRecursive(component.id, adjustedQuantity, level + 1, result, visited);
      }
    }
  }

  /**
   * Find products by category
   */
  async findByCategory(category: string) {
    // Cast where to any to avoid strict Prisma input type differences
    return prisma.product.findMany({
      where: { category, isActive: true } as any,
      include: { inventory: true },
    });
  }

  /**
   * Search products (SKU, name, barcode)
   */
  async search(query: string, limit: number = 20) {
    return prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { sku: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: { inventory: true },
    });
  }

  /**
   * Get sellable products
   */
  async findSellable() {
    return prisma.product.findMany({
      where: { 
        isActive: true,
        isSellable: true, // Solo prodotti vendibili
      } as any,
      orderBy: { name: 'asc' },
      include: { inventory: true, variants: true },
    });
  }

  /**
   * Get materials (raw materials)
   */
  async findMaterials() {
    return prisma.product.findMany({
      where: { 
        isActive: true,
        isSellable: false, // Materiali non vendibili
        type: 'RAW_MATERIAL',
      } as any,
      orderBy: { name: 'asc' },
      include: { 
        inventory: true,
        supplier: true,
      },
    });
  }

  /**
   * Get products requiring reorder (based on reorder point)
   */
  async getProductsRequiringReorder() {
    // Prisma cannot compare relation field to parent field in a where.
    // Fetch products with inventory then filter in JS by minStockLevel/reorderQuantity.
    const products = await prisma.product.findMany({
      where: { isActive: true } as any,
      include: { inventory: true },
    });

    return products.filter(p => {
      const minLevel = (p as any).minStockLevel ?? 0;
      return (p.inventory || []).some((inv: any) => Number(inv.quantity) <= Number(minLevel));
    });
  }
}

export default new ProductRepository();
