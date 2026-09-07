begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select has_column(
  'public', 'customer_intake_links', 'first_opened_at',
  'customer links record the first verified page opening'
);
select has_table('public', 'job_contact_events', 'driver contact attempts have an audit table');
select enum_has_labels(
  'public', 'job_contact_channel', array['whatsapp', 'phone'],
  'contact channels distinguish WhatsApp and phone'
);
select enum_has_labels(
  'public', 'job_contact_purpose', array['availability', 'assignment'],
  'contact purposes distinguish availability and assignment'
);
select has_function(
  'public', 'mark_customer_intake_link_opened', array['uuid'],
  'customer page opening RPC exists'
);
select has_function(
  'public', 'record_job_contact',
  array['uuid', 'uuid', 'job_contact_channel', 'job_contact_purpose'],
  'staff contact audit RPC exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_contact_events'::regclass),
  'contact audit uses RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.job_contact_events', 'SELECT'),
  'authenticated users can reach the contact audit through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.job_contact_events', 'INSERT'),
  'authenticated users cannot bypass the audited contact RPC'
);
select is(
  (
    select count(*)
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in ('mark_customer_intake_link_opened', 'record_job_contact')
      and grantee in ('PUBLIC', 'anon')
  ),
  0::bigint,
  'public and anonymous roles cannot execute timeline mutation RPCs'
);
select ok(
  has_function_privilege(
    'service_role', 'public.mark_customer_intake_link_opened(uuid)', 'EXECUTE'
  ),
  'server service role can record a verified customer page opening'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.record_job_contact(uuid,uuid,public.job_contact_channel,public.job_contact_purpose)',
    'EXECUTE'
  ),
  'authenticated staff can record a driver contact attempt'
);

create temporary table timeline_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

grant select on timeline_test_identity to authenticated;

insert into public.operators (
  id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'abababab-abab-4bab-8bab-ababababab01',
  'Timeline operator',
  '555-8801',
  'Hella',
  63.8355,
  -20.3987,
  'available',
  100
);

insert into public.jobs (
  id, customer_name, customer_phone, latitude, longitude,
  location_label, location_source, created_by
) values (
  'abababab-abab-4bab-8bab-ababababab02',
  'Timeline customer',
  '555-8802',
  63.9,
  -20.4,
  'Timeline location',
  'manual',
  (select id from timeline_test_identity)
);

insert into public.customer_intake_links (
  id, job_id, token_hash, expires_at, created_by
) values (
  'abababab-abab-4bab-8bab-ababababab03',
  'abababab-abab-4bab-8bab-ababababab02',
  repeat('f', 64),
  now() + interval '24 hours',
  (select id from timeline_test_identity)
);

set local role service_role;
select lives_ok(
  $$select public.mark_customer_intake_link_opened('abababab-abab-4bab-8bab-ababababab03')$$,
  'customer page opening can be recorded'
);
reset role;

select ok(
  (
    select first_opened_at is not null
    from public.customer_intake_links
    where id = 'abababab-abab-4bab-8bab-ababababab03'
  ),
  'first customer page opening is persisted'
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from timeline_test_identity),
  true
);
set local role authenticated;

select lives_ok(
  $$select public.record_job_contact(
    'abababab-abab-4bab-8bab-ababababab02',
    'abababab-abab-4bab-8bab-ababababab01',
    'whatsapp',
    'availability'
  )$$,
  'staff can record opening a WhatsApp availability draft'
);
select is(
  (
    select concat_ws(':', channel::text, purpose::text)
    from public.job_contact_events
    where job_id = 'abababab-abab-4bab-8bab-ababababab02'
  ),
  'whatsapp:availability',
  'contact channel and purpose are stored accurately'
);
select throws_ok(
  $$insert into public.job_contact_events (
    job_id, operator_id, channel, purpose, initiated_by
  ) values (
    'abababab-abab-4bab-8bab-ababababab02',
    'abababab-abab-4bab-8bab-ababababab01',
    'phone',
    'availability',
    (select id from timeline_test_identity)
  )$$,
  'permission denied for table job_contact_events',
  'staff cannot insert unaudited contact events directly'
);

reset role;
update public.profiles
set role = 'driver'
where id = (select id from timeline_test_identity);
set local role authenticated;

select is(
  (select count(*) from public.job_contact_events),
  0::bigint,
  'drivers cannot read staff contact audit events'
);
select throws_ok(
  $$select public.record_job_contact(
    'abababab-abab-4bab-8bab-ababababab02',
    'abababab-abab-4bab-8bab-ababababab01',
    'phone',
    'availability'
  )$$,
  '42501',
  'Staff access required',
  'drivers cannot record staff contact events'
);

select * from finish();
rollback;
