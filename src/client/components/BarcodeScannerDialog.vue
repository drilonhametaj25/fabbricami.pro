<template>
  <Dialog
    v-model:visible="visible"
    header="Movimentazione con Scanner"
    :modal="true"
    :closable="true"
    :style="{ width: '600px', maxWidth: '95vw' }"
    @hide="resetState"
  >
    <!-- Settings Row -->
    <div class="settings-row">
      <div class="setting-item">
        <label>Tipo Movimento</label>
        <Dropdown
          v-model="movementType"
          :options="movementTypes"
          optionLabel="label"
          optionValue="value"
          class="w-full"
          :disabled="scannedProducts.length > 0"
        />
      </div>
      <div class="setting-item">
        <label>Location</label>
        <Dropdown
          v-model="locationId"
          :options="locations"
          optionLabel="label"
          optionValue="value"
          class="w-full"
          :disabled="scannedProducts.length > 0"
        />
      </div>
    </div>

    <!-- Scanner -->
    <div class="scanner-section">
      <BarcodeScanner
        ref="scannerRef"
        :active="scannerActive"
        @scanned="onBarcodeScanned"
        @error="onScannerError"
      />
    </div>

    <!-- Scanned Products List -->
    <div class="products-section" v-if="scannedProducts.length > 0">
      <div class="products-header">
        <span class="products-title">Prodotti scansionati ({{ totalItems }})</span>
        <Button
          label="Svuota"
          icon="pi pi-trash"
          class="p-button-text p-button-sm p-button-danger"
          @click="clearProducts"
        />
      </div>

      <div class="products-list">
        <div
          v-for="item in scannedProducts"
          :key="item.productId + (item.variantId || '')"
          class="product-item"
        >
          <div class="product-info">
            <span class="product-sku">{{ item.sku }}</span>
            <span class="product-name">{{ item.name }}</span>
            <span v-if="item.variantName" class="variant-name">({{ item.variantName }})</span>
          </div>
          <div class="product-actions">
            <InputNumber
              v-model="item.quantity"
              :min="1"
              :max="999"
              showButtons
              buttonLayout="horizontal"
              class="quantity-input"
              decrementButtonClass="p-button-text"
              incrementButtonClass="p-button-text"
            />
            <Button
              icon="pi pi-times"
              class="p-button-rounded p-button-text p-button-danger p-button-sm"
              @click="removeProduct(item)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <i class="pi pi-barcode empty-icon"></i>
      <p>Scansiona un barcode per iniziare</p>
    </div>

    <!-- Error Message -->
    <div v-if="lastError" class="error-message">
      <i class="pi pi-exclamation-circle"></i>
      <span>{{ lastError }}</span>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Annulla"
          icon="pi pi-times"
          class="p-button-text"
          @click="close"
        />
        <Button
          :label="movementType === 'IN' ? `Carica ${totalItems} articoli` : `Scarica ${totalItems} articoli`"
          :icon="movementType === 'IN' ? 'pi pi-plus' : 'pi pi-minus'"
          :class="movementType === 'IN' ? 'p-button-success' : 'p-button-warning'"
          :loading="saving"
          :disabled="scannedProducts.length === 0"
          @click="saveAll"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import BarcodeScanner from './BarcodeScanner.vue';
import api from '../services/api.service';

interface ScannedProduct {
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  variantName?: string;
  quantity: number;
}

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const toast = useToast();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const scannerRef = ref<InstanceType<typeof BarcodeScanner> | null>(null);
const scannerActive = ref(false);
const saving = ref(false);
const lastError = ref('');

const movementType = ref<'IN' | 'OUT'>('IN');
const locationId = ref('WEB');
const scannedProducts = ref<ScannedProduct[]>([]);

const movementTypes = [
  { label: 'Carico (IN)', value: 'IN' },
  { label: 'Scarico (OUT)', value: 'OUT' },
];

const locations = [
  { label: 'Magazzino Web', value: 'WEB' },
  { label: 'Magazzino B2B', value: 'B2B' },
  { label: 'Magazzino Eventi', value: 'EVENTI' },
  { label: 'In Transito', value: 'TRANSITO' },
];

const totalItems = computed(() => {
  return scannedProducts.value.reduce((sum, p) => sum + p.quantity, 0);
});

const onBarcodeScanned = async (code: string) => {
  lastError.value = '';

  try {
    // Lookup product by barcode/sku
    const response = await api.get(`/products/lookup/barcode/${encodeURIComponent(code)}`);
    const data = response.data;

    const productId = data.product.id;
    const variantId = data.variant?.id;

    // Check if already in list
    const existingIndex = scannedProducts.value.findIndex(
      p => p.productId === productId && p.variantId === variantId
    );

    if (existingIndex >= 0) {
      // Increment quantity
      scannedProducts.value[existingIndex].quantity++;
      toast.add({
        severity: 'info',
        summary: 'Quantita aggiornata',
        detail: `${data.product.sku} +1 (totale: ${scannedProducts.value[existingIndex].quantity})`,
        life: 2000,
      });
    } else {
      // Add new product
      scannedProducts.value.push({
        productId,
        variantId,
        sku: data.variant?.sku || data.product.sku,
        name: data.product.name,
        variantName: data.variant?.name,
        quantity: 1,
      });

      toast.add({
        severity: 'success',
        summary: 'Prodotto aggiunto',
        detail: `${data.variant?.sku || data.product.sku} - ${data.product.name}`,
        life: 2000,
      });
    }
  } catch (error: any) {
    lastError.value = error.message || `Prodotto non trovato per codice: ${code}`;
    toast.add({
      severity: 'error',
      summary: 'Non trovato',
      detail: lastError.value,
      life: 3000,
    });
  }
};

const onScannerError = (message: string) => {
  lastError.value = message;
};

const removeProduct = (item: ScannedProduct) => {
  const index = scannedProducts.value.findIndex(
    p => p.productId === item.productId && p.variantId === item.variantId
  );
  if (index >= 0) {
    scannedProducts.value.splice(index, 1);
  }
};

const clearProducts = () => {
  scannedProducts.value = [];
};

const resetState = () => {
  scannedProducts.value = [];
  lastError.value = '';
  scannerActive.value = false;
};

const close = () => {
  visible.value = false;
};

const saveAll = async () => {
  if (scannedProducts.value.length === 0) return;

  try {
    saving.value = true;

    const movements = scannedProducts.value.map(p => ({
      productId: p.productId,
      type: movementType.value,
      quantity: p.quantity,
      locationId: locationId.value,
      notes: `Scansione barcode - ${p.variantId ? 'Variante' : 'Prodotto'}: ${p.sku}`,
    }));

    const response = await api.post('/inventory/movement/batch', { movements });

    const result = response.data;

    if (result.created > 0) {
      toast.add({
        severity: 'success',
        summary: 'Movimenti registrati',
        detail: `${result.created} movimenti creati con successo`,
        life: 3000,
      });
    }

    if (result.failed > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Alcuni movimenti falliti',
        detail: `${result.failed} movimenti non creati`,
        life: 5000,
      });
    }

    emit('saved');
    close();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
};

// Activate scanner when dialog opens
watch(visible, (isVisible) => {
  if (isVisible) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      scannerActive.value = true;
    }, 500);
  } else {
    scannerActive.value = false;
  }
});
</script>

<style scoped>
.settings-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.setting-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setting-item label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.w-full {
  width: 100%;
}

.scanner-section {
  margin-bottom: var(--space-4);
}

.products-section {
  border: 1px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.products-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-gray-50);
  border-bottom: 1px solid var(--border-color-light);
}

.products-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.products-list {
  max-height: 200px;
  overflow-y: auto;
}

.product-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color-light);
}

.product-item:last-child {
  border-bottom: none;
}

.product-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.product-sku {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
}

.product-name {
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.variant-name {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.product-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.quantity-input {
  width: 100px;
}

.quantity-input :deep(.p-inputnumber-input) {
  width: 40px;
  text-align: center;
  padding: var(--space-1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--color-gray-400);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--space-3);
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-sm);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-top: var(--space-3);
  background: var(--color-danger-50);
  color: var(--color-danger-700);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
}

.error-message i {
  color: var(--color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 480px) {
  .settings-row {
    flex-direction: column;
  }

  .product-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .product-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
