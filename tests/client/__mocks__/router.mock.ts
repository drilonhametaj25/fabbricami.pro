/**
 * Vue Router Mock for Frontend Tests
 * Provides mock implementations for router and route
 */

import { vi } from 'vitest';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

// Mock route object
export const createMockRoute = (overrides: Partial<RouteLocationNormalizedLoaded> = {}): RouteLocationNormalizedLoaded => ({
  path: '/',
  name: 'Home',
  params: {},
  query: {},
  hash: '',
  fullPath: '/',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
  ...overrides,
});

// Mock router object
export const createMockRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  beforeEach: vi.fn(),
  afterEach: vi.fn(),
  onError: vi.fn(),
  isReady: vi.fn().mockResolvedValue(true),
  hasRoute: vi.fn().mockReturnValue(true),
  getRoutes: vi.fn().mockReturnValue([]),
  resolve: vi.fn().mockReturnValue({
    path: '/',
    name: 'Home',
    params: {},
    query: {},
    hash: '',
    fullPath: '/',
    matched: [],
    meta: {},
    redirectedFrom: undefined,
  }),
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
  currentRoute: {
    value: createMockRoute(),
  },
  options: {
    history: {} as any,
    routes: [],
  },
  install: vi.fn(),
  listening: true,
});

// Mock useRouter composable
export const mockUseRouter = createMockRouter();

// Mock useRoute composable
export const mockUseRoute = createMockRoute();

// Reset router mocks
export function resetRouterMocks() {
  mockUseRouter.push.mockReset();
  mockUseRouter.replace.mockReset();
  mockUseRouter.go.mockReset();
  mockUseRouter.back.mockReset();
  mockUseRouter.forward.mockReset();
  mockUseRouter.beforeEach.mockReset();
  mockUseRouter.afterEach.mockReset();
  mockUseRouter.onError.mockReset();
}

export default {
  useRouter: () => mockUseRouter,
  useRoute: () => mockUseRoute,
  createMockRoute,
  createMockRouter,
};
