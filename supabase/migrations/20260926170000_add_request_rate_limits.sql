-- Fixed-window request counters for server actions that anonymous or
-- not-yet-authenticated callers can reach (staff login, customer links).
-- Only the server-only role touches them; Supabase Auth's own per-IP limit
-- sees Vercel's addresses because sign-in happens server-side.
create table app_private.request_rate_limits (
  bucket text primary key check (length(bucket) between 1 and 200),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table app_private.request_rate_limits enable row level security;
revoke all on app_private.request_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on app_private.request_rate_limits to service_role;

create function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window interval;
  v_count integer;
begin
  if p_bucket is null
    or length(p_bucket) not between 1 and 200
    or p_limit is null or p_limit < 1
    or p_window_seconds is null or p_window_seconds < 1
  then
    raise exception 'invalid rate limit request' using errcode = '22023';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into app_private.request_rate_limits as counter (bucket, window_started_at, request_count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
  set
    window_started_at = case
      when counter.window_started_at <= now() - v_window then now()
      else counter.window_started_at
    end,
    request_count = case
      when counter.window_started_at <= now() - v_window then 1
      else counter.request_count + 1
    end
  returning request_count into v_count;

  -- Keep the table small without a scheduled job.
  if random() < 0.01 then
    delete from app_private.request_rate_limits
    where window_started_at < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
