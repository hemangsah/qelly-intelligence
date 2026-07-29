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
const routes=['feature-universe','market','asset-rankings','theme-personas','theme-lab','live-markets'];
const themes=['dark','light','oled','high-contrast'];
const records=[];
try{
  for(const [browserName,type] of browsers){
    const browser=await type.launch({headless:true});
    for(const [width,height] of viewports){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      for(const appearance of themes){
        const page=await context.newPage();
        const consoleErrors=[],pageErrors=[],failed=[];
        page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
        page.on('pageerror',e=>pageErrors.push(e.message));
        page.on('requestfailed',r=>{if(r.url().startsWith(base))failed.push({url:r.url(),error:r.failure()?.errorText})});
        await page.addInitScript((value)=>{localStorage.setItem('qelly-appearance',value);localStorage.setItem('qelly-opening-seen','true');},appearance);
        for(const route of routes){
          await page.goto(`${base}/#/${route}`,{waitUntil:'domcontentloaded',timeout:30000});
          await page.waitForSelector('#main',{timeout:20000});
          if(route==='live-markets'){
            await page.waitForSelector('#live-provider',{timeout:20000});
            await page.selectOption('#live-provider','fixture');
            await page.waitForTimeout(250);
          }else await page.waitForTimeout(100);
          const measurement=await page.evaluate(()=>{const html=document.documentElement,main=document.querySelector('#main');return {text:(main?.textContent||'').trim().length,overflow:Math.max(0,html.scrollWidth-html.clientWidth),font:document.fonts.status,appearance:html.dataset.resolvedAppearance||html.dataset.appearance||'',logo:Boolean(document.querySelector('.q-brand-lockup,.q-app-brand,img[src*="qelly"]'))};});
          const text=await page.locator('#main').textContent();
          const truth=route!=='live-markets'||(/Illustrative watch universe/.test(text)&&/not provider observations/.test(text)&&!/Live watch universe/.test(text));
          records.push({browser:browserName,width,height,appearance,route,...measurement,truth,consoleErrors:[...consoleErrors],pageErrors:[...pageErrors],failedResources:[...failed]});
          consoleErrors.length=0;pageErrors.length=0;failed.length=0;
        }
        await page.close();
      }
      await context.close();
    }
    await browser.close();
  }
}finally{await new Promise(r=>server.close(r));await rm(runtimePath,{recursive:true,force:true});}
const failures=records.filter(r=>r.text===0||r.overflow>1||r.font!=='loaded'||!r.truth||r.consoleErrors.length||r.pageErrors.length||r.failedResources.length);
await mkdir('.prompt2a-closeout',{recursive:true});
await writeFile('.prompt2a-closeout/FINAL_MAIN_BROWSER_MATRIX.json',JSON.stringify({schemaVersion:1,head:expected,recordCount:records.length,passed:records.length-failures.length,failed:failures.length,records,failures},null,2)+'\n');
console.log(JSON.stringify({records:records.length,failures:failures.length},null,2));
if(failures.length)process.exit(1);
