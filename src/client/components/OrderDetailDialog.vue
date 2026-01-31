<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Checkbox from 'primevue/checkbox';
import ProgressSpinner from 'primevue/progressspinner';
import Timeline from 'primevue/timeline';
import Divider from 'primevue/divider';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import ShipmentDialog from './ShipmentDialog.vue';
import RecordPaymentDialog from './RecordPaymentDialog.vue';
import PaymentHistoryDialog from './PaymentHistoryDialog.vue';

interface Props {
  modelValue: boolean;
  orderId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'refresh'): void;
}>();

const toast = useToast();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const activeTab = ref(0);
const loading = ref(false);
const saving = ref(false);
const order = ref<any>(null);

// Note form
const newNote = ref({ type: 'INTERNAL', content: '', isVisibleToCustomer: false });
const noteTypes = [
  { label: 'Interna', value: 'INTERNAL' },
  { label: 'Cliente', value: 'CUSTOMER' },
];

// Refund form
const showRefundForm = ref(false);
const refundData = ref<any>({ reason: '', restockItems: true, items: [] });
const processingRefund = ref(false);

// Payment dues
const generatingDues = ref(false);
const showRecordPaymentDialog = ref(false);
const showPaymentHistoryDialog = ref(false);
const selectedPaymentDue = ref<any>(null);

// Open record payment dialog
const openRecordPaymentDialog = (paymentDue: any) => {
  selectedPaymentDue.value = paymentDue;
  showRecordPaymentDialog.value = true;
};

// Open payment history dialog
const openPaymentHistoryDialog = (paymentDue: any) => {
  selectedPaymentDue.value = paymentDue;
  showPaymentHistoryDialog.value = true;
};

// Handle payment recorded
const onPaymentRecorded = () => {
  loadOrder();
  emit('refresh');
};

// Attachments
const addingAttachment = ref(false);
const newAttachment = ref({ name: '', url: '', type: 'PDF' });
const attachmentTypes = ['PDF', 'WORD', 'EXCEL', 'IMAGE', 'OTHER'];

// Status workflow
const changingStatus = ref(false);
const showShipmentDialog = ref(false);
const showCancelConfirm = ref(false);

// Status flow definition
const statusFlow = [
  { value: 'PENDING', label: 'In Attesa', icon: 'pi pi-clock' },
  { value: 'CONFIRMED', label: 'Confermato', icon: 'pi pi-check' },
  { value: 'PROCESSING', label: 'In Lavorazione', icon: 'pi pi-cog' },
  { value: 'READY', label: 'Pronto', icon: 'pi pi-box' },
  { value: 'SHIPPED', label: 'Spedito', icon: 'pi pi-truck' },
  { value: 'DELIVERED', label: 'Consegnato', icon: 'pi pi-check-circle' },
];

// Valid status transitions
const statusTransitions: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Get current status index in flow
const getCurrentStatusIndex = () => {
  if (!order.value) return -1;
  return statusFlow.findIndex(s => s.value === order.value.status);
};

// Check if can transition to target status
const canTransitionTo = (targetStatus: string) => {
  if (!order.value) return false;
  const currentStatus = order.value.status;
  return statusTransitions[currentStatus]?.includes(targetStatus) || false;
};

// Check if order can be confirmed
const canConfirm = computed(() => {
  return order.value?.status === 'PENDING';
});

// Check if order can be processed
const canProcess = computed(() => {
  return order.value?.status === 'CONFIRMED';
});

// Check if order is ready for shipping
const canShip = computed(() => {
  return order.value?.status === 'READY';
});

// Check if order can be marked as delivered
const canDeliver = computed(() => {
  return order.value?.status === 'SHIPPED';
});

// Check if order can be cancelled
const canCancel = computed(() => {
  return ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY'].includes(order.value?.status);
});

// Change order status
const changeStatus = async (newStatus: string, additionalData?: any) => {
  if (!order.value || !canTransitionTo(newStatus)) return;

  changingStatus.value = true;
  try {
    await api.patch(`/orders/${order.value.id}/status`, {
      status: newStatus,
      ...additionalData,
    });
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: `Stato aggiornato a ${getStatusLabel(newStatus)}`,
      life: 3000,
    });
    await loadOrder();
    emit('refresh');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel cambio stato',
      life: 5000,
    });
  } finally {
    changingStatus.value = false;
  }
};

// Quick actions
const confirmOrder = async () => {
  await changeStatus('CONFIRMED');
};

const startProcessing = async () => {
  await changeStatus('PROCESSING');
};

const markReady = async () => {
  await changeStatus('READY');
};

const markDelivered = async () => {
  await changeStatus('DELIVERED');
};

const cancelOrder = async () => {
  await changeStatus('CANCELLED');
  showCancelConfirm.value = false;
};

// Get status label
const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'In Attesa',
    CONFIRMED: 'Confermato',
    PROCESSING: 'In Lavorazione',
    READY: 'Pronto',
    SHIPPED: 'Spedito',
    DELIVERED: 'Consegnato',
    CANCELLED: 'Annullato',
  };
  return labels[status] || status;
};

// Load order data
const loadOrder = async () => {
  if (!props.orderId) return;

  loading.value = true;
  try {
    const response = await api.get(`/orders/${props.orderId}/full`);
    console.log('[OrderDetailDialog] Full API response:', response);
    console.log('[OrderDetailDialog] order.attachments:', response.data?.attachments);
    // Ensure attachments is always an array
    if (response.data) {
      response.data.attachments = response.data.attachments || [];
    }
    order.value = response.data;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore caricamento ordine',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

// Watch for dialog open
watch(() => props.modelValue, (val) => {
  if (val && props.orderId) {
    loadOrder();
  }
});

// Status badge severity
const getStatusSeverity = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    PENDING: 'warning',
    CONFIRMED: 'info',
    PROCESSING: 'info',
    READY: 'success',
    SHIPPED: 'success',
    DELIVERED: 'success',
    CANCELLED: 'danger',
  };
  return map[status] || 'info';
};

const getPaymentStatusSeverity = (status: string) => {
  return status === 'paid' ? 'success' : 'warning';
};

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
};

// Format date
const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Add note
const addNote = async () => {
  if (!newNote.value.content.trim()) return;

  saving.value = true;
  try {
    await api.post(`/orders/${props.orderId}/notes`, newNote.value);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Nota aggiunta',
      life: 3000,
    });
    newNote.value = { type: 'INTERNAL', content: '', isVisibleToCustomer: false };
    await loadOrder();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore aggiunta nota',
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
};

// Sync status to WooCommerce
const syncToWooCommerce = async () => {
  if (!order.value?.wordpressId) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Ordine non sincronizzato con WooCommerce',
      life: 3000,
    });
    return;
  }

  saving.value = true;
  try {
    await api.post(`/orders/${props.orderId}/sync-status`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Stato sincronizzato con WooCommerce',
      life: 3000,
    });
    await loadOrder();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore sincronizzazione',
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
};

// Initialize refund form
const initRefundForm = async () => {
  try {
    const response = await api.get(`/orders/${props.orderId}/refundable`);
    const refundable = response.data;

    refundData.value = {
      reason: '',
      restockItems: true,
      items: refundable.items.map((item: any) => ({
        orderItemId: item.orderItemId,
        productName: item.productName,
        sku: item.sku,
        refundableQuantity: item.refundableQuantity,
        unitPrice: item.unitPrice,
        unitPriceWithTax: item.maxRefundableAmount / item.refundableQuantity || item.unitPrice,
        maxRefundableAmount: item.maxRefundableAmount,
        taxRate: item.taxRate || 22,
        quantity: 0,
        amount: 0,
        selected: false,
      })),
    };
    showRefundForm.value = true;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore caricamento dati rimborso',
      life: 5000,
    });
  }
};

// Calculate refund amount (uses price with IVA)
const calculateItemAmount = (item: any) => {
  // Calculate amount with IVA
  item.amount = item.quantity * item.unitPriceWithTax;
};

// Get max refundable for an item based on quantity
const getMaxRefundableForItem = (item: any) => {
  return item.quantity * item.unitPriceWithTax;
};

const totalRefundAmount = computed(() => {
  return refundData.value.items
    .filter((i: any) => i.selected && i.quantity > 0)
    .reduce((sum: number, i: any) => sum + i.amount, 0);
});

// Create refund
const createRefund = async () => {
  const selectedItems = refundData.value.items
    .filter((i: any) => i.selected && i.quantity > 0)
    .map((i: any) => ({
      orderItemId: i.orderItemId,
      quantity: i.quantity,
      amount: i.amount,
    }));

  if (selectedItems.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Seleziona almeno un articolo da rimborsare',
      life: 3000,
    });
    return;
  }

  processingRefund.value = true;
  try {
    await api.post(`/orders/${props.orderId}/refunds`, {
      reason: refundData.value.reason,
      restockItems: refundData.value.restockItems,
      items: selectedItems,
    });
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Rimborso creato',
      life: 3000,
    });
    showRefundForm.value = false;
    await loadOrder();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore creazione rimborso',
      life: 5000,
    });
  } finally {
    processingRefund.value = false;
  }
};

// Process refund
const processRefund = async (refundId: string) => {
  processingRefund.value = true;
  try {
    await api.post(`/orders/${props.orderId}/refunds/${refundId}/process`, {
      syncToWooCommerce: !!order.value?.wordpressId,
    });
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Rimborso processato',
      life: 3000,
    });
    await loadOrder();
    emit('refresh');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore processamento rimborso',
      life: 5000,
    });
  } finally {
    processingRefund.value = false;
  }
};

// Get note type icon
const getNoteTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    INTERNAL: 'pi-lock',
    CUSTOMER: 'pi-user',
    STATUS_CHANGE: 'pi-refresh',
    SYSTEM: 'pi-cog',
  };
  return icons[type] || 'pi-comment';
};

// ==========================================
// PAYMENT DUES (Scadenzario)
// ==========================================

const generatePaymentDues = async () => {
  generatingDues.value = true;
  try {
    await api.post(`/orders/${props.orderId}/generate-dues`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Scadenze generate',
      life: 3000,
    });
    await loadOrder();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore generazione scadenze',
      life: 5000,
    });
  } finally {
    generatingDues.value = false;
  }
};

const markPaymentDueAsPaid = async (paymentDueId: string) => {
  try {
    // Per ora segniamo come pagato tramite l'API accounting
    await api.patch(`/accounting/payment-dues/${paymentDueId}`, {
      status: 'PAID',
      paidDate: new Date().toISOString(),
    });
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Pagamento registrato',
      life: 3000,
    });
    await loadOrder();
    emit('refresh');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore registrazione pagamento',
      life: 5000,
    });
  }
};

const isOverdue = (dueDate: string) => {
  return new Date(dueDate) < new Date();
};

const formatShortDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getPaymentDueStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: 'In attesa',
    PARTIAL: 'Parziale',
    PAID: 'Pagato',
    OVERDUE: 'Scaduto',
  };
  return labels[status] || status;
};

const getPaymentDueStatusSeverity = (status: string) => {
  const severities: Record<string, string> = {
    PENDING: 'warning',
    PARTIAL: 'info',
    PAID: 'success',
    OVERDUE: 'danger',
  };
  return severities[status] || 'info';
};

// ==========================================
// ATTACHMENTS (Allegati)
// ==========================================

const addAttachment = async () => {
  if (!newAttachment.value.name || !newAttachment.value.url) return;

  addingAttachment.value = true;
  try {
    await api.post(`/orders/${props.orderId}/attachments`, {
      name: newAttachment.value.name,
      url: newAttachment.value.url,
      type: newAttachment.value.type,
    });
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Allegato aggiunto',
      life: 3000,
    });
    newAttachment.value = { name: '', url: '', type: 'PDF' };
    await loadOrder();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore aggiunta allegato',
      life: 5000,
    });
  } finally {
    addingAttachment.value = false;
  }
};

const removeAttachment = async (attachmentId: string) => {
  try {
    await api.delete(`/orders/${props.orderId}/attachments/${attachmentId}`);
    toast.add({
      severity: 'success',
      summary: 'Successo',
      detail: 'Allegato rimosso',
      life: 3000,
    });
    await loadOrder();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore rimozione allegato',
      life: 5000,
    });
  }
};

const downloadAttachment = (attachment: any) => {
  window.open(attachment.url, '_blank');
};

const getAttachmentIcon = (type: string) => {
  const icons: Record<string, string> = {
    PDF: 'pi pi-file-pdf',
    WORD: 'pi pi-file-word',
    EXCEL: 'pi pi-file-excel',
    IMAGE: 'pi pi-image',
    OTHER: 'pi pi-file',
  };
  return icons[type] || 'pi pi-file';
};
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="`Ordine ${order?.orderNumber || ''}`"
    :modal="true"
    :closable="true"
    :style="{ width: '1100px', maxWidth: '95vw' }"
    :contentStyle="{ maxHeight: '80vh', overflow: 'auto' }"
    class="order-detail-dialog"
  >
    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner />
      <p>Caricamento ordine...</p>
    </div>

    <!-- Order content -->
    <div v-else-if="order" class="order-content">
      <TabView v-model:activeIndex="activeTab">
        <!-- RIEPILOGO -->
        <TabPanel header="Riepilogo">
          <!-- Status Workflow Section -->
          <div v-if="order.status !== 'CANCELLED'" class="status-workflow-section">
            <h4>Stato Ordine</h4>
            <div class="status-flow">
              <div
                v-for="(status, index) in statusFlow"
                :key="status.value"
                class="status-step"
                :class="{
                  'active': status.value === order.status,
                  'completed': index < getCurrentStatusIndex(),
                  'upcoming': index > getCurrentStatusIndex(),
                }"
              >
                <div class="status-icon">
                  <i :class="status.icon"></i>
                </div>
                <span class="status-label">{{ status.label }}</span>
                <div v-if="index < statusFlow.length - 1" class="status-connector"></div>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="workflow-actions">
              <Button
                v-if="canConfirm"
                label="Conferma Ordine"
                icon="pi pi-check"
                @click="confirmOrder"
                :loading="changingStatus"
              />
              <Button
                v-if="canProcess"
                label="Avvia Lavorazione"
                icon="pi pi-cog"
                @click="startProcessing"
                :loading="changingStatus"
              />
              <Button
                v-if="order.status === 'PROCESSING'"
                label="Segna Pronto"
                icon="pi pi-box"
                @click="markReady"
                :loading="changingStatus"
              />
              <Button
                v-if="canShip"
                label="Crea Spedizione"
                icon="pi pi-truck"
                severity="success"
                @click="showShipmentDialog = true"
              />
              <Button
                v-if="canDeliver"
                label="Segna Consegnato"
                icon="pi pi-check-circle"
                severity="success"
                @click="markDelivered"
                :loading="changingStatus"
              />
              <Button
                v-if="canCancel"
                label="Annulla Ordine"
                icon="pi pi-times"
                severity="danger"
                text
                @click="showCancelConfirm = true"
              />
            </div>
          </div>

          <!-- Cancelled Order Banner -->
          <div v-else class="cancelled-banner">
            <i class="pi pi-times-circle"></i>
            <div>
              <h4>Ordine Annullato</h4>
              <p>Questo ordine è stato annullato e non può essere modificato.</p>
            </div>
          </div>

          <Divider />

          <div class="overview-grid">
            <!-- Info principali -->
            <div class="overview-section">
              <h4>Informazioni Ordine</h4>
              <div class="info-row">
                <span class="label">Numero:</span>
                <span class="value">{{ order.orderNumber }}</span>
              </div>
              <div class="info-row">
                <span class="label">Stato:</span>
                <Tag :value="order.status" :severity="getStatusSeverity(order.status)" />
              </div>
              <div class="info-row">
                <span class="label">Fonte:</span>
                <span class="value">{{ order.source }}</span>
              </div>
              <div class="info-row">
                <span class="label">Data ordine:</span>
                <span class="value">{{ formatDate(order.orderDate) }}</span>
              </div>
              <div class="info-row" v-if="order.shippedDate">
                <span class="label">Data spedizione:</span>
                <span class="value">{{ formatDate(order.shippedDate) }}</span>
              </div>
              <div class="info-row" v-if="order.deliveredDate">
                <span class="label">Data consegna:</span>
                <span class="value">{{ formatDate(order.deliveredDate) }}</span>
              </div>
            </div>

            <!-- Cliente -->
            <div class="overview-section">
              <h4>Cliente</h4>
              <div class="info-row">
                <span class="label">Nome:</span>
                <span class="value">
                  {{ order.customer?.businessName || `${order.customer?.firstName} ${order.customer?.lastName}` }}
                </span>
              </div>
              <div class="info-row" v-if="order.customer?.code">
                <span class="label">Codice:</span>
                <span class="value">{{ order.customer.code }}</span>
              </div>
              <div class="info-row" v-if="order.customer?.email">
                <span class="label">Email:</span>
                <span class="value">{{ order.customer.email }}</span>
              </div>
              <div class="info-row" v-if="order.customer?.phone">
                <span class="label">Telefono:</span>
                <span class="value">{{ order.customer.phone }}</span>
              </div>
            </div>

            <!-- Totali -->
            <div class="overview-section totals-section">
              <h4>Totali</h4>
              <div class="info-row">
                <span class="label">Subtotale:</span>
                <span class="value">{{ formatCurrency(order.subtotal) }}</span>
              </div>
              <div class="info-row" v-if="order.discount > 0">
                <span class="label">Sconto:</span>
                <span class="value discount">-{{ formatCurrency(order.discount) }}</span>
              </div>
              <div class="info-row">
                <span class="label">IVA:</span>
                <span class="value">{{ formatCurrency(order.tax) }}</span>
              </div>
              <div class="info-row" v-if="order.shipping > 0">
                <span class="label">Spedizione:</span>
                <span class="value">{{ formatCurrency(order.shipping) }}</span>
              </div>
              <Divider />
              <div class="info-row total-row">
                <span class="label">Totale:</span>
                <span class="value">{{ formatCurrency(order.total) }}</span>
              </div>
              <div class="info-row" v-if="order.calculations?.totalRefunded > 0">
                <span class="label">Rimborsato:</span>
                <span class="value refunded">-{{ formatCurrency(order.calculations.totalRefunded) }}</span>
              </div>
            </div>

            <!-- Pagamento -->
            <div class="overview-section">
              <h4>Pagamento</h4>
              <div class="info-row">
                <span class="label">Stato:</span>
                <Tag :value="order.paymentStatus" :severity="getPaymentStatusSeverity(order.paymentStatus)" />
              </div>
              <div class="info-row" v-if="order.paymentMethod">
                <span class="label">Metodo:</span>
                <span class="value">{{ order.paymentMethodTitle || order.paymentMethod }}</span>
              </div>
              <div class="info-row" v-if="order.b2bPaymentMethod">
                <span class="label">Metodo B2B:</span>
                <span class="value">{{ order.b2bPaymentMethod }}</span>
              </div>
              <div class="info-row" v-if="order.b2bPaymentDueDate">
                <span class="label">Scadenza:</span>
                <span class="value">{{ formatDate(order.b2bPaymentDueDate) }}</span>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- ARTICOLI -->
        <TabPanel>
          <template #header>
            <div class="tab-header-with-badge">
              <span>Articoli</span>
              <Badge :value="order.items?.length || 0" severity="info" />
            </div>
          </template>

          <DataTable :value="order.items" responsiveLayout="scroll" class="items-table">
            <Column header="Prodotto" style="min-width: 250px">
              <template #body="{ data }">
                <div class="product-cell">
                  <img
                    v-if="data.product?.images?.[0]?.url"
                    :src="data.product.images[0].url"
                    :alt="data.productName"
                    class="product-thumbnail"
                  />
                  <div class="product-info">
                    <span class="product-name">{{ data.productName }}</span>
                    <span class="product-sku">{{ data.sku }}</span>
                    <span v-if="data.wcParentName" class="product-parent">{{ data.wcParentName }}</span>
                  </div>
                </div>
              </template>
            </Column>
            <Column field="quantity" header="Qtà" style="width: 80px" />
            <Column header="Prezzo" style="width: 100px">
              <template #body="{ data }">
                {{ formatCurrency(data.unitPrice) }}
              </template>
            </Column>
            <Column header="IVA" style="width: 100px">
              <template #body="{ data }">
                {{ formatCurrency(data.tax) }}
              </template>
            </Column>
            <Column header="Totale" style="width: 120px">
              <template #body="{ data }">
                <strong>{{ formatCurrency(data.total) }}</strong>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- INDIRIZZI -->
        <TabPanel header="Indirizzi">
          <div class="addresses-grid">
            <div class="address-card">
              <h4><i class="pi pi-truck"></i> Indirizzo di Spedizione</h4>
              <div v-if="order.shippingAddress" class="address-content">
                <p>{{ order.shippingAddress.firstName }} {{ order.shippingAddress.lastName }}</p>
                <p v-if="order.shippingAddress.company">{{ order.shippingAddress.company }}</p>
                <p>{{ order.shippingAddress.address1 }}</p>
                <p v-if="order.shippingAddress.address2">{{ order.shippingAddress.address2 }}</p>
                <p>{{ order.shippingAddress.postcode }} {{ order.shippingAddress.city }} ({{ order.shippingAddress.state }})</p>
                <p>{{ order.shippingAddress.country }}</p>
                <p v-if="order.shippingAddress.phone" class="phone">
                  <i class="pi pi-phone"></i> {{ order.shippingAddress.phone }}
                </p>
              </div>
              <p v-else class="no-data">Nessun indirizzo</p>
            </div>

            <div class="address-card">
              <h4><i class="pi pi-file"></i> Indirizzo di Fatturazione</h4>
              <div v-if="order.billingAddress" class="address-content">
                <p>{{ order.billingAddress.firstName }} {{ order.billingAddress.lastName }}</p>
                <p v-if="order.billingAddress.company">{{ order.billingAddress.company }}</p>
                <p>{{ order.billingAddress.address1 }}</p>
                <p v-if="order.billingAddress.address2">{{ order.billingAddress.address2 }}</p>
                <p>{{ order.billingAddress.postcode }} {{ order.billingAddress.city }} ({{ order.billingAddress.state }})</p>
                <p>{{ order.billingAddress.country }}</p>
                <p v-if="order.billingAddress.email" class="email">
                  <i class="pi pi-envelope"></i> {{ order.billingAddress.email }}
                </p>
                <p v-if="order.billingAddress.phone" class="phone">
                  <i class="pi pi-phone"></i> {{ order.billingAddress.phone }}
                </p>
              </div>
              <p v-else class="no-data">Nessun indirizzo</p>
            </div>
          </div>
        </TabPanel>

        <!-- WOOCOMMERCE -->
        <TabPanel header="WooCommerce">
          <div v-if="order.wordpressId" class="wc-data">
            <div class="wc-grid">
              <div class="wc-section">
                <h4>Identificatori</h4>
                <div class="info-row">
                  <span class="label">WC Order ID:</span>
                  <span class="value">{{ order.wordpressId }}</span>
                </div>
                <div class="info-row">
                  <span class="label">Numero WC:</span>
                  <span class="value">{{ order.wcNumber }}</span>
                </div>
                <div class="info-row" v-if="order.wcOrderKey">
                  <span class="label">Order Key:</span>
                  <span class="value code">{{ order.wcOrderKey }}</span>
                </div>
                <div class="info-row">
                  <span class="label">Creato via:</span>
                  <span class="value">{{ order.wcCreatedVia || 'checkout' }}</span>
                </div>
              </div>

              <div class="wc-section">
                <h4>Stato</h4>
                <div class="info-row">
                  <span class="label">Stato WC:</span>
                  <Tag :value="order.wcStatus" />
                </div>
                <div class="info-row">
                  <span class="label">Sync:</span>
                  <Tag :value="order.syncStatus" :severity="order.syncStatus === 'SYNCED' ? 'success' : 'warning'" />
                </div>
                <div class="info-row" v-if="order.lastSyncAt">
                  <span class="label">Ultimo sync:</span>
                  <span class="value">{{ formatDate(order.lastSyncAt) }}</span>
                </div>
              </div>

              <div class="wc-section">
                <h4>Date</h4>
                <div class="info-row">
                  <span class="label">Data creazione:</span>
                  <span class="value">{{ formatDate(order.wcDateCreated) }}</span>
                </div>
                <div class="info-row">
                  <span class="label">Data modifica:</span>
                  <span class="value">{{ formatDate(order.wcDateModified) }}</span>
                </div>
                <div class="info-row" v-if="order.wcDatePaid">
                  <span class="label">Data pagamento:</span>
                  <span class="value">{{ formatDate(order.wcDatePaid) }}</span>
                </div>
                <div class="info-row" v-if="order.wcDateCompleted">
                  <span class="label">Data completamento:</span>
                  <span class="value">{{ formatDate(order.wcDateCompleted) }}</span>
                </div>
              </div>

              <div class="wc-section">
                <h4>Valuta</h4>
                <div class="info-row">
                  <span class="label">Valuta:</span>
                  <span class="value">{{ order.wcCurrency }} ({{ order.wcCurrencySymbol }})</span>
                </div>
                <div class="info-row">
                  <span class="label">Prezzi IVA inclusa:</span>
                  <span class="value">{{ order.wcPricesIncludeTax ? 'Sì' : 'No' }}</span>
                </div>
              </div>
            </div>

            <!-- Coupon Lines -->
            <div v-if="order.wcCouponLines?.length" class="wc-extra-section">
              <h4>Coupon Applicati</h4>
              <DataTable :value="order.wcCouponLines" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="code" header="Codice" />
                <Column header="Sconto">
                  <template #body="{ data }">
                    {{ formatCurrency(parseFloat(data.discount)) }}
                  </template>
                </Column>
              </DataTable>
            </div>

            <!-- Fee Lines -->
            <div v-if="order.wcFeeLines?.length" class="wc-extra-section">
              <h4>Commissioni/Fee</h4>
              <DataTable :value="order.wcFeeLines" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="name" header="Nome" />
                <Column header="Importo">
                  <template #body="{ data }">
                    {{ formatCurrency(parseFloat(data.total)) }}
                  </template>
                </Column>
              </DataTable>
            </div>

            <!-- Shipping Lines -->
            <div v-if="order.wcShippingLines?.length" class="wc-extra-section">
              <h4>Metodi Spedizione</h4>
              <DataTable :value="order.wcShippingLines" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="method_title" header="Metodo" />
                <Column header="Costo">
                  <template #body="{ data }">
                    {{ formatCurrency(parseFloat(data.total)) }}
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
          <div v-else class="no-wc-data">
            <i class="pi pi-info-circle"></i>
            <p>Questo ordine non è collegato a WooCommerce</p>
          </div>
        </TabPanel>

        <!-- NOTE -->
        <TabPanel>
          <template #header>
            <div class="tab-header-with-badge">
              <span>Note</span>
              <Badge v-if="order.orderNotes?.length" :value="order.orderNotes.length" />
            </div>
          </template>

          <!-- Add note form -->
          <div class="add-note-form">
            <div class="note-form-row">
              <Dropdown
                v-model="newNote.type"
                :options="noteTypes"
                optionLabel="label"
                optionValue="value"
                class="note-type-dropdown"
              />
              <Textarea
                v-model="newNote.content"
                rows="2"
                placeholder="Scrivi una nota..."
                class="note-textarea"
              />
              <Button
                label="Aggiungi"
                icon="pi pi-plus"
                :loading="saving"
                :disabled="!newNote.content.trim()"
                @click="addNote"
              />
            </div>
            <div class="note-form-checkbox">
              <Checkbox v-model="newNote.isVisibleToCustomer" :binary="true" inputId="visibleToCustomer" />
              <label for="visibleToCustomer">Visibile al cliente</label>
            </div>
          </div>

          <Divider />

          <!-- Notes list -->
          <Timeline v-if="order.orderNotes?.length" :value="order.orderNotes" class="notes-timeline">
            <template #opposite="{ item }">
              <small>{{ formatDate(item.createdAt) }}</small>
            </template>
            <template #marker="{ item }">
              <span class="note-marker" :class="item.type.toLowerCase()">
                <i :class="`pi ${getNoteTypeIcon(item.type)}`"></i>
              </span>
            </template>
            <template #content="{ item }">
              <div class="note-content">
                <div class="note-header">
                  <Tag :value="item.type" size="small" />
                  <span v-if="item.createdBy" class="note-author">{{ item.createdBy }}</span>
                  <i v-if="item.isVisibleToCustomer" class="pi pi-eye" title="Visibile al cliente"></i>
                </div>
                <p>{{ item.content }}</p>
              </div>
            </template>
          </Timeline>
          <p v-else class="no-data">Nessuna nota</p>
        </TabPanel>

        <!-- RIMBORSI -->
        <TabPanel>
          <template #header>
            <div class="tab-header-with-badge">
              <span>Rimborsi</span>
              <Badge v-if="order.refunds?.length" :value="order.refunds.length" severity="warning" />
            </div>
          </template>

          <!-- Refund form -->
          <div v-if="showRefundForm" class="refund-form">
            <h4>Nuovo Rimborso</h4>

            <div class="field">
              <label>Motivo</label>
              <InputText v-model="refundData.reason" placeholder="Motivo del rimborso" class="w-full" />
            </div>

            <div class="field-checkbox">
              <Checkbox v-model="refundData.restockItems" :binary="true" inputId="restockItems" />
              <label for="restockItems">Ripristina articoli a magazzino</label>
            </div>

            <DataTable :value="refundData.items" responsiveLayout="scroll" class="refund-items-table">
              <Column header="" style="width: 50px">
                <template #body="{ data }">
                  <Checkbox v-model="data.selected" :binary="true" :disabled="data.refundableQuantity === 0" />
                </template>
              </Column>
              <Column field="productName" header="Prodotto" />
              <Column field="sku" header="SKU" style="width: 100px" />
              <Column header="IVA" style="width: 60px">
                <template #body="{ data }">
                  <span class="tax-rate-badge">{{ data.taxRate }}%</span>
                </template>
              </Column>
              <Column header="Rimborsabile" style="width: 120px">
                <template #body="{ data }">
                  <div class="refundable-info">
                    <span>{{ data.refundableQuantity }} pz</span>
                    <small class="max-amount">max {{ formatCurrency(data.maxRefundableAmount) }}</small>
                  </div>
                </template>
              </Column>
              <Column header="Qtà" style="width: 100px">
                <template #body="{ data }">
                  <InputNumber
                    v-model="data.quantity"
                    :min="0"
                    :max="data.refundableQuantity"
                    :disabled="!data.selected"
                    @input="calculateItemAmount(data)"
                    class="w-full"
                  />
                </template>
              </Column>
              <Column header="Importo (IVA incl.)" style="width: 140px">
                <template #body="{ data }">
                  <div class="amount-input-container">
                    <InputNumber
                      v-model="data.amount"
                      :min="0"
                      :max="data.quantity * data.unitPriceWithTax"
                      :disabled="!data.selected"
                      mode="currency"
                      currency="EUR"
                      class="w-full"
                    />
                    <small v-if="data.selected && data.quantity > 0" class="amount-hint">
                      ({{ formatCurrency(data.unitPriceWithTax) }}/pz)
                    </small>
                  </div>
                </template>
              </Column>
            </DataTable>

            <div class="refund-summary">
              <div class="refund-breakdown">
                <div class="breakdown-row">
                  <span>Imponibile:</span>
                  <span>{{ formatCurrency(totalRefundAmount / 1.22) }}</span>
                </div>
                <div class="breakdown-row">
                  <span>IVA:</span>
                  <span>{{ formatCurrency(totalRefundAmount - (totalRefundAmount / 1.22)) }}</span>
                </div>
                <div class="breakdown-row total">
                  <strong>Totale rimborso:</strong>
                  <strong>{{ formatCurrency(totalRefundAmount) }}</strong>
                </div>
              </div>
            </div>

            <div class="refund-actions">
              <Button label="Annulla" severity="secondary" @click="showRefundForm = false" />
              <Button
                label="Crea Rimborso"
                icon="pi pi-check"
                :loading="processingRefund"
                @click="createRefund"
              />
            </div>
          </div>

          <!-- Refunds list -->
          <div v-else>
            <div class="refunds-header">
              <Button
                label="Nuovo Rimborso"
                icon="pi pi-plus"
                @click="initRefundForm"
                :disabled="order.status === 'DRAFT' || order.status === 'CANCELLED'"
              />
            </div>

            <DataTable v-if="order.refunds?.length" :value="order.refunds" responsiveLayout="scroll" class="refunds-table">
              <Column header="Data" style="width: 150px">
                <template #body="{ data }">
                  {{ formatDate(data.createdAt) }}
                </template>
              </Column>
              <Column header="Importo" style="width: 120px">
                <template #body="{ data }">
                  <strong>{{ formatCurrency(data.amount) }}</strong>
                </template>
              </Column>
              <Column field="reason" header="Motivo" />
              <Column header="Stato" style="width: 120px">
                <template #body="{ data }">
                  <Tag
                    :value="data.status"
                    :severity="data.status === 'COMPLETED' ? 'success' : data.status === 'PENDING' ? 'warning' : 'danger'"
                  />
                </template>
              </Column>
              <Column header="WC" style="width: 80px">
                <template #body="{ data }">
                  <i v-if="data.wcRefundId" class="pi pi-check-circle" style="color: var(--green-500)"></i>
                  <i v-else class="pi pi-times-circle" style="color: var(--gray-400)"></i>
                </template>
              </Column>
              <Column header="" style="width: 100px">
                <template #body="{ data }">
                  <Button
                    v-if="data.status === 'PENDING'"
                    label="Processa"
                    size="small"
                    :loading="processingRefund"
                    @click="processRefund(data.id)"
                  />
                </template>
              </Column>
            </DataTable>
            <p v-else class="no-data">Nessun rimborso</p>
          </div>
        </TabPanel>

        <!-- SPEDIZIONE -->
        <TabPanel header="Spedizione">
          <div class="shipping-info">
            <div class="shipping-section">
              <h4>Informazioni Spedizione</h4>
              <div class="info-row">
                <span class="label">Corriere:</span>
                <span class="value">{{ order.carrier || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Tracking Number:</span>
                <span class="value">
                  <a v-if="order.trackingUrl" :href="order.trackingUrl" target="_blank">
                    {{ order.trackingNumber }}
                    <i class="pi pi-external-link"></i>
                  </a>
                  <span v-else>{{ order.trackingNumber || '-' }}</span>
                </span>
              </div>
              <div class="info-row">
                <span class="label">Consegna stimata:</span>
                <span class="value">{{ order.estimatedDelivery ? formatDate(order.estimatedDelivery) : '-' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Data spedizione:</span>
                <span class="value">{{ order.shippedDate ? formatDate(order.shippedDate) : '-' }}</span>
              </div>
              <div class="info-row">
                <span class="label">Data consegna:</span>
                <span class="value">{{ order.deliveredDate ? formatDate(order.deliveredDate) : '-' }}</span>
              </div>
            </div>

            <!-- Nota cliente -->
            <div v-if="order.customerNote" class="shipping-section">
              <h4>Nota Cliente</h4>
              <p class="customer-note">{{ order.customerNote }}</p>
            </div>

            <!-- Ordini produzione collegati -->
            <div v-if="order.productionOrders?.length" class="shipping-section">
              <h4>Ordini di Produzione</h4>
              <DataTable :value="order.productionOrders" responsiveLayout="scroll" class="p-datatable-sm">
                <Column field="orderNumber" header="Numero" />
                <Column header="Stato">
                  <template #body="{ data }">
                    <Tag :value="data.status" />
                  </template>
                </Column>
                <Column header="Inizio">
                  <template #body="{ data }">
                    {{ data.startDate ? formatDate(data.startDate) : '-' }}
                  </template>
                </Column>
                <Column header="Completamento">
                  <template #body="{ data }">
                    {{ data.completionDate ? formatDate(data.completionDate) : '-' }}
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <!-- SCADENZARIO -->
        <TabPanel>
          <template #header>
            <div class="tab-header-with-badge">
              <span>Scadenzario</span>
              <Badge v-if="order.paymentDues?.length" :value="order.paymentDues.length" severity="info" />
            </div>
          </template>

          <div class="payment-dues-section">
            <!-- Payment Summary Cards -->
            <div class="payment-summary">
              <div class="summary-cards">
                <div class="summary-card">
                  <i class="pi pi-shopping-cart"></i>
                  <div class="card-content">
                    <span class="card-label">Totale Ordine</span>
                    <span class="card-value">{{ formatCurrency(order.total) }}</span>
                  </div>
                </div>
                <div class="summary-card success">
                  <i class="pi pi-check-circle"></i>
                  <div class="card-content">
                    <span class="card-label">Incassato</span>
                    <span class="card-value">{{ formatCurrency(order.calculations?.totalPaid || 0) }}</span>
                  </div>
                </div>
                <div class="summary-card" :class="{ 'danger': (order.calculations?.balance || 0) > 0 }">
                  <i class="pi pi-wallet"></i>
                  <div class="card-content">
                    <span class="card-label">Da Incassare</span>
                    <span class="card-value">{{ formatCurrency(order.calculations?.balance || order.total) }}</span>
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="payment-progress-section" v-if="order.calculations">
                <div class="progress-header">
                  <span>Avanzamento Pagamenti</span>
                  <span class="progress-percentage">{{ order.calculations.paymentProgress }}%</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" :style="{ width: `${order.calculations.paymentProgress}%` }"></div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="payment-dues-actions">
              <Button
                v-if="!order.paymentDues?.length"
                label="Genera Scadenze"
                icon="pi pi-calendar-plus"
                @click="generatePaymentDues"
                :loading="generatingDues"
              />
            </div>

            <!-- Payment Dues Table -->
            <DataTable v-if="order.paymentDues?.length" :value="order.paymentDues" responsiveLayout="scroll" class="payment-dues-table">
              <Column header="Rata" style="width: 90px">
                <template #body="{ data }">
                  <div class="installment-badge">
                    <span class="installment-number">{{ data.installmentNumber }}</span>
                    <span class="installment-total">/{{ data.totalInstallments }}</span>
                  </div>
                </template>
              </Column>
              <Column header="Scadenza" style="width: 130px">
                <template #body="{ data }">
                  <div class="due-date-cell">
                    <span :class="{ 'overdue-date': isOverdue(data.dueDate) && data.status !== 'PAID' }">
                      {{ formatShortDate(data.dueDate) }}
                    </span>
                    <Tag v-if="isOverdue(data.dueDate) && data.status !== 'PAID'" value="SCADUTO" severity="danger" class="overdue-tag" />
                  </div>
                </template>
              </Column>
              <Column header="Importo" style="width: 130px">
                <template #body="{ data }">
                  <div class="amount-cell">
                    <strong class="due-amount">{{ formatCurrency(data.amount) }}</strong>
                  </div>
                </template>
              </Column>
              <Column header="Pagato" style="width: 150px">
                <template #body="{ data }">
                  <div class="paid-cell">
                    <span class="paid-amount-value" :class="{ 'has-paid': data.paidAmount > 0 }">
                      {{ formatCurrency(data.paidAmount) }}
                    </span>
                    <span class="remaining-info" v-if="data.paidAmount > 0 && data.paidAmount < data.amount">
                      (rimane: {{ formatCurrency(data.amount - data.paidAmount) }})
                    </span>
                  </div>
                </template>
              </Column>
              <Column header="Stato" style="width: 110px">
                <template #body="{ data }">
                  <Tag
                    :value="getPaymentDueStatusLabel(data.status)"
                    :severity="getPaymentDueStatusSeverity(data.status)"
                  />
                </template>
              </Column>
              <Column header="Azioni" style="width: 140px">
                <template #body="{ data }">
                  <div class="action-buttons">
                    <Button
                      v-if="data.status !== 'PAID'"
                      icon="pi pi-euro"
                      class="p-button-rounded p-button-text p-button-sm"
                      @click="openRecordPaymentDialog(data)"
                      v-tooltip.top="'Registra Pagamento'"
                    />
                    <Button
                      v-if="data.payments?.length > 0"
                      icon="pi pi-history"
                      class="p-button-rounded p-button-text p-button-info p-button-sm"
                      @click="openPaymentHistoryDialog(data)"
                      v-tooltip.top="'Storico Pagamenti'"
                    />
                    <Button
                      v-if="data.status !== 'PAID'"
                      icon="pi pi-check-circle"
                      class="p-button-rounded p-button-text p-button-success p-button-sm"
                      @click="markPaymentDueAsPaid(data.id)"
                      v-tooltip.top="'Segna tutto pagato'"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>

            <div v-else class="no-data">
              <i class="pi pi-calendar"></i>
              <p>Nessuna scadenza configurata.</p>
              <small>Clicca "Genera Scadenze" per creare le rate in base al piano pagamento del cliente.</small>
            </div>
          </div>
        </TabPanel>

        <!-- ALLEGATI -->
        <TabPanel>
          <template #header>
            <div class="tab-header-with-badge">
              <span>Allegati</span>
              <Badge v-if="order.attachments?.length" :value="order.attachments.length" />
            </div>
          </template>

          <div class="attachments-section">
            <!-- Upload form (simplified - in production would use file upload) -->
            <div class="attachments-header">
              <div class="attachment-add-form">
                <InputText v-model="newAttachment.name" placeholder="Nome file" class="att-name" />
                <InputText v-model="newAttachment.url" placeholder="URL file" class="att-url" />
                <Dropdown
                  v-model="newAttachment.type"
                  :options="attachmentTypes"
                  placeholder="Tipo"
                  class="att-type"
                />
                <Button
                  icon="pi pi-plus"
                  label="Aggiungi"
                  :disabled="!newAttachment.name || !newAttachment.url"
                  @click="addAttachment"
                  :loading="addingAttachment"
                />
              </div>
            </div>

            <DataTable v-if="order.attachments?.length" :value="order.attachments" responsiveLayout="scroll" class="attachments-table">
              <Column header="Nome">
                <template #body="{ data }">
                  <div class="attachment-name">
                    <i :class="getAttachmentIcon(data.type)"></i>
                    <a :href="data.url" target="_blank">{{ data.name }}</a>
                  </div>
                </template>
              </Column>
              <Column header="Tipo" style="width: 100px">
                <template #body="{ data }">
                  <Tag :value="data.type" />
                </template>
              </Column>
              <Column header="Aggiunto" style="width: 150px">
                <template #body="{ data }">
                  <div class="attachment-meta">
                    <small>{{ formatDate(data.addedAt) }}</small>
                    <small v-if="data.addedBy">da {{ data.addedBy }}</small>
                  </div>
                </template>
              </Column>
              <Column style="width: 80px">
                <template #body="{ data }">
                  <Button
                    icon="pi pi-download"
                    class="p-button-rounded p-button-text"
                    @click="downloadAttachment(data)"
                    v-tooltip.top="'Scarica'"
                  />
                  <Button
                    icon="pi pi-trash"
                    class="p-button-rounded p-button-danger p-button-text"
                    @click="removeAttachment(data.id)"
                    v-tooltip.top="'Elimina'"
                  />
                </template>
              </Column>
            </DataTable>

            <div v-else class="no-data">
              <i class="pi pi-paperclip"></i>
              <p>Nessun allegato</p>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <Button
            v-if="order?.wordpressId"
            label="Sync WooCommerce"
            icon="pi pi-refresh"
            severity="secondary"
            :loading="saving"
            @click="syncToWooCommerce"
          />
        </div>
        <div class="footer-right">
          <Button label="Chiudi" severity="secondary" @click="visible = false" />
        </div>
      </div>
    </template>
  </Dialog>

  <!-- Cancel Confirmation Dialog -->
  <Dialog
    v-model:visible="showCancelConfirm"
    header="Conferma Annullamento"
    :modal="true"
    :style="{ width: '400px' }"
  >
    <div class="confirm-content">
      <i class="pi pi-exclamation-triangle confirm-icon"></i>
      <p>Sei sicuro di voler annullare questo ordine?</p>
      <p class="confirm-detail">Questa azione non può essere annullata.</p>
    </div>
    <template #footer>
      <Button label="No, mantieni" severity="secondary" @click="showCancelConfirm = false" />
      <Button label="Sì, annulla ordine" severity="danger" @click="cancelOrder" :loading="changingStatus" />
    </template>
  </Dialog>

  <!-- Shipment Dialog -->
  <ShipmentDialog
    v-if="showShipmentDialog"
    v-model="showShipmentDialog"
    :orderId="order?.id"
    @shipped="loadOrder(); emit('refresh');"
  />

  <!-- Record Payment Dialog -->
  <RecordPaymentDialog
    v-if="showRecordPaymentDialog"
    v-model="showRecordPaymentDialog"
    :paymentDue="selectedPaymentDue"
    @recorded="onPaymentRecorded"
  />

  <!-- Payment History Dialog -->
  <PaymentHistoryDialog
    v-if="showPaymentHistoryDialog"
    v-model="showPaymentHistoryDialog"
    :paymentDue="selectedPaymentDue"
  />
</template>

<style scoped>
.order-detail-dialog :deep(.p-dialog-content) {
  padding: 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.order-content {
  padding: 1rem;
}

/* Overview Grid */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.overview-section {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1rem;
}

.overview-section h4 {
  margin: 0 0 1rem 0;
  color: var(--primary-color);
  font-size: 0.95rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.info-row .label {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.info-row .value {
  font-weight: 500;
}

.info-row .value.discount,
.info-row .value.refunded {
  color: var(--red-500);
}

.total-row {
  font-size: 1.1rem;
}

.total-row .value {
  color: var(--primary-color);
  font-weight: 700;
}

/* Tab header with badge */
.tab-header-with-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Items table */
.product-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.product-thumbnail {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}

.product-info {
  display: flex;
  flex-direction: column;
}

.product-name {
  font-weight: 500;
}

.product-sku {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.product-parent {
  font-size: 0.8rem;
  color: var(--blue-500);
}

/* Addresses */
.addresses-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.address-card {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1.25rem;
}

.address-card h4 {
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
}

.address-content p {
  margin: 0.25rem 0;
}

.address-content .phone,
.address-content .email {
  margin-top: 0.75rem;
  color: var(--text-color-secondary);
}

/* WooCommerce section */
.wc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.wc-section {
  background: var(--surface-50);
  border-radius: 8px;
  padding: 1rem;
}

.wc-section h4 {
  margin: 0 0 1rem 0;
  color: var(--primary-color);
  font-size: 0.95rem;
}

.wc-extra-section {
  margin-top: 1.5rem;
}

.wc-extra-section h4 {
  margin-bottom: 0.75rem;
  color: var(--text-color);
}

.no-wc-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-color-secondary);
}

.no-wc-data i {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.code {
  font-family: monospace;
  font-size: 0.85rem;
}

/* Notes */
.add-note-form {
  margin-bottom: 1rem;
}

.note-form-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.note-type-dropdown {
  width: 140px;
}

.note-textarea {
  flex: 1;
}

.note-form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.notes-timeline {
  margin-top: 1rem;
}

.note-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--surface-200);
}

.note-marker.internal {
  background: var(--blue-100);
  color: var(--blue-600);
}

.note-marker.customer {
  background: var(--green-100);
  color: var(--green-600);
}

.note-marker.status_change {
  background: var(--orange-100);
  color: var(--orange-600);
}

.note-marker.system {
  background: var(--gray-100);
  color: var(--gray-600);
}

.note-content {
  background: var(--surface-50);
  padding: 0.75rem;
  border-radius: 6px;
}

.note-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.note-author {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.note-content p {
  margin: 0;
}

/* Refunds */
.refund-form {
  background: var(--surface-50);
  padding: 1.5rem;
  border-radius: 8px;
}

.refund-form h4 {
  margin: 0 0 1rem 0;
}

.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.refund-total {
  margin: 1rem 0;
  text-align: right;
  font-size: 1.1rem;
}

.refund-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.refunds-header {
  margin-bottom: 1rem;
}

/* Refund form enhancements */
.tax-rate-badge {
  background: var(--blue-100);
  color: var(--blue-700);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.refundable-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.refundable-info .max-amount {
  color: var(--text-color-secondary);
  font-size: 0.75rem;
}

.amount-input-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.amount-input-container .amount-hint {
  color: var(--text-color-secondary);
  font-size: 0.7rem;
}

.refund-summary {
  margin: 1rem 0;
  display: flex;
  justify-content: flex-end;
}

.refund-breakdown {
  background: var(--surface-100);
  padding: 1rem;
  border-radius: 8px;
  min-width: 250px;
}

.breakdown-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  color: var(--text-color-secondary);
}

.breakdown-row.total {
  border-top: 1px solid var(--surface-300);
  padding-top: 0.5rem;
  margin-top: 0.5rem;
  color: var(--text-color);
}

.breakdown-row.total strong {
  color: var(--primary-color);
  font-size: 1.1rem;
}

/* Shipping */
.shipping-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.shipping-section {
  background: var(--surface-50);
  padding: 1rem;
  border-radius: 8px;
}

.shipping-section h4 {
  margin: 0 0 1rem 0;
  color: var(--primary-color);
}

.customer-note {
  background: var(--yellow-50);
  padding: 1rem;
  border-radius: 6px;
  border-left: 4px solid var(--yellow-500);
  margin: 0;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left,
.footer-right {
  display: flex;
  gap: 0.5rem;
}

/* Utilities */
.no-data {
  color: var(--text-color-secondary);
  text-align: center;
  padding: 2rem;
}

.w-full {
  width: 100%;
}

@media (max-width: 768px) {
  .overview-grid,
  .addresses-grid,
  .wc-grid {
    grid-template-columns: 1fr;
  }
}

/* Payment Dues (Scadenzario) */
.payment-dues-section {
  padding: 0.5rem 0;
}

/* Payment Summary Cards */
.payment-summary {
  background: linear-gradient(135deg, var(--surface-50) 0%, var(--surface-100) 100%);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-card i {
  font-size: 1.5rem;
  color: var(--primary-color);
}

.summary-card.success i {
  color: var(--green-500);
}

.summary-card.danger i {
  color: var(--red-500);
}

.summary-card .card-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-card .card-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.summary-card .card-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
}

.summary-card.success .card-value {
  color: var(--green-600);
}

.summary-card.danger .card-value {
  color: var(--red-600);
}

/* Progress Bar */
.payment-progress-section {
  padding-top: 0.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-header span {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.progress-percentage {
  font-weight: 700;
  color: var(--primary-color) !important;
}

.progress-bar-container {
  width: 100%;
  height: 10px;
  background: var(--surface-200);
  border-radius: 5px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-400));
  border-radius: 5px;
  transition: width 0.5s ease;
}

/* Actions */
.payment-dues-actions {
  margin-bottom: 1rem;
}

/* Payment Dues Table */
.payment-dues-table .installment-badge {
  display: inline-flex;
  align-items: baseline;
}

.payment-dues-table .installment-number {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--primary-color);
}

.payment-dues-table .installment-total {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.payment-dues-table .due-date-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.payment-dues-table .overdue-date {
  color: var(--red-600);
  font-weight: 600;
}

.payment-dues-table .overdue-tag {
  font-size: 0.65rem;
  padding: 0.15rem 0.35rem;
}

.payment-dues-table .due-amount {
  font-size: 1rem;
  color: var(--text-color);
}

.payment-dues-table .paid-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.payment-dues-table .paid-amount-value {
  color: var(--text-color-secondary);
}

.payment-dues-table .paid-amount-value.has-paid {
  color: var(--green-600);
  font-weight: 600;
}

.payment-dues-table .remaining-info {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.payment-dues-table .action-buttons {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

/* Legacy overdue class */
.payment-dues-table .overdue {
  color: var(--red-500);
  font-weight: 600;
}

.payment-dues-table .paid-amount {
  color: var(--green-500);
  font-weight: 500;
}

/* Attachments (Allegati) */
.attachments-section {
  padding: 0.5rem 0;
}

.attachments-header {
  margin-bottom: 1rem;
}

.attachment-add-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.attachment-add-form .att-name {
  flex: 2;
  min-width: 150px;
}

.attachment-add-form .att-url {
  flex: 3;
  min-width: 200px;
}

.attachment-add-form .att-type {
  width: 120px;
}

.attachments-table .attachment-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.attachments-table .attachment-name i {
  font-size: 1.25rem;
  color: var(--primary-color);
}

.attachments-table .attachment-name a {
  color: var(--primary-color);
  text-decoration: none;
}

.attachments-table .attachment-name a:hover {
  text-decoration: underline;
}

.attachments-table .attachment-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.attachments-table .attachment-meta small {
  color: var(--text-color-secondary);
}

/* No data state enhancement */
.no-data i {
  font-size: 2rem;
  color: var(--surface-400);
  margin-bottom: 0.5rem;
}

.no-data p {
  margin: 0;
}

@media (max-width: 640px) {
  .payment-dues-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .payment-progress {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .progress-bar {
    width: 100%;
  }

  .attachment-add-form {
    flex-direction: column;
    align-items: stretch;
  }

  .attachment-add-form .att-name,
  .attachment-add-form .att-url,
  .attachment-add-form .att-type {
    width: 100%;
    min-width: unset;
  }
}

/* Status Workflow Section */
.status-workflow-section {
  background: linear-gradient(135deg, var(--surface-50) 0%, var(--surface-100) 100%);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.status-workflow-section h4 {
  margin: 0 0 1.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.status-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding: 0.5rem 0;
  overflow-x: auto;
}

.status-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 80px;
}

.status-step .status-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-200);
  color: var(--text-color-secondary);
  margin-bottom: 0.5rem;
  z-index: 1;
  transition: all 0.3s ease;
}

.status-step .status-icon i {
  font-size: 1rem;
}

.status-step .status-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-align: center;
  font-weight: 500;
}

.status-step .status-connector {
  position: absolute;
  top: 20px;
  left: calc(50% + 20px);
  right: calc(-50% + 20px);
  height: 3px;
  background: var(--surface-200);
  z-index: 0;
}

/* Completed status */
.status-step.completed .status-icon {
  background: var(--green-500);
  color: white;
}

.status-step.completed .status-label {
  color: var(--green-600);
  font-weight: 600;
}

.status-step.completed .status-connector {
  background: var(--green-500);
}

/* Active status */
.status-step.active .status-icon {
  background: var(--primary-color);
  color: white;
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.2);
  transform: scale(1.1);
}

.status-step.active .status-label {
  color: var(--primary-color);
  font-weight: 700;
}

/* Upcoming status */
.status-step.upcoming .status-icon {
  background: var(--surface-200);
  color: var(--text-color-secondary);
}

.status-step.upcoming .status-label {
  color: var(--text-color-secondary);
}

/* Workflow Actions */
.workflow-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.workflow-actions .p-button {
  min-width: 140px;
}

/* Cancelled Banner */
.cancelled-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 1rem;
}

.cancelled-banner i {
  font-size: 2rem;
  color: var(--red-500);
}

.cancelled-banner h4 {
  margin: 0;
  color: var(--red-700);
  font-size: 1rem;
}

.cancelled-banner p {
  margin: 0.25rem 0 0;
  color: var(--red-600);
  font-size: 0.875rem;
}

/* Confirm Dialog */
.confirm-content {
  text-align: center;
  padding: 1rem 0;
}

.confirm-content .confirm-icon {
  font-size: 3rem;
  color: var(--yellow-500);
  margin-bottom: 1rem;
}

.confirm-content p {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.confirm-content .confirm-detail {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

/* Mobile responsive for workflow */
@media (max-width: 768px) {
  .status-flow {
    flex-wrap: nowrap;
    padding: 0.5rem;
  }

  .status-step {
    min-width: 60px;
  }

  .status-step .status-icon {
    width: 32px;
    height: 32px;
  }

  .status-step .status-icon i {
    font-size: 0.875rem;
  }

  .status-step .status-label {
    font-size: 0.65rem;
  }

  .status-step .status-connector {
    top: 16px;
  }

  .workflow-actions {
    flex-direction: column;
  }

  .workflow-actions .p-button {
    width: 100%;
  }
}
</style>
