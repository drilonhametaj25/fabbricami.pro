// Imports
import queueManager from '../services/queue.service';
import { prisma } from '../config/database';
import notificationService from '../services/notification.service';
import logger from '../config/logger';

/**
 * Notification Jobs
 * Job processors per controllo automatico e invio notifiche
 */

/**
 * Controlla scorte minime e invia notifiche
 */
export async function checkLowStockJob(_job: unknown): Promise<void> {
  try {
    logger.info('Checking low stock levels...');

    // Trova prodotti sotto scorta minima
    const lowStockProducts = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.min_stock,
        SUM(i.quantity) as current_stock
      FROM products p
      LEFT JOIN inventory_items i ON i.product_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id
      HAVING SUM(COALESCE(i.quantity, 0)) <= p.min_stock
    `;

    logger.info(`Found ${lowStockProducts.length} products with low stock`);

    // Invia notifica per ogni prodotto
    for (const product of lowStockProducts) {
      await notificationService.notifyLowStock(
        product.id,
        product.name,
        product.current_stock || 0,
        product.min_stock
      );
    }

    logger.info('Low stock check completed');
  } catch (error: any) {
    logger.error(`Low stock check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Controlla pagamenti in scadenza e invia notifiche
 */
export async function checkPaymentsDueJob(_job: unknown): Promise<void> {
  try {
    logger.info('Checking payments due...');

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Trova fatture in scadenza nei prossimi 3 giorni
    const dueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: {
          gte: new Date(),
          lte: threeDaysFromNow,
        },
      },
      include: {
        customer: true,
      },
    });

    logger.info(`Found ${dueInvoices.length} invoices due in 3 days`);

    for (const invoice of dueInvoices) {
      await notificationService.notifyPaymentDue(
        invoice.id,
        invoice.invoiceNumber,
        Number(invoice.total),
        invoice.dueDate
      );
    }

    // Trova fatture scadute
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: {
          lt: new Date(),
        },
      },
    });

    logger.info(`Found ${overdueInvoices.length} overdue invoices`);

    for (const invoice of overdueInvoices) {
      // Aggiorna stato se non già fatto
      if (invoice.status !== 'OVERDUE') {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'OVERDUE' },
        });
      }

      await notificationService.notifyPaymentOverdue(
        invoice.id,
        invoice.invoiceNumber,
        Number(invoice.total)
      );
    }

    logger.info('Payments due check completed');
  } catch (error: any) {
    logger.error(`Payments due check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Controlla task scaduti e invia notifiche
 */
export async function checkOverdueTasksJob(_job: unknown): Promise<void> {
  try {
    logger.info('Checking overdue tasks...');

    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: {
          lt: new Date(),
        },
      },
      include: {
        assignedTo: true,
      },
    });

    logger.info(`Found ${overdueTasks.length} overdue tasks`);

    for (const task of overdueTasks) {
      if (task.assignedTo) {
        await notificationService.notifyTaskOverdue(
          task.assignedToId!,
          task.id,
          task.title
        );
      }
    }

    logger.info('Overdue tasks check completed');
  } catch (error: any) {
    logger.error(`Overdue tasks check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Controlla reminder calendario e invia notifiche
 */
export async function checkCalendarRemindersJob(_job: unknown): Promise<void> {
  try {
    logger.info('Checking calendar reminders...');

    const now = new Date();
    const in15Minutes = new Date(now.getTime() + 15 * 60000);

    const upcomingEvents = await prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: now,
          lte: in15Minutes,
        },
        reminderMinutes: { not: null },
      },
    });

    logger.info(`Found ${upcomingEvents.length} upcoming events with reminders`);

    for (const event of upcomingEvents) {
      // TODO: Invia notifica agli utenti interessati
      logger.info(`Reminder for event: ${event.title}`);
    }

    logger.info('Calendar reminders check completed');
  } catch (error: any) {
    logger.error(`Calendar reminders check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Inizializza worker e job ricorrenti per notifiche
 */
export function initNotificationJobs() {
  // Crea worker
  queueManager.createWorker('notifications', async (job) => {
    switch (job.data.type) {
      case 'low-stock':
        return checkLowStockJob(job);
      case 'payment-due':
        return checkPaymentsDueJob(job);
      case 'task-overdue':
        return checkOverdueTasksJob(job);
      case 'calendar-reminder':
        return checkCalendarRemindersJob(job);
      default:
        logger.warn(`Unknown notification job type: ${job.data.type}`);
    }
  }, 2);

  // Schedula job ricorrenti
  // Controlla scorte minime ogni ora
  queueManager.addRecurringJob(
    'notifications',
    'check-low-stock',
    { type: 'low-stock' },
    '0 * * * *' // Ogni ora
  );

  // Controlla pagamenti in scadenza ogni mattina alle 9
  queueManager.addRecurringJob(
    'notifications',
    'check-payments-due',
    { type: 'payment-due' },
    '0 9 * * *' // Ogni giorno alle 9:00
  );

  // Controlla task scaduti ogni 2 ore
  queueManager.addRecurringJob(
    'notifications',
    'check-overdue-tasks',
    { type: 'task-overdue' },
    '0 */2 * * *' // Ogni 2 ore
  );

  // Controlla reminder calendario ogni 15 minuti
  queueManager.addRecurringJob(
    'notifications',
    'check-calendar-reminders',
    { type: 'calendar-reminder' },
    '*/15 * * * *' // Ogni 15 minuti
  );

  logger.info('Notification jobs initialized');
}
