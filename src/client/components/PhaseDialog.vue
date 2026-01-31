<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="isEditing ? 'Modifica Fase' : 'Nuova Fase'"
    :modal="true"
    :style="{ width: '700px' }"
    :closable="!saving"
  >
    <form @submit.prevent="savePhase" class="space-y-4">
      <!-- Sezione Base -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo Operazione <span class="text-red-500">*</span>
          </label>
          <Dropdown
            v-model="form.operationTypeId"
            :options="operationTypes"
            optionLabel="name"
            optionValue="id"
            placeholder="Seleziona tipo"
            class="w-full"
            :class="{ 'p-invalid': errors.operationTypeId }"
            @change="onOperationTypeChange"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <Tag
                  :value="option.isExternal ? 'Esterno' : 'Interno'"
                  :severity="option.isExternal ? 'warning' : 'info'"
                  class="text-xs"
                />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </Dropdown>
          <small v-if="errors.operationTypeId" class="p-error">{{ errors.operationTypeId }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nome Fase <span class="text-red-500">*</span>
          </label>
          <InputText
            v-model="form.name"
            class="w-full"
            :class="{ 'p-invalid': errors.name }"
            placeholder="es. Assemblaggio componenti"
          />
          <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrizione</label>
        <Textarea
          v-model="form.description"
          class="w-full"
          rows="2"
          placeholder="Descrizione della fase..."
        />
      </div>

      <!-- Tempi -->
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tempo Standard (min) <span class="text-red-500">*</span>
          </label>
          <InputNumber
            v-model="form.standardTime"
            class="w-full"
            :class="{ 'p-invalid': errors.standardTime }"
            :min="1"
            suffix=" min"
          />
          <small v-if="errors.standardTime" class="p-error">{{ errors.standardTime }}</small>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tempo Setup (min)</label>
          <InputNumber
            v-model="form.setupTime"
            class="w-full"
            :min="0"
            suffix=" min"
          />
        </div>

        <div v-if="selectedOperationType?.isExternal">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Costo Esterno/Unità</label>
          <InputNumber
            v-model="form.externalCostPerUnit"
            mode="currency"
            currency="EUR"
            locale="it-IT"
            class="w-full"
            :minFractionDigits="2"
          />
        </div>
      </div>

      <!-- Fornitore (se esterno) -->
      <div v-if="selectedOperationType?.isExternal">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fornitore/Terzista</label>
        <Dropdown
          v-model="form.supplierId"
          :options="suppliers"
          optionLabel="name"
          optionValue="id"
          placeholder="Seleziona fornitore"
          class="w-full"
          showClear
          filter
        />
      </div>

      <!-- Materiali -->
      <div class="border-t pt-4">
        <div class="flex justify-between items-center mb-3">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Materiali</label>
          <Button
            label="Aggiungi Materiale"
            icon="pi pi-plus"
            class="p-button-text p-button-sm"
            @click="addMaterial"
          />
        </div>

        <div v-if="form.materials.length === 0" class="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded">
          <p class="text-sm text-gray-500 dark:text-gray-400">Nessun materiale aggiunto</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(mat, index) in form.materials"
            :key="index"
            class="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-700 p-2 rounded"
          >
            <div class="col-span-4">
              <Dropdown
                v-model="mat.materialId"
                :options="materials"
                optionLabel="name"
                optionValue="id"
                placeholder="Materiale"
                class="w-full p-inputtext-sm"
                filter
              >
                <template #option="{ option }">
                  <div>
                    <span class="font-medium">{{ option.name }}</span>
                    <span class="text-xs text-gray-500 ml-2">({{ option.sku }})</span>
                  </div>
                </template>
              </Dropdown>
            </div>

            <div class="col-span-2">
              <InputNumber
                v-model="mat.quantity"
                placeholder="Qtà"
                class="w-full p-inputtext-sm"
                :min="0.001"
                :minFractionDigits="0"
                :maxFractionDigits="3"
              />
            </div>

            <div class="col-span-2">
              <InputText
                v-model="mat.unit"
                placeholder="Unità"
                class="w-full p-inputtext-sm"
              />
            </div>

            <div class="col-span-2">
              <InputNumber
                v-model="mat.scrapPercentage"
                placeholder="Scarto %"
                class="w-full p-inputtext-sm"
                suffix="%"
                :min="0"
                :max="100"
              />
            </div>

            <div class="col-span-2 flex gap-1">
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger p-button-sm"
                @click="removeMaterial(index)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Dipendenti -->
      <div class="border-t pt-4">
        <div class="flex justify-between items-center mb-3">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Dipendenti Qualificati</label>
          <Button
            label="Aggiungi Dipendente"
            icon="pi pi-plus"
            class="p-button-text p-button-sm"
            @click="addEmployee"
          />
        </div>

        <div v-if="form.employees.length === 0" class="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded">
          <p class="text-sm text-gray-500 dark:text-gray-400">Nessun dipendente assegnato</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(emp, index) in form.employees"
            :key="index"
            class="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-700 p-2 rounded"
          >
            <div class="col-span-6">
              <Dropdown
                v-model="emp.employeeId"
                :options="employees"
                optionLabel="fullName"
                optionValue="id"
                placeholder="Dipendente"
                class="w-full p-inputtext-sm"
                filter
              >
                <template #option="{ option }">
                  <div>
                    <span class="font-medium">{{ option.fullName }}</span>
                    <span class="text-xs text-gray-500 ml-2">{{ formatCurrency(option.hourlyRate || 0) }}/h</span>
                  </div>
                </template>
              </Dropdown>
            </div>

            <div class="col-span-4 flex items-center gap-2">
              <Checkbox v-model="emp.isPrimary" binary :inputId="`primary-${index}`" />
              <label :for="`primary-${index}`" class="text-sm text-gray-700 dark:text-gray-300">Primario</label>
            </div>

            <div class="col-span-2">
              <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger p-button-sm"
                @click="removeEmployee(index)"
              />
            </div>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <Button
        label="Annulla"
        icon="pi pi-times"
        class="p-button-text"
        @click="$emit('update:visible', false)"
        :disabled="saving"
      />
      <Button
        :label="isEditing ? 'Salva' : 'Crea'"
        icon="pi pi-check"
        @click="savePhase"
        :loading="saving"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

interface Phase {
  id: string;
  operationTypeId: string;
  name: string;
  description?: string;
  standardTime: number;
  setupTime?: number;
  externalCostPerUnit?: number;
  supplierId?: string;
  materials?: Array<{
    materialId: string;
    quantity: number;
    unit: string;
    scrapPercentage?: number;
  }>;
  employees?: Array<{
    employeeId: string;
    isPrimary: boolean;
  }>;
}

interface OperationType {
  id: string;
  code: string;
  name: string;
  isExternal: boolean;
  defaultHourlyRate?: number;
}

interface Material {
  id: string;
  sku: string;
  name: string;
  unit: string;
  cost: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  hourlyRate?: number;
}

interface Supplier {
  id: string;
  name: string;
}

const props = defineProps<{
  visible: boolean;
  phase?: Phase | null;
  productId: string;
}>();

const emit = defineEmits(['update:visible', 'saved']);

const toast = useToast();

const saving = ref(false);
const operationTypes = ref<OperationType[]>([]);
const materials = ref<Material[]>([]);
const employees = ref<Employee[]>([]);
const suppliers = ref<Supplier[]>([]);

const form = ref({
  operationTypeId: '',
  name: '',
  description: '',
  standardTime: null as number | null,
  setupTime: null as number | null,
  externalCostPerUnit: null as number | null,
  supplierId: null as string | null,
  materials: [] as Array<{
    materialId: string;
    quantity: number;
    unit: string;
    scrapPercentage: number;
  }>,
  employees: [] as Array<{
    employeeId: string;
    isPrimary: boolean;
  }>,
});

const errors = ref<Record<string, string>>({});

const isEditing = computed(() => !!props.phase?.id);

const selectedOperationType = computed(() =>
  operationTypes.value.find((t) => t.id === form.value.operationTypeId)
);

const loadData = async () => {
  try {
    const [opTypesRes, matsRes, empsRes, suppliersRes] = await Promise.all([
      api.get('/operation-types'),
      api.get('/materials'),
      api.get('/employees'),
      api.get('/suppliers'),
    ]);

    operationTypes.value = opTypesRes.data.data || [];
    materials.value = matsRes.data.data || [];
    employees.value = (empsRes.data.data || []).map((e: any) => ({
      ...e,
      fullName: `${e.firstName} ${e.lastName}`,
    }));
    suppliers.value = suppliersRes.data.data || [];
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: 'Errore nel caricamento dati',
      life: 3000,
    });
  }
};

const resetForm = () => {
  form.value = {
    operationTypeId: '',
    name: '',
    description: '',
    standardTime: null,
    setupTime: null,
    externalCostPerUnit: null,
    supplierId: null,
    materials: [],
    employees: [],
  };
  errors.value = {};
};

const loadPhaseData = () => {
  if (props.phase) {
    form.value = {
      operationTypeId: props.phase.operationTypeId || '',
      name: props.phase.name || '',
      description: props.phase.description || '',
      standardTime: props.phase.standardTime || null,
      setupTime: props.phase.setupTime || null,
      externalCostPerUnit: props.phase.externalCostPerUnit || null,
      supplierId: props.phase.supplierId || null,
      materials: (props.phase.materials || []).map((m: any) => ({
        materialId: m.materialId || m.material?.id,
        quantity: m.quantity,
        unit: m.unit,
        scrapPercentage: m.scrapPercentage || 0,
      })),
      employees: (props.phase.employees || []).map((e: any) => ({
        employeeId: e.employeeId || e.employee?.id,
        isPrimary: e.isPrimary || false,
      })),
    };
  } else {
    resetForm();
  }
  errors.value = {};
};

const onOperationTypeChange = () => {
  const opType = selectedOperationType.value;
  if (opType && !form.value.name) {
    form.value.name = opType.name;
  }
  if (!opType?.isExternal) {
    form.value.externalCostPerUnit = null;
    form.value.supplierId = null;
  }
};

const addMaterial = () => {
  form.value.materials.push({
    materialId: '',
    quantity: 1,
    unit: 'pz',
    scrapPercentage: 0,
  });
};

const removeMaterial = (index: number) => {
  form.value.materials.splice(index, 1);
};

const addEmployee = () => {
  form.value.employees.push({
    employeeId: '',
    isPrimary: form.value.employees.length === 0,
  });
};

const removeEmployee = (index: number) => {
  form.value.employees.splice(index, 1);
};

const validateForm = () => {
  errors.value = {};

  if (!form.value.operationTypeId) {
    errors.value.operationTypeId = 'Tipo operazione obbligatorio';
  }
  if (!form.value.name?.trim()) {
    errors.value.name = 'Nome obbligatorio';
  }
  if (!form.value.standardTime || form.value.standardTime <= 0) {
    errors.value.standardTime = 'Tempo standard obbligatorio';
  }

  return Object.keys(errors.value).length === 0;
};

const savePhase = async () => {
  if (!validateForm()) return;

  saving.value = true;
  try {
    const payload = {
      operationTypeId: form.value.operationTypeId,
      name: form.value.name,
      description: form.value.description || undefined,
      standardTime: form.value.standardTime,
      setupTime: form.value.setupTime || undefined,
      externalCostPerUnit: form.value.externalCostPerUnit || undefined,
      supplierId: form.value.supplierId || undefined,
      materials: form.value.materials
        .filter((m) => m.materialId && m.quantity > 0)
        .map((m) => ({
          materialId: m.materialId,
          quantity: m.quantity,
          unit: m.unit,
          scrapPercentage: m.scrapPercentage || undefined,
        })),
      employees: form.value.employees
        .filter((e) => e.employeeId)
        .map((e) => ({
          employeeId: e.employeeId,
          isPrimary: e.isPrimary,
        })),
    };

    if (isEditing.value && props.phase?.id) {
      await api.patch(`/manufacturing/phases/${props.phase.id}`, payload);
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: 'Fase aggiornata',
        life: 3000,
      });
    } else {
      await api.post(`/manufacturing/products/${props.productId}/phases`, {
        ...payload,
        sequence: 999, // Will be adjusted by backend
      });
      toast.add({
        severity: 'success',
        summary: 'Successo',
        detail: 'Fase creata',
        life: 3000,
      });
    }

    emit('saved');
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.response?.data?.error || 'Errore nel salvataggio',
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadData();
    loadPhaseData();
  }
});

onMounted(() => {
  if (props.visible) {
    loadData();
    loadPhaseData();
  }
});
</script>
