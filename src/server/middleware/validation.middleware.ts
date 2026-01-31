import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

/**
 * Schema combinato per body, query, params
 */
interface ValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Middleware validazione generico con Zod
 * Accetta schema singolo (ZodSchema) o schema combinato ({ body, query, params })
 */
export function validate(schema: ZodSchema | ValidationSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Check if it's a combined schema
      if ('body' in schema || 'query' in schema || 'params' in schema) {
        const combined = schema as ValidationSchema;
        if (combined.body) {
          request.body = await combined.body.parseAsync(request.body);
        }
        if (combined.query) {
          request.query = await combined.query.parseAsync(request.query);
        }
        if (combined.params) {
          request.params = await combined.params.parseAsync(request.params);
        }
      } else {
        // Single schema - validate body by default
        request.body = await (schema as ZodSchema).parseAsync(request.body);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      return reply.status(400).send({
        success: false,
        error: 'Validation error',
      });
    }
  };
}

/**
 * Middleware validazione body con Zod
 */
export function validateBody(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.body = await schema.parseAsync(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
      });
    }
  };
}

/**
 * Middleware validazione query params con Zod
 */
export function validateQuery(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.query = await schema.parseAsync(request.query);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
      });
    }
  };
}

/**
 * Middleware validazione params con Zod
 */
export function validateParams(schema: ZodSchema) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.params = await schema.parseAsync(request.params);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }

      return reply.status(400).send({
        success: false,
        error: 'Invalid parameters',
      });
    }
  };
}
