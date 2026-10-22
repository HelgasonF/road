-- Customer checkout is enabled separately in application configuration. This
-- migration does not schedule work, enable payment creation or send messages.
alter table public.job_payment_requests add column next_check_at timestamptz not null default now();
create index job_payment_requests_due_idx on public.job_payment_requests(next_check_at, created_at)
where provider_code is not null;

create table public.customer_payment_intakes (
  id uuid primary key default gen_random_uuid(),
  customer_intake_link_id uuid not null unique references public.customer_intake_links(id) on delete cascade,
  job_id uuid not null references public.job_billing(job_id) on delete cascade,
  payment_request_id uuid not null unique references public.job_payment_requests(id) on delete cascade,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  language text not null check (language in ('en', 'is')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  review_required boolean not null default false
);
create index customer_payment_intakes_job_idx on public.customer_payment_intakes(job_id);
alter table public.customer_payment_intakes enable row level security;
revoke all on public.customer_payment_intakes from public, anon, authenticated;
grant select, insert, update on public.customer_payment_intakes to service_role;

create table public.job_payment_pages (
  payment_request_id uuid primary key references public.job_payment_requests(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  description text not null check (length(trim(description)) between 3 and 500),
  vehicle_registration text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.job_payment_pages enable row level security;
revoke all on public.job_payment_pages from public, anon, authenticated;
grant select, insert, update on public.job_payment_pages to service_role;

-- Reserve the payment and freeze its full validated draft in the same
-- transaction, before the application makes a non-retryable creation POST.
create function public.prepare_customer_payment_intake(
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
    or (p_details->>'locationSource') is null or (p_details->>'locationSource') not in ('gps', 'map_pin')
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

create function public.prepare_service_payment_page(
  p_job_id uuid, p_amount_isk integer, p_description text, p_environment text,
  p_merchant_id text, p_provider_api text, p_created_by uuid,
  p_token_hash text, p_expires_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_job public.jobs;
  v_page public.job_payment_pages;
  v_result jsonb;
  v_payment_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null or v_job.intake_pending or v_job.status = 'cancelled'
    or length(trim(v_job.customer_name)) = 0 then
    raise exception 'payment_link_unavailable' using errcode = 'P0002';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '24 hours 1 minute'
    or p_description is null or length(trim(p_description)) not between 3 and 500 then
    raise exception 'invalid payment page' using errcode = '22023';
  end if;
  v_result := public.reserve_job_payment_request(p_job_id, 'service', p_environment,
    p_merchant_id, p_provider_api, p_amount_isk, p_created_by);
  if (v_result->'request'->>'amount_isk')::integer is distinct from p_amount_isk
    or v_result->'request'->>'merchant_id' is distinct from p_merchant_id
    or v_result->'request'->>'provider_api' is distinct from p_provider_api then
    raise exception 'payment_details_locked' using errcode = '22023';
  end if;
  v_payment_id := (v_result->'request'->>'id')::uuid;
  select * into v_page from public.job_payment_pages where payment_request_id = v_payment_id;
  if v_page.payment_request_id is not null and v_page.description is distinct from trim(p_description) then
    raise exception 'payment_details_locked' using errcode = '22023';
  end if;
  insert into public.job_payment_pages(payment_request_id, token_hash, description, vehicle_registration, expires_at)
  values (v_payment_id, p_token_hash, trim(p_description), v_job.vehicle_registration, p_expires_at)
  on conflict(payment_request_id) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at;
  return v_result;
end;
$$;

-- Each worker leases a small fair batch, so overlapping invocations do not
-- hammer the provider and a failing oldest request cannot starve later jobs.
create function public.claim_due_job_payments(p_environment text, p_merchant_id text, p_provider_api text)
returns setof public.job_payment_requests language sql security invoker set search_path = '' as $$
  with due as (
    select p.id from public.job_payment_requests p
    where p.environment = p_environment and p.merchant_id = p_merchant_id and p.provider_api = p_provider_api
      and p.provider_code is not null and p.next_check_at <= now()
      and (p.status in ('pending', 'seen', 'failed', 'unknown')
        or (p.status = 'paid' and exists (
          select 1 from public.customer_payment_intakes d where d.payment_request_id = p.id
            and d.completed_at is null and not d.review_required
        )))
    order by p.next_check_at, p.created_at limit 10 for update of p skip locked
  )
  update public.job_payment_requests p set next_check_at = now() + interval '1 minute'
  from due where p.id = due.id returning p.*;
$$;

-- No browser callback or return is required. The worker records verified Paid
-- first, then applies the exact frozen draft atomically and only once. Expiry
-- after starting checkout does not discard a legitimate completed payment.
create function public.finalize_paid_customer_intake(p_payment_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_draft public.customer_payment_intakes;
  v_link public.customer_intake_links;
  v_payment public.job_payment_requests;
  v_job public.jobs;
  d jsonb;
begin
  select * into v_draft from public.customer_payment_intakes where payment_request_id = p_payment_id;
  if v_draft.id is null then return 'none'; end if;
  select * into strict v_link from public.customer_intake_links where id = v_draft.customer_intake_link_id for update;
  select * into strict v_job from public.jobs where id = v_draft.job_id for update;
  select * into strict v_payment from public.job_payment_requests where id = p_payment_id for update;
  select * into strict v_draft from public.customer_payment_intakes where payment_request_id = p_payment_id for update;
  if v_draft.completed_at is not null then return 'submitted'; end if;
  if v_payment.status <> 'paid' or v_payment.paid_at is null or v_payment.provider_code is null
    or v_payment.provider_status is null or v_payment.purpose <> 'initial_fee'
    or v_payment.job_id <> v_draft.job_id or v_link.job_id <> v_draft.job_id then return 'not_ready'; end if;
  if v_draft.review_required or v_link.revoked_at is not null or v_link.submitted_at is not null
    or v_job.status in ('completed', 'cancelled') then
    update public.customer_payment_intakes set review_required = true where id = v_draft.id;
    return 'review_required';
  end if;
  d := v_draft.details;
  update public.jobs set customer_name = d->>'customerName', customer_phone = d->>'customerPhone',
    vehicle_registration = nullif(d->>'vehicleRegistration', ''), vehicle_make = nullif(d->>'vehicleMake', ''),
    rental_company = nullif(d->>'rentalCompany', ''), people_count = (d->>'peopleCount')::integer,
    latitude = (d->>'latitude')::double precision, longitude = (d->>'longitude')::double precision,
    location_label = d->>'locationLabel', location_source = (d->>'locationSource')::public.location_source,
    customer_notes = d->>'customerNotes', customer_intake_submitted_at = now(), intake_pending = false
  where id = v_draft.job_id;
  delete from public.job_required_capabilities where job_id = v_draft.job_id;
  insert into public.job_required_capabilities(job_id, capability_code) values(v_draft.job_id, d->>'requiredCapability');
  update public.customer_intake_links set submitted_at = now() where id = v_link.id;
  update public.customer_payment_intakes set completed_at = now() where id = v_draft.id;
  return 'submitted';
end;
$$;

revoke all on function public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.prepare_service_payment_page(uuid,integer,text,text,text,text,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.claim_due_job_payments(text,text,text) from public, anon, authenticated;
revoke all on function public.finalize_paid_customer_intake(uuid) from public, anon, authenticated;
grant execute on function public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer) to service_role;
grant execute on function public.prepare_service_payment_page(uuid,integer,text,text,text,text,uuid,text,timestamptz) to service_role;
grant execute on function public.claim_due_job_payments(text,text,text) to service_role;
grant execute on function public.finalize_paid_customer_intake(uuid) to service_role;
