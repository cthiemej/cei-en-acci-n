
-- Table: generated_documents
CREATE TABLE public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('certificado_recepcion', 'acta_aprobacion', 'acta_rechazo', 'certificado_eximicion', 'acta_sesion')),
  storage_path text NOT NULL,
  generated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- RLS: Investigador reads own project docs
CREATE POLICY "Investigador reads own generated docs" ON public.generated_documents
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = generated_documents.project_id AND p.principal_investigator_id = auth.uid())
  );

-- Committee members read all
CREATE POLICY "Committee reads all generated docs" ON public.generated_documents
  FOR SELECT TO public USING (
    has_role(auth.uid(), 'evaluador'::app_role) OR
    has_role(auth.uid(), 'secretario'::app_role) OR
    has_role(auth.uid(), 'presidente'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Secretario/Presidente/Admin can insert
CREATE POLICY "Secretario inserts generated docs" ON public.generated_documents
  FOR INSERT TO public WITH CHECK (
    has_role(auth.uid(), 'secretario'::app_role) OR
    has_role(auth.uid(), 'presidente'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Investigador can also insert (for auto-generation on submit)
CREATE POLICY "Authenticated inserts own generated docs" ON public.generated_documents
  FOR INSERT TO public WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = generated_documents.project_id AND p.principal_investigator_id = auth.uid())
  );

-- Storage bucket: generated-docs
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-docs', 'generated-docs', false);

-- Storage policies for generated-docs
CREATE POLICY "Auth users upload generated docs" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'generated-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users read generated docs" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'generated-docs' AND auth.uid() IS NOT NULL);
