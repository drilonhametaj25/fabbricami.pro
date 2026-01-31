<template>
  <span :class="['status-badge', `status-badge--${severity}`]">
    <i v-if="icon" :class="icon"></i>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: string;
  type?: 'order' | 'invoice' | 'task' | 'sync' | 'purchaseOrder' | 'generic';
}

const props = withDefaults(defineProps<Props>(), {
  type: 'generic',
});

// Mappature status per tipo
const statusMaps: Record<string, Record<string, { label: string; severity: string; icon?: string }>> = {
  order: {
    PENDING: { label: 'In Attesa', severity: 'warning', icon: 'pi pi-clock' },
    CONFIRMED: { label: 'Confermato', severity: 'info', icon: 'pi pi-check' },
    PROCESSING: { label: 'In Lavorazione', severity: 'info', icon: 'pi pi-cog' },
    READY: { label: 'Pronto', severity: 'success', icon: 'pi pi-box' },
    SHIPPED: { label: 'Spedito', severity: 'primary', icon: 'pi pi-truck' },
    DELIVERED: { label: 'Consegnato', severity: 'success', icon: 'pi pi-check-circle' },
    CANCELLED: { label: 'Annullato', severity: 'danger', icon: 'pi pi-times' },
    REFUNDED: { label: 'Rimborsato', severity: 'secondary', icon: 'pi pi-replay' },
  },
  invoice: {
    DRAFT: { label: 'Bozza', severity: 'secondary', icon: 'pi pi-file' },
    ISSUED: { label: 'Emessa', severity: 'info', icon: 'pi pi-send' },
    PAID: { label: 'Pagata', severity: 'success', icon: 'pi pi-check-circle' },
    PARTIALLY_PAID: { label: 'Parziale', severity: 'warning', icon: 'pi pi-minus-circle' },
    OVERDUE: { label: 'Scaduta', severity: 'danger', icon: 'pi pi-exclamation-circle' },
    CANCELLED: { label: 'Annullata', severity: 'secondary', icon: 'pi pi-times' },
  },
  task: {
    TODO: { label: 'Da Fare', severity: 'secondary', icon: 'pi pi-circle' },
    IN_PROGRESS: { label: 'In Corso', severity: 'info', icon: 'pi pi-spin pi-spinner' },
    ON_HOLD: { label: 'In Pausa', severity: 'warning', icon: 'pi pi-pause' },
    COMPLETED: { label: 'Completato', severity: 'success', icon: 'pi pi-check' },
    CANCELLED: { label: 'Annullato', severity: 'danger', icon: 'pi pi-times' },
  },
  sync: {
    NOT_SYNCED: { label: 'Non Sincronizzato', severity: 'secondary', icon: 'pi pi-cloud' },
    SYNCED: { label: 'Sincronizzato', severity: 'success', icon: 'pi pi-cloud-upload' },
    PENDING: { label: 'In Attesa', severity: 'warning', icon: 'pi pi-clock' },
    ERROR: { label: 'Errore', severity: 'danger', icon: 'pi pi-exclamation-triangle' },
  },
  purchaseOrder: {
    DRAFT: { label: 'Bozza', severity: 'secondary', icon: 'pi pi-file' },
    SENT: { label: 'Inviato', severity: 'info', icon: 'pi pi-send' },
    CONFIRMED: { label: 'Confermato', severity: 'primary', icon: 'pi pi-check' },
    PARTIALLY_RECEIVED: { label: 'Parziale', severity: 'warning', icon: 'pi pi-minus-circle' },
    RECEIVED: { label: 'Ricevuto', severity: 'success', icon: 'pi pi-check-circle' },
    CANCELLED: { label: 'Annullato', severity: 'danger', icon: 'pi pi-times' },
  },
  generic: {
    ACTIVE: { label: 'Attivo', severity: 'success' },
    INACTIVE: { label: 'Inattivo', severity: 'secondary' },
    ENABLED: { label: 'Abilitato', severity: 'success' },
    DISABLED: { label: 'Disabilitato', severity: 'secondary' },
  },
};

const statusInfo = computed(() => {
  const map = statusMaps[props.type] || statusMaps.generic;
  return map[props.status] || { label: props.status, severity: 'secondary' };
});

const label = computed(() => statusInfo.value.label);
const severity = computed(() => statusInfo.value.severity);
const icon = computed(() => statusInfo.value.icon);
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.status-badge i {
  font-size: 0.75rem;
}

.status-badge--primary {
  background: #eff6ff;
  color: #2563eb;
}

.status-badge--secondary {
  background: #f1f5f9;
  color: #64748b;
}

.status-badge--success {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge--warning {
  background: #fef3c7;
  color: #d97706;
}

.status-badge--danger {
  background: #fee2e2;
  color: #dc2626;
}

.status-badge--info {
  background: #e0f2fe;
  color: #0284c7;
}
</style>
