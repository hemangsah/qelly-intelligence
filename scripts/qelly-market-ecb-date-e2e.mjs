import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/market-ecb-date-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),results=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const source={provider:'ecb',truthState:'cached_provider',observationDate:'2026-10-06',observationTime:null,observedAt:null,ingestionTime:'2026-10-07T11:54:51.360Z',data:{date:'2026-10-06',rates:{USD:1.1,INR:90,GBP:0.85}}};
try{
 for(const width of [1440,390])for(const appearance of ['dark','light']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
  const page=await context.newPage();let writes=0,missing=false;const mutations=[];
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method())&&new URL(request.url()).pathname.startsWith('/api/v1/')){writes++;mutations.push({method:request.method(),path:new URL(request.url()).pathname});}});
  await page.route('**/api/v1/user/layout-preferences',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),appearance}});});
  const fixture=()=>missing?{...source,observationDate:null,data:{rates:{}}}:source;
  await page.route('**/api/v1/providers/ecb*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture())}));
  await page.route('**/api/v1/market/network',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sources:{ecb:fixture()}})}));
  try{
   await page.goto('http://127.0.0.1:'+server.port+'/#/market',{waitUntil:'domcontentloaded'});
   await page.locator('[data-market-runtime="v7-public-no-fabrication"]').waitFor({state:'visible',timeout:30000});
   if(await page.locator('html').getAttribute('data-resolved-appearance')!==appearance)await page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true}).click();
   const panel=page.locator('.q-v7-reference-panel'),card=page.locator('.q-public-source-card[data-source="ecb"]');
   await card.waitFor({state:'visible',timeout:30000});
   assert.match(await panel.innerText(),/Reference date 2026-10-06 · daily/);assert.doesNotMatch(await panel.innerText(),/Observed: Not supplied|Observed.*00:00/);
   assert.match(await card.innerText(),/European Central Bank/);assert.match(await card.innerText(),/EUR \/ USD/);assert.match(await card.innerText(),/Reference date 2026-10-06 · daily/);assert.doesNotMatch(await card.innerText(),/No current observations were returned/);
   assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.screenshot({path:out+'/market-ecb-'+width+'-'+appearance+'.png',fullPage:true});
   missing=true;await page.reload({waitUntil:'domcontentloaded'});await page.getByText('ECB observations unavailable',{exact:true}).first().waitFor({state:'visible',timeout:30000});
   await page.locator('.q-public-source-card[data-source="ecb"]').waitFor({state:'visible',timeout:30000});assert.equal(await page.locator('.q-v7-rate-card').count(),0);
   assert.match(await page.locator('.q-v7-reference-panel').innerText(),/Reference date not supplied/);assert.equal(await page.locator('[data-public-source-status]').innerText(),'0 SOURCES AVAILABLE');assert.equal(writes,0,'Unexpected API mutations: '+JSON.stringify(mutations));
   results.push({width,appearance,status:'passed',referenceDate:'2026-10-06',intradayTimestampInvented:false,ecbSourceAttributed:true,missingObservationsFailClosed:true,writes});
  }catch(error){results.push({width,appearance,status:'failed',error:error.message});throw error;}finally{await context.close();}
 }
}finally{
 const status=results.length===4&&results.every(row=>row.status==='passed')?'passed':'failed';
 await writeFile(out+'/report.json',JSON.stringify({releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,status,cases:results.length,results,syntheticFixtures:true},null,2)+'\n');
 console.log(JSON.stringify({marketEcbReferenceCases:results.length,status}));await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
