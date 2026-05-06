<template>
  <div :class="['main-layout', { 'sidebar-collapsed': sidebarCollapsed }]">
    <aside :class="['sidebar', { 'collapsed': sidebarCollapsed }]">
      <div class="sidebar-header">
        <div class="logo" v-show="!sidebarCollapsed">
          <span class="logo-icon">{{ tenantName.charAt(0).toUpperCase() }}</span>
          <div class="logo-text">
            <h2>{{ tenantName }}</h2>
            <Tag v-if="isTrialing" severity="info" class="trial-badge">
              Trial: {{ trialDaysRemaining }}gg
            </Tag>
          </div>
        </div>
        <button
          class="sidebar-toggle"
          @click="toggleSidebar"
          :title="sidebarCollapsed ? 'Espandi menu' : 'Comprimi menu'"
        >
          <i :class="sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"></i>
        </button>
      </div>

      <nav class="nav">
        <router-link to="/" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Dashboard' : null">
          <i class="pi pi-home"></i>
          <span class="nav-label">Dashboard</span>
        </router-link>

        <div class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Gestione</span>
        </div>

        <router-link v-if="canAccessModule('products')" to="/products" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Prodotti' : null">
          <i class="pi pi-box"></i>
          <span class="nav-label">Prodotti</span>
        </router-link>

        <router-link v-if="canAccessModule('product-categories')" to="/product-categories" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Categorie' : null">
          <i class="pi pi-sitemap"></i>
          <span class="nav-label">Categorie</span>
        </router-link>

        <router-link v-if="canAccessModule('warehouses')" to="/warehouses" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Magazzini' : null">
          <i class="pi pi-building"></i>
          <span class="nav-label">Magazzini</span>
        </router-link>

        <router-link v-if="canAccessModule('inventory')" to="/inventory" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Giacenze' : null">
          <i class="pi pi-warehouse"></i>
          <span class="nav-label">Giacenze</span>
        </router-link>

        <router-link v-if="canAccessModule('materials')" to="/materials" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Materiali' : null">
          <i class="pi pi-th-large"></i>
          <span class="nav-label">Materiali</span>
        </router-link>

        <router-link v-if="canAccessModule('orders')" to="/orders" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Ordini' : null">
          <i class="pi pi-shopping-cart"></i>
          <span class="nav-label">Ordini</span>
        </router-link>

        <div v-if="canAccessModule('invoices') || canAccessModule('ddt')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Documenti</span>
        </div>

        <router-link v-if="canAccessModule('invoices')" to="/invoices" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Fatture' : null">
          <i class="pi pi-file"></i>
          <span class="nav-label">Fatture</span>
        </router-link>

        <router-link v-if="canAccessModule('ddt')" to="/ddt" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'DDT' : null">
          <i class="pi pi-send"></i>
          <span class="nav-label">DDT</span>
        </router-link>

        <div v-if="canAccessModule('operation-types') || canAccessModule('production-orders')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Produzione</span>
        </div>

        <router-link v-if="canAccessModule('operation-types')" to="/operation-types" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Tipi Operazione' : null">
          <i class="pi pi-cog"></i>
          <span class="nav-label">Tipi Operazione</span>
        </router-link>

        <router-link v-if="canAccessModule('production-orders')" to="/production-orders" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Ordini Produzione' : null">
          <i class="pi pi-clipboard"></i>
          <span class="nav-label">Ordini Produzione</span>
        </router-link>

        <router-link v-if="canAccessModule('production-orders')" to="/mrp/capacity" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'MRP Capacity' : null">
          <i class="pi pi-chart-bar"></i>
          <span class="nav-label">MRP Capacity</span>
        </router-link>

        <div v-if="canAccessModule('suppliers') || canAccessModule('purchase-orders') || canAccessModule('logistics')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Acquisti</span>
        </div>

        <router-link v-if="canAccessModule('suppliers')" to="/suppliers" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Fornitori' : null">
          <i class="pi pi-truck"></i>
          <span class="nav-label">Fornitori</span>
        </router-link>

        <router-link v-if="canAccessModule('purchase-orders')" to="/purchase-orders" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Ordini Acquisto' : null">
          <i class="pi pi-file-edit"></i>
          <span class="nav-label">Ordini Acquisto</span>
        </router-link>

        <router-link v-if="canAccessModule('logistics')" to="/logistics" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Logistica' : null">
          <i class="pi pi-compass"></i>
          <span class="nav-label">Logistica</span>
        </router-link>

        <div v-if="canAccessModule('customers') || canAccessModule('employees') || canAccessModule('tasks')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Clienti & Team</span>
        </div>

        <router-link v-if="canAccessModule('customers')" to="/customers" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Clienti' : null">
          <i class="pi pi-users"></i>
          <span class="nav-label">Clienti</span>
        </router-link>

        <router-link v-if="canAccessModule('pricelists')" to="/pricelists" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Listini Prezzi' : null">
          <i class="pi pi-list"></i>
          <span class="nav-label">Listini Prezzi</span>
        </router-link>

        <router-link v-if="canAccessModule('employees')" to="/employees" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Dipendenti' : null">
          <i class="pi pi-id-card"></i>
          <span class="nav-label">Dipendenti</span>
        </router-link>

        <router-link v-if="canAccessModule('tasks')" to="/tasks" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Task' : null">
          <i class="pi pi-check-square"></i>
          <span class="nav-label">Task</span>
        </router-link>

        <div v-if="canAccessModule('accounting') || canAccessModule('analytics') || canAccessModule('reports')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Analytics</span>
        </div>

        <router-link v-if="canAccessModule('accounting')" to="/accounting" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Contabilita' : null">
          <i class="pi pi-euro"></i>
          <span class="nav-label">Contabilita</span>
        </router-link>

        <router-link v-if="canAccessModule('analytics')" to="/analytics" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Analytics' : null">
          <i class="pi pi-chart-line"></i>
          <span class="nav-label">Analytics</span>
        </router-link>

        <router-link v-if="canAccessModule('reports')" to="/reports" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Report' : null">
          <i class="pi pi-file-pdf"></i>
          <span class="nav-label">Report</span>
        </router-link>

        <router-link v-if="canAccessModule('calendar')" to="/calendar" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Calendario' : null">
          <i class="pi pi-calendar"></i>
          <span class="nav-label">Calendario</span>
        </router-link>

        <router-link v-if="canAccessModule('notifications')" to="/notifications" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Notifiche' : null">
          <div class="nav-item-icon-wrapper">
            <i class="pi pi-bell"></i>
            <Badge v-if="notificationStore.unreadCount > 0" :value="notificationStore.unreadCount" severity="danger" class="notification-badge" />
          </div>
          <span class="nav-label">Notifiche</span>
        </router-link>

        <div v-if="canAccessModule('wordpress')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Integrazioni</span>
        </div>

        <router-link v-if="canAccessModule('wordpress')" to="/wordpress" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'WordPress' : null">
          <i class="pi pi-globe"></i>
          <span class="nav-label">WordPress</span>
        </router-link>

        <div v-if="canAccessModule('team') || canAccessModule('billing') || canAccessModule('settings')" class="nav-section" v-show="!sidebarCollapsed">
          <span class="nav-section-title">Account</span>
        </div>

        <router-link v-if="canAccessModule('team')" to="/settings/team" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Team' : null">
          <i class="pi pi-user-plus"></i>
          <span class="nav-label">Team</span>
        </router-link>

        <router-link v-if="canAccessModule('billing')" to="/settings/billing" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Fatturazione' : null">
          <i class="pi pi-credit-card"></i>
          <span class="nav-label">Fatturazione</span>
        </router-link>

        <router-link v-if="canAccessModule('settings')" to="/settings" class="nav-item" v-tooltip.right="sidebarCollapsed ? 'Impostazioni' : null">
          <i class="pi pi-cog"></i>
          <span class="nav-label">Impostazioni</span>
        </router-link>
      </nav>
    </aside>

    <div class="main-content">
      <header class="header">
        <div class="header-left">
          <button class="mobile-menu-toggle" @click="toggleSidebar">
            <i class="pi pi-bars"></i>
          </button>
        </div>
        <div class="header-right">
          <div class="user-info">
            <div class="user-avatar">
              <i class="pi pi-user"></i>
            </div>
            <div class="user-details">
              <div class="user-name">{{ displayUserName }}</div>
              <div class="user-role">{{ authStore.user?.role || 'Administrator' }}</div>
            </div>
          </div>
          <Button
            icon="pi pi-sign-out"
            class="p-button-text p-button-rounded"
            @click="handleLogout"
            v-tooltip.bottom="'Logout'"
          />
        </div>
      </header>

      <main class="content">
        <PlanLimitBanner
          v-if="isNearLimit && limitMessage"
          :message="limitMessage"
          severity="warning"
          dismiss-key="plan-limit"
          @upgrade="goToBilling"
        />
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Tag from 'primevue/tag';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationStore } from '../stores/notification.store';
import { useSubscriptionStore } from '../stores/subscription.store';
import { useRouter } from 'vue-router';
import { usePermissions } from '../composables/usePermissions';
import PlanLimitBanner from '../components/billing/PlanLimitBanner.vue';

const { canAccessModule } = usePermissions();

const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const subscriptionStore = useSubscriptionStore();
const router = useRouter();

const sidebarCollapsed = ref(false);

// User display name: firstName + lastName, fallback a email/'Admin User'
const displayUserName = computed(() => {
  const u = authStore.user;
  if (!u) return 'Admin User';
  const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return fullName || u.email || 'Admin User';
});

// Tenant & Subscription computed
const tenantName = computed(() => authStore.tenantName || 'EcommerceERP');
const isTrialing = computed(() => authStore.isTrialing);
const trialDaysRemaining = computed(() => subscriptionStore.trialDaysRemaining);
const isNearLimit = computed(() => subscriptionStore.isNearLimit);
const limitMessage = computed(() => {
  if (!subscriptionStore.usage) return '';
  const nearLimitResources: string[] = [];
  const usage = subscriptionStore.usage;

  if (usage.users.percentage >= 80) nearLimitResources.push('utenti');
  if (usage.products.percentage >= 80) nearLimitResources.push('prodotti');
  if (usage.warehouses.percentage >= 80) nearLimitResources.push('magazzini');

  if (nearLimitResources.length === 0) return '';
  return `Stai raggiungendo il limite di ${nearLimitResources.join(', ')} del tuo piano.`;
});

const goToBilling = () => {
  router.push('/settings/billing');
};

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed.value));
};

onMounted(() => {
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved !== null) {
    sidebarCollapsed.value = saved === 'true';
  }
  notificationStore.loadUnreadCount();
  // Fetch subscription usage for plan limit checks
  subscriptionStore.fetchUsage();
});

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.main-layout {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background: var(--bg-body);
}

/* ===== SIDEBAR ===== */
.sidebar {
  width: var(--sidebar-width-expanded);
  background: var(--bg-sidebar);
  color: white;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1000;
  transition: width var(--transition-slow);
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed {
  width: var(--sidebar-width-collapsed);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: var(--header-height);
}

.sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: var(--space-4);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--color-primary-600);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow: hidden;
}

.logo h2 {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: white;
  white-space: nowrap;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trial-badge {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  align-self: flex-start;
}

.sidebar-toggle {
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-md);
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-gray-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

/* ===== NAVIGATION ===== */
.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  flex: 1;
}

.nav-section {
  padding: var(--space-4) var(--space-3) var(--space-2);
}

.nav-section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--color-gray-400);
  text-decoration: none;
  border-radius: var(--border-radius-md);
  transition: all var(--transition-fast);
  font-weight: 500;
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
}

.nav-item i {
  font-size: 1.125rem;
  width: 24px;
  flex-shrink: 0;
  text-align: center;
}

.nav-label {
  opacity: 1;
  transition: opacity var(--transition-fast);
}

.sidebar.collapsed .nav-label {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: var(--space-3);
}

.sidebar.collapsed .nav-section {
  display: none;
}

.nav-item:hover {
  background: var(--bg-sidebar-hover);
  color: white;
}

.nav-item.router-link-active {
  background: var(--bg-sidebar-active);
  color: white;
}

.nav-item-icon-wrapper {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  font-size: 0.6rem;
  padding: 0 4px;
}

/* ===== MAIN CONTENT ===== */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: var(--sidebar-width-expanded);
  min-height: 100vh;
  transition: margin-left var(--transition-slow);
}

.sidebar-collapsed .main-content {
  margin-left: var(--sidebar-width-collapsed);
}

/* ===== HEADER ===== */
.header {
  height: var(--header-height);
  background: var(--bg-header);
  border-bottom: var(--border-width) solid var(--border-color);
  padding: 0 var(--space-8);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-xs);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.mobile-menu-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
  border: none;
  background: var(--color-gray-100);
  color: var(--color-gray-600);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.mobile-menu-toggle:hover {
  background: var(--color-gray-200);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color-light);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary-600);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.9rem;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-gray-900);
}

.user-role {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

/* ===== CONTENT ===== */
.content {
  flex: 1;
  padding: var(--space-8);
  background: var(--bg-body);
  overflow-y: auto;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .sidebar {
    width: var(--sidebar-width-collapsed);
  }

  .sidebar .nav-label,
  .sidebar .logo h2,
  .sidebar .nav-section {
    display: none;
  }

  .sidebar .nav-item {
    justify-content: center;
    padding: var(--space-3);
  }

  .sidebar .sidebar-header {
    justify-content: center;
  }

  .sidebar .sidebar-toggle {
    display: none;
  }

  .main-content {
    margin-left: var(--sidebar-width-collapsed);
  }
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    width: var(--sidebar-width-expanded);
  }

  .sidebar-collapsed .sidebar {
    transform: translateX(-100%);
  }

  .main-layout:not(.sidebar-collapsed) .sidebar {
    transform: translateX(0);
  }

  .sidebar .nav-label,
  .sidebar .logo h2,
  .sidebar .nav-section {
    display: block;
  }

  .sidebar .nav-item {
    justify-content: flex-start;
    padding: var(--space-3) var(--space-4);
  }

  .sidebar .sidebar-header {
    justify-content: space-between;
  }

  .sidebar .sidebar-toggle {
    display: flex;
  }

  .main-content {
    margin-left: 0;
  }

  .mobile-menu-toggle {
    display: flex;
  }

  .header {
    padding: 0 var(--space-4);
  }

  .content {
    padding: var(--space-4);
  }

  .user-details {
    display: none;
  }

  .user-info {
    padding: var(--space-2);
  }
}

/* Overlay for mobile */
@media (max-width: 768px) {
  .main-layout:not(.sidebar-collapsed)::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
}
</style>
