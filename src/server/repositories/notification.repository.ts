// Imports
import { prisma } from '../config/database';
import { Prisma, NotificationType, UserRole } from '@prisma/client';

// Types/Interfaces
interface FindAllParams {
  skip?: number;
  take?: number;
  where?: Prisma.NotificationWhereInput;
  orderBy?: Prisma.NotificationOrderByWithRelationInput;
}

/**
 * Notification Repository
 * Gestione accesso dati notifiche utente
 */
class NotificationRepository {
  /**
   * Trova tutte le notifiche con filtri
   */
  async findAll(params: FindAllParams) {
    const { skip = 0, take = 20, where, orderBy } = params;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        skip,
        take,
        where,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Trova notifica per ID
   */
  async findById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Trova notifiche per utente
   */
  async findByUserId(userId: string, includeRead = false) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(includeRead ? {} : { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Conta notifiche non lette per utente
   */
  async countUnreadByUserId(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Crea nuova notifica
   */
  async create(data: Prisma.NotificationCreateInput) {
    return prisma.notification.create({
      data,
    });
  }

  /**
   * Crea notifiche multiple per più utenti
   */
  async createMany(
    notifications: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      link?: string;
    }>
  ) {
    return prisma.notification.createMany({
      data: notifications,
    });
  }

  /**
   * Crea notifica per ruoli specifici
   */
  async createForRoles(
    roles: UserRole[],
    notificationData: {
      type: NotificationType;
      title: string;
      message: string;
      link?: string;
    }
  ) {
    // Trova tutti gli utenti con i ruoli specificati
    const users = await prisma.user.findMany({
      where: {
        role: { in: roles },
        isActive: true,
      },
      select: { id: true },
    });

    const notifications = users.map((user) => ({
      userId: user.id,
      ...notificationData,
    }));

    return prisma.notification.createMany({
      data: notifications,
    });
  }

  /**
   * Segna notifica come letta
   */
  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Segna tutte le notifiche utente come lette
   */
  async markAllAsReadByUserId(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  /**
   * Elimina notifica
   */
  async delete(id: string) {
    return prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * Elimina notifiche vecchie
   */
  async deleteOldNotifications(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true,
      },
    });
  }

  /**
   * Ottieni statistiche notifiche per utente
   */
  async getUserNotificationStats(userId: string) {
    const [total, unread, byType] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),
    ]);

    return {
      total,
      unread,
      byType,
    };
  }
}

// Main logic & Exports
export default new NotificationRepository();
