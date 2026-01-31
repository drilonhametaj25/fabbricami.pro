import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.middleware';
import { employeeService } from '../services/employee.service';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
} from '../schemas/employee.schema';

/**
 * Helper: rimuove hourlyRate dalla risposta se l'utente non ha i permessi
 */
function filterHourlyRate(data: any, canSeeCost: boolean): any {
  if (!canSeeCost) {
    if (Array.isArray(data)) {
      return data.map((item) => {
        const { hourlyRate, ...rest } = item;
        return rest;
      });
    } else if (data) {
      const { hourlyRate, ...rest } = data;
      return rest;
    }
  }
  return data;
}

/**
 * Verifica se l'utente può vedere il costo orario
 */
function canViewHourlyCost(role: string): boolean {
  return ['ADMIN', 'MANAGER', 'CONTABILE'].includes(role);
}

const employeeRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET / - Lista dipendenti (paginata)
   * Tutti gli utenti autenticati possono vedere la lista
   * Solo ADMIN, MANAGER, CONTABILE vedono hourlyRate
   */
  server.get('/', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const query = employeeQuerySchema.parse(request.query);

      const result = await employeeService.listEmployees({
        page: query.page,
        limit: query.limit,
        isActive: query.isActive,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      const canSeeCost = canViewHourlyCost(authRequest.user.role);
      const filteredItems = filterHourlyRate(result.items, canSeeCost);

      return reply.send({
        success: true,
        data: {
          items: filteredItems,
          pagination: result.pagination,
        },
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /:id - Dettaglio dipendente
   */
  server.get('/:id', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const authRequest = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const employee = await employeeService.getEmployeeById(id);

      if (!employee) {
        return reply.status(404).send({
          success: false,
          error: 'Employee not found',
        });
      }

      const canSeeCost = canViewHourlyCost(authRequest.user.role);
      const filteredEmployee = filterHourlyRate(employee, canSeeCost);

      return reply.send({
        success: true,
        data: filteredEmployee,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST / - Crea dipendente
   * Solo ADMIN e MANAGER possono creare dipendenti
   */
  server.post(
    '/',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      try {
        const data = createEmployeeSchema.parse(request.body);
        const employee = await employeeService.createEmployee(data);

        return reply.status(201).send({
          success: true,
          data: employee,
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: 'Email already exists',
          });
        }
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * PUT /:id - Aggiorna dipendente
   * Solo ADMIN e MANAGER possono modificare
   */
  server.put(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      try {
        const { id } = request.params as { id: string };
        const data = updateEmployeeSchema.parse(request.body);

        const employee = await employeeService.updateEmployee(id, data);

        return reply.send({
          success: true,
          data: employee,
        });
      } catch (error: any) {
        if (error.code === 'P2025') {
          return reply.status(404).send({
            success: false,
            error: 'Employee not found',
          });
        }
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * DELETE /:id - Disattiva dipendente (soft delete)
   * Solo ADMIN
   */
  server.delete(
    '/:id',
    { preHandler: [authenticate, authorize('ADMIN')] },
    async (request: any, reply) => {
      try {
        const { id } = request.params as { id: string };

        await employeeService.updateEmployee(id, { isActive: false });

        return reply.send({
          success: true,
          message: 'Employee deactivated',
        });
      } catch (error: any) {
        if (error.code === 'P2025') {
          return reply.status(404).send({
            success: false,
            error: 'Employee not found',
          });
        }
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  /**
   * POST /:id/clock-in - Timbratura ingresso
   */
  server.post('/:id/clock-in', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { notes } = (request.body as { notes?: string }) || {};

      const entry = await employeeService.clockIn(id, notes);

      return reply.status(201).send({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /:id/clock-out - Timbratura uscita
   */
  server.post('/:id/clock-out', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { notes } = (request.body as { notes?: string }) || {};

      const entry = await employeeService.clockOut(id, notes);

      return reply.send({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /:id/timesheet - Timbrature per periodo
   */
  server.get('/:id/timesheet', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { startDate, endDate } = request.query as { startDate: string; endDate: string };

      if (!startDate || !endDate) {
        return reply.status(400).send({
          success: false,
          error: 'startDate and endDate are required',
        });
      }

      const data = await employeeService.getWorkedHours(id, startDate, endDate);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /:id/labor-cost - Calcolo costo lavoro per periodo
   * Solo ADMIN, MANAGER, CONTABILE
   */
  server.get(
    '/:id/labor-cost',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'CONTABILE')] },
    async (request: any, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { startDate, endDate } = request.query as { startDate: string; endDate: string };

        if (!startDate || !endDate) {
          return reply.status(400).send({
            success: false,
            error: 'startDate and endDate are required',
          });
        }

        const data = await employeeService.calculateLaborCost(id, startDate, endDate);

        return reply.send({
          success: true,
          data,
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
   * GET /:id/productivity - Report produttività
   * Solo ADMIN, MANAGER
   */
  server.get(
    '/:id/productivity',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { startDate, endDate } = request.query as { startDate: string; endDate: string };

        if (!startDate || !endDate) {
          return reply.status(400).send({
            success: false,
            error: 'startDate and endDate are required',
          });
        }

        const data = await employeeService.calculateProductivity(id, startDate, endDate);

        return reply.send({
          success: true,
          data,
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
   * GET /:id/attendance/:year/:month - Report presenze mensile
   */
  server.get(
    '/:id/attendance/:year/:month',
    { preHandler: authenticate },
    async (request: any, reply) => {
      try {
        const { id, year, month } = request.params as {
          id: string;
          year: string;
          month: string;
        };

        const data = await employeeService.getMonthlyAttendance(
          id,
          parseInt(year),
          parseInt(month)
        );

        return reply.send({
          success: true,
          data,
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
   * GET /:id/leave-balance - Ferie residue
   */
  server.get('/:id/leave-balance', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { year } = request.query as { year?: string };

      const data = await employeeService.getRemainingLeave(id, year ? parseInt(year) : undefined);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /:id/leave-request - Richiesta ferie/permessi
   */
  server.post('/:id/leave-request', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        type: 'VACATION' | 'SICK' | 'PERSONAL' | 'OTHER';
        startDate: string;
        endDate: string;
        notes?: string;
      };

      const data = await employeeService.createLeaveRequest({
        employeeId: id,
        ...body,
      });

      return reply.status(201).send({
        success: true,
        data,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * PATCH /leave-requests/:requestId - Approva/rifiuta richiesta ferie
   * Solo ADMIN, MANAGER
   */
  server.patch(
    '/leave-requests/:requestId',
    { preHandler: [authenticate, authorize('ADMIN', 'MANAGER')] },
    async (request: any, reply) => {
      try {
        const { requestId } = request.params as { requestId: string };
        const { status, notes } = request.body as {
          status: 'approved' | 'rejected';
          notes?: string;
        };

        const data = await employeeService.updateLeaveRequestStatus(
          requestId,
          status,
          notes
        );

        return reply.send({
          success: true,
          data,
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

export default employeeRoutes;
