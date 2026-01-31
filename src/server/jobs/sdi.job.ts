/**
 * SDI Job
 * Background jobs per fatturazione elettronica
 *
 * Jobs:
 * - Poll stato fatture inviate (ogni 5 minuti)
 * - Poll notifiche SDI (ogni 15 minuti)
 * - Retry fatture fallite (ogni giorno alle 03:00)
 * - Genera report giornaliero SDI (ogni giorno alle 08:00)
 */

import { Job, Worker, Queue } from 'bullmq';
import { sdiService } from '../services/sdi';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/environment';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// Queue per job SDI
export const sdiQueue = new Queue('sdi', { connection });

// Tipi di job SDI
type SdiJobType =
  | 'poll-status'
  | 'poll-notifications'
  | 'retry-failed'
  | 'send-invoice'
  | 'generate-xml'
  | 'daily-report';

interface SdiJobData {
  type: SdiJobType;
  invoiceId?: string;
  invoiceIds?: string[];
  maxRetries?: number;
}

/**
 * Processor principale per job SDI
 */
export async function processSdiJob(job: Job<SdiJobData>): Promise<void> {
  const { type, invoiceId, maxRetries } = job.data;

  logger.info(`Processing SDI job ${job.id}: type=${type}`);

  try {
    switch (type) {
      case 'poll-status':
        await processPollStatus();
        break;

      case 'poll-notifications':
        await processPollNotifications();
        break;

      case 'retry-failed':
        await processRetryFailed(maxRetries || 3);
        break;

      case 'send-invoice':
        if (!invoiceId) throw new Error('invoiceId richiesto');
        await processSendInvoice(invoiceId);
        break;

      case 'generate-xml':
        if (!invoiceId) throw new Error('invoiceId richiesto');
        await processGenerateXml(invoiceId);
        break;

      case 'daily-report':
        await processDailyReport();
        break;

      default:
        throw new Error(`Tipo job SDI sconosciuto: ${type}`);
    }

    logger.info(`SDI job ${job.id} completato con successo`);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`SDI job ${job.id} fallito:`, err);
    throw error;
  }
}

/**
 * Poll stato fatture inviate a SDI
 * Controlla tutte le fatture in stato PENDING e aggiorna lo stato
 */
async function processPollStatus(): Promise<void> {
  logger.info('Avvio poll stato fatture SDI...');

  // Trova fatture in stato PENDING o DELIVERED (in attesa di esito)
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      sdiStatus: { in: ['PENDING', 'DELIVERED'] },
      sdiId: { not: null },
    },
    select: {
      id: true,
      invoiceNumber: true,
      sdiId: true,
      sdiStatus: true,
    },
  });

  if (pendingInvoices.length === 0) {
    logger.info('Nessuna fattura in attesa di stato SDI');
    return;
  }

  logger.info(`Controllo stato per ${pendingInvoices.length} fatture`);

  let updated = 0;
  let errors = 0;

  for (const invoice of pendingInvoices) {
    try {
      const result = await sdiService.updateInvoiceStatus(invoice.id);

      if (result && result.status !== invoice.sdiStatus) {
        logger.info(`Fattura ${invoice.invoiceNumber}: ${invoice.sdiStatus} → ${result.status}`);
        updated++;

        // Se rifiutata, invia notifica
        if (result.status === 'REJECTED') {
          await notifyInvoiceRejected(invoice.id);
        }
      }
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Errore aggiornamento stato ${invoice.invoiceNumber}:`, err.message);
      errors++;
    }

    // Pausa breve tra richieste per non sovraccaricare il provider
    await sleep(500);
  }

  logger.info(`Poll stato completato: ${updated} aggiornate, ${errors} errori`);
}

/**
 * Poll notifiche da SDI
 * Verifica notifiche per fatture inviate
 */
async function processPollNotifications(): Promise<void> {
  logger.info('Avvio poll notifiche SDI...');

  // Trova fatture inviate negli ultimi 30 giorni
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentInvoices = await prisma.invoice.findMany({
    where: {
      sdiId: { not: null },
      sdiSentAt: { gte: thirtyDaysAgo },
      sdiStatus: { notIn: ['NOT_SENT', 'ACCEPTED'] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      sdiId: true,
    },
  });

  if (recentInvoices.length === 0) {
    logger.info('Nessuna fattura recente da verificare');
    return;
  }

  logger.info(`Verifica notifiche per ${recentInvoices.length} fatture`);

  for (const invoice of recentInvoices) {
    try {
      // Usa il servizio per aggiornare lo stato che include anche le notifiche
      await sdiService.updateInvoiceStatus(invoice.id);
    } catch (error: unknown) {
      const err = error as Error;
      logger.warn(`Errore notifiche ${invoice.invoiceNumber}:`, err.message);
    }

    await sleep(300);
  }

  logger.info('Poll notifiche completato');
}

/**
 * Retry fatture fallite
 * Tenta di reinviare fatture in stato REJECTED o NOT_DELIVERABLE
 */
async function processRetryFailed(maxRetries: number): Promise<void> {
  logger.info(`Avvio retry fatture fallite (max ${maxRetries} tentativi)...`);

  // Trova fatture fallite che non hanno superato il max retry
  const failedInvoices = await prisma.invoice.findMany({
    where: {
      sdiStatus: { in: ['REJECTED', 'NOT_DELIVERABLE'] },
      // Escludi fatture già ritentate troppe volte (basandosi sui log errore)
    },
    select: {
      id: true,
      invoiceNumber: true,
      sdiStatus: true,
      sdiErrorCode: true,
      sdiErrorMessage: true,
    },
  });

  if (failedInvoices.length === 0) {
    logger.info('Nessuna fattura fallita da ritentare');
    return;
  }

  logger.info(`Tentativo reinvio per ${failedInvoices.length} fatture`);

  let retried = 0;
  let skipped = 0;

  for (const invoice of failedInvoices) {
    try {
      // Verifica se l'errore è risolvibile automaticamente
      if (isRetryableError(invoice.sdiErrorCode)) {
        const result = await sdiService.retryFailedInvoice(invoice.id);

        if (result.success) {
          logger.info(`Fattura ${invoice.invoiceNumber} reinviata con successo`);
          retried++;
        } else {
          logger.warn(`Fattura ${invoice.invoiceNumber} retry fallito: ${result.error}`);
          skipped++;
        }
      } else {
        logger.info(`Fattura ${invoice.invoiceNumber} richiede intervento manuale (${invoice.sdiErrorCode})`);
        skipped++;
      }
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Errore retry ${invoice.invoiceNumber}:`, err.message);
      skipped++;
    }

    await sleep(1000);
  }

  logger.info(`Retry completato: ${retried} reinviate, ${skipped} saltate`);
}

/**
 * Invia una singola fattura a SDI
 */
async function processSendInvoice(invoiceId: string): Promise<void> {
  logger.info(`Invio fattura ${invoiceId} a SDI...`);

  const result = await sdiService.sendInvoiceToSdi(invoiceId);

  if (!result.success) {
    throw new Error(result.error || 'Errore invio fattura');
  }

  logger.info(`Fattura ${invoiceId} inviata: SDI ID ${result.sdiId}`);
}

/**
 * Genera XML per una fattura
 */
async function processGenerateXml(invoiceId: string): Promise<void> {
  logger.info(`Generazione XML per fattura ${invoiceId}...`);

  const result = await sdiService.generateInvoiceXml(invoiceId);

  if (!result.success) {
    throw new Error(result.errors?.join(', ') || 'Errore generazione XML');
  }

  logger.info(`XML generato: ${result.fileName}`);
}

/**
 * Genera report giornaliero SDI
 */
async function processDailyReport(): Promise<void> {
  logger.info('Generazione report giornaliero SDI...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Statistiche del giorno precedente
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [sent, accepted, rejected, pending] = await Promise.all([
    prisma.invoice.count({
      where: {
        sdiSentAt: { gte: yesterday, lt: today },
      },
    }),
    prisma.invoice.count({
      where: {
        sdiStatus: 'ACCEPTED',
        sdiReceivedAt: { gte: yesterday, lt: today },
      },
    }),
    prisma.invoice.count({
      where: {
        sdiStatus: 'REJECTED',
        updatedAt: { gte: yesterday, lt: today },
      },
    }),
    prisma.invoice.count({
      where: {
        sdiStatus: 'PENDING',
      },
    }),
  ]);

  const report = {
    date: yesterday.toISOString().split('T')[0],
    sent,
    accepted,
    rejected,
    pendingTotal: pending,
    successRate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
  };

  logger.info('Report SDI giornaliero:', report);

  // Nota: Per salvare le statistiche SDI nel DailySummary, aggiungere i campi al modello Prisma:
  // sdiSent Int @default(0) @map("sdi_sent")
  // sdiAccepted Int @default(0) @map("sdi_accepted")
  // sdiRejected Int @default(0) @map("sdi_rejected")
  // Per ora logghiamo solo le statistiche

  // Se ci sono fatture rifiutate, notifica
  if (rejected > 0) {
    await notifyDailyRejections(rejected, yesterday);
  }
}

/**
 * Verifica se un errore SDI è ritentabile automaticamente
 */
function isRetryableError(errorCode: string | null): boolean {
  if (!errorCode) return true;

  // Errori non ritentabili (richiedono correzione dati)
  const permanentErrors = [
    '00001', // File non conforme al formato
    '00002', // File non leggibile
    '00100', // IdFiscaleIVA mancante
    '00200', // IdCodice o CodiceFiscale mancante
    '00300', // Data non valida
    '00400', // Formato importo non valido
    '00403', // Valore campo non valido
    '00417', // Identificativo duplicato
    '00427', // Soggetto emittente non valorizzato
  ];

  return !permanentErrors.includes(errorCode);
}

/**
 * Notifica fattura rifiutata
 */
async function notifyInvoiceRejected(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceNumber: true,
        sdiErrorCode: true,
        sdiErrorMessage: true,
        customer: {
          select: { businessName: true, firstName: true, lastName: true },
        },
      },
    });

    if (!invoice) return;

    const customerName = invoice.customer?.businessName ||
      `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim();

    // Trova utenti admin/contabili per la notifica
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER', 'CONTABILE'] },
        isActive: true,
      },
      select: { id: true },
      take: 10,
    });

    // Crea notifica per ogni utente
    for (const user of users) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: `Fattura ${invoice.invoiceNumber} rifiutata da SDI`,
          message: `La fattura ${invoice.invoiceNumber} per ${customerName} è stata rifiutata. Errore: ${invoice.sdiErrorCode} - ${invoice.sdiErrorMessage}`,
          link: `/accounting/invoices/${invoiceId}`,
        },
      });
    }

    logger.info(`Notifica creata per rifiuto fattura ${invoice.invoiceNumber}`);
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn('Errore creazione notifica rifiuto:', err.message);
  }
}

/**
 * Notifica riepilogo giornaliero rifiuti
 */
async function notifyDailyRejections(count: number, date: Date): Promise<void> {
  try {
    const dateStr = date.toLocaleDateString('it-IT');

    // Trova utenti admin/contabili per la notifica
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER', 'CONTABILE'] },
        isActive: true,
      },
      select: { id: true },
      take: 10,
    });

    // Crea notifica per ogni utente
    for (const user of users) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'SYSTEM',
          title: `Report SDI: ${count} fatture rifiutate`,
          message: `Nel giorno ${dateStr} sono state rifiutate ${count} fatture. Verificare e correggere gli errori.`,
          link: '/accounting/invoices?sdiStatus=REJECTED',
        },
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn('Errore notifica riepilogo rifiuti:', err.message);
  }
}

/**
 * Utility sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Inizializza worker SDI
 */
export function initSdiWorker() {
  const worker = new Worker<SdiJobData>(
    'sdi',
    processSdiJob,
    {
      connection,
      concurrency: 1, // Un job alla volta per SDI
      limiter: {
        max: 10,
        duration: 60000, // Max 10 richieste al minuto
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`SDI job ${job.id} completato`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`SDI job ${job?.id} fallito:`, err);
  });

  return worker;
}

/**
 * Schedula job SDI periodici
 */
export async function scheduleSdiJobs() {
  // Poll stato fatture ogni 5 minuti (durante orario lavorativo)
  await sdiQueue.add(
    'scheduled-poll-status',
    { type: 'poll-status' },
    {
      repeat: {
        pattern: '*/5 8-20 * * 1-6', // Ogni 5 min, 8-20, lun-sab
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Poll notifiche ogni 15 minuti
  await sdiQueue.add(
    'scheduled-poll-notifications',
    { type: 'poll-notifications' },
    {
      repeat: {
        pattern: '*/15 * * * *', // Ogni 15 minuti
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  // Retry fatture fallite ogni giorno alle 03:00
  await sdiQueue.add(
    'scheduled-retry-failed',
    { type: 'retry-failed', maxRetries: 3 },
    {
      repeat: {
        pattern: '0 3 * * *', // Ogni giorno alle 03:00
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  // Report giornaliero alle 08:00
  await sdiQueue.add(
    'scheduled-daily-report',
    { type: 'daily-report' },
    {
      repeat: {
        pattern: '0 8 * * *', // Ogni giorno alle 08:00
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  logger.info('SDI scheduled jobs configurati');
}

// =============================================
// HELPER FUNCTIONS PER QUEUE
// =============================================

/**
 * Aggiunge job invio fattura a SDI
 */
export async function queueSendInvoice(invoiceId: string) {
  await sdiQueue.add(
    `send-invoice-${invoiceId}`,
    { type: 'send-invoice', invoiceId },
    {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 }, // Retry dopo 1, 2, 4 minuti
    }
  );
}

/**
 * Aggiunge job generazione XML
 */
export async function queueGenerateXml(invoiceId: string) {
  await sdiQueue.add(
    `generate-xml-${invoiceId}`,
    { type: 'generate-xml', invoiceId },
    {
      removeOnComplete: true,
      attempts: 2,
      backoff: { type: 'fixed', delay: 5000 },
    }
  );
}

/**
 * Forza poll stato per una fattura specifica
 */
export async function queuePollStatus() {
  await sdiQueue.add(
    'manual-poll-status',
    { type: 'poll-status' },
    { removeOnComplete: true }
  );
}
