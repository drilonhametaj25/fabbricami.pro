import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import operationTypeService from '../services/operation-type.service';
import { z } from 'zod';

/**
 * Verifica se l'utente può vedere il costo orario
 */
function canViewHourlyCost(role: string): boolean {
  return ['ADMIN', 'MANAGER', 'CONTABILE'].includes(role);
}

/**
 * Filtra hourlyRate dalla lista dipendenti
 */
function filterEmployeeHourlyRate(data: any[], canSeeCost: boolean): any[] {
  if (canSeeCost) return data;
  return data.map((item) => {
    if (item.employee) {
      const { hourlyRate, ...employeeRest } = item.employee;
      return { ...item, employee: employeeRest };
    }
    return item;
  });
}

const createOperationTypeSchema = z.object({
  code: z.string().min(1, 'Codice obbligatorio').max(50),
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  description: z.string().optional(),
  isExternal: z.boolean().default(false),
  defaultHourlyRate: z.number().nonnegative().optional(),
  requiresLiquidProduct: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().optional(),
});

const updateOperationTypeSchema = createOperationTypeSchema.partial();

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

const operationTypeRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET / - Lista tipi operazione
   */
  server.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { includeInactive } = request.query as { includeInactive?: string };
    const types = await operationTypeService.getAll(includeInactive === 'true');
    return reply.send({ success: true, data: types });
  });

  /**
   * GET /external - Lista tipi operazione esterni (terzisti)
   */
  server.get('/external', { preHandler: authenticate }, async (_request, reply) => {
    const types = await operationTypeService.getExternalTypes();
    return reply.send({ success: true, data: types });
  });

  /**
   * GET /internal - Lista tipi operazione interni
   */
  server.get('/internal', { preHandler: authenticate }, async (_request, reply) => {
    const types = await operationTypeService.getInternalTypes();
    return reply.send({ success: true, data: types });
  });

  /**
   * GET /:id - Dettaglio tipo operazione
   */
  server.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const type = await operationTypeService.getById(id);
      return reply.send({ success: true, data: type });
    } catch (error: any) {
      return reply.status(404).send({ success: false, error: error.message });
    }
  });

  /**
   * POST / - Crea tipo operazione
   */
  server.post(
    '/',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const data = createOperationTypeSchema.parse(request.body);
        const type = await operationTypeService.create(data);
        return reply.status(201).send({ success: true, data: type });
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
   * PATCH /:id - Aggiorna tipo operazione
   */
  server.patch(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const data = updateOperationTypeSchema.parse(request.body);
        const type = await operationTypeService.update(id, data);
        return reply.send({ success: true, data: type });
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
   * DELETE /:id - Elimina tipo operazione
   */
  server.delete(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await operationTypeService.delete(id);
        return reply.send({ success: true, data: { message: 'Tipo operazione eliminato' } });
      } catch (error: any) {
        return reply.status(400).send({ success: false, error: error.message });
      }
    }
  );

  /**
   * PUT /reorder - Riordina tipi operazione
   */
  server.put(
    '/reorder',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request, reply) => {
      try {
        const data = reorderSchema.parse(request.body);
        await operationTypeService.reorder(data.orderedIds);
        return reply.send({ success: true, data: { message: 'Ordine aggiornato' } });
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
   * POST /seed-defaults - Seed tipi operazione di default
   */
  server.post(
    '/seed-defaults',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (_request, reply) => {
      const created = await operationTypeService.seedDefaults();
      return reply.send({
        success: true,
        data: {
          message: `Creati ${created.length} tipi operazione di default`,
          created,
        },
      });
    }
  );

  // ============================================
  // QUALIFIED EMPLOYEES MANAGEMENT
  // ============================================

  /**
   * GET /:id/employees - Lista operatori qualificati per questa fase
   * Solo ADMIN, MANAGER, CONTABILE vedono hourlyRate
   */
  server.get('/:id/employees', { preHandler: authenticate }, async (request: any, reply) => {
    const { id } = request.params as { id: string };

    try {
      const authRequest = request as AuthenticatedRequest;
      const employees = await operationTypeService.getQualifiedEmployees(id);
      const canSeeCost = canViewHourlyCost(authRequest.user.role);
      const filteredEmployees = filterEmployeeHourlyRate(employees, canSeeCost);

      return reply.send({
        success: true,
        data: filteredEmployees,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /:id/employees - Aggiungi operatore qualificato
   * Solo ADMIN, MANAGER
   */
  server.post(
    '/:id/employees',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };
      const { employeeId, isPrimary } = request.body as { employeeId: string; isPrimary?: boolean };

      if (!employeeId) {
        return reply.status(400).send({
          success: false,
          error: 'employeeId obbligatorio',
        });
      }

      try {
        const result = await operationTypeService.addQualifiedEmployee(id, employeeId, isPrimary || false);

        return reply.status(201).send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * PATCH /:id/employees/:employeeId - Aggiorna operatore qualificato (es. set primary)
   * Solo ADMIN, MANAGER
   */
  server.patch(
    '/:id/employees/:employeeId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      const { id, employeeId } = request.params as { id: string; employeeId: string };
      const { isPrimary } = request.body as { isPrimary?: boolean };

      try {
        const result = await operationTypeService.updateQualifiedEmployee(id, employeeId, { isPrimary });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * DELETE /:id/employees/:employeeId - Rimuovi operatore qualificato
   * Solo ADMIN, MANAGER
   */
  server.delete(
    '/:id/employees/:employeeId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      const { id, employeeId } = request.params as { id: string; employeeId: string };

      try {
        await operationTypeService.removeQualifiedEmployee(id, employeeId);

        return reply.send({
          success: true,
          message: 'Operatore rimosso dalla fase',
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /:id/hourly-rate - Calcola costo orario medio della fase
   * Solo ADMIN, MANAGER, CONTABILE
   */
  server.get(
    '/:id/hourly-rate',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await operationTypeService.calculateAverageHourlyRate(id);

        return reply.send({
          success: true,
          data: {
            operationTypeId: id,
            ...result,
          },
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /:id/with-hourly-rate - Dettaglio fase con costo orario calcolato
   * Solo ADMIN, MANAGER, CONTABILE
   */
  server.get(
    '/:id/with-hourly-rate',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await operationTypeService.getByIdWithHourlyRate(id);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );
};

export default operationTypeRoutes;
