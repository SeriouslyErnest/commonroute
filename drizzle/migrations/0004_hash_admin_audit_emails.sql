-- Audit rows keep a one-way salted fingerprint of the operator address, never
-- the address itself. Clear the plaintext addresses recorded before this change;
-- admin_user_id still identifies the operator for display and correlation.
UPDATE public.admin_audit_log
SET admin_email = NULL
WHERE admin_email IS NOT NULL AND admin_email NOT LIKE 'sha256:%';

COMMENT ON COLUMN public.admin_audit_log.admin_email IS
  'Salted SHA-256 fingerprint of the operator email (sha256:<hex>). Never plaintext.';