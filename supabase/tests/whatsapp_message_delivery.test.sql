begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

select has_table(
  'public', 'whatsapp_outbound_messages',
  'outbound WhatsApp requests have an idempotent ledger'
);
select has_table(
  'public', 'whatsapp_delivery_events',
  'Meta delivery updates have a normalized event table'
);
select has_table(
  'public', 'whatsapp_inbound_messages',
  'inbound WhatsApp replies have a normalized table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_outbound_messages'::regclass),
  'the outbound ledger uses RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_delivery_events'::regclass),
  'delivery events use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_inbound_messages'::regclass),
  'inbound messages use RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_outbound_messages', 'INSERT'),
  'authenticated users cannot bypass the outbound reservation RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_delivery_events', 'INSERT'),
  'authenticated users cannot forge delivery updates'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_inbound_messages', 'INSERT'),
  'authenticated users cannot forge inbound messages'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.reserve_whatsapp_outbound_message(uuid,public.whatsapp_message_purpose,text,text,text,text,uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'staff callers can reach the outbound reservation RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_whatsapp_webhook_event(text,text,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers cannot invoke the signed webhook ingestion RPC'
);

create temporary table whatsapp_delivery_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

grant select on whatsapp_delivery_test_identity to authenticated, service_role;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from whatsapp_delivery_test_identity),
  true
);
set local role authenticated;

select lives_ok(
  $$select * from public.reserve_whatsapp_outbound_message(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'test',
    '3546597003',
    'hello_world',
    'en_US',
    repeat('a', 64)
  )$$,
  'staff can reserve a valid test message'
);

select is(
  (
    select count(*)
    from public.whatsapp_outbound_messages
    where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  1::bigint,
  'one reservation creates one outbound record'
);

select is(
  (
    select created
    from public.reserve_whatsapp_outbound_message(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'test',
      '3546597003',
      'hello_world',
      'en_US',
      repeat('a', 64)
    )
  ),
  false,
  'repeating an identical idempotency key returns the existing message'
);

select throws_ok(
  $$select * from public.reserve_whatsapp_outbound_message(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'test',
    '3546597004',
    'hello_world',
    'en_US',
    repeat('a', 64)
  )$$,
  '23505',
  'Idempotency key already belongs to a different message',
  'an idempotency key cannot be reused for a different recipient'
);

reset role;

set local role service_role;
select ok(
  public.claim_whatsapp_outbound_message(
    (
      select id
      from public.whatsapp_outbound_messages
      where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    ),
    repeat('a', 64)
  ),
  'the sender can atomically claim a queued message'
);

select is(
  (
    select jsonb_build_object(
      'state', state,
      'attempts', attempt_count,
      'attempted', last_attempt_at is not null
    )
    from public.whatsapp_outbound_messages
    where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  jsonb_build_object('state', 'sending', 'attempts', 1, 'attempted', true),
  'claiming changes state and attempt metadata together'
);

select ok(
  public.accept_whatsapp_outbound_message(
    (
      select id
      from public.whatsapp_outbound_messages
      where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    ),
    'wamid.outbound-test-1'
  ),
  'the sender records Meta acceptance through one narrow transition'
);

select lives_ok(
  $$select public.ingest_whatsapp_webhook_event(
    repeat('b', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb,
    '[{
      "message_id":"wamid.outbound-test-1",
      "status":"delivered",
      "recipient_phone":"3546597003",
      "error_code":null,
      "occurred_at":"2026-09-11T22:00:00.000Z"
    }]'::jsonb,
    '[{
      "message_id":"wamid.inbound-test-1",
      "context_message_id":"wamid.outbound-test-1",
      "phone_number_id":"1251932438011191",
      "sender_phone":"3546597003",
      "message_type":"text",
      "text_body":"Laus",
      "reply_classification":"available",
      "received_at":"2026-09-11T22:01:00.000Z"
    }]'::jsonb
  )$$,
  'the service role atomically ingests a signed normalized webhook'
);

select is(
  (
    select state::text
    from public.whatsapp_outbound_messages
    where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  'delivered',
  'a delivery webhook advances the outbound message state'
);

select is(
  (
    select to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    from public.whatsapp_delivery_events
    where meta_message_id = 'wamid.outbound-test-1'
  ),
  '2026-09-11 22:00:00',
  'Meta Unix time is retained as a timezone-aware instant'
);

select is(
  (
    select jsonb_build_object(
      'classification', reply_classification,
      'linked', outbound_message_id is not null,
      'body', text_body
    )
    from public.whatsapp_inbound_messages
    where meta_message_id = 'wamid.inbound-test-1'
  ),
  jsonb_build_object('classification', 'available', 'linked', true, 'body', 'Laus'),
  'a structured driver reply is linked for dispatcher review'
);

select lives_ok(
  $$select public.ingest_whatsapp_webhook_event(
    repeat('b', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb,
    '[{
      "message_id":"wamid.outbound-test-1",
      "status":"delivered",
      "recipient_phone":"3546597003",
      "error_code":null,
      "occurred_at":"2026-09-11T22:00:00.000Z"
    }]'::jsonb,
    '[{
      "message_id":"wamid.inbound-test-1",
      "context_message_id":"wamid.outbound-test-1",
      "phone_number_id":"1251932438011191",
      "sender_phone":"3546597003",
      "message_type":"text",
      "text_body":"Laus",
      "reply_classification":"available",
      "received_at":"2026-09-11T22:01:00.000Z"
    }]'::jsonb
  )$$,
  'a retried webhook envelope remains idempotent'
);

select is(
  (select count(*) from public.whatsapp_delivery_events),
  1::bigint,
  'delivery-event retries do not create duplicates'
);
select is(
  (select count(*) from public.whatsapp_inbound_messages),
  1::bigint,
  'inbound-message retries do not create duplicates'
);

update public.whatsapp_outbound_messages
set state = 'failed', failure_code = '131049'
where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

select ok(
  not public.claim_whatsapp_outbound_message(
    (
      select id
      from public.whatsapp_outbound_messages
      where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    ),
    repeat('a', 64)
  ),
  'a provider-accepted message that later failed cannot overwrite its Meta message ID on retry'
);

insert into public.whatsapp_outbound_messages (
  idempotency_key,
  purpose,
  recipient_phone,
  template_name,
  template_language,
  payload_sha256,
  state,
  attempt_count,
  last_attempt_at,
  created_by
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'test',
  '3546597004',
  'hello_world',
  'en_US',
  repeat('c', 64),
  'sending',
  1,
  '2026-09-11T22:05:00Z',
  (select id from whatsapp_delivery_test_identity)
);

select lives_ok(
  $$select public.ingest_whatsapp_webhook_event(
    repeat('d', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb,
    '[{
      "message_id":"wamid.racing-delivery-1",
      "status":"delivered",
      "recipient_phone":"3546597004",
      "error_code":null,
      "occurred_at":"2026-09-11T22:06:00.000Z"
    }]'::jsonb,
    '[{
      "message_id":"wamid.racing-reply-1",
      "context_message_id":"wamid.racing-delivery-1",
      "phone_number_id":"1251932438011191",
      "sender_phone":"3546597004",
      "message_type":"text",
      "text_body":"Ekki laus",
      "reply_classification":"unavailable",
      "received_at":"2026-09-11T22:07:00.000Z"
    }]'::jsonb
  )$$,
  'a webhook may arrive before the Meta acceptance response is persisted'
);

select ok(
  public.accept_whatsapp_outbound_message(
    (
      select id
      from public.whatsapp_outbound_messages
      where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    ),
    'wamid.racing-delivery-1'
  ),
  'late acceptance persistence backfills early webhook relationships'
);

select is(
  (
    select jsonb_build_object(
      'state', outbound.state,
      'delivery_linked', delivery.outbound_message_id = outbound.id,
      'reply_linked', inbound.outbound_message_id = outbound.id
    )
    from public.whatsapp_outbound_messages outbound
    join public.whatsapp_delivery_events delivery
      on delivery.meta_message_id = 'wamid.racing-delivery-1'
    join public.whatsapp_inbound_messages inbound
      on inbound.meta_message_id = 'wamid.racing-reply-1'
    where outbound.idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
  ),
  jsonb_build_object(
    'state', 'delivered',
    'delivery_linked', true,
    'reply_linked', true
  ),
  'early delivery and reply records are linked without losing the delivered state'
);

reset role;
update public.profiles
set role = 'driver'
where id = (select id from whatsapp_delivery_test_identity);
set local role authenticated;

select is(
  (select count(*) from public.whatsapp_outbound_messages),
  0::bigint,
  'drivers cannot read outbound message metadata'
);
select is(
  (select count(*) from public.whatsapp_delivery_events),
  0::bigint,
  'drivers cannot read delivery events'
);
select is(
  (select count(*) from public.whatsapp_inbound_messages),
  0::bigint,
  'drivers cannot read customer or driver replies'
);

select * from finish();
rollback;
