// Imports
import calendarRepository from '../repositories/calendar.repository';
import logger from '../config/logger';

// Types/Interfaces
interface CreateEventInput {
  title: string;
  description?: string;
  eventType: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  relatedId?: string;
  reminderMinutes?: number;
}

interface UpdateEventInput {
  title?: string;
  description?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  reminderMinutes?: number;
}

interface ListEventsQuery {
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  page?: number;
  limit?: number;
}

/**
 * Calendar Service
 * Business logic per gestione eventi calendario
 */
class CalendarService {
  /**
   * Lista eventi con filtri
   */
  async listEvents(query: ListEventsQuery) {
    const { startDate, endDate, eventType, page = 1, limit = 100 } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (startDate && endDate) {
      where.startDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (eventType) {
      where.eventType = eventType;
    }

    const result = await calendarRepository.findAll({
      skip,
      take: limit,
      where,
      orderBy: { startDate: 'asc' },
    });

    logger.info(`Listed ${result.items.length} calendar events`);

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Ottieni evento per ID
   */
  async getEventById(id: string) {
    const event = await calendarRepository.findById(id);

    if (!event) {
      throw new Error('Evento non trovato');
    }

    logger.debug(`Retrieved event: ${event.title}`);

    return event;
  }

  /**
   * Crea nuovo evento
   */
  async createEvent(data: CreateEventInput) {
    const event = await calendarRepository.create({
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      startDate: data.startDate,
      endDate: data.endDate,
      allDay: data.allDay || false,
      location: data.location,
      relatedId: data.relatedId,
      reminderMinutes: data.reminderMinutes,
    });

    logger.info(`Created calendar event: ${event.title}`);

    return event;
  }

  /**
   * Aggiorna evento
   */
  async updateEvent(id: string, data: UpdateEventInput) {
    const existing = await calendarRepository.findById(id);
    if (!existing) {
      throw new Error('Evento non trovato');
    }

    const event = await calendarRepository.update(id, data);

    logger.info(`Updated calendar event: ${event.title}`);

    return event;
  }

  /**
   * Elimina evento
   */
  async deleteEvent(id: string) {
    const existing = await calendarRepository.findById(id);
    if (!existing) {
      throw new Error('Evento non trovato');
    }

    await calendarRepository.delete(id);

    logger.info(`Deleted calendar event: ${existing.title}`);

    return { success: true };
  }

  /**
   * Ottieni eventi del giorno
   */
  async getTodayEvents() {
    const events = await calendarRepository.getTodayEvents();

    logger.debug(`Retrieved ${events.length} events for today`);

    return events;
  }

  /**
   * Ottieni eventi del mese
   */
  async getMonthEvents(year: number, month: number) {
    const events = await calendarRepository.getMonthEvents(year, month);

    logger.debug(`Retrieved ${events.length} events for ${year}-${month}`);

    return events;
  }

  /**
   * Crea evento da fattura
   */
  async createInvoiceEvent(invoiceId: string, dueDate: Date, invoiceNumber: string) {
    const event = await calendarRepository.createFromInvoice(invoiceId, dueDate, invoiceNumber);

    logger.info(`Created invoice event for ${invoiceNumber}`);

    return event;
  }

  /**
   * Crea evento da task
   */
  async createTaskEvent(taskId: string, dueDate: Date, taskTitle: string) {
    const event = await calendarRepository.createFromTask(taskId, dueDate, taskTitle);

    logger.info(`Created task event for ${taskTitle}`);

    return event;
  }

  /**
   * Ottieni eventi con reminder imminente
   */
  async getUpcomingReminders(minutesBefore: number = 15) {
    const events = await calendarRepository.findUpcomingWithReminder(minutesBefore);

    logger.debug(`Found ${events.length} upcoming reminders`);

    return events;
  }

  /**
   * Sincronizza eventi da fatture
   * Crea eventi calendario per tutte le scadenze fatture
   */
  async syncInvoiceEvents() {
    // TODO: Implementare sincronizzazione con fatture
    logger.info('Syncing invoice events...');
    return { success: true };
  }

  /**
   * Sincronizza eventi da task
   * Crea eventi calendario per tutti i task con scadenza
   */
  async syncTaskEvents() {
    // TODO: Implementare sincronizzazione con task
    logger.info('Syncing task events...');
    return { success: true };
  }

  /**
   * Ottieni statistiche eventi per tipo
   */
  async getEventStatistics() {
    const byType = await calendarRepository.countByType();

    return {
      byType: byType.reduce((acc, item) => {
        acc[item.eventType] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// Main logic & Exports
export default new CalendarService();
