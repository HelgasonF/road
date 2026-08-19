create or replace function public.assign_job(
  p_job_id uuid,
  p_operator_id uuid,
  p_vehicle_id uuid,
  p_notes text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  assignment_id uuid;
  previous_status public.job_status;
begin
  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and operator_id = p_operator_id and is_active
  ) then
    raise exception 'Vehicle does not belong to operator';
  end if;

  select status into previous_status from public.jobs where id = p_job_id for update;
  if previous_status is null then raise exception 'Job not found'; end if;
  if previous_status in ('completed', 'cancelled') then raise exception 'Closed job cannot be assigned'; end if;

  select id into assignment_id
  from public.job_assignments
  where job_id = p_job_id
    and unassigned_at is null
    and operator_id = p_operator_id
    and vehicle_id is not distinct from p_vehicle_id;

  if assignment_id is not null then return assignment_id; end if;

  update public.job_assignments
  set unassigned_at = now()
  where job_id = p_job_id and unassigned_at is null;

  insert into public.job_assignments (job_id, operator_id, vehicle_id, assigned_by, notes)
  values (p_job_id, p_operator_id, p_vehicle_id, (select auth.uid()), p_notes)
  returning id into assignment_id;

  update public.jobs set status = 'assigned', completed_at = null where id = p_job_id;
  if previous_status <> 'assigned' then
    insert into public.job_status_history (job_id, from_status, to_status, changed_by)
    values (p_job_id, previous_status, 'assigned', (select auth.uid()));
  end if;

  return assignment_id;
end;
$$;

create or replace function public.set_job_status(
  p_job_id uuid,
  p_status public.job_status,
  p_notes text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  previous_status public.job_status;
begin
  select status into previous_status from public.jobs where id = p_job_id for update;
  if previous_status is null then raise exception 'Job not found'; end if;
  if previous_status = p_status then return; end if;

  update public.jobs
  set status = p_status,
      completed_at = case when p_status = 'completed' then now() else null end
  where id = p_job_id;

  if p_status = 'accepted' then
    update public.job_assignments
    set accepted_at = coalesce(accepted_at, now())
    where job_id = p_job_id and unassigned_at is null;
  end if;

  insert into public.job_status_history (job_id, from_status, to_status, changed_by, notes)
  values (p_job_id, previous_status, p_status, (select auth.uid()), p_notes);
end;
$$;
