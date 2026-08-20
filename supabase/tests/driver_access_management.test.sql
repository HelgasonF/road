begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select has_column('public', 'operators', 'driver_invited_at', 'operator records when access was invited');
select has_column('public', 'operators', 'driver_access_activated_at', 'operator records when driver access was activated');
select has_column('public', 'operators', 'driver_access_disabled_at', 'operator records when driver access was disabled');
select has_function('public', 'link_driver_user', array['uuid', 'uuid'], 'staff driver-link RPC exists');
select has_function('public', 'set_driver_access_disabled', array['uuid', 'boolean'], 'staff access-toggle RPC exists');
select has_function('public', 'activate_current_driver_access', array[]::text[], 'driver activation RPC exists');

create temporary table access_test_staff as
select id
from public.profiles
where role in ('admin', 'dispatcher')
limit 1;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'authenticated',
  'authenticated',
  'access-test@vegstod.local',
  crypt('DriverAccess2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Access Test Driver"}'::jsonb,
  now(),
  now()
);

insert into public.operators (
  id, name, phone, base_address, base_latitude, base_longitude,
  availability_status, service_radius_km
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  'Access Test Driver',
  '555-8001',
  'Hella',
  63.8355,
  -20.3987,
  'available',
  100
);

select set_config('request.jwt.claim.sub', (select id::text from access_test_staff), true);
set local role authenticated;

select lives_ok(
  $$select public.link_driver_user('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')$$,
  'staff can link a pending Auth user to a service provider'
);

select is(
  (select role::text from public.profiles where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  'driver',
  'linking activates the driver role'
);

select is(
  (select user_id from public.operators where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
  'linking stores the one-to-one user association'
);

select ok(
  (select driver_invited_at is not null from public.operators where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  'linking records the invitation timestamp'
);

select lives_ok(
  $$select public.set_driver_access_disabled('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', true)$$,
  'staff can mark the linked driver access disabled'
);

select ok(
  (select driver_access_disabled_at is not null from public.operators where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  'disabled timestamp is stored'
);

select lives_ok(
  $$select public.set_driver_access_disabled('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', false)$$,
  'staff can re-enable the same driver access'
);

select ok(
  (select driver_access_disabled_at is null from public.operators where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  're-enabling clears the disabled timestamp'
);

select throws_ok(
  $$select public.link_driver_user('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', (select auth.uid()))$$,
  '42501',
  'Staff accounts cannot be linked as drivers',
  'staff accounts cannot be demoted into drivers'
);

reset role;
update public.profiles set role = 'driver' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', true);
set local role authenticated;

select lives_ok(
  $$select public.activate_current_driver_access()$$,
  'linked driver can record successful account activation'
);

select ok(
  (select driver_access_activated_at is not null from public.operators where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'),
  'activation timestamp is stored'
);

reset role;
select * from finish();
rollback;
