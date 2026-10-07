import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/header-pointer-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];let activePage=null;
try{
 for(const appearance of ['dark','light'])for(const scale of [1,1.25,1.5]){
  const width=Math.round(1440/scale),context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
  await context.route('**/api/v1/preferences/layout',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,appearance}});});
  const page=await context.newPage();activePage=page;await page.goto('http://127.0.0.1:'+server.port+'/#/market',{waitUntil:'domcontentloaded'});await page.locator('[data-product-category-toggle="tools"]').waitFor({state:'attached'});
  await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
  for(const name of ['Tools','Decision']){
   const toggle=page.locator('[data-product-category-toggle]').filter({hasText:name==='Decision'?'Decide':name}).first(),category=toggle.locator('..'),menu=category.locator('[data-product-category-menu]');
   for(let i=0;i<25;i++){
    await page.mouse.move(width-10,880);await page.waitForTimeout(280);
    const trigger=await toggle.boundingBox();await page.mouse.move(trigger.x+trigger.width/2,trigger.y+trigger.height/2);await menu.waitFor({state:'visible'});
    const target=await menu.locator('a').first().boundingBox();assert.ok(target);const steps=i%3===0?4:i%3===1?16:32;
    await page.mouse.move(target.x+Math.min(target.width/2,80),target.y+target.height/2,{steps});
    await page.waitForTimeout(i%3===2?350:40);assert.equal(await toggle.getAttribute('aria-expanded'),'true',name+' pointer travel '+i);
   }
   await toggle.focus();await page.keyboard.press('ArrowDown');assert.equal(await menu.locator('a').first().evaluate(n=>n===document.activeElement),true);
   await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(n=>n===document.activeElement),true);
   await page.mouse.move(width-10,880);await page.waitForTimeout(280);
   results.push({appearance,width,layoutScale:scale,zoomBoundary:'Effective viewport emulation; actual browser zoom remains a separate Browser Use acceptance',menu:name,transitions:25,unintendedClosures:0,keyboard:true});
  }
  if(width===1440){const search=await page.locator('.q-product-search').boundingBox();assert.ok(search.width>260,'Desktop search must exceed previous cap');results.push({appearance,width,searchWidth:search.width});}
  await page.screenshot({path:out+'/header-'+appearance+'-'+scale+'.png'});await context.close();
 }
 for(const appearance of ['dark','light']){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:appearance,serviceWorkers:'block'});
  await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
  await context.route('**/api/v1/preferences/layout',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,appearance}});});const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+server.port+'/#/market',{waitUntil:'domcontentloaded'});await page.locator('.q-product-menu').tap();
  await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
  const directory=page.locator('#q-feature-navigation');await directory.waitFor({state:'visible'});
  await directory.locator('[data-feature-domain-filter="tools"]').tap();await directory.locator('[data-feature-route="calculator-center"]').waitFor({state:'visible'});
  await directory.locator('[data-feature-domain-filter="evidence"]').tap();await directory.locator('[data-feature-route="decision-provenance"]').waitFor({state:'visible'});
  results.push({appearance,width:390,touchDirectoryNavigation:true,toolsReachable:true,decisionReachable:true});await context.close();
 }
}catch(error){const diagnostic={status:'failed',error:error.stack,results,ui:await activePage?.evaluate(()=>({focus:document.activeElement?.outerHTML,categories:[...document.querySelectorAll('[data-product-category-toggle]')].map(n=>({text:n.textContent,expanded:n.getAttribute('aria-expanded')}))})).catch(()=>null)};console.error(JSON.stringify(diagnostic));await writeFile(out+'/report.json',JSON.stringify(diagnostic,null,2)+'\n');throw error;}finally{await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));}
await writeFile(out+'/report.json',JSON.stringify({status:'passed',transitions:300,results,boundary:'Isolated production-code fixture; actual preview/production Browser Use, full route E2E and browser zoom remain independently required.'},null,2)+'\n');console.log(JSON.stringify({status:'passed',transitions:300,cases:results.length}));
