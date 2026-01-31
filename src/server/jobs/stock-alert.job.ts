import queueManager from '../services/queue.service';
import alertService from '../services/alert.service';
import logger from '../config/logger';

/**
 * Stock Alert Jobs
 * Job processors per controllo automatico scorte e invio notifiche
 */

/**
 * Check completo di tutti gli alert per scorte
 */
export async function checkStockAlertsJob(_job: unknown): Promise<void> {
  try {
    logger.info('Starting stock alerts check...');

    const result = await alertService.checkAllStockAlerts();

    logger.info(
      `Stock check completed: ${result.productsChecked} products, ${result.materialsChecked} materials, ${result.alerts.length} alerts found`
    );

    if (result.alerts.length === 0) {
      logger.info('No stock alerts to send');
      return;
    }

    // Filtra alert gia notificati nelle ultime 24h (evita spam)
    const newAlerts = await alertService.filterRecentAlerts(result.alerts);

    if (newAlerts.length === 0) {
      logger.info('All alerts already notified in last 24h, skipping');
      return;
    }

    // Invia notifiche
    const sentCount = await alertService.sendAlertNotifications(newAlerts);

    logger.info(`Sent ${sentCount} alert notifications`);
    logger.info('Stock alerts check completed');
  } catch (error: any) {
    logger.error(`Stock alerts check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Check specifico per lotti in scadenza
 */
export async function checkExpiringLotsJob(_job: unknown): Promise<void> {
  try {
    logger.info('Starting expiring lots check...');

    const result = await alertService.checkAllStockAlerts();

    // Filtra solo alert di scadenza
    const expiringAlerts = result.alerts.filter((a) => a.type === 'EXPIRING_SOON');

    if (expiringAlerts.length === 0) {
      logger.info('No expiring lots found');
      return;
    }

    logger.info(`Found ${expiringAlerts.length} expiring lots`);

    // Filtra gia notificati
    const newAlerts = await alertService.filterRecentAlerts(expiringAlerts);

    if (newAlerts.length > 0) {
      const sentCount = await alertService.sendAlertNotifications(newAlerts);
      logger.info(`Sent ${sentCount} expiring lot notifications`);
    }

    logger.info('Expiring lots check completed');
  } catch (error: any) {
    logger.error(`Expiring lots check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Check post-spedizione (triggerato da ordini)
 */
export async function postShipmentCheckJob(job: any): Promise<void> {
  try {
    const { orderId } = job.data;
    logger.info(`Post-shipment stock check for order ${orderId}...`);

    // Esegui check completo
    const result = await alertService.checkAllStockAlerts();

    // Filtra alert critici (OUT_OF_STOCK e LOW_STOCK)
    const criticalAlerts = result.alerts.filter(
      (a) => a.type === 'OUT_OF_STOCK' || a.type === 'LOW_STOCK'
    );

    if (criticalAlerts.length > 0) {
      logger.info(`Found ${criticalAlerts.length} critical alerts after shipment`);
      await alertService.sendAlertNotifications(criticalAlerts);
    }

    logger.info('Post-shipment check completed');
  } catch (error: any) {
    logger.error(`Post-shipment check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Ottieni statistiche alert correnti
 */
export async function getAlertStatsJob(_job: unknown): Promise<unknown> {
  try {
    logger.info('Getting alert stats...');
    const stats = await alertService.getAlertStats();
    logger.info(`Alert stats: ${stats.totalAlerts} total alerts`);
    return stats;
  } catch (error: any) {
    logger.error(`Get alert stats failed: ${error.message}`);
    throw error;
  }
}

/**
 * Inizializza worker e job ricorrenti per stock alerts
 */
export function initStockAlertJobs() {
  // Crea worker per stock-alerts queue
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
    1 // Concurrency 1 per evitare race condition
  );

  // Job ricorrente: check completo scorte ogni ora
  queueManager.addRecurringJob(
    'stock-alerts',
    'check-stock-alerts',
    { type: 'stock-check' },
    '0 * * * *' // Ogni ora
  );

  // Job ricorrente: check scadenze ogni giorno alle 8:00
  queueManager.addRecurringJob(
    'stock-alerts',
    'check-expiring-lots',
    { type: 'expiry-check' },
    '0 8 * * *' // Ogni giorno alle 8:00
  );

  logger.info('Stock alert jobs initialized');
}

/**
 * Funzione helper per triggerare check manuale
 */
export async function triggerStockCheck(): Promise<void> {
  await queueManager.addJob('stock-alerts', 'manual-stock-check', {
    type: 'stock-check',
    manual: true,
    triggeredAt: new Date().toISOString(),
  });
}

/**
 * Funzione helper per triggerare check post-spedizione
 */
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
