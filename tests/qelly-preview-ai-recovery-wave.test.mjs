import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {migrationProfileForFile,normalizeMigrationProfile,selectMigrationFiles} from '../scripts/migration-file-policy.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('retired fixed-profile Decision engine is absent from the public application',async()=>{
  await assert.rejects(read('apps/web/public/assets/qelly-decision-engine.mjs'));
  const route=await read('apps/web/public/assets/routes/decision-provenance.mjs');
  assert.match(route,/renderDecisionProvenGraph/);
  assert.doesNotMatch(route,/evaluateDecision|deterministic-explainable-framework|fixed scenario/);
});

test('public recovery catches the exact broken route states from the reported screenshots',async()=>{
  const source=await read('apps/web/public/assets/qelly-public-recovery.mjs');
  for(const phrase of ['unable to render this route','authentication is required','retry foundation route'])assert.match(source,new RegExp(phrase,'i'));
  assert.match(source,/publicRoutes=new Set/);
  assert.match(source,/renderRankingsRecovery/);
  assert.match(source,/view=decision-maker/);
  assert.match(source,/qelly-logo-primary\.svg/);
  assert.match(source,/MutationObserver/);
  assert.match(source,/qellyRecoveryOwner!=='decision-maker'\|\|!main\.querySelector\('\[data-qelly-recovery-owned="decision-maker"\]'\)/);
  assert.doesNotMatch(source,/placeOrder|executeTrade|wallet\.sign/i);
  assert.match(source,/No execution\. No personalized advice\./i);
  assert.doesNotMatch(source,/qelly-intelligence\.pages\.dev|governed degraded mode|No authorized provider observation|no-fabrication boundary/i);
  assert.match(source,/terminal\.qellyintelligence\.com/);
});

test('static preview receives one compact recovery shell and official decision navigation',async()=>{
  const [index,style]=await Promise.all([
    read('apps/web/public/index.html'),
    read('apps/web/public/assets/qelly-public-recovery.css')
  ]);
  assert.match(index,/qelly-public-recovery\.css/);
  assert.match(index,/qelly-public-recovery\.mjs/);
  assert.ok(index.indexOf('qelly-public-recovery.mjs')>index.indexOf('app.js'));
  assert.match(style,/data-qelly-recovery-shell="static-preview"/);
  assert.match(style,/\.q-global-strip/);
  assert.match(style,/\.q-command-bar/);
  assert.match(style,/\.q-recovery-header/);
  assert.match(style,/\.q-decision-workspace/);
});

test('decision preview recovery remains functional without manufacturing a substitute trade view',async()=>{
  const [route,rescue]=await Promise.all([
    read('apps/web/public/assets/routes/decision-provenance.mjs'),
    read('apps/web/public/assets/qelly-canonical-route-rescue.mjs')
  ]);
  assert.match(route,/renderDecisionProvenGraph/);
  assert.match(rescue,/Decision Intelligence unavailable/);
  assert.match(rescue,/No substitute decision generated/);
  assert.match(rescue,/NO TRADE/);
  assert.match(rescue,/FAIL CLOSED/);
  assert.match(rescue,/No substitute data, probability, entry, stop, target, or confidence was generated/);
  assert.doesNotMatch(rescue,/evaluateDecision|Run local analysis|Evidence confidence|Scenario move %/);
});

test('static preview remains an internal validator-compatible mode alongside the production Pages mirror',async()=>{
  const build=await read('scripts/build-frontend.mjs');
  assert.match(build,/const runtimeConfig=staticVisualPreview\?\{/);
  assert.match(build,/deploymentStage:'github-pages-static-preview'/);
  assert.match(build,/previewLabel:'Static visual preview'/);
  assert.match(build,/githubPagesMirror\?'github-pages-public-mirror':'static-frontend-with-pages-functions'/);
  assert.match(build,/CF_PAGES_COMMIT_SHA\?\?process\.env\.GITHUB_SHA\?\?process\.env\.QELLY_PUBLIC_RELEASE_SHA/);
  assert.match(build,/if\(staticVisualPreview&&githubPagesMirror\)throw new Error/);
});

test('migration profiles separate incompatible platform and Supabase schemas',async()=>{
  const names=await readdir(new URL('../packages/migrations/',import.meta.url));
  const platform=selectMigrationFiles(names,'platform');
  const supabase=selectMigrationFiles(names,'supabase');
  assert.equal(platform.at(-1),'108_saved_calculation_lifecycle.sql');
  assert.equal(supabase[0],'109_prompt2c_global_public_beta.sql');
  assert.equal(platform.includes('109_prompt2c_global_public_beta.sql'),false);
  assert.equal(supabase.includes('108_saved_calculation_lifecycle.sql'),false);
  assert.equal(supabase.includes('110_prompt2c_global_public_beta.down.sql'),false);
  assert.equal(migrationProfileForFile('110a_qelly_private_workspace_role_policy_transition.sql'),'supabase');
  assert.equal(normalizeMigrationProfile(undefined),'platform');
  assert.throws(()=>normalizeMigrationProfile(undefined,{production:true}),error=>error?.code==='migration_profile_required');
});

test('foundation integration runs only the explicit platform migration profile',async()=>{
  const workflow=await read('.github/workflows/production-foundation-services.yml');
  assert.match(workflow,/postgres:17-alpine/);
  assert.match(workflow,/QELLY_MIGRATION_PROFILE: platform/);
  assert.match(workflow,/Apply platform migrations/);
  assert.doesNotMatch(workflow,/qelly_supabase_pg17_stub\.sql/);
});

test('production migrator rejects profile mixing, rollback files and unmanaged replays',async()=>{
  const source=await read('scripts/migrate-production.mjs');
  assert.match(source,/selectMigrationFiles\(await readdir\(migrationDir\),profile\)/);
  assert.match(source,/migration_profile_mismatch/);
  assert.match(source,/migration_history_bootstrap_required/);
  assert.match(source,/qelly-controlled-migrator-v3:\$\{profile\}/);
  assert.doesNotMatch(source,/filter\(\(name\) => \/\^\\d\+\.\*\\\.sql\$\//);
});
