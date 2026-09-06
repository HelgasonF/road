-- Supabase grants API roles EXECUTE on newly created public functions. Keep
-- anonymous callers away from every RPC and expose only the functions each
-- authenticated application path actually needs.
revoke execute on all functions in schema public from public, anon;

-- These functions are invoked by database triggers and must not be exposed as
-- RPCs to signed-in clients.
revoke execute on function public.create_job_billing_record() from authenticated;
revoke execute on function public.enforce_job_billing_value_locks() from authenticated;
revoke execute on function public.handle_new_auth_user() from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.sync_job_billing_on_completion() from authenticated;

-- Customer intake is deliberately account-free, but the application validates
-- its one-time token before invoking these functions with its server-only key.
revoke execute on function public.mark_customer_intake_link_opened(uuid) from authenticated;
revoke execute on function public.submit_customer_intake(
  text, text, text, text, text, text, text,
  double precision, double precision, text, public.location_source, text
) from authenticated;

grant execute on function public.mark_customer_intake_link_opened(uuid) to service_role;
grant execute on function public.submit_customer_intake(
  text, text, text, text, text, text, text,
  double precision, double precision, text, public.location_source, text
) to service_role;

-- Make PostgreSQL's baseline secure for later functions. A migration that adds
-- an application RPC must grant its intended role explicitly.
alter default privileges in schema public revoke execute on functions from public;
