import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('application shell does not preload or await a nonexistent bundled font',async()=>{
  const index=await read('apps/web/public/index.html');
  assert.doesNotMatch(index,/assets\/fonts\/ibm-plex-sans-variable\.woff2/);
  assert.doesNotMatch(index,/document\.fonts\?\.load\([^)]*Qelly IBM Plex Sans/);
  assert.match(index,/document\.fonts\?\.ready\?\?Promise\.resolve\(\)/);
});

test('screen evidence authenticates through an explicit local fixture identity',async()=>{
  const harness=await read('scripts/release-a5-screen-batch-v2.py');
  assert.match(harness,/QELLY_DEVELOPMENT_IDENTITY_ENABLED:'true'/);
  assert.match(harness,/QELLY_PRODUCTION_IDENTITY_ENABLED:'false'/);
  assert.match(harness,/X-Qelly-Session-Id/);
  assert.match(harness,/authenticated evidence preflight failed \/api\/v1\/config/);
  assert.match(harness,/authenticated evidence preflight failed \/api\/v1\/auth\/status/);
});

test('every screenshot must prove route identity rather than only render a heading',async()=>{
  const harness=await read('scripts/release-a5-screen-batch-v2.py');
  assert.match(harness,/expected_title = f"\{definition\['label'\]\} · Qelly Intelligence"/);
  assert.match(harness,/expected_hash = f'#\/\{route_name\}'/);
  assert.match(harness,/if title != expected_title:/);
  assert.match(harness,/if resolved_hash != expected_hash:/);
  assert.match(harness,/Document overflowed viewport by/);
});

test('canonical batch entry point delegates to the verified harness',async()=>{
  const wrapper=await read('scripts/release-a5-screen-batch.py');
  assert.match(wrapper,/release-a5-screen-batch-v2\.py/);
  assert.match(wrapper,/run_name='__main__'/);
});
