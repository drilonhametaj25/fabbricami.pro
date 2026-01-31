<template>
  <div class="operation-types-page">
    <PageHeader
      title="Tipi Operazione"
      subtitle="Gestione delle fasi di lavorazione"
      icon="pi pi-cog"
    >
      <template #actions>
        <Button
          label="Seed Default"
          icon="pi pi-database"
          class="p-button-outlined mr-2"
          @click="seedDefaults"
          :loading="seedingDefaults"
        />
        <Button
          label="Nuovo Tipo"
          icon="pi pi-plus"
          @click="openCreateDialog"
        />
      </template>
    </PageHeader>

    <!-- Filters -->
    <section class="filters-section">
      <div class="filters-card">
        <div class="filters-grid">
          <div class="filter-item">
            <label>Cerca</label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search"></i>
              <InputText
                v-model="filters.search"
                placeholder="Codice o nome..."
                class="w-full"
                @input="debouncedSearch"
              />
            </span>
          </div>
          <div class="filter-item">
            <label>Tipo</label>
            <Dropdown
              v-model="filters.type"
              :options="typeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti"
              class="w-full"
              showClear
              @change="loadOperationTypes"
            />
          </div>
          <div class="filter-item checkbox-filter">
            <Checkbox v-model="filters.includeInactive" binary inputId="includeInactive" @change="loadOperationTypes" />
            <label for="includeInactive">Mostra inattivi</label>
          </div>
        </div>
      </div>
    </section>

    <!-- Table -->
    <section class="table-section">
      <div class="table-card">
        <DataTable
          :value="filteredOperationTypes"
          :loading="loading"
          :rowHover="true"
          stripedRows
          responsiveLayout="scroll"
          class="custom-table"
          @rowReorder="onRowReorder"
        >
          <Column :rowReorder="true" headerStyle="width: 3rem" :reorderableColumn="false" />

          <Column field="code" header="Codice" :sortable="true" style="min-width: 120px">
            <template #body="{ data }">
              <span class="code-badge">{{ data.code }}</span>
            </template>
          </Column>

          <Column field="name" header="Nome" :sortable="true" style="min-width: 200px">
            <template #body="{ data }">
              <div class="name-cell">
                <span class="operation-name">{{ data.name }}</span>
                <span v-if="data.description" class="operation-description">{{ data.description }}</span>
              </div>
            </template>
          </Column>

          <Column field="isExternal" header="Tipo" :sortable="true" style="min-width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.isExternal ? 'Esterno' : 'Interno'"
                :severity="data.isExternal ? 'warning' : 'success'"
              />
            </template>
          </Column>

          <Column field="defaultHourlyRate" header="Tariffa Oraria" :sortable="true" style="min-width: 130px">
            <template #body="{ data }">
              <span v-if="data.defaultHourlyRate" class="hourly-rate">{{ formatCurrency(data.defaultHourlyRate) }}/h</span>
              <span v-else class="no-value">-</span>
            </template>
          </Column>

          <Column field="requiresLiquidProduct" header="Liquidi" style="min-width: 80px">
            <template #body="{ data }">
              <i v-if="data.requiresLiquidProduct" class="pi pi-check text-success" />
              <i v-else class="pi pi-minus text-muted" />
            </template>
          </Column>

          <Column field="isActive" header="Stato" style="min-width: 100px">
            <template #body="{ data }">
              <Tag
                :value="data.isActive ? 'Attivo' : 'Inattivo'"
                :severity="data.isActive ? 'success' : 'danger'"
              />
            </template>
          </Column>

          <Column field="_count.phases" header="Fasi" style="min-width: 80px">
            <template #body="{ data }">
              <Badge :value="data._count?.phases || 0" severity="secondary" />
            </template>
          </Column>

          <Column header="Azioni" style="min-width: 150px">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-users"
                  class="p-button-text p-button-sm p-button-help"
                  @click="openEmployeesDialog(data)"
                  v-tooltip.top="'Operatori Qualificati'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-text p-button-sm"
                  @click="openEditDialog(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-danger p-button-sm"
                  @click="confirmDelete(data)"
                  v-tooltip.top="'Elimina'"
                  :disabled="data._count?.phases > 0"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-cog empty-icon"></i>
              <p>Nessun tipo operazione trovato</p>
              <Button
                label="Crea Tipi Default"
                icon="pi pi-plus"
                class="p-button-text"
                @click="seedDefaults"
              />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="showDialog"
      :header="isEditing ? 'Modifica Tipo Operazione' : 'Nuovo Tipo Operazione'"
      :modal="true"
      :style="{ width: '500px', maxWidth: '95vw' }"
      :closable="!saving"
    >
      <form @submit.prevent="saveOperationType" class="dialog-form">
        <div class="form-row">
          <div class="form-field">
            <label>Codice <span class="required">*</span></label>
            <InputText
              v-model="form.code"
              class="w-full"
              :class="{ 'p-invalid': errors.code }"
              :disabled="isEditing"
              placeholder="PROD_INT"
            />
            <small v-if="errors.code" class="p-error">{{ errors.code }}</small>
          </div>

          <div class="form-field">
            <label>Nome <span class="required">*</span></label>
            <InputText
              v-model="form.name"
              class="w-full"
              :class="{ 'p-invalid': errors.name }"
              placeholder="Produzione Interna"
            />
            <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
          </div>
        </div>

        <div class="form-field">
          <label>Descrizione</label>
          <Textarea
            v-model="form.description"
            class="w-full"
            rows="3"
            placeholder="Descrizione dell'operazione..."
          />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label>Tariffa Oraria Default</label>
            <InputNumber
              v-model="form.defaultHourlyRate"
              mode="currency"
              currency="EUR"
              locale="it-IT"
              class="w-full"
              :minFractionDigits="2"
            />
          </div>

          <div class="form-field">
            <label>Ordine</label>
            <InputNumber
              v-model="form.sortOrder"
              class="w-full"
              :min="0"
            />
          </div>
        </div>

        <div class="checkbox-group">
          <div class="checkbox-item">
            <Checkbox v-model="form.isExternal" binary inputId="isExternal" />
            <label for="isExternal">Operazione esterna (terzista)</label>
          </div>

          <div class="checkbox-item">
            <Checkbox v-model="form.requiresLiquidProduct" binary inputId="requiresLiquid" />
            <label for="requiresLiquid">Solo per prodotti liquidi</label>
          </div>

          <div class="checkbox-item">
            <Checkbox v-model="form.isActive" binary inputId="isActive" />
            <label for="isActive">Attivo</label>
          </div>
        </div>
      </form>

      <template #footer>
        <Button
          label="Annulla"
          icon="pi pi-times"
          class="p-button-text"
          @click="showDialog = false"
          :disabled="saving"
        />
        <Button
          :label="isEditing ? 'Salva' : 'Crea'"
          icon="pi pi-check"
          @click="saveOperationType"
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- Confirm Dialog -->
    <ConfirmDialog />

    <!-- Employees Dialog -->
    <OperationTypeEmployees
      v-model="showEmployeesDialog"
      :operation-type="selectedOperationType"
      @updated="loadOperationTypes"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import ConfirmDialog from 'primevue/confirmdialog';
import api from '../services/api.service';
import debounce from 'lodash/debounce';
import PageHeader from '../components/PageHeader.vue';
import OperationTypeEmployees from '../components/OperationTypeEmployees.vue';

interface OperationType {
  id: string;
  code: string;
  name: string;
  description?: string;
  isExternal: boolean;
  defaultHourlyRate?: number;
  requiresLiquidProduct: boolean;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    phases: number;
  };
}

const confirm = useConfirm();
const toast = useToast();

const loading = ref(false);
const saving = ref(false);
const seedingDefaults = ref(false);
const operationTypes = ref<OperationType[]>([]);
const showDialog = ref(false);
const isEditing = ref(false);
const editingId = ref<string | null>(null);

// State for employees dialog
const showEmployeesDialog = ref(false);
const selectedOperationType = ref<OperationType | null>(null);

const openEmployeesDialog = (type: OperationType) => {
  selectedOperationType.value = type;
  showEmployeesDialog.value = true;
};

const filters = ref({
  search: '',
  type: null as string | null,
  includeInactive: false,
});

const typeOptions = [
  { label: 'Interno', value: 'internal' },
  { label: 'Esterno', value: 'external' },
];

const form = ref({
  code: '',
  name: '',
  description: '',
  isExternal: false,
  defaultHourlyRate: null as number | null,
  requiresLiquidProduct: false,
  sortOrder: 0,
  isActive: true,
});

const errors = ref<Record<string, string>>({});

const filteredOperationTypes = computed(() => {
  let result = operationTypes.value;

  if (filters.value.search) {
    const search = filters.value.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.code.toLowerCase().includes(search) ||
        t.name.toLowerCase().includes(search)
    );
  }

  if (filters.value.type === 'internal') {
    result = result.filter((t) => !t.isExternal);
  } else if (filters.value.type === 'external') {
    result = result.filter((t) => t.isExternal);
  }

  return result;
});

const debouncedSearch = debounce(() => {
  // Filtering is done client-side via computed
}, 300);

const loadOperationTypes = async () => {
  loading.value = true;
  try {
    const response = await api.get('/operation-types', {
      params: {
        includeInactive: filters.value.includeInactive ? 'true' : 'false',
      },
    });
    operationTypes.value = response.data || [];
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const resetForm = () => {
  form.value = {
    code: '',
    name: '',
    description: '',
    isExternal: false,
    defaultHourlyRate: null,
    requiresLiquidProduct: false,
    sortOrder: operationTypes.value.length,
    isActive: true,
  };
  errors.value = {};
};

const openCreateDialog = () => {
  isEditing.value = false;
  editingId.value = null;
  resetForm();
  showDialog.value = true;
};

const openEditDialog = (type: OperationType) => {
  isEditing.value = true;
  editingId.value = type.id;
  form.value = {
    code: type.code,
    name: type.name,
    description: type.description || '',
    isExternal: type.isExternal,
    defaultHourlyRate: type.defaultHourlyRate || null,
    requiresLiquidProduct: type.requiresLiquidProduct,
    sortOrder: type.sortOrder,
    isActive: type.isActive,
  };
  errors.value = {};
  showDialog.value = true;
};

const validateForm = () => {
  errors.value = {};

  if (!form.value.code.trim()) {
    errors.value.code = 'Codice obbligatorio';
  }
  if (!form.value.name.trim()) {
    errors.value.name = 'Nome obbligatorio';
  }

  return Object.keys(errors.value).length === 0;
};

const saveOperationType = async () => {
  if (!validateForm()) return;

  saving.value = true;
  try {
    const payload = {
      code: form.value.code,
      name: form.value.name,
      description: form.value.description || undefined,
      isExternal: form.value.isExternal,
      defaultHourlyRate: form.value.defaultHourlyRate || undefined,
      requiresLiquidProduct: form.value.requiresLiquidProduct,
      sortOrder: form.value.sortOrder,
      isActive: form.value.isActive,
    };

    if (isEditing.value && editingId.value) {
      await api.patch(`/operation-types/${editingId.value}`, payload);
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: 'Tipo operazione aggiornato',
        life: 3000,
      });
    } else {
      await api.post('/operation-types', payload);
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: 'Tipo operazione creato',
        life: 3000,
      });
    }

    showDialog.value = false;
    loadOperationTypes();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel salvataggio',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (type: OperationType) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare "${type.name}"?`,
    header: 'Conferma eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteOperationType(type.id),
  });
};

const deleteOperationType = async (id: string) => {
  try {
    await api.delete(`/operation-types/${id}`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Tipo operazione eliminato',
      life: 3000,
    });
    loadOperationTypes();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nell\'eliminazione',
      life: 3000,
    });
  }
};

const onRowReorder = async (event: any) => {
  const reorderedIds = event.value.map((t: OperationType) => t.id);

  try {
    await api.put('/operation-types/reorder', { orderedIds: reorderedIds });
    operationTypes.value = event.value;
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Ordine aggiornato',
      life: 2000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel riordino',
      life: 3000,
    });
    loadOperationTypes();
  }
};

const seedDefaults = async () => {
  seedingDefaults.value = true;
  try {
    const response = await api.post('/operation-types/seed-defaults');
    const created = response.data?.created || [];

    if (created.length > 0) {
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: `Creati ${created.length} tipi operazione di default`,
        life: 3000,
      });
      loadOperationTypes();
    } else {
      toast.add({
        severity: 'info',
        summary: 'Info',
        detail: 'Tipi operazione di default già presenti',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel seed',
      life: 3000,
    });
  } finally {
    seedingDefaults.value = false;
  }
};

onMounted(() => {
  loadOperationTypes();
});
</script>

<style scoped>
.operation-types-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Filters Section */
.filters-section {
  margin-bottom: 1.5rem;
}

.filters-card {
  background: var(--surface-card);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid var(--surface-border);
}

.filters-grid {
  display: grid;
  grid-template-columns: 1fr 200px auto;
  gap: 1rem;
  align-items: end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-item label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.checkbox-filter {
  flex-direction: row;
  align-items: center;
  padding-bottom: 0.5rem;
}

.checkbox-filter label {
  margin-left: 0.5rem;
}

/* Table Section */
.table-section {
  margin-top: 1rem;
}

.table-card {
  background: var(--surface-card);
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  overflow: hidden;
}

.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-50);
  padding: 1rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  border-bottom: 2px solid var(--surface-border);
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--surface-hover);
}

/* Cell Styles */
.code-badge {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--primary-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.operation-name {
  font-weight: 500;
  color: var(--text-color);
}

.operation-description {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hourly-rate {
  font-weight: 600;
  color: var(--green-600);
}

.no-value {
  color: var(--text-color-secondary);
}

.text-success {
  color: var(--green-500);
}

.text-muted {
  color: var(--surface-400);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.25rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-color-secondary);
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.4;
  margin-bottom: 1rem;
}

.empty-state p {
  margin-bottom: 1rem;
}

/* Dialog Form */
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.required {
  color: var(--red-500);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item label {
  font-size: 0.875rem;
  color: var(--text-color);
  cursor: pointer;
}

/* Utilities */
.w-full {
  width: 100%;
}

.mr-2 {
  margin-right: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
