import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';const {startServer}=await import(pathToFileURL(process.cwd()+'/scripts/release-a5-evidence-server.mjs'));
const {buildDecisionIntelligence}=await import(pathToFileURL(process.cwd()+'/functions/api/v1/decision-proven-graph.js'));const {decisionAssetCapabilities}=await import(pathToFileURL(process.cwd()+'/functions/_lib/decision-asset-capabilities.js'));
const FIXTURE_INTERVAL_MS=Object.freeze({'1m':60_000,'3m':180_000,'5m':300_000,'15m':900_000,'30m':1_800_000,'1h':3_600_000,'2h':7_200_000,'4h':14_400_000,'8h':28_800_000,'12h':43_200_000,'1d':86_400_000});
const FIXTURE_ASSETS=Object.freeze(['BTC','ETH','SOL','HYPE','XRP','DOGE']);
const FIXTURE_BASE=Object.freeze({BTC:84_000,ETH:3_100,SOL:145,HYPE:42,XRP:2.6,DOGE:.22});
const fixtureNow=Date.parse('2026-11-02T15:00:00Z');
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


const source=process.env.QELLY_SCREEN_EVIDENCE_SHA,expected=process.env.QELLY_FONT_EXPECT,out='preview/decision-font-owner-pair';assert.equal(process.env.GITHUB_ACTIONS,'true');assert.match(source,/^[a-f0-9]{40}$/);assert.ok(['red','green'].includes(expected));await mkdir(out,{recursive:true});const hash=s=>createHash('sha256').update(s).digest('hex'),shell=await readFile('apps/web/public/assets/qelly-production-shell.mjs','utf8'),css=await readFile('apps/web/public/assets/qelly-decision-proven-graph.css','utf8');assert.equal(await readFile('dist/frontend/assets/qelly-production-shell.mjs','utf8'),shell);assert.equal(await readFile('dist/frontend/assets/qelly-decision-proven-graph.css','utf8'),css);let measured=shell;const patches=[['  const smallText=[];','  const smallText=[],probe=window.__QELLY_FONT_OWNER_PROBE__;probe.calls++;'],['  for(const element of textCandidates){','  probe.candidates+=textCandidates.length;\n  for(const element of textCandidates){'],['    const size=Number.parseFloat(getComputedStyle(element).fontSize);','    probe.fontReads++;\n    const size=Number.parseFloat(getComputedStyle(element).fontSize);'],["  for(const element of smallText)element.classList.add('q-v8-text-floor');","  for(const element of smallText)element.classList.add('q-v8-text-floor');\n  probe.classWrites+=smallText.length;"]];for(const[a,b]of patches){assert.equal(measured.split(a).length,2);measured=measured.replace(a,b);}let reversed=measured;for(const[a,b]of patches.slice().reverse())reversed=reversed.replace(b,a);assert.equal(reversed,shell);
const server=await startServer({port:0,host:'127.0.0.1'}),site='http://127.0.0.1:'+server.port,browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[],screenshots=[];let failure,activePage;try{for(const appearance of ['dark','light'])for(const width of [1280,390]){const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),writes=[],errors=[];activePage=page;page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(([appearance,fixtureNow])=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixtureNow]));}static now(){return fixtureNow;}};localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance}));window.__QELLY_FONT_OWNER_PROBE__={calls:0,candidates:0,fontReads:0,classWrites:0};},[appearance,fixtureNow]);await context.route('**/*',q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method())){writes.push({method:q.request().method(),path:new URL(q.request().url()).pathname});return q.abort();}return q.continue();});await context.route('**/api/v1/decision-assets*',q=>q.fulfill({json:decisionAssetCapabilities()}));await context.route('**/api/v1/decision-proven-graph?*',async q=>q.fulfill({json:await fixtureDecisionPayload(new URL(q.request().url()))}));for(const path of ['/api/v1/preferences/layout','/api/v1/user/layout-preferences'])await context.route(site+path+'*',async q=>{assert.equal(q.request().method(),'GET');const response=await q.fetch();return q.fulfill({response,json:{...await response.json(),appearance}});});let shellResponses=0;await context.route('**/assets/qelly-production-shell.mjs*',async q=>{const response=await q.fetch(),body=await response.text();assert.equal(body,shell);shellResponses++;return q.fulfill({response,body:measured});});
await page.goto(site+'/#/decision-provenance',{waitUntil:'domcontentloaded'});await page.locator('.q-dpg-page').waitFor();await page.locator('#main[aria-busy="false"]').waitFor({state:'visible'});await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);await page.locator('.qelly-opening').waitFor({state:'hidden'});await page.locator('.q-dpg-chart').waitFor({state:'visible'});await page.waitForTimeout(700);
for(const mode of ['simple','advanced','research']){await page.locator('#qelly-decision-tab-'+mode).click();await page.waitForFunction(m=>document.getElementById('qelly-decision-tab-'+m).getAttribute('aria-selected')==='true',mode);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const observation=await page.evaluate(()=>{const main=document.querySelector('#main'),elements=[...main.querySelectorAll('span,strong,small,b,em,code,progress,label,dt,dd,time,p,div,footer,header,summary,button,a')].filter(e=>!e.children.length&&e.textContent.trim()&&e.getClientRects().length),text=elements.map(e=>({text:e.textContent.trim(),tag:e.tagName,class:e.className,size:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}));return{appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,mainHeight:main.getBoundingClientRect().height,probe:{...window.__QELLY_FONT_OWNER_PROBE__},text,below12px:text.filter(e=>Number.parseFloat(e.size)<12),chartSvg:main.querySelector('.q-dpg-chart').outerHTML,heading:main.querySelector('h1').textContent,sourceDisclosureCount:main.querySelectorAll('details').length,methodPanelCount:main.querySelectorAll('[role="tabpanel"]').length};});assert.equal(observation.appearance,appearance);assert.equal(observation.width,width);assert.equal(observation.overflow,false);assert.equal(observation.heading,'Decision Intelligence');assert.ok(observation.probe.calls>0);assert.ok(observation.text.length>50);if(expected==='green')assert.equal(observation.below12px.length,0,'All measured visible HTML leaf text must meet12px in every green mode');const file=expected+'-'+appearance+'-'+width+'-'+mode+'.png';await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+file,fullPage:true});screenshots.push(file);await page.screenshot({path:out+'/'+expected+'-'+appearance+'-'+width+'-'+mode+'-top.png',fullPage:false});for(const [label,selector] of (mode==='simple'?[['chart','.q-dpg-stage'],['watch','.q-dpg-cf-watch'],['setup','.q-dpg-cf-setup'],['scenarios','.q-dpg-cf-scenarios']]:mode==='advanced'?[['weighting','.q-dpg-asset-class-weighting']]:[['slo','.q-dpg-slo']])){const target=page.locator(selector);assert.equal(await target.count(),1);await target.screenshot({path:out+'/'+expected+'-'+appearance+'-'+width+'-'+mode+'-'+label+'.png'});}results.push({appearance,width,mode,actualBuiltRoute:true,observation,textSha256:hash(JSON.stringify(observation.text.map(x=>x.text))),chartSha256:hash(observation.chartSvg),protectedWrites:writes.length,pageErrors:errors});}assert.equal(shellResponses,1);assert.equal(writes.length,0);assert.deepEqual(errors,[]);await context.close();activePage=null;}}
catch(error){failure=error.stack;process.exitCode=1;await activePage?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}finally{await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));const report={schema:'qelly.decision.font-owner/1.0',sourceSha:source,runnerSha:process.env.GITHUB_SHA,expected,status:!failure&&results.length===12?'passed':'failed',shellSha256:hash(shell),cssSha256:hash(css),sourceShellInstrumentedWithExactReversal:true,runtimeSafetyFloorRemoved:false,newProductObservers:0,numericalEnginesChanged:false,newProvidersEnabled:false,isolatedUiFixtures:true,existingDecisionFixtureReused:true,fixtureNow,fixtureClockFrozenInBothArms:true,realCanonicalServiceAvailabilityClaimed:false,latencyOrHeapClaimed:false,results,screenshots,failure};await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({source,expected,status:report.status,contexts:results.length,failure}));}
