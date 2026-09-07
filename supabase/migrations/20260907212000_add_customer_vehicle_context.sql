alter table public.jobs
add column rental_company text,
add column people_count integer;

alter table public.jobs
add constraint jobs_rental_company_length
check (rental_company is null or length(trim(rental_company)) between 1 and 120),
add constraint jobs_people_count_range
check (people_count is null or people_count between 1 and 99);

create or replace function public.submit_customer_intake_v2(
  p_token_hash text,
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
      customer_intake_submitted_at = now()
  where id = intake_job_id;

  update public.customer_intake_links
  set submitted_at = now()
  where id = intake_link_id;

  return intake_job_id;
end;
$$;

revoke all on function public.submit_customer_intake_v2(
  text, text, text, text, text, text, integer,
  double precision, double precision, text, public.location_source, text
) from public, anon, authenticated;

grant execute on function public.submit_customer_intake_v2(
  text, text, text, text, text, text, integer,
  double precision, double precision, text, public.location_source, text
) to service_role;
