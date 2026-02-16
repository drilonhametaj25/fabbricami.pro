// Mock logger
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

// Mock notification repository
const mockNotificationRepository = {
  findByUserId: jest.fn(),
  countUnreadByUserId: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  createForRoles: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsReadByUserId: jest.fn(),
  delete: jest.fn(),
  deleteOldNotifications: jest.fn(),
  getUserNotificationStats: jest.fn(),
};

jest.mock('@server/repositories/notification.repository', () => ({
  __esModule: true,
  default: mockNotificationRepository,
}));

// Import after mocks
import notificationService from '@server/services/notification.service';
import { NotificationType, UserRole } from '@prisma/client';

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // GET USER NOTIFICATIONS
  // =============================================
  describe('getUserNotifications', () => {
    it('should return all notifications for user when includeRead is true', async () => {
      const mockNotifications = [
        { id: 'notif-1', userId: 'user-1', title: 'Test 1', isRead: false },
        { id: 'notif-2', userId: 'user-1', title: 'Test 2', isRead: true },
      ];
      mockNotificationRepository.findByUserId.mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications('user-1', true);

      expect(result).toEqual(mockNotifications);
      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith('user-1', true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Retrieved 2 notifications for user user-1'
      );
    });

    it('should return only unread notifications when includeRead is false', async () => {
      const mockNotifications = [
        { id: 'notif-1', userId: 'user-1', title: 'Test 1', isRead: false },
      ];
      mockNotificationRepository.findByUserId.mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications('user-1', false);

      expect(result).toEqual(mockNotifications);
      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith('user-1', false);
    });

    it('should use default includeRead=false when not specified', async () => {
      mockNotificationRepository.findByUserId.mockResolvedValue([]);

      await notificationService.getUserNotifications('user-1');

      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith('user-1', false);
    });
  });

  // =============================================
  // GET UNREAD COUNT
  // =============================================
  describe('getUnreadCount', () => {
    it('should return the count of unread notifications', async () => {
      mockNotificationRepository.countUnreadByUserId.mockResolvedValue(5);

      const result = await notificationService.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(mockNotificationRepository.countUnreadByUserId).toHaveBeenCalledWith('user-1');
    });

    it('should return 0 when no unread notifications', async () => {
      mockNotificationRepository.countUnreadByUserId.mockResolvedValue(0);

      const result = await notificationService.getUnreadCount('user-1');

      expect(result).toBe(0);
    });
  });

  // =============================================
  // CREATE NOTIFICATION
  // =============================================
  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'SYSTEM' as NotificationType,
        title: 'Test Title',
        message: 'Test message',
        isRead: false,
      };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        userId: 'user-1',
        type: 'SYSTEM' as NotificationType,
        title: 'Test Title',
        message: 'Test message',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user: { connect: { id: 'user-1' } },
        type: 'SYSTEM',
        title: 'Test Title',
        message: 'Test message',
        link: undefined,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created notification for user user-1: Test Title'
      );
    });

    it('should create notification with optional link', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'SYSTEM' as NotificationType,
        title: 'Test Title',
        message: 'Test message',
        link: '/products/123',
        isRead: false,
      };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        userId: 'user-1',
        type: 'SYSTEM' as NotificationType,
        title: 'Test Title',
        message: 'Test message',
        link: '/products/123',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user: { connect: { id: 'user-1' } },
        type: 'SYSTEM',
        title: 'Test Title',
        message: 'Test message',
        link: '/products/123',
      });
    });
  });

  // =============================================
  // NOTIFY MULTIPLE USERS
  // =============================================
  describe('notifyMultipleUsers', () => {
    it('should create notifications for multiple users', async () => {
      mockNotificationRepository.createMany.mockResolvedValue({ count: 3 });

      const result = await notificationService.notifyMultipleUsers({
        userIds: ['user-1', 'user-2', 'user-3'],
        type: 'SYSTEM' as NotificationType,
        title: 'Broadcast',
        message: 'System notification',
      });

      expect(result).toEqual({ count: 3 });
      expect(mockNotificationRepository.createMany).toHaveBeenCalledWith([
        { userId: 'user-1', type: 'SYSTEM', title: 'Broadcast', message: 'System notification', link: undefined },
        { userId: 'user-2', type: 'SYSTEM', title: 'Broadcast', message: 'System notification', link: undefined },
        { userId: 'user-3', type: 'SYSTEM', title: 'Broadcast', message: 'System notification', link: undefined },
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created 3 notifications: Broadcast'
      );
    });

    it('should handle empty user list', async () => {
      mockNotificationRepository.createMany.mockResolvedValue({ count: 0 });

      const result = await notificationService.notifyMultipleUsers({
        userIds: [],
        type: 'SYSTEM' as NotificationType,
        title: 'Broadcast',
        message: 'System notification',
      });

      expect(result).toEqual({ count: 0 });
      expect(mockNotificationRepository.createMany).toHaveBeenCalledWith([]);
    });
  });

  // =============================================
  // NOTIFY ROLES
  // =============================================
  describe('notifyRoles', () => {
    it('should create notifications for single role', async () => {
      mockNotificationRepository.createForRoles.mockResolvedValue({ count: 5 });

      const result = await notificationService.notifyRoles(['ADMIN' as UserRole], {
        type: 'SYSTEM' as NotificationType,
        title: 'Admin Notice',
        message: 'Admin only notification',
      });

      expect(result).toEqual({ success: true });
      expect(mockNotificationRepository.createForRoles).toHaveBeenCalledWith(['ADMIN'], {
        type: 'SYSTEM',
        title: 'Admin Notice',
        message: 'Admin only notification',
        link: undefined,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created notifications for roles ADMIN: Admin Notice'
      );
    });

    it('should create notifications for multiple roles', async () => {
      mockNotificationRepository.createForRoles.mockResolvedValue({ count: 10 });

      const result = await notificationService.notifyRoles(
        ['ADMIN' as UserRole, 'MANAGER' as UserRole, 'COMMERCIALE' as UserRole],
        {
          type: 'ORDER_RECEIVED' as NotificationType,
          title: 'New Order',
          message: 'A new order has been received',
          link: '/orders/123',
        }
      );

      expect(result).toEqual({ success: true });
      expect(mockNotificationRepository.createForRoles).toHaveBeenCalledWith(
        ['ADMIN', 'MANAGER', 'COMMERCIALE'],
        {
          type: 'ORDER_RECEIVED',
          title: 'New Order',
          message: 'A new order has been received',
          link: '/orders/123',
        }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created notifications for roles ADMIN, MANAGER, COMMERCIALE: New Order'
      );
    });
  });

  // =============================================
  // MARK AS READ
  // =============================================
  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notif-1',
        isRead: true,
        readAt: new Date(),
      };
      mockNotificationRepository.markAsRead.mockResolvedValue(mockNotification);

      const result = await notificationService.markAsRead('notif-1');

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith('notif-1');
      expect(mockLogger.debug).toHaveBeenCalledWith('Marked notification notif-1 as read');
    });
  });

  // =============================================
  // MARK ALL AS READ
  // =============================================
  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      const batchResult = { count: 5 };
      mockNotificationRepository.markAllAsReadByUserId.mockResolvedValue(batchResult);

      const result = await notificationService.markAllAsRead('user-1');

      expect(result).toEqual(batchResult);
      expect(mockNotificationRepository.markAllAsReadByUserId).toHaveBeenCalledWith('user-1');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Marked all notifications as read for user user-1'
      );
    });
  });

  // =============================================
  // DELETE NOTIFICATION
  // =============================================
  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockNotificationRepository.delete.mockResolvedValue({ id: 'notif-1' });

      const result = await notificationService.deleteNotification('notif-1');

      expect(result).toEqual({ success: true });
      expect(mockNotificationRepository.delete).toHaveBeenCalledWith('notif-1');
      expect(mockLogger.info).toHaveBeenCalledWith('Deleted notification notif-1');
    });
  });

  // =============================================
  // CLEANUP OLD NOTIFICATIONS
  // =============================================
  describe('cleanupOldNotifications', () => {
    it('should cleanup notifications older than default 30 days', async () => {
      mockNotificationRepository.deleteOldNotifications.mockResolvedValue({ count: 50 });

      const result = await notificationService.cleanupOldNotifications();

      expect(result).toEqual({ count: 50 });
      expect(mockNotificationRepository.deleteOldNotifications).toHaveBeenCalledWith(30);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up 50 old notifications (older than 30 days)'
      );
    });

    it('should cleanup notifications older than custom days', async () => {
      mockNotificationRepository.deleteOldNotifications.mockResolvedValue({ count: 100 });

      const result = await notificationService.cleanupOldNotifications(60);

      expect(result).toEqual({ count: 100 });
      expect(mockNotificationRepository.deleteOldNotifications).toHaveBeenCalledWith(60);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleaned up 100 old notifications (older than 60 days)'
      );
    });
  });

  // =============================================
  // CONVENIENCE NOTIFICATION METHODS
  // =============================================
  describe('notifyLowStock', () => {
    it('should notify warehouse and admin roles about low stock', async () => {
      mockNotificationRepository.createForRoles.mockResolvedValue({ count: 5 });

      await notificationService.notifyLowStock('prod-1', 'Widget Pro', 5, 10);

      expect(mockNotificationRepository.createForRoles).toHaveBeenCalledWith(
        ['MAGAZZINIERE', 'ADMIN', 'MANAGER'],
        {
          type: 'LOW_STOCK',
          title: 'Scorta Minima Raggiunta',
          message: 'Il prodotto "Widget Pro" ha raggiunto la scorta minima. Disponibilità: 5, Minimo: 10',
          link: '/products/prod-1',
        }
      );
    });
  });

  describe('notifyTaskAssigned', () => {
    it('should create notification for assigned user', async () => {
      const mockNotification = { id: 'notif-1' };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);

      await notificationService.notifyTaskAssigned('user-1', 'task-1', 'Prepare Report');

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user: { connect: { id: 'user-1' } },
        type: 'TASK_ASSIGNED',
        title: 'Nuovo Task Assegnato',
        message: 'Ti è stato assegnato il task: Prepare Report',
        link: '/tasks/task-1',
      });
    });
  });

  describe('notifyTaskOverdue', () => {
    it('should create notification for overdue task', async () => {
      const mockNotification = { id: 'notif-1' };
      mockNotificationRepository.create.mockResolvedValue(mockNotification);

      await notificationService.notifyTaskOverdue('user-1', 'task-1', 'Urgent Task');

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user: { connect: { id: 'user-1' } },
        type: 'TASK_OVERDUE',
        title: 'Task Scaduto',
        message: 'Il task "Urgent Task" è scaduto',
        link: '/tasks/task-1',
      });
    });
  });

  describe('notifyPaymentDue', () => {
    it('should notify accountant roles about payment due', async () => {
      mockNotificationRepository.createForRoles.mockResolvedValue({ count: 2 });
      const dueDate = new Date('2026-03-15');

      await notificationService.notifyPaymentDue('inv-1', 'FT-2026/001', 1500, dueDate);

      expect(mockNotificationRepository.createForRoles).toHaveBeenCalledWith(
        ['CONTABILE', 'ADMIN'],
        {
          type: 'PAYMENT_DUE',
          title: 'Pagamento in Scadenza',
          message: expect.stringContaining('FT-2026/001 (€1500)'),
          link: '/invoices/inv-1',
        }
      );
    });
  });

  describe('notifyPaymentOverdue', () => {
    it('should notify accountant roles about overdue payment', async () => {
      mockNotificationRepository.createForRoles.mockResolvedValue({ count: 2 });

      await notificationService.notifyPaymentOverdue('inv-1', 'FT-2026/001', 1500);

      expect(mockNotificationRepository.createForRoles).toHaveBeenCalledWith(
        ['CONTABILE', 'ADMIN'],
        {
          type: 'PAYMENT_OVERDUE',
          title: 'Pagamento Scaduto',
          message: 'La fattura FT-2026/001 (€1500) è scaduta',
          link: '/invoices/inv-1',
        }
      );
    });
  });

  describe('notifyOrderReceived', () => {
    it('should notify sales roles about new order', async () => {
      mockNotificationRepository.createForRoles.mockResolvedValue({ count: 5 });

      await notificationService.notifyOrderReceived('order-1', 'ORD-2026/001', 'Acme Corp');

      expect(mockNotificationRepository.createForRoles).toHaveBeenCalledWith(
        ['COMMERCIALE', 'ADMIN', 'MANAGER'],
        {
          type: 'ORDER_RECEIVED',
          title: 'Nuovo Ordine Ricevuto',
          message: 'Ricevuto ordine ORD-2026/001 da Acme Corp',
          link: '/orders/order-1',
        }
      );
    });
  });

  // =============================================
  // GET USER STATS
  // =============================================
  describe('getUserStats', () => {
    it('should return user notification statistics', async () => {
      const mockStats = {
        total: 50,
        unread: 10,
        byType: {
          SYSTEM: 20,
          ORDER_RECEIVED: 15,
          LOW_STOCK: 10,
          TASK_ASSIGNED: 5,
        },
      };
      mockNotificationRepository.getUserNotificationStats.mockResolvedValue(mockStats);

      const result = await notificationService.getUserStats('user-1');

      expect(result).toEqual(mockStats);
      expect(mockNotificationRepository.getUserNotificationStats).toHaveBeenCalledWith('user-1');
    });
  });
});
