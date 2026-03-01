import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api.service';

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
        },
        {
          path: '/product-categories',
          name: 'ProductCategories',
          component: () => import('../pages/ProductCategories.vue'),
        },
        {
          path: '/warehouses',
          name: 'Warehouses',
          component: () => import('../pages/Warehouses.vue'),
        },
        {
          path: '/inventory',
          name: 'Inventory',
          component: () => import('../pages/Inventory.vue'),
        },
        {
          path: '/orders',
          name: 'Orders',
          component: () => import('../pages/Orders.vue'),
        },
        {
          path: '/customers',
          name: 'Customers',
          component: () => import('../pages/Customers.vue'),
        },
        {
          path: '/customers/:id',
          name: 'CustomerDetail',
          component: () => import('../pages/CustomerDetail.vue'),
        },
        {
          path: '/pricelists',
          name: 'PriceLists',
          component: () => import('../pages/PriceLists.vue'),
        },
        {
          path: '/accounting',
          name: 'Accounting',
          component: () => import('../pages/Accounting.vue'),
        },
        {
          path: '/tasks',
          name: 'Tasks',
          component: () => import('../pages/Tasks.vue'),
        },
        {
          path: '/employees',
          name: 'Employees',
          component: () => import('../pages/Employees.vue'),
        },
        {
          path: '/analytics',
          name: 'Analytics',
          component: () => import('../pages/Analytics.vue'),
        },
        {
          path: '/suppliers',
          name: 'Suppliers',
          component: () => import('../pages/Suppliers.vue'),
        },
        {
          path: '/purchase-orders',
          name: 'PurchaseOrders',
          component: () => import('../pages/PurchaseOrders.vue'),
        },
        {
          path: '/notifications',
          name: 'Notifications',
          component: () => import('../pages/Notifications.vue'),
        },
        {
          path: '/calendar',
          name: 'CalendarEvents',
          component: () => import('../pages/CalendarEvents.vue'),
        },
        {
          path: '/materials',
          name: 'Materials',
          component: () => import('../pages/Materials.vue'),
        },
        {
          path: '/operation-types',
          name: 'OperationTypes',
          component: () => import('../pages/OperationTypes.vue'),
        },
        {
          path: '/production-orders',
          name: 'ProductionOrders',
          component: () => import('../pages/ProductionOrders.vue'),
        },
        {
          path: '/wordpress',
          name: 'WordPress',
          component: () => import('../pages/WordPressSettings.vue'),
        },
        {
          path: '/logistics',
          name: 'Logistics',
          component: () => import('../pages/Logistics.vue'),
        },
        {
          path: '/settings',
          name: 'CompanySettings',
          component: () => import('../pages/CompanySettings.vue'),
        },
        {
          path: '/settings/billing',
          name: 'Billing',
          component: () => import('../pages/Billing.vue'),
        },
        {
          path: '/settings/team',
          name: 'TeamMembers',
          component: () => import('../pages/TeamMembers.vue'),
        },
        {
          path: '/invoices',
          name: 'Invoices',
          component: () => import('../pages/Invoices.vue'),
        },
        {
          path: '/ddt',
          name: 'DDT',
          component: () => import('../pages/DDT.vue'),
        },
        {
          path: '/reports',
          name: 'Reports',
          component: () => import('../pages/Reports.vue'),
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
    const response = await api.get<{ currentStep: string }>('/onboarding/status');
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
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth !== false;
  const isOnboardingRoute = to.meta.isOnboarding === true;

  // Not authenticated - redirect to login for protected routes
  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login');
    return;
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

  next();
});

export default router;
