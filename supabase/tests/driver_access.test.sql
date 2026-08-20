begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

select enum_has_labels(
  'public',
  'app_role',
  array['pending', 'dispatcher', 'admin', 'driver'],
  'app roles include a dedicated driver login'
);

select has_column('public', 'operators', 'user_id', 'operator can be linked to one login');
select has_column('public', 'job_assignments', 'declined_at', 'assignment records a decline');
select has_column('public', 'job_assignments', 'decline_reason', 'assignment records the decline reason');
select has_function('public', 'current_operator_id', array[]::text[], 'current operator helper exists');
select has_function('public', 'set_driver_availability', array['operator_availability'], 'driver availability RPC exists');
select has_function('public', 'respond_to_driver_assignment', array['uuid', 'boolean', 'text'], 'assignment response RPC exists');
select has_function('public', 'set_driver_job_status', array['uuid', 'job_status', 'text'], 'driver status RPC exists');

create temporary table driver_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

insert into public.operators (
  id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Driver access operator', '555-7001', 'Hella', 63.8355, -20.3987, 'available', 100),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'Other operator', '555-7002', 'Akureyri', 65.6839, -18.1105, 'available', 100);

insert into public.jobs (
  id, customer_name, customer_phone, latitude, longitude,
  location_label, location_source, created_by
) values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'Assigned customer', '555-7003', 63.9, -20.4, 'Assigned location', 'manual', (select id from driver_test_identity)),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'Private customer', '555-7004', 65.7, -18.1, 'Private location', 'manual', (select id from driver_test_identity));

insert into public.job_assignments (
  id, job_id, operator_id, assigned_by
) values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd5',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  (select id from driver_test_identity)
);

update public.jobs
set status = 'assigned'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3';

update public.profiles
set role = 'driver'
where id = (select id from driver_test_identity);

update public.operators
set user_id = (select id from driver_test_identity)
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';

select set_config(
  'request.jwt.claim.sub',
  (select id::text from driver_test_identity),
  true
);
set local role authenticated;

select is(
  public.current_operator_id(),
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'::uuid,
  'driver identity resolves to the linked operator'
);

select is(
  (select count(*) from public.operators),
  1::bigint,
  'driver can read only their own operator record'
);

select is(
  (select count(*) from public.jobs),
  1::bigint,
  'driver can read only their currently assigned job'
);

select lives_ok(
  $$select public.set_driver_availability('busy')$$,
  'driver can update their own availability through the restricted RPC'
);

select is(
  (select availability_status::text from public.operators),
  'busy',
  'driver availability update is visible'
);

select lives_ok(
  $$select public.respond_to_driver_assignment('dddddddd-dddd-4ddd-8ddd-ddddddddddd5', true, null)$$,
  'driver can accept their own current assignment'
);

select is(
  (select status::text from public.jobs),
  'accepted',
  'accepting changes the assigned job status'
);

select ok(
  (select accepted_at is not null from public.job_assignments where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd5'),
  'acceptance time is recorded'
);

select lives_ok(
  $$select public.set_driver_job_status('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'en_route', null)$$,
  'driver can advance an accepted job through an allowed transition'
);

select is(
  (select status::text from public.jobs),
  'en_route',
  'driver status transition is persisted'
);

reset role;
update public.jobs
set status = 'assigned'
where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';

insert into public.job_assignments (id, job_id, operator_id, assigned_by)
values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd6',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  (select id from driver_test_identity)
);
set local role authenticated;

select lives_ok(
  $$select public.respond_to_driver_assignment('dddddddd-dddd-4ddd-8ddd-ddddddddddd6', false, 'Búnaður ekki tiltækur')$$,
  'driver can decline their own new assignment with a reason'
);

reset role;
select is(
  (select status::text from public.jobs where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'),
  'new',
  'declining returns the job to the unassigned queue'
);

select is(
  (select decline_reason from public.job_assignments where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6'),
  'Búnaður ekki tiltækur',
  'decline reason is preserved for dispatch'
);

select ok(
  (select declined_at is not null and unassigned_at is not null from public.job_assignments where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd6'),
  'decline and unassignment times are recorded'
);

set local role authenticated;
select is(
  (select count(*) from public.jobs),
  1::bigint,
  'declined job disappears from the driver current-job view'
);

select throws_ok(
  $$select public.set_driver_job_status('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'completed', null)$$,
  'P0002',
  'Accepted assignment not found',
  'driver cannot update a job assigned to somebody else'
);

reset role;
select * from finish();
rollback;
