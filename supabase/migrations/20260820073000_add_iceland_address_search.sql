create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_icelandic_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(
    regexp_replace(
      extensions.unaccent(coalesce(value, '')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create table public.iceland_addresses (
  source_id bigint primary key,
  address_label text not null check (length(trim(address_label)) between 2 and 400),
  street_name text not null,
  house_number text,
  postal_code text,
  municipality_code text,
  special_name text,
  latitude double precision not null check (latitude between 62 and 68),
  longitude double precision not null check (longitude between -26 and -12),
  search_text text not null,
  search_key text generated always as (public.normalize_icelandic_search(search_text)) stored,
  source_updated_at date,
  imported_at timestamptz not null default now()
);

create index iceland_addresses_search_key_gin
  on public.iceland_addresses using gin (search_key extensions.gin_trgm_ops);
create index iceland_addresses_postal_code_idx
  on public.iceland_addresses (postal_code);

alter table public.iceland_addresses enable row level security;

grant select on public.iceland_addresses to authenticated;

create policy "Staff can read Iceland addresses" on public.iceland_addresses
for select to authenticated using ((select public.is_staff()));

create or replace function public.search_iceland_addresses(
  p_query text,
  p_limit integer default 8
)
returns table (
  id text,
  label text,
  latitude double precision,
  longitude double precision
)
language plpgsql
stable
set search_path = ''
as $$
declare
  query_key text := public.normalize_icelandic_search(trim(p_query));
begin
  if length(query_key) < 2 then
    return;
  end if;

  return query
  select
    concat('hms:', address.source_id)::text,
    address.address_label,
    address.latitude,
    address.longitude
  from public.iceland_addresses as address
  where address.search_key like concat('%', query_key, '%')
     or address.search_key operator(extensions.%) query_key
  order by
    (public.normalize_icelandic_search(address.address_label) = query_key) desc,
    (address.search_key like concat(query_key, '%')) desc,
    extensions.word_similarity(query_key, address.search_key) desc,
    extensions.similarity(address.search_key, query_key) desc,
    length(address.address_label),
    address.address_label
  limit least(greatest(coalesce(p_limit, 8), 1), 10);
end;
$$;

revoke all on function public.normalize_icelandic_search(text) from public;
revoke all on function public.search_iceland_addresses(text, integer) from public;
grant execute on function public.search_iceland_addresses(text, integer) to authenticated;

comment on table public.iceland_addresses is
  'Search subset imported from the official HMS Staðfangaskrá CSV; the source file is not stored in Git.';
comment on function public.search_iceland_addresses(text, integer) is
  'Staff-only address search over the locally imported HMS Staðfangaskrá.';
