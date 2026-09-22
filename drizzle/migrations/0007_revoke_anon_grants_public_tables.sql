-- No RLS policy in the public schema targets the anon role; these tables are
-- reached only by authenticated users or by server-side service-role code.
-- Remove the unused anon table privileges so the Data API surface matches the
-- policy model (defense in depth).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
  END LOOP;
END;
$$;