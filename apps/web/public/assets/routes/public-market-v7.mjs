import {mountTradingViewDisplay} from '../market/tradingview-display-widget.mjs';

const ROOT_SELECTOR='[data-qelly-v7-public-market]';
let chartHandle=null;
let rendering=false;
let scheduled=false;

const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const formatRate=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('en-IN',{maximumFractionDigits:6}).format(Number(value)):'—';
const formatTime=value=>{const date=new Date(value||'');return Number.isNaN(date.getTime())?'Not supplied':date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});};
const routeKey=()=>location.hash.replace(/^#\/?/,'').split(/[?/#]/)[0]||'market';
const externalLink=(href,label)=>`<a class="q-button q-button--secondary" href="${href}" target="_blank" rel="noopener noreferrer nofollow">${label} ↗</a>`;

async function json(path){
  const response=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(payload?.error?.message||`Request failed (${response.status})`);
  return payload||{};
}

function providerCards(providers=[]){
  return providers.map(provider=>{
    const live=provider.enabled===true;
    const reference=provider.id==='ecb';
    const state=live?(reference?'DELAYED REFERENCE':'AUTHORIZED'):'UNAVAILABLE';
    const tone=live?(reference?'delayed':'live'):'unavailable';
    return `<article class="q-v7-provider-card" data-provider="${escapeHtml(provider.id)}"><div><strong>${escapeHtml(provider.id.toUpperCase())}</strong><span class="q-status q-status--${tone}">${state}</span></div><p>${escapeHtml(provider.termsState||provider.reason||'Provider policy state unavailable')}</p>${provider.termsUrl?`<a href="${escapeHtml(provider.termsUrl)}" target="_blank" rel="noopener noreferrer nofollow">Terms / policy ↗</a>`:''}</article>`;
  }).join('');
}

function rateCards(rates={},observedAt){
  const preferred=['USD','INR','GBP','JPY','CHF','CNY','CAD','AUD','SGD','AED'];
  const rows=preferred.filter(code=>rates[code]!=null).map(code=>[code,rates[code]]);
  if(!rows.length)return '<div class="q-empty-state"><strong>ECB observations unavailable</strong><p>No approved reference observations were returned. Qelly will not substitute generated values.</p></div>';
  return rows.map(([code,value])=>`<article class="q-v7-rate-card"><span>EUR / ${code}</span><strong>${formatRate(value)}</strong><small>Observed ${escapeHtml(formatTime(observedAt))}</small></article>`).join('');
}

async function render(){
  if(rendering||routeKey()!=='market')return;
  const main=document.getElementById('main');
  if(!main)return;
  rendering=true;
  try{
    const [overviewResult,ecbResult]=await Promise.allSettled([
      json('/api/v1/public/markets/overview'),
      json('/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR')
    ]);
    if(routeKey()!=='market')return;
    const overview=overviewResult.status==='fulfilled'?overviewResult.value:{};
    const ecb=ecbResult.status==='fulfilled'?ecbResult.value:{};
    const providers=Array.isArray(overview.providers)?overview.providers:[];
    const rates=ecb?.data?.rates||{};
    const observedAt=ecb?.observationTime||ecb?.observedAt||null;
    const ecbState=ecb?.truthState||'unavailable';
    const approvedCrypto=providers.filter(provider=>provider.enabled&&provider.id!=='ecb').length;
    const approvedReference=providers.filter(provider=>provider.enabled&&provider.id==='ecb').length;

    chartHandle?.destroy?.();chartHandle=null;
    main.innerHTML=`<section class="q-page q-market-home q-v7-public-market" data-qelly-v7-public-market="true">
      <header class="q-v7-terminal-hero">
        <div><p class="q-eyebrow">Qelly Intelligence · Market Command</p><h1>Governed market terminal</h1><p>External market visualization, approved provider observations and source evidence are kept in separate trust domains. Qelly never generates substitute prices when a provider is unavailable.</p></div>
        <div class="q-page-actions"><a class="q-button q-button--primary" href="#/auth-login">Open authenticated terminal</a>${externalLink('https://www.tradingview.com/','TradingView')}</div>
      </header>

      <section class="q-v7-boundary-ribbon" aria-label="Market truth boundary">
        <div><span>Internal crypto feeds</span><strong>${approvedCrypto}</strong><small>${approvedCrypto?'rights-authorized':'No rights-authorized crypto feed'}</small></div>
        <div><span>Approved reference feeds</span><strong>${approvedReference}</strong><small>ECB daily reference cadence</small></div>
        <div><span>Fabricated fallback</span><strong>OFF</strong><small>Unavailable stays unavailable</small></div>
        <div><span>Execution</span><strong>DISABLED</strong><small>Read-only research terminal</small></div>
      </section>

      <div class="q-v7-market-grid">
        <section class="q-panel q-v7-chart-panel">
          <div class="q-panel-head"><div><p class="q-eyebrow">External display boundary</p><h2>TradingView market visualization</h2><p>Human-readable display only. Widget observations are not ingested, scraped, persisted or consumed by Qelly analytics.</p></div><span class="q-status q-status--cached">DISPLAY ONLY</span></div>
          <div class="q-panel-body"><div id="qelly-v7-public-tradingview" class="q-v7-chart-stage" aria-label="TradingView external market chart"></div><div class="q-chart-attribution"><span>External provider boundary · analytics reuse prohibited</span><span>Qelly internal provider state remains independently governed.</span></div></div>
        </section>
        <aside class="q-v7-side-stack">
          <section class="q-panel"><div class="q-panel-head"><div><h2>Provider rights matrix</h2><p>Authorization, not technical reachability, controls internal display.</p></div></div><div class="q-panel-body q-v7-provider-grid">${providerCards(providers)}</div></section>
          <section class="q-panel"><div class="q-panel-head"><div><h2>Research links</h2><p>External professional sources open in a separate trust boundary.</p></div></div><div class="q-panel-body q-v7-link-grid">${externalLink('https://www.tradingview.com/markets/','TradingView Markets')}${externalLink('https://www.forexfactory.com/calendar','Forex Factory Calendar')}${externalLink('https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html','ECB Reference Rates')}${externalLink('https://www.cmegroup.com/markets.html','CME Markets')}</div></section>
        </aside>
      </div>

      <section class="q-panel q-v7-reference-panel">
        <div class="q-panel-head"><div><p class="q-eyebrow">Approved governed observations</p><h2>ECB euro reference rates</h2><p>Real provider observations with source cadence and observation time retained. These are reference rates, not executable quotes.</p></div><span class="q-status q-status--${String(ecbState).includes('live')?'live':String(ecbState).includes('delayed')?'delayed':String(ecbState).includes('cached')?'cached':'unavailable'}">${escapeHtml(String(ecbState).toUpperCase())}</span></div>
        <div class="q-panel-body"><div class="q-v7-rate-grid">${rateCards(rates,observedAt)}</div><div class="q-v7-evidence-strip"><span>Source: European Central Bank</span><span>Observed: ${escapeHtml(formatTime(observedAt))}</span><span>Ingested: ${escapeHtml(formatTime(ecb?.ingestionTime||ecb?.ingestedAt))}</span><span>Execution: disabled</span></div></div>
      </section>
    </section>`;
    main.dataset.qellyProductHome='ready';
    main.dataset.qellyV7PublicMarket='true';
    const host=main.querySelector('#qelly-v7-public-tradingview');
    if(host){try{chartHandle=mountTradingViewDisplay(host,{symbol:'BTCUSDT',interval:'1h'});}catch(error){host.innerHTML=`<div class="q-empty-state"><strong>External display unavailable</strong><p>${escapeHtml(error?.message||error)}</p></div>`;}}
    document.title='Market Command · Qelly Intelligence';
  }finally{rendering=false;}
}

function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(async()=>{scheduled=false;if(routeKey()!=='market'){chartHandle?.destroy?.();chartHandle=null;return;}const main=document.getElementById('main');if(main?.querySelector(ROOT_SELECTOR))return;await render();});}

const main=document.getElementById('main');
if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:false});
window.addEventListener('hashchange',schedule);
window.addEventListener('pageshow',schedule);
schedule();

window.__qellyV7PublicMarket=Object.freeze({render,schedule});