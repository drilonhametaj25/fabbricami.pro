<template>
  <Dialog
    v-model:visible="visible"
    :header="`Dettaglio: ${employee?.user?.firstName} ${employee?.user?.lastName}`"
    :modal="true"
    :style="{ width: '700px', maxWidth: '95vw' }"
    @hide="onHide"
  >
    <div class="employee-detail" v-if="employee">
      <!-- Header con info base -->
      <div class="detail-header">
        <div class="employee-avatar">
          <span>{{ getInitials() }}</span>
        </div>
        <div class="employee-info">
          <h3 class="employee-name">{{ employee.user?.firstName }} {{ employee.user?.lastName }}</h3>
          <p class="employee-position">{{ employee.position }}</p>
          <Tag :severity="employee.isActive ? 'success' : 'danger'">
            {{ employee.isActive ? 'Attivo' : 'Inattivo' }}
          </Tag>
        </div>
      </div>

      <!-- Tabs per sezioni -->
      <TabView>
        <!-- Tab Informazioni -->
        <TabPanel header="Informazioni">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Codice Dipendente</span>
              <span class="info-value code">{{ employee.employeeCode }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">{{ employee.user?.email }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Posizione</span>
              <span class="info-value">{{ employee.position }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data Assunzione</span>
              <span class="info-value">{{ formatDate(employee.hireDate) }}</span>
            </div>
            <div class="info-item" v-if="canSeeCost">
              <span class="info-label">Costo Orario</span>
              <span class="info-value highlight">{{ formatCurrency(employee.hourlyRate) }}/h</span>
            </div>
            <div class="info-item">
              <span class="info-label">Stato</span>
              <span class="info-value">
                <Tag :severity="employee.isActive ? 'success' : 'danger'">
                  {{ employee.isActive ? 'Attivo' : 'Inattivo' }}
                </Tag>
              </span>
            </div>
          </div>
        </TabPanel>

        <!-- Tab Statistiche -->
        <TabPanel header="Statistiche">
          <div class="stats-container" v-if="statsLoading">
            <i class="pi pi-spin pi-spinner"></i>
            <p>Caricamento statistiche...</p>
          </div>
          <div class="stats-container" v-else-if="stats">
            <div class="stat-card">
              <div class="stat-icon"><i class="pi pi-clock"></i></div>
              <div class="stat-content">
                <span class="stat-value">{{ stats.totalHours?.toFixed(1) || 0 }}</span>
                <span class="stat-label">Ore Lavorate (mese)</span>
              </div>
            </div>
            <div class="stat-card" v-if="canSeeCost">
              <div class="stat-icon"><i class="pi pi-euro"></i></div>
              <div class="stat-content">
                <span class="stat-value">{{ formatCurrency(stats.laborCost || 0) }}</span>
                <span class="stat-label">Costo Lavoro (mese)</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><i class="pi pi-calendar"></i></div>
              <div class="stat-content">
                <span class="stat-value">{{ stats.daysWorked || 0 }}</span>
                <span class="stat-label">Giorni Lavorati</span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon"><i class="pi pi-sun"></i></div>
              <div class="stat-content">
                <span class="stat-value">{{ stats.remainingLeave || 0 }}</span>
                <span class="stat-label">Ferie Residue</span>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Tab Qualifiche -->
        <TabPanel header="Qualifiche">
          <div class="qualifications-section">
            <p class="section-description">Fasi di lavorazione per cui il dipendente è qualificato:</p>
            <div class="qualifications-list" v-if="qualifications.length > 0">
              <div class="qualification-item" v-for="q in qualifications" :key="q.id">
                <div class="qualification-info">
                  <span class="qualification-name">{{ q.operationType?.name }}</span>
                  <span class="qualification-code">{{ q.operationType?.code }}</span>
                </div>
                <Tag v-if="q.isPrimary" severity="success">Primario</Tag>
              </div>
            </div>
            <div class="empty-qualifications" v-else>
              <i class="pi pi-info-circle"></i>
              <p>Nessuna qualifica assegnata</p>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Chiudi" icon="pi pi-times" class="p-button-text" @click="visible = false" />
        <Button
          v-if="canEdit"
          label="Modifica"
          icon="pi pi-pencil"
          @click="$emit('edit', employee)"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api.service';

interface Props {
  modelValue: boolean;
  employee?: any;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit', employee: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  employee: null
});

const emit = defineEmits<Emits>();
const authStore = useAuthStore();

const visible = ref(props.modelValue);
const stats = ref<any>(null);
const statsLoading = ref(false);
const qualifications = ref<any[]>([]);

const canSeeCost = computed(() => {
  const user = authStore.user as any;
  return user && ['ADMIN', 'MANAGER', 'CONTABILE'].includes(user.role);
});

const canEdit = computed(() => {
  const user = authStore.user as any;
  return user && ['ADMIN', 'MANAGER'].includes(user.role);
});

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val && props.employee) {
    loadStats();
    loadQualifications();
  }
});

watch(visible, (val) => {
  emit('update:modelValue', val);
});

const onHide = () => {
  stats.value = null;
  qualifications.value = [];
};

const getInitials = () => {
  if (!props.employee?.user) return '??';
  const first = props.employee.user.firstName?.[0] || '';
  const last = props.employee.user.lastName?.[0] || '';
  return (first + last).toUpperCase();
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('it-IT');
};

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

const loadStats = async () => {
  if (!props.employee?.id) return;

  statsLoading.value = true;
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Carica statistiche presenze mensili
    const attendanceRes = await api.get(`/employees/${props.employee.id}/attendance/${year}/${month}`);

    // Carica ferie residue
    const leaveRes = await api.get(`/employees/${props.employee.id}/leave-balance?year=${year}`);

    stats.value = {
      totalHours: attendanceRes.data?.totalHours || 0,
      daysWorked: attendanceRes.data?.daysWorked || 0,
      laborCost: (attendanceRes.data?.totalHours || 0) * Number(props.employee.hourlyRate || 0),
      remainingLeave: leaveRes.data?.remainingDays || 0,
    };
  } catch (error) {
    console.error('Error loading stats:', error);
    stats.value = {
      totalHours: 0,
      daysWorked: 0,
      laborCost: 0,
      remainingLeave: 0,
    };
  } finally {
    statsLoading.value = false;
  }
};

const loadQualifications = async () => {
  if (!props.employee?.id) return;

  try {
    // Carica le qualifiche per le fasi di lavorazione
    const response = await api.get(`/employees/${props.employee.id}`);
    qualifications.value = response.data?.operationTypeQualifications || [];
  } catch (error) {
    console.error('Error loading qualifications:', error);
    qualifications.value = [];
  }
};
</script>

<style scoped>
.employee-detail {
  padding: 0.5rem 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 1rem;
}

.employee-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-400), var(--primary-600));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.employee-info {
  flex: 1;
}

.employee-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
}

.employee-position {
  margin: 0 0 0.5rem 0;
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
  padding: 1rem 0;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  font-weight: 600;
}

.info-value {
  font-size: 1rem;
  color: var(--text-color);
}

.info-value.code {
  font-family: monospace;
  background: var(--surface-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  width: fit-content;
}

.info-value.highlight {
  color: var(--green-600);
  font-weight: 600;
}

/* Stats */
.stats-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  padding: 1rem 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-600);
  font-size: 1.25rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

/* Qualifications */
.qualifications-section {
  padding: 1rem 0;
}

.section-description {
  color: var(--text-color-secondary);
  margin-bottom: 1rem;
}

.qualifications-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.qualification-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}

.qualification-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.qualification-name {
  font-weight: 500;
  color: var(--text-color);
}

.qualification-code {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-color-secondary);
}

.empty-qualifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  color: var(--text-color-secondary);
  text-align: center;
}

.empty-qualifications i {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 600px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .stats-container {
    grid-template-columns: 1fr;
  }

  .detail-header {
    flex-direction: column;
    text-align: center;
  }
}
</style>
