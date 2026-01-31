<template>
  <div class="calendar-page">
    <PageHeader title="Calendario" subtitle="Gestisci eventi, scadenze e promemoria" icon="pi pi-calendar">
      <template #actions>
        <Button label="Nuovo Evento" icon="pi pi-plus" @click="openCreateDialog" class="p-button-lg" />
      </template>
    </PageHeader>

    <!-- Quick Stats -->
    <section class="stats-section">
      <div class="stats-grid stats-grid--3">
        <StatsCard
          label="Eventi Oggi"
          :value="stats.today"
          icon="pi pi-calendar-times"
          variant="primary"
        />
        <StatsCard
          label="Prossimi 7 giorni"
          :value="stats.upcoming"
          icon="pi pi-clock"
          variant="warning"
        />
        <StatsCard
          label="Promemoria Attivi"
          :value="stats.reminders"
          icon="pi pi-bell"
          variant="success"
        />
      </div>
    </section>

    <!-- Calendar Card -->
    <div class="calendar-card">
      <div class="calendar-toolbar">
        <div class="calendar-nav">
          <Button icon="pi pi-chevron-left" @click="previousMonth" class="p-button-text" />
          <h2 class="calendar-title">{{ monthYearLabel }}</h2>
          <Button icon="pi pi-chevron-right" @click="nextMonth" class="p-button-text" />
        </div>
        <div class="calendar-actions">
          <Button label="Oggi" @click="goToToday" class="p-button-outlined p-button-sm" />
          <Dropdown
            v-model="selectedEventType"
            :options="eventTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Tutti i tipi"
            @change="loadMonthEvents"
            showClear
            class="event-type-filter"
          />
        </div>
      </div>

      <div class="calendar-container">
        <div class="calendar-weekdays">
          <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
        </div>
        <div class="calendar-grid">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            :class="[
              'calendar-day',
              { 'other-month': day.isOtherMonth },
              { 'today': day.isToday },
              { 'selected': day.isSelected },
              { 'has-events': day.events.length > 0 }
            ]"
            @click="selectDay(day)"
          >
            <span class="day-number">{{ day.number }}</span>
            <div v-if="day.events.length > 0" class="day-events">
              <div
                v-for="event in day.events.slice(0, 3)"
                :key="event.id"
                :class="['event-dot', getEventTypeClass(event.type)]"
                v-tooltip.top="event.title"
              ></div>
              <span v-if="day.events.length > 3" class="events-more">+{{ day.events.length - 3 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Events List for Selected Day -->
    <div v-if="selectedDay" class="events-list-card">
      <div class="events-list-header">
        <h3>Eventi del {{ formatDate(selectedDay.date) }}</h3>
        <Button
          icon="pi pi-times"
          class="p-button-rounded p-button-text"
          @click="selectedDay = null"
        />
      </div>
      <div class="events-list-content">
        <div v-if="selectedDay.events.length === 0" class="empty-day">
          <i class="pi pi-calendar"></i>
          <p>Nessun evento programmato per questo giorno</p>
        </div>
        <div v-else class="events-list">
          <div
            v-for="event in selectedDay.events"
            :key="event.id"
            :class="['event-item', getEventTypeClass(event.type)]"
          >
            <div class="event-item-icon">
              <i :class="getEventTypeIcon(event.type)"></i>
            </div>
            <div class="event-item-content">
              <h4>{{ event.title }}</h4>
              <p v-if="event.description" class="event-description">{{ event.description }}</p>
              <div class="event-meta">
                <span v-if="event.startTime" class="event-time">
                  <i class="pi pi-clock"></i> {{ event.startTime }}
                  <span v-if="event.endTime"> - {{ event.endTime }}</span>
                </span>
                <Tag :severity="getEventTypeSeverity(event.type)" class="event-type-tag">
                  {{ getEventTypeLabel(event.type) }}
                </Tag>
              </div>
            </div>
            <div class="event-item-actions">
              <Button
                icon="pi pi-pencil"
                class="p-button-rounded p-button-text p-button-sm"
                @click="editEvent(event)"
                v-tooltip.top="'Modifica'"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-rounded p-button-text p-button-sm p-button-danger"
                @click="deleteEvent(event)"
                v-tooltip.top="'Elimina'"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dialog Create/Edit Event -->
    <Dialog
      v-model:visible="showEventDialog"
      :header="selectedEvent ? 'Modifica Evento' : 'Nuovo Evento'"
      :style="{ width: '600px' }"
      :modal="true"
      class="modern-dialog"
    >
      <div class="form-grid">
        <div class="form-field full-width">
          <label for="title">Titolo *</label>
          <InputText id="title" v-model="eventFormData.title" class="w-full" />
        </div>

        <div class="form-field full-width">
          <label for="description">Descrizione</label>
          <Textarea id="description" v-model="eventFormData.description" rows="3" class="w-full" />
        </div>

        <div class="form-field">
          <label for="eventDate">Data *</label>
          <Calendar id="eventDate" v-model="eventFormData.eventDate" dateFormat="dd/mm/yy" class="w-full" />
        </div>

        <div class="form-field">
          <label for="eventType">Tipo Evento *</label>
          <Dropdown
            id="eventType"
            v-model="eventFormData.type"
            :options="eventTypeOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="startTime">Ora Inizio</label>
          <InputText id="startTime" v-model="eventFormData.startTime" type="time" class="w-full" />
        </div>

        <div class="form-field">
          <label for="endTime">Ora Fine</label>
          <InputText id="endTime" v-model="eventFormData.endTime" type="time" class="w-full" />
        </div>

        <div class="form-field">
          <label for="reminderMinutes">Promemoria (minuti prima)</label>
          <InputNumber id="reminderMinutes" v-model="eventFormData.reminderMinutes" :min="0" class="w-full" />
        </div>

        <div class="form-field">
          <label for="location">Luogo</label>
          <InputText id="location" v-model="eventFormData.location" class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" @click="showEventDialog = false" class="p-button-text" />
        <Button label="Salva" icon="pi pi-check" @click="handleSaveEvent" :loading="savingEvent" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Calendar from 'primevue/calendar';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const savingEvent = ref(false);
const currentMonth = ref(new Date());
const selectedDay = ref<any>(null);
const selectedEventType = ref(null);
const showEventDialog = ref(false);
const selectedEvent = ref<any>(null);
const monthEvents = ref<any[]>([]);

const stats = ref({
  today: 0,
  upcoming: 0,
  reminders: 0,
});

const eventFormData = ref({
  title: '',
  description: '',
  eventDate: new Date(),
  type: 'MEETING',
  startTime: '',
  endTime: '',
  reminderMinutes: 30,
  location: '',
});

const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const eventTypeOptions = [
  { label: 'Riunione', value: 'MEETING' },
  { label: 'Scadenza', value: 'DEADLINE' },
  { label: 'Promemoria', value: 'REMINDER' },
  { label: 'Evento', value: 'EVENT' },
  { label: 'Pagamento', value: 'PAYMENT' },
  { label: 'Task', value: 'TASK' },
  { label: 'Altro', value: 'OTHER' },
];

const monthYearLabel = computed(() => {
  return currentMonth.value.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
});

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Adjust for Monday start (getDay() returns 0 for Sunday)
  let startPadding = firstDay.getDay() - 1;
  if (startPadding < 0) startPadding = 6;

  const days: any[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Previous month days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      number: prevMonthLastDay - i,
      date: date,
      isOtherMonth: true,
      isToday: false,
      isSelected: false,
      events: getEventsForDate(date),
    });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    days.push({
      number: i,
      date: date,
      isOtherMonth: false,
      isToday: date.getTime() === today.getTime(),
      isSelected: selectedDay.value && date.getTime() === selectedDay.value.date.getTime(),
      events: getEventsForDate(date),
    });
  }

  // Next month days to fill grid (6 rows of 7 days)
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      number: i,
      date: date,
      isOtherMonth: true,
      isToday: false,
      isSelected: false,
      events: getEventsForDate(date),
    });
  }

  return days;
});

const getEventsForDate = (date: Date) => {
  if (!monthEvents.value || !Array.isArray(monthEvents.value)) {
    return [];
  }
  const dateStr = date.toISOString().split('T')[0];
  return monthEvents.value.filter(event => {
    const eventDateStr = new Date(event.eventDate).toISOString().split('T')[0];
    return eventDateStr === dateStr;
  });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const getEventTypeClass = (type: string) => {
  const map: any = {
    MEETING: 'event-type-meeting',
    DEADLINE: 'event-type-deadline',
    REMINDER: 'event-type-reminder',
    EVENT: 'event-type-event',
    PAYMENT: 'event-type-payment',
    TASK: 'event-type-task',
    OTHER: 'event-type-other',
  };
  return map[type] || 'event-type-other';
};

const getEventTypeIcon = (type: string) => {
  const map: any = {
    MEETING: 'pi pi-users',
    DEADLINE: 'pi pi-calendar-times',
    REMINDER: 'pi pi-bell',
    EVENT: 'pi pi-calendar',
    PAYMENT: 'pi pi-euro',
    TASK: 'pi pi-check-square',
    OTHER: 'pi pi-circle',
  };
  return map[type] || 'pi pi-circle';
};

const getEventTypeSeverity = (type: string) => {
  const map: any = {
    MEETING: 'info',
    DEADLINE: 'danger',
    REMINDER: 'warning',
    EVENT: 'success',
    PAYMENT: 'warning',
    TASK: 'info',
    OTHER: 'secondary',
  };
  return map[type] || 'secondary';
};

const getEventTypeLabel = (type: string) => {
  const option = eventTypeOptions.find(o => o.value === type);
  return option?.label || type;
};

const previousMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1);
  loadMonthEvents();
};

const nextMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1);
  loadMonthEvents();
};

const goToToday = () => {
  currentMonth.value = new Date();
  loadMonthEvents();
};

const selectDay = (day: any) => {
  if (day.isOtherMonth) {
    // Navigate to that month
    currentMonth.value = new Date(day.date);
    loadMonthEvents();
  }
  selectedDay.value = day;
};

const loadStats = async () => {
  try {
    const response = await api.get('/calendar-events/statistics');
    if (response.success) {
      stats.value = response.data;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadMonthEvents = async () => {
  try {
    loading.value = true;

    const year = currentMonth.value.getFullYear();
    const month = currentMonth.value.getMonth() + 1;

    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
      ...(selectedEventType.value && { type: selectedEventType.value }),
    });

    const response = await api.get(`/calendar-events/month?${params.toString()}`);

    if (response.success) {
      monthEvents.value = response.data.events || response.data.items || [];
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento degli eventi',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  selectedEvent.value = null;
  eventFormData.value = {
    title: '',
    description: '',
    eventDate: selectedDay.value ? selectedDay.value.date : new Date(),
    type: 'MEETING',
    startTime: '',
    endTime: '',
    reminderMinutes: 30,
    location: '',
  };
  showEventDialog.value = true;
};

const editEvent = (event: any) => {
  selectedEvent.value = event;
  eventFormData.value = {
    title: event.title,
    description: event.description || '',
    eventDate: new Date(event.eventDate),
    type: event.type,
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    reminderMinutes: event.reminderMinutes || 0,
    location: event.location || '',
  };
  showEventDialog.value = true;
};

const deleteEvent = (event: any) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare l'evento "${event.title}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sì, elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/calendar-events/${event.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminato',
          detail: 'Evento eliminato',
          life: 3000,
        });
        loadMonthEvents();
        loadStats();
        if (selectedDay.value) {
          selectedDay.value.events = getEventsForDate(selectedDay.value.date);
        }
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

const handleSaveEvent = async () => {
  try {
    // Validation
    if (!eventFormData.value.title) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Il titolo è obbligatorio',
        life: 3000,
      });
      return;
    }

    savingEvent.value = true;

    if (selectedEvent.value?.id) {
      // Update
      await api.patch(`/calendar-events/${selectedEvent.value.id}`, eventFormData.value);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Evento aggiornato con successo',
        life: 3000,
      });
    } else {
      // Create
      await api.post('/calendar-events', eventFormData.value);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Evento creato con successo',
        life: 3000,
      });
    }

    showEventDialog.value = false;
    loadMonthEvents();
    loadStats();
    if (selectedDay.value) {
      selectedDay.value.events = getEventsForDate(selectedDay.value.date);
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 3000,
    });
  } finally {
    savingEvent.value = false;
  }
};

onMounted(() => {
  loadMonthEvents();
  loadStats();
});
</script>

<style scoped>
.calendar-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6);
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid--3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}

@media (max-width: 1024px) {
  .stats-grid--3 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid--3 {
    grid-template-columns: 1fr;
  }
}

/* Calendar Card */
.calendar-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
  margin-bottom: var(--space-6);
}

.calendar-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.calendar-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  min-width: 200px;
  text-align: center;
}

.calendar-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.event-type-filter {
  min-width: 180px;
}

.calendar-container {
  background: var(--bg-card);
  border-radius: var(--border-radius-md);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.weekday {
  text-align: center;
  padding: var(--space-3);
  font-weight: 600;
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
}

.calendar-day {
  aspect-ratio: 1;
  padding: var(--space-2);
  border: var(--border-width) solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
}

.calendar-day:hover {
  background: var(--color-gray-50);
  border-color: var(--color-primary-400);
}

.calendar-day.other-month {
  opacity: 0.4;
}

.calendar-day.today {
  background: linear-gradient(135deg, var(--color-primary-50) 0%, var(--color-primary-100) 100%);
  border-color: var(--color-primary-500);
  border-width: 2px;
}

.calendar-day.selected {
  background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
  color: white;
  border-color: var(--color-primary-700);
}

.calendar-day.selected .day-number {
  color: white;
}

.calendar-day.has-events {
  font-weight: 600;
}

.day-number {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-900);
  margin-bottom: var(--space-1);
}

.day-events {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: auto;
}

.event-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.event-dot.event-type-meeting {
  background: var(--color-info);
}

.event-dot.event-type-deadline {
  background: var(--color-danger);
}

.event-dot.event-type-reminder {
  background: var(--color-warning);
}

.event-dot.event-type-event {
  background: var(--color-success);
}

.event-dot.event-type-payment {
  background: var(--color-warning);
}

.event-dot.event-type-task {
  background: var(--color-info);
}

.event-dot.event-type-other {
  background: var(--color-gray-500);
}

.events-more {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  font-weight: 600;
}

/* Events List Card */
.events-list-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  border: var(--border-width) solid var(--border-color-light);
  margin-bottom: var(--space-6);
  overflow: hidden;
}

.events-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color);
}

.events-list-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
}

.events-list-content {
  padding: var(--space-6);
}

.empty-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10);
  color: var(--color-gray-400);
}

.empty-day i {
  font-size: 3rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-day p {
  margin: 0;
  font-size: var(--font-size-base);
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.event-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color-light);
  border-radius: var(--border-radius-lg);
  border-left-width: 4px;
  transition: all var(--transition-fast);
}

.event-item:hover {
  box-shadow: var(--shadow-md);
}

.event-item.event-type-meeting {
  border-left-color: var(--color-info);
}

.event-item.event-type-deadline {
  border-left-color: var(--color-danger);
}

.event-item.event-type-reminder {
  border-left-color: var(--color-warning);
}

.event-item.event-type-event {
  border-left-color: var(--color-success);
}

.event-item.event-type-payment {
  border-left-color: var(--color-warning);
}

.event-item.event-type-task {
  border-left-color: var(--color-info);
}

.event-item.event-type-other {
  border-left-color: var(--color-gray-500);
}

.event-item-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: var(--color-gray-100);
  color: var(--color-gray-600);
  flex-shrink: 0;
}

.event-item-content {
  flex: 1;
  min-width: 0;
}

.event-item-content h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-900);
}

.event-description {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
}

.event-meta {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.event-time {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
}

.event-type-tag {
  font-size: var(--font-size-xs) !important;
}

.event-item-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

/* Form Styles */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-5);
  padding: var(--space-4) 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-weight: 600;
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

.w-full {
  width: 100%;
}

/* Responsive */
@media (max-width: 768px) {
  .calendar-page {
    padding: var(--space-4);
  }

  .calendar-card {
    padding: var(--space-4);
  }

  .calendar-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .calendar-nav {
    justify-content: center;
  }

  .calendar-actions {
    justify-content: center;
    flex-wrap: wrap;
  }

  .calendar-day {
    padding: var(--space-1);
  }

  .day-number {
    font-size: var(--font-size-xs);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .event-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .event-item-actions {
    width: 100%;
    justify-content: flex-end;
    margin-top: var(--space-3);
  }
}
</style>
