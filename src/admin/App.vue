<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Button from 'primevue/button';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const showSidebar = computed(() => {
  return authStore.isAuthenticated && !['Login', 'Setup'].includes(route.name as string);
});

const menuItems = [
  { label: 'Dashboard', icon: 'pi pi-chart-bar', route: '/dashboard' },
  { label: 'Piani', icon: 'pi pi-credit-card', route: '/plans' },
  { label: 'Tenant', icon: 'pi pi-building', route: '/tenants' },
  { label: 'Coupon', icon: 'pi pi-percentage', route: '/coupons' },
  { label: 'Segnalazioni', icon: 'pi pi-comments', route: '/tickets' },
  { label: 'Stripe', icon: 'pi pi-bolt', route: '/stripe' },
  { label: 'Audit Log', icon: 'pi pi-history', route: '/audit-logs' },
];

function navigateTo(path: string) {
  router.push(path);
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <Toast position="top-right" />
  <ConfirmDialog />

  <div class="admin-layout" :class="{ 'with-sidebar': showSidebar }">
    <!-- Sidebar -->
    <aside v-if="showSidebar" class="sidebar">
      <div class="sidebar-header">
        <span class="logo">MegaAdmin</span>
        <span class="subtitle">Fabbricami.pro</span>
      </div>

      <nav class="sidebar-nav">
        <a
          v-for="item in menuItems"
          :key="item.route"
          :class="['nav-item', { active: route.path.startsWith(item.route) }]"
          @click="navigateTo(item.route)"
        >
          <i :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <i class="pi pi-user"></i>
          <span>{{ authStore.superAdmin?.name }}</span>
        </div>
        <Button
          icon="pi pi-sign-out"
          class="p-button-text p-button-sm"
          @click="logout"
          v-tooltip.top="'Logout'"
        />
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  background: #0f172a;
}

.admin-layout.with-sidebar {
  display: flex;
}

.sidebar {
  width: 260px;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #334155;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid #334155;
}

.logo {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
}

.subtitle {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #334155;
  color: #f1f5f9;
}

.nav-item.active {
  background: #4f46e5;
  color: white;
}

.nav-item i {
  font-size: 1.125rem;
}

.sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
  font-size: 0.875rem;
}

.main-content {
  flex: 1;
  margin-left: 260px;
  min-height: 100vh;
}

.admin-layout:not(.with-sidebar) .main-content {
  margin-left: 0;
}
</style>
