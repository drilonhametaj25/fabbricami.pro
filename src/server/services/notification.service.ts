// Imports
import notificationRepository from '../repositories/notification.repository';
import logger from '../config/logger';
import { NotificationType, UserRole } from '@prisma/client';

// Types/Interfaces
interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

interface NotifyMultipleInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

interface NotifyRolesInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Notification Service
 * Business logic per gestione notifiche utenti
 */
class NotificationService {
  /**
   * Lista notifiche utente
   */
  async getUserNotifications(userId: string, includeRead = false) {
    const notifications = await notificationRepository.findByUserId(userId, includeRead);

    logger.debug(`Retrieved ${notifications.length} notifications for user ${userId}`);

    return notifications;
  }

  /**
   * Conta notifiche non lette
   */
  async getUnreadCount(userId: string) {
    return notificationRepository.countUnreadByUserId(userId);
  }

  /**
   * Crea notifica per singolo utente
   */
  async createNotification(data: CreateNotificationInput) {
    const notification = await notificationRepository.create({
      user: { connect: { id: data.userId } },
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    });

    logger.info(`Created notification for user ${data.userId}: ${data.title}`);

    // TODO: Invia notifica real-time via WebSocket

    return notification;
  }

  /**
   * Crea notifica per più utenti
   */
  async notifyMultipleUsers(data: NotifyMultipleInput) {
    const notifications = data.userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    }));

    await notificationRepository.createMany(notifications);

    logger.info(`Created ${notifications.length} notifications: ${data.title}`);

    // TODO: Invia notifiche real-time via WebSocket

    return { count: notifications.length };
  }

  /**
   * Crea notifica per ruoli specifici
   */
  async notifyRoles(roles: UserRole[], data: NotifyRolesInput) {
    await notificationRepository.createForRoles(roles, {
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
    });

    logger.info(`Created notifications for roles ${roles.join(', ')}: ${data.title}`);

    // TODO: Invia notifiche real-time via WebSocket

    return { success: true };
  }

  /**
   * Segna notifica come letta
   */
  async markAsRead(notificationId: string) {
    const notification = await notificationRepository.markAsRead(notificationId);

    logger.debug(`Marked notification ${notificationId} as read`);

    return notification;
  }

  /**
   * Segna tutte le notifiche utente come lette
   */
  async markAllAsRead(userId: string) {
    const result = await notificationRepository.markAllAsReadByUserId(userId);

    logger.info(`Marked all notifications as read for user ${userId}`);

    return result;
  }

  /**
   * Elimina notifica
   */
  async deleteNotification(notificationId: string) {
    await notificationRepository.delete(notificationId);

    logger.info(`Deleted notification ${notificationId}`);

    return { success: true };
  }

  /**
   * Cleanup notifiche vecchie
   */
  async cleanupOldNotifications(daysOld: number = 30) {
    const result = await notificationRepository.deleteOldNotifications(daysOld);

    logger.info(`Cleaned up ${result.count} old notifications (older than ${daysOld} days)`);

    return result;
  }

  /**
   * Notifica scorta minima prodotto
   */
  async notifyLowStock(productId: string, productName: string, currentStock: number, minStock: number) {
    await this.notifyRoles(['MAGAZZINIERE', 'ADMIN', 'MANAGER'], {
      type: 'LOW_STOCK',
      title: 'Scorta Minima Raggiunta',
      message: `Il prodotto "${productName}" ha raggiunto la scorta minima. Disponibilità: ${currentStock}, Minimo: ${minStock}`,
      link: `/products/${productId}`,
    });
  }

  /**
   * Notifica nuovo task assegnato
   */
  async notifyTaskAssigned(userId: string, taskId: string, taskTitle: string) {
    await this.createNotification({
      userId,
      type: 'TASK_ASSIGNED',
      title: 'Nuovo Task Assegnato',
      message: `Ti è stato assegnato il task: ${taskTitle}`,
      link: `/tasks/${taskId}`,
    });
  }

  /**
   * Notifica task scaduto
   */
  async notifyTaskOverdue(userId: string, taskId: string, taskTitle: string) {
    await this.createNotification({
      userId,
      type: 'TASK_OVERDUE',
      title: 'Task Scaduto',
      message: `Il task "${taskTitle}" è scaduto`,
      link: `/tasks/${taskId}`,
    });
  }

  /**
   * Notifica pagamento in scadenza
   */
  async notifyPaymentDue(invoiceId: string, invoiceNumber: string, amount: number, dueDate: Date) {
    await this.notifyRoles(['CONTABILE', 'ADMIN'], {
      type: 'PAYMENT_DUE',
      title: 'Pagamento in Scadenza',
      message: `La fattura ${invoiceNumber} (€${amount}) scade il ${dueDate.toLocaleDateString('it-IT')}`,
      link: `/invoices/${invoiceId}`,
    });
  }

  /**
   * Notifica pagamento scaduto
   */
  async notifyPaymentOverdue(invoiceId: string, invoiceNumber: string, amount: number) {
    await this.notifyRoles(['CONTABILE', 'ADMIN'], {
      type: 'PAYMENT_OVERDUE',
      title: 'Pagamento Scaduto',
      message: `La fattura ${invoiceNumber} (€${amount}) è scaduta`,
      link: `/invoices/${invoiceId}`,
    });
  }

  /**
   * Notifica nuovo ordine ricevuto
   */
  async notifyOrderReceived(orderId: string, orderNumber: string, customerName: string) {
    await this.notifyRoles(['COMMERCIALE', 'ADMIN', 'MANAGER'], {
      type: 'ORDER_RECEIVED',
      title: 'Nuovo Ordine Ricevuto',
      message: `Ricevuto ordine ${orderNumber} da ${customerName}`,
      link: `/orders/${orderId}`,
    });
  }

  /**
   * Ottieni statistiche notifiche utente
   */
  async getUserStats(userId: string) {
    return notificationRepository.getUserNotificationStats(userId);
  }
}

// Main logic & Exports
export default new NotificationService();
