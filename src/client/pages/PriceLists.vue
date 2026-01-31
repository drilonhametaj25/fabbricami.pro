<template>
  <div class="pricelists-page">
    <PageHeader
      title="Gestione Listini Prezzi"
      subtitle="Listini e scontistiche per clienti B2B"
      icon="pi pi-list"
    >
      <template #actions>
        <Button label="Nuovo Listino" icon="pi pi-plus" @click="showCreateDialog = true" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Listini Totali"
          :value="stats.totalLists"
          icon="pi pi-list"
          variant="primary"
          format="number"
          subtitle="configurati"
        />
        <StatsCard
          label="Listini Attivi"
          :value="stats.activeLists"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          subtitle="in uso"
        />
        <StatsCard
          label="Clienti Assegnati"
          :value="stats.assignedCustomers"
          icon="pi pi-users"
          variant="info"
          format="number"
          subtitle="con listino"
        />
        <StatsCard
          label="Prodotti Prezzati"
          :value="stats.pricedProducts"
          icon="pi pi-tag"
          variant="warning"
          format="number"
          subtitle="sconti specifici"
        />
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
              placeholder="Cerca listino..."
              @input="loadPriceLists"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedStatus"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Stato"
              @change="loadPriceLists"
              showClear
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="priceLists"
          :loading="loading"
          paginator
          :rows="20"
          responsiveLayout="scroll"
          class="custom-table"
          :rowHover="true"
        >
          <Column field="code" header="Codice" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="code-badge">{{ data.code }}</span>
            </template>
          </Column>
          <Column field="name" header="Nome" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="list-name">{{ data.name }}</div>
              <div class="list-description" v-if="data.description">{{ data.description }}</div>
            </template>
          </Column>
          <Column field="globalDiscount" header="Sconto Base" sortable style="min-width: 120px">
            <template #body="{ data }">
              <Tag :severity="data.globalDiscount > 0 ? 'success' : 'secondary'" class="discount-tag">
                {{ data.globalDiscount }}%
              </Tag>
            </template>
          </Column>
          <Column field="priority" header="Priorità" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span class="priority">{{ data.priority }}</span>
            </template>
          </Column>
          <Column header="Prodotti" style="min-width: 100px">
            <template #body="{ data }">
              <span class="count">{{ data._count?.items || 0 }}</span>
            </template>
          </Column>
          <Column header="Clienti" style="min-width: 100px">
            <template #body="{ data }">
              <span class="count">{{ data._count?.customers || 0 }}</span>
            </template>
          </Column>
          <Column field="isActive" header="Stato" style="min-width: 100px">
            <template #body="{ data }">
              <Tag :severity="data.isActive ? 'success' : 'danger'">
                {{ data.isActive ? 'Attivo' : 'Inattivo' }}
              </Tag>
            </template>
          </Column>
          <Column header="Validità" style="min-width: 180px">
            <template #body="{ data }">
              <div class="validity">
                <span v-if="data.validFrom || data.validTo">
                  {{ formatDate(data.validFrom) }} - {{ formatDate(data.validTo) || 'Sempre' }}
                </span>
                <span v-else class="text-muted">Sempre valido</span>
              </div>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 120px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewPriceList(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editPriceList(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="confirmDelete(data)"
                  v-tooltip.top="'Elimina'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-list empty-state__icon"></i>
              <p class="empty-state__text">Nessun listino trovato</p>
              <Button label="Crea il primo listino" icon="pi pi-plus" @click="showCreateDialog = true" />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      :header="editingPriceList ? 'Modifica Listino' : 'Nuovo Listino'"
      :modal="true"
      :style="{ width: '600px' }"
      class="price-list-dialog"
    >
      <div class="dialog-form">
        <div class="form-row">
          <div class="form-group">
            <label>Codice *</label>
            <InputText v-model="formData.code" placeholder="es. B2B-GOLD" />
          </div>
          <div class="form-group">
            <label>Nome *</label>
            <InputText v-model="formData.name" placeholder="es. Listino Gold" />
          </div>
        </div>

        <div class="form-group">
          <label>Descrizione</label>
          <Textarea v-model="formData.description" rows="2" placeholder="Descrizione opzionale" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Sconto Base %</label>
            <InputNumber
              v-model="formData.globalDiscount"
              :min="0"
              :max="100"
              suffix="%"
              placeholder="0"
            />
          </div>
          <div class="form-group">
            <label>Priorità</label>
            <InputNumber v-model="formData.priority" :min="0" placeholder="0" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Valido dal</label>
            <Calendar v-model="formData.validFrom" dateFormat="dd/mm/yy" showIcon />
          </div>
          <div class="form-group">
            <label>Valido fino al</label>
            <Calendar v-model="formData.validTo" dateFormat="dd/mm/yy" showIcon />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group checkbox-group">
            <Checkbox v-model="formData.isActive" :binary="true" inputId="isActive" />
            <label for="isActive">Listino Attivo</label>
          </div>
          <div class="form-group checkbox-group">
            <Checkbox v-model="formData.isDefault" :binary="true" inputId="isDefault" />
            <label for="isDefault">Listino Predefinito</label>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="closeDialog" />
        <Button
          :label="editingPriceList ? 'Salva' : 'Crea'"
          icon="pi pi-check"
          @click="savePriceList"
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- Detail Dialog -->
    <Dialog
      v-model:visible="showDetailDialog"
      header="Dettaglio Listino"
      :modal="true"
      :style="{ width: '900px' }"
      class="price-list-detail-dialog"
    >
      <div v-if="selectedPriceList" class="detail-content">
        <div class="detail-header">
          <div class="detail-info">
            <h2>{{ selectedPriceList.name }}</h2>
            <span class="code">{{ selectedPriceList.code }}</span>
            <Tag :severity="selectedPriceList.isActive ? 'success' : 'danger'" class="status-tag">
              {{ selectedPriceList.isActive ? 'Attivo' : 'Inattivo' }}
            </Tag>
          </div>
          <div class="detail-stats">
            <div class="stat">
              <span class="stat-value">{{ selectedPriceList.globalDiscount }}%</span>
              <span class="stat-label">Sconto Base</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ selectedPriceList.items?.length || 0 }}</span>
              <span class="stat-label">Prodotti</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ selectedPriceList._count?.customers || 0 }}</span>
              <span class="stat-label">Clienti</span>
            </div>
          </div>
        </div>

        <TabView>
          <TabPanel header="Prezzi Prodotti">
            <div class="products-tab">
              <div class="tab-toolbar">
                <Button label="Aggiungi Prodotto" icon="pi pi-plus" size="small" @click="showAddProductDialog = true" />
              </div>
              <DataTable :value="selectedPriceList.items || []" :paginator="true" :rows="10" class="small-table">
                <Column field="product.sku" header="SKU" style="width: 120px" />
                <Column field="product.name" header="Prodotto" />
                <Column field="discountPercent" header="Sconto %" style="width: 100px">
                  <template #body="{ data }">
                    {{ data.discountPercent !== null ? data.discountPercent + '%' : '-' }}
                  </template>
                </Column>
                <Column field="fixedPrice" header="Prezzo Fisso" style="width: 120px">
                  <template #body="{ data }">
                    {{ data.fixedPrice !== null ? formatCurrency(data.fixedPrice) : '-' }}
                  </template>
                </Column>
                <Column field="minQuantity" header="Qtà Min" style="width: 80px" />
                <template #empty>
                  <div class="empty-tab">Nessun prezzo specifico configurato</div>
                </template>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Sconti Categoria">
            <div class="categories-tab">
              <div class="tab-toolbar">
                <Button label="Aggiungi Categoria" icon="pi pi-plus" size="small" @click="showAddCategoryDialog = true" />
              </div>
              <DataTable :value="selectedPriceList.categoryDiscounts || []" :paginator="true" :rows="10" class="small-table">
                <Column field="category.name" header="Categoria" />
                <Column field="discountPercent" header="Sconto %" style="width: 120px">
                  <template #body="{ data }">
                    {{ data.discountPercent }}%
                  </template>
                </Column>
                <template #empty>
                  <div class="empty-tab">Nessuno sconto categoria configurato</div>
                </template>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Clienti Associati">
            <div class="customers-tab">
              <DataTable :value="priceListCustomers" :loading="loadingCustomers" :paginator="true" :rows="10" class="small-table">
                <Column field="code" header="Codice" style="width: 120px" />
                <Column header="Nome">
                  <template #body="{ data }">
                    {{ data.businessName || `${data.firstName} ${data.lastName}` }}
                  </template>
                </Column>
                <Column field="type" header="Tipo" style="width: 80px" />
                <Column field="email" header="Email" />
                <template #empty>
                  <div class="empty-tab">Nessun cliente associato a questo listino</div>
                </template>
              </DataTable>
            </div>
          </TabPanel>
        </TabView>
      </div>
    </Dialog>

    <!-- Confirm Delete -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Calendar from 'primevue/calendar';
import Checkbox from 'primevue/checkbox';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import type { PriceList, Customer } from '../types';

const toast = useToast();
const confirm = useConfirm();

const loading = ref(false);
const saving = ref(false);
const priceLists = ref<PriceList[]>([]);
const search = ref('');
const selectedStatus = ref<boolean | null>(null);
const showCreateDialog = ref(false);
const showDetailDialog = ref(false);
const showAddProductDialog = ref(false);
const showAddCategoryDialog = ref(false);
const editingPriceList = ref<PriceList | null>(null);
const selectedPriceList = ref<PriceList | null>(null);
const priceListCustomers = ref<Customer[]>([]);
const loadingCustomers = ref(false);

const stats = ref({
  totalLists: 0,
  activeLists: 0,
  assignedCustomers: 0,
  pricedProducts: 0,
});

const statusOptions = [
  { label: 'Attivi', value: true },
  { label: 'Inattivi', value: false },
];

const formData = ref({
  code: '',
  name: '',
  description: '',
  globalDiscount: 0,
  priority: 0,
  validFrom: null as Date | null,
  validTo: null as Date | null,
  isActive: true,
  isDefault: false,
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString('it-IT');
};

const loadStats = async () => {
  try {
    const response = await api.get('/pricelists/stats');
    if (response.success) {
      stats.value = response.data;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadPriceLists = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: '1',
      limit: '100',
      ...(search.value && { search: search.value }),
      ...(selectedStatus.value !== null && { isActive: String(selectedStatus.value) }),
    });

    const response = await api.get(`/pricelists?${params.toString()}`);

    if (response.success) {
      priceLists.value = response.data.items;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento listini',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const viewPriceList = async (priceList: PriceList) => {
  try {
    const response = await api.get(`/pricelists/${priceList.id}`);
    if (response.success) {
      selectedPriceList.value = response.data;
      showDetailDialog.value = true;
      loadPriceListCustomers(priceList.id);
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

const loadPriceListCustomers = async (priceListId: string) => {
  try {
    loadingCustomers.value = true;
    const response = await api.get(`/pricelists/${priceListId}/customers`);
    if (response.success) {
      priceListCustomers.value = response.data;
    }
  } catch (error) {
    console.error('Error loading customers:', error);
  } finally {
    loadingCustomers.value = false;
  }
};

const editPriceList = (priceList: PriceList) => {
  editingPriceList.value = priceList;
  formData.value = {
    code: priceList.code,
    name: priceList.name,
    description: priceList.description || '',
    globalDiscount: priceList.globalDiscount,
    priority: priceList.priority,
    validFrom: priceList.validFrom ? new Date(priceList.validFrom) : null,
    validTo: priceList.validTo ? new Date(priceList.validTo) : null,
    isActive: priceList.isActive,
    isDefault: priceList.isDefault,
  };
  showCreateDialog.value = true;
};

const closeDialog = () => {
  showCreateDialog.value = false;
  editingPriceList.value = null;
  formData.value = {
    code: '',
    name: '',
    description: '',
    globalDiscount: 0,
    priority: 0,
    validFrom: null,
    validTo: null,
    isActive: true,
    isDefault: false,
  };
};

const savePriceList = async () => {
  if (!formData.value.code || !formData.value.name) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Codice e nome sono obbligatori',
      life: 3000,
    });
    return;
  }

  try {
    saving.value = true;

    const data = {
      ...formData.value,
      validFrom: formData.value.validFrom?.toISOString(),
      validTo: formData.value.validTo?.toISOString(),
    };

    if (editingPriceList.value) {
      await api.put(`/pricelists/${editingPriceList.value.id}`, data);
      toast.add({
        severity: 'success',
        summary: 'Listino aggiornato',
        detail: 'Il listino è stato aggiornato con successo',
        life: 3000,
      });
    } else {
      await api.post('/pricelists', data);
      toast.add({
        severity: 'success',
        summary: 'Listino creato',
        detail: 'Il nuovo listino è stato creato con successo',
        life: 3000,
      });
    }

    closeDialog();
    loadPriceLists();
    loadStats();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (priceList: PriceList) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare il listino "${priceList.name}"?`,
    header: 'Conferma eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/pricelists/${priceList.id}`);
        toast.add({
          severity: 'success',
          summary: 'Listino eliminato',
          detail: 'Il listino è stato eliminato con successo',
          life: 3000,
        });
        loadPriceLists();
        loadStats();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message,
          life: 3000,
        });
      }
    },
  });
};

onMounted(() => {
  loadPriceLists();
  loadStats();
});
</script>

<style scoped>
.pricelists-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
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
  font-size: 0.875rem;
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
  min-width: 150px;
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
  vertical-align: middle;
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

/* Cell Styles */
.code-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.list-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.list-description {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  margin-top: 2px;
}

.discount-tag {
  font-weight: 600;
}

.priority {
  font-weight: 500;
}

.count {
  font-weight: 600;
  color: var(--color-gray-700);
}

.validity {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
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

.action-btn--view {
  color: var(--color-info) !important;
}

.action-btn--edit {
  color: var(--color-primary) !important;
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

/* Dialog Form */
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.checkbox-group {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.checkbox-group label {
  margin: 0;
}

/* Detail Dialog */
.detail-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: var(--space-4);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.detail-info h2 {
  margin: 0 0 var(--space-2) 0;
  font-size: 1.25rem;
}

.detail-info .code {
  font-family: var(--font-mono);
  color: var(--color-gray-500);
  margin-right: var(--space-2);
}

.detail-stats {
  display: flex;
  gap: var(--space-6);
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary-600);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

.tab-toolbar {
  margin-bottom: var(--space-4);
}

.small-table :deep(.p-datatable-thead > tr > th) {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
}

.small-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
}

.empty-tab {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-gray-400);
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

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
