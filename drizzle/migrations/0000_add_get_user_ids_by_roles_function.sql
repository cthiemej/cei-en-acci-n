create or replace function public.get_user_ids_by_roles(_roles text[])
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct ur.user_id from public.user_roles ur where ur.role::text = any(_roles);
$$;

revoke all on function public.get_user_ids_by_roles(text[]) from public, anon;
grant execute on function public.get_user_ids_by_roles(text[]) to authenticated;