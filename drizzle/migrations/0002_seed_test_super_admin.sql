-- Temporary operator identity for verification of the console during development.
INSERT INTO public.app_admins (user_id, admin_role, status)
VALUES ('5cf19e27-4b43-4095-addc-b6d1114b447f', 'super_admin', 'active')
ON CONFLICT (user_id) DO NOTHING;
