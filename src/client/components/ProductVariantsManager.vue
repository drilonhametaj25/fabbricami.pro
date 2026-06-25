<template>
  <div class="variants-manager">
    <!-- Header -->
    <div class="variants-header">
      <div class="header-info">
        <h4>Varianti Prodotto</h4>
        <Badge :value="variants.length" severity="info" v-if="variants.length > 0" />
      </div>
      <Button
        icon="pi pi-plus"
        label="Nuova Variante"
        @click="openCreateDialog"
      />
    </div>

    <!-- Info su Attributi -->
    <div class="attributes-info" v-if="allAttributes.length > 0">
      <span class="label">Attributi utilizzati:</span>
      <Tag v-for="attr in allAttributes" :key="attr" :value="attr" severity="info" class="mr-2" />
    </div>

    <!-- Variants Table -->
    <DataTable
      v-if="variants.length > 0"
      :value="variants"
      :loading="loading"
      stripedRows
      class="variants-table"
    >
      <Column header="Immagine" style="width: 80px">
        <template #body="{ data }">
          <img
            v-if="data.mainImageUrl"
            :src="data.mainImageUrl"
            :alt="data.name"
            class="variant-thumb"
            @error="onImageError($event)"
          />
          <div v-else class="no-image">
            <i class="pi pi-image"></i>
          </div>
        </template>
      </Column>

      <Column field="sku" header="SKU" sortable style="width: 150px" />

      <Column field="name" header="Nome" sortable />

      <Column header="Attributi">
        <template #body="{ data }">
          <div class="attributes-list">
            <Tag
              v-for="(value, key) in data.attributes"
              :key="key"
              :value="`${key}: ${value}`"
              severity="secondary"
              class="mr-1 mb-1"
            />
          </div>
        </template>
      </Column>

      <Column header="Prezzo" style="width: 120px">
        <template #body="{ data }">
          <span v-if="data.webPrice">{{ formatCurrency(data.webPrice) }}</span>
          <span v-else-if="data.priceDelta !== 0" class="price-delta">
            {{ data.priceDelta > 0 ? '+' : '' }}{{ formatCurrency(data.priceDelta) }}
          </span>
          <span v-else class="text-muted">Base</span>
        </template>
      </Column>

      <Column header="Stock" style="width: 100px">
        <template #body="{ data }">
          <span :class="getStockClass(data)">{{ getTotalStock(data) }}</span>
        </template>
      </Column>

      <Column header="Attivo" style="width: 80px">
        <template #body="{ data }">
          <Tag :value="data.isActive ? 'Si' : 'No'" :severity="data.isActive ? 'success' : 'danger'" />
        </template>
      </Column>

      <Column header="Azioni" style="width: 120px">
        <template #body="{ data }">
          <div class="action-buttons">
            <Button
              icon="pi pi-pencil"
              class="p-button-rounded p-button-sm p-button-text"
              v-tooltip.top="'Modifica'"
              @click="editVariant(data)"
            />
            <Button
              icon="pi pi-box"
              class="p-button-rounded p-button-sm p-button-text p-button-info"
              v-tooltip.top="'Giacenze'"
              @click="manageInventory(data)"
            />
            <Button
              icon="pi pi-trash"
              class="p-button-rounded p-button-sm p-button-text p-button-danger"
              v-tooltip.top="'Elimina'"
              @click="confirmDelete(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <i class="pi pi-th-large"></i>
      <p>Nessuna variante</p>
      <small>Aggiungi varianti per differenziare il prodotto (es. colore, taglia)</small>
      <Button
        icon="pi pi-plus"
        label="Crea Prima Variante"
        class="p-button-outlined mt-3"
        @click="openCreateDialog"
      />
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="isEditing ? 'Modifica Variante' : 'Nuova Variante'"
      :modal="true"
      :style="{ width: '700px', maxWidth: '95vw' }"
      :appendTo="'body'"
      @hide="onDialogHide"
    >
      <div class="variant-form">
        <!-- Basic Info -->
        <div class="form-section">
          <h5>Informazioni Base</h5>
          <div class="form-grid">
            <div class="field">
              <label>SKU *</label>
              <InputText v-model="form.sku" class="w-full" :disabled="isEditing" />
            </div>
            <div class="field">
              <label>Nome *</label>
              <InputText v-model="form.name" class="w-full" />
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Barcode</label>
              <InputText v-model="form.barcode" class="w-full" />
            </div>
            <div class="field">
              <label>
                <Checkbox v-model="form.isActive" :binary="true" class="mr-2" />
                Variante Attiva
              </label>
            </div>
          </div>
        </div>

        <!-- Attributes -->
        <div class="form-section">
          <h5>Attributi</h5>
          <p class="section-hint">
            Scegli un attributo già esistente (es. Colore → Rosso) dal menù a tendina,
            oppure scrivine uno nuovo. Attributi con lo stesso nome vengono raggruppati
            automaticamente (come su WooCommerce).
          </p>
          <div class="attributes-editor">
            <div
              v-for="(attr, index) in form.attributesList"
              :key="index"
              class="attribute-row"
            >
              <AutoComplete
                v-model="attr.key"
                :suggestions="attrNameSuggestions"
                @complete="searchAttrNames($event)"
                dropdown
                completeOnFocus
                placeholder="Nome (es. Colore)"
                class="attr-key"
                inputClass="w-full"
              />
              <AutoComplete
                v-model="attr.value"
                :suggestions="attrValueSuggestions"
                @complete="searchAttrValues($event, attr.key)"
                dropdown
                completeOnFocus
                placeholder="Valore (es. Rosso)"
                class="attr-value"
                inputClass="w-full"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-rounded p-button-sm p-button-text p-button-danger"
                @click="removeAttribute(index)"
              />
            </div>
            <Button
              icon="pi pi-plus"
              label="Aggiungi Attributo"
              class="p-button-outlined p-button-sm"
              @click="addAttribute"
            />
          </div>
        </div>

        <!-- Pricing -->
        <div class="form-section">
          <h5>Prezzi</h5>
          <div class="form-grid">
            <div class="field">
              <label>Prezzo specifico variante</label>
              <InputNumber
                v-model="form.webPrice"
                mode="currency"
                currency="EUR"
                locale="it-IT"
                class="w-full"
                :highlightOnFocus="true"
                placeholder="es. 29,90"
              />
              <small>Prezzo di vendita di questa variante. Lascia vuoto per usare il prezzo base del prodotto.</small>
            </div>
            <div class="field">
              <label>Prezzo aggiuntivo (+/-)</label>
              <InputNumber
                v-model="form.priceDelta"
                mode="currency"
                currency="EUR"
                locale="it-IT"
                class="w-full"
                :highlightOnFocus="true"
                placeholder="0,00"
              />
              <small>Quanto aggiungere (o togliere) al prezzo base. Lascia vuoto se il prezzo è uguale.</small>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Costo aggiuntivo (+/-)</label>
              <InputNumber
                v-model="form.costDelta"
                mode="currency"
                currency="EUR"
                locale="it-IT"
                class="w-full"
                :highlightOnFocus="true"
                placeholder="0,00"
              />
              <small>Maggiore (o minore) costo di questa variante rispetto al costo base. Lascia vuoto se uguale.</small>
            </div>
            <div class="field">
              <label>
                <Checkbox v-model="form.webActive" :binary="true" class="mr-2" />
                Pubblicato su Web
              </label>
            </div>
          </div>
        </div>

        <!-- Giacenza variante (campo rapido, magazzino Web) -->
        <div class="form-section">
          <h5>Giacenza</h5>
          <div class="form-grid">
            <div class="field">
              <label>Quantità disponibile (Web)</label>
              <InputNumber
                v-model="form.stockWeb"
                :min="0"
                showButtons
                class="w-full"
                :highlightOnFocus="true"
                placeholder="0"
              />
              <small>Quantità a magazzino per l'e-commerce. Per gli altri magazzini usa il pulsante "Giacenze" nella lista varianti.</small>
            </div>
            <div class="field"></div>
          </div>
        </div>

        <!-- Physical -->
        <div class="form-section">
          <h5>Caratteristiche Fisiche <span class="optional-hint">(facoltative)</span></h5>
          <div class="field">
            <label>Peso (kg)</label>
            <InputNumber
              v-model="form.weight"
              :minFractionDigits="0"
              :maxFractionDigits="3"
              class="w-full"
              :highlightOnFocus="true"
              placeholder="0,000"
            />
          </div>
          <div class="field dimensions-field">
            <label>Dimensioni (cm) — Larghezza × Altezza × Profondità</label>
            <div class="dimensions-grid">
              <InputNumber v-model="form.width" placeholder="Largh." :min="0" class="w-full" :highlightOnFocus="true" />
              <InputNumber v-model="form.height" placeholder="Alt." :min="0" class="w-full" :highlightOnFocus="true" />
              <InputNumber v-model="form.depth" placeholder="Prof." :min="0" class="w-full" :highlightOnFocus="true" />
            </div>
          </div>
          <small>Le misure sono facoltative: lascia vuoto se non disponibili (es. varianti importate da WooCommerce).</small>
        </div>

        <!-- Image -->
        <div class="form-section">
          <h5>Immagine</h5>
          <p class="section-hint">
            Trascina qui un'immagine o caricala dal computer: viene salvata sul server del
            gestionale e sincronizzata su WooCommerce alla pubblicazione. In alternativa incolla un URL.
          </p>
          <div class="image-section">
            <div class="field flex-1">
              <div
                class="variant-dropzone"
                :class="{ 'drag-active': dragActive }"
                @dragover.prevent="dragActive = true"
                @dragleave.prevent="dragActive = false"
                @drop.prevent="onImageDrop"
              >
                <FileUpload
                  mode="basic"
                  accept="image/*"
                  :maxFileSize="10000000"
                  :auto="true"
                  customUpload
                  @uploader="onImageUploader"
                  chooseLabel="Scegli immagine"
                  :disabled="uploadingImage"
                />
                <span class="dropzone-hint">
                  <i class="pi pi-cloud-upload"></i> Trascina qui l'immagine
                </span>
                <i v-if="uploadingImage" class="pi pi-spin pi-spinner upload-spinner"></i>
              </div>
              <label class="mt-1">oppure URL immagine</label>
              <InputText v-model="form.mainImageUrl" class="w-full" placeholder="https://..." />
            </div>
            <div class="image-preview" v-if="form.mainImageUrl">
              <img :src="resolveImageSrc(form.mainImageUrl)" alt="Preview" @error="onImageError($event)" />
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="form-section">
          <h5>Descrizione</h5>
          <Textarea v-model="form.webDescription" rows="3" class="w-full" placeholder="Descrizione specifica per questa variante..." />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="dialogVisible = false" />
        <Button
          :label="isEditing ? 'Aggiorna' : 'Crea'"
          icon="pi pi-check"
          @click="saveVariant"
          :loading="saving"
        />
      </template>
    </Dialog>

    <!-- Inventory Dialog -->
    <Dialog
      v-model:visible="inventoryDialogVisible"
      :header="`Giacenze - ${selectedVariant?.name || ''}`"
      :modal="true"
      :style="{ width: '600px', maxWidth: '95vw' }"
      :appendTo="'body'"
    >
      <ProductInventoryManager
        v-if="selectedVariant"
        :product-id="productId"
        :variant-id="selectedVariant.id"
      />
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import AutoComplete from 'primevue/autocomplete';
import FileUpload from 'primevue/fileupload';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import ProductInventoryManager from './ProductInventoryManager.vue';
import api from '../services/api.service';

interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  barcode?: string;
  costDelta: number;
  priceDelta: number;
  weight?: number;
  dimensions?: { width?: number; height?: number; depth?: number };
  webPrice?: number;
  webActive: boolean;
  mainImageUrl?: string;
  webDescription?: string;
  isActive: boolean;
  inventory?: any[];
}

interface Props {
  productId: string;
  productSku: string;
  productPrice: number;
}

const props = defineProps<Props>();
const confirm = useConfirm();
const toast = useToast();

const variants = ref<ProductVariant[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const inventoryDialogVisible = ref(false);
const isEditing = ref(false);
const selectedVariant = ref<ProductVariant | null>(null);

const getDefaultForm = () => ({
  id: '',
  sku: '',
  name: '',
  barcode: '',
  costDelta: 0,
  priceDelta: 0,
  weight: null as number | null,
  width: null as number | null,
  height: null as number | null,
  depth: null as number | null,
  webPrice: null as number | null,
  webActive: true,
  stockWeb: 0 as number | null,
  mainImageUrl: '',
  webDescription: '',
  isActive: true,
  attributesList: [{ key: '', value: '' }] as Array<{ key: string; value: string }>,
});

const form = reactive(getDefaultForm());

// Computed: all unique attribute keys across variants
const allAttributes = computed(() => {
  const attrs = new Set<string>();
  variants.value.forEach(v => {
    Object.keys(v.attributes || {}).forEach(k => attrs.add(k));
  });
  return Array.from(attrs);
});

const loadVariants = async () => {
  if (!props.productId) return;

  try {
    loading.value = true;
    const response = await api.get(`/products/${props.productId}/variants`);
    if (response.success) {
      variants.value = response.data || [];
    }
  } catch (error) {
    console.error('Error loading variants:', error);
  } finally {
    loading.value = false;
  }
};

// ── Attributi: suggerimenti dagli esistenti (WooCommerce + varianti già create) ──
const attributeSuggestions = ref<Array<{ name: string; values: string[] }>>([]);
const attrNameSuggestions = ref<string[]>([]);
const attrValueSuggestions = ref<string[]>([]);

const loadAttributeSuggestions = async () => {
  try {
    const response = await api.get('/products/variant-attributes/suggestions');
    if (response.success) {
      attributeSuggestions.value = response.data || [];
    }
  } catch (error) {
    // Non bloccante: l'utente può comunque digitare attributi liberi.
    console.warn('Impossibile caricare i suggerimenti attributi:', error);
  }
};

const searchAttrNames = (event: { query: string }) => {
  const q = (event.query || '').toLowerCase();
  const names = attributeSuggestions.value.map(a => a.name);
  attrNameSuggestions.value = q
    ? names.filter(n => n.toLowerCase().includes(q))
    : names;
};

const searchAttrValues = (event: { query: string }, key: string) => {
  const q = (event.query || '').toLowerCase();
  const match = attributeSuggestions.value.find(
    a => a.name.toLowerCase() === (key || '').toLowerCase()
  );
  const values = match ? match.values : [];
  attrValueSuggestions.value = q
    ? values.filter(v => v.toLowerCase().includes(q))
    : values;
};

// ── Immagine variante: upload sul server ERP + drag & drop ──
const dragActive = ref(false);
const uploadingImage = ref(false);

const resolveImageSrc = (src: string) => {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace('/api/v1', '')
    || 'http://localhost:3000';
  return `${base}${src}`;
};

const uploadVariantImage = async (file: File) => {
  if (!file || !props.productId) return;
  try {
    uploadingImage.value = true;
    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('token');
    const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api/v1';
    const apiBase = baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;

    const response = await fetch(`${apiBase}/products/${props.productId}/images/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await response.json();

    if (result.success && result.data?.src) {
      form.mainImageUrl = result.data.src;
      toast.add({ severity: 'success', summary: 'Immagine caricata', life: 2500 });
    } else {
      throw new Error(result.error || 'Errore durante il caricamento');
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore upload',
      detail: error.message || 'Impossibile caricare l\'immagine',
      life: 4000,
    });
  } finally {
    uploadingImage.value = false;
    dragActive.value = false;
  }
};

const onImageUploader = (event: any) => {
  const file = event?.files?.[0];
  if (file) uploadVariantImage(file);
};

const onImageDrop = (event: DragEvent) => {
  dragActive.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) uploadVariantImage(file);
};

const openCreateDialog = () => {
  isEditing.value = false;
  Object.assign(form, getDefaultForm());
  // Suggerisci SKU basato sul prodotto
  form.sku = `${props.productSku}-`;
  dialogVisible.value = true;
};

const onDialogHide = () => {
  // Reset completo al close per evitare residui (cause del bug "duplicato")
  isEditing.value = false;
  selectedVariant.value = null;
  Object.assign(form, getDefaultForm());
};

const editVariant = (variant: ProductVariant) => {
  isEditing.value = true;
  Object.assign(form, {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    barcode: variant.barcode || '',
    costDelta: Number(variant.costDelta) || 0,
    priceDelta: Number(variant.priceDelta) || 0,
    weight: variant.weight ? Number(variant.weight) : null,
    width: variant.dimensions?.width || null,
    height: variant.dimensions?.height || null,
    depth: variant.dimensions?.depth || null,
    webPrice: variant.webPrice ? Number(variant.webPrice) : null,
    webActive: variant.webActive,
    stockWeb: getWebStock(variant),
    mainImageUrl: variant.mainImageUrl || '',
    webDescription: variant.webDescription || '',
    isActive: variant.isActive,
    attributesList: Object.entries(variant.attributes || {}).map(([key, value]) => ({
      key,
      value: String(value),
    })),
  });

  if (form.attributesList.length === 0) {
    form.attributesList = [{ key: '', value: '' }];
  }

  dialogVisible.value = true;
};

const addAttribute = () => {
  form.attributesList.push({ key: '', value: '' });
};

const removeAttribute = (index: number) => {
  form.attributesList.splice(index, 1);
  if (form.attributesList.length === 0) {
    form.attributesList = [{ key: '', value: '' }];
  }
};

// Validazione inline pre-submit: ritorna l'elenco dei campi mancanti così
// l'utente capisce subito cosa serve (niente più "errore in codice" opaco).
const getMissingFields = (): string[] => {
  const missing: string[] = [];
  if (!form.sku.trim()) missing.push('SKU');
  if (!form.name.trim()) missing.push('Nome');
  return missing;
};

const saveVariant = async () => {
  // Validation chiara: misure e attributi NON sono obbligatori.
  const missing = getMissingFields();
  if (missing.length > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Campi obbligatori mancanti',
      detail: `Compila: ${missing.join(', ')}`,
      life: 4000,
    });
    return;
  }

  // Build attributes object (solo coppie complete)
  const attributes: Record<string, string> = {};
  form.attributesList.forEach(attr => {
    if (attr.key?.trim() && attr.value?.trim()) {
      attributes[attr.key.trim()] = attr.value.trim();
    }
  });

  // Dimensioni: invia solo i valori effettivamente compilati (facoltative)
  const hasDimensions = form.width != null || form.height != null || form.depth != null;
  const dimensions = hasDimensions
    ? {
        ...(form.width != null ? { width: form.width } : {}),
        ...(form.height != null ? { height: form.height } : {}),
        ...(form.depth != null ? { depth: form.depth } : {}),
      }
    : undefined;

  const data = {
    sku: form.sku,
    name: form.name,
    attributes,
    barcode: form.barcode || undefined,
    costDelta: form.costDelta,
    priceDelta: form.priceDelta,
    weight: form.weight,
    dimensions,
    webPrice: form.webPrice,
    webActive: form.webActive,
    mainImageUrl: form.mainImageUrl || undefined,
    webDescription: form.webDescription || undefined,
    isActive: form.isActive,
  };

  try {
    saving.value = true;
    let response;
    let variantId = form.id;

    if (isEditing.value) {
      // Backend espone PATCH /products/variants/:variantId (route flat).
      response = await api.patch(`/products/variants/${form.id}`, data);
    } else {
      response = await api.post(`/products/${props.productId}/variants`, data);
      variantId = response?.data?.id || '';
    }

    // Salva la giacenza rapida (magazzino Web) se valorizzata
    if (variantId && form.stockWeb != null) {
      await saveVariantStock(variantId, Number(form.stockWeb) || 0);
    }

    // Ricarica la lista comunque: garantisce sync UI ↔ DB.
    await loadVariants();

    if (response?.success !== false) {
      dialogVisible.value = false;
      toast.add({
        severity: 'success',
        summary: isEditing.value ? 'Variante aggiornata' : 'Variante creata',
        life: 3000,
      });
    }
  } catch (error: any) {
    // Il backend ora restituisce un messaggio leggibile in italiano; qui lo
    // mostriamo, con fallback amichevole se l'errore non avesse messaggio.
    toast.add({
      severity: 'error',
      summary: 'Impossibile salvare la variante',
      detail: error?.message || 'Controlla i dati inseriti e riprova.',
      life: 5000,
    });
    try { await loadVariants(); } catch (_) { /* noop */ }
  } finally {
    saving.value = false;
  }
};

// Salva la quantità della variante sul magazzino Web (location WEB) tramite
// l'endpoint inventario varianti esistente.
const saveVariantStock = async (variantId: string, quantity: number) => {
  await api.put(`/products/${props.productId}/variants/${variantId}/inventory`, {
    items: [{ location: 'WEB', quantity, reservedQuantity: 0 }],
  });
};

const getWebStock = (variant: ProductVariant): number => {
  const web = (variant.inventory || []).find((i: any) => i.location === 'WEB');
  return web ? Number(web.quantity) || 0 : 0;
};

const confirmDelete = (variant: ProductVariant) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare la variante "${variant.name}"?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteVariant(variant),
  });
};

const deleteVariant = async (variant: ProductVariant) => {
  try {
    const response = await api.delete(`/products/${props.productId}/variants/${variant.id}`);
    if (response.success) {
      variants.value = variants.value.filter(v => v.id !== variant.id);
      toast.add({
        severity: 'success',
        summary: 'Variante eliminata',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  }
};

const manageInventory = (variant: ProductVariant) => {
  selectedVariant.value = variant;
  inventoryDialogVisible.value = true;
};

const getTotalStock = (variant: ProductVariant) => {
  if (!variant.inventory || variant.inventory.length === 0) return 0;
  return variant.inventory.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
};

const getStockClass = (variant: ProductVariant) => {
  const stock = getTotalStock(variant);
  if (stock <= 0) return 'text-danger';
  if (stock < 10) return 'text-warning';
  return 'text-success';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZWVlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiIGZvbnQtc2l6ZT0iMTAiPk5vIEltZzwvdGV4dD48L3N2Zz4=';
};

watch(() => props.productId, () => {
  loadVariants();
}, { immediate: true });

onMounted(() => {
  loadAttributeSuggestions();
  if (props.productId) {
    loadVariants();
  }
});
</script>

<style scoped>
.variants-manager {
  padding: 1rem 0;
}

.variants-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-info h4 {
  margin: 0;
  color: #1e293b;
}

.attributes-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f1f5f9;
  border-radius: 6px;
}

.attributes-info .label {
  font-size: 0.85rem;
  color: #64748b;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mr-1 {
  margin-right: 0.25rem;
}

.mb-1 {
  margin-bottom: 0.25rem;
}

.mt-3 {
  margin-top: 1rem;
}

.variants-table {
  margin-top: 1rem;
}

.variant-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.no-image {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 6px;
  color: #9ca3af;
}

.attributes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.price-delta {
  color: #64748b;
  font-style: italic;
}

.text-muted {
  color: #9ca3af;
}

.text-success {
  color: #22c55e;
  font-weight: 600;
}

.text-warning {
  color: #f59e0b;
  font-weight: 600;
}

.text-danger {
  color: #ef4444;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #9ca3af;
  text-align: center;
  background: #f8fafc;
  border-radius: 8px;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #64748b;
}

/* Form Styles */
.variant-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.form-section h5 {
  margin: 0 0 1rem 0;
  color: #475569;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
}

.field small {
  color: #64748b;
  font-size: 0.75rem;
}

.attributes-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.attribute-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.attr-key {
  flex: 1;
}

.attr-value {
  flex: 1;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.dimensions-field {
  margin-top: 0.75rem;
}

.dimensions-grid :deep(.p-inputnumber) {
  width: 100%;
}

.optional-hint {
  font-size: 0.7rem;
  font-weight: 400;
  color: #94a3b8;
  text-transform: none;
  letter-spacing: 0;
}

.section-hint {
  margin: 0 0 0.75rem 0;
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.4;
}

.mt-1 {
  margin-top: 0.5rem;
}

/* Attributi AutoComplete a piena larghezza */
.attr-key :deep(.p-autocomplete),
.attr-value :deep(.p-autocomplete),
.attr-key :deep(.p-autocomplete-input),
.attr-value :deep(.p-autocomplete-input) {
  width: 100%;
}

/* Dropzone immagine variante */
.variant-dropzone {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  transition: all 0.15s ease;
}

.variant-dropzone.drag-active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.dropzone-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #64748b;
  font-size: 0.85rem;
}

.upload-spinner {
  color: #3b82f6;
}

.image-section {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.image-section .flex-1 {
  flex: 1;
}

.image-preview {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.w-full {
  width: 100%;
}
</style>
