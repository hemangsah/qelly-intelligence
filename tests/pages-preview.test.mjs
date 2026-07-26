import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { staticPreviewRequest } from '../apps/web/public/assets/static-preview-api.mjs';

test('Static visual preview config is local, explicit, and backend-free',async()=>{
  const config=await staticPreviewRequest('/api/v1/config');
  assert.equal(config.preview.label,'Static visual preview');
  assert.equal(config.preview.dataMode,'deterministic-demo');
  assert.equal(config.preview.backendAvailable,false);
  assert.equal(config.preview.liveData,false);
  assert.equal(config.auth.authenticated,false);
  assert.equal(config.auth.backendAvailable,false);
  assert.equal(config.defaultRoute,'market');
});

test('Static visual preview observations are deterministic and never live',async()=>{
  const first=await staticPreviewRequest('/api/v1/public/markets/overview');
  const second=await staticPreviewRequest('/api/v1/public/markets/overview');
  assert.deepEqual(first,second);
  assert.equal(first.mode,'simulated-demo');
  assert.match(first.truthBoundary,/not live/i);
  assert.ok(first.items.length>=6);
  assert.ok(first.items.every((item)=>item.source.freshness==='simulated'));
  assert.ok(first.items.every((item)=>item.source.degraded===true));
  assert.ok(first.items.every((item)=>/not connected/i.test(item.source.fallbackReason)));
});

test('Static visual preview asset and candle routes are deterministic',async()=>{
  const asset=await staticPreviewRequest('/api/v1/public/markets/assets/QI-CRYPTO-BTC');
  const candles=await staticPreviewRequest('/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=1h&limit=48');
  const repeated=await staticPreviewRequest('/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=1h&limit=48');
  assert.equal(asset.symbol,'BTC');
  assert.equal(asset.source.qualityState,'simulated-demo');
  assert.equal(candles.points.length,48);
  assert.equal(candles.source.mode,'simulated-demo');
  assert.deepEqual(candles,repeated);
});

test('Static visual preview rejects backend mutations without executing them',async()=>{
  await assert.rejects(
    staticPreviewRequest('/api/v1/auth/login',{method:'POST'}),
    (error)=>error.code==='static_visual_preview_backend_unavailable'&&error.status===503&&/not executed/i.test(error.message)
  );
});

test('Pages workflow deploys only the validated static frontend with least privilege',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/pages-preview.yml',import.meta.url),'utf8');
  assert.match(workflow,/push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.match(workflow,/npm run build:frontend/);
  assert.match(workflow,/npm run validate:pages-preview/);
  assert.match(workflow,/npm run smoke:pages-preview/);
  assert.match(workflow,/path: dist\/frontend/);
  assert.doesNotMatch(workflow,/path:\s*\.(?:\s|$)/);
  assert.match(workflow,/pages: write/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/cancel-in-progress: true/);
});
