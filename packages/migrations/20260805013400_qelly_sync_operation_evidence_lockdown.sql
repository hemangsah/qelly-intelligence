-- Qelly sync-operation evidence lockdown.
-- The atomic SECURITY DEFINER RPC remains the only authenticated write path.

revoke all privileges on table public.qelly_sync_operations
  from anon, authenticated;

grant select on table public.qelly_sync_operations
  to authenticated;

comment on table public.qelly_sync_operations is
  'Server-written synchronization operation evidence. Authenticated clients have read-only access through RLS.';

notify pgrst, 'reload schema';
