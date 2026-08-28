import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const WORKFLOW='.github/workflows/cloudflare-production.yml';
const LEGACY_WORKFLOW='.github/workflows/qelly-live-production-verification-v2.yml';
const PUBLIC_RUNTIME_WORKFLOW='.github/workflows/public-runtime.yml';
const CONVERGENCE='scripts/wait-for-cloudflare-runtime-convergence.mjs';
const PROVIDERS='functions/_lib/providers.js';
const OBSOLETE_BRANCH='feature/prompt2c-global-public-beta';
const OBSOLETE_RELEASE='92f277f803a307e660e25bb2eef873a6337f4999';
const RELEASE_REF='refs/heads/release/qelly-global-public-beta';

test('public runtime workflow is the automatic exact-SHA release verifier and uses stable shared convergence',async()=>{
  const source=await read(PUBLIC_RUNTIME_WORKFLOW);
  assert.match(source,/push:\s*\n\s*branches:\s*\n\s*- release\/qelly-global-public-beta/);
  assert.match(source,/RELEASE_SHA:\s*\$\{\{ github\.sha \}\}/);
  assert.match(source,/github\.event_name == 'push'[\s\S]*github\.ref == 'refs\/heads\/release\/qelly-global-public-beta'/);
  assert.ok(source.includes('node scripts/wait-for-cloudflare-runtime-convergence.mjs'));
  assert.ok(source.includes('Verify browser startup under deployed CSP'));
  assert.ok(source.includes('qelly-live-public-verification-${{ github.sha }}'));
  assert.ok(source.includes('blocked_pending_redistribution_rights'));
  assert.ok(source.includes('blocked_pending_written_end_user_display_permission'));
});

test('canonical workflow is a manual release-branch diagnostic with dynamic identity and shared convergence',async()=>{
  const source=await read(WORKFLOW);
  assert.match(source,/on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(source,/\n\s*push:/);
  assert.match(source,/RELEASE_SHA:\s*\$\{\{ github\.sha \}\}/);
  assert.match(source,new RegExp(`test "\\$GITHUB_REF" = "${RELEASE_REF.replaceAll('/','\\/')}"`));
  assert.match(source,/test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/);
  assert.ok(source.includes("import {waitForCloudflareRuntimeConvergence} from './scripts/wait-for-cloudflare-runtime-convergence.mjs';"));
  assert.ok(source.includes("outputDir:'dist/live-production-verification/http'"));
  assert.doesNotMatch(source,/seq 1 18/);
  assert.match(source,/qelly-live-production-verification-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(source,new RegExp(OBSOLETE_BRANCH.replaceAll('/','\\/')));
  assert.doesNotMatch(source,new RegExp(OBSOLETE_RELEASE));
});

test('canonical workflow retains live release, runtime, provider and browser diagnostic surfaces through shared convergence',async()=>{
  const [source,convergence]=await Promise.all([read(WORKFLOW),read(CONVERGENCE)]);
  assert.ok(convergence.includes('/qelly-release.json?'),'shared convergence must verify the release identity surface');
  for(const marker of [
    'qelly-config.js',
    'BUILD_INFO.json',
    'api/v1/health',
    'api/v1/readiness',
    'api/v1/config',
    'api/v1/providers/status',
    'api/v1/providers/binance?symbol=BTCUSDT',
    'api/v1/providers/coinbase?symbol=BTC-USD',
    'api/v1/providers/ecb?symbol=EUR',
    'npx playwright install --with-deps chromium',
    'inlineScriptCount',
    'startupFailure'
  ])assert.ok(source.includes(marker),`missing live verification marker: ${marker}`);
  assert.match(source,/release\.releaseSha!==process\.env\.RELEASE_SHA/);
  assert.match(source,/config\.releaseSha!==process\.env\.RELEASE_SHA/);
  assert.match(source,/health\.status!==['"]ok['"]\|\|health\.releaseSha!==process\.env\.RELEASE_SHA/);
});

test('canonical provider verification follows the rights-gated provider policy',async()=>{
  const [source,providers]=await Promise.all([read(WORKFLOW),read(PROVIDERS)]);
  for(const marker of [
    'blocked_pending_redistribution_rights',
    'provider_redistribution_rights_not_verified',
    'blocked_pending_written_end_user_display_permission',
    'provider_end_user_display_rights_not_verified'
  ]){
    assert.ok(providers.includes(marker),`provider owner missing policy marker: ${marker}`);
    assert.ok(source.includes(marker),`manual verifier missing canonical policy marker: ${marker}`);
  }
  assert.match(source,/validateProvider\(binance,'binance'\)/);
  assert.match(source,/validateProvider\(coinbase,'coinbase'\)/);
  assert.match(source,/validateRightsBlocked\(binance/);
  assert.match(source,/validateRightsBlocked\(coinbase/);
  assert.doesNotMatch(source,/validateProvider\(coinbase,'coinbase-exchange-public'\)/);
  assert.doesNotMatch(source,/coinbase\.truthState!==['"]live_provider['"]/);
  assert.doesNotMatch(source,/binance_degraded_truth_invalid/);
});

test('duplicate versioned workflow has been retired',async()=>{
  await assert.rejects(access(new URL(`../${LEGACY_WORKFLOW}`,import.meta.url)));
});
