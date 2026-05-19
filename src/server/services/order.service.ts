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
import { queueOrderStatusUpdate, queueInventorySync } from '../jobs/wordpress.job';
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
      } catch (_error) {
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
    const productTaxRate = product.taxRate != null ? Number(product.taxRate) : 22;
    const effectiveTaxRate = data.taxRate ?? productTaxRate;

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
   * Fix HIGH #8: Transazione atomica per CONFIRMED (allocation + status)
   */
  async updateOrderStatus(id: string, data: UpdateOrderStatusInput, userId?: string) {
    const order = await this.getOrderById(id);
    if (!order) {
      throw new Error('Order not found');
    }

    if (!this.isValidStatusTransition(order.status, data.status)) {
      throw new Error(`Invalid status transition from ${order.status} to ${data.status}`);
    }

    // CONFIRMED: usa transazione atomica per allocation + status update
    if (data.status === 'CONFIRMED') {
      return await prisma.$transaction(async (tx: any) => {
        // Alloca inventario DENTRO la transazione
        await this.allocateInventoryInTransaction(tx, order);

        // Aggiorna stato ordine DENTRO la stessa transazione
        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status: 'CONFIRMED' as any,
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

        // Auto-genera PaymentDues (fuori transazione critica, può fallire)
        return updatedOrder;
      }).then(async (updatedOrder) => {
        // PaymentDues generazione dopo commit (non critica)
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

        // Auto-sync CONFIRMED status to WooCommerce (solo se l'ordine ha
        // tenantId — il job sync è scoped per tenant).
        if (order.wordpressId && order.tenantId) {
          try {
            await queueOrderStatusUpdate(order.tenantId, id, 'CONFIRMED');
            logger.info(`Queued WooCommerce status sync for order ${id} -> CONFIRMED`);
          } catch (error: any) {
            logger.warn(`Could not queue WooCommerce status sync for order ${id}: ${error.message}`);
          }
        }

        // Real-time stock sync to WooCommerce for every product that was
        // decremented during this order's allocation. Without this, WC stays
        // stale until the next 5-minute batch sync and we risk overselling.
        try {
          const productIds = Array.from(
            new Set(
              ((updatedOrder.items as any[]) || [])
                .map((it) => it.productId)
                .filter((pid): pid is string => !!pid)
            )
          );
          if (order.tenantId) {
            for (const productId of productIds) {
              await queueInventorySync(order.tenantId, productId);
            }
            if (productIds.length > 0) {
              logger.info(
                `Queued real-time inventory sync to WP for ${productIds.length} product(s) after order ${id} CONFIRMED`
              );
            }
          }
        } catch (error: any) {
          logger.warn(
            `Could not queue inventory sync after order ${id} CONFIRMED: ${error.message}`
          );
        }

        return updatedOrder;
      });
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

    const updatedOrder = await prisma.order.update({
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

    // Auto-sync status to WooCommerce if order has wordpressId (per-tenant)
    if (order.wordpressId && order.tenantId) {
      try {
        await queueOrderStatusUpdate(order.tenantId, id, data.status);
        logger.info(`Queued WooCommerce status sync for order ${id} -> ${data.status}`);
      } catch (error: any) {
        logger.warn(`Could not queue WooCommerce status sync for order ${id}: ${error.message}`);
      }
    }

    // Notifica email cliente per stati visibili (CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED)
    if (updatedOrder && (updatedOrder as any).customer?.email) {
      try {
        const { isCustomerNotifiable } = await import('../utils/order-state-machine');
        if (isCustomerNotifiable(data.status as any)) {
          const { emailService } = await import('./email.service');
          const statusLabels: Record<string, string> = {
            CONFIRMED: 'Confermato',
            PROCESSING: 'In lavorazione',
            READY: 'Pronto per la spedizione',
            SHIPPED: 'Spedito',
            DELIVERED: 'Consegnato',
            CANCELLED: 'Annullato',
            REFUNDED: 'Rimborsato',
          };
          const customer: any = updatedOrder.customer;
          const customerName =
            customer.businessName ||
            `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
            'Cliente';
          const customerEmail = customer.email as string;

          // Dispatch specifico: SHIPPED e DELIVERED hanno template dedicati con tracking
          if (data.status === 'SHIPPED') {
            const shippingAddress = (updatedOrder as any).shippingAddress || {};
            const items = ((updatedOrder as any).items || []).map((it: any) => ({
              name: it.product?.name || it.productName || 'Articolo',
              quantity: Number(it.quantity) || 0,
              unitPrice: Number(it.unitPrice) || 0,
              total: Number(it.totalPrice ?? it.subtotal ?? 0),
            }));
            await emailService.sendOrderShipped({
              orderNumber: updatedOrder.orderNumber,
              customerName,
              customerEmail,
              items,
              subtotal: Number((updatedOrder as any).subtotal) || 0,
              shipping: Number((updatedOrder as any).shippingCost) || 0,
              tax: Number((updatedOrder as any).taxAmount) || 0,
              total: Number((updatedOrder as any).total) || 0,
              shippingAddress: {
                street: shippingAddress.street || shippingAddress.address1 || '',
                city: shippingAddress.city || '',
                zip: shippingAddress.zip || shippingAddress.postcode || '',
                country: shippingAddress.country || 'IT',
              },
              orderDate: (updatedOrder as any).createdAt || new Date(),
              trackingNumber: (updatedOrder as any).trackingNumber || undefined,
              carrier: (updatedOrder as any).carrier || undefined,
            });
          } else if (data.status === 'DELIVERED') {
            const shippingAddress = (updatedOrder as any).shippingAddress || {};
            await emailService.sendOrderDelivered({
              orderNumber: updatedOrder.orderNumber,
              customerName,
              customerEmail,
              items: [],
              subtotal: 0,
              shipping: 0,
              tax: 0,
              total: Number((updatedOrder as any).total) || 0,
              shippingAddress: {
                street: shippingAddress.street || shippingAddress.address1 || '',
                city: shippingAddress.city || '',
                zip: shippingAddress.zip || shippingAddress.postcode || '',
                country: shippingAddress.country || 'IT',
              },
              orderDate: (updatedOrder as any).createdAt || new Date(),
            });
          } else {
            await emailService.sendOrderStatusUpdate({
              customerEmail,
              customerName,
              orderNumber: updatedOrder.orderNumber,
              oldStatus: order.status,
              newStatus: data.status,
              statusLabel: statusLabels[data.status] || data.status,
              note: data.notes,
            });
          }
        }
      } catch (error: any) {
        logger.warn(`Could not send order status email for ${id}: ${error.message}`);
      }
    }

    return updatedOrder;
  }

  /**
   * Alloca inventario per ordine DENTRO una transazione esistente
   * Usato da updateOrderStatus per garantire atomicità
   */
  private async allocateInventoryInTransaction(tx: any, order: any) {
    for (const item of order.items) {
      // Determina location preferita in base al source (B2B/WEB/EVENTI/...)
      const preferredLocation = this.getPreferredLocation(order.source);

      // 1. Prova nella location preferita
      let inventoryItem = await tx.inventoryItem.findFirst({
        where: {
          productId: item.productId,
          variantId: item.variantId || null,
          location: preferredLocation,
        },
        include: {
          product: true,
          variant: true,
        },
      });

      // 2. FALLBACK: se non trovato nella location preferita, prova WEB
      //    (location universale, normalmente sempre popolata). Questo evita
      //    che gli ordini B2B vengano bloccati quando il warehouse manager
      //    non ha ancora segmentato lo stock per location.
      let actualLocation = preferredLocation;
      if (!inventoryItem && preferredLocation !== 'WEB') {
        inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            productId: item.productId,
            variantId: item.variantId || null,
            location: 'WEB',
          },
          include: {
            product: true,
            variant: true,
          },
        });
        if (inventoryItem) {
          actualLocation = 'WEB';
        }
      }

      // 3. ULTIMO FALLBACK: prendi qualsiasi InventoryItem disponibile per il
      //    prodotto, ordinato per quantita' decrescente (allochiamo dal
      //    magazzino piu' fornito).
      if (!inventoryItem) {
        inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            productId: item.productId,
            variantId: item.variantId || null,
            quantity: { gt: 0 },
          },
          include: {
            product: true,
            variant: true,
          },
          orderBy: { quantity: 'desc' },
        });
        if (inventoryItem) {
          actualLocation = inventoryItem.location;
        }
      }

      // Nome item per messaggi errore
      const itemName = item.variant?.name || item.product?.name || item.sku;

      if (!inventoryItem) {
        throw new Error(
          `${itemName}: nessuna giacenza disponibile in nessun magazzino. Carica stock prima di confermare l'ordine.`
        );
      }

      // Aggiorno la variabile `location` usata sotto dal resto della funzione
      // (al posto della costante originale) per coerenza con la location
      // effettivamente allocata.
      const location = actualLocation;

      // Verifica disponibilità effettiva
      if (inventoryItem.quantity < item.quantity) {
        throw new Error(
          `Stock insufficiente per ${itemName}. Disponibile: ${inventoryItem.quantity}, Richiesto: ${item.quantity}`
        );
      }

      // SCALA effettivamente la quantità
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      // Crea movimento inventario per tracciabilità
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
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

      // Scala anche i materiali BOM
      await this.deductBomMaterialsForItem(tx, item.productId, item.variantId, item.quantity, order.orderNumber);
    }
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
        // Skip items without productId (e.g., WooCommerce orders with unknown products)
        if (!item.productId) continue;

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
      // Skip items without productId (e.g., WooCommerce orders with unknown products)
      if (!item.productId) continue;

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
    const total = subtotal + tax + Number(order.shippingCost || 0) - Number(order.discount || 0);

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
   * Validazione transizioni workflow.
   * Delegata alla state machine in `utils/order-state-machine.ts` per
   * coerenza con il resto del sistema (notifiche, WooCommerce sync).
   */
  private isValidStatusTransition(from: string, to: string): boolean {
    // Lazy import per evitare cicli (state-machine importa solo @prisma/client)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { canTransition } = require('../utils/order-state-machine');
    return canTransition(from, to);
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
        const prodTaxRate = product.taxRate != null ? Number(product.taxRate) : 22;
        const itemTaxRate = (item as any).taxRate ?? prodTaxRate;

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
          const prodTaxRate = product.taxRate != null ? Number(product.taxRate) : 22;
          const itemTaxRate = (item as any).taxRate ?? prodTaxRate;

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
      // Skip items without productId (e.g., WooCommerce orders with unknown products)
      if (!item.productId || !item.product) continue;

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
   * Ottieni suggerimenti di ottimizzazione per ordini pending.
   * Stub: l'implementazione completa (grouping by destination/product, batch
   * suggestions, time savings) è stata rimossa; riattivare quando servirà.
   */
  async getOptimizationSuggestions() {
    return { ordersOptimized: 0, estimatedSavingsEur: 0, suggestions: [], generatedAt: new Date().toISOString() };
  }
}

export const orderService = new OrderService();
export default orderService;