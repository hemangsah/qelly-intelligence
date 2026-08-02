import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base=String(process.env.QELLY_RESTORATION_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const name=String(process.env.QELLY_BROWSER_CASE||'protected-route-gate');
const width=Number(process.env.QELLY_BROWSER_WIDTH||390);
const height=Number(process.env.QELLY_BROWSER_HEIGHT||844);
const hash=String(process.env.QELLY_BROWSER_HASH||'#/account-session');
const slug=`${name}-${width}x${height}`;
const output=new URL(`../dist/production-restoration-browser/${slug}/`,import.meta.url);
await mkdir(output,{recursive:true});

const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const screenshotPath=(file)=>fileURLToPath(new URL(file,output));
const stage=(value,extra={})=>writeFile(new URL('stage.json',output),JSON.stringify({stage:value,name,width,height,hash,...extra},null,2));
const hardTimeout=setTimeout(async()=>{await stage('hard-timeout').catch(()=>{});process.exit(124);},75000);
const config={productName:'Qelly Intelligence',productVersion:'0.9.0-preview.1',release:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',defaultRoute:'market',csrf:{header:'X-Qelly-CSRF',token:null,mode:'unavailable-until-authenticated'},auth:{authenticated:false,backendAvailable:true,productionIdentityEnabled:true,mode:'supabase-auth-cloudflare-facade'},cloud:{available:true,syncAvailable:true,providerRuntime:true},runtime:{releaseSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',publicSiteUrl:base,capabilities:{authentication:true,cloudSync:true,liveProviders:true,protectedWrites:true}},states:[],liveTrading:false};
const responseFor=(url)=>{const path=new URL(url).pathname;if(path==='/api/v1/config')return[200,config];if(path==='/api/v1/auth/status')return[200,{authenticated:false,context:null}];if(path==='/api/v1/health')return[200,{status:'ok',releaseSha:config.release,deterministicLocal:true,authentication:true,cloudSync:true,liveProviders:true,trading:false,custody:false,transfers:false}];if(path==='/api/v1/readiness')return[200,{ready:true,dependencies:{supabase:'configured',auth:'configured',rls:'required',providers:'configured'},releaseSha:config.release}];if(path==='/api/v1/providers/status')return[200,{providers:[{id:'coinbase',name:'Coinbase Exchange',state:'live',description:'Public spot quotes'},{id:'ecb',name:'European Central Bank',state:'live',description:'Official reference rates'},{id:'binance',name:'Binance',state:'unavailable',description:'Unavailable in this region'}],releaseSha:config.release}];return[401,{error:{code:'authentication_required',message:'Authentication is required'}}];};
const prohibited=['QELLY GLOBAL PUBLIC BETA','VALIDATION STATE','Unable to render this route','Retry foundation route','AUTHENTICATION DEMO','LOCAL DEMONSTRATION IDENTITY BOUNDARY','STATE: DEFAULT','Secure identity foundation','Network · online','Authentication · active','Cloud sync · opt-in available'];
const collect=page=>page.evaluate((blocked)=>{
  const bodyText=document.body?.innerText||'';
  const visible=(element)=>{if(!element)return false;const style=getComputedStyle(element),box=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0;};
  const legacySelectors=['.q-worldclass-context','#context-shelf','#persona-ribbon','#edge-dock','#rail','#compare-tray','#mobile-navigation','.q-global-strip','.q-scroll-progress'];
  return{
    title:document.title,route:location.hash,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,
    prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),text:bodyText.slice(0,2200),
    visual:{
      visibleLegacy:legacySelectors.filter((selector)=>[...document.querySelectorAll(selector)].some(visible)),
      skipVisible:visible(document.querySelector('.skip-link')),
      skipFocusVisible:Boolean(document.querySelector('.skip-link')?.matches(':focus-visible')),
      mainOutlineStyle:getComputedStyle(document.getElementById('main')).outlineStyle,
      productSystemVisible:visible(document.querySelector('.q-product-system'))
    }
  };
},prohibited);

let browser,context,page,result;
const pageErrors=[],consoleErrors=[],requestFailures=[];
try{
  await stage('launching');
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
  page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror',(error)=>pageErrors.push(error.message));
  page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('requestfailed',(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||'unknown'}));
  await page.route('**/api/v1/**',async(route)=>{const [status,body]=responseFor(route.request().url());await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});});
  await stage('navigating');
  const response=await page.goto(`${base}/${hash}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:15000});
  if(name==='protected-route-gate'){
    await page.getByRole('heading',{name:'Sign in to continue'}).waitFor();
    const gate=page.locator('.q-access-gate');
    await gate.getByRole('link',{name:'Sign in',exact:true}).waitFor();
    await gate.getByRole('link',{name:'Create account',exact:true}).waitFor();
    await gate.getByRole('link',{name:'Return home',exact:true}).waitFor();
    const loginHref=await gate.getByRole('link',{name:'Sign in',exact:true}).getAttribute('href');
    if(!loginHref?.includes('#/auth-login'))throw new Error('protected_route_login_link_invalid');
  }else if(name==='system-status'){
    await page.getByRole('heading',{name:'Qelly service and provider status'}).waitFor();
    await page.getByText('Runtime identity',{exact:true}).waitFor();
    await page.getByText('Coinbase Exchange',{exact:true}).waitFor();
    await page.getByText('European Central Bank',{exact:true}).waitFor();
    if((await page.locator('.q-product-header').innerText()).includes('aaaaaaaa'))throw new Error('release_sha_exposed_in_primary_header');
  }else throw new Error(`unknown_simple_case_${name}`);
  await stage('asserting');
  const evidence=await collect(page);
  if(response?.status()!==200)throw new Error(`navigation_status_${response?.status()}`);
  if(evidence.horizontalOverflow)throw new Error(`horizontal_overflow_${evidence.scrollWidth}_${evidence.viewport}`);
  if(evidence.prohibited.length)throw new Error(`prohibited_copy_${evidence.prohibited.join('|')}`);
  if(evidence.visual.visibleLegacy.length)throw new Error(`legacy_chrome_visible_${evidence.visual.visibleLegacy.join('|')}`);
  if(evidence.visual.skipVisible&&!evidence.visual.skipFocusVisible)throw new Error('skip_link_visible_without_keyboard_focus');
  if(evidence.visual.mainOutlineStyle!=='none')throw new Error(`main_focus_outline_${evidence.visual.mainOutlineStyle}`);
  if(width<=560&&evidence.visual.productSystemVisible)throw new Error('mobile_technical_status_visible');
  if(pageErrors.length)throw new Error(`page_errors_${pageErrors.join('|')}`);
  if(consoleErrors.length)throw new Error(`console_errors_${consoleErrors.join('|')}`);
  result={status:'passed',name,width,height,hash,evidence,screenshot:`${slug}.png`,pageErrors,consoleErrors,requestFailures};
  await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
  await stage('capturing');
  await page.screenshot({path:screenshotPath(`${slug}.png`),fullPage:false,animations:'disabled',caret:'hide',timeout:12000});
  await stage('complete');
}catch(error){
  const evidence=page?await collect(page).catch(()=>null):null;
  result={status:'failed',name,width,height,hash,error:error.message,evidence,pageErrors,consoleErrors,requestFailures};
  if(page)await page.screenshot({path:screenshotPath(`${slug}-failure.png`),fullPage:false,animations:'disabled',caret:'hide',timeout:6000}).catch(()=>{});
  await writeFile(new URL('result.json',output),JSON.stringify(result,null,2));
  await stage('failed',{error:error.message});
}finally{
  await Promise.race([context?.close().catch(()=>{}),delay(3000)]);
  await Promise.race([browser?.close().catch(()=>{}),delay(3000)]);
  clearTimeout(hardTimeout);
}
await writeFile(new URL('result.md',output),`# Qelly Product Browser Case — ${slug}\n\n- Status: ${result.status}\n- Route: ${hash}\n- Viewport: ${width} × ${height}\n${result.error?`- Error: ${result.error}\n`:''}`);
console.log(JSON.stringify(result,null,2));
if(result.status!=='passed')process.exit(1);
