begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(has_function_privilege('service_role','public.search_iceland_addresses(text,integer)','EXECUTE'),'server can resolve the location catalog after validating a customer token');
select ok(not has_function_privilege('anon','public.search_iceland_addresses(text,integer)','EXECUTE'),'anonymous callers cannot use the database lookup directly');
select ok(not has_function_privilege('authenticated','public.prepare_customer_payment_intake(text,jsonb,text,text,text,text,integer)','EXECUTE'),'signed-in browser clients cannot prepare payment drafts');
select ok(not has_function_privilege('anon','public.submit_customer_intake_v3(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text)','EXECUTE'),'typed locations do not open public customer writes');

insert into public.iceland_places(source_type,source_id,name,category,category_label,search_priority,latitude,longitude,search_text)
values ('node',812345678901234,'Keflavík','town','Bær',80,64,-22.56,'Keflavík 230');
insert into auth.users(id,email,raw_user_meta_data) values ('bc000000-0000-4000-8000-000000000001','typed-location-staff@example.test','{}');
update public.profiles set role='dispatcher' where id='bc000000-0000-4000-8000-000000000001';
insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,intake_pending,created_by) values
('bc000000-0000-4000-8000-000000000010','Waiting','+17022196679',64.95,-18.7,null,'manual',true,'bc000000-0000-4000-8000-000000000001'),
('bc000000-0000-4000-8000-000000000011','Waiting','+17022196679',64.95,-18.7,null,'manual',true,'bc000000-0000-4000-8000-000000000001');
insert into public.customer_intake_links(id,job_id,token_hash,expires_at,created_by) values
('bc000000-0000-4000-8000-000000000020','bc000000-0000-4000-8000-000000000010',repeat('8',64),now()+interval '1 hour','bc000000-0000-4000-8000-000000000001'),
('bc000000-0000-4000-8000-000000000021','bc000000-0000-4000-8000-000000000011',repeat('9',64),now()+interval '1 hour','bc000000-0000-4000-8000-000000000001');

set local role service_role;
select ok(exists(select 1 from public.search_iceland_addresses('Keflavik',8) where id='osm:node:812345678901234'),'server catalog lookup resolves an accent-free town name');
select lives_ok($$select public.submit_customer_intake_v3(repeat('8',64),'Typed Customer','+17022196679','AB123','Ford',null,1,'jump_start',64,-22.56,'Keflavík · Bær · Áætluð staðsetning','search','Battery is flat.')$$,'a correction/unpaid-mode intake accepts a resolved search location');
select is((select location_source::text from public.jobs where id='bc000000-0000-4000-8000-000000000010'),'search','the searched source is retained accurately');
select is((select longitude from public.jobs where id='bc000000-0000-4000-8000-000000000010'),-22.56::double precision,'resolved coordinates replace the pending placeholder');

select lives_ok($$select public.prepare_customer_payment_intake(repeat('9',64),'{"customerName":"Paid Typed Customer","customerPhone":"+17022196679","vehicleRegistration":"AB123","vehicleMake":"Ford","rentalCompany":null,"peopleCount":1,"requiredCapability":"jump_start","latitude":64,"longitude":-22.56,"locationLabel":"Keflavík · Bær · Approximate location","locationSource":"search","customerNotes":"Battery is flat."}'::jsonb,'en','sandbox','typed-merchant','rest_v1_1',10490)$$,'combined checkout freezes a searched location before payment');
select is((select intake_pending from public.jobs where id='bc000000-0000-4000-8000-000000000011'),true,'typing a location does not bypass the initial payment');
select is((select details->>'locationSource' from public.customer_payment_intakes where job_id='bc000000-0000-4000-8000-000000000011'),'search','the immutable draft stores the real location source');

select public.finish_job_payment_creation((select payment_request_id from public.customer_payment_intakes where job_id='bc000000-0000-4000-8000-000000000011'),'TYPED1','https://demo.mypos.eu/pr/TYPED1','pending',null);
select public.record_job_payment_status(p.id,p.provider_code,p.amount_isk,p.currency,p.reference,'4','paid',now()) from public.job_payment_requests p where p.job_id='bc000000-0000-4000-8000-000000000011';
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='bc000000-0000-4000-8000-000000000011')),'submitted','the existing trusted paid-finalization path submits the searched location');
select is((select location_source::text from public.jobs where id='bc000000-0000-4000-8000-000000000011'),'search','background finalization preserves the searched source');
select is((select status::text from public.jobs where id='bc000000-0000-4000-8000-000000000011'),'new','a searched paid intake does not complete or assign a job');
select is((select receivable_status::text from public.job_billing where job_id='bc000000-0000-4000-8000-000000000011'),'missing_information','the independent billing workflow remains unchanged');
select is((select count(*) from public.job_payment_requests where job_id='bc000000-0000-4000-8000-000000000011'),1::bigint,'the location update creates no extra payment');
reset role;
select * from finish();
rollback;
