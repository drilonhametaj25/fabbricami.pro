import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import materialService from '../services/material.service';
import { z } from 'zod';

const createMaterialSchema = z.object({
  sku: z.string().min(1, 'SKU obbligatorio'),
  name: z.string().min(1, 'Nome obbligatorio'),
  description: z.string().optional(),
  unit: z.string().default('pz'),
  cost: z.number().nonnegative('Il costo deve essere >= 0'),
  minStock: z.number().int().nonnegative().default(0),
  currentStock: z.number().int().nonnegative().default(0),
  reorderPoint: z.number().int().nonnegative().default(0),
  reorderQuantity: z.number().int().nonnegative().default(0),
  leadTimeDays: z.number().int().nonnegative().default(7),
  supplierId: z.string().uuid().optional(),
  category: z.string().optional(),
  isConsumable: z.boolean().default(false),
});

const updateMaterialSchema = createMaterialSchema.partial();

const adjustStockSchema = z.object({
  quantity: z.number().int().positive('La quantità deve essere > 0'),
  type: z.enum(['IN', 'OUT']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const materialRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET / - Lista materiali con paginazione e filtri
   */
  server.get('/', { preHandler: authenticate }, async (request, reply) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      category?: string;
      supplierId?: string;
      lowStock?: string;
      sortBy?: string;
      sortOrder?: string;
    };

    const result = await materialService.getAllMaterials({
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      search: query.search,
      category: query.category,
      supplierId: query.supplierId,
      lowStock: query.lowStock === 'true',
      sortBy: query.sortBy,
      sortOrder: query.sortOrder as 'asc' | 'desc',
    });

    return reply.send({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * GET /categories - Lista categorie materiali
   */
  server.get('/categories', { preHandler: authenticate }, async (_request, reply) => {
    const categories = await materialService.getCategories();
    return reply.send({ success: true, data: categories });
  });

  /**
   * GET /low-stock - Materiali sotto soglia
   */
  server.get('/low-stock', { preHandler: authenticate }, async (_request, reply) => {
    const materials = await materialService.getLowStockMaterials();
    return reply.send({ success: true, data: materials });
  });

  /**
   * GET /reorder - Materiali da riordinare
   */
  server.get('/reorder', { preHandler: authenticate }, async (_request, reply) => {
    const materials = await materialService.getMaterialsRequiringReorder();
    return reply.send({ success: true, data: materials });
  });

  /**
   * GET /stats - Statistiche materiali
   */
  server.get('/stats', { preHandler: authenticate }, async (_request, reply) => {
    const stats = await materialService.getMaterialStats();
    return reply.send({ success: true, data: stats });
  });

  /**
   * GET /search - Cerca materiali
   */
  server.get('/search', { preHandler: authenticate }, async (request, reply) => {
    const { q, limit } = request.query as { q?: string; limit?: string };
    if (!q) {
      return reply.status(400).send({ success: false, error: 'Query parameter q is required' });
    }
    const materials = await materialService.searchMaterials(q, limit ? parseInt(limit) : 20);
    return reply.send({ success: true, data: materials });
  });

  /**
   * GET /:id - Dettaglio materiale
   */
  server.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const material = await materialService.getMaterialById(id);
      return reply.send({ success: true, data: material });
    } catch (error: any) {
      return reply.status(404).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /:id/movements - Storico movimenti materiale
   */
  server.get('/:id/movements', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };

    const movements = await materialService.getMovementHistory(id, limit ? parseInt(limit) : 50);
    return reply.send({ success: true, data: movements });
  });

  /**
   * GET /:id/usage - Utilizzo in fasi di produzione
   */
  server.get('/:id/usage', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const usage = await materialService.getMaterialUsage(id);
    return reply.send({ success: true, data: usage });
  });

  /**
   * POST / - Crea materiale
   */
  server.post(
    '/',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      try {
        const data = createMaterialSchema.parse(request.body);
        const material = await materialService.createMaterial(data);
        return reply.status(201).send({ success: true, data: material });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * PATCH /:id - Aggiorna materiale
   */
  server.patch(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const data = updateMaterialSchema.parse(request.body);
        const material = await materialService.updateMaterial(id, data);
        return reply.send({ success: true, data: material });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * DELETE /:id - Elimina materiale
   */
  server.delete(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await materialService.deleteMaterial(id);
        return reply.send({ success: true, data: { message: 'Materiale eliminato' } });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /:id/adjust-stock - Modifica stock
   */
  server.post(
    '/:id/adjust-stock',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'MAGAZZINIERE')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user;

      try {
        const data = adjustStockSchema.parse(request.body);
        const material = await materialService.adjustStock(
          id,
          data.quantity,
          data.type,
          data.reference,
          data.notes,
          user?.id
        );
        return reply.send({ success: true, data: material });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Dati non validi',
            details: error.errors,
          });
        }
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * POST /check-low-stock - Verifica e notifica materiali sotto soglia
   */
  server.post(
    '/check-low-stock',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (_request, reply) => {
      const lowStockMaterials = await materialService.checkLowStock();
      return reply.send({
        success: true,
        data: {
          count: lowStockMaterials.length,
          materials: lowStockMaterials,
        },
      });
    }
  );
};

export default materialRoutes;
