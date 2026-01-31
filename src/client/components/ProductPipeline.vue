<template>
  <div class="product-pipeline">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Pipeline di Produzione</h3>
      <div class="flex gap-2">
        <Button
          label="Calcola Costo"
          icon="pi pi-calculator"
          class="p-button-outlined p-button-sm"
          @click="calculateCost"
          :loading="calculatingCost"
        />
        <Button
          label="Aggiungi Fase"
          icon="pi pi-plus"
          class="p-button-sm"
          @click="openPhaseDialog()"
        />
      </div>
    </div>

    <!-- Riepilogo Costi -->
    <div v-if="costBreakdown" class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
      <div class="grid grid-cols-4 gap-4 text-center">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Materiali</p>
          <p class="text-lg font-bold text-blue-600">{{ formatCurrency(costBreakdown.materialCost) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Manodopera</p>
          <p class="text-lg font-bold text-green-600">{{ formatCurrency(costBreakdown.laborCost) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Esterno</p>
          <p class="text-lg font-bold text-orange-600">{{ formatCurrency(costBreakdown.externalCost) }}</p>
        </div>
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Totale</p>
          <p class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(costBreakdown.totalCost) }}</p>
        </div>
      </div>
    </div>

    <!-- Lista Fasi -->
    <div v-if="loading" class="flex justify-center py-8">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>

    <div v-else-if="phases.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <i class="pi pi-list text-4xl text-gray-400 mb-4"></i>
      <p class="text-gray-500 dark:text-gray-400">Nessuna fase di produzione definita</p>
      <Button
        label="Aggiungi Prima Fase"
        icon="pi pi-plus"
        class="p-button-text mt-4"
        @click="openPhaseDialog()"
      />
    </div>

    <draggable
      v-else
      v-model="phases"
      item-key="id"
      handle=".drag-handle"
      @end="onReorder"
      class="space-y-3"
    >
      <template #item="{ element: phase, index }">
        <div class="phase-card bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex items-start p-4">
            <!-- Drag Handle -->
            <div class="drag-handle cursor-move mr-3 text-gray-400 hover:text-gray-600">
              <i class="pi pi-bars text-lg"></i>
            </div>

            <!-- Numero Fase -->
            <div class="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold mr-4">
              {{ index + 1 }}
            </div>

            <!-- Contenuto Fase -->
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-2">
                <span class="font-semibold text-gray-900 dark:text-white">{{ phase.name }}</span>
                <Tag
                  :value="phase.operationType?.name || 'N/D'"
                  :severity="phase.operationType?.isExternal ? 'warning' : 'info'"
                  class="text-xs"
                />
                <Tag
                  v-if="phase.supplierId"
                  value="Terzista"
                  severity="warning"
                  class="text-xs"
                />
              </div>

              <p v-if="phase.description" class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {{ phase.description }}
              </p>

              <!-- Info Tempi -->
              <div class="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300 mb-2">
                <span v-if="phase.standardTime">
                  <i class="pi pi-clock mr-1"></i>
                  {{ formatTime(phase.standardTime) }} (standard)
                </span>
                <span v-if="phase.setupTime">
                  <i class="pi pi-cog mr-1"></i>
                  {{ formatTime(phase.setupTime) }} (setup)
                </span>
                <span v-if="phase.externalCostPerUnit">
                  <i class="pi pi-euro mr-1"></i>
                  {{ formatCurrency(phase.externalCostPerUnit) }}/unità
                </span>
              </div>

              <!-- Materiali -->
              <div v-if="phase.materials && phase.materials.length > 0" class="mb-2">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Materiali:</p>
                <div class="flex flex-wrap gap-1">
                  <Tag
                    v-for="mat in phase.materials"
                    :key="mat.id"
                    class="text-xs"
                    severity="secondary"
                  >
                    {{ mat.material?.name || 'N/D' }} ({{ mat.quantity }} {{ mat.unit }})
                    <span v-if="mat.scrapPercentage" class="ml-1 text-orange-600">+{{ mat.scrapPercentage }}% scarto</span>
                  </Tag>
                </div>
              </div>

              <!-- Dipendenti -->
              <div v-if="phase.employees && phase.employees.length > 0">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dipendenti qualificati:</p>
                <div class="flex flex-wrap gap-1">
                  <Tag
                    v-for="emp in phase.employees"
                    :key="emp.id"
                    class="text-xs"
                    :severity="emp.isPrimary ? 'success' : 'secondary'"
                  >
                    {{ emp.employee?.firstName }} {{ emp.employee?.lastName }}
                    <span v-if="emp.isPrimary" class="ml-1">(Primario)</span>
                  </Tag>
                </div>
              </div>
            </div>

            <!-- Azioni -->
            <div class="flex-shrink-0 flex gap-1">
              <Button
                icon="pi pi-pencil"
                class="p-button-text p-button-sm"
                @click="openPhaseDialog(phase)"
                v-tooltip.top="'Modifica'"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger p-button-sm"
                @click="confirmDeletePhase(phase)"
                v-tooltip.top="'Elimina'"
              />
            </div>
          </div>
        </div>
      </template>
    </draggable>

    <!-- Dialog Fase -->
    <PhaseDialog
      v-model:visible="showPhaseDialog"
      :phase="editingPhase"
      :productId="productId"
      @saved="onPhaseSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import draggable from 'vuedraggable';
import api from '../services/api.service';
import PhaseDialog from './PhaseDialog.vue';

interface Phase {
  id: string;
  sequence: number;
  name: string;
  description?: string;
  standardTime: number;
  setupTime?: number;
  externalCostPerUnit?: number;
  supplierId?: string;
  operationType?: {
    id: string;
    code: string;
    name: string;
    isExternal: boolean;
  };
  materials?: Array<{
    id: string;
    quantity: number;
    unit: string;
    scrapPercentage?: number;
    material?: {
      id: string;
      name: string;
      sku: string;
    };
  }>;
  employees?: Array<{
    id: string;
    isPrimary: boolean;
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
}

interface CostBreakdown {
  materialCost: number;
  laborCost: number;
  externalCost: number;
  totalCost: number;
  phases: any[];
}

const props = defineProps<{
  productId: string;
}>();

const emit = defineEmits(['updated']);

const confirm = useConfirm();
const toast = useToast();

const loading = ref(false);
const calculatingCost = ref(false);
const phases = ref<Phase[]>([]);
const costBreakdown = ref<CostBreakdown | null>(null);
const showPhaseDialog = ref(false);
const editingPhase = ref<Phase | null>(null);

const loadPipeline = async () => {
  if (!props.productId) return;

  loading.value = true;
  try {
    const response = await api.get(`/manufacturing/products/${props.productId}/pipeline`);
    phases.value = response.data.data || [];
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel caricamento pipeline',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const calculateCost = async () => {
  if (!props.productId) return;

  calculatingCost.value = true;
  try {
    const response = await api.get(`/manufacturing/products/${props.productId}/cost`);
    costBreakdown.value = response.data.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel calcolo costo',
      life: 3000,
    });
  } finally {
    calculatingCost.value = false;
  }
};

const openPhaseDialog = (phase?: Phase) => {
  editingPhase.value = phase || null;
  showPhaseDialog.value = true;
};

const onPhaseSaved = () => {
  showPhaseDialog.value = false;
  loadPipeline();
  costBreakdown.value = null; // Reset cost to force recalculation
  emit('updated');
};

const confirmDeletePhase = (phase: Phase) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare la fase "${phase.name}"?`,
    header: 'Conferma eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deletePhase(phase.id),
  });
};

const deletePhase = async (phaseId: string) => {
  try {
    await api.delete(`/manufacturing/phases/${phaseId}`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Fase eliminata',
      life: 3000,
    });
    loadPipeline();
    costBreakdown.value = null;
    emit('updated');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nell\'eliminazione',
      life: 3000,
    });
  }
};

const onReorder = async () => {
  const phaseIds = phases.value.map((p) => p.id);

  try {
    await api.put(`/manufacturing/products/${props.productId}/phases/reorder`, {
      phaseIds,
    });
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Ordine fasi aggiornato',
      life: 2000,
    });
    emit('updated');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel riordino',
      life: 3000,
    });
    loadPipeline();
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const formatTime = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

watch(() => props.productId, () => {
  if (props.productId) {
    loadPipeline();
    costBreakdown.value = null;
  }
});

onMounted(() => {
  if (props.productId) {
    loadPipeline();
  }
});
</script>

<style scoped>
.phase-card {
  transition: all 0.2s ease;
}

.phase-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.sortable-ghost {
  opacity: 0.5;
  background: #e0e7ff;
}

.sortable-chosen {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
</style>
