create table public.iceland_places (
  source_type text not null check (source_type in ('node', 'way', 'relation')),
  source_id bigint not null,
  name text not null check (length(trim(name)) between 1 and 300),
  category text not null,
  category_label text not null,
  search_priority integer not null check (search_priority between 0 and 100),
  latitude double precision not null check (latitude between 62 and 68),
  longitude double precision not null check (longitude between -26 and -12),
  search_text text not null,
  search_key text generated always as (public.normalize_icelandic_search(search_text)) stored,
  imported_at timestamptz not null default now(),
  primary key (source_type, source_id)
);

create index iceland_places_search_key_gin
  on public.iceland_places using gin (search_key extensions.gin_trgm_ops);

alter table public.iceland_places enable row level security;
grant select on public.iceland_places to authenticated;

create policy "Staff can read Iceland places" on public.iceland_places
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
  query_has_number boolean := query_key ~ '[0-9]';
begin
  if length(query_key) < 2 then
    return;
  end if;

  return query
  with address_matches as (
    select
      concat('hms:', address.source_id)::text as id,
      address.address_label as label,
      address.latitude,
      address.longitude,
      case
        when query_has_number
          and public.normalize_icelandic_search(address.address_label) like concat(query_key, '%')
        then 500
        else 100
      end as result_priority,
      (address.search_key like concat(query_key, '%')) as starts_with_query,
      extensions.word_similarity(query_key, address.search_key) as word_score,
      extensions.similarity(address.search_key, query_key) as similarity_score
    from public.iceland_addresses as address
    where address.search_key like concat('%', query_key, '%')
       or address.search_key operator(extensions.%) query_key
    order by
      (address.search_key like concat(query_key, '%')) desc,
      extensions.word_similarity(query_key, address.search_key) desc,
      extensions.similarity(address.search_key, query_key) desc
    limit 30
  ),
  place_matches as (
    select
      concat('osm:', place.source_type, ':', place.source_id)::text as id,
      concat(place.name, ' · ', place.category_label)::text as label,
      place.latitude,
      place.longitude,
      case
        when public.normalize_icelandic_search(place.name) = query_key
        then 300 + place.search_priority
        else 50 + place.search_priority
      end as result_priority,
      (place.search_key like concat(query_key, '%')) as starts_with_query,
      extensions.word_similarity(query_key, place.search_key) as word_score,
      extensions.similarity(place.search_key, query_key) as similarity_score
    from public.iceland_places as place
    where place.search_key like concat('%', query_key, '%')
       or place.search_key operator(extensions.%) query_key
    order by
      (public.normalize_icelandic_search(place.name) = query_key) desc,
      place.search_priority desc,
      extensions.word_similarity(query_key, place.search_key) desc,
      extensions.similarity(place.search_key, query_key) desc
    limit 30
  )
  select
    candidate.id,
    candidate.label,
    candidate.latitude,
    candidate.longitude
  from (
    select * from address_matches
    union all
    select * from place_matches
  ) as candidate
  order by
    candidate.result_priority desc,
    candidate.starts_with_query desc,
    candidate.word_score desc,
    candidate.similarity_score desc,
    length(candidate.label),
    candidate.label
  limit least(greatest(coalesce(p_limit, 8), 1), 10);
end;
$$;

revoke all on function public.search_iceland_addresses(text, integer) from public;
grant execute on function public.search_iceland_addresses(text, integer) to authenticated;

comment on table public.iceland_places is
  'Small populated-place and locality index imported from OpenStreetMap; source JSON is not stored in Git.';
