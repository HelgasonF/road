alter table public.iceland_addresses
add column location extensions.geography(Point, 4326)
generated always as (
  extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
) stored;

create index iceland_addresses_location_gix
  on public.iceland_addresses using gist (location);

create or replace function public.reverse_geocode_iceland_address(
  p_latitude double precision,
  p_longitude double precision,
  p_max_distance_meters double precision default 250
)
returns table (
  id text,
  label text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision
)
language plpgsql
stable
parallel safe
set search_path = ''
as $$
declare
  pin_location extensions.geography(Point, 4326);
begin
  if p_latitude is null
    or p_longitude is null
    or p_max_distance_meters is null
    or p_latitude not between 62 and 68
    or p_longitude not between -26 and -12
    or p_max_distance_meters not between 1 and 2000
  then
    return;
  end if;

  pin_location := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;

  return query
  select
    concat('hms:', address.source_id)::text,
    address.address_label,
    address.latitude,
    address.longitude,
    extensions.st_distance(address.location, pin_location)
  from public.iceland_addresses as address
  where extensions.st_dwithin(
    address.location,
    pin_location,
    p_max_distance_meters
  )
  order by extensions.st_distance(address.location, pin_location), address.source_id
  limit 1;
end;
$$;

revoke all on function public.reverse_geocode_iceland_address(
  double precision,
  double precision,
  double precision
) from public;
grant execute on function public.reverse_geocode_iceland_address(
  double precision,
  double precision,
  double precision
) to authenticated;

comment on function public.reverse_geocode_iceland_address(
  double precision,
  double precision,
  double precision
) is 'Returns the nearest official HMS address to a map pin when it is within the requested distance.';
