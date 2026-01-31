import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api.service';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(localStorage.getItem('token') || '');
  const refreshToken = ref(localStorage.getItem('refreshToken') || '');

  const isAuthenticated = computed(() => !!token.value);

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    
    if (response.success) {
      user.value = response.data.user;
      token.value = response.data.token;
      refreshToken.value = response.data.refreshToken;
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    
    return response;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignora errori, facciamo logout comunque
    }
    
    user.value = null;
    token.value = '';
    refreshToken.value = '';
    
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  async function checkAuth() {
    if (!token.value) return;
    
    try {
      const response = await api.get('/auth/me');
      if (response.success) {
        user.value = response.data;
      }
    } catch (error) {
      logout();
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };
});
