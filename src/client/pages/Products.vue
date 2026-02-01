<template>
  <div class="products-page">
    <PageHeader
      title="Gestione Prodotti"
      subtitle="Gestisci il catalogo prodotti, varianti, BOM e cicli di lavorazione"
      icon="pi pi-box"
    >
      <template #actions>
        <Button label="Nuovo Prodotto" icon="pi pi-plus" @click="openCreateDialog" />
      </template>
    </PageHeader>

    <!-- KPI Cards -->
    <section class="stats-section">
      <div class="stats-grid stats-grid--6">
        <StatsCard
          label="Totale Prodotti"
          :value="totalRecords"
          icon="pi pi-box"
          variant="primary"
          format="number"
          subtitle="nel catalogo"
        />
        <StatsCard
          label="Valore (Costo)"
          :value="stats.costValue"
          icon="pi pi-wallet"
          variant="info"
          format="currency"
          subtitle="costo magazzino"
        />
        <StatsCard
          label="Valore (Vendita)"
          :value="stats.retailValue"
          icon="pi pi-euro"
          variant="success"
          format="currency"
          subtitle="prezzo vendita"
        />
        <StatsCard
          label="Margine"
          :value="stats.marginPercent"
          icon="pi pi-percentage"
          variant="success"
          format="percent"
          :subtitle="`${formatCurrency(stats.retailValue - stats.costValue)} profitto`"
        />
        <StatsCard
          label="Prodotti Attivi"
          :value="stats.activeProducts"
          icon="pi pi-check-circle"
          variant="info"
          format="number"
          :subtitle="`${totalRecords > 0 ? Math.round((stats.activeProducts / totalRecords) * 100) : 0}% attivi`"
        />
        <StatsCard
          label="Alert Scorte"
          :value="stats.lowStock"
          icon="pi pi-exclamation-triangle"
          variant="warning"
          format="number"
          subtitle="sotto scorta minima"
        />
      </div>
    </section>

    <!-- Filters & Table -->
    <section class="table-section">
      <div class="table-card">
        <div class="table-toolbar">
          <div class="search-wrapper">
            <i class="pi pi-search search-icon"></i>
            <InputText
              v-model="search"
              placeholder="Cerca per SKU o Nome..."
              @input="loadProducts"
              class="search-input"
            />
          </div>

          <div class="filters">
            <Dropdown
              v-model="selectedCategory"
              :options="categories"
              placeholder="Tutte le categorie"
              @change="loadProducts"
              showClear
              class="filter-dropdown"
            />
          </div>
        </div>

        <DataTable
          :value="products"
          :loading="loading"
          paginator
          :rows="20"
          :totalRecords="totalRecords"
          :lazy="true"
          @page="onPage"
          @sort="onSort"
          responsiveLayout="scroll"
          class="custom-table"
          :rowHover="true"
        >
          <Column field="sku" header="SKU" sortable style="min-width: 120px">
            <template #body="{ data }">
              <span class="sku-badge">{{ data.sku }}</span>
            </template>
          </Column>
          <Column field="name" header="Nome" sortable style="min-width: 250px">
            <template #body="{ data }">
              <div class="product-name">{{ data.name }}</div>
            </template>
          </Column>
          <Column field="category" header="Categoria" sortable style="min-width: 120px">
            <template #body="{ data }">
              <Tag v-if="data.category" severity="info" class="category-tag">{{ data.category }}</Tag>
              <span v-else class="text-muted">-</span>
            </template>
          </Column>
          <Column field="price" header="Prezzo" sortable style="min-width: 110px">
            <template #body="{ data }">
              <span class="price">{{ formatCurrency(data.price) }}</span>
            </template>
          </Column>
          <Column field="cost" header="Costo" sortable style="min-width: 110px">
            <template #body="{ data }">
              <span class="cost">{{ formatCurrency(data.cost) }}</span>
            </template>
          </Column>
          <Column field="inventory" header="Giacenza" style="min-width: 100px">
            <template #body="{ data }">
              <span class="stock-value" :class="{ 'stock-low': getTotalInventory(data) < (data.minStockLevel || 0) }">
                {{ getTotalInventory(data) }}
              </span>
            </template>
          </Column>
          <Column field="minStockLevel" header="Scorta Min" sortable style="min-width: 100px">
            <template #body="{ data }">
              <span class="stock-level">{{ data.minStockLevel }}</span>
            </template>
          </Column>
          <Column field="isActive" header="Stato" sortable style="min-width: 100px">
            <template #body="{ data }">
              <Tag :severity="data.isActive ? 'success' : 'danger'" class="status-tag">
                {{ data.isActive ? 'Attivo' : 'Inattivo' }}
              </Tag>
            </template>
          </Column>
          <Column header="Azioni" style="min-width: 140px" :frozen="true" alignFrozen="right">
            <template #body="{ data }">
              <div class="action-buttons">
                <Button
                  icon="pi pi-eye"
                  class="p-button-rounded p-button-text action-btn action-btn--view"
                  @click="viewProduct(data)"
                  v-tooltip.top="'Dettaglio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text action-btn action-btn--edit"
                  @click="editProduct(data)"
                  v-tooltip.top="'Modifica'"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-rounded p-button-text action-btn action-btn--delete"
                  @click="deleteProduct(data)"
                  v-tooltip.top="'Elimina'"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="empty-state">
              <i class="pi pi-inbox empty-state__icon"></i>
              <p class="empty-state__text">Nessun prodotto trovato</p>
              <Button label="Crea il primo prodotto" icon="pi pi-plus" @click="openCreateDialog" />
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <!-- Wizard per Creazione -->
    <ProductWizard
      v-model="showWizard"
      @created="handleWizardCreated"
      @completed="handleWizardCompleted"
    />

    <!-- Dialog per Modifica -->
    <ProductDialog
      v-model="showDialog"
      :product="selectedProduct"
      @save="handleSave"
    />

    <!-- Dialog per View Details -->
    <Dialog
      v-model:visible="showDetailDialog"
      header="Dettaglio Prodotto"
      :style="{ width: '1100px', maxWidth: '95vw' }"
      :modal="true"
      class="detail-dialog"
    >
      <TabView v-if="selectedProduct">
        <TabPanel header="Informazioni">
          <div class="product-details">
            <!-- Immagini Prodotto -->
            <div class="images-section" v-if="selectedProduct.productImages?.length || selectedProduct.mainImageUrl">
              <h4 class="detail-section__title">
                <i class="pi pi-images"></i> Immagini
              </h4>
              <div class="images-gallery">
                <div
                  v-for="(img, idx) in (selectedProduct.productImages?.length ? selectedProduct.productImages : (selectedProduct.mainImageUrl ? [{ src: selectedProduct.mainImageUrl, isMain: true }] : []))"
                  :key="idx"
                  class="image-item"
                  :class="{ 'image-item--main': img.isMain }"
                >
                  <img :src="img.src" :alt="img.alt || selectedProduct.name" />
                  <span v-if="img.isMain" class="main-badge">Principale</span>
                </div>
              </div>
            </div>

            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">SKU</span>
                <span class="detail-value sku-badge">{{ selectedProduct.sku }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Nome</span>
                <span class="detail-value">{{ selectedProduct.name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Tipo</span>
                <Tag :severity="selectedProduct.type === 'WITH_VARIANTS' ? 'warning' : 'info'">
                  {{ selectedProduct.type === 'WITH_VARIANTS' ? 'Con Varianti' : selectedProduct.type === 'DIGITAL' ? 'Digitale' : 'Semplice' }}
                </Tag>
              </div>
              <div class="detail-item">
                <span class="detail-label">Stato</span>
                <Tag :severity="selectedProduct.isActive ? 'success' : 'danger'">
                  {{ selectedProduct.isActive ? 'Attivo' : 'Inattivo' }}
                </Tag>
              </div>
            </div>

            <!-- Categorie -->
            <div class="detail-section">
              <h4 class="detail-section__title">
                <i class="pi pi-tag"></i> Categorie
              </h4>
              <div class="categories-list" v-if="selectedProduct.categories?.length">
                <Tag
                  v-for="cat in selectedProduct.categories"
                  :key="cat.id"
                  :severity="cat.isPrimary ? 'success' : 'info'"
                  class="category-tag-item"
                >
                  {{ cat.category?.name || cat.name }}
                  <span v-if="cat.isPrimary" class="primary-indicator">★</span>
                </Tag>
              </div>
              <div v-else-if="selectedProduct.category" class="categories-list">
                <Tag severity="info">{{ selectedProduct.category }}</Tag>
              </div>
              <span v-else class="text-muted">Nessuna categoria assegnata</span>
            </div>

            <div class="detail-section">
              <h4 class="detail-section__title">Descrizione</h4>
              <div class="detail-section__content" v-html="selectedProduct.description || 'Nessuna descrizione'"></div>
            </div>

            <div class="detail-section">
              <h4 class="detail-section__title">Prezzi e Margini</h4>
              <div class="price-grid">
                <div class="price-item">
                  <span class="price-label">Prezzo Vendita</span>
                  <span class="price-value price-value--sell">{{ formatCurrency(selectedProduct.price) }}</span>
                </div>
                <div class="price-item">
                  <span class="price-label">Prezzo Web</span>
                  <span class="price-value price-value--web">{{ formatCurrency(selectedProduct.webPrice || selectedProduct.price) }}</span>
                </div>
                <div class="price-item">
                  <span class="price-label">Costo</span>
                  <span class="price-value price-value--cost">{{ formatCurrency(selectedProduct.cost) }}</span>
                </div>
                <div class="price-item">
                  <span class="price-label">Margine</span>
                  <span class="price-value price-value--margin">{{ formatCurrency(selectedProduct.price - selectedProduct.cost) }}</span>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Giacenze">
          <div class="inventory-section">
            <div class="inventory-grid">
              <div class="inventory-card inventory-card--total">
                <div class="inventory-icon"><i class="pi pi-box"></i></div>
                <div class="inventory-info">
                  <span class="inventory-label">Totale Disponibile</span>
                  <span class="inventory-value">{{ getTotalInventory(selectedProduct) }}</span>
                </div>
              </div>
              <div class="inventory-card inventory-card--web">
                <div class="inventory-icon"><i class="pi pi-globe"></i></div>
                <div class="inventory-info">
                  <span class="inventory-label">Web / E-commerce</span>
                  <span class="inventory-value">{{ getInventoryByLocation(selectedProduct, 'WEB') }}</span>
                </div>
              </div>
              <div class="inventory-card inventory-card--b2b">
                <div class="inventory-icon"><i class="pi pi-briefcase"></i></div>
                <div class="inventory-info">
                  <span class="inventory-label">B2B</span>
                  <span class="inventory-value">{{ getInventoryByLocation(selectedProduct, 'B2B') }}</span>
                </div>
              </div>
              <div class="inventory-card inventory-card--eventi">
                <div class="inventory-icon"><i class="pi pi-calendar"></i></div>
                <div class="inventory-info">
                  <span class="inventory-label">Fiere / Eventi</span>
                  <span class="inventory-value">{{ getInventoryByLocation(selectedProduct, 'EVENTI') }}</span>
                </div>
              </div>
            </div>

            <div class="inventory-details" v-if="selectedProduct.inventory?.length">
              <h4 class="detail-section__title">Dettaglio per Magazzino</h4>
              <DataTable :value="selectedProduct.inventory" class="inventory-table">
                <Column field="warehouse.name" header="Magazzino">
                  <template #body="{ data }">
                    {{ data.warehouse?.name || 'N/D' }}
                  </template>
                </Column>
                <Column field="location" header="Location">
                  <template #body="{ data }">
                    <Tag :severity="getLocationSeverity(data.location)">{{ data.location }}</Tag>
                  </template>
                </Column>
                <Column field="quantity" header="Quantità">
                  <template #body="{ data }">
                    <span class="qty-value">{{ data.quantity }}</span>
                  </template>
                </Column>
                <Column field="reservedQuantity" header="Riservati">
                  <template #body="{ data }">
                    <span class="qty-reserved">{{ data.reservedQuantity || 0 }}</span>
                  </template>
                </Column>
              </DataTable>
            </div>
            <div v-else class="no-inventory">
              <i class="pi pi-info-circle"></i>
              <p>Nessuna giacenza registrata per questo prodotto</p>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="SEO & Web">
          <div class="seo-section">
            <div class="seo-status">
              <Tag :severity="selectedProduct.webActive ? 'success' : 'danger'">
                {{ selectedProduct.webActive ? 'Pubblicato sul Web' : 'Non pubblicato' }}
              </Tag>
            </div>

            <div class="seo-fields">
              <div class="seo-field">
                <label class="seo-label">URL Slug</label>
                <div class="seo-value seo-value--slug">
                  <i class="pi pi-link"></i>
                  {{ selectedProduct.webSlug || '-' }}
                </div>
              </div>

              <div class="seo-field">
                <label class="seo-label">Meta Title (SEO)</label>
                <div class="seo-value">
                  {{ selectedProduct.webMetaTitle || '-' }}
                </div>
                <div class="seo-counter" v-if="selectedProduct.webMetaTitle">
                  {{ selectedProduct.webMetaTitle.length }}/60 caratteri
                </div>
              </div>

              <div class="seo-field">
                <label class="seo-label">Meta Description (SEO)</label>
                <div class="seo-value seo-value--desc">
                  {{ selectedProduct.webMetaDescription || '-' }}
                </div>
                <div class="seo-counter" v-if="selectedProduct.webMetaDescription">
                  {{ selectedProduct.webMetaDescription.length }}/160 caratteri
                </div>
              </div>

              <div class="seo-field">
                <label class="seo-label">Descrizione Breve Web</label>
                <div class="seo-value" v-html="selectedProduct.webShortDescription || '-'"></div>
              </div>
            </div>

            <div class="detail-section" v-if="selectedProduct.webAttributes?.length">
              <h4 class="detail-section__title">Attributi Web</h4>
              <div class="attributes-list">
                <div v-for="attr in selectedProduct.webAttributes" :key="attr.name" class="attribute-item">
                  <span class="attr-name">{{ attr.name }}</span>
                  <span class="attr-values">{{ attr.options?.join(', ') }}</span>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="Pipeline Produzione">
          <ProductPipeline :productId="selectedProduct.id" />
        </TabPanel>
      </TabView>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import api from '../services/api.service';
import ProductDialog from '../components/ProductDialog.vue';
import ProductWizard from '../components/ProductWizard.vue';
import ProductPipeline from '../components/ProductPipeline.vue';
import PageHeader from '../components/PageHeader.vue';
import StatsCard from '../components/StatsCard.vue';

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const products = ref([]);
const totalRecords = ref(0);
const search = ref('');
const selectedCategory = ref(null);
const page = ref(1);
const sortBy = ref('createdAt');
const sortOrder = ref('desc');

const showDialog = ref(false);
const showWizard = ref(false);
const showDetailDialog = ref(false);
const selectedProduct = ref(null);

const stats = ref({
  costValue: 0,       // Valore a costo
  retailValue: 0,     // Valore a prezzo vendita
  marginPercent: 0,   // Margine %
  activeProducts: 0,
  lowStock: 0,
});

const categories = ref<{ label: string; value: string }[]>([]);

const loadCategories = async () => {
  try {
    const response = await api.get('/product-categories?limit=9999');
    if (response.success && response.data?.items) {
      // Crea array flat con tutte le categorie
      const buildCategoryOptions = (items: any[], level = 0): { label: string; value: string }[] => {
        const result: { label: string; value: string }[] = [];
        for (const cat of items) {
          const indent = level > 0 ? '— '.repeat(level) : '';
          result.push({
            label: `${indent}${cat.name}`,
            value: cat.name,
          });
          if (cat.children?.length) {
            result.push(...buildCategoryOptions(cat.children, level + 1));
          }
        }
        return result;
      };
      const rootCategories = response.data.items.filter((c: any) => !c.parentId);
      categories.value = buildCategoryOptions(rootCategories);
    }
  } catch (error) {
    console.error('Errore caricamento categorie:', error);
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
};

// Helper per calcolare giacenze
const getTotalInventory = (product: any) => {
  if (!product?.inventory?.length) return 0;
  return product.inventory.reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0);
};

const getInventoryByLocation = (product: any, location: string) => {
  if (!product?.inventory?.length) return 0;
  return product.inventory
    .filter((inv: any) => inv.location === location)
    .reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0);
};

const getLocationSeverity = (location: string) => {
  const map: Record<string, string> = {
    'WEB': 'info',
    'B2B': 'success',
    'EVENTI': 'warning',
    'TRANSITO': 'secondary',
  };
  return map[location] || 'info';
};

const loadStats = async () => {
  try {
    const response = await api.get('/products?limit=500');
    const allProducts = response.data.items;

    // Calcola valore a costo e a prezzo vendita
    let costValue = 0;
    let retailValue = 0;

    for (const p of allProducts) {
      const totalQty = p.inventory?.reduce((invSum: number, inv: any) => invSum + (inv.quantity || 0), 0) || 0;
      costValue += Number(p.cost || 0) * totalQty;
      retailValue += Number(p.price || 0) * totalQty;
    }

    // Calcola margine %
    const marginPercent = retailValue > 0
      ? Math.round(((retailValue - costValue) / retailValue) * 10000) / 100
      : 0;

    stats.value = {
      costValue,
      retailValue,
      marginPercent,
      activeProducts: allProducts.filter((p: any) => p.isActive).length,
      lowStock: allProducts.filter((p: any) => {
        const totalQty = p.inventory?.reduce((invSum: number, inv: any) => invSum + (inv.quantity || 0), 0) || 0;
        return totalQty < (p.minStockLevel || 0);
      }).length,
    };
  } catch (error) {
    console.error('Error loading stats:', error);
  }
};

const loadProducts = async () => {
  try {
    loading.value = true;

    const params = new URLSearchParams({
      page: page.value.toString(),
      limit: '20',
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      ...(search.value && { search: search.value }),
      ...(selectedCategory.value && { category: selectedCategory.value }),
    });

    const response = await api.get(`/products?${params.toString()}`);

    if (response.success) {
      products.value = response.data.items;
      totalRecords.value = response.data.pagination.total;
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel caricamento dei prodotti',
      life: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const onPage = (event: any) => {
  page.value = event.page + 1;
  loadProducts();
};

const onSort = (event: any) => {
  sortBy.value = event.sortField;
  sortOrder.value = event.sortOrder === 1 ? 'asc' : 'desc';
  loadProducts();
};

const openCreateDialog = () => {
  selectedProduct.value = null;
  showWizard.value = true;
};

const viewProduct = (product: any) => {
  selectedProduct.value = product;
  showDetailDialog.value = true;
};

const editProduct = (product: any) => {
  selectedProduct.value = product;
  showDialog.value = true;
};

const deleteProduct = (product: any) => {
  confirm.require({
    message: `Sei sicuro di voler eliminare ${product.name}?`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/products/${product.id}`);
        toast.add({
          severity: 'success',
          summary: 'Eliminato',
          detail: 'Prodotto eliminato con successo',
          life: 3000,
        });
        loadProducts();
      } catch (error: any) {
        toast.add({
          severity: 'error',
          summary: 'Errore',
          detail: error.message || 'Errore durante l\'eliminazione',
          life: 3000,
        });
      }
    },
  });
};

const handleSave = async (productData: any) => {
  try {
    if (selectedProduct.value?.id) {
      await api.patch(`/products/${selectedProduct.value.id}`, productData);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Prodotto aggiornato con successo',
        life: 3000,
      });
    } else {
      await api.post('/products', productData);
      toast.add({
        severity: 'success',
        summary: 'Creato',
        detail: 'Prodotto creato con successo',
        life: 3000,
      });
    }
    loadProducts();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 3000,
    });
  }
};

const handleWizardCreated = (product: any) => {
  // Ricarica i prodotti dopo la creazione
  loadProducts();
  loadStats();
};

const handleWizardCompleted = () => {
  // Ricarica i prodotti dopo il completamento del wizard
  loadProducts();
  loadStats();
};

onMounted(() => {
  loadProducts();
  loadStats();
  loadCategories();
});
</script>

<style scoped>
.products-page {
  max-width: 1600px;
  margin: 0 auto;
}

/* Stats Section */
.stats-section {
  margin-bottom: var(--space-8);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}
.stats-grid--6 {
  grid-template-columns: repeat(6, 1fr);
}

/* Table Section */
.table-section {
  margin-top: var(--space-6);
}

.table-card {
  background: var(--bg-card);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-gray-50);
  border-bottom: var(--border-width) solid var(--border-color-light);
  flex-wrap: wrap;
  align-items: center;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-gray-400);
  font-size: 0.875rem;
}

.search-input {
  width: 100%;
  padding-left: var(--space-10) !important;
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-dropdown {
  min-width: 180px;
}

/* Table Styling */
.custom-table :deep(.p-datatable-thead > tr > th) {
  background: var(--color-gray-50);
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
  border-bottom: 2px solid var(--border-color);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.custom-table :deep(.p-datatable-tbody > tr > td) {
  padding: var(--space-4) var(--space-5);
  font-size: var(--font-size-sm);
  border-bottom: var(--border-width) solid var(--border-color-light);
  vertical-align: middle;
}

.custom-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--color-gray-50);
}

.custom-table :deep(.p-paginator) {
  padding: var(--space-4) var(--space-6);
  border-top: var(--border-width) solid var(--border-color-light);
}

/* Cell Styles */
.sku-badge {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-700);
  background: var(--color-primary-50);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
}

.product-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.category-tag {
  font-size: var(--font-size-xs);
}

.price {
  font-weight: 600;
  color: var(--color-gray-900);
}

.cost {
  color: var(--color-gray-600);
}

.stock-level {
  font-weight: 500;
}

.status-tag {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.text-muted {
  color: var(--color-gray-400);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.action-btn {
  width: 32px !important;
  height: 32px !important;
}

.action-btn--view {
  color: var(--color-info) !important;
}

.action-btn--edit {
  color: var(--color-primary-600) !important;
}

.action-btn--delete {
  color: var(--color-danger) !important;
}

.action-btn:hover {
  background: var(--color-gray-100) !important;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  font-size: 3rem;
  color: var(--color-gray-300);
  margin-bottom: var(--space-4);
}

.empty-state__text {
  color: var(--color-gray-500);
  margin-bottom: var(--space-4);
}

/* Detail Dialog */
.product-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: var(--font-size-base);
  color: var(--color-gray-900);
}

.detail-section {
  padding-top: var(--space-4);
  border-top: var(--border-width) solid var(--border-color-light);
}

.detail-section__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-700);
  margin: 0 0 var(--space-3) 0;
}

.detail-section__content {
  color: var(--color-gray-600);
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.price-item {
  background: var(--color-gray-50);
  padding: var(--space-4);
  border-radius: var(--border-radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.price-label {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.price-value {
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.price-value--sell {
  color: var(--color-primary-600);
}

.price-value--cost {
  color: var(--color-gray-600);
}

.price-value--margin {
  color: var(--color-success);
}

/* Responsive */
@media (max-width: 1400px) {
  .stats-grid--6 {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .stats-grid--6 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrapper {
    min-width: 100%;
  }

  .filters {
    width: 100%;
  }

  .filter-dropdown {
    flex: 1;
  }

  .detail-grid,
  .price-grid {
    grid-template-columns: 1fr;
  }
}

/* Stock Value */
.stock-value {
  font-weight: 600;
  color: var(--color-success);
}

.stock-value.stock-low {
  color: var(--color-danger);
}

/* Images Gallery */
.images-section {
  margin-bottom: var(--space-6);
}

.images-gallery {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-3);
}

.image-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  border: 2px solid var(--border-color);
  transition: all var(--transition-fast);
}

.image-item:hover {
  border-color: var(--color-primary-400);
  transform: scale(1.05);
}

.image-item--main {
  border-color: var(--color-success);
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.main-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-success);
  color: white;
  font-size: var(--font-size-xs);
  text-align: center;
  padding: 2px;
}

/* Categories */
.categories-list {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.category-tag-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.primary-indicator {
  color: gold;
  margin-left: var(--space-1);
}

/* Inventory Section */
.inventory-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.inventory-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--border-radius-lg);
  background: var(--color-gray-50);
  border: 2px solid var(--border-color);
}

.inventory-card--total {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: var(--color-primary-300);
}

.inventory-card--total .inventory-icon {
  background: var(--color-primary-600);
}

.inventory-card--web {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: var(--color-success-light);
}

.inventory-card--web .inventory-icon {
  background: var(--color-success);
}

.inventory-card--b2b {
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
  border-color: #fbbf24;
}

.inventory-card--b2b .inventory-icon {
  background: #f59e0b;
}

.inventory-card--eventi {
  background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
  border-color: #d946ef;
}

.inventory-card--eventi .inventory-icon {
  background: #a855f7;
}

.inventory-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
}

.inventory-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.inventory-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
}

.inventory-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-gray-900);
}

.inventory-table {
  margin-top: var(--space-4);
}

.qty-value {
  font-weight: 600;
  font-size: var(--font-size-base);
}

.qty-reserved {
  color: var(--color-gray-500);
}

.no-inventory {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--color-gray-500);
  text-align: center;
}

.no-inventory i {
  font-size: 2rem;
  margin-bottom: var(--space-3);
}

/* SEO Section */
.seo-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.seo-status {
  margin-bottom: var(--space-4);
}

.seo-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.seo-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.seo-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-600);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.seo-value {
  padding: var(--space-3) var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
  border: 1px solid var(--border-color-light);
  min-height: 40px;
}

.seo-value--slug {
  font-family: var(--font-mono);
  color: var(--color-primary-600);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.seo-value--desc {
  min-height: 80px;
}

.seo-counter {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
  text-align: right;
}

/* Attributes */
.attributes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.attribute-item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.attr-name {
  font-weight: 600;
  min-width: 120px;
  color: var(--color-gray-700);
}

.attr-values {
  color: var(--color-gray-600);
}

/* Price Web */
.price-value--web {
  color: var(--color-info);
}

/* Responsive Inventory */
@media (max-width: 1024px) {
  .inventory-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .inventory-grid {
    grid-template-columns: 1fr;
  }

  .images-gallery {
    justify-content: center;
  }
}
</style>
