<template>
  <div class="profile-page">
    <PageHeader
      title="Il mio profilo"
      subtitle="Gestisci le tue informazioni personali e la sicurezza"
      icon="pi pi-user"
    />

    <div class="profile-grid">
      <!-- Profile Info -->
      <section class="card">
        <h3 class="card-title">
          <i class="pi pi-id-card"></i>
          Informazioni personali
        </h3>
        <div class="field-grid">
          <div class="field">
            <label>Email</label>
            <InputText :value="authStore.user?.email" disabled class="w-full" />
            <small class="hint">L'email non è modificabile</small>
          </div>
          <div class="field">
            <label>Ruolo</label>
            <InputText :value="authStore.user?.role" disabled class="w-full" />
          </div>
          <div class="field">
            <label>Nome *</label>
            <InputText v-model="profile.firstName" class="w-full" />
          </div>
          <div class="field">
            <label>Cognome *</label>
            <InputText v-model="profile.lastName" class="w-full" />
          </div>
        </div>
        <div class="actions">
          <Button
            label="Salva modifiche"
            icon="pi pi-save"
            :loading="savingProfile"
            :disabled="!profile.firstName || !profile.lastName"
            @click="saveProfile"
          />
        </div>
      </section>

      <!-- Change Password -->
      <section class="card">
        <h3 class="card-title">
          <i class="pi pi-lock"></i>
          Cambio password
        </h3>
        <div class="field-grid single">
          <div class="field">
            <label>Password attuale *</label>
            <Password v-model="pw.current" :feedback="false" toggleMask class="w-full" />
          </div>
          <div class="field">
            <label>Nuova password *</label>
            <Password v-model="pw.next" toggleMask class="w-full" />
            <small class="hint">Minimo 8 caratteri, almeno 1 maiuscola, 1 minuscola, 1 numero</small>
          </div>
          <div class="field">
            <label>Conferma nuova password *</label>
            <Password v-model="pw.confirm" :feedback="false" toggleMask class="w-full" />
          </div>
        </div>
        <div class="actions">
          <Button
            label="Cambia password"
            icon="pi pi-shield"
            :loading="changingPassword"
            :disabled="!canChangePassword"
            @click="changePassword"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import { useToast } from 'primevue/usetoast';
import PageHeader from '../components/PageHeader.vue';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api.service';

const authStore = useAuthStore();
const toast = useToast();

const profile = reactive({
  firstName: '',
  lastName: '',
});
const savingProfile = ref(false);

const pw = reactive({
  current: '',
  next: '',
  confirm: '',
});
const changingPassword = ref(false);

const canChangePassword = computed(
  () => pw.current && pw.next && pw.next === pw.confirm && pw.next.length >= 8
);

onMounted(() => {
  profile.firstName = (authStore.user as any)?.firstName || '';
  profile.lastName = (authStore.user as any)?.lastName || '';
});

const saveProfile = async () => {
  savingProfile.value = true;
  try {
    await api.patch('/auth/me', profile);
    toast.add({ severity: 'success', summary: 'Salvato', detail: 'Profilo aggiornato', life: 3000 });
    await authStore.fetchProfile?.();
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: error?.message || 'Errore salvataggio', life: 5000 });
  } finally {
    savingProfile.value = false;
  }
};

const changePassword = async () => {
  if (!canChangePassword.value) return;
  changingPassword.value = true;
  try {
    await api.post('/auth/change-password', {
      currentPassword: pw.current,
      newPassword: pw.next,
    });
    toast.add({ severity: 'success', summary: 'Password aggiornata', life: 3000 });
    pw.current = '';
    pw.next = '';
    pw.confirm = '';
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: error?.message || 'Errore cambio password', life: 5000 });
  } finally {
    changingPassword.value = false;
  }
};
</script>

<style scoped>
.profile-page {
  padding: 24px;
}

.profile-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr 1fr;
  max-width: 1100px;
}

@media (max-width: 900px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title i {
  color: #6b7280;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field-grid.single {
  grid-template-columns: 1fr;
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-weight: 500;
  font-size: 14px;
  color: #374151;
  margin-bottom: 6px;
}

.hint {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
