import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const runtimePath=new URL('../apps/web/public/assets/qelly-ui-lock-v5-3.mjs',import.meta.url);
const evidencePath=new URL('../scripts/release-v53-accessibility-focus.py',import.meta.url);

test('V5.3 bridges the governed Theme Intelligence color-blind preference without changing market truth semantics',async()=>{
  const runtime=await readFile(runtimePath,'utf8');
  assert.match(runtime,/themeIntelligence\.subscribe\(applyPalette\)/);
  assert.match(runtime,/marketPalette/);
  assert.match(runtime,/#168AAD/);
  assert.match(runtime,/#D1495B/);
  assert.match(runtime,/#F3A712/);
  assert.match(runtime,/dataset\.marketPalette=palette/);
  assert.doesNotMatch(runtime,/place order|execute trade|connect wallet/i);
});

test('focused accessibility evidence uses the real Theme Intelligence preview path and a 200 percent effective zoom model',async()=>{
  const source=await readFile(evidencePath,'utf8');
  assert.match(source,/themeIntelligence\.preview\(\{marketPalette:'color-blind'\}\)/);
  assert.match(source,/viewport=\{'width':720,'height':450\}/);
  assert.match(source,/device_scale_factor=2/);
  assert.match(source,/physicalTarget':\{'width':1440,'height':900\}/);
  assert.match(source,/hasSignedPositive/);
  assert.match(source,/hasSignedNegative/);
});