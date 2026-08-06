-- Persist validated global display preferences from Supabase Auth metadata.
-- Registration remains fail-closed until transactional email delivery is proven.

begin;

alter table public.qelly_profiles
  add column if not exists base_currency text not null default 'USD',
  add column if not exists timezone text not null default 'UTC';

alter table public.qelly_profiles
  drop constraint if exists qelly_profiles_base_currency_check;
alter table public.qelly_profiles
  add constraint qelly_profiles_base_currency_check
  check (base_currency = any (array['USD','INR','EUR','GBP','SGD','AED','JPY']));

alter table public.qelly_profiles
  drop constraint if exists qelly_profiles_timezone_check;
alter table public.qelly_profiles
  add constraint qelly_profiles_timezone_check
  check (
    char_length(timezone) between 1 and 64
    and timezone ~ '^[A-Za-z0-9_+\-/]+$'
  );

create or replace function qelly_private.bootstrap_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text := upper(coalesce(nullif(btrim(new.raw_user_meta_data->>'base_currency'),''),'USD'));
  v_timezone text := coalesce(nullif(btrim(new.raw_user_meta_data->>'timezone'),''),'UTC');
  v_workspace_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'workspace_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'organization_name'),''),
    'My Qelly Workspace'
  );
begin
  if v_currency <> all (array['USD','INR','EUR','GBP','SGD','AED','JPY']) then
    v_currency := 'USD';
  end if;
  if char_length(v_timezone) not between 1 and 64
     or v_timezone !~ '^[A-Za-z0-9_+\-/]+$' then
    v_timezone := 'UTC';
  end if;

  insert into public.qelly_profiles(user_id,display_name,base_currency,timezone)
  values(
    new.id,
    nullif(coalesce(new.raw_user_meta_data->>'display_name',split_part(coalesce(new.email,''),'@',1)),''),
    v_currency,
    v_timezone
  )
  on conflict(user_id) do update
    set display_name=coalesce(public.qelly_profiles.display_name,excluded.display_name),
        base_currency=excluded.base_currency,
        timezone=excluded.timezone,
        updated_at=now();

  insert into public.qelly_workspaces(owner_id,name)
  select new.id,left(v_workspace_name,100)
  where not exists(select 1 from public.qelly_workspaces where owner_id=new.id);

  return new;
end
$$;

comment on column public.qelly_profiles.base_currency is
  'User-selected workspace display currency. It does not enable trading, custody or conversion.';
comment on column public.qelly_profiles.timezone is
  'Validated IANA timezone supplied during registration; defaults to UTC.';
comment on function qelly_private.bootstrap_user() is
  'Creates or repairs the caller profile and first workspace from validated Auth metadata.';

notify pgrst, 'reload schema';

commit;
