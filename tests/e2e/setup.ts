/**
 * E2E Test Setup
 * Sets up the test environment for end-to-end API testing
 */

import { vi } from 'vitest';

// Mock database
vi.mock('@server/config/database', () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn((callback: any) => callback({
      // Provide mock transaction methods
      order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      orderItem: { findMany: vi.fn(), create: vi.fn() },
      customer: { findUnique: vi.fn(), create: vi.fn() },
      product: { findUnique: vi.fn(), findMany: vi.fn() },
      inventory: { findUnique: vi.fn(), update: vi.fn() },
    })),
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
      create: vi.fn(),
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
    paymentDue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    paymentDuePayment: {
      create: vi.fn(),
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
    },
    purchaseOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    purchaseOrderItem: {
      findMany: vi.fn(),
      update: vi.fn(),
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
      update: vi.fn(),
    },
    productionOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    inventoryItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    materialInventory: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    materialMovement: {
      create: vi.fn(),
    },
    warehouse: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@server/config/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
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
