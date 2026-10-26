-- No charges or retries run in this migration. A subsequent explicit customer
-- or staff action may claim a definitively rejected creation exactly once.
alter table public.job_payment_requests
  add column creation_started_at timestamptz not null default now(),
  add column creation_diagnostics jsonb not null default '{}' check (jsonb_typeof(creation_diagnostics) = 'object'),
  add column creation_history jsonb not null default '[]' check (jsonb_typeof(creation_history) = 'array');

create or replace function public.reserve_job_payment_request(
  p_job_id uuid, p_purpose text, p_environment text, p_merchant_id text,
  p_provider_api text, p_amount_isk integer, p_created_by uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_row public.job_payment_requests;
  v_claimed boolean;
begin
  if not exists (select 1 from public.profiles where id = p_created_by and role in ('admin', 'dispatcher')) then
    raise exception 'staff required' using errcode = '42501';
  end if;
  insert into public.job_payment_requests(id, job_id, purpose, environment, merchant_id, provider_api, amount_isk, reference, created_by)
  values (v_id, p_job_id, p_purpose, p_environment, p_merchant_id, p_provider_api, p_amount_isk, 'IRA-' || v_id::text, p_created_by)
  on conflict (job_id, purpose, environment) do nothing;
  v_claimed := found;

  select * into strict v_row from public.job_payment_requests
  where job_id = p_job_id and purpose = p_purpose and environment = p_environment for update;
  if not v_claimed and v_row.status = 'creation_failed'
    and v_row.provider_code is null and v_row.payment_url is null
    and v_row.error_code in ('payment_provider_rejected', 'payment_authentication_failed', 'payment_permission_denied')
    and v_row.merchant_id = p_merchant_id and v_row.provider_api = p_provider_api
    and v_row.amount_isk = p_amount_isk then
    -- Preserve failures recorded by the old finish RPC too. The opaque reference
    -- changes per attempt and fences late completion of a previous attempt.
    if not (v_row.creation_history @> jsonb_build_array(jsonb_build_object('reference', v_row.reference))) then
      v_row.creation_history := v_row.creation_history || jsonb_build_array(jsonb_build_object(
        'reference', v_row.reference, 'status', v_row.status, 'error_code', v_row.error_code,
        'diagnostics', v_row.creation_diagnostics, 'archived_at', clock_timestamp()));
    end if;
    update public.job_payment_requests set status = 'creating', reference = 'IRA-' || gen_random_uuid()::text,
      error_code = null, creation_diagnostics = '{}', creation_history = v_row.creation_history,
      creation_started_at = clock_timestamp()
    where id = v_row.id returning * into v_row;
    v_claimed := true;
  end if;
  return jsonb_build_object('claimed', v_claimed, 'request', to_jsonb(v_row));
end;
$$;

create function public.finish_job_payment_creation_v2(
  p_id uuid, p_reference text, p_provider_code text, p_payment_url text,
  p_status text, p_error_code text, p_diagnostics jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.job_payment_requests;
begin
  if jsonb_typeof(p_diagnostics) is distinct from 'object'
    or (p_diagnostics - array['httpStatus','providerCode','requestId']) <> '{}'::jsonb
    or (p_diagnostics ? 'httpStatus' and coalesce((p_diagnostics->>'httpStatus') !~ '^[1-5][0-9]{2}$',true))
    or (p_diagnostics ? 'providerCode' and coalesce((p_diagnostics->>'providerCode') !~ '^[0-9]{1,8}$',true))
    or (p_diagnostics ? 'requestId' and coalesce((p_diagnostics->>'requestId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',true)) then
    raise exception 'invalid payment diagnostics' using errcode = '22023';
  end if;
  select * into strict v_row from public.job_payment_requests where id = p_id for update;
  if v_row.status <> 'creating' or v_row.reference is distinct from p_reference then return to_jsonb(v_row); end if;
  perform public.finish_job_payment_creation(p_id, p_provider_code, p_payment_url, p_status, p_error_code);
  update public.job_payment_requests set creation_diagnostics = p_diagnostics,
    creation_history = creation_history || jsonb_build_array(jsonb_build_object(
      'reference', p_reference, 'started_at', creation_started_at, 'finished_at', clock_timestamp(),
      'status', p_status, 'error_code', p_error_code, 'diagnostics', p_diagnostics))
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
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
begin
  select * into v_link from public.customer_intake_links where token_hash = p_token_hash for update;
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
  if v_draft.id is not null and (v_draft.details is distinct from p_details or v_draft.language is distinct from p_language) then
    raise exception 'payment_details_locked' using errcode = '22023';
  end if;
  v_result := public.reserve_job_payment_request(v_link.job_id, 'initial_fee', p_environment,
    p_merchant_id, p_provider_api, p_amount_isk, v_link.created_by);
  if v_draft.id is not null then return v_result; end if;
  if (v_result->>'claimed')::boolean is not true then
    raise exception 'payment_creation_unresolved' using errcode = '22023';
  end if;
  -- Rebind a definitively failed draft to the replacement active link. An
  -- existing checkout, Paid result or uncertain attempt can never reach here.
  insert into public.customer_payment_intakes(customer_intake_link_id, job_id, payment_request_id, details, language)
  values (v_link.id, v_link.job_id, (v_result->'request'->>'id')::uuid, p_details, p_language)
  on conflict (payment_request_id) do update set customer_intake_link_id = excluded.customer_intake_link_id,
    details = excluded.details, language = excluded.language;
  return v_result;
end;
$$;

revoke all on function public.finish_job_payment_creation_v2(uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.finish_job_payment_creation_v2(uuid,text,text,text,text,text,jsonb) to service_role;
revoke all on function public.reserve_job_payment_request(uuid,text,text,text,text,integer,uuid) from public, anon, authenticated;
grant execute on function public.reserve_job_payment_request(uuid,text,text,text,text,integer,uuid) to service_role;
revoke all on function public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer) to service_role;
