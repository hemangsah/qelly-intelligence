import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);

test('Decision Provenance range controls receive explicit accessible names in the V5.3 layer',async()=>{
  const runtime=await readFile(runtimePath,'utf8');
  assert.match(runtime,/input\[name="evidenceConfidence"\]/);
  assert.match(runtime,/User-assessed evidence confidence/);
  assert.match(runtime,/input\[name="scenarioMove"\]/);
  assert.match(runtime,/Scenario move/);
  assert.match(runtime,/annotateDecisionProvenanceControls\(scope\)/);
});