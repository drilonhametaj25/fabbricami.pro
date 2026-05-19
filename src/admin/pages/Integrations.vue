<template>
  <div class="integrations-page">
    <div class="page-header">
      <h1>Integrazioni</h1>
      <p class="text-muted">
        Configura le integrazioni esterne usate dalla piattaforma. Le credenziali
        sono cifrate e usate per emettere fatture automatiche ai clienti SaaS.
      </p>
    </div>

    <!-- Fatture in Cloud -->
    <div class="integration-card">
      <div class="integration-header">
        <div>
          <h2>
            <i class="pi pi-file-edit"></i>
            Fatture in Cloud
          </h2>
          <p class="text-muted">
            Emissione automatica di fatture ai tenant quando Stripe conferma un pagamento.
            Ad ogni evento <code>invoice.paid</code> il sistema crea/aggiorna il cliente in
            Fatture in Cloud e genera la fattura corrispondente.
          </p>
        </div>
        <Tag
          :severity="fic.configured ? 'success' : 'warning'"
          :value="fic.configured ? 'Configurato' : 'Non configurato'"
        />
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Company ID</label>
          <InputText
            v-model="fic.companyId"
            placeholder="123456"
            :disabled="loading"
          />
          <small class="text-muted">L'ID della tua azienda in Fatture in Cloud (da URL dashboard)</small>
        </div>

        <div class="field">
          <label>API Access Token</label>
          <Password
            v-model="fic.apiToken"
            placeholder="fic_xxxxxxxxxxxx"
            :feedback="false"
            toggleMask
            :disabled="loading"
            inputClass="w-full"
          />
          <small class="text-muted">Genera un token OAuth2 da Settings → Integrations su Fatture in Cloud</small>
        </div>

        <div class="field">
          <label>Tipo documento default</label>
          <Dropdown
            v-model="fic.documentType"
            :options="ficDocTypes"
            optionLabel="label"
            optionValue="value"
            :disabled="loading"
          />
          <small class="text-muted">TD01 = Fattura, TD24 = Fattura differita</small>
        </div>

        <div class="field">
          <label>Aliquota IVA % default</label>
          <InputNumber
            v-model="fic.defaultVatRate"
            :min="0"
            :max="100"
            :disabled="loading"
            suffix="%"
          />
        </div>

        <div class="field">
          <label>Auto-invio SDI</label>
          <InputSwitch v-model="fic.autoSendSdi" :disabled="loading" />
          <small class="text-muted">Invia automaticamente la fattura al SDI dopo la creazione</small>
        </div>

        <div class="field">
          <label>Attiva integrazione</label>
          <InputSwitch v-model="fic.enabled" :disabled="loading" />
          <small class="text-muted">Disattiva per fermare l'emissione automatica</small>
        </div>
      </div>

      <div class="actions">
        <Button
          label="Salva configurazione"
          icon="pi pi-save"
          @click="saveFicConfig"
          :loading="loading"
        />
        <Button
          label="Test connessione"
          icon="pi pi-link"
          severity="secondary"
          @click="testFicConnection"
          :loading="testing"
          :disabled="!fic.companyId || !fic.apiToken"
        />
      </div>

      <Message v-if="fic.lastTestResult" :severity="fic.lastTestResult.success ? 'success' : 'error'" :closable="false">
        {{ fic.lastTestResult.message }}
      </Message>
    </div>

    <!-- Recent invoices issued -->
    <div class="integration-card">
      <h2>
        <i class="pi pi-list"></i>
        Ultime fatture emesse ai tenant
      </h2>
      <p class="text-muted">
        Le fatture vengono emesse automaticamente quando Stripe processa un pagamento.
        Sotto le ultime 20.
      </p>
      <DataTable
        :value="recentInvoices"
        :loading="loadingInvoices"
        emptyMessage="Nessuna fattura emessa ancora"
      >
        <Column field="tenantName" header="Tenant" />
        <Column field="invoiceNumber" header="Numero fattura FIC" />
        <Column field="amount" header="Importo">
          <template #body="{ data }">
            € {{ Number(data.amount).toFixed(2) }}
          </template>
        </Column>
        <Column field="status" header="Stato">
          <template #body="{ data }">
            <Tag :severity="data.status === 'sent' ? 'success' : 'warning'" :value="data.status" />
          </template>
        </Column>
        <Column field="issuedAt" header="Emessa il">
          <template #body="{ data }">
            {{ new Date(data.issuedAt).toLocaleString('it-IT') }}
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputSwitch from 'primevue/inputswitch';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { useAuthStore } from '../stores/auth';

const toast = useToast();
const authStore = useAuthStore();

const loading = ref(false);
const testing = ref(false);
const loadingInvoices = ref(false);

const fic = ref({
  companyId: '',
  apiToken: '',
  documentType: 'TD01',
  defaultVatRate: 22,
  autoSendSdi: true,
  enabled: false,
  configured: false,
  lastTestResult: null as { success: boolean; message: string } | null,
});

const ficDocTypes = [
  { label: 'TD01 - Fattura', value: 'TD01' },
  { label: 'TD24 - Fattura differita', value: 'TD24' },
  { label: 'TD06 - Parcella', value: 'TD06' },
];

const recentInvoices = ref<any[]>([]);

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function authHeaders() {
  return {
    Authorization: 'Bearer ' + authStore.token,
    'Content-Type': 'application/json',
  };
}

async function loadFicConfig() {
  loading.value = true;
  try {
    const r = await fetch(`${apiBase}/api/v1/admin/integrations/fic`, { headers: authHeaders() });
    const j = await r.json();
    if (j.success && j.data) {
      fic.value.companyId = j.data.companyId || '';
      // API token mai re-inviato in chiaro; backend ritorna placeholder se settato
      fic.value.apiToken = j.data.hasApiToken ? '••••••••••••••••' : '';
      fic.value.documentType = j.data.documentType || 'TD01';
      fic.value.defaultVatRate = j.data.defaultVatRate ?? 22;
      fic.value.autoSendSdi = j.data.autoSendSdi ?? true;
      fic.value.enabled = j.data.enabled ?? false;
      fic.value.configured = !!j.data.hasApiToken;
    }
  } catch (e: any) {
    // Endpoint non disponibile o non ancora configurato — silente
  } finally {
    loading.value = false;
  }
}

async function saveFicConfig() {
  loading.value = true;
  try {
    const payload: any = {
      companyId: fic.value.companyId,
      documentType: fic.value.documentType,
      defaultVatRate: fic.value.defaultVatRate,
      autoSendSdi: fic.value.autoSendSdi,
      enabled: fic.value.enabled,
    };
    // Manda apiToken solo se l'utente l'ha cambiato (non se è il placeholder)
    if (fic.value.apiToken && !fic.value.apiToken.startsWith('•')) {
      payload.apiToken = fic.value.apiToken;
    }
    const r = await fetch(`${apiBase}/api/v1/admin/integrations/fic`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j.error || 'Errore salvataggio');
    toast.add({ severity: 'success', summary: 'Configurazione salvata', life: 3000 });
    fic.value.configured = true;
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: e.message, life: 5000 });
  } finally {
    loading.value = false;
  }
}

async function testFicConnection() {
  testing.value = true;
  fic.value.lastTestResult = null;
  try {
    const r = await fetch(`${apiBase}/api/v1/admin/integrations/fic/test`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const j = await r.json();
    fic.value.lastTestResult = {
      success: r.ok && j.success,
      message: j.data?.message || j.error || (r.ok ? 'Connessione OK' : 'Errore connessione'),
    };
  } catch (e: any) {
    fic.value.lastTestResult = { success: false, message: e.message };
  } finally {
    testing.value = false;
  }
}

async function loadRecentInvoices() {
  loadingInvoices.value = true;
  try {
    const r = await fetch(`${apiBase}/api/v1/admin/integrations/fic/invoices?limit=20`, {
      headers: authHeaders(),
    });
    const j = await r.json();
    if (j.success) recentInvoices.value = j.data || [];
  } catch {
    // Nessuna fattura emessa ancora
  } finally {
    loadingInvoices.value = false;
  }
}

onMounted(() => {
  loadFicConfig();
  loadRecentInvoices();
});
</script>

<style scoped>
.integrations-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  margin: 0 0 0.5rem;
}

.text-muted {
  color: var(--text-color-secondary, #6b7280);
  font-size: 0.875rem;
}

.integration-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.integration-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.integration-header h2 {
  font-size: 1.25rem;
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.field small {
  font-size: 0.75rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}
</style>
