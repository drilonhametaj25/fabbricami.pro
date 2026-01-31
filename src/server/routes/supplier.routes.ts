// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import supplierService from '../services/supplier.service';
import { successResponse, errorResponse } from '../utils/response.util';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersSchema,
  supplierIdSchema,
} from '../schemas/supplier.schema';

// Types/Interfaces

// Constants

// Main logic

/**
 * Supplier Routes
 * Endpoints API per gestione fornitori
 */
const supplierRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/suppliers
   * Lista fornitori con paginazione e filtri
   */
  server.get(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(listSuppliersSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Lista fornitori',
      },
    },
    async (request, reply) => {
      try {
        const result = await supplierService.listSuppliers(request.query as any);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id
   * Dettaglio fornitore con statistiche
   */
  server.get(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Dettaglio fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const supplier = await supplierService.getSupplierById(id);
        return successResponse(reply, supplier);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/suppliers
   * Crea nuovo fornitore
   */
  server.post(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(createSupplierSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Crea fornitore',
      },
    },
    async (request, reply) => {
      try {
        const supplier = await supplierService.createSupplier(request.body as any);
        return successResponse(reply, supplier, 201);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('già esistente') ? 409 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * PATCH /api/v1/suppliers/:id
   * Aggiorna fornitore
   */
  server.patch(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(updateSupplierSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Aggiorna fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const supplier = await supplierService.updateSupplier(id, request.body as any);
        return successResponse(reply, supplier);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * DELETE /api/v1/suppliers/:id
   * Disattiva fornitore (soft delete)
   */
  server.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Elimina fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await supplierService.deleteSupplier(id);
        return successResponse(reply, { message: 'Fornitore disattivato' });
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id/statistics
   * Statistiche fornitore
   */
  server.get(
    '/:id/statistics',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Statistiche fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const stats = await supplierService.getSupplierStatistics(id);
        return successResponse(reply, stats);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/generate-code
   * Genera codice fornitore automatico
   */
  server.get(
    '/generate-code',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Suppliers'],
        description: 'Genera codice fornitore',
      },
    },
    async (request, reply) => {
      try {
        const code = await supplierService.generateSupplierCode();
        return successResponse(reply, { code });
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ==================== SPRINT 4: Performance & Catalog Routes ====================

  /**
   * GET /api/v1/suppliers/:id/performance
   * Metriche performance fornitore (puntualità, qualità, costi)
   */
  server.get(
    '/:id/performance',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Performance metrics del fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const performance = await supplierService.getSupplierPerformance(id);
        return successResponse(reply, performance);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/:id/update-performance
   * Aggiorna metriche performance dopo entrata merce
   */
  server.post(
    '/:id/update-performance',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Aggiorna metriche performance',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { goodsReceiptId } = request.body as { goodsReceiptId?: string };
        const result = await supplierService.updatePerformanceMetrics(id, goodsReceiptId!);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id/catalog
   * Listino/Catalogo prodotti del fornitore
   */
  server.get(
    '/:id/catalog',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Catalogo articoli fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const catalog = await supplierService.getSupplierCatalog(id);
        return successResponse(reply, catalog);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/:id/catalog
   * Aggiungi/Aggiorna articolo nel catalogo fornitore
   */
  server.post(
    '/:id/catalog',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Aggiungi articolo a catalogo fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const itemData = request.body as {
          productId?: string;
          materialId?: string;
          supplierSku?: string;
          lastPurchasePrice: number;
          minOrderQuantity?: number;
          packagingUnit?: number;
          leadTimeDays?: number;
          isPreferred?: boolean;
          notes?: string;
        };
        const item = await supplierService.upsertSupplierItem(id, itemData);
        return successResponse(reply, item, 201);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/:id/catalog/:itemId/discounts
   * Aggiungi sconto volume a articolo catalogo
   */
  server.post(
    '/:id/catalog/:itemId/discounts',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Suppliers'],
        description: 'Aggiungi sconto volume',
      },
    },
    async (request, reply) => {
      try {
        const { itemId } = request.params as { itemId: string };
        const discountData = request.body as {
          minQuantity: number;
          discountPercent?: number;
          fixedPrice?: number;
        };
        const discount = await supplierService.addVolumeDiscount(itemId, discountData);
        return successResponse(reply, discount, 201);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id/price-history
   * Storico prezzi fornitore per prodotto/materiale
   */
  server.get(
    '/:id/price-history',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Storico prezzi fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { productId, materialId } = request.query as { productId?: string; materialId?: string };
        const history = await supplierService.getPriceHistory(id, productId, materialId);
        return successResponse(reply, history);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/compare
   * Confronta più fornitori per stesso prodotto/materiale
   */
  server.post(
    '/compare',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Suppliers'],
        description: 'Confronta fornitori',
      },
    },
    async (request, reply) => {
      try {
        const { supplierIds, productId, materialId } = request.body as {
          supplierIds: string[];
          productId?: string;
          materialId?: string;
        };
        const comparison = await supplierService.compareSuppliers(supplierIds, productId, materialId);
        return successResponse(reply, comparison);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/price-suggestions
   * Suggerimenti prezzo per prodotto/materiale da tutti i fornitori
   */
  server.get(
    '/price-suggestions',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Suppliers'],
        description: 'Suggerimenti prezzo fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { productId, materialId, quantity } = request.query as {
          productId?: string;
          materialId?: string;
          quantity?: string;
        };
        const suggestions = await supplierService.getPriceSuggestion(
          productId,
          materialId,
          quantity ? parseInt(quantity, 10) : 1
        );
        return successResponse(reply, suggestions);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ==================== SPRINT 5: Scorecard Routes ====================

  /**
   * GET /api/v1/suppliers/scorecards/ranking
   * Ranking fornitori per periodo
   */
  server.get(
    '/scorecards/ranking',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Suppliers'],
        description: 'Ranking fornitori per periodo',
      },
    },
    async (request, reply) => {
      try {
        const { periodType, period, limit } = request.query as {
          periodType?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
          period?: string;
          limit?: string;
        };
        const ranking = await supplierService.getSupplierRanking(
          periodType || 'MONTHLY',
          period,
          limit ? parseInt(limit, 10) : 20
        );
        return successResponse(reply, ranking);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/scorecards/calculate-all
   * Calcola scorecard per tutti i fornitori attivi
   */
  server.post(
    '/scorecards/calculate-all',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Suppliers'],
        description: 'Calcola scorecard per tutti i fornitori',
      },
    },
    async (request, reply) => {
      try {
        const { period, periodType } = request.body as {
          period: string;
          periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
        };
        const result = await supplierService.calculateAllScorecards(period, periodType);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/scorecards/compare
   * Confronta scorecard di più fornitori
   */
  server.post(
    '/scorecards/compare',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Suppliers'],
        description: 'Confronta scorecard fornitori',
      },
    },
    async (request, reply) => {
      try {
        const { supplierIds, period, periodType } = request.body as {
          supplierIds: string[];
          period: string;
          periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
        };
        const comparison = await supplierService.compareSuppliersScorecard(supplierIds, period, periodType);
        return successResponse(reply, comparison);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id/scorecards
   * Storico scorecard fornitore
   */
  server.get(
    '/:id/scorecards',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Storico scorecard fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { periodType, limit } = request.query as {
          periodType?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
          limit?: string;
        };
        const scorecards = await supplierService.getScorecardHistory(
          id,
          periodType,
          limit ? parseInt(limit, 10) : 12
        );
        return successResponse(reply, scorecards);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id/scorecards/:period
   * Scorecard fornitore per periodo specifico
   */
  server.get(
    '/:id/scorecards/:period',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Scorecard fornitore per periodo',
      },
    },
    async (request, reply) => {
      try {
        const { id, period } = request.params as { id: string; period: string };
        const { periodType } = request.query as { periodType?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' };
        const scorecard = await supplierService.getScorecard(id, period, periodType || 'MONTHLY');
        return successResponse(reply, scorecard);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/suppliers/:id/scorecards/calculate
   * Calcola scorecard per periodo
   */
  server.post(
    '/:id/scorecards/calculate',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Calcola scorecard fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { period, periodType } = request.body as {
          period: string;
          periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
        };
        const scorecard = await supplierService.calculateScorecard(id, period, periodType);
        return successResponse(reply, scorecard, 201);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/suppliers/:id/scorecards/report
   * Report scorecard fornitore (PDF data)
   */
  server.get(
    '/:id/scorecards/report',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE'), validate(supplierIdSchema)],
      schema: {
        tags: ['Suppliers'],
        description: 'Report scorecard fornitore',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { periods } = request.query as { periods?: string };
        const report = await supplierService.generateScorecardReport(
          id,
          periods ? parseInt(periods, 10) : 6
        );
        return successResponse(reply, report);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );
};

// Exports
export default supplierRoutes;
