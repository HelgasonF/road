begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;

select plan(16);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  0::bigint,
  'anonymous callers cannot execute public functions'
);

select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prorettype = 'trigger'::regtype
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  0::bigint,
  'authenticated callers cannot execute trigger functions as RPCs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.mark_customer_intake_link_opened(uuid)',
    'EXECUTE'
  ),
  'customer link audit writes require the server-only role'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_customer_intake(text,text,text,text,text,text,text,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'customer intake submission requires the server-only role'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_customer_intake(text,text,text,text,text,text,text,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'the server-only role can submit validated customer intake'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_customer_intake_v2(text,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'updated customer intake submission requires the server-only role'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_customer_intake_v2(text,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'the server-only role can submit updated customer intake'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_job(uuid,text,text,text,text,text,integer,double precision,double precision,text,public.location_source,public.job_priority,text,text[])',
    'EXECUTE'
  ),
  'authenticated staff retain access to application RPCs'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_customer_intake_job(text,text,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated staff can create phone-first intake jobs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_customer_intake_v3(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'phone-first customer submission requires the server-only role'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_customer_intake_v3(text,text,text,text,text,text,integer,text,double precision,double precision,text,public.location_source,text)',
    'EXECUTE'
  ),
  'the server-only role can complete phone-first customer intake'
);

select is(
  (
    select count(*) from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  0::bigint,
  'authenticated callers cannot directly execute privileged public functions'
);

select is(
  (
    select count(*) from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'app_private' and procedure.prosecdef
  ),
  17::bigint,
  'all privileged implementations are in the private schema'
);

select is(
  (
    select count(*) from pg_proc implementation
    join pg_namespace private_schema on private_schema.oid = implementation.pronamespace
    join pg_proc wrapper on wrapper.proname = implementation.proname
      and wrapper.proargtypes = implementation.proargtypes
    join pg_namespace public_schema on public_schema.oid = wrapper.pronamespace
    where private_schema.nspname = 'app_private'
      and public_schema.nspname = 'public'
      and implementation.prosecdef
      and not wrapper.prosecdef
      and has_function_privilege('authenticated', wrapper.oid, 'EXECUTE')
      and has_function_privilege('service_role', wrapper.oid, 'EXECUTE')
  ),
  17::bigint,
  'existing RPC signatures remain callable through invoker wrappers'
);

select ok(
  not has_schema_privilege('anon', 'app_private', 'USAGE')
    and has_schema_privilege('authenticated', 'app_private', 'USAGE'),
  'the private function schema excludes anonymous callers'
);

select is(
  (
    select count(*) from (
      select tablename from pg_policies
      where schemaname = 'public'
        and tablename = any(array[
          'capabilities', 'job_assignments', 'job_required_capabilities',
          'job_status_history', 'jobs', 'operator_capabilities', 'operators',
          'profiles', 'vehicle_capabilities', 'vehicles'
        ])
        and cmd in ('SELECT', 'ALL')
      group by tablename having count(*) = 1
    ) single_read_policy
  ),
  10::bigint,
  'each shared table has exactly one authenticated read policy'
);

select * from finish();
rollback;
