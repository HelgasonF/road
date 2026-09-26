-- Privileged implementations belong outside the Data API's exposed schemas.
-- Keep the existing public RPC names and argument names as invoker wrappers so
-- PostgREST callers and RLS policies continue to use the same interface.
create schema app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

set search_path = public, pg_catalog;

do $migration$
declare
  v_name text;
  v_function record;
  v_call_args text;
  v_body text;
  v_names constant text[] := array[
    'activate_current_driver_access',
    'create_customer_intake_job',
    'create_customer_intake_link',
    'current_operator_id',
    'driver_has_job',
    'is_driver',
    'is_staff',
    'link_driver_user',
    'record_job_contact',
    'reserve_whatsapp_outbound_message',
    'respond_to_driver_assignment',
    'revoke_customer_intake_link',
    'save_job_billing',
    'set_driver_access_disabled',
    'set_driver_availability',
    'set_driver_job_status',
    'transition_job_billing'
  ];
begin
  foreach v_name in array v_names loop
    if (
      select count(*) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
    ) <> 1 then
      raise exception 'Expected one public function named %', v_name;
    end if;

    select
      p.proname,
      p.pronargs,
      p.proargnames,
      p.proretset,
      p.provolatile,
      p.prosecdef,
      pg_get_function_identity_arguments(p.oid) as identity_args,
      pg_get_function_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as result_type
    into strict v_function
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_name;

    if not v_function.prosecdef then
      raise exception 'Expected %.% to be SECURITY DEFINER', 'public', v_name;
    end if;

    select coalesce(string_agg(format('%I', v_function.proargnames[i]), ', ' order by i), '')
    into v_call_args
    from generate_series(1, v_function.pronargs) as i;

    if v_function.pronargs > 0 and v_call_args = '' then
      raise exception 'Expected named input arguments on public.%', v_name;
    end if;

    execute format(
      'alter function public.%I(%s) set schema app_private',
      v_name, v_function.identity_args
    );

    v_body := case when v_function.proretset
      then format('select * from app_private.%I(%s)', v_name, v_call_args)
      else format('select app_private.%I(%s)', v_name, v_call_args)
    end;

    execute format(
      'create function public.%I(%s) returns %s language sql security invoker %s set search_path = '''' as %L',
      v_name,
      v_function.arguments,
      v_function.result_type,
      case v_function.provolatile
        when 's' then 'stable'
        when 'i' then 'immutable'
        else 'volatile'
      end,
      v_body
    );

    execute format('revoke all on function public.%I(%s) from public, anon',
      v_name, v_function.identity_args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role',
      v_name, v_function.identity_args);
  end loop;
end;
$migration$;

reset search_path;
