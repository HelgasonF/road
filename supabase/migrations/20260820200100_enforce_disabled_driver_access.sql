create or replace function public.current_operator_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select operator.id
  from public.operators operator
  join public.profiles profile on profile.id = operator.user_id
  where operator.user_id = (select auth.uid())
    and profile.role = 'driver'
    and operator.driver_access_disabled_at is null
  limit 1;
$$;
