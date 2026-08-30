import {mountTradingViewDisplay} from '../market/tradingview-display-widget.mjs';

const CHART_PRESETS=[
  ['BTCUSDT','Bitcoin / USD','Crypto'],['ETHUSDT','Ethereum / USD','Crypto'],['SOLUSDT','Solana / USD','Crypto'],
  ['XAUUSD','Gold / USD','Metals'],['XAGUSD','Silver / USD','Metals'],
  ['EURUSD','EUR / USD','FX'],['GBPUSD','GBP / USD','FX'],['USDJPY','USD / JPY','FX'],['USDINR','USD / INR','FX'],
  ['SPX','S&P 500','United States'],['NDX','Nasdaq 100','United States'],['NIFTY','Nifty 50','India'],['SENSEX','Sensex','India'],
  ['HSI','Hang Seng','Hong Kong'],['NI225','Nikkei 225','Japan'],['DXY','U.S. Dollar Index','Macro'],['USOIL','WTI crude oil','Energy']
];
const INTERVALS=['5m','15m','1h','4h','1d','1w'];
const cssHref=new URL('./market-network.css?v=20260830-network2',import.meta.url).href;
const v2CssHref=new URL('./market-network-v2.css?v=20260830-network2',import.meta.url).href;

const VIEWS={
  scan:{label:'Scan breadth',title:'See whether a move is broad or isolated.',copy:'Start with the cross-asset display and live source board. Use the observation as a research lead, then confirm its source state.'},
  compare:{label:'Compare sources',title:'Challenge one observation with an independent source.',copy:'Use the source comparison and macro cross-checks to expose differences in cadence, market construction and publication method.'},
  audit:{label:'Audit freshness',title:'Decide whether the evidence is current enough for the question.',copy:'Inspect observed time, fetch time, edge-cache state, cadence and permitted use before carrying evidence into research.'}
};
const GUIDES={
  'cross-asset':{
    title:'Cross-asset breadth check',
    summary:'Test whether crypto, FX, metals and equity-index direction agree.',
    steps:['Choose the instrument closest to the original market question.','Compare the chart direction with the source-backed board.','Check whether the move appears in another asset class.','Audit timestamps and cadence before recording a conclusion.'],
    nextRoute:'research-workspace',
    nextLabel:'Build a research dossier'
  },
  risk:{
    title:'Risk-state check',
    summary:'Separate a broad risk regime from a single-market story.',
    steps:['Read the attributed sentiment reference.','Compare independent BTC observations and note the source difference.','Check provider availability and delayed or cached states.','Record uncertainty instead of replacing missing evidence with an estimate.'],
    nextRoute:'decision-provenance',
    nextLabel:'Open Decision Provenance'
  },
  macro:{
    title:'Macro cross-check',
    summary:'Connect FX and growth references without calling annual data live.',
    steps:['Start with the ECB reference-rate panel.','Compare World Bank history with IMF WEO estimates or projections.','Use official research links for scheduled events and primary releases.','Keep statistical references separate from executable market prices.'],
    nextRoute:'event-calendar',
    nextLabel:'Open the event calendar'
  }
};

function ensureStyles(){
  const existing=document.querySelector('link[data-qelly-market-network-style]');
  if(existing){if(existing.href!==cssHref)existing.href=cssHref;}
  else{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=cssHref;
    link.dataset.qellyMarketNetworkStyle='true';
    document.head.append(link);
  }
  const v2=document.querySelector('link[data-qelly-market-network-v2-style]');
  if(v2){if(v2.href!==v2CssHref)v2.href=v2CssHref;return;}
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=v2CssHref;
  link.dataset.qellyMarketNetworkV2Style='true';
  document.head.append(link);
}

const formatNumber=(value,{digits=2,compact=false}={})=>{
  const number=Number(value);
  if(!Number.isFinite(number))return '—';
  return new Intl.NumberFormat('en-US',compact?{notation:'compact',maximumFractionDigits:digits}:{maximumFractionDigits:digits}).format(number);
};
const formatPrice=(value)=>Number.isFinite(Number(value))?`$${formatNumber(value,{digits:Number(value)<1?6:2})}`:'—';
const formatPct=(value)=>Number.isFinite(Number(value))?`${Number(value)>=0?'+':''}${Number(value).toFixed(2)}%`:'—';
const toneClass=(value)=>Number(value)>0?'q-mn-number-positive':Number(value)<0?'q-mn-number-negative':'';
const dateTime=(value,fallback='Not timestamped')=>value?new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):fallback;
const stateLabel=(source,{reference=false}={})=>{
  const raw=String(source?.truthState||source?.state||'unavailable').toLowerCase();
  if(raw==='unavailable'||source?.data==null)return 'UNAVAILABLE';
  if(raw.includes('delayed')||raw.includes('stale')||raw==='reference_external')return 'DELAYED';
  if(reference)return raw.includes('cache')?'CACHED REFERENCE':'REFERENCE';
  if(raw.includes('cached'))return 'CACHED';
  if(raw.startsWith('live'))return 'LIVE';
  return raw.replaceAll('_',' ').toUpperCase();
};
const stateData=(source,options={})=>stateLabel(source,options).toLowerCase().replaceAll(' ','_');
const usable=(source)=>stateLabel(source)!=='UNAVAILABLE';

function fallbackDiagnostics(sources){
  const entries=Object.values(sources||{});
  const stateCounts={total:entries.length,live:0,cached:0,delayed:0,unavailable:0};
  for(const source of entries){
    const state=stateLabel(source).toLowerCase();
    stateCounts[stateCounts[state]==null?'unavailable':state]+=1;
  }
  const alternative=sources?.['alternative-me'],hyper=sources?.hyperliquid,ecb=sources?.ecb,worldBank=sources?.['world-bank'],imf=sources?.imf;
  const coverage=[
    {id:'crypto-pricing',label:'Crypto price context',purpose:'Compare two independent, read-only crypto observations.',mode:'market_observation',sources:['alternative-me','hyperliquid'],available:[alternative,hyper].filter(usable).length,required:2,ready:usable(alternative)&&usable(hyper)},
    {id:'market-sentiment',label:'Market sentiment',purpose:'Add a clearly attributed daily risk-appetite reference.',mode:'reference_observation',sources:['alternative-me'],available:alternative?.data?.sentiment?1:0,required:1,ready:Boolean(alternative?.data?.sentiment)},
    {id:'fx-reference',label:'FX reference rates',purpose:'Anchor currency research to official ECB reference data.',mode:'governed_reference',sources:['ecb'],available:ecb?.data?.rates?1:0,required:1,ready:Boolean(ecb?.data?.rates)},
    {id:'macro-context',label:'Macro context',purpose:'Compare annual World Bank history with IMF WEO estimates.',mode:'statistical_reference',sources:['world-bank','imf'],available:[worldBank,imf].filter(usable).length,required:2,ready:usable(worldBank)&&usable(imf)}
  ];
  const readyDomains=coverage.filter((item)=>item.ready).length;
  return {sourceCounts:stateCounts,coverage,readiness:{readyDomains,totalDomains:coverage.length,crossAssetContext:coverage.every((item)=>item.available>0),independentCryptoComparison:coverage[0].ready,macroCrossCheck:coverage[3].ready,decisionUse:readyDomains===coverage.length?'ready_with_source_boundaries':'partial_source_coverage',execution:false}};
}

function sourceCard(source,escapeHtml,{reference=false}={}){
  if(!source)return '';
  const state=stateLabel(source,{reference});
  const fetchedAt=source.fetchedAt||source.ingestedAt;
  const cache=source.delivery?.edgeCache||'provider plane';
  const ttl=Number.isFinite(Number(source.delivery?.cacheTtlSeconds))?`${source.delivery.cacheTtlSeconds}s TTL`:'provider governed';
  return `<article class="q-mn-source" data-source-card="${escapeHtml(source.id||source.provider||'source')}">
    <header><div><strong>${escapeHtml(source.label||source.attribution||source.id||source.provider)}</strong><small>${escapeHtml(source.attribution||'Attributed source')}</small></div><span class="q-mn-source-state" data-state="${escapeHtml(stateData(source,{reference}))}">${escapeHtml(state)}</span></header>
    <p>${escapeHtml(source.usage||source.reason||source.fallbackReason||'Source usage metadata unavailable.')}</p>
    <dl><div><dt>Observed</dt><dd>${escapeHtml(dateTime(source.observedAt,reference?'Reference cadence':'Unavailable'))}</dd></div><div><dt>Fetched</dt><dd>${escapeHtml(dateTime(fetchedAt))}</dd></div><div><dt>Delivery</dt><dd>${escapeHtml(`${cache} · ${ttl}`)}</dd></div><div><dt>Cadence</dt><dd>${escapeHtml(source.cadence||'Provider governed')}</dd></div></dl>
    <button type="button" data-source-inspect aria-expanded="false">Inspect provenance</button>
    <div class="q-mn-source-detail" hidden><strong>Permitted use</strong><p>${escapeHtml(source.usage||'Use remains constrained by the named provider policy and attribution.')}</p>${source.docsUrl||source.termsUrl?`<a href="${escapeHtml(source.docsUrl||source.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Open source documentation ↗</a>`:''}</div>
  </article>`;
}

function cryptoTable(source,escapeHtml){
  const rows=Array.isArray(source?.data?.assets)?source.data.assets:[];
  if(!rows.length)return '<div class="q-mn-unavailable">Crypto reference source unavailable. Qelly is showing no substitute value.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Asset</th><th>Price</th><th>24h</th><th>Market cap</th><th>Volume 24h</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.symbol||row.name)}</strong><small>${escapeHtml(row.name||'')}</small></td><td>${escapeHtml(formatPrice(row.priceUsd))}</td><td class="${toneClass(row.change24hPct)}">${escapeHtml(formatPct(row.change24hPct))}</td><td>${escapeHtml(`$${formatNumber(row.marketCapUsd,{compact:true})}`)}</td><td>${escapeHtml(`$${formatNumber(row.volume24hUsd,{compact:true})}`)}</td></tr>`).join('')}</tbody></table></div>`;
}

function comparisonTable(alternative,hyper,escapeHtml){
  const reference=new Map((alternative?.data?.assets||[]).map((row)=>[String(row.symbol||'').toUpperCase(),row]));
  const rows=(Array.isArray(hyper?.data)?hyper.data:[]).map((row)=>{
    const other=reference.get(String(row.symbol||'').toUpperCase());
    const a=Number(other?.priceUsd),b=Number(row.mid);
    if(!other||!Number.isFinite(a)||!Number.isFinite(b)||a===0)return null;
    return {symbol:row.symbol,alternative:a,hyper:b,differencePct:((b-a)/a)*100};
  }).filter(Boolean);
  if(!rows.length)return '<div class="q-mn-unavailable">Independent crypto comparison is unavailable. No source difference is estimated.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table q-mn-compare-table"><thead><tr><th>Symbol</th><th>Alternative.me</th><th>Hyperliquid mid</th><th>Indicative difference</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.symbol)}</strong></td><td>${escapeHtml(formatPrice(row.alternative))}</td><td>${escapeHtml(formatPrice(row.hyper))}</td><td class="${toneClass(row.differencePct)}">${escapeHtml(formatPct(row.differencePct))}</td></tr>`).join('')}</tbody></table></div><p class="q-mn-table-note">A difference is evidence of source construction, cadence or venue context—not an executable spread or trading signal.</p>`;
}

function macroTable(source,escapeHtml){
  const rows=Array.isArray(source?.data)?source.data:[];
  if(!rows.length)return '<div class="q-mn-unavailable">World Bank macro reference unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Economy</th><th>Year</th><th>GDP growth</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.countryId)}</strong><small>${escapeHtml(row.country)}</small></td><td>${escapeHtml(row.year)}</td><td class="${toneClass(row.gdpGrowthPct)}">${escapeHtml(formatPct(row.gdpGrowthPct))}</td></tr>`).join('')}</tbody></table></div>`;
}

function imfPanel(source,escapeHtml){
  const rows=Array.isArray(source?.data)?source.data:[];
  if(!rows.length)return '<div class="q-mn-unavailable">IMF WEO growth reference unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Economy</th><th>Year</th><th>Real GDP growth</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.countryId)}</strong><small>${escapeHtml(row.country)}</small></td><td>${escapeHtml(row.year)}${row.estimateOrProjection?' · est.':''}</td><td class="${toneClass(row.growthPct)}">${escapeHtml(formatPct(row.growthPct))}</td></tr>`).join('')}</tbody></table></div>`;
}

function ecbPanel(source,escapeHtml){
  const rates=source?.data?.rates&&typeof source.data.rates==='object'?Object.entries(source.data.rates).slice(0,14):[];
  if(!rates.length)return '<div class="q-mn-unavailable">ECB reference rates unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Currency</th><th>EUR reference</th></tr></thead><tbody>${rates.map(([currency,value])=>`<tr><td><strong>${escapeHtml(currency)}</strong></td><td>${escapeHtml(formatNumber(value,{digits:6}))}</td></tr>`).join('')}</tbody></table></div>`;
}

function liveBoard({alternative,hyper,ecb,worldBank},escapeHtml){
  const btc=Array.isArray(hyper?.data)?hyper.data.find((row)=>row.symbol==='BTC'):null;
  const eth=Array.isArray(hyper?.data)?hyper.data.find((row)=>row.symbol==='ETH'):null;
  const sentiment=alternative?.data?.sentiment;
  const eurUsd=ecb?.data?.rates?.USD;
  const macro=Array.isArray(worldBank?.data)?worldBank.data.find((row)=>row.countryId==='USA')||worldBank.data[0]:null;
  const rows=[
    ['Hyperliquid BTC',btc?formatPrice(btc.mid):'—',stateLabel(hyper),hyper?.observedAt],
    ['Hyperliquid ETH',eth?formatPrice(eth.mid):'—',stateLabel(hyper),hyper?.observedAt],
    ['Fear & Greed',sentiment?.value!=null?`${sentiment.value} · ${sentiment.classification||''}`:'—',stateLabel(alternative),sentiment?.timestamp],
    ['ECB EUR/USD',eurUsd!=null?formatNumber(eurUsd,{digits:6}):'—',stateLabel(ecb,{reference:true}),ecb?.observedAt],
    ['Global macro',macro?.gdpGrowthPct!=null?`${formatPct(macro.gdpGrowthPct)} · ${macro.countryId}`:'—',stateLabel(worldBank,{reference:true}),null]
  ];
  return `<div class="q-mn-live-board">${rows.map(([label,value,state,time])=>`<div class="q-mn-live-row"><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(time?dateTime(time):'Declared source cadence')}</small></div><div class="q-mn-live-value"><b>${escapeHtml(value)}</b><span data-state="${escapeHtml(state.toLowerCase())}">${escapeHtml(state)}</span></div></div>`).join('')}</div>`;
}

function coverageGrid(diagnostics,escapeHtml){
  return `<div class="q-mn-coverage-grid">${(diagnostics.coverage||[]).map((item)=>`<article data-ready="${item.ready?'true':'false'}"><header><span>${escapeHtml(item.mode.replaceAll('_',' '))}</span><strong>${item.ready?'Ready':'Partial'}</strong></header><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.purpose)}</p><small>${escapeHtml(`${item.available} of ${item.required} required sources available`)}</small></article>`).join('')}</div>`;
}

const researchCategory=(item)=>{
  if(item.category)return item.category;
  if(['cme','fred','sec-edgar','rbi-data','nse-market-data','imf-data','ecb','world-bank'].includes(item.id))return 'official-data';
  if(['coinmarketcap','coinpaprika','defillama','coinglass','hypurrscan'].includes(item.id))return 'crypto-research';
  if(item.id==='x')return 'community';
  return 'market-research';
};

export async function renderGlobalMarketNetwork(main,deps){
  ensureStyles();
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  let network;
  try{network=await api('/api/v1/market/network');}
  catch(error){
    main.innerHTML=`<section class="q-page q-market-network" data-network-experience="mission-control-v2">${pageHead('Qelly Intelligence · Global Market Network','Global Market Network','Use this feature to determine what is moving, whether the move is broad and whether each observation is trustworthy enough to research.',`<button class="q-button q-button--primary q-mn-refresh" data-action="refresh-network">Retry network</button>`)}${stateBanner()}<section class="q-mn-card q-mn-error"><p class="q-eyebrow">No substitute observations</p><h2>Market network unavailable</h2><p>${escapeHtml(error.message)}</p><strong>Qelly has not generated prices, candles, volume or market movement to fill the gap.</strong></section></section>`;
    main.querySelector('[data-action="refresh-network"]')?.addEventListener('click',()=>renderGlobalMarketNetwork(main,deps));
    return;
  }

  const sources=network.sources||{};
  const alternative=sources['alternative-me'];
  const hyper=sources.hyperliquid;
  const worldBank=sources['world-bank'];
  const imf=sources.imf;
  const ecb=sources.ecb;
  const diagnostics=network.networkDiagnostics||fallbackDiagnostics(sources);
  const researchLinks=Array.isArray(network.researchLinks)?network.researchLinks:[];
  const sourceList=[alternative,hyper,ecb,worldBank,imf].filter(Boolean);
  const availableCount=sourceList.filter(usable).length;
  const readyDomains=Number(diagnostics.readiness?.readyDomains||0);
  const totalDomains=Number(diagnostics.readiness?.totalDomains||diagnostics.coverage?.length||0);
  const comparisonReady=diagnostics.readiness?.independentCryptoComparison===true;
  const macroReady=diagnostics.readiness?.macroCrossCheck===true;

  main.innerHTML=`<section class="q-page q-market-network" data-market-network="live-terminal-v8" data-network-experience="mission-control-v2" data-network-view="scan">
    ${pageHead('Qelly Intelligence · Global Market Network','Global Market Network','Use this feature to determine what is moving, whether the move is broad and whether each observation is trustworthy enough to research.',`<a class="q-button q-button--ghost" href="#/data-mesh">Provider policy</a><button class="q-button q-button--primary q-mn-refresh" data-action="refresh-network">Refresh network</button>`)}${stateBanner()}

    <section class="q-mn-mission" aria-labelledby="q-mn-mission-title">
      <div class="q-mn-mission__copy"><p class="q-eyebrow">Unique job · governed market orientation</p><h2 id="q-mn-mission-title">Decide whether a market move is broad—and whether every observation deserves trust.</h2><p>Global Market Network combines cross-asset orientation, independent source comparison and freshness evidence. It does not rank assets, build a thesis or execute a trade.</p><div class="q-mn-view-switch" role="toolbar" aria-label="Choose the market-network job">${Object.entries(VIEWS).map(([id,item],index)=>`<button type="button" data-network-view="${id}" aria-pressed="${index===0?'true':'false'}"><span>0${index+1}</span>${item.label}</button>`).join('')}</div></div>
      <aside class="q-mn-mission__outcome"><span data-network-view-label>${VIEWS.scan.label}</span><strong data-network-view-title>${VIEWS.scan.title}</strong><p data-network-view-copy>${VIEWS.scan.copy}</p><div><a href="#/research-workspace">Build a research dossier →</a><small>Network generated ${escapeHtml(dateTime(network.generatedAt))}</small></div></aside>
    </section>

    <section class="q-mn-status-grid" aria-label="Market network status">
      <div class="q-mn-status"><span>Network readiness</span><strong>${escapeHtml(`${readyDomains} / ${totalDomains} domains`)}</strong><small>${escapeHtml(diagnostics.readiness?.decisionUse?.replaceAll('_',' ')||'source bounded')}</small></div>
      <div class="q-mn-status"><span>Provider health</span><strong>${escapeHtml(`${availableCount} / ${sourceList.length} available`)}</strong><small>${escapeHtml(`${diagnostics.sourceCounts?.live||0} live · ${diagnostics.sourceCounts?.cached||0} cached · ${diagnostics.sourceCounts?.delayed||0} delayed`)}</small></div>
      <div class="q-mn-status"><span>Crypto comparison</span><strong>${comparisonReady?'READY':'PARTIAL'}</strong><small>Independent observations</small></div>
      <div class="q-mn-status"><span>FX reference</span><strong>${escapeHtml(ecb?.data?.rates?`${Object.keys(ecb.data.rates).length} rates`:'Unavailable')}</strong><small>${escapeHtml(stateLabel(ecb,{reference:true}))}</small></div>
      <div class="q-mn-status"><span>Macro cross-check</span><strong>${macroReady?'READY':'PARTIAL'}</strong><small>World Bank + IMF</small></div>
    </section>

    <section class="q-mn-coverage-shell" data-network-section="audit"><header><div><p class="q-eyebrow">Coverage contract</p><h2>Know what the network can answer before using it.</h2></div><span class="q-mn-source-state" data-state="${readyDomains===totalDomains?'live':'delayed'}">${escapeHtml(`${readyDomains} / ${totalDomains} ready`)}</span></header>${coverageGrid(diagnostics,escapeHtml)}</section>

    <section class="q-mn-workbench" data-network-section="scan">
      <section class="q-mn-panel q-mn-chart-panel">
        <div class="q-mn-chart-controls"><label><span>Cross-asset display</span><select id="q-mn-symbol">${CHART_PRESETS.map(([id,label,group])=>`<option value="${escapeHtml(id)}">${escapeHtml(group)} · ${escapeHtml(label)}</option>`).join('')}</select></label><label><span>Interval</span><select id="q-mn-interval">${INTERVALS.map((item)=>`<option value="${item}" ${item==='1h'?'selected':''}>${item}</option>`).join('')}</select></label><span class="q-status q-status--cached">TRADINGVIEW · DISPLAY ONLY</span></div>
        <div id="q-market-network-chart" class="q-mn-chart" aria-label="TradingView cross-asset external research chart"><div class="qelly-tradingview-loading" role="status"><span aria-hidden="true"></span><strong>Loading cross-asset market chart…</strong><small>Official TradingView display · Qelly observations remain separate</small></div></div>
        <div class="q-mn-attribution">TradingView is an external display boundary—a display-only research surface. Qelly does not scrape or reuse widget values. Qelly calculations, provider truth, alerts and decisions do not consume TradingView widget values.</div>
      </section>
      <aside class="q-mn-side">
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Live source board</h2><p>Fastest usable observations first</p></div><span class="q-mn-source-state" data-state="${availableCount?'live':'unavailable'}">${availableCount?'CONNECTED':'UNAVAILABLE'}</span></div><div class="q-mn-panel-body">${liveBoard({alternative,hyper,ecb,worldBank},escapeHtml)}</div></section>
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Production truth</h2><p>Connected runtime policy</p></div></div><div class="q-mn-panel-body"><div class="q-mn-live-board"><div class="q-mn-live-row"><div><strong>Release</strong><small>Canonical Cloudflare runtime identity</small></div><div class="q-mn-live-value"><b>${escapeHtml(network.releaseSha||'runtime')}</b><span>ACTIVE</span></div></div><div class="q-mn-live-row"><div><strong>Fabricated fallback</strong><small>No substitute price, candle, volume or market movement</small></div><div class="q-mn-live-value"><b>OFF</b><span>TRUTH</span></div></div><div class="q-mn-live-row"><div><strong>Internal execution</strong><small>Research and analytics only</small></div><div class="q-mn-live-value"><b>DISABLED</b><span>READ ONLY</span></div></div><div class="q-mn-live-row"><div><strong>Crypto provider rights</strong><small>Commercial/display policy boundary</small></div><div class="q-mn-live-value"><b>Coinbase / Binance blocked</b><span>RIGHTS</span></div></div></div><p class="q-mn-disclosure">No fabricated fallback values. No unrestricted-data fiction. CoinPaprika Free is not used for commercial production redistribution. CoinMarketCap keyless access is treated as evaluation/prototype access. ECB observations are official reference rates, not tick execution prices.</p></div></section>
      </aside>
    </section>

    <section class="q-mn-panel q-mn-comparison" data-network-section="compare"><div class="q-mn-panel-head"><div><p class="q-eyebrow">Independent observation check</p><h2>Cross-source crypto comparison</h2><p>Challenge a displayed value before carrying it into research.</p></div><span class="q-mn-source-state" data-state="${comparisonReady?'live':'unavailable'}">${comparisonReady?'COMPARABLE':'PARTIAL'}</span></div><div class="q-mn-panel-body">${comparisonTable(alternative,hyper,escapeHtml)}</div></section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Crypto market reference</h2><p>Alternative.me public API · source-attributed market context</p></div><span class="q-mn-source-state" data-state="${escapeHtml(stateData(alternative))}">${escapeHtml(stateLabel(alternative))}</span></div><div class="q-mn-panel-body">${cryptoTable(alternative,escapeHtml)}</div><div class="q-mn-attribution">Data from Alternative.me. Research context only; no investment advice.</div></section>

    <section class="q-mn-macro-grid" data-network-section="compare">
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>ECB governed FX reference</h2><p>Official working-day reference rates</p></div><span class="q-mn-source-state" data-state="${escapeHtml(stateData(ecb,{reference:true}))}">${escapeHtml(stateLabel(ecb,{reference:true}))}</span></div><div class="q-mn-panel-body">${ecbPanel(ecb,escapeHtml)}</div></section>
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Global macro context</h2><p>World Bank · latest annual GDP growth</p></div><span class="q-mn-source-state" data-state="reference">${escapeHtml(stateLabel(worldBank,{reference:true}))}</span></div><div class="q-mn-panel-body">${macroTable(worldBank,escapeHtml)}</div></section>
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>IMF WEO cross-check</h2><p>Estimates and projections stay labelled</p></div><span class="q-mn-source-state" data-state="reference">${escapeHtml(stateLabel(imf,{reference:true}))}</span></div><div class="q-mn-panel-body">${imfPanel(imf,escapeHtml)}</div></section>
    </section>

    <section class="q-mn-panel q-mn-provenance" data-network-section="audit"><div class="q-mn-panel-head"><div><p class="q-eyebrow">Freshness inspector</p><h2>Provider provenance</h2><p>Observed time, fetch time, edge-cache state, cadence and intended usage.</p></div><span class="q-mn-source-state" data-state="${availableCount===sourceList.length?'live':'delayed'}">${escapeHtml(`${availableCount} / ${sourceList.length} available`)}</span></div><div class="q-mn-panel-body q-mn-source-grid">${sourceCard(alternative,escapeHtml)}${sourceCard(hyper,escapeHtml)}${sourceCard(ecb,escapeHtml,{reference:true})}${sourceCard(worldBank,escapeHtml,{reference:true})}${sourceCard(imf,escapeHtml,{reference:true})}</div></section>

    <section class="q-mn-panel q-mn-research-network"><div class="q-mn-panel-head"><div><p class="q-eyebrow">Professional research dock</p><h2>Official research network</h2><p>Primary and specialist destinations remain separate from Qelly analytical inputs.</p></div></div><div class="q-mn-panel-body"><div class="q-mn-link-filters" role="toolbar" aria-label="Filter research destinations"><button type="button" data-link-filter="all" aria-pressed="true">All</button><button type="button" data-link-filter="official-data" aria-pressed="false">Official data</button><button type="button" data-link-filter="market-research" aria-pressed="false">Market research</button><button type="button" data-link-filter="crypto-research" aria-pressed="false">Crypto research</button><button type="button" data-link-filter="community" aria-pressed="false">Community</button></div><div class="q-mn-links">${researchLinks.map((item)=>`<a class="q-mn-link" data-link-category="${escapeHtml(researchCategory(item))}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer nofollow" title="${escapeHtml(item.note||item.mode)}"><strong>${escapeHtml(item.label)} ↗</strong><span>${escapeHtml(item.note||item.mode)}</span></a>`).join('')}</div><p class="q-mn-link-status" aria-live="polite">${researchLinks.length} research destinations shown</p></div></section>

    <section class="q-mn-panel q-mn-guide-panel"><div class="q-mn-panel-head"><div><h2>Research guides</h2><p>Purpose-built checklists that produce an explicit next artifact.</p></div></div><div class="q-mn-panel-body"><div class="q-mn-guides">${Object.entries(GUIDES).map(([id,guide])=>`<button class="q-mn-guide" type="button" data-guide="${id}" aria-pressed="false"><strong>${escapeHtml(guide.title)}</strong><span>${escapeHtml(guide.summary)}</span></button>`).join('')}</div><div id="q-mn-guide-output" class="q-mn-guide-output" hidden aria-live="polite"></div></div></section>
  </section>`;

  const root=main.querySelector('.q-market-network');
  let chartHandle=null;
  const symbolSelect=main.querySelector('#q-mn-symbol');
  const intervalSelect=main.querySelector('#q-mn-interval');
  const chart=main.querySelector('#q-market-network-chart');
  const mountChart=()=>{
    chartHandle?.destroy?.();
    chartHandle=null;
    try{chartHandle=mountTradingViewDisplay(chart,{symbol:symbolSelect.value,interval:intervalSelect.value});}
    catch(error){
      chart.innerHTML=`<div class="q-mn-chart-fallback"><div><strong>TradingView display unavailable</strong><p>Source-backed Qelly observations remain available below.</p><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">Open TradingView ↗</a></div></div>`;
      toast?.(`External chart unavailable: ${error.message}`,{tone:'warning'});
    }
  };
  symbolSelect?.addEventListener('change',mountChart);
  intervalSelect?.addEventListener('change',mountChart);
  main.querySelector('[data-action="refresh-network"]')?.addEventListener('click',()=>{chartHandle?.destroy?.();void renderGlobalMarketNetwork(main,deps);});
  main.querySelectorAll('[data-network-view]').forEach((button)=>button.addEventListener('click',()=>{
    const view=VIEWS[button.dataset.networkView]||VIEWS.scan;
    root.dataset.networkView=button.dataset.networkView;
    main.querySelectorAll('[data-network-view]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));
    main.querySelector('[data-network-view-label]').textContent=view.label;
    main.querySelector('[data-network-view-title]').textContent=view.title;
    main.querySelector('[data-network-view-copy]').textContent=view.copy;
  }));
  main.querySelectorAll('[data-source-inspect]').forEach((button)=>button.addEventListener('click',()=>{
    const detail=button.closest('[data-source-card]')?.querySelector('.q-mn-source-detail');
    if(!detail)return;
    detail.hidden=!detail.hidden;
    button.setAttribute('aria-expanded',String(!detail.hidden));
    button.textContent=detail.hidden?'Inspect provenance':'Hide provenance';
  }));
  main.querySelectorAll('[data-link-filter]').forEach((button)=>button.addEventListener('click',()=>{
    const filter=button.dataset.linkFilter;
    main.querySelectorAll('[data-link-filter]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));
    let visible=0;
    main.querySelectorAll('[data-link-category]').forEach((link)=>{const show=filter==='all'||link.dataset.linkCategory===filter;link.hidden=!show;if(show)visible+=1;});
    main.querySelector('.q-mn-link-status').textContent=`${visible} research destination${visible===1?'':'s'} shown`;
  }));
  main.querySelectorAll('[data-guide]').forEach((button)=>button.addEventListener('click',()=>{
    const guide=GUIDES[button.dataset.guide];
    const output=main.querySelector('#q-mn-guide-output');
    main.querySelectorAll('[data-guide]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));
    output.hidden=false;
    output.innerHTML=`<div><p class="q-eyebrow">Selected workflow</p><h3>${escapeHtml(guide.title)}</h3><p>${escapeHtml(guide.summary)}</p></div><ol>${guide.steps.map((step)=>`<li>${escapeHtml(step)}</li>`).join('')}</ol><a class="q-button q-button--primary" href="#/${escapeHtml(guide.nextRoute)}">${escapeHtml(guide.nextLabel)}</a>`;
  }));
  window.__qellyLiveMarketCleanup=()=>{chartHandle?.destroy?.();chartHandle=null;};
  mountChart();
}
