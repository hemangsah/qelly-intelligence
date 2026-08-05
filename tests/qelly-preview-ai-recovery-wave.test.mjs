import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateDecision,normalizeDecisionInput} from '../apps/web/public/assets/qelly-decision-engine.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('decision engine is deterministic, bounded and never executable',()=>{
  const input={assetId:'QI-CRYPTO-SOL',horizon:'30d',risk:'balanced',evidenceConfidence:80,scenarioMove:-12};
  const first=evaluateDecision(input);
  const second=evaluateDecision(input);
  assert.deepEqual(first,second);
  assert.ok(first.score>=0&&first.score<=100);
  assert.equal(first.execution,false);
  assert.equal(first.modelState,'deterministic-explainable-framework');
  assert.match(first.boundary,/Not live AI/i);
  assert.equal(normalizeDecisionInput({assetId:'unknown'}).assetId,'QI-CRYPTO-BTC');
});

test('public recovery catches the exact broken route states from the reported screenshots',async()=>{
  const source=await read('apps/web/public/assets/qelly-public-recovery.mjs');
  for(const phrase of ['unable to render this route','authentication is required','retry foundation route'])assert.match(source,new RegExp(phrase,'i'));
  assert.match(source,/publicRoutes=new Set/);
  assert.match(source,/renderRankingsRecovery/);
  assert.match(source,/view=decision-maker/);
  assert.match(source,/qelly-symbol\.svg/);
  assert.match(source,/MutationObserver/);
  assert.doesNotMatch(source,/placeOrder|executeTrade|wallet\.sign|personalized advice/i);
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

test('decision provenance remains functional in preview instead of disabling the decision workflow',async()=>{
  const source=await read('apps/web/public/assets/routes/decision-provenance.mjs');
  assert.match(source,/AI Decision Maker/);
  assert.match(source,/Run decision analysis/);
  assert.match(source,/evaluateDecision/);
  assert.match(source,/deterministic explainable framework/i);
  assert.match(source,/Execution disabled/);
  assert.doesNotMatch(source,/Creation is unavailable in this static visual preview/);
  assert.doesNotMatch(source,/\$\{isDemo\?'disabled'/);
});

test('static preview build restores the validator-compatible truth contract',async()=>{
  const build=await read('scripts/build-frontend.mjs');
  assert.match(build,/const runtimeConfig=staticVisualPreview\?\{/);
  assert.match(build,/deploymentStage:'github-pages'/);
  assert.match(build,/previewLabel:'Static visual preview'/);
  assert.match(build,/artifact:staticVisualPreview\?'static-frontend':'static-frontend-with-pages-functions'/);
  assert.match(build,/CF_PAGES_COMMIT_SHA\?\?process\.env\.GITHUB_SHA\?\?process\.env\.QELLY_PUBLIC_RELEASE_SHA/);
});

test('foundation integration installs the Supabase compatibility layer before migrations',async()=>{
  const workflow=await read('.github/workflows/production-foundation-services.yml');
  assert.match(workflow,/postgres:17-alpine/);
  const scaffold=workflow.indexOf('qelly_supabase_pg17_stub.sql');
  const migrate=workflow.indexOf('Apply production migrations');
  assert.ok(scaffold>=0&&migrate>scaffold,{scaffold,migrate});
  assert.match(workflow,/psql "\$DATABASE_URL" -v ON_ERROR_STOP=1/);
});
