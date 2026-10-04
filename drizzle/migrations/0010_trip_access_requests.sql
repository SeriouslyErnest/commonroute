ALTER TABLE public.kintrip_trips ADD COLUMN IF NOT EXISTS owner_user_id uuid;

CREATE TABLE public.trip_access (
  trip_id text NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  role text NOT NULL DEFAULT 'member',
  traveller_id text,
  display_name text,
  relationship text,
  age_group text,
  email_masked text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  PRIMARY KEY (trip_id, user_id),
  CONSTRAINT trip_access_status_chk CHECK (status IN ('pending','approved','declined','removed')),
  CONSTRAINT trip_access_role_chk CHECK (role IN ('organiser','member'))
);

GRANT SELECT ON public.trip_access TO authenticated;
GRANT ALL ON public.trip_access TO service_role;
ALTER TABLE public.trip_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own trip access" ON public.trip_access FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX trip_access_trip_status_idx ON public.trip_access (trip_id, status);

UPDATE public.kintrip_trips t SET owner_user_id = m.user_id
FROM (SELECT DISTINCT ON (trip_id) trip_id, user_id FROM public.kintrip_memberships ORDER BY trip_id, updated_at ASC) m
WHERE t.trip_id = m.trip_id AND t.owner_user_id IS NULL;

INSERT INTO public.trip_access (trip_id, user_id, status, role, decided_at)
SELECT m.trip_id, m.user_id, 'approved',
  CASE WHEN t.owner_user_id = m.user_id THEN 'organiser' ELSE 'member' END, now()
FROM public.kintrip_memberships m JOIN public.kintrip_trips t ON t.trip_id = m.trip_id
ON CONFLICT DO NOTHING;