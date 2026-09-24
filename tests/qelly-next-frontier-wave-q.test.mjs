import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Wave Q: Decision Intelligence retains one authoritative public route owner',async()=>{
  const [app,route]=await Promise.all([
    read('apps/web/public/assets/app.js'),
    read('apps/web/public/assets/routes/decision-proven-graph.mjs')
  ]);
  assert.match(app,/decision-provenance/);
  assert.match(route,/QELLY Decision Intelligence/);
  assert.match(route,/\/api\/v1\/decision-proven-graph/);
  assert.match(route,/\/api\/v1\/decision-scan/);
});

test('Wave Q: scanner delegates candidate truth to the authoritative Decision builder',async()=>{
  const scan=await read('functions/api/v1/decision-scan.js');
  assert.match(scan,/buildDecisionIntelligence/);
  assert.match(scan,/includeNews:false/);
  assert.match(scan,/DECISION_SCAN_ASSETS/);
  assert.match(scan,/const universe=resolveAssets\(assets\)/);
  assert.match(scan,/mapPool\(universe,2/);
  assert.match(scan,/rankingIsSuccessProbability:false/);
});

test('Wave Q: Decision orchestration keeps core evidence gates and explicit unavailable boundaries',async()=>{
  const api=await read('functions/api/v1/decision-proven-graph.js');
  for(const token of [
    'fetchTimeframeSupport',
    'fetchDerivativesContext',
    'fetchLiquidityContext',
    'fetchFundingHistory',
    'buildDecisionWalkForwardCalibration',
    'buildDecisionHistoricalAnalogs',
    'calibrateDecisionEvidence',
    'buildTradeResearch',
    'buildDecisionContextBundle'
  ])assert.ok(api.includes(token),`missing Decision owner token: ${token}`);
  assert.match(api,/liquidations:\{state:'unavailable'/);
  assert.match(api,/options:\{state:'unavailable'/);
  assert.match(api,/onChain:\{state:'unavailable'/);
});

test('Wave Q: Decision trade research remains fail-closed for uncalibrated target-touch/EV output',async()=>{
  const trade=await read('functions/_lib/decision-trade-research.js');
  assert.match(trade,/targetTouchProbability:null/);
  assert.match(trade,/expectedValue:null/);
  assert.match(trade,/No evidence-qualified setup exists/);
});
