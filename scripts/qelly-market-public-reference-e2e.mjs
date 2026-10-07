import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ecbReferenceCaption,ecbReferenceDay,ecbReferenceRates} from '../apps/web/public/assets/market-ecb-reference.mjs';
const site=process.env.PUBLIC_URL,sha=process.env.RELEASE_SHA,out='preview/market-public-reference-e2e';
if(site!=='https://terminal.qellyintelligence.com'||!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Exact canonical release required');
const get=async path=>{const response=await fetch(site+path,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);return response.json();};
const guard=async()=>assert.equal((await get('/qelly-release.json?verify='+sha)).releaseSha,sha);
await guard();await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const width of [1440,390])for(const appearance of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(value=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:value})),appearance);
  const page=await context.newPage();let protectedWrites=0;
  await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD','OPTIONS'].includes(request.method())&&(url.pathname.startsWith('/api/v1/')||url.hostname.endsWith('.supabase.co'))){protectedWrites++;return route.abort('blockedbyclient');}return route.continue();});
  try{
   const providerResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/providers/ecb'&&response.request().method()==='GET',{timeout:45000});
   const networkResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/market/network'&&response.request().method()==='GET',{timeout:45000});
   const response=await page.goto(site+'/?verify='+sha+'#/market',{waitUntil:'domcontentloaded',timeout:45000});assert.equal(response.status(),200);
   await page.locator('[data-market-runtime="v7-public-no-fabrication"]').waitFor({state:'visible',timeout:45000});
   const providerReply=await providerResponse,networkReply=await networkResponse;assert.equal(providerReply.status(),200);assert.equal(networkReply.status(),200);
   const source=await providerReply.json(),networkSource=(await networkReply.json()).sources?.ecb;
   const day=ecbReferenceDay(source),rates=ecbReferenceRates(source),networkDay=ecbReferenceDay(networkSource),networkRates=ecbReferenceRates(networkSource);
   assert.ok(day&&rates.length&&networkDay&&networkRates.length,'Actual independently dated provider references must be supplied');
   const panel=page.locator('.q-v7-reference-panel'),card=page.locator('.q-public-source-card[data-source="ecb"]');await card.waitFor({state:'visible',timeout:45000});
   assert.equal(await page.locator('html').getAttribute('data-resolved-appearance'),appearance);
   assert.match(await card.innerText(),/European Central Bank/);assert.doesNotMatch(await card.innerText(),/No current observations were returned/);
   for(const [area,observations,origin] of [[panel,rates,source],[card,networkRates,networkSource]]){
    assert.equal(await area.locator('.q-v7-rate-card').count(),observations.length);
    for(const [code,rate] of observations){const row=area.locator('.q-v7-rate-card').filter({hasText:'EUR / '+code});assert.equal(await row.locator('small').innerText(),ecbReferenceCaption(origin));assert.equal(await row.locator('strong').innerText(),new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(rate));}
   }
   assert.match(await panel.innerText(),/Intraday observation time not supplied/);assert.match(await panel.innerText(),/Retrieved:/);assert.doesNotMatch(await panel.innerText(),/Observed: Not supplied/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(protectedWrites,0);
   await page.screenshot({path:out+'/market-reference-'+width+'-'+appearance+'.png',fullPage:true});
   results.push({width,appearance,status:'passed',referenceDate:day,networkReferenceDate:networkDay,sourceSpecificReferencesVerified:true,displayedProviderRates:rates.length,displayedNetworkProviderRates:networkRates.length,intradayTimestampInvented:false,providerValuesMatched:true,protectedWrites});
  }finally{await context.close();}
 }
 await guard();
}finally{
 const status=results.length===4&&results.every(row=>row.status==='passed'&&row.protectedWrites===0)?'passed':'failed';
 await writeFile(out+'/report.json',JSON.stringify({releaseSha:sha,site,status,cases:results.length,results,syntheticProvider:false},null,2)+'\n');console.log(JSON.stringify({releaseSha:sha,actualMarketReferenceCases:results.length,status}));await browser.close();
}
