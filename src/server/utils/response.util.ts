import { FastifyReply } from 'fastify';

/**
 * Standard API Response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    version: string;
  };
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Create success response and send via reply
 */
export function successResponse<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
  return reply.status(statusCode).send({
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
}

/**
 * Create error response and send via reply
 */
export function errorResponse(reply: FastifyReply, error: string, statusCode = 400): FastifyReply {
  return reply.status(statusCode).send({
    success: false,
    error,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
}

/**
 * Create paginated response and send via reply
 */
export function paginatedResponse<T>(
  reply: FastifyReply,
  items: T[],
  total: number,
  params: PaginationParams,
  statusCode = 200
): FastifyReply {
  const totalPages = Math.ceil(total / params.limit);

  return successResponse(reply, {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasMore: params.page < totalPages,
    },
  }, statusCode);
}

/**
 * Parse pagination from query
 * @param query - Query parameters
 * @param maxLimit - Maximum allowed limit (default 100, use higher for dropdowns)
 */
export function parsePagination(query: any, maxLimit = 100): PaginationParams {
  // Allow 'all' parameter to fetch all items (up to 10000)
  const requestedLimit = query.all === 'true' ? 10000 : parseInt(query.limit) || 20;

  return {
    page: Math.max(1, parseInt(query.page) || 1),
    limit: Math.min(maxLimit, Math.max(1, requestedLimit)),
    sortBy: query.sortBy,
    sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc',
  };
}
