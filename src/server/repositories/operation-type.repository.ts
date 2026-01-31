import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export class OperationTypeRepository {
  /**
   * Find operation type by ID
   */
  async findById(id: string) {
    return prisma.operationType.findUnique({
      where: { id },
    });
  }

  /**
   * Find operation type by code
   */
  async findByCode(code: string) {
    return prisma.operationType.findUnique({
      where: { code },
    });
  }

  /**
   * Find all operation types
   */
  async findAll(includeInactive = false) {
    return prisma.operationType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create operation type
   */
  async create(data: Prisma.OperationTypeCreateInput) {
    return prisma.operationType.create({
      data,
    });
  }

  /**
   * Update operation type
   */
  async update(id: string, data: Prisma.OperationTypeUpdateInput) {
    return prisma.operationType.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete operation type (soft delete)
   */
  async delete(id: string) {
    return prisma.operationType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Check if operation type is used in any manufacturing phase
   */
  async isUsedInPhases(id: string): Promise<boolean> {
    const count = await prisma.manufacturingPhase.count({
      where: { operationTypeId: id },
    });
    return count > 0;
  }

  /**
   * Get next sort order
   */
  async getNextSortOrder(): Promise<number> {
    const maxOrder = await prisma.operationType.aggregate({
      _max: { sortOrder: true },
    });
    return (maxOrder._max.sortOrder || 0) + 1;
  }

  /**
   * Reorder operation types
   */
  async reorder(orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      prisma.operationType.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    );
    return prisma.$transaction(updates);
  }

  /**
   * Get qualified employees for operation type
   */
  async getQualifiedEmployees(operationTypeId: string) {
    return prisma.operationTypeEmployee.findMany({
      where: { operationTypeId },
      include: {
        employee: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { certifiedAt: 'asc' },
      ],
    });
  }

  /**
   * Add qualified employee to operation type
   */
  async addQualifiedEmployee(
    operationTypeId: string,
    employeeId: string,
    isPrimary: boolean = false
  ) {
    return prisma.operationTypeEmployee.create({
      data: {
        operationTypeId,
        employeeId,
        isPrimary,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Remove qualified employee from operation type
   */
  async removeQualifiedEmployee(operationTypeId: string, employeeId: string) {
    return prisma.operationTypeEmployee.delete({
      where: {
        operationTypeId_employeeId: {
          operationTypeId,
          employeeId,
        },
      },
    });
  }

  /**
   * Update qualified employee (e.g., set as primary)
   */
  async updateQualifiedEmployee(
    operationTypeId: string,
    employeeId: string,
    data: { isPrimary?: boolean }
  ) {
    return prisma.operationTypeEmployee.update({
      where: {
        operationTypeId_employeeId: {
          operationTypeId,
          employeeId,
        },
      },
      data,
    });
  }

  /**
   * Calculate average hourly rate from qualified employees
   */
  async calculateAverageHourlyRate(operationTypeId: string): Promise<number | null> {
    const qualifiedEmployees = await prisma.operationTypeEmployee.findMany({
      where: { operationTypeId },
      include: {
        employee: {
          select: {
            hourlyRate: true,
          },
        },
      },
    });

    if (qualifiedEmployees.length === 0) {
      // Fallback to defaultHourlyRate
      const operationType = await prisma.operationType.findUnique({
        where: { id: operationTypeId },
        select: { defaultHourlyRate: true },
      });
      return operationType?.defaultHourlyRate ? Number(operationType.defaultHourlyRate) : null;
    }

    const rates = qualifiedEmployees
      .map((qe) => Number(qe.employee.hourlyRate))
      .filter((rate) => rate > 0);

    if (rates.length === 0) {
      return null;
    }

    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  }

  /**
   * Check if employee is already qualified for operation type
   */
  async isEmployeeQualified(operationTypeId: string, employeeId: string): Promise<boolean> {
    const existing = await prisma.operationTypeEmployee.findUnique({
      where: {
        operationTypeId_employeeId: {
          operationTypeId,
          employeeId,
        },
      },
    });
    return !!existing;
  }
}

export default new OperationTypeRepository();
