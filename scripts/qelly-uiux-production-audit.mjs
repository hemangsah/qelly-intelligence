import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {routeDefinitions} from '../apps/web/public/assets/route-registry.mjs';
const site='https://terminal.qellyintelligence.com',sha=process.env.QELLY_UIUX_BASE_SHA;
const appearance=process.env.QELLY_UIUX_APPEARANCE,width=Number(process.env.QELLY_UIUX_WIDTH),out='uiux-audit';
assert.match(sha||'',/^[a-f0-9]{40}$/);assert.ok(['dark','light'].includes(appearance));assert.ok([390,1440].includes(width));
await mkdir(out,{recursive:true});
async function identity(){const r=await fetch(site+'/qelly-release.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/json/);assert.equal((await r.json()).releaseSha,sha);}
await identity();
const browser=await chromium.launch({headless:true});const results=[],ownership=new Map();
const blockedNonReadRequests=[];let protectedWritesAttempted=0,activeMode='setup';
try{
 for(const route of routeDefinitions){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:appearance,hasTouch:width===390,serviceWorkers:'block'});
  await context.route('**/*',async intercepted=>{
   const request=intercepted.request();
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){
    const destination=new URL(request.url()),protectedApi=destination.origin===site&&destination.pathname.startsWith('/api/');
    if(protectedApi)protectedWritesAttempted++;
    blockedNonReadRequests.push({route:route.route,mode:activeMode,method:request.method(),origin:destination.origin,pathname:destination.pathname,protectedApi,outcome:'aborted before network'});
    await intercepted.abort();
   }else await intercepted.continue();
  });
  await context.addInitScript(({appearance})=>{
   localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({appearance,themeFamily:'sovereign-obsidian',persona:'quant-operator'}));
   const observations={paint:[],lcp:null,shifts:[],longTasks:[],events:[],identities:[]};window.__QELLY_UIUX_BASELINE__=observations;
   for(const type of ['paint','largest-contentful-paint','layout-shift','longtask','event'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='paint')observations.paint.push({name:e.name,time:e.startTime});if(type==='largest-contentful-paint')observations.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)observations.shifts.push({time:e.startTime,value:e.value});if(type==='longtask')observations.longTasks.push({time:e.startTime,duration:e.duration});if(type==='event'&&e.interactionId)observations.events.push({id:e.interactionId,duration:e.duration});}}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});}catch{}
   document.addEventListener('DOMContentLoaded',()=>{const start=performance.now();const sample=()=>{observations.identities.push({time:performance.now(),appearance:document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance,title:document.querySelector('[data-q-product-page-title]')?.textContent||null,heading:document.querySelector('#main h1')?.textContent||null});if(performance.now()-start<2500)requestAnimationFrame(sample);};requestAnimationFrame(sample);},{once:true});
  },{appearance});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,300)));
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  for(const mode of ['cold','warm']){
   activeMode=mode;
   const row={route:route.route,label:route.label,section:route.section,public:route.public===true,hidden:route.hidden===true,appearance,width,mode,requestedUrl:site+'/#/'+route.route,baselineOnly:true,visualVerdict:'AWAITING HUMAN REVIEW',productionAcceptance:false};
   try{
    await identity();await page.coverage.startCSSCoverage();
    const response=mode==='cold'?await page.goto(row.requestedUrl,{waitUntil:'domcontentloaded',timeout:45000}):await page.reload({waitUntil:'domcontentloaded',timeout:45000});row.httpStatus=response?.status();
    await page.screenshot({path:out+'/'+route.route+'-'+mode+'-early.png'});
    try{await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.querySelector('#main')?.children.length>0,null,{timeout:15000});}catch{row.readinessTimeout=true;}
    await page.waitForTimeout(3000);
    const metrics=await cdp.send('Performance.getMetrics');row.chromiumMetrics=Object.fromEntries(metrics.metrics.filter(x=>['Nodes','JSEventListeners','JSHeapUsedSize','LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'].includes(x.name)).map(x=>[x.name,x.value]));
    row.observed=await page.evaluate(()=>{
     const main=document.querySelector('#main'),text=main?.innerText||'',root=document.documentElement;
     const bounds=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
     const nodes=[...(main?.querySelectorAll('*')||[])].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0);
     const decorated=nodes.filter(e=>{const s=getComputedStyle(e);return ['ARTICLE','SECTION'].includes(e.tagName)&&(parseFloat(s.borderTopWidth)>0||s.boxShadow!=='none')&&e.getBoundingClientRect().width>100;});
     const resources=performance.getEntriesByType('resource').map(e=>({url:e.name,type:e.initiatorType,duration:e.duration,transferBytes:e.transferSize,decodedBytes:e.decodedBodySize}));
     return {url:location.href,title:document.title,heading:main?.querySelector('h1')?.textContent,prepaintRoute:root.dataset.prepaintRoute,appearance:root.dataset.resolvedAppearance||root.dataset.appearance,appReady:root.dataset.appReady,overflow:document.documentElement.scrollWidth>innerWidth+2,domNodes:document.querySelectorAll('*').length,decoratedSections:decorated.length,boxlessScore:null,header:bounds(document.querySelector('.q-product-header')),search:bounds(document.querySelector('.q-product-search')),styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>e.href),scripts:[...document.scripts].map(e=>e.src).filter(Boolean),resources,fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),tokens:Object.fromEntries(['--q-accent','--q-canvas','--q-text','--q-chrome'].map(k=>[k,getComputedStyle(root).getPropertyValue(k).trim()])),smallMeaningfulText:nodes.filter(e=>e.children.length===0&&e.textContent.trim()&&parseFloat(getComputedStyle(e).fontSize)<11).slice(0,40).map(e=>({tag:e.tagName,text:e.textContent.slice(0,120),fontSize:getComputedStyle(e).fontSize})),visibleInternalLabels:text.match(/\b(?:Version\s+[123]|V5\.4|PR\s*#\s*\d+|Wave\s+[A-Z]{1,3}|SHA\s*[:=]?\s*[a-f0-9]{7,40})\b/gi)||[],baseline:window.__QELLY_UIUX_BASELINE__,privateBoundary:/sign in|authentication required|access denied/i.test(text)};
    });
    await page.keyboard.press('Tab');row.keyboardFocused=await page.evaluate(()=>({tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.slice(0,100)}));
    await page.screenshot({path:out+'/'+route.route+'-'+mode+'-settled.png',fullPage:true});
    const css=await page.coverage.stopCSSCoverage();row.cssCoverage=css.map(e=>({url:e.url,characters:e.text?.length??null,usedCharacters:e.ranges.reduce((n,r)=>n+r.end-r.start,0)}));
    for(const e of css){const key=e.url||'inline';const owner=ownership.get(key)||{asset:key,routesLoaded:[],selectorEstimate:(e.text?.match(/\{/g)||[]).length,importantDeclarations:(e.text?.match(/!important/g)||[]).length,bytes:e.text?Buffer.byteLength(e.text):null,specificity:'requires selector analysis',duplicateDeclarations:'not yet analysed',conflicts:'requires computed cascade inspection',replacementPlan:'unassigned'};if(!owner.routesLoaded.includes(route.route))owner.routesLoaded.push(route.route);ownership.set(key,owner);}
    row.errors=[...errors];row.status='CAPTURED';
   }catch(e){row.status='CAPTURE_FAILED';row.error=e.message;try{await page.coverage.stopCSSCoverage();}catch{}}
   results.push(row);await writeFile(out+'/QELLY_UIUX_ROUTE_OBSERVATIONS.json',JSON.stringify({sourceSha:sha,appearance,width,routeCount:routeDefinitions.length,protectedWritesAttempted,results},null,2)+'\n');
  }
  await context.close();
 }
 await identity();
}finally{await browser.close();}
const defects=results.flatMap(r=>[...(r.status==='CAPTURE_FAILED'?[{priority:'P0',kind:'capture failure',detail:r.error}]:[]),...(r.observed?.overflow?[{priority:'P1',kind:'overflow'}]:[]),...(r.observed?.visibleInternalLabels.length?[{priority:'P1',kind:'visible internal labels',detail:r.observed.visibleInternalLabels}]:[]),...(r.observed?.appearance!==appearance?[{priority:'P0',kind:'wrong appearance',detail:r.observed?.appearance}]:[])].map(d=>({...d,route:r.route,appearance,width,mode:r.mode,status:'observed; fix pending'})));
await writeFile(out+'/QELLY_UIUX_DEFECT_REGISTER.json',JSON.stringify({sourceSha:sha,defects},null,2)+'\n');
await writeFile(out+'/QELLY_UIUX_STYLE_OWNERSHIP.json',JSON.stringify({sourceSha:sha,coverageBoundary:'Observed load-time usage is not proof that rules are dead; hidden and interactive states remain unmeasured.',assets:[...ownership.values()]},null,2)+'\n');
await writeFile(out+'/QELLY_UIUX_PERFORMANCE_BASELINE.json',JSON.stringify({sourceSha:sha,boundary:'One cloud Chromium cold/warm sample per route and viewport; not population performance certification. CDP counters are cumulative per context; use before/after deltas for comparisons.',results:results.map(r=>({route:r.route,mode:r.mode,appearance,width,status:r.status,metrics:r.chromiumMetrics,baseline:r.observed?.baseline,resources:r.observed?.resources,domNodes:r.observed?.domNodes}))},null,2)+'\n');
await writeFile(out+'/QELLY_UIUX_THEME_MATRIX.json',JSON.stringify({sourceSha:sha,results:results.map(r=>({route:r.route,appearance,width,observed:r.observed?.appearance,tokens:r.observed?.tokens,visualVerdict:r.visualVerdict}))},null,2)+'\n');
for(const [file,key] of [['QELLY_UIUX_VERSION_LABEL_AUDIT.json','visibleInternalLabels'],['QELLY_UIUX_FIRST_PAINT_AUDIT.json','baseline']])await writeFile(out+'/'+file,JSON.stringify({sourceSha:sha,results:results.map(r=>({route:r.route,appearance,width,mode:r.mode,observed:r.observed?.[key],visualVerdict:r.visualVerdict}))},null,2)+'\n');
const columns=['route','label','section','public','appearance','width','mode','status','visualVerdict','productionAcceptance'];const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';await writeFile(out+'/QELLY_UIUX_ROUTE_AUDIT.csv',columns.join(',')+'\n'+results.map(r=>columns.map(k=>csv(r[k])).join(',')).join('\n')+'\n');
await writeFile(out+'/QELLY_UIUX_BLOCKED_REQUESTS.json',JSON.stringify({sourceSha:sha,appearance,width,blockedNonReadRequests,outgoingNonReadRequests:0,boundary:'All non-read requests were intercepted and aborted. Paths exclude queries and bodies. Protected API attempts fail this baseline gate.'},null,2)+'\n');
const receipt={sourceSha:sha,routeCount:routeDefinitions.length,appearance,width,cases:results.length,captured:results.filter(r=>r.status==='CAPTURED').length,defects: defects.length,blockedNonReadRequestCount:blockedNonReadRequests.length,protectedWritesAttempted,outgoingNonReadRequests:0,productionAcceptance:false,strictCompletionPercent:0,screenshotsKeptInCloud:true};await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));assert.equal(protectedWritesAttempted,0);assert.equal(receipt.captured,routeDefinitions.length*2);
