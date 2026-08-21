create or replace function public.enforce_job_billing_value_locks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.receivable_status not in ('missing_information', 'draft', 'ready_to_invoice')
    and (
      new.payer_type is distinct from old.payer_type
      or new.payer_name is distinct from old.payer_name
      or new.payer_kennitala is distinct from old.payer_kennitala
      or new.payer_email is distinct from old.payer_email
      or new.payer_phone is distinct from old.payer_phone
      or new.payer_address is distinct from old.payer_address
      or new.authorization_reference is distinct from old.authorization_reference
      or new.billing_reference is distinct from old.billing_reference
      or new.service_summary is distinct from old.service_summary
      or new.payer_amount_isk is distinct from old.payer_amount_isk
    )
  then
    raise exception 'Payer invoice values are locked after issuance';
  end if;

  if old.payable_status not in ('not_ready', 'awaiting_provider_invoice')
    and new.provider_amount_isk is distinct from old.provider_amount_isk
  then
    raise exception 'Provider amount is locked after invoice approval';
  end if;

  return new;
end;
$$;

create trigger job_billing_enforce_value_locks
before update on public.job_billing
for each row execute function public.enforce_job_billing_value_locks();

revoke all on function public.enforce_job_billing_value_locks() from public;
