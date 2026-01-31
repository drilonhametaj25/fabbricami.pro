<template>
  <Dialog
    v-model:visible="visible"
    header="Nuova Movimentazione"
    :modal="true"
    :closable="true"
    :style="{ width: '500px' }"
    @hide="resetForm"
  >
    <div class="movement-form">
      <div class="field">
        <label for="product">Prodotto *</label>
        <Dropdown
          id="product"
          v-model="form.productId"
          :options="products"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona prodotto"
          filter
          filterPlaceholder="Cerca per SKU o nome..."
          :virtualScrollerOptions="{ itemSize: 38 }"
          scrollHeight="300px"
          :loading="loadingProducts"
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="type">Tipo Movimento *</label>
        <Dropdown
          id="type"
          v-model="form.type"
          :options="movementTypes"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona tipo"
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="location">Location *</label>
        <Dropdown
          id="location"
          v-model="form.locationId"
          :options="locations"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona location"
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="quantity">Quantita *</label>
        <InputNumber
          id="quantity"
          v-model="form.quantity"
          :min="1"
          :max="9999"
          showButtons
          class="w-full"
        />
      </div>

      <div class="field">
        <label for="notes">Note</label>
        <Textarea
          id="notes"
          v-model="form.notes"
          rows="3"
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
          :label="form.type === 'IN' ? 'Carica' : 'Scarica'"
          :icon="form.type === 'IN' ? 'pi pi-plus' : 'pi pi-minus'"
          :class="form.type === 'IN' ? 'p-button-success' : 'p-button-warning'"
          :loading="saving"
          :disabled="!isValid"
          @click="save"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Props {
  modelValue: boolean;
  preselectedProduct?: { id: string; name: string; sku: string } | null;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  preselectedProduct: null,
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

const loadingProducts = ref(false);
const saving = ref(false);
const products = ref<Array<{ label: string; value: string }>>([]);

const form = ref({
  productId: '',
  type: 'IN' as 'IN' | 'OUT',
  locationId: 'WEB',
  quantity: 1,
  notes: '',
});

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

const isValid = computed(() => {
  return form.value.productId && form.value.type && form.value.locationId && form.value.quantity > 0;
});

const loadProducts = async () => {
  try {
    loadingProducts.value = true;
    const response = await api.get('/products?limit=9999');
    const items = response.data?.items || [];
    products.value = items.map((p: any) => ({
      label: `${p.sku} - ${p.name}`,
      value: p.id,
    }));
  } catch (error) {
    console.error('Error loading products:', error);
  } finally {
    loadingProducts.value = false;
  }
};

const resetForm = () => {
  form.value = {
    productId: props.preselectedProduct?.id || '',
    type: 'IN',
    locationId: 'WEB',
    quantity: 1,
    notes: '',
  };
};

const close = () => {
  visible.value = false;
};

const save = async () => {
  if (!isValid.value) return;

  try {
    saving.value = true;

    await api.post('/inventory/movement', {
      productId: form.value.productId,
      type: form.value.type,
      locationId: form.value.locationId,
      quantity: form.value.quantity,
      notes: form.value.notes || undefined,
    });

    toast.add({
      severity: 'success',
      summary: 'Movimento registrato',
      detail: `${form.value.type === 'IN' ? 'Carico' : 'Scarico'} di ${form.value.quantity} pezzi effettuato`,
      life: 3000,
    });

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

// Watch for preselected product
watch(() => props.preselectedProduct, (newVal) => {
  if (newVal) {
    form.value.productId = newVal.id;
  }
});

// Watch for dialog visibility to load products
watch(visible, (isVisible) => {
  if (isVisible && products.value.length === 0) {
    loadProducts();
  }
  if (isVisible && props.preselectedProduct) {
    form.value.productId = props.preselectedProduct.id;
  }
});

onMounted(() => {
  if (visible.value) {
    loadProducts();
  }
});
</script>

<style scoped>
.movement-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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

.w-full {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
