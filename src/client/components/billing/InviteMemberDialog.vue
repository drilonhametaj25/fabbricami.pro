<template>
  <Dialog
    v-model:visible="modelValue"
    header="Invita Membro del Team"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="invite-member-dialog"
    :style="{ width: '500px' }"
  >
    <form @submit.prevent="handleSubmit" class="invite-form">
      <div class="form-field">
        <label for="email">Email *</label>
        <InputText
          id="email"
          v-model="form.email"
          type="email"
          class="w-full"
          :class="{ 'p-invalid': errors.email }"
          placeholder="nome@azienda.it"
        />
        <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
      </div>

      <div class="form-field">
        <label for="role">Ruolo *</label>
        <Dropdown
          id="role"
          v-model="form.role"
          :options="roleOptions"
          optionLabel="label"
          optionValue="value"
          class="w-full"
          :class="{ 'p-invalid': errors.role }"
          placeholder="Seleziona un ruolo"
        />
        <small v-if="errors.role" class="p-error">{{ errors.role }}</small>
      </div>

      <div v-if="selectedRoleDescription" class="role-description">
        <i class="pi pi-info-circle"></i>
        <span>{{ selectedRoleDescription }}</span>
      </div>

      <div v-if="showUsageWarning" class="usage-warning">
        <i class="pi pi-exclamation-triangle"></i>
        <div class="warning-content">
          <span class="warning-title">Limite utenti vicino</span>
          <span class="warning-text">
            Hai {{ usersRemaining }} {{ usersRemaining === 1 ? 'invito rimanente' : 'inviti rimanenti' }} nel tuo piano.
          </span>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Annulla"
          severity="secondary"
          @click="modelValue = false"
        />
        <Button
          label="Invia Invito"
          icon="pi pi-send"
          :loading="loading"
          :disabled="!canInvite"
          @click="handleSubmit"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import { usePlanLimits } from '../../composables/usePlanLimits';
import type { UserRole } from '../../types';

interface InviteData {
  email: string;
  role: UserRole;
}

const modelValue = defineModel<boolean>({ default: false });

const emit = defineEmits<{
  invite: [data: InviteData];
}>();

const { usage, canCreateUser } = usePlanLimits();

const loading = ref(false);

const form = reactive({
  email: '',
  role: '' as UserRole | '',
});

const errors = reactive({
  email: '',
  role: '',
});

const roleOptions = [
  { value: 'ADMIN', label: 'Amministratore' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'CONTABILE', label: 'Contabile' },
  { value: 'MAGAZZINIERE', label: 'Magazziniere' },
  { value: 'OPERATORE', label: 'Operatore' },
  { value: 'COMMERCIALE', label: 'Commerciale' },
  { value: 'VIEWER', label: 'Visualizzatore' },
];

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Accesso completo a tutte le funzionalit\u00e0, inclusa gestione team e fatturazione.',
  MANAGER: 'Gestione operativa completa, escluse impostazioni di sistema.',
  CONTABILE: 'Accesso a contabilit\u00e0, fatturazione, report e anagrafica clienti.',
  MAGAZZINIERE: 'Gestione magazzino, inventario e movimenti merce.',
  OPERATORE: 'Esecuzione task assegnati e registrazione tempi.',
  COMMERCIALE: 'Gestione clienti, ordini e attivit\u00e0 commerciali.',
  VIEWER: 'Accesso in sola lettura a report e dashboard.',
};

const selectedRoleDescription = computed(() => {
  return form.role ? roleDescriptions[form.role] : '';
});

const usersRemaining = computed(() => {
  if (!usage.value?.users) return 0;
  return usage.value.users.limit - usage.value.users.current;
});

const showUsageWarning = computed(() => {
  if (!usage.value?.users) return false;
  return usage.value.users.percentage >= 80;
});

const canInvite = computed(() => {
  return canCreateUser.value;
});

function validate(): boolean {
  let isValid = true;
  errors.email = '';
  errors.role = '';

  if (!form.email.trim()) {
    errors.email = 'Email obbligatoria';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email non valida';
    isValid = false;
  }

  if (!form.role) {
    errors.role = 'Seleziona un ruolo';
    isValid = false;
  }

  return isValid;
}

async function handleSubmit() {
  if (!validate()) return;

  loading.value = true;
  try {
    emit('invite', {
      email: form.email,
      role: form.role as UserRole,
    });
    // Reset form
    form.email = '';
    form.role = '';
    modelValue.value = false;
  } finally {
    loading.value = false;
  }
}

// Reset form when dialog opens
watch(modelValue, (visible) => {
  if (visible) {
    form.email = '';
    form.role = '';
    errors.email = '';
    errors.role = '';
  }
});
</script>

<style scoped>
.invite-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-2) 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-gray-700);
}

.role-description {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-primary-50);
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-primary-700);
}

.role-description i {
  margin-top: 2px;
  flex-shrink: 0;
}

.usage-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-warning-light);
  border-radius: var(--border-radius-md);
  border: var(--border-width) solid var(--color-warning);
}

.usage-warning i {
  color: var(--color-warning);
  font-size: 1.25rem;
  margin-top: 2px;
  flex-shrink: 0;
}

.warning-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.warning-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-warning-dark);
}

.warning-text {
  font-size: var(--font-size-sm);
  color: var(--color-warning-dark);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
