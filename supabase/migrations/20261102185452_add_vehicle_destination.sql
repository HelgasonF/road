-- Optional transport destination; pickup coordinates and existing RPCs stay intact.
alter table public.jobs add column destination_label text
  constraint jobs_destination_label_length check (
    destination_label is null or length(trim(destination_label)) between 1 and 300
  );

-- Existing frozen drafts may omit the key. New drafts may explicitly leave it
-- null/blank, but cannot freeze a non-text or oversized destination.
alter table public.customer_payment_intakes add constraint customer_payment_destination_valid check (
  not (details ? 'destinationLabel') or details->'destinationLabel' = 'null'::jsonb
  or (jsonb_typeof(details->'destinationLabel') = 'string'
    and length(trim(details->>'destinationLabel')) <= 300)
);

-- Reuse the current staff/RLS-guarded save in the same transaction. The original
-- signature remains available and does not overwrite the new column.
create function public.save_job_v2(
  p_id uuid, p_customer_name text, p_customer_phone text,
  p_vehicle_registration text, p_vehicle_make text, p_rental_company text,
  p_people_count integer, p_latitude double precision, p_longitude double precision,
  p_location_label text, p_location_source public.location_source,
  p_priority public.job_priority, p_notes text, p_required_capabilities text[],
  p_destination_label text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if length(trim(p_destination_label)) > 300 then
    raise exception 'invalid vehicle destination' using errcode = '22023';
  end if;
  v_id := public.save_job(p_id, p_customer_name, p_customer_phone,
    p_vehicle_registration, p_vehicle_make, p_rental_company, p_people_count,
    p_latitude, p_longitude, p_location_label, p_location_source, p_priority,
    p_notes, p_required_capabilities);
  update public.jobs set destination_label = nullif(trim(p_destination_label), '') where id = v_id;
  return v_id;
end;
$$;

-- Customer submission stays service-only and uses the original token validation
-- and one-time write. An error in either write rolls back the whole submission.
create function public.submit_customer_intake_v4(
  p_token_hash text, p_customer_name text, p_customer_phone text,
  p_vehicle_registration text, p_vehicle_make text, p_rental_company text,
  p_people_count integer, p_required_capability text,
  p_latitude double precision, p_longitude double precision,
  p_location_label text, p_location_source public.location_source,
  p_customer_notes text, p_destination_label text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if length(trim(p_destination_label)) > 300 then
    raise exception 'invalid vehicle destination' using errcode = '22023';
  end if;
  v_id := public.submit_customer_intake_v3(p_token_hash, p_customer_name,
    p_customer_phone, p_vehicle_registration, p_vehicle_make, p_rental_company,
    p_people_count, p_required_capability, p_latitude, p_longitude,
    p_location_label, p_location_source, p_customer_notes);
  update public.jobs set destination_label = nullif(trim(p_destination_label), '') where id = v_id;
  return v_id;
end;
$$;

revoke all on function public.save_job_v2(uuid,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,public.job_priority,text,text[],text) from public, anon;
grant execute on function public.save_job_v2(uuid,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,public.job_priority,text,text[],text) to authenticated, service_role;
revoke all on function public.submit_customer_intake_v4(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text,text) from public, anon, authenticated;
grant execute on function public.submit_customer_intake_v4(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text,text) to service_role;

-- Only extend the existing verified-Paid finalizer's job fields. It must still
-- complete a checkout begun before link expiry and must not consume a revoked
-- link. A legacy draft without the key preserves an existing destination.
create or replace function public.finalize_paid_customer_intake(p_payment_id uuid)
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
    destination_label = case when d ? 'destinationLabel' then nullif(trim(d->>'destinationLabel'), '') else v_job.destination_label end,
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

revoke all on function public.finalize_paid_customer_intake(uuid) from public, anon, authenticated;
grant execute on function public.finalize_paid_customer_intake(uuid) to service_role;
