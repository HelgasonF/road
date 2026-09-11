create table public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  payload_sha256 text not null unique
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  waba_id text
    check (waba_id is null or waba_id ~ '^[0-9]{1,32}$'),
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now()
);

comment on table public.whatsapp_webhook_events is
  'Idempotent inbox of Meta-signed WhatsApp webhook envelopes.';
comment on column public.whatsapp_webhook_events.payload_sha256 is
  'SHA-256 of the exact signed request body, used to deduplicate Meta retries.';

alter table public.whatsapp_webhook_events enable row level security;

revoke all on table public.whatsapp_webhook_events from public, anon, authenticated;
grant select on table public.whatsapp_webhook_events to authenticated;
grant select, insert on table public.whatsapp_webhook_events to service_role;

create policy "Staff can read WhatsApp webhook events"
on public.whatsapp_webhook_events
for select
to authenticated
using ((select public.is_staff()));
