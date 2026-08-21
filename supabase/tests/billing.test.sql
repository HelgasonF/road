begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(37);

select has_type('public', 'billing_payer_type', 'billing payer type exists');
select has_type('public', 'billing_receivable_status', 'payer receivable status exists');
select has_type('public', 'billing_payable_status', 'provider payable status exists');
select has_type('public', 'billing_action', 'billing action type exists');

select enum_has_labels(
  'public',
  'billing_payer_type',
  array['customer', 'rental_company', 'insurer', 'business_account'],
  'payer choices cover direct and account billing'
);

select has_table('public', 'job_billing', 'one-to-one job billing table exists');
select has_table('public', 'job_billing_events', 'billing audit events table exists');
select has_function(
  'public',
  'save_job_billing',
  array['uuid', 'billing_payer_type', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'integer', 'integer', 'text'],
  'staff billing draft save RPC exists'
);
select has_function(
  'public',
  'transition_job_billing',
  array['uuid', 'billing_action', 'text', 'date', 'text'],
  'validated billing transition RPC exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_billing'::regclass),
  'billing records use RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_billing_events'::regclass),
  'billing audit events use RLS'
);

select is(
  (select count(*)
   from information_schema.routine_privileges
   where specific_schema = 'public'
     and routine_name in ('save_job_billing', 'transition_job_billing')
     and grantee in ('PUBLIC', 'anon')),
  0::bigint,
  'anonymous roles cannot execute billing RPCs'
);

select is(
  (select count(distinct routine_name)
   from information_schema.routine_privileges
   where specific_schema = 'public'
     and routine_name in ('save_job_billing', 'transition_job_billing')
     and grantee = 'authenticated'
     and privilege_type = 'EXECUTE'),
  2::bigint,
  'authenticated staff can reach both guarded billing RPCs'
);

select is(
  has_table_privilege('authenticated', 'public.job_billing', 'UPDATE'),
  false,
  'authenticated users cannot bypass audited billing mutations with a direct update'
);

create temporary table billing_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

insert into public.operators (
  id, name, phone, company_name, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'Billing provider',
  '555-8101',
  'Billing Provider ehf.',
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
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'Billing customer',
  '555-8102',
  63.9,
  -20.4,
  'Billing location',
  'manual',
  (select id from billing_test_identity)
);

select is(
  (select count(*) from public.job_billing where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  1::bigint,
  'new jobs automatically receive one billing record'
);

select results_eq(
  $$select receivable_status::text, payable_status::text
    from public.job_billing
    where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'$$,
  $$values ('missing_information'::text, 'not_ready'::text)$$,
  'new billing records begin with neither money leg ready'
);

insert into public.job_assignments (
  id, job_id, operator_id, assigned_by, accepted_at
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  (select id from billing_test_identity),
  now()
);

update public.jobs
set status = 'completed', completed_at = now()
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

select results_eq(
  $$select receivable_status::text, payable_status::text
    from public.job_billing
    where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'$$,
  $$values ('missing_information'::text, 'awaiting_provider_invoice'::text)$$,
  'completion hands the job to billing while preserving missing payer information'
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from billing_test_identity),
  true
);
set local role authenticated;

select lives_ok(
  $$select public.save_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'rental_company',
    'Bílaleiga Íslands ehf.',
    '550101-1230',
    'reikningar@example.is',
    '+354 555 8103',
    'Keflavíkurflugvöllur, 235 Reykjanesbær',
    'AUTH-1042',
    'PO-881',
    'Dráttur að verkstæði',
    42900,
    31000,
    'Samþykkt af vaktstjóra'
  )$$,
  'staff can save complete payer and settlement details'
);

select is(
  (select receivable_status::text from public.job_billing where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  'ready_to_invoice',
  'complete payer details make a completed job ready to invoice'
);

select is(
  (select payer_amount_isk - provider_amount_isk from public.job_billing where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  11900,
  'payer and provider totals remain separate for reconciliation'
);

select throws_ok(
  $$select public.save_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'customer', 'Customer', null, null, null, null, null, null, null,
    -1, 31000, null
  )$$,
  '23514',
  'Billing amounts cannot be negative',
  'negative billing totals are rejected at the database boundary'
);

select lives_ok(
  $$select public.transition_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'issue_payer_invoice',
    'VS-2026-0042',
    current_date + 14,
    null
  )$$,
  'staff can record an issued Vegstoð payer invoice'
);

select results_eq(
  $$select receivable_status::text, payer_invoice_number, payer_invoice_issued_at is not null
    from public.job_billing
    where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'$$,
  $$values ('invoiced'::text, 'VS-2026-0042'::text, true)$$,
  'payer invoice issuance is timestamped and referenced'
);

select is(
  (select count(*) from public.job_billing_events
   where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
     and action = 'issue_payer_invoice'),
  1::bigint,
  'payer invoice issuance creates an audit event'
);

select throws_ok(
  $$select public.save_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'rental_company', 'Bílaleiga Íslands ehf.', '550101-1230',
    'reikningar@example.is', '+354 555 8103',
    'Keflavíkurflugvöllur, 235 Reykjanesbær', 'AUTH-1042', 'PO-881',
    'Dráttur að verkstæði', 44000, 31000, 'Reynt að breyta útgefnum reikningi'
  )$$,
  'P0001',
  'Payer invoice values are locked after issuance',
  'payer identity and totals are locked after invoice issuance'
);

select lives_ok(
  $$select public.transition_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'record_payer_payment',
    null,
    null,
    'Greitt með bankafærslu'
  )$$,
  'staff can record money received by Vegstoð'
);

select results_eq(
  $$select receivable_status::text, payable_status::text
    from public.job_billing
    where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'$$,
  $$values ('paid'::text, 'awaiting_provider_invoice'::text)$$,
  'payer payment does not falsely mark the provider as paid'
);

select lives_ok(
  $$select public.transition_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'approve_provider_invoice',
    'BP-104',
    current_date + 14,
    null
  )$$,
  'staff can approve the assigned provider invoice'
);

select results_eq(
  $$select payable_status::text, provider_invoice_number, provider_invoice_received_at is not null
    from public.job_billing
    where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'$$,
  $$values ('approved'::text, 'BP-104'::text, true)$$,
  'provider invoice approval is timestamped and referenced'
);

select throws_ok(
  $$select public.save_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'rental_company', 'Bílaleiga Íslands ehf.', '550101-1230',
    'reikningar@example.is', '+354 555 8103',
    'Keflavíkurflugvöllur, 235 Reykjanesbær', 'AUTH-1042', 'PO-881',
    'Dráttur að verkstæði', 42900, 32000, 'Reynt að breyta samþykktum reikningi'
  )$$,
  'P0001',
  'Provider amount is locked after invoice approval',
  'provider total is locked after provider invoice approval'
);

select lives_ok(
  $$select public.transition_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'record_provider_payment',
    null,
    null,
    'Greitt til þjónustuaðila'
  )$$,
  'staff can record Vegstoð payment to the provider'
);

select results_eq(
  $$select receivable_status::text, payable_status::text,
           payer_paid_at is not null, provider_paid_at is not null
    from public.job_billing
    where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'$$,
  $$values ('paid'::text, 'paid'::text, true, true)$$,
  'both paid timestamps are required for a fully settled case'
);

select is(
  (select count(*) from public.job_billing_events
   where job_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  5::bigint,
  'detail changes and every money transition are audited'
);

select throws_ok(
  $$select public.transition_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'record_provider_payment',
    null,
    null,
    null
  )$$,
  'P0001',
  'Provider payment cannot be recorded from status paid',
  'invalid provider transitions are rejected'
);

reset role;

update public.profiles
set role = 'driver'
where id = (select id from billing_test_identity);

update public.operators
set user_id = (select id from billing_test_identity)
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

set local role authenticated;

select is(
  (select count(*) from public.job_billing),
  0::bigint,
  'drivers cannot read billing records, prices, or margin data'
);

select is(
  (select count(*) from public.job_billing_events),
  0::bigint,
  'drivers cannot read the financial audit trail'
);

select throws_ok(
  $$select public.save_job_billing(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'customer', 'Customer', null, null, null, null, null, null, null,
    10000, 8000, null
  )$$,
  '42501',
  'Staff access required',
  'driver cannot mutate billing through the guarded RPC'
);

reset role;

select * from finish();
rollback;
