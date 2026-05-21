import queueManager from '../services/queue.service';
import alertService from '../services/alert.service';
import { prisma } from '../config/database';
import { runWithTenant } from '../utils/tenant-context';
import { forEachActiveTenant } from '../utils/tenant-fanout';
import logger from '../config/logger';

/**
 * Stock Alert Jobs
 * Job processors per controllo automatico scorte e invio notifiche.
 *
 * Multi-tenant: ogni controllo periodico itera per tenant ACTIVE.
 * Trigger event-based (post-shipment) ricava il tenantId dall'ordine.
 */

/**
 * Check completo di tutti gli alert per scorte (multi-tenant fanout)
 */
export async function checkStockAlertsJob(_job: unknown): Promise<void> {
  logger.info('Starting stock alerts check (multi-tenant)...');

  let totalAlerts = 0;
  await forEachActiveTenant(async (_tenantId, tenantSlug) => {
    const result = await alertService.checkAllStockAlerts();
    logger.info(
      `[${tenantSlug}] ${result.productsChecked} products, ${result.materialsChecked} materials, ${result.alerts.length} alerts`
    );
    if (result.alerts.length === 0) return;

    const newAlerts = await alertService.filterRecentAlerts(result.alerts);
    if (newAlerts.length === 0) {
      logger.info(`[${tenantSlug}] All alerts already notified in last 24h`);
      return;
    }
    const sentCount = await alertService.sendAlertNotifications(newAlerts);
    totalAlerts += sentCount;
    logger.info(`[${tenantSlug}] Sent ${sentCount} alert notifications`);
  });

  logger.info(`Stock alerts check completed: ${totalAlerts} total notifications sent`);
}

/**
 * Check specifico per lotti in scadenza (multi-tenant fanout)
 */
export async function checkExpiringLotsJob(_job: unknown): Promise<void> {
  logger.info('Starting expiring lots check (multi-tenant)...');

  await forEachActiveTenant(async (_tenantId, tenantSlug) => {
    const result = await alertService.checkAllStockAlerts();
    const expiringAlerts = result.alerts.filter((a) => a.type === 'EXPIRING_SOON');
    if (expiringAlerts.length === 0) return;

    logger.info(`[${tenantSlug}] Found ${expiringAlerts.length} expiring lots`);

    const newAlerts = await alertService.filterRecentAlerts(expiringAlerts);
    if (newAlerts.length > 0) {
      const sentCount = await alertService.sendAlertNotifications(newAlerts);
      logger.info(`[${tenantSlug}] Sent ${sentCount} expiring lot notifications`);
    }
  });
  logger.info('Expiring lots check completed');
}

/**
 * Check post-spedizione (triggerato da ordini). Ricava il tenantId dall'ordine
 * e wrappa l'esecuzione in `runWithTenant`.
 */
export async function postShipmentCheckJob(job: any): Promise<void> {
  const { orderId } = job.data;
  logger.info(`Post-shipment stock check for order ${orderId}...`);

  // Lookup tenantId dell'ordine (query intenzionalmente cross-tenant: il job
  // è scheduling sul singolo orderId che è UUID globalmente unico).
  // Disabilitiamo temporaneamente il middleware? No: l'ordine viene visto solo
  // se il caller ha già scoping; ma qui partiamo da background senza context.
  // Per ora cerchiamo da basePrisma evitando il middleware tenantId su Order.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { tenantId: true },
  });
  if (!order?.tenantId) {
    logger.warn(`Order ${orderId} non trovato o senza tenantId, skip stock check`);
    return;
  }

  await runWithTenant(order.tenantId, async () => {
    const result = await alertService.checkAllStockAlerts();
    const criticalAlerts = result.alerts.filter(
      (a) => a.type === 'OUT_OF_STOCK' || a.type === 'LOW_STOCK'
    );
    if (criticalAlerts.length > 0) {
      logger.info(`Found ${criticalAlerts.length} critical alerts after shipment ${orderId}`);
      await alertService.sendAlertNotifications(criticalAlerts);
    }
  });

  logger.info('Post-shipment check completed');
}

/**
 * Ottieni statistiche alert correnti (multi-tenant aggregated)
 */
export async function getAlertStatsJob(_job: unknown): Promise<unknown> {
  logger.info('Getting alert stats (multi-tenant)...');
  const aggregated: any = { tenants: 0, totalAlerts: 0, byType: {} };

  await forEachActiveTenant(async (_tenantId, _tenantSlug) => {
    const stats = await alertService.getAlertStats();
    aggregated.tenants += 1;
    aggregated.totalAlerts += stats.totalAlerts || 0;
  });

  logger.info(`Alert stats: ${aggregated.totalAlerts} total alerts across ${aggregated.tenants} tenants`);
  return aggregated;
}

/**
 * Inizializza worker e job ricorrenti per stock alerts
 */
export function initStockAlertJobs() {
  queueManager.createWorker(
    'stock-alerts',
    async (job) => {
      switch (job.data.type) {
        case 'stock-check':
          return checkStockAlertsJob(job);
        case 'expiry-check':
          return checkExpiringLotsJob(job);
        case 'shipment-triggered':
          return postShipmentCheckJob(job);
        case 'get-stats':
          return getAlertStatsJob(job);
        default:
          logger.warn(`Unknown stock alert job type: ${job.data.type}`);
          return;
      }
    },
    1
  );

  queueManager.addRecurringJob('stock-alerts', 'check-stock-alerts', { type: 'stock-check' }, '0 * * * *');
  queueManager.addRecurringJob('stock-alerts', 'check-expiring-lots', { type: 'expiry-check' }, '0 8 * * *');

  logger.info('Stock alert jobs initialized');
}

export async function triggerStockCheck(): Promise<void> {
  await queueManager.addJob('stock-alerts', 'manual-stock-check', {
    type: 'stock-check',
    manual: true,
    triggeredAt: new Date().toISOString(),
  });
}

export async function triggerPostShipmentCheck(orderId: string): Promise<void> {
  await queueManager.addJob('stock-alerts', `post-shipment-${orderId}`, {
    type: 'shipment-triggered',
    orderId,
    triggeredAt: new Date().toISOString(),
  });
}

export default {
  initStockAlertJobs,
  triggerStockCheck,
  triggerPostShipmentCheck,
  checkStockAlertsJob,
  checkExpiringLotsJob,
  postShipmentCheckJob,
};
