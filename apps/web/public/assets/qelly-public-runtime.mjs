const config=window.__QELLY_CONFIG__||{};
const initialHash=location.hash;
let releaseIdentity={releaseSha:config.releaseSha||'unresolved',workflowRun:null,deployedAt:null,mode:config.deploymentStage||'unknown'};
let rendering=false;
let headerRetryCount=0;
let sessionState={authenticated:false,sync:'off'};

const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const routeFromHash=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[0]||'market';
const apiUrl=(path)=>config.apiBaseUrl?new URL(path,`${String(config.apiBaseUrl).replace(/\/$/,'')}/`).toString():path;
const requestJson=async(path)=>{const response=await fetch(apiUrl(path),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});const body=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(body?.error?.message||`Request failed (${response.status})`),{status:response.status,code:body?.error?.code});return body;};
const navigate=(route,query='')=>{location.hash=`#/${route}${query?`?${query}`:''}`;};
const displayTime=(value)=>{if(!value)return 'Not reported';const date=new Date(value);return Number.isNaN(date.valueOf())?'Not reported':date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});};
const stateLabel=(value)=>({live:'Live','live-public':'Live',fresh:'Fresh',cached:'Cached',stale:'Stale',delayed:'Delayed',unavailable:'Unavailable',offline:'Offline',degraded:'Degraded',simulated:'Deterministic'}[String(value||'').toLowerCase()]||String(value||'Unavailable'));
const stateClass=(value)=>{const state=String(value||'unavailable').toLowerCase();if(state.includes('live')||state==='fresh')return'live';if(state==='cached')return'cached';if(state==='stale'||state==='delayed'||state==='degraded')return'delayed';if(state==='offline')return'offline';return'unavailable';};
const formatPrice=(value,currency='USD')=>Number.isFinite(Number(value))?new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:Number(value)>=100?2:6}).format(Number(value)):'Unavailable';
const humanRoute=(route)=>({market:'Markets','asset-rankings':'Market rankings','research-workspace':'Research','formula-library':'Formulas','indicator-library':'Indicators','calculator-center':'Calculators','saved-calculations':'Saved work','auth-login':'Account','auth-register':'Create account','auth-recovery':'Account recovery','account-session':'Account','live-markets':'Live markets'}[route]||route.split('-').map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '));

function productNav(){
  return[
    ['Decision','decision-provenance'],
    ['Qelly Chat','news-research'],
    ['Markets','market'],
    ['Research','research-workspace'],
    ['Tools','calculator-center']
  ];
}

function buildProductHeader(){
  document.querySelector('.q-public-runtime-banner')?.remove();
  document.documentElement.dataset.productSurface='production';
  const legacy=document.querySelector('.q-command-bar');
  // app.js creates the legacy command bar asynchronously. Do not abandon the
  // production shell when this module wins that race during first paint.
  if(!legacy){
    if(headerRetryCount<40){headerRetryCount+=1;setTimeout(buildProductHeader,50);}
    return;
  }
  headerRetryCount=0;
  legacy.className='q-product-header';
  legacy.setAttribute('aria-label','Qelly product navigation');
  legacy.innerHTML=`
    <a class="q-product-brand" href="#/market" aria-label="Qelly Intelligence home"><span class="q-product-brand__mark"><img src="./assets/brand/qelly-symbol.svg" width="28" height="28" alt=""></span><span><strong>Qelly</strong><small>Market intelligence</small></span></a>
    <button class="q-product-menu" type="button" aria-expanded="false" aria-controls="q-product-navigation"><span aria-hidden="true">☰</span><span>Menu</span></button>
    <nav id="q-product-navigation" class="q-product-nav" aria-label="Primary">${productNav().map(([label,route])=>`<a href="#/${route}" data-product-route="${route}">${label}</a>`).join('')}</nav>
    <form class="q-product-search" role="search"><label class="q-visually-hidden" for="q-product-search-input">Search Qelly</label><input id="q-product-search-input" name="q" type="search" autocomplete="off" placeholder="Search Qelly"><button type="submit" aria-label="Search Qelly"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg><span class="q-visually-hidden">Search</span></button></form>
    <div class="q-product-actions"><button class="q-product-system" type="button" data-product-route="status" aria-label="Open system status"><span class="q-product-system__dot" data-state="${navigator.onLine?'live':'offline'}"></span><span>${navigator.onLine?'Online':'Offline'}</span></button><a class="q-product-account" href="#/${sessionState.authenticated?'account-session':'auth-login'}"><span aria-hidden="true">${sessionState.authenticated?'QI':'↗'}</span><span>${sessionState.authenticated?'Account':'Sign in'}</span></a></div>`;
  legacy.querySelector('.q-product-menu')?.addEventListener('click',(event)=>{const open=legacy.classList.toggle('is-menu-open');event.currentTarget.setAttribute('aria-expanded',String(open));if(open)legacy.querySelector('#q-product-navigation a')?.focus();});
  legacy.querySelectorAll('[data-product-route]').forEach((element)=>element.addEventListener('click',(event)=>{event.preventDefault();legacy.classList.remove('is-menu-open');legacy.querySelector('.q-product-menu')?.setAttribute('aria-expanded','false');navigate(element.dataset.productRoute);}));
  legacy.querySelector('.q-product-search')?.addEventListener('submit',(event)=>{event.preventDefault();const query=new FormData(event.currentTarget).get('q')?.toString().trim();navigate('search',query?`q=${encodeURIComponent(query)}`:'');});
  updateHeaderRoute();
}

function updateHeaderRoute(){
  const route=routeFromHash();
  document.querySelectorAll('[data-product-route]').forEach((element)=>{const current=element.dataset.productRoute===route;element.classList.toggle('is-active',current);if(element.tagName==='A')element.setAttribute('aria-current',current?'page':'false');});
}

function applySessionState(detail){
  sessionState.authenticated=detail?.authenticated===true;
  sessionState.sync=sessionState.authenticated?'available':'unavailable';
  buildProductHeader();
}

function providerCard(name,result){
  const truth=result?.truthState||result?.state||'unavailable';
  const error=result?.error?.message||result?.message||'';
  const observed=result?.observedAt||result?.data?.observedAt||result?.observationTime;
  const ingested=result?.ingestedAt||result?.data?.ingestedAt;
  const attribution=result?.attribution||result?.source?.name||name;
  return `<article class="q-market-provider" data-provider="${escapeHtml(name.toLowerCase())}">
    <div class="q-market-provider__head"><div><span class="q-market-provider__eyebrow">Data provider</span><h3>${escapeHtml(name)}</h3></div><span class="q-truth-pill is-${stateClass(truth)}">${escapeHtml(stateLabel(truth))}</span></div>
    <dl><div><dt>Source</dt><dd>${escapeHtml(attribution)}</dd></div><div><dt>Observed</dt><dd>${escapeHtml(displayTime(observed))}</dd></div><div><dt>Ingested</dt><dd>${escapeHtml(displayTime(ingested))}</dd></div></dl>
    ${error?`<p class="q-market-provider__notice">${escapeHtml(error)}</p>`:'<p class="q-market-provider__notice">Read-only market observation. No account or execution access.</p>'}
  </article>`;
}

function loadingHome(){
  const main=document.getElementById('main');if(!main)return;
  main.dataset.qellyProductHome='loading';
  main.innerHTML=`<section class="q-market-home" aria-busy="true"><div class="q-market-skeleton q-market-skeleton--hero"></div><div class="q-market-skeleton-grid">${Array.from({length:6},()=>'<div class="q-market-skeleton"></div>').join('')}</div></section>`;
}

async function renderMarketHomepage(){
  if(rendering)return;rendering=true;
  const main=document.getElementById('main');if(!main){rendering=false;return;}
  loadingHome();
  let overview=null,error=null;
  try{overview=await requestJson('/api/v1/market/overview');}catch(caught){error=caught;}
  const market=overview?.market||[];
  const coinbase=overview?.providers?.coinbase||null;
  const binance=overview?.providers?.binance||null;
  const ecb=overview?.providers?.ecb||null;
  const coinbaseQuote=market.find((item)=>String(item.provider).toLowerCase()==='coinbase')||{};
  const binanceQuote=market.find((item)=>String(item.provider).toLowerCase()==='binance')||{};
  const reference=overview?.referenceRates||{};
  main.dataset.qellyProductHome='ready';
  main.removeAttribute('aria-busy');
  main.innerHTML=`<section class="q-market-home">
    <section class="q-market-hero">
      <div class="q-market-hero__copy"><p class="q-market-kicker">Evidence-backed market intelligence</p><h1>Understand markets before making a decision.</h1><p>Explore read-only market observations, deterministic formulas and research tools with clear source, freshness and availability labels.</p><form class="q-market-hero__search" role="search"><label class="q-visually-hidden" for="q-market-home-search">Search markets and tools</label><input id="q-market-home-search" name="q" type="search" placeholder="Search Bitcoin, EUR, position size…"><button type="submit">Explore</button></form><div class="q-market-hero__actions"><a class="q-button q-button--primary" href="#/asset-rankings">Explore markets</a><a class="q-button q-button--secondary" href="#/formula-library">Browse formulas</a></div></div>
      <div class="q-market-hero__snapshot" aria-label="Market snapshot"><div class="q-market-hero__snapshot-head"><span>Market snapshot</span><span class="q-truth-pill is-${error?'unavailable':'live'}">${error?'Unavailable':'Provider-backed'}</span></div><div class="q-market-hero__quotes"><article><span>Bitcoin · Coinbase</span><strong>${escapeHtml(coinbaseQuote.value||formatPrice(coinbase?.data?.price))}</strong><small>${escapeHtml(stateLabel(coinbaseQuote.state||coinbase?.truthState))}</small></article><article><span>Bitcoin · Binance</span><strong>${escapeHtml(binanceQuote.value||formatPrice(binance?.data?.price))}</strong><small>${escapeHtml(stateLabel(binanceQuote.state||binance?.truthState))}</small></article><article><span>ECB reference rates</span><strong>${Number(reference.count||0).toLocaleString()}</strong><small>${escapeHtml(stateLabel(reference.state||ecb?.truthState))}</small></article></div><p class="q-market-hero__timestamp">Updated ${escapeHtml(displayTime(overview?.generatedAt))}</p></div>
    </section>
    ${error?`<section class="q-market-unavailable" role="status"><div><h2>Market observations are temporarily unavailable</h2><p>${escapeHtml(error.message)} Deterministic formulas and calculators remain available.</p></div><button type="button" data-market-retry>Retry market data</button></section>`:''}
    <section class="q-market-section"><div class="q-market-section__head"><div><p class="q-market-kicker">Markets</p><h2>Selected observations</h2><p>Availability is isolated by provider so one upstream failure never collapses the experience.</p></div><a href="#/live-markets">Open market workspace</a></div><div class="q-market-observation-grid"><article class="q-market-observation"><span>BTC / USD</span><strong>${escapeHtml(coinbaseQuote.value||formatPrice(coinbase?.data?.price))}</strong><div><span>Coinbase Exchange</span><span class="q-truth-pill is-${stateClass(coinbaseQuote.state||coinbase?.truthState)}">${escapeHtml(stateLabel(coinbaseQuote.state||coinbase?.truthState))}</span></div></article><article class="q-market-observation"><span>BTC / USDT</span><strong>${escapeHtml(binanceQuote.value||formatPrice(binance?.data?.price))}</strong><div><span>Binance</span><span class="q-truth-pill is-${stateClass(binanceQuote.state||binance?.truthState)}">${escapeHtml(stateLabel(binanceQuote.state||binance?.truthState))}</span></div></article><article class="q-market-observation"><span>EUR reference set</span><strong>${Number(reference.count||0).toLocaleString()} rates</strong><div><span>European Central Bank</span><span class="q-truth-pill is-${stateClass(reference.state||ecb?.truthState)}">${escapeHtml(stateLabel(reference.state||ecb?.truthState))}</span></div></article></div></section>
    <section class="q-market-section"><div class="q-market-section__head"><div><p class="q-market-kicker">Source truth</p><h2>Provider status and provenance</h2><p>Observation and ingestion times remain visible without exposing internal runtime configuration.</p></div><a href="#/status">System status</a></div><div class="q-market-provider-grid">${providerCard('Coinbase Exchange',coinbase)}${providerCard('European Central Bank',ecb)}${providerCard('Binance',binance)}</div></section>
    <section class="q-market-section"><div class="q-market-section__head"><div><p class="q-market-kicker">Decision tools</p><h2>Move from observation to structured analysis</h2><p>All calculation tools remain deterministic and read-only.</p></div></div><div class="q-product-tool-grid"><a href="#/formula-library"><span>151</span><h3>Formula library</h3><p>Discover documented quantitative methods with assumptions and units.</p></a><a href="#/indicator-library"><span>54</span><h3>Indicator library</h3><p>Explore market indicators with transparent methodology and interpretation.</p></a><a href="#/calculator-center"><span>Tools</span><h3>Calculators</h3><p>Use structured inputs, validation and explainable outputs.</p></a><a href="#/saved-calculations"><span>${sessionState.authenticated?'Cloud':'Local'}</span><h3>Saved work</h3><p>${sessionState.authenticated?'Review local and cloud-synchronized calculations.':'Save locally now and sign in when cloud synchronization is needed.'}</p></a></div></section>
    <section class="q-market-safety"><div><p class="q-market-kicker">Read-only by design</p><h2>Research and calculation—not execution.</h2></div><p>Qelly does not place orders, hold funds, sign wallets or provide personalized financial advice. Provider failure never disables deterministic local tools.</p></section>
  </section>`;
  main.querySelector('.q-market-hero__search')?.addEventListener('submit',(event)=>{event.preventDefault();const query=new FormData(event.currentTarget).get('q')?.toString().trim();navigate('asset-rankings',query?`query=${encodeURIComponent(query)}`:'');});
  main.querySelector('[data-market-retry]')?.addEventListener('click',renderMarketHomepage);
  document.title='Qelly Intelligence · Market intelligence';
  rendering=false;
}

async function renderStatusPage(){
  if(rendering)return;rendering=true;
  const main=document.getElementById('main');if(!main){rendering=false;return;}
  const [health,readiness,providers]=await Promise.all([
    requestJson('/api/v1/health').catch((error)=>({status:'unavailable',error:error.message})),
    requestJson('/api/v1/readiness').catch((error)=>({ready:false,error:error.message})),
    requestJson('/api/v1/providers/status').catch((error)=>({providers:[],error:error.message}))
  ]);
  await loadReleaseIdentity();
  main.innerHTML=`<section class="q-system-page"><div class="q-system-page__head"><p class="q-market-kicker">System status</p><h1>Qelly service and provider status</h1><p>Technical runtime identity is kept here instead of the primary product navigation.</p></div><div class="q-system-grid"><article><span>Application</span><strong>${health.status==='ok'?'Operational':'Unavailable'}</strong><small>Read-only public runtime</small></article><article><span>Readiness</span><strong>${readiness.ready?'Ready':'Degraded'}</strong><small>Supabase, Auth, RLS and providers</small></article><article><span>Network</span><strong>${navigator.onLine?'Online':'Offline'}</strong><small>Current browser connectivity</small></article><article><span>Account</span><strong>${sessionState.authenticated?'Signed in':'Signed out'}</strong><small>${sessionState.authenticated?'Cloud sync available':'Local tools available'}</small></article></div><section class="q-system-details"><h2>Provider capabilities</h2><div>${(providers.providers||[]).map((provider)=>`<article><div><strong>${escapeHtml(provider.name||provider.id)}</strong><small>${escapeHtml(provider.description||provider.capability||'Read-only public data')}</small></div><span class="q-truth-pill is-${stateClass(provider.state||provider.status||'live')}">${escapeHtml(stateLabel(provider.state||provider.status||'Available'))}</span></article>`).join('')||'<p>Provider catalogue is unavailable.</p>'}</div></section><details class="q-system-identity"><summary>Runtime identity</summary><dl><div><dt>Environment</dt><dd>${escapeHtml(releaseIdentity.mode)}</dd></div><div><dt>Release</dt><dd><code>${escapeHtml(releaseIdentity.releaseSha)}</code></dd></div><div><dt>Fallback</dt><dd><code>603cece3091dc59cfb72680914e7056b40058022</code></dd></div><div><dt>Public URL</dt><dd>${escapeHtml(config.publicSiteUrl||location.origin)}</dd></div></dl></details></section>`;
  document.title='System status · Qelly Intelligence';rendering=false;
}

function renderAccessGate(route){
  const main=document.getElementById('main');if(!main)return;
  const destination=humanRoute(route);
  sessionStorage.setItem('qelly.returnTo',route);
  main.innerHTML=`<section class="q-access-gate"><div class="q-access-gate__icon" aria-hidden="true">↗</div><p class="q-market-kicker">Account required</p><h1>Sign in to continue</h1><p>${escapeHtml(destination)} uses your private Qelly workspace. Sign in to continue without losing this destination.</p><div class="q-access-gate__actions"><a class="q-button q-button--primary" href="#/auth-login">Sign in</a><a class="q-button q-button--secondary" href="#/auth-register">Create account</a><a class="q-button q-button--ghost" href="#/market">Return home</a></div><small>Your calculations remain read-only until you explicitly enable cloud synchronization.</small></section>`;
  document.title=`Sign in to continue · ${destination} · Qelly Intelligence`;
}

function enhanceCurrentRoute(){
  const main=document.getElementById('main');if(!main||rendering)return;
  const route=routeFromHash();updateHeaderRoute();
  // Market is owned by the connected market-v6 route. Do not replace it with
  // the legacy beta homepage or call that page's private market contract.
  if(route==='market')return;
  if(route==='status'){if(!main.querySelector('.q-system-page'))renderStatusPage();return;}
  const text=main.textContent||'';
  if(/Unable to render this route/i.test(text)&&/Authentication is required|authentication_required|sign in required/i.test(text))renderAccessGate(route);
  document.querySelector('.q-auth-page')?.setAttribute('data-production-auth','true');
}

async function loadReleaseIdentity(){
  try{const response=await fetch('./qelly-release.json',{cache:'no-store',headers:{Accept:'application/json'}});if(response.ok)releaseIdentity={...releaseIdentity,...await response.json()};}catch{}
  exposeStatus();
}

function exposeStatus(){
  window.__QELLY_PUBLIC_BETA_STATUS__=Object.freeze({releaseSha:releaseIdentity.releaseSha||'unresolved',workflowRun:releaseIdentity.workflowRun||null,deployedAt:releaseIdentity.deployedAt||null,deploymentStage:releaseIdentity.mode||config.deploymentStage||'unknown',deterministicLocal:true,authentication:Boolean(config.capabilities?.authentication),cloudSync:Boolean(config.capabilities?.cloudSync),protectedWrites:Boolean(config.capabilities?.protectedWrites),liveProviders:Boolean(config.capabilities?.liveProviders),online:navigator.onLine,productSurface:'market-intelligence'});
}

async function registerServiceWorker(){if(!('serviceWorker'in navigator)||location.protocol==='file:')return;try{await navigator.serviceWorker.register('./qelly-service-worker.js',{scope:'./'});}catch(error){console.warn('[Qelly] offline shell registration unavailable',error?.message||error);}}

function install(){
  if(!initialHash||initialHash==='#/'||initialHash==='#')location.hash='#/market';
  document.addEventListener('qelly:session-state',(event)=>applySessionState(event.detail));
  const initialSessionState=window.__QELLY_SESSION_STATE__;
  if(initialSessionState)applySessionState(initialSessionState);else buildProductHeader();
  loadReleaseIdentity();registerServiceWorker();
  window.addEventListener('hashchange',()=>{updateHeaderRoute();setTimeout(enhanceCurrentRoute,0);});
  // Connectivity changes may refresh shell state, but route rendering remains
  // exclusively owned by app.js. Calling the retired beta homepage here raced
  // the canonical market-v6 renderer after reloads and online transitions.
  window.addEventListener('online',buildProductHeader);
  window.addEventListener('offline',buildProductHeader);
  const main=document.getElementById('main');if(main)new MutationObserver(()=>queueMicrotask(enhanceCurrentRoute)).observe(main,{childList:true,subtree:true});
  setTimeout(enhanceCurrentRoute,0);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
