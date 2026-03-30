
-- Create audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert audit_log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for performance
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Store only changed fields
    v_metadata := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_metadata := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_user_id, v_action, v_entity_type, v_entity_id, v_metadata);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers to main tables
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_evaluations AFTER INSERT OR UPDATE OR DELETE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- Allow admin to manage all profiles (insert for creating users)
CREATE POLICY "Admin can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admin to manage user_roles fully  
CREATE POLICY "Admin can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Secretario can read user_roles (needed for various lookups)
CREATE POLICY "Secretario reads roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente reads roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'presidente'));
