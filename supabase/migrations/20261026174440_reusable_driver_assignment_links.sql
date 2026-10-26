-- Assignment credentials are reusable until the assignment/job closes. Raw
-- credentials never enter PostgreSQL; all public access is through server code.
create table public.driver_assignment_links (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  operator_id uuid not null references public.operators(id) on delete cascade,
  driver_user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index driver_assignment_links_active_assignment
  on public.driver_assignment_links(assignment_id) where revoked_at is null;
create index driver_assignment_links_operator on public.driver_assignment_links(operator_id);
create index driver_assignment_links_user on public.driver_assignment_links(driver_user_id);
alter table public.driver_assignment_links enable row level security;
revoke all on public.driver_assignment_links from public, anon, authenticated;
grant select, insert, update, delete on public.driver_assignment_links to service_role;

create function app_private.create_driver_assignment_link(p_job_id uuid, p_operator_id uuid, p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_assignment public.job_assignments;
  v_operator public.operators;
  v_link_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid assignment credential' using errcode='22023';
  end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if v_job.id is null or v_job.status in ('completed','cancelled') then
    raise exception 'Active assignment unavailable' using errcode='P0002';
  end if;
  select * into v_assignment from public.job_assignments
  where job_id=p_job_id and operator_id=p_operator_id and unassigned_at is null
    and declined_at is null for update;
  if v_assignment.id is null then
    raise exception 'Active assignment unavailable' using errcode='P0002';
  end if;
  select * into v_operator from public.operators where id=p_operator_id for update;
  if v_operator.user_id is null or not v_operator.is_active
    or v_operator.driver_access_disabled_at is not null
    or not exists(select 1 from public.profiles where id=v_operator.user_id and role='driver') then
    raise exception 'Driver access unavailable' using errcode='42501';
  end if;
  update public.driver_assignment_links set revoked_at=now()
  where assignment_id=v_assignment.id and revoked_at is null;
  insert into public.driver_assignment_links(assignment_id,operator_id,driver_user_id,token_hash,created_by)
  values(v_assignment.id,p_operator_id,v_operator.user_id,p_token_hash,(select auth.uid()))
  returning id into v_link_id;
  update public.operators set driver_access_link_created_at=now() where id=p_operator_id;
  return v_link_id;
end;
$$;
revoke all on function app_private.create_driver_assignment_link(uuid,uuid,text) from public,anon;
grant execute on function app_private.create_driver_assignment_link(uuid,uuid,text) to authenticated,service_role;

create function public.create_driver_assignment_link(p_job_id uuid, p_operator_id uuid, p_token_hash text)
returns uuid language sql security invoker set search_path = '' as $$
  select app_private.create_driver_assignment_link(p_job_id,p_operator_id,p_token_hash);
$$;
revoke all on function public.create_driver_assignment_link(uuid,uuid,text) from public,anon;
grant execute on function public.create_driver_assignment_link(uuid,uuid,text) to authenticated,service_role;

create function public.resolve_driver_assignment_link(p_token_hash text)
returns table(assignment_id uuid,job_id uuid,operator_id uuid,driver_user_id uuid)
language sql stable security invoker set search_path = '' as $$
  select a.id,a.job_id,a.operator_id,l.driver_user_id
  from public.driver_assignment_links l
  join public.job_assignments a on a.id=l.assignment_id and a.operator_id=l.operator_id
  join public.jobs j on j.id=a.job_id
  join public.operators o on o.id=a.operator_id and o.user_id=l.driver_user_id
  join public.profiles p on p.id=o.user_id and p.role='driver'
  where l.token_hash=p_token_hash and l.revoked_at is null
    and a.unassigned_at is null and a.declined_at is null
    and j.status not in ('completed','cancelled')
    and o.is_active and o.driver_access_disabled_at is null;
$$;
revoke all on function public.resolve_driver_assignment_link(text) from public,anon,authenticated;
grant execute on function public.resolve_driver_assignment_link(text) to service_role;

-- Permanent revocation prevents a closed assignment or disabled account from
-- reviving old credentials if staff later reopen/reassign/re-enable it.
create function app_private.revoke_closed_driver_assignment_links()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='jobs' then
    if new.status in ('completed','cancelled') then
      update public.driver_assignment_links l set revoked_at=now()
      from public.job_assignments a where a.id=l.assignment_id and a.job_id=new.id and l.revoked_at is null;
    end if;
  elsif tg_table_name='job_assignments' then
    if new.unassigned_at is not null or new.declined_at is not null
      or new.operator_id is distinct from old.operator_id or new.job_id is distinct from old.job_id then
      update public.driver_assignment_links set revoked_at=now() where assignment_id=new.id and revoked_at is null;
    end if;
  elsif tg_table_name='operators' then
    if not new.is_active or new.driver_access_disabled_at is not null or new.user_id is distinct from old.user_id then
      update public.driver_assignment_links set revoked_at=now() where operator_id=new.id and revoked_at is null;
    end if;
  elsif tg_table_name='profiles' then
    if new.role <> 'driver' then
      update public.driver_assignment_links set revoked_at=now() where driver_user_id=new.id and revoked_at is null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.revoke_closed_driver_assignment_links() from public,anon,authenticated;
create trigger revoke_driver_links_on_job_close after update of status on public.jobs
  for each row execute function app_private.revoke_closed_driver_assignment_links();
create trigger revoke_driver_links_on_assignment_change
  after update of unassigned_at,declined_at,operator_id,job_id on public.job_assignments
  for each row execute function app_private.revoke_closed_driver_assignment_links();
create trigger revoke_driver_links_on_operator_change
  after update of is_active,user_id,driver_access_disabled_at on public.operators
  for each row execute function app_private.revoke_closed_driver_assignment_links();
create trigger revoke_driver_links_on_role_change after update of role on public.profiles
  for each row execute function app_private.revoke_closed_driver_assignment_links();
