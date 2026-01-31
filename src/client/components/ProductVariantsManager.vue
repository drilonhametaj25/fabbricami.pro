<template>
  <div class="variants-manager">
    <!-- Header -->
    <div class="variants-header">
      <div class="header-info">
        <h4>Varianti Prodotto</h4>
        <Badge :value="variants.length" severity="info" v-if="variants.length > 0" />
      </div>
      <Button
        icon="pi pi-plus"
        label="Nuova Variante"
        @click="openCreateDialog"
      />
    </div>

    <!-- Info su Attributi -->
    <div class="attributes-info" v-if="allAttributes.length > 0">
      <span class="label">Attributi utilizzati:</span>
      <Tag v-for="attr in allAttributes" :key="attr" :value="attr" severity="info" class="mr-2" />
    </div>

    <!-- Variants Table -->
    <DataTable
      v-if="variants.length > 0"
      :value="variants"
      :loading="loading"
      stripedRows
      class="variants-table"
    >
      <Column header="Immagine" style="width: 80px">
        <template #body="{ data }">
          <img
            v-if="data.mainImageUrl"
            :src="data.mainImageUrl"
            :alt="data.name"
            class="variant-thumb"
            @error="onImageError($event)"
          />
          <div v-else class="no-image">
            <i class="pi pi-image"></i>
          </div>
        </template>
      </Column>

      <Column field="sku" header="SKU" sortable style="width: 150px" />

      <Column field="name" header="Nome" sortable />

      <Column header="Attributi">
        <template #body="{ data }">
          <div class="attributes-list">
            <Tag
              v-for="(value, key) in data.attributes"
              :key="key"
              :value="`${key}: ${value}`"
              severity="secondary"
              class="mr-1 mb-1"
            />
          </div>
        </template>
      </Column>

      <Column header="Prezzo" style="width: 120px">
        <template #body="{ data }">
          <span v-if="data.webPrice">{{ formatCurrency(data.webPrice) }}</span>
          <span v-else-if="data.priceDelta !== 0" class="price-delta">
            {{ data.priceDelta > 0 ? '+' : '' }}{{ formatCurrency(data.priceDelta) }}
          </span>
          <span v-else class="text-muted">Base</span>
        </template>
      </Column>

      <Column header="Stock" style="width: 100px">
        <template #body="{ data }">
          <span :class="getStockClass(data)">{{ getTotalStock(data) }}</span>
        </template>
      </Column>

      <Column header="Attivo" style="width: 80px">
        <template #body="{ data }">
          <Tag :value="data.isActive ? 'Si' : 'No'" :severity="data.isActive ? 'success' : 'danger'" />
        </template>
      </Column>

      <Column header="Azioni" style="width: 120px">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              icon="pi pi-pencil"
              class="p-button-rounded p-button-sm p-button-text"
              v-tooltip.top="'Modifica'"
              @click="editVariant(data)"
            />
            <Button
              icon="pi pi-box"
              class="p-button-rounded p-button-sm p-button-text p-button-info"
              v-tooltip.top="'Giacenze'"
              @click="manageInventory(data)"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-rounded p-button-sm p-button-text p-button-danger"
              v-tooltip.top="'Elimina'"
              @click="confirmDelete(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <i class="pi pi-th-large"></i>
      <p>Nessuna variante</p>
      <small>Aggiungi varianti per differenziare il prodotto (es. colore, taglia)</small>
      <Button
        icon="pi pi-plus"
        label="Crea Prima Variante"
        class="p-button-outlined mt-3"
        @click="openCreateDialog"
      />
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? 'Modifica Variante' : 'Nuova Variante'"
      :modal="true"
      :style="{ width: '700px', maxWidth: '95vw' }"
    >
      <div class="variant-form">
        <!-- Basic Info -->
        <div class="form-section">
          <h5>Informazioni Base</h5>
          <div class="form-grid">
            <div class="field">
              <label>SKU *</label>
              <InputText v-model="form.sku" class="w-full" :disabled="isEditing" />
            </div>
            <div class="field">
              <label>Nome *</label>
              <InputText v-model="form.name" class="w-full" />
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Barcode</label>
              <InputText v-model="form.barcode" class="w-full" />
            </div>
            <div class="field">
              <label>
                <Checkbox v-model="form.isActive" :binary="true" class="mr-2" />
                Variante Attiva
              </label>
            </div>
          </div>
        </div>

        <!-- Attributes -->
        <div class="form-section">
          <h5>Attributi</h5>
          <div class="attributes-editor">
            <div
              v-for="(attr, index) in form.attributesList"
              :key="index"
              class="attribute-row"
            >
              <InputText
                v-model="attr.key"
                placeholder="Nome (es. Colore)"
                class="attr-key"
              />
              <InputText
                v-model="attr.value"
                placeholder="Valore (es. Rosso)"
                class="attr-value"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-rounded p-button-sm p-button-text p-button-danger"
                @click="removeAttribute(index)"
              />
            </div>
            <Button
              icon="pi pi-plus"
              label="Aggiungi Attributo"
              class="p-button-outlined p-button-sm"
              @click="addAttribute"
            />
          </div>
        </div>

        <!-- Pricing -->
        <div class="form-section">
          <h5>Prezzi</h5>
          <div class="form-grid">
            <div class="field">
              <label>Prezzo Web (specifico)</label>
              <InputNumber
                v-model="form.webPrice"
                mode="currency"
                currency="EUR"
                locale="it-IT"
                class="w-full"
              />
              <small>Lascia vuoto per usare prezzo base + delta</small>
            </div>
            <div class="field">
              <label>Delta Prezzo</label>
              <InputNumber
                v-model="form.priceDelta"
                mode="currency"
                currency="EUR"
                locale="it-IT"
                class="w-full"
              />
              <small>Differenza rispetto al prezzo base</small>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Delta Costo</label>
              <InputNumber
                v-model="form.costDelta"
                mode="currency"
                currency="EUR"
                locale="it-IT"
                class="w-full"
              />
            </div>
            <div class="field">
              <label>
                <Checkbox v-model="form.webActive" :binary="true" class="mr-2" />
                Pubblicato su Web
              </label>
            </div>
          </div>
        </div>

        <!-- Physical -->
        <div class="form-section">
          <h5>Caratteristiche Fisiche</h5>
          <div class="form-grid">
            <div class="field">
              <label>Peso (kg)</label>
              <InputNumber
                v-model="form.weight"
                :minFractionDigits="3"
                :maxFractionDigits="3"
                class="w-full"
              />
            </div>
            <div class="field">
              <label>Dimensioni (cm)</label>
              <div class="dimensions-grid">
                <InputNumber v-model="form.width" placeholder="L" :min="0" />
                <InputNumber v-model="form.height" placeholder="H" :min="0" />
                <InputNumber v-model="form.depth" placeholder="P" :min="0" />
              </div>
            </div>
          </div>
        </div>

        <!-- Image -->
        <div class="form-section">
          <h5>Immagine</h5>
          <div class="image-section">
            <div class="field flex-1">
              <label>URL Immagine</label>
              <InputText v-model="form.mainImageUrl" class="w-full" placeholder="https://..." />
            </div>
            <div class="image-preview" v-if="form.mainImageUrl">
              <img :src="form.mainImageUrl" alt="Preview" @error="onImageError($event)" />
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="form-section">
          <h5>Descrizione</h5>
          <Textarea v-model="form.webDescription" rows="3" class="w-full" placeholder="Descrizione specifica per questa variante..." />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="dialogVisible = false" />
        <Button
          :label="isEditing ? 'Aggiorna' : 'Crea'"
          icon="pi pi-check"
          @click="saveVariant"
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- Inventory Dialog -->
    <Dialog
      v-model:visible="inventoryDialogVisible"
      :header="`Giacenze - ${selectedVariant?.name || ''}`"
      :modal="true"
      :style="{ width: '600px', maxWidth: '95vw' }"
    >
      <ProductInventoryManager
        v-if="selectedVariant"
        :product-id="productId"
        :variant-id="selectedVariant.id"
      />
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import ProductInventoryManager from './ProductInventoryManager.vue';
import api from '../services/api.service';

interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  barcode?: string;
  costDelta: number;
  priceDelta: number;
  weight?: number;
  dimensions?: { width?: number; height?: number; depth?: number };
  webPrice?: number;
  webActive: boolean;
  mainImageUrl?: string;
  webDescription?: string;
  isActive: boolean;
  inventory?: any[];
}

interface Props {
  productId: string;
  productSku: string;
  productPrice: number;
}

const props = defineProps<Props>();
const confirm = useConfirm();
const toast = useToast();

const variants = ref<ProductVariant[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const inventoryDialogVisible = ref(false);
const isEditing = ref(false);
const selectedVariant = ref<ProductVariant | null>(null);

const getDefaultForm = () => ({
  id: '',
  sku: '',
  name: '',
  barcode: '',
  costDelta: 0,
  priceDelta: 0,
  weight: null as number | null,
  width: null as number | null,
  height: null as number | null,
  depth: null as number | null,
  webPrice: null as number | null,
  webActive: true,
  mainImageUrl: '',
  webDescription: '',
  isActive: true,
  attributesList: [{ key: '', value: '' }] as Array<{ key: string; value: string }>,
});

const form = reactive(getDefaultForm());

// Computed: all unique attribute keys across variants
const allAttributes = computed(() => {
  const attrs = new Set<string>();
  variants.value.forEach(v => {
    Object.keys(v.attributes || {}).forEach(k => attrs.add(k));
  });
  return Array.from(attrs);
});

const loadVariants = async () => {
  if (!props.productId) return;

  try {
    loading.value = true;
    const response = await api.get(`/products/${props.productId}/variants`);
    if (response.success) {
      variants.value = response.data || [];
    }
  } catch (error) {
    console.error('Error loading variants:', error);
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  isEditing.value = false;
  Object.assign(form, getDefaultForm());
  // Suggerisci SKU basato sul prodotto
  form.sku = `${props.productSku}-`;
  dialogVisible.value = true;
};

const editVariant = (variant: ProductVariant) => {
  isEditing.value = true;
  Object.assign(form, {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    barcode: variant.barcode || '',
    costDelta: Number(variant.costDelta) || 0,
    priceDelta: Number(variant.priceDelta) || 0,
    weight: variant.weight ? Number(variant.weight) : null,
    width: variant.dimensions?.width || null,
    height: variant.dimensions?.height || null,
    depth: variant.dimensions?.depth || null,
    webPrice: variant.webPrice ? Number(variant.webPrice) : null,
    webActive: variant.webActive,
    mainImageUrl: variant.mainImageUrl || '',
    webDescription: variant.webDescription || '',
    isActive: variant.isActive,
    attributesList: Object.entries(variant.attributes || {}).map(([key, value]) => ({
      key,
      value: String(value),
    })),
  });

  if (form.attributesList.length === 0) {
    form.attributesList = [{ key: '', value: '' }];
  }

  dialogVisible.value = true;
};

const addAttribute = () => {
  form.attributesList.push({ key: '', value: '' });
};

const removeAttribute = (index: number) => {
  form.attributesList.splice(index, 1);
  if (form.attributesList.length === 0) {
    form.attributesList = [{ key: '', value: '' }];
  }
};

const saveVariant = async () => {
  // Validation
  if (!form.sku.trim() || !form.name.trim()) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'SKU e Nome sono obbligatori',
      life: 3000,
    });
    return;
  }

  // Build attributes object
  const attributes: Record<string, string> = {};
  form.attributesList.forEach(attr => {
    if (attr.key.trim() && attr.value.trim()) {
      attributes[attr.key.trim()] = attr.value.trim();
    }
  });

  const data = {
    sku: form.sku,
    name: form.name,
    attributes,
    barcode: form.barcode || undefined,
    costDelta: form.costDelta,
    priceDelta: form.priceDelta,
    weight: form.weight,
    dimensions: (form.width || form.height || form.depth) ? {
      width: form.width,
      height: form.height,
      depth: form.depth,
    } : undefined,
    webPrice: form.webPrice,
    webActive: form.webActive,
    mainImageUrl: form.mainImageUrl || undefined,
    webDescription: form.webDescription || undefined,
    isActive: form.isActive,
  };

  try {
    saving.value = true;
    let response;

    if (isEditing.value) {
      response = await api.put(`/products/${props.productId}/variants/${form.id}`, data);
    } else {
      response = await api.post(`/products/${props.productId}/variants`, data);
    }

    if (response.success) {
      await loadVariants();
      dialogVisible.value = false;
      toast.add({
        severity: 'success',
        summary: isEditing.value ? 'Variante aggiornata' : 'Variante creata',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore salvataggio variante',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (variant: ProductVariant) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare la variante "${variant.name}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteVariant(variant),
  });
};

const deleteVariant = async (variant: ProductVariant) => {
  try {
    const response = await api.delete(`/products/${props.productId}/variants/${variant.id}`);
    if (response.success) {
      variants.value = variants.value.filter(v => v.id !== variant.id);
      toast.add({
        severity: 'success',
        summary: 'Variante eliminata',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  }
};

const manageInventory = (variant: ProductVariant) => {
  selectedVariant.value = variant;
  inventoryDialogVisible.value = true;
};

const getTotalStock = (variant: ProductVariant) => {
  if (!variant.inventory || variant.inventory.length === 0) return 0;
  return variant.inventory.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
};

const getStockClass = (variant: ProductVariant) => {
  const stock = getTotalStock(variant);
  if (stock <= 0) return 'text-danger';
  if (stock < 10) return 'text-warning';
  return 'text-success';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZWVlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiIGZvbnQtc2l6ZT0iMTAiPk5vIEltZzwvdGV4dD48L3N2Zz4=';
};

watch(() => props.productId, () => {
  loadVariants();
}, { immediate: true });

onMounted(() => {
  if (props.productId) {
    loadVariants();
  }
});
</script>

<style scoped>
.variants-manager {
  padding: 1rem 0;
}

.variants-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-info h4 {
  margin: 0;
  color: #1e293b;
}

.attributes-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f1f5f9;
  border-radius: 6px;
}

.attributes-info .label {
  font-size: 0.85rem;
  color: #64748b;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mr-1 {
  margin-right: 0.25rem;
}

.mb-1 {
  margin-bottom: 0.25rem;
}

.mt-3 {
  margin-top: 1rem;
}

.variants-table {
  margin-top: 1rem;
}

.variant-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.no-image {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 6px;
  color: #9ca3af;
}

.attributes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.price-delta {
  color: #64748b;
  font-style: italic;
}

.text-muted {
  color: #9ca3af;
}

.text-success {
  color: #22c55e;
  font-weight: 600;
}

.text-warning {
  color: #f59e0b;
  font-weight: 600;
}

.text-danger {
  color: #ef4444;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #9ca3af;
  text-align: center;
  background: #f8fafc;
  border-radius: 8px;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #64748b;
}

/* Form Styles */
.variant-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.form-section h5 {
  margin: 0 0 1rem 0;
  color: #475569;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
}

.field small {
  color: #64748b;
  font-size: 0.75rem;
}

.attributes-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.attribute-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.attr-key {
  flex: 1;
}

.attr-value {
  flex: 1;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.image-section {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.image-section .flex-1 {
  flex: 1;
}

.image-preview {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.w-full {
  width: 100%;
}
</style>
