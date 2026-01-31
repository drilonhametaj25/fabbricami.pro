import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../config/logger';
import { Prisma } from '@prisma/client';

/**
 * Global error handler per Fastify
 */
export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Log error
  logger.error('Request error:', {
    url: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
  });

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return reply.status(409).send({
          success: false,
          error: 'Unique constraint violation',
          details: error.meta,
        });

      case 'P2025':
        return reply.status(404).send({
          success: false,
          error: 'Record not found',
        });

      case 'P2003':
        return reply.status(400).send({
          success: false,
          error: 'Foreign key constraint violation',
        });

      default:
        return reply.status(400).send({
          success: false,
          error: 'Database error',
          code: error.code,
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return reply.status(400).send({
      success: false,
      error: 'Invalid data provided',
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: 'Validation failed',
      details: error.validation,
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  
  return reply.status(statusCode).send({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}

/**
 * Not found handler
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  return reply.status(404).send({
    success: false,
    error: 'Route not found',
    path: request.url,
  });
}
