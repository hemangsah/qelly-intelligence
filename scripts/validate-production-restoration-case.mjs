import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base=String(process.env.QELLY_RESTORATION_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const name=String(process.env.QELLY_BROWSER_CASE||'market-home');
const width=Number(process.env.QELLY_BROWSER_WIDTH||390);
const height=Number(process.env.QELLY_BROWSER_HEIGHT||844);
const hash=String(process.env.QELLY_BROWSER_HASH||'#/market');
const slug=`${name}-${width}x${height}`;
const output=new URL(`../dist/production-restoration-browser/${slug}/`,import.meta.url);
await mkdir(output,{recursive:true});

const hardTimeout=setTimeout(()=>{
  console.error(JSON.stringify({status:'browser_case_hard_timeout',name,width,height,hash}));
  process.exit(124);
},120000);

const observedAt='2026-08-02T04:00:00.000Z';
const ingestedAt='2026-08-02T04:00:02.000Z';
const provider=(id,providerName,state,data,error=null)=>({provider:id,name:providerName,truthState:state,data,error,observedAt,ingestedAt,attribution:providerName,source:{name:providerName,mode:state==='live'?'live-public':state}});
const overview={generatedAt:ingestedAt,market:[{label:'BTC · Coinbase',value:'$64,820.12',state:'live',provider:'coinbase',observedAt,ingestedAt,attribution:'Coinbase Exchange'},{label:'BTC · Binance',value:'Unavailable',state:'unavailable',provider:'binance',observedAt:null,ingestedAt,attribution:'Binance'}],referenceRates:{label:'ECB reference rates',count:31,state:'live',provider:'ecb',observedAt,ingestedAt,attribution:'European Central Bank'},providers:{coinbase:provider('coinbase','Coinbase Exchange','live',{price:64820.12}),ecb:provider('ecb','European Central Bank','live',{rates:{USD:1.08,INR:92.4}}),binance:provider('binance','Binance','unavailable',null,{code:'upstream_restricted',message:'Binance is unavailable from this deployment region.'})},deterministicLocal:true,execution:false};
const config={productName:'Qelly Intelligence',productVersion:'0.9.0-preview.1',release:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',defaultRoute:'market',csrf:{header:'X-Qelly-CSRF',token:null,mode:'unavailable-until-authenticated'},auth:{authenticated:false,backendAvailable:true,productionIdentityEnabled:true,mode:'supabase-auth-cloudflare-facade'},cloud:{available:true,syncAvailable:true,providerRuntime:true},runtime:{releaseSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',publicSiteUrl:base,capabilities:{authentication:true,cloudSync:true,liveProviders:true,protectedWrites:true}},states:[],liveTrading:false};
const responseFor=(url)=>{const path=new URL(url).pathname;if(path==='/api/v1/config')return[200,config];if(path==='/api/v1/market/overview')return[200,overview];if(path==='/api/v1/auth/status')return[200,{authenticated:false,context:null}];if(path==='/api/v1/health')return[200,{status:'ok',releaseSha:config.release,deterministicLocal:true,authentication:true,cloudSync:true,liveProviders:true,trading:false,custody:false,transfers:false}];if(path==='/api/v1/readiness')return[200,{ready:true,dependencies:{supabase:'configured',auth:'configured',rls:'required',providers:'configured'},releaseSha:config.release}];if(path==='/api/v1/providers/status')return[200,{providers:[{id:'coinbase',name:'Coinbase Exchange',state:'live',description:'Public spot quotes'},{id:'ecb',name:'European Central Bank',state:'live',description:'Official reference rates'},{id:'binance',name:'Binance',state:'unavailable',description:'Unavailable in this region'}],releaseSha:config.release}];return[401,{error:{code:'authentication_required',message:'Authentication is required'}}];};
const prohibited=['QELLY GLOBAL PUBLIC BETA','VALIDATION STATE','Unable to render this route','Retry foundation route','AUTHENTICATION DEMO','LOCAL DEMONSTRATION IDENTITY BOUNDARY','STATE: DEFAULT','Secure identity foundation','Network · online','Authentication · active','Cloud sync · opt-in available'];
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));

let browser,context,page;
const pageErrors=[],consoleErrors=[],requestFailures=[];
let result;
try{
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
  page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',(error)=>pageErrors.push(error.message));
  page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
  await page.route('**/api/v1/**',async(route)=>{const [status,body]=responseFor(route.request().url());await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
  const response=await page.goto(`${base}/${hash}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:15000});

  if(name==='market-home'){
    await page.waitForSelector('.q-market-home [data-provider="coinbase"]');
    await page.getByRole('heading',{name:'Understand markets before making a decision.'}).waitFor();
    await page.getByText('Coinbase Exchange',{exact:true}).first().waitFor();
    await page.getByText('European Central Bank',{exact:true}).first().waitFor();
    await page.getByText('Binance is unavailable from this deployment region.').waitFor();
  }else if(name==='position-size-calculator'){
    await page.waitForSelector('[data-structured-field][name="accountValue"]');
    await page.getByText('Account value',{exact:true}).waitFor();
    await page.getByText('Risk percentage',{exact:true}).waitFor();
    if(await page.locator('.q-advanced-json').evaluate((node)=>node.open))throw new Error('advanced_json_open_by_default');
    await page.getByRole('button',{name:'Calculate',exact:true}).click();
    await page.waitForSelector('.q-calculation-result');
    if(await page.locator('.q-calculation-result').count()<1)throw new Error('calculation_outputs_missing');
  }else if(name==='auth-login'){
    await page.getByRole('heading',{name:'Sign in to Qelly'}).waitFor();
    await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
    await page.getByRole('button',{name:'Forgot password?'}).waitFor();
    await page.getByRole('button',{name:'Create account'}).waitFor();
  }else if(name==='protected-route-gate'){
    await page.getByRole('heading',{name:'Sign in to continue'}).waitFor();
    const gate=page.locator('.q-access-gate');
    await gate.getByRole('link',{name:'Sign in',exact:true}).waitFor();
    await gate.getByRole('link',{name:'Create account',exact:true}).waitFor();
    await gate.getByRole('link',{name:'Return home',exact:true}).waitFor();
  }else if(name==='system-status'){
    await page.getByRole('heading',{name:'Qelly service and provider status'}).waitFor();
    if((await page.locator('.q-product-header').innerText()).includes('aaaaaaaa'))throw new Error('release_sha_exposed_in_primary_header');
    await page.getByText('Runtime identity',{exact:true}).waitFor();
  }else throw new Error(`unknown_browser_case_${name}`);

  const evidence=await page.evaluate((blocked)=>{const bodyText=document.body?.innerText||'';return{title:document.title,route:location.hash,appReady:document.documentElement.dataset.appReady,productSurface:document.documentElement.dataset.productSurface,viewport:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+1,prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),text:bodyText.slice(0,2000)};},prohibited);
  if(response?.status()!==200)throw new Error(`navigation_status_${response?.status()}`);
  if(evidence.horizontalOverflow)throw new Error(`horizontal_overflow_${evidence.scrollWidth}_${evidence.viewport}`);
  if(evidence.prohibited.length)throw new Error(`prohibited_copy_${evidence.prohibited.join('|')}`);
  if(pageErrors.length)throw new Error(`page_errors_${pageErrors.join('|')}`);
  if(consoleErrors.length)throw new Error(`console_errors_${consoleErrors.join('|')}`);
  const screenshot=`${slug}.png`;
  await page.screenshot({path:fileURLToPath(new URL(screenshot,output)),fullPage:true,timeout:30000});
  result={status:'passed',name,width,height,hash,evidence,screenshot,pageErrors,consoleErrors,requestFailures};
}catch(error){
  const evidence=page?await page.evaluate((blocked)=>{const bodyText=document.body?.innerText||'';return{title:document.title,route:location.hash,appReady:document.documentElement.dataset.appReady,productSurface:document.documentElement.dataset.productSurface,viewport:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+1,prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),text:bodyText.slice(0,2000)};},prohibited).catch(()=>null):null;
  result={status:'failed',name,width,height,hash,error:error.message,evidence,pageErrors,consoleErrors,requestFailures};
}finally{
  if(context)await Promise.race([context.close().catch(()=>{}),delay(3000)]);
  if(browser)await Promise.race([browser.close().catch(()=>{}),delay(3000)]);
  clearTimeout(hardTimeout);
}
await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
await writeFile(new URL('result.md',output),`# Qelly Browser Case — ${slug}\n\n- Status: ${result.status}\n- Route: ${hash}\n- Viewport: ${width} × ${height}\n${result.error?`- Error: ${result.error}\n`:''}`);
console.log(JSON.stringify(result,null,2));
if(result.status!=='passed')process.exit(1);