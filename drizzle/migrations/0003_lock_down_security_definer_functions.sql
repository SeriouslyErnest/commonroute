-- These SECURITY DEFINER routines are only ever called server-side (or by the
-- auth trigger). Revoke the default public EXECUTE so a browser session cannot
-- probe admin roles for arbitrary user ids.
REVOKE EXECUTE ON FUNCTION public.admin_role_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- The operator table is read exclusively through the privileged server client.
REVOKE SELECT ON public.app_admins FROM authenticated;
DROP POLICY IF EXISTS "Admins read own admin row" ON public.app_admins;