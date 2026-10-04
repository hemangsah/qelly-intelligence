-- Repeated canonical syncs must not erase separately recorded acceptance evidence.
-- Incoming keys remain authoritative, including explicit JSON null or false.
create or replace function public.qelly_retain_release_metadata_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.environment = old.environment
     and new.release_key = old.release_key
     and new.source_revision = old.source_revision then
    new.metadata := coalesce(old.metadata, '{}'::jsonb)
                    || coalesce(new.metadata, '{}'::jsonb);
  end if;
  return new;
end;
$$;

revoke all on function public.qelly_retain_release_metadata_v1() from public;

create or replace trigger qelly_retain_release_metadata_v1
before update on public.qelly_release_identity
for each row execute function public.qelly_retain_release_metadata_v1();
