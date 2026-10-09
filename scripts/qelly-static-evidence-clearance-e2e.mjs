import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{startServer}from'./release-a5-evidence-server.mjs';
const out='preview/static-evidence-clearance-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}),results=[];let active;
try{for(const appearance of['dark','light'])for(const width of[1440,768,390,320]){
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});let writes=0;
 await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
 await context.route('**/*',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.request().method())){writes++;return r.abort();}return r.continue();});
 await context.route('**/api/v1/preferences/layout',async r=>{const response=await r.fetch();await r.fulfill({response,json:{...await response.json(),appearance}});});
 const page=active=await context.newPage();await page.goto(`http://127.0.0.1:${server.port}/#/dex-discovery`,{waitUntil:'domcontentloaded'});
 await page.locator('.q-dx-capability-table').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});await page.waitForFunction(a=>document.documentElement.dataset.resolvedAppearance===a,appearance);
 await page.locator('.q-dx-capability-table').evaluate(e=>e.scrollIntoView({block:'end'}));
 await page.waitForFunction(()=>document.querySelector('.q-ai-root').dataset.clearance==='content');
 await page.waitForFunction(()=>{const s=getComputedStyle(document.querySelector('[data-q-ai-launcher]'));return Number(s.opacity)===0&&s.pointerEvents==='none';});
 const protection=await page.evaluate(()=>{const e=document.querySelector('[data-q-ai-launcher]'),b=e.getBoundingClientRect(),bottom=parseFloat(getComputedStyle(e).bottom)||0,table=document.querySelector('.q-dx-capability-table'),r=table.getBoundingClientRect(),x=innerWidth/2,y=innerHeight-bottom-24,hit=document.elementFromPoint(x,y);return{state:e.parentElement.dataset.clearance,ariaHidden:e.getAttribute('aria-hidden'),tabIndex:e.tabIndex,tableContainsHit:table.contains(hit),overlap:r.left<(innerWidth+b.width)/2&&r.right>(innerWidth-b.width)/2&&r.top<innerHeight-bottom&&r.bottom>innerHeight-bottom-b.height,overflow:document.documentElement.scrollWidth>innerWidth+1};});
 assert.equal(protection.overlap,true);assert.equal(protection.tableContainsHit,true);assert.equal(protection.ariaHidden,'true');assert.equal(protection.tabIndex,-1);assert.equal(protection.overflow,false);
 await page.screenshot({path:`${out}/${appearance}-${width}-table.png`});
 await page.keyboard.press('Control+/');await page.locator('[data-q-ai-assistant]').waitFor({state:'visible'});await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));
 await page.keyboard.press('Escape');await page.locator('[data-q-ai-assistant]').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.q-ai-root').dataset.clearance==='content');
 // Exercise native table semantics as an isolated browser fixture; no data is sent or persisted.
 await page.evaluate(()=>{const t=document.createElement('table');t.id='static-table-clearance-fixture';t.innerHTML='<tbody><tr><td>Isolated static evidence</td></tr></tbody>';Object.assign(t.style,{position:'fixed',left:'20px',right:'20px',bottom:'16px',height:'90px',width:'calc(100% - 40px)',zIndex:'2',background:'var(--q-surface)'});document.querySelector('#main').append(t);});
 await page.waitForFunction(()=>document.querySelector('.q-ai-root').dataset.clearance==='content');
 const nativeTableHit=await page.evaluate(()=>document.querySelector('#static-table-clearance-fixture').contains(document.elementFromPoint(innerWidth/2,innerHeight-40)));assert.equal(nativeTableHit,true);
 assert.equal(writes,0);results.push({appearance,resolvedAppearance:appearance,width,protection,keyboardChatAvailable:true,nativeTableHit,nonReadRequests:writes});await context.close();
}}
catch(error){await active?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));await writeFile(out+'/report.json',JSON.stringify({status:results.length===8?'passed':'failed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,results,boundary:'Actual DEX role-table structure plus isolated HTML-table hit testing. No provider, numerical, execution or stored-data changes.'},null,2));}
