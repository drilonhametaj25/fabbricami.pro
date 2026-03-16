import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api.service';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      if (response.success) {
        unreadCount.value = response.data.count;
      }
    } catch {
      // Load failed silently
    }
  };

  const loadNotifications = async (limit = 10) => {
    try {
      const response = await api.get(`/notifications?limit=${limit}&sortBy=createdAt&sortOrder=desc`);
      if (response.success) {
        notifications.value = response.data.items;
      }
    } catch {
      // Load failed silently
    }
  };

  const addNotification = (notification: Notification) => {
    notifications.value.unshift(notification);
    if (!notification.isRead) {
      unreadCount.value++;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      const notification = notifications.value.find(n => n.id === id);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        unreadCount.value--;
      }
    } catch {
      // Mark-as-read failed silently
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read', {});
      notifications.value.forEach(n => n.isRead = true);
      unreadCount.value = 0;
    } catch {
      // Mark-all-as-read failed silently
    }
  };

  return {
    notifications,
    unreadCount,
    loadUnreadCount,
    loadNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
  };
});
