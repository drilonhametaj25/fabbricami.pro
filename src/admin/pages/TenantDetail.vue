<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import ProgressSpinner from 'primevue/progressspinner';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    trialEndsAt?: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    plan: {
      code: string;
      name: string;
      priceMonthly: number;
      priceYearly: number;
    };
    billing: Array<{
      id: string;
      amount: number;
      status: string;
      createdAt: string;
    }>;
  } | null;
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      lastLogin?: string;
      isActive: boolean;
    };
  }>;
}

const loading = ref(true);
const tenant = ref<TenantDetail | null>(null);

// Dialogs
const extendTrialDialog = ref(false);
const extendDays = ref(14);

const changePlanDialog = ref(false);
const newPlanCode = ref('');
const planOptions = [
  { label: 'Starter', value: 'STARTER' },
  { label: 'Pro', value: 'PRO' },
  { label: 'Business', value: 'BUSINESS' },
];

onMounted(async () => {
  await loadTenant();
});

async function loadTenant() {
  const id = route.params.id as string;
  loading.value = true;
  try {
    const response = await adminApi.getTenant(id);
    if (response.success && response.data) {
      tenant.value = response.data;
      if (tenant.value.subscription) {
        newPlanCode.value = tenant.value.subscription.plan.code;
      }
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: 'Tenant non trovato',
        life: 3000,
      });
      router.push('/tenants');
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Impossibile caricare il tenant',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
}

async function extendTrial() {
  if (!tenant.value) return;

  try {
    const response = await adminApi.extendTrial(tenant.value.id, extendDays.value);
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Trial Esteso',
        detail: `Trial esteso di ${extendDays.value} giorni`,
        life: 3000,
      });
      extendTrialDialog.value = false;
      await loadTenant();
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

async function changePlan() {
  if (!tenant.value) return;

  try {
    const response = await adminApi.changeTenantPlan(tenant.value.id, newPlanCode.value);
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Piano Cambiato',
        detail: 'Piano aggiornato con successo',
        life: 3000,
      });
      changePlanDialog.value = false;
      await loadTenant();
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

function confirmSuspend() {
  if (!tenant.value) return;

  const action = tenant.value.status === 'SUSPENDED' ? 'riattivare' : 'sospendere';
  const newStatus = tenant.value.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

  confirm.require({
    message: `Sei sicuro di voler ${action} questo tenant?`,
    header: 'Conferma',
    icon: 'pi pi-exclamation-triangle',
    accept: () => setStatus(newStatus as 'ACTIVE' | 'SUSPENDED'),
  });
}

async function setStatus(status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED') {
  if (!tenant.value) return;

  try {
    const response = await adminApi.setTenantStatus(tenant.value.id, status);
    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Status Aggiornato',
        detail: `Tenant ${status === 'ACTIVE' ? 'riattivato' : 'sospeso'}`,
        life: 3000,
      });
      await loadTenant();
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function getStatusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' | undefined {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'TRIALING':
      return 'info';
    case 'SUSPENDED':
    case 'PAST_DUE':
      return 'warning';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return undefined;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header flex items-center gap-4">
      <Button
        icon="pi pi-arrow-left"
        class="p-button-text"
        @click="router.push('/tenants')"
      />
      <div>
        <h1 class="page-title">{{ tenant?.name || 'Caricamento...' }}</h1>
        <p class="page-subtitle" v-if="tenant">
          <code>{{ tenant.slug }}</code>
        </p>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <template v-else-if="tenant">
      <!-- Actions Bar -->
      <div class="actions-bar">
        <Button
          label="Estendi Trial"
          icon="pi pi-clock"
          class="p-button-outlined"
          @click="extendTrialDialog = true"
          :disabled="tenant.subscription?.status !== 'TRIALING' && tenant.subscription?.status !== 'EXPIRED'"
        />
        <Button
          label="Cambia Piano"
          icon="pi pi-credit-card"
          class="p-button-outlined"
          @click="changePlanDialog = true"
        />
        <Button
          :label="tenant.status === 'SUSPENDED' ? 'Riattiva' : 'Sospendi'"
          :icon="tenant.status === 'SUSPENDED' ? 'pi pi-check' : 'pi pi-ban'"
          :class="tenant.status === 'SUSPENDED' ? 'p-button-success' : 'p-button-warning'"
          class="p-button-outlined"
          @click="confirmSuspend"
        />
      </div>

      <div class="grid-2">
        <!-- Subscription Info -->
        <Card>
          <template #title>Abbonamento</template>
          <template #content>
            <div v-if="tenant.subscription" class="info-grid">
              <div class="info-item">
                <span class="info-label">Piano</span>
                <span class="info-value">
                  <Tag :value="tenant.subscription.plan.code" severity="info" />
                  {{ tenant.subscription.plan.name }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <Tag
                  :value="tenant.subscription.status"
                  :severity="getStatusSeverity(tenant.subscription.status)"
                />
              </div>
              <div class="info-item" v-if="tenant.subscription.trialEndsAt">
                <span class="info-label">Fine Trial</span>
                <span class="info-value">{{ formatDate(tenant.subscription.trialEndsAt) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Periodo Corrente</span>
                <span class="info-value">
                  {{ formatDate(tenant.subscription.currentPeriodStart) }} -
                  {{ formatDate(tenant.subscription.currentPeriodEnd) }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Prezzo Mensile</span>
                <span class="info-value">{{ formatCurrency(tenant.subscription.plan.priceMonthly) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Prezzo Annuale</span>
                <span class="info-value">{{ formatCurrency(tenant.subscription.plan.priceYearly) }}</span>
              </div>
            </div>
            <div v-else class="empty-state">
              <i class="pi pi-exclamation-circle"></i>
              <p>Nessun abbonamento</p>
            </div>
          </template>
        </Card>

        <!-- Tenant Info -->
        <Card>
          <template #title>Informazioni Tenant</template>
          <template #content>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">ID</span>
                <span class="info-value"><code>{{ tenant.id }}</code></span>
              </div>
              <div class="info-item">
                <span class="info-label">Slug</span>
                <span class="info-value"><code>{{ tenant.slug }}</code></span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <Tag :value="tenant.status" :severity="getStatusSeverity(tenant.status)" />
              </div>
              <div class="info-item">
                <span class="info-label">Registrato</span>
                <span class="info-value">{{ formatDate(tenant.createdAt) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Membri</span>
                <span class="info-value">{{ tenant.members.length }}</span>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Members -->
      <Card class="mt-4">
        <template #title>Membri del Team</template>
        <template #content>
          <DataTable :value="tenant.members" :rows="10">
            <Column header="Utente">
              <template #body="{ data }">
                <div>{{ data.user.firstName }} {{ data.user.lastName }}</div>
                <div class="text-muted text-sm">{{ data.user.email }}</div>
              </template>
            </Column>
            <Column field="role" header="Ruolo">
              <template #body="{ data }">
                <Tag :value="data.role" />
              </template>
            </Column>
            <Column header="Ultimo Accesso">
              <template #body="{ data }">
                {{ data.user.lastLogin ? formatDate(data.user.lastLogin) : 'Mai' }}
              </template>
            </Column>
            <Column header="Attivo">
              <template #body="{ data }">
                <i
                  :class="data.user.isActive ? 'pi pi-check-circle text-success' : 'pi pi-times-circle text-danger'"
                ></i>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <!-- Billing History -->
      <Card class="mt-4" v-if="tenant.subscription?.billing?.length">
        <template #title>Storico Pagamenti</template>
        <template #content>
          <DataTable :value="tenant.subscription.billing" :rows="10">
            <Column header="Data">
              <template #body="{ data }">
                {{ formatDate(data.createdAt) }}
              </template>
            </Column>
            <Column header="Importo">
              <template #body="{ data }">
                {{ formatCurrency(data.amount) }}
              </template>
            </Column>
            <Column header="Status">
              <template #body="{ data }">
                <Tag
                  :value="data.status"
                  :severity="data.status === 'paid' ? 'success' : 'danger'"
                />
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>

    <!-- Extend Trial Dialog -->
    <Dialog v-model:visible="extendTrialDialog" header="Estendi Trial" :style="{ width: '400px' }" modal>
      <div class="form-group">
        <label class="form-label">Giorni da aggiungere</label>
        <InputNumber v-model="extendDays" :min="1" :max="365" class="w-full" />
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="extendTrialDialog = false" />
        <Button label="Estendi" icon="pi pi-check" @click="extendTrial" />
      </template>
    </Dialog>

    <!-- Change Plan Dialog -->
    <Dialog v-model:visible="changePlanDialog" header="Cambia Piano" :style="{ width: '400px' }" modal>
      <div class="form-group">
        <label class="form-label">Nuovo Piano</label>
        <Dropdown
          v-model="newPlanCode"
          :options="planOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
        />
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="changePlanDialog = false" />
        <Button label="Cambia Piano" icon="pi pi-check" @click="changePlan" />
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

.actions-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-grid {
  display: grid;
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #334155;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  color: #94a3b8;
  font-size: 0.875rem;
}

.info-value {
  color: #f1f5f9;
  font-weight: 500;
}

.info-value code {
  background: #0f172a;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}

.empty-state i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.text-success {
  color: #22c55e;
}

.text-danger {
  color: #ef4444;
}

.text-sm {
  font-size: 0.75rem;
}

.mt-4 {
  margin-top: 1rem;
}

.w-full {
  width: 100%;
}
</style>
