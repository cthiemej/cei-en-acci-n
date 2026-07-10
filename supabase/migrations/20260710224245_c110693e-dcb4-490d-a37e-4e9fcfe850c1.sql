CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  v_email := lower(COALESCE(NEW.email, ''));
  IF v_email NOT LIKE '%@mail.udp.cl' AND v_email NOT LIKE '%@gmail.com' THEN
    RAISE EXCEPTION 'Solo se permite registro con correo @mail.udp.cl o @gmail.com';
  END IF;

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
$function$;