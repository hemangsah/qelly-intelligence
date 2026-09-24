import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  startRouteMeasure,finishRouteMeasure,runtimePerformanceSnapshot,
  __runtimePerformanceTest
} from '../apps/web/public/assets/runtime-performance-observer.mjs';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Wave ZA runtime performance observer uses fixed non-loosened technical budgets and provider-only resource classification',()=>{
  assert.equal(__runtimePerformanceTest.LONG_TASK_NOTICE_MS,200);
  assert.equal(__runtimePerformanceTest.LONG_TASK_REPEATED_BUDGET_MS,500);
  assert.equal(__runtimePerformanceTest.MAX_ROUTE_SAMPLES,48);
  assert.equal(__runtimePerformanceTest.durationBucket(99),'lt_100ms');
  assert.equal(__runtimePerformanceTest.durationBucket(501),'500_999ms');
  assert.equal(__runtimePerformanceTest.providerFromUrl('https://s3.tradingview.com/external-embedding/a.js'),'tradingview');
  assert.equal(__runtimePerformanceTest.providerFromUrl('https://files.coinmarketcap.com/static/widget/a.js'),'coinmarketcap');
  assert.equal(__runtimePerformanceTest.providerFromUrl('https://platform.twitter.com/widgets.js'),'x');
});

test('Wave ZA route diagnostics are bounded and never require network or consumer UI',async()=>{
  const source=await read('apps/web/public/assets/runtime-performance-observer.mjs');
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  assert.match(source,/PerformanceObserver/);
  for(const metric of ['paint','largest-contentful-paint','layout-shift','event','longtask','resource'])assert.ok(source.includes(`observe('${metric}'`),metric);
  const root={querySelectorAll:()=>Array.from({length:12})};
  for(let i=0;i<60;i++){
    const token=startRouteMeasure('decision-provenance',i);
    const sample=finishRouteMeasure(token,{state:'success',root});
    assert.equal(sample.route,'decision-provenance');
    assert.equal(sample.domNodes,12);
  }
  const snapshot=runtimePerformanceSnapshot();
  assert.equal(snapshot.routes.length,48);
  assert.equal(snapshot.schemaVersion,'qelly.runtime-performance/1.0.0');
  assert.equal(snapshot.budgets.repeatedFirstPartyLongTaskMs,500);
});

test('Wave ZA app measures the authoritative route owner including superseded and error outcomes',async()=>{
  const app=await read('apps/web/public/assets/app.js');
  assert.match(app,/runtime-performance-observer\.mjs/);
  assert.match(app,/installRuntimePerformanceObserver\(\)/);
  assert.match(app,/const routeMeasure=startRouteMeasure\(state\.route,request\)/);
  assert.match(app,/controller\.qellyRouteMeasure=routeMeasure/);
  assert.match(app,/request===routeRenderRequest\?performRouteRender\(request,controller\):undefined/);
  assert.match(app,/if\(activeRouteMeasure\)finishRouteMeasure\(activeRouteMeasure,\{state:'superseded',root:main\}\)/);
  assert.match(app,/routeOutcome='aborted'/);
  assert.match(app,/routeOutcome='capability_boundary'/);
  assert.match(app,/routeOutcome='recovery'/);
  assert.match(app,/routeOutcome='error'/);
  assert.match(app,/finishRouteMeasure\(routeMeasure,\{state:superseded\?'superseded':routeOutcome,root:main\}\)/);
});

test('Wave ZA TradingView mounts are idempotent per container and preserve display-only boundaries',async()=>{
  const source=await read('apps/web/public/assets/market/tradingview-display-widget.mjs');
  assert.match(source,/const ACTIVE_WIDGETS=new WeakMap\(\)/);
  assert.match(source,/ACTIVE_WIDGETS\.get\(container\)\?\.destroy\?\.\(\)/);
  assert.match(source,/ACTIVE_WIDGETS\.set\(container,handle\)/);
  assert.match(source,/if\(ACTIVE_WIDGETS\.get\(container\)===handle\)ACTIVE_WIDGETS\.delete\(container\)/);
  assert.match(source,/destroy\(\)\{/);
  assert.match(source,/if\(destroyed\)return;/);
  assert.match(source,/WIDGET_TIMEOUT_MS=12000/);
  assert.match(source,/does not read, scrape, transform, persist or use widget values/i);
  assert.doesNotMatch(source,/contentWindow|contentDocument|\bfetch\s*\(/);
});

test('Wave ZA CoinMarketCap and X use one shared provider-script loader with mount-local failure cleanup',async()=>{
  const source=await read('apps/web/public/assets/market/external-intelligence-widgets.mjs');
  assert.match(source,/const SHARED_SCRIPT_LOADS=new Map\(\)/);
  assert.match(source,/const SHARED_SCRIPT_TIMEOUT_MS=12000/);
  assert.match(source,/function loadSharedExternalScript/);
  assert.match(source,/if\(existing\)return existing\.promise/);
  assert.match(source,/document\.head\.append\(script\)/);
  assert.match(source,/SHARED_SCRIPT_LOADS\.delete\(src\)/);
  assert.match(source,/loadSharedExternalScript\(COINMARKETCAP_WIDGET_SRC\)/);
  assert.match(source,/window\.__WIDGET_INIT/);
  assert.match(source,/loadSharedExternalScript\(X_WIDGET_SRC/);
  assert.match(source,/window\.twttr\?\.widgets\?\.load/);
  assert.doesNotMatch(source,/container\.append\(script\)/);
  assert.doesNotMatch(source,/shell\.append\(timeline,script\)/);
});

test('Wave ZA keeps Market route lazy mounts and deterministic route cleanup while shared loaders stay outside Decision evidence',async()=>{
  const [market,grid]=await Promise.all([
    read('apps/web/public/assets/routes/market-v6.mjs'),
    read('apps/web/public/assets/market/tradingview-market-grid.mjs')
  ]);
  assert.match(market,/const MARKET_ROUTE_SETTLE_DELAY_MS=900/);
  assert.match(market,/const TICKER_ROUTE_SETTLE_DELAY_MS=1350/);
  assert.match(market,/IntersectionObserver/);
  assert.match(market,/window\.__qellyMarketV6Cleanup=/);
  for(const cleanup of ['themeObserver.disconnect()','tickerObserver?.disconnect?.()','handle?.destroy?.()','tickerHandle?.destroy?.()','marketGridHandle?.destroy?.()','intelligenceDockHandle?.destroy?.()'])assert.ok(market.includes(cleanup),cleanup);
  assert.match(grid,/observer\.unobserve\(entry\.target\)/);
  assert.match(grid,/mountTimers\.clear\(\)/);
  assert.match(grid,/for\(const handle of handles\.values\(\)\)handle\?\.destroy\?\.\(\)/);
});

test('Wave ZA Browser E2E requires runtime metrics and rejects repeated >500ms first-party long tasks without weakening web-vital limits',async()=>{
  const script=await read('scripts/qelly-first-paint-stability.mjs');
  assert.match(script,/__QELLY_RUNTIME_PERFORMANCE__/);
  assert.match(script,/runtimeMeasured/);
  assert.match(script,/firstPartyLongTasksOver500/);
  assert.match(script,/repeatedFirstPartyLongTaskViolation=firstPartyLongTasksOver500\.length>=2/);
  assert.match(script,/criticalStalls=performanceSignals\.longTasks\.filter\(\(item\)=>Number\(item\.duration\)>2000\)/);
  assert.match(script,/if\(Number\(vitals\.fcpMs\)>3000\)/);
  assert.match(script,/if\(Number\(vitals\.lcpMs\)>4000\)/);
  assert.match(script,/if\(Number\(vitals\.cls\)>0\.25\)/);
  assert.match(script,/if\(representativeInteraction&&Number\(vitals\.inpMs\)>500\)/);
  assert.match(script,/maxRouteTransitionMs/);
  assert.match(script,/runtimeMetricsMissing/);
});
