import { mountLiveMarketChart } from '../market/tradingview-live-chart.mjs';

const SYMBOLS={binance:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'],coindcx:['B-BTC_USDT','B-ETH_USDT','B-BNB_USDT','B-SOL_USDT','B-XRP_USDT'],fixture:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT']};
const INTERVALS=['1m','5m','15m','30m','1h','4h','1d'];
const format=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:Number(value)>100?2:6}).format(Number(value)):'—';
const freshness=(value)=>{
  const observed=Date.parse(value||'');
  if(!Number.isFinite(observed))return 'Not supplied';
  const seconds=Math.max(0,Math.round((Date.now()-observed)/1000));
  if(seconds<60)return `${seconds}s ago`;
  if(seconds<3600)return `${Math.round(seconds/60)}m ago`;
  return `${Math.round(seconds/3600)}h ago`;
};

export async function renderLiveMarkets(main,deps){
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  const catalog=await api('/api/v1/live-markets/catalog');
  const defaults={provider:'binance',symbol:'BTCUSDT',interval:'1m',limit:240};
  main.innerHTML=`<section class="q-page q-live-market-page">${pageHead('Qelly Intelligence · Live public market layer','Qelly Live Market Command','Institutional read-only market workspace powered by Qelly provider adapters. Public candle feeds remain source-labelled, fixture fallback stays explicit, and unavailable evidence stays unavailable.',`<button class="q-button q-button--ghost" data-action="about-data">Data policy</button><button class="q-button q-button--primary" data-action="refresh-live">Refresh market</button>`)}${stateBanner()}
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
  <section class="q-v5-market-ribbon" aria-label="Current market snapshot">
    <div class="q-v5-market-metric"><span>Last</span><strong id="live-kpi-last">—</strong></div>
    <div class="q-v5-market-metric"><span>Change</span><strong id="live-kpi-change">—</strong></div>
    <div class="q-v5-market-metric"><span>High</span><strong id="live-kpi-high">—</strong></div>
    <div class="q-v5-market-metric"><span>Low</span><strong id="live-kpi-low">—</strong></div>
    <div class="q-v5-market-metric"><span>Visible volume</span><strong id="live-kpi-volume">—</strong></div>
    <div class="q-v5-market-metric"><span>Feed mode</span><strong id="live-kpi-mode">Loading</strong></div>
  </section>
  <section class="q-v5-evidence-ribbon" aria-label="Market evidence envelope">
    <div class="q-v5-evidence-cell"><span>Source</span><strong id="live-evidence-source">Preparing…</strong></div>
    <div class="q-v5-evidence-cell"><span>Observed</span><strong id="live-evidence-observed">Not supplied</strong></div>
    <div class="q-v5-evidence-cell"><span>Freshness</span><strong id="live-evidence-freshness">Not supplied</strong></div>
    <div class="q-v5-evidence-cell"><span>Confidence</span><strong>Not supplied</strong></div>
    <div class="q-v5-evidence-cell"><span>Coverage</span><strong>Selected public candle feed</strong></div>
    <div class="q-v5-evidence-cell"><span>Execution</span><strong>Disabled</strong></div>
  </section>
  <div class="q-live-layout">
    <section class="q-live-chart-shell q-panel">
      <div class="q-live-chart-toolbar"><div class="q-chart-tool-group"><button title="Crosshair">⌖</button><button title="Trend line">╱</button><button title="Horizontal line">—</button><button title="Fibonacci">⌁</button><button title="Text note">T</button></div><div class="q-chart-tool-group"><button>SMA 20</button><button>Volume</button><button>Auto</button><span class="q-status q-status--simulated" id="live-mode-badge">loading</span></div></div>
      <div id="qelly-live-chart" class="q-tradingview-stage" aria-label="Live market candlestick chart"></div>
      <div class="q-chart-attribution"><span>Method: provider adapter → normalized candles → chart renderer</span><span id="live-observed-at">—</span></div>
    </section>
    <aside class="q-live-side-stack">
      <section class="q-panel q-orderbook-preview"><div class="q-panel-head"><div><h2>Market pulse</h2><p>Read-only public data</p></div><span class="q-provider-pulse"></span></div><div class="q-panel-body"><div class="q-live-stat"><span>24h-style change</span><strong id="live-stat-change">—</strong></div><div class="q-live-stat"><span>Visible range volume</span><strong id="live-stat-volume">—</strong></div><div class="q-live-stat"><span>Provider mode</span><strong id="live-stat-provider">—</strong></div><div class="q-live-stat"><span>Execution</span><strong class="is-negative">Disabled</strong></div></div></section>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Provider matrix</h2><p>Public market data only</p></div></div><div class="q-panel-body q-stack">${catalog.providers.map(p=>`<div class="q-record-row"><span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.transport.join(' · '))}</small></span><span class="q-status q-status--${p.realtime?'live':'simulated'}">${p.realtime?'live-capable':'fallback'}</span></div>`).join('')}</div></section>
      <section class="q-panel q-risk-lock"><div class="q-panel-body"><p class="q-eyebrow">Read-only safety lock</p><h2>Observe, analyse, decide.</h2><p>No order placement, API keys, balances, transfers, withdrawals, private keys or wallet custody are available on this screen.</p></div></section>
    </aside>
  </div>
  <section class="q-panel q-market-tape"><div class="q-panel-head"><div><h2>Illustrative watch universe</h2><p>Static demo values for symbol selection; not provider observations</p></div><button class="q-button q-button--secondary" data-action="open-watchlists">Open watchlists</button></div><div class="q-panel-body"><div class="q-tape-grid">${['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'].map((symbol)=>`<button class="q-tape-card" data-live-symbol="${symbol}"><span>${symbol.replace('USDT',' / USDT')}</span><strong>Demo</strong><small class="q-status q-status--simulated">illustrative</small></button>`).join('')}</div></div></section>
  </section>`;

  const controls={provider:main.querySelector('#live-provider'),symbol:main.querySelector('#live-symbol'),interval:main.querySelector('#live-interval')};
  let chartHandle=null, socket=null, poller=null, current={...defaults};
  const closeRealtime=()=>{if(socket){socket.close();socket=null;}if(poller){clearInterval(poller);poller=null;}chartHandle?.destroy?.();chartHandle=null;};
  window.__qellyLiveMarketCleanup=closeRealtime;
  const setSymbols=()=>{const list=SYMBOLS[controls.provider.value]||SYMBOLS.fixture;const previous=controls.symbol.value;controls.symbol.innerHTML=list.map(x=>`<option>${x}</option>`).join('');if(list.includes(previous))controls.symbol.value=previous;};
  const updateSummary=(data)=>{
    const s=data.summary||{};
    const source=data.source||{};
    const observed=source.observedAt?new Date(source.observedAt):null;
    const observedLabel=observed&&!Number.isNaN(observed.getTime())?observed.toLocaleString('en-IN'):'Not supplied';
    const change=Number(s.changePercent);
    const changeLabel=Number.isFinite(change)?`${change>=0?'+':''}${change.toFixed(2)}%`:'—';
    const changeClass=change>=0?'is-positive':'is-negative';
    main.querySelector('#live-last-price').textContent=format(s.last);
    const changeEl=main.querySelector('#live-change');changeEl.textContent=changeLabel;changeEl.className=changeClass;
    main.querySelector('#live-range').textContent=`High ${format(s.high)} · Low ${format(s.low)}`;
    main.querySelector('#live-stat-change').textContent=changeLabel;main.querySelector('#live-stat-change').className=changeClass;
    main.querySelector('#live-stat-volume').textContent=format(s.volume);
    main.querySelector('#live-stat-provider').textContent=source.name||data.provider||'Unknown';
    main.querySelector('#live-mode-badge').textContent=source.mode||'unknown';
    main.querySelector('#live-mode-badge').className=`q-status q-status--${source.mode==='live-public'?'live':'simulated'}`;
    main.querySelector('#live-source-label').textContent=source.fallbackReason?`${source.name||data.provider} · fallback: ${source.fallbackReason}`:`${source.name||data.provider} · ${source.mode||'unknown'}`;
    main.querySelector('#live-observed-at').textContent=observedLabel;
    main.querySelector('#live-kpi-last').textContent=format(s.last);
    const kpiChange=main.querySelector('#live-kpi-change');kpiChange.textContent=changeLabel;kpiChange.className=changeClass;
    main.querySelector('#live-kpi-high').textContent=format(s.high);
    main.querySelector('#live-kpi-low').textContent=format(s.low);
    main.querySelector('#live-kpi-volume').textContent=format(s.volume);
    main.querySelector('#live-kpi-mode').textContent=source.mode||'unknown';
    main.querySelector('#live-evidence-source').textContent=source.name||data.provider||'Unknown';
    main.querySelector('#live-evidence-observed').textContent=observedLabel;
    main.querySelector('#live-evidence-freshness').textContent=freshness(source.observedAt);
  };
  const connectRealtime=(data)=>{
    if(data.source?.mode!=='live-public')return;
    if(current.provider==='binance'){
      const streamSymbol=current.symbol.toLowerCase().replace(/[^a-z0-9]/g,'');const wsUrl=`wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${current.interval}`;
      try{socket=new WebSocket(wsUrl);socket.onmessage=(event)=>{const payload=JSON.parse(event.data);const k=payload.k;if(!k)return;const point={time:Math.floor(Number(k.t)/1000),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v)};chartHandle?.update?.(point);const last=format(point.close);main.querySelector('#live-last-price').textContent=last;main.querySelector('#live-kpi-last').textContent=last;};socket.onerror=()=>toast('Binance stream interrupted; the chart retains the latest safe candle.',{tone:'warning'});}catch{}
    }else if(current.provider==='coindcx')poller=setInterval(()=>load({quiet:true}),7000);
  };
  const load=async({quiet=false}={})=>{closeRealtime();current={provider:controls.provider.value,symbol:controls.symbol.value,interval:controls.interval.value,limit:260};const chartEl=main.querySelector('#qelly-live-chart');if(!quiet)chartEl.innerHTML='<div class="q-chart-loading"><span></span><strong>Synchronising market canvas</strong><small>Provider adapter → normalized candles → chart renderer</small></div>';
    try{const query=new URLSearchParams({...current,mode:current.provider==='fixture'?'fixture':'live'});const data=await api(`/api/v1/live-markets/candles?${query}`);updateSummary(data);main.querySelector('#live-symbol-title').textContent=current.symbol.replace(/^B-/,'').replace('_',' / ').replace('USDT',' / USDT');chartHandle=await mountLiveMarketChart(chartEl,{points:data.points,symbol:data.symbol,interval:data.interval,onCrosshair:(bar)=>{main.querySelector('#live-range').textContent=`O ${format(bar.open)} · H ${format(bar.high)} · L ${format(bar.low)} · C ${format(bar.close)}`;}});connectRealtime(data);}catch(error){chartEl.innerHTML=`<div class="q-empty-state"><strong>Market feed unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;toast(error.message,{tone:'danger'});}};
  controls.provider.addEventListener('change',()=>{setSymbols();load();});controls.symbol.addEventListener('change',()=>load());controls.interval.addEventListener('change',()=>load());main.querySelector('[data-action="refresh-live"]').addEventListener('click',()=>load());main.querySelector('[data-action="about-data"]').addEventListener('click',()=>toast('Qelly uses public read-only candle feeds only. Confidence and broader coverage remain marked unavailable when the selected provider does not supply them.',{tone:'info'}));main.querySelector('[data-action="open-watchlists"]').addEventListener('click',()=>deps.navigate('watchlist'));main.querySelector('#live-stream-toggle').addEventListener('click',(event)=>{event.currentTarget.classList.toggle('is-active');if(event.currentTarget.classList.contains('is-active'))load();else{if(socket)socket.close();if(poller)clearInterval(poller);toast('Live follow paused',{tone:'info'});}});main.querySelectorAll('[data-live-symbol]').forEach(button=>button.addEventListener('click',()=>{controls.provider.value='binance';setSymbols();controls.symbol.value=button.dataset.liveSymbol;load();}));
  await load();
}
