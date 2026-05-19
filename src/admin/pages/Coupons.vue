<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import ToggleButton from 'primevue/togglebutton';
import { useToast } from 'primevue/usetoast';
import { adminApi } from '../services/api';

const toast = useToast();
const coupons = ref<any[]>([]);
const loading = ref(false);
const showForm = ref(false);
const saving = ref(false);

const form = reactive<any>({
  id: null,
  code: '',
  name: '',
  type: 'PERCENTAGE',
  value: 0,
  validFrom: new Date(),
  validUntil: null,
  maxUses: null,
  isActive: true,
});

const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('it-IT') : '—');

async function load() {
  loading.value = true;
  const res = await adminApi.getCoupons();
  if (res.success && res.data) {
    coupons.value = res.data.items;
  } else if (res.error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: res.error, life: 5000 });
  }
  loading.value = false;
}

function openNew() {
  Object.assign(form, {
    id: null,
    code: '',
    name: '',
    type: 'PERCENTAGE',
    value: 0,
    validFrom: new Date(),
    validUntil: null,
    maxUses: null,
    isActive: true,
  });
  showForm.value = true;
}

function openEdit(coupon: any) {
  Object.assign(form, {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name || '',
    type: coupon.type,
    value: Number(coupon.discountValue),
    validFrom: coupon.validFrom ? new Date(coupon.validFrom) : new Date(),
    validUntil: coupon.validTo ? new Date(coupon.validTo) : null,
    maxUses: coupon.maxUses,
    isActive: coupon.isActive,
  });
  showForm.value = true;
}

async function save() {
  saving.value = true;
  const payload: any = {
    code: form.code,
    name: form.name || undefined,
    type: form.type,
    value: form.value,
    validFrom: form.validFrom ? form.validFrom.toISOString() : undefined,
    validUntil: form.validUntil ? form.validUntil.toISOString() : undefined,
    maxUses: form.maxUses,
    isActive: form.isActive,
  };
  const res = form.id ? await adminApi.updateCoupon(form.id, payload) : await adminApi.createCoupon(payload);
  if (res.success) {
    toast.add({ severity: 'success', summary: 'Salvato', life: 3000 });
    showForm.value = false;
    await load();
  } else {
    toast.add({ severity: 'error', summary: 'Errore', detail: res.error, life: 5000 });
  }
  saving.value = false;
}

onMounted(load);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Coupon</h1>
        <p>Codici sconto e promozioni</p>
      </div>
      <Button label="Nuovo coupon" icon="pi pi-plus" @click="openNew" />
    </div>

    <DataTable :value="coupons" :loading="loading" stripedRows responsiveLayout="scroll">
      <Column field="code" header="Codice" :sortable="true">
        <template #body="{ data }"><strong>{{ data.code }}</strong></template>
      </Column>
      <Column field="name" header="Nome">
        <template #body="{ data }">{{ data.name || '—' }}</template>
      </Column>
      <Column header="Tipo">
        <template #body="{ data }">
          <Tag :value="data.type === 'PERCENTAGE' ? '%' : 'FIX €'" severity="info" />
          {{ data.type === 'PERCENTAGE' ? `${Number(data.discountValue)}%` : `€${Number(data.discountValue).toFixed(2)}` }}
        </template>
      </Column>
      <Column header="Validità">
        <template #body="{ data }">
          {{ formatDate(data.validFrom) }} → {{ data.validTo ? formatDate(data.validTo) : '∞' }}
        </template>
      </Column>
      <Column header="Utilizzi">
        <template #body="{ data }">{{ data.usageCount || 0 }} / {{ data.maxUses ?? '∞' }}</template>
      </Column>
      <Column header="Attivo">
        <template #body="{ data }">
          <Tag :value="data.isActive ? 'SI' : 'NO'" :severity="data.isActive ? 'success' : 'secondary'" />
        </template>
      </Column>
      <Column header="Azioni">
        <template #body="{ data }">
          <Button icon="pi pi-pencil" class="p-button-text p-button-sm" @click="openEdit(data)" />
        </template>
      </Column>
      <template #empty>
        <div style="padding: 40px; text-align: center; color: #94a3b8;">Nessun coupon creato.</div>
      </template>
    </DataTable>

    <Dialog
      v-model:visible="showForm"
      :header="form.id ? 'Modifica coupon' : 'Nuovo coupon'"
      :modal="true"
      :style="{ width: '560px' }"
      :draggable="false"
    >
      <div class="grid-form">
        <div class="field">
          <label>Codice *</label>
          <InputText v-model="form.code" :disabled="!!form.id" class="w-full" />
        </div>
        <div class="field">
          <label>Nome</label>
          <InputText v-model="form.name" class="w-full" />
        </div>
        <div class="field">
          <label>Tipo *</label>
          <Dropdown
            v-model="form.type"
            :options="[
              { label: 'Percentuale', value: 'PERCENTAGE' },
              { label: 'Importo fisso', value: 'FIXED_AMOUNT' },
            ]"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>
        <div class="field">
          <label>Valore *</label>
          <InputNumber v-model="form.value" :min="0" :minFractionDigits="2" class="w-full" />
        </div>
        <div class="field">
          <label>Valido dal</label>
          <Calendar v-model="form.validFrom" dateFormat="dd/mm/yy" class="w-full" />
        </div>
        <div class="field">
          <label>Valido fino al</label>
          <Calendar v-model="form.validUntil" dateFormat="dd/mm/yy" class="w-full" showButtonBar />
        </div>
        <div class="field">
          <label>Max utilizzi</label>
          <InputNumber v-model="form.maxUses" :min="1" class="w-full" />
        </div>
        <div class="field">
          <label>Attivo</label>
          <ToggleButton v-model="form.isActive" onLabel="Attivo" offLabel="Disattivo" />
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showForm = false" />
        <Button label="Salva" icon="pi pi-save" :loading="saving" @click="save" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page { padding: 24px; }
.page-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
}
.page-header h1 { margin: 0; }
.page-header p { color: #94a3b8; margin: 4px 0 0 0; }
.grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid-form .field { display: flex; flex-direction: column; }
.grid-form label { font-weight: 500; font-size: 13px; margin-bottom: 6px; }
</style>
