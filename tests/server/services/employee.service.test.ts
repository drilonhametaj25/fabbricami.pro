import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Create mock instance
const prismaMock = mockDeep<PrismaClient>();

// Mock database
jest.mock('@server/config/database', () => ({
  prisma: prismaMock,
}));

import employeeService from '@server/services/employee.service';

// Helper to create Decimal values
const createDecimal = (value: number): Decimal => new Decimal(value);

describe('EmployeeService', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
  });

  // ==================== listEmployees ====================
  describe('listEmployees', () => {
    it('should return paginated employees list', async () => {
      const mockEmployees = [
        {
          id: 'emp-1',
          employeeCode: 'EMP0001',
          position: 'Developer',
          isActive: true,
          user: { email: 'emp1@test.com', firstName: 'John', lastName: 'Doe' },
          _count: { timeEntries: 10 },
        },
      ];

      prismaMock.employee.findMany.mockResolvedValue(mockEmployees as any);
      prismaMock.employee.count.mockResolvedValue(1);

      const result = await employeeService.listEmployees({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by isActive status', async () => {
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.employee.count.mockResolvedValue(0);

      await employeeService.listEmployees({ isActive: true });

      expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });

    it('should filter by search term across multiple fields', async () => {
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.employee.count.mockResolvedValue(0);

      await employeeService.listEmployees({ search: 'john' });

      expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { employeeCode: { contains: 'john', mode: 'insensitive' } },
              { position: { contains: 'john', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should support sorting by user fields', async () => {
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.employee.count.mockResolvedValue(0);

      await employeeService.listEmployees({ sortBy: 'user.lastName', sortOrder: 'desc' });

      expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { user: { lastName: 'desc' } },
        })
      );
    });

    it('should support sorting by employee fields', async () => {
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.employee.count.mockResolvedValue(0);

      await employeeService.listEmployees({ sortBy: 'position', sortOrder: 'asc' });

      expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { position: 'asc' },
        })
      );
    });

    it('should apply pagination correctly', async () => {
      prismaMock.employee.findMany.mockResolvedValue([]);
      prismaMock.employee.count.mockResolvedValue(100);

      const result = await employeeService.listEmployees({ page: 3, limit: 20 });

      expect(prismaMock.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3-1) * 20
          take: 20,
        })
      );
      expect(result.pagination.totalPages).toBe(5); // 100 / 20
    });
  });

  // ==================== getEmployeeById ====================
  describe('getEmployeeById', () => {
    it('should return employee with related data', async () => {
      const mockEmployee = {
        id: 'emp-1',
        employeeCode: 'EMP0001',
        user: { email: 'emp@test.com', firstName: 'John', lastName: 'Doe' },
        timeEntries: [],
        leaves: [],
        operationTypeQualifications: [],
      };

      prismaMock.employee.findUnique.mockResolvedValue(mockEmployee as any);

      const result = await employeeService.getEmployeeById('emp-1');

      expect(result).toEqual(mockEmployee);
      expect(prismaMock.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        include: expect.objectContaining({
          user: true,
          timeEntries: expect.any(Object),
          leaves: expect.any(Object),
          operationTypeQualifications: expect.any(Object),
        }),
      });
    });

    it('should return null when employee not found', async () => {
      prismaMock.employee.findUnique.mockResolvedValue(null);

      const result = await employeeService.getEmployeeById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== createEmployee ====================
  describe('createEmployee', () => {
    it('should create user and employee', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'Employee',
      };

      const mockEmployee = {
        id: 'emp-1',
        employeeCode: 'EMP0001',
        userId: 'user-1',
        position: 'Developer',
        user: mockUser,
      };

      prismaMock.employee.findFirst.mockResolvedValue(null); // For generateEmployeeCode
      prismaMock.user.create.mockResolvedValue(mockUser as any);
      prismaMock.employee.create.mockResolvedValue(mockEmployee as any);

      const result = await employeeService.createEmployee({
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'Employee',
        position: 'Developer',
        hourlyCost: 25,
        hireDate: '2024-01-15',
      });

      expect(result.employeeCode).toBe('EMP0001');
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@test.com',
          firstName: 'New',
          lastName: 'Employee',
          role: 'OPERATORE',
        }),
      });
    });

    it('should generate sequential employee code', async () => {
      prismaMock.employee.findFirst.mockResolvedValue({
        employeeCode: 'EMP0005',
      } as any);
      prismaMock.user.create.mockResolvedValue({ id: 'user-1' } as any);
      prismaMock.employee.create.mockResolvedValue({
        employeeCode: 'EMP0006',
      } as any);

      const result = await employeeService.createEmployee({
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        position: 'Tester',
        hourlyCost: 20,
        hireDate: '2024-01-01',
      });

      expect(prismaMock.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeCode: 'EMP0006',
          }),
        })
      );
    });

    it('should use provided password or generate random', async () => {
      prismaMock.employee.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'user-1' } as any);
      prismaMock.employee.create.mockResolvedValue({} as any);

      // With password
      await employeeService.createEmployee({
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        position: 'Tester',
        hourlyCost: 20,
        hireDate: '2024-01-01',
        password: 'mypassword123',
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          password: 'mypassword123',
        }),
      });
    });
  });

  // ==================== updateEmployee ====================
  describe('updateEmployee', () => {
    it('should update employee fields', async () => {
      prismaMock.employee.findUnique.mockResolvedValue({ userId: 'user-1' } as any);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          user: { update: jest.fn() },
          employee: {
            update: jest.fn().mockResolvedValue({
              id: 'emp-1',
              position: 'Senior Developer',
            }),
          },
        };
        return callback(tx);
      });
      prismaMock.$transaction.mockImplementation(mockTransaction);

      const result = await employeeService.updateEmployee('emp-1', {
        position: 'Senior Developer',
        hourlyCost: 35,
      });

      expect(result.position).toBe('Senior Developer');
    });

    it('should throw error when employee not found', async () => {
      prismaMock.employee.findUnique.mockResolvedValue(null);

      await expect(
        employeeService.updateEmployee('non-existent', { position: 'Test' })
      ).rejects.toThrow('Dipendente non trovato');
    });

    it('should update user and employee in transaction', async () => {
      prismaMock.employee.findUnique.mockResolvedValue({ userId: 'user-1' } as any);

      const mockUserUpdate = jest.fn();
      const mockEmployeeUpdate = jest.fn().mockResolvedValue({
        id: 'emp-1',
        user: { email: 'new@test.com', firstName: 'Updated', lastName: 'Name' },
      });

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          user: { update: mockUserUpdate },
          employee: { update: mockEmployeeUpdate },
        });
      });

      await employeeService.updateEmployee('emp-1', {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'new@test.com',
        position: 'Manager',
      });

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          firstName: 'Updated',
          lastName: 'Name',
          email: 'new@test.com',
        },
      });
      expect(mockEmployeeUpdate).toHaveBeenCalled();
    });

    it('should not update user if no user fields provided', async () => {
      prismaMock.employee.findUnique.mockResolvedValue({ userId: 'user-1' } as any);

      const mockUserUpdate = jest.fn();
      const mockEmployeeUpdate = jest.fn().mockResolvedValue({ id: 'emp-1' });

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          user: { update: mockUserUpdate },
          employee: { update: mockEmployeeUpdate },
        });
      });

      await employeeService.updateEmployee('emp-1', { position: 'Manager' });

      expect(mockUserUpdate).not.toHaveBeenCalled();
    });
  });

  // ==================== clockIn ====================
  describe('clockIn', () => {
    it('should create time entry on clock in', async () => {
      prismaMock.timeEntry.findFirst.mockResolvedValue(null); // No open entry
      prismaMock.timeEntry.create.mockResolvedValue({
        id: 'entry-1',
        employeeId: 'emp-1',
        type: 'WORK',
        clockIn: new Date(),
        notes: 'Morning shift',
      } as any);

      const result = await employeeService.clockIn('emp-1', 'Morning shift');

      expect(result.type).toBe('WORK');
      expect(prismaMock.timeEntry.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          type: 'WORK',
          clockIn: expect.any(Date),
          notes: 'Morning shift',
        },
      });
    });

    it('should throw error if already clocked in', async () => {
      prismaMock.timeEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        clockOut: null,
      } as any);

      await expect(employeeService.clockIn('emp-1')).rejects.toThrow(
        'Employee already clocked in'
      );
    });

    it('should allow clock in without notes', async () => {
      prismaMock.timeEntry.findFirst.mockResolvedValue(null);
      prismaMock.timeEntry.create.mockResolvedValue({
        id: 'entry-1',
        notes: undefined,
      } as any);

      await employeeService.clockIn('emp-1');

      expect(prismaMock.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: undefined,
        }),
      });
    });
  });

  // ==================== clockOut ====================
  describe('clockOut', () => {
    it('should update time entry with clock out', async () => {
      const clockInTime = new Date();
      clockInTime.setHours(clockInTime.getHours() - 8);

      prismaMock.timeEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        clockIn: clockInTime,
        notes: 'Morning',
        clockOut: null,
      } as any);
      prismaMock.timeEntry.update.mockResolvedValue({
        id: 'entry-1',
        clockOut: new Date(),
        duration: 480, // 8 hours in minutes
      } as any);

      const result = await employeeService.clockOut('emp-1', 'End of day');

      expect(prismaMock.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          clockOut: expect.any(Date),
          duration: expect.any(Number),
          notes: 'Morning | End of day',
        },
      });
    });

    it('should throw error if no open time entry', async () => {
      prismaMock.timeEntry.findFirst.mockResolvedValue(null);

      await expect(employeeService.clockOut('emp-1')).rejects.toThrow(
        'No open time entry found'
      );
    });

    it('should calculate duration in minutes', async () => {
      const clockInTime = new Date();
      clockInTime.setMinutes(clockInTime.getMinutes() - 120); // 2 hours ago

      prismaMock.timeEntry.findFirst.mockResolvedValue({
        id: 'entry-1',
        clockIn: clockInTime,
        notes: null,
        clockOut: null,
      } as any);
      prismaMock.timeEntry.update.mockResolvedValue({} as any);

      await employeeService.clockOut('emp-1');

      expect(prismaMock.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: expect.objectContaining({
          duration: expect.any(Number),
        }),
      });

      const updateCall = prismaMock.timeEntry.update.mock.calls[0][0];
      expect(updateCall.data.duration).toBeGreaterThanOrEqual(119);
      expect(updateCall.data.duration).toBeLessThanOrEqual(121);
    });
  });

  // ==================== getWorkedHours ====================
  describe('getWorkedHours', () => {
    it('should calculate total worked hours', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 }, // 8 hours
        { type: 'WORK', duration: 240 }, // 4 hours
        { type: 'OVERTIME', duration: 120 }, // 2 hours
      ] as any);

      const result = await employeeService.getWorkedHours('emp-1', '2024-01-01', '2024-01-31');

      expect(result.totalHours).toBe(14); // 8 + 4 + 2
      expect(result.entriesCount).toBe(3);
    });

    it('should group hours by type', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 },
        { type: 'WORK', duration: 480 },
        { type: 'OVERTIME', duration: 120 },
      ] as any);

      const result = await employeeService.getWorkedHours('emp-1', '2024-01-01', '2024-01-31');

      expect(result.byType).toEqual({
        WORK: 16, // 8 + 8
        OVERTIME: 2,
      });
    });

    it('should return zero for no entries', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const result = await employeeService.getWorkedHours('emp-1', '2024-01-01', '2024-01-31');

      expect(result.totalHours).toBe(0);
      expect(result.entriesCount).toBe(0);
      expect(result.byType).toEqual({});
    });

    it('should handle null duration', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 },
        { type: 'WORK', duration: null }, // No duration yet
      ] as any);

      const result = await employeeService.getWorkedHours('emp-1', '2024-01-01', '2024-01-31');

      expect(result.totalHours).toBe(8);
    });
  });

  // ==================== calculateLaborCost ====================
  describe('calculateLaborCost', () => {
    it('should calculate labor cost based on hours and rate', async () => {
      prismaMock.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        hourlyRate: createDecimal(25),
        user: { firstName: 'John', lastName: 'Doe' },
      } as any);

      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 }, // 8 hours
        { type: 'WORK', duration: 480 }, // 8 hours
      ] as any);

      const result = await employeeService.calculateLaborCost('emp-1', '2024-01-01', '2024-01-31');

      expect(result.totalHours).toBe(16);
      expect(result.hourlyRate).toBe(25);
      expect(result.totalCost).toBe(400); // 16 * 25
      expect(result.employeeName).toBe('John Doe');
    });

    it('should throw error when employee not found', async () => {
      prismaMock.employee.findUnique.mockResolvedValue(null);

      await expect(
        employeeService.calculateLaborCost('non-existent', '2024-01-01', '2024-01-31')
      ).rejects.toThrow('Employee not found');
    });

    it('should break down cost by type', async () => {
      prismaMock.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        hourlyRate: createDecimal(30),
        user: { firstName: 'Jane', lastName: 'Smith' },
      } as any);

      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 },
        { type: 'OVERTIME', duration: 120 },
      ] as any);

      const result = await employeeService.calculateLaborCost('emp-1', '2024-01-01', '2024-01-31');

      expect(result.byType).toEqual([
        { type: 'WORK', hours: 8, cost: 240 },
        { type: 'OVERTIME', hours: 2, cost: 60 },
      ]);
    });
  });

  // ==================== calculateProductivity ====================
  describe('calculateProductivity', () => {
    it('should calculate productivity rate', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 },
        { type: 'WORK', duration: 480 },
      ] as any);

      prismaMock.task.findMany.mockResolvedValue([
        { id: 'task-1', actualHours: 6 },
        { id: 'task-2', actualHours: 4 },
      ] as any);

      const result = await employeeService.calculateProductivity(
        'emp-1',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.totalWorkedHours).toBe(16);
      expect(result.totalTaskHours).toBe(10);
      expect(result.productivityRate).toBe(62.5); // (10 / 16) * 100
      expect(result.tasksCompleted).toBe(2);
    });

    it('should return 0 productivity rate when no hours worked', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);
      prismaMock.task.findMany.mockResolvedValue([]);

      const result = await employeeService.calculateProductivity(
        'emp-1',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.productivityRate).toBe(0);
    });

    it('should handle tasks with null actualHours', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([
        { type: 'WORK', duration: 480 },
      ] as any);

      prismaMock.task.findMany.mockResolvedValue([
        { id: 'task-1', actualHours: 4 },
        { id: 'task-2', actualHours: null },
      ] as any);

      const result = await employeeService.calculateProductivity(
        'emp-1',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.totalTaskHours).toBe(4);
    });
  });

  // ==================== getTaskHours ====================
  describe('getTaskHours', () => {
    it('should sum task hours for completed tasks', async () => {
      prismaMock.task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Task 1', actualHours: 4 },
        { id: 'task-2', title: 'Task 2', actualHours: 6 },
      ] as any);

      const result = await employeeService.getTaskHours('emp-1', '2024-01-01', '2024-01-31');

      expect(result.totalHours).toBe(10);
      expect(result.tasksCount).toBe(2);
      expect(result.tasks).toHaveLength(2);
    });

    it('should return zero for no completed tasks', async () => {
      prismaMock.task.findMany.mockResolvedValue([]);

      const result = await employeeService.getTaskHours('emp-1', '2024-01-01', '2024-01-31');

      expect(result.totalHours).toBe(0);
      expect(result.tasksCount).toBe(0);
    });
  });

  // ==================== createLeaveRequest ====================
  describe('createLeaveRequest', () => {
    it('should create leave request successfully', async () => {
      prismaMock.employeeLeave.findFirst.mockResolvedValue(null); // No conflicts
      prismaMock.employeeLeave.create.mockResolvedValue({
        id: 'leave-1',
        employeeId: 'emp-1',
        type: 'VACATION',
        days: 5,
        status: 'pending',
      } as any);

      const result = await employeeService.createLeaveRequest({
        employeeId: 'emp-1',
        type: 'VACATION',
        startDate: '2024-07-01',
        endDate: '2024-07-05',
        notes: 'Summer vacation',
      });

      expect(result.days).toBe(5);
      expect(result.status).toBe('pending');
    });

    it('should calculate days correctly', async () => {
      prismaMock.employeeLeave.findFirst.mockResolvedValue(null);
      prismaMock.employeeLeave.create.mockResolvedValue({} as any);

      await employeeService.createLeaveRequest({
        employeeId: 'emp-1',
        type: 'VACATION',
        startDate: '2024-07-01',
        endDate: '2024-07-10',
      });

      expect(prismaMock.employeeLeave.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          days: 10, // 10 days inclusive
        }),
      });
    });

    it('should throw error on overlapping approved leave', async () => {
      prismaMock.employeeLeave.findFirst.mockResolvedValue({
        id: 'existing-leave',
        status: 'approved',
      } as any);

      await expect(
        employeeService.createLeaveRequest({
          employeeId: 'emp-1',
          type: 'VACATION',
          startDate: '2024-07-01',
          endDate: '2024-07-05',
        })
      ).rejects.toThrow('Leave request overlaps with existing approved leave');
    });

    it('should support different leave types', async () => {
      prismaMock.employeeLeave.findFirst.mockResolvedValue(null);
      prismaMock.employeeLeave.create.mockResolvedValue({} as any);

      await employeeService.createLeaveRequest({
        employeeId: 'emp-1',
        type: 'SICK',
        startDate: '2024-07-01',
        endDate: '2024-07-01',
      });

      expect(prismaMock.employeeLeave.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'SICK',
        }),
      });
    });
  });

  // ==================== updateLeaveRequestStatus ====================
  describe('updateLeaveRequestStatus', () => {
    it('should approve leave request', async () => {
      prismaMock.employeeLeave.update.mockResolvedValue({
        id: 'leave-1',
        status: 'approved',
      } as any);

      const result = await employeeService.updateLeaveRequestStatus(
        'leave-1',
        'approved',
        'Approved by manager'
      );

      expect(result.status).toBe('approved');
      expect(prismaMock.employeeLeave.update).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        data: {
          status: 'approved',
          notes: 'Approved by manager',
        },
      });
    });

    it('should reject leave request', async () => {
      prismaMock.employeeLeave.update.mockResolvedValue({
        id: 'leave-1',
        status: 'rejected',
      } as any);

      const result = await employeeService.updateLeaveRequestStatus('leave-1', 'rejected');

      expect(result.status).toBe('rejected');
    });
  });

  // ==================== getRemainingLeave ====================
  describe('getRemainingLeave', () => {
    it('should calculate remaining leave days', async () => {
      prismaMock.employeeLeave.findMany.mockResolvedValue([
        { days: 5 },
        { days: 3 },
      ] as any);

      const result = await employeeService.getRemainingLeave('emp-1', 2024);

      expect(result.year).toBe(2024);
      expect(result.totalDays).toBe(22);
      expect(result.usedDays).toBe(8);
      expect(result.remainingDays).toBe(14);
    });

    it('should use current year if not provided', async () => {
      prismaMock.employeeLeave.findMany.mockResolvedValue([]);

      const result = await employeeService.getRemainingLeave('emp-1');

      expect(result.year).toBe(new Date().getFullYear());
    });

    it('should handle no approved leaves', async () => {
      prismaMock.employeeLeave.findMany.mockResolvedValue([]);

      const result = await employeeService.getRemainingLeave('emp-1', 2024);

      expect(result.usedDays).toBe(0);
      expect(result.remainingDays).toBe(22);
    });

    it('should filter by vacation type only', async () => {
      prismaMock.employeeLeave.findMany.mockResolvedValue([]);

      await employeeService.getRemainingLeave('emp-1', 2024);

      expect(prismaMock.employeeLeave.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          type: 'VACATION',
          status: 'approved',
        }),
      });
    });
  });

  // ==================== getMonthlyAttendance ====================
  describe('getMonthlyAttendance', () => {
    it('should calculate monthly attendance stats', async () => {
      const day1 = new Date('2024-01-15T08:00:00Z');
      const day2 = new Date('2024-01-16T08:00:00Z');

      prismaMock.timeEntry.findMany.mockResolvedValue([
        { clockIn: day1, duration: 480 },
        { clockIn: day2, duration: 480 },
        { clockIn: day2, duration: 120 }, // Same day
      ] as any);

      const result = await employeeService.getMonthlyAttendance('emp-1', 2024, 1);

      expect(result.daysWorked).toBe(2);
      expect(result.totalHours).toBe(18); // 8 + 8 + 2
      expect(result.averageHoursPerDay).toBe(9); // 18 / 2
    });

    it('should return zero average when no days worked', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const result = await employeeService.getMonthlyAttendance('emp-1', 2024, 1);

      expect(result.daysWorked).toBe(0);
      expect(result.totalHours).toBe(0);
      expect(result.averageHoursPerDay).toBe(0);
    });

    it('should include period info in result', async () => {
      prismaMock.timeEntry.findMany.mockResolvedValue([]);

      const result = await employeeService.getMonthlyAttendance('emp-1', 2024, 6);

      expect(result.period).toEqual({ year: 2024, month: 6 });
    });
  });

  // ==================== generateEmployeeCode (private but tested through create) ====================
  describe('generateEmployeeCode', () => {
    it('should generate first code as EMP0001', async () => {
      prismaMock.employee.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'user-1' } as any);
      prismaMock.employee.create.mockResolvedValue({} as any);

      await employeeService.createEmployee({
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        position: 'Developer',
        hourlyCost: 25,
        hireDate: '2024-01-01',
      });

      expect(prismaMock.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeCode: 'EMP0001',
          }),
        })
      );
    });

    it('should increment from last employee code', async () => {
      prismaMock.employee.findFirst.mockResolvedValue({
        employeeCode: 'EMP0099',
      } as any);
      prismaMock.user.create.mockResolvedValue({ id: 'user-1' } as any);
      prismaMock.employee.create.mockResolvedValue({} as any);

      await employeeService.createEmployee({
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        position: 'Developer',
        hourlyCost: 25,
        hireDate: '2024-01-01',
      });

      expect(prismaMock.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeCode: 'EMP0100',
          }),
        })
      );
    });
  });
});
