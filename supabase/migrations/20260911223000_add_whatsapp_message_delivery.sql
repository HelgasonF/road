create type public.whatsapp_message_purpose as enum (
  'customer_intake',
  'driver_availability',
  'driver_assignment',
  'test'
);

create type public.whatsapp_outbound_state as enum (
  'queued',
  'sending',
  'accepted',
  'sent',
  'delivered',
  'read',
  'failed',
  'delivery_unknown',
  'cancelled'
);

create type public.whatsapp_delivery_status as enum (
  'sent',
  'delivered',
  'read',
  'failed'
);

create type public.whatsapp_reply_classification as enum (
  'available',
  'unavailable',
  'unknown'
);

create table public.whatsapp_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  purpose public.whatsapp_message_purpose not null,
  job_id uuid references public.jobs (id) on delete restrict,
  operator_id uuid references public.operators (id) on delete restrict,
  customer_intake_link_id uuid references public.customer_intake_links (id) on delete restrict,
  recipient_phone text not null
    check (recipient_phone ~ '^[1-9][0-9]{6,14}$'),
  template_name text not null
    check (length(template_name) between 1 and 512 and template_name ~ '^[a-z0-9_]+$'),
  template_language text not null
    check (template_language ~ '^[A-Za-z]{2,3}(_[A-Za-z]{2})?$'),
  payload_sha256 text not null
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  state public.whatsapp_outbound_state not null default 'queued',
  meta_message_id text unique
    check (meta_message_id is null or length(meta_message_id) between 1 and 255),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  accepted_at timestamptz,
  failure_code text check (failure_code is null or length(failure_code) <= 120),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_outbound_reference_shape check (
    (
      purpose = 'test'
      and job_id is null
      and operator_id is null
      and customer_intake_link_id is null
    )
    or (
      purpose = 'customer_intake'
      and job_id is not null
      and operator_id is null
      and customer_intake_link_id is not null
    )
    or (
      purpose in ('driver_availability', 'driver_assignment')
      and job_id is not null
      and operator_id is not null
      and customer_intake_link_id is null
    )
  ),
  constraint whatsapp_outbound_attempt_timestamps check (
    (attempt_count = 0 and last_attempt_at is null)
    or (attempt_count > 0 and last_attempt_at is not null)
  ),
  constraint whatsapp_outbound_acceptance check (
    (state in ('accepted', 'sent', 'delivered', 'read') and meta_message_id is not null and accepted_at is not null)
    or (state not in ('accepted', 'sent', 'delivered', 'read'))
  )
);

create index whatsapp_outbound_job_time_idx
on public.whatsapp_outbound_messages (job_id, created_at desc)
where job_id is not null;

create index whatsapp_outbound_operator_time_idx
on public.whatsapp_outbound_messages (operator_id, created_at desc)
where operator_id is not null;

create index whatsapp_outbound_recipient_time_idx
on public.whatsapp_outbound_messages (recipient_phone, created_at desc);

create table public.whatsapp_delivery_events (
  id bigint generated always as identity primary key,
  webhook_event_id uuid not null references public.whatsapp_webhook_events (id) on delete restrict,
  outbound_message_id uuid references public.whatsapp_outbound_messages (id) on delete restrict,
  meta_message_id text not null check (length(meta_message_id) between 1 and 255),
  status public.whatsapp_delivery_status not null,
  recipient_phone text check (recipient_phone is null or recipient_phone ~ '^[1-9][0-9]{6,14}$'),
  error_code text check (error_code is null or length(error_code) <= 120),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (meta_message_id, status, occurred_at)
);

create index whatsapp_delivery_outbound_time_idx
on public.whatsapp_delivery_events (outbound_message_id, occurred_at desc)
where outbound_message_id is not null;

create table public.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null references public.whatsapp_webhook_events (id) on delete restrict,
  meta_message_id text not null unique check (length(meta_message_id) between 1 and 255),
  context_message_id text check (context_message_id is null or length(context_message_id) between 1 and 255),
  outbound_message_id uuid references public.whatsapp_outbound_messages (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete restrict,
  operator_id uuid references public.operators (id) on delete restrict,
  waba_id text check (waba_id is null or waba_id ~ '^[0-9]{1,32}$'),
  phone_number_id text check (phone_number_id is null or phone_number_id ~ '^[0-9]{1,32}$'),
  sender_phone text not null check (sender_phone ~ '^[1-9][0-9]{6,14}$'),
  message_type text not null check (message_type ~ '^[a-z_]{1,40}$'),
  text_body text check (text_body is null or length(text_body) <= 4096),
  reply_classification public.whatsapp_reply_classification not null default 'unknown',
  received_at timestamptz not null,
  recorded_at timestamptz not null default now()
);

create index whatsapp_inbound_job_time_idx
on public.whatsapp_inbound_messages (job_id, received_at desc)
where job_id is not null;

create index whatsapp_inbound_sender_time_idx
on public.whatsapp_inbound_messages (sender_phone, received_at desc);

comment on table public.whatsapp_outbound_messages is
  'Idempotent staff-initiated WhatsApp send ledger. Message parameters and bearer links are represented only by payload_sha256 and are never retained here.';
comment on column public.whatsapp_outbound_messages.state is
  'delivery_unknown is terminal for automatic retry because Meta may have accepted the request before the connection failed.';
comment on table public.whatsapp_delivery_events is
  'Normalized sent, delivered, read, and failed updates extracted from signed Meta webhooks.';
comment on table public.whatsapp_inbound_messages is
  'Normalized inbound WhatsApp messages, including non-binding driver availability classifications for dispatcher review.';

alter table public.whatsapp_outbound_messages enable row level security;
alter table public.whatsapp_delivery_events enable row level security;
alter table public.whatsapp_inbound_messages enable row level security;

revoke all on table public.whatsapp_outbound_messages from public, anon, authenticated;
revoke all on table public.whatsapp_delivery_events from public, anon, authenticated;
revoke all on table public.whatsapp_inbound_messages from public, anon, authenticated;

grant select on table public.whatsapp_outbound_messages to authenticated;
grant select on table public.whatsapp_delivery_events to authenticated;
grant select on table public.whatsapp_inbound_messages to authenticated;

grant select, insert, update on table public.whatsapp_outbound_messages to service_role;
grant select, insert on table public.whatsapp_delivery_events to service_role;
grant select, insert on table public.whatsapp_inbound_messages to service_role;
grant usage, select on sequence public.whatsapp_delivery_events_id_seq to service_role;

create policy "Staff can read WhatsApp outbound messages"
on public.whatsapp_outbound_messages
for select to authenticated
using ((select public.is_staff()));

create policy "Staff can read WhatsApp delivery events"
on public.whatsapp_delivery_events
for select to authenticated
using ((select public.is_staff()));

create policy "Staff can read WhatsApp inbound messages"
on public.whatsapp_inbound_messages
for select to authenticated
using ((select public.is_staff()));

create or replace function public.reserve_whatsapp_outbound_message(
  p_idempotency_key uuid,
  p_purpose public.whatsapp_message_purpose,
  p_recipient_phone text,
  p_template_name text,
  p_template_language text,
  p_payload_sha256 text,
  p_job_id uuid default null,
  p_operator_id uuid default null,
  p_customer_intake_link_id uuid default null
)
returns table (
  message_id uuid,
  message_state public.whatsapp_outbound_state,
  meta_message_id text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  was_created boolean := false;
  existing public.whatsapp_outbound_messages%rowtype;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_recipient_phone !~ '^[1-9][0-9]{6,14}$'
    or length(p_template_name) not between 1 and 512
    or p_template_name !~ '^[a-z0-9_]+$'
    or p_template_language !~ '^[A-Za-z]{2,3}(_[A-Za-z]{2})?$'
    or p_payload_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid outbound message metadata';
  end if;

  select * into existing
  from public.whatsapp_outbound_messages message
  where message.idempotency_key = p_idempotency_key;

  if existing.id is not null then
    if existing.purpose is distinct from p_purpose
      or existing.job_id is distinct from p_job_id
      or existing.operator_id is distinct from p_operator_id
      or existing.customer_intake_link_id is distinct from p_customer_intake_link_id
      or existing.recipient_phone is distinct from p_recipient_phone
      or existing.template_name is distinct from p_template_name
      or existing.template_language is distinct from p_template_language
      or existing.payload_sha256 is distinct from p_payload_sha256
    then
      raise exception 'Idempotency key already belongs to a different message' using errcode = '23505';
    end if;

    if existing.state not in ('queued', 'failed') then
      return query select existing.id, existing.state, existing.meta_message_id, false;
      return;
    end if;
  end if;

  if p_purpose = 'test' then
    if p_job_id is not null or p_operator_id is not null or p_customer_intake_link_id is not null then
      raise exception 'Invalid test message references';
    end if;
  elsif p_purpose = 'customer_intake' then
    if p_job_id is null or p_operator_id is not null or p_customer_intake_link_id is null
      or not exists (
        select 1
        from public.customer_intake_links link
        join public.jobs job on job.id = link.job_id
        where link.id = p_customer_intake_link_id
          and link.job_id = p_job_id
          and link.revoked_at is null
          and link.submitted_at is null
          and link.expires_at > now()
          and job.status not in ('completed', 'cancelled')
      )
    then
      raise exception 'Active customer intake link not found' using errcode = 'P0002';
    end if;
  elsif p_purpose = 'driver_availability' then
    if p_job_id is null or p_operator_id is null or p_customer_intake_link_id is not null
      or not exists (
        select 1
        from public.jobs job
        cross join public.operators operator
        where job.id = p_job_id
          and operator.id = p_operator_id
          and operator.is_active
          and not job.intake_pending
          and job.status not in ('completed', 'cancelled')
      )
    then
      raise exception 'Open job and active operator not found' using errcode = 'P0002';
    end if;
  elsif p_purpose = 'driver_assignment' then
    if p_job_id is null or p_operator_id is null or p_customer_intake_link_id is not null
      or not exists (
        select 1
        from public.job_assignments assignment
        join public.jobs job on job.id = assignment.job_id
        join public.operators operator on operator.id = assignment.operator_id
        where assignment.job_id = p_job_id
          and assignment.operator_id = p_operator_id
          and assignment.unassigned_at is null
          and operator.is_active
          and job.status not in ('completed', 'cancelled')
      )
    then
      raise exception 'Current assignment not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.whatsapp_outbound_messages (
    idempotency_key,
    purpose,
    job_id,
    operator_id,
    customer_intake_link_id,
    recipient_phone,
    template_name,
    template_language,
    payload_sha256,
    created_by
  ) values (
    p_idempotency_key,
    p_purpose,
    p_job_id,
    p_operator_id,
    p_customer_intake_link_id,
    p_recipient_phone,
    p_template_name,
    p_template_language,
    p_payload_sha256,
    (select auth.uid())
  )
  on conflict (idempotency_key) do nothing
  returning id into saved_id;

  was_created := saved_id is not null;

  select * into existing
  from public.whatsapp_outbound_messages message
  where message.idempotency_key = p_idempotency_key;

  if existing.id is null then
    raise exception 'Unable to reserve outbound message';
  end if;

  if existing.purpose is distinct from p_purpose
    or existing.job_id is distinct from p_job_id
    or existing.operator_id is distinct from p_operator_id
    or existing.customer_intake_link_id is distinct from p_customer_intake_link_id
    or existing.recipient_phone is distinct from p_recipient_phone
    or existing.template_name is distinct from p_template_name
    or existing.template_language is distinct from p_template_language
    or existing.payload_sha256 is distinct from p_payload_sha256
  then
    raise exception 'Idempotency key already belongs to a different message' using errcode = '23505';
  end if;

  return query select existing.id, existing.state, existing.meta_message_id, was_created;
end;
$$;

create or replace function public.ingest_whatsapp_webhook_event(
  p_payload_sha256 text,
  p_waba_id text,
  p_payload jsonb,
  p_statuses jsonb default '[]'::jsonb,
  p_messages jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_event_id uuid;
  status_record record;
begin
  if p_payload_sha256 !~ '^[0-9a-f]{64}$'
    or (p_waba_id is not null and p_waba_id !~ '^[0-9]{1,32}$')
    or jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_statuses) <> 'array'
    or jsonb_typeof(p_messages) <> 'array'
  then
    raise exception 'Invalid WhatsApp webhook event';
  end if;

  insert into public.whatsapp_webhook_events (
    payload_sha256,
    waba_id,
    payload
  ) values (
    p_payload_sha256,
    p_waba_id,
    p_payload
  )
  on conflict (payload_sha256) do update
  set payload_sha256 = excluded.payload_sha256
  returning id into saved_event_id;

  insert into public.whatsapp_delivery_events (
    webhook_event_id,
    outbound_message_id,
    meta_message_id,
    status,
    recipient_phone,
    error_code,
    occurred_at
  )
  select
    saved_event_id,
    outbound.id,
    normalized.message_id,
    normalized.status::public.whatsapp_delivery_status,
    normalized.recipient_phone,
    normalized.error_code,
    normalized.occurred_at::timestamptz
  from jsonb_to_recordset(p_statuses) as normalized(
    message_id text,
    status text,
    recipient_phone text,
    error_code text,
    occurred_at text
  )
  left join public.whatsapp_outbound_messages outbound
    on outbound.meta_message_id = normalized.message_id
  where normalized.message_id is not null
    and normalized.status in ('sent', 'delivered', 'read', 'failed')
    and normalized.occurred_at is not null
  on conflict (meta_message_id, status, occurred_at) do nothing;

  for status_record in
    select
      normalized.message_id,
      normalized.status,
      normalized.error_code,
      normalized.occurred_at::timestamptz as occurred_at
    from jsonb_to_recordset(p_statuses) as normalized(
      message_id text,
      status text,
      recipient_phone text,
      error_code text,
      occurred_at text
    )
    where normalized.message_id is not null
      and normalized.status in ('sent', 'delivered', 'read', 'failed')
      and normalized.occurred_at is not null
    order by normalized.occurred_at::timestamptz
  loop
    update public.whatsapp_outbound_messages outbound
    set
      state = case
        when status_record.status = 'failed' and outbound.state not in ('delivered', 'read')
          then 'failed'::public.whatsapp_outbound_state
        when status_record.status = 'read'
          then 'read'::public.whatsapp_outbound_state
        when status_record.status = 'delivered' and outbound.state not in ('read')
          then 'delivered'::public.whatsapp_outbound_state
        when status_record.status = 'sent' and outbound.state in ('accepted', 'sending', 'queued')
          then 'sent'::public.whatsapp_outbound_state
        else outbound.state
      end,
      failure_code = case
        when status_record.status = 'failed' and outbound.state not in ('delivered', 'read')
          then status_record.error_code
        when status_record.status in ('sent', 'delivered', 'read')
          then null
        else outbound.failure_code
      end,
      updated_at = greatest(outbound.updated_at, status_record.occurred_at)
    where outbound.meta_message_id = status_record.message_id;
  end loop;

  insert into public.whatsapp_inbound_messages (
    webhook_event_id,
    meta_message_id,
    context_message_id,
    outbound_message_id,
    job_id,
    operator_id,
    waba_id,
    phone_number_id,
    sender_phone,
    message_type,
    text_body,
    reply_classification,
    received_at
  )
  select
    saved_event_id,
    normalized.message_id,
    normalized.context_message_id,
    related.id,
    related.job_id,
    related.operator_id,
    p_waba_id,
    normalized.phone_number_id,
    normalized.sender_phone,
    normalized.message_type,
    normalized.text_body,
    normalized.reply_classification::public.whatsapp_reply_classification,
    normalized.received_at::timestamptz
  from jsonb_to_recordset(p_messages) as normalized(
    message_id text,
    context_message_id text,
    phone_number_id text,
    sender_phone text,
    message_type text,
    text_body text,
    reply_classification text,
    received_at text
  )
  left join lateral (
    select outbound.id, outbound.job_id, outbound.operator_id
    from public.whatsapp_outbound_messages outbound
    where (
      normalized.context_message_id is not null
      and outbound.meta_message_id = normalized.context_message_id
    ) or (
      normalized.context_message_id is null
      and outbound.recipient_phone = normalized.sender_phone
      and outbound.purpose = 'driver_availability'
      and outbound.created_at >= normalized.received_at::timestamptz - interval '24 hours'
      and outbound.created_at <= normalized.received_at::timestamptz
      and outbound.state in ('accepted', 'sent', 'delivered', 'read')
    )
    order by
      (outbound.meta_message_id = normalized.context_message_id) desc,
      outbound.created_at desc
    limit 1
  ) related on true
  where normalized.message_id is not null
    and normalized.sender_phone ~ '^[1-9][0-9]{6,14}$'
    and normalized.message_type ~ '^[a-z_]{1,40}$'
    and normalized.reply_classification in ('available', 'unavailable', 'unknown')
    and normalized.received_at is not null
  on conflict (meta_message_id) do nothing;

  return saved_event_id;
end;
$$;

create or replace function public.claim_whatsapp_outbound_message(
  p_message_id uuid,
  p_payload_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  update public.whatsapp_outbound_messages message
  set
    state = 'sending',
    attempt_count = message.attempt_count + 1,
    last_attempt_at = now(),
    failure_code = null,
    updated_at = now()
  where message.id = p_message_id
    and message.payload_sha256 = p_payload_sha256
    and message.state in ('queued', 'failed')
  returning message.id into claimed_id;

  return claimed_id is not null;
end;
$$;

create or replace function public.accept_whatsapp_outbound_message(
  p_message_id uuid,
  p_meta_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_id uuid;
  delivery_record record;
begin
  if length(p_meta_message_id) not between 1 and 255 then
    raise exception 'Invalid Meta message ID';
  end if;

  update public.whatsapp_outbound_messages message
  set
    state = 'accepted',
    meta_message_id = p_meta_message_id,
    accepted_at = now(),
    failure_code = null,
    updated_at = now()
  where message.id = p_message_id
    and message.state = 'sending'
  returning message.id into accepted_id;

  if accepted_id is null then
    return false;
  end if;

  update public.whatsapp_delivery_events event
  set outbound_message_id = accepted_id
  where event.meta_message_id = p_meta_message_id
    and event.outbound_message_id is null;

  update public.whatsapp_inbound_messages inbound
  set
    outbound_message_id = accepted_id,
    job_id = outbound.job_id,
    operator_id = outbound.operator_id
  from public.whatsapp_outbound_messages outbound
  where outbound.id = accepted_id
    and inbound.context_message_id = p_meta_message_id
    and inbound.outbound_message_id is null;

  select event.status, event.error_code, event.occurred_at
  into delivery_record
  from public.whatsapp_delivery_events event
  where event.outbound_message_id = accepted_id
  order by
    case event.status
      when 'read' then 4
      when 'delivered' then 3
      when 'failed' then 2
      when 'sent' then 1
    end desc,
    event.occurred_at desc
  limit 1;

  if delivery_record.status is not null then
    update public.whatsapp_outbound_messages message
    set
      state = delivery_record.status::text::public.whatsapp_outbound_state,
      failure_code = case
        when delivery_record.status = 'failed' then delivery_record.error_code
        else null
      end,
      updated_at = greatest(message.updated_at, delivery_record.occurred_at)
    where message.id = accepted_id;
  end if;

  return true;
end;
$$;

revoke all on function public.reserve_whatsapp_outbound_message(
  uuid,
  public.whatsapp_message_purpose,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid
) from public, anon;

revoke all on function public.ingest_whatsapp_webhook_event(
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

revoke all on function public.claim_whatsapp_outbound_message(uuid, text)
from public, anon, authenticated;

revoke all on function public.accept_whatsapp_outbound_message(uuid, text)
from public, anon, authenticated;

grant execute on function public.reserve_whatsapp_outbound_message(
  uuid,
  public.whatsapp_message_purpose,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid
) to authenticated;

grant execute on function public.ingest_whatsapp_webhook_event(
  text,
  text,
  jsonb,
  jsonb,
  jsonb
) to service_role;

grant execute on function public.claim_whatsapp_outbound_message(uuid, text)
to service_role;

grant execute on function public.accept_whatsapp_outbound_message(uuid, text)
to service_role;
