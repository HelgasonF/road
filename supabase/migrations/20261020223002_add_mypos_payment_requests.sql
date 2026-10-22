-- Collection attempts are children of the existing billing record, not a
-- second invoice/settlement ledger. No job or billing transitions are changed.
create table public.job_payment_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_billing(job_id) on delete cascade,
  purpose text not null check (purpose in ('initial_fee', 'service')),
  provider text not null default 'mypos' check (provider = 'mypos'),
  environment text not null check (environment in ('sandbox', 'production')),
  merchant_id text not null check (length(merchant_id) between 1 and 500),
  provider_api text not null check (length(provider_api) between 1 and 500),
  amount_isk integer not null check (amount_isk > 0),
  currency text not null default 'ISK' check (currency = 'ISK'),
  reference text not null unique check (length(reference) between 1 and 120),
  provider_code text check (provider_code ~ '^[A-Za-z0-9_-]{1,128}$'),
  payment_url text check (length(payment_url) <= 2048 and payment_url ~ '^https://'),
  status text not null default 'creating' check (status in (
    'creating', 'creation_unknown', 'creation_failed', 'pending', 'seen',
    'paid', 'failed', 'expired', 'cancelled', 'unknown'
  )),
  provider_status text check (provider_status ~ '^[A-Za-z0-9_]{1,64}$'),
  error_code text check (error_code ~ '^[a-z_]{1,80}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  paid_at timestamptz,
  -- Changing credentials/merchants must not silently create a second charge.
  unique (job_id, purpose, environment),
  unique (environment, merchant_id, provider_code),
  check ((provider_code is null) = (payment_url is null)),
  check (status <> 'paid' or (provider_code is not null and provider_status is not null and paid_at is not null))
);

create index job_payment_requests_created_by_idx on public.job_payment_requests(created_by);
create index job_payment_requests_pending_idx on public.job_payment_requests(environment, last_verified_at)
where provider_code is not null and status in ('pending', 'seen', 'failed', 'unknown');

alter table public.job_payment_requests enable row level security;
revoke all on public.job_payment_requests from public, anon, authenticated;
grant select on public.job_payment_requests to authenticated;
grant select, insert, update on public.job_payment_requests to service_role;
create policy "staff read job payment requests" on public.job_payment_requests
for select to authenticated using ((select public.is_staff()));

-- Only server-side code may reserve a request. The unique key arbitrates
-- concurrent clicks before any external POST; uncertain attempts stay reserved.
create function public.reserve_job_payment_request(
  p_job_id uuid, p_purpose text, p_environment text, p_merchant_id text,
  p_provider_api text, p_amount_isk integer, p_created_by uuid
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
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
  where job_id = p_job_id and purpose = p_purpose and environment = p_environment;
  return jsonb_build_object('claimed', v_claimed, 'request', to_jsonb(v_row));
end;
$$;

-- One guarded write persists either the exact create response or a safe error
-- classification. A failed DB response never releases the reservation.
create function public.finish_job_payment_creation(
  p_id uuid, p_provider_code text, p_payment_url text, p_status text, p_error_code text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.job_payment_requests;
begin
  if p_status not in ('pending', 'creation_unknown', 'creation_failed') or p_status is null
    or (p_status = 'pending' and (p_provider_code is null or p_payment_url is null))
    or (p_status <> 'pending' and (p_provider_code is not null or p_payment_url is not null)) then
    raise exception 'invalid creation result' using errcode = '22023';
  end if;
  select * into strict v_row from public.job_payment_requests where id = p_id for update;
  if v_row.status <> 'creating' then return to_jsonb(v_row); end if;
  update public.job_payment_requests set provider_code = p_provider_code, payment_url = p_payment_url,
    status = p_status, error_code = p_error_code
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- The server supplies a freshly fetched provider response. Match code, amount,
-- currency and reference before trusting Paid. Serialize writes and retain Paid.
create function public.record_job_payment_status(
  p_id uuid, p_provider_code text, p_amount_isk integer, p_currency text,
  p_reference text, p_provider_status text, p_status text, p_checked_at timestamptz
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.job_payment_requests;
begin
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
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.reserve_job_payment_request(uuid,text,text,text,text,integer,uuid) from public, anon, authenticated;
revoke all on function public.finish_job_payment_creation(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.record_job_payment_status(uuid,text,integer,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.reserve_job_payment_request(uuid,text,text,text,text,integer,uuid) to service_role;
grant execute on function public.finish_job_payment_creation(uuid,text,text,text,text) to service_role;
grant execute on function public.record_job_payment_status(uuid,text,integer,text,text,text,text,timestamptz) to service_role;
