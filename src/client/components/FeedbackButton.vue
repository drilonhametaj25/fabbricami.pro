<template>
  <div class="feedback-floating">
    <Button
      icon="pi pi-comment"
      class="p-button-rounded p-button-info feedback-btn"
      v-tooltip.left="'Invia una segnalazione'"
      @click="showDialog = true"
    />

    <Dialog
      v-model:visible="showDialog"
      :header="'Invia una segnalazione'"
      :modal="true"
      :style="{ width: '520px' }"
      :draggable="false"
    >
      <div class="feedback-form">
        <div class="field">
          <label for="type">Tipo *</label>
          <Dropdown
            id="type"
            v-model="form.type"
            :options="typeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleziona un tipo"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="priority">Priorità</label>
          <Dropdown
            id="priority"
            v-model="form.priority"
            :options="priorityOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="title">Titolo *</label>
          <InputText
            id="title"
            v-model="form.title"
            placeholder="Riassumi in poche parole"
            class="w-full"
            maxlength="200"
          />
        </div>

        <div class="field">
          <label for="description">Descrizione *</label>
          <Textarea
            id="description"
            v-model="form.description"
            placeholder="Dettagli, passaggi per riprodurre, screenshot URL..."
            rows="6"
            class="w-full"
            maxlength="5000"
          />
        </div>

        <small class="hint">
          La segnalazione verrà inviata al team. Riceverai notifiche via email sugli aggiornamenti di stato.
        </small>
      </div>

      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showDialog = false" :disabled="submitting" />
        <Button label="Invia" icon="pi pi-send" :loading="submitting" :disabled="!isValid" @click="submit" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

const toast = useToast();
const showDialog = ref(false);
const submitting = ref(false);

const form = reactive({
  type: 'BUG' as 'BUG' | 'FEATURE_REQUEST' | 'IMPROVEMENT' | 'SUPPORT',
  priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH',
  title: '',
  description: '',
});

const typeOptions = [
  { label: 'Bug / Errore', value: 'BUG' },
  { label: 'Richiesta funzionalità', value: 'FEATURE_REQUEST' },
  { label: 'Miglioramento', value: 'IMPROVEMENT' },
  { label: 'Supporto', value: 'SUPPORT' },
];

const priorityOptions = [
  { label: 'Bassa', value: 'LOW' },
  { label: 'Normale', value: 'NORMAL' },
  { label: 'Alta', value: 'HIGH' },
];

const isValid = computed(() =>
  form.title.trim().length >= 3 && form.description.trim().length >= 10 && !!form.type
);

const reset = () => {
  form.type = 'BUG';
  form.priority = 'NORMAL';
  form.title = '';
  form.description = '';
};

const submit = async () => {
  if (!isValid.value) return;
  submitting.value = true;
  try {
    await api.post('/tickets', { ...form });
    toast.add({
      severity: 'success',
      summary: 'Segnalazione inviata',
      detail: 'Grazie! Ti aggiorneremo via email sugli sviluppi.',
      life: 4000,
    });
    showDialog.value = false;
    reset();
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error?.message || 'Impossibile inviare la segnalazione',
      life: 5000,
    });
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.feedback-floating {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}

.feedback-btn {
  width: 56px !important;
  height: 56px !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.feedback-form .field {
  margin-bottom: 16px;
}

.feedback-form label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  font-size: 14px;
  color: #374151;
}

.feedback-form .hint {
  display: block;
  margin-top: 12px;
  color: #6b7280;
  font-size: 12px;
}
</style>
