const config=window.__QELLY_CONFIG__||{};
const staticPreview=config.staticVisualPreview===true;
const canonicalSite=String(config.publicSiteUrl||'https://terminal.qellyintelligence.com').replace(/\/$/,'');
const officialPrimary=new URL('./brand/qelly-logo-primary.svg',import.meta.url).href;

export const PUBLIC_RECOVERY_ROUTES=Object.freeze([
  'market','asset-rankings','asset','formula-library','indicator-library','calculator-center','saved-calculations','decision-provenance'
]);

const PUBLIC_RECOVERY_ROUTE_SET=new Set(PUBLIC_RECOVERY_ROUTES);
const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const previewBadge=(preview=staticPreview)=>preview?'<span class="q-recovery-badge">Static visual preview</span>':'<span class="q-recovery-badge is-live">Read-only decision support</span>';

export function isPublicRecoveryRoute(route){
  return PUBLIC_RECOVERY_ROUTE_SET.has(String(route||''));
}

function unavailableTable(label){
  return `<div class="q-recovery-table" role="table" aria-label="${escapeHtml(label)}"><div role="row" class="is-head"><span>Source</span><span>Observation</span><span>Freshness</span><span>Truth</span><span>Action</span></div><div role="row"><span><strong>No verified observation available</strong><small>No substitute data generated</small></span><span>—</span><span>Unavailable</span><span>UNAVAILABLE</span><span><a href="#/market">Market Command</a></span></div></div>`;
}

export function publicRecoveryMarkup(route,message='',{preview=staticPreview}={}){
  const current=String(route||'');
  const detail=String(message||'').trim();
  if(current==='asset-rankings'){
    return `<section class="q-recovery-page" data-qelly-route-recovery="asset-rankings"><header><div><p>Markets · temporarily unavailable</p><h1>Asset rankings unavailable</h1><span>Live ranking evidence is unavailable. Qelly does not insert fixed prices, generated movers or substitute rankings.</span></div>${previewBadge(preview)}</header><div class="q-recovery-notice"><strong>No substitute rankings were generated.</strong><span>${escapeHtml(detail||'Use Markets or an external research source while rankings are unavailable.')}</span></div>${unavailableTable('Unavailable asset ranking evidence')}<div class="q-recovery-actions"><a href="#/market">Open Markets</a><a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a></div></section>`;
  }
  if(current==='market'){
    return `<section class="q-recovery-page q-market-recovery" data-qelly-route-recovery="market"><header><div><p>Markets · temporarily unavailable</p><h1>Market service unavailable</h1><span>Live market evidence could not be loaded. No substitute price, candle, volume or market movement has been generated.</span></div>${previewBadge(preview)}</header><div class="q-recovery-notice"><strong>This research page is public and does not require sign-in.</strong><span>${escapeHtml(detail||'Retry the live market request or use an external research source. No execution, custody or personalized recommendation is available.')}</span></div>${unavailableTable('Unavailable public market evidence')}<div class="q-recovery-actions"><a href="#/market" data-qelly-recovery-retry>Retry markets</a><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">TradingView ↗</a><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory ↗</a><a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB ↗</a></div></section>`;
  }
  const label=current.split('-').filter(Boolean).map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ')||'Research page';
  return `<section class="q-recovery-page" data-qelly-route-recovery="${escapeHtml(current||'unknown')}"><header><div><p>Temporarily unavailable</p><h1>${escapeHtml(label)}</h1><span>This research page is temporarily unavailable while its data dependency recovers.</span></div>${previewBadge(preview)}</header><div class="q-recovery-notice"><strong>No substitute records generated</strong><span>${escapeHtml(detail||'The required data is unavailable. Calculators and other public research pages remain usable.')}</span></div><div class="q-recovery-actions"><a href="#/market">Return to markets</a><a href="#/calculator-center">Use deterministic calculators</a></div></section>`;
}

export function bindPublicRecoveryActions(scope,{route,retry}={}){
  if(String(route||'')!=='market')return;
  scope?.querySelector?.('[data-qelly-recovery-retry]')?.addEventListener('click',(event)=>{
    event.preventDefault();
    if(typeof retry==='function')retry();
  });
}

function installStaticHeader(){
  if(!staticPreview||document.querySelector('.q-recovery-header'))return;
  document.documentElement.dataset.qellyRecoveryShell='static-preview';
  const header=document.createElement('header');
  header.className='q-recovery-header';
  header.innerHTML=`<a class="q-recovery-brand" href="#/market" aria-label="Qelly Intelligence home"><img src="${officialPrimary}" width="152" height="42" alt="Qelly"></a><nav aria-label="Preview navigation"><a href="#/decision-provenance" data-qelly-decision-link>Decision</a><a href="#/news-research">Qelly Chat</a><a href="#/market">Markets</a><a href="#/asset-rankings">Rankings</a><a href="#/calculator-center">Tools</a></nav><div class="q-recovery-header__actions">${previewBadge(true)}<a href="${escapeHtml(canonicalSite)}" rel="noopener">Open live site</a></div>`;
  document.querySelector('.q-app')?.prepend(header);
}

function installDecisionNavigation(){
  document.querySelectorAll('.q-product-nav').forEach((nav)=>{
    if(nav.querySelector('[data-qelly-decision-link],a[href="#/decision-provenance"]'))return;
    const link=document.createElement('a');
    link.href='#/decision-provenance';
    link.dataset.qellyDecisionLink='true';
    link.textContent='Decision';
    nav.prepend(link);
  });
}

export function installPublicRecoveryChrome(){
  installStaticHeader();
  installDecisionNavigation();
}

window.QellyPublicRecovery=Object.freeze({
  isPublicRecoveryRoute,
  publicRecoveryMarkup,
  bindPublicRecoveryActions,
  installPublicRecoveryChrome
});
