-- RELEASE-TIME OPERATION. Do not run until the owner approves the release,
-- payment migrations, controlled live test and production enablement.
-- Follow https://supabase.com/docs/guides/functions/schedule-functions
-- Enable pg_cron and pg_net in the intended Supabase project first.
-- In Vault, securely create these values (never paste them into this file):
--   mypos_worker_origin: deployed HTTPS application origin, without trailing /
--   mypos_worker_secret: same random >=32-character PAYMENT_WORKER_SECRET as app
-- This scheduler performs only provider status reads and paid-draft completion.
-- It never creates payment requests, sends messages or charges a customer.

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='mypos_worker_origin' and decrypted_secret ~ '^https://[^/]+$')
    or not exists(select 1 from vault.decrypted_secrets where name='mypos_worker_secret' and length(decrypted_secret)>=32) then
    raise exception 'Configure the private payment worker Vault entries before scheduling';
  end if;
end;
$$;

-- Named schedules are updated in place by pg_cron.
select cron.schedule('mypos-payment-reconciliation', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='mypos_worker_origin') || '/api/internal/payments/reconcile',
    headers := jsonb_build_object('Content-Type','application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='mypos_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- To pause the worker explicitly:
-- select cron.unschedule('mypos-payment-reconciliation');
