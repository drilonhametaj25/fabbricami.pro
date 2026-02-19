/**
 * Trial Expiration Job
 * Gestisce la scadenza automatica dei trial e invia notifiche
 */

import queueManager from '../services/queue.service';
import { prisma } from '../config/database';
import { emailService } from '../services/email.service';
import logger from '../config/logger';

/**
 * Trova trial che scadranno nei prossimi 3 giorni e invia email di avviso
 */
export async function checkTrialEndingSoonJob(_job: unknown): Promise<void> {
  try {
    logger.info('Checking trials ending soon...');

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Trova subscription in trial che scadranno tra 1-3 giorni
    const endingTrials = await prisma.saasSubscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        tenant: {
          include: {
            members: {
              where: { role: 'ADMIN' },
              include: { user: true },
              take: 1,
            },
          },
        },
        plan: true,
      },
    });

    logger.info(`Found ${endingTrials.length} trials ending in 3 days`);

    for (const subscription of endingTrials) {
      const owner = subscription.tenant?.members[0]?.user;
      if (owner && subscription.tenant && subscription.trialEndsAt) {
        const daysRemaining = Math.ceil(
          (subscription.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          await emailService.sendTrialEndingSoonEmail(
            owner.email,
            owner.firstName || owner.email.split('@')[0],
            subscription.tenant.name,
            Math.max(daysRemaining, 1)
          );
          logger.info(`Trial ending email sent to ${owner.email} (${daysRemaining} days left)`);
        } catch (emailError: any) {
          logger.error(`Failed to send trial ending email to ${owner.email}: ${emailError.message}`);
        }
      }
    }

    logger.info('Trial ending soon check completed');
  } catch (error: any) {
    logger.error(`Trial ending soon check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Trova trial scaduti e aggiorna il loro status
 * Invia email di notifica trial scaduto
 */
export async function processExpiredTrialsJob(_job: unknown): Promise<void> {
  try {
    logger.info('Processing expired trials...');

    const now = new Date();

    // Trova subscription in trial che sono scaduti
    const expiredTrials = await prisma.saasSubscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lt: now,
        },
      },
      include: {
        tenant: {
          include: {
            members: {
              where: { role: 'ADMIN' },
              include: { user: true },
              take: 1,
            },
          },
        },
        plan: true,
      },
    });

    logger.info(`Found ${expiredTrials.length} expired trials to process`);

    for (const subscription of expiredTrials) {
      // Aggiorna status a EXPIRED
      await prisma.saasSubscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });

      logger.info(`Trial expired for tenant ${subscription.tenant?.name || subscription.tenantId}`);

      // Invia email trial scaduto
      const owner = subscription.tenant?.members[0]?.user;
      if (owner && subscription.tenant) {
        try {
          await emailService.sendTrialExpiredEmail(
            owner.email,
            owner.firstName || owner.email.split('@')[0],
            subscription.tenant.name
          );
          logger.info(`Trial expired email sent to ${owner.email}`);
        } catch (emailError: any) {
          logger.error(`Failed to send trial expired email to ${owner.email}: ${emailError.message}`);
        }
      }
    }

    logger.info('Expired trials processing completed');
  } catch (error: any) {
    logger.error(`Expired trials processing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Trova subscription scadute da tempo e notifica
 * (utenti che non hanno mai completato il pagamento)
 */
export async function checkLongExpiredTrialsJob(_job: unknown): Promise<void> {
  try {
    logger.info('Checking long-expired trials...');

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Trova trial scaduti da 7+ giorni che non hanno ancora pagato
    // Questi potrebbero ricevere un'ultima email "win-back"
    const longExpiredTrials = await prisma.saasSubscription.findMany({
      where: {
        status: 'EXPIRED',
        trialEndsAt: {
          lt: sevenDaysAgo,
          gte: thirtyDaysAgo, // Non più vecchi di 30 giorni
        },
      },
      include: {
        tenant: {
          include: {
            members: {
              where: { role: 'ADMIN' },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    });

    logger.info(`Found ${longExpiredTrials.length} long-expired trials`);

    // Per ora solo log, in futuro potremmo inviare email "win-back"
    for (const subscription of longExpiredTrials) {
      logger.debug(
        `Long-expired trial: tenant ${subscription.tenant?.name}, expired on ${subscription.trialEndsAt}`
      );
    }

    logger.info('Long-expired trials check completed');
  } catch (error: any) {
    logger.error(`Long-expired trials check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Inizializza worker e job ricorrenti per gestione trial
 */
export function initTrialExpirationJobs() {
  // Crea worker per trial expiration
  queueManager.createWorker(
    'trial-expiration',
    async (job) => {
      switch (job.data.type) {
        case 'check-ending-soon':
          return checkTrialEndingSoonJob(job);
        case 'process-expired':
          return processExpiredTrialsJob(job);
        case 'check-long-expired':
          return checkLongExpiredTrialsJob(job);
        default:
          logger.warn(`Unknown trial expiration job type: ${job.data.type}`);
      }
    },
    1 // Un solo worker alla volta per evitare race conditions
  );

  // Schedula job ricorrenti

  // Controlla trial in scadenza ogni giorno alle 10:00
  queueManager.addRecurringJob(
    'trial-expiration',
    'check-trials-ending-soon',
    { type: 'check-ending-soon' },
    '0 10 * * *' // Ogni giorno alle 10:00
  );

  // Processa trial scaduti ogni giorno alle 00:05
  queueManager.addRecurringJob(
    'trial-expiration',
    'process-expired-trials',
    { type: 'process-expired' },
    '5 0 * * *' // Ogni giorno alle 00:05
  );

  // Controlla trial scaduti da tempo ogni lunedì alle 9:00
  queueManager.addRecurringJob(
    'trial-expiration',
    'check-long-expired-trials',
    { type: 'check-long-expired' },
    '0 9 * * 1' // Ogni lunedì alle 9:00
  );

  logger.info('Trial expiration jobs initialized');
}

/**
 * Forza il processamento di trial scaduti (per test/admin)
 */
export async function forceProcessExpiredTrials(): Promise<{
  processed: number;
  errors: string[];
}> {
  let processed = 0;
  const errors: string[] = [];

  try {
    const now = new Date();

    const expiredTrials = await prisma.saasSubscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lt: now,
        },
      },
      include: {
        tenant: {
          include: {
            members: {
              where: { role: 'ADMIN' },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    });

    for (const subscription of expiredTrials) {
      try {
        await prisma.saasSubscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });

        const owner = subscription.tenant?.members[0]?.user;
        if (owner && subscription.tenant) {
          await emailService.sendTrialExpiredEmail(
            owner.email,
            owner.firstName || owner.email.split('@')[0],
            subscription.tenant.name
          );
        }

        processed++;
      } catch (err: any) {
        errors.push(`Tenant ${subscription.tenantId}: ${err.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`General error: ${error.message}`);
  }

  return { processed, errors };
}
