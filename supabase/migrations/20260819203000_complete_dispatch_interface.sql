alter table public.operators
add column base_address text;

update public.operators
set base_address = case id
  when '10000000-0000-4000-8000-000000000001' then 'Hella, Rangárþing ytra'
  when '10000000-0000-4000-8000-000000000002' then 'Akureyri, Ísland'
  when '10000000-0000-4000-8000-000000000003' then 'Ísafjörður, Ísland'
  when '10000000-0000-4000-8000-000000000004' then 'Egilsstaðir, Múlaþing'
  else concat(base_latitude, ', ', base_longitude)
end;

update public.operators
set base_latitude = 63.834570,
    base_longitude = -20.402203
where id = '10000000-0000-4000-8000-000000000001';

alter table public.operators
alter column base_address set not null;

alter table public.operators
add constraint operators_base_address_length
check (length(trim(base_address)) between 2 and 300);

drop function public.save_operator(
  uuid, text, text, text, boolean, public.operator_availability,
  double precision, double precision, double precision, double precision,
  numeric, text, text[]
);

create function public.save_operator(
  p_id uuid,
  p_name text,
  p_phone text,
  p_company_name text,
  p_is_active boolean,
  p_availability_status public.operator_availability,
  p_base_address text,
  p_base_latitude double precision,
  p_base_longitude double precision,
  p_current_latitude double precision,
  p_current_longitude double precision,
  p_service_radius_km numeric,
  p_notes text,
  p_capabilities text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if coalesce(array_length(p_capabilities, 1), 0) = 0 then
    raise exception 'At least one capability is required';
  end if;

  if p_id is null then
    insert into public.operators (
      name, phone, company_name, is_active, availability_status,
      base_address, base_latitude, base_longitude, current_latitude, current_longitude,
      current_location_updated_at, service_radius_km, notes
    ) values (
      p_name, p_phone, p_company_name, p_is_active, p_availability_status,
      p_base_address, p_base_latitude, p_base_longitude, p_current_latitude, p_current_longitude,
      case when p_current_latitude is not null then now() else null end,
      p_service_radius_km, p_notes
    ) returning id into saved_id;
  else
    update public.operators
    set name = p_name,
        phone = p_phone,
        company_name = p_company_name,
        is_active = p_is_active,
        availability_status = p_availability_status,
        base_address = p_base_address,
        base_latitude = p_base_latitude,
        base_longitude = p_base_longitude,
        current_latitude = p_current_latitude,
        current_longitude = p_current_longitude,
        current_location_updated_at = case
          when current_latitude is distinct from p_current_latitude
            or current_longitude is distinct from p_current_longitude
          then case when p_current_latitude is null then null else now() end
          else current_location_updated_at
        end,
        service_radius_km = p_service_radius_km,
        notes = p_notes
    where id = p_id
    returning id into saved_id;

    if saved_id is null then raise exception 'Operator not found'; end if;
  end if;

  delete from public.operator_capabilities where operator_id = saved_id;
  insert into public.operator_capabilities (operator_id, capability_code)
  select saved_id, code from unnest(p_capabilities) as code;

  return saved_id;
end;
$$;

revoke all on function public.save_operator(
  uuid, text, text, text, boolean, public.operator_availability,
  text, double precision, double precision, double precision, double precision,
  numeric, text, text[]
) from public;
grant execute on function public.save_operator(
  uuid, text, text, text, boolean, public.operator_availability,
  text, double precision, double precision, double precision, double precision,
  numeric, text, text[]
) to authenticated;

create function public.save_job(
  p_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle_registration text,
  p_vehicle_make text,
  p_vehicle_model text,
  p_vehicle_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_label text,
  p_location_source public.location_source,
  p_priority public.job_priority,
  p_notes text,
  p_required_capabilities text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if coalesce(array_length(p_required_capabilities, 1), 0) = 0 then
    raise exception 'At least one required capability is required';
  end if;

  if p_id is null then
    insert into public.jobs (
      customer_name, customer_phone, vehicle_registration, vehicle_make, vehicle_model,
      vehicle_type, latitude, longitude, location_label, location_source, priority,
      notes, created_by
    ) values (
      p_customer_name, p_customer_phone, p_vehicle_registration, p_vehicle_make, p_vehicle_model,
      p_vehicle_type, p_latitude, p_longitude, p_location_label, p_location_source, p_priority,
      p_notes, (select auth.uid())
    ) returning id into saved_id;
  else
    update public.jobs
    set customer_name = p_customer_name,
        customer_phone = p_customer_phone,
        vehicle_registration = p_vehicle_registration,
        vehicle_make = p_vehicle_make,
        vehicle_model = p_vehicle_model,
        vehicle_type = p_vehicle_type,
        latitude = p_latitude,
        longitude = p_longitude,
        location_label = p_location_label,
        location_source = p_location_source,
        priority = p_priority,
        notes = p_notes
    where id = p_id
    returning id into saved_id;

    if saved_id is null then raise exception 'Job not found'; end if;
  end if;

  delete from public.job_required_capabilities where job_id = saved_id;
  insert into public.job_required_capabilities (job_id, capability_code)
  select saved_id, code from unnest(p_required_capabilities) as code;

  return saved_id;
end;
$$;

create function public.assign_job(
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

create function public.set_job_status(
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

  insert into public.job_status_history (job_id, from_status, to_status, changed_by, notes)
  values (p_job_id, previous_status, p_status, (select auth.uid()), p_notes);
end;
$$;

revoke all on function public.save_job(
  uuid, text, text, text, text, text, text, double precision, double precision,
  text, public.location_source, public.job_priority, text, text[]
) from public;
revoke all on function public.assign_job(uuid, uuid, uuid, text) from public;
revoke all on function public.set_job_status(uuid, public.job_status, text) from public;

grant execute on function public.save_job(
  uuid, text, text, text, text, text, text, double precision, double precision,
  text, public.location_source, public.job_priority, text, text[]
) to authenticated;
grant execute on function public.assign_job(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.set_job_status(uuid, public.job_status, text) to authenticated;

create view public.job_operator_matches
with (security_invoker = true)
as
select
  job.id as job_id,
  operator.id as operator_id,
  round((extensions.st_distance(
    coalesce(operator.current_location, operator.base_location),
    job.location
  ) / 1000.0)::numeric, 1) as distance_km,
  not exists (
    select 1
    from public.job_required_capabilities required
    where required.job_id = job.id
      and not exists (
        select 1
        from public.operator_capabilities available
        where available.operator_id = operator.id
          and available.capability_code = required.capability_code
      )
  ) as has_required_capabilities,
  operator.service_radius_km is null or extensions.st_dwithin(
    coalesce(operator.current_location, operator.base_location),
    job.location,
    operator.service_radius_km * 1000
  ) as within_service_area
from public.jobs job
cross join public.operators operator
where operator.is_active
  and job.status not in ('completed', 'cancelled');

grant select on public.job_operator_matches to authenticated;
