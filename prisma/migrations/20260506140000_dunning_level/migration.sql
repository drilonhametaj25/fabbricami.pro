-- Aggiunge campi dunning level a PaymentDue per escalation automatica.
-- 0 = nessun dunning, 1-5 = livelli crescenti.

ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "dunning_level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payment_dues" ADD COLUMN IF NOT EXISTS "last_dunning_sent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "payment_dues_due_date_status_idx" ON "payment_dues"("due_date", "status");
CREATE INDEX IF NOT EXISTS "payment_dues_dunning_level_idx" ON "payment_dues"("dunning_level");
