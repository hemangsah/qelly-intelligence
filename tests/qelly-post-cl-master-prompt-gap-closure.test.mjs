import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decisionAssetCapabilities,DECISION_PICKER_INTERVALS} from '../functions/_lib/decision-asset-capabilities.js';
import {__decisionScanTest} from '../functions/api/v1/decision-scan.js';
import {buildDecisionNewsClusters} from '../functions/_lib/decision-news.js';
import {buildDecisionRangeEvidence} from '../functions/_lib/decision-range-evidence.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Post-CL gap closure preserves 3m and 2h through the shared Decision context bridge',async()=>{
  const bridge=await read('apps/web/public/assets/decision-context-bridge.mjs');
  assert.match(bridge,/DECISION_TIMEFRAMES=new Set\(\['1m','3m','5m','15m','30m','1h','2h','4h','1d'\]\)/);
});

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

test('Post-CL gap closure renders a truthful top-three setup comparison',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/Compare top 3 setup candidates/);
  for(const label of ['Direction','R:R','Calibrated probability','Data quality','Event risk','Timeframe','Status'])assert.ok(route.includes(label),label);
  assert.match(route,/Unavailable probability remains UNCALIBRATED/);
  assert.match(route,/Evidence-triage confidence is not substituted as a win rate/);
});

test('Post-CL gap closure renders required asset-row and quality-dimension metadata',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const field of ['asset.marketStatus','asset.providerStatus','asset.supportedTimeframes'])assert.ok(route.includes(field),field);
  for(const label of ['Data Quality','Evidence Quality','Calibration Quality','MTF Agreement','Contradiction'])assert.ok(route.includes(label),label);
  assert.match(route,/q-dpg-quality-matrix/);
});

test('Post-CL gap closure extends asset search to provider symbol exchange and currency',async()=>{
  const picker=await read('apps/web/public/assets/decision-asset-picker.mjs');
  for(const field of ['asset?.providerSymbol','asset?.exchange','asset?.currency'])assert.ok(picker.includes(field),field);
});


test('Post-CL gap closure explains why 90 percent is withheld from current evidence',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/Why not 90%\?/);
  assert.match(route,/n='\+resolvedSamples\+' \/ 200 required/);
  assert.match(route,/Evidence confidence alone cannot create 90%/);
  assert.match(route,/90%\+ is never created because indicators agree/);
});

test('Post-CL gap closure classifies bounded macro geopolitical and fundamental reporting without manufacturing structured data',()=>{
  const articles=[
    {title:'Fed rate decision and CPI inflation outlook moves risk markets',source:'wire.example',publishedAt:'2026-09-20T10:00:00Z',url:'https://example.com/macro'},
    {title:'Sanctions and export ban raise geopolitical supply disruption risk',source:'wire.example',publishedAt:'2026-09-20T10:05:00Z',url:'https://example.com/geopolitics'},
    {title:'Bitcoin protocol upgrade and institutional ETF adoption expands',source:'wire.example',publishedAt:'2026-09-20T10:10:00Z',url:'https://example.com/fundamental'}
  ];
  const clustering=buildDecisionNewsClusters(articles,{asset:'BTC'});
  const topics=new Set(clustering.clusters.flatMap(cluster=>cluster.topicHints||[]));
  assert.equal(topics.has('MACRO_RATES'),true);
  assert.equal(topics.has('GEOPOLITICS_SUPPLY'),true);
  assert.equal(topics.has('NETWORK_PROTOCOL')||topics.has('ETF_INSTITUTIONAL')||topics.has('ADOPTION_CORPORATE'),true);

  const start=Date.parse('2026-09-20T10:00:00Z');
  const graph={
    asset:'BTC',interval:'15m',
    provenance:{provider:'Hyperliquid',dataFingerprint:'fixture'},
    selection:{
      start,end:start+30*60_000,candles:3,startPrice:100,endPrice:103,changePct:3,rangePct:4,
      volatilityPct:1.2,volumeRatio:1.4,averageVolume:1200,structure:'HH_HL',regime:'TRENDING',
      support:99,resistance:104,evidence:[]
    },
    market:{candles:[
      {time:start-15*60_000,open:99,high:101,low:98,close:100,volume:800},
      {time:start,open:100,high:102,low:99,close:101,volume:1000},
      {time:start+15*60_000,open:101,high:103,low:100,close:102,volume:1200},
      {time:start+30*60_000,open:102,high:104,low:101,close:103,volume:1400},
      {time:start+45*60_000,open:103,high:104,low:102,close:103.5,volume:900}
    ]}
  };
  const result=buildDecisionRangeEvidence({
    graph,
    evidence:{news:{state:'live',provider:'GDELT',articles,clusters:clustering.clusters,clustering}},
    assetClass:'crypto',venue:'Hyperliquid',timezone:'UTC'
  });
  const byId=Object.fromEntries(result.evidenceFamilies.map(item=>[item.id,item]));
  assert.equal(byId['macro-events'].state,'INDEXED_NEWS_ONLY');
  assert.equal(byId.fundamentals.state,'INDEXED_NEWS_ONLY');
  assert.equal(byId.geopolitics.state,'INDEXED_NEWS_ONLY');
  assert.equal(byId['macro-events'].data.officialReleaseValuesAvailable,false);
  assert.equal(byId.fundamentals.data.structuredFundamentalDatasetAvailable,false);
  assert.equal(byId.geopolitics.data.structuredGeopoliticalFeedAvailable,false);
  assert.match(byId.geopolitics.limitations.join(' '),/does not prove market causation/i);
});
