<template>
  <div class="company-settings-page">
    <PageHeader
      title="Impostazioni Azienda"
      subtitle="Configurazione dati aziendali, fatturazione elettronica e SDI"
      icon="pi pi-building"
    />

    <TabView v-model:activeIndex="activeTab" class="settings-tabs">
      <!-- TAB: Dati Aziendali -->
      <TabPanel header="Dati Aziendali">
        <div class="settings-section">
          <h3 class="section-title">Informazioni Azienda</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="companyName">Ragione Sociale *</label>
              <InputText id="companyName" v-model="company.businessName" class="w-full" />
            </div>
            <div class="form-field">
              <label for="tradeName">Nome Commerciale</label>
              <InputText id="tradeName" v-model="company.tradeName" class="w-full" />
            </div>
            <div class="form-field">
              <label for="vatNumber">Partita IVA *</label>
              <InputText id="vatNumber" v-model="company.vatNumber" class="w-full" placeholder="IT12345678901" />
            </div>
            <div class="form-field">
              <label for="fiscalCode">Codice Fiscale *</label>
              <InputText id="fiscalCode" v-model="company.fiscalCode" class="w-full" />
            </div>
            <div class="form-field">
              <label for="reaNumber">Numero REA</label>
              <InputText id="reaNumber" v-model="company.reaNumber" class="w-full" placeholder="MI-1234567" />
            </div>
            <div class="form-field">
              <label for="shareCapital">Capitale Sociale</label>
              <InputNumber id="shareCapital" v-model="company.shareCapital" mode="currency" currency="EUR" locale="it-IT" class="w-full" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Sede Legale</h3>
          <div class="form-grid">
            <div class="form-field form-field--wide">
              <label for="street">Indirizzo *</label>
              <InputText id="street" v-model="company.address.street" class="w-full" />
            </div>
            <div class="form-field">
              <label for="city">Comune *</label>
              <InputText id="city" v-model="company.address.city" class="w-full" />
            </div>
            <div class="form-field">
              <label for="province">Provincia *</label>
              <InputText id="province" v-model="company.address.province" class="w-full" maxlength="2" placeholder="MI" />
            </div>
            <div class="form-field">
              <label for="zip">CAP *</label>
              <InputText id="zip" v-model="company.address.zip" class="w-full" maxlength="5" />
            </div>
            <div class="form-field">
              <label for="country">Paese *</label>
              <Dropdown id="country" v-model="company.address.country" :options="countries" optionLabel="name" optionValue="code" class="w-full" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Contatti</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="phone">Telefono</label>
              <InputText id="phone" v-model="company.phone" class="w-full" />
            </div>
            <div class="form-field">
              <label for="email">Email</label>
              <InputText id="email" v-model="company.email" class="w-full" type="email" />
            </div>
            <div class="form-field">
              <label for="pec">PEC *</label>
              <InputText id="pec" v-model="company.pec" class="w-full" type="email" placeholder="azienda@pec.it" />
            </div>
            <div class="form-field">
              <label for="website">Sito Web</label>
              <InputText id="website" v-model="company.website" class="w-full" placeholder="https://" />
            </div>
          </div>
        </div>

        <div class="form-actions">
          <Button label="Salva Modifiche" icon="pi pi-save" @click="saveCompanySettings" :loading="saving" />
        </div>
      </TabPanel>

      <!-- TAB: Fatturazione Elettronica -->
      <TabPanel header="Fatturazione Elettronica">
        <div class="settings-section">
          <h3 class="section-title">Configurazione SDI</h3>
          <div class="info-banner info-banner--info">
            <i class="pi pi-info-circle"></i>
            <div>
              <strong>Sistema di Interscambio (SDI)</strong>
              <p>Configura i parametri per l'invio delle fatture elettroniche tramite il Sistema di Interscambio dell'Agenzia delle Entrate.</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label for="sdiCode">Codice Destinatario SDI</label>
              <InputText id="sdiCode" v-model="sdi.recipientCode" class="w-full" maxlength="7" placeholder="0000000" />
              <small class="field-hint">7 caratteri alfanumerici per fatture B2B</small>
            </div>
            <div class="form-field">
              <label for="sdiProvider">Provider SDI</label>
              <Dropdown
                id="sdiProvider"
                v-model="sdi.provider"
                :options="sdiProviders"
                optionLabel="name"
                optionValue="code"
                class="w-full"
                placeholder="Seleziona provider"
              />
            </div>
          </div>
        </div>

        <div class="settings-section" v-if="sdi.provider === 'aruba'">
          <h3 class="section-title">Credenziali Aruba</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="arubaUser">Username Aruba</label>
              <InputText id="arubaUser" v-model="sdi.aruba.username" class="w-full" />
            </div>
            <div class="form-field">
              <label for="arubaPassword">Password Aruba</label>
              <Password id="arubaPassword" v-model="sdi.aruba.password" class="w-full" :feedback="false" toggleMask />
            </div>
            <div class="form-field form-field--wide">
              <label for="arubaEndpoint">Endpoint API</label>
              <InputText id="arubaEndpoint" v-model="sdi.aruba.endpoint" class="w-full" placeholder="https://ws.fatturazioneelettronica.aruba.it" />
            </div>
          </div>
          <div class="form-actions">
            <Button label="Test Connessione" icon="pi pi-check-circle" severity="secondary" @click="testSdiConnection" :loading="testingConnection" />
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Regime Fiscale</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="taxRegime">Regime Fiscale *</label>
              <Dropdown
                id="taxRegime"
                v-model="sdi.taxRegime"
                :options="taxRegimes"
                optionLabel="name"
                optionValue="code"
                class="w-full"
              />
            </div>
            <div class="form-field">
              <label for="defaultVat">Aliquota IVA Default</label>
              <Dropdown
                id="defaultVat"
                v-model="sdi.defaultVatRate"
                :options="vatRates"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Numerazione Fatture</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="invoicePrefix">Prefisso Fatture</label>
              <InputText id="invoicePrefix" v-model="sdi.invoicePrefix" class="w-full" placeholder="FT" />
            </div>
            <div class="form-field">
              <label for="invoiceNextNumber">Prossimo Numero</label>
              <InputNumber id="invoiceNextNumber" v-model="sdi.invoiceNextNumber" class="w-full" :min="1" />
            </div>
            <div class="form-field">
              <label for="invoiceYearReset">Reset Annuale</label>
              <InputSwitch id="invoiceYearReset" v-model="sdi.invoiceYearReset" />
            </div>
          </div>
          <div class="preview-box">
            <span class="preview-label">Anteprima prossima fattura:</span>
            <span class="preview-value">{{ invoicePreview }}</span>
          </div>
        </div>

        <div class="form-actions">
          <Button label="Salva Configurazione SDI" icon="pi pi-save" @click="saveSdiSettings" :loading="saving" />
        </div>
      </TabPanel>

      <!-- TAB: Banca -->
      <TabPanel header="Coordinate Bancarie">
        <div class="settings-section">
          <h3 class="section-title">Conto Bancario Principale</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="bankName">Nome Banca</label>
              <InputText id="bankName" v-model="bank.bankName" class="w-full" />
            </div>
            <div class="form-field form-field--wide">
              <label for="iban">IBAN *</label>
              <InputText id="iban" v-model="bank.iban" class="w-full" placeholder="IT60X0542811101000000123456" />
            </div>
            <div class="form-field">
              <label for="swift">BIC/SWIFT</label>
              <InputText id="swift" v-model="bank.swift" class="w-full" placeholder="UNCRITMMXXX" />
            </div>
            <div class="form-field">
              <label for="accountHolder">Intestatario</label>
              <InputText id="accountHolder" v-model="bank.accountHolder" class="w-full" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Termini di Pagamento Default</h3>
          <div class="form-grid">
            <div class="form-field">
              <label for="defaultPaymentTerms">Giorni Pagamento</label>
              <Dropdown
                id="defaultPaymentTerms"
                v-model="bank.defaultPaymentDays"
                :options="paymentTermsOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>
            <div class="form-field">
              <label for="defaultPaymentMethod">Metodo Pagamento</label>
              <Dropdown
                id="defaultPaymentMethod"
                v-model="bank.defaultPaymentMethod"
                :options="paymentMethods"
                optionLabel="name"
                optionValue="code"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <div class="form-actions">
          <Button label="Salva Coordinate Bancarie" icon="pi pi-save" @click="saveBankSettings" :loading="saving" />
        </div>
      </TabPanel>

      <!-- TAB: Logo e Branding -->
      <TabPanel header="Logo e Branding">
        <div class="settings-section">
          <h3 class="section-title">Logo Aziendale</h3>
          <div class="logo-upload-area">
            <div class="current-logo" v-if="branding.logoUrl">
              <img :src="branding.logoUrl" alt="Logo aziendale" />
              <Button icon="pi pi-trash" severity="danger" text rounded @click="removeLogo" />
            </div>
            <div class="upload-placeholder" v-else>
              <i class="pi pi-image"></i>
              <span>Nessun logo caricato</span>
            </div>
            <FileUpload
              mode="basic"
              accept="image/*"
              :maxFileSize="2000000"
              chooseLabel="Carica Logo"
              @select="onLogoSelect"
              class="logo-uploader"
            />
            <small class="field-hint">Formato consigliato: PNG o SVG, max 2MB</small>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Testi Documenti</h3>
          <div class="form-grid">
            <div class="form-field form-field--full">
              <label for="invoiceNotes">Note Standard Fattura</label>
              <Textarea id="invoiceNotes" v-model="branding.invoiceNotes" rows="3" class="w-full" placeholder="Note che appariranno su tutte le fatture..." />
            </div>
            <div class="form-field form-field--full">
              <label for="ddtNotes">Note Standard DDT</label>
              <Textarea id="ddtNotes" v-model="branding.ddtNotes" rows="3" class="w-full" placeholder="Note che appariranno su tutti i DDT..." />
            </div>
            <div class="form-field form-field--full">
              <label for="footerText">Piede Documento</label>
              <Textarea id="footerText" v-model="branding.footerText" rows="2" class="w-full" placeholder="Testo a piè di pagina documenti..." />
            </div>
          </div>
        </div>

        <div class="form-actions">
          <Button label="Salva Branding" icon="pi pi-save" @click="saveBrandingSettings" :loading="saving" />
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import InputSwitch from 'primevue/inputswitch';
import Dropdown from 'primevue/dropdown';
import Password from 'primevue/password';
import Textarea from 'primevue/textarea';
import FileUpload from 'primevue/fileupload';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import apiService from '../services/api.service';

const toast = useToast();
const activeTab = ref(0);
const saving = ref(false);
const testingConnection = ref(false);

// Company data
const company = ref({
  businessName: '',
  tradeName: '',
  vatNumber: '',
  fiscalCode: '',
  reaNumber: '',
  shareCapital: null as number | null,
  address: {
    street: '',
    city: '',
    province: '',
    zip: '',
    country: 'IT',
  },
  phone: '',
  email: '',
  pec: '',
  website: '',
});

// SDI configuration
const sdi = ref({
  recipientCode: '0000000',
  provider: '',
  aruba: {
    username: '',
    password: '',
    endpoint: 'https://ws.fatturazioneelettronica.aruba.it',
  },
  taxRegime: 'RF01',
  defaultVatRate: 22,
  invoicePrefix: 'FT',
  invoiceNextNumber: 1,
  invoiceYearReset: true,
});

// Bank data
const bank = ref({
  bankName: '',
  iban: '',
  swift: '',
  accountHolder: '',
  defaultPaymentDays: 30,
  defaultPaymentMethod: 'MP05',
});

// Branding
const branding = ref({
  logoUrl: '',
  invoiceNotes: '',
  ddtNotes: '',
  footerText: '',
});

// Options
const countries = [
  { name: 'Italia', code: 'IT' },
  { name: 'Germania', code: 'DE' },
  { name: 'Francia', code: 'FR' },
  { name: 'Spagna', code: 'ES' },
  { name: 'Regno Unito', code: 'GB' },
];

const sdiProviders = [
  { name: 'Aruba', code: 'aruba' },
  { name: 'Fatture in Cloud', code: 'fattureincloud' },
  { name: 'Manuale', code: 'manual' },
];

const taxRegimes = [
  { name: 'RF01 - Ordinario', code: 'RF01' },
  { name: 'RF02 - Contribuenti minimi', code: 'RF02' },
  { name: 'RF04 - Agricoltura', code: 'RF04' },
  { name: 'RF05 - Pesca', code: 'RF05' },
  { name: 'RF17 - Agenzie viaggi', code: 'RF17' },
  { name: 'RF19 - Forfettario', code: 'RF19' },
];

const vatRates = [
  { label: '22% - Ordinaria', value: 22 },
  { label: '10% - Ridotta', value: 10 },
  { label: '4% - Minima', value: 4 },
  { label: '0% - Esente', value: 0 },
];

const paymentTermsOptions = [
  { label: 'Immediato', value: 0 },
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
  { label: '90 giorni', value: 90 },
  { label: '120 giorni', value: 120 },
];

const paymentMethods = [
  { name: 'MP01 - Contanti', code: 'MP01' },
  { name: 'MP02 - Assegno', code: 'MP02' },
  { name: 'MP05 - Bonifico', code: 'MP05' },
  { name: 'MP08 - Carta di pagamento', code: 'MP08' },
  { name: 'MP12 - RIBA', code: 'MP12' },
  { name: 'MP19 - SEPA DD', code: 'MP19' },
];

// Computed
const invoicePreview = computed(() => {
  const year = new Date().getFullYear();
  const num = String(sdi.value.invoiceNextNumber).padStart(5, '0');
  return `${sdi.value.invoicePrefix}${year}/${num}`;
});

// Methods
const loadSettings = async () => {
  try {
    const response = await apiService.get('/company-settings');
    if (response.data) {
      const data = response.data;
      if (data.company) Object.assign(company.value, data.company);
      if (data.sdi) Object.assign(sdi.value, data.sdi);
      if (data.bank) Object.assign(bank.value, data.bank);
      if (data.branding) Object.assign(branding.value, data.branding);
    }
  } catch (error) {
    // Settings might not exist yet, that's OK
    console.log('No existing settings found');
  }
};

const saveCompanySettings = async () => {
  saving.value = true;
  try {
    await apiService.put('/company-settings/company', company.value);
    toast.add({ severity: 'success', summary: 'Salvato', detail: 'Dati aziendali aggiornati', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile salvare i dati', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const saveSdiSettings = async () => {
  saving.value = true;
  try {
    await apiService.put('/company-settings/sdi', sdi.value);
    toast.add({ severity: 'success', summary: 'Salvato', detail: 'Configurazione SDI aggiornata', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile salvare la configurazione', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const saveBankSettings = async () => {
  saving.value = true;
  try {
    await apiService.put('/company-settings/bank', bank.value);
    toast.add({ severity: 'success', summary: 'Salvato', detail: 'Coordinate bancarie aggiornate', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile salvare i dati', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const saveBrandingSettings = async () => {
  saving.value = true;
  try {
    await apiService.put('/company-settings/branding', branding.value);
    toast.add({ severity: 'success', summary: 'Salvato', detail: 'Branding aggiornato', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile salvare i dati', life: 3000 });
  } finally {
    saving.value = false;
  }
};

const testSdiConnection = async () => {
  testingConnection.value = true;
  try {
    await apiService.post('/sdi/test-connection', sdi.value.aruba);
    toast.add({ severity: 'success', summary: 'Connessione OK', detail: 'Connessione al provider SDI riuscita', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore Connessione', detail: 'Impossibile connettersi al provider SDI', life: 5000 });
  } finally {
    testingConnection.value = false;
  }
};

const onLogoSelect = async (event: any) => {
  const file = event.files[0];
  if (file) {
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await apiService.post('/company-settings/logo', formData);
      branding.value.logoUrl = response.data.url;
      toast.add({ severity: 'success', summary: 'Logo Caricato', detail: 'Logo aziendale aggiornato', life: 3000 });
    } catch (error) {
      toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile caricare il logo', life: 3000 });
    }
  }
};

const removeLogo = async () => {
  try {
    await apiService.delete('/company-settings/logo');
    branding.value.logoUrl = '';
    toast.add({ severity: 'success', summary: 'Rimosso', detail: 'Logo rimosso', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Errore', detail: 'Impossibile rimuovere il logo', life: 3000 });
  }
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.company-settings-page {
  max-width: 1200px;
}

.settings-tabs {
  margin-top: var(--space-6);
}

.settings-section {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-5) 0;
  padding-bottom: var(--space-3);
  border-bottom: var(--border-width) solid var(--border-color-light);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-5);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field--wide {
  grid-column: span 2;
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-4);
}

.info-banner {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--space-5);
}

.info-banner--info {
  background: var(--color-blue-50);
  border: 1px solid var(--color-blue-200);
}

.info-banner i {
  font-size: 1.5rem;
  color: var(--color-blue-600);
  flex-shrink: 0;
}

.info-banner strong {
  display: block;
  color: var(--color-blue-800);
  margin-bottom: var(--space-1);
}

.info-banner p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-blue-700);
}

.preview-box {
  background: var(--color-gray-50);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  margin-top: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.preview-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.preview-value {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-primary-600);
  font-family: monospace;
}

.logo-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--color-gray-50);
  border: 2px dashed var(--border-color);
  border-radius: var(--border-radius-lg);
}

.current-logo {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.current-logo img {
  max-width: 200px;
  max-height: 80px;
  object-fit: contain;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-gray-400);
}

.upload-placeholder i {
  font-size: 3rem;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-field--wide {
    grid-column: span 1;
  }
}
</style>
