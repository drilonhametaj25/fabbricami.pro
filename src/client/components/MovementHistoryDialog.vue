<template>
  <Dialog
    v-model:visible="visible"
    header="Storico Movimenti"
    :modal="true"
    :closable="true"
    :style="{ width: '800px' }"
    @show="loadMovements"
  >
    <!-- Product Info Header -->
    <div class="product-header" v-if="inventoryItem">
      <div class="product-info">
        <span class="sku-badge">{{ inventoryItem.product?.sku }}</span>
        <span class="product-name">{{ inventoryItem.product?.name }}</span>
        <Tag severity="info" class="location-tag">{{ inventoryItem.location }}</Tag>
      </div>
    </div>

    <!-- Movements Table -->
    <DataTable
      :value="movements"
      :loading="loading"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[10, 20, 50]"
      responsiveLayout="scroll"
      class="movements-table"
      :rowHover="true"
      emptyMessage="Nessun movimento trovato"
    >
      <Column field="createdAt" header="Data" style="min-width: 150px">
        <template #body="{ data }">
          <span class="date-text">{{ formatDate(data.createdAt) }}</span>
        </template>
      </Column>

      <Column field="type" header="Tipo" style="min-width: 100px">
        <template #body="{ data }">
          <Tag :severity="getTypeSeverity(data.type)" class="type-tag">
            <i :class="getTypeIcon(data.type)" class="type-icon"></i>
            {{ getTypeLabel(data.type) }}
          </Tag>
        </template>
      </Column>

      <Column field="quantity" header="Quantita" style="min-width: 100px">
        <template #body="{ data }">
          <span class="quantity-text" :class="getQuantityClass(data.type)">
            {{ data.type === 'IN' ? '+' : '-' }}{{ data.quantity }} pz
          </span>
        </template>
      </Column>

      <Column header="Da/A" style="min-width: 200px">
        <template #body="{ data }">
          <div class="location-flow">
            <span v-if="data.fromLocation" class="from-location">{{ data.fromLocation }}</span>
            <i v-if="data.fromLocation && data.toLocation" class="pi pi-arrow-right arrow-icon"></i>
            <span v-if="data.toLocation" class="to-location">{{ data.toLocation }}</span>
            <span v-if="!data.fromLocation && !data.toLocation" class="no-location">-</span>
          </div>
        </template>
      </Column>

      <Column field="notes" header="Note" style="min-width: 200px">
        <template #body="{ data }">
          <span class="notes-text" v-if="data.notes">{{ data.notes }}</span>
          <span class="notes-empty" v-else>-</span>
        </template>
      </Column>

      <Column field="reference" header="Riferimento" style="min-width: 120px">
        <template #body="{ data }">
          <span class="reference-text" v-if="data.reference">{{ data.reference }}</span>
          <span class="reference-empty" v-else>-</span>
        </template>
      </Column>
    </DataTable>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Chiudi"
          icon="pi pi-times"
          class="p-button-text"
          @click="close"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface InventoryItem {
  id: string;
  productId: string;
  location: string;
  quantity: number;
  reservedQuantity: number;
  product?: {
    id: string;
    sku: string;
    name: string;
  };
}

interface Movement {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference?: string;
  notes?: string;
  performedBy?: string;
  createdAt: string;
}

interface Props {
  modelValue: boolean;
  inventoryItem?: InventoryItem | null;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  inventoryItem: null,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const toast = useToast();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);
const movements = ref<Movement[]>([]);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTypeSeverity = (type: string) => {
  switch (type) {
    case 'IN': return 'success';
    case 'OUT': return 'warning';
    case 'TRANSFER': return 'info';
    case 'ADJUSTMENT': return 'secondary';
    case 'RETURN': return 'help';
    default: return 'secondary';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'IN': return 'pi pi-plus';
    case 'OUT': return 'pi pi-minus';
    case 'TRANSFER': return 'pi pi-arrows-h';
    case 'ADJUSTMENT': return 'pi pi-pencil';
    case 'RETURN': return 'pi pi-replay';
    default: return 'pi pi-circle';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'IN': return 'Carico';
    case 'OUT': return 'Scarico';
    case 'TRANSFER': return 'Trasf.';
    case 'ADJUSTMENT': return 'Rettifica';
    case 'RETURN': return 'Reso';
    default: return type;
  }
};

const getQuantityClass = (type: string) => {
  return type === 'IN' || type === 'RETURN' ? 'quantity-positive' : 'quantity-negative';
};

const loadMovements = async () => {
  if (!props.inventoryItem?.productId) return;

  try {
    loading.value = true;

    const params = new URLSearchParams({
      productId: props.inventoryItem.productId,
      limit: '100',
    });

    // Se abbiamo una location specifica, filtra anche per quella
    if (props.inventoryItem.location) {
      params.append('locationId', props.inventoryItem.location);
    }

    const response = await api.get(`/inventory/movements?${params.toString()}`);
    movements.value = response.data?.movements || [];
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento movimenti',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

const close = () => {
  visible.value = false;
};

// Watch for inventory item changes
watch(() => props.inventoryItem, () => {
  if (visible.value) {
    loadMovements();
  }
});
</script>

<style scoped>
.product-header {
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-color-light);
}

.product-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.sku-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.product-name {
  font-weight: 500;
  color: var(--color-gray-800);
}

.location-tag {
  font-size: var(--font-size-xs);
}

.movements-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-3) var(--space-4);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.movements-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
}

.date-text {
  color: var(--color-gray-600);
  font-size: var(--font-size-xs);
}

.type-tag {
  font-size: var(--font-size-xs);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.type-icon {
  font-size: 0.75rem;
}

.quantity-text {
  font-weight: 600;
}

.quantity-positive {
  color: var(--color-success);
}

.quantity-negative {
  color: var(--color-warning);
}

.location-flow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.from-location {
  color: var(--color-gray-600);
}

.arrow-icon {
  color: var(--color-gray-400);
  font-size: 0.75rem;
}

.to-location {
  color: var(--color-gray-800);
  font-weight: 500;
}

.no-location {
  color: var(--color-gray-400);
}

.notes-text {
  color: var(--color-gray-600);
  font-size: var(--font-size-sm);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-empty,
.reference-empty {
  color: var(--color-gray-400);
}

.reference-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-gray-600);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
