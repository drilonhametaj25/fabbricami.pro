import { FastifyPluginAsync } from 'fastify';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { taskService } from '../services/task.service';
import { successResponse, errorResponse } from '../utils/response.util';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  taskQuerySchema,
} from '../schemas/task.schema';
import { z } from 'zod';

const taskIdSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

const taskRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/tasks
   * Lista task con filtri
   */
  server.get(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE', 'MAGAZZINIERE'), validate({ query: taskQuerySchema })],
      schema: {
        tags: ['Tasks'],
        description: 'Lista task con filtri',
      },
    },
    async (request, reply) => {
      try {
        const result = await taskService.listTasks(request.query as any);
        return successResponse(reply, result);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/tasks/overdue
   * Task scaduti
   */
  server.get(
    '/overdue',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Tasks'],
        description: 'Task scaduti',
      },
    },
    async (request, reply) => {
      try {
        const tasks = await taskService.getOverdueTasks();
        return successResponse(reply, tasks);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/tasks/kanban
   * Kanban board view
   */
  server.get(
    '/kanban',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE', 'MAGAZZINIERE')],
      schema: {
        tags: ['Tasks'],
        description: 'Kanban board view',
      },
    },
    async (request, reply) => {
      try {
        const { orderId } = request.query as { orderId?: string };
        const board = await taskService.getKanbanBoard(orderId);
        return successResponse(reply, board);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/tasks/employee/:employeeId
   * Task per dipendente
   */
  server.get(
    '/employee/:employeeId',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE', 'MAGAZZINIERE')],
      schema: {
        tags: ['Tasks'],
        description: 'Task per dipendente',
      },
    },
    async (request, reply) => {
      try {
        const { employeeId } = request.params as { employeeId: string };
        const { status } = request.query as { status?: string };
        const tasks = await taskService.getTasksByEmployee(employeeId, status);
        return successResponse(reply, tasks);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * GET /api/v1/tasks/:id
   * Dettaglio task
   */
  server.get(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE', 'MAGAZZINIERE'), validate(taskIdSchema)],
      schema: {
        tags: ['Tasks'],
        description: 'Dettaglio task',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const task = await taskService.getTaskById(id);
        if (!task) {
          return errorResponse(reply, 'Task non trovato', 404);
        }
        return successResponse(reply, task);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * POST /api/v1/tasks
   * Crea nuovo task
   */
  server.post(
    '/',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE'), validate({ body: createTaskSchema })],
      schema: {
        tags: ['Tasks'],
        description: 'Crea nuovo task',
      },
    },
    async (request, reply) => {
      try {
        const task = await taskService.createTask(request.body as any);
        return successResponse(reply, task, 201);
      } catch (error: any) {
        request.log.error(error);
        return errorResponse(reply, error.message, 500);
      }
    }
  );

  /**
   * PUT /api/v1/tasks/:id
   * Aggiorna task
   */
  server.put(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE'), validate({ ...taskIdSchema, body: updateTaskSchema })],
      schema: {
        tags: ['Tasks'],
        description: 'Aggiorna task',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const task = await taskService.updateTask(id, request.body as any);
        return successResponse(reply, task);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('not found') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * PATCH /api/v1/tasks/:id/status
   * Cambia stato task
   */
  server.patch(
    '/:id/status',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER', 'OPERATORE'), validate({ params: z.object({ id: z.string().uuid() }), body: updateTaskStatusSchema })],
      schema: {
        tags: ['Tasks'],
        description: 'Cambia stato task',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { status } = request.body as { status: string };
        const task = await taskService.updateTask(id, { status } as any);
        return successResponse(reply, task);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('not found') ? 404 : 400;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * PATCH /api/v1/tasks/:id/assign
   * Assegna task a dipendente
   */
  server.patch(
    '/:id/assign',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate({ params: z.object({ id: z.string().uuid() }), body: z.object({ assignedToId: z.string().uuid() }) })],
      schema: {
        tags: ['Tasks'],
        description: 'Assegna task a dipendente',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { assignedToId } = request.body as { assignedToId: string };
        const task = await taskService.assignTask(id, assignedToId);
        return successResponse(reply, task);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('not found') ? 404 : 400;
        return errorResponse(reply, error.message, status);
      }
    }
  );

  /**
   * DELETE /api/v1/tasks/:id
   * Elimina task (soft delete via status CANCELLED)
   */
  server.delete(
    '/:id',
    {
      preHandler: [authenticate, authorize('ADMIN', 'MANAGER'), validate(taskIdSchema)],
      schema: {
        tags: ['Tasks'],
        description: 'Cancella task',
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const task = await taskService.updateTask(id, { status: 'CANCELLED' } as any);
        return successResponse(reply, task);
      } catch (error: any) {
        request.log.error(error);
        const status = error.message.includes('not found') ? 404 : 500;
        return errorResponse(reply, error.message, status);
      }
    }
  );
};

export default taskRoutes;
