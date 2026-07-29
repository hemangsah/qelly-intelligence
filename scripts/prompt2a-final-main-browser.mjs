import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startServer } from '../src/server/server.mjs';

const expected=process.env.EXPECTED_MAIN;
const runtimePath=await mkdtemp(path.join(os.tmpdir(),'qelly-prompt2a-final-main-'));
const {server,host,port}=await startServer({port:0,runtimePath});
const base=`http://${host}:${port}`;
const browsers=[['chromium',chromium],['firefox',firefox],['webkit',webkit]];
const viewports=[[360,800],[390,844],[430,932],[768,1024],[1024,768],[1440,1000]];
const themes=['dark','light','oled','high-contrast'];
const records=[];
try{
  for(const [browserName,type] of browsers){
    const browser=await type.launch({headless:true});
    for(const [width,height] of viewports){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      const page=await context.newPage();
      const consoleErrors=[],pageErrors=[],failed=[];
      await page.route('https://unpkg.com/**',route=>route.abort('blockedbyclient'));
      page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
      page.on('pageerror',e=>pageErrors.push(e.message));
      page.on('requestfailed',r=>{if(r.url().startsWith(base))failed.push({url:r.url(),error:r.failure()?.errorText})});
      await page.addInitScript(()=>sessionStorage.setItem('qelly.brand.opening.v1','seen'));
      await page.goto(`${base}/#/live-markets`,{waitUntil:'commit',timeout:20000});
      await page.waitForSelector('#live-provider',{state:'attached',timeout:20000});
      await page.evaluate(()=>{const select=document.querySelector('#live-provider');select.value='fixture';select.dispatchEvent(new Event('change',{bubbles:true}));});
      await page.waitForSelector('.q-live-fallback',{state:'attached',timeout:10000});
      await page.evaluate(()=>document.fonts.ready);
      for(const appearance of themes){
        await page.evaluate((value)=>{localStorage.setItem('qelly-appearance',value);const root=document.documentElement;root.dataset.appearance=value;root.dataset.resolvedAppearance=value;},appearance);
        await page.waitForTimeout(60);
        const measurement=await page.evaluate(()=>{const html=document.documentElement,main=document.querySelector('#main');const text=(main?.textContent||'').trim();return {textLength:text.length,overflow:Math.max(0,html.scrollWidth-html.clientWidth),font:document.fonts.status,appearance:html.dataset.resolvedAppearance||html.dataset.appearance||'',logo:Boolean(document.querySelector('.q-brand-lockup,.q-app-brand,img[src*="qelly"]')),truth:/Illustrative watch universe/.test(text)&&/not provider observations/.test(text)&&!/Live watch universe/.test(text),executionDisabled:/Execution\s*Disabled/.test(text),noCustody:/No order placement, API keys, balances, transfers, withdrawals, private keys or wallet custody/.test(text),fallbackRenderer:Boolean(document.querySelector('.q-live-fallback'))};});
        const expectedExternalErrors=consoleErrors.filter(message=>/unpkg\.com|lightweight-charts|Failed to load resource|ERR_BLOCKED_BY_CLIENT/i.test(message));
        const unexpectedConsoleErrors=consoleErrors.filter(message=>!/unpkg\.com|lightweight-charts|Failed to load resource|ERR_BLOCKED_BY_CLIENT/i.test(message));
        records.push({browser:browserName,width,height,appearance,route:'live-markets',...measurement,expectedExternalErrors,unexpectedConsoleErrors,pageErrors:[...pageErrors],failedRequiredResources:[...failed]});
        consoleErrors.length=0;pageErrors.length=0;failed.length=0;
      }
      await context.close();
    }
    await browser.close();
  }
}finally{await new Promise(r=>server.close(r));await rm(runtimePath,{recursive:true,force:true});}
const failures=records.filter(r=>r.textLength===0||r.overflow>1||r.font!=='loaded'||!r.truth||!r.executionDisabled||!r.noCustody||!r.fallbackRenderer||r.unexpectedConsoleErrors.length||r.pageErrors.length||r.failedRequiredResources.length);
await mkdir('.prompt2a-closeout',{recursive:true});
await writeFile('.prompt2a-closeout/FINAL_MAIN_BROWSER_MATRIX.json',JSON.stringify({schemaVersion:1,head:expected,scope:'affected live-markets truth route; broad 549-record regression retained from PR20 exact product tree',recordCount:records.length,passed:records.length-failures.length,failed:failures.length,expectedExternalFallbackRecords:records.filter(r=>r.expectedExternalErrors.length).length,records,failures},null,2)+'\n');
console.log(JSON.stringify({records:records.length,failures:failures.length,expectedExternalFallbackRecords:records.filter(r=>r.expectedExternalErrors.length).length},null,2));
if(failures.length)process.exit(1);
