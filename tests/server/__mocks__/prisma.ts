/**
 * Prisma Mock for Unit Tests
 * Provides mock implementations for all Prisma client methods
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>() as DeepMockProxy<PrismaClient>;

// Reset all mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// ==========================================
// HELPER UTILITIES
// ==========================================

// Helper to create Decimal-like objects for Prisma
export const createDecimal = (value: number) => ({
  toNumber: () => value,
  toString: () => value.toString(),
  toFixed: (digits: number) => value.toFixed(digits),
  valueOf: () => value,
  equals: (other: any) => other?.toNumber?.() === value,
});

// Helper to create mock dates
export const createMockDate = (daysFromNow: number = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

// Helper to generate unique IDs
let idCounter = 0;
export const generateId = (prefix: string = 'id') => {
  idCounter++;
  return `${prefix}-${idCounter}-${Math.random().toString(36).substr(2, 9)}`;
};

// Reset ID counter (call in beforeEach if needed)
export const resetIdCounter = () => {
  idCounter = 0;
};

// ==========================================
// MOCK DATA FACTORIES
// ==========================================

export const mockFactories = {
  // ===== MULTI-TENANCY & SAAS =====
  tenant: (overrides = {}) => ({
    id: generateId('tenant'),
    slug: 'test-tenant',
    name: 'Test Tenant',
    domain: null,
    settings: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  tenantMember: (overrides = {}) => ({
    id: generateId('tm'),
    tenantId: 'tenant-1',
    userId: 'user-1',
    role: 'VIEWER',
    invitedAt: new Date(),
    acceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  tenantInvite: (overrides = {}) => ({
    id: generateId('invite'),
    tenantId: 'tenant-1',
    email: 'invite@test.com',
    role: 'VIEWER',
    token: generateId('token'),
    expiresAt: createMockDate(7),
    createdAt: new Date(),
    ...overrides,
  }),

  subscriptionPlan: (overrides = {}) => ({
    id: generateId('plan'),
    code: 'PRO',
    name: 'Pro Plan',
    description: 'Professional plan',
    priceMonthly: createDecimal(49.99),
    priceYearly: createDecimal(499.99),
    features: { modules: ['inventory', 'orders'] },
    limits: { maxUsers: 10, maxProducts: 1000 },
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  saasSubscription: (overrides = {}) => ({
    id: generateId('sub'),
    tenantId: 'tenant-1',
    planId: 'plan-1',
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    status: 'ACTIVE',
    billingInterval: 'monthly',
    currentPeriodStart: new Date(),
    currentPeriodEnd: createMockDate(30),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  billingHistory: (overrides = {}) => ({
    id: generateId('bill'),
    subscriptionId: 'sub-1',
    stripeInvoiceId: null,
    amount: createDecimal(49.99),
    currency: 'EUR',
    status: 'paid',
    description: 'Monthly subscription',
    invoiceUrl: null,
    invoicePdfUrl: null,
    periodStart: new Date(),
    periodEnd: createMockDate(30),
    createdAt: new Date(),
    ...overrides,
  }),

  // ===== USERS & AUTHENTICATION =====
  user: (overrides = {}) => ({
    id: generateId('user'),
    tenantId: 'tenant-1',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'VIEWER',
    isActive: true,
    lastLogin: null,
    refreshToken: null,
    emailVerified: true,
    emailVerifyToken: null,
    emailVerifyTokenExpires: null,
    resetToken: null,
    resetTokenExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  companySettings: (overrides = {}) => ({
    id: generateId('company'),
    tenantId: 'tenant-1',
    companyName: 'Test Company',
    legalName: 'Test Company S.r.l.',
    vatNumber: 'IT12345678901',
    fiscalCode: null,
    reaNumber: null,
    capitalAmount: createDecimal(10000),
    legalForm: 'S.r.l.',
    address: 'Via Test 1',
    city: 'Milano',
    province: 'MI',
    postalCode: '20100',
    country: 'IT',
    phone: '+39123456789',
    email: 'info@testcompany.com',
    pec: 'pec@testcompany.it',
    website: 'https://testcompany.com',
    sdiCode: '0000000',
    sdiPec: null,
    sdiProvider: null,
    sdiProviderApiKey: null,
    sdiProviderApiSecret: null,
    sdiProviderEndpoint: null,
    taxRegime: 'RF01',
    socialSecurityType: null,
    socialSecurityRate: null,
    withholdingTaxType: null,
    withholdingTaxRate: null,
    logoUrl: null,
    invoicePrefix: 'FV',
    invoiceNextNumber: 1,
    creditNotePrefix: 'NC',
    creditNoteNextNumber: 1,
    ddtPrefix: 'DDT',
    ddtNextNumber: 1,
    invoiceFooterNotes: null,
    paymentInstructions: null,
    bankName: null,
    iban: null,
    bic: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== WAREHOUSE & INVENTORY =====
  warehouse: (overrides = {}) => ({
    id: generateId('wh'),
    tenantId: 'tenant-1',
    code: 'WH001',
    name: 'Main Warehouse',
    description: 'Primary warehouse',
    address: { street: 'Via Test', city: 'Milano', zip: '20100', country: 'IT' },
    isActive: true,
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  inventoryItem: (overrides = {}) => ({
    id: generateId('inv'),
    productId: 'product-1',
    productVariantId: null,
    warehouseId: 'wh-1',
    location: 'WEB',
    quantity: 100,
    reservedQuantity: 0,
    lotNumber: null,
    expiryDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  inventoryMovement: (overrides = {}) => ({
    id: generateId('im'),
    productId: 'product-1',
    productVariantId: null,
    warehouseId: 'wh-1',
    fromLocation: null,
    toLocation: 'WEB',
    type: 'PURCHASE',
    quantity: 50,
    reference: 'PO-001',
    notes: null,
    performedBy: 'user-1',
    createdAt: new Date(),
    ...overrides,
  }),

  // ===== MATERIALS =====
  material: (overrides = {}) => ({
    id: generateId('mat'),
    tenantId: 'tenant-1',
    sku: 'MAT001',
    name: 'Test Material',
    description: 'Test material description',
    unit: 'pz',
    cost: createDecimal(5.00),
    minStock: 10,
    currentStock: 100,
    reorderPoint: 20,
    reorderQuantity: 50,
    leadTimeDays: 7,
    supplierId: null,
    category: 'Raw Material',
    isConsumable: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  materialInventory: (overrides = {}) => ({
    id: generateId('mi'),
    materialId: 'mat-1',
    warehouseId: 'wh-1',
    location: 'WEB',
    quantity: 100,
    reservedQuantity: 0,
    lotNumber: null,
    expiryDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  materialMovement: (overrides = {}) => ({
    id: generateId('mm'),
    materialId: 'mat-1',
    fromLocation: null,
    toLocation: 'WEB',
    type: 'PURCHASE',
    quantity: 50,
    lotNumber: null,
    reference: 'PO-001',
    notes: null,
    performedBy: 'user-1',
    createdAt: new Date(),
    ...overrides,
  }),

  materialConsumption: (overrides = {}) => ({
    id: generateId('mc'),
    productionPhaseId: 'phase-1',
    materialId: 'mat-1',
    materialMovementId: null,
    warehouseId: 'wh-1',
    quantity: 10,
    notes: null,
    consumedAt: new Date(),
    consumedBy: 'user-1',
    ...overrides,
  }),

  // ===== PRODUCTS =====
  product: (overrides = {}) => ({
    id: generateId('prod'),
    tenantId: 'tenant-1',
    sku: 'PROD001',
    name: 'Test Product',
    description: 'Test product description',
    type: 'SIMPLE',
    category: 'Electronics',
    unit: 'pz',
    barcode: null,
    cost: createDecimal(50.00),
    price: createDecimal(100.00),
    weight: createDecimal(0.5),
    dimensions: null,
    minStockLevel: 10,
    reorderQuantity: 50,
    leadTimeDays: 7,
    isActive: true,
    isSellable: true,
    minStock: 10,
    maxStock: 500,
    reorderPoint: 20,
    wordpressId: null,
    woocommerceId: null,
    syncStatus: 'NOT_SYNCED',
    lastSyncAt: null,
    taxRate: createDecimal(22),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  productVariant: (overrides = {}) => ({
    id: generateId('var'),
    productId: 'prod-1',
    sku: 'PROD001-VAR1',
    name: 'Test Variant',
    barcode: null,
    cost: createDecimal(50.00),
    price: createDecimal(100.00),
    weight: createDecimal(0.5),
    attributes: { color: 'Red', size: 'M' },
    isActive: true,
    wordpressId: null,
    woocommerceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  productCategory: (overrides = {}) => ({
    id: generateId('cat'),
    name: 'Test Category',
    slug: 'test-category',
    description: null,
    parentId: null,
    wordpressId: null,
    imageUrl: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  bomItem: (overrides = {}) => ({
    id: generateId('bom'),
    productId: 'prod-1',
    materialId: 'mat-1',
    quantity: createDecimal(2),
    unit: 'pz',
    wastagePercent: createDecimal(5),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== CUSTOMERS =====
  customer: (overrides = {}) => ({
    id: generateId('cust'),
    tenantId: 'tenant-1',
    code: 'CUST001',
    type: 'COMPANY',
    companyName: 'Test Customer Co.',
    firstName: null,
    lastName: null,
    email: 'customer@test.com',
    phone: '+39123456789',
    fiscalCode: null,
    vatNumber: 'IT12345678901',
    pec: null,
    sdiCode: '0000000',
    address: { street: 'Via Cliente', city: 'Roma', province: 'RM', zip: '00100', country: 'IT' },
    billingAddress: null,
    shippingAddress: null,
    priceListId: null,
    segment: null,
    tags: [],
    notes: null,
    isActive: true,
    paymentTerms: 30,
    creditLimit: createDecimal(10000),
    currentCredit: createDecimal(0),
    wordpressId: null,
    isB2B: false,
    isAgeVerified: false,
    dateOfBirth: null,
    loyaltyPoints: 0,
    totalOrders: 0,
    totalSpent: createDecimal(0),
    lastOrderAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== ORDERS =====
  order: (overrides = {}) => ({
    id: generateId('ord'),
    tenantId: 'tenant-1',
    orderNumber: 'ORD-2026-001',
    customerId: 'cust-1',
    status: 'CONFIRMED',
    paymentStatus: 'PENDING',
    shippingStatus: 'NOT_SHIPPED',
    subtotal: createDecimal(1000),
    discount: createDecimal(0),
    shipping: createDecimal(10),
    tax: createDecimal(220),
    total: createDecimal(1230),
    currency: 'EUR',
    source: 'ERP',
    priority: 'NORMAL',
    dueDate: createMockDate(7),
    notes: null,
    internalNotes: null,
    shippingAddress: { street: 'Via Spedizione', city: 'Milano', zip: '20100', country: 'IT' },
    billingAddress: { street: 'Via Fattura', city: 'Milano', zip: '20100', country: 'IT' },
    wordpressId: null,
    woocommerceId: null,
    couponCode: null,
    couponDiscount: createDecimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  orderItem: (overrides = {}) => ({
    id: generateId('oi'),
    orderId: 'ord-1',
    productId: 'prod-1',
    productVariantId: null,
    sku: 'PROD001',
    name: 'Test Product',
    quantity: 2,
    unitPrice: createDecimal(100),
    discount: createDecimal(0),
    tax: createDecimal(22),
    taxAmount: createDecimal(44),
    total: createDecimal(244),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== SUPPLIERS & PURCHASING =====
  supplier: (overrides = {}) => ({
    id: generateId('sup'),
    tenantId: 'tenant-1',
    code: 'SUP001',
    name: 'Test Supplier',
    companyName: 'Test Supplier S.r.l.',
    email: 'supplier@test.com',
    phone: '+39123456789',
    vatNumber: 'IT98765432101',
    fiscalCode: null,
    pec: null,
    address: { street: 'Via Fornitore', city: 'Torino', province: 'TO', zip: '10100', country: 'IT' },
    bankName: 'Test Bank',
    iban: 'IT60X0542811101000000123456',
    swift: 'UNCRITM1XXX',
    paymentTerms: 30,
    notes: null,
    isActive: true,
    onTimeDeliveryRate: createDecimal(95),
    qualityRating: createDecimal(90),
    avgDeliveryDays: 5,
    totalDeliveries: 100,
    lateDeliveries: 5,
    defectiveDeliveries: 2,
    defaultLeadTimeDays: 7,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  supplierItem: (overrides = {}) => ({
    id: generateId('si'),
    supplierId: 'sup-1',
    productId: null,
    materialId: 'mat-1',
    supplierSku: 'SUP-MAT001',
    supplierName: 'Material from Supplier',
    unitPrice: createDecimal(4.50),
    currency: 'EUR',
    minOrderQuantity: 10,
    leadTimeDays: 7,
    isPreferred: true,
    isActive: true,
    lastPurchasePrice: createDecimal(4.50),
    lastPurchaseDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  purchaseOrder: (overrides = {}) => ({
    id: generateId('po'),
    tenantId: 'tenant-1',
    orderNumber: 'PO-2026-001',
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    status: 'CONFIRMED',
    orderType: 'MATERIAL',
    subtotal: createDecimal(5000),
    discount: createDecimal(0),
    tax: createDecimal(1100),
    total: createDecimal(6100),
    currency: 'EUR',
    orderDate: new Date(),
    expectedDate: createMockDate(14),
    deliveryStatus: 'PENDING',
    receivedQuantityPercent: createDecimal(0),
    paymentTerms: 30,
    paymentStatus: 'PENDING',
    notes: null,
    internalNotes: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  purchaseOrderItem: (overrides = {}) => ({
    id: generateId('poi'),
    purchaseOrderId: 'po-1',
    productId: null,
    materialId: 'mat-1',
    sku: 'MAT001',
    name: 'Test Material',
    quantity: 100,
    receivedQuantity: 0,
    unitPrice: createDecimal(50),
    discount: createDecimal(0),
    tax: createDecimal(22),
    taxAmount: createDecimal(1100),
    total: createDecimal(6100),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  goodsReceipt: (overrides = {}) => ({
    id: generateId('gr'),
    tenantId: 'tenant-1',
    receiptNumber: 'GR-2026-001',
    purchaseOrderId: 'po-1',
    warehouseId: 'wh-1',
    status: 'PENDING',
    inspectionStatus: 'NOT_REQUIRED',
    receiptDate: new Date(),
    notes: null,
    inspectionNotes: null,
    receivedBy: 'user-1',
    inspectedBy: null,
    inspectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  goodsReceiptItem: (overrides = {}) => ({
    id: generateId('gri'),
    goodsReceiptId: 'gr-1',
    purchaseOrderItemId: 'poi-1',
    productId: null,
    materialId: 'mat-1',
    expectedQuantity: 100,
    receivedQuantity: 100,
    acceptedQuantity: 100,
    rejectedQuantity: 0,
    location: 'WEB',
    lotNumber: null,
    expiryDate: null,
    inspectionStatus: 'PASSED',
    inspectionNotes: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== INVOICES & ACCOUNTING =====
  invoice: (overrides = {}) => ({
    id: generateId('inv'),
    tenantId: 'tenant-1',
    invoiceNumber: 'FV-2026-001',
    type: 'INVOICE',
    orderId: 'ord-1',
    customerId: 'cust-1',
    issueDate: new Date(),
    dueDate: createMockDate(30),
    subtotal: createDecimal(1000),
    discount: createDecimal(0),
    taxableAmount: createDecimal(1000),
    taxAmount: createDecimal(220),
    total: createDecimal(1220),
    paidAmount: createDecimal(0),
    currency: 'EUR',
    status: 'DRAFT',
    paymentStatus: 'PENDING',
    sdiStatus: 'NOT_SENT',
    notes: null,
    termsAndConditions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  supplierInvoice: (overrides = {}) => ({
    id: generateId('sinv'),
    tenantId: 'tenant-1',
    invoiceNumber: 'SINV-001',
    supplierId: 'sup-1',
    purchaseOrderId: 'po-1',
    goodsReceiptId: 'gr-1',
    invoiceDate: new Date(),
    receivedDate: new Date(),
    dueDate: createMockDate(30),
    subtotal: createDecimal(5000),
    taxAmount: createDecimal(1100),
    total: createDecimal(6100),
    paidAmount: createDecimal(0),
    currency: 'EUR',
    status: 'PENDING',
    matchStatus: 'NOT_MATCHED',
    notes: null,
    documentUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  threeWayMatch: (overrides = {}) => ({
    id: generateId('twm'),
    tenantId: 'tenant-1',
    purchaseOrderId: 'po-1',
    goodsReceiptId: 'gr-1',
    supplierInvoiceId: 'sinv-1',
    status: 'PENDING',
    quantityMatch: true,
    priceMatch: true,
    totalMatch: true,
    quantityVariance: createDecimal(0),
    priceVariance: createDecimal(0),
    totalVariance: createDecimal(0),
    notes: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  paymentDue: (overrides = {}) => ({
    id: generateId('pd'),
    tenantId: 'tenant-1',
    type: 'RECEIVABLE',
    status: 'PENDING',
    amount: createDecimal(1000),
    paidAmount: createDecimal(0),
    dueDate: createMockDate(30),
    description: 'Test payment due',
    customerId: 'cust-1',
    supplierId: null,
    invoiceId: null,
    installmentNumber: null,
    totalInstallments: null,
    paymentMethod: null,
    bankReference: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  payment: (overrides = {}) => ({
    id: generateId('pay'),
    tenantId: 'tenant-1',
    type: 'INCOME',
    amount: createDecimal(1000),
    paymentDate: new Date(),
    paymentMethod: 'BANK_TRANSFER',
    reference: 'PAY-001',
    description: 'Payment received',
    customerId: 'cust-1',
    supplierId: null,
    invoiceId: 'inv-1',
    orderId: 'ord-1',
    bankAccount: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== EMPLOYEES & HR =====
  employee: (overrides = {}) => ({
    id: generateId('emp'),
    tenantId: 'tenant-1',
    userId: 'user-1',
    code: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@test.com',
    phone: '+39123456789',
    role: 'OPERATORE',
    department: 'Production',
    hireDate: new Date(),
    hourlyRate: createDecimal(15),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  timeEntry: (overrides = {}) => ({
    id: generateId('te'),
    employeeId: 'emp-1',
    productionPhaseId: 'phase-1',
    taskId: null,
    date: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    breakMinutes: 0,
    hoursWorked: createDecimal(8),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  task: (overrides = {}) => ({
    id: generateId('task'),
    tenantId: 'tenant-1',
    title: 'Test Task',
    description: null,
    status: 'TODO',
    priority: 'NORMAL',
    assignedToId: 'user-1',
    createdById: 'user-1',
    dueDate: createMockDate(7),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== MANUFACTURING =====
  operationType: (overrides = {}) => ({
    id: generateId('op'),
    tenantId: 'tenant-1',
    code: 'OP001',
    name: 'Assembly',
    description: 'Product assembly operation',
    defaultDuration: 60,
    laborCostPerHour: createDecimal(25),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  manufacturingPhase: (overrides = {}) => ({
    id: generateId('phase'),
    productId: 'prod-1',
    operationTypeId: 'op-1',
    sequence: 1,
    name: 'Assembly Phase',
    estimatedDuration: 60,
    instructions: null,
    isOptional: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  productionOrder: (overrides = {}) => ({
    id: generateId('prodord'),
    tenantId: 'tenant-1',
    orderNumber: 'PROD-2026-001',
    productId: 'prod-1',
    productVariantId: null,
    warehouseId: 'wh-1',
    salesOrderId: null,
    quantity: 10,
    completedQuantity: 0,
    status: 'PENDING',
    priority: 'NORMAL',
    scheduledStartDate: new Date(),
    scheduledEndDate: createMockDate(7),
    actualStartDate: null,
    actualEndDate: null,
    dueDate: createMockDate(7),
    estimatedCost: createDecimal(500),
    actualCost: createDecimal(0),
    notes: null,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  productionPhase: (overrides = {}) => ({
    id: generateId('prodphase'),
    productionOrderId: 'prodord-1',
    manufacturingPhaseId: 'phase-1',
    operationTypeId: 'op-1',
    sequence: 1,
    status: 'PENDING',
    estimatedDuration: 60,
    actualDuration: null,
    startedAt: null,
    completedAt: null,
    completedBy: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== NOTIFICATIONS & ALERTS =====
  notification: (overrides = {}) => ({
    id: generateId('notif'),
    tenantId: 'tenant-1',
    userId: 'user-1',
    type: 'INFO',
    title: 'Test Notification',
    message: 'This is a test notification',
    isRead: false,
    link: null,
    createdAt: new Date(),
    ...overrides,
  }),

  stockAlert: (overrides = {}) => ({
    id: generateId('alert'),
    tenantId: 'tenant-1',
    productId: 'prod-1',
    materialId: null,
    type: 'LOW_STOCK',
    severity: 'WARNING',
    message: 'Stock is running low',
    threshold: 10,
    currentValue: 5,
    isResolved: false,
    resolvedAt: null,
    createdAt: new Date(),
    ...overrides,
  }),

  // ===== PRICE LISTS =====
  priceList: (overrides = {}) => ({
    id: generateId('pl'),
    tenantId: 'tenant-1',
    code: 'PL001',
    name: 'Default Price List',
    description: null,
    currency: 'EUR',
    isDefault: true,
    isActive: true,
    validFrom: new Date(),
    validTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  priceListItem: (overrides = {}) => ({
    id: generateId('pli'),
    priceListId: 'pl-1',
    productId: 'prod-1',
    productVariantId: null,
    price: createDecimal(100),
    minQuantity: 1,
    discountPercent: createDecimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== DDT =====
  ddt: (overrides = {}) => ({
    id: generateId('ddt'),
    tenantId: 'tenant-1',
    ddtNumber: 'DDT-2026-001',
    orderId: 'ord-1',
    customerId: 'cust-1',
    warehouseId: 'wh-1',
    issueDate: new Date(),
    transportReason: 'VENDITA',
    carrier: 'Corriere Test',
    vehiclePlate: null,
    packages: 1,
    weight: createDecimal(1),
    notes: null,
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== SUGGESTIONS & DASHBOARD =====
  suggestion: (overrides = {}) => ({
    id: generateId('sug'),
    tenantId: 'tenant-1',
    type: 'REORDER',
    priority: 'MEDIUM',
    title: 'Reorder Material',
    description: 'Stock is running low',
    productId: null,
    materialId: 'mat-1',
    supplierId: 'sup-1',
    suggestedQuantity: 100,
    estimatedCost: createDecimal(500),
    dueDate: createMockDate(7),
    status: 'PENDING',
    actionTakenAt: null,
    actionTakenBy: null,
    dismissedAt: null,
    dismissedBy: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  dailySummary: (overrides = {}) => ({
    id: generateId('ds'),
    tenantId: 'tenant-1',
    date: new Date(),
    ordersCount: 10,
    ordersValue: createDecimal(10000),
    shipmentsCount: 8,
    productionOrdersCompleted: 5,
    inventoryMovementsCount: 20,
    lowStockAlerts: 2,
    pendingTasks: 5,
    createdAt: new Date(),
    ...overrides,
  }),

  // ===== AUDIT =====
  auditLog: (overrides = {}) => ({
    id: generateId('audit'),
    tenantId: 'tenant-1',
    userId: 'user-1',
    action: 'CREATE',
    entityType: 'Order',
    entityId: 'ord-1',
    changes: { status: { old: null, new: 'CONFIRMED' } },
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent',
    createdAt: new Date(),
    ...overrides,
  }),

  // ===== REFUNDS & RMA =====
  orderRefund: (overrides = {}) => ({
    id: generateId('ref'),
    tenantId: 'tenant-1',
    orderId: 'ord-1',
    refundNumber: 'REF-2026-001',
    amount: createDecimal(100),
    reason: 'Product damaged',
    status: 'PENDING',
    restockItems: true,
    processedBy: null,
    processedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  rma: (overrides = {}) => ({
    id: generateId('rma'),
    tenantId: 'tenant-1',
    rmaNumber: 'RMA-2026-001',
    orderId: 'ord-1',
    customerId: 'cust-1',
    status: 'PENDING',
    reason: 'Defective product',
    returnMethod: 'COURIER',
    trackingNumber: null,
    receivedAt: null,
    inspectedAt: null,
    inspectionNotes: null,
    resolution: null,
    refundId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // ===== SHOPPING & E-COMMERCE =====
  shoppingCart: (overrides = {}) => ({
    id: generateId('cart'),
    customerId: 'cust-1',
    sessionId: null,
    status: 'ACTIVE',
    subtotal: createDecimal(200),
    discount: createDecimal(0),
    total: createDecimal(200),
    couponCode: null,
    notes: null,
    expiresAt: createMockDate(7),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  cartItem: (overrides = {}) => ({
    id: generateId('ci'),
    cartId: 'cart-1',
    productId: 'prod-1',
    productVariantId: null,
    quantity: 2,
    unitPrice: createDecimal(100),
    total: createDecimal(200),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  coupon: (overrides = {}) => ({
    id: generateId('coupon'),
    tenantId: 'tenant-1',
    code: 'TEST10',
    description: '10% off',
    discountType: 'PERCENTAGE',
    discountValue: createDecimal(10),
    minOrderAmount: createDecimal(50),
    maxDiscountAmount: createDecimal(100),
    maxUsage: 100,
    usageCount: 0,
    perUserLimit: 1,
    validFrom: new Date(),
    validTo: createMockDate(30),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  loyaltyAccount: (overrides = {}) => ({
    id: generateId('loyalty'),
    customerId: 'cust-1',
    points: 100,
    tier: 'BRONZE',
    totalPointsEarned: 500,
    totalPointsRedeemed: 400,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  wishlistItem: (overrides = {}) => ({
    id: generateId('wish'),
    customerId: 'cust-1',
    productId: 'prod-1',
    productVariantId: null,
    addedAt: new Date(),
    notifyOnSale: false,
    notifyOnStock: false,
    ...overrides,
  }),

  productReview: (overrides = {}) => ({
    id: generateId('review'),
    productId: 'prod-1',
    customerId: 'cust-1',
    orderId: 'ord-1',
    rating: 5,
    title: 'Great product',
    content: 'This is an excellent product!',
    isVerifiedPurchase: true,
    isApproved: true,
    approvedAt: new Date(),
    helpfulVotes: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  newsletterSubscription: (overrides = {}) => ({
    id: generateId('news'),
    tenantId: 'tenant-1',
    email: 'subscriber@test.com',
    customerId: null,
    status: 'ACTIVE',
    subscribedAt: new Date(),
    unsubscribedAt: null,
    source: 'WEBSITE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

// ==========================================
// RELATIONSHIP HELPERS
// ==========================================

// Create a product with related inventory
export const createProductWithInventory = (productOverrides = {}, inventoryOverrides = {}) => {
  const product = mockFactories.product(productOverrides);
  const inventory = mockFactories.inventoryItem({
    productId: product.id,
    ...inventoryOverrides,
  });
  return { product, inventory };
};

// Create a supplier with items
export const createSupplierWithItems = (supplierOverrides = {}, itemCount = 3) => {
  const supplier = mockFactories.supplier(supplierOverrides);
  const items = Array.from({ length: itemCount }, (_, i) =>
    mockFactories.supplierItem({
      supplierId: supplier.id,
      supplierSku: `SUP-ITEM-${i + 1}`,
    })
  );
  return { supplier, items };
};

// Create a purchase order with items
export const createPurchaseOrderWithItems = (poOverrides = {}, itemCount = 3) => {
  const purchaseOrder = mockFactories.purchaseOrder(poOverrides);
  const items = Array.from({ length: itemCount }, (_, i) =>
    mockFactories.purchaseOrderItem({
      purchaseOrderId: purchaseOrder.id,
    })
  );
  return { purchaseOrder, items };
};

// Create an order with items
export const createOrderWithItems = (orderOverrides = {}, itemCount = 3) => {
  const order = mockFactories.order(orderOverrides);
  const items = Array.from({ length: itemCount }, (_, i) =>
    mockFactories.orderItem({
      orderId: order.id,
    })
  );
  return { order, items };
};

// Create production order with phases
export const createProductionOrderWithPhases = (orderOverrides = {}, phaseCount = 3) => {
  const productionOrder = mockFactories.productionOrder(orderOverrides);
  const phases = Array.from({ length: phaseCount }, (_, i) =>
    mockFactories.productionPhase({
      productionOrderId: productionOrder.id,
      sequence: i + 1,
    })
  );
  return { productionOrder, phases };
};

// Create goods receipt with items
export const createGoodsReceiptWithItems = (grOverrides = {}, itemCount = 3) => {
  const goodsReceipt = mockFactories.goodsReceipt(grOverrides);
  const items = Array.from({ length: itemCount }, (_, i) =>
    mockFactories.goodsReceiptItem({
      goodsReceiptId: goodsReceipt.id,
    })
  );
  return { goodsReceipt, items };
};

export default prismaMock;
