begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;

select plan(8);

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
    'public.save_job(uuid,text,text,text,text,text,text,double precision,double precision,text,public.location_source,public.job_priority,text,text[])',
    'EXECUTE'
  ),
  'authenticated staff retain access to application RPCs'
);

select * from finish();
rollback;
