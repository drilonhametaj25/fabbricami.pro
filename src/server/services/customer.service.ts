import { prisma } from '../config/database';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateContactInput,
  UpdateContactInput,
  CreateBankInfoInput,
  UpdateBankInfoInput,
  WpCustomerImportInput,
} from '../schemas/customer.schema';

/**
 * Customer Service
 * Business logic per gestione clienti B2C/B2B
 */
class CustomerService {
  /**
   * Lista clienti con filtri e paginazione
   */
  async listCustomers(params: {
    page?: number;
    limit?: number;
    type?: 'B2C' | 'B2B';
    search?: string;
    isActive?: boolean;
    customerGroup?: string;
    priceListId?: string;
    hasOrders?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 50,
      type,
      search,
      isActive,
      customerGroup,
      priceListId,
      hasOrders,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
      ...(customerGroup && { customerGroup }),
      ...(priceListId && { priceListId }),
      ...(hasOrders !== undefined && {
        totalOrders: hasOrders ? { gt: 0 } : { equals: 0 },
      }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { businessName: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { taxId: { contains: search, mode: 'insensitive' } },
          { fiscalCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          priceList: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              orders: true,
              contacts: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dettaglio cliente con storico ordini, contatti e info bancarie
   */
  async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        priceList: true,
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
        },
        bankInfo: true,
        orders: {
          orderBy: { orderDate: 'desc' },
          take: 20,
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!customer) return null;

    // Calcola statistiche acquisti
    const stats = await this.calculateCustomerStats(id);

    return {
      ...customer,
      stats,
    };
  }

  /**
   * Crea nuovo cliente
   */
  async createCustomer(data: CreateCustomerInput) {
    // Genera codice cliente univoco
    const code = await this.generateCustomerCode(data.type);

    return await prisma.customer.create({
      data: {
        ...data,
        code,
        isActive: true,
      },
      include: {
        priceList: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Aggiorna cliente
   */
  async updateCustomer(id: string, data: UpdateCustomerInput) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new Error('Customer not found');
    }

    return await prisma.customer.update({
      where: { id },
      data,
      include: {
        priceList: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        contacts: {
          where: { isActive: true },
        },
        bankInfo: true,
      },
    });
  }

  /**
   * Elimina cliente (soft delete)
   */
  async deleteCustomer(id: string) {
    return await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Gestione contatti cliente (B2B)
   */
  async addContact(data: CreateContactInput) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Se isPrimary, rimuovi primary dagli altri
    if (data.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId: data.customerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return await prisma.customerContact.create({
      data,
    });
  }

  async updateContact(contactId: string, data: UpdateContactInput) {
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new Error('Contact not found');
    }

    // Se isPrimary, rimuovi primary dagli altri
    if (data.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId: contact.customerId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    return await prisma.customerContact.update({
      where: { id: contactId },
      data,
    });
  }

  async deleteContact(contactId: string) {
    return await prisma.customerContact.update({
      where: { id: contactId },
      data: { isActive: false },
    });
  }

  async getContacts(customerId: string) {
    return await prisma.customerContact.findMany({
      where: { customerId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
    });
  }

  /**
   * Gestione info bancarie cliente (B2B)
   */
  async setBankInfo(data: CreateBankInfoInput) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) {
      throw new Error('Customer not found');
    }

    return await prisma.customerBankInfo.upsert({
      where: { customerId: data.customerId },
      update: data,
      create: data,
    });
  }

  async updateBankInfo(customerId: string, data: UpdateBankInfoInput) {
    return await prisma.customerBankInfo.update({
      where: { customerId },
      data,
    });
  }

  async deleteBankInfo(customerId: string) {
    return await prisma.customerBankInfo.delete({
      where: { customerId },
    });
  }

  /**
   * Import cliente da WordPress/WooCommerce
   */
  async importFromWordPress(data: WpCustomerImportInput) {
    // Cerca se esiste già per wordpressId
    const existing = await prisma.customer.findUnique({
      where: { wordpressId: data.wordpressId },
    });

    if (existing) {
      // Aggiorna cliente esistente
      return await prisma.customer.update({
        where: { id: existing.id },
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          billingAddress: data.billingAddress,
          shippingAddress: data.shippingAddress,
          wcUsername: data.username,
          wcAvatarUrl: data.avatarUrl,
          wcRole: data.role,
          wcIsPayingCustomer: data.isPayingCustomer ?? false,
          wcOrdersCount: data.ordersCount ?? 0,
          wcTotalSpent: data.totalSpent ?? 0,
          wcDateCreated: data.dateCreated ? new Date(data.dateCreated) : undefined,
          wcDateModified: data.dateModified ? new Date(data.dateModified) : undefined,
          wcMetaData: data.metaData,
          syncStatus: 'SYNCED',
          lastSyncAt: new Date(),
        },
      });
    }

    // Crea nuovo cliente B2C
    const code = await this.generateCustomerCode('B2C');

    return await prisma.customer.create({
      data: {
        type: 'B2C',
        code,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
        wordpressId: data.wordpressId,
        wcUsername: data.username,
        wcAvatarUrl: data.avatarUrl,
        wcRole: data.role,
        wcIsPayingCustomer: data.isPayingCustomer ?? false,
        wcOrdersCount: data.ordersCount ?? 0,
        wcTotalSpent: data.totalSpent ?? 0,
        wcDateCreated: data.dateCreated ? new Date(data.dateCreated) : undefined,
        wcDateModified: data.dateModified ? new Date(data.dateModified) : undefined,
        wcMetaData: data.metaData,
        syncStatus: 'SYNCED',
        lastSyncAt: new Date(),
        isActive: true,
      },
    });
  }

  /**
   * Calcola statistiche cliente (RFM Analysis)
   */
  async calculateCustomerStats(customerId: string) {
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: { not: 'CANCELLED' },
      },
      select: {
        total: true,
        orderDate: true,
      },
      orderBy: {
        orderDate: 'desc',
      },
    });

    if (orders.length === 0) {
      return {
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
        daysSinceLastOrder: null,
        rfmScore: null,
      };
    }

    const totalSpent = orders.reduce((sum: number, order: any) => sum + Number(order.total), 0);
    const lastOrderDate = orders[0].orderDate;
    const daysSinceLastOrder = Math.floor(
      (new Date().getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // RFM Scores (1-5)
    const recency = this.calculateRecencyScore(daysSinceLastOrder);
    const frequency = this.calculateFrequencyScore(orders.length);
    const monetary = this.calculateMonetaryScore(totalSpent);

    return {
      totalOrders: orders.length,
      totalSpent,
      averageOrderValue: totalSpent / orders.length,
      lastOrderDate,
      daysSinceLastOrder,
      rfmScore: {
        recency,
        frequency,
        monetary,
        total: recency + frequency + monetary,
        segment: this.getCustomerSegment(recency, frequency, monetary),
      },
    };
  }

  /**
   * Segmentazione clienti RFM
   */
  async segmentCustomers() {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            total: true,
            orderDate: true,
          },
        },
      },
    });

    const segments: Record<string, any[]> = {
      champions: [],
      loyal: [],
      potential: [],
      atRisk: [],
      hibernating: [],
      lost: [],
    };

    for (const customer of customers) {
      const stats = await this.calculateCustomerStats(customer.id);
      if (!stats.rfmScore) continue;

      const segment = stats.rfmScore.segment;
      segments[segment].push({
        id: customer.id,
        code: customer.code,
        name: customer.businessName || `${customer.firstName} ${customer.lastName}`,
        type: customer.type,
        ...stats,
      });
    }

    return segments;
  }

  /**
   * Clienti inattivi (nessun ordine da N giorni)
   */
  async getInactiveCustomers(inactiveDays = 180) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    return await prisma.customer.findMany({
      where: {
        isActive: true,
        lastOrderDate: { lt: cutoffDate },
      },
      include: {
        priceList: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
      orderBy: {
        lastOrderDate: 'desc',
      },
    });
  }

  /**
   * Top clienti per spesa
   */
  async getTopCustomers(limit = 10, type?: 'B2C' | 'B2B') {
    return await prisma.customer.findMany({
      where: {
        isActive: true,
        ...(type && { type }),
        totalSpent: { gt: 0 },
      },
      include: {
        priceList: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        totalSpent: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Aggiorna statistiche cliente dopo ordine
   */
  async updateCustomerStats(customerId: string) {
    const stats = await prisma.order.aggregate({
      where: {
        customerId,
        status: { not: 'CANCELLED' },
      },
      _count: true,
      _sum: {
        total: true,
      },
      _max: {
        orderDate: true,
      },
    });

    return await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalOrders: stats._count,
        totalSpent: stats._sum.total ?? 0,
        lastOrderDate: stats._max.orderDate,
      },
    });
  }

  /**
   * Helper: calcola Recency score (1-5, 5=migliore)
   */
  private calculateRecencyScore(daysSince: number): number {
    if (daysSince <= 30) return 5;
    if (daysSince <= 90) return 4;
    if (daysSince <= 180) return 3;
    if (daysSince <= 365) return 2;
    return 1;
  }

  /**
   * Helper: calcola Frequency score (1-5, 5=migliore)
   */
  private calculateFrequencyScore(ordersCount: number): number {
    if (ordersCount >= 20) return 5;
    if (ordersCount >= 10) return 4;
    if (ordersCount >= 5) return 3;
    if (ordersCount >= 2) return 2;
    return 1;
  }

  /**
   * Helper: calcola Monetary score (1-5, 5=migliore)
   */
  private calculateMonetaryScore(totalSpent: number): number {
    if (totalSpent >= 10000) return 5;
    if (totalSpent >= 5000) return 4;
    if (totalSpent >= 1000) return 3;
    if (totalSpent >= 500) return 2;
    return 1;
  }

  /**
   * Helper: determina segmento cliente
   */
  private getCustomerSegment(r: number, f: number, m: number): string {
    const total = r + f + m;

    if (r >= 4 && f >= 4 && m >= 4) return 'champions';
    if (r >= 3 && f >= 3 && m >= 3) return 'loyal';
    if (r >= 3 && f <= 2) return 'potential';
    if (r <= 2 && f >= 3) return 'atRisk';
    if (r <= 2 && f <= 2 && total >= 5) return 'hibernating';
    return 'lost';
  }

  /**
   * Helper: genera codice cliente progressivo
   */
  private async generateCustomerCode(type: 'B2C' | 'B2B'): Promise<string> {
    const prefix = type === 'B2B' ? 'B2B' : 'CLI';
    const year = new Date().getFullYear().toString().slice(-2);

    const lastCustomer = await prisma.customer.findFirst({
      where: {
        code: {
          startsWith: `${prefix}${year}`,
        },
      },
      orderBy: {
        code: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastCustomer) {
      const match = lastCustomer.code.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${year}${nextNumber.toString().padStart(5, '0')}`;
  }

  // =====================
  // ANALYTICS DETTAGLIATO
  // =====================

  /**
   * Prodotti più acquistati dal cliente
   */
  async getCustomerTopProducts(customerId: string, limit = 10) {
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          customerId,
          status: { notIn: ['CANCELLED'] },
        },
      },
      select: {
        productId: true,
        productName: true,
        sku: true,
        quantity: true,
        total: true,
      },
    });

    // Aggrega per prodotto
    const productMap = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      totalQuantity: number;
      totalSpent: number;
      orderCount: number;
    }>();

    for (const item of orderItems) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalSpent += Number(item.total);
        existing.orderCount += 1;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          totalQuantity: item.quantity,
          totalSpent: Number(item.total),
          orderCount: 1,
        });
      }
    }

    // Ordina per quantità totale e limita
    return Array.from(productMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  /**
   * Analytics dettagliato per singolo cliente
   */
  async getCustomerDetailedAnalytics(customerId: string) {
    // Recupera tutti gli ordini del cliente
    const orders = await prisma.order.findMany({
      where: {
        customerId,
        status: { notIn: ['CANCELLED'] },
      },
      select: {
        id: true,
        total: true,
        subtotal: true,
        discount: true,
        shipping: true,
        orderDate: true,
        status: true,
        source: true,
        items: {
          select: {
            quantity: true,
            total: true,
          },
        },
      },
      orderBy: {
        orderDate: 'asc',
      },
    });

    if (orders.length === 0) {
      return {
        purchaseMetrics: {
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          averageItemsPerOrder: 0,
          totalItemsPurchased: 0,
        },
        frequency: {
          ordersPerMonth: 0,
          averageDaysBetweenOrders: null,
          firstOrderDate: null,
          lastOrderDate: null,
          customerLifetimeDays: 0,
        },
        trends: {
          monthlySpending: [],
          ordersByStatus: {},
          ordersBySource: {},
        },
        topProducts: [],
        rfmScore: null,
      };
    }

    // Calcola metriche di acquisto
    const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalItems = orders.reduce((sum, o) =>
      sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
    const avgOrderValue = totalSpent / orders.length;
    const avgItemsPerOrder = totalItems / orders.length;

    // Calcola frequenza
    const firstOrder = orders[0].orderDate;
    const lastOrder = orders[orders.length - 1].orderDate;
    const lifetimeDays = Math.max(1, Math.ceil(
      (lastOrder.getTime() - firstOrder.getTime()) / (1000 * 60 * 60 * 24)
    ));
    const lifetimeMonths = Math.max(1, lifetimeDays / 30);
    const ordersPerMonth = orders.length / lifetimeMonths;

    // Calcola giorni medi tra ordini
    let avgDaysBetweenOrders: number | null = null;
    if (orders.length > 1) {
      let totalDays = 0;
      for (let i = 1; i < orders.length; i++) {
        const daysDiff = Math.ceil(
          (orders[i].orderDate.getTime() - orders[i - 1].orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += daysDiff;
      }
      avgDaysBetweenOrders = Math.round(totalDays / (orders.length - 1));
    }

    // Calcola spesa mensile (ultimi 12 mesi)
    const monthlySpending: { month: string; spent: number; orders: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthOrders = orders.filter(o =>
        o.orderDate >= monthStart && o.orderDate <= monthEnd
      );
      monthlySpending.push({
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM
        spent: monthOrders.reduce((sum, o) => sum + Number(o.total), 0),
        orders: monthOrders.length,
      });
    }

    // Ordini per status e source
    const ordersByStatus: Record<string, number> = {};
    const ordersBySource: Record<string, number> = {};
    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      ordersBySource[order.source] = (ordersBySource[order.source] || 0) + 1;
    }

    // Top products
    const topProducts = await this.getCustomerTopProducts(customerId, 5);

    // RFM Score
    const stats = await this.calculateCustomerStats(customerId);

    return {
      purchaseMetrics: {
        totalOrders: orders.length,
        totalSpent,
        averageOrderValue: Math.round(avgOrderValue * 100) / 100,
        averageItemsPerOrder: Math.round(avgItemsPerOrder * 100) / 100,
        totalItemsPurchased: totalItems,
      },
      frequency: {
        ordersPerMonth: Math.round(ordersPerMonth * 100) / 100,
        averageDaysBetweenOrders: avgDaysBetweenOrders,
        firstOrderDate: firstOrder,
        lastOrderDate: lastOrder,
        customerLifetimeDays: lifetimeDays,
      },
      trends: {
        monthlySpending,
        ordersByStatus,
        ordersBySource,
      },
      topProducts,
      rfmScore: stats.rfmScore,
    };
  }

  /**
   * Analytics globale su tutti i clienti
   */
  async getGlobalCustomerAnalytics() {
    // Conteggi base
    const [
      totalCustomers,
      activeCustomers,
      b2bCustomers,
      b2cCustomers,
      customersWithOrders,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { type: 'B2B' } }),
      prisma.customer.count({ where: { type: 'B2C' } }),
      prisma.customer.count({ where: { totalOrders: { gt: 0 } } }),
    ]);

    // Statistiche aggregate
    const aggregates = await prisma.customer.aggregate({
      _sum: {
        totalSpent: true,
        totalOrders: true,
      },
      _avg: {
        totalSpent: true,
        totalOrders: true,
      },
      where: {
        isActive: true,
        totalOrders: { gt: 0 },
      },
    });

    // Top 10 clienti per spesa
    const topBySpending = await prisma.customer.findMany({
      where: { isActive: true, totalSpent: { gt: 0 } },
      select: {
        id: true,
        code: true,
        type: true,
        businessName: true,
        firstName: true,
        lastName: true,
        totalSpent: true,
        totalOrders: true,
        lastOrderDate: true,
      },
      orderBy: { totalSpent: 'desc' },
      take: 10,
    });

    // Top 10 clienti per numero ordini
    const topByOrders = await prisma.customer.findMany({
      where: { isActive: true, totalOrders: { gt: 0 } },
      select: {
        id: true,
        code: true,
        type: true,
        businessName: true,
        firstName: true,
        lastName: true,
        totalSpent: true,
        totalOrders: true,
        lastOrderDate: true,
      },
      orderBy: { totalOrders: 'desc' },
      take: 10,
    });

    // Nuovi clienti ultimi 30/90/365 giorni
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [newLast30, newLast90, newLastYear] = await Promise.all([
      prisma.customer.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.customer.count({ where: { createdAt: { gte: ninetyDaysAgo } } }),
      prisma.customer.count({ where: { createdAt: { gte: yearAgo } } }),
    ]);

    // Clienti inattivi (nessun ordine > 180 giorni)
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const inactiveCustomers = await prisma.customer.count({
      where: {
        isActive: true,
        totalOrders: { gt: 0 },
        lastOrderDate: { lt: sixMonthsAgo },
      },
    });

    // Distribuzione per gruppo
    const groupDistribution = await prisma.customer.groupBy({
      by: ['customerGroup'],
      _count: true,
      where: { isActive: true },
    });

    // Crescita mensile clienti (ultimi 12 mesi) - query batch invece di 12 query separate
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyCustomers = await prisma.customer.findMany({
      where: {
        createdAt: { gte: twelveMonthsAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Aggrega per mese in memoria
    const monthCounts: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthCounts[monthStart.toISOString().slice(0, 7)] = 0;
    }
    monthlyCustomers.forEach(c => {
      const month = c.createdAt.toISOString().slice(0, 7);
      if (monthCounts[month] !== undefined) {
        monthCounts[month]++;
      }
    });

    const customerGrowth: { month: string; newCustomers: number; cumulativeTotal: number }[] = [];
    let cumulative = 0;
    Object.entries(monthCounts).sort().forEach(([month, count]) => {
      cumulative += count;
      customerGrowth.push({
        month,
        newCustomers: count,
        cumulativeTotal: cumulative,
      });
    });

    // Segmentazione RFM semplificata (senza query per ogni cliente)
    // Conta solo clienti con ordini e li segmenta in base ai dati già presenti
    const customersWithStats = await prisma.customer.findMany({
      where: {
        isActive: true,
        totalOrders: { gt: 0 },
      },
      select: {
        lastOrderDate: true,
        totalOrders: true,
        totalSpent: true,
      },
    });

    // Calcola segmenti in memoria
    const segmentCounts: Record<string, { count: number; totalSpent: number }> = {
      champions: { count: 0, totalSpent: 0 },
      loyal: { count: 0, totalSpent: 0 },
      potential: { count: 0, totalSpent: 0 },
      atRisk: { count: 0, totalSpent: 0 },
      hibernating: { count: 0, totalSpent: 0 },
      lost: { count: 0, totalSpent: 0 },
    };

    customersWithStats.forEach(c => {
      const daysSince = c.lastOrderDate
        ? Math.floor((now.getTime() - c.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      const orders = c.totalOrders;
      const spent = Number(c.totalSpent);

      // Recency score
      let r = 1;
      if (daysSince <= 30) r = 5;
      else if (daysSince <= 90) r = 4;
      else if (daysSince <= 180) r = 3;
      else if (daysSince <= 365) r = 2;

      // Frequency score
      let f = 1;
      if (orders >= 20) f = 5;
      else if (orders >= 10) f = 4;
      else if (orders >= 5) f = 3;
      else if (orders >= 2) f = 2;

      // Monetary score
      let m = 1;
      if (spent >= 10000) m = 5;
      else if (spent >= 5000) m = 4;
      else if (spent >= 1000) m = 3;
      else if (spent >= 500) m = 2;

      // Determine segment
      let segment = 'lost';
      const total = r + f + m;
      if (r >= 4 && f >= 4 && m >= 4) segment = 'champions';
      else if (r >= 3 && f >= 3 && m >= 3) segment = 'loyal';
      else if (r >= 3 && f <= 2) segment = 'potential';
      else if (r <= 2 && f >= 3) segment = 'atRisk';
      else if (r <= 2 && f <= 2 && total >= 5) segment = 'hibernating';

      segmentCounts[segment].count++;
      segmentCounts[segment].totalSpent += spent;
    });

    const segmentSummary = Object.entries(segmentCounts).map(([segment, data]) => ({
      segment,
      count: data.count,
      totalSpent: data.totalSpent,
    }));

    return {
      overview: {
        totalCustomers,
        activeCustomers,
        b2bCustomers,
        b2cCustomers,
        customersWithOrders,
        conversionRate: totalCustomers > 0
          ? Math.round((customersWithOrders / totalCustomers) * 100 * 100) / 100
          : 0,
        inactiveCustomers,
      },
      financials: {
        totalRevenue: Number(aggregates._sum.totalSpent) || 0,
        totalOrders: aggregates._sum.totalOrders || 0,
        averageCustomerValue: Number(aggregates._avg.totalSpent) || 0,
        averageOrdersPerCustomer: aggregates._avg.totalOrders || 0,
      },
      acquisition: {
        newLast30Days: newLast30,
        newLast90Days: newLast90,
        newLastYear: newLastYear,
      },
      topCustomers: {
        bySpending: topBySpending.map(c => ({
          ...c,
          totalSpent: Number(c.totalSpent),
          displayName: c.businessName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        })),
        byOrders: topByOrders.map(c => ({
          ...c,
          totalSpent: Number(c.totalSpent),
          displayName: c.businessName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        })),
      },
      distribution: {
        byGroup: groupDistribution.map(g => ({
          group: g.customerGroup || 'Non assegnato',
          count: g._count,
        })),
      },
      growth: customerGrowth,
      segmentation: segmentSummary,
    };
  }

  /**
   * Storico ordini completo di un cliente
   */
  async getCustomerOrderHistory(customerId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = params;

    const where: any = {
      customerId,
      ...(status && { status }),
      ...(dateFrom && { orderDate: { gte: new Date(dateFrom) } }),
      ...(dateTo && { orderDate: { lte: new Date(dateTo) } }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((o: any) => ({
        ...o,
        total: Number(o.total),
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        shipping: Number(o.shipping),
        tax: Number(o.tax),
        items: o.items?.map((i: any) => ({
          ...i,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
          subtotal: Number(i.subtotal),
          tax: Number(i.tax),
        })) || [],
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const customerService = new CustomerService();
export default customerService;
