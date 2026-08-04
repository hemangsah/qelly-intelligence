-- Qelly atomic cloud synchronization batch v1.
-- Commit-only migration: test on an isolated Supabase branch before production.

create table if not exists qelly_private.sync_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.qelly_workspaces(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint qelly_sync_batches_idempotency_key_check
    check (char_length(idempotency_key) between 8 and 128),
  constraint qelly_sync_batches_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint qelly_sync_batches_status_check
    check (status in ('processing', 'completed')),
  constraint qelly_sync_batches_result_check
    check (jsonb_typeof(result) = 'object'),
  constraint qelly_sync_batches_owner_key_unique
    unique (owner_id, idempotency_key)
);

revoke all on table qelly_private.sync_batches from public, anon, authenticated;

alter table public.qelly_sync_operations
  add column if not exists request_hash text,
  add column if not exists result jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.qelly_sync_operations'::regclass
       and conname = 'qelly_sync_operations_request_hash_check'
  ) then
    alter table public.qelly_sync_operations
      add constraint qelly_sync_operations_request_hash_check
      check (request_hash is null or request_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.qelly_sync_operations'::regclass
       and conname = 'qelly_sync_operations_result_check'
  ) then
    alter table public.qelly_sync_operations
      add constraint qelly_sync_operations_result_check
      check (jsonb_typeof(result) = 'object');
  end if;
end
$$;

create or replace function public.qelly_sync_push_batch(
  p_workspace_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_items jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_role text;
  v_opt_in boolean;
  v_server_hash text;
  v_batch qelly_private.sync_batches%rowtype;
  v_item jsonb;
  v_record jsonb;
  v_existing public.qelly_saved_calculations%rowtype;
  v_stored public.qelly_saved_calculations%rowtype;
  v_id uuid;
  v_operation_id uuid;
  v_base_revision integer;
  v_operation_type text;
  v_title text;
  v_formula_id text;
  v_input_payload jsonb;
  v_result_payload jsonb;
  v_provenance jsonb;
  v_client_updated_at timestamptz;
  v_deleted_at timestamptz;
  v_item_result jsonb;
  v_prior_status text;
  v_prior_hash text;
  v_prior_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_response jsonb;
  v_applied integer := 0;
  v_conflicts integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  p_idempotency_key := btrim(coalesce(p_idempotency_key, ''));
  p_request_hash := lower(btrim(coalesce(p_request_hash, '')));

  if char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'client_request_hash_invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'sync_items_must_be_array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'sync_batch_size_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) as t(value)
     group by value ->> 'id'
    having count(*) > 1
  ) then
    raise exception 'sync_duplicate_calculation_id' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_items) as t(value)
     group by value ->> 'operationId'
    having count(*) > 1
  ) then
    raise exception 'sync_duplicate_operation_id' using errcode = '22023';
  end if;

  v_server_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'workspaceId', p_workspace_id,
          'items', p_items
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select qelly_private.workspace_role(p_workspace_id, v_actor)
    into v_workspace_role;

  if v_workspace_role is null or v_workspace_role not in ('owner', 'editor') then
    raise exception 'workspace_write_forbidden' using errcode = '42501';
  end if;

  select cloud_sync_opt_in
    into v_opt_in
    from public.qelly_profiles
   where user_id = v_actor;

  if coalesce(v_opt_in, false) is false then
    raise exception 'cloud_opt_in_required' using errcode = '42501';
  end if;

  insert into qelly_private.sync_batches (
    owner_id,
    workspace_id,
    idempotency_key,
    request_hash,
    status
  ) values (
    v_actor,
    p_workspace_id,
    p_idempotency_key,
    v_server_hash,
    'processing'
  )
  on conflict (owner_id, idempotency_key) do nothing;

  select *
    into v_batch
    from qelly_private.sync_batches
   where owner_id = v_actor
     and idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'sync_batch_ledger_unavailable';
  end if;

  if v_batch.workspace_id is distinct from p_workspace_id
     or v_batch.request_hash is distinct from v_server_hash then
    raise exception 'idempotency_key_reused_with_different_request' using errcode = '22023';
  end if;

  if v_batch.status = 'completed' then
    return v_batch.result || jsonb_build_object(
      'batchId', v_batch.id,
      'requestHash', v_server_hash,
      'replayed', true
    );
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items) as t(value)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'sync_item_must_be_object' using errcode = '22023';
    end if;

    begin
      v_id := nullif(v_item ->> 'id', '')::uuid;
      v_operation_id := nullif(v_item ->> 'operationId', '')::uuid;
    exception when others then
      raise exception 'sync_uuid_invalid' using errcode = '22023';
    end;

    if v_id is null or v_operation_id is null then
      raise exception 'sync_uuid_required' using errcode = '22023';
    end if;

    if v_item ? 'baseRevision' and v_item -> 'baseRevision' <> 'null'::jsonb then
      begin
        v_base_revision := (v_item ->> 'baseRevision')::integer;
      exception when others then
        raise exception 'sync_base_revision_invalid' using errcode = '22023';
      end;
      if v_base_revision < 0 then
        raise exception 'sync_base_revision_invalid' using errcode = '22023';
      end if;
    else
      v_base_revision := null;
    end if;

    v_record := v_item -> 'record';
    if jsonb_typeof(v_record) is distinct from 'object' then
      raise exception 'sync_record_invalid' using errcode = '22023';
    end if;

    v_title := btrim(coalesce(v_record ->> 'title', ''));
    v_formula_id := btrim(coalesce(v_record ->> 'formula_id', ''));
    v_input_payload := coalesce(v_record -> 'input_payload', '{}'::jsonb);
    v_result_payload := coalesce(v_record -> 'result_payload', '{}'::jsonb);
    v_provenance := coalesce(v_record -> 'provenance', '{}'::jsonb);

    if char_length(v_title) not between 1 and 160
       or char_length(v_formula_id) not between 1 and 160 then
      raise exception 'sync_record_text_invalid' using errcode = '22023';
    end if;

    if jsonb_typeof(v_input_payload) is distinct from 'object'
       or jsonb_typeof(v_result_payload) is distinct from 'object'
       or jsonb_typeof(v_provenance) is distinct from 'object' then
      raise exception 'sync_record_payload_invalid' using errcode = '22023';
    end if;

    begin
      v_client_updated_at := nullif(v_record ->> 'client_updated_at', '')::timestamptz;
      v_deleted_at := nullif(v_record ->> 'deleted_at', '')::timestamptz;
    exception when others then
      raise exception 'sync_record_timestamp_invalid' using errcode = '22023';
    end;

    select status, request_hash, result
      into v_prior_status, v_prior_hash, v_prior_result
      from public.qelly_sync_operations
     where owner_id = v_actor
       and client_operation_id = v_operation_id
     for update;

    if found then
      if v_prior_hash is distinct from v_server_hash then
        raise exception 'operation_id_reused_with_different_request' using errcode = '22023';
      end if;
      v_item_result := coalesce(v_prior_result, '{}'::jsonb);
      v_results := v_results || jsonb_build_array(v_item_result);
      if v_prior_status = 'applied' then
        v_applied := v_applied + 1;
      elsif v_prior_status = 'conflict' then
        v_conflicts := v_conflicts + 1;
      end if;
      continue;
    end if;

    select *
      into v_existing
      from public.qelly_saved_calculations
     where id = v_id
     for update;

    if found and (
      v_existing.owner_id is distinct from v_actor
      or v_existing.workspace_id is distinct from p_workspace_id
    ) then
      raise exception 'saved_record_not_available' using errcode = '42501';
    end if;

    if found then
      v_operation_type := 'update';
      if v_base_revision is null
         or v_base_revision is distinct from v_existing.current_revision then
        v_item_result := jsonb_build_object(
          'id', v_id,
          'status', 'conflict',
          'cloudRevision', v_existing.current_revision,
          'cloudUpdatedAt', v_existing.updated_at,
          'rejectionCode', 'revision_conflict'
        );

        insert into public.qelly_sync_operations (
          owner_id,
          client_operation_id,
          calculation_id,
          operation_type,
          base_revision,
          payload,
          status,
          rejection_code,
          request_hash,
          result
        ) values (
          v_actor,
          v_operation_id,
          v_id,
          v_operation_type,
          v_base_revision,
          jsonb_build_object(
            'batchId', v_batch.id,
            'title', v_title,
            'clientUpdatedAt', v_client_updated_at,
            'clientRequestHash', p_request_hash
          ),
          'conflict',
          'revision_conflict',
          v_server_hash,
          v_item_result
        );

        v_results := v_results || jsonb_build_array(v_item_result);
        v_conflicts := v_conflicts + 1;
        continue;
      end if;

      update public.qelly_saved_calculations
         set title = v_title,
             formula_id = v_formula_id,
             input_payload = v_input_payload,
             result_payload = v_result_payload,
             provenance = v_provenance,
             client_updated_at = v_client_updated_at,
             deleted_at = v_deleted_at
       where id = v_id
       returning * into v_stored;
    else
      v_operation_type := 'create';
      if v_base_revision is not null and v_base_revision <> 0 then
        v_item_result := jsonb_build_object(
          'id', v_id,
          'status', 'conflict',
          'cloudRevision', null,
          'cloudUpdatedAt', null,
          'rejectionCode', 'remote_record_missing'
        );

        insert into public.qelly_sync_operations (
          owner_id,
          client_operation_id,
          calculation_id,
          operation_type,
          base_revision,
          payload,
          status,
          rejection_code,
          request_hash,
          result
        ) values (
          v_actor,
          v_operation_id,
          null,
          'create',
          v_base_revision,
          jsonb_build_object(
            'batchId', v_batch.id,
            'title', v_title,
            'clientRequestHash', p_request_hash
          ),
          'conflict',
          'remote_record_missing',
          v_server_hash,
          v_item_result
        );

        v_results := v_results || jsonb_build_array(v_item_result);
        v_conflicts := v_conflicts + 1;
        continue;
      end if;

      insert into public.qelly_saved_calculations (
        id,
        workspace_id,
        owner_id,
        title,
        formula_id,
        input_payload,
        result_payload,
        provenance,
        client_updated_at,
        deleted_at
      ) values (
        v_id,
        p_workspace_id,
        v_actor,
        v_title,
        v_formula_id,
        v_input_payload,
        v_result_payload,
        v_provenance,
        v_client_updated_at,
        v_deleted_at
      )
      returning * into v_stored;
    end if;

    v_item_result := jsonb_build_object(
      'id', v_id,
      'status', 'applied',
      'cloudRevision', v_stored.current_revision,
      'cloudUpdatedAt', v_stored.updated_at
    );

    insert into public.qelly_sync_operations (
      owner_id,
      client_operation_id,
      calculation_id,
      operation_type,
      base_revision,
      payload,
      status,
      applied_at,
      request_hash,
      result
    ) values (
      v_actor,
      v_operation_id,
      v_id,
      v_operation_type,
      v_base_revision,
      jsonb_build_object(
        'batchId', v_batch.id,
        'title', v_title,
        'clientUpdatedAt', v_client_updated_at,
        'clientRequestHash', p_request_hash
      ),
      'applied',
      now(),
      v_server_hash,
      v_item_result
    );

    v_results := v_results || jsonb_build_array(v_item_result);
    v_applied := v_applied + 1;
  end loop;

  v_response := jsonb_build_object(
    'batchId', v_batch.id,
    'requestHash', v_server_hash,
    'results', v_results,
    'applied', v_applied,
    'conflicts', v_conflicts,
    'replayed', false
  );

  update qelly_private.sync_batches
     set status = 'completed',
         result = v_response,
         completed_at = now()
   where id = v_batch.id;

  return v_response;
end
$$;

revoke all on function public.qelly_sync_push_batch(uuid, text, text, jsonb)
  from public, anon, service_role;
grant execute on function public.qelly_sync_push_batch(uuid, text, text, jsonb)
  to authenticated;

comment on function public.qelly_sync_push_batch(uuid, text, text, jsonb) is
  'Atomic, idempotent, compare-and-swap synchronization batch for the authenticated Qelly workspace.';

notify pgrst, 'reload schema';
