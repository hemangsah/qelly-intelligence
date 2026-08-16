import {icon} from '../icon-registry.mjs';

const apiBase=()=>String(window.__QELLY_CONFIG__?.apiBaseUrl||'').replace(/\/$/,'');
const apiUrl=(path)=>apiBase()?new URL(path,`${apiBase()}/`).toString():path;
const safeNumber=(value)=>Number.isFinite(Number(value))?Number(value):null;
const formatRate=(value)=>{const number=safeNumber(value);return number==null?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(number);};
const formatDate=(value)=>{const parsed=new Date(value||'');return Number.isNaN(parsed.getTime())?'Not supplied':parsed.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};

async function publicJson(path){
  const response=await fetch(apiUrl(path),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(payload?.error?.message||`Request failed (${response.status})`);
  return payload||{};
}

function providerMatrix(providers,escapeHtml){
  if(!providers.length)return '<div class="q-empty-state"><strong>Provider policy unavailable</strong><p>The public provider registry did not return a governed status.</p></div>';
  return providers.map(provider=>`<article class="q-mi-intelligence-module"><header><div><p>${escapeHtml(String(provider.id||'provider').toUpperCase())}</p><h2>${provider.enabled?'Authorized reference source':'Ranking feed unavailable'}</h2></div><span>${provider.enabled?'ACTIVE':'BLOCKED'}</span></header><dl class="q-mi-evidence-grid"><div><dt>Terms</dt><dd>${escapeHtml(provider.termsState||'not supplied')}</dd></div><div><dt>Reason</dt><dd>${escapeHtml(provider.reason||'No blocking reason')}</dd></div></dl>${provider.termsUrl?`<a class="q-button q-button--ghost" href="${escapeHtml(provider.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Provider policy ↗</a>`:''}</article>`).join('');
}

function referenceRows(ecb,escapeHtml){
  const rates=ecb?.data?.rates||{};
  const preferred=['USD','INR','GBP','JPY','CHF','CNY','CAD','AUD','SGD','AED'];
  const rows=preferred.filter(code=>rates[code]!=null).map(code=>({code,rate:rates[code]}));
  if(!rows.length)return '<div class="q-empty-state"><strong>No approved reference observations</strong><p>The ECB public provider returned no usable reference-rate payload. Qelly did not insert placeholder market values.</p></div>';
  return `<div class="q-mi-table-scroll"><table class="q-data-table"><thead><tr><th>Reference pair</th><th>Rate</th><th>Observation</th><th>Source</th><th>Truth</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>EUR / ${escapeHtml(row.code)}</strong></td><td>${escapeHtml(formatRate(row.rate))}</td><td>${escapeHtml(formatDate(ecb.observationTime||ecb.observedAt))}</td><td>European Central Bank</td><td><span class="q-status q-status--delayed">REFERENCE</span></td></tr>`).join('')}</tbody></table></div>`;
}

export async function renderAssetRankings(main,{escapeHtml,navigate,toast}){
  let overview={providers:[],guardrails:{fabricatedObservations:false},reason:'Provider policy unavailable'};
  let ecb=null;
  const [overviewResult,ecbResult]=await Promise.allSettled([
    publicJson('/api/v1/public/markets/overview'),
    publicJson('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR')
  ]);
  if(overviewResult.status==='fulfilled')overview=overviewResult.value;
  if(ecbResult.status==='fulfilled')ecb=ecbResult.value;
  const providers=Array.isArray(overview.providers)?overview.providers:[];
  const authorizedRankProviders=providers.filter(provider=>provider.enabled&&provider.id!=='ecb');
  const referenceProviders=providers.filter(provider=>provider.enabled&&provider.id==='ecb');

  main.innerHTML=`<section class="q-mi-page q-v7-ranking-page" data-evidence-state="GOVERNED" data-market-ranking-runtime="no-fabrication">
    <div class="q-mi-truth-banner" role="status"><span class="q-mi-status-dot"></span><strong>Governed production truth</strong><span>market ranking feed ${authorizedRankProviders.length?'authorized':'unavailable'} · fabricated fallback off · execution disabled</span><button type="button" data-ranking-boundary>Review boundary</button></div>
    <header class="q-mi-page-head"><div><p>Markets / Ranking intelligence</p><h1>Asset rankings</h1><span>Qelly ranks assets only when a rights-authorized provider supplies the required observations. No fixed crypto scenario is shown in production.</span></div><div class="q-mi-layout-modes"><a class="q-button q-button--primary" href="#/market">Market Command</a><a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a></div></header>

    <section class="q-mi-kpis q-mi-market-pulse" aria-label="Asset ranking availability">
      <article class="q-mi-kpi is-primary"><span>Authorized ranking feeds</span><strong>${authorizedRankProviders.length}</strong><small>${authorizedRankProviders.length?'Provider-backed ranking inputs available':'Binance and Coinbase remain rights-blocked'}</small></article>
      <article class="q-mi-kpi is-primary"><span>Approved reference feeds</span><strong>${referenceProviders.length}</strong><small>ECB daily working-day reference rates</small></article>
      <article class="q-mi-kpi"><span>Fabricated prices</span><strong>0</strong><small>Production no-fabrication contract</small></article>
      <article class="q-mi-kpi"><span>Executable rankings</span><strong>0</strong><small>Research only · no trading</small></article>
      <article class="q-mi-regime">${icon('ranking')}<span><small>Ranking state</small><strong>${authorizedRankProviders.length?'Provider-backed':'Unavailable pending rights-authorized data'}</strong></span></article>
    </section>

    <div class="q-mi-analytical-grid">
      <section class="q-mi-intelligence-module"><header><div><p>Asset ranking engine</p><h2>${authorizedRankProviders.length?'Provider-backed ranking inputs available':'Ranking observations unavailable'}</h2></div><span>${authorizedRankProviders.length?'READY':'UNAVAILABLE'}</span></header><div class="q-empty-state"><strong>${authorizedRankProviders.length?'Ranking methodology requires implementation against the authorized feed.':'No crypto ranking values are displayed.'}</strong><p>${escapeHtml(overview.reason||'Qelly will not rank assets from generated prices, volumes, open interest, funding or liquidation values.')}</p></div><div class="q-external-research-actions"><a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView market overview ↗</a><a class="q-button q-button--secondary" href="https://www.cmegroup.com/markets.html" target="_blank" rel="noopener noreferrer nofollow">CME markets ↗</a></div></section>
      <aside class="q-mi-side-stack">${providerMatrix(providers,escapeHtml)}</aside>
    </div>

    <section class="q-panel"><div class="q-panel-head"><div><p class="q-eyebrow">Approved reference coverage</p><h2>ECB euro reference-rate universe</h2><p>Real source observations are shown as reference coverage only. They are not re-labeled as asset rankings.</p></div><span class="q-status q-status--${ecb?'delayed':'unavailable'}">${ecb?'REFERENCE DATA':'UNAVAILABLE'}</span></div><div class="q-panel-body">${referenceRows(ecb,escapeHtml)}</div></section>

    <section class="q-panel"><div class="q-panel-head"><div><h2>Professional research surfaces</h2><p>External sources remain outside Qelly's analytical trust boundary unless formally integrated and licensed.</p></div></div><div class="q-panel-body q-v7-link-grid"><a class="q-button q-button--secondary" href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView ↗</a><a class="q-button q-button--secondary" href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory ↗</a><a class="q-button q-button--secondary" href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB ↗</a></div></section>
  </section>`;

  main.querySelector('[data-ranking-boundary]')?.addEventListener('click',()=>toast?.('Asset rankings require rights-authorized ranking observations. Production does not substitute deterministic market values.',{tone:'neutral'}));
  main.querySelector('[data-action="open-ranking-provenance"]')?.addEventListener('click',()=>navigate?.('decision-provenance'));
}