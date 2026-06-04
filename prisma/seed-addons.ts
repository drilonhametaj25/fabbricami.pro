/**
 * Seed del catalogo add-on (idempotente, via upsert su `code`).
 *   npx tsx prisma/seed-addons.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const addons = [
  {
    code: 'EXTRA_USERS_5',
    name: '+5 Utenti',
    description: 'Aggiunge 5 postazioni utente al tuo piano.',
    type: 'RESOURCE_LIMIT',
    resource: 'users',
    increment: 5,
    priceMonthly: 15.0,
    priceYearly: 150.0,
    sortOrder: 1,
  },
  {
    code: 'EXTRA_WAREHOUSE',
    name: '+1 Magazzino',
    description: 'Aggiunge un magazzino aggiuntivo.',
    type: 'RESOURCE_LIMIT',
    resource: 'warehouses',
    increment: 1,
    priceMonthly: 10.0,
    priceYearly: 100.0,
    sortOrder: 2,
  },
  {
    code: 'EXTRA_PRODUCTS_5K',
    name: '+5.000 Prodotti',
    description: 'Aumenta di 5.000 il numero massimo di prodotti gestibili.',
    type: 'RESOURCE_LIMIT',
    resource: 'products',
    increment: 5000,
    priceMonthly: 12.0,
    priceYearly: 120.0,
    sortOrder: 3,
  },
  {
    code: 'EXTRA_SUPPLIERS_50',
    name: '+50 Fornitori',
    description: 'Aumenta di 50 il numero massimo di fornitori.',
    type: 'RESOURCE_LIMIT',
    resource: 'suppliers',
    increment: 50,
    priceMonthly: 8.0,
    priceYearly: 80.0,
    sortOrder: 4,
  },
  {
    code: 'API_ACCESS',
    name: 'Accesso API',
    description: 'Sblocca l\'accesso completo alle API REST.',
    type: 'FEATURE',
    featureKey: 'api_access',
    priceMonthly: 29.0,
    priceYearly: 290.0,
    sortOrder: 5,
  },
  {
    code: 'SDI_INTEGRATION',
    name: 'Fatturazione Elettronica (SDI)',
    description: 'Abilita l\'integrazione con il Sistema di Interscambio.',
    type: 'FEATURE',
    featureKey: 'sdi_integration',
    priceMonthly: 19.0,
    priceYearly: 190.0,
    sortOrder: 6,
  },
];

async function main() {
  console.log('🌱 Seeding addon catalog...');
  for (const a of addons) {
    await prisma.addonCatalog.upsert({
      where: { code: a.code },
      update: { ...a, isActive: true },
      create: { ...a, isActive: true },
    });
    console.log(`  ✓ ${a.code}: ${a.name}`);
  }
  console.log('✅ Addon catalog seeded.');
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
