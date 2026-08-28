import {mountTradingViewDisplay,mountTradingViewWidget,tradingViewAppearance,tradingViewSymbol} from '../market/tradingview-display-widget.mjs';
import {mountCoinMarketCapWidgets,mountHyperliquidStream,mountXTimeline,PROVIDER_PORTALS} from '../market/external-intelligence-widgets.mjs';
import {providerAvailability,providerPolicyMessage,truthLabel} from '../customer-copy.mjs';

const EXTERNAL_SYMBOLS=Object.freeze([
  ['BTCUSDT','BTC / USDT'],
  ['ETHUSDT','ETH / USDT'],
  ['SOLUSDT','SOL / USDT'],
  ['BNBUSDT','BNB / USDT'],
  ['XRPUSDT','XRP / USDT'],
  ['ADAUSDT','ADA / USDT']
]);
const INTERVALS=Object.freeze([['5m','5m'],['15m','15m'],['1h','1h'],['4h','4h'],['1d','1D']]);
const EMBED_PANELS=Object.freeze([
  {id:'overview',label:'Market overview',kind:'marketOverview',description:'Indices, crypto, foreign exchange and India benchmarks in one comparative display.',openUrl:'https://www.tradingview.com/markets/'},
  {id:'screener',label:'Screener',kind:'screener',description:'Sortable crypto market discovery with overview and performance columns.',openUrl:'https://www.tradingview.com/crypto-coins/screener/'},
  {id:'us-screener',label:'US market',kind:'screener',market:'america',description:'United States equities screener with performance, valuation and technical columns.',openUrl:'https://www.tradingview.com/markets/stocks-usa/market-movers-all-stocks/'},
  {id:'india-screener',label:'India market',kind:'screener',market:'india',description:'Indian equities screener spanning NSE and BSE market research.',openUrl:'https://www.tradingview.com/markets/stocks-india/market-movers-all-stocks/'},
  {id:'hong-kong-screener',label:'Hong Kong market',kind:'screener',market:'hongkong',description:'Hong Kong equities and Hang Seng market research surface.',openUrl:'https://www.tradingview.com/markets/stocks-hong-kong/market-movers-all-stocks/'},
  {id:'calendar',label:'Economic calendar',kind:'economicCalendar',description:'Scheduled macro releases across the world’s largest economies.',openUrl:'https://www.tradingview.com/economic-calendar/'},
  {id:'technicals',label:'Technicals',kind:'technicalAnalysis',description:'Display-only technical summary for the symbol selected above.',openUrl:'https://www.tradingview.com/technical-analysis/'},
  {id:'heatmap',label:'Crypto heatmap',kind:'cryptoHeatmap',description:'Market-cap-weighted crypto performance and relative movement.',openUrl:'https://www.tradingview.com/heatmap/crypto/'},
  {id:'stock-heatmap',label:'Stock heatmap',kind:'stockHeatmap',description:'United States equity sectors and relative performance in an official heatmap.',openUrl:'https://www.tradingview.com/heatmap/stock/'},
  {id:'forex',label:'FX cross rates',kind:'forexCrossRates',description:'Comparative foreign-exchange cross-rate display across major currencies.',openUrl:'https://www.tradingview.com/markets/currencies/rates-all/'},
  {id:'stories',label:'Top stories',kind:'topStories',description:'External market headlines for human research and contextual review.',openUrl:'https://www.tradingview.com/news/'},
  {id:'symbol-overview',label:'Symbol overview',kind:'symbolOverview',description:'Comparative price context for major global asset classes.',openUrl:'https://www.tradingview.com/markets/'},
  {id:'mini-chart',label:'Mini chart',kind:'miniChart',description:'Compact display for the symbol selected in the terminal.',openUrl:'https://www.tradingview.com/chart/'},
  {id:'market-quotes',label:'Market quotes',kind:'marketQuotes',description:'Grouped indices, commodities, foreign exchange and crypto quote display.',openUrl:'https://www.tradingview.com/markets/'}
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
const integrationLabel=(input)=>String(input||'catalogued').replaceAll('-',' ');

function providerCard(provider,escapeHtml){
  const availability=providerAvailability(provider);
  return `<article class="q-v7-provider-card" data-provider="${escapeHtml(provider.id)}">
    <div><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><span class="q-status q-status--${availability.tone}">${escapeHtml(availability.label)}</span></div>
    <p>${escapeHtml(providerPolicyMessage(provider))}</p>
    ${provider.termsUrl?`<a href="${escapeHtml(provider.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Provider terms ↗</a>`:''}
  </article>`;
}

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

function providerAtlasCard(provider,escapeHtml){
  return `<article class="q-provider-atlas-card" data-provider-atlas-card data-search="${escapeHtml(`${provider.name} ${provider.category} ${provider.integration} ${(provider.aliases||[]).join(' ')}`.toLowerCase())}" data-integration="${escapeHtml(provider.integration)}"><div><strong>${escapeHtml(provider.name)}</strong><span>${escapeHtml(integrationLabel(provider.integration))}</span></div><small>${escapeHtml(provider.category)}</small><p>${escapeHtml(provider.note)}</p>${provider.url?`<a href="${escapeHtml(provider.url)}" target="_blank" rel="noopener noreferrer nofollow">Official / supplied destination ↗</a>`:'<em>No approved public destination recorded</em>'}</article>`;
}

function bindProviderAtlas(root){
  const search=root.querySelector('[data-provider-atlas-search]');
  const filter=root.querySelector('[data-provider-atlas-filter]');
  const count=root.querySelector('[data-provider-atlas-count]');
  const cards=[...root.querySelectorAll('[data-provider-atlas-card]')];
  const apply=()=>{
    const query=String(search?.value||'').trim().toLowerCase();
    const integration=String(filter?.value||'all');
    let visible=0;
    for(const card of cards){const show=(!query||card.dataset.search.includes(query))&&(integration==='all'||card.dataset.integration===integration);card.hidden=!show;if(show)visible+=1;}
    if(count)count.textContent=`${visible} of ${cards.length} providers`;
  };
  search?.addEventListener('input',apply);filter?.addEventListener('change',apply);apply();
}

function populateNetworkSections(root,network,escapeHtml){
  if(!root?.isConnected)return;
  const networkSources=Object.values(network?.sources||{});
  const providerDirectory=Array.isArray(network?.providerDirectory)?network.providerDirectory:[];
  const integrationModes=Object.keys(network?.providerDirectorySummary?.byIntegration||{}).sort();
  const sourceGrid=root.querySelector('[data-public-source-grid]');
  const sourceStatus=root.querySelector('[data-public-source-status]');
  const atlas=root.querySelector('[data-provider-atlas]');
  const atlasStatus=root.querySelector('[data-provider-atlas-status]');
  const atlasFilter=atlas?.querySelector('[data-provider-atlas-filter]');
  const atlasGrid=atlas?.querySelector('[data-provider-atlas-grid]');
  if(sourceGrid)sourceGrid.innerHTML=networkSources.map((source)=>networkSourceCard(source,escapeHtml)).join('')||'<div class="q-empty-state"><strong>Public data network unavailable</strong><p>No source values were substituted.</p></div>';
  if(sourceStatus){sourceStatus.className=`q-status q-status--${networkSources.some((source)=>source?.truthState==='live')?'live':'delayed'}`;sourceStatus.textContent=`${networkSources.filter((source)=>source?.data!=null).length} SOURCES AVAILABLE`;}
  if(atlasFilter)atlasFilter.innerHTML=`<option value="all">All states</option>${integrationModes.map((mode)=>`<option value="${escapeHtml(mode)}">${escapeHtml(integrationLabel(mode))}</option>`).join('')}`;
  if(atlasGrid)atlasGrid.innerHTML=providerDirectory.map((provider)=>providerAtlasCard(provider,escapeHtml)).join('')||'<div class="q-empty-state"><strong>Provider atlas unavailable</strong><p>The supplied candidates could not be loaded.</p></div>';
  if(atlasStatus)atlasStatus.textContent=`${providerDirectory.length} CATALOGUED`;
  bindProviderAtlas(atlas);
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
  if(panel.kind==='forexCrossRates')return {...shared,currencies:['EUR','USD','JPY','GBP','CHF','AUD','CAD','NZD','CNY','INR']};
  if(panel.kind==='symbolOverview')return {...shared,symbols:[['S&P 500','FOREXCOM:SPXUSD|12M'],['Nifty 50','NSE:NIFTY|12M'],['Gold','OANDA:XAUUSD|12M'],['Bitcoin','BITSTAMP:BTCUSD|12M']],chartOnly:false,dateRange:'12M',showVolume:false,showMA:false,hideDateRanges:false,hideMarketStatus:false,hideSymbolLogo:false,scalePosition:'right',scaleMode:'Normal',fontFamily:'-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',fontSize:'10',noTimeScale:false,valuesTracking:'1',changeMode:'price-and-percent'};
  if(panel.kind==='miniChart')return {...shared,symbol:tradingViewSymbol(symbol),dateRange:'12M',trendLineColor:'#b44b73',underLineColor:'rgba(180,75,115,.28)',underLineBottomColor:'rgba(180,75,115,0)',isTransparent:false,autosize:true,largeChartUrl:''};
  if(panel.kind==='marketQuotes')return {...shared,symbolGroups:[{name:'Indices',symbols:[{name:'FOREXCOM:SPXUSD',displayName:'S&P 500'},{name:'NASDAQ:NDX',displayName:'Nasdaq 100'},{name:'NSE:NIFTY',displayName:'Nifty 50'},{name:'TVC:NI225',displayName:'Nikkei 225'}]},{name:'Commodities & FX',symbols:[{name:'OANDA:XAUUSD',displayName:'Gold'},{name:'TVC:USOIL',displayName:'WTI Oil'},{name:'FX_IDC:EURUSD',displayName:'EUR / USD'},{name:'FX_IDC:USDINR',displayName:'USD / INR'}]},{name:'Crypto',symbols:[{name:'BITSTAMP:BTCUSD',displayName:'Bitcoin'},{name:'BITSTAMP:ETHUSD',displayName:'Ethereum'},{name:'BINANCE:SOLUSDT',displayName:'Solana'}]}],showSymbolLogo:true,isTransparent:false};
  return {...shared,feedMode:'market',market:'crypto',displayMode:'regular'};
}

function mountEmbedSuite(root,{symbol,interval}){
  const stage=root.querySelector('[data-tv-suite-stage]');
  const title=root.querySelector('[data-tv-suite-title]');
  const description=root.querySelector('[data-tv-suite-description]');
  const buttons=[...root.querySelectorAll('[data-tv-suite-tab]')];
  let parameters={symbol,interval};
  let activeId='overview';
  let handle=null;
  let mounted=false;
  const activate=(id,{focus=false}={})=>{
    const panel=EMBED_PANELS.find(item=>item.id===id)||EMBED_PANELS[0];
    activeId=panel.id;
    mounted=true;
    for(const button of buttons){
      const selected=button.dataset.tvSuiteTab===panel.id;
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    }
    if(focus)buttons.find(button=>button.dataset.tvSuiteTab===panel.id)?.focus();
    title.textContent=panel.label;
    description.textContent=panel.description;
    handle?.destroy?.();
    handle=mountTradingViewWidget(stage,{kind:panel.kind,label:panel.label,openUrl:panel.openUrl,config:panelConfig(panel,parameters)});
  };
  buttons.forEach((button,index)=>{
    button.addEventListener('click',()=>activate(button.dataset.tvSuiteTab));
    button.addEventListener('keydown',(event)=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
      activate(buttons[next].dataset.tvSuiteTab,{focus:true});
    });
  });
  const intersection='IntersectionObserver'in window?new IntersectionObserver((entries)=>{
    if(!entries.some(entry=>entry.isIntersecting))return;
    intersection.disconnect();
    activate(activeId);
  },{rootMargin:'360px 0px'}):null;
  if(intersection)intersection.observe(root);
  else activate(activeId);
  return {
    update(next){parameters={...parameters,...next};if(mounted&&activeId==='technicals')activate(activeId);},
    refresh(){if(mounted)activate(activeId);},
    destroy(){intersection?.disconnect();handle?.destroy?.();handle=null;}
  };
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
  const [overviewResult,ecbResult]=await Promise.allSettled([
    api('/api/v1/public/markets/overview'),
    api('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR')
  ]);
  const overview=overviewResult.status==='fulfilled'?overviewResult.value:{providers:[],guardrails:{fabricatedObservations:false}};
  const ecb=ecbResult.status==='fulfilled'?ecbResult.value:null;
  const providers=Array.isArray(overview.providers)?overview.providers:[];
  const symbolOptions=EXTERNAL_SYMBOLS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const intervalOptions=INTERVALS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const ecbObservedAt=ecb?.observationTime||ecb?.observedAt||null;
  const ecbIngestedAt=ecb?.ingestionTime||ecb?.ingestedAt||null;
  const ecbTruth=String(ecb?.truthState||'unavailable').toUpperCase();

  main.innerHTML=`<section class="q-page q-market-home q-v7-public-market" data-market-runtime="v7-public-no-fabrication" data-qelly-v7-public-market="true">
    ${pageHead('Qelly Intelligence · Market Command','Governed Market Terminal','Explore live external charts and approved reference observations with clear source boundaries. Missing market data is never replaced with invented values.',`<a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a><a class="q-button q-button--primary" href="#/research-workspace">Open research workspace</a>`)}
    <section class="q-market-principle" aria-label="Market intelligence principle">
      <div><span class="q-eyebrow">Market discipline</span><strong>Price is an observation; risk is a decision.</strong></div>
      <div class="q-market-principle__rules"><span>Verify freshness</span><span>Separate signal from story</span><span>Keep execution outside research</span></div>
    </section>
    ${stateBanner()}

    <section class="q-tv-tape-shell" aria-label="TradingView cross-asset ticker tape">
      <div id="q-tv-ticker-tape" class="q-tv-ticker-stage"></div>
      <p>External display only · ticker observations are never consumed by Qelly calculations.</p>
    </section>

    <div class="q-v7-market-grid">
      <section class="q-panel q-v7-chart-panel">
        <div class="q-panel-head"><div><p class="q-eyebrow">External display boundary</p><h2>TradingView market visualization</h2><p>Human-readable display only. Widget observations are not ingested, scraped, persisted or consumed by Qelly analytics.</p></div><span class="q-status q-status--cached">DISPLAY ONLY</span></div>
        <div class="q-panel-body">
          <div class="q-control-row q-v6-market-controls"><label class="q-setting"><span>Display symbol</span><select id="v6-market-symbol">${symbolOptions}</select></label><label class="q-setting"><span>Display interval</span><select id="v6-market-interval">${intervalOptions}</select></label><div class="q-setting q-query-boundary"><span>Analytics boundary</span><strong>External values excluded</strong><small>Never used for Qelly calculations, risk, alerts or decisions.</small></div></div>
          <div id="v6-market-tradingview" class="q-v7-chart-stage q-v6-market-tradingview" aria-label="TradingView external market chart"></div>
          <div class="q-chart-attribution"><span>External provider boundary · analytics reuse prohibited</span><span>Qelly provider truth remains independently governed.</span></div>
        </div>
      </section>

      <aside class="q-v7-side-stack">
        <section class="q-panel"><div class="q-panel-head"><div><h2>Provider rights matrix</h2><p>Authorization, not technical reachability, controls internal display.</p></div></div><div class="q-panel-body q-v7-provider-grid">${providers.map(provider=>providerCard(provider,escapeHtml)).join('')||'<div class="q-empty-state">Provider registry unavailable.</div>'}</div></section>
        <section class="q-panel"><div class="q-panel-head"><div><h2>Professional research links</h2><p>External sources open in separate trust boundaries.</p></div></div><div class="q-panel-body q-v7-link-grid"><a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a><a class="q-button q-button--secondary" href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory Calendar ↗</a><a class="q-button q-button--secondary" href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB Reference Rates ↗</a><a class="q-button q-button--secondary" href="https://www.cmegroup.com/markets.html" target="_blank" rel="noopener noreferrer nofollow">CME Markets ↗</a></div></section>
      </aside>
    </div>

    <section class="q-panel q-tv-suite" data-tv-suite>
      <div class="q-panel-head"><div><p class="q-eyebrow">Embedded research suite</p><h2>Market intelligence displays</h2><p>Fourteen official TradingView surfaces are available without leaving Qelly. Only the selected panel loads, preserving performance and attention.</p></div><span class="q-status q-status--cached">DISPLAY ONLY</span></div>
      <div class="q-panel-body">
        <div class="q-tv-suite-tabs" role="tablist" aria-label="Choose an embedded market display">${EMBED_PANELS.map((panel,index)=>`<button type="button" role="tab" aria-selected="${index===0?'true':'false'}" aria-controls="q-tv-suite-stage" tabindex="${index===0?'0':'-1'}" data-tv-suite-tab="${panel.id}">${panel.label}</button>`).join('')}</div>
        <div class="q-tv-suite-context"><div><strong data-tv-suite-title>Market overview</strong><p data-tv-suite-description>${EMBED_PANELS[0].description}</p></div><span>External data · human review only</span></div>
        <div id="q-tv-suite-stage" class="q-tv-suite-stage" role="tabpanel" data-tv-suite-stage aria-live="polite"><div class="q-tv-suite-placeholder"><strong>Market overview ready to load</strong><span>Scroll this panel into view to connect the external display.</span></div></div>
      </div>
    </section>

    <section class="q-panel q-intel-dock" data-external-intelligence-dock>
      <div class="q-panel-head"><div><p class="q-eyebrow">External intelligence dock</p><h2>Live market structure and research networks</h2><p>Provider-supported embeds and public read-only streams are isolated from Qelly analytics. Services that prohibit framing remain transparent launch surfaces.</p></div><span class="q-status q-status--cached">READ ONLY</span></div>
      <div class="q-panel-body">
        <div class="q-tv-suite-tabs q-intel-dock-tabs" role="tablist" aria-label="Choose an external intelligence display">${INTELLIGENCE_DOCK_PANELS.map((panel,index)=>`<button type="button" role="tab" aria-selected="${index===0?'true':'false'}" aria-controls="q-intel-dock-stage" tabindex="${index===0?'0':'-1'}" data-intel-dock-tab="${panel.id}">${panel.label}</button>`).join('')}</div>
        <div class="q-tv-suite-context"><div><strong data-intel-dock-title>Live book & trades</strong><p data-intel-dock-description>${INTELLIGENCE_DOCK_PANELS[0].description}</p></div><span>External observations · never execution</span></div>
        <div id="q-intel-dock-stage" class="q-intel-dock-stage" role="tabpanel" data-intel-dock-stage aria-live="polite"><div class="q-tv-suite-placeholder"><strong>Live market structure ready</strong><span>Scroll this panel into view to connect the read-only public stream.</span></div></div>
      </div>
    </section>

    <section class="q-panel q-public-data-board"><div class="q-panel-head"><div><p class="q-eyebrow">Governed live and reference network</p><h2>Global public data board</h2><p>Official/public feeds keep their own cadence, attribution and truth state. Reference observations are never presented as tradable quotes.</p></div><span class="q-status q-status--cached" data-public-source-status>LOADING SOURCES</span></div><div class="q-panel-body q-public-source-grid" data-public-source-grid><div class="q-empty-state"><strong>Connecting public data network</strong><p>Slow reference providers load in the background and never block Market Command.</p></div></div></section>

    <section class="q-panel q-provider-atlas" data-provider-atlas><div class="q-panel-head"><div><p class="q-eyebrow">Supplied provider universe</p><h2>Provider, API and embed atlas</h2><p>Every named provider is discoverable here. “Catalogued” never means licensed, live, free, embeddable or endorsed.</p></div><span class="q-status q-status--cached" data-provider-atlas-status>LOADING CATALOG</span></div><div class="q-panel-body"><div class="q-provider-atlas-controls"><label><span>Search providers</span><input type="search" placeholder="Search name, market or integration…" autocomplete="off" data-provider-atlas-search></label><label><span>Integration state</span><select data-provider-atlas-filter><option value="all">All states</option></select></label><strong data-provider-atlas-count>0 providers</strong></div><div class="q-provider-atlas-grid" data-provider-atlas-grid><div class="q-empty-state"><strong>Loading provider atlas</strong><p>Discovery metadata loads independently from the primary market terminal.</p></div></div></div></section>

    <section class="q-panel q-v7-reference-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Approved reference observations</p><h2>ECB euro reference rates</h2><p>Source timing is preserved. Reference rates are informational and are not tradable quotes.</p></div><span class="q-status q-status--${tone(ecb?.truthState)}">${escapeHtml(truthLabel(ecbTruth))}</span></div><div class="q-panel-body"><div class="q-v7-rate-grid">${governedRates(ecb,escapeHtml)}</div><div class="q-v7-evidence-strip"><span>Source: European Central Bank</span><span>Observed: ${escapeHtml(date(ecbObservedAt))}</span><span>Updated: ${escapeHtml(date(ecbIngestedAt))}</span><span>Research only</span></div></div></section>

    <section class="q-panel"><div class="q-panel-head"><div><h2>Production boundary</h2><p>The public market route uses only anonymous/public contracts. Private data-plane and workspace APIs are requested only after authentication.</p></div><span class="q-status q-status--live">PUBLIC SAFE</span></div><div class="q-panel-body"><div class="q-v6-market-boundary"><span class="q-status q-status--unavailable">NO FALLBACK FABRICATION</span><p>${escapeHtml(overview.reason||'If an internal provider is unavailable or rights-blocked, Qelly exposes that state directly.')}</p></div></div></section>
  </section>`;

  const chart=main.querySelector('#v6-market-tradingview');
  const symbol=main.querySelector('#v6-market-symbol');
  const interval=main.querySelector('#v6-market-interval');
  const ticker=main.querySelector('#q-tv-ticker-tape');
  const suite=main.querySelector('[data-tv-suite]');
  const intelligenceDock=main.querySelector('[data-external-intelligence-dock]');
  let handle=null,tickerHandle=null,suiteHandle=null,intelligenceDockHandle=null,themeFrame=0;
  // Evidence aliases are immediately handed to the local Qelly Verify surface.
  // Do not start third-party iframe widgets during that transient handoff: a
  // provider can emit a console error when its iframe is removed mid-startup.
  const verifyAliasActive=/^#\/market\?[^#]*view=(?:qelly-verify|evidence-methodology)(?:&|$)/i.test(location.hash);
  const mountTicker=()=>{
    tickerHandle?.destroy?.();
    tickerHandle=mountTradingViewWidget(ticker,{kind:'tickerTape',label:'Cross-asset ticker tape',openUrl:'https://www.tradingview.com/markets/',config:{colorTheme:tradingViewAppearance(),isTransparent:false,displayMode:'adaptive',showSymbolLogo:true,symbols:[
      {proName:'FOREXCOM:SPXUSD',title:'S&P 500'},{proName:'NASDAQ:NDX',title:'Nasdaq 100'},{proName:'NSE:NIFTY',title:'Nifty 50'},{proName:'FX_IDC:USDINR',title:'USD / INR'},{proName:'OANDA:XAUUSD',title:'Gold'},{proName:'BITSTAMP:BTCUSD',title:'Bitcoin'},{proName:'BITSTAMP:ETHUSD',title:'Ethereum'}
    ]}});
  };
  const mount=()=>{handle?.destroy?.();handle=mountTradingViewDisplay(chart,{symbol:symbol.value,interval:interval.value});suiteHandle?.update({symbol:symbol.value,interval:interval.value});};
  if(!verifyAliasActive){
    suiteHandle=mountEmbedSuite(suite,{symbol:symbol.value,interval:interval.value});
    intelligenceDockHandle=mountExternalIntelligenceDock(intelligenceDock,{escapeHtml});
    mountTicker();
    symbol?.addEventListener('change',mount);interval?.addEventListener('change',mount);mount();
  }
  api('/api/v1/market/network').then((network)=>populateNetworkSections(main,network,escapeHtml)).catch(()=>populateNetworkSections(main,{sources:{},providerDirectory:[],providerDirectorySummary:{byIntegration:{}}},escapeHtml));
  const themeObserver=new MutationObserver(()=>{
    cancelAnimationFrame(themeFrame);
    themeFrame=requestAnimationFrame(()=>{mount();mountTicker();suiteHandle?.refresh();intelligenceDockHandle?.refresh();});
  });
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-appearance','data-resolved-appearance']});
  window.__qellyMarketV6Cleanup=()=>{cancelAnimationFrame(themeFrame);themeObserver.disconnect();handle?.destroy?.();tickerHandle?.destroy?.();suiteHandle?.destroy?.();intelligenceDockHandle?.destroy?.();handle=null;tickerHandle=null;suiteHandle=null;intelligenceDockHandle=null;};
}

export const __marketV6Test=Object.freeze({EXTERNAL_SYMBOLS,INTERVALS,EMBED_PANELS,INTELLIGENCE_DOCK_PANELS,tone,panelConfig});
