/**
 * E2E Test Setup
 * Sets up the test environment for end-to-end API testing
 */

import { vi } from 'vitest';

// Use vi.hoisted to create the mock object that can be referenced by $transaction
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma: any = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }),
    },
    orderItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    orderNote: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    orderRefund: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }),
    },
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
    },
    productMaterial: {
      findMany: vi.fn(),
    },
    paymentDue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0, paidAmount: 0 }, _count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    paymentDuePayment: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    supplierItem: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    supplierVolumeDiscount: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    purchaseOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    goodsReceipt: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    goodsReceiptItem: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productionOrder: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    productionPhase: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inventoryItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    material: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    materialInventory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    materialMovement: {
      create: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    // SaaS models
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    tenantMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    saasSubscription: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };

  // Add $transaction that passes the same mockPrisma to the callback
  // This ensures that mocks set up in tests work inside transactions
  mockPrisma.$transaction = vi.fn(async (callback: any) => {
    return await callback(mockPrisma);
  });

  return { mockPrisma };
});

// Mock database with the hoisted mockPrisma
vi.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Mock logger (with default export for ESM compatibility)
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@server/config/logger', () => ({
  default: mockLogger,
  logger: mockLogger,
}));

// Mock redis
vi.mock('@server/config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
  },
  redisAvailable: false,
}));

// Mock queue service
vi.mock('@server/services/queue.service', () => ({
  queueService: {
    addStockAlertJob: vi.fn(),
    addOrderSyncJob: vi.fn(),
    isAvailable: () => false,
  },
}));

// Mock features
vi.mock('@server/config/features', () => ({
  initQueueSystem: vi.fn(),
  shutdownSystems: vi.fn(),
}));

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
});
