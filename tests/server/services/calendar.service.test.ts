// Mock logger (default export)
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@server/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Mock calendar repository
const mockCalendarRepository = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getTodayEvents: jest.fn(),
  getMonthEvents: jest.fn(),
  createFromInvoice: jest.fn(),
  createFromTask: jest.fn(),
  findUpcomingWithReminder: jest.fn(),
  findByDateRange: jest.fn(),
  countByType: jest.fn(),
};

jest.mock('@server/repositories/calendar.repository', () => ({
  __esModule: true,
  default: mockCalendarRepository,
}));

// Import after mocks
import calendarService from '@server/services/calendar.service';

describe('Calendar Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // LIST EVENTS
  // =============================================
  describe('listEvents', () => {
    it('should return paginated events', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Event 1', startDate: new Date('2026-02-15') },
        { id: 'event-2', title: 'Event 2', startDate: new Date('2026-02-16') },
      ];
      mockCalendarRepository.findAll.mockResolvedValue({
        items: mockEvents,
        total: 2,
      });

      const result = await calendarService.listEvents({ page: 1, limit: 10 });

      expect(result).toEqual({
        items: mockEvents,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockCalendarRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: {},
        orderBy: { startDate: 'asc' },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Listed 2 calendar events');
    });

    it('should filter by date range', async () => {
      mockCalendarRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-28');

      await calendarService.listEvents({ startDate, endDate });

      expect(mockCalendarRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            startDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it('should filter by event type', async () => {
      mockCalendarRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await calendarService.listEvents({ eventType: 'payment' });

      expect(mockCalendarRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventType: 'payment' },
        })
      );
    });

    it('should use default pagination values', async () => {
      mockCalendarRepository.findAll.mockResolvedValue({ items: [], total: 0 });

      await calendarService.listEvents({});

      expect(mockCalendarRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 100,
        })
      );
    });
  });

  // =============================================
  // GET EVENT BY ID
  // =============================================
  describe('getEventById', () => {
    it('should return event when found', async () => {
      const mockEvent = { id: 'event-1', title: 'Test Event' };
      mockCalendarRepository.findById.mockResolvedValue(mockEvent);

      const result = await calendarService.getEventById('event-1');

      expect(result).toEqual(mockEvent);
      expect(mockCalendarRepository.findById).toHaveBeenCalledWith('event-1');
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved event: Test Event');
    });

    it('should throw error when event not found', async () => {
      mockCalendarRepository.findById.mockResolvedValue(null);

      await expect(calendarService.getEventById('nonexistent')).rejects.toThrow(
        'Evento non trovato'
      );
    });
  });

  // =============================================
  // CREATE EVENT
  // =============================================
  describe('createEvent', () => {
    it('should create event with all fields', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'New Event',
        eventType: 'reminder',
        startDate: new Date('2026-02-15T10:00:00Z'),
        endDate: new Date('2026-02-15T11:00:00Z'),
        allDay: false,
        location: 'Meeting Room',
        description: 'Test description',
        relatedId: 'task-123',
        reminderMinutes: 30,
      };
      mockCalendarRepository.create.mockResolvedValue(mockEvent);

      const result = await calendarService.createEvent({
        title: 'New Event',
        eventType: 'reminder',
        startDate: new Date('2026-02-15T10:00:00Z'),
        endDate: new Date('2026-02-15T11:00:00Z'),
        allDay: false,
        location: 'Meeting Room',
        description: 'Test description',
        relatedId: 'task-123',
        reminderMinutes: 30,
      });

      expect(result).toEqual(mockEvent);
      expect(mockCalendarRepository.create).toHaveBeenCalledWith({
        title: 'New Event',
        eventType: 'reminder',
        startDate: new Date('2026-02-15T10:00:00Z'),
        endDate: new Date('2026-02-15T11:00:00Z'),
        allDay: false,
        location: 'Meeting Room',
        description: 'Test description',
        relatedId: 'task-123',
        reminderMinutes: 30,
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Created calendar event: New Event');
    });

    it('should create event with minimal fields', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Simple Event',
        eventType: 'meeting',
        startDate: new Date('2026-02-15'),
        allDay: false,
      };
      mockCalendarRepository.create.mockResolvedValue(mockEvent);

      const result = await calendarService.createEvent({
        title: 'Simple Event',
        eventType: 'meeting',
        startDate: new Date('2026-02-15'),
      });

      expect(result).toEqual(mockEvent);
      expect(mockCalendarRepository.create).toHaveBeenCalledWith({
        title: 'Simple Event',
        eventType: 'meeting',
        startDate: new Date('2026-02-15'),
        description: undefined,
        endDate: undefined,
        allDay: false,
        location: undefined,
        relatedId: undefined,
        reminderMinutes: undefined,
      });
    });
  });

  // =============================================
  // UPDATE EVENT
  // =============================================
  describe('updateEvent', () => {
    it('should update event successfully', async () => {
      const existingEvent = { id: 'event-1', title: 'Old Title' };
      const updatedEvent = { id: 'event-1', title: 'New Title' };
      mockCalendarRepository.findById.mockResolvedValue(existingEvent);
      mockCalendarRepository.update.mockResolvedValue(updatedEvent);

      const result = await calendarService.updateEvent('event-1', { title: 'New Title' });

      expect(result).toEqual(updatedEvent);
      expect(mockCalendarRepository.update).toHaveBeenCalledWith('event-1', { title: 'New Title' });
      expect(mockLogger.info).toHaveBeenCalledWith('Updated calendar event: New Title');
    });

    it('should throw error when event not found', async () => {
      mockCalendarRepository.findById.mockResolvedValue(null);

      await expect(
        calendarService.updateEvent('nonexistent', { title: 'Test' })
      ).rejects.toThrow('Evento non trovato');

      expect(mockCalendarRepository.update).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // DELETE EVENT
  // =============================================
  describe('deleteEvent', () => {
    it('should delete event successfully', async () => {
      const existingEvent = { id: 'event-1', title: 'Test Event' };
      mockCalendarRepository.findById.mockResolvedValue(existingEvent);
      mockCalendarRepository.delete.mockResolvedValue(undefined);

      const result = await calendarService.deleteEvent('event-1');

      expect(result).toEqual({ success: true });
      expect(mockCalendarRepository.delete).toHaveBeenCalledWith('event-1');
      expect(mockLogger.info).toHaveBeenCalledWith('Deleted calendar event: Test Event');
    });

    it('should throw error when event not found', async () => {
      mockCalendarRepository.findById.mockResolvedValue(null);

      await expect(calendarService.deleteEvent('nonexistent')).rejects.toThrow(
        'Evento non trovato'
      );

      expect(mockCalendarRepository.delete).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // GET TODAY EVENTS
  // =============================================
  describe('getTodayEvents', () => {
    it('should return today events', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Morning Meeting' },
        { id: 'event-2', title: 'Afternoon Review' },
      ];
      mockCalendarRepository.getTodayEvents.mockResolvedValue(mockEvents);

      const result = await calendarService.getTodayEvents();

      expect(result).toEqual(mockEvents);
      expect(mockCalendarRepository.getTodayEvents).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved 2 events for today');
    });
  });

  // =============================================
  // GET MONTH EVENTS
  // =============================================
  describe('getMonthEvents', () => {
    it('should return events for specified month', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Event 1' },
        { id: 'event-2', title: 'Event 2' },
        { id: 'event-3', title: 'Event 3' },
      ];
      mockCalendarRepository.getMonthEvents.mockResolvedValue(mockEvents);

      const result = await calendarService.getMonthEvents(2026, 2);

      expect(result).toEqual(mockEvents);
      expect(mockCalendarRepository.getMonthEvents).toHaveBeenCalledWith(2026, 2);
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved 3 events for 2026-2');
    });
  });

  // =============================================
  // CREATE INVOICE EVENT
  // =============================================
  describe('createInvoiceEvent', () => {
    it('should create event from invoice', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Scadenza Fattura FT-2026/001',
        eventType: 'payment',
        relatedId: 'invoice-123',
      };
      mockCalendarRepository.createFromInvoice.mockResolvedValue(mockEvent);

      const result = await calendarService.createInvoiceEvent(
        'invoice-123',
        new Date('2026-03-15'),
        'FT-2026/001'
      );

      expect(result).toEqual(mockEvent);
      expect(mockCalendarRepository.createFromInvoice).toHaveBeenCalledWith(
        'invoice-123',
        new Date('2026-03-15'),
        'FT-2026/001'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Created invoice event for FT-2026/001');
    });
  });

  // =============================================
  // CREATE TASK EVENT
  // =============================================
  describe('createTaskEvent', () => {
    it('should create event from task', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Prepare Report',
        eventType: 'reminder',
        relatedId: 'task-123',
      };
      mockCalendarRepository.createFromTask.mockResolvedValue(mockEvent);

      const result = await calendarService.createTaskEvent(
        'task-123',
        new Date('2026-02-28'),
        'Prepare Report'
      );

      expect(result).toEqual(mockEvent);
      expect(mockCalendarRepository.createFromTask).toHaveBeenCalledWith(
        'task-123',
        new Date('2026-02-28'),
        'Prepare Report'
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Created task event for Prepare Report');
    });
  });

  // =============================================
  // GET UPCOMING REMINDERS
  // =============================================
  describe('getUpcomingReminders', () => {
    it('should return reminders with default 15 minutes', async () => {
      const mockEvents = [{ id: 'event-1', title: 'Upcoming Meeting' }];
      mockCalendarRepository.findUpcomingWithReminder.mockResolvedValue(mockEvents);

      const result = await calendarService.getUpcomingReminders();

      expect(result).toEqual(mockEvents);
      expect(mockCalendarRepository.findUpcomingWithReminder).toHaveBeenCalledWith(15);
      expect(mockLogger.debug).toHaveBeenCalledWith('Found 1 upcoming reminders');
    });

    it('should return reminders with custom minutes', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Event 1' },
        { id: 'event-2', title: 'Event 2' },
      ];
      mockCalendarRepository.findUpcomingWithReminder.mockResolvedValue(mockEvents);

      const result = await calendarService.getUpcomingReminders(30);

      expect(result).toEqual(mockEvents);
      expect(mockCalendarRepository.findUpcomingWithReminder).toHaveBeenCalledWith(30);
      expect(mockLogger.debug).toHaveBeenCalledWith('Found 2 upcoming reminders');
    });
  });

  // =============================================
  // SYNC INVOICE EVENTS
  // =============================================
  describe('syncInvoiceEvents', () => {
    it('should return success (placeholder implementation)', async () => {
      const result = await calendarService.syncInvoiceEvents();

      expect(result).toEqual({ success: true });
      expect(mockLogger.info).toHaveBeenCalledWith('Syncing invoice events...');
    });
  });

  // =============================================
  // SYNC TASK EVENTS
  // =============================================
  describe('syncTaskEvents', () => {
    it('should return success (placeholder implementation)', async () => {
      const result = await calendarService.syncTaskEvents();

      expect(result).toEqual({ success: true });
      expect(mockLogger.info).toHaveBeenCalledWith('Syncing task events...');
    });
  });

  // =============================================
  // GET EVENT STATISTICS
  // =============================================
  describe('getEventStatistics', () => {
    it('should return today/upcoming/reminders plus byType', async () => {
      mockCalendarRepository.countByType.mockResolvedValue([
        { eventType: 'meeting', _count: 10 },
        { eventType: 'payment', _count: 5 },
        { eventType: 'reminder', _count: 15 },
      ]);
      mockCalendarRepository.getTodayEvents.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      mockCalendarRepository.findByDateRange.mockResolvedValue([
        { id: 'a', reminderMinutes: 30 },
        { id: 'b', reminderMinutes: null },
        { id: 'c', reminderMinutes: 15 },
      ]);

      const result = await calendarService.getEventStatistics();

      expect(result).toEqual({
        today: 2,
        upcoming: 3,
        reminders: 2, // solo quelli con reminderMinutes valorizzato
        byType: { meeting: 10, payment: 5, reminder: 15 },
      });
      expect(mockCalendarRepository.countByType).toHaveBeenCalled();
    });

    it('should handle empty statistics (no NaN)', async () => {
      mockCalendarRepository.countByType.mockResolvedValue([]);
      mockCalendarRepository.getTodayEvents.mockResolvedValue([]);
      mockCalendarRepository.findByDateRange.mockResolvedValue([]);

      const result = await calendarService.getEventStatistics();

      expect(result).toEqual({ today: 0, upcoming: 0, reminders: 0, byType: {} });
    });
  });
});
