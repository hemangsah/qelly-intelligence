import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=String(process.env.QELLY_RESTORATION_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const output=new URL('../dist/production-restoration-browser/',import.meta.url);
await mkdir(output,{recursive:true});

const observedAt='2026-08-02T04:00:00.000Z';
const ingestedAt='2026-08-02T04:00:02.000Z';
const provider=(id,name,state,data,error=null)=>({provider:id,name,truthState:state,data,error,observedAt,ingestedAt,attribution:name,source:{name,mode:state==='live'?'live-public':state}});
const overview={
  generatedAt:ingestedAt,
  market:[
    {label:'BTC · Coinbase',value:'$64,820.12',state:'live',provider:'coinbase',observedAt,ingestedAt,attribution:'Coinbase Exchange'},
    {label:'BTC · Binance',value:'Unavailable',state:'unavailable',provider:'binance',observedAt:null,ingestedAt,attribution:'Binance'}
  ],
  referenceRates:{label:'ECB reference rates',count:31,state:'live',provider:'ecb',observedAt,ingestedAt,attribution:'European Central Bank'},
  providers:{
    coinbase:provider('coinbase','Coinbase Exchange','live',{price:64820.12}),
    ecb:provider('ecb','European Central Bank','live',{rates:{USD:1.08,INR:92.4}}),
    binance:provider('binance','Binance','unavailable',null,{code:'upstream_restricted',message:'Binance is unavailable from this deployment region.'})
  },
  deterministicLocal:true,
  execution:false
};
const config={productName:'Qelly Intelligence',productVersion:'0.9.0-preview.1',release:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',defaultRoute:'market',csrf:{header:'X-Qelly-CSRF',token:null,mode:'unavailable-until-authenticated'},auth:{authenticated:false,backendAvailable:true,productionIdentityEnabled:true,mode:'supabase-auth-cloudflare-facade'},cloud:{available:true,syncAvailable:true,providerRuntime:true},runtime:{releaseSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',publicSiteUrl:base,capabilities:{authentication:true,cloudSync:true,liveProviders:true,protectedWrites:true}},states:[],liveTrading:false};

const responseFor=(url)=>{
  const path=new URL(url).pathname;
  if(path==='/api/v1/config')return[200,config];
  if(path==='/api/v1/market/overview')return[200,overview];
  if(path==='/api/v1/auth/status')return[200,{authenticated:false,context:null}];
  if(path==='/api/v1/health')return[200,{status:'ok',releaseSha:config.release,deterministicLocal:true,authentication:true,cloudSync:true,liveProviders:true,trading:false,custody:false,transfers:false}];
  if(path==='/api/v1/readiness')return[200,{ready:true,dependencies:{supabase:'configured',auth:'configured',rls:'required',providers:'configured'},releaseSha:config.release}];
  if(path==='/api/v1/providers/status')return[200,{providers:[{id:'coinbase',name:'Coinbase Exchange',state:'live',description:'Public spot quotes'},{id:'ecb',name:'European Central Bank',state:'live',description:'Official reference rates'},{id:'binance',name:'Binance',state:'unavailable',description:'Unavailable in this region'}],releaseSha:config.release}];
  return[401,{error:{code:'authentication_required',message:'Authentication is required'}}];
};

const prohibited=[
  'QELLY GLOBAL PUBLIC BETA',
  'VALIDATION STATE',
  'Unable to render this route',
  'Retry foundation route',
  'AUTHENTICATION DEMO',
  'LOCAL DEMONSTRATION IDENTITY BOUNDARY',
  'STATE: DEFAULT',
  'Secure identity foundation',
  'Network · online',
  'Authentication · active',
  'Cloud sync · opt-in available'
];

const browser=await chromium.launch({headless:true});
const results=[];
const failures=[];

async function createPage(viewport){
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();
  const pageErrors=[],consoleErrors=[],requestFailures=[];
  page.on('pageerror',(error)=>pageErrors.push(error.message));
  page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
  await page.route('**/api/v1/**',async(route)=>{const [status,body]=responseFor(route.request().url());await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
  return{context,page,pageErrors,consoleErrors,requestFailures};
}

async function inspect(page){
  return page.evaluate((blocked)=>{
    const bodyText=document.body?.innerText||'';
    return{
      title:document.title,
      route:location.hash,
      appReady:document.documentElement.dataset.appReady,
      productSurface:document.documentElement.dataset.productSurface,
      viewport:window.innerWidth,
      scrollWidth:document.documentElement.scrollWidth,
      horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
      prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),
      text:bodyText.slice(0,1200)
    };
  },prohibited);
}

async function runCase(name,viewport,hash,assertions){
  const runtime=await createPage(viewport);
  try{
    const response=await runtime.page.goto(`${base}/${hash}`,{waitUntil:'domcontentloaded',timeout:45000});
    await runtime.page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:30000});
    await assertions(runtime.page);
    const evidence=await inspect(runtime.page);
    if(response?.status()!==200)throw new Error(`navigation_status_${response?.status()}`);
    if(evidence.horizontalOverflow)throw new Error(`horizontal_overflow_${evidence.scrollWidth}_${evidence.viewport}`);
    if(evidence.prohibited.length)throw new Error(`prohibited_copy_${evidence.prohibited.join('|')}`);
    if(runtime.pageErrors.length)throw new Error(`page_errors_${runtime.pageErrors.join('|')}`);
    if(runtime.consoleErrors.length)throw new Error(`console_errors_${runtime.consoleErrors.join('|')}`);
    const screenshot=`${name}-${viewport.width}x${viewport.height}.png`;
    await runtime.page.screenshot({path:new URL(screenshot,output),fullPage:true});
    results.push({name,viewport,evidence,screenshot,requestFailures:runtime.requestFailures});
  }catch(error){
    const evidence=await inspect(runtime.page).catch(()=>null);
    failures.push({name,viewport,error:error.message,evidence,pageErrors:runtime.pageErrors,consoleErrors:runtime.consoleErrors,requestFailures:runtime.requestFailures});
  }finally{await runtime.context.close();}
}

for(const viewport of [{width:320,height:800},{width:768,height:1024},{width:1440,height:1000}]){
  await runCase('market-home',viewport,'#/market',async(page)=>{
    await page.waitForSelector('.q-market-home [data-provider="coinbase"]',{timeout:30000});
    await page.getByRole('heading',{name:'Understand markets before making a decision.'}).waitFor();
    await page.getByText('Coinbase Exchange',{exact:true}).first().waitFor();
    await page.getByText('European Central Bank',{exact:true}).first().waitFor();
    await page.getByText('Binance is unavailable from this deployment region.').waitFor();
  });
}

for(const viewport of [{width:360,height:900},{width:1024,height:900},{width:1440,height:1000}]){
  await runCase('position-size-calculator',viewport,'#/calculator-detail/position-size',async(page)=>{
    await page.waitForSelector('[data-structured-field][name="accountValue"]',{timeout:30000});
    await page.getByText('Account value',{exact:true}).waitFor();
    await page.getByText('Risk percentage',{exact:true}).waitFor();
    const details=page.locator('.q-advanced-json');
    if(await details.evaluate((node)=>node.open))throw new Error('advanced_json_open_by_default');
    await page.getByRole('button',{name:'Calculate',exact:true}).click();
    await page.waitForSelector('.q-calculation-result',{timeout:10000});
    await page.getByText('Units',{exact:true}).waitFor();
  });
}

await runCase('auth-login',{width:390,height:844},'#/auth-login',async(page)=>{
  await page.getByRole('heading',{name:'Sign in to Qelly'}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
  await page.getByRole('button',{name:'Forgot password?'}).waitFor();
  await page.getByRole('button',{name:'Create account'}).waitFor();
});

await runCase('protected-route-gate',{width:390,height:844},'#/account-session',async(page)=>{
  await page.getByRole('heading',{name:'Sign in to continue'}).waitFor({timeout:30000});
  await page.getByRole('link',{name:'Sign in'}).waitFor();
  await page.getByRole('link',{name:'Create account'}).waitFor();
  await page.getByRole('link',{name:'Return home'}).waitFor();
});

await runCase('system-status',{width:1280,height:900},'#/status',async(page)=>{
  await page.getByRole('heading',{name:'Qelly service and provider status'}).waitFor({timeout:30000});
  const header=page.locator('.q-product-header');
  if((await header.innerText()).includes('aaaaaaaa'))throw new Error('release_sha_exposed_in_primary_header');
  await page.getByText('Runtime identity',{exact:true}).waitFor();
});

await browser.close();
const summary={generatedAt:new Date().toISOString(),base,total:results.length+failures.length,passed:results.length,failed:failures.length,results,failures};
await writeFile(new URL('QELLY_PRODUCTION_RESTORATION_BROWSER.json',output),JSON.stringify(summary,null,2));
await writeFile(new URL('QELLY_PRODUCTION_RESTORATION_BROWSER.md',output),`# Qelly Production Restoration Browser Matrix\n\n- Passed: ${results.length}\n- Failed: ${failures.length}\n- Cases: ${summary.total}\n\n${failures.map((failure)=>`- FAIL ${failure.name} ${failure.viewport.width}x${failure.viewport.height}: ${failure.error}`).join('\n')||'All browser cases passed.'}\n`);
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1);}
console.log(JSON.stringify({status:'qelly-production-restoration-browser-passed',cases:results.length},null,2));
