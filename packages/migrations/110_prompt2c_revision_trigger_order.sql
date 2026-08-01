-- Correct Prompt 2C revision trigger ordering before public-beta activation.
begin;

drop trigger if exists qelly_calculation_revision on public.qelly_saved_calculations;
drop function if exists public.qelly_capture_calculation_revision();

create or replace function public.qelly_prepare_calculation_revision()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if row(old.title,old.formula_id,old.input_payload,old.result_payload,old.provenance,old.deleted_at)
     is distinct from
     row(new.title,new.formula_id,new.input_payload,new.result_payload,new.provenance,new.deleted_at) then
    new.current_revision=old.current_revision+1;
  end if;
  return new;
end $$;

create or replace function public.qelly_capture_calculation_revision()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or new.current_revision is distinct from old.current_revision then
    insert into public.qelly_saved_calculation_revisions(
      calculation_id,owner_id,revision_no,snapshot,created_by
    ) values (
      new.id,
      new.owner_id,
      new.current_revision,
      jsonb_build_object(
        'title',new.title,
        'formulaId',new.formula_id,
        'input',new.input_payload,
        'result',new.result_payload,
        'provenance',new.provenance,
        'deletedAt',new.deleted_at,
        'capturedAt',now()
      ),
      coalesce(auth.uid(),new.owner_id)
    ) on conflict (calculation_id,revision_no) do nothing;
  end if;
  return null;
end $$;

create trigger qelly_calculation_prepare_revision
before update on public.qelly_saved_calculations
for each row execute function public.qelly_prepare_calculation_revision();

create trigger qelly_calculation_capture_revision
after insert or update on public.qelly_saved_calculations
for each row execute function public.qelly_capture_calculation_revision();

commit;
