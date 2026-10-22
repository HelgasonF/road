-- Infrastructure only: no schedule or credentials are created by migrations.
-- The release operation in supabase/ops starts reconciliation after deployment.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
