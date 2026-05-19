/**
 * Sync all active subscription plans to Stripe.
 *
 * Creates (or updates) one Stripe Product per plan and two Stripe Prices
 * (monthly + yearly), then writes stripeProductId / stripePriceMonthlyId /
 * stripePriceYearlyId back into the SubscriptionPlan rows in the database.
 *
 * Without this, GET /subscription/plans returns plans whose Stripe IDs are
 * NULL and any attempt to create a Checkout session crashes with
 * "Piano non sincronizzato con Stripe".
 *
 * Usage:
 *   npm run stripe:sync
 *
 * Required env:
 *   STRIPE_SECRET_KEY        — the secret API key (sk_live_... or sk_test_...)
 *   DATABASE_URL             — Postgres connection string
 *
 * Idempotent: if a plan already has stripeProductId, the script updates the
 * product/prices instead of creating duplicates.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Lazy import so we can show a helpful error if STRIPE_SECRET_KEY is missing
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('\n❌  STRIPE_SECRET_KEY is not set in your environment.');
    console.error(
      '    Add it to .env (sk_live_... for production, sk_test_... for testing)'
    );
    console.error('    and re-run.\n');
    process.exit(1);
  }

  const { adminService } = await import('../src/server/services/admin.service');

  console.log('\n🔄  Syncing subscription plans to Stripe...\n');

  const plansBefore = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      code: true,
      name: true,
      priceMonthly: true,
      priceYearly: true,
      stripeProductId: true,
      stripePriceMonthlyId: true,
      stripePriceYearlyId: true,
    },
  });

  if (plansBefore.length === 0) {
    console.warn(
      '⚠️   No active plans in the database. Run "npm run prisma:seed:plans" first.\n'
    );
    process.exit(1);
  }

  console.log(
    `Found ${plansBefore.length} active plan(s) to sync:\n${plansBefore
      .map(
        (p) =>
          `  - ${p.code} (${p.name}) — ${
            p.stripeProductId ? 'will UPDATE' : 'will CREATE'
          }`
      )
      .join('\n')}\n`
  );

  const result = await adminService.syncAllPlansToStripe();

  console.log('\n📋  Results:\n');
  for (const r of result.results) {
    if (r.success) {
      console.log(`  ✓ ${r.planCode}  synced`);
    } else {
      console.log(`  ✗ ${r.planCode}  FAILED — ${r.error}`);
    }
  }

  console.log(
    `\n${result.success ? '✅' : '⚠️ '}  Synced ${result.syncedCount} / failed ${
      result.failedCount
    }\n`
  );

  // Show final state
  const plansAfter = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      code: true,
      stripeProductId: true,
      stripePriceMonthlyId: true,
      stripePriceYearlyId: true,
    },
  });

  console.log('Stripe IDs now in DB:');
  for (const p of plansAfter) {
    const status =
      p.stripeProductId && p.stripePriceMonthlyId && p.stripePriceYearlyId
        ? '✓'
        : '✗';
    console.log(
      `  ${status} ${p.code.padEnd(10)} product=${
        p.stripeProductId || 'NULL'
      } / monthly=${p.stripePriceMonthlyId || 'NULL'} / yearly=${
        p.stripePriceYearlyId || 'NULL'
      }`
    );
  }

  // Webhook reminder
  console.log('\n────────────────────────────────────────────────────────────');
  console.log('NEXT STEPS — configure the Stripe webhook in the Dashboard:');
  console.log('────────────────────────────────────────────────────────────');
  console.log(
    '  1. Stripe Dashboard → Developers → Webhooks → "Add endpoint"'
  );
  console.log(
    '  2. URL: https://<your-domain>/api/v1/shop/checkout/stripe/webhook'
  );
  console.log('  3. Events: select at minimum');
  console.log('     • checkout.session.completed');
  console.log('     • customer.subscription.created');
  console.log('     • customer.subscription.updated');
  console.log('     • customer.subscription.deleted');
  console.log('     • customer.subscription.trial_will_end');
  console.log('     • invoice.paid');
  console.log('     • invoice.payment_failed');
  console.log(
    '  4. After saving, copy the "Signing secret" (whsec_...) and put it'
  );
  console.log('     in .env as STRIPE_WEBHOOK_SECRET, then restart the server.\n');

  if (!result.success) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('\n💥  Unexpected error:\n', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
