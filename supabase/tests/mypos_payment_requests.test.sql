begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid = 'public.job_payment_requests'::regclass), 'collection records use RLS');
select ok(not has_table_privilege('anon', 'public.job_payment_requests', 'SELECT'), 'anonymous users cannot read payment URLs');
select ok(not has_table_privilege('authenticated', 'public.job_payment_requests', 'INSERT'), 'browser roles cannot create payment records');
select ok(not has_table_privilege('authenticated', 'public.job_payment_requests', 'UPDATE'), 'browser roles cannot claim a payment was paid');
select ok(not has_function_privilege('authenticated', 'public.reserve_job_payment_request(uuid,text,text,text,text,integer,uuid)', 'EXECUTE'), 'reservations are server-only');
select ok(not has_function_privilege('anon', 'public.record_job_payment_status(uuid,text,integer,text,text,text,text,timestamptz)', 'EXECUTE'), 'anonymous users cannot submit payment status');
select ok(not has_function_privilege('authenticated', 'public.record_job_payment_status(uuid,text,integer,text,text,text,text,timestamptz)', 'EXECUTE'), 'signed-in users cannot submit payment status');

insert into auth.users(id, email, raw_user_meta_data)
values ('aa000000-0000-4000-8000-000000000001', 'mypos-staff@example.test', '{"display_name":"Payment test staff"}'),
       ('aa000000-0000-4000-8000-000000000002', 'mypos-driver@example.test', '{"display_name":"Payment test driver"}'),
       ('aa000000-0000-4000-8000-000000000003', 'mypos-pending@example.test', '{}');
update public.profiles set role = 'admin' where id = 'aa000000-0000-4000-8000-000000000001';
update public.profiles set role = 'driver' where id = 'aa000000-0000-4000-8000-000000000002';
insert into public.jobs(id, customer_name, customer_phone, latitude, longitude, location_label, location_source, created_by)
values ('aa000000-0000-4000-8000-000000000010', 'Payment Test', '+3545550101', 64.14, -21.9, 'Reykjavík', 'manual', 'aa000000-0000-4000-8000-000000000001');

set local role service_role;
select is((public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000010', 'initial_fee', 'sandbox', 'merchant', 'rest_v1_1', 5000, 'aa000000-0000-4000-8000-000000000001')->>'claimed')::boolean, true, 'the first attempt claims the collection slot');
select is((public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000010', 'initial_fee', 'sandbox', 'merchant', 'rest_v1_1', 5000, 'aa000000-0000-4000-8000-000000000001')->>'claimed')::boolean, false, 'a repeated attempt cannot claim the same slot');
select is((public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000010', 'initial_fee', 'sandbox', 'other-merchant', 'other-application', 8000, 'aa000000-0000-4000-8000-000000000001')->'request'->>'amount_isk')::integer, 5000, 'changing amount or merchant cannot create a second initial charge');
select is((public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000010', 'service', 'sandbox', 'merchant', 'rest_v1_1', 27000, 'aa000000-0000-4000-8000-000000000001')->>'claimed')::boolean, true, 'the second charge has its own independent slot');
select is((select count(*) from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010'), 2::bigint, 'the two charges are separate rows');

select throws_ok($$select public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000010', 'service', 'production', 'merchant', 'rest_v1_1', 10, 'aa000000-0000-4000-8000-000000000002')$$, '42501', 'staff required', 'a driver cannot be recorded as the creator');
select throws_ok($$select public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000099', 'service', 'sandbox', 'merchant', 'rest_v1_1', 10, 'aa000000-0000-4000-8000-000000000001')$$, '23503', null, 'a collection must belong to an existing billing record');

select is(public.finish_job_payment_creation(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 'https://demo.mypos.eu/en/pr/BTEST', 'pending', null
)->>'status', 'pending', 'the exact provider code and URL can be persisted');
select is((select payment_url from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'https://demo.mypos.eu/en/pr/BTEST', 'the hosted URL is retained verbatim');
select is((select provider_api from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'rest_v1_1', 'the provider API is associated with the original collection');

select throws_ok($$select public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '4', 'creating', now())$$,
  '22023', 'provider response mismatch', 'verification accepts only normalized provider observations');

select throws_ok($$select public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 1, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '4', 'paid', now())$$,
  '22023', 'provider response mismatch', 'wrong amount cannot mark a payment paid');
select throws_ok($$select public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'EUR',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '4', 'paid', now())$$,
  '22023', 'provider response mismatch', 'wrong currency cannot mark a payment paid');
select throws_ok($$select public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'OTHER', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '4', 'paid', now())$$,
  '22023', 'provider response mismatch', 'wrong provider code cannot mark a payment paid');
select throws_ok($$select public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK', 'another-job', '4', 'paid', now())$$,
  '22023', 'provider response mismatch', 'wrong reference cannot mark a payment paid');

select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '99', 'unknown', now() - interval '20 seconds'
)->>'status', 'unknown', 'unknown provider states remain unpaid');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '3', 'failed', now() - interval '19 seconds'
)->>'status', 'failed', 'a failed attempt remains unpaid');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '5', 'expired', now() - interval '18 seconds'
)->>'status', 'expired', 'an expired request remains unpaid');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '6', 'cancelled', now() - interval '17 seconds'
)->>'status', 'cancelled', 'a cancelled request remains unpaid');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '0', 'unknown', now() - interval '16 seconds'
)->>'status', 'unknown', 'None never counts as payment');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '2', 'seen', now() - interval '10 seconds'
)->>'status', 'seen', 'opening the link is not proof of payment');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '1', 'pending', now() - interval '30 seconds'
)->>'status', 'seen', 'out-of-order reads do not regress the last observation');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '4', 'paid', now() - interval '15 seconds'
)->>'status', 'paid', 'an older successful observation still proves payment');
select is(public.record_job_payment_status(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'BTEST', 5000, 'ISK',
  (select reference from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '1', 'pending', now()
)->>'status', 'paid', 'Paid cannot be overwritten by pending');
select ok((select paid_at is not null from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), 'confirmed payment records its verification time');
select is((select provider_status from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'initial_fee'), '4', 'the raw legacy Paid code survives later stale observations');
select is((select status::text from public.jobs where id = 'aa000000-0000-4000-8000-000000000010'), 'new', 'payment does not complete or advance the job');
select is((select receivable_status::text from public.job_billing where job_id = 'aa000000-0000-4000-8000-000000000010'), 'missing_information', 'collection does not fabricate an invoice or settle the ledger');

select is(public.finish_job_payment_creation(
  (select id from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010' and purpose = 'service'), null, null, 'creation_unknown', 'payment_provider_unavailable'
)->>'status', 'creation_unknown', 'ambiguous creation is retained for investigation');
select is((public.reserve_job_payment_request('aa000000-0000-4000-8000-000000000010', 'service', 'sandbox', 'merchant', 'rest_v1_1', 27000, 'aa000000-0000-4000-8000-000000000001')->>'claimed')::boolean, false, 'uncertain creation never reopens the collection slot');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010'), 2::bigint, 'staff can read collection history');
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010'), 0::bigint, 'drivers cannot read amounts or payment links');
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.job_payment_requests where job_id = 'aa000000-0000-4000-8000-000000000010'), 0::bigint, 'pending users cannot read collection records');

reset role;
select * from finish();
rollback;
