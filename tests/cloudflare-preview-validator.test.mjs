import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('Cloudflare preview validation follows current no-fabrication and readiness contracts',async()=>{
  const source=await read('scripts/validate-cloudflare-preview.mjs');
  assert.match(source,/health\.authenticationConfigured/);
  assert.match(source,/health\.cloudSyncConfigured/);
  assert.match(source,/health\.liveProvidersConfigured/);
  assert.match(source,/market\?\.deterministicLocal!==false/);
  assert.match(source,/market\?\.fabricatedFallback!==false/);
  assert.match(source,/supabase_auth_health_proven/);
  assert.match(source,/forbidden_origin_contract_invalid/);
  assert.doesNotMatch(source,/origin:true/);
});

test('Cloudflare preview workflow requires an explicit immutable preview and exact SHA',async()=>{
  const workflow=await read('.github/workflows/cloudflare-preview.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/preview_url:/);
  assert.match(workflow,/expected_sha:/);
  assert.match(workflow,/QELLY_PREVIEW_URL: \$\{\{ inputs\.preview_url \}\}/);
  assert.match(workflow,/QELLY_EXPECTED_HEAD_SHA: \$\{\{ inputs\.expected_sha \}\}/);
  assert.doesNotMatch(workflow,/feature-prompt2c-production-oty3/);
});

test('release deployability gate recognizes the verified Cloudflare public beta without overstating production',async()=>{
  const [releaseCheck,readme]=await Promise.all([read('scripts/release-check.mjs'),read('README.md')]);
  assert.match(releaseCheck,/readme\.includes\('\*\*Public beta deployed\.\*\*'\)/);
  assert.match(releaseCheck,/readme\.matchAll/);
  assert.match(releaseCheck,/new URL\('https:\/\/qelly-intelligence\.pages\.dev'\)/);
  assert.match(releaseCheck,/parsed\.hostname === canonicalPublicSiteUrl\.hostname/);
  assert.doesNotMatch(releaseCheck,/readme\.includes\('https:\/\/qelly-intelligence\.pages\.dev'\)/);
  assert.match(readme,/\*\*Public beta deployed\.\*\*/);
  assert.match(readme,/Cloudflare Pages Functions/);
});

test('navigation verifier parses request hosts before accepting TradingView widget teardown',async()=>{
  const source=await read('scripts/verify-navigation-runtime.mjs');
  assert.match(source,/new URL\(request\.url\(\)\)/);
  assert.match(source,/requestUrl\.hostname==='tradingview-widget\.com'/);
  assert.match(source,/requestUrl\.hostname\.endsWith\('\.tradingview-widget\.com'\)/);
  assert.doesNotMatch(source,/request\.url\(\)\.includes\('tradingview-widget\.com'\)/);
});
