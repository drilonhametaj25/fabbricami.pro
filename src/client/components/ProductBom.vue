<template>
  <div class="product-bom">
    <div class="bom-header">
      <p class="bom-description">
        Gestisci i componenti (altri prodotti) che compongono questo prodotto.
        Questi componenti verranno scalati automaticamente alla spedizione degli ordini.
      </p>
      <Button
        label="Aggiungi Componente"
        icon="pi pi-plus"
        size="small"
        @click="openAddComponent"
        :disabled="!productId"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>

    <!-- Empty State -->
    <div v-else-if="bomItems.length === 0" class="empty-state">
      <i class="pi pi-sitemap"></i>
      <p>Nessun componente associato a questo prodotto</p>
      <small>Aggiungi altri prodotti come componenti per creare una struttura BOM (Bill of Materials)</small>
    </div>

    <!-- BOM List -->
    <div v-else class="bom-list">
      <DataTable
        :value="bomItems"
        responsiveLayout="scroll"
        class="bom-table"
      >
        <Column header="Componente">
          <template #body="{ data }">
            <div class="component-info">
              <img
                v-if="data.componentProduct.mainImageUrl"
                :src="data.componentProduct.mainImageUrl"
                class="component-thumb"
                alt=""
              />
              <div class="component-details">
                <span class="component-name">{{ data.componentProduct.name }}</span>
                <span class="component-sku">{{ data.componentProduct.sku }}</span>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Quantita" style="width: 120px">
          <template #body="{ data }">
            <span>{{ data.quantity }} {{ data.unit }}</span>
          </template>
        </Column>

        <Column header="Scarto %" style="width: 100px">
          <template #body="{ data }">
            <Tag
              v-if="Number(data.scrapPercentage) > 0"
              :value="`${data.scrapPercentage}%`"
              severity="warning"
            />
            <span v-else class="text-muted">-</span>
          </template>
        </Column>

        <Column header="Costo Unit." style="width: 120px">
          <template #body="{ data }">
            <span>{{ formatCurrency(data.componentProduct.cost) }}</span>
          </template>
        </Column>

        <Column header="Costo Tot." style="width: 120px">
          <template #body="{ data }">
            <span class="cost-total">{{ formatCurrency(calculateComponentCost(data)) }}</span>
          </template>
        </Column>

        <Column header="Note" style="width: 200px">
          <template #body="{ data }">
            <span v-if="data.notes" class="notes-text">{{ data.notes }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>

        <Column header="Azioni" style="width: 100px">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-pencil"
                class="p-button-text p-button-sm"
                @click="editComponent(data)"
                v-tooltip="'Modifica'"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-sm p-button-danger"
                @click="confirmDelete(data)"
                v-tooltip="'Rimuovi'"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <!-- Riepilogo Costi -->
      <div class="bom-summary">
        <div class="summary-item">
          <span>Totale componenti:</span>
          <strong>{{ bomItems.length }}</strong>
        </div>
        <div class="summary-item">
          <span>Costo materiali BOM:</span>
          <strong class="cost-value">{{ formatCurrency(totalBomCost) }}</strong>
        </div>
      </div>
    </div>

    <!-- Dialog Aggiungi/Modifica Componente -->
    <Dialog
      v-model:visible="showComponentDialog"
      :header="editingComponent ? 'Modifica Componente' : 'Aggiungi Componente'"
      :style="{ width: '500px' }"
      modal
    >
      <div class="component-form">
        <div class="field" v-if="!editingComponent">
          <label for="productSelect">Prodotto Componente *</label>
          <Dropdown
            id="productSelect"
            v-model="componentForm.componentProductId"
            :options="availableProducts"
            optionLabel="name"
            optionValue="id"
            placeholder="Cerca prodotto..."
            filter
            class="w-full"
            :loading="loadingProducts"
            @change="validateComponentSelection"
          >
            <template #option="{ option }">
              <div class="product-option">
                <span class="option-name">{{ option.name }}</span>
                <span class="option-sku">{{ option.sku }}</span>
              </div>
            </template>
          </Dropdown>
          <small v-if="cycleWarning" class="field-warning">
            <i class="pi pi-exclamation-triangle"></i>
            {{ cycleWarning }}
          </small>
        </div>

        <div v-else class="field">
          <label>Componente</label>
          <div class="selected-component">
            <strong>{{ editingComponent.componentProduct.name }}</strong>
            <small>{{ editingComponent.componentProduct.sku }}</small>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="quantity">Quantita *</label>
            <InputNumber
              id="quantity"
              v-model="componentForm.quantity"
              :minFractionDigits="0"
              :maxFractionDigits="4"
              :min="0.0001"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="unit">Unita</label>
            <Dropdown
              id="unit"
              v-model="componentForm.unit"
              :options="unitOptions"
              placeholder="Seleziona"
              class="w-full"
            />
          </div>
        </div>

        <div class="field">
          <label for="scrapPercentage">Percentuale Scarto (%)</label>
          <InputNumber
            id="scrapPercentage"
            v-model="componentForm.scrapPercentage"
            suffix="%"
            :min="0"
            :max="100"
            :minFractionDigits="0"
            :maxFractionDigits="2"
            class="w-full"
          />
          <small class="field-help">
            Scarto previsto durante la produzione (es. 5% per perdite di lavorazione)
          </small>
        </div>

        <div class="field">
          <label for="notes">Note</label>
          <Textarea
            id="notes"
            v-model="componentForm.notes"
            rows="2"
            class="w-full"
            placeholder="Note aggiuntive sul componente..."
          />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="closeDialog" />
        <Button
          :label="editingComponent ? 'Aggiorna' : 'Aggiungi'"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!isFormValid"
          @click="saveComponent"
        />
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Props {
  productId?: string;
}

const props = defineProps<Props>();

const confirm = useConfirm();
const toast = useToast();

const loading = ref(false);
const saving = ref(false);
const loadingProducts = ref(false);
const bomItems = ref<any[]>([]);
const availableProducts = ref<any[]>([]);
const showComponentDialog = ref(false);
const editingComponent = ref<any>(null);
const cycleWarning = ref<string>('');

const unitOptions = ['pz', 'kg', 'g', 'l', 'ml', 'm', 'cm'];

const defaultForm = () => ({
  componentProductId: '',
  quantity: 1,
  unit: 'pz',
  scrapPercentage: 0,
  notes: '',
});

const componentForm = ref(defaultForm());

// Calcola costo totale BOM
const totalBomCost = computed(() => {
  return bomItems.value.reduce((sum, item) => {
    return sum + calculateComponentCost(item);
  }, 0);
});

// Validazione form
const isFormValid = computed(() => {
  if (editingComponent.value) {
    return componentForm.value.quantity > 0;
  }
  return (
    componentForm.value.componentProductId &&
    componentForm.value.quantity > 0 &&
    !cycleWarning.value
  );
});

// Calcola costo singolo componente
function calculateComponentCost(item: any): number {
  const qty = Number(item.quantity);
  const scrap = Number(item.scrapPercentage) || 0;
  const cost = Number(item.componentProduct.cost) || 0;
  return qty * (1 + scrap / 100) * cost;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
}

// Load BOM items
const loadBomItems = async () => {
  if (!props.productId) return;

  loading.value = true;
  try {
    const response = await api.get(`/products/${props.productId}/bom`);
    if (response.success) {
      bomItems.value = response.data;
    }
  } catch (error) {
    console.error('Error loading BOM:', error);
  } finally {
    loading.value = false;
  }
};

// Load available products for dropdown (escludi prodotto corrente)
const loadAvailableProducts = async () => {
  loadingProducts.value = true;
  try {
    const response = await api.get('/products?limit=9999&isActive=true');
    if (response.success) {
      // Filtra il prodotto corrente e i prodotti gia presenti nel BOM
      const existingComponentIds = new Set(bomItems.value.map((b) => b.componentProductId));
      availableProducts.value = response.data.filter(
        (p: any) => p.id !== props.productId && !existingComponentIds.has(p.id)
      );
    }
  } catch (error) {
    console.error('Error loading products:', error);
  } finally {
    loadingProducts.value = false;
  }
};

// Verifica cicli quando si seleziona un componente
const validateComponentSelection = async () => {
  const componentId = componentForm.value.componentProductId;
  if (!props.productId || !componentId) {
    cycleWarning.value = '';
    return;
  }

  try {
    const response = await api.post(`/products/${props.productId}/bom/validate`, {
      componentProductId: componentId,
    });

    if (response.success && response.data) {
      if (!response.data.valid) {
        cycleWarning.value = response.data.message || 'Questo componente creerebbe un ciclo nel BOM';
      } else {
        cycleWarning.value = '';
      }
    }
  } catch (error) {
    cycleWarning.value = 'Errore nella validazione';
  }
};

function openAddComponent() {
  editingComponent.value = null;
  componentForm.value = defaultForm();
  cycleWarning.value = '';
  showComponentDialog.value = true;

  if (availableProducts.value.length === 0) {
    loadAvailableProducts();
  }
}

function editComponent(item: any) {
  editingComponent.value = item;
  componentForm.value = {
    componentProductId: item.componentProductId,
    quantity: Number(item.quantity),
    unit: item.unit,
    scrapPercentage: Number(item.scrapPercentage) || 0,
    notes: item.notes || '',
  };
  cycleWarning.value = '';
  showComponentDialog.value = true;
}

async function saveComponent() {
  if (!props.productId || !isFormValid.value) return;

  saving.value = true;
  try {
    const data = {
      componentProductId: editingComponent.value
        ? editingComponent.value.componentProductId
        : componentForm.value.componentProductId,
      quantity: componentForm.value.quantity,
      unit: componentForm.value.unit,
      scrapPercentage: componentForm.value.scrapPercentage,
      notes: componentForm.value.notes || null,
    };

    if (editingComponent.value) {
      await api.put(
        `/products/${props.productId}/bom/${editingComponent.value.componentProductId}`,
        data
      );
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Componente aggiornato',
        life: 2000,
      });
    } else {
      await api.post(`/products/${props.productId}/bom`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiunto',
        detail: 'Componente aggiunto al BOM',
        life: 2000,
      });
    }

    closeDialog();
    await loadBomItems();
    // Ricarica anche la lista prodotti disponibili
    await loadAvailableProducts();
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
}

function closeDialog() {
  showComponentDialog.value = false;
  editingComponent.value = null;
  cycleWarning.value = '';
}

// Conferma eliminazione
function confirmDelete(item: any) {
  confirm.require({
    message: `Rimuovere "${item.componentProduct.name}" dal BOM?`,
    header: 'Conferma Rimozione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteComponent(item),
  });
}

async function deleteComponent(item: any) {
  if (!props.productId) return;

  try {
    await api.delete(`/products/${props.productId}/bom/${item.componentProductId}`);
    toast.add({
      severity: 'success',
      summary: 'Rimosso',
      detail: 'Componente rimosso dal BOM',
      life: 2000,
    });
    await loadBomItems();
    await loadAvailableProducts();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante la rimozione',
      life: 3000,
    });
  }
}

// Watch for productId changes
watch(
  () => props.productId,
  (newId) => {
    if (newId) {
      loadBomItems();
    } else {
      bomItems.value = [];
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.productId) {
    loadBomItems();
  }
});
</script>

<style scoped>
.product-bom {
  padding: 1rem 0;
}

.bom-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.bom-description {
  margin: 0;
  color: var(--color-gray-600, #64748b);
  font-size: 0.9rem;
  max-width: 70%;
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

.bom-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.component-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.component-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.component-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.component-name {
  font-weight: 500;
}

.component-sku {
  font-size: 0.8rem;
  color: var(--color-gray-500, #64748b);
}

.cost-total {
  font-weight: 600;
  color: var(--color-success, #059669);
}

.text-muted {
  color: var(--color-gray-400, #94a3b8);
}

.notes-text {
  font-size: 0.85rem;
  color: var(--color-gray-600, #64748b);
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.bom-summary {
  display: flex;
  justify-content: flex-end;
  gap: 2rem;
  padding: 1rem;
  background: var(--color-gray-100, #f1f5f9);
  border-radius: var(--border-radius-md, 0.5rem);
  margin-top: 1rem;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-item span {
  color: var(--color-gray-600, #64748b);
}

.cost-value {
  color: var(--color-success, #059669);
}

/* Form Styles */
.component-form {
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

.field-help {
  display: block;
  font-size: 0.8rem;
  color: var(--color-gray-500, #64748b);
}

.field-warning {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--color-warning, #f59e0b);
}

.field-warning .pi-exclamation-triangle {
  color: var(--color-warning, #f59e0b);
}

.selected-component {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: var(--color-gray-100, #f1f5f9);
  border-radius: var(--border-radius-sm, 0.25rem);
}

.selected-component small {
  color: var(--color-gray-500, #64748b);
}

.product-option {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.option-name {
  font-weight: 500;
}

.option-sku {
  color: var(--color-gray-500, #64748b);
  font-size: 0.85rem;
}

.w-full {
  width: 100%;
}
</style>
