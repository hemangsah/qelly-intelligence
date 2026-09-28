import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Wave CE selected range toolbar exposes replay and routes similarity to selected-range history',async()=>{
  const route=await readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8');
  assert.match(route,/data-dpg-range-action="replay"[^>]*>Replay Move/);
  assert.match(route,/replay:'\.q-dpg-range-replay'/);
  assert.match(route,/similar:'\.q-dpg-similar-moves'/);
  assert.doesNotMatch(route,/similar:'\.q-dpg-analogs'/);
});

test('Wave CE UI exposes no-hindsight scrubber and descriptive selected-range analogs',async()=>{
  const [route,css]=await Promise.all([
    readFile(new URL('../apps/web/public/assets/routes/decision-proven-graph.mjs',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/public/assets/qelly-decision-proven-graph.css',import.meta.url),'utf8')
  ]);
  for(const token of ['RANGE REPLAY · NO HINDSIGHT','AVAILABLE AS OF','Future evidence','data-dpg-replay-slider','FIND SIMILAR MOVES · SELECTED RANGE','DESCRIPTIVE ONLY · NOT CALIBRATION','Leakage and probability boundary'])assert.ok(route.includes(token),token);
  assert.match(route,/rangeEvidenceMarkup\(data\)\+rangeReplayMarkup\(data\)\+selectedRangeSimilarMovesMarkup\(data\)/);
  assert.match(css,/q-dpg-range-replay__controls/);
  assert.match(css,/q-dpg-similar-moves__list/);
  assert.match(css,/@media\(max-width:620px\)/);
});


test('Wave CE Browser E2E injects local range-history builders and proves replay/similarity interactions',async()=>{
  const e2e=await readFile(new URL('../scripts/qelly-decision-range-selection-e2e.mjs',import.meta.url),'utf8');
  for(const token of ['buildDecisionRangeReplay','buildSelectedRangeSimilarMoves','range-replay','range-similar-moves','data-dpg-replay-slider','replayScrubs','similarRequired'])assert.ok(e2e.includes(token),token);
});


test('Wave CE Browser E2E accepts ISO or numeric selection bounds and fails loudly when replay fixture construction is unavailable',async()=>{
  const e2e=await readFile(new URL('../scripts/qelly-decision-range-selection-e2e.mjs',import.meta.url),'utf8');
  assert.match(e2e,/const fixtureEpochMs=\(value\)=>/);
  assert.match(e2e,/Date\.parse\(String\(value\)\)/);
  assert.doesNotMatch(e2e,/const selectedStart=Number\(payload\.selection\?\.start\),selectedEnd=Number\(payload\.selection\?\.end\)/);
  assert.match(e2e,/CE browser fixture received invalid selected-range bounds/);
  assert.match(e2e,/payload\.rangeReplay\?\.state!=='AVAILABLE'/);
});
