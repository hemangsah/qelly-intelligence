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


const source=process.env.QELLY_SCREEN_EVIDENCE_SHA,expected=process.env.QELLY_FONT_EXPECT,out='preview/public-recovery-brand-retry';assert.equal(process.env.GITHUB_ACTIONS,'true');assert.ok(['red','green'].includes(expected));await mkdir(out,{recursive:true});
const {routeIdentityFor}=await import(pathToFileURL(process.cwd()+'/apps/web/public/assets/route-registry.mjs'));
const server=await startServer({port:0,host:'127.0.0.1'}),browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[],screenshots=[];let activePage,failure;
try{for(const appearance of ['dark','light'])for(const width of [1280,768,390,320])for(const entry of [{route:'decision-provenance',href:'#/decision-provenance',css:'/assets/qelly-decision-proven-graph.css',owned:'.q-dpg-page'},{route:'asset',href:'#/asset/QI-CRYPTO-BTC',css:'/assets/routes/asset-dossier.css',owned:'.q-dossier'}]){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),page=activePage=await context.newPage(),writes=[],errors=[],styleResponses=[];let failStyle=true,failedStyleRequests=0;
 await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).pathname===entry.css)styleResponses.push(r.status());});
 await context.route('**/*',q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method())){writes.push(q.request().method());return q.abort();}return q.continue();});
 for(const path of ['/api/v1/preferences/layout','/api/v1/user/layout-preferences'])await context.route('**'+path+'*',async q=>{assert.equal(q.request().method(),'GET');const response=await q.fetch();return q.fulfill({response,json:{...await response.json(),appearance}});});
 await context.route('**/api/v1/decision-assets*',q=>q.fulfill({json:decisionAssetCapabilities()}));await context.route('**/api/v1/decision-proven-graph?*',async q=>q.fulfill({json:await fixtureDecisionPayload(new URL(q.request().url()))}));
 await context.route('**'+entry.css+'*',q=>{if(failStyle){failedStyleRequests++;return q.fulfill({status:500,contentType:'text/css',body:'/* Intentional isolated stylesheet failure */'});}return q.continue();});
 await page.goto('http://127.0.0.1:'+server.port+'/'+entry.href,{waitUntil:'domcontentloaded'});const recovery=page.locator('[data-qelly-route-recovery="'+entry.route+'"]');await recovery.waitFor({state:'visible'});await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);await page.locator('.qelly-opening').waitFor({state:'hidden'});
 const before=await recovery.evaluate(e=>{const parse=c=>{const n=c.match(/[\d.]+/g)?.map(Number);return c.startsWith('rgb')&&n?.length>=3?{rgb:n.slice(0,3),alpha:n[3]??1}:null;};const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const sample=n=>{const fg=parse(getComputedStyle(n).color);let p=n,bg,reason;while(p){const style=getComputedStyle(p);if(style.backgroundImage!=='none'){reason='gradient';break;}const paint=parse(style.backgroundColor);if(paint&&paint.alpha>0){if(paint.alpha<1){reason='translucent';break;}bg=paint;break;}p=p.parentElement;}const ratio=fg&&bg&&!reason?(Math.max(luminance(fg.rgb),luminance(bg.rgb))+0.05)/(Math.min(luminance(fg.rgb),luminance(bg.rgb))+0.05):null;return{text:n.textContent.trim().slice(0,80),supported:ratio!==null,unsupportedReason:reason,ratio};};return{heading:e.querySelector('h1').textContent,retry:e.querySelectorAll('[data-qelly-recovery-retry]').length,text:e.textContent,appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,hash:location.hash,surfaces:[...e.querySelectorAll('header,.q-recovery-notice,.q-recovery-table')].map(n=>({class:n.className,border:getComputedStyle(n).borderWidth,radius:getComputedStyle(n).borderRadius,shadow:getComputedStyle(n).boxShadow,backgroundImage:getComputedStyle(n).backgroundImage})),contrastSamples:[...e.querySelectorAll('header p,header h1,header span,.q-recovery-notice strong,.q-recovery-notice span,.q-recovery-actions a')].map(sample)};});assert.equal(before.appearance,appearance);assert.equal(before.width,width);assert.equal(before.overflow,false);assert.ok(failedStyleRequests>=1);assert.ok(before.text.includes('No substitute records generated'));
 const file=expected+'-'+entry.route+'-'+appearance+'-'+width+'-failure.png';await page.screenshot({path:out+'/'+file,fullPage:false});screenshots.push(file);let recovered=null,recoveryFocus=null;
 if(expected==='red'){assert.notEqual(before.heading,routeIdentityFor(entry.route).label);assert.equal(before.retry,0);}else{assert.equal(before.heading,routeIdentityFor(entry.route).label);assert.equal(before.retry,1);assert.ok(!/Market Command|Decision Provenance/.test(before.text));for(const surface of before.surfaces){assert.equal(surface.border,'0px');assert.equal(surface.radius,'0px');assert.equal(surface.shadow,'none');assert.equal(surface.backgroundImage,'none');}assert.ok(before.contrastSamples.length>=8);for(const sample of before.contrastSamples){assert.equal(sample.supported,true);assert.ok(sample.ratio>=4.5,'Unreadable recovery text: '+sample.text);}failStyle=false;const retry=recovery.locator('[data-qelly-recovery-retry]');await retry.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');recoveryFocus=await retry.evaluate(e=>({outlineStyle:getComputedStyle(e).outlineStyle,outlineWidth:getComputedStyle(e).outlineWidth,height:e.getBoundingClientRect().height,keyboardTarget:document.activeElement===e}));assert.equal(recoveryFocus.keyboardTarget,true);assert.notEqual(recoveryFocus.outlineStyle,'none');assert.ok(Number.parseFloat(recoveryFocus.outlineWidth)>=2);assert.ok(recoveryFocus.height>=44);await retry.hover();await retry.press('Enter');await recovery.waitFor({state:'detached'});await page.locator('#main[aria-busy="false"]').waitFor();await page.locator(entry.owned).waitFor({state:'visible'});recovered=await page.locator('#main').evaluate(e=>({hash:location.hash,heading:e.querySelector('h1')?.textContent,appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,recovery:!!e.querySelector('[data-qelly-route-recovery]')}));assert.equal(recovered.hash,before.hash);assert.equal(recovered.appearance,appearance);assert.equal(recovered.width,width);assert.equal(recovered.overflow,false);assert.equal(recovered.recovery,false);assert.ok(styleResponses.includes(500)&&styleResponses.includes(200));const file=expected+'-'+entry.route+'-'+appearance+'-'+width+'-recovered.png';await page.screenshot({path:out+'/'+file,fullPage:false});screenshots.push(file);}
 assert.equal(writes.length,0);assert.deepEqual(errors,[]);results.push({route:entry.route,appearance,width,actualBuiltRoute:true,before,recovered,recoveryFocus,styleResponses,failedStyleRequests,protectedWrites:writes.length,pageErrors:errors,presenterInjected:false,routeContextPreserved:expected==='green'?recovered.hash===before.hash:null});await context.close();activePage=null;
 }}catch(error){failure=error.stack;process.exitCode=1;await activePage?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}finally{await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));const report={schema:'qelly.public-recovery.brand-retry/1.0',sourceSha:source,driverSha:process.env.GITHUB_SHA,expected,status:!failure&&results.length===16?'passed':'failed',contexts:results.length,results,screenshots,isolatedExistingFixtures:true,presenterInjected:false,actualPrivateAccountUsed:false,numericalEnginesChanged:false,newProvidersEnabled:false,authConfigurationChanged:false,failure};await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({source,expected,status:report.status,contexts:results.length,failure}));}
