import { Prisma } from '@prisma/client';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@server/config/logger', () => ({
  logger: mockLogger,
}));

// Import after mocks
import { errorHandler, notFoundHandler } from '@server/middleware/error.middleware';

// Helper functions
const createMockRequest = (options: {
  url?: string;
  method?: string;
} = {}) => ({
  url: options.url || '/api/v1/test',
  method: options.method || 'GET',
});

const createMockReply = () => {
  const reply: any = {
    statusCode: 200,
    status: jest.fn().mockImplementation((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
};

// Helper to create FastifyError
const createFastifyError = (options: {
  message?: string;
  statusCode?: number;
  stack?: string;
  validation?: any;
} = {}) => {
  const error: any = new Error(options.message || 'Test error');
  if (options.statusCode) error.statusCode = options.statusCode;
  if (options.stack) error.stack = options.stack;
  if (options.validation) error.validation = options.validation;
  return error;
};

describe('Error Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  // =============================================
  // ERROR HANDLER
  // =============================================
  describe('errorHandler', () => {
    it('should handle P2002 unique constraint violation with a field-aware message', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(409);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Esiste già un record con questa email',
        details: { target: ['email'] },
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should map a P2002 on barcode to a product-specific message', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['tenant_id', 'barcode'] },
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(409);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Esiste già un prodotto con questo barcode',
        details: { target: ['tenant_id', 'barcode'] },
      });
    });

    it('should fall back to a generic message when the P2002 target is unknown', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['some_other_column'] },
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(409);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Esiste già un record con questi dati (valore duplicato)',
        details: { target: ['some_other_column'] },
      });
    });

    it('should handle P2025 record not found', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Record not found',
      });
    });

    it('should handle P2003 foreign key constraint violation', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Foreign key constraint violation',
      });
    });

    it('should handle unknown Prisma error codes', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientKnownRequestError('Unknown Prisma error', {
        code: 'P9999',
        clientVersion: '5.0.0',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
        code: 'P9999',
      });
    });

    it('should handle PrismaClientValidationError', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = new Prisma.PrismaClientValidationError('Invalid data', {
        clientVersion: '5.0.0',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid data provided',
      });
    });

    it('should handle Fastify validation errors', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = createFastifyError({
        message: 'Validation error',
        validation: [
          { dataPath: '.email', message: 'should be string' },
        ],
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: [{ dataPath: '.email', message: 'should be string' }],
      });
    });

    it('should handle generic errors with custom status code', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = createFastifyError({
        message: 'Unauthorized',
        statusCode: 401,
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Unauthorized',
      }));
    });

    it('should default to 500 status code', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = createFastifyError({
        message: 'Something went wrong',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Something went wrong',
      }));
    });

    it('should include stack trace in development mode', async () => {
      process.env.NODE_ENV = 'development';
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = createFastifyError({
        message: 'Test error',
        stack: 'Error: Test error\n    at test.ts:123',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Test error',
        stack: expect.any(String),
      }));
    });

    it('should NOT include stack trace in production mode', async () => {
      process.env.NODE_ENV = 'production';
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = createFastifyError({
        message: 'Test error',
        stack: 'Error: Test error\n    at test.ts:123',
      });

      await errorHandler(error as any, request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
      });
    });

    it('should log all errors with request context', async () => {
      const request = createMockRequest({
        url: '/api/v1/products/123',
        method: 'DELETE',
      }) as any;
      const reply = createMockReply();
      const error = createFastifyError({ message: 'Test error' });

      await errorHandler(error as any, request, reply);

      expect(mockLogger.error).toHaveBeenCalledWith('Request error:', {
        url: '/api/v1/products/123',
        method: 'DELETE',
        error: 'Test error',
        stack: expect.any(String),
      });
    });

    it('should handle error without message', async () => {
      const request = createMockRequest() as any;
      const reply = createMockReply();
      const error = { statusCode: 500, stack: 'stack' };

      await errorHandler(error as any, request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Internal server error',
      }));
    });
  });

  // =============================================
  // NOT FOUND HANDLER
  // =============================================
  describe('notFoundHandler', () => {
    it('should return 404 with path', async () => {
      const request = createMockRequest({
        url: '/api/v1/nonexistent',
      }) as any;
      const reply = createMockReply();

      await notFoundHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Route not found',
        path: '/api/v1/nonexistent',
      });
    });

    it('should include full URL path', async () => {
      const request = createMockRequest({
        url: '/api/v1/products/123/variants?include=inventory',
      }) as any;
      const reply = createMockReply();

      await notFoundHandler(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Route not found',
        path: '/api/v1/products/123/variants?include=inventory',
      });
    });

    it('should handle root path', async () => {
      const request = createMockRequest({
        url: '/',
      }) as any;
      const reply = createMockReply();

      await notFoundHandler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Route not found',
        path: '/',
      });
    });
  });
});
