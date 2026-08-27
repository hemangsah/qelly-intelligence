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
const stateLabel=(source,{reference=false}={})=>{
  const raw=String(source?.truthState||source?.state||'unavailable').toLowerCase();
  if(raw==='unavailable')return 'UNAVAILABLE';
  if(raw.includes('delayed')||raw.includes('stale'))return 'DELAYED';
  if(reference)return 'REFERENCE';
  if(raw.includes('cached'))return 'CACHED';
  if(raw.startsWith('live'))return 'LIVE';
  return raw.replaceAll('_',' ').toUpperCase();
};
const stateData=(source,{reference=false}={})=>stateLabel(source,{reference}).toLowerCase().replaceAll(' ','_');

function sourceCard(source,escapeHtml,{reference=false}={}){
  if(!source)return '';
  const state=stateLabel(source,{reference});
  return `<article class="q-mn-source"><header><strong>${escapeHtml(source.label||source.id)}</strong><span class="q-mn-source-state" data-state="${escapeHtml(stateData(source,{reference}))}">${escapeHtml(state)}</span></header><small>${escapeHtml(source.usage||source.reason||'Source metadata unavailable')}</small><small>Observed: ${escapeHtml(observed(source.observedAt))}</small></article>`;
}

function cryptoTable(source,escapeHtml){
  const rows=Array.isArray(source?.data?.assets)?source.data.assets:[];
  if(!rows.length)return '<div class="q-mn-unavailable">Crypto reference source unavailable. Qelly is showing no substitute value.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Asset</th><th>Price</th><th>24h</th><th>Market cap</th><th>Volume 24h</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.symbol||row.name)}</strong></td><td>${escapeHtml(formatPrice(row.priceUsd))}</td><td class="${toneClass(row.change24hPct)}">${escapeHtml(formatPct(row.change24hPct))}</td><td>${escapeHtml(`$${formatNumber(row.marketCapUsd,{compact:true})}`)}</td><td>${escapeHtml(`$${formatNumber(row.volume24hUsd,{compact:true})}`)}</td></tr>`).join('')}</tbody></table></div>`;
}

function macroTable(source,escapeHtml){
  const rows=Array.isArray(source?.data)?source.data:[];
  if(!rows.length)return '<div class="q-mn-unavailable">World Bank macro reference unavailable.</div>';
  return `<div class="q-mn-table-wrap"><table class="q-mn-table"><thead><tr><th>Economy</th><th>Year</th><th>GDP growth</th></tr></thead><tbody>${rows.map((row)=>`<tr><td><strong>${escapeHtml(row.countryId)}</strong><br><small>${escapeHtml(row.country)}</small></td><td>${escapeHtml(row.year)}</td><td class="${toneClass(row.gdpGrowthPct)}">${escapeHtml(formatPct(row.gdpGrowthPct))}</td></tr>`).join('')}</tbody></table></div>`;
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
    ['Hyperliquid BTC',btc?formatPrice(btc.mid):'—',stateLabel(hyper)],
    ['Hyperliquid ETH',eth?formatPrice(eth.mid):'—',stateLabel(hyper)],
    ['Fear & Greed',sentiment?.value!=null?`${sentiment.value} · ${sentiment.classification||''}`:'—',stateLabel(alternative)],
    ['ECB EUR/USD',eurUsd!=null?formatNumber(eurUsd,{digits:6}):'—',stateLabel(ecb,{reference:true})],
    ['Global macro',macro?.gdpGrowthPct!=null?`${formatPct(macro.gdpGrowthPct)} · ${macro.countryId}`:'—',stateLabel(worldBank,{reference:true})]
  ];
  return `<div class="q-mn-live-board">${rows.map(([label,value,state])=>`<div class="q-mn-live-row"><div><strong>${escapeHtml(label)}</strong><small>Source-backed observation</small></div><div class="q-mn-live-value"><b>${escapeHtml(value)}</b><span data-state="${escapeHtml(state.toLowerCase())}">${escapeHtml(state)}</span></div></div>`).join('')}</div>`;
}

const GUIDES={
  'cross-asset':['Cross-asset review','Compare crypto, USD, gold and equity index direction.','Check whether moves are broad or isolated.','Verify timestamps and source cadence before conclusions.','Treat external chart values as display-only.'].join('\n'),
  'risk':['Risk-state review','Check sentiment and market breadth.','Compare Hyperliquid mids with the independent crypto reference table.','Inspect provider availability and delayed/stale states.','Do not convert unavailable data into estimates.'].join('\n'),
  'macro':['Macro review','Start with ECB reference rates and World Bank macro context.','Open Forex Factory for scheduled events.','Use TradingView presets for FX, metals and indices.','Distinguish macro reference data from live market observations.'].join('\n')
};

export async function renderGlobalMarketNetwork(main,deps){
  ensureStyles();
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  let network;
  try{network=await api('/api/v1/market/network');}
  catch(error){
    main.innerHTML=`<section class="q-page q-market-network">${pageHead('Qelly Intelligence · Global Market Network','Global Market Network','Canonical market aggregation is temporarily unavailable. No substitute market observations are generated.',`<button class="q-button q-button--primary q-mn-refresh" data-action="refresh-network">Retry</button>`)}${stateBanner()}<section class="q-mn-card"><h2>Market network unavailable</h2><p>${escapeHtml(error.message)}</p></section></section>`;
    main.querySelector('[data-action="refresh-network"]')?.addEventListener('click',()=>renderGlobalMarketNetwork(main,deps));
    return;
  }

  const sources=network.sources||{};
  const alternative=sources['alternative-me'];
  const hyper=sources.hyperliquid;
  const worldBank=sources['world-bank'];
  const ecb=sources.ecb;
  const researchLinks=Array.isArray(network.researchLinks)?network.researchLinks:[];
  const sourceList=[alternative,hyper,ecb,worldBank].filter(Boolean);
  const availableCount=sourceList.filter((source)=>String(source?.truthState||source?.state||'').toLowerCase()!=='unavailable').length;

  main.innerHTML=`<section class="q-page q-market-network" data-market-network="live-terminal-v8">
    ${pageHead('Qelly Intelligence · Global Market Network','Global Market Network','Cross-asset market context with explicit source, freshness and rights provenance. Cloudflare is the canonical data/API runtime; TradingView is display-only.',`<a class="q-button q-button--ghost" href="#/data-mesh">Provider policy</a><button class="q-button q-button--primary q-mn-refresh" data-action="refresh-network">Refresh</button>`)}${stateBanner()}

    <section class="q-mn-status-grid" aria-label="Market network status">
      <div class="q-mn-status"><span>Provider health</span><strong>${escapeHtml(`${availableCount} / ${sourceList.length} available`)}</strong><small>Canonical network</small></div>
      <div class="q-mn-status"><span>ECB reference</span><strong>${escapeHtml(ecb?.data?.rates?`${Object.keys(ecb.data.rates).length} rates`:'Unavailable')}</strong><small>${escapeHtml(stateLabel(ecb,{reference:true}))}</small></div>
      <div class="q-mn-status"><span>Crypto mids</span><strong>${escapeHtml(stateLabel(hyper))}</strong><small>Hyperliquid read-only</small></div>
      <div class="q-mn-status"><span>Sentiment / market</span><strong>${escapeHtml(stateLabel(alternative))}</strong><small>Alternative.me</small></div>
      <div class="q-mn-status"><span>Macro</span><strong>${escapeHtml(stateLabel(worldBank,{reference:true}))}</strong><small>World Bank reference</small></div>
    </section>

    <section class="q-mn-workbench">
      <section class="q-mn-panel q-mn-chart-panel">
        <div class="q-mn-chart-controls"><label><span>Cross-asset display</span><select id="q-mn-symbol">${CHART_PRESETS.map(([id,label,group])=>`<option value="${escapeHtml(id)}">${escapeHtml(group)} · ${escapeHtml(label)}</option>`).join('')}</select></label><label><span>Interval</span><select id="q-mn-interval">${INTERVALS.map((item)=>`<option value="${item}" ${item==='1h'?'selected':''}>${item}</option>`).join('')}</select></label><span class="q-status q-status--cached">TRADINGVIEW · DISPLAY ONLY</span></div>
        <div id="q-market-network-chart" class="q-mn-chart" aria-label="TradingView cross-asset external research chart"><div class="qelly-tradingview-loading" role="status"><span aria-hidden="true"></span><strong>Loading cross-asset market chart…</strong><small>Official TradingView display · Qelly tables remain available below</small></div></div>
        <div class="q-mn-attribution">TradingView is an external display boundary. Qelly does not scrape or reuse widget values. Qelly calculations, provider truth, alerts and decisions do not consume TradingView widget values.</div>
      </section>
      <aside class="q-mn-side">
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Live source board</h2><p>Fastest usable observations first</p></div><span class="q-mn-source-state" data-state="${availableCount?'live':'unavailable'}">${availableCount?'CONNECTED':'UNAVAILABLE'}</span></div><div class="q-mn-panel-body">${liveBoard({alternative,hyper,ecb,worldBank},escapeHtml)}</div></section>
        <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Production truth</h2><p>Connected runtime policy</p></div></div><div class="q-mn-panel-body"><div class="q-mn-live-board"><div class="q-mn-live-row"><div><strong>Release</strong><small>Canonical Cloudflare runtime identity</small></div><div class="q-mn-live-value"><b>${escapeHtml(network.releaseSha||'runtime')}</b><span>ACTIVE</span></div></div><div class="q-mn-live-row"><div><strong>Fabricated fallback</strong><small>No substitute price, candle, volume or market movement</small></div><div class="q-mn-live-value"><b>OFF</b><span>TRUTH</span></div></div><div class="q-mn-live-row"><div><strong>Internal execution</strong><small>Research and analytics only</small></div><div class="q-mn-live-value"><b>DISABLED</b><span>READ ONLY</span></div></div><div class="q-mn-live-row"><div><strong>Crypto provider rights</strong><small>Commercial/display policy boundary</small></div><div class="q-mn-live-value"><b>Coinbase / Binance blocked</b><span>RIGHTS</span></div></div></div><p class="q-mn-disclosure">No fabricated fallback values. No unrestricted-data fiction. CoinPaprika Free is not used for commercial production redistribution. CoinMarketCap keyless access is treated as evaluation/prototype access. ECB observations are official reference rates, not tick execution prices.</p></div></section>
      </aside>
    </section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Official research network</h2><p>Professional research dock · official research/display destinations kept separate from Qelly analytical inputs.</p></div></div><div class="q-mn-panel-body q-mn-links">${researchLinks.map((item)=>`<a class="q-mn-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer nofollow" title="${escapeHtml(item.note||item.mode)}"><strong>${escapeHtml(item.label)} ↗</strong><span>${escapeHtml(item.note||item.mode)}</span></a>`).join('')}</div></section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Crypto market reference</h2><p>Alternative.me public API · source-attributed market context</p></div><span class="q-mn-source-state" data-state="${escapeHtml(stateData(alternative))}">${escapeHtml(stateLabel(alternative))}</span></div><div class="q-mn-panel-body">${cryptoTable(alternative,escapeHtml)}</div><div class="q-mn-attribution">Data from Alternative.me. Research context only; no investment advice.</div></section>

    <section class="q-mn-dual">
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>ECB governed FX reference</h2><p>Official working-day reference rates · Qelly provider plane</p></div><span class="q-mn-source-state" data-state="${escapeHtml(stateData(ecb,{reference:true}))}">${escapeHtml(stateLabel(ecb,{reference:true}))}</span></div><div class="q-mn-panel-body">${ecbPanel(ecb,escapeHtml)}</div></section>
      <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Global macro context</h2><p>World Bank · latest annual GDP growth</p></div><span class="q-mn-source-state" data-state="reference">${escapeHtml(stateLabel(worldBank,{reference:true}))}</span></div><div class="q-mn-panel-body">${macroTable(worldBank,escapeHtml)}</div></section>
    </section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Provider provenance</h2><p>Availability, cadence and intended usage are visible at terminal level.</p></div></div><div class="q-mn-panel-body q-mn-source-grid">${sourceCard(alternative,escapeHtml)}${sourceCard(hyper,escapeHtml)}${sourceCard(ecb,escapeHtml,{reference:true})}${sourceCard(worldBank,escapeHtml,{reference:true})}</div></section>

    <section class="q-mn-panel"><div class="q-mn-panel-head"><div><h2>Research guides</h2><p>Transparent local checklists, not AI/model calls.</p></div></div><div class="q-mn-panel-body"><div class="q-mn-guides">${Object.entries(GUIDES).map(([id,value])=>`<button class="q-mn-guide" type="button" data-guide="${id}"><strong>${escapeHtml(id==='cross-asset'?'Cross-asset guide':id==='risk'?'Risk-state guide':'Macro guide')}</strong><span>${escapeHtml(value.split('\n')[1]||'Open workflow')}</span></button>`).join('')}</div><div id="q-mn-guide-output" class="q-mn-guide-output" hidden></div></div></section>
  </section>`;

  let chartHandle=null;
  const symbolSelect=main.querySelector('#q-mn-symbol');
  const intervalSelect=main.querySelector('#q-mn-interval');
  const chart=main.querySelector('#q-market-network-chart');
  const mountChart=()=>{
    chartHandle?.destroy?.();
    chartHandle=null;
    try{chartHandle=mountTradingViewDisplay(chart,{symbol:symbolSelect.value,interval:intervalSelect.value});}
    catch(error){
      chart.innerHTML=`<div class="q-mn-chart-fallback"><div><strong>TradingView display unavailable</strong><p>Source-backed Qelly tables remain available below.</p><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">Open TradingView ↗</a></div></div>`;
      toast?.(`External chart unavailable: ${error.message}`,{tone:'warning'});
    }
  };
  symbolSelect?.addEventListener('change',mountChart);
  intervalSelect?.addEventListener('change',mountChart);
  main.querySelector('[data-action="refresh-network"]')?.addEventListener('click',()=>{chartHandle?.destroy?.();void renderGlobalMarketNetwork(main,deps);});
  main.querySelectorAll('[data-guide]').forEach((button)=>button.addEventListener('click',()=>{const output=main.querySelector('#q-mn-guide-output');output.hidden=false;output.textContent=GUIDES[button.dataset.guide]||'';}));
  window.__qellyLiveMarketCleanup=()=>{chartHandle?.destroy?.();chartHandle=null;};
  mountChart();
}
