begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.finish_job_payment_creation_v2(uuid,text,text,text,text,text,jsonb)', 'EXECUTE'), 'anonymous callers cannot finish creation');
select ok(not has_function_privilege('authenticated', 'public.finish_job_payment_creation_v2(uuid,text,text,text,text,text,jsonb)', 'EXECUTE'), 'staff browsers cannot finish creation directly');
insert into auth.users(id,email,raw_user_meta_data) values ('cc000000-0000-4000-8000-000000000001','recovery@example.test','{}');
update public.profiles set role='dispatcher' where id='cc000000-0000-4000-8000-000000000001';
insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_source,intake_pending,created_by)
select ('cc000000-0000-4000-8000-0000000000' || n)::uuid,'Pending','+3545550101',64.14,-21.9,'manual',true,'cc000000-0000-4000-8000-000000000001'
from generate_series(10,12) n;
insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by)
select ('cc000000-0000-4000-8000-0000000000' || n)::uuid,repeat(n::text,32),now()+interval '1 hour','cc000000-0000-4000-8000-000000000001'
from generate_series(10,12) n;
create temporary table recovery_details(d jsonb);
insert into recovery_details values ('{"customerName":"Þórður Ægir Guðjónsson","customerPhone":"+3545550101","vehicleRegistration":"AB123","vehicleMake":"Ford","rentalCompany":null,"peopleCount":1,"requiredCapability":"jump_start","latitude":64.14,"longitude":-21.9,"locationLabel":"Reykjavík","locationSource":"map_pin","customerNotes":"Battery needs assistance."}');
create temporary table recovery_attempts(label text, request jsonb);
grant all on recovery_attempts to service_role;
grant select on recovery_details to service_role;
set local role service_role;

insert into recovery_attempts select 'first',public.prepare_customer_payment_intake(repeat('10',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)->'request';
select public.finish_job_payment_creation_v2((request->>'id')::uuid,request->>'reference',null,null,'creation_failed','payment_provider_rejected','{"httpStatus":400,"providerCode":"4"}') from recovery_attempts where label='first';
select is((select creation_diagnostics->>'providerCode' from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010'),'4','safe provider error is retained');
select is((select jsonb_array_length(creation_history) from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010'),1,'failed creation is in the audit history');
select is((public.reserve_job_payment_request('cc000000-0000-4000-8000-000000000010','initial_fee','sandbox','other','rest_v1_1',10490,'cc000000-0000-4000-8000-000000000001')->>'claimed')::boolean,false,'another merchant cannot reclaim a failure');
select is((public.reserve_job_payment_request('cc000000-0000-4000-8000-000000000010','initial_fee','sandbox','merchant','rest_v1_1',1,'cc000000-0000-4000-8000-000000000001')->>'claimed')::boolean,false,'a retry cannot change the amount');
insert into recovery_attempts select 'retry',public.prepare_customer_payment_intake(repeat('10',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490);
select is((select (request->>'claimed')::boolean from recovery_attempts where label='retry'),true,'an explicit retry claims a rejected creation');
select is((select request->'request'->>'id' from recovery_attempts where label='retry'),(select request->>'id' from recovery_attempts where label='first'),'retry retains the payment ID');
select isnt((select request->'request'->>'reference' from recovery_attempts where label='retry'),(select request->>'reference' from recovery_attempts where label='first'),'retry uses a new attempt reference');
select is((public.prepare_customer_payment_intake(repeat('10',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)->>'claimed')::boolean,false,'an in-progress retry cannot be claimed again');
select public.finish_job_payment_creation_v2((request->>'id')::uuid,request->>'reference','BSTALE','https://demo.mypos.eu/pr/BSTALE','pending',null,'{}') from recovery_attempts where label='first';
select is((select status from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010'),'creating','a stale receipt cannot finish the newer attempt');
select is((select provider_code from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010'),null::text,'stale checkout URL is not persisted');
select throws_ok($$select public.finish_job_payment_creation_v2((request->'request'->>'id')::uuid,request->'request'->>'reference',null,null,'creation_failed','payment_provider_rejected','{"message":"private data"}') from recovery_attempts where label='retry'$$,'22023','invalid payment diagnostics','arbitrary provider messages cannot enter diagnostics');
select public.finish_job_payment_creation_v2((request->'request'->>'id')::uuid,request->'request'->>'reference','BRECOVERY','https://demo.mypos.eu/pr/BRECOVERY','pending',null,'{}') from recovery_attempts where label='retry';
select is((select jsonb_array_length(creation_history) from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010'),2,'successful retry preserves both attempt outcomes');
select public.record_job_payment_status(id,provider_code,amount_isk,currency,reference,'4','paid',now()) from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010';
select is(public.finalize_paid_customer_intake((select id from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000010')),'submitted','verified retry payment submits the saved draft');
select is((select customer_name from public.jobs where id='cc000000-0000-4000-8000-000000000010'),'Þórður Ægir Guðjónsson','the actual Icelandic name is preserved in the operational job');
select is((public.reserve_job_payment_request('cc000000-0000-4000-8000-000000000010','initial_fee','sandbox','merchant','rest_v1_1',10490,'cc000000-0000-4000-8000-000000000001')->>'claimed')::boolean,false,'Paid never opens another creation claim');

-- Reproduce the old app's failure followed by a replacement intake link.
insert into recovery_attempts select 'legacy',public.prepare_customer_payment_intake(repeat('11',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)->'request';
select public.finish_job_payment_creation((request->>'id')::uuid,null,null,'creation_failed','payment_provider_rejected') from recovery_attempts where label='legacy';
reset role;
update public.customer_intake_links set revoked_at=now() where job_id='cc000000-0000-4000-8000-000000000011';
insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by) values ('cc000000-0000-4000-8000-000000000011',repeat('a1',32),now()+interval '1 hour','cc000000-0000-4000-8000-000000000001');
set local role service_role;
select is((public.prepare_customer_payment_intake(repeat('a1',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)->>'claimed')::boolean,true,'replacement link can recover a definitively rejected legacy creation');
select is((select count(*) from public.customer_payment_intakes where job_id='cc000000-0000-4000-8000-000000000011'),1::bigint,'replacement link reuses the single durable draft');
select is((select l.token_hash from public.customer_payment_intakes d join public.customer_intake_links l on l.id=d.customer_intake_link_id where d.job_id='cc000000-0000-4000-8000-000000000011'),repeat('a1',32),'draft is associated with the active replacement link');
select is((select jsonb_array_length(creation_history) from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000011'),1,'legacy failure evidence is archived before retry');
select throws_ok($$select public.prepare_customer_payment_intake(repeat('11',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)$$,'P0002','payment_link_unavailable','the revoked link remains unusable after recovery');

-- Uncertain attempts, including a newly issued link, always remain blocked.
insert into recovery_attempts select 'uncertain',public.prepare_customer_payment_intake(repeat('12',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)->'request';
select public.finish_job_payment_creation_v2((request->>'id')::uuid,request->>'reference',null,null,'creation_unknown','payment_provider_unavailable','{"httpStatus":503}') from recovery_attempts where label='uncertain';
select is((public.prepare_customer_payment_intake(repeat('12',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)->>'claimed')::boolean,false,'same-link retry never reclaims an ambiguous creation');
reset role;
update public.customer_intake_links set revoked_at=now() where job_id='cc000000-0000-4000-8000-000000000012';
insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by) values ('cc000000-0000-4000-8000-000000000012',repeat('a2',32),now()+interval '1 hour','cc000000-0000-4000-8000-000000000001');
set local role service_role;
select throws_ok($$select public.prepare_customer_payment_intake(repeat('a2',32),(select d from recovery_details),'is','sandbox','merchant','rest_v1_1',10490)$$,'22023','payment_creation_unresolved','replacement links cannot bypass an uncertain creation');
select is((select status from public.job_payment_requests where job_id='cc000000-0000-4000-8000-000000000012'),'creation_unknown','ambiguous reservation is retained');
reset role;
select * from finish();
rollback;
