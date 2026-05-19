<template>
  <Dialog
    :visible="visible"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    header="Registra Entrata Merce"
    :style="{ width: '900px', maxWidth: '95vw' }"
    :modal="true"
    :appendTo="'body'"
    class="goods-receipt-dialog"
    @hide="onHide"
  >
    <div class="dialog-content">
      <!-- PO selector (solo se non pre-popolato da PurchaseOrders) -->
      <div v-if="!purchaseOrder" class="form-section">
        <h4 class="form-section__title">Ordine d'Acquisto *</h4>
        <Dropdown
          v-model="formData.purchaseOrderId"
          :options="availablePOs"
          optionLabel="orderNumber"
          optionValue="id"
          placeholder="Seleziona ordine d'acquisto"
          filter
          @change="onPOSelected"
          class="w-full"
          :appendTo="'body'"
        >
          <template #option="slotProps">
            <div class="po-option">
              <span class="po-number">{{ slotProps.option.orderNumber }}</span>
              <span class="po-supplier">{{ slotProps.option.supplier?.businessName }}</span>
            </div>
          </template>
        </Dropdown>
      </div>

      <!-- PO info -->
      <div v-if="loadedPO" class="po-info-card">
        <div class="po-info-row">
          <span class="po-info-label">Ordine:</span>
          <strong>{{ loadedPO.orderNumber }}</strong>
        </div>
        <div class="po-info-row">
          <span class="po-info-label">Fornitore:</span>
          <span>{{ loadedPO.supplier?.businessName || '-' }}</span>
        </div>
      </div>

      <!-- Header fields -->
      <div class="form-grid">
        <div class="form-field">
          <label for="warehouseId">Magazzino di Destinazione *</label>
          <Dropdown
            id="warehouseId"
            v-model="formData.warehouseId"
            :options="warehouses"
            optionLabel="name"
            optionValue="id"
            placeholder="Seleziona magazzino"
            class="w-full"
            :appendTo="'body'"
          />
        </div>

        <div class="form-field">
          <label for="supplierDocNumber">N. DDT Fornitore</label>
          <InputText
            id="supplierDocNumber"
            v-model="formData.supplierDocNumber"
            placeholder="Es. DDT/2026/1234"
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="carrier">Vettore</label>
          <InputText
            id="carrier"
            v-model="formData.carrier"
            placeholder="Es. SDA, BRT..."
            class="w-full"
          />
        </div>

        <div class="form-field">
          <label for="trackingNumber">Tracking</label>
          <InputText
            id="trackingNumber"
            v-model="formData.trackingNumber"
            placeholder="Numero tracking"
            class="w-full"
          />
        </div>

        <div class="form-field form-field--full">
          <label for="notes">Note</label>
          <Textarea
            id="notes"
            v-model="formData.notes"
            rows="2"
            class="w-full"
            placeholder="Note generali sulla ricezione..."
          />
        </div>
      </div>

      <Divider />

      <!-- Items table -->
      <div class="form-section">
        <h4 class="form-section__title">Righe da Ricevere</h4>
        <p v-if="formData.items.length === 0" class="empty-items">
          Seleziona un ordine d'acquisto per popolare le righe.
        </p>

        <DataTable
          v-else
          :value="formData.items"
          class="custom-table items-table"
          responsiveLayout="scroll"
        >
          <Column header="Articolo" style="min-width: 220px">
            <template #body="{ data }">
              <div class="item-cell">
                <Tag :severity="data._isProduct ? 'info' : 'warning'" class="item-type-tag">
                  {{ data._isProduct ? 'P' : 'M' }}
                </Tag>
                <span>{{ data._itemName }}</span>
              </div>
            </template>
          </Column>
          <Column header="Ordinato" style="min-width: 90px">
            <template #body="{ data }">
              <span class="quantity-badge">{{ data._orderedQuantity }}</span>
            </template>
          </Column>
          <Column header="Gia Ricevuto" style="min-width: 110px">
            <template #body="{ data }">
              <span class="quantity-badge quantity-badge--received">{{ data._alreadyReceived }}</span>
            </template>
          </Column>
          <Column header="Ricevuta *" style="min-width: 120px">
            <template #body="{ data, index }">
              <InputNumber
                v-model="data.receivedQuantity"
                :min="0"
                :max="data._orderedQuantity"
                @update:modelValue="onReceivedChange(index)"
                class="qty-input"
              />
            </template>
          </Column>
          <Column header="Accettata *" style="min-width: 120px">
            <template #body="{ data }">
              <InputNumber
                v-model="data.acceptedQuantity"
                :min="0"
                :max="data.receivedQuantity || 0"
                class="qty-input"
              />
            </template>
          </Column>
          <Column header="Rifiutata" style="min-width: 120px">
            <template #body="{ data }">
              <InputNumber
                v-model="data.rejectedQuantity"
                :min="0"
                :max="data.receivedQuantity || 0"
                class="qty-input"
              />
            </template>
          </Column>
          <Column header="Note" style="min-width: 200px">
            <template #body="{ data }">
              <InputText
                v-model="data.qualityNotes"
                placeholder="Note riga..."
                class="w-full"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <template #footer>
      <Button label="Annulla" icon="pi pi-times" @click="closeDialog" class="p-button-text" />
      <Button label="Registra Entrata" icon="pi pi-check" @click="handleSave" :loading="saving" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Props {
  visible: boolean;
  // PO pre-popolato (chiamata da PurchaseOrders.vue)
  purchaseOrder?: any | null;
  warehouses?: any[];
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'saved', receipt: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  purchaseOrder: null,
  warehouses: () => [],
});

const emit = defineEmits<Emits>();
const toast = useToast();

const saving = ref(false);
const availablePOs = ref<any[]>([]);
const loadedPO = ref<any>(null);

interface ReceiptItemForm {
  purchaseOrderItemId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  qualityNotes?: string;
  // Helpers UI (con underscore per non finire nel payload)
  _itemName: string;
  _isProduct: boolean;
  _orderedQuantity: number;
  _alreadyReceived: number;
}

const formData = ref({
  purchaseOrderId: '' as string,
  warehouseId: '' as string,
  supplierDocNumber: '',
  carrier: '',
  trackingNumber: '',
  notes: '',
  items: [] as ReceiptItemForm[],
});

const resetForm = () => {
  formData.value = {
    purchaseOrderId: '',
    warehouseId: props.warehouses[0]?.id || '',
    supplierDocNumber: '',
    carrier: '',
    trackingNumber: '',
    notes: '',
    items: [],
  };
  loadedPO.value = null;
};

const loadOpenPOs = async () => {
  try {
    // Ordini in stato CONFIRMED / SENT / PARTIALLY_RECEIVED sono ricevibili
    const response = await api.get('/purchase-orders?limit=100&sortBy=createdAt&sortOrder=desc');
    if (response.success) {
      const all = response.data?.items || [];
      availablePOs.value = all.filter((po: any) =>
        ['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status)
      );
    }
  } catch (error) {
    console.error('Error loading purchase orders:', error);
  }
};

const buildItemsFromPO = (po: any): ReceiptItemForm[] => {
  if (!po?.items) return [];
  return po.items.map((item: any) => {
    const ordered = Number(item.quantity) || 0;
    const already = Number(item.receivedQuantity) || 0;
    const remaining = Math.max(0, ordered - already);
    const itemName =
      item.product?.name ||
      item.material?.name ||
      'Articolo';
    return {
      purchaseOrderItemId: item.id,
      receivedQuantity: remaining,
      acceptedQuantity: remaining,
      rejectedQuantity: 0,
      qualityNotes: '',
      _itemName: itemName,
      _isProduct: !!item.productId,
      _orderedQuantity: ordered,
      _alreadyReceived: already,
    } as ReceiptItemForm;
  });
};

const onPOSelected = async () => {
  const id = formData.value.purchaseOrderId;
  if (!id) return;
  try {
    const response = await api.get(`/purchase-orders/${id}`);
    if (response.success) {
      loadedPO.value = response.data;
      formData.value.items = buildItemsFromPO(response.data);
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Impossibile caricare l\'ordine',
      life: 3000,
    });
  }
};

const onReceivedChange = (index: number) => {
  const item = formData.value.items[index];
  // Auto-allinea accettata se finora era uguale alla ricevuta
  if (item.rejectedQuantity === 0) {
    item.acceptedQuantity = item.receivedQuantity;
  }
};

const closeDialog = () => {
  emit('update:visible', false);
};

const onHide = () => {
  // Reset solo allo chiudo finale
  resetForm();
};

const handleSave = async () => {
  if (!formData.value.purchaseOrderId) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Seleziona un ordine d\'acquisto',
      life: 3000,
    });
    return;
  }
  if (!formData.value.warehouseId) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Seleziona un magazzino di destinazione',
      life: 3000,
    });
    return;
  }
  const itemsToSend = formData.value.items
    .filter((item) => (item.receivedQuantity || 0) > 0)
    .map((item) => ({
      purchaseOrderItemId: item.purchaseOrderItemId,
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity ?? item.receivedQuantity,
      rejectedQuantity: item.rejectedQuantity ?? 0,
      ...(item.qualityNotes ? { qualityNotes: item.qualityNotes } : {}),
    }));

  if (itemsToSend.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Inserisci almeno una quantita ricevuta',
      life: 3000,
    });
    return;
  }

  saving.value = true;
  try {
    const payload = {
      purchaseOrderId: formData.value.purchaseOrderId,
      warehouseId: formData.value.warehouseId,
      ...(formData.value.supplierDocNumber && { supplierDocNumber: formData.value.supplierDocNumber }),
      ...(formData.value.carrier && { carrier: formData.value.carrier }),
      ...(formData.value.trackingNumber && { trackingNumber: formData.value.trackingNumber }),
      ...(formData.value.notes && { notes: formData.value.notes }),
      items: itemsToSend,
    };

    const response = await api.post('/goods-receipts', payload);
    toast.add({
      severity: 'success',
      summary: 'Entrata registrata',
      detail: 'Entrata merce creata correttamente',
      life: 3000,
    });
    emit('saved', response.data);
    emit('update:visible', false);
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante la registrazione',
      life: 4000,
    });
  } finally {
    saving.value = false;
  }
};

// Quando il dialog si apre, se c'e' un PO pre-popolato lo carichiamo
watch(
  () => props.visible,
  (val) => {
    if (val) {
      resetForm();
      if (props.purchaseOrder) {
        formData.value.purchaseOrderId = props.purchaseOrder.id;
        loadedPO.value = props.purchaseOrder;
        formData.value.items = buildItemsFromPO(props.purchaseOrder);
      } else {
        loadOpenPOs();
      }
    }
  }
);

onMounted(() => {
  if (props.warehouses && props.warehouses.length > 0) {
    formData.value.warehouseId = props.warehouses[0].id;
  }
});
</script>

<style scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-height: 70vh;
  overflow-y: auto;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-section__title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-600);
}

.form-field--full {
  grid-column: span 2;
}

.po-info-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-primary-50, #eff6ff);
  border-left: 3px solid var(--color-primary-500, #3b82f6);
  border-radius: var(--border-radius-md);
}

.po-info-row {
  display: flex;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}

.po-info-label {
  color: var(--color-gray-500);
  font-weight: 600;
}

.po-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.po-number {
  font-weight: 600;
  font-family: monospace;
}

.po-supplier {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.empty-items {
  color: var(--color-gray-500);
  font-style: italic;
  padding: var(--space-4);
  text-align: center;
}

.items-table {
  border: 1px solid var(--border-color-light);
  border-radius: var(--border-radius-md);
}

.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-3);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-3);
  vertical-align: middle;
}

.item-cell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.item-type-tag {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  min-width: 24px;
  text-align: center;
}

.quantity-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  background: var(--color-info-light, #dbeafe);
  color: var(--color-info-dark, #1e40af);
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.quantity-badge--received {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.qty-input {
  width: 100%;
}

.qty-input :deep(.p-inputnumber-input) {
  width: 90px;
}

.w-full {
  width: 100%;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-field--full {
    grid-column: span 1;
  }
}
</style>
