alter table public.operators
add column driver_access_link_created_at timestamptz;

update public.operators
set driver_access_link_created_at = driver_invited_at
where driver_invited_at is not null;

comment on column public.operators.driver_access_link_created_at is
  'Time when staff most recently generated a passwordless driver access link for WhatsApp delivery.';

comment on column public.operators.driver_invited_at is
  'Deprecated compatibility field retained while the former email-invitation Preview is replaced.';

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
      driver_access_link_created_at = now(),
      driver_access_disabled_at = null
  where id = p_operator_id;
end;
$$;

revoke all on function public.link_driver_user(uuid, uuid) from public, anon;
grant execute on function public.link_driver_user(uuid, uuid) to authenticated;
