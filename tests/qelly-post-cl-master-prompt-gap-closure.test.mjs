import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decisionAssetCapabilities,DECISION_PICKER_INTERVALS} from '../functions/_lib/decision-asset-capabilities.js';
import {__decisionScanTest} from '../functions/api/v1/decision-scan.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Post-CL gap closure exposes backend-supported 3m and 2h timeframes',async()=>{
  assert.deepEqual(DECISION_PICKER_INTERVALS,['1m','3m','5m','15m','30m','1h','2h','4h','1d']);
  assert.deepEqual(__decisionScanTest.aggressiveIntervals('1m','4h'),['1m','3m']);
  assert.deepEqual(__decisionScanTest.aggressiveIntervals('1h','4h'),['1h','2h']);
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/\['SCALP',\['1m','3m','5m'\]\]/);
  assert.match(route,/\['SWING',\['2h','4h','1d'\]\]/);
  assert.match(route,/'3m':180_000/);
  assert.match(route,/'2h':7_200_000/);
});

test('Post-CL gap closure carries complete normalized instrument identity for selectable assets',()=>{
  const catalog=decisionAssetCapabilities();
  const selectable=catalog.groups.flatMap(group=>group.assets||[]).filter(asset=>asset.selectable);
  assert.equal(selectable.length,6);
  for(const asset of selectable){
    assert.match(asset.canonicalId,/^QI-CRYPTO-/);
    assert.equal(asset.providerSymbol,asset.symbol);
    assert.equal(asset.exchange,'Hyperliquid');
    assert.equal(asset.venue,'Hyperliquid');
    assert.equal(asset.currency,'USD');
  }
});

test('Post-CL gap closure exposes the exact selected-range to current-setup bridge without turning similarity into validation',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/Find current setup under similar conditions/);
  assert.match(route,/data-dpg-range-action="similar-setup"/);
  assert.match(route,/action==='similar-setup'/);
  assert.match(route,/mode:'validated',universe:'current',ranking:'highest_quality',direction:'any'/);
  assert.match(route,/Historical similarity remains descriptive/);
  assert.doesNotMatch(route,/similar-setup'[\s\S]{0,500}mode:'aggressive'/);
});

test('Post-CL gap closure adds accessible user-education help for all required Decision terms',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  for(const term of ['R:R','Invalidation','Funding','OI','Calibration','NO TRADE','Selected-range evidence'])assert.ok(route.includes(term),term);
  assert.match(route,/Decision terms & help/);
  assert.match(route,/role="tooltip"/);
  assert.match(route,/aria-describedby="q-dpg-help-/);
  assert.match(css,/\.q-dpg-help i\[role="tooltip"\]/);
  assert.match(css,/\.q-dpg-help:hover i\[role="tooltip"\],\.q-dpg-help:focus i\[role="tooltip"\]/);
});

test('Post-CL gap closure extends asset search to provider symbol exchange and currency',async()=>{
  const picker=await read('apps/web/public/assets/decision-asset-picker.mjs');
  for(const field of ['asset?.providerSymbol','asset?.exchange','asset?.currency'])assert.ok(picker.includes(field),field);
});
