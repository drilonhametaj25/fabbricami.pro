<template>
  <Dialog
    v-model:visible="visible"
    :header="isEdit ? 'Modifica Dipendente' : 'Nuovo Dipendente'"
    :modal="true"
    :style="{ width: '600px', maxWidth: '95vw' }"
    @hide="onHide"
  >
    <div class="form-grid">
      <!-- Nome e Cognome -->
      <div class="field-group">
        <div class="field">
          <label for="firstName">Nome *</label>
          <InputText id="firstName" v-model="form.firstName" class="w-full" />
        </div>
        <div class="field">
          <label for="lastName">Cognome *</label>
          <InputText id="lastName" v-model="form.lastName" class="w-full" />
        </div>
      </div>

      <!-- Email -->
      <div class="field">
        <label for="email">Email *</label>
        <InputText id="email" v-model="form.email" class="w-full" type="email" />
      </div>

      <!-- Password (solo creazione) -->
      <div class="field" v-if="!isEdit">
        <label for="password">Password *</label>
        <Password id="password" v-model="form.password" class="w-full" toggleMask :feedback="false" />
        <small class="help-text">Lascia vuoto per generare una password temporanea</small>
      </div>

      <!-- Posizione / Mansione -->
      <div class="field">
        <label for="position">Posizione / Mansione *</label>
        <InputText id="position" v-model="form.position" class="w-full" placeholder="Es. Operatore, Magazziniere, etc." />
      </div>

      <!-- Costo Orario (solo per ruoli autorizzati) -->
      <div class="field" v-if="canSeeCost">
        <label for="hourlyRate">Costo Orario (€/h)</label>
        <InputNumber
          id="hourlyRate"
          v-model="form.hourlyRate"
          mode="currency"
          currency="EUR"
          locale="it-IT"
          class="w-full"
          :minFractionDigits="2"
          :maxFractionDigits="2"
        />
      </div>

      <!-- Data Assunzione -->
      <div class="field">
        <label for="hireDate">Data Assunzione *</label>
        <Calendar
          id="hireDate"
          v-model="form.hireDate"
          class="w-full"
          dateFormat="dd/mm/yy"
          showIcon
        />
      </div>

      <!-- Stato Attivo -->
      <div class="field">
        <div class="flex align-items-center">
          <Checkbox id="isActive" v-model="form.isActive" :binary="true" />
          <label for="isActive" class="ml-2">Dipendente Attivo</label>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="visible = false" />
        <Button
          :label="isEdit ? 'Salva' : 'Crea'"
          icon="pi pi-check"
          :loading="loading"
          @click="save"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Password from 'primevue/password';
import Calendar from 'primevue/calendar';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '../stores/auth.store';

interface Props {
  modelValue: boolean;
  employee?: any;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', employee: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  employee: null
});

const emit = defineEmits<Emits>();
const toast = useToast();
const authStore = useAuthStore();

const visible = ref(props.modelValue);
const loading = ref(false);
const isEdit = computed(() => !!props.employee);

// Verifica se l'utente può vedere/modificare il costo orario
const canSeeCost = computed(() => {
  const user = authStore.user as any;
  if (!user) return false;
  return ['ADMIN', 'MANAGER', 'CONTABILE'].includes(user.role);
});

const getDefaultForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  position: '',
  hourlyRate: 0,
  hireDate: new Date(),
  isActive: true,
});

const form = ref(getDefaultForm());

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val && props.employee) {
    // Editing existing employee
    form.value = {
      firstName: props.employee.user?.firstName || '',
      lastName: props.employee.user?.lastName || '',
      email: props.employee.user?.email || '',
      password: '',
      position: props.employee.position || '',
      hourlyRate: props.employee.hourlyRate ? Number(props.employee.hourlyRate) : 0,
      hireDate: props.employee.hireDate ? new Date(props.employee.hireDate) : new Date(),
      isActive: props.employee.isActive ?? true,
    };
  } else {
    resetForm();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const resetForm = () => {
  form.value = getDefaultForm();
};

const onHide = () => {
  resetForm();
};

const validateForm = (): boolean => {
  if (!form.value.firstName?.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validazione',
      detail: 'Il nome è obbligatorio',
      life: 3000,
    });
    return false;
  }
  if (!form.value.lastName?.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validazione',
      detail: 'Il cognome è obbligatorio',
      life: 3000,
    });
    return false;
  }
  if (!form.value.email?.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validazione',
      detail: 'L\'email è obbligatoria',
      life: 3000,
    });
    return false;
  }
  if (!form.value.position?.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validazione',
      detail: 'La posizione è obbligatoria',
      life: 3000,
    });
    return false;
  }
  if (!form.value.hireDate) {
    toast.add({
      severity: 'warn',
      summary: 'Validazione',
      detail: 'La data di assunzione è obbligatoria',
      life: 3000,
    });
    return false;
  }
  return true;
};

const save = () => {
  if (!validateForm()) return;

  loading.value = true;

  // Prepara i dati da inviare
  const employeeData: any = {
    firstName: form.value.firstName.trim(),
    lastName: form.value.lastName.trim(),
    email: form.value.email.trim(),
    position: form.value.position.trim(),
    hireDate: form.value.hireDate.toISOString().split('T')[0],
    isActive: form.value.isActive,
  };

  // Aggiungi password solo in creazione e se fornita
  if (!isEdit.value && form.value.password) {
    employeeData.password = form.value.password;
  }

  // Aggiungi costo orario solo se l'utente può vederlo
  if (canSeeCost.value) {
    employeeData.hourlyCost = form.value.hourlyRate;
  }

  // Se in modifica, aggiungi l'id
  if (isEdit.value && props.employee?.id) {
    employeeData.id = props.employee.id;
  }

  emit('save', employeeData);

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

.help-text {
  color: #64748b;
  font-size: 0.8rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Override per password input full width */
:deep(.p-password) {
  width: 100%;
}

:deep(.p-password-input) {
  width: 100%;
}

/* Override Calendar full width */
:deep(.p-calendar) {
  width: 100%;
}

:deep(.p-inputtext) {
  width: 100%;
}
</style>
