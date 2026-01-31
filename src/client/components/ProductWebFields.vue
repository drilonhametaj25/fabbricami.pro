<template>
  <div class="product-web-fields">
    <!-- Toggle Principale -->
    <div class="web-toggle-section">
      <div class="toggle-card" :class="{ active: modelValue.webActive }">
        <div class="toggle-content">
          <div class="toggle-icon">
            <i class="pi pi-globe"></i>
          </div>
          <div class="toggle-info">
            <h3>Pubblica su Web</h3>
            <p>Attiva per sincronizzare questo prodotto con WooCommerce</p>
          </div>
        </div>
        <InputSwitch
          :modelValue="modelValue.webActive"
          @update:modelValue="updateField('webActive', $event)"
        />
      </div>
    </div>

    <!-- Campi Web (visibili solo se webActive) -->
    <div v-if="modelValue.webActive" class="web-fields-container">
      <!-- Prezzo Web -->
      <div class="field-group">
        <h4 class="section-title">
          <i class="pi pi-euro"></i>
          Prezzo Web
        </h4>
        <div class="field">
          <label for="webPrice">Prezzo Sito Web</label>
          <InputNumber
            id="webPrice"
            :modelValue="modelValue.webPrice"
            @update:modelValue="updateField('webPrice', $event)"
            mode="currency"
            currency="EUR"
            locale="it-IT"
            :minFractionDigits="2"
            placeholder="Lascia vuoto per usare il prezzo B2B"
            class="w-full"
          />
          <small class="field-hint">
            Se vuoto, usa il prezzo standard: {{ formatCurrency(productPrice) }}
          </small>
        </div>
      </div>

      <!-- Descrizioni -->
      <div class="field-group">
        <h4 class="section-title">
          <i class="pi pi-file-edit"></i>
          Contenuti Web
        </h4>

        <div class="field">
          <label for="webShortDescription">Descrizione Breve</label>
          <Textarea
            id="webShortDescription"
            :modelValue="modelValue.webShortDescription"
            @update:modelValue="updateField('webShortDescription', $event)"
            rows="3"
            placeholder="Descrizione breve per le liste prodotti (max 400 caratteri)"
            class="w-full"
            :maxlength="400"
          />
          <small class="field-hint">
            {{ (modelValue.webShortDescription || '').length }}/400 caratteri
          </small>
        </div>

        <div class="field">
          <label for="webDescription">Descrizione Completa</label>
          <Textarea
            id="webDescription"
            :modelValue="modelValue.webDescription"
            @update:modelValue="updateField('webDescription', $event)"
            rows="6"
            placeholder="Descrizione completa per la pagina prodotto"
            class="w-full"
          />
        </div>
      </div>

      <!-- SEO -->
      <div class="field-group">
        <h4 class="section-title">
          <i class="pi pi-search"></i>
          SEO
        </h4>

        <div class="field">
          <label for="webSlug">URL Slug</label>
          <InputText
            id="webSlug"
            :modelValue="modelValue.webSlug"
            @update:modelValue="updateField('webSlug', $event)"
            placeholder="es: maglietta-rossa-xl"
            class="w-full"
          />
          <small class="field-hint">
            URL: {{ siteUrl }}/product/{{ modelValue.webSlug || '[auto]' }}
          </small>
        </div>

        <div class="field">
          <label for="webMetaTitle">Meta Title</label>
          <InputText
            id="webMetaTitle"
            :modelValue="modelValue.webMetaTitle"
            @update:modelValue="updateField('webMetaTitle', $event)"
            placeholder="Titolo per motori di ricerca (max 60 caratteri)"
            class="w-full"
            :maxlength="60"
          />
          <small class="field-hint">
            {{ (modelValue.webMetaTitle || '').length }}/60 caratteri
          </small>
        </div>

        <div class="field">
          <label for="webMetaDescription">Meta Description</label>
          <Textarea
            id="webMetaDescription"
            :modelValue="modelValue.webMetaDescription"
            @update:modelValue="updateField('webMetaDescription', $event)"
            rows="2"
            placeholder="Descrizione per i risultati di ricerca (max 160 caratteri)"
            class="w-full"
            :maxlength="160"
          />
          <small class="field-hint">
            {{ (modelValue.webMetaDescription || '').length }}/160 caratteri
          </small>
        </div>
      </div>

      <!-- Attributi per Prodotti Variabili -->
      <div v-if="productType === 'WITH_VARIANTS'" class="field-group">
        <h4 class="section-title">
          <i class="pi pi-list"></i>
          Attributi Variazioni
        </h4>
        <p class="field-hint mb-3">
          Definisci gli attributi per le varianti del prodotto (es. Colore, Taglia)
        </p>

        <div v-for="(attr, index) in webAttributes" :key="index" class="attribute-row">
          <div class="attribute-name">
            <InputText
              v-model="attr.name"
              placeholder="Nome attributo"
              @update:modelValue="updateAttributes"
            />
          </div>
          <div class="attribute-options">
            <Chips
              v-model="attr.options"
              placeholder="Aggiungi opzioni..."
              @update:modelValue="updateAttributes"
            />
          </div>
          <Button
            icon="pi pi-trash"
            class="p-button-danger p-button-text"
            @click="removeAttribute(index)"
          />
        </div>

        <Button
          label="Aggiungi Attributo"
          icon="pi pi-plus"
          class="p-button-outlined p-button-sm"
          @click="addAttribute"
        />
      </div>

      <!-- File Download per Prodotti Digitali -->
      <div v-if="productType === 'DIGITAL'" class="field-group">
        <h4 class="section-title">
          <i class="pi pi-download"></i>
          File Scaricabili
        </h4>
        <p class="field-hint mb-3">
          Aggiungi i file che i clienti potranno scaricare dopo l'acquisto
        </p>

        <div v-for="(file, index) in downloadFiles" :key="index" class="download-file-row">
          <div class="file-name">
            <InputText
              v-model="file.name"
              placeholder="Nome file"
              @update:modelValue="updateDownloadFiles"
            />
          </div>
          <div class="file-url">
            <InputText
              v-model="file.url"
              placeholder="URL del file"
              @update:modelValue="updateDownloadFiles"
            />
          </div>
          <Button
            icon="pi pi-trash"
            class="p-button-danger p-button-text"
            @click="removeDownloadFile(index)"
          />
        </div>

        <Button
          label="Aggiungi File"
          icon="pi pi-plus"
          class="p-button-outlined p-button-sm"
          @click="addDownloadFile"
        />
      </div>

      <!-- Stato Sync -->
      <div v-if="syncStatus" class="sync-status">
        <div class="status-item">
          <span class="status-label">Stato Sync:</span>
          <Tag :severity="getSyncSeverity(syncStatus)" :value="syncStatus" />
        </div>
        <div v-if="lastSyncAt" class="status-item">
          <span class="status-label">Ultimo Sync:</span>
          <span>{{ formatDate(lastSyncAt) }}</span>
        </div>
        <div v-if="woocommerceId" class="status-item">
          <span class="status-label">WooCommerce ID:</span>
          <span class="woo-id">{{ woocommerceId }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import InputSwitch from 'primevue/inputswitch';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Chips from 'primevue/chips';
import Tag from 'primevue/tag';

interface WebFieldsValue {
  webActive: boolean;
  webPrice: number | null;
  webDescription: string | null;
  webShortDescription: string | null;
  webSlug: string | null;
  webMetaTitle: string | null;
  webMetaDescription: string | null;
  webAttributes: { name: string; options: string[] }[] | null;
  downloadFiles: { name: string; url: string }[] | null;
}

interface Props {
  modelValue: WebFieldsValue;
  productType?: 'SIMPLE' | 'WITH_VARIANTS' | 'DIGITAL' | 'RAW_MATERIAL';
  productPrice?: number;
  syncStatus?: string;
  lastSyncAt?: Date | string;
  woocommerceId?: number;
  siteUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  productType: 'SIMPLE',
  productPrice: 0,
  siteUrl: 'https://example.com',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: WebFieldsValue): void;
}>();

// Local state per attributi e file
const webAttributes = ref<{ name: string; options: string[] }[]>([]);
const downloadFiles = ref<{ name: string; url: string }[]>([]);

// Inizializza da props
watch(() => props.modelValue.webAttributes, (val) => {
  if (val && Array.isArray(val)) {
    webAttributes.value = [...val];
  }
}, { immediate: true });

watch(() => props.modelValue.downloadFiles, (val) => {
  if (val && Array.isArray(val)) {
    downloadFiles.value = [...val];
  }
}, { immediate: true });

// Update field
const updateField = (field: keyof WebFieldsValue, value: any) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: value,
  });
};

// Attributi
const addAttribute = () => {
  webAttributes.value.push({ name: '', options: [] });
  updateAttributes();
};

const removeAttribute = (index: number) => {
  webAttributes.value.splice(index, 1);
  updateAttributes();
};

const updateAttributes = () => {
  emit('update:modelValue', {
    ...props.modelValue,
    webAttributes: webAttributes.value.filter(a => a.name.trim()),
  });
};

// Download files
const addDownloadFile = () => {
  downloadFiles.value.push({ name: '', url: '' });
  updateDownloadFiles();
};

const removeDownloadFile = (index: number) => {
  downloadFiles.value.splice(index, 1);
  updateDownloadFiles();
};

const updateDownloadFiles = () => {
  emit('update:modelValue', {
    ...props.modelValue,
    downloadFiles: downloadFiles.value.filter(f => f.name.trim() && f.url.trim()),
  });
};

// Formatters
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
};

const getSyncSeverity = (status: string) => {
  switch (status) {
    case 'SYNCED': return 'success';
    case 'PENDING': return 'warning';
    case 'ERROR': return 'danger';
    default: return 'info';
  }
};
</script>

<style scoped>
.product-web-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Toggle Section */
.web-toggle-section {
  margin-bottom: var(--space-4);
}

.toggle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5);
  background: var(--color-gray-50);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  transition: all var(--transition-fast);
}

.toggle-card.active {
  background: linear-gradient(135deg, var(--color-primary-50) 0%, #f0f9ff 100%);
  border-color: var(--color-primary-300);
}

.toggle-content {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.toggle-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-100);
  border-radius: var(--border-radius-md);
  color: var(--color-primary-600);
  font-size: 1.5rem;
}

.toggle-card.active .toggle-icon {
  background: var(--color-primary-600);
  color: white;
}

.toggle-info h3 {
  margin: 0 0 var(--space-1) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-gray-900);
}

.toggle-info p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

/* Web Fields Container */
.web-fields-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Field Groups */
.field-group {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color-light);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-800);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-color-light);
}

.section-title i {
  color: var(--color-primary-600);
}

.field {
  margin-bottom: var(--space-4);
}

.field:last-child {
  margin-bottom: 0;
}

.field label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.field-hint {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

/* Attribute Row */
.attribute-row,
.download-file-row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.attribute-name,
.file-name {
  width: 150px;
  flex-shrink: 0;
}

.attribute-options,
.file-url {
  flex: 1;
}

/* Sync Status */
.sync-status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  margin-top: var(--space-4);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.woo-id {
  font-family: monospace;
  background: var(--color-gray-100);
  padding: 2px 8px;
  border-radius: var(--border-radius-sm);
}

/* Utilities */
.w-full {
  width: 100%;
}

.mb-3 {
  margin-bottom: var(--space-3);
}
</style>
