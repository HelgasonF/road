alter table public.jobs
add column customer_notes text,
add column customer_intake_submitted_at timestamptz;

alter table public.jobs
add constraint jobs_customer_notes_length
check (customer_notes is null or length(trim(customer_notes)) between 5 and 4000);

create table public.customer_intake_links (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  submitted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint customer_intake_link_expiry_valid check (expires_at > created_at),
  constraint customer_intake_link_timeline_valid check (
    (revoked_at is null or revoked_at >= created_at)
    and (submitted_at is null or submitted_at >= created_at)
  )
);

create index customer_intake_links_job_created_idx
on public.customer_intake_links (job_id, created_at desc);

create unique index customer_intake_links_one_open_per_job_uidx
on public.customer_intake_links (job_id)
where revoked_at is null and submitted_at is null;

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  customer_intake_link_id uuid not null references public.customer_intake_links (id) on delete restrict,
  storage_path text not null unique check (length(storage_path) between 10 and 500),
  original_filename text not null check (length(trim(original_filename)) between 1 and 255),
  content_type text not null check (content_type in (
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index job_photos_job_created_idx
on public.job_photos (job_id, created_at);

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'job-photos',
  'job-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

grant select on public.customer_intake_links, public.job_photos to authenticated;

alter table public.customer_intake_links enable row level security;
alter table public.job_photos enable row level security;

create policy "Staff can read customer intake links" on public.customer_intake_links
for select to authenticated
using ((select public.is_staff()));

create policy "Authorized users can read job photos" on public.job_photos
for select to authenticated
using (
  (select public.is_staff())
  or (select public.driver_has_job(job_id))
);

create or replace function public.create_customer_intake_link(
  p_job_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid token hash';
  end if;

  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'Invalid customer link expiry';
  end if;

  if not exists (
    select 1 from public.jobs job
    where job.id = p_job_id
      and job.status not in ('completed', 'cancelled')
  ) then
    raise exception 'Open job not found' using errcode = 'P0002';
  end if;

  update public.customer_intake_links
  set revoked_at = now()
  where job_id = p_job_id
    and revoked_at is null
    and submitted_at is null;

  insert into public.customer_intake_links (
    job_id, token_hash, expires_at, created_by
  ) values (
    p_job_id, p_token_hash, p_expires_at, (select auth.uid())
  )
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.revoke_customer_intake_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  update public.customer_intake_links
  set revoked_at = coalesce(revoked_at, now())
  where id = p_link_id;

  if not found then
    raise exception 'Customer intake link not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.submit_customer_intake(
  p_token_hash text,
  p_customer_name text,
  p_customer_phone text,
  p_vehicle_registration text,
  p_vehicle_make text,
  p_vehicle_model text,
  p_vehicle_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_label text,
  p_location_source public.location_source,
  p_customer_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  intake_link_id uuid;
  intake_job_id uuid;
begin
  select link.id, link.job_id
  into intake_link_id, intake_job_id
  from public.customer_intake_links link
  join public.jobs job on job.id = link.job_id
  where link.token_hash = p_token_hash
    and link.revoked_at is null
    and link.submitted_at is null
    and link.expires_at > now()
    and job.status not in ('completed', 'cancelled')
  for update of link;

  if intake_link_id is null then
    raise exception 'Customer intake link is invalid or unavailable' using errcode = 'P0002';
  end if;

  if p_location_source not in ('gps', 'map_pin') then
    raise exception 'Customer location must be confirmed by GPS or map pin';
  end if;

  update public.jobs
  set customer_name = trim(p_customer_name),
      customer_phone = trim(p_customer_phone),
      vehicle_registration = nullif(trim(p_vehicle_registration), ''),
      vehicle_make = nullif(trim(p_vehicle_make), ''),
      vehicle_model = nullif(trim(p_vehicle_model), ''),
      vehicle_type = nullif(trim(p_vehicle_type), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      location_label = trim(p_location_label),
      location_source = p_location_source,
      customer_notes = trim(p_customer_notes),
      customer_intake_submitted_at = now()
  where id = intake_job_id;

  update public.customer_intake_links
  set submitted_at = now()
  where id = intake_link_id;

  return intake_job_id;
end;
$$;

revoke all on function public.create_customer_intake_link(uuid, text, timestamptz) from public;
revoke all on function public.revoke_customer_intake_link(uuid) from public;
revoke all on function public.submit_customer_intake(
  text, text, text, text, text, text, text,
  double precision, double precision, text, public.location_source, text
) from public;

grant execute on function public.create_customer_intake_link(uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_customer_intake_link(uuid) to authenticated;
grant execute on function public.submit_customer_intake(
  text, text, text, text, text, text, text,
  double precision, double precision, text, public.location_source, text
) to service_role;
