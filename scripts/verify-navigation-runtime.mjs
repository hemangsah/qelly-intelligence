import {access} from 'node:fs/promises';
import {chromium} from 'playwright';

const baseUrl=String(process.env.QELLY_URL||'http://127.0.0.1:4481').replace(/\/$/,'');
const localRuntime=/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/.test(baseUrl);
const maximumRouteMs=Number(process.env.QELLY_MAX_ROUTE_MS|| (localRuntime?9_000:6_000));
const maximumRefreshMs=Number(process.env.QELLY_MAX_REFRESH_MS|| (localRuntime?9_000:6_000));
const executableCandidates=[
  process.env.QELLY_BROWSER_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
let executablePath;
for(const candidate of executableCandidates){if(await access(candidate).then(()=>true,()=>false)){executablePath=candidate;break;}}

const routes=[
  ['market','Governed Market Terminal'],
  ['qelly-verify','Qelly Verify'],
  ['live-markets','Global Market Network'],
  ['formula-library','Formulas'],
  ['indicator-library','Indicators'],
  ['feature-universe','Your market research workspace'],
  ['auth-login','Sign in to Qelly']
];
const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
const page=await context.newPage();
const failures=[];
const observations=[];
page.on('pageerror',(error)=>failures.push({type:'pageerror',message:error.message}));
page.on('requestfailed',(request)=>{
  const message=request.failure()?.errorText||'unknown';
  const requestUrl=new URL(request.url());
  const isTradingViewWidget=requestUrl.hostname==='tradingview-widget.com'||requestUrl.hostname.endsWith('.tradingview-widget.com');
  if(isTradingViewWidget&&message.includes('ERR_ABORTED')){
    observations.push({kind:'expected-widget-teardown',url:request.url()});
    return;
  }
  if(['document','script','stylesheet','font','image'].includes(request.resourceType()))failures.push({type:'requestfailed',resourceType:request.resourceType(),url:request.url(),message});
});

const waitReady=async(expectedHash,expectedHeading)=>{
  await page.waitForFunction(({hash,heading})=>location.hash.split('?')[0]===`#/${hash}`&&document.documentElement.dataset.appReady==='true'&&document.querySelector('main#main')?.getAttribute('aria-busy')!=='true'&&document.querySelector('main#main h1')?.textContent?.trim()===heading,{hash:expectedHash,heading:expectedHeading},{timeout:15_000});
};

try{
  await page.goto(`${baseUrl}/#/market`,{waitUntil:'domcontentloaded',timeout:30_000});
  await waitReady('market','Governed Market Terminal');
  let previous=(await page.locator('main#main h1').first().textContent())?.trim()||'';
  for(const [route,expectedHeading] of routes.slice(1)){
    const started=Date.now();
    await page.evaluate((next)=>{location.hash=`#/${next}`;},route);
    await page.waitForTimeout(50);
    const interim=await page.locator('main#main h1').first().textContent().catch(()=>null);
    if(interim?.trim()===previous)failures.push({type:'stale-route',route,previous,interim:interim.trim()});
    await waitReady(route,expectedHeading);
    const heading=(await page.locator('main#main h1').first().textContent())?.trim()||'';
    const elapsedMs=Date.now()-started;
    if(heading!==expectedHeading)failures.push({type:'route-heading',route,expected:expectedHeading,actual:heading});
    if(elapsedMs>maximumRouteMs)failures.push({type:'route-performance',route,elapsedMs,maximumRouteMs});
    observations.push({kind:'navigation',route,interim:interim?.trim()||null,heading,elapsedMs});
    previous=heading;
  }

  await page.evaluate(()=>{location.hash='#/qelly-verify';});
  await page.waitForTimeout(25);
  await page.evaluate(()=>{location.hash='#/live-markets';});
  await page.waitForTimeout(100);
  const rapidInterim=(await page.locator('main#main h1').first().textContent())?.trim()||'';
  if(rapidInterim==='Qelly Verify')failures.push({type:'rapid-stale-route',actual:rapidInterim});
  await waitReady('live-markets','Global Market Network');
  const rapidFinal=(await page.locator('main#main h1').first().textContent())?.trim()||'';
  if(rapidFinal!=='Global Market Network')failures.push({type:'rapid-final-route',actual:rapidFinal});
  observations.push({kind:'rapid-navigation',interim:rapidInterim,heading:rapidFinal});

  for(const route of ['market','qelly-verify','live-markets']){
    const expectedHeading=routes.find(([candidate])=>candidate===route)?.[1];
    await page.goto(`${baseUrl}/#/${route}`,{waitUntil:'domcontentloaded',timeout:30_000});
    await waitReady(route,expectedHeading);
    const started=Date.now();
    await page.reload({waitUntil:'domcontentloaded',timeout:30_000});
    await waitReady(route,expectedHeading);
    const elapsedMs=Date.now()-started;
    const title=await page.title();
    if(elapsedMs>maximumRefreshMs)failures.push({type:'refresh-performance',route,elapsedMs,maximumRefreshMs});
    observations.push({kind:'refresh',route,title,elapsedMs});
  }
}catch(error){
  const diagnostic=await page.evaluate(()=>({
    href:location.href,
    rootDataset:{...document.documentElement.dataset},
    mainBusy:document.querySelector('main#main')?.getAttribute('aria-busy')||null,
    mainHeading:document.querySelector('main#main h1')?.textContent?.trim()||null,
    appVisibility:getComputedStyle(document.getElementById('app')).visibility
  })).catch(()=>null);
  failures.push({type:'runtime-verification',message:error.message,diagnostic});
}finally{
  await context.close();
  await browser.close();
}

const result={status:failures.length?'failed':'passed',baseUrl,browserExecutable:executablePath||'playwright-managed',checks:observations.length,failures,observations};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;
