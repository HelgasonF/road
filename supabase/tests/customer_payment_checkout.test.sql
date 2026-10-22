begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_table_privilege('anon', 'public.customer_payment_intakes', 'SELECT'), 'private drafts are unavailable to anonymous database clients');
select ok(not has_table_privilege('authenticated', 'public.customer_payment_intakes', 'UPDATE'), 'signed-in clients cannot change frozen drafts');
select ok(not has_table_privilege('anon', 'public.job_payment_pages', 'SELECT'), 'public database access cannot enumerate payment pages');
select ok(not has_function_privilege('authenticated', 'public.finalize_paid_customer_intake(uuid)', 'EXECUTE'), 'only the server may finalize a paid form');
select ok(not has_function_privilege('anon', 'public.claim_due_job_payments(text,text,text)', 'EXECUTE'), 'the unattended worker is not an anonymous RPC');

insert into auth.users(id,email,raw_user_meta_data) values
('bb000000-0000-4000-8000-000000000001','checkout-staff@example.test','{}');
update public.profiles set role = 'dispatcher' where id = 'bb000000-0000-4000-8000-000000000001';
insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_label,location_source,intake_pending,created_by)
values ('bb000000-0000-4000-8000-000000000010','Viðskiptavinur','+3545550101',64.95,-18.7,null,'manual',true,'bb000000-0000-4000-8000-000000000001'),
('bb000000-0000-4000-8000-000000000011','Viðskiptavinur','+3545550102',64.95,-18.7,null,'manual',true,'bb000000-0000-4000-8000-000000000001');
insert into public.customer_intake_links(id,job_id,token_hash,expires_at,created_by) values
('bb000000-0000-4000-8000-000000000020','bb000000-0000-4000-8000-000000000010',repeat('c',64),now()+interval '1 hour','bb000000-0000-4000-8000-000000000001'),
('bb000000-0000-4000-8000-000000000021','bb000000-0000-4000-8000-000000000011',repeat('d',64),now()+interval '1 hour','bb000000-0000-4000-8000-000000000001');

create temporary table checkout_details(d jsonb);
insert into checkout_details values ('{"customerName":"Draft Customer","customerPhone":"+3545550101","vehicleRegistration":"AB123","vehicleMake":"Ford","rentalCompany":null,"peopleCount":2,"requiredCapability":"jump_start","latitude":64.14,"longitude":-21.9,"locationLabel":"Reykjavík","locationSource":"map_pin","customerNotes":"Battery needs assistance."}');
grant select on checkout_details to service_role;
set local role service_role;

select throws_ok($$select public.prepare_customer_payment_intake(repeat('f',64),(select d from checkout_details),'en','sandbox','merchant','rest_v1_1',5000)$$,
'P0002','payment_link_unavailable','an invalid token cannot reserve another job payment');
select is((public.prepare_customer_payment_intake(repeat('c',64),(select d from checkout_details),'en','sandbox','merchant','rest_v1_1',5000)->>'claimed')::boolean,true,'one transaction saves the draft and reserves payment');
select is((select count(*) from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000010'),1::bigint,'the full draft is durable before external checkout');
select is((select customer_name from public.jobs where id='bb000000-0000-4000-8000-000000000010'),'Viðskiptavinur','draft details are not yet a submitted intake');
select is((select submitted_at from public.customer_intake_links where id='bb000000-0000-4000-8000-000000000020'),null::timestamptz,'checkout preparation does not submit the form');
select is((public.prepare_customer_payment_intake(repeat('c',64),(select d from checkout_details),'en','sandbox','merchant','rest_v1_1',5000)->>'claimed')::boolean,false,'a repeated click returns the reservation without a second creation claim');
select throws_ok($$select public.prepare_customer_payment_intake(repeat('c',64),(select d || '{"customerName":"Other Customer"}' from checkout_details),'en','sandbox','merchant','rest_v1_1',5000)$$,
'22023','payment_details_locked','a payment cannot silently switch to different submitted details');
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000010')),'not_ready','an unpaid form cannot be finalized');

select public.finish_job_payment_creation((select payment_request_id from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000010'),'BCHECKOUT','https://demo.mypos.eu/pr/BCHECKOUT','pending',null);
select is((select count(*) from public.claim_due_job_payments('sandbox','wrong-merchant','rest_v1_1')),0::bigint,'a worker cannot claim a different merchant');
select is((select count(*) from public.claim_due_job_payments('sandbox','merchant','rest_v1_1')),1::bigint,'the background worker claims a pending request');
select is((select count(*) from public.claim_due_job_payments('sandbox','merchant','rest_v1_1')),0::bigint,'overlapping worker passes respect the lease');
select public.record_job_payment_status(p.id,p.provider_code,p.amount_isk,p.currency,p.reference,'4','paid',now())
from public.job_payment_requests p where p.job_id='bb000000-0000-4000-8000-000000000010';
update public.job_payment_requests set next_check_at=now()-interval '1 minute' where job_id='bb000000-0000-4000-8000-000000000010';
select is((select count(*) from public.claim_due_job_payments('sandbox','merchant','rest_v1_1')),1::bigint,'a Paid row with an unfinished draft is recovered by the next worker after interruption');
reset role;
update public.customer_intake_links set created_at=now()-interval '2 hours', expires_at=now()-interval '1 minute' where id='bb000000-0000-4000-8000-000000000020';
set local role service_role;
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000010')),'submitted','verified Paid finalizes without a browser, even after link expiry');
select is((select customer_name from public.jobs where id='bb000000-0000-4000-8000-000000000010'),'Draft Customer','finalization applies the exact frozen customer name');
select is((select vehicle_registration from public.jobs where id='bb000000-0000-4000-8000-000000000010'),'AB123','finalization applies the saved vehicle details');
select is((select intake_pending from public.jobs where id='bb000000-0000-4000-8000-000000000010'),false,'Paid releases the submitted intake to dispatch');
select is((select status::text from public.jobs where id='bb000000-0000-4000-8000-000000000010'),'new','payment does not complete or dispatch the operational job');
select ok((select submitted_at is not null from public.customer_intake_links where id='bb000000-0000-4000-8000-000000000020'),'the original link is marked submitted');
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000010')),'submitted','repeated completion is idempotent');
select is((select count(*) from public.job_required_capabilities where job_id='bb000000-0000-4000-8000-000000000010'),1::bigint,'repeated completion cannot duplicate assistance requirements');
update public.job_payment_requests set next_check_at=now()-interval '1 minute' where job_id='bb000000-0000-4000-8000-000000000010';
select is((select count(*) from public.claim_due_job_payments('sandbox','merchant','rest_v1_1')),0::bigint,'a completed paid draft stops being polled');

select is((public.prepare_service_payment_page('bb000000-0000-4000-8000-000000000010',27000,'Jump start service','sandbox','merchant','rest_v1_1','bb000000-0000-4000-8000-000000000001',repeat('e',64),now()+interval '24 hours')->>'claimed')::boolean,true,'the dispatcher reserves a separate second amount and summary');
select is((select description from public.job_payment_pages where token_hash=repeat('e',64)),'Jump start service','the customer page retains the dispatcher description');
select is((public.prepare_service_payment_page('bb000000-0000-4000-8000-000000000010',27000,'Jump start service','sandbox','merchant','rest_v1_1','bb000000-0000-4000-8000-000000000001',repeat('f',64),now()+interval '24 hours')->>'claimed')::boolean,false,'reissuing a page does not reserve another payment');
select is((select count(*) from public.job_payment_pages where token_hash=repeat('e',64)),0::bigint,'reissuing invalidates the old private page token');
select throws_ok($$select public.prepare_service_payment_page('bb000000-0000-4000-8000-000000000010',1,'Jump start service','sandbox','merchant','rest_v1_1','bb000000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '1 hour')$$,
'22023','payment_details_locked','a changed amount cannot rotate the existing private page');
select is((select count(*) from public.job_payment_pages where token_hash=repeat('f',64)),1::bigint,'a rejected edit leaves the existing summary link valid');
select throws_ok($$select public.prepare_service_payment_page('bb000000-0000-4000-8000-000000000010',27000,'Different description','sandbox','merchant','rest_v1_1','bb000000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '1 hour')$$,
'22023','payment_details_locked','a created payment cannot silently change its description');
select is((select count(*) from public.job_payment_requests where job_id='bb000000-0000-4000-8000-000000000010'),2::bigint,'there are exactly two independent payment purposes');

select public.prepare_customer_payment_intake(repeat('d',64),(select d from checkout_details),'en','sandbox','merchant','rest_v1_1',5000);
select public.finish_job_payment_creation((select payment_request_id from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000011'),'BREVOKED','https://demo.mypos.eu/pr/BREVOKED','pending',null);
select public.record_job_payment_status(p.id,p.provider_code,p.amount_isk,p.currency,p.reference,'4','paid',now())
from public.job_payment_requests p where p.job_id='bb000000-0000-4000-8000-000000000011';
reset role;
update public.customer_intake_links set revoked_at=now() where id='bb000000-0000-4000-8000-000000000021';
set local role service_role;
select is(public.finalize_paid_customer_intake((select payment_request_id from public.customer_payment_intakes where job_id='bb000000-0000-4000-8000-000000000011')),'review_required','a revoked paid draft requires staff review instead of overwriting the job');
select is((select customer_name from public.jobs where id='bb000000-0000-4000-8000-000000000011'),'Viðskiptavinur','a revoked form does not update customer details');
reset role;
select * from finish();
rollback;
