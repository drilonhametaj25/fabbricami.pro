/**
 * Super Admin Authentication Middleware
 * Separate authentication system for platform administrators
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { config } from '../config/environment';
import { prisma } from '../config/database';

// Types
export interface SuperAdminJWTPayload {
  superAdminId: string;
  email: string;
  isSuperAdmin: true;
}

export interface SuperAdminRequest extends FastifyRequest {
  superAdmin: SuperAdminJWTPayload;
}

// Separate JWT secret for super admin (falls back to main secret + suffix)
const SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || `${config.jwt.secret}_SUPER_ADMIN`;

/**
 * Generate JWT token for super admin
 */
export function generateSuperAdminToken(superAdmin: {
  id: string;
  email: string;
}): { accessToken: string; refreshToken: string } {
  const payload: SuperAdminJWTPayload = {
    superAdminId: superAdmin.id,
    email: superAdmin.email,
    isSuperAdmin: true,
  };

  const accessToken = jwt.sign(payload, SUPER_ADMIN_JWT_SECRET, {
    expiresIn: '4h', // Shorter expiration for security
  });

  const refreshToken = jwt.sign(payload, SUPER_ADMIN_JWT_SECRET, {
    expiresIn: '7d',
  });

  return { accessToken, refreshToken };
}

/**
 * Verify super admin JWT token
 */
export function verifySuperAdminToken(token: string): SuperAdminJWTPayload | null {
  try {
    const decoded = jwt.verify(token, SUPER_ADMIN_JWT_SECRET) as SuperAdminJWTPayload;
    if (!decoded.isSuperAdmin) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Middleware to authenticate super admin requests
 */
export async function authenticateSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, SUPER_ADMIN_JWT_SECRET) as SuperAdminJWTPayload;

      // Verify it's a super admin token
      if (!decoded.isSuperAdmin) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid super admin token',
        });
      }

      // Verify super admin still exists and is active
      const superAdmin = await prisma.superAdmin.findUnique({
        where: { id: decoded.superAdminId },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

      if (!superAdmin || !superAdmin.isActive) {
        return reply.status(401).send({
          success: false,
          error: 'Super admin not found or inactive',
        });
      }

      // Attach super admin to request
      (request as SuperAdminRequest).superAdmin = {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        isSuperAdmin: true,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return reply.status(401).send({
          success: false,
          error: 'Token expired',
        });
      }

      return reply.status(401).send({
        success: false,
        error: 'Invalid token',
      });
    }
  } catch (_error) {
    return reply.status(500).send({
      success: false,
      error: 'Authentication error',
    });
  }
}

/**
 * Log super admin action for audit trail
 */
export async function logSuperAdminAction(
  superAdminId: string,
  action: string,
  options?: {
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    await prisma.superAdminAuditLog.create({
      data: {
        superAdminId,
        action,
        entityType: options?.entityType,
        entityId: options?.entityId,
        details: options?.details ? (options.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      },
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error('Failed to log super admin action:', error);
  }
}

/**
 * Extract IP address from request
 */
export function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (request.headers['x-real-ip'] as string) ||
    request.ip ||
    'unknown'
  );
}

/**
 * Extract user agent from request
 */
export function getUserAgent(request: FastifyRequest): string {
  return (request.headers['user-agent'] as string) || 'unknown';
}
