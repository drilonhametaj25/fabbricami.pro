import { prisma } from '../config/database';
import { CreateTaskInput, UpdateTaskInput } from '../schemas/task.schema';

/**
 * Task Service
 * Business logic per gestione task con workflow configurabili
 */
class TaskService {
  /**
   * Lista task con filtri
   */
  async listTasks(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    assigneeId?: string;
    orderId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 50,
      status,
      priority,
      assigneeId,
      orderId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: any = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assignedToId: assigneeId }),
      ...(orderId && { orderId }),
    };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              customer: {
                select: {
                  businessName: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Dettaglio task
   */
  async getTaskById(id: string) {
    return await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        order: {
          include: {
            customer: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Crea task
   */
  async createTask(data: CreateTaskInput) {
    // Se ha orderId, determina type automaticamente
    if (data.orderId) {
      // TODO: Implement workflow-based task type assignment
      // This requires workflow configuration system
      // const order = await prisma.order.findUnique({
      //   where: { id: data.orderId },
      //   select: { source: true },
      // });
    }

    return await prisma.task.create({
      data: {
        ...data,
        status: 'TODO' as any,
      },
      include: {
        assignedTo: true,
        order: true,
      },
    });
  }

  /**
   * Aggiorna task
   */
  async updateTask(id: string, data: UpdateTaskInput) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new Error('Task not found');
    }

    // Se cambia status a DONE, registra completedDate
    if (data.status === 'DONE' as any && task.status !== ('DONE' as any)) {
      data.completedDate = new Date().toISOString();
    }

    return await prisma.task.update({
      where: { id },
      data: {
        ...data,
        status: data.status as any,
      },
      include: {
        assignedTo: true,
        order: true,
      },
    });
  }

  /**
   * Assegna task a dipendente
   */
  async assignTask(taskId: string, assignedToId: string) {
    return await this.updateTask(taskId, {
      assignedToId,
      status: 'TODO',
    });
  }

  /**
   * Avvia task (TODO → IN_PROGRESS)
   */
  async startTask(taskId: string) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status !== 'TODO') {
      throw new Error(`Cannot start task in status ${task.status}`);
    }

    return await this.updateTask(taskId, {
      status: 'IN_PROGRESS',
      // Note: Prisma Task model doesn't have startedAt field
    });
  }

  /**
   * Completa task (IN_PROGRESS → DONE)
   */
  async completeTask(taskId: string, actualHours?: number, _notes?: string) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status !== ('IN_PROGRESS' as any) && task.status !== ('COMPLETED' as any)) {
      throw new Error(`Cannot complete task in status ${task.status}`);
    }

    return await this.updateTask(taskId, {
      status: 'DONE' as any,
      completedDate: new Date().toISOString(),
      ...(actualHours && { estimatedHours: actualHours }), // TODO: Add actualHours field to schema
    });
  }

  /**
   * Blocca task (IN_PROGRESS → BLOCKED)
   */
  async blockTask(taskId: string, blockReason: string) {
    const task = await this.getTaskById(taskId);
    if (!task) throw new Error('Task not found');
    
    return await this.updateTask(taskId, {
      status: 'BLOCKED',
      // Store block reason in description field
      description: `${task.description || ''}\n\nBLOCKED: ${blockReason}`,
    });
  }

  /**
   * Sblocca task (BLOCKED → TODO)
   */
  async unblockTask(taskId: string) {
    return await this.updateTask(taskId, {
      status: 'TODO',
    });
  }

  /**
   * Task scaduti
   */
  async getOverdueTasks() {
    const today = new Date();

    return await prisma.task.findMany({
      where: {
        dueDate: { lt: today },
        status: { notIn: ['DONE' as any, 'CANCELLED' as any] },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Task per dipendente
   */
  async getTasksByEmployee(employeeId: string, status?: string) {
    const where: any = { assignedToId: employeeId };
    if (status) where.status = status;

    return await prisma.task.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            customer: {
              select: {
                businessName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  /**
   * Statistiche task per periodo
   */
  async getTaskStats(dateFrom: string, dateTo: string) {
    const tasks = await prisma.task.findMany({
      where: {
        createdAt: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      },
      select: {
        status: true,
        priority: true,
        estimatedHours: true,
        actualHours: true,
        completedDate: true,
        dueDate: true,
      },
    });

    const stats = {
      total: tasks.length,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      completed: tasks.filter((t: any) => t.status === 'DONE').length,
      completionRate: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      averageCompletionTime: 0,
      onTimeCompletions: 0,
    };

    tasks.forEach((task: any) => {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;

      stats.totalEstimatedHours += task.estimatedHours || 0;
      stats.totalActualHours += task.actualHours || 0;

      if (task.status === 'DONE' && task.completedAt && task.dueDate) {
        if (task.completedAt <= task.dueDate) {
          stats.onTimeCompletions++;
        }
      }
    });

    stats.completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return stats;
  }

  /**
   * Auto-assegnazione task basata su competenze
   */
  async autoAssignTask(taskId: string) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.assignedToId) {
      throw new Error('Task already assigned');
    }

    // Trova dipendenti attivi
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
    });

    if (employees.length === 0) {
      throw new Error('No available employees');
    }

    // Ordina per carico di lavoro (meno task attivi = priorità)
    employees.sort((a: any, b: any) => a.tasks.length - b.tasks.length);

    const selectedEmployee = employees[0];

    return await this.assignTask(
      taskId,
      selectedEmployee.id
    );
  }

  /**
   * Kanban board view
   */
  async getKanbanBoard(orderId?: string) {
    const where: any = {};
    if (orderId) where.orderId = orderId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    return {
      TODO: tasks.filter((t: any) => t.status === 'TODO'),
      IN_PROGRESS: tasks.filter((t: any) => t.status === 'IN_PROGRESS'),
      REVIEW: tasks.filter((t: any) => t.status === 'REVIEW'),
      BLOCKED: tasks.filter((t: any) => t.status === 'BLOCKED'),
      DONE: tasks.filter((t: any) => t.status === 'DONE'),
    };
  }
}

export const taskService = new TaskService();
export default taskService;
