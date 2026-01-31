<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="customer ? 'Modifica Cliente' : 'Nuovo Cliente'"
    :modal="true"
    :style="{ width: '900px' }"
    class="customer-dialog"
  >
    <div class="dialog-content">
      <!-- Type Selection -->
      <div class="type-selection" v-if="!customer">
        <div
          :class="['type-card', { active: formData.type === 'B2C' }]"
          @click="formData.type = 'B2C'"
        >
          <i class="pi pi-user"></i>
          <h4>Cliente Privato (B2C)</h4>
          <p>Cliente finale, persona fisica</p>
        </div>
        <div
          :class="['type-card', { active: formData.type === 'B2B' }]"
          @click="formData.type = 'B2B'"
        >
          <i class="pi pi-building"></i>
          <h4>Cliente Business (B2B)</h4>
          <p>Azienda con P.IVA</p>
        </div>
      </div>

      <TabView v-model:activeIndex="activeTab">
        <!-- Dati Anagrafici -->
        <TabPanel header="Anagrafica">
          <div class="form-section">
            <!-- B2B Fields -->
            <template v-if="formData.type === 'B2B'">
              <div class="form-group full-width">
                <label>Ragione Sociale *</label>
                <InputText v-model="formData.businessName" placeholder="Nome azienda" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Partita IVA</label>
                  <InputText v-model="formData.taxId" placeholder="IT..." />
                </div>
                <div class="form-group">
                  <label>Codice Fiscale</label>
                  <InputText v-model="formData.fiscalCode" placeholder="..." />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Codice SDI</label>
                  <InputText v-model="formData.sdiCode" placeholder="7 caratteri" maxlength="7" />
                </div>
                <div class="form-group">
                  <label>PEC</label>
                  <InputText v-model="formData.pecEmail" placeholder="pec@example.it" type="email" />
                </div>
              </div>
            </template>

            <!-- B2C Fields -->
            <template v-if="formData.type === 'B2C'">
              <div class="form-row">
                <div class="form-group">
                  <label>Nome *</label>
                  <InputText v-model="formData.firstName" placeholder="Nome" />
                </div>
                <div class="form-group">
                  <label>Cognome *</label>
                  <InputText v-model="formData.lastName" placeholder="Cognome" />
                </div>
              </div>
              <div class="form-group">
                <label>Codice Fiscale</label>
                <InputText v-model="formData.fiscalCode" placeholder="Codice fiscale" />
              </div>
            </template>

            <!-- Common Fields -->
            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <InputText v-model="formData.email" placeholder="email@example.com" type="email" />
              </div>
              <div class="form-group">
                <label>Telefono</label>
                <InputText v-model="formData.phone" placeholder="+39..." />
              </div>
            </div>

            <div class="form-group">
              <label>Note</label>
              <Textarea v-model="formData.notes" rows="2" placeholder="Note interne" />
            </div>
          </div>
        </TabPanel>

        <!-- Indirizzi -->
        <TabPanel header="Indirizzi">
          <div class="addresses-section">
            <div class="address-block">
              <h4><i class="pi pi-file"></i> Indirizzo Fatturazione</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Nome</label>
                  <InputText v-model="formData.billingAddress.firstName" />
                </div>
                <div class="form-group">
                  <label>Cognome</label>
                  <InputText v-model="formData.billingAddress.lastName" />
                </div>
              </div>
              <div class="form-group full-width">
                <label>Azienda</label>
                <InputText v-model="formData.billingAddress.company" />
              </div>
              <div class="form-group full-width">
                <label>Indirizzo</label>
                <InputText v-model="formData.billingAddress.address1" placeholder="Via, numero" />
              </div>
              <div class="form-group full-width">
                <label>Indirizzo 2</label>
                <InputText v-model="formData.billingAddress.address2" placeholder="Interno, scala, ecc." />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Citta</label>
                  <InputText v-model="formData.billingAddress.city" />
                </div>
                <div class="form-group">
                  <label>CAP</label>
                  <InputText v-model="formData.billingAddress.postcode" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Provincia</label>
                  <InputText v-model="formData.billingAddress.state" />
                </div>
                <div class="form-group">
                  <label>Paese</label>
                  <InputText v-model="formData.billingAddress.country" />
                </div>
              </div>
            </div>

            <div class="address-divider">
              <Button
                label="Copia da fatturazione"
                icon="pi pi-copy"
                class="p-button-text p-button-sm"
                @click="copyBillingToShipping"
              />
            </div>

            <div class="address-block">
              <h4><i class="pi pi-truck"></i> Indirizzo Spedizione</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Nome</label>
                  <InputText v-model="formData.shippingAddress.firstName" />
                </div>
                <div class="form-group">
                  <label>Cognome</label>
                  <InputText v-model="formData.shippingAddress.lastName" />
                </div>
              </div>
              <div class="form-group full-width">
                <label>Azienda</label>
                <InputText v-model="formData.shippingAddress.company" />
              </div>
              <div class="form-group full-width">
                <label>Indirizzo</label>
                <InputText v-model="formData.shippingAddress.address1" placeholder="Via, numero" />
              </div>
              <div class="form-group full-width">
                <label>Indirizzo 2</label>
                <InputText v-model="formData.shippingAddress.address2" placeholder="Interno, scala, ecc." />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Citta</label>
                  <InputText v-model="formData.shippingAddress.city" />
                </div>
                <div class="form-group">
                  <label>CAP</label>
                  <InputText v-model="formData.shippingAddress.postcode" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Provincia</label>
                  <InputText v-model="formData.shippingAddress.state" />
                </div>
                <div class="form-group">
                  <label>Paese</label>
                  <InputText v-model="formData.shippingAddress.country" />
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Condizioni Commerciali (solo B2B) -->
        <TabPanel header="Commerciale" v-if="formData.type === 'B2B'">
          <div class="form-section">
            <div class="form-row">
              <div class="form-group">
                <label>Listino Prezzi</label>
                <Dropdown
                  v-model="formData.priceListId"
                  :options="priceLists"
                  optionLabel="name"
                  optionValue="id"
                  placeholder="Seleziona listino"
                  showClear
                />
              </div>
              <div class="form-group">
                <label>Sconto Cliente %</label>
                <InputNumber
                  v-model="formData.discount"
                  :min="0"
                  :max="100"
                  suffix="%"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Termini Pagamento (giorni)</label>
                <InputNumber v-model="formData.paymentTerms" :min="0" suffix=" gg" />
              </div>
              <div class="form-group">
                <label>Limite Credito</label>
                <InputNumber
                  v-model="formData.creditLimit"
                  mode="currency"
                  currency="EUR"
                  locale="it-IT"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Gruppo Cliente</label>
                <InputText v-model="formData.customerGroup" placeholder="es. Gold, Silver, Bronze" />
              </div>
              <div class="form-group">
                <label>Fonte Acquisizione</label>
                <Dropdown
                  v-model="formData.acquisitionSource"
                  :options="acquisitionSources"
                  placeholder="Come ci ha conosciuti"
                  showClear
                />
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Info Bancarie (solo B2B) -->
        <TabPanel header="Dati Bancari" v-if="formData.type === 'B2B'">
          <div class="form-section">
            <div class="form-group">
              <label>Banca</label>
              <InputText v-model="formData.bankInfo.bankName" placeholder="Nome banca" />
            </div>
            <div class="form-group">
              <label>IBAN</label>
              <InputText v-model="formData.bankInfo.iban" placeholder="IT..." maxlength="34" />
            </div>
            <div class="form-group">
              <label>SWIFT/BIC</label>
              <InputText v-model="formData.bankInfo.swift" placeholder="..." maxlength="11" />
            </div>
            <div class="form-group">
              <label>Note Bancarie</label>
              <Textarea v-model="formData.bankInfo.notes" rows="2" placeholder="Note sui pagamenti" />
            </div>
          </div>
        </TabPanel>

        <!-- Contatti (solo B2B) -->
        <TabPanel header="Contatti" v-if="formData.type === 'B2B' && customer">
          <div class="contacts-section">
            <div class="section-header">
              <Button label="Aggiungi Contatto" icon="pi pi-plus" size="small" @click="showAddContact = true" />
            </div>
            <DataTable :value="contacts" :loading="loadingContacts" class="contacts-table">
              <Column header="Nome">
                <template #body="{ data }">
                  <div class="contact-name">
                    {{ data.firstName }} {{ data.lastName }}
                    <Tag v-if="data.isPrimary" severity="info" class="primary-tag">Principale</Tag>
                  </div>
                </template>
              </Column>
              <Column field="role" header="Ruolo" />
              <Column field="email" header="Email" />
              <Column field="phone" header="Telefono" />
              <Column header="" style="width: 80px">
                <template #body="{ data }">
                  <Button
                    icon="pi pi-trash"
                    class="p-button-rounded p-button-text p-button-danger"
                    @click="deleteContact(data.id)"
                  />
                </template>
              </Column>
              <template #empty>
                <div class="empty-contacts">Nessun contatto configurato</div>
              </template>
            </DataTable>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <div class="checkbox-group" v-if="customer">
            <Checkbox v-model="formData.isActive" :binary="true" inputId="isActiveCustomer" />
            <label for="isActiveCustomer">Cliente Attivo</label>
          </div>
        </div>
        <div class="footer-right">
          <Button label="Annulla" icon="pi pi-times" class="p-button-text" @click="closeDialog" />
          <Button
            :label="customer ? 'Salva Modifiche' : 'Crea Cliente'"
            icon="pi pi-check"
            @click="saveCustomer"
            :loading="saving"
          />
        </div>
      </div>
    </template>

    <!-- Add Contact Dialog -->
    <Dialog v-model:visible="showAddContact" header="Nuovo Contatto" :modal="true" :style="{ width: '500px' }">
      <div class="contact-form">
        <div class="form-row">
          <div class="form-group">
            <label>Nome *</label>
            <InputText v-model="newContact.firstName" />
          </div>
          <div class="form-group">
            <label>Cognome *</label>
            <InputText v-model="newContact.lastName" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Ruolo</label>
            <InputText v-model="newContact.role" placeholder="es. Responsabile Acquisti" />
          </div>
          <div class="form-group">
            <label>Reparto</label>
            <InputText v-model="newContact.department" placeholder="es. Ufficio Acquisti" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <InputText v-model="newContact.email" type="email" />
          </div>
          <div class="form-group">
            <label>Telefono</label>
            <InputText v-model="newContact.phone" />
          </div>
        </div>
        <div class="form-group">
          <label>Cellulare</label>
          <InputText v-model="newContact.mobile" />
        </div>
        <div class="checkbox-group">
          <Checkbox v-model="newContact.isPrimary" :binary="true" inputId="isPrimaryContact" />
          <label for="isPrimaryContact">Contatto principale</label>
        </div>
      </div>
      <template #footer>
        <Button label="Annulla" class="p-button-text" @click="showAddContact = false" />
        <Button label="Aggiungi" icon="pi pi-check" @click="addContact" :loading="savingContact" />
      </template>
    </Dialog>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';
import type { Customer, CustomerContact, PriceList } from '../types';

const props = defineProps<{
  visible: boolean;
  customer?: Customer | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'saved', customer: Customer): void;
}>();

const toast = useToast();
const activeTab = ref(0);
const saving = ref(false);
const priceLists = ref<PriceList[]>([]);
const contacts = ref<CustomerContact[]>([]);
const loadingContacts = ref(false);
const showAddContact = ref(false);
const savingContact = ref(false);

const emptyAddress = {
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  postcode: '',
  country: 'IT',
  email: '',
  phone: '',
};

const formData = ref({
  type: 'B2C' as 'B2C' | 'B2B',
  firstName: '',
  lastName: '',
  businessName: '',
  email: '',
  phone: '',
  taxId: '',
  fiscalCode: '',
  sdiCode: '',
  pecEmail: '',
  billingAddress: { ...emptyAddress },
  shippingAddress: { ...emptyAddress },
  paymentTerms: 30,
  creditLimit: undefined as number | undefined,
  discount: 0,
  priceListId: undefined as string | undefined,
  customerGroup: '',
  acquisitionSource: '',
  notes: '',
  isActive: true,
  bankInfo: {
    bankName: '',
    iban: '',
    swift: '',
    notes: '',
  },
});

const newContact = ref({
  firstName: '',
  lastName: '',
  role: '',
  department: '',
  email: '',
  phone: '',
  mobile: '',
  isPrimary: false,
});

const acquisitionSources = [
  'Referral',
  'Fiera',
  'Web',
  'Social Media',
  'Pubblicita',
  'Agente',
  'Altro',
];

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      if (props.customer) {
        loadCustomer(props.customer);
      } else {
        resetForm();
      }
      loadPriceLists();
    }
  },
  { immediate: true }
);

const loadPriceLists = async () => {
  try {
    const response = await api.get('/pricelists?isActive=true');
    if (response.success) {
      priceLists.value = response.data.items;
    }
  } catch (error) {
    console.error('Error loading price lists:', error);
  }
};

const loadCustomer = (customer: Customer) => {
  formData.value = {
    type: customer.type,
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    businessName: customer.businessName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    taxId: customer.taxId || '',
    fiscalCode: customer.fiscalCode || '',
    sdiCode: customer.sdiCode || '',
    pecEmail: customer.pecEmail || '',
    billingAddress: customer.billingAddress || { ...emptyAddress },
    shippingAddress: customer.shippingAddress || { ...emptyAddress },
    paymentTerms: customer.paymentTerms || 30,
    creditLimit: customer.creditLimit,
    discount: customer.discount || 0,
    priceListId: customer.priceListId,
    customerGroup: customer.customerGroup || '',
    acquisitionSource: customer.acquisitionSource || '',
    notes: customer.notes || '',
    isActive: customer.isActive,
    bankInfo: customer.bankInfo || {
      bankName: '',
      iban: '',
      swift: '',
      notes: '',
    },
  };

  if (customer.type === 'B2B') {
    loadContacts(customer.id);
  }
};

const loadContacts = async (customerId: string) => {
  try {
    loadingContacts.value = true;
    const response = await api.get(`/customers/${customerId}/contacts`);
    if (response.success) {
      contacts.value = response.data;
    }
  } catch (error) {
    console.error('Error loading contacts:', error);
  } finally {
    loadingContacts.value = false;
  }
};

const resetForm = () => {
  formData.value = {
    type: 'B2C',
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    phone: '',
    taxId: '',
    fiscalCode: '',
    sdiCode: '',
    pecEmail: '',
    billingAddress: { ...emptyAddress },
    shippingAddress: { ...emptyAddress },
    paymentTerms: 30,
    creditLimit: undefined,
    discount: 0,
    priceListId: undefined,
    customerGroup: '',
    acquisitionSource: '',
    notes: '',
    isActive: true,
    bankInfo: {
      bankName: '',
      iban: '',
      swift: '',
      notes: '',
    },
  };
  contacts.value = [];
  activeTab.value = 0;
};

const copyBillingToShipping = () => {
  formData.value.shippingAddress = { ...formData.value.billingAddress };
};

const closeDialog = () => {
  emit('update:visible', false);
  resetForm();
};

const validateForm = (): boolean => {
  if (formData.value.type === 'B2B') {
    if (!formData.value.businessName?.trim()) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'La ragione sociale e obbligatoria',
        life: 3000,
      });
      return false;
    }
  } else {
    if (!formData.value.firstName?.trim() || !formData.value.lastName?.trim()) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Nome e cognome sono obbligatori',
        life: 3000,
      });
      return false;
    }
  }
  return true;
};

const saveCustomer = async () => {
  if (!validateForm()) return;

  try {
    saving.value = true;

    const data = {
      ...formData.value,
      billingAddress: Object.values(formData.value.billingAddress).some(v => v) ? formData.value.billingAddress : undefined,
      shippingAddress: Object.values(formData.value.shippingAddress).some(v => v) ? formData.value.shippingAddress : undefined,
    };

    let response;
    if (props.customer) {
      response = await api.put(`/customers/${props.customer.id}`, data);

      // Update bank info separately if B2B
      if (formData.value.type === 'B2B' && formData.value.bankInfo.iban) {
        await api.post(`/customers/${props.customer.id}/bank-info`, formData.value.bankInfo);
      }
    } else {
      response = await api.post('/customers', data);
    }

    if (response.success) {
      toast.add({
        severity: 'success',
        summary: props.customer ? 'Cliente aggiornato' : 'Cliente creato',
        detail: 'Operazione completata con successo',
        life: 3000,
      });
      emit('saved', response.data);
      closeDialog();
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  } finally {
    saving.value = false;
  }
};

const addContact = async () => {
  if (!newContact.value.firstName || !newContact.value.lastName) {
    toast.add({
      severity: 'warn',
      summary: 'Attenzione',
      detail: 'Nome e cognome sono obbligatori',
      life: 3000,
    });
    return;
  }

  try {
    savingContact.value = true;
    const response = await api.post(`/customers/${props.customer!.id}/contacts`, newContact.value);
    if (response.success) {
      contacts.value.push(response.data);
      showAddContact.value = false;
      newContact.value = {
        firstName: '',
        lastName: '',
        role: '',
        department: '',
        email: '',
        phone: '',
        mobile: '',
        isPrimary: false,
      };
      toast.add({
        severity: 'success',
        summary: 'Contatto aggiunto',
        life: 3000,
      });
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  } finally {
    savingContact.value = false;
  }
};

const deleteContact = async (contactId: string) => {
  try {
    await api.delete(`/customers/${props.customer!.id}/contacts/${contactId}`);
    contacts.value = contacts.value.filter(c => c.id !== contactId);
    toast.add({
      severity: 'success',
      summary: 'Contatto eliminato',
      life: 3000,
    });
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message,
      life: 3000,
    });
  }
};
</script>

<style scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Type Selection */
.type-selection {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.type-card {
  padding: var(--space-6);
  border: 2px solid var(--border-color-light);
  border-radius: var(--border-radius-lg);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.type-card:hover {
  border-color: var(--color-primary-300);
  background: var(--color-primary-50);
}

.type-card.active {
  border-color: var(--color-primary-600);
  background: var(--color-primary-50);
}

.type-card i {
  font-size: 2rem;
  color: var(--color-primary-600);
  margin-bottom: var(--space-3);
}

.type-card h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--font-size-md);
}

.type-card p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-gray-500);
}

/* Form */
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: var(--color-gray-700);
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.checkbox-group label {
  margin: 0;
  cursor: pointer;
}

/* Addresses */
.addresses-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.address-block {
  padding: var(--space-4);
  background: var(--color-gray-50);
  border-radius: var(--border-radius-md);
}

.address-block h4 {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-md);
  color: var(--color-gray-700);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.address-divider {
  display: flex;
  justify-content: center;
  padding: var(--space-2);
}

/* Contacts */
.contacts-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-header {
  display: flex;
  justify-content: flex-end;
}

.contact-name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.primary-tag {
  font-size: var(--font-size-xs);
}

.empty-contacts {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-gray-400);
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-left {
  display: flex;
  align-items: center;
}

.footer-right {
  display: flex;
  gap: var(--space-2);
}

/* Contact Form */
.contact-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Responsive */
@media (max-width: 768px) {
  .type-selection,
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
