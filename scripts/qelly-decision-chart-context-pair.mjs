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


const source=process.env.QELLY_SCREEN_EVIDENCE_SHA,expected=process.env.QELLY_CHART_CONTEXT_EXPECT,out='preview/decision-chart-context-pair';assert.equal(process.env.GITHUB_ACTIONS,'true');assert.match(source,/^[a-f0-9]{40}$/);assert.ok(['red','green'].includes(expected));await mkdir(out,{recursive:true});const hash=s=>createHash('sha256').update(s).digest('hex');
const volatileFixturePaths=['macro.ingestionTime','evidence.macro.ingestionTime','pastPresentFuture.present.macro.ingestionTime','performance.totalMs',...['news','candleFetch','macro','derivatives','liquidity','fundingHistory','crossAssetBenchmark','multiTimeframe','derivativesCompute','crossAssetCompute','quantCalibrationAnalogs','nextMoveCompute','riskRewardResearch','contextAndEvidenceGraph','rangeEvidence'].map(k=>'performance.components.'+k+'.ms')];
const payloadHash=value=>{const c=JSON.parse(JSON.stringify(value));for(const path of volatileFixturePaths){const keys=path.split('.'),last=keys.pop();let n=c;for(const key of keys)n=n[key];assert.ok(Object.hasOwn(n,last));assert.ok(path.endsWith('.ingestionTime')?Number.isFinite(Date.parse(n[last])):Number.isFinite(n[last])&&n[last]>=0);delete n[last];}return hash(JSON.stringify(c));};
const server=await startServer({port:0,host:'127.0.0.1'}),site='http://127.0.0.1:'+server.port,browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[],screenshots=[];let failure,activePage,lastObservation;
try{for(const appearance of ['dark','light'])for(const [width,height] of [[1280,720],[1280,900],[768,900],[390,900],[320,900]]){
 const context=await browser.newContext({viewport:{width,height},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),writes=[],errors=[];activePage=page;let latest;page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(([appearance,now])=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance}));localStorage.removeItem('qelly.decision.ui-mode.v1');},[appearance,fixtureNow]);
 await context.route('**/*',q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method())){writes.push({method:q.request().method(),path:new URL(q.request().url()).pathname});return q.abort();}return q.continue();});await context.route('**/api/v1/decision-assets*',q=>q.fulfill({json:decisionAssetCapabilities()}));await context.route('**/api/v1/decision-proven-graph?*',async q=>{latest=await fixtureDecisionPayload(new URL(q.request().url()));return q.fulfill({json:latest});});for(const path of ['/api/v1/preferences/layout','/api/v1/user/layout-preferences'])await context.route(site+path+'*',async q=>{assert.equal(q.request().method(),'GET');const r=await q.fetch();return q.fulfill({response:r,json:{...await r.json(),appearance}});});
 await page.goto(site+'/#/decision-provenance',{waitUntil:'domcontentloaded'});await page.locator('svg.q-dpg-chart').waitFor();await page.waitForFunction(a=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true'&&document.documentElement.dataset.resolvedAppearance===a,appearance);await page.locator('.qelly-opening').waitFor({state:'hidden'});const nav=page.locator('.q-product-menu');if(await nav.getAttribute('aria-expanded')==='true')await nav.click();
 for(const mode of ['simple','advanced','research']){
  await page.locator('[data-dpg-ui-mode="'+mode+'"]').click();await page.locator('svg.q-dpg-chart').scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const snap=await page.locator('.q-dpg-chart-wrap').evaluate(root=>{const rect=n=>{const b=n.getBoundingClientRect();return{left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};},svg=root.querySelector('svg.q-dpg-chart'),legend=root.querySelector('[data-dpg-chart-context]'),ctx=legend?[...legend.querySelectorAll('dt,dd')].map(n=>{const s=getComputedStyle(n),r=document.createRange();r.selectNodeContents(n);return{text:n.textContent,font:Number.parseFloat(s.fontSize),glyphs:[...r.getClientRects()].map(b=>({width:b.width,height:b.height})),color:s.color,rect:rect(n)};}):[],dock=document.querySelector('.q-ai-launcher');return{appearance:document.documentElement.dataset.resolvedAppearance,width:innerWidth,height:innerHeight,mode:root.closest('[data-dpg-depth]').dataset.dpgDepth,overflow:document.documentElement.scrollWidth>innerWidth+1,svg:rect(svg),svgMarkup:svg.outerHTML,labels:[...svg.querySelectorAll('text')].map(n=>({text:n.textContent,hidden:getComputedStyle(n).visibility==='hidden',font:Number.parseFloat(getComputedStyle(n).fontSize),rect:rect(n)})),context:legend?{rect:rect(legend),registered:legend.hasAttribute('data-qelly-chat-plot'),labels:ctx,frames:[...legend.querySelectorAll('div')].map(n=>({border:getComputedStyle(n).borderTopWidth,shadow:getComputedStyle(n).boxShadow}))}:null,help:rect(root.querySelector('.q-dpg-chart-help')),dock:dock?{rect:rect(dock),opacity:Number.parseFloat(getComputedStyle(dock).opacity)}:null};});
  lastObservation=snap;assert.equal(snap.appearance,appearance);assert.equal(snap.width,width);assert.equal(snap.height,height);assert.equal(snap.mode,mode);assert.equal(snap.overflow,false);snap.researchHash=payloadHash(latest);snap.svgMarkupHash=hash(snap.svgMarkup);delete snap.svgMarkup;
  if(expected==='green'){assert.ok(snap.context);assert.equal(snap.context.registered,true);assert.deepEqual(snap.context.labels.filter((_,i)=>i%2===0).map(x=>x.text),['Observed','Projected','Latest observation']);assert.equal(snap.context.labels[1].text,'Historical candles');assert.match(snap.context.labels[3].text,/Scenarios and next-candle range|Modelled scenarios/);for(const x of snap.context.labels){assert.ok(x.font>=14);assert.ok(x.glyphs.length>0);assert.ok(x.glyphs.every(r=>r.height>=12&&r.width>0));assert.ok(x.rect.right<=width+1&&x.rect.left>=-1);}assert.ok(snap.context.rect.bottom<=snap.svg.top+1);assert.ok(snap.help.bottom<=snap.context.rect.top+1);assert.ok(snap.labels.every(n=>n.hidden));for(const f of snap.context.frames){assert.equal(f.border,'0px');assert.equal(f.shadow,'none');}}else{assert.equal(snap.context,null);if(width<=390)assert.ok(snap.labels.some(x=>x.rect.height<8),'Baseline must reproduce actual scaled glyph defect');}
  if(snap.dock&&snap.dock.opacity>0){const a=snap.svg,b=snap.dock.rect;assert.equal(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,false);}
  if(mode==='simple'){const file=expected+'-'+appearance+'-'+width+'-'+height+'-chart.png';const clip=await page.locator('.q-dpg-chart-wrap').evaluate(root=>{const a=(root.querySelector('[data-dpg-chart-context]')||root.querySelector('svg.q-dpg-chart')).getBoundingClientRect(),b=root.querySelector('svg.q-dpg-chart').getBoundingClientRect();return{x:a.left+scrollX,y:a.top+scrollY,width:a.width,height:b.bottom-a.top};});assert.ok(clip.height<=height);await page.screenshot({path:out+'/'+file,clip});screenshots.push(file);}results.push(snap);
 }
 assert.equal(errors.length,0);assert.equal(writes.filter(x=>!['/api/v1/product-events','/api/v1/analytics'].includes(x.path)).length,0);await context.close();activePage=null;
}}catch(e){failure=e;if(activePage)await activePage.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}finally{await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));}
await writeFile(out+'/report.json',JSON.stringify({status:failure?'failed':'passed',sourceSha:source,expected,results,screenshots,volatileMetadataPaths:volatileFixturePaths,numericalEnginesChanged:false,geometryComparedIndependently:false,failure:failure?.message||null,lastObservation},null,2)+'\n');if(failure)throw failure;assert.equal(results.length,30);assert.equal(screenshots.length,10);console.log({status:'passed',source,expected,contexts:30,images:10});
