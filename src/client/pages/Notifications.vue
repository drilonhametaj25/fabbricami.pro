<template>
  <div class="notifications-page">
    <PageHeader
      title="Centro Notifiche"
      subtitle="Visualizza e gestisci tutte le notifiche di sistema"
      icon="pi pi-bell"
    >
      <template #actions>
        <Button
          label="Segna tutte come lette"
          icon="pi pi-check-double"
          @click="markAllAsRead"
          class="p-button-outlined"
          :disabled="unreadCount === 0"
        />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Non Lette"
          :value="unreadCount"
          icon="pi pi-bell"
          variant="danger"
          format="number"
          subtitle="nuove notifiche"
        />
        <StatsCard
          label="Totali Oggi"
          :value="stats.today"
          icon="pi pi-envelope"
          variant="primary"
          format="number"
          subtitle="ricevute oggi"
        />
        <StatsCard
          label="Alert"
          :value="stats.alerts"
          icon="pi pi-exclamation-triangle"
          variant="warning"
          format="number"
          subtitle="notifiche alert"
        />
        <StatsCard
          label="Info"
          :value="stats.info"
          icon="pi pi-info-circle"
          variant="info"
          format="number"
          subtitle="notifiche info"
        />
      </div>
    </section>

    <!-- Table Section -->
    <section class="table-section">
      <div class="table-card">
        <div class="table-toolbar">
          <div class="toolbar-filters">
            <Dropdown
              v-model="selectedType"
              :options="typeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti i tipi"
              @change="loadNotifications"
              showClear
              class="filter-dropdown"
            />

            <Dropdown
              v-model="isRead"
              :options="readOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutte"
              @change="loadNotifications"
              showClear
              class="filter-dropdown"
            />
          </div>
        </div>

        <div class="notifications-list">
          <div v-if="loading" class="loading-state">
            <ProgressSpinner />
          </div>

          <div v-else-if="notifications.length === 0" class="empty-state">
            <i class="pi pi-inbox empty-state__icon"></i>
            <h3 class="empty-state__title">Nessuna notifica</h3>
            <p class="empty-state__text">Non ci sono notifiche da visualizzare</p>
          </div>

          <div v-else class="notifications-container">
            <div
              v-for="notification in notifications"
              :key="notification.id"
              :class="['notification-item', { 'notification-item--unread': !notification.isRead }]"
              @click="markAsRead(notification)"
            >
              <div :class="['notification-icon', getTypeClass(notification.type)]">
                <i :class="getTypeIcon(notification.type)"></i>
              </div>
              <div class="notification-content">
                <div class="notification-header">
                  <h4 class="notification-title">{{ notification.title }}</h4>
                  <span class="notification-time">{{ formatTimeAgo(notification.createdAt) }}</span>
                </div>
                <p class="notification-message">{{ notification.message }}</p>
                <Tag :severity="getTypeSeverity(notification.type)" class="notification-tag">
                  {{ getTypeLabel(notification.type) }}
                </Tag>
              </div>
              <div class="notification-actions">
                <Button
                  v-if="!notification.isRead"
                  icon="pi pi-check"
                  class="p-button-rounded p-button-text action-btn action-btn--success"
                  @click.stop="markAsRead(notification)"
                  v-tooltip.top="'Segna come letta'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--danger"
                  @click.stop="deleteNotification(notification)"
                  v-tooltip.top="'Elimina'"
                />
              </div>
            </div>
          </div>

          <Paginator
            v-if="totalRecords > 20"
            :rows="20"
            :totalRecords="totalRecords"
            @page="onPage"
            class="notifications-paginator"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const notifications = ref([]);
const totalRecords = ref(0);
const unreadCount = ref(0);
const selectedType = ref(null);
const isRead = ref(null);
const page = ref(1);

const stats = ref({
  today: 0,
  alerts: 0,
  info: 0,
});

const typeOptions = [
  { label: 'Info', value: 'INFO' },
  { label: 'Successo', value: 'SUCCESS' },
  { label: 'Attenzione', value: 'WARNING' },
  { label: 'Errore', value: 'ERROR' },
  { label: 'Scorte Basse', value: 'LOW_STOCK' },
  { label: 'Nuovo Ordine', value: 'NEW_ORDER' },
  { label: 'Pagamento Scaduto', value: 'PAYMENT_DUE' },
  { label: 'Task Assegnato', value: 'TASK_ASSIGNED' },
  { label: 'Task Scaduto', value: 'TASK_OVERDUE' },
];

const readOptions = [
  { label: 'Non lette', value: false },
  { label: 'Lette', value: true },
];

const getTypeClass = (type: string) => {
  const map: any = {
    INFO: 'notification-icon--info',
    SUCCESS: 'notification-icon--success',
    WARNING: 'notification-icon--warning',
    ERROR: 'notification-icon--error',
    LOW_STOCK: 'notification-icon--warning',
    NEW_ORDER: 'notification-icon--info',
    PAYMENT_DUE: 'notification-icon--warning',
    TASK_ASSIGNED: 'notification-icon--info',
    TASK_OVERDUE: 'notification-icon--error',
  };
  return map[type] || 'notification-icon--info';
};

const getTypeIcon = (type: string) => {
  const map: any = {
    INFO: 'pi pi-info-circle',
    SUCCESS: 'pi pi-check-circle',
    WARNING: 'pi pi-exclamation-triangle',
    ERROR: 'pi pi-times-circle',
    LOW_STOCK: 'pi pi-box',
    NEW_ORDER: 'pi pi-shopping-cart',
    PAYMENT_DUE: 'pi pi-euro',
    TASK_ASSIGNED: 'pi pi-calendar-plus',
    TASK_OVERDUE: 'pi pi-clock',
  };
  return map[type] || 'pi pi-bell';
};

const getTypeSeverity = (type: string) => {
  const map: any = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'danger',
    LOW_STOCK: 'warning',
    NEW_ORDER: 'info',
    PAYMENT_DUE: 'warning',
    TASK_ASSIGNED: 'info',
    TASK_OVERDUE: 'danger',
  };
  return map[type] || 'info';
};

const getTypeLabel = (type: string) => {
  const option = typeOptions.find(o => o.value === type);
  return option?.label || type;
};

const formatTimeAgo = (date: string) => {
  const now = new Date();
  const notifDate = new Date(date);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ora';
  if (diffMins < 60) return `${diffMins}m fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return `${diffDays}g fa`;

  return notifDate.toLocaleDateString('it-IT');
};

const loadStats = async () => {
  try {
    const response = await api.get('/notifications?limit=100');
    const allNotifications = response.data?.items || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    stats.value = {
      today: allNotifications.filter((n: any) => new Date(n.createdAt) >= today).length,
      alerts: allNotifications.filter((n: any) => ['WARNING', 'ERROR', 'LOW_STOCK', 'PAYMENT_DUE', 'TASK_OVERDUE'].includes(n.type)).length,
      info: allNotifications.filter((n: any) => ['INFO', 'SUCCESS', 'NEW_ORDER', 'TASK_ASSIGNED'].includes(n.type)).length,
    };
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadUnreadCount = async () => {
  try {
    const response = await api.get('/notifications/unread-count');
    if (response.success) {
      unreadCount.value = response.data.count;
    }
  } catch (error) {
    console.error('Error loading unread count:', error);
  }
};

const loadNotifications = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...(selectedType.value && { type: selectedType.value }),
      ...(isRead.value !== null && { isRead: isRead.value.toString() }),
    });

    const response = await api.get(`/notifications?${params.toString()}`);

    if (response.success) {
      notifications.value = response.data?.items || [];
      totalRecords.value = response.data?.pagination?.total || 0;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento delle notifiche',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadNotifications();
};

const markAsRead = async (notification: any) => {
  if (notification.isRead) return;

  try {
    await api.patch(`/notifications/${notification.id}/read`);
    notification.isRead = true;
    loadUnreadCount();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante l\'aggiornamento',
      life: 3000,
    });
  }
};

const markAllAsRead = async () => {
  try {
    await api.patch('/notifications/mark-all-read');
    toast.add({
      severity: 'success',
      summary: 'Completato',
      detail: 'Tutte le notifiche sono state segnate come lette',
      life: 3000,
    });
    loadNotifications();
    loadUnreadCount();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante l\'aggiornamento',
      life: 3000,
    });
  }
};

const deleteNotification = (notification: any) => {
  confirm.require({
    message: 'Sei sicuro di voler eliminare questa notifica?',
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Si, elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/notifications/${notification.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminata',
          detail: 'Notifica eliminata',
          life: 3000,
        });
        loadNotifications();
        loadUnreadCount();
        loadStats();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message || 'Errore durante l\'eliminazione',
          life: 3000,
        });
      }
    },
  });
};

onMounted(() => {
  loadNotifications();
  loadUnreadCount();
  loadStats();
});
</script>

<style scoped>
.notifications-page {
  max-width: 1200px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

/* Table Section */
.table-section {
  margin-top: var(--space-6);
}

.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
}

.toolbar-filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
}

/* Notifications List */
.notifications-list {
  min-height: 400px;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 4rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state__title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-gray-600);
  margin: 0 0 var(--space-2) 0;
}

.empty-state__text {
  font-size: var(--font-size-base);
  color: var(--color-gray-500);
  margin: 0;
}

/* Notifications Container */
.notifications-container {
  display: flex;
  flex-direction: column;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--bg-card);
  border-bottom: var(--border-width) solid var(--border-color-light);
  transition: background var(--transition-fast);
  cursor: pointer;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: var(--color-gray-50);
}

.notification-item--unread {
  background: var(--color-primary-50);
  border-left: 4px solid var(--color-primary-600);
}

.notification-item--unread:hover {
  background: var(--color-primary-100);
}

/* Notification Icon */
.notification-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.notification-icon--info {
  background: var(--color-primary-50);
  color: var(--color-primary-600);
}

.notification-icon--success {
  background: var(--color-success-light);
  color: var(--color-success);
}

.notification-icon--warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.notification-icon--error {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* Notification Content */
.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
  gap: var(--space-3);
}

.notification-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-900);
}

.notification-time {
  font-size: var(--font-size-sm);
  color: var(--color-gray-400);
  flex-shrink: 0;
}

.notification-message {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-gray-600);
  line-height: var(--line-height-relaxed);
  font-size: var(--font-size-sm);
}

.notification-tag {
  font-size: var(--font-size-xs) !important;
}

/* Notification Actions */
.notification-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
}

.action-btn--success {
  color: var(--color-success) !important;
}

.action-btn--danger {
  color: var(--color-danger) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Paginator */
.notifications-paginator {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }

  .notification-item {
    flex-direction: column;
    gap: var(--space-3);
  }

  .notification-icon {
    width: 40px;
    height: 40px;
    font-size: 1.25rem;
  }

  .notification-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .notification-actions {
    align-self: flex-end;
  }
}
</style>
