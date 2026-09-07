begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select has_column('public', 'jobs', 'intake_pending', 'jobs can wait for customer intake');
select has_function('public', 'create_customer_intake_job', 'phone-first job creation RPC exists');
select has_function('public', 'submit_customer_intake_v3', 'assistance-aware intake submission RPC exists');
select ok(
  has_table_privilege('service_role', 'public.job_required_capabilities', 'SELECT'),
  'the server-only customer page can read an existing assistance requirement'
);

create temporary table phone_first_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

insert into public.operators (
  id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'Phone-first test operator',
  '555-9091',
  'Þingvellir test base',
  64.2550,
  -21.1300,
  'available',
  25
);

insert into public.operator_capabilities (operator_id, capability_code)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'tire_assistance');

select set_config(
  'request.jwt.claim.sub',
  (select id::text from phone_first_test_identity),
  true
);
set local role authenticated;

select lives_ok(
  $$select set_config(
    'test.phone_first_job_id',
    public.create_customer_intake_job(
      '+354 555 9090',
      repeat('d', 64),
      now() + interval '24 hours'
    )::text,
    true
  )$$,
  'staff can atomically create a pending job and customer link'
);

reset role;

select is(
  (
    select jsonb_build_object(
      'phone', customer_phone,
      'pending', intake_pending,
      'status', status,
      'source', location_source
    )
    from public.jobs
    where id = current_setting('test.phone_first_job_id')::uuid
  ),
  jsonb_build_object(
    'phone', '+354 555 9090',
    'pending', true,
    'status', 'new',
    'source', 'manual'
  ),
  'quick creation stores the telephone and marks the job as awaiting intake'
);

select is(
  (
    select count(*)
    from public.customer_intake_links
    where job_id = current_setting('test.phone_first_job_id')::uuid
      and token_hash = repeat('d', 64)
      and revoked_at is null
      and submitted_at is null
  ),
  1::bigint,
  'quick creation stores one active customer link'
);

select is(
  (
    select count(*)
    from public.job_required_capabilities
    where job_id = current_setting('test.phone_first_job_id')::uuid
  ),
  0::bigint,
  'a pending job has no guessed assistance requirement'
);

select is(
  (
    select count(*)
    from public.job_operator_matches
    where job_id = current_setting('test.phone_first_job_id')::uuid
  ),
  0::bigint,
  'pending jobs are excluded from driver matching'
);

set local role authenticated;
select throws_ok(
  $$select public.assign_job(
    current_setting('test.phone_first_job_id')::uuid,
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    null,
    null
  )$$,
  'P0001',
  'Customer intake must be completed before assignment',
  'a pending job cannot be assigned'
);
reset role;

set local role service_role;
select lives_ok(
  $$select public.submit_customer_intake_v3(
    repeat('d', 64),
    'Phone-first customer',
    '+354 555 9090',
    'TEST90',
    'Toyota',
    'Blue Car Rental',
    3,
    'tire_assistance',
    64.2550,
    -21.1300,
    'Þingvellir test location',
    'gps',
    'Flat front-left tyre near the visitor centre.'
  )$$,
  'customer submission completes the phone-first intake atomically'
);
reset role;

select is(
  (
    select jsonb_build_object(
      'name', customer_name,
      'pending', intake_pending,
      'people', people_count,
      'label', location_label,
      'notes', customer_notes
    )
    from public.jobs
    where id = current_setting('test.phone_first_job_id')::uuid
  ),
  jsonb_build_object(
    'name', 'Phone-first customer',
    'pending', false,
    'people', 3,
    'label', 'Þingvellir test location',
    'notes', 'Flat front-left tyre near the visitor centre.'
  ),
  'customer submission replaces the pending values and unlocks the job'
);

select is(
  (
    select capability_code
    from public.job_required_capabilities
    where job_id = current_setting('test.phone_first_job_id')::uuid
  ),
  'tire_assistance',
  'customer-selected assistance becomes the matching requirement'
);

select ok(
  (
    select submitted_at is not null
    from public.customer_intake_links
    where token_hash = repeat('d', 64)
  ),
  'customer link records the successful submission'
);

select ok(
  exists (
    select 1
    from public.job_operator_matches
    where job_id = current_setting('test.phone_first_job_id')::uuid
      and operator_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
      and has_required_capabilities
      and within_service_area
  ),
  'driver matching starts after intake with the submitted location and assistance'
);

set local role authenticated;
select lives_ok(
  $$select public.assign_job(
    current_setting('test.phone_first_job_id')::uuid,
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    null,
    null
  )$$,
  'the completed intake job can be assigned'
);
reset role;

select ok(
  exists (
    select 1
    from public.job_assignments
    where job_id = current_setting('test.phone_first_job_id')::uuid
      and operator_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
      and unassigned_at is null
  ),
  'assignment is stored after intake completes'
);

select * from finish();
rollback;
