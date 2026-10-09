import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const site='https://terminal.qellyintelligence.com',sha=process.env.QELLY_UIUX_BASE_SHA,appearance=process.env.QELLY_UIUX_APPEARANCE,width=Number(process.env.QELLY_UIUX_WIDTH),out='uiux-profile';
assert.match(sha||'',/^[a-f0-9]{40}$/);assert.ok(['dark','light'].includes(appearance));assert.ok([390,1440].includes(width));await mkdir(out,{recursive:true});
const identity=async()=>{const r=await fetch(site+'/qelly-release.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);assert.equal((await r.json()).releaseSha,sha);};
await identity();const browser=await chromium.launch({headless:true}),results=[],blocked=[];
const metrics=async cdp=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
const delta=(a,b)=>Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration'].map(k=>[k,b[k]-a[k]]));
const hot=profile=>{const counts=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const id=profile.samples[i];counts.set(id,(counts.get(id)||0)+(profile.timeDeltas?.[i]||0));}return profile.nodes.map(n=>({function:n.callFrame.functionName||'(anonymous)',url:n.callFrame.url,line:n.callFrame.lineNumber+1,selfSampleUs:counts.get(n.id)||0})).filter(x=>x.selfSampleUs>0).sort((a,b)=>b.selfSampleUs-a.selfSampleUs).slice(0,30);};
try{for(const route of['decision-provenance','dex-discovery','live-markets'])for(let repetition=1;repetition<=3;repetition++){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:appearance,hasTouch:width===390,serviceWorkers:'block'});
 await context.route('**/*',r=>{if(['GET','HEAD','OPTIONS'].includes(r.request().method()))return r.continue();const u=new URL(r.request().url());blocked.push({route,repetition,method:r.request().method(),origin:u.origin,path:u.pathname,outcome:'aborted before network'});return r.abort();});
 await context.addInitScript(({appearance})=>{localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({appearance,themeFamily:'sovereign-obsidian',persona:'quant-operator'}));window.__QELLY_PROFILE_LONGTASKS__=[];new PerformanceObserver(l=>window.__QELLY_PROFILE_LONGTASKS__.push(...l.getEntries().map(e=>({startTime:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});},{appearance});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,240)));const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});
 for(const mode of['cold','warm']){
  await identity();const row={route,repetition,mode,appearance,width,sourceSha:sha,phases:[]};
  const measure=async(name,action)=>{const before=await metrics(cdp);await cdp.send('Profiler.start');const start=Date.now();await action();const profile=(await cdp.send('Profiler.stop')).profile,after=await metrics(cdp);const item={name,wallMs:Date.now()-start,metricsDelta:delta(before,after),hotFunctions:hot(profile)};row.phases.push(item);await writeFile(`${out}/${route}-${appearance}-${width}-${repetition}-${mode}-${name}-cpu.json`,JSON.stringify(profile));};
  await measure('load',async()=>{if(mode==='cold')await page.goto(site+'/#/'+route,{waitUntil:'domcontentloaded',timeout:45000});else await page.reload({waitUntil:'domcontentloaded',timeout:45000});await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.querySelector('#main')?.children.length>0,null,{timeout:20000});await page.waitForTimeout(1500);});
  await measure('idle',async()=>{await page.waitForTimeout(2000);});
  if(route==='decision-provenance'){
   const tabs=page.getByRole('tab',{name:/^Advanced Evidence/});assert.equal(await tabs.count(),1);
   await measure('advanced-tab',async()=>{await tabs.click();await page.locator('#qelly-decision-panel-advanced').waitFor({state:'visible'});await page.waitForTimeout(500);});
   await measure('simple-tab',async()=>{await page.getByRole('tab',{name:/^Simple Answer/}).click();await page.locator('#qelly-decision-panel-simple').waitFor({state:'visible'});await page.waitForTimeout(500);});
  }else if(route==='dex-discovery'){
   const filter=page.getByRole('button',{name:/Reset filters/i});
   if(await filter.count()===1)await measure('reset-filters',async()=>{await filter.click();await page.waitForTimeout(500);});
   else row.interactionBoundary='No uniquely identified existing reset control; no guessed action performed';
  }
  row.observed=await page.evaluate(()=>({heading:document.querySelector('#main h1')?.textContent,appearance:document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance,domNodes:document.querySelectorAll('*').length,cssLinks:[...document.querySelectorAll('link[rel=stylesheet]')].length,longTasks:window.__QELLY_PROFILE_LONGTASKS__,fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),overflow:document.documentElement.scrollWidth>innerWidth+2}));row.errors=[...errors];results.push(row);await writeFile(out+'/measurements.json',JSON.stringify({sourceSha:sha,appearance,width,results,blocked},null,2));
 }
 await context.close();
}await identity();}finally{await browser.close();}
assert.equal(results.length,18);assert.ok(results.every(r=>r.observed.appearance===appearance));assert.ok(results.every(r=>r.errors.length===0));
const receipt={sourceSha:sha,runnerSha:process.env.GITHUB_SHA,appearance,width,samples:results.length,protectedWritesSent:0,blockedRequests:blocked.length,productionAcceptance:false,performanceImprovementProven:false,boundary:'Repeated actual-production load, idle and supported UI interactions with CPU sampling. Profiling adds overhead. Self samples and metric deltas identify candidates for further isolation; no causal improvement claim.'};await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
