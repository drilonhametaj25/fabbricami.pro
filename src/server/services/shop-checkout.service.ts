import { PrismaClient, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

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

      // Decrease stock for each item (using wcStockQuantity or similar field)
      for (const item of cart.items) {
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

      // Award loyalty points (1 point per EUR)
      const pointsEarned = Math.floor(total.toNumber());
      const loyaltyAccount = await tx.loyaltyAccount.findUnique({
        where: { customerId },
      });

      if (loyaltyAccount) {
        await tx.loyaltyAccount.update({
          where: { customerId },
          data: {
            points: { increment: pointsEarned },
            totalEarned: { increment: pointsEarned },
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            accountId: loyaltyAccount.id,
            orderId: newOrder.id,
            type: 'EARN',
            points: pointsEarned,
            balanceAfter: loyaltyAccount.points + pointsEarned,
            description: `Punti guadagnati per ordine ${newOrder.orderNumber}`,
          } as any,
        });
      }

      // Delete cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.shoppingCart.delete({ where: { id: cart.id } });

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

    // TODO: Send status update email to customer

    return order;
  }

  /**
   * Update order payment status
   */
  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus, transactionId?: string): Promise<any> {
    const updateData: any = {};

    if (paymentStatus === 'CAPTURED') {
      updateData.status = OrderStatus.CONFIRMED;
      updateData.paidAt = new Date();
    } else if (paymentStatus === 'FAILED') {
      updateData.status = OrderStatus.CANCELLED;
    }

    // Update order
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Create payment transaction record
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        provider: 'STRIPE', // or PAYPAL based on context
        transactionId: transactionId || uuidv4(),
        status: paymentStatus,
        amount: order.total,
        currency: (order as any).wcCurrency || 'EUR',
      },
    });

    return order;
  }

  /**
   * Cancel order
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

    // Restore stock
    await prisma.$transaction(async (tx) => {
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

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason,
        } as any,
      });

      // Reverse loyalty points if earned
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
