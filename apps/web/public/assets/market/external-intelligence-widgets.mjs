const HYPERLIQUID_WS_URL='wss://api.hyperliquid.xyz/ws';
const COINMARKETCAP_WIDGET_SRC='https://files.coinmarketcap.com/static/widget/coinPriceBlock.js';
const X_WIDGET_SRC='https://platform.twitter.com/widgets.js';
const MAX_BOOK_LEVELS=10;
const MAX_TRADES=24;

export const EXTERNAL_INTELLIGENCE_BOUNDARY='Read-only external display. Qelly does not persist, replay, rank or use these observations for calculations, alerts, orders or execution.';

export const PROVIDER_PORTALS=Object.freeze([
  {id:'forex-factory',name:'Forex Factory',description:'Macro calendar, market sessions and breaking foreign-exchange context.',url:'https://www.forexfactory.com/calendar',access:'Open provider',reason:'Forex Factory blocks third-party framing with SAMEORIGIN.'},
  {id:'coinglass',name:'CoinGlass',description:'Liquidation heatmaps, derivatives positioning, funding and order-flow research.',url:'https://www.coinglass.com/pro',access:'Open provider',reason:'CoinGlass reserves production data integration for authenticated API plans.'},
  {id:'hypurrscan',name:'HypurrScan',description:'HyperCore blocks, transactions, addresses, validators and protocol activity.',url:'https://hypurrscan.io/',access:'Open explorer',reason:'Officially listed by Hyperliquid as an independent HyperCore explorer.'},
  {id:'arkham',name:'Arkham Intelligence',description:'Entity-labelled wallet intelligence, fund flows, dashboards and alerts.',url:'https://intel.arkm.com/',access:'Open intelligence',reason:'Arkham sends X-Frame-Options: DENY and offers data integration through approved API access.'},
  {id:'coinbase',name:'Coinbase',description:'Official exchange market, asset and institutional research surfaces.',url:'https://www.coinbase.com/explore',access:'Open provider',reason:'Market-data reuse remains subject to Coinbase terms and approved API access.'},
  {id:'binance',name:'Binance',description:'Official exchange markets, research and asset discovery.',url:'https://www.binance.com/en/markets/overview',access:'Open provider',reason:'Qelly does not republish exchange observations without confirmed display rights.'},
  {id:'coindcx',name:'CoinDCX',description:'Indian digital-asset market and education destination.',url:'https://coindcx.com/markets',access:'Open provider',reason:'External market research only; no wallet connection or execution is initiated by Qelly.'},
  {id:'ndtv-profit',name:'NDTV Profit',description:'Indian business, economy and market news.',url:'https://www.ndtvprofit.com/markets',access:'Open news',reason:'Publisher pages remain outbound because content licensing and framing policies apply.'},
  {id:'youtube-finance',name:'YouTube Finance',description:'Video research and market coverage from user-selected publishers.',url:'https://www.youtube.com/results?search_query=financial+markets+news',access:'Choose publisher',reason:'A specific approved channel, video or playlist is required before an iframe can be embedded responsibly.'},
  {id:'instagram',name:'Instagram',description:'Public market-community research destination.',url:'https://www.instagram.com/',access:'Choose account',reason:'A specific public account or post URL is required for an official embed.'},
  {id:'facebook',name:'Facebook',description:'Public finance-community research destination.',url:'https://www.facebook.com/',access:'Choose page',reason:'A specific public page or post URL is required for an official embed.'}
]);

const number=(input,maximumFractionDigits=4)=>{
  const parsed=Number(input);
  return Number.isFinite(parsed)?new Intl.NumberFormat('en-US',{maximumFractionDigits}).format(parsed):'—';
};
const time=(input)=>{
  const parsed=new Date(Number(input));
  return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
};
const escapeHtml=(input)=>String(input??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));

function hyperliquidFrame(coin){
  return `<div class="q-hl-terminal" data-hl-terminal>
    <div class="q-hl-toolbar">
      <div><strong>Hyperliquid public market stream</strong><span data-hl-status>Connecting securely…</span></div>
      <label><span>Perpetual market</span><select data-hl-coin>${['BTC','ETH','SOL','HYPE'].map(item=>`<option value="${item}" ${item===coin?'selected':''}>${item} / USD</option>`).join('')}</select></label>
    </div>
    <div class="q-hl-grid">
      <section aria-labelledby="q-hl-orderbook-title"><div class="q-hl-section-head"><strong id="q-hl-orderbook-title">Live order book</strong><span>Price · Size · Orders</span></div><div class="q-hl-book-head"><span>Price</span><span>Size</span><span>Orders</span></div><div class="q-hl-book" data-hl-asks><div class="q-stream-empty">Waiting for asks…</div></div><div class="q-hl-mid" data-hl-mid>Awaiting midpoint</div><div class="q-hl-book" data-hl-bids><div class="q-stream-empty">Waiting for bids…</div></div></section>
      <section aria-labelledby="q-hl-trades-title"><div class="q-hl-section-head"><strong id="q-hl-trades-title">Live trades</strong><span>Price · Size · Time</span></div><div class="q-hl-trade-head"><span>Price</span><span>Size</span><span>Time</span></div><div class="q-hl-trades" data-hl-trades aria-live="off"><div class="q-stream-empty">Waiting for public trades…</div></div></section>
    </div>
    <div class="q-hl-foot"><span>Official mainnet WebSocket · public observations · no wallet connection</span><div><a href="https://app.hyperliquid.xyz/explorer" target="_blank" rel="noopener noreferrer nofollow">Hyperliquid Explorer ↗</a><a href="https://hypurrscan.io/" target="_blank" rel="noopener noreferrer nofollow">HypurrScan ↗</a></div></div>
  </div>`;
}

export function mountHyperliquidStream(container,{coin='BTC'}={}){
  if(!(container instanceof HTMLElement))throw new TypeError('Hyperliquid stream container is required');
  let activeCoin=String(coin||'BTC').toUpperCase();
  let socket=null,reconnectTimer=0,heartbeatTimer=0,destroyed=false,reconnectAttempt=0,trades=[];
  container.dataset.externalProvider='hyperliquid';
  container.dataset.usage='display-only';
  container.dataset.externalState='connecting';
  container.innerHTML=hyperliquidFrame(activeCoin);
  const status=container.querySelector('[data-hl-status]');
  const asks=container.querySelector('[data-hl-asks]');
  const bids=container.querySelector('[data-hl-bids]');
  const midpoint=container.querySelector('[data-hl-mid]');
  const tradesNode=container.querySelector('[data-hl-trades]');
  const coinSelect=container.querySelector('[data-hl-coin]');

  const setState=(state,message)=>{
    container.dataset.externalState=state;
    if(status)status.textContent=message;
  };
  const renderLevel=(level,side)=>`<div class="q-hl-level q-hl-level--${side}"><span>${escapeHtml(number(level?.px,6))}</span><span>${escapeHtml(number(level?.sz,5))}</span><span>${escapeHtml(number(level?.n,0))}</span></div>`;
  const renderBook=(book)=>{
    const levels=Array.isArray(book?.levels)?book.levels:[];
    const bidLevels=Array.isArray(levels[0])?levels[0].slice(0,MAX_BOOK_LEVELS):[];
    const askLevels=Array.isArray(levels[1])?levels[1].slice(0,MAX_BOOK_LEVELS).reverse():[];
    asks.innerHTML=askLevels.length?askLevels.map(level=>renderLevel(level,'ask')).join(''):'<div class="q-stream-empty">No ask levels supplied.</div>';
    bids.innerHTML=bidLevels.length?bidLevels.map(level=>renderLevel(level,'bid')).join(''):'<div class="q-stream-empty">No bid levels supplied.</div>';
    const bestBid=Number(bidLevels[0]?.px),bestAsk=Number(levels[1]?.[0]?.px);
    midpoint.textContent=Number.isFinite(bestBid)&&Number.isFinite(bestAsk)?`${number((bestBid+bestAsk)/2,6)} midpoint`:'Midpoint unavailable';
  };
  const renderTrades=()=>{
    tradesNode.innerHTML=trades.length?trades.map(trade=>`<div class="q-hl-trade q-hl-trade--${trade?.side==='B'?'buy':'sell'}" title="${escapeHtml(trade?.hash||'Public Hyperliquid trade')}"><span>${escapeHtml(number(trade?.px,6))}</span><span>${escapeHtml(number(trade?.sz,5))}</span><span>${escapeHtml(time(trade?.time))}</span></div>`).join(''):'<div class="q-stream-empty">No public trades supplied.</div>';
  };
  const clearConnection=()=>{
    clearTimeout(reconnectTimer);clearInterval(heartbeatTimer);
    reconnectTimer=0;heartbeatTimer=0;
    if(socket){socket.onopen=null;socket.onmessage=null;socket.onerror=null;socket.onclose=null;try{socket.close(1000,'Qelly display closed');}catch{}socket=null;}
  };
  const connect=()=>{
    clearConnection();
    if(destroyed)return;
    if(typeof WebSocket!=='function'){setState('unavailable','Live WebSocket is unavailable in this browser.');return;}
    setState(reconnectAttempt?'reconnecting':'connecting',reconnectAttempt?'Reconnecting to the public stream…':'Connecting to the public stream…');
    try{socket=new WebSocket(HYPERLIQUID_WS_URL);}catch{setState('unavailable','The public stream could not be opened.');return;}
    socket.onopen=()=>{
      reconnectAttempt=0;
      socket.send(JSON.stringify({method:'subscribe',subscription:{type:'l2Book',coin:activeCoin}}));
      socket.send(JSON.stringify({method:'subscribe',subscription:{type:'trades',coin:activeCoin}}));
      heartbeatTimer=setInterval(()=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({method:'ping'}));},45000);
      setState('live',`Live ${activeCoin} observations · no execution`);
    };
    socket.onmessage=(event)=>{
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message?.channel==='l2Book'){renderBook(message.data);setState('live',`Live ${activeCoin} order book · ${time(message.data?.time)}`);}
      if(message?.channel==='trades'&&Array.isArray(message.data)){trades=[...message.data,...trades].slice(0,MAX_TRADES);renderTrades();setState('live',`Live ${activeCoin} trades · ${time(message.data[0]?.time)}`);}
    };
    socket.onerror=()=>setState('reconnecting','Public stream interrupted. Reconnecting…');
    socket.onclose=()=>{
      if(destroyed)return;
      clearInterval(heartbeatTimer);heartbeatTimer=0;
      reconnectAttempt+=1;
      const wait=Math.min(1000*(2**Math.min(reconnectAttempt,4)),15000);
      setState('reconnecting',`Public stream paused · retrying in ${Math.ceil(wait/1000)}s`);
      reconnectTimer=setTimeout(connect,wait);
    };
  };
  coinSelect?.addEventListener('change',()=>{activeCoin=coinSelect.value;trades=[];renderTrades();reconnectAttempt=0;connect();});
  connect();
  return {provider:'Hyperliquid',usage:'display-only',boundary:EXTERNAL_INTELLIGENCE_BOUNDARY,destroy(){destroyed=true;clearConnection();container.replaceChildren();delete container.dataset.externalState;}};
}

function externalScript(src,attributes={}){
  const script=document.createElement('script');
  script.src=src;script.async=true;
  for(const [key,value] of Object.entries(attributes))script.setAttribute(key,value);
  return script;
}

export function mountCoinMarketCapWidgets(container){
  if(!(container instanceof HTMLElement))throw new TypeError('CoinMarketCap widget container is required');
  container.replaceChildren();
  container.dataset.externalProvider='coinmarketcap';container.dataset.usage='display-only';container.dataset.externalState='loading';
  const grid=document.createElement('div');grid.className='q-cmc-grid';
  const widget=document.createElement('div');widget.id='coinmarketcap-widget-coin-price-block';
  widget.setAttribute('coins','1,1027,5426');widget.setAttribute('currency','USD');widget.setAttribute('theme',((document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance)==='light'?'light':'dark'));widget.setAttribute('transparent','true');widget.setAttribute('show-symbol-logo','true');
  grid.append(widget);
  const disclosure=document.createElement('p');disclosure.className='q-external-disclosure';disclosure.textContent='Official CoinMarketCap website widgets · live external display · Qelly does not read widget values.';
  container.append(grid,disclosure);
  const script=externalScript(COINMARKETCAP_WIDGET_SRC);
  const timer=setTimeout(()=>{if(!widget.textContent.trim()&&!widget.shadowRoot){container.dataset.externalState='unavailable';disclosure.innerHTML='CoinMarketCap widgets did not initialize. <a href="https://coinmarketcap.com/widget/" target="_blank" rel="noopener noreferrer nofollow">Open CoinMarketCap widgets ↗</a>'; }},15000);
  script.addEventListener('load',()=>{
    const initialize=window.__WIDGET_INIT;
    if(typeof initialize!=='function')return;
    Promise.resolve(initialize()).then(()=>{if(widget.querySelector('.coinPriceBlock')){clearTimeout(timer);container.dataset.externalState='display-only';}}).catch(()=>{container.dataset.externalState='unavailable';});
  },{once:true});
  script.addEventListener('error',()=>{clearTimeout(timer);container.dataset.externalState='unavailable';disclosure.innerHTML='CoinMarketCap widgets could not load. <a href="https://coinmarketcap.com/" target="_blank" rel="noopener noreferrer nofollow">Open CoinMarketCap ↗</a>';},{once:true});
  container.append(script);
  return {provider:'CoinMarketCap',usage:'display-only',boundary:EXTERNAL_INTELLIGENCE_BOUNDARY,destroy(){clearTimeout(timer);script.remove();container.replaceChildren();delete container.dataset.externalState;}};
}

export function mountXTimeline(container,{handle='CoinMarketCap'}={}){
  if(!(container instanceof HTMLElement))throw new TypeError('X timeline container is required');
  const safeHandle=String(handle||'CoinMarketCap').replace(/[^A-Za-z0-9_]/g,'')||'CoinMarketCap';
  container.replaceChildren();container.dataset.externalProvider='x';container.dataset.usage='display-only';container.dataset.externalState='loading';
  const shell=document.createElement('div');shell.className='q-x-shell';
  const timeline=document.createElement('a');timeline.className='twitter-timeline';timeline.href=`https://x.com/${safeHandle}`;timeline.textContent=`Posts by @${safeHandle}`;
  timeline.dataset.theme=((document.documentElement.dataset.resolvedAppearance||document.documentElement.dataset.appearance)==='light'?'light':'dark');
  timeline.dataset.dnt='true';timeline.dataset.chrome='noheader nofooter transparent';timeline.dataset.height='620';timeline.dataset.ariaPolite='assertive';
  const script=externalScript(X_WIDGET_SRC,{charset:'utf-8'});
  const fallback=document.createElement('p');fallback.className='q-external-disclosure';fallback.innerHTML=`Official X timeline with personalization disabled · <a href="https://x.com/${safeHandle}" target="_blank" rel="noopener noreferrer nofollow">open @${safeHandle} directly ↗</a>`;
  shell.append(timeline,script);container.append(shell,fallback);
  const timer=setTimeout(()=>{if(!shell.querySelector('iframe')){container.dataset.externalState='unavailable';fallback.firstChild.textContent='X timeline unavailable in this browser · ';}},15000);
  const observer=new MutationObserver(()=>{if(shell.querySelector('iframe')){clearTimeout(timer);observer.disconnect();container.dataset.externalState='display-only';shell.querySelector('iframe')?.setAttribute('title',`Public posts by ${safeHandle} on X`);}});
  observer.observe(shell,{childList:true,subtree:true});
  script.addEventListener('error',()=>{clearTimeout(timer);observer.disconnect();container.dataset.externalState='unavailable';},{once:true});
  return {provider:'X',usage:'display-only',boundary:EXTERNAL_INTELLIGENCE_BOUNDARY,destroy(){clearTimeout(timer);observer.disconnect();script.remove();container.replaceChildren();delete container.dataset.externalState;}};
}

export const __externalIntelligenceTest=Object.freeze({HYPERLIQUID_WS_URL,COINMARKETCAP_WIDGET_SRC,X_WIDGET_SRC,MAX_BOOK_LEVELS,MAX_TRADES,PROVIDER_PORTALS});
