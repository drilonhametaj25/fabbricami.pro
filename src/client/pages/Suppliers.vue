<template>
  <div class="suppliers-page">
    <PageHeader
      title="Gestione Fornitori"
      subtitle="Gestisci i fornitori, condizioni e storico acquisti"
      icon="pi pi-building"
    >
      <template #actions>
        <Button label="Nuovo Fornitore" icon="pi pi-plus" @click="openCreateDialog" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid">
        <StatsCard
          label="Totale Fornitori"
          :value="totalRecords"
          icon="pi pi-building"
          variant="primary"
          format="number"
          subtitle="nel sistema"
        />
        <StatsCard
          label="Fornitori Attivi"
          :value="stats.activeSuppliers"
          icon="pi pi-check-circle"
          variant="success"
          format="number"
          :subtitle="`${getPercentage(stats.activeSuppliers, totalRecords)}% attivi`"
        />
        <StatsCard
          label="Ordini Totali"
          :value="stats.totalOrders"
          icon="pi pi-shopping-cart"
          variant="info"
          format="number"
          subtitle="ordini d'acquisto"
        />
        <StatsCard
          label="Valore Acquisti"
          :value="stats.totalValue"
          icon="pi pi-euro"
          variant="warning"
          format="currency"
          subtitle="totale acquisti"
        />
      </div>
    </section>

    <!-- TabView for multiple views -->
    <TabView v-model:activeIndex="activeTab" class="supplier-tabs">
      <TabPanel header="Lista Fornitori">
        <div class="table-card">
        <div class="table-toolbar">
          <div class="search-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="search"
              placeholder="Cerca per codice, nome, email..."
              @input="debounceSearch"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedCountry"
              :options="countries"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti i paesi"
              @change="loadSuppliers"
              showClear
              class="filter-dropdown"
            />

            <Dropdown
              v-model="isActive"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Tutti gli stati"
              @change="loadSuppliers"
              showClear
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="suppliers"
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
          <Column field="code" header="Codice" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="code-badge">{{ data.code }}</span>
            </template>
          </Column>
          <Column field="businessName" header="Nome Fornitore" sortable style="min-width: 200px">
            <template #body="{ data }">
              <div class="supplier-name">
                <i class="pi pi-building"></i>
                <span>{{ data.businessName }}</span>
              </div>
            </template>
          </Column>
          <Column field="email" header="Email" sortable style="min-width: 200px">
            <template #body="{ data }">
              <a :href="`mailto:${data.email}`" class="email-link">{{ data.email }}</a>
            </template>
          </Column>
          <Column field="phone" header="Telefono" style="min-width: 130px">
            <template #body="{ data }">
              <span v-if="data.phone" class="phone-text">{{ data.phone }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column field="country" header="Paese" sortable style="min-width: 100px">
            <template #body="{ data }">
              <Tag v-if="data.country" severity="info" class="country-tag">{{ data.country }}</Tag>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column field="paymentTerms" header="Condizioni" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span v-if="data.paymentTerms" class="payment-terms">{{ data.paymentTerms }} gg</span>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column field="isActive" header="Stato" sortable style="min-width: 100px">
            <template #body="{ data }">
              <Tag :severity="data.isActive ? 'success' : 'danger'" class="status-tag">
                {{ data.isActive ? 'Attivo' : 'Inattivo' }}
              </Tag>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 140px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewSupplier(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editSupplier(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="deleteSupplier(data)"
                  v-tooltip.top="'Elimina'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-building empty-state__icon"></i>
              <p class="empty-state__text">Nessun fornitore trovato</p>
              <Button label="Aggiungi il primo fornitore" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
          </template>
        </DataTable>
        </div>
      </TabPanel>

      <TabPanel header="Timeline Acquisti">
        <PurchaseTimelineChart />
      </TabPanel>

      <TabPanel header="Stagionalita">
        <PurchaseSeasonalityChart />
      </TabPanel>
    </TabView>

    <!-- Dialog Create/Edit -->
    <Dialog
      v-model:visible="showDialog"
      :header="selectedSupplier ? 'Modifica Fornitore' : 'Nuovo Fornitore'"
      :style="{ width: '850px', maxWidth: '95vw' }"
      :modal="true"
      class="supplier-dialog"
    >
      <TabView>
        <!-- Tab Informazioni Base -->
        <TabPanel header="Informazioni Base">
          <div class="form-grid">
            <div class="form-field">
              <label for="code">Codice *</label>
              <InputText id="code" v-model="formData.code" :disabled="!!selectedSupplier" class="w-full" />
            </div>

            <div class="form-field">
              <label for="businessName">Ragione Sociale *</label>
              <InputText id="businessName" v-model="formData.businessName" class="w-full" />
            </div>

            <div class="form-field">
              <label for="email">Email</label>
              <InputText id="email" v-model="formData.email" type="email" class="w-full" />
            </div>

            <div class="form-field">
              <label for="phone">Telefono</label>
              <InputText id="phone" v-model="formData.phone" class="w-full" />
            </div>

            <div class="form-field">
              <label for="taxId">Partita IVA</label>
              <InputText id="taxId" v-model="formData.taxId" class="w-full" placeholder="IT12345678901" />
            </div>

            <div class="form-field">
              <label for="website">Sito Web</label>
              <InputText id="website" v-model="formData.website" class="w-full" placeholder="https://..." />
            </div>

            <div class="form-field full-width">
              <div class="checkbox-wrapper">
                <Checkbox id="isActive" v-model="formData.isActive" :binary="true" />
                <label for="isActive" class="checkbox-label">Fornitore Attivo</label>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Tab Indirizzo -->
        <TabPanel header="Indirizzo">
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="street">Indirizzo</label>
              <InputText id="street" v-model="formData.address.street" class="w-full" placeholder="Via/Piazza..." />
            </div>

            <div class="form-field">
              <label for="city">Citta</label>
              <InputText id="city" v-model="formData.address.city" class="w-full" />
            </div>

            <div class="form-field">
              <label for="province">Provincia</label>
              <InputText id="province" v-model="formData.address.province" class="w-full" placeholder="MI" maxlength="2" />
            </div>

            <div class="form-field">
              <label for="zip">CAP</label>
              <InputText id="zip" v-model="formData.address.zip" class="w-full" placeholder="20100" />
            </div>

            <div class="form-field">
              <label for="country">Paese</label>
              <Dropdown
                id="country"
                v-model="formData.address.country"
                :options="countries"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleziona paese"
                class="w-full"
              />
            </div>
          </div>
        </TabPanel>

        <!-- Tab Condizioni Commerciali -->
        <TabPanel header="Condizioni Commerciali">
          <div class="form-grid">
            <div class="form-field">
              <label for="paymentTerms">Termini Pagamento</label>
              <Dropdown
                id="paymentTerms"
                v-model="formData.paymentTerms"
                :options="paymentTermsOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleziona termini"
                class="w-full"
              />
            </div>

            <div class="form-field">
              <label for="defaultLeadTimeDays">Lead Time Default (giorni)</label>
              <InputNumber id="defaultLeadTimeDays" v-model="formData.defaultLeadTimeDays" class="w-full" :min="1" :max="365" />
            </div>
          </div>
        </TabPanel>

        <!-- Tab Dati Bancari -->
        <TabPanel header="Dati Bancari">
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="bankName">Banca</label>
              <InputText id="bankName" v-model="formData.bankName" class="w-full" placeholder="Nome banca" />
            </div>

            <div class="form-field full-width">
              <label for="iban">IBAN</label>
              <InputText id="iban" v-model="formData.iban" class="w-full iban-input" placeholder="IT60X0542811101000000123456" />
            </div>

            <div class="form-field">
              <label for="swift">SWIFT/BIC</label>
              <InputText id="swift" v-model="formData.swift" class="w-full" placeholder="BPPIITRRXXX" />
            </div>
          </div>
        </TabPanel>

        <!-- Tab Note -->
        <TabPanel header="Note">
          <div class="form-grid">
            <div class="form-field full-width">
              <label for="notes">Note e Osservazioni</label>
              <Textarea id="notes" v-model="formData.notes" rows="6" class="w-full" placeholder="Inserisci eventuali note sul fornitore..." />
            </div>
          </div>
        </TabPanel>
      </TabView>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" @click="showDialog = false" class="p-button-text" />
        <Button label="Salva" icon="pi pi-check" @click="handleSave" :loading="saving" />
      </template>
    </Dialog>

    <!-- Dialog View Details (Enhanced with Performance/Catalog) -->
    <SupplierDetailDialog
      v-model="showDetailDialog"
      :supplier="selectedSupplier"
      @edit="editFromDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import Divider from 'primevue/divider';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';
import SupplierDetailDialog from '../components/SupplierDetailDialog.vue';
import PurchaseTimelineChart from '../components/PurchaseTimelineChart.vue';
import PurchaseSeasonalityChart from '../components/PurchaseSeasonalityChart.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const saving = ref(false);
const suppliers = ref([]);
const totalRecords = ref(0);
const search = ref('');
const selectedCountry = ref(null);
const isActive = ref(null);
const page = ref(1);
const sortBy = ref('createdAt');
const sortOrder = ref('desc');
const activeTab = ref(0);

const showDialog = ref(false);
const showDetailDialog = ref(false);
const selectedSupplier = ref<any>(null);

const stats = ref({
  activeSuppliers: 0,
  totalOrders: 0,
  totalValue: 0,
});

const formData = ref({
  code: '',
  businessName: '',
  email: '',
  phone: '',
  taxId: '',
  website: '',
  address: {
    street: '',
    city: '',
    province: '',
    zip: '',
    country: 'IT',
  },
  paymentTerms: 30,
  defaultLeadTimeDays: 7,
  bankName: '',
  iban: '',
  swift: '',
  notes: '',
  isActive: true,
});

// Opzioni termini di pagamento standard
const paymentTermsOptions = [
  { label: 'Pagamento anticipato', value: 0 },
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
  { label: '90 giorni', value: 90 },
  { label: '120 giorni', value: 120 },
];

const countries = [
  { label: 'Italia', value: 'IT' },
  { label: 'Germania', value: 'DE' },
  { label: 'Francia', value: 'FR' },
  { label: 'Spagna', value: 'ES' },
  { label: 'UK', value: 'UK' },
  { label: 'USA', value: 'US' },
  { label: 'Cina', value: 'CN' },
];

const statusOptions = [
  { label: 'Attivi', value: true },
  { label: 'Inattivi', value: false },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

const getPercentage = (value: number, total: number) => {
  return total > 0 ? Math.round((value / total) * 100) : 0;
};

let searchTimeout: any = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadSuppliers();
  }, 500);
};

const loadStats = async () => {
  try {
    const response = await api.get('/suppliers?limit=100');
    const allSuppliers = response.data?.items || [];

    stats.value = {
      activeSuppliers: allSuppliers.filter((s: any) => s.isActive).length,
      totalOrders: allSuppliers.reduce((sum: number, s: any) => sum + (s._count?.purchaseOrders || 0), 0),
      totalValue: allSuppliers.reduce((sum: number, s: any) => sum + (s.purchaseOrders?.reduce((t: number, po: any) => t + parseFloat(po.totalAmount || 0), 0) || 0), 0),
    };
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadSuppliers = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(search.value && { search: search.value }),
      ...(selectedCountry.value && { country: selectedCountry.value }),
      ...(isActive.value !== null && { isActive: isActive.value.toString() }),
    });

    const response = await api.get(`/suppliers?${params.toString()}`);

    if (response.success) {
      suppliers.value = response.data?.items || [];
      totalRecords.value = response.data?.pagination?.total || 0;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dei fornitori',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadSuppliers();
};

const onSort = (event: any) => {
  sortBy.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadSuppliers();
};

const openCreateDialog = async () => {
  selectedSupplier.value = null;

  // Generate code
  try {
    const response = await api.get('/suppliers/generate-code');
    formData.value = {
      code: response.data.code,
      businessName: '',
      email: '',
      phone: '',
      taxId: '',
      website: '',
      address: {
        street: '',
        city: '',
        province: '',
        zip: '',
        country: 'IT',
      },
      paymentTerms: 30,
      defaultLeadTimeDays: 7,
      bankName: '',
      iban: '',
      swift: '',
      notes: '',
      isActive: true,
    };
  } catch (error) {
    formData.value.code = 'SUP001';
  }

  showDialog.value = true;
};

const viewSupplier = (supplier: any) => {
  selectedSupplier.value = supplier;
  showDetailDialog.value = true;
};

const editSupplier = (supplier: any) => {
  selectedSupplier.value = supplier;

  // Parse address JSON - può essere oggetto o stringa
  let addressData = {
    street: '',
    city: '',
    province: '',
    zip: '',
    country: 'IT',
  };

  if (supplier.address) {
    if (typeof supplier.address === 'string') {
      try {
        addressData = { ...addressData, ...JSON.parse(supplier.address) };
      } catch (e) {
        // Se non è JSON, usa come stringa street
        addressData.street = supplier.address;
      }
    } else if (typeof supplier.address === 'object') {
      addressData = { ...addressData, ...supplier.address };
    }
  }

  formData.value = {
    code: supplier.code,
    businessName: supplier.businessName || '',
    email: supplier.email || '',
    phone: supplier.phone || '',
    taxId: supplier.taxId || '',
    website: supplier.website || '',
    address: addressData,
    paymentTerms: supplier.paymentTerms || 30,
    defaultLeadTimeDays: supplier.defaultLeadTimeDays || 7,
    bankName: supplier.bankName || '',
    iban: supplier.iban || '',
    swift: supplier.swift || '',
    notes: supplier.notes || '',
    isActive: supplier.isActive !== false,
  };
  showDialog.value = true;
};

const editFromDetail = (supplier: any) => {
  showDetailDialog.value = false;
  editSupplier(supplier || selectedSupplier.value);
};

const deleteSupplier = (supplier: any) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare il fornitore ${supplier.businessName}?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Si, elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/suppliers/${supplier.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminato',
          detail: 'Fornitore eliminato con successo',
          life: 3000,
        });
        loadSuppliers();
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
    // Validation
    if (!formData.value.code || !formData.value.businessName) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Compila tutti i campi obbligatori (Codice e Nome)',
        life: 3000,
      });
      return;
    }

    saving.value = true;

    if (selectedSupplier.value?.id) {
      // Update
      await api.patch(`/suppliers/${selectedSupplier.value.id}`, formData.value);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Fornitore aggiornato con successo',
        life: 3000,
      });
    } else {
      // Create
      await api.post('/suppliers', formData.value);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Fornitore creato con successo',
        life: 3000,
      });
    }

    showDialog.value = false;
    loadSuppliers();
    loadStats();
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

onMounted(() => {
  loadSuppliers();
  loadStats();
});
</script>

<style scoped>
.suppliers-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* TabView Styles */
.supplier-tabs {
  margin-top: var(--space-6);
}

.supplier-tabs :deep(.p-tabview-panels) {
  padding: var(--space-6) 0 0 0;
}

.supplier-tabs :deep(.p-tabview-nav) {
  background: var(--surface-card);
  border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
  border: 1px solid var(--surface-border);
  border-bottom: none;
}

.supplier-tabs :deep(.p-tabview-nav-link) {
  padding: var(--space-4) var(--space-6);
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
  vertical-align: middle;
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

.custom-table :deep(.p-paginator) {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
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

.supplier-name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 500;
  color: var(--color-gray-900);
}

.supplier-name i {
  color: var(--color-primary-600);
}

.email-link {
  color: var(--color-primary-600);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.email-link:hover {
  color: var(--color-primary-700);
  text-decoration: underline;
}

.phone-text {
  color: var(--color-gray-600);
}

.country-tag {
  font-size: var(--font-size-xs);
}

.payment-terms {
  color: var(--color-success);
  font-weight: 600;
}

.status-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
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

/* IBAN Input */
.iban-input {
  font-family: var(--font-mono);
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* Detail Dialog */
.supplier-details {
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.detail-header__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
}

.detail-section {
  margin: var(--space-4) 0;
}

.detail-section__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-4) 0;
}

.detail-section__title i {
  color: var(--color-primary-600);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.detail-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-sm);
  color: var(--color-gray-900);
}

.address-box {
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  border-left: 3px solid var(--color-primary-600);
}

.address-box p {
  margin: var(--space-1) 0;
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
}

.notes-text {
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  color: var(--color-gray-600);
  line-height: var(--line-height-relaxed);
  margin: 0;
  font-size: var(--font-size-sm);
}

/* Mini Stats Grid */
.stats-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.stat-mini-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-primary-600);
  border-radius: var(--border-radius-md);
  color: white;
}

.stat-mini-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
}

.stat-mini-content {
  flex: 1;
}

.stat-mini-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin-bottom: var(--space-1);
}

.stat-mini-label {
  font-size: var(--font-size-xs);
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .stats-mini-grid {
    grid-template-columns: 1fr;
  }
}
</style>
