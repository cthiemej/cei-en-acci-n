
-- 2. Migrate existing 'evaluador' rows to 'miembro_interno_cei'
UPDATE public.user_roles SET role = 'miembro_interno_cei' WHERE role = 'evaluador';

-- 3. user_roles: allow multiple rows per user, one row per (user, role)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
-- The unique(user_id, role) already exists from initial migration, keep it.

-- 4. Partial unique index: only ONE CEI cargo per user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_cei_cargo_per_user
  ON public.user_roles(user_id)
  WHERE role IN ('presidente', 'vicepresidente', 'secretario', 'miembro_interno_cei', 'miembro_externo_cei');

-- 5. Trigger to enforce miembro_externo_cei ⊕ investigador
CREATE OR REPLACE FUNCTION public.enforce_externo_investigador_incompatibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'miembro_externo_cei' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'investigador') THEN
      RAISE EXCEPTION 'Un miembro externo del CEI no puede ser también investigador';
    END IF;
  ELSIF NEW.role = 'investigador' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'miembro_externo_cei') THEN
      RAISE EXCEPTION 'Un investigador no puede ser también miembro externo del CEI';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_externo_investigador ON public.user_roles;
CREATE TRIGGER trg_enforce_externo_investigador
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_externo_investigador_incompatibility();

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.is_cei_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('presidente', 'vicepresidente', 'secretario', 'miembro_interno_cei', 'miembro_externo_cei', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_investigador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'investigador'
  )
$$;

-- Note: has_role() already uses EXISTS, so it works with multiple rows per user.
-- get_user_role() returns first row (used only for legacy display); leave as is.

-- 7. Update RLS policies: wherever 'presidente' is checked for privileged actions,
--    add 'vicepresidente' with the same permissions.
--    Also: replace legacy 'evaluador' checks with the new CEI members roles.

-- --- projects ---
DROP POLICY IF EXISTS "Presidente reads all projects" ON public.projects;
CREATE POLICY "Presidencia reads all projects" ON public.projects
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Presidente updates all projects" ON public.projects;
CREATE POLICY "Presidencia updates all projects" ON public.projects
FOR UPDATE USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Evaluador reads assigned projects" ON public.projects;
CREATE POLICY "CEI member reads assigned projects" ON public.projects
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.project_id = projects.id AND e.evaluator_id = auth.uid()
  )
);

-- --- profiles ---
DROP POLICY IF EXISTS "Presidente can read all profiles" ON public.profiles;
CREATE POLICY "Presidencia can read all profiles" ON public.profiles
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

-- --- evaluations ---
DROP POLICY IF EXISTS "Presidente reads all evaluations" ON public.evaluations;
CREATE POLICY "Presidencia reads all evaluations" ON public.evaluations
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Presidente inserts evaluations" ON public.evaluations;
CREATE POLICY "Presidencia inserts evaluations" ON public.evaluations
FOR INSERT WITH CHECK (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

-- --- sessions ---
DROP POLICY IF EXISTS "Presidente manages sessions" ON public.sessions;
CREATE POLICY "Presidencia manages sessions" ON public.sessions
FOR ALL USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Presidente manages attendees" ON public.session_attendees;
CREATE POLICY "Presidencia manages attendees" ON public.session_attendees
FOR ALL USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Presidente manages agenda" ON public.session_agenda_items;
CREATE POLICY "Presidencia manages agenda" ON public.session_agenda_items
FOR ALL USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

-- Sessions read: extend from 'evaluador' to any CEI member role
DROP POLICY IF EXISTS "Committee members read sessions" ON public.sessions;
CREATE POLICY "Committee members read sessions" ON public.sessions
FOR SELECT USING (
  has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente')
  OR has_role(auth.uid(), 'secretario')
  OR has_role(auth.uid(), 'miembro_interno_cei') OR has_role(auth.uid(), 'miembro_externo_cei')
  OR has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Committee members read attendees" ON public.session_attendees;
CREATE POLICY "Committee members read attendees" ON public.session_attendees
FOR SELECT USING (
  has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente')
  OR has_role(auth.uid(), 'secretario')
  OR has_role(auth.uid(), 'miembro_interno_cei') OR has_role(auth.uid(), 'miembro_externo_cei')
  OR has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Committee members read agenda" ON public.session_agenda_items;
CREATE POLICY "Committee members read agenda" ON public.session_agenda_items
FOR SELECT USING (
  has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente')
  OR has_role(auth.uid(), 'secretario')
  OR has_role(auth.uid(), 'miembro_interno_cei') OR has_role(auth.uid(), 'miembro_externo_cei')
  OR has_role(auth.uid(), 'admin')
);

-- --- project_documents / project_status_history / generated_documents / notifications ---
DROP POLICY IF EXISTS "Presidente reads all project docs" ON public.project_documents;
CREATE POLICY "Presidencia reads all project docs" ON public.project_documents
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Presidente reads all history" ON public.project_status_history;
CREATE POLICY "Presidencia reads all history" ON public.project_status_history
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

DROP POLICY IF EXISTS "Presidente reads all notifications" ON public.notifications;
CREATE POLICY "Presidencia reads all notifications" ON public.notifications
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

-- Also extend user_roles read for vicepresidente
DROP POLICY IF EXISTS "Presidente reads roles" ON public.user_roles;
CREATE POLICY "Presidencia reads roles" ON public.user_roles
FOR SELECT USING (has_role(auth.uid(), 'presidente') OR has_role(auth.uid(), 'vicepresidente'));

-- Update the antecedentes-incompletos insert policy to include vicepresidente
DROP POLICY IF EXISTS "Authenticated users insert own project history" ON public.project_status_history;
CREATE POLICY "Authenticated users insert own project history" ON public.project_status_history
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_status_history.project_id
      AND p.principal_investigator_id = auth.uid()
    )
    OR has_role(auth.uid(), 'secretario')
    OR has_role(auth.uid(), 'presidente')
    OR has_role(auth.uid(), 'vicepresidente')
    OR has_role(auth.uid(), 'admin')
  )
);
