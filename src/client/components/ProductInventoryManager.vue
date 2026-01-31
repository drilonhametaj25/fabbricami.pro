<template>
  <div class="inventory-manager">
    <div class="inventory-header">
      <h4>Gestione Giacenze</h4>
      <div class="save-status">
        <span v-if="saving" class="saving-indicator">
          <i class="pi pi-spin pi-spinner"></i>
          Salvataggio...
        </span>
        <span v-else-if="lastSaved" class="saved-indicator">
          <i class="pi pi-check"></i>
          Salvato
        </span>
      </div>
    </div>

    <div class="inventory-grid">
      <div
        v-for="loc in locations"
        :key="loc.code"
        class="inventory-card"
        :class="getCardClass(loc.code)"
      >
        <div class="card-header">
          <i :class="loc.icon"></i>
          <span class="location-name">{{ loc.label }}</span>
        </div>

        <div class="quantity-section">
          <div class="field">
            <label>Quantità Disponibile</label>
            <InputNumber
              v-model="inventoryData[loc.code].quantity"
              :min="0"
              class="w-full"
            />
          </div>
          <div class="field">
            <label>Quantità Riservata</label>
            <InputNumber
              v-model="inventoryData[loc.code].reservedQuantity"
              :min="0"
              class="w-full"
            />
          </div>
        </div>

        <div class="available-info">
          <span class="label">Disponibile effettivo:</span>
          <span class="value" :class="getAvailableClass(loc.code)">
            {{ getAvailable(loc.code) }}
          </span>
        </div>
      </div>
    </div>

    <div class="total-section">
      <div class="total-card">
        <div class="total-label">Totale Disponibile (tutte le location)</div>
        <div class="total-value">{{ getTotalAvailable() }} pz</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <h5>Azioni Rapide</h5>
      <div class="actions-grid">
        <Button
          icon="pi pi-arrow-right"
          label="Trasferisci tra location"
          class="p-button-outlined"
          @click="showTransferDialog = true"
        />
        <Button
          icon="pi pi-refresh"
          label="Azzera tutto"
          class="p-button-outlined p-button-danger"
          @click="resetAll"
        />
      </div>
    </div>

    <!-- Transfer Dialog -->
    <Dialog
      v-model:visible="showTransferDialog"
      header="Trasferisci Giacenza"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="transfer-form">
        <div class="field">
          <label>Da</label>
          <Dropdown
            v-model="transfer.from"
            :options="locations"
            optionLabel="label"
            optionValue="code"
            placeholder="Seleziona origine"
            class="w-full"
          />
        </div>
        <div class="field">
          <label>A</label>
          <Dropdown
            v-model="transfer.to"
            :options="locations"
            optionLabel="label"
            optionValue="code"
            placeholder="Seleziona destinazione"
            class="w-full"
          />
        </div>
        <div class="field">
          <label>Quantità</label>
          <InputNumber
            v-model="transfer.quantity"
            :min="1"
            :max="getMaxTransfer()"
            class="w-full"
          />
        </div>
        <small class="transfer-info" v-if="transfer.from">
          Disponibile: {{ inventoryData[transfer.from]?.quantity || 0 }} pz
        </small>
      </div>
      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="showTransferDialog = false" />
        <Button
          label="Trasferisci"
          icon="pi pi-arrow-right"
          @click="executeTransfer"
          :disabled="!canTransfer"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Props {
  productId: string;
  variantId?: string;
}

const props = defineProps<Props>();
const toast = useToast();

const locations = [
  { code: 'WEB', label: 'Web/E-commerce', icon: 'pi pi-globe' },
  { code: 'B2B', label: 'B2B/Ingrosso', icon: 'pi pi-briefcase' },
  { code: 'EVENTI', label: 'Eventi/Fiere', icon: 'pi pi-calendar' },
  { code: 'TRANSITO', label: 'In Transito', icon: 'pi pi-truck' },
];

const inventoryData = reactive<Record<string, { quantity: number; reservedQuantity: number }>>({
  WEB: { quantity: 0, reservedQuantity: 0 },
  B2B: { quantity: 0, reservedQuantity: 0 },
  EVENTI: { quantity: 0, reservedQuantity: 0 },
  TRANSITO: { quantity: 0, reservedQuantity: 0 },
});

const originalData = ref<Record<string, { quantity: number; reservedQuantity: number }>>({});
const loading = ref(false);
const saving = ref(false);
const lastSaved = ref(false);
const isInitialLoad = ref(true);
const showTransferDialog = ref(false);
const transfer = reactive({
  from: '' as string,
  to: '' as string,
  quantity: 1,
});

// Debounce timer
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let savedIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

const loadInventory = async () => {
  if (!props.productId) return;

  try {
    loading.value = true;
    isInitialLoad.value = true;
    const endpoint = props.variantId
      ? `/products/${props.productId}/variants/${props.variantId}/inventory`
      : `/products/${props.productId}/inventory`;

    const response = await api.get(endpoint);

    if (response.success && response.data) {
      // Reset to defaults
      Object.keys(inventoryData).forEach(key => {
        inventoryData[key] = { quantity: 0, reservedQuantity: 0 };
      });

      // Populate from API
      response.data.forEach((item: any) => {
        if (inventoryData[item.location]) {
          inventoryData[item.location] = {
            quantity: Number(item.quantity) || 0,
            reservedQuantity: Number(item.reservedQuantity) || 0,
          };
        }
      });

      // Save original for comparison
      originalData.value = JSON.parse(JSON.stringify(inventoryData));
    }
  } catch (error) {
    console.error('Error loading inventory:', error);
  } finally {
    loading.value = false;
    // Allow auto-save after initial load is complete
    setTimeout(() => {
      isInitialLoad.value = false;
    }, 100);
  }
};

const saveInventory = async () => {
  try {
    saving.value = true;
    lastSaved.value = false;

    const items = Object.entries(inventoryData).map(([location, data]) => ({
      location: location as 'WEB' | 'B2B' | 'EVENTI' | 'TRANSITO',
      quantity: data.quantity ?? 0,
      reservedQuantity: data.reservedQuantity ?? 0,
    }));

    const endpoint = props.variantId
      ? `/products/${props.productId}/variants/${props.variantId}/inventory`
      : `/products/${props.productId}/inventory`;

    const response = await api.put(endpoint, { items });

    if (response.success) {
      originalData.value = JSON.parse(JSON.stringify(inventoryData));
      lastSaved.value = true;

      // Hide saved indicator after 3 seconds
      if (savedIndicatorTimeout) clearTimeout(savedIndicatorTimeout);
      savedIndicatorTimeout = setTimeout(() => {
        lastSaved.value = false;
      }, 3000);
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore salvataggio giacenze',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

// Debounced auto-save function
const debouncedSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveInventory();
  }, 800); // Wait 800ms after last change before saving
};

const getAvailable = (location: string) => {
  const data = inventoryData[location];
  return (data?.quantity || 0) - (data?.reservedQuantity || 0);
};

const getTotalAvailable = () => {
  return Object.values(inventoryData).reduce((sum, data) => {
    return sum + (data.quantity || 0) - (data.reservedQuantity || 0);
  }, 0);
};

const getCardClass = (location: string) => {
  const available = getAvailable(location);
  if (available <= 0) return 'empty';
  if (available < 10) return 'low';
  return 'ok';
};

const getAvailableClass = (location: string) => {
  const available = getAvailable(location);
  if (available <= 0) return 'danger';
  if (available < 10) return 'warning';
  return 'success';
};

const resetAll = () => {
  Object.keys(inventoryData).forEach(key => {
    inventoryData[key] = { quantity: 0, reservedQuantity: 0 };
  });
  // Auto-save will trigger via watch
};

const getMaxTransfer = () => {
  if (!transfer.from) return 0;
  return inventoryData[transfer.from]?.quantity || 0;
};

const canTransfer = computed(() => {
  return (
    transfer.from &&
    transfer.to &&
    transfer.from !== transfer.to &&
    transfer.quantity > 0 &&
    transfer.quantity <= getMaxTransfer()
  );
});

const executeTransfer = () => {
  if (!canTransfer.value) return;

  // Sottrai dalla sorgente
  inventoryData[transfer.from].quantity -= transfer.quantity;
  // Aggiungi alla destinazione
  inventoryData[transfer.to].quantity += transfer.quantity;

  showTransferDialog.value = false;

  // Reset transfer form
  transfer.from = '';
  transfer.to = '';
  transfer.quantity = 1;

  // Auto-save will trigger via watch
};

// Watch for prop changes to reload
watch(() => [props.productId, props.variantId], () => {
  loadInventory();
}, { immediate: true });

// Watch inventoryData for auto-save
watch(
  () => JSON.stringify(inventoryData),
  (newVal, oldVal) => {
    // Skip if initial load or same value
    if (isInitialLoad.value || newVal === oldVal) return;

    // Check if actually changed from original
    if (newVal !== JSON.stringify(originalData.value)) {
      debouncedSave();
    }
  }
);

onMounted(() => {
  if (props.productId) {
    loadInventory();
  }
});

onUnmounted(() => {
  // Clean up timers
  if (saveTimeout) clearTimeout(saveTimeout);
  if (savedIndicatorTimeout) clearTimeout(savedIndicatorTimeout);
});
</script>

<style scoped>
.inventory-manager {
  padding: 1rem 0;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.inventory-header h4 {
  margin: 0;
  color: #1e293b;
}

.save-status {
  min-width: 120px;
  text-align: right;
}

.saving-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #3b82f6;
  font-size: 0.9rem;
}

.saved-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #22c55e;
  font-size: 0.9rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .inventory-grid {
    grid-template-columns: 1fr;
  }
}

.inventory-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid #e2e8f0;
  transition: all 0.2s ease;
}

.inventory-card.ok {
  border-left-color: #22c55e;
}

.inventory-card.low {
  border-left-color: #f59e0b;
}

.inventory-card.empty {
  border-left-color: #ef4444;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  color: #64748b;
}

.card-header i {
  font-size: 1.25rem;
}

.location-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.quantity-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}

.available-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
}

.available-info .label {
  font-size: 0.85rem;
  color: #64748b;
}

.available-info .value {
  font-size: 1.1rem;
  font-weight: 700;
}

.available-info .value.success {
  color: #22c55e;
}

.available-info .value.warning {
  color: #f59e0b;
}

.available-info .value.danger {
  color: #ef4444;
}

.total-section {
  margin-bottom: 1.5rem;
}

.total-card {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.total-label {
  font-size: 0.9rem;
  opacity: 0.9;
  margin-bottom: 0.5rem;
}

.total-value {
  font-size: 2rem;
  font-weight: 700;
}

.quick-actions {
  background: #f1f5f9;
  padding: 1rem;
  border-radius: 8px;
}

.quick-actions h5 {
  margin: 0 0 1rem 0;
  color: #475569;
}

.actions-grid {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Transfer Dialog */
.transfer-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transfer-info {
  color: #64748b;
}

.w-full {
  width: 100%;
}
</style>
