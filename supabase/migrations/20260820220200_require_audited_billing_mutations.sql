revoke update on public.job_billing from authenticated;
revoke usage, select on sequence public.job_billing_events_id_seq from authenticated;

drop policy "Staff can update job billing" on public.job_billing;
