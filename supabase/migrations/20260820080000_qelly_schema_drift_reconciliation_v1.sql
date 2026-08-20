-- Reconcile production-applied Supabase hardening with source-controlled migrations.
--
-- Production already moved pg_net out of public and tightened the two governed
-- market-data RPC ACLs. This migration is intentionally idempotent so replay on
-- the current production database does not drop/recreate pg_net a second time.

create schema if not exists extensions;

do $$
declare
  v_pg_net_schema text;
begin
  select n.nspname
    into v_pg_net_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_net';

  if v_pg_net_schema is null then
    execute 'create extension pg_net with schema extensions';
  elsif v_pg_net_schema <> 'extensions' then
    execute 'drop extension pg_net';
    execute 'create extension pg_net with schema extensions';
  end if;
end
$$;

revoke execute on function public.qelly_market_data_snapshot(integer) from public;
revoke execute on function public.qelly_market_data_snapshot(integer) from anon;
grant execute on function public.qelly_market_data_snapshot(integer) to authenticated;
grant execute on function public.qelly_market_data_snapshot(integer) to service_role;

revoke execute on function public.qelly_timeseries_history(text, integer) from public;
revoke execute on function public.qelly_timeseries_history(text, integer) from anon;
grant execute on function public.qelly_timeseries_history(text, integer) to authenticated;
grant execute on function public.qelly_timeseries_history(text, integer) to service_role;
