ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS co_investigators text,
ADD COLUMN IF NOT EXISTS faculty_or_center text,
ADD COLUMN IF NOT EXISTS approval_date date,
ADD COLUMN IF NOT EXISTS duration_months integer;