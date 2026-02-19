-- Create enum if not exists (idempotent)
DO $$ BEGIN
    CREATE TYPE "SaasSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add EXPIRED value to enum if not exists
DO $$ BEGIN
    ALTER TYPE "SaasSubscriptionStatus" ADD VALUE 'EXPIRED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable (idempotent)
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_price_monthly_id" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_price_yearly_id" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "super_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "super_admin_audit_logs" (
    "id" TEXT NOT NULL,
    "super_admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "super_admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "super_admin_audit_logs_super_admin_id_idx" ON "super_admin_audit_logs"("super_admin_id");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "super_admin_audit_logs_created_at_idx" ON "super_admin_audit_logs"("created_at");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "super_admin_audit_logs" ADD CONSTRAINT "super_admin_audit_logs_super_admin_id_fkey" FOREIGN KEY ("super_admin_id") REFERENCES "super_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
