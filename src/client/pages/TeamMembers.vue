<template>
  <div class="team-page">
    <PageHeader
      title="Gestione Team"
      subtitle="Gestisci i membri del team e i loro permessi"
      icon="pi pi-users"
    >
      <template #actions>
        <Button
          label="Invita Membro"
          icon="pi pi-user-plus"
          @click="showInviteDialog = true"
          :disabled="!canInvite"
        />
      </template>
    </PageHeader>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon bg-primary">
          <i class="pi pi-users"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ tenantStore.members.length }}</span>
          <span class="stat-label">Membri Totali</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-success">
          <i class="pi pi-check-circle"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ tenantStore.activeMembers.length }}</span>
          <span class="stat-label">Attivi</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-warning">
          <i class="pi pi-clock"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ tenantStore.pendingInvites.length }}</span>
          <span class="stat-label">Inviti Pendenti</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon bg-info">
          <i class="pi pi-shield"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ tenantStore.adminMembers.length }}</span>
          <span class="stat-label">Amministratori</span>
        </div>
      </div>
    </div>

    <!-- Members Table -->
    <div class="members-section">
      <h3 class="section-title">Membri del Team</h3>
      <DataTable
        :value="tenantStore.members"
        :loading="loading"
        responsiveLayout="scroll"
        class="members-table"
        :sortField="'acceptedAt'"
        :sortOrder="-1"
      >
        <Column header="Membro">
          <template #body="{ data }">
            <div class="member-info">
              <Avatar
                :label="getInitials(data)"
                :style="{ backgroundColor: getAvatarColor(data.userId) }"
                shape="circle"
                size="large"
              />
              <div class="member-details">
                <span class="member-name">{{ data.firstName }} {{ data.lastName }}</span>
                <span class="member-email">{{ data.email }}</span>
              </div>
            </div>
          </template>
        </Column>
        <Column field="role" header="Ruolo" :sortable="true">
          <template #body="{ data }">
            <Dropdown
              v-if="canEditRole(data)"
              v-model="data.role"
              :options="roleOptions"
              optionLabel="label"
              optionValue="value"
              class="role-dropdown"
              @change="() => updateRole(data)"
            />
            <Tag v-else :severity="getRoleSeverity(data.role)" :value="getRoleLabel(data.role)" />
          </template>
        </Column>
        <Column header="Stato">
          <template #body="{ data }">
            <Tag
              v-if="data.acceptedAt"
              severity="success"
              value="Attivo"
            />
            <Tag
              v-else
              severity="warning"
              value="In attesa"
            />
          </template>
        </Column>
        <Column field="acceptedAt" header="Data Ingresso" :sortable="true">
          <template #body="{ data }">
            {{ data.acceptedAt ? formatDate(data.acceptedAt) : '-' }}
          </template>
        </Column>
        <Column header="Azioni" :style="{ width: '100px' }">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                v-if="canRemove(data)"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="confirmRemove(data)"
                v-tooltip="'Rimuovi membro'"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Pending Invites -->
    <div v-if="tenantStore.pendingInvites.length > 0" class="invites-section">
      <h3 class="section-title">Inviti Pendenti</h3>
      <DataTable
        :value="tenantStore.pendingInvites"
        responsiveLayout="scroll"
        class="invites-table"
      >
        <Column field="email" header="Email" />
        <Column field="role" header="Ruolo">
          <template #body="{ data }">
            <Tag :severity="getRoleSeverity(data.role)" :value="getRoleLabel(data.role)" />
          </template>
        </Column>
        <Column header="Scadenza">
          <template #body="{ data }">
            <span :class="{ 'text-danger': data.isExpired }">
              {{ formatDate(data.expiresAt) }}
              <Tag v-if="data.isExpired" severity="danger" value="Scaduto" class="ml-2" />
            </span>
          </template>
        </Column>
        <Column header="Azioni" :style="{ width: '150px' }">
          <template #body="{ data }">
            <div class="action-buttons">
              <Button
                icon="pi pi-refresh"
                severity="secondary"
                text
                rounded
                @click="resendInvite(data)"
                v-tooltip="'Reinvia invito'"
                :loading="resendingInvite === data.id"
              />
              <Button
                icon="pi pi-times"
                severity="danger"
                text
                rounded
                @click="cancelInvite(data)"
                v-tooltip="'Annulla invito'"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Invite Dialog -->
    <Dialog
      v-model:visible="showInviteDialog"
      header="Invita Nuovo Membro"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="invite-form">
        <div class="form-field">
          <label for="inviteEmail">Email *</label>
          <InputText
            id="inviteEmail"
            v-model="inviteForm.email"
            type="email"
            class="w-full"
            placeholder="email@esempio.com"
            :class="{ 'p-invalid': inviteErrors.email }"
          />
          <small v-if="inviteErrors.email" class="p-error">{{ inviteErrors.email }}</small>
        </div>

        <div class="form-field">
          <label for="inviteRole">Ruolo *</label>
          <Dropdown
            id="inviteRole"
            v-model="inviteForm.role"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            placeholder="Seleziona ruolo"
          />
          <small class="field-hint">{{ getRoleDescription(inviteForm.role) }}</small>
        </div>
      </div>

      <template #footer>
        <Button
          label="Annulla"
          severity="secondary"
          @click="closeInviteDialog"
        />
        <Button
          label="Invia Invito"
          icon="pi pi-send"
          @click="sendInvite"
          :loading="sendingInvite"
        />
      </template>
    </Dialog>

    <!-- Remove Confirmation Dialog -->
    <Dialog
      v-model:visible="showRemoveDialog"
      header="Conferma Rimozione"
      :modal="true"
      :style="{ width: '450px' }"
    >
      <div class="remove-dialog">
        <i class="pi pi-exclamation-triangle warning-icon"></i>
        <p>
          Sei sicuro di voler rimuovere <strong>{{ memberToRemove?.firstName }} {{ memberToRemove?.lastName }}</strong> dal team?
        </p>
        <p class="remove-note">
          L'utente perderà immediatamente l'accesso a tutti i dati dell'organizzazione.
        </p>
      </div>
      <template #footer>
        <Button
          label="Annulla"
          severity="secondary"
          @click="showRemoveDialog = false"
        />
        <Button
          label="Rimuovi"
          severity="danger"
          icon="pi pi-trash"
          @click="removeMember"
          :loading="removing"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Avatar from 'primevue/avatar';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import { useToast } from 'primevue/usetoast';
import { useTenantStore } from '../stores/tenant.store';
import { useAuthStore } from '../stores/auth.store';
import { usePlanLimits } from '../composables/usePlanLimits';
import type { TenantMember, TenantInvite, UserRole } from '../types';

const toast = useToast();
const tenantStore = useTenantStore();
const authStore = useAuthStore();
const planLimits = usePlanLimits();

// State
const loading = ref(false);
const showInviteDialog = ref(false);
const showRemoveDialog = ref(false);
const sendingInvite = ref(false);
const resendingInvite = ref<string | null>(null);
const removing = ref(false);
const memberToRemove = ref<TenantMember | null>(null);

const inviteForm = reactive({
  email: '',
  role: 'VIEWER' as UserRole,
});

const inviteErrors = reactive({
  email: '',
});

// Role options
const roleOptions = [
  { label: 'Amministratore', value: 'ADMIN' },
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Contabile', value: 'CONTABILE' },
  { label: 'Magazziniere', value: 'MAGAZZINIERE' },
  { label: 'Operatore', value: 'OPERATORE' },
  { label: 'Commerciale', value: 'COMMERCIALE' },
  { label: 'Visualizzatore', value: 'VIEWER' },
];

// Computed
const canInvite = computed(() => {
  return authStore.isAdmin() && planLimits.canCreateUser.value;
});

// Methods
function getInitials(member: TenantMember): string {
  const first = member.firstName?.charAt(0) || '';
  const last = member.lastName?.charAt(0) || '';
  return `${first}${last}`.toUpperCase();
}

function getAvatarColor(userId: string): string {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6',
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getRoleSeverity(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'danger';
    case 'MANAGER':
      return 'warning';
    case 'CONTABILE':
    case 'COMMERCIALE':
      return 'info';
    default:
      return 'secondary';
  }
}

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    ADMIN: 'Amministratore',
    MANAGER: 'Manager',
    CONTABILE: 'Contabile',
    MAGAZZINIERE: 'Magazziniere',
    OPERATORE: 'Operatore',
    COMMERCIALE: 'Commerciale',
    VIEWER: 'Visualizzatore',
  };
  return labels[role] || role;
}

function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    ADMIN: 'Accesso completo a tutte le funzionalità e impostazioni',
    MANAGER: 'Gestione operazioni quotidiane, escluse impostazioni sistema',
    CONTABILE: 'Accesso a contabilità, fatturazione e report finanziari',
    MAGAZZINIERE: 'Gestione magazzino, inventario e movimenti',
    OPERATORE: 'Esecuzione task assegnati e registrazione ore',
    COMMERCIALE: 'Gestione clienti, ordini e vendite',
    VIEWER: 'Solo visualizzazione report e dati',
  };
  return descriptions[role] || '';
}

function canEditRole(member: TenantMember): boolean {
  // Solo admin può modificare ruoli
  if (!authStore.isAdmin()) return false;
  // Non può modificare se stesso
  if (member.userId === authStore.user?.id) return false;
  return true;
}

function canRemove(member: TenantMember): boolean {
  // Solo admin può rimuovere
  if (!authStore.isAdmin()) return false;
  // Non può rimuovere se stesso
  if (member.userId === authStore.user?.id) return false;
  return true;
}

async function updateRole(member: TenantMember) {
  const success = await tenantStore.updateMemberRole(member.userId, member.role);
  if (success) {
    toast.add({
      severity: 'success',
      summary: 'Ruolo Aggiornato',
      detail: `${member.firstName} ${member.lastName} è ora ${getRoleLabel(member.role)}`,
      life: 3000,
    });
  } else {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: tenantStore.error || 'Impossibile aggiornare il ruolo',
      life: 5000,
    });
    // Ricarica membri per ripristinare stato corretto
    await tenantStore.fetchMembers();
  }
}

function confirmRemove(member: TenantMember) {
  memberToRemove.value = member;
  showRemoveDialog.value = true;
}

async function removeMember() {
  if (!memberToRemove.value) return;

  removing.value = true;
  try {
    const success = await tenantStore.removeMember(memberToRemove.value.userId);
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Membro Rimosso',
        detail: `${memberToRemove.value.firstName} ${memberToRemove.value.lastName} è stato rimosso dal team`,
        life: 3000,
      });
      showRemoveDialog.value = false;
      memberToRemove.value = null;
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: tenantStore.error || 'Impossibile rimuovere il membro',
        life: 5000,
      });
    }
  } finally {
    removing.value = false;
  }
}

function validateInviteForm(): boolean {
  let isValid = true;
  inviteErrors.email = '';

  if (!inviteForm.email) {
    inviteErrors.email = 'Email obbligatoria';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) {
    inviteErrors.email = 'Email non valida';
    isValid = false;
  }

  // Check se email già usata
  const existingMember = tenantStore.members.find(
    (m) => m.email.toLowerCase() === inviteForm.email.toLowerCase()
  );
  if (existingMember) {
    inviteErrors.email = 'Questa email è già associata a un membro del team';
    isValid = false;
  }

  const existingInvite = tenantStore.pendingInvites.find(
    (i) => i.email.toLowerCase() === inviteForm.email.toLowerCase()
  );
  if (existingInvite) {
    inviteErrors.email = 'È già stato inviato un invito a questa email';
    isValid = false;
  }

  return isValid;
}

async function sendInvite() {
  if (!validateInviteForm()) return;

  sendingInvite.value = true;
  try {
    const success = await tenantStore.inviteUser(inviteForm.email, inviteForm.role);
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Invito Inviato',
        detail: `È stato inviato un invito a ${inviteForm.email}`,
        life: 3000,
      });
      closeInviteDialog();
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: tenantStore.error || 'Impossibile inviare l\'invito',
        life: 5000,
      });
    }
  } finally {
    sendingInvite.value = false;
  }
}

function closeInviteDialog() {
  showInviteDialog.value = false;
  inviteForm.email = '';
  inviteForm.role = 'VIEWER';
  inviteErrors.email = '';
}

async function resendInvite(invite: TenantInvite) {
  resendingInvite.value = invite.id;
  try {
    const success = await tenantStore.resendInvite(invite.id);
    if (success) {
      toast.add({
        severity: 'success',
        summary: 'Invito Reinviato',
        detail: `L'invito è stato reinviato a ${invite.email}`,
        life: 3000,
      });
    } else {
      toast.add({
        severity: 'error',
        summary: 'Errore',
        detail: tenantStore.error || 'Impossibile reinviare l\'invito',
        life: 5000,
      });
    }
  } finally {
    resendingInvite.value = null;
  }
}

async function cancelInvite(invite: TenantInvite) {
  const success = await tenantStore.cancelInvite(invite.id);
  if (success) {
    toast.add({
      severity: 'success',
      summary: 'Invito Annullato',
      detail: `L'invito per ${invite.email} è stato annullato`,
      life: 3000,
    });
  } else {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: tenantStore.error || 'Impossibile annullare l\'invito',
      life: 5000,
    });
  }
}

// Load data on mount
onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      tenantStore.fetchMembers(),
      tenantStore.fetchPendingInvites(),
    ]);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.team-page {
  max-width: 1200px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.stat-card {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon i {
  font-size: 1.5rem;
  color: white;
}

.stat-icon.bg-primary {
  background: var(--color-primary-600);
}

.stat-icon.bg-success {
  background: var(--color-green-600);
}

.stat-icon.bg-warning {
  background: var(--color-yellow-600);
}

.stat-icon.bg-info {
  background: var(--color-blue-600);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

/* Section */
.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-gray-900);
  margin: 0 0 var(--space-5) 0;
}

.members-section,
.invites-section {
  background: var(--bg-card);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

/* Member Info */
.member-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.member-details {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.member-email {
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

/* Role dropdown */
.role-dropdown {
  min-width: 150px;
}

/* Action buttons */
.action-buttons {
  display: flex;
  gap: var(--space-1);
}

/* Text colors */
.text-danger {
  color: var(--color-red-600);
}

.ml-2 {
  margin-left: var(--space-2);
}

/* Invite Form */
.invite-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field label {
  font-weight: 500;
  color: var(--color-gray-700);
}

.field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-gray-500);
}

/* Remove Dialog */
.remove-dialog {
  text-align: center;
  padding: var(--space-4);
}

.warning-icon {
  font-size: 3rem;
  color: var(--color-yellow-500);
  margin-bottom: var(--space-4);
}

.remove-note {
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  margin-top: var(--space-3);
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .member-info {
    flex-direction: column;
    text-align: center;
  }
}
</style>
