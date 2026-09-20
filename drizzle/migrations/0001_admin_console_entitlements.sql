-- Admin console: operator identities, account status, entitlement grants,
-- promotions and an append-only audit trail.

CREATE TYPE public.admin_role AS ENUM ('super_admin', 'billing_admin', 'support_admin', 'read_only_admin');
CREATE TYPE public.admin_status AS ENUM ('active', 'disabled');
CREATE TYPE public.account_state AS ENUM ('active', 'suspended');
CREATE TYPE public.grant_source AS ENUM ('complimentary', 'trial', 'promotion', 'paid_subscription');
CREATE TYPE public.grant_status AS ENUM ('active', 'revoked');
CREATE TYPE public.promotion_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired', 'exhausted');
CREATE TYPE public.benefit_type AS ENUM ('free_plan_access', 'percent_discount', 'fixed_discount', 'trial_extension');

CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_role public.admin_role NOT NULL DEFAULT 'support_admin',
  status public.admin_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
GRANT SELECT ON public.app_admins TO authenticated;
GRANT ALL ON public.app_admins TO service_role;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read own admin row" ON public.app_admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.admin_role_of(_user_id uuid)
RETURNS public.admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_role FROM public.app_admins
  WHERE user_id = _user_id AND status = 'active'
$$;

CREATE TABLE public.account_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state public.account_state NOT NULL DEFAULT 'active',
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_status TO authenticated;
GRANT ALL ON public.account_status TO service_role;
ALTER TABLE public.account_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own account status" ON public.account_status
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.entitlement_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle text NOT NULL,
  source_type public.grant_source NOT NULL DEFAULT 'complimentary',
  source_id text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status public.grant_status NOT NULL DEFAULT 'active',
  granted_by uuid,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);
CREATE INDEX entitlement_grants_user_idx ON public.entitlement_grants (user_id, status);
GRANT SELECT ON public.entitlement_grants TO authenticated;
GRANT ALL ON public.entitlement_grants TO service_role;
ALTER TABLE public.entitlement_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own grants" ON public.entitlement_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  campaign_name text NOT NULL,
  benefit_type public.benefit_type NOT NULL DEFAULT 'free_plan_access',
  bundle text,
  duration_days integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  max_redemptions integer,
  per_account_limit integer NOT NULL DEFAULT 1,
  new_accounts_only boolean NOT NULL DEFAULT false,
  status public.promotion_status NOT NULL DEFAULT 'draft',
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES public.entitlement_grants(id) ON DELETE SET NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_redemptions_promo_idx ON public.promotion_redemptions (promotion_id);
GRANT SELECT ON public.promotion_redemptions TO authenticated;
GRANT ALL ON public.promotion_redemptions TO service_role;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own redemptions" ON public.promotion_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  before_json jsonb,
  after_json jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
