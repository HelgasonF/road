begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='public.driver_assignment_links'::regclass),'assignment credentials have RLS');
select ok(not has_table_privilege('anon','public.driver_assignment_links','SELECT'),'anonymous clients cannot read credentials');
select ok(not has_table_privilege('authenticated','public.driver_assignment_links','SELECT'),'signed-in clients cannot read credential hashes');
select ok(not has_function_privilege('anon','public.create_driver_assignment_link(uuid,uuid,text)','EXECUTE'),'anonymous callers cannot issue links');
select ok(not has_function_privilege('authenticated','public.resolve_driver_assignment_link(text)','EXECUTE'),'resolution is server-only');

create temporary table assignment_link_staff as select id from public.profiles where role in ('admin','dispatcher') limit 1;
insert into auth.users(id,email,raw_user_meta_data) values
('fc000000-0000-4000-8000-000000000001','reusable-driver@example.test','{}'),
('fc000000-0000-4000-8000-000000000007','replacement-driver@example.test','{}');
update public.profiles set role='driver' where id in ('fc000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000007');
insert into public.operators(id,user_id,name,phone,base_address,base_latitude,base_longitude)
values('fc000000-0000-4000-8000-000000000002','fc000000-0000-4000-8000-000000000001','Reusable Driver','+3545550101','Hella',63.8,-20.4);
insert into public.jobs(id,customer_name,customer_phone,latitude,longitude,location_source,status,created_by)
select ('fc000000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,'Link test','+3545550101',63.8,-20.4,'map_pin','assigned',(select id from assignment_link_staff)
from generate_series(1,6) n;
insert into public.job_assignments(id,job_id,operator_id,assigned_by)
select ('fc000000-0000-4000-8000-'||lpad((20+n)::text,12,'0'))::uuid,('fc000000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,'fc000000-0000-4000-8000-000000000002',(select id from assignment_link_staff)
from generate_series(1,6) n;

select set_config('request.jwt.claim.sub',(select id::text from assignment_link_staff),true);
set local role authenticated;
select lives_ok($$select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000011','fc000000-0000-4000-8000-000000000002',repeat('1',64))$$,'staff issue a link to the exact active assignment');
select public.create_driver_assignment_link(('fc000000-0000-4000-8000-'||lpad((10+n)::text,12,'0'))::uuid,'fc000000-0000-4000-8000-000000000002',repeat(n::text,64)) from generate_series(2,6) n;
select throws_ok($$select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000011','fc000000-0000-4000-8000-000000000002','bad')$$,'22023',null,'malformed credential hashes are rejected');
select throws_ok($$select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001',repeat('9',64))$$,'P0002',null,'staff cannot issue a link for a provider outside the current assignment');
reset role;

set local role service_role;
select is((select count(*) from public.resolve_driver_assignment_link(repeat('1',64))),1::bigint,'link resolves on first opening');
select is((select count(*) from public.resolve_driver_assignment_link(repeat('1',64))),1::bigint,'the same link resolves again without consumption');
select is((select driver_user_id from public.resolve_driver_assignment_link(repeat('1',64))),'fc000000-0000-4000-8000-000000000001'::uuid,'the link identifies the provisioned driver account');
select is((select count(*) from public.resolve_driver_assignment_link(repeat('0',64))),0::bigint,'unknown credentials reveal no assignment');
reset role;

select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select throws_ok($$select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000011','fc000000-0000-4000-8000-000000000002',repeat('9',64))$$,'42501',null,'drivers cannot mint assignment credentials');
reset role;
select set_config('request.jwt.claim.sub',(select id::text from assignment_link_staff),true);
set local role authenticated;
select lives_ok($$select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000011','fc000000-0000-4000-8000-000000000002',repeat('a',64))$$,'staff can replace a link');
reset role;
select is((select count(*) from public.resolve_driver_assignment_link(repeat('1',64))),0::bigint,'replacement closes the previous credential');
select is((select count(*) from public.resolve_driver_assignment_link(repeat('a',64))),1::bigint,'replacement credential is usable');

update public.jobs set status='completed',completed_at=now() where id='fc000000-0000-4000-8000-000000000011';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('a',64))),0::bigint,'completion closes the assignment link');
update public.jobs set status='assigned',completed_at=null where id='fc000000-0000-4000-8000-000000000011';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('a',64))),0::bigint,'reopening a job cannot revive a completed credential');
update public.jobs set status='cancelled' where id='fc000000-0000-4000-8000-000000000012';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('2',64))),0::bigint,'cancellation closes the assignment link');

update public.job_assignments set unassigned_at=now() where id='fc000000-0000-4000-8000-000000000023';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('3',64))),0::bigint,'unassignment closes the link');
insert into public.job_assignments(job_id,operator_id,assigned_by)
values('fc000000-0000-4000-8000-000000000013','fc000000-0000-4000-8000-000000000002',(select id from assignment_link_staff));
select is((select count(*) from public.resolve_driver_assignment_link(repeat('3',64))),0::bigint,'reassigning even to the original provider cannot revive the old assignment link');

update public.operators set driver_access_disabled_at=now() where id='fc000000-0000-4000-8000-000000000002';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('4',64))),0::bigint,'disabling provider access closes its links');
update public.operators set driver_access_disabled_at=null where id='fc000000-0000-4000-8000-000000000002';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('4',64))),0::bigint,'re-enabling access does not revive old links');

set local role authenticated;
select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000015','fc000000-0000-4000-8000-000000000002',repeat('b',64));
reset role;
update public.profiles set role='pending' where id='fc000000-0000-4000-8000-000000000001';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('b',64))),0::bigint,'removing the driver role closes its credential');
update public.profiles set role='driver' where id='fc000000-0000-4000-8000-000000000001';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('b',64))),0::bigint,'restoring the role cannot revive the credential');

set local role authenticated;
select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000016','fc000000-0000-4000-8000-000000000002',repeat('c',64));
reset role;
update public.operators set is_active=false where id='fc000000-0000-4000-8000-000000000002';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('c',64))),0::bigint,'deactivating a provider closes its links');
update public.operators set is_active=true where id='fc000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.create_driver_assignment_link('fc000000-0000-4000-8000-000000000016','fc000000-0000-4000-8000-000000000002',repeat('d',64));
reset role;
update public.operators set user_id='fc000000-0000-4000-8000-000000000007' where id='fc000000-0000-4000-8000-000000000002';
select is((select count(*) from public.resolve_driver_assignment_link(repeat('d',64))),0::bigint,'changing the provider account closes its existing link');
select * from finish();
rollback;
