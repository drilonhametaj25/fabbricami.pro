import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api.service';
import type { UserRole } from '../types';

// Role groups per la matrice permessi (allineata con usePermissions.ts)
const ALL_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'CONTABILE', 'MAGAZZINIERE', 'OPERATORE', 'COMMERCIALE', 'VIEWER'];
const STAFF: UserRole[] = ['ADMIN', 'MANAGER'];
const STAFF_AND_WAREHOUSE: UserRole[] = ['ADMIN', 'MANAGER', 'MAGAZZINIERE'];
const STAFF_AND_SALES: UserRole[] = ['ADMIN', 'MANAGER', 'COMMERCIALE'];
const STAFF_AND_ACCOUNTING: UserRole[] = ['ADMIN', 'MANAGER', 'CONTABILE'];
const PRODUCT_VIEWERS: UserRole[] = ['ADMIN', 'MANAGER', 'MAGAZZINIERE', 'COMMERCIALE'];
const ORDER_VIEWERS: UserRole[] = ['ADMIN', 'MANAGER', 'COMMERCIALE', 'MAGAZZINIERE'];
const CUSTOMER_VIEWERS: UserRole[] = ['ADMIN', 'MANAGER', 'COMMERCIALE', 'CONTABILE'];
const REPORT_VIEWERS: UserRole[] = ['ADMIN', 'MANAGER', 'CONTABILE', 'VIEWER'];
const ANALYTICS_VIEWERS: UserRole[] = ['ADMIN', 'MANAGER', 'COMMERCIALE', 'VIEWER'];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ===== PUBLIC AUTH ROUTES =====
    {
      path: '/login',
      name: 'Login',
      component: () => import('../pages/Login.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../pages/auth/Register.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/verify-email',
      name: 'VerifyEmailToken',
      component: () => import('../pages/auth/VerifyEmailToken.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/reset-password',
      name: 'ResetPassword',
      component: () => import('../pages/auth/ResetPassword.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/accept-invite',
      name: 'AcceptInvite',
      component: () => import('../pages/auth/AcceptInvite.vue'),
      meta: { requiresAuth: false },
    },


    // ===== ONBOARDING ROUTES =====
    {
      path: '/onboarding',
      component: () => import('../pages/onboarding/OnboardingLayout.vue'),
      meta: { requiresAuth: true, isOnboarding: true },
      children: [
        {
          path: '',
          redirect: '/onboarding/verify-email',
        },
        {
          path: 'verify-email',
          name: 'OnboardingVerifyEmail',
          component: () => import('../pages/onboarding/VerifyEmail.vue'),
        },
        {
          path: 'company-settings',
          name: 'OnboardingCompanySettings',
          component: () => import('../pages/onboarding/CompanySettings.vue'),
        },
        {
          path: 'setup-billing',
          name: 'OnboardingSetupBilling',
          component: () => import('../pages/onboarding/SetupBilling.vue'),
        },
        {
          path: 'wordpress-integration',
          name: 'OnboardingWordPressIntegration',
          component: () => import('../pages/onboarding/WordPressIntegration.vue'),
        },
        {
          path: 'create-warehouse',
          name: 'OnboardingCreateWarehouse',
          component: () => import('../pages/onboarding/CreateWarehouse.vue'),
        },
        {
          path: 'complete',
          name: 'OnboardingComplete',
          component: () => import('../pages/onboarding/Complete.vue'),
        },
      ],
    },

    // ===== MAIN APP ROUTES =====
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'DashboardToday',
          component: () => import('../pages/DashboardToday.vue'),
        },
        {
          path: '/dashboard',
          name: 'Dashboard',
          component: () => import('../pages/Dashboard.vue'),
        },
        {
          path: '/test',
          name: 'Test',
          component: () => import('../pages/Test.vue'),
        },
        {
          path: '/products',
          name: 'Products',
          component: () => import('../pages/Products.vue'),
          meta: { roles: PRODUCT_VIEWERS },
        },
        {
          // Alias /products/new -> Products page che apre il dialog "Nuovo Prodotto"
          path: '/products/new',
          name: 'ProductNew',
          component: () => import('../pages/Products.vue'),
          meta: { roles: PRODUCT_VIEWERS },
        },
        {
          path: '/product-categories',
          name: 'ProductCategories',
          component: () => import('../pages/ProductCategories.vue'),
          meta: { roles: STAFF_AND_SALES },
        },
        {
          path: '/warehouses',
          name: 'Warehouses',
          component: () => import('../pages/Warehouses.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/inventory',
          name: 'Inventory',
          component: () => import('../pages/Inventory.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/orders',
          name: 'Orders',
          component: () => import('../pages/Orders.vue'),
          meta: { roles: ORDER_VIEWERS },
        },
        {
          // Alias /orders/new -> Orders page con flag per aprire dialog Nuovo Ordine
          // (gestito da Orders.vue tramite query/state `?new=1`)
          path: '/orders/new',
          name: 'OrderNew',
          component: () => import('../pages/Orders.vue'),
          meta: { roles: ORDER_VIEWERS },
        },
        {
          path: '/customers',
          name: 'Customers',
          component: () => import('../pages/Customers.vue'),
          meta: { roles: CUSTOMER_VIEWERS },
        },
        {
          path: '/customers/:id',
          name: 'CustomerDetail',
          component: () => import('../pages/CustomerDetail.vue'),
          meta: { roles: CUSTOMER_VIEWERS },
        },
        {
          path: '/pricelists',
          name: 'PriceLists',
          component: () => import('../pages/PriceLists.vue'),
          meta: { roles: STAFF_AND_SALES },
        },
        {
          // Alias storico: redirect /price-lists -> /pricelists per evitare 404
          path: '/price-lists',
          redirect: '/pricelists',
        },
        {
          path: '/accounting',
          name: 'Accounting',
          component: () => import('../pages/Accounting.vue'),
          meta: { roles: STAFF_AND_ACCOUNTING },
        },
        {
          path: '/tasks',
          name: 'Tasks',
          component: () => import('../pages/Tasks.vue'),
          meta: { roles: ALL_ROLES },
        },
        {
          // Alias /tasks/new -> Tasks page che apre il dialog "Nuovo Task"
          path: '/tasks/new',
          name: 'TaskNew',
          component: () => import('../pages/Tasks.vue'),
          meta: { roles: ALL_ROLES },
        },
        {
          path: '/employees',
          name: 'Employees',
          component: () => import('../pages/Employees.vue'),
          meta: { roles: STAFF },
        },
        {
          path: '/analytics',
          name: 'Analytics',
          component: () => import('../pages/Analytics.vue'),
          meta: { roles: ANALYTICS_VIEWERS },
        },
        {
          path: '/suppliers',
          name: 'Suppliers',
          component: () => import('../pages/Suppliers.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/purchase-orders',
          name: 'PurchaseOrders',
          component: () => import('../pages/PurchaseOrders.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/goods-receipts',
          name: 'GoodsReceipts',
          component: () => import('../pages/GoodsReceipts.vue'),
          meta: { roles: ['ADMIN', 'MANAGER', 'MAGAZZINIERE'] },
        },
        {
          path: '/notifications',
          name: 'Notifications',
          component: () => import('../pages/Notifications.vue'),
          meta: { roles: ALL_ROLES },
        },
        {
          path: '/calendar',
          name: 'CalendarEvents',
          component: () => import('../pages/CalendarEvents.vue'),
          meta: { roles: ALL_ROLES },
        },
        {
          path: '/materials',
          name: 'Materials',
          component: () => import('../pages/Materials.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/operation-types',
          name: 'OperationTypes',
          component: () => import('../pages/OperationTypes.vue'),
          meta: { roles: STAFF },
        },
        {
          path: '/production-orders',
          name: 'ProductionOrders',
          component: () => import('../pages/ProductionOrders.vue'),
          meta: { roles: ['ADMIN', 'MANAGER', 'OPERATORE'] },
        },
        {
          path: '/wordpress',
          name: 'WordPress',
          component: () => import('../pages/WordPressSettings.vue'),
          meta: { roles: STAFF },
        },
        {
          path: '/logistics',
          name: 'Logistics',
          component: () => import('../pages/Logistics.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/settings',
          name: 'CompanySettings',
          component: () => import('../pages/CompanySettings.vue'),
          meta: { roles: ['ADMIN'] },
        },
        {
          path: '/settings/billing',
          name: 'Billing',
          component: () => import('../pages/Billing.vue'),
          meta: { roles: ['ADMIN'] },
        },
        {
          path: '/settings/team',
          name: 'TeamMembers',
          component: () => import('../pages/TeamMembers.vue'),
          meta: { roles: ['ADMIN'] },
        },
        {
          path: '/feedback',
          name: 'MyFeedback',
          component: () => import('../pages/MyFeedback.vue'),
        },
        {
          path: '/profile',
          name: 'Profile',
          component: () => import('../pages/Profile.vue'),
        },
        {
          path: '/invoices',
          name: 'Invoices',
          component: () => import('../pages/Invoices.vue'),
          meta: { roles: STAFF_AND_ACCOUNTING },
        },
        {
          path: '/ddt',
          name: 'DDT',
          component: () => import('../pages/DDT.vue'),
          meta: { roles: STAFF_AND_WAREHOUSE },
        },
        {
          path: '/reports',
          name: 'Reports',
          component: () => import('../pages/Reports.vue'),
          meta: { roles: REPORT_VIEWERS },
        },
        {
          path: '/mrp/capacity',
          name: 'MrpCapacity',
          component: () => import('../pages/MrpCapacity.vue'),
          meta: { roles: STAFF },
        },
        {
          path: '/forbidden',
          name: 'Forbidden',
          component: () => import('../pages/Forbidden.vue'),
          meta: { roles: ALL_ROLES },
        },
      ],
    },
  ],
});

// Cache for onboarding status
let onboardingStatusCache: { status: string | null; timestamp: number } = {
  status: null,
  timestamp: 0,
};
const CACHE_DURATION = 60000; // 1 minute

async function checkOnboardingStatus(): Promise<string | null> {
  const now = Date.now();

  // Return cached status if still valid
  if (onboardingStatusCache.status !== null && now - onboardingStatusCache.timestamp < CACHE_DURATION) {
    return onboardingStatusCache.status;
  }

  try {
    const response = await api.get<{ success: boolean; data: { currentStep: string } }>(
      '/onboarding/status'
    );
    if (response.success && response.data) {
      onboardingStatusCache = {
        status: response.data.currentStep,
        timestamp: now,
      };
      return response.data.currentStep;
    }
  } catch {
    // If API fails, assume onboarding is complete
    return 'complete';
  }

  return 'complete';
}

// Clear onboarding cache (call this after completing onboarding steps)
export function clearOnboardingCache() {
  onboardingStatusCache = { status: null, timestamp: 0 };
}

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth !== false;
  const isOnboardingRoute = to.meta.isOnboarding === true;

  // Not authenticated - redirect to login for protected routes
  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login');
    return;
  }

  // We have a token but user not loaded yet (page reload, freshly verified
  // email, etc.). Load user + tenant from /auth/me before continuing so the
  // UI shows the correct identity instead of the "Admin User" fallback.
  if (authStore.isAuthenticated && !authStore.user) {
    const ok = await authStore.checkAuth();
    if (!ok && requiresAuth) {
      next('/login');
      return;
    }
  }

  // Authenticated - redirect away from login
  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/');
    return;
  }

  // Authenticated - check onboarding status for non-onboarding routes
  if (authStore.isAuthenticated && !isOnboardingRoute && to.path !== '/login') {
    const currentStep = await checkOnboardingStatus();

    // If onboarding not complete, redirect to current step
    if (currentStep && currentStep !== 'complete') {
      const onboardingPath = `/onboarding/${currentStep}`;
      if (to.path !== onboardingPath) {
        next(onboardingPath);
        return;
      }
    }
  }

  // Onboarding routes - check if user should be on this step
  if (isOnboardingRoute && authStore.isAuthenticated) {
    const currentStep = await checkOnboardingStatus();

    // If onboarding complete, redirect to dashboard
    if (currentStep === 'complete') {
      next('/');
      return;
    }
  }

  // RBAC: blocca route per ruoli non autorizzati
  // Se la route ha `meta.roles` e l'utente non ha un ruolo permesso,
  // dirotta a /forbidden (eccetto la /forbidden stessa per evitare loop).
  const allowedRoles = to.meta.roles as UserRole[] | undefined;
  if (
    requiresAuth &&
    authStore.isAuthenticated &&
    allowedRoles &&
    allowedRoles.length > 0 &&
    to.name !== 'Forbidden'
  ) {
    const userRole = authStore.userRole as UserRole;
    if (!allowedRoles.includes(userRole)) {
      next({ name: 'Forbidden' });
      return;
    }
  }

  next();
});

export default router;
