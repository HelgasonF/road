begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;

select plan(9);

select ok(
  not has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE'),
  'browser roles cannot consume or probe rate limits'
);

select ok(
  has_function_privilege('service_role', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE'),
  'the server-only role can consume rate limits'
);

select ok(
  not has_table_privilege('authenticated', 'app_private.request_rate_limits', 'SELECT'),
  'signed-in users cannot read rate limit counters'
);

set local role service_role;

select is(public.consume_rate_limit('login:test', 2, 60), true, 'the first request is allowed');
select is(public.consume_rate_limit('login:test', 2, 60), true, 'a request at the limit is allowed');
select is(public.consume_rate_limit('login:test', 2, 60), false, 'a request over the limit is refused');
select is(public.consume_rate_limit('login:other', 2, 60), true, 'buckets are counted independently');

reset role;
update app_private.request_rate_limits
set window_started_at = now() - interval '61 seconds'
where bucket = 'login:test';
set local role service_role;

select is(public.consume_rate_limit('login:test', 2, 60), true, 'a new window resets the count');

select throws_ok(
  $$select public.consume_rate_limit('', 2, 60)$$,
  '22023',
  'invalid rate limit request',
  'an empty bucket is rejected'
);

select * from finish();
rollback;
