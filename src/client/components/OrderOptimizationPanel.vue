<template>
  <div class="optimization-panel">
    <!-- Header with Stats -->
    <div class="panel-header">
      <div class="header-info">
        <h3>
          <i class="pi pi-lightbulb"></i>
          Suggerimenti di Ottimizzazione
        </h3>
        <p class="header-subtitle">
          Analisi di {{ data?.totalPendingOrders || 0 }} ordini in attesa di processamento
        </p>
      </div>
      <Button
        icon="pi pi-refresh"
        class="p-button-text"
        @click="loadOptimization"
        :loading="loading"
        v-tooltip.left="'Aggiorna analisi'"
      />
    </div>

    <!-- Savings Summary -->
    <div class="savings-summary" v-if="data?.estimatedSavings">
      <div class="savings-card" v-if="data.estimatedSavings.productionEfficiency">
        <div class="savings-icon production">
          <i class="pi pi-clock"></i>
        </div>
        <div class="savings-content">
          <span class="savings-value">{{ data.estimatedSavings.productionEfficiency.description }}</span>
          <span class="savings-label">Efficienza Produzione</span>
        </div>
      </div>
      <div class="savings-card" v-if="data.estimatedSavings.shippingEfficiency">
        <div class="savings-icon shipping">
          <i class="pi pi-euro"></i>
        </div>
        <div class="savings-content">
          <span class="savings-value">{{ data.estimatedSavings.shippingEfficiency.description }}</span>
          <span class="savings-label">Risparmio Spedizioni</span>
        </div>
      </div>
      <div class="savings-card total" v-if="data.estimatedSavings.totalOrdersOptimized > 0">
        <div class="savings-icon total">
          <i class="pi pi-check-circle"></i>
        </div>
        <div class="savings-content">
          <span class="savings-value">{{ data.estimatedSavings.totalOrdersOptimized }} ordini</span>
          <span class="savings-label">Ottimizzabili</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner style="width: 50px; height: 50px" />
      <p>Analisi in corso...</p>
    </div>

    <!-- No Data State -->
    <div v-else-if="!data || data.totalPendingOrders === 0" class="empty-state">
      <i class="pi pi-check-circle"></i>
      <h4>Nessun ordine in attesa</h4>
      <p>Non ci sono ordini pending o confermati da ottimizzare</p>
    </div>

    <!-- Suggestions List -->
    <div v-else class="suggestions-list">
      <div
        v-for="(suggestion, index) in data.suggestions"
        :key="index"
        class="suggestion-card"
        :class="suggestion.type.toLowerCase()"
      >
        <div class="suggestion-header">
          <div class="suggestion-icon" :class="suggestion.severity">
            <i :class="`pi ${suggestion.icon}`"></i>
          </div>
          <div class="suggestion-title-area">
            <h4 class="suggestion-title">{{ suggestion.title }}</h4>
            <p class="suggestion-description">{{ suggestion.description }}</p>
          </div>
          <Tag :severity="suggestion.severity" :value="suggestion.orders.length + ' ordini'" />
        </div>

        <div class="suggestion-body">
          <!-- Orders List -->
          <div class="orders-preview">
            <div
              v-for="order in suggestion.orders.slice(0, 5)"
              :key="order.id"
              class="order-chip"
            >
              <span class="order-number">{{ order.orderNumber }}</span>
              <span v-if="order.customer" class="order-customer">{{ order.customer }}</span>
              <span v-if="order.quantity" class="order-qty">{{ order.quantity }} pz</span>
            </div>
            <div v-if="suggestion.orders.length > 5" class="more-orders">
              +{{ suggestion.orders.length - 5 }} altri
            </div>
          </div>

          <!-- Savings Badge -->
          <div v-if="suggestion.savings" class="savings-badge">
            <i class="pi pi-bolt"></i>
            {{ suggestion.savings }}
          </div>
        </div>

        <div class="suggestion-footer">
          <span class="action-text">{{ suggestion.action }}</span>
          <Button
            :label="getActionLabel(suggestion.type)"
            :icon="getActionIcon(suggestion.type)"
            size="small"
            :severity="suggestion.severity"
            @click="executeAction(suggestion)"
          />
        </div>
      </div>
    </div>

    <!-- Groupings Detail (Collapsible) -->
    <div class="groupings-section" v-if="data && (data.groupings?.byDestination?.length > 0 || data.groupings?.byProduct?.length > 0)">
      <Accordion>
        <AccordionTab header="Dettaglio Raggruppamenti">
          <div class="groupings-grid">
            <!-- By Destination -->
            <div class="grouping-column" v-if="data.groupings?.byDestination?.length > 0">
              <h5><i class="pi pi-globe"></i> Per Destinazione</h5>
              <div class="grouping-list">
                <div
                  v-for="group in data.groupings.byDestination"
                  :key="group.country"
                  class="grouping-item"
                >
                  <div class="grouping-header">
                    <span class="grouping-name">{{ group.country }}</span>
                    <Badge :value="group.orderCount" severity="info" />
                  </div>
                  <div class="grouping-meta">
                    <span>{{ formatCurrency(group.totalValue) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- By Product -->
            <div class="grouping-column" v-if="data.groupings?.byProduct?.length > 0">
              <h5><i class="pi pi-box"></i> Per Prodotto</h5>
              <div class="grouping-list">
                <div
                  v-for="group in data.groupings.byProduct"
                  :key="group.product.id"
                  class="grouping-item"
                >
                  <div class="grouping-header">
                    <span class="grouping-name">{{ group.product.name }}</span>
                    <Badge :value="group.orderCount" severity="info" />
                  </div>
                  <div class="grouping-meta">
                    <span class="sku">{{ group.product.sku }}</span>
                    <span>{{ group.totalQuantity }} unità totali</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AccordionTab>
      </Accordion>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const emit = defineEmits(['action-executed']);

const toast = useToast();

// State
const loading = ref(false);
const data = ref<any>(null);

// Methods
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const loadOptimization = async () => {
  loading.value = true;
  try {
    const response = await api.get('/orders/optimization-suggestions');
    data.value = response.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento suggerimenti',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const getActionLabel = (type: string) => {
  const labels: Record<string, string> = {
    URGENT: 'Processa Ora',
    PRODUCT_BATCH: 'Avvia Batch',
    SHIPPING_BATCH: 'Prepara Spedizione',
    STANDARD: 'Visualizza',
  };
  return labels[type] || 'Azione';
};

const getActionIcon = (type: string) => {
  const icons: Record<string, string> = {
    URGENT: 'pi pi-bolt',
    PRODUCT_BATCH: 'pi pi-cog',
    SHIPPING_BATCH: 'pi pi-truck',
    STANDARD: 'pi pi-list',
  };
  return icons[type] || 'pi pi-arrow-right';
};

const executeAction = (suggestion: any) => {
  // Emetti evento per gestione nel parent
  emit('action-executed', suggestion);

  // Mostra toast informativo
  toast.add({
    severity: 'info',
    summary: 'Azione Suggerita',
    detail: `${suggestion.action}: ${suggestion.orders.length} ordini selezionati`,
    life: 4000,
  });
};

// Lifecycle
onMounted(() => {
  loadOptimization();
});
</script>

<style scoped>
.optimization-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--surface-border);
}

.header-info h3 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-lg);
  color: var(--text-color);
}

.header-info h3 i {
  color: var(--yellow-500);
}

.header-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

/* Savings Summary */
.savings-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.savings-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
}

.savings-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.savings-icon.production {
  background: var(--blue-100);
  color: var(--blue-600);
}

.savings-icon.shipping {
  background: var(--green-100);
  color: var(--green-600);
}

.savings-icon.total {
  background: var(--purple-100);
  color: var(--purple-600);
}

.savings-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.savings-value {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-color);
}

.savings-label {
  font-size: var(--font-size-xs);
  color: var(--text-color-secondary);
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
  color: var(--text-color-secondary);
}

.empty-state i {
  font-size: 3rem;
  color: var(--green-500);
  margin-bottom: var(--space-4);
}

.empty-state h4 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-color);
}

.empty-state p {
  margin: 0;
}

/* Suggestions List */
.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.suggestion-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  transition: all 0.2s;
}

.suggestion-card:hover {
  box-shadow: var(--shadow-md);
}

.suggestion-card.urgent {
  border-left: 4px solid var(--red-500);
}

.suggestion-card.product_batch {
  border-left: 4px solid var(--blue-500);
}

.suggestion-card.shipping_batch {
  border-left: 4px solid var(--green-500);
}

.suggestion-card.standard {
  border-left: 4px solid var(--gray-400);
}

.suggestion-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.suggestion-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.suggestion-icon.danger {
  background: var(--red-100);
  color: var(--red-600);
}

.suggestion-icon.info {
  background: var(--blue-100);
  color: var(--blue-600);
}

.suggestion-icon.success {
  background: var(--green-100);
  color: var(--green-600);
}

.suggestion-icon.secondary {
  background: var(--gray-100);
  color: var(--gray-600);
}

.suggestion-title-area {
  flex: 1;
}

.suggestion-title {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-color);
}

.suggestion-description {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

.suggestion-body {
  margin-bottom: var(--space-4);
}

.orders-preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.order-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--surface-100);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
}

.order-number {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--primary-color);
}

.order-customer {
  color: var(--text-color-secondary);
  font-size: var(--font-size-xs);
}

.order-qty {
  background: var(--primary-100);
  color: var(--primary-700);
  padding: 0 var(--space-2);
  border-radius: var(--border-radius-xs);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.more-orders {
  display: inline-flex;
  align-items: center;
  color: var(--text-color-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.savings-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--yellow-100);
  color: var(--yellow-800);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.savings-badge i {
  color: var(--yellow-600);
}

.suggestion-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--surface-border);
}

.action-text {
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
}

/* Groupings Section */
.groupings-section {
  margin-top: var(--space-4);
}

.groupings-section :deep(.p-accordion-header-link) {
  font-size: var(--font-size-sm);
}

.groupings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}

@media (max-width: 768px) {
  .groupings-grid {
    grid-template-columns: 1fr;
  }
}

.grouping-column h5 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-sm);
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.grouping-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.grouping-item {
  background: var(--surface-50);
  border-radius: var(--border-radius-sm);
  padding: var(--space-3);
}

.grouping-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.grouping-name {
  font-weight: 500;
  color: var(--text-color);
}

.grouping-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-size-xs);
  color: var(--text-color-secondary);
}

.grouping-meta .sku {
  font-family: var(--font-mono);
}
</style>
