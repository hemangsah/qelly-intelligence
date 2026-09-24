import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialObservationFromRecord,observePersistedSetup,setupRecordFromDecision} from '../functions/_lib/decision-outcome-ledger.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const t0='2026-09-24T00:00:00.000Z';
const ms=(iso)=>Date.parse(iso);

const decision=({
  observedAt=t0,
  lifecycle='TRIGGERED',
  status='VALID',
  truthState='LIVE',
  action='BUY',
  candles=[]
}={})=>({
  graphId:'dpg-btc-15m-wave-s',
  asset:'BTC',
  interval:'15m',
  horizon:'4h',
  observedAt,
  truthState,
  market:{lastPrice:100,candles,currentState:{regime:'TRENDING'}},
  qellyView:{action,confidence:.72,evidenceGate:{qualityScore:.81},contradictions:[]},
  tradeResearch:{
    setupId:'dpg-btc-15m-wave-s-trade',
    status,
    action,
    createdAt:t0,
    expiryAt:'2026-09-24T02:00:00.000Z',
    lifecycle:{state:lifecycle},
    requestedRr:'1:2',
    selected:{ratio:2},
    entry:{zone:[99,101],preferred:100,method:lifecycle==='TRIGGERED'?'NOW':'PULLBACK',trigger:'Observed live entry condition'},
    stop:{price:95,distance:5},
    invalidation:{price:{price:95}},
    targets:[
      {label:'1:1',price:105,ratio:1,feasibility:'FEASIBLE',source:'RR_PRESET'},
      {label:'1:2',price:110,ratio:2,feasibility:'FEASIBLE',source:'RR_PRESET'}
    ]
  },
  quant:{regime:'TRENDING',calibration:{state:'UNCALIBRATED',sampleSize:0,brierScore:null,reliabilityBins:[]}},
  evidence:{eventRisk:{level:'UNAVAILABLE'}},
  provenance:{provider:'Hyperliquid'}
});

test('Wave S persists only live valid setups and never fabricates pre-ledger history',()=>{
  const prepared=setupRecordFromDecision(decision(),{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'});
  assert.equal(prepared.trackable,true);
  assert.equal(prepared.record.latest_status,'TRIGGERED');
  assert.equal(prepared.record.metrics.triggerAt,t0);
  assert.equal(prepared.record.metrics.timeToTriggerMs,0);
  assert.equal(prepared.record.metrics.historyCoverage,'OBSERVED_FROM_TRACKING_START');
  assert.equal(prepared.record.metrics.noBackfill,true);
  assert.equal(prepared.record.provenance.noBackfillBeforeTracking,true);
  assert.equal(prepared.record.resolved_outcome.calibrationEligible,false);
  const initial=initialObservationFromRecord(prepared.record,decision());
  assert.equal(initial.provenance.backfilled,false);
  assert.deepEqual(initial.target_events,[]);
});

test('WAIT / NO TRADE, stale and weakened states cannot be inserted as historical setups',()=>{
  for(const variant of [
    {status:'NO_TRADE',lifecycle:'NO_TRADE',action:'NO TRADE'},
    {status:'VALID',lifecycle:'WEAKENING',action:'BUY'},
    {status:'VALID',lifecycle:'TRIGGERED',action:'BUY',truthState:'STALE'}
  ]){
    const prepared=setupRecordFromDecision(decision(variant),{workspaceId:'w',ownerId:'u'});
    assert.equal(prepared.trackable,false);
    assert.match(prepared.reason,/not persisted|Only a live/i);
  }
});

test('post-trigger provider candles derive MFE MAE target times and a terminal target-ladder outcome',()=>{
  const prepared=setupRecordFromDecision(decision(),{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'}).record;
  const row={id:'33333333-3333-4333-8333-333333333333',...prepared};
  const current=decision({
    observedAt:'2026-09-24T00:30:00.000Z',
    candles:[
      {time:ms('2026-09-24T00:15:00.000Z'),open:100,high:106,low:99,close:105},
      {time:ms('2026-09-24T00:30:00.000Z'),open:105,high:111,low:100,close:110}
    ]
  });
  const result=observePersistedSetup(row,current);
  assert.equal(result.changed,true);
  assert.equal(result.patch.latest_status,'T2_REACHED');
  assert.equal(result.patch.resolved_outcome.state,'TARGET_LADDER_COMPLETE');
  assert.equal(result.patch.resolved_outcome.calibrationEligible,true);
  assert.equal(result.patch.metrics.highestTarget,'T2_REACHED');
  assert.equal(result.patch.metrics.targetReachedAt.T1,'2026-09-24T00:15:00.000Z');
  assert.equal(result.patch.metrics.targetReachedAt.T2,'2026-09-24T00:30:00.000Z');
  assert.equal(result.patch.metrics.mfeR,2.2);
  assert.equal(result.patch.metrics.maeR,.2);
  assert.equal(result.observation.provenance.backfilled,false);
});

test('same-candle target and invalidation touch is terminal but excluded from calibration because ordering is unknowable',()=>{
  const prepared=setupRecordFromDecision(decision(),{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'}).record;
  const row={id:'33333333-3333-4333-8333-333333333333',...prepared};
  const current=decision({
    observedAt:'2026-09-24T00:15:00.000Z',
    candles:[{time:ms('2026-09-24T00:15:00.000Z'),open:100,high:106,low:94,close:100}]
  });
  const result=observePersistedSetup(row,current);
  assert.equal(result.patch.latest_status,'INVALIDATED');
  assert.equal(result.patch.resolved_outcome.state,'AMBIGUOUS_INTRABAR');
  assert.equal(result.patch.resolved_outcome.ambiguous,true);
  assert.equal(result.patch.resolved_outcome.calibrationEligible,false);
  assert.equal(result.observation.invalidation_event.ordering,'AMBIGUOUS_WITH_TARGET_TOUCH');
});

test('an untriggered persisted setup expires without backfilling a trigger',()=>{
  const prepared=setupRecordFromDecision(decision({lifecycle:'FORMING'}),{workspaceId:'11111111-1111-4111-8111-111111111111',ownerId:'22222222-2222-4222-8222-222222222222'}).record;
  const row={id:'33333333-3333-4333-8333-333333333333',...prepared};
  const current=decision({observedAt:'2026-09-24T02:15:00.000Z',status:'NO_TRADE',lifecycle:'NO_TRADE',action:'NO TRADE'});
  const result=observePersistedSetup(row,current);
  assert.equal(result.patch.latest_status,'EXPIRED');
  assert.equal(result.patch.metrics.triggerAt,null);
  assert.equal(result.patch.resolved_outcome.state,'EXPIRED_UNTRIGGERED');
  assert.equal(result.patch.resolved_outcome.calibrationEligible,false);
});

test('Wave S API and Supabase schema keep writes authenticated, CSRF protected and workspace scoped',async()=>{
  const [api,migration]=await Promise.all([
    read('functions/api/v1/decision-ledger/[[route]].js'),
    read('supabase/migrations/20260924081500_qelly_decision_setup_outcome_ledger_v1.sql')
  ]);
  assert.match(api,/resolveSession\(request,env,\{required:true\}\)/);
  assert.match(api,/requireOrigin\(request,env\)/);
  assert.match(api,/requireCsrf\(request\)/);
  assert.match(api,/buildDecisionIntelligence\(env/);
  assert.match(api,/observePersistedSetup\(setup,decision\)/);
  assert.doesNotMatch(api,/body\.(?:outcome|marketPrice|mfe|mae|status)/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/workspace_role/);
  assert.match(migration,/revoke all on public\.qelly_decision_setups,public\.qelly_decision_setup_observations from anon/);
  assert.match(migration,/grant select,insert on public\.qelly_decision_setup_observations to authenticated/);
  assert.doesNotMatch(migration,/grant .* to anon/i);
  assert.doesNotMatch(migration,/service_role/i);
});

test('Decision UI makes ledger persistence explicit and preserves anonymous public research',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  for(const phrase of ['OBSERVED SETUP LEDGER','Track this live setup','Observe outcome now','NO BACKFILL','Calibration-eligible resolutions','Nothing before the first explicit tracking event is backfilled'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/ledgerAuthenticated/);
  assert.match(route,/\/api\/v1\/decision-ledger/);
  assert.match(route,/method:'POST'/);
  assert.match(route,/data-dpg-ledger-track/);
  assert.match(route,/data-dpg-ledger-observe/);
  assert.match(css,/\.q-dpg-ledger\{/);
  assert.match(css,/@media\(max-width:760px\).*q-dpg-ledger/s);
});
