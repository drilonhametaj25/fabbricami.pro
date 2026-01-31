// Imports
import supplierRepository from '../repositories/supplier.repository';
import { prisma } from '../config/database';
import logger from '../config/logger';
import { PurchaseOrderStatus } from '@prisma/client';

// Types/Interfaces
interface CreateSupplierInput {
  code: string;
  businessName: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: {
    street: string;
    city: string;
    zip: string;
    country: string;
  };
  paymentTerms?: number;
  notes?: string;
}

interface UpdateSupplierInput {
  businessName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: any;
  paymentTerms?: number;
  isActive?: boolean;
  notes?: string;
  defaultLeadTimeDays?: number;
  bankName?: string;
  iban?: string;
  swift?: string;
}

interface ListSuppliersQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface SupplierItemInput {
  productId?: string;
  materialId?: string;
  supplierSku?: string;
  lastPurchasePrice: number;
  minOrderQuantity?: number;
  packagingUnit?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
  notes?: string;
}

interface VolumeDiscountInput {
  minQuantity: number;
  discountPercent?: number;
  fixedPrice?: number;
}

/**
 * Supplier Service
 * Business logic per gestione fornitori
 */
class SupplierService {
  /**
   * Transform supplier address from JSON to flat fields
   */
  private transformSupplierAddress(supplier: any) {
    if (!supplier) return supplier;

    const addressJson = supplier.address as any;
    return {
      ...supplier,
      // Map businessName to name for frontend compatibility
      name: supplier.businessName || supplier.name,
      // Flatten address JSON to separate fields
      address: addressJson?.street || addressJson?.address || '',
      city: addressJson?.city || '',
      postalCode: addressJson?.zip || addressJson?.postalCode || '',
      country: addressJson?.country || '',
      // Keep original as backup
      _addressJson: supplier.address,
    };
  }

  /**
   * Transform flat address fields to JSON for storage
   */
  private transformAddressToJson(data: any) {
    if (data.address !== undefined || data.city !== undefined || data.postalCode !== undefined || data.country !== undefined) {
      return {
        street: data.address || '',
        city: data.city || '',
        zip: data.postalCode || '',
        country: data.country || '',
      };
    }
    return data.address;
  }

  /**
   * Lista fornitori con paginazione e filtri
   */
  async listSuppliers(query: ListSuppliersQuery) {
    const { page = 1, limit = 20, search, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const result = await supplierRepository.findAll({
      skip,
      take: limit,
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    logger.info(`Listed suppliers: ${result.items.length} of ${result.total}`);

    // Transform address JSON to flat fields for each supplier
    const transformedItems = result.items.map((item) => this.transformSupplierAddress(item));

    return {
      items: transformedItems,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Ottieni fornitore per ID con statistiche
   */
  async getSupplierById(id: string) {
    const supplier = await supplierRepository.findById(id);

    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Ottieni statistiche
    const stats = await supplierRepository.getSupplierStats(id);

    logger.info(`Retrieved supplier: ${supplier.code}`);

    // Transform address JSON to flat fields
    const transformed = this.transformSupplierAddress(supplier);

    return {
      ...transformed,
      stats,
    };
  }

  /**
   * Crea nuovo fornitore
   */
  async createSupplier(data: CreateSupplierInput & { name?: string; city?: string; postalCode?: string; country?: string }) {
    // Verifica che il codice non esista già
    const existing = await supplierRepository.findByCode(data.code);
    if (existing) {
      throw new Error('Codice fornitore già esistente');
    }

    // Transform flat address fields to JSON if provided
    const addressJson = this.transformAddressToJson(data);

    // Map name to businessName for frontend compatibility
    const businessName = data.businessName || (data as any).name;

    const supplier = await supplierRepository.create({
      code: data.code,
      businessName,
      email: data.email,
      phone: data.phone,
      taxId: data.taxId,
      address: addressJson,
      paymentTerms: data.paymentTerms || 30,
      notes: data.notes,
    });

    logger.info(`Created supplier: ${supplier.code} - ${supplier.businessName}`);

    // Return with transformed address
    return this.transformSupplierAddress(supplier);
  }

  /**
   * Aggiorna fornitore
   */
  async updateSupplier(id: string, data: UpdateSupplierInput & { name?: string; city?: string; postalCode?: string; country?: string }) {
    const existing = await supplierRepository.findById(id);
    if (!existing) {
      throw new Error('Fornitore non trovato');
    }

    // Transform flat address fields to JSON if provided
    const updateData = { ...data };
    if (data.address !== undefined || data.city !== undefined || data.postalCode !== undefined || data.country !== undefined) {
      updateData.address = this.transformAddressToJson(data);
      // Remove flat fields from update data
      delete (updateData as any).city;
      delete (updateData as any).postalCode;
      delete (updateData as any).country;
    }

    // Map name to businessName for frontend compatibility
    if ((data as any).name !== undefined) {
      updateData.businessName = (data as any).name;
      delete (updateData as any).name;
    }

    const supplier = await supplierRepository.update(id, updateData);

    logger.info(`Updated supplier: ${supplier.code}`);

    // Return with transformed address
    return this.transformSupplierAddress(supplier);
  }

  /**
   * Disattiva fornitore (soft delete)
   */
  async deleteSupplier(id: string) {
    const existing = await supplierRepository.findById(id);
    if (!existing) {
      throw new Error('Fornitore non trovato');
    }

    // Verifica che non ci siano ordini aperti
    // TODO: Implementare controllo ordini attivi

    const supplier = await supplierRepository.delete(id);

    logger.info(`Deleted supplier: ${supplier.code}`);

    return supplier;
  }

  /**
   * Ottieni statistiche fornitore
   */
  async getSupplierStatistics(id: string) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    const stats = await supplierRepository.getSupplierStats(id);

    return {
      supplier: {
        code: supplier.code,
        businessName: supplier.businessName,
      },
      ...stats,
    };
  }

  /**
   * Genera codice fornitore automatico
   */
  async generateSupplierCode(): Promise<string> {
    // Genera codice tipo SUP001, SUP002, etc.
    const lastSupplier = await supplierRepository.findAll({
      skip: 0,
      take: 1,
      orderBy: { code: 'desc' },
    });

    let nextNumber = 1;
    if (lastSupplier.items.length > 0) {
      const lastCode = lastSupplier.items[0].code;
      const match = lastCode.match(/SUP(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `SUP${nextNumber.toString().padStart(3, '0')}`;
  }

  // ============================================
  // PERFORMANCE TRACKING
  // ============================================

  /**
   * Ottieni performance dettagliate del fornitore
   */
  async getSupplierPerformance(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchaseOrders: {
          where: {
            status: { in: ['RECEIVED'] as PurchaseOrderStatus[] },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        goodsReceipts: {
          where: {
            status: 'COMPLETED',
          },
          orderBy: { receiptDate: 'desc' },
          take: 50,
          include: {
            items: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Calcola metriche di puntualità
    const deliveryMetrics = this.calculateDeliveryMetrics(supplier.purchaseOrders as any[]);

    // Calcola metriche di qualità
    const qualityMetrics = this.calculateQualityMetrics(supplier.goodsReceipts as any[]);

    // Calcola metriche di costo
    const costMetrics = await this.calculateCostMetrics(supplierId);

    // Trend ultimi 6 mesi
    const trend = await this.getPerformanceTrend(supplierId);

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        businessName: supplier.businessName,
      },
      currentMetrics: {
        onTimeDeliveryRate: supplier.onTimeDeliveryRate ? Number(supplier.onTimeDeliveryRate) : null,
        qualityRating: supplier.qualityRating ? Number(supplier.qualityRating) : null,
        avgDeliveryDays: supplier.avgDeliveryDays,
        totalDeliveries: supplier.totalDeliveries,
        lateDeliveries: supplier.lateDeliveries,
        defectiveDeliveries: supplier.defectiveDeliveries,
      },
      calculatedMetrics: {
        delivery: deliveryMetrics,
        quality: qualityMetrics,
        cost: costMetrics,
      },
      trend,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Calcola metriche di consegna
   */
  private calculateDeliveryMetrics(orders: any[]) {
    if (orders.length === 0) {
      return {
        totalOrders: 0,
        onTimeCount: 0,
        lateCount: 0,
        onTimeRate: 0,
        avgLeadTimeDays: 0,
        avgLateDays: 0,
      };
    }

    let onTimeCount = 0;
    let lateCount = 0;
    let totalLeadTimeDays = 0;
    let totalLateDays = 0;

    for (const order of orders) {
      const expectedDate = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null;
      const actualDate = order.receivedDate ? new Date(order.receivedDate) : null;

      if (expectedDate && actualDate) {
        const diffDays = Math.floor((actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          onTimeCount++;
        } else {
          lateCount++;
          totalLateDays += diffDays;
        }

        // Lead time from order to delivery
        const orderDate = new Date(order.orderDate);
        const leadTime = Math.floor((actualDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        totalLeadTimeDays += leadTime;
      }
    }

    const ordersWithDates = orders.filter((o) => o.expectedDeliveryDate && o.receivedDate).length;

    return {
      totalOrders: orders.length,
      onTimeCount,
      lateCount,
      onTimeRate: ordersWithDates > 0 ? Math.round((onTimeCount / ordersWithDates) * 100) : 0,
      avgLeadTimeDays: ordersWithDates > 0 ? Math.round(totalLeadTimeDays / ordersWithDates) : 0,
      avgLateDays: lateCount > 0 ? Math.round(totalLateDays / lateCount) : 0,
    };
  }

  /**
   * Calcola metriche di qualità
   */
  private calculateQualityMetrics(goodsReceipts: any[]) {
    if (goodsReceipts.length === 0) {
      return {
        totalReceipts: 0,
        passedInspection: 0,
        failedInspection: 0,
        conditionalInspection: 0,
        qualityRate: 0,
        totalItemsReceived: 0,
        rejectedItems: 0,
        rejectionRate: 0,
      };
    }

    let passedInspection = 0;
    let failedInspection = 0;
    let conditionalInspection = 0;
    let totalItemsReceived = 0;
    let rejectedItems = 0;

    for (const receipt of goodsReceipts) {
      switch (receipt.inspectionStatus) {
        case 'PASSED':
          passedInspection++;
          break;
        case 'FAILED':
          failedInspection++;
          break;
        case 'CONDITIONAL':
          conditionalInspection++;
          break;
      }

      for (const item of receipt.items || []) {
        totalItemsReceived += item.receivedQuantity || 0;
        rejectedItems += item.rejectedQuantity || 0;
      }
    }

    const inspectedReceipts = passedInspection + failedInspection + conditionalInspection;

    return {
      totalReceipts: goodsReceipts.length,
      passedInspection,
      failedInspection,
      conditionalInspection,
      qualityRate: inspectedReceipts > 0 ? Math.round((passedInspection / inspectedReceipts) * 100) : 100,
      totalItemsReceived,
      rejectedItems,
      rejectionRate: totalItemsReceived > 0 ? Math.round((rejectedItems / totalItemsReceived) * 100 * 100) / 100 : 0,
    };
  }

  /**
   * Calcola metriche di costo
   */
  private async calculateCostMetrics(supplierId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [totalSpent, orderCount, avgOrderValue] = await Promise.all([
      prisma.purchaseOrder.aggregate({
        where: {
          supplierId,
          status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
          createdAt: { gte: sixMonthsAgo },
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.purchaseOrder.count({
        where: {
          supplierId,
          status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
        },
      }),
      prisma.purchaseOrder.aggregate({
        where: {
          supplierId,
          status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
        },
        _avg: { total: true },
      }),
    ]);

    return {
      totalSpentLast6Months: Number(totalSpent._sum?.total) || 0,
      ordersLast6Months: totalSpent._count,
      totalOrders: orderCount,
      avgOrderValue: Number(avgOrderValue._avg?.total) || 0,
    };
  }

  /**
   * Trend performance ultimi 6 mesi
   */
  private async getPerformanceTrend(supplierId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        createdAt: { gte: sixMonthsAgo },
        status: { in: ['RECEIVED'] as PurchaseOrderStatus[] },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Raggruppa per mese
    const monthlyData: Record<string, { onTime: number; late: number; total: number }> = {};

    for (const order of orders as any[]) {
      const monthKey = new Date(order.createdAt).toISOString().substring(0, 7);

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { onTime: 0, late: 0, total: 0 };
      }

      monthlyData[monthKey].total++;

      if (order.estimatedDeliveryDate && order.receivedDate) {
        const expected = new Date(order.estimatedDeliveryDate);
        const actual = new Date(order.receivedDate);

        if (actual <= expected) {
          monthlyData[monthKey].onTime++;
        } else {
          monthlyData[monthKey].late++;
        }
      }
    }

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
      onTimeRate: data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0,
    }));
  }

  /**
   * Aggiorna metriche performance dopo goods receipt
   */
  async updatePerformanceMetrics(supplierId: string, goodsReceiptId: string) {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: goodsReceiptId },
      include: {
        purchaseOrder: true,
        items: true,
      },
    });

    if (!receipt) {
      throw new Error('Entrata merce non trovata');
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Calcola se consegna in ritardo
    let isLate = false;
    const poAny = receipt.purchaseOrder as any;
    if (poAny.estimatedDeliveryDate) {
      isLate = receipt.receiptDate > poAny.estimatedDeliveryDate;
    }

    // Calcola se ci sono problemi di qualità
    let hasQualityIssues = receipt.inspectionStatus === 'FAILED';

    // Aggiorna contatori
    const newTotalDeliveries = supplier.totalDeliveries + 1;
    const newLateDeliveries = isLate ? supplier.lateDeliveries + 1 : supplier.lateDeliveries;
    const newDefectiveDeliveries = hasQualityIssues
      ? supplier.defectiveDeliveries + 1
      : supplier.defectiveDeliveries;

    // Calcola nuove percentuali
    const newOnTimeRate = ((newTotalDeliveries - newLateDeliveries) / newTotalDeliveries) * 100;

    // Calcola media giorni consegna
    const allReceipts = await prisma.goodsReceipt.findMany({
      where: {
        supplierId,
        status: 'COMPLETED',
      },
      include: {
        purchaseOrder: true,
      },
    });

    let totalDays = 0;
    let countWithDates = 0;
    for (const r of allReceipts as any[]) {
      if (r.purchaseOrder.createdAt) {
        const days = Math.floor(
          (r.receiptDate.getTime() - r.purchaseOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
        countWithDates++;
      }
    }

    const avgDeliveryDays = countWithDates > 0 ? Math.round(totalDays / countWithDates) : null;

    // Calcola quality rating (1-5)
    const qualityRate = newTotalDeliveries > 0
      ? 5 - (4 * newDefectiveDeliveries / newTotalDeliveries)
      : 5;

    // Aggiorna fornitore
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        totalDeliveries: newTotalDeliveries,
        lateDeliveries: newLateDeliveries,
        defectiveDeliveries: newDefectiveDeliveries,
        onTimeDeliveryRate: newOnTimeRate,
        avgDeliveryDays,
        qualityRating: Math.round(qualityRate * 100) / 100,
      },
    });

    logger.info(`Updated performance metrics for supplier ${supplierId}`);

    return {
      totalDeliveries: newTotalDeliveries,
      lateDeliveries: newLateDeliveries,
      defectiveDeliveries: newDefectiveDeliveries,
      onTimeDeliveryRate: newOnTimeRate,
      avgDeliveryDays,
      qualityRating: Math.round(qualityRate * 100) / 100,
    };
  }

  // ============================================
  // PRICE SUGGESTIONS & CATALOG
  // ============================================

  /**
   * Ottieni listino fornitore
   */
  async getSupplierCatalog(supplierId: string) {
    const items = await prisma.supplierItem.findMany({
      where: {
        supplierId,
        isActive: true,
      },
      include: {
        product: {
          select: { id: true, sku: true, name: true, cost: true },
        },
        material: {
          select: { id: true, sku: true, name: true, cost: true },
        },
        volumeDiscounts: {
          orderBy: { minQuantity: 'asc' },
        },
      },
      orderBy: { lastPurchaseDate: 'desc' },
    });

    return items.map((item) => ({
      id: item.id,
      type: item.productId ? 'PRODUCT' : 'MATERIAL',
      itemId: item.productId || item.materialId,
      itemName: item.product?.name || item.material?.name,
      itemSku: item.product?.sku || item.material?.sku,
      supplierSku: item.supplierSku,
      currentCost: item.product?.cost || item.material?.cost,
      lastPurchasePrice: Number(item.lastPurchasePrice),
      avgPurchasePrice: item.avgPurchasePrice ? Number(item.avgPurchasePrice) : null,
      minOrderQuantity: item.minOrderQuantity,
      packagingUnit: item.packagingUnit,
      leadTimeDays: item.leadTimeDays,
      isPreferred: item.isPreferred,
      lastPurchaseDate: item.lastPurchaseDate,
      totalPurchased: item.totalPurchased,
      volumeDiscounts: item.volumeDiscounts.map((vd) => ({
        minQuantity: vd.minQuantity,
        discountPercent: Number(vd.discountPercent),
        fixedPrice: vd.fixedPrice ? Number(vd.fixedPrice) : null,
      })),
    }));
  }

  /**
   * Aggiungi/aggiorna articolo nel listino fornitore
   */
  async upsertSupplierItem(supplierId: string, data: SupplierItemInput) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Verifica che prodotto o materiale esista
    if (data.productId) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new Error('Prodotto non trovato');
    }

    if (data.materialId) {
      const material = await prisma.material.findUnique({ where: { id: data.materialId } });
      if (!material) throw new Error('Materiale non trovato');
    }

    // Upsert
    const whereClause = data.productId
      ? { supplierId_productId: { supplierId, productId: data.productId } }
      : { supplierId_materialId: { supplierId, materialId: data.materialId! } };

    const supplierItem = await prisma.supplierItem.upsert({
      where: whereClause as any,
      update: {
        supplierSku: data.supplierSku,
        lastPurchasePrice: data.lastPurchasePrice,
        minOrderQuantity: data.minOrderQuantity || 1,
        packagingUnit: data.packagingUnit || 1,
        leadTimeDays: data.leadTimeDays,
        isPreferred: data.isPreferred ?? false,
        notes: data.notes,
        lastPurchaseDate: new Date(),
      },
      create: {
        supplierId,
        productId: data.productId,
        materialId: data.materialId,
        supplierSku: data.supplierSku,
        lastPurchasePrice: data.lastPurchasePrice,
        minOrderQuantity: data.minOrderQuantity || 1,
        packagingUnit: data.packagingUnit || 1,
        leadTimeDays: data.leadTimeDays,
        isPreferred: data.isPreferred ?? false,
        notes: data.notes,
      },
      include: {
        product: true,
        material: true,
        volumeDiscounts: true,
      },
    });

    logger.info(`Upserted supplier item for ${supplierId}: ${data.productId || data.materialId}`);

    return supplierItem;
  }

  /**
   * Aggiungi sconto quantità
   */
  async addVolumeDiscount(supplierItemId: string, data: VolumeDiscountInput) {
    return await prisma.supplierVolumeDiscount.create({
      data: {
        supplierItemId,
        minQuantity: data.minQuantity,
        discountPercent: data.discountPercent || 0,
        fixedPrice: data.fixedPrice,
      },
    });
  }

  /**
   * Suggerimento prezzo per un articolo
   */
  async getPriceSuggestion(productId?: string, materialId?: string, quantity: number = 1) {
    const itemId = productId || materialId;
    const itemType = productId ? 'productId' : 'materialId';

    // Trova tutti i fornitori che offrono questo articolo
    const supplierItems = await prisma.supplierItem.findMany({
      where: {
        [itemType]: itemId,
        isActive: true,
      },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            businessName: true,
            onTimeDeliveryRate: true,
            qualityRating: true,
            avgDeliveryDays: true,
            defaultLeadTimeDays: true,
          },
        },
        volumeDiscounts: {
          orderBy: { minQuantity: 'asc' },
        },
      },
    });

    if (supplierItems.length === 0) {
      return {
        suggestions: [],
        message: 'Nessun fornitore trovato per questo articolo',
      };
    }

    // Calcola prezzo finale per ogni fornitore
    const suggestions = supplierItems.map((item) => {
      let finalPrice = Number(item.lastPurchasePrice);
      let appliedDiscount: { minQuantity: number; discountPercent: number } | null = null;

      // Applica sconto quantità se applicabile
      for (const discount of item.volumeDiscounts) {
        if (quantity >= discount.minQuantity) {
          if (discount.fixedPrice) {
            finalPrice = Number(discount.fixedPrice);
          } else {
            finalPrice = Number(item.lastPurchasePrice) * (1 - Number(discount.discountPercent) / 100);
          }
          appliedDiscount = {
            minQuantity: discount.minQuantity,
            discountPercent: Number(discount.discountPercent),
          };
        }
      }

      // Calcola punteggio complessivo (prezzo + qualità + puntualità)
      const priceScore = 1 / finalPrice; // Più basso il prezzo, meglio è
      const qualityScore = item.supplier.qualityRating ? Number(item.supplier.qualityRating) / 5 : 0.8;
      const deliveryScore = item.supplier.onTimeDeliveryRate
        ? Number(item.supplier.onTimeDeliveryRate) / 100
        : 0.8;

      const overallScore = (priceScore * 0.5 + qualityScore * 0.3 + deliveryScore * 0.2) * 100;

      return {
        supplierId: item.supplier.id,
        supplierCode: item.supplier.code,
        supplierName: item.supplier.businessName,
        basePrice: Number(item.lastPurchasePrice),
        finalPrice: Math.round(finalPrice * 100) / 100,
        totalPrice: Math.round(finalPrice * quantity * 100) / 100,
        appliedDiscount,
        minOrderQuantity: item.minOrderQuantity,
        packagingUnit: item.packagingUnit,
        leadTimeDays: item.leadTimeDays || item.supplier.defaultLeadTimeDays,
        isPreferred: item.isPreferred,
        performance: {
          onTimeDeliveryRate: item.supplier.onTimeDeliveryRate
            ? Number(item.supplier.onTimeDeliveryRate)
            : null,
          qualityRating: item.supplier.qualityRating ? Number(item.supplier.qualityRating) : null,
          avgDeliveryDays: item.supplier.avgDeliveryDays,
        },
        overallScore: Math.round(overallScore * 100) / 100,
      };
    });

    // Ordina per punteggio complessivo
    suggestions.sort((a, b) => b.overallScore - a.overallScore);

    // Identifica il migliore
    const recommended = suggestions[0];
    const cheapest = [...suggestions].sort((a, b) => a.finalPrice - b.finalPrice)[0];
    const fastest = [...suggestions].sort((a, b) => (a.leadTimeDays || 999) - (b.leadTimeDays || 999))[0];

    return {
      quantity,
      suggestions,
      recommended: {
        supplierId: recommended.supplierId,
        supplierName: recommended.supplierName,
        reason: 'Miglior rapporto qualità-prezzo-puntualità',
      },
      alternatives: {
        cheapest:
          cheapest.supplierId !== recommended.supplierId
            ? {
                supplierId: cheapest.supplierId,
                supplierName: cheapest.supplierName,
                price: cheapest.finalPrice,
                saving: Math.round((recommended.finalPrice - cheapest.finalPrice) * quantity * 100) / 100,
              }
            : null,
        fastest:
          fastest.supplierId !== recommended.supplierId
            ? {
                supplierId: fastest.supplierId,
                supplierName: fastest.supplierName,
                leadTimeDays: fastest.leadTimeDays,
              }
            : null,
      },
    };
  }

  /**
   * Confronta fornitori per un articolo
   */
  async compareSuppliers(supplierIds: string[], productId?: string, materialId?: string) {
    const suppliers = await Promise.all(
      supplierIds.map(async (id) => {
        const supplier = await prisma.supplier.findUnique({
          where: { id },
          include: {
            supplierItems: {
              where: productId ? { productId } : { materialId },
              include: { volumeDiscounts: true },
            },
          },
        });

        const performance = await this.getSupplierPerformance(id);

        return { supplier, performance };
      })
    );

    return suppliers.map((s) => {
      const item = s.supplier?.supplierItems[0];

      return {
        supplierId: s.supplier?.id,
        code: s.supplier?.code,
        businessName: s.supplier?.businessName,
        pricing: item
          ? {
              basePrice: Number(item.lastPurchasePrice),
              avgPrice: item.avgPurchasePrice ? Number(item.avgPurchasePrice) : null,
              volumeDiscounts: item.volumeDiscounts.length,
            }
          : null,
        performance: s.performance.calculatedMetrics,
        currentMetrics: s.performance.currentMetrics,
      };
    });
  }

  /**
   * Storico prezzi per un articolo da un fornitore
   */
  async getPriceHistory(supplierId: string, productId?: string, materialId?: string) {
    // Ottieni ordini di acquisto con questo articolo
    const whereClause = productId
      ? { items: { some: { productId } } }
      : { items: { some: { materialId } } };

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        ...whereClause,
        status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
      },
      include: {
        items: {
          where: productId ? { productId } : { materialId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 24, // Ultimi 24 ordini
    });

    const history = orders.map((order: any) => {
      const item = order.items[0];
      return {
        date: order.createdAt,
        orderNumber: order.orderNumber,
        quantity: item?.quantity || 0,
        price: item ? Number(item.unitPrice) : 0, // Frontend expects 'price', not 'unitPrice'
        unitPrice: item ? Number(item.unitPrice) : 0,
        totalPrice: item ? Number(item.unitPrice) * (item.quantity || 0) : 0,
      };
    });

    // Calcola statistiche
    const prices = history.map((h) => h.price).filter((p) => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Trend (confronto ultimo prezzo vs media)
    const lastPrice = prices.length > 0 ? prices[0] : 0;
    const priceTrend = avgPrice > 0 ? ((lastPrice - avgPrice) / avgPrice) * 100 : 0;
    const trendDirection = priceTrend > 2 ? 'UP' : priceTrend < -2 ? 'DOWN' : 'STABLE';

    // Return format expected by frontend
    return {
      supplierId,
      itemId: productId || materialId,
      // Frontend expects these at root level
      currentPrice: Math.round(lastPrice * 100) / 100,
      avgPrice: Math.round(avgPrice * 100) / 100,
      minPrice: Math.round(minPrice * 100) / 100,
      maxPrice: Math.round(maxPrice * 100) / 100,
      trend: trendDirection,
      priceHistory: history, // Frontend expects 'priceHistory', not 'history'
      // Also keep statistics for backward compatibility
      statistics: {
        avgPrice: Math.round(avgPrice * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100,
        lastPrice: Math.round(lastPrice * 100) / 100,
        priceTrend: Math.round(priceTrend * 100) / 100,
        trendDirection,
      },
    };
  }

  // ============================================
  // SCORECARD MANAGEMENT
  // ============================================

  /**
   * Calcola e salva scorecard per un periodo
   * @param supplierId ID fornitore
   * @param period Periodo (es: "2025-01", "2025-Q1", "2025")
   * @param periodType Tipo periodo: MONTHLY, QUARTERLY, YEARLY
   */
  async calculateScorecard(
    supplierId: string,
    period: string,
    periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  ) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Determina date range in base al periodo
    const { startDate, endDate } = this.getPeriodDateRange(period, periodType);

    // Ottieni dati per il calcolo
    const [purchaseOrders, goodsReceipts] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          supplierId,
          status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.goodsReceipt.findMany({
        where: {
          supplierId,
          status: 'COMPLETED',
          receiptDate: { gte: startDate, lte: endDate },
        },
        include: {
          purchaseOrder: true,
          items: true,
        },
      }),
    ]);

    // Calcola metriche di consegna
    const deliveryMetrics = this.calculatePeriodDeliveryMetrics(purchaseOrders as any[], goodsReceipts as any[]);

    // Calcola metriche di qualità
    const qualityMetrics = this.calculatePeriodQualityMetrics(goodsReceipts as any[]);

    // Calcola metriche di costo
    const costMetrics = await this.calculatePeriodCostMetrics(supplierId, startDate, endDate);

    // Calcola punteggi parziali (0-100)
    const deliveryScore = this.calculateDeliveryScore(deliveryMetrics);
    const qualityScore = this.calculateQualityScore(qualityMetrics);
    const costScore = this.calculateCostScore(costMetrics);
    const reliabilityScore = this.calculateReliabilityScore(deliveryMetrics, qualityMetrics);

    // Calcola punteggio complessivo (media ponderata)
    const overallScore = Math.round(
      deliveryScore * 0.30 +  // 30% puntualità
      qualityScore * 0.35 +   // 35% qualità
      costScore * 0.20 +      // 20% costi
      reliabilityScore * 0.15 // 15% affidabilità
    );

    // Determina rating
    const rating = this.getScoreRating(overallScore);

    // Crea o aggiorna scorecard
    const scorecard = await prisma.supplierScorecard.upsert({
      where: {
        supplierId_period_periodType: {
          supplierId,
          period,
          periodType,
        },
      },
      update: {
        // Delivery metrics
        totalOrders: deliveryMetrics.totalOrders,
        onTimeDeliveries: deliveryMetrics.onTimeCount,
        lateDeliveries: deliveryMetrics.lateCount,
        onTimeDeliveryRate: deliveryMetrics.onTimeRate,
        avgLeadTimeDays: deliveryMetrics.avgLeadTimeDays,
        avgLateDays: deliveryMetrics.avgLateDays,
        // Quality metrics
        totalReceipts: qualityMetrics.totalReceipts,
        passedInspections: qualityMetrics.passedInspection,
        failedInspections: qualityMetrics.failedInspection,
        qualityRate: qualityMetrics.qualityRate,
        totalItemsReceived: qualityMetrics.totalItemsReceived,
        rejectedItems: qualityMetrics.rejectedItems,
        rejectionRate: qualityMetrics.rejectionRate,
        // Cost metrics
        totalSpent: costMetrics.totalSpent,
        avgOrderValue: costMetrics.avgOrderValue,
        priceVariance: costMetrics.priceVariance,
        // Scores
        overallScore,
        deliveryScore,
        qualityScore,
        costScore,
        reliabilityScore,
        rating,
        calculatedAt: new Date(),
      },
      create: {
        supplierId,
        period,
        periodType,
        // Delivery metrics
        totalOrders: deliveryMetrics.totalOrders,
        onTimeDeliveries: deliveryMetrics.onTimeCount,
        lateDeliveries: deliveryMetrics.lateCount,
        onTimeDeliveryRate: deliveryMetrics.onTimeRate,
        avgLeadTimeDays: deliveryMetrics.avgLeadTimeDays,
        avgLateDays: deliveryMetrics.avgLateDays,
        // Quality metrics
        totalReceipts: qualityMetrics.totalReceipts,
        passedInspections: qualityMetrics.passedInspection,
        failedInspections: qualityMetrics.failedInspection,
        qualityRate: qualityMetrics.qualityRate,
        totalItemsReceived: qualityMetrics.totalItemsReceived,
        rejectedItems: qualityMetrics.rejectedItems,
        rejectionRate: qualityMetrics.rejectionRate,
        // Cost metrics
        totalSpent: costMetrics.totalSpent,
        avgOrderValue: costMetrics.avgOrderValue,
        priceVariance: costMetrics.priceVariance,
        // Scores
        overallScore,
        deliveryScore,
        qualityScore,
        costScore,
        reliabilityScore,
        rating,
        calculatedAt: new Date(),
      },
      include: {
        supplier: {
          select: { id: true, code: true, businessName: true },
        },
      },
    });

    logger.info(`Calculated scorecard for supplier ${supplierId}, period ${period}`);

    return scorecard;
  }

  /**
   * Ottieni scorecard per un periodo specifico
   */
  async getScorecard(supplierId: string, period: string, periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY') {
    const scorecard = await prisma.supplierScorecard.findUnique({
      where: {
        supplierId_period_periodType: {
          supplierId,
          period,
          periodType,
        },
      },
      include: {
        supplier: {
          select: { id: true, code: true, businessName: true },
        },
      },
    });

    if (!scorecard) {
      throw new Error('Scorecard non trovata per questo periodo');
    }

    return this.formatScorecard(scorecard);
  }

  /**
   * Ottieni storico scorecard per un fornitore
   */
  async getScorecardHistory(
    supplierId: string,
    periodType?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    limit: number = 12
  ) {
    const where: any = { supplierId };
    if (periodType) {
      where.periodType = periodType;
    }

    const scorecards = await prisma.supplierScorecard.findMany({
      where,
      orderBy: { period: 'desc' },
      take: limit,
      include: {
        supplier: {
          select: { id: true, code: true, businessName: true },
        },
      },
    });

    return scorecards.map((s) => this.formatScorecard(s));
  }

  /**
   * Confronta scorecard di più fornitori
   */
  async compareSuppliersScorecard(
    supplierIds: string[],
    period: string,
    periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  ) {
    const scorecards = await Promise.all(
      supplierIds.map(async (supplierId) => {
        try {
          // Prima prova a ottenere scorecard esistente
          const existing = await prisma.supplierScorecard.findUnique({
            where: {
              supplierId_period_periodType: { supplierId, period, periodType },
            },
            include: {
              supplier: { select: { id: true, code: true, businessName: true } },
            },
          });

          if (existing) {
            return this.formatScorecard(existing);
          }

          // Se non esiste, calcola al volo
          const calculated = await this.calculateScorecard(supplierId, period, periodType);
          return this.formatScorecard(calculated);
        } catch (error) {
          // Ritorna null per fornitori non trovati
          return null;
        }
      })
    );

    const validScorecards = scorecards.filter((s) => s !== null);

    // Calcola ranking per ogni metrica
    const rankings = this.calculateRankings(validScorecards);

    return {
      period,
      periodType,
      comparison: validScorecards.map((sc: any) => ({
        ...sc,
        rankings: rankings[sc.supplierId],
      })),
      summary: {
        bestOverall: this.findBest(validScorecards, 'overallScore'),
        bestDelivery: this.findBest(validScorecards, 'deliveryScore'),
        bestQuality: this.findBest(validScorecards, 'qualityScore'),
        bestCost: this.findBest(validScorecards, 'costScore'),
      },
    };
  }

  /**
   * Genera report PDF scorecard
   */
  async generateScorecardReport(supplierId: string, periods: number = 6) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error('Fornitore non trovato');
    }

    // Ottieni storico scorecard
    const scorecards = await this.getScorecardHistory(supplierId, 'MONTHLY', periods);

    // Ottieni performance corrente
    const currentPerformance = await this.getSupplierPerformance(supplierId);

    return {
      supplier: {
        id: supplier.id,
        code: supplier.code,
        businessName: supplier.businessName,
        email: supplier.email,
        phone: supplier.phone,
      },
      currentPerformance,
      scorecardHistory: scorecards,
      trends: this.calculateTrends(scorecards),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calcola scorecard per tutti i fornitori attivi
   */
  async calculateAllScorecards(period: string, periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY') {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, code: true, businessName: true },
    });

    const results = [];
    for (const supplier of suppliers) {
      try {
        const scorecard = await this.calculateScorecard(supplier.id, period, periodType);
        results.push({
          supplierId: supplier.id,
          supplierCode: supplier.code,
          success: true,
          overallScore: scorecard.overallScore,
          rating: scorecard.rating,
        });
      } catch (error) {
        results.push({
          supplierId: supplier.id,
          supplierCode: supplier.code,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(`Calculated scorecards for ${results.filter((r) => r.success).length}/${suppliers.length} suppliers`);

    return {
      period,
      periodType,
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Ottieni ranking fornitori per periodo
   */
  async getSupplierRanking(
    periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    period?: string,
    limit: number = 20
  ) {
    // Se non specificato, usa il periodo corrente
    const targetPeriod = period || this.getCurrentPeriod(periodType);

    const scorecards = await prisma.supplierScorecard.findMany({
      where: {
        period: targetPeriod,
        periodType,
      },
      orderBy: { overallScore: 'desc' },
      take: limit,
      include: {
        supplier: {
          select: { id: true, code: true, businessName: true, isActive: true },
        },
      },
    });

    return {
      period: targetPeriod,
      periodType,
      rankings: scorecards.map((sc, index) => ({
        rank: index + 1,
        supplierId: sc.supplierId,
        supplierCode: sc.supplier.code,
        supplierName: sc.supplier.businessName,
        isActive: sc.supplier.isActive,
        overallScore: sc.overallScore,
        deliveryScore: sc.deliveryScore,
        qualityScore: sc.qualityScore,
        costScore: sc.costScore,
        rating: sc.rating,
      })),
    };
  }

  // ============================================
  // HELPER METHODS FOR SCORECARD
  // ============================================

  private getPeriodDateRange(period: string, periodType: string): { startDate: Date; endDate: Date } {
    let startDate: Date;
    let endDate: Date;

    if (periodType === 'MONTHLY') {
      // Format: "2025-01"
      const [year, month] = period.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else if (periodType === 'QUARTERLY') {
      // Format: "2025-Q1"
      const [year, q] = period.split('-Q');
      const quarter = parseInt(q);
      startDate = new Date(parseInt(year), (quarter - 1) * 3, 1);
      endDate = new Date(parseInt(year), quarter * 3, 0, 23, 59, 59);
    } else {
      // YEARLY - Format: "2025"
      const year = parseInt(period);
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    return { startDate, endDate };
  }

  private calculatePeriodDeliveryMetrics(orders: any[], receipts: any[]) {
    if (orders.length === 0) {
      return {
        totalOrders: 0,
        onTimeCount: 0,
        lateCount: 0,
        onTimeRate: 0,
        avgLeadTimeDays: 0,
        avgLateDays: 0,
      };
    }

    let onTimeCount = 0;
    let lateCount = 0;
    let totalLeadTime = 0;
    let totalLateDays = 0;
    let countWithDates = 0;

    for (const receipt of receipts) {
      const order = orders.find((o) => o.id === receipt.purchaseOrderId);
      if (!order) continue;

      const expectedDate = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null;
      const receiptDate = new Date(receipt.receiptDate);
      const orderDate = new Date(order.createdAt);

      if (expectedDate) {
        const diffDays = Math.floor((receiptDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          onTimeCount++;
        } else {
          lateCount++;
          totalLateDays += diffDays;
        }
        countWithDates++;
      }

      // Lead time
      const leadTime = Math.floor((receiptDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      totalLeadTime += leadTime;
    }

    return {
      totalOrders: orders.length,
      onTimeCount,
      lateCount,
      onTimeRate: countWithDates > 0 ? Math.round((onTimeCount / countWithDates) * 100) : 0,
      avgLeadTimeDays: receipts.length > 0 ? Math.round(totalLeadTime / receipts.length) : 0,
      avgLateDays: lateCount > 0 ? Math.round(totalLateDays / lateCount) : 0,
    };
  }

  private calculatePeriodQualityMetrics(receipts: any[]) {
    if (receipts.length === 0) {
      return {
        totalReceipts: 0,
        passedInspection: 0,
        failedInspection: 0,
        qualityRate: 100,
        totalItemsReceived: 0,
        rejectedItems: 0,
        rejectionRate: 0,
      };
    }

    let passedInspection = 0;
    let failedInspection = 0;
    let totalItemsReceived = 0;
    let rejectedItems = 0;

    for (const receipt of receipts) {
      if (receipt.inspectionStatus === 'PASSED') passedInspection++;
      if (receipt.inspectionStatus === 'FAILED') failedInspection++;

      for (const item of receipt.items || []) {
        totalItemsReceived += item.receivedQuantity || 0;
        rejectedItems += item.rejectedQuantity || 0;
      }
    }

    const inspected = passedInspection + failedInspection;

    return {
      totalReceipts: receipts.length,
      passedInspection,
      failedInspection,
      qualityRate: inspected > 0 ? Math.round((passedInspection / inspected) * 100) : 100,
      totalItemsReceived,
      rejectedItems,
      rejectionRate: totalItemsReceived > 0 ? Math.round((rejectedItems / totalItemsReceived) * 10000) / 100 : 0,
    };
  }

  private async calculatePeriodCostMetrics(supplierId: string, startDate: Date, endDate: Date) {
    const [totals, priceVariance] = await Promise.all([
      prisma.purchaseOrder.aggregate({
        where: {
          supplierId,
          status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      // Calcola varianza prezzi rispetto ai prezzi medi storici
      this.calculatePriceVariance(supplierId, startDate, endDate),
    ]);

    return {
      totalSpent: Number(totals._sum?.total) || 0,
      orderCount: totals._count,
      avgOrderValue: Number(totals._avg?.total) || 0,
      priceVariance,
    };
  }

  private async calculatePriceVariance(supplierId: string, startDate: Date, endDate: Date): Promise<number> {
    // Ottieni item degli ordini nel periodo
    const orderItems = await prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          supplierId,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['CONFIRMED', 'RECEIVED'] as PurchaseOrderStatus[] },
        },
      },
      include: {
        product: { select: { cost: true } },
        material: { select: { cost: true } },
      },
    });

    if (orderItems.length === 0) return 0;

    let totalVariance = 0;
    let count = 0;

    for (const item of orderItems) {
      const expectedPrice = item.product?.cost || item.material?.cost;
      if (expectedPrice && item.unitPrice) {
        const variance = ((Number(item.unitPrice) - Number(expectedPrice)) / Number(expectedPrice)) * 100;
        totalVariance += variance;
        count++;
      }
    }

    return count > 0 ? Math.round(totalVariance / count * 100) / 100 : 0;
  }

  private calculateDeliveryScore(metrics: any): number {
    // Base: on-time rate (70%) + penalità per ritardo medio (30%)
    const onTimeScore = metrics.onTimeRate * 0.7;
    const latePenalty = Math.max(0, 30 - (metrics.avgLateDays * 3)); // -3 punti per ogni giorno di ritardo medio
    return Math.round(onTimeScore + latePenalty);
  }

  private calculateQualityScore(metrics: any): number {
    // Base: quality rate (80%) + rejection rate inverso (20%)
    const qualityBase = metrics.qualityRate * 0.8;
    const rejectionPenalty = Math.max(0, 20 - (metrics.rejectionRate * 2)); // -2 punti per ogni % di scarto
    return Math.round(qualityBase + rejectionPenalty);
  }

  private calculateCostScore(metrics: any): number {
    // Punteggio basato su varianza prezzi
    // Varianza 0 = 100, varianza +5% = 75, varianza +10% = 50
    if (metrics.priceVariance <= 0) return 100; // Sotto il prezzo atteso
    if (metrics.priceVariance <= 2) return 90;
    if (metrics.priceVariance <= 5) return 75;
    if (metrics.priceVariance <= 10) return 50;
    return Math.max(0, 50 - (metrics.priceVariance - 10) * 2);
  }

  private calculateReliabilityScore(deliveryMetrics: any, qualityMetrics: any): number {
    // Affidabilità = consistenza nelle consegne e qualità
    const hasEnoughData = deliveryMetrics.totalOrders >= 3;
    if (!hasEnoughData) return 70; // Default per nuovi fornitori

    // Penalizza variabilità alta
    const deliveryConsistency = deliveryMetrics.onTimeRate >= 80 ? 50 : deliveryMetrics.onTimeRate * 0.5;
    const qualityConsistency = qualityMetrics.qualityRate >= 90 ? 50 : qualityMetrics.qualityRate * 0.5;

    return Math.round(deliveryConsistency + qualityConsistency);
  }

  private getScoreRating(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private formatScorecard(scorecard: any) {
    return {
      id: scorecard.id,
      supplierId: scorecard.supplierId,
      supplier: scorecard.supplier,
      period: scorecard.period,
      periodType: scorecard.periodType,
      metrics: {
        delivery: {
          totalOrders: scorecard.totalOrders,
          onTimeDeliveries: scorecard.onTimeDeliveries,
          lateDeliveries: scorecard.lateDeliveries,
          onTimeRate: Number(scorecard.onTimeDeliveryRate),
          avgLeadTimeDays: scorecard.avgLeadTimeDays,
          avgLateDays: scorecard.avgLateDays,
        },
        quality: {
          totalReceipts: scorecard.totalReceipts,
          passedInspections: scorecard.passedInspections,
          failedInspections: scorecard.failedInspections,
          qualityRate: Number(scorecard.qualityRate),
          totalItemsReceived: scorecard.totalItemsReceived,
          rejectedItems: scorecard.rejectedItems,
          rejectionRate: Number(scorecard.rejectionRate),
        },
        cost: {
          totalSpent: Number(scorecard.totalSpent),
          avgOrderValue: Number(scorecard.avgOrderValue),
          priceVariance: Number(scorecard.priceVariance),
        },
      },
      scores: {
        overall: scorecard.overallScore,
        delivery: scorecard.deliveryScore,
        quality: scorecard.qualityScore,
        cost: scorecard.costScore,
        reliability: scorecard.reliabilityScore,
      },
      rating: scorecard.rating,
      calculatedAt: scorecard.calculatedAt,
    };
  }

  private calculateRankings(scorecards: any[]): Record<string, any> {
    const rankings: Record<string, any> = {};

    // Ordina per ogni metrica
    const sortedOverall = [...scorecards].sort((a, b) => b.scores.overall - a.scores.overall);
    const sortedDelivery = [...scorecards].sort((a, b) => b.scores.delivery - a.scores.delivery);
    const sortedQuality = [...scorecards].sort((a, b) => b.scores.quality - a.scores.quality);
    const sortedCost = [...scorecards].sort((a, b) => b.scores.cost - a.scores.cost);

    for (const sc of scorecards) {
      rankings[sc.supplierId] = {
        overall: sortedOverall.findIndex((s) => s.supplierId === sc.supplierId) + 1,
        delivery: sortedDelivery.findIndex((s) => s.supplierId === sc.supplierId) + 1,
        quality: sortedQuality.findIndex((s) => s.supplierId === sc.supplierId) + 1,
        cost: sortedCost.findIndex((s) => s.supplierId === sc.supplierId) + 1,
      };
    }

    return rankings;
  }

  private findBest(scorecards: any[], metric: string) {
    if (scorecards.length === 0) return null;

    const best = scorecards.reduce((prev, curr) => {
      const prevScore = metric.includes('.') ? this.getNestedValue(prev, metric) : prev.scores[metric.replace('Score', '')];
      const currScore = metric.includes('.') ? this.getNestedValue(curr, metric) : curr.scores[metric.replace('Score', '')];
      return currScore > prevScore ? curr : prev;
    });

    return {
      supplierId: best.supplierId,
      supplierName: best.supplier?.businessName,
      score: metric.includes('.') ? this.getNestedValue(best, metric) : best.scores[metric.replace('Score', '')],
    };
  }

  private getNestedValue(obj: any, path: string) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private calculateTrends(scorecards: any[]) {
    if (scorecards.length < 2) {
      return { overall: 'STABLE', delivery: 'STABLE', quality: 'STABLE', cost: 'STABLE' };
    }

    const latest = scorecards[0];
    const previous = scorecards[1];

    const getTrend = (current: number, prev: number) => {
      const diff = current - prev;
      if (diff > 5) return 'UP';
      if (diff < -5) return 'DOWN';
      return 'STABLE';
    };

    return {
      overall: getTrend(latest.scores.overall, previous.scores.overall),
      delivery: getTrend(latest.scores.delivery, previous.scores.delivery),
      quality: getTrend(latest.scores.quality, previous.scores.quality),
      cost: getTrend(latest.scores.cost, previous.scores.cost),
    };
  }

  private getCurrentPeriod(periodType: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (periodType === 'MONTHLY') {
      return `${year}-${month.toString().padStart(2, '0')}`;
    } else if (periodType === 'QUARTERLY') {
      const quarter = Math.ceil(month / 3);
      return `${year}-Q${quarter}`;
    } else {
      return `${year}`;
    }
  }
}

// Main logic & Exports
export default new SupplierService();
