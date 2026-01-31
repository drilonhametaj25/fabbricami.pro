import { redisClient } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Set cache with expiration
 */
export async function setCache(
  key: string,
  value: any,
  expirationSeconds: number = 3600
): Promise<void> {
  try {
    await redisClient.setex(key, expirationSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', error);
  }
}

/**
 * Get cache
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}

/**
 * Delete cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
}

/**
 * Delete multiple cache keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    logger.error('Cache pattern delete error:', error);
  }
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const exists = await redisClient.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error('Cache exists error:', error);
    return false;
  }
}

/**
 * Cache decorator function
 */
export function cache(keyPrefix: string, expirationSeconds: number = 3600) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await getCache(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }

      // Execute original method
      logger.debug(`Cache miss: ${cacheKey}`);
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await setCache(cacheKey, result, expirationSeconds);

      return result;
    };

    return descriptor;
  };
}
