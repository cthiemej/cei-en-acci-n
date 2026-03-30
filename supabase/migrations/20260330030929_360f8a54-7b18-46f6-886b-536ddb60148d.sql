
-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number INTEGER NOT NULL,
  session_type TEXT DEFAULT 'ordinaria' CHECK (session_type IN ('ordinaria', 'extraordinaria')),
  scheduled_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'programada' CHECK (status IN ('programada', 'en_curso', 'finalizada', 'cancelada')),
  quorum_met BOOLEAN DEFAULT false,
  minutes_summary TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Session attendees
CREATE TABLE public.session_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id),
  attended BOOLEAN DEFAULT false,
  signed BOOLEAN DEFAULT false,
  UNIQUE(session_id, member_id)
);
ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;

-- Session agenda items
CREATE TABLE public.session_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  item_order INTEGER NOT NULL,
  description TEXT NOT NULL,
  resolution TEXT,
  vote_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.session_agenda_items ENABLE ROW LEVEL SECURITY;

-- Auto-generate session_number as annual correlative
CREATE OR REPLACE FUNCTION public.generate_session_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  next_num INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NEW.scheduled_date)::INTEGER;
  SELECT COALESCE(MAX(session_number), 0) + 1
  INTO next_num
  FROM public.sessions
  WHERE EXTRACT(YEAR FROM scheduled_date) = current_year;
  NEW.session_number := next_num;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_session_number
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.generate_session_number();

-- RLS for sessions: committee members can read, secretario/presidente can manage
CREATE POLICY "Committee members read sessions" ON public.sessions
FOR SELECT USING (
  public.has_role(auth.uid(), 'evaluador')
  OR public.has_role(auth.uid(), 'secretario')
  OR public.has_role(auth.uid(), 'presidente')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Secretario manages sessions" ON public.sessions
FOR ALL USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente manages sessions" ON public.sessions
FOR ALL USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin manages sessions" ON public.sessions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS for session_attendees
CREATE POLICY "Committee members read attendees" ON public.session_attendees
FOR SELECT USING (
  public.has_role(auth.uid(), 'evaluador')
  OR public.has_role(auth.uid(), 'secretario')
  OR public.has_role(auth.uid(), 'presidente')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Secretario manages attendees" ON public.session_attendees
FOR ALL USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente manages attendees" ON public.session_attendees
FOR ALL USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin manages attendees" ON public.session_attendees
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS for session_agenda_items
CREATE POLICY "Committee members read agenda" ON public.session_agenda_items
FOR SELECT USING (
  public.has_role(auth.uid(), 'evaluador')
  OR public.has_role(auth.uid(), 'secretario')
  OR public.has_role(auth.uid(), 'presidente')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Secretario manages agenda" ON public.session_agenda_items
FOR ALL USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente manages agenda" ON public.session_agenda_items
FOR ALL USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin manages agenda" ON public.session_agenda_items
FOR ALL USING (public.has_role(auth.uid(), 'admin'));
