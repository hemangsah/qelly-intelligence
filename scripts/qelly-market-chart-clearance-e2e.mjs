import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/market-chart-clearance-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),results=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
let active;
try{
 for(const appearance of ['dark','light'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:600},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
  const page=active=await context.newPage();let nonReadRequests=0;
  await context.route('**/*',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){nonReadRequests++;return route.abort();}return route.continue();});
  // Only isolate the external frame document; do not substitute market observations.
  await context.route('https://www.tradingview-widget.com/embed-widget/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>External frame geometry fixture</title><body>External frame geometry fixture</body>'}));
  await context.route('**/api/v1/user/layout-preferences',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),appearance}});});
  await page.goto(`http://127.0.0.1:${server.port}/#/market`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});
  const plot=page.locator('#main .q-v6-market-tradingview');await plot.waitFor({state:'visible'});await plot.locator('iframe').waitFor({state:'attached'});
  await plot.evaluate(node=>node.scrollIntoView({block:'end',behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.q-ai-root')?.dataset.clearance==='chart');
  const blocked=await page.locator('[data-q-ai-launcher]').evaluate(node=>({opacity:getComputedStyle(node).opacity,pointerEvents:getComputedStyle(node).pointerEvents,tabIndex:node.tabIndex,ariaHidden:node.getAttribute('aria-hidden')}));
  assert.deepEqual(blocked,{opacity:'0',pointerEvents:'none',tabIndex:-1,ariaHidden:'true'});
  const hit=await plot.evaluate(node=>{const b=node.getBoundingClientRect(),x=Math.min(b.right-2,Math.max(b.left+2,innerWidth/2)),y=Math.min(b.bottom-2,innerHeight-42),top=document.elementFromPoint(x,y);return {insidePlot:!!top&&node.contains(top),x,y};});assert.equal(hit.insidePlot,true);
  await page.screenshot({path:`${out}/market-${appearance}-${width}-clear.png`});
  await page.keyboard.press('Control+/');await page.locator('[data-q-ai-assistant]').waitFor({state:'visible'});await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-q-ai-assistant]').evaluate(node=>node.hidden),true);
  await page.keyboard.press('Control+End');await page.waitForFunction(()=>document.querySelector('.q-ai-root')?.dataset.clearance!=='chart');
  assert.equal(nonReadRequests,0);results.push({appearance,width,blocked,plotReceivesPointer:hit.insidePlot,keyboardOpen:true,keyboardClose:true,clearanceRestored:true,nonReadRequests});await context.close();
 }
 await writeFile(out+'/report.json',JSON.stringify({status:'passed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,results,boundary:'Real Market route and existing governed server fixtures; external embedded document isolated for deterministic frame geometry only. No provider chart data or full production visual acceptance is claimed.'},null,2));
}catch(error){if(active&&!active.isClosed())await active.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/report.json',JSON.stringify({status:'failed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,error:error.stack,results},null,2));throw error;}
finally{await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));}
