import { prisma } from '../config/database';
import { Prisma, Coupon, CouponType, CouponScope } from '@prisma/client';
import logger from '../config/logger';

/**
 * Coupon creation input
 */
export interface CreateCouponInput {
  code: string;
  name?: string;
  type: CouponType;
  discountValue: number;
  scope?: CouponScope;
  applicableIds?: string[];
  excludedIds?: string[];
  minimumOrderAmount?: number;
  maximumDiscount?: number;
  validFrom: Date;
  validTo: Date;
  maxUses?: number;
  maxUsesPerCustomer?: number;
  customerIds?: string[];
  customerTiers?: string[];
  isActive?: boolean;
}

/**
 * Coupon update input
 */
export interface UpdateCouponInput extends Partial<CreateCouponInput> {}

/**
 * Coupon validation result
 */
export interface CouponValidationResult {
  valid: boolean;
  coupon?: Coupon;
  error?: string;
  discount?: number;
}

/**
 * Cart item for discount calculation
 */
export interface CartItemForDiscount {
  productId: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Coupon Service
 * Gestisce coupon e sconti per e-commerce
 */
class CouponService {
  /**
   * Crea nuovo coupon
   */
  async create(input: CreateCouponInput): Promise<Coupon> {
    const { code, ...data } = input;

    // Verifica unicità codice
    const existing = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      throw new Error('Codice coupon già esistente');
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        name: data.name,
        type: data.type,
        discountValue: data.discountValue,
        scope: data.scope || 'ENTIRE_ORDER',
        applicableIds: data.applicableIds,
        excludedIds: data.excludedIds,
        minimumOrderAmount: data.minimumOrderAmount,
        maximumDiscount: data.maximumDiscount,
        validFrom: data.validFrom,
        validTo: data.validTo,
        maxUses: data.maxUses,
        maxUsesPerCustomer: data.maxUsesPerCustomer,
        customerIds: data.customerIds,
        customerTiers: data.customerTiers,
        isActive: data.isActive ?? true,
      },
    });

    logger.info(`Coupon creato: ${coupon.code}`);
    return coupon;
  }

  /**
   * Aggiorna coupon
   */
  async update(id: string, input: UpdateCouponInput): Promise<Coupon> {
    const { code, ...data } = input;

    // Se cambia il codice, verifica unicità
    if (code) {
      const existing = await prisma.coupon.findFirst({
        where: {
          code: code.toUpperCase(),
          id: { not: id },
        },
      });

      if (existing) {
        throw new Error('Codice coupon già esistente');
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...data,
      },
    });

    return coupon;
  }

  /**
   * Elimina coupon
   */
  async delete(id: string): Promise<void> {
    await prisma.coupon.delete({ where: { id } });
    logger.info(`Coupon eliminato: ${id}`);
  }

  /**
   * Ottiene coupon per ID
   */
  async getById(id: string): Promise<Coupon | null> {
    return prisma.coupon.findUnique({ where: { id } });
  }

  /**
   * Ottiene coupon per codice
   */
  async getByCode(code: string): Promise<Coupon | null> {
    return prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  /**
   * Lista coupon con filtri
   */
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    type?: CouponType;
    scope?: CouponScope;
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      type,
      scope,
    } = params;

    const where: Prisma.CouponWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;
    if (type) where.type = type;
    if (scope) where.scope = scope;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Valida coupon per carrello
   */
  async validateCoupon(
    code: string,
    customerId: string | null,
    cartItems: CartItemForDiscount[],
    subtotal: number
  ): Promise<CouponValidationResult> {
    const coupon = await this.getByCode(code);

    if (!coupon) {
      return { valid: false, error: 'Coupon non trovato' };
    }

    // Verifica attivo
    if (!coupon.isActive) {
      return { valid: false, error: 'Coupon non attivo' };
    }

    // Verifica date validità
    const now = new Date();
    if (now < coupon.validFrom) {
      return { valid: false, error: 'Coupon non ancora valido' };
    }
    if (now > coupon.validTo) {
      return { valid: false, error: 'Coupon scaduto' };
    }

    // Verifica utilizzi totali
    if (coupon.maxUses !== null && coupon.usageCount >= coupon.maxUses) {
      return { valid: false, error: 'Coupon esaurito' };
    }

    // Verifica utilizzi per cliente
    if (customerId && coupon.maxUsesPerCustomer !== null) {
      const customerUsages = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          customerId,
        },
      });

      if (customerUsages >= coupon.maxUsesPerCustomer) {
        return { valid: false, error: 'Hai già utilizzato questo coupon il numero massimo di volte' };
      }
    }

    // Verifica cliente specifico
    if (coupon.customerIds && customerId) {
      const allowedCustomers = coupon.customerIds as string[];
      if (allowedCustomers.length > 0 && !allowedCustomers.includes(customerId)) {
        return { valid: false, error: 'Coupon non valido per questo account' };
      }
    }

    // Verifica tier cliente
    if (coupon.customerTiers && customerId) {
      const loyaltyAccount = await prisma.loyaltyAccount.findUnique({
        where: { customerId },
        select: { tier: true },
      });

      const allowedTiers = coupon.customerTiers as string[];
      if (allowedTiers.length > 0 && (!loyaltyAccount || !allowedTiers.includes(loyaltyAccount.tier))) {
        return { valid: false, error: 'Coupon riservato a clienti di tier superiore' };
      }
    }

    // Verifica importo minimo
    if (coupon.minimumOrderAmount !== null && subtotal < Number(coupon.minimumOrderAmount)) {
      return {
        valid: false,
        error: `Ordine minimo richiesto: €${coupon.minimumOrderAmount}`,
      };
    }

    // Verifica primo ordine
    if (coupon.scope === 'FIRST_ORDER' && customerId) {
      const previousOrders = await prisma.order.count({
        where: {
          customerId,
          status: { not: 'CANCELLED' },
        },
      });

      if (previousOrders > 0) {
        return { valid: false, error: 'Coupon valido solo per il primo ordine' };
      }
    }

    // Calcola sconto
    const discount = this.calculateDiscount(coupon, cartItems, subtotal);

    return {
      valid: true,
      coupon,
      discount,
    };
  }

  /**
   * Calcola sconto coupon
   */
  calculateDiscount(
    coupon: Coupon,
    cartItems: CartItemForDiscount[],
    subtotal: number
  ): number {
    let discount = 0;
    let applicableAmount = subtotal;

    // Filtra items applicabili per scope
    if (coupon.scope === 'PRODUCT' && coupon.applicableIds) {
      const productIds = coupon.applicableIds as string[];
      const excludedIds = (coupon.excludedIds as string[]) || [];

      applicableAmount = cartItems
        .filter(item =>
          productIds.includes(item.productId) &&
          !excludedIds.includes(item.productId)
        )
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    } else if (coupon.scope === 'CATEGORY' && coupon.applicableIds) {
      const categoryIds = coupon.applicableIds as string[];
      const excludedIds = (coupon.excludedIds as string[]) || [];

      applicableAmount = cartItems
        .filter(item =>
          item.categoryId &&
          categoryIds.includes(item.categoryId) &&
          !excludedIds.includes(item.productId)
        )
        .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    }

    if (applicableAmount <= 0) {
      return 0;
    }

    // Calcola sconto base
    switch (coupon.type) {
      case 'FIXED':
        discount = Math.min(Number(coupon.discountValue), applicableAmount);
        break;
      case 'PERCENTAGE':
        discount = applicableAmount * (Number(coupon.discountValue) / 100);
        break;
      case 'FREE_SHIPPING':
        // FREE_SHIPPING non genera sconto diretto, viene gestito nel calcolo spedizione
        discount = 0;
        break;
    }

    // Applica cap massimo
    if (coupon.maximumDiscount !== null) {
      discount = Math.min(discount, Number(coupon.maximumDiscount));
    }

    return Math.round(discount * 100) / 100;
  }

  /**
   * Registra utilizzo coupon
   */
  async recordUsage(
    couponId: string,
    customerId: string,
    orderId: string,
    discountAmount: number
  ): Promise<void> {
    await prisma.$transaction([
      // Crea record utilizzo
      prisma.couponUsage.create({
        data: {
          couponId,
          customerId,
          orderId,
          discountAmount,
        },
      }),
      // Incrementa contatore
      prisma.coupon.update({
        where: { id: couponId },
        data: {
          usageCount: { increment: 1 },
        },
      }),
    ]);

    logger.info(`Coupon ${couponId} utilizzato per ordine ${orderId}`);
  }

  /**
   * Genera codice coupon casuale
   */
  generateCode(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Genera coupon bulk (es. per campagne)
   */
  async generateBulk(
    baseInput: Omit<CreateCouponInput, 'code'>,
    count: number,
    prefix: string = ''
  ): Promise<Coupon[]> {
    const coupons: Coupon[] = [];

    for (let i = 0; i < count; i++) {
      const code = prefix + this.generateCode(8);

      try {
        const coupon = await this.create({
          ...baseInput,
          code,
        });
        coupons.push(coupon);
      } catch (error) {
        // Skip duplicati
        logger.warn(`Skipping duplicate coupon code: ${code}`);
      }
    }

    logger.info(`Generati ${coupons.length} coupon bulk con prefix: ${prefix}`);
    return coupons;
  }

  /**
   * Statistiche utilizzo coupon
   */
  async getStats(couponId: string) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        usages: {
          select: {
            discountAmount: true,
            usedAt: true,
          },
        },
      },
    });

    if (!coupon) {
      throw new Error('Coupon non trovato');
    }

    const totalDiscount = coupon.usages.reduce(
      (sum, u) => sum + Number(u.discountAmount),
      0
    );

    const usagesByDay = coupon.usages.reduce((acc, u) => {
      const day = u.usedAt.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        discountValue: coupon.discountValue,
        isActive: coupon.isActive,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
      },
      stats: {
        totalUses: coupon.usageCount,
        maxUses: coupon.maxUses,
        totalDiscount,
        averageDiscount: coupon.usageCount > 0 ? totalDiscount / coupon.usageCount : 0,
        usagesByDay,
      },
    };
  }

  /**
   * Disattiva coupon scaduti
   */
  async deactivateExpired(): Promise<number> {
    const result = await prisma.coupon.updateMany({
      where: {
        validTo: { lt: new Date() },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count > 0) {
      logger.info(`Disattivati ${result.count} coupon scaduti`);
    }

    return result.count;
  }
}

export default new CouponService();
