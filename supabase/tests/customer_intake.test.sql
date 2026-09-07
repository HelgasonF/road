begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(34);

select has_table('public', 'customer_intake_links', 'customer intake links table exists');
select has_table('public', 'job_photos', 'job photos table exists');
select has_column('public', 'jobs', 'customer_notes', 'jobs store customer-provided notes separately');
select has_column('public', 'jobs', 'customer_intake_submitted_at', 'jobs record customer intake submission time');
select has_column('public', 'jobs', 'rental_company', 'jobs store the customer-provided rental company');
select has_column('public', 'jobs', 'people_count', 'jobs store the number of people involved');
select has_function('public', 'create_customer_intake_link', 'staff link creation RPC exists');
select has_function('public', 'revoke_customer_intake_link', 'staff link revocation RPC exists');
select has_function('public', 'submit_customer_intake', 'atomic customer submission RPC exists');

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'job-photos'
      and public = false
      and file_size_limit = 10485760
  ),
  'job photo bucket is private and limited to 10 MiB files'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.customer_intake_links'::regclass),
  'customer intake links have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.job_photos'::regclass),
  'job photos have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.customer_intake_links', 'SELECT'),
  'anonymous users cannot read customer link records'
);
select ok(
  not has_table_privilege('anon', 'public.job_photos', 'SELECT'),
  'anonymous users cannot read photo metadata'
);
select is(
  (
    select count(*)
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in (
        'create_customer_intake_link',
        'revoke_customer_intake_link',
        'submit_customer_intake'
      )
      and grantee in ('PUBLIC', 'anon')
  ),
  0::bigint,
  'anonymous roles cannot execute customer intake RPCs'
);
select ok(
  has_function_privilege('authenticated', 'public.create_customer_intake_link(uuid,text,timestamp with time zone)', 'EXECUTE'),
  'authenticated staff can execute link creation RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.revoke_customer_intake_link(uuid)', 'EXECUTE'),
  'authenticated staff can execute link revocation RPC'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.submit_customer_intake_v2(text,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'server service role can execute customer submission RPC'
);
select ok(
  has_table_privilege('service_role', 'public.customer_intake_links', 'SELECT'),
  'server service role can validate hashed customer links'
);
select ok(
  has_table_privilege('service_role', 'public.job_photos', 'SELECT, INSERT, UPDATE, DELETE'),
  'server service role can manage private customer photo metadata'
);
select ok(
  has_table_privilege('service_role', 'public.jobs', 'SELECT'),
  'server service role can return the customer-facing job fields'
);

create temporary table customer_intake_test_identity as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

insert into public.jobs (
  id, customer_name, customer_phone, latitude, longitude,
  location_label, location_source, created_by
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'Initial customer',
  '555-1000',
  64.1466,
  -21.9426,
  'Initial location',
  'manual',
  (select id from customer_intake_test_identity)
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from customer_intake_test_identity),
  true
);
set local role authenticated;

select lives_ok(
  $$select public.create_customer_intake_link(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    repeat('a', 64),
    now() + interval '24 hours'
  )$$,
  'staff can create a customer intake link'
);
select is(
  (
    select count(*) from public.customer_intake_links
    where job_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
      and revoked_at is null
  ),
  1::bigint,
  'one active link exists after creation'
);
select lives_ok(
  $$select public.create_customer_intake_link(
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    repeat('b', 64),
    now() + interval '24 hours'
  )$$,
  'staff can rotate a customer intake link'
);
select ok(
  exists (
    select 1 from public.customer_intake_links
    where token_hash = repeat('a', 64) and revoked_at is not null
  ),
  'rotating a link revokes the old token'
);
select is(
  (
    select count(*) from public.customer_intake_links
    where token_hash = repeat('b', 64) and revoked_at is null
  ),
  1::bigint,
  'rotated token is the only active link'
);

reset role;
set local role service_role;
select lives_ok(
  $$select public.submit_customer_intake_v2(
    repeat('b', 64),
    'Updated Tourist',
    '+354 555 2000',
    'ABC12',
    'Toyota',
    'Blue Car Rental',
    3,
    64.2550,
    -21.1300,
    'Þingvellir',
    'gps',
    'Flat tyre on the front-left wheel'
  )$$,
  'valid customer token can submit intake atomically'
);
reset role;

select is(
  (
    select jsonb_build_object(
      'name', customer_name,
      'phone', customer_phone,
      'registration', vehicle_registration,
      'make', vehicle_make,
      'rental_company', rental_company,
      'people_count', people_count,
      'label', location_label,
      'source', location_source,
      'notes', customer_notes
    )
    from public.jobs
    where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  ),
  jsonb_build_object(
    'name', 'Updated Tourist',
    'phone', '+354 555 2000',
    'registration', 'ABC12',
    'make', 'Toyota',
    'rental_company', 'Blue Car Rental',
    'people_count', 3,
    'label', 'Þingvellir',
    'source', 'gps',
    'notes', 'Flat tyre on the front-left wheel'
  ),
  'submission updates only the intended customer job fields'
);
select ok(
  (select customer_intake_submitted_at is not null from public.jobs where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'),
  'job records when customer information was submitted'
);
select ok(
  (
    select submitted_at is not null
    from public.customer_intake_links
    where token_hash = repeat('b', 64)
  ),
  'customer link records successful submission'
);

set local role service_role;
select throws_ok(
  $$select public.submit_customer_intake_v2(
    repeat('b', 64), 'Again', '555-2000', null, null, null, 1,
    64.2, -21.1, 'Again', 'gps', 'Duplicate submission'
  )$$,
  'P0002',
  'Customer intake link is invalid or unavailable',
  'a submitted link cannot modify the job twice'
);
reset role;

insert into public.job_photos (
  id, job_id, customer_intake_link_id, storage_path,
  original_filename, content_type, size_bytes, uploaded_at
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  (select id from public.customer_intake_links where token_hash = repeat('b', 64)),
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1/cccccccc-cccc-4ccc-8ccc-ccccccccccc2.jpg',
  'car.jpg',
  'image/jpeg',
  12345,
  now()
);

set local role authenticated;
select is(
  (
    select count(*) from public.job_photos
    where job_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
  ),
  1::bigint,
  'staff can read private photo metadata through RLS'
);
reset role;

insert into public.jobs (
  id, customer_name, customer_phone, latitude, longitude,
  location_label, location_source, created_by
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'Unassigned customer',
  '555-3000',
  65.68,
  -18.11,
  'Unassigned location',
  'manual',
  (select id from customer_intake_test_identity)
);

insert into public.customer_intake_links (
  id, job_id, token_hash, expires_at, created_by
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  repeat('c', 64),
  now() + interval '24 hours',
  (select id from customer_intake_test_identity)
);

insert into public.job_photos (
  id, job_id, customer_intake_link_id, storage_path,
  original_filename, content_type, size_bytes, uploaded_at
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc5',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3/cccccccc-cccc-4ccc-8ccc-ccccccccccc5.jpg',
  'private.jpg',
  'image/jpeg',
  54321,
  now()
);

insert into public.operators (
  id, user_id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc6',
  (select id from customer_intake_test_identity),
  'Customer photo driver',
  '555-4000',
  'Hella',
  63.8355,
  -20.3987,
  'available',
  100
);

insert into public.job_assignments (
  id, job_id, operator_id, assigned_by
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc7',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc6',
  (select id from customer_intake_test_identity)
);

update public.profiles
set role = 'driver'
where id = (select id from customer_intake_test_identity);

set local role authenticated;
select is(
  (select count(*) from public.job_photos),
  1::bigint,
  'driver sees photo metadata only for their currently assigned job'
);
select is(
  (select count(*) from public.customer_intake_links),
  0::bigint,
  'driver cannot read customer link hashes or lifecycle records'
);
reset role;

select * from finish();
rollback;
