<template>
  <div class="employees-page">
    <PageHeader
      title="Gestione Dipendenti"
      subtitle="Anagrafica dipendenti e timbrature"
      icon="pi pi-id-card"
    >
      <template #actions>
        <Button
          v-if="canManageEmployees"
          label="Nuovo Dipendente"
          icon="pi pi-plus"
          @click="openCreateDialog"
        />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Totale Dipendenti"
          :value="stats.total"
          icon="pi pi-users"
          variant="primary"
          format="number"
          subtitle="in anagrafica"
        />
        <StatsCard
          label="Dipendenti Attivi"
          :value="stats.active"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          :subtitle="`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% del totale`"
        />
        <StatsCard
          label="Dipendenti Inattivi"
          :value="stats.inactive"
          icon="pi pi-ban"
          variant="warning"
          format="number"
          subtitle="non operativi"
        />
      </div>
    </section>

    <!-- Table Section -->
    <section class="table-section">
      <div class="table-card">
        <DataTable
          :value="employees"
          :loading="loading"
          responsiveLayout="scroll"
          stripedRows
          class="custom-table"
          :rowHover="true"
        >
          <Column field="employeeCode" header="Codice" style="min-width: 120px">
            <template #body="{ data }">
              <span class="employee-code">{{ data.employeeCode }}</span>
            </template>
          </Column>
          <Column field="user.firstName" header="Nome" style="min-width: 200px">
            <template #body="{ data }">
              <div class="employee-name">{{ data.user?.firstName }} {{ data.user?.lastName }}</div>
              <div class="employee-email">{{ data.user?.email }}</div>
            </template>
          </Column>
          <Column field="position" header="Posizione" style="min-width: 150px">
            <template #body="{ data }">
              <span class="position-text">{{ data.position }}</span>
            </template>
          </Column>
          <!-- Colonna Costo Orario - visibile solo per ruoli autorizzati -->
          <Column v-if="canSeeCost" field="hourlyRate" header="Tariffa Oraria" style="min-width: 130px">
            <template #body="{ data }">
              <span class="hourly-rate">{{ formatCurrency(data.hourlyRate) }}/h</span>
            </template>
          </Column>
          <Column field="hireDate" header="Data Assunzione" style="min-width: 140px">
            <template #body="{ data }">
              <span class="hire-date">{{ formatDate(data.hireDate) }}</span>
            </template>
          </Column>
          <Column field="isActive" header="Stato" style="min-width: 100px">
            <template #body="{ data }">
              <Tag :severity="data.isActive ? 'success' : 'danger'" class="status-tag">
                {{ data.isActive ? 'Attivo' : 'Inattivo' }}
              </Tag>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 150px">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-clock"
                  class="p-button-rounded p-button-text action-btn action-btn--timesheet"
                  @click="viewTimesheet(data)"
                  v-tooltip.top="'Timbrature'"
                />
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewEmployee(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  v-if="canManageEmployees"
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="openEditDialog(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  v-if="canDeleteEmployee"
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="confirmDelete(data)"
                  v-tooltip.top="'Disattiva'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-users empty-state__icon"></i>
              <p class="empty-state__text">Nessun dipendente trovato</p>
              <Button
                v-if="canManageEmployees"
                label="Aggiungi dipendente"
                icon="pi pi-plus"
                @click="openCreateDialog"
              />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Employee Dialog (Create/Edit) -->
    <EmployeeDialog
      v-model="dialogVisible"
      :employee="selectedEmployee"
      @save="handleSave"
    />

    <!-- Employee Detail Dialog -->
    <EmployeeDetailDialog
      v-model="detailDialogVisible"
      :employee="selectedEmployee"
      @edit="handleEditFromDetail"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import ConfirmDialog from 'primevue/confirmdialog';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import { useAuthStore } from '../stores/auth.store';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import EmployeeDialog from '../components/EmployeeDialog.vue';
import EmployeeDetailDialog from '../components/EmployeeDetailDialog.vue';

const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const loading = ref(false);
const employees = ref([]);
const dialogVisible = ref(false);
const detailDialogVisible = ref(false);
const selectedEmployee = ref<any>(null);

// Permessi basati sul ruolo
const userRole = computed(() => (authStore.user as any)?.role || '');

const canSeeCost = computed(() => {
  return ['ADMIN', 'MANAGER', 'CONTABILE'].includes(userRole.value);
});

const canManageEmployees = computed(() => {
  return ['ADMIN', 'MANAGER'].includes(userRole.value);
});

const canDeleteEmployee = computed(() => {
  return userRole.value === 'ADMIN';
});

const stats = computed(() => {
  const total = employees.value.length;
  const active = employees.value.filter((e: any) => e.isActive).length;
  const inactive = total - active;
  return { total, active, inactive };
});

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

const loadEmployees = async () => {
  try {
    loading.value = true;
    const response = await api.get('/employees?page=1&limit=100');

    if (response.success) {
      employees.value = response.data?.items || [];
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dipendenti',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  selectedEmployee.value = null;
  dialogVisible.value = true;
};

const openEditDialog = (employee: any) => {
  selectedEmployee.value = employee;
  dialogVisible.value = true;
};

const handleSave = async (employeeData: any) => {
  try {
    if (employeeData.id) {
      // Update existing employee
      const { id, ...data } = employeeData;
      const response = await api.put(`/employees/${id}`, data);
      if (response.success) {
        toast.add({
          severity: 'success',
          summary: 'Successo',
          detail: 'Dipendente aggiornato con successo',
          life: 3000,
        });
        await loadEmployees();
      } else {
        throw new Error(response.error || 'Errore durante l\'aggiornamento');
      }
    } else {
      // Create new employee
      const response = await api.post('/employees', employeeData);
      if (response.success) {
        toast.add({
          severity: 'success',
          summary: 'Successo',
          detail: 'Dipendente creato con successo',
          life: 3000,
        });
        await loadEmployees();
      } else {
        throw new Error(response.error || 'Errore durante la creazione');
      }
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 5000,
    });
  }
};

const confirmDelete = (employee: any) => {
  confirm.require({
    message: `Sei sicuro di voler disattivare ${employee.user?.firstName} ${employee.user?.lastName}?`,
    header: 'Conferma Disattivazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Disattiva',
    rejectLabel: 'Annulla',
    accept: async () => {
      try {
        const response = await api.delete(`/employees/${employee.id}`);
        if (response.success) {
          toast.add({
            severity: 'success',
            summary: 'Successo',
            detail: 'Dipendente disattivato',
            life: 3000,
          });
          await loadEmployees();
        } else {
          throw new Error(response.error || 'Errore durante la disattivazione');
        }
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message,
          life: 5000,
        });
      }
    },
  });
};

const viewTimesheet = (employee: any) => {
  toast.add({
    severity: 'info',
    summary: 'Timbrature',
    detail: `Visualizzazione timbrature per ${employee.user?.firstName} ${employee.user?.lastName} - In sviluppo`,
    life: 3000,
  });
};

const viewEmployee = (employee: any) => {
  selectedEmployee.value = employee;
  detailDialogVisible.value = true;
};

const handleEditFromDetail = (employee: any) => {
  detailDialogVisible.value = false;
  selectedEmployee.value = employee;
  dialogVisible.value = true;
};

onMounted(() => {
  loadEmployees();
});
</script>

<style scoped>
.employees-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
.employee-code {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.employee-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.employee-email {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-top: 2px;
}

.position-text {
  color: var(--color-gray-700);
}

.hourly-rate {
  font-weight: 600;
  color: var(--color-success);
}

.hire-date {
  color: var(--color-gray-600);
}

.status-tag {
  font-size: var(--font-size-xs);
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

.action-btn--timesheet {
  color: var(--color-primary-600) !important;
}

.action-btn--view {
  color: var(--color-info) !important;
}

.action-btn--edit {
  color: var(--color-warning) !important;
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

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
