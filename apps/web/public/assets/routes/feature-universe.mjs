const officialSymbol=new URL('../brand/qelly-symbol.svg',import.meta.url).href;
const FEATURE_UNIVERSE_STYLESHEET=new URL('../feature-universe-density.css',import.meta.url).href;
const CLUSTERS=[
  {name:'Discover',copy:'Universal search, rankings, categories, venues, DEX, converter, global charts, news and trust.',routes:['discovery-hub','asset-rankings','search','categories','venues','dex-discovery','global-charts','converter','news-research','trust-center']},
  {name:'Analyse',copy:'Market charts, technicals, fundamentals, estimates, filings, events, peers and comparisons.',routes:['market','asset-intelligence','advanced-chart','fundamentals-estimates','filing-workspace','event-calendar','comparison-lab','asset']},
  {name:'Operate',copy:'Watchlists, alerts, notifications, screeners, portfolios, research, imports and schedules.',routes:['watchlist','alert-center','notification-center','screener-lab','formula-screener','portfolio-analytics','portfolio-attribution','research-workspace','research-history','import-center','notification-schedules','onboarding','rankings']},
  {name:'Control',copy:'Identity, providers, instruments, time series, streams, observability, security and migration.',routes:['identity-access','data-mesh','instrument-master','timeseries-lab','stream-operations','observability','security-evidence','migration-center','theme-lab']},
  {name:'Brand',copy:'Theme personas, About Qelly and the mapped modular feature overview.',routes:['theme-personas','about-qelly','feature-universe']}
];
const FEATURE_UNIVERSE_MODULE_COUNT=CLUSTERS.reduce((total,cluster)=>total+cluster.routes.length,0);
let featureUniverseStylePromise;

function ensureFeatureUniverseStyles(){
  if(featureUniverseStylePromise)return featureUniverseStylePromise;
  featureUniverseStylePromise=new Promise((resolve)=>{
    const root=document.documentElement;
    let settled=false;
    const finish=(state)=>{
      if(settled)return;
      settled=true;
      root.dataset.featureUniverseDensity=state;
      resolve();
    };
    const existing=document.querySelector('link[data-qelly-feature-universe-density="active"]');
    if(existing){
      if(existing.sheet){finish('active');return;}
      existing.addEventListener('load',()=>finish('active'),{once:true});
      existing.addEventListener('error',()=>finish('unavailable'),{once:true});
      setTimeout(()=>finish('timeout'),2000);
      return;
    }
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=FEATURE_UNIVERSE_STYLESHEET;
    link.dataset.qellyFeatureUniverseDensity='active';
    link.addEventListener('load',()=>finish('active'),{once:true});
    link.addEventListener('error',()=>finish('unavailable'),{once:true});
    document.head.append(link);
    setTimeout(()=>finish('timeout'),2000);
  });
  return featureUniverseStylePromise;
}

export async function renderFeatureUniverse(main,deps){
  await ensureFeatureUniverseStyles();
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
  main.querySelector('[data-action="about-qelly"]').addEventListener('click',()=>navigate('about-qelly'));
  main.querySelector('[data-action="open-market"]').addEventListener('click',()=>navigate('market'));
  main.querySelectorAll('[data-route-target]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.routeTarget)));
  main.querySelectorAll('[data-open-first]').forEach((button)=>button.addEventListener('click',()=>navigate(button.dataset.openFirst)));
}
