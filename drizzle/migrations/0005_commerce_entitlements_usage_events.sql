-- Commercial enablement: offers/orders, trip entitlements, usage ledger,
-- advanced jobs and privacy-safe product events (PRD P14/P15/P17).

CREATE TYPE public.order_status AS ENUM ('pending','paid','refunded','disputed','cancelled','expired');
CREATE TYPE public.entitlement_status AS ENUM ('active','expired','revoked');
CREATE TYPE public.usage_kind AS ENUM ('advanced_job','processed_page');
CREATE TYPE public.usage_state AS ENUM ('reserved','settled','released');
CREATE TYPE public.job_status AS ENUM ('reserved','succeeded','failed','outdated');

-- Trip membership is the access boundary everywhere below.
CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id text, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kintrip_memberships m
    WHERE m.trip_id = _trip_id AND m.user_id = _user_id
  )
$$;

CREATE TABLE public.commerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  trip_id text NOT NULL,
  offer_code text NOT NULL,
  price_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SGD',
  status public.order_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'none',
  provider_ref text,
  provider_event_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commerce_orders TO authenticated;
GRANT ALL ON public.commerce_orders TO service_role;
ALTER TABLE public.commerce_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchaser reads own orders" ON public.commerce_orders
  FOR SELECT TO authenticated USING (auth.uid() = purchaser_user_id);

CREATE TABLE public.trip_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL,
  offer_code text NOT NULL,
  features text[] NOT NULL DEFAULT '{}',
  order_id uuid REFERENCES public.commerce_orders(id) ON DELETE SET NULL,
  grant_id uuid REFERENCES public.entitlement_grants(id) ON DELETE SET NULL,
  purchaser_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_quota integer NOT NULL DEFAULT 20,
  page_quota integer NOT NULL DEFAULT 30,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  -- Frozen at purchase: later date changes can never revive a pass.
  ceiling_at timestamptz NOT NULL,
  status public.entitlement_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_entitlements_trip_idx ON public.trip_entitlements (trip_id);
GRANT SELECT ON public.trip_entitlements TO authenticated;
GRANT ALL ON public.trip_entitlements TO service_role;
ALTER TABLE public.trip_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip members read trip entitlements" ON public.trip_entitlements
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));

CREATE TABLE public.usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES public.trip_entitlements(id) ON DELETE CASCADE,
  trip_id text NOT NULL,
  kind public.usage_kind NOT NULL,
  amount integer NOT NULL DEFAULT 1,
  state public.usage_state NOT NULL DEFAULT 'reserved',
  idempotency_key text NOT NULL UNIQUE,
  job_id uuid,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_ledger_ent_idx ON public.usage_ledger (entitlement_id, state);
GRANT SELECT ON public.usage_ledger TO authenticated;
GRANT ALL ON public.usage_ledger TO service_role;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip members read usage" ON public.usage_ledger
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));

CREATE TABLE public.advanced_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL,
  feature text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  inputs_hash text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  entitlement_id uuid REFERENCES public.trip_entitlements(id) ON DELETE SET NULL,
  status public.job_status NOT NULL DEFAULT 'reserved',
  cost_units integer NOT NULL DEFAULT 1,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  output jsonb,
  confidence text,
  rating integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advanced_jobs_trip_idx ON public.advanced_jobs (trip_id, created_at DESC);
GRANT SELECT ON public.advanced_jobs TO authenticated;
GRANT ALL ON public.advanced_jobs TO service_role;
ALTER TABLE public.advanced_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip members read jobs" ON public.advanced_jobs
  FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));

-- Product events: pseudonymous keys only, never addresses, notes or documents.
CREATE TABLE public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  account_key text,
  trip_key text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX product_events_name_at_idx ON public.product_events (name, at DESC);
GRANT ALL ON public.product_events TO service_role;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
-- No policies: written and read server-side only (operations console).
