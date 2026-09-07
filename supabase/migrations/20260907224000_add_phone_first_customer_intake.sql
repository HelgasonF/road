alter table public.jobs
add column intake_pending boolean not null default false;

-- Supabase local bootstrap versions can grant table privileges to API roles by
-- default. Public application data is never read directly by anonymous users.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Contact attempts must pass through record_job_contact so the initiator and
-- assignment rules cannot be bypassed with a direct insert.
revoke insert, update, delete, truncate, references, trigger
on public.job_contact_events from authenticated;

create or replace view public.job_operator_matches
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
  and not job.intake_pending
  and job.status not in ('completed', 'cancelled');

create or replace function public.create_customer_intake_job(
  p_customer_phone text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_job_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if length(trim(p_customer_phone)) not between 3 and 40 then
    raise exception 'Invalid customer phone';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid token hash';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'Invalid customer link expiry';
  end if;

  insert into public.jobs (
    customer_name,
    customer_phone,
    latitude,
    longitude,
    location_label,
    location_source,
    priority,
    intake_pending,
    created_by
  ) values (
    'Viðskiptavinur',
    trim(p_customer_phone),
    64.95,
    -18.7,
    'Bíður eftir upplýsingum viðskiptavinar',
    'manual',
    'normal',
    true,
    (select auth.uid())
  )
  returning id into saved_job_id;

  insert into public.customer_intake_links (
    job_id,
    token_hash,
    expires_at,
    created_by
  ) values (
    saved_job_id,
    p_token_hash,
    p_expires_at,
    (select auth.uid())
  );

  return saved_job_id;
end;
$$;

create or replace function public.submit_customer_intake_v3(
  p_token_hash text,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle_registration text,
  p_vehicle_make text,
  p_rental_company text,
  p_people_count integer,
  p_required_capability text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_label text,
  p_location_source public.location_source,
  p_customer_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  intake_link_id uuid;
  intake_job_id uuid;
begin
  select link.id, link.job_id
  into intake_link_id, intake_job_id
  from public.customer_intake_links link
  join public.jobs job on job.id = link.job_id
  where link.token_hash = p_token_hash
    and link.revoked_at is null
    and link.submitted_at is null
    and link.expires_at > now()
    and job.status not in ('completed', 'cancelled')
  for update of link;

  if intake_link_id is null then
    raise exception 'Customer intake link is invalid or unavailable' using errcode = 'P0002';
  end if;

  if p_location_source not in ('gps', 'map_pin') then
    raise exception 'Customer location must be confirmed by GPS or map pin';
  end if;

  if p_people_count is null or p_people_count not between 1 and 99 then
    raise exception 'People count must be between 1 and 99';
  end if;

  if not exists (
    select 1 from public.capabilities where code = p_required_capability
  ) then
    raise exception 'Unsupported assistance type';
  end if;

  update public.jobs
  set customer_name = trim(p_customer_name),
      customer_phone = trim(p_customer_phone),
      vehicle_registration = nullif(trim(p_vehicle_registration), ''),
      vehicle_make = nullif(trim(p_vehicle_make), ''),
      rental_company = nullif(trim(p_rental_company), ''),
      people_count = p_people_count,
      latitude = p_latitude,
      longitude = p_longitude,
      location_label = trim(p_location_label),
      location_source = p_location_source,
      customer_notes = trim(p_customer_notes),
      customer_intake_submitted_at = now(),
      intake_pending = false
  where id = intake_job_id;

  delete from public.job_required_capabilities
  where job_id = intake_job_id;

  insert into public.job_required_capabilities (job_id, capability_code)
  values (intake_job_id, p_required_capability);

  update public.customer_intake_links
  set submitted_at = now()
  where id = intake_link_id;

  return intake_job_id;
end;
$$;

create or replace function public.save_job(
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
      notes, intake_pending, created_by
    ) values (
      p_customer_name, p_customer_phone, p_vehicle_registration, p_vehicle_make, p_vehicle_model,
      p_vehicle_type, p_latitude, p_longitude, p_location_label, p_location_source, p_priority,
      p_notes, false, (select auth.uid())
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
        notes = p_notes,
        intake_pending = false
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
  pending_customer_intake boolean;
begin
  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles
    where id = p_vehicle_id and operator_id = p_operator_id and is_active
  ) then
    raise exception 'Vehicle does not belong to operator';
  end if;

  select status, intake_pending
  into previous_status, pending_customer_intake
  from public.jobs
  where id = p_job_id
  for update;

  if previous_status is null then raise exception 'Job not found'; end if;
  if pending_customer_intake then raise exception 'Customer intake must be completed before assignment'; end if;
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

revoke all on function public.create_customer_intake_job(text, text, timestamptz)
from public, anon;
grant execute on function public.create_customer_intake_job(text, text, timestamptz)
to authenticated;

revoke all on function public.submit_customer_intake_v3(
  text, text, text, text, text, text, integer, text,
  double precision, double precision, text, public.location_source, text
) from public, anon, authenticated;
grant execute on function public.submit_customer_intake_v3(
  text, text, text, text, text, text, integer, text,
  double precision, double precision, text, public.location_source, text
) to service_role;

grant select on public.job_required_capabilities to service_role;
