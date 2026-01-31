<template>
  <div class="materials-page">
    <PageHeader
      title="Gestione Materiali"
      subtitle="Gestisci i materiali utilizzati nella produzione"
      icon="pi pi-cog"
    >
      <template #actions>
        <Button label="Nuovo Materiale" icon="pi pi-plus" @click="openCreateDialog" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Totale Materiali"
          :value="stats.totalMaterials"
          icon="pi pi-cog"
          variant="primary"
          format="number"
          subtitle="nel magazzino"
        />
        <StatsCard
          label="Valore Inventario"
          :value="stats.totalInventoryValue"
          icon="pi pi-euro"
          variant="success"
          format="currency"
          subtitle="valore materiali"
        />
        <StatsCard
          label="Sotto Soglia"
          :value="stats.lowStockCount"
          icon="pi pi-exclamation-triangle"
          variant="warning"
          format="number"
          subtitle="materiali da riordinare"
        />
        <StatsCard
          label="Categorie"
          :value="stats.categoriesCount"
          icon="pi pi-tags"
          variant="info"
          format="number"
          subtitle="tipologie materiali"
        />
      </div>
    </section>

    <!-- Alert Scorte Basse -->
    <section v-if="lowStockMaterials.length > 0" class="alert-section">
      <div class="alert-card alert-card--warning">
        <div class="alert-card__header">
          <i class="pi pi-exclamation-triangle alert-card__icon"></i>
          <div class="alert-card__content">
            <h3 class="alert-card__title">Materiali Sotto Soglia</h3>
            <p class="alert-card__subtitle">{{ lowStockMaterials.length }} materiali richiedono riordino</p>
          </div>
          <Button label="Vedi Tutti" icon="pi pi-arrow-right" class="p-button-outlined p-button-warning" @click="filterLowStock" />
        </div>
      </div>
    </section>

    <!-- Filters & Table -->
    <section class="table-section">
      <div class="table-card">
        <div class="table-toolbar">
          <div class="search-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="search"
              placeholder="Cerca per SKU o Nome..."
              @input="debouncedLoad"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedCategory"
              :options="categories"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutte le categorie"
              @change="loadMaterials"
              showClear
              class="filter-dropdown"
            />
            <Button
              :icon="showLowStockOnly ? 'pi pi-filter-slash' : 'pi pi-filter'"
              :class="['p-button-outlined', showLowStockOnly ? 'p-button-warning' : '']"
              :label="showLowStockOnly ? 'Tutti' : 'Solo Sotto Soglia'"
              @click="toggleLowStockFilter"
            />
          </div>
        </div>

        <DataTable
          :value="materials"
          :loading="loading"
          paginator
          :rows="20"
          :totalRecords="totalRecords"
          :lazy="true"
          @page="onPage"
          @sort="onSort"
          responsiveLayout="scroll"
          class="custom-table"
          :rowHover="true"
        >
          <Column field="sku" header="SKU" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="sku-badge">{{ data.sku }}</span>
            </template>
          </Column>
          <Column field="name" header="Nome" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="material-name">{{ data.name }}</div>
              <div v-if="data.isConsumable" class="material-tag">
                <Tag severity="secondary" value="Consumabile" />
              </div>
            </template>
          </Column>
          <Column field="category" header="Categoria" sortable style="min-width: 120px">
            <template #body="{ data }">
              <Tag v-if="data.category" severity="info">{{ data.category }}</Tag>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column field="cost" header="Costo Unit." sortable style="min-width: 100px">
            <template #body="{ data }">
              <span class="cost">{{ formatCurrency(data.cost) }}</span>
              <span class="unit-label">/{{ data.unit }}</span>
            </template>
          </Column>
          <Column field="currentStock" header="Stock" sortable style="min-width: 120px">
            <template #body="{ data }">
              <div class="stock-cell" :class="{ 'stock-cell--low': data.currentStock <= data.minStock }">
                <span class="stock-value">{{ data.currentStock }}</span>
                <span class="stock-min">/ {{ data.minStock }}</span>
              </div>
              <Tag v-if="data.currentStock <= data.minStock" severity="danger" class="stock-alert">
                Sotto Soglia
              </Tag>
            </template>
          </Column>
          <Column field="supplier.businessName" header="Fornitore" style="min-width: 150px">
            <template #body="{ data }">
              <span v-if="data.supplier">{{ data.supplier.businessName }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 160px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-plus"
                  class="p-button-rounded p-button-text action-btn action-btn--stock"
                  @click="openStockDialog(data, 'IN')"
                  v-tooltip.top="'Carico'"
                />
                <Button
                  icon="pi pi-minus"
                  class="p-button-rounded p-button-text action-btn action-btn--stock-out"
                  @click="openStockDialog(data, 'OUT')"
                  v-tooltip.top="'Scarico'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editMaterial(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="deleteMaterial(data)"
                  v-tooltip.top="'Elimina'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox empty-state__icon"></i>
              <p class="empty-state__text">Nessun materiale trovato</p>
              <Button label="Crea il primo materiale" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Dialog Create/Edit Material -->
    <Dialog
      v-model:visible="showMaterialDialog"
      :header="selectedMaterial?.id ? 'Modifica Materiale' : 'Nuovo Materiale'"
      :style="{ width: '600px' }"
      :modal="true"
      class="material-dialog"
    >
      <form @submit.prevent="handleSave">
        <div class="form-grid">
          <div class="form-group">
            <label for="sku">SKU *</label>
            <InputText id="sku" v-model="form.sku" required :disabled="!!selectedMaterial?.id" />
          </div>
          <div class="form-group">
            <label for="name">Nome *</label>
            <InputText id="name" v-model="form.name" required />
          </div>
          <div class="form-group form-group--full">
            <label for="description">Descrizione</label>
            <Textarea id="description" v-model="form.description" rows="2" />
          </div>
          <div class="form-group">
            <label for="category">Categoria</label>
            <InputText id="category" v-model="form.category" />
          </div>
          <div class="form-group">
            <label for="unit">Unita di Misura</label>
            <Dropdown
              id="unit"
              v-model="form.unit"
              :options="unitOptions"
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div class="form-group">
            <label for="cost">Costo Unitario *</label>
            <InputNumber id="cost" v-model="form.cost" mode="currency" currency="EUR" locale="it-IT" required />
          </div>
          <div class="form-group">
            <label for="supplierId">Fornitore</label>
            <Dropdown
              id="supplierId"
              v-model="form.supplierId"
              :options="suppliers"
              optionLabel="businessName"
              optionValue="id"
              placeholder="Seleziona fornitore"
              showClear
            />
          </div>
          <div class="form-group">
            <label for="minStock">Scorta Minima</label>
            <InputNumber id="minStock" v-model="form.minStock" :min="0" />
          </div>
          <div class="form-group">
            <label for="currentStock">Stock Attuale</label>
            <InputNumber id="currentStock" v-model="form.currentStock" :min="0" :disabled="!!selectedMaterial?.id" />
          </div>
          <div class="form-group">
            <label for="reorderPoint">Punto Riordino</label>
            <InputNumber id="reorderPoint" v-model="form.reorderPoint" :min="0" />
          </div>
          <div class="form-group">
            <label for="reorderQuantity">Quantita Riordino</label>
            <InputNumber id="reorderQuantity" v-model="form.reorderQuantity" :min="0" />
          </div>
          <div class="form-group">
            <label for="leadTimeDays">Lead Time (giorni)</label>
            <InputNumber id="leadTimeDays" v-model="form.leadTimeDays" :min="0" />
          </div>
          <div class="form-group form-group--checkbox">
            <Checkbox id="isConsumable" v-model="form.isConsumable" :binary="true" />
            <label for="isConsumable">Materiale Consumabile (guanti, detergenti, ecc.)</label>
          </div>
        </div>
      </form>
      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="showMaterialDialog = false" />
        <Button label="Salva" icon="pi pi-check" @click="handleSave" :loading="saving" />
      </template>
    </Dialog>

    <!-- Dialog Adjust Stock -->
    <Dialog
      v-model:visible="showStockDialog"
      :header="stockType === 'IN' ? 'Carico Materiale' : 'Scarico Materiale'"
      :style="{ width: '400px' }"
      :modal="true"
    >
      <div class="stock-form">
        <div class="stock-info">
          <span class="stock-info__label">Materiale:</span>
          <span class="stock-info__value">{{ stockMaterial?.name }}</span>
        </div>
        <div class="stock-info">
          <span class="stock-info__label">Stock Attuale:</span>
          <span class="stock-info__value">{{ stockMaterial?.currentStock }} {{ stockMaterial?.unit }}</span>
        </div>
        <div class="form-group">
          <label for="stockQty">Quantita *</label>
          <InputNumber id="stockQty" v-model="stockQuantity" :min="1" required />
        </div>
        <div class="form-group">
          <label for="stockRef">Riferimento</label>
          <InputText id="stockRef" v-model="stockReference" placeholder="es. Ordine #123" />
        </div>
        <div class="form-group">
          <label for="stockNotes">Note</label>
          <Textarea id="stockNotes" v-model="stockNotes" rows="2" />
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="showStockDialog = false" />
        <Button
          :label="stockType === 'IN' ? 'Carica' : 'Scarica'"
          :icon="stockType === 'IN' ? 'pi pi-plus' : 'pi pi-minus'"
          :class="stockType === 'IN' ? 'p-button-success' : 'p-button-warning'"
          @click="handleStockAdjust"
          :loading="saving"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';

const toast = useToast();
const confirm = useConfirm();

// State
const loading = ref(false);
const saving = ref(false);
const materials = ref<any[]>([]);
const totalRecords = ref(0);
const search = ref('');
const selectedCategory = ref(null);
const page = ref(1);
const sortBy = ref('name');
const sortOrder = ref<'asc' | 'desc'>('asc');
const showLowStockOnly = ref(false);
const lowStockMaterials = ref<any[]>([]);
const categories = ref<{ label: string; value: string }[]>([]);
const suppliers = ref<any[]>([]);

const stats = ref({
  totalMaterials: 0,
  lowStockCount: 0,
  categoriesCount: 0,
  totalInventoryValue: 0,
});

// Dialog state
const showMaterialDialog = ref(false);
const selectedMaterial = ref<any>(null);
const form = reactive({
  sku: '',
  name: '',
  description: '',
  category: '',
  unit: 'pz',
  cost: 0,
  minStock: 0,
  currentStock: 0,
  reorderPoint: 0,
  reorderQuantity: 0,
  leadTimeDays: 7,
  supplierId: null as string | null,
  isConsumable: false,
});

// Stock dialog state
const showStockDialog = ref(false);
const stockMaterial = ref<any>(null);
const stockType = ref<'IN' | 'OUT'>('IN');
const stockQuantity = ref(1);
const stockReference = ref('');
const stockNotes = ref('');

const unitOptions = [
  { label: 'Pezzi (pz)', value: 'pz' },
  { label: 'Chilogrammi (kg)', value: 'kg' },
  { label: 'Grammi (g)', value: 'g' },
  { label: 'Litri (l)', value: 'l' },
  { label: 'Millilitri (ml)', value: 'ml' },
  { label: 'Metri (m)', value: 'm' },
  { label: 'Centimetri (cm)', value: 'cm' },
];

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout>;
const debouncedLoad = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadMaterials();
  }, 300);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const loadMaterials = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(search.value && { search: search.value }),
      ...(selectedCategory.value && { category: selectedCategory.value }),
      ...(showLowStockOnly.value && { lowStock: 'true' }),
    });

    const response = await api.get(`/materials?${params.toString()}`);

    if (response.success) {
      materials.value = response.data;
      totalRecords.value = response.pagination?.total || response.data.length;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dei materiali',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const loadStats = async () => {
  try {
    const response = await api.get('/materials/stats');
    if (response.success) {
      stats.value = response.data;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadLowStock = async () => {
  try {
    const response = await api.get('/materials/low-stock');
    if (response.success) {
      lowStockMaterials.value = response.data;
    }
  } catch (error) {
    console.error('Error loading low stock:', error);
  }
};

const loadCategories = async () => {
  try {
    const response = await api.get('/materials/categories');
    if (response.success) {
      categories.value = response.data.map((c: string) => ({ label: c, value: c }));
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }
};

const loadSuppliers = async () => {
  try {
    const response = await api.get('/suppliers?limit=100');
    if (response.success) {
      suppliers.value = response.data.items || response.data;
    }
  } catch (error) {
    console.error('Error loading suppliers:', error);
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadMaterials();
};

const onSort = (event: any) => {
  sortBy.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadMaterials();
};

const filterLowStock = () => {
  showLowStockOnly.value = true;
  loadMaterials();
};

const toggleLowStockFilter = () => {
  showLowStockOnly.value = !showLowStockOnly.value;
  loadMaterials();
};

const resetForm = () => {
  form.sku = '';
  form.name = '';
  form.description = '';
  form.category = '';
  form.unit = 'pz';
  form.cost = 0;
  form.minStock = 0;
  form.currentStock = 0;
  form.reorderPoint = 0;
  form.reorderQuantity = 0;
  form.leadTimeDays = 7;
  form.supplierId = null;
  form.isConsumable = false;
};

const openCreateDialog = () => {
  selectedMaterial.value = null;
  resetForm();
  showMaterialDialog.value = true;
};

const editMaterial = (material: any) => {
  selectedMaterial.value = material;
  form.sku = material.sku;
  form.name = material.name;
  form.description = material.description || '';
  form.category = material.category || '';
  form.unit = material.unit;
  form.cost = Number(material.cost);
  form.minStock = material.minStock;
  form.currentStock = material.currentStock;
  form.reorderPoint = material.reorderPoint;
  form.reorderQuantity = material.reorderQuantity;
  form.leadTimeDays = material.leadTimeDays;
  form.supplierId = material.supplierId;
  form.isConsumable = material.isConsumable;
  showMaterialDialog.value = true;
};

const deleteMaterial = (material: any) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare ${material.name}?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/materials/${material.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminato',
          detail: 'Materiale eliminato con successo',
          life: 3000,
        });
        loadMaterials();
        loadStats();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message || 'Errore durante l\'eliminazione',
          life: 3000,
        });
      }
    },
  });
};

const handleSave = async () => {
  try {
    saving.value = true;

    const data = {
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      unit: form.unit,
      cost: form.cost,
      minStock: form.minStock,
      currentStock: form.currentStock,
      reorderPoint: form.reorderPoint,
      reorderQuantity: form.reorderQuantity,
      leadTimeDays: form.leadTimeDays,
      supplierId: form.supplierId || undefined,
      isConsumable: form.isConsumable,
    };

    if (selectedMaterial.value?.id) {
      await api.patch(`/materials/${selectedMaterial.value.id}`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Materiale aggiornato con successo',
        life: 3000,
      });
    } else {
      await api.post('/materials', data);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Materiale creato con successo',
        life: 3000,
      });
    }

    showMaterialDialog.value = false;
    loadMaterials();
    loadStats();
    loadCategories();
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

const openStockDialog = (material: any, type: 'IN' | 'OUT') => {
  stockMaterial.value = material;
  stockType.value = type;
  stockQuantity.value = 1;
  stockReference.value = '';
  stockNotes.value = '';
  showStockDialog.value = true;
};

const handleStockAdjust = async () => {
  try {
    saving.value = true;

    await api.post(`/materials/${stockMaterial.value.id}/adjust-stock`, {
      quantity: stockQuantity.value,
      type: stockType.value,
      reference: stockReference.value || undefined,
      notes: stockNotes.value || undefined,
    });

    toast.add({
      severity: 'success',
      summary: stockType.value === 'IN' ? 'Caricato' : 'Scaricato',
      detail: `Stock ${stockType.value === 'IN' ? 'incrementato' : 'decrementato'} di ${stockQuantity.value}`,
      life: 3000,
    });

    showStockDialog.value = false;
    loadMaterials();
    loadStats();
    loadLowStock();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante la modifica stock',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadMaterials();
  loadStats();
  loadLowStock();
  loadCategories();
  loadSuppliers();
});
</script>

<style scoped>
.materials-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

/* Alert Section */
.alert-section {
  margin-bottom: var(--space-6);
}

.alert-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  border-left: 4px solid;
}

.alert-card--warning {
  border-color: var(--color-warning);
  background: rgba(245, 158, 11, 0.05);
}

.alert-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.alert-card__icon {
  font-size: 1.5rem;
  color: var(--color-warning);
}

.alert-card__content {
  flex: 1;
}

.alert-card__title {
  font-size: var(--font-size-base);
  font-weight: 600;
  margin: 0;
  color: var(--color-gray-900);
}

.alert-card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin: var(--space-1) 0 0 0;
}

/* Table Section */
.table-section {
  margin-top: var(--space-6);
}

.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
  align-items: center;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-gray-400);
}

.search-input {
  width: 100%;
  padding-left: var(--space-10) !important;
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
}

/* Table Styling */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

/* Cell Styles */
.sku-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.material-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.material-tag {
  margin-top: var(--space-1);
}

.cost {
  font-weight: 600;
  color: var(--color-gray-900);
}

.unit-label {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-left: var(--space-1);
}

.stock-cell {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.stock-cell--low {
  color: var(--color-danger);
}

.stock-value {
  font-weight: 600;
  font-size: var(--font-size-base);
}

.stock-min {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.stock-alert {
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
}

.text-muted {
  color: var(--color-gray-400);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
}

.action-btn--stock {
  color: var(--color-success) !important;
}

.action-btn--stock-out {
  color: var(--color-warning) !important;
}

.action-btn--edit {
  color: var(--color-primary-600) !important;
}

.action-btn--delete {
  color: var(--color-danger) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 3rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state__text {
  color: var(--color-gray-500);
  margin-bottom: var(--space-4);
}

/* Form Styles */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group--full {
  grid-column: span 2;
}

.form-group--checkbox {
  flex-direction: row;
  align-items: center;
  grid-column: span 2;
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

/* Stock Form */
.stock-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stock-info {
  display: flex;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.stock-info__label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.stock-info__value {
  font-weight: 600;
  color: var(--color-gray-900);
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrapper {
    min-width: 100%;
  }

  .filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group--full,
  .form-group--checkbox {
    grid-column: span 1;
  }
}
</style>
