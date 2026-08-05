-- Keep synchronization evidence read-only for authenticated clients.
-- Remove obsolete write policies after table privileges were revoked.

drop policy if exists qelly_sync_own_insert
  on public.qelly_sync_operations;
drop policy if exists qelly_sync_own_update
  on public.qelly_sync_operations;
drop policy if exists qelly_sync_own_delete
  on public.qelly_sync_operations;
drop policy if exists qelly_sync_own_select
  on public.qelly_sync_operations;

create policy qelly_sync_own_select
on public.qelly_sync_operations
for select
to authenticated
using (owner_id=(select auth.uid()));

notify pgrst, 'reload schema';
