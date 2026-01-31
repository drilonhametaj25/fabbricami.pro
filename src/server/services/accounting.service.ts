import { prisma } from '../config/database';
import {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreatePaymentInput,
  CreateOverheadCostInput,
} from '../schemas/accounting.schema';
import { PaymentDueStatus, PaymentDueType, B2BPaymentMethod, Prisma } from '@prisma/client';

// Input types for new methods
interface CreatePaymentPlanInput {
  code: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  installments: Array<{
    sequence: number;
    percentage: number;
    daysFromInvoice: number;
  }>;
}

interface CreatePaymentDueInput {
  type: PaymentDueType;
  invoiceId?: string;
  supplierInvoiceId?: string;
  orderId?: string;
  customerId?: string;
  supplierId?: string;
  description: string;
  amount: number;
  dueDate: Date;
  paymentMethod?: B2BPaymentMethod;
  bankReference?: string;
  ribaReference?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  notes?: string;
}

interface UpdatePaymentDueInput {
  description?: string;
  amount?: number;
  dueDate?: Date;
  status?: PaymentDueStatus;
  paymentMethod?: B2BPaymentMethod;
  bankReference?: string;
  ribaReference?: string;
  notes?: string;
}

interface RecordPaymentDuePaymentInput {
  paymentDueId: string;
  amount: number;
  paymentDate: Date;
  method: B2BPaymentMethod;
  reference?: string;
  notes?: string;
}

interface PaymentDueQuery {
  page?: number;
  limit?: number;
  type?: PaymentDueType;
  status?: PaymentDueStatus;
  customerId?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdue?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Accounting Service
 * Business logic per contabilità, scadenzario, ripartizione costi
 */
class AccountingService {
  /**
   * Lista fatture
   */
  async listInvoices(params: {
    page?: number;
    limit?: number;
    type?: 'SALE' | 'PURCHASE';
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 50,
      type,
      status,
      customerId,
      dateFrom,
      dateTo,
      sortBy = 'issueDate',
      sortOrder = 'desc',
    } = params;

    const where: any = {
      ...(type && { type }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(dateFrom || dateTo
        ? {
            issueDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              businessName: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.invoice.count({ where }),
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
   * Dettaglio fattura
   */
  async getInvoiceById(id: string) {
    return await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  /**
   * Crea fattura da ordine
   */
  async createInvoiceFromOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'DELIVERED' && order.status !== 'READY') {
      throw new Error(`Cannot invoice order in status ${order.status}`);
    }

    const invoiceNumber = await this.generateInvoiceNumber('SALE');

    return await prisma.invoice.create({
      data: {
        invoiceNumber,
        type: 'SALE',
        customerId: order.customerId,
        orderId: order.id,
        issueDate: new Date(),
        dueDate: this.calculateDueDate(new Date(), order.customer.paymentTerms || 30),
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        status: 'ISSUED',
      },
      include: {
        customer: true,
        order: true,
      },
    });
  }

  /**
   * Crea fattura manuale
   */
  async createInvoice(data: CreateInvoiceInput) {
    const invoiceNumber = await this.generateInvoiceNumber(data.type);
    const dueDate = data.dueDate || this.calculateDueDate(new Date(data.issueDate), 30);

    return await prisma.invoice.create({
      data: {
        ...data,
        invoiceNumber,
        dueDate,
        status: 'ISSUED',
      },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Aggiorna fattura
   */
  async updateInvoice(id: string, data: UpdateInvoiceInput) {
    return await prisma.invoice.update({
      where: { id },
      data,
      include: {
        customer: true,
        payments: true,
      },
    });
  }

  /**
   * Registra pagamento fattura
   */
  async recordPayment(data: CreatePaymentInput) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: data.invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return await prisma.$transaction(async (tx: any) => {
      // 1. Crea pagamento
      const payment = await tx.payment.create({
        data: {
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          transactionId: data.transactionId,
          notes: data.notes,
          paidAt: new Date(data.paidAt || new Date()),
        },
      });

      // 2. Calcola totale pagato
      const payments = await tx.payment.findMany({
        where: { invoiceId: data.invoiceId },
      });

      const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const remaining = Number(invoice.total) - totalPaid;

      // 3. Aggiorna stato fattura
      let status = invoice.status;
      if (remaining <= 0) {
        status = 'PAID';
      } else if (totalPaid > 0) {
        status = 'PARTIALLY_PAID';
      }

      await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          status,
          paidAmount: totalPaid,
        },
      });

      return payment;
    });
  }

  /**
   * Scadenzario attivo (crediti)
   */
  async getReceivables(params: { overdue?: boolean; daysRange?: number }) {
    const { overdue, daysRange } = params;
    const today = new Date();

    const where: any = {
      type: 'SALE',
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
    };

    if (overdue) {
      where.dueDate = { lt: today };
      where.status = { not: 'PAID' };
    } else if (daysRange) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + daysRange);
      where.dueDate = {
        gte: today,
        lte: futureDate,
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        payments: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return invoices.map((inv: any) => {
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const remaining = Number(inv.total) - totalPaid;
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        ...inv,
        remainingAmount: remaining,
        daysOverdue,
      };
    });
  }

  /**
   * Scadenzario passivo (debiti)
   */
  async getPayables(params: { overdue?: boolean; daysRange?: number }) {
    const { overdue, daysRange } = params;
    const today = new Date();

    const where: any = {
      type: 'PURCHASE',
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
    };

    if (overdue) {
      where.dueDate = { lt: today };
      where.status = { not: 'PAID' };
    } else if (daysRange) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + daysRange);
      where.dueDate = {
        gte: today,
        lte: futureDate,
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: true, // Supplier in this case
        payments: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return invoices.map((inv: any) => {
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const remaining = Number(inv.total) - totalPaid;
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        ...inv,
        remainingAmount: remaining,
        daysOverdue,
      };
    });
  }

  /**
   * Costi generali (overhead)
   */
  async getOverheadCosts(year: number, month?: number) {
    const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const endDate = month ? new Date(year, month, 0) : new Date(year, 11, 31);

    return await prisma.overheadCost.findMany({
      where: {
        startDate: { gte: startDate },
        endDate: { lte: endDate },
      },
      orderBy: {
        startDate: 'asc',
      },
    });
  }

  /**
   * Aggiungi costo generale
   */
  async createOverheadCost(data: CreateOverheadCostInput) {
    return await prisma.overheadCost.create({
      data: {
        category: data.category as any,
        description: data.name,
        amount: data.amount,
        startDate: new Date(data.periodStart),
        endDate: new Date(data.periodEnd),
        isRecurring: data.frequency !== 'ONE_TIME',
        frequency: data.frequency === 'ONE_TIME' ? null : data.frequency.toLowerCase(),
        allocationMethod: data.allocationMethod.toLowerCase(),
      },
    });
  }

  /**
   * Ripartizione costi generali su prodotti
   */
  async allocateOverheadCosts(
    year: number,
    month: number,
    method: 'LABOR_HOURS' | 'PRODUCTION_VOLUME' | 'EQUAL'
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // 1. Ottieni costi generali del periodo
    const overheadCosts = await this.getOverheadCosts(year, month);
    const totalOverhead = overheadCosts.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0);

    if (totalOverhead === 0) {
      return { totalOverhead: 0, allocations: [] };
    }

    // 2. Ottieni prodotti prodotti nel periodo (proxy: ordini)
    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                operations: true,
              },
            },
          },
        },
      },
    });

    // 3. Calcola base di ripartizione
    let totalBase = 0;
    const productData: any = {};

    for (const order of orders) {
      for (const item of order.items) {
        const productId = item.productId;

        if (!productData[productId]) {
          productData[productId] = {
            product: item.product,
            quantity: 0,
            laborHours: 0,
          };
        }

        productData[productId].quantity += item.quantity;

        // Calcola ore lavoro per prodotto
        if (item.product.operations) {
          const itemHours = item.product.operations.reduce((sum: number, op: any) => {
            return sum + ((op.setupTime || 0) + op.standardTime) / 60;
          }, 0);
          productData[productId].laborHours += itemHours * item.quantity;
        }
      }
    }

    // Calcola base totale in base al metodo
    if (method === 'LABOR_HOURS') {
      totalBase = Object.values(productData).reduce((sum: number, pd: any) => sum + pd.laborHours, 0);
    } else if (method === 'PRODUCTION_VOLUME') {
      totalBase = Object.values(productData).reduce((sum: number, pd: any) => sum + pd.quantity, 0);
    } else {
      totalBase = Object.keys(productData).length;
    }

    if (totalBase === 0) {
      return { totalOverhead, allocations: [] };
    }

    // 4. Ripartisci costi
    const allocations = Object.entries(productData).map(([productId, data]: any) => {
      let base = 1;
      if (method === 'LABOR_HOURS') {
        base = data.laborHours;
      } else if (method === 'PRODUCTION_VOLUME') {
        base = data.quantity;
      }

      const allocatedCost = (base / totalBase) * totalOverhead;
      const costPerUnit = data.quantity > 0 ? allocatedCost / data.quantity : 0;

      return {
        productId,
        productSku: data.product.sku,
        productName: data.product.name,
        quantity: data.quantity,
        laborHours: data.laborHours,
        allocatedOverhead: allocatedCost,
        overheadPerUnit: costPerUnit,
      };
    });

    return {
      period: { year, month },
      method,
      totalOverhead,
      allocations,
    };
  }

  /**
   * Analisi Break-Even per prodotto
   */
  async calculateBreakEven(productId: string, fixedCosts: number, period: 'month' | 'year' = 'month') {
    const product: any = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        bomItems: {
          where: { parentProductId: productId },
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

    // Costo variabile unitario
    const materialCost = product.bomItems.reduce((sum: number, item: any) => {
      return sum + Number(item.componentProduct.cost) * Number(item.quantity);
    }, 0);

    const laborCost = product.operations.reduce((sum: number, op: any) => {
      const hours = ((op.setupTime || 0) + op.standardTime) / 60;
      return sum + hours * Number(op.hourlyRate);
    }, 0);

    const variableCostPerUnit = materialCost + laborCost;
    const sellingPrice = Number(product.price);
    const contributionMargin = sellingPrice - variableCostPerUnit;

    if (contributionMargin <= 0) {
      throw new Error('Product has negative contribution margin');
    }

    const breakEvenUnits = Math.ceil(fixedCosts / contributionMargin);
    const breakEvenRevenue = breakEvenUnits * sellingPrice;

    return {
      productId,
      productSku: product.sku,
      productName: product.name,
      sellingPrice,
      variableCostPerUnit,
      contributionMargin,
      contributionMarginPercent: (contributionMargin / sellingPrice) * 100,
      fixedCosts,
      breakEvenUnits,
      breakEvenRevenue,
      period,
    };
  }

  // ============================================
  // PAYMENT PLANS (Piani di Pagamento)
  // ============================================

  /**
   * Lista piani di pagamento
   */
  async listPaymentPlans(activeOnly: boolean = true) {
    return await prisma.paymentPlan.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: {
        installments: {
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Dettaglio piano di pagamento
   */
  async getPaymentPlanById(id: string) {
    return await prisma.paymentPlan.findUnique({
      where: { id },
      include: {
        installments: {
          orderBy: { sequence: 'asc' },
        },
        customers: {
          select: { id: true, code: true, businessName: true },
        },
        suppliers: {
          select: { id: true, code: true, businessName: true },
        },
      },
    });
  }

  /**
   * Crea piano di pagamento
   */
  async createPaymentPlan(data: CreatePaymentPlanInput) {
    // Verifica che le percentuali sommino a 100
    const totalPercentage = data.installments.reduce((sum, i) => sum + i.percentage, 0);
    if (totalPercentage !== 100) {
      throw new Error(`Le percentuali devono sommare a 100, trovato: ${totalPercentage}`);
    }

    // Se è default, rimuovi default dagli altri
    if (data.isDefault) {
      await prisma.paymentPlan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return await prisma.paymentPlan.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        isDefault: data.isDefault || false,
        installments: {
          create: data.installments.map((i) => ({
            sequence: i.sequence,
            percentage: i.percentage,
            daysFromInvoice: i.daysFromInvoice,
          })),
        },
      },
      include: {
        installments: {
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  /**
   * Elimina piano di pagamento (soft delete)
   */
  async deletePaymentPlan(id: string) {
    // Verifica che non sia usato
    const usageCount = await prisma.customer.count({
      where: { paymentPlanId: id },
    });

    if (usageCount > 0) {
      throw new Error(`Piano usato da ${usageCount} clienti, impossibile eliminare`);
    }

    return await prisma.paymentPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================
  // PAYMENT DUES (Scadenze)
  // ============================================

  /**
   * Lista scadenze con filtri
   */
  async listPaymentDues(params: PaymentDueQuery) {
    const {
      page = 1,
      limit = 50,
      type,
      status,
      customerId,
      supplierId,
      dateFrom,
      dateTo,
      overdue,
      sortBy = 'dueDate',
      sortOrder = 'asc',
    } = params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: Prisma.PaymentDueWhereInput = {
      ...(type && { type }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(supplierId && { supplierId }),
      ...(dateFrom || dateTo
        ? {
            dueDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
      ...(overdue && {
        dueDate: { lt: today },
        status: { in: ['PENDING', 'PARTIAL'] },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.paymentDue.findMany({
        where,
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
          supplierInvoice: {
            select: { id: true, invoiceNumber: true },
          },
          order: {
            select: { id: true, orderNumber: true },
          },
          customer: {
            select: { id: true, code: true, businessName: true, firstName: true, lastName: true },
          },
          supplier: {
            select: { id: true, code: true, businessName: true },
          },
          payments: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.paymentDue.count({ where }),
    ]);

    // Calcola giorni scaduti e importo rimanente
    const enrichedItems = items.map((item) => {
      const daysOverdue = item.dueDate < today
        ? Math.floor((today.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const remainingAmount = Number(item.amount) - Number(item.paidAmount);

      return {
        ...item,
        daysOverdue,
        remainingAmount,
      };
    });

    return {
      items: enrichedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dettaglio scadenza
   */
  async getPaymentDueById(id: string) {
    const paymentDue = await prisma.paymentDue.findUnique({
      where: { id },
      include: {
        invoice: true,
        supplierInvoice: true,
        order: true,
        customer: true,
        supplier: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!paymentDue) {
      throw new Error('Scadenza non trovata');
    }

    const today = new Date();
    const daysOverdue = paymentDue.dueDate < today
      ? Math.floor((today.getTime() - paymentDue.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const remainingAmount = Number(paymentDue.amount) - Number(paymentDue.paidAmount);

    return {
      ...paymentDue,
      daysOverdue,
      remainingAmount,
    };
  }

  /**
   * Crea scadenza manuale
   */
  async createPaymentDue(data: CreatePaymentDueInput) {
    return await prisma.paymentDue.create({
      data: {
        type: data.type,
        invoiceId: data.invoiceId,
        supplierInvoiceId: data.supplierInvoiceId,
        orderId: data.orderId,
        customerId: data.customerId,
        supplierId: data.supplierId,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        paymentMethod: data.paymentMethod,
        bankReference: data.bankReference,
        ribaReference: data.ribaReference,
        installmentNumber: data.installmentNumber,
        totalInstallments: data.totalInstallments,
        notes: data.notes,
      },
      include: {
        customer: true,
        supplier: true,
      },
    });
  }

  /**
   * Aggiorna scadenza
   */
  async updatePaymentDue(id: string, data: UpdatePaymentDueInput) {
    return await prisma.paymentDue.update({
      where: { id },
      data,
      include: {
        customer: true,
        supplier: true,
        payments: true,
      },
    });
  }

  /**
   * Elimina scadenza
   */
  async deletePaymentDue(id: string) {
    // Verifica che non abbia pagamenti
    const paymentDue = await prisma.paymentDue.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!paymentDue) {
      throw new Error('Scadenza non trovata');
    }

    if (paymentDue.payments.length > 0) {
      throw new Error('Impossibile eliminare scadenza con pagamenti registrati');
    }

    return await prisma.paymentDue.delete({ where: { id } });
  }

  /**
   * Genera scadenze da fattura con piano di pagamento
   */
  async createPaymentDuesFromInvoice(invoiceId: string, paymentPlanId?: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new Error('Fattura non trovata');
    }

    // Determina piano di pagamento
    let planId = paymentPlanId;
    if (!planId && invoice.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: invoice.customerId },
      });
      planId = customer?.paymentPlanId ?? undefined;
    }

    // Se nessun piano, crea singola scadenza alla data prevista
    if (!planId) {
      return await prisma.paymentDue.create({
        data: {
          type: 'RECEIVABLE',
          invoiceId: invoice.id,
          customerId: invoice.customerId ?? undefined,
          description: `Fattura ${invoice.invoiceNumber}`,
          amount: invoice.total,
          dueDate: invoice.dueDate,
          installmentNumber: 1,
          totalInstallments: 1,
        },
        include: { customer: true },
      });
    }

    // Usa piano di pagamento
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: planId },
      include: { installments: { orderBy: { sequence: 'asc' } } },
    });

    if (!plan) {
      throw new Error('Piano di pagamento non trovato');
    }

    const totalInstallments = plan.installments.length;
    const paymentDues = [];

    for (const installment of plan.installments) {
      const dueDate = new Date(invoice.issueDate);
      dueDate.setDate(dueDate.getDate() + installment.daysFromInvoice);

      const amount = (Number(invoice.total) * Number(installment.percentage)) / 100;

      const paymentDue = await prisma.paymentDue.create({
        data: {
          type: 'RECEIVABLE',
          invoiceId: invoice.id,
          customerId: invoice.customerId ?? undefined,
          description: `Fattura ${invoice.invoiceNumber} - Rata ${installment.sequence}/${totalInstallments}`,
          amount,
          dueDate,
          installmentNumber: installment.sequence,
          totalInstallments,
        },
      });

      paymentDues.push(paymentDue);
    }

    return paymentDues;
  }

  /**
   * Registra pagamento su scadenza
   */
  async recordPaymentDuePayment(data: RecordPaymentDuePaymentInput) {
    const paymentDue = await prisma.paymentDue.findUnique({
      where: { id: data.paymentDueId },
    });

    if (!paymentDue) {
      throw new Error('Scadenza non trovata');
    }

    const remainingAmount = Number(paymentDue.amount) - Number(paymentDue.paidAmount);

    if (data.amount > remainingAmount) {
      throw new Error(`Importo eccede il residuo di €${remainingAmount.toFixed(2)}`);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Crea pagamento
      const payment = await tx.paymentDuePayment.create({
        data: {
          paymentDueId: data.paymentDueId,
          amount: data.amount,
          paymentDate: data.paymentDate,
          method: data.method,
          reference: data.reference,
          notes: data.notes,
        },
      });

      // 2. Calcola totale pagato
      const newPaidAmount = Number(paymentDue.paidAmount) + data.amount;
      const newRemainingAmount = Number(paymentDue.amount) - newPaidAmount;

      // 3. Aggiorna stato scadenza
      let newStatus: PaymentDueStatus = paymentDue.status;
      if (newRemainingAmount <= 0) {
        newStatus = 'PAID';
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIAL';
      }

      await tx.paymentDue.update({
        where: { id: data.paymentDueId },
        data: {
          paidAmount: newPaidAmount,
          paidDate: newStatus === 'PAID' ? new Date() : null,
          status: newStatus,
        },
      });

      return {
        payment,
        newPaidAmount,
        newRemainingAmount,
        newStatus,
      };
    });
  }

  // ============================================
  // FINANCIAL DASHBOARD
  // ============================================

  /**
   * Dashboard finanziaria
   */
  async getFinancialDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const sixtyDaysFromNow = new Date(today);
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    // Query parallele per performance
    const [
      receivablesTotal,
      receivablesOverdue,
      receivablesDue30,
      payablesTotal,
      payablesOverdue,
      payablesDue30,
      agingReceivables,
      agingPayables,
    ] = await Promise.all([
      // Totale crediti
      prisma.paymentDue.aggregate({
        where: { type: 'RECEIVABLE', status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // Crediti scaduti
      prisma.paymentDue.aggregate({
        where: { type: 'RECEIVABLE', status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: today } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // Crediti in scadenza nei prossimi 30 giorni
      prisma.paymentDue.aggregate({
        where: {
          type: 'RECEIVABLE',
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { gte: today, lte: thirtyDaysFromNow },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      // Totale debiti
      prisma.paymentDue.aggregate({
        where: { type: 'PAYABLE', status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // Debiti scaduti
      prisma.paymentDue.aggregate({
        where: { type: 'PAYABLE', status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: today } },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      }),
      // Debiti in scadenza nei prossimi 30 giorni
      prisma.paymentDue.aggregate({
        where: {
          type: 'PAYABLE',
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { gte: today, lte: thirtyDaysFromNow },
        },
        _sum: { amount: true, paidAmount: true },
      }),
      // Aging crediti
      this.calculateAgingBuckets('RECEIVABLE'),
      // Aging debiti
      this.calculateAgingBuckets('PAYABLE'),
    ]);

    const receivablesRemaining =
      (Number(receivablesTotal._sum.amount) || 0) - (Number(receivablesTotal._sum.paidAmount) || 0);
    const receivablesOverdueAmount =
      (Number(receivablesOverdue._sum.amount) || 0) - (Number(receivablesOverdue._sum.paidAmount) || 0);
    const receivablesDue30Amount =
      (Number(receivablesDue30._sum.amount) || 0) - (Number(receivablesDue30._sum.paidAmount) || 0);

    const payablesRemaining =
      (Number(payablesTotal._sum.amount) || 0) - (Number(payablesTotal._sum.paidAmount) || 0);
    const payablesOverdueAmount =
      (Number(payablesOverdue._sum.amount) || 0) - (Number(payablesOverdue._sum.paidAmount) || 0);
    const payablesDue30Amount =
      (Number(payablesDue30._sum.amount) || 0) - (Number(payablesDue30._sum.paidAmount) || 0);

    return {
      cashPosition: {
        current: receivablesRemaining - payablesRemaining,
        projected30Days: receivablesRemaining - payablesRemaining + receivablesDue30Amount - payablesDue30Amount,
      },
      receivables: {
        total: receivablesRemaining,
        overdue: receivablesOverdueAmount,
        overdueCount: receivablesOverdue._count,
        dueNext30Days: receivablesDue30Amount,
      },
      payables: {
        total: payablesRemaining,
        overdue: payablesOverdueAmount,
        overdueCount: payablesOverdue._count,
        dueNext30Days: payablesDue30Amount,
      },
      aging: {
        receivables: agingReceivables,
        payables: agingPayables,
      },
    };
  }

  /**
   * Calcola bucket aging
   */
  private async calculateAgingBuckets(type: PaymentDueType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = [
      { label: 'Corrente', minDays: null, maxDays: 0 },
      { label: '1-30 giorni', minDays: 1, maxDays: 30 },
      { label: '31-60 giorni', minDays: 31, maxDays: 60 },
      { label: '61-90 giorni', minDays: 61, maxDays: 90 },
      { label: 'Oltre 90 giorni', minDays: 91, maxDays: null },
    ];

    const results = [];

    for (const bucket of buckets) {
      let dueDateCondition: Prisma.PaymentDueWhereInput = {};

      if (bucket.minDays === null) {
        // Corrente: non ancora scaduto
        dueDateCondition = { dueDate: { gte: today } };
      } else if (bucket.maxDays === null) {
        // Oltre 90 giorni
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - bucket.minDays);
        dueDateCondition = { dueDate: { lt: minDate } };
      } else {
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - bucket.maxDays);
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() - bucket.minDays + 1);
        dueDateCondition = { dueDate: { gte: minDate, lt: maxDate } };
      }

      const aggregate = await prisma.paymentDue.aggregate({
        where: {
          type,
          status: { in: ['PENDING', 'PARTIAL'] },
          ...dueDateCondition,
        },
        _sum: { amount: true, paidAmount: true },
        _count: true,
      });

      const amount = (Number(aggregate._sum.amount) || 0) - (Number(aggregate._sum.paidAmount) || 0);

      results.push({
        label: bucket.label,
        amount,
        count: aggregate._count,
      });
    }

    const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);

    return results.map((r) => ({
      ...r,
      percentage: totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0,
    }));
  }

  /**
   * Report aging dettagliato
   */
  async getAgingReport(type: PaymentDueType) {
    const buckets = await this.calculateAgingBuckets(type);
    const today = new Date();

    const details = await prisma.paymentDue.findMany({
      where: {
        type,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
      include: {
        customer: { select: { id: true, code: true, businessName: true } },
        supplier: { select: { id: true, code: true, businessName: true } },
        invoice: { select: { invoiceNumber: true } },
        supplierInvoice: { select: { invoiceNumber: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const enrichedDetails = details.map((d) => {
      const daysOverdue = d.dueDate < today
        ? Math.floor((today.getTime() - d.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const remainingAmount = Number(d.amount) - Number(d.paidAmount);

      let bucket = 'Corrente';
      if (daysOverdue >= 91) bucket = 'Oltre 90 giorni';
      else if (daysOverdue >= 61) bucket = '61-90 giorni';
      else if (daysOverdue >= 31) bucket = '31-60 giorni';
      else if (daysOverdue >= 1) bucket = '1-30 giorni';

      return {
        id: d.id,
        entityName: type === 'RECEIVABLE'
          ? d.customer?.businessName || 'N/A'
          : d.supplier?.businessName || 'N/A',
        entityId: type === 'RECEIVABLE' ? d.customerId : d.supplierId,
        invoiceNumber: d.invoice?.invoiceNumber || d.supplierInvoice?.invoiceNumber || '-',
        description: d.description,
        amount: remainingAmount,
        dueDate: d.dueDate,
        daysOverdue,
        bucket,
      };
    });

    const totals = {
      total: enrichedDetails.reduce((sum, d) => sum + d.amount, 0),
      current: enrichedDetails.filter((d) => d.daysOverdue === 0).reduce((sum, d) => sum + d.amount, 0),
      overdue: enrichedDetails.filter((d) => d.daysOverdue > 0).reduce((sum, d) => sum + d.amount, 0),
    };

    return {
      buckets,
      details: enrichedDetails,
      totals,
    };
  }

  // ============================================
  // CASH FLOW FORECASTING
  // ============================================

  /**
   * Cash Flow Forecast con 3 scenari
   * @param months Numero di mesi da prevedere (default: 6)
   */
  async getCashFlowForecast(months: number = 6) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcola dati storici per i pattern
    const historicalData = await this.getHistoricalCashFlowData(6);

    // Ottieni scadenze future (attive)
    const [futureReceivables, futurePayables] = await Promise.all([
      prisma.paymentDue.findMany({
        where: {
          type: 'RECEIVABLE',
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.paymentDue.findMany({
        where: {
          type: 'PAYABLE',
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    // Calcola collection rate storico (percentuale di incassi sul previsto)
    const avgCollectionRate = await this.calculateAverageCollectionRate();

    // Genera forecast mensile per i prossimi N mesi
    const forecast: Array<{
      month: string;
      monthLabel: string;
      scenarios: {
        optimistic: { inflows: number; outflows: number; net: number; cumulative: number };
        realistic: { inflows: number; outflows: number; net: number; cumulative: number };
        pessimistic: { inflows: number; outflows: number; net: number; cumulative: number };
      };
      scheduledReceivables: number;
      scheduledPayables: number;
    }> = [];

    // Calcola saldo iniziale (current cash position)
    const initialBalance = await this.getCurrentCashPosition();
    let cumulativeOptimistic = initialBalance;
    let cumulativeRealistic = initialBalance;
    let cumulativePessimistic = initialBalance;

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
      const monthLabel = monthStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      // Scadenze programmate nel mese
      const scheduledReceivables = futureReceivables
        .filter((r) => r.dueDate >= monthStart && r.dueDate <= monthEnd)
        .reduce((sum, r) => sum + (Number(r.amount) - Number(r.paidAmount)), 0);

      const scheduledPayables = futurePayables
        .filter((p) => p.dueDate >= monthStart && p.dueDate <= monthEnd)
        .reduce((sum, p) => sum + (Number(p.amount) - Number(p.paidAmount)), 0);

      // Aggiungi stime per nuovi ordini basate su storico (solo per mesi futuri)
      const historicalAvgInflows = historicalData.avgMonthlyInflows;
      const historicalAvgOutflows = historicalData.avgMonthlyOutflows;

      // Scenario Ottimistico: 95% incassi, 85% pagamenti + 10% crescita
      const optimisticInflows = scheduledReceivables * 0.95 + historicalAvgInflows * 0.15 * 1.1;
      const optimisticOutflows = scheduledPayables * 0.85;

      // Scenario Realistico: basato su collection rate storico
      const realisticInflows = scheduledReceivables * avgCollectionRate + historicalAvgInflows * 0.1;
      const realisticOutflows = scheduledPayables * 0.95;

      // Scenario Pessimistico: 60% incassi, 100% pagamenti + buffer
      const pessimisticInflows = scheduledReceivables * 0.60;
      const pessimisticOutflows = scheduledPayables * 1.0 + historicalAvgOutflows * 0.05;

      cumulativeOptimistic += optimisticInflows - optimisticOutflows;
      cumulativeRealistic += realisticInflows - realisticOutflows;
      cumulativePessimistic += pessimisticInflows - pessimisticOutflows;

      forecast.push({
        month: monthKey,
        monthLabel,
        scenarios: {
          optimistic: {
            inflows: Math.round(optimisticInflows * 100) / 100,
            outflows: Math.round(optimisticOutflows * 100) / 100,
            net: Math.round((optimisticInflows - optimisticOutflows) * 100) / 100,
            cumulative: Math.round(cumulativeOptimistic * 100) / 100,
          },
          realistic: {
            inflows: Math.round(realisticInflows * 100) / 100,
            outflows: Math.round(realisticOutflows * 100) / 100,
            net: Math.round((realisticInflows - realisticOutflows) * 100) / 100,
            cumulative: Math.round(cumulativeRealistic * 100) / 100,
          },
          pessimistic: {
            inflows: Math.round(pessimisticInflows * 100) / 100,
            outflows: Math.round(pessimisticOutflows * 100) / 100,
            net: Math.round((pessimisticInflows - pessimisticOutflows) * 100) / 100,
            cumulative: Math.round(cumulativePessimistic * 100) / 100,
          },
        },
        scheduledReceivables: Math.round(scheduledReceivables * 100) / 100,
        scheduledPayables: Math.round(scheduledPayables * 100) / 100,
      });
    }

    // Identifica mesi critici (cash flow negativo nello scenario realistico)
    const criticalMonths = forecast.filter((m) => m.scenarios.realistic.cumulative < 0);

    // Calcola breakeven point
    const breakevenMonth = forecast.findIndex((m) => m.scenarios.realistic.cumulative >= 0 && forecast.indexOf(m) > 0);

    return {
      initialBalance: Math.round(initialBalance * 100) / 100,
      collectionRate: Math.round(avgCollectionRate * 100),
      forecast,
      summary: {
        totalScheduledReceivables: forecast.reduce((sum, m) => sum + m.scheduledReceivables, 0),
        totalScheduledPayables: forecast.reduce((sum, m) => sum + m.scheduledPayables, 0),
        criticalMonths: criticalMonths.map((m) => m.monthLabel),
        breakevenMonth: breakevenMonth >= 0 ? forecast[breakevenMonth].monthLabel : null,
        endBalanceOptimistic: forecast.length > 0 ? forecast[forecast.length - 1].scenarios.optimistic.cumulative : initialBalance,
        endBalanceRealistic: forecast.length > 0 ? forecast[forecast.length - 1].scenarios.realistic.cumulative : initialBalance,
        endBalancePessimistic: forecast.length > 0 ? forecast[forecast.length - 1].scenarios.pessimistic.cumulative : initialBalance,
      },
    };
  }

  /**
   * Dati storici cash flow
   */
  private async getHistoricalCashFlowData(months: number) {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - months, 1);

    const [historicalReceivables, historicalPayables] = await Promise.all([
      prisma.paymentDue.findMany({
        where: {
          type: 'RECEIVABLE',
          status: 'PAID',
          paidDate: { gte: startDate },
        },
      }),
      prisma.paymentDue.findMany({
        where: {
          type: 'PAYABLE',
          status: 'PAID',
          paidDate: { gte: startDate },
        },
      }),
    ]);

    const totalInflows = historicalReceivables.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalOutflows = historicalPayables.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      avgMonthlyInflows: months > 0 ? totalInflows / months : 0,
      avgMonthlyOutflows: months > 0 ? totalOutflows / months : 0,
      totalInflows,
      totalOutflows,
    };
  }

  /**
   * Calcola tasso medio di incasso
   */
  private async calculateAverageCollectionRate(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const receivables = await prisma.paymentDue.findMany({
      where: {
        type: 'RECEIVABLE',
        dueDate: { lt: new Date() },
        createdAt: { gte: ninetyDaysAgo },
      },
    });

    if (receivables.length === 0) {
      return 0.85; // Default 85% se non ci sono dati storici
    }

    const totalDue = receivables.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalPaid = receivables.reduce((sum, r) => sum + Number(r.paidAmount), 0);

    return totalDue > 0 ? totalPaid / totalDue : 0.85;
  }

  /**
   * Posizione di cassa corrente
   */
  private async getCurrentCashPosition(): Promise<number> {
    const [receivablesResult, payablesResult] = await Promise.all([
      prisma.paymentDue.aggregate({
        where: { type: 'RECEIVABLE', status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.paymentDue.aggregate({
        where: { type: 'PAYABLE', status: { in: ['PENDING', 'PARTIAL'] } },
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    const receivablesRemaining = (Number(receivablesResult._sum.amount) || 0) - (Number(receivablesResult._sum.paidAmount) || 0);
    const payablesRemaining = (Number(payablesResult._sum.amount) || 0) - (Number(payablesResult._sum.paidAmount) || 0);

    return receivablesRemaining - payablesRemaining;
  }

  // ============================================
  // FINANCIAL RECOMMENDATIONS
  // ============================================

  /**
   * Raccomandazioni finanziarie intelligenti
   */
  async getFinancialRecommendations() {
    const [dashboard, agingReceivables, agingPayables, cashFlow] = await Promise.all([
      this.getFinancialDashboard(),
      this.getAgingReport('RECEIVABLE'),
      this.getAgingReport('PAYABLE'),
      this.getCashFlowForecast(3),
    ]);

    const recommendations: Array<{
      type: 'WARNING' | 'ACTION' | 'OPPORTUNITY' | 'INFO';
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      category: string;
      title: string;
      description: string;
      impact: string;
      actionItems: string[];
      relatedEntities?: Array<{ id: string; name: string; amount: number }>;
    }> = [];

    // 1. Analisi crediti scaduti
    const overdueReceivables = agingReceivables.details.filter((d) => d.daysOverdue > 0);
    const criticalReceivables = overdueReceivables.filter((d) => d.daysOverdue > 60);

    if (criticalReceivables.length > 0) {
      const totalCritical = criticalReceivables.reduce((sum, d) => sum + d.amount, 0);
      recommendations.push({
        type: 'WARNING',
        priority: 'HIGH',
        category: 'Crediti',
        title: `${criticalReceivables.length} crediti scaduti da oltre 60 giorni`,
        description: `Ci sono €${totalCritical.toLocaleString('it-IT', { minimumFractionDigits: 2 })} di crediti critici che richiedono azione immediata.`,
        impact: 'Alto rischio di insolvenza e impatto sul cash flow',
        actionItems: [
          'Contattare immediatamente i clienti coinvolti',
          'Valutare invio solleciti formali',
          'Considerare accordi di rientro rateizzato',
          'Valutare eventuale passaggio a recupero crediti',
        ],
        relatedEntities: criticalReceivables.slice(0, 5).map((d) => ({
          id: d.entityId || '',
          name: d.entityName,
          amount: d.amount,
        })),
      });
    }

    // 2. Analisi cash flow
    if (cashFlow.summary.criticalMonths.length > 0) {
      recommendations.push({
        type: 'WARNING',
        priority: 'HIGH',
        category: 'Cash Flow',
        title: 'Previsione cash flow negativo',
        description: `Nei mesi ${cashFlow.summary.criticalMonths.join(', ')} è previsto un saldo negativo nello scenario realistico.`,
        impact: `Potenziale saldo negativo fino a €${Math.abs(cashFlow.summary.endBalancePessimistic).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        actionItems: [
          'Accelerare gli incassi dei crediti in scadenza',
          'Negoziare dilazioni con i fornitori principali',
          'Valutare linea di credito o anticipo fatture',
          'Rivedere piano acquisti non urgenti',
        ],
      });
    }

    // 3. Opportunità di sconto pagamento anticipato
    const upcomingPayables = agingPayables.details.filter((d) => d.daysOverdue <= 0);
    const earlyPaymentCandidates = upcomingPayables.filter((d) => {
      const daysUntilDue = Math.abs(d.daysOverdue);
      return daysUntilDue > 15 && d.amount > 1000;
    });

    if (earlyPaymentCandidates.length > 0 && dashboard.cashPosition.current > 0) {
      const totalEarlyPayment = earlyPaymentCandidates.reduce((sum, d) => sum + d.amount, 0);
      const potentialSavings = totalEarlyPayment * 0.02; // Stima sconto 2%

      recommendations.push({
        type: 'OPPORTUNITY',
        priority: 'MEDIUM',
        category: 'Fornitori',
        title: 'Opportunità sconto pagamento anticipato',
        description: `${earlyPaymentCandidates.length} fatture fornitori potrebbero beneficiare di sconto per pagamento anticipato.`,
        impact: `Potenziale risparmio di circa €${potentialSavings.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        actionItems: [
          'Contattare i fornitori per negoziare sconti',
          'Prioritizzare fornitori con importi maggiori',
          'Valutare impatto sul cash flow prima di procedere',
        ],
        relatedEntities: earlyPaymentCandidates.slice(0, 5).map((d) => ({
          id: d.entityId || '',
          name: d.entityName,
          amount: d.amount,
        })),
      });
    }

    // 4. Concentrazione rischio crediti
    const receivablesByCustomer = this.groupByEntity(agingReceivables.details);
    const topReceivables = Object.entries(receivablesByCustomer)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 3);

    const totalReceivables = agingReceivables.totals.total;
    const topConcentration = topReceivables.reduce((sum, [, data]) => sum + data.total, 0);
    const concentrationPercent = totalReceivables > 0 ? (topConcentration / totalReceivables) * 100 : 0;

    if (concentrationPercent > 50 && topReceivables.length > 0) {
      recommendations.push({
        type: 'INFO',
        priority: 'MEDIUM',
        category: 'Rischio',
        title: 'Alta concentrazione crediti',
        description: `Il ${concentrationPercent.toFixed(0)}% dei crediti è concentrato su ${topReceivables.length} clienti.`,
        impact: 'Rischio elevato in caso di insolvenza di un cliente principale',
        actionItems: [
          'Monitorare attentamente lo stato di questi clienti',
          'Valutare assicurazione crediti',
          'Diversificare il portafoglio clienti',
        ],
        relatedEntities: topReceivables.map(([name, data]) => ({
          id: data.entityId || '',
          name,
          amount: data.total,
        })),
      });
    }

    // 5. Collection rate basso
    if (cashFlow.collectionRate < 80) {
      recommendations.push({
        type: 'ACTION',
        priority: 'MEDIUM',
        category: 'Incassi',
        title: 'Tasso di incasso sotto la media',
        description: `Il tasso di incasso attuale è del ${cashFlow.collectionRate}%, sotto il target dell'80%.`,
        impact: 'Impatto negativo sul capitale circolante',
        actionItems: [
          'Rivedere le procedure di sollecito',
          'Implementare reminder automatici pre-scadenza',
          'Valutare condizioni di pagamento più stringenti per nuovi clienti',
          'Considerare sconti per pagamento anticipato',
        ],
      });
    }

    // 6. Debiti in scadenza con saldo insufficiente
    const payablesDue30 = dashboard.payables.dueNext30Days;
    const receivablesDue30 = dashboard.receivables.dueNext30Days;

    if (payablesDue30 > receivablesDue30 * 1.2) {
      const gap = payablesDue30 - receivablesDue30;
      recommendations.push({
        type: 'ACTION',
        priority: 'HIGH',
        category: 'Liquidità',
        title: 'Gap liquidità nei prossimi 30 giorni',
        description: `I debiti in scadenza (€${payablesDue30.toLocaleString('it-IT')}) superano del 20% i crediti attesi (€${receivablesDue30.toLocaleString('it-IT')}).`,
        impact: `Gap di liquidità di circa €${gap.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        actionItems: [
          'Anticipare solleciti per i crediti in scadenza',
          'Negoziare dilazioni con i fornitori',
          'Valutare utilizzo linee di credito',
        ],
      });
    }

    // Ordina per priorità
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
      generatedAt: new Date().toISOString(),
      recommendations,
      summary: {
        total: recommendations.length,
        byPriority: {
          high: recommendations.filter((r) => r.priority === 'HIGH').length,
          medium: recommendations.filter((r) => r.priority === 'MEDIUM').length,
          low: recommendations.filter((r) => r.priority === 'LOW').length,
        },
        byType: {
          warnings: recommendations.filter((r) => r.type === 'WARNING').length,
          actions: recommendations.filter((r) => r.type === 'ACTION').length,
          opportunities: recommendations.filter((r) => r.type === 'OPPORTUNITY').length,
          info: recommendations.filter((r) => r.type === 'INFO').length,
        },
      },
    };
  }

  /**
   * Helper: raggruppa per entità
   */
  private groupByEntity(details: Array<{ entityId: string | null; entityName: string; amount: number }>) {
    const grouped: Record<string, { entityId: string | null; total: number; count: number }> = {};

    for (const d of details) {
      const key = d.entityName;
      if (!grouped[key]) {
        grouped[key] = { entityId: d.entityId, total: 0, count: 0 };
      }
      grouped[key].total += d.amount;
      grouped[key].count++;
    }

    return grouped;
  }

  /**
   * Helper: calcola data scadenza
   */
  private calculateDueDate(issueDate: Date, paymentTermDays: number): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentTermDays);
    return dueDate;
  }

  /**
   * Helper: genera numero fattura
   */
  private async generateInvoiceNumber(type: 'SALE' | 'PURCHASE'): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === 'SALE' ? `FT${year}/` : `FA${year}/`;

    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
        type,
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  }
}

export const accountingService = new AccountingService();
export default accountingService;
