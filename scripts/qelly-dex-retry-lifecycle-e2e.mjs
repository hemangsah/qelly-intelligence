import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {startServer}=await import(pathToFileURL(process.cwd()+'/scripts/release-a5-evidence-server.mjs'));
const sourceSha=process.env.QELLY_SCREEN_EVIDENCE_SHA,expected=process.env.QELLY_DEX_RETRY_EXPECT||'green';
assert.match(sourceSha,/^[a-f0-9]{40}$/);assert.ok(['red','green'].includes(expected));
function validateReport(report,{expected,sourceSha}){
  assert.equal(report.schema,'qelly.dex.retry-lifecycle/1.0');assert.equal(report.sourceSha,sourceSha);assert.equal(report.expected,expected);assert.equal(report.status,'passed');assert.equal(report.error,null);assert.equal(report.results.length,4);
  assert.deepEqual(report.results.map(row=>row.appearance+'-'+row.width).sort(),['dark-1280','dark-390','light-1280','light-390']);
  for(const row of report.results){
    assert.equal(row.sourceSha,sourceSha);assert.equal(row.controlledFailure,true);assert.equal(row.heldGet,true);assert.equal(row.protectedWrites,0);assert.deepEqual(row.requestErrors,[]);
    assert.equal(row.before.hash,'#/about-qelly');assert.equal(row.before.about,true);assert.equal(row.before.dex,false);assert.equal(row.before.heading,'About Qelly');assert.equal(row.before.overflow,false);
    if(expected==='green'){assert.equal(row.reproduced,false);assert.deepEqual(row.after,row.before);assert.equal(row.network.event,'failed');assert.match(row.network.failure||'',/ERR_ABORTED/);}
    else{assert.equal(row.reproduced,true);assert.equal(row.after.hash,'#/about-qelly');assert.equal(row.after.about,false);assert.equal(row.after.dex,true);assert.equal(row.after.heading,'DEX Discovery');}
  }
  assert.equal(report.newProvidersEnabled,false);assert.equal(report.numericalEnginesChanged,false);assert.equal(report.walletExecutionEnabled,false);
}
const out='preview/dex-retry-lifecycle';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),origin='http://127.0.0.1:'+server.port;
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
let active,errorText=null;
const bounded=(promise,label,ms=15000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label)),ms))]).finally(()=>clearTimeout(timer));};
async function ready(page){await page.locator('.q-dx-page [data-dex-brief]').waitFor();assert.equal(await page.locator('[data-dex-source]').count(),13);assert.equal(await page.locator('[data-dex-evidence]').count(),12);assert.equal(await page.locator('.q-dx-capability-table [role=cell]').filter({hasText:'Unavailable'}).count(),7);assert.match(await page.locator('.q-dx-truth').innerText(),/0 display-enabled feeds/);}
async function snapshot(page){return page.evaluate(()=>({hash:location.hash,title:document.title,about:!!document.querySelector('.q-about-v2-page'),dex:!!document.querySelector('.q-dx-page'),heading:document.querySelector('main h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+2}));}
try{
for(const appearance of ['dark','light'])for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:800},colorScheme:appearance,reducedMotion:'reduce',hasTouch:width===390,serviceWorkers:'block'}),writes=[],requestErrors=[];
 await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
 await context.route('**/*',q=>{if(!['GET','HEAD','OPTIONS'].includes(q.request().method())){writes.push(q.request().method());return q.abort();}return q.continue();});
 await context.route('**/api/v1/preferences/layout',async q=>{const response=await q.fetch();return q.fulfill({response,json:{...await response.json(),appearance}});});
 const page=active=await context.newPage();await page.goto(origin+'/#/dex-discovery',{waitUntil:'domcontentloaded'});await ready(page);
 await page.waitForFunction(a=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true'&&document.documentElement.dataset.resolvedAppearance===a,appearance);
 const contract=await (await page.request.get(origin+'/api/v1/discovery/dex')).json();assert.equal(contract.summary.total,13);assert.equal(contract.summary.displayEnabled,0);assert.equal(contract.summary.walletEnabled,0);assert.equal(contract.summary.executionEnabled,0);
 let mode='fail',heldRequest,release,noticed,settled,routeFinished;
 const hold=new Promise(r=>release=r),seen=new Promise(r=>noticed=r),finished=new Promise(r=>settled=r),routeDone=new Promise(r=>routeFinished=r);
 page.on('requestfinished',r=>{if(r===heldRequest)settled({event:'finished'});});page.on('requestfailed',r=>{if(r===heldRequest)settled({event:'failed',failure:r.failure()?.errorText});});
 await context.route('**/api/v1/discovery/dex',async q=>{if(mode==='fail')return q.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Controlled DEX GET failure'}})});if(mode==='hold'){heldRequest=q.request();noticed();await hold;try{await q.fulfill({status:200,contentType:'application/json',body:JSON.stringify(contract)});}catch(error){requestErrors.push(String(error.message));}finally{routeFinished();}return;}return q.continue();});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-dex-retry]').waitFor();assert.equal(await page.locator('[data-dex-source]').count(),0);assert.match(await page.locator('.q-dx-error').innerText(),/No TVL, volume, APR, liquidity or safety value was substituted/);
 mode='hold';await page.locator('[data-dex-retry]').click();await bounded(seen,'Retry DEX GET was not intercepted');
 // Change only the actual SPA hash; no direct renderer calls, DOM replacement, or full reload.
 await page.evaluate(()=>{location.hash='#/about-qelly';});await page.locator('.q-about-v2-page').waitFor();const before=await snapshot(page);assert.equal(before.hash,'#/about-qelly');assert.equal(before.about,true);
 release();await bounded(routeDone,'Held Retry handler did not settle');const network=await bounded(finished,'Held Retry request did not finish or cancel');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const after=await snapshot(page),reproduced=after.hash==='#/about-qelly'&&after.dex&&!after.about;
 await page.screenshot({path:out+'/'+expected+'-'+appearance+'-'+width+'.png'});
 results.push({appearance,width,sourceSha,controlledFailure:true,heldGet:true,before,after,network,reproduced,protectedWrites:writes.length,requestErrors});
 assert.equal(writes.length,0,'All outgoing non-read requests must remain absent');assert.equal(reproduced,expected==='red','Late DEX Retry route takeover expectation mismatch');
 if(expected==='green'){assert.deepEqual(after,before,'Destination route must survive the late request');mode='pass';await page.evaluate(()=>{location.hash='#/dex-discovery';});await ready(page);}
 await context.close();active=null;
}
}catch(error){errorText=String(error.stack||error);await active?.screenshot({path:out+'/unexpected-failure.png'}).catch(()=>{});}
finally{const report={schema:'qelly.dex.retry-lifecycle/1.0',sourceSha,expected,status:!errorText&&results.length===4?'passed':'failed',results,error:errorText,method:'Integrated built frontend with actual hash router and governed evidence server; controlled GET503 and delayed GET200; outgoing writes blocked',newProvidersEnabled:false,numericalEnginesChanged:false,walletExecutionEnabled:false};if(!errorText)try{validateReport(report,{expected,sourceSha});}catch(error){errorText=String(error.stack||error);report.status='failed';report.error=errorText;}await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('DEX_RETRY_LIFECYCLE_REPORT '+JSON.stringify(report));await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));if(errorText)process.exitCode=1;}
