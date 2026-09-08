begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authorized users can read job photo objects'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
  ),
  'authenticated users have a policy for authorized job photo objects'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'jobs'
  ),
  'jobs are available to Realtime subscribers'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_assignments'
  ),
  'job assignments are available to Realtime subscribers'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'operators'
  ),
  'operators are available to Realtime subscribers'
);

select is(
  (
    select count(*)
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'job_billing',
        'job_billing_events',
        'job_contact_events',
        'customer_intake_links',
        'job_photos'
      )
  ),
  0::bigint,
  'sensitive and unnecessary tables are excluded from Realtime'
);

create temporary table backend_prereq_staff as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

insert into public.jobs (
  id, customer_name, customer_phone, latitude, longitude,
  location_label, location_source, created_by
) values (
  'abababab-abab-4aba-8aba-ababababab01',
  'Backend prerequisite test',
  '555-9000',
  64.1466,
  -21.9426,
  'Reykjavik',
  'manual',
  (select id from backend_prereq_staff)
);

insert into public.customer_intake_links (
  id, job_id, token_hash, expires_at, created_by
) values (
  'abababab-abab-4aba-8aba-ababababab04',
  'abababab-abab-4aba-8aba-ababababab01',
  repeat('d', 64),
  now() + interval '24 hours',
  (select id from backend_prereq_staff)
);

insert into public.job_photos (
  id, job_id, customer_intake_link_id, storage_path, original_filename,
  content_type, size_bytes, uploaded_at
) values (
  'abababab-abab-4aba-8aba-ababababab02',
  'abababab-abab-4aba-8aba-ababababab01',
  'abababab-abab-4aba-8aba-ababababab04',
  'abababab-abab-4aba-8aba-ababababab01/abababab-abab-4aba-8aba-ababababab02.jpg',
  'test.jpg',
  'image/jpeg',
  1024,
  now()
);

insert into storage.objects (bucket_id, name, metadata)
values (
  'job-photos',
  'abababab-abab-4aba-8aba-ababababab01/abababab-abab-4aba-8aba-ababababab02.jpg',
  '{"mimetype":"image/jpeg","size":1024}'::jsonb
);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from backend_prereq_staff),
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'job-photos'
      and name = 'abababab-abab-4aba-8aba-ababababab01/abababab-abab-4aba-8aba-ababababab02.jpg'
  ),
  1::bigint,
  'staff can read a completed job photo object'
);

reset role;
update public.job_photos
set uploaded_at = null
where id = 'abababab-abab-4aba-8aba-ababababab02';
set local role authenticated;

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'job-photos'
      and name = 'abababab-abab-4aba-8aba-ababababab01/abababab-abab-4aba-8aba-ababababab02.jpg'
  ),
  0::bigint,
  'unfinished photo uploads cannot be read'
);

reset role;
update public.job_photos
set uploaded_at = now()
where id = 'abababab-abab-4aba-8aba-ababababab02';
select set_config('request.jwt.claim.sub', 'abababab-abab-4aba-8aba-ababababab03', true);
set local role authenticated;

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'job-photos'
      and name = 'abababab-abab-4aba-8aba-ababababab01/abababab-abab-4aba-8aba-ababababab02.jpg'
  ),
  0::bigint,
  'an unrelated authenticated user cannot read the photo object'
);

reset role;
insert into public.operators (
  id, user_id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'abababab-abab-4aba-8aba-ababababab05',
  (select id from backend_prereq_staff),
  'Backend prerequisite driver',
  '555-9001',
  'Reykjavik',
  64.1466,
  -21.9426,
  'available',
  100
);

insert into public.job_assignments (id, job_id, operator_id, assigned_by)
values (
  'abababab-abab-4aba-8aba-ababababab06',
  'abababab-abab-4aba-8aba-ababababab01',
  'abababab-abab-4aba-8aba-ababababab05',
  (select id from backend_prereq_staff)
);

update public.profiles
set role = 'driver'
where id = (select id from backend_prereq_staff);

select set_config(
  'request.jwt.claim.sub',
  (select id::text from backend_prereq_staff),
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'job-photos'
      and name = 'abababab-abab-4aba-8aba-ababababab01/abababab-abab-4aba-8aba-ababababab02.jpg'
  ),
  1::bigint,
  'the assigned driver can read the job photo object'
);

select * from finish();
rollback;
