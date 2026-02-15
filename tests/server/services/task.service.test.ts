import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create mock instance
const prismaMock = mockDeep<PrismaClient>();

// Mock database
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

import taskService from '@server/services/task.service';

describe('TaskService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // ==================== listTasks ====================
  describe('listTasks', () => {
    it('should return paginated tasks list', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'TODO',
          priority: 'HIGH',
          assignedTo: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
          order: { id: 'order-1', orderNumber: 'ORD-001', customer: { businessName: 'Test Co' } },
        },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);
      prismaMock.task.count.mockResolvedValue(1);

      const result = await taskService.listTasks({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      await taskService.listTasks({ status: 'TODO' });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'TODO',
          }),
        })
      );
    });

    it('should filter by priority', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      await taskService.listTasks({ priority: 'HIGH' });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: 'HIGH',
          }),
        })
      );
    });

    it('should filter by assigneeId', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      await taskService.listTasks({ assigneeId: 'user-1' });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: 'user-1',
          }),
        })
      );
    });

    it('should filter by orderId', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      await taskService.listTasks({ orderId: 'order-1' });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: 'order-1',
          }),
        })
      );
    });

    it('should support sorting', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(0);

      await taskService.listTasks({ sortBy: 'dueDate', sortOrder: 'asc' });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dueDate: 'asc' },
        })
      );
    });

    it('should apply pagination correctly', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);
      prismaMock.task.count.mockResolvedValue(100);

      const result = await taskService.listTasks({ page: 3, limit: 20 });

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        })
      );
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  // ==================== getTaskById ====================
  describe('getTaskById', () => {
    it('should return task with related data', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        assignedTo: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        order: {
          customer: { businessName: 'Test Co' },
          items: [{ product: { name: 'Product 1' } }],
        },
      };

      prismaMock.task.findUnique.mockResolvedValue(mockTask as any);

      const result = await taskService.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(prismaMock.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: expect.objectContaining({
          assignedTo: true,
          order: expect.any(Object),
        }),
      });
    });

    it('should return null when task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      const result = await taskService.getTaskById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== createTask ====================
  describe('createTask', () => {
    it('should create task with TODO status', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'New Task',
        status: 'TODO',
        priority: 'MEDIUM',
      };

      prismaMock.task.create.mockResolvedValue(mockTask as any);

      const result = await taskService.createTask({
        title: 'New Task',
        priority: 'MEDIUM',
      } as any);

      expect(result.status).toBe('TODO');
      expect(prismaMock.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Task',
          status: 'TODO',
        }),
        include: expect.any(Object),
      });
    });

    it('should create task with orderId', async () => {
      prismaMock.task.create.mockResolvedValue({
        id: 'task-1',
        orderId: 'order-1',
      } as any);

      await taskService.createTask({
        title: 'Order Task',
        orderId: 'order-1',
      } as any);

      expect(prismaMock.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
        }),
        include: expect.any(Object),
      });
    });

    it('should create task with all fields', async () => {
      prismaMock.task.create.mockResolvedValue({} as any);

      await taskService.createTask({
        title: 'Full Task',
        description: 'Task description',
        priority: 'HIGH',
        dueDate: '2024-12-31',
        estimatedHours: 4,
      } as any);

      expect(prismaMock.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Full Task',
          description: 'Task description',
          priority: 'HIGH',
          estimatedHours: 4,
        }),
        include: expect.any(Object),
      });
    });
  });

  // ==================== updateTask ====================
  describe('updateTask', () => {
    it('should update task fields', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'TODO',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        title: 'Updated Title',
      } as any);

      const result = await taskService.updateTask('task-1', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw error when task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(
        taskService.updateTask('non-existent', { title: 'Test' })
      ).rejects.toThrow('Task not found');
    });

    it('should set completedDate when status changes to DONE', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'DONE',
        completedDate: new Date(),
      } as any);

      await taskService.updateTask('task-1', { status: 'DONE' as any });

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'DONE',
          completedDate: expect.any(String),
        }),
        include: expect.any(Object),
      });
    });

    it('should not set completedDate if already DONE', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'DONE',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'DONE',
      } as any);

      await taskService.updateTask('task-1', { status: 'DONE' as any });

      // completedDate should not be in the update since status is already DONE
      const updateCall = prismaMock.task.update.mock.calls[0][0];
      expect(updateCall.data.completedDate).toBeUndefined();
    });
  });

  // ==================== assignTask ====================
  describe('assignTask', () => {
    it('should assign task to employee', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'TODO',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        assignedToId: 'user-1',
        status: 'TODO',
      } as any);

      const result = await taskService.assignTask('task-1', 'user-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          assignedToId: 'user-1',
          status: 'TODO',
        }),
        include: expect.any(Object),
      });
    });

    it('should reset status to TODO when assigning', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'BLOCKED',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'TODO',
      } as any);

      await taskService.assignTask('task-1', 'user-2');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'TODO',
        }),
        include: expect.any(Object),
      });
    });
  });

  // ==================== startTask ====================
  describe('startTask', () => {
    it('should change status from TODO to IN_PROGRESS', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'TODO',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
      } as any);

      const result = await taskService.startTask('task-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(taskService.startTask('non-existent')).rejects.toThrow(
        'Task not found'
      );
    });

    it('should throw error if task is not in TODO status', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
      } as any);

      await expect(taskService.startTask('task-1')).rejects.toThrow(
        'Cannot start task in status IN_PROGRESS'
      );
    });
  });

  // ==================== completeTask ====================
  describe('completeTask', () => {
    it('should change status from IN_PROGRESS to DONE', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'DONE',
        completedDate: new Date(),
      } as any);

      await taskService.completeTask('task-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'DONE',
          completedDate: expect.any(String),
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(taskService.completeTask('non-existent')).rejects.toThrow(
        'Task not found'
      );
    });

    it('should throw error if task is in invalid status', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'TODO',
      } as any);

      await expect(taskService.completeTask('task-1')).rejects.toThrow(
        'Cannot complete task in status TODO'
      );
    });

    it('should include actual hours if provided', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
      } as any);
      prismaMock.task.update.mockResolvedValue({} as any);

      await taskService.completeTask('task-1', 5.5, 'All done');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          estimatedHours: 5.5,
        }),
        include: expect.any(Object),
      });
    });
  });

  // ==================== blockTask ====================
  describe('blockTask', () => {
    it('should set status to BLOCKED', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
        description: 'Original description',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'BLOCKED',
      } as any);

      await taskService.blockTask('task-1', 'Waiting for materials');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'BLOCKED',
        }),
        include: expect.any(Object),
      });
    });

    it('should append block reason to description', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'IN_PROGRESS',
        description: 'Original',
      } as any);
      prismaMock.task.update.mockResolvedValue({} as any);

      await taskService.blockTask('task-1', 'Blocked reason');

      const updateCall = prismaMock.task.update.mock.calls[0][0];
      expect(updateCall.data.description).toContain('BLOCKED: Blocked reason');
    });

    it('should throw error if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(
        taskService.blockTask('non-existent', 'reason')
      ).rejects.toThrow('Task not found');
    });
  });

  // ==================== unblockTask ====================
  describe('unblockTask', () => {
    it('should set status to TODO', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'BLOCKED',
      } as any);
      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        status: 'TODO',
      } as any);

      await taskService.unblockTask('task-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'TODO',
        }),
        include: expect.any(Object),
      });
    });
  });

  // ==================== getOverdueTasks ====================
  describe('getOverdueTasks', () => {
    it('should return tasks past due date', async () => {
      const mockOverdueTasks = [
        { id: 'task-1', title: 'Overdue 1', dueDate: new Date('2024-01-01') },
        { id: 'task-2', title: 'Overdue 2', dueDate: new Date('2024-01-05') },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockOverdueTasks as any);

      const result = await taskService.getOverdueTasks();

      expect(result).toHaveLength(2);
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {
          dueDate: { lt: expect.any(Date) },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        include: expect.any(Object),
        orderBy: { dueDate: 'asc' },
      });
    });

    it('should exclude DONE and CANCELLED tasks', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await taskService.getOverdueTasks();

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: { notIn: ['DONE', 'CANCELLED'] },
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('should return empty array when no overdue tasks', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const result = await taskService.getOverdueTasks();

      expect(result).toHaveLength(0);
    });
  });

  // ==================== getTasksByEmployee ====================
  describe('getTasksByEmployee', () => {
    it('should return tasks assigned to employee', async () => {
      const mockTasks = [
        { id: 'task-1', assignedToId: 'emp-1' },
        { id: 'task-2', assignedToId: 'emp-1' },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await taskService.getTasksByEmployee('emp-1');

      expect(result).toHaveLength(2);
      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { assignedToId: 'emp-1' },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should filter by status when provided', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await taskService.getTasksByEmployee('emp-1', 'IN_PROGRESS');

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { assignedToId: 'emp-1', status: 'IN_PROGRESS' },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should sort by priority and dueDate', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await taskService.getTasksByEmployee('emp-1');

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      });
    });
  });

  // ==================== getTaskStats ====================
  describe('getTaskStats', () => {
    it('should calculate task statistics', async () => {
      const mockTasks = [
        { status: 'DONE', priority: 'HIGH', type: 'PRODUCTION', estimatedHours: 4, actualHours: 5 },
        { status: 'DONE', priority: 'MEDIUM', type: 'PRODUCTION', estimatedHours: 2, actualHours: 2 },
        { status: 'TODO', priority: 'LOW', type: 'SHIPPING', estimatedHours: 1, actualHours: 0 },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await taskService.getTaskStats('2024-01-01', '2024-01-31');

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.completionRate).toBeCloseTo(66.67, 0);
      expect(result.byStatus).toEqual({
        DONE: 2,
        TODO: 1,
      });
    });

    it('should aggregate by priority', async () => {
      const mockTasks = [
        { status: 'TODO', priority: 'HIGH', type: 'A' },
        { status: 'TODO', priority: 'HIGH', type: 'A' },
        { status: 'TODO', priority: 'LOW', type: 'A' },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await taskService.getTaskStats('2024-01-01', '2024-01-31');

      expect(result.byPriority).toEqual({
        HIGH: 2,
        LOW: 1,
      });
    });

    it('should calculate total hours', async () => {
      const mockTasks = [
        { status: 'DONE', priority: 'HIGH', type: 'A', estimatedHours: 4, actualHours: 5 },
        { status: 'DONE', priority: 'HIGH', type: 'A', estimatedHours: 2, actualHours: 3 },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await taskService.getTaskStats('2024-01-01', '2024-01-31');

      expect(result.totalEstimatedHours).toBe(6);
      expect(result.totalActualHours).toBe(8);
    });

    it('should return zero completion rate when no tasks', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const result = await taskService.getTaskStats('2024-01-01', '2024-01-31');

      expect(result.completionRate).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // ==================== autoAssignTask ====================
  describe('autoAssignTask', () => {
    it('should assign to least loaded employee', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        assignedToId: null,
        status: 'TODO',
      } as any);

      prismaMock.employee.findMany.mockResolvedValue([
        { id: 'emp-1', isActive: true, tasks: [1, 2, 3] },
        { id: 'emp-2', isActive: true, tasks: [1] },
        { id: 'emp-3', isActive: true, tasks: [1, 2] },
      ] as any);

      prismaMock.task.update.mockResolvedValue({
        id: 'task-1',
        assignedToId: 'emp-2',
      } as any);

      await taskService.autoAssignTask('task-1');

      expect(prismaMock.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          assignedToId: 'emp-2',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error if task already assigned', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        assignedToId: 'emp-1',
      } as any);

      await expect(taskService.autoAssignTask('task-1')).rejects.toThrow(
        'Task already assigned'
      );
    });

    it('should throw error if no available employees', async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        assignedToId: null,
      } as any);

      prismaMock.employee.findMany.mockResolvedValue([]);

      await expect(taskService.autoAssignTask('task-1')).rejects.toThrow(
        'No available employees'
      );
    });

    it('should throw error if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(taskService.autoAssignTask('non-existent')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  // ==================== getKanbanBoard ====================
  describe('getKanbanBoard', () => {
    it('should group tasks by status', async () => {
      const mockTasks = [
        { id: 'task-1', status: 'TODO' },
        { id: 'task-2', status: 'TODO' },
        { id: 'task-3', status: 'IN_PROGRESS' },
        { id: 'task-4', status: 'DONE' },
        { id: 'task-5', status: 'BLOCKED' },
      ];

      prismaMock.task.findMany.mockResolvedValue(mockTasks as any);

      const result = await taskService.getKanbanBoard();

      expect(result.TODO).toHaveLength(2);
      expect(result.IN_PROGRESS).toHaveLength(1);
      expect(result.DONE).toHaveLength(1);
      expect(result.BLOCKED).toHaveLength(1);
      expect(result.REVIEW).toHaveLength(0);
    });

    it('should filter by orderId when provided', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await taskService.getKanbanBoard('order-1');

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should return all tasks when no orderId', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await taskService.getKanbanBoard();

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should sort by priority and dueDate', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      await taskService.getKanbanBoard();

      expect(prismaMock.task.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      });
    });
  });
});
