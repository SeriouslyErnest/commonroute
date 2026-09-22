REVOKE EXECUTE ON FUNCTION public.is_trip_member(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_trip_member(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_trip_member(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_member(text, uuid) TO service_role;