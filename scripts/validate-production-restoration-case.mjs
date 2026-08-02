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
const prohibited=['QELLY GLOBAL PUBLIC BETA','VALIDATION STATE','Unable to render this route','Retry foundation route','AUTHENTICATION DEMO','LOCAL DEMONSTRATION IDENTITY BOUNDARY','STATE: DEFAULT','Secure identity foundation','Network · online','Authentication · active','Cloud sync · opt-in available','Input JSON'];
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const collectEvidence=(page)=>page.evaluate((blocked)=>{
  const bodyText=document.body?.innerText||'';
  const visible=(element)=>{if(!element)return false;const style=getComputedStyle(element),box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0&&box.bottom>0&&box.right>0;};
  const color=(element)=>element?getComputedStyle(element).backgroundColor:null;
  const luminance=(value)=>{const numbers=String(value||'').match(/[\d.]+/g)?.slice(0,3).map(Number);if(!numbers||numbers.length<3)return null;return .2126*numbers[0]+.7152*numbers[1]+.0722*numbers[2];};
  const legacySelectors=['.q-worldclass-context','#context-shelf','#persona-ribbon','#edge-dock','#rail','#compare-tray','#mobile-navigation','.q-global-strip','.q-scroll-progress'];
  const visibleLegacy=legacySelectors.filter((selector)=>[...document.querySelectorAll(selector)].some(visible));
  const skip=document.querySelector('.skip-link'),main=document.getElementById('main'),panelHead=document.querySelector('.q-panel-head'),productSystem=document.querySelector('.q-product-system'),recovery=document.querySelector('[data-recovery]');
  const panelHeadColor=color(panelHead),appearance=document.documentElement.dataset.appearance||'dark';
  return{
    title:document.title,
    route:location.hash,
    appReady:document.documentElement.dataset.appReady,
    productSurface:document.documentElement.dataset.productSurface,
    viewport:window.innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
    prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),
    text:bodyText.slice(0,2200),
    visual:{
      visibleLegacy,
      skipVisible:visible(skip),
      skipFocusVisible:Boolean(skip?.matches(':focus-visible')),
      mainOutlineStyle:main?getComputedStyle(main).outlineStyle:null,
      mainBoxShadow:main?getComputedStyle(main).boxShadow:null,
      panelHeadColor,
      panelHeadLuminance:luminance(panelHeadColor),
      panelHeadDarkSurface:appearance==='light'||appearance==='porcelain'||panelHead==null||luminance(panelHeadColor)<90,
      productSystemVisible:visible(productSystem),
      recoveryDisabled:Boolean(recovery?.disabled),
      recoveryBackground:color(recovery)
    }
  };
},prohibited);

let browser,context,page;
const pageErrors=[],consoleErrors=[],requestFailures=[];
let result,screenshot=`${slug}.png`;
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
  }else if(name==='calculator-center'){
    await page.getByRole('heading',{name:'Calculators',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Start with a proven calculation'}).waitFor();
    await page.getByLabel('Search calculators').waitFor();
    const cards=page.locator('.q-calculator-card');
    if(await cards.count()<6)throw new Error('calculator_catalog_incomplete');
    const position=page.locator('[data-calculator-id="position-size"]').first();
    await position.waitFor();
    const href=await position.getAttribute('href');
    if(!href?.includes('#/calculator-detail/position-size'))throw new Error('calculator_detail_link_invalid');
  }else if(name==='position-size-calculator'){
    await page.waitForSelector('[data-structured-field][name="accountValue"]');
    await page.getByText('Account value',{exact:true}).waitFor();
    await page.getByText('Risk percentage',{exact:true}).waitFor();
    if(await page.locator('.q-advanced-json').evaluate((node)=>node.open))throw new Error('advanced_json_open_by_default');
    await page.getByRole('button',{name:'Calculate',exact:true}).click();
    await page.waitForSelector('.q-calculation-result');
    if(await page.locator('.q-calculation-result').count()<1)throw new Error('calculation_outputs_missing');
  }else if(name==='formula-library'){
    await page.getByRole('heading',{name:'Formulas',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Understand the method before calculating'}).waitFor();
    await page.getByLabel('Search formulas').waitFor();
    const cards=page.locator('.q-formula-card');
    if(await cards.count()<6)throw new Error('formula_catalog_incomplete');
    const position=page.locator('[data-formula-id="position-size"]').first();
    await position.waitFor();
    const href=await position.getAttribute('href');
    if(!href?.includes('#/formula-detail/position-size'))throw new Error('formula_detail_link_invalid');
  }else if(name==='formula-detail'){
    await page.waitForSelector('.q-formula-detail-page');
    await page.getByRole('heading',{name:'Worked calculation'}).waitFor();
    await page.getByText('Assumptions',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Use calculator'}).waitFor();
    if(await page.locator('.q-calculation-result').count()<1)throw new Error('formula_worked_example_missing');
    const technical=page.locator('.q-formula-detail-page details').first();
    if(await technical.evaluate((node)=>node.open))throw new Error('formula_technical_reference_open_by_default');
  }else if(name==='indicator-library'){
    await page.getByRole('heading',{name:'Indicators',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Start with a familiar indicator'}).waitFor();
    await page.getByLabel('Search indicators').waitFor();
    const cards=page.locator('.q-indicator-card');
    if(await cards.count()<6)throw new Error('indicator_catalog_incomplete');
    const rsi=page.locator('[data-indicator-id="rsi"]').first();
    await rsi.waitFor();
    const href=await rsi.getAttribute('href');
    if(!href?.includes('#/indicator-detail/rsi'))throw new Error('indicator_detail_link_invalid');
  }else if(name==='indicator-detail'){
    await page.waitForSelector('.q-indicator-detail-page');
    await page.getByRole('heading',{name:'How this study works'}).waitFor();
    await page.getByRole('heading',{name:'What the result does not prove'}).waitFor();
    await page.waitForSelector('.q-indicator-chart .q-spark-bars');
    await page.waitForSelector('.q-indicator-exact-table tbody tr');
    const technical=page.locator('.q-technical-details');
    if(await technical.evaluate((node)=>node.open))throw new Error('technical_evidence_open_by_default');
    if(await page.locator('.q-indicator-value-grid strong').count()<3)throw new Error('indicator_summary_incomplete');
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

  const evidence=await collectEvidence(page);
  if(response?.status()!==200)throw new Error(`navigation_status_${response?.status()}`);
  if(evidence.horizontalOverflow)throw new Error(`horizontal_overflow_${evidence.scrollWidth}_${evidence.viewport}`);
  if(evidence.prohibited.length)throw new Error(`prohibited_copy_${evidence.prohibited.join('|')}`);
  if(evidence.visual.visibleLegacy.length)throw new Error(`legacy_chrome_visible_${evidence.visual.visibleLegacy.join('|')}`);
  if(evidence.visual.skipVisible&&!evidence.visual.skipFocusVisible)throw new Error('skip_link_visible_without_keyboard_focus');
  if(evidence.visual.mainOutlineStyle&&evidence.visual.mainOutlineStyle!=='none')throw new Error(`main_focus_outline_${evidence.visual.mainOutlineStyle}`);
  if(name==='position-size-calculator'&&!evidence.visual.panelHeadDarkSurface)throw new Error(`calculator_panel_header_too_bright_${evidence.visual.panelHeadLuminance}`);
  if(width<=560&&evidence.visual.productSystemVisible)throw new Error('mobile_technical_status_visible');
  if(name==='auth-login'&&evidence.visual.recoveryDisabled)throw new Error('recovery_action_disabled');
  if(pageErrors.length)throw new Error(`page_errors_${pageErrors.join('|')}`);
  if(consoleErrors.length)throw new Error(`console_errors_${consoleErrors.join('|')}`);
  await page.screenshot({path:fileURLToPath(new URL(screenshot,output)),fullPage:true,timeout:30000});
  result={status:'passed',name,width,height,hash,evidence,screenshot,pageErrors,consoleErrors,requestFailures};
}catch(error){
  const evidence=page?await collectEvidence(page).catch(()=>null):null;
  if(page)await page.screenshot({path:fileURLToPath(new URL(screenshot,output)),fullPage:true,timeout:15000}).catch(()=>{screenshot=null;});
  result={status:'failed',name,width,height,hash,error:error.message,evidence,screenshot,pageErrors,consoleErrors,requestFailures};
}finally{
  if(context)await Promise.race([context.close().catch(()=>{}),delay(3000)]);
  if(browser)await Promise.race([browser.close().catch(()=>{}),delay(3000)]);
  clearTimeout(hardTimeout);
}
await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
await writeFile(new URL('result.md',output),`# Qelly Browser Case — ${slug}\n\n- Status: ${result.status}\n- Route: ${hash}\n- Viewport: ${width} × ${height}\n${result.error?`- Error: ${result.error}\n`:''}`);
console.log(JSON.stringify(result,null,2));
if(result.status!=='passed')process.exit(1);
