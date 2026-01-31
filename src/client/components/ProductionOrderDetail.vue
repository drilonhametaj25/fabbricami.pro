<template>
  <div class="production-order-detail">
    <!-- Order Info Header -->
    <div class="order-header">
      <div class="header-info">
        <div class="info-row">
          <div class="info-item">
            <span class="info-label">Prodotto</span>
            <span class="info-value">{{ order.product?.name }}</span>
            <span class="info-sub">{{ order.product?.sku }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Quantità</span>
            <span class="info-value large">{{ order.quantity }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Stato</span>
            <Tag :severity="getStatusSeverity(order.status)" :value="getStatusLabel(order.status)" />
          </div>
          <div class="info-item">
            <span class="info-label">Priorità</span>
            <Tag :severity="getPrioritySeverity(order.priority)" :value="getPriorityLabel(order.priority)" />
          </div>
        </div>
        <div class="info-row">
          <div class="info-item">
            <span class="info-label">Data Inizio Prevista</span>
            <span class="info-value">{{ formatDate(order.plannedStartDate) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Fine Prevista</span>
            <span class="info-value">{{ formatDate(order.plannedEndDate) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Inizio Effettiva</span>
            <span class="info-value">{{ formatDate(order.actualStartDate) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data Fine Effettiva</span>
            <span class="info-value">{{ formatDate(order.actualEndDate) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Overview -->
    <div class="progress-overview">
      <div class="progress-header">
        <span class="progress-title">Avanzamento Produzione</span>
        <span class="progress-percentage">{{ calculateOverallProgress() }}%</span>
      </div>
      <ProgressBar :value="calculateOverallProgress()" class="main-progress" />
      <div class="progress-stats">
        <div class="stat">
          <span class="stat-value">{{ completedPhases }}</span>
          <span class="stat-label">Completate</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ inProgressPhases }}</span>
          <span class="stat-label">In Corso</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ pendingPhases }}</span>
          <span class="stat-label">In Attesa</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ totalPhases }}</span>
          <span class="stat-label">Totale Fasi</span>
        </div>
      </div>
    </div>

    <!-- Cost Summary (role-based) -->
    <div class="cost-summary" v-if="canSeeCost">
      <div class="cost-header">
        <i class="pi pi-euro"></i>
        <span>Riepilogo Costi</span>
      </div>
      <div class="cost-grid">
        <div class="cost-item">
          <span class="cost-label">Manodopera</span>
          <span class="cost-value">{{ formatCurrency(calculateTotalLaborCost()) }}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">Materiali</span>
          <span class="cost-value">{{ formatCurrency(calculateTotalMaterialCost()) }}</span>
        </div>
        <div class="cost-item">
          <span class="cost-label">Esterni</span>
          <span class="cost-value">{{ formatCurrency(calculateTotalExternalCost()) }}</span>
        </div>
        <div class="cost-item total">
          <span class="cost-label">Totale</span>
          <span class="cost-value">{{ formatCurrency(calculateTotalCost()) }}</span>
        </div>
      </div>
    </div>

    <!-- Phases Timeline -->
    <div class="phases-section">
      <div class="section-header">
        <h3><i class="pi pi-list"></i> Fasi di Lavorazione</h3>
      </div>

      <Timeline :value="sortedPhases" align="alternate" class="phases-timeline">
        <template #marker="{ item }">
          <span class="phase-marker" :class="getPhaseMarkerClass(item)">
            <i :class="getPhaseIcon(item)"></i>
          </span>
        </template>
        <template #content="{ item }">
          <div class="phase-card" :class="{ active: item.status === 'IN_PROGRESS' }">
            <div class="phase-header">
              <span class="phase-sequence">#{{ item.sequence }}</span>
              <span class="phase-name">{{ item.manufacturingPhase?.name }}</span>
              <Tag
                :severity="getPhaseStatusSeverity(item.status)"
                :value="getPhaseStatusLabel(item.status)"
                class="phase-tag"
              />
            </div>

            <div class="phase-details">
              <div class="detail-row" v-if="item.manufacturingPhase?.operationType">
                <i class="pi pi-cog"></i>
                <span>{{ item.manufacturingPhase.operationType.name }}</span>
                <Tag
                  v-if="item.manufacturingPhase.operationType.isExternal"
                  severity="info"
                  value="Esterno"
                  class="ml-2"
                />
              </div>

              <div class="detail-row" v-if="item.assignedEmployee">
                <i class="pi pi-user"></i>
                <span>{{ item.assignedEmployee.user?.firstName }} {{ item.assignedEmployee.user?.lastName }}</span>
              </div>

              <div class="detail-row times">
                <div class="time-item" v-if="item.manufacturingPhase">
                  <span class="time-label">Standard:</span>
                  <span class="time-value">{{ item.manufacturingPhase.standardTime }} min</span>
                </div>
                <div class="time-item" v-if="item.actualTime">
                  <span class="time-label">Effettivo:</span>
                  <span class="time-value">{{ item.actualTime }} min</span>
                </div>
              </div>

              <div class="detail-row dates" v-if="item.startedAt || item.completedAt">
                <div class="date-item" v-if="item.startedAt">
                  <span class="date-label">Iniziata:</span>
                  <span class="date-value">{{ formatDateTime(item.startedAt) }}</span>
                </div>
                <div class="date-item" v-if="item.completedAt">
                  <span class="date-label">Completata:</span>
                  <span class="date-value">{{ formatDateTime(item.completedAt) }}</span>
                </div>
              </div>

              <!-- Costs (role-based) -->
              <div class="detail-row costs" v-if="canSeeCost && (item.laborCost || item.materialCost || item.externalCost)">
                <div class="cost-badge" v-if="item.laborCost">
                  <i class="pi pi-user"></i>
                  {{ formatCurrency(item.laborCost) }}
                </div>
                <div class="cost-badge" v-if="item.materialCost">
                  <i class="pi pi-box"></i>
                  {{ formatCurrency(item.materialCost) }}
                </div>
                <div class="cost-badge" v-if="item.externalCost">
                  <i class="pi pi-external-link"></i>
                  {{ formatCurrency(item.externalCost) }}
                </div>
              </div>

              <!-- Materials consumed -->
              <div class="materials-section" v-if="item.materialConsumptions && item.materialConsumptions.length > 0">
                <div class="materials-header">
                  <i class="pi pi-box"></i>
                  <span>Materiali Consumati</span>
                </div>
                <div class="materials-list">
                  <div class="material-item" v-for="mc in item.materialConsumptions" :key="mc.id">
                    <span class="material-name">{{ mc.material?.name }}</span>
                    <span class="material-qty">{{ mc.quantity }} {{ mc.unit }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Phase Actions -->
            <div class="phase-actions" v-if="canManage">
              <Button
                v-if="item.status === 'PENDING' && canStartPhase(item)"
                label="Avvia Fase"
                icon="pi pi-play"
                class="p-button-sm p-button-success"
                @click="startPhase(item)"
                :loading="actionLoading === item.id"
              />
              <Button
                v-if="item.status === 'IN_PROGRESS'"
                label="Completa"
                icon="pi pi-check"
                class="p-button-sm"
                @click="openCompleteDialog(item)"
              />
              <Button
                v-if="item.status === 'PENDING'"
                label="Assegna"
                icon="pi pi-user-plus"
                class="p-button-sm p-button-outlined"
                @click="openAssignDialog(item)"
              />
            </div>
          </div>
        </template>
      </Timeline>
    </div>

    <!-- Notes -->
    <div class="notes-section" v-if="order.notes">
      <div class="section-header">
        <h3><i class="pi pi-comment"></i> Note</h3>
      </div>
      <div class="notes-content">
        {{ order.notes }}
      </div>
    </div>

    <!-- Complete Phase Dialog -->
    <Dialog
      v-model:visible="showCompleteDialog"
      header="Completa Fase"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="dialog-form">
        <p>Stai completando la fase: <strong>{{ phaseToComplete?.manufacturingPhase?.name }}</strong></p>
        <div class="form-field">
          <label for="actualTime">Tempo Effettivo (minuti)</label>
          <InputNumber
            id="actualTime"
            v-model="completeForm.actualTime"
            :min="1"
            class="w-full"
            :placeholder="`Standard: ${phaseToComplete?.manufacturingPhase?.standardTime} min`"
          />
          <small class="hint">Lascia vuoto per usare il tempo standard</small>
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showCompleteDialog = false" />
        <Button label="Completa" icon="pi pi-check" @click="confirmComplete" :loading="completing" />
      </template>
    </Dialog>

    <!-- Assign Employee Dialog -->
    <Dialog
      v-model:visible="showAssignDialog"
      header="Assegna Operatore"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="dialog-form">
        <p>Assegna un operatore alla fase: <strong>{{ phaseToAssign?.manufacturingPhase?.name }}</strong></p>
        <div class="form-field">
          <label for="employee">Operatore</label>
          <Dropdown
            id="employee"
            v-model="assignForm.employeeId"
            :options="qualifiedEmployees"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona operatore"
            class="w-full"
            filter
          />
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showAssignDialog = false" />
        <Button label="Assegna e Avvia" icon="pi pi-play" @click="confirmAssign" :loading="assigning" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

// PrimeVue components
import Tag from 'primevue/tag';
import ProgressBar from 'primevue/progressbar';
import Timeline from 'primevue/timeline';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';

interface ProductionPhase {
  id: string;
  sequence: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  actualTime: number | null;
  laborCost: number | null;
  materialCost: number | null;
  externalCost: number | null;
  assignedEmployeeId: string | null;
  manufacturingPhase?: {
    id: string;
    name: string;
    standardTime: number;
    setupTime: number;
    externalCostPerUnit: number | null;
    operationType?: {
      id: string;
      name: string;
      code: string;
      isExternal: boolean;
    };
    materials?: Array<{
      material: { id: string; name: string };
      quantity: number;
      unit: string;
    }>;
  };
  assignedEmployee?: {
    id: string;
    user?: {
      firstName: string;
      lastName: string;
    };
  };
  materialConsumptions?: Array<{
    id: string;
    quantity: number;
    unit: string;
    material?: { id: string; name: string };
  }>;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  priority: number;
  quantity: number;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  phases?: ProductionPhase[];
}

const props = defineProps<{
  order: ProductionOrder;
}>();

const emit = defineEmits(['phase-started', 'phase-completed', 'refresh']);

const authStore = useAuthStore();
const toast = useToast();

// State
const actionLoading = ref<string | null>(null);
const showCompleteDialog = ref(false);
const showAssignDialog = ref(false);
const phaseToComplete = ref<ProductionPhase | null>(null);
const phaseToAssign = ref<ProductionPhase | null>(null);
const completing = ref(false);
const assigning = ref(false);
const qualifiedEmployees = ref<Array<{ label: string; value: string }>>([]);

const completeForm = ref({
  actualTime: null as number | null,
});

const assignForm = ref({
  employeeId: '',
});

// Computed
const canSeeCost = computed(() => {
  const user = authStore.user as any;
  return user && ['ADMIN', 'MANAGER', 'CONTABILE'].includes(user.role);
});

const canManage = computed(() => {
  const user = authStore.user as any;
  return user && ['ADMIN', 'MANAGER', 'OPERATORE'].includes(user.role);
});

const sortedPhases = computed(() => {
  if (!props.order.phases) return [];
  return [...props.order.phases].sort((a, b) => a.sequence - b.sequence);
});

const totalPhases = computed(() => props.order.phases?.length || 0);
const completedPhases = computed(
  () => props.order.phases?.filter((p) => p.status === 'COMPLETED' || p.status === 'SKIPPED').length || 0
);
const inProgressPhases = computed(
  () => props.order.phases?.filter((p) => p.status === 'IN_PROGRESS').length || 0
);
const pendingPhases = computed(
  () => props.order.phases?.filter((p) => p.status === 'PENDING').length || 0
);

// Methods
const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    PLANNED: 'info',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'secondary';
};

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'Bozza',
    PLANNED: 'Pianificato',
    IN_PROGRESS: 'In Lavorazione',
    COMPLETED: 'Completato',
    CANCELLED: 'Annullato',
  };
  return map[status] || status;
};

const getPrioritySeverity = (priority: number) => {
  if (priority >= 3) return 'danger';
  if (priority >= 2) return 'warning';
  if (priority >= 1) return 'info';
  return 'secondary';
};

const getPriorityLabel = (priority: number) => {
  const map: Record<number, string> = {
    0: 'Bassa',
    1: 'Normale',
    2: 'Alta',
    3: 'Urgente',
  };
  return map[priority] || 'Normale';
};

const getPhaseStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'secondary',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    SKIPPED: 'info',
  };
  return map[status] || 'secondary';
};

const getPhaseStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'In Attesa',
    IN_PROGRESS: 'In Corso',
    COMPLETED: 'Completata',
    SKIPPED: 'Saltata',
  };
  return map[status] || status;
};

const getPhaseMarkerClass = (phase: ProductionPhase) => {
  return {
    pending: phase.status === 'PENDING',
    'in-progress': phase.status === 'IN_PROGRESS',
    completed: phase.status === 'COMPLETED',
    skipped: phase.status === 'SKIPPED',
  };
};

const getPhaseIcon = (phase: ProductionPhase) => {
  const map: Record<string, string> = {
    PENDING: 'pi pi-clock',
    IN_PROGRESS: 'pi pi-spin pi-spinner',
    COMPLETED: 'pi pi-check',
    SKIPPED: 'pi pi-forward',
  };
  return map[phase.status] || 'pi pi-circle';
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value));
};

const calculateOverallProgress = () => {
  if (totalPhases.value === 0) return 0;
  return Math.round((completedPhases.value / totalPhases.value) * 100);
};

const calculateTotalLaborCost = () => {
  return props.order.phases?.reduce((sum, p) => sum + Number(p.laborCost || 0), 0) || 0;
};

const calculateTotalMaterialCost = () => {
  return props.order.phases?.reduce((sum, p) => sum + Number(p.materialCost || 0), 0) || 0;
};

const calculateTotalExternalCost = () => {
  return props.order.phases?.reduce((sum, p) => sum + Number(p.externalCost || 0), 0) || 0;
};

const calculateTotalCost = () => {
  return calculateTotalLaborCost() + calculateTotalMaterialCost() + calculateTotalExternalCost();
};

const canStartPhase = (phase: ProductionPhase) => {
  // Can start if all previous phases are completed
  const phases = sortedPhases.value;
  const phaseIndex = phases.findIndex((p) => p.id === phase.id);
  if (phaseIndex === 0) return true;

  const previousPhase = phases[phaseIndex - 1];
  return previousPhase.status === 'COMPLETED' || previousPhase.status === 'SKIPPED';
};

// Actions
const startPhase = async (phase: ProductionPhase) => {
  actionLoading.value = phase.id;
  try {
    await api.post(`/manufacturing/production-phases/${phase.id}/start`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Fase avviata',
      life: 3000,
    });
    emit('phase-started');
    emit('refresh');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || "Errore nell'avvio fase",
      life: 3000,
    });
  } finally {
    actionLoading.value = null;
  }
};

const openCompleteDialog = (phase: ProductionPhase) => {
  phaseToComplete.value = phase;
  completeForm.value.actualTime = null;
  showCompleteDialog.value = true;
};

const confirmComplete = async () => {
  if (!phaseToComplete.value) return;

  completing.value = true;
  try {
    await api.post(`/manufacturing/production-phases/${phaseToComplete.value.id}/complete`, {
      actualTime: completeForm.value.actualTime || undefined,
    });

    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Fase completata',
      life: 3000,
    });

    showCompleteDialog.value = false;
    emit('phase-completed');
    emit('refresh');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel completamento fase',
      life: 3000,
    });
  } finally {
    completing.value = false;
  }
};

const openAssignDialog = async (phase: ProductionPhase) => {
  phaseToAssign.value = phase;
  assignForm.value.employeeId = '';

  // Load qualified employees for this operation type
  if (phase.manufacturingPhase?.operationType?.id) {
    try {
      const response = await api.get(
        `/operation-types/${phase.manufacturingPhase.operationType.id}/employees`
      );
      qualifiedEmployees.value = response.data.data.map((e: any) => ({
        label: `${e.employee.user?.firstName} ${e.employee.user?.lastName}`,
        value: e.employeeId,
      }));
    } catch (error) {
      // Fallback to all employees
      try {
        const response = await api.get('/employees?limit=100');
        qualifiedEmployees.value = response.data.data.map((e: any) => ({
          label: `${e.user?.firstName} ${e.user?.lastName}`,
          value: e.id,
        }));
      } catch {
        qualifiedEmployees.value = [];
      }
    }
  }

  showAssignDialog.value = true;
};

const confirmAssign = async () => {
  if (!phaseToAssign.value) return;

  assigning.value = true;
  try {
    await api.post(`/manufacturing/production-phases/${phaseToAssign.value.id}/start`, {
      employeeId: assignForm.value.employeeId || undefined,
    });

    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Operatore assegnato e fase avviata',
      life: 3000,
    });

    showAssignDialog.value = false;
    emit('phase-started');
    emit('refresh');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || "Errore nell'assegnazione",
      life: 3000,
    });
  } finally {
    assigning.value = false;
  }
};
</script>

<style scoped>
.production-order-detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.order-header {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1rem;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 768px) {
  .info-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.info-value {
  font-weight: 600;
}

.info-value.large {
  font-size: 1.5rem;
}

.info-sub {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-color-secondary);
}

.progress-overview {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-title {
  font-weight: 600;
}

.progress-percentage {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-color);
}

.main-progress {
  height: 12px;
  margin-bottom: 1rem;
}

.progress-stats {
  display: flex;
  justify-content: space-around;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.cost-summary {
  background: linear-gradient(135deg, var(--primary-50), var(--surface-card));
  border: 1px solid var(--primary-200);
  border-radius: 8px;
  padding: 1rem;
}

.cost-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.cost-header i {
  color: var(--primary-color);
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 600px) {
  .cost-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.cost-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cost-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.cost-value {
  font-weight: 600;
  font-size: 1rem;
}

.cost-item.total .cost-value {
  color: var(--primary-color);
  font-size: 1.25rem;
}

.section-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.section-header h3 i {
  color: var(--primary-color);
}

.phases-timeline :deep(.p-timeline-event-opposite) {
  display: none;
}

.phases-timeline :deep(.p-timeline-event-content) {
  padding-bottom: 1.5rem;
}

.phase-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--surface-200);
  color: var(--text-color-secondary);
}

.phase-marker.pending {
  background: var(--surface-200);
}

.phase-marker.in-progress {
  background: var(--yellow-100);
  color: var(--yellow-700);
}

.phase-marker.completed {
  background: var(--green-100);
  color: var(--green-700);
}

.phase-marker.skipped {
  background: var(--blue-100);
  color: var(--blue-700);
}

.phase-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.phase-card.active {
  border-color: var(--yellow-500);
  box-shadow: 0 0 0 2px var(--yellow-100);
}

.phase-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.phase-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.phase-sequence {
  font-weight: 700;
  color: var(--primary-color);
}

.phase-name {
  font-weight: 600;
  flex: 1;
}

.phase-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.detail-row i {
  width: 1rem;
  text-align: center;
}

.detail-row.times,
.detail-row.dates {
  flex-wrap: wrap;
  gap: 1rem;
}

.detail-row.costs {
  margin-top: 0.5rem;
  gap: 0.75rem;
}

.time-item,
.date-item {
  display: flex;
  gap: 0.25rem;
}

.time-label,
.date-label {
  color: var(--text-color-secondary);
}

.time-value,
.date-value {
  font-weight: 500;
  color: var(--text-color);
}

.cost-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--surface-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.materials-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border);
}

.materials-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
}

.materials-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.material-item {
  background: var(--surface-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.material-name {
  color: var(--text-color);
}

.material-qty {
  font-weight: 600;
  color: var(--primary-color);
}

.phase-actions {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border);
  display: flex;
  gap: 0.5rem;
}

.notes-section .section-header h3 {
  margin: 0 0 0.75rem 0;
}

.notes-content {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1rem;
  white-space: pre-wrap;
  font-size: 0.875rem;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.w-full {
  width: 100%;
}

.ml-2 {
  margin-left: 0.5rem;
}
</style>
