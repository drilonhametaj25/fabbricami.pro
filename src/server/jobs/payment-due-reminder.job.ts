import queueManager from '../services/queue.service';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import { tenantContext } from '../middleware/tenant.middleware';
import logger from '../config/logger';

/**
 * Payment Due Reminder & Dunning Jobs
 *
 * Reminder scadenze (RECEIVABLE = crediti / PAYABLE = debiti):
 * - T-7 giorni: primo reminder al cliente / promemoria interno per fornitore.
 * - T-3 giorni: secondo reminder (warning).
 * - T-0 (giorno scadenza): sollecito.
 *
 * Dunning escalation (solo RECEIVABLE in stato OVERDUE):
 * - dunningLevel 1 (T+0): reminder cortese.
 * - dunningLevel 2 (T+7): warning formale.
 * - dunningLevel 3 (T+14): sollecito ufficiale.
 * - dunningLevel 4 (T+30): notifica pre-legale.
 * - dunningLevel 5 (T+60): notifica legale (solo log; azione manuale).
 *
 * Scheduling: cron giornaliero alle 09:00 (ora di apertura ufficio).
 */

const NOW_BUCKETS = {
  inDays(days: number): { from: Date; to: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + days);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  },
};

const DUNNING_INTERVALS_DAYS = [0, 7, 14, 30, 60]; // dunningLevel target -> giorni dalla dueDate

/**
 * Job principale: invia reminder + esegue dunning escalation.
 * CRITICAL: itera per ogni tenant attivo settando l'AsyncLocalStorage
 * context cosi' le query Prisma restano scoped al singolo tenant.
 */
export async function paymentDueReminderJob(_job: unknown): Promise<void> {
  logger.info('Payment due reminder & dunning job started (multi-tenant)...');

  let totalReminders = 0;
  let totalDunning = 0;

  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, slug: true, status: true },
  });

  for (const tenant of tenants) {
    await tenantContext.run(
      { tenantId: tenant.id, tenantSlug: tenant.slug, tenantStatus: tenant.status },
      async () => {
        try {
          const sentReminders = await sendUpcomingReminders();
          const dunningSent = await sendDunningEscalation();
          totalReminders += sentReminders;
          totalDunning += dunningSent;
          if (sentReminders + dunningSent > 0) {
            logger.info(
              `[${tenant.slug}] Payment due: ${sentReminders} reminder + ${dunningSent} dunning`
            );
          }
        } catch (err: any) {
          logger.error(`[${tenant.slug}] Payment due reminder failed: ${err.message}`);
          // Non rilanciare: continua con il prossimo tenant
        }
      }
    );
  }

  logger.info(
    `Payment due reminders TOTAL: ${totalReminders} reminder + ${totalDunning} dunning across ${tenants.length} tenants`
  );
}

/**
 * Invia reminder per scadenze imminenti (T-7, T-3, T-0).
 * Usa `reminderSent` per evitare duplicati nello stesso ciclo.
 */
async function sendUpcomingReminders(): Promise<number> {
  let count = 0;

  // Reminder T-7
  const t7 = NOW_BUCKETS.inDays(7);
  const dues7 = await prisma.paymentDue.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { gte: t7.from, lte: t7.to },
      reminderSent: false,
    },
    include: {
      customer: { select: { email: true, businessName: true, firstName: true, lastName: true } },
      supplier: { select: { email: true, businessName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });
  for (const due of dues7) {
    if (await sendReminderEmail(due, 7)) {
      await prisma.paymentDue.update({
        where: { id: due.id },
        data: { reminderSent: true, reminderSentAt: new Date() },
      });
      count++;
    }
  }

  // Reminder T-3 (re-invia anche se reminderSent=true gia' fatto T-7)
  const t3 = NOW_BUCKETS.inDays(3);
  const dues3 = await prisma.paymentDue.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { gte: t3.from, lte: t3.to },
    },
    include: {
      customer: { select: { email: true, businessName: true, firstName: true, lastName: true } },
      supplier: { select: { email: true, businessName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });
  for (const due of dues3) {
    // Solo se non gia' notificato OGGI (lookback 1 gg)
    if (due.reminderSentAt && Date.now() - due.reminderSentAt.getTime() < 24 * 3600 * 1000) {
      continue;
    }
    if (await sendReminderEmail(due, 3)) {
      await prisma.paymentDue.update({
        where: { id: due.id },
        data: { reminderSent: true, reminderSentAt: new Date() },
      });
      count++;
    }
  }

  return count;
}

/**
 * Esegue escalation dunning per scadenze OVERDUE (solo RECEIVABLE).
 * Aggiorna lo status a OVERDUE se dueDate < oggi e ancora PENDING/PARTIAL.
 */
async function sendDunningEscalation(): Promise<number> {
  // 1. Aggiorna automaticamente PENDING/PARTIAL con dueDate scaduta a OVERDUE
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.paymentDue.updateMany({
    where: {
      type: 'RECEIVABLE',
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { lt: today },
    },
    data: { status: 'OVERDUE' },
  });

  // 2. Per ogni livello dunning, trova candidati e invia escalation
  let count = 0;
  for (let targetLevel = 1; targetLevel <= 5; targetLevel++) {
    const daysOverdue = DUNNING_INTERVALS_DAYS[targetLevel - 1];
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - daysOverdue);

    const candidates = await prisma.paymentDue.findMany({
      where: {
        type: 'RECEIVABLE',
        status: 'OVERDUE',
        dunningLevel: targetLevel - 1,
        dueDate: { lte: cutoff },
      },
      include: {
        customer: { select: { email: true, businessName: true, firstName: true, lastName: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    });

    for (const due of candidates) {
      if (await sendDunningEmail(due, targetLevel)) {
        await prisma.paymentDue.update({
          where: { id: due.id },
          data: {
            dunningLevel: targetLevel,
            lastDunningSentAt: new Date(),
          },
        });
        count++;
      }
    }
  }

  return count;
}

/**
 * Invia email di reminder generica (T-7 / T-3 / T-0).
 */
async function sendReminderEmail(due: any, daysToDue: number): Promise<boolean> {
  // Solo RECEIVABLE: invia al cliente. PAYABLE: notifica interna admin.
  if (due.type === 'RECEIVABLE') {
    const customer = due.customer;
    if (!customer?.email) return false;

    const customerName =
      customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();

    try {
      await emailService.sendPaymentReminder({
        customerEmail: customer.email,
        customerName,
        invoiceNumber: due.invoice?.invoiceNumber || due.description,
        amount: Number(due.amount),
        dueDate: due.dueDate,
        daysOverdue: daysToDue < 0 ? Math.abs(daysToDue) : 0,
      });
      logger.info(`Payment reminder T-${daysToDue} sent for due ${due.id}`);
      return true;
    } catch (err: any) {
      logger.error(`Reminder email failed for due ${due.id}: ${err.message}`);
      return false;
    }
  }
  return false;
}

/**
 * Invia email di dunning (escalation) al cliente per credito OVERDUE.
 */
async function sendDunningEmail(due: any, level: number): Promise<boolean> {
  const customer = due.customer;
  if (!customer?.email) return false;

  const customerName =
    customer.businessName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();

  const levelLabel = ['', 'Reminder', 'Sollecito', 'Sollecito ufficiale', 'Pre-legale', 'Legale'][level];
  const tone = level <= 2 ? 'cortese' : level <= 3 ? 'fermo' : 'urgente/legale';

  try {
    await emailService.sendPaymentReminder({
      customerEmail: customer.email,
      customerName,
      invoiceNumber: due.invoice?.invoiceNumber || due.description,
      amount: Number(due.amount),
      dueDate: due.dueDate,
      daysOverdue: Math.floor((Date.now() - due.dueDate.getTime()) / (24 * 3600 * 1000)),
    });
    logger.info(
      `Dunning level ${level} (${levelLabel} - ${tone}) sent for due ${due.id} customer ${customer.email}`
    );

    // Log per dunning level alto: notifica anche admin (preparare azione legale)
    if (level >= 4) {
      try {
        const { default: notify } = await import('../services/notification.service');
        await notify.notifyRoles(['ADMIN', 'CONTABILE'], {
          type: 'PAYMENT_OVERDUE',
          title: `Dunning livello ${level} per ${customerName}`,
          message: `Il cliente ${customerName} ha una posizione scaduta che richiede valutazione legale (importo: ${Number(due.amount).toFixed(2)} EUR)`,
          link: `/customers/${due.customerId}`,
        });
      } catch {
        // best-effort
      }
    }

    return true;
  } catch (err: any) {
    logger.error(`Dunning email failed for due ${due.id}: ${err.message}`);
    return false;
  }
}

/**
 * Inizializza worker e schedula cron giornaliero.
 */
export function initPaymentDueReminderJobs() {
  queueManager.createWorker(
    'payment-due',
    async (job) => {
      switch (job.data.type) {
        case 'reminder-and-dunning':
          return paymentDueReminderJob(job);
        default:
          logger.warn(`Unknown payment-due job type: ${job.data.type}`);
      }
    },
    1
  );

  // Esegui ogni giorno alle 09:00
  queueManager.addRecurringJob(
    'payment-due',
    'daily-reminder-dunning',
    { type: 'reminder-and-dunning' },
    '0 9 * * *'
  );

  logger.info('Payment due reminder & dunning jobs initialized');
}
