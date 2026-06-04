/**
 * PrestaShop Sync Job
 *
 * PrestaShop non ha webhook nativi → la sincronizzazione è pull/push periodica.
 * Questo job ricorrente itera i tenant con `syncEnabled` e per ciascuno esegue
 * un ciclo completo (push prodotti/inventario + import ordini), all'interno del
 * tenant context così il middleware filtra/inietta correttamente.
 */
import queueManager from '../services/queue.service';
import { runWithTenant } from '../utils/tenant-context';
import { prestashopSettingsService } from '../services/prestashop-settings.service';
import { prestashopService } from '../services/prestashop.service';
import logger from '../config/logger';

export async function syncAllPrestaShopTenantsJob(_job: unknown): Promise<void> {
  const tenantIds = await prestashopSettingsService.listTenantsWithSyncEnabled();
  if (tenantIds.length === 0) {
    logger.debug('PrestaShop sync: nessun tenant con sync abilitato');
    return;
  }
  logger.info(`PrestaShop sync: avvio per ${tenantIds.length} tenant`);

  for (const tenantId of tenantIds) {
    try {
      await runWithTenant(tenantId, () => prestashopService.runFullSync(tenantId));
    } catch (e) {
      logger.error(`PrestaShop sync fallito per tenant ${tenantId}:`, e);
    }
  }
}

export function initPrestaShopJobs(): void {
  queueManager.createWorker(
    'prestashop',
    async (job) => {
      if (job.data?.type === 'sync-all') {
        return syncAllPrestaShopTenantsJob(job);
      }
      logger.warn(`Unknown PrestaShop job type: ${job.data?.type}`);
    },
    1 // un solo worker: evita sync concorrenti sullo stesso shop
  );

  // Sync periodica ogni 15 minuti (l'intervallo per-tenant è informativo;
  // la cadenza effettiva del polling è questa schedulazione globale).
  queueManager.addRecurringJob(
    'prestashop',
    'prestashop-sync-all',
    { type: 'sync-all' },
    '*/15 * * * *'
  );

  logger.info('✅ PrestaShop sync jobs initialized');
}

export default initPrestaShopJobs;
