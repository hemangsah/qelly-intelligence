import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Wave BZ exposes every primary Find Setup Now control in the Decision UI',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const token of ['FIND SETUP NOW','Validated Setup','Aggressive Discovery','All Markets','Current Asset','Long + Short','Long','Short','Highest Quality','Lowest Event Risk','Closest Candidate','1:1','1:2','1:3','1:4','Auto','Custom'])assert.ok(route.includes(token),token);
  for(const token of ['data-dpg-scan-mode="validated"','data-dpg-scan-mode="aggressive"','data-dpg-scan-ranking','data-dpg-scan-universe="all"','data-dpg-scan-universe="current"','data-dpg-scan-direction="long"','data-dpg-scan-direction="short"'])assert.ok(route.includes(token),token);
});

test('Wave BZ sends discovery mode and ranking to the scanner and opens the returned candidate timeframe',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/mode:state\.scanFilters\.mode,ranking:state\.scanFilters\.ranking/);
  assert.match(route,/state\.scan\?\.validatedSetup\|\|state\.scan\?\.candidates/);
  assert.match(route,/state\.interval=firstEligible\.interval/);
  assert.match(route,/data-dpg-scan-interval/);
  assert.match(route,/candidateInterval=String\(button\.dataset\.dpgScanInterval\|\|state\.interval\)/);
});

test('Wave BZ renders closest candidate as explicitly unvalidated and preserves hard-gate language',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  for(const token of ['CLOSEST CANDIDATE · NOT YET VALIDATED','Hard gates remain hard','NO TRADE remains valid','never fabricates a valid setup'])assert.ok(route.includes(token),token);
  assert.match(route,/data-dpg-closest-candidate/);
  assert.match(css,/q-dpg-setup-finder/);
  assert.match(css,/q-dpg-closest-candidate/);
  assert.match(css,/q-dpg-scan-plan/);
});

test('Wave BZ removes the old primary Find Trade Now wording from the Decision route',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.equal(route.includes('Find Trade Now'),false);
  assert.equal(route.includes('FIND TRADE NOW'),false);
});


test('Wave BZ Browser E2E exercises aggressive discovery query wiring and unvalidated closest-candidate UX',async()=>{
  const e2e=await read('scripts/qelly-decision-range-selection-e2e.mjs');
  for(const token of ['data-dpg-scan-mode="aggressive"','data-dpg-scan-universe="current"','data-dpg-scan-direction="short"','lowest_event_risk','setup-finder-aggressive','CLOSEST CANDIDATE — NOT YET VALIDATED'])assert.ok(e2e.includes(token),token);
  assert.match(e2e,/lastScanRequest\?\.mode==='aggressive'/);
  assert.match(e2e,/lastScanRequest\?\.assets==='BTC'/);
  assert.match(e2e,/closestInterval!=='30m'/);
});
