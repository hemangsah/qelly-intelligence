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


const source=process.env.QELLY_SCREEN_EVIDENCE_SHA,expected=process.env.QELLY_PRIMARY_EXPECT,out='preview/decision-primary-setup-pair';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.match(source,/^[a-f0-9]{40}$/);assert.ok(['red','green'].includes(expected));await mkdir(out,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex'),route=await readFile('apps/web/public/assets/routes/decision-proven-graph.mjs','utf8'),css=await readFile('apps/web/public/assets/qelly-decision-proven-graph.css','utf8');
assert.equal(await readFile('dist/frontend/assets/routes/decision-proven-graph.mjs','utf8'),route);assert.equal(await readFile('dist/frontend/assets/qelly-decision-proven-graph.css','utf8'),css);
const server=await startServer({port:0,host:'127.0.0.1'}),site='http://127.0.0.1:'+server.port,browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[],screenshots=[];let failure,activePage;
try{for(const appearance of ['dark','light'])for(const [width,height] of [[1280,720],[1280,900],[768,900],[390,900],[320,900]]){
 const context=await browser.newContext({viewport:{width,height},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),writes=[],errors=[];activePage=page;let latest;
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(([appearance,fixtureNow])=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixtureNow]));}static now(){return fixtureNow;}};localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance}));localStorage.removeItem('qelly.decision.ui-mode.v1');},[appearance,fixtureNow]);
 await context.route('**/*',q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method())){writes.push({method:q.request().method(),path:new URL(q.request().url()).pathname});return q.abort();}return q.continue();});
 await context.route('**/api/v1/decision-assets*',q=>q.fulfill({json:decisionAssetCapabilities()}));
 await context.route('**/api/v1/decision-proven-graph?*',async q=>{latest=await fixtureDecisionPayload(new URL(q.request().url()));return q.fulfill({json:latest});});
 for(const path of ['/api/v1/preferences/layout','/api/v1/user/layout-preferences'])await context.route(site+path+'*',async q=>{assert.equal(q.request().method(),'GET');const response=await q.fetch();return q.fulfill({response,json:{...await response.json(),appearance}});});
 await page.goto(site+'/#/decision-provenance',{waitUntil:'domcontentloaded'});await page.locator('.q-dpg-stage').waitFor();
 await page.waitForFunction(a=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true'&&document.documentElement.dataset.resolvedAppearance===a,appearance);
 await page.locator('.qelly-opening').waitFor({state:'hidden'});await page.locator('[data-dpg-ui-mode="simple"]').click();
 const navigation=page.locator('.q-product-menu');if(await navigation.getAttribute('aria-expanded')==='true')await navigation.click();
 const snapshot=()=>page.locator('.q-dpg-page').evaluate(root=>{
   const rect=e=>e?{top:e.getBoundingClientRect().top+scrollY,bottom:e.getBoundingClientRect().bottom+scrollY,height:e.getBoundingClientRect().height}:null;
   const essential=root.querySelector('[data-dpg-primary-setup]'),chart=root.querySelector('.q-dpg-stage'),answer=root.querySelector('.q-dpg-view'),more=root.querySelector('.q-dpg-secondary-actions');
   return {appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,hero:rect(root.querySelector('.q-dpg-hero')),answer:rect(answer),answerHeading:rect(answer?.querySelector('h2')),chart:rect(chart),essential:rect(essential),essentialBeforeChart:Boolean(essential&&(essential.compareDocumentPosition(chart)&Node.DOCUMENT_POSITION_FOLLOWING)),facts:essential?[...essential.children].map(n=>({label:n.querySelector('dt')?.textContent,value:[...n.querySelectorAll('dd')].map(x=>x.textContent)})):[],actions:[...root.querySelectorAll('.q-dpg-hero__actions button')].map(n=>({text:n.textContent,visible:!!n.getBoundingClientRect().height&&n.checkVisibility(),height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)})),more:more?{open:more.open,summary:rect(more.querySelector('summary')),text:more.querySelector('summary').textContent}:null,ordinary:[...root.querySelectorAll('.q-dpg-primary-setup,.q-dpg-primary-setup>div,.q-dpg-secondary-actions')].map(n=>{const s=getComputedStyle(n);return{border:['Top','Right','Bottom','Left'].map(k=>s['border'+k+'Width']),shadow:s.boxShadow};}),pagePaddingBottom:parseFloat(getComputedStyle(root).paddingBottom)};
 });
 const before=await snapshot();assert.equal(before.appearance,appearance);assert.equal(before.width,width);assert.equal(before.height,height);assert.equal(before.overflow,false);assert.equal(await page.locator('.q-dpg-view h2').innerText(),latest.qellyView.action);assert.equal(before.actions.length,8);
 const prefix=expected+'-'+appearance+'-'+width+'-'+height;
 await page.screenshot({path:out+'/'+prefix+'-top.png'});screenshots.push(prefix+'-top.png');
 if(expected==='green'){
   assert.equal(before.essentialBeforeChart,true);assert.equal(before.facts.length,7);assert.deepEqual(before.facts.map(x=>x.label),['Setup','Entry','Invalidation','Targets','Risk / reward','Setup probability','Event risk']);
   assert.equal(before.more.open,false);assert.equal(before.actions.filter(x=>x.visible).length,2);assert.ok(before.more.summary.height>=44);assert.ok(before.answerHeading.bottom<=height-120,'Primary answer must be visible with reading space: '+JSON.stringify(before));
   if(width>=390)assert.ok(before.essential.bottom<=height,'Essential setup facts must fit on the tested first screen: '+JSON.stringify(before));
   for(const s of before.ordinary){assert.deepEqual(s.border,['0px','0px','0px','0px']);assert.equal(s.shadow,'none');}
   assert.ok(before.pagePaddingBottom>=118);const summary=page.locator('.q-dpg-secondary-actions>summary');await summary.press('Enter');
   const opened=await snapshot();assert.equal(opened.more.open,true);assert.equal(opened.actions.filter(x=>x.visible).length,8);for(const b of opened.actions){assert.ok(b.height>=44);assert.ok(b.font>=14);}
   await page.screenshot({path:out+'/'+prefix+'-actions.png'});screenshots.push(prefix+'-actions.png');await summary.press('Enter');assert.equal((await snapshot()).more.open,false);
   await page.locator('.q-dpg-stage').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+prefix+'-chart.png'});screenshots.push(prefix+'-chart.png');
   const expert=[];for(const mode of ['advanced','research']){await page.locator('[data-dpg-ui-mode="'+mode+'"]').click();await page.waitForFunction(m=>document.querySelector('.q-dpg-page')?.dataset.dpgDepth===m,mode);assert.equal(await page.locator('[data-dpg-primary-setup]').count(),0);assert.equal(await page.locator('.q-dpg-secondary-actions').count(),0);assert.equal(await page.locator('.q-dpg-hero__actions button').count(),8);assert.equal(await page.locator('[data-dpg-cf-setup]').count(),1);expert.push({mode,fullSetup:1,actions:8});}
   results.push({appearance,width,height,before,opened,expert,numericalPayloadHash:hash(JSON.stringify(latest)),protectedWrites:writes,pageErrors:errors});
 }else{assert.equal(before.essentialBeforeChart,false);assert.equal(before.more,null);assert.equal(before.actions.filter(x=>x.visible).length,8);results.push({appearance,width,height,before,numericalPayloadHash:hash(JSON.stringify(latest)),protectedWrites:writes,pageErrors:errors});}
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await context.close();
}
assert.equal(results.length,10);
}catch(e){failure={message:e.message,stack:e.stack};if(activePage)await activePage.screenshot({path:out+'/failure.png'}).catch(()=>{});}finally{await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));}
const report={sourceSha:source,runnerSha:process.env.GITHUB_SHA,expected,status:failure?'failed':'passed',failure,results,screenshots,routeSha256:hash(route),cssSha256:hash(css),fixtureOnly:true,fixtureDate:new Date(fixtureNow).toISOString(),newProviders:false,numericalEnginesChanged:false,productionAccepted:false,recordedAt:new Date().toISOString()};
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({expected,status:report.status,contexts:results.length,failure:failure?.message}));if(failure)throw new Error(failure.message);
