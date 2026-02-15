/**
 * Test Utilities for Frontend Tests
 * Common helper functions and utilities for Vue component and store tests
 */

import { vi, type Mock } from 'vitest';
import { mount, shallowMount, VueWrapper, type MountingOptions } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import type { Component } from 'vue';
import { apiMock, createMockResponse, createPaginatedResponse, createErrorResponse } from '../__mocks__/api.mock';
import { createMockRoute, createMockRouter } from '../__mocks__/router.mock';

// ==========================================
// COMPONENT MOUNTING HELPERS
// ==========================================

/**
 * Creates default mounting options with common plugins
 */
export function createMountOptions(options: {
  piniaOptions?: Parameters<typeof createTestingPinia>[0];
  routes?: RouteRecordRaw[];
  stubs?: Record<string, any>;
  props?: Record<string, any>;
  global?: Record<string, any>;
} = {}): MountingOptions<any> {
  const { piniaOptions = {}, routes = [], stubs = {}, props = {}, global = {} } = options;

  const router = createRouter({
    history: createWebHistory(),
    routes: routes.length > 0 ? routes : [
      { path: '/', name: 'Home', component: { template: '<div>Home</div>' } },
      { path: '/test', name: 'Test', component: { template: '<div>Test</div>' } },
    ],
  });

  return {
    props,
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          ...piniaOptions,
        }),
        router,
      ],
      stubs: {
        Teleport: true,
        Transition: false,
        // Common PrimeVue stubs
        Button: { template: '<button><slot /></button>' },
        InputText: { template: '<input />' },
        Dialog: { template: '<div class="dialog"><slot /></div>' },
        Toast: { template: '<div class="toast" />' },
        DataTable: { template: '<div class="datatable"><slot /></div>' },
        Column: { template: '<div class="column"><slot /></div>' },
        ...stubs,
      },
      ...global,
    },
  };
}

/**
 * Mounts a component with default testing setup
 */
export function mountComponent<T extends Component>(
  component: T,
  options: MountingOptions<any> = {}
): VueWrapper<any> {
  const defaultOptions = createMountOptions();
  return mount(component, {
    ...defaultOptions,
    ...options,
    global: {
      ...defaultOptions.global,
      ...options.global,
    },
  });
}

/**
 * Shallow mounts a component with default testing setup
 */
export function shallowMountComponent<T extends Component>(
  component: T,
  options: MountingOptions<any> = {}
): VueWrapper<any> {
  const defaultOptions = createMountOptions();
  return shallowMount(component, {
    ...defaultOptions,
    ...options,
    global: {
      ...defaultOptions.global,
      ...options.global,
    },
  });
}

// ==========================================
// STORE TESTING HELPERS
// ==========================================

/**
 * Creates a testing Pinia instance with mocked API
 */
export function createTestPinia(options: Parameters<typeof createTestingPinia>[0] = {}) {
  return createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    ...options,
  });
}

/**
 * Waits for store actions to complete
 */
export async function waitForStoreAction(store: any, actionName: string, timeout = 5000): Promise<void> {
  const startTime = Date.now();
  while (store.loading !== false) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for store action: ${actionName}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// ==========================================
// API MOCKING HELPERS
// ==========================================

/**
 * Sets up API mock for successful response
 */
export function mockApiCall(method: 'get' | 'post' | 'put' | 'patch' | 'delete', data: any) {
  apiMock[method].mockResolvedValue(createMockResponse(data));
  return apiMock[method];
}

/**
 * Sets up API mock for paginated response
 */
export function mockPaginatedApiCall<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  items: T[],
  options?: { page?: number; limit?: number; total?: number }
) {
  apiMock[method].mockResolvedValue(createPaginatedResponse(items, options));
  return apiMock[method];
}

/**
 * Sets up API mock for error response
 */
export function mockApiError(method: 'get' | 'post' | 'put' | 'patch' | 'delete', error: string, status = 400) {
  apiMock[method].mockResolvedValue(createErrorResponse(error, status));
  return apiMock[method];
}

/**
 * Sets up API mock for network failure
 */
export function mockNetworkError(method: 'get' | 'post' | 'put' | 'patch' | 'delete', message = 'Network error') {
  apiMock[method].mockRejectedValue(new Error(message));
  return apiMock[method];
}

// ==========================================
// ROUTER TESTING HELPERS
// ==========================================

/**
 * Creates a mock router for testing
 */
export function createTestRouter(routes: RouteRecordRaw[] = []) {
  const defaultRoutes: RouteRecordRaw[] = [
    { path: '/', name: 'Home', component: { template: '<div>Home</div>' } },
    { path: '/login', name: 'Login', component: { template: '<div>Login</div>' } },
    { path: '/dashboard', name: 'Dashboard', component: { template: '<div>Dashboard</div>' } },
    ...routes,
  ];

  return createRouter({
    history: createWebHistory(),
    routes: defaultRoutes,
  });
}

/**
 * Asserts that router.push was called with expected route
 */
export function assertRouterPush(mockRouter: any, expectedPath: string | { name?: string; path?: string; params?: any; query?: any }) {
  expect(mockRouter.push).toHaveBeenCalled();
  if (typeof expectedPath === 'string') {
    expect(mockRouter.push).toHaveBeenCalledWith(expectedPath);
  } else {
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining(expectedPath));
  }
}

// ==========================================
// DOM TESTING HELPERS
// ==========================================

/**
 * Finds element by test id
 */
export function findByTestId(wrapper: VueWrapper<any>, testId: string) {
  return wrapper.find(`[data-testid="${testId}"]`);
}

/**
 * Finds all elements by test id
 */
export function findAllByTestId(wrapper: VueWrapper<any>, testId: string) {
  return wrapper.findAll(`[data-testid="${testId}"]`);
}

/**
 * Waits for DOM updates
 */
export async function flushPromises() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Triggers form submission
 */
export async function submitForm(wrapper: VueWrapper<any>, formSelector = 'form') {
  const form = wrapper.find(formSelector);
  await form.trigger('submit.prevent');
  await flushPromises();
}

/**
 * Fills input field by name or selector
 */
export async function fillInput(wrapper: VueWrapper<any>, selector: string, value: string) {
  const input = wrapper.find(selector);
  await input.setValue(value);
}

// ==========================================
// ASSERTION HELPERS
// ==========================================

/**
 * Asserts that a component emitted an event
 */
export function assertEmitted(wrapper: VueWrapper<any>, eventName: string, expectedPayload?: any) {
  expect(wrapper.emitted(eventName)).toBeTruthy();
  if (expectedPayload !== undefined) {
    const emitted = wrapper.emitted(eventName);
    expect(emitted![0]).toEqual([expectedPayload]);
  }
}

/**
 * Asserts that a component did not emit an event
 */
export function assertNotEmitted(wrapper: VueWrapper<any>, eventName: string) {
  expect(wrapper.emitted(eventName)).toBeFalsy();
}

/**
 * Asserts element visibility
 */
export function assertVisible(wrapper: VueWrapper<any>, selector: string, visible = true) {
  const element = wrapper.find(selector);
  if (visible) {
    expect(element.exists()).toBe(true);
    expect(element.isVisible()).toBe(true);
  } else {
    expect(element.exists()).toBe(false);
  }
}

/**
 * Asserts element text content
 */
export function assertText(wrapper: VueWrapper<any>, selector: string, expectedText: string) {
  const element = wrapper.find(selector);
  expect(element.text()).toContain(expectedText);
}

// ==========================================
// MOCK DATA FACTORIES
// ==========================================

/**
 * Creates mock user data
 */
export function createMockUser(overrides: any = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'ADMIN',
    tenantId: 'tenant-1',
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock auth token data
 */
export function createMockAuthData(overrides: any = {}) {
  return {
    user: createMockUser(overrides.user),
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    ...overrides,
  };
}

/**
 * Creates mock product data
 */
export function createMockProduct(overrides: any = {}) {
  return {
    id: 'prod-1',
    sku: 'PROD001',
    name: 'Test Product',
    description: 'Test product description',
    price: 100,
    cost: 50,
    type: 'SIMPLE',
    isActive: true,
    minStock: 10,
    reorderPoint: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock order data
 */
export function createMockOrder(overrides: any = {}) {
  return {
    id: 'ord-1',
    orderNumber: 'ORD-2026-001',
    status: 'CONFIRMED',
    paymentStatus: 'PENDING',
    shippingStatus: 'NOT_SHIPPED',
    total: 1000,
    subtotal: 900,
    tax: 100,
    customerId: 'cust-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock customer data
 */
export function createMockCustomer(overrides: any = {}) {
  return {
    id: 'cust-1',
    code: 'CUST001',
    type: 'COMPANY',
    companyName: 'Test Customer Co.',
    email: 'customer@test.com',
    phone: '+39123456789',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates mock inventory item data
 */
export function createMockInventoryItem(overrides: any = {}) {
  return {
    id: 'inv-1',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    location: 'WEB',
    quantity: 100,
    reservedQuantity: 0,
    product: createMockProduct(),
    ...overrides,
  };
}

/**
 * Creates a list of mock items
 */
export function createMockList<T>(
  factory: (overrides?: any) => T,
  count: number,
  overridesFn?: (index: number) => any
): T[] {
  return Array.from({ length: count }, (_, i) =>
    factory(overridesFn ? overridesFn(i) : { id: `item-${i + 1}` })
  );
}

// ==========================================
// CLEANUP HELPERS
// ==========================================

/**
 * Resets all mocks
 */
export function resetAllMocks() {
  vi.clearAllMocks();
  Object.values(apiMock).forEach((mock: Mock) => mock.mockReset());
}

// Re-export commonly used items
export { apiMock, createMockResponse, createPaginatedResponse, createErrorResponse, createMockRoute, createMockRouter };
