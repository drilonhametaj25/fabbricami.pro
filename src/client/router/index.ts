import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../pages/Login.vue'),
      meta: { requiresAuth: false },
    },
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
      ],
    },
  ],
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

export default router;
