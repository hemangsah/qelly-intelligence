import { installAccessibility, announce, openDialog, closeDialog } from '../packages/accessibility/accessibility.mjs';
import { button, toast, commandDialog, dataStateIndicator, escapeHtml, sourceDisclosure } from '../packages/ui-primitives/primitives.mjs';
import { QellyDataGrid } from '../packages/data-grid/data-grid.mjs';
import { QellyChartShell } from '../packages/charting/chart-shell.mjs';
import { productDomains, routeDefinitions } from './route-registry.mjs';
import { parseHashRoute } from './hash-route-state.mjs';
import { personaFor, personaPreferencePatch } from './persona-profiles.mjs';
import { renderShellFoundations } from './shell-foundations.mjs';
const lazyRoute=(path,exportName)=>async(...args)=>{
  const module=await import(path);
  const renderer=module[exportName];
  if(typeof renderer!=='function')throw new TypeError(`Route renderer ${exportName} is unavailable`);
  return renderer(...args);
};

const renderAssetIntelligence=lazyRoute('./routes/asset-intelligence.mjs','renderAssetIntelligence');
const renderAdvancedChart=lazyRoute('./routes/advanced-chart.mjs','renderAdvancedChart');
const renderFundamentalsEstimates=lazyRoute('./routes/fundamentals-estimates.mjs','renderFundamentalsEstimates');
const renderFilingWorkspace=lazyRoute('./routes/filing-workspace.mjs','renderFilingWorkspace');
const renderEventCalendar=lazyRoute('./routes/event-calendar.mjs','renderEventCalendar');
const renderComparisonLab=lazyRoute('./routes/comparison-lab.mjs','renderComparisonLab');
const renderWorkspaceWatchlist=lazyRoute('./routes/workspace-watchlist.mjs','renderWorkspaceWatchlist');
const renderAlertCenter=lazyRoute('./routes/alert-center.mjs','renderAlertCenter');
const renderNotificationCenter=lazyRoute('./routes/notification-center.mjs','renderNotificationCenter');
const renderScreenerLab=lazyRoute('./routes/screener-lab.mjs','renderScreenerLab');
const renderPortfolioAnalytics=lazyRoute('./routes/portfolio-analytics.mjs','renderPortfolioAnalytics');
const renderResearchWorkspace=lazyRoute('./routes/research-workspace.mjs','renderResearchWorkspace');
const renderOnboarding=lazyRoute('./routes/onboarding.mjs','renderOnboarding');
const renderNotificationSchedules=lazyRoute('./routes/notification-schedules.mjs','renderNotificationSchedules');
const renderFormulaScreener=lazyRoute('./routes/formula-screener.mjs','renderFormulaScreener');
const renderPortfolioAttribution=lazyRoute('./routes/portfolio-attribution.mjs','renderPortfolioAttribution');
const renderImportCenter=lazyRoute('./routes/import-center.mjs','renderImportCenter');
const renderResearchHistory=lazyRoute('./routes/research-history.mjs','renderResearchHistory');
const renderMigrationCenter=lazyRoute('./routes/migration-center.mjs','renderMigrationCenter');
const renderLiveMarkets=lazyRoute('./routes/live-markets.mjs','renderLiveMarkets');
const renderMarketV6=lazyRoute('./routes/market-v6.mjs','renderMarketV6');
const renderThemePersonas=lazyRoute('./routes/theme-personas.mjs','renderThemePersonas');
const renderAboutQelly=lazyRoute('./routes/about-qelly.mjs','renderAboutQelly');
const renderFeatureUniverse=lazyRoute('./routes/feature-universe.mjs','renderFeatureUniverse');
const renderIntelligenceTerminal=lazyRoute('./routes/intelligence-terminal.mjs','renderIntelligenceTerminal');
const renderAuthLogin=lazyRoute('./routes/auth-login.mjs','renderAuthLogin');
const renderAuthRegister=lazyRoute('./routes/auth-register.mjs','renderAuthRegister');
const renderAuthRecovery=lazyRoute('./routes/auth-recovery.mjs','renderAuthRecovery');
const renderAccountSession=lazyRoute('./routes/account-session.mjs','renderAccountSession');
const renderSecuritySetup=lazyRoute('./routes/security-setup.mjs','renderSecuritySetup');
const renderSecureImportVault=lazyRoute('./routes/secure-import-vault.mjs','renderSecureImportVault');
const renderPasskeyCenter=lazyRoute('./routes/passkey-center.mjs','renderPasskeyCenter');
const renderAccountRecovery=lazyRoute('./routes/account-recovery.mjs','renderAccountRecovery');
const renderDeliveryOperations=lazyRoute('./routes/delivery-operations.mjs','renderDeliveryOperations');
const renderPlatformReadiness=lazyRoute('./routes/platform-readiness.mjs','renderPlatformReadiness');
const renderSecretRotation=lazyRoute('./routes/secret-rotation.mjs','renderSecretRotation');
const renderQuarantineReview=lazyRoute('./routes/quarantine-review.mjs','renderQuarantineReview');
const renderStagingAssurance=lazyRoute('./routes/staging-assurance.mjs','renderStagingAssurance');
const renderDecisionProvenance=lazyRoute('./routes/decision-provenance.mjs','renderDecisionProvenance');
const renderQellyChatWorkspace=lazyRoute('./routes/qelly-chat-workspace.mjs','renderQellyChatWorkspace');
const renderCalculatorCenter=lazyRoute('./routes/calculator-center.mjs','renderCalculatorCenter');
const renderIndiaFinanceCenter=lazyRoute('./routes/india-finance-center.mjs','renderIndiaFinanceCenter');
const renderIndicatorLibrary=lazyRoute('./routes/indicator-library.mjs','renderIndicatorLibrary');
const renderFormulaLibrary=lazyRoute('./routes/formula-library.mjs','renderFormulaLibrary');
const renderSavedCalculations=lazyRoute('./routes/saved-calculations.mjs','renderSavedCalculations');
const renderFormulaDetail=lazyRoute('./routes/formula-detail.mjs','renderFormulaDetail');
const renderIndicatorDetail=lazyRoute('./routes/indicator-detail.mjs','renderIndicatorDetail');
const renderCalculatorDetail=lazyRoute('./routes/calculator-detail.mjs','renderCalculatorDetail');
const renderSavedCalculationDetail=lazyRoute('./routes/saved-calculation-detail.mjs','renderSavedCalculationDetail');
const renderAssetRankingsRescue=lazyRoute('./routes/asset-rankings.mjs','renderAssetRankings');
const renderUniversalSearch=lazyRoute('./routes/universal-search.mjs','renderUniversalSearch');
const renderCategoriesWorkspace=lazyRoute('./routes/categories.mjs','renderCategories');
const renderVenuesWorkspace=lazyRoute('./routes/venues.mjs','renderVenues');
const renderDexWorkspace=lazyRoute('./routes/dex-discovery.mjs','renderDexDiscovery');
const renderGlobalChartsWorkspace=lazyRoute('./routes/global-charts.mjs','renderGlobalChartsWorkspace');
const renderConverterWorkspace=lazyRoute('./routes/converter.mjs','renderConverterWorkspace');

const runtimeConfig=Object.freeze({...window.__QELLY_CONFIG__});
const staticVisualPreview=runtimeConfig.staticVisualPreview===true;
const staticPreviewApi=staticVisualPreview?await import('./static-preview-api.mjs'):null;
const staticPreviewRoutes=new Set(['market','asset-rankings','asset','decision-provenance','feature-universe','about-qelly','theme-personas','auth-login','auth-register','auth-recovery','calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail','news-research']);
const apiBaseUrl=String(runtimeConfig.apiBaseUrl??'').replace(/\/$/,'');
const apiUrl=(path)=>apiBaseUrl?new URL(path,`${apiBaseUrl}/`).toString():path;

const state = {
  route: 'market',
  asset: 'BTC',
  previewState: staticVisualPreview ? 'simulated' : 'default',
  prefs: null,
  config: null,
  overview: null,
  tokens: null,
  railCollapsed: false,
  contextOpen: false,
  identity: null,
  streamSource: null,
  streamFrames: [],
  authenticated: false,
  activeDomain: 'markets',
  routeQuery: new URLSearchParams()
};

let routeRenderRequest=0;
let routeRenderTail=Promise.resolve();
let activeRouteController=null;
let currentRenderSignal=null;

const defaultPreferences={theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:14,customAccent:null,route:staticVisualPreview?'market':'auth-login',revision:1};
const anonymousOverview=staticVisualPreview
  ? {macro:[
      {label:'BTC',value:'$64,466.72 · +1.84%',state:'simulated'},
      {label:'ETH',value:'$3,412.21 · +0.92%',state:'simulated'},
      {label:'Global OI',value:'$114.65B · +0.54%',state:'simulated'},
      {label:'Liquidations',value:'$180.19M · −47.29%',state:'simulated'},
      {label:'Breadth',value:'62 / 38',state:'simulated'},
      {label:'Preview',value:'Reference observations only',state:'simulated'}
    ]}
  : {macro:[{label:'Identity',value:'Sign in required',state:'cached'},{label:'Database',value:'Production foundation',state:'live'},{label:'Execution',value:'Disabled',state:'unavailable'}]};

const api = async (path, options = {}) => {
  const method = String(options.method ?? 'GET').toUpperCase();
  if(staticVisualPreview)return staticPreviewApi.staticPreviewRequest(path,{...options,method});
  const mutationHeaders = ['GET','HEAD','OPTIONS'].includes(method)||options.skipCsrf ? {} : {'X-Qelly-CSRF': state.config?.csrf?.token ?? ''};
  const {skipCsrf,...fetchOptions}=options;
  const response = await fetch(apiUrl(path), { ...fetchOptions, signal:fetchOptions.signal??currentRenderSignal??undefined, credentials:'include', headers:{'Content-Type':'application/json',...mutationHeaders,...(options.headers ?? {})} });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const caught=new Error(body.error?.message ?? `Request failed (${response.status})`);caught.status=response.status;caught.code=body.error?.code;throw caught;
  }
  return response.json();
};

async function loadAuthenticatedState(){
  [state.prefs,state.overview,state.identity]=await Promise.all([api('/api/v1/preferences/layout'),api('/api/v1/market/overview'),api('/api/v1/session/context')]);
  state.authenticated=true;
}

function publishSessionState(){
  const detail=Object.freeze({authenticated:state.authenticated,identity:state.identity});
  window.__QELLY_SESSION_STATE__=detail;
  document.dispatchEvent(new CustomEvent('qelly:session-state',{detail}));
}

async function reloadApplication(targetRoute='account-session'){
  state.config=await api('/api/v1/config');
  if(state.config.auth?.authenticated)await loadAuthenticatedState();
  else{state.authenticated=false;state.identity=null;state.prefs={...defaultPreferences};state.overview=anonymousOverview;}
  publishSessionState();
  renderIdentityHeader();applyPreferences();renderMacroStrip();renderNavigation();
  const hash=`#/${targetRoute}`;if(location.hash===hash)await renderRoute();else location.hash=hash;
}

async function boot() {
  installAccessibility();
  [state.config,state.tokens]=await Promise.all([api('/api/v1/config'),fetch(new URL('./tokens.json',import.meta.url)).then((r)=>r.json())]);
  if(state.config.auth?.authenticated)await loadAuthenticatedState();
  else{state.authenticated=false;state.prefs={...defaultPreferences};state.overview=anonymousOverview;state.route=state.config.defaultRoute??'auth-login';}
  publishSessionState();
  renderStaticPreviewChrome();renderIdentityHeader();applyPreferences();renderMacroStrip();renderNavigation();bindShell();resolveHash();
  void import('./ai/qelly-chat.mjs').then(({installQellyChat})=>installQellyChat({api,navigate,toast,staticVisualPreview})).catch(()=>{});
}

function renderStaticPreviewChrome(){
  if(!staticVisualPreview)return;
  document.documentElement.dataset.preview='static';
  const truthChip=document.querySelector('.q-truth-chip');
  if(truthChip)truthChip.innerHTML='<span class="q-status q-status--simulated">REFERENCE MODE</span><span>Deterministic reference data · backend unavailable · no live services</span>';
  const providerMini=document.querySelector('.q-provider-mini');
  if(providerMini)providerMini.innerHTML='<span class="q-provider-pulse"></span><div><strong>Reference mode</strong><small>Deterministic data · not live</small></div>';
  const stateSelector=document.getElementById('state-selector');
  if(stateSelector){stateSelector.value='simulated';stateSelector.disabled=true;stateSelector.title='Static preview data is always simulated';}
  const personaLabel=document.querySelector('.q-theme-control span');
  if(personaLabel)personaLabel.textContent='Persona';
}

function renderIdentityHeader() {
  const switcher = document.getElementById('workspace-switcher');
  if (!switcher) return;
  if(staticVisualPreview){switcher.innerHTML='<span>Qelly Intelligence</span><strong>Static visual preview</strong><small>Backend unavailable · anonymous read-only</small>';return;}
  if(!state.identity){switcher.innerHTML='<span></span><strong>Qelly Secure Access</strong><small>Production platform foundation</small>';return;}
  switcher.innerHTML = `<span>${escapeHtml(state.identity.organization.name)}</span><strong>${escapeHtml(state.identity.workspace.name)}</strong><small>${escapeHtml(state.identity.mode)} · ${escapeHtml(state.identity.session.assurance)} assurance</small>`;
}

function applyPreferences() {
  const root = document.documentElement;
  const persona=personaFor(state.prefs.theme);
  root.dataset.theme = state.prefs.theme;
  root.dataset.persona = persona.id;
  root.dataset.density = state.prefs.density;
  root.dataset.motion = state.prefs.motion;
  root.dataset.fontScale = String(state.prefs.fontScale);
  root.dataset.timeframe = persona.defaultTimeframe;
  root.dataset.alertPosture = persona.alertPosture;
  root.dataset.modulePriority = persona.modulePriority.join(',');
  root.style.setProperty('--q-radius', `${state.prefs.radiusPx}px`);
  const selector=document.getElementById('global-theme-selector');
  if(selector)selector.value=state.prefs.theme;
  if (state.prefs.customAccent) root.style.setProperty('--q-accent', state.prefs.customAccent);
  else root.style.removeProperty('--q-accent');
}

async function applyPersona(id,{navigateToDefault=true}={}){
  const persona=personaFor(id);
  const patch={...personaPreferencePatch(id),customAccent:null};
  state.prefs={...state.prefs,...patch};
  applyPreferences();
  renderNavigation();
  if(!staticVisualPreview){
    try{await persistPreference(patch);}
    catch(error){toast(`Operating mode could not be saved: ${error.message}`,{tone:'danger'});}
  }
  toast(`${persona.name} operating mode active`,{tone:'success'});
  if(navigateToDefault){
    const target=staticVisualPreview&&!staticPreviewRoutes.has(persona.defaultRoute)?'market':persona.defaultRoute;
    navigate(target);
  }else if(state.route==='theme-lab'||state.route==='theme-personas'){
    renderRoute();
  }
}

function renderMacroStrip() {
  const strip = document.getElementById('macro-strip');
  const items=(state.overview?.macro??anonymousOverview.macro).map((item) => `<div class="q-macro-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><span class="q-status q-status--${item.state}">${staticVisualPreview?'demo':item.state}</span></div>`).join('');
  strip.innerHTML = `<div class="q-macro-track">${items}${items}</div>`;
}

function renderNavigation() {
  const nav = document.getElementById('primary-nav');
  const visibleRoutes=visibleRouteDefinitions();
  const current=routeDefinitions.find((item)=>item.route===state.route);
  if(current&&visibleRoutes.some((item)=>item.route===current.route))state.activeDomain=current.domain;
  if(!visibleRoutes.some((item)=>item.domain===state.activeDomain))state.activeDomain=visibleRoutes[0]?.domain??'markets';
  const domain=productDomains.find((item)=>item.id===state.activeDomain)??productDomains[0];
  const domainRoutes=visibleRoutes.filter((item)=>item.domain===state.activeDomain);
  if(staticVisualPreview){
    const switcher=document.getElementById('workspace-switcher');
    const title=current?.route==='asset-rankings'?'Global Market Intelligence':current?.label??'Qelly Intelligence';
    if(switcher)switcher.innerHTML=`<span aria-hidden="true">Q</span><strong>${escapeHtml(title)}</strong><small>Static visual preview</small>`;
  }
  let currentSection = '';
  nav.innerHTML = `<div class="q-nav-domain-context"><small>Product domain</small><strong>${escapeHtml(domain.label)}</strong><span>${escapeHtml(domain.destinations.join(' · '))}</span></div>${domainRoutes.map((item) => {
    const section = item.section !== currentSection ? `<div class="q-nav-section">${escapeHtml(item.section)}</div>` : '';
    currentSection = item.section;
    return `${section}<button class="q-nav-link ${state.route === item.route ? 'is-active' : ''}" data-route="${item.route}" aria-current="${state.route === item.route ? 'page' : 'false'}"><span class="q-nav-icon" aria-hidden="true">${item.icon}</span><span>${escapeHtml(item.label)}</span><span class="q-nav-meta">${staticVisualPreview?'STATIC':item.public===true?'PUBLIC':''}</span></button>`;
  }).join('')}`;
  nav.querySelectorAll('[data-route]').forEach((element) => element.addEventListener('click', () => navigate(element.dataset.route)));
  const shell=renderShellFoundations({
    routeDefinitions,
    productDomains,
    visibleRoutes,
    currentRoute:state.route,
    activeDomain:state.activeDomain,
    personaId:state.prefs?.theme??'burgundy-command',
    staticVisualPreview,
    onDomain:(domainId)=>{
      state.activeDomain=domainId;
      const selected=productDomains.find((item)=>item.id===domainId);
      const target=visibleRoutes.find((item)=>item.route===selected?.defaultRoute)??visibleRoutes.find((item)=>item.domain===domainId);
      if(target)navigate(target.route);
    },
    onRoute:navigate,
    onPersona:(id)=>applyPersona(id),
    onCompare:()=>navigate('comparison-lab'),
    onWatchlist:()=>navigateOrExplain('watchlist','Watchlists need the unavailable workspace backend.'),
    onExplain:()=>navigateOrExplain('decision-provenance','Decision Provenance needs the unavailable backend.'),
    onMenu:()=>toggleSecondaryNavigation(),
    onUnavailable:(label)=>toast(`Static visual preview: ${label} needs the unavailable backend.`,{tone:'danger'})
  });
  state.activeDomain=shell.activeDomain;
}

function visibleRouteDefinitions(){
  return routeDefinitions.filter((item)=>!item.hidden && (staticVisualPreview?staticPreviewRoutes.has(item.route):(state.authenticated?!item.anonymousOnly:(item.public===true))));
}

function navigateOrExplain(route,message){
  if(staticVisualPreview&&!staticPreviewRoutes.has(route)){toast(`Static visual preview: ${message}`,{tone:'danger'});return;}
  navigate(route);
}

function toggleSecondaryNavigation(force){
  const rail=document.getElementById('rail');
  if(!rail)return false;
  const open=typeof force==='boolean'?force:!rail.classList.contains('is-open');
  rail.classList.toggle('is-open',open);
  rail.classList.remove('is-mobile-open');
  rail.setAttribute('aria-hidden',String(!open));
  document.getElementById('rail-toggle')?.setAttribute('aria-expanded',String(open));
  document.querySelector('[data-shell-action="menu"]')?.setAttribute('aria-expanded',String(open));
  if(open)rail.querySelector('[data-route]')?.focus();
  return open;
}

function bindShell() {
  const rail = document.getElementById('rail');
  const shell = document.querySelector('.q-shell');
  rail.setAttribute('aria-hidden','true');
  document.getElementById('collapse-rail').addEventListener('click', () => toggleSecondaryNavigation(false));
  document.getElementById('rail-toggle').addEventListener('click', () => toggleSecondaryNavigation());
  document.getElementById('close-context').addEventListener('click', closeContext);
  document.getElementById('theme-shortcut').addEventListener('click', () => {
    if(staticVisualPreview){
      const next=state.prefs.theme==='porcelain-burgundy'?'burgundy-command':'porcelain-burgundy';
      applyPersona(next,{navigateToDefault:false});
    }else navigate('theme-lab');
  });
  document.getElementById('notification-button').addEventListener('click', () => staticVisualPreview?toast('Static visual preview: notifications need the unavailable backend.',{tone:'danger'}):navigate('notification-center'));
  document.getElementById('command-button').addEventListener('click', openCommands);
  document.getElementById('state-selector').addEventListener('change', (event) => {
    state.previewState = event.target.value;
    renderRoute();
  });
  document.getElementById('global-theme-selector')?.addEventListener('change', (event) => applyPersona(event.target.value,{navigateToDefault:false}));
  window.addEventListener('hashchange', resolveHash);
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommands(); }
    if (event.altKey && /^[1-9]$/.test(event.key)) { event.preventDefault(); navigate(routeDefinitions[Number(event.key)-1].route); }
  });
  document.addEventListener('click', (event) => {
    if(rail.classList.contains('is-open')&&!rail.contains(event.target)&&!event.target.closest('#rail-toggle')&&!event.target.closest('[data-shell-action="menu"]'))toggleSecondaryNavigation(false);
  });
  shell.classList.toggle('is-context-open', state.contextOpen);
}

function resolveHash() {
  const {route,asset,query}=parseHashRoute(location.hash,{fallback:state.prefs?.route||'market'});
  const definition=routeDefinitions.find((item)=>item.route===route);
  const allowed=staticVisualPreview
    ? definition&&staticPreviewRoutes.has(route)
    : Boolean(definition);
  const authenticatedAccessRoute=Boolean(state.authenticated&&definition?.anonymousOnly);
  state.route=authenticatedAccessRoute?'account-session':allowed?route:(staticVisualPreview?'market':state.authenticated?'discovery-hub':'feature-universe');
  if(!allowed&&route!==state.route)history.replaceState(null,'',`#/${state.route}`);
  state.activeDomain=(allowed?definition:routeDefinitions.find((item)=>item.route===state.route))?.domain??'markets';
  state.routeQuery=query;
  if (asset) state.asset = asset;
  renderNavigation();
  renderRoute();
}

function navigate(route, asset = null) {
  if(staticVisualPreview&&!staticPreviewRoutes.has(route)){
    toast('Static visual preview: this module needs the unavailable backend.',{tone:'danger'});
    route='market';
    asset=null;
  }
  state.route = route;
  state.routeQuery = new URLSearchParams();
  toggleSecondaryNavigation(false);
  if (asset) state.asset = asset;
  const hash = `#/${route}${asset ? `/${asset}` : ''}`;
  if (location.hash === hash) renderRoute(); else location.hash = hash;
  if(state.authenticated)persistPreference({ route }).catch(() => {});
}

function renderRoute(){
  const request=++routeRenderRequest;
  activeRouteController?.abort();
  window.__qellyLiveMarketCleanup?.();
  window.__qellyLiveMarketCleanup=null;
  window.__qellyMarketV6Cleanup?.();
  window.__qellyMarketV6Cleanup=null;
  const controller=new AbortController();
  activeRouteController=controller;
  const main=document.getElementById('main');
  const definition=routeDefinitions.find((item)=>item.route===state.route);
  if(main){
    main.dataset.pageKind=definition?.kind??'analytical';
    main.setAttribute('aria-busy','true');
    main.innerHTML=loadingPage(definition?.label??'Loading route');
  }
  if(!/^#\/theme-lab(?:\/|$)/.test(location.hash))document.title=`${definition?.label??'Qelly Intelligence'} · Qelly Intelligence`;
  routeRenderTail=routeRenderTail.catch(()=>undefined).then(()=>request===routeRenderRequest?performRouteRender(request,controller):undefined);
  return routeRenderTail;
}

async function performRouteRender(request,controller) {
  currentRenderSignal=controller.signal;
  window.__qellyLiveMarketCleanup?.();
  window.__qellyLiveMarketCleanup=null;
  window.__qellyMarketV6Cleanup?.();
  window.__qellyMarketV6Cleanup=null;
  if (state.streamSource) { state.streamSource.close(); state.streamSource = null; }
  const main = document.getElementById('main');
  const route=state.route;
  const definition=routeDefinitions.find((item)=>item.route===route);
  main.dataset.pageKind=definition?.kind??'analytical';
  main.setAttribute('aria-busy', 'true');
  renderNavigation();
  try {
    if(!staticVisualPreview&&!state.authenticated&&definition&&definition.public!==true&&!definition.anonymousOnly){
      sessionStorage.setItem('qelly.returnTo',state.route);
      main.innerHTML=protectedRouteGate(definition);
      return;
    }
    if (state.previewState === 'loading') { main.innerHTML = loadingPage(); return; }
    if (state.previewState === 'empty') { main.innerHTML = emptyPage(); main.querySelector('[data-reset-state]')?.addEventListener('click', () => { state.previewState='default'; document.getElementById('state-selector').value='default'; renderRoute(); }); return; }
    if (state.previewState === 'error') { main.innerHTML = errorPage('A provider contract failed validation.', 'Retry the deterministic fixture or inspect the contract evidence.'); bindRetry(); return; }
    if (state.previewState === 'offline') { main.innerHTML = errorPage('Workspace is offline.', 'Cached data remains visible only where the contract permits a safe last-known-good value.', 'offline'); bindRetry(); return; }
    switch (route) {
      case 'auth-login': await renderAuthLogin(main,{api,escapeHtml,toast,navigate,onAuthenticated:reloadApplication,state}); break;
      case 'auth-register': await renderAuthRegister(main,{api,toast,navigate,onAuthenticated:reloadApplication}); break;
      case 'auth-recovery': await renderAuthRecovery(main,{api,toast,navigate}); break;
      case 'security-setup': await renderSecuritySetup(main,{api,pageHead,toast,escapeHtml}); break;
      case 'passkey-center': await renderPasskeyCenter(main,{api,pageHead,toast,escapeHtml,renderRoute}); break;
      case 'account-recovery': await renderAccountRecovery(main,{api,pageHead,toast,escapeHtml,renderRoute}); break;
      case 'secure-import-vault': await renderSecureImportVault(main,{api,pageHead,toast,escapeHtml}); break;
      case 'delivery-operations': await renderDeliveryOperations(main,{api,pageHead,toast,escapeHtml,renderRoute}); break;
      case 'platform-readiness': await renderPlatformReadiness(main,{api,pageHead,escapeHtml}); break;
      case 'secret-rotation': await renderSecretRotation(main,{api,pageHead,escapeHtml,toast,renderRoute}); break;
      case 'quarantine-review': await renderQuarantineReview(main,{api,pageHead,escapeHtml,toast,renderRoute}); break;
      case 'staging-assurance': await renderStagingAssurance(main,{api,pageHead,escapeHtml,toast,renderRoute}); break;
      case 'account-session': await renderAccountSession(main,{api,pageHead,escapeHtml,toast,onLoggedOut:()=>reloadApplication('auth-login'),onAuthenticated:reloadApplication}); break;
      case 'live-markets': await renderLiveMarkets(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'calculator-center': await renderCalculatorCenter(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'india-finance': await renderIndiaFinanceCenter(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'indicator-library': await renderIndicatorLibrary(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'formula-library': await renderFormulaLibrary(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'saved-calculations': await renderSavedCalculations(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'formula-detail': await renderFormulaDetail(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset}); break;
      case 'indicator-detail': await renderIndicatorDetail(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset}); break;
      case 'calculator-detail': await renderCalculatorDetail(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset,query:state.routeQuery}); break;
      case 'saved-calculation-detail': await renderSavedCalculationDetail(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,id:state.asset,query:state.routeQuery}); break;
      case 'theme-personas': await renderThemePersonas(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute,applyPersona}); break;
      case 'about-qelly': await renderAboutQelly(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'feature-universe': await renderFeatureUniverse(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,state,renderRoute}); break;
      case 'asset-intelligence': await renderAssetIntelligence(main,{api,pageHead,stateBanner,escapeHtml,QellyChartShell,QellyDataGrid,formatCompact,toast,navigate,asset:state.asset,openEvidence}); break;
      case 'advanced-chart': await renderAdvancedChart(main,{api,pageHead,stateBanner,escapeHtml,QellyChartShell,QellyDataGrid,formatCompact,toast,navigate,asset:state.asset,openEvidence,renderRoute}); break;
      case 'fundamentals-estimates': await renderFundamentalsEstimates(main,{api,pageHead,stateBanner,escapeHtml,QellyChartShell,QellyDataGrid,formatCompact,toast,navigate,asset:state.asset,openEvidence,renderRoute}); break;
      case 'filing-workspace': await renderFilingWorkspace(main,{api,pageHead,stateBanner,escapeHtml,QellyChartShell,QellyDataGrid,formatCompact,toast,navigate,asset:state.asset,openEvidence,renderRoute}); break;
      case 'event-calendar': await renderEventCalendar(main,{api,pageHead,stateBanner,escapeHtml,QellyChartShell,QellyDataGrid,formatCompact,toast,navigate,asset:state.asset,openEvidence,renderRoute}); break;
      case 'comparison-lab': await renderComparisonLab(main,{api,pageHead,stateBanner,escapeHtml,QellyChartShell,QellyDataGrid,formatCompact,toast,navigate,asset:state.asset,openEvidence,renderRoute}); break;
      case 'discovery-hub': await renderDiscoveryHub(main); break;
      case 'asset-rankings': await renderRankings(main); break;
      case 'categories': await renderCategoriesWorkspace(main,{api,escapeHtml,toast}); break;
      case 'category-detail': await renderCategoryDetail(main); break;
      case 'venues': await renderVenuesWorkspace(main,{api,escapeHtml,toast}); break;
      case 'venue-detail': await renderVenueDetail(main); break;
      case 'dex-discovery': await renderDexWorkspace(main,{api,escapeHtml,toast}); break;
      case 'global-charts': await renderGlobalChartsWorkspace(main,{api,escapeHtml,toast}); break;
      case 'converter': await renderConverterWorkspace(main,{api,escapeHtml,toast}); break;
      case 'news-research': await renderQellyChatWorkspace(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate}); break;
      case 'research-article': await renderResearchArticle(main); break;
      case 'trust-center': await renderTrustCenter(main); break;
      case 'market': await renderMarketV6(main,{api,pageHead,stateBanner,escapeHtml}); break;
      case 'rankings': await renderLegacyRankings(main); break;
      case 'search': await renderUniversalSearch(main,{api,escapeHtml,toast,navigate,state}); break;
      case 'asset': await renderAsset(main); break;
      case 'watchlist': await renderWorkspaceWatchlist(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,toast,navigate,renderRoute}); break;
      case 'alert-center': await renderAlertCenter(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,toast,navigate,renderRoute}); break;
      case 'notification-center': await renderNotificationCenter(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,renderRoute}); break;
      case 'screener-lab': await renderScreenerLab(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,toast,navigate,renderRoute}); break;
      case 'portfolio-analytics': await renderPortfolioAnalytics(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,QellyChartShell,formatCompact,navigate}); break;
      case 'research-workspace': await renderResearchWorkspace(main,{api,pageHead,stateBanner,escapeHtml,toast,navigate,renderRoute}); break;
      case 'onboarding': await renderOnboarding(main,{api,pageHead,stateBanner,escapeHtml,toast,renderRoute}); break;
      case 'notification-schedules': await renderNotificationSchedules(main,{api,pageHead,stateBanner,escapeHtml,toast,renderRoute}); break;
      case 'formula-screener': await renderFormulaScreener(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,toast}); break;
      case 'portfolio-attribution': await renderPortfolioAttribution(main,{api,pageHead,stateBanner,escapeHtml,QellyDataGrid,QellyChartShell}); break;
      case 'import-center': await renderImportCenter(main,{api,pageHead,stateBanner,escapeHtml,toast,renderRoute}); break;
      case 'research-history': await renderResearchHistory(main,{api,pageHead,stateBanner,escapeHtml,toast,renderRoute}); break;
      case 'migration-center': await renderMigrationCenter(main,{api,pageHead,stateBanner,escapeHtml}); break;
      case 'theme-lab': await renderThemeLab(main); break;
      case 'identity-access': await renderIdentityAccess(main); break;
      case 'data-mesh': await renderDataMesh(main); break;
      case 'instrument-master': await renderInstrumentMaster(main); break;
      case 'timeseries-lab': await renderTimeSeriesLab(main); break;
      case 'stream-operations': await renderStreamOperations(main); break;
      case 'observability': await renderObservability(main); break;
      case 'decision-provenance': await renderDecisionProvenance(main,{api,pageHead,stateBanner,escapeHtml,toast,renderRoute,navigate}); break;
      case 'security-evidence': await renderSecurityEvidence(main); break;
      default: await renderMarket(main);
    }
  } catch (error) {
    if(error?.name==='AbortError'||request!==routeRenderRequest)return;
    main.innerHTML = isCapabilityBoundaryError(error)
      ? capabilityBoundaryPage(definition,error)
      : errorPage('Unable to render this route.', error.message);
    bindRetry();
  } finally {
    if(currentRenderSignal===controller.signal)currentRenderSignal=null;
    if(request!==routeRenderRequest){
      const currentDefinition=routeDefinitions.find((item)=>item.route===state.route);
      main.dataset.pageKind=currentDefinition?.kind??'analytical';
      main.setAttribute('aria-busy','true');
      main.innerHTML=loadingPage(currentDefinition?.label??'Loading route');
      if(!/^#\/theme-lab(?:\/|$)/.test(location.hash))document.title=`${currentDefinition?.label??'Qelly Intelligence'} · Qelly Intelligence`;
      return;
    }
    if(activeRouteController===controller)activeRouteController=null;
    main.setAttribute('aria-busy', 'false');
    main.focus({ preventScroll:true });
    if(!/^#\/theme-lab(?:\/|$)/.test(location.hash))document.title = `${definition?.label ?? 'Qelly Intelligence'} · Qelly Intelligence`;
  }
}

function pageHead(eyebrow, title, description, actions = '') {
  return `<div class="q-page-head"><div><p class="q-eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="q-page-actions">${actions}</div></div>`;
}

function protectedRouteGate(definition){
  const domain=productDomains.find((item)=>item.id===definition.domain)?.label??'Qelly';
  return `<section class="q-page q-access-gate" data-qelly-destination="${escapeHtml(definition.route)}"><div class="q-access-gate__icon" aria-hidden="true">↗</div><p class="q-eyebrow">${escapeHtml(domain)} · private workspace</p><h1>${escapeHtml(definition.label)}</h1><p>This feature is available and its destination has been preserved. Sign in to open your private, workspace-scoped data; public tools remain available without an account.</p><div class="q-access-gate__actions"><a class="q-button q-button--primary" href="#/auth-login">Sign in</a><a class="q-button q-button--secondary" href="#/auth-register">Create account</a><a class="q-button q-button--ghost" href="#/feature-universe">Browse all features</a></div><div class="q-truth-callout is-compact"><span class="q-status q-status--cached">VISIBLE</span><p>The feature is not missing. Its data is protected by Supabase authentication and row-level workspace isolation.</p></div></section>`;
}

function isCapabilityBoundaryError(error){
  const status=Number(error?.status||0);
  const code=String(error?.code||'');
  return [404,501,503].includes(status)||/(capability_unavailable|route_not_found|owner_mismatch|runtime_unavailable)/i.test(code);
}

function capabilityBoundaryPage(definition,error){
  const label=definition?.label??'This workspace';
  const domain=productDomains.find((item)=>item.id===definition?.domain)?.label??'Qelly workspace';
  const reason=String(error?.message||'The connected production data contract is not available.');
  const code=String(error?.code||`http_${Number(error?.status||0)||'unavailable'}`);
  return `<section class="q-page q-capability-boundary" data-capability-boundary="${escapeHtml(definition?.route??'unavailable')}">
    ${pageHead(`${domain} · availability`,label,`${label} is not connected to a production data source yet. Your account and the rest of Qelly remain available.`)}
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">This feature</div><div class="q-kpi-value q-kpi-value--text">Coming later</div><div class="q-kpi-meta"><span>no placeholder data shown</span><span class="q-status q-status--warning">NOT CONNECTED</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Your account</div><div class="q-kpi-value q-kpi-value--text">Signed in</div><div class="q-kpi-meta"><span>session remains active</span><span class="q-status q-status--live">AVAILABLE</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Displayed data</div><div class="q-kpi-value">None</div><div class="q-kpi-meta"><span>Qelly never invents missing values</span><span class="q-status q-status--cached">TRUTHFUL</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Other tools</div><div class="q-kpi-value q-kpi-value--text">Available</div><div class="q-kpi-meta"><span>continue without interruption</span><span class="q-status q-status--live">READY</span></div></article>
    </div>
    <div class="q-two-column q-capability-boundary__grid">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Continue in Qelly</h2><p>Your signed-in workspace is safe and the rest of the product remains available.</p></div><span class="q-status q-status--live">ACCOUNT ACTIVE</span></div><div class="q-panel-body"><ul class="q-capability-boundary__list"><li>Open another connected market or research workspace.</li><li>Use deterministic calculators without provider data.</li><li>Return later without reconfiguring this feature.</li></ul></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Why this page is empty</h2><p>The required data source is not available, so Qelly does not show invented or stale placeholder values.</p></div><span class="q-status q-status--warning">DATA UNAVAILABLE</span></div><div class="q-panel-body"><p>Try again later or continue to another workspace. Support can use the diagnostic below if this feature should already be active.</p><details><summary>Diagnostic details</summary><code>${escapeHtml(code)} · ${escapeHtml(reason)}</code></details></div></section>
    </div>
    <div class="q-page-actions"><button class="q-button q-button--primary" type="button" data-retry>Retry connection</button><a class="q-button q-button--secondary" href="#/feature-universe">Browse all features</a><a class="q-button q-button--ghost" href="#/platform-readiness">Platform readiness</a></div>
  </section>`;
}

function stateBanner() {
  if(staticVisualPreview)return `<div class="q-state-banner is-simulated">${dataStateIndicator({state:'demo',label:'Reference mode',detail:'Deterministic reference data; not live.'})}<p>Values are deterministic reference data. The backend, persistence, providers, authentication and live services are unavailable.</p></div>`;
  if (state.previewState === 'default') return '';
  const copy = {
    partial:'Some modules are unavailable. Existing values retain their exact freshness and source states.',
    stale:'Last-known-good values are retained with a stale warning. No missing value is converted to zero.',
    delayed:'This preview forces a visible delayed-data boundary across the route.',
    simulated:'Every displayed market value is explicitly marked simulated.'
  }[state.previewState];
  if (!copy) return '';
  return `<div class="q-state-banner ${state.previewState === 'simulated' ? 'is-simulated' : ''}">${dataStateIndicator({state:state.previewState==='partial'?'unavailable':state.previewState,label:state.previewState})}<p>${escapeHtml(copy)}</p></div>`;
}

function effectiveFreshness(original) {
  if(staticVisualPreview)return 'simulated';
  if (['stale','delayed','simulated'].includes(state.previewState)) return state.previewState;
  return original;
}

function publicMarketRows(items=[]) {
  return items.map((item)=>({
    id:item.canonicalId,
    canonicalId:item.canonicalId,
    symbol:item.symbol,
    name:item.name,
    assetClass:item.assetClass,
    category:item.category,
    currency:item.currency,
    price:item.price,
    change24h:item.change24h,
    quoteVolume24h:item.quoteVolume24h,
    volume24h:item.volume24h,
    provider:item.source?.providerName??item.source?.provider??'Unavailable',
    observedLabel:item.source?.observationTime??item.source?.observedAt??'Unavailable',
    freshnessClass:item.source?.freshness??'unavailable',
    qualityState:item.source?.qualityState??'unavailable'
  }));
}

function marketColumns() {
  return [
    {key:'symbol',label:'Asset',width:190,render:(row)=>`<span class="q-source-cell"><strong>${escapeHtml(row.symbol)}</strong><small>${escapeHtml(row.name)}</small></span>`},
    {key:'price',label:'Price',width:130,numeric:true,format:'currency'},
    {key:'change24h',label:'24h',width:95,numeric:true,format:'change'},
    {key:'quoteVolume24h',label:'Quote volume',width:145,numeric:true,render:(row)=>row.quoteVolume24h==null?'<span class="q-unavailable">N/A</span>':`<span class="q-number">${escapeHtml(formatCompact(row.quoteVolume24h))}</span>`},
    {key:'category',label:'Category',width:190},
    {key:'provider',label:'Source',width:220,format:'source'},
    {key:'freshnessClass',label:'Freshness',width:125,format:'status'}
  ];
}

function applyRowState(rows=[]) {
  return rows.map((row)=>{
    const freshnessClass=effectiveFreshness(row.freshnessClass);
    return {...row,freshnessClass,qualityState:staticVisualPreview?'simulated-demo':freshnessClass===row.freshnessClass?row.qualityState:freshnessClass};
  });
}

async function renderMarket(main) {
  const [data,candles] = await Promise.all([
    api('/api/v1/public/markets/overview'),
    api('/api/v1/public/markets/assets/QI-CRYPTO-BTC/candles?interval=1h&limit=168')
  ]);
  // The governed public market endpoint intentionally returns a compact
  // unavailable envelope in restricted runtimes (kpis as an object, no
  // providerStatus/breadth/source fields). Normalize both the rich and
  // degraded contracts before rendering so an honest empty state never
  // becomes a JavaScript crash.
  const items=Array.isArray(data.items)?data.items:[];
  const mode=String(data.mode??'governed-only');
  const truthBoundary=String(data.truthBoundary??data.reason??'Provider observations remain unavailable until the required display rights are verified.');
  const breadth=data.breadth??{
    advancers:items.filter((item)=>Number(item.change24h)>0).length,
    decliners:items.filter((item)=>Number(item.change24h)<0).length
  };
  const providerStatus=data.providerStatus??{
    provider:data.providers?.find?.((provider)=>provider.enabled)?.id??'No authorized provider',
    status:String(data.truthState??'UNAVAILABLE'),
    lastSuccessAt:null,
    cacheEntries:0
  };
  const kpiItems=Array.isArray(data.kpis)?data.kpis:[
    {label:'Authorized market feeds',value:data.kpis?.authorizedInternalCryptoFeeds??0,definition:'Rights-authorized internal crypto feeds',unit:'count'},
    {label:'Approved reference feeds',value:data.kpis?.approvedReferenceFeeds??0,definition:'Attributed official reference feeds',unit:'count'},
    {label:'Tracked assets',value:items.length,definition:'Canonical observations returned by the public runtime',unit:'count'},
    {label:'Execution',value:'Disabled',definition:'Read-only research boundary',unit:'text'}
  ];
  const candleSource=candles.source??{
    attribution:candles.externalDisplay?.provider??'No authorized provider',
    observedAt:null,
    mode:String(candles.mode??mode)
  };
  const rows=publicMarketRows(items);
  const actions = `<button class="q-button q-button--secondary" data-action="inspect-market">Source inspector</button><button class="q-button q-button--secondary" data-action="open-providers">Provider coverage</button><button class="q-button q-button--primary" data-action="open-rankings">Explore assets</button>`;
  const kpis=kpiItems.map((item)=>`<article class="q-kpi"><div class="q-kpi-label">${escapeHtml(item.label)}</div><div class="q-kpi-value">${item.unit==='USD'?formatCompact(item.value):escapeHtml(String(item.value))}</div><div class="q-kpi-meta"><span>${escapeHtml(item.definition)}</span><span class="q-status q-status--${mode==='live-public'?'live':mode==='mixed'?'warning':'simulated'}">${escapeHtml(mode)}</span></div></article>`).join('');
  const heat=items.map((item)=>`<button class="q-heat-cell is-${(item.change24h??0)>=0?'positive':'negative'}" data-public-asset="${escapeAttribute(item.canonicalId??'')}"><strong>${escapeHtml(item.symbol??'—')}</strong><span class="${(item.change24h??0)>=0?'is-positive':'is-negative'}">${(item.change24h??0)>=0?'+':''}${Number(item.change24h??0).toFixed(2)}%</span><small>${escapeHtml(item.source?.qualityState??item.truthState??'unavailable')}</small></button>`).join('');
  main.innerHTML = `<section class="q-page">${pageHead('Public market launch','Market Overview','Read-only public exchange observations with canonical identifiers, explicit source evidence, freshness, cache state and deterministic degraded fallback.',actions)}${stateBanner()}<div class="q-truth-callout"><span class="q-status q-status--${mode==='live-public'?'live':mode==='mixed'?'warning':'simulated'}">${escapeHtml(mode)}</span><p>${escapeHtml(truthBoundary)}</p></div><div class="q-kpi-grid">${kpis}</div><div class="q-dashboard-grid"><div id="market-chart"></div><div class="q-dashboard-stack"><section class="q-panel"><div class="q-panel-head"><div><h2>Tracked-asset breadth</h2><p>Direction uses provider-reported 24-hour change</p></div><span class="q-status q-status--${mode==='live-public'?'live':'warning'}">${breadth.advancers} up · ${breadth.decliners} down</span></div><div class="q-panel-body"><div class="q-heatmap">${heat}</div></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Provider condition</h2><p>No fixture value is labelled live</p></div></div><div class="q-panel-body"><div class="q-context-block"><dl><dt>Provider</dt><dd>${escapeHtml(providerStatus.provider)}</dd><dt>Status</dt><dd>${escapeHtml(providerStatus.status)}</dd><dt>Last success</dt><dd>${escapeHtml(providerStatus.lastSuccessAt??'None in this process')}</dd><dt>Cache entries</dt><dd>${providerStatus.cacheEntries}</dd></dl></div></div></section></div></div><section class="q-panel"><div class="q-panel-head"><div><h2>Public asset table</h2><p>Sortable, keyboard-operable and source-labelled</p></div><span class="q-status q-status--${mode==='live-public'?'live':'warning'}">${items.length} assets</span></div><div id="market-grid"></div></section></section>`;
  const series=(Array.isArray(candles.points)?candles.points:[]).map((point)=>({label:new Date(point.time*1000).toLocaleString('en-US',{month:'short',day:'2-digit',hour:'2-digit'}),value:Number(point.close)}));
  new QellyChartShell(document.getElementById('market-chart'), { title:'BTC/USDT public price history', series, metadata:{source:candleSource.attribution,observedAt:candleSource.observedAt,receivedAt:candleSource.observedAt,confidence:candleSource.mode==='live-public'?.96:.72,freshnessClass:candleSource.mode==='live-public'?'live':'simulated'} });
  new QellyDataGrid(document.getElementById('market-grid'), { columns:marketColumns(), rows:applyRowState(rows), caption:'Public cryptocurrency market observations', density:state.prefs.density, onSelectionChange:(selected)=>announce(`${selected.length} instruments selected`) });
  main.querySelector('[data-action="inspect-market"]').addEventListener('click', () => openContext({ title:'Public market evidence', source:providerStatus.provider, freshness:mode==='live-public'?'live':mode==='mixed'?'partial':'simulated', observedAt:data.generatedAt, receivedAt:data.generatedAt, confidence:mode==='live-public'?.96:.72, entitlement:'public-read', flags:[truthBoundary,'Read-only public endpoints','No trading or account endpoints'] }));
  main.querySelector('[data-action="open-providers"]').addEventListener('click',async()=>openJsonDialog('Public provider coverage',await api('/api/v1/public/providers'),'Public, read-only and fallback-aware'));
  main.querySelector('[data-action="open-rankings"]').addEventListener('click', () => navigate('asset-rankings'));
  main.querySelectorAll('[data-public-asset]').forEach((button)=>button.addEventListener('click',()=>navigate('asset',button.dataset.publicAsset)));
}

async function renderRankings(main){
  return renderAssetRankingsRescue(main,{api,escapeHtml,navigate,toast,staticVisualPreview});
}

async function renderLegacyRankings(main) {
  const data = await api('/api/v1/public/markets/assets?sort=change&direction=desc');
  const baseRows=publicMarketRows(data.items);
  main.innerHTML = `<section class="q-page">${pageHead('Public discovery','Asset Rankings','Search, sort and compare canonical public-market observations without hiding degraded or simulated states.',`<button class="q-button q-button--secondary" data-action="reset-filters">Reset</button><button class="q-button q-button--primary" data-action="export">Export evidence</button>`)}${stateBanner()}<div class="q-truth-callout"><span class="q-status q-status--${data.mode==='live-public'?'live':data.mode==='mixed'?'warning':'simulated'}">${escapeHtml(data.mode)}</span><p>${escapeHtml(data.truthBoundary)}</p></div><section class="q-panel"><div class="q-panel-head"><div><h2>Discovery controls</h2><p>Filters operate on canonical observations already returned by the public API</p></div></div><div class="q-panel-body"><div style="display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px"><label class="q-setting" style="padding:0;border:0"><span>Search</span><input id="ranking-query" type="search" placeholder="BTC, payments, Ethereum"></label><label class="q-setting" style="padding:0;border:0"><span>Quality</span><select id="ranking-freshness"><option value="">All states</option><option value="live">Live public</option><option value="stale">Stale public</option><option value="simulated">Simulated fallback</option></select></label><label class="q-setting" style="padding:0;border:0"><span>Direction</span><select id="ranking-change"><option value="all">All</option><option value="positive">Advancers</option><option value="negative">Decliners</option></select></label><label class="q-setting" style="padding:0;border:0"><span>Density</span><select id="ranking-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="terminal">Terminal</option></select></label></div></div></section><section class="q-panel" style="margin-top:var(--q-gap)"><div class="q-panel-head"><div><h2>Canonical public assets</h2><p id="ranking-summary">${data.total} matching instruments</p></div><span id="compare-count" class="q-status q-status--cached">0 selected</span></div><div id="ranking-grid"></div></section></section>`;
  let rows = applyRowState(baseRows);
  const grid = new QellyDataGrid(document.getElementById('ranking-grid'), { columns:marketColumns(), rows, caption:'Public asset rankings', density:state.prefs.density, onSelectionChange:(selected)=>document.getElementById('compare-count').textContent=`${selected.length} selected` });
  const filter = () => {
    const q=document.getElementById('ranking-query').value.toLowerCase();const fresh=document.getElementById('ranking-freshness').value;const direction=document.getElementById('ranking-change').value;
    rows=applyRowState(baseRows).filter((row)=>(!q||`${row.symbol} ${row.name} ${row.category??''}`.toLowerCase().includes(q))&&(!fresh||row.freshnessClass===fresh)&&(direction==='all'||direction==='positive'&&row.change24h>0||direction==='negative'&&row.change24h<0));
    grid.setRows(rows);document.getElementById('ranking-summary').textContent=`${rows.length} matching instruments`;
  };
  ['ranking-query','ranking-freshness','ranking-change'].forEach((id)=>document.getElementById(id).addEventListener(id==='ranking-query'?'input':'change',filter));
  document.getElementById('ranking-density').value=state.prefs.density;document.getElementById('ranking-density').addEventListener('change',(event)=>grid.setDensity(event.target.value));
  main.querySelector('[data-action="reset-filters"]').addEventListener('click',()=>{document.getElementById('ranking-query').value='';document.getElementById('ranking-freshness').value='';document.getElementById('ranking-change').value='all';filter();});
  main.querySelector('[data-action="export"]').addEventListener('click',()=>downloadJson('qelly-public-market-evidence.json',{generatedAt:data.generatedAt,mode:data.mode,truthBoundary:data.truthBoundary,items:data.items}));
}

async function renderAsset(main) {
  const id=state.asset||'QI-CRYPTO-BTC';
  const [data,candles]=await Promise.all([api(`/api/v1/public/markets/assets/${encodeURIComponent(id)}`),api(`/api/v1/public/markets/assets/${encodeURIComponent(id)}/candles?interval=1h&limit=168`)]);
  const freshness=data.source.freshness;const price=data.price==null?'N/A':new Intl.NumberFormat('en-US',{style:'currency',currency:data.currency,maximumFractionDigits:data.price>100?2:6}).format(data.price);
  const stats=[['24h quote volume',data.quoteVolume24h,'USD'],['24h high',data.high24h,data.currency],['24h low',data.low24h,data.currency],['Market cap',data.marketCap,null]];
  main.innerHTML=`<section class="q-page">${stateBanner()}<div class="q-asset-hero"><div class="q-asset-identity"><span class="q-asset-icon">${escapeHtml(data.symbol.slice(0,2))}</span><div><p class="q-eyebrow" style="color:rgba(255,255,255,.72)!important">Canonical public asset</p><h1>${escapeHtml(data.name)} <small style="font-size:12px;opacity:.72">${escapeHtml(data.symbol)}</small></h1><p>${escapeHtml(data.canonicalId)} · ${escapeHtml(data.category)} · read-only</p></div></div><div class="q-asset-price"><span class="q-status q-status--${freshness}">${escapeHtml(data.source.qualityState)}</span><strong>${escapeHtml(price)}</strong><span class="${(data.change24h??0)>=0?'is-positive':'is-negative'}">${(data.change24h??0)>=0?'+':''}${Number(data.change24h??0).toFixed(2)}%</span></div></div><div class="q-asset-tabs" role="tablist"><button class="is-active" role="tab" aria-selected="true">Overview</button><button role="tab" aria-selected="false">Markets</button><button role="tab" aria-selected="false">Evidence</button></div><div class="q-kpi-grid">${stats.map(([label,value,unit])=>`<article class="q-kpi"><div class="q-kpi-label">${escapeHtml(label)}</div><div class="q-kpi-value">${value==null?'N/A':unit==='USD'?formatCompact(value):new Intl.NumberFormat('en-US',{style:'currency',currency:unit,maximumFractionDigits:6}).format(value)}</div><div class="q-kpi-meta"><span>${value==null?escapeHtml(data.definitions.marketCap):'Provider observation'}</span><span class="q-status q-status--${value==null?'unavailable':freshness}">${value==null?'unavailable':freshness}</span></div></article>`).join('')}</div><div class="q-dashboard-grid"><div id="asset-chart"></div><section class="q-panel"><div class="q-panel-head"><div><h2>Source and definitions</h2><p>Every displayed field has a source or explicit unavailability reason</p></div><button class="q-button q-button--ghost" data-action="asset-source">Inspect JSON</button></div><div class="q-panel-body"><div class="q-context-block"><dl><dt>Provider</dt><dd>${escapeHtml(data.source.providerName)}</dd><dt>Observation</dt><dd>${escapeHtml(data.source.observationTime)}</dd><dt>Ingestion</dt><dd>${escapeHtml(data.source.ingestionTime)}</dd><dt>Cache</dt><dd>${escapeHtml(data.source.cacheState)}</dd><dt>Quality</dt><dd>${escapeHtml(data.source.qualityState)}</dd><dt>Entitlement</dt><dd>${escapeHtml(data.source.entitlement)}</dd></dl></div><div class="q-truth-callout is-compact"><span class="q-status q-status--${data.source.degraded?'warning':'live'}">${data.source.degraded?'degraded':'public'}</span><p>${escapeHtml(data.source.fallbackReason??'Documented public market endpoint; no account or trading access.')}</p></div><div class="q-action-row"><button class="q-button q-button--primary" data-action="signin-action">Sign in for watchlists and alerts</button></div></div></section></div></section>`;
  const series=candles.points.map((point)=>({label:new Date(point.time*1000).toLocaleString('en-US',{month:'short',day:'2-digit',hour:'2-digit'}),value:Number(point.close)}));
  new QellyChartShell(document.getElementById('asset-chart'),{title:`${data.symbol}/USDT price history`,series,metadata:{source:candles.source.attribution,observedAt:candles.source.observedAt,receivedAt:candles.source.observedAt,confidence:candles.source.mode==='live-public'?.96:.72,freshnessClass:candles.source.mode==='live-public'?'live':'simulated'},currency:data.currency});
  main.querySelector('[data-action="asset-source"]').addEventListener('click',()=>openJsonDialog(`${data.name} evidence`,data,'Canonical public-market observation'));
  main.querySelector('[data-action="signin-action"]').addEventListener('click',()=>navigate(state.authenticated?'watchlist':'auth-login'));
  main.querySelectorAll('[role="tab"]').forEach((tab)=>tab.addEventListener('click',()=>{main.querySelectorAll('[role="tab"]').forEach((item)=>{item.classList.toggle('is-active',item===tab);item.setAttribute('aria-selected',String(item===tab));});}));
}

async function renderWatchlist(main) {
  const data=await api('/api/v1/watchlist');
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Authenticated shell','Watchlist','Grouped instruments, inline source states, reversible local preferences and an entitlement-aware action boundary.',`<button class="q-button q-button--secondary" data-action="new-group">New group</button><button class="q-button q-button--primary" data-action="add-asset">Add asset</button>`)}${stateBanner()}<div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Tracked instruments</div><div class="q-kpi-value">${data.items.length}</div><div class="q-kpi-meta"><span>${new Set(data.items.map((item)=>item.assetClass)).size} classes</span><span class="q-status q-status--simulated">fixture</span></div></article><article class="q-kpi"><div class="q-kpi-label">Positive breadth</div><div class="q-kpi-value">${Math.round(data.items.filter((item)=>item.change24h>0).length/data.items.length*100)}%</div><div class="q-kpi-meta"><span>Local calculation</span><span class="q-status q-status--simulated">simulated</span></div></article><article class="q-kpi"><div class="q-kpi-label">Stale instruments</div><div class="q-kpi-value">${data.items.filter((item)=>item.freshnessClass==='stale').length}</div><div class="q-kpi-meta"><span>Never hidden</span><span class="q-status q-status--live">clear</span></div></article><article class="q-kpi"><div class="q-kpi-label">Alert rules</div><div class="q-kpi-value">0</div><div class="q-kpi-meta"><span>Workspace service</span><span class="q-status q-status--planned">planned</span></div></article></div><section class="q-panel"><div class="q-panel-head"><div><h2>${escapeHtml(data.name)}</h2><p>Notes and group membership are reversible low-risk actions</p></div><span class="q-status q-status--simulated">local fixture</span></div><div id="watchlist-grid"></div></section></section>`;
  const columns=[...marketColumns().slice(0,5),{key:'group',label:'Group',width:150},{key:'note',label:'Note',width:260,render:(row)=>row.note?escapeHtml(row.note):'<span class="q-unavailable">No note</span>'},{key:'freshnessClass',label:'Freshness',width:120,format:'status'}];
  new QellyDataGrid(document.getElementById('watchlist-grid'),{columns,rows:applyRowState(data.items),caption:'Institutional watchlist',density:state.prefs.density});
  main.querySelector('[data-action="new-group"]').addEventListener('click',()=>toast('Group creation is a reversible preference action; service persistence is deferred',{tone:'neutral'}));
  main.querySelector('[data-action="add-asset"]').addEventListener('click',()=>navigate('search'));
}

async function renderThemeLab(main) {
  const themes=state.tokens.themes;
  const themeProfiles={
    'burgundy-command':{name:'Scalper Velocity',tagline:'Fast-decoding, high-motion command mode',fit:'Intraday scanning · live tape · alerts'},
    'porcelain-burgundy':{name:'Investor Compound',tagline:'Calm, spacious and long-horizon analytical mode',fit:'Fundamentals · portfolios · reports'},
    'burgundy-night':{name:'Aggressive Alpha',tagline:'Low-glare, high-energy opportunity mode',fit:'Momentum · catalysts · volatile markets'},
    'graphite-terminal':{name:'Quant Operator',tagline:'Dense, precise and keyboard-first terminal mode',fit:'Screeners · data grids · operations'},
    'midnight-research':{name:'Research Oracle',tagline:'Deep-focus narrative and evidence mode',fit:'Filings · research · comparisons'},
    'high-contrast':{name:'Signal Access',tagline:'Maximum legibility and reduced-motion clarity',fit:'Accessibility · critical monitoring'}
  };
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Design OS','Persona Theme Laboratory','Six interest-led market personas, one permanently locked burgundy signature, guarded typography, density, motion and semantic color rules.',`<button class="q-button q-button--secondary" data-action="reset-theme">Reset</button><button class="q-button q-button--secondary" data-action="export-theme">Export JSON</button><button class="q-button q-button--primary" data-action="save-theme">Save profile</button>`)}${stateBanner()}<div class="q-theme-layout"><aside class="q-panel"><div class="q-panel-head"><div><h2>Appearance controls</h2><p>Validated before persistence</p></div></div><div class="q-panel-body"><div class="q-theme-grid">${Object.entries(themes).map(([key,value])=>`<button class="q-theme-choice ${state.prefs.theme===key?'is-active':''}" data-theme="${key}" style="--swatch-chrome:${value.chrome};--swatch-canvas:${value.canvas}"><span class="q-theme-preview"></span><strong>${escapeHtml(themeProfiles[key]?.name||key.replaceAll('-',' '))}</strong><small>${escapeHtml(themeProfiles[key]?.tagline||'')}</small></button>`).join('')}</div><div class="q-setting"><label for="custom-accent">Custom accent <span id="accent-status">${state.prefs.customAccent??'preset'}</span></label><input id="custom-accent" type="color" value="${state.prefs.customAccent??themes[state.prefs.theme].accent}"><div id="contrast-result" style="font-size:9px;color:var(--q-muted);margin-top:6px"></div></div><div class="q-setting"><label for="density-select">Density <span>${state.prefs.density}</span></label><select id="density-select"><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="terminal">Terminal</option></select></div><div class="q-setting"><label for="motion-select">Motion <span>${state.prefs.motion}</span></label><select id="motion-select"><option value="full">Full</option><option value="subtle">Subtle</option><option value="reduced">Reduced</option></select></div><div class="q-setting"><label for="font-select">Font scale <span>${state.prefs.fontScale}%</span></label><select id="font-select"><option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="120">120%</option></select></div><div class="q-setting"><label for="radius-range">Radius <span id="radius-value">${state.prefs.radiusPx}px</span></label><input id="radius-range" type="range" min="0" max="20" step="1" value="${state.prefs.radiusPx}"></div><div class="q-setting"><label>Protected semantics <span>locked</span></label><div class="q-semantic-swatches"><div class="q-semantic-swatch is-positive">Positive</div><div class="q-semantic-swatch is-negative">Negative</div><div class="q-semantic-swatch" style="color:var(--q-warning)">Warning</div><div class="q-semantic-swatch" style="color:var(--q-simulated)">Simulated</div></div></div></div></aside><div class="q-theme-stage"><p class="q-eyebrow">Live workspace preview</p><h2 style="margin:4px 0 0">${escapeHtml(themeProfiles[state.prefs.theme]?.name||'Sovereign Burgundy')} analytical surface</h2><div class="q-theme-safety"><span class="q-status q-status--live">guarded</span><span>The burgundy gradient, positive/negative meaning, focus visibility and light/dark text polarity are permanently protected. Persona settings tune density and motion without changing the Qelly identity.</span></div><div class="q-kpi-grid">${state.overview.kpis.map((item)=>kpiCard(item.label,item.value)).join('')}</div><div id="theme-grid-preview" class="q-panel"></div></div></div></section>`;
  const previewRows=applyRowState(state.overview.rows.slice(0,5));
  new QellyDataGrid(document.getElementById('theme-grid-preview'),{columns:marketColumns().slice(0,5),rows:previewRows,caption:'Theme preview market grid',density:state.prefs.density,selectable:false});
  document.getElementById('density-select').value=state.prefs.density;document.getElementById('motion-select').value=state.prefs.motion;document.getElementById('font-select').value=String(state.prefs.fontScale);
  main.querySelectorAll('[data-theme]').forEach((element)=>element.addEventListener('click',()=>{state.prefs.theme=element.dataset.theme;state.prefs.customAccent=null;applyPreferences();renderThemeLab(main);}));
  document.getElementById('custom-accent').addEventListener('input',(event)=>{const accent=event.target.value;const surface=themes[state.prefs.theme].surface;const ratio=contrastRatio(accent,surface);document.getElementById('contrast-result').textContent=`Contrast against surface: ${ratio.toFixed(2)}:1 ${ratio>=4.5?'· passes normal text':'· accent limited to non-text emphasis'}`;document.getElementById('accent-status').textContent=accent;state.prefs.customAccent=accent;applyPreferences();});
  document.getElementById('density-select').addEventListener('change',(event)=>{state.prefs.density=event.target.value;applyPreferences();renderThemeLab(main);});
  document.getElementById('motion-select').addEventListener('change',(event)=>{state.prefs.motion=event.target.value;applyPreferences();});
  document.getElementById('font-select').addEventListener('change',(event)=>{state.prefs.fontScale=Number(event.target.value);applyPreferences();});
  document.getElementById('radius-range').addEventListener('input',(event)=>{state.prefs.radiusPx=Number(event.target.value);document.getElementById('radius-value').textContent=`${state.prefs.radiusPx}px`;applyPreferences();});
  main.querySelector('[data-action="save-theme"]').addEventListener('click',async()=>{await persistPreference(state.prefs);toast('Validated theme and layout profile saved',{tone:'success'});});
  main.querySelector('[data-action="reset-theme"]').addEventListener('click',async()=>{state.prefs={...state.prefs,theme:'burgundy-command',density:'comfortable',motion:'full',fontScale:100,radiusPx:10,customAccent:null};applyPreferences();await persistPreference(state.prefs);renderThemeLab(main);toast('Theme profile reset',{tone:'success'});});
  main.querySelector('[data-action="export-theme"]').addEventListener('click',()=>downloadJson('qelly-theme-profile.json',{version:1,baseTheme:state.prefs.theme,density:state.prefs.density,motion:state.prefs.motion,fontScale:state.prefs.fontScale/100,radiusPx:state.prefs.radiusPx,customAccent:state.prefs.customAccent,protectedSemanticsLocked:true}));
}

async function renderIdentityAccess(main) {
  const [context, workspaces, sessions, devices, consents] = await Promise.all([
    api('/api/v1/session/context'), api('/api/v1/workspaces'), api('/api/v1/sessions'), api('/api/v1/devices'), api('/api/v1/privacy/consents')
  ]);
  state.identity = context;
  renderIdentityHeader();
  const assuranceTone = context.session.assurance === 'high' ? 'live' : context.session.assurance === 'medium' ? 'cached' : 'warning';
  main.innerHTML = `<section class="q-page">${pageHead('Qelly Intelligence · Runnable local foundation','Identity, Tenant and Access Control','Deterministic local sessions exercise tenant-aware RBAC + ABAC, device trust, workspace boundaries, step-up gates, consent records and audit evidence. No production sign-in is performed.',`<button class="q-button q-button--secondary" data-action="evaluate-governance">Evaluate governed action</button><button class="q-button q-button--primary" data-action="step-up">Simulate step-up</button>`)}${stateBanner()}
    <div class="q-truth-callout"><span class="q-status q-status--simulated">local identity fixture</span><p>${escapeHtml(context.authenticationTruth)}</p></div>
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">Session assurance</div><div class="q-kpi-value">${escapeHtml(context.session.assurance.toUpperCase())}</div><div class="q-kpi-meta"><span>${context.session.stepUpExpiresAt ? `Elevated until ${new Date(context.session.stepUpExpiresAt).toLocaleTimeString()}` : 'No active step-up'}</span><span class="q-status q-status--${assuranceTone}">${escapeHtml(context.session.assurance)}</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Effective roles</div><div class="q-kpi-value">${context.membership.roles.length}</div><div class="q-kpi-meta"><span>${escapeHtml(context.membership.roles.slice(0,2).join(', '))}</span><span class="q-status q-status--cached">RBAC</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Workspace access</div><div class="q-kpi-value">${workspaces.items.length}</div><div class="q-kpi-meta"><span>${escapeHtml(context.workspace.name)}</span><span class="q-status q-status--live">tenant scoped</span></div></article>
      <article class="q-kpi"><div class="q-kpi-label">Trusted devices</div><div class="q-kpi-value">${devices.items.filter((item)=>item.trust.includes('trusted')).length}</div><div class="q-kpi-meta"><span>${devices.items.length} local records</span><span class="q-status q-status--simulated">fixture</span></div></article>
    </div>
    <div class="q-control-grid">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Active identity context</h2><p>Server-resolved, deny-by-default context</p></div><span class="q-status q-status--${assuranceTone}">${escapeHtml(context.session.assurance)}</span></div><div class="q-panel-body"><div class="q-context-block"><dl><dt>User</dt><dd>${escapeHtml(context.user.displayName)}</dd><dt>Organization</dt><dd>${escapeHtml(context.organization.name)}</dd><dt>Workspace</dt><dd>${escapeHtml(context.workspace.name)}</dd><dt>Environment</dt><dd>${escapeHtml(context.workspace.environment)}</dd><dt>Device trust</dt><dd>${escapeHtml(context.device.trust)}</dd><dt>Authentication</dt><dd>${escapeHtml(context.session.authenticationMethod)}</dd></dl></div><div class="q-capabilities">${context.membership.roles.map((role)=>`<span class="q-capability">${escapeHtml(role)}</span>`).join('')}</div></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Workspace switch boundary</h2><p>Membership and tenant checks happen server-side</p></div></div><div class="q-panel-body q-stack">${workspaces.items.map((workspace)=>`<button class="q-choice-row ${workspace.workspaceId===context.workspace.workspaceId?'is-current':''}" data-workspace="${escapeAttribute(workspace.workspaceId)}"><span><strong>${escapeHtml(workspace.name)}</strong><small>${escapeHtml(workspace.environment)} · ${escapeHtml(workspace.riskTier)} risk</small></span><span class="q-status q-status--${workspace.workspaceId===context.workspace.workspaceId?'live':'cached'}">${workspace.workspaceId===context.workspace.workspaceId?'current':'switch'}</span></button>`).join('')}</div></section>
    </div>
    <div class="q-dashboard-grid">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Session inventory</h2><p>Revocation requires high assurance and cannot target the active local session</p></div><span class="q-status q-status--cached">${sessions.items.length} sessions</span></div><div class="q-panel-body q-stack">${sessions.items.map((session)=>`<div class="q-record-row"><span><strong>${escapeHtml(session.sessionId)}</strong><small>${escapeHtml(session.authenticationMethod)} · ${escapeHtml(session.assurance)} assurance · ${session.revokedAt?'revoked':'active'}</small></span>${session.current?'<span class="q-status q-status--live">current</span>':session.revokedAt?'<span class="q-status q-status--unavailable">revoked</span>':`<button class="q-button q-button--ghost" data-revoke-session="${escapeAttribute(session.sessionId)}">Revoke</button>`}</div>`).join('')}</div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Consent and privacy records</h2><p>Purpose-specific, versionable local records</p></div><button class="q-button q-button--ghost" data-action="privacy-inventory">Inspect inventory</button></div><div class="q-panel-body q-stack">${consents.items.map((consent)=>`<div class="q-record-row"><span><strong>${escapeHtml(consent.purpose)}</strong><small>${consent.required?'Required local runtime purpose':'Optional purpose'} · updated ${new Date(consent.updatedAt).toLocaleDateString()}</small></span><span class="q-status q-status--${consent.status==='granted'?'live':'unavailable'}">${escapeHtml(consent.status)}</span></div>`).join('')}</div></section>
    </div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Access decision result</h2><p>RBAC, ABAC, session assurance and device trust are evaluated together</p></div><span id="access-decision-status" class="q-status q-status--cached">not evaluated</span></div><div id="access-decision" class="q-panel-body"><p class="q-muted-copy">Evaluate <code>instrument:govern</code> to see the high-assurance gate.</p></div></section>
  </section>`;
  main.querySelector('[data-action="step-up"]').addEventListener('click', async()=>{
    try { state.identity = await api('/api/v1/auth/step-up/simulate',{method:'POST',body:'{}'}); renderIdentityHeader(); toast('Local step-up simulation elevated this fixture session for ten minutes',{tone:'success'}); await renderIdentityAccess(main); }
    catch(error){ toast(error.message,{tone:'danger'}); }
  });
  main.querySelector('[data-action="evaluate-governance"]').addEventListener('click', async()=>{
    const result=await api('/api/v1/access/evaluate',{method:'POST',body:JSON.stringify({action:'instrument:govern',resource:{tenantId:context.organization.organizationId,workspaceId:context.workspace.workspaceId}})});
    const status=document.getElementById('access-decision-status'); status.textContent=result.decision; status.className=`q-status q-status--${result.allowed?'live':'warning'}`;
    document.getElementById('access-decision').innerHTML=`<div class="q-decision ${result.allowed?'is-allow':'is-deny'}"><strong>${result.allowed?'Allowed':'Denied'}</strong><p>${result.reasons.length?escapeHtml(result.reasons.join(', ')):'No denial reasons.'}</p><div class="q-capabilities">${result.obligations.map((item)=>`<span class="q-capability">${escapeHtml(item)}</span>`).join('')}</div><small>Policy ${escapeHtml(result.policyVersion)} · ${new Date(result.evaluatedAt).toLocaleString()}</small></div>`;
  });
  main.querySelectorAll('[data-workspace]').forEach((button)=>button.addEventListener('click',async()=>{
    try { await api(`/api/v1/workspaces/${encodeURIComponent(button.dataset.workspace)}/switch`,{method:'POST',body:'{}'}); state.identity=await api('/api/v1/session/context'); renderIdentityHeader(); toast(`Switched to ${state.identity.workspace.name}`,{tone:'success'}); await renderIdentityAccess(main); }
    catch(error){toast(error.message,{tone:'danger'});}
  }));
  main.querySelectorAll('[data-revoke-session]').forEach((button)=>button.addEventListener('click',async()=>{
    try { await api(`/api/v1/sessions/${encodeURIComponent(button.dataset.revokeSession)}`,{method:'DELETE'}); toast('Secondary local session revoked and audited',{tone:'success'}); await renderIdentityAccess(main); }
    catch(error){toast(`${error.message}. Simulate step-up first.`,{tone:'warning'});}
  }));
  main.querySelector('[data-action="privacy-inventory"]').addEventListener('click',async()=>{
    const inventory=await api('/api/v1/privacy/data-inventory'); openJsonDialog('Privacy data inventory',inventory,'Local fixture data only');
  });
}

async function renderDataMesh(main) {
  const [providerData, incidents, entitlementContract] = await Promise.all([
    api('/api/v1/providers/runtime'), api('/api/v1/data-quality/incidents'), api('/api/v1/contracts/entitlements')
  ]);
  const enabled=providerData.items.filter((item)=>item.status==='enabled');
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Runnable deterministic runtime','Provider Runtime and Data Quality Control','Read-only fixture adapters now exercise capability selection, server-side entitlements, deadlines, retries, circuit breakers, bulkheads, deduplication, quotas, TTL cache, stale fallback, quality scoring and lineage. External providers and credentials remain disabled.',`<button class="q-button q-button--secondary" data-action="test-failover">Exercise failover</button><button class="q-button q-button--secondary" data-action="stream-test">Test stream</button><button class="q-button q-button--primary" data-action="test-quote">Run quote</button>`)}${stateBanner()}
    <div class="q-truth-callout"><span class="q-status q-status--simulated">deterministic adapters</span><p>No external call is made. Credential references are opaque labels; secret material is never returned to the browser.</p></div>
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Registered providers</div><div class="q-kpi-value">${providerData.items.length}</div><div class="q-kpi-meta"><span>Capability registry</span><span class="q-status q-status--cached">runtime</span></div></article><article class="q-kpi"><div class="q-kpi-label">Enabled fixtures</div><div class="q-kpi-value">${enabled.length}</div><div class="q-kpi-meta"><span>Primary, secondary, validation</span><span class="q-status q-status--simulated">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">Quality incidents</div><div class="q-kpi-value">${incidents.items.length}</div><div class="q-kpi-meta"><span>Schema, range, time and outlier gates</span><span class="q-status q-status--${incidents.items.length?'warning':'live'}">${incidents.items.length?'review':'clear'}</span></div></article><article class="q-kpi"><div class="q-kpi-label">Credential values exposed</div><div class="q-kpi-value">0</div><div class="q-kpi-meta"><span>Secret references only</span><span class="q-status q-status--live">locked</span></div></article></div>
    <div class="q-provider-grid">${providerData.items.map(providerCard).join('')}</div>
    <div class="q-dashboard-grid">
      <section class="q-panel"><div class="q-panel-head"><div><h2>Runtime execution evidence</h2><p>Results include provider selection, cache, attempts, latency, quality, entitlement and cost units</p></div><span id="runtime-result-status" class="q-status q-status--cached">ready</span></div><div id="runtime-result" class="q-panel-body"><p class="q-muted-copy">Run a quote or deterministic failover scenario.</p></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Entitlement boundary</h2><p>Deny by default before fetch and downstream use</p></div><button class="q-button q-button--ghost" data-action="entitlement-contract">Inspect contract</button></div><div class="q-panel-body"><div class="q-context-block"><dl><dt>Decision</dt><dd>${escapeHtml(entitlementContract.decision)}</dd><dt>Evaluation</dt><dd>${escapeHtml(entitlementContract.evaluation)}</dd><dt>Dimensions</dt><dd>${entitlementContract.dimensions.length}</dd><dt>Obligations</dt><dd>${entitlementContract.obligations.length}</dd></dl></div><button class="q-button q-button--secondary" data-action="evaluate-export">Evaluate export entitlement</button><div id="entitlement-result" style="margin-top:10px"></div></div></section>
    </div>
  </section>`;
  main.querySelector('[data-action="test-quote"]').addEventListener('click',()=>runProviderQuote(main,false));
  main.querySelector('[data-action="test-failover"]').addEventListener('click',()=>runProviderQuote(main,true));
  main.querySelector('[data-action="stream-test"]').addEventListener('click',testStream);
  main.querySelector('[data-action="entitlement-contract"]').addEventListener('click',()=>openContract('entitlements'));
  main.querySelector('[data-action="evaluate-export"]').addEventListener('click',async()=>{
    const result=await api('/api/v1/entitlements/evaluate',{method:'POST',body:JSON.stringify({providerId:'qelly-fixture-primary',capability:'quote',use:'export',entitlementClass:'development-fixture'})});
    document.getElementById('entitlement-result').innerHTML=`<div class="q-decision ${result.allowed?'is-allow':'is-deny'}"><strong>${escapeHtml(result.decision)}</strong><p>${result.reasons.length?escapeHtml(result.reasons.join(', ')):'Permitted with obligations.'}</p><div class="q-capabilities">${result.obligations.map((item)=>`<span class="q-capability">${escapeHtml(item)}</span>`).join('')}</div></div>`;
  });
}

async function runProviderQuote(main, failover) {
  const status=document.getElementById('runtime-result-status'); const target=document.getElementById('runtime-result'); status.textContent='running'; status.className='q-status q-status--delayed';
  try {
    const path=failover?'/api/v1/providers/execute':'/api/v1/providers/qelly-fixture-primary/execute';
    const result=await api(path,{method:'POST',body:JSON.stringify({capability:'quote',request:{canonicalId:'QI-CRYPTO-BTC'},scenario:failover?'qelly-fixture-primary:error':null})});
    status.textContent=failover?'secondary selected':'success'; status.className='q-status q-status--live';
    target.innerHTML=`<div class="q-runtime-result"><div><span>Value</span><strong>${escapeHtml(result.data.value)} ${escapeHtml(result.data.unit)}</strong></div><div><span>Provider</span><strong>${escapeHtml(result.runtime.providerId)}</strong></div><div><span>Latency</span><strong>${result.runtime.latencyMs} ms</strong></div><div><span>Cache</span><strong>${escapeHtml(result.runtime.cache)}</strong></div><div><span>Quality</span><strong>${Math.round(result.runtime.quality.confidence*100)}%</strong></div><div><span>Entitlement</span><strong>${escapeHtml(result.entitlement.decision)}</strong></div></div><div class="q-lineage-strip"><span>${escapeHtml(result.data.source)}</span><span>${escapeHtml(result.data.freshnessClass)}</span><span>${escapeHtml(result.runtime.correlationId)}</span></div>`;
  } catch(error) { status.textContent='failed'; status.className='q-status q-status--critical'; target.innerHTML=`<p class="is-negative">${escapeHtml(error.message)}</p>`; }
}

function providerCard(item) {
  const tone=item.status==='enabled'?(item.breaker.state==='open'?'critical':'live'):item.status==='disabled'?'unavailable':'planned';
  return `<article class="q-provider-card"><div class="q-provider-card-head"><div><h2>${escapeHtml(item.displayName)}</h2><p>${escapeHtml(item.providerId)}</p></div><span class="q-status q-status--${tone}">${escapeHtml(item.status)}</span></div><div class="q-provider-stats"><div class="q-provider-stat"><span>Role</span><strong>${escapeHtml(item.selectionRole)}</strong></div><div class="q-provider-stat"><span>Quality</span><strong>${item.quality.score}</strong></div><div class="q-provider-stat"><span>Latency</span><strong>${item.quality.latencyMs}ms</strong></div></div><div class="q-capabilities">${item.capabilities.length?item.capabilities.map((capability)=>`<span class="q-capability">${escapeHtml(capability)}</span>`).join(''):'<span class="q-capability">disabled</span>'}</div><footer class="q-source-line" style="margin:0 -15px -15px"><span>Breaker: <strong>${escapeHtml(item.breaker.state)}</strong></span><span>${escapeHtml(item.quality.freshnessClass)}</span></footer></article>`;
}

async function renderInstrumentMaster(main) {
  const [summary, search] = await Promise.all([api('/api/v1/instruments/summary'),api('/api/v1/instruments/search?limit=100')]);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Persistent canonical reference foundation','Instrument Master and Relationship Graph','Atomic local persistence now governs immutable QI-* identity, symbol history, venues, currencies, calendars, precision, identifiers and typed cross-asset relationships. It is not licensed production reference data.',`<button class="q-button q-button--secondary" data-action="resolve-qqqb">Resolve QQQB</button><button class="q-button q-button--primary" data-action="inspect-relationship">Inspect tokenized relationship</button>`)}${stateBanner()}
    <div class="q-truth-callout"><span class="q-status q-status--simulated">local system of record</span><p>${escapeHtml(summary.systemOfRecord)} · revision ${summary.revision} · production reference data: ${summary.productionReferenceData}</p></div>
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Canonical instruments</div><div class="q-kpi-value">${summary.instruments}</div><div class="q-kpi-meta"><span>QI-* immutable identity</span><span class="q-status q-status--cached">revision ${summary.revision}</span></div></article><article class="q-kpi"><div class="q-kpi-label">Asset classes</div><div class="q-kpi-value">${summary.byAssetClass.length}</div><div class="q-kpi-meta"><span>Cross-asset taxonomy</span><span class="q-status q-status--simulated">fixture</span></div></article><article class="q-kpi"><div class="q-kpi-label">Venues</div><div class="q-kpi-value">${summary.venues}</div><div class="q-kpi-meta"><span>MIC or governed Qelly code</span><span class="q-status q-status--cached">reference</span></div></article><article class="q-kpi"><div class="q-kpi-label">Calendars</div><div class="q-kpi-value">${summary.calendars}</div><div class="q-kpi-meta"><span>Timezone explicit</span><span class="q-status q-status--live">validated</span></div></article></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Canonical registry</h2><p>Search by name, symbol, identifier, asset class or jurisdiction</p></div><label class="q-inline-search"><span class="sr-only">Filter instruments</span><input id="instrument-filter" type="search" placeholder="Filter registry" aria-label="Filter instruments"></label></div><div id="instrument-grid"></div></section>
    <div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Resolver evidence</h2><p>Exact canonical IDs, identifiers, current and historical symbols are scored</p></div><span id="resolver-status" class="q-status q-status--cached">ready</span></div><div id="resolver-result" class="q-panel-body"><p class="q-muted-copy">Resolve QQQB to demonstrate a tokenized-security canonical record.</p></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Relationship evidence</h2><p>Outgoing and incoming graph edges preserve type, validity and provenance</p></div><span id="relationship-status" class="q-status q-status--cached">ready</span></div><div id="relationship-result" class="q-panel-body"><p class="q-muted-copy">Inspect the QQQB → QQQ tokenized relationship.</p></div></section></div>
  </section>`;
  const rows=search.items.map((item)=>({canonicalId:item.canonicalId,symbol:item.primarySymbol,name:item.name,assetClass:item.assetClass,status:item.status,currency:item.currency,jurisdiction:item.jurisdiction,sector:item.sector,precision:item.precision,symbolHistory:item.symbols.length,relationships:item.relationships.length}));
  const columns=[{key:'canonicalId',label:'Canonical ID',width:190},{key:'symbol',label:'Symbol',width:90},{key:'name',label:'Name',width:240},{key:'assetClass',label:'Class',width:150},{key:'status',label:'Status',width:100,format:'status'},{key:'currency',label:'Currency',width:90},{key:'jurisdiction',label:'Jurisdiction',width:110},{key:'sector',label:'Sector',width:180},{key:'precision',label:'Precision',width:90,numeric:true},{key:'symbolHistory',label:'Symbols',width:90,numeric:true},{key:'relationships',label:'Relations',width:90,numeric:true}];
  const grid=new QellyDataGrid(document.getElementById('instrument-grid'),{columns,rows,caption:'Canonical Qelly instrument master',density:state.prefs.density,selectable:false});
  document.getElementById('instrument-filter').addEventListener('input',(event)=>{const q=event.target.value.toLowerCase();grid.setRows(rows.filter((row)=>Object.values(row).join(' ').toLowerCase().includes(q)));});
  main.querySelector('[data-action="resolve-qqqb"]').addEventListener('click',async()=>{
    const result=await api('/api/v1/instruments/resolve',{method:'POST',body:JSON.stringify({symbol:'QQQB',assetClass:'tokenized-security'})});
    const status=document.getElementById('resolver-status');status.textContent=result.resolved?'resolved':'review';status.className=`q-status q-status--${result.resolved?'live':'warning'}`;
    document.getElementById('resolver-result').innerHTML=result.candidates.map((candidate)=>`<div class="q-record-row"><span><strong>${escapeHtml(candidate.canonicalId)}</strong><small>${escapeHtml(candidate.name)} · ${escapeHtml(candidate.reasons.join(', '))}</small></span><span class="q-status q-status--${candidate===result.candidates[0]?'live':'cached'}">${Math.round(candidate.confidence*100)}%</span></div>`).join('');
  });
  main.querySelector('[data-action="inspect-relationship"]').addEventListener('click',async()=>{
    const result=await api('/api/v1/instruments/QI-TOKENIZED-QQQB/relationships'); const status=document.getElementById('relationship-status');status.textContent=`${result.total} edge`;status.className='q-status q-status--live';
    document.getElementById('relationship-result').innerHTML=[...result.outgoing,...result.incoming].map((edge)=>`<div class="q-record-row"><span><strong>${escapeHtml(edge.type)}</strong><small>${escapeHtml(edge.direction)} · ${escapeHtml(edge.targetCanonicalId??edge.sourceCanonicalId)} · ${escapeHtml(edge.source?.name??edge.target?.name??'canonical target')}</small></span><span class="q-status q-status--simulated">${escapeHtml(edge.validFrom)}</span></div>`).join('')||'<p>No governed relationship found.</p>';
  });
}


async function renderTimeSeriesLab(main) {
  const instruments = [
    ['QI-CRYPTO-BTC','BTC · Bitcoin'],['QI-CRYPTO-ETH','ETH · Ethereum'],['QI-EQUITY-AAPL','AAPL · Apple'],['QI-EQUITY-NVDA','NVDA · NVIDIA'],
    ['QI-FX-USDINR','USDINR · FX'],['QI-COMMODITY-GOLD','XAUUSD · Gold'],['QI-INDEX-SPX','SPX · S&P 500'],['QI-FUND-QQQ','QQQ · Invesco QQQ']
  ];
  const summary = await api('/api/v1/timeseries/summary');
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Persistent normalized history','Time Series Laboratory','Inspect range-bound, cursor-paginated OHLCV history with decimal-string precision, source lineage, freshness, methodology and explicit local persistence boundaries.',`<button class="q-button q-button--secondary" data-action="timeseries-contract">Data contract</button><button class="q-button q-button--primary" data-action="refresh-series">Refresh series</button>`)}${stateBanner()}
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Canonical series</div><div class="q-kpi-value">${summary.instruments}</div><div class="q-kpi-meta"><span>Persistent instruments</span><span class="q-status q-status--live">ready</span></div></article><article class="q-kpi"><div class="q-kpi-label">Normalized points</div><div class="q-kpi-value">${summary.points.toLocaleString()}</div><div class="q-kpi-meta"><span>Atomic local store</span><span class="q-status q-status--simulated">fixture</span></div></article><article class="q-kpi"><div class="q-kpi-label">Intervals</div><div class="q-kpi-value">${summary.supportedIntervals.length}</div><div class="q-kpi-meta"><span>${summary.supportedIntervals.join(' · ')}</span><span class="q-status q-status--cached">UTC</span></div></article><article class="q-kpi"><div class="q-kpi-label">Production TSDB</div><div class="q-kpi-value">OFF</div><div class="q-kpi-meta"><span>Scale gate remains visible</span><span class="q-status q-status--unavailable">gated</span></div></article></div>
    <section class="q-panel q-timeseries-controls"><div class="q-panel-head"><div><h2>Series query</h2><p>Canonical IDs, explicit interval and safe result limits</p></div><span id="series-query-status" class="q-status q-status--cached">ready</span></div><div class="q-panel-body q-control-row"><label class="q-setting"><span>Instrument</span><select id="series-instrument">${instruments.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label class="q-setting"><span>Interval</span><select id="series-interval"><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="1d">1 day</option></select></label><label class="q-setting"><span>Points</span><select id="series-limit"><option value="72">72</option><option value="120" selected>120</option><option value="240">240</option><option value="500">500</option></select></label><div class="q-setting q-query-boundary"><span>Boundary</span><strong>Decimal strings · UTC · source retained</strong><small>No missing value is fabricated as zero.</small></div></div></section>
    <div class="q-dashboard-grid q-timeseries-layout"><div id="timeseries-chart"></div><section class="q-panel"><div class="q-panel-head"><div><h2>Series evidence</h2><p>Latest bar, range and quality contract</p></div><span id="series-freshness" class="q-status q-status--simulated">simulated</span></div><div id="series-evidence" class="q-panel-body"></div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Normalized OHLCV records</h2><p>Most recent values; all high-precision fields arrive as decimal strings</p></div><span id="series-count" class="q-status q-status--cached">0 points</span></div><div id="series-grid"></div></section>
  </section>`;
  let grid;
  const load=async()=>{
    const canonicalId=document.getElementById('series-instrument').value, interval=document.getElementById('series-interval').value, limit=document.getElementById('series-limit').value;
    const status=document.getElementById('series-query-status'); status.textContent='loading'; status.className='q-status q-status--delayed';
    const result=await api(`/api/v1/timeseries/${encodeURIComponent(canonicalId)}?interval=${interval}&limit=${limit}`);
    const values=result.points.map((point)=>({label:point.at,value:Number(point.close),...point}));
    const chartTarget=document.getElementById('timeseries-chart'); chartTarget.innerHTML='';
    new QellyChartShell(chartTarget,{title:`${canonicalId} · ${interval} normalized close`,series:values,metadata:{...result.metadata,freshnessClass:effectiveFreshness(result.metadata.freshnessClass)}});
    const latest=result.points.at(-1), first=result.points[0];
    document.getElementById('series-freshness').textContent=result.metadata.freshnessClass;document.getElementById('series-freshness').className=`q-status q-status--${result.metadata.freshnessClass}`;
    document.getElementById('series-evidence').innerHTML=`<div class="q-context-block"><dl><dt>Canonical ID</dt><dd>${escapeHtml(result.canonicalId)}</dd><dt>Range</dt><dd>${first?new Date(first.at).toLocaleString():'N/A'} → ${latest?new Date(latest.at).toLocaleString():'N/A'}</dd><dt>Latest close</dt><dd class="q-number">${latest?escapeHtml(latest.close):'N/A'}</dd><dt>Provider</dt><dd>${escapeHtml(result.metadata.providerId)}</dd><dt>Methodology</dt><dd>${escapeHtml(result.metadata.methodologyVersion)}</dd><dt>Pagination</dt><dd>${result.page.nextCursor?'More records available':'Complete requested range'}</dd></dl></div><div class="q-truth-callout is-compact"><span class="q-status q-status--simulated">local</span><p>${escapeHtml(result.metadata.source)}. Production time-series database and licensed historical completeness are not claimed.</p></div>`;
    const rows=result.points.slice().reverse().map((point)=>({at:new Date(point.at).toLocaleString(),open:point.open,high:point.high,low:point.low,close:point.close,volume:point.volume,sequence:point.sequence,freshnessClass:point.freshnessClass,providerId:point.providerId}));
    const columns=[{key:'at',label:'UTC time',width:190},{key:'open',label:'Open',width:130,numeric:true},{key:'high',label:'High',width:130,numeric:true},{key:'low',label:'Low',width:130,numeric:true},{key:'close',label:'Close',width:130,numeric:true},{key:'volume',label:'Volume',width:150,numeric:true},{key:'sequence',label:'Sequence',width:100,numeric:true},{key:'freshnessClass',label:'Freshness',width:120,format:'status'},{key:'providerId',label:'Provider',width:190}];
    if(grid)grid.setRows(rows);else grid=new QellyDataGrid(document.getElementById('series-grid'),{columns,rows,caption:'Normalized OHLCV time series records',density:state.prefs.density,selectable:false});
    document.getElementById('series-count').textContent=`${result.points.length} / ${result.page.total} points`;status.textContent='ready';status.className='q-status q-status--live';
  };
  ['series-instrument','series-interval','series-limit'].forEach((id)=>document.getElementById(id).addEventListener('change',load));
  main.querySelector('[data-action="refresh-series"]').addEventListener('click',load);main.querySelector('[data-action="timeseries-contract"]').addEventListener('click',()=>openContract('timeseries-streaming'));
  await load();
}

async function renderStreamOperations(main) {
  const [catalog,replay]=await Promise.all([api('/api/v1/streams/catalog'),api('/api/v1/streams/replay?channel=quotes&afterSequence=0&limit=12')]);
  state.streamFrames=[];
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Snapshot, delta, replay and recovery','Stream Operations','Operate entitlement-scoped local stream channels with sequence numbers, resume tokens, heartbeats, bounded replay and explicit gap recovery. The broker is a persistent local journal, not distributed production infrastructure.',`<button class="q-button q-button--secondary" data-action="stream-contract">Stream contract</button><button class="q-button q-button--secondary" data-action="replay-stream">Replay journal</button><button class="q-button q-button--primary" data-action="toggle-stream">Pause stream</button>`)}${stateBanner()}
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Channels</div><div class="q-kpi-value">${catalog.items.length}</div><div class="q-kpi-meta"><span>Entitlement scoped</span><span class="q-status q-status--live">catalogued</span></div></article><article class="q-kpi"><div class="q-kpi-label">Journal events</div><div id="stream-event-count" class="q-kpi-value">${replay.currentSequence}</div><div class="q-kpi-meta"><span>Quotes sequence head</span><span class="q-status q-status--cached">persistent</span></div></article><article class="q-kpi"><div class="q-kpi-label">Gap state</div><div id="stream-gap-value" class="q-kpi-value">${replay.gap?'GAP':'CLEAR'}</div><div class="q-kpi-meta"><span id="stream-gap-copy">${replay.gap?'Fresh snapshot required':'Replay continuity intact'}</span><span class="q-status q-status--${replay.gap?'warning':'live'}">sequence</span></div></article><article class="q-kpi"><div class="q-kpi-label">Production broker</div><div class="q-kpi-value">OFF</div><div class="q-kpi-meta"><span>Local SSE + JSON journal</span><span class="q-status q-status--unavailable">gated</span></div></article></div>
    <div class="q-stream-layout"><section class="q-panel"><div class="q-panel-head"><div><h2>Live quote stream</h2><p>Snapshot followed by deterministic deltas and heartbeats</p></div><span id="stream-connection" class="q-status q-status--delayed">connecting</span></div><div id="stream-tape" class="q-stream-tape" aria-live="polite"></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Channel registry</h2><p>Retention and required access action</p></div><span class="q-status q-status--cached">${catalog.items.length} channels</span></div><div class="q-panel-body q-stack">${catalog.items.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.channel)}</strong><small>${escapeHtml(item.description)} · ${escapeHtml(item.entitlementAction)}</small></span><span class="q-status q-status--cached">${item.retentionEvents} retained</span></div>`).join('')}<div class="q-truth-callout is-compact"><span class="q-status q-status--simulated">boundary</span><p>Reconnect, resume tokens and replay are implemented locally. Distributed partitioning, durable brokers and cross-node ordering remain production gates.</p></div></div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Replay and sequence evidence</h2><p>Newest frames are retained below with event IDs and resumable sequence state</p></div><span id="stream-last-sequence" class="q-status q-status--cached">sequence ${replay.currentSequence}</span></div><div id="stream-replay-grid"></div></section>
  </section>`;
  const columns=[{key:'sequence',label:'Sequence',width:100,numeric:true},{key:'eventType',label:'Event type',width:210},{key:'emittedAt',label:'Emitted UTC',width:190},{key:'items',label:'Payload items',width:110,numeric:true},{key:'freshnessClass',label:'Freshness',width:120,format:'status'},{key:'quality',label:'Quality',width:120},{key:'resumeToken',label:'Resume token',width:280}];
  const rowsFrom=(items)=>items.slice().reverse().map((event)=>({sequence:event.sequence,eventType:event.eventType,emittedAt:new Date(event.emittedAt).toLocaleString(),items:Array.isArray(event.payload)?event.payload.length:1,freshnessClass:event.freshnessClass,quality:event.quality?.valid?'valid':'review',resumeToken:event.resumeToken}));
  const grid=new QellyDataGrid(document.getElementById('stream-replay-grid'),{columns,rows:rowsFrom(replay.items),caption:'Stream replay journal',density:state.prefs.density,selectable:false});
  const renderTape=()=>{const tape=document.getElementById('stream-tape');tape.innerHTML=state.streamFrames.slice(-8).reverse().map((event)=>`<article class="q-stream-frame"><div><span class="q-status q-status--${event.eventType?.includes('heartbeat')?'cached':event.freshnessClass??'simulated'}">${event.eventType?.includes('heartbeat')?'heartbeat':event.freshnessClass??'event'}</span><strong>${escapeHtml(event.eventType??'stream event')}</strong></div><time>${new Date(event.emittedAt).toLocaleTimeString()}</time><small>${event.sequence?`sequence ${event.sequence} · `:''}${Array.isArray(event.payload)?`${event.payload.length} items`:'control frame'}</small></article>`).join('')||'<div class="q-empty-state"><div><h2>Awaiting first frame</h2><p>The local SSE connection is opening.</p></div></div>';};
  const connect=()=>{
    if(state.streamSource)state.streamSource.close();
    const source=new EventSource(apiUrl('/api/v1/stream/quotes?frames=12&intervalMs=240'),{withCredentials:true});state.streamSource=source;let received=0;
    source.onopen=()=>{const badge=document.getElementById('stream-connection');if(badge){badge.textContent='connected';badge.className='q-status q-status--live';}};
    source.onmessage=()=>{};
    ['quotes.snapshot.v1','quotes.delta.v1','stream.heartbeat.v1'].forEach((name)=>source.addEventListener(name,(event)=>{const value=JSON.parse(event.data);state.streamFrames.push(value);received+=1;renderTape();if(value.sequence){document.getElementById('stream-event-count').textContent=value.sequence;document.getElementById('stream-last-sequence').textContent=`sequence ${value.sequence}`;}if(received>=10){source.close();state.streamSource=null;const badge=document.getElementById('stream-connection');if(badge){badge.textContent='captured';badge.className='q-status q-status--cached';}}}));
    source.onerror=()=>{if(state.streamSource){source.close();state.streamSource=null;}const badge=document.getElementById('stream-connection');if(badge){badge.textContent=received?'complete':'reconnect needed';badge.className=`q-status q-status--${received?'cached':'warning'}`;}};
  };
  main.querySelector('[data-action="toggle-stream"]').addEventListener('click',(event)=>{if(state.streamSource){state.streamSource.close();state.streamSource=null;event.currentTarget.textContent='Resume stream';document.getElementById('stream-connection').textContent='paused';document.getElementById('stream-connection').className='q-status q-status--cached';}else{event.currentTarget.textContent='Pause stream';connect();}});
  main.querySelector('[data-action="replay-stream"]').addEventListener('click',async()=>{const value=await api('/api/v1/streams/replay?channel=quotes&afterSequence=0&limit=100');grid.setRows(rowsFrom(value.items));document.getElementById('stream-gap-value').textContent=value.gap?'GAP':'CLEAR';document.getElementById('stream-gap-copy').textContent=value.gap?'Fresh snapshot required':'Replay continuity intact';toast(`${value.items.length} journal events replayed`,{tone:'success'});});
  main.querySelector('[data-action="stream-contract"]').addEventListener('click',()=>openContract('timeseries-streaming'));
  renderTape();connect();
}

async function renderObservability(main) {
  const [overview,traces,logs]=await Promise.all([api('/api/v1/observability/overview'),api('/api/v1/observability/traces?limit=24'),api('/api/v1/observability/logs?limit=24')]);
  const metrics=overview.metrics;
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Metrics, traces, logs and SLO candidates','Observability Center','Inspect dependency health, request latency, provider controls, stream activity, traces, logs and candidate SLOs. Telemetry remains local and privacy-safe; no external exporter or production alerting system is configured.',`<button class="q-button q-button--secondary" data-action="observability-contract">Telemetry contract</button><button class="q-button q-button--primary" data-action="refresh-observability">Refresh evidence</button>`)}${stateBanner()}
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Observed requests</div><div class="q-kpi-value">${metrics.http.requests}</div><div class="q-kpi-meta"><span>${(metrics.http.errorRate*100).toFixed(2)}% 5xx error rate</span><span class="q-status q-status--${metrics.http.errorRate<=.01?'live':'warning'}">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">P95 latency</div><div class="q-kpi-value">${metrics.http.latencyMs.p95}ms</div><div class="q-kpi-meta"><span>Candidate target &lt;250ms</span><span class="q-status q-status--${metrics.http.latencyMs.p95<250?'live':'warning'}">p95</span></div></article><article class="q-kpi"><div class="q-kpi-label">Stream events</div><div class="q-kpi-value">${metrics.streaming.eventsPublished}</div><div class="q-kpi-meta"><span>${metrics.streaming.gapSignals} gap signals</span><span class="q-status q-status--${metrics.streaming.gapSignals?'warning':'live'}">journal</span></div></article><article class="q-kpi"><div class="q-kpi-label">Telemetry export</div><div class="q-kpi-value">OFF</div><div class="q-kpi-meta"><span>No third-party collector</span><span class="q-status q-status--unavailable">gated</span></div></article></div>
    <div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Dependency map</h2><p>Operational state and deployment boundary</p></div><span class="q-status q-status--cached">${overview.dependencies.length} dependencies</span></div><div class="q-panel-body q-dependency-grid">${overview.dependencies.map((item)=>`<article class="q-dependency-card"><div><span class="q-status q-status--${item.status==='healthy'?'live':item.status==='disabled'?'unavailable':item.status==='critical'?'critical':'warning'}">${escapeHtml(item.status)}</span><strong>${escapeHtml(item.id)}</strong></div><small>${escapeHtml(item.mode)}</small></article>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>SLO candidates</h2><p>Evidence gates, not production commitments</p></div><span class="q-status q-status--simulated">candidate</span></div><div class="q-panel-body q-stack">${overview.slos.map((item)=>`<div class="q-slo-row"><span><strong>${escapeHtml(item.id)}</strong><small>Target ${escapeHtml(item.target)} · ${escapeHtml(item.window)}</small></span><span><b>${escapeHtml(item.actual)}</b><span class="q-status q-status--${item.status==='meeting'?'live':item.status==='breached'?'critical':'warning'}">${escapeHtml(item.status)}</span></span></div>`).join('')}</div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Provider operational scorecard</h2><p>Request, breaker, bulkhead, latency and quality evidence</p></div><span class="q-status q-status--cached">${metrics.providers.length} registered</span></div><div class="q-provider-score-grid">${metrics.providers.map((item)=>`<article class="q-provider-score"><div><strong>${escapeHtml(item.providerId)}</strong><span class="q-status q-status--${item.status==='enabled'?'live':'unavailable'}">${escapeHtml(item.status)}</span></div><dl><dt>Quality</dt><dd>${item.quality.score}</dd><dt>Latency</dt><dd>${item.quality.latencyMs}ms</dd><dt>Requests</dt><dd>${item.metrics.requests}</dd><dt>Errors</dt><dd>${Math.round(item.quality.errorRate*100)}%</dd><dt>Breaker</dt><dd>${escapeHtml(item.breaker.state)}</dd><dt>Bulkhead</dt><dd>${item.bulkhead.active}/${item.bulkhead.limit}</dd></dl></article>`).join('')}</div></section>
    <div class="q-observability-tables"><section class="q-panel"><div class="q-panel-head"><div><h2>Recent traces</h2><p>Correlation-aware local server spans</p></div><span class="q-status q-status--cached">${traces.items.length}</span></div><div class="q-ops-table"><div class="q-ops-row is-head"><span>Route</span><span>Status</span><span>Latency</span><span>Trace</span></div>${traces.items.map((item)=>`<div class="q-ops-row"><span><strong>${escapeHtml(item.method)}</strong> ${escapeHtml(item.path)}</span><span class="q-status q-status--${item.statusCode<400?'live':item.statusCode<500?'warning':'critical'}">${item.statusCode}</span><span>${item.durationMs}ms</span><span class="q-hash">${escapeHtml(item.traceId.slice(0,12))}…</span></div>`).join('')||'<div class="q-empty-state"><div><h2>No traces yet</h2><p>Refresh after using the application.</p></div></div>'}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Structured logs</h2><p>Privacy-safe operational records</p></div><span class="q-status q-status--cached">${logs.items.length}</span></div><div class="q-ops-table"><div class="q-ops-row is-head"><span>Time</span><span>Level</span><span>Event</span><span>Details</span></div>${logs.items.map((item)=>`<div class="q-ops-row"><span>${new Date(item.at).toLocaleTimeString()}</span><span class="q-status q-status--${item.level==='error'?'critical':item.level==='warn'?'warning':'cached'}">${escapeHtml(item.level)}</span><span>${escapeHtml(item.event)}</span><span class="q-hash">${escapeHtml(JSON.stringify(item.details).slice(0,70))}</span></div>`).join('')}</div></section></div>
  </section>`;
  main.querySelector('[data-action="refresh-observability"]').addEventListener('click',()=>renderObservability(main));main.querySelector('[data-action="observability-contract"]').addEventListener('click',()=>openContract('observability'));
}

async function renderDiscoveryHub(main) {
  const [data,predictions,status] = await Promise.all([api('/api/v1/discovery/overview'),api('/api/v1/discovery/prediction-markets'),api('/api/v1/discovery/status')]);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Public discovery','Discovery Overview','A source-aware cross-asset discovery surface covering ranked entities, categories, events, prediction fixtures, news and platform trust.',`<button class="q-button q-button--secondary" data-action="save-discovery-screen">Save screen</button><button class="q-button q-button--secondary" data-action="discovery-contract">Inspect contract</button><button class="q-button q-button--primary" data-action="search-all">Search everything</button>`)}${stateBanner()}<div class="q-truth-callout"><span class="q-status q-status--simulated">fixture universe</span><p>${escapeHtml(data.truthBoundary)}</p></div><div class="q-kpi-grid">${data.kpis.map((item)=>kpiCard(item.label,item.value)).join('')}</div><div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Cross-asset movers</h2><p>Magnitude-ranked deterministic entities</p></div><button class="q-button q-button--ghost" data-action="open-asset-rankings">Full rankings</button></div><div id="discovery-movers-grid"></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Category breadth</h2><p>Performance, breadth and constituent evidence</p></div><button class="q-button q-button--ghost" data-action="open-categories">All categories</button></div><div class="q-panel-body q-discovery-card-grid">${data.categories.map((item)=>categoryCard(item)).join('')}</div></section></div><div class="q-discovery-three"><section class="q-panel"><div class="q-panel-head"><div><h2>News stream</h2><p>Fixture summaries with source quality</p></div><button class="q-button q-button--ghost" data-action="open-news">Open hub</button></div><div class="q-panel-body q-stack">${data.news.map(newsCard).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Events</h2><p>Explicit fixture calendar</p></div></div><div class="q-panel-body q-event-list">${data.events.map((item)=>`<div class="q-event"><time>${new Date(item.at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</time><div><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.source)}</small></div><span class="q-status q-status--${item.importance==='high'?'warning':'cached'}">${item.importance}</span></div>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Prediction fixtures</h2><p>Read-only, non-tradable probability evidence</p></div><span class="q-status q-status--unavailable">not tradable</span></div><div class="q-panel-body q-stack">${predictions.items.map((item)=>`<article class="q-probability-card"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.venue)}</small></div><b>${Math.round(item.probability*100)}%</b><progress max="1" value="${item.probability}">${Math.round(item.probability*100)}%</progress></article>`).join('')}</div></section></div><section class="q-panel"><div class="q-panel-head"><div><h2>Platform trust snapshot</h2><p>Local operational status and production-disabled boundaries</p></div><span class="q-status q-status--live">${escapeHtml(status.overall)}</span></div><div class="q-panel-body q-dependency-grid">${status.components.map((item)=>`<article class="q-dependency-card"><div><span class="q-status q-status--${item.status.includes('operational')?'live':'unavailable'}">${escapeHtml(item.status)}</span><strong>${escapeHtml(item.name)}</strong></div><small>${item.uptimePercent==null?'No production uptime claim':`${item.uptimePercent}% local evidence`} · ${item.latencyMs==null?'N/A':`${item.latencyMs} ms`}</small></article>`).join('')}</div></section></section>`;
  new QellyDataGrid(document.getElementById('discovery-movers-grid'),{columns:discoveryColumns(),rows:data.movers,rowKey:'canonicalId',caption:'Cross-asset discovery movers',density:state.prefs.density,onSelectionChange:(selected)=>announce(`${selected.length} discovery entities selected`)});
  main.querySelector('[data-action="search-all"]').addEventListener('click',()=>navigate('search'));
  main.querySelector('[data-action="open-asset-rankings"]').addEventListener('click',()=>navigate('asset-rankings'));
  main.querySelector('[data-action="open-categories"]').addEventListener('click',()=>navigate('categories'));
  main.querySelector('[data-action="open-news"]').addEventListener('click',()=>navigate('news-research'));
  main.querySelector('[data-action="discovery-contract"]').addEventListener('click',()=>openContract('public-discovery-search'));
  main.querySelector('[data-action="save-discovery-screen"]').addEventListener('click',async()=>{try{const result=await api('/api/v1/discovery/saved/screens',{method:'POST',headers:{'Idempotency-Key':`screen-${Date.now()}-qelly`},body:JSON.stringify({name:'Discovery command view',definition:{route:'discovery-hub',modules:['kpis','movers','categories','news','events','predictions','status']}})});toast(`Saved ${result.name}`,{tone:'success'});}catch(error){toast(error.message,{tone:'danger'});}});
  bindDiscoveryLinks(main);
}

function discoveryColumns(){return [
  {key:'symbol',label:'Instrument',width:210,render:(row)=>`<strong>${escapeHtml(row.symbol)}</strong> <span style="color:var(--q-muted);font-size:9px">${escapeHtml(row.name)}</span>`},
  {key:'assetClass',label:'Class',width:105},{key:'category',label:'Category',width:180},{key:'region',label:'Region',width:90},
  {key:'price',label:'Price',width:125,numeric:true,render:(row)=>formatDiscoveryPrice(row)},
  {key:'change24h',label:'24h',width:90,numeric:true,format:'change'},
  {key:'marketCap',label:'Market value',width:140,numeric:true,render:(row)=>row.marketCap==null?'<span class="q-unavailable">N/A</span>':`<span class="q-number">${formatCompact(row.marketCap)}</span>`},
  {key:'volume24h',label:'Volume',width:130,numeric:true,render:(row)=>row.volume24h==null?'<span class="q-unavailable">N/A</span>':`<span class="q-number">${formatCompact(row.volume24h)}</span>`},
  {key:'freshnessClass',label:'Freshness',width:110,format:'status'},{key:'source',label:'Source',width:230,format:'source'}
];}
function formatDiscoveryPrice(row){if(row.currency==='percent')return `<span class="q-number">${Number(row.price).toFixed(2)}%</span>`;try{return `<span class="q-number">${new Intl.NumberFormat('en-US',{style:'currency',currency:row.currency||'USD',maximumFractionDigits:row.price<10?6:2}).format(row.price)}</span>`;}catch{return `<span class="q-number">${Number(row.price).toLocaleString()} ${escapeHtml(row.currency||'')}</span>`;}}
function categoryCard(item){return `<button class="q-category-card" data-category="${escapeAttribute(item.categoryId)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.assetClass)} · ${item.constituentCount} constituents</small></span><b class="${item.performance24h>=0?'is-positive':'is-negative'}">${item.performance24h>=0?'+':''}${item.performance24h.toFixed(2)}%</b><div><span>Breadth</span><progress max="100" value="${item.breadth}">${item.breadth}%</progress><em>${item.breadth}%</em></div></button>`;}
function newsCard(item){return `<article class="q-news-card"><div><span class="q-status q-status--simulated">${escapeHtml(item.publisher)}</span><time>${new Date(item.publishedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</time></div><strong>${escapeHtml(item.headline)}</strong><p>${escapeHtml(item.summary)}</p><footer><span>${item.topics.map(escapeHtml).join(' · ')}</span><b>quality ${item.sourceQuality}</b></footer></article>`;}
function bindDiscoveryLinks(root){root.querySelectorAll('[data-category]').forEach((button)=>button.addEventListener('click',()=>navigate('category-detail',button.dataset.category)));root.querySelectorAll('[data-venue]').forEach((button)=>button.addEventListener('click',()=>navigate('venue-detail',button.dataset.venue)));root.querySelectorAll('[data-article]').forEach((button)=>button.addEventListener('click',()=>navigate('research-article',button.dataset.article)));}

async function renderAssetRankings(main){
  const data=await api('/api/v1/discovery/rankings?limit=100');
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Cross-asset discovery','Asset Rankings','Server-filtered and cursor-ready rankings across crypto, equities, funds, FX, commodities, indices, rates and tokenized fixtures.',`<button class="q-button q-button--secondary" data-action="save-ranking">Save screen</button><button class="q-button q-button--primary" data-action="persist-compare">Save compare tray</button>`)}${stateBanner()}<section class="q-panel q-timeseries-controls"><div class="q-panel-body"><div class="q-control-row"><label class="q-setting"><span>Asset class</span><select id="discovery-class"><option value="">All</option>${['crypto','equity','fund','fx','commodity','index','rate','tokenized'].map((item)=>`<option>${item}</option>`).join('')}</select></label><label class="q-setting"><span>Region</span><select id="discovery-region"><option value="">All</option><option>Global</option><option>US</option><option>IN</option></select></label><label class="q-setting"><span>Sort</span><select id="discovery-sort"><option value="marketCap">Market value</option><option value="change24h">24h change</option><option value="volume24h">Volume</option><option value="name">Name</option></select></label><label class="q-setting"><span>Search</span><input id="discovery-ranking-q" type="search" placeholder="Name, symbol or category"></label></div></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Ranked discovery universe</h2><p id="discovery-ranking-summary">${data.total} entities · source-aware fixture universe</p></div><span id="discovery-compare-count" class="q-status q-status--cached">0 selected</span></div><div id="discovery-ranking-grid"></div></section></section>`;
  let selection=[];let current=data.items;const grid=new QellyDataGrid(document.getElementById('discovery-ranking-grid'),{columns:discoveryColumns(),rows:current,rowKey:'canonicalId',caption:'Cross-asset rankings',density:state.prefs.density,onSelectionChange:(selected)=>{selection=selected;document.getElementById('discovery-compare-count').textContent=`${selected.length} selected`;}});
  let timer;const refresh=async()=>{const cls=document.getElementById('discovery-class').value,region=document.getElementById('discovery-region').value,sort=document.getElementById('discovery-sort').value,q=document.getElementById('discovery-ranking-q').value;const next=await api(`/api/v1/discovery/rankings?limit=100&assetClass=${encodeURIComponent(cls)}&region=${encodeURIComponent(region)}&sort=${encodeURIComponent(sort)}&q=${encodeURIComponent(q)}`);current=next.items;grid.setRows(current);document.getElementById('discovery-ranking-summary').textContent=`${next.total} entities · ${sort} descending`;};
  ['discovery-class','discovery-region','discovery-sort'].forEach((id)=>document.getElementById(id).addEventListener('change',refresh));document.getElementById('discovery-ranking-q').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(refresh,120)});
  main.querySelector('[data-action="persist-compare"]').addEventListener('click',async()=>{try{const result=await api('/api/v1/discovery/saved/compare-tray',{method:'PUT',headers:{'Idempotency-Key':`compare-${Date.now()}-qelly`},body:JSON.stringify({canonicalIds:selection})});toast(`${result.canonicalIds.length} entities saved to local compare tray`,{tone:'success'});}catch(error){toast(error.message,{tone:'danger'});}});
  main.querySelector('[data-action="save-ranking"]').addEventListener('click',async()=>{try{const result=await api('/api/v1/discovery/saved/screens',{method:'POST',headers:{'Idempotency-Key':`ranking-${Date.now()}-qelly`},body:JSON.stringify({name:'Cross-asset discovery screen',definition:{assetClass:document.getElementById('discovery-class').value,region:document.getElementById('discovery-region').value,sort:document.getElementById('discovery-sort').value,q:document.getElementById('discovery-ranking-q').value}})});toast(`Saved ${result.name}`,{tone:'success'});}catch(error){toast(error.message,{tone:'danger'});}});
}

async function renderCategories(main){
  const data=await api('/api/v1/discovery/categories');
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Taxonomy discovery','Cross-Asset Categories','Category performance, market value, volume, breadth, constituent counts and trend evidence across the local discovery graph.',`<button class="q-button q-button--secondary" data-action="category-method">Methodology</button>`)}${stateBanner()}<div class="q-category-grid-large">${data.items.map(categoryCard).join('')}</div><section class="q-panel"><div class="q-panel-head"><div><h2>Category matrix</h2><p>Unavailable market values remain unavailable</p></div><span class="q-status q-status--simulated">${data.total} categories</span></div><div class="q-category-matrix"><div class="q-category-matrix-row is-head"><span>Category</span><span>Class</span><span>24h</span><span>Breadth</span><span>Market value</span><span>Volume</span><span>Trend</span></div>${data.items.map((item)=>`<button class="q-category-matrix-row" data-category="${escapeAttribute(item.categoryId)}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.assetClass)}</span><span class="${item.performance24h>=0?'is-positive':'is-negative'}">${item.performance24h>=0?'+':''}${item.performance24h.toFixed(2)}%</span><span>${item.breadth}%</span><span>${item.marketValue==null?'N/A':formatCompact(item.marketValue)}</span><span>${item.volume24h==null?'N/A':formatCompact(item.volume24h)}</span><span class="q-status q-status--${item.trend==='positive'?'live':item.trend==='negative'?'warning':'cached'}">${item.trend}</span></button>`).join('')}</div></section></section>`;
  bindDiscoveryLinks(main);main.querySelector('[data-action="category-method"]').addEventListener('click',()=>navigate('trust-center','breadth'));
}

async function renderCategoryDetail(main){
  const id=['digital-assets','smart-contract-platforms','us-mega-cap','india-large-cap','us-growth-etfs','major-fx','precious-metals','energy-commodities','sovereign-rates','tokenized-securities'].includes(state.asset)?state.asset:'digital-assets';const data=await api(`/api/v1/discovery/categories/${encodeURIComponent(id)}`);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Category dossier',data.name,`${data.assetClass} category with constituent ranking, breadth, fixture risk, correlations, news and events.`,`<button class="q-button q-button--secondary" data-action="back-categories">All categories</button>`)}${stateBanner()}<div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">24h performance</div><div class="q-kpi-value ${data.performance24h>=0?'is-positive':'is-negative'}">${data.performance24h>=0?'+':''}${data.performance24h.toFixed(2)}%</div><div class="q-kpi-meta"><span>Category fixture</span><span class="q-status q-status--simulated">simulated</span></div></article><article class="q-kpi"><div class="q-kpi-label">Breadth</div><div class="q-kpi-value">${data.breadth}%</div><div class="q-kpi-meta"><span>Methodology 1.0</span><span class="q-status q-status--cached">candidate</span></div></article><article class="q-kpi"><div class="q-kpi-label">Constituents</div><div class="q-kpi-value">${data.constituentCount}</div><div class="q-kpi-meta"><span>Fixture universe</span><span class="q-status q-status--simulated">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">Risk score</div><div class="q-kpi-value">${data.risk.score}</div><div class="q-kpi-meta"><span>${escapeHtml(data.risk.methodologyVersion)}</span><span class="q-status q-status--warning">fixture</span></div></article></div><div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Constituent ranking</h2><p>Canonical entities in this category</p></div></div><div id="category-constituent-grid"></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Correlation evidence</h2><p>Deterministic demonstration, not portfolio advice</p></div></div><div class="q-panel-body q-stack">${data.correlations.map((item)=>`<div class="q-slo-row"><span><strong>${escapeHtml(item.canonicalId)}</strong><small>Fixture correlation</small></span><span><b>${item.correlation.toFixed(2)}</b><span class="q-status q-status--simulated">local</span></span></div>`).join('')}</div></section></div></section>`;
  new QellyDataGrid(document.getElementById('category-constituent-grid'),{columns:discoveryColumns(),rows:data.constituents,rowKey:'canonicalId',caption:`${data.name} constituents`,density:state.prefs.density});main.querySelector('[data-action="back-categories"]').addEventListener('click',()=>navigate('categories'));
}

async function renderVenues(main){
  const data=await api('/api/v1/discovery/venues');
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Venue discovery','Exchange and Venue Rankings','Spot, derivatives, DEX and securities-venue fixtures with volume, liquidity, depth, trust, jurisdiction and incident evidence.',`<button class="q-button q-button--secondary" data-action="venue-trust">Open trust center</button>`)}${stateBanner()}<div class="q-venue-grid">${data.items.map((item)=>`<button class="q-venue-card" data-venue="${escapeAttribute(item.venueId)}"><div><span class="q-status q-status--${item.status.includes('operational')?'live':'delayed'}">${escapeHtml(item.status)}</span><small>#${item.rank} · ${escapeHtml(item.type)}</small></div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.jurisdiction)} · ${escapeHtml(item.assetClass)}</p><dl><dt>Volume</dt><dd>${formatCompact(item.volume24h)}</dd><dt>Liquidity</dt><dd>${item.liquidityScore}</dd><dt>Depth</dt><dd>${item.depthScore}</dd><dt>Trust</dt><dd>${item.trustScore}</dd></dl><footer>${item.incidentCount} incident fixture · reserve ${escapeHtml(item.reserveProof)}</footer></button>`).join('')}</div></section>`;
  bindDiscoveryLinks(main);main.querySelector('[data-action="venue-trust"]').addEventListener('click',()=>navigate('trust-center'));
}

async function renderVenueDetail(main){
  const id=state.asset?.startsWith('venue-')?state.asset:'venue-coinbase-fixture';const data=await api(`/api/v1/discovery/venues/${encodeURIComponent(id)}`);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Venue dossier',data.name,`${data.type} venue evidence with volume history, markets, reserve-proof boundary, status, fees, jurisdiction and incidents.`,`<button class="q-button q-button--secondary" data-action="back-venues">All venues</button>`)}${stateBanner()}<div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">24h volume</div><div class="q-kpi-value">${formatCompact(data.volume24h)}</div><div class="q-kpi-meta"><span>Fixture</span><span class="q-status q-status--simulated">simulated</span></div></article><article class="q-kpi"><div class="q-kpi-label">Liquidity score</div><div class="q-kpi-value">${data.liquidityScore}</div><div class="q-kpi-meta"><span>Candidate method</span><span class="q-status q-status--cached">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">Trust score</div><div class="q-kpi-value">${data.trustScore}</div><div class="q-kpi-meta"><span>No external attestation</span><span class="q-status q-status--warning">fixture</span></div></article><article class="q-kpi"><div class="q-kpi-label">Status</div><div class="q-kpi-value" style="font-size:18px">${escapeHtml(data.status)}</div><div class="q-kpi-meta"><span>${escapeHtml(data.jurisdiction)}</span><span class="q-status q-status--${data.status.includes('operational')?'live':'delayed'}">status</span></div></article></div><div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Volume history</h2><p>30-day deterministic fixture</p></div></div><div class="q-panel-body">${discoverySeries(data.volumeHistory,'USD')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Venue boundaries</h2><p>Production claims remain disabled</p></div></div><div class="q-panel-body"><div class="q-context-block"><dl><dt>Reserve proof</dt><dd>${escapeHtml(data.reserveProof)}</dd><dt>Fees</dt><dd>${escapeHtml(data.fees)}</dd><dt>Incidents</dt><dd>${data.incidentCount}</dd><dt>External validation</dt><dd>No</dd></dl></div><div class="q-truth-callout is-compact"><span class="q-status q-status--unavailable">gated</span><p>Venue identity, reserves, fees and market completeness require official production verification.</p></div></div></section></div></section>`;
  main.querySelector('[data-action="back-venues"]').addEventListener('click',()=>navigate('venues'));
}

async function renderDexDiscovery(main){
  const data=await api('/api/v1/discovery/dex');const selected=state.asset&&state.asset.startsWith('dex-')?await api(`/api/v1/discovery/dex/${encodeURIComponent(state.asset)}`):null;
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · DEX discovery','DEX Pairs and Signals','Pair-level price, liquidity, age, transactions, holders, security and smart-money fixtures with explicit non-live on-chain boundaries.',`<button class="q-button q-button--secondary" data-action="dex-contract">Discovery contract</button>`)}${stateBanner()}<div class="q-truth-callout"><span class="q-status q-status--unavailable">not on-chain live</span><p>All DEX pools, trades, holders, security scores and smart-money labels are deterministic demonstration data.</p></div><div class="q-dex-grid">${data.items.map((item)=>`<button class="q-dex-card ${selected?.pairId===item.pairId?'is-selected':''}" data-dex-pair="${escapeAttribute(item.pairId)}"><div><strong>${escapeHtml(item.name)}</strong><span class="q-status q-status--simulated">${escapeHtml(item.chain)}</span></div><b>${formatDiscoveryPrice({price:item.price,currency:'USD'})}</b><p class="${item.change24h>=0?'is-positive':'is-negative'}">${item.change24h>=0?'+':''}${item.change24h.toFixed(2)}%</p><dl><dt>Liquidity</dt><dd>${formatCompact(item.liquidity)}</dd><dt>Age</dt><dd>${item.ageDays}d</dd><dt>Transactions</dt><dd>${item.transactions24h}</dd><dt>Security</dt><dd>${item.securityScore}</dd></dl><footer>${escapeHtml(item.smartMoneySignal)} · ${escapeHtml(item.venue)}</footer></button>`).join('')}</div>${selected?`<section class="q-panel"><div class="q-panel-head"><div><h2>${escapeHtml(selected.name)} pair dossier</h2><p>Trades, price history and pool evidence</p></div><span class="q-status q-status--simulated">fixture detail</span></div><div class="q-dashboard-grid q-panel-body"><div>${discoverySeries(selected.chart,'USD')}</div><div class="q-stack">${selected.trades.slice(0,8).map((trade)=>`<div class="q-record-row"><span><strong>${escapeHtml(trade.side.toUpperCase())} ${trade.size}</strong><small>${new Date(trade.at).toLocaleTimeString('en-IN')}</small></span><b>${trade.price}</b></div>`).join('')}</div></div></section>`:''}</section>`;
  main.querySelectorAll('[data-dex-pair]').forEach((button)=>button.addEventListener('click',()=>navigate('dex-discovery',button.dataset.dexPair)));main.querySelector('[data-action="dex-contract"]').addEventListener('click',()=>openContract('public-discovery-search'));
}

async function renderGlobalCharts(main){
  const [charts,predictions]=await Promise.all([api('/api/v1/discovery/global-charts'),api('/api/v1/discovery/prediction-markets')]);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Global chart platform','Global Charts and Prediction Evidence','Global market value, dominance, volatility, breadth and flow fixtures with methodology labels and accessible data tables.',`<button class="q-button q-button--secondary" data-action="chart-methodologies">Methodologies</button>`)}${stateBanner()}<div class="q-global-chart-grid">${charts.items.map((item)=>`<section class="q-panel"><div class="q-panel-head"><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.methodologyVersion)} · ${escapeHtml(item.unit)}</p></div><span class="q-status q-status--simulated">${escapeHtml(item.freshnessClass)}</span></div><div class="q-panel-body">${discoverySeries(item.series,item.unit)}</div><footer class="q-source-line"><span>${escapeHtml(item.source)}</span><span>${escapeHtml(item.observedAt)}</span></footer></section>`).join('')}</div><section class="q-panel"><div class="q-panel-head"><div><h2>Prediction-market events</h2><p>Probability history and resolution-rule boundary</p></div><span class="q-status q-status--unavailable">read-only</span></div><div class="q-panel-body q-prediction-grid">${predictions.items.map((item)=>`<article class="q-probability-card"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.resolutionRule)}</small></div><b>${Math.round(item.probability*100)}%</b><progress max="1" value="${item.probability}"></progress><footer>${formatCompact(item.volume)} volume · ${formatCompact(item.liquidity)} liquidity</footer></article>`).join('')}</div></section></section>`;
  main.querySelector('[data-action="chart-methodologies"]').addEventListener('click',()=>navigate('trust-center'));
}

function discoverySeries(series,unit='value'){const values=series.map((item)=>Number(item.value));const min=Math.min(...values),max=Math.max(...values),span=Math.max(max-min,1e-9),width=640,height=210,pad=18;const points=series.map((item,index)=>`${(pad+index/Math.max(1,series.length-1)*(width-pad*2)).toFixed(1)},${(height-pad-(Number(item.value)-min)/span*(height-pad*2)).toFixed(1)}`).join(' ');const latest=values.at(-1);return `<div class="q-discovery-series"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Series from ${min.toFixed(2)} to ${max.toFixed(2)}, latest ${latest.toFixed(2)}"><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" class="q-chart-axis"/><polyline points="${points}" class="q-chart-line"/></svg><div><span>Min <strong>${min.toLocaleString()}</strong></span><span>Latest <strong>${latest.toLocaleString()}</strong></span><span>Max <strong>${max.toLocaleString()}</strong></span><span>${escapeHtml(unit)}</span></div></div>`;}

async function renderConverter(main){
  const assets=(await api('/api/v1/discovery/rankings?limit=100')).items;
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Universal converter','Multi-Asset Converter','Cross-asset fixture rates with optional fee and slippage simulation. Results are informational and cannot execute, transfer or withdraw assets.',`<button class="q-button q-button--secondary" data-action="converter-method">Pricing methodology</button>`)}${stateBanner()}<div class="q-converter-shell"><section class="q-panel"><div class="q-panel-head"><div><h2>Conversion inputs</h2><p>Decimal calculation boundary</p></div><span class="q-status q-status--unavailable">not executable</span></div><div class="q-panel-body q-converter-form"><label class="q-setting"><span>Amount</span><input id="convert-amount" type="number" min="0" step="any" value="1"></label><label class="q-setting"><span>From</span><select id="convert-from">${assets.map((item)=>`<option value="${escapeAttribute(item.canonicalId)}" ${item.symbol==='BTC'?'selected':''}>${escapeHtml(item.symbol)} · ${escapeHtml(item.name)}</option>`).join('')}</select></label><button class="q-swap-button" data-action="swap-converter" aria-label="Swap converter assets">⇄</button><label class="q-setting"><span>To</span><select id="convert-to">${assets.map((item)=>`<option value="${escapeAttribute(item.canonicalId)}" ${item.symbol==='USDINR'?'selected':''}>${escapeHtml(item.symbol)} · ${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="q-setting"><span>Fee (bps)</span><input id="convert-fee" type="number" min="0" max="1000" value="10"></label><label class="q-setting"><span>Slippage (bps)</span><input id="convert-slippage" type="number" min="0" max="1000" value="5"></label><button class="q-button q-button--primary" data-action="run-converter">Calculate fixture conversion</button></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Calculated result</h2><p>Source, rate, fees and truth flags</p></div><span id="converter-status" class="q-status q-status--cached">ready</span></div><div id="converter-result" class="q-panel-body"><p class="q-muted-copy">Run the calculation to inspect the non-executable result contract.</p></div></section></div></section>`;
  const run=async()=>{try{const result=await api('/api/v1/discovery/converter',{method:'POST',body:JSON.stringify({amount:document.getElementById('convert-amount').value,from:document.getElementById('convert-from').value,to:document.getElementById('convert-to').value,feeBps:document.getElementById('convert-fee').value,slippageBps:document.getElementById('convert-slippage').value})});document.getElementById('converter-status').textContent='calculated';document.getElementById('converter-status').className='q-status q-status--simulated';document.getElementById('converter-result').innerHTML=`<div class="q-converter-result"><p>${escapeHtml(result.from.amount)} <strong>${escapeHtml(result.from.symbol)}</strong></p><span>converts to</span><h2>${escapeHtml(result.to.netAmount)} ${escapeHtml(result.to.symbol)}</h2><dl><dt>Gross</dt><dd>${escapeHtml(result.to.grossAmount)}</dd><dt>Rate</dt><dd>${escapeHtml(result.rate)}</dd><dt>Fee</dt><dd>${escapeHtml(result.fee.amount)} (${result.fee.bps} bps)</dd><dt>Slippage</dt><dd>${escapeHtml(result.slippage.amount)} (${result.slippage.bps} bps)</dd><dt>Tradable</dt><dd>No</dd></dl><div class="q-capabilities">${result.qualityFlags.map((item)=>`<span class="q-capability">${escapeHtml(item)}</span>`).join('')}</div></div>`;}catch(error){toast(error.message,{tone:'danger'});}};
  main.querySelector('[data-action="run-converter"]').addEventListener('click',run);main.querySelector('[data-action="swap-converter"]').addEventListener('click',()=>{const from=document.getElementById('convert-from'),to=document.getElementById('convert-to'),value=from.value;from.value=to.value;to.value=value;run();});main.querySelector('[data-action="converter-method"]').addEventListener('click',()=>navigate('trust-center','market-value'));await run();
}

async function renderNewsResearch(main){
  const [news,research]=await Promise.all([api('/api/v1/discovery/news'),api('/api/v1/discovery/research')]);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Public intelligence content','News and Research Hub','Source-quality news fixtures and citation-bearing research collections, with licensed content, AI summaries and alerts explicitly production-gated.',`<button class="q-button q-button--secondary" data-action="content-search">Search content</button>`)}${stateBanner()}<div class="q-news-research-layout"><section class="q-panel"><div class="q-panel-head"><div><h2>News stream</h2><p>Topics, related assets, sentiment and source-quality evidence</p></div><span class="q-status q-status--simulated">${news.total} items</span></div><div class="q-panel-body q-stack">${news.items.map(newsCard).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Research collections</h2><p>Versioned articles with citations and methodologies</p></div><span class="q-status q-status--simulated">${research.total} articles</span></div><div class="q-panel-body q-stack">${research.items.map((item)=>`<button class="q-research-card" data-article="${escapeAttribute(item.articleId)}"><div><span class="q-status q-status--cached">${escapeHtml(item.collection)}</span><time>${new Date(item.publishedAt).toLocaleDateString('en-GB')}</time></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p><footer>${escapeHtml(item.author)} · v${escapeHtml(item.version)} · ${item.citations.length} citations</footer></button>`).join('')}</div></section></div><div class="q-truth-callout"><span class="q-status q-status--unavailable">content rights gated</span><p>No licensed news feed, external filing corpus, generated AI summary, comment service, alert delivery or export right is claimed.</p></div></section>`;
  bindDiscoveryLinks(main);main.querySelector('[data-action="content-search"]').addEventListener('click',()=>navigate('search'));
}

async function renderResearchArticle(main){
  const id=state.asset?.startsWith('research-')?state.asset:'research-cross-asset-regime';const article=await api(`/api/v1/discovery/research/${encodeURIComponent(id)}`);
  main.innerHTML=`<section class="q-page">${pageHead(article.collection,article.title,`${article.author} · version ${article.version} · ${new Date(article.publishedAt).toLocaleDateString('en-GB')}`,`<button class="q-button q-button--secondary" data-action="back-research">Research hub</button>`)}${stateBanner()}<article class="q-article-shell"><div class="q-article-summary"><p>${escapeHtml(article.summary)}</p><div class="q-capabilities">${article.methodologies.map((item)=>`<span class="q-capability">${escapeHtml(item.name)} ${escapeHtml(item.version)}</span>`).join('')}</div></div>${article.body.map((paragraph)=>`<p>${escapeHtml(paragraph)}</p>`).join('')}<section><h2>Citations</h2><div class="q-stack">${article.citations.map((citation)=>`<div class="q-record-row"><span><strong>${escapeHtml(citation.label)}</strong><small>${escapeHtml(citation.type)}</small></span><span class="q-status q-status--cached">cited</span></div>`).join('')}</div></section><section><h2>Related assets</h2><div class="q-capabilities">${article.relatedAssets.map((item)=>`<button class="q-capability" data-related-asset="${escapeAttribute(item.canonicalId)}">${escapeHtml(item.symbol)} · ${escapeHtml(item.name)}</button>`).join('')}</div></section><footer class="q-source-line"><span>${escapeHtml(article.source)}</span><span>${escapeHtml(article.observedAt)}</span><span>Comments ${article.commentsEnabled?'enabled':'disabled'}</span><span>Export ${article.exportEnabled?'enabled':'disabled'}</span></footer></article></section>`;
  main.querySelector('[data-action="back-research"]').addEventListener('click',()=>navigate('news-research'));main.querySelectorAll('[data-related-asset]').forEach((button)=>button.addEventListener('click',()=>navigate('asset',button.dataset.relatedAsset)));
}

async function renderTrustCenter(main){
  const [methods,coverage,status,saved]=await Promise.all([api('/api/v1/discovery/methodologies'),api('/api/v1/discovery/coverage'),api('/api/v1/discovery/status'),api('/api/v1/discovery/saved')]);const selected=state.asset?methods.items.find((item)=>item.methodologyId===state.asset):null;
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Methodology, coverage and status','Public Trust Center','Versioned methodologies, provider and asset-class coverage, delay and licensing boundaries, incidents, security notices, attestations and local saved-state evidence.',`<button class="q-button q-button--secondary" data-action="audit-evidence">Audit evidence</button><button class="q-button q-button--secondary" data-action="status-json">Status JSON</button>`)}${stateBanner()}<div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Coverage quality</div><div class="q-kpi-value">${coverage.summary.qualityScore}</div><div class="q-kpi-meta"><span>${coverage.summary.entities} entities</span><span class="q-status q-status--cached">fixture</span></div></article><article class="q-kpi"><div class="q-kpi-label">Asset classes</div><div class="q-kpi-value">${coverage.summary.assetClasses}</div><div class="q-kpi-meta"><span>${coverage.summary.regions} region groups</span><span class="q-status q-status--simulated">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">External providers</div><div class="q-kpi-value">${coverage.summary.externalProvidersEnabled}</div><div class="q-kpi-meta"><span>Licensed feeds ${coverage.summary.licensedFeedsConfigured}</span><span class="q-status q-status--unavailable">disabled</span></div></article><article class="q-kpi"><div class="q-kpi-label">Saved discovery state</div><div class="q-kpi-value">${saved.savedSearches.length+saved.savedScreens.length}</div><div class="q-kpi-meta"><span>Local atomic persistence</span><span class="q-status q-status--live">ready</span></div></article></div><div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Methodology registry</h2><p>Click to inspect version history and limitations</p></div><span class="q-status q-status--cached">${methods.items.length} methods</span></div><div class="q-panel-body q-stack">${methods.items.map((item)=>`<button class="q-method-card ${selected?.methodologyId===item.methodologyId?'is-selected':''}" data-method="${escapeAttribute(item.methodologyId)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small></span><span><b>${escapeHtml(item.version)}</b><em>${escapeHtml(item.status)}</em></span></button>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>${selected?escapeHtml(selected.name):'Coverage truth boundary'}</h2><p>${selected?'Version history, inputs and limitations':'Select a methodology or inspect coverage'}</p></div></div><div class="q-panel-body">${selected?`<div class="q-context-block"><dl><dt>Version</dt><dd>${escapeHtml(selected.version)}</dd><dt>Status</dt><dd>${escapeHtml(selected.status)}</dd><dt>Inputs</dt><dd>${selected.inputs.map(escapeHtml).join(', ')}</dd><dt>Limitations</dt><dd>${selected.limitations.map(escapeHtml).join('; ')}</dd></dl></div><div class="q-stack">${selected.history.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.version)}</strong><small>${escapeHtml(item.change)}</small></span><time>${new Date(item.effectiveAt).toLocaleDateString('en-GB')}</time></div>`).join('')}</div>`:`<div class="q-truth-callout"><span class="q-status q-status--unavailable">production gated</span><p>Coverage is a deterministic development matrix, not a claim of complete or licensed global market data.</p></div>`}</div></section></div><section class="q-panel"><div class="q-panel-head"><div><h2>Asset-class coverage matrix</h2><p>History, delay, license and quality evidence</p></div></div><div class="q-coverage-table"><div class="q-coverage-row is-head"><span>Class</span><span>Entities</span><span>Regions</span><span>History</span><span>Delay</span><span>License</span><span>Quality</span></div>${coverage.assetClasses.map((item)=>`<div class="q-coverage-row"><strong>${escapeHtml(item.assetClass)}</strong><span>${item.entities}</span><span>${item.regions.map(escapeHtml).join(', ')}</span><span>${escapeHtml(item.history)}</span><span>${escapeHtml(item.delay)}</span><span>${escapeHtml(item.license)}</span><b>${item.qualityScore}</b></div>`).join('')}</div></section><div class="q-discovery-three"><section class="q-panel"><div class="q-panel-head"><div><h2>Components</h2><p>${escapeHtml(status.overall)}</p></div></div><div class="q-panel-body q-stack">${status.components.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.name)}</strong><small>${item.latencyMs==null?'No production latency claim':`${item.latencyMs} ms`}</small></span><span class="q-status q-status--${item.status.includes('operational')?'live':'unavailable'}">${escapeHtml(item.status)}</span></div>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Incidents and maintenance</h2><p>Local release evidence</p></div></div><div class="q-panel-body q-stack">${status.incidents.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.summary)}</small></span><span class="q-status q-status--live">${escapeHtml(item.status)}</span></div>`).join('')}${status.maintenance.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.summary)}</strong><small>${escapeHtml(item.window)}</small></span><span class="q-status q-status--unavailable">${escapeHtml(item.status)}</span></div>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Security and attestations</h2><p>No external audit claim</p></div></div><div class="q-panel-body q-stack">${status.securityNotices.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.severity)}</small></span><span class="q-status q-status--cached">notice</span></div>`).join('')}${status.attestations.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.scope)}</small></span><span class="q-status q-status--simulated">${escapeHtml(item.status)}</span></div>`).join('')}</div></section></div></section>`;
  main.querySelectorAll('[data-method]').forEach((button)=>button.addEventListener('click',()=>navigate('trust-center',button.dataset.method)));main.querySelector('[data-action="audit-evidence"]').addEventListener('click',()=>navigate('security-evidence'));main.querySelector('[data-action="status-json"]').addEventListener('click',()=>openJsonDialog('Public status evidence',status,'Local status fixture; not production uptime'));
}


async function renderSecurityEvidence(main) {
  const [audit, verification, privacy, context] = await Promise.all([api('/api/v1/audit?limit=30'),api('/api/v1/audit/verify'),api('/api/v1/privacy/data-inventory'),api('/api/v1/session/context')]);
  main.innerHTML=`<section class="q-page">${pageHead('Qelly Intelligence · Security and privacy evidence','Security Evidence Center','Append-only hash-chained local audit records, secure headers, CSRF proof, rate limits, request limits, idempotency gates, privacy inventory and explicit safety locks are inspectable. This is evidence for a local foundation, not a compliance certification.',`<button class="q-button q-button--secondary" data-action="verify-again">Verify ledger</button><button class="q-button q-button--primary" data-action="identity-contract">Identity contract</button>`)}${stateBanner()}
    <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Audit chain</div><div class="q-kpi-value">${verification.valid?'VALID':'INVALID'}</div><div class="q-kpi-meta"><span>${verification.records} records</span><span class="q-status q-status--${verification.valid?'live':'critical'}">hash chain</span></div></article><article class="q-kpi"><div class="q-kpi-label">Session assurance</div><div class="q-kpi-value">${escapeHtml(context.session.assurance.toUpperCase())}</div><div class="q-kpi-meta"><span>${escapeHtml(context.device.trust)}</span><span class="q-status q-status--cached">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">Privacy categories</div><div class="q-kpi-value">${privacy.categories.length}</div><div class="q-kpi-meta"><span>Purpose and retention registered</span><span class="q-status q-status--live">minimized</span></div></article><article class="q-kpi"><div class="q-kpi-label">Forbidden secret classes</div><div class="q-kpi-value">${privacy.excludes.length}</div><div class="q-kpi-meta"><span>Keys, phrases and payment data excluded</span><span class="q-status q-status--live">locked</span></div></article></div>
    <div class="q-dashboard-grid"><section class="q-panel"><div class="q-panel-head"><div><h2>Hash-chain verification</h2><p>Every record binds its predecessor and canonical payload hash</p></div><span id="ledger-status" class="q-status q-status--${verification.valid?'live':'critical'}">${verification.valid?'valid':'invalid'}</span></div><div id="ledger-result" class="q-panel-body"><div class="q-context-block"><dl><dt>Records</dt><dd>${verification.records}</dd><dt>Head hash</dt><dd class="q-hash">${escapeHtml(verification.headHash??'GENESIS')}</dd><dt>Result</dt><dd>${verification.valid?'No hash mismatch found':'Integrity check failed'}</dd></dl></div></div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Privacy inventory</h2><p>Only local fixture data is represented</p></div><span class="q-status q-status--simulated">local-only</span></div><div class="q-panel-body q-stack">${privacy.categories.map((category)=>`<div class="q-record-row"><span><strong>${escapeHtml(category.category)}</strong><small>${escapeHtml(category.purpose)} · ${escapeHtml(category.retention)}</small></span><span class="q-status q-status--cached">${category.fields.length} fields</span></div>`).join('')}<div class="q-truth-callout is-compact"><span class="q-status q-status--live">excluded</span><p>${escapeHtml(privacy.excludes.join(', '))}</p></div></div></section></div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Recent audit evidence</h2><p>Restricted details stay server-side; this view exposes the governed local record structure</p></div><span class="q-status q-status--cached">${audit.items.length} visible</span></div><div class="q-audit-table"><div class="q-audit-row is-head"><span>Time</span><span>Event</span><span>Actor</span><span>Outcome</span><span>Hash</span></div>${audit.items.slice().reverse().map((item)=>`<div class="q-audit-row"><span>${new Date(item.occurredAt).toLocaleString()}</span><span>${escapeHtml(item.eventType)}</span><span>${escapeHtml(item.actor.id)}</span><span class="q-status q-status--${item.outcome==='success'?'live':'critical'}">${escapeHtml(item.outcome)}</span><span class="q-hash">${escapeHtml(item.recordHash.slice(0,14))}…</span></div>`).join('')||'<div class="q-empty-state"><div><h2>No audit records yet</h2><p>Use another control route to create evidence.</p></div></div>'}</div></section>
  </section>`;
  main.querySelector('[data-action="verify-again"]').addEventListener('click',async()=>{const value=await api('/api/v1/audit/verify');document.getElementById('ledger-status').textContent=value.valid?'valid':'invalid';toast(value.valid?'Audit ledger verification passed':'Audit ledger verification failed',{tone:value.valid?'success':'danger'});});
  main.querySelector('[data-action="identity-contract"]').addEventListener('click',()=>openContract('identity-security'));
}

function operationalEvents() {
  return [
    ['Source','Recovered source checksum verified','live'],['Design','Qelly design system preserved','live'],['Identity','Local identity and authorization runtime active','live'],['Data','Provider and instrument foundations active','live'],['Runtime','Time series, streaming and observability active','live'],['Gate','Production SSO, secrets and external feeds disabled','unavailable']
  ].map(([time,title,status])=>`<div class="q-event"><time>${time}</time><strong>${title}</strong><span class="q-status q-status--${status}">${status}</span></div>`).join('');
}

function openJsonDialog(title, value, footer='Local foundation evidence') {
  const dialog=document.createElement('dialog');dialog.className='q-dialog';dialog.innerHTML=`<div class="q-dialog__header"><div><p class="q-eyebrow">Evidence inspector</p><h2>${escapeHtml(title)}</h2></div><button class="q-icon-button" data-close aria-label="Close">×</button></div><div class="q-dialog__body"><pre class="q-json-evidence">${escapeHtml(JSON.stringify(value,null,2))}</pre></div><div class="q-dialog__footer"><span class="q-status q-status--simulated">${escapeHtml(footer)}</span><button class="q-button q-button--primary" data-close>Close</button></div>`;document.body.append(dialog);dialog.querySelectorAll('[data-close]').forEach((element)=>element.addEventListener('click',()=>{closeDialog(dialog);dialog.remove();}));openDialog(dialog);
}


function openEvidence(title,value,footer='Evidence') {
  const dialog=document.createElement('dialog');dialog.className='q-dialog';dialog.innerHTML=`<div class="q-dialog__header"><div><p class="q-eyebrow">Evidence inspector</p><h2>${escapeHtml(title)}</h2></div><button class="q-icon-button" data-close aria-label="Close">×</button></div><div class="q-dialog__body"><pre class="q-json-evidence">${escapeHtml(JSON.stringify(value,null,2))}</pre></div><div class="q-dialog__footer"><span class="q-status q-status--simulated">${escapeHtml(footer)}</span><button class="q-button q-button--primary" data-close>Close</button></div>`;document.body.append(dialog);dialog.querySelectorAll('[data-close]').forEach((element)=>element.addEventListener('click',()=>{closeDialog(dialog);dialog.remove();}));openDialog(dialog);
}

function openContext(data) {
  state.contextOpen=true;document.querySelector('.q-shell').classList.add('is-context-open');const drawer=document.getElementById('context-drawer');drawer.setAttribute('aria-hidden','false');
  document.getElementById('context-content').innerHTML=`<div class="q-context-block"><h3>${escapeHtml(data.title??'Source details')}</h3>${sourceDisclosure({provider:data.source??'Unavailable',state:data.freshness??'unavailable',observedAt:data.observedAt??'Unavailable',receivedAt:data.receivedAt??'Unavailable',confidence:data.confidence,methodology:data.methodology??'Provider observation'})}<dl style="margin-top:14px">${data.canonicalId?`<dt>Canonical</dt><dd>${escapeHtml(data.canonicalId)}</dd>`:''}<dt>Entitlement</dt><dd>${escapeHtml(data.entitlement??'N/A')}</dd></dl></div><div class="q-context-block"><h3>Quality and truth flags</h3><ul style="padding-left:18px;font-size:12px;line-height:1.7">${(data.flags??[]).map((flag)=>`<li>${escapeHtml(flag)}</li>`).join('')}</ul></div>`;
  drawer.querySelector('button').focus();
}
function closeContext(){state.contextOpen=false;document.querySelector('.q-shell').classList.remove('is-context-open');document.getElementById('context-drawer').setAttribute('aria-hidden','true');}

document.addEventListener('click',(event)=>{
  const source=event.target.closest('[data-source]');if(!source)return;try{const value=JSON.parse(source.dataset.source);openContext({title:value.canonicalEntityId,source:value.source,freshness:value.freshnessClass,observedAt:value.observedAt,receivedAt:value.receivedAt,confidence:value.confidence,entitlement:value.entitlementClass,flags:value.qualityFlags,canonicalId:value.canonicalEntityId});}catch{}
});

async function openContract(name) {
  const contract=await api(`/api/v1/contracts/${name}`);const dialog=document.createElement('dialog');dialog.className='q-dialog';dialog.innerHTML=`<div class="q-dialog__header"><div><p class="q-eyebrow">Runtime contract and release boundary</p><h2>${escapeHtml(name.replaceAll('-',' '))}</h2></div><button class="q-icon-button" data-close aria-label="Close contract">×</button></div><div class="q-dialog__body"><pre style="white-space:pre-wrap;max-height:60vh;overflow:auto;background:var(--q-surface-alt);border:1px solid var(--q-border);padding:12px;border-radius:8px;font:10px/1.55 var(--q-font-mono)">${escapeHtml(JSON.stringify(contract,null,2))}</pre></div><div class="q-dialog__footer"><span class="q-status q-status--simulated">local foundation · production gated</span><button class="q-button q-button--primary" data-close>Close</button></div>`;document.body.append(dialog);dialog.querySelectorAll('[data-close]').forEach((element)=>element.addEventListener('click',()=>{closeDialog(dialog);dialog.remove();}));openDialog(dialog);
}

function openCommands() {
  commandDialog([
    ...routeDefinitions.filter((item)=>!item.hidden&&(!staticVisualPreview||staticPreviewRoutes.has(item.route))).map((item,index)=>({label:item.label,hint:index<9?`Alt ${index+1}`:'Command',run:()=>navigate(item.route)})),
    {label:'Open Bitcoin dossier',hint:'BTC',run:()=>navigate('asset','BTC')},
    {label:'Preview stale state',hint:'Validation',run:()=>{state.previewState='stale';document.getElementById('state-selector').value='stale';renderRoute();}},
    {label:'Reset preview state',hint:'Default',run:()=>{state.previewState='default';document.getElementById('state-selector').value='default';renderRoute();}}
  ]);
}

function openNotifications() {
  const dialog=document.createElement('dialog');dialog.className='q-dialog';dialog.innerHTML=`<div class="q-dialog__header"><div><p class="q-eyebrow">Foundation evidence inbox</p><h2>Platform notices</h2></div><button class="q-icon-button" data-close aria-label="Close notifications">×</button></div><div class="q-dialog__body q-event-list"><div class="q-event"><time>Source</time><div><strong>Recovered baseline preserved</strong><br><small>The immutable baseline evidence remains unchanged.</small></div><span class="q-status q-status--live">verified</span></div><div class="q-event"><time>Identity</time><div><strong>Local identity runtime active</strong><br><small>RBAC, ABAC, sessions, step-up, consent and audit are deterministic local foundations.</small></div><span class="q-status q-status--simulated">local</span></div><div class="q-event"><time>Data</time><div><strong>Provider and instrument foundations active</strong><br><small>External providers, licensed data and production credentials remain disabled.</small></div><span class="q-status q-status--unavailable">gated</span></div><div class="q-event"><time>Runtime</time><div><strong>Time-series and streaming plane active</strong><br><small>Persistent local history, replayable SSE and local telemetry are now runnable.</small></div><span class="q-status q-status--simulated">local</span></div></div>`;document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>{closeDialog(dialog);dialog.remove();});openDialog(dialog);
}

async function testStream(){
  try{const response=await fetch(apiUrl('/api/v1/stream/quotes?frames=3&intervalMs=20'),{credentials:'include'});const text=await response.text();const frames=text.split('\n').filter((entry)=>entry.startsWith('data: ')).map((entry)=>JSON.parse(entry.slice(6))).filter((frame)=>frame.sequence);const frame=frames.at(-1);toast(`Simulated stream received through sequence ${frame.sequence} with ${frames.length} frames`,{tone:'success'});}catch(error){toast(`Stream test failed: ${error.message}`,{tone:'danger'});}
}

async function persistPreference(patch) {
  state.prefs={...state.prefs,...patch};
  state.prefs=await api('/api/v1/preferences/layout',{method:'PUT',body:JSON.stringify(state.prefs)});
  applyPreferences();
  return state.prefs;
}

function loadingPage(title='Loading route'){return `<section class="q-page">${pageHead('Loading',title,'Preparing the requested workspace while preserving stable layout geometry.')}<div class="q-skeleton-grid">${Array.from({length:4},()=>'<span class="q-skeleton is-large"></span>').join('')}</div><div class="q-dashboard-grid" style="margin-top:var(--q-gap)"><span class="q-skeleton" style="height:420px"></span><span class="q-skeleton" style="height:420px"></span></div><span class="q-skeleton" style="height:320px"></span></section>`}
function emptyPage(){return `<section class="q-page">${pageHead('Validation state','Empty state','The route has no matching data and does not invent a zero-value result.')}<div class="q-empty-state"><div><span>◇</span><h2>No eligible records</h2><p>Adjust filters, connect an entitled source, or return to the default fixture state.</p><button class="q-button q-button--primary" data-reset-state>Return to default</button></div></div></section>`}
function errorPage(title,description,type='error'){return `<section class="q-page">${pageHead('Validation state',title,description)}<div class="q-empty-state q-error-state"><div><span>${type==='offline'?'⌁':'!'}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><button class="q-button q-button--primary" data-retry>Retry foundation route</button></div></div></section>`}
function bindRetry(){document.querySelector('[data-retry]')?.addEventListener('click',()=>{state.previewState='default';document.getElementById('state-selector').value='default';renderRoute();});}
function formatCompact(value){return new Intl.NumberFormat('en-US',{notation:'compact',style:'currency',currency:'USD',maximumFractionDigits:2}).format(value)}
function formatKpi(value,unit){const number=Number(value);if(unit==='USD-trillion')return `$${number.toFixed(2)}T`;if(unit==='percent')return `${number.toFixed(0)}%`;if(unit==='index')return number.toFixed(0);if(unit==='USD')return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(number);if(unit==='decimals')return `${number}`;return `${value} ${unit??''}`.trim()}
function escapeAttribute(value){return escapeHtml(value).replace(/`/g,'&#96;')}
function downloadJson(filename,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),100);toast('Validated JSON exported',{tone:'success'});}
function luminance(hex){const values=hex.replace('#','').match(/.{2}/g).map((item)=>parseInt(item,16)/255).map((value)=>value<=.03928?value/12.92:((value+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2]}
function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}

boot().catch((error)=>{document.getElementById('main').innerHTML=errorPage('Qelly foundation failed to start',error.message);console.error(error);});
