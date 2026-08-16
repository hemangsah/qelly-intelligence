const WORKFLOWS=[
  {route:'market',eyebrow:'Markets',title:'Market overview',copy:'Cross-asset conditions, ranked observations and explicit freshness in one research surface.'},
  {route:'asset-rankings',eyebrow:'Discovery',title:'Asset rankings',copy:'Compare the available universe with methodology, source state and coverage boundaries.'},
  {route:'asset',eyebrow:'Research',title:'Asset intelligence',copy:'Move from price context to charts, evidence, related events and reproducible analysis.'},
  {route:'calculator-center',eyebrow:'Quant tools',title:'Calculator workspace',copy:'Run versioned calculations, understand inputs and preserve reproducible results.'},
  {route:'india-finance',eyebrow:'India',title:'India finance tools',copy:'SIP and market calculations with effective-date rules and transparent methodology.'},
  {route:'formula-library',eyebrow:'Methods',title:'Formula library',copy:'Browse documented formulas and inspect assumptions before using them in a workflow.'},
  {route:'saved-calculations',eyebrow:'Workspace',title:'Saved work',copy:'Return to calculation history, revisions and reusable research inputs.'},
  {route:'qelly-verify',eyebrow:'Evidence',title:'Qelly Verify',copy:'Inspect the source chain and verification evidence behind a Qelly result.'}
];

const PRINCIPLES=[
  ['Source-aware','Every observation exposes provider and availability state.'],
  ['Reproducible','Calculations preserve inputs, method version and result history.'],
  ['Read-only by design','The public terminal does not execute trades or hold assets.'],
  ['Coverage before claims','A market is displayed only within its approved data boundary.']
];

const officialSymbol=new URL('../brand/qelly-symbol.svg',import.meta.url).href;
const CLUSTERS=[
  {name:'Discover',copy:'Search, rankings, categories, venues, global charts, news and market trust.',routes:['discovery-hub','asset-rankings','search','categories','venues','dex-discovery','global-charts','converter','news-research','trust-center']},
  {name:'Analyse',copy:'Market charts, technicals, fundamentals, estimates, filings, events, peers and comparisons.',routes:['market','asset-intelligence','advanced-chart','fundamentals-estimates','filing-workspace','event-calendar','comparison-lab','asset']},
  {name:'Monitor',copy:'Watchlists, alerts, screeners, portfolios, research, imports and scheduled updates.',routes:['watchlist','alert-center','notification-center','screener-lab','formula-screener','portfolio-analytics','portfolio-attribution','research-workspace','research-history','import-center','notification-schedules','onboarding','rankings']},
  {name:'Govern',copy:'Identity, data sources, instruments, time series, security, operations and appearance.',routes:['identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations','observability','security-evidence','migration-center','theme-lab']},
  {name:'About',copy:'Product principles, appearance personas and the complete feature directory.',routes:['theme-personas','about-qelly','feature-universe']}
];
const FEATURE_UNIVERSE_MODULE_COUNT=CLUSTERS.reduce((total,cluster)=>total+cluster.routes.length,0);
let featureUniverseDensityMain=null;
let featureUniverseDensityMedia=null;
let featureUniverseDensityListenerBound=false;

const MOBILE_PRESENTATION=[
  ['.q-page-head',{'display':'block','min-height':'0','width':'auto','max-width':'none','margin':'0 0 8px','padding':'8px 2px 10px','overflow':'visible'}],
  ['.q-page-head h1',{'font-size':'26px','line-height':'1.08','margin':'3px 0 5px'}],
  ['.q-page-head p',{'font-size':'14px','line-height':'1.5'}],
  ['.q-universe-hero',{'min-height':'0','margin-bottom':'10px','padding':'14px 0 12px'}],
  ['.q-universe-core',{'position':'relative','left':'auto','top':'auto','transform':'none','width':'132px','height':'132px','margin':'6px auto 12px'}],
  ['.q-universe-core img',{'width':'48px','height':'48px'}],
  ['.q-universe-journey',{'display':'flex','gap':'8px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding':'0 12px 5px'}],
  ['.q-universe-node',{'position':'relative','left':'auto','top':'auto','transform':'none','flex':'0 0 min(72vw,240px)','width':'auto','min-height':'72px','scroll-snap-align':'start'}],
  ['.q-universe-clusters',{'display':'grid','grid-template-columns':'minmax(0,1fr)','gap':'10px'}],
  ['.q-universe-cluster',{'display':'block','padding':'14px'}],
  ['.q-universe-cluster:last-child',{'grid-column':'auto'}],
  ['.q-universe-cluster header p:not(.q-eyebrow)',{'margin':'0','font-size':'13px','line-height':'1.5'}],
  ['.q-universe-route-grid',{'display':'flex','gap':'7px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding-bottom':'3px'}],
  ['.q-universe-route-grid button',{'flex':'0 0 min(76vw,260px)','min-height':'82px','padding':'12px','scroll-snap-align':'start'}],
  ['.q-capability-ribbon .q-panel-body',{'display':'flex','gap':'7px','overflow-x':'auto','overscroll-behavior-inline':'contain','scroll-snap-type':'x proximity','padding':'10px'}],
  ['.q-capability-ribbon .q-panel-body>div',{'flex':'0 0 min(76vw,260px)','min-height':'72px','padding':'12px','scroll-snap-align':'start'}]
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
  for(const [selector,styles] of MOBILE_PRESENTATION)page.querySelectorAll(selector).forEach((element)=>setPresentation(element,styles,active));
  page.dataset.mobileDensity=active?'active':'desktop';
  document.documentElement.dataset.featureUniverseDensity=active?'active':'desktop';
  if(featureUniverseDensityMedia&&!featureUniverseDensityListenerBound){
    featureUniverseDensityListenerBound=true;
    featureUniverseDensityMedia.addEventListener?.('change',()=>applyFeatureUniverseDensity());
  }
}

export async function renderFeatureUniverse(main,deps){
  const {pageHead,escapeHtml,navigate}=deps;
  main.innerHTML=`<section class="q-page q-feature-universe">
    ${pageHead('Qelly Intelligence','Your market research workspace','Discover markets, inspect assets, run quantitative tools and verify the evidence behind each result.',`<button class="q-button" data-home-action="verify">Verify a result</button><button class="q-button q-button--primary" data-home-action="market">Explore markets</button>`)}

    <section class="q-home-hero" aria-label="Qelly workspace introduction">
      <article class="q-home-lead">
        <span class="q-eyebrow">Evidence-backed market intelligence</span>
        <h2>Move from market signal to a decision you can explain.</h2>
        <p>Qelly connects discovery, analysis, calculations and source evidence in a focused workspace. Data availability is stated directly; unavailable or indicative observations are never presented as licensed live data.</p>
        <div class="q-home-actions">
          <button class="q-button q-button--primary" data-route-target="market">Open market overview</button>
          <button class="q-button" data-route-target="calculator-center">Run a calculation</button>
          <button class="q-button q-button--ghost" data-route-target="about-qelly">How Qelly works</button>
        </div>
      </article>
      <aside class="q-home-status" aria-label="Product availability">
        <div><span class="q-eyebrow">Workspace status</span><h2>Research mode</h2><p>Source-aware, read-only and evidence-first.</p></div>
        <div class="q-home-status-row"><span>Market observations</span><strong>Rights and freshness shown per source</strong></div>
        <div class="q-home-status-row"><span>Calculations</span><strong>Reproducible and versioned</strong></div>
        <div class="q-home-status-row"><span>Trading and custody</span><strong>Not provided</strong></div>
        <div class="q-home-status-row"><span>Account</span><strong>Optional for public research</strong></div>
      </aside>
    </section>

    <section class="q-home-section" aria-labelledby="q-home-workflows">
      <header><div><h2 id="q-home-workflows">Start a workflow</h2><p>Focused destinations for markets, tools and evidence.</p></div></header>
      <div class="q-home-grid">${WORKFLOWS.map((item)=>`<button class="q-home-card" data-route-target="${escapeHtml(item.route)}"><span>${escapeHtml(item.eyebrow)}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.copy)}</p></div><small>Open workspace →</small></button>`).join('')}</div>
    </section>

    <section class="q-home-section" aria-labelledby="q-home-principles">
      <header><div><h2 id="q-home-principles">Built for explainable research</h2><p>The interface separates product availability, data rights and analytical evidence.</p></div></header>
      <div class="q-home-principles">${PRINCIPLES.map(([title,copy])=>`<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></div>`).join('')}</div>
    </section>

    <section class="q-home-section q-product-directory" aria-labelledby="q-product-directory">
      <header><div><h2 id="q-product-directory">Complete product directory</h2><p>${FEATURE_UNIVERSE_MODULE_COUNT} mapped destinations, grouped by research task.</p></div></header>
      <section class="q-universe-hero" aria-label="Product directory overview">
        <div class="q-universe-core"><img src="${officialSymbol}" alt="" width="48" height="48" aria-hidden="true"><strong>${FEATURE_UNIVERSE_MODULE_COUNT}</strong><small>mapped modules</small></div>
        <div class="q-universe-journey">${CLUSTERS.map((cluster)=>`<button class="q-universe-node" data-cluster="${escapeHtml(cluster.name)}"><strong>${escapeHtml(cluster.name)}</strong><span>${cluster.routes.length} modules</span></button>`).join('')}</div>
      </section>
      <div class="q-universe-clusters">${CLUSTERS.map((cluster,index)=>`<section class="q-universe-cluster" id="q-universe-${cluster.name.toLowerCase()}"><header><div><span>${String(index+1).padStart(2,'0')}</span><p class="q-eyebrow">${cluster.routes.length} destinations</p><h2>${escapeHtml(cluster.name)}</h2><p>${escapeHtml(cluster.copy)}</p></div><button class="q-icon-button" data-open-first="${cluster.routes[0]}" aria-label="Open ${escapeHtml(cluster.name)}">↗</button></header><div class="q-universe-route-grid">${cluster.routes.map((route)=>`<button data-route-target="${route}"><strong>${escapeHtml(route.replaceAll('-',' '))}</strong><small>Open workspace →</small></button>`).join('')}</div></section>`).join('')}</div>
      <section class="q-panel q-capability-ribbon"><div class="q-panel-body"><div><span>DATA</span><strong>Source and freshness visible</strong></div><div><span>CHARTS</span><strong>Cross-asset research views</strong></div><div><span>WORKSPACE</span><strong>Saved and versioned research</strong></div><div><span>SAFETY</span><strong>Read-only; no trading or custody</strong></div></div></section>
    </section>
  </section>`;
  applyFeatureUniverseDensity(main);
  main.querySelector('[data-home-action="verify"]')?.addEventListener('click',()=>navigate('qelly-verify'));
  main.querySelector('[data-home-action="market"]')?.addEventListener('click',()=>navigate('market'));
  main.querySelectorAll('[data-route-target]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.routeTarget)));
  main.querySelectorAll('[data-open-first]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.openFirst)));
  main.querySelectorAll('[data-cluster]').forEach((button)=>button.addEventListener('click',()=>main.querySelector(`#q-universe-${button.dataset.cluster.toLowerCase()}`)?.scrollIntoView({behavior:'smooth',block:'start'})));
}
