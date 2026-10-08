import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from './release-a5-evidence-server.mjs';
const out='preview/about-editorial-e2e';await mkdir(out,{recursive:true});
const server=await startServer({port:0,host:'127.0.0.1'}),browser=await chromium.launch({headless:true,executablePath:process.env.QELLY_BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const results=[];let active;
try{
 for(const appearance of ['dark','light'])for(const width of [1440,768,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:appearance,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(a=>localStorage.setItem('qelly.theme-intelligence.v2',JSON.stringify({version:2,appearance:a})),appearance);
  const page=active=await context.newPage();let nonReadRequests=0;const nonReadDetails=[];
  await context.route('**/*',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){nonReadRequests++;const u=new URL(route.request().url());nonReadDetails.push({method:route.request().method(),origin:u.origin,path:u.pathname});return route.abort();}return route.continue();});
  await context.route('**/api/v1/user/layout-preferences',async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),appearance}});});
  await page.goto(`http://127.0.0.1:${server.port}/#/about-qelly`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.brandReady==='true');await page.locator('.qelly-opening').waitFor({state:'hidden'});
  await page.locator('.q-about-v2-journey article').first().waitFor();
  assert.equal(await page.getByText('Open Market Command',{exact:true}).count(),0);
  assert.equal(await page.locator('.q-about-v2-journey article').count(),5);assert.equal(await page.locator('.q-about-v2-domains button').count(),6);
  assert.equal(await page.locator('.q-about-v2-runtime article').filter({hasText:'Execution'}).locator('.q-status').textContent(),'Off');
  const layout=await page.locator('.q-about-v2-page').evaluate(root=>({overflow:document.documentElement.scrollWidth>innerWidth+1,bodyText:parseFloat(getComputedStyle(root.querySelector('.q-about-v2-hero__copy>p:not(.q-eyebrow)')).fontSize),journeyColumns:getComputedStyle(root.querySelector('.q-about-v2-journey')).gridTemplateColumns.split(' ').length}));
  assert.equal(layout.overflow,false);assert.ok(layout.bodyText>=16);assert.equal(layout.journeyColumns,width<=620?1:2);
  const readability=await page.locator('.q-about-v2-page').evaluate(root=>{const rgb=v=>{if(/^#[0-9a-f]{6}$/i.test(v.trim()))return [1,3,5].map(i=>parseInt(v.trim().slice(i,i+2),16));const a=v.match(/[\d.]+/g)?.slice(0,3).map(Number);if(!a||a.length!==3)throw Error('Unsupported measured color '+v);return a;},l=v=>rgb(v).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0),bg=l(getComputedStyle(root).getPropertyValue('--q-bg'));return {introductionText:parseFloat(getComputedStyle(root.querySelector('.q-page-head p:not(.q-eyebrow)')).fontSize),statisticContrast:[...root.querySelectorAll('.q-about-stat-grid strong')].map(n=>{const fg=l(getComputedStyle(n).color);return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);})};});assert.ok(readability.introductionText>=16,'About introduction remains too small: '+JSON.stringify(readability));assert.ok(readability.statisticContrast.every(v=>v>=4.5),'About statistic contrast: '+JSON.stringify(readability));
  const surfaces=await page.locator('.q-about-v2-page :is(section,article,aside,header,footer,div,button,blockquote,.q-status)').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height;}).map(n=>{const s=getComputedStyle(n);return {className:n.className,borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],radius:s.borderRadius,shadow:s.boxShadow};}));
  assert.ok(surfaces.length>40);assert.ok(surfaces.every(s=>s.borders.every(b=>b==='0px')&&s.radius==='0px'&&s.shadow==='none'),'About decorative surface remains: '+JSON.stringify(surfaces.filter(s=>s.borders.some(b=>b!=='0px')||s.radius!=='0px'||s.shadow!=='none')));
  const market=page.getByRole('button',{name:'Open Market Pulse',exact:true});await market.focus();
  const focus=await market.evaluate(n=>({style:getComputedStyle(n).outlineStyle,width:parseFloat(getComputedStyle(n).outlineWidth)}));assert.notEqual(focus.style,'none');assert.ok(focus.width>=2);
  await page.screenshot({path:`${out}/about-${appearance}-${width}.png`,fullPage:true});assert.equal(nonReadRequests,0,'About before navigation: '+JSON.stringify(nonReadDetails));await market.press('Enter');await page.waitForURL('**/#/market');assert.ok(nonReadDetails.every(r=>r.method==='PUT'&&r.origin===`http://127.0.0.1:${server.port}`&&r.path==='/api/v1/preferences/layout'),'Unexpected post-navigation write: '+JSON.stringify(nonReadDetails));
  results.push({appearance,width,layout,readability,surfaces,capabilityTruthPreserved:true,keyboardNavigation:true,focus,aboutNonReadRequests:0,navigationPreferenceAttempts:nonReadRequests,allNonReadRequestsBlocked:true,nonReadRequests});await context.close();
 }
 await writeFile(out+'/report.json',JSON.stringify({status:'passed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,results,boundary:'Focused About source presentation and existing route/capability behavior. Full programme acceptance remains separate.'},null,2));
}catch(error){if(active&&!active.isClosed())await active.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(out+'/report.json',JSON.stringify({status:'failed',sourceSha:process.env.QELLY_SCREEN_EVIDENCE_SHA,error:error.stack,results},null,2));throw error;}
finally{await browser.close();await new Promise(resolve=>server.server.close(resolve));await new Promise(resolve=>server.evidenceUpstream.server.close(resolve));}
