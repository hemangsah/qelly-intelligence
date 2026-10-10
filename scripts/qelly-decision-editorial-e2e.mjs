import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{startServer}from'./release-a5-evidence-server.mjs';import{buildDecisionIntelligence}from'../functions/api/v1/decision-proven-graph.js';import{decisionAssetCapabilities}from'../functions/_lib/decision-asset-capabilities.js';
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


const out='preview/decision-editorial-e2e';await mkdir(out,{recursive:true});const server=await startServer({port:0,host:'127.0.0.1'}),browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}),results=[];let active;
try{for(const appearance of['dark','light'])for(const width of[1440,768,390,320]){const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});await context.addInitScript(a=>{localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a}));localStorage.removeItem('qelly.decision.ui-mode.v1');},appearance);let writes=0,latest;
await context.route('**/*',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){writes++;return r.abort();}return r.continue();});await context.route('**/api/v1/decision-assets*',r=>r.fulfill({json:decisionAssetCapabilities()}));await context.route('**/api/v1/decision-proven-graph?*',async r=>{latest=await fixtureDecisionPayload(new URL(r.request().url()));return r.fulfill({json:latest});});
await context.route('**/api/v1/preferences/layout',async r=>{const response=await r.fetch();await r.fulfill({response,json:{...await response.json(),appearance}});});
const page=active=await context.newPage();await page.goto(`http://127.0.0.1:${server.port}/#/decision-provenance`,{waitUntil:'domcontentloaded'});await page.locator('.q-dpg-stage').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);await page.locator('[data-dpg-ui-mode="simple"]').click();const states=[];
for(const mode of['simple','advanced','research']){await page.locator(`[data-dpg-ui-mode="${mode}"]`).click();await page.waitForFunction(m=>document.querySelector('.q-dpg-page')?.dataset.dpgDepth===m,mode);const snapshot=await page.locator('.q-dpg-page').evaluate(root=>{const chart=root.querySelector('.q-dpg-stage'),setup=root.querySelector('.q-dpg-cf-setup');return{depth:root.dataset.dpgDepth,overflow:document.documentElement.scrollWidth>innerWidth+1,chartTop:chart.getBoundingClientRect().top+scrollY,chartBeforeSetup:Boolean(chart.compareDocumentPosition(setup)&Node.DOCUMENT_POSITION_FOLLOWING),surfaces:[...root.querySelectorAll('section,article,aside,header,footer,details,summary,fieldset,button,input,select')].filter(e=>e.getBoundingClientRect().height&&e.getBoundingClientRect().width).map(e=>{const s=getComputedStyle(e);return{class:e.className,borders:['Top','Right','Bottom','Left'].map(k=>s['border'+k+'Width']),radius:s.borderRadius,shadow:s.boxShadow};})};});assert.equal(snapshot.overflow,false);assert.equal(snapshot.chartBeforeSetup,true);assert.ok(snapshot.surfaces.length>20);for(const s of snapshot.surfaces){assert.deepEqual(s.borders,['0px','0px','0px','0px'],s.class);assert.equal(s.radius,'0px',s.class);assert.equal(s.shadow,'none',s.class);}assert.equal(await page.locator('.q-dpg-view h2').first().innerText(),latest.qellyView.action);if(width<=480){const actions=await page.locator('.q-dpg-hero__actions').evaluate(node=>({height:node.getBoundingClientRect().height,buttons:[...node.querySelectorAll('button')].map(e=>({x:e.getBoundingClientRect().left,y:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)}))}));assert.equal(actions.buttons.length,8);assert.ok(actions.height<=280,'Mobile hero action stack must remain compact');assert.ok(Math.abs(actions.buttons[0].y-actions.buttons[1].y)<1&&actions.buttons[1].x>actions.buttons[0].x,'Two accessible mobile action columns');for(const b of actions.buttons)assert.ok(b.height>=44&&b.font>=14);snapshot.mobileHeroActions=actions;}if(mode==='simple')assert.ok(snapshot.chartTop<(width<620?4000:2500),'Retail chart density: '+snapshot.chartTop);await page.locator(`[data-dpg-ui-mode="${mode}"]`).focus();const focus=await page.evaluate(()=>({outline:parseFloat(getComputedStyle(document.activeElement).outlineWidth),height:document.activeElement.getBoundingClientRect().height}));assert.ok(focus.outline>=2&&focus.height>=44);states.push({mode,...snapshot,focus});await page.screenshot({path:`${out}/${appearance}-${width}-${mode}.png`});}
// Preserve explicit source failure while exposing feedback before the long research header.
await context.route('**/api/v1/decision-proven-graph?*',r=>r.fulfill({status:429,json:{error:'Controlled rate-limit failure for presentation verification'}}));await page.locator('[data-dpg-interval]').selectOption('1h');await page.locator('.q-dpg-state--error').waitFor();const failure=await page.locator('.q-dpg-page').evaluate(root=>{const alert=root.querySelector('.q-dpg-state--error'),hero=root.querySelector('.q-dpg-hero'),r=alert.getBoundingClientRect();return{top:r.top,bottom:r.bottom,beforeHero:Boolean(alert.compareDocumentPosition(hero)&Node.DOCUMENT_POSITION_FOLLOWING),role:alert.getAttribute('role'),overflow:document.documentElement.scrollWidth>innerWidth+1};});assert.equal(failure.beforeHero,true);assert.equal(failure.role,'alert');assert.equal(await page.locator('.q-dpg-state--error').getAttribute('tabindex'),'-1');await page.waitForFunction(()=>document.activeElement?.matches('.q-dpg-state--error'));assert.ok(failure.bottom<=900,'Failure feedback must remain fully visible: '+failure.bottom);assert.equal(failure.overflow,false);assert.ok(failure.top>=0&&failure.top<900,'Failure feedback must appear in first viewport: '+failure.top);assert.equal(await page.locator('.q-dpg-state--error [data-dpg-refresh]').innerText(),'Try again');await page.screenshot({path:out+'/'+appearance+'-'+width+'-unavailable.png'});await context.route('**/api/v1/decision-proven-graph?*',async r=>{latest=await fixtureDecisionPayload(new URL(r.request().url()));return r.fulfill({json:latest});});await page.locator('.q-dpg-state--error [data-dpg-refresh]').click();await page.locator('.q-dpg-stage').waitFor();await page.waitForFunction(()=>!document.querySelector('.q-dpg-state--error'));assert.equal(await page.locator('.q-dpg-view h2').first().innerText(),latest.qellyView.action);
assert.equal(writes,0);results.push({appearance,resolvedAppearance:appearance,width,states,modelActionPreserved:true,failureFeedbackFirstScreen:true,failureBeforeHero:true,failureFocusedAfterScroll:true,retryRecovered:true,nonReadRequests:writes});await context.close();}}
catch(error){await active?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));await writeFile(out+'/report.json',JSON.stringify({status:results.length===8?'passed':'failed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,results,boundary:'Existing controlled Decision engine fixture; UI only. Existing complete range/selection/keyboard/failure suites remain required.'},null,2));}
