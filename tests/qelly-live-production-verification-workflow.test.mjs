import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const V1='.github/workflows/qelly-live-production-verification.yml';
const V2='.github/workflows/qelly-live-production-verification-v2.yml';
const OBSOLETE_BRANCH='feature/prompt2c-global-public-beta';
const OBSOLETE_RELEASE='92f277f803a307e660e25bb2eef873a6337f4999';
const RELEASE_REF='refs/heads/release/qelly-global-public-beta';

test('V2 automatically verifies the exact release-branch commit instead of a historical SHA',async()=>{
  const source=await read(V2);
  assert.match(source,/push:\s*\n\s*branches:\s*\[release\/qelly-global-public-beta\]/);
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/RELEASE_SHA:\s*\$\{\{ github\.sha \}\}/);
  assert.match(source,new RegExp(`test "\\$GITHUB_REF" = "${RELEASE_REF.replaceAll('/','\\/')}"`));
  assert.match(source,/test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/);
  assert.match(source,/qelly-live-production-verification-v2-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(source,new RegExp(OBSOLETE_BRANCH.replaceAll('/','\\/')));
  assert.doesNotMatch(source,new RegExp(OBSOLETE_RELEASE));
});

test('V2 retains live release, runtime, provider and browser verification surfaces',async()=>{
  const source=await read(V2);
  for(const marker of [
    'qelly-release.json',
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

test('legacy V1 is manual-only and cannot automatically compete with V2',async()=>{
  const source=await read(V1);
  assert.match(source,/on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(source,/\n\s*push:/);
  assert.match(source,/RELEASE_SHA:\s*\$\{\{ github\.sha \}\}/);
  assert.match(source,new RegExp(`test "\\$GITHUB_REF" = "${RELEASE_REF.replaceAll('/','\\/')}"`));
  assert.match(source,/test "\$\(git rev-parse HEAD\)" = "\$RELEASE_SHA"/);
  assert.doesNotMatch(source,new RegExp(OBSOLETE_BRANCH.replaceAll('/','\\/')));
  assert.doesNotMatch(source,new RegExp(OBSOLETE_RELEASE));
});
