begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_table(
  'public', 'whatsapp_webhook_events',
  'signed WhatsApp webhook deliveries have a durable inbox'
);
select has_column(
  'public', 'whatsapp_webhook_events', 'payload_sha256',
  'webhook deliveries have an idempotency key'
);
select has_column(
  'public', 'whatsapp_webhook_events', 'payload',
  'the signed webhook envelope is retained for processing'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_webhook_events'::regclass),
  'the webhook inbox uses RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.whatsapp_webhook_events', 'SELECT'),
  'authenticated users can reach the inbox through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_webhook_events', 'INSERT'),
  'authenticated users cannot forge webhook deliveries'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_webhook_events', 'UPDATE'),
  'authenticated users cannot alter webhook deliveries'
);
select ok(
  not has_table_privilege('anon', 'public.whatsapp_webhook_events', 'SELECT'),
  'anonymous users cannot read webhook deliveries'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.whatsapp_webhook_events'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%payload_sha256%'
  ),
  'duplicate webhook request bodies are rejected by the database'
);

set local role service_role;
select lives_ok(
  $$insert into public.whatsapp_webhook_events (
    payload_sha256, waba_id, payload
  ) values (
    repeat('a', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb
  )$$,
  'the webhook function service role can persist a signed delivery'
);
reset role;

create temporary table whatsapp_webhook_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

grant select on whatsapp_webhook_test_identity to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from whatsapp_webhook_test_identity),
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.whatsapp_webhook_events
    where payload_sha256 = repeat('a', 64)
  ),
  1::bigint,
  'staff can audit persisted webhook deliveries'
);

reset role;
update public.profiles
set role = 'driver'
where id = (select id from whatsapp_webhook_test_identity);
set local role authenticated;

select is(
  (select count(*) from public.whatsapp_webhook_events),
  0::bigint,
  'drivers cannot read webhook deliveries'
);

select * from finish();
rollback;
