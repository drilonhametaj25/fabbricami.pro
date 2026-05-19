import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('../pages/Setup.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../pages/Dashboard.vue'),
  },
  {
    path: '/plans',
    name: 'Plans',
    component: () => import('../pages/Plans.vue'),
  },
  {
    path: '/tenants',
    name: 'Tenants',
    component: () => import('../pages/Tenants.vue'),
  },
  {
    path: '/tenants/:id',
    name: 'TenantDetail',
    component: () => import('../pages/TenantDetail.vue'),
  },
  {
    path: '/stripe',
    name: 'Stripe',
    component: () => import('../pages/Stripe.vue'),
  },
  {
    path: '/audit-logs',
    name: 'AuditLogs',
    component: () => import('../pages/AuditLogs.vue'),
  },
  {
    path: '/coupons',
    name: 'Coupons',
    component: () => import('../pages/Coupons.vue'),
  },
  {
    path: '/tickets',
    name: 'Tickets',
    component: () => import('../pages/Tickets.vue'),
  },
  {
    path: '/integrations',
    name: 'Integrations',
    component: () => import('../pages/Integrations.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // Check if route requires authentication
  if (to.meta.public) {
    next();
    return;
  }

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    // Try to restore session from localStorage
    authStore.loadFromStorage();

    if (!authStore.isAuthenticated) {
      next({ name: 'Login', query: { redirect: to.fullPath } });
      return;
    }
  }

  next();
});

export default router;
