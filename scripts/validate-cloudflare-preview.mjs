import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';

const base=String(process.env.QELLY_PREVIEW_URL||'https://qelly-intelligence.pages.dev').replace(/\/$/,'');
const expectedSha=String(process.env.QELLY_EXPECTED_HEAD_SHA||'').trim();
const maxWaitMs=Number(process.env.QELLY_PREVIEW_MAX_WAIT_MS||720000);
const output=new URL('../dist/cloudflare-preview-evidence/',import.meta.url);
const fallbackSha='603cece3091dc59cfb72680914e7056b40058022';
const prohibited=['QELLY GLOBAL PUBLIC BETA','VALIDATION STATE','Unable to render this route','Retry foundation route','AUTHENTICATION DEMO','LOCAL DEMONSTRATION IDENTITY BOUNDARY','STATE: DEFAULT','Secure identity foundation','Input JSON'];
const allowedProviderStates=new Set(['live','cached','stale','delayed','unavailable']);
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const urlFor=(pathname)=>`${base}${pathname}${pathname.includes('?')?'&':'?'}qelly_verify=${Date.now()}`;

if(!/^[0-9a-f]{40}$/i.test(expectedSha))throw new Error('QELLY_EXPECTED_HEAD_SHA must be a full commit SHA');
await mkdir(output,{recursive:true});

const fetchResponse=async(pathname,{timeout=30000,origin=null}={})=>{
  const response=await fetch(urlFor(pathname),{
    headers:{Accept:pathname.endsWith('.html')||pathname==='/'?'text/html,application/xhtml+xml':'application/json,text/plain,*/*','Cache-Control':'no-cache',Pragma:'no-cache',...(origin?{Origin:origin}:{})},
    redirect:'follow',
    signal:AbortSignal.timeout(timeout)
  });
  const text=await response.text();
  let json=null;
  if(text){try{json=JSON.parse(text);}catch{}}
  return {response,text,json};
};

const expectStatus=(entry,status,label)=>{
  if(entry.response.status!==status)throw new Error(`${label}_status_${entry.response.status}_${entry.text.slice(0,160).replace(/\s+/g,'_')}`);
};
const expectSecurityHeaders=(response,label)=>{
  const csp=response.headers.get('content-security-policy')||'';
  if(!csp.includes("frame-ancestors 'none'")||csp.includes("'unsafe-eval'"))throw new Error(`${label}_csp_invalid`);
  if(response.headers.get('x-content-type-options')!=='nosniff')throw new Error(`${label}_nosniff_missing`);
  if(response.headers.get('x-frame-options')!=='DENY')throw new Error(`${label}_frame_guard_missing`);
  if(!response.headers.get('strict-transport-security')?.includes('max-age='))throw new Error(`${label}_hsts_missing`);
};

const deploymentAttempts=[];
let releaseEntry=null;
const started=Date.now();
while(Date.now()-started<maxWaitMs){
  try{
    const entry=await fetchResponse('/qelly-release.json',{timeout:15000});
    const observed=entry.json?.releaseSha||null;
    deploymentAttempts.push({at:new Date().toISOString(),status:entry.response.status,releaseSha:observed});
    if(entry.response.ok&&observed===expectedSha){releaseEntry=entry;break;}
  }catch(error){deploymentAttempts.push({at:new Date().toISOString(),error:error.message});}
  await delay(10000);
}
if(!releaseEntry)throw new Error(`cloudflare_exact_head_not_observed_${expectedSha}`);

const release=releaseEntry.json;
if(release.fallbackReleaseSha!==fallbackSha)throw new Error('cloudflare_fallback_identity_mismatch');
if(release.mode!=='cloudflare-pages-public-runtime')throw new Error(`cloudflare_release_mode_${release.mode}`);
if(!release.authentication||!release.cloudSync||!release.liveProviders||!release.protectedWrites)throw new Error('cloudflare_release_capabilities_incomplete');

const homepage=await fetchResponse('/',{timeout:30000});
expectStatus(homepage,200,'homepage');
expectSecurityHeaders(homepage.response,'homepage');
if(!homepage.text.includes('qelly-public-runtime.mjs'))throw new Error('homepage_public_runtime_missing');
if(prohibited.some((phrase)=>homepage.text.includes(phrase)))throw new Error('homepage_prohibited_copy_present');
const cacheControl=homepage.response.headers.get('cache-control')||'';
if(!cacheControl.includes('no-transform'))throw new Error('homepage_no_transform_missing');

const forbiddenOrigin=await fetchResponse('/api/v1/config',{timeout:30000,origin:'https://example.invalid'});
expectStatus(forbiddenOrigin,403,'forbidden_origin');
if(forbiddenOrigin.json?.error?.code!=='cors_origin_forbidden')throw new Error('forbidden_origin_contract_invalid');

const configEntry=await fetchResponse('/api/v1/config',{timeout:30000});
expectStatus(configEntry,200,'config');
expectSecurityHeaders(configEntry.response,'config');
const config=configEntry.json;
if(config?.productName!=='Qelly Intelligence'||config?.release!==expectedSha)throw new Error('config_release_identity_mismatch');
if(config?.defaultRoute!=='market'||config?.liveTrading!==false)throw new Error('config_product_boundary_invalid');
if(config?.auth?.authenticated!==false||config?.auth?.mode!=='supabase-auth-cloudflare-facade')throw new Error('config_anonymous_auth_boundary_invalid');
const runtime=config?.runtime||{};
if(runtime.releaseSha!==expectedSha)throw new Error('runtime_release_identity_mismatch');
if(!runtime.capabilities?.authentication||!runtime.capabilities?.cloudSync||!runtime.capabilities?.liveProviders||!runtime.capabilities?.protectedWrites)throw new Error('runtime_capabilities_incomplete');
const publishableKey=String(runtime.supabasePublishableKey||'');
const publishableShape=publishableKey.startsWith('sb_publishable_')||publishableKey.split('.').length===3;
if(!publishableShape||publishableKey==='ssdgfgqnjlwzkgukzeef'||publishableKey.startsWith('sb_secret_')||/service_role/i.test(publishableKey))throw new Error('supabase_publishable_key_invalid');
if(!String(runtime.supabaseUrl||'').startsWith('https://')||!String(runtime.supabaseUrl).endsWith('.supabase.co'))throw new Error('supabase_url_invalid');

const healthEntry=await fetchResponse('/api/v1/health',{timeout:30000});
expectStatus(healthEntry,200,'health');
expectSecurityHeaders(healthEntry.response,'health');
const health=healthEntry.json;
if(health?.status!=='ok'||health?.releaseSha!==expectedSha||!health.authenticationConfigured||!health.cloudSyncConfigured||!health.liveProvidersConfigured)throw new Error('health_contract_invalid');
if(health.trading!==false||health.custody!==false||health.transfers!==false)throw new Error('health_execution_boundary_invalid');

const readinessEntry=await fetchResponse('/api/v1/readiness',{timeout:30000});
expectStatus(readinessEntry,200,'readiness');
const readiness=readinessEntry.json;
if(readiness?.ready!==true||readiness?.releaseSha!==expectedSha)throw new Error('readiness_contract_invalid');
for(const [name,value] of Object.entries({supabase:'supabase_auth_health_proven',auth:'email_delivery_canary_proven',rls:'rls_isolation_canary_proven',providers:'ecb_reference_freshness_proven'}))if(readiness?.dependencies?.[name]!==value)throw new Error(`readiness_dependency_${name}_${readiness?.dependencies?.[name]}`);

const statusEntry=await fetchResponse('/api/v1/providers/status',{timeout:30000});
expectStatus(statusEntry,200,'provider_status');
const providerIds=new Set((statusEntry.json?.providers||[]).map((item)=>item.id));
for(const id of ['coinbase','ecb','binance'])if(!providerIds.has(id))throw new Error(`provider_catalog_missing_${id}`);
if(statusEntry.json?.releaseSha!==expectedSha)throw new Error('provider_status_release_mismatch');

const marketEntry=await fetchResponse('/api/v1/market/overview',{timeout:45000});
expectStatus(marketEntry,200,'market_overview');
const market=marketEntry.json;
if(market?.execution!==false||market?.deterministicLocal!==false||market?.fabricatedFallback!==false)throw new Error('market_execution_boundary_invalid');
for(const id of ['coinbase','ecb','binance']){
  const item=market?.providers?.[id];
  if(!item||item.provider!==id||!allowedProviderStates.has(item.truthState))throw new Error(`market_provider_contract_${id}`);
  if(!item.ingestedAt)throw new Error(`market_provider_ingested_at_missing_${id}`);
}

const authStatus=await fetchResponse('/api/v1/auth/status',{timeout:30000});
expectStatus(authStatus,200,'auth_status');
if(authStatus.json?.authenticated!==false)throw new Error('anonymous_auth_status_invalid');
const protectedEntry=await fetchResponse('/api/v1/session/context',{timeout:30000});
expectStatus(protectedEntry,401,'protected_route');
if(protectedEntry.json?.error?.code!=='authentication_required')throw new Error('protected_route_error_contract_invalid');

const browserEvidence=[];
const browser=await chromium.launch({headless:true});
try{
  const cases=[
    {name:'market-desktop',hash:'#/market',width:1440,height:1000,selector:'.q-market-home',heading:'Governed Market Terminal'},
    {name:'auth-mobile',hash:'#/auth-login',width:390,height:844,selector:'.q-auth-page',heading:'Sign in to Qelly'},
    {name:'formula-mobile',hash:'#/formula-detail/position-size',width:390,height:844,selector:'.q-formula-detail-page',heading:'Worked calculation'}
  ];
  for(const item of cases){
    const context=await browser.newContext({viewport:{width:item.width,height:item.height},serviceWorkers:'block',reducedMotion:'reduce'});
    const page=await context.newPage();
    const pageErrors=[],consoleErrors=[],apiFailures=[];
    page.on('pageerror',(error)=>pageErrors.push(error.message));
    page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text());});
    page.on('response',(response)=>{if(response.url().includes('/api/v1/')&&response.status()>=400)apiFailures.push({url:new URL(response.url()).pathname,status:response.status()});});
    const response=await page.goto(`${base}/${item.hash}`,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true',{timeout:30000});
    await page.waitForSelector(item.selector,{timeout:30000});
    await page.getByRole('heading',{name:item.heading,exact:item.name!=='market-desktop'}).waitFor({timeout:30000});
    if(item.name==='market-desktop'){
      await page.waitForSelector('[data-provider="coinbase"]',{timeout:30000});
      await page.waitForSelector('[data-provider="ecb"]',{timeout:30000});
      await page.waitForSelector('[data-provider="binance"]',{timeout:30000});
    }
    if(item.name==='auth-mobile'){
      await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
      await page.getByRole('button',{name:'Forgot password?'}).waitFor();
    }
    const visual=await page.evaluate((blocked)=>{
      const bodyText=document.body?.innerText||'';
      const visible=(node)=>{if(!node)return false;const style=getComputedStyle(node),box=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0&&box.height>0;};
      const legacy=['.q-worldclass-context','#context-shelf','#persona-ribbon','#edge-dock','#rail','#compare-tray','#mobile-navigation','.q-global-strip'].filter((selector)=>[...document.querySelectorAll(selector)].some(visible));
      const formulaLayout=document.querySelector('.q-formula-detail-page .q-calculator-layout');
      const formulaPanels=formulaLayout?[...formulaLayout.children].map((node)=>{const box=node.getBoundingClientRect();return{top:box.top,bottom:box.bottom,width:box.width,height:box.height,visible:visible(node),text:(node.textContent||'').slice(0,80)};}):[];
      return{title:document.title,route:location.hash,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,prohibited:blocked.filter((phrase)=>bodyText.includes(phrase)),legacy,formulaPanels,workedVisible:visible(document.querySelector('.q-formula-detail-page .q-calculator-layout>.q-panel:nth-child(2)')),guidanceVisible:[...document.querySelectorAll('.q-formula-detail-page .q-responsive-table tbody td:nth-child(4)')].every(visible)};
    },prohibited);
    if(response?.status()!==200)throw new Error(`${item.name}_navigation_${response?.status()}`);
    if(visual.horizontalOverflow)throw new Error(`${item.name}_horizontal_overflow_${visual.scrollWidth}_${visual.viewport}`);
    if(visual.prohibited.length)throw new Error(`${item.name}_prohibited_${visual.prohibited.join('|')}`);
    if(visual.legacy.length)throw new Error(`${item.name}_legacy_${visual.legacy.join('|')}`);
    if(item.name==='formula-mobile'&&(!visual.workedVisible||!visual.guidanceVisible||visual.formulaPanels.length!==2||visual.formulaPanels[1].top<visual.formulaPanels[0].bottom-2))throw new Error('formula_mobile_flow_invalid');
    if(pageErrors.length)throw new Error(`${item.name}_page_errors_${pageErrors.join('|')}`);
    if(consoleErrors.length)throw new Error(`${item.name}_console_errors_${consoleErrors.join('|')}`);
    if(apiFailures.length)throw new Error(`${item.name}_api_failures_${JSON.stringify(apiFailures)}`);
    const screenshot=`${item.name}-${item.width}x${item.height}.png`;
    await page.screenshot({path:fileURLToPath(new URL(screenshot,output)),fullPage:true,timeout:45000});
    browserEvidence.push({...item,screenshot,visual,pageErrors,consoleErrors,apiFailures});
    await context.close();
  }
}finally{
  await browser.close();
}

const sanitized={
  status:'passed',base,expectedSha,observedReleaseSha:release.releaseSha,fallbackReleaseSha:release.fallbackReleaseSha,deploymentAttempts,
  release:{mode:release.mode,authentication:release.authentication,cloudSync:release.cloudSync,liveProviders:release.liveProviders,protectedWrites:release.protectedWrites,buildTimestamp:release.buildTimestamp},
  config:{productName:config.productName,release:config.release,authMode:config.auth.mode,publicSiteUrl:runtime.publicSiteUrl,supabaseUrl:runtime.supabaseUrl,publishableKeyShape:publishableKey.startsWith('sb_publishable_')?'sb_publishable':publishableKey.split('.').length===3?'legacy_anon_jwt':'invalid',publishableKeyLength:publishableKey.length,capabilities:runtime.capabilities},
  health,readiness,
  providers:[...(statusEntry.json?.providers||[])].map(({id,name,state})=>({id,name,state})),
  market:{generatedAt:market.generatedAt,providers:Object.fromEntries(Object.entries(market.providers||{}).map(([id,item])=>[id,{provider:item.provider,truthState:item.truthState,observedAt:item.observedAt,ingestedAt:item.ingestedAt,attribution:item.attribution,errorCode:item.error?.code||null}]))},
  anonymousAuth:authStatus.json,
  protectedRoute:{status:protectedEntry.response.status,errorCode:protectedEntry.json?.error?.code},
  browserEvidence
};
await writeFile(new URL('result.json',output),JSON.stringify(sanitized,null,2));
await writeFile(new URL('result.md',output),`# Qelly Cloudflare Preview Verification\n\n- Status: passed\n- Preview: ${base}\n- Exact head: ${expectedSha}\n- Browser cases: ${browserEvidence.length}\n- Publishable key shape: ${sanitized.config.publishableKeyShape}\n`);
console.log(JSON.stringify(sanitized,null,2));
