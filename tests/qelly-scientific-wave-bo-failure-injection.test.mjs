import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  __decisionFailureInjectionTest,
  fetchNewsContext
} from '../functions/api/v1/decision-proven-graph.js';
import {runDecisionScan} from '../functions/api/v1/decision-scan.js';
import {buildDecisionMacroContext} from '../functions/_lib/decision-macro-events.js';
import {supabaseRequest} from '../functions/_lib/runtime.js';
import {mountTradingViewWidget,__tradingViewDisplayTest} from '../apps/web/public/assets/market/tradingview-display-widget.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
const abortError=(message='simulated timeout')=>{const error=new Error(message);error.name='AbortError';return error;};

const intervalMs=Object.freeze({'15m':900_000,'1h':3_600_000,'4h':14_400_000,'1d':86_400_000});
const candlesFor=(interval,end,count=240)=>Array.from({length:count},(_,index)=>{
  const step=intervalMs[interval]||900_000;
  const t=end-(count-index)*step;
  const close=100+index*.06+Math.sin(index/8)*1.7;
  return {t,o:String(close-.2),h:String(close+.8),l:String(close-.9),c:String(close),v:String(1000+index),n:20+index};
});

const scanResult=(asset)=>({
  asset,interval:'15m',horizon:'4h',observedAt:'2026-09-25T22:00:00.000Z',truthState:'LIVE',
  market:{lastPrice:100,currentState:{regime:'TRENDING'}},
  quant:{regime:'TRENDING',volatility:{regime:'NORMAL',expectedMovePct:2.1}},
  qellyView:{
    action:'WAIT',confidence:.55,contradictions:['Calibration unavailable'],
    evidenceGate:{
      qualityScore:.6,scenarioSeparation:.5,timeframeAgreement:.5,timeframeDirection:'MIXED',
      calibrationState:'UNCALIBRATED',calibrationEligible:false,quantCoverage:'derived'
    }
  },
  tradeResearch:{status:'NO_TRADE',reason:'No eligible setup.',selected:null,entry:null,stop:null,expiryAt:null},
  performance:{totalMs:800}
});

test('Wave BO critical candle timeout fails closed and optional benchmark timeout returns null',async()=>{
  const now=Date.parse('2026-09-25T22:00:00.000Z');
  const timeoutFetch=async()=>{throw abortError();};
  await assert.rejects(
    ()=>__decisionFailureInjectionTest.fetchCandles(timeoutFetch,'BTC','15m',now),
    error=>error?.code==='provider_timeout'&&error?.status===503&&error?.retryable===false
  );
  const optional=await __decisionFailureInjectionTest.fetchOptionalCandles(timeoutFetch,'ETH','15m',now,240);
  assert.equal(optional,null);
});

test('Wave BO optional derivatives, liquidity and funding failures degrade without fabricated values',async()=>{
  const now=Date.parse('2026-09-25T22:00:00.000Z');
  const timeoutFetch=async()=>{throw abortError();};
  const [derivatives,liquidity,funding]=await Promise.all([
    __decisionFailureInjectionTest.fetchDerivativesContext(timeoutFetch,'BTC',now),
    __decisionFailureInjectionTest.fetchLiquidityContext(timeoutFetch,'BTC'),
    __decisionFailureInjectionTest.fetchFundingHistory(timeoutFetch,'BTC',now)
  ]);
  assert.equal(derivatives.state,'unavailable');
  assert.equal(derivatives.provider,'Hyperliquid');
  assert.equal(derivatives.fundingRate,undefined);
  assert.equal(derivatives.resilience?.reason,'provider_timeout');
  assert.equal(liquidity.state,'unavailable');
  assert.equal(liquidity.spreadState,'UNAVAILABLE');
  assert.equal(liquidity.top5Imbalance,null);
  assert.equal(liquidity.resilience?.reason,'provider_timeout');
  assert.deepEqual(funding,[]);
});

test('Wave BO partial multi-timeframe failure preserves the fulfilled observed frames only',async()=>{
  const end=Date.parse('2026-09-25T22:00:00.000Z');
  const calls=[];
  const fetchImpl=async(_url,options={})=>{
    const body=JSON.parse(options.body);
    calls.push(body);
    assert.equal(body.type,'candleSnapshot');
    const interval=body.req.interval;
    if(interval==='4h')throw abortError('simulated 4h timeout');
    return new Response(JSON.stringify(candlesFor(interval,body.req.endTime,240)),{status:200,headers:{'content-type':'application/json'}});
  };
  const support=await __decisionFailureInjectionTest.fetchTimeframeSupport(fetchImpl,'BTC',end,'15m');
  assert.equal(support.length,2);
  assert.deepEqual(new Set(support.map(item=>item.interval)),new Set(['1h','1d']));
  assert.ok(calls.some(body=>body.req.interval==='4h'));
  assert.ok(support.every(item=>item.truthState==='LIVE'));
});

test('Wave BO news provider failure uses only a bounded stale cache and never relabels it fresh',async()=>{
  const now=Date.parse('2026-09-25T22:00:00.000Z');
  const staleFetchedAt=new Date(now-10*60_000).toISOString();
  const cachedArticles=[{title:'Cached context only',source:'example.com',publishedAt:'20260925T210000Z',url:'https://example.com/context'}];
  const cache={
    async match(){return new Response(JSON.stringify({articles:cachedArticles,state:'live',fetchedAt:staleFetchedAt}),{headers:{'content-type':'application/json'}});},
    async put(){throw new Error('provider failure must not overwrite stale fixture');}
  };
  const failedFetch=async()=>new Response('provider down',{status:503});
  const result=await fetchNewsContext(failedFetch,'BTC',now-24*3_600_000,now,{cache,now});
  assert.equal(result.state,'stale');
  assert.equal(result.cache.hit,true);
  assert.equal(result.cache.stale,true);
  assert.equal(result.fallbackReason,'news_provider_unavailable_using_stale_cache');
  assert.deepEqual(result.articles,cachedArticles);
});

test('Wave BO macro failure remains unavailable reference context and does not infer missing series',()=>{
  const macro=buildDecisionMacroContext({truthState:'unavailable',fallbackReason:'simulated_ecb_timeout'});
  assert.equal(macro.state,'unavailable');
  assert.equal(macro.eligibilityImpact,'none');
  assert.deepEqual(macro.fxReference,{eurUsd:null,usdInr:null,eurInr:null});
  assert.ok(macro.unavailableSeries.includes('DXY'));
  assert.ok(macro.unavailableSeries.includes('US_10Y'));
  assert.match(macro.reason,/simulated_ecb_timeout/);
  assert.match(macro.cadenceBoundary,/not substituted/i);
});

test('Wave BO Supabase/database slowdown returns a bounded retryable timeout instead of hanging',async()=>{
  const env={
    QELLY_PUBLIC_SITE_URL:'https://terminal.qellyintelligence.com',
    QELLY_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'publishable_test_key_abcdefghijklmnopqrstuvwxyz',
    __fetch:async(_url,{signal}={})=>new Promise((_resolve,reject)=>{
      const fail=()=>{const error=abortError('database timeout');reject(error);};
      if(signal?.aborted)return fail();
      signal?.addEventListener('abort',fail,{once:true});
    })
  };
  await assert.rejects(
    ()=>supabaseRequest(env,'/rest/v1/qelly_decisions?select=id',{timeoutMs:5}),
    error=>error?.code==='supabase_timeout'&&error?.status===503&&error?.retryable===true
  );
});

test('Wave BO scanner tolerates one failed asset and reports it without fabricating a candidate',async()=>{
  const scan=await runDecisionScan({},{
    now:Date.parse('2026-09-25T22:00:00.000Z'),
    build:async(_env,{asset})=>{
      if(asset==='SOL')throw new Error('simulated SOL provider failure');
      return scanResult(asset);
    }
  });
  assert.equal(scan.availableCount,5);
  assert.equal(scan.unavailableCount,1);
  assert.equal(scan.failures.length,1);
  assert.equal(scan.failures[0].asset,'SOL');
  assert.equal(scan.failures[0].state,'PROVIDER_UNAVAILABLE');
  assert.equal(scan.candidates.some(item=>item.asset==='SOL'),false);
  assert.equal(scan.performance.database.used,false);
  assert.equal(scan.state,'WAIT');
});

test('Wave BO TradingView iframe timeout renders an explicit unavailable fallback with no substitute values',async()=>{
  const originals={
    HTMLElement:globalThis.HTMLElement,
    document:globalThis.document,
    window:globalThis.window,
    MutationObserver:globalThis.MutationObserver,
    CustomEvent:globalThis.CustomEvent,
    setTimeout:globalThis.setTimeout
  };
  class FakeElement{
    constructor(tag='div'){this.tagName=String(tag).toUpperCase();this.dataset={};this.style={};this.children=[];this.attributes={};this.listeners={};this._innerHTML='';this.isConnected=true;}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=[...nodes];this._innerHTML='';}
    set innerHTML(value){this._innerHTML=String(value);this.children=[];}
    get innerHTML(){return this._innerHTML;}
    setAttribute(name,value){this.attributes[name]=String(value);}
    addEventListener(type,handler){this.listeners[type]=handler;}
    querySelector(selector){
      if(selector==='iframe')return null;
      if(selector==='[data-qelly-tv-retry]')return null;
      return null;
    }
    remove(){this.removed=true;}
  }
  class FakeMutationObserver{constructor(callback){this.callback=callback;}observe(){}disconnect(){this.disconnected=true;}}
  class FakeCustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
  const emitted=[];
  const originalSetTimeout=originals.setTimeout;
  try{
    globalThis.HTMLElement=FakeElement;
    globalThis.document={
      querySelector:()=>null,
      createElement:tag=>new FakeElement(tag),
      head:{append(){}}
    };
    globalThis.window={dispatchEvent:event=>{emitted.push(event);return true;}};
    globalThis.MutationObserver=FakeMutationObserver;
    globalThis.CustomEvent=FakeCustomEvent;
    globalThis.setTimeout=(fn,ms,...args)=>originalSetTimeout(fn,ms===__tradingViewDisplayTest.WIDGET_TIMEOUT_MS?5:ms,...args);

    const container=new FakeElement('div');
    const handle=mountTradingViewWidget(container,{kind:'advancedChart',label:'Injected chart failure'});
    await new Promise(resolve=>originalSetTimeout(resolve,20));
    assert.equal(container.dataset.externalState,'unavailable');
    assert.match(container.innerHTML,/did not initialize within the production timeout/i);
    assert.match(container.innerHTML,/has not substituted or fabricated chart values/i);
    assert.ok(emitted.some(event=>event?.detail?.feature==='embed'&&event?.detail?.action==='failure'&&event?.detail?.state==='timeout'));
    handle.destroy();
    assert.equal(container.children.length,0);
  }finally{
    if(originals.HTMLElement===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=originals.HTMLElement;
    if(originals.document===undefined)delete globalThis.document;else globalThis.document=originals.document;
    if(originals.window===undefined)delete globalThis.window;else globalThis.window=originals.window;
    if(originals.MutationObserver===undefined)delete globalThis.MutationObserver;else globalThis.MutationObserver=originals.MutationObserver;
    if(originals.CustomEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=originals.CustomEvent;
    globalThis.setTimeout=originalSetTimeout;
  }
});

test('Wave BO source keeps public Decision failure handling explicit and never substitutes unrelated evidence',async()=>{
  const [decision,resilience,widget]=await Promise.all([
    read('functions/api/v1/decision-proven-graph.js'),
    read('functions/_lib/decision-provider-resilience.js'),
    read('apps/web/public/assets/market/tradingview-display-widget.mjs')
  ]);
  assert.match(decision,/fetchTimeframeSupport/);
  assert.match(decision,/Promise\.allSettled/);
  assert.match(decision,/state:'unavailable'/);
  assert.match(resilience,/Provider resilience never substitutes unrelated evidence/);
  assert.match(resilience,/Critical market-data failure fails closed/);
  assert.match(widget,/Qelly has not substituted or fabricated chart values/);
});
