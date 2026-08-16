import {mountTradingViewDisplay} from '../market/tradingview-display-widget.mjs';

const DISPLAY_INTERVALS=['5m','15m','1h','4h','1d'];
const DISPLAY_SYMBOLS=['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'];
const format=(value)=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:Math.abs(Number(value))>100?2:6}).format(Number(value)):'—';
const symbolLabel=(value)=>{const symbol=String(value||'BTCUSDT');for(const quote of ['USDT','USD','EUR','INR'])if(symbol.endsWith(quote))return `${symbol.slice(0,-quote.length)} / ${quote}`;return symbol.replace('-',' / ');};
const tone=(provider)=>provider?.realtimeAuthorized===true?'live':'unavailable';

function providerRows(providers,escapeHtml){
  if(!providers.length)return '<div class="q-empty-state"><strong>Provider registry unavailable</strong><p>No provider policy inventory was returned.</p></div>';
  return providers.map((provider)=>`<div class="q-record-row" data-provider-row="${escapeHtml(provider.id)}"><span><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml((provider.transport||[]).join(' · ')||'Transport unavailable')}</small></span><span><span class="q-status q-status--${tone(provider)}">${provider.realtimeAuthorized?'authorized live':'rights blocked'}</span><small>${escapeHtml(provider.termsState||provider.reason||'policy unavailable')}</small></span></div>`).join('');
}

const options=(items,escapeHtml,labeler=(value)=>value)=>items.map((value)=>`<option value="${escapeHtml(value)}">${escapeHtml(labeler(value))}</option>`).join('');

export async function renderLiveMarkets(main,deps){
  const {api,pageHead,stateBanner,escapeHtml,toast}=deps;
  let catalog;
  try{catalog=await api('/api/v1/live-markets/catalog');}
  catch(error){
    main.innerHTML=`<section class="q-page q-live-market-page">${pageHead('Qelly Intelligence · Market data','Live Market Command','The authenticated market-data policy service is unavailable. Qelly will not replace it with generated observations.',`<button class="q-button q-button--primary" data-action="retry-live">Retry</button>`)}${stateBanner()}<section class="q-panel"><div class="q-panel-body"><div class="q-empty-state"><strong>Market service unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section></section>`;
    main.querySelector('[data-action="retry-live"]')?.addEventListener('click',()=>renderLiveMarkets(main,deps));
    return;
  }

  const providers=Array.isArray(catalog.providers)?catalog.providers:[];
  const authorized=providers.filter((provider)=>provider.realtimeAuthorized===true&&provider.enabled===true);
  const initialProvider=authorized[0]||null;
  const providerOptions=authorized.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
  const initialProviderSymbols=Array.isArray(initialProvider?.symbols)?initialProvider.symbols:[];
  const initialProviderIntervals=Array.isArray(initialProvider?.intervals)?initialProvider.intervals:[];

  main.innerHTML=`<section class="q-page q-live-market-page" data-market-runtime="v7-provider-contract-no-fabrication">
    ${pageHead('Qelly Intelligence · Governed market display','Live Market Command','External market display and Qelly-governed analytical observations are separate trust domains. Display symbols and intervals never get reused as provider API parameters unless the provider contract explicitly exposes them.',`<a class="q-button q-button--ghost" href="#/data-mesh">Provider policy</a><button class="q-button q-button--primary" data-action="refresh-live">Refresh governed data</button>`)}${stateBanner()}

    <section class="q-live-command-deck" data-v53-evidence-adjacent="true">
      <div class="q-live-symbol-block"><span class="q-live-asset-icon">Q</span><div><p>External display market</p><h2 id="live-symbol-title">${escapeHtml(symbolLabel(DISPLAY_SYMBOLS[0]))}</h2><span>TradingView · isolated display boundary</span></div></div>
      <div class="q-live-price-block"><span id="live-last-price">—</span><strong id="live-change">INTERNAL FEED ${initialProvider?'AVAILABLE':'UNAVAILABLE'}</strong><small id="live-range">No Qelly-generated fallback values</small></div>
      <div class="q-live-controls">
        <label><span>Display symbol</span><select id="live-symbol">${options(DISPLAY_SYMBOLS,escapeHtml,symbolLabel)}</select></label>
        <label><span>Display interval</span><select id="live-interval">${options(DISPLAY_INTERVALS,escapeHtml)}</select></label>
        <label><span>Governed provider</span><select id="live-provider" ${initialProvider?'':'disabled'}>${providerOptions||'<option>No rights-authorized provider</option>'}</select></label>
        <label><span>Provider symbol</span><select id="live-provider-symbol" ${initialProvider?'':'disabled'}>${initialProvider?options(initialProviderSymbols,escapeHtml,symbolLabel):'<option>Unavailable</option>'}</select></label>
        <label><span>Provider interval</span><select id="live-provider-interval" ${initialProvider?'':'disabled'}>${initialProvider?options(initialProviderIntervals,escapeHtml):'<option>Unavailable</option>'}</select></label>
        <button class="q-live-toggle" id="live-stream-toggle" type="button" disabled aria-disabled="true"><span></span><b>${initialProvider?'Provider approved':'Streaming unavailable'}</b></button>
      </div>
    </section>

    <section class="q-v5-market-ribbon" aria-label="Market data boundaries">
      <div class="q-v5-market-metric"><span>Governed last</span><strong id="live-kpi-last">—</strong></div>
      <div class="q-v5-market-metric"><span>Governed change</span><strong id="live-kpi-change">—</strong></div>
      <div class="q-v5-market-metric"><span>Internal provider</span><strong id="live-kpi-provider">${initialProvider?escapeHtml(initialProvider.id.toUpperCase()):'UNAVAILABLE'}</strong></div>
      <div class="q-v5-market-metric"><span>External display</span><strong>TRADINGVIEW</strong></div>
      <div class="q-v5-market-metric"><span>Fabricated fallback</span><strong>OFF</strong></div>
      <div class="q-v5-market-metric"><span>Execution</span><strong>DISABLED</strong></div>
    </section>

    <section class="q-v5-evidence-ribbon" aria-label="Market evidence envelope">
      <div class="q-v5-evidence-cell"><span>Analytics source</span><strong id="live-evidence-source">${initialProvider?escapeHtml(initialProvider.name):'No authorized crypto feed'}</strong></div>
      <div class="q-v5-evidence-cell"><span>Observed</span><strong id="live-evidence-observed">Not supplied</strong></div>
      <div class="q-v5-evidence-cell"><span>Truth state</span><strong id="live-evidence-truth">${initialProvider?'Awaiting provider':'UNAVAILABLE'}</strong></div>
      <div class="q-v5-evidence-cell"><span>Provider contract</span><strong id="live-evidence-contract">${initialProvider?'SEPARATE SYMBOL / INTERVAL':'UNAVAILABLE'}</strong></div>
      <div class="q-v5-evidence-cell"><span>Display reuse</span><strong>PROHIBITED</strong></div>
      <div class="q-v5-evidence-cell"><span>Execution</span><strong>Disabled</strong></div>
    </section>

    <div class="q-live-layout">
      <section class="q-live-chart-shell q-panel" data-v53-evidence-adjacent="true">
        <div class="q-live-chart-toolbar"><div><strong>External chart</strong><small> Human-readable research display only</small></div><span class="q-status q-status--cached">DISPLAY ONLY</span></div>
        <div id="qelly-live-chart" class="q-tradingview-stage" aria-label="TradingView external market chart" style="min-height:560px"></div>
        <div class="q-chart-attribution"><span>TradingView values are not read, scraped, persisted or used by Qelly analytics.</span><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">Open TradingView ↗</a></div>
      </section>
      <aside class="q-live-side-stack">
        <section class="q-panel"><div class="q-panel-head"><div><h2>Governed market status</h2><p>Internal analytical data only</p></div><span class="q-status q-status--${initialProvider?'live':'unavailable'}">${initialProvider?'AUTHORIZED':'UNAVAILABLE'}</span></div><div class="q-panel-body"><div class="q-live-stat"><span>Last</span><strong id="live-stat-last">—</strong></div><div class="q-live-stat"><span>Change</span><strong id="live-stat-change">—</strong></div><div class="q-live-stat"><span>High / low</span><strong id="live-stat-range">—</strong></div><div class="q-live-stat"><span>Volume</span><strong id="live-stat-volume">—</strong></div><div class="q-live-stat"><span>Provider rights</span><strong>${initialProvider?'Authorized':'Blocked / unverified'}</strong></div><div class="q-live-stat"><span>Execution</span><strong class="is-negative">Disabled</strong></div></div></section>
        <section class="q-panel"><div class="q-panel-head"><div><h2>Provider matrix</h2><p>Only explicitly authorized providers can feed Qelly analytics.</p></div></div><div class="q-panel-body q-stack">${providerRows(providers,escapeHtml)}</div></section>
        <section class="q-panel"><div class="q-panel-head"><div><h2>External research</h2><p>Professional source links</p></div></div><div class="q-panel-body q-stack"><a class="q-button q-button--secondary" href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">TradingView ↗</a><a class="q-button q-button--secondary" href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory calendar ↗</a><a class="q-button q-button--secondary" href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB reference rates ↗</a></div></section>
        <section class="q-panel q-risk-lock"><div class="q-panel-body"><p class="q-eyebrow">Evidence boundary</p><h2>No synthetic market substitute</h2><p>Blocked providers remain blocked. External widget observations never become Qelly analytical inputs. Missing internal market data remains visibly unavailable.</p></div></section>
      </aside>
    </div>
  </section>`;

  const controls={
    provider:main.querySelector('#live-provider'),
    displaySymbol:main.querySelector('#live-symbol'),
    displayInterval:main.querySelector('#live-interval'),
    providerSymbol:main.querySelector('#live-provider-symbol'),
    providerInterval:main.querySelector('#live-provider-interval')
  };
  const chartTarget=main.querySelector('#qelly-live-chart');
  let chartHandle=null;
  const providerById=(id)=>authorized.find((item)=>item.id===id)||null;
  const fill=(select,items,labeler=(value)=>value)=>{select.replaceChildren(...items.map((value)=>{const option=document.createElement('option');option.value=value;option.textContent=labeler(value);return option;}));select.disabled=items.length===0;};
  const configureProvider=()=>{
    const selected=providerById(controls.provider?.value)||initialProvider;
    if(!selected){fill(controls.providerSymbol,[]);fill(controls.providerInterval,[]);main.querySelector('#live-kpi-provider').textContent='UNAVAILABLE';main.querySelector('#live-evidence-contract').textContent='UNAVAILABLE';return null;}
    fill(controls.providerSymbol,Array.isArray(selected.symbols)?selected.symbols:[],symbolLabel);
    fill(controls.providerInterval,Array.isArray(selected.intervals)?selected.intervals:[]);
    main.querySelector('#live-kpi-provider').textContent=selected.id.toUpperCase();
    main.querySelector('#live-evidence-source').textContent=selected.name;
    main.querySelector('#live-evidence-contract').textContent=`${controls.providerSymbol.value||'—'} · ${controls.providerInterval.value||'—'}`;
    return selected;
  };
  const mountExternal=()=>{chartHandle?.destroy?.();chartHandle=mountTradingViewDisplay(chartTarget,{symbol:controls.displaySymbol.value,interval:controls.displayInterval.value});main.querySelector('#live-symbol-title').textContent=symbolLabel(controls.displaySymbol.value);};
  const clearGoverned=()=>{['#live-last-price','#live-kpi-last','#live-kpi-change','#live-stat-last','#live-stat-change','#live-stat-range','#live-stat-volume'].forEach(selector=>{const node=main.querySelector(selector);if(node)node.textContent='—';});main.querySelector('#live-evidence-observed').textContent='Not supplied';main.querySelector('#live-evidence-truth').textContent='UNAVAILABLE';};
  const loadGoverned=async()=>{
    const selected=configureProvider();
    if(!selected){clearGoverned();return;}
    const providerId=selected.id;
    const symbol=controls.providerSymbol.value;
    const interval=controls.providerInterval.value;
    if(!symbol||!interval){clearGoverned();return;}
    try{
      const data=await api(`/api/v1/live-markets/candles?provider=${encodeURIComponent(providerId)}&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=120`);
      const summary=data.summary||{},source=data.source||{};
      main.querySelector('#live-last-price').textContent=format(summary.last);
      main.querySelector('#live-kpi-last').textContent=format(summary.last);
      main.querySelector('#live-kpi-change').textContent=Number.isFinite(Number(summary.changePercent))?`${Number(summary.changePercent)>=0?'+':''}${Number(summary.changePercent).toFixed(2)}%`:'—';
      main.querySelector('#live-stat-last').textContent=format(summary.last);
      main.querySelector('#live-stat-change').textContent=format(summary.change);
      main.querySelector('#live-stat-range').textContent=summary.high==null?'—':`${format(summary.high)} / ${format(summary.low)}`;
      main.querySelector('#live-stat-volume').textContent=format(summary.volume);
      main.querySelector('#live-evidence-source').textContent=source.name||providerId;
      main.querySelector('#live-evidence-observed').textContent=source.observedAt?new Date(source.observedAt).toLocaleString('en-IN'):'Not supplied';
      main.querySelector('#live-evidence-truth').textContent=String(source.mode||'UNAVAILABLE').toUpperCase();
      main.querySelector('#live-evidence-contract').textContent=`${symbol} · ${interval}`;
    }catch(error){clearGoverned();toast?.(`Governed provider data unavailable: ${error.message}`,{tone:'warning'});}
  };
  controls.displaySymbol?.addEventListener('change',mountExternal);
  controls.displayInterval?.addEventListener('change',mountExternal);
  controls.provider?.addEventListener('change',()=>{configureProvider();void loadGoverned();});
  controls.providerSymbol?.addEventListener('change',()=>void loadGoverned());
  controls.providerInterval?.addEventListener('change',()=>void loadGoverned());
  main.querySelector('[data-action="refresh-live"]')?.addEventListener('click',()=>void loadGoverned());
  window.__qellyLiveMarketCleanup=()=>{chartHandle?.destroy?.();chartHandle=null;};
  mountExternal();
  configureProvider();
  await loadGoverned();
}