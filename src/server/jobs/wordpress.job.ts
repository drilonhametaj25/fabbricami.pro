import { Job, Worker, Queue } from 'bullmq';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { wordpressService } from '../services/wordpress.service';
import { importJobService } from '../services/import-job.service';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// Queue per job WordPress
export const wordpressQueue = new Queue('wordpress', { connection });

// Tipi di job WordPress
type WordPressJobType =
  | 'sync-inventory'
  | 'sync-products'
  | 'sync-single-product'
  | 'import-orders'
  | 'update-order-status'
  | 'import-customers';

interface WordPressJobData {
  type: WordPressJobType;
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
 * Processor principale per job WordPress
 */
export async function processWordPressJob(job: Job<WordPressJobData>) {
  const { type, productId, orderId, status } = job.data;

  logger.info(`Processing WordPress job: ${type}`, { jobId: job.id });

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
    logger.error(`WordPress job ${type} failed:`, error);
    throw error;
  }
}

/**
 * Sync tutte le giacenze verso WooCommerce
 */
async function syncInventoryJob() {
  if (!wordpressService.isConfigured()) {
    logger.warn('WordPress non configurato, skip sync giacenze');
    return { skipped: true };
  }

  const result = await wordpressService.syncInventoryToWooCommerce();
  logger.info(`Sync giacenze completato: ${result.synced} sincronizzati, ${result.errors} errori`);
  return result;
}

/**
 * Sync tutti i prodotti verso WooCommerce
 */
async function syncProductsJob() {
  if (!wordpressService.isConfigured()) {
    logger.warn('WordPress non configurato, skip sync prodotti');
    return { skipped: true };
  }

  const result = await wordpressService.syncAllProductsToWooCommerce();
  logger.info(`Sync prodotti completato: ${result.synced} sincronizzati, ${result.errors} errori`);
  return result;
}

/**
 * Sync singolo prodotto verso WooCommerce
 */
async function syncSingleProductJob(productId: string) {
  if (!wordpressService.isConfigured()) {
    return { skipped: true };
  }

  const result = await wordpressService.syncProductToWooCommerce(productId);
  logger.info(`Sync prodotto ${productId}: ${result.success ? 'OK' : result.error}`);
  return result;
}

/**
 * Aggiorna stato ordine su WooCommerce
 */
async function updateOrderStatusJob(orderId: string, status: string) {
  if (!wordpressService.isConfigured()) {
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
  if (!wordpressService.isConfigured()) {
    logger.warn('WordPress non configurato, skip import clienti');
    return { skipped: true };
  }

  // Recupera stato precedente o inizializza
  let state = job.data.importCustomers || {
    currentPage: 1,
    totalCustomers: 0,
    imported: 0,
    updated: 0,
    errors: 0,
    startedAt: new Date().toISOString(),
    isPaused: false,
  };

  // Cerca o crea record ImportJob nel database
  let dbJob = await importJobService.getByBullmqJobId(job.id!);

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
export async function startCustomerImportJob(userId?: string): Promise<{ jobId: string; dbJobId: string }> {
  const bullmqJob = await wordpressQueue.add(
    'import-customers',
    {
      type: 'import-customers',
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

  worker.on('failed', (job, err) => {
    logger.error(`WordPress job ${job?.id} fallito:`, err);
  });

  return worker;
}

/**
 * Schedula job periodici WordPress
 */
export async function scheduleWordPressJobs() {
  if (!config.wordpress.syncEnabled) {
    logger.info('WordPress sync automatico disabilitato');
    return;
  }

  // Sync giacenze ogni 5 minuti (configurabile)
  await wordpressQueue.add(
    'scheduled-inventory-sync',
    { type: 'sync-inventory' },
    {
      repeat: {
        every: config.wordpress.syncInterval,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Sync prodotti ogni ora
  await wordpressQueue.add(
    'scheduled-products-sync',
    { type: 'sync-products' },
    {
      repeat: {
        pattern: '0 * * * *', // Ogni ora
      },
      removeOnComplete: 50,
      removeOnFail: 20,
    }
  );

  logger.info('WordPress scheduled jobs configurati');
}

/**
 * Aggiunge job sync singolo prodotto alla coda
 */
export async function queueProductSync(productId: string) {
  await wordpressQueue.add(
    `sync-product-${productId}`,
    { type: 'sync-single-product', productId },
    {
      delay: 1000, // Ritardo 1s per evitare duplicati
      removeOnComplete: true,
      removeOnFail: 10,
    }
  );
}

/**
 * Aggiunge job update stato ordine alla coda
 */
export async function queueOrderStatusUpdate(orderId: string, status: string) {
  await wordpressQueue.add(
    `update-order-${orderId}`,
    { type: 'update-order-status', orderId, status },
    {
      removeOnComplete: true,
      removeOnFail: 10,
    }
  );
}

/**
 * Aggiunge job sync giacenze immediato
 */
export async function queueInventorySync(productId?: string) {
  if (productId) {
    await wordpressQueue.add(
      `sync-inventory-${productId}`,
      { type: 'sync-single-product', productId },
      {
        delay: 500,
        removeOnComplete: true,
      }
    );
  } else {
    await wordpressQueue.add(
      'immediate-inventory-sync',
      { type: 'sync-inventory' },
      {
        removeOnComplete: true,
      }
    );
  }
}
