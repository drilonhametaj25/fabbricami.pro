import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.middleware';

const taskRoutes: FastifyPluginAsync = async (server: any) => {
  server.get('/', { preHandler: authenticate }, async (_request: any, reply: any) => {
    return reply.send({ success: true, data: [] });
  });
};

export default taskRoutes;
