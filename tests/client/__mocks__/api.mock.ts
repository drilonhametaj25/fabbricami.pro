/**
 * API Service Mock for Frontend Tests
 * Provides mock implementations for all API methods
 */

import { vi } from 'vitest';

// Standard API response type
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Create mock response helper
export function createMockResponse<T>(data: T, success = true): ApiResponse<T> {
  return {
    success,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

// Create paginated mock response
export function createPaginatedResponse<T>(
  items: T[],
  options: { page?: number; limit?: number; total?: number } = {}
): ApiResponse<{ items: T[]; total: number }> {
  const { page = 1, limit = 20, total = items.length } = options;
  return {
    success: true,
    data: {
      items,
      total,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
}

// Create error response
export function createErrorResponse(error: string, status = 400): ApiResponse {
  return {
    success: false,
    error,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

// Mock API methods
export const apiMock = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  upload: vi.fn(),
};

// Helper to reset API mocks
export function resetApiMocks() {
  Object.values(apiMock).forEach((mock) => mock.mockReset());
}

// Helper to setup successful responses
export function mockApiSuccess(method: keyof typeof apiMock, data: any) {
  apiMock[method].mockResolvedValue(createMockResponse(data));
}

// Helper to setup paginated responses
export function mockApiPaginated<T>(method: keyof typeof apiMock, items: T[], options?: { page?: number; limit?: number; total?: number }) {
  apiMock[method].mockResolvedValue(createPaginatedResponse(items, options));
}

// Helper to setup error responses
export function mockApiError(method: keyof typeof apiMock, error: string, status = 400) {
  apiMock[method].mockResolvedValue(createErrorResponse(error, status));
}

// Helper to setup network failure
export function mockApiNetworkError(method: keyof typeof apiMock, message = 'Network error') {
  apiMock[method].mockRejectedValue(new Error(message));
}

export default apiMock;
