import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {__decisionProvenGraphRouteTest as routeTest} from '../apps/web/public/assets/routes/decision-proven-graph.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const candles=Array.from({length:12},(_,index)=>{
  const time=1_800_000_000_000+index*300_000;
  const open=100+index;
  const close=open+(index%2?1.5:-.5);
  return {time,open,high:Math.max(open,close)+2,low:Math.min(open,close)-1,close,volume:1000+index};
});

test('Wave BR pure range helpers normalize right-to-left selection and expose truthful metrics',()=>{
  const selection=routeTest.buildRangeSelection(candles,8,3,300_000);
  assert.equal(selection.start,candles[3].time);
  assert.equal(selection.end,candles[8].time+299_999);
  const metrics=routeTest.rangeSelectionMetrics(candles,selection,'5m');
  assert.equal(metrics.startIndex,3);
  assert.equal(metrics.endIndex,8);
  assert.equal(metrics.candles,6);
  assert.equal(metrics.durationMs,6*300_000);
  assert.equal(metrics.timeframe,'5m');
  assert.equal(metrics.high,Math.max(...candles.slice(3,9).map(x=>x.high)));
  assert.equal(metrics.low,Math.min(...candles.slice(3,9).map(x=>x.low)));
  assert.ok(Number.isFinite(metrics.movePct));
  assert.ok(['UP','DOWN','FLAT'].includes(metrics.direction));
});

test('Wave BR supports a single candle without expanding it into adjacent bars',()=>{
  const selection=routeTest.buildRangeSelection(candles,5,5,300_000);
  const metrics=routeTest.rangeSelectionMetrics(candles,selection,'5m');
  assert.equal(metrics.candles,1);
  assert.equal(metrics.startIndex,5);
  assert.equal(metrics.endIndex,5);
  assert.equal(metrics.durationMs,300_000);
});

test('Wave BR renders persistent selected-range geometry, boundaries and selected candles',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const token of [
    'data-dpg-selection-rect',
    'data-dpg-selection-start',
    'data-dpg-selection-end',
    'data-dpg-selection-start-handle',
    'data-dpg-selection-end-handle',
    'data-candle-index',
    'is-selected',
    'state.draft||state.selection',
    'requestAnimationFrame',
    'pointermove',
    'pointercancel'
  ])assert.ok(route.includes(token),token);
  assert.match(route,/selection persists until Clear/);
});

test('Wave BR exposes explicit chart modes and does not capture Navigate mode as range selection',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of ['Navigate','Select Range','Select Candle','Measure Move'])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/state\.chartMode==='navigate'\)return/);
  assert.match(route,/svg\.dataset\.mode=state\.chartMode/);
  assert.match(route,/data-dpg-chart-mode/);
});

test('Wave BR range summary contains required range facts and actions',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  for(const phrase of [
    'Start','End','Duration','Candles','Move','Absolute','High','Low',
    'Explain This Move','News & Events','Flow / Participation Evidence',
    'Compare Before vs After','Find Similar History','Ask QELLY',
    'Create Research Note','Clear'
  ])assert.ok(route.includes(phrase),phrase);
  assert.match(route,/Selected range start candle/);
  assert.match(route,/Selected range end candle/);
  assert.match(route,/role="status" aria-live="polite"/);
});

test('Wave BR clears stale selection on asset/timeframe changes and keeps selection through evidence loads',async()=>{
  const route=await read('apps/web/public/assets/routes/decision-proven-graph.mjs');
  const wire=route.slice(route.indexOf('const wire=()=>'),route.indexOf('async function loadLedger'));
  assert.match(wire,/state\.draft=null;state\.selection=null;scheduleLoad\(\)/);
  const load=route.slice(route.indexOf('async function load(){'),route.lastIndexOf('await load();'));
  assert.match(load,/state\.selection\?'&selectionStart='/);
  assert.doesNotMatch(load,/state\.draft=null/);
  assert.doesNotMatch(load,/state\.selection=null/);
});

test('Wave BR CSS makes the range obvious, responsive and reduced-motion safe',async()=>{
  const css=await read('apps/web/public/assets/qelly-decision-proven-graph.css');
  for(const token of [
    'Major Reinvention Wave BR: Range Selection 2.0',
    '.q-dpg-selection__boundary',
    '.q-dpg-selection__handle',
    '.q-dpg-candle.is-selected',
    '.q-dpg-range-summary',
    '.q-dpg-range-toolbar',
    '.q-dpg-range-keyboard',
    '@media(prefers-reduced-motion:reduce)'
  ])assert.ok(css.includes(token),token);
  assert.match(css,/\.q-dpg-chart\[data-mode="navigate"\]\{touch-action:pan-x pan-y/);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*q-dpg-range-toolbar/);
});
