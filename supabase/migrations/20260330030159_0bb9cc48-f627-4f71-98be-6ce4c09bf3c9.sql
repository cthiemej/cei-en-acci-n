
-- Fix the overly permissive insert policy on project_status_history
DROP POLICY "System inserts history" ON public.project_status_history;

-- Only authenticated users who own the project or have admin/secretario/presidente role can insert
CREATE POLICY "Authenticated users insert own project history" ON public.project_status_history
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_status_history.project_id
      AND p.principal_investigator_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'secretario')
    OR public.has_role(auth.uid(), 'presidente')
    OR public.has_role(auth.uid(), 'admin')
  )
);
