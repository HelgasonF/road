alter table public.operators
add column user_id uuid references public.profiles (id) on delete set null;

create unique index operators_user_id_uidx
  on public.operators (user_id)
  where user_id is not null;

alter table public.job_assignments
add column declined_at timestamptz,
add column decline_reason text;

alter table public.job_assignments
add constraint job_assignment_response_valid check (
  not (accepted_at is not null and declined_at is not null)
  and (decline_reason is null or length(trim(decline_reason)) between 2 and 1000)
  and (declined_at is null or declined_at >= assigned_at)
);

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
  limit 1;
$$;

create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.current_operator_id()) is not null;
$$;

create or replace function public.driver_has_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_assignments assignment
    where assignment.job_id = p_job_id
      and assignment.operator_id = (select public.current_operator_id())
      and assignment.unassigned_at is null
  );
$$;

revoke all on function public.current_operator_id() from public;
revoke all on function public.is_driver() from public;
revoke all on function public.driver_has_job(uuid) from public;
grant execute on function public.current_operator_id() to authenticated;
grant execute on function public.is_driver() to authenticated;
grant execute on function public.driver_has_job(uuid) to authenticated;

create policy "Users can read own profile" on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy "Drivers can read capabilities" on public.capabilities
for select to authenticated
using ((select public.is_driver()));

create policy "Drivers can read own operator" on public.operators
for select to authenticated
using (id = (select public.current_operator_id()));

create policy "Drivers can read own vehicles" on public.vehicles
for select to authenticated
using (operator_id = (select public.current_operator_id()));

create policy "Drivers can read own operator capabilities" on public.operator_capabilities
for select to authenticated
using (operator_id = (select public.current_operator_id()));

create policy "Drivers can read own vehicle capabilities" on public.vehicle_capabilities
for select to authenticated
using (
  exists (
    select 1
    from public.vehicles vehicle
    where vehicle.id = vehicle_capabilities.vehicle_id
      and vehicle.operator_id = (select public.current_operator_id())
  )
);

create policy "Drivers can read assigned jobs" on public.jobs
for select to authenticated
using ((select public.driver_has_job(id)));

create policy "Drivers can read assigned job requirements" on public.job_required_capabilities
for select to authenticated
using ((select public.driver_has_job(job_id)));

create policy "Drivers can read own assignments" on public.job_assignments
for select to authenticated
using (operator_id = (select public.current_operator_id()));

create policy "Drivers can read assigned job history" on public.job_status_history
for select to authenticated
using ((select public.driver_has_job(job_id)));

create or replace function public.set_driver_availability(
  p_status public.operator_availability
)
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
  set availability_status = p_status
  where id = v_operator_id;
end;
$$;

create or replace function public.respond_to_driver_assignment(
  p_assignment_id uuid,
  p_accept boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator_id uuid := (select public.current_operator_id());
  assigned_job_id uuid;
  previous_status public.job_status;
begin
  if v_operator_id is null then
    raise exception 'Driver access required' using errcode = '42501';
  end if;

  select assignment.job_id
  into assigned_job_id
  from public.job_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.operator_id = v_operator_id
    and assignment.unassigned_at is null;

  if assigned_job_id is null then
    raise exception 'Active assignment not found' using errcode = 'P0002';
  end if;

  select job.status
  into previous_status
  from public.jobs job
  where job.id = assigned_job_id
  for update;

  perform 1
  from public.job_assignments assignment
  where assignment.id = p_assignment_id
    and assignment.operator_id = v_operator_id
    and assignment.unassigned_at is null
  for update;

  if not found then
    raise exception 'Active assignment not found' using errcode = 'P0002';
  end if;

  if p_accept then
    if previous_status = 'accepted' then
      return assigned_job_id;
    end if;
    if previous_status <> 'assigned' then
      raise exception 'Assignment cannot be accepted from this status';
    end if;

    update public.job_assignments
    set accepted_at = now()
    where id = p_assignment_id;

    update public.jobs
    set status = 'accepted'
    where id = assigned_job_id;

    update public.operators
    set availability_status = 'busy'
    where id = v_operator_id;

    insert into public.job_status_history (job_id, from_status, to_status, changed_by, notes)
    values (assigned_job_id, previous_status, 'accepted', (select auth.uid()), p_notes);
  else
    if previous_status <> 'assigned' then
      raise exception 'Assignment cannot be declined from this status';
    end if;
    if p_notes is null or length(trim(p_notes)) < 2 then
      raise exception 'A decline reason is required';
    end if;

    update public.job_assignments
    set declined_at = now(),
        decline_reason = trim(p_notes),
        unassigned_at = now()
    where id = p_assignment_id;

    update public.jobs
    set status = 'new'
    where id = assigned_job_id;

    insert into public.job_status_history (job_id, from_status, to_status, changed_by, notes)
    values (assigned_job_id, previous_status, 'new', (select auth.uid()), trim(p_notes));
  end if;

  return assigned_job_id;
end;
$$;

create or replace function public.set_driver_job_status(
  p_job_id uuid,
  p_status public.job_status,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator_id uuid := (select public.current_operator_id());
  previous_status public.job_status;
begin
  if v_operator_id is null then
    raise exception 'Driver access required' using errcode = '42501';
  end if;

  select job.status
  into previous_status
  from public.jobs job
  where job.id = p_job_id
  for update;

  if previous_status is null then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.job_assignments assignment
  where assignment.job_id = p_job_id
    and assignment.operator_id = v_operator_id
    and assignment.unassigned_at is null
    and assignment.accepted_at is not null
  for update;

  if not found then
    raise exception 'Accepted assignment not found' using errcode = 'P0002';
  end if;

  if previous_status = p_status then
    return;
  end if;

  if not (
    (previous_status = 'accepted' and p_status = 'en_route')
    or (previous_status = 'en_route' and p_status = 'on_scene')
    or (previous_status = 'on_scene' and p_status in ('in_progress', 'completed'))
    or (previous_status = 'in_progress' and p_status in ('transporting', 'completed'))
    or (previous_status = 'transporting' and p_status = 'completed')
  ) then
    raise exception 'Invalid driver status transition';
  end if;

  update public.jobs
  set status = p_status,
      completed_at = case when p_status = 'completed' then now() else null end
  where id = p_job_id;

  if p_status = 'completed' then
    update public.operators
    set availability_status = 'available'
    where id = v_operator_id;
  end if;

  insert into public.job_status_history (job_id, from_status, to_status, changed_by, notes)
  values (p_job_id, previous_status, p_status, (select auth.uid()), p_notes);
end;
$$;

revoke all on function public.set_driver_availability(public.operator_availability) from public;
revoke all on function public.respond_to_driver_assignment(uuid, boolean, text) from public;
revoke all on function public.set_driver_job_status(uuid, public.job_status, text) from public;
grant execute on function public.set_driver_availability(public.operator_availability) to authenticated;
grant execute on function public.respond_to_driver_assignment(uuid, boolean, text) to authenticated;
grant execute on function public.set_driver_job_status(uuid, public.job_status, text) to authenticated;
