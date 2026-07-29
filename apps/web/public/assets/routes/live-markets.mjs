import { mountLiveMarketChart } from '../market/tradingview-live-chart.mjs';

const SYMBOLS={binance:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'],coindcx:['B-BTC_USDT','B-ETH_USDT','B-BNB_USDT','B-SOL_USDT','B-XRP_USDT'],fixture:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT']};
const INTERVALS=['1m','5m','15m','30m','1h','4h','1d'];
const format=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:Number(value)>100?2:6}).format(Number(value)):'—';

export async function renderLiveMarkets(main,deps){
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  const catalog=await api('/api/v1/live-markets/catalog');
  const defaults={provider:'binance',symbol:'BTCUSDT',interval:'1m',limit:240};
  main.innerHTML=`<section class="q-page q-live-market-page">${pageHead('Qelly Intelligence · Live public market layer','Qelly Live Market Command','TradingView-style candlesticks powered by Qelly provider adapters. Binance and CoinDCX public feeds are read-only, with explicit fixture fallback and no account or execution access.',`<button class="q-button q-button--ghost" data-action="about-data">Data policy</button><button class="q-button q-button--primary" data-action="refresh-live">Refresh market</button>`)}${stateBanner()}
  <section class="q-live-command-deck">
    <div class="q-live-symbol-block"><span class="q-live-asset-icon">₿</span><div><p>Selected market</p><h2 id="live-symbol-title">BTC / USDT</h2><span id="live-source-label">Preparing provider…</span></div></div>
    <div class="q-live-price-block"><span id="live-last-price">—</span><strong id="live-change">—</strong><small id="live-range">High — · Low —</small></div>
    <div class="q-live-controls">
      <label><span>Provider</span><select id="live-provider"><option value="binance">Binance Public</option><option value="coindcx">CoinDCX Public</option><option value="fixture">Qelly Fixture</option></select></label>
      <label><span>Symbol</span><select id="live-symbol">${SYMBOLS.binance.map(x=>`<option>${x}</option>`).join('')}</select></label>
      <label><span>Interval</span><select id="live-interval">${INTERVALS.map(x=>`<option>${x}</option>`).join('')}</select></label>
      <button class="q-live-toggle is-active" id="live-stream-toggle" type="button"><span></span>Live follow</button>
    </div>
  </section>
  <div class="q-live-layout">
    <section class="q-live-chart-shell q-panel">
      <div class="q-live-chart-toolbar"><div class="q-chart-tool-group"><button title="Crosshair">⌖</button><button title="Trend line">╱</button><button title="Horizontal line">—</button><button title="Fibonacci">⌁</button><button title="Text note">T</button></div><div class="q-chart-tool-group"><button>SMA 20</button><button>Volume</button><button>Auto</button><span class="q-status q-status--simulated" id="live-mode-badge">loading</span></div></div>
      <div id="qelly-live-chart" class="q-tradingview-stage" aria-label="Live market candlestick chart"></div>
      <div class="q-chart-attribution"><span>Chart interface: TradingView Lightweight Charts™ when network loading is available</span><span id="live-observed-at">—</span></div>
    </section>
    <aside class="q-live-side-stack">
      <section class="q-panel q-orderbook-preview"><div class="q-panel-head"><div><h2>Market pulse</h2><p>Read-only public data</p></div><span class="q-provider-pulse"></span></div><div class="q-panel-body"><div class="q-live-stat"><span>24h-style change</span><strong id="live-stat-change">—</strong></div><div class="q-live-stat"><span>Visible range volume</span><strong id="live-stat-volume">—</strong></div><div class="q-live-stat"><span>Provider mode</span><strong id="live-stat-provider">—</strong></div><div class="q-live-stat"><span>Execution</span><strong class="is-negative">Disabled</strong></div></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Provider matrix</h2><p>Public market data only</p></div></div><div class="q-panel-body q-stack">${catalog.providers.map(p=>`<div class="q-record-row"><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.transport.join(' · '))}</small></span><span class="q-status q-status--${p.realtime?'live':'simulated'}">${p.realtime?'live-capable':'fallback'}</span></div>`).join('')}</div></section>
      <section class="q-panel q-risk-lock"><div class="q-panel-body"><p class="q-eyebrow">Sovereign safety lock</p><h2>Observe, analyse, decide.</h2><p>No order placement, API keys, balances, transfers, withdrawals, private keys or wallet custody are available on this screen.</p></div></section>
    </aside>
  </div>
  <section class="q-panel q-market-tape"><div class="q-panel-head"><div><h2>Illustrative watch universe</h2><p>Static demo values for symbol selection; not provider observations</p></div><button class="q-button q-button--secondary" data-action="open-watchlists">Open watchlists</button></div><div class="q-panel-body"><div class="q-tape-grid">${['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'].map((symbol)=>`<button class="q-tape-card" data-live-symbol="${symbol}"><span>${symbol.replace('USDT',' / USDT')}</span><strong>Demo</strong><small class="q-status q-status--simulated">illustrative</small></button>`).join('')}</div></div></section>
  </section>`;

  const controls={provider:main.querySelector('#live-provider'),symbol:main.querySelector('#live-symbol'),interval:main.querySelector('#live-interval')};
  let chartHandle=null, socket=null, poller=null, current={...defaults};
  const closeRealtime=()=>{if(socket){socket.close();socket=null;}if(poller){clearInterval(poller);poller=null;}chartHandle?.destroy?.();chartHandle=null;};
  window.__qellyLiveMarketCleanup=closeRealtime;
  const setSymbols=()=>{const list=SYMBOLS[controls.provider.value]||SYMBOLS.fixture;const previous=controls.symbol.value;controls.symbol.innerHTML=list.map(x=>`<option>${x}</option>`).join('');if(list.includes(previous))controls.symbol.value=previous;};
  const updateSummary=(data)=>{const s=data.summary||{};main.querySelector('#live-last-price').textContent=format(s.last);const change=Number(s.changePercent);const changeEl=main.querySelector('#live-change');changeEl.textContent=Number.isFinite(change)?`${change>=0?'+':''}${change.toFixed(2)}%`:'—';changeEl.className=change>=0?'is-positive':'is-negative';main.querySelector('#live-range').textContent=`High ${format(s.high)} · Low ${format(s.low)}`;main.querySelector('#live-stat-change').textContent=changeEl.textContent;main.querySelector('#live-stat-change').className=changeEl.className;main.querySelector('#live-stat-volume').textContent=format(s.volume);main.querySelector('#live-stat-provider').textContent=data.source?.name||data.provider;main.querySelector('#live-mode-badge').textContent=data.source?.mode||'unknown';main.querySelector('#live-mode-badge').className=`q-status q-status--${data.source?.mode==='live-public'?'live':'simulated'}`;main.querySelector('#live-source-label').textContent=data.source?.fallbackReason?`${data.source.name} · fallback: ${data.source.fallbackReason}`:`${data.source?.name} · ${data.source?.mode}`;main.querySelector('#live-observed-at').textContent=data.source?.observedAt?new Date(data.source.observedAt).toLocaleString('en-IN'):'—';};
  const connectRealtime=(data)=>{
    if(data.source?.mode!=='live-public')return;
    if(current.provider==='binance'){
      const streamSymbol=current.symbol.toLowerCase().replace(/[^a-z0-9]/g,'');const wsUrl=`wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${current.interval}`;
      try{socket=new WebSocket(wsUrl);socket.onmessage=(event)=>{const payload=JSON.parse(event.data);const k=payload.k;if(!k)return;const point={time:Math.floor(Number(k.t)/1000),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v)};chartHandle?.update?.(point);main.querySelector('#live-last-price').textContent=format(point.close);};socket.onerror=()=>toast('Binance stream interrupted; the chart retains the latest safe candle.',{tone:'warning'});}catch{}
    }else if(current.provider==='coindcx')poller=setInterval(()=>load({quiet:true}),7000);
  };
  const load=async({quiet=false}={})=>{closeRealtime();current={provider:controls.provider.value,symbol:controls.symbol.value,interval:controls.interval.value,limit:260};const chartEl=main.querySelector('#qelly-live-chart');if(!quiet)chartEl.innerHTML='<div class="q-chart-loading"><span></span><strong>Synchronising sovereign market canvas</strong><small>Provider adapter → normalized candles → chart renderer</small></div>';
    try{const query=new URLSearchParams({...current,mode:current.provider==='fixture'?'fixture':'live'});const data=await api(`/api/v1/live-markets/candles?${query}`);updateSummary(data);main.querySelector('#live-symbol-title').textContent=current.symbol.replace(/^B-/,'').replace('_',' / ').replace('USDT',' / USDT');chartHandle=await mountLiveMarketChart(chartEl,{points:data.points,symbol:data.symbol,interval:data.interval,onCrosshair:(bar)=>{main.querySelector('#live-range').textContent=`O ${format(bar.open)} · H ${format(bar.high)} · L ${format(bar.low)} · C ${format(bar.close)}`;}});connectRealtime(data);}catch(error){chartEl.innerHTML=`<div class="q-empty-state"><strong>Market feed unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;toast(error.message,{tone:'danger'});}};
  controls.provider.addEventListener('change',()=>{setSymbols();load();});controls.symbol.addEventListener('change',()=>load());controls.interval.addEventListener('change',()=>load());main.querySelector('[data-action="refresh-live"]').addEventListener('click',()=>load());main.querySelector('[data-action="about-data"]').addEventListener('click',()=>toast('Qelly uses public read-only candle feeds only. No private account or execution endpoint is connected.',{tone:'info'}));main.querySelector('[data-action="open-watchlists"]').addEventListener('click',()=>deps.navigate('watchlist'));main.querySelector('#live-stream-toggle').addEventListener('click',(event)=>{event.currentTarget.classList.toggle('is-active');if(event.currentTarget.classList.contains('is-active'))load();else{if(socket)socket.close();if(poller)clearInterval(poller);toast('Live follow paused',{tone:'info'});}});main.querySelectorAll('[data-live-symbol]').forEach(button=>button.addEventListener('click',()=>{controls.provider.value='binance';setSymbols();controls.symbol.value=button.dataset.liveSymbol;load();}));
  await load();
}
