import queueManager from '../services/queue.service';
import { mrpService } from '../services/mrp.service';
import { capacityPlanningService } from '../services/capacity-planning.service';
import { prisma } from '../config/database';
import { tenantContext } from '../middleware/tenant.middleware';
import logger from '../config/logger';

/**
 * MRP Jobs
 * Ricalcolo automatico fabbisogni materiali e capacity planning.
 * - Run notturno (02:00) per refresh del piano e notifica colli di bottiglia.
 * - Run mid-morning (10:30) per controllo carenze critiche.
 */

/**
 * Itera tutti i tenant ACTIVE ed esegue `fn` dentro lo scope tenant context
 * (`tenantContext.run`) cosi' le query Prisma sono auto-scoped dal `$use`
 * middleware. CRITICAL: i BullMQ worker NON ereditano AsyncLocalStorage
 * dalla request, devono settarlo manualmente.
 */
async function forEachActiveTenant(
  fn: (tenantId: string, tenantSlug: string) => Promise<void>
): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, slug: true, status: true },
  });

  for (const tenant of tenants) {
    await tenantContext.run(
      { tenantId: tenant.id, tenantSlug: tenant.slug, tenantStatus: tenant.status },
      async () => {
        try {
          await fn(tenant.id, tenant.slug);
        } catch (err: any) {
          logger.error(`Job failed for tenant ${tenant.slug}: ${err.message}`);
          // Continua con il prossimo tenant; l'errore di uno non blocca gli altri.
        }
      }
    );
  }
}

/**
 * Ricalcola fabbisogni MRP per ordini confermati. Notifica:
 * - shortage critici (CRITICAL priority)
 * - bottleneck capacita > 95% picco utilization
 *
 * Itera per ogni tenant attivo (job globali NON ereditano tenant context).
 */
export async function recalculateMrpJob(_job: unknown): Promise<void> {
  logger.info('MRP nightly recalculation started (multi-tenant)...');

  await forEachActiveTenant(async (tenantId, tenantSlug) => {
    logger.info(`MRP recalculation for tenant ${tenantSlug}...`);

    // 1. Calcola requirements (scoped a questo tenant via context)
    const requirements = await mrpService.calculateRequirementsForOrders();

    logger.info(
      `[${tenantSlug}] MRP: ${requirements.summary.totalMaterials} materials, ${requirements.summary.criticalShortages} critical shortages`
    );

    // 2. Notifica shortage critici
    if (requirements.summary.criticalShortages > 0) {
      try {
        const { default: notify } = await import('../services/notification.service');
        await notify.notifyRoles(
          ['ADMIN', 'MANAGER', 'MAGAZZINIERE'],
          {
            type: 'LOW_STOCK',
            title: 'MRP: carenze materiali critiche',
            message: `${requirements.summary.criticalShortages} materiali in shortage critico. Verifica gli ordini di acquisto suggeriti.`,
            link: '/mrp',
          }
        );
      } catch (err: any) {
        logger.warn(`[${tenantSlug}] MRP notification failed: ${err.message}`);
      }
    }

    // 3. Capacity planning su 30gg + alert se bottleneck
    const capacityPlan = await capacityPlanningService.getCapacityPlan(30);
    if (capacityPlan.globalSummary.bottlenecks.length > 0) {
      try {
        const { default: notify } = await import('../services/notification.service');
        const bottleneckList = capacityPlan.globalSummary.bottlenecks
          .map((b) => `${b.operationTypeName} (${b.peakUtilizationPct}%)`)
          .join(', ');
        await notify.notifyRoles(
          ['ADMIN', 'MANAGER'],
          {
            type: 'SYSTEM',
            title: 'MRP: colli di bottiglia capacita produttiva',
            message: `Saturazione critica nei prossimi 30gg: ${bottleneckList}`,
            link: '/production-orders',
          }
        );
      } catch (err: any) {
        logger.warn(`[${tenantSlug}] Capacity bottleneck notification failed: ${err.message}`);
      }
    }

    void tenantId;
  });

  logger.info('MRP nightly recalculation completed for all active tenants');
}

/**
 * Check rapido carenze critiche durante la giornata, multi-tenant.
 */
export async function checkCriticalShortagesJob(_job: unknown): Promise<void> {
  logger.info('MRP critical shortage check (multi-tenant)...');
  let totalNotified = 0;

  await forEachActiveTenant(async (_tenantId, tenantSlug) => {
    const notifiedCount = await mrpService.notifyCriticalShortages();
    totalNotified += notifiedCount;
    if (notifiedCount > 0) {
      logger.info(`[${tenantSlug}] critical shortage: ${notifiedCount} items notified`);
    }
  });

  logger.info(`MRP critical shortage check: ${totalNotified} items notified across all tenants`);
}

/**
 * Inizializza worker e job ricorrenti per MRP.
 */
export function initMrpJobs() {
  // Worker
  queueManager.createWorker(
    'mrp',
    async (job) => {
      switch (job.data.type) {
        case 'recalculate':
          return recalculateMrpJob(job);
        case 'check-critical':
          return checkCriticalShortagesJob(job);
        default:
          logger.warn(`Unknown MRP job type: ${job.data.type}`);
      }
    },
    1
  );

  // Schedula recalculation notturno alle 02:00
  queueManager.addRecurringJob(
    'mrp',
    'mrp-nightly-recalculate',
    { type: 'recalculate' },
    '0 2 * * *' // Ogni giorno alle 02:00
  );

  // Critical shortage check alle 10:30
  queueManager.addRecurringJob(
    'mrp',
    'mrp-critical-shortage-check',
    { type: 'check-critical' },
    '30 10 * * *' // Ogni giorno alle 10:30
  );

  logger.info('MRP jobs initialized');
}
