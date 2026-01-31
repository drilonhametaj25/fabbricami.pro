<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Textarea from 'primevue/textarea';
import Calendar from 'primevue/calendar';
import Checkbox from 'primevue/checkbox';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Divider from 'primevue/divider';
import Tag from 'primevue/tag';
import AutoComplete from 'primevue/autocomplete';
import SelectButton from 'primevue/selectbutton';
import Message from 'primevue/message';
import FileUpload from 'primevue/fileupload';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';
import api from '../services/api.service';

// Debounce utility
const debounce = (fn: Function, delay: number) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

interface Props {
  modelValue: boolean;
  editOrder?: any; // If provided, we're in edit mode
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const toast = useToast();
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const activeTab = ref(0);
const loading = ref(false);
const saving = ref(false);
const isEditMode = computed(() => !!props.editOrder);

// Server-side search data
const customerSuggestions = ref<any[]>([]);
const productSuggestions = ref<any[]>([]);
const searchingCustomers = ref(false);
const searchingProducts = ref(false);

// Price lists
const availablePriceLists = ref<any[]>([]);
const selectedPriceList = ref<any>(null);
const addressLoadedFrom = ref<string | null>(null);

// Attachments
const newAttachment = ref({ name: '', url: '', type: 'document' });
const uploadingFile = ref(false);
const uploadProgress = ref(0);

// Payment installments
const installmentModes = [
  { label: 'Nessuna Rata', value: 'none' },
  { label: 'Automatiche', value: 'auto' },
  { label: 'Manuali', value: 'manual' },
];
const previewInstallments = ref<any[]>([]);
const customInstallments = ref<any[]>([]);

// Form data
const orderForm = ref({
  customerId: '',
  customerData: null as any,
  source: 'MANUAL',
  orderDate: new Date(),
  priority: 0,
  estimatedDelivery: null as Date | null,

  // Items
  items: [] as Array<{
    productId: string;
    productData: any;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    notes: string;
    priceSource: string;
  }>,

  // Addresses
  shippingAddress: {
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'IT',
    phone: '',
    email: '',
  },
  billingAddress: {
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'IT',
    phone: '',
    email: '',
  },
  sameAsBilling: true,

  // Payment
  paymentMethod: '',
  paymentMethodTitle: '',
  b2bPaymentMethod: null as string | null,
  b2bPaymentTerms: 30,

  // Notes
  notes: '',
  customerNote: '',
  internalNotes: '',

  // Options
  generatePaymentDues: false,
  shipping: 0,
  discount: 0,

  // New fields
  priceListId: null as string | null,
  installmentMode: 'none' as 'none' | 'auto' | 'manual',
  attachments: [] as any[],
});

// Dropdown options
const sourceOptions = [
  { label: 'Manuale', value: 'MANUAL' },
  { label: 'B2B', value: 'B2B' },
];

const priorityOptions = [
  { label: 'Normale', value: 0 },
  { label: 'Alta', value: 1 },
  { label: 'Urgente', value: 2 },
];

const b2bPaymentMethods = [
  { label: 'Bonifico', value: 'BONIFICO' },
  { label: 'RiBa', value: 'RIBA' },
  { label: 'Contanti', value: 'CONTANTI' },
  { label: 'Fido', value: 'FIDO' },
  { label: 'Assegno', value: 'ASSEGNO' },
  { label: 'Carta', value: 'CARTA' },
];

const paymentTermsOptions = [
  { label: 'Immediato', value: 0 },
  { label: '30 giorni', value: 30 },
  { label: '60 giorni', value: 60 },
  { label: '90 giorni', value: 90 },
  { label: '120 giorni', value: 120 },
];

// Computed totals
const subtotal = computed(() => {
  return orderForm.value.items.reduce((sum, item) => {
    const lineTotal = (item.unitPrice || 0) * (item.quantity || 0);
    const discountAmount = lineTotal * ((item.discount || 0) / 100);
    return sum + lineTotal - discountAmount;
  }, 0);
});

const tax = computed(() => {
  // Calcola IVA per ogni item usando la sua aliquota specifica
  return orderForm.value.items.reduce((sum, item) => {
    const lineTotal = (item.unitPrice || 0) * (item.quantity || 0);
    const discountAmount = lineTotal * ((item.discount || 0) / 100);
    const taxableAmount = lineTotal - discountAmount;
    const itemTaxRate = item.taxRate ?? 22; // Default 22%
    return sum + taxableAmount * (itemTaxRate / 100);
  }, 0);
});

const total = computed(() => {
  return subtotal.value + tax.value + (orderForm.value.shipping || 0) - (orderForm.value.discount || 0);
});

// Server-side search functions
const searchCustomersApi = async (query: string) => {
  if (!query || query.length < 1) {
    customerSuggestions.value = [];
    return;
  }

  searchingCustomers.value = true;
  try {
    const response = await api.get(`/customers?search=${encodeURIComponent(query)}&limit=20&isActive=true`);
    customerSuggestions.value = response.data?.items || [];
  } catch (error) {
    console.error('Error searching customers:', error);
    customerSuggestions.value = [];
  } finally {
    searchingCustomers.value = false;
  }
};

const searchProductsApi = async (query: string) => {
  if (!query || query.length < 1) {
    productSuggestions.value = [];
    return;
  }

  searchingProducts.value = true;
  try {
    const response = await api.get(`/products?search=${encodeURIComponent(query)}&limit=20&isActive=true`);
    productSuggestions.value = response.data?.items || [];
  } catch (error) {
    console.error('Error searching products:', error);
    productSuggestions.value = [];
  } finally {
    searchingProducts.value = false;
  }
};

// Debounced search handlers
const debouncedCustomerSearch = debounce(searchCustomersApi, 300);
const debouncedProductSearch = debounce(searchProductsApi, 300);

const searchCustomers = (event: any) => {
  debouncedCustomerSearch(event.query);
};

const searchProducts = (event: any) => {
  debouncedProductSearch(event.query);
};

// Load available price lists
const loadPriceLists = async () => {
  try {
    const response = await api.get('/price-lists?isActive=true&limit=100');
    availablePriceLists.value = response.data?.items || [];
  } catch (error) {
    console.error('Error loading price lists:', error);
  }
};

// Customer selection handler
const onCustomerSelect = (customer: any) => {
  orderForm.value.customerId = customer.id;
  orderForm.value.customerData = customer;

  // Copy addresses from customer
  if (customer.billingAddress) {
    Object.assign(orderForm.value.billingAddress, customer.billingAddress);
    addressLoadedFrom.value = 'customer';
  }
  if (customer.shippingAddress) {
    Object.assign(orderForm.value.shippingAddress, customer.shippingAddress);
  }

  // Set B2B defaults
  if (customer.type === 'B2B') {
    orderForm.value.source = 'B2B';
    orderForm.value.b2bPaymentTerms = customer.paymentTerms || 30;

    // Set price list from customer
    if (customer.priceList) {
      orderForm.value.priceListId = customer.priceList.id;
      selectedPriceList.value = customer.priceList;
    }

    // Set installment mode based on customer payment plan
    if (customer.paymentPlan) {
      orderForm.value.installmentMode = 'auto';
      calculatePreviewInstallments();
    } else {
      orderForm.value.installmentMode = 'none';
    }
  }
};

// Calculate preview installments from customer payment plan
const calculatePreviewInstallments = () => {
  const customer = orderForm.value.customerData;
  if (!customer?.paymentPlan?.installments) {
    previewInstallments.value = [];
    return;
  }

  const orderTotal = total.value;
  const orderDate = orderForm.value.orderDate || new Date();

  previewInstallments.value = customer.paymentPlan.installments.map((inst: any, idx: number) => {
    const dueDate = new Date(orderDate);
    dueDate.setDate(dueDate.getDate() + (inst.daysFromInvoice || 0));

    return {
      number: `Rata ${idx + 1}/${customer.paymentPlan.installments.length}`,
      dueDate: dueDate.toLocaleDateString('it-IT'),
      amount: formatCurrency((orderTotal * (inst.percentage || 0)) / 100),
      percentage: inst.percentage,
    };
  });
};

// Custom installments management
const addCustomInstallment = () => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  customInstallments.value.push({
    dueDate: dueDate,
    amount: 0,
  });
};

const removeCustomInstallment = (index: number) => {
  customInstallments.value.splice(index, 1);
};

// Computed: total of custom installments
const customInstallmentsTotal = computed(() => {
  return customInstallments.value.reduce((sum, inst) => sum + (inst.amount || 0), 0);
});

// Computed: check if installments total matches order total
const installmentsTotalMismatch = computed(() => {
  if (orderForm.value.installmentMode !== 'manual' || customInstallments.value.length === 0) {
    return false;
  }
  return Math.abs(customInstallmentsTotal.value - total.value) > 0.01;
});

// Attachments management
const addManualAttachment = () => {
  if (!newAttachment.value.name || !newAttachment.value.url) {
    toast.add({ severity: 'warn', summary: 'Attenzione', detail: 'Inserisci nome e URL', life: 3000 });
    return;
  }

  orderForm.value.attachments.push({
    name: newAttachment.value.name,
    url: newAttachment.value.url,
    type: newAttachment.value.type || 'document',
    addedAt: new Date().toISOString(),
  });

  newAttachment.value = { name: '', url: '', type: 'document' };
};

const removeAttachment = (index: number) => {
  orderForm.value.attachments.splice(index, 1);
};

// Upload file attachment
const onFileUpload = async (event: any) => {
  const file = event.files[0];
  if (!file) return;

  uploadingFile.value = true;
  uploadProgress.value = 0;

  try {
    const formData = new FormData();
    formData.append('file', file);

    // Use fetch for multipart upload with progress
    const response = await fetch('/api/v1/orders/attachments/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      orderForm.value.attachments.push({
        name: result.data.name,
        url: result.data.url,
        type: result.data.type,
        size: result.data.size,
        addedAt: new Date().toISOString(),
      });
      toast.add({ severity: 'success', summary: 'Successo', detail: 'File caricato', life: 3000 });
    } else {
      toast.add({ severity: 'error', summary: 'Errore', detail: result.error || 'Errore upload', life: 5000 });
    }
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Errore', detail: error.message || 'Errore upload file', life: 5000 });
  } finally {
    uploadingFile.value = false;
    uploadProgress.value = 0;
  }
};

// Format file size
const formatFileSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getAttachmentIcon = (type: string) => {
  const icons: Record<string, string> = {
    pdf: 'pi pi-file-pdf',
    image: 'pi pi-image',
    document: 'pi pi-file',
    spreadsheet: 'pi pi-file-excel',
  };
  return icons[type] || 'pi pi-file';
};

// Product selection handler for an item
const onProductSelect = async (item: any, product: any) => {
  item.productId = product.id;
  item.productData = product;
  item.unitPrice = Number(product.price) || 0;
  item.taxRate = Number(product.taxRate) || 22; // Aliquota IVA dal prodotto, default 22%
  item.priceSource = 'Prezzo base';

  // If B2B customer, calculate price from price list
  if (orderForm.value.customerData?.type === 'B2B') {
    try {
      const payload: any = {
        customerId: orderForm.value.customerId,
        items: [{ productId: product.id, quantity: item.quantity || 1 }],
      };

      // Use selected price list if different from customer's default
      if (orderForm.value.priceListId) {
        payload.priceListId = orderForm.value.priceListId;
      }

      const response = await api.post('/orders/b2b/preview', payload);

      if (response.success && response.data?.items?.[0]) {
        const priceItem = response.data.items[0];
        item.unitPrice = priceItem.finalPrice;
        item.discount = priceItem.discount || 0;
        item.priceSource = priceItem.discountSource || 'Listino B2B';
      }
    } catch (error) {
      console.error('Error calculating B2B price:', error);
    }
  }

  // Recalculate preview installments after price change
  if (orderForm.value.installmentMode === 'auto') {
    calculatePreviewInstallments();
  }
};

// Items management
const addItem = () => {
  orderForm.value.items.push({
    productId: '',
    productData: null,
    variantId: null,
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxRate: 22, // IVA default 22%
    notes: '',
    priceSource: '',
  });
};

const removeItem = (index: number) => {
  orderForm.value.items.splice(index, 1);
};

// Calculate item total
const getItemTotal = (item: any) => {
  const lineTotal = (item.unitPrice || 0) * (item.quantity || 0);
  const discountAmount = lineTotal * ((item.discount || 0) / 100);
  return lineTotal - discountAmount;
};

// Copy billing to shipping
const copyBillingToShipping = () => {
  Object.assign(orderForm.value.shippingAddress, orderForm.value.billingAddress);
};

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value || 0);
};

// Validation
const validateForm = () => {
  if (!orderForm.value.customerId) {
    toast.add({ severity: 'warn', summary: 'Attenzione', detail: 'Seleziona un cliente', life: 3000 });
    activeTab.value = 0;
    return false;
  }

  const validItems = orderForm.value.items.filter(i => i.productId && i.quantity > 0);
  if (validItems.length === 0) {
    toast.add({ severity: 'warn', summary: 'Attenzione', detail: 'Aggiungi almeno un articolo', life: 3000 });
    activeTab.value = 1;
    return false;
  }

  // Validate custom installments if in manual mode
  if (orderForm.value.installmentMode === 'manual') {
    if (customInstallments.value.length === 0) {
      toast.add({ severity: 'warn', summary: 'Attenzione', detail: 'Aggiungi almeno una rata', life: 3000 });
      activeTab.value = 3;
      return false;
    }

    if (installmentsTotalMismatch.value) {
      toast.add({
        severity: 'warn',
        summary: 'Attenzione',
        detail: 'Il totale delle rate deve corrispondere al totale ordine',
        life: 5000,
      });
      activeTab.value = 3;
      return false;
    }
  }

  return true;
};

// Save order
const saveOrder = async () => {
  if (!validateForm()) return;

  saving.value = true;
  try {
    const validItems = orderForm.value.items.filter(i => i.productId && i.quantity > 0);

    // Prepare custom installments for backend
    const customInstallmentsPayload = orderForm.value.installmentMode === 'manual'
      ? customInstallments.value.map((inst, idx) => ({
          installmentNumber: idx + 1,
          totalInstallments: customInstallments.value.length,
          amount: inst.amount,
          dueDate: inst.dueDate instanceof Date ? inst.dueDate.toISOString() : inst.dueDate,
        }))
      : undefined;

    const payload: any = {
      customerId: orderForm.value.customerId,
      source: orderForm.value.source,
      items: validItems.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        notes: i.notes,
      })),
      shippingAddress: orderForm.value.sameAsBilling
        ? orderForm.value.billingAddress
        : orderForm.value.shippingAddress,
      billingAddress: orderForm.value.billingAddress,
      paymentMethod: orderForm.value.paymentMethod,
      paymentMethodTitle: orderForm.value.paymentMethodTitle,
      b2bPaymentMethod: orderForm.value.b2bPaymentMethod,
      b2bPaymentTerms: orderForm.value.b2bPaymentTerms,
      shipping: orderForm.value.shipping,
      discount: orderForm.value.discount,
      notes: orderForm.value.notes,
      customerNote: orderForm.value.customerNote,
      internalNotes: orderForm.value.internalNotes,
      priority: orderForm.value.priority,
      estimatedDelivery: orderForm.value.estimatedDelivery?.toISOString(),
      priceListId: orderForm.value.priceListId,
      attachments: orderForm.value.attachments,
    };

    // Handle payment dues based on mode
    if (orderForm.value.installmentMode === 'auto') {
      payload.generatePaymentDues = true;
    } else if (orderForm.value.installmentMode === 'manual') {
      payload.customInstallments = customInstallmentsPayload;
    }

    if (isEditMode.value) {
      await api.put(`/orders/${props.editOrder.id}/full`, payload);
      toast.add({ severity: 'success', summary: 'Successo', detail: 'Ordine aggiornato', life: 3000 });
    } else {
      await api.post('/orders/full', payload);
      toast.add({ severity: 'success', summary: 'Successo', detail: 'Ordine creato', life: 3000 });
    }

    emit('saved');
    visible.value = false;
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore nel salvataggio',
      life: 5000,
    });
  } finally {
    saving.value = false;
  }
};

// Reset form
const resetForm = () => {
  orderForm.value = {
    customerId: '',
    customerData: null,
    source: 'MANUAL',
    orderDate: new Date(),
    priority: 0,
    estimatedDelivery: null,
    items: [],
    shippingAddress: {
      firstName: '', lastName: '', company: '', address1: '', address2: '',
      city: '', state: '', postcode: '', country: 'IT', phone: '', email: '',
    },
    billingAddress: {
      firstName: '', lastName: '', company: '', address1: '', address2: '',
      city: '', state: '', postcode: '', country: 'IT', phone: '', email: '',
    },
    sameAsBilling: true,
    paymentMethod: '',
    paymentMethodTitle: '',
    b2bPaymentMethod: null,
    b2bPaymentTerms: 30,
    notes: '',
    customerNote: '',
    internalNotes: '',
    generatePaymentDues: false,
    shipping: 0,
    discount: 0,
    priceListId: null,
    installmentMode: 'none',
    attachments: [],
  };

  // Reset other state
  customInstallments.value = [];
  previewInstallments.value = [];
  addressLoadedFrom.value = null;
  selectedPriceList.value = null;
  newAttachment.value = { name: '', url: '', type: 'document' };

  addItem(); // Start with one empty item
  activeTab.value = 0;
};

// Load edit data
const loadEditData = async () => {
  if (!props.editOrder) return;

  loading.value = true;
  try {
    const response = await api.get(`/orders/${props.editOrder.id}/full`);
    const order = response.data;

    // Use customer from order response
    const customer = order.customer;

    orderForm.value = {
      customerId: order.customerId,
      customerData: customer || order.customer,
      source: order.source,
      orderDate: new Date(order.orderDate),
      priority: order.priority || 0,
      estimatedDelivery: order.estimatedDelivery ? new Date(order.estimatedDelivery) : null,
      items: order.items.map((item: any) => ({
        productId: item.productId,
        productData: item.product,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        notes: item.notes || '',
        priceSource: item.priceSource || '',
      })),
      shippingAddress: order.shippingAddress || {
        firstName: '', lastName: '', company: '', address1: '', address2: '',
        city: '', state: '', postcode: '', country: 'IT', phone: '', email: '',
      },
      billingAddress: order.billingAddress || {
        firstName: '', lastName: '', company: '', address1: '', address2: '',
        city: '', state: '', postcode: '', country: 'IT', phone: '', email: '',
      },
      sameAsBilling: false,
      paymentMethod: order.paymentMethod || '',
      paymentMethodTitle: order.paymentMethodTitle || '',
      b2bPaymentMethod: order.b2bPaymentMethod,
      b2bPaymentTerms: order.b2bPaymentTerms || 30,
      notes: order.notes || '',
      customerNote: order.customerNote || '',
      internalNotes: order.internalNotes || '',
      generatePaymentDues: false,
      shipping: Number(order.shipping) || 0,
      discount: Number(order.discount) || 0,
      priceListId: customer?.priceList?.id || null,
      installmentMode: order.paymentDues?.length > 0 ? 'auto' : 'none',
      attachments: order.attachments || [],
    };

    // Load existing payment dues as custom installments if in edit mode
    if (order.paymentDues?.length > 0) {
      customInstallments.value = order.paymentDues.map((pd: any) => ({
        dueDate: new Date(pd.dueDate),
        amount: Number(pd.amount),
      }));
    }
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Errore',
      detail: error.message || 'Errore caricamento ordine',
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
};

// Watch for dialog open
watch(() => props.modelValue, async (val) => {
  if (val) {
    // Load price lists for B2B dropdown
    await loadPriceLists();

    if (props.editOrder) {
      await loadEditData();
    } else {
      resetForm();
    }
  }
});

// Watch for installment mode changes to recalculate preview
watch(() => orderForm.value.installmentMode, (mode) => {
  if (mode === 'auto') {
    calculatePreviewInstallments();
  }
});

// Watch for total changes to recalculate installments preview
watch(() => total.value, () => {
  if (orderForm.value.installmentMode === 'auto') {
    calculatePreviewInstallments();
  }
});

onMounted(() => {
  addItem();
});
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="isEditMode ? `Modifica Ordine ${editOrder?.orderNumber || ''}` : 'Nuovo Ordine'"
    :modal="true"
    :closable="true"
    :style="{ width: '1000px', maxWidth: '95vw' }"
    :contentStyle="{ maxHeight: '80vh', overflow: 'auto' }"
    class="order-create-dialog"
  >
    <TabView v-model:activeIndex="activeTab">
      <!-- TAB 1: Cliente & Info Base -->
      <TabPanel header="Cliente">
        <div class="form-section">
          <div class="form-grid">
            <div class="field full-width">
              <label for="customer">Cliente *</label>
              <AutoComplete
                id="customer"
                v-model="orderForm.customerData"
                :suggestions="customerSuggestions"
                @complete="searchCustomers"
                @item-select="onCustomerSelect($event.value)"
                :optionLabel="(c: any) => c.businessName || `${c.firstName} ${c.lastName}`"
                placeholder="Digita per cercare cliente..."
                class="w-full"
                :disabled="isEditMode"
                :loading="searchingCustomers"
                :minLength="1"
              >
                <template #option="{ option }">
                  <div class="customer-option">
                    <span class="customer-code">{{ option.code }}</span>
                    <span class="customer-name">{{ option.businessName || `${option.firstName} ${option.lastName}` }}</span>
                    <Tag v-if="option.type === 'B2B'" value="B2B" severity="success" class="customer-type" />
                  </div>
                </template>
              </AutoComplete>
              <small class="search-hint">Inizia a digitare per cercare tra i clienti</small>
            </div>

            <div class="field">
              <label for="source">Sorgente</label>
              <Dropdown
                id="source"
                v-model="orderForm.source"
                :options="sourceOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
                :disabled="isEditMode"
              />
            </div>

            <div class="field">
              <label for="priority">Priorità</label>
              <Dropdown
                id="priority"
                v-model="orderForm.priority"
                :options="priorityOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>

            <div class="field">
              <label for="orderDate">Data Ordine</label>
              <Calendar
                id="orderDate"
                v-model="orderForm.orderDate"
                dateFormat="dd/mm/yy"
                showIcon
                class="w-full"
              />
            </div>

            <div class="field">
              <label for="estimatedDelivery">Consegna Stimata</label>
              <Calendar
                id="estimatedDelivery"
                v-model="orderForm.estimatedDelivery"
                dateFormat="dd/mm/yy"
                showIcon
                class="w-full"
              />
            </div>
          </div>

          <!-- Customer info summary -->
          <div v-if="orderForm.customerData" class="customer-summary">
            <h4>Riepilogo Cliente</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Tipo:</span>
                <Tag :value="orderForm.customerData.type" :severity="orderForm.customerData.type === 'B2B' ? 'success' : 'info'" />
              </div>
              <div class="info-item" v-if="orderForm.customerData.email">
                <span class="label">Email:</span>
                <span>{{ orderForm.customerData.email }}</span>
              </div>
              <div class="info-item" v-if="orderForm.customerData.phone">
                <span class="label">Telefono:</span>
                <span>{{ orderForm.customerData.phone }}</span>
              </div>
              <div class="info-item" v-if="orderForm.customerData.discount">
                <span class="label">Sconto cliente:</span>
                <span>{{ orderForm.customerData.discount }}%</span>
              </div>
              <div class="info-item" v-if="orderForm.customerData.paymentPlan">
                <span class="label">Piano pagamento:</span>
                <span>{{ orderForm.customerData.paymentPlan.name }}</span>
              </div>
            </div>

            <!-- Price list selection for B2B -->
            <div v-if="orderForm.customerData.type === 'B2B'" class="price-list-section">
              <Divider />
              <h5>Listino Prezzi</h5>
              <div class="price-list-row">
                <div class="price-list-current" v-if="orderForm.customerData.priceList">
                  <Tag severity="info" class="price-list-tag">
                    <i class="pi pi-tag"></i>
                    Listino assegnato: {{ orderForm.customerData.priceList.name }}
                    <span v-if="orderForm.customerData.priceList.discount">({{ orderForm.customerData.priceList.discount }}%)</span>
                  </Tag>
                </div>
                <div class="field price-list-dropdown">
                  <label>Usa listino diverso:</label>
                  <Dropdown
                    v-model="orderForm.priceListId"
                    :options="availablePriceLists"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Listino cliente"
                    showClear
                    class="w-full"
                  >
                    <template #option="{ option }">
                      <div class="pricelist-option">
                        <span>{{ option.name }}</span>
                        <small v-if="option.discount">Sconto: {{ option.discount }}%</small>
                      </div>
                    </template>
                  </Dropdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- TAB 2: Articoli -->
      <TabPanel header="Articoli">
        <div class="form-section">
          <DataTable :value="orderForm.items" responsiveLayout="scroll" class="items-table">
            <Column header="Prodotto" style="min-width: 300px">
              <template #body="{ data }">
                <AutoComplete
                  v-model="data.productData"
                  :suggestions="productSuggestions"
                  @complete="searchProducts"
                  @item-select="onProductSelect(data, $event.value)"
                  :optionLabel="(p: any) => p ? `${p.sku} - ${p.name}` : ''"
                  placeholder="Digita per cercare prodotto..."
                  class="w-full"
                  :loading="searchingProducts"
                  :minLength="1"
                >
                  <template #option="{ option }">
                    <div class="product-option">
                      <span class="product-sku">{{ option.sku }}</span>
                      <span class="product-name">{{ option.name }}</span>
                      <span class="product-price">{{ formatCurrency(option.price) }}</span>
                    </div>
                  </template>
                </AutoComplete>
                <small v-if="data.priceSource" class="price-source">
                  {{ data.priceSource }}
                </small>
              </template>
            </Column>
            <Column header="Qtà" style="width: 100px">
              <template #body="{ data }">
                <InputNumber
                  v-model="data.quantity"
                  :min="1"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="Prezzo" style="width: 130px">
              <template #body="{ data }">
                <InputNumber
                  v-model="data.unitPrice"
                  mode="currency"
                  currency="EUR"
                  locale="it-IT"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="Sconto %" style="width: 100px">
              <template #body="{ data }">
                <InputNumber
                  v-model="data.discount"
                  :min="0"
                  :max="100"
                  suffix="%"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="IVA %" style="width: 80px">
              <template #body="{ data }">
                <InputNumber
                  v-model="data.taxRate"
                  :min="0"
                  :max="100"
                  suffix="%"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="Totale" style="width: 120px">
              <template #body="{ data }">
                <strong>{{ formatCurrency(getItemTotal(data)) }}</strong>
              </template>
            </Column>
            <Column style="width: 60px">
              <template #body="{ index }">
                <Button
                  icon="pi pi-trash"
                  class="p-button-danger p-button-text"
                  @click="removeItem(index)"
                  :disabled="orderForm.items.length === 1"
                />
              </template>
            </Column>
          </DataTable>

          <Button
            label="Aggiungi Articolo"
            icon="pi pi-plus"
            class="p-button-text mt-3"
            @click="addItem"
          />

          <Divider />

          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-row">
              <span>Subtotale:</span>
              <span>{{ formatCurrency(subtotal) }}</span>
            </div>
            <div class="totals-row">
              <span>
                Spedizione:
                <InputNumber
                  v-model="orderForm.shipping"
                  mode="currency"
                  currency="EUR"
                  locale="it-IT"
                  class="shipping-input"
                />
              </span>
              <span>{{ formatCurrency(orderForm.shipping) }}</span>
            </div>
            <div class="totals-row">
              <span>
                Sconto ordine:
                <InputNumber
                  v-model="orderForm.discount"
                  mode="currency"
                  currency="EUR"
                  locale="it-IT"
                  class="discount-input"
                />
              </span>
              <span class="discount-value">-{{ formatCurrency(orderForm.discount) }}</span>
            </div>
            <div class="totals-row">
              <span>IVA (22%):</span>
              <span>{{ formatCurrency(tax) }}</span>
            </div>
            <Divider />
            <div class="totals-row total-final">
              <span>TOTALE:</span>
              <span>{{ formatCurrency(total) }}</span>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- TAB 3: Indirizzi -->
      <TabPanel header="Indirizzi">
        <div class="form-section addresses-section">
          <!-- Address loaded message -->
          <Message v-if="addressLoadedFrom === 'customer'" severity="info" :closable="false" class="address-info-message">
            <i class="pi pi-info-circle"></i>
            Indirizzi caricati dall'anagrafica cliente. Puoi modificarli se necessario.
          </Message>

          <!-- Billing Address -->
          <div class="address-block">
            <h4><i class="pi pi-file"></i> Indirizzo Fatturazione</h4>
            <div class="form-grid">
              <div class="field">
                <label>Nome</label>
                <InputText v-model="orderForm.billingAddress.firstName" class="w-full" />
              </div>
              <div class="field">
                <label>Cognome</label>
                <InputText v-model="orderForm.billingAddress.lastName" class="w-full" />
              </div>
              <div class="field full-width">
                <label>Azienda</label>
                <InputText v-model="orderForm.billingAddress.company" class="w-full" />
              </div>
              <div class="field full-width">
                <label>Indirizzo</label>
                <InputText v-model="orderForm.billingAddress.address1" class="w-full" />
              </div>
              <div class="field full-width">
                <label>Indirizzo 2</label>
                <InputText v-model="orderForm.billingAddress.address2" class="w-full" />
              </div>
              <div class="field">
                <label>CAP</label>
                <InputText v-model="orderForm.billingAddress.postcode" class="w-full" />
              </div>
              <div class="field">
                <label>Città</label>
                <InputText v-model="orderForm.billingAddress.city" class="w-full" />
              </div>
              <div class="field">
                <label>Provincia</label>
                <InputText v-model="orderForm.billingAddress.state" class="w-full" />
              </div>
              <div class="field">
                <label>Paese</label>
                <InputText v-model="orderForm.billingAddress.country" class="w-full" />
              </div>
              <div class="field">
                <label>Email</label>
                <InputText v-model="orderForm.billingAddress.email" class="w-full" />
              </div>
              <div class="field">
                <label>Telefono</label>
                <InputText v-model="orderForm.billingAddress.phone" class="w-full" />
              </div>
            </div>
          </div>

          <!-- Same as billing checkbox -->
          <div class="same-address-row">
            <Checkbox v-model="orderForm.sameAsBilling" :binary="true" inputId="sameAsBilling" />
            <label for="sameAsBilling">Indirizzo di spedizione uguale a fatturazione</label>
            <Button
              v-if="!orderForm.sameAsBilling"
              label="Copia da fatturazione"
              icon="pi pi-copy"
              class="p-button-text p-button-sm"
              @click="copyBillingToShipping"
            />
          </div>

          <!-- Shipping Address -->
          <div v-if="!orderForm.sameAsBilling" class="address-block">
            <h4><i class="pi pi-truck"></i> Indirizzo Spedizione</h4>
            <div class="form-grid">
              <div class="field">
                <label>Nome</label>
                <InputText v-model="orderForm.shippingAddress.firstName" class="w-full" />
              </div>
              <div class="field">
                <label>Cognome</label>
                <InputText v-model="orderForm.shippingAddress.lastName" class="w-full" />
              </div>
              <div class="field full-width">
                <label>Azienda</label>
                <InputText v-model="orderForm.shippingAddress.company" class="w-full" />
              </div>
              <div class="field full-width">
                <label>Indirizzo</label>
                <InputText v-model="orderForm.shippingAddress.address1" class="w-full" />
              </div>
              <div class="field full-width">
                <label>Indirizzo 2</label>
                <InputText v-model="orderForm.shippingAddress.address2" class="w-full" />
              </div>
              <div class="field">
                <label>CAP</label>
                <InputText v-model="orderForm.shippingAddress.postcode" class="w-full" />
              </div>
              <div class="field">
                <label>Città</label>
                <InputText v-model="orderForm.shippingAddress.city" class="w-full" />
              </div>
              <div class="field">
                <label>Provincia</label>
                <InputText v-model="orderForm.shippingAddress.state" class="w-full" />
              </div>
              <div class="field">
                <label>Paese</label>
                <InputText v-model="orderForm.shippingAddress.country" class="w-full" />
              </div>
              <div class="field">
                <label>Email</label>
                <InputText v-model="orderForm.shippingAddress.email" class="w-full" />
              </div>
              <div class="field">
                <label>Telefono</label>
                <InputText v-model="orderForm.shippingAddress.phone" class="w-full" />
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- TAB 4: Pagamento -->
      <TabPanel header="Pagamento">
        <div class="form-section">
          <div class="form-grid">
            <div class="field">
              <label for="paymentMethod">Metodo Pagamento</label>
              <InputText
                id="paymentMethod"
                v-model="orderForm.paymentMethod"
                placeholder="es. PayPal, Bonifico..."
                class="w-full"
              />
            </div>

            <div class="field">
              <label for="paymentMethodTitle">Descrizione Metodo</label>
              <InputText
                id="paymentMethodTitle"
                v-model="orderForm.paymentMethodTitle"
                placeholder="Titolo visualizzato"
                class="w-full"
              />
            </div>

            <template v-if="orderForm.source === 'B2B' || orderForm.customerData?.type === 'B2B'">
              <div class="field full-width">
                <Divider />
                <h4>Opzioni B2B</h4>
              </div>

              <div class="field">
                <label for="b2bPaymentMethod">Metodo Pagamento B2B</label>
                <Dropdown
                  id="b2bPaymentMethod"
                  v-model="orderForm.b2bPaymentMethod"
                  :options="b2bPaymentMethods"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Seleziona metodo"
                  class="w-full"
                  showClear
                />
              </div>

              <div class="field">
                <label for="b2bPaymentTerms">Termini Pagamento</label>
                <Dropdown
                  id="b2bPaymentTerms"
                  v-model="orderForm.b2bPaymentTerms"
                  :options="paymentTermsOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                />
              </div>

              <!-- Installment Mode Selection -->
              <div class="field full-width">
                <Divider />
                <h4>Gestione Rate</h4>
                <SelectButton
                  v-model="orderForm.installmentMode"
                  :options="installmentModes"
                  optionLabel="label"
                  optionValue="value"
                  class="installment-mode-select"
                />
              </div>

              <!-- Auto installments preview -->
              <div v-if="orderForm.installmentMode === 'auto'" class="field full-width">
                <div v-if="orderForm.customerData?.paymentPlan" class="installments-preview">
                  <h5>
                    <i class="pi pi-calendar"></i>
                    Preview Rate (Piano: {{ orderForm.customerData.paymentPlan.name }})
                  </h5>
                  <DataTable :value="previewInstallments" size="small" class="preview-table">
                    <Column field="number" header="Rata" />
                    <Column field="dueDate" header="Scadenza" />
                    <Column field="amount" header="Importo" />
                  </DataTable>
                </div>
                <Message v-else severity="warn" :closable="false">
                  <i class="pi pi-exclamation-triangle"></i>
                  Il cliente non ha un piano pagamento configurato. Verrà creata una rata unica.
                </Message>
              </div>

              <!-- Manual installments -->
              <div v-if="orderForm.installmentMode === 'manual'" class="field full-width">
                <div class="custom-installments">
                  <h5><i class="pi pi-pencil"></i> Rate Personalizzate</h5>

                  <div v-for="(inst, index) in customInstallments" :key="index" class="installment-row">
                    <div class="installment-number">Rata {{ index + 1 }}</div>
                    <Calendar
                      v-model="inst.dueDate"
                      dateFormat="dd/mm/yy"
                      showIcon
                      placeholder="Data scadenza"
                      class="installment-date"
                    />
                    <InputNumber
                      v-model="inst.amount"
                      mode="currency"
                      currency="EUR"
                      locale="it-IT"
                      placeholder="Importo"
                      class="installment-amount"
                    />
                    <Button
                      icon="pi pi-trash"
                      class="p-button-danger p-button-text"
                      @click="removeCustomInstallment(index)"
                      v-tooltip.top="'Rimuovi rata'"
                    />
                  </div>

                  <Button
                    label="Aggiungi Rata"
                    icon="pi pi-plus"
                    class="p-button-outlined mt-2"
                    @click="addCustomInstallment"
                  />

                  <!-- Total validation -->
                  <div class="installments-total" :class="{ 'error': installmentsTotalMismatch }">
                    <span>Totale rate: <strong>{{ formatCurrency(customInstallmentsTotal) }}</strong></span>
                    <span class="separator">/</span>
                    <span>Totale ordine: <strong>{{ formatCurrency(total) }}</strong></span>
                    <Tag
                      v-if="customInstallments.length > 0"
                      :severity="installmentsTotalMismatch ? 'danger' : 'success'"
                      :value="installmentsTotalMismatch ? 'Non corrisponde' : 'OK'"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </TabPanel>

      <!-- TAB 5: Note & Allegati -->
      <TabPanel header="Note & Allegati">
        <div class="form-section">
          <div class="form-grid">
            <div class="field full-width">
              <label for="notes">Note Ordine</label>
              <Textarea
                id="notes"
                v-model="orderForm.notes"
                rows="3"
                placeholder="Note generali sull'ordine..."
                class="w-full"
              />
            </div>

            <div class="field full-width">
              <label for="customerNote">Nota Cliente</label>
              <Textarea
                id="customerNote"
                v-model="orderForm.customerNote"
                rows="3"
                placeholder="Note visibili al cliente..."
                class="w-full"
              />
            </div>

            <div class="field full-width">
              <label for="internalNotes">Note Interne</label>
              <Textarea
                id="internalNotes"
                v-model="orderForm.internalNotes"
                rows="3"
                placeholder="Note interne (non visibili al cliente)..."
                class="w-full"
              />
            </div>

            <!-- Attachments Section -->
            <div class="field full-width">
              <Divider />
              <h4><i class="pi pi-paperclip"></i> Allegati</h4>

              <!-- List of attachments -->
              <div v-if="orderForm.attachments.length > 0" class="attachments-list">
                <div v-for="(att, index) in orderForm.attachments" :key="index" class="attachment-item">
                  <i :class="getAttachmentIcon(att.type)"></i>
                  <div class="attachment-info">
                    <span class="attachment-name">{{ att.name }}</span>
                    <small v-if="att.size" class="attachment-size">{{ formatFileSize(att.size) }}</small>
                    <a :href="att.url" target="_blank" class="attachment-url">
                      <i class="pi pi-external-link"></i> Apri
                    </a>
                  </div>
                  <Button
                    icon="pi pi-trash"
                    class="p-button-danger p-button-text p-button-sm"
                    @click="removeAttachment(index)"
                    v-tooltip.top="'Rimuovi allegato'"
                  />
                </div>
              </div>

              <!-- File Upload -->
              <div class="file-upload-section">
                <h5><i class="pi pi-upload"></i> Carica File</h5>
                <FileUpload
                  mode="basic"
                  name="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
                  :maxFileSize="10000000"
                  @select="onFileUpload"
                  :auto="true"
                  chooseLabel="Scegli File"
                  class="upload-button"
                  :disabled="uploadingFile"
                />
                <ProgressBar v-if="uploadingFile" mode="indeterminate" style="height: 6px; margin-top: 0.5rem;" />
                <small class="upload-hint">
                  Max 10MB. Formati: PDF, Word, Excel, immagini, CSV, TXT
                </small>
              </div>

              <Divider align="center"><span class="divider-text">oppure</span></Divider>

              <!-- Manual URL attachment -->
              <div class="manual-attachment-section">
                <h5><i class="pi pi-link"></i> Aggiungi Link</h5>
                <div class="attachment-inputs">
                  <InputText
                    v-model="newAttachment.name"
                    placeholder="Nome documento"
                    class="attachment-name-input"
                  />
                  <InputText
                    v-model="newAttachment.url"
                    placeholder="URL (es. Google Drive, Dropbox...)"
                    class="attachment-url-input"
                  />
                  <Dropdown
                    v-model="newAttachment.type"
                    :options="[
                      { label: 'Documento', value: 'document' },
                      { label: 'PDF', value: 'pdf' },
                      { label: 'Immagine', value: 'image' },
                      { label: 'Foglio calcolo', value: 'spreadsheet' },
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Tipo"
                    class="attachment-type-input"
                  />
                  <Button
                    icon="pi pi-plus"
                    class="p-button-outlined"
                    @click="addManualAttachment"
                    :disabled="!newAttachment.name || !newAttachment.url"
                    v-tooltip.top="'Aggiungi link'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>
    </TabView>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-totals">
          <span class="total-label">Totale Ordine:</span>
          <span class="total-value">{{ formatCurrency(total) }}</span>
        </div>
        <div class="footer-actions">
          <Button label="Annulla" severity="secondary" @click="visible = false" />
          <Button
            :label="isEditMode ? 'Salva Modifiche' : 'Crea Ordine'"
            icon="pi pi-check"
            :loading="saving"
            @click="saveOrder"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.order-create-dialog :deep(.p-dialog-content) {
  padding: 0;
}

.form-section {
  padding: 1.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

.field.full-width {
  grid-column: 1 / -1;
}

.w-full {
  width: 100%;
}

/* Customer option in autocomplete */
.customer-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.customer-code {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.customer-name {
  flex: 1;
}

.customer-type {
  font-size: 0.7rem;
}

/* Customer summary */
.customer-summary {
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.customer-summary h4 {
  margin: 0 0 1rem 0;
  color: var(--primary-color);
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-item .label {
  color: var(--text-color-secondary);
}

/* Product option in autocomplete */
.product-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.product-sku {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--primary-color);
  background: var(--primary-50);
  padding: 2px 6px;
  border-radius: 4px;
}

.product-name {
  flex: 1;
}

.product-price {
  font-weight: 600;
  color: var(--text-color);
}

/* Price source */
.price-source {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

/* Items table */
.items-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-50);
  font-weight: 600;
}

.items-table :deep(.p-inputnumber) {
  width: 100%;
}

/* Totals section */
.totals-section {
  max-width: 400px;
  margin-left: auto;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.totals-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.totals-row .shipping-input,
.totals-row .discount-input {
  width: 120px;
  margin-left: 0.5rem;
}

.totals-row .discount-value {
  color: var(--red-500);
}

.total-final {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--primary-color);
}

/* Addresses section */
.addresses-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.address-block {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.address-block h4 {
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
}

.same-address-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-100);
  border-radius: 6px;
}

/* Checkbox row */
.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.checkbox-row label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.checkbox-row small {
  color: var(--text-color-secondary);
}

/* Dialog footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-totals {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.total-label {
  font-weight: 500;
  color: var(--text-color-secondary);
}

.total-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-color);
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .dialog-footer {
    flex-direction: column;
    gap: 1rem;
  }
}

.mt-3 {
  margin-top: 1rem;
}

/* Search hint */
.search-hint {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

/* Price list section */
.price-list-section {
  margin-top: 1rem;
}

.price-list-section h5 {
  margin: 0.5rem 0;
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.price-list-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.price-list-current {
  margin-bottom: 0.5rem;
}

.price-list-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.price-list-tag i {
  font-size: 0.8rem;
}

.price-list-dropdown {
  max-width: 300px;
}

.pricelist-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pricelist-option small {
  color: var(--text-color-secondary);
}

/* Installment mode selection */
.installment-mode-select {
  margin-top: 0.5rem;
}

/* Installments preview */
.installments-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.installments-preview h5 {
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
}

.preview-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-100);
  padding: 0.5rem;
}

.preview-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.5rem;
}

/* Custom installments */
.custom-installments {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.custom-installments h5 {
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
}

.installment-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: var(--surface-0);
  border-radius: 6px;
  border: 1px solid var(--surface-200);
}

.installment-number {
  font-weight: 600;
  color: var(--primary-color);
  min-width: 60px;
}

.installment-date {
  flex: 1;
  max-width: 180px;
}

.installment-amount {
  flex: 1;
  max-width: 150px;
}

/* Installments total validation */
.installments-total {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--surface-100);
  border-radius: 6px;
  font-weight: 500;
}

.installments-total .separator {
  color: var(--text-color-secondary);
}

.installments-total.error {
  background: var(--red-50);
  border: 1px solid var(--red-200);
}

/* Attachments list */
.attachments-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-50);
  border-radius: 6px;
  border: 1px solid var(--surface-200);
}

.attachment-item > i {
  font-size: 1.25rem;
  color: var(--primary-color);
}

.attachment-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.attachment-name {
  font-weight: 500;
}

.attachment-url {
  font-size: 0.85rem;
  color: var(--primary-color);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  text-decoration: none;
}

.attachment-url:hover {
  text-decoration: underline;
}

/* File upload section */
.file-upload-section {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
  border: 1px dashed var(--primary-200);
}

.file-upload-section h5 {
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--primary-color);
}

.upload-button {
  width: 100%;
}

.upload-button :deep(.p-button) {
  width: 100%;
  justify-content: center;
}

.upload-hint {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

/* Manual attachment section */
.manual-attachment-section {
  padding: 1rem;
  background: var(--surface-50);
  border-radius: 8px;
}

.manual-attachment-section h5 {
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--text-color-secondary);
}

.divider-text {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  padding: 0 0.5rem;
}

.attachment-inputs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.attachment-name-input {
  flex: 1;
  min-width: 120px;
}

.attachment-url-input {
  flex: 2;
  min-width: 180px;
}

.attachment-type-input {
  width: 130px;
}

.attachment-size {
  display: block;
  color: var(--text-color-secondary);
  font-size: 0.75rem;
}

/* Address info message */
.address-info-message {
  margin-bottom: 1rem;
}

.address-info-message i {
  margin-right: 0.5rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

@media (max-width: 768px) {
  .attachment-inputs {
    flex-direction: column;
  }

  .attachment-name-input,
  .attachment-url-input,
  .attachment-type-input {
    width: 100%;
    min-width: unset;
  }

  .installment-row {
    flex-wrap: wrap;
  }

  .installment-date,
  .installment-amount {
    max-width: unset;
  }
}
</style>
