<template>
  <div class="product-phases">
    <div class="phases-header">
      <p class="phases-description">
        Definisci la pipeline produttiva: le fasi di lavorazione necessarie per realizzare questo prodotto.
      </p>
      <Button
        label="Aggiungi Fase"
        icon="pi pi-plus"
        size="small"
        @click="openAddPhase"
        :disabled="!productId"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>

    <!-- Empty State -->
    <div v-else-if="phases.length === 0" class="empty-state">
      <i class="pi pi-sitemap"></i>
      <p>Nessuna fase di lavorazione definita</p>
      <small>Aggiungi le fasi della pipeline produttiva per questo prodotto</small>
    </div>

    <!-- Phases Pipeline -->
    <div v-else class="phases-pipeline">
      <div
        v-for="(phase, index) in phases"
        :key="phase.id"
        class="phase-card"
        :class="{ inactive: !phase.isActive }"
      >
        <div class="phase-sequence">
          <span class="sequence-number">{{ phase.sequence }}</span>
          <div class="sequence-arrows" v-if="phases.length > 1">
            <Button
              icon="pi pi-chevron-up"
              class="p-button-text p-button-sm"
              :disabled="index === 0"
              @click="movePhase(phase, 'up')"
              v-tooltip="'Sposta su'"
            />
            <Button
              icon="pi pi-chevron-down"
              class="p-button-text p-button-sm"
              :disabled="index === phases.length - 1"
              @click="movePhase(phase, 'down')"
              v-tooltip="'Sposta giu'"
            />
          </div>
        </div>

        <div class="phase-content">
          <div class="phase-header">
            <div class="phase-title">
              <h4>{{ phase.name }}</h4>
              <Tag
                :value="phase.operationType.name"
                :severity="phase.operationType.isExternal ? 'warning' : 'info'"
                class="operation-tag"
              />
            </div>
            <div class="phase-actions">
              <Button
                icon="pi pi-pencil"
                class="p-button-text p-button-sm"
                @click="editPhase(phase)"
                v-tooltip="'Modifica'"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-sm p-button-danger"
                @click="confirmDelete(phase)"
                v-tooltip="'Elimina'"
              />
            </div>
          </div>

          <p v-if="phase.description" class="phase-description">{{ phase.description }}</p>

          <div class="phase-details">
            <div class="detail-item">
              <i class="pi pi-clock"></i>
              <span>{{ formatTime(phase.standardTime) }}</span>
              <small>lavorazione</small>
            </div>
            <div class="detail-item" v-if="phase.setupTime > 0">
              <i class="pi pi-cog"></i>
              <span>{{ formatTime(phase.setupTime) }}</span>
              <small>setup</small>
            </div>
            <div class="detail-item" v-if="phase.externalSupplier">
              <i class="pi pi-building"></i>
              <span>{{ phase.externalSupplier.name }}</span>
              <small>terzista</small>
            </div>
            <div class="detail-item" v-if="phase.externalCostPerUnit">
              <i class="pi pi-euro"></i>
              <span>{{ formatCurrency(phase.externalCostPerUnit) }}</span>
              <small>costo/unita</small>
            </div>
          </div>

          <!-- Materials for this phase -->
          <div v-if="phase.materials?.length > 0" class="phase-materials">
            <span class="materials-label">Materiali:</span>
            <div class="materials-list">
              <Tag
                v-for="pm in phase.materials"
                :key="pm.id"
                :value="`${pm.material.name} (${pm.quantity} ${pm.unit})`"
                severity="secondary"
              />
            </div>
          </div>
        </div>

        <!-- Arrow to next phase -->
        <div v-if="index < phases.length - 1" class="phase-arrow">
          <i class="pi pi-arrow-down"></i>
        </div>
      </div>

      <!-- Cost Summary (only for authorized roles) -->
      <div class="cost-summary" v-if="canSeeCost && costData">
        <div class="cost-header">
          <h4>Riepilogo Costi Produzione</h4>
          <Button
            icon="pi pi-refresh"
            class="p-button-text p-button-sm"
            @click="loadCosts"
            :loading="loadingCosts"
            v-tooltip="'Aggiorna costi'"
          />
        </div>

        <div class="cost-grid">
          <div class="cost-item">
            <i class="pi pi-users"></i>
            <div class="cost-details">
              <span class="cost-value">{{ formatCurrency(costData.laborCost) }}</span>
              <span class="cost-label">Costo Fasi</span>
            </div>
          </div>
          <div class="cost-item">
            <i class="pi pi-box"></i>
            <div class="cost-details">
              <span class="cost-value">{{ formatCurrency(costData.materialCost) }}</span>
              <span class="cost-label">Costo Materiali</span>
            </div>
          </div>
          <div class="cost-item" v-if="costData.externalCost > 0">
            <i class="pi pi-building"></i>
            <div class="cost-details">
              <span class="cost-value">{{ formatCurrency(costData.externalCost) }}</span>
              <span class="cost-label">Costi Esterni</span>
            </div>
          </div>
          <div class="cost-item" v-if="costData.bomCost > 0">
            <i class="pi pi-sitemap"></i>
            <div class="cost-details">
              <span class="cost-value">{{ formatCurrency(costData.bomCost) }}</span>
              <span class="cost-label">Costi BOM</span>
            </div>
          </div>
          <div class="cost-item cost-total">
            <i class="pi pi-calculator"></i>
            <div class="cost-details">
              <span class="cost-value">{{ formatCurrency(costData.totalCost) }}</span>
              <span class="cost-label">Costo Totale</span>
            </div>
          </div>
        </div>

        <!-- Warnings if any -->
        <div v-if="costData.warnings && costData.warnings.length > 0" class="cost-warnings">
          <Message v-for="(warning, idx) in costData.warnings" :key="idx" severity="warn" :closable="false">
            {{ warning }}
          </Message>
        </div>
      </div>

      <!-- Summary -->
      <div class="pipeline-summary">
        <div class="summary-item">
          <strong>{{ phases.length }}</strong>
          <span>fasi totali</span>
        </div>
        <div class="summary-item">
          <strong>{{ formatTime(totalTime) }}</strong>
          <span>tempo totale</span>
        </div>
        <div class="summary-item" v-if="totalExternalCost > 0">
          <strong>{{ formatCurrency(totalExternalCost) }}</strong>
          <span>costi esterni</span>
        </div>
      </div>
    </div>

    <!-- Dialog Aggiungi/Modifica Fase -->
    <Dialog
      v-model:visible="showPhaseDialog"
      :header="editingPhase ? 'Modifica Fase' : 'Nuova Fase di Lavorazione'"
      :style="{ width: '550px' }"
      modal
    >
      <div class="phase-form">
        <div class="field">
          <label for="operationType">Tipo Operazione *</label>
          <Dropdown
            id="operationType"
            v-model="phaseForm.operationTypeId"
            :options="operationTypes"
            optionLabel="name"
            optionValue="id"
            placeholder="Seleziona tipo operazione"
            class="w-full"
            :loading="loadingOperationTypes"
            @change="onOperationTypeChange"
          >
            <template #option="{ option }">
              <div class="operation-option">
                <span>{{ option.name }}</span>
                <Tag v-if="option.isExternal" value="Esterno" severity="warning" />
              </div>
            </template>
          </Dropdown>
        </div>

        <div class="field">
          <label for="phaseName">Nome Fase *</label>
          <InputText
            id="phaseName"
            v-model="phaseForm.name"
            placeholder="es. Assemblaggio componenti"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="phaseDescription">Descrizione</label>
          <Textarea
            id="phaseDescription"
            v-model="phaseForm.description"
            rows="2"
            placeholder="Descrizione dettagliata della fase"
            class="w-full"
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label for="standardTime">Tempo Lavorazione (min) *</label>
            <InputNumber
              id="standardTime"
              v-model="phaseForm.standardTime"
              :min="1"
              suffix=" min"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="setupTime">Tempo Setup (min)</label>
            <InputNumber
              id="setupTime"
              v-model="phaseForm.setupTime"
              :min="0"
              suffix=" min"
              class="w-full"
            />
          </div>
        </div>

        <!-- External supplier section (if external operation) -->
        <div v-if="selectedOperationType?.isExternal" class="external-section">
          <Divider />
          <h5>Fornitore Esterno</h5>

          <div class="field">
            <label for="supplier">Terzista</label>
            <Dropdown
              id="supplier"
              v-model="phaseForm.supplierId"
              :options="suppliers"
              optionLabel="name"
              optionValue="id"
              placeholder="Seleziona fornitore"
              filter
              showClear
              class="w-full"
              :loading="loadingSuppliers"
            />
          </div>

          <div class="field">
            <label for="externalCost">Costo per Unita (EUR)</label>
            <InputNumber
              id="externalCost"
              v-model="phaseForm.externalCostPerUnit"
              mode="currency"
              currency="EUR"
              locale="it-IT"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="closePhaseDialog" />
        <Button
          :label="editingPhase ? 'Aggiorna' : 'Aggiungi'"
          icon="pi pi-check"
          :loading="saving"
          @click="savePhase"
        />
      </template>
    </Dialog>

    <!-- Confirm Delete -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Divider from 'primevue/divider';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import { useAuthStore } from '../stores/auth.store';

interface Props {
  productId?: string;
}

const props = defineProps<Props>();

const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const loadingOperationTypes = ref(false);
const loadingSuppliers = ref(false);
const loadingCosts = ref(false);
const phases = ref<any[]>([]);
const operationTypes = ref<any[]>([]);
const suppliers = ref<any[]>([]);
const showPhaseDialog = ref(false);
const editingPhase = ref<any>(null);
const costData = ref<any>(null);

// Role-based visibility
const userRole = computed(() => (authStore.user as any)?.role || '');
const canSeeCost = computed(() => {
  return ['ADMIN', 'MANAGER', 'CONTABILE'].includes(userRole.value);
});

const defaultForm = () => ({
  operationTypeId: '',
  name: '',
  description: '',
  standardTime: 30,
  setupTime: 0,
  externalCostPerUnit: null as number | null,
  supplierId: null as string | null,
});

const phaseForm = ref(defaultForm());

const selectedOperationType = computed(() => {
  return operationTypes.value.find((t) => t.id === phaseForm.value.operationTypeId);
});

const totalTime = computed(() => {
  return phases.value.reduce((sum, p) => sum + p.standardTime + (p.setupTime || 0), 0);
});

const totalExternalCost = computed(() => {
  return phases.value.reduce((sum, p) => sum + (Number(p.externalCostPerUnit) || 0), 0);
});

// Load phases
const loadPhases = async () => {
  if (!props.productId) return;

  loading.value = true;
  try {
    const response = await api.get(`/products/${props.productId}/phases`);
    if (response.success) {
      phases.value = response.data;
      // Reload costs after phases change
      if (canSeeCost.value) {
        loadCosts();
      }
    }
  } catch (error) {
    console.error('Error loading phases:', error);
  } finally {
    loading.value = false;
  }
};

// Load cost data
const loadCosts = async () => {
  if (!props.productId || !canSeeCost.value) return;

  loadingCosts.value = true;
  try {
    const response = await api.get(`/products/${props.productId}/cost-summary`);
    if (response.success) {
      costData.value = response.data;
    }
  } catch (error) {
    console.error('Error loading costs:', error);
  } finally {
    loadingCosts.value = false;
  }
};

// Load operation types
const loadOperationTypes = async () => {
  loadingOperationTypes.value = true;
  try {
    const response = await api.get('/operation-types?limit=100');
    if (response.success) {
      operationTypes.value = response.data;
    }
  } catch (error) {
    console.error('Error loading operation types:', error);
  } finally {
    loadingOperationTypes.value = false;
  }
};

// Load suppliers
const loadSuppliers = async () => {
  loadingSuppliers.value = true;
  try {
    const response = await api.get('/suppliers?limit=500');
    if (response.success) {
      suppliers.value = response.data;
    }
  } catch (error) {
    console.error('Error loading suppliers:', error);
  } finally {
    loadingSuppliers.value = false;
  }
};

const onOperationTypeChange = () => {
  const opType = selectedOperationType.value;
  if (opType && !phaseForm.value.name) {
    phaseForm.value.name = opType.name;
  }
  // Load suppliers if external
  if (opType?.isExternal && suppliers.value.length === 0) {
    loadSuppliers();
  }
};

const openAddPhase = () => {
  editingPhase.value = null;
  phaseForm.value = defaultForm();
  showPhaseDialog.value = true;
  if (operationTypes.value.length === 0) {
    loadOperationTypes();
  }
};

const editPhase = (phase: any) => {
  editingPhase.value = phase;
  phaseForm.value = {
    operationTypeId: phase.operationTypeId,
    name: phase.name,
    description: phase.description || '',
    standardTime: phase.standardTime,
    setupTime: phase.setupTime || 0,
    externalCostPerUnit: phase.externalCostPerUnit ? Number(phase.externalCostPerUnit) : null,
    supplierId: phase.supplierId,
  };
  showPhaseDialog.value = true;
  if (operationTypes.value.length === 0) {
    loadOperationTypes();
  }
  if (phase.operationType?.isExternal && suppliers.value.length === 0) {
    loadSuppliers();
  }
};

const closePhaseDialog = () => {
  showPhaseDialog.value = false;
  editingPhase.value = null;
  phaseForm.value = defaultForm();
};

const savePhase = async () => {
  if (!props.productId) return;

  if (!phaseForm.value.operationTypeId || !phaseForm.value.name) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Compila i campi obbligatori',
      life: 3000,
    });
    return;
  }

  saving.value = true;
  try {
    const data = {
      operationTypeId: phaseForm.value.operationTypeId,
      name: phaseForm.value.name,
      description: phaseForm.value.description || null,
      standardTime: phaseForm.value.standardTime,
      setupTime: phaseForm.value.setupTime || 0,
      externalCostPerUnit: phaseForm.value.externalCostPerUnit,
      supplierId: phaseForm.value.supplierId,
    };

    if (editingPhase.value) {
      await api.put(`/products/${props.productId}/phases/${editingPhase.value.id}`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Fase aggiornata',
        life: 2000,
      });
    } else {
      await api.post(`/products/${props.productId}/phases`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiunta',
        detail: 'Fase aggiunta alla pipeline',
        life: 2000,
      });
    }

    closePhaseDialog();
    await loadPhases();
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

const confirmDelete = (phase: any) => {
  confirm.require({
    message: `Eliminare la fase "${phase.name}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deletePhase(phase),
  });
};

const deletePhase = async (phase: any) => {
  if (!props.productId) return;

  try {
    await api.delete(`/products/${props.productId}/phases/${phase.id}`);
    toast.add({
      severity: 'success',
      summary: 'Eliminata',
      detail: 'Fase eliminata',
      life: 2000,
    });
    await loadPhases();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante eliminazione',
      life: 3000,
    });
  }
};

const movePhase = async (phase: any, direction: 'up' | 'down') => {
  if (!props.productId) return;

  const currentIndex = phases.value.findIndex((p) => p.id === phase.id);
  const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (newIndex < 0 || newIndex >= phases.value.length) return;

  // Swap in array
  const newPhases = [...phases.value];
  [newPhases[currentIndex], newPhases[newIndex]] = [newPhases[newIndex], newPhases[currentIndex]];
  phases.value = newPhases;

  // Save new order
  const phaseIds = newPhases.map((p) => p.id);
  try {
    await api.put(`/products/${props.productId}/phases/reorder`, { phaseIds });
    // Reload to get correct sequence numbers
    await loadPhases();
  } catch (error) {
    console.error('Error reordering:', error);
    await loadPhases();
  }
};

const formatTime = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

// Watch for productId changes
watch(
  () => props.productId,
  (newId) => {
    if (newId) {
      loadPhases();
    } else {
      phases.value = [];
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.productId) {
    loadPhases();
  }
});
</script>

<style scoped>
.product-phases {
  padding: 1rem 0;
}

.phases-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.phases-description {
  margin: 0;
  color: var(--color-gray-600, #64748b);
  font-size: 0.9rem;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--color-gray-500, #64748b);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.empty-state small {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

/* Pipeline Styles */
.phases-pipeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.phase-card {
  display: flex;
  gap: 1rem;
  position: relative;
}

.phase-card.inactive {
  opacity: 0.6;
}

.phase-sequence {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
}

.sequence-number {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-600, #4f46e5);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 1rem;
}

.sequence-arrows {
  display: flex;
  flex-direction: column;
}

.phase-content {
  flex: 1;
  background: var(--bg-card, white);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--border-radius-lg, 0.75rem);
  padding: 1rem 1.25rem;
  margin-bottom: 0.5rem;
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.phase-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.phase-title h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-gray-900, #111827);
}

.operation-tag {
  font-size: 0.7rem;
}

.phase-actions {
  display: flex;
  gap: 0.25rem;
}

.phase-description {
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  color: var(--color-gray-600, #64748b);
}

.phase-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.detail-item i {
  color: var(--color-primary-600, #4f46e5);
  font-size: 0.9rem;
}

.detail-item span {
  font-weight: 500;
  color: var(--color-gray-800, #1f2937);
}

.detail-item small {
  color: var(--color-gray-500, #64748b);
}

.phase-materials {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-color-light, #e2e8f0);
}

.materials-label {
  font-size: 0.8rem;
  color: var(--color-gray-500, #64748b);
  margin-right: 0.5rem;
}

.materials-list {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.phase-arrow {
  position: absolute;
  left: 17px;
  bottom: -4px;
  color: var(--color-primary-400, #818cf8);
  font-size: 1rem;
}

/* Summary */
.pipeline-summary {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 1rem;
  margin-top: 1rem;
  background: var(--color-gray-50, #f8fafc);
  border-radius: var(--border-radius-md, 0.5rem);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.summary-item strong {
  font-size: 1.25rem;
  color: var(--color-primary-600, #4f46e5);
}

.summary-item span {
  font-size: 0.8rem;
  color: var(--color-gray-500, #64748b);
}

/* Form Styles */
.phase-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
  color: var(--color-gray-700, #374151);
  font-size: 0.9rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.external-section {
  background: var(--color-warning-light, #fef3c7);
  padding: 1rem;
  border-radius: var(--border-radius-md, 0.5rem);
  margin-top: 0.5rem;
}

.external-section h5 {
  margin: 0 0 1rem 0;
  color: var(--color-warning-dark, #92400e);
  font-size: 0.9rem;
}

.operation-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.w-full {
  width: 100%;
}

/* Cost Summary Styles */
.cost-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--border-radius-lg, 0.75rem);
  padding: 1.5rem;
  margin-top: 1.5rem;
  color: white;
}

.cost-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.cost-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  opacity: 0.95;
}

.cost-header :deep(.p-button) {
  color: white !important;
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.cost-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--border-radius-md, 0.5rem);
  backdrop-filter: blur(10px);
}

.cost-item i {
  font-size: 1.25rem;
  opacity: 0.9;
}

.cost-details {
  display: flex;
  flex-direction: column;
}

.cost-value {
  font-size: 1.1rem;
  font-weight: 700;
}

.cost-label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.cost-item.cost-total {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.cost-item.cost-total .cost-value {
  font-size: 1.25rem;
}

.cost-warnings {
  margin-top: 1rem;
}

.cost-warnings :deep(.p-message) {
  margin: 0.25rem 0;
}
</style>
