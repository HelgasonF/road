alter table public.operators
add column driver_invited_at timestamptz,
add column driver_access_activated_at timestamptz,
add column driver_access_disabled_at timestamptz;

update public.operators operator
set driver_invited_at = auth_user.invited_at,
    driver_access_activated_at = coalesce(auth_user.last_sign_in_at, auth_user.email_confirmed_at)
from auth.users auth_user
where operator.user_id = auth_user.id;

create or replace function public.link_driver_user(
  p_operator_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_role public.app_role;
  v_linked_user_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select profile.role
  into v_profile_role
  from public.profiles profile
  where profile.id = p_user_id
  for update;

  if v_profile_role is null then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if v_profile_role not in ('pending', 'driver') then
    raise exception 'Staff accounts cannot be linked as drivers' using errcode = '42501';
  end if;

  select operator.user_id
  into v_linked_user_id
  from public.operators operator
  where operator.id = p_operator_id
  for update;

  if not found then
    raise exception 'Operator not found' using errcode = 'P0002';
  end if;

  if v_linked_user_id is not null and v_linked_user_id <> p_user_id then
    raise exception 'Operator already has driver access';
  end if;

  if exists (
    select 1
    from public.operators operator
    where operator.user_id = p_user_id
      and operator.id <> p_operator_id
  ) then
    raise exception 'User is already linked to another operator';
  end if;

  update public.profiles
  set role = 'driver'
  where id = p_user_id;

  update public.operators
  set user_id = p_user_id,
      driver_invited_at = now(),
      driver_access_disabled_at = null
  where id = p_operator_id;
end;
$$;

create or replace function public.set_driver_access_disabled(
  p_operator_id uuid,
  p_disabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  update public.operators
  set driver_access_disabled_at = case when p_disabled then now() else null end
  where id = p_operator_id
    and user_id is not null;

  if not found then
    raise exception 'Linked driver access not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.activate_current_driver_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator_id uuid := (select public.current_operator_id());
begin
  if v_operator_id is null then
    raise exception 'Driver access required' using errcode = '42501';
  end if;

  update public.operators
  set driver_access_activated_at = coalesce(driver_access_activated_at, now())
  where id = v_operator_id;
end;
$$;

revoke all on function public.link_driver_user(uuid, uuid) from public;
revoke all on function public.set_driver_access_disabled(uuid, boolean) from public;
revoke all on function public.activate_current_driver_access() from public;
grant execute on function public.link_driver_user(uuid, uuid) to authenticated;
grant execute on function public.set_driver_access_disabled(uuid, boolean) to authenticated;
grant execute on function public.activate_current_driver_access() to authenticated;
