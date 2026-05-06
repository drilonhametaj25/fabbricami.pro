<template>
  <div class="forbidden">
    <div class="forbidden-card">
      <i class="pi pi-lock forbidden-icon" />
      <h1>Accesso negato</h1>
      <p class="forbidden-subtitle">
        Non hai i permessi per accedere a questa sezione.
      </p>
      <p v-if="userRole" class="forbidden-role">
        Ruolo attuale: <strong>{{ userRole }}</strong>
      </p>
      <p class="forbidden-help">
        Se ritieni sia un errore, contatta l'amministratore del tuo account.
      </p>
      <div class="forbidden-actions">
        <Button label="Torna alla dashboard" icon="pi pi-home" @click="goHome" />
        <Button
          label="Logout"
          icon="pi pi-sign-out"
          severity="secondary"
          outlined
          @click="logout"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import { useAuthStore } from '../stores/auth.store';
import { storeToRefs } from 'pinia';

const router = useRouter();
const authStore = useAuthStore();
const { userRole } = storeToRefs(authStore);

function goHome() {
  router.push('/');
}

async function logout() {
  await authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.forbidden {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
}

.forbidden-card {
  max-width: 480px;
  text-align: center;
  padding: 3rem 2rem;
  background: var(--surface-card);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.forbidden-icon {
  font-size: 4rem;
  color: var(--red-500);
  margin-bottom: 1.5rem;
  display: block;
}

.forbidden-card h1 {
  font-size: 1.75rem;
  margin: 0 0 0.5rem;
  color: var(--text-color);
}

.forbidden-subtitle {
  color: var(--text-color-secondary);
  margin: 0 0 1rem;
}

.forbidden-role {
  font-size: 0.95rem;
  color: var(--text-color-secondary);
  margin: 0 0 0.5rem;
}

.forbidden-help {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  margin: 0 0 2rem;
}

.forbidden-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
