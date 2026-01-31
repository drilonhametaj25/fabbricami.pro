import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { wordpressService } from '../services/wordpress.service';
import wordpressPluginService from '../services/wordpress-plugin.service';
import wordpressSettingsService from '../services/wordpress-settings.service';
import { authenticateWordPressPlugin } from '../middleware/wordpress-plugin-auth.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { z } from 'zod';
import {
  startCustomerImportJob,
  getCustomerImportJobStatus,
  cancelCustomerImportJob,
  pauseCustomerImportJob,
  resumeCustomerImportJob,
  getActiveCustomerImportJobs,
} from '../jobs/wordpress.job';
import { importJobService } from '../services/import-job.service';

// Schema validazione
const syncProductSchema = z.object({
  productId: z.string().uuid().optional(),
});

const syncInventorySchema = z.object({
  productId: z.string().uuid().optional(),
});

const wordpressRoutes: FastifyPluginAsync = async (server: any) => {
  // =============================================
  // HEALTH CHECK
  // =============================================

  /**
   * GET /wordpress/health
   * Verifica connessione a WooCommerce
   */
  server.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = await wordpressService.healthCheck();
    return reply.send({
      success: health.connected,
      data: health,
    });
  });

  // =============================================
  // WEBHOOK ORDINI
  // =============================================

  /**
   * POST /wordpress/webhook/order
   * Riceve webhook ordini da WooCommerce
   */
  server.post('/webhook/order', {
    config: {
      rawBody: true, // Per validazione firma
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Valida firma webhook
      const signature = request.headers['x-wc-webhook-signature'] as string;
      const rawBody = (request as any).rawBody || JSON.stringify(request.body);

      if (signature && !wordpressService.validateWebhookSignature(rawBody, signature)) {
        logger.warn('Webhook signature non valida');
        return reply.status(401).send({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      const orderData = request.body as any;

      // Ignora topic di test
      const topic = request.headers['x-wc-webhook-topic'];
      if (topic === 'action.woocommerce_scheduled_subscription_trial_end') {
        return reply.send({ success: true, message: 'Ignored test topic' });
      }

      // Verifica che sia un ordine valido
      if (!orderData || !orderData.id) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid order data',
        });
      }

      // Processa ordine
      const result = await wordpressService.processOrderWebhook(orderData);

      if (result.success) {
        return reply.send({
          success: true,
          data: {
            orderId: result.orderId,
            message: 'Ordine processato con successo',
          },
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: result.error,
        });
      }

    } catch (error: any) {
      logger.error('Errore webhook ordine:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/webhook/order-updated
   * Riceve webhook aggiornamento ordini da WooCommerce
   */
  server.post('/webhook/order-updated', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['x-wc-webhook-signature'] as string;
      const rawBody = JSON.stringify(request.body);

      if (signature && !wordpressService.validateWebhookSignature(rawBody, signature)) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      const orderData = request.body as any;

      if (!orderData || !orderData.id) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid order data',
        });
      }

      // Processa aggiornamento (usa stessa logica, gestisce update interno)
      const result = await wordpressService.processOrderWebhook(orderData);

      return reply.send({
        success: result.success,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore webhook order-updated:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // SYNC PRODOTTI
  // =============================================

  /**
   * POST /wordpress/sync/product/:productId
   * Sincronizza un singolo prodotto verso WooCommerce
   */
  server.post('/sync/product/:productId', {
    preHandler: authenticate,
  }, async (
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { productId } = request.params;

      if (!productId) {
        return reply.status(400).send({
          success: false,
          error: 'productId richiesto',
        });
      }

      logger.info(`Sync singolo prodotto: ${productId}`);

      const result = await wordpressService.syncProductToWooCommerce(productId);

      if (result.success) {
        return reply.send({
          success: true,
          data: {
            ...result,
            message: 'Prodotto sincronizzato con WordPress',
          },
        });
      } else {
        return reply.status(400).send({
          success: false,
          error: result.error || 'Errore sincronizzazione',
        });
      }

    } catch (error: any) {
      logger.error('Errore sync singolo prodotto:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/sync-products
   * Sincronizza tutti i prodotti verso WooCommerce
   */
  server.post('/sync-products', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = syncProductSchema.parse(request.body || {});

      if (body.productId) {
        // Sync singolo prodotto
        const result = await wordpressService.syncProductToWooCommerce(body.productId);
        return reply.send({
          success: result.success,
          data: result,
        });
      }

      // Sync tutti i prodotti
      const result = await wordpressService.syncAllProductsToWooCommerce();
      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore sync prodotti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-products
   * Importa prodotti da WooCommerce
   */
  server.post('/import-products', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status } = (request.body || {}) as { status?: 'publish' | 'draft' | 'any' };
      const result = await wordpressService.importProductsFromWooCommerce(status);
      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore import prodotti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // SYNC GIACENZE
  // =============================================

  /**
   * POST /wordpress/sync-inventory
   * Sincronizza giacenze verso WooCommerce
   */
  server.post('/sync-inventory', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = syncInventorySchema.parse(request.body || {});

      if (body.productId) {
        // Sync singolo prodotto
        const success = await wordpressService.syncSingleProductInventory(body.productId);
        return reply.send({
          success,
          data: { synced: success ? 1 : 0 },
        });
      }

      // Sync tutte le giacenze
      const result = await wordpressService.syncInventoryToWooCommerce();
      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore sync giacenze:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // SYNC CLIENTI
  // =============================================

  /**
   * POST /wordpress/import-customers
   * Importa clienti da WooCommerce
   */
  server.post('/import-customers', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await wordpressService.importCustomersFromWooCommerce();
      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore import clienti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // IMPORT CLIENTI ASINCRONO (Background Job)
  // =============================================

  /**
   * GET /wordpress/import-customers-jobs
   * Ottiene lista job di importazione attivi e recenti
   */
  server.get('/import-customers-jobs', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const jobs = await getActiveCustomerImportJobs();
      return reply.send({
        success: true,
        data: jobs,
      });
    } catch (error: any) {
      logger.error('Errore get import customers jobs:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-customers-async
   * Avvia importazione clienti in background
   * Ritorna immediatamente con jobId per tracking
   * Se esiste già un job attivo, ritorna quello invece di crearne uno nuovo
   */
  server.post('/import-customers-async', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Controlla se c'è già un job attivo nel database
      const activeDbJob = await importJobService.getActiveByType('CUSTOMERS');
      if (activeDbJob) {
        return reply.send({
          success: true,
          data: {
            jobId: activeDbJob.bullmqJobId,
            dbJobId: activeDbJob.id,
            existing: true,
          },
          message: 'Job di importazione già in corso',
        });
      }

      // Controlla anche in BullMQ
      const existingJobs = await getActiveCustomerImportJobs();

      if (existingJobs.active.length > 0) {
        return reply.send({
          success: true,
          data: { jobId: existingJobs.active[0].id, existing: true },
          message: 'Job di importazione già in corso',
        });
      }

      if (existingJobs.waiting.length > 0) {
        return reply.send({
          success: true,
          data: { jobId: existingJobs.waiting[0].id, existing: true },
          message: 'Job di importazione in attesa',
        });
      }

      const user = (request as any).user;
      const result = await startCustomerImportJob(user?.id);
      return reply.send({
        success: true,
        data: {
          jobId: result.jobId,
          dbJobId: result.dbJobId,
        },
        message: 'Importazione avviata in background',
      });
    } catch (error: any) {
      logger.error('Errore avvio import clienti async:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /wordpress/import-customers-status/:jobId
   * Ottiene stato e progresso del job di importazione
   */
  server.get('/import-customers-status/:jobId', {
    preHandler: authenticate,
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      const status = await getCustomerImportJobStatus(jobId);

      if (status.status === 'not_found') {
        return reply.status(404).send({
          success: false,
          error: 'Job non trovato',
        });
      }

      return reply.send({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Errore get status import clienti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-customers-cancel/:jobId
   * Cancella job di importazione in corso
   */
  server.post('/import-customers-cancel/:jobId', {
    preHandler: authenticate,
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      const cancelled = await cancelCustomerImportJob(jobId);

      if (!cancelled) {
        return reply.status(404).send({
          success: false,
          error: 'Job non trovato o già completato',
        });
      }

      return reply.send({
        success: true,
        message: 'Job cancellato',
      });
    } catch (error: any) {
      logger.error('Errore cancel import clienti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-customers-pause/:jobId
   * Mette in pausa job di importazione (salva stato)
   */
  server.post('/import-customers-pause/:jobId', {
    preHandler: authenticate,
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    try {
      const { jobId } = request.params;
      const result = await pauseCustomerImportJob(jobId);

      if (!result.success) {
        return reply.status(404).send({
          success: false,
          error: 'Job non trovato',
        });
      }

      return reply.send({
        success: true,
        data: { savedState: result.state },
        message: 'Job messo in pausa',
      });
    } catch (error: any) {
      logger.error('Errore pause import clienti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-customers-resume
   * Riprende job di importazione da un job precedente nel database
   */
  server.post('/import-customers-resume', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { dbJobId } = request.body as { dbJobId: string };

      if (!dbJobId) {
        return reply.status(400).send({
          success: false,
          error: 'dbJobId richiesto',
        });
      }

      const user = (request as any).user;
      const result = await resumeCustomerImportJob(dbJobId, user?.id);

      return reply.send({
        success: true,
        data: {
          jobId: result.jobId,
          dbJobId: result.dbJobId,
        },
        message: 'Importazione ripresa',
      });
    } catch (error: any) {
      logger.error('Errore resume import clienti:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // IMPORT JOBS HISTORY (Database persistence)
  // =============================================

  /**
   * GET /wordpress/import-jobs
   * Lista storico job di importazione dal database
   */
  server.get('/import-jobs', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type, status, limit = '20', offset = '0' } = request.query as Record<string, string>;

      const result = await importJobService.list({
        type: type as any,
        status: status as any,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return reply.send({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error: any) {
      logger.error('Errore get import jobs:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /wordpress/import-jobs/:id
   * Dettaglio singolo job di importazione
   */
  server.get('/import-jobs/:id', {
    preHandler: authenticate,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const job = await importJobService.getById(id);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: 'Job non trovato',
        });
      }

      return reply.send({
        success: true,
        data: job,
      });
    } catch (error: any) {
      logger.error('Errore get import job:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /wordpress/import-jobs/resumable
   * Lista job che possono essere ripresi (PAUSED o FAILED)
   */
  server.get('/import-jobs/resumable', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type } = request.query as { type?: string };
      const jobs = await importJobService.getResumableJobs(type as any);

      return reply.send({
        success: true,
        data: jobs,
      });
    } catch (error: any) {
      logger.error('Errore get resumable jobs:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-jobs/:id/resume
   * Riprende un job interrotto dal suo ID database
   */
  server.post('/import-jobs/:id/resume', {
    preHandler: authenticate,
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const user = (request as any).user;

      const result = await resumeCustomerImportJob(id, user?.id);

      return reply.send({
        success: true,
        data: {
          jobId: result.jobId,
          dbJobId: result.dbJobId,
        },
        message: 'Job ripreso con successo',
      });
    } catch (error: any) {
      logger.error('Errore resume import job:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /wordpress/import-jobs/stats
   * Statistiche sui job di importazione
   */
  server.get('/import-jobs/stats', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await importJobService.getStats();

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Errore get import job stats:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /wordpress/import-jobs/cleanup
   * Pulisce job vecchi (completati/cancellati)
   */
  server.delete('/import-jobs/cleanup', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { daysToKeep = '30' } = request.query as { daysToKeep?: string };
      const deleted = await importJobService.cleanOldJobs(parseInt(daysToKeep));

      return reply.send({
        success: true,
        data: {
          deleted,
          message: `Eliminati ${deleted} job più vecchi di ${daysToKeep} giorni`,
        },
      });
    } catch (error: any) {
      logger.error('Errore cleanup import jobs:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-orders
   * Importa ordini da WooCommerce
   */
  server.post('/import-orders', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, overwrite = true } = (request.body || {}) as { status?: string; overwrite?: boolean };
      // Usa importOrdersWithDependencies che crea anche gli OrderItems
      const result = await wordpressService.importOrdersWithDependencies({ status, overwrite });
      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore import ordini:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // UPDATE STATO ORDINE
  // =============================================

  /**
   * POST /wordpress/orders/:orderId/sync-status
   * Aggiorna stato ordine su WooCommerce
   */
  server.post('/orders/:orderId/sync-status', async (
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { orderId } = request.params;
      const { status } = request.body as { status: string };

      if (!status) {
        return reply.status(400).send({
          success: false,
          error: 'Status richiesto',
        });
      }

      const success = await wordpressService.updateOrderStatusOnWooCommerce(orderId, status);

      return reply.send({
        success,
        data: {
          orderId,
          status,
          synced: success,
        },
      });

    } catch (error: any) {
      logger.error('Errore sync stato ordine:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // SYNC COMPLETO
  // =============================================

  /**
   * POST /wordpress/full-sync
   * Esegue sync completo bidirezionale
   */
  server.post('/full-sync', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const results = {
        customers: await wordpressService.importCustomersFromWooCommerce(),
        productsImport: await wordpressService.importProductsFromWooCommerce(),
        productsExport: await wordpressService.syncAllProductsToWooCommerce(),
        inventory: await wordpressService.syncInventoryToWooCommerce(),
      };

      return reply.send({
        success: true,
        data: results,
      });

    } catch (error: any) {
      logger.error('Errore full sync:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // PLUGIN COMMUNICATION (Basic Auth)
  // Endpoint per ricevere dati dal plugin WordPress
  // =============================================

  /**
   * GET /wordpress/plugin/health
   * Health check per il plugin WordPress
   */
  server.get('/plugin/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const syncStatus = await wordpressService.getSyncStatus();
    return reply.send({
      success: true,
      status: 'ok',
      version: '1.0.0',
      syncStatus,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /wordpress/plugin/order
   * Ricevi nuovo ordine dal plugin WordPress
   */
  server.post('/plugin/order', {
    preHandler: authenticateWordPressPlugin,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const orderData = request.body as any;
      const startTime = Date.now();

      const result = await wordpressService.processPluginOrder(orderData);

      // Log operazione
      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'ORDER',
        orderData.wordpressOrderId?.toString() || '',
        'CREATE',
        result.success ? 'SUCCESS' : 'FAILED',
        {
          request: { orderNumber: orderData.orderNumber },
          response: result,
          error: result.error,
          duration: Date.now() - startTime,
        }
      );

      if (result.success) {
        return reply.send({
          success: true,
          data: {
            id: result.orderId,
            message: 'Ordine ricevuto',
          },
        });
      } else {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

    } catch (error: any) {
      logger.error('Errore ricezione ordine plugin:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/plugin/order-status
   * Ricevi cambio stato ordine dal plugin
   */
  server.post('/plugin/order-status', {
    preHandler: authenticateWordPressPlugin,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as any;
      const result = await wordpressService.processPluginOrderStatus(data);

      return reply.send({
        success: result.success,
        error: result.error,
      });

    } catch (error: any) {
      logger.error('Errore aggiornamento stato ordine plugin:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/plugin/customer
   * Ricevi nuovo cliente dal plugin
   */
  server.post('/plugin/customer', {
    preHandler: authenticateWordPressPlugin,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const customerData = request.body as any;
      const startTime = Date.now();

      const result = await wordpressService.processPluginCustomer(customerData);

      // Log operazione
      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'CUSTOMER',
        customerData.wordpressCustomerId?.toString() || customerData.email || '',
        'CREATE',
        result.success ? 'SUCCESS' : 'FAILED',
        {
          request: { email: customerData.email },
          response: result,
          error: result.error,
          duration: Date.now() - startTime,
        }
      );

      if (result.success) {
        return reply.send({
          success: true,
          data: {
            id: result.customerId,
            message: 'Cliente ricevuto',
          },
        });
      } else {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

    } catch (error: any) {
      logger.error('Errore ricezione cliente plugin:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PUT /wordpress/plugin/customer
   * Aggiorna cliente esistente dal plugin
   */
  server.put('/plugin/customer', {
    preHandler: authenticateWordPressPlugin,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const customerData = request.body as any;
      const result = await wordpressService.processPluginCustomer(customerData);

      return reply.send({
        success: result.success,
        data: result.success ? { id: result.customerId } : undefined,
        error: result.error,
      });

    } catch (error: any) {
      logger.error('Errore aggiornamento cliente plugin:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // CREDENZIALI PLUGIN (JWT Admin)
  // =============================================

  /**
   * GET /wordpress/credentials
   * Lista credenziali plugin
   */
  server.get('/credentials', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const credentials = await wordpressPluginService.listCredentials();
      return reply.send({
        success: true,
        data: credentials,
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/credentials
   * Crea nuove credenziali plugin
   */
  server.post('/credentials', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { label } = request.body as { label?: string };

      const result = await wordpressPluginService.generateCredentials(label);

      return reply.send({
        success: true,
        data: {
          ...result.credential,
          username: result.username,
          password: result.password, // Mostrato solo alla creazione!
        },
        message: 'Credenziali create. Salva la password, non sarà più visibile.',
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /wordpress/credentials/:id
   * Revoca credenziali plugin
   */
  server.delete('/credentials/:id', {
    preHandler: authenticate,
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      await wordpressPluginService.deleteCredentials(id);

      return reply.send({
        success: true,
        message: 'Credenziali eliminate',
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PUT /wordpress/credentials/:id/toggle
   * Attiva/disattiva credenziali
   */
  server.put('/credentials/:id/toggle', {
    preHandler: authenticate,
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = request.params;
      const { active } = request.body as { active: boolean };

      if (active) {
        await wordpressPluginService.activateCredentials(id);
      } else {
        await wordpressPluginService.revokeCredentials(id);
      }

      return reply.send({
        success: true,
        message: active ? 'Credenziali attivate' : 'Credenziali disattivate',
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // SYNC WEB PRODUCTS (con campi web-specifici)
  // =============================================

  /**
   * POST /wordpress/sync-web-products
   * Sincronizza prodotti con webActive=true
   */
  server.post('/sync-web-products', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productId } = (request.body || {}) as { productId?: string };

      if (productId) {
        const result = await wordpressService.syncWebProductToWooCommerce(productId);
        return reply.send({
          success: result.success,
          data: result,
        });
      }

      const result = await wordpressService.syncAllWebProductsToWooCommerce();
      return reply.send({
        success: true,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore sync web products:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/sync-variable-product
   * Sincronizza un prodotto variabile specifico
   */
  server.post('/sync-variable-product', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productId } = request.body as { productId: string };

      if (!productId) {
        return reply.status(400).send({
          success: false,
          error: 'productId richiesto',
        });
      }

      const result = await wordpressService.syncVariableProductToWooCommerce(productId);
      return reply.send({
        success: result.success,
        data: result,
      });

    } catch (error: any) {
      logger.error('Errore sync prodotto variabile:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // SYNC STATUS & LOGS
  // =============================================

  /**
   * GET /wordpress/sync-status
   * Stato sincronizzazione WordPress
   */
  server.get('/sync-status', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await wordpressService.getSyncStatus();
      const stats = await wordpressPluginService.getSyncStats(7);

      return reply.send({
        success: true,
        data: {
          ...status,
          recentActivity: stats,
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /wordpress/sync-logs
   * Log sincronizzazione
   */
  server.get('/sync-logs', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        direction,
        entity,
        status,
        limit = '50',
        offset = '0',
      } = request.query as Record<string, string>;

      const result = await wordpressPluginService.getSyncLogs({
        direction,
        entity,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return reply.send({
        success: true,
        data: result.logs,
        pagination: {
          total: result.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * DELETE /wordpress/sync-logs
   * Pulisci log vecchi
   */
  server.delete('/sync-logs', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { daysToKeep = '30' } = request.query as Record<string, string>;
      const deleted = await wordpressPluginService.cleanOldLogs(parseInt(daysToKeep));

      return reply.send({
        success: true,
        data: {
          deleted,
          message: `Eliminati ${deleted} log più vecchi di ${daysToKeep} giorni`,
        },
      });

    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // CONFIGURAZIONE WOOCOMMERCE
  // =============================================

  /**
   * GET /wordpress/settings
   * Ottieni impostazioni WooCommerce (senza secrets completi)
   */
  server.get('/settings', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await wordpressSettingsService.getSettingsForUI();
      return reply.send({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      logger.error('Errore lettura settings:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PUT /wordpress/settings
   * Salva impostazioni WooCommerce
   */
  server.put('/settings', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        url?: string;
        consumerKey?: string;
        consumerSecret?: string;
        webhookSecret?: string;
        syncEnabled?: boolean;
        syncInterval?: number;
      };

      await wordpressSettingsService.saveSettings(body);

      // Ricarica le impostazioni nel service
      await wordpressService.reloadSettings();

      return reply.send({
        success: true,
        message: 'Impostazioni salvate',
      });
    } catch (error: any) {
      logger.error('Errore salvataggio settings:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/settings/test
   * Testa la connessione WooCommerce
   */
  server.post('/settings/test', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        url?: string;
        consumerKey?: string;
        consumerSecret?: string;
      };

      // Se vengono passati parametri, testa quelli, altrimenti testa settings salvate
      const result = await wordpressSettingsService.testConnection(
        body?.url ? body : undefined
      );

      return reply.send({
        success: result.success,
        message: result.message,
        data: result.details,
      });
    } catch (error: any) {
      logger.error('Errore test connessione:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/settings/generate-webhook-secret
   * Genera un nuovo webhook secret
   */
  server.post('/settings/generate-webhook-secret', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const secret = wordpressSettingsService.generateWebhookSecret();
      return reply.send({
        success: true,
        data: { secret },
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // IMPORT/EXPORT MASSIVO
  // =============================================

  /**
   * GET /wordpress/import-preview
   * Ottieni conteggi per preview import wizard
   */
  server.get('/import-preview', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const preview = await wordpressService.getImportPreview();
      return reply.send({
        success: true,
        data: preview,
      });

    } catch (error: any) {
      logger.error('Errore import preview:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/bulk-import
   * Import massivo da WooCommerce a ERP
   */
  server.post('/bulk-import', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = request.body as {
        importProducts?: boolean;
        importCustomers?: boolean;
        importOrders?: boolean;
        overwriteExisting?: boolean;
        productStatus?: 'publish' | 'draft' | 'any';
        orderStatus?: string;
        fromDate?: string;
      };

      const startTime = Date.now();

      const result = await wordpressService.bulkImportFromWooCommerce({
        ...options,
        fromDate: options.fromDate ? new Date(options.fromDate) : undefined,
      });

      // Log operazione
      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'PRODUCT',
        'bulk',
        'IMPORT',
        'SUCCESS',
        {
          request: options,
          response: result,
          duration: Date.now() - startTime,
        }
      );

      return reply.send({
        success: true,
        data: result,
        duration: Date.now() - startTime,
      });

    } catch (error: any) {
      logger.error('Errore bulk import:', error);

      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'PRODUCT',
        'bulk',
        'IMPORT',
        'FAILED',
        {
          error: error.message,
        }
      );

      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/full-import
   * Import completo con tutte le relazioni (categorie, immagini, varianti, inventario)
   */
  server.post('/full-import', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = request.body as {
        importCategories?: boolean;
        importShippingClasses?: boolean;
        importProducts?: boolean;
        productStatus?: 'publish' | 'draft' | 'any';
        overwriteExisting?: boolean;
      };

      const startTime = Date.now();

      const result = await wordpressService.fullImportFromWooCommerce(options);

      // Log operazione
      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'PRODUCT',
        'full',
        'IMPORT',
        'SUCCESS',
        {
          request: options,
          response: result,
          duration: Date.now() - startTime,
        }
      );

      return reply.send({
        success: true,
        data: result,
        duration: Date.now() - startTime,
      });

    } catch (error: any) {
      logger.error('Errore full import:', error);

      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'PRODUCT',
        'full',
        'IMPORT',
        'FAILED',
        {
          error: error.message,
        }
      );

      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-categories
   * Import solo categorie da WooCommerce
   */
  server.post('/import-categories', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await wordpressService.importAllCategories();
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Errore import categorie:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-attributes
   * Import attributi globali da WooCommerce (es: Colore, Taglia)
   */
  server.post('/import-attributes', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await wordpressService.importAllAttributes();
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Errore import attributi:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-tags
   * Import tutti i tag da WooCommerce
   */
  server.post('/import-tags', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await wordpressService.importAllTags();
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Errore import tags:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // =============================================
  // IMPORT CON DIPENDENZE AUTOMATICHE
  // =============================================

  /**
   * POST /wordpress/smart-import
   * Import completo intelligente con gestione automatica dipendenze
   * Ordine: Categorie → Classi spedizione → Clienti → Prodotti → Ordini
   */
  server.post('/smart-import', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = request.body as {
        importCategories?: boolean;
        importShippingClasses?: boolean;
        importCustomers?: boolean;
        importProducts?: boolean;
        importOrders?: boolean;
        productStatus?: 'publish' | 'draft' | 'any';
        orderStatus?: string;
        overwrite?: boolean;
      };

      const startTime = Date.now();

      const result = await wordpressService.smartFullImport(options);

      // Log operazione
      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'PRODUCT',
        'smart',
        'IMPORT',
        'SUCCESS',
        {
          request: options,
          response: result,
          duration: Date.now() - startTime,
        }
      );

      return reply.send({
        success: true,
        data: result,
        duration: Date.now() - startTime,
      });

    } catch (error: any) {
      logger.error('Errore smart import:', error);

      await wordpressPluginService.logSyncOperation(
        'FROM_WP',
        'PRODUCT',
        'smart',
        'IMPORT',
        'FAILED',
        {
          error: error.message,
        }
      );

      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-orders-with-deps
   * Import ordini con creazione automatica clienti e prodotti mancanti
   */
  server.post('/import-orders-with-deps', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = request.body as {
        status?: string;
        fromDate?: string;
        overwrite?: boolean;
      };

      const startTime = Date.now();

      const result = await wordpressService.importOrdersWithDependencies({
        ...options,
        fromDate: options.fromDate ? new Date(options.fromDate) : undefined,
      });

      return reply.send({
        success: true,
        data: result,
        duration: Date.now() - startTime,
      });

    } catch (error: any) {
      logger.error('Errore import ordini con dipendenze:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-products-with-deps
   * Import prodotti con creazione automatica categorie mancanti
   */
  server.post('/import-products-with-deps', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = request.body as {
        status?: 'publish' | 'draft' | 'any';
        overwrite?: boolean;
      };

      const startTime = Date.now();

      const result = await wordpressService.importProductsWithDependencies(options);

      return reply.send({
        success: true,
        data: result,
        duration: Date.now() - startTime,
      });

    } catch (error: any) {
      logger.error('Errore import prodotti con dipendenze:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/export-categories
   * Export categorie verso WooCommerce
   */
  server.post('/export-categories', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await wordpressService.exportCategoriesToWooCommerce();
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Errore export categorie:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/import-shipping-classes
   * Import solo classi di spedizione da WooCommerce
   */
  server.post('/import-shipping-classes', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await wordpressService.importAllShippingClasses();
      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Errore import shipping classes:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/bulk-export
   * Export massivo da ERP a WooCommerce
   */
  server.post('/bulk-export', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const options = request.body as {
        productIds?: string[];
        includeVariants?: boolean;
        includeInventory?: boolean;
      };

      const startTime = Date.now();

      const result = await wordpressService.bulkExportToWooCommerce(options);

      // Log operazione
      await wordpressPluginService.logSyncOperation(
        'TO_WP',
        'PRODUCT',
        'bulk',
        'EXPORT',
        'SUCCESS',
        {
          request: options,
          response: {
            productsSynced: result.products.synced,
            productsErrors: result.products.errors,
          },
          duration: Date.now() - startTime,
        }
      );

      return reply.send({
        success: true,
        data: result,
        duration: Date.now() - startTime,
      });

    } catch (error: any) {
      logger.error('Errore bulk export:', error);

      await wordpressPluginService.logSyncOperation(
        'TO_WP',
        'PRODUCT',
        'bulk',
        'EXPORT',
        'FAILED',
        {
          error: error.message,
        }
      );

      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
};

export default wordpressRoutes;
