
-- RLS updates for polymorphic project_documents / evaluations / generated_documents
-- Enable investigator to manage amendment/audit documents and CEI/presidencia to insert evaluations for audits

-- project_documents: expand policies to cover amendment_id / audit_id ownership
DROP POLICY IF EXISTS "Investigador reads own project docs" ON public.project_documents;
DROP POLICY IF EXISTS "Investigador inserts own project docs" ON public.project_documents;
DROP POLICY IF EXISTS "Investigador updates own project docs" ON public.project_documents;
DROP POLICY IF EXISTS "Investigador deletes own project docs" ON public.project_documents;

CREATE POLICY "Requester reads own request docs" ON public.project_documents FOR SELECT
USING (
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND p.principal_investigator_id = auth.uid()))
  OR (amendment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.amendments a WHERE a.id = project_documents.amendment_id AND a.requester_id = auth.uid()))
  OR (audit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.audits au WHERE au.id = project_documents.audit_id AND au.requester_id = auth.uid()))
);

CREATE POLICY "Requester inserts own request docs" ON public.project_documents FOR INSERT
WITH CHECK (
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND p.principal_investigator_id = auth.uid()))
  OR (amendment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.amendments a WHERE a.id = project_documents.amendment_id AND a.requester_id = auth.uid()))
  OR (audit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.audits au WHERE au.id = project_documents.audit_id AND au.requester_id = auth.uid()))
);

CREATE POLICY "Requester updates own request docs" ON public.project_documents FOR UPDATE
USING (
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND p.principal_investigator_id = auth.uid()))
  OR (amendment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.amendments a WHERE a.id = project_documents.amendment_id AND a.requester_id = auth.uid()))
  OR (audit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.audits au WHERE au.id = project_documents.audit_id AND au.requester_id = auth.uid()))
);

CREATE POLICY "Requester deletes own request docs" ON public.project_documents FOR DELETE
USING (
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_documents.project_id AND p.principal_investigator_id = auth.uid()))
  OR (amendment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.amendments a WHERE a.id = project_documents.amendment_id AND a.requester_id = auth.uid()))
  OR (audit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.audits au WHERE au.id = project_documents.audit_id AND au.requester_id = auth.uid()))
);

CREATE POLICY "CEI reads all request docs" ON public.project_documents FOR SELECT
USING (public.is_cei_member(auth.uid()));

-- evaluations: allow vicepresidente to insert (for audit assignments)
DROP POLICY IF EXISTS "Presidente o secretario inserts evaluations" ON public.evaluations;
CREATE POLICY "Presidencia o secretario inserts evaluations" ON public.evaluations FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'presidente'::app_role)
  OR public.has_role(auth.uid(), 'vicepresidente'::app_role)
  OR public.has_role(auth.uid(), 'secretario'::app_role)
);

-- generated_documents: allow amendment/audit context and requester to read own
DROP POLICY IF EXISTS "Investigador reads own generated docs" ON public.generated_documents;
CREATE POLICY "Requester reads own generated docs" ON public.generated_documents FOR SELECT
USING (
  (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = generated_documents.project_id AND p.principal_investigator_id = auth.uid()))
  OR (amendment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.amendments a WHERE a.id = generated_documents.amendment_id AND a.requester_id = auth.uid()))
  OR (audit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.audits au WHERE au.id = generated_documents.audit_id AND au.requester_id = auth.uid()))
);

DROP POLICY IF EXISTS "Committee reads all generated docs" ON public.generated_documents;
CREATE POLICY "CEI reads all generated docs" ON public.generated_documents FOR SELECT
USING (public.is_cei_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated inserts own generated docs" ON public.generated_documents;
DROP POLICY IF EXISTS "Secretario inserts generated docs" ON public.generated_documents;
CREATE POLICY "CEI managers insert generated docs" ON public.generated_documents FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'secretario'::app_role)
  OR public.has_role(auth.uid(), 'presidente'::app_role)
  OR public.has_role(auth.uid(), 'vicepresidente'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
