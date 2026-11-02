-- Preserve every provider request and its observed status. Superseded is an
-- IRA lifecycle flag, never a claim that myPOS cancelled the hosted checkout.
alter table public.job_payment_requests
  add column superseded_at timestamptz,
  add column replaces_payment_id uuid unique references public.job_payment_requests(id),
  add constraint service_payment_replacement_only check (
    (superseded_at is null and replaces_payment_id is null) or purpose = 'service'
  ),
  add constraint service_payment_replacement_not_self check (replaces_payment_id <> id);
alter table public.job_payment_requests drop constraint job_payment_requests_job_id_purpose_environment_key;
create unique index job_payment_requests_current_key
  on public.job_payment_requests(job_id, purpose, environment) where superseded_at is null;

-- Legacy writers still reserve one current request. The first fee can never be
-- superseded. Keep definite-failure recovery and uncertain-attempt fencing.
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
  if p_purpose = 'service' then
    perform 1 from public.jobs where id = p_job_id for update;
    if exists(select 1 from public.job_payment_requests where job_id = p_job_id
      and purpose = 'service' and environment = p_environment and status = 'paid') then
      raise exception 'payment_already_paid' using errcode = '22023';
    end if;
  end if;
  insert into public.job_payment_requests(id, job_id, purpose, environment, merchant_id, provider_api, amount_isk, reference, created_by)
  values (v_id, p_job_id, p_purpose, p_environment, p_merchant_id, p_provider_api, p_amount_isk, 'IRA-' || v_id::text, p_created_by)
  on conflict (job_id, purpose, environment) where superseded_at is null do nothing;
  v_claimed := found;

  select * into strict v_row from public.job_payment_requests
  where job_id = p_job_id and purpose = p_purpose and environment = p_environment and superseded_at is null for update;
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

-- Explicit staff action only. The expected ID fences stale screens and the
-- unique predecessor makes retries/concurrent clicks reuse one successor.
create function public.replace_service_payment_page(
  p_job_id uuid, p_payment_id uuid, p_amount_isk integer, p_description text,
  p_environment text, p_merchant_id text, p_provider_api text, p_created_by uuid,
  p_token_hash text, p_expires_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_job public.jobs;
  v_old public.job_payment_requests;
  v_next public.job_payment_requests;
  v_page public.job_payment_pages;
  v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_created_by and role in ('admin','dispatcher')) then
    raise exception 'staff required' using errcode='42501';
  end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if v_job.id is null or v_job.intake_pending or v_job.status='cancelled'
    or length(trim(v_job.customer_name))=0 then
    raise exception 'payment_link_unavailable' using errcode='P0002';
  end if;
  if p_amount_isk is null or p_amount_isk <= 0 or p_description is null
    or length(trim(p_description)) not between 3 and 500 or p_expires_at is null
    or p_expires_at <= now() or p_expires_at > now()+interval '24 hours 1 minute' then
    raise exception 'invalid payment page' using errcode='22023';
  end if;
  select * into v_old from public.job_payment_requests where id=p_payment_id for update;
  if v_old.id is null or v_old.job_id<>p_job_id or v_old.purpose<>'service'
    or v_old.environment is distinct from p_environment or v_old.merchant_id is distinct from p_merchant_id
    or v_old.provider_api is distinct from p_provider_api then
    raise exception 'payment_link_unavailable' using errcode='P0002';
  end if;
  if exists(select 1 from public.job_payment_requests where job_id=p_job_id
    and purpose='service' and environment=p_environment and status='paid') then
    raise exception 'payment_already_paid' using errcode='22023';
  end if;
  if v_old.superseded_at is not null then
    select * into v_next from public.job_payment_requests where replaces_payment_id=v_old.id for update;
    select * into v_page from public.job_payment_pages where payment_request_id=v_next.id;
    if v_next.id is null or v_next.superseded_at is not null or v_next.amount_isk<>p_amount_isk
      or v_next.merchant_id<>p_merchant_id or v_next.provider_api<>p_provider_api
      or v_page.description is distinct from trim(p_description) then
      raise exception 'payment_changed' using errcode='22023';
    end if;
    -- Only the existing safe recovery rules may claim a failed successor again.
    return public.prepare_service_payment_page(p_job_id,p_amount_isk,p_description,p_environment,
      p_merchant_id,p_provider_api,p_created_by,p_token_hash,p_expires_at);
  end if;
  if (v_old.provider_code is not null and (v_old.status not in ('pending','seen','failed','expired','cancelled')
      or v_old.last_verified_at is null or v_old.last_verified_at < clock_timestamp()-interval '2 minutes'))
    or (v_old.provider_code is null and (v_old.status<>'creation_failed'
      or v_old.error_code is null or v_old.error_code not in ('payment_provider_rejected','payment_authentication_failed','payment_permission_denied'))) then
    raise exception 'payment_creation_unresolved' using errcode='22023';
  end if;
  select * into v_page from public.job_payment_pages where payment_request_id=v_old.id;
  if v_old.amount_isk=p_amount_isk and v_page.description is not distinct from trim(p_description) then
    raise exception 'payment_details_unchanged' using errcode='22023';
  end if;
  update public.job_payment_requests set superseded_at=clock_timestamp() where id=v_old.id;
  update public.job_payment_pages set expires_at=least(expires_at,clock_timestamp()) where payment_request_id=v_old.id;
  v_result:=public.prepare_service_payment_page(p_job_id,p_amount_isk,p_description,p_environment,
    p_merchant_id,p_provider_api,p_created_by,p_token_hash,p_expires_at);
  update public.job_payment_requests set replaces_payment_id=v_old.id
    where id=(v_result->'request'->>'id')::uuid returning * into v_next;
  return jsonb_build_object('claimed',(v_result->>'claimed')::boolean,'request',to_jsonb(v_next));
end;
$$;
revoke all on function public.replace_service_payment_page(uuid,uuid,integer,text,text,text,text,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.replace_service_payment_page(uuid,uuid,integer,text,text,text,text,uuid,text,timestamptz) to service_role;

-- Existing pending/seen/failed/unknown superseded requests remain in the worker
-- queue. A late Paid observation closes unpaid IRA pages and stays in history.
create or replace function public.record_job_payment_status(
  p_id uuid, p_provider_code text, p_amount_isk integer, p_currency text,
  p_reference text, p_provider_status text, p_status text, p_checked_at timestamptz
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.job_payment_requests;
begin
  -- Service observations and replacements serialize on the job, then payment.
  -- Initial-fee finalization keeps its existing lock order and behavior.
  select * into strict v_row from public.job_payment_requests where id = p_id;
  if v_row.purpose = 'service' then
    perform 1 from public.jobs where id = v_row.job_id for update;
  end if;
  select * into strict v_row from public.job_payment_requests where id = p_id for update;
  if p_provider_code is distinct from v_row.provider_code or v_row.provider_code is null
    or p_amount_isk is distinct from v_row.amount_isk or p_currency is distinct from v_row.currency
    or p_reference is distinct from v_row.reference or p_provider_status is null
    or p_status is null or p_status not in ('pending', 'seen', 'paid', 'failed', 'expired', 'cancelled', 'unknown')
    or p_checked_at is null or p_checked_at > clock_timestamp() + interval '1 minute' then
    raise exception 'provider response mismatch' using errcode = '22023';
  end if;
  if v_row.status = 'paid' then return to_jsonb(v_row); end if;
  -- An older Paid observation is still proof of payment. Other out-of-order
  -- responses must not replace a more recent observation.
  if v_row.last_verified_at > p_checked_at and p_status <> 'paid' then return to_jsonb(v_row); end if;
  update public.job_payment_requests set status = p_status, provider_status = p_provider_status,
    last_verified_at = greatest(coalesce(last_verified_at, p_checked_at), p_checked_at),
    paid_at = case when p_status = 'paid' then clock_timestamp() else null end, error_code = null
  where id = p_id returning * into v_row;
  if v_row.purpose = 'service' and v_row.status = 'paid' then
    update public.job_payment_pages page set expires_at = least(page.expires_at, clock_timestamp())
    from public.job_payment_requests other
    where page.payment_request_id = other.id and other.job_id = v_row.job_id
      and other.purpose = 'service' and other.environment = v_row.environment
      and other.status <> 'paid';
  end if;
  return to_jsonb(v_row);
end;
$$;

