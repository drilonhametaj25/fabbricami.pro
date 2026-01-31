import { prisma } from '../config/database';

/**
 * Employee Repository
 * Data access layer per dipendenti
 */
class EmployeeRepository {
  /**
   * Trova dipendente per ID
   */
  async findById(id: string) {
    return await prisma.employee.findUnique({
      where: { id },
    });
  }

  /**
   * Trova dipendente per codice
   */
  async findByCode(employeeCode: string) {
    return await prisma.employee.findUnique({
      where: { employeeCode },
    });
  }

  /**
   * Trova dipendente per email (tramite User relation)
   */
  async findByEmail(email: string) {
    return await prisma.employee.findFirst({
      where: {
        user: {
          email,
        },
      },
      include: {
        user: true,
      },
    });
  }

  /**
   * Lista dipendenti
   */
  async findMany(options: {
    skip?: number;
    take?: number;
    role?: string;
    isActive?: boolean;
    search?: string;
    orderBy?: any;
  }) {
    const { skip, take, isActive, search, orderBy } = options;

    return await prisma.employee.findMany({
      where: {
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { employeeCode: { contains: search, mode: 'insensitive' } },
            { position: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ] as any,
        }),
      },
      skip,
      take,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: orderBy || { employeeCode: 'asc' },
    });
  }

  /**
   * Conta dipendenti
   */
  async count(options: {
    role?: string;
    isActive?: boolean;
  }) {
    const { isActive } = options;

    return await prisma.employee.count({
      where: {
        ...(isActive !== undefined && { isActive }),
      },
    });
  }

  /**
   * Crea dipendente
   */
  async create(data: any) {
    return await prisma.employee.create({
      data,
    });
  }

  /**
   * Aggiorna dipendente
   */
  async update(id: string, data: any) {
    return await prisma.employee.update({
      where: { id },
      data,
    });
  }

  /**
   * Elimina dipendente (soft delete)
   */
  async delete(id: string) {
    return await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Time entries per dipendente
   */
  async getTimeEntries(
    employeeId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    return await prisma.timeEntry.findMany({
      where: {
        employeeId,
        ...(dateFrom || dateTo
          ? {
              clockIn: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
      },
      orderBy: {
        clockIn: 'desc',
      },
    });
  }

  /**
   * Trova time entry aperta
   */
  async findOpenTimeEntry(employeeId: string) {
    return await prisma.timeEntry.findFirst({
      where: {
        employeeId,
        clockOut: null,
      },
    });
  }

  /**
   * Richieste ferie per dipendente
   */
  async getLeaveRequests(employeeId: string, year?: number) {
    const startDate = year ? new Date(year, 0, 1) : undefined;
    const endDate = year ? new Date(year, 11, 31) : undefined;

    return await prisma.employeeLeave.findMany({
      where: {
        employeeId,
        ...(startDate && endDate
          ? {
              startDate: { gte: startDate },
              endDate: { lte: endDate },
            }
          : {}),
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Dipendenti per competenza (TODO: implement skills system)
   */
  async findBySkills(_skills: string[]) {
    // Employee doesn't have skills field in current schema
    // Return active employees for now
    return await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: true,
      },
    });
  }
}

export const employeeRepository = new EmployeeRepository();
export default employeeRepository;
