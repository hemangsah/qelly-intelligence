import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('public runtime includes static headers and bounded free-tier rate limiting',async()=>{
  const [headers,runtime]=await Promise.all([read('apps/web/public/_headers'),read('functions/_lib/runtime.js')]);
  assert.match(headers,/Content-Security-Policy/);
  assert.match(headers,/Strict-Transport-Security/);
  assert.match(headers,/Cache-Control: no-store/);
  assert.match(runtime,/QELLY_RATE_LIMITER/);
  assert.match(runtime,/localRateBuckets/);
  assert.match(runtime,/rate_limited/);
});

test('protected feedback is authenticated, CSRF-checked and RLS-backed',async()=>{
  const data=await read('functions/_lib/data.js');
  assert.match(data,/path==='feedback'/);
  assert.match(data,/requireCsrf/);
  assert.match(data,/qelly_feedback/);
  assert.match(data,/owner_id:session\.user\.id/);
  assert.doesNotMatch(data,/console\.log\([^)]*(message|payload)/);
});

test('public provider routes are rate limited and retain truthful state labels',async()=>{
  const [router,providers]=await Promise.all([read('functions/api/v1/[[path]].js'),read('functions/_lib/providers.js')]);
  assert.match(router,/public-provider/);
  assert.match(router,/providers\/status/);
  for(const marker of ['live_provider','cached_provider','stale_provider','unavailable','observationTime','ingestionTime','confidence','attribution'])assert.match(providers,new RegExp(marker));
});
