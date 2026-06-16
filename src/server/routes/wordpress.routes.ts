import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { wordpressService } from '../services/wordpress.service';
import wordpressPluginService from '../services/wordpress-plugin.service';
import wordpressSettingsService from '../services/wordpress-settings.service';
import { authenticateWordPressPlugin } from '../middleware/wordpress-plugin-auth.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { runWithTenant, enterTenant } from '../utils/tenant-context';
import { z } from 'zod';
import {
  startCustomerImportJob,
  getCustomerImportJobStatus,
  cancelCustomerImportJob,
  pauseCustomerImportJob,
  resumeCustomerImportJob,
  getActiveCustomerImportJobs,
  listDlqJobs,
  replayDlqJob,
  getDlqStats,
} from '../jobs/wordpress.job';
import { importJobService } from '../services/import-job.service';
import { authorize } from '../middleware/auth.middleware';

/**
 * Risolve tenantSlug (dall'URL della route) in tenantId.
 * Ritorna null se lo slug non corrisponde ad alcun tenant attivo.
 */
async function resolveTenantBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  const t = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!t || t.status !== 'ACTIVE') return null;
  return t.id;
}

/**
 * Localizza la cartella sorgente del plugin WordPress (`fabbricami-connector`).
 *
 * In dev gira con `tsx` da root (cwd = root del progetto); in produzione gira
 * da `/app` con i sorgenti compilati in `dist/server/server/...`. Proviamo più
 * percorsi candidati e usiamo il primo che contiene `fabbricami.php`.
 * Ritorna `null` se il plugin non è presente (es. non copiato nell'immagine).
 */
function resolvePluginSourceDir(): string | null {
  const candidates = [
    path.join(process.cwd(), 'wordpress-plugin', 'fabbricami-connector'),
    path.join(__dirname, '..', '..', '..', '..', 'wordpress-plugin', 'fabbricami-connector'),
    path.join(__dirname, '..', '..', '..', 'wordpress-plugin', 'fabbricami-connector'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'fabbricami.php'))) {
      return dir;
    }
  }
  return null;
}

// Schema validazione
const syncProductSchema = z.object({
  productId: z.string().uuid().optional(),
});

const syncInventorySchema = z.object({
  productId: z.string().uuid().optional(),
});

const wordpressRoutes: FastifyPluginAsync = async (server: any) => {
  // Hook globale per propagare tenantId nel context AsyncLocalStorage.
  // Le route admin usano `authenticate` (che setta request.user.tenantId);
  // le route plugin usano `authenticateWordPressPlugin` (che setta
  // request.wordpressPlugin.tenantId); le route webhook fanno il proprio
  // resolveTenantBySlug. Questo hook copre i primi due casi senza dover
  // wrappare manualmente ~40 handler in runWithTenant.
  server.addHook('preHandler', async (request: FastifyRequest) => {
    const user = (request as any).user;
    const plugin = (request as any).wordpressPlugin;
    const tenantId = plugin?.tenantId || user?.tenantId;
    if (tenantId) {
      enterTenant(tenantId);
    }
  });

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
   * POST /wordpress/webhook/:tenantSlug/order
   * Riceve webhook ordini da WooCommerce.
   *
   * Il `tenantSlug` nell'URL identifica il tenant proprietario del Woo da cui
   * arriva l'evento (ogni tenant configura il proprio webhook su Woo con il
   * suo slug). La signature è validata contro il webhook secret del tenant
   * risolto, non un secret globale.
   */
  server.post('/webhook/:tenantSlug/order', {
    config: {
      rawBody: true, // Per validazione firma
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantSlug } = request.params as { tenantSlug: string };
      const tenantId = await resolveTenantBySlug(tenantSlug);
      if (!tenantId) {
        return reply.status(404).send({ success: false, error: 'Tenant non trovato' });
      }

      // Valida firma webhook contro il webhook_secret del tenant
      const signature = request.headers['x-wc-webhook-signature'] as string;
      const rawBody = (request as any).rawBody || JSON.stringify(request.body);

      const sigValid = await wordpressService.validateWebhookSignature(tenantId, rawBody, signature);
      if (!sigValid) {
        logger.warn(`Webhook signature non valida (tenant=${tenantSlug})`);
        return reply.status(401).send({
          success: false,
          error: 'Invalid or missing webhook signature',
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

      // Processa ordine dentro al tenant context (così wordpressService legge
      // le credenziali e scrive sui modelli filtrando per tenantId)
      const result = await runWithTenant(tenantId, () =>
        wordpressService.processOrderWebhook(orderData)
      );

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
   * POST /wordpress/webhook/:tenantSlug/order-updated
   * Riceve webhook aggiornamento ordini da WooCommerce (per-tenant).
   */
  server.post('/webhook/:tenantSlug/order-updated', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantSlug } = request.params as { tenantSlug: string };
      const tenantId = await resolveTenantBySlug(tenantSlug);
      if (!tenantId) {
        return reply.status(404).send({ success: false, error: 'Tenant non trovato' });
      }

      const signature = request.headers['x-wc-webhook-signature'] as string;
      const rawBody = (request as any).rawBody || JSON.stringify(request.body);

      const sigValid = await wordpressService.validateWebhookSignature(tenantId, rawBody, signature);
      if (!sigValid) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or missing webhook signature',
        });
      }

      const orderData = request.body as any;

      if (!orderData || !orderData.id) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid order data',
        });
      }

      const result = await runWithTenant(tenantId, () =>
        wordpressService.processOrderWebhook(orderData)
      );

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

  /**
   * POST /wordpress/webhook/:tenantSlug/stock-update
   * Riceve webhook per aggiornamento stock da WooCommerce (per-tenant).
   */
  server.post('/webhook/:tenantSlug/stock-update', {
    config: {
      rawBody: true,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tenantSlug } = request.params as { tenantSlug: string };
      const tenantId = await resolveTenantBySlug(tenantSlug);
      if (!tenantId) {
        return reply.status(404).send({ success: false, error: 'Tenant non trovato' });
      }

      const signature = request.headers['x-wc-webhook-signature'] as string;
      const rawBody = (request as any).rawBody || JSON.stringify(request.body);

      const sigValid = await wordpressService.validateWebhookSignature(tenantId, rawBody, signature);
      if (!sigValid) {
        logger.warn(`Stock update webhook signature non valida (tenant=${tenantSlug})`);
        return reply.status(401).send({
          success: false,
          error: 'Invalid or missing webhook signature',
        });
      }

      const productData = request.body as any;

      // Ignora topic di test
      const topic = request.headers['x-wc-webhook-topic'];
      if (!topic || topic === 'action.woocommerce_scheduled_subscription_trial_end') {
        return reply.send({ success: true, message: 'Ignored test topic' });
      }

      // Verifica che sia un prodotto valido
      if (!productData || !productData.id) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid product data',
        });
      }

      // Processa aggiornamento stock nel tenant context
      const result = await runWithTenant(tenantId, () =>
        wordpressService.processStockUpdateWebhook(productData)
      );

      if (result.success) {
        return reply.send({
          success: true,
          data: {
            productId: result.productId,
            newStock: result.newStock,
            message: 'Stock aggiornato con successo',
          },
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: result.error,
        });
      }

    } catch (error: any) {
      logger.error('Errore webhook stock update:', error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /wordpress/plugin/stock-update
   * Riceve aggiornamento stock dal plugin WordPress
   */
  server.post('/plugin/:tenantSlug/stock-update', {
    preHandler: authenticateWordPressPlugin,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stockData = request.body as {
        woocommerceId: number;
        sku?: string;
        stockQuantity: number;
        stockStatus?: 'instock' | 'outofstock' | 'onbackorder';
      };

      const result = await wordpressService.processPluginStockUpdate(stockData);

      if (result.success) {
        return reply.send({
          success: true,
          data: {
            productId: result.productId,
            newStock: result.newStock,
            message: 'Stock aggiornato',
          },
        });
      } else {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

    } catch (error: any) {
      logger.error('Errore plugin stock update:', error);
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
   * Richiede autenticazione admin
   */
  server.post('/sync-products', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
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
   * Richiede autenticazione admin
   */
  server.post('/sync-inventory', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
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
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ success: false, error: 'tenantId mancante nel JWT' });
      }
      const result = await startCustomerImportJob(tenantId, user?.id);
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
   * Richiede autenticazione admin
   */
  server.post('/full-sync', { preHandler: authenticate }, async (_request: FastifyRequest, reply: FastifyReply) => {
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
  server.post('/plugin/:tenantSlug/order', {
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
  server.post('/plugin/:tenantSlug/order-status', {
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
  server.post('/plugin/:tenantSlug/customer', {
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
  server.put('/plugin/:tenantSlug/customer', {
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
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ success: false, error: 'tenantId mancante nel JWT' });
      }

      const result = await wordpressPluginService.generateCredentials(tenantId, label);

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

  /**
   * GET /wordpress/plugin/download
   * Scarica il plugin WordPress (.zip) pre-configurato per il tenant corrente.
   *
   * Lo ZIP contiene i sorgenti del plugin `fabbricami-connector` più un file
   * `tenant-config.json` con URL ERP, slug del tenant e credenziali Basic Auth
   * appena generate: il plugin le legge automaticamente all'attivazione.
   */
  server.get('/plugin/download', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ success: false, error: 'tenantId mancante nel JWT' });
      }

      // Risolvi lo slug del tenant (serve per le route plugin /:tenantSlug/...)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true, name: true, status: true },
      });
      if (!tenant || tenant.status !== 'ACTIVE') {
        return reply.status(404).send({ success: false, error: 'Tenant non trovato o non attivo' });
      }

      // Localizza i sorgenti del plugin sul server
      const pluginDir = resolvePluginSourceDir();
      if (!pluginDir) {
        logger.error('Sorgente plugin WordPress non trovata (cwd=%s)', process.cwd());
        return reply.status(500).send({
          success: false,
          error: 'Sorgente plugin non disponibile sul server',
        });
      }

      // Genera credenziali Basic Auth fresche da includere nel pacchetto.
      // Wrappiamo in runWithTenant per garantire il contesto sul write
      // del modello tenant-scoped WordPressPluginAuth.
      const today = new Date().toISOString().slice(0, 10);
      const { username, password } = await runWithTenant(tenantId, () =>
        wordpressPluginService.generateCredentials(tenantId, `Plugin download ${today}`)
      );

      // Base URL pubblica dell'ERP (rispetta il reverse proxy)
      const baseUrl =
        request.headers['x-forwarded-proto'] && request.headers['x-forwarded-host']
          ? `${request.headers['x-forwarded-proto']}://${request.headers['x-forwarded-host']}`
          : `${request.protocol}://${request.headers.host}`;
      const pluginBase = `${baseUrl}/api/v1/wordpress/plugin/${tenant.slug}`;

      const tenantConfig = {
        erp_url: baseUrl,
        tenant_slug: tenant.slug,
        tenant_name: tenant.name,
        plugin_base: pluginBase,
        username,
        password,
        generated_at: new Date().toISOString(),
        endpoints: {
          order: `${pluginBase}/order`,
          orderStatus: `${pluginBase}/order-status`,
          customer: `${pluginBase}/customer`,
          stockUpdate: `${pluginBase}/stock-update`,
        },
      };

      // Costruisci lo ZIP: sorgenti del plugin + tenant-config.json
      const zip = new AdmZip();
      zip.addLocalFolder(pluginDir, 'fabbricami-connector');
      zip.addFile(
        'fabbricami-connector/tenant-config.json',
        Buffer.from(JSON.stringify(tenantConfig, null, 2), 'utf-8')
      );
      const buffer = zip.toBuffer();

      reply.header('Content-Type', 'application/zip');
      reply.header(
        'Content-Disposition',
        `attachment; filename="fabbricami-connector-${tenant.slug}.zip"`
      );
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    } catch (error: any) {
      logger.error('Errore download plugin WordPress:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Impossibile generare il pacchetto plugin',
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ success: false, error: 'tenantId mancante nel JWT' });
      }
      const settings = await wordpressSettingsService.getSettingsForUI(tenantId);
      // Esporta anche le URL pubbliche che il tenant deve copiare nel suo Woo.
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });
      const baseUrl = (request.headers['x-forwarded-proto'] && request.headers['x-forwarded-host'])
        ? `${request.headers['x-forwarded-proto']}://${request.headers['x-forwarded-host']}`
        : `${request.protocol}://${request.headers.host}`;
      return reply.send({
        success: true,
        data: {
          ...settings,
          tenantSlug: tenant?.slug || null,
          webhookUrls: tenant?.slug
            ? {
                order: `${baseUrl}/api/v1/wordpress/webhook/${tenant.slug}/order`,
                orderUpdated: `${baseUrl}/api/v1/wordpress/webhook/${tenant.slug}/order-updated`,
                stockUpdate: `${baseUrl}/api/v1/wordpress/webhook/${tenant.slug}/stock-update`,
                pluginBase: `${baseUrl}/api/v1/wordpress/plugin/${tenant.slug}`,
              }
            : null,
        },
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
   * Salva impostazioni WooCommerce per il tenant corrente
   */
  server.put('/settings', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ success: false, error: 'tenantId mancante nel JWT' });
      }
      const body = request.body as {
        url?: string;
        consumerKey?: string;
        consumerSecret?: string;
        webhookSecret?: string;
        syncEnabled?: boolean;
        syncInterval?: number;
      };

      await wordpressSettingsService.saveSettings(tenantId, body);

      // Invalida la cache in-memory delle credenziali per questo tenant
      await runWithTenant(tenantId, () => wordpressService.reloadSettings());

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
   * Testa la connessione WooCommerce per il tenant corrente
   */
  server.post('/settings/test', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).user?.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ success: false, error: 'tenantId mancante nel JWT' });
      }
      const body = request.body as {
        url?: string;
        consumerKey?: string;
        consumerSecret?: string;
      };

      const result = await wordpressSettingsService.testConnection(
        tenantId,
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

  // ============================================
  // DLQ MANAGEMENT (admin only)
  // ============================================

  /**
   * GET /api/v1/wordpress/dlq/stats - Conta job in DLQ
   */
  server.get('/dlq/stats', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getDlqStats();
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      logger.error('DLQ stats error:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/v1/wordpress/dlq?limit=100 - Lista job in DLQ
   */
  server.get('/dlq', {
    preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 100;
      const jobs = await listDlqJobs(limit);
      return reply.send({ success: true, data: jobs });
    } catch (error: any) {
      logger.error('DLQ list error:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/v1/wordpress/dlq/:jobId/replay - Replay job dalla DLQ
   */
  server.post('/dlq/:jobId/replay', {
    preHandler: [authenticate, authorize('ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const result = await replayDlqJob(jobId);
      if (!result.replayed) {
        return reply.status(404).send({ success: false, error: 'DLQ job non trovato' });
      }
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      logger.error('DLQ replay error:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
};

export default wordpressRoutes;
