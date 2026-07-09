DROP POLICY IF EXISTS "Committee members read sessions" ON public.sessions;
CREATE POLICY "Committee members read sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (public.is_cei_member(auth.uid()));