import Redis from 'ioredis';
import { config } from './environment';

// Redis configuration for BullMQ (requires separate connection)
export const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Redis client per cache
export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
});

redisClient.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await redisClient.quit();
  console.log('👋 Redis disconnected');
});

export default redisClient;
