
-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('investigador', 'evaluador', 'secretario', 'presidente', 'admin');

-- Create user_roles table (security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function to get user role text
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  faculty TEXT,
  phone TEXT,
  is_external BOOLEAN DEFAULT false,
  conflict_declaration_signed BOOLEAN DEFAULT false,
  confidentiality_signed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  title TEXT NOT NULL,
  abstract TEXT,
  principal_investigator_id UUID NOT NULL REFERENCES public.profiles(id),
  project_type TEXT CHECK (project_type IN ('fondecyt', 'fondo_interno', 'tesis_doctoral', 'otro_concursable')),
  funding_source TEXT,
  involves_human_participants BOOLEAN DEFAULT true,
  uses_secondary_data_only BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'recibido', 'en_pre_revision', 'asignado', 'en_evaluacion', 'en_sesion', 'aprobado', 'rechazado', 'pendiente', 'eximido', 'expedito')),
  evaluation_track TEXT CHECK (evaluation_track IN ('regular', 'expedita', 'eximicion') OR evaluation_track IS NULL),
  submitted_at TIMESTAMPTZ,
  reception_deadline TIMESTAMPTZ,
  review_deadline TIMESTAMPTZ,
  deadline_extended BOOLEAN DEFAULT false,
  resolution_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-generate project code CEI-YYYY-NNN
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  next_num INT;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'CEI-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_num
  FROM public.projects
  WHERE code LIKE 'CEI-' || current_year || '-%';
  NEW.code := 'CEI-' || current_year || '-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_project_code
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.generate_project_code();

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'investigador');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can read all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update all profiles" ON public.profiles
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Secretario can read all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente can read all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'presidente'));

-- RLS Policies for projects
CREATE POLICY "Investigador reads own projects" ON public.projects
FOR SELECT USING (auth.uid() = principal_investigator_id);

CREATE POLICY "Investigador inserts own projects" ON public.projects
FOR INSERT WITH CHECK (auth.uid() = principal_investigator_id);

CREATE POLICY "Investigador updates own projects" ON public.projects
FOR UPDATE USING (auth.uid() = principal_investigator_id);

CREATE POLICY "Secretario reads all projects" ON public.projects
FOR SELECT USING (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Secretario inserts projects" ON public.projects
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'secretario'));

CREATE POLICY "Presidente reads all projects" ON public.projects
FOR SELECT USING (public.has_role(auth.uid(), 'presidente'));

CREATE POLICY "Admin full access projects" ON public.projects
FOR ALL USING (public.has_role(auth.uid(), 'admin'));
