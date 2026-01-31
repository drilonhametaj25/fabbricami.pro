import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { shopAuthService, CustomerTokenPayload } from '../services/shop-auth.service';
import { successResponse, errorResponse } from '../utils/response.util';

// Extend FastifyRequest to include customer
declare module 'fastify' {
  interface FastifyRequest {
    customer?: CustomerTokenPayload;
  }
}

// Auth middleware for shop customers
async function customerAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(reply, 'Authentication token required', 401);
    }

    const token = authHeader.substring(7);
    const payload = shopAuthService.verifyToken(token);

    if (payload.type !== 'customer') {
      return errorResponse(reply, 'Invalid token', 401);
    }

    request.customer = payload;
  } catch (error: any) {
    return errorResponse(reply, error.message || 'Invalid token', 401);
  }
}

const shopAuthRoutes: FastifyPluginAsync = async (fastify) => {
  // Register a new customer
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string;
        newsletter?: boolean;
      };

      // Validate required fields
      if (!body.email || !body.password || !body.firstName || !body.lastName) {
        return errorResponse(reply, 'Required fields missing', 400);
      }

      // Validate password strength
      if (body.password.length < 8) {
        return errorResponse(reply, 'Password must be at least 8 characters', 400);
      }

      const result = await shopAuthService.register(body);

      return successResponse(reply, result, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Login customer
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { email: string; password: string };

      if (!body.email || !body.password) {
        return errorResponse(reply, 'Email and password required', 400);
      }

      const result = await shopAuthService.login(body);

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 401);
    }
  });

  // Get current customer profile
  fastify.get('/me', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const customer = await shopAuthService.getCustomer(request.customer!.id);

      if (!customer) {
        return errorResponse(reply, 'Customer not found', 404);
      }

      return successResponse(reply, customer);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Update customer profile
  fastify.patch('/profile', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        dateOfBirth?: string;
      };

      const customer = await shopAuthService.updateProfile(request.customer!.id, {
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      });

      return successResponse(reply, customer);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Change password
  fastify.post('/change-password', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { currentPassword: string; newPassword: string };

      if (!body.currentPassword || !body.newPassword) {
        return errorResponse(reply, 'Both passwords are required', 400);
      }

      if (body.newPassword.length < 8) {
        return errorResponse(reply, 'New password must be at least 8 characters', 400);
      }

      await shopAuthService.changePassword(request.customer!.id, body);

      return successResponse(reply, { success: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Request password reset
  fastify.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { email: string };

      if (!body.email) {
        return errorResponse(reply, 'Email required', 400);
      }

      await shopAuthService.requestPasswordReset(body.email);

      // Always return success to not reveal if email exists
      return successResponse(reply, { sent: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Reset password with token
  fastify.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { token: string; password: string };

      if (!body.token || !body.password) {
        return errorResponse(reply, 'Token and password required', 400);
      }

      if (body.password.length < 8) {
        return errorResponse(reply, 'Password must be at least 8 characters', 400);
      }

      await shopAuthService.resetPassword(body);

      return successResponse(reply, { success: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Verify email with token
  fastify.post('/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { token: string };

      if (!body.token) {
        return errorResponse(reply, 'Verification token is required', 400);
      }

      const result = await shopAuthService.verifyEmail(body.token);

      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Resend verification email
  fastify.post('/resend-verification', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { email: string };

      if (!body.email) {
        return errorResponse(reply, 'Email is required', 400);
      }

      await shopAuthService.resendVerificationEmail(body.email);

      // Always return success to not reveal if email exists
      return successResponse(reply, { sent: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get customer addresses
  fastify.get('/addresses', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const addresses = await shopAuthService.getAddresses(request.customer!.id);
      return successResponse(reply, addresses);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Add customer address
  fastify.post('/addresses', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        firstName: string;
        lastName: string;
        company?: string;
        address: string;
        addressLine2?: string;
        city: string;
        state?: string;
        postalCode: string;
        country: string;
        phone?: string;
        isDefault?: boolean;
      };

      // Validate required fields
      if (!body.firstName || !body.lastName || !body.address || !body.city || !body.postalCode || !body.country) {
        return errorResponse(reply, 'Required fields missing', 400);
      }

      const address = await shopAuthService.addAddress(request.customer!.id, body);
      return successResponse(reply, address, 201);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Update customer address
  fastify.patch('/addresses/:addressId', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { addressId } = request.params as { addressId: string };
      const body = request.body as {
        firstName?: string;
        lastName?: string;
        company?: string;
        address?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        phone?: string;
        isDefault?: boolean;
      };

      const address = await shopAuthService.updateAddress(request.customer!.id, addressId, body);
      return successResponse(reply, address);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Delete customer address
  fastify.delete('/addresses/:addressId', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { addressId } = request.params as { addressId: string };
      await shopAuthService.deleteAddress(request.customer!.id, addressId);
      return successResponse(reply, { deleted: true });
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get customer orders
  fastify.get('/orders', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { page?: string; limit?: string };
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      const result = await shopAuthService.getOrders(request.customer!.id, page, limit);
      return successResponse(reply, result);
    } catch (error: any) {
      return errorResponse(reply, error.message, 400);
    }
  });

  // Get single order
  fastify.get('/orders/:orderId', {
    preHandler: customerAuthMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const order = await shopAuthService.getOrder(request.customer!.id, orderId);
      return successResponse(reply, order);
    } catch (error: any) {
      return errorResponse(reply, error.message, 404);
    }
  });
};

export default shopAuthRoutes;
