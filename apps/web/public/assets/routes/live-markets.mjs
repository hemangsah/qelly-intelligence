import { mountLiveMarketChart } from '../market/tradingview-live-chart.mjs';

const INTERVALS=['1m','5m','15m','30m','1h','4h','1d'];
const FALLBACK_SYMBOLS={fixture:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'],binance:['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'],coinbase:['BTC-USD','ETH-USD','SOL-USD','XRP-USD','ADA-USD']};
const format=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:Math.abs(Number(value))>100?2:6}).format(Number(value)):'—';
const freshness=(value)=>{
  const observed=Date.parse(value||'');
  if(!Number.isFinite(observed))return 'Not supplied';
  const seconds=Math.max(0,Math.round((Date.now()-observed)/1000));
  if(seconds<60)return `${seconds}s ago`;
  if(seconds<3600)return `${Math.round(seconds/60)}m ago`;
  return `${Math.round(seconds/3600)}h ago`;
};
const confidence=(source={})=>{
  if(source.mode==='live-public'&&source.realtimeAuthorized===true)return 'Direct provider';
  if(source.mode==='cached-public')return 'Reduced · cached';
  if(source.mode==='stale-public')return 'Low · stale';
  if(source.mode==='simulated-demo')return 'Demonstration only';
  return 'Unavailable';
};
const symbolLabel=(value)=>{
  const symbol=String(value||'BTCUSDT').replace(/^B-/,'').replace('_','');
  if(symbol.includes('-'))return symbol.replace('-',' / ');
  for(const quote of ['USDT','USD','EUR','INR'])if(symbol.endsWith(quote))return `${symbol.slice(0,-quote.length)} / ${quote}`;
  return symbol;
};
const providerTone=(provider)=>provider.enabled?(provider.realtimeAuthorized?'live':'simulated'):'unavailable';

export async function renderLiveMarkets(main,deps){
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  let catalog;
  try{catalog=await api('/api/v1/live-markets/catalog');}
  catch(error){
    main.innerHTML=`<section class="q-page q-live-market-page">${pageHead('Qelly Intelligence · Market data','Market Data Workspace','The authenticated market-data compatibility service is unavailable. Qelly will not fabricate provider status.',`<button class="q-button q-button--primary" data-action="retry-live">Retry</button>`)}${stateBanner()}<section class="q-panel"><div class="q-panel-body"><div class="q-empty-state"><strong>Market service unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section></section>`;
    main.querySelector('[data-action="retry-live"]')?.addEventListener('click',()=>renderLiveMarkets(main,deps));
    return;
  }

  const providers=Array.isArray(catalog.providers)?catalog.providers:[];
  const fixture=providers.find(provider=>provider.id==='fixture')||{id:'fixture',name:'Qelly Governed Demonstration',enabled:true,realtime:false,realtimeAuthorized:false,symbols:FALLBACK_SYMBOLS.fixture,transport:['deterministic local']};
  const defaults={provider:fixture.id,symbol:(fixture.symbols||FALLBACK_SYMBOLS.fixture)[0]||'BTCUSDT',interval:'1m',limit:260};
  const providerOptions=providers.map(provider=>`<option value="${escapeHtml(provider.id)}" ${provider.id===defaults.provider?'selected':''} ${!provider.enabled&&provider.id!=='fixture'?'disabled':''}>${escapeHtml(provider.name)}${provider.enabled?'':' · rights blocked'}</option>`).join('');
  const providerRows=providers.map(provider=>`<div class="q-record-row" data-provider-row="${escapeHtml(provider.id)}"><span><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml((provider.transport||[]).join(' · ')||'Transport unavailable')}</small></span><span><span class="q-status q-status--${providerTone(provider)}">${provider.realtimeAuthorized?'authorized live':provider.enabled?'governed demo':'display blocked'}</span><small>${escapeHtml(provider.termsState||provider.reason||'policy unavailable')}</small></span></div>`).join('');

  main.innerHTML=`<section class="q-page q-live-market-page" data-market-runtime="pages-contract-v2">
    ${pageHead('Qelly Intelligence · Governed market data','Live Market Command','Institutional read-only market workspace with explicit provider rights, freshness and fallback state. Qelly never labels blocked or simulated observations as live.',`<button class="q-button q-button--ghost" data-action="about-data">Data policy</button><button class="q-button q-button--primary" data-action="refresh-live">Refresh market</button>`)}${stateBanner()}
    <section class="q-live-command-deck" data-v53-evidence-adjacent="true">
      <div class="q-live-symbol-block"><span class="q-live-asset-icon">Q</span><div><p>Selected market</p><h2 id="live-symbol-title">${escapeHtml(symbolLabel(defaults.symbol))}</h2><span id="live-source-label">Preparing governed feed…</span></div></div>
      <div class="q-live-price-block"><span id="live-last-price">—</span><strong id="live-change">—</strong><small id="live-range">High — · Low —</small></div>
      <div class="q-live-controls">
        <label><span>Provider</span><select id="live-provider">${providerOptions}</select></label>
        <label><span>Symbol</span><select id="live-symbol"></select></label>
        <label><span>Interval</span><select id="live-interval">${INTERVALS.map(interval=>`<option>${interval}</option>`).join('')}</select></label>
        <button class="q-live-toggle" id="live-stream-toggle" type="button" disabled aria-disabled="true"><span></span><b>Streaming unavailable</b></button>
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
      <div class="q-v5-evidence-cell"><span>Confidence</span><strong id="live-evidence-confidence">Not supplied</strong></div>
      <div class="q-v5-evidence-cell"><span>Coverage</span><strong>Selected candle series</strong></div>
      <div class="q-v5-evidence-cell"><span>Execution</span><strong>Disabled</strong></div>
    </section>

    <div class="q-live-layout">
      <section class="q-live-chart-shell q-panel" data-v53-evidence-adjacent="true">
        <div class="q-live-chart-toolbar"><div class="q-chart-tool-group"><button title="Crosshair">⌖</button><button title="Trend line">╱</button><button title="Horizontal line">—</button><button title="Text note">T</button></div><div class="q-chart-tool-group"><button>SMA 20</button><button>Volume</button><button>Auto</button><span class="q-status q-status--simulated" id="live-mode-badge">loading</span></div></div>
        <div id="qelly-live-chart" class="q-tradingview-stage" aria-label="Market candlestick chart"></div>
        <div class="q-chart-attribution"><span>Method: provider policy → normalized candles → chart renderer</span><span id="live-observed-at">—</span></div>
      </section>
      <aside class="q-live-side-stack">
        <section class="q-panel"><div class="q-panel-head"><div><h2>Market pulse</h2><p>Read-only governed data</p></div><span class="q-provider-pulse"></span></div><div class="q-panel-body"><div class="q-live-stat"><span>Range change</span><strong id="live-stat-change">—</strong></div><div class="q-live-stat"><span>Visible range volume</span><strong id="live-stat-volume">—</strong></div><div class="q-live-stat"><span>Provider mode</span><strong id="live-stat-provider">—</strong></div><div class="q-live-stat"><span>Provider rights</span><strong id="live-stat-rights">Evaluating</strong></div><div class="q-live-stat"><span>Execution</span><strong class="is-negative">Disabled</strong></div></div></section>
        <section class="q-panel"><div class="q-panel-head"><div><h2>Provider matrix</h2><p>Rights and availability · selectable only when display rights are authorized</p></div></div><div class="q-panel-body q-stack">${providerRows}</div></section>
        <section class="q-panel q-risk-lock"><div class="q-panel-body"><p class="q-eyebrow">Evidence boundary</p><h2>Read-only safety lock</h2><p>No order placement, API keys, balances, transfers, withdrawals, private keys or wallet custody.</p><p id="live-policy-note">The governed demonstration feed is selected until a provider is explicitly rights-authorized by the production policy layer.</p></div></section>
      </aside>
    </div>

    <section class="q-panel q-market-tape"><div class="q-panel-head"><div><h2>Demonstration watch universe</h2><p>Navigation helpers only; values come from the selected governed feed after selection</p></div><button class="q-button q-button--secondary" data-action="open-watchlists">Open watchlists</button></div><div class="q-panel-body"><div class="q-tape-grid">${FALLBACK_SYMBOLS.fixture.map(symbol=>`<button class="q-tape-card" data-live-symbol="${symbol}"><span>${escapeHtml(symbolLabel(symbol))}</span><strong>Load</strong><small class="q-status q-status--simulated">governed demo</small></button>`).join('')}</div></div></section>
  </section>`;

  const controls={provider:main.querySelector('#live-provider'),symbol:main.querySelector('#live-symbol'),interval:main.querySelector('#live-interval')};
  const streamToggle=main.querySelector('#live-stream-toggle');
  let chartHandle=null,socket=null,poller=null,current={...defaults},lastData=null;
  const providerById=(id)=>providers.find(provider=>provider.id===id)||fixture;
  const symbolsFor=(id)=>providerById(id).symbols||FALLBACK_SYMBOLS[id]||FALLBACK_SYMBOLS.fixture;
  const closeRealtime=()=>{if(socket){try{socket.close();}catch{}socket=null;}if(poller){clearInterval(poller);poller=null;}chartHandle?.destroy?.();chartHandle=null;};
  window.__qellyLiveMarketCleanup=closeRealtime;
  const setSymbols=()=>{const list=symbolsFor(controls.provider.value);const previous=controls.symbol.value;controls.symbol.innerHTML=list.map(symbol=>`<option value="${escapeHtml(symbol)}">${escapeHtml(symbolLabel(symbol))}</option>`).join('');controls.symbol.value=list.includes(previous)?previous:list[0];};
  setSymbols();

  const setStreamState=(data)=>{
    const authorized=data?.source?.mode==='live-public'&&data?.source?.realtimeAuthorized===true;
    streamToggle.disabled=!authorized;
    streamToggle.setAttribute('aria-disabled',String(!authorized));
    streamToggle.classList.toggle('is-active',authorized);
    streamToggle.querySelector('b').textContent=authorized?'Live follow':'Streaming unavailable';
  };

  const updateSummary=(data)=>{
    lastData=data;
    const summary=data.summary||{};const source=data.source||{};const observed=source.observedAt?new Date(source.observedAt):null;const observedLabel=observed&&!Number.isNaN(observed.getTime())?observed.toLocaleString('en-IN'):'Not supplied';
    const change=Number(summary.changePercent);const changeLabel=Number.isFinite(change)?`${change>=0?'+':''}${change.toFixed(2)}%`:'—';const changeClass=Number.isFinite(change)?(change>=0?'is-positive':'is-negative'):'';
    main.querySelector('#live-symbol-title').textContent=symbolLabel(data.symbol||current.symbol);
    main.querySelector('#live-last-price').textContent=format(summary.last);
    const changeEl=main.querySelector('#live-change');changeEl.textContent=changeLabel;changeEl.className=changeClass;
    main.querySelector('#live-range').textContent=`High ${format(summary.high)} · Low ${format(summary.low)}`;
    main.querySelector('#live-stat-change').textContent=changeLabel;main.querySelector('#live-stat-change').className=changeClass;
    main.querySelector('#live-stat-volume').textContent=format(summary.volume);
    main.querySelector('#live-stat-provider').textContent=`${source.name||data.provider||'Unknown'} · ${source.mode||'unknown'}`;
    main.querySelector('#live-stat-rights').textContent=source.termsState||((source.realtimeAuthorized===true)?'authorized':'governed demo');
    const modeBadge=main.querySelector('#live-mode-badge');modeBadge.textContent=source.mode||'unknown';modeBadge.className=`q-status q-status--${source.mode==='live-public'?'live':source.mode==='cached-public'?'cached':source.mode==='stale-public'?'stale':'simulated'}`;
    main.querySelector('#live-source-label').textContent=source.fallbackReason?`${source.name||data.provider} · fallback: ${source.fallbackReason}`:`${source.name||data.provider} · ${source.mode||'unknown'}`;
    main.querySelector('#live-observed-at').textContent=observedLabel;
    main.querySelector('#live-kpi-last').textContent=format(summary.last);
    const kpiChange=main.querySelector('#live-kpi-change');kpiChange.textContent=changeLabel;kpiChange.className=changeClass;
    main.querySelector('#live-kpi-high').textContent=format(summary.high);main.querySelector('#live-kpi-low').textContent=format(summary.low);main.querySelector('#live-kpi-volume').textContent=format(summary.volume);main.querySelector('#live-kpi-mode').textContent=source.mode||'unknown';
    main.querySelector('#live-evidence-source').textContent=source.name||data.provider||'Unknown';main.querySelector('#live-evidence-observed').textContent=observedLabel;main.querySelector('#live-evidence-freshness').textContent=freshness(source.observedAt);main.querySelector('#live-evidence-confidence').textContent=confidence(source);
    main.querySelector('#live-policy-note').textContent=source.fallbackReason?`Requested provider ${data.requestedProvider||current.provider} is not being presented as live: ${source.fallbackReason}.`:(source.mode==='live-public'?'This provider is currently rights-authorized for live public display.':'Qelly is using a governed non-live market representation.');
    setStreamState(data);
  };

  const connectRealtime=(data)=>{
    if(data.source?.mode!=='live-public'||data.source?.realtimeAuthorized!==true)return;
    if(current.provider==='binance'){
      const streamSymbol=current.symbol.toLowerCase().replace(/[^a-z0-9]/g,'');
      const wsUrl=`wss://stream.binance.com:9443/ws/${streamSymbol}@kline_${current.interval}`;
      try{socket=new WebSocket(wsUrl);socket.onmessage=(event)=>{const payload=JSON.parse(event.data);const k=payload.k;if(!k)return;const point={time:Math.floor(Number(k.t)/1000),open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v)};chartHandle?.update?.(point);const last=format(point.close);main.querySelector('#live-last-price').textContent=last;main.querySelector('#live-kpi-last').textContent=last;};socket.onerror=()=>toast('Authorized market stream interrupted; the chart retains the latest governed candle.',{tone:'warning'});}catch(error){toast(`Market stream could not start: ${error.message}`,{tone:'warning'});}
    }else if(current.provider==='coinbase')poller=setInterval(()=>load({quiet:true}),7000);
  };

  const load=async({quiet=false}={})=>{
    closeRealtime();
    current={provider:controls.provider.value,symbol:controls.symbol.value,interval:controls.interval.value,limit:260};
    const chartEl=main.querySelector('#qelly-live-chart');
    if(!quiet)chartEl.innerHTML='<div class="q-chart-loading"><span></span><strong>Synchronising governed market canvas</strong><small>Provider policy → normalized candles → chart renderer</small></div>';
    try{
      const query=new URLSearchParams({...current,mode:current.provider==='fixture'?'fixture':'auto'});
      const data=await api(`/api/v1/live-markets/candles?${query}`);
      updateSummary(data);
      chartHandle=await mountLiveMarketChart(chartEl,{points:data.points,symbol:data.symbol,interval:data.interval,onCrosshair:(bar)=>{main.querySelector('#live-range').textContent=`O ${format(bar.open)} · H ${format(bar.high)} · L ${format(bar.low)} · C ${format(bar.close)}`;}});
      connectRealtime(data);
    }catch(error){chartEl.innerHTML=`<div class="q-empty-state"><strong>Market feed unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;setStreamState(null);toast(error.message,{tone:'danger'});}
  };

  controls.provider.addEventListener('change',()=>{setSymbols();load();});controls.symbol.addEventListener('change',()=>load());controls.interval.addEventListener('change',()=>load());
  main.querySelector('[data-action="refresh-live"]').addEventListener('click',()=>load());
  main.querySelector('[data-action="about-data"]').addEventListener('click',()=>toast('Provider display rights are enforced by the production backend. Blocked providers remain visible as policy evidence but cannot be selected or represented as live.',{tone:'info'}));
  main.querySelector('[data-action="open-watchlists"]').addEventListener('click',()=>deps.navigate('watchlist'));
  streamToggle.addEventListener('click',()=>{if(streamToggle.disabled)return;if(streamToggle.classList.toggle('is-active'))connectRealtime(lastData);else{if(socket)socket.close();if(poller)clearInterval(poller);toast('Live follow paused',{tone:'info'});}});
  main.querySelectorAll('[data-live-symbol]').forEach(button=>button.addEventListener('click',()=>{controls.provider.value='fixture';setSymbols();controls.symbol.value=button.dataset.liveSymbol;load();}));
  await load();
}