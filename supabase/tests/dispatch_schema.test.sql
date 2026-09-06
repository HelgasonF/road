begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(41);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'operators', 'operators table exists');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_table('public', 'jobs', 'jobs table exists');
select has_table('public', 'job_assignments', 'job assignments table exists');
select has_table('public', 'job_status_history', 'job status history table exists');
select has_table('public', 'iceland_addresses', 'Iceland address search table exists');
select has_table('public', 'iceland_places', 'Iceland place-name search table exists');
select has_view('public', 'job_operator_matches', 'operator matching view exists');

select is(
  enum_range(null::public.job_status)::text,
  '{new,assigned,accepted,en_route,on_scene,in_progress,transporting,completed,cancelled}',
  'job status enum contains the complete operational lifecycle'
);

select is(
  (select count(*) from public.capabilities),
  11::bigint,
  'all eleven MVP capability codes exist'
);

select ok(
  (select attgenerated = 's'
   from pg_attribute
   where attrelid = 'public.operators'::regclass and attname = 'base_location'),
  'operator base geography is generated from coordinates'
);

select ok(
  (select attgenerated = 's'
   from pg_attribute
   where attrelid = 'public.jobs'::regclass and attname = 'location'),
  'job geography is generated from coordinates'
);

select ok(
  (select attgenerated = 's'
   from pg_attribute
   where attrelid = 'public.iceland_addresses'::regclass and attname = 'search_key'),
  'address search key is normalized by the database'
);

select ok(
  (select attgenerated = 's'
   from pg_attribute
   where attrelid = 'public.iceland_places'::regclass and attname = 'search_key'),
  'place-name search key is normalized by the database'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'operators'
      and indexname = 'operators_base_location_gix'
      and indexdef ilike '%using gist%'
  ),
  'operator geography has a GiST index'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'jobs'
      and indexname = 'jobs_location_gix'
      and indexdef ilike '%using gist%'
  ),
  'job geography has a GiST index'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'iceland_addresses'
      and indexname = 'iceland_addresses_search_key_gin'
      and indexdef ilike '%using gin%'
      and indexdef ilike '%gin_trgm_ops%'
  ),
  'address text search has a trigram GIN index'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'iceland_places'
      and indexname = 'iceland_places_search_key_gin'
      and indexdef ilike '%using gin%'
      and indexdef ilike '%gin_trgm_ops%'
  ),
  'place-name text search has a trigram GIN index'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'job_assignments'
      and indexname = 'job_assignments_one_current_uidx'
      and indexdef ilike '%unique%'
      and indexdef ilike '%where (unassigned_at is null)%'
  ),
  'only one current assignment is allowed per job'
);

select is(
  (select count(*)
   from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in (
       'profiles', 'capabilities', 'operators', 'operator_capabilities',
       'vehicles', 'vehicle_capabilities', 'jobs', 'iceland_addresses', 'iceland_places',
       'job_required_capabilities', 'job_assignments', 'job_status_history'
     )
     and relrowsecurity),
  12::bigint,
  'RLS is enabled on every private application table'
);

select is(
  (select count(*)
   from information_schema.routine_privileges
   where specific_schema = 'public'
     and routine_name in ('save_operator', 'save_vehicle', 'save_job', 'assign_job', 'set_job_status')
     and grantee in ('PUBLIC', 'anon')),
  0::bigint,
  'anonymous roles cannot execute mutation RPCs'
);

select is(
  (select count(distinct routine_name)
   from information_schema.routine_privileges
   where specific_schema = 'public'
     and routine_name in ('save_operator', 'save_vehicle', 'save_job', 'assign_job', 'set_job_status')
     and grantee = 'authenticated'
     and privilege_type = 'EXECUTE'),
  5::bigint,
  'authenticated staff can execute all five mutation RPCs'
);

select ok(
  to_regprocedure('public.save_operator(uuid,text,text,text,boolean,public.operator_availability,text,double precision,double precision,double precision,double precision,numeric,text,text[])') is not null,
  'atomic operator save RPC exists'
);

select ok(
  to_regprocedure('public.save_vehicle(uuid,uuid,text,text,public.vehicle_type,integer,boolean,text,text[])') is not null,
  'atomic vehicle save RPC exists'
);

select ok(
  to_regprocedure('public.save_job(uuid,text,text,text,text,text,text,double precision,double precision,text,public.location_source,public.job_priority,text,text[])') is not null,
  'atomic job save RPC exists'
);

select ok(
  to_regprocedure('public.assign_job(uuid,uuid,uuid,text)') is not null,
  'assignment RPC exists'
);

select ok(
  to_regprocedure('public.set_job_status(uuid,public.job_status,text)') is not null,
  'job status RPC exists'
);

select ok(
  to_regprocedure('public.search_iceland_addresses(text,integer)') is not null,
  'local Iceland address search RPC exists'
);

select ok(
  to_regprocedure('public.reverse_geocode_iceland_address(double precision,double precision,double precision)') is not null,
  'local Iceland reverse-geocoding RPC exists'
);

select ok(
  to_regclass('public.iceland_addresses_location_gix') is not null,
  'Iceland address coordinates have a spatial lookup index'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.normalize_icelandic_search(text)',
    'EXECUTE'
  ),
  'authenticated address search can execute its pure text normalizer'
);

select is(
  (select count(*)
   from information_schema.routine_privileges
   where specific_schema = 'public'
     and routine_name = 'search_iceland_addresses'
     and grantee in ('PUBLIC', 'anon')),
  0::bigint,
  'anonymous roles cannot execute address search'
);

select is(
  (select count(*)
   from information_schema.routine_privileges
   where specific_schema = 'public'
     and routine_name = 'reverse_geocode_iceland_address'
     and grantee in ('PUBLIC', 'anon')),
  0::bigint,
  'anonymous roles cannot execute reverse geocoding'
);

insert into public.iceland_addresses (
  source_id, address_label, street_name, house_number, postal_code,
  municipality_code, latitude, longitude, search_text, source_updated_at
) values (
  990001414, 'Bæjarlind 8, 201', 'Bæjarlind', '8', '201',
  '1000', 64.09987002, -21.87914013, 'Bæjarlind 8 201', '2009-02-23'
);

select is(
  (select label from public.search_iceland_addresses('Baejarlind 8', 5) limit 1),
  'Bæjarlind 8, 201',
  'address search handles partial accent-free Icelandic input'
);

select is(
  (select label
   from public.reverse_geocode_iceland_address(
     64.09987002::double precision,
     -21.87914013::double precision,
     250::double precision
   )
   limit 1),
  'Bæjarlind 8, 201',
  'a pin on a registered house resolves to its precise HMS address'
);

select is(
  (select count(*)
   from public.reverse_geocode_iceland_address(
     64.11::double precision,
     -21.95::double precision,
     25::double precision
   )),
  0::bigint,
  'reverse geocoding does not attach a distant house address to a pin'
);

insert into public.iceland_places (
  source_type, source_id, name, category, category_label, search_priority,
  latitude, longitude, search_text
) values (
  'node', 9201585514, 'Hella', 'town', 'þéttbýli', 95,
  63.8355038, -20.3987009, 'Hella town þéttbýli'
);

select is(
  (select label from public.search_iceland_addresses('Hella', 5) limit 1),
  'Hella · þéttbýli',
  'an exact populated-place match ranks above same-named address records'
);

insert into public.operators (
  id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'pgTAP operator',
  '555-9998',
  'Test base',
  64.1466,
  -21.9426,
  'available',
  10
);

insert into public.operator_capabilities (operator_id, capability_code)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'towing');

insert into public.jobs (
  id, customer_name, customer_phone, latitude, longitude,
  location_label, location_source, created_by
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  'pgTAP customer',
  '555-9999',
  64.1500,
  -21.9426,
  'Test incident',
  'manual',
  (select id from public.profiles where role in ('admin', 'dispatcher') limit 1)
);

insert into public.job_required_capabilities (job_id, capability_code)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'towing');

select ok(
  (select within_service_area
   from public.job_operator_matches
   where job_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
     and operator_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  'PostGIS match recognizes a nearby operator inside its service radius'
);

select ok(
  (select has_required_capabilities
   from public.job_operator_matches
   where job_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
     and operator_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  'matching recognizes complete operator capability coverage'
);

select ok(
  (select distance_km between 0.3 and 0.5
   from public.job_operator_matches
   where job_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'
     and operator_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  'PostGIS distance is returned in kilometers'
);

select * from finish();
rollback;
