
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.profiles(id) NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('recepcion', 'antecedentes_incompletos', 'asignacion_evaluador', 'evaluacion_completada', 'resolucion', 'sesion_convocatoria', 'alerta_plazo', 'eximicion')),
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'enviado', 'error')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users read own notifications
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO public USING (auth.uid() = recipient_id);

-- Users update own notifications (mark as read)
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO public USING (auth.uid() = recipient_id);

-- Authenticated users can insert notifications
CREATE POLICY "Authenticated insert notifications" ON public.notifications
  FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);

-- Admin full access
CREATE POLICY "Admin full access notifications" ON public.notifications
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Secretario can read all notifications
CREATE POLICY "Secretario reads all notifications" ON public.notifications
  FOR SELECT TO public USING (has_role(auth.uid(), 'secretario'::app_role));

-- Presidente can read all notifications
CREATE POLICY "Presidente reads all notifications" ON public.notifications
  FOR SELECT TO public USING (has_role(auth.uid(), 'presidente'::app_role));
