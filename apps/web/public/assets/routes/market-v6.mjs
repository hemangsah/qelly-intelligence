import {adSlot,mountAdSlots} from '../qelly-ad-slot.mjs';
import {mountTradingViewDisplay,mountTradingViewWidget,tradingViewAppearance,tradingViewSymbol} from '../market/tradingview-display-widget.mjs';
import {mountTradingViewMarketGrid} from '../market/tradingview-market-grid.mjs';
import {mountCoinMarketCapWidgets,mountHyperliquidStream,mountXTimeline,PROVIDER_PORTALS} from '../market/external-intelligence-widgets.mjs';
import {truthLabel} from '../customer-copy.mjs';

const EXTERNAL_SYMBOLS=Object.freeze([
  ['BTCUSDT','BTC / USDT'],
  ['ETHUSDT','ETH / USDT'],
  ['SOLUSDT','SOL / USDT'],
  ['BNBUSDT','BNB / USDT'],
  ['XRPUSDT','XRP / USDT'],
  ['ADAUSDT','ADA / USDT']
]);
const INTERVALS=Object.freeze([['5m','5m'],['15m','15m'],['1h','1h'],['4h','4h'],['1d','1D']]);
const MARKET_WIDGET_PANELS=Object.freeze([
  {id:'crypto-heatmap',label:'Crypto Coins Heatmap',kind:'cryptoHeatmap',size:'hero',description:'Market-cap-weighted crypto performance and relative movement across the market.',openUrl:'https://www.tradingview.com/heatmap/crypto/'},
  {id:'market-overview',label:'Market Overview',kind:'marketOverview',size:'tall',description:'Compare major indices, crypto, foreign exchange and India benchmarks.',openUrl:'https://www.tradingview.com/markets/'},
  {id:'crypto-market',label:'Crypto Market Screener',kind:'screener',size:'wide',description:'Scan crypto assets with sortable market and performance columns.',openUrl:'https://www.tradingview.com/crypto-coins/screener/'},
  {id:'economic-calendar',label:'Economic Calendar',kind:'economicCalendar',size:'standard',description:'Review scheduled macro releases and event risk across major economies.',openUrl:'https://www.tradingview.com/economic-calendar/'},
  {id:'stock-heatmap',label:'Stock Heatmap',kind:'stockHeatmap',size:'standard',description:'See United States equity sectors and relative one-day performance.',openUrl:'https://www.tradingview.com/heatmap/stock/'},
  {id:'etf-heatmap',label:'ETF Heatmap',kind:'etfHeatmap',size:'standard',description:'Compare exchange-traded funds by activity and performance.',openUrl:'https://www.tradingview.com/heatmap/etf/'},
  {id:'fx-heatmap',label:'Forex Heatmap',kind:'forexHeatmap',size:'standard',description:'Compare relative strength and weakness across major currencies.',openUrl:'https://www.tradingview.com/markets/currencies/rates-all/'},
  {id:'technicals',label:'Technical Analysis',kind:'technicalAnalysis',size:'standard',dynamic:true,description:'Review a technical summary for the symbol selected in Market Pulse.',openUrl:'https://www.tradingview.com/technical-analysis/'},
  {id:'stories',label:'Top Stories',kind:'topStories',size:'standard',description:'Read concise market headlines and current context from TradingView.',openUrl:'https://www.tradingview.com/news/'}
]);
const INTELLIGENCE_DOCK_PANELS=Object.freeze([
  {id:'hyperliquid',label:'Live book & trades',description:'Public Hyperliquid BTC, ETH, SOL and HYPE order books and executed trades over the official read-only WebSocket.'},
  {id:'coinmarketcap',label:'CoinMarketCap',description:'Official live website widgets for Bitcoin, Ethereum and Solana market reference.'},
  {id:'x-pulse',label:'X market pulse',description:'Official public X timeline from CoinMarketCap with personalization disabled.'},
  {id:'provider-portals',label:'Research portals',description:'Governed launch surfaces for providers that block framing or require approved API access.'}
]);
const tone=(value)=>{const state=String(value||'').toUpperCase();if(['ENABLED','REFERENCE_ENABLED','LIVE','MATCH','PASS'].includes(state))return 'live';if(['DELAYED','DELAYED_PROVIDER','WARNING','CACHED','CACHED_PROVIDER'].includes(state))return 'delayed';if(['UNAVAILABLE','DENY','MISMATCH','BLOCKED'].includes(state))return 'unavailable';return 'cached';};
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};
const value=(input)=>input==null||input===''?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(input));
function governedRates(ecb,escapeHtml){
  const rates=ecb?.data?.rates||{};
  const preferred=['USD','INR','GBP','JPY','CHF','CNY','CAD','AUD','SGD','AED'];
  const rows=preferred.filter(code=>rates[code]!=null).map(code=>[code,rates[code]]);
  if(!rows.length)return '<div class="q-empty-state"><strong>ECB observations unavailable</strong><p>No approved reference observations were returned. Qelly will not substitute generated values.</p></div>';
  const observedAt=ecb?.observationTime||ecb?.observedAt||null;
  return rows.map(([code,rate])=>`<article class="q-v7-rate-card"><span>EUR / ${escapeHtml(code)}</span><strong>${escapeHtml(value(rate))}</strong><small>Observed ${escapeHtml(date(observedAt))}</small></article>`).join('');
}

function sourceRows(source,escapeHtml){
  const rows=Array.isArray(source?.data)?source.data:[];
  if(source?.id==='alternative-me'){
    const assets=Array.isArray(source?.data?.assets)?source.data.assets.slice(0,5):[];
    const sentiment=source?.data?.sentiment;
    return `${sentiment?`<div><span>Fear & Greed</span><strong>${escapeHtml(value(sentiment.value))}</strong><small>${escapeHtml(sentiment.classification)}</small></div>`:''}${assets.map((row)=>`<div><span>${escapeHtml(row.symbol)}</span><strong>$${escapeHtml(value(row.priceUsd))}</strong><small>${escapeHtml(value(row.change24hPct))}% · 24h</small></div>`).join('')}`;
  }
  if(source?.id==='hyperliquid')return rows.slice(0,6).map((row)=>`<div><span>${escapeHtml(row.symbol)}</span><strong>$${escapeHtml(value(row.mid))}</strong><small>Read-only midpoint</small></div>`).join('');
  if(source?.id==='world-bank')return rows.slice(0,7).map((row)=>`<div><span>${escapeHtml(row.countryId)}</span><strong>${escapeHtml(value(row.gdpGrowthPct))}%</strong><small>GDP growth · ${escapeHtml(row.year)}</small></div>`).join('');
  if(source?.id==='us-treasury')return rows.slice(0,7).map((row)=>`<div><span>${escapeHtml(row.security)}</span><strong>${escapeHtml(value(row.averageInterestRatePct))}%</strong><small>Monthly average · ${escapeHtml(row.recordDate)}</small></div>`).join('');
  if(source?.id==='imf')return rows.slice(0,7).map((row)=>`<div><span>${escapeHtml(row.country)}</span><strong>${escapeHtml(value(row.growthPct))}%</strong><small>Real GDP growth · ${escapeHtml(row.year)}${row.estimateOrProjection?' estimate / projection':''}</small></div>`).join('');
  return '';
}

function networkSourceCard(source,escapeHtml){
  const rows=sourceRows(source,escapeHtml);
  const state=String(source?.truthState||'unavailable').toUpperCase();
  return `<article class="q-public-source-card" data-source="${escapeHtml(source?.id||'source')}"><header><div><span>${escapeHtml(source?.label||source?.id||'External source')}</span><small>${escapeHtml(source?.attribution||'External provider')}</small></div><em class="q-status q-status--${tone(state)}">${escapeHtml(truthLabel(state))}</em></header><div class="q-public-source-values">${rows||'<p>No current observations were returned. Qelly has not substituted values.</p>'}</div><footer><span>${escapeHtml(source?.cadence||source?.usage||'Source cadence disclosed by provider.')}</span>${source?.docsUrl?`<a href="${escapeHtml(source.docsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Source docs ↗</a>`:''}</footer></article>`;
}

function populateNetworkSections(root,network,escapeHtml){
  if(!root?.isConnected)return;
  const networkSources=Object.values(network?.sources||{});
  const sourceGrid=root.querySelector('[data-public-source-grid]');
  const sourceStatus=root.querySelector('[data-public-source-status]');
  if(sourceGrid)sourceGrid.innerHTML=networkSources.map((source)=>networkSourceCard(source,escapeHtml)).join('')||'<div class="q-empty-state"><strong>Public data network unavailable</strong><p>No source values were substituted.</p></div>';
  if(sourceStatus){sourceStatus.className=`q-status q-status--${networkSources.some((source)=>source?.truthState==='live')?'live':'delayed'}`;sourceStatus.textContent=`${networkSources.filter((source)=>source?.data!=null).length} SOURCES AVAILABLE`;}
}

function panelConfig(panel,{symbol,interval}){
  const colorTheme=tradingViewAppearance();
  const shared={colorTheme,isTransparent:false,width:'100%',height:'100%'};
  if(panel.kind==='marketOverview')return {...shared,dateRange:'12M',showChart:true,showFloatingTooltip:true,showSymbolLogo:true,tabs:[
    {title:'Indices',symbols:[{s:'FOREXCOM:SPXUSD',d:'S&P 500'},{s:'FOREXCOM:NSXUSD',d:'Nasdaq 100'},{s:'TVC:DJI',d:'Dow Jones'},{s:'TVC:NI225',d:'Nikkei 225'}]},
    {title:'Crypto',symbols:[{s:'BITSTAMP:BTCUSD',d:'Bitcoin'},{s:'BITSTAMP:ETHUSD',d:'Ethereum'},{s:'BINANCE:SOLUSDT',d:'Solana'},{s:'BINANCE:XRPUSDT',d:'XRP'}]},
    {title:'Forex',symbols:[{s:'FX_IDC:EURUSD',d:'EUR / USD'},{s:'FX_IDC:GBPUSD',d:'GBP / USD'},{s:'FX_IDC:USDJPY',d:'USD / JPY'},{s:'FX_IDC:USDINR',d:'USD / INR'}]},
    {title:'India',symbols:[{s:'NSE:NIFTY',d:'Nifty 50'},{s:'BSE:SENSEX',d:'Sensex'},{s:'NSE:BANKNIFTY',d:'Bank Nifty'},{s:'NSE:INDIAVIX',d:'India VIX'}]}
  ]};
  if(panel.kind==='screener')return {...shared,market:panel.market||'crypto',showToolbar:true,defaultColumn:'overview',defaultScreen:'general'};
  if(panel.kind==='economicCalendar')return {...shared,countryFilter:'ar,au,br,ca,cn,fr,de,in,id,it,jp,kr,mx,ru,sa,za,tr,gb,us,eu',importanceFilter:'-1,0,1'};
  if(panel.kind==='technicalAnalysis')return {...shared,symbol:tradingViewSymbol(symbol),interval:interval==='1d'?'1D':String(interval||'15m'),showIntervalTabs:true,displayMode:'multiple'};
  if(panel.kind==='cryptoHeatmap')return {...shared,dataSource:'Crypto',blockSize:'market_cap_calc',blockColor:'24h_close_change|5',hasTopBar:true,isDataSetEnabled:true,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false};
  if(panel.kind==='stockHeatmap')return {...shared,dataSource:'SPX500',blockSize:'market_cap_basic',blockColor:'change',grouping:'sector',locale:'en',symbolUrl:'',hasTopBar:true,isDataSetEnabled:true,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false};
  if(panel.kind==='etfHeatmap')return {...shared,dataSource:'AllUSEtf',blockSize:'volume',blockColor:'change',grouping:'asset_class',locale:'en',symbolUrl:'',hasTopBar:true,isDataSetEnabled:true,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false};
  if(panel.kind==='forexHeatmap')return {...shared,currencies:['EUR','USD','JPY','GBP','CHF','AUD','CAD','NZD','CNY']};
  if(panel.kind==='forexCrossRates')return {...shared,currencies:['EUR','USD','JPY','GBP','CHF','AUD','CAD','NZD','CNY','INR']};
  if(panel.kind==='symbolOverview')return {...shared,symbols:[['S&P 500','FOREXCOM:SPXUSD|12M'],['Nifty 50','NSE:NIFTY|12M'],['Gold','OANDA:XAUUSD|12M'],['Bitcoin','BITSTAMP:BTCUSD|12M']],chartOnly:false,dateRange:'12M',showVolume:false,showMA:false,hideDateRanges:false,hideMarketStatus:false,hideSymbolLogo:false,scalePosition:'right',scaleMode:'Normal',fontFamily:'-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',fontSize:'10',noTimeScale:false,valuesTracking:'1',changeMode:'price-and-percent'};
  if(panel.kind==='miniChart')return {...shared,symbol:tradingViewSymbol(symbol),dateRange:'12M',trendLineColor:'#b44b73',underLineColor:'rgba(180,75,115,.28)',underLineBottomColor:'rgba(180,75,115,0)',isTransparent:false,autosize:true,largeChartUrl:''};
  if(panel.kind==='marketQuotes')return {...shared,symbolGroups:[{name:'Indices',symbols:[{name:'FOREXCOM:SPXUSD',displayName:'S&P 500'},{name:'NASDAQ:NDX',displayName:'Nasdaq 100'},{name:'NSE:NIFTY',displayName:'Nifty 50'},{name:'TVC:NI225',displayName:'Nikkei 225'}]},{name:'Commodities & FX',symbols:[{name:'OANDA:XAUUSD',displayName:'Gold'},{name:'TVC:USOIL',displayName:'WTI Oil'},{name:'FX_IDC:EURUSD',displayName:'EUR / USD'},{name:'FX_IDC:USDINR',displayName:'USD / INR'}]},{name:'Crypto',symbols:[{name:'BITSTAMP:BTCUSD',displayName:'Bitcoin'},{name:'BITSTAMP:ETHUSD',displayName:'Ethereum'},{name:'BINANCE:SOLUSDT',displayName:'Solana'}]}],showSymbolLogo:true,isTransparent:false};
  return {...shared,feedMode:'market',market:'crypto',displayMode:'regular'};
}

function portalGrid(escapeHtml){
  return `<div class="q-intel-portal-grid">${PROVIDER_PORTALS.map(portal=>`<article class="q-intel-portal"><div><span>${escapeHtml(portal.name)}</span><em>${escapeHtml(portal.access)}</em></div><strong>${escapeHtml(portal.description)}</strong><p>${escapeHtml(portal.reason)}</p><a href="${escapeHtml(portal.url)}" target="_blank" rel="noopener noreferrer nofollow">Open ${escapeHtml(portal.name)} ↗</a></article>`).join('')}</div>`;
}

function mountExternalIntelligenceDock(root,{escapeHtml}){
  const stage=root.querySelector('[data-intel-dock-stage]');
  const title=root.querySelector('[data-intel-dock-title]');
  const description=root.querySelector('[data-intel-dock-description]');
  const buttons=[...root.querySelectorAll('[data-intel-dock-tab]')];
  let activeId='hyperliquid',handle=null,mounted=false;
  const activate=(id,{focus=false}={})=>{
    const panel=INTELLIGENCE_DOCK_PANELS.find(item=>item.id===id)||INTELLIGENCE_DOCK_PANELS[0];
    activeId=panel.id;mounted=true;handle?.destroy?.();handle=null;stage.replaceChildren();
    for(const button of buttons){const selected=button.dataset.intelDockTab===panel.id;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}
    if(focus)buttons.find(button=>button.dataset.intelDockTab===panel.id)?.focus();
    title.textContent=panel.label;description.textContent=panel.description;
    if(panel.id==='hyperliquid')handle=mountHyperliquidStream(stage,{coin:'BTC'});
    if(panel.id==='coinmarketcap')handle=mountCoinMarketCapWidgets(stage);
    if(panel.id==='x-pulse')handle=mountXTimeline(stage,{handle:'CoinMarketCap'});
    if(panel.id==='provider-portals'){stage.dataset.externalState='launch-only';stage.innerHTML=portalGrid(escapeHtml);}
  };
  buttons.forEach((button,index)=>{
    button.addEventListener('click',()=>activate(button.dataset.intelDockTab));
    button.addEventListener('keydown',(event)=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      activate(buttons[next].dataset.intelDockTab,{focus:true});
    });
  });
  const intersection='IntersectionObserver'in window?new IntersectionObserver((entries)=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    intersection.disconnect();activate(activeId);
  },{rootMargin:'360px 0px'}):null;
  if(intersection)intersection.observe(root);else activate(activeId);
  return {refresh(){if(mounted&&activeId==='x-pulse')activate(activeId);},destroy(){intersection?.disconnect();handle?.destroy?.();handle=null;}};
}

export async function renderMarketV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  const ecb=await api('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR').catch(()=>null);
  const symbolOptions=EXTERNAL_SYMBOLS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const intervalOptions=INTERVALS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const ecbObservedAt=ecb?.observationTime||ecb?.observedAt||null;
  const ecbIngestedAt=ecb?.ingestionTime||ecb?.ingestedAt||null;
  const ecbTruth=String(ecb?.truthState||'unavailable').toUpperCase();

  main.innerHTML=`<section class="q-page q-market-home q-v7-public-market" data-market-runtime="v7-public-no-fabrication" data-qelly-v7-public-market="true">
    ${pageHead('Qelly Intelligence · Market Command','Market Pulse','Explore live market charts and reference observations with clear source and freshness. Missing market data is never replaced with invented values.',`<a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a><a class="q-button q-button--primary" href="#/research-workspace">Open research workspace</a>`)}
    <section class="q-market-principle" aria-label="Market intelligence principle">
      <div><span class="q-eyebrow">Market discipline</span><strong>Price is an observation; risk is a decision.</strong></div>
      <div class="q-market-principle__rules"><span>Verify freshness</span><span>Separate signal from story</span><span>Keep execution outside research</span></div>
    </section>
    ${stateBanner()}

    <section class="q-market-widget-section" data-market-widget-grid aria-labelledby="q-market-widget-title">
      <header class="q-market-widget-section__head">
        <div><p class="q-eyebrow">Market map</p><h2 id="q-market-widget-title">See the market before narrowing the question.</h2><p>Start with crypto breadth, then compare cross-asset, macro, equity and currency context as needed.</p></div>
        <a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">Market data by TradingView ↗</a>
      </header>
      <div class="q-market-widget-grid">
        ${MARKET_WIDGET_PANELS.map((panel,index)=>`<article class="q-market-widget-card q-market-widget-card--${panel.size}" data-market-widget-id="${panel.id}" data-market-widget-priority="${index===0?'primary':'secondary'}">
          <header><div><span>${index===0?'Start here':'Market reference'}</span><h3>${panel.label}</h3><p>${panel.description}</p></div></header>
          <div class="q-market-widget-stage" data-market-widget-stage aria-label="${panel.label}"><div class="q-market-widget-note"><strong>${index===0?'Preparing market breadth':'Loads when needed'}</strong><span>${index===0?'Qelly content is ready; market reference is connecting.':'This view connects as you approach it.'}</span></div></div>
        </article>`).join('')}
      </div>
    </section>

    <section class="q-tv-tape-shell" aria-label="TradingView cross-asset ticker tape">
      <div id="q-tv-ticker-tape" class="q-tv-ticker-stage"></div>
      <p>Reference display only · ticker observations are never consumed by Qelly calculations.</p>
    </section>

    <div class="q-v7-market-grid">
      <section class="q-panel q-v7-chart-panel">
        <div class="q-panel-head"><div><p class="q-eyebrow">Market chart</p><h2>TradingView market visualization</h2><p>Human-readable display only. Widget observations are not ingested, scraped, persisted or consumed by Qelly analytics.</p></div><span class="q-status q-status--cached">DISPLAY ONLY</span></div>
        <div class="q-panel-body">
          <div class="q-control-row q-v6-market-controls"><label class="q-setting"><span>Display symbol</span><select id="v6-market-symbol">${symbolOptions}</select></label><label class="q-setting"><span>Display interval</span><select id="v6-market-interval">${intervalOptions}</select></label><div class="q-setting q-query-boundary"><span>Research use</span><strong>External values excluded</strong><small>Never used for Qelly calculations, risk, alerts or decisions.</small></div></div>
          <div id="v6-market-tradingview" class="q-v7-chart-stage q-v6-market-tradingview" aria-label="TradingView external market chart"></div>
          <div class="q-chart-attribution"><span>TradingView display only</span><span>Displayed widget values are not used in Qelly calculations.</span></div>
        </div>
      </section>

      <aside class="q-v7-side-stack">
        <section class="q-panel"><div class="q-panel-head"><div><h2>Professional research links</h2><p>External sources open in separate trust boundaries.</p></div></div><div class="q-panel-body q-v7-link-grid"><a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a><a class="q-button q-button--secondary" href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory Calendar ↗</a><a class="q-button q-button--secondary" href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB Reference Rates ↗</a><a class="q-button q-button--secondary" href="https://www.cmegroup.com/markets.html" target="_blank" rel="noopener noreferrer nofollow">CME Markets ↗</a></div></section>
      </aside>
    </div>

    <section class="q-panel q-intel-dock" data-external-intelligence-dock>
      <div class="q-panel-head"><div><p class="q-eyebrow">Live market context</p><h2>Live market structure and research networks</h2><p>Provider-supported embeds and public read-only streams are isolated from Qelly analytics. Services that prohibit framing remain transparent launch surfaces.</p></div><span class="q-status q-status--cached">READ ONLY</span></div>
      <div class="q-panel-body">
        <div class="q-tv-suite-tabs q-intel-dock-tabs" role="tablist" aria-label="Choose an external intelligence display">${INTELLIGENCE_DOCK_PANELS.map((panel,index)=>`<button type="button" role="tab" aria-selected="${index===0?'true':'false'}" aria-controls="q-intel-dock-stage" tabindex="${index===0?'0':'-1'}" data-intel-dock-tab="${panel.id}">${panel.label}</button>`).join('')}</div>
        <div class="q-tv-suite-context"><div><strong data-intel-dock-title>Live book & trades</strong><p data-intel-dock-description>${INTELLIGENCE_DOCK_PANELS[0].description}</p></div><span>External observations · never execution</span></div>
        <div id="q-intel-dock-stage" class="q-intel-dock-stage" role="tabpanel" data-intel-dock-stage aria-live="polite"><div class="q-tv-suite-placeholder"><strong>Live market structure ready</strong><span>Scroll this panel into view to connect the read-only public stream.</span></div></div>
      </div>
    </section>

    <section class="q-panel q-public-data-board"><div class="q-panel-head"><div><p class="q-eyebrow">Market data sources</p><h2>Global public data board</h2><p>Official/public feeds keep their own cadence, attribution and truth state. Reference observations are never presented as tradable quotes.</p></div><span class="q-status q-status--cached" data-public-source-status>LOADING SOURCES</span></div><div class="q-panel-body q-public-source-grid" data-public-source-grid><div class="q-empty-state"><strong>Connecting public data network</strong><p>Slow reference providers load in the background and never block Market Command.</p></div></div></section>

    ${adSlot('market-intelligence-inline')}

    <section class="q-panel q-v7-reference-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Approved reference observations</p><h2>ECB euro reference rates</h2><p>Source timing is preserved. Reference rates are informational and are not tradable quotes.</p></div><span class="q-status q-status--${tone(ecb?.truthState)}">${escapeHtml(truthLabel(ecbTruth))}</span></div><div class="q-panel-body"><div class="q-v7-rate-grid">${governedRates(ecb,escapeHtml)}</div><div class="q-v7-evidence-strip"><span>Source: European Central Bank</span><span>Observed: ${escapeHtml(date(ecbObservedAt))}</span><span>Updated: ${escapeHtml(date(ecbIngestedAt))}</span><span>Research only</span></div></div></section>

  </section>`;

  mountAdSlots(main);
  const marketRoot=main.querySelector('[data-qelly-v7-public-market]');
  const chart=marketRoot.querySelector('#v6-market-tradingview');
  const symbol=marketRoot.querySelector('#v6-market-symbol');
  const interval=marketRoot.querySelector('#v6-market-interval');
  const ticker=marketRoot.querySelector('#q-tv-ticker-tape');
  const marketGrid=marketRoot.querySelector('[data-market-widget-grid]');
  const intelligenceDock=marketRoot.querySelector('[data-external-intelligence-dock]');
  let handle=null,tickerHandle=null,marketGridHandle=null,intelligenceDockHandle=null,themeFrame=0;
  // Evidence aliases are immediately handed to the local Qelly Verify surface.
  // Avoid starting market reference widgets during that transient handoff.
  const verifyAliasActive=/^#\/market\?[^#]*view=(?:qelly-verify|evidence-methodology)(?:&|$)/i.test(location.hash);
  const mountTicker=()=>{
    tickerHandle?.destroy?.();
    tickerHandle=mountTradingViewWidget(ticker,{kind:'tickerTape',label:'Cross-asset ticker tape',openUrl:'https://www.tradingview.com/markets/',config:{colorTheme:tradingViewAppearance(),isTransparent:false,displayMode:'adaptive',showSymbolLogo:true,symbols:[
      {proName:'FOREXCOM:SPXUSD',title:'S&P 500'},{proName:'NASDAQ:NDX',title:'Nasdaq 100'},{proName:'NSE:NIFTY',title:'Nifty 50'},{proName:'FX_IDC:USDINR',title:'USD / INR'},{proName:'OANDA:XAUUSD',title:'Gold'},{proName:'BITSTAMP:BTCUSD',title:'Bitcoin'},{proName:'BITSTAMP:ETHUSD',title:'Ethereum'}
    ]}});
  };
  const mount=()=>{handle?.destroy?.();handle=mountTradingViewDisplay(chart,{symbol:symbol.value,interval:interval.value});marketGridHandle?.update({symbol:symbol.value,interval:interval.value});};
  const lazyMount=(element,callback)=>{
    if(!element)return {disconnect(){}};
    if(!('IntersectionObserver'in window)){callback();return {disconnect(){}};}
    const observer=new IntersectionObserver((entries)=>{if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();callback();},{rootMargin:'280px 0px',threshold:0.01});
    observer.observe(element);return observer;
  };
  let tickerObserver=null,chartObserver=null;
  if(!verifyAliasActive){
    const gridPanels=MARKET_WIDGET_PANELS.map(panel=>({...panel,config:(context)=>panelConfig(panel,context)}));
    marketGridHandle=mountTradingViewMarketGrid(marketGrid,{panels:gridPanels,context:{symbol:symbol.value,interval:interval.value}});
    intelligenceDockHandle=mountExternalIntelligenceDock(intelligenceDock,{escapeHtml});
    tickerObserver=lazyMount(ticker,mountTicker);
    chartObserver=lazyMount(chart,mount);
    symbol?.addEventListener('change',mount);interval?.addEventListener('change',mount);
  }
  api('/api/v1/market/network').then((network)=>populateNetworkSections(marketRoot,network,escapeHtml)).catch(()=>populateNetworkSections(marketRoot,{sources:{},providerDirectory:[],providerDirectorySummary:{byIntegration:{}}},escapeHtml));
  const themeObserver=new MutationObserver(()=>{
    cancelAnimationFrame(themeFrame);
    themeFrame=requestAnimationFrame(()=>{if(handle)mount();if(tickerHandle)mountTicker();marketGridHandle?.refresh();intelligenceDockHandle?.refresh();});
  });
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-appearance','data-resolved-appearance']});
  window.__qellyMarketV6Cleanup=()=>{cancelAnimationFrame(themeFrame);themeObserver.disconnect();tickerObserver?.disconnect?.();chartObserver?.disconnect?.();handle?.destroy?.();tickerHandle?.destroy?.();marketGridHandle?.destroy?.();intelligenceDockHandle?.destroy?.();handle=null;tickerHandle=null;marketGridHandle=null;intelligenceDockHandle=null;};
}

export const __marketV6Test=Object.freeze({EXTERNAL_SYMBOLS,INTERVALS,MARKET_WIDGET_PANELS,INTELLIGENCE_DOCK_PANELS,tone,panelConfig});
