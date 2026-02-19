<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { adminApi } from '../services/api';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressSpinner from 'primevue/progressspinner';

const router = useRouter();
const toast = useToast();

const loading = ref(true);
const metrics = ref<{
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  paidTenants: number;
  expiredTenants: number;
  mrr: number;
  arr: number;
  trialConversionRate: number;
  churnRate: number;
  recentSignups: Array<{ id: string; name: string; createdAt: string; status: string }>;
  trialsEndingSoon: Array<{ id: string; name: string; trialEndsAt: string; ownerEmail: string }>;
  revenueByPlan: Array<{ planCode: string; planName: string; count: number; revenue: number }>;
} | null>(null);

onMounted(async () => {
  await loadDashboard();
});

async function loadDashboard() {
  loading.value = true;
  try {
    const response = await adminApi.getDashboard();
    if (response.success && response.data) {
      metrics.value = response.data;
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: response.error || 'Impossibile caricare i dati',
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
    loading.value = false;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function goToTenant(id: string) {
  router.push(`/tenants/${id}`);
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Dashboard</h1>
      <p class="page-subtitle">Panoramica della piattaforma</p>
    </div>

    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
    </div>

    <template v-else-if="metrics">
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">MRR</div>
          <div class="stat-value positive">{{ formatCurrency(metrics.mrr) }}</div>
          <div class="stat-change">Ricavo Mensile Ricorrente</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">ARR</div>
          <div class="stat-value">{{ formatCurrency(metrics.arr) }}</div>
          <div class="stat-change">Ricavo Annuale Ricorrente</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Tenant Totali</div>
          <div class="stat-value">{{ metrics.totalTenants }}</div>
          <div class="stat-change">
            {{ metrics.activeTenants }} attivi
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Trial</div>
          <div class="stat-value">{{ metrics.trialTenants }}</div>
          <div class="stat-change">In prova</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Paganti</div>
          <div class="stat-value positive">{{ metrics.paidTenants }}</div>
          <div class="stat-change">Abbonamenti attivi</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Scaduti</div>
          <div class="stat-value" :class="{ negative: metrics.expiredTenants > 0 }">
            {{ metrics.expiredTenants }}
          </div>
          <div class="stat-change">Trial scaduti</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Conversion Rate</div>
          <div class="stat-value">{{ metrics.trialConversionRate.toFixed(1) }}%</div>
          <div class="stat-change">Trial → Pagante (30 gg)</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Churn Rate</div>
          <div class="stat-value" :class="{ negative: metrics.churnRate > 5 }">
            {{ metrics.churnRate.toFixed(1) }}%
          </div>
          <div class="stat-change">Cancellazioni (30 gg)</div>
        </div>
      </div>

      <!-- Revenue by Plan -->
      <div class="grid-2 mb-4">
        <Card>
          <template #title>Revenue per Piano</template>
          <template #content>
            <DataTable :value="metrics.revenueByPlan" :rows="5">
              <Column field="planName" header="Piano"></Column>
              <Column field="count" header="Clienti"></Column>
              <Column header="MRR">
                <template #body="{ data }">
                  {{ formatCurrency(data.revenue) }}
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>

        <Card>
          <template #title>Trial in Scadenza</template>
          <template #content>
            <div v-if="metrics.trialsEndingSoon.length === 0" class="empty-state">
              <i class="pi pi-check-circle"></i>
              <p>Nessun trial in scadenza</p>
            </div>
            <DataTable
              v-else
              :value="metrics.trialsEndingSoon"
              :rows="5"
              @row-click="(e: any) => goToTenant(e.data.id)"
              class="clickable-rows"
            >
              <Column field="name" header="Tenant"></Column>
              <Column header="Scadenza">
                <template #body="{ data }">
                  {{ formatDate(data.trialEndsAt) }}
                </template>
              </Column>
              <Column field="ownerEmail" header="Email"></Column>
            </DataTable>
          </template>
        </Card>
      </div>

      <!-- Recent Signups -->
      <Card>
        <template #title>Registrazioni Recenti</template>
        <template #content>
          <div v-if="metrics.recentSignups.length === 0" class="empty-state">
            <i class="pi pi-inbox"></i>
            <p>Nessuna registrazione recente</p>
          </div>
          <DataTable
            v-else
            :value="metrics.recentSignups"
            :rows="10"
            @row-click="(e: any) => goToTenant(e.data.id)"
            class="clickable-rows"
          >
            <Column field="name" header="Nome"></Column>
            <Column header="Data">
              <template #body="{ data }">
                {{ formatDate(data.createdAt) }}
              </template>
            </Column>
            <Column header="Status">
              <template #body="{ data }">
                <span
                  class="badge"
                  :class="{
                    'badge-success': data.status === 'ACTIVE',
                    'badge-warning': data.status === 'SUSPENDED',
                    'badge-danger': data.status === 'CANCELLED',
                  }"
                >
                  {{ data.status }}
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 4rem;
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

.clickable-rows :deep(tbody tr) {
  cursor: pointer;
}

:deep(.p-card) {
  background: #1e293b;
  border: 1px solid #334155;
}

:deep(.p-card .p-card-title) {
  color: #f1f5f9;
  font-size: 1rem;
}

:deep(.p-card .p-card-content) {
  padding-top: 0.5rem;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
