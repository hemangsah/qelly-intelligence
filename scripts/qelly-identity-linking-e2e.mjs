import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/identity-linking-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];
const artifactIndex=await readFile('dist/frontend/index.html','utf8');
const styles=[...artifactIndex.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map(match=>`<link rel="stylesheet" href="${match[1].replace(/^\.\//,'/')}">`).join('');
try{
 for(const width of [1440,390])for(const appearance of ['dark','light'])for(const state of ['eligible','disabled','inventory-unavailable']){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,serviceWorkers:'block'});
  const page=await context.newPage();let realIdentityWrites=0;
  page.on('request',request=>{if(new URL(request.url()).pathname==='/api/v1/auth/oauth/link')realIdentityWrites++;});
  const linked={state:state==='inventory-unavailable'?'unavailable':'available',items:[{provider:'email',label:'Email'}],linkingEnabled:state==='eligible',availableProviders:[{id:'google',label:'Google'}]};
  const profile={user:{email:'fixture@example.invalid',displayName:'Fixture'},profile:{displayName:'Fixture',baseCurrency:'USD',timezone:'UTC'},workspace:{name:'Fixture workspace'},session:{},linkedIdentities:linked,capabilities:{}};
  await page.route('**/identity-linking-fixture.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html data-resolved-appearance="${appearance}" data-appearance="${appearance}" data-theme="${appearance}"><head>${styles}<link rel="stylesheet" href="/assets/routes/account-session-v6.css"></head><body><main id="fixture-main"></main><script type="module">
   import {renderAccountSession} from '/assets/routes/account-session.mjs';
   const calls=[];window.fixtureCalls=calls;
   const profile=${JSON.stringify(profile)};
   const api=async(path,options={})=>{calls.push({path,method:options.method||'GET',body:options.body});if(path==='/api/v1/profile')return profile;if(path==='/api/v1/sessions')return {scope:'current-session-only',items:[{current:true,authenticationMethod:'supabase-oauth'}]};if(path==='/api/v1/auth/mfa/status')return {unavailable:true};if(path==='/api/v1/auth/oauth/link')throw new Error('Fixture: provider unavailable; account unchanged');throw new Error('Unexpected fixture API');};
   const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
   await renderAccountSession(document.querySelector('main'),{api,pageHead:()=>'',escapeHtml,toast:()=>{},onLoggedOut:()=>{},onAuthenticated:()=>{}});
   document.body.dataset.fixtureReady='true';
   </script></body></html>`}));
  try{
   await page.goto(`http://127.0.0.1:${server.port}/identity-linking-fixture.html`,{waitUntil:'domcontentloaded'});
   await page.locator('body[data-fixture-ready="true"]').waitFor();
   assert.match(await page.locator('main').innerText(),/Connected account/);
   const button=page.getByRole('button',{name:'Connect Google',exact:true});
   if(state==='eligible'){
    await button.click();assert.equal(await page.locator('[data-link-consent]').isVisible(),true);
    assert.equal(await page.evaluate(()=>window.fixtureCalls.filter(call=>call.method==='POST').length),0);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('[data-link-consent]').isVisible(),false);assert.equal(await button.evaluate(node=>node===document.activeElement),true);
    await button.click();await page.getByRole('button',{name:'Continue to identity consent',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Fixture: provider unavailable'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Continue to identity consent',exact:true}).isEnabled(),true);
    const calls=await page.evaluate(()=>window.fixtureCalls.filter(call=>call.method==='POST'));assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/v1/auth/oauth/link');assert.deepEqual(JSON.parse(calls[0].body),{provider:'google'});
   }else{assert.equal(await button.count(),0);assert.match(await page.locator('main').innerText(),/Linking or unlinking additional providers is not enabled/);}
   assert.equal(realIdentityWrites,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.screenshot({path:`${out}/${state}-${width}-${appearance}.png`,fullPage:true});results.push({width,appearance,state,passed:true,realIdentityWrites});
  }finally{await context.close();}
 }

 const authLoginResults=[];
 for(const width of [1440,390])for(const appearance of ['dark','light'])for(const failure of [
  {state:'cors-origin',status:403,code:'cors_origin_forbidden',message:'Sign-in is unavailable at this workspace address. Open the production Qelly terminal to continue.'},
  {state:'csrf-origin',status:403,code:'csrf_origin_forbidden',message:'Sign-in is unavailable at this workspace address. Open the production Qelly terminal to continue.'},
  {state:'credentials',status:401,code:'invalid_credentials',message:'Email or password is incorrect.'},
  {state:'network',message:'Qelly could not complete sign-in. Try again, or use the production Qelly terminal.'}
 ]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,serviceWorkers:'block'}),page=await context.newPage();let realAuthenticationWrites=0;
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method())&&new URL(request.url()).pathname.startsWith('/api/v1/auth/'))realAuthenticationWrites++;});
  await page.route('**/login-feedback-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html data-resolved-appearance="'+appearance+'" data-appearance="'+appearance+'" data-theme="'+appearance+'"><head>'+styles+'</head><body><main></main><script type="module">'+
   'import {renderAuthLogin} from "/assets/routes/auth-login.mjs";const failure='+JSON.stringify(failure)+';window.fixtureLoginCalls=0;'+
   'const api=async(path)=>{if(path==="/api/v1/auth/status")return {authenticated:false};if(path==="/api/v1/auth/oauth/providers")return {providers:[]};if(path==="/api/v1/auth/login"){window.fixtureLoginCalls++;throw Object.assign(new Error("Controlled UI error"),{status:failure.status,code:failure.code});}throw new Error("Unexpected fixture API");};'+
   'await renderAuthLogin(document.querySelector("main"),{api,toast:()=>{},navigate:()=>{},onAuthenticated:()=>{throw new Error("Authentication must not succeed");},state:{routeQuery:new URLSearchParams(),config:{auth:{emailDeliveryAvailable:false}}}});document.body.dataset.fixtureReady="true";</script></body></html>'}));
  try{
   await page.goto('http://127.0.0.1:'+server.port+'/login-feedback-fixture.html',{waitUntil:'domcontentloaded'});await page.locator('body[data-fixture-ready="true"]').waitFor();
   await page.locator('input[name="email"]').fill('ui-feedback@example.invalid');await page.locator('input[name="password"]').fill('Synthetic-Ui-Only-123!');
   await page.locator('[data-sign-in]').click();await page.locator('#login-error').filter({hasText:failure.message}).waitFor();
   assert.equal(await page.locator('#login-error').innerText(),failure.message);assert.equal(await page.locator('[data-sign-in]').isEnabled(),true);
   assert.equal(await page.locator('input[name="password"]').getAttribute('type'),'password');assert.equal(await page.locator('#login-error').getAttribute('role'),'alert');assert.equal(await page.locator('#login-error').getAttribute('aria-live'),'polite');
   assert.equal(await page.evaluate(()=>window.fixtureLoginCalls),1);assert.equal(realAuthenticationWrites,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.screenshot({path:out+'/login-'+failure.state+'-'+width+'-'+appearance+'.png',fullPage:true});
   authLoginResults.push({state:failure.state,width,appearance,passed:true,realAuthenticationWrites:0,isolatedUiFixture:true,credentialsWereSynthetic:true,retryEnabled:true,passwordRemainsMasked:true,liveError:true,overflow:false});
  }finally{await context.unrouteAll({behavior:'wait'});await context.close();}
 }
 await writeFile(`${out}/report.json`,JSON.stringify({releaseSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,status:'passed',cases:results.length,results,authLoginFeedbackCases:authLoginResults.length,authLoginResults,boundary:'Isolated UI fixture only. No real account or provider consent is activated.'},null,2)+'\n');
}finally{await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));}
