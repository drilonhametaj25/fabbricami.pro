// Imports
import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../utils/response.util';
import threeWayMatchService from '../services/three-way-match.service';
import { ThreeWayMatchStatus, MatchResolutionStatus } from '@prisma/client';

// Types/Interfaces

// Constants

/**
 * Three-Way Match Routes
 * Endpoints API per riconciliazione PO-GR-Invoice
 */
const threeWayMatchRoutes: FastifyPluginAsync = async (server) => {
  // ============================================
  // SUPPLIER INVOICES
  // ============================================

  /**
   * GET /api/v1/three-way-match/invoices
   * Lista fatture fornitore
   */
  server.get(
    '/invoices',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Lista fatture fornitore',
      },
    },
    async (request, reply) => {
      try {
        const {
          page,
          limit,
          supplierId,
          status,
          matchStatus,
          dateFrom,
          dateTo,
        } = request.query as {
          page?: string;
          limit?: string;
          supplierId?: string;
          status?: string;
          matchStatus?: ThreeWayMatchStatus;
          dateFrom?: string;
          dateTo?: string;
        };

        const result = await threeWayMatchService.listSupplierInvoices({
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 20,
          supplierId,
          status,
          matchStatus,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
        });

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/three-way-match/invoices
   * Crea fattura fornitore
   */
  server.post(
    '/invoices',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Crea fattura fornitore',
      },
    },
    async (request, reply) => {
      try {
        const data = request.body as {
          invoiceNumber: string;
          supplierId: string;
          issueDate: string;
          dueDate: string;
          subtotal: number;
          tax: number;
          total: number;
          notes?: string;
          items: {
            purchaseOrderItemId?: string;
            productId?: string;
            materialId?: string;
            description?: string;
            quantity: number;
            unitPrice: number;
            tax?: number;
            total: number;
          }[];
        };

        const userId = (request as any).user?.id || 'system';
        const invoice = await threeWayMatchService.createSupplierInvoice(
          {
            ...data,
            issueDate: new Date(data.issueDate),
            dueDate: new Date(data.dueDate),
          },
          userId
        );

        return successResponse(reply, invoice, 201);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/three-way-match/invoices/:id
   * Dettaglio fattura con matching
   */
  server.get(
    '/invoices/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Dettaglio fattura con matching',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await threeWayMatchService.getMatchDetails(id);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovata') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  // ============================================
  // MATCHING OPERATIONS
  // ============================================

  /**
   * POST /api/v1/three-way-match/invoices/:id/auto-match
   * Esegui matching automatico
   */
  server.post(
    '/invoices/:id/auto-match',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Esegui matching automatico',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.id || 'system';
        const result = await threeWayMatchService.performAutoMatch(id, userId);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovata') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * POST /api/v1/three-way-match/invoices/:id/link-po
   * Link manuale fattura a PO
   */
  server.post(
    '/invoices/:id/link-po',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Link manuale fattura a PO',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { purchaseOrderId, itemMappings } = request.body as {
          purchaseOrderId: string;
          itemMappings: { invoiceItemId: string; poItemId: string }[];
        };
        const userId = (request as any).user?.id || 'system';

        const result = await threeWayMatchService.linkInvoiceToPo(
          id,
          purchaseOrderId,
          itemMappings,
          userId
        );

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovata') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * GET /api/v1/three-way-match/invoices/:supplierId/available-pos
   * Ottieni PO disponibili per matching
   */
  server.get(
    '/available-pos/:supplierId',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'PO disponibili per matching',
      },
    },
    async (request, reply) => {
      try {
        const { supplierId } = request.params as { supplierId: string };
        const result = await threeWayMatchService.getAvailablePoForInvoice(supplierId);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  // ============================================
  // DISCREPANCY RESOLUTION
  // ============================================

  /**
   * GET /api/v1/three-way-match/discrepancies
   * Lista discrepanze da risolvere
   */
  server.get(
    '/discrepancies',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Lista discrepanze da risolvere',
      },
    },
    async (request, reply) => {
      try {
        const { supplierId } = request.query as { supplierId?: string };
        const result = await threeWayMatchService.getPendingDiscrepancies(supplierId);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/three-way-match/matches/:id/resolve
   * Risolvi discrepanza
   */
  server.post(
    '/matches/:id/resolve',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Risolvi discrepanza',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { resolutionStatus, resolutionNotes } = request.body as {
          resolutionStatus: MatchResolutionStatus;
          resolutionNotes?: string;
        };
        const userId = (request as any).user?.id || 'system';

        const result = await threeWayMatchService.resolveMatch(id, {
          resolutionStatus,
          resolutionNotes,
          resolvedBy: userId,
        });

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('non trovato') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * GET /api/v1/three-way-match/statistics
   * Statistiche three-way matching
   */
  server.get(
    '/statistics',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')],
      schema: {
        tags: ['Three-Way Match'],
        description: 'Statistiche matching',
      },
    },
    async (request, reply) => {
      try {
        const { dateFrom, dateTo } = request.query as {
          dateFrom?: string;
          dateTo?: string;
        };

        const result = await threeWayMatchService.getMatchStatistics(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined
        );

        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );
};

// Exports
export default threeWayMatchRoutes;
