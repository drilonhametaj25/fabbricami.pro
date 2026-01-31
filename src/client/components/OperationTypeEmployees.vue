<template>
  <Dialog
    v-model:visible="visible"
    :header="`Operatori Qualificati - ${operationType?.name || ''}`"
    :modal="true"
    :style="{ width: '700px', maxWidth: '95vw' }"
    @hide="onHide"
  >
    <div class="employees-manager">
      <!-- Header con info costo medio -->
      <div class="cost-summary" v-if="canSeeCost">
        <div class="cost-card">
          <span class="cost-label">Costo Orario Fase</span>
          <span class="cost-value" :class="{ 'from-default': hourlyRateInfo.source === 'default' }">
            {{ hourlyRateInfo.averageHourlyRate !== null ? formatCurrency(hourlyRateInfo.averageHourlyRate) : '-' }}/h
          </span>
          <span class="cost-source">
            <template v-if="hourlyRateInfo.source === 'employees'">
              Media da {{ hourlyRateInfo.employeeCount }} operatori
            </template>
            <template v-else-if="hourlyRateInfo.source === 'default'">
              Tariffa default (nessun operatore)
            </template>
            <template v-else>
              Nessuna tariffa definita
            </template>
          </span>
        </div>
      </div>

      <!-- Add Employee Section -->
      <div class="add-employee-section" v-if="canManage">
        <div class="add-employee-form">
          <Dropdown
            v-model="selectedEmployeeId"
            :options="availableEmployees"
            optionLabel="displayName"
            optionValue="id"
            placeholder="Seleziona dipendente da aggiungere..."
            class="flex-1"
            filter
            filterPlaceholder="Cerca dipendente..."
            :loading="loadingEmployees"
            emptyMessage="Nessun dipendente disponibile"
          >
            <template #option="{ option }">
              <div class="employee-option">
                <span class="employee-name">{{ option.displayName }}</span>
                <span class="employee-position" v-if="option.position">{{ option.position }}</span>
              </div>
            </template>
          </Dropdown>
          <div class="flex items-center gap-2 ml-2">
            <Checkbox v-model="isPrimaryNew" binary inputId="isPrimaryNew" />
            <label for="isPrimaryNew" class="text-sm whitespace-nowrap">Primario</label>
          </div>
          <Button
            icon="pi pi-plus"
            class="ml-2"
            @click="addEmployee"
            :loading="adding"
            :disabled="!selectedEmployeeId"
          />
        </div>
      </div>

      <!-- Qualified Employees List -->
      <div class="employees-list">
        <DataTable
          :value="qualifiedEmployees"
          :loading="loading"
          responsiveLayout="scroll"
          class="p-datatable-sm"
          stripedRows
        >
          <Column header="Dipendente" style="min-width: 200px">
            <template #body="{ data }">
              <div class="employee-cell">
                <span class="employee-name">
                  {{ data.employee?.user?.firstName }} {{ data.employee?.user?.lastName }}
                </span>
                <span class="employee-email">{{ data.employee?.user?.email }}</span>
              </div>
            </template>
          </Column>

          <Column header="Posizione" style="min-width: 120px">
            <template #body="{ data }">
              {{ data.employee?.position || '-' }}
            </template>
          </Column>

          <Column v-if="canSeeCost" header="Costo Orario" style="min-width: 120px">
            <template #body="{ data }">
              <span class="hourly-rate">
                {{ data.employee?.hourlyRate ? formatCurrency(data.employee.hourlyRate) : '-' }}/h
              </span>
            </template>
          </Column>

          <Column header="Primario" style="width: 100px">
            <template #body="{ data }">
              <Checkbox
                v-if="canManage"
                :modelValue="data.isPrimary"
                binary
                @update:modelValue="togglePrimary(data, $event)"
                :disabled="updatingPrimary === data.employeeId"
              />
              <i v-else-if="data.isPrimary" class="pi pi-star-fill text-yellow-500" />
              <span v-else>-</span>
            </template>
          </Column>

          <Column header="Certificato il" style="min-width: 120px">
            <template #body="{ data }">
              {{ formatDate(data.certifiedAt) }}
            </template>
          </Column>

          <Column v-if="canManage" header="Azioni" style="width: 80px">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger p-button-sm"
                @click="confirmRemove(data)"
                v-tooltip.top="'Rimuovi'"
                :loading="removing === data.employeeId"
              />
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-users empty-icon"></i>
              <p>Nessun operatore qualificato per questa fase</p>
              <small>Aggiungi operatori per calcolare il costo orario medio</small>
            </div>
          </template>
        </DataTable>
      </div>
    </div>

    <template #footer>
      <Button label="Chiudi" icon="pi pi-times" class="p-button-text" @click="visible = false" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import { useAuthStore } from '../stores/auth.store';

interface Props {
  modelValue: boolean;
  operationType?: any;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'updated'): void;
}

const props = withDefaults(defineProps<Props>(), {
  operationType: null
});

const emit = defineEmits<Emits>();
const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const visible = ref(props.modelValue);
const loading = ref(false);
const loadingEmployees = ref(false);
const adding = ref(false);
const removing = ref<string | null>(null);
const updatingPrimary = ref<string | null>(null);

const qualifiedEmployees = ref<any[]>([]);
const allEmployees = ref<any[]>([]);
const selectedEmployeeId = ref<string | null>(null);
const isPrimaryNew = ref(false);

const hourlyRateInfo = ref({
  averageHourlyRate: null as number | null,
  employeeCount: 0,
  source: 'none' as 'employees' | 'default' | 'none'
});

// Permessi basati sul ruolo
const userRole = computed(() => (authStore.user as any)?.role || '');

const canSeeCost = computed(() => {
  return ['ADMIN', 'MANAGER', 'CONTABILE'].includes(userRole.value);
});

const canManage = computed(() => {
  return ['ADMIN', 'MANAGER'].includes(userRole.value);
});

// Dipendenti disponibili (non già qualificati)
const availableEmployees = computed(() => {
  const qualifiedIds = new Set(qualifiedEmployees.value.map(qe => qe.employeeId));
  return allEmployees.value
    .filter(emp => !qualifiedIds.has(emp.id))
    .map(emp => ({
      ...emp,
      displayName: `${emp.user?.firstName} ${emp.user?.lastName}`,
    }));
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

const loadQualifiedEmployees = async () => {
  if (!props.operationType?.id) return;

  loading.value = true;
  try {
    const response = await api.get(`/operation-types/${props.operationType.id}/employees`);
    if (response.success) {
      qualifiedEmployees.value = response.data || [];
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento operatori',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadHourlyRate = async () => {
  if (!props.operationType?.id || !canSeeCost.value) return;

  try {
    const response = await api.get(`/operation-types/${props.operationType.id}/hourly-rate`);
    if (response.success) {
      hourlyRateInfo.value = response.data;
    }
  } catch (error) {
    // Ignora errori, usa valori default
    hourlyRateInfo.value = {
      averageHourlyRate: null,
      employeeCount: 0,
      source: 'none'
    };
  }
};

const loadAllEmployees = async () => {
  loadingEmployees.value = true;
  try {
    const response = await api.get('/employees?page=1&limit=100&isActive=true');
    if (response.success) {
      allEmployees.value = response.data?.items || [];
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dipendenti',
      life: 3000,
    });
  } finally {
    loadingEmployees.value = false;
  }
};

const addEmployee = async () => {
  if (!selectedEmployeeId.value || !props.operationType?.id) return;

  adding.value = true;
  try {
    const response = await api.post(`/operation-types/${props.operationType.id}/employees`, {
      employeeId: selectedEmployeeId.value,
      isPrimary: isPrimaryNew.value,
    });

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: 'Operatore aggiunto',
        life: 3000,
      });
      selectedEmployeeId.value = null;
      isPrimaryNew.value = false;
      await Promise.all([loadQualifiedEmployees(), loadHourlyRate()]);
      emit('updated');
    } else {
      throw new Error(response.error || 'Errore nell\'aggiunta');
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nell\'aggiunta operatore',
      life: 3000,
    });
  } finally {
    adding.value = false;
  }
};

const confirmRemove = (qualified: any) => {
  const name = `${qualified.employee?.user?.firstName} ${qualified.employee?.user?.lastName}`;
  confirm.require({
    message: `Rimuovere ${name} dagli operatori qualificati?`,
    header: 'Conferma Rimozione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Rimuovi',
    rejectLabel: 'Annulla',
    accept: () => removeEmployee(qualified.employeeId),
  });
};

const removeEmployee = async (employeeId: string) => {
  if (!props.operationType?.id) return;

  removing.value = employeeId;
  try {
    const response = await api.delete(`/operation-types/${props.operationType.id}/employees/${employeeId}`);
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: 'Operatore rimosso',
        life: 3000,
      });
      await Promise.all([loadQualifiedEmployees(), loadHourlyRate()]);
      emit('updated');
    } else {
      throw new Error(response.error || 'Errore nella rimozione');
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nella rimozione operatore',
      life: 3000,
    });
  } finally {
    removing.value = null;
  }
};

const togglePrimary = async (qualified: any, isPrimary: boolean) => {
  if (!props.operationType?.id) return;

  updatingPrimary.value = qualified.employeeId;
  try {
    const response = await api.patch(
      `/operation-types/${props.operationType.id}/employees/${qualified.employeeId}`,
      { isPrimary }
    );
    if (response.success) {
      await loadQualifiedEmployees();
    } else {
      throw new Error(response.error || 'Errore nell\'aggiornamento');
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nell\'aggiornamento',
      life: 3000,
    });
  } finally {
    updatingPrimary.value = null;
  }
};

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val && props.operationType?.id) {
    loadQualifiedEmployees();
    loadHourlyRate();
    loadAllEmployees();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const onHide = () => {
  qualifiedEmployees.value = [];
  selectedEmployeeId.value = null;
  isPrimaryNew.value = false;
};
</script>

<style scoped>
.employees-manager {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Cost Summary */
.cost-summary {
  margin-bottom: 0.5rem;
}

.cost-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.cost-label {
  font-size: 0.8rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cost-value {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0.25rem 0;
}

.cost-value.from-default {
  opacity: 0.8;
}

.cost-source {
  font-size: 0.75rem;
  opacity: 0.8;
}

/* Add Employee Section */
.add-employee-section {
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.add-employee-form {
  display: flex;
  align-items: center;
}

.add-employee-form .flex-1 {
  flex: 1;
}

/* Employee Option in Dropdown */
.employee-option {
  display: flex;
  flex-direction: column;
}

.employee-option .employee-name {
  font-weight: 500;
}

.employee-option .employee-position {
  font-size: 0.8rem;
  color: #64748b;
}

/* Employees List */
.employees-list {
  max-height: 400px;
  overflow-y: auto;
}

.employee-cell {
  display: flex;
  flex-direction: column;
}

.employee-cell .employee-name {
  font-weight: 500;
  color: #1e293b;
}

.employee-cell .employee-email {
  font-size: 0.8rem;
  color: #64748b;
}

.hourly-rate {
  font-weight: 600;
  color: #059669;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  color: #64748b;
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.empty-state p {
  margin: 0.25rem 0;
}

.empty-state small {
  font-size: 0.8rem;
  opacity: 0.7;
}

/* Utilities */
.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.whitespace-nowrap {
  white-space: nowrap;
}

.text-sm {
  font-size: 0.875rem;
}
</style>
