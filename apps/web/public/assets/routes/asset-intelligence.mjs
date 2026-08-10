const ASSET_INTELLIGENCE_MOBILE_PRESENTATION=Object.freeze([
  Object.freeze({selector:'.q-kpi-grid',styles:Object.freeze([
    ['grid-template-columns','repeat(2,minmax(0,1fr))'],['gap','10px'],['margin-bottom','10px']
  ])}),
  Object.freeze({selector:'.q-kpi',styles:Object.freeze([
    ['min-height','0'],['padding','12px']
  ])}),
  Object.freeze({selector:'.q-kpi-value',styles:Object.freeze([
    ['font-size','21px'],['margin','9px 0 6px']
  ])}),
  Object.freeze({selector:'.q-kpi-meta',styles:Object.freeze([
    ['align-items','flex-start'],['flex-wrap','wrap']
  ])}),
  Object.freeze({selector:'.q-metric-grid',styles:Object.freeze([
    ['grid-template-columns','repeat(2,minmax(0,1fr))'],['gap','8px'],['padding','10px']
  ])}),
  Object.freeze({selector:'.q-metric-card',styles:Object.freeze([
    ['min-height','0'],['padding','12px'],['gap','5px']
  ])}),
  Object.freeze({selector:'.q-metric-card strong',styles:Object.freeze([
    ['font-size','18px']
  ])}),
  Object.freeze({selector:'.q-gate-grid',styles:Object.freeze([
    ['grid-template-columns','repeat(2,minmax(0,1fr))'],['gap','8px'],['padding','10px']
  ])}),
  Object.freeze({selector:'.q-gate-grid article',styles:Object.freeze([
    ['min-height','0'],['padding','11px'],['gap','6px']
  ])}),
  Object.freeze({selector:'.q-gate-grid span',styles:Object.freeze([
    ['line-height','1.45']
  ])})
]);

let assetIntelligenceDensityMedia=null;
let assetIntelligenceDensityPage=null;

function setAssetIntelligenceStyle(node,property,value,active){
  if(active) node.style.setProperty(property,value,'important');
  else node.style.removeProperty(property);
}

function applyAssetIntelligenceDensity(){
  const page=assetIntelligenceDensityPage;
  if(!page?.isConnected) return;
  const active=Boolean(assetIntelligenceDensityMedia?.matches);
  ASSET_INTELLIGENCE_MOBILE_PRESENTATION.forEach(({selector,styles})=>{
    page.querySelectorAll(selector).forEach((node)=>{
      styles.forEach(([property,value])=>setAssetIntelligenceStyle(node,property,value,active));
    });
  });
  page.dataset.assetIntelligenceDensity=active?'mobile-grid':'desktop-default';
}

function installAssetIntelligenceDensity(page){
  assetIntelligenceDensityPage=page;
  if(!assetIntelligenceDensityMedia){
    assetIntelligenceDensityMedia=window.matchMedia('(max-width: 620px)');
    assetIntelligenceDensityMedia.addEventListener?.('change',applyAssetIntelligenceDensity);
  }
  applyAssetIntelligenceDensity();
}

export async function renderAssetIntelligence(main, deps) {
  const { api, pageHead, stateBanner, escapeHtml, QellyChartShell, QellyDataGrid, formatCompact, toast } = deps;
  const assets=[['QI-CRYPTO-BTC','BTC'],['QI-CRYPTO-ETH','ETH'],['QI-EQUITY-AAPL','AAPL'],['QI-EQUITY-NVDA','NVDA']];
  const selected=deps.asset && assets.some(([id,symbol])=>id===deps.asset||symbol===deps.asset)?assets.find(([id,symbol])=>id===deps.asset||symbol===deps.asset)[0]:'QI-EQUITY-AAPL';
  const [overview,fundamentals,events,filings,peers,studies,technicals]=await Promise.all([
    api(`/api/v1/asset-intelligence/${selected}/overview`),api(`/api/v1/asset-intelligence/${selected}/fundamentals`),api(`/api/v1/asset-intelligence/${selected}/events`),api(`/api/v1/asset-intelligence/${selected}/filings`),api(`/api/v1/asset-intelligence/${selected}/peers`),api('/api/v1/asset-intelligence/studies'),api(`/api/v1/asset-intelligence/${selected}/technicals?study=sma&length=20`)
  ]);
  const metricEntries=Object.entries(fundamentals.metrics);
  main.innerHTML=`<section class="q-page q-asset-intelligence-page">${pageHead('Qelly Intelligence · Contract-first runnable slice','Asset Intelligence Workspace','A hardened local asset-level workspace for profile, comparable metrics, events, filings, peers and deterministic technical studies. Licensed fundamentals, live filings and investment advice remain disabled.',`<select id="asset-intelligence-selector" class="q-inline-select" aria-label="Select asset">${assets.map(([id,symbol])=>`<option value="${id}" ${id===selected?'selected':''}>${symbol}</option>`).join('')}</select><button class="q-button q-button--secondary" data-action="compare-assets">Compare core assets</button><button class="q-button q-button--primary" data-action="inspect-wave6">Inspect truth boundary</button>`)}${stateBanner()}
  <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Instrument</div><div class="q-kpi-value">${escapeHtml(overview.symbol)}</div><div class="q-kpi-meta"><span>${escapeHtml(overview.assetClass)}</span><span class="q-status q-status--simulated">local</span></div></article><article class="q-kpi"><div class="q-kpi-label">Price fixture</div><div class="q-kpi-value">${overview.quote.price.value==null?'N/A':escapeHtml(overview.quote.price.value)}</div><div class="q-kpi-meta"><span>${escapeHtml(overview.quote.price.unit)}</span><span class="q-status q-status--simulated">simulated</span></div></article><article class="q-kpi"><div class="q-kpi-label">Metric coverage</div><div class="q-kpi-value">${metricEntries.length}</div><div class="q-kpi-meta"><span>asset-class aware</span><span class="q-status q-status--cached">contract</span></div></article><article class="q-kpi"><div class="q-kpi-label">Study catalog</div><div class="q-kpi-value">${studies.items.length}</div><div class="q-kpi-meta"><span>${studies.items.filter((item)=>item.implementedLocally).length} executable locally</span><span class="q-status q-status--cached">subset</span></div></article></div>
  <div class="q-dashboard-grid"><div id="asset-intelligence-chart"></div><section class="q-panel"><div class="q-panel-head"><div><h2>Profile and coverage</h2><p>${escapeHtml(overview.name)}</p></div><span class="q-status q-status--simulated">fixture</span></div><div class="q-panel-body"><p class="q-muted-copy">${escapeHtml(overview.profile.description)}</p><div class="q-context-block"><dl><dt>Sector</dt><dd>${escapeHtml(overview.profile.sector)}</dd><dt>Industry</dt><dd>${escapeHtml(overview.profile.industry)}</dd><dt>Country</dt><dd>${escapeHtml(overview.profile.country)}</dd><dt>Market status</dt><dd>${escapeHtml(overview.profile.marketStatus)}</dd><dt>Licensed fundamentals</dt><dd>${fundamentals.licensedProviderRequired?'required':'not required for fixture'}</dd><dt>Statement data</dt><dd>${fundamentals.statementDataDeferred?'deferred':'available'}</dd></dl></div></div></section></div>
  <section class="q-panel"><div class="q-panel-head"><div><h2>Comparable metrics</h2><p>Values preserve units, sources, freshness and quality flags.</p></div><span class="q-status q-status--cached">${metricEntries.length} metrics</span></div><div class="q-metric-grid">${metricEntries.map(([key,value])=>`<article class="q-metric-card"><span>${escapeHtml(key.replace(/([A-Z])/g,' $1'))}</span><strong>${value.value==null?'N/A':escapeHtml(value.value)}</strong><small>${escapeHtml(value.unit)} · ${escapeHtml(value.freshnessClass)}</small></article>`).join('')||'<div class="q-empty-state"><div><h2>No comparable metrics</h2><p>This asset class requires a specialized provider contract.</p></div></div>'}</div></section>
  <div class="q-two-column"><section class="q-panel"><div class="q-panel-head"><div><h2>Events and filings</h2><p>Deterministic calendar and regulatory-reference contracts</p></div><span class="q-status q-status--simulated">not live</span></div><div class="q-panel-body q-stack">${events.items.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.date)} · ${escapeHtml(item.type)}</small></span><span class="q-status q-status--cached">${escapeHtml(item.status)}</span></div>`).join('')||'<p class="q-muted-copy">No fixture events.</p>'}${filings.items.map((item)=>`<div class="q-record-row"><span><strong>${escapeHtml(item.form)} · ${escapeHtml(item.filingId)}</strong><small>${escapeHtml(item.filedAt)} · document content unavailable</small></span><span class="q-status q-status--unavailable">reference only</span></div>`).join('')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Peer set</h2><p>${escapeHtml(peers.methodology)}</p></div><span class="q-status q-status--cached">${peers.items.length} peers</span></div><div id="asset-peer-grid"></div></section></div>
  <section class="q-panel"><div class="q-panel-head"><div><h2>Production gates</h2><p>Architecture is explicit; unsupported capabilities remain unavailable.</p></div><span class="q-status q-status--warning">contract-first</span></div><div class="q-gate-grid"><article><strong>Advanced charting</strong><span>candlesticks, drawings, panes, replay and saved layouts deferred</span></article><article><strong>Fundamentals</strong><span>licensed statements, estimates, revisions and ownership deferred</span></article><article><strong>Filings</strong><span>live regulatory ingestion, parsing and citations deferred</span></article><article><strong>Advice boundary</strong><span>no recommendations, orders, trading or execution</span></article></div></section></section>`;
  const page=main.querySelector('.q-asset-intelligence-page');
  installAssetIntelligenceDensity(page);
  const chartSeries=technicals.points.filter((point)=>point.value!=null).map((point)=>({label:point.at.slice(0,10),value:Number(point.value)}));
  new QellyChartShell(document.getElementById('asset-intelligence-chart'),{title:`${overview.symbol} · SMA(${technicals.parameters.length})`,series:chartSeries,metadata:{source:'Qelly deterministic technical-study engine',observedAt:chartSeries.at(-1)?.label??'N/A',receivedAt:new Date().toISOString(),freshnessClass:'simulated',confidence:.84},currency:overview.quote.price.unit==='USD'?'USD':'USD'});
  new QellyDataGrid(document.getElementById('asset-peer-grid'),{columns:[{key:'symbol',label:'Symbol',width:90},{key:'name',label:'Peer',width:190},{key:'assetClass',label:'Class',width:100},{key:'price',label:'Price',width:110,numeric:true},{key:'change24h',label:'24h',width:90,format:'change'},{key:'marketCap',label:'Market value',width:135,numeric:true,render:(row)=>row.marketCap==null?'N/A':formatCompact(row.marketCap)},{key:'similarity',label:'Similarity',width:100,numeric:true,render:(row)=>`${Math.round(row.similarity*100)}%`}],rows:peers.items,caption:'Asset intelligence peer comparison',density:'compact',selectable:false});
  document.getElementById('asset-intelligence-selector').addEventListener('change',(event)=>deps.navigate('asset-intelligence',event.target.value));
  main.querySelector('[data-action="inspect-wave6"]').addEventListener('click',()=>deps.openEvidence('Truth boundary',{overview:overview.truth,studies:studies.truth,filingsLive:filings.liveRegulatoryIngestion},'Local contract foundation'));
  main.querySelector('[data-action="compare-assets"]').addEventListener('click',async()=>{const comparison=await api('/api/v1/asset-intelligence/compare',{method:'POST',body:JSON.stringify({canonicalIds:assets.map(([id])=>id)})});deps.openEvidence('Cross-asset comparison contract',comparison,'Asset-class-aware local comparison');toast('Comparison contract generated',{tone:'success'});});
}