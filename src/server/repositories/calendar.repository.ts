// Imports
import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

// Types/Interfaces
interface FindAllParams {
  skip?: number;
  take?: number;
  where?: Prisma.CalendarEventWhereInput;
  orderBy?: Prisma.CalendarEventOrderByWithRelationInput;
}

/**
 * Calendar Repository
 * Gestione accesso dati eventi calendario
 */
class CalendarRepository {
  /**
   * Trova tutti gli eventi con filtri
   */
  async findAll(params: FindAllParams) {
    const { skip = 0, take = 100, where, orderBy } = params;

    const [items, total] = await Promise.all([
      prisma.calendarEvent.findMany({
        skip,
        take,
        where,
        orderBy: orderBy || { startDate: 'asc' },
      }),
      prisma.calendarEvent.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Trova evento per ID
   */
  async findById(id: string) {
    return prisma.calendarEvent.findUnique({
      where: { id },
    });
  }

  /**
   * Trova eventi per range di date
   */
  async findByDateRange(startDate: Date, endDate: Date, eventType?: string) {
    return prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: startDate,
          lte: endDate,
        },
        ...(eventType && { eventType }),
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Trova eventi futuri con reminder
   */
  async findUpcomingWithReminder(minutesBefore: number) {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + minutesBefore * 60000);

    return prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: now,
          lte: reminderTime,
        },
        reminderMinutes: { not: null },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Trova eventi per tipo
   */
  async findByType(eventType: string, limit = 50) {
    return prisma.calendarEvent.findMany({
      where: { eventType },
      orderBy: { startDate: 'desc' },
      take: limit,
    });
  }

  /**
   * Trova eventi collegati a entità specifiche
   */
  async findByRelatedId(relatedId: string) {
    return prisma.calendarEvent.findMany({
      where: { relatedId },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Crea nuovo evento
   */
  async create(data: Prisma.CalendarEventCreateInput) {
    return prisma.calendarEvent.create({
      data,
    });
  }

  /**
   * Crea evento da scadenza fattura
   */
  async createFromInvoice(invoiceId: string, dueDate: Date, invoiceNumber: string) {
    return prisma.calendarEvent.create({
      data: {
        title: `Scadenza Fattura ${invoiceNumber}`,
        description: `Pagamento fattura ${invoiceNumber}`,
        eventType: 'payment',
        startDate: dueDate,
        allDay: true,
        relatedId: invoiceId,
        reminderMinutes: 1440, // 1 giorno prima
      },
    });
  }

  /**
   * Crea evento da task
   */
  async createFromTask(taskId: string, dueDate: Date, taskTitle: string) {
    return prisma.calendarEvent.create({
      data: {
        title: `Task: ${taskTitle}`,
        description: taskTitle,
        eventType: 'reminder',
        startDate: dueDate,
        allDay: false,
        relatedId: taskId,
        reminderMinutes: 60, // 1 ora prima
      },
    });
  }

  /**
   * Aggiorna evento
   */
  async update(id: string, data: Prisma.CalendarEventUpdateInput) {
    return prisma.calendarEvent.update({
      where: { id },
      data,
    });
  }

  /**
   * Elimina evento
   */
  async delete(id: string) {
    return prisma.calendarEvent.delete({
      where: { id },
    });
  }

  /**
   * Elimina eventi collegati a entità
   */
  async deleteByRelatedId(relatedId: string) {
    return prisma.calendarEvent.deleteMany({
      where: { relatedId },
    });
  }

  /**
   * Ottieni eventi del giorno
   */
  async getTodayEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Ottieni eventi del mese
   */
  async getMonthEvents(year: number, month: number) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    return prisma.calendarEvent.findMany({
      where: {
        startDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Conta eventi per tipo
   */
  async countByType() {
    return prisma.calendarEvent.groupBy({
      by: ['eventType'],
      _count: true,
    });
  }
}

// Main logic & Exports
export default new CalendarRepository();
