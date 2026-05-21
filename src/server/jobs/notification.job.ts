// Imports
import queueManager from '../services/queue.service';
import { prisma } from '../config/database';
import notificationService from '../services/notification.service';
import logger from '../config/logger';
import { requireCurrentTenantId } from '../middleware/tenant.middleware';
import { forEachActiveTenant } from '../utils/tenant-fanout';

/**
 * Notification Jobs
 * Job processors per controllo automatico e invio notifiche.
 *
 * Multi-tenant: ogni job esegue `forEachActiveTenant` per scoping per-tenant
 * delle query (altrimenti il middleware Prisma $extends lascia passare
 * unfiltered in default mode o crasha in STRICT mode).
 */

/**
 * Controlla scorte minime e invia notifiche (per ogni tenant)
 */
export async function checkLowStockJob(_job: unknown): Promise<void> {
  logger.info('Checking low stock levels (multi-tenant)...');
  await forEachActiveTenant(async (_tenantId, tenantSlug) => {
    const tenantId = requireCurrentTenantId();
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
        AND p.tenant_id = ${tenantId}
      GROUP BY p.id
      HAVING SUM(COALESCE(i.quantity, 0)) <= p.min_stock
    `;

    logger.info(`[${tenantSlug}] ${lowStockProducts.length} products with low stock`);

    for (const product of lowStockProducts) {
      await notificationService.notifyLowStock(
        product.id,
        product.name,
        product.current_stock || 0,
        product.min_stock
      );
    }
  });
  logger.info('Low stock check completed');
}

/**
 * Controlla pagamenti in scadenza e invia notifiche (per ogni tenant)
 */
export async function checkPaymentsDueJob(_job: unknown): Promise<void> {
  logger.info('Checking payments due (multi-tenant)...');
  await forEachActiveTenant(async (_tenantId, tenantSlug) => {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Query auto-scoped via Prisma $extends middleware (tenant context attivo)
    const dueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: {
          gte: new Date(),
          lte: threeDaysFromNow,
        },
      },
      include: { customer: true },
    });

    logger.info(`[${tenantSlug}] ${dueInvoices.length} invoices due in 3 days`);

    for (const invoice of dueInvoices) {
      await notificationService.notifyPaymentDue(
        invoice.id,
        invoice.invoiceNumber,
        Number(invoice.total),
        invoice.dueDate
      );
    }

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
    });

    logger.info(`[${tenantSlug}] ${overdueInvoices.length} overdue invoices`);

    for (const invoice of overdueInvoices) {
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
  });
  logger.info('Payments due check completed');
}

/**
 * Controlla task scaduti e invia notifiche (per ogni tenant)
 */
export async function checkOverdueTasksJob(_job: unknown): Promise<void> {
  logger.info('Checking overdue tasks (multi-tenant)...');
  await forEachActiveTenant(async (_tenantId, tenantSlug) => {
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() },
      },
      include: { assignedTo: true },
    });

    logger.info(`[${tenantSlug}] ${overdueTasks.length} overdue tasks`);

    for (const task of overdueTasks) {
      if (task.assignedTo) {
        await notificationService.notifyTaskOverdue(
          task.assignedToId!,
          task.id,
          task.title
        );
      }
    }
  });
  logger.info('Overdue tasks check completed');
}

/**
 * Controlla reminder calendario e invia notifiche (per ogni tenant).
 */
export async function checkCalendarRemindersJob(_job: unknown): Promise<void> {
  logger.info('Checking calendar reminders (multi-tenant)...');

  const now = new Date();
  const in15Minutes = new Date(now.getTime() + 15 * 60000);
  let totalNotified = 0;

  await forEachActiveTenant(async (_tenantId, _tenantSlug) => {
    const upcomingEvents = await prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: now, lte: in15Minutes },
        reminderMinutes: { not: null },
      },
    });

    if (upcomingEvents.length === 0) return;

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['ADMIN', 'MANAGER', 'OPERATORE', 'COMMERCIALE'] },
      },
      select: { id: true },
    });

    if (users.length === 0) return;

    const { default: notify } = await import('../services/notification.service');
    for (const event of upcomingEvents) {
      const startTime = event.startDate.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      });
      await notify.notifyMultipleUsers({
        userIds: users.map((u) => u.id),
        type: 'CALENDAR_EVENT',
        title: `Promemoria evento: ${event.title}`,
        message: `Inizia alle ${startTime}${event.location ? ` - ${event.location}` : ''}`,
        link: '/calendar',
      });
      totalNotified++;
    }
  });

  logger.info(`Calendar reminders check completed: ${totalNotified} events notified`);
}

/**
 * Inizializza worker e job ricorrenti per notifiche
 */
export function initNotificationJobs() {
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

  queueManager.addRecurringJob('notifications', 'check-low-stock', { type: 'low-stock' }, '0 * * * *');
  queueManager.addRecurringJob('notifications', 'check-payments-due', { type: 'payment-due' }, '0 9 * * *');
  queueManager.addRecurringJob('notifications', 'check-overdue-tasks', { type: 'task-overdue' }, '0 */2 * * *');
  queueManager.addRecurringJob('notifications', 'check-calendar-reminders', { type: 'calendar-reminder' }, '*/15 * * * *');

  logger.info('Notification jobs initialized');
}
