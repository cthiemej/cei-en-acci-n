
-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vicepresidente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'miembro_interno_cei';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'miembro_externo_cei';
