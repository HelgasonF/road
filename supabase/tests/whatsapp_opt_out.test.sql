begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

select has_table(
  'public', 'whatsapp_contact_preferences',
  'explicit WhatsApp preferences have a durable table'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.whatsapp_contact_preferences'::regclass),
  'WhatsApp preferences use RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.whatsapp_contact_preferences', 'SELECT'),
  'authenticated staff can be authorized to review preferences'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_contact_preferences', 'INSERT'),
  'authenticated users cannot forge contact preferences'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_whatsapp_contact_preference()', 'EXECUTE'),
  'authenticated users cannot invoke the preference trigger directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.prevent_opted_out_whatsapp_send()', 'EXECUTE'),
  'authenticated users cannot invoke the outbound guard directly'
);

create temporary table whatsapp_opt_out_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

grant select on whatsapp_opt_out_identity to authenticated, service_role;

set local role service_role;
select lives_ok(
  $$select public.ingest_whatsapp_webhook_event(
    repeat('e', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb,
    '[]'::jsonb,
    '[{
      "message_id":"wamid.opt-out-1",
      "context_message_id":null,
      "phone_number_id":"1251932438011191",
      "sender_phone":"3546597005",
      "message_type":"text",
      "text_body":"STOP",
      "reply_classification":"unknown",
      "received_at":"2026-09-12T00:00:00.000Z"
    }]'::jsonb
  )$$,
  'a signed STOP message is ingested'
);
reset role;

select is(
  (select status from public.whatsapp_contact_preferences where recipient_phone = '3546597005'),
  'opted_out',
  'STOP opts the sender out'
);
select ok(
  (select opted_out_at is not null from public.whatsapp_contact_preferences where recipient_phone = '3546597005'),
  'the opt-out timestamp is retained'
);
select ok(
  (select source_inbound_message_id is not null from public.whatsapp_contact_preferences where recipient_phone = '3546597005'),
  'the signed source message remains linked as evidence'
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from whatsapp_opt_out_identity),
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.reserve_whatsapp_outbound_message(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1',
    'test',
    '3546597005',
    'hello_world',
    'en_US',
    repeat('f', 64)
  )$$,
  'P0001',
  'Recipient has opted out of WhatsApp messages',
  'a fresh send cannot be reserved for an opted-out phone'
);
reset role;

set local role service_role;
select lives_ok(
  $$select public.ingest_whatsapp_webhook_event(
    repeat('1', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb,
    '[]'::jsonb,
    '[{
      "message_id":"wamid.opt-in-1",
      "context_message_id":null,
      "phone_number_id":"1251932438011191",
      "sender_phone":"3546597005",
      "message_type":"text",
      "text_body":"START",
      "reply_classification":"unknown",
      "received_at":"2026-09-12T00:01:00.000Z"
    }]'::jsonb
  )$$,
  'an explicit START message is ingested'
);
reset role;

select is(
  (select status from public.whatsapp_contact_preferences where recipient_phone = '3546597005'),
  'allowed',
  'START allows future messages again'
);
select ok(
  (select opted_in_at is not null from public.whatsapp_contact_preferences where recipient_phone = '3546597005'),
  'the explicit opt-in timestamp is retained'
);

set local role service_role;
select lives_ok(
  $$select public.ingest_whatsapp_webhook_event(
    repeat('8', 64),
    '1799725827819599',
    '{"object":"whatsapp_business_account","entry":[]}'::jsonb,
    '[]'::jsonb,
    '[{
      "message_id":"wamid.opt-out-older-1",
      "context_message_id":null,
      "phone_number_id":"1251932438011191",
      "sender_phone":"3546597005",
      "message_type":"text",
      "text_body":"STOP",
      "reply_classification":"unknown",
      "received_at":"2026-09-12T00:00:30.000Z"
    }]'::jsonb
  )$$,
  'an older delayed preference webhook is accepted'
);
reset role;

select is(
  (select status from public.whatsapp_contact_preferences where recipient_phone = '3546597005'),
  'allowed',
  'an older delayed STOP does not override the newer START'
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from whatsapp_opt_out_identity),
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.reserve_whatsapp_outbound_message(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2',
    'test',
    '3546597005',
    'hello_world',
    'en_US',
    repeat('2', 64)
  )$$,
  'an explicitly re-enabled phone can receive a new message'
);
reset role;

update public.profiles
set role = 'driver'
where id = (select id from whatsapp_opt_out_identity);
set local role authenticated;
select is(
  (select count(*) from public.whatsapp_contact_preferences),
  0::bigint,
  'drivers cannot read contact preferences'
);
reset role;

select is(
  (select count(*) from public.whatsapp_contact_preferences),
  1::bigint,
  'one phone keeps one current preference row'
);
select is(
  (
    select inbound.meta_message_id
    from public.whatsapp_contact_preferences preference
    join public.whatsapp_inbound_messages inbound on inbound.id = preference.source_inbound_message_id
    where preference.recipient_phone = '3546597005'
  ),
  'wamid.opt-in-1',
  'the latest explicit preference points to its signed source message'
);

select * from finish();
rollback;
