const officialSymbol=new URL('../brand/qelly-symbol.svg',import.meta.url).href;
const CLUSTERS=[
  {name:'Discover',copy:'Universal search, rankings, categories, venues, DEX, converter, global charts, news and trust.',routes:['discovery-hub','asset-rankings','search','categories','venues','dex-discovery','global-charts','converter','news-research','trust-center']},
  {name:'Analyse',copy:'Market charts, technicals, fundamentals, estimates, filings, events, peers and comparisons.',routes:['market','asset-intelligence','advanced-chart','fundamentals-estimates','filing-workspace','event-calendar','comparison-lab','asset']},
  {name:'Operate',copy:'Watchlists, alerts, notifications, screeners, portfolios, research, imports and schedules.',routes:['watchlist','alert-center','notification-center','screener-lab','formula-screener','portfolio-analytics','portfolio-attribution','research-workspace','research-history','import-center','notification-schedules','onboarding','rankings']},
  {name:'Control',copy:'Identity, providers, instruments, time series, streams, observability, security and migration.',routes:['identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations','observability','security-evidence','migration-center','theme-lab']},
  {name:'Brand',copy:'Theme personas, About Qelly and the mapped modular feature overview.',routes:['theme-personas','about-qelly','feature-universe']}
];
const FEATURE_UNIVERSE_MODULE_COUNT=CLUSTERS.reduce((total,cluster)=>total+cluster.routes.length,0);
let featureUniverseDensityMain=null;
let featureUniverseDensityMedia=null;
let featureUniverseDensityListenerBound=false;

const MOBILE_PRESENTATION=[
  ['.q-page-head',{'display':'block','min-height':'0','width':'auto','max-width':'none','margin':'0 0 8px','padding':'8px 2px 10px','background':'none','color':'var(--q-text)','border-radius':'0','box-shadow':'none','overflow':'visible'}],
  ['.q-page-head h1',{'font-size':'24px','line-height':'1.06','margin':'3px 0 5px','color':'var(--q-text)','transform':'none'}],
  ['.q-page-head p',{'font-size':'11px','line-height':'1.45','color':'var(--q-muted)'}],
  ['.q-page-actions',{'justify-content':'flex-start','margin-top':'8px','padding':'0'}],
  ['.q-state-banner',{'margin-bottom':'8px','min-height':'0','padding':'7px 10px'}],
  ['.q-universe-hero',{'min-height':'0','margin-bottom':'10px','padding':'14px 0 12px','border-radius':'24px'}],
  ['.q-universe-core',{'position':'relative','left':'auto','top':'auto','transform':'none','width':'132px','height':'132px','margin':'6px auto 12px'}],
  ['.q-universe-core img',{'width':'50px','height':'50px'}],
  ['.q-universe-core strong',{'font-size':'36px'}],
  ['.q-universe-journey',{'display':'flex','gap':'7px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding':'0 12px 3px'}],
  ['.q-universe-node',{'position':'relative','left':'auto','top':'auto','transform':'none','flex':'0 0 min(68vw,210px)','width':'auto','min-height':'62px','margin':'0','scroll-snap-align':'start'}],
  ['.q-universe-clusters',{'gap':'10px'}],
  ['.q-universe-cluster',{'display':'block','padding':'14px','border-radius':'22px'}],
  ['.q-universe-cluster>header',{'margin-bottom':'9px'}],
  ['.q-universe-cluster h2',{'font-size':'23px','margin':'4px 0'}],
  ['.q-universe-cluster header p:not(.q-eyebrow)',{'margin':'0','font-size':'9px','line-height':'1.5'}],
  ['.q-universe-route-grid',{'display':'flex','gap':'7px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding-bottom':'3px'}],
  ['.q-universe-route-grid button',{'flex':'0 0 min(72vw,240px)','min-height':'72px','padding':'11px','scroll-snap-align':'start'}],
  ['.q-capability-ribbon',{'margin-top':'10px'}],
  ['.q-capability-ribbon .q-panel-body',{'display':'flex','gap':'7px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding':'10px'}],
  ['.q-capability-ribbon .q-panel-body>div',{'flex':'0 0 min(72vw,240px)','padding':'11px','scroll-snap-align':'start'}]
];

function setPresentation(element,styles,active){
  if(!element)return;
  for(const [name,value] of Object.entries(styles)){
    if(active)element.style.setProperty(name,value,'important');
    else element.style.removeProperty(name);
  }
}

function applyFeatureUniverseDensity(main=featureUniverseDensityMain){
  if(!main)return;
  featureUniverseDensityMain=main;
  if(!featureUniverseDensityMedia&&typeof globalThis.matchMedia==='function')featureUniverseDensityMedia=globalThis.matchMedia('(max-width: 768px)');
  const active=Boolean(featureUniverseDensityMedia?.matches);
  const page=main.querySelector('.q-feature-universe');
  if(!page)return;
  for(const [selector,styles] of MOBILE_PRESENTATION){
    page.querySelectorAll(selector).forEach((element)=>setPresentation(element,styles,active));
  }
  page.dataset.mobileDensity=active?'active':'desktop';
  document.documentElement.dataset.featureUniverseDensity=active?'active':'desktop';
  if(featureUniverseDensityMedia&&!featureUniverseDensityListenerBound){
    featureUniverseDensityListenerBound=true;
    featureUniverseDensityMedia.addEventListener?.('change',()=>applyFeatureUniverseDensity());
  }
}

export async function renderFeatureUniverse(main,deps){
  const {pageHead,stateBanner,escapeHtml,navigate}=deps;
  main.innerHTML=`<section class="q-page q-feature-universe">
    ${pageHead('Qelly product architecture','Explore the Qelly intelligence universe','Every mapped product module is positioned inside a coherent journey: discover → analyse → monitor → decide → evidence. Explore the modular system without losing context.',`<button class="q-button q-button--ghost" data-action="about-qelly">About Qelly</button><button class="q-button q-button--primary" data-action="open-market">Open market overview</button>`)}
    ${stateBanner()}
    <section class="q-universe-hero" aria-labelledby="q-universe-title">
      <div class="q-universe-core"><img src="${officialSymbol}" alt="" width="72" height="72" aria-hidden="true"><strong id="q-universe-title">${FEATURE_UNIVERSE_MODULE_COUNT}</strong><small>mapped modules</small></div>
      <div class="q-universe-journey" aria-label="Qelly intelligence journey">${CLUSTERS.map((cluster,index)=>`<button class="q-universe-node" style="--i:${index}" data-cluster="${escapeHtml(cluster.name)}"><strong>${escapeHtml(cluster.name)}</strong><span>${cluster.routes.length} modules</span></button>`).join('')}</div>
    </section>
    <div class="q-universe-clusters">${CLUSTERS.map((cluster,index)=>`<section class="q-universe-cluster"><header><div><span>${String(index+1).padStart(2,'0')}</span><p class="q-eyebrow">${cluster.routes.length} modules</p><h2>${escapeHtml(cluster.name)}</h2><p>${escapeHtml(cluster.copy)}</p></div><button class="q-icon-button" data-open-first="${cluster.routes[0]}" aria-label="Open ${escapeHtml(cluster.name)}">↗</button></header><div class="q-universe-route-grid">${cluster.routes.map((route,routeIndex)=>`<button data-route-target="${route}"><span>${String(routeIndex+1).padStart(2,'0')}</span><strong>${escapeHtml(route.replaceAll('-',' '))}</strong><small>Open module ↗</small></button>`).join('')}</div></section>`).join('')}</div>
    <section class="q-panel q-capability-ribbon"><div class="q-panel-body"><div><span>DATA</span><strong>Governed public demo + explicit provider state</strong></div><div><span>CHARTS</span><strong>Deterministic market visualization</strong></div><div><span>STATE</span><strong>User and workspace scoped</strong></div><div><span>SAFETY</span><strong>No execution or custody</strong></div></div></section>
  </section>`;
  applyFeatureUniverseDensity(main);
  main.querySelector('[data-action="about-qelly"]').addEventListener('click',()=>navigate('about-qelly'));
  main.querySelector('[data-action="open-market"]').addEventListener('click',()=>navigate('market'));
  main.querySelectorAll('[data-route-target]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.routeTarget)));
  main.querySelectorAll('[data-open-first]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.openFirst)));
}
