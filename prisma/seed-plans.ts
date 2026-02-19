/**
 * Production-safe script to seed/update subscription plans
 * This script uses upsert to avoid deleting existing data
 *
 * Usage:
 *   npx ts-node prisma/seed-plans.ts
 *
 * Or via npm:
 *   npm run seed:plans
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlanConfig {
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: {
    modules: string[];
    capabilities: string[];
  };
  limits: {
    maxUsers: number;
    maxWarehouses: number;
    maxProducts: number;
    maxOrders: number;
    maxSuppliers: number;
  };
  sortOrder: number;
}

const plans: PlanConfig[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'Ideale per piccole attività con gestione base di inventario e ordini',
    priceMonthly: 29.00,
    priceYearly: 290.00,
    features: {
      modules: ['inventory', 'orders', 'customers', 'basic_reports'],
      capabilities: ['wordpress_sync_basic', 'email_support'],
    },
    limits: {
      maxUsers: 3,
      maxWarehouses: 1,
      maxProducts: 1000,
      maxOrders: 500,
      maxSuppliers: 20,
    },
    sortOrder: 1,
  },
  {
    code: 'PRO',
    name: 'Professional',
    description: 'Per aziende in crescita con produzione e gestione avanzata',
    priceMonthly: 79.00,
    priceYearly: 790.00,
    features: {
      modules: [
        'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
        'manufacturing', 'hr', 'advanced_reports', 'wordpress_sync',
      ],
      capabilities: ['wordpress_sync_full', 'priority_support', 'api_readonly'],
    },
    limits: {
      maxUsers: 10,
      maxWarehouses: 3,
      maxProducts: 10000,
      maxOrders: 2000,
      maxSuppliers: 100,
    },
    sortOrder: 2,
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'Soluzione completa per aziende strutturate con tutte le funzionalità',
    priceMonthly: 149.00,
    priceYearly: 1490.00,
    features: {
      modules: [
        'inventory', 'orders', 'customers', 'suppliers', 'purchasing',
        'manufacturing', 'hr', 'accounting', 'sdi', 'advanced_reports',
        'wordpress_sync', 'api_access', 'custom_integrations',
      ],
      capabilities: [
        'wordpress_sync_full', 'sdi_integration', 'dedicated_support',
        'api_full', 'custom_reports', 'white_label',
      ],
    },
    limits: {
      maxUsers: -1, // Illimitati
      maxWarehouses: -1,
      maxProducts: -1,
      maxOrders: -1,
      maxSuppliers: -1,
    },
    sortOrder: 3,
  },
];

async function seedPlans() {
  console.log('🌱 Seeding subscription plans...\n');

  for (const plan of plans) {
    const result = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        limits: plan.limits,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        limits: plan.limits,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });

    console.log(`  ✓ ${result.code}: ${result.name} (€${result.priceMonthly}/mese)`);
  }

  console.log('\n✅ Subscription plans seeded successfully!');
  console.log('\nPlans available:');

  const allPlans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  console.log('┌──────────────┬───────────────┬──────────────┬──────────────┐');
  console.log('│ Code         │ Name          │ Monthly      │ Yearly       │');
  console.log('├──────────────┼───────────────┼──────────────┼──────────────┤');

  for (const p of allPlans) {
    const code = p.code.padEnd(12);
    const name = p.name.padEnd(13);
    const monthly = `€${Number(p.priceMonthly).toFixed(2)}`.padStart(10);
    const yearly = `€${Number(p.priceYearly).toFixed(2)}`.padStart(10);
    console.log(`│ ${code} │ ${name} │ ${monthly} │ ${yearly} │`);
  }

  console.log('└──────────────┴───────────────┴──────────────┴──────────────┘');
}

async function main() {
  try {
    await seedPlans();
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
