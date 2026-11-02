begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.replace_service_payment_page(uuid,uuid,integer,text,text,text,text,uuid,text,timestamptz)','EXECUTE'),'anonymous callers cannot replace payments');
select ok(not has_function_privilege('authenticated','public.replace_service_payment_page(uuid,uuid,integer,text,text,text,text,uuid,text,timestamptz)','EXECUTE'),'browser roles cannot bypass staff actions');
select ok(has_function_privilege('service_role','public.replace_service_payment_page(uuid,uuid,integer,text,text,text,text,uuid,text,timestamptz)','EXECUTE'),'the trusted server may replace a service request');
select ok(not (select prosecdef from pg_proc where oid='public.replace_service_payment_page(uuid,uuid,integer,text,text,text,text,uuid,text,timestamptz)'::regprocedure),'replacement does not elevate database privileges');
insert into auth.users(id,email,raw_user_meta_data) values
('cc440000-0000-4000-8000-000000000001','replacement-staff@example.test','{}'),
('cc440000-0000-4000-8000-000000000002','replacement-driver@example.test','{}');
update public.profiles set role='dispatcher' where id='cc440000-0000-4000-8000-000000000001';
update public.profiles set role='driver' where id='cc440000-0000-4000-8000-000000000002';
insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,created_by)
values('cc440000-0000-4000-8000-000000000010','Replacement Customer','+3545550101',64.14,-21.9,'Pickup','manual','cc440000-0000-4000-8000-000000000001');
create temporary table replacement_fixture(kind text,id uuid);
grant all on replacement_fixture to service_role;
create function pg_temp.replace_payment(p_id uuid,p_amount integer default 32000,p_description text default 'Revised towing',p_hash text default repeat('b',64))
returns jsonb language sql security invoker set search_path='' as $$
 select public.replace_service_payment_page('cc440000-0000-4000-8000-000000000010',p_id,p_amount,p_description,'sandbox','replacement-merchant','rest_v1_1','cc440000-0000-4000-8000-000000000001',p_hash,now()+interval '1 hour');
$$;
set local role service_role;
insert into replacement_fixture select 'initial',(public.reserve_job_payment_request('cc440000-0000-4000-8000-000000000010','initial_fee','sandbox','replacement-merchant','rest_v1_1',10490,'cc440000-0000-4000-8000-000000000001')->'request'->>'id')::uuid;
insert into replacement_fixture select 'old',(public.prepare_service_payment_page('cc440000-0000-4000-8000-000000000010',27000,'Original towing','sandbox','replacement-merchant','rest_v1_1','cc440000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '1 hour')->'request'->>'id')::uuid;
select public.finish_job_payment_creation((select id from replacement_fixture where kind='old'),'BREPLACEOLD','https://demo.mypos.eu/pr/BREPLACEOLD','pending',null);
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='old'))$$,'22023','payment_creation_unresolved','replacement requires a recent verified unpaid observation');
select is((select count(*) from public.job_payment_requests where job_id='cc440000-0000-4000-8000-000000000010'),2::bigint,'a failed precondition creates no new request');
select public.record_job_payment_status(p.id,p.provider_code,p.amount_isk,p.currency,p.reference,'1','pending',now()) from public.job_payment_requests p where id=(select id from replacement_fixture where kind='old');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='initial'))$$,'P0002','payment_link_unavailable','the first fee cannot be replaced');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='old'),0)$$,'22023','invalid payment page','replacement validates a positive amount');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='old'),32000,'xx')$$,'22023','invalid payment page','replacement validates its customer description');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='old'),27000,'Original towing')$$,'22023','payment_details_unchanged','unchanged details use the existing reissue action');
select throws_ok($$select public.replace_service_payment_page('cc440000-0000-4000-8000-000000000010',(select id from replacement_fixture where kind='old'),32000,'Revised towing','sandbox','other-merchant','rest_v1_1','cc440000-0000-4000-8000-000000000001',repeat('b',64),now()+interval '1 hour')$$,'P0002','payment_link_unavailable','replacement cannot change merchant accounts');
select throws_ok($$select public.replace_service_payment_page('cc440000-0000-4000-8000-000000000010',(select id from replacement_fixture where kind='old'),32000,'Revised towing','sandbox','replacement-merchant','rest_v1_1','cc440000-0000-4000-8000-000000000002',repeat('b',64),now()+interval '1 hour')$$,'42501','staff required','a driver cannot be recorded as the replacing staff member');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='old'),32000,'Revised towing','invalid-token-hash')$$,'23514',null,'a page persistence failure rolls back the whole replacement');
select is((select superseded_at from public.job_payment_requests where id=(select id from replacement_fixture where kind='old')),null::timestamptz,'rollback leaves the original request current');
select ok((select expires_at>now() from public.job_payment_pages where token_hash=repeat('a',64)),'rollback leaves the original link available');
insert into replacement_fixture select 'current',(pg_temp.replace_payment((select id from replacement_fixture where kind='old'))->'request'->>'id')::uuid;
select ok((select superseded_at is not null from public.job_payment_requests where id=(select id from replacement_fixture where kind='old')),'replacement retains and supersedes the old request');
select is((select status from public.job_payment_requests where id=(select id from replacement_fixture where kind='old')),'pending','superseding does not pretend that myPOS cancelled a checkout');
select ok((select expires_at<=clock_timestamp() from public.job_payment_pages where token_hash=repeat('a',64)),'the old IRA page is invalidated');
select is((select amount_isk from public.job_payment_requests where id=(select id from replacement_fixture where kind='current')),32000,'the successor has the new amount');
select is((select description from public.job_payment_pages where payment_request_id=(select id from replacement_fixture where kind='current')),'Revised towing','the successor has its own description');
select is((select replaces_payment_id from public.job_payment_requests where id=(select id from replacement_fixture where kind='current')),(select id from replacement_fixture where kind='old'),'the successor references its retained predecessor');
select is((select amount_isk from public.job_payment_requests where id=(select id from replacement_fixture where kind='initial')),10490,'the initial fee is unchanged');
select is((select count(*) from public.job_payment_requests where job_id='cc440000-0000-4000-8000-000000000010' and purpose='service' and superseded_at is null),1::bigint,'exactly one service request is current');
select is((pg_temp.replace_payment((select id from replacement_fixture where kind='old'),32000,'Revised towing',repeat('c',64))->>'claimed')::boolean,false,'a repeated replacement never claims another provider creation');
select is((select count(*) from public.job_payment_requests where job_id='cc440000-0000-4000-8000-000000000010'),3::bigint,'a replacement retry retains the same three history records');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='old'),34000)$$,'22023','payment_changed','an outdated screen cannot change the successor through its predecessor');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='current'),34000)$$,'22023','payment_creation_unresolved','an in-progress creation cannot be replaced');
select ok(exists(select 1 from public.claim_due_job_payments('sandbox','replacement-merchant','rest_v1_1') where id=(select id from replacement_fixture where kind='old')),'the worker keeps monitoring the superseded checkout');
select public.finish_job_payment_creation((select id from replacement_fixture where kind='current'),'BREPLACENEW','https://demo.mypos.eu/pr/BREPLACENEW','pending',null);
select public.record_job_payment_status(p.id,p.provider_code,p.amount_isk,p.currency,p.reference,'4','paid',now()) from public.job_payment_requests p where id=(select id from replacement_fixture where kind='old');
select is((select status from public.job_payment_requests where id=(select id from replacement_fixture where kind='old')),'paid','a late payment is retained on its exact original request');
select is((select status from public.job_payment_requests where id=(select id from replacement_fixture where kind='current')),'pending','late payment does not forge cancellation of the successor');
select ok((select expires_at<=clock_timestamp() from public.job_payment_pages where payment_request_id=(select id from replacement_fixture where kind='current')),'a late payment closes the unpaid successor page');
select throws_ok($$select pg_temp.replace_payment((select id from replacement_fixture where kind='current'),34000)$$,'22023','payment_already_paid','any verified service payment prevents replacement');
select throws_ok($$select public.prepare_service_payment_page('cc440000-0000-4000-8000-000000000010',32000,'Revised towing','sandbox','replacement-merchant','rest_v1_1','cc440000-0000-4000-8000-000000000001',repeat('d',64),now()+interval '1 hour')$$,'22023','payment_already_paid','legacy reissue cannot reopen collection after a late Paid');
select throws_ok($$update public.job_payment_requests set superseded_at=now() where id=(select id from replacement_fixture where kind='initial')$$,'23514',null,'the first fee cannot be superseded even by a direct write');
reset role;
select * from finish();
rollback;
