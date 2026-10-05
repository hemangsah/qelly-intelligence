import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {buildPublicConverter} from '../functions/_lib/public-converter.js';
import {startServer} from './release-a5-evidence-server.mjs';

const out='preview/calculator-input-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[],converterReferenceDateResults=[];
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
}finally{
  const status=results.length===16&&results.every(item=>item.status==='passed')&&converterReferenceDateResults.length===4&&converterReferenceDateResults.every(item=>item.status==='passed')?'passed':'failed';
  await writeFile(`${out}/report.json`,JSON.stringify({schema:'qelly.calculator.input-acceptance/1.0',releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA||null,expectedCases:16,cases:results.length,status,results,converterReferenceDateCases:converterReferenceDateResults.length,converterReferenceDateResults},null,2)+'\n');
  console.log(JSON.stringify({calculatorInputCases:results.length,status}));
  await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));
}
