begin;

create or replace function qelly_private.canonicalize_timezone_alias_row()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.timezone = 'Asia/Calcutta' then
    new.timezone := 'Asia/Kolkata';
  end if;
  return new;
end;
$$;

update public.qelly_profiles
set timezone = 'Asia/Kolkata'
where timezone = 'Asia/Calcutta';

update public.qelly_theme_schedules
set timezone = 'Asia/Kolkata'
where timezone = 'Asia/Calcutta';

update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{timezone}',
  to_jsonb('Asia/Kolkata'::text),
  true
)
where raw_user_meta_data->>'timezone' = 'Asia/Calcutta';

drop trigger if exists qelly_profiles_timezone_canonical on public.qelly_profiles;
create trigger qelly_profiles_timezone_canonical
before insert or update of timezone on public.qelly_profiles
for each row execute function qelly_private.canonicalize_timezone_alias_row();

drop trigger if exists qelly_theme_schedules_timezone_canonical on public.qelly_theme_schedules;
create trigger qelly_theme_schedules_timezone_canonical
before insert or update of timezone on public.qelly_theme_schedules
for each row execute function qelly_private.canonicalize_timezone_alias_row();

commit;
