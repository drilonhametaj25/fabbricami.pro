import { z } from 'zod';
import {
  validate,
  validateBody,
  validateQuery,
  validateParams,
} from '@server/middleware/validation.middleware';

// Helper functions
const createMockRequest = (options: {
  body?: any;
  query?: any;
  params?: any;
} = {}) => ({
  body: options.body || {},
  query: options.query || {},
  params: options.params || {},
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

describe('Validation Middleware', () => {
  // =============================================
  // VALIDATE (COMBINED SCHEMA)
  // =============================================
  describe('validate', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const querySchema = z.object({
      page: z.coerce.number().int().positive(),
      limit: z.coerce.number().int().positive().max(100),
    });

    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    it('should validate body with single schema', async () => {
      const request = createMockRequest({
        body: { name: 'Test', email: 'test@test.com' },
      }) as any;
      const reply = createMockReply();

      const middleware = validate(bodySchema);
      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.body).toEqual({ name: 'Test', email: 'test@test.com' });
    });

    it('should validate combined schema (body + query + params)', async () => {
      const request = createMockRequest({
        body: { name: 'Test', email: 'test@test.com' },
        query: { page: '1', limit: '10' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      }) as any;
      const reply = createMockReply();

      const middleware = validate({
        body: bodySchema,
        query: querySchema,
        params: paramsSchema,
      });
      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.body).toEqual({ name: 'Test', email: 'test@test.com' });
      expect(request.query).toEqual({ page: 1, limit: 10 });
      expect(request.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
    });

    it('should return 400 when body validation fails', async () => {
      const request = createMockRequest({
        body: { name: '', email: 'invalid-email' },
      }) as any;
      const reply = createMockReply();

      const middleware = validate(bodySchema);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
        ]),
      });
    });

    it('should return 400 when query validation fails in combined schema', async () => {
      const request = createMockRequest({
        body: { name: 'Test', email: 'test@test.com' },
        query: { page: 'invalid', limit: '10' },
      }) as any;
      const reply = createMockReply();

      const middleware = validate({
        body: bodySchema,
        query: querySchema,
      });
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });

    it('should return 400 when params validation fails in combined schema', async () => {
      const request = createMockRequest({
        params: { id: 'not-a-uuid' },
      }) as any;
      const reply = createMockReply();

      const middleware = validate({
        params: paramsSchema,
      });
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'id', message: expect.any(String) }),
        ]),
      });
    });

    it('should handle non-Zod errors', async () => {
      const throwingSchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      };
      const request = createMockRequest({ body: {} }) as any;
      const reply = createMockReply();

      const middleware = validate(throwingSchema as any);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
      });
    });
  });

  // =============================================
  // VALIDATE BODY
  // =============================================
  describe('validateBody', () => {
    const schema = z.object({
      title: z.string().min(1).max(100),
      description: z.string().optional(),
      quantity: z.number().int().positive(),
    });

    it('should validate and update request body', async () => {
      const request = createMockRequest({
        body: { title: 'Test Item', quantity: 5 },
      }) as any;
      const reply = createMockReply();

      const middleware = validateBody(schema);
      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.body).toEqual({ title: 'Test Item', quantity: 5 });
    });

    it('should return 400 for invalid body', async () => {
      const request = createMockRequest({
        body: { title: '', quantity: -5 },
      }) as any;
      const reply = createMockReply();

      const middleware = validateBody(schema);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array),
      });
    });

    it('should return 400 for missing required fields', async () => {
      const request = createMockRequest({
        body: { description: 'Only description' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateBody(schema);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'title' }),
          expect.objectContaining({ path: 'quantity' }),
        ]),
      });
    });

    it('should handle non-Zod errors', async () => {
      const throwingSchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      };
      const request = createMockRequest({ body: {} }) as any;
      const reply = createMockReply();

      const middleware = validateBody(throwingSchema as any);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request body',
      });
    });
  });

  // =============================================
  // VALIDATE QUERY
  // =============================================
  describe('validateQuery', () => {
    const schema = z.object({
      search: z.string().optional(),
      status: z.enum(['active', 'inactive', 'pending']).optional(),
      page: z.coerce.number().int().positive().default(1),
    });

    it('should validate and update request query', async () => {
      const request = createMockRequest({
        query: { search: 'test', status: 'active', page: '2' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateQuery(schema);
      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.query).toEqual({ search: 'test', status: 'active', page: 2 });
    });

    it('should apply default values', async () => {
      const request = createMockRequest({
        query: { search: 'test' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateQuery(schema);
      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.query.page).toBe(1);
    });

    it('should return 400 for invalid query params', async () => {
      const request = createMockRequest({
        query: { status: 'invalid_status' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateQuery(schema);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'status' }),
        ]),
      });
    });

    it('should handle non-Zod errors', async () => {
      const throwingSchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      };
      const request = createMockRequest({ query: {} }) as any;
      const reply = createMockReply();

      const middleware = validateQuery(throwingSchema as any);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid query parameters',
      });
    });
  });

  // =============================================
  // VALIDATE PARAMS
  // =============================================
  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().uuid(),
      slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    });

    it('should validate and update request params', async () => {
      const request = createMockRequest({
        params: { id: '123e4567-e89b-12d3-a456-426614174000', slug: 'test-product' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateParams(schema);
      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.params).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-product',
      });
    });

    it('should return 400 for invalid params', async () => {
      const request = createMockRequest({
        params: { id: 'not-a-uuid' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateParams(schema);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'id' }),
        ]),
      });
    });

    it('should return 400 for invalid slug format', async () => {
      const request = createMockRequest({
        params: { id: '123e4567-e89b-12d3-a456-426614174000', slug: 'Invalid Slug!' },
      }) as any;
      const reply = createMockReply();

      const middleware = validateParams(schema);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ path: 'slug' }),
        ]),
      });
    });

    it('should handle non-Zod errors', async () => {
      const throwingSchema = {
        parseAsync: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      };
      const request = createMockRequest({ params: {} }) as any;
      const reply = createMockReply();

      const middleware = validateParams(throwingSchema as any);
      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid parameters',
      });
    });
  });
});
