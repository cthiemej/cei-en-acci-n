
-- Drop old triggers first (they depend on the function)
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
DROP TRIGGER IF EXISTS audit_evaluations ON public.evaluations;
DROP TRIGGER IF EXISTS audit_sessions ON public.sessions;
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;

-- Rename table
ALTER TABLE public.audit_log RENAME TO activity_log;

-- Rename indexes
ALTER INDEX IF EXISTS idx_audit_log_created_at RENAME TO idx_activity_log_created_at;
ALTER INDEX IF EXISTS idx_audit_log_entity RENAME TO idx_activity_log_entity;
ALTER INDEX IF EXISTS idx_audit_log_user RENAME TO idx_activity_log_user;

-- Rename policies
ALTER POLICY "Admin reads audit_log" ON public.activity_log RENAME TO "Admin reads activity_log";
ALTER POLICY "Authenticated insert audit_log" ON public.activity_log RENAME TO "Authenticated insert activity_log";

-- Drop old function and create new one with new name
DROP FUNCTION IF EXISTS public.audit_trigger_fn() CASCADE;

CREATE OR REPLACE FUNCTION public.log_activity_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_metadata jsonb;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  v_entity_type := TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_entity_id := NEW.id;
    v_metadata := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := NEW.id;
    v_metadata := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_metadata := to_jsonb(OLD);
  END IF;

  INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, v_action, v_entity_type, v_entity_id, v_metadata);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate triggers with new names
CREATE TRIGGER activity_log_projects
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger_fn();

CREATE TRIGGER activity_log_evaluations
AFTER INSERT OR UPDATE OR DELETE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger_fn();

CREATE TRIGGER activity_log_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger_fn();

CREATE TRIGGER activity_log_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger_fn();
