// Mock config
const mockConfig = {
  jwt: {
    secret: 'test-secret-key-12345',
    expiresIn: '1h',
    refreshSecret: 'test-refresh-secret-key-12345',
    refreshExpiresIn: '7d',
  },
};

jest.mock('@server/config/environment', () => ({
  config: mockConfig,
}));

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@server/config/database', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import jwt from 'jsonwebtoken';
import {
  authenticate,
  authorize,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWTPayload,
} from '@server/middleware/auth.middleware';
import { UserRole } from '@prisma/client';

// Helper functions
const createMockRequest = (headers: Record<string, string> = {}, user?: JWTPayload) => ({
  headers,
  user,
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

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============================================
  // AUTHENTICATE
  // =============================================
  describe('authenticate', () => {
    it('should return 401 when authorization header is missing', async () => {
      const request = createMockRequest({});
      const reply = createMockReply();

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      const request = createMockRequest({ authorization: 'Basic some-token' });
      const reply = createMockReply();

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    });

    it('should return 401 when token is invalid', async () => {
      const request = createMockRequest({ authorization: 'Bearer invalid-token' });
      const reply = createMockReply();

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
      });
    });

    it('should return 401 when token is expired', async () => {
      // Generate an expired token
      const expiredToken = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret,
        { expiresIn: '-1h' }
      );
      const request = createMockRequest({ authorization: `Bearer ${expiredToken}` });
      const reply = createMockReply();

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired',
      });
    });

    it('should return 401 when user is not found', async () => {
      const token = jwt.sign(
        { userId: 'nonexistent-user', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret
      );
      const request = createMockRequest({ authorization: `Bearer ${token}` });
      const reply = createMockReply();
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found or inactive',
      });
    });

    it('should return 401 when user is inactive', async () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret
      );
      const request = createMockRequest({ authorization: `Bearer ${token}` });
      const reply = createMockReply();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN',
        isActive: false,
      });

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'User not found or inactive',
      });
    });

    it('should attach user to request when token is valid', async () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret
      );
      const request = createMockRequest({ authorization: `Bearer ${token}` }) as any;
      const reply = createMockReply();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN',
        isActive: true,
        tenantId: null,
        tenant: null,
      });

      await authenticate(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.user).toEqual({
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN',
        tenantId: undefined,
        tenantSlug: undefined,
        planCode: undefined,
      });
    });

    it('should attach tenant info when user has tenant', async () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret
      );
      const request = createMockRequest({ authorization: `Bearer ${token}` }) as any;
      const reply = createMockReply();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN',
        isActive: true,
        tenantId: 'tenant-1',
        tenant: {
          slug: 'acme-corp',
          status: 'ACTIVE',
          subscription: {
            plan: { code: 'PRO' },
          },
        },
      });

      // CRITICAL: verifica che authenticate setti il tenant context via enterWith
      // così il Prisma middleware può scope-are le query automaticamente.
      // Spy approach — Jest ha quirks con propagazione ALS in test (jestjs/jest#12793).
      const { tenantContext } = await import('@server/middleware/tenant.middleware');
      const enterWithSpy = jest.spyOn(tenantContext, 'enterWith');

      try {
        await authenticate(request, reply);

        expect(request.user).toEqual({
          userId: 'user-1',
          email: 'test@test.com',
          role: 'ADMIN',
          tenantId: 'tenant-1',
          tenantSlug: 'acme-corp',
          planCode: 'PRO',
        });

        expect(enterWithSpy).toHaveBeenCalledWith({
          tenantId: 'tenant-1',
          tenantSlug: 'acme-corp',
          tenantStatus: 'ACTIVE',
        });
      } finally {
        enterWithSpy.mockRestore();
      }
    });

    it('should handle tenant without subscription', async () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret
      );
      const request = createMockRequest({ authorization: `Bearer ${token}` }) as any;
      const reply = createMockReply();
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN',
        isActive: true,
        tenantId: 'tenant-1',
        tenant: {
          slug: 'new-tenant',
          status: 'ACTIVE',
          subscription: null,
        },
      });

      await authenticate(request, reply);

      expect(request.user.planCode).toBeUndefined();
    });

    it('should return 401 on database errors during token verification', async () => {
      // Database errors during user lookup are caught and treated as auth failures
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret
      );
      const request = createMockRequest({ authorization: `Bearer ${token}` });
      const reply = createMockReply();
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await authenticate(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
      });
    });
  });

  // =============================================
  // AUTHORIZE
  // =============================================
  describe('authorize', () => {
    it('should return 401 when user is not attached to request', async () => {
      const request = createMockRequest({}) as any;
      const reply = createMockReply();
      const middleware = authorize('ADMIN' as UserRole);

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });

    it('should return 403 when user role is not allowed', async () => {
      const request = createMockRequest({}, {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'VIEWER' as UserRole,
      }) as any;
      const reply = createMockReply();
      const middleware = authorize('ADMIN' as UserRole, 'MANAGER' as UserRole);

      await middleware(request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
      });
    });

    it('should continue when user role is in allowed list', async () => {
      const request = createMockRequest({}, {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      }) as any;
      const reply = createMockReply();
      const middleware = authorize('ADMIN' as UserRole, 'MANAGER' as UserRole);

      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should allow multiple roles', async () => {
      const request = createMockRequest({}, {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'MAGAZZINIERE' as UserRole,
      }) as any;
      const reply = createMockReply();
      const middleware = authorize(
        'ADMIN' as UserRole,
        'MANAGER' as UserRole,
        'MAGAZZINIERE' as UserRole
      );

      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should work with single role authorization', async () => {
      const request = createMockRequest({}, {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'CONTABILE' as UserRole,
      }) as any;
      const reply = createMockReply();
      const middleware = authorize('CONTABILE' as UserRole);

      await middleware(request, reply);

      expect(reply.status).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // GENERATE TOKEN
  // =============================================
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token is valid
      const decoded = jwt.verify(token, mockConfig.jwt.secret) as any;
      expect(decoded.userId).toBe('user-1');
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('ADMIN');
    });

    it('should include tenant info in token when provided', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
        tenantId: 'tenant-1',
        tenantSlug: 'acme-corp',
        planCode: 'PRO',
      };

      const token = generateToken(payload);
      const decoded = jwt.verify(token, mockConfig.jwt.secret) as any;

      expect(decoded.tenantId).toBe('tenant-1');
      expect(decoded.tenantSlug).toBe('acme-corp');
      expect(decoded.planCode).toBe('PRO');
    });

    it('should set correct expiration', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      };

      const token = generateToken(payload);
      const decoded = jwt.verify(token, mockConfig.jwt.secret) as any;

      expect(decoded.exp).toBeDefined();
      // Token should expire approximately 1 hour from now (3600 seconds)
      const nowSeconds = Math.floor(Date.now() / 1000);
      expect(decoded.exp - nowSeconds).toBeLessThanOrEqual(3600);
      expect(decoded.exp - nowSeconds).toBeGreaterThan(3500);
    });
  });

  // =============================================
  // GENERATE REFRESH TOKEN
  // =============================================
  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      };

      const token = generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should use refresh secret for signing', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      };

      const token = generateRefreshToken(payload);

      // Should fail verification with regular secret
      expect(() => jwt.verify(token, mockConfig.jwt.secret)).toThrow();

      // Should succeed with refresh secret
      const decoded = jwt.verify(token, mockConfig.jwt.refreshSecret) as any;
      expect(decoded.userId).toBe('user-1');
    });

    it('should have longer expiration than access token', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      };

      const accessToken = generateToken(payload);
      const refreshToken = generateRefreshToken(payload);

      const accessDecoded = jwt.verify(accessToken, mockConfig.jwt.secret) as any;
      const refreshDecoded = jwt.verify(refreshToken, mockConfig.jwt.refreshSecret) as any;

      // Refresh token should expire later than access token
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp);
    });
  });

  // =============================================
  // VERIFY REFRESH TOKEN
  // =============================================
  describe('verifyRefreshToken', () => {
    it('should verify and decode valid refresh token', () => {
      const payload: JWTPayload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'ADMIN' as UserRole,
      };

      const token = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe('user-1');
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('ADMIN');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });

    it('should throw error for expired refresh token', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.refreshSecret,
        { expiresIn: '-1h' }
      );

      expect(() => verifyRefreshToken(expiredToken)).toThrow();
    });

    it('should throw error when using wrong secret', () => {
      // Token signed with regular secret, not refresh secret
      const wrongToken = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'ADMIN' },
        mockConfig.jwt.secret,
        { expiresIn: '1h' }
      );

      expect(() => verifyRefreshToken(wrongToken)).toThrow();
    });
  });
});
