/**
 * Diagnostica isolamento multi-tenant.
 *
 * Cosa fa:
 * 1. Inserisce uno spy nel Prisma middleware per loggare ogni query e il tenantId iniettato.
 * 2. Lancia 3 query controllate (senza context, con context demo, con context fake)
 *    contando i prodotti restituiti.
 * 3. Stampa lo stato dei tenant/users/prodotti per verificare l'isolamento dal DB.
 *
 * Uso (dentro al container backend):
 *   docker compose -f docker-compose.prod.yml exec -T backend npx tsx scripts/diagnose-tenant-isolation.ts
 *
 * Risultato atteso se il middleware FUNZIONA:
 *   - Senza context → N prodotti totali (nessun filtro)
 *   - Con tenant demo → solo prodotti del demo
 *   - Con tenant fake → 0 prodotti
 *
 * Se il middleware NON funziona:
 *   - Tutti e tre i casi restituiscono lo stesso numero (N totali) → bug confermato.
 */

import { prisma } from '../src/server/config/database';
import { tenantContext } from '../src/server/middleware/tenant.middleware';

const DEMO_TENANT_ID = 'demo-tenant-fabbricami';

async function main() {
  console.log('\n========== DIAGNOSI ISOLAMENTO MULTI-TENANT ==========\n');

  // 1) Stato del DB
  const totalProducts = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM products
  `;
  const productsByTenant = await prisma.$queryRaw<Array<{ tenant_id: string | null; count: bigint }>>`
    SELECT tenant_id, count(*)::bigint AS count
    FROM products
    GROUP BY tenant_id
    ORDER BY count DESC
  `;
  console.log('TOTAL PRODUCTS IN DB:', Number(totalProducts[0]?.count ?? 0));
  console.log('PRODUCTS BY TENANT:');
  for (const row of productsByTenant) {
    console.log(`  tenant_id = ${row.tenant_id ?? '<NULL>'} → ${Number(row.count)} prodotti`);
  }

  const tenants = await prisma.$queryRaw<Array<{ id: string; slug: string; name: string }>>`
    SELECT id, slug, name FROM tenants ORDER BY "created_at" DESC LIMIT 10
  `;
  console.log('\nLATEST 10 TENANTS:');
  for (const t of tenants) {
    console.log(`  ${t.id}  slug=${t.slug}  name=${t.name}`);
  }

  const orphanUsers = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM users WHERE tenant_id IS NULL
  `;
  console.log(`\nORPHAN USERS (tenant_id IS NULL): ${Number(orphanUsers[0]?.count ?? 0)}`);

  // 2) Query test con differenti contesti
  console.log('\n--- TEST QUERIES VIA PRISMA (con $use middleware) ---');

  // Test A: senza context (middleware deve fare NO-OP)
  const noCtxCount = await prisma.product.count();
  console.log(`A) Senza tenantContext → prisma.product.count() = ${noCtxCount}`);

  // Test B: con context demo
  await tenantContext.run(
    { tenantId: DEMO_TENANT_ID, tenantSlug: 'demo', tenantStatus: 'ACTIVE' as any },
    async () => {
      const demoCount = await prisma.product.count();
      console.log(`B) tenantContext=demo → prisma.product.count() = ${demoCount}  (atteso: solo prodotti demo)`);
    }
  );

  // Test C: con context tenant fittizio (id che non esiste)
  await tenantContext.run(
    { tenantId: 'fake-tenant-zzz', tenantSlug: 'fake', tenantStatus: 'ACTIVE' as any },
    async () => {
      const fakeCount = await prisma.product.count();
      console.log(`C) tenantContext=fake → prisma.product.count() = ${fakeCount}  (atteso: 0)`);
    }
  );

  // Test D: con context del primo tenant non-demo trovato
  const nonDemoTenant = tenants.find((t) => t.id !== DEMO_TENANT_ID);
  if (nonDemoTenant) {
    await tenantContext.run(
      { tenantId: nonDemoTenant.id, tenantSlug: nonDemoTenant.slug, tenantStatus: 'ACTIVE' as any },
      async () => {
        const c = await prisma.product.count();
        console.log(`D) tenantContext=${nonDemoTenant.slug} → prisma.product.count() = ${c}  (atteso: solo prodotti di ${nonDemoTenant.slug})`);
      }
    );
  }

  console.log('\n--- VERDETTO ---');
  if (Number(totalProducts[0]?.count ?? 0) > 0) {
    console.log('Se i risultati di B/C/D sono tutti uguali al totale, il middleware $use NON sta filtrando.');
    console.log('Se B/C/D restituiscono numeri diversi (es. C=0), il middleware filtra correttamente.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Diagnostic script error:', err);
  prisma.$disconnect();
  process.exit(1);
});
