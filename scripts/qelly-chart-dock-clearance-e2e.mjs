import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/chart-dock-clearance-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];let active;
try{
 for(const appearance of ['dark','light'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
  const page=active=await context.newPage();let nonReadRequests=0;
  await context.route('**/*',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){nonReadRequests++;return route.abort();}return route.continue();});
  await context.route('**/api/v1/user/layout-preferences',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),appearance}});});
  await page.goto(`http://127.0.0.1:${server.port}/#/asset/QI-CRYPTO-BTC`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});
  const plot=page.locator('#asset-chart [data-qelly-chat-plot]');await plot.waitFor({state:'visible'});
  assert.ok(await plot.locator('svg polyline').count()>0,'Existing governed candle series must be plotted');
  const initialPlot=await plot.boundingBox();assert.ok(initialPlot);
  await page.setViewportSize({width,height:Math.max(480,Math.min(900,Math.ceil(initialPlot.y+initialPlot.height)+16))});
  await plot.evaluate(node=>node.scrollIntoView({block:'end',behavior:'instant'}));
  await page.waitForFunction(()=>document.querySelector('.q-ai-root')?.dataset.clearance==='chart');
  const blocked=await page.locator('[data-q-ai-launcher]').evaluate(node=>{const style=getComputedStyle(node);return {opacity:style.opacity,pointerEvents:style.pointerEvents,tabIndex:node.tabIndex,ariaHidden:node.getAttribute('aria-hidden')};});
  assert.equal(blocked.opacity,'0');assert.equal(blocked.pointerEvents,'none');assert.equal(blocked.tabIndex,-1);assert.equal(blocked.ariaHidden,'true');
  const hit=await plot.evaluate(node=>{const b=node.getBoundingClientRect(),x=Math.min(b.right-2,Math.max(b.left+2,innerWidth/2)),y=Math.min(b.bottom-2,innerHeight-42),top=document.elementFromPoint(x,y);return {insidePlot:!!top&&node.contains(top),x,y};});assert.equal(hit.insidePlot,true,'The chart must receive physical hit-testing through the former dock area');
  await page.keyboard.press('Control+/');await page.locator('[data-q-ai-assistant]').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-q-ai-assistant]').evaluate(node=>node.hidden),true);
  await plot.evaluate(node=>node.scrollIntoView({block:'start'}));
  await page.waitForFunction(()=>document.querySelector('.q-ai-root')?.dataset.clearance!=='chart');
  const toggle=page.locator('#asset-chart [data-chart="table"]');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('#asset-chart .q-chart-table tbody tr').count()>0);
  assert.equal(await page.locator('#asset-chart').getByText('Chart shell · adapter contract',{exact:true}).count(),0);
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(nonReadRequests,0);await page.screenshot({path:`${out}/asset-${appearance}-${width}.png`});
  results.push({appearance,width,viewport:page.viewportSize(),blocked,plotReceivesPointer:hit.insidePlot,keyboardOpen:true,keyboardClose:true,clearanceRestored:true,tableToggle:true,engineeringLabelRemoved:true,nonReadRequests});await context.close();
 }
 await writeFile(out+'/report.json',JSON.stringify({status:'passed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,results,boundary:'Actual Asset Dossier component and existing governed fixture responses. Plot clearance, keyboard and data-table interaction only; full Asset Dossier visual redesign and actual production acceptance remain pending.'},null,2));
}catch(error){let geometry=null;if(active&&!active.isClosed()){geometry=await active.evaluate(()=>({width:innerWidth,height:innerHeight,clearance:document.querySelector('.q-ai-root')?.dataset.clearance,plots:[...document.querySelectorAll('[data-qelly-chat-plot]')].map(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,visibility:s.visibility,display:s.display};})})).catch(()=>null);await active.screenshot({path:out+'/failure.png'}).catch(()=>{});}await writeFile(out+'/report.json',JSON.stringify({status:'failed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,error:error.stack,geometry,results},null,2));throw error;}
finally{await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));}
