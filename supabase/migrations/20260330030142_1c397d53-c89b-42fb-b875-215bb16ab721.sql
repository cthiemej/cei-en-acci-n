
-- project_documents table
CREATE TABLE public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('formato_revision', 'protocolo', 'cv_investigador', 'consentimiento_informado', 'material_reclutamiento', 'carta_compromiso', 'otro')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- RLS for project_documents
CREATE POLICY "Investigador reads own project docs" ON public.project_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_documents.project_id
    AND p.principal_investigator_id = auth.uid()
  )
);

CREATE POLICY "Investigador inserts own project docs" ON public.project_documents
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_documents.project_id
    AND p.principal_investigator_id = auth.uid()
  )
);

CREATE POLICY "Investigador updates own project docs" ON public.project_documents
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_documents.project_id
    AND p.principal_investigator_id = auth.uid()
  )
);

CREATE POLICY "Investigador deletes own project docs" ON public.project_documents
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_documents.project_id
    AND p.principal_investigator_id = auth.uid()
  )
);

CREATE POLICY "Secretario reads all project docs" ON public.project_documents
FOR SELECT USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente reads all project docs" ON public.project_documents
FOR SELECT USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin full access project docs" ON public.project_documents
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- project_status_history table
CREATE TABLE public.project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investigador reads own project history" ON public.project_status_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_status_history.project_id
    AND p.principal_investigator_id = auth.uid()
  )
);

CREATE POLICY "Secretario reads all history" ON public.project_status_history
FOR SELECT USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente reads all history" ON public.project_status_history
FOR SELECT USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin full access history" ON public.project_status_history
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Allow inserts from triggers (service role / security definer)
CREATE POLICY "System inserts history" ON public.project_status_history
FOR INSERT WITH CHECK (true);

-- Trigger: auto-insert status history on project status change
CREATE OR REPLACE FUNCTION public.track_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.project_status_history (project_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_project_status
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.track_project_status_change();

-- Storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Storage policies
CREATE POLICY "Investigador uploads project files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'project-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Investigador reads own project files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'project-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Investigador updates own project files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'project-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Investigador deletes own project files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'project-files'
  AND auth.uid() IS NOT NULL
);
