-- Secret/server keys assume the service_role database role. New tables still
-- need ordinary relation privileges in addition to service_role's RLS bypass.
grant select on public.customer_intake_links to service_role;
grant select, insert, update, delete on public.job_photos to service_role;
