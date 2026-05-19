import { PrismaClient, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { emailService } from './email.service';
import { logger } from '../config/logger';
import { isCustomerNotifiable } from '../utils/order-state-machine';

const prisma = new PrismaClient();

export interface CheckoutData {
  cartId: string;
  customerId?: string;
  email: string;
  phone?: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  billingAddress?: {
    firstName: string;
    lastName: string;
    company?: string;
    address: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethodId: string;
  paymentMethod: 'stripe' | 'paypal';
  notes?: string;
  newsletter?: boolean;
}

export interface OrderResult {
  order: any;
  paymentUrl?: string;
  clientSecret?: string;
}

class ShopCheckoutService {
  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${year}${month}-${random}`;
  }

  /**
   * Create order from cart
   */
  async createOrder(data: CheckoutData): Promise<OrderResult> {
    // Get cart with items
    const cart = await prisma.shoppingCart.findUnique({
      where: { id: data.cartId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        coupon: true,
        shippingMethod: true,
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error('Carrello vuoto o non trovato');
    }

    // Get shipping method
    const shippingMethod = await prisma.shopShippingMethod.findUnique({
      where: { id: data.shippingMethodId },
    });

    if (!shippingMethod) {
      throw new Error('Metodo di spedizione non valido');
    }

    // Calculate totals
    let subtotal = new Prisma.Decimal(0);
    const orderItems: any[] = [];

    for (const item of cart.items) {
      const product = item.product;
      const variant = item.variant;

      // Check stock availability
      const stockQuantity = (variant as any)?.stockQuantity ?? (product as any).stockQuantity ?? 0;
      if (stockQuantity < item.quantity) {
        throw new Error(`Quantità insufficiente per ${product.name}`);
      }

      const unitPrice = (variant as any)?.price ?? (product as any).wcSalePrice ?? product.price;
      const totalPrice = new Prisma.Decimal(unitPrice.toString()).mul(item.quantity);

      subtotal = subtotal.add(totalPrice);

      orderItems.push({
        productId: product.id,
        variantId: variant?.id,
        productName: product.name,
        variantName: variant?.name,
        sku: variant?.sku ?? product.sku,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });
    }

    // Calculate discount
    let discountAmount = new Prisma.Decimal(0);
    if (cart.coupon) {
      if (cart.coupon.type === 'PERCENTAGE') {
        discountAmount = subtotal.mul(cart.coupon.discountValue).div(100);
      } else if (cart.coupon.type === 'FIXED') {
        discountAmount = cart.coupon.discountValue;
      }
      // Ensure discount doesn't exceed subtotal
      if (discountAmount.greaterThan(subtotal)) {
        discountAmount = subtotal;
      }
    }

    // Calculate shipping
    const shippingCost = shippingMethod.baseCost;

    // Calculate tax (22% VAT for Italy)
    const taxableAmount = subtotal.sub(discountAmount);
    const taxRate = data.shippingAddress.country === 'IT' ? new Prisma.Decimal('0.22') : new Prisma.Decimal('0');
    const taxAmount = taxableAmount.mul(taxRate);

    // Calculate total
    const total = taxableAmount.add(shippingCost).add(taxAmount);

    // Get or create customer
    let customerId = data.customerId;
    if (!customerId) {
      // Check if customer exists with this email
      let customer = await prisma.customer.findFirst({
        where: { email: data.email.toLowerCase() },
      });

      if (!customer) {
        // Generate code for new customer
        const lastCustomer = await prisma.customer.findFirst({
          where: { code: { startsWith: 'GUEST-' } },
          orderBy: { code: 'desc' },
        });
        let nextNum = 1;
        if (lastCustomer) {
          const match = lastCustomer.code.match(/GUEST-(\d+)/);
          if (match) nextNum = parseInt(match[1]) + 1;
        }

        // Create guest customer
        customer = await prisma.customer.create({
          data: {
            code: `GUEST-${nextNum.toString().padStart(6, '0')}`,
            type: 'B2C',
            email: data.email.toLowerCase(),
            firstName: data.shippingAddress.firstName,
            lastName: data.shippingAddress.lastName,
            phone: data.phone,
            isActive: true,
          },
        });
      }

      customerId = customer.id;
    }

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          customerId,
          status: OrderStatus.PENDING,
          subtotal,
          discount: discountAmount,
          shipping: shippingCost,
          tax: taxAmount,
          total,
          wcCurrency: 'EUR',
          shippingAddress: data.shippingAddress as any,
          billingAddress: (data.billingAddress || data.shippingAddress) as any,
          customerNote: data.notes,
          couponCode: cart.coupon?.code,
          items: {
            create: orderItems,
          },
        } as any,
        include: {
          items: true,
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      // NOTE: Stock is NOT decremented here anymore (BUG-001 fix)
      // Stock will be decremented when payment is confirmed in updatePaymentStatus()
      // This prevents stock being held for unpaid orders

      // Record coupon usage
      if (cart.coupon) {
        await tx.couponUsage.create({
          data: {
            couponId: cart.coupon.id,
            customerId,
            orderId: newOrder.id,
            discountAmount: discountAmount,
          } as any,
        });

        await tx.coupon.update({
          where: { id: cart.coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      // NOTE: Loyalty points are NOT awarded here anymore (BUG-002 fix)
      // Points will be awarded when payment is confirmed in updatePaymentStatus()
      // This prevents awarding points for unpaid orders

      // NOTE: Cart is NOT deleted here anymore (BUG-007 fix)
      // Cart will be deleted when payment is confirmed
      // Store cartId in order notes for later cleanup
      await tx.order.update({
        where: { id: newOrder.id },
        data: {
          notes: `[CART:${cart.id}]${data.notes ? ` ${data.notes}` : ''}`,
        },
      });

      return newOrder;
    });

    // Subscribe to newsletter if opted in
    if (data.newsletter) {
      try {
        await prisma.newsletterSubscription.upsert({
          where: { email: data.email.toLowerCase() },
          create: {
            email: data.email.toLowerCase(),
            customerId,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
          update: {},
        });
      } catch {
        // Ignore newsletter errors
      }
    }

    return { order };
  }

  /**
   * Get order by ID or order number
   */
  async getOrder(identifier: string): Promise<any> {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: identifier },
          { orderNumber: identifier },
        ],
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, images: true },
            },
          },
        },
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return order;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<any> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: true,
        customer: true,
      },
    });

    // Invia notifica al cliente se lo stato e' tra quelli "notifiable"
    // (CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED/REFUNDED).
    if (order.customer?.email && isCustomerNotifiable(status)) {
      const statusLabels: Record<string, string> = {
        CONFIRMED: 'Confermato',
        PROCESSING: 'In lavorazione',
        READY: 'Pronto per la spedizione',
        SHIPPED: 'Spedito',
        DELIVERED: 'Consegnato',
        CANCELLED: 'Annullato',
        REFUNDED: 'Rimborsato',
      };
      const customerName =
        order.customer.businessName ||
        `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() ||
        'Cliente';

      try {
        await emailService.sendOrderStatusUpdate({
          customerEmail: order.customer.email,
          customerName,
          orderNumber: order.orderNumber,
          oldStatus: '',
          newStatus: status,
          statusLabel: statusLabels[status] || status,
        });
      } catch (err: any) {
        logger.error(`Order status update email failed for ${orderId}: ${err.message}`);
      }
    }

    return order;
  }

  /**
   * Update order payment status
   * When payment is CAPTURED: decrement stock, award loyalty points, delete cart
   * When payment FAILED: just mark order as cancelled (stock was never decremented)
   */
  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus, _transactionId?: string): Promise<any> {
    // Get order with items and customer for stock/loyalty operations
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    // Don't process if already in a final state
    if (['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      return order;
    }

    if (paymentStatus === PaymentStatus.CAPTURED) {
      // Payment successful - process the order
      await prisma.$transaction(async (tx) => {
        // 1. Update order status
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CONFIRMED,
            wcDatePaid: new Date(),
          },
        });

        // 2. Decrement stock through InventoryItem (location WEB) — same model
        // used by the B2B flow (allocateInventoryInTransaction in order.service).
        //
        // The previous implementation decremented `product.wcStockQuantity` /
        // `productVariant.wcStockQuantity` which kept TWO disconnected stock
        // counters in the DB (one for the shop frontend, one for the warehouse).
        // The two drifted with every B2C sale, then WordPress sync pushed the
        // wrong number and the shop was constantly out of sync with the ERP.
        // Now every channel decrements the same `InventoryItem` rows and
        // every stock change emits an `InventoryMovement` for traceability.
        for (const item of order.items) {
          if (!item.productId) continue;

          const inventoryItem = await tx.inventoryItem.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              location: 'WEB',
            },
          });

          if (!inventoryItem) {
            throw new Error(
              `Stock non disponibile in WEB per il prodotto richiesto (orderItem ${item.id})`
            );
          }

          if (inventoryItem.quantity < item.quantity) {
            throw new Error(
              `Stock insufficiente per il prodotto (disponibile ${inventoryItem.quantity}, richiesto ${item.quantity})`
            );
          }

          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              quantity: { decrement: item.quantity },
            },
          });

          // Audit trail movement
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId || null,
              type: 'OUT',
              quantity: -item.quantity,
              fromLocation: 'WEB',
              reference: order.orderNumber,
              notes: `Vendita B2C ${order.orderNumber} (checkout shop)`,
            },
          });

          // Keep wcStockQuantity in sync (it's used by the shop UI for
          // optimistic stock display); the WP queueInventorySync below will
          // push the same value to WooCommerce.
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                wcStockQuantity: { decrement: item.quantity },
              } as any,
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                wcStockQuantity: { decrement: item.quantity },
              } as any,
            });
          }
        }

        // 3. Award loyalty points (BUG-002 fix: now happens after payment)
        if (order.customerId) {
          const pointsEarned = Math.floor(Number(order.total));
          const loyaltyAccount = await tx.loyaltyAccount.findUnique({
            where: { customerId: order.customerId },
          });

          if (loyaltyAccount) {
            await tx.loyaltyAccount.update({
              where: { customerId: order.customerId },
              data: {
                points: { increment: pointsEarned },
                totalEarned: { increment: pointsEarned },
              },
            });

            await tx.loyaltyTransaction.create({
              data: {
                accountId: loyaltyAccount.id,
                orderId: order.id,
                type: 'EARN',
                points: pointsEarned,
                balanceAfter: loyaltyAccount.points + pointsEarned,
                description: `Punti guadagnati per ordine ${order.orderNumber}`,
              } as any,
            });
          }
        }

        // 4. Delete cart if stored in order notes (BUG-007 fix)
        const cartIdMatch = order.notes?.match(/\[CART:([^\]]+)\]/);
        if (cartIdMatch) {
          const cartId = cartIdMatch[1];
          try {
            await tx.cartItem.deleteMany({ where: { cartId } });
            await tx.shoppingCart.delete({ where: { id: cartId } });
          } catch {
            // Cart may already be deleted or not exist, ignore
          }

          // Clean up the cart reference from notes
          await tx.order.update({
            where: { id: orderId },
            data: {
              notes: order.notes?.replace(/\[CART:[^\]]+\]\s*/, '') || null,
            },
          });
        }
      });

      // 5. Trigger email confirmation ordine (best-effort, fuori transazione)
      try {
        const { queueOrderConfirmation } = await import('../jobs/email.job');
        await queueOrderConfirmation(orderId);
      } catch (err: any) {
        logger.error(`Failed to queue order confirmation email for ${orderId}: ${err.message}`);
      }

      // 6. Sync order status a WordPress se ordine collegato a WP
      if (order.wordpressId) {
        try {
          const { queueOrderStatusUpdate } = await import('../jobs/wordpress.job');
          await queueOrderStatusUpdate(orderId, 'CONFIRMED');
        } catch (err: any) {
          logger.error(`Failed to queue WP order status sync for ${orderId}: ${err.message}`);
        }
      }

      // 7. Real-time WP stock sync for each product whose stock changed,
      // so the shop on WooCommerce reflects the new InventoryItem WEB level
      // immediately (instead of waiting for the 5-min batch sync).
      // Skipped in test env to avoid loading BullMQ/Redis from unit tests.
      if (process.env.NODE_ENV !== 'test') {
        try {
          const { queueInventorySync } = await import('../jobs/wordpress.job');
          const productIds = Array.from(
            new Set(
              order.items
                .map((it) => it.productId)
                .filter((pid): pid is string => !!pid)
            )
          );
          for (const productId of productIds) {
            await queueInventorySync(productId);
          }
        } catch (err: any) {
          logger.error(
            `Failed to queue WP inventory sync after B2C checkout ${orderId}: ${err.message}`
          );
        }
      }

    } else if (paymentStatus === PaymentStatus.FAILED) {
      // Payment failed - cancel order (no stock to restore since we didn't decrement)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // Delete cart if stored (customer can start fresh)
      const cartIdMatch = order.notes?.match(/\[CART:([^\]]+)\]/);
      if (cartIdMatch) {
        const cartId = cartIdMatch[1];
        try {
          await prisma.cartItem.deleteMany({ where: { cartId } });
          await prisma.shoppingCart.delete({ where: { id: cartId } });
        } catch {
          // Ignore cart deletion errors
        }
      }

      // Notifica cliente del pagamento fallito (se email customer)
      if (order.customer?.email) {
        try {
          const customerName =
            order.customer.businessName ||
            `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() ||
            'Cliente';
          await emailService.sendOrderPaymentFailed({
            customerEmail: order.customer.email,
            customerName,
            orderNumber: order.orderNumber,
            amount: Number(order.total),
            reason: 'Il pagamento non e\' stato autorizzato',
          });
        } catch (err: any) {
          logger.error(`Failed to send payment failed email for ${orderId}: ${err.message}`);
        }
      }
    }

    // Return updated order
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });
  }

  /**
   * Cancel order
   * Only restores stock and reverses loyalty if order was CONFIRMED (paid)
   * PENDING orders don't have stock/points to reverse since payment wasn't captured
   */
  async cancelOrder(orderId: string, reason?: string): Promise<any> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Ordine non trovato');
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new Error('Impossibile annullare questo ordine');
    }

    // Only restore stock/points if order was CONFIRMED (payment was captured)
    const shouldRestoreStock = order.status === OrderStatus.CONFIRMED;

    await prisma.$transaction(async (tx) => {
      if (shouldRestoreStock) {
        // Restore stock only for paid orders (stock was decremented)
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { wcStockQuantity: { increment: item.quantity } } as any,
            });
          } else if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { wcStockQuantity: { increment: item.quantity } } as any,
            });
          }
        }

        // Reverse loyalty points only for paid orders
        const loyaltyTx = await tx.loyaltyTransaction.findFirst({
          where: { orderId, type: 'EARN' },
          include: { account: true },
        });

        if (loyaltyTx && loyaltyTx.account) {
          await tx.loyaltyAccount.update({
            where: { id: loyaltyTx.account.id },
            data: { points: { decrement: loyaltyTx.points } },
          });

          await tx.loyaltyTransaction.create({
            data: {
              accountId: loyaltyTx.account.id,
              orderId,
              type: 'EXPIRE',
              points: -loyaltyTx.points,
              balanceAfter: loyaltyTx.account.points - loyaltyTx.points,
              description: `Punti annullati per ordine cancellato ${order.orderNumber}`,
            } as any,
          });
        }
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason,
        } as any,
      });

      // Delete cart if it was stored and still exists
      const cartIdMatch = order.notes?.match(/\[CART:([^\]]+)\]/);
      if (cartIdMatch) {
        const cartId = cartIdMatch[1];
        try {
          await tx.cartItem.deleteMany({ where: { cartId } });
          await tx.shoppingCart.delete({ where: { id: cartId } });
        } catch {
          // Cart may already be deleted, ignore
        }
      }
    });

    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  }

  /**
   * Track order by order number
   */
  async trackOrder(orderNumber: string, email?: string): Promise<any> {
    const where: any = { orderNumber };

    // If email provided, verify it matches
    if (email) {
      const order = await prisma.order.findFirst({
        where: { orderNumber },
        include: { customer: true },
      });

      if (!order || order.customer?.email?.toLowerCase() !== email.toLowerCase()) {
        throw new Error('Ordine non trovato');
      }
    }

    return prisma.order.findFirst({
      where,
      select: {
        orderNumber: true,
        status: true,
        createdAt: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedDate: true,
        deliveredDate: true,
        items: {
          select: {
            productName: true,
            quantity: true,
          },
        },
      },
    });
  }
}

export const shopCheckoutService = new ShopCheckoutService();
