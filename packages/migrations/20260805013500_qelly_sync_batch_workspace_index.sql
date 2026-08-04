-- Cover the sync batch workspace foreign key for cascade and workspace cleanup.
create index if not exists qelly_sync_batches_workspace_idx
  on qelly_private.sync_batches(workspace_id);
