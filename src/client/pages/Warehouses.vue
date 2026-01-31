<template>
  <div class="warehouses-page">
    <PageHeader
      title="Magazzini"
      subtitle="Gestisci magazzini e location"
      icon="pi pi-building"
    >
      <template #actions>
        <Button label="Nuovo Magazzino" icon="pi pi-plus" @click="openCreateDialog" />
      </template>
    </PageHeader>

    <!-- Filters -->
    <section class="filters-section">
      <div class="filters-card">
        <div class="search-wrapper">
          <i class="pi pi-search search-icon"></i>
          <InputText
            v-model="filters.search"
            placeholder="Cerca per codice o nome..."
            @input="loadWarehouses"
            class="search-input"
          />
        </div>

        <Dropdown
          v-model="filters.isActive"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Tutti gli stati"
          @change="loadWarehouses"
          showClear
          class="filter-dropdown"
        />
      </div>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="loading-container">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Caricamento...</span>
    </div>

    <!-- Lista Magazzini -->
    <div v-else class="warehouses-grid">
      <div
        v-for="warehouse in warehouses"
        :key="warehouse.id"
        class="warehouse-card"
        :class="{ 'is-primary': warehouse.isPrimary }"
      >
        <div class="warehouse-header">
          <div class="warehouse-title">
            <h3>{{ warehouse.code }} - {{ warehouse.name }}</h3>
            <div class="warehouse-badges">
              <Tag v-if="warehouse.isPrimary" severity="success" class="badge-primary">Principale</Tag>
              <Tag v-if="!warehouse.isActive" severity="secondary" class="badge-inactive">Disattivo</Tag>
            </div>
          </div>
          <div class="action-buttons">
            <Button
              icon="pi pi-pencil"
              class="p-button-rounded p-button-text action-btn action-btn--edit"
              @click="openEditDialog(warehouse)"
              v-tooltip.top="'Modifica'"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-rounded p-button-text action-btn action-btn--delete"
              @click="deleteWarehouse(warehouse)"
              v-tooltip.top="'Elimina'"
            />
          </div>
        </div>

        <p v-if="warehouse.description" class="warehouse-description">
          {{ warehouse.description }}
        </p>

        <div v-if="warehouse.address" class="warehouse-address">
          <i class="pi pi-map-marker"></i>
          <span>{{ formatAddress(warehouse.address) }}</span>
        </div>

        <div class="warehouse-stats">
          <div class="stat">
            <span class="stat-label">Prodotti</span>
            <span class="stat-value">{{ warehouse._count?.inventoryItems || 0 }}</span>
          </div>
        </div>

        <div v-if="!warehouse.isPrimary" class="warehouse-actions">
          <Button
            label="Imposta come principale"
            icon="pi pi-star"
            class="p-button-outlined p-button-sm"
            @click="setPrimary(warehouse)"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="warehouses.length === 0" class="empty-state">
        <i class="pi pi-building"></i>
        <h3>Nessun magazzino trovato</h3>
        <p>Non ci sono magazzini corrispondenti ai criteri di ricerca.</p>
        <Button label="Crea il primo magazzino" icon="pi pi-plus" @click="openCreateDialog" />
      </div>
    </div>

    <!-- Dialog Crea/Modifica -->
    <Dialog
      v-model:visible="showDialog"
      :header="isEditing ? 'Modifica Magazzino' : 'Nuovo Magazzino'"
      :style="{ width: '600px' }"
      :modal="true"
      class="warehouse-dialog"
    >
      <div class="form-grid">
        <div class="form-field">
          <label for="code">Codice *</label>
          <InputText id="code" v-model="form.code" class="w-full" />
        </div>

        <div class="form-field">
          <label for="name">Nome *</label>
          <InputText id="name" v-model="form.name" class="w-full" />
        </div>

        <div class="form-field full-width">
          <label for="description">Descrizione</label>
          <Textarea id="description" v-model="form.description" rows="3" class="w-full" />
        </div>

        <div class="form-field full-width">
          <h4 class="section-title">
            <i class="pi pi-map-marker"></i>
            Indirizzo
          </h4>
        </div>

        <div class="form-field full-width">
          <label for="street">Via</label>
          <InputText id="street" v-model="form.address.street" class="w-full" />
        </div>

        <div class="form-field">
          <label for="city">Citta</label>
          <InputText id="city" v-model="form.address.city" class="w-full" />
        </div>

        <div class="form-field">
          <label for="zip">CAP</label>
          <InputText id="zip" v-model="form.address.zip" class="w-full" />
        </div>

        <div class="form-field full-width">
          <label for="country">Paese</label>
          <InputText id="country" v-model="form.address.country" class="w-full" />
        </div>

        <div class="form-field">
          <div class="checkbox-wrapper">
            <Checkbox id="isActive" v-model="form.isActive" :binary="true" />
            <label for="isActive" class="checkbox-label">Attivo</label>
          </div>
        </div>

        <div class="form-field">
          <div class="checkbox-wrapper">
            <Checkbox id="isPrimary" v-model="form.isPrimary" :binary="true" />
            <label for="isPrimary" class="checkbox-label">Magazzino principale</label>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" @click="closeDialog" class="p-button-text" />
        <Button label="Salva" icon="pi pi-check" @click="saveWarehouse" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { apiService } from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import type { Warehouse } from '../../shared/types';

const toast = useToast();
const confirm = useConfirm();

// State
const warehouses = ref<Warehouse[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const isEditing = ref(false);
const saving = ref(false);

const filters = ref({
  search: '',
  isActive: undefined as boolean | undefined,
});

const statusOptions = [
  { label: 'Attivi', value: true },
  { label: 'Disattivati', value: false },
];

const form = ref({
  id: '',
  code: '',
  name: '',
  description: '',
  address: {
    street: '',
    city: '',
    zip: '',
    country: 'Italia',
  },
  isActive: true,
  isPrimary: false,
});

// Methods
async function loadWarehouses() {
  loading.value = true;
  try {
    const response = await apiService.get('/warehouses', {
      params: {
        ...filters.value,
        page: 1,
        limit: 100,
      },
    });
    warehouses.value = response.data.items;
  } catch (error) {
    console.error('Error loading warehouses:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore nel caricamento dei magazzini',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  isEditing.value = false;
  form.value = {
    id: '',
    code: '',
    name: '',
    description: '',
    address: {
      street: '',
      city: '',
      zip: '',
      country: 'Italia',
    },
    isActive: true,
    isPrimary: false,
  };
  showDialog.value = true;
}

function openEditDialog(warehouse: Warehouse) {
  isEditing.value = true;
  form.value = {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    description: warehouse.description || '',
    address: warehouse.address || {
      street: '',
      city: '',
      zip: '',
      country: 'Italia',
    },
    isActive: warehouse.isActive,
    isPrimary: warehouse.isPrimary,
  };
  showDialog.value = true;
}

function closeDialog() {
  showDialog.value = false;
}

async function saveWarehouse() {
  // Validation
  if (!form.value.code || !form.value.name) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Compila tutti i campi obbligatori',
      life: 3000,
    });
    return;
  }

  saving.value = true;
  try {
    const data = {
      code: form.value.code,
      name: form.value.name,
      description: form.value.description || undefined,
      address: form.value.address,
      isActive: form.value.isActive,
      isPrimary: form.value.isPrimary,
    };

    if (isEditing.value) {
      await apiService.patch(`/warehouses/${form.value.id}`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Magazzino aggiornato con successo',
        life: 3000,
      });
    } else {
      await apiService.post('/warehouses', data);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Magazzino creato con successo',
        life: 3000,
      });
    }

    closeDialog();
    await loadWarehouses();
  } catch (error: any) {
    console.error('Error saving warehouse:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel salvataggio del magazzino',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
}

function deleteWarehouse(warehouse: Warehouse) {
  confirm.require({
    message: `Sei sicuro di voler eliminare il magazzino "${warehouse.name}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Si, elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await apiService.delete(`/warehouses/${warehouse.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminato',
          detail: 'Magazzino eliminato con successo',
          life: 3000,
        });
        await loadWarehouses();
      } catch (error: any) {
        console.error('Error deleting warehouse:', error);
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.response?.data?.error || 'Errore nell\'eliminazione del magazzino',
          life: 3000,
        });
      }
    },
  });
}

function setPrimary(warehouse: Warehouse) {
  confirm.require({
    message: `Impostare "${warehouse.name}" come magazzino principale?`,
    header: 'Conferma',
    icon: 'pi pi-star',
    acceptLabel: 'Si, imposta',
    rejectLabel: 'Annulla',
    accept: async () => {
      try {
        await apiService.patch(`/warehouses/${warehouse.id}/set-primary`, {});
        toast.add({
          severity: 'success',
          summary: 'Aggiornato',
          detail: 'Magazzino principale impostato con successo',
          life: 3000,
        });
        await loadWarehouses();
      } catch (error: any) {
        console.error('Error setting primary warehouse:', error);
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.response?.data?.error || 'Errore nell\'impostazione del magazzino principale',
          life: 3000,
        });
      }
    },
  });
}

function formatAddress(address: any) {
  if (!address) return '';
  const parts = [address.street, address.city, address.zip, address.country].filter(Boolean);
  return parts.join(', ');
}

// Lifecycle
onMounted(() => {
  loadWarehouses();
});
</script>

<style scoped>
.warehouses-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Filters Section */
.filters-section {
  margin-bottom: var(--space-6);
}

.filters-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  display: flex;
  gap: var(--space-4);
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
  font-size: 0.875rem;
}

.search-input {
  width: 100%;
  padding-left: var(--space-10) !important;
}

.filter-dropdown {
  min-width: 180px;
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  gap: var(--space-4);
  color: var(--color-gray-500);
}

.loading-container i {
  font-size: 2.5rem;
  color: var(--color-primary-500);
}

/* Warehouses Grid */
.warehouses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-6);
}

/* Warehouse Card */
.warehouse-card {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color-light);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  position: relative;
  overflow: hidden;
}

.warehouse-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-gray-300);
  transition: background var(--transition-fast), height var(--transition-fast);
}

.warehouse-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.warehouse-card:hover::before {
  height: 4px;
}

.warehouse-card.is-primary {
  border-color: var(--color-primary-400);
}

.warehouse-card.is-primary::before {
  background: var(--color-primary-600);
}

/* Warehouse Header */
.warehouse-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.warehouse-title {
  flex: 1;
  min-width: 0;
}

.warehouse-title h3 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  line-height: var(--line-height-tight);
}

.warehouse-badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.badge-primary {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.badge-inactive {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
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

/* Warehouse Content */
.warehouse-description {
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-3) 0;
  line-height: var(--line-height-relaxed);
}

.warehouse-address {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
}

.warehouse-address i {
  color: var(--color-primary-600);
}

/* Warehouse Stats */
.warehouse-stats {
  display: flex;
  gap: var(--space-6);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stat-label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

/* Warehouse Actions */
.warehouse-actions {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

/* Empty State */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: var(--space-12) var(--space-6);
  color: var(--color-gray-500);
}

.empty-state i {
  font-size: 4rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
  display: block;
}

.empty-state h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
  color: var(--color-gray-700);
  font-weight: 600;
}

.empty-state p {
  color: var(--color-gray-500);
  max-width: 400px;
  margin: 0 auto var(--space-4);
}

/* Form Styles */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-5);
  padding: var(--space-4) 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-weight: 600;
  color: var(--color-gray-700);
  font-size: var(--font-size-sm);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: var(--space-2) 0 0 0;
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

.section-title i {
  color: var(--color-primary-600);
}

.w-full {
  width: 100%;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.checkbox-label {
  margin: 0;
  cursor: pointer;
  font-weight: 500;
  color: var(--color-gray-700);
}

/* Responsive */
@media (max-width: 1024px) {
  .warehouses-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-5);
  }
}

@media (max-width: 768px) {
  .filters-card {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrapper {
    min-width: 100%;
  }

  .filter-dropdown {
    width: 100%;
  }

  .warehouses-grid {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
