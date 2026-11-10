import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {SOURCE_SHA,SOURCE_SHELL_SHA256,SOURCE_FILE_HASHES,hash,floorParts,instrumentShell,installProbe,summarizeIntervals,prepareFontFirstShell,validateFontFirstPng} from './nov10-floor-font-first-instrument.mjs';
import {decisionAssetCapabilities,fixtureDecisionPayload,fixtureNewsResponse,fontFirstFixtureHtml,runFontFirstEdges} from './nov10-floor-font-first-fixture.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true','Browser/dependency/build work is cloud-only');
assert.equal(process.env.QELLY_SCREEN_EVIDENCE_SHA,SOURCE_SHA);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),SOURCE_SHA);
const shellPath='apps/web/public/assets/qelly-production-shell.mjs';
const source=await readFile(shellPath,'utf8');assert.equal(hash(source),SOURCE_SHELL_SHA256,'Exact172 shell bytes required');
assert.equal(Object.keys(SOURCE_FILE_HASHES).length,7,'All selected product/engine/server source bindings required');
const verifiedSourceBindings={};
for(const [path,expected] of Object.entries(SOURCE_FILE_HASHES)){
  const bytes=await readFile(path);assert.equal(hash(bytes),expected.sha256,'Exact pinned source bytes: '+path);assert.equal(bytes.length,expected.bytes);
  verifiedSourceBindings[path]={...expected,checked:true};
}
const sourceFloor=floorParts(source).floor,built=await readFile('dist/frontend/assets/qelly-production-shell.mjs','utf8');
const reordered=prepareFontFirstShell(built);assert.equal(reordered.baselineFloor,sourceFloor);
const injections={'baseline-current':instrumentShell(built,sourceFloor),'font-first-candidate':instrumentShell(reordered.candidate,reordered.candidateFloor)};
const productBefore=execFileSync('git',['diff','--',...Object.keys(SOURCE_FILE_HASHES)],{encoding:'utf8'});assert.equal(productBefore,'');
const {startServer}=await import(pathToFileURL(process.cwd()+'/scripts/release-a5-evidence-server.mjs'));
const out='preview/nov10-floor-font-first';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),site='http://127.0.0.1:'+server.port;
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const images=[],results=[],fixtureCache=new Map(),fixtureNewsCache=new Map(),parity=new Map();let active,fatalError;
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let n=0;const next=()=>{if(++n===4)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);}));
const mark=(page,phase)=>page.evaluate(phase=>window.__QELLY_NOV10_FONT_FIRST_MECHANISM__.mark(phase),phase);
async function capture(page,file,target){
 const bytes=await(target?target.screenshot({path:out+'/'+file,animations:'disabled',caret:'hide'}):page.screenshot({path:out+'/'+file,animations:'disabled',caret:'hide'}));
 const decoded=validateFontFirstPng(bytes,{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});const row={file,bytes:bytes.length,sha256:hash(bytes),...decoded};images.push(row);return row;
}
async function ready(page){
  await page.locator('.q-dpg-stage').waitFor({timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.productionShellReady==='true');
  await page.evaluate(()=>document.fonts.ready);await frames(page);
}
async function snapshot(page,mode){
  return page.evaluate(mode=>{
    const main=document.querySelector('#main'),root=main.querySelector('.q-dpg-page'),svg=main.querySelector('[data-dpg-chart]'),tab=main.querySelector('#qelly-decision-tab-'+mode),panel=main.querySelector('#qelly-decision-panel-'+mode);
    const plot=svg?{viewBox:svg.getAttribute('viewBox'),count:svg.dataset.count,paths:[...svg.querySelectorAll('path')].map(n=>n.getAttribute('d')),rects:[...svg.querySelectorAll('rect')].map(n=>['x','y','width','height'].map(k=>n.getAttribute(k)))}:null;
    const small=[];for(const e of main.querySelectorAll('span,strong,small,b,em,code,progress,label,dt,dd,time,p,div,footer,header,summary,button,a')){if(e.children.length||e.closest('.sr-only,[aria-hidden="true"],script,style')||!e.textContent?.trim()||!e.getClientRects().length)continue;const size=Number.parseFloat(getComputedStyle(e).fontSize);if(Number.isFinite(size)&&size<12)small.push({tag:e.tagName,size,classes:e.className});}
    const fontFacts=[...main.querySelectorAll('span,strong,small,b,em,code,progress,label,dt,dd,time,p,div,footer,header,summary,button,a')].filter(e=>!e.children.length&&e.textContent?.trim()).map((e,index)=>{const style=getComputedStyle(e),r=e.getBoundingClientRect();return{index,tag:e.tagName,text:e.textContent.trim().slice(0,100),fontSize:Number.parseFloat(style.fontSize),floor:e.classList.contains('q-v8-text-floor'),rectangles:e.getClientRects().length,display:style.display,visibility:style.visibility,excluded:!!e.closest('.sr-only,[aria-hidden="true"],script,style'),rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*1000)/1000)};});
    return {fontFacts,mode:root?.dataset.dpgDepth,selected:tab?.getAttribute('aria-selected'),panelPresent:Boolean(panel),panelVisible:Boolean(panel&&!panel.hidden&&[...panel.children].some(e=>e.getBoundingClientRect().height>0)),viewText:main.querySelector('.q-dpg-view')?.textContent,plot,smallText:small,overflow:document.documentElement.scrollWidth>innerWidth+2,focus:document.activeElement?.getAttribute('data-dpg-ui-mode')};
  },mode);
}
async function mode(page,value,phase){
  await mark(page,phase);await page.locator('#qelly-decision-tab-'+value+'[role=tab]').click();
  await page.waitForFunction(value=>document.querySelector('.q-dpg-page')?.dataset.dpgDepth===value,value);await frames(page);
  await mark(page,phase+'-snapshot');const state=await snapshot(page,value);
  assert.equal(state.mode,value);assert.equal(state.selected,'true');assert.equal(state.panelVisible,true);assert.equal(state.smallText.length,0);assert.equal(state.overflow,false);return state;
}
try{
 for(const appearance of ['dark','light'])for(const width of [1440,390])for(let repetition=1;repetition<=3;repetition++){
  const pairId=appearance+'-'+width+'-'+repetition,order=repetition%2?['baseline-current','font-first-candidate']:['font-first-candidate','baseline-current'];
  for(const arm of order){
   const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:appearance,hasTouch:width===390,reducedMotion:'reduce',serviceWorkers:'block'}),writes=[],external=[],pageErrors=[],readErrors=[];let shellReads=0,decisionReads=0;
   // Both arms use identical counters and entry/exit instrumentation; only predicate order differs.
   // This is a source-body control for parity, not a pristine browser timing baseline.
   await context.addInitScript(installProbe,{appearance});
   // One handler is the write/network boundary; only synthetic read responses are supplied.
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(!['GET','HEAD','OPTIONS'].includes(request.method())){writes.push({method:request.method(),path:url.pathname,outcome:'aborted before network'});return route.abort();}
    if(url.origin!==site){external.push({origin:url.origin,path:url.pathname,outcome:'aborted before network'});return route.abort();}
    try{
     if(url.pathname==='/__floor-font-fixture__')return route.fulfill({contentType:'text/html',body:fontFirstFixtureHtml(appearance)});
     if(url.pathname==='/assets/qelly-production-shell.mjs'){
      const response=await route.fetch(),original=await response.text();assert.equal(original,built,'Response must equal exact selected built shell');shellReads++;
      return route.fulfill({response,body:injections[arm].instrumented,contentType:'application/javascript'});
     }
     if(url.pathname==='/api/v1/decision-assets'){await new Promise(resolve=>setTimeout(resolve,120));return route.fulfill({json:decisionAssetCapabilities()});}
     if(url.pathname==='/api/v1/decision-proven-graph'){
      decisionReads++;const key=url.search;if(!fixtureCache.has(key))fixtureCache.set(key,await fixtureDecisionPayload(url));
      // Bounded synthetic read latency makes loading observable; no production API changes.
      await new Promise(resolve=>setTimeout(resolve,180));return route.fulfill({json:fixtureCache.get(key)});
     }
     if(url.pathname==='/api/v1/decision-news-context'){
      if(!fixtureNewsCache.has(url.search)){const response=await fixtureNewsResponse(url);assert.equal(response.status,200);fixtureNewsCache.set(url.search,{status:response.status,body:await response.text()});}
      await new Promise(resolve=>setTimeout(resolve,60));return route.fulfill({...fixtureNewsCache.get(url.search),contentType:'application/json'});
     }
     if(url.pathname==='/api/v1/preferences/layout'){
      const response=await route.fetch();return route.fulfill({response,json:{...await response.json(),appearance}});
     }
     return route.continue();
    }catch(error){readErrors.push({path:url.pathname,message:error.message});return route.abort();}
   });
   const page=active=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
   await page.goto(site+'/#/decision-provenance',{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('.q-dpg-state[data-qelly-startup-feedback="true"]').first().waitFor({state:'visible',timeout:10000});
   const initialLoadingObserved=true;
   await ready(page);assert.equal(await page.evaluate(()=>document.documentElement.dataset.resolvedAppearance),appearance);
   const states=[],representative=[];let stateIndex=0;for(const value of ['simple','advanced','research','simple']){states.push(await mode(page,value,'ready-mode-'+value));if(repetition===1&&stateIndex<3){representative.push({...await capture(page,pairId+'-'+arm+'-'+value+'-viewport.png'),kind:'viewport',mode:value});representative.push({...await capture(page,pairId+'-'+arm+'-'+value+'-chart.png',page.locator('.q-dpg-stage')),kind:'chart',mode:value});}stateIndex++;}
   await mark(page,'resize');await page.setViewportSize({width:width===390?430:1280,height:width===390?740:720});await frames(page);
   const resized=await snapshot(page,'simple');assert.equal(resized.smallText.length,0);assert.equal(resized.overflow,false);
   await page.setViewportSize({width,height:width===390?844:900});await frames(page);
   await mark(page,'rapid-mode-actions');
   await page.evaluate(()=>new Promise(resolve=>{const values=['advanced','research','simple'];let i=0;const next=()=>{document.querySelector('#qelly-decision-tab-'+values[i++])?.click();if(i<values.length)setTimeout(next,0);else resolve();};next();}));
   await frames(page);assert.equal(await page.locator('#qelly-decision-tab-simple').getAttribute('aria-selected'),'true');
   await mark(page,'rapid-route-actions');
   await page.evaluate(()=>new Promise(resolve=>{const routes=['about-qelly','decision-provenance','about-qelly','decision-provenance'];let i=0;const next=()=>{location.hash='#/'+routes[i++];if(i<routes.length)setTimeout(next,20);else resolve();};next();}));
   await ready(page);await frames(page);
   // Headless tabs may remain visible. Never equate bringToFront with hidden-tab coverage.
   await mark(page,'background-feasibility');const front=await context.newPage();await front.goto('about:blank');await front.bringToFront();
   await page.waitForTimeout(250);const visibility=await page.evaluate(()=>document.visibilityState);
   let background={status:'unsupported-in-this-headless-context',observedVisibility:visibility,syntheticVisibilityOverride:false,boundedWaitMs:250};
   if(visibility==='hidden'){
    await page.evaluate(()=>document.querySelector('#qelly-decision-tab-advanced')?.click());await page.waitForTimeout(250);
    background={status:'actual-hidden-state-observed',observedVisibility:visibility,modeActionSynthetic:true,syntheticVisibilityOverride:false,boundedWaitMs:500};
   }
   await page.bringToFront();await front.close();await frames(page);await mark(page,'final');
   const probe=await page.evaluate(()=>{const p=window.__QELLY_NOV10_FONT_FIRST_MECHANISM__;p.stop();return JSON.parse(JSON.stringify(p,(key,value)=>key==='frameRequest'?undefined:value));});
   assert.equal(probe.droppedEvents,0);assert.ok(probe.events.some(row=>row.kind==='main-innerHTML-after'));assert.ok(shellReads>=1);assert.ok(decisionReads>=1);assert.deepEqual(readErrors,[]);assert.deepEqual(pageErrors,[]);
   assert.ok(probe.floorCalls.length>0);assert.ok(probe.floorCalls.every(call=>Number.isFinite(call.end)&&call.canvasMetricReads===0));
   const fixturePage=await context.newPage();const edge=await runFontFirstEdges(fixturePage,{site,appearance,floorSource:floorParts(injections[arm].instrumented).floor,capture,file:repetition===1?pairId+'-'+arm+'-fixture.png':null});await fixturePage.close();
   const parityValue=states.map(state=>({mode:state.mode,selected:state.selected,panelVisible:state.panelVisible,viewText:state.viewText,plot:state.plot,fontFacts:state.fontFacts})),parityDigest=hash(JSON.stringify(parityValue));
   if(parity.has(pairId))assert.equal(parityDigest,parity.get(pairId),'Instrumentation/control chart and view parity');else parity.set(pairId,parityDigest);
   const row={pairId,arm,appearance,width,repetition,order,sourceSha:SOURCE_SHA,initialLoadingObserved,states:states.map(({plot,...state})=>({...state,plotDigest:hash(JSON.stringify(plot))})),resized:{smallText:resized.smallText,overflow:resized.overflow},background,sourceBinding:injections[arm].receipt,reorderSource:reordered.receipt,representative,edge,probe,summary:summarizeIntervals(probe),parityDigest,blockedWriteAttempts:writes,protectedWritesSent:0,blockedExternalRequests:external,pageErrors,readErrors,shellReads,decisionReads};
   results.push(row);await writeFile(out+'/'+pairId+'-'+arm+'.json',JSON.stringify(row,null,2)+'\n');await context.unrouteAll({behavior:'wait'});await context.close();active=null;
  }
 }
 assert.equal(results.length,24);assert.equal(images.length,56);
 for(const key of new Set(results.map(r=>r.pairId))){const pair=results.filter(r=>r.pairId===key);assert.equal(pair.length,2);const [a,b]=pair;
  for(const field of ['before','initial','shown','dynamic','stable','canary'])assert.deepEqual(a.edge[field],b.edge[field],'Synthetic visibility/marker/font parity '+key+' '+field);
  assert.deepEqual(a.edge.benchmarks.map(({call,...facts})=>facts),b.edge.benchmarks.map(({call,...facts})=>facts),'Synthetic benchmark final marker/font/visibility parity '+key);
  assert.deepEqual(a.states,b.states,'All stored observed chart/view/font/geometry facts '+key);
  for(const image of a.representative){const other=b.representative.find(x=>x.kind===image.kind&&x.mode===image.mode);assert.ok(other);assert.equal(image.pixelSha256,other.pixelSha256,'Representative decoded pixel identity '+key+' '+image.kind+' '+image.mode);}
  if(a.edge.image)assert.equal(a.edge.image.pixelSha256,b.edge.image.pixelSha256,'Fixture decoded pixel identity '+key);
 }
}catch(error){fatalError={message:error.message,stack:error.stack,completedExecutions:results.length};await active?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{
 const productDiff=execFileSync('git',['diff','--',...Object.keys(SOURCE_FILE_HASHES)],{encoding:'utf8'});assert.equal(productDiff,'','No selected product, engine or evidence-server source mutation permitted');
 const summary={status:!fatalError&&results.length===24?'passed':'failed',sourceSha:SOURCE_SHA,runnerSha:process.env.GITHUB_SHA,sourceShellSha256:hash(source),sourceBinding:{baseline:injections['baseline-current'].receipt,candidate:injections['font-first-candidate'].receipt},reorderSource:reordered.receipt,images,expectedExecutions:24,executions:results.length,pairedContexts:parity.size,expectedPairedContexts:12,modeSnapshotCount:results.reduce((n,row)=>n+row.states.length,0),initialLoadingObservedExecutions:results.filter(row=>row.initialLoadingObserved).length,backgroundCoverage:results.map(row=>({pairId:row.pairId,arm:row.arm,...row.background})),mechanisms:results.filter(row=>row.summary).map(row=>({pairId:row.pairId,arm:row.arm,...row.summary})),blockedWriteAttempts:results.reduce((n,row)=>n+row.blockedWriteAttempts.length,0),protectedWritesSent:0,productFilesChanged:false,productionOptimizationApplied:false,experimentalResponseOptimizationApplied:true,causalOptimizationBenefitMeasured:false,inpMeasured:false,endUserLatencyMeasured:false,rawCpuProfilesCollected:false,fatalError,coverageBoundary:'Exact-source local cloud fixture server; synthetic GET data generated by the existing pinned Decision engine. Initial loading has explicit120/180/60ms fixture read delays. Ready modes use actual Playwright clicks; rapid-mode/route and hidden-mode stress actions are synthetic and not trusted latency metrics. Background throttling is unsupported unless document.visibilityState actually became hidden. Instrument-only observer deliveries and rAF heartbeat intervals are not production observers or actual paints. Only the exact three-line eligibility predicate differs between baseline/candidate browser responses; production files remain unchanged. All source scheduling, selectors, class writes and thresholds stay unchanged. Hidden/shown/dynamic fixtures, all stored mode font/marker/geometry facts and representative decoded pixels must match. Bounded instrumented elapsed samples are not end-user latency or INP.'};
 Object.assign(summary,{verifiedSourceBindings,engineFixtureAdapterSha256:'726df6643d6673a28069c9d7fec95a189bbd71dc7d969baf96079a8283f3041f',sourceResponseOnlyExperiment:true,syntheticEdgeCasesPerExecution:4,representativeImages:56,decodedPixelParityRequired:true,controlBoundary:'Both arms install identical main-write/observer/rAF and operation counters, and both wrap the actual floor entry/exit. Only the candidate response reorders font eligibility before rectangle visibility. Probe overhead affects elapsed samples; this is not a pristine browser latency or INP baseline.',floorElapsedIncludesInstrumentationOverhead:true,pristineBrowserTimingBaseline:false,releaseAcceptanceClaimed:false});
 await writeFile(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');
 console.log('QELLY_NOV10_FONT_FIRST_MECHANISM '+JSON.stringify({status:summary.status,executions:summary.executions,sourceSha:SOURCE_SHA,productionOptimizationApplied:false,experimentalResponseOptimizationApplied:true,protectedWritesSent:0}));
 await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
