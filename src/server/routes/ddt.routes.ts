/**
 * DDT Routes
 * API per Documenti Di Trasporto
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { ddtService } from '../services/ddt.service';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const ddtQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isInvoiced: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const shippingAddressSchema = z.object({
  street: z.string().min(1, 'Indirizzo obbligatorio'),
  city: z.string().min(1, 'Città obbligatoria'),
  province: z.string().optional(),
  zip: z.string().min(1, 'CAP obbligatorio'),
  country: z.string().optional(),
});

const ddtItemSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  sku: z.string().min(1, 'SKU obbligatorio'),
  description: z.string().min(1, 'Descrizione obbligatoria'),
  quantity: z.number().positive('Quantità deve essere positiva'),
  unit: z.string().optional(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
});

const createDdtSchema = z.object({
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid('ID cliente obbligatorio'),
  issueDate: z.string().datetime().optional(),
  transportDate: z.string().datetime().optional(),
  shippingAddress: shippingAddressSchema,
  carrier: z.string().optional(),
  carrierNotes: z.string().optional(),
  numberOfPackages: z.number().int().positive().optional(),
  totalWeight: z.number().min(0).optional(),
  transportReason: z.string().optional(),
  shipmentAppearance: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  items: z.array(ddtItemSchema).min(1, 'Almeno un articolo richiesto'),
});

const updateDdtSchema = z.object({
  transportDate: z.string().datetime().optional(),
  shippingAddress: shippingAddressSchema.optional(),
  carrier: z.string().optional(),
  carrierNotes: z.string().optional(),
  numberOfPackages: z.number().int().positive().optional(),
  totalWeight: z.number().min(0).optional(),
  transportReason: z.string().optional(),
  shipmentAppearance: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

const addItemSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  sku: z.string().min(1, 'SKU obbligatorio'),
  description: z.string().min(1, 'Descrizione obbligatoria'),
  quantity: z.number().positive('Quantità deve essere positiva'),
  unit: z.string().optional(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
});

const updateItemSchema = z.object({
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
});

const createFromOrderSchema = z.object({
  carrier: z.string().optional(),
  notes: z.string().optional(),
});

const markAsInvoicedSchema = z.object({
  ddtIds: z.array(z.string().uuid()).min(1, 'Almeno un DDT richiesto'),
  invoiceId: z.string().uuid('ID fattura obbligatorio'),
});

const periodReportSchema = z.object({
  dateFrom: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data inizio non valida'),
  dateTo: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data fine non valida'),
});

const cloneDdtSchema = z.object({
  newCustomerId: z.string().uuid().optional(),
});

// ============================================
// ROUTES
// ============================================

const ddtRoutes: FastifyPluginAsync = async (server) => {
  // ============================================
  // DDT CRUD
  // ============================================

  /**
   * GET /api/v1/ddt
   * Lista DDT con filtri e paginazione
   */
  server.get(
    '/',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = ddtQuerySchema.parse(request.query);
        const result = await ddtService.list(query);
        return reply.send({ success: true, data: result });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore lista DDT',
        });
      }
    }
  );

  /**
   * GET /api/v1/ddt/:id
   * Recupera un DDT per ID
   */
  server.get(
    '/:id',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const ddt = await ddtService.getById(id);

        if (!ddt) {
          return reply.status(404).send({
            success: false,
            error: 'DDT non trovato',
          });
        }

        return reply.send({ success: true, data: ddt });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero DDT',
        });
      }
    }
  );

  /**
   * GET /api/v1/ddt/number/:ddtNumber
   * Recupera un DDT per numero
   */
  server.get(
    '/number/:ddtNumber',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ddtNumber } = request.params as { ddtNumber: string };
        const ddt = await ddtService.getByNumber(ddtNumber);

        if (!ddt) {
          return reply.status(404).send({
            success: false,
            error: 'DDT non trovato',
          });
        }

        return reply.send({ success: true, data: ddt });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero DDT',
        });
      }
    }
  );

  /**
   * POST /api/v1/ddt
   * Crea un nuovo DDT
   */
  server.post(
    '/',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createDdtSchema.parse(request.body);

        // Converti date se presenti
        const input = {
          ...data,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          transportDate: data.transportDate ? new Date(data.transportDate) : undefined,
        };

        const ddt = await ddtService.create(input);

        return reply.status(201).send({
          success: true,
          data: ddt,
          message: `DDT ${ddt.ddtNumber} creato con successo`,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore creazione DDT',
        });
      }
    }
  );

  /**
   * POST /api/v1/ddt/from-order/:orderId
   * Crea DDT da un ordine esistente
   */
  server.post(
    '/from-order/:orderId',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { orderId } = request.params as { orderId: string };
        const options = createFromOrderSchema.parse(request.body || {});

        const ddt = await ddtService.createFromOrder(orderId, options);

        return reply.status(201).send({
          success: true,
          data: ddt,
          message: `DDT ${ddt.ddtNumber} creato da ordine`,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore creazione DDT da ordine',
        });
      }
    }
  );

  /**
   * PUT /api/v1/ddt/:id
   * Aggiorna un DDT
   */
  server.put(
    '/:id',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = updateDdtSchema.parse(request.body);

        // Converti date se presenti
        const input = {
          ...data,
          transportDate: data.transportDate ? new Date(data.transportDate) : undefined,
        };

        const ddt = await ddtService.update(id, input);

        return reply.send({
          success: true,
          data: ddt,
          message: 'DDT aggiornato con successo',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore aggiornamento DDT',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/ddt/:id
   * Elimina un DDT
   */
  server.delete(
    '/:id',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        await ddtService.delete(id);

        return reply.send({
          success: true,
          message: 'DDT eliminato con successo',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore eliminazione DDT',
        });
      }
    }
  );

  // ============================================
  // DDT ITEMS
  // ============================================

  /**
   * POST /api/v1/ddt/:id/items
   * Aggiunge una riga al DDT
   */
  server.post(
    '/:id/items',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const data = addItemSchema.parse(request.body);

        const item = await ddtService.addItem(id, data);

        return reply.status(201).send({
          success: true,
          data: item,
          message: 'Riga aggiunta al DDT',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore aggiunta riga',
        });
      }
    }
  );

  /**
   * PUT /api/v1/ddt/:id/items/:itemId
   * Aggiorna una riga del DDT
   */
  server.put(
    '/:id/items/:itemId',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, itemId } = request.params as { id: string; itemId: string };
        const data = updateItemSchema.parse(request.body);

        const item = await ddtService.updateItem(id, itemId, data);

        return reply.send({
          success: true,
          data: item,
          message: 'Riga aggiornata',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore aggiornamento riga',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/ddt/:id/items/:itemId
   * Rimuove una riga dal DDT
   */
  server.delete(
    '/:id/items/:itemId',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, itemId } = request.params as { id: string; itemId: string };
        await ddtService.removeItem(id, itemId);

        return reply.send({
          success: true,
          message: 'Riga rimossa dal DDT',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore rimozione riga',
        });
      }
    }
  );

  // ============================================
  // DDT OPERATIONS
  // ============================================

  /**
   * POST /api/v1/ddt/mark-invoiced
   * Marca DDT come fatturati
   */
  server.post(
    '/mark-invoiced',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ddtIds, invoiceId } = markAsInvoicedSchema.parse(request.body);
        await ddtService.markAsInvoiced(ddtIds, invoiceId);

        return reply.send({
          success: true,
          message: `${ddtIds.length} DDT marcati come fatturati`,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore marcatura DDT',
        });
      }
    }
  );

  /**
   * GET /api/v1/ddt/uninvoiced/:customerId
   * Recupera DDT non fatturati di un cliente
   */
  server.get(
    '/uninvoiced/:customerId',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { customerId } = request.params as { customerId: string };
        const ddts = await ddtService.getUninvoicedByCustomer(customerId);

        return reply.send({
          success: true,
          data: ddts,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore recupero DDT non fatturati',
        });
      }
    }
  );

  /**
   * GET /api/v1/ddt/:id/total
   * Calcola totale DDT
   */
  server.get(
    '/:id/total',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const total = await ddtService.calculateTotal(id);

        return reply.send({
          success: true,
          data: { total },
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore calcolo totale',
        });
      }
    }
  );

  /**
   * GET /api/v1/ddt/:id/pdf
   * Genera PDF del DDT
   */
  server.get(
    '/:id/pdf',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await ddtService.generatePdf(id);

        // Estrai il numero DDT per il filename
        const ddt = await ddtService.getById(id);
        const filename = ddt
          ? `DDT_${ddt.ddtNumber.replace(/\//g, '-')}.pdf`
          : `DDT_${id}.pdf`;

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
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
   * POST /api/v1/ddt/report
   * Genera report DDT per periodo
   */
  server.post(
    '/report',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { dateFrom, dateTo } = periodReportSchema.parse(request.body);
        const report = await ddtService.generatePeriodReport(
          new Date(dateFrom),
          new Date(dateTo)
        );

        return reply.send({
          success: true,
          data: report,
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore generazione report',
        });
      }
    }
  );

  /**
   * POST /api/v1/ddt/:id/clone
   * Clona un DDT esistente
   */
  server.post(
    '/:id/clone',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const options = cloneDdtSchema.parse(request.body || {});

        const newDdt = await ddtService.clone(id, options);

        return reply.status(201).send({
          success: true,
          data: newDdt,
          message: 'DDT clonato con successo',
        });
      } catch (error: unknown) {
        const err = error as Error;
        return reply.status(400).send({
          success: false,
          error: err.message || 'Errore clonazione DDT',
        });
      }
    }
  );
};

export default ddtRoutes;
