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
    for(const width of [1440,390,320])for(const appearance of ['dark','light']){
      const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
      await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
      const page=await context.newPage();let posts=0,appearanceControlInitiallyDisabled=null;const pageErrors=[];
      page.on('pageerror',error=>pageErrors.push(error.message));
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
        const trigger=page.locator('[data-v8-appearance]');
        await trigger.waitFor({state:'visible'});
        if(await page.locator('html').getAttribute('data-resolved-appearance')!==appearance){
          await page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true}).click();
        }
        await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
        await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');
        await page.locator('.qelly-opening').waitFor({state:'hidden'});
        // An isolated page control reproduces the dock hit-test collision without sending a message.
        const clearanceGeometry=await page.evaluate(()=>{
          document.dispatchEvent(new CustomEvent('qelly:chat-clearance',{detail:{state:'clear'}}));
          const launcher=document.querySelector('[data-q-ai-launcher]'),box=launcher.getBoundingClientRect(),bottom=parseFloat(getComputedStyle(launcher).bottom)||0;
          const control=document.createElement('button');control.id='chat-control-clearance-fixture';control.textContent='Page control under dock';
          Object.assign(control.style,{position:'fixed',left:((innerWidth-box.width)/2+10)+'px',top:(innerHeight-bottom-box.height+5)+'px',width:'160px',height:'44px',zIndex:'2'});
          document.querySelector('main#main').append(control);return{left:parseFloat(control.style.left)+20,top:parseFloat(control.style.top)+20};
        });
        await page.waitForFunction(()=>document.querySelector('.q-ai-root').dataset.clearance==='interactive');
        await page.waitForFunction(()=>{const s=getComputedStyle(document.querySelector('[data-q-ai-launcher]'));return Number(s.opacity)===0&&s.pointerEvents==='none';});
        const clearance=await page.evaluate(({left,top})=>{const launcher=document.querySelector('[data-q-ai-launcher]'),style=getComputedStyle(launcher);return{state:launcher.closest('.q-ai-root').dataset.clearance,opacity:Number(style.opacity),pointerEvents:style.pointerEvents,tabIndex:launcher.tabIndex,ariaHidden:launcher.getAttribute('aria-hidden'),controlHit:document.elementFromPoint(left,top)?.id==='chat-control-clearance-fixture'};},clearanceGeometry);
        assert.equal(clearance.controlHit,true,'Page control must receive pointer hit-testing when dock is blocked');assert.equal(clearance.tabIndex,-1);assert.equal(clearance.ariaHidden,'true');
        await page.locator('#chat-control-clearance-fixture').evaluate(node=>node.remove());
        await page.evaluate(()=>{const fixture=document.createElement('button');fixture.id='chat-preexisting-inert-fixture';fixture.inert=true;fixture.textContent='Inert fixture';document.body.append(fixture);});
        await page.evaluate(()=>{const modal=document.createElement('dialog');modal.id='chat-native-modal-fixture';modal.innerHTML='<button>Native modal fixture</button>';document.body.append(modal);modal.showModal();});
        await page.locator('#chat-native-modal-fixture button').focus();
        await page.keyboard.press('Control+/');
        assert.equal(await page.locator('[data-q-ai-assistant]').evaluate(node=>node.hidden),true,'Chat must defer to an open native modal');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>!document.querySelector('#chat-native-modal-fixture').open);
        await page.locator('#chat-native-modal-fixture').evaluate(node=>node.remove());
        appearanceControlInitiallyDisabled=await trigger.evaluate(node=>node.disabled);
        await page.waitForFunction(()=>{const button=document.querySelector('[data-v8-appearance]');return button&&!button.disabled;});
        await trigger.focus();
        assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,'Prior control must own focus before opening Chat');
        await page.keyboard.press('Control+/');
        const panel=page.locator('[data-q-ai-assistant]');
        await panel.waitFor({state:'visible'});
        await page.waitForFunction(()=>document.activeElement?.matches('[data-q-ai-form] textarea'));
        assert.equal(await panel.getAttribute('aria-modal'),String(width<=640));
        const panelFit=await panel.evaluate(node=>{const h=node.querySelector('.q-ai-header'),r=node.getBoundingClientRect();return {width:r.width,viewport:innerWidth,client:node.clientWidth,scroll:node.scrollWidth,headerClient:h.clientWidth,headerScroll:h.scrollWidth,closeRight:node.querySelector('[data-q-ai-close]').getBoundingClientRect().right,panelRight:r.right};});
        assert.ok(panelFit.width<=panelFit.viewport+1);assert.ok(panelFit.scroll<=panelFit.client+1);assert.ok(panelFit.headerScroll<=panelFit.headerClient+1);assert.ok(panelFit.closeRight<=panelFit.panelRight+1);

        const backgroundInert=()=>page.locator('main#main').evaluate(node=>!!node.closest('[inert]'));
        assert.equal(await backgroundInert(),width<=640);
        const composerGeometry=async(label)=>{
          const geometry=await panel.evaluate(node=>{
            const rect=(selector)=>{const element=selector===':scope'?node:node.querySelector(selector),box=element.getBoundingClientRect();return {top:box.top,bottom:box.bottom,left:box.left,right:box.right,height:box.height,visible:getComputedStyle(element).display!=='none'};};
            return {panel:rect(':scope'),thread:rect('.q-ai-thread'),composer:rect('.q-ai-composer'),input:rect('.q-ai-composer textarea'),send:rect('[data-q-ai-send]'),footer:rect(':scope > footer')};
          });
          assert.ok(geometry.input.height>=48,`${label}: usable input height`);
          assert.ok(geometry.composer.top>=geometry.thread.bottom-1,`${label}: composer clears the thread`);
          for(const control of [geometry.input,geometry.send]){
            assert.ok(control.top>=geometry.composer.top-1&&control.bottom<=geometry.composer.bottom+1,`${label}: composer contains its controls`);
            assert.ok(control.left>=geometry.panel.left-1&&control.right<=geometry.panel.right+1,`${label}: controls stay inside the panel`);
          }
          assert.ok(geometry.composer.bottom<=geometry.panel.bottom+1,`${label}: composer stays visible`);
          if(geometry.footer.visible)assert.ok(geometry.footer.top>=geometry.composer.bottom-1,`${label}: footer clears composer`);
          return geometry;
        };
        const geometryStates=[];
        geometryStates.push(await composerGeometry('welcome'));
        await panel.locator('[data-q-ai-datasets]').click();
        geometryStates.push(await composerGeometry('evidence open'));
        await panel.locator('[data-q-ai-datasets]').click();
        // Isolated no-message fixture reproduces the optional row hidden after an answer.
        await panel.locator('.q-ai-suggestions').evaluate(node=>{node.hidden=true;});
        geometryStates.push(await composerGeometry('suggestions hidden'));
        await panel.locator('[data-q-ai-datasets]').click();
        geometryStates.push(await composerGeometry('suggestions hidden, evidence open'));
        await panel.locator('[data-q-ai-datasets]').click();
        await panel.locator('.q-ai-suggestions').evaluate(node=>{node.hidden=false;});
        await panel.locator('[data-q-ai-form] textarea').focus();
        if(width<=640){
          for(const key of ['Tab','Shift+Tab'])for(let n=0;n<35;n++){
            await page.keyboard.press(key);
            assert.equal(await panel.evaluate(node=>node.contains(document.activeElement)),true,'Mobile focus must stay inside chat');
          }
          await page.setViewportSize({width:1440,height:900});
          await page.waitForFunction(()=>document.querySelector('[data-q-ai-assistant]').getAttribute('aria-modal')==='false');
          assert.equal(await backgroundInert(),false);
          await page.setViewportSize({width,height:900});
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
        // Restore the same production renderer's answered state without a POST.
        // Citations and Retry expose six actions, unlike the welcome-only state.
        await page.evaluate(()=>sessionStorage.setItem('qelly.intelligence.chat.v1',JSON.stringify([{role:'assistant',content:'Isolated restored-answer containment fixture. '+('unbroken_observation_locator_'.repeat(20)),sources:[{id:'fixture',title:'Fixture citation',url:'https://example.invalid/fixture',truthState:'delayed',observedAt:null,observedDate:'2026-10-05',observationTimePrecision:'date'}],truthState:'model_unavailable_fallback',retryable:true,mode:'ask',asset:'BTC',timeframe:'15m'}])));
        await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('[data-q-ai-launcher]').waitFor({state:'attached'});
        await page.keyboard.press('Control+/');await panel.waitFor({state:'visible'});
        const message=panel.locator('.q-ai-message--assistant');await message.waitFor({state:'visible'});
        await panel.getByRole('button',{name:'Copy citations',exact:true}).waitFor({state:'visible'});
        const containment=await message.evaluate(node=>{
          const rect=node.getBoundingClientRect(),thread=node.closest('.q-ai-thread');
          return {threadWidth:thread.clientWidth,threadScrollWidth:thread.scrollWidth,messageWidth:node.clientWidth,messageScrollWidth:node.scrollWidth,controls:[...node.querySelectorAll('.q-ai-message-tools button')].map(button=>{const box=button.getBoundingClientRect();return {label:button.textContent,left:box.left,right:box.right,height:box.height,clientWidth:button.clientWidth,scrollWidth:button.scrollWidth};}),left:rect.left,right:rect.right};
        });
        assert.ok(containment.threadScrollWidth<=containment.threadWidth+1,'Restored answer must not create horizontal thread scrolling');
        assert.ok(containment.messageScrollWidth<=containment.messageWidth+1,'Restored message content must fit its card');
        assert.equal(containment.controls.length,6);
        const presentation=await panel.evaluate(node=>{
          const style=e=>{const s=getComputedStyle(e);return {borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],fontSize:Number.parseFloat(s.fontSize),shadow:s.boxShadow};};
          return {message:style(node.querySelector('.q-ai-message--assistant')),copy:style(node.querySelector('.q-ai-message-copy')),composer:style(node.querySelector('textarea')),header:style(node.querySelector('.q-ai-header')),controls:[...node.querySelectorAll('.q-ai-message-tools button')].map(e=>({height:e.getBoundingClientRect().height,...style(e)}))};
        });
        for(const item of [presentation.message,presentation.header,presentation.composer,...presentation.controls])assert.deepEqual(item.borders,['0px','0px','0px','0px']);
        assert.equal(presentation.message.shadow,'none');assert.ok(presentation.copy.fontSize>=16);assert.ok(presentation.composer.fontSize>=16);for(const control of presentation.controls)assert.ok(control.height>=44);

        for(const control of containment.controls){assert.ok(control.left>=containment.left-1&&control.right<=containment.right+1,control.label+' stays within its message');assert.ok(control.scrollWidth<=control.clientWidth+1,control.label+' text is not clipped');}
        await message.locator('.q-ai-message-sources summary').click();
        const citationText=await message.locator('.q-ai-message-sources').innerText();
        assert.match(citationText,/reference date 2026-10-05 · exact publication time unavailable/);
        assert.doesNotMatch(citationText,/2026-10-05T16:00/);
        await page.screenshot({path:`${out}/${route}-${width}-${appearance}-restored-answer.png`,fullPage:true});
        assert.equal(posts,0,'Restored answer acceptance must send no Chat request');
        const newConversation=panel.getByRole('button',{name:'New',exact:true});await newConversation.waitFor({state:'visible'});await newConversation.click();assert.equal(await panel.locator('.q-ai-message').count(),0);assert.equal(await panel.locator('.q-ai-welcome').isVisible(),true);await page.waitForFunction(()=>document.querySelector('.q-ai-thread').scrollTop===0);assert.equal(posts,0);

        results.push({route,width,appearance,status:'passed',posts,composerGeometryStates:geometryStates.length,appearanceControlInitiallyDisabled,messageContainmentChecks:1,referenceDateCases:1,controlClearance:clearance,containment,presentation,newConversationAccessible:true,panelFit});
      }catch(error){
        const diagnostic={route,width,appearance,status:'failed',error:String(error.message),pageErrors,appearanceControlInitiallyDisabled,focus:await page.evaluate(()=>({activeTag:document.activeElement?.tagName,activeLabel:document.activeElement?.getAttribute('aria-label'),appearanceDisabled:document.querySelector('[data-v8-appearance]')?.disabled})),resolvedAppearance:await page.locator('html').getAttribute('data-resolved-appearance')};
        results.push(diagnostic);console.error(JSON.stringify(diagnostic));
        await page.screenshot({path:`${out}/${route}-${width}-${appearance}-failed.png`,fullPage:true}).catch(()=>{});
        throw error;
      }finally{await context.close();}
    }
  }
}finally{
  const status=results.length===18&&results.every(item=>item.status==='passed')?'passed':'failed';
  await writeFile(`${out}/report.json`,JSON.stringify({schema:'qelly.chat.keyboard-acceptance/1.0',releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||null,fixture:'isolated browser fixture; no chat messages sent',cases:results.length,expectedCases:18,results,status},null,2)+'\n');
  console.log(JSON.stringify({chatKeyboardCases:results.length,status}));
  await browser.close();await new Promise(resolve=>server.server.close(resolve));
  await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
