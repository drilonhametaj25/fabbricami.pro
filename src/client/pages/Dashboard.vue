<template>
  <div class="dashboard">
    <PageHeader
      title="Dashboard"
      subtitle="Panoramica delle metriche aziendali"
      icon="pi pi-home"
    />

    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p class="loading-text">Caricamento dati...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <Message severity="error" :closable="false">{{ error }}</Message>
    </div>

    <div v-else class="dashboard-content">
      <!-- KPI Cards -->
      <section class="section">
        <h2 class="section-title">Metriche Principali</h2>
        <div class="stats-grid">
          <StatsCard
            label="Ordini (30gg)"
            :value="dashboardData.kpis.ordersCount"
            icon="pi pi-shopping-cart"
            variant="primary"
            format="number"
          />
          <StatsCard
            label="Fatturato (30gg)"
            :value="dashboardData.kpis.revenue"
            icon="pi pi-euro"
            variant="success"
            format="currency"
          />
          <StatsCard
            label="Prodotti Attivi"
            :value="dashboardData.kpis.activeProducts"
            icon="pi pi-box"
            variant="info"
            format="number"
          />
          <StatsCard
            label="Clienti Attivi"
            :value="dashboardData.kpis.activeCustomers"
            icon="pi pi-users"
            variant="warning"
            format="number"
          />
        </div>
      </section>

      <!-- Secondary KPIs -->
      <section class="section">
        <h2 class="section-title">Performance</h2>
        <div class="stats-grid stats-grid--3">
          <StatsCard
            label="Tasso Completamento"
            :value="dashboardData.kpis.completionRate"
            icon="pi pi-percentage"
            variant="success"
            format="percent"
          />
          <StatsCard
            label="Valore Medio Ordine"
            :value="dashboardData.kpis.averageOrderValue"
            icon="pi pi-chart-line"
            variant="primary"
            format="currency"
          />
          <StatsCard
            label="Ordini Completati"
            :value="dashboardData.kpis.completedOrdersCount"
            icon="pi pi-check-circle"
            variant="success"
            format="number"
          />
        </div>
      </section>

      <!-- Low Stock Alert - Products -->
      <section v-if="dashboardData.lowStockItems && dashboardData.lowStockItems.length > 0" class="section">
        <div class="alert-card">
          <div class="alert-card__header">
            <div class="alert-card__icon">
              <i class="pi pi-exclamation-triangle"></i>
            </div>
            <div class="alert-card__title-group">
              <h3 class="alert-card__title">Scorte Basse - Prodotti</h3>
              <p class="alert-card__subtitle">{{ dashboardData.lowStockItems.length }} prodotti sotto la soglia minima</p>
            </div>
          </div>
          <div class="alert-card__content">
            <DataTable
              :value="dashboardData.lowStockItems"
              responsiveLayout="scroll"
              class="custom-table"
              :rows="5"
              :paginator="dashboardData.lowStockItems.length > 5"
            >
              <Column field="productSku" header="SKU" style="width: 120px"></Column>
              <Column field="productName" header="Prodotto"></Column>
              <Column field="location" header="Location" style="width: 150px"></Column>
              <Column field="quantity" header="Giacenza" style="width: 100px">
                <template #body="{ data }">
                  <Tag :severity="data.quantity <= 5 ? 'danger' : 'warning'" class="stock-tag">
                    {{ data.quantity }} pz
                  </Tag>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </section>

      <!-- Low Stock Alert - Materials -->
      <section v-if="lowStockMaterials && lowStockMaterials.length > 0" class="section">
        <div class="alert-card alert-card--danger">
          <div class="alert-card__header alert-card__header--danger">
            <div class="alert-card__icon alert-card__icon--danger">
              <i class="pi pi-exclamation-circle"></i>
            </div>
            <div class="alert-card__title-group">
              <h3 class="alert-card__title">Scorte Basse - Materiali</h3>
              <p class="alert-card__subtitle">{{ lowStockMaterials.length }} materiali richiedono riordino</p>
            </div>
            <router-link to="/materials?lowStock=true" class="alert-card__link">
              Vedi tutti <i class="pi pi-arrow-right"></i>
            </router-link>
          </div>
          <div class="alert-card__content">
            <DataTable
              :value="lowStockMaterials"
              responsiveLayout="scroll"
              class="custom-table"
              :rows="5"
              :paginator="lowStockMaterials.length > 5"
            >
              <Column field="sku" header="SKU" style="width: 120px">
                <template #body="{ data }">
                  <Tag :value="data.sku" severity="info" />
                </template>
              </Column>
              <Column field="name" header="Materiale"></Column>
              <Column field="category" header="Categoria" style="width: 120px">
                <template #body="{ data }">
                  <span v-if="data.category">{{ data.category }}</span>
                  <span v-else class="text-gray-400">-</span>
                </template>
              </Column>
              <Column field="currentStock" header="Giacenza" style="width: 100px">
                <template #body="{ data }">
                  <Tag :severity="data.currentStock === 0 ? 'danger' : 'warning'" class="stock-tag">
                    {{ data.currentStock }} {{ data.unit }}
                  </Tag>
                </template>
              </Column>
              <Column field="minStock" header="Min" style="width: 80px">
                <template #body="{ data }">
                  <span class="text-gray-500">{{ data.minStock }} {{ data.unit }}</span>
                </template>
              </Column>
              <Column field="deficit" header="Deficit" style="width: 100px">
                <template #body="{ data }">
                  <Tag severity="danger" class="stock-tag">
                    -{{ data.minStock - data.currentStock }} {{ data.unit }}
                  </Tag>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </section>

      <!-- Quick Stats Row -->
      <section class="section">
        <div class="quick-stats">
          <div class="quick-stat">
            <i class="pi pi-id-card quick-stat__icon"></i>
            <div class="quick-stat__content">
              <span class="quick-stat__value">{{ dashboardData.kpis.activeEmployees }}</span>
              <span class="quick-stat__label">Dipendenti Attivi</span>
            </div>
          </div>
          <div class="quick-stat">
            <i class="pi pi-building quick-stat__icon"></i>
            <div class="quick-stat__content">
              <span class="quick-stat__value">{{ dashboardData.kpis.warehouseCount || 0 }}</span>
              <span class="quick-stat__label">Magazzini</span>
            </div>
          </div>
          <div class="quick-stat">
            <i class="pi pi-truck quick-stat__icon"></i>
            <div class="quick-stat__content">
              <span class="quick-stat__value">{{ dashboardData.kpis.supplierCount || 0 }}</span>
              <span class="quick-stat__label">Fornitori</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import api from '../services/api.service';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';

const loading = ref(true);
const error = ref('');
const dashboardData = ref<any>({
  kpis: {
    revenue: 0,
    ordersCount: 0,
    averageOrderValue: 0,
    completedOrdersCount: 0,
    completionRate: 0,
    activeProducts: 0,
    activeCustomers: 0,
    activeEmployees: 0,
    warehouseCount: 0,
    supplierCount: 0,
  },
  lowStockItems: [],
  lowStockMaterials: [],
});
const lowStockMaterials = ref<any[]>([]);

const loadDashboardData = async () => {
  try {
    loading.value = true;
    error.value = '';

    const response = await api.get('/analytics/dashboard');

    if (response.success) {
      dashboardData.value = response.data;
      lowStockMaterials.value = response.data.lowStockMaterials || [];
    } else {
      error.value = 'Errore nel caricamento dei dati';
    }
  } catch (err: any) {
    error.value = err.message || 'Errore nel caricamento della dashboard';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadDashboardData();
});
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

/* Loading & Error States */
.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  gap: var(--space-4);
}

.loading-text {
  color: var(--color-gray-500);
  font-size: var(--font-size-sm);
}

.error-container {
  margin: var(--space-8) 0;
}

/* Dashboard Content */
.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0;
  padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--color-primary-100);
  display: inline-block;
  align-self: flex-start;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

.stats-grid--3 {
  grid-template-columns: repeat(3, 1fr);
}

/* Alert Card */
.alert-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--color-warning-light);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.alert-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: linear-gradient(135deg, var(--color-warning-light) 0%, #fff7ed 100%);
  border-bottom: var(--border-width) solid var(--color-warning-light);
}

.alert-card__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-md);
  background: var(--color-warning);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.alert-card__title-group {
  flex: 1;
}

.alert-card__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
}

.alert-card__subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.alert-card__content {
  padding: var(--space-4);
}

.alert-card__link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary-600);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.alert-card__link:hover {
  color: var(--color-primary-700);
}

/* Danger variant for materials */
.alert-card--danger {
  border-color: var(--color-danger-light);
}

.alert-card__header--danger {
  background: linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%);
  border-bottom-color: var(--color-danger-light);
}

.alert-card__icon--danger {
  background: var(--color-danger);
}

.stock-tag {
  font-weight: 600;
}

/* Quick Stats */
.quick-stats {
  display: flex;
  gap: var(--space-6);
  padding: var(--space-6);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
}

.quick-stat {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-card);
  border-radius: var(--border-radius-md);
  border: var(--border-width) solid var(--border-color-light);
  transition: all var(--transition-fast);
}

.quick-stat:hover {
  border-color: var(--color-primary-200);
  box-shadow: var(--shadow-sm);
}

.quick-stat__icon {
  font-size: 1.5rem;
  color: var(--color-primary-600);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-50);
  border-radius: var(--border-radius-md);
}

.quick-stat__content {
  display: flex;
  flex-direction: column;
}

.quick-stat__value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1;
}

.quick-stat__label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

/* Custom Table Styling */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

/* Responsive */
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .stats-grid--3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1024px) {
  .stats-grid--3 {
    grid-template-columns: repeat(2, 1fr);
  }
  .quick-stats {
    flex-wrap: wrap;
  }
  .quick-stat {
    flex: 1 1 calc(50% - var(--space-3));
    min-width: 200px;
  }
}

@media (max-width: 768px) {
  .stats-grid,
  .stats-grid--3 {
    grid-template-columns: 1fr;
  }
  .quick-stats {
    flex-direction: column;
  }
  .quick-stat {
    flex: 1;
  }
  .dashboard-content {
    gap: var(--space-8);
  }
}
</style>
