-- Permit catalog-resolved customer locations through the existing service-only
-- intake and paid-draft validation. No table, enum or payment workflow changes.
-- Customer lookup remains behind an active-link/rate-limited server action.
grant select on public.iceland_addresses, public.iceland_places to service_role;
grant execute on function public.normalize_icelandic_search(text) to service_role;
grant execute on function public.search_iceland_addresses(text, integer) to service_role;

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

  if p_location_source not in ('gps', 'map_pin', 'search') then
    raise exception 'Customer location must be confirmed by GPS, map pin or location search';
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

create or replace function public.prepare_customer_payment_intake(
  p_token_hash text, p_details jsonb, p_language text, p_environment text,
  p_merchant_id text, p_provider_api text, p_amount_isk integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_link public.customer_intake_links;
  v_draft public.customer_payment_intakes;
  v_result jsonb;
  v_payment public.job_payment_requests;
begin
  select * into v_link from public.customer_intake_links
  where token_hash = p_token_hash for update;
  if v_link.id is null or v_link.revoked_at is not null or v_link.submitted_at is not null
    or v_link.expires_at <= now() then
    raise exception 'payment_link_unavailable' using errcode = 'P0002';
  end if;
  perform 1 from public.jobs where id = v_link.job_id and status not in ('completed', 'cancelled') for update;
  if not found then raise exception 'payment_link_unavailable' using errcode = 'P0002'; end if;
  if p_language is null or p_language not in ('en', 'is') or p_details is null
    or jsonb_typeof(p_details) <> 'object'
    or coalesce(length(trim(p_details->>'customerName')), 0) not between 2 and 120
    or coalesce(length(trim(p_details->>'customerPhone')), 0) not between 3 and 40
    or coalesce(length(trim(p_details->>'customerNotes')), 0) not between 5 and 4000
    or coalesce(length(trim(p_details->>'locationLabel')), 0) not between 2 and 300
    or (p_details->>'locationSource') is null or (p_details->>'locationSource') not in ('gps', 'map_pin', 'search')
    or (p_details->>'peopleCount') is null or (p_details->>'peopleCount')::integer not between 1 and 99
    or (p_details->>'latitude') is null or (p_details->>'latitude')::numeric not between 62.5 and 67.5
    or (p_details->>'longitude') is null or (p_details->>'longitude')::numeric not between -25.5 and -12
    or not exists(select 1 from public.capabilities where code = p_details->>'requiredCapability') then
    raise exception 'invalid payment draft' using errcode = '22023';
  end if;
  select * into v_draft from public.customer_payment_intakes where customer_intake_link_id = v_link.id;
  if v_draft.id is not null then
    if v_draft.details is distinct from p_details or v_draft.language is distinct from p_language then
      raise exception 'payment_details_locked' using errcode = '22023';
    end if;
    select * into strict v_payment from public.job_payment_requests where id = v_draft.payment_request_id;
    return jsonb_build_object('claimed', false, 'request', to_jsonb(v_payment));
  end if;
  v_result := public.reserve_job_payment_request(v_link.job_id, 'initial_fee', p_environment,
    p_merchant_id, p_provider_api, p_amount_isk, v_link.created_by);
  if (v_result->>'claimed')::boolean is not true then
    raise exception 'payment_details_locked' using errcode = '22023';
  end if;
  insert into public.customer_payment_intakes(customer_intake_link_id, job_id, payment_request_id, details, language)
  values (v_link.id, v_link.job_id, (v_result->'request'->>'id')::uuid, p_details, p_language);
  return v_result;
end;
$$;

-- Preserve the existing server-only write boundary.
revoke all on function public.submit_customer_intake_v3(
  text, text, text, text, text, text, integer, text,
  double precision, double precision, text, public.location_source, text
) from public, anon, authenticated;
grant execute on function public.submit_customer_intake_v3(
  text, text, text, text, text, text, integer, text,
  double precision, double precision, text, public.location_source, text
) to service_role;
revoke all on function public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer) to service_role;
