
ALTER TABLE public.evaluations
  ADD COLUMN reviewer_role text NOT NULL DEFAULT 'primario'
  CHECK (reviewer_role IN ('primario', 'secundario'));

-- Backfill: mark the 2nd (by created_at) evaluation of each project as 'secundario'
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) AS rn
  FROM public.evaluations
)
UPDATE public.evaluations e
SET reviewer_role = 'secundario'
FROM ranked r
WHERE e.id = r.id AND r.rn >= 2;

CREATE UNIQUE INDEX evaluations_project_reviewer_role_uniq
  ON public.evaluations (project_id, reviewer_role);

CREATE OR REPLACE FUNCTION public.validate_evaluation_reviewer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_externo boolean;
  has_cei boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.evaluator_id
      AND role IN ('presidente', 'vicepresidente', 'secretario', 'miembro_interno_cei', 'miembro_externo_cei')
  ) INTO has_cei;

  IF NOT has_cei THEN
    RAISE EXCEPTION 'El evaluador debe tener un cargo CEI válido';
  END IF;

  IF NEW.reviewer_role = 'primario' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.evaluator_id AND role = 'miembro_externo_cei'
    ) INTO is_externo;

    IF is_externo THEN
      RAISE EXCEPTION 'Un miembro externo del CEI no puede ser revisor primario';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_evaluation_reviewer_trg
  BEFORE INSERT OR UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.validate_evaluation_reviewer();

DROP POLICY IF EXISTS "Presidencia inserts evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Secretario inserts evaluations" ON public.evaluations;

CREATE POLICY "Presidente o secretario inserts evaluations"
  ON public.evaluations FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'presidente')
    OR public.has_role(auth.uid(), 'secretario')
  );

CREATE POLICY "Presidente o secretario deletes evaluations"
  ON public.evaluations FOR DELETE
  USING (
    public.has_role(auth.uid(), 'presidente')
    OR public.has_role(auth.uid(), 'secretario')
  );
