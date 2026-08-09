import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const evidencePath=new URL('../scripts/release-v53-responsive-evidence.py',import.meta.url);

test('V5.3 reduced-motion mode reveals motion-bound content immediately',async()=>{
  const runtime=await readFile(runtimePath,'utf8');
  assert.match(runtime,/prefers-reduced-motion: reduce/);
  assert.match(runtime,/q-motion-item:not\(\.is-inview\)/);
  assert.match(runtime,/classList\.add\('is-inview'\)/);
  assert.match(runtime,/attributeFilter:\['class'\]/);
  assert.match(runtime,/v53ReducedMotionReveal='immediate'/);
});

test('V5.3 market geometry gate measures real KPI-to-chart-host spacing',async()=>{
  const source=await readFile(evidencePath,'utf8');
  assert.match(source,/kpiToHost/);
  assert.match(source,/MOBILE_MARKET_MAX_SECTION_GAP_PX=96/);
  assert.doesNotMatch(source,/metric':'kpiToShell'/);
});