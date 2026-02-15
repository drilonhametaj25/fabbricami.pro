import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api.service';
import type {
  TenantWithSubscription,
  TenantMember,
  TenantInvite,
  UserRole,
} from '../types';

export const useTenantStore = defineStore('tenant', () => {
  // State
  const currentTenant = ref<TenantWithSubscription | null>(null);
  const members = ref<TenantMember[]>([]);
  const pendingInvites = ref<TenantInvite[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const activeMembers = computed(() =>
    members.value.filter((m) => m.acceptedAt !== null)
  );

  const adminMembers = computed(() =>
    members.value.filter((m) => m.role === 'ADMIN')
  );

  const tenantName = computed(() => currentTenant.value?.name || '');

  const tenantSlug = computed(() => currentTenant.value?.slug || '');

  const tenantId = computed(() => currentTenant.value?.id || '');

  const isActive = computed(() => currentTenant.value?.status === 'ACTIVE');

  const memberCount = computed(() => currentTenant.value?.memberCount || 0);

  // Actions
  async function fetchTenant() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<TenantWithSubscription>('/tenant');
      if (response.success) {
        currentTenant.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento tenant';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento tenant';
    } finally {
      loading.value = false;
    }
  }

  async function updateTenant(data: Partial<TenantWithSubscription>) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.patch<TenantWithSubscription>('/tenant', data);
      if (response.success) {
        currentTenant.value = response.data;
        return true;
      } else {
        error.value = response.error || 'Errore aggiornamento tenant';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento tenant';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMembers() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<TenantMember[]>('/tenant/members');
      if (response.success) {
        members.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento membri';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento membri';
    } finally {
      loading.value = false;
    }
  }

  async function updateMemberRole(userId: string, role: UserRole) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.patch(`/tenant/members/${userId}`, { role });
      if (response.success) {
        // Aggiorna membro localmente
        const memberIndex = members.value.findIndex((m) => m.userId === userId);
        if (memberIndex !== -1) {
          members.value[memberIndex].role = role;
        }
        return true;
      } else {
        error.value = response.error || 'Errore aggiornamento ruolo';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore aggiornamento ruolo';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function removeMember(userId: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.delete(`/tenant/members/${userId}`);
      if (response.success) {
        // Rimuovi membro localmente
        members.value = members.value.filter((m) => m.userId !== userId);
        return true;
      } else {
        error.value = response.error || 'Errore rimozione membro';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore rimozione membro';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPendingInvites() {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.get<TenantInvite[]>('/tenant/invites');
      if (response.success) {
        pendingInvites.value = response.data;
      } else {
        error.value = response.error || 'Errore caricamento inviti';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore caricamento inviti';
    } finally {
      loading.value = false;
    }
  }

  async function inviteUser(email: string, role: UserRole) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<TenantInvite>('/tenant/invites', { email, role });
      if (response.success) {
        pendingInvites.value.push(response.data);
        return true;
      } else {
        error.value = response.error || 'Errore invio invito';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore invio invito';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function cancelInvite(inviteId: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.delete(`/tenant/invites/${inviteId}`);
      if (response.success) {
        pendingInvites.value = pendingInvites.value.filter((i) => i.id !== inviteId);
        return true;
      } else {
        error.value = response.error || 'Errore cancellazione invito';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore cancellazione invito';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function resendInvite(inviteId: string) {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post<TenantInvite>(`/tenant/invites/${inviteId}/resend`);
      if (response.success) {
        // Aggiorna invito con nuova scadenza
        const inviteIndex = pendingInvites.value.findIndex((i) => i.id === inviteId);
        if (inviteIndex !== -1) {
          pendingInvites.value[inviteIndex] = response.data;
        }
        return true;
      } else {
        error.value = response.error || 'Errore reinvio invito';
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore reinvio invito';
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function checkSlugAvailable(slug: string): Promise<boolean> {
    try {
      const response = await api.get<{ available: boolean }>(`/tenant/check-slug/${slug}`);
      return response.success && response.data.available;
    } catch {
      return false;
    }
  }

  function setTenant(tenant: TenantWithSubscription | null) {
    currentTenant.value = tenant;
  }

  function reset() {
    currentTenant.value = null;
    members.value = [];
    pendingInvites.value = [];
    loading.value = false;
    error.value = null;
  }

  return {
    // State
    currentTenant,
    members,
    pendingInvites,
    loading,
    error,

    // Getters
    activeMembers,
    adminMembers,
    tenantName,
    tenantSlug,
    tenantId,
    isActive,
    memberCount,

    // Actions
    fetchTenant,
    updateTenant,
    fetchMembers,
    updateMemberRole,
    removeMember,
    fetchPendingInvites,
    inviteUser,
    cancelInvite,
    resendInvite,
    checkSlugAvailable,
    setTenant,
    reset,
  };
});
