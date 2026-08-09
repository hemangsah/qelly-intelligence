import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const migrations = {
  trigger: 'infra/supabase/migrations/20260808160502_qelly_trigger_helper_execute_hardening_v1.sql',
  indexes: 'infra/supabase/migrations/20260808160525_qelly_fk_covering_indexes_v1.sql',
  cleanup: 'infra/supabase/migrations/20260808160635_qelly_fk_covering_indexes_duplicate_cleanup_v1.sql'
};

const functions = {
  accountExport: 'infra/supabase/functions/qelly-account-export/index.ts',
  revisionRestore: 'infra/supabase/functions/qelly-revision-restore/index.ts',
  workspaceApi: 'infra/supabase/functions/qelly-workspace-api/index.ts',
  workspaceSearch: 'infra/supabase/functions/qelly-workspace-search/index.ts',
  verifyRuntime: 'infra/supabase/functions/qelly-verify-runtime/index.ts'
};

test('production trigger-helper hardening is represented in source control', async () => {
  const sql = await read(migrations.trigger);
  const helpers = [
    'prevent_workspace_owner_reassignment',
    'prepare_research_revision',
    'capture_research_revision',
    'prepare_decision_revision',
    'capture_decision_revision',
    'prepare_dashboard_layout_revision',
    'capture_dashboard_layout_revision',
    'prepare_theme_preset_revision',
    'capture_theme_preset_revision'
  ];

  for (const helper of helpers) {
    assert.match(
      sql,
      new RegExp(`revoke execute on function qelly_private\\.${helper}\\(\\) from public;`, 'i'),
      `missing PUBLIC EXECUTE revocation for ${helper}`
    );
  }
  assert.equal((sql.match(/revoke execute on function/gi) ?? []).length, helpers.length);
});

test('production FK covering-index migration and duplicate cleanup remain paired', async () => {
  const createSql = await read(migrations.indexes);
  const cleanupSql = await read(migrations.cleanup);
  const names = [
    'qelly_dashboard_revisions_workspace_idx',
    'qelly_data_quality_instrument_idx',
    'qelly_data_quality_provider_idx',
    'qelly_data_quality_series_idx',
    'qelly_decision_revisions_workspace_idx',
    'qelly_notification_delivery_event_idx',
    'qelly_portfolio_positions_workspace_idx',
    'qelly_provenance_edges_to_node_idx',
    'qelly_research_revisions_workspace_idx',
    'qelly_runtime_jobs_workspace_idx',
    'qelly_theme_revisions_workspace_idx',
    'qelly_theme_schedules_preset_idx',
    'qelly_timeseries_series_provider_idx',
    'qelly_verify_revisions_owner_idx',
    'qelly_watchlist_items_workspace_idx',
    'qelly_comments_parent_idx'
  ];

  for (const name of names) {
    assert.match(createSql, new RegExp(`create index if not exists ${name}\\b`, 'i'));
    assert.match(cleanupSql, new RegExp(`drop index if exists public\\.${name};`, 'i'));
  }
  assert.equal((createSql.match(/create index if not exists/gi) ?? []).length, names.length);
  assert.equal((cleanupSql.match(/drop index if exists/gi) ?? []).length, names.length);
});

test('source-controlled Edge Functions match the sanitized production revisions', async () => {
  const [accountExport, revisionRestore, workspaceApi, workspaceSearch, verifyRuntime] = await Promise.all(
    Object.values(functions).map(read)
  );

  assert.match(accountExport, /qelly-account-export-2026-08-08-v3/);
  assert.match(accountExport, /catch\(_error\)\{return fail\(500,"account_export_failed","Account export failed safely"\);\}/);

  assert.match(revisionRestore, /qelly-revision-restore-2026-08-08-v3/);
  assert.match(revisionRestore, /catch\(_error\)\{return fail\(500,"revision_restore_error","Revision restore failed safely"\);\}/);

  assert.match(workspaceApi, /qelly-supabase-workspace-api-2026-08-08-v3/);
  assert.match(workspaceApi, /function safeCaughtFailure\(error:any\)/);
  assert.match(workspaceApi, /return fail\(500,"workspace_api_error","Workspace API request failed safely"\)/);

  assert.match(workspaceSearch, /qelly-workspace-search-2026-08-08-v3/);
  assert.match(workspaceSearch, /catch\(_error\)\{return fail\(500,"search_runtime_error","Workspace search failed safely"\);\}/);

  assert.match(verifyRuntime, /const RUNTIME_VERSION=4;/);
  assert.match(verifyRuntime, /const SAFE_VERIFY_ERRORS:Record<string,string>=/);
  assert.match(verifyRuntime, /Unable to seal Qelly Verify evidence safely\./);
});

test('unexpected caught exception internals are not serialized into client-visible JSON', async () => {
  const sources = await Promise.all(Object.entries(functions).map(async ([name, path]) => [name, await read(path)]));
  const forbidden = [
    /error\s+instanceof\s+Error\s*\?\s*error\.message/,
    /String\(error\)/,
    /message\s*:\s*error\.message/,
    /message\s*:\s*e\.message/
  ];

  for (const [name, source] of sources) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} must not expose arbitrary caught exception internals`);
    }
  }

  const workspaceApi = Object.fromEntries(sources).workspaceApi;
  assert.match(workspaceApi, /return safeCaughtFailure\(error\)/);

  const verifyRuntime = Object.fromEntries(sources).verifyRuntime;
  assert.match(verifyRuntime, /const code=typeof e\?\.code==='string'\?e\.code:'verify_seal_failed'/);
  assert.match(verifyRuntime, /if\(message\)return send\(400,\{error:code,message,sourceRevision:SOURCE_REVISION\}\)/);
});
