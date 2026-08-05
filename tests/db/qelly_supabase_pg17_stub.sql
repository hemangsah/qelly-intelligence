\set ON_ERROR_STOP on

-- PostgreSQL 17-only acceptance scaffold. This models the Supabase roles,
-- auth.users relation, auth.uid() claim lookup and pgcrypto extension schema
-- needed by the committed Qelly migrations. It does not claim full Supabase parity.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

revoke all on schema auth from public, anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema qelly_test;

create or replace function qelly_test.assert_true(condition boolean, message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if condition is distinct from true then
    raise exception 'acceptance assertion failed: %', message;
  end if;
end
$$;

create or replace function qelly_test.expect_denied(statement text, message text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  begin
    execute statement;
  exception
    when insufficient_privilege then
      return;
  end;
  raise exception 'expected denial did not occur: %', message;
end
$$;

grant usage on schema qelly_test to anon, authenticated, service_role;
grant execute on function qelly_test.assert_true(boolean,text) to anon, authenticated, service_role;
grant execute on function qelly_test.expect_denied(text,text) to anon, authenticated, service_role;
