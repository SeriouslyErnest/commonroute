CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kintrip_memberships m
    WHERE m.trip_id = _trip_id AND m.user_id = _user_id
  )
$$;