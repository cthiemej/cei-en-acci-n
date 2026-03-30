
-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES public.profiles(id),
  recommendation TEXT CHECK (recommendation IN ('aprobar', 'rechazar', 'solicitar_cambios') OR recommendation IS NULL),
  scientific_validity TEXT,
  risk_benefit TEXT,
  informed_consent_review TEXT,
  vulnerable_groups TEXT,
  general_observations TEXT,
  has_conflict_of_interest BOOLEAN DEFAULT false,
  conflict_description TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, evaluator_id)
);
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- RLS for evaluations
CREATE POLICY "Evaluador reads own evaluations" ON public.evaluations
FOR SELECT USING (auth.uid() = evaluator_id);

CREATE POLICY "Evaluador updates own evaluations" ON public.evaluations
FOR UPDATE USING (auth.uid() = evaluator_id);

CREATE POLICY "Secretario reads all evaluations" ON public.evaluations
FOR SELECT USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente reads all evaluations" ON public.evaluations
FOR SELECT USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin full access evaluations" ON public.evaluations
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Presidente can insert evaluations (assign reviewers)
CREATE POLICY "Presidente inserts evaluations" ON public.evaluations
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'presidente'));

-- Secretario can insert evaluations
CREATE POLICY "Secretario inserts evaluations" ON public.evaluations
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'secretario'));

-- Update projects RLS: evaluadores can read projects they are assigned to
CREATE POLICY "Evaluador reads assigned projects" ON public.projects
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.project_id = projects.id
    AND e.evaluator_id = auth.uid()
  )
);

-- Secretario needs update on projects for pre-revision workflow
CREATE POLICY "Secretario updates all projects" ON public.projects
FOR UPDATE USING (public.has_role(auth.uid(), 'secretario'));

-- Presidente needs update on projects for assigning reviewers
CREATE POLICY "Presidente updates all projects" ON public.projects
FOR UPDATE USING (public.has_role(auth.uid(), 'presidente'));
