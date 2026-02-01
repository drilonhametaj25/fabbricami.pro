/**
 * SDI Routes
 * API per Fatturazione Elettronica
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { sdiService } from '../services/sdi';
import { companySettingsService } from '../services/company-settings.service';
import { exportService } from '../services/export.service';
import { SdiStatus } from '@prisma/client';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const companySettingsSchema = z.object({
  companyName: z.string().min(1, 'Ragione sociale obbligatoria'),
  legalName: z.string().optional(),
  vatNumber: z.string().min(11, 'Partita IVA obbligatoria'),
  fiscalCode: z.string().optional(),
  reaNumber: z.string().optional(),
  capitalAmount: z.number().optional(),
  legalForm: z.string().optional(),
  address: z.string().min(1, 'Indirizzo obbligatorio'),
  city: z.string().min(1, 'Città obbligatoria'),
  province: z.string().length(2, 'Provincia deve essere 2 caratteri'),
  postalCode: z.string().length(5, 'CAP deve essere 5 cifre'),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email non valida'),
  pec: z.string().email('PEC non valida').optional(),
  website: z.string().url().optional(),
  sdiCode: z.string().max(7).optional(),
  sdiPec: z.string().email().optional(),
  sdiProvider: z.enum(['aruba', 'infocert', 'other']).optional(),
  sdiProviderApiKey: z.string().optional(),
  sdiProviderApiSecret: z.string().optional(),
  sdiProviderEndpoint: z.string().url().optional(),
  taxRegime: z.string().optional(),
  socialSecurityType: z.string().optional(),
  socialSecurityRate: z.number().min(0).max(100).optional(),
  withholdingTaxType: z.string().optional(),
  withholdingTaxRate: z.number().min(0).max(100).optional(),
  logoUrl: z.string().url().optional(),
  invoicePrefix: z.string().optional(),
  invoiceNextNumber: z.number().int().positive().optional(),
  creditNotePrefix: z.string().optional(),
  creditNoteNextNumber: z.number().int().positive().optional(),
  ddtPrefix: z.string().optional(),
  ddtNextNumber: z.number().int().positive().optional(),
  invoiceFooterNotes: z.string().optional(),
  paymentInstructions: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
});

const sdiInvoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sdiStatus: z.nativeEnum(SdiStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ============================================
// ROUTES
// ============================================

const sdiRoutes: FastifyPluginAsync = async (server) => {
  // ============================================
  // COMPANY SETTINGS
  // ============================================

  /**
   * GET /api/v1/sdi/company-settings
   * Recupera impostazioni aziendali
   */
  server.get(
    '/company-settings',
    { preHandler: authenticate },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const settings = await companySettingsService.get();
        return reply.send({ success: true, data: settings });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero impostazioni',
        });
      }
    }
  );

  /**
   * PUT /api/v1/sdi/company-settings
   * Aggiorna impostazioni aziendali
   */
  server.put(
    '/company-settings',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = companySettingsSchema.parse(request.body);
        const settings = await companySettingsService.upsert(data);
        return reply.send({ success: true, data: settings });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore aggiornamento impostazioni',
        });
      }
    }
  );

  /**
   * GET /api/v1/sdi/company-settings/validate
   * Verifica se impostazioni sono complete per SDI
   */
  server.get(
    '/company-settings/validate',
    { preHandler: authenticate },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [invoicingCheck, sdiCheck] = await Promise.all([
          companySettingsService.isConfiguredForInvoicing(),
          companySettingsService.isConfiguredForSdi(),
        ]);

        return reply.send({
          success: true,
          data: {
            invoicing: invoicingCheck,
            sdi: sdiCheck,
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore validazione',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/company-settings/validate-vat
   * Valida Partita IVA
   */
  server.post(
    '/company-settings/validate-vat',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { vatNumber } = request.body as { vatNumber: string };
        const result = companySettingsService.validateVatNumber(vatNumber);
        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore validazione',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/company-settings/validate-iban
   * Valida IBAN
   */
  server.post(
    '/company-settings/validate-iban',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { iban } = request.body as { iban: string };
        const result = companySettingsService.validateIban(iban);
        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore validazione',
        });
      }
    }
  );

  // ============================================
  // SDI INVOICES
  // ============================================

  /**
   * GET /api/v1/sdi/invoices
   * Lista fatture con stato SDI
   */
  server.get(
    '/invoices',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = sdiInvoiceQuerySchema.parse(request.query);
        const result = await sdiService.listInvoicesWithSdiStatus(query);
        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore lista fatture',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/invoices/:id/generate-xml
   * Genera XML FatturaPA per una fattura
   */
  server.post(
    '/invoices/:id/generate-xml',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await sdiService.generateInvoiceXml(id);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.errors?.join(', ') || 'Errore generazione XML',
          });
        }

        return reply.send({
          success: true,
          data: {
            fileName: result.fileName,
            message: 'XML generato con successo',
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore generazione XML',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/invoices/:id/send
   * Invia fattura a SDI
   */
  server.post(
    '/invoices/:id/send',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await sdiService.sendInvoiceToSdi(id);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.error || 'Errore invio fattura',
            errorCode: result.errorCode,
          });
        }

        return reply.send({
          success: true,
          data: {
            sdiId: result.sdiId,
            fileName: result.fileName,
            sentAt: result.sentAt,
            message: 'Fattura inviata a SDI',
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore invio fattura',
        });
      }
    }
  );

  /**
   * GET /api/v1/sdi/invoices/:id/status
   * Recupera stato fattura da SDI
   */
  server.get(
    '/invoices/:id/status',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const status = await sdiService.updateInvoiceStatus(id);

        if (!status) {
          return reply.status(404).send({
            success: false,
            error: 'Fattura non trovata o non ancora inviata a SDI',
          });
        }

        return reply.send({ success: true, data: status });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero stato',
        });
      }
    }
  );

  /**
   * GET /api/v1/sdi/invoices/:id/xml
   * Recupera XML di una fattura
   */
  server.get(
    '/invoices/:id/xml',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const xml = await sdiService.getInvoiceXml(id);

        if (!xml) {
          return reply.status(404).send({
            success: false,
            error: 'XML non trovato',
          });
        }

        // Restituisce XML con content-type corretto
        return reply
          .header('Content-Type', 'application/xml')
          .header('Content-Disposition', `attachment; filename="fattura_${id}.xml"`)
          .send(xml);
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero XML',
        });
      }
    }
  );

  /**
   * GET /api/v1/sdi/invoices/:id/pdf
   * Scarica PDF fattura elettronica
   */
  server.get(
    '/invoices/:id/pdf',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await exportService.getInvoicePdfFile(id);

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${result.fileName}"`)
          .send(result.buffer);
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore generazione PDF',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/invoices/:id/generate-pdf
   * Genera/rigenera PDF fattura elettronica
   */
  server.post(
    '/invoices/:id/generate-pdf',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await exportService.generateFatturaElettronicaPdf(id);

        return reply.send({
          success: true,
          data: {
            filePath: result.filePath,
            message: 'PDF generato con successo',
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore generazione PDF',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/invoices/:id/validate
   * Valida XML FatturaPA per una fattura
   */
  server.post(
    '/invoices/:id/validate',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await sdiService.validateInvoiceXml(id);

        return reply.send({
          success: true,
          data: {
            valid: result.valid,
            errors: result.errors,
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore validazione XML',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/validate-xml
   * Valida un XML FatturaPA generico (non legato a fattura)
   */
  server.post(
    '/validate-xml',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { xml } = request.body as { xml: string };

        if (!xml) {
          return reply.status(400).send({
            success: false,
            error: 'XML mancante nel body',
          });
        }

        const result = sdiService.validateXmlString(xml);

        return reply.send({
          success: true,
          data: {
            valid: result.valid,
            errors: result.errors,
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore validazione XML',
        });
      }
    }
  );

  /**
   * POST /api/v1/sdi/invoices/:id/retry
   * Reinvia fattura fallita
   */
  server.post(
    '/invoices/:id/retry',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await sdiService.retryFailedInvoice(id);

        if (!result.success) {
          return reply.status(400).send({
            success: false,
            error: result.error || 'Errore reinvio fattura',
          });
        }

        return reply.send({
          success: true,
          data: {
            sdiId: result.sdiId,
            message: 'Fattura reinviata a SDI',
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore reinvio fattura',
        });
      }
    }
  );

  // ============================================
  // SDI WEBHOOKS
  // ============================================

  /**
   * POST /api/v1/sdi/webhook/aruba
   * Webhook per notifiche da Aruba SDI
   */
  server.post(
    '/webhook/aruba',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await sdiService.processWebhook('aruba', request.body);

        if (!result.processed) {
          return reply.status(400).send({
            success: false,
            error: 'Webhook non processato',
          });
        }

        return reply.send({
          success: true,
          data: {
            invoiceId: result.invoiceId,
            message: 'Notifica processata',
          },
        });
      } catch (error: unknown) {
        const err = error as Error;
        // I webhook devono sempre rispondere 200 per evitare retry
        return reply.send({
          success: false,
          error: err.message || 'Errore webhook',
        });
      }
    }
  );

  // ============================================
  // SDI CONNECTION TEST
  // ============================================

  /**
   * GET /api/v1/sdi/test-connection
   * Testa connessione con provider SDI
   */
  server.get(
    '/test-connection',
    { preHandler: authenticate },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Configura provider
        const configured = await sdiService.configureProvider();

        if (!configured) {
          return reply.send({
            success: true,
            data: {
              connected: false,
              message: 'Provider SDI non configurato. Completare le impostazioni aziendali.',
            },
          });
        }

        // Importa il servizio Aruba direttamente per il test
        const { arubaSdiService } = await import('../services/sdi/aruba-sdi.service');
        const result = await arubaSdiService.testConnection();

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore test connessione',
        });
      }
    }
  );
};

export default sdiRoutes;
