// Imports
import { initEmailWorker } from '../jobs/email.job';
import { initNotificationJobs } from '../jobs/notification.job';
import { initStockAlertJobs } from '../jobs/stock-alert.job';
import { initWordPressWorker } from '../jobs/wordpress.job';
import { initSdiWorker, scheduleSdiJobs } from '../jobs/sdi.job';
import { initSuggestionWorker, scheduleSuggestionJobs } from '../jobs/suggestion.job';
import { initTrialExpirationJobs } from '../jobs/trial-expiration.job';
import { initMrpJobs } from '../jobs/mrp.job';
import { initPaymentDueReminderJobs } from '../jobs/payment-due-reminder.job';
import { initPrestaShopJobs } from '../jobs/prestashop.job';
import { initWebSocket } from '../utils/websocket.util';
import { FastifyInstance } from 'fastify';
import logger from '../config/logger';
import queueManager from '../services/queue.service';

/**
 * Initialize Application Features
 * Inizializza tutte le funzionalità avanzate dell'ERP
 */

/**
 * Inizializza sistema code BullMQ
 */
export async function initQueueSystem() {
  try {
    logger.info('🔄 Initializing queue system...');

    // Inizializza worker per email
    initEmailWorker();
    logger.info('✅ Email worker initialized');

    // Inizializza job automatici notifiche
    initNotificationJobs();
    logger.info('✅ Notification jobs scheduled');

    // Inizializza job automatici per alert scorte
    initStockAlertJobs();
    logger.info('✅ Stock alert jobs scheduled');

    // Inizializza worker WordPress per import/sync
    initWordPressWorker();
    logger.info('✅ WordPress worker initialized');

    // Inizializza worker SDI per fatturazione elettronica
    initSdiWorker();
    await scheduleSdiJobs();
    logger.info('✅ SDI worker and jobs initialized');

    // Inizializza worker suggerimenti per dashboard intelligente
    initSuggestionWorker();
    await scheduleSuggestionJobs();
    logger.info('✅ Suggestion worker and jobs initialized');

    // Inizializza job per gestione scadenza trial
    initTrialExpirationJobs();
    logger.info('✅ Trial expiration jobs initialized');

    // Inizializza MRP jobs (ricalcolo notturno + capacity bottleneck alert)
    initMrpJobs();
    logger.info('✅ MRP jobs initialized');

    // Inizializza scadenzario + dunning jobs (cron 09:00)
    initPaymentDueReminderJobs();
    logger.info('✅ Payment due reminder & dunning jobs initialized');

    // Inizializza sync PrestaShop (pull/push ogni 15 min per i tenant abilitati)
    initPrestaShopJobs();

    logger.info('✅ Queue system initialized successfully');
  } catch (error: any) {
    logger.error(`❌ Failed to initialize queue system: ${error.message}`);
    throw error;
  }
}

/**
 * Inizializza WebSocket per real-time updates
 */
export async function initRealTimeSystem(server: FastifyInstance) {
  try {
    logger.info('🔌 Initializing WebSocket system...');

    initWebSocket(server);

    logger.info('✅ WebSocket system initialized on /ws endpoint');
  } catch (error: any) {
    logger.error(`❌ Failed to initialize WebSocket: ${error.message}`);
    throw error;
  }
}

/**
 * Inizializza job ricorrenti per maintenance
 */
export async function initMaintenanceJobs() {
  try {
    logger.info('🧹 Initializing maintenance jobs...');

    // Cleanup notifiche vecchie ogni giorno alle 3:00 AM
    await queueManager.addRecurringJob(
      'maintenance',
      'cleanup-old-notifications',
      { daysOld: 30 },
      '0 3 * * *'
    );

    // Cleanup queue completati ogni settimana
    await queueManager.addRecurringJob(
      'maintenance',
      'cleanup-queues',
      { grace: 86400000 }, // 24 ore
      '0 4 * * 0' // Domenica alle 4:00
    );

    logger.info('✅ Maintenance jobs scheduled');
  } catch (error: any) {
    logger.error(`❌ Failed to initialize maintenance jobs: ${error.message}`);
    throw error;
  }
}

/**
 * Graceful shutdown di tutti i sistemi
 */
export async function shutdownSystems() {
  logger.info('🛑 Shutting down systems...');

  try {
    // Chiudi tutte le queue e workers
    await queueManager.closeAll();
    logger.info('✅ Queue system closed');

    // TODO: Chiudi WebSocket connections
    // await closeAllWebSocketConnections();

    logger.info('✅ All systems shut down gracefully');
  } catch (error: any) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    throw error;
  }
}

/**
 * Health check per tutti i sistemi
 */
export async function getSystemsHealth() {
  try {
    // Check queue system
    const queueStats = await queueManager.getQueueStats('email');

    // TODO: Check WebSocket
    // const wsStats = getWebSocketStats();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      systems: {
        queues: {
          status: 'operational',
          stats: queueStats,
        },
        websocket: {
          status: 'operational',
          // stats: wsStats,
        },
      },
    };
  } catch (error: any) {
    logger.error(`Health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}
