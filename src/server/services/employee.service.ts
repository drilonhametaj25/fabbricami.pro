import { prisma } from '../config/database';
import { CreateEmployeeInput, UpdateEmployeeInput } from '../schemas/employee.schema';

/**
 * Employee Service
 * Business logic per gestione dipendenti, timbrature, costi
 */
class EmployeeService {
  /**
   * Lista dipendenti
   */
  async listEmployees(params: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 50,
      role: _role,
      isActive,
      search,
      sortBy = 'user.lastName',
      sortOrder = 'asc',
    } = params;
    void _role; // Not used in query filter

    const where: any = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { position: { contains: search, mode: 'insensitive' } },
          {
            user: {
              email: { contains: search, mode: 'insensitive' },
            },
          },
          {
            user: {
              firstName: { contains: search, mode: 'insensitive' },
            },
          },
          {
            user: {
              lastName: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };

    // Handle orderBy - support nested user fields
    let orderBy: any;
    if (sortBy.startsWith('user.')) {
      const userField = sortBy.replace('user.', '');
      orderBy = { user: { [userField]: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    const [items, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              timeEntries: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.employee.count({ where }),
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
   * Dettaglio dipendente
   */
  async getEmployeeById(id: string) {
    return await prisma.employee.findUnique({
      where: { id },
      include: {
        user: true,
        timeEntries: {
          orderBy: { clockIn: 'desc' },
          take: 30,
        },
        leaves: {
          orderBy: { startDate: 'desc' },
          take: 10,
        },
        operationTypeQualifications: {
          include: {
            operationType: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Crea dipendente
   */
  async createEmployee(data: CreateEmployeeInput) {
    const code = await this.generateEmployeeCode();

    // Crea prima l'utente se necessario
    const userData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'OPERATORE' as const,
      password: data.password || Math.random().toString(36).slice(-8), // Password temporanea
    };

    const user = await prisma.user.create({
      data: userData,
    });

    return await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: code,
        position: data.position,
        hourlyRate: data.hourlyCost,
        hireDate: new Date(data.hireDate),
        isActive: true,
      },
      include: {
        user: true,
      },
    });
  }

  /**
   * Aggiorna dipendente
   */
  async updateEmployee(id: string, data: UpdateEmployeeInput) {
    // Trova prima il dipendente per ottenere l'userId
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!employee) {
      throw new Error('Dipendente non trovato');
    }

    // Separa i campi User dai campi Employee
    const { firstName, lastName, email, password, ...employeeData } = data;

    // Prepara i dati Employee
    const employeeUpdateData: any = {};
    if (employeeData.position !== undefined) employeeUpdateData.position = employeeData.position;
    if (employeeData.hourlyCost !== undefined) employeeUpdateData.hourlyRate = employeeData.hourlyCost;
    if (employeeData.hireDate !== undefined) employeeUpdateData.hireDate = new Date(employeeData.hireDate);
    if (employeeData.isActive !== undefined) employeeUpdateData.isActive = employeeData.isActive;
    if (employeeData.terminationDate !== undefined) employeeUpdateData.terminationDate = new Date(employeeData.terminationDate);
    if (employeeData.department !== undefined) employeeUpdateData.department = employeeData.department;
    if (employeeData.weeklyHours !== undefined) employeeUpdateData.weeklyHours = employeeData.weeklyHours;
    if (employeeData.notes !== undefined) employeeUpdateData.notes = employeeData.notes;

    // Prepara i dati User
    const userUpdateData: any = {};
    if (firstName !== undefined) userUpdateData.firstName = firstName;
    if (lastName !== undefined) userUpdateData.lastName = lastName;
    if (email !== undefined) userUpdateData.email = email;

    // Esegui gli aggiornamenti in una transazione
    return await prisma.$transaction(async (tx) => {
      // Aggiorna User se ci sono dati
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: employee.userId },
          data: userUpdateData,
        });
      }

      // Aggiorna Employee
      return await tx.employee.update({
        where: { id },
        data: employeeUpdateData,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    });
  }

  /**
   * Timbratura ingresso (CLOCK_IN)
   */
  async clockIn(employeeId: string, notes?: string) {
    // Verifica che non ci sia già una timbratura aperta
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId,
        clockOut: null,
      },
    });

    if (openEntry) {
      throw new Error('Employee already clocked in');
    }

    return await prisma.timeEntry.create({
      data: {
        employeeId,
        type: 'WORK',
        clockIn: new Date(),
        notes,
      },
    });
  }

  /**
   * Timbratura uscita (CLOCK_OUT)
   */
  async clockOut(employeeId: string, notes?: string) {
    const openEntry = await prisma.timeEntry.findFirst({
      where: {
        employeeId,
        clockOut: null,
      },
    });

    if (!openEntry) {
      throw new Error('No open time entry found');
    }

    const clockOut = new Date();
    const durationMinutes = Math.round((clockOut.getTime() - openEntry.clockIn.getTime()) / (1000 * 60));

    return await prisma.timeEntry.update({
      where: { id: openEntry.id },
      data: {
        clockOut,
        duration: durationMinutes,
        notes: notes ? `${openEntry.notes || ''} | ${notes}` : openEntry.notes,
      },
    });
  }

  /**
   * Calcola ore lavorate per periodo
   */
  async getWorkedHours(employeeId: string, startDate: string, endDate: string) {
    const entries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        clockIn: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        clockOut: { not: null },
      },
      orderBy: { clockIn: 'asc' },
    });

    // duration è in minuti, converte in ore
    const totalHours = entries.reduce((sum: number, entry: any) => sum + ((entry.duration || 0) / 60), 0);
    const byType = entries.reduce((acc: any, entry: any) => {
      acc[entry.type] = (acc[entry.type] || 0) + ((entry.duration || 0) / 60);
      return acc;
    }, {});

    return {
      employeeId,
      period: { start: startDate, end: endDate },
      totalHours,
      entriesCount: entries.length,
      byType,
      entries,
    };
  }

  /**
   * Calcola costo lavorativo per periodo
   */
  async calculateLaborCost(employeeId: string, startDate: string, endDate: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    const workedData = await this.getWorkedHours(employeeId, startDate, endDate);
    const cost = workedData.totalHours * Number(employee.hourlyRate);

    return {
      employeeId,
      employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
      period: { start: startDate, end: endDate },
      totalHours: workedData.totalHours,
      hourlyRate: Number(employee.hourlyRate),
      totalCost: cost,
      byType: Object.entries(workedData.byType).map(([type, hours]) => ({
        type,
        hours,
        cost: (hours as number) * Number(employee.hourlyRate),
      })),
    };
  }

  /**
   * Produttività dipendente (ore su task vs ore totali)
   */
  async calculateProductivity(employeeId: string, startDate: string, endDate: string) {
    const [workedData, taskHours] = await Promise.all([
      this.getWorkedHours(employeeId, startDate, endDate),
      this.getTaskHours(employeeId, startDate, endDate),
    ]);

    const productivityRate = workedData.totalHours > 0
      ? (taskHours.totalHours / workedData.totalHours) * 100
      : 0;

    return {
      employeeId,
      period: { start: startDate, end: endDate },
      totalWorkedHours: workedData.totalHours,
      totalTaskHours: taskHours.totalHours,
      productivityRate,
      tasksCompleted: taskHours.tasksCount,
    };
  }

  /**
   * Ore lavorate su task
   */
  async getTaskHours(employeeId: string, startDate: string, endDate: string) {
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: employeeId,
        completedDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        id: true,
        title: true,
        actualHours: true,
      },
    });

    const totalHours = tasks.reduce((sum: number, task: any) => sum + (task.actualHours || 0), 0);

    return {
      totalHours,
      tasksCount: tasks.length,
      tasks,
    };
  }

  /**
   * Richiesta ferie/permessi
   */
  async createLeaveRequest(data: {
    employeeId: string;
    type: 'VACATION' | 'SICK' | 'PERSONAL' | 'OTHER';
    startDate: string;
    endDate: string;
    notes?: string;
  }) {
    const { employeeId, type, startDate, endDate, notes } = data;

    // Calcola i giorni
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Verifica che non ci siano già richieste approvate per lo stesso periodo
    const conflicting = await prisma.employeeLeave.findFirst({
      where: {
        employeeId,
        status: 'approved',
        OR: [
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: start } },
            ],
          },
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: end } },
            ],
          },
        ],
      },
    });

    if (conflicting) {
      throw new Error('Leave request overlaps with existing approved leave');
    }

    return await prisma.employeeLeave.create({
      data: {
        employeeId,
        type: type as any,
        startDate: start,
        endDate: end,
        days,
        notes,
        status: 'pending',
      },
    });
  }

  /**
   * Approva/Rifiuta richiesta ferie
   */
  async updateLeaveRequestStatus(
    id: string,
    status: 'approved' | 'rejected',
    notes?: string
  ) {
    return await prisma.employeeLeave.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
      },
    });
  }

  /**
   * Ferie residue dipendente
   */
  async getRemainingLeave(employeeId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();

    const approvedLeaves = await prisma.employeeLeave.findMany({
      where: {
        employeeId,
        type: 'VACATION',
        status: 'approved',
        startDate: {
          gte: new Date(`${targetYear}-01-01`),
          lt: new Date(`${targetYear + 1}-01-01`),
        },
      },
    });

    const usedDays = approvedLeaves.reduce((sum: number, leave: any) => {
      return sum + Number(leave.days || 0);
    }, 0);

    const totalDays = 22; // Default italiano
    const remaining = totalDays - usedDays;

    return {
      year: targetYear,
      totalDays,
      usedDays,
      remainingDays: remaining,
    };
  }

  /**
   * Report presenze mensile
   */
  async getMonthlyAttendance(employeeId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const entries = await prisma.timeEntry.findMany({
      where: {
        employeeId,
        clockIn: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { clockIn: 'asc' },
    });

    const daysWorked = new Set(
      entries.map((entry: any) => entry.clockIn.toISOString().split('T')[0])
    ).size;

    // duration è in minuti, converte in ore
    const totalHours = entries.reduce((sum: number, entry: any) => sum + ((entry.duration || 0) / 60), 0);

    return {
      employeeId,
      period: { year, month },
      daysWorked,
      totalHours,
      averageHoursPerDay: daysWorked > 0 ? totalHours / daysWorked : 0,
      entries,
    };
  }

  /**
   * Helper: genera codice dipendente
   */
  private async generateEmployeeCode(): Promise<string> {
    const lastEmployee = await prisma.employee.findFirst({
      where: {
        employeeCode: {
          startsWith: 'EMP',
        },
      },
      orderBy: {
        employeeCode: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastEmployee) {
      const match = lastEmployee.employeeCode.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `EMP${nextNumber.toString().padStart(4, '0')}`;
  }
}

export const employeeService = new EmployeeService();
export default employeeService;
