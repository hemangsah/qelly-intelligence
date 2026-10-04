import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from './release-a5-evidence-server.mjs';

const out='preview/chat-keyboard-e2e';
await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];
try{
  for(const route of ['mt5-report-analyzer','decision-provenance','news-research']){
    for(const width of [1440,390])for(const appearance of ['dark','light']){
      const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
      await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({appearance:value,contrast:'standard',density:'comfortable',chartStyle:'institutional',accent:'rose',fontScale:1,motion:'reduced'})),appearance);
      const page=await context.newPage();let posts=0;
      await context.route('**/api/v1/user/layout-preferences',async route=>{
        if(route.request().method()!=='GET')return route.continue();
        const response=await route.fetch();const preferences=await response.json();
        await route.fulfill({response,json:{...preferences,appearance}});
      });
      page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/intelligence/chat')posts++;});
      try{
        await page.goto(`http://127.0.0.1:${server.port}/#/${route}`,{waitUntil:'domcontentloaded'});
        await page.locator('main#main h1').waitFor({state:'visible',timeout:30000});
        await page.locator('[data-q-ai-launcher]').waitFor({state:'attached'});
        await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
        await page.evaluate(()=>{const fixture=document.createElement('button');fixture.id='chat-preexisting-inert-fixture';fixture.inert=true;fixture.textContent='Inert fixture';document.body.append(fixture);});
        const trigger=page.locator('[data-v8-appearance]');
        await trigger.waitFor({state:'visible'});
        await page.evaluate(()=>{const modal=document.createElement('dialog');modal.id='chat-native-modal-fixture';modal.innerHTML='<button>Native modal fixture</button>';document.body.append(modal);modal.showModal();});
        await page.locator('#chat-native-modal-fixture button').focus();
        await page.keyboard.press('Control+/');
        assert.equal(await page.locator('[data-q-ai-assistant]').evaluate(node=>node.hidden),true,'Chat must defer to an open native modal');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>!document.querySelector('#chat-native-modal-fixture').open);
        await page.locator('#chat-native-modal-fixture').evaluate(node=>node.remove());
        await trigger.focus();await page.keyboard.press('Control+/');
        const panel=page.locator('[data-q-ai-assistant]');
        await panel.waitFor({state:'visible'});
        await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));
        assert.equal(await panel.getAttribute('aria-modal'),String(width===390));
        const backgroundInert=()=>page.locator('main#main').evaluate(node=>!!node.closest('[inert]'));
        assert.equal(await backgroundInert(),width===390);
        if(width===390){
          for(const key of ['Tab','Shift+Tab'])for(let n=0;n<35;n++){
            await page.keyboard.press(key);
            assert.equal(await panel.evaluate(node=>node.contains(document.activeElement)),true,'Mobile focus must stay inside chat');
          }
          await page.setViewportSize({width:1440,height:900});
          await page.waitForFunction(()=>document.querySelector('[data-q-ai-assistant]').getAttribute('aria-modal')==='false');
          assert.equal(await backgroundInert(),false);
          await page.setViewportSize({width:390,height:900});
          await page.waitForFunction(()=>document.querySelector('[data-q-ai-assistant]').getAttribute('aria-modal')==='true');
          assert.equal(await backgroundInert(),true);
        }
        await page.screenshot({path:`${out}/${route}-${width}-${appearance}-open.png`,fullPage:true});
        await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
        assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'Escape must return focus to the prior control');
        assert.equal(await backgroundInert(),false);
        assert.equal(await page.locator('#chat-preexisting-inert-fixture').evaluate(node=>node.inert),true,'Chat must preserve preexisting inert state');
        await page.keyboard.press('Control+/');await panel.waitFor({state:'visible'});
        await page.locator('[data-q-ai-close]').click();await panel.waitFor({state:'hidden'});
        assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'Close button must restore focus');
        assert.equal(await backgroundInert(),false);
        await page.keyboard.press('Control+/');await page.keyboard.press('Escape');
        await page.waitForTimeout(80);
        assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'A cancelled opening timer must not steal restored focus');
        assert.equal(posts,0,'Keyboard checks must send no chat messages');
        results.push({route,width,appearance,status:'passed',posts});
      }catch(error){
        results.push({route,width,appearance,status:'failed',error:String(error.message)});
        await page.screenshot({path:`${out}/${route}-${width}-${appearance}-failed.png`,fullPage:true}).catch(()=>{});
        throw error;
      }finally{await context.close();}
    }
  }
}finally{
  const status=results.length===12&&results.every(item=>item.status==='passed')?'passed':'failed';
  await writeFile(`${out}/report.json`,JSON.stringify({schema:'qelly.chat.keyboard-acceptance/1.0',releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||null,fixture:'isolated browser fixture; no chat messages sent',cases:results.length,expectedCases:12,results,status},null,2)+'\n');
  console.log(JSON.stringify({chatKeyboardCases:results.length,status}));
  await browser.close();await new Promise(resolve=>server.server.close(resolve));
  await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
