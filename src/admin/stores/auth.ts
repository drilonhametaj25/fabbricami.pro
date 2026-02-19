import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { adminApi } from '../services/api';

export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
}

export const useAuthStore = defineStore('auth', () => {
  const superAdmin = ref<SuperAdmin | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value && !!superAdmin.value);

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const response = await adminApi.login(email, password);

      if (response.success && response.data) {
        superAdmin.value = response.data.superAdmin;
        accessToken.value = response.data.tokens.accessToken;
        refreshToken.value = response.data.tokens.refreshToken;

        // Save to localStorage
        localStorage.setItem('admin_token', accessToken.value);
        localStorage.setItem('admin_refresh_token', refreshToken.value);
        localStorage.setItem('admin_user', JSON.stringify(superAdmin.value));

        return true;
      }

      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async function setup(email: string, password: string, name: string): Promise<boolean> {
    try {
      const response = await adminApi.setup(email, password, name);

      if (response.success && response.data) {
        superAdmin.value = response.data.superAdmin;
        accessToken.value = response.data.tokens.accessToken;
        refreshToken.value = response.data.tokens.refreshToken;

        // Save to localStorage
        localStorage.setItem('admin_token', accessToken.value);
        localStorage.setItem('admin_refresh_token', refreshToken.value);
        localStorage.setItem('admin_user', JSON.stringify(superAdmin.value));

        return true;
      }

      return false;
    } catch (error) {
      console.error('Setup failed:', error);
      return false;
    }
  }

  function logout() {
    superAdmin.value = null;
    accessToken.value = null;
    refreshToken.value = null;

    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
  }

  function loadFromStorage() {
    const token = localStorage.getItem('admin_token');
    const refresh = localStorage.getItem('admin_refresh_token');
    const userStr = localStorage.getItem('admin_user');

    if (token && refresh && userStr) {
      try {
        accessToken.value = token;
        refreshToken.value = refresh;
        superAdmin.value = JSON.parse(userStr);
      } catch (e) {
        logout();
      }
    }
  }

  function getToken(): string | null {
    return accessToken.value;
  }

  return {
    superAdmin,
    accessToken,
    isAuthenticated,
    login,
    setup,
    logout,
    loadFromStorage,
    getToken,
  };
});
