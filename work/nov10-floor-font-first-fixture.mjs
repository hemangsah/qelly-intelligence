// Existing governed Decision engine fixture adapter; exact checkout engine imports, synthetic GET responses only.
import {pathToFileURL} from 'node:url';
const {buildDecisionIntelligence}=await import(pathToFileURL(process.cwd()+'/functions/api/v1/decision-proven-graph.js'));
export const {decisionAssetCapabilities}=await import(pathToFileURL(process.cwd()+'/functions/_lib/decision-asset-capabilities.js'));
const {onRequest:newsContextRequest}=await import(pathToFileURL(process.cwd()+'/functions/api/v1/decision-news-context.js'));

const FIXTURE_INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'8h':28_800_000,'12h':43_200_000,'1d':86_400_000});
const FIXTURE_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const FIXTURE_BASE=Object.freeze({BTC:84_000,ETH:3_100,SOL:145,HYPE:42,XRP:2.6,DOGE:.22});
const fixtureNow=Date.now()-1_000;
const fixtureReferenceDate=new Date(fixtureNow).toISOString().slice(0,10);
const fixtureCandlesFor=(asset='BTC',interval='15m',endTime=fixtureNow,points=500)=>{
  const symbol=FIXTURE_ASSETS.includes(String(asset).toUpperCase())?String(asset).toUpperCase():'BTC';
  const step=FIXTURE_INTERVAL_MS[interval]||FIXTURE_INTERVAL_MS['15m'];
  const count=Math.max(180,Math.min(500,Number(points)||500));
  const base=FIXTURE_BASE[symbol]||100;
  return Array.from({length:count},(_,index)=>{
    const drift=(index-count*.55)*.0007;
    const wave=Math.sin(index/7)*.012+Math.sin(index/19)*.008;
    const close=base*(1+drift+wave);
    const open=close*(1-Math.sin(index/5)*.0018);
    const high=Math.max(open,close)*(1.0045+Math.abs(Math.sin(index/11))*.002);
    const low=Math.min(open,close)*(1-.0045-Math.abs(Math.cos(index/13))*.002);
    return {t:Number(endTime)-(count-1-index)*step,o:String(open),h:String(high),l:String(low),c:String(close),v:String(800+index*3),n:40+index};
  });
};
const fixtureProviderFetch=async(url,options={})=>{
  let target;
  try{target=new URL(String(url));}catch{return new Response(JSON.stringify({}),{status:400,headers:{'content-type':'application/json'}});}
  if(target.protocol==='https:'&&target.hostname==='www.ecb.europa.eu'&&target.pathname==='/stats/eurofxref/eurofxref-daily.xml')return new Response('<Cube time="'+fixtureReferenceDate+'"><Cube currency="USD" rate="1.1"/><Cube currency="INR" rate="90"/><Cube currency="GBP" rate="0.85"/><Cube currency="JPY" rate="160"/><Cube currency="CHF" rate="0.95"/></Cube>',{status:200,headers:{'content-type':'application/xml'}});
  if(target.protocol==='https:'&&target.hostname==='api.hyperliquid.xyz'){
    let body={};
    try{body=JSON.parse(options?.body||'{}');}catch{}
    if(body.type==='candleSnapshot'){
      const req=body.req||{},interval=String(req.interval||'15m'),endTime=Number(req.endTime)||fixtureNow,step=FIXTURE_INTERVAL_MS[interval]||FIXTURE_INTERVAL_MS['15m'];
      const requested=Math.ceil(Math.max(step,(endTime-(Number(req.startTime)||endTime-step*500)))/step);
      return new Response(JSON.stringify(fixtureCandlesFor(req.coin,interval,endTime,requested)),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.type==='metaAndAssetCtxs'){
      const universe=FIXTURE_ASSETS.map(name=>({name}));
      const contexts=FIXTURE_ASSETS.map((name,index)=>{
        const mark=FIXTURE_BASE[name]*(1+index*.001);
        return {funding:String(.00005+index*.00001),openInterest:String(900+index*120),markPx:String(mark),oraclePx:String(mark*.9995),dayNtlVlm:String(80_000_000+index*7_500_000),premium:String(.0001+index*.00002),prevDayPx:String(mark*.992)};
      });
      return new Response(JSON.stringify([{universe},contexts]),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.type==='l2Book'){
      const base=FIXTURE_BASE[String(body.coin||'BTC').toUpperCase()]||100;
      const bids=Array.from({length:20},(_,i)=>({px:String(base*(1-.0003*(i+1))),sz:String(3+i*.2),n:8+i}));
      const asks=Array.from({length:20},(_,i)=>({px:String(base*(1+.0003*(i+1))),sz:String(2.8+i*.18),n:7+i}));
      return new Response(JSON.stringify({time:fixtureNow,levels:[bids,asks]}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.type==='fundingHistory'){
      const start=Number(body.startTime)||fixtureNow-72*3_600_000,end=Number(body.endTime)||fixtureNow;
      const rows=Array.from({length:12},(_,i)=>({time:start+(end-start)*(i+1)/12,fundingRate:.00004+i*.000002,premium:.00008+i*.000003}));
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(target.protocol==='https:'&&target.hostname==='api.gdeltproject.org')return new Response(JSON.stringify({articles:[]}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}});
};
export const fixtureDecisionPayload=async(requestUrl)=>{
  const asset=String(requestUrl.searchParams.get('asset')||'BTC').toUpperCase();
  const interval=requestUrl.searchParams.get('interval')||'15m';
  const horizon=requestUrl.searchParams.get('horizon')||'4h';
  const requestedRr=requestUrl.searchParams.get('rr')||'auto';
  const customRr=requestUrl.searchParams.get('customRr');
  const nextBars=requestUrl.searchParams.get('nextBars');
  const selection=requestUrl.searchParams.has('selectionStart')||requestUrl.searchParams.has('selectionEnd')
    ?{start:Number(requestUrl.searchParams.get('selectionStart')),end:Number(requestUrl.searchParams.get('selectionEnd'))}
    :null;
  return buildDecisionIntelligence({__fetch:fixtureProviderFetch},{asset,interval,horizon,requestedRr,customRr,nextBars,selection,now:fixtureNow});
};

export const fixtureNewsResponse=requestUrl=>newsContextRequest({request:new Request(String(requestUrl)),env:{__fetch:fixtureProviderFetch}});


// Appended to the unchanged governed engine fixture adapter; synthetic DOM cases only.
import assert from 'node:assert/strict';
export const fontFirstFixtureHtml=appearance=>'<!doctype html><html><head><meta charset="utf-8"><title>Font eligibility comparison</title><style>body{margin:0;padding:20px;font-family:Arial,sans-serif;background:'+(appearance==='dark'?'#0b080a':'#faf5f3')+';color:'+(appearance==='dark'?'#f6e8ed':'#28131b')+'}h1{font-size:24px}.cases{display:grid;gap:8px;padding:16px;background:'+(appearance==='dark'?'#201016':'#f0e2e6')+'}.q-v8-text-floor{font-size:12px!important}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden}canvas{display:none}</style></head><body><h1>Font eligibility fixture</h1><p>Visible, hidden and changing text keep the same accessibility decisions.</p><main id="main" class="cases"><span data-fixture="v08" style="font-size:8px">Visible eight</span><span data-fixture="v10" style="font-size:10px">Visible ten</span><span data-fixture="v119" style="font-size:11.9px">Visible eleven point nine</span><span data-fixture="v12" style="font-size:12px">Visible twelve</span><span data-fixture="v14" style="font-size:14px">Visible fourteen</span><span data-fixture="v18" style="font-size:18px">Visible eighteen</span><span data-fixture="vzero" style="font-size:0">Visible zero seed</span><span data-fixture="empty" style="font-size:8px">   </span><div data-fixture="parent" style="font-size:8px">Parent has a child <span data-fixture="child" style="font-size:8px">Child eight</span></div><span data-fixture="display-none" style="font-size:8px;display:none">Display none then shown</span><span data-fixture="hidden" hidden style="font-size:8px">Hidden then shown</span><section id="hidden-parent" style="display:none"><span data-fixture="parent-hidden" style="font-size:8px">Hidden parent then shown</span></section><section aria-hidden="true"><span data-fixture="aria-hidden" style="font-size:8px">Aria hidden excluded</span></section><section class="sr-only"><span data-fixture="sr-only" style="font-size:8px">Screen reader only excluded</span></section><span data-fixture="visibility-hidden" style="font-size:8px;visibility:hidden">Visibility hidden keeps the existing rectangle policy</span><span data-fixture="offscreen" style="font-size:8px;position:absolute;left:-10000px">Offscreen rectangle retains existing policy</span><em data-fixture="em08" style="font-size:8px">Emphasis eight</em><canvas id="metric-canary"></canvas></main></body></html>';
export async function runFontFirstEdges(page,{site,appearance,floorSource,capture,file}){
 await page.goto(site+'/__floor-font-fixture__',{waitUntil:'domcontentloaded'});
 await page.evaluate(source=>{const main=document.getElementById('main');window.__FONT_FIRST_FIXTURE_FLOOR__=new Function('main',source+';return applyAccessibilityFloor;')(main);},floorSource);
 const canary=await page.evaluate(()=>{
  const p=window.__QELLY_NOV10_FONT_FIRST_MECHANISM__;p.mark('operation-canary');const node=document.querySelector('[data-fixture="v14"]'),range=document.createRange();range.selectNodeContents(node);
  node.getClientRects();getComputedStyle(node);node.getBoundingClientRect();range.getClientRects();range.getBoundingClientRect();document.getElementById('metric-canary').getContext('2d').measureText('Font eligibility counter canary');
  return {...p.operationCounts['operation-canary']};
 });
 assert.deepEqual(canary,{rectangleReads:1,fontStyleReads:1,boundsReads:1,rangeReads:2,canvasMetricReads:1});
 const inspect=()=>page.evaluate(()=>[...document.querySelectorAll('[data-fixture]')].map(e=>({id:e.dataset.fixture,text:e.textContent.trim(),floor:e.classList.contains('q-v8-text-floor'),fontSize:Number.parseFloat(getComputedStyle(e).fontSize),rectangles:e.getClientRects().length,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,children:e.children.length,excluded:!!e.closest('.sr-only,[aria-hidden="true"],script,style')})));
 const run=async phase=>{await page.evaluate(phase=>{window.__QELLY_NOV10_FONT_FIRST_MECHANISM__.mark(phase);window.__FONT_FIRST_FIXTURE_FLOOR__();},phase);return inspect();};
 const before=await inspect(),initial=await run('fixture-initial');
 const by=rows=>Object.fromEntries(rows.map(r=>[r.id,r]));
 for(const id of ['v08','v10','v119','vzero','child','em08','visibility-hidden','offscreen']){assert.equal(by(initial)[id].floor,true,id);assert.equal(by(initial)[id].fontSize,12,id);}
 for(const id of ['v12','v14','v18','empty','parent','display-none','hidden','parent-hidden','aria-hidden','sr-only'])assert.equal(by(initial)[id].floor,false,id);
 await page.evaluate(()=>{document.querySelector('[data-fixture="display-none"]').style.display='inline';document.querySelector('[data-fixture="hidden"]').hidden=false;document.getElementById('hidden-parent').style.display='block';});
 const shown=await run('fixture-shown');
 for(const id of ['display-none','hidden','parent-hidden']){assert.equal(by(shown)[id].floor,true,id);assert.equal(by(shown)[id].fontSize,12,id);}
 await page.evaluate(()=>{for(const [id,size] of [['dynamic09',9],['dynamic16',16]]){const e=document.createElement('span');e.dataset.fixture=id;e.style.fontSize=size+'px';e.textContent=id;document.getElementById('main').append(e);}document.querySelector('[data-fixture="v14"]').style.fontSize='9px';});
 const dynamic=await run('fixture-dynamic');
 assert.equal(by(dynamic).dynamic09.floor,true);assert.equal(by(dynamic).dynamic09.fontSize,12);assert.equal(by(dynamic).dynamic16.floor,false);assert.equal(by(dynamic).dynamic16.fontSize,16);assert.equal(by(dynamic).v14.floor,true);assert.equal(by(dynamic).v14.fontSize,12);
 const stable=await run('fixture-stable');assert.deepEqual(stable,dynamic,'Existing markers and unchanged content stay stable');
 const image=file?await capture(page,file):null;
 const benchmarks=[];
 for(const pattern of ['mostly-visible','hidden-heavy'])for(let repetition=1;repetition<=3;repetition++){
  const measured=await page.evaluate(({pattern,repetition})=>{
   const p=window.__QELLY_NOV10_FONT_FIRST_MECHANISM__,main=document.getElementById('main'),sizes=[8,10,11.9,12,14,18];
   main.innerHTML=Array.from({length:480},(_,i)=>{const variant=pattern==='mostly-visible'?i%10:i%5,none=pattern==='mostly-visible'?variant===8:variant===1,hidden=pattern==='hidden-heavy'&&variant===2,aria=pattern==='mostly-visible'?variant===9:variant===3;return'<span data-benchmark="'+i+'"'+(hidden?' hidden':'')+(aria?' aria-hidden="true"':'')+' style="font-size:'+sizes[i%sizes.length]+'px;'+(none?'display:none;':'')+'">Metric label '+i+'</span>';}).join('');
   p.mark('fixture-benchmark-'+pattern+'-'+repetition);window.__FONT_FIRST_FIXTURE_FLOOR__();
   const call={...p.floorCalls.at(-1)},nodes=[...main.querySelectorAll('[data-benchmark]')],markerBits=nodes.map(e=>e.classList.contains('q-v8-text-floor')?'1':'0').join(''),fonts=nodes.map(e=>Number.parseFloat(getComputedStyle(e).fontSize)),rectangles=nodes.map(e=>e.getClientRects().length);
   return{pattern,repetition,nodes:480,markerBits,fonts,rectangles,call};
  },{pattern,repetition});
  assert.equal(measured.call.floorClassAdds,[...measured.markerBits].filter(c=>c==='1').length);assert.equal(measured.call.canvasMetricReads,0);benchmarks.push(measured);
 }
 const probe=await page.evaluate(()=>{const p=window.__QELLY_NOV10_FONT_FIRST_MECHANISM__;p.stop();return JSON.parse(JSON.stringify(p,(key,value)=>key==='frameRequest'?undefined:value));});
 assert.equal(probe.floorCalls.length,10);assert.ok(probe.floorCalls.every(c=>c.canvasMetricReads===0));assert.equal(probe.droppedEvents,0);
 return{canary,before,initial,shown,dynamic,stable,image,benchmarks,probe,actualSourceFloorFunction:true,mainWritesSyntheticOnly:true,networkProtectedWritesSent:0,benchmarkBoundary:'Six fresh480-node synthetic DOM passes per execution with six font sizes and two visibility mixes; operation counts are causal within this controlled fixture. Elapsed floor samples include identical probe overhead and exclude deferred class-layout/paint work; no end-user latency inference.'};
}
