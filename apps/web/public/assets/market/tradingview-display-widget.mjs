const DISPLAY_BOUNDARY='External TradingView display only. Qelly does not read, scrape, transform, persist or use widget values for calculations, risk, alerts or decisions.';
const WIDGET_TIMEOUT_MS=30000;
const WIDGET_SOURCES=Object.freeze({
  advancedChart:'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
  tickerTape:'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js',
  marketOverview:'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
  screener:'https://s3.tradingview.com/external-embedding/embed-widget-screener.js',
  economicCalendar:'https://s3.tradingview.com/external-embedding/embed-widget-events.js',
  technicalAnalysis:'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js',
  cryptoHeatmap:'https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js',
  forexCrossRates:'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js',
  topStories:'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js'
});

const SYMBOL_MAP=Object.freeze({
  BTCUSDT:'BINANCE:BTCUSDT',
  'BTC-USD':'COINBASE:BTCUSD',
  ETHUSDT:'BINANCE:ETHUSDT',
  'ETH-USD':'COINBASE:ETHUSD',
  BNBUSDT:'BINANCE:BNBUSDT',
  SOLUSDT:'BINANCE:SOLUSDT',
  'SOL-USD':'COINBASE:SOLUSD',
  XRPUSDT:'BINANCE:XRPUSDT',
  'XRP-USD':'COINBASE:XRPUSD',
  ADAUSDT:'BINANCE:ADAUSDT',
  'ADA-USD':'COINBASE:ADAUSD',
  XAUUSD:'OANDA:XAUUSD',
  XAGUSD:'OANDA:XAGUSD',
  EURUSD:'FX:EURUSD',
  GBPUSD:'FX:GBPUSD',
  USDJPY:'FX:USDJPY',
  USDINR:'FX_IDC:USDINR',
  SPX:'SP:SPX',
  NDX:'NASDAQ:NDX',
  NIFTY:'NSE:NIFTY',
  SENSEX:'BSE:SENSEX',
  HSI:'HSI:HSI',
  NI225:'TVC:NI225',
  DXY:'TVC:DXY',
  USOIL:'TVC:USOIL'
});
const INTERVAL_MAP=Object.freeze({'1m':'1','5m':'5','15m':'15','30m':'30','1h':'60','4h':'240','1d':'D','1w':'W'});

export const tradingViewSymbol=(value)=>SYMBOL_MAP[String(value||'').toUpperCase()]||'BITSTAMP:BTCUSD';
export const tradingViewInterval=(value)=>INTERVAL_MAP[String(value||'')]||'60';
export const tradingViewAppearance=()=>((document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance)==='light'?'light':'dark');

const externalChartUrl=(symbol)=>`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol(symbol))}`;
// Official iframe widgets replace their placeholder DIV with an IFRAME. The
// readiness check must observe the stable wrapper, never the removed host.
const widgetReady=(wrapper)=>Boolean(wrapper?.querySelector('iframe'));

function renderFallback(container,{symbol='BTCUSDT',reason='load-error',title='TradingView panel unavailable',openUrl}={}){
  container.dataset.externalProvider='tradingview';
  container.dataset.usage='display-only';
  container.dataset.externalState='unavailable';
  const detail=reason==='timeout'?'The external panel did not initialize within the production timeout.':'The external panel script could not be loaded in this browser.';
  container.innerHTML=`<section class="qelly-tradingview-fallback" role="status" aria-live="polite"><div><h3>${title}</h3><p>${detail} Qelly has not substituted or fabricated chart values.</p><a href="${openUrl||externalChartUrl(symbol)}" target="_blank" rel="noopener noreferrer nofollow">Open TradingView directly</a></div></section>`;
}

export function mountTradingViewWidget(container,{kind,config={},label='TradingView market panel',openUrl='https://www.tradingview.com/markets/'}={}){
  if(!(container instanceof HTMLElement))throw new TypeError('TradingView widget container is required');
  const source=WIDGET_SOURCES[kind];
  if(!source)throw new TypeError(`Unsupported TradingView widget: ${String(kind||'')}`);
  container.replaceChildren();
  container.dataset.externalProvider='tradingview';
  container.dataset.usage='display-only';
  container.dataset.externalWidget=kind;
  container.dataset.externalState='loading';

  const wrapper=document.createElement('div');
  wrapper.className='tradingview-widget-container qelly-tradingview-widget';
  wrapper.style.height='100%';
  wrapper.style.width='100%';
  const loading=document.createElement('div');
  loading.className='qelly-tradingview-loading';
  loading.setAttribute('role','status');
  loading.innerHTML=`<span aria-hidden="true"></span><strong>Loading ${label}…</strong><small>Official TradingView display · no substitute values</small>`;
  const host=document.createElement('div');
  host.className='tradingview-widget-container__widget';
  host.style.height='calc(100% - 32px)';
  host.style.width='100%';
  host.setAttribute('aria-label',`Loading external ${label}`);
  wrapper.append(loading,host);

  const attribution=document.createElement('div');
  attribution.className='tradingview-widget-copyright qelly-tradingview-attribution';
  const link=document.createElement('a');
  link.href=openUrl;
  link.target='_blank';
  link.rel='noopener noreferrer nofollow';
  link.textContent=`${label} by TradingView`;
  attribution.append(link);
  wrapper.append(attribution);

  const script=document.createElement('script');
  script.type='text/javascript';
  script.src=source;
  script.async=true;
  script.textContent=JSON.stringify({...config,locale:'en'});
  wrapper.append(script);
  container.append(wrapper);

  let settled=false;
  const settleReady=()=>{
    if(settled||!container.isConnected||!widgetReady(wrapper))return false;
    settled=true;
    container.dataset.externalState='display-only';
    loading.remove();
    wrapper.querySelector('iframe')?.setAttribute('aria-label',label);
    return true;
  };
  const timer=setTimeout(()=>{
    if(settleReady())return;
    settled=true;
    observer.disconnect();
    renderFallback(container,{reason:'timeout',title:`${label} unavailable`,openUrl});
  },WIDGET_TIMEOUT_MS);
  const observer=new MutationObserver(()=>{
    if(settleReady()){
      clearTimeout(timer);
      observer.disconnect();
    }
  });
  observer.observe(wrapper,{childList:true,subtree:true});
  script.addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(settleReady()){
      clearTimeout(timer);
      observer.disconnect();
    }
  })),{once:true});
  script.addEventListener('error',()=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    observer.disconnect();
    renderFallback(container,{reason:'load-error',title:`${label} unavailable`,openUrl});
  },{once:true});

  return {provider:'TradingView',kind,usage:'display-only',boundary:DISPLAY_BOUNDARY,destroy(){settled=true;clearTimeout(timer);observer.disconnect();container.replaceChildren();delete container.dataset.externalState;delete container.dataset.externalWidget;}};
}

export function mountTradingViewDisplay(container,{symbol='BTCUSDT',interval='1h'}={}){
  const resolvedSymbol=tradingViewSymbol(symbol);
  const resolvedInterval=tradingViewInterval(interval);
  const appearance=tradingViewAppearance();
  const handle=mountTradingViewWidget(container,{
    kind:'advancedChart',
    label:'Market chart',
    openUrl:externalChartUrl(symbol),
    config:{
      autosize:true,
      symbol:resolvedSymbol,
      interval:resolvedInterval,
      timezone:'exchange',
      theme:appearance,
      backgroundColor:appearance==='light'?'#f6f6f3':'rgba(10, 12, 16, 1)',
      gridColor:appearance==='light'?'rgba(81, 67, 74, 0.12)':'rgba(42, 47, 57, 0.35)',
      style:'1',
      allow_symbol_change:true,
      save_image:false,
      calendar:true,
      details:true,
      hotlist:true,
      withdateranges:true,
      hide_side_toolbar:false,
      support_host:'https://www.tradingview.com'
    }
  });
  return {...handle,symbol:resolvedSymbol,interval:resolvedInterval};
}

export const __tradingViewDisplayTest=Object.freeze({SYMBOL_MAP,INTERVAL_MAP,DISPLAY_BOUNDARY,WIDGET_SRC:WIDGET_SOURCES.advancedChart,WIDGET_SOURCES,WIDGET_TIMEOUT_MS,externalChartUrl,widgetReady});
