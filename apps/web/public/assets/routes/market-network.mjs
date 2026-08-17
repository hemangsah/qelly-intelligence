import {mountTradingViewDisplay} from '../market/tradingview-display-widget.mjs';

const CHART_PRESETS=[
  ['BTCUSDT','Bitcoin / USD','Crypto'],['ETHUSDT','Ethereum / USD','Crypto'],['SOLUSDT','Solana / USD','Crypto'],
  ['XAUUSD','Gold / USD','Metals'],['XAGUSD','Silver / USD','Metals'],
  ['EURUSD','EUR / USD','FX'],['GBPUSD','GBP / USD','FX'],['USDJPY','USD / JPY','FX'],['USDINR','USD / INR','FX'],
  ['SPX','S&P 500','United States'],['NDX','Nasdaq 100','United States'],['NIFTY','Nifty 50','India'],['SENSEX','Sensex','India'],
  ['HSI','Hang Seng','Hong Kong'],['NI225','Nikkei 225','Japan'],['DXY','U.S. Dollar Index','Macro'],['USOIL','WTI crude oil','Energy']
];
const INTERVALS=['5m','15m','1h','4h','1d','1w'];
const cssHref=new URL('./market-network.css',import.meta.url).href;

function ensureStyles(){
  if(document.querySelector('link[data-qelly-market-network-style]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=cssHref;
  link.dataset.qellyMarketNetworkStyle='true';
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
const observed=(value)=>value?new Date(value).toLocaleString('en-IN'):'Reference cadence';

function sourceCard(source,escapeHtml){
  if(!source)return '';
  return `<article class="q-mn-source"><header><strong>${escapeHtml(source.label||source.id)}</strong><span class="q-mn-source-state" data-state="${escapeHtml(source.state||'unavailable')}">${escapeHtml(String(source.state||'unavailable').replaceAll('_',' '))}</span></header><small>${escapeHtml(source.usage||source.reason||'Source metadata unavailable')}</small><small>Observed: ${escapeHtml(observed(source.observedAt))}</small></article>`;
}

function cryptoTable(source,escapeHtml){
  const rows=Array.isArray(source?.data?.assets)?source.data.assets:[];
  if(!rows.length)return '<div class="q-mn-unavailable">Crypto reference feed is unavailable. No synthetic values are substituted.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Asset</th><th>Price</th><th>24h</th><th>Market cap</th><th>Volume 24h</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.symbol||row.name)}</strong></td><td>${escapeHtml(formatPrice(row.priceUsd))}</td><td class="${toneClass(row.change24hPct)}">${escapeHtml(formatPct(row.change24hPct))}</td><td>${escapeHtml(`$${formatNumber(row.marketCapUsd,{compact:true})}`)}</td><td>${escapeHtml(`$${formatNumber(row.volume24hUsd,{compact:true})}`)}</td></tr>`).join('')}</tbody></table></div>`;
}

function hyperliquidTable(source,escapeHtml){
  const rows=Array.isArray(source?.data)?source.data:[];
  if(!rows.length)return '<div class="q-mn-unavailable">Hyperliquid mids are unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Market</th><th>Mid</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.symbol)}</strong></td><td>${escapeHtml(formatPrice(row.mid))}</td></tr>`).join('')}</tbody></table></div>`;
}

function macroTable(source,escapeHtml){
  const rows=Array.isArray(source?.data)?source.data:[];
  if(!rows.length)return '<div class="q-mn-unavailable">World Bank macro reference is unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Economy</th><th>Year</th><th>GDP growth</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.countryId)}</strong><br><small>${escapeHtml(row.country)}</small></td><td>${escapeHtml(row.year)}</td><td class="${toneClass(row.gdpGrowthPct)}">${escapeHtml(formatPct(row.gdpGrowthPct))}</td></tr>`).join('')}</tbody></table></div>`;
}

function ecbPanel(source,escapeHtml){
  const rates=source?.data?.rates&&typeof source.data.rates==='object'?Object.entries(source.data.rates).slice(0,12):[];
  if(!rates.length)return '<div class="q-mn-unavailable">ECB governed reference rates are unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Currency</th><th>EUR reference</th></tr></thead><tbody>${rates.map(([currency,value])=>`<tr><td><strong>${escapeHtml(currency)}</strong></td><td>${escapeHtml(formatNumber(value,{digits:6}))}</td></tr>`).join('')}</tbody></table></div>`;
}

const GUIDES={
  'cross-asset':'Cross-asset review\n1. Compare crypto, USD, gold and equity index direction.\n2. Check whether moves are broad or isolated.\n3. Verify timestamps and source cadence before drawing conclusions.\n4. Treat external chart values as display-only.',
  'risk':'Risk-state review\n1. Check sentiment and market breadth.\n2. Compare Hyperliquid mids with the independent crypto reference table.\n3. Inspect provider availability and delayed/stale states.\n4. Do not convert unavailable data into estimates.',
  'macro':'Macro review\n1. Start with ECB reference rates and World Bank annual macro context.\n2. Open Forex Factory for scheduled events.\n3. Use TradingView presets for FX, metals and indices.\n4. Distinguish annual macro reference data from live market observations.'
};

export async function renderGlobalMarketNetwork(main,deps){
  ensureStyles();
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  let network;
  try{network=await api('/api/v1/market/network');}
  catch(error){
    main.innerHTML=`<section class="q-page q-market-network">${pageHead('Qelly Intelligence · Global Market Network','Global Market Network','The public market aggregation service is unavailable. Qelly will not replace missing source observations with generated values.',`<button class="q-button q-button--primary q-mn-refresh" data-action="refresh-network">Retry</button>`)}${stateBanner()}<section class="q-mn-card"><h2>Network unavailable</h2><p>${escapeHtml(error.message)}</p></section></section>`;
    main.querySelector('[data-action="refresh-network"]')?.addEventListener('click',()=>renderGlobalMarketNetwork(main,deps));
    return;
  }

  const sources=network.sources||{};
  const alternative=sources['alternative-me'];
  const sentiment=alternative?.data?.sentiment;
  const hyper=sources.hyperliquid;
  const worldBank=sources['world-bank'];
  const ecb=sources.ecb;
  const researchLinks=Array.isArray(network.researchLinks)?network.researchLinks:[];

  main.innerHTML=`<section class="q-page q-market-network" data-market-network="rights-aware-v1">
    ${pageHead('Qelly Intelligence · Global Market Network','Global Market Network','A cross-asset research terminal combining permitted public/reference APIs, Qelly-governed ECB data, an isolated TradingView display, and explicit research links. No fabricated fallback values and no trade execution.',`<a class="q-button q-button--ghost" href="#/data-mesh">Provider policy</a><button class="q-button q-button--primary q-mn-refresh" data-action="refresh-network">Refresh network</button>`)}${stateBanner()}
    <section class="q-mn-status-grid" aria-label="Market network status">
      <div class="q-mn-status"><span>Release</span><strong>${escapeHtml(String(network.releaseSha||'unknown').slice(0,12))}</strong></div>
      <div class="q-mn-status"><span>Fabricated fallback</span><strong>OFF</strong></div>
      <div class="q-mn-status"><span>Internal execution</span><strong>DISABLED</strong></div>
      <div class="q-mn-status"><span>Crypto provider rights</span><strong>Coinbase / Binance blocked</strong></div>
    </section>

    <section class="q-mn-workbench">
      <section class="q-mn-panel">
        <div class="q-mn-chart-controls"><label><span>Cross-asset display</span><select id="q-mn-symbol">${CHART_PRESETS.map(([id,label,group])=>`<option value="${escapeHtml(id)}">${escapeHtml(group)} · ${escapeHtml(label)}</option>`).join('')}</select></label><label><span>Interval</span><select id="q-mn-interval">${INTERVALS.map((item)=>`<option value="${item}" ${item==='1h'?'selected':''}>${item}</option>`).join('')}</select></label><span class="q-status q-status--cached">TRADINGVIEW · DISPLAY ONLY</span></div>
        <div id="q-market-network-chart" class="q-mn-chart" aria-label="TradingView cross-asset external research chart"></div>
        <div class="q-mn-attribution">TradingView is an external display boundary. Qelly does not scrape or reuse widget values for calculations, provider truth, alerts or decisions.</div>
      </section>
      <aside class="q-mn-side">
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Crypto sentiment</h2><p>Alternative.me · attributed external reference</p></div><strong>${sentiment?.value!=null?escapeHtml(String(sentiment.value)):'—'}</strong></div><div class="q-mn-panel-body"><strong>${escapeHtml(sentiment?.classification||'Unavailable')}</strong><p>Fear & Greed data is displayed with source attribution as required by the provider. It is research context, not advice.</p></div></section>
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Hyperliquid mids</h2><p>Public read-only info endpoint</p></div></div><div class="q-mn-panel-body">${hyperliquidTable(hyper,escapeHtml)}</div></section>
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Source policy</h2><p>No unrestricted-data fiction</p></div></div><div class="q-mn-panel-body"><p class="q-mn-disclosure">CoinMarketCap keyless access is treated as evaluation/prototype access, CoinPaprika Free is not used for commercial production redistribution, and DefiLlama/CoinGlass/X/Hypurrscan remain official research links unless the applicable data/embedding rights are established.</p></div></section>
      </aside>
    </section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Crypto market reference</h2><p>Alternative.me public API · approximately five-minute ticker cadence</p></div><span class="q-mn-source-state" data-state="${escapeHtml(alternative?.state||'unavailable')}">${escapeHtml(alternative?.state||'unavailable')}</span></div><div class="q-mn-panel-body">${cryptoTable(alternative,escapeHtml)}</div><div class="q-mn-attribution">Data from Alternative.me. Market reference only; no investment advice.</div></section>

    <section class="q-market-network q-mn-hero">
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>ECB governed FX reference</h2><p>Qelly provider plane · reference rates</p></div><span class="q-mn-source-state" data-state="${escapeHtml(ecb?.truthState||'unavailable')}">${escapeHtml(ecb?.truthState||'unavailable')}</span></div><div class="q-mn-panel-body">${ecbPanel(ecb,escapeHtml)}</div></section>
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Global macro context</h2><p>World Bank · latest annual GDP growth</p></div></div><div class="q-mn-panel-body">${macroTable(worldBank,escapeHtml)}</div></section>
    </section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Provider provenance</h2><p>Live/reference state and usage boundary are visible, not hidden in tooltips.</p></div></div><div class="q-mn-panel-body q-mn-source-grid">${Object.values(sources).map((source)=>sourceCard(source,escapeHtml)).join('')}</div></section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Official research network</h2><p>Outbound destinations are used where embedding or redistribution rights are not established.</p></div></div><div class="q-mn-panel-body q-mn-links">${researchLinks.map((item)=>`<a class="q-mn-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer nofollow"><strong>${escapeHtml(item.label)} ↗</strong><span>${escapeHtml(item.note||item.mode)}</span></a>`).join('')}</div></section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Research guides</h2><p>Transparent local checklists — these are not AI/chatbot calls.</p></div></div><div class="q-mn-panel-body"><div class="q-mn-guides">${Object.entries(GUIDES).map(([id,text])=>`<button class="q-mn-guide" type="button" data-guide="${id}"><strong>${escapeHtml(id==='cross-asset'?'Cross-asset guide':id==='risk'?'Risk-state guide':'Macro guide')}</strong><span>${escapeHtml(text.split('\n')[0])}</span></button>`).join('')}</div><div id="q-mn-guide-output" class="q-mn-guide-output" hidden></div></div></section>
  </section>`;

  let chartHandle=null;
  const symbolSelect=main.querySelector('#q-mn-symbol');
  const intervalSelect=main.querySelector('#q-mn-interval');
  const chart=main.querySelector('#q-market-network-chart');
  const mountChart=()=>{chartHandle?.destroy?.();chartHandle=mountTradingViewDisplay(chart,{symbol:symbolSelect.value,interval:intervalSelect.value});};
  symbolSelect?.addEventListener('change',mountChart);
  intervalSelect?.addEventListener('change',mountChart);
  main.querySelector('[data-action="refresh-network"]')?.addEventListener('click',()=>{chartHandle?.destroy?.();void renderGlobalMarketNetwork(main,deps);});
  main.querySelectorAll('[data-guide]').forEach((button)=>button.addEventListener('click',()=>{const output=main.querySelector('#q-mn-guide-output');output.hidden=false;output.textContent=GUIDES[button.dataset.guide]||'';}));
  window.__qellyLiveMarketCleanup=()=>{chartHandle?.destroy?.();chartHandle=null;};
  try{mountChart();}catch(error){toast?.(`External chart unavailable: ${error.message}`,{tone:'warning'});}
}
