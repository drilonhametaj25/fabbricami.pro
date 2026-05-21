import { prisma } from '../config/database';
import { runWithTenantContext, TenantContext } from './tenant-context';
import logger from '../config/logger';

/**
 * Itera tutti i tenant ACTIVE ed esegue `fn` con il tenant context attivo.
 *
 * Usato dai BullMQ worker (cron globali) che processano dati di ogni tenant
 * separatamente. I worker NON ereditano AsyncLocalStorage dalla request
 * originale: devono setupare il context manualmente per ogni iterazione,
 * altrimenti il middleware Prisma `$extends` lascia passare query unfiltered.
 *
 * Errori in un tenant NON bloccano gli altri: vengono loggati e l'iterazione prosegue.
 */
export async function forEachActiveTenant(
  fn: (tenantId: string, tenantSlug: string) => Promise<void>
): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, slug: true, status: true },
  });

  for (const tenant of tenants) {
    const ctx: TenantContext = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantStatus: tenant.status,
    };
    await runWithTenantContext(ctx, async () => {
      try {
        await fn(tenant.id, tenant.slug);
      } catch (err: any) {
        logger.error(`[forEachActiveTenant] Job failed for tenant ${tenant.slug}: ${err?.message ?? err}`);
        // Non rilanciare: la failure di un tenant non deve bloccare gli altri.
      }
    });
  }
}
