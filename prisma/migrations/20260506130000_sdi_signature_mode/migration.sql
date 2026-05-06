-- Aggiunge campi per la firma XAdES SDI a CompanySettings.
-- sdi_signature_mode: 'PROVIDER' (default, firma cloud-side) o 'LOCAL_PKCS12'.
-- sdi_pkcs12_path / sdi_pkcs12_password_enc: solo se LOCAL_PKCS12.

ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "sdi_signature_mode" VARCHAR(20);
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "sdi_pkcs12_path" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "sdi_pkcs12_password_enc" TEXT;
