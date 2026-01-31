<template>
  <div class="product-categories">
    <PageHeader
      title="Categorie Prodotto"
      subtitle="Gestisci la struttura gerarchica delle categorie"
      icon="pi pi-folder"
    />

    <div class="categories-layout">
      <!-- Tree Panel -->
      <div class="tree-panel">
        <div class="panel-header">
          <h3>Struttura Categorie</h3>
          <div class="header-actions">
            <Button
              icon="pi pi-sync"
              class="p-button-text p-button-sm"
              v-tooltip="'Sincronizza con WordPress'"
              @click="syncWithWordPress"
              :loading="syncing"
            />
            <Button
              icon="pi pi-plus"
              class="p-button-sm"
              label="Nuova"
              @click="openNewCategory(null)"
            />
          </div>
        </div>

        <div v-if="loading" class="loading-container">
          <ProgressSpinner style="width: 40px; height: 40px" />
        </div>

        <div v-else-if="categories.length === 0" class="empty-state">
          <i class="pi pi-folder-open"></i>
          <p>Nessuna categoria presente</p>
          <Button label="Crea prima categoria" icon="pi pi-plus" @click="openNewCategory(null)" />
        </div>

        <Tree
          v-else
          :value="categories"
          selectionMode="single"
          v-model:selectionKeys="selectedKeys"
          @node-select="onNodeSelect"
          class="category-tree"
        >
          <template #default="{ node }">
            <div class="tree-node">
              <span class="node-name">{{ node.label }}</span>
              <div class="node-badges">
                <Tag
                  v-if="node.data?.productCount > 0"
                  :value="node.data.productCount"
                  severity="info"
                  class="count-tag"
                  v-tooltip="'Prodotti in questa categoria'"
                />
                <Tag
                  v-if="node.data?.woocommerceId"
                  value="WC"
                  severity="success"
                  class="wc-tag"
                  v-tooltip="'Sincronizzato con WooCommerce'"
                />
              </div>
              <div class="node-actions">
                <Button
                  icon="pi pi-plus"
                  class="p-button-text p-button-sm p-button-rounded"
                  v-tooltip="'Aggiungi sottocategoria'"
                  @click.stop="openNewCategory(node.data)"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-text p-button-sm p-button-rounded"
                  v-tooltip="'Modifica'"
                  @click.stop="editCategory(node.data)"
                />
                <Button
                  icon="pi pi-trash"
                  class="p-button-text p-button-sm p-button-rounded p-button-danger"
                  v-tooltip="'Elimina'"
                  @click.stop="confirmDelete(node.data)"
                />
              </div>
            </div>
          </template>
        </Tree>
      </div>

      <!-- Detail Panel -->
      <div class="detail-panel" v-if="selectedCategory">
        <div class="panel-header">
          <h3>{{ selectedCategory.name }}</h3>
          <Button
            icon="pi pi-times"
            class="p-button-text p-button-rounded"
            @click="selectedCategory = null; selectedKeys = {}"
          />
        </div>

        <div class="category-details">
          <div class="detail-row">
            <label>Slug</label>
            <code>{{ selectedCategory.slug }}</code>
          </div>

          <div class="detail-row" v-if="selectedCategory.description">
            <label>Descrizione</label>
            <p>{{ selectedCategory.description }}</p>
          </div>

          <div class="detail-row" v-if="selectedCategory.parent">
            <label>Categoria Padre</label>
            <Tag :value="selectedCategory.parent.name" />
          </div>

          <div class="detail-row">
            <label>Stato</label>
            <Tag
              :value="selectedCategory.isActive ? 'Attiva' : 'Disattivata'"
              :severity="selectedCategory.isActive ? 'success' : 'danger'"
            />
          </div>

          <div class="detail-row" v-if="selectedCategory.woocommerceId">
            <label>WooCommerce ID</label>
            <span>{{ selectedCategory.woocommerceId }}</span>
          </div>

          <div class="detail-row" v-if="selectedCategory.image">
            <label>Immagine</label>
            <img :src="selectedCategory.image" alt="Category image" class="category-image" />
          </div>

          <!-- Prodotti in questa categoria -->
          <div class="products-section" v-if="selectedCategory.products?.length > 0">
            <h4>Prodotti ({{ selectedCategory.products.length }})</h4>
            <DataTable
              :value="selectedCategory.products"
              responsiveLayout="scroll"
              class="products-table"
              :rows="5"
              :paginator="selectedCategory.products.length > 5"
            >
              <Column field="product.sku" header="SKU" style="width: 120px" />
              <Column field="product.name" header="Nome" />
            </DataTable>
          </div>

          <div class="detail-actions">
            <Button label="Modifica" icon="pi pi-pencil" @click="editCategory(selectedCategory)" />
            <Button
              label="Elimina"
              icon="pi pi-trash"
              class="p-button-danger p-button-outlined"
              @click="confirmDelete(selectedCategory)"
            />
          </div>
        </div>
      </div>

      <div class="detail-panel empty" v-else>
        <div class="empty-detail">
          <i class="pi pi-info-circle"></i>
          <p>Seleziona una categoria per vedere i dettagli</p>
        </div>
      </div>
    </div>

    <!-- Dialog Nuova/Modifica Categoria -->
    <Dialog
      v-model:visible="showCategoryDialog"
      :header="editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'"
      :style="{ width: '500px' }"
      modal
    >
      <div class="category-form">
        <div class="field">
          <label for="catName">Nome *</label>
          <InputText id="catName" v-model="categoryForm.name" class="w-full" @input="generateSlug" />
        </div>

        <div class="field">
          <label for="catSlug">Slug</label>
          <InputText id="catSlug" v-model="categoryForm.slug" class="w-full" />
          <small class="hint">Lascia vuoto per generare automaticamente</small>
        </div>

        <div class="field">
          <label for="catParent">Categoria Padre</label>
          <TreeSelect
            id="catParent"
            v-model="categoryForm.parentId"
            :options="categoriesForSelect"
            placeholder="Nessuna (root)"
            class="w-full"
            showClear
          />
        </div>

        <div class="field">
          <label for="catDesc">Descrizione</label>
          <Textarea id="catDesc" v-model="categoryForm.description" rows="3" class="w-full" />
        </div>

        <div class="field">
          <label for="catImage">URL Immagine</label>
          <InputText id="catImage" v-model="categoryForm.image" class="w-full" placeholder="https://..." />
        </div>

        <div class="field checkbox-field">
          <Checkbox v-model="categoryForm.isActive" binary inputId="catActive" />
          <label for="catActive">Categoria attiva</label>
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="closeCategoryDialog" />
        <Button
          :label="editingCategory ? 'Aggiorna' : 'Crea'"
          icon="pi pi-check"
          :loading="saving"
          @click="saveCategory"
        />
      </template>
    </Dialog>

    <!-- Dialog Sync WordPress -->
    <Dialog
      v-model:visible="showSyncDialog"
      header="Sincronizzazione Categorie"
      :style="{ width: '450px' }"
      modal
    >
      <div class="sync-options">
        <p>Seleziona la direzione di sincronizzazione:</p>

        <div class="sync-buttons">
          <Button
            label="Importa da WordPress"
            icon="pi pi-cloud-download"
            class="p-button-lg"
            @click="doSync('import')"
            :loading="syncDirection === 'import' && syncing"
          />
          <Button
            label="Esporta verso WordPress"
            icon="pi pi-cloud-upload"
            class="p-button-lg p-button-outlined"
            @click="doSync('export')"
            :loading="syncDirection === 'export' && syncing"
          />
        </div>

        <Message v-if="syncResult" :severity="syncResult.success ? 'success' : 'error'" :closable="false">
          {{ syncResult.message }}
        </Message>
      </div>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Tree from 'primevue/tree';
import TreeSelect from 'primevue/treeselect';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import PageHeader from '../components/PageHeader.vue';
import api from '../services/api.service';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  parent?: { id: string; name: string };
  image?: string;
  position: number;
  isActive: boolean;
  woocommerceId?: number;
  productCount?: number;
  childCount?: number;
  children?: Category[];
  products?: any[];
}

const confirm = useConfirm();
const toast = useToast();

const loading = ref(false);
const saving = ref(false);
const syncing = ref(false);
const categories = ref<any[]>([]);
const selectedKeys = ref<any>({});
const selectedCategory = ref<Category | null>(null);
const showCategoryDialog = ref(false);
const showSyncDialog = ref(false);
const editingCategory = ref<Category | null>(null);
const syncDirection = ref<'import' | 'export' | null>(null);
const syncResult = ref<{ success: boolean; message: string } | null>(null);

const defaultForm = () => ({
  name: '',
  slug: '',
  description: '',
  parentId: null as string | null,
  image: '',
  isActive: true,
});

const categoryForm = ref(defaultForm());

// Convert categories to Tree format
const buildTreeNodes = (cats: Category[]): any[] => {
  return cats.map((cat) => ({
    key: cat.id,
    label: cat.name,
    data: cat,
    children: cat.children ? buildTreeNodes(cat.children) : [],
  }));
};

// Convert categories to TreeSelect format
const categoriesForSelect = computed(() => {
  const buildSelectNodes = (cats: Category[], excludeId?: string): any[] => {
    return cats
      .filter((cat) => cat.id !== excludeId)
      .map((cat) => ({
        key: cat.id,
        label: cat.name,
        children: cat.children ? buildSelectNodes(cat.children, excludeId) : undefined,
      }));
  };

  // Get flat list and rebuild tree for select
  return buildSelectNodes(flattenCategories(categories.value), editingCategory.value?.id);
});

const flattenCategories = (cats: any[]): Category[] => {
  const result: Category[] = [];
  const flatten = (items: any[]) => {
    for (const item of items) {
      result.push(item.data || item);
      if (item.children?.length > 0) {
        flatten(item.children);
      }
    }
  };
  flatten(cats);
  return result;
};

const loadCategories = async () => {
  loading.value = true;
  try {
    const response = await api.get('/product-categories?tree=true');
    if (response.success) {
      categories.value = buildTreeNodes(response.data);
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  } finally {
    loading.value = false;
  }
};

const onNodeSelect = async (node: any) => {
  // Load full category with products
  try {
    const response = await api.get(`/product-categories/${node.data.id}`);
    if (response.success) {
      selectedCategory.value = response.data;
    }
  } catch (error) {
    console.error('Error loading category:', error);
  }
};

const generateSlug = () => {
  if (!editingCategory.value && categoryForm.value.name && !categoryForm.value.slug) {
    categoryForm.value.slug = categoryForm.value.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
};

const openNewCategory = (parent: Category | null) => {
  editingCategory.value = null;
  categoryForm.value = {
    ...defaultForm(),
    parentId: parent?.id || null,
  };
  showCategoryDialog.value = true;
};

const editCategory = (category: Category) => {
  editingCategory.value = category;
  categoryForm.value = {
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    parentId: category.parentId || null,
    image: category.image || '',
    isActive: category.isActive,
  };
  showCategoryDialog.value = true;
};

const closeCategoryDialog = () => {
  showCategoryDialog.value = false;
  editingCategory.value = null;
  categoryForm.value = defaultForm();
};

const saveCategory = async () => {
  if (!categoryForm.value.name) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Il nome è obbligatorio',
      life: 3000,
    });
    return;
  }

  saving.value = true;
  try {
    const data = {
      name: categoryForm.value.name,
      slug: categoryForm.value.slug || undefined,
      description: categoryForm.value.description || null,
      parentId: categoryForm.value.parentId || null,
      image: categoryForm.value.image || null,
      isActive: categoryForm.value.isActive,
    };

    if (editingCategory.value) {
      await api.put(`/product-categories/${editingCategory.value.id}`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiornata',
        detail: 'Categoria aggiornata',
        life: 2000,
      });
    } else {
      await api.post('/product-categories', data);
      toast.add({
        severity: 'success',
        summary: 'Creata',
        detail: 'Categoria creata',
        life: 2000,
      });
    }

    closeCategoryDialog();
    await loadCategories();

    // Ricarica dettagli se modificata categoria selezionata
    if (selectedCategory.value?.id === editingCategory.value?.id) {
      onNodeSelect({ data: { id: selectedCategory.value.id } });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante il salvataggio',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (category: Category) => {
  confirm.require({
    message: `Eliminare la categoria "${category.name}"? Le sottocategorie verranno spostate al livello superiore.`,
    header: 'Conferma Eliminazione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteCategory(category),
  });
};

const deleteCategory = async (category: Category) => {
  try {
    await api.delete(`/product-categories/${category.id}`);
    toast.add({
      severity: 'success',
      summary: 'Eliminata',
      detail: 'Categoria eliminata',
      life: 2000,
    });

    if (selectedCategory.value?.id === category.id) {
      selectedCategory.value = null;
      selectedKeys.value = {};
    }

    await loadCategories();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante eliminazione',
      life: 3000,
    });
  }
};

const syncWithWordPress = () => {
  syncResult.value = null;
  showSyncDialog.value = true;
};

const doSync = async (direction: 'import' | 'export') => {
  syncDirection.value = direction;
  syncing.value = true;
  syncResult.value = null;

  try {
    let response;
    if (direction === 'import') {
      response = await api.post('/wordpress/import-categories', {});
    } else {
      response = await api.post('/wordpress/export-categories', {});
    }

    syncResult.value = {
      success: response.success,
      message: response.success
        ? `${direction === 'import' ? 'Importate' : 'Esportate'} ${response.data?.count || 0} categorie`
        : response.error || 'Errore sync',
    };

    if (response.success) {
      await loadCategories();
    }
  } catch (error: any) {
    syncResult.value = {
      success: false,
      message: error.message || 'Errore durante la sincronizzazione',
    };
  } finally {
    syncing.value = false;
    syncDirection.value = null;
  }
};

onMounted(() => {
  loadCategories();
});
</script>

<style scoped>
.product-categories {
  max-width: 1400px;
  margin: 0 auto;
}

.categories-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.tree-panel,
.detail-panel {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--color-gray-50);
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-gray-800);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: var(--space-8);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
  color: var(--color-gray-500);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state p {
  margin: 0 0 var(--space-4) 0;
}

.category-tree {
  padding: var(--space-4);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  width: 100%;
}

.node-name {
  font-weight: 500;
  color: var(--color-gray-800);
}

.node-badges {
  display: flex;
  gap: var(--space-1);
}

.count-tag,
.wc-tag {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
}

.node-actions {
  margin-left: auto;
  display: flex;
  gap: 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tree-node:hover .node-actions {
  opacity: 1;
}

/* Detail Panel */
.detail-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-detail {
  text-align: center;
  color: var(--color-gray-400);
}

.empty-detail i {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
}

.empty-detail p {
  margin: 0;
}

.category-details {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-row label {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-gray-500);
  text-transform: uppercase;
}

.detail-row p {
  margin: 0;
  color: var(--color-gray-700);
}

.detail-row code {
  font-family: monospace;
  background: var(--color-gray-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
}

.category-image {
  max-width: 150px;
  border-radius: var(--border-radius-md);
}

.products-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-color);
}

.products-section h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-gray-700);
}

.detail-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-color);
}

/* Form */
.category-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field label {
  font-weight: 500;
  color: var(--color-gray-700);
  font-size: var(--font-size-sm);
}

.hint {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

.checkbox-field {
  flex-direction: row;
  align-items: center;
}

.checkbox-field label {
  margin-left: var(--space-2);
}

/* Sync Dialog */
.sync-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sync-options p {
  margin: 0;
  color: var(--color-gray-600);
}

.sync-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.w-full {
  width: 100%;
}

/* Responsive */
@media (max-width: 1024px) {
  .categories-layout {
    grid-template-columns: 1fr;
  }
}
</style>
