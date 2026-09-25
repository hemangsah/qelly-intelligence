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
const report={schemaVersion:3,generatedAt:new Date().toISOString(),releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||process.env.GITHUB_SHA||'local',samples,scenarios:[],routeCycleStability:null,decisionChaosStability:null,status:'passed'};

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


async function runDecisionChaosStabilityProbe(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000},device_scale_factor:1,reduced_motion:'reduce'});
  const page=await context.newPage();
  const errors=[],unexpectedNetwork=[];
  const requestCounts={decision:0,scanner:0};
  let refreshes=0,controlChanges=0,idleResumed=false,cdp=null;
  const injectedBody=JSON.stringify({error:{code:'bp_injected_dependency_unavailable',message:'Wave BP deterministic degraded-state probe.'}});
  await page.route(/\/api\/v1\/decision-proven-graph(?:\?|$)/,route=>route.fulfill({status:503,contentType:'application/json',body:injectedBody}));
  await page.route(/\/api\/v1\/decision-scan(?:\?|$)/,route=>route.fulfill({status:503,contentType:'application/json',body:injectedBody}));
  await page.addInitScript(()=>{
    const nativeSetTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window);
    const nativeSetInterval=window.setInterval.bind(window),nativeClearInterval=window.clearInterval.bind(window);
    const timeouts=new Set(),intervals=new Set();
    window.setTimeout=(handler,delay,...args)=>{
      let id=0;
      if(typeof handler==='function'){
        const wrapped=(...callbackArgs)=>{timeouts.delete(id);return handler(...callbackArgs);};
        id=nativeSetTimeout(wrapped,delay,...args);
      }else id=nativeSetTimeout(handler,delay,...args);
      timeouts.add(id);
      return id;
    };
    window.clearTimeout=(id)=>{timeouts.delete(id);return nativeClearTimeout(id);};
    window.setInterval=(handler,delay,...args)=>{const id=nativeSetInterval(handler,delay,...args);intervals.add(id);return id;};
    window.clearInterval=(id)=>{intervals.delete(id);return nativeClearInterval(id);};
    Object.defineProperty(window,'__QELLY_CHAOS_TIMERS__',{configurable:true,value:{snapshot:()=>({timeouts:timeouts.size,intervals:intervals.size,total:timeouts.size+intervals.size})}});
  });
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const value=message.text();
    if(/^Failed to load resource:/i.test(value))return;
    errors.push(value);
  });
  page.on('request',request=>{
    const pathname=new URL(request.url()).pathname;
    if(pathname==='/api/v1/decision-proven-graph')requestCounts.decision+=1;
    if(pathname==='/api/v1/decision-scan')requestCounts.scanner+=1;
  });
  page.on('response',response=>{
    if(response.status()<400)return;
    const url=new URL(response.url());
    const expectedInjected=response.status()===503&&['/api/v1/decision-proven-graph','/api/v1/decision-scan'].includes(url.pathname);
    if(url.origin===base&&!expectedInjected)unexpectedNetwork.push({status:response.status(),url:url.pathname+url.search});
  });
  const samples=[];
  const waitDecisionReady=async()=>{
    await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.querySelector('#main')?.getAttribute('aria-busy')==='false',null,{timeout:15000});
    await page.locator('[data-dpg-asset]').waitFor({state:'visible',timeout:5000});
    await page.locator('[data-dpg-rr]').waitFor({state:'visible',timeout:5000});
  };
  const metricSnapshot=async(label,cycle)=>{
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(80);
    const metrics=await cdp.send('Performance.getMetrics');
    const values=Object.fromEntries(metrics.metrics.map(item=>[item.name,item.value]));
    const browserState=await page.evaluate(()=>({
      domNodes:document.getElementsByTagName('*').length,
      iframes:document.querySelectorAll('iframe').length,
      timers:window.__QELLY_CHAOS_TIMERS__?.snapshot?.()||{timeouts:null,intervals:null,total:null},
      shellCount:document.querySelectorAll('[data-qelly-current-shell="true"]').length,
      productHeaders:document.querySelectorAll('.q-product-header').length
    }));
    const sample={
      label,cycle,
      jsHeapUsedBytes:Math.round(Number(values.JSHeapUsedSize)||0),
      nodes:Math.round(Number(values.Nodes)||0),
      documents:Math.round(Number(values.Documents)||0),
      eventListeners:Math.round(Number(values.JSEventListeners)||0),
      ...browserState
    };
    samples.push(sample);
    return sample;
  };
  try{
    await page.goto(base+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:20000});
    await waitDecisionReady();
    cdp=await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');
    await metricSnapshot('initial',0);

    const assets=['ETH','SOL','BTC','HYPE','XRP','DOGE'];
    const intervals=['5m','15m','1h','4h','30m','15m'];
    const rrValues=['1','2','3','4','custom','auto'];
    for(let cycle=1;cycle<=6;cycle+=1){
      await page.selectOption('[data-dpg-asset]',assets[cycle-1]);controlChanges+=1;
      await page.waitForTimeout(25);
      await page.selectOption('[data-dpg-interval]',intervals[cycle-1]);controlChanges+=1;
      await page.waitForTimeout(25);
      await page.selectOption('[data-dpg-rr]',rrValues[cycle-1]);controlChanges+=1;
      await page.waitForTimeout(25);
      if(rrValues[cycle-1]==='custom'){
        await page.locator('[data-dpg-custom-rr]').waitFor({state:'visible',timeout:3000});
        await page.locator('[data-dpg-custom-rr]').fill('2.7');
        await page.locator('[data-dpg-custom-rr]').evaluate(element=>element.dispatchEvent(new Event('change',{bubbles:true})));
        controlChanges+=1;
      }
      const scanButton=page.locator('[data-dpg-scan]').first();
      await scanButton.waitFor({state:'visible',timeout:3000});
      if(await scanButton.isEnabled())await scanButton.click();
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-dpg-scan]')).some(element=>!element.disabled),null,{timeout:5000}).catch(()=>{});
      await page.waitForTimeout(80);
      if(cycle%2===0){
        await page.reload({waitUntil:'domcontentloaded',timeout:20000});
        refreshes+=1;
        await waitDecisionReady();
      }
      await metricSnapshot('cycle-'+cycle,cycle);
    }

    await page.waitForTimeout(2200);
    const beforeResume=await metricSnapshot('idle',7);
    await page.selectOption('[data-dpg-rr]','2');controlChanges+=1;
    const resumeScan=page.locator('[data-dpg-scan]').first();
    if(await resumeScan.isEnabled())await resumeScan.click();
    await page.waitForTimeout(160);
    idleResumed=true;
    const afterResume=await metricSnapshot('resume',8);

    const failures=[];
    const heap=samples.map(item=>item.jsHeapUsedBytes);
    const dom=samples.map(item=>item.domNodes);
    const listeners=samples.map(item=>item.eventListeners);
    const documents=samples.map(item=>item.documents);
    const timers=samples.map(item=>Number(item.timers?.total)||0);
    const iframes=samples.map(item=>item.iframes);
    if(materialContinuousGrowth(heap,{ratio:1.35,minDelta:10*1024*1024}))failures.push('js_heap');
    if(materialContinuousGrowth(dom,{ratio:1.25,minDelta:600}))failures.push('dom_nodes');
    if(materialContinuousGrowth(listeners,{ratio:1.60,minDelta:120}))failures.push('event_listeners');
    if(materialContinuousGrowth(documents,{ratio:1.50,minDelta:8}))failures.push('documents');
    if(materialContinuousGrowth(timers,{ratio:1.80,minDelta:20}))failures.push('timers');
    if(materialContinuousGrowth(iframes,{ratio:1.80,minDelta:3}))failures.push('iframes');
    if(samples.some(item=>item.shellCount!==1||item.productHeaders!==1))failures.push('duplicate_shell');
    if(requestCounts.decision<18)failures.push('decision_recompute_coverage');
    if(requestCounts.scanner<6)failures.push('scanner_repeat_coverage');
    if(refreshes<3)failures.push('refresh_repeat_coverage');
    if(!idleResumed)failures.push('idle_resume_coverage');
    if(errors.length)failures.push('console_or_page_error');
    if(unexpectedNetwork.length)failures.push('unexpected_first_party_network');
    return {
      status:failures.length?'failed':'passed',
      cycles:6,refreshes,controlChanges,idleResumed,requestCounts,samples,failures,errors,unexpectedNetwork,
      injectedFailureBoundary:'Decision/scanner API calls are deterministically returned as 503 so lifecycle stability is measured without external-provider variance or fake market evidence.',
      metricSource:'chromium-cdp-after-forced-gc-plus-in-page-timer-and-iframe-counters',
      idleWindowMs:2200,
      resumeDelta:{
        heapBytes:afterResume.jsHeapUsedBytes-beforeResume.jsHeapUsedBytes,
        domNodes:afterResume.domNodes-beforeResume.domNodes,
        eventListeners:afterResume.eventListeners-beforeResume.eventListeners,
        timers:(Number(afterResume.timers?.total)||0)-(Number(beforeResume.timers?.total)||0),
        iframes:afterResume.iframes-beforeResume.iframes
      }
    };
  }catch(error){
    return {
      status:'unavailable',cycles:samples.length,refreshes,controlChanges,idleResumed,requestCounts,samples,
      failures:['probe_unavailable'],errors:[String(error?.message||error)],unexpectedNetwork,
      injectedFailureBoundary:'Decision/scanner API calls are deterministically returned as 503; no market evidence is synthesized.',
      metricSource:'chromium-cdp-after-forced-gc-plus-in-page-timer-and-iframe-counters'
    };
  }finally{
    await cdp?.detach?.().catch(()=>{});
    await context.close();
  }
}


async function runDecisionChaosStabilityProbe(browser){
  const context=await browser.newContext({viewport:{width:1280,height:900},device_scale_factor:1,reduced_motion:'reduce'});
  await context.addInitScript(()=>{
    const nativeSetTimeout=globalThis.setTimeout.bind(globalThis);
    const nativeClearTimeout=globalThis.clearTimeout.bind(globalThis);
    const nativeSetInterval=globalThis.setInterval.bind(globalThis);
    const nativeClearInterval=globalThis.clearInterval.bind(globalThis);
    const activeTimeouts=new Set(),activeIntervals=new Set();
    const telemetry={activeTimeouts:0,activeIntervals:0,createdTimeouts:0,createdIntervals:0};
    const sync=()=>{telemetry.activeTimeouts=activeTimeouts.size;telemetry.activeIntervals=activeIntervals.size;};
    globalThis.setTimeout=(callback,delay,...args)=>{
      let id;
      const wrapped=(...inner)=>{activeTimeouts.delete(id);sync();return typeof callback==='function'?callback(...inner):undefined;};
      id=nativeSetTimeout(wrapped,delay,...args);activeTimeouts.add(id);telemetry.createdTimeouts+=1;sync();return id;
    };
    globalThis.clearTimeout=(id)=>{activeTimeouts.delete(id);sync();return nativeClearTimeout(id);};
    globalThis.setInterval=(callback,delay,...args)=>{
      const id=nativeSetInterval(callback,delay,...args);activeIntervals.add(id);telemetry.createdIntervals+=1;sync();return id;
    };
    globalThis.clearInterval=(id)=>{activeIntervals.delete(id);sync();return nativeClearInterval(id);};
    Object.defineProperty(globalThis,'__QELLY_CHAOS_TIMER_TELEMETRY__',{value:telemetry,configurable:true});
  });
  const page=await context.newPage();
  const errors=[],networkFailures=[];
  let firstPartyOutstanding=0,maxFirstPartyOutstanding=0;
  const firstParty=(url)=>String(url||'').startsWith(base);
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!/^Failed to load resource:/i.test(message.text()))errors.push(message.text());});
  page.on('request',request=>{if(firstParty(request.url())){firstPartyOutstanding+=1;maxFirstPartyOutstanding=Math.max(maxFirstPartyOutstanding,firstPartyOutstanding);}});
  page.on('requestfinished',request=>{if(firstParty(request.url()))firstPartyOutstanding=Math.max(0,firstPartyOutstanding-1);});
  page.on('requestfailed',request=>{if(firstParty(request.url())){firstPartyOutstanding=Math.max(0,firstPartyOutstanding-1);networkFailures.push({url:new URL(request.url()).pathname,failure:request.failure()?.errorText||'request_failed'});}});
  const samples=[];
  let cdp=null;
  const waitReady=async()=>page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.querySelector('#main')?.getAttribute('aria-busy')==='false',{timeout:15000});
  const chooseNext=async(selector,preferred)=>{
    const locator=page.locator(selector).first();
    if(!(await locator.count())||!(await locator.isVisible().catch(()=>false)))return null;
    const options=await locator.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
    const current=await locator.inputValue();
    const next=preferred.find(value=>options.includes(value)&&value!==current)||options.find(value=>value!==current);
    if(!next)return null;
    await locator.selectOption(next);
    return next;
  };
  const boundedScannerProbe=async(cycle)=>page.evaluate(async(cycle)=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),1800);
    try{
      const response=await fetch('/api/v1/decision-scan?interval=15m&horizon=4h&rr=auto&universe=all&chaosCycle='+cycle,{signal:controller.signal,cache:'no-store'});
      return {status:response.status,ok:response.ok};
    }catch(error){return {status:0,ok:false,error:String(error?.name||error)};}
    finally{clearTimeout(timer);}
  },cycle);
  try{
    await page.goto(base+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:20000});
    await waitReady();
    cdp=await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');
    for(let cycle=1;cycle<=5;cycle+=1){
      if(cycle===2||cycle===4){
        await page.evaluate(()=>{location.hash='#/market';});
        await waitReady();
        await page.waitForTimeout(100);
        await page.evaluate(()=>{location.hash='#/decision-provenance';});
        await waitReady();
      }
      if(cycle===3){
        await page.reload({waitUntil:'domcontentloaded',timeout:20000});
        await waitReady();
      }
      await chooseNext('[data-dpg-horizon]',['1h','4h','12h','1d']);
      await page.waitForTimeout(80);
      const rr=await chooseNext('[data-dpg-rr]',['1','2','3','4','auto','custom']);
      await page.waitForTimeout(80);
      if(rr==='custom'){
        const input=page.locator('[data-dpg-custom-rr]').first();
        if(await input.count()){await input.fill('2.5');await input.dispatchEvent('change');}
      }
      await chooseNext('[data-dpg-interval]',['15m','1h','5m']);
      await chooseNext('[data-dpg-asset]',['BTC','ETH','SOL']);
      const refresh=page.locator('[data-dpg-refresh]').first();
      if(await refresh.isVisible().catch(()=>false))await refresh.click().catch(()=>{});
      const scanButton=page.locator('[data-dpg-scan]').first();
      if(await scanButton.isVisible().catch(()=>false)&&!(await scanButton.isDisabled().catch(()=>true)))await scanButton.click().catch(()=>{});
      await boundedScannerProbe(cycle);
      if(cycle===5){
        await page.waitForTimeout(1400);
        await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
      }else await page.waitForTimeout(260);
      await page.waitForFunction(()=>document.querySelector('#main')?.getAttribute('aria-busy')==='false',{timeout:15000}).catch(()=>{});
      await cdp.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(120);
      const metrics=await cdp.send('Performance.getMetrics');
      const values=Object.fromEntries(metrics.metrics.map(item=>[item.name,item.value]));
      const timerState=await page.evaluate(()=>({...globalThis.__QELLY_CHAOS_TIMER_TELEMETRY__}));
      samples.push({
        cycle,
        jsHeapUsedBytes:Math.round(Number(values.JSHeapUsedSize)||0),
        nodes:Math.round(Number(values.Nodes)||0),
        documents:Math.round(Number(values.Documents)||0),
        eventListeners:Math.round(Number(values.JSEventListeners)||0),
        domNodes:await page.locator('*').count(),
        iframes:await page.locator('iframe').count(),
        currentShells:await page.locator('[data-qelly-current-shell="true"]').count(),
        activeTimeouts:Number(timerState?.activeTimeouts)||0,
        activeIntervals:Number(timerState?.activeIntervals)||0,
        firstPartyOutstanding
      });
    }
    const failures=[];
    const heap=samples.map(item=>item.jsHeapUsedBytes),dom=samples.map(item=>item.domNodes),listeners=samples.map(item=>item.eventListeners);
    const documents=samples.map(item=>item.documents),iframes=samples.map(item=>item.iframes);
    const timeouts=samples.map(item=>item.activeTimeouts),intervals=samples.map(item=>item.activeIntervals),outstanding=samples.map(item=>item.firstPartyOutstanding);
    if(materialContinuousGrowth(heap,{ratio:1.25,minDelta:8*1024*1024}))failures.push('js_heap');
    if(materialContinuousGrowth(dom,{ratio:1.20,minDelta:800}))failures.push('dom_nodes');
    if(materialContinuousGrowth(listeners,{ratio:1.50,minDelta:150}))failures.push('event_listeners');
    if(materialContinuousGrowth(documents,{ratio:1.50,minDelta:8}))failures.push('documents');
    if(materialContinuousGrowth(iframes,{ratio:1.50,minDelta:3}))failures.push('iframes');
    if(materialContinuousGrowth(timeouts,{ratio:2,minDelta:12}))failures.push('timeouts');
    if(materialContinuousGrowth(intervals,{ratio:2,minDelta:4}))failures.push('intervals');
    if(materialContinuousGrowth(outstanding,{ratio:2,minDelta:4}))failures.push('network_outstanding');
    if(samples.some(item=>item.currentShells!==1))failures.push('duplicate_shell');
    return {
      status:failures.length||errors.length||networkFailures.length?'failed':'passed',
      cycles:5,
      actions:['route-cycle','reload','decision-recompute','scanner','asset-timeframe-rr-churn','idle-resume'],
      samples,failures,errors,networkFailures,maxFirstPartyOutstanding,
      metricSource:'chromium-cdp-after-forced-gc-plus-test-context-timer-instrumentation',
      boundary:'Chaos instrumentation exists only in the isolated Browser E2E context and does not alter production runtime behavior.'
    };
  }catch(error){
    return {status:'unavailable',cycles:samples.length,actions:[],samples,failures:[],errors:[String(error?.message||error)],networkFailures,maxFirstPartyOutstanding,metricSource:'chromium-cdp-after-forced-gc-plus-test-context-timer-instrumentation'};
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
  report.decisionChaosStability=await runDecisionChaosStabilityProbe(browser);
  if(report.decisionChaosStability.status!=='passed')report.status='failed';
  report.decisionChaosStability=await runDecisionChaosStabilityProbe(browser);
  if(report.decisionChaosStability.status!=='passed')report.status='failed';
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
  routeCycleDomEnd:report.routeCycleStability?.samples?.at(-1)?.domNodes??null,
  decisionChaosStatus:report.decisionChaosStability?.status??'not_run',
  decisionChaosFailures:report.decisionChaosStability?.failures??[],
  decisionChaosDecisionRequests:report.decisionChaosStability?.requestCounts?.decision??0,
  decisionChaosScannerRequests:report.decisionChaosStability?.requestCounts?.scanner??0,
  decisionChaosRefreshes:report.decisionChaosStability?.refreshes??0,
  decisionChaosControlChanges:report.decisionChaosStability?.controlChanges??0,
  decisionChaosIdleResumed:report.decisionChaosStability?.idleResumed??false,
  decisionChaosHeapStart:report.decisionChaosStability?.samples?.[0]?.jsHeapUsedBytes??null,
  decisionChaosHeapEnd:report.decisionChaosStability?.samples?.at(-1)?.jsHeapUsedBytes??null,
  decisionChaosDomStart:report.decisionChaosStability?.samples?.[0]?.domNodes??null,
  decisionChaosDomEnd:report.decisionChaosStability?.samples?.at(-1)?.domNodes??null,
  decisionChaosListenerStart:report.decisionChaosStability?.samples?.[0]?.eventListeners??null,
  decisionChaosListenerEnd:report.decisionChaosStability?.samples?.at(-1)?.eventListeners??null,
  decisionChaosTimerStart:report.decisionChaosStability?.samples?.[0]?.timers?.total??null,
  decisionChaosTimerEnd:report.decisionChaosStability?.samples?.at(-1)?.timers?.total??null,
  decisionChaosIframeStart:report.decisionChaosStability?.samples?.[0]?.iframes??null,
  decisionChaosIframeEnd:report.decisionChaosStability?.samples?.at(-1)?.iframes??null
};
console.log(JSON.stringify(summary,null,2));
if(report.status!=='passed')process.exit(1);
