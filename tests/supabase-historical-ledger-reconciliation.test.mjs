import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'infra', 'supabase', 'migrations');

const recovered = [
  ['20260808084412_qelly_intelligence_workspace_persistence_v1.sql', ['qelly_research_projects','qelly_research_evidence','qelly_decisions','qelly_provenance_nodes','qelly_watchlists','qelly_alert_rules','prevent_workspace_owner_reassignment']],
  ['20260808084642_qelly_workspace_intelligence_persistence_wave_2.sql', ['qelly_decision_revisions','qelly_portfolios','qelly_import_jobs','qelly_saved_views','qelly_workspace_comments','prepare_research_revision','prepare_decision_revision']],
  ['20260808085124_qelly_provider_data_runtime_foundation_v1.sql', ['qelly_providers','qelly_provider_readiness','qelly_instruments','qelly_timeseries_series','qelly_timeseries_points','qelly_data_quality_events']],
  ['20260808085300_qelly_alert_delivery_observability_dashboard_v1.sql', ['qelly_alert_events','qelly_notification_deliveries','qelly_runtime_jobs','qelly_release_identity','qelly_dashboard_layouts','prepare_dashboard_layout_revision']],
  ['20260808091443_qelly_theme_intelligence_persistence_v1.sql', ['qelly_theme_presets','qelly_theme_preset_revisions','qelly_theme_schedules','prepare_theme_preset_revision']]
];

test('historical Supabase ledger migrations are source-controlled with explicit no-replay provenance', () => {
  for (const [file, needles] of recovered) {
    const full = path.join(dir, file);
    assert.ok(fs.existsSync(full), `${file} must exist`);
    const sql = fs.readFileSync(full, 'utf8');
    assert.match(sql, /HISTORICAL SOURCE RECOVERY/);
    assert.match(sql, /Do not manually replay against current production/);
    for (const needle of needles) assert.ok(sql.includes(needle), `${file} must preserve ${needle}`);
    assert.doesNotMatch(sql, /qelly_.*_fk_idx/i, `${file} must not absorb later FK covering-index migrations`);
  }
});

test('historical backfills retain original live ledger versions and remain separate from later hardening', () => {
  const names = recovered.map(([file]) => file.slice(0, 14));
  assert.deepEqual(names, ['20260808084412','20260808084642','20260808085124','20260808085300','20260808091443']);

  const later = [
    '20260808160502_qelly_trigger_helper_execute_hardening_v1.sql',
    '20260808160525_qelly_fk_covering_indexes_v1.sql',
    '20260808160635_qelly_fk_covering_indexes_duplicate_cleanup_v1.sql'
  ];
  for (const file of later) assert.ok(fs.existsSync(path.join(dir, file)), `${file} must remain separately source-controlled`);
});
