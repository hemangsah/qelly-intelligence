import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionRangeFlowParticipation,buildDirectionalBarVolumeProxy} from '../functions/_lib/decision-range-flow.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const base=1_800_000_000_000;
const candles=[
  {time:base,open:100,close:102,high:103,low:99,volume:120},
  {time:base+300_000,open:102,close:101,high:104,low:100,volume:80},
  {time:base+600_000,open:101,close:104,high:105,low:101,volume:200},
  {time:base+900_000,open:104,close:104,high:105,low:103,volume:50}
];
const graph={
  asset:'BTC',interval:'5m',market:{candles},provenance:{provider:'Hyperliquid',documentation:'https://hyperliquid.gitbook.io/'},
  selection:{start:new Date(base).toISOString(),end:new Date(base+900_000).toISOString(),changePct:4,averageVolume:112.5,volumeRatio:1.35}
};
const evidence={historicalDerivatives:{
  state:'available',historicalOpenInterestState:'UNAVAILABLE',liquidationsState:'UNAVAILABLE',
  fundingHistory:{state:'available',sampleSize:3,windowHours:8,medianFundingPct:.001,minFundingPct:-.001,maxFundingPct:.002,latestHistoricalAt:new Date(base+600_000).toISOString(),method:'Settled funding fixture.'}
}};

test('Wave BU directional bar-volume proxy is deterministic and explicitly not true order flow',()=>{
  const proxy=buildDirectionalBarVolumeProxy(candles,graph.selection);
  assert.equal(proxy.sampleSize,4);
  assert.equal(proxy.upBarVolume,320);
  assert.equal(proxy.downBarVolume,80);
  assert.equal(proxy.flatBarVolume,50);
  assert.equal(proxy.state,'UPSIDE_BAR_VOLUME_PROXY');
  assert.match(proxy.boundary,/not taker buy\/sell volume, volume delta, CVD/i);
});

test('Wave BU flow participation keeps actor identity fail-closed while preserving observed evidence',()=>{
  const flow=buildDecisionRangeFlowParticipation({graph,evidence});
  assert.equal(flow.state,'PARTIAL');
  assert.equal(flow.actorIdentity,'UNAVAILABLE');
  assert.equal(flow.sections.knownNamedFlows.state,'UNAVAILABLE');
  assert.equal(flow.sections.observedOrderFlow.trueOrderFlowState,'UNAVAILABLE');
  assert.equal(flow.sections.publicInstitutionalData.etfFlowState,'UNAVAILABLE');
  assert.equal(flow.sections.unknownActorActivity.actorIdentity,'UNAVAILABLE');
  assert.equal(flow.sections.unknownActorActivity.settledFunding.sampleSize,3);
  assert.match(flow.sections.unknownActorActivity.disclosure,/Do not infer whales, institutions, funds, insiders/i);
  assert.match(flow.boundary,/Named buyer\/seller attribution requires a direct authorized source/i);
});

test('Wave BU exact range endpoint attaches flow participation without adding a new provider fan-out',async()=>{
  const endpoint=await read('functions/api/v1/decision-range-evidence.js');
  assert.match(endpoint,/buildDecisionRangeFlowParticipation/);
  assert.match(endpoint,/flowParticipation/);
  assert.equal((endpoint.match(/fetchHistoricalNewsWindow\(/g)||[]).length>=4,true);
  assert.doesNotMatch(endpoint,/fetch\([^\n]*flow/i);
});

test('Wave BU UI exposes the four governed flow sections and toolbar targets the new panel',async()=>{
  const [route,css,e2e]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css'),
    read('scripts/qelly-decision-range-selection-e2e.mjs')
  ]);
  for(const phrase of ['FLOW / PARTICIPATION EVIDENCE · EXACT RANGE','Known named flows','Observed order flow','Public institutional data','Unknown actor activity','Actor identity unavailable'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/flow:'\.q-dpg-range-flow'/);
  assert.match(route,/True order flow/);
  assert.match(css,/\.q-dpg-range-flow__grid/);
  assert.match(e2e,/data-dpg-range-flow/);
  assert.match(e2e,/true order flow unavailable/);
});
