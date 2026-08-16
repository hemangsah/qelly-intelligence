import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const PUBLIC_URL=String(process.env.PUBLIC_URL||'https://qelly-intelligence.pages.dev').replace(/\/$/,'');
const RELEASE_SHA=String(process.env.RELEASE_SHA||'manual');
const OUTPUT=path.resolve('dist/canonical-hash-route-verification');
const ROUTES=['news-research','watchlist','notification-schedules','data-mesh','platform-readiness','decision-provenance','market','asset-rankings','calculator-detail/risk-reward','feature-universe','account-session','theme-personas'];
const FAILURE_PATTERN=/Unable to render this route|API route was not found|Request failed \((?:404|501)\)/i;

const json=(value)=>({status:200,contentType:'application/json',body:JSON.stringify(value)});
const fakePreferences={theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:'feature-universe',revision:1};
const fakeOverview={macro:[{label:'Runtime probe',value:'Canonical production',state:'cached'},{label:'Execution',value:'Disabled',state:'unavailable'}]};
const fakeIdentity={organization:{name:'Qelly Production Verification'},workspace:{name:'Authenticated-shell route probe'},mode:'read-only',session:{assurance:'verification'}};

async function installAuthenticatedShellProbe(page){
  await page.route('**/api/v1/config',async(route)=>route.fulfill(json({auth:{authenticated:true},defaultRoute:'feature-universe',csrf:{token:'production-route-probe'}})));
  await page.route('**/api/v1/preferences/layout',async(route)=>route.fulfill(json(fakePreferences)));
  await page.route('**/api/v1/market/overview',async(route)=>route.fulfill(json(fakeOverview)));
  await page.route('**/api/v1/session/context',async(route)=>route.fulfill(json(fakeIdentity)));
}

async function inspectRoute(browser,routeName){
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  const page=await context.newPage();
  const pageErrors=[];
  const consoleErrors=[];
  page.on('pageerror',(error)=>pageErrors.push({name:error.name,message:error.message}));
  page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await installAuthenticatedShellProbe(page);
  const url=`${PUBLIC_URL}/?verify=${encodeURIComponent(RELEASE_SHA)}#/${routeName}`;
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:45000}).catch(()=>{});
  await page.waitForTimeout(5000);
  const dom=await page.evaluate(()=>{
    const main=document.querySelector('#main');
    const text=(main?.innerText||'').replace(/\s+/g,' ').trim();
    return {
      hash:location.hash,
      appReady:document.documentElement.dataset.appReady||null,
      mainChildCount:main?.childElementCount??0,
      text:text.slice(0,2400),
      title:main?.querySelector('h1,h2')?.textContent?.trim()||null,
      rescueRoute:main?.querySelector('[data-canonical-route-rescue]')?.getAttribute('data-canonical-route-rescue')||null,
      startupFailure:Boolean(document.querySelector('.q-startup-failure'))
    };
  });
  const safe=routeName.replace(/[^a-z0-9-]+/gi,'-');
  await page.screenshot({path:path.join(OUTPUT,`${safe}.png`),fullPage:true});
  await context.close();
  const evidence={route:routeName,url,navigationStatus:response?.status()??null,dom,pageErrors,consoleErrors};
  if(evidence.navigationStatus!==200)throw new Error(`${routeName}: navigation status ${evidence.navigationStatus}`);
  if(dom.appReady!=='true'||dom.mainChildCount<1||dom.startupFailure)throw new Error(`${routeName}: shell did not reach a rendered state`);
  if(FAILURE_PATTERN.test(dom.text))throw new Error(`${routeName}: generic route failure leaked into canonical UI: ${dom.text.slice(0,500)}`);
  const cspErrors=consoleErrors.filter((text)=>/content security policy|refused to execute inline|violates.*script-src/i.test(text));
  if(cspErrors.length)throw new Error(`${routeName}: CSP errors: ${JSON.stringify(cspErrors)}`);
  return evidence;
}

await fs.mkdir(OUTPUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
let failure=null;
try{
  for(const routeName of ROUTES)results.push(await inspectRoute(browser,routeName));
}catch(error){failure=error;}
finally{await browser.close();}
await fs.writeFile(path.join(OUTPUT,'evidence.json'),JSON.stringify({releaseSha:RELEASE_SHA,publicUrl:PUBLIC_URL,routes:results,failure:failure?{message:failure.message,stack:failure.stack}:null},null,2));
if(failure)throw failure;
console.log(`Verified ${results.length} canonical hash routes without generic route-collapse UI.`);
