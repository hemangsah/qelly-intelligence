import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {zipFixture,sheetName} from '../tests/fixtures/mt5-zip-builder.mjs';
const sha=process.env.RELEASE_SHA,site=process.env.PUBLIC_URL,out='preview/mt5-public-duplicate-e2e';
if(!/^[a-f0-9]{40}$/.test(sha||'')||site!=='https://terminal.qellyintelligence.com')throw Error('Exact canonical release required');
const guard=async()=>{const response=await fetch(site+'/qelly-release.json?verify='+sha,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.equal((await response.json()).releaseSha,sha);};
await guard();await mkdir(out,{recursive:true});
const headers=['Time','Deal','Symbol','Type','Direction','Profit'];
const row=(ticket,profit)=>['2026.10.01 10:00',ticket,'EURUSD','buy','out',profit];
const validRows=[headers,row('101',10),row('102',-3)],duplicateRows=[headers,row('101',10),row('101',-3)];
const html=rows=>'<table>'+rows.map(cells=>'<tr>'+cells.map(value=>'<td>'+value+'</td>').join('')+'</tr>').join('')+'</table>';
const sheet=rows=>'<worksheet><sheetData>'+rows.map(cells=>'<row>'+cells.map(value=>'<c t="inlineStr"><is><t>'+value+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
const fixtures=[{name:'synthetic-duplicate.html',mimeType:'text/html',buffer:Buffer.from(html(duplicateRows))},{name:'synthetic-duplicate.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:zipFixture([[sheetName,sheet(duplicateRows)]])}];
const results=[],browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390])for(const appearance of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
  const page=await context.newPage();let protectedWrites=0;
  await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD','OPTIONS'].includes(request.method())&&(url.pathname.startsWith('/api/v1/')||url.hostname.endsWith('.supabase.co'))){protectedWrites++;return route.abort('blockedbyclient');}return route.continue();});
  try{
   const response=await page.goto(site+'/?verify='+sha+'#/mt5-report-analyzer',{waitUntil:'domcontentloaded',timeout:45000});assert.equal(response.status(),200);
   await page.locator('[data-mt5-route-input="A"]').waitFor({state:'visible',timeout:45000});
   await page.waitForFunction(value=>document.documentElement.dataset.resolvedAppearance===value,appearance,{timeout:30000});
   for(const fixture of fixtures){
    for(const slot of ['A','B'])await page.locator('[data-mt5-route-input="'+slot+'"]').setInputFiles({name:'synthetic-valid-'+slot+'.html',mimeType:'text/html',buffer:Buffer.from(html(validRows))});
    await page.locator('.q-mt5-route-primary .q-mt5-report').waitFor({state:'visible',timeout:30000});
    await page.locator('[data-mt5-comparison-result]').waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('[data-mt5-route-export]').isDisabled(),false);
    await page.locator('[data-mt5-route-input="A"]').setInputFiles(fixture);
    await page.waitForFunction(()=>document.querySelector('#q-mt5-route-status-A')?.textContent.includes('Duplicate MT5 closing-deal tickets'),null,{timeout:30000});
    assert.equal(await page.locator('.q-mt5-route-primary').count(),0);assert.equal(await page.locator('[data-mt5-comparison-result]').count(),0);
    for(const action of ['export','note','chat'])assert.equal(await page.locator('[data-mt5-route-'+action+']').isDisabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.screenshot({path:out+'/duplicate-'+width+'-'+appearance+'-'+fixture.name.split('.').at(-1)+'.png',fullPage:true});
    results.push({width,appearance,format:fixture.name.split('.').at(-1),status:'passed',stalePrimaryCleared:true,staleComparisonCleared:true,protectedWrites});
   }
   assert.equal(protectedWrites,0);
  }finally{await context.close();}
 }
 await guard();
}finally{
 const status=results.length===8&&results.every(row=>row.status==='passed'&&row.protectedWrites===0)?'passed':'failed';
 await writeFile(out+'/report.json',JSON.stringify({releaseSha:sha,site,status,cases:results.length,results,syntheticFixtures:true,realBrokerCorpusAccepted:false},null,2)+'\n');console.log(JSON.stringify({releaseSha:sha,publicMt5DuplicateCases:results.length,status}));await browser.close();
}
