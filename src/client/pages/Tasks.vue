<template>
  <div class="tasks-page">
    <PageHeader
      title="Gestione Task"
      subtitle="Organizza e traccia le attività del team"
      icon="pi pi-list-check"
    >
      <template #actions>
        <Button label="Nuovo Task" icon="pi pi-plus" @click="openCreateDialog" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Totale Task"
          :value="stats.total"
          icon="pi pi-list"
          variant="primary"
          format="number"
          subtitle="nel sistema"
        />
        <StatsCard
          label="In Corso"
          :value="stats.inProgress"
          icon="pi pi-clock"
          variant="warning"
          format="number"
          subtitle="attualmente attivi"
        />
        <StatsCard
          label="Completati"
          :value="stats.completed"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          subtitle="questo mese"
        />
        <StatsCard
          label="Scaduti"
          :value="stats.overdue"
          icon="pi pi-exclamation-circle"
          variant="danger"
          format="number"
          subtitle="da completare"
        />
      </div>
    </section>

    <!-- Filters & Table -->
    <section class="table-section">
      <div class="table-card">
        <div class="table-toolbar">
          <div class="search-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="search"
              placeholder="Cerca per titolo o descrizione..."
              @input="debounceSearch"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedStatus"
              :options="statuses"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli stati"
              @change="loadTasks"
              showClear
              class="filter-dropdown"
            />

            <Dropdown
              v-model="selectedPriority"
              :options="priorities"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutte le priorità"
              @change="loadTasks"
              showClear
              class="filter-dropdown"
            />

            <Dropdown
              v-model="selectedAssignee"
              :options="employees"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli assegnatari"
              @change="loadTasks"
              showClear
              filter
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="tasks"
          :loading="loading"
          paginator
          :rows="20"
          :totalRecords="totalRecords"
          :lazy="true"
          @page="onPage"
          @sort="onSort"
          responsiveLayout="scroll"
          stripedRows
          class="custom-table"
          :rowHover="true"
        >
          <Column field="title" header="Titolo" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="task-title">
                <span>{{ data.title }}</span>
                <i v-if="isOverdue(data)" class="pi pi-exclamation-triangle overdue-icon" v-tooltip.top="'Task scaduto'"></i>
              </div>
            </template>
          </Column>
          <Column field="description" header="Descrizione" style="min-width: 250px">
            <template #body="{ data }">
              <span class="task-description">{{ data.description || '-' }}</span>
            </template>
          </Column>
          <Column field="status" header="Stato" sortable style="min-width: 130px">
            <template #body="{ data }">
              <Tag :severity="getStatusSeverity(data.status)" :icon="getStatusIcon(data.status)">
                {{ formatStatus(data.status) }}
              </Tag>
            </template>
          </Column>
          <Column field="priority" header="Priorità" sortable style="min-width: 110px">
            <template #body="{ data }">
              <Tag :severity="getPrioritySeverity(data.priority)">
                {{ formatPriority(data.priority) }}
              </Tag>
            </template>
          </Column>
          <Column field="assignedTo" header="Assegnato a" style="min-width: 150px">
            <template #body="{ data }">
              <div v-if="data.assignedTo" class="assignee-cell">
                <Avatar :label="getInitials(data.assignedTo)" size="small" shape="circle" />
                <span>{{ getFullName(data.assignedTo) }}</span>
              </div>
              <span v-else class="text-muted">Non assegnato</span>
            </template>
          </Column>
          <Column field="dueDate" header="Scadenza" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span v-if="data.dueDate" :class="{ 'overdue-date': isOverdue(data) }">
                {{ formatDate(data.dueDate) }}
              </span>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 150px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewTask(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editTask(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  v-if="data.status !== 'COMPLETED'"
                  icon="pi pi-check"
                  class="p-button-rounded p-button-text action-btn action-btn--complete"
                  @click="completeTask(data)"
                  v-tooltip.top="'Completa'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="deleteTask(data)"
                  v-tooltip.top="'Elimina'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-list-check empty-state__icon"></i>
              <p class="empty-state__text">Nessun task trovato</p>
              <Button label="Crea il primo task" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Dialog Create/Edit -->
    <Dialog
      v-model:visible="showDialog"
      :header="selectedTask ? 'Modifica Task' : 'Nuovo Task'"
      :style="{ width: '700px' }"
      :modal="true"
      class="modern-dialog"
    >
      <div class="form-grid">
        <div class="form-field full-width">
          <label for="title">Titolo *</label>
          <InputText id="title" v-model="formData.title" class="w-full" />
        </div>

        <div class="form-field full-width">
          <label for="description">Descrizione</label>
          <Textarea id="description" v-model="formData.description" rows="3" class="w-full" />
        </div>

        <div class="form-field">
          <label for="status">Stato *</label>
          <Dropdown
            id="status"
            v-model="formData.status"
            :options="statuses"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="priority">Priorità *</label>
          <Dropdown
            id="priority"
            v-model="formData.priority"
            :options="priorities"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="assignedTo">Assegnato a</label>
          <Dropdown
            id="assignedTo"
            v-model="formData.assignedToId"
            :options="employees"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona dipendente"
            filter
            showClear
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="dueDate">Scadenza</label>
          <Calendar id="dueDate" v-model="formData.dueDate" dateFormat="dd/mm/yy" class="w-full" />
        </div>

        <div class="form-field">
          <label for="estimatedHours">Ore Stimate</label>
          <InputNumber id="estimatedHours" v-model="formData.estimatedHours" :min="0" suffix=" h" class="w-full" />
        </div>

        <div class="form-field">
          <label for="orderId">Ordine Collegato</label>
          <Dropdown
            id="orderId"
            v-model="formData.orderId"
            :options="orders"
            optionLabel="label"
            optionValue="value"
            placeholder="Nessun ordine"
            filter
            showClear
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" @click="showDialog = false" class="p-button-text" />
        <Button label="Salva" icon="pi pi-check" @click="handleSave" :loading="saving" />
      </template>
    </Dialog>

    <!-- Dialog View Details -->
    <Dialog
      v-model:visible="showDetailDialog"
      header="Dettaglio Task"
      :style="{ width: '700px' }"
      :modal="true"
      class="modern-dialog"
    >
      <div v-if="selectedTask" class="detail-view">
        <div class="detail-header">
          <h2>{{ selectedTask.title }}</h2>
          <div class="detail-badges">
            <Tag :severity="getStatusSeverity(selectedTask.status)" :icon="getStatusIcon(selectedTask.status)">
              {{ formatStatus(selectedTask.status) }}
            </Tag>
            <Tag :severity="getPrioritySeverity(selectedTask.priority)">
              {{ formatPriority(selectedTask.priority) }}
            </Tag>
          </div>
        </div>

        <Divider />

        <div v-if="selectedTask.description" class="detail-section">
          <h3><i class="pi pi-file-edit"></i> Descrizione</h3>
          <p class="description-text">{{ selectedTask.description }}</p>
        </div>

        <div class="detail-section">
          <h3><i class="pi pi-info-circle"></i> Informazioni</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Assegnato a:</span>
              <span class="detail-value">
                {{ selectedTask.assignedTo ? getFullName(selectedTask.assignedTo) : 'Non assegnato' }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Scadenza:</span>
              <span class="detail-value" :class="{ 'overdue-date': isOverdue(selectedTask) }">
                {{ selectedTask.dueDate ? formatDate(selectedTask.dueDate) : '-' }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Ore Stimate:</span>
              <span class="detail-value">{{ selectedTask.estimatedHours ? `${selectedTask.estimatedHours}h` : '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Ore Effettive:</span>
              <span class="detail-value">{{ selectedTask.actualHours ? `${selectedTask.actualHours}h` : '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Creato da:</span>
              <span class="detail-value">
                {{ selectedTask.createdBy ? getFullName(selectedTask.createdBy) : '-' }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Data Creazione:</span>
              <span class="detail-value">{{ formatDateTime(selectedTask.createdAt) }}</span>
            </div>
          </div>
        </div>

        <div v-if="selectedTask.order" class="detail-section">
          <h3><i class="pi pi-shopping-cart"></i> Ordine Collegato</h3>
          <div class="order-link">
            <span class="order-number">{{ selectedTask.order.orderNumber }}</span>
            <span class="order-customer">{{ selectedTask.order.customer?.businessName || selectedTask.order.customer?.firstName }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Chiudi" icon="pi pi-times" @click="showDetailDialog = false" class="p-button-text" />
        <Button label="Modifica" icon="pi pi-pencil" @click="editFromDetail" />
        <Button
          v-if="selectedTask?.status !== 'COMPLETED'"
          label="Completa"
          icon="pi pi-check"
          @click="completeFromDetail"
          class="p-button-success"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Calendar from 'primevue/calendar';
import Divider from 'primevue/divider';
import Avatar from 'primevue/avatar';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const saving = ref(false);
const tasks = ref([]);
const employees = ref<any[]>([]);
const orders = ref<any[]>([]);
const totalRecords = ref(0);
const search = ref('');
const selectedStatus = ref(null);
const selectedPriority = ref(null);
const selectedAssignee = ref(null);
const page = ref(1);
const sortBy = ref('createdAt');
const sortOrder = ref('desc');

const showDialog = ref(false);
const showDetailDialog = ref(false);
const selectedTask = ref<any>(null);

const stats = ref({
  total: 0,
  inProgress: 0,
  completed: 0,
  overdue: 0,
});

const formData = ref({
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  assignedToId: null,
  dueDate: null,
  estimatedHours: null,
  orderId: null,
});

const statuses = [
  { label: 'Da Fare', value: 'TODO' },
  { label: 'In Corso', value: 'IN_PROGRESS' },
  { label: 'In Pausa', value: 'ON_HOLD' },
  { label: 'Completato', value: 'COMPLETED' },
  { label: 'Annullato', value: 'CANCELLED' },
];

const priorities = [
  { label: 'Bassa', value: 'LOW' },
  { label: 'Media', value: 'MEDIUM' },
  { label: 'Alta', value: 'HIGH' },
  { label: 'Urgente', value: 'URGENT' },
];

const formatStatus = (status: string) => {
  const map: Record<string, string> = {
    TODO: 'Da Fare',
    IN_PROGRESS: 'In Corso',
    ON_HOLD: 'In Pausa',
    COMPLETED: 'Completato',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

const formatPriority = (priority: string) => {
  const map: Record<string, string> = {
    LOW: 'Bassa',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  };
  return map[priority] || priority;
};

const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    TODO: 'secondary',
    IN_PROGRESS: 'info',
    ON_HOLD: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'info';
};

const getStatusIcon = (status: string) => {
  const map: Record<string, string> = {
    TODO: 'pi pi-circle',
    IN_PROGRESS: 'pi pi-spin pi-spinner',
    ON_HOLD: 'pi pi-pause',
    COMPLETED: 'pi pi-check',
    CANCELLED: 'pi pi-times',
  };
  return map[status] || 'pi pi-circle';
};

const getPrioritySeverity = (priority: string) => {
  const map: Record<string, string> = {
    LOW: 'success',
    MEDIUM: 'info',
    HIGH: 'warning',
    URGENT: 'danger',
  };
  return map[priority] || 'info';
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('it-IT');
};

const isOverdue = (task: any) => {
  if (!task.dueDate || task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate) < new Date();
};

const getInitials = (employee: any) => {
  if (!employee?.user) return '?';
  return `${employee.user.firstName?.[0] || ''}${employee.user.lastName?.[0] || ''}`.toUpperCase();
};

const getFullName = (employee: any) => {
  if (!employee?.user) return 'N/A';
  return `${employee.user.firstName || ''} ${employee.user.lastName || ''}`.trim();
};

let searchTimeout: any = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadTasks();
  }, 500);
};

const loadStats = async () => {
  try {
    const response = await api.get('/tasks?limit=100');
    const allTasks = response.data?.items || [];

    const now = new Date();

    stats.value = {
      total: allTasks.length,
      inProgress: allTasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
      completed: allTasks.filter((t: any) => t.status === 'COMPLETED').length,
      overdue: allTasks.filter((t: any) =>
        t.dueDate &&
        new Date(t.dueDate) < now &&
        t.status !== 'COMPLETED' &&
        t.status !== 'CANCELLED'
      ).length,
    };
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadTasks = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(search.value && { search: search.value }),
      ...(selectedStatus.value && { status: selectedStatus.value }),
      ...(selectedPriority.value && { priority: selectedPriority.value }),
      ...(selectedAssignee.value && { assignedToId: selectedAssignee.value }),
    });

    const response = await api.get(`/tasks?${params.toString()}`);

    if (response.success) {
      tasks.value = response.data?.items || [];
      totalRecords.value = response.data?.pagination?.total || 0;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dei task',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadEmployees = async () => {
  try {
    const response = await api.get('/employees?limit=100&isActive=true');
    if (response.success) {
      employees.value = (response.data?.items || []).map((e: any) => ({
        label: `${e.user?.firstName || ''} ${e.user?.lastName || ''}`.trim(),
        value: e.id,
      }));
    }
  } catch (error) {
    console.error('Error loading employees:', error);
  }
};

const loadOrders = async () => {
  try {
    const response = await api.get('/orders?limit=100&status=PROCESSING,CONFIRMED');
    if (response.success) {
      orders.value = (response.data?.items || []).map((o: any) => ({
        label: `${o.orderNumber} - ${o.customer?.businessName || o.customer?.firstName || 'Cliente'}`,
        value: o.id,
      }));
    }
  } catch (error) {
    console.error('Error loading orders:', error);
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadTasks();
};

const onSort = (event: any) => {
  sortBy.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadTasks();
};

const openCreateDialog = () => {
  selectedTask.value = null;
  formData.value = {
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assignedToId: null,
    dueDate: null,
    estimatedHours: null,
    orderId: null,
  };
  showDialog.value = true;
};

const viewTask = (task: any) => {
  selectedTask.value = task;
  showDetailDialog.value = true;
};

const editTask = (task: any) => {
  selectedTask.value = task;
  formData.value = {
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assignedToId: task.assignedToId,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    estimatedHours: task.estimatedHours,
    orderId: task.orderId,
  };
  showDialog.value = true;
};

const editFromDetail = () => {
  showDetailDialog.value = false;
  editTask(selectedTask.value);
};

const completeTask = async (task: any) => {
  confirm.require({
    message: `Segnare come completato il task "${task.title}"?`,
    header: 'Conferma Completamento',
    icon: 'pi pi-check-circle',
    acceptLabel: 'Si, completa',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-success',
    accept: async () => {
      try {
        await api.patch(`/tasks/${task.id}`, { status: 'COMPLETED', completedDate: new Date().toISOString() });
        toast.add({
          severity: 'success',
          summary: 'Completato',
          detail: 'Task completato con successo',
          life: 3000,
        });
        loadTasks();
        loadStats();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message || 'Errore durante il completamento',
          life: 3000,
        });
      }
    },
  });
};

const completeFromDetail = () => {
  showDetailDialog.value = false;
  completeTask(selectedTask.value);
};

const deleteTask = (task: any) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare il task "${task.title}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Si, elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/tasks/${task.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminato',
          detail: 'Task eliminato con successo',
          life: 3000,
        });
        loadTasks();
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

const handleSave = async () => {
  try {
    // Validation
    if (!formData.value.title) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Il titolo è obbligatorio',
        life: 3000,
      });
      return;
    }

    saving.value = true;

    if (selectedTask.value?.id) {
      // Update
      await api.patch(`/tasks/${selectedTask.value.id}`, formData.value);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Task aggiornato con successo',
        life: 3000,
      });
    } else {
      // Create
      await api.post('/tasks', formData.value);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Task creato con successo',
        life: 3000,
      });
    }

    showDialog.value = false;
    loadTasks();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadTasks();
  loadEmployees();
  loadOrders();
  loadStats();
});
</script>

<style scoped>
.tasks-page {
  max-width: 1600px;
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
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
  align-items: center;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-gray-400);
  font-size: var(--font-size-sm);
}

.search-input {
  width: 100%;
  padding-left: var(--space-10) !important;
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
}

.w-full {
  width: 100%;
}

/* Table Styling */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
  vertical-align: middle;
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

.custom-table :deep(.p-paginator) {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
}

/* Cell Styles */
.task-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  color: var(--color-gray-900);
}

.overdue-icon {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.task-description {
  color: var(--color-gray-500);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignee-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.text-muted {
  color: var(--color-gray-400);
}

.overdue-date {
  color: var(--color-danger);
  font-weight: 600;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
}

.action-btn--view {
  color: var(--color-info) !important;
}

.action-btn--edit {
  color: var(--color-success) !important;
}

.action-btn--complete {
  color: var(--color-primary-600) !important;
}

.action-btn--delete {
  color: var(--color-danger) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 3rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state__text {
  color: var(--color-gray-500);
  margin-bottom: var(--space-4);
}

/* Form Grid */
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
  font-weight: 500;
  color: var(--color-gray-700);
  font-size: var(--font-size-sm);
}

/* Detail View */
.detail-view {
  padding: var(--space-4) 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.detail-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  color: var(--color-gray-900);
  flex: 1;
}

.detail-badges {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.detail-section {
  margin: var(--space-6) 0;
}

.detail-section h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-lg);
  color: var(--color-gray-700);
  margin-bottom: var(--space-4);
}

.detail-section h3 i {
  color: var(--color-primary-600);
}

.description-text {
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  color: var(--color-gray-700);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.detail-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-sm);
  color: var(--color-gray-900);
}

.order-link {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  border-left: 4px solid var(--color-primary-600);
}

.order-number {
  font-weight: 700;
  color: var(--color-primary-700);
}

.order-customer {
  color: var(--color-gray-500);
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

  .search-wrapper {
    min-width: 100%;
  }

  .filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-header {
    flex-direction: column;
    gap: var(--space-3);
  }
}
</style>
