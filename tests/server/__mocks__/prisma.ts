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

// Helper to create Decimal-like objects for Prisma
export const createDecimal = (value: number) => ({
  toNumber: () => value,
  toString: () => value.toString(),
  toFixed: (digits: number) => value.toFixed(digits),
});

// Helper to create mock dates
export const createMockDate = (daysFromNow: number = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

// Common mock data factories
export const mockFactories = {
  paymentDue: (overrides = {}) => ({
    id: 'pd-' + Math.random().toString(36).substr(2, 9),
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

  supplier: (overrides = {}) => ({
    id: 'sup-' + Math.random().toString(36).substr(2, 9),
    code: 'SUP001',
    name: 'Test Supplier',
    email: 'supplier@test.com',
    phone: '+39123456789',
    isActive: true,
    onTimeDeliveryRate: createDecimal(95),
    qualityRating: createDecimal(90),
    avgDeliveryDays: 5,
    totalDeliveries: 100,
    lateDeliveries: 5,
    defectiveDeliveries: 2,
    defaultLeadTimeDays: 7,
    ...overrides,
  }),

  purchaseOrder: (overrides = {}) => ({
    id: 'po-' + Math.random().toString(36).substr(2, 9),
    orderNumber: 'PO-2026-001',
    supplierId: 'sup-1',
    status: 'CONFIRMED',
    total: createDecimal(5000),
    deliveryStatus: 'PENDING',
    estimatedDeliveryDate: createMockDate(14),
    createdAt: new Date(),
    ...overrides,
  }),

  order: (overrides = {}) => ({
    id: 'ord-' + Math.random().toString(36).substr(2, 9),
    orderNumber: 'ORD-2026-001',
    status: 'CONFIRMED',
    total: createDecimal(1500),
    customerId: 'cust-1',
    priority: 'NORMAL',
    createdAt: new Date(),
    ...overrides,
  }),

  productionOrder: (overrides = {}) => ({
    id: 'prod-' + Math.random().toString(36).substr(2, 9),
    orderNumber: 'PROD-2026-001',
    productId: 'product-1',
    quantity: 10,
    status: 'PENDING',
    priority: 'NORMAL',
    dueDate: createMockDate(14),
    ...overrides,
  }),

  goodsReceipt: (overrides = {}) => ({
    id: 'gr-' + Math.random().toString(36).substr(2, 9),
    receiptNumber: 'GR-2026-001',
    purchaseOrderId: 'po-1',
    warehouseId: 'wh-1',
    status: 'PENDING',
    inspectionStatus: 'NOT_REQUIRED',
    receiptDate: new Date(),
    ...overrides,
  }),

  refund: (overrides = {}) => ({
    id: 'ref-' + Math.random().toString(36).substr(2, 9),
    orderId: 'ord-1',
    amount: createDecimal(100),
    reason: 'Product damaged',
    status: 'PENDING',
    restockItems: true,
    createdAt: new Date(),
    ...overrides,
  }),

  inventoryItem: (overrides = {}) => ({
    id: 'inv-' + Math.random().toString(36).substr(2, 9),
    productId: 'product-1',
    warehouseId: 'wh-1',
    quantity: 100,
    location: 'A1',
    ...overrides,
  }),

  material: (overrides = {}) => ({
    id: 'mat-' + Math.random().toString(36).substr(2, 9),
    code: 'MAT001',
    name: 'Test Material',
    unit: 'pz',
    minStock: 10,
    reorderPoint: 20,
    ...overrides,
  }),
};

export default prismaMock;
