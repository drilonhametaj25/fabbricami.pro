import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api.service';
import type { User, TenantWithSubscription, SubscriptionSummary } from '../types';

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  tenant?: TenantWithSubscription;
}

interface MeResponse {
  user: User;
  tenant?: TenantWithSubscription;
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref(localStorage.getItem('token') || '');
  const refreshToken = ref(localStorage.getItem('refreshToken') || '');
  const tenant = ref<TenantWithSubscription | null>(null);

  // Auth Getters
  const isAuthenticated = computed(() => !!token.value);

  const userRole = computed(() => user.value?.role || 'VIEWER');

  const userName = computed(() => {
    if (!user.value) return '';
    return `${user.value.firstName} ${user.value.lastName}`;
  });

  const userInitials = computed(() => {
    if (!user.value) return '';
    const first = user.value.firstName?.charAt(0) || '';
    const last = user.value.lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
  });

  // Tenant Getters
  const tenantId = computed(() => tenant.value?.id || '');

  const tenantSlug = computed(() => tenant.value?.slug || '');

  const tenantName = computed(() => tenant.value?.name || '');

  const tenantStatus = computed(() => tenant.value?.status || 'ACTIVE');

  const isTenantActive = computed(() => tenant.value?.status === 'ACTIVE');

  // Subscription Getters
  const subscription = computed<SubscriptionSummary | null>(
    () => tenant.value?.subscription || null
  );

  const planCode = computed(() => subscription.value?.planCode || 'STARTER');

  const planName = computed(() => subscription.value?.planName || 'Starter');

  const subscriptionStatus = computed(
    () => subscription.value?.status || 'TRIALING'
  );

  const isTrialing = computed(() => subscription.value?.status === 'TRIALING');

  const isSubscriptionActive = computed(
    () =>
      subscription.value?.status === 'ACTIVE' ||
      subscription.value?.status === 'TRIALING'
  );

  const isPastDue = computed(() => subscription.value?.status === 'PAST_DUE');

  // Actions
  async function login(email: string, password: string) {
    const response = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });

    if (response.success) {
      user.value = response.data.user;
      token.value = response.data.token;
      refreshToken.value = response.data.refreshToken;
      tenant.value = response.data.tenant || null;

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
    tenant.value = null;

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  async function checkAuth() {
    if (!token.value) return false;

    try {
      const response = await api.get<MeResponse>('/auth/me');
      if (response.success) {
        user.value = response.data.user;
        tenant.value = response.data.tenant || null;
        return true;
      }
      return false;
    } catch (error) {
      await logout();
      return false;
    }
  }

  async function refreshTenant() {
    try {
      const response = await api.get<TenantWithSubscription>('/tenant');
      if (response.success) {
        tenant.value = response.data;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function setTenant(tenantData: TenantWithSubscription | null) {
    tenant.value = tenantData;
  }

  function hasRole(roles: string | string[]): boolean {
    if (!user.value) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.value.role);
  }

  function isAdmin(): boolean {
    return user.value?.role === 'ADMIN';
  }

  function isManager(): boolean {
    return user.value?.role === 'ADMIN' || user.value?.role === 'MANAGER';
  }

  return {
    // State
    user,
    token,
    refreshToken,
    tenant,

    // Auth Getters
    isAuthenticated,
    userRole,
    userName,
    userInitials,

    // Tenant Getters
    tenantId,
    tenantSlug,
    tenantName,
    tenantStatus,
    isTenantActive,

    // Subscription Getters
    subscription,
    planCode,
    planName,
    subscriptionStatus,
    isTrialing,
    isSubscriptionActive,
    isPastDue,

    // Actions
    login,
    logout,
    checkAuth,
    refreshTenant,
    setTenant,
    hasRole,
    isAdmin,
    isManager,
  };
});
