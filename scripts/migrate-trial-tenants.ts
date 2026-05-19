/**
 * Migrate Trial Tenants
 *
 * Backfill della rinnovata gestione billing/trial dopo l'eliminazione del
 * bottone "Configura dopo" dall'onboarding.
 *
 * Cosa fa:
 * 1. Trova tenant con `settings.billingSkipped: true` ma SENZA SaasSubscription
 *    → crea trial retroattiva (TRIALING o EXPIRED se già scaduta).
 * 2. Trova tenant con subscription TRIALING e `trialEndsAt < now`
 *    → forza transizione a EXPIRED (senza aspettare il cron job).
 * 3. Rimuove il flag legacy `billingSkipped` da tutti i tenant settings.
 * 4. Esclude esplicitamente il demo tenant (`demo-tenant-fabbricami`).
 *
 * Uso (dentro al container Docker `backend`):
 *   docker compose exec backend npx tsx scripts/migrate-trial-tenants.ts [--dry-run]
 *
 * --dry-run: mostra cosa farebbe senza scrivere nel DB.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TENANT_ID = 'demo-tenant-fabbricami';
const DEFAULT_TRIAL_DAYS = parseInt(process.env.DEFAULT_TRIAL_DAYS || '14');

interface Report {
  trialsBackfilled: string[];
  expiredTransitioned: string[];
  flagsRemoved: string[];
  errors: { tenantId: string; error: string }[];
}

async function migrate(dryRun: boolean): Promise<Report> {
  const report: Report = {
    trialsBackfilled: [],
    expiredTransitioned: [],
    flagsRemoved: [],
    errors: [],
  };

  console.log('====================================');
  console.log('  MIGRATE TRIAL TENANTS');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('====================================\n');

  // Recupera il piano default (PRO) per la trial subscription
  const defaultPlan = await prisma.subscriptionPlan.findUnique({
    where: { code: 'PRO' },
  });
  if (!defaultPlan) {
    throw new Error('Piano PRO non trovato. Esegui prima i seed dei piani.');
  }

  // === STEP 1 + 3: tenant senza subscription o con billingSkipped ===
  const tenants = await prisma.tenant.findMany({
    where: {
      id: { not: DEMO_TENANT_ID },
    },
    include: { subscription: true },
  });

  for (const tenant of tenants) {
    try {
      const settings = (tenant.settings as Record<string, unknown> | null) || {};
      const hasLegacyFlag = settings.billingSkipped === true;

      // 1. Crea trial retroattiva se mancante
      if (!tenant.subscription) {
        const now = new Date();
        const trialStartedFrom = tenant.createdAt;
        const trialEndsAt = new Date(trialStartedFrom.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const alreadyExpired = trialEndsAt < now;

        console.log(
          `  [${tenant.slug}] backfill trial subscription — startedFrom=${trialStartedFrom.toISOString()} ` +
          `trialEnds=${trialEndsAt.toISOString()} expired=${alreadyExpired}`
        );

        if (!dryRun) {
          await prisma.saasSubscription.create({
            data: {
              tenantId: tenant.id,
              planId: defaultPlan.id,
              status: alreadyExpired ? 'EXPIRED' : 'TRIALING',
              billingInterval: 'monthly',
              currentPeriodStart: trialStartedFrom,
              currentPeriodEnd: trialEndsAt,
              trialEndsAt,
              cancelAtPeriodEnd: false,
            },
          });
        }
        report.trialsBackfilled.push(tenant.slug);
      } else if (
        tenant.subscription.status === 'TRIALING' &&
        tenant.subscription.trialEndsAt &&
        tenant.subscription.trialEndsAt < new Date()
      ) {
        // 2. Forza EXPIRED per i trial scaduti
        console.log(`  [${tenant.slug}] transition TRIALING → EXPIRED (trialEnded ${tenant.subscription.trialEndsAt.toISOString()})`);
        if (!dryRun) {
          await prisma.saasSubscription.update({
            where: { tenantId: tenant.id },
            data: { status: 'EXPIRED' },
          });
        }
        report.expiredTransitioned.push(tenant.slug);
      }

      // 3. Rimuovi il flag legacy billingSkipped
      if (hasLegacyFlag) {
        const { billingSkipped: _drop, ...rest } = settings as { billingSkipped?: unknown } & Record<string, unknown>;
        console.log(`  [${tenant.slug}] cleanup settings.billingSkipped`);
        if (!dryRun) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { settings: { ...rest, billingConfigured: true } as Record<string, unknown> },
          });
        }
        report.flagsRemoved.push(tenant.slug);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [${tenant.slug}] ERROR: ${message}`);
      report.errors.push({ tenantId: tenant.id, error: message });
    }
  }

  console.log('\n====================================');
  console.log('  SUMMARY');
  console.log('====================================');
  console.log(`Trial subscriptions backfilled: ${report.trialsBackfilled.length}`);
  console.log(`Tenants transitioned to EXPIRED: ${report.expiredTransitioned.length}`);
  console.log(`Legacy billingSkipped flags removed: ${report.flagsRemoved.length}`);
  console.log(`Errors: ${report.errors.length}`);
  if (report.errors.length > 0) {
    for (const e of report.errors) {
      console.log(`  - ${e.tenantId}: ${e.error}`);
    }
  }

  return report;
}

const dryRun = process.argv.includes('--dry-run');

migrate(dryRun)
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Migration failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
