alter table public.customer_intake_links
add column first_opened_at timestamptz;

alter table public.customer_intake_links
add constraint customer_intake_link_opened_timeline_valid
check (first_opened_at is null or first_opened_at >= created_at);

create type public.job_contact_channel as enum ('whatsapp', 'phone');
create type public.job_contact_purpose as enum ('availability', 'assignment');

create table public.job_contact_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  operator_id uuid not null references public.operators (id) on delete restrict,
  channel public.job_contact_channel not null,
  purpose public.job_contact_purpose not null,
  initiated_by uuid not null references public.profiles (id) on delete restrict,
  initiated_at timestamptz not null default now()
);

create index job_contact_events_job_time_idx
on public.job_contact_events (job_id, initiated_at desc);

grant select on public.job_contact_events to authenticated;

alter table public.job_contact_events enable row level security;

create policy "Staff can read job contact events" on public.job_contact_events
for select to authenticated
using ((select public.is_staff()));

create or replace function public.mark_customer_intake_link_opened(p_link_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  opened_time timestamptz;
begin
  update public.customer_intake_links
  set first_opened_at = coalesce(first_opened_at, now())
  where id = p_link_id
  returning first_opened_at into opened_time;

  if opened_time is null then
    raise exception 'Customer intake link not found' using errcode = 'P0002';
  end if;

  return opened_time;
end;
$$;

create or replace function public.record_job_contact(
  p_job_id uuid,
  p_operator_id uuid,
  p_channel public.job_contact_channel,
  p_purpose public.job_contact_purpose
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id bigint;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.jobs job
    where job.id = p_job_id
      and job.status not in ('completed', 'cancelled')
  ) then
    raise exception 'Open job not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.operators operator
    where operator.id = p_operator_id
  ) then
    raise exception 'Operator not found' using errcode = 'P0002';
  end if;

  if p_purpose = 'assignment' and not exists (
    select 1
    from public.job_assignments assignment
    where assignment.job_id = p_job_id
      and assignment.operator_id = p_operator_id
      and assignment.unassigned_at is null
  ) then
    raise exception 'Current assignment not found' using errcode = 'P0002';
  end if;

  insert into public.job_contact_events (
    job_id, operator_id, channel, purpose, initiated_by
  ) values (
    p_job_id, p_operator_id, p_channel, p_purpose, (select auth.uid())
  )
  returning id into saved_id;

  return saved_id;
end;
$$;

revoke all on function public.mark_customer_intake_link_opened(uuid) from public;
revoke all on function public.record_job_contact(
  uuid, uuid, public.job_contact_channel, public.job_contact_purpose
) from public;

grant execute on function public.mark_customer_intake_link_opened(uuid) to service_role;
grant execute on function public.record_job_contact(
  uuid, uuid, public.job_contact_channel, public.job_contact_purpose
) to authenticated;
