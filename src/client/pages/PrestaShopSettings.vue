<template>
  <div class="prestashop-page">
    <PageHeader title="Integrazione PrestaShop" subtitle="Sincronizza prodotti, inventario e ordini con il tuo store PrestaShop 8.x" />

    <div class="ps-grid">
      <!-- Configurazione -->
      <Card class="ps-card">
        <template #title>Configurazione Webservice</template>
        <template #content>
          <div class="field">
            <label>URL PrestaShop</label>
            <InputText v-model="form.apiUrl" placeholder="https://ilmiostore.it" class="w-full" />
            <small>URL base dello store (senza /api). Abilita il Webservice in PrestaShop: Parametri Avanzati → Webservice.</small>
          </div>
          <div class="field">
            <label>Webservice API Key {{ settings.hasApiKey ? '(configurata)' : '' }}</label>
            <Password v-model="form.apiKey" :feedback="false" toggleMask placeholder="Lascia vuoto per mantenere la chiave attuale" class="w-full" inputClass="w-full" />
          </div>

          <div class="switches">
            <div class="switch-row"><InputSwitch v-model="form.syncEnabled" /> <span>Sync automatica abilitata (ogni 15 min)</span></div>
            <div class="switch-row"><InputSwitch v-model="form.pushProducts" /> <span>Push prodotti (ERP → PrestaShop)</span></div>
            <div class="switch-row"><InputSwitch v-model="form.pushInventory" /> <span>Push inventario (ERP → PrestaShop)</span></div>
            <div class="switch-row"><InputSwitch v-model="form.importOrders" /> <span>Import ordini (PrestaShop → ERP)</span></div>
          </div>

          <div class="actions">
            <Button label="Salva" icon="pi pi-save" :loading="saving" @click="save" />
            <Button label="Testa Connessione" icon="pi pi-bolt" severity="secondary" :loading="testing" @click="testConnection" />
            <Tag v-if="testResult" :severity="testResult.ok ? 'success' : 'danger'" :value="testResult.ok ? 'Connessione OK' : 'Errore: ' + (testResult.error || '')" />
          </div>
        </template>
      </Card>

      <!-- Azioni di sync manuali -->
      <Card class="ps-card">
        <template #title>Sincronizzazione manuale</template>
        <template #content>
          <p class="hint">Esegui ora una sincronizzazione. I risultati appaiono nel log sotto.</p>
          <div class="sync-buttons">
            <Button label="Push Prodotti" icon="pi pi-upload" :loading="busy==='products'" :disabled="!settings.isConfigured" @click="run('sync-products','products')" />
            <Button label="Push Inventario" icon="pi pi-box" :loading="busy==='inventory'" :disabled="!settings.isConfigured" @click="run('sync-inventory','inventory')" />
            <Button label="Importa Ordini" icon="pi pi-download" :loading="busy==='orders'" :disabled="!settings.isConfigured" @click="run('import-orders','orders')" />
            <Button label="Importa Clienti" icon="pi pi-users" :loading="busy==='customers'" :disabled="!settings.isConfigured" @click="run('import-customers','customers')" />
          </div>
        </template>
      </Card>
    </div>

    <!-- Log -->
    <Card class="ps-card">
      <template #title>Log di sincronizzazione</template>
      <template #content>
        <DataTable :value="logs" :loading="loadingLogs" responsiveLayout="scroll" emptyMessage="Nessun log disponibile" :rows="10" paginator>
          <Column header="Data">
            <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
          </Column>
          <Column field="entityType" header="Entità" />
          <Column field="direction" header="Direzione" />
          <Column header="Stato">
            <template #body="{ data }">
              <Tag :severity="data.status==='success' ? 'success' : data.status==='partial' ? 'warning' : 'danger'" :value="data.status" />
            </template>
          </Column>
          <Column field="count" header="N." />
          <Column field="message" header="Messaggio" />
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import InputSwitch from 'primevue/inputswitch';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const toast = useToast();

const settings = reactive<any>({ apiUrl: '', hasApiKey: false, isConfigured: false });
const form = reactive<any>({ apiUrl: '', apiKey: '', syncEnabled: false, pushProducts: true, pushInventory: true, importOrders: true });
const saving = ref(false);
const testing = ref(false);
const testResult = ref<{ ok: boolean; error?: string } | null>(null);
const busy = ref<string | null>(null);
const logs = ref<any[]>([]);
const loadingLogs = ref(false);

function applySettings(s: any) {
  Object.assign(settings, s);
  form.apiUrl = s.apiUrl || '';
  form.syncEnabled = !!s.syncEnabled;
  form.pushProducts = s.pushProducts !== false;
  form.pushInventory = s.pushInventory !== false;
  form.importOrders = s.importOrders !== false;
}

async function loadSettings() {
  const res = await api.get<any>('/prestashop/settings');
  if (res.success) applySettings(res.data);
}

async function loadLogs() {
  loadingLogs.value = true;
  try {
    const res = await api.get<any>('/prestashop/sync-logs');
    if (res.success) logs.value = res.data || [];
  } finally {
    loadingLogs.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const payload: any = { apiUrl: form.apiUrl, syncEnabled: form.syncEnabled, pushProducts: form.pushProducts, pushInventory: form.pushInventory, importOrders: form.importOrders };
    if (form.apiKey) payload.apiKey = form.apiKey;
    const res = await api.post<any>('/prestashop/settings', payload);
    if (res.success) {
      applySettings(res.data);
      form.apiKey = '';
      toast.add({ severity: 'success', summary: 'Salvato', detail: 'Configurazione PrestaShop aggiornata', life: 4000 });
    }
  } catch {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Salvataggio fallito', life: 4000 });
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const payload: any = {};
    if (form.apiUrl && form.apiKey) { payload.apiUrl = form.apiUrl; payload.apiKey = form.apiKey; }
    const res = await api.post<any>('/prestashop/test-connection', payload);
    testResult.value = res.data || { ok: res.success, error: res.error };
  } catch (e: any) {
    testResult.value = { ok: false, error: e?.message || 'Errore' };
  } finally {
    testing.value = false;
  }
}

async function run(endpoint: string, key: string) {
  busy.value = key;
  try {
    const res = await api.post<any>(`/prestashop/${endpoint}`, {});
    if (res.success) {
      const d = res.data || {};
      toast.add({ severity: d.errors?.length ? 'warn' : 'success', summary: 'Sync completata', detail: `${d.count ?? 0} elementi${d.errors?.length ? ', ' + d.errors.length + ' errori' : ''}`, life: 5000 });
    } else {
      toast.add({ severity: 'error', summary: 'Errore', detail: res.error || 'Sync fallita', life: 5000 });
    }
    await loadLogs();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: e?.message || 'Sync fallita', life: 5000 });
  } finally {
    busy.value = null;
  }
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleString('it-IT');
}

onMounted(async () => {
  await Promise.all([loadSettings(), loadLogs()]);
});
</script>

<style scoped>
.prestashop-page { max-width: 1200px; margin: 0 auto; }
.ps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
.ps-card { margin-bottom: 1.5rem; }
.field { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-weight: 600; font-size: 0.9rem; }
.field small { color: var(--text-secondary, #64748b); }
.w-full { width: 100%; }
.switches { display: flex; flex-direction: column; gap: 0.6rem; margin: 1rem 0; }
.switch-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.92rem; }
.actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-top: 1rem; }
.sync-buttons { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.hint { color: var(--text-secondary, #64748b); margin-bottom: 1rem; }
@media (max-width: 900px) { .ps-grid { grid-template-columns: 1fr; } }
</style>
