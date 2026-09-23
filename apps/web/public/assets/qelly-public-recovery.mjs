const config=window.__QELLY_CONFIG__||{};
const staticPreview=config.staticVisualPreview===true;
const canonicalSite=String(config.publicSiteUrl||'https://terminal.qellyintelligence.com').replace(/\/$/,'');
const officialPrimary=new URL('./brand/qelly-logo-primary.svg',import.meta.url).href;
const main=document.getElementById('main');
const publicRoutes=new Set(['market','asset-rankings','asset','formula-library','indicator-library','calculator-center','saved-calculations','decision-provenance']);
const failureCopy=['unable to render this route','authentication is required','retry foundation route','foundation route failed'];
// Legacy deep-link contract remains supported by reconcile: #/market?view=decision-maker.
let scheduled=false;
let rendering=false;

const escapeHtml=(value)=>String(value??'').replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const parseRoute=()=>{const raw=location.hash.replace(/^#\/?/,'');const [path,query='']=raw.split('?');return {route:path.split('/')[0]||'market',params:new URLSearchParams(query)};};
const previewBadge=()=>staticPreview?'<span class="q-recovery-badge">Static visual preview</span>':'<span class="q-recovery-badge is-live">Read-only decision support</span>';

function installStaticHeader(){
  if(!staticPreview||document.querySelector('.q-recovery-header'))return;
  document.documentElement.dataset.qellyRecoveryShell='static-preview';
  const header=document.createElement('header');
  header.className='q-recovery-header';
  header.innerHTML=`<a class="q-recovery-brand" href="#/market" aria-label="Qelly Intelligence home"><img src="${officialPrimary}" width="152" height="42" alt="Qelly"></a><nav aria-label="Preview navigation"><a href="#/decision-provenance" data-qelly-decision-link>Decision</a><a href="#/news-research">Qelly Chat</a><a href="#/market">Markets</a><a href="#/asset-rankings">Rankings</a><a href="#/calculator-center">Tools</a></nav><div class="q-recovery-header__actions">${previewBadge()}<a href="${escapeHtml(canonicalSite)}" rel="noopener">Open live site</a></div>`;
  document.querySelector('.q-app')?.prepend(header);
}

function installDecisionNavigation(){
  document.querySelectorAll('.q-product-nav').forEach((nav)=>{
    if(nav.querySelector('[data-qelly-decision-link],a[href="#/decision-provenance"]'))return;
    const link=document.createElement('a');link.href='#/decision-provenance';link.dataset.qellyDecisionLink='true';link.textContent='Decision';nav.prepend(link);
  });
}

function renderDecisionRecovery(message=''){
  if(!main)return;
  rendering=true;
  main.dataset.qellyRecoveryOwner='decision-provenance';
  main.setAttribute('aria-busy','false');
  main.innerHTML=`<section class="q-recovery-page q-decision-recovery" data-qelly-recovery-owned="decision-provenance"><header><div><p>Decision Intelligence · evidence unavailable</p><h1>No substitute decision generated</h1><span>The authoritative Decision workflow could not load the evidence required for a current research view.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>NO TRADE · FAIL CLOSED</strong><span>${escapeHtml(message||'Qelly does not replace unavailable Decision evidence with fixed profiles, simulated probabilities or generated trade levels.')}</span></div><div class="q-recovery-table" role="table" aria-label="Unavailable Decision evidence"><div role="row" class="is-head"><span>Input</span><span>State</span><span>Substitute</span><span>Boundary</span><span>Next step</span></div><div role="row"><span><strong>Decision evidence</strong><small>Market, calibration, MTF, liquidity and risk gates</small></span><span>Unavailable</span><span>None</span><span>NO TRADE</span><span><a href="#/decision-provenance">Retry</a></span></div></div><div class="q-recovery-actions"><a href="#/decision-provenance">Retry Decision Intelligence</a><a href="#/market">Open Markets</a><a href="#/news-research">Open QELLY Chat</a></div><footer><strong>No execution. No personalized advice.</strong><span>No probability, confidence, entry, stop or target is generated from unavailable evidence.</span></footer></section>`;
  document.title='Decision Intelligence unavailable · Qelly Intelligence';
  rendering=false;
}

function openDecisionIntelligence(){
  if(location.hash!=='#/decision-provenance')location.hash='#/decision-provenance';
}

function unavailableTable(label){
  return `<div class="q-recovery-table" role="table" aria-label="${escapeHtml(label)}"><div role="row" class="is-head"><span>Source</span><span>Observation</span><span>Freshness</span><span>Truth</span><span>Action</span></div><div role="row"><span><strong>No verified observation available</strong><small>No substitute data generated</small></span><span>—</span><span>Unavailable</span><span>UNAVAILABLE</span><span><a href="#/market">Market Command</a></span></div></div>`;
}

function renderRankingsRecovery(message=''){
  if(!main)return;rendering=true;main.dataset.qellyRecoveryOwner='asset-rankings';main.setAttribute('aria-busy','false');main.innerHTML=`<section class="q-recovery-page"><header><div><p>Markets · temporarily unavailable</p><h1>Asset rankings unavailable</h1><span>Live ranking evidence is unavailable. Qelly does not insert fixed prices, generated movers or substitute rankings.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>No substitute rankings were generated.</strong><span>${escapeHtml(message||'Use Markets or an external research source while rankings are unavailable.')}</span></div>${unavailableTable('Unavailable asset ranking evidence')}<div class="q-recovery-actions"><a href="#/market">Open Markets</a><a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a></div></section>`;document.title='Asset Rankings unavailable · Qelly Intelligence';rendering=false;
}

function renderMarketRecovery(message){
  if(!main)return;rendering=true;main.dataset.qellyRecoveryOwner='market';main.setAttribute('aria-busy','false');main.innerHTML=`<section class="q-recovery-page q-market-recovery"><header><div><p>Markets · temporarily unavailable</p><h1>Market service unavailable</h1><span>Live market evidence could not be loaded. No substitute price, candle, volume or market movement has been generated.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>This research page is public and does not require sign-in.</strong><span>${escapeHtml(message||'Retry the live market request or use an external research source. No execution, custody or personalized recommendation is available.')}</span></div>${unavailableTable('Unavailable public market evidence')}<div class="q-recovery-actions"><a href="#/market" data-qelly-market-retry>Retry markets</a><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">TradingView ↗</a><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory ↗</a><a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB ↗</a></div></section>`;document.title='Market unavailable · Qelly Intelligence';main.querySelector('[data-qelly-market-retry]')?.addEventListener('click',(event)=>{event.preventDefault();delete main.dataset.qellyRecoveryOwner;location.reload();});rendering=false;
}

function renderPublicRecovery(route,message){
  if(!main)return;
  if(route==='asset-rankings'){renderRankingsRecovery(message);return;}
  if(route==='market'){renderMarketRecovery(message);return;}
  if(route==='decision-provenance'){renderDecisionRecovery(message);return;}
  rendering=true;main.dataset.qellyRecoveryOwner=route;main.setAttribute('aria-busy','false');main.innerHTML=`<section class="q-recovery-page"><header><div><p>Temporarily unavailable</p><h1>${escapeHtml(route.split('-').map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '))}</h1><span>This research page is temporarily unavailable while its data dependency recovers.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>No substitute records generated</strong><span>${escapeHtml(message||'The required data is unavailable. Calculators and other public research pages remain usable.')}</span></div><div class="q-recovery-actions"><a href="#/market">Return to markets</a><a href="#/calculator-center">Use deterministic calculators</a></div></section>`;document.title='Qelly Intelligence · Degraded public mode';rendering=false;
}

function brokenSurface(){if(!main||main.dataset.qellyRecoveryOwner)return false;const text=main.textContent?.toLowerCase()||'';return failureCopy.some((phrase)=>text.includes(phrase));}
function reconcile(){scheduled=false;if(rendering||!main)return;installStaticHeader();installDecisionNavigation();const {route,params}=parseRoute();if(route==='market'&&params.get('view')==='decision-maker'){openDecisionIntelligence();return;}if(main.dataset.qellyRecoveryOwner&&main.dataset.qellyRecoveryOwner!==route)delete main.dataset.qellyRecoveryOwner;if(brokenSurface()&&publicRoutes.has(route))renderPublicRecovery(route,main.textContent?.trim());}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(reconcile);}

installStaticHeader();installDecisionNavigation();
if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:true,characterData:true});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{if(main)delete main.dataset.qellyRecoveryOwner;schedule();});
window.addEventListener('pageshow',schedule);
for(const delay of [0,100,350,900,1800,3500])setTimeout(schedule,delay);
window.QellyPublicRecovery=Object.freeze({reconcile,openDecisionIntelligence,renderDecisionRecovery,renderMarketRecovery});
