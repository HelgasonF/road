create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create type public.app_role as enum ('pending', 'dispatcher', 'admin');
create type public.operator_availability as enum ('available', 'busy', 'offline', 'unavailable');
create type public.vehicle_type as enum (
  'tow_truck',
  'flatbed_truck',
  'service_van',
  'recovery_4x4',
  'heavy_recovery',
  'other'
);
create type public.job_status as enum (
  'new',
  'assigned',
  'accepted',
  'en_route',
  'on_scene',
  'in_progress',
  'transporting',
  'completed',
  'cancelled'
);
create type public.job_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.location_source as enum ('search', 'map_pin', 'manual', 'gps');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.app_role not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.capabilities (
  code text primary key,
  sort_order integer not null unique check (sort_order > 0),
  created_at timestamptz not null default now()
);

insert into public.capabilities (code, sort_order)
values
  ('towing', 10),
  ('flatbed', 20),
  ('jump_start', 30),
  ('tire_assistance', 40),
  ('fuel_delivery', 50),
  ('lockout', 60),
  ('four_by_four_recovery', 70),
  ('ev_assistance', 80),
  ('accident_recovery', 90),
  ('heavy_vehicle', 100),
  ('other', 110);

create table public.operators (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  phone text not null check (length(trim(phone)) between 3 and 40),
  company_name text check (company_name is null or length(trim(company_name)) between 1 and 120),
  is_active boolean not null default true,
  availability_status public.operator_availability not null default 'offline',
  base_latitude double precision not null check (base_latitude between -90 and 90),
  base_longitude double precision not null check (base_longitude between -180 and 180),
  base_location extensions.geography(Point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(base_longitude, base_latitude), 4326)::extensions.geography
    ) stored,
  current_latitude double precision check (current_latitude between -90 and 90),
  current_longitude double precision check (current_longitude between -180 and 180),
  current_location extensions.geography(Point, 4326)
    generated always as (
      case
        when current_latitude is not null and current_longitude is not null
          then extensions.st_setsrid(extensions.st_makepoint(current_longitude, current_latitude), 4326)::extensions.geography
        else null
      end
    ) stored,
  current_location_updated_at timestamptz,
  service_radius_km numeric(7, 2) check (service_radius_km is null or service_radius_km > 0),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_current_coordinates_complete check (
    (current_latitude is null and current_longitude is null)
    or (current_latitude is not null and current_longitude is not null)
  )
);

create index operators_base_location_gix on public.operators using gist (base_location);
create index operators_current_location_gix on public.operators using gist (current_location);
create index operators_operational_status_idx
  on public.operators (is_active, availability_status);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  registration_number text check (registration_number is null or length(trim(registration_number)) <= 24),
  vehicle_type public.vehicle_type not null,
  max_vehicle_weight_kg integer check (max_vehicle_weight_kg is null or max_vehicle_weight_kg > 0),
  is_active boolean not null default true,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicles_operator_id_idx on public.vehicles (operator_id);
create unique index vehicles_registration_number_uidx
  on public.vehicles (upper(registration_number))
  where registration_number is not null;

create table public.operator_capabilities (
  operator_id uuid not null references public.operators (id) on delete cascade,
  capability_code text not null references public.capabilities (code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (operator_id, capability_code)
);

create index operator_capabilities_code_idx
  on public.operator_capabilities (capability_code, operator_id);

create table public.vehicle_capabilities (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  capability_code text not null references public.capabilities (code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, capability_code)
);

create index vehicle_capabilities_code_idx
  on public.vehicle_capabilities (capability_code, vehicle_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (length(trim(customer_name)) between 2 and 120),
  customer_phone text not null check (length(trim(customer_phone)) between 3 and 40),
  vehicle_registration text,
  vehicle_make text,
  vehicle_model text,
  vehicle_type text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location extensions.geography(Point, 4326)
    generated always as (
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    ) stored,
  location_label text,
  location_source public.location_source not null,
  status public.job_status not null default 'new',
  priority public.job_priority not null default 'normal',
  notes text check (notes is null or length(notes) <= 4000),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint job_completed_at_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  )
);

create index jobs_location_gix on public.jobs using gist (location);
create index jobs_status_created_at_idx on public.jobs (status, created_at desc);

create table public.job_required_capabilities (
  job_id uuid not null references public.jobs (id) on delete cascade,
  capability_code text not null references public.capabilities (code) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (job_id, capability_code)
);

create index job_required_capabilities_code_idx
  on public.job_required_capabilities (capability_code, job_id);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  operator_id uuid not null references public.operators (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete restrict,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  unassigned_at timestamptz,
  notes text check (notes is null or length(notes) <= 2000),
  constraint assignment_timeline_valid check (
    (accepted_at is null or accepted_at >= assigned_at)
    and (unassigned_at is null or unassigned_at >= assigned_at)
  )
);

create unique index job_assignments_one_current_uidx
  on public.job_assignments (job_id)
  where unassigned_at is null;
create index job_assignments_operator_active_idx
  on public.job_assignments (operator_id, assigned_at desc)
  where unassigned_at is null;

create table public.job_status_history (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  changed_by uuid not null references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default now(),
  notes text check (notes is null or length(notes) <= 2000)
);

create index job_status_history_job_time_idx
  on public.job_status_history (job_id, changed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger operators_set_updated_at before update on public.operators
for each row execute function public.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Notandi')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('dispatcher', 'admin')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

create or replace function public.save_operator(
  p_id uuid,
  p_name text,
  p_phone text,
  p_company_name text,
  p_is_active boolean,
  p_availability_status public.operator_availability,
  p_base_latitude double precision,
  p_base_longitude double precision,
  p_current_latitude double precision,
  p_current_longitude double precision,
  p_service_radius_km numeric,
  p_notes text,
  p_capabilities text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if coalesce(array_length(p_capabilities, 1), 0) = 0 then
    raise exception 'At least one capability is required';
  end if;

  if p_id is null then
    insert into public.operators (
      name, phone, company_name, is_active, availability_status,
      base_latitude, base_longitude, current_latitude, current_longitude,
      current_location_updated_at, service_radius_km, notes
    ) values (
      p_name, p_phone, p_company_name, p_is_active, p_availability_status,
      p_base_latitude, p_base_longitude, p_current_latitude, p_current_longitude,
      case when p_current_latitude is not null then now() else null end,
      p_service_radius_km, p_notes
    ) returning id into saved_id;
  else
    update public.operators
    set name = p_name,
        phone = p_phone,
        company_name = p_company_name,
        is_active = p_is_active,
        availability_status = p_availability_status,
        base_latitude = p_base_latitude,
        base_longitude = p_base_longitude,
        current_latitude = p_current_latitude,
        current_longitude = p_current_longitude,
        current_location_updated_at = case
          when current_latitude is distinct from p_current_latitude
            or current_longitude is distinct from p_current_longitude
          then case when p_current_latitude is null then null else now() end
          else current_location_updated_at
        end,
        service_radius_km = p_service_radius_km,
        notes = p_notes
    where id = p_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Operator not found';
    end if;
  end if;

  delete from public.operator_capabilities where operator_id = saved_id;
  insert into public.operator_capabilities (operator_id, capability_code)
  select saved_id, code
  from unnest(p_capabilities) as code;

  return saved_id;
end;
$$;

create or replace function public.save_vehicle(
  p_id uuid,
  p_operator_id uuid,
  p_name text,
  p_registration_number text,
  p_vehicle_type public.vehicle_type,
  p_max_vehicle_weight_kg integer,
  p_is_active boolean,
  p_notes text,
  p_capabilities text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if coalesce(array_length(p_capabilities, 1), 0) = 0 then
    raise exception 'At least one capability is required';
  end if;

  if p_id is null then
    insert into public.vehicles (
      operator_id, name, registration_number, vehicle_type,
      max_vehicle_weight_kg, is_active, notes
    ) values (
      p_operator_id, p_name, p_registration_number, p_vehicle_type,
      p_max_vehicle_weight_kg, p_is_active, p_notes
    ) returning id into saved_id;
  else
    update public.vehicles
    set operator_id = p_operator_id,
        name = p_name,
        registration_number = p_registration_number,
        vehicle_type = p_vehicle_type,
        max_vehicle_weight_kg = p_max_vehicle_weight_kg,
        is_active = p_is_active,
        notes = p_notes
    where id = p_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Vehicle not found';
    end if;
  end if;

  delete from public.vehicle_capabilities where vehicle_id = saved_id;
  insert into public.vehicle_capabilities (vehicle_id, capability_code)
  select saved_id, code
  from unnest(p_capabilities) as code;

  return saved_id;
end;
$$;

revoke all on function public.save_operator(
  uuid, text, text, text, boolean, public.operator_availability,
  double precision, double precision, double precision, double precision,
  numeric, text, text[]
) from public;
grant execute on function public.save_operator(
  uuid, text, text, text, boolean, public.operator_availability,
  double precision, double precision, double precision, double precision,
  numeric, text, text[]
) to authenticated;

revoke all on function public.save_vehicle(
  uuid, uuid, text, text, public.vehicle_type, integer, boolean, text, text[]
) from public;
grant execute on function public.save_vehicle(
  uuid, uuid, text, text, public.vehicle_type, integer, boolean, text, text[]
) to authenticated;

-- New Supabase projects no longer auto-expose public objects to Data API roles.
-- Keep grants explicit; RLS below remains the authorization boundary.
grant usage on schema public to authenticated;
grant select on public.profiles, public.capabilities to authenticated;
grant select, insert, update on public.operators, public.vehicles to authenticated;
grant select, insert, delete on public.operator_capabilities, public.vehicle_capabilities to authenticated;
grant select, insert, update on public.jobs, public.job_assignments, public.job_status_history to authenticated;
grant select, insert, delete on public.job_required_capabilities to authenticated;
grant usage, select on sequence public.job_status_history_id_seq to authenticated;

alter table public.profiles enable row level security;
alter table public.capabilities enable row level security;
alter table public.operators enable row level security;
alter table public.vehicles enable row level security;
alter table public.operator_capabilities enable row level security;
alter table public.vehicle_capabilities enable row level security;
alter table public.jobs enable row level security;
alter table public.job_required_capabilities enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_status_history enable row level security;

create policy "Staff can read profiles" on public.profiles
for select to authenticated using ((select public.is_staff()));

create policy "Staff can read capabilities" on public.capabilities
for select to authenticated using ((select public.is_staff()));

create policy "Staff can read operators" on public.operators
for select to authenticated using ((select public.is_staff()));
create policy "Staff can insert operators" on public.operators
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can update operators" on public.operators
for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "Staff can read vehicles" on public.vehicles
for select to authenticated using ((select public.is_staff()));
create policy "Staff can insert vehicles" on public.vehicles
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can update vehicles" on public.vehicles
for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "Staff can read operator capabilities" on public.operator_capabilities
for select to authenticated using ((select public.is_staff()));
create policy "Staff can insert operator capabilities" on public.operator_capabilities
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can delete operator capabilities" on public.operator_capabilities
for delete to authenticated using ((select public.is_staff()));

create policy "Staff can read vehicle capabilities" on public.vehicle_capabilities
for select to authenticated using ((select public.is_staff()));
create policy "Staff can insert vehicle capabilities" on public.vehicle_capabilities
for insert to authenticated with check ((select public.is_staff()));
create policy "Staff can delete vehicle capabilities" on public.vehicle_capabilities
for delete to authenticated using ((select public.is_staff()));

create policy "Staff manage jobs" on public.jobs
for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff manage job requirements" on public.job_required_capabilities
for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff manage job assignments" on public.job_assignments
for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "Staff manage job status history" on public.job_status_history
for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
