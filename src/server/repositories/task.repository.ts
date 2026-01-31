import { prisma } from '../config/database';

/**
 * Task Repository
 * Data access layer per task
 */
class TaskRepository {
  /**
   * Trova task per ID
   */
  async findById(id: string) {
    return await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: true,
        order: true,
      },
    });
  }

  /**
   * Lista task
   */
  async findMany(options: {
    skip?: number;
    take?: number;
    status?: string;
    priority?: string;
    assignedToId?: string;
    orderId?: string;
    orderBy?: any;
  }) {
    const { skip, take, status, priority, assignedToId, orderId, orderBy } = options;

    return await prisma.task.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(priority && { priority: priority as any }),
        ...(assignedToId && { assignedToId }),
        ...(orderId && { orderId }),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
      skip,
      take,
      orderBy: orderBy || { createdAt: 'desc' },
    });
  }

  /**
   * Conta task
   */
  async count(options: {
    status?: string;
    assignedToId?: string;
    orderId?: string;
  }) {
    const { status, assignedToId, orderId } = options;

    return await prisma.task.count({
      where: {
        ...(status && { status: status as any }),
        ...(assignedToId && { assignedToId }),
        ...(orderId && { orderId }),
      },
    });
  }

  /**
   * Crea task
   */
  async create(data: any) {
    return await prisma.task.create({
      data,
      include: {
        assignedTo: true,
        order: true,
      },
    });
  }

  /**
   * Aggiorna task
   */
  async update(id: string, data: any) {
    return await prisma.task.update({
      where: { id },
      data,
      include: {
        assignedTo: true,
        order: true,
      },
    });
  }

  /**
   * Elimina task
   */
  async delete(id: string) {
    return await prisma.task.delete({
      where: { id },
    });
  }

  /**
   * Task scaduti
   */
  async findOverdue() {
    return await prisma.task.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: ['DONE', 'CANCELLED'] as any },
      },
      include: {
        assignedTo: true,
        order: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    });
  }

  /**
   * Task per dipendente
   */
  async findByEmployee(employeeId: string, status?: string) {
    return await prisma.task.findMany({
      where: {
        assignedToId: employeeId,
        ...(status && { status: status as any }),
      },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });
  }

  /**
   * Task per ordine
   */
  async findByOrder(orderId: string) {
    return await prisma.task.findMany({
      where: { orderId },
      include: {
        assignedTo: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

export const taskRepository = new TaskRepository();
export default taskRepository;
