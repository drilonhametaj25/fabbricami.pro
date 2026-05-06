import { computed, type ComputedRef } from 'vue';
import { useAuthStore } from '../stores/auth.store';
import type { UserRole } from '../types';

/**
 * RBAC permissions composable
 *
 * Espone helper reattivi per il gating UI in base al ruolo dell'utente
 * loggato e al piano sottoscritto. Usato sia nei layout (gating menu)
 * sia nelle pagine (gating bottoni/azioni).
 *
 * I 7 ruoli del sistema:
 * - ADMIN        : accesso completo
 * - MANAGER      : tutto tranne config sistema (settings/billing/team)
 * - CONTABILE    : contabilità, reportistica, clienti
 * - MAGAZZINIERE : magazzino, inventario, movimenti
 * - OPERATORE    : task assegnati, timesheet, produzione
 * - COMMERCIALE  : clienti, ordini, vendite
 * - VIEWER       : sola lettura, report
 */

// Matrice ruolo → moduli accessibili. Mantienila allineata con
// `meta.roles` nelle route e con il backend `authorize(...)` middleware.
export const ROLE_MODULES: Record<UserRole, readonly string[]> = {
  ADMIN: [
    'dashboard', 'products', 'product-categories', 'materials', 'warehouses',
    'inventory', 'suppliers', 'purchase-orders', 'goods-receipts',
    'orders', 'customers', 'pricelists', 'invoices', 'ddt', 'rma',
    'accounting', 'reports', 'analytics', 'tasks', 'employees',
    'operation-types', 'production-orders', 'manufacturing', 'logistics',
    'wordpress', 'notifications', 'calendar', 'settings', 'billing', 'team',
    'sdi', 'three-way-match',
  ],
  MANAGER: [
    'dashboard', 'products', 'product-categories', 'materials', 'warehouses',
    'inventory', 'suppliers', 'purchase-orders', 'goods-receipts',
    'orders', 'customers', 'pricelists', 'invoices', 'ddt', 'rma',
    'accounting', 'reports', 'analytics', 'tasks', 'employees',
    'operation-types', 'production-orders', 'manufacturing', 'logistics',
    'wordpress', 'notifications', 'calendar',
    'sdi', 'three-way-match',
  ],
  CONTABILE: [
    'dashboard', 'customers', 'invoices', 'accounting', 'reports',
    'notifications', 'calendar', 'sdi',
  ],
  MAGAZZINIERE: [
    'dashboard', 'products', 'materials', 'warehouses', 'inventory',
    'goods-receipts', 'purchase-orders', 'orders', 'ddt', 'rma',
    'logistics', 'notifications', 'calendar',
  ],
  OPERATORE: [
    'dashboard', 'tasks', 'production-orders', 'manufacturing',
    'notifications', 'calendar',
  ],
  COMMERCIALE: [
    'dashboard', 'products', 'product-categories', 'customers', 'orders',
    'pricelists', 'rma', 'reports', 'analytics',
    'notifications', 'calendar',
  ],
  VIEWER: [
    'dashboard', 'reports', 'analytics', 'notifications', 'calendar',
  ],
};

export interface UsePermissionsReturn {
  role: ComputedRef<UserRole>;
  planCode: ComputedRef<string>;

  hasRole: (roles: UserRole | UserRole[]) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  hasFeature: (featureKey: string) => boolean;

  isAdmin: ComputedRef<boolean>;
  isManager: ComputedRef<boolean>;
  isContabile: ComputedRef<boolean>;
  isMagazziniere: ComputedRef<boolean>;
  isOperatore: ComputedRef<boolean>;
  isCommerciale: ComputedRef<boolean>;
  isViewer: ComputedRef<boolean>;

  isReadOnly: ComputedRef<boolean>;
}

// Mapping piano → feature flag. Mantenere allineato con backend
// `subscription.middleware.ts`.
const PLAN_FEATURES: Record<string, readonly string[]> = {
  STARTER: ['inventory', 'orders', 'customers', 'basic_reports'],
  PRO: [
    'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
    'manufacturing', 'hr', 'advanced_reports', 'wordpress_sync',
  ],
  BUSINESS: [
    'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
    'manufacturing', 'hr', 'accounting', 'sdi', 'advanced_reports',
    'wordpress_sync', 'api_access', 'custom_integrations',
  ],
};

export function usePermissions(): UsePermissionsReturn {
  const authStore = useAuthStore();

  const role = computed<UserRole>(() => (authStore.userRole as UserRole) || 'VIEWER');
  const planCode = computed(() => authStore.planCode || 'STARTER');

  function hasRole(roles: UserRole | UserRole[]): boolean {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(role.value);
  }

  function canAccessModule(moduleKey: string): boolean {
    const allowedModules = ROLE_MODULES[role.value] ?? [];
    return allowedModules.includes(moduleKey);
  }

  function hasFeature(featureKey: string): boolean {
    const features = PLAN_FEATURES[planCode.value] ?? PLAN_FEATURES.STARTER;
    return features.includes(featureKey);
  }

  const isAdmin = computed(() => role.value === 'ADMIN');
  const isManager = computed(() => role.value === 'ADMIN' || role.value === 'MANAGER');
  const isContabile = computed(() => role.value === 'CONTABILE');
  const isMagazziniere = computed(() => role.value === 'MAGAZZINIERE');
  const isOperatore = computed(() => role.value === 'OPERATORE');
  const isCommerciale = computed(() => role.value === 'COMMERCIALE');
  const isViewer = computed(() => role.value === 'VIEWER');

  // VIEWER è in sola lettura su tutti i moduli; gli altri hanno write
  // dove il loro ruolo lo prevede (l'enforcement vero è server-side).
  const isReadOnly = computed(() => role.value === 'VIEWER');

  return {
    role,
    planCode,
    hasRole,
    canAccessModule,
    hasFeature,
    isAdmin,
    isManager,
    isContabile,
    isMagazziniere,
    isOperatore,
    isCommerciale,
    isViewer,
    isReadOnly,
  };
}
