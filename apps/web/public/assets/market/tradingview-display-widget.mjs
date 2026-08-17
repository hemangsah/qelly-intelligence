const WIDGET_SRC='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
const DISPLAY_BOUNDARY='External TradingView display only. Qelly does not read, scrape, transform, persist or use widget values for calculations, risk, alerts or decisions.';
const WIDGET_TIMEOUT_MS=9000;

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

const externalChartUrl=(symbol)=>`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol(symbol))}`;
const widgetReady=(host)=>Boolean(host?.querySelector('iframe,canvas')||host?.childElementCount);

function renderFallback(container,{symbol,reason}){
  container.dataset.externalProvider='tradingview';
  container.dataset.usage='display-only';
  container.dataset.externalState='unavailable';
  container.innerHTML=`<section class="qelly-tradingview-fallback" role="status" aria-live="polite"><div><h3>TradingView display unavailable</h3><p>${reason==='timeout'?'The external chart did not initialize within the production timeout.':'The external chart script could not be loaded in this browser.'} Qelly has not substituted or fabricated chart values.</p><a href="${externalChartUrl(symbol)}" target="_blank" rel="noopener noreferrer nofollow">Open TradingView directly</a></div></section>`;
}

export function mountTradingViewDisplay(container,{symbol='BTCUSDT',interval='1h'}={}){
  if(!(container instanceof HTMLElement))throw new TypeError('TradingView display container is required');
  container.replaceChildren();
  container.dataset.externalProvider='tradingview';
  container.dataset.usage='display-only';
  container.dataset.externalState='loading';

  const widget=document.createElement('div');
  widget.className='tradingview-widget-container qelly-tradingview-widget';
  widget.style.height='100%';
  widget.style.width='100%';
  const host=document.createElement('div');
  host.className='tradingview-widget-container__widget';
  host.style.height='calc(100% - 30px)';
  host.style.width='100%';
  host.setAttribute('aria-label','Loading external TradingView chart');
  widget.append(host);

  const attribution=document.createElement('div');
  attribution.className='tradingview-widget-copyright qelly-tradingview-attribution';
  const link=document.createElement('a');
  link.href='https://www.tradingview.com/';
  link.target='_blank';
  link.rel='noopener nofollow';
  link.textContent='Market chart by TradingView';
  attribution.append(link);
  widget.append(attribution);

  const script=document.createElement('script');
  script.type='text/javascript';
  script.src=WIDGET_SRC;
  script.async=true;
  script.textContent=JSON.stringify({
    autosize:true,
    symbol:tradingViewSymbol(symbol),
    interval:tradingViewInterval(interval),
    timezone:'exchange',
    theme:(document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance)==='light'?'light':'dark',
    backgroundColor:'rgba(10, 12, 16, 1)',
    gridColor:'rgba(42, 47, 57, 0.35)',
    style:'1',
    locale:'en',
    allow_symbol_change:true,
    save_image:false,
    calendar:false,
    withdateranges:true,
    hide_side_toolbar:false,
    support_host:'https://www.tradingview.com'
  });
  widget.append(script);
  container.append(widget);

  let settled=false;
  const settleReady=()=>{
    if(settled||!container.isConnected||!widgetReady(host))return false;
    settled=true;
    container.dataset.externalState='display-only';
    host.removeAttribute('aria-label');
    return true;
  };
  const timer=setTimeout(()=>{
    if(settleReady())return;
    settled=true;
    renderFallback(container,{symbol,reason:'timeout'});
  },WIDGET_TIMEOUT_MS);
  script.addEventListener('load',()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(settleReady())clearTimeout(timer);
    }));
  },{once:true});
  script.addEventListener('error',()=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    renderFallback(container,{symbol,reason:'load-error'});
  },{once:true});

  return {provider:'TradingView',usage:'display-only',boundary:DISPLAY_BOUNDARY,symbol:tradingViewSymbol(symbol),interval:tradingViewInterval(interval),destroy(){settled=true;clearTimeout(timer);container.replaceChildren();delete container.dataset.externalState;}};
}

export const __tradingViewDisplayTest=Object.freeze({SYMBOL_MAP,INTERVAL_MAP,DISPLAY_BOUNDARY,WIDGET_SRC,WIDGET_TIMEOUT_MS,externalChartUrl});
