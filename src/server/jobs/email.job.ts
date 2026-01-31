import { Job, Worker, Queue } from 'bullmq';
import { emailService } from '../services/email.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/environment';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// Queue per email
export const emailQueue = new Queue('email', { connection });

// Tipi di job email
type EmailJobType =
  | 'generic'
  | 'order-confirmation'
  | 'order-shipped'
  | 'order-delivered'
  | 'invoice'
  | 'payment-reminder'
  | 'low-stock-alert'
  | 'new-order-notification'
  | 'task-assigned'
  | 'payments-due-summary';

interface EmailJobData {
  type: EmailJobType;
  to?: string | string[];
  subject?: string;
  html?: string;
  orderId?: string;
  invoiceId?: string;
  taskId?: string;
  productIds?: string[];
  data?: any;
}

/**
 * Processor principale per job email
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { type, to, subject, html, orderId, invoiceId, taskId, data } = job.data;

  logger.info(`Processing email job ${job.id}: type=${type}`);

  if (!emailService.isEnabled()) {
    logger.warn('Email service non abilitato, skip job');
    return;
  }

  try {
    switch (type) {
      case 'generic':
        if (!to || !subject || !html) {
          throw new Error('to, subject e html richiesti per email generica');
        }
        await emailService.send({ to, subject, html });
        break;

      case 'order-confirmation':
        if (!orderId) throw new Error('orderId richiesto');
        await processOrderConfirmation(orderId);
        break;

      case 'order-shipped':
        if (!orderId) throw new Error('orderId richiesto');
        await processOrderShipped(orderId, data?.trackingNumber, data?.carrier);
        break;

      case 'order-delivered':
        if (!orderId) throw new Error('orderId richiesto');
        await processOrderDelivered(orderId);
        break;

      case 'invoice':
        if (!invoiceId) throw new Error('invoiceId richiesto');
        await processInvoiceEmail(invoiceId, data?.pdfBuffer);
        break;

      case 'payment-reminder':
        if (!invoiceId) throw new Error('invoiceId richiesto');
        await processPaymentReminder(invoiceId);
        break;

      case 'low-stock-alert':
        await processLowStockAlert(data?.productIds);
        break;

      case 'new-order-notification':
        if (!orderId) throw new Error('orderId richiesto');
        await processNewOrderNotification(orderId);
        break;

      case 'task-assigned':
        if (!taskId) throw new Error('taskId richiesto');
        await processTaskAssigned(taskId);
        break;

      case 'payments-due-summary':
        await processPaymentsDueSummary();
        break;

      default:
        throw new Error(`Tipo job email sconosciuto: ${type}`);
    }

    logger.info(`Email job ${job.id} completato con successo`);
  } catch (error: any) {
    logger.error(`Email job ${job.id} fallito:`, error);
    throw error;
  }
}

/**
 * Processa email conferma ordine
 */
async function processOrderConfirmation(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order || !order.customer.email) {
    throw new Error('Ordine o email cliente non trovati');
  }

  const shippingAddress = order.shippingAddress as any || {};

  await emailService.sendOrderConfirmation({
    orderNumber: order.orderNumber,
    customerName: `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.businessName || 'Cliente',
    customerEmail: order.customer.email,
    items: order.items.map(item => ({
      name: item.productName || item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    shippingAddress: {
      street: shippingAddress.address1 || shippingAddress.street || '',
      city: shippingAddress.city || '',
      zip: shippingAddress.postcode || shippingAddress.zip || '',
      country: shippingAddress.country || 'Italia',
    },
    orderDate: order.orderDate,
  });
}

/**
 * Processa email ordine spedito
 */
async function processOrderShipped(orderId: string, trackingNumber?: string, carrier?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order || !order.customer.email) {
    throw new Error('Ordine o email cliente non trovati');
  }

  const shippingAddress = order.shippingAddress as any || {};

  await emailService.sendOrderShipped({
    orderNumber: order.orderNumber,
    customerName: `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.businessName || 'Cliente',
    customerEmail: order.customer.email,
    items: order.items.map(item => ({
      name: item.productName || item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    shippingAddress: {
      street: shippingAddress.address1 || shippingAddress.street || '',
      city: shippingAddress.city || '',
      zip: shippingAddress.postcode || shippingAddress.zip || '',
      country: shippingAddress.country || 'Italia',
    },
    orderDate: order.orderDate,
    trackingNumber,
    carrier,
  });
}

/**
 * Processa email ordine consegnato
 */
async function processOrderDelivered(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order || !order.customer.email) {
    throw new Error('Ordine o email cliente non trovati');
  }

  const shippingAddress = order.shippingAddress as any || {};

  await emailService.sendOrderDelivered({
    orderNumber: order.orderNumber,
    customerName: `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.businessName || 'Cliente',
    customerEmail: order.customer.email,
    items: order.items.map(item => ({
      name: item.productName || item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    shippingAddress: {
      street: shippingAddress.address1 || shippingAddress.street || '',
      city: shippingAddress.city || '',
      zip: shippingAddress.postcode || shippingAddress.zip || '',
      country: shippingAddress.country || 'Italia',
    },
    orderDate: order.orderDate,
  });
}

/**
 * Processa email fattura
 */
async function processInvoiceEmail(invoiceId: string, pdfBuffer?: Buffer) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
    },
  });

  if (!invoice || !invoice.customer?.email) {
    throw new Error('Fattura o email cliente non trovati');
  }

  await emailService.sendInvoice({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer.businessName || `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim(),
    customerEmail: invoice.customer.email,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    total: Number(invoice.total),
    pdfBuffer,
  });
}

/**
 * Processa promemoria pagamento
 */
async function processPaymentReminder(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
    },
  });

  if (!invoice || !invoice.customer?.email) {
    throw new Error('Fattura o email cliente non trovati');
  }

  const today = new Date();
  const daysOverdue = Math.floor((today.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));

  await emailService.sendPaymentReminder({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer.businessName || `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim(),
    customerEmail: invoice.customer.email,
    amount: Number(invoice.total) - Number(invoice.paidAmount),
    dueDate: invoice.dueDate,
    daysOverdue: daysOverdue > 0 ? daysOverdue : undefined,
  });
}

/**
 * Processa alert scorte basse
 */
async function processLowStockAlert(productIds?: string[]) {
  const where: any = {};

  if (productIds && productIds.length > 0) {
    where.productId = { in: productIds };
  }

  // Trova prodotti con scorte basse
  const lowStockItems = await prisma.$queryRaw<Array<{
    sku: string;
    name: string;
    location: string;
    quantity: number;
    minStock: number;
  }>>`
    SELECT
      p.sku,
      p.name,
      i.location,
      i.quantity - i.reserved_quantity as quantity,
      p.min_stock as "minStock"
    FROM inventory_items i
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity - i.reserved_quantity <= p.min_stock
    AND p.min_stock > 0
    AND p.is_active = true
    ORDER BY (i.quantity - i.reserved_quantity - p.min_stock) ASC
    LIMIT 50
  `;

  if (lowStockItems.length === 0) {
    logger.info('Nessun prodotto con scorte basse');
    return;
  }

  // Trova destinatari (admin e magazzinieri)
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'MANAGER', 'MAGAZZINIERE'] },
      isActive: true,
          },
    select: { email: true },
  });

  if (recipients.length === 0) {
    logger.warn('Nessun destinatario per alert scorte basse');
    return;
  }

  await emailService.sendLowStockAlert(
    {
      products: lowStockItems.map(item => ({
        sku: item.sku,
        name: item.name,
        currentStock: Number(item.quantity),
        minStock: item.minStock,
        location: item.location,
      })),
    },
    recipients.map(r => r.email!)
  );
}

/**
 * Processa notifica nuovo ordine
 */
async function processNewOrderNotification(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
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

  // Trova destinatari
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'MANAGER', 'COMMERCIALE'] },
      isActive: true,
          },
    select: { email: true },
  });

  if (recipients.length === 0) return;

  const shippingAddress = order.shippingAddress as any || {};

  await emailService.sendNewOrderNotification(
    {
      orderNumber: order.orderNumber,
      customerName: order.customer.businessName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim(),
      customerEmail: order.customer.email || '',
      items: order.items.map(item => ({
        name: item.productName || item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      tax: Number(order.tax),
      total: Number(order.total),
      shippingAddress: {
        street: shippingAddress.address1 || shippingAddress.street || '',
        city: shippingAddress.city || '',
        zip: shippingAddress.postcode || shippingAddress.zip || '',
        country: shippingAddress.country || 'Italia',
      },
      orderDate: order.orderDate,
    },
    recipients.map(r => r.email!)
  );
}

/**
 * Processa task assegnato
 */
async function processTaskAssigned(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: true,
    },
  });

  if (!task || !task.assignedTo?.email) {
    throw new Error('Task o email assegnatario non trovati');
  }

  await emailService.sendTaskAssigned(
    task.assignedTo.email,
    `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
    task.title,
    task.description || '',
    task.dueDate || undefined,
    task.priority
  );
}

/**
 * Processa riepilogo scadenze pagamenti
 */
async function processPaymentsDueSummary() {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Trova fatture in scadenza o scadute
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      dueDate: { lte: nextWeek },
    },
    include: {
      customer: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  if (invoices.length === 0) {
    logger.info('Nessuna fattura in scadenza');
    return;
  }

  // Trova destinatari
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'MANAGER', 'CONTABILE'] },
      isActive: true,
          },
    select: { email: true },
  });

  if (recipients.length === 0) return;

  const payments = invoices.map(inv => {
    const daysUntilDue = Math.floor((inv.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return {
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer?.businessName || `${inv.customer?.firstName || ''} ${inv.customer?.lastName || ''}`.trim() || 'N/A',
      amount: Number(inv.total) - Number(inv.paidAmount),
      dueDate: inv.dueDate,
      daysUntilDue,
    };
  });

  await emailService.sendPaymentsDueSummary(
    recipients.map(r => r.email!),
    payments
  );
}

/**
 * Inizializza worker email
 */
export function initEmailWorker() {
  const worker = new Worker<EmailJobData>(
    'email',
    processEmailJob,
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 1000, // Max 5 email al secondo
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Email job ${job.id} completato`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} fallito:`, err);
  });

  return worker;
}

/**
 * Schedula job email periodici
 */
export async function scheduleEmailJobs() {
  // Check scorte basse ogni ora
  await emailQueue.add(
    'scheduled-low-stock-check',
    { type: 'low-stock-alert' },
    {
      repeat: {
        pattern: '0 * * * *', // Ogni ora
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Riepilogo scadenze pagamenti ogni giorno alle 9:00
  await emailQueue.add(
    'scheduled-payments-due',
    { type: 'payments-due-summary' },
    {
      repeat: {
        pattern: '0 9 * * *', // Ogni giorno alle 9:00
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  logger.info('Email scheduled jobs configurati');
}

// =============================================
// HELPER FUNCTIONS PER QUEUE
// =============================================

/**
 * Aggiunge job email conferma ordine
 */
export async function queueOrderConfirmation(orderId: string) {
  await emailQueue.add(
    `order-confirmation-${orderId}`,
    { type: 'order-confirmation', orderId },
    { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}

/**
 * Aggiunge job email ordine spedito
 */
export async function queueOrderShipped(orderId: string, trackingNumber?: string, carrier?: string) {
  await emailQueue.add(
    `order-shipped-${orderId}`,
    { type: 'order-shipped', orderId, data: { trackingNumber, carrier } },
    { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}

/**
 * Aggiunge job email fattura
 */
export async function queueInvoiceEmail(invoiceId: string, pdfBuffer?: Buffer) {
  await emailQueue.add(
    `invoice-${invoiceId}`,
    { type: 'invoice', invoiceId, data: { pdfBuffer } },
    { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}

/**
 * Aggiunge job promemoria pagamento
 */
export async function queuePaymentReminder(invoiceId: string) {
  await emailQueue.add(
    `payment-reminder-${invoiceId}`,
    { type: 'payment-reminder', invoiceId },
    { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}

/**
 * Aggiunge job notifica task assegnato
 */
export async function queueTaskAssigned(taskId: string) {
  await emailQueue.add(
    `task-assigned-${taskId}`,
    { type: 'task-assigned', taskId },
    { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}
