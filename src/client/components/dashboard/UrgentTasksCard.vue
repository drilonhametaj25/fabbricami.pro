<template>
  <div class="urgent-tasks-card">
    <div class="urgent-tasks-card__header">
      <h3 class="urgent-tasks-card__title">
        <i class="pi pi-exclamation-triangle"></i>
        Attivita Urgenti
      </h3>
      <span class="urgent-tasks-card__count" v-if="urgentTasks?.total">
        {{ urgentTasks.total }} totali
      </span>
    </div>

    <div class="urgent-tasks-card__list" v-if="!loading && urgentTasks?.items.length">
      <div
        v-for="task in urgentTasks.items"
        :key="task.id"
        :class="['task-item', `task-item--${task.priority.toLowerCase()}`]"
        @click="navigateToLink(task.link)"
      >
        <div class="task-item__type-badge">
          <i :class="getTypeIcon(task.type)"></i>
        </div>
        <div class="task-item__content">
          <div class="task-item__header">
            <span class="task-item__title">{{ task.title }}</span>
            <span :class="['task-item__priority', `task-item__priority--${task.priority.toLowerCase()}`]">
              {{ getPriorityLabel(task.priority) }}
            </span>
          </div>
          <p class="task-item__description" v-if="task.description">
            {{ task.description }}
          </p>
          <span class="task-item__due" v-if="task.dueDate">
            <i class="pi pi-clock"></i>
            {{ formatDueDate(task.dueDate) }}
          </span>
        </div>
        <i class="pi pi-chevron-right task-item__arrow"></i>
      </div>
    </div>

    <div class="urgent-tasks-card__loading" v-else-if="loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Caricamento...</span>
    </div>

    <div class="urgent-tasks-card__empty" v-else>
      <i class="pi pi-check-circle"></i>
      <span>Nessuna attivita urgente. Ottimo lavoro!</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { UrgentTaskSection, UrgentTaskType, UrgentTaskPriority } from '../../types';

interface Props {
  urgentTasks: UrgentTaskSection | null;
  loading?: boolean;
}

defineProps<Props>();

const router = useRouter();

const getTypeIcon = (type: UrgentTaskType) => {
  const icons: Record<UrgentTaskType, string> = {
    ORDER: 'pi pi-shopping-cart',
    TASK: 'pi pi-check-square',
    PRODUCTION: 'pi pi-cog',
    PAYMENT: 'pi pi-credit-card',
    STOCK: 'pi pi-box',
    SUPPLIER: 'pi pi-truck',
  };
  return icons[type] || 'pi pi-info-circle';
};

const getPriorityLabel = (priority: UrgentTaskPriority) => {
  const labels: Record<UrgentTaskPriority, string> = {
    CRITICAL: 'Critico',
    HIGH: 'Alta',
    MEDIUM: 'Media',
  };
  return labels[priority] || priority;
};

const formatDueDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `In ritardo di ${Math.abs(diffDays)} giorni`;
  } else if (diffDays === 0) {
    return 'Oggi';
  } else if (diffDays === 1) {
    return 'Domani';
  } else {
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
    });
  }
};

const navigateToLink = (link: string) => {
  router.push(link);
};
</script>

<style scoped>
.urgent-tasks-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
}

.urgent-tasks-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.urgent-tasks-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.urgent-tasks-card__title i {
  color: var(--color-warning);
}

.urgent-tasks-card__count {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  background: var(--color-gray-100);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-full);
}

.urgent-tasks-card__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  border-left: 3px solid transparent;
}

.task-item:hover {
  background: var(--color-gray-100);
  transform: translateX(2px);
}

.task-item--critical {
  border-left-color: var(--color-danger);
}

.task-item--high {
  border-left-color: var(--color-warning);
}

.task-item--medium {
  border-left-color: var(--color-info);
}

.task-item__type-badge {
  width: 36px;
  height: 36px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-gray-200);
  color: var(--color-gray-600);
  flex-shrink: 0;
}

.task-item--critical .task-item__type-badge {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.task-item--high .task-item__type-badge {
  background: var(--color-warning-light);
  color: var(--color-warning-dark);
}

.task-item__content {
  flex: 1;
  min-width: 0;
}

.task-item__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.task-item__title {
  font-weight: 600;
  color: var(--color-gray-800);
  font-size: var(--font-size-sm);
}

.task-item__priority {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--border-radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.task-item__priority--critical {
  background: var(--color-danger);
  color: white;
}

.task-item__priority--high {
  background: var(--color-warning);
  color: white;
}

.task-item__priority--medium {
  background: var(--color-info);
  color: white;
}

.task-item__description {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin: var(--space-1) 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-item__due {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-gray-400);
  margin-top: var(--space-2);
}

.task-item__arrow {
  color: var(--color-gray-400);
  flex-shrink: 0;
  align-self: center;
}

.urgent-tasks-card__loading,
.urgent-tasks-card__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
  text-align: center;
}

.urgent-tasks-card__empty i {
  font-size: 2rem;
  color: var(--color-success);
}
</style>
