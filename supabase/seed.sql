-- Local-only dispatcher account used by the browser workflow and pgTAP tests.
-- Supabase never applies seed.sql to the linked hosted project.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'dispatcher@vegstod.local',
  extensions.crypt('LocalVegstod2026', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Local Dispatcher"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

update public.profiles
set role = 'admin'
where id = '00000000-0000-4000-8000-000000000001';

insert into public.operators (
  id, name, phone, company_name, is_active, availability_status,
  base_address, base_latitude, base_longitude, service_radius_km, notes
)
values
  ('10000000-0000-4000-8000-000000000001', 'Jón Einarsson', '555-0101', 'Vegahjálp Suðurlands', true, 'available', 'Hella, Rangárþing ytra', 63.834570, -20.402203, 160, 'Bækistöð á Hellu.'),
  ('10000000-0000-4000-8000-000000000002', 'Anna S. Jónsdóttir', '555-0102', 'Norðurhjálp', true, 'busy', 'Akureyri, Ísland', 65.6839, -18.1105, 190, 'Sérhæfing í rafbílum og vetraraðstæðum.'),
  ('10000000-0000-4000-8000-000000000003', 'Bjarni Ólafsson', '555-0103', 'Vestfjarðabjörgun', true, 'available', 'Ísafjörður, Ísland', 66.0749, -23.1340, 210, '4×4 björgun á Vestfjörðum.'),
  ('10000000-0000-4000-8000-000000000004', 'Elín Guðmundsdóttir', '555-0104', 'Austurdráttur', true, 'offline', 'Egilsstaðir, Múlaþing', 65.2632, -14.3948, 220, 'Þungabjörgun og flutningapallur.')
on conflict (id) do nothing;

insert into public.operator_capabilities (operator_id, capability_code)
values
  ('10000000-0000-4000-8000-000000000001', 'towing'),
  ('10000000-0000-4000-8000-000000000001', 'flatbed'),
  ('10000000-0000-4000-8000-000000000001', 'jump_start'),
  ('10000000-0000-4000-8000-000000000002', 'jump_start'),
  ('10000000-0000-4000-8000-000000000002', 'tire_assistance'),
  ('10000000-0000-4000-8000-000000000002', 'ev_assistance'),
  ('10000000-0000-4000-8000-000000000003', 'towing'),
  ('10000000-0000-4000-8000-000000000003', 'four_by_four_recovery'),
  ('10000000-0000-4000-8000-000000000003', 'accident_recovery'),
  ('10000000-0000-4000-8000-000000000004', 'flatbed'),
  ('10000000-0000-4000-8000-000000000004', 'heavy_vehicle')
on conflict do nothing;

insert into public.vehicles (
  id, operator_id, name, registration_number, vehicle_type,
  max_vehicle_weight_kg, is_active, notes
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Pallbíll 1', 'VH-101', 'flatbed_truck', 3500, true, null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Þjónustubíll Norðurs', 'NH-202', 'service_van', 2500, true, 'Ræsibúnaður og EV öryggisbúnaður.'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Fjallabíll', 'VF-303', 'recovery_4x4', 5000, true, 'Vinda og torfærubúnaður.'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Þungapallur', 'AD-404', 'heavy_recovery', 18000, true, null)
on conflict (id) do nothing;

insert into public.vehicle_capabilities (vehicle_id, capability_code)
values
  ('20000000-0000-4000-8000-000000000001', 'towing'),
  ('20000000-0000-4000-8000-000000000001', 'flatbed'),
  ('20000000-0000-4000-8000-000000000002', 'jump_start'),
  ('20000000-0000-4000-8000-000000000002', 'ev_assistance'),
  ('20000000-0000-4000-8000-000000000003', 'four_by_four_recovery'),
  ('20000000-0000-4000-8000-000000000003', 'accident_recovery'),
  ('20000000-0000-4000-8000-000000000004', 'flatbed'),
  ('20000000-0000-4000-8000-000000000004', 'heavy_vehicle')
on conflict do nothing;
