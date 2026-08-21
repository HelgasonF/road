create type public.billing_payer_type as enum (
  'customer',
  'rental_company',
  'insurer',
  'business_account'
);

create type public.billing_receivable_status as enum (
  'missing_information',
  'draft',
  'ready_to_invoice',
  'invoiced',
  'paid',
  'overdue',
  'disputed',
  'refunded',
  'void'
);

create type public.billing_payable_status as enum (
  'not_ready',
  'awaiting_provider_invoice',
  'approved',
  'paid',
  'disputed',
  'void'
);

create type public.billing_action as enum (
  'details_updated',
  'issue_payer_invoice',
  'record_payer_payment',
  'mark_payer_overdue',
  'dispute_payer',
  'refund_payer',
  'approve_provider_invoice',
  'record_provider_payment',
  'dispute_provider',
  'reopen_payer',
  'reopen_provider',
  'void_billing'
);

create table public.job_billing (
  job_id uuid primary key references public.jobs (id) on delete cascade,
  payer_type public.billing_payer_type,
  payer_name text check (payer_name is null or length(trim(payer_name)) between 2 and 160),
  payer_kennitala text check (payer_kennitala is null or length(trim(payer_kennitala)) <= 32),
  payer_email text check (payer_email is null or length(trim(payer_email)) <= 254),
  payer_phone text check (payer_phone is null or length(trim(payer_phone)) <= 40),
  payer_address text check (payer_address is null or length(trim(payer_address)) <= 500),
  authorization_reference text check (authorization_reference is null or length(trim(authorization_reference)) <= 120),
  billing_reference text check (billing_reference is null or length(trim(billing_reference)) <= 120),
  service_summary text check (service_summary is null or length(trim(service_summary)) <= 4000),
  payer_amount_isk integer check (payer_amount_isk is null or payer_amount_isk >= 0),
  provider_amount_isk integer check (provider_amount_isk is null or provider_amount_isk >= 0),
  currency text not null default 'ISK' check (currency = 'ISK'),
  receivable_status public.billing_receivable_status not null default 'missing_information',
  payer_invoice_number text check (payer_invoice_number is null or length(trim(payer_invoice_number)) between 1 and 120),
  payer_invoice_issued_at timestamptz,
  payer_due_at date,
  payer_paid_at timestamptz,
  payable_status public.billing_payable_status not null default 'not_ready',
  provider_invoice_number text check (provider_invoice_number is null or length(trim(provider_invoice_number)) between 1 and 120),
  provider_invoice_received_at timestamptz,
  provider_due_at date,
  provider_paid_at timestamptz,
  notes text check (notes is null or length(notes) <= 4000),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payer_paid_timestamp_consistent check (
    receivable_status <> 'paid' or payer_paid_at is not null
  ),
  constraint provider_paid_timestamp_consistent check (
    payable_status <> 'paid' or provider_paid_at is not null
  )
);

create index job_billing_receivable_status_idx
  on public.job_billing (receivable_status, updated_at desc);
create index job_billing_payable_status_idx
  on public.job_billing (payable_status, updated_at desc);
create index job_billing_payer_name_idx
  on public.job_billing (payer_name)
  where payer_name is not null;

create table public.job_billing_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs (id) on delete cascade,
  action public.billing_action not null,
  reference text check (reference is null or length(trim(reference)) <= 120),
  due_at date,
  notes text check (notes is null or length(notes) <= 2000),
  changed_by uuid not null references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default now()
);

create index job_billing_events_job_time_idx
  on public.job_billing_events (job_id, changed_at desc);

create trigger job_billing_set_updated_at
before update on public.job_billing
for each row execute function public.set_updated_at();

create or replace function public.create_job_billing_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.job_billing (job_id, created_by, updated_by)
  values (new.id, new.created_by, new.created_by)
  on conflict (job_id) do nothing;
  return new;
end;
$$;

create trigger jobs_create_billing_record
after insert on public.jobs
for each row execute function public.create_job_billing_record();

insert into public.job_billing (
  job_id,
  payable_status,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  job.id,
  case
    when job.status = 'completed' and exists (
      select 1
      from public.job_assignments assignment
      where assignment.job_id = job.id
        and assignment.unassigned_at is null
    ) then 'awaiting_provider_invoice'::public.billing_payable_status
    else 'not_ready'::public.billing_payable_status
  end,
  job.created_by,
  job.created_by,
  job.created_at,
  job.updated_at
from public.jobs job
on conflict (job_id) do nothing;

create or replace function public.sync_job_billing_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    update public.job_billing billing
    set receivable_status = case
          when billing.receivable_status in ('missing_information', 'draft', 'ready_to_invoice')
            and billing.payer_type is not null
            and billing.payer_name is not null
            and billing.payer_amount_isk is not null
          then 'ready_to_invoice'::public.billing_receivable_status
          when billing.receivable_status in ('missing_information', 'draft', 'ready_to_invoice')
          then 'missing_information'::public.billing_receivable_status
          else billing.receivable_status
        end,
        payable_status = case
          when billing.payable_status = 'not_ready'
            and exists (
              select 1
              from public.job_assignments assignment
              where assignment.job_id = new.id
                and assignment.unassigned_at is null
            )
          then 'awaiting_provider_invoice'::public.billing_payable_status
          else billing.payable_status
        end,
        updated_by = coalesce((select auth.uid()), billing.updated_by)
    where billing.job_id = new.id;
  end if;
  return new;
end;
$$;

create trigger jobs_sync_billing_on_completion
after update of status on public.jobs
for each row execute function public.sync_job_billing_on_completion();

create or replace function public.save_job_billing(
  p_job_id uuid,
  p_payer_type public.billing_payer_type,
  p_payer_name text,
  p_payer_kennitala text,
  p_payer_email text,
  p_payer_phone text,
  p_payer_address text,
  p_authorization_reference text,
  p_billing_reference text,
  p_service_summary text,
  p_payer_amount_isk integer,
  p_provider_amount_isk integer,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_job_status public.job_status;
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_payer_amount_isk < 0 or p_provider_amount_isk < 0 then
    raise exception 'Billing amounts cannot be negative' using errcode = '23514';
  end if;

  select job.status
  into current_job_status
  from public.jobs job
  where job.id = p_job_id;

  if current_job_status is null then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  update public.job_billing billing
  set payer_type = p_payer_type,
      payer_name = nullif(trim(p_payer_name), ''),
      payer_kennitala = nullif(trim(p_payer_kennitala), ''),
      payer_email = nullif(trim(p_payer_email), ''),
      payer_phone = nullif(trim(p_payer_phone), ''),
      payer_address = nullif(trim(p_payer_address), ''),
      authorization_reference = nullif(trim(p_authorization_reference), ''),
      billing_reference = nullif(trim(p_billing_reference), ''),
      service_summary = nullif(trim(p_service_summary), ''),
      payer_amount_isk = p_payer_amount_isk,
      provider_amount_isk = p_provider_amount_isk,
      notes = nullif(trim(p_notes), ''),
      receivable_status = case
        when billing.receivable_status in ('missing_information', 'draft', 'ready_to_invoice')
          and p_payer_type is not null
          and nullif(trim(p_payer_name), '') is not null
          and p_payer_amount_isk is not null
        then case
          when current_job_status = 'completed'
          then 'ready_to_invoice'::public.billing_receivable_status
          else 'draft'::public.billing_receivable_status
        end
        when billing.receivable_status in ('missing_information', 'draft', 'ready_to_invoice')
        then 'missing_information'::public.billing_receivable_status
        else billing.receivable_status
      end,
      payable_status = case
        when billing.payable_status = 'not_ready'
          and current_job_status = 'completed'
          and exists (
            select 1
            from public.job_assignments assignment
            where assignment.job_id = p_job_id
              and assignment.unassigned_at is null
          )
        then 'awaiting_provider_invoice'::public.billing_payable_status
        else billing.payable_status
      end,
      updated_by = (select auth.uid())
  where billing.job_id = p_job_id;

  if not found then
    raise exception 'Billing record not found' using errcode = 'P0002';
  end if;

  insert into public.job_billing_events (job_id, action, notes, changed_by)
  values (p_job_id, 'details_updated', nullif(trim(p_notes), ''), (select auth.uid()));
end;
$$;

create or replace function public.transition_job_billing(
  p_job_id uuid,
  p_action public.billing_action,
  p_reference text,
  p_due_at date,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing_record public.job_billing%rowtype;
  current_job_status public.job_status;
  normalized_reference text := nullif(trim(p_reference), '');
  normalized_notes text := nullif(trim(p_notes), '');
begin
  if not (select public.is_staff()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if p_action = 'details_updated' then
    raise exception 'Use save_job_billing for detail changes';
  end if;

  select billing.*
  into billing_record
  from public.job_billing billing
  where billing.job_id = p_job_id
  for update;

  if not found then
    raise exception 'Billing record not found' using errcode = 'P0002';
  end if;

  select job.status
  into current_job_status
  from public.jobs job
  where job.id = p_job_id;

  case p_action
    when 'issue_payer_invoice' then
      if billing_record.receivable_status <> 'ready_to_invoice' then
        raise exception 'Payer invoice cannot be issued from status %', billing_record.receivable_status;
      end if;
      if normalized_reference is null or p_due_at is null then
        raise exception 'Invoice number and due date are required';
      end if;
      if billing_record.payer_type is null
        or billing_record.payer_name is null
        or billing_record.payer_amount_isk is null then
        raise exception 'Complete payer details are required';
      end if;
      update public.job_billing
      set receivable_status = 'invoiced',
          payer_invoice_number = normalized_reference,
          payer_invoice_issued_at = now(),
          payer_due_at = p_due_at,
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'record_payer_payment' then
      if billing_record.receivable_status not in ('invoiced', 'overdue', 'disputed') then
        raise exception 'Payer payment cannot be recorded from status %', billing_record.receivable_status;
      end if;
      update public.job_billing
      set receivable_status = 'paid',
          payer_paid_at = now(),
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'mark_payer_overdue' then
      if billing_record.receivable_status <> 'invoiced' then
        raise exception 'Payer invoice cannot be marked overdue from status %', billing_record.receivable_status;
      end if;
      update public.job_billing
      set receivable_status = 'overdue',
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'dispute_payer' then
      if billing_record.receivable_status not in ('ready_to_invoice', 'invoiced', 'overdue') then
        raise exception 'Payer dispute cannot be opened from status %', billing_record.receivable_status;
      end if;
      if normalized_notes is null then
        raise exception 'A dispute reason is required';
      end if;
      update public.job_billing
      set receivable_status = 'disputed',
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'refund_payer' then
      if billing_record.receivable_status <> 'paid' then
        raise exception 'Payer refund cannot be recorded from status %', billing_record.receivable_status;
      end if;
      update public.job_billing
      set receivable_status = 'refunded',
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'approve_provider_invoice' then
      if billing_record.payable_status <> 'awaiting_provider_invoice' then
        raise exception 'Provider invoice cannot be approved from status %', billing_record.payable_status;
      end if;
      if current_job_status <> 'completed' then
        raise exception 'Provider invoice requires a completed job';
      end if;
      if billing_record.provider_amount_isk is null then
        raise exception 'Provider amount is required';
      end if;
      if normalized_reference is null or p_due_at is null then
        raise exception 'Provider invoice number and due date are required';
      end if;
      update public.job_billing
      set payable_status = 'approved',
          provider_invoice_number = normalized_reference,
          provider_invoice_received_at = now(),
          provider_due_at = p_due_at,
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'record_provider_payment' then
      if billing_record.payable_status not in ('approved', 'disputed') then
        raise exception 'Provider payment cannot be recorded from status %', billing_record.payable_status;
      end if;
      update public.job_billing
      set payable_status = 'paid',
          provider_paid_at = now(),
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'dispute_provider' then
      if billing_record.payable_status not in ('awaiting_provider_invoice', 'approved') then
        raise exception 'Provider dispute cannot be opened from status %', billing_record.payable_status;
      end if;
      if normalized_notes is null then
        raise exception 'A dispute reason is required';
      end if;
      update public.job_billing
      set payable_status = 'disputed',
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'reopen_payer' then
      if billing_record.receivable_status <> 'disputed' then
        raise exception 'Payer side cannot be reopened from status %', billing_record.receivable_status;
      end if;
      update public.job_billing
      set receivable_status = case
            when billing_record.payer_invoice_number is not null
            then 'invoiced'::public.billing_receivable_status
            when current_job_status = 'completed'
            then 'ready_to_invoice'::public.billing_receivable_status
            else 'draft'::public.billing_receivable_status
          end,
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'reopen_provider' then
      if billing_record.payable_status <> 'disputed' then
        raise exception 'Provider side cannot be reopened from status %', billing_record.payable_status;
      end if;
      update public.job_billing
      set payable_status = case
            when billing_record.provider_invoice_number is not null
            then 'approved'::public.billing_payable_status
            else 'awaiting_provider_invoice'::public.billing_payable_status
          end,
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    when 'void_billing' then
      if current_job_status <> 'cancelled' then
        raise exception 'Only a cancelled job can be voided';
      end if;
      update public.job_billing
      set receivable_status = 'void',
          payable_status = 'void',
          updated_by = (select auth.uid())
      where job_id = p_job_id;

    else
      raise exception 'Unsupported billing action';
  end case;

  insert into public.job_billing_events (
    job_id,
    action,
    reference,
    due_at,
    notes,
    changed_by
  ) values (
    p_job_id,
    p_action,
    normalized_reference,
    p_due_at,
    normalized_notes,
    (select auth.uid())
  );
end;
$$;

revoke all on function public.create_job_billing_record() from public;
revoke all on function public.sync_job_billing_on_completion() from public;
revoke all on function public.save_job_billing(
  uuid, public.billing_payer_type, text, text, text, text, text, text, text,
  text, integer, integer, text
) from public;
revoke all on function public.transition_job_billing(
  uuid, public.billing_action, text, date, text
) from public;

grant execute on function public.save_job_billing(
  uuid, public.billing_payer_type, text, text, text, text, text, text, text,
  text, integer, integer, text
) to authenticated;
grant execute on function public.transition_job_billing(
  uuid, public.billing_action, text, date, text
) to authenticated;

grant select, update on public.job_billing to authenticated;
grant select on public.job_billing_events to authenticated;
grant usage, select on sequence public.job_billing_events_id_seq to authenticated;

alter table public.job_billing enable row level security;
alter table public.job_billing_events enable row level security;

create policy "Staff can read job billing" on public.job_billing
for select to authenticated
using ((select public.is_staff()));

create policy "Staff can update job billing" on public.job_billing
for update to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

create policy "Staff can read job billing events" on public.job_billing_events
for select to authenticated
using ((select public.is_staff()));
