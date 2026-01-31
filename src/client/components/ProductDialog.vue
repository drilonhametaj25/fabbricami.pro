<template>
  <Dialog
    v-model:visible="visible"
    :header="isEdit ? 'Modifica Prodotto' : 'Nuovo Prodotto'"
    :modal="true"
    :style="{ width: '1100px', maxWidth: '95vw', maxHeight: '95vh' }"
    @hide="onHide"
  >
    <TabView v-model:activeIndex="activeTab">
      <!-- Tab Informazioni Base -->
      <TabPanel header="Informazioni Base">
        <div class="form-grid">
          <div class="field">
            <label for="sku">SKU *</label>
            <InputText id="sku" v-model="form.sku" :disabled="isEdit" class="w-full" />
          </div>

          <div class="field">
            <label for="name">Nome Prodotto *</label>
            <InputText id="name" v-model="form.name" class="w-full" />
          </div>

          <div class="field-group">
            <div class="field">
              <label for="category">Categoria</label>
              <Dropdown
                id="category"
                v-model="form.category"
                :options="categories"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleziona categoria"
                class="w-full"
                filter
                showClear
                :loading="loadingCategories"
              />
            </div>

            <div class="field">
              <label for="type">Tipo Prodotto</label>
              <Dropdown
                id="type"
                v-model="form.type"
                :options="productTypes"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleziona tipo"
                class="w-full"
              />
            </div>
          </div>

          <!-- Categorie WooCommerce (solo in modifica) -->
          <div class="field" v-if="isEdit && productCategories.length > 0">
            <label>Categorie WooCommerce</label>
            <div class="categories-display">
              <Tag
                v-for="cat in productCategories"
                :key="cat.id"
                :value="cat.name"
                :severity="cat.isPrimary ? 'success' : 'info'"
                class="mr-2 mb-2"
              />
            </div>
          </div>

          <div class="field">
            <label for="description">Descrizione</label>
            <Textarea id="description" v-model="form.description" rows="3" class="w-full" />
          </div>

          <div class="field-group">
            <div class="field">
              <label for="price">Prezzo (€) *</label>
              <InputNumber id="price" v-model="form.price" mode="currency" currency="EUR" locale="it-IT" class="w-full" />
            </div>

            <div class="field">
              <label for="cost">Costo (€) *</label>
              <InputNumber id="cost" v-model="form.cost" mode="currency" currency="EUR" locale="it-IT" class="w-full" />
            </div>
          </div>

          <div class="field-group">
            <div class="field">
              <label for="minStockLevel">Scorta Minima</label>
              <InputNumber id="minStockLevel" v-model="form.minStockLevel" class="w-full" />
            </div>

            <div class="field">
              <label for="reorderQuantity">Quantità Riordino</label>
              <InputNumber id="reorderQuantity" v-model="form.reorderQuantity" class="w-full" />
            </div>
          </div>

          <div class="field">
            <div class="flex align-items-center">
              <Checkbox id="isActive" v-model="form.isActive" :binary="true" />
              <label for="isActive" class="ml-2">Prodotto Attivo</label>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab Immagini -->
      <TabPanel header="Immagini">
        <ProductImagesManager v-if="product?.id" :product-id="product?.id" />
        <div v-else class="tab-placeholder">
          <i class="pi pi-info-circle"></i>
          <p>Salva il prodotto per gestire le immagini</p>
        </div>
      </TabPanel>

      <!-- Tab Giacenze -->
      <TabPanel header="Giacenze">
        <ProductInventoryManager v-if="product?.id" :product-id="product?.id" />
        <div v-else class="tab-placeholder">
          <i class="pi pi-info-circle"></i>
          <p>Salva il prodotto per gestire le giacenze</p>
        </div>
      </TabPanel>

      <!-- Tab Varianti -->
      <TabPanel>
        <template #header>
          <div class="tab-header-with-badge">
            <span>Varianti</span>
            <Badge v-if="product?.variants?.length > 0" :value="product.variants.length" severity="info" />
          </div>
        </template>
        <ProductVariantsManager
          v-if="product?.id"
          :product-id="product?.id"
          :product-sku="form.sku"
          :product-price="form.price"
        />
        <div v-else class="tab-placeholder">
          <i class="pi pi-info-circle"></i>
          <p>Salva il prodotto per gestire le varianti</p>
        </div>
      </TabPanel>

      <!-- Tab Web/E-commerce -->
      <TabPanel>
        <template #header>
          <div class="tab-header-with-badge">
            <span>Web / E-commerce</span>
            <Badge v-if="form.webFields.webActive" severity="success" value="Attivo" />
          </div>
        </template>
        <ProductWebFields
          v-model="form.webFields"
          :product-type="form.type"
          :product-price="form.price"
          :sync-status="product?.syncStatus"
          :last-sync-at="product?.lastSyncAt"
          :woocommerce-id="product?.woocommerceId"
          :site-url="wordpressUrl"
        />
      </TabPanel>

      <!-- Tab Composizione (Materiali) -->
      <TabPanel header="Composizione">
        <ProductMaterials v-if="product?.id" :product-id="product?.id" />
        <div v-else class="tab-placeholder">
          <i class="pi pi-info-circle"></i>
          <p>Salva il prodotto per gestire la composizione</p>
        </div>
      </TabPanel>

      <!-- Tab BOM (Componenti Prodotto) -->
      <TabPanel header="Componenti (BOM)">
        <ProductBom v-if="product?.id" :product-id="product?.id" />
        <div v-else class="tab-placeholder">
          <i class="pi pi-info-circle"></i>
          <p>Salva il prodotto per gestire i componenti</p>
        </div>
      </TabPanel>

      <!-- Tab Fasi Lavorazione (Pipeline) -->
      <TabPanel header="Lavorazione">
        <ProductPhases v-if="product?.id" :product-id="product?.id" />
        <div v-else class="tab-placeholder">
          <i class="pi pi-info-circle"></i>
          <p>Salva il prodotto per gestire le fasi di lavorazione</p>
        </div>
      </TabPanel>

      <!-- Tab Analytics -->
      <TabPanel header="Analytics">
        <ProductAnalytics v-if="product?.id" :product-id="product.id" />
        <div v-else class="tab-placeholder">
          <i class="pi pi-chart-line"></i>
          <p>Salva il prodotto per vedere le analytics</p>
        </div>
      </TabPanel>
    </TabView>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <!-- Pulsante Sync WordPress (solo in modifica e se prodotto ha woocommerceId o webActive) -->
          <Button
            v-if="isEdit && (product?.woocommerceId || form.webFields.webActive)"
            label="Aggiorna WordPress"
            icon="pi pi-cloud-upload"
            class="p-button-outlined p-button-help"
            :loading="syncingWordPress"
            @click="syncToWordPress"
          />
        </div>
        <div class="footer-right">
          <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="visible = false" />
          <Button
            :label="isEdit ? 'Salva' : 'Crea'"
            icon="pi pi-check"
            :loading="loading"
            @click="save"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import ProductWebFields from './ProductWebFields.vue';
import ProductMaterials from './ProductMaterials.vue';
import ProductBom from './ProductBom.vue';
import ProductPhases from './ProductPhases.vue';
import ProductImagesManager from './ProductImagesManager.vue';
import ProductInventoryManager from './ProductInventoryManager.vue';
import ProductVariantsManager from './ProductVariantsManager.vue';
import ProductAnalytics from './ProductAnalytics.vue';
import api from '../services/api.service';

interface Props {
  modelValue: boolean;
  product?: any;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', product: any): void;
  (e: 'synced'): void;
}

const props = withDefaults(defineProps<Props>(), {
  product: null
});

const emit = defineEmits<Emits>();
const toast = useToast();

const visible = ref(props.modelValue);
const loading = ref(false);
const syncingWordPress = ref(false);
const isEdit = ref(false);
const activeTab = ref(0);

// Dati prodotto per visualizzazione
const productImages = ref<any[]>([]);
const productCategories = ref<any[]>([]);
const productInventory = ref<any[]>([]);

// Definizione location inventario
const inventoryLocations = [
  { code: 'WEB', label: 'Web/E-commerce', icon: 'pi pi-globe' },
  { code: 'B2B', label: 'B2B/Ingrosso', icon: 'pi pi-briefcase' },
  { code: 'EVENTI', label: 'Eventi/Fiere', icon: 'pi pi-calendar' },
  { code: 'TRANSITO', label: 'In Transito', icon: 'pi pi-truck' },
];

// URL WordPress dal localStorage o default
const wordpressUrl = computed(() => {
  try {
    const settings = localStorage.getItem('wordpress_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.url || 'https://example.com';
    }
  } catch (e) {
    // ignore
  }
  return 'https://example.com';
});

// Categorie caricate dal database
const categories = ref<{ label: string; value: string }[]>([]);
const loadingCategories = ref(false);

const loadCategories = async () => {
  try {
    loadingCategories.value = true;
    // Richiedi le categorie in formato albero
    const response = await api.get('/product-categories?tree=true');

    if (response.success && response.data) {
      // response.data è già un array di categorie root con children
      const buildCategoryOptions = (items: any[], level = 0): { label: string; value: string }[] => {
        const result: { label: string; value: string }[] = [];
        for (const cat of items) {
          const indent = level > 0 ? '— '.repeat(level) : '';
          result.push({
            label: `${indent}${cat.name}`,
            value: cat.name, // Usiamo il nome come valore per compatibilità
          });
          // Se ha figli, aggiungili ricorsivamente
          if (cat.children?.length) {
            result.push(...buildCategoryOptions(cat.children, level + 1));
          }
        }
        return result;
      };

      categories.value = buildCategoryOptions(response.data);
    }
  } catch (error) {
    console.error('Errore caricamento categorie:', error);
    categories.value = [];
  } finally {
    loadingCategories.value = false;
  }
};

onMounted(() => {
  loadCategories();
});

const productTypes = [
  { label: 'Semplice', value: 'SIMPLE' },
  { label: 'Con Varianti', value: 'WITH_VARIANTS' },
  { label: 'Digitale', value: 'DIGITAL' },
  { label: 'Materia Prima', value: 'RAW_MATERIAL' },
];

const getDefaultWebFields = () => ({
  webActive: false,
  webPrice: null,
  webDescription: null,
  webShortDescription: null,
  webSlug: null,
  webMetaTitle: null,
  webMetaDescription: null,
  webAttributes: null,
  downloadFiles: null,
});

const form = ref({
  sku: '',
  name: '',
  description: '',
  category: '',
  type: 'SIMPLE' as 'SIMPLE' | 'WITH_VARIANTS' | 'DIGITAL' | 'RAW_MATERIAL',
  price: 0,
  cost: 0,
  minStockLevel: 10,
  reorderQuantity: 20,
  isActive: true,
  webFields: getDefaultWebFields(),
});

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val && props.product) {
    isEdit.value = true;
    form.value = {
      ...props.product,
      webFields: {
        webActive: props.product.webActive || false,
        webPrice: props.product.webPrice,
        webDescription: props.product.webDescription,
        webShortDescription: props.product.webShortDescription,
        webSlug: props.product.webSlug,
        webMetaTitle: props.product.webMetaTitle,
        webMetaDescription: props.product.webMetaDescription,
        webAttributes: props.product.webAttributes,
        downloadFiles: props.product.downloadFiles,
      },
    };
    // Carica immagini, categorie, inventario
    productImages.value = props.product.productImages || [];
    productCategories.value = (props.product.categories || []).map((c: any) => ({
      id: c.category?.id || c.categoryId,
      name: c.category?.name || 'N/A',
      isPrimary: c.isPrimary || false,
    }));
    productInventory.value = props.product.inventory || [];
    activeTab.value = 0;
  } else {
    isEdit.value = false;
    resetForm();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const resetForm = () => {
  form.value = {
    sku: '',
    name: '',
    description: '',
    category: '',
    type: 'SIMPLE',
    price: 0,
    cost: 0,
    minStockLevel: 10,
    reorderQuantity: 20,
    isActive: true,
    webFields: getDefaultWebFields(),
  };
  productImages.value = [];
  productCategories.value = [];
  productInventory.value = [];
  activeTab.value = 0;
};

const onHide = () => {
  resetForm();
};

// Sync to WordPress
const syncToWordPress = async () => {
  if (!props.product?.id) return;

  syncingWordPress.value = true;
  try {
    const response = await api.post(`/wordpress/sync/product/${props.product.id}`);

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: 'Sincronizzazione completata',
        detail: response.data?.message || 'Prodotto aggiornato su WordPress',
        life: 3000,
      });
      emit('synced');
    } else {
      throw new Error(response.error || 'Errore sincronizzazione');
    }
  } catch (error: any) {
    console.error('Errore sync WordPress:', error);
    toast.add({
      severity: 'error',
      summary: 'Errore sincronizzazione',
      detail: error.message || 'Impossibile sincronizzare con WordPress',
      life: 5000,
    });
  } finally {
    syncingWordPress.value = false;
  }
};

const save = () => {
  loading.value = true;

  // Unisci i campi web nel form principale
  const productData = {
    ...form.value,
    webActive: form.value.webFields.webActive,
    webPrice: form.value.webFields.webPrice,
    webDescription: form.value.webFields.webDescription,
    webShortDescription: form.value.webFields.webShortDescription,
    webSlug: form.value.webFields.webSlug,
    webMetaTitle: form.value.webFields.webMetaTitle,
    webMetaDescription: form.value.webFields.webMetaDescription,
    webAttributes: form.value.webFields.webAttributes,
    downloadFiles: form.value.webFields.downloadFiles,
  };

  // Rimuovi l'oggetto webFields annidato
  delete (productData as any).webFields;

  // Rimuovi i campi che sono gestiti separatamente (hanno le loro API dedicate)
  delete (productData as any).inventory;
  delete (productData as any).variants;
  delete (productData as any).productImages;
  delete (productData as any).categories;
  delete (productData as any).bomItems;
  delete (productData as any).bomComponents;
  delete (productData as any).operations;
  delete (productData as any).manufacturingPhases;
  delete (productData as any).productMaterials;
  delete (productData as any).supplier;

  emit('save', productData);
  setTimeout(() => {
    loading.value = false;
    visible.value = false;
  }, 500);
};
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  color: #475569;
  font-size: 0.9rem;
}

.field-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.w-full {
  width: 100%;
}

.ml-2 {
  margin-left: 0.5rem;
}

.flex {
  display: flex;
}

.align-items-center {
  align-items: center;
}

.tab-header-with-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Dialog Footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-left {
  display: flex;
  gap: 0.5rem;
}

.footer-right {
  display: flex;
  gap: 0.5rem;
}

/* Categories display */
.categories-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

/* Override per TabPanel content */
:deep(.p-tabview-panels) {
  padding: 1rem 0;
}

:deep(.p-tabview-nav) {
  border-bottom: 1px solid var(--border-color-light, #e2e8f0);
}

:deep(.p-tabview-nav-link) {
  padding: 0.75rem 1.25rem;
}

/* Dialog footer override */
:deep(.p-dialog-footer) {
  padding: 1rem 1.5rem;
}

/* Tab Placeholder */
.tab-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  color: var(--color-gray-500, #6b7280);
  background: var(--color-gray-50, #f9fafb);
  border-radius: 8px;
  border: 2px dashed var(--color-gray-300, #d1d5db);
}

.tab-placeholder i {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: var(--color-gray-400, #9ca3af);
}

.tab-placeholder p {
  margin: 0;
  font-size: 1rem;
}
</style>
