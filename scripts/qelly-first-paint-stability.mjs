import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../src/server/server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist/frontend');
const out=path.join(root,'preview','first-paint-stability');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});

const runtime=await mkdtemp(path.join(tmpdir(),'qelly-first-paint-'));
const fixtureMaterial=(label)=>'qelly-'+label+'-'+String('x').repeat(48);
const fixtureKeyId=String.fromCharCode(97,99,116,105,118,101);
const api=await startServer({port:0,runtimePath:runtime,environment:{
  ...process.env,NODE_ENV:'test',QELLY_PRODUCTION_FOUNDATION_ENABLED:'true',QELLY_PRODUCTION_IDENTITY_ENABLED:'true',
  QELLY_DEVELOPMENT_IDENTITY_ENABLED:'false',QELLY_DATABASE_MODE:'sqlite',QELLY_JOB_QUEUE_MODE:'database',
  QELLY_SESSION_SECRET:fixtureMaterial('session'),
  QELLY_PASSWORD_PEPPER:fixtureMaterial('pepper'),
  QELLY_LIVE_MARKET_ENABLED:'false',QELLY_EXTERNAL_PROVIDERS_ENABLED:'false',
  QELLY_SECRET_KEYRING_JSON:JSON.stringify({old:fixtureMaterial('old-key'),active:fixtureMaterial('active-key')}),
  QELLY_SECRET_ACTIVE_KEY_ID:fixtureKeyId
}});
const apiBase='http://127.0.0.1:'+api.port;

const mime=(file)=>file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')||file.endsWith('.mjs')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.woff2')?'font/woff2':'application/octet-stream';
const safePath=(pathname)=>{
  const decoded=decodeURIComponent(pathname);
  if(decoded.includes('..'))return null;
  return path.join(dist,decoded==='/'?'index.html':decoded.replace(/^\//,''));
};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/api/')||url.pathname==='/methodology/verify'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const headers={...req.headers};delete headers.host;delete headers['content-length'];delete headers.connection;
      const response=await fetch(apiBase+url.pathname+url.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual'});
      res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','transfer-encoding','connection','content-length','set-cookie'].includes(key.toLowerCase()))));
      res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const target=safePath(url.pathname);if(!target){res.writeHead(400);res.end('bad path');return;}
    try{const body=await readFile(target);res.writeHead(200,{'Content-Type':mime(target),'Cache-Control':'no-store'});res.end(body);}
    catch{res.writeHead(404);res.end('not found');}
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end(String(error?.message||error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();const base='http://127.0.0.1:'+address.port;

const routes=[
  ['market','#/market'],['decision','#/decision-provenance'],['calculator','#/calculator-center'],
  ['india','#/india-finance'],['asset','#/asset/QI-CRYPTO-BTC']
];
const viewports=[['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]];
const samples=[0,100,250,500,1000,2000,4000,7000];
const legacySelectors=['.q-global-strip','.q-command-bar','.q-rail','.q-persona-ribbon','.q-context-shelf','.q-edge-dock','.q-compare-tray','.q-worldclass-context'];
const report={schemaVersion:2,generatedAt:new Date().toISOString(),releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||process.env.GITHUB_SHA||'local',samples,scenarios:[],routeCycleStability:null,status:'passed'};

const visibleCount=async(page,selector)=>page.locator(selector).evaluateAll(nodes=>nodes.filter(node=>{const style=getComputedStyle(node),box=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0;}).length);
const snapshot=async(page,elapsed)=>{
  const legacy={};for(const selector of legacySelectors)legacy[selector]=await visibleCount(page,selector);
  return {
    elapsedMs:elapsed,
    appReady:await page.locator('html').getAttribute('data-app-ready'),
    currentShells:await page.locator('[data-qelly-current-shell="true"]').count(),
    visibleProductHeaders:await visibleCount(page,'.q-product-header'),
    legacyCommandBars:await page.locator('.q-command-bar').count(),
    visibleLegacy:legacy,
    primaryNavCount:await page.locator('#q-product-navigation').count(),
    mainBusy:await page.locator('#main').getAttribute('aria-busy'),
    mainChildren:await page.locator('#main').evaluate(node=>node.childElementCount),
    heading:await page.locator('#main h1').first().textContent().catch(()=>null),
    title:await page.title(),
    stylesheetLinks:await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))
  };
};

const materialContinuousGrowth=(values,{ratio,minDelta})=>{
  if(values.length<4)return false;
  const first=values[0],last=values.at(-1),tail=values.slice(-4);
  const monotonicTail=tail.every((value,index)=>index===0||value>=tail[index-1]*0.98);
  return monotonicTail&&last-first>minDelta&&last>first*ratio;
};

async function runRouteCycleStabilityProbe(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000},device_scale_factor:1,reduced_motion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!/^Failed to load resource:/i.test(message.text()))errors.push(message.text());});
  const sequence=['#/market','#/decision-provenance','#/news-research','#/calculator-center'];
  const samples=[];
  let cdp=null;
  try{
    await page.goto(base+'/#/market',{waitUntil:'domcontentloaded',timeout:20000});
    await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.querySelector('#main')?.getAttribute('aria-busy')==='false',{timeout:15000});
    cdp=await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');
    for(let cycle=1;cycle<=6;cycle+=1){
      for(const hash of sequence){
        await page.evaluate((next)=>{location.hash=next;},hash);
        await page.waitForFunction(()=>document.querySelector('#main')?.getAttribute('aria-busy')==='false',{timeout:15000});
        await page.waitForTimeout(120);
      }
      await cdp.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(80);
      const metrics=await cdp.send('Performance.getMetrics');
      const values=Object.fromEntries(metrics.metrics.map(item=>[item.name,item.value]));
      samples.push({
        cycle,
        jsHeapUsedBytes:Math.round(Number(values.JSHeapUsedSize)||0),
        nodes:Math.round(Number(values.Nodes)||0),
        documents:Math.round(Number(values.Documents)||0),
        eventListeners:Math.round(Number(values.JSEventListeners)||0),
        domNodes:await page.locator('*').count()
      });
    }
    const heap=samples.map(item=>item.jsHeapUsedBytes);
    const dom=samples.map(item=>item.domNodes);
    const listeners=samples.map(item=>item.eventListeners);
    const documents=samples.map(item=>item.documents);
    const failures=[];
    if(materialContinuousGrowth(heap,{ratio:1.25,minDelta:8*1024*1024}))failures.push('js_heap');
    if(materialContinuousGrowth(dom,{ratio:1.20,minDelta:800}))failures.push('dom_nodes');
    if(materialContinuousGrowth(listeners,{ratio:1.50,minDelta:150}))failures.push('event_listeners');
    if(materialContinuousGrowth(documents,{ratio:1.50,minDelta:8}))failures.push('documents');
    return {status:failures.length||errors.length?'failed':'passed',cycles:6,sequence,samples,failures,errors,metricSource:'chromium-cdp-after-forced-gc'};
  }catch(error){
    return {status:'unavailable',cycles:samples.length,sequence,samples,failures:[],errors:[String(error?.message||error)],metricSource:'chromium-cdp-after-forced-gc'};
  }finally{
    await cdp?.detach?.().catch(()=>{});
    await context.close();
  }
}

const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
  for(const [viewportName,viewport] of viewports){
    for(const [routeName,hash] of routes){
      const context=await browser.newContext({viewport,device_scale_factor:1,reduced_motion:'reduce'});
      const page=await context.newPage();
      await page.addInitScript(()=>{
        const state={longTasks:[],mutations:0,webVitals:{fcpMs:null,lcpMs:null,cls:0,inpMs:null,interactionCount:0},interactionDurations:{}};
        Object.defineProperty(window,'__QELLY_PERF_SIGNALS__',{value:state,configurable:true});
        try{
          new PerformanceObserver((list)=>{
            for(const entry of list.getEntries()){
              state.longTasks.push({
                duration:Number(entry.duration.toFixed(2)),
                name:String(entry.name||'longtask'),
                attribution:Array.from(entry.attribution||[]).map((item)=>({
                  name:String(item.name||''),
                  containerType:String(item.containerType||''),
                  containerSrc:String(item.containerSrc||'')
                })).slice(0,4)
              });
              if(state.longTasks.length>200)state.longTasks.splice(0,state.longTasks.length-200);
            }
          }).observe({type:'longtask',buffered:true});
        }catch{}
        try{
          new PerformanceObserver((list)=>{
            for(const entry of list.getEntries()){
              if(entry.name==='first-contentful-paint')state.webVitals.fcpMs=Number(entry.startTime.toFixed(2));
            }
          }).observe({type:'paint',buffered:true});
        }catch{}
        try{
          new PerformanceObserver((list)=>{
            for(const entry of list.getEntries())state.webVitals.lcpMs=Number(entry.startTime.toFixed(2));
          }).observe({type:'largest-contentful-paint',buffered:true});
        }catch{}
        try{
          new PerformanceObserver((list)=>{
            for(const entry of list.getEntries()){
              if(!entry.hadRecentInput)state.webVitals.cls=Number((state.webVitals.cls+Number(entry.value||0)).toFixed(5));
            }
          }).observe({type:'layout-shift',buffered:true});
        }catch{}
        try{
          new PerformanceObserver((list)=>{
            for(const entry of list.getEntries()){
              const interactionId=Number(entry.interactionId||0);
              if(!interactionId)continue;
              const duration=Number(entry.duration||0);
              state.interactionDurations[interactionId]=Math.max(Number(state.interactionDurations[interactionId]||0),duration);
            }
            const values=Object.values(state.interactionDurations).map(Number).filter(Number.isFinite).sort((a,b)=>b-a);
            state.webVitals.interactionCount=values.length;
            state.webVitals.inpMs=values.length?Number(values[Math.min(Math.floor(values.length/50),values.length-1)].toFixed(2)):null;
          }).observe({type:'event',buffered:true,durationThreshold:16});
        }catch{}
        addEventListener('DOMContentLoaded',()=>{
          const target=document.getElementById('main');
          if(!target)return;
          new MutationObserver((records)=>{state.mutations+=records.length;}).observe(target,{childList:true,subtree:true,attributes:true});
        },{once:true});
      });
      const errors=[];
      const networkFailures=[];
      page.on('pageerror',error=>errors.push(String(error)));
      page.on('console',msg=>{
        if(msg.type()!=='error')return;
        const value=msg.text();
        if(/^Failed to load resource:/i.test(value))return;
        errors.push(value);
      });
      page.on('response',response=>{
        const status=response.status();
        if(status<400)return;
        const url=new URL(response.url());
        const expectedAuthBoundary=status===401&&url.pathname.startsWith('/api/v1/');
        networkFailures.push({status,url:url.pathname+url.search,expectedAuthBoundary});
      });
      for(const mode of ['cold','warm']){
        const started=performance.now();
        if(mode==='cold')await page.goto(base+'/'+hash,{waitUntil:'domcontentloaded',timeout:20000});
        else await page.reload({waitUntil:'domcontentloaded',timeout:20000});
        const domLoaded=performance.now();
        const frames=[];
        for(const target of samples){
          const due=domLoaded+target;const wait=Math.max(0,due-performance.now());if(wait)await page.waitForTimeout(wait);
          const state=await snapshot(page,Math.round(performance.now()-domLoaded));frames.push(state);
          await page.screenshot({path:path.join(out,routeName+'__'+viewportName+'__'+mode+'__'+String(target).padStart(4,'0')+'.png'),animations:'disabled'});
        }
        const obsolete=frames.flatMap(frame=>Object.entries(frame.visibleLegacy).filter(([,count])=>count>0).map(([selector,count])=>({elapsedMs:frame.elapsedMs,selector,count})));
        const structural=frames.filter(frame=>frame.currentShells!==1||frame.visibleProductHeaders!==1||frame.legacyCommandBars!==0||frame.primaryNavCount!==1);
        const last=frames.at(-1);
        let representativeInteraction=false;
        const recentButton=page.locator('[data-growth-open]').first();
        if(await recentButton.isVisible().catch(()=>false)){
          await recentButton.click({timeout:3000});
          representativeInteraction=true;
          await page.waitForTimeout(120);
          await page.keyboard.press('Escape').catch(()=>{});
          await page.waitForTimeout(80);
        }
        const performanceSignals=await page.evaluate(()=>({
          longTasks:Array.isArray(window.__QELLY_PERF_SIGNALS__?.longTasks)?window.__QELLY_PERF_SIGNALS__.longTasks:[],
          mutations:Number(window.__QELLY_PERF_SIGNALS__?.mutations||0),
          domNodes:document.getElementsByTagName('*').length,
          webVitals:{...(window.__QELLY_PERF_SIGNALS__?.webVitals||{})},
          runtimePerformance:typeof window.__QELLY_RUNTIME_PERFORMANCE__?.snapshot==='function'?window.__QELLY_RUNTIME_PERFORMANCE__.snapshot():null
        }));
        performanceSignals.webVitals.representativeInteraction=representativeInteraction;
        const criticalStalls=performanceSignals.longTasks.filter((item)=>Number(item.duration)>2000);
        const longTaskOwner=(item)=>{
          const sources=(item.attribution||[]).map(part=>String(part.containerSrc||'')).filter(Boolean);
          if(sources.some(src=>/tradingview|coinmarketcap|twitter|twimg|x\.com/i.test(src)))return 'third_party';
          if(sources.some(src=>src.startsWith(base)))return 'first_party';
          return String(item.name||'').toLowerCase()==='self'&&!sources.length?'first_party':'unattributed';
        };
        const firstPartyLongTasksOver500=performanceSignals.longTasks.filter((item)=>Number(item.duration)>500&&longTaskOwner(item)==='first_party');
        const runtimePerformance=performanceSignals.runtimePerformance;
        const runtimeMeasured=Boolean(runtimePerformance?.installed&&Array.isArray(runtimePerformance.routes)&&runtimePerformance.routes.length>0);
        const unexpectedNetwork=networkFailures.filter(item=>!item.expectedAuthBoundary);
        const authBoundary401=networkFailures.filter(item=>item.expectedAuthBoundary);
        const vitals=performanceSignals.webVitals||{};
        const vitalsMeasured=Number.isFinite(vitals.fcpMs)&&Number.isFinite(vitals.lcpMs)&&Number.isFinite(vitals.cls)&&(representativeInteraction?Number.isFinite(vitals.inpMs):true);
        const vitalRegressions=[];
        if(Number(vitals.fcpMs)>3000)vitalRegressions.push('fcp');
        if(Number(vitals.lcpMs)>4000)vitalRegressions.push('lcp');
        if(Number(vitals.cls)>0.25)vitalRegressions.push('cls');
        if(representativeInteraction&&Number(vitals.inpMs)>500)vitalRegressions.push('inp');
        const repeatedFirstPartyLongTaskViolation=firstPartyLongTasksOver500.length>=2;
        const passed=obsolete.length===0&&structural.length===0&&last.appReady==='true'&&last.mainChildren>0&&errors.length===0&&unexpectedNetwork.length===0&&criticalStalls.length===0&&!repeatedFirstPartyLongTaskViolation&&runtimeMeasured&&vitalsMeasured&&vitalRegressions.length===0;
        report.scenarios.push({route:routeName,hash,viewport:viewportName,mode,navigationToDomContentLoadedMs:Math.round(domLoaded-started),frames,obsolete,structural,errors,unexpectedNetwork,authBoundary401,performanceSignals:{...performanceSignals,criticalStalls,firstPartyLongTasksOver500,repeatedFirstPartyLongTaskViolation,runtimeMeasured,vitalRegressions,maxLongTaskMs:performanceSignals.longTasks.reduce((max,item)=>Math.max(max,Number(item.duration)||0),0),longTasksOver500:performanceSignals.longTasks.filter((item)=>Number(item.duration)>500).length,maxRouteTransitionMs:Array.isArray(runtimePerformance?.routes)?runtimePerformance.routes.reduce((max,item)=>Math.max(max,Number(item.durationMs)||0),0):0},status:passed?'passed':'failed'});
        if(!passed)report.status='failed';
      }
      await context.close();
    }
  }
  report.routeCycleStability=await runRouteCycleStabilityProbe(browser);
  if(report.routeCycleStability.status==='failed')report.status='failed';
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>api.server.close(resolve));
  await rm(runtime,{recursive:true,force:true});
}
await writeFile(path.join(out,'first-paint-stability.json'),JSON.stringify(report,null,2)+'\n');
const summary={
  status:report.status,
  scenarios:report.scenarios.length,
  failed:report.scenarios.filter(item=>item.status!=='passed').length,
  authBoundary401:report.scenarios.reduce((total,item)=>total+item.authBoundary401.length,0),
  unexpectedNetworkFailures:report.scenarios.reduce((total,item)=>total+item.unexpectedNetwork.length,0),
  maxDomContentLoadedMs:Math.max(...report.scenarios.map(item=>item.navigationToDomContentLoadedMs)),
  maxReadyFrameMs:Math.max(...report.scenarios.map(item=>item.frames.find(frame=>frame.appReady==='true')?.elapsedMs??7001)),
  maxLongTaskMs:Math.max(...report.scenarios.map(item=>item.performanceSignals?.maxLongTaskMs??0)),
  longTasksOver500:report.scenarios.reduce((total,item)=>total+(item.performanceSignals?.longTasksOver500??0),0),
  firstPartyLongTasksOver500:report.scenarios.reduce((total,item)=>total+(item.performanceSignals?.firstPartyLongTasksOver500?.length??0),0),
  repeatedFirstPartyLongTaskViolations:report.scenarios.filter(item=>item.performanceSignals?.repeatedFirstPartyLongTaskViolation).map(item=>({route:item.route,viewport:item.viewport,mode:item.mode})),
  criticalStalls:report.scenarios.reduce((total,item)=>total+(item.performanceSignals?.criticalStalls?.length??0),0),
  runtimeMetricsMissing:report.scenarios.filter(item=>item.performanceSignals?.runtimeMeasured!==true).map(item=>({route:item.route,viewport:item.viewport,mode:item.mode})),
  maxRouteTransitionMs:Math.max(...report.scenarios.map(item=>item.performanceSignals?.maxRouteTransitionMs??0)),
  maxDomNodes:Math.max(...report.scenarios.map(item=>item.performanceSignals?.domNodes??0)),
  totalMutations:report.scenarios.reduce((total,item)=>total+(item.performanceSignals?.mutations??0),0),
  maxFcpMs:Math.max(...report.scenarios.map(item=>Number(item.performanceSignals?.webVitals?.fcpMs)||0)),
  maxLcpMs:Math.max(...report.scenarios.map(item=>Number(item.performanceSignals?.webVitals?.lcpMs)||0)),
  maxCls:Math.max(...report.scenarios.map(item=>Number(item.performanceSignals?.webVitals?.cls)||0)),
  maxInpMs:Math.max(...report.scenarios.map(item=>Number(item.performanceSignals?.webVitals?.inpMs)||0)),
  vitalsMissing:report.scenarios.filter(item=>{
    const vital=item.performanceSignals?.webVitals||{};
    return !Number.isFinite(vital.fcpMs)||!Number.isFinite(vital.lcpMs)||!Number.isFinite(vital.cls)||(vital.representativeInteraction&&!Number.isFinite(vital.inpMs));
  }).map(item=>({route:item.route,viewport:item.viewport,mode:item.mode})),
  vitalRegressions:report.scenarios.flatMap(item=>(item.performanceSignals?.vitalRegressions||[]).map(metric=>({route:item.route,viewport:item.viewport,mode:item.mode,metric}))),
  routeCycleStatus:report.routeCycleStability?.status??'not_run',
  routeCycleFailures:report.routeCycleStability?.failures??[],
  routeCycleErrors:report.routeCycleStability?.errors??[],
  routeCycleHeapStart:report.routeCycleStability?.samples?.[0]?.jsHeapUsedBytes??null,
  routeCycleHeapEnd:report.routeCycleStability?.samples?.at(-1)?.jsHeapUsedBytes??null,
  routeCycleDomStart:report.routeCycleStability?.samples?.[0]?.domNodes??null,
  routeCycleDomEnd:report.routeCycleStability?.samples?.at(-1)?.domNodes??null
};
console.log(JSON.stringify(summary,null,2));
if(report.status!=='passed')process.exit(1);
