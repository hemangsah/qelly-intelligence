import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildDecisionProvenGraph} from '../functions/_lib/decision-proven-graph.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

const candles=Array.from({length:120},(_,index)=>{
  const time=1_800_000_000_000+index*300_000;
  const open=100+index*.05;
  const close=open+(index%2?.2:-.1);
  return {t:time,o:open,h:Math.max(open,close)+.5,l:Math.min(open,close)-.5,c:close,v:1000+index};
});

test('single-candle selection produces truthful evidence instead of being rejected',()=>{
  const selected=candles[100];
  const graph=buildDecisionProvenGraph(candles,{asset:'BTC',interval:'5m',horizonBars:12,now:candles.at(-1).t+60_000,selection:{start:selected.t,end:selected.t+299_999}});
  assert.equal(graph.selection.candles,1);
  assert.match(graph.selection.evidence.find(item=>item.type==='volatility').title,/Intrabar range proxy/);
  assert.ok(Number.isFinite(graph.selection.rangePct));
  assert.ok(Number.isFinite(graph.selection.volatilityPct));
});

test('Decision Intelligence hero exposes current evidence dimensions without inventing data',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['Current price','Freshness','Regime','Risk state','Timeframe agreement','Data coverage','Derivatives','Last meaningful event'])assert.match(route,new RegExp(phrase));
  assert.match(route,/No fresh sourced event verified/);
  assert.match(route,/Context only · never direction by itself/);
  assert.match(route,/Confidence measures evidence quality and agreement\. It is not a success probability\./);
});

test('Decision Intelligence safely exposes provider-supported 1m and 1d intervals',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/\['1m','5m','15m','30m','1h','4h','1d'\]/);
  assert.match(route,/validHorizons\(state\.interval\)/);
  assert.match(route,/normalizeHorizon\(state\.interval,state\.horizon\)/);
});

test('chart interaction supports a single candle and a dragged move',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/Click one candle or drag across observed candles/);
  assert.match(route,/Explain this candle/);
  assert.match(route,/candles\[a\]\.time\+intervalMs-1/);
  assert.doesNotMatch(route,/if\(b-a<1\)return/);
});

test('Decision Intelligence hero stays dense and responsive',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/\.q-dpg-hero-snapshot\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:900px\)\{\.q-dpg-hero-snapshot\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:520px\)\{\.q-dpg-hero-snapshot\{grid-template-columns:1fr\}/);
});

test('Decision Intelligence normalizes compact sourced timestamps before display',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/const displayTime=\(value\)=>/);
  assert.match(route,/compact=raw\.match/);
  assert.match(route,/Time unavailable/);
  assert.doesNotMatch(route,/lastEventTime\?new Date\(lastEventTime\)\.toLocaleString/);
});


test('Decision Intelligence exposes Find Trade Now and bounded R:R controls',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['Find Trade Now','Risk / reward','1:1','1:2','1:3','1:4','Custom','FIND TRADE NOW · RESEARCH ONLY'])assert.equal(route.includes(phrase),true,phrase);
  assert.match(route,/data-dpg-rr/);
  assert.match(route,/customRr/);
  assert.match(route,/Target-touch probability: uncalibrated/);
});

test('Decision Intelligence R:R research remains responsive on narrow screens',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/\.q-dpg-rr-grid\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.equal(css.includes('@media(max-width:520px){.q-dpg-controls--decision{grid-template-columns:1fr}.q-dpg-trade-summary,.q-dpg-rr-grid{grid-template-columns:1fr}'),true);
});
