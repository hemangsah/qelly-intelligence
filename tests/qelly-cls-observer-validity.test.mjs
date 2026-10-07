import test from 'node:test';
import assert from 'node:assert/strict';

let instance=0;
async function observerFixture({supported=true,throws=false,supportedTypes=true}={}){
 const original=globalThis.PerformanceObserver;
 const callbacks=new Map();
 if(supported)globalThis.PerformanceObserver=class {
  static supportedEntryTypes=supportedTypes?['layout-shift']:[];
  constructor(callback){this.callback=callback;}
  observe({type}){if(throws&&type==='layout-shift')throw Error('Unsupported');callbacks.set(type,this.callback);}
 };else delete globalThis.PerformanceObserver;
 try{const module=await import('../apps/web/public/assets/runtime-performance-observer.mjs?cls-fixture='+instance++);module.installRuntimePerformanceObserver();return {snapshot:module.runtimePerformanceSnapshot,shifts:entries=>callbacks.get('layout-shift')?.({getEntries:()=>entries})};}
 finally{if(original===undefined)delete globalThis.PerformanceObserver;else globalThis.PerformanceObserver=original;}
}
test('an unavailable or rejected layout-shift observer does not manufacture a zero CLS measurement',async()=>{
 for(const options of [{supported:false},{throws:true},{supportedTypes:false}])assert.equal((await observerFixture(options)).snapshot().webVitals.cls,null);
});
test('a supported layout-shift observer retains actual no-shift zero',async()=>{
 assert.equal((await observerFixture()).snapshot().webVitals.cls,0);
});
test('CLS is the largest burst, separated by a one-second gap',async()=>{
 const observed=await observerFixture();
 observed.shifts([{startTime:100,value:.06,hadRecentInput:false},{startTime:500,value:.06,hadRecentInput:false},{startTime:1500,value:.09,hadRecentInput:false}]);
 assert.equal(observed.snapshot().webVitals.cls,.12);
});
test('CLS starts a new burst at the five-second window boundary despite short gaps',async()=>{
 const observed=await observerFixture();
 observed.shifts(Array.from({length:7},(_,i)=>({startTime:i*900,value:.02,hadRecentInput:false})));
 assert.equal(observed.snapshot().webVitals.cls,.12);
});
test('recent-input and malformed entries cannot add fictitious layout shift',async()=>{
 const observed=await observerFixture();
 observed.shifts([{startTime:100,value:.07,hadRecentInput:false},{startTime:200,value:.5,hadRecentInput:true},{startTime:300,value:null},{startTime:400,value:'0.3'},{startTime:500,value:-.2},{startTime:NaN,value:.4}]);
 assert.equal(observed.snapshot().webVitals.cls,.07);
});
