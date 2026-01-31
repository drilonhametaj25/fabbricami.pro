<template>
  <Dialog
    v-model:visible="visible"
    header="Trasferimento Stock"
    :modal="true"
    :closable="true"
    :style="{ width: '500px' }"
    @hide="resetForm"
  >
    <div class="transfer-form">
      <!-- Product Info (readonly) -->
      <div class="product-info" v-if="inventoryItem">
        <div class="product-header">
          <span class="sku-badge">{{ inventoryItem.product?.sku }}</span>
          <span class="product-name">{{ inventoryItem.product?.name }}</span>
        </div>
        <div class="stock-info">
          <Tag severity="info">{{ inventoryItem.location }}</Tag>
          <span class="stock-qty">
            Disponibile: <strong>{{ availableQty }}</strong> pz
          </span>
        </div>
      </div>

      <Divider />

      <div class="field">
        <label for="fromLocation">Da Location *</label>
        <Dropdown
          id="fromLocation"
          v-model="form.fromLocationId"
          :options="locations"
          optionLabel="label"
          optionValue="value"
          placeholder="Location di origine"
          class="w-full"
          :disabled="!!inventoryItem"
        />
      </div>

      <div class="field">
        <label for="toLocation">A Location *</label>
        <Dropdown
          id="toLocation"
          v-model="form.toLocationId"
          :options="availableDestinations"
          optionLabel="label"
          optionValue="value"
          placeholder="Location di destinazione"
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="quantity">Quantita da trasferire *</label>
        <InputNumber
          id="quantity"
          v-model="form.quantity"
          :min="1"
          :max="availableQty"
          showButtons
          class="w-full"
        />
        <small class="field-hint" v-if="availableQty > 0">
          Massimo trasferibile: {{ availableQty }} pz
        </small>
      </div>

      <div class="field">
        <label for="notes">Note</label>
        <Textarea
          id="notes"
          v-model="form.notes"
          rows="2"
          placeholder="Note opzionali..."
          class="w-full"
        />
      </div>
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
          label="Trasferisci"
          icon="pi pi-arrows-h"
          class="p-button-primary"
          :loading="saving"
          :disabled="!isValid"
          @click="save"
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
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface InventoryItem {
  id: string;
  productId: string;
  location: string;
  quantity: number;
  reservedQuantity: number;
  product?: {
    id: string;
    sku: string;
    name: string;
  };
}

interface Props {
  modelValue: boolean;
  inventoryItem?: InventoryItem | null;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  inventoryItem: null,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const toast = useToast();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const saving = ref(false);

const form = ref({
  fromLocationId: '',
  toLocationId: '',
  quantity: 1,
  notes: '',
});

const locations = [
  { label: 'Magazzino Web', value: 'WEB' },
  { label: 'Magazzino B2B', value: 'B2B' },
  { label: 'Magazzino Eventi', value: 'EVENTI' },
  { label: 'In Transito', value: 'TRANSITO' },
];

const availableQty = computed(() => {
  if (!props.inventoryItem) return 0;
  return props.inventoryItem.quantity - props.inventoryItem.reservedQuantity;
});

const availableDestinations = computed(() => {
  return locations.filter(loc => loc.value !== form.value.fromLocationId);
});

const isValid = computed(() => {
  return (
    form.value.fromLocationId &&
    form.value.toLocationId &&
    form.value.fromLocationId !== form.value.toLocationId &&
    form.value.quantity > 0 &&
    form.value.quantity <= availableQty.value &&
    props.inventoryItem?.productId
  );
});

const resetForm = () => {
  form.value = {
    fromLocationId: props.inventoryItem?.location || '',
    toLocationId: '',
    quantity: 1,
    notes: '',
  };
};

const close = () => {
  visible.value = false;
};

const save = async () => {
  if (!isValid.value || !props.inventoryItem) return;

  try {
    saving.value = true;

    await api.post('/inventory/transfer', {
      productId: props.inventoryItem.productId,
      fromLocationId: form.value.fromLocationId,
      toLocationId: form.value.toLocationId,
      quantity: form.value.quantity,
      notes: form.value.notes || undefined,
    });

    const fromLabel = locations.find(l => l.value === form.value.fromLocationId)?.label || form.value.fromLocationId;
    const toLabel = locations.find(l => l.value === form.value.toLocationId)?.label || form.value.toLocationId;

    toast.add({
      severity: 'success',
      summary: 'Trasferimento completato',
      detail: `${form.value.quantity} pezzi trasferiti da ${fromLabel} a ${toLabel}`,
      life: 3000,
    });

    emit('saved');
    close();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il trasferimento',
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
};

// Watch for inventory item changes
watch(() => props.inventoryItem, (newVal) => {
  if (newVal) {
    form.value.fromLocationId = newVal.location;
    form.value.quantity = Math.min(1, availableQty.value);
  }
}, { immediate: true });
</script>

<style scoped>
.transfer-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.product-info {
  background: var(--color-gray-50);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
}

.product-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.sku-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.product-name {
  font-weight: 500;
  color: var(--color-gray-800);
}

.stock-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.stock-qty {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.stock-qty strong {
  color: var(--color-success);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.w-full {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
