<template>
  <div class="product-materials">
    <div class="materials-header">
      <p class="materials-description">
        Gestisci la composizione del prodotto per etichettatura e tracciabilità.
      </p>
      <Button
        label="Aggiungi Materiale"
        icon="pi pi-plus"
        size="small"
        @click="openAddMaterial"
        :disabled="!productId"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>

    <!-- Empty State -->
    <div v-else-if="materials.length === 0" class="empty-state">
      <i class="pi pi-box"></i>
      <p>Nessun materiale associato a questo prodotto</p>
      <small>Aggiungi i materiali che compongono questo prodotto per la tracciabilità e l'etichettatura</small>
    </div>

    <!-- Materials List -->
    <div v-else class="materials-list">
      <DataTable
        :value="materials"
        responsiveLayout="scroll"
        class="materials-table"
        :reorderableRows="true"
        @row-reorder="onRowReorder"
      >
        <Column :rowReorder="true" headerStyle="width: 3rem" :reorderableColumn="false" />

        <Column header="Materiale">
          <template #body="{ data }">
            <div class="material-info">
              <span class="material-name">{{ data.material.name }}</span>
              <span class="material-sku">{{ data.material.sku }}</span>
            </div>
          </template>
        </Column>

        <Column header="Quantità" style="width: 120px">
          <template #body="{ data }">
            <span>{{ data.quantity }} {{ data.unit }}</span>
          </template>
        </Column>

        <Column header="%" style="width: 80px">
          <template #body="{ data }">
            <Tag v-if="data.percentage" :value="`${data.percentage}%`" severity="info" />
            <span v-else class="text-muted">-</span>
          </template>
        </Column>

        <Column header="Principale" style="width: 100px">
          <template #body="{ data }">
            <Tag v-if="data.isMainIngredient" value="Si" severity="success" />
          </template>
        </Column>

        <Column header="Origine" style="width: 120px">
          <template #body="{ data }">
            <span v-if="data.origin">{{ data.origin }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>

        <Column header="Certificazioni" style="width: 150px">
          <template #body="{ data }">
            <div v-if="data.certifications?.length" class="tags-list">
              <Tag
                v-for="cert in data.certifications"
                :key="cert"
                :value="cert"
                severity="success"
                class="cert-tag"
              />
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>

        <Column header="Allergeni" style="width: 150px">
          <template #body="{ data }">
            <div v-if="data.allergens?.length" class="tags-list">
              <Tag
                v-for="allergen in data.allergens"
                :key="allergen"
                :value="allergen"
                severity="danger"
                class="allergen-tag"
              />
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </Column>

        <Column header="Azioni" style="width: 100px">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-pencil"
                class="p-button-text p-button-sm"
                @click="editMaterial(data)"
                v-tooltip="'Modifica'"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-sm p-button-danger"
                @click="confirmDelete(data)"
                v-tooltip="'Rimuovi'"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <!-- Totale Percentuale -->
      <div v-if="totalPercentage > 0" class="percentage-total" :class="{ warning: totalPercentage !== 100 }">
        <span>Totale percentuale: <strong>{{ totalPercentage }}%</strong></span>
        <small v-if="totalPercentage !== 100">(La somma dovrebbe essere 100%)</small>
      </div>
    </div>

    <!-- Dialog Aggiungi/Modifica Materiale -->
    <Dialog
      v-model:visible="showMaterialDialog"
      :header="editingMaterial ? 'Modifica Materiale' : 'Aggiungi Materiale'"
      :style="{ width: '550px' }"
      modal
    >
      <div class="material-form">
        <div class="field" v-if="!editingMaterial">
          <label for="materialSelect">Materiale *</label>
          <Dropdown
            id="materialSelect"
            v-model="materialForm.materialId"
            :options="availableMaterials"
            optionLabel="name"
            optionValue="id"
            placeholder="Seleziona materiale"
            filter
            class="w-full"
            :loading="loadingMaterials"
          >
            <template #option="{ option }">
              <div class="material-option">
                <span class="option-name">{{ option.name }}</span>
                <span class="option-sku">{{ option.sku }}</span>
              </div>
            </template>
          </Dropdown>
        </div>

        <div v-else class="field">
          <label>Materiale</label>
          <div class="selected-material">
            <strong>{{ editingMaterial.material.name }}</strong>
            <small>{{ editingMaterial.material.sku }}</small>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="quantity">Quantità *</label>
            <InputNumber
              id="quantity"
              v-model="materialForm.quantity"
              :minFractionDigits="0"
              :maxFractionDigits="4"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="unit">Unità</label>
            <Dropdown
              id="unit"
              v-model="materialForm.unit"
              :options="unitOptions"
              placeholder="Seleziona"
              class="w-full"
            />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="percentage">Percentuale (%)</label>
            <InputNumber
              id="percentage"
              v-model="materialForm.percentage"
              suffix="%"
              :min="0"
              :max="100"
              :minFractionDigits="0"
              :maxFractionDigits="2"
              class="w-full"
            />
          </div>
          <div class="field checkbox-field">
            <Checkbox v-model="materialForm.isMainIngredient" binary inputId="isMain" />
            <label for="isMain">Ingrediente principale</label>
          </div>
        </div>

        <div class="field">
          <label for="origin">Origine</label>
          <InputText
            id="origin"
            v-model="materialForm.origin"
            placeholder="es. Italia, UE, non-UE"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="certifications">Certificazioni</label>
          <Chips
            v-model="materialForm.certifications"
            placeholder="Aggiungi certificazione (es. BIO, DOP)"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="allergens">Allergeni</label>
          <MultiSelect
            v-model="materialForm.allergens"
            :options="allergenOptions"
            placeholder="Seleziona allergeni"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="notes">Note</label>
          <Textarea
            id="notes"
            v-model="materialForm.notes"
            rows="2"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="closeMaterialDialog" />
        <Button
          :label="editingMaterial ? 'Aggiorna' : 'Aggiungi'"
          icon="pi pi-check"
          :loading="saving"
          @click="saveMaterial"
        />
      </template>
    </Dialog>

    <!-- Confirm Delete -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Chips from 'primevue/chips';
import MultiSelect from 'primevue/multiselect';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import ProgressSpinner from 'primevue/progressspinner';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Props {
  productId?: string;
}

const props = defineProps<Props>();

const confirm = useConfirm();
const toast = useToast();

const loading = ref(false);
const saving = ref(false);
const loadingMaterials = ref(false);
const materials = ref<any[]>([]);
const availableMaterials = ref<any[]>([]);
const showMaterialDialog = ref(false);
const editingMaterial = ref<any>(null);

const unitOptions = ['pz', 'kg', 'g', 'mg', 'l', 'ml', 'm', 'cm', 'mm'];

const allergenOptions = [
  'Glutine',
  'Crostacei',
  'Uova',
  'Pesce',
  'Arachidi',
  'Soia',
  'Latte',
  'Frutta a guscio',
  'Sedano',
  'Senape',
  'Sesamo',
  'Anidride solforosa',
  'Lupini',
  'Molluschi',
];

const defaultForm = () => ({
  materialId: '',
  quantity: 1,
  unit: 'pz',
  percentage: null as number | null,
  isMainIngredient: false,
  origin: '',
  certifications: [] as string[],
  allergens: [] as string[],
  notes: '',
});

const materialForm = ref(defaultForm());

const totalPercentage = computed(() => {
  return materials.value.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);
});

// Load product materials
const loadMaterials = async () => {
  if (!props.productId) return;

  loading.value = true;
  try {
    const response = await api.get(`/products/${props.productId}/materials`);
    if (response.success) {
      materials.value = response.data;
    }
  } catch (error) {
    console.error('Error loading materials:', error);
  } finally {
    loading.value = false;
  }
};

// Load available materials for dropdown
const loadAvailableMaterials = async () => {
  loadingMaterials.value = true;
  try {
    const response = await api.get('/materials?limit=1000');
    if (response.success) {
      availableMaterials.value = response.data;
    }
  } catch (error) {
    console.error('Error loading available materials:', error);
  } finally {
    loadingMaterials.value = false;
  }
};

const openAddMaterial = () => {
  editingMaterial.value = null;
  materialForm.value = defaultForm();
  showMaterialDialog.value = true;
  if (availableMaterials.value.length === 0) {
    loadAvailableMaterials();
  }
};

const editMaterial = (material: any) => {
  editingMaterial.value = material;
  materialForm.value = {
    materialId: material.materialId,
    quantity: Number(material.quantity),
    unit: material.unit,
    percentage: material.percentage ? Number(material.percentage) : null,
    isMainIngredient: material.isMainIngredient,
    origin: material.origin || '',
    certifications: material.certifications || [],
    allergens: material.allergens || [],
    notes: material.notes || '',
  };
  showMaterialDialog.value = true;
};

const closeMaterialDialog = () => {
  showMaterialDialog.value = false;
  editingMaterial.value = null;
  materialForm.value = defaultForm();
};

const saveMaterial = async () => {
  if (!props.productId) return;

  if (!editingMaterial.value && !materialForm.value.materialId) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Seleziona un materiale',
      life: 3000,
    });
    return;
  }

  saving.value = true;
  try {
    const data = {
      materialId: editingMaterial.value ? editingMaterial.value.materialId : materialForm.value.materialId,
      quantity: materialForm.value.quantity,
      unit: materialForm.value.unit,
      percentage: materialForm.value.percentage,
      isMainIngredient: materialForm.value.isMainIngredient,
      origin: materialForm.value.origin || null,
      certifications: materialForm.value.certifications,
      allergens: materialForm.value.allergens,
      notes: materialForm.value.notes || null,
    };

    if (editingMaterial.value) {
      await api.put(`/products/${props.productId}/materials/${editingMaterial.value.materialId}`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiornato',
        detail: 'Materiale aggiornato',
        life: 2000,
      });
    } else {
      await api.post(`/products/${props.productId}/materials`, data);
      toast.add({
        severity: 'success',
        summary: 'Aggiunto',
        detail: 'Materiale aggiunto al prodotto',
        life: 2000,
      });
    }

    closeMaterialDialog();
    await loadMaterials();
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

const confirmDelete = (material: any) => {
  confirm.require({
    message: `Rimuovere "${material.material.name}" dalla composizione?`,
    header: 'Conferma Rimozione',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => deleteMaterial(material),
  });
};

const deleteMaterial = async (material: any) => {
  if (!props.productId) return;

  try {
    await api.delete(`/products/${props.productId}/materials/${material.materialId}`);
    toast.add({
      severity: 'success',
      summary: 'Rimosso',
      detail: 'Materiale rimosso dal prodotto',
      life: 2000,
    });
    await loadMaterials();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore durante la rimozione',
      life: 3000,
    });
  }
};

const onRowReorder = async (event: any) => {
  materials.value = event.value;

  if (!props.productId) return;

  // Save new order
  const materialIds = materials.value.map((m) => m.materialId);
  try {
    await api.put(`/products/${props.productId}/materials/reorder`, { materialIds });
  } catch (error) {
    console.error('Error reordering:', error);
    // Reload to get correct order
    await loadMaterials();
  }
};

// Watch for productId changes
watch(
  () => props.productId,
  (newId) => {
    if (newId) {
      loadMaterials();
    } else {
      materials.value = [];
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.productId) {
    loadMaterials();
  }
});
</script>

<style scoped>
.product-materials {
  padding: 1rem 0;
}

.materials-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.materials-description {
  margin: 0;
  color: var(--color-gray-600, #64748b);
  font-size: 0.9rem;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--color-gray-500, #64748b);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.empty-state small {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.materials-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.material-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.material-name {
  font-weight: 500;
}

.material-sku {
  font-size: 0.8rem;
  color: var(--color-gray-500, #64748b);
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.cert-tag,
.allergen-tag {
  font-size: 0.7rem;
}

.text-muted {
  color: var(--color-gray-400, #94a3b8);
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.percentage-total {
  padding: 0.75rem 1rem;
  background: var(--color-success-light, #d1fae5);
  border-radius: var(--border-radius-md, 0.5rem);
  text-align: center;
  color: var(--color-success-dark, #065f46);
}

.percentage-total.warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.percentage-total small {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

/* Form Styles */
.material-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
  color: var(--color-gray-700, #374151);
  font-size: 0.9rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.checkbox-field {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  padding-top: 1.5rem;
}

.checkbox-field label {
  margin-left: 0.5rem;
}

.selected-material {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: var(--color-gray-100, #f1f5f9);
  border-radius: var(--border-radius-sm, 0.25rem);
}

.selected-material small {
  color: var(--color-gray-500, #64748b);
}

.material-option {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.option-name {
  font-weight: 500;
}

.option-sku {
  color: var(--color-gray-500, #64748b);
  font-size: 0.85rem;
}

.w-full {
  width: 100%;
}
</style>
