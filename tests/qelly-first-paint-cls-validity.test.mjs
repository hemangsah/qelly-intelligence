import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../scripts/qelly-first-paint-stability.mjs',import.meta.url),'utf8');
const start=source.lastIndexOf('await page.addInitScript(()=>{')+'await page.addInitScript(()=>{'.length;
const end=source.indexOf('\n      });',start);
assert.ok(start>28&&end>start,'Locate actual hosted browser initialization');
const install=({supported=true,throws=false}={})=>{
  const callbacks=new Map(),window={};
  class Observer{static supportedEntryTypes=supported?['layout-shift']:[];constructor(callback){this.callback=callback;}observe({type}){if(type==='layout-shift'&&throws)throw Error('Observer failed');callbacks.set(type,this.callback);}}
  runInNewContext(source.slice(start,end),{window,PerformanceObserver:Observer,addEventListener:()=>{}});
  return {state:window.__QELLY_PERF_SIGNALS__,send:entries=>callbacks.get('layout-shift')?.({getEntries:()=>entries})};
};
test('hosted first-paint CLS retains largest burst rather than lifetime sum',()=>{
  const f=install();f.send([{value:.1,startTime:0},{value:.1,startTime:999},{value:.15,startTime:2000}]);assert.equal(f.state.webVitals.cls,.2);
  f.send([{value:.1,startTime:2500},{value:.1,startTime:3000}]);assert.equal(f.state.webVitals.cls,.35);
});
test('hosted first-paint CLS breaks at exactly one-second gap and five-second span',()=>{
  const f=install();f.send([0,900,1800,2700,3600,4500,5000].map(startTime=>({startTime,value:.1})));assert.equal(f.state.webVitals.cls,.6);
  f.send([{startTime:6000,value:.2}]);assert.equal(f.state.webVitals.cls,.6);
});
test('unsupported or failed observation stays unavailable; supported no-shift is zero',()=>{
  assert.equal(install({supported:false}).state.webVitals.cls,null);assert.equal(install({throws:true}).state.webVitals.cls,null);assert.equal(install().state.webVitals.cls,0);
});
test('invalid and recent-input records cannot inflate or reset hosted CLS',()=>{
  const f=install();f.send([{value:.2,startTime:0},{value:.9,startTime:10,hadRecentInput:true},{value:NaN,startTime:20},{value:-1,startTime:30},{value:.5,startTime:NaN},{value:.1,startTime:800}]);assert.equal(f.state.webVitals.cls,.3);
});
