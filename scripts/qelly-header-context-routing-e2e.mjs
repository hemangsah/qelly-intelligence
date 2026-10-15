import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/header-context-routing-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),site='http://127.0.0.1:'+server.port;
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];let active;
try{
 for(const authenticated of [false,true])for(const appearance of ['dark','light'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});let blockedWrites=0;
  await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
  await context.route('**/*',async r=>{
   const request=r.request(),path=new URL(request.url()).pathname;
   if(!['GET','HEAD','OPTIONS'].includes(request.method())){blockedWrites++;return r.abort();}
   if(path==='/api/v1/config'){
    const response=await r.fetch(),data=await response.json();return r.fulfill({response,json:{...data,auth:{...data.auth,authenticated}}});
   }
   if(path==='/api/v1/session/context')return r.fulfill({json:{user:{userId:'00000000-0000-4000-8000-000000000001',displayName:'Routing fixture',email:'fixture@example.invalid'},workspace:{workspaceId:'00000000-0000-4000-8000-000000000002',name:'Routing fixture'}}});
   if(path==='/api/v1/auth/status')return r.fulfill({json:{authenticated,mode:'isolated-routing-fixture'}});
   if(path==='/api/v1/preferences/layout'){const response=await r.fetch();return r.fulfill({response,json:{...await response.json(),appearance}});}
   if(path==='/api/v1/profile'&&authenticated)return r.fulfill({json:{user:{displayName:'Routing fixture',email:'fixture@example.invalid'},profile:{displayName:'Routing fixture',baseCurrency:'USD',timezone:'UTC'},workspace:{name:'Routing fixture'},session:{},linkedIdentities:[],capabilities:{}}});
   return r.continue();
  });
  const page=active=await context.newPage();
  await page.goto(site+'/#/market',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  const status=page.locator('.q-product-system[data-product-route]');await status.waitFor({state:'attached'});
  assert.equal(await status.getAttribute('data-product-route'),'platform-readiness');
  if(width===1440){
   await status.click();await page.waitForURL('**/#/platform-readiness');
   await page.waitForFunction(()=>document.querySelector('#main')?.dataset.productionRoute==='platform-readiness');
  }else assert.equal(await status.isVisible(),false,'Preserve the existing compact-header visibility rule');
  results.push({authenticated,appearance,width,journey:'header-status',registeredTarget:true,headerClickTested:width===1440,mobileHeaderHiddenAsBefore:width===390});
  for(const route of ['status','auth-login','auth-register','auth-recovery']){
   await page.goto(site+'/#/'+route,{waitUntil:'domcontentloaded'});
   const expected=route==='status'?'platform-readiness':authenticated?'account-session':route;
   await page.waitForURL('**/#/'+expected);
   await page.waitForFunction(expected=>document.querySelector('#main')?.dataset.productionRoute===expected,expected);
   if(authenticated&&route!=='status')await page.locator('.q-v6-account-page').waitFor({state:'visible'});
   const geometry=await page.evaluate(()=>({width:innerWidth,appearance:document.documentElement.dataset.resolvedAppearance,overflow:document.documentElement.scrollWidth>innerWidth+2,legacyStatus:!!document.querySelector('.q-system-page')}));
   assert.equal(geometry.overflow,false);assert.equal(geometry.appearance,appearance);assert.equal(geometry.legacyStatus,false);
   assert.equal(blockedWrites,0,'Routing must not submit profile, login or preference changes');
   await page.screenshot({path:out+'/'+route+'-'+authenticated+'-'+appearance+'-'+width+'.png',fullPage:true});
   results.push({authenticated,appearance,width,journey:route,expected,canonicalRoute:true,...geometry,protectedWrites:0,realAuthenticationTested:false});
  }
  await context.close();active=null;
 }
}catch(error){await active?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}
finally{
 await writeFile(out+'/report.json',JSON.stringify({sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,status:results.length===40?'passed':'failed',results,isolatedUiSessionFixtures:true,realAuthenticationTested:false,newProvidersEnabled:false,numericalEnginesChanged:false,securityConfigurationChanged:false},null,2)+'\n');
 await browser.close();await new Promise(r=>server.server.close(r));await new Promise(r=>server.evidenceUpstream.server.close(r));
}
console.log(JSON.stringify({cases:results.length,passed:true,realAuthenticationTested:false}));
