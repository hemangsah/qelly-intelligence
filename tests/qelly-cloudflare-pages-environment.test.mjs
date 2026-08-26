import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveDeploymentEnvironment} from '../scripts/deployment-environment.mjs';

test('Cloudflare Pages builds inherit committed public runtime variables',()=>{
  const environment=effectiveDeploymentEnvironment({CF_PAGES:'1'});
  assert.equal(environment.QELLY_REQUIRE_PUBLIC_RUNTIME,'true');
  assert.equal(environment.QELLY_PUBLIC_SITE_URL,'https://qelly-intelligence.pages.dev');
  assert.equal(environment.QELLY_PUBLIC_SUPABASE_URL,'https://ssdgfgqnjlwzkgukzeef.supabase.co');
  assert.match(environment.QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY,/^sb_publishable_/);
  assert.equal(environment.QELLY_ENABLE_AUTH,'true');
  assert.equal(environment.QELLY_ENABLE_CLOUD_SYNC,'true');
  assert.equal(environment.QELLY_ENABLE_LIVE_PROVIDERS,'true');
});

test('explicit deployment variables override committed Pages defaults',()=>{
  const environment=effectiveDeploymentEnvironment({CF_PAGES:'1',QELLY_ENABLE_AUTH:'false',QELLY_STATIC_VISUAL_PREVIEW:'true'});
  assert.equal(environment.QELLY_ENABLE_AUTH,'false');
  assert.equal(environment.QELLY_STATIC_VISUAL_PREVIEW,'true');
});

test('non-Pages builds do not silently activate the connected runtime',()=>{
  const input={NODE_ENV:'test'};
  assert.equal(effectiveDeploymentEnvironment(input),input);
});

