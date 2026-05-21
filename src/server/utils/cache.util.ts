import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { getCurrentTenantId } from './tenant-context';

/**
 * Cache utility con namespacing automatico per tenant.
 *
 * SECURITY: ogni chiave passata a setCache/getCache è prefissata con
 * `t:{tenantId}:` ricavato dall'AsyncLocalStorage tenant context.
 * Senza context attivo → throw (fail-loud). Questo evita che due tenant
 * con stessa query/args ricevano la cache uno dell'altro.
 *
 * Per cache esplicitamente cross-tenant (es. config piattaforma, plans)
 * usare le varianti *Global* che usano prefisso `g:`.
 */

function tenantKey(key: string): string {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error(
      `[cache] setCache/getCache invocato senza tenant context. ` +
      `Key="${key}". Usa setGlobalCache/getGlobalCache per cache cross-tenant esplicite.`
    );
  }
  return `t:${tenantId}:${key}`;
}

function globalKey(key: string): string {
  return `g:${key}`;
}

// ============================================
// TENANT-SCOPED CACHE (default per business data)
// ============================================

export async function setCache(
  key: string,
  value: any,
  expirationSeconds: number = 3600
): Promise<void> {
  try {
    await redisClient.setex(tenantKey(key), expirationSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', error);
  }
}

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const data = await redisClient.get(tenantKey(key));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redisClient.del(tenantKey(key));
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    // Prefisso tenant applicato al pattern
    const keys = await redisClient.keys(tenantKey(pattern));
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    logger.error('Cache pattern delete error:', error);
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    const exists = await redisClient.exists(tenantKey(key));
    return exists === 1;
  } catch (error) {
    logger.error('Cache exists error:', error);
    return false;
  }
}

// ============================================
// GLOBAL CACHE (cross-tenant, opt-in esplicito)
// ============================================

export async function setGlobalCache(
  key: string,
  value: any,
  expirationSeconds: number = 3600
): Promise<void> {
  try {
    await redisClient.setex(globalKey(key), expirationSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Global cache set error:', error);
  }
}

export async function getGlobalCache<T = any>(key: string): Promise<T | null> {
  try {
    const data = await redisClient.get(globalKey(key));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Global cache get error:', error);
    return null;
  }
}

export async function deleteGlobalCache(key: string): Promise<void> {
  try {
    await redisClient.del(globalKey(key));
  } catch (error) {
    logger.error('Global cache delete error:', error);
  }
}

// ============================================
// CACHE DECORATOR (tenant-aware)
// ============================================

/**
 * Decoratore di metodo che cacha il risultato sotto chiave
 * `t:{tenantId}:{keyPrefix}:{argsHash}`.
 *
 * ATTENZIONE: i metodi decorati possono essere chiamati SOLO con tenant
 * context attivo. Se serve cache globale, evita il decoratore e usa
 * setGlobalCache/getGlobalCache manualmente.
 */
export function cache(keyPrefix: string, expirationSeconds: number = 3600) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const argsHash = JSON.stringify(args);
      const cacheKey = `${keyPrefix}:${argsHash}`;

      const cached = await getCache(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return cached;
      }

      logger.debug(`Cache miss: ${cacheKey}`);
      const result = await originalMethod.apply(this, args);

      await setCache(cacheKey, result, expirationSeconds);

      return result;
    };

    return descriptor;
  };
}
