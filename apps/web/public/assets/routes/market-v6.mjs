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
const tone=(value)=>{const state=String(value||'').toUpperCase();if(['ENABLED','REFERENCE_ENABLED','LIVE','MATCH','PASS'].includes(state))return 'live';if(['DELAYED','DELAYED_PROVIDER','WARNING','CACHED','CACHED_PROVIDER'].includes(state))return 'delayed';if(['UNAVAILABLE','DENY','MISMATCH','BLOCKED'].includes(state))return 'unavailable';return 'cached';};
const date=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN');};
const value=(input)=>input==null||input===''?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(input));

function providerCard(provider,escapeHtml){
  const active=Boolean(provider.enabled);
  const reference=provider.id==='ecb';
  return `<article class="q-v7-provider-card" data-provider="${escapeHtml(provider.id)}">
    <div><strong>${escapeHtml(String(provider.id||'provider').toUpperCase())}</strong><span class="q-status q-status--${active?(reference?'delayed':'live'):'unavailable'}">${active?(reference?'DELAYED REFERENCE':'AUTHORIZED'):'UNAVAILABLE'}</span></div>
    <p>${escapeHtml(provider.termsState||provider.reason||'Provider policy state unavailable')}</p>
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

export async function renderMarketV6(main,deps){
  const {api,pageHead,stateBanner,escapeHtml}=deps;
  const [overviewResult,ecbResult]=await Promise.allSettled([
    api('/api/v1/public/markets/overview'),
    api('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR')
  ]);
  const overview=overviewResult.status==='fulfilled'?overviewResult.value:{providers:[],guardrails:{fabricatedObservations:false}};
  const ecb=ecbResult.status==='fulfilled'?ecbResult.value:null;
  const providers=Array.isArray(overview.providers)?overview.providers:[];
  const authorizedMarketProviders=providers.filter(provider=>provider.enabled&&provider.id!=='ecb');
  const referenceProviders=providers.filter(provider=>provider.enabled&&provider.id==='ecb');
  const symbolOptions=EXTERNAL_SYMBOLS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const intervalOptions=INTERVALS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  const ecbObservedAt=ecb?.observationTime||ecb?.observedAt||null;
  const ecbIngestedAt=ecb?.ingestionTime||ecb?.ingestedAt||null;
  const ecbTruth=String(ecb?.truthState||'unavailable').toUpperCase();

  main.innerHTML=`<section class="q-page q-market-home q-v7-public-market" data-market-runtime="v7-public-no-fabrication" data-qelly-v7-public-market="true">
    ${pageHead('Qelly Intelligence · Market Command','Governed Market Terminal','External market visualization, provider-rights evidence and approved reference observations are separate trust domains. Public routes never call private workspace APIs and never manufacture missing prices.',`<a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a><a class="q-button q-button--primary" href="#/auth-login">Open authenticated terminal</a>`)}${stateBanner()}

    <section class="q-v7-boundary-ribbon" aria-label="Market truth boundary">
      <div><span>Internal crypto feeds</span><strong>${authorizedMarketProviders.length}</strong><small>${authorizedMarketProviders.length?'Rights-authorized provider available':'No rights-authorized crypto feed'}</small></div>
      <div><span>Approved reference feeds</span><strong>${referenceProviders.length}</strong><small>ECB daily working-day reference cadence</small></div>
      <div><span>Fabricated fallback</span><strong>OFF</strong><small>Unavailable stays unavailable</small></div>
      <div><span>Execution</span><strong>DISABLED</strong><small>Read-only research terminal</small></div>
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

    <section class="q-panel q-v7-reference-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Approved governed observations</p><h2>ECB euro reference rates</h2><p>Real provider observations with source cadence and observation time retained. Reference rates are not executable quotes.</p></div><span class="q-status q-status--${tone(ecb?.truthState)}">${escapeHtml(ecbTruth)}</span></div><div class="q-panel-body"><div class="q-v7-rate-grid">${governedRates(ecb,escapeHtml)}</div><div class="q-v7-evidence-strip"><span>Source: European Central Bank</span><span>Observed: ${escapeHtml(date(ecbObservedAt))}</span><span>Ingested: ${escapeHtml(date(ecbIngestedAt))}</span><span>Execution: disabled</span></div></div></section>

    <section class="q-panel"><div class="q-panel-head"><div><h2>Production boundary</h2><p>The public market route uses only anonymous/public contracts. Private data-plane and workspace APIs are requested only after authentication.</p></div><span class="q-status q-status--live">PUBLIC SAFE</span></div><div class="q-panel-body"><div class="q-v6-market-boundary"><span class="q-status q-status--unavailable">NO FALLBACK FABRICATION</span><p>${escapeHtml(overview.reason||'If an internal provider is unavailable or rights-blocked, Qelly exposes that state directly.')}</p></div></div></section>
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