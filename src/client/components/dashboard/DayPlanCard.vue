<template>
  <div class="day-plan-card">
    <div class="day-plan-card__header">
      <h3 class="day-plan-card__title">
        <i class="pi pi-calendar"></i>
        Piano della Giornata
      </h3>
      <div class="day-plan-card__progress" v-if="dayPlan?.totalCount">
        <span class="day-plan-card__progress-text">
          {{ dayPlan.completedCount }}/{{ dayPlan.totalCount }} completati
        </span>
        <div class="day-plan-card__progress-bar">
          <div
            class="day-plan-card__progress-fill"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
      </div>
    </div>

    <div class="day-plan-card__list" v-if="!loading && dayPlan?.items.length">
      <div
        v-for="item in dayPlan.items"
        :key="item.id"
        :class="['plan-item', { 'plan-item--completed': item.completed }]"
        @click="navigateToLink(item.link)"
      >
        <div class="plan-item__time" v-if="item.time">
          {{ item.time }}
        </div>
        <div class="plan-item__time plan-item__time--empty" v-else>
          --:--
        </div>
        <div class="plan-item__line">
          <div :class="['plan-item__dot', `plan-item__dot--${item.type.toLowerCase()}`]">
            <i :class="getTypeIcon(item.type)" v-if="!item.completed"></i>
            <i class="pi pi-check" v-else></i>
          </div>
          <div class="plan-item__connector" v-if="!isLastItem(item)"></div>
        </div>
        <div class="plan-item__content">
          <span class="plan-item__type-badge">{{ getTypeLabel(item.type) }}</span>
          <span class="plan-item__title">{{ item.title }}</span>
          <p class="plan-item__description" v-if="item.description">
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>

    <div class="day-plan-card__loading" v-else-if="loading">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Caricamento piano...</span>
    </div>

    <div class="day-plan-card__empty" v-else>
      <i class="pi pi-calendar-times"></i>
      <span>Nessun evento pianificato per oggi</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { DayPlanSection, DayPlanItem, DayPlanItemType } from '../../types';

interface Props {
  dayPlan: DayPlanSection | null;
  loading?: boolean;
}

const props = defineProps<Props>();
const router = useRouter();

const progress = computed(() => {
  if (!props.dayPlan || props.dayPlan.totalCount === 0) return 0;
  return Math.round((props.dayPlan.completedCount / props.dayPlan.totalCount) * 100);
});

const getTypeIcon = (type: DayPlanItemType) => {
  const icons: Record<DayPlanItemType, string> = {
    MEETING: 'pi pi-users',
    TASK: 'pi pi-check-square',
    DEADLINE: 'pi pi-clock',
    PRODUCTION: 'pi pi-cog',
    DELIVERY: 'pi pi-truck',
    OTHER: 'pi pi-circle',
  };
  return icons[type] || 'pi pi-circle';
};

const getTypeLabel = (type: DayPlanItemType) => {
  const labels: Record<DayPlanItemType, string> = {
    MEETING: 'Meeting',
    TASK: 'Task',
    DEADLINE: 'Scadenza',
    PRODUCTION: 'Produzione',
    DELIVERY: 'Consegna',
    OTHER: 'Altro',
  };
  return labels[type] || type;
};

const isLastItem = (item: DayPlanItem) => {
  if (!props.dayPlan?.items) return true;
  const index = props.dayPlan.items.findIndex(i => i.id === item.id);
  return index === props.dayPlan.items.length - 1;
};

const navigateToLink = (link?: string) => {
  if (link) {
    router.push(link);
  }
};
</script>

<style scoped>
.day-plan-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
}

.day-plan-card__header {
  margin-bottom: var(--space-5);
}

.day-plan-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 0 0 var(--space-3) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.day-plan-card__title i {
  color: var(--color-primary-600);
}

.day-plan-card__progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.day-plan-card__progress-text {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  white-space: nowrap;
}

.day-plan-card__progress-bar {
  flex: 1;
  height: 6px;
  background: var(--color-gray-200);
  border-radius: var(--border-radius-full);
  overflow: hidden;
}

.day-plan-card__progress-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: var(--border-radius-full);
  transition: width var(--transition-base);
}

.day-plan-card__list {
  display: flex;
  flex-direction: column;
}

.plan-item {
  display: flex;
  gap: var(--space-3);
  cursor: pointer;
  padding: var(--space-2) 0;
}

.plan-item:hover .plan-item__content {
  background: var(--color-gray-50);
}

.plan-item--completed {
  opacity: 0.6;
}

.plan-item__time {
  width: 50px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-600);
  text-align: right;
  flex-shrink: 0;
}

.plan-item__time--empty {
  color: var(--color-gray-300);
}

.plan-item__line {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}

.plan-item__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: white;
  flex-shrink: 0;
  z-index: 1;
}

.plan-item__dot--meeting { background: var(--color-primary-600); }
.plan-item__dot--task { background: var(--color-info); }
.plan-item__dot--deadline { background: var(--color-danger); }
.plan-item__dot--production { background: var(--color-warning); }
.plan-item__dot--delivery { background: var(--color-success); }
.plan-item__dot--other { background: var(--color-gray-400); }

.plan-item--completed .plan-item__dot {
  background: var(--color-success);
}

.plan-item__connector {
  width: 2px;
  flex: 1;
  background: var(--color-gray-200);
  margin: 4px 0;
}

.plan-item__content {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-md);
  transition: background var(--transition-fast);
}

.plan-item__type-badge {
  font-size: var(--font-size-xs);
  color: var(--color-gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-1);
  display: block;
}

.plan-item__title {
  font-weight: 600;
  color: var(--color-gray-800);
  font-size: var(--font-size-sm);
  display: block;
}

.plan-item--completed .plan-item__title {
  text-decoration: line-through;
  color: var(--color-gray-500);
}

.plan-item__description {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin: var(--space-1) 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-plan-card__loading,
.day-plan-card__empty {
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

.day-plan-card__empty i {
  font-size: 2rem;
  color: var(--color-gray-300);
}
</style>
