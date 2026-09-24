import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionMacroContext,buildUnavailableDecisionEventRisk} from '../functions/_lib/decision-macro-events.js';
import {buildDecisionCrossAsset} from '../functions/_lib/decision-cross-asset.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Wave W derives only same-day ECB reference FX and keeps it out of intraday eligibility',()=>{
  const macro=buildDecisionMacroContext({
    provider:'ecb-reference-rates',
    truthState:'delayed_provider',
    observationTime:'2026-09-24T16:00:00.000Z',
    ingestionTime:'2026-09-24T17:15:00.000Z',
    freshness:'daily-working-day-reference',
    quality:'official-central-bank-reference',
    attribution:'European Central Bank euro foreign exchange reference rates',
    license:'ECB reuse conditions apply',
    cache:{hit:true,stale:false},
    data:{base:'EUR',date:'2026-09-24',rates:{USD:1.17,INR:105.3,GBP:.87}}
  });
  assert.equal(macro.state,'available');
  assert.equal(macro.level,'DAILY_REFERENCE');
  assert.equal(macro.fxReference.eurUsd,1.17);
  assert.equal(macro.fxReference.eurInr,105.3);
  assert.equal(macro.fxReference.usdInr,90);
  assert.equal(macro.intradayFeedConnected,false);
  assert.equal(macro.eligibilityImpact,'none');
  assert.ok(macro.unavailableSeries.includes('DXY'));
  assert.ok(macro.unavailableSeries.includes('US_10Y'));
  assert.match(macro.cadenceBoundary,/not .*intraday/i);
  assert.match(macro.methodology,/same-day ECB/i);
});

test('Wave W preserves macro unavailability when the governed reference is incomplete',()=>{
  const macro=buildDecisionMacroContext({truthState:'unavailable',fallbackReason:'provider_timeout',data:null});
  assert.equal(macro.state,'unavailable');
  assert.equal(macro.fxReference.eurUsd,null);
  assert.equal(macro.fxReference.usdInr,null);
  assert.equal(macro.eligibilityImpact,'none');
  assert.match(macro.reason,/provider_timeout|unavailable/i);
});

test('Wave W cross-asset engine adds rolling dependence, spread and exploratory lag without causal or cointegration claims',()=>{
  const start=Date.parse('2026-09-20T00:00:00.000Z');
  const benchmark=[],asset=[];
  for(let i=0;i<180;i++){
    const common=.001*i+Math.sin(i/7)*.015+Math.cos(i/13)*.006;
    const benchClose=100*Math.exp(common);
    const assetClose=200*Math.exp(common*1.18+Math.sin(i/11)*.004);
    const time=start+i*900000;
    benchmark.push({t:time,c:benchClose});
    asset.push({t:time,c:assetClose});
  }
  const result=buildDecisionCrossAsset(asset,benchmark,{asset:'BTC',benchmark:'ETH'});
  assert.equal(result.state,'available');
  assert.equal(result.provider,'Hyperliquid candles');
  assert.ok(Number.isFinite(result.correlation));
  assert.ok(Number.isFinite(result.beta));
  assert.ok(Number.isFinite(result.rollingCorrelation30));
  assert.ok(Number.isFinite(result.rollingCorrelation90));
  assert.ok(Number.isFinite(result.rollingBeta30));
  assert.ok(Number.isFinite(result.rollingBeta90));
  assert.ok(Number.isFinite(result.spread.zScore));
  assert.equal(result.spread.sampleSize,120);
  assert.equal(result.leadLag.state,'EXPLORATORY');
  assert.ok(Number.isFinite(result.leadLag.correlation));
  assert.ok(Math.abs(result.leadLag.bestLagBars)<=3);
  assert.equal(result.cointegration.state,'NOT_TESTED');
  assert.equal(result.eligibilityImpact,'none');
  assert.match(result.method,/same-venue/i);
  assert.match(result.limitations.join(' '),/not causal/i);
});

test('Wave W scheduled-event risk stays fail-closed when no machine-readable calendar feed exists',()=>{
  const risk=buildUnavailableDecisionEventRisk();
  assert.equal(risk.state,'unavailable');
  assert.equal(risk.level,'UNAVAILABLE');
  assert.equal(risk.scheduledFeedConnected,false);
  assert.equal(risk.eventCount,0);
  assert.deepEqual(risk.events,[]);
  assert.equal(risk.nextEventAt,null);
  assert.equal(risk.timeUntilNextEventMs,null);
  assert.deepEqual(risk.supportedRiskLevels,['LOW','MEDIUM','HIGH','EXTREME']);
  assert.equal(risk.eligibilityImpact,'none');
  assert.match(risk.calendarBoundary,/TradingView Economic Calendar.*display embed/i);
  assert.match(risk.newsBoundary,/not converted/i);
  assert.match(risk.gatingBoundary,/verified scheduled feed/i);
});

test('Wave W reuses one existing crypto benchmark request and one governed ECB provider call only',async()=>{
  const [api,providers]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('functions/_lib/providers.js')
  ]);
  assert.equal((api.match(/fetchOptionalCandles\(fetchImpl,benchmarkAsset,resolvedInterval,endTime,240\)/g)||[]).length,1);
  assert.equal((api.match(/providerResult\(\{env\},'ecb','fx-reference-rates','EUR'\)/g)||[]).length,1);
  assert.doesNotMatch(api,/fred|world.?bank|treasury|yahoo|stooq/i);
  assert.match(providers,/ecb:Object\.freeze\(\{[\s\S]*?enabled:true/);
  assert.match(providers,/capabilities:Object\.freeze\(\['fx-reference-rates'\]\)/);
  assert.match(providers,/conditionally_approved_attributed_reference_data/);
});

test('Wave W never reads the TradingView Economic Calendar embed as Decision evidence',async()=>{
  const [api,eventRoute]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('apps/web/public/assets/routes/event-calendar.mjs')
  ]);
  assert.match(api,/buildUnavailableDecisionEventRisk\(\)/);
  assert.doesNotMatch(api,/tradingview\.com\/economic-calendar|economicCalendar/);
  assert.match(eventRoute,/No connected calendar feed/);
  assert.match(eventRoute,/mountLazyTradingViewWidget/);
  assert.match(eventRoute,/Qelly does not fetch the source, verify its contents, create an alert or invent a date/);
});

test('Wave W UI extends existing panels and keeps macro/event/correlation boundaries explicit and responsive',async()=>{
  const [route,css]=await Promise.all([
    read('apps/web/public/assets/routes/decision-proven-graph.mjs'),
    read('apps/web/public/assets/qelly-decision-proven-graph.css')
  ]);
  assert.equal((route.match(/const crossAssetContext=/g)||[]).length,1);
  assert.equal((route.match(/const macroContext=/g)||[]).length,1);
  assert.equal((route.match(/const eventRiskContext=/g)||[]).length,1);
  for(const phrase of [
    'CROSS-ASSET · DESCRIPTIVE ONLY',
    'Rolling corr · 30',
    'Spread z-score',
    'Lead / lag exploration',
    'Correlation is not causation',
    'MACRO CONTEXT · GOVERNED REFERENCE',
    'ECB daily FX reference',
    'USD / INR',
    'NO INTRADAY ELIGIBILITY IMPACT',
    'EVENT RISK',
    'Verified scheduled events',
    'Scheduled feed',
    'TradingView Economic Calendar'
  ])assert.ok(route.includes(phrase),phrase);
  assert.match(css,/\.q-dpg-macro__grid/);
  assert.match(css,/\.q-dpg-event-risk__meta/);
  assert.match(css,/@media\(max-width:720px\).*q-dpg-event-risk__meta/s);
  assert.match(css,/@media\(max-width:480px\).*q-dpg-macro__grid/s);
});

test('Wave W Decision Trace and setup risk carry the same macro/cross-asset/event truth boundaries',async()=>{
  const [context,trade]=await Promise.all([
    read('functions/_lib/decision-context.js'),
    read('functions/_lib/decision-trade-research.js')
  ]);
  for(const phrase of ['macro-reference','Scheduled event risk','gates only when a verified schedule exists','adds delayed reference context'])assert.ok(context.includes(phrase),phrase);
  for(const field of ['rollingCorrelation30','rollingCorrelation90','spreadZScore','leadLagRelation','cointegrationState','usdInr','intradayFeedConnected'])assert.ok(trade.includes(field),field);
  assert.match(trade,/eligibilityImpact:macro\?\.eligibilityImpact\|\|'none'/);
});
