/**
 * Suggestion Background Jobs
 * Job automatici per generazione suggerimenti dashboard e email digest
 */

import { Job, Worker, Queue } from 'bullmq';
import { suggestionEngineService } from '../services/suggestion-engine.service';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { emailService } from '../services/email.service';

// URL frontend per link nelle email
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// Queue per suggerimenti
export const suggestionQueue = new Queue('suggestion', { connection });

// Tipi di job
type SuggestionJobType =
  | 'generate-all'
  | 'cleanup-expired'
  | 'daily-digest'
  | 'weekly-digest'
  | 'auto-resolve';

interface SuggestionJobData {
  type: SuggestionJobType;
  userId?: string;
  data?: any;
}

/**
 * Processor principale per job suggerimenti
 */
export async function processSuggestionJob(job: Job<SuggestionJobData>): Promise<void> {
  const { type } = job.data;

  logger.info(`Processing suggestion job ${job.id}: type=${type}`);

  try {
    switch (type) {
      case 'generate-all':
        await processGenerateAll();
        break;

      case 'cleanup-expired':
        await processCleanupExpired();
        break;

      case 'daily-digest':
        await processDailyDigest();
        break;

      case 'weekly-digest':
        await processWeeklyDigest();
        break;

      case 'auto-resolve':
        await processAutoResolve();
        break;

      default:
        throw new Error(`Tipo job suggerimenti sconosciuto: ${type}`);
    }

    logger.info(`Suggestion job ${job.id} completato con successo`);
  } catch (error: any) {
    logger.error(`Suggestion job ${job.id} fallito:`, error);
    throw error;
  }
}

/**
 * Genera tutti i suggerimenti
 * Esegue tutti gli algoritmi del motore suggerimenti
 */
async function processGenerateAll() {
  logger.info('Avvio generazione suggerimenti notturna...');

  const startTime = Date.now();

  // Esegui tutti gli algoritmi
  const result = await suggestionEngineService.runAllAlgorithms();

  const duration = Date.now() - startTime;

  logger.info(
    `Generazione completata in ${duration}ms: ` +
    `creati=${result.created}, errori=${result.errors.length}`
  );

  if (result.errors.length > 0) {
    logger.warn('Errori durante generazione:', result.errors);
  }

  // Log statistiche run
  logger.info(`Suggestion generation stats: created=${result.created}, errors=${result.errors.length}, duration=${duration}ms`);
}

/**
 * Pulisce suggerimenti scaduti
 * Marca come EXPIRED i suggerimenti con expiresAt passato
 */
async function processCleanupExpired() {
  logger.info('Cleanup suggerimenti scaduti...');

  const now = new Date();

  const updated = await prisma.suggestion.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        lt: now,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  logger.info(`Marcati ${updated.count} suggerimenti come scaduti`);
}

/**
 * Processa auto-risoluzione suggerimenti
 * Verifica se i suggerimenti sono stati risolti automaticamente
 */
async function processAutoResolve() {
  logger.info('Verifica auto-risoluzione suggerimenti...');

  const pendingSuggestions = await prisma.suggestion.findMany({
    where: {
      status: 'PENDING',
    },
    include: {
      product: true,
      material: true,
    },
  });

  let resolved = 0;

  for (const suggestion of pendingSuggestions) {
    let shouldResolve = false;

    switch (suggestion.type) {
      case 'STOCKOUT_ALERT':
      case 'REORDER':
        // Se lo stock è tornato sopra il livello minimo
        if (suggestion.productId) {
          const inventory = await prisma.inventoryItem.aggregate({
            where: { productId: suggestion.productId },
            _sum: { quantity: true },
          });
          const product = suggestion.product;
          if (product && (inventory._sum.quantity || 0) > (product.minStock || 0)) {
            shouldResolve = true;
          }
        }
        if (suggestion.materialId) {
          const material = await prisma.material.findUnique({
            where: { id: suggestion.materialId },
          });
          if (material && material.currentStock > (material.minStock || 0)) {
            shouldResolve = true;
          }
        }
        break;

      case 'PAYMENT_DUE':
        // Se la fattura è stata pagata
        if (suggestion.data && typeof suggestion.data === 'object') {
          const data = suggestion.data as any;
          if (data.invoiceId) {
            const invoice = await prisma.invoice.findUnique({
              where: { id: data.invoiceId },
            });
            if (invoice && invoice.status === 'PAID') {
              shouldResolve = true;
            }
          }
        }
        break;

      case 'DEAD_STOCK':
        // Se il prodotto ha avuto vendite recenti
        if (suggestion.productId) {
          const recentOrders = await prisma.orderItem.count({
            where: {
              productId: suggestion.productId,
              order: {
                orderDate: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
          });
          if (recentOrders > 0) {
            shouldResolve = true;
          }
        }
        break;
    }

    if (shouldResolve) {
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: {
          status: 'AUTO_RESOLVED',
        },
      });
      resolved++;
    }
  }

  logger.info(`Auto-risolti ${resolved} suggerimenti`);
}

/**
 * Invia email digest giornaliero
 * Riassume i suggerimenti critici e urgenti agli utenti abilitati
 */
async function processDailyDigest() {
  logger.info('Invio digest giornaliero suggerimenti...');

  if (!emailService.isEnabled()) {
    logger.warn('Email service non abilitato, skip digest');
    return;
  }

  // Trova utenti con digest giornaliero abilitato
  const usersWithDigest = await prisma.userDashboardPreference.findMany({
    where: {
      emailDailyDigest: true,
    },
    include: {
      user: true,
    },
  });

  if (usersWithDigest.length === 0) {
    logger.info('Nessun utente con digest giornaliero abilitato');
    return;
  }

  // Recupera suggerimenti critici e alti delle ultime 24 ore
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const criticalSuggestions = await prisma.suggestion.findMany({
    where: {
      status: 'PENDING',
      priority: { in: ['CRITICAL', 'HIGH'] },
      createdAt: { gte: yesterday },
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 20,
  });

  if (criticalSuggestions.length === 0) {
    logger.info('Nessun suggerimento critico da inviare');
    return;
  }

  // Statistiche generali
  const stats = await suggestionEngineService.getStats();

  let sentCount = 0;

  for (const userPref of usersWithDigest) {
    if (!userPref.user.email || !userPref.user.isActive) continue;

    try {
      await sendDailyDigestEmail(
        userPref.user.email,
        `${userPref.user.firstName} ${userPref.user.lastName}`,
        criticalSuggestions,
        stats
      );
      sentCount++;
    } catch (error: any) {
      logger.error(`Errore invio digest a ${userPref.user.email}:`, error);
    }
  }

  logger.info(`Inviati ${sentCount} digest giornalieri`);
}

/**
 * Invia email digest settimanale
 * Report completo settimanale con statistiche e trend
 */
async function processWeeklyDigest() {
  logger.info('Invio digest settimanale suggerimenti...');

  if (!emailService.isEnabled()) {
    logger.warn('Email service non abilitato, skip digest');
    return;
  }

  // Trova utenti con digest settimanale abilitato
  const usersWithDigest = await prisma.userDashboardPreference.findMany({
    where: {
      emailWeeklyDigest: true,
    },
    include: {
      user: true,
    },
  });

  if (usersWithDigest.length === 0) {
    logger.info('Nessun utente con digest settimanale abilitato');
    return;
  }

  // Statistiche settimana
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const weekStats = {
    created: await prisma.suggestion.count({
      where: { createdAt: { gte: lastWeek } },
    }),
    acted: await prisma.suggestion.count({
      where: {
        status: 'ACTED',
        actedAt: { gte: lastWeek },
      },
    }),
    dismissed: await prisma.suggestion.count({
      where: {
        status: 'DISMISSED',
        dismissedAt: { gte: lastWeek },
      },
    }),
    autoResolved: await prisma.suggestion.count({
      where: {
        status: 'AUTO_RESOLVED',
        updatedAt: { gte: lastWeek },
      },
    }),
  };

  // Top suggerimenti per tipo
  const byType = await prisma.suggestion.groupBy({
    by: ['type'],
    where: { createdAt: { gte: lastWeek } },
    _count: true,
    orderBy: { _count: { type: 'desc' } },
    take: 5,
  });

  // Risparmio potenziale totale
  const savings = await prisma.suggestion.aggregate({
    where: {
      status: 'ACTED',
      actedAt: { gte: lastWeek },
      potentialSaving: { not: null },
    },
    _sum: { potentialSaving: true },
  });

  let sentCount = 0;

  for (const userPref of usersWithDigest) {
    if (!userPref.user.email || !userPref.user.isActive) continue;

    try {
      await sendWeeklyDigestEmail(
        userPref.user.email,
        `${userPref.user.firstName} ${userPref.user.lastName}`,
        weekStats,
        byType,
        Number(savings._sum.potentialSaving || 0)
      );
      sentCount++;
    } catch (error: any) {
      logger.error(`Errore invio digest settimanale a ${userPref.user.email}:`, error);
    }
  }

  logger.info(`Inviati ${sentCount} digest settimanali`);
}

/**
 * Helper: Invia email digest giornaliero
 */
async function sendDailyDigestEmail(
  email: string,
  name: string,
  suggestions: any[],
  stats: any
) {
  const priorityLabels: Record<string, string> = {
    CRITICAL: '🔴 Critico',
    HIGH: '🟠 Alto',
    MEDIUM: '🟡 Medio',
    LOW: '🟢 Basso',
  };

  const suggestionsList = suggestions
    .map(s => `• [${priorityLabels[s.priority] || s.priority}] ${s.title}`)
    .join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a365d;">📊 Report Giornaliero Suggerimenti</h2>

      <p>Ciao ${name},</p>

      <p>Ecco il riepilogo dei suggerimenti che richiedono la tua attenzione:</p>

      <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #2d3748; margin-top: 0;">Statistiche</h3>
        <ul style="list-style: none; padding: 0;">
          <li>📌 In attesa: <strong>${stats.byStatus?.PENDING || 0}</strong></li>
          <li>🔴 Critici: <strong>${stats.byPriority?.CRITICAL || 0}</strong></li>
          <li>🟠 Alta priorità: <strong>${stats.byPriority?.HIGH || 0}</strong></li>
        </ul>
      </div>

      <div style="background: #fff5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e53e3e;">
        <h3 style="color: #c53030; margin-top: 0;">Suggerimenti Urgenti</h3>
        <pre style="white-space: pre-wrap; font-family: inherit;">${suggestionsList}</pre>
      </div>

      <p style="color: #718096; font-size: 14px;">
        Accedi alla <a href="${FRONTEND_URL}/dashboard">Dashboard</a> per maggiori dettagli.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

      <p style="color: #a0aec0; font-size: 12px;">
        Puoi disabilitare questo digest dalle <a href="${FRONTEND_URL}/settings/dashboard">impostazioni dashboard</a>.
      </p>
    </div>
  `;

  await emailService.send({
    to: email,
    subject: `📊 Report Giornaliero - ${suggestions.length} suggerimenti urgenti`,
    html,
  });
}

/**
 * Helper: Invia email digest settimanale
 */
async function sendWeeklyDigestEmail(
  email: string,
  name: string,
  weekStats: any,
  byType: any[],
  totalSavings: number
) {
  const typeLabels: Record<string, string> = {
    REORDER: 'Riordini',
    STOCKOUT_ALERT: 'Alert Stock',
    MARGIN_ALERT: 'Marginalità',
    TREND_UP: 'Trend Positivi',
    TREND_DOWN: 'Trend Negativi',
    DEAD_STOCK: 'Stock Morto',
    PAYMENT_DUE: 'Pagamenti',
    SUPPLIER_ISSUE: 'Fornitori',
  };

  const typesList = byType
    .map(t => `• ${typeLabels[t.type] || t.type}: ${t._count}`)
    .join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a365d;">📈 Report Settimanale Dashboard</h2>

      <p>Ciao ${name},</p>

      <p>Ecco il riepilogo settimanale delle attività sulla tua dashboard:</p>

      <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #2d3748; margin-top: 0;">Questa Settimana</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;">📝 Suggerimenti creati</td>
            <td style="text-align: right;"><strong>${weekStats.created}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">✅ Completati</td>
            <td style="text-align: right;"><strong style="color: #38a169;">${weekStats.acted}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">❌ Scartati</td>
            <td style="text-align: right;"><strong style="color: #e53e3e;">${weekStats.dismissed}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">🔄 Auto-risolti</td>
            <td style="text-align: right;"><strong style="color: #3182ce;">${weekStats.autoResolved}</strong></td>
          </tr>
        </table>
      </div>

      ${totalSavings > 0 ? `
      <div style="background: #c6f6d5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #276749; margin-top: 0;">💰 Risparmio Stimato</h3>
        <p style="font-size: 24px; font-weight: bold; color: #276749; margin: 0;">
          €${totalSavings.toFixed(2)}
        </p>
        <p style="color: #48bb78; margin: 5px 0 0;">dai suggerimenti completati questa settimana</p>
      </div>
      ` : ''}

      <div style="background: #ebf8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #2b6cb0; margin-top: 0;">📊 Per Categoria</h3>
        <pre style="white-space: pre-wrap; font-family: inherit;">${typesList}</pre>
      </div>

      <p style="color: #718096; font-size: 14px;">
        Accedi alla <a href="${FRONTEND_URL}/dashboard">Dashboard</a> per maggiori dettagli.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

      <p style="color: #a0aec0; font-size: 12px;">
        Puoi disabilitare questo digest dalle <a href="${FRONTEND_URL}/settings/dashboard">impostazioni dashboard</a>.
      </p>
    </div>
  `;

  await emailService.send({
    to: email,
    subject: `📈 Report Settimanale - ${weekStats.acted} suggerimenti completati`,
    html,
  });
}

/**
 * Inizializza worker suggerimenti
 */
export function initSuggestionWorker() {
  const worker = new Worker<SuggestionJobData>(
    'suggestion',
    processSuggestionJob,
    {
      connection,
      concurrency: 1, // Solo 1 job alla volta per evitare conflitti
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Suggestion job ${job.id} completato`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Suggestion job ${job?.id} fallito:`, err);
  });

  return worker;
}

/**
 * Schedula job suggerimenti periodici
 */
export async function scheduleSuggestionJobs() {
  // Generazione suggerimenti ogni notte alle 02:00
  await suggestionQueue.add(
    'scheduled-generate-all',
    { type: 'generate-all' },
    {
      repeat: {
        pattern: '0 2 * * *', // Ogni giorno alle 02:00
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  // Cleanup suggerimenti scaduti ogni giorno alle 03:00
  await suggestionQueue.add(
    'scheduled-cleanup-expired',
    { type: 'cleanup-expired' },
    {
      repeat: {
        pattern: '0 3 * * *', // Ogni giorno alle 03:00
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  // Auto-risoluzione ogni 6 ore
  await suggestionQueue.add(
    'scheduled-auto-resolve',
    { type: 'auto-resolve' },
    {
      repeat: {
        pattern: '0 */6 * * *', // Ogni 6 ore
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  // Digest giornaliero alle 08:00
  await suggestionQueue.add(
    'scheduled-daily-digest',
    { type: 'daily-digest' },
    {
      repeat: {
        pattern: '0 8 * * *', // Ogni giorno alle 08:00
      },
      removeOnComplete: 30,
      removeOnFail: 10,
    }
  );

  // Digest settimanale lunedì alle 09:00
  await suggestionQueue.add(
    'scheduled-weekly-digest',
    { type: 'weekly-digest' },
    {
      repeat: {
        pattern: '0 9 * * 1', // Ogni lunedì alle 09:00
      },
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );

  logger.info('Suggestion scheduled jobs configurati');
}

// =============================================
// HELPER FUNCTIONS PER QUEUE
// =============================================

/**
 * Forza generazione immediata suggerimenti
 */
export async function queueGenerateAll() {
  await suggestionQueue.add(
    `generate-all-${Date.now()}`,
    { type: 'generate-all' },
    { removeOnComplete: true, attempts: 1 }
  );
}

/**
 * Forza invio digest giornaliero
 */
export async function queueDailyDigest() {
  await suggestionQueue.add(
    `daily-digest-${Date.now()}`,
    { type: 'daily-digest' },
    { removeOnComplete: true, attempts: 1 }
  );
}

/**
 * Forza invio digest settimanale
 */
export async function queueWeeklyDigest() {
  await suggestionQueue.add(
    `weekly-digest-${Date.now()}`,
    { type: 'weekly-digest' },
    { removeOnComplete: true, attempts: 1 }
  );
}
