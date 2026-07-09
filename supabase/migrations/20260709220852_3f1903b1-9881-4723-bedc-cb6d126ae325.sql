
-- ========== AMENDMENTS ==========
CREATE TABLE public.amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  original_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador','recibido','asignado','en_evaluacion','en_sesion','aprobado','rechazado','pendiente')),
  reception_deadline TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  pre_review_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.amendments TO authenticated;
GRANT ALL ON public.amendments TO service_role;

ALTER TABLE public.amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester manages own amendments"
  ON public.amendments FOR ALL TO authenticated
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "CEI members read amendments"
  ON public.amendments FOR SELECT TO authenticated
  USING (public.is_cei_member(auth.uid()));

CREATE POLICY "Secretario/Presidente update amendments"
  ON public.amendments FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'secretario') OR
    public.has_role(auth.uid(),'presidente') OR
    public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'secretario') OR
    public.has_role(auth.uid(),'presidente') OR
    public.has_role(auth.uid(),'admin')
  );

CREATE TRIGGER trg_amendments_updated_at
  BEFORE UPDATE ON public.amendments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto code ENM-YYYY-NNN on submit
CREATE OR REPLACE FUNCTION public.generate_amendment_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  y TEXT;
  n INT;
BEGIN
  IF NEW.code IS NULL THEN
    y := EXTRACT(YEAR FROM now())::TEXT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'ENM-' || y || '-(\d+)') AS INT)),0)+1
      INTO n FROM public.amendments WHERE code LIKE 'ENM-'||y||'-%';
    NEW.code := 'ENM-'||y||'-'||LPAD(n::TEXT,3,'0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_amendments_code
  BEFORE INSERT ON public.amendments
  FOR EACH ROW EXECUTE FUNCTION public.generate_amendment_code();

-- ========== AUDITS ==========
CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  funding_source TEXT,
  project_start_date DATE,
  project_end_date DATE,
  status TEXT NOT NULL DEFAULT 'solicitada'
    CHECK (status IN ('solicitada','programada','asignada','en_evaluacion','en_sesion','sancionada')),
  scheduled_at TIMESTAMPTZ,
  location TEXT,
  required_documents_notes TEXT,
  scheduled_by UUID REFERENCES auth.users(id),
  audit_finding TEXT CHECK (audit_finding IN ('conforme','no_conforme','conforme_con_observaciones')),
  resolution_summary TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester manages own audits"
  ON public.audits FOR ALL TO authenticated
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "CEI members read audits"
  ON public.audits FOR SELECT TO authenticated
  USING (public.is_cei_member(auth.uid()));

CREATE POLICY "CEI managers update audits"
  ON public.audits FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'vicepresidente') OR
    public.has_role(auth.uid(),'presidente') OR
    public.has_role(auth.uid(),'secretario') OR
    public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'vicepresidente') OR
    public.has_role(auth.uid(),'presidente') OR
    public.has_role(auth.uid(),'secretario') OR
    public.has_role(auth.uid(),'admin')
  );

CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_audit_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  y TEXT;
  n INT;
BEGIN
  IF NEW.code IS NULL THEN
    y := EXTRACT(YEAR FROM now())::TEXT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'AUD-' || y || '-(\d+)') AS INT)),0)+1
      INTO n FROM public.audits WHERE code LIKE 'AUD-'||y||'-%';
    NEW.code := 'AUD-'||y||'-'||LPAD(n::TEXT,3,'0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audits_code
  BEFORE INSERT ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.generate_audit_code();

-- ========== GENERALIZE LINK TABLES ==========
ALTER TABLE public.project_documents
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN amendment_id UUID REFERENCES public.amendments(id) ON DELETE CASCADE,
  ADD COLUMN audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
  ADD CONSTRAINT project_documents_one_parent
    CHECK (num_nonnulls(project_id, amendment_id, audit_id) = 1);

ALTER TABLE public.evaluations
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN amendment_id UUID REFERENCES public.amendments(id) ON DELETE CASCADE,
  ADD COLUMN audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
  ADD COLUMN audit_finding TEXT CHECK (audit_finding IN ('conforme','no_conforme','conforme_con_observaciones')),
  ADD CONSTRAINT evaluations_one_parent
    CHECK (num_nonnulls(project_id, amendment_id, audit_id) = 1);

-- Unique reviewer_role per parent (extend to amendment/audit contexts)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_eval_amendment_role
  ON public.evaluations(amendment_id, reviewer_role) WHERE amendment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_eval_audit_role
  ON public.evaluations(audit_id, reviewer_role) WHERE audit_id IS NOT NULL;

ALTER TABLE public.session_agenda_items
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN amendment_id UUID REFERENCES public.amendments(id) ON DELETE CASCADE,
  ADD COLUMN audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
  ADD CONSTRAINT agenda_one_parent
    CHECK (num_nonnulls(project_id, amendment_id, audit_id) = 1);

ALTER TABLE public.generated_documents
  ADD COLUMN amendment_id UUID REFERENCES public.amendments(id) ON DELETE CASCADE,
  ADD COLUMN audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE;

-- Log activity on amendments and audits
CREATE TRIGGER log_activity_amendments
  AFTER INSERT OR UPDATE OR DELETE ON public.amendments
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger_fn();

CREATE TRIGGER log_activity_audits
  AFTER INSERT OR UPDATE OR DELETE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger_fn();
