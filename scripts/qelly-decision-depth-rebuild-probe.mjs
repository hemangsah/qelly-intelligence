import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{buildDecisionIntelligence}from'../functions/api/v1/decision-proven-graph.js';import{decisionAssetCapabilities}from'../functions/_lib/decision-asset-capabilities.js';
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
const fixtureDecisionPayload=async(requestUrl)=>{
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


import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {startServer}=await import(pathToFileURL(process.cwd()+'/scripts/release-a5-evidence-server.mjs'));
const sourceSha=process.env.QELLY_SCREEN_EVIDENCE_SHA;
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(sourceSha,'fe6096d9778b64077d2a14b39d46bc58a04c7d66');
const out='preview/decision-depth-rebuild-probe';await mkdir(out,{recursive:true});
const source=await readFile('apps/web/public/assets/qelly-production-shell.mjs','utf8'),built=await readFile('dist/frontend/assets/qelly-production-shell.mjs','utf8');
const start=source.indexOf('function applyAccessibilityFloor(){'),end=source.indexOf('\nfunction annotateRoute(){',start);assert.ok(start>=0&&end>start);
const floor=source.slice(start,end).trim(),open=floor.indexOf('{')+1,close=floor.lastIndexOf('}');assert.ok(built.includes(floor),'The actual built floor must match the selected current-source helper.');
const instrumented=floor.slice(0,open)+'const __p=window.__QELLY_DEPTH_PROBE__;__p.insideFloor++;if(__p.measuring)__p.floorCalls++;try{'+floor.slice(open,close)+'}finally{__p.insideFloor--;}'+floor.slice(close);
const floorSha256=createHash('sha256').update(floor).digest('hex'),bodySha256=createHash('sha256').update(floor.slice(open,close)).digest('hex');
const server=await startServer({port:0,host:'127.0.0.1'}),site='http://127.0.0.1:'+server.port,browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[],fixtureCache=new Map();let active,fatalError;
const metrics=async cdp=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item=>[item.name,item.value]));
const metricKeys=['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'];
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function settle(page){await page.evaluate(()=>new Promise(resolve=>{let previous=-1,stable=0,frames=0;const frame=()=>{const current=window.__QELLY_DEPTH_PROBE__.floorCalls;if(current===previous)stable++;else stable=0;previous=current;if(stable>=4||++frames>=40)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));}
async function beforeSnapshot(page){return page.evaluate(()=>{
 const main=document.querySelector('#main'),root=main.querySelector('.q-dpg-page'),chart=main.querySelector('.q-dpg-chart-wrap'),markers=[...main.querySelectorAll('.q-v8-text-floor')],chartMarkers=[...chart.querySelectorAll('.q-v8-text-floor')],nodes=[...main.querySelectorAll('*')],svg=chart.querySelector('[data-dpg-chart]');
 window.__QELLY_DEPTH_PROBE__.before={root,chart,markers,chartMarkers,nodes};
 return {mode:root.dataset.dpgDepth,markers:markers.length,chartMarkers:chartMarkers.length,nodes:nodes.length,chartNodes:chart.querySelectorAll('*').length,chart:{viewBox:svg.getAttribute('viewBox'),count:svg.dataset.count,paths:[...svg.querySelectorAll('path')].map(path=>path.getAttribute('d')),rects:[...svg.querySelectorAll('rect')].map(rect=>['x','y','width','height'].map(name=>rect.getAttribute(name)))}};
});}
async function afterSnapshot(page){return page.evaluate(()=>{
 const p=window.__QELLY_DEPTH_PROBE__,main=document.querySelector('#main'),root=main.querySelector('.q-dpg-page'),chart=main.querySelector('.q-dpg-chart-wrap'),svg=chart.querySelector('[data-dpg-chart]'),markers=[...main.querySelectorAll('.q-v8-text-floor')];
 return {mode:root.dataset.dpgDepth,rootIdentityPreserved:root===p.before.root,chartIdentityPreserved:chart===p.before.chart,lostWarmMarkers:p.before.markers.filter(node=>!node.isConnected).length,lostChartWarmMarkers:p.before.chartMarkers.filter(node=>!node.isConnected).length,removedOldNodes:p.before.nodes.filter(node=>!node.isConnected).length,markers:markers.length,newlyFlooredNodes:markers.filter(node=>!p.before.markers.includes(node)).length,nodes:main.querySelectorAll('*').length,chartNodes:chart.querySelectorAll('*').length,work:{floorCalls:p.floorCalls,rectangleReads:p.rectangleReads,fontStyleReads:p.fontStyleReads,mainReplacements:p.mainReplacements},chart:{viewBox:svg.getAttribute('viewBox'),count:svg.dataset.count,paths:[...svg.querySelectorAll('path')].map(path=>path.getAttribute('d')),rects:[...svg.querySelectorAll('rect')].map(rect=>['x','y','width','height'].map(name=>rect.getAttribute(name)))},overflow:document.documentElement.scrollWidth>innerWidth+1,focus:document.activeElement?.getAttribute('data-dpg-ui-mode')};
});}
try{
for(const appearance of ['dark','light'])for(const width of [1440,390])for(let repetition=1;repetition<=3;repetition++){
 const pairId=appearance+'-'+width+'-'+repetition,order=repetition%2?['same-depth-noop','depth-change']:['depth-change','same-depth-noop'];
 for(const arm of order){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),writes=[],externals=[],pageErrors=[];let shellReads=0;
  await context.addInitScript(appearance=>{
   localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance}));localStorage.removeItem('qelly.decision.ui-mode.v1');
   const probe=window.__QELLY_DEPTH_PROBE__={insideFloor:0,measuring:false,floorCalls:0,rectangleReads:0,fontStyleReads:0,mainReplacements:0};
   const rect=Element.prototype.getClientRects,style=window.getComputedStyle;
   Element.prototype.getClientRects=function(...args){if(probe.measuring&&probe.insideFloor>0)probe.rectangleReads++;return rect.apply(this,args);};
   window.getComputedStyle=function(...args){if(probe.measuring&&probe.insideFloor>0)probe.fontStyleReads++;return style.apply(this,args);};
  },appearance);
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push({method:request.method(),path:url.pathname});return route.abort();}if(url.origin!==site){externals.push(url.origin+url.pathname);return route.abort();}return route.continue();});
  await context.route('**/assets/qelly-production-shell.mjs*',async route=>{const response=await route.fetch(),text=await response.text();assert.ok(text.includes(floor));shellReads++;return route.fulfill({response,body:text.replace(floor,instrumented),contentType:'application/javascript'});});
  await context.route('**/api/v1/decision-assets*',route=>route.fulfill({json:decisionAssetCapabilities()}));
  await context.route('**/api/v1/decision-proven-graph?*',async route=>{const url=new URL(route.request().url()),key=url.search;if(!fixtureCache.has(key))fixtureCache.set(key,await fixtureDecisionPayload(url));return route.fulfill({json:fixtureCache.get(key)});});
  await context.route('**/api/v1/preferences/layout',async route=>{const response=await route.fetch();return route.fulfill({response,json:{...await response.json(),appearance}});});
  const page=active=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  await page.goto(site+'/#/decision-provenance',{waitUntil:'domcontentloaded'});await page.locator('.q-dpg-stage').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true'&&document.documentElement.dataset.productionShellReady==='true');
  await page.waitForFunction(appearance=>document.documentElement.dataset.resolvedAppearance===appearance,appearance);await page.evaluate(()=>document.fonts.ready);await page.locator('[data-dpg-ui-mode="simple"]').click();await settle(page);await page.waitForTimeout(300);
  const before=await beforeSnapshot(page);assert.equal(before.mode,'simple');
  const baselineMetrics=await metrics(cdp);
  await page.evaluate(()=>{const p=window.__QELLY_DEPTH_PROBE__;p.floorCalls=p.rectangleReads=p.fontStyleReads=p.mainReplacements=0;p.observer=new MutationObserver(records=>p.mainReplacements+=records.filter(record=>record.target===document.querySelector('#main')&&record.type==='childList').length);p.observer.observe(document.querySelector('#main'),{childList:true});p.measuring=true;});
  const target=arm==='depth-change'?'advanced':'simple';await page.locator('[data-dpg-ui-mode="'+target+'"]').click();await page.waitForFunction(mode=>document.querySelector('.q-dpg-page')?.dataset.dpgDepth===mode,target);await settle(page);
  await page.evaluate(()=>{const p=window.__QELLY_DEPTH_PROBE__;p.measuring=false;p.observer.disconnect();});const finalMetrics=await metrics(cdp),after=await afterSnapshot(page);
  assert.equal(finalMetrics.NavigationStart,baselineMetrics.NavigationStart);const delta=Object.fromEntries(metricKeys.map(key=>[key,finalMetrics[key]-baselineMetrics[key]]));assert.ok(Object.values(delta).every(value=>Number.isFinite(value)&&value>=0));
  assert.equal(digest(after.chart),digest(before.chart),'Common plot values and paths must remain identical across the depth-only action.');assert.equal(after.mode,target);assert.equal(after.overflow,false);assert.equal(writes.length,0);assert.equal(externals.length,0);assert.deepEqual(pageErrors,[]);assert.equal(shellReads,1);
  if(arm==='same-depth-noop'){assert.equal(after.rootIdentityPreserved,true);assert.equal(after.chartIdentityPreserved,true);assert.equal(after.lostWarmMarkers,0);assert.equal(after.work.mainReplacements,0);assert.equal(after.work.floorCalls,0);assert.equal(after.work.rectangleReads,0);assert.equal(after.work.fontStyleReads,0);}
  else{assert.equal(after.rootIdentityPreserved,false);assert.equal(after.chartIdentityPreserved,false);assert.equal(after.lostWarmMarkers,before.markers);assert.ok(after.work.mainReplacements>=1);assert.ok(after.work.floorCalls>=1);assert.ok(after.work.rectangleReads>0);assert.ok(after.work.fontStyleReads>0);}
  results.push({pairId,appearance,width,repetition,order,arm,sourceSha,before:{...before,chart:undefined,chartDigest:digest(before.chart)},after:{...after,chart:undefined,chartDigest:digest(after.chart)},metricsDelta:delta,protectedWrites:0,externalReads:0,actualSourceWithEntryExitCountersOnly:true,optimizationApplied:false,latencyMeasured:false});
  await context.unrouteAll({behavior:'wait'});await context.close();active=null;
 }
}
assert.equal(results.length,24);assert.equal(new Set(results.map(row=>row.pairId)).size,12);
}catch(error){fatalError={message:error.message,stack:error.stack,completedCases:results.length};await active?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{
 const report={status:!fatalError&&results.length===24?'passed':'failed',sourceSha,runnerSha:process.env.GITHUB_SHA,expectedCases:24,cases:results.length,pairedContexts:new Set(results.map(row=>row.pairId)).size,expectedPairedContexts:12,sourceFloorSha256:floorSha256,originalFloorBodySha256:bodySha256,actualFloorBodyUnchanged:true,sourceFixture:'Actual existing Decision engine fixture from the exact baseline source; intercepted synthetic read responses only.',results,fatalError,protectedWrites:0,productFilesChanged:false,optimizationApplied:false,causalOptimizationBenefitMeasured:false,inpMeasured:false,latencyMeasured:false,rawCpuProfilesCollected:false,boundary:'Mechanism probe: same-depth no-op control and real depth transition have different visible outcomes. Both use the actual current renderer and identical entry/exit-instrumented font-floor body. Marker identity and attributable read counts test rebuild mechanics; duration deltas include automation/observation and do not estimate a retained-DOM optimization or user latency.'};
 await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('QELLY_DEPTH_REBUILD_PROBE '+JSON.stringify({status:report.status,cases:report.cases,pairedContexts:report.pairedContexts,sourceSha,sourceFloorSha256:floorSha256,protectedWrites:0,optimizationApplied:false}));await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
