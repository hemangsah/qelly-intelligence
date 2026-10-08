import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {buildPublicConverter} from '../functions/_lib/public-converter.js';
import {startServer} from './release-a5-evidence-server.mjs';
import {STANDALONE_PUBLIC_PAGES} from './install-standalone-public-shell.mjs';

const out='preview/calculator-input-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[],converterReferenceDateResults=[],publicCalculatorValidationResults=[],publicCalculatorThemeResults=[],publicCalculatorCloudPreferenceResults=[],publicCalculatorShellResults=[],standalonePublicShellResults=[],publicCalculatorHandoffResults=[],authCallbackAppearanceResults=[];
const scenarios=[
  {id:'sip-future-value',inputs:{monthlyContribution:1000,annualReturnPercent:-12,years:1},expected:Array.from({length:12},(_,n)=>1000*0.99**n).reduce((a,b)=>a+b,0)},
  {id:'compound-interest',inputs:{principal:1000,annualRatePercent:-10,years:2,compoundsPerYear:1},expected:810},
  {id:'fx-pip-value',inputs:{units:100000,pipSize:0.0001,quoteToAccountRate:1.25},expected:12.5},
  {id:'kelly-criterion',inputs:{winProbability:101},reject:true}
];
try{
  for(const scenario of scenarios)for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
    const page=await context.newPage();let writes=0;
    page.on('request',request=>{if(request.method()==='POST'&&/\/api\/v1\/(intelligence\/chat|user\/calculations)/.test(new URL(request.url()).pathname))writes++;});
    await context.route('**/api/v1/user/layout-preferences',async route=>{
      if(route.request().method()!=='GET')return route.continue();
      const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),appearance}});
    });
    try{
      await page.goto(`http://127.0.0.1:${server.port}/#/calculator-detail/${scenario.id}`,{waitUntil:'domcontentloaded'});
      await page.locator('#calculator-structured-form').waitFor({state:'visible',timeout:30000});
      await page.locator('[data-v8-appearance]').waitFor({state:'visible'});
      if(await page.locator('html').getAttribute('data-resolved-appearance')!==appearance)await page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true}).click();
      await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
      for(const [key,value] of Object.entries(scenario.inputs)){
        const field=page.locator('#calculator-field-'+key);
        if(await field.evaluate(node=>node.tagName)==='SELECT')await field.selectOption(String(value));else await field.fill(String(value));
      }
      if(scenario.id==='fx-pip-value')assert.match(await page.locator('label[for="calculator-field-quoteToAccountRate"]').innerText(),/ratio/);
      await page.locator('[data-action="calculate"]').click();
      if(scenario.reject){
        assert.equal(await page.locator('#calculator-field-winProbability').evaluate(node=>node.validity.rangeOverflow),true);
        assert.match(await page.locator('#calculator-detail-errors').innerText(),/correct the highlighted values/);
        assert.equal(await page.locator('[data-action="save"]').isDisabled(),true);
        assert.equal(await page.locator('[data-action="json"]').isDisabled(),true);
        assert.equal(await page.locator('[data-action="save"]').getAttribute('aria-disabled'),'true');
      }else{
        await page.waitForFunction(()=>document.querySelector('#calculator-detail-evidence').classList.contains('q-calculation-result-list'));
        const number=Number((await page.locator('.q-calculation-result strong').first().innerText()).replaceAll(',',''));
        assert.ok(Math.abs(number-scenario.expected)<0.011,`${scenario.id}: ${number} differs from ${scenario.expected}`);
        assert.equal(await page.locator('#calculator-detail-errors').innerText(),'');
        assert.equal(await page.locator('[data-action="save"]').isEnabled(),true);
        for(const action of ['save','copy','json','csv','share']){
          assert.equal(await page.locator(`[data-action="${action}"]`).isEnabled(),true);
          assert.equal(await page.locator(`[data-action="${action}"]`).getAttribute('aria-disabled'),'false');
        }
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      assert.equal(writes,0,'Calculator acceptance must not save data or send chat');
      await page.screenshot({path:`${out}/${scenario.id}-${width}-${appearance}.png`,fullPage:true});
      if(!scenario.reject){
        await page.locator('[data-action="reset"]').click();
        for(const action of ['save','copy','json','csv','share']){
          assert.equal(await page.locator(`[data-action="${action}"]`).isDisabled(),true);
          assert.equal(await page.locator(`[data-action="${action}"]`).getAttribute('aria-disabled'),'true');
        }
      }
      results.push({formulaId:scenario.id,width,appearance,status:'passed',writes});
    }catch(error){results.push({formulaId:scenario.id,width,appearance,status:'failed',error:error.message});await page.screenshot({path:`${out}/${scenario.id}-${width}-${appearance}-failed.png`,fullPage:true}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
    const page=await context.newPage();let writes=0;
    page.on('request',request=>{if(request.method()==='POST'&&/\/api\/v1\/(intelligence\/chat|user\/calculations)/.test(new URL(request.url()).pathname))writes++;});
    await context.route('**/api/v1/user/layout-preferences',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),appearance}});});
    const fixture=buildPublicConverter({truthState:'cached_provider',observationTime:'2026-10-05T16:00:00.000Z',ingestionTime:'2026-10-05T15:00:00.000Z',data:{date:'2026-10-05',base:'EUR',rates:{USD:1.12,INR:107.89}}});
    await context.route('**/api/v1/discovery/converter',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
    try{
      await page.goto('http://127.0.0.1:'+server.port+'/#/converter',{waitUntil:'domcontentloaded'});
      await page.locator('[data-converter-state="reference-workbench-available"]').waitFor({state:'visible',timeout:30000});
      await page.locator('[data-v8-appearance]').waitFor({state:'visible'});
      if(await page.locator('html').getAttribute('data-resolved-appearance')!==appearance)await page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true}).click();
      await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
      const metrics=await page.locator('.q-cv-metrics').innerText(),receipt=await page.locator('.q-cv-audit').innerText();
      for(const text of [metrics,receipt]){assert.match(text,/Reference date/);assert.match(text,/2026-10-05/);assert.match(text,/Exact publication time unavailable/);}
      assert.equal(fixture.observation.observedAt,null);assert.equal(fixture.observation.observationTimePrecision,'date');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(writes,0);
      await page.screenshot({path:out+'/converter-reference-date-'+width+'-'+appearance+'.png',fullPage:true});
      converterReferenceDateResults.push({width,appearance,status:'passed',writes,fixture:'synthetic date-only ECB reference'});
    }catch(error){converterReferenceDateResults.push({width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }
  for(const width of [1440,390])for(const colorScheme of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme,reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();let writes=0;
    page.on('request',request=>{if(request.method()==='POST')writes++;});
    const url=`http://127.0.0.1:${server.port}/calculators/kelly-criterion-calculator/index.html`;
    const status=page.locator('[data-calculator-status]'),output=page.locator('[data-calculator-result]');
    try{
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('[data-calculator-status]')?.dataset.state==='success');
      await page.locator('#calc-winProbability').fill('');await page.getByRole('button',{name:'Calculate',exact:true}).click();
      assert.equal(await status.getAttribute('data-state'),'error');assert.match(await output.innerText(),/required/);assert.equal(await output.locator('article').count(),0);
      await page.screenshot({path:`${out}/public-required-blank-${width}-${colorScheme}.png`,fullPage:true});
      await page.locator('#calc-winProbability').fill('0');await page.getByRole('button',{name:'Calculate',exact:true}).click();
      assert.equal(await status.getAttribute('data-state'),'success');assert.match(await output.innerText(),/-0.555556/);
      await page.getByRole('button',{name:'Reset',exact:true}).click();
      assert.equal(await page.locator('#calc-winProbability').inputValue(),'55');assert.equal(await status.getAttribute('data-state'),'success');
      await page.locator('#calc-fraction').fill('');await page.locator('#calc-maximumRiskPercent').fill('');await page.getByRole('button',{name:'Calculate',exact:true}).click();
      assert.equal(await status.getAttribute('data-state'),'success');assert.match(await output.innerText(),/0.15/);assert.match(await output.innerText(),/0.25/);
      await page.goto(url+'#q='+encodeURIComponent(JSON.stringify({winProbability:101})),{waitUntil:'domcontentloaded'});await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('[data-calculator-status]')?.dataset.state==='error');
      assert.equal(await output.locator('article').count(),0);assert.doesNotMatch(await status.innerText(),/Loaded shared inputs/);
      await page.screenshot({path:`${out}/public-invalid-shared-${width}-${colorScheme}.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(writes,0);
      publicCalculatorValidationResults.push({width,colorScheme,status:'passed',writes,checks:['required-blank','explicit-zero','registered-reset','optional-defaults','invalid-shared-state']});
    }catch(error){publicCalculatorValidationResults.push({width,colorScheme,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }

  for(const surface of ['library','calculator'])for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>{if(!localStorage.getItem('qelly.theme-intelligence.v2'))localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value}));},appearance);
    await context.route('**/api/v1/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({auth:{authenticated:false}})}));
    const page=await context.newPage();let writes=0;page.on('request',request=>{if(request.method()==='POST'||request.method()==='PUT')writes++;});
    try{
      const pathname=surface==='library'?'/calculators/index.html':'/calculators/kelly-criterion-calculator/index.html';
      await page.goto('http://127.0.0.1:'+server.port+pathname,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
      const title=await page.title();
      const colors=await page.locator(surface==='library'?'.q-cn-directory-grid>a':'.q-cn-card').first().evaluate(node=>({text:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor}));
      const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
      const foreground=luminance(colors.text),background=luminance(colors.background),contrast=(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
      assert.ok(contrast>=4.5,'Actual public calculator text must meet contrast');
      await page.screenshot({path:out+'/public-theme-'+surface+'-'+width+'-'+appearance+'.png',fullPage:true});
      const next=appearance==='light'?'dark':'light';
      await page.getByRole('button',{name:'Switch to '+next+' appearance',exact:true}).click();
      await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,next);
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,next);
      assert.equal(await page.title(),title);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(writes,0);
      if(surface==='calculator')assert.equal(await page.locator('[data-calculator-status]').getAttribute('data-state'),'success');
      publicCalculatorThemeResults.push({surface,width,appearance,persistedAppearance:next,contrast,status:'passed',writes});
    }catch(error){publicCalculatorThemeResults.push({surface,width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }

  for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    let saved={appearance,revision:1},deny=false;const writes=[];
    await context.route('**/api/v1/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({auth:{authenticated:true},csrf:{token:'synthetic-theme-csrf'}})}));
    await context.route('**/api/v1/preferences/layout',async route=>{
      if(route.request().method()==='PUT'){
        const request=route.request(),body=request.postDataJSON();writes.push({body,csrf:request.headers()['x-qelly-csrf'],revision:request.headers()['if-match-revision'],denied:deny});
        if(deny)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic revision conflict'}})});
        saved={...body,revision:saved.revision+1};
      }
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(saved)});
    });
    const page=await context.newPage();
    try{
      await page.goto('http://127.0.0.1:'+server.port+'/calculators/kelly-criterion-calculator/index.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance);
      const next=appearance==='light'?'dark':'light';
      const savedResponse=page.waitForResponse(response=>response.url().endsWith('/api/v1/preferences/layout')&&response.request().method()==='PUT');
      await page.getByRole('button',{name:'Switch to '+next+' appearance',exact:true}).click();assert.equal((await savedResponse).status(),200);
      assert.equal(writes.length,1);assert.equal(writes[0].csrf,'synthetic-theme-csrf');assert.equal(writes[0].revision,'1');assert.equal(writes[0].body.appearance,next);assert.doesNotMatch(JSON.stringify(writes[0].body),/winProbability|averageWin|calculator|locationHash/);
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,next);
      deny=true;const deniedResponse=page.waitForResponse(response=>response.url().endsWith('/api/v1/preferences/layout')&&response.request().method()==='PUT');
      await page.getByRole('button',{name:'Switch to '+appearance+' appearance',exact:true}).click();assert.equal((await deniedResponse).status(),409);
      await page.waitForFunction(()=>document.querySelector('[data-public-appearance]').title.includes('cloud preference save failed'));
      assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance);assert.equal(saved.appearance,next);assert.equal(writes.length,2);assert.equal(writes[1].revision,'2');
      await page.screenshot({path:out+'/public-cloud-theme-failure-'+width+'-'+appearance+'.png',fullPage:true});
      deny=false;const retryResponse=page.waitForResponse(response=>response.url().endsWith('/api/v1/preferences/layout')&&response.request().method()==='PUT');
      await page.getByRole('button',{name:'Switch to '+next+' appearance',exact:true}).click();assert.equal((await retryResponse).status(),200);
      assert.equal(writes.length,3);assert.equal(writes[2].revision,'2');assert.equal(saved.appearance,next);assert.equal(await page.locator('[data-public-appearance]').getAttribute('title'),'');
      publicCalculatorCloudPreferenceResults.push({width,appearance,status:'passed',fixtureOnly:true,realWrites:0,successfulPreferenceWrites:2,failedPreferenceWrites:1,csrfPreserved:true,revisionPreserved:true,calculatorValuesExcluded:true,failedSaveStayedLocal:true,explicitRetryRecovered:true});
    }catch(error){publicCalculatorCloudPreferenceResults.push({width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }
  for(const surface of ['library','calculator'])for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
    await context.route('**/api/v1/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({auth:{authenticated:false},csrf:{token:'synthetic-public-shell'}})}));
    await context.route('**/api/v1/intelligence/chat',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assistant:{inferenceAvailable:false},datasets:{connected:0,catalogued:0,items:[]}})}));
    const page=await context.newPage();let writes=0;page.on('request',request=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method()))writes++;});
    try{
      const pathname=surface==='library'?'/calculators/index.html':'/calculators/kelly-criterion-calculator/index.html';
      await page.goto('http://127.0.0.1:'+server.port+pathname,{waitUntil:'domcontentloaded'});
      const title=await page.title(),launcher=page.locator('[data-q-ai-launcher]'),panel=page.locator('[data-q-ai-assistant]');
      await launcher.waitFor({state:'visible'});assert.equal(await launcher.count(),1);assert.equal(await page.locator('.q-cn-global-categories details').count(),5);
      assert.equal(await page.locator('[data-q-ai-launch-meta]').innerText(),surface==='library'?'Financial calculator library':'Kelly Criterion Calculator');
      await page.waitForFunction(()=>Boolean(document.querySelector('.q-ai-root')?.dataset.clearance));
      const dockState=await launcher.evaluate(node=>{const s=getComputedStyle(node);return{clearance:node.closest('.q-ai-root').dataset.clearance,opacity:Number(s.opacity),pointerEvents:s.pointerEvents,tabIndex:node.tabIndex,ariaHidden:node.getAttribute('aria-hidden')};});
      const box=await launcher.boundingBox();assert.ok(Math.abs(box.x+box.width/2-width/2)<2);
      if(dockState.clearance==='clear'){assert.ok(box.y>=0&&box.y+box.height<=900);assert.equal(dockState.ariaHidden,'false');assert.equal(dockState.tabIndex,0);}
      else{assert.ok(['interactive','chart'].includes(dockState.clearance));assert.equal(dockState.opacity,0);assert.equal(dockState.pointerEvents,'none');assert.equal(dockState.ariaHidden,'true');assert.equal(dockState.tabIndex,-1);}
      await page.locator('.q-cn-global-categories summary').first().click();assert.equal(await page.locator('.q-cn-global-categories details[open]').count(),1);
      await page.locator('.q-cn-global-categories summary').first().press('Escape');assert.equal(await page.locator('.q-cn-global-categories details[open]').count(),0);
      if(surface==='calculator')await page.locator('#calc-winProbability').fill('17.25');
      if(await launcher.getAttribute('aria-hidden')==='true')await page.keyboard.press('Control+/');else await launcher.click();await panel.waitFor({state:'visible'});
      await page.waitForFunction(()=>[...document.querySelectorAll('.q-ai-root img')].every(image=>image.complete&&image.naturalWidth>0));
      const draft=await page.locator('[data-q-ai-form] textarea').inputValue();assert.doesNotMatch(draft,/17\.25|winProbability|averageWin/);
      assert.equal(await page.getByRole('button',{name:'Send question',exact:true}).count(),1);
      const geometry=await panel.boundingBox();assert.ok(geometry.x>=-1&&geometry.y>=-1&&geometry.x+geometry.width<=width+1&&geometry.y+geometry.height<=901);
      if(width===390){assert.equal(await panel.getAttribute('aria-modal'),'true');assert.equal(await page.locator('#main').evaluate(node=>node.inert),true);}
      await page.screenshot({path:out+'/public-shell-'+surface+'-'+width+'-'+appearance+'.png',fullPage:false});
      await page.locator('[data-q-ai-form] textarea').press('Escape');assert.equal(await panel.isVisible(),false);
      if(width===390)assert.equal(await page.locator('#main').evaluate(node=>node.inert),false);
      assert.equal(await page.title(),title);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(writes,0);
      publicCalculatorShellResults.push({surface,width,appearance,status:'passed',writes,oneSharedAssistant:true,centered:true,categories:5,inputValuesExcluded:true,keyboardClose:true,mobileBoundaryRestored:true});
    }catch(error){publicCalculatorShellResults.push({surface,width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }

  for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
    await context.route('**/api/v1/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({auth:{authenticated:false},csrf:{token:'synthetic-receipt-handoff'}})}));
    await context.route('**/api/v1/intelligence/chat',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assistant:{inferenceAvailable:false},datasets:{connected:0,catalogued:0,items:[]}})}));
    const page=await context.newPage();let writes=0;page.on('request',request=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method()))writes++;});
    try{
      await page.goto('http://127.0.0.1:'+server.port+'/calculators/kelly-criterion-calculator/index.html',{waitUntil:'domcontentloaded'});
      const explain=page.locator('[data-explain-result]'),input=page.locator('[data-q-ai-form] textarea'),panel=page.locator('[data-q-ai-assistant]');
      await page.locator('[data-q-ai-launcher]').waitFor({state:'visible'});
      await page.locator('#calc-winProbability').fill('17.25');await explain.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-explain-result]').disabled);
      assert.equal(await panel.isVisible(),false);await explain.click();await panel.waitFor({state:'visible'});
      const draft=await input.inputValue(),snapshot=JSON.parse(draft.slice(draft.indexOf('\n')+1));
      assert.equal(snapshot.formulaId,'kelly-criterion');assert.equal(snapshot.inputs.winProbability,17.25);assert.equal(snapshot.outputs.fractionalKelly,0);assert.ok(draft.length<=2200);assert.match(await page.locator('[data-explain-status]').innerText(),/Send shares/);
      await page.screenshot({path:out+'/public-receipt-handoff-'+width+'-'+appearance+'.png',fullPage:false});
      await input.fill('Synthetic unsent draft to preserve');await input.press('Escape');await explain.click();assert.equal(await input.inputValue(),'Synthetic unsent draft to preserve');assert.equal(await panel.isVisible(),false);assert.match(await page.locator('[data-explain-status]').innerText(),/preserved/);
      await page.locator('[data-q-ai-launcher]').click();await input.fill('');await input.press('Escape');await page.locator('#calc-winProbability').fill('0');await page.waitForFunction(()=>!document.querySelector('[data-explain-result]').disabled);await explain.click();
      const zero=await input.inputValue(),zeroReceipt=JSON.parse(zero.slice(zero.indexOf('\n')+1));assert.equal(zeroReceipt.inputs.winProbability,0);assert.equal(zeroReceipt.outputs.fractionalKelly,0);await input.press('Escape');
      await page.locator('#calc-winProbability').fill('101');await page.waitForFunction(()=>document.querySelector('[data-calculator-status]').dataset.state==='error');assert.equal(await explain.isEnabled(),false);assert.equal(await panel.isVisible(),false);
      assert.equal(writes,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      publicCalculatorHandoffResults.push({width,appearance,status:'passed',writes,explicitDraft:true,receiptVerified:true,unsentDraftPreserved:true,zeroPreserved:true,invalidDisabled:true});
    }catch(error){publicCalculatorHandoffResults.push({width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }
  for(const surface of STANDALONE_PUBLIC_PAGES)for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
    await context.route('**/api/v1/config',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({auth:{authenticated:false},csrf:{token:'synthetic-standalone-shell'}})}));
    await context.route('**/api/v1/intelligence/chat',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assistant:{inferenceAvailable:false},datasets:{connected:0,catalogued:0,items:[]}})}));
    await context.route('**/api/v1/public/markets/assets/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Synthetic unavailable provider fixture'}})}));
    const page=await context.newPage();let writes=0;page.on('request',request=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method()))writes++;});
    try{
      await page.goto('http://127.0.0.1:'+server.port+'/'+surface.path+'?private=synthetic-context-must-not-copy#synthetic-fragment-must-not-copy',{waitUntil:'domcontentloaded'});
      const title=await page.title(),launcher=page.locator('[data-q-ai-launcher]'),panel=page.locator('[data-q-ai-assistant]');
      await launcher.waitFor({state:'visible'});assert.equal(await launcher.count(),1);assert.equal(await page.locator('.q-cn-global-categories details').count(),5);
      assert.equal(await page.locator('[data-q-ai-launch-meta]').innerText(),title);
      assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance);
      const contrast=await page.evaluate(()=>{
        const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number),linear=value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;},lum=value=>{const c=rgb(value).map(linear);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
        const style=getComputedStyle(document.body),a=lum(style.color),b=lum(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });assert.ok(contrast>=4.5);
      const box=await launcher.boundingBox();assert.ok(Math.abs(box.x+box.width/2-width/2)<2);
      await page.locator('.q-cn-global-categories summary').first().click();assert.equal(await page.locator('.q-cn-global-categories details[open]').count(),1);
      assert.ok((await page.locator('.q-cn-global-categories details[open] a').allTextContents()).every(label=>label.trim().length>0));
      await page.locator('.q-cn-global-categories summary').first().press('Escape');assert.equal(await page.locator('.q-cn-global-categories details[open]').count(),0);
      await launcher.click();await panel.waitFor({state:'visible'});await page.waitForFunction(()=>[...document.querySelectorAll('.q-ai-root img')].every(image=>image.complete&&image.naturalWidth>0));
      const draft=await page.locator('[data-q-ai-form] textarea').inputValue();assert.doesNotMatch(draft,/synthetic-context-must-not-copy|synthetic-fragment-must-not-copy/);
      if(surface.asset)assert.equal(await page.locator('[data-q-ai-asset]').inputValue(),surface.asset);
      const headerTargets=await page.locator('.q-ai-header button:visible').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect(),parent=node.closest('[data-q-ai-assistant]').getBoundingClientRect();return {height:box.height,withinPanel:box.x>=parent.x-1&&box.right<=parent.right+1};}));assert.ok(headerTargets.every(target=>target.height>=44&&target.withinPanel));
      if(width===390){assert.equal(await panel.getAttribute('aria-modal'),'true');assert.equal(await page.locator('#main').evaluate(node=>node.inert),true);}
      const geometry=await panel.boundingBox();assert.ok(geometry.x>=-1&&geometry.y>=-1&&geometry.x+geometry.width<=width+1&&geometry.y+geometry.height<=901);
      await page.screenshot({path:out+'/standalone-shell-'+surface.path.replaceAll('/','-')+'-'+width+'-'+appearance+'.png',fullPage:false});
      await page.locator('[data-q-ai-form] textarea').press('Escape');assert.equal(await panel.isVisible(),false);if(width===390)assert.equal(await page.locator('#main').evaluate(node=>node.inert),false);
      assert.equal(await page.title(),title);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(writes,0);
      standalonePublicShellResults.push({path:surface.path,width,appearance,status:'passed',writes,contrast,titlePreserved:true,categories:5,contextPreserved:true,privateUrlExcluded:true,imagesLoaded:true,mobileBoundaryRestored:true});
    }catch(error){standalonePublicShellResults.push({path:surface.path,width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }
  for(const width of [1440,390])for(const appearance of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(value=>{if(!localStorage.getItem('qelly.theme-intelligence.v2'))localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value}));},appearance);
    const page=await context.newPage();let writes=0;page.on('request',request=>{if(['POST','PUT','PATCH','DELETE'].includes(request.method()))writes++;});
    try{
      await page.goto('http://127.0.0.1:'+server.port+'/auth/callback.html?flow=oauth&private=synthetic-callback-must-not-copy#synthetic-fragment-must-not-copy',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Authentication callback is incomplete',exact:true}).waitFor({state:'visible'});
      assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance);
      assert.equal(await page.locator('[data-q-ai-launcher]').count(),0);assert.equal(await page.locator('[data-q-ai-assistant]').count(),0);
      assert.equal(await page.evaluate(()=>location.search+location.hash),'');assert.doesNotMatch(await page.locator('body').innerText(),/synthetic-callback-must-not-copy|synthetic-fragment-must-not-copy/);
      const contrast=await page.locator('#qelly-auth-callback p').evaluate(node=>{const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number),linear=value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4},lum=value=>{const c=rgb(value).map(linear);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const a=lum(getComputedStyle(node).color),b=lum(getComputedStyle(node.closest('main')).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert.ok(contrast>=4.5);
      const button=page.getByRole('button',{name:'Switch to '+(appearance==='light'?'dark':'light')+' appearance',exact:true});assert.ok((await button.boundingBox()).height>=44);assert.equal(await page.locator('#recovery-form').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.screenshot({path:out+'/auth-callback-'+width+'-'+appearance+'.png',fullPage:false});
      await button.click();assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance==='light'?'dark':'light');
      await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Authentication callback is incomplete',exact:true}).waitFor({state:'visible'});assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance==='light'?'dark':'light');assert.equal(writes,0);
      authCallbackAppearanceResults.push({width,appearance,status:'passed',writes,contrast,callbackUrlCleared:true,privateUrlExcluded:true,noAssistant:true,incompleteLinkFailClosed:true,localThemePersistence:true});
    }catch(error){authCallbackAppearanceResults.push({width,appearance,status:'failed',error:error.message});throw error;}
    finally{await context.close();}
  }
}finally{
  const status=results.length===16&&results.every(item=>item.status==='passed')&&converterReferenceDateResults.length===4&&converterReferenceDateResults.every(item=>item.status==='passed')&&publicCalculatorValidationResults.length===4&&publicCalculatorValidationResults.every(item=>item.status==='passed')&&publicCalculatorThemeResults.length===8&&publicCalculatorThemeResults.every(item=>item.status==='passed')&&publicCalculatorCloudPreferenceResults.length===4&&publicCalculatorCloudPreferenceResults.every(item=>item.status==='passed')&&publicCalculatorShellResults.length===8&&publicCalculatorShellResults.every(item=>item.status==='passed')&&publicCalculatorHandoffResults.length===4&&publicCalculatorHandoffResults.every(item=>item.status==='passed')&&authCallbackAppearanceResults.length===4&&authCallbackAppearanceResults.every(item=>item.status==='passed')&&standalonePublicShellResults.length===44&&standalonePublicShellResults.every(item=>item.status==='passed')?'passed':'failed';
  await writeFile(`${out}/report.json`,JSON.stringify({schema:'qelly.calculator.input-acceptance/1.0',releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||null,expectedCases:16,cases:results.length,status,results,converterReferenceDateCases:converterReferenceDateResults.length,converterReferenceDateResults,publicCalculatorValidationCases:publicCalculatorValidationResults.length,publicCalculatorValidationResults,publicCalculatorThemeCases:publicCalculatorThemeResults.length,publicCalculatorThemeResults,publicCalculatorCloudPreferenceCases:publicCalculatorCloudPreferenceResults.length,publicCalculatorCloudPreferenceResults,publicCalculatorShellCases:publicCalculatorShellResults.length,publicCalculatorShellResults,standalonePublicShellCases:standalonePublicShellResults.length,standalonePublicShellResults,publicCalculatorHandoffCases:publicCalculatorHandoffResults.length,publicCalculatorHandoffResults,authCallbackAppearanceCases:authCallbackAppearanceResults.length,authCallbackAppearanceResults},null,2)+'\n');
  console.log(JSON.stringify({calculatorInputCases:results.length,status}));
  await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
