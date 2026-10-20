-- Add a separate owner/admin role without changing production workflow privileges.
-- PostgreSQL requires this new enum value to be committed before later migrations use it.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'system_admin';
