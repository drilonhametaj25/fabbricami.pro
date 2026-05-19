-- Add Fatture in Cloud (FIC) tracking columns to billing_history
-- These store the reference to the SaaS invoice emitted to the tenant via FIC
-- when Stripe confirms payment (webhook invoice.paid).
ALTER TABLE "billing_history"
  ADD COLUMN "fic_invoice_id" TEXT,
  ADD COLUMN "fic_invoice_number" TEXT,
  ADD COLUMN "fic_status" TEXT,
  ADD COLUMN "fic_issued_at" TIMESTAMP(3),
  ADD COLUMN "fic_error" TEXT;

CREATE INDEX "billing_history_fic_status_idx" ON "billing_history"("fic_status");
CREATE INDEX "billing_history_fic_invoice_id_idx" ON "billing_history"("fic_invoice_id");
