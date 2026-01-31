<template>
  <div class="form-grid">
    <div class="field-group">
      <div class="field">
        <label for="sku">SKU *</label>
        <InputText
          id="sku"
          v-model="localForm.sku"
          :disabled="disabled || !!localForm.id"
          class="w-full"
          placeholder="Codice univoco prodotto"
        />
      </div>

      <div class="field">
        <label for="name">Nome Prodotto *</label>
        <InputText
          id="name"
          v-model="localForm.name"
          :disabled="disabled"
          class="w-full"
          placeholder="Nome del prodotto"
        />
      </div>
    </div>

    <!-- Categorie con TreeSelect -->
    <div class="field">
      <label for="categories">Categorie</label>
      <TreeSelect
        id="categories"
        v-model="selectedCategories"
        :options="categoryTree"
        selectionMode="checkbox"
        placeholder="Seleziona una o più categorie"
        class="w-full"
        :disabled="disabled"
        :loading="loadingCategories"
        display="chip"
      />
    </div>

    <div class="field-group">
      <div class="field">
        <label for="type">Tipo Prodotto</label>
        <Dropdown
          id="type"
          v-model="localForm.type"
          :options="productTypes"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona tipo"
          class="w-full"
          :disabled="disabled"
        />
      </div>

      <div class="field">
        <label for="unit">Unità di Misura</label>
        <Dropdown
          id="unit"
          v-model="localForm.unit"
          :options="unitOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Seleziona unità"
          class="w-full"
          :disabled="disabled"
        />
      </div>
    </div>

    <div class="field">
      <label for="description">Descrizione</label>
      <Textarea
        id="description"
        v-model="localForm.description"
        rows="3"
        class="w-full"
        :disabled="disabled"
        placeholder="Descrizione del prodotto"
      />
    </div>

    <div class="field-group">
      <div class="field">
        <label for="price">Prezzo Vendita (€) *</label>
        <InputNumber
          id="price"
          v-model="localForm.price"
          mode="currency"
          currency="EUR"
          locale="it-IT"
          class="w-full"
          :disabled="disabled"
          :minFractionDigits="2"
          :maxFractionDigits="2"
        />
      </div>

      <div class="field">
        <label for="cost">Costo (€)</label>
        <InputNumber
          id="cost"
          v-model="localForm.cost"
          mode="currency"
          currency="EUR"
          locale="it-IT"
          class="w-full"
          :disabled="disabled"
          :minFractionDigits="2"
          :maxFractionDigits="2"
        />
      </div>
    </div>

    <div class="field-group">
      <div class="field">
        <label for="barcode">Barcode / EAN</label>
        <InputText
          id="barcode"
          v-model="localForm.barcode"
          :disabled="disabled"
          class="w-full"
          placeholder="Codice a barre"
        />
      </div>

      <div class="field">
        <label for="weight">Peso (kg)</label>
        <InputNumber
          id="weight"
          v-model="localForm.weight"
          class="w-full"
          :disabled="disabled"
          :minFractionDigits="0"
          :maxFractionDigits="3"
        />
      </div>
    </div>

    <div class="field-group">
      <div class="field">
        <label for="minStockLevel">Scorta Minima</label>
        <InputNumber
          id="minStockLevel"
          v-model="localForm.minStockLevel"
          class="w-full"
          :disabled="disabled"
          :min="0"
        />
      </div>

      <div class="field">
        <label for="reorderQuantity">Quantità Riordino</label>
        <InputNumber
          id="reorderQuantity"
          v-model="localForm.reorderQuantity"
          class="w-full"
          :disabled="disabled"
          :min="0"
        />
      </div>
    </div>

    <div class="field">
      <div class="checkbox-group">
        <div class="checkbox-item">
          <Checkbox id="isActive" v-model="localForm.isActive" :binary="true" :disabled="disabled" />
          <label for="isActive">Prodotto Attivo</label>
        </div>
        <div class="checkbox-item">
          <Checkbox id="isSellable" v-model="localForm.isSellable" :binary="true" :disabled="disabled" />
          <label for="isSellable">Vendibile</label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import TreeSelect from 'primevue/treeselect';
import api from '../services/api.service';

interface ProductForm {
  id?: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  categoryIds?: string[];
  type: 'SIMPLE' | 'WITH_VARIANTS' | 'DIGITAL' | 'RAW_MATERIAL';
  unit: string;
  barcode: string;
  weight: number | null;
  price: number;
  cost: number;
  minStockLevel: number;
  reorderQuantity: number;
  isActive: boolean;
  isSellable: boolean;
}

interface Props {
  modelValue: ProductForm;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: ProductForm): void;
}>();

const localForm = ref<ProductForm>({ ...props.modelValue });

// Categorie
const categoryTree = ref<any[]>([]);
const loadingCategories = ref(false);
const selectedCategories = ref<any>(null);

// Opzioni dropdown
const productTypes = [
  { label: 'Semplice', value: 'SIMPLE' },
  { label: 'Con Varianti', value: 'WITH_VARIANTS' },
  { label: 'Digitale', value: 'DIGITAL' },
  { label: 'Materia Prima', value: 'RAW_MATERIAL' },
];

const unitOptions = [
  { label: 'Pezzo (pz)', value: 'PZ' },
  { label: 'Chilogrammo (kg)', value: 'KG' },
  { label: 'Grammo (g)', value: 'G' },
  { label: 'Litro (L)', value: 'L' },
  { label: 'Millilitro (ml)', value: 'ML' },
  { label: 'Metro (m)', value: 'M' },
  { label: 'Centimetro (cm)', value: 'CM' },
  { label: 'Confezione', value: 'CONF' },
  { label: 'Scatola', value: 'BOX' },
];

// Carica categorie in formato albero
const loadCategories = async () => {
  try {
    loadingCategories.value = true;
    const response = await api.get('/product-categories?tree=true');

    if (response.success && response.data) {
      categoryTree.value = transformToTreeSelectFormat(response.data);
    }
  } catch (error) {
    console.error('Errore caricamento categorie:', error);
    categoryTree.value = [];
  } finally {
    loadingCategories.value = false;
  }
};

// Trasforma categorie in formato TreeSelect
const transformToTreeSelectFormat = (categories: any[]): any[] => {
  return categories.map(cat => ({
    key: cat.id,
    label: cat.name,
    data: cat,
    children: cat.children?.length ? transformToTreeSelectFormat(cat.children) : undefined,
  }));
};

// Sync props → local
watch(() => props.modelValue, (newVal) => {
  localForm.value = { ...newVal };
  // Se ci sono categoryIds, convertili per TreeSelect
  if (newVal.categoryIds?.length) {
    selectedCategories.value = newVal.categoryIds.reduce((acc: any, id: string) => {
      acc[id] = true;
      return acc;
    }, {});
  }
}, { deep: true });

// Sync local → emit
watch(localForm, (newVal) => {
  emit('update:modelValue', { ...newVal });
}, { deep: true });

// Sync selectedCategories → categoryIds
watch(selectedCategories, (newVal) => {
  if (newVal) {
    const ids = Object.keys(newVal).filter(key => newVal[key] === true);
    localForm.value.categoryIds = ids;
  } else {
    localForm.value.categoryIds = [];
  }
}, { deep: true });

onMounted(() => {
  loadCategories();
});
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  color: var(--color-gray-700, #374151);
  font-size: 0.875rem;
}

.field-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.w-full {
  width: 100%;
}

.checkbox-group {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item label {
  font-weight: 500;
  color: var(--color-gray-700, #374151);
  cursor: pointer;
}

/* Responsive */
@media (max-width: 640px) {
  .field-group {
    grid-template-columns: 1fr;
  }

  .checkbox-group {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
