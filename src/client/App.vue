<template>
  <Toast />
  <ConfirmDialog />
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useAuthStore } from './stores/auth.store';

const authStore = useAuthStore();

onMounted(async () => {
  // Check if user is logged in
  try {
    await authStore.checkAuth();
  } catch (error) {
    console.error('Auth check failed:', error);
  }
});
</script>
