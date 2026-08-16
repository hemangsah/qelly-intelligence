import {mountTradingViewDisplay} from '../market/tradingview-display-widget.mjs';

const EXTERNAL_SYMBOLS=Object.freeze([
  ['BTCUSDT','BTC / USDT'],
  ['ETHUSDT','ETH / USDT'],
  ['SOLUSDT','SOL / USDT'],
  ['BNBUSDT','BNB / USDT'],
  ['XRPUSDT','XRP / USDT'],
  ['ADAUSDT','ADA / USDT']
]);
const INTERVALS=Object.freeze([['5m','5m'],['15m','15m'],['1h','1h'],['4h','4h'],['1d','1D']]);
const tone=(value)=>{const state=String(value||'').toUpperCase();if(['ENABLED','REFERENCE_ENABLED','LIVE','MATCH','PASS'].includes(state))return 'live';if(['DELAYED','WARNING','CACHED'].includes(state))return 'delayed';if(['UNAVAILABLE','DENY','MISMATCH','BLOCKED'].includes(state))return 'unavailable';return 'cached';};
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};
const value=(input)=>input==null||input===''?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(input));

function providerCard(provider,escapeHtml){
  const active=Boolean(provider.enabled);
  return `<article class="q-v6-market-provider">
    <div><span class="q-v6-runtime-dot q-v6-runtime-dot--${tone(provider.runtimeState)}"></span><span><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><small>${escapeHtml((provider.capabilities||[]).join(' · ')||'No approved capabilities')}</small></span></div>
    <span class="q-status q-status--${active?'live':'unavailable'}">${active?'approved':'rights blocked'}</span>
    <dl><dt>Runtime</dt><dd>${escapeHtml(provider.runtimeState||'UNAVAILABLE')}</dd><dt>Terms</dt><dd>${escapeHtml(provider.termsState||'not supplied')}</dd><dt>Reason</dt><dd>${escapeHtml(provider.reason||'No blocking reason')}</dd></dl>
    ${provider.termsUrl?`<a href="${escapeHtml(provider.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Provider terms ↗</a>`:''}
  </article>`;
}

function governedRows(plane,escapeHtml){
  const items=Array.isArray(plane?.items)?plane.items.slice(0,10):[];
  if(!items.length)return '<div class="q-empty-state"><strong>No governed observation snapshot available</strong><p>Sign in for the private data-plane snapshot, or open Reference Time Series for approved ECB history.</p></div>';
  return items.map((item)=>`<div class="q-v6-market-row"><span><strong>${escapeHtml(item.symbol||'—')}</strong><small>${escapeHtml(item.displayName||'')} · ${escapeHtml(item.unit||'')}</small></span><span><strong>${escapeHtml(value(item.value))}</strong><small>${escapeHtml(date(item.observedAt))}</small></span><span class="q-status q-status--${tone(item.truthState)}">${escapeHtml(item.truthState||'UNAVAILABLE')}</span></div>`).join('');
}

export async function renderMarketV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  const [providerResult,planeResult]=await Promise.allSettled([
    api('/api/v1/providers/runtime'),
    api('/api/v1/platform/data-plane?limit=10')
  ]);
  const runtime=providerResult.status==='fulfilled'?providerResult.value:{providers:[],liveProviderFeatureEnabled:false};
  const plane=planeResult.status==='fulfilled'?planeResult.value:null;
  const providers=Array.isArray(runtime.providers)?runtime.providers:[];
  const authorizedMarketProviders=providers.filter((provider)=>provider.enabled&&provider.id!=='ecb');
  const referenceProviders=providers.filter((provider)=>provider.enabled&&provider.id==='ecb');
  const symbolOptions=EXTERNAL_SYMBOLS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const intervalOptions=INTERVALS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');

  main.innerHTML=`<section class="q-page q-v6-market-page" data-market-runtime="governed-v6">
    ${pageHead('Qelly Intelligence · Governed market command','Market Intelligence Command','External live display and Qelly-governed analytical data are deliberately separated. No generated price, candle, volume or market-cap observation is substituted when provider rights are unavailable.',`<a class="q-button q-button--secondary" href="#/data-mesh">Provider runtime</a><a class="q-button q-button--primary" href="#/timeseries-lab">Reference history</a>`)}${stateBanner()}

    <section class="q-v6-market-truth-strip">
      <div><span>Internal crypto feed</span><strong>${authorizedMarketProviders.length?'AUTHORIZED':'UNAVAILABLE'}</strong><small>${authorizedMarketProviders.length?'Rights-authorized provider available':'Binance / Coinbase remain policy blocked'}</small></div>
      <div><span>Approved reference feed</span><strong>${referenceProviders.length?'ECB ACTIVE':'UNAVAILABLE'}</strong><small>Daily working-day FX reference data</small></div>
      <div><span>External chart</span><strong>TRADINGVIEW</strong><small>Display-only · never ingested by Qelly</small></div>
      <div><span>Execution</span><strong>DISABLED</strong><small>No orders, balances, custody or signing</small></div>
      <div><span>Runtime</span><strong>${escapeHtml(plane?.canonicalRuntime||'Cloudflare Pages')}</strong><small>${escapeHtml(String(plane?.releaseSha||runtime.releaseSha||'').slice(0,12)||'release unresolved')}</small></div>
    </section>

    <div class="q-v6-market-layout">
      <section class="q-panel q-v6-market-chart-panel">
        <div class="q-panel-head"><div><h2>External live market display</h2><p>TradingView renders this chart independently. Qelly does not read or reuse widget values.</p></div><span class="q-status q-status--cached">DISPLAY ONLY</span></div>
        <div class="q-panel-body">
          <div class="q-control-row q-v6-market-controls"><label class="q-setting"><span>Display symbol</span><select id="v6-market-symbol">${symbolOptions}</select></label><label class="q-setting"><span>Interval</span><select id="v6-market-interval">${intervalOptions}</select></label><div class="q-setting q-query-boundary"><span>Analytics boundary</span><strong>External values excluded</strong><small>Never used for Qelly calculations, risk, alerts or decisions.</small></div></div>
          <div id="v6-market-tradingview" class="q-v6-market-tradingview" aria-label="TradingView external market chart"></div>
        </div>
      </section>

      <aside class="q-panel q-v6-market-side">
        <div class="q-panel-head"><div><h2>Research surfaces</h2><p>Open professional external sources without misrepresenting them as Qelly-owned data.</p></div></div>
        <div class="q-panel-body q-v6-market-links">
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow"><strong>TradingView</strong><span>Charts and market display ↗</span></a>
          <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow"><strong>Forex Factory</strong><span>Macro event calendar ↗</span></a>
          <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow"><strong>European Central Bank</strong><span>Official FX reference rates ↗</span></a>
        </div>
        <div class="q-v6-market-boundary"><span class="q-status q-status--unavailable">NO FALLBACK FABRICATION</span><p>If an internal market provider is unavailable or rights-blocked, Qelly shows that state directly. It does not manufacture substitute market observations.</p></div>
      </aside>
    </div>

    <section class="q-panel"><div class="q-panel-head"><div><h2>Governed observation plane</h2><p>Provider-backed data available to Qelly analytics. Current production coverage is reference-data focused.</p></div><span class="q-status q-status--${plane?'delayed':'unavailable'}">${plane?'CONNECTED':'AUTH REQUIRED'}</span></div><div class="q-panel-body q-v6-market-observations">${governedRows(plane,escapeHtml)}</div></section>

    <section class="q-panel"><div class="q-panel-head"><div><h2>Provider rights matrix</h2><p>Runtime availability follows explicit commercial and redistribution policy.</p></div><span class="q-status q-status--cached">${providers.length} governed providers</span></div><div class="q-panel-body q-v6-market-provider-grid">${providers.map((provider)=>providerCard(provider,escapeHtml)).join('')||'<div class="q-empty-state">Provider registry unavailable.</div>'}</div></section>
  </section>`;

  const chart=main.querySelector('#v6-market-tradingview');
  const symbol=main.querySelector('#v6-market-symbol');
  const interval=main.querySelector('#v6-market-interval');
  let handle=null;
  const mount=()=>{handle?.destroy?.();handle=mountTradingViewDisplay(chart,{symbol:symbol.value,interval:interval.value});};
  symbol?.addEventListener('change',mount);interval?.addEventListener('change',mount);mount();
  window.__qellyMarketV6Cleanup=()=>{handle?.destroy?.();handle=null;};
}

export const __marketV6Test=Object.freeze({EXTERNAL_SYMBOLS,INTERVALS,tone});
