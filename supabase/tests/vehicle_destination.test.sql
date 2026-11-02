begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.save_job_v2(uuid,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,public.job_priority,text,text[],text)', 'EXECUTE'), 'anonymous clients cannot save a destination');
select ok(not has_function_privilege('authenticated', 'public.submit_customer_intake_v4(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text,text)', 'EXECUTE'), 'customer submission remains service-only');
select ok(has_function_privilege('service_role', 'public.submit_customer_intake_v4(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text,text)', 'EXECUTE'), 'the server may submit a destination');
select ok(not (select prosecdef from pg_proc where oid = 'public.submit_customer_intake_v4(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text,text)'::regprocedure), 'the new customer wrapper does not elevate privileges');

insert into auth.users(id,email,raw_user_meta_data) values
('ee330000-0000-4000-8000-000000000001','destination-staff@example.test','{}'),
('ee330000-0000-4000-8000-000000000002','destination-driver@example.test','{}');
update public.profiles set role='dispatcher' where id='ee330000-0000-4000-8000-000000000001';
update public.profiles set role='driver' where id='ee330000-0000-4000-8000-000000000002';
create temporary table destination_jobs(id uuid);
grant all on destination_jobs to authenticated, service_role;
set local role authenticated;
select set_config('request.jwt.claim.sub','ee330000-0000-4000-8000-000000000001',true);
insert into destination_jobs select public.save_job_v2(null,'Destination Customer','+3545550101','AB123','Ford',null,1,64.14,-21.9,'Pickup in Reykjavík','map_pin','normal',null,array['towing'],'  Workshop in Keflavík  ');
select is((select destination_label from public.jobs where id=(select id from destination_jobs)),'Workshop in Keflavík','staff can save a trimmed optional destination');
select is((select latitude from public.jobs where id=(select id from destination_jobs)),64.14::double precision,'destination does not replace pickup coordinates');
select public.save_job((select id from destination_jobs),'Legacy Customer','+3545550101','AB123','Ford',null,1,64.14,-21.9,'Pickup in Reykjavík','map_pin','normal',null,array['towing']);
select is((select destination_label from public.jobs where id=(select id from destination_jobs)),'Workshop in Keflavík','an old staff client preserves the new field');
select public.save_job_v2((select id from destination_jobs),'Destination Customer','+3545550101','AB123','Ford',null,1,64.14,-21.9,'Pickup in Reykjavík','map_pin','normal',null,array['towing'],'   ');
select is((select destination_label from public.jobs where id=(select id from destination_jobs)),null::text,'staff can deliberately clear the optional field');
select throws_ok($$select public.save_job_v2((select id from destination_jobs),'Must not change','+3545550101','AB123','Ford',null,1,64.14,-21.9,'Pickup','map_pin','normal',null,array['towing'],repeat('x',301))$$,'22023','invalid vehicle destination','an overlong destination is rejected');
select is((select customer_name from public.jobs where id=(select id from destination_jobs)),'Destination Customer','rejected edits do not partially save the job');
select set_config('request.jwt.claim.sub','ee330000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.save_job_v2((select id from destination_jobs),'Driver edit','+3545550101','AB123','Ford',null,1,64.14,-21.9,'Pickup','map_pin','normal',null,array['towing'],'Workshop')$$,'42501','Staff access required','drivers cannot use the staff destination writer');
reset role;

insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,intake_pending,destination_label,created_by)
select ('ee330000-0000-4000-8000-00000000001'||n)::uuid,'Pending Customer','+3545550101',64.95,-18.7,null,'manual',true,'Existing destination','ee330000-0000-4000-8000-000000000001'::uuid from generate_series(2,7) n;
insert into public.customer_intake_links(job_id,token_hash,expires_at,created_by)
select ('ee330000-0000-4000-8000-00000000001'||n)::uuid,repeat(n::text,64),now()+interval '1 hour','ee330000-0000-4000-8000-000000000001'::uuid from generate_series(2,7) n;
set local role service_role;
select throws_ok($$select public.submit_customer_intake_v4(repeat('2',64),'Customer','+3545550101','AB123','Ford',null,1,'towing',64.14,-21.9,'Pickup','map_pin','Please tow the vehicle.',repeat('x',301))$$,'22023','invalid vehicle destination','invalid customer details do not consume the intake');
select is((select submitted_at from public.customer_intake_links where token_hash=repeat('2',64)),null::timestamptz,'a rejected destination leaves the customer link available');
select public.submit_customer_intake_v4(repeat('2',64),'Customer','+3545550101','AB123','Ford',null,1,'towing',64.14,-21.9,'Pickup','map_pin','Please tow the vehicle.','  Rental depot  ');
select is((select destination_label from public.jobs where id='ee330000-0000-4000-8000-000000000012'),'Rental depot','the guarded customer submission saves a trimmed destination');
select throws_ok($$select public.submit_customer_intake_v4(repeat('2',64),'Customer','+3545550101','AB123','Ford',null,1,'towing',64.14,-21.9,'Pickup','map_pin','Please tow the vehicle.','Another depot')$$,'P0002','Customer intake link is invalid or unavailable','destination submission cannot reuse a consumed link');
select public.submit_customer_intake_v3(repeat('3',64),'Customer','+3545550101','AB123','Ford',null,1,'towing',64.14,-21.9,'Pickup','map_pin','Please tow the vehicle.');
select is((select destination_label from public.jobs where id='ee330000-0000-4000-8000-000000000013'),'Existing destination','legacy customer submissions preserve the new field');
reset role;

create temporary table destination_cases(kind text,job_id uuid,token_hash text,details jsonb,provider_code text,expected text);
insert into destination_cases
select kind,('ee330000-0000-4000-8000-00000000001'||n)::uuid,repeat(n::text,64),
  '{"customerName":"Paid Customer","customerPhone":"+3545550101","vehicleRegistration":"AB123","vehicleMake":"Ford","rentalCompany":null,"peopleCount":1,"requiredCapability":"towing","latitude":64.14,"longitude":-21.9,"locationLabel":"Pickup","locationSource":"map_pin","customerNotes":"Please tow the vehicle."}'::jsonb || extra,
  'BDEST'||n,expected
from (values ('new',4,'{"destinationLabel":"Workshop in Keflavík"}'::jsonb,'Workshop in Keflavík'),('legacy',5,'{}'::jsonb,'Existing destination'),('blank',6,'{"destinationLabel":null}'::jsonb,null)) c(kind,n,extra,expected);
grant select on destination_cases to service_role;
set local role service_role;
select throws_ok($$select public.prepare_customer_payment_intake(repeat('7',64),(select details || jsonb_build_object('destinationLabel',repeat('x',301)) from destination_cases where kind='legacy'),'en','sandbox','destination-merchant','rest_v1_1',10490)$$,'23514',null,'an overlong frozen destination is rejected');
select throws_ok($$select public.prepare_customer_payment_intake(repeat('7',64),(select details || '{"destinationLabel":{}}'::jsonb from destination_cases where kind='legacy'),'en','sandbox','destination-merchant','rest_v1_1',10490)$$,'23514',null,'non-text frozen destinations are rejected');
select is((select count(*) from public.job_payment_requests where job_id='ee330000-0000-4000-8000-000000000017'),0::bigint,'invalid drafts roll back the payment reservation');
select public.prepare_customer_payment_intake(token_hash,details,'en','sandbox','destination-merchant','rest_v1_1',10490) from destination_cases;
select is((select details->>'destinationLabel' from public.customer_payment_intakes where job_id='ee330000-0000-4000-8000-000000000014'),'Workshop in Keflavík','checkout freezes the supplied destination');
select throws_ok($$select public.prepare_customer_payment_intake(token_hash,details || '{"destinationLabel":"Changed depot"}'::jsonb,'en','sandbox','destination-merchant','rest_v1_1',10490) from destination_cases where kind='new'$$,'22023','payment_details_locked','destination cannot change after checkout is prepared');
select is((select (public.prepare_customer_payment_intake(token_hash,details,'en','sandbox','destination-merchant','rest_v1_1',10490)->>'claimed')::boolean from destination_cases where kind='legacy'),false,'a legacy draft retry keeps exact details without adding a new key');
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='ee330000-0000-4000-8000-000000000014')),'not_ready','unpaid checkout cannot apply the destination');
select is((select destination_label from public.jobs where id='ee330000-0000-4000-8000-000000000014'),'Existing destination','preparing checkout does not change job details');
select public.finish_job_payment_creation(d.payment_request_id,c.provider_code,'https://demo.mypos.eu/pr/'||c.provider_code,'pending',null)
from public.customer_payment_intakes d join destination_cases c on c.job_id=d.job_id;
select public.record_job_payment_status(p.id,p.provider_code,p.amount_isk,p.currency,p.reference,'4','paid',now())
from public.job_payment_requests p join destination_cases c on c.job_id=p.job_id;
update public.customer_intake_links set created_at=now()-interval '2 hours',expires_at=now()-interval '1 second' where job_id in (select job_id from destination_cases);
select is(public.finalize_paid_customer_intake(d.payment_request_id),'submitted',c.kind||': verified Paid still finalizes after link expiry')
from public.customer_payment_intakes d join destination_cases c on c.job_id=d.job_id;
select is(j.destination_label,c.expected,c.kind||': finalization respects supplied, omitted and blank destinations') from public.jobs j join destination_cases c on c.job_id=j.id;
select is((select longitude from public.jobs where id='ee330000-0000-4000-8000-000000000014'),-21.9::double precision,'the destination does not change pickup longitude');
update public.jobs set destination_label='Later staff agreement' where id='ee330000-0000-4000-8000-000000000014';
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='ee330000-0000-4000-8000-000000000014')),'submitted','repeated paid completion remains idempotent');
select is((select destination_label from public.jobs where id='ee330000-0000-4000-8000-000000000014'),'Later staff agreement','duplicate completion cannot overwrite a later dispatcher edit');
select is((select count(*) from public.job_payment_requests where job_id='ee330000-0000-4000-8000-000000000014'),1::bigint,'destination handling creates no extra payment');

reset role;
select * from finish();
rollback;
