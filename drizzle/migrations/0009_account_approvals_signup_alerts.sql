CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.account_approvals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.approval_status NOT NULL DEFAULT 'pending',
  first_entered_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_approvals TO authenticated;
GRANT ALL ON public.account_approvals TO service_role;
ALTER TABLE public.account_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own approval" ON public.account_approvals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Existing accounts are grandfathered as approved and already entered.
INSERT INTO public.account_approvals (user_id, status, first_entered_at, decided_at)
SELECT id, 'approved', now(), now() FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Server-only operator settings (no client policies).
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;