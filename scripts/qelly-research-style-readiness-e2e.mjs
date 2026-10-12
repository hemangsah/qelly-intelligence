import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/research-style-readiness-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),origin='http://127.0.0.1:'+server.port;
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];let active;
const pattern='**/assets/research-workspace-v2.css';
async function setup(appearance,width){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'}),writes=[];
 await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
 await context.route('**/*',q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method())){writes.push(q.request().method());return q.abort();}return q.continue();});
 await context.route('**/api/v1/preferences/layout',async q=>{const response=await q.fetch();return q.fulfill({response,json:{...await response.json(),appearance}});});
 const page=active=await context.newPage();await page.goto(origin+'/#/about-qelly',{waitUntil:'domcontentloaded'});await page.locator('.q-about-v2-page').waitFor();await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');
 assert.equal(await page.locator('link[data-qelly-research-v2]').count(),0);
 return {context,page,writes};
}
async function render(page){await page.evaluate(async()=>{
 const {renderResearchWorkspace}=await import('/assets/routes/research-workspace.mjs'),main=document.querySelector('#main');
 main.replaceChildren();document.documentElement.dataset.v53Route='research-workspace';Object.assign(main.dataset,{v53Route:'research-workspace',productionRoute:'research-workspace',pageKind:'workspace'});
 window.__researchStyleReads=0;window.__researchStyleWrites=0;window.__researchStyleController=new AbortController();
 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const deps={api:async(path,options={})=>{if(options.method&&!['GET','HEAD','OPTIONS'].includes(options.method)){window.__researchStyleWrites++;throw Error('Fixture forbids writes');}assertRead(path);window.__researchStyleReads++;return {items:[],cloudSync:true};},pageHead:(eyebrow,title,description)=>`<header class="q-page-head"><div><p class="q-eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></header>`,stateBanner:()=>'',escapeHtml,toast:()=>{},navigate:()=>{},signal:window.__researchStyleController.signal};
 function assertRead(path){if(path!=='/api/v1/research/workspaces')throw Error('Unexpected fixture read');}
 deps.renderRoute=()=>{window.__researchStyleResult='pending';window.__researchStylePromise=renderResearchWorkspace(main,deps).then(()=>window.__researchStyleResult='resolved',e=>window.__researchStyleResult=e.name);};
 deps.renderRoute();
 });}
async function ready(page){await page.locator('.q-research-v2-empty').waitFor();await page.waitForFunction(()=>window.__researchStyleResult==='resolved');assert.equal(await page.locator('link[data-qelly-research-v2]').count(),1);assert.equal(await page.evaluate(()=>window.__researchStyleWrites),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
try{for(const appearance of ['dark','light'])for(const width of [1440,390]){
 const {context,page,writes}=await setup(appearance,width);let release,requested;const hold=new Promise(r=>release=r),seen=new Promise(r=>requested=r);await context.route(pattern,async q=>{requested();await hold;return q.continue();});await render(page);await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Research stylesheet request missing')),15000))]);
 assert.equal(await page.locator('.q-research-v2-empty').count(),0);assert.equal(await page.evaluate(()=>window.__researchStyleReads),0);release();await ready(page);await context.unroute(pattern);
 await render(page);await ready(page);assert.equal(await page.locator('link[data-qelly-research-v2]').count(),1);
 await page.screenshot({path:out+'/'+appearance+'-'+width+'-ready.png',fullPage:true});assert.equal(writes.length,0);await context.close();
 const failed=await setup(appearance,width);await failed.context.route(pattern,q=>q.abort('failed'));await render(failed.page);await failed.page.locator('[data-research-style-retry]').waitFor();assert.equal(await failed.page.locator('link[data-qelly-research-v2]').count(),0);assert.equal(await failed.page.evaluate(()=>window.__researchStyleReads),0);assert.match(await failed.page.locator('.q-research-style-recovery').innerText(),/Workspace styles could not load\. Please retry\./);await failed.context.unroute(pattern);await failed.page.locator('[data-research-style-retry]').click();await ready(failed.page);assert.equal(failed.writes.length,0);await failed.context.close();
 const cancelled=await setup(appearance,width);let unblock,noticed;const wait=new Promise(r=>unblock=r),notice=new Promise(r=>noticed=r);await cancelled.context.route(pattern,async q=>{noticed();await wait;return q.continue();});await render(cancelled.page);await Promise.race([notice,new Promise((_,reject)=>setTimeout(()=>reject(Error('Research cancel stylesheet request missing')),15000))]);
 await cancelled.page.evaluate(()=>{window.__researchStyleController.abort();document.querySelector('#main').innerHTML='<section data-research-next-route>Next route remains visible</section>';});await cancelled.page.waitForFunction(()=>window.__researchStyleResult==='AbortError');unblock();await cancelled.page.waitForFunction(()=>document.querySelector('link[data-qelly-research-v2]')?.sheet);assert.equal(await cancelled.page.locator('[data-research-next-route]').count(),1);assert.equal(await cancelled.page.locator('.q-research-v2-empty,.q-research-style-recovery').count(),0);assert.equal(await cancelled.page.evaluate(()=>window.__researchStyleReads),0);assert.equal(cancelled.writes.length,0);await cancelled.context.close();active=null;
 results.push({appearance,width,delayedUnstyledContentWithheld:true,readsWithheldBeforeStyles:true,cachedSingleStylePreserved:true,failedStyleRemoved:true,genericRecoveryPreserved:true,retryRecovered:true,rapidNavigationPreserved:true,protectedWrites:0,fixtureWrites:0,overflow:false});
}}catch(error){await active?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{
 const status=results.length===4?'passed':'failed';await writeFile(out+'/report.json',JSON.stringify({sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,status,results,actualResearchModuleTested:true,realAuthenticationTested:false,persistenceBodiesChanged:false,realPrivateProductionReviewStillRequired:true},null,2)+'\n');await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));console.log(JSON.stringify({cases:results.length,status}));
}
