-- The dispatcher and customer forms now use one vehicle data model.
-- Existing rows are presentation/test data, so remove the retired free-text fields.
update public.jobs
set vehicle_model = null,
    vehicle_type = null
where vehicle_model is not null
   or vehicle_type is not null;

create function public.save_job(
  p_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle_registration text,
  p_vehicle_make text,
  p_rental_company text,
  p_people_count integer,
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

  if p_people_count is null or p_people_count not between 1 and 99 then
    raise exception 'People count must be between 1 and 99';
  end if;

  if p_id is null then
    insert into public.jobs (
      customer_name,
      customer_phone,
      vehicle_registration,
      vehicle_make,
      rental_company,
      people_count,
      latitude,
      longitude,
      location_label,
      location_source,
      priority,
      notes,
      intake_pending,
      created_by
    ) values (
      trim(p_customer_name),
      trim(p_customer_phone),
      nullif(trim(p_vehicle_registration), ''),
      nullif(trim(p_vehicle_make), ''),
      nullif(trim(p_rental_company), ''),
      p_people_count,
      p_latitude,
      p_longitude,
      trim(p_location_label),
      p_location_source,
      p_priority,
      nullif(trim(p_notes), ''),
      false,
      (select auth.uid())
    ) returning id into saved_id;
  else
    update public.jobs
    set customer_name = trim(p_customer_name),
        customer_phone = trim(p_customer_phone),
        vehicle_registration = nullif(trim(p_vehicle_registration), ''),
        vehicle_make = nullif(trim(p_vehicle_make), ''),
        vehicle_model = null,
        vehicle_type = null,
        rental_company = nullif(trim(p_rental_company), ''),
        people_count = p_people_count,
        latitude = p_latitude,
        longitude = p_longitude,
        location_label = trim(p_location_label),
        location_source = p_location_source,
        priority = p_priority,
        notes = nullif(trim(p_notes), ''),
        intake_pending = false
    where id = p_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Job not found';
    end if;
  end if;

  delete from public.job_required_capabilities
  where job_id = saved_id;

  insert into public.job_required_capabilities (job_id, capability_code)
  select saved_id, code
  from unnest(p_required_capabilities) as code;

  return saved_id;
end;
$$;

revoke all on function public.save_job(
  uuid, text, text, text, text, text, integer,
  double precision, double precision, text, public.location_source,
  public.job_priority, text, text[]
) from public, anon;

grant execute on function public.save_job(
  uuid, text, text, text, text, text, integer,
  double precision, double precision, text, public.location_source,
  public.job_priority, text, text[]
) to authenticated;
