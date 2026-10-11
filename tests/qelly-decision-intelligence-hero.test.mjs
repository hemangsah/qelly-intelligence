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
  for(const phrase of ['QELLY Decision Intelligence','FLAGSHIP RESEARCH WORKSPACE','Evidence quality','Calibrated confidence','Scenario','MTF agreement','Regime','Volatility','Timeframe','Observed ','Find Setup Now','Explain This Move','Explain Candle','Compare Timeframes','Compare Asset','Why NO TRADE?','Sources / Methodology'])assert.match(route,new RegExp(phrase));
  assert.match(route,/data-dpg-asset/);
  assert.match(route,/data-dpg-interval/);
  const draw=route.slice(route.indexOf('main.innerHTML='),route.indexOf('publishDecisionChatContext(data);wire();'));
  assert.match(draw,/stateBanner\(\)\+\(state.error\?/);
  assert.ok(draw.indexOf('q-dpg-state--error')>=0);
  assert.ok(draw.indexOf('q-dpg-state--error')<draw.indexOf('+hero(data)'));
  assert.match(draw,/hero\(data\)\+decisionModeSwitcher\(\)/);
  assert.doesNotMatch(route,/pageHead\('QELLY Decision Intelligence'/);
  assert.match(route,/qelly:chat-context/);
});

test('Decision Intelligence safely exposes every provider-supported picker interval',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/\{'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'1d':86_400_000\}/);
  assert.match(route,/\['SCALP',\['1m','3m','5m'\]\]/);
  assert.match(route,/\['SWING',\['2h','4h','1d'\]\]/);
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
  assert.ok(css.includes('.q-dpg-hero__actions .q-button{width:100%;justify-content:center;min-height:44px;font-size:14px;'));
  assert.doesNotMatch(css,/.q-dpg-hero__actions[^{}]*\{grid-template-columns:1fr\}/);
  assert.match(css,/\.q-dpg-hero\{display:grid;grid-template-columns:minmax\(260px,1\.05fr\)/);
  assert.match(css,/@media\(max-width:1040px\)\{\.q-dpg-hero\{grid-template-columns:1fr 1\.25fr\}/);
  assert.match(css,/@media\(max-width:760px\)\{\.q-dpg-hero\{grid-template-columns:1fr\}/);
  assert.match(css,/@media\(max-width:480px\)\{\.q-dpg-hero__selects,\.q-dpg-hero__metrics\{grid-template-columns:1fr\}/);
});

test('Decision Intelligence normalizes compact sourced timestamps before display',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  assert.match(route,/const displayTime=\(value\)=>/);
  assert.match(route,/compact=raw\.match/);
  assert.match(route,/Time unavailable/);
  assert.doesNotMatch(route,/lastEventTime\?new Date\(lastEventTime\)\.toLocaleString/);
});


test('Decision Intelligence exposes Find Setup Now and bounded R:R controls',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['Find Setup Now','Risk / reward','1:1','1:2','1:3','1:4','Custom','CURRENT SETUP · RESEARCH ONLY'])assert.equal(route.includes(phrase),true,phrase);
  assert.match(route,/data-dpg-rr/);
  assert.match(route,/customRr/);
  assert.match(route,/Target-touch probability: uncalibrated/);
});

test('Decision Intelligence R:R research remains responsive on narrow screens',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  assert.match(css,/\.q-dpg-rr-grid\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.equal(css.includes('@media(max-width:520px){.q-dpg-controls--decision{grid-template-columns:1fr}.q-dpg-trade-summary,.q-dpg-rr-grid{grid-template-columns:1fr}'),true);
});
