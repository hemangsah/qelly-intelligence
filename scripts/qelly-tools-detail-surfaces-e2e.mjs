import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/tools-detail-surfaces-e2e';
await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),origin='http://127.0.0.1:'+server.port;
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],readiness=[];let active;
const routes=[{route:'formula-detail',id:'position-size',root:'.q-formula-detail-page',heading:'Position Size',disclosure:'Technical reference'},{route:'indicator-detail',id:'rsi',root:'.q-indicator-detail-page',heading:'Relative Strength Index',disclosure:'Advanced technical evidence'},{route:'calculator-detail',id:'position-size',root:'.q-calculator-detail-page',heading:'Position Size',disclosure:'Method and assumptions'}];
async function setup(appearance,width){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),writes=[];
 await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
 await context.route('**/*',q=>{const r=q.request(),u=new URL(r.url());if(!['GET','HEAD','OPTIONS'].includes(r.method())){if(u.origin===origin&&u.pathname.startsWith('/api/'))writes.push({method:r.method(),path:u.pathname});return q.abort();}return q.continue();});
 await context.route('**/api/v1/preferences/layout',async q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method()))return q.abort();const response=await q.fetch();return q.fulfill({response,json:{...await response.json(),appearance}});});
 return {context,writes};
}
async function ready(page,r,appearance){await page.locator(r.root).waitFor();await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});}
async function surfaces(page,r,selectionRequired=false){
 const selectors=['.q-panel','.q-state-banner','.q-evidence-grid>div','.q-calculation-result','.q-method-card','.q-indicator-value-grid>div','.q-indicator-parameters','.q-indicator-limits','.q-indicator-chart','.q-spark-bars','.q-indicator-exact-table','.q-technical-details','.q-result-empty','.q-v6-deterministic-banner','.q-v6-indicator-truth','.q-v6-quant-kpis','.q-v6-cloud-save-note'];
 const measured=await page.locator(selectors.map(s=>r.root+' '+s).join(',')).evaluateAll(ns=>ns.map(e=>({classes:e.className,borders:['Top','Right','Bottom','Left'].map(x=>getComputedStyle(e)['border'+x+'Width']),shadow:getComputedStyle(e).boxShadow})));
 if(selectionRequired){assert.equal(measured.length,2);assert.deepEqual(measured.map(x=>x.classes.split(' ')[0]).sort(),['q-panel','q-state-banner']);}else assert.ok(measured.length>=3);for(const row of measured){assert.deepEqual(row.borders,['0px','0px','0px','0px'],JSON.stringify(row));assert.equal(row.shadow,'none',JSON.stringify(row));}return measured.length;
}
try{
 for(const appearance of ['dark','light'])for(const width of [1440,768,390,320])for(const r of routes){
  const {context,writes}=await setup(appearance,width),page=await context.newPage();active=page;
  await page.goto(origin+'/#/'+r.route+'/'+r.id,{waitUntil:'domcontentloaded'});await ready(page,r,appearance);
  assert.equal(await page.locator(r.root+' h1').innerText(),r.heading);
  if(r.route!=='formula-detail')assert.equal(await page.locator(r.root).evaluate(el=>el.classList.contains(el.classList.contains('q-calculator-detail-page')?'q-calculator-workbench-page':'q-indicator-workbench-page')),true);
  const surfaceCount=await surfaces(page,r); const statusLabels=await page.locator(r.root+' .q-status').evaluateAll(ns=>ns.map(e=>({height:e.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(e).lineHeight),padding:parseFloat(getComputedStyle(e).paddingTop)+parseFloat(getComputedStyle(e).paddingBottom),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth})));assert.ok(statusLabels.length>=1);for(const label of statusLabels){assert.ok(label.height<=label.lineHeight+label.padding+2,JSON.stringify(label));assert.ok(label.scrollWidth<=label.clientWidth+1,JSON.stringify(label));}
  const summary=page.locator(r.root+' summary').filter({hasText:r.disclosure}).first();await summary.focus();await summary.press('Enter');assert.equal(await summary.evaluate(e=>e.parentElement.open),true);
  if(r.route==='formula-detail'){assert.equal(await page.locator('.q-formula-detail-page .q-calculation-result').count(),8);assert.match(await page.locator('.q-formula-detail-page').innerText(),/Your inputs only/);}
  if(r.route==='indicator-detail'){assert.equal(await page.locator('.q-indicator-sample .q-table tbody tr').count(),12);assert.equal(await page.locator('.q-spark-bars>span').count(),24);assert.match(await page.locator('.q-indicator-detail-page').innerText(),/not a live market feed/);}
  let inputFocusPreserved=true;
  if(r.route==='calculator-detail'){
   assert.equal(await page.locator('[data-structured-field]').count(),9);assert.match(await page.locator('#calculator-detail-evidence').innerText(),/No result yet/);assert.equal(await page.locator('[data-action="save"]').isDisabled(),true);
   const input=page.locator('#calculator-field-riskPercent');await input.focus();const focus=await input.evaluate(e=>({outline:parseFloat(getComputedStyle(e).outlineWidth),border:parseFloat(getComputedStyle(e).borderTopWidth)}));assert.ok(focus.outline>=2||focus.border>=1,JSON.stringify(focus));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(writes.length,0);
  await page.screenshot({path:out+'/'+r.route+'-'+appearance+'-'+width+'.png',fullPage:true});
  await page.goto(origin+'/#/'+r.route,{waitUntil:'domcontentloaded'});await page.getByText('SELECTION REQUIRED',{exact:true}).waitFor();await page.locator(r.root).waitFor();assert.match(await page.locator('#main').innerText(),/SELECTION REQUIRED/);assert.equal(new URL(page.url()).hash,'#/'+r.route);await surfaces(page,r,true);assert.equal(writes.length,0);
  results.push({route:r.route,appearance,width,surfaceCount,actualProductionEntryPreserved:true,statusLabelsReadable:true,ordinaryBordersRemoved:true,ordinaryShadowsRemoved:true,methodIdentityPreserved:true,keyboardDisclosurePreserved:true,inputFocusPreserved,selectionRequiredPreserved:true,noSilentSubstitution:true,overflow:false,protectedWrites:0,calculationRun:false,saveClicked:false});await context.close();active=null;
 }
 for(const appearance of ['dark','light'])for(const width of [1440,390])for(const r of routes){
  const {context,writes}=await setup(appearance,width),pattern='**/assets/qelly-v6-quant-workbench.css';let release,requested;const hold=new Promise(x=>release=x),seen=new Promise(x=>requested=x);await context.route(pattern,async q=>{requested();await hold;return q.continue();});
  const page=await context.newPage();active=page;await page.goto(origin+'/#/'+r.route+'/'+r.id,{waitUntil:'domcontentloaded'});await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Detail stylesheet request missing')),15000))]);assert.equal(await page.locator(r.root).count(),0);release();await ready(page,r,appearance);await context.unroute(pattern);
  await page.goto(origin+'/#/calculator-center');await page.locator('.q-calculator-center-page').waitFor();await page.goto(origin+'/#/'+r.route+'/'+r.id);await page.locator(r.root).waitFor();assert.equal(await page.locator('link[data-qelly-v6-quant-workbench]').count(),1);
  const failure=await context.newPage();active=failure;await failure.route(pattern,q=>q.abort('failed'));await failure.goto(origin+'/#/'+r.route+'/'+r.id,{waitUntil:'domcontentloaded'});await failure.locator('[data-tools-style-retry]').waitFor();assert.equal(await failure.locator('link[data-qelly-v6-quant-workbench]').count(),0);await failure.unroute(pattern);await failure.locator('[data-tools-style-retry]').click();await failure.locator(r.root).waitFor();
  assert.equal(writes.length,0);readiness.push({route:r.route,appearance,width,delayedUnstyledContentWithheld:true,cachedSingleStylePreserved:true,failedStyleRemoved:true,retryRecovered:true,protectedWrites:0});await context.close();active=null;
 }
}catch(error){await active?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{
 const status=results.length===24&&readiness.length===12?'passed':'failed';await writeFile(out+'/report.json',JSON.stringify({sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,status,results,readiness,realAuthenticationTested:false,numericalEnginesChanged:false,newProvidersEnabled:false},null,2)+'\n');await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));console.log(JSON.stringify({cases:results.length,readinessCases:readiness.length,status}));
}
