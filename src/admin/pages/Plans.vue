<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import InputSwitch from 'primevue/inputswitch';
import Chips from 'primevue/chips';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';

const toast = useToast();
const confirm = useConfirm();

interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  features: { modules: string[]; capabilities: string[] };
  limits: {
    maxUsers: number;
    maxWarehouses: number;
    maxProducts: number;
    maxOrders: number;
    maxSuppliers: number;
  };
  isActive: boolean;
  sortOrder: number;
  stripeProductId?: string;
  stripePriceMonthlyId?: string;
  stripePriceYearlyId?: string;
  _count: { subscriptions: number };
}

const loading = ref(true);
const plans = ref<Plan[]>([]);
const dialogVisible = ref(false);
const editMode = ref(false);
const syncing = ref<string | null>(null);

const formData = ref({
  id: '',
  code: '',
  name: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  features: {
    modules: [] as string[],
    capabilities: [] as string[],
  },
  limits: {
    maxUsers: 5,
    maxWarehouses: 1,
    maxProducts: 1000,
    maxOrders: 500,
    maxSuppliers: 50,
  },
  sortOrder: 0,
  isActive: true,
});

onMounted(async () => {
  await loadPlans();
});

async function loadPlans() {
  loading.value = true;
  try {
    const response = await adminApi.getPlans();
    if (response.success && response.data) {
      plans.value = response.data.items;
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare i piani',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  editMode.value = false;
  formData.value = {
    id: '',
    code: '',
    name: '',
    description: '',
    priceMonthly: 0,
    priceYearly: 0,
    features: {
      modules: [],
      capabilities: [],
    },
    limits: {
      maxUsers: 5,
      maxWarehouses: 1,
      maxProducts: 1000,
      maxOrders: 500,
      maxSuppliers: 50,
    },
    sortOrder: plans.value.length,
    isActive: true,
  };
  dialogVisible.value = true;
}

function openEditDialog(plan: Plan) {
  editMode.value = true;
  formData.value = {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description || '',
    priceMonthly: Number(plan.priceMonthly),
    priceYearly: Number(plan.priceYearly),
    features: { ...plan.features },
    limits: { ...plan.limits },
    sortOrder: plan.sortOrder,
    isActive: plan.isActive,
  };
  dialogVisible.value = true;
}

async function savePlan() {
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
    const data = {
      code: formData.value.code,
      name: formData.value.name,
      description: formData.value.description || undefined,
      priceMonthly: formData.value.priceMonthly,
      priceYearly: formData.value.priceYearly,
      features: formData.value.features,
      limits: formData.value.limits,
      sortOrder: formData.value.sortOrder,
      isActive: formData.value.isActive,
    };

    let response;
    if (editMode.value) {
      response = await adminApi.updatePlan(formData.value.id, data);
    } else {
      response = await adminApi.createPlan(data);
    }

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Salvato',
        detail: editMode.value ? 'Piano aggiornato' : 'Piano creato',
        life: 3000,
      });
      dialogVisible.value = false;
      await loadPlans();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Operazione fallita',
        life: 3000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore di connessione',
      life: 3000,
    });
  }
}

function confirmDelete(plan: Plan) {
  confirm.require({
    message: `Sei sicuro di voler eliminare il piano "${plan.name}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deletePlan(plan.id),
  });
}

async function deletePlan(id: string) {
  try {
    const response = await adminApi.deletePlan(id);
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Eliminato',
        detail: 'Piano eliminato con successo',
        life: 3000,
      });
      await loadPlans();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Impossibile eliminare il piano',
        life: 3000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore di connessione',
      life: 3000,
    });
  }
}

async function syncToStripe(plan: Plan) {
  syncing.value = plan.id;
  try {
    const response = await adminApi.syncPlanToStripe(plan.id);
    if (response.success && response.data) {
      toast.add({
        severity: 'success',
        summary: 'Sincronizzato',
        detail: 'Piano sincronizzato con Stripe',
        life: 3000,
      });
      await loadPlans();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Sincronizzazione fallita',
        life: 3000,
      });
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore di connessione',
      life: 3000,
    });
  } finally {
    syncing.value = null;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatLimit(value: number): string {
  return value === -1 ? 'Illimitato' : value.toString();
}
</script>

<template>
  <div class="page">
    <div class="page-header flex justify-between items-center">
      <div>
        <h1 class="page-title">Gestione Piani</h1>
        <p class="page-subtitle">Configura i piani di abbonamento e sincronizza con Stripe</p>
      </div>
      <Button
        label="Nuovo Piano"
        icon="pi pi-plus"
        @click="openCreateDialog"
      />
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <div v-else class="card">
      <DataTable :value="plans" :rows="10" responsiveLayout="scroll">
        <Column field="code" header="Codice" sortable style="width: 100px">
          <template #body="{ data }">
            <Tag :value="data.code" :severity="data.isActive ? 'success' : 'danger'" />
          </template>
        </Column>
        <Column field="name" header="Nome" sortable></Column>
        <Column header="Prezzi" style="width: 180px">
          <template #body="{ data }">
            <div>{{ formatCurrency(data.priceMonthly) }}/mese</div>
            <div class="text-muted text-sm">{{ formatCurrency(data.priceYearly) }}/anno</div>
          </template>
        </Column>
        <Column header="Limiti" style="width: 200px">
          <template #body="{ data }">
            <div class="limits-compact">
              <span>{{ formatLimit(data.limits.maxUsers) }} utenti</span>
              <span>{{ formatLimit(data.limits.maxProducts) }} prodotti</span>
            </div>
          </template>
        </Column>
        <Column header="Abbonati" style="width: 100px">
          <template #body="{ data }">
            {{ data._count.subscriptions }}
          </template>
        </Column>
        <Column header="Stripe" style="width: 100px">
          <template #body="{ data }">
            <i
              :class="data.stripeProductId ? 'pi pi-check-circle text-success' : 'pi pi-times-circle text-muted'"
            ></i>
          </template>
        </Column>
        <Column header="Azioni" style="width: 200px">
          <template #body="{ data }">
            <div class="flex gap-2">
              <Button
                icon="pi pi-pencil"
                class="p-button-text p-button-sm"
                @click="openEditDialog(data)"
                v-tooltip="'Modifica'"
              />
              <Button
                icon="pi pi-bolt"
                class="p-button-text p-button-sm"
                :loading="syncing === data.id"
                @click="syncToStripe(data)"
                v-tooltip="'Sync Stripe'"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger p-button-sm"
                @click="confirmDelete(data)"
                v-tooltip="'Elimina'"
                :disabled="data._count.subscriptions > 0"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Edit/Create Dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="editMode ? 'Modifica Piano' : 'Nuovo Piano'"
      :style="{ width: '700px' }"
      modal
    >
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Codice</label>
          <InputText
            v-model="formData.code"
            :disabled="editMode"
            placeholder="STARTER"
            class="w-full"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Nome</label>
          <InputText v-model="formData.name" placeholder="Starter" class="w-full" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Descrizione</label>
        <Textarea
          v-model="formData.description"
          rows="2"
          placeholder="Descrizione del piano..."
          class="w-full"
        />
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Prezzo Mensile (EUR)</label>
          <InputNumber
            v-model="formData.priceMonthly"
            mode="currency"
            currency="EUR"
            locale="it-IT"
            class="w-full"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Prezzo Annuale (EUR)</label>
          <InputNumber
            v-model="formData.priceYearly"
            mode="currency"
            currency="EUR"
            locale="it-IT"
            class="w-full"
          />
        </div>
      </div>

      <h4 class="section-title">Limiti</h4>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Max Utenti (-1 = illimitato)</label>
          <InputNumber v-model="formData.limits.maxUsers" class="w-full" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Magazzini</label>
          <InputNumber v-model="formData.limits.maxWarehouses" class="w-full" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Prodotti</label>
          <InputNumber v-model="formData.limits.maxProducts" class="w-full" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Ordini/mese</label>
          <InputNumber v-model="formData.limits.maxOrders" class="w-full" />
        </div>
        <div class="form-group">
          <label class="form-label">Max Fornitori</label>
          <InputNumber v-model="formData.limits.maxSuppliers" class="w-full" />
        </div>
        <div class="form-group">
          <label class="form-label">Ordine di visualizzazione</label>
          <InputNumber v-model="formData.sortOrder" class="w-full" />
        </div>
      </div>

      <h4 class="section-title">Features</h4>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Moduli abilitati</label>
          <Chips v-model="formData.features.modules" class="w-full" />
        </div>
        <div class="form-group">
          <label class="form-label">Capabilities</label>
          <Chips v-model="formData.features.capabilities" class="w-full" />
        </div>
      </div>

      <div class="form-group flex items-center gap-2">
        <InputSwitch v-model="formData.isActive" />
        <label>Piano attivo</label>
      </div>

      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="dialogVisible = false" />
        <Button label="Salva" icon="pi pi-check" @click="savePlan" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.limits-compact {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.section-title {
  color: #94a3b8;
  font-size: 0.875rem;
  font-weight: 600;
  margin: 1.5rem 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.text-success {
  color: #22c55e;
}

.text-sm {
  font-size: 0.75rem;
}

.w-full {
  width: 100%;
}

:deep(.p-chips-multiple-container) {
  width: 100%;
}
</style>
