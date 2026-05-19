import { Job, Worker, Queue } from 'bullmq';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { wordpressService } from '../services/wordpress.service';
import wordpressSettingsService from '../services/wordpress-settings.service';
import { importJobService } from '../services/import-job.service';
import { runWithTenant } from '../utils/tenant-context';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// Queue per job WordPress
export const wordpressQueue = new Queue('wordpress', { connection });

// Dead Letter Queue per job WordPress falliti definitivamente.
// Usata per ispezione manuale e replay; i job qui dentro NON vengono processati
// automaticamente. Un job atterra qui dopo il consumo dei retry esponenziali.
export const wordpressDlqQueue = new Queue('wordpress-dlq', { connection });

/**
 * Sposta un job fallito nella DLQ con il payload originale + metadata di errore.
 * Best-effort: errore loggato ma non rilanciato per evitare di sovrascrivere
 * lo stato di failure originale.
 */
async function moveToDlq(job: Job<WordPressJobData>, err: Error): Promise<void> {
  try {
    await wordpressDlqQueue.add(
      'wordpress-failed',
      {
        originalJobId: job.id,
        originalName: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: err.message,
        stack: err.stack,
        failedAt: new Date().toISOString(),
      },
      {
        removeOnComplete: false,
        removeOnFail: false,
      }
    );
    logger.error(`WP job ${job.id} (${job.name}) moved to DLQ: ${err.message}`);
  } catch (dlqError: any) {
    logger.error(`Failed to move WP job ${job.id} to DLQ: ${dlqError.message}`);
  }
}

// Tipi di job WordPress (tenant-specifici: richiedono tenantId nel payload).
type WordPressJobType =
  | 'sync-inventory'
  | 'sync-products'
  | 'sync-single-product'
  | 'import-orders'
  | 'update-order-status'
  | 'import-customers';

// Tipi di job "meta" (eseguiti dallo scheduler, NON tenant-specifici): fanno
// fanout enumerando i tenant con sync abilitata e enqueuando un job
// tenant-specifico per ciascuno.
type WordPressMetaJobType = 'sync-inventory-fanout' | 'sync-products-fanout';

type AnyWordPressJobType = WordPressJobType | WordPressMetaJobType;

interface WordPressJobData {
  type: AnyWordPressJobType;
  /** Obbligatorio per i job tenant-specifici; assente per i fanout meta-job. */
  tenantId?: string;
  productId?: string;
  orderId?: string;
  status?: string;
  // Dati specifici per import-customers
  importCustomers?: {
    currentPage: number;
    totalCustomers: number;
    imported: number;
    updated: number;
    errors: number;
    startedAt: string;
    isPaused?: boolean;
  };
}

/**
 * Processor principale per job WordPress.
 *
 * Tutto il body viene eseguito dentro `runWithTenant(tenantId, ...)`: il
 * wordpressService legge automaticamente le credenziali del tenant corretto
 * tramite tenant context (AsyncLocalStorage), senza dover passare tenantId
 * lungo la catena di chiamate.
 */
export async function processWordPressJob(job: Job<WordPressJobData>) {
  const { type, tenantId, productId, orderId, status } = job.data;

  // I "meta" job sono eseguiti dallo scheduler senza tenant context: fanno
  // fanout enumerando i tenant con sync abilitata.
  if (type === 'sync-inventory-fanout' || type === 'sync-products-fanout') {
    return fanoutScheduledJob(type);
  }

  if (!tenantId) {
    logger.error(`WordPress job ${job.id} (${type}) senza tenantId — rifiutato`);
    throw new Error('tenantId obbligatorio nel payload del job WordPress');
  }

  logger.info(`Processing WordPress job: ${type} (tenant=${tenantId})`, { jobId: job.id });

  return runWithTenant(tenantId, async () => {
    try {
      switch (type) {
        case 'sync-inventory':
          return await syncInventoryJob();

        case 'sync-products':
          return await syncProductsJob();

        case 'sync-single-product':
          if (!productId) throw new Error('productId richiesto');
          return await syncSingleProductJob(productId);

        case 'update-order-status':
          if (!orderId || !status) throw new Error('orderId e status richiesti');
          return await updateOrderStatusJob(orderId, status);

        case 'import-customers':
          return await importCustomersJob(job);

        default:
          throw new Error(`Tipo job WordPress sconosciuto: ${type}`);
      }
    } catch (error: any) {
      logger.error(`WordPress job ${type} (tenant=${tenantId}) failed:`, error);
      throw error;
    }
  });
}

/**
 * Fanout di un job meta dello scheduler: enumera tutti i tenant con sync
 * abilitata e enqueua un job tenant-specifico per ciascuno. Idempotente:
 * lo scheduler ri-esegue il meta ogni N min, e il fanout enqueua sempre N
 * nuovi job tenant-specifici (i job duplicati per lo stesso tenant nello
 * stesso slot vengono evitati tramite jobId deterministico).
 */
async function fanoutScheduledJob(metaType: WordPressMetaJobType) {
  const childType: WordPressJobType =
    metaType === 'sync-inventory-fanout' ? 'sync-inventory' : 'sync-products';

  const tenantIds = await wordpressSettingsService.listTenantsWithSyncEnabled();
  if (tenantIds.length === 0) {
    logger.debug(`[${metaType}] Nessun tenant con sync abilitata`);
    return { fanout: metaType, tenants: 0 };
  }

  for (const tenantId of tenantIds) {
    // jobId deterministico per slot orario: evita duplicati se il meta job
    // viene processato due volte ravvicinate.
    const slot = Math.floor(Date.now() / 60_000); // 1-min slot
    const jobId = `${childType}-${tenantId}-${slot}`;
    await wordpressQueue.add(
      childType,
      { type: childType, tenantId },
      {
        jobId,
        removeOnComplete: 50,
        removeOnFail: 20,
      }
    );
  }

  logger.info(`[${metaType}] Enqueued ${tenantIds.length} child job (${childType})`);
  return { fanout: metaType, tenants: tenantIds.length };
}

/**
 * Sync tutte le giacenze verso WooCommerce per il tenant corrente.
 */
async function syncInventoryJob() {
  if (!(await wordpressService.isConfigured())) {
    logger.warn('WordPress non configurato per il tenant corrente, skip sync giacenze');
    return { skipped: true };
  }

  const result = await wordpressService.syncInventoryToWooCommerce();
  logger.info(`Sync giacenze completato: ${result.synced} sincronizzati, ${result.errors} errori`);
  return result;
}

/**
 * Sync tutti i prodotti verso WooCommerce per il tenant corrente.
 */
async function syncProductsJob() {
  if (!(await wordpressService.isConfigured())) {
    logger.warn('WordPress non configurato per il tenant corrente, skip sync prodotti');
    return { skipped: true };
  }

  const result = await wordpressService.syncAllProductsToWooCommerce();
  logger.info(`Sync prodotti completato: ${result.synced} sincronizzati, ${result.errors} errori`);
  return result;
}

/**
 * Sync singolo prodotto verso WooCommerce.
 */
async function syncSingleProductJob(productId: string) {
  if (!(await wordpressService.isConfigured())) {
    return { skipped: true };
  }

  const result = await wordpressService.syncProductToWooCommerce(productId);
  logger.info(`Sync prodotto ${productId}: ${result.success ? 'OK' : result.error}`);
  return result;
}

/**
 * Aggiorna stato ordine su WooCommerce.
 */
async function updateOrderStatusJob(orderId: string, status: string) {
  if (!(await wordpressService.isConfigured())) {
    return { skipped: true };
  }

  const success = await wordpressService.updateOrderStatusOnWooCommerce(orderId, status);
  logger.info(`Update stato ordine ${orderId} su WooCommerce: ${success ? 'OK' : 'FAILED'}`);
  return { success };
}

/**
 * Import clienti da WooCommerce in background
 * Processa pagina per pagina con progress tracking e persistenza DB
 */
async function importCustomersJob(job: Job<WordPressJobData>) {
  if (!(await wordpressService.isConfigured())) {
    logger.warn('WordPress non configurato per il tenant corrente, skip import clienti');
    return { skipped: true };
  }

  // Recupera stato precedente o inizializza
  const state = job.data.importCustomers || {
    currentPage: 1,
    totalCustomers: 0,
    imported: 0,
    updated: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    isPaused: false,
  };

  // Cerca o crea record ImportJob nel database
  const dbJob = await importJobService.getByBullmqJobId(job.id!);

  // Se è la prima pagina, ottieni il conteggio totale
  if (state.currentPage === 1 && state.totalCustomers === 0) {
    state.totalCustomers = await wordpressService.getWooCommerceCustomersCount();
    logger.info(`[ImportCustomersJob] Totale clienti da importare: ${state.totalCustomers}`);
  }

  const perPage = 10; // Numero clienti per pagina
  const totalPages = Math.ceil(state.totalCustomers / perPage);

  // Aggiorna record DB con totale
  if (dbJob) {
    await importJobService.updateProgress(dbJob.id, {
      totalPages,
      totalItems: state.totalCustomers,
    });
  }

  logger.info(`[ImportCustomersJob] Inizio importazione da pagina ${state.currentPage}/${totalPages}`);

  let hasMore = true;
  const errorLog: any[] = [];

  while (hasMore) {
    // Controlla se il job è stato cancellato o messo in pausa
    const currentJob = await wordpressQueue.getJob(job.id!);
    if (!currentJob) {
      logger.info('[ImportCustomersJob] Job cancellato, uscita');
      if (dbJob) {
        await importJobService.setStatus(dbJob.id, 'CANCELLED');
      }
      return { cancelled: true, ...state };
    }

    // Aggiorna progresso
    const percent = totalPages > 0 ? Math.round((state.currentPage / totalPages) * 100) : 0;
    await job.updateProgress({
      currentPage: state.currentPage,
      totalPages,
      totalCustomers: state.totalCustomers,
      imported: state.imported,
      updated: state.updated,
      errors: state.errors,
      percent,
      startedAt: state.startedAt,
    });

    // Aggiorna DB ad ogni pagina
    if (dbJob) {
      await importJobService.updateProgress(dbJob.id, {
        currentPage: state.currentPage,
        imported: state.imported,
        updated: state.updated,
        errors: state.errors,
        errorLog: errorLog.length > 0 ? errorLog : undefined,
      });
    }

    // Importa pagina corrente
    try {
      const result = await wordpressService.importCustomersPage(state.currentPage, perPage);

      state.imported += result.imported;
      state.updated += result.updated;
      state.errors += result.errors;
      hasMore = result.hasMore;

      logger.info(
        `[ImportCustomersJob] Pagina ${state.currentPage}/${totalPages} completata: ` +
        `+${result.imported} importati, +${result.updated} aggiornati, +${result.errors} errori`
      );

      if (hasMore) {
        state.currentPage++;

        // Aggiorna job data per resume
        await job.updateData({
          ...job.data,
          importCustomers: state,
        });

        // Delay tra pagine per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      logger.error(`[ImportCustomersJob] Errore pagina ${state.currentPage}:`, error);
      state.errors++;
      errorLog.push({
        page: state.currentPage,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      // Salva stato per resume
      await job.updateData({
        ...job.data,
        importCustomers: state,
      });

      // Aggiorna DB con errore
      if (dbJob) {
        await importJobService.updateProgress(dbJob.id, {
          currentPage: state.currentPage,
          errors: state.errors,
          errorLog,
        });
      }

      // Ritenta dopo un delay più lungo
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Marca job come completato nel DB
  if (dbJob) {
    await importJobService.updateProgress(dbJob.id, {
      currentPage: state.currentPage,
      imported: state.imported,
      updated: state.updated,
      errors: state.errors,
      errorLog: errorLog.length > 0 ? errorLog : undefined,
    });
    await importJobService.setStatus(dbJob.id, 'COMPLETED');
  }

  logger.info(
    `[ImportCustomersJob] Completato! Importati: ${state.imported}, ` +
    `Aggiornati: ${state.updated}, Errori: ${state.errors}`
  );

  return {
    completed: true,
    imported: state.imported,
    updated: state.updated,
    errors: state.errors,
    totalPages: state.currentPage,
    startedAt: state.startedAt,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Avvia job import clienti in background
 * Crea record nel database e poi avvia job BullMQ
 */
export async function startCustomerImportJob(tenantId: string, userId?: string): Promise<{ jobId: string; dbJobId: string }> {
  if (!tenantId) {
    throw new Error('startCustomerImportJob: tenantId obbligatorio');
  }
  const bullmqJob = await wordpressQueue.add(
    'import-customers',
    {
      type: 'import-customers',
      tenantId,
      importCustomers: {
        currentPage: 1,
        totalCustomers: 0,
        imported: 0,
        updated: 0,
        errors: 0,
        startedAt: new Date().toISOString(),
        isPaused: false,
      },
    },
    {
      removeOnComplete: false, // Mantieni per vedere risultato finale
      removeOnFail: false,
      attempts: 1, // Non retry automatico, gestiamo internamente
    }
  );

  // Crea record nel database
  const dbJob = await importJobService.create('CUSTOMERS', bullmqJob.id!, userId);

  logger.info(`[ImportCustomersJob] Job avviato con ID: ${bullmqJob.id}, DB ID: ${dbJob.id}`);
  return { jobId: bullmqJob.id!, dbJobId: dbJob.id };
}

/**
 * Ottieni stato job import clienti
 */
export async function getCustomerImportJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'not_found';
  progress?: any;
  result?: any;
  failedReason?: string;
}> {
  const job = await wordpressQueue.getJob(jobId);

  if (!job) {
    return { status: 'not_found' };
  }

  const state = await job.getState();
  const progress = job.progress as any;
  const result = job.returnvalue;
  const failedReason = job.failedReason;

  return {
    status: state as any,
    progress: progress || job.data.importCustomers,
    result,
    failedReason,
  };
}

/**
 * Cancella job import clienti
 */
export async function cancelCustomerImportJob(jobId: string): Promise<boolean> {
  const job = await wordpressQueue.getJob(jobId);

  if (!job) {
    return false;
  }

  const state = await job.getState();

  // Aggiorna stato nel database
  const dbJob = await importJobService.getByBullmqJobId(jobId);
  if (dbJob) {
    await importJobService.setStatus(dbJob.id, 'CANCELLED');
  }

  if (state === 'active') {
    // Per job attivi, impostiamo un flag e il job controllerà
    await job.updateData({
      ...job.data,
      cancelled: true,
    });
    logger.info(`[ImportCustomersJob] Job ${jobId} marcato per cancellazione`);
  }

  // Rimuovi dalla queue se in attesa
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    logger.info(`[ImportCustomersJob] Job ${jobId} rimosso dalla queue`);
  }

  return true;
}

/**
 * Metti in pausa job import clienti (salva stato nel DB e rimuovi da BullMQ)
 */
export async function pauseCustomerImportJob(jobId: string): Promise<{ success: boolean; state?: any; dbJobId?: string }> {
  const job = await wordpressQueue.getJob(jobId);

  if (!job) {
    return { success: false };
  }

  const currentState = job.data.importCustomers;

  // Aggiorna stato nel database
  const dbJob = await importJobService.getByBullmqJobId(jobId);
  if (dbJob) {
    await importJobService.setStatus(dbJob.id, 'PAUSED');
  }

  // Salva stato e rimuovi job da BullMQ
  await job.remove();

  logger.info(`[ImportCustomersJob] Job ${jobId} messo in pausa a pagina ${currentState?.currentPage}`);

  return { success: true, state: currentState, dbJobId: dbJob?.id };
}

/**
 * Riprendi job import clienti da un job precedente nel database
 */
export async function resumeCustomerImportJob(dbJobId: string, userId?: string): Promise<{ jobId: string; dbJobId: string }> {
  // Ottieni il job originale dal database
  const originalDbJob = await importJobService.getById(dbJobId);
  if (!originalDbJob) {
    throw new Error(`Job ${dbJobId} not found in database`);
  }

  // Prepara stato di ripresa
  const savedState = {
    currentPage: originalDbJob.currentPage,
    totalCustomers: originalDbJob.totalItems || 0,
    imported: originalDbJob.imported,
    updated: originalDbJob.updated,
    errors: originalDbJob.errors,
    startedAt: originalDbJob.startedAt.toISOString(),
    isPaused: false,
  };

  // Crea nuovo job BullMQ
  const bullmqJob = await wordpressQueue.add(
    'import-customers-resumed',
    {
      type: 'import-customers',
      importCustomers: savedState,
    },
    {
      removeOnComplete: false,
      removeOnFail: false,
      attempts: 1,
    }
  );

  // Crea nuovo record DB che continua da quello precedente
  const newDbJob = await importJobService.createResumeJob(dbJobId, bullmqJob.id!, userId);

  logger.info(`[ImportCustomersJob] Job ripreso con ID: ${bullmqJob.id}, DB ID: ${newDbJob.id}, da pagina ${savedState.currentPage}`);
  return { jobId: bullmqJob.id!, dbJobId: newDbJob.id };
}

/**
 * Ottieni job di importazione clienti attivi o recenti
 */
export async function getActiveCustomerImportJobs(): Promise<{
  active: any[];
  waiting: any[];
  recent: any[];
}> {
  const activeJobs = await wordpressQueue.getActive();
  const waitingJobs = await wordpressQueue.getWaiting();
  const completedJobs = await wordpressQueue.getCompleted(0, 5); // Ultimi 5 completati
  const failedJobs = await wordpressQueue.getFailed(0, 5); // Ultimi 5 falliti

  // Filtra solo job di tipo import-customers
  const filterImportJobs = (jobs: Job<WordPressJobData>[]) =>
    jobs
      .filter(job => job.data.type === 'import-customers')
      .map(job => ({
        id: job.id,
        status: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : 'active',
        progress: job.progress || job.data.importCustomers,
        createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        failedReason: job.failedReason,
      }));

  return {
    active: filterImportJobs(activeJobs),
    waiting: filterImportJobs(waitingJobs),
    recent: [
      ...filterImportJobs(completedJobs),
      ...filterImportJobs(failedJobs),
    ].sort((a, b) => {
      const dateA = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const dateB = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 5),
  };
}

/**
 * Inizializza worker WordPress
 *
 * Politica retry: 5 tentativi con backoff esponenziale (1s, 2s, 4s, 8s, 16s).
 * Dopo l'ultimo tentativo fallito il job viene spostato nella DLQ
 * (`wordpressDlqQueue`) per ispezione manuale + replay.
 */
export function initWordPressWorker() {
  const worker = new Worker<WordPressJobData>(
    'wordpress',
    processWordPressJob,
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 1000, // Max 10 job al secondo (rate limiting WooCommerce)
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`WordPress job ${job.id} completato`);
  });

  worker.on('failed', async (job, err) => {
    logger.error(`WordPress job ${job?.id} fallito (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`, err);

    // Quando il job ha consumato tutti i retry, sposta in DLQ.
    if (job && job.opts.attempts && job.attemptsMade >= job.opts.attempts) {
      await moveToDlq(job, err);
    }
  });

  return worker;
}

/**
 * Default options per add() ai job WordPress: 5 retry esponenziali + persist.
 */
export const WP_JOB_RETRY_OPTS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1s, 2s, 4s, 8s, 16s
  },
  removeOnFail: false,
  removeOnComplete: 100,
};

// =============================================
// DLQ MANAGEMENT
// =============================================

/**
 * Lista job nella DLQ (per dashboard admin/monitor).
 */
export async function listDlqJobs(limit: number = 100) {
  const jobs = await wordpressDlqQueue.getJobs(['waiting', 'completed', 'failed'], 0, limit);
  return jobs.map(j => ({
    id: j.id,
    name: j.name,
    data: j.data,
    timestamp: j.timestamp,
  }));
}

/**
 * Replay di un job dalla DLQ verso la queue principale.
 * Riusa il payload originale; resetta gli attempts.
 */
export async function replayDlqJob(dlqJobId: string): Promise<{ replayed: boolean; jobId?: string }> {
  const dlqJob = await wordpressDlqQueue.getJob(dlqJobId);
  if (!dlqJob) return { replayed: false };

  const originalData = dlqJob.data?.data;
  const originalName = dlqJob.data?.originalName || 'replayed-job';
  if (!originalData) return { replayed: false };

  const newJob = await wordpressQueue.add(originalName, originalData, WP_JOB_RETRY_OPTS);
  await dlqJob.remove();
  return { replayed: true, jobId: newJob.id };
}

/**
 * Conta job in DLQ (per alert se cresce).
 */
export async function getDlqStats() {
  const counts = await wordpressDlqQueue.getJobCounts();
  return counts;
}

/**
 * Schedula job periodici WordPress
 */
export async function scheduleWordPressJobs() {
  // Lo scheduler enqueua job "meta" (sync-inventory-fanout / sync-products-fanout)
  // che NON eseguono direttamente la sync: enumerano i tenant con sync
  // abilitata in `wordpress_tenant_config.sync_enabled = true` e enqueano un
  // job tenant-specifico per ciascuno. In questo modo:
  //   - lo scheduler è UNA volta a livello piattaforma (non per-tenant)
  //   - aggiungere/rimuovere tenant non richiede ri-schedulare crontab
  //   - il sync-interval globale è settabile da env / default 5min
  const syncIntervalMs = parseInt(process.env.WORDPRESS_SCHEDULER_INTERVAL_MS || '300000');

  await wordpressQueue.add(
    'scheduled-inventory-sync-fanout',
    { type: 'sync-inventory-fanout' },
    {
      repeat: { every: syncIntervalMs },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  await wordpressQueue.add(
    'scheduled-products-sync-fanout',
    { type: 'sync-products-fanout' },
    {
      repeat: { pattern: '0 * * * *' }, // Ogni ora
      removeOnComplete: 50,
      removeOnFail: 20,
    }
  );

  logger.info(
    `WordPress scheduled jobs configurati (fanout multi-tenant ogni ${syncIntervalMs}ms)`
  );
}

/**
 * Aggiunge job sync singolo prodotto alla coda con retry esponenziali e DLQ.
 * Richiede tenantId per associare il job al tenant corretto.
 */
export async function queueProductSync(tenantId: string, productId: string) {
  if (!tenantId) throw new Error('queueProductSync: tenantId obbligatorio');
  await wordpressQueue.add(
    `sync-product-${tenantId}-${productId}`,
    { type: 'sync-single-product', tenantId, productId },
    {
      ...WP_JOB_RETRY_OPTS,
      delay: 1000, // Ritardo 1s per evitare duplicati
    }
  );
}

/**
 * Aggiunge job update stato ordine alla coda con retry esponenziali e DLQ.
 */
export async function queueOrderStatusUpdate(tenantId: string, orderId: string, status: string) {
  if (!tenantId) throw new Error('queueOrderStatusUpdate: tenantId obbligatorio');
  await wordpressQueue.add(
    `update-order-${tenantId}-${orderId}`,
    { type: 'update-order-status', tenantId, orderId, status },
    WP_JOB_RETRY_OPTS
  );
}

/**
 * Aggiunge job sync giacenze immediato con retry esponenziali e DLQ.
 */
export async function queueInventorySync(tenantId: string, productId?: string) {
  if (!tenantId) throw new Error('queueInventorySync: tenantId obbligatorio');
  if (productId) {
    await wordpressQueue.add(
      `sync-inventory-${tenantId}-${productId}`,
      { type: 'sync-single-product', tenantId, productId },
      {
        ...WP_JOB_RETRY_OPTS,
        delay: 500,
      }
    );
  } else {
    await wordpressQueue.add(
      `immediate-inventory-sync-${tenantId}`,
      { type: 'sync-inventory', tenantId },
      WP_JOB_RETRY_OPTS
    );
  }
}
