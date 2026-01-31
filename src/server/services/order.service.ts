import { prisma } from '../config/database';
import {
  CreateOrderInput,
  UpdateOrderInput,
  AddOrderItemInput,
  UpdateOrderStatusInput,
  CreateShipmentInput,
} from '../schemas/order.schema';
import { priceListService } from './pricelist.service';
import { inventoryService } from './inventory.service';
import { triggerPostShipmentCheck } from '../jobs/stock-alert.job';
import logger from '../config/logger';

// Import lazy per evitare dipendenze circolari
let manufacturingServiceInstance: any = null;
const getManufacturingService = async () => {
  if (!manufacturingServiceInstance) {
    const module = await import('./manufacturing.service');
    manufacturingServiceInstance = module.default;
  }
  return manufacturingServiceInstance;
};

/**
 * Order Service
 * Business logic per gestione ordini con workflow completo
 */
class OrderService {
  /**
   * Lista ordini con filtri e paginazione
   */
  async listOrders(params: {
    page?: number;
    limit?: number;
    status?: string[];
    customerId?: string;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 50,
      status,
      customerId,
      source,
      dateFrom,
      dateTo,
      sortBy = 'orderDate',
      sortOrder = 'desc',
    } = params;

    const where: any = {
      ...(status && status.length > 0 && { status: status.length === 1 ? status[0] : { in: status } }),
      ...(customerId && { customerId }),
      ...(source && { source }),
      ...(dateFrom || dateTo
        ? {
            orderDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.order.count({ where }),
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
   * Ottieni dettaglio ordine
   */
  async getOrderById(id: string) {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            variant: true, // Include variante per supporto inventario varianti
          },
        },
        invoice: true,
      },
    });
  }

  /**
   * Crea nuovo ordine (stato PENDING)
   */
  async createOrder(data: CreateOrderInput) {
    return await prisma.$transaction(async (tx: any) => {
      // 1. Crea ordine
      const order = await tx.order.create({
        data: {
          orderNumber: data.orderNumber || await this.generateOrderNumber(),
          customerId: data.customerId,
          source: data.source,
          status: data.status || 'PENDING',
          subtotal: 0,
          discount: data.discount || 0,
          tax: 0,
          shipping: data.shipping || 0,
          total: 0,
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus || 'pending',
          notes: data.notes,
          orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
          wordpressId: data.wordpressId,
        },
        include: {
          customer: true,
        },
      });

      // 2. Se data ha items (non è nel tipo ma supportato in logica business), li aggiungiamo
      // Altrimenti gli items vanno aggiunti separatamente tramite addOrderItem

      // 3. Ricalcola totali
      const updatedOrder = await this.recalculateTotals(tx, order.id);

      return updatedOrder;
    });
  }

  /**
   * Aggiorna ordine
   */
  async updateOrder(id: string, data: UpdateOrderInput) {
    const order = await this.getOrderById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    // Validazioni workflow
    if (data.status && !this.isValidStatusTransition(order.status, data.status as any)) {
      throw new Error(`Invalid status transition from ${order.status} to ${data.status}`);
    }

    return await prisma.order.update({
      where: { id },
      data: {
        ...data,
        status: data.status as any,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Aggiungi item a ordine
   * Per clienti B2B, calcola automaticamente il prezzo in base al listino
   */
  async addOrderItem(tx: any, orderId: string, data: AddOrderItemInput) {
    // 1. Ottieni info ordine e cliente
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            priceList: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // 2. Ottieni info prodotto per prezzo base e aliquota IVA
    const product = await tx.product.findUnique({
      where: { id: data.productId },
      select: { price: true, taxRate: true },
    });

    if (!product) {
      throw new Error(`Product ${data.productId} not found`);
    }

    let unitPrice = data.unitPrice;
    let appliedDiscount = data.discount || 0;
    let priceSource = 'manual';

    // 3. Se B2B e non è stato specificato un prezzo manuale, calcola dal listino
    if (!data.unitPrice && order.customer?.type === 'B2B') {
      try {
        const priceCalculation = await priceListService.calculatePrice(
          order.customerId,
          data.productId,
          data.quantity
        );

        unitPrice = priceCalculation.finalPrice;
        appliedDiscount = priceCalculation.discount;
        priceSource = priceCalculation.discountSource;
      } catch (error) {
        // Se il calcolo fallisce, usa il prezzo base del prodotto
        unitPrice = Number(product.price);
        priceSource = 'product_base';
      }
    } else if (!data.unitPrice) {
      // Per B2C o se non specificato, usa prezzo base
      unitPrice = Number(product.price);
      priceSource = 'product_base';
    }

    // Determina l'aliquota IVA: usa quella specificata, altrimenti dal prodotto, default 22%
    const effectiveTaxRate = data.taxRate ?? Number(product.taxRate) ?? 22;

    const subtotalAmount = unitPrice * data.quantity;
    const taxAmount = subtotalAmount * effectiveTaxRate / 100;
    const totalAmount = subtotalAmount + taxAmount;

    // 4. Ottieni info prodotto per sku e nome
    const productInfo = await tx.product.findUnique({
      where: { id: data.productId },
      select: { sku: true, name: true },
    });

    // 5. Crea item con info prezzo
    const item = await tx.orderItem.create({
      data: {
        orderId,
        productId: data.productId,
        variantId: data.variantId,
        productName: productInfo?.name || 'Unknown Product',
        sku: productInfo?.sku || 'N/A',
        quantity: data.quantity,
        unitPrice,
        discount: appliedDiscount,
        taxRate: effectiveTaxRate,
        subtotal: subtotalAmount,
        tax: taxAmount,
        total: totalAmount,
        notes: data.notes,
        priceSource, // Campo per tracciare l'origine del prezzo
      },
    });

    // 5. Ricalcola totali ordine
    await this.recalculateTotals(tx, orderId);

    return item;
  }

  /**
   * Crea ordine B2B con calcolo prezzi automatico
   */
  async createB2BOrder(customerId: string, items: Array<{ productId: string; quantity: number }>, options?: {
    notes?: string;
    shippingAddress?: any;
    billingAddress?: any;
  }) {
    // Verifica che il cliente sia B2B
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        priceList: true,
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.type !== 'B2B') {
      throw new Error('This method is only for B2B customers');
    }

    // Calcola tutti i prezzi
    const priceCalculation = await priceListService.calculateOrderPrices(customerId, items);

    // Crea l'ordine
    return await prisma.$transaction(async (tx: any) => {
      const orderNumber = await this.generateOrderNumber();

      // Crea ordine
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          source: 'B2B',
          status: 'PENDING',
          subtotal: priceCalculation.subtotal,
          discount: priceCalculation.totalDiscount,
          tax: 0,
          shipping: 0,
          total: 0,
          shippingAddress: options?.shippingAddress || customer.shippingAddress,
          billingAddress: options?.billingAddress || customer.billingAddress,
          paymentStatus: 'pending',
          notes: options?.notes,
          orderDate: new Date(),
        },
      });

      // Crea items
      let totalTax = 0;
      for (const item of priceCalculation.items) {
        // Ottieni info prodotto con aliquota IVA
        const productInfo = await tx.product.findUnique({
          where: { id: item.productId },
          select: { sku: true, name: true, taxRate: true },
        });

        // Usa l'aliquota IVA del prodotto, default 22%
        const itemTaxRate = Number(productInfo?.taxRate) || 22;
        const taxAmount = item.lineTotal * itemTaxRate / 100;
        totalTax += taxAmount;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: productInfo?.name || 'Unknown Product',
            sku: productInfo?.sku || 'N/A',
            quantity: item.quantity,
            unitPrice: item.finalPrice,
            discount: item.discount,
            taxRate: itemTaxRate,
            subtotal: item.lineTotal,
            tax: taxAmount,
            total: item.lineTotal + taxAmount,
            priceSource: item.discountSource,
          },
        });
      }

      // Aggiorna totali finali
      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          tax: totalTax,
          total: priceCalculation.subtotal + totalTax,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return {
        order: finalOrder,
        priceDetails: priceCalculation,
      };
    });
  }

  /**
   * Preview prezzi per ordine B2B (senza creare l'ordine)
   */
  async previewB2BOrderPrices(customerId: string, items: Array<{ productId: string; quantity: number }>) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
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

    if (!customer) {
      throw new Error('Customer not found');
    }

    const priceCalculation = await priceListService.calculateOrderPrices(customerId, items);

    // Aggiungi info prodotto a ogni riga
    const itemsWithProducts = await Promise.all(
      priceCalculation.items.map(async (item: any) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { sku: true, name: true },
        });
        return {
          ...item,
          sku: product?.sku,
          productName: product?.name,
        };
      })
    );

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.businessName || `${customer.firstName} ${customer.lastName}`,
        priceList: customer.priceList,
        customerDiscount: customer.discount,
      },
      items: itemsWithProducts,
      subtotal: priceCalculation.subtotal,
      totalDiscount: priceCalculation.totalDiscount,
      estimatedTax: priceCalculation.subtotal * 0.22,
      estimatedTotal: priceCalculation.subtotal * 1.22,
    };
  }

  /**
   * Rimuovi item da ordine
   */
  async removeOrderItem(orderId: string, itemId: string) {
    return await prisma.$transaction(async (tx: any) => {
      await tx.orderItem.delete({
        where: { id: itemId },
      });

      await this.recalculateTotals(tx, orderId);

      return await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  /**
   * Cambia stato ordine con validazione workflow
   */
  async updateOrderStatus(id: string, data: UpdateOrderStatusInput, userId?: string) {
    const order = await this.getOrderById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    if (!this.isValidStatusTransition(order.status, data.status)) {
      throw new Error(`Invalid status transition from ${order.status} to ${data.status}`);
    }

    // Logica speciale per stati critici
    if (data.status === 'CONFIRMED') {
      // Quando confermato, verifica disponibilità e riserva stock
      await this.allocateInventoryForOrder(id);

      // Auto-genera PaymentDues se non esistono già
      const existingDues = await prisma.paymentDue.count({
        where: { orderId: id },
      });
      if (existingDues === 0) {
        try {
          await this.generatePaymentDuesFromOrder(id);
          logger.info(`Auto-generated payment dues for order ${id}`);
        } catch (error: any) {
          logger.warn(`Could not auto-generate payment dues for order ${id}: ${error.message}`);
        }
      }
    }

    if (data.status === 'PROCESSING') {
      // Auto-crea ProductionOrder per prodotti con BOM
      try {
        await this.createProductionOrdersForOrder(id, userId);
        logger.info(`Auto-created production orders for order ${id}`);
      } catch (error: any) {
        logger.warn(`Could not auto-create production orders for order ${id}: ${error.message}`);
      }
    }

    if (data.status === 'CANCELLED') {
      // Rilascia riserve magazzino
      await this.releaseInventoryForOrder(id);
    }

    return await prisma.order.update({
      where: { id },
      data: {
        status: data.status as any,
        notes: data.notes ? `${order.notes || ''}\n${data.notes}` : order.notes,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Alloca inventario per ordine - SCALA EFFETTIVAMENTE le giacenze
   * Include prodotti finiti e materiali BOM
   */
  async allocateInventoryForOrder(orderId: string) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    return await prisma.$transaction(async (tx: any) => {
      for (const item of order.items) {
        // Determina location preferita in base al source
        const location = this.getPreferredLocation(order.source);

        // Trova inventory item (con supporto varianti)
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            productId: item.productId,
            variantId: item.variantId || null, // Filtra per variante se presente
            location,
          },
          include: {
            product: true,
            variant: true,
          },
        });

        // Nome item per messaggi errore
        const itemName = item.variant?.name || item.product?.name || item.sku;

        if (!inventoryItem) {
          throw new Error(`${itemName} non disponibile in ${location}`);
        }

        // Verifica disponibilità effettiva
        if (inventoryItem.quantity < item.quantity) {
          throw new Error(
            `Stock insufficiente per ${itemName}. Disponibile: ${inventoryItem.quantity}, Richiesto: ${item.quantity}`
          );
        }

        // SCALA effettivamente la quantità (non solo riserva)
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        // Crea movimento inventario per tracciabilità (con variantId)
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId, // Traccia variante
            type: 'OUT',
            quantity: -item.quantity,
            fromLocation: location,
            reference: order.orderNumber,
            notes: `Allocazione ordine ${order.orderNumber}`,
          },
        });

        // Aggiorna item con allocazione
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            allocatedLocation: location,
            allocatedQuantity: item.quantity,
          },
        });

        // Scala anche i materiali BOM (con supporto varianti)
        await this.deductBomMaterialsForItem(tx, item.productId, item.variantId, item.quantity, order.orderNumber);
      }

      return order;
    });
  }

  /**
   * Scala materiali BOM per un prodotto/variante
   * Prima cerca materiali specifici per variante, poi fallback al prodotto padre
   */
  private async deductBomMaterialsForItem(
    tx: any,
    productId: string,
    variantId: string | null | undefined,
    quantity: number,
    orderNumber: string
  ) {
    let bomItems: any[] = [];

    // 1. Prima cerca materiali SPECIFICI per la variante
    if (variantId) {
      bomItems = await tx.productMaterial.findMany({
        where: {
          productId,
          variantId, // Materiali specifici variante
        },
        include: { material: true },
      });
    }

    // 2. Se la variante non ha materiali specifici, usa quelli del prodotto padre
    if (bomItems.length === 0) {
      bomItems = await tx.productMaterial.findMany({
        where: {
          productId,
          variantId: null, // Materiali del prodotto padre (senza variante)
        },
        include: { material: true },
      });
    }

    // 3. Scala i materiali
    for (const bom of bomItems) {
      const materialQty = Number(bom.quantity) * quantity;

      // Scala il materiale
      await tx.material.update({
        where: { id: bom.materialId },
        data: {
          currentStock: { decrement: materialQty },
        },
      });

      // Crea movimento materiale per tracciabilità
      await tx.materialMovement.create({
        data: {
          materialId: bom.materialId,
          type: 'OUT', // Scarico materiale per BOM
          quantity: -materialQty,
          reference: orderNumber,
          notes: variantId
            ? `Consumo BOM variante per ordine ${orderNumber}`
            : `Consumo BOM prodotto per ordine ${orderNumber}`,
        },
      });

      logger.info(`Deducted ${materialQty} of material ${bom.material.name} for order ${orderNumber}`);
    }
  }

  /**
   * Rilascia/ripristina inventario per ordine annullato
   * Ripristina prodotti finiti e materiali BOM
   */
  async releaseInventoryForOrder(orderId: string) {
    const order: any = await this.getOrderById(orderId);
    if (!order) return;

    return await prisma.$transaction(async (tx: any) => {
      for (const item of order.items) {
        if (!item.allocatedLocation || !item.allocatedQuantity) continue;

        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            productId: item.productId,
            variantId: item.variantId,
            location: item.allocatedLocation,
          },
        });

        if (inventoryItem) {
          // RIPRISTINA la quantità effettiva
          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              quantity: { increment: item.allocatedQuantity },
            },
          });

          // Crea movimento di ripristino
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              type: 'RETURN',
              quantity: item.allocatedQuantity,
              toLocation: item.allocatedLocation,
              reference: order.orderNumber,
              notes: `Rilascio per annullamento ordine ${order.orderNumber}`,
            },
          });
        }

        // Ripristina anche i materiali BOM (con supporto varianti)
        await this.restoreBomMaterialsForItem(tx, item.productId, item.variantId, item.allocatedQuantity, order.orderNumber);

        // Reset allocazione sull'item
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            allocatedLocation: null,
            allocatedQuantity: 0,
          },
        });
      }
    });
  }

  /**
   * Ripristina materiali BOM per un prodotto/variante
   * Prima cerca materiali specifici per variante, poi fallback al prodotto padre
   */
  private async restoreBomMaterialsForItem(
    tx: any,
    productId: string,
    variantId: string | null | undefined,
    quantity: number,
    orderNumber: string
  ) {
    let bomItems: any[] = [];

    // 1. Prima cerca materiali SPECIFICI per la variante
    if (variantId) {
      bomItems = await tx.productMaterial.findMany({
        where: {
          productId,
          variantId, // Materiali specifici variante
        },
        include: { material: true },
      });
    }

    // 2. Se la variante non ha materiali specifici, usa quelli del prodotto padre
    if (bomItems.length === 0) {
      bomItems = await tx.productMaterial.findMany({
        where: {
          productId,
          variantId: null, // Materiali del prodotto padre (senza variante)
        },
        include: { material: true },
      });
    }

    // 3. Ripristina i materiali
    for (const bom of bomItems) {
      const materialQty = Number(bom.quantity) * quantity;

      // Ripristina il materiale
      await tx.material.update({
        where: { id: bom.materialId },
        data: {
          currentStock: { increment: materialQty },
        },
      });

      // Crea movimento materiale per tracciabilità
      await tx.materialMovement.create({
        data: {
          materialId: bom.materialId,
          type: 'RETURN',
          quantity: materialQty,
          reference: orderNumber,
          notes: variantId
            ? `Ripristino BOM variante per ordine ${orderNumber}`
            : `Ripristino BOM prodotto per ordine ${orderNumber}`,
        },
      });

      logger.info(`Restored ${materialQty} of material ${bom.material.name} for order ${orderNumber}`);
    }
  }

  /**
   * Crea spedizione per ordine con scalatura BOM ricorsiva
   */
  async createShipment(orderId: string, data: CreateShipmentInput) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'CONFIRMED' && order.status !== 'PROCESSING' && order.status !== 'READY') {
      throw new Error(`Cannot create shipment for order in status ${order.status}`);
    }

    const shippedDate = data.shippedDate ? new Date(data.shippedDate) : new Date();

    // Determina location in base alla sorgente ordine
    const location = this.getPreferredLocation(order.source);

    // Scala inventario ricorsivamente per ogni item dell'ordine
    const inventoryResults: any[] = [];
    const inventoryErrors: string[] = [];

    for (const item of order.items) {
      try {
        const result = await inventoryService.deductInventoryRecursive(
          item.productId,
          item.quantity,
          item.allocatedLocation || location,
          orderId,
          (data as any).userId || 'system'
        );

        inventoryResults.push({
          productId: item.productId,
          success: result.success,
          deductions: result.deductions,
          errors: result.errors,
        });

        if (!result.success) {
          inventoryErrors.push(
            ...result.errors.map((e) => e.message)
          );
        }
      } catch (error: any) {
        inventoryErrors.push(`Errore scalatura ${item.product?.sku || item.productId}: ${error.message}`);
        logger.error(`Error deducting inventory for item ${item.id}: ${error.message}`);
      }
    }

    // Se ci sono errori di inventario, interrompi
    if (inventoryErrors.length > 0) {
      throw new Error(`Scalatura inventario fallita: ${inventoryErrors.join('; ')}`);
    }

    // Aggiorna ordine con shipped date
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippedDate,
        status: 'SHIPPED',
        trackingNumber: data.trackingNumber || null,
        trackingUrl: (data as any).trackingUrl || null,
        carrier: data.carrier || null,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger check alert post-spedizione (asincrono)
    triggerPostShipmentCheck(orderId).catch((err) => {
      logger.error(`Failed to trigger post-shipment check: ${err.message}`);
    });

    logger.info(`Shipment created for order ${updatedOrder.orderNumber}, inventory deducted for ${inventoryResults.length} items`);

    return {
      orderId,
      orderNumber: updatedOrder.orderNumber,
      shippedDate,
      trackingNumber: data.trackingNumber,
      trackingUrl: (data as any).trackingUrl,
      carrier: data.carrier,
      inventoryDeducted: true,
      inventoryResults,
    };
  }

  /**
   * Aggiorna stato spedizione (marca come consegnato)
   */
  async markAsDelivered(orderId: string) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    return await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredDate: new Date(),
      },
      include: {
        customer: true,
        items: true,
      },
    });
  }

  /**
   * Ricalcola totali ordine
   */
  private async recalculateTotals(tx: any, orderId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
    });

    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
    const tax = items.reduce((sum: number, item: any) => sum + Number(item.tax), 0);

    const order = await tx.order.findUnique({ where: { id: orderId } });
    const total = subtotal + tax + Number(order.shippingCost || 0);

    return await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        tax,
        total,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Validazione transizioni workflow
   * PENDING → CONFIRMED → PROCESSING → READY → SHIPPED → DELIVERED
   *   └──→ CANCELLED (da qualsiasi stato eccetto DELIVERED)
   */
  private isValidStatusTransition(from: string, to: string): boolean {
    const transitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['READY', 'CANCELLED'],
      READY: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [], // stato finale
      CANCELLED: [], // stato finale
    };

    return transitions[from]?.includes(to) || false;
  }

  /**
   * Determina location preferita in base al source ordine
   */
  private getPreferredLocation(source: string): any {
    const mapping: Record<string, string> = {
      WORDPRESS: 'WEB',
      B2B: 'B2B',
      MANUAL: 'WEB',
    };

    return mapping[source] || 'WEB';
  }

  /**
   * Genera numero ordine progressivo
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    const lastOrder = await prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastOrder) {
      const match = lastOrder.orderNumber.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  // ==========================================
  // FULL ORDER MANAGEMENT (Sprint 7 - Orders Complete)
  // ==========================================

  /**
   * Crea ordine completo con tutti i dati (WooCommerce-like)
   */
  async createOrderFull(data: {
    customerId: string;
    source: 'MANUAL' | 'B2B' | 'WORDPRESS';
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice?: number;
      discount?: number;
      notes?: string;
    }>;
    shippingAddress?: any;
    billingAddress?: any;
    paymentMethod?: string;
    paymentMethodTitle?: string;
    b2bPaymentMethod?: 'BONIFICO' | 'RIBA' | 'CONTANTI' | 'FIDO' | 'ASSEGNO' | 'CARTA';
    b2bPaymentTerms?: number;
    shipping?: number;
    discount?: number;
    notes?: string;
    customerNote?: string;
    internalNotes?: string;
    priority?: number;
    estimatedDelivery?: string;
    generatePaymentDues?: boolean;
    priceListId?: string;
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
      addedAt?: string;
    }>;
    customInstallments?: Array<{
      installmentNumber: number;
      totalInstallments: number;
      amount: number;
      dueDate: string;
    }>;
  }) {
    // Verifica cliente
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
      include: {
        priceList: true,
        paymentPlan: {
          include: {
            installments: {
              orderBy: { sequence: 'asc' },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new Error('Cliente non trovato');
    }

    return await prisma.$transaction(async (tx: any) => {
      const orderNumber = await this.generateOrderNumber();
      let subtotal = 0;
      let totalTax = 0;
      const itemsToCreate: any[] = [];

      // Calcola prezzi per ogni item
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, sku: true, name: true, price: true, taxRate: true },
        });

        if (!product) {
          throw new Error(`Prodotto ${item.productId} non trovato`);
        }

        let unitPrice = item.unitPrice;
        let appliedDiscount = item.discount || 0;
        let priceSource = 'manual';

        // Se B2B e non è stato specificato un prezzo, calcola dal listino
        if (!item.unitPrice && customer.type === 'B2B') {
          try {
            // Usa il listino specificato o quello del cliente
            const priceCalc = await priceListService.calculatePrice(
              data.customerId,
              item.productId,
              item.quantity,
              data.priceListId // Listino override
            );
            unitPrice = priceCalc.finalPrice;
            appliedDiscount = priceCalc.discount;
            priceSource = priceCalc.discountSource;
          } catch {
            unitPrice = Number(product.price);
            priceSource = 'product_base';
          }
        } else if (!item.unitPrice) {
          unitPrice = Number(product.price);
          priceSource = 'product_base';
        }

        // Usa l'aliquota IVA specificata nell'item, altrimenti dal prodotto, default 22%
        const itemTaxRate = (item as any).taxRate ?? Number(product.taxRate) ?? 22;

        const lineSubtotal = unitPrice! * item.quantity;
        const lineTax = lineSubtotal * itemTaxRate / 100;
        subtotal += lineSubtotal;
        totalTax += lineTax;

        itemsToCreate.push({
          productId: item.productId,
          variantId: item.variantId,
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice: unitPrice!,
          discount: appliedDiscount,
          taxRate: itemTaxRate,
          subtotal: lineSubtotal,
          tax: lineTax,
          total: lineSubtotal + lineTax,
          notes: item.notes,
          priceSource,
        });
      }

      const shippingCost = data.shipping || 0;
      const orderDiscount = data.discount || 0;
      const total = subtotal + totalTax + shippingCost - orderDiscount;

      // Prepara allegati con ID univoci
      const attachmentsWithIds = (data.attachments || []).map((att, idx) => ({
        ...att,
        id: `att_${Date.now()}_${idx}`,
        addedAt: att.addedAt || new Date().toISOString(),
      }));
      console.log('[OrderService] createOrderFull attachments to save:', JSON.stringify(attachmentsWithIds));

      // Crea l'ordine
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          source: data.source as any,
          status: 'PENDING',
          subtotal,
          discount: orderDiscount,
          tax: totalTax,
          shipping: shippingCost,
          total,
          shippingAddress: data.shippingAddress || customer.shippingAddress,
          billingAddress: data.billingAddress || customer.billingAddress,
          paymentMethod: data.paymentMethod,
          paymentMethodTitle: data.paymentMethodTitle,
          paymentStatus: 'pending',
          notes: data.notes,
          customerNote: data.customerNote,
          internalNotes: data.internalNotes,
          orderDate: new Date(),
          priority: data.priority || 0,
          estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
          b2bPaymentMethod: data.b2bPaymentMethod as any,
          b2bPaymentTerms: data.b2bPaymentTerms || customer.paymentTerms,
          attachments: attachmentsWithIds,
        },
      });

      // Crea items
      for (const itemData of itemsToCreate) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            ...itemData,
          },
        });
      }

      // Genera PaymentDues se richiesto
      if (data.customInstallments && data.customInstallments.length > 0) {
        // Usa rate manuali personalizzate
        await this.createCustomPaymentDues(tx, order.id, data.customInstallments, customer);
      } else if (data.generatePaymentDues && customer.type === 'B2B') {
        // Usa piano pagamento del cliente
        await this.generatePaymentDuesForOrder(tx, order.id, total, customer);
      }

      // Ritorna ordine completo
      return await tx.order.findUnique({
        where: { id: order.id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          paymentDues: true,
        },
      });
    });
  }

  /**
   * Aggiorna ordine completo
   */
  async updateOrderFull(id: string, data: {
    items?: Array<{
      id?: string; // Se presente, aggiorna; altrimenti, crea
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice?: number;
      discount?: number;
      notes?: string;
    }>;
    shippingAddress?: any;
    billingAddress?: any;
    paymentMethod?: string;
    paymentMethodTitle?: string;
    b2bPaymentMethod?: 'BONIFICO' | 'RIBA' | 'CONTANTI' | 'FIDO' | 'ASSEGNO' | 'CARTA';
    b2bPaymentTerms?: number;
    shipping?: number;
    discount?: number;
    notes?: string;
    customerNote?: string;
    internalNotes?: string;
    priority?: number;
    estimatedDelivery?: string;
    status?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    carrier?: string;
    priceListId?: string;
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
      addedAt?: string;
    }>;
  }) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            priceList: true,
          },
        },
        items: true,
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Validazione cambio stato
    if (data.status && !this.isValidStatusTransition(order.status, data.status)) {
      throw new Error(`Transizione stato non valida da ${order.status} a ${data.status}`);
    }

    return await prisma.$transaction(async (tx: any) => {
      // Gestione items se forniti
      if (data.items) {
        // Rimuovi items esistenti
        await tx.orderItem.deleteMany({
          where: { orderId: id },
        });

        // Ricrea items
        let subtotal = 0;
        let totalTax = 0;

        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, sku: true, name: true, price: true, taxRate: true },
          });

          if (!product) continue;

          let unitPrice = item.unitPrice;
          let appliedDiscount = item.discount || 0;
          let priceSource = 'manual';

          if (!item.unitPrice && order.customer?.type === 'B2B') {
            try {
              // Usa il listino specificato o quello del cliente
              const priceCalc = await priceListService.calculatePrice(
                order.customerId,
                item.productId,
                item.quantity,
                data.priceListId // Listino override
              );
              unitPrice = priceCalc.finalPrice;
              appliedDiscount = priceCalc.discount;
              priceSource = priceCalc.discountSource;
            } catch {
              unitPrice = Number(product.price);
              priceSource = 'product_base';
            }
          } else if (!item.unitPrice) {
            unitPrice = Number(product.price);
            priceSource = 'product_base';
          }

          // Usa l'aliquota IVA specificata nell'item, altrimenti dal prodotto, default 22%
          const itemTaxRate = (item as any).taxRate ?? Number(product.taxRate) ?? 22;

          const lineSubtotal = unitPrice! * item.quantity;
          const lineTax = lineSubtotal * itemTaxRate / 100;
          subtotal += lineSubtotal;
          totalTax += lineTax;

          await tx.orderItem.create({
            data: {
              orderId: id,
              productId: item.productId,
              variantId: item.variantId,
              productName: product.name,
              sku: product.sku,
              quantity: item.quantity,
              unitPrice: unitPrice!,
              discount: appliedDiscount,
              taxRate: itemTaxRate,
              subtotal: lineSubtotal,
              tax: lineTax,
              total: lineSubtotal + lineTax,
              notes: item.notes,
              priceSource,
            },
          });
        }

        // Aggiorna totali
        const shippingCost = data.shipping ?? Number(order.shipping);
        const orderDiscount = data.discount ?? Number(order.discount);
        const total = subtotal + totalTax + shippingCost - orderDiscount;

        await tx.order.update({
          where: { id },
          data: {
            subtotal,
            tax: totalTax,
            shipping: shippingCost,
            discount: orderDiscount,
            total,
          },
        });
      }

      // Prepara allegati se forniti
      let attachmentsData = undefined;
      if (data.attachments) {
        attachmentsData = data.attachments.map((att, idx) => ({
          ...att,
          id: att.addedAt ? att.addedAt.replace(/[^a-z0-9]/gi, '').slice(-10) : `att_${Date.now()}_${idx}`,
          addedAt: att.addedAt || new Date().toISOString(),
        }));
      }

      // Aggiorna altri campi
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          ...(data.shippingAddress && { shippingAddress: data.shippingAddress }),
          ...(data.billingAddress && { billingAddress: data.billingAddress }),
          ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
          ...(data.paymentMethodTitle && { paymentMethodTitle: data.paymentMethodTitle }),
          ...(data.b2bPaymentMethod && { b2bPaymentMethod: data.b2bPaymentMethod as any }),
          ...(data.b2bPaymentTerms !== undefined && { b2bPaymentTerms: data.b2bPaymentTerms }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.customerNote !== undefined && { customerNote: data.customerNote }),
          ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.estimatedDelivery && { estimatedDelivery: new Date(data.estimatedDelivery) }),
          ...(data.status && { status: data.status as any }),
          ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
          ...(data.trackingUrl !== undefined && { trackingUrl: data.trackingUrl }),
          ...(data.carrier !== undefined && { carrier: data.carrier }),
          ...(attachmentsData && { attachments: attachmentsData }),
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          paymentDues: true,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * Genera PaymentDues per ordine (scadenzario)
   * Usa il piano pagamento del cliente se disponibile
   */
  private async generatePaymentDuesForOrder(
    tx: any,
    orderId: string,
    totalAmount: number,
    customer: any
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return [];

    const paymentDues: any[] = [];
    const baseDate = order.orderDate || new Date();

    if (customer.paymentPlan && customer.paymentPlan.installments?.length > 0) {
      // Usa piano pagamento strutturato
      const installments = customer.paymentPlan.installments;
      for (const inst of installments) {
        const dueDate = new Date(baseDate);
        dueDate.setDate(dueDate.getDate() + inst.daysFromInvoice);

        const amount = (totalAmount * Number(inst.percentage)) / 100;

        const paymentDue = await tx.paymentDue.create({
          data: {
            type: 'RECEIVABLE',
            status: 'PENDING',
            orderId,
            customerId: customer.id,
            description: `Rata ${inst.sequence}/${installments.length} - Ordine ${order.orderNumber}`,
            installmentNumber: inst.sequence,
            totalInstallments: installments.length,
            amount,
            dueDate,
            paymentMethod: order.b2bPaymentMethod,
          },
        });
        paymentDues.push(paymentDue);
      }
    } else {
      // Scadenza singola basata su paymentTerms
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + (customer.paymentTerms || order.b2bPaymentTerms || 30));

      const paymentDue = await tx.paymentDue.create({
        data: {
          type: 'RECEIVABLE',
          status: 'PENDING',
          orderId,
          customerId: customer.id,
          description: `Scadenza ordine ${order.orderNumber}`,
          installmentNumber: 1,
          totalInstallments: 1,
          amount: totalAmount,
          dueDate,
          paymentMethod: order.b2bPaymentMethod,
        },
      });
      paymentDues.push(paymentDue);
    }

    return paymentDues;
  }

  /**
   * Crea PaymentDues personalizzate (rate manuali)
   */
  private async createCustomPaymentDues(
    tx: any,
    orderId: string,
    installments: Array<{
      installmentNumber: number;
      totalInstallments: number;
      amount: number;
      dueDate: string;
    }>,
    customer: any
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return [];

    const paymentDues: any[] = [];

    for (const inst of installments) {
      const paymentDue = await tx.paymentDue.create({
        data: {
          type: 'RECEIVABLE',
          status: 'PENDING',
          orderId,
          customerId: customer.id,
          description: `Rata ${inst.installmentNumber}/${inst.totalInstallments} - Ordine ${order.orderNumber}`,
          installmentNumber: inst.installmentNumber,
          totalInstallments: inst.totalInstallments,
          amount: inst.amount,
          dueDate: new Date(inst.dueDate),
          paymentMethod: order.b2bPaymentMethod,
        },
      });
      paymentDues.push(paymentDue);
    }

    return paymentDues;
  }

  /**
   * Genera scadenze per ordine esistente (chiamata esterna)
   */
  async generatePaymentDuesFromOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            paymentPlan: {
              include: {
                installments: {
                  orderBy: { sequence: 'asc' },
                },
              },
            },
          },
        },
        paymentDues: true,
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    if (order.paymentDues.length > 0) {
      throw new Error('Scadenze già generate per questo ordine. Eliminare quelle esistenti prima di rigenerare.');
    }

    return await prisma.$transaction(async (tx: any) => {
      return await this.generatePaymentDuesForOrder(
        tx,
        orderId,
        Number(order.total),
        order.customer
      );
    });
  }

  /**
   * Ottieni ordine completo con tutte le relazioni
   */
  async getOrderFull(id: string) {
    console.log('[OrderService] getOrderFull called with id:', id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            paymentPlan: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                categories: {
                  include: { category: true },
                  where: { isPrimary: true },
                  take: 1,
                },
                productImages: { take: 1, orderBy: { position: 'asc' } },
              },
            },
            variant: true,
          },
        },
        invoice: true,
        orderNotes: {
          orderBy: { createdAt: 'desc' },
        },
        refunds: {
          include: {
            items: {
              include: {
                orderItem: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        paymentDues: {
          include: {
            payments: true,
          },
          orderBy: { dueDate: 'asc' },
        },
        productionOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            plannedStartDate: true,
            plannedEndDate: true,
            actualStartDate: true,
            actualEndDate: true,
          },
        },
      },
    });

    console.log('[OrderService] getOrderFull query completed, order:', order ? 'found' : 'not found');
    if (order) {
      console.log('[OrderService] getOrderFull attachments:', JSON.stringify(order.attachments));
    }
    if (!order) {
      return null;
    }

    // Calcola totali aggiuntivi
    const totalRefunded = order.refunds
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const totalPaid = order.paymentDues
      .reduce((sum, pd) => sum + Number(pd.paidAmount), 0);

    return {
      ...order,
      // Ensure attachments is always an array
      attachments: order.attachments || [],
      calculations: {
        totalRefunded,
        totalPaid,
        balance: Number(order.total) - totalRefunded - totalPaid,
        paymentProgress: order.paymentDues.length > 0
          ? Math.round((totalPaid / Number(order.total)) * 100)
          : 0,
      },
    };
  }

  /**
   * Aggiungi allegato a ordine
   */
  async addOrderAttachment(orderId: string, attachment: {
    name: string;
    url: string;
    type: string;
    size?: number;
    addedBy?: string;
  }) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { attachments: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const currentAttachments = (order.attachments as any[]) || [];
    const newAttachment = {
      ...attachment,
      id: `att_${Date.now()}`,
      addedAt: new Date().toISOString(),
    };

    return await prisma.order.update({
      where: { id: orderId },
      data: {
        attachments: [...currentAttachments, newAttachment],
      },
      select: {
        id: true,
        attachments: true,
      },
    });
  }

  /**
   * Rimuovi allegato da ordine
   */
  async removeOrderAttachment(orderId: string, attachmentId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { attachments: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    const currentAttachments = (order.attachments as any[]) || [];
    const updatedAttachments = currentAttachments.filter(
      (att) => att.id !== attachmentId
    );

    return await prisma.order.update({
      where: { id: orderId },
      data: {
        attachments: updatedAttachments,
      },
      select: {
        id: true,
        attachments: true,
      },
    });
  }

  /**
   * Ottieni allegati ordine
   */
  async getOrderAttachments(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { attachments: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    return (order.attachments as any[]) || [];
  }

  /**
   * Statistiche ordini per periodo
   */
  async getOrderStats(dateFrom: string, dateTo: string) {
    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      },
      select: {
        status: true,
        total: true,
        source: true,
      },
    });

    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum: number, o: any) => sum + Number(o.total), 0),
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      averageOrderValue: 0,
    };

    orders.forEach((order: any) => {
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
      stats.bySource[order.source] = (stats.bySource[order.source] || 0) + 1;
    });

    stats.averageOrderValue = orders.length > 0 ? stats.totalRevenue / orders.length : 0;

    return stats;
  }

  /**
   * Crea ordini di produzione per tutti gli item dell'ordine che hanno BOM
   * Chiamato automaticamente quando l'ordine passa a PROCESSING
   */
  async createProductionOrdersForOrder(orderId: string, userId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Se non c'è userId, cerca un utente di sistema o usa il primo admin
    let createdById = userId;
    if (!createdById) {
      const systemUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'system@ecommerceerp.com' },
            { role: 'ADMIN' },
          ],
        },
      });
      createdById = systemUser?.id;
    }

    if (!createdById) {
      throw new Error('Nessun utente disponibile per creare ordini di produzione');
    }

    const manufacturingService = await getManufacturingService();
    const createdOrders = [];

    for (const item of order.items) {
      try {
        // Verifica se esiste già un ordine di produzione per questo item
        const existingPO = await prisma.productionOrder.findFirst({
          where: {
            salesOrderId: orderId,
            productId: item.productId,
            status: { notIn: ['CANCELLED'] },
          },
        });

        if (!existingPO) {
          const productionOrder = await manufacturingService.createProductionOrder({
            productId: item.productId,
            quantity: item.quantity,
            salesOrderId: orderId,
            priority: String(order.priority) === 'URGENT' ? 10 : String(order.priority) === 'HIGH' ? 5 : 0,
            notes: `Auto-generato da ordine ${order.orderNumber}`,
            createdById, // Parametro obbligatorio aggiunto
          });
          createdOrders.push(productionOrder);
          logger.info(`Created production order for product ${item.product.sku} (order ${order.orderNumber})`);
        }
      } catch (error: any) {
        logger.error(`Failed to create production order for item ${item.id}: ${error.message}`);
      }
    }

    return createdOrders;
  }

  // ============================================================
  // TIMELINE & OPTIMIZATION METHODS
  // ============================================================

  /**
   * Genera range di date per il grafico timeline
   */
  private generateDateRange(startDate: Date, endDate: Date): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Ottieni dati timeline ordini per grafico
   */
  async getOrdersTimeline(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14); // Include 14 giorni futuri per consegne previste

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { orderDate: { gte: startDate } },
          { estimatedDelivery: { gte: startDate, lte: endDate } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        estimatedDelivery: true,
        status: true,
        total: true,
        shippingAddress: true,
        customer: {
          select: {
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Raggruppa per giorno
    const receivedByDay = new Map<string, { count: number; total: number; orders: string[] }>();
    const deliveryByDay = new Map<string, { count: number; orders: string[] }>();

    orders.forEach((order) => {
      // Ordini ricevuti
      const receivedDate = order.orderDate.toISOString().split('T')[0];
      if (!receivedByDay.has(receivedDate)) {
        receivedByDay.set(receivedDate, { count: 0, total: 0, orders: [] });
      }
      const received = receivedByDay.get(receivedDate)!;
      received.count++;
      received.total += Number(order.total || 0);
      received.orders.push(order.orderNumber);

      // Consegne previste
      if (order.estimatedDelivery) {
        const deliveryDate = order.estimatedDelivery.toISOString().split('T')[0];
        if (!deliveryByDay.has(deliveryDate)) {
          deliveryByDay.set(deliveryDate, { count: 0, orders: [] });
        }
        const delivery = deliveryByDay.get(deliveryDate)!;
        delivery.count++;
        delivery.orders.push(order.orderNumber);
      }
    });

    // Genera array per Chart.js
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = this.generateDateRange(startDate, endDate);

    const now = new Date();

    return {
      labels: dates,
      received: dates.map((d) => receivedByDay.get(d)?.count || 0),
      deliveries: dates.map((d) => deliveryByDay.get(d)?.count || 0),
      revenueByDay: dates.map((d) => receivedByDay.get(d)?.total || 0),
      details: {
        received: Object.fromEntries(receivedByDay),
        deliveries: Object.fromEntries(deliveryByDay),
      },
      summary: {
        totalReceived: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        pendingDeliveries: orders.filter(
          (o) =>
            o.estimatedDelivery &&
            o.estimatedDelivery >= now &&
            !['DELIVERED', 'CANCELLED'].includes(o.status)
        ).length,
        overdueDeliveries: orders.filter(
          (o) =>
            o.estimatedDelivery &&
            o.estimatedDelivery < now &&
            !['DELIVERED', 'CANCELLED'].includes(o.status)
        ).length,
        avgOrderValue:
          orders.length > 0
            ? orders.reduce((sum, o) => sum + Number(o.total || 0), 0) / orders.length
            : 0,
      },
    };
  }

  /**
   * Raggruppa ordini per destinazione (paese)
   */
  private groupOrdersByDestination(orders: any[]) {
    const groups = new Map<string, any[]>();

    orders.forEach((order) => {
      const address = order.shippingAddress as any;
      const country = address?.country || 'Sconosciuto';

      if (!groups.has(country)) {
        groups.set(country, []);
      }
      groups.get(country)!.push(order);
    });

    return Array.from(groups.entries())
      .map(([country, countryOrders]) => ({
        country,
        orderCount: countryOrders.length,
        totalValue: countryOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        orders: countryOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customer:
            o.customer?.businessName ||
            `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() ||
            'N/A',
          total: Number(o.total || 0),
          status: o.status,
        })),
        suggestion:
          countryOrders.length > 1
            ? `Consolida ${countryOrders.length} ordini per ${country} per ottimizzare la spedizione`
            : null,
      }))
      .filter((g) => g.orderCount > 1)
      .sort((a, b) => b.orderCount - a.orderCount);
  }

  /**
   * Raggruppa ordini per prodotto
   */
  private groupOrdersByProduct(orders: any[]) {
    const productGroups = new Map<string, { product: any; orders: any[]; totalQty: number }>();

    orders.forEach((order) => {
      order.items?.forEach((item: any) => {
        const productId = item.productId;
        const productName = item.product?.name || 'Unknown';
        const productSku = item.product?.sku || '';

        if (!productGroups.has(productId)) {
          productGroups.set(productId, {
            product: { id: productId, name: productName, sku: productSku },
            orders: [],
            totalQty: 0,
          });
        }

        const group = productGroups.get(productId)!;
        // Aggiungi ordine se non già presente
        if (!group.orders.find((o) => o.id === order.id)) {
          group.orders.push(order);
        }
        group.totalQty += item.quantity || 0;
      });
    });

    return Array.from(productGroups.values())
      .map((group) => ({
        product: group.product,
        orderCount: group.orders.length,
        totalQuantity: group.totalQty,
        orders: group.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          quantity:
            o.items?.find((i: any) => i.productId === group.product.id)?.quantity || 0,
          status: o.status,
        })),
        suggestion:
          group.orders.length > 1
            ? `Produci ${group.product.name} in batch per ${group.orders.length} ordini (${group.totalQty} unità totali)`
            : null,
      }))
      .filter((g) => g.orderCount > 1)
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
  }

  /**
   * Calcola sequenza ottimale di processamento
   */
  private calculateOptimalSequence(
    orders: any[],
    byDestination: any[],
    byProduct: any[]
  ) {
    const suggestions: any[] = [];
    const processedIds = new Set<string>();

    // Step 1: Ordini urgenti (priority > 0)
    const urgent = orders.filter((o) => (o.priority || 0) > 0);
    if (urgent.length > 0) {
      suggestions.push({
        type: 'URGENT',
        icon: 'pi-exclamation-triangle',
        severity: 'danger',
        title: 'Ordini Urgenti',
        description: `${urgent.length} ordini con priorità alta da processare immediatamente`,
        orders: urgent.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          priority: o.priority,
        })),
        action: 'Processa immediatamente',
      });
      urgent.forEach((o) => processedIds.add(o.id));
    }

    // Step 2: Gruppi prodotto (batch production efficiency)
    byProduct
      .filter((g) => g.orderCount >= 2)
      .forEach((group) => {
        const unprocessed = group.orders.filter((o: any) => !processedIds.has(o.id));
        if (unprocessed.length >= 2) {
          suggestions.push({
            type: 'PRODUCT_BATCH',
            icon: 'pi-box',
            severity: 'info',
            title: `Batch Produzione: ${group.product.name}`,
            description: `Produci ${group.totalQuantity} unità per ${unprocessed.length} ordini insieme`,
            orders: unprocessed.map((o: any) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              quantity: o.quantity,
            })),
            productSku: group.product.sku,
            action: 'Avvia produzione batch',
            savings: 'Risparmio tempo setup stimato: ~30%',
          });
          unprocessed.forEach((o: any) => processedIds.add(o.id));
        }
      });

    // Step 3: Gruppi destinazione (shipping efficiency)
    byDestination
      .filter((g) => g.orderCount >= 2)
      .forEach((group) => {
        const unprocessed = group.orders.filter((o: any) => !processedIds.has(o.id));
        if (unprocessed.length >= 2) {
          suggestions.push({
            type: 'SHIPPING_BATCH',
            icon: 'pi-globe',
            severity: 'success',
            title: `Spedizione Consolidata: ${group.country}`,
            description: `Consolida ${unprocessed.length} ordini per ${group.country}`,
            orders: unprocessed.map((o: any) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              customer: o.customer,
            })),
            country: group.country,
            totalValue: group.totalValue,
            action: 'Prepara spedizione consolidata',
            savings: 'Risparmio spedizione stimato: 15-25%',
          });
          unprocessed.forEach((o: any) => processedIds.add(o.id));
        }
      });

    // Step 4: Ordini rimanenti per data
    const remaining = orders.filter((o) => !processedIds.has(o.id));
    if (remaining.length > 0) {
      suggestions.push({
        type: 'STANDARD',
        icon: 'pi-list',
        severity: 'secondary',
        title: 'Ordini Standard',
        description: `${remaining.length} ordini da processare in ordine cronologico`,
        orders: remaining.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          orderDate: o.orderDate,
        })),
        action: 'Processa in sequenza',
      });
    }

    return suggestions;
  }

  /**
   * Stima risparmi dall'ottimizzazione
   */
  private estimateTimeSavings(suggestions: any[]) {
    let productBatchOrders = 0;
    let shippingBatchOrders = 0;

    suggestions.forEach((s) => {
      if (s.type === 'PRODUCT_BATCH') productBatchOrders += s.orders.length;
      if (s.type === 'SHIPPING_BATCH') shippingBatchOrders += s.orders.length;
    });

    return {
      productionEfficiency:
        productBatchOrders > 0
          ? {
              ordersOptimized: productBatchOrders,
              estimatedMinutesSaved: productBatchOrders * 15,
              description: `~${productBatchOrders * 15} minuti risparmiati in setup produzione`,
            }
          : null,
      shippingEfficiency:
        shippingBatchOrders > 0
          ? {
              ordersOptimized: shippingBatchOrders,
              estimatedSavingsEur: shippingBatchOrders * 5,
              description: `~€${shippingBatchOrders * 5} risparmiati in spese di spedizione`,
            }
          : null,
      totalOrdersOptimized: productBatchOrders + shippingBatchOrders,
    };
  }

  /**
   * Ottieni suggerimenti di ottimizzazione per ordini pending
   */
  async getOptimizationSuggestions() {
    // Carica ordini processabili
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        customer: {
          select: {
            id: true,
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { orderDate: 'asc' }],
    });

    // Raggruppa per destinazione
    const byDestination = this.groupOrdersByDestination(orders);

    // Raggruppa per prodotto
    const byProduct = this.groupOrdersByProduct(orders);

    // Calcola sequenza ottimale
    const optimizedSequence = this.calculateOptimalSequence(
      orders,
      byDestination,
      byProduct
    );

    // Stima risparmi
    const estimatedSavings = this.estimateTimeSavings(optimizedSequence);

    return {
      totalPendingOrders: orders.length,
      groupings: {
        byDestination,
        byProduct,
      },
      suggestions: optimizedSequence,
      estimatedSavings,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const orderService = new OrderService();
export default orderService;
