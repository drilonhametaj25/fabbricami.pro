import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';
import { comparePassword } from '../utils/crypto.util';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { z } from 'zod';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const authRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /login
   */
  server.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Update last login and refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        refreshToken,
      },
    });

    return reply.send({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
        refreshToken,
      },
    });
  });

  /**
   * POST /refresh
   */
  server.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const payload = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive || user.refreshToken !== refreshToken) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      const newPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const token = generateToken(newPayload);

      return reply.send({
        success: true,
        data: { token },
      });
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid refresh token',
      });
    }
  });

  /**
   * POST /logout
   */
  server.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const user = (request as any).user;

    await prisma.user.update({
      where: { id: user.userId },
      data: { refreshToken: null },
    });

    return reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  /**
   * GET /me
   */
  server.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = (request as any).user;

    const userData = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employee: {
          select: {
            position: true,
            hourlyRate: true,
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: userData,
    });
  });
};

export default authRoutes;
