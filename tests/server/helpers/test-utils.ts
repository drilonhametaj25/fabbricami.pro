/**
 * Test Utilities for Backend Tests
 * Common helper functions and utilities for unit tests
 */

import { prismaMock, mockFactories, createDecimal, createMockDate } from '../__mocks__/prisma';

// ==========================================
// REQUEST/RESPONSE MOCK HELPERS
// ==========================================

/**
 * Creates a mock Fastify request object
 */
export function createMockRequest(overrides: any = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-1',
    },
    tenantId: 'tenant-1',
    log: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    ...overrides,
  };
}

/**
 * Creates a mock Fastify reply object
 */
export function createMockReply() {
  const reply: any = {
    statusCode: 200,
    code: jest.fn().mockImplementation((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
    send: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    status: jest.fn().mockImplementation((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
  };
  return reply;
}

// ==========================================
// ASSERTION HELPERS
// ==========================================

/**
 * Asserts that a Prisma query was called with expected tenant isolation
 */
export function assertTenantIsolation(
  mockFn: jest.Mock,
  tenantId: string = 'tenant-1'
) {
  expect(mockFn).toHaveBeenCalled();
  const call = mockFn.mock.calls[0][0];
  expect(call?.where?.tenantId || call?.data?.tenantId).toBe(tenantId);
}

/**
 * Asserts that an error was thrown with specific message
 */
export async function assertThrowsError(
  fn: () => Promise<any>,
  expectedMessage: string
) {
  await expect(fn()).rejects.toThrow(expectedMessage);
}

/**
 * Asserts that a response has the expected structure
 */
export function assertApiResponse(response: any, options: {
  success?: boolean;
  hasData?: boolean;
  statusCode?: number;
} = {}) {
  const { success = true, hasData = true, statusCode } = options;

  expect(response).toHaveProperty('success', success);
  if (hasData) {
    expect(response).toHaveProperty('data');
  }
  if (statusCode !== undefined) {
    expect(response.statusCode).toBe(statusCode);
  }
}

// ==========================================
// PRISMA MOCK SETUP HELPERS
// ==========================================

/**
 * Sets up a mock for paginated queries
 */
export function setupPaginatedMock<T>(
  mockFn: jest.Mock,
  items: T[],
  total: number
) {
  mockFn.mockResolvedValue(items);
  return {
    items,
    total,
    mockFn,
  };
}

/**
 * Sets up mock to throw an error
 */
export function setupErrorMock(mockFn: jest.Mock, error: Error | string) {
  const err = typeof error === 'string' ? new Error(error) : error;
  mockFn.mockRejectedValue(err);
}

/**
 * Sets up mock for transaction
 */
export function setupTransactionMock(callback: (tx: any) => Promise<any>) {
  prismaMock.$transaction.mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(prismaMock);
    }
    return fn;
  });
}

// ==========================================
// DATA GENERATION HELPERS
// ==========================================

/**
 * Creates a list of mock items
 */
export function createMockList<T>(
  factory: (overrides?: any) => T,
  count: number,
  overridesFn?: (index: number) => any
): T[] {
  return Array.from({ length: count }, (_, i) =>
    factory(overridesFn ? overridesFn(i) : {})
  );
}

/**
 * Creates mock inventory with products
 */
export function createMockInventoryData(productCount: number = 5) {
  const products = createMockList(mockFactories.product, productCount, (i) => ({
    sku: `PROD-${i + 1}`,
    name: `Product ${i + 1}`,
  }));

  const inventoryItems = products.map((product) =>
    mockFactories.inventoryItem({
      productId: product.id,
      quantity: Math.floor(Math.random() * 100) + 1,
    })
  );

  return { products, inventoryItems };
}

/**
 * Creates mock order data with items
 */
export function createMockOrderData(itemCount: number = 3) {
  const customer = mockFactories.customer();
  const products = createMockList(mockFactories.product, itemCount);
  const order = mockFactories.order({ customerId: customer.id });
  const orderItems = products.map((product, i) =>
    mockFactories.orderItem({
      orderId: order.id,
      productId: product.id,
      quantity: i + 1,
    })
  );

  return { customer, products, order, orderItems };
}

/**
 * Creates mock purchase order data
 */
export function createMockPurchaseOrderData(itemCount: number = 3) {
  const supplier = mockFactories.supplier();
  const materials = createMockList(mockFactories.material, itemCount);
  const purchaseOrder = mockFactories.purchaseOrder({ supplierId: supplier.id });
  const purchaseOrderItems = materials.map((material) =>
    mockFactories.purchaseOrderItem({
      purchaseOrderId: purchaseOrder.id,
      materialId: material.id,
    })
  );

  return { supplier, materials, purchaseOrder, purchaseOrderItems };
}

/**
 * Creates mock production order data
 */
export function createMockProductionOrderData(phaseCount: number = 3) {
  const product = mockFactories.product();
  const operationTypes = createMockList(mockFactories.operationType, phaseCount);
  const manufacturingPhases = operationTypes.map((op, i) =>
    mockFactories.manufacturingPhase({
      productId: product.id,
      operationTypeId: op.id,
      sequence: i + 1,
    })
  );
  const productionOrder = mockFactories.productionOrder({ productId: product.id });
  const productionPhases = manufacturingPhases.map((phase, i) =>
    mockFactories.productionPhase({
      productionOrderId: productionOrder.id,
      manufacturingPhaseId: phase.id,
      operationTypeId: operationTypes[i].id,
      sequence: i + 1,
    })
  );

  return {
    product,
    operationTypes,
    manufacturingPhases,
    productionOrder,
    productionPhases,
  };
}

// ==========================================
// TIME HELPERS
// ==========================================

/**
 * Mocks the current date for time-sensitive tests
 */
export function mockCurrentDate(date: Date | string) {
  const mockDate = typeof date === 'string' ? new Date(date) : date;
  jest.useFakeTimers();
  jest.setSystemTime(mockDate);
  return () => jest.useRealTimers();
}

/**
 * Creates a date range for filtering tests
 */
export function createDateRange(daysBack: number, daysForward: number = 0) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysBack);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysForward);
  return { startDate, endDate };
}

// ==========================================
// DECIMAL HELPERS
// ==========================================

/**
 * Compares Decimal-like values
 */
export function compareDecimals(a: any, b: any): boolean {
  const numA = typeof a === 'object' && a.toNumber ? a.toNumber() : Number(a);
  const numB = typeof b === 'object' && b.toNumber ? b.toNumber() : Number(b);
  return Math.abs(numA - numB) < 0.01;
}

/**
 * Asserts Decimal equality
 */
export function assertDecimalEquals(actual: any, expected: number) {
  const actualNum = typeof actual === 'object' && actual.toNumber
    ? actual.toNumber()
    : Number(actual);
  expect(actualNum).toBeCloseTo(expected, 2);
}

// ==========================================
// CLEANUP HELPERS
// ==========================================

/**
 * Resets all mocks and setup for clean test state
 */
export function resetTestState() {
  jest.clearAllMocks();
  jest.resetModules();
}

// Re-export commonly used items
export { prismaMock, mockFactories, createDecimal, createMockDate };
