import {decisionAssets,evaluateDecision} from './qelly-decision-engine.mjs';

const config=window.__QELLY_CONFIG__||{};
const staticPreview=config.staticVisualPreview===true;
const officialPrimary=new URL('./brand/qelly-logo-primary.svg',import.meta.url).href;
const main=document.getElementById('main');
const publicRoutes=new Set(['market','asset-rankings','asset','formula-library','indicator-library','calculator-center','saved-calculations','decision-provenance']);
const failureCopy=['unable to render this route','authentication is required','retry foundation route','foundation route failed'];
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
  header.innerHTML=`<a class="q-recovery-brand" href="#/market" aria-label="Qelly Intelligence home"><img src="${officialPrimary}" width="152" height="42" alt="Qelly"></a><nav aria-label="Preview navigation"><a href="#/market">Markets</a><a href="#/asset-rankings">Rankings</a><a href="#/market?view=decision-maker" data-qelly-decision-link>Decision Maker</a><a href="#/formula-library">Formulas</a><a href="#/indicator-library">Indicators</a><a href="#/calculator-center">Calculators</a></nav><div class="q-recovery-header__actions">${previewBadge()}<a href="https://qelly-intelligence.pages.dev" rel="noopener">Open live site</a></div>`;
  document.querySelector('.q-app')?.prepend(header);
}

function installDecisionNavigation(){
  document.querySelectorAll('.q-product-nav').forEach((nav)=>{
    if(nav.querySelector('[data-qelly-decision-link]'))return;
    const link=document.createElement('a');link.href='#/market?view=decision-maker';link.dataset.qellyDecisionLink='true';link.textContent='Decision Maker';nav.append(link);
  });
}

function decisionForm(result){
  return `<section class="q-decision-workspace" data-qelly-recovery-owned="decision-maker">
    <header class="q-decision-hero"><div><p>Qelly Intelligence · Explainable decision support</p><h1>AI Decision Maker</h1><span>Turn a user-defined hypothesis into a transparent posture, risk boundary and verification plan. This deterministic framework does not claim live market observations.</span></div>${previewBadge()}</header>
    <div class="q-decision-boundary" role="note"><strong>No execution. No personalized advice.</strong><span>${escapeHtml(result.boundary)}</span></div>
    <div class="q-decision-grid">
      <form class="q-decision-controls" data-decision-form>
        <div><label for="q-decision-asset">Asset context</label><select id="q-decision-asset" name="assetId">${decisionAssets.map((asset)=>`<option value="${asset.id}" ${asset.id===result.input.assetId?'selected':''}>${asset.name} · ${asset.symbol}</option>`).join('')}</select></div>
        <div><label for="q-decision-horizon">Decision horizon</label><select id="q-decision-horizon" name="horizon">${['24h','7d','30d','90d'].map((value)=>`<option ${value===result.input.horizon?'selected':''}>${value}</option>`).join('')}</select></div>
        <div><label for="q-decision-risk">Risk posture</label><select id="q-decision-risk" name="risk">${[['conservative','Conservative'],['balanced','Balanced'],['aggressive','Aggressive']].map(([value,label])=>`<option value="${value}" ${value===result.input.risk?'selected':''}>${label}</option>`).join('')}</select></div>
        <div><label for="q-decision-confidence">Evidence confidence <output>${result.input.evidenceConfidence}%</output></label><input id="q-decision-confidence" name="evidenceConfidence" type="range" min="25" max="95" step="5" value="${result.input.evidenceConfidence}"></div>
        <div><label for="q-decision-scenario">User scenario move <output>${result.input.scenarioMove}%</output></label><input id="q-decision-scenario" name="scenarioMove" type="range" min="-30" max="30" step="1" value="${result.input.scenarioMove}"></div>
        <button type="submit">Run decision analysis</button>
      </form>
      <section class="q-decision-output" aria-live="polite"><div class="q-decision-score"><span>Decision score</span><strong>${result.score}</strong><small>0–100 deterministic composite</small></div><div class="q-decision-posture"><span>Current posture</span><h2>${escapeHtml(result.posture)}</h2><p>${escapeHtml(result.asset.name)} · ${escapeHtml(result.input.horizon)} · ${escapeHtml(result.confidenceBand)} confidence</p></div><dl><div><dt>Risk state</dt><dd>${escapeHtml(result.riskPosture)}</dd></div><div><dt>Engine state</dt><dd>Deterministic scenario</dd></div><div><dt>Execution</dt><dd>Disabled</dd></div></dl></section>
    </div>
    <div class="q-decision-evidence-grid"><article><h2>What supports the posture</h2><ul>${result.supports.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><h2>What contradicts it</h2><ul>${result.contradictions.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><h2>Required verification</h2><ol>${result.nextSteps.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></article></div>
    <footer class="q-decision-footer"><a href="#/market">Open governed Market Command</a><a href="#/decision-provenance">Open provenance graph</a><button type="button" data-decision-export>Export decision record</button></footer>
  </section>`;
}

function bindDecisionMaker(result){
  const form=main?.querySelector('[data-decision-form]');if(!form)return;
  const redraw=()=>{const data=new FormData(form);renderDecisionMaker(evaluateDecision({assetId:data.get('assetId'),horizon:data.get('horizon'),risk:data.get('risk'),evidenceConfidence:Number(data.get('evidenceConfidence')),scenarioMove:Number(data.get('scenarioMove'))}));};
  form.addEventListener('submit',(event)=>{event.preventDefault();redraw();});
  form.querySelectorAll('input[type="range"]').forEach((input)=>input.addEventListener('input',()=>input.closest('div')?.querySelector('output')?.replaceChildren(`${input.value}%`)));
  main.querySelector('[data-decision-export]')?.addEventListener('click',()=>{const record={generatedAt:new Date().toISOString(),product:'Qelly Intelligence',...result};const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`qelly-decision-${result.asset.symbol.toLowerCase()}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);});
}

function renderDecisionMaker(result=evaluateDecision()){
  if(!main)return;rendering=true;main.dataset.qellyRecoveryOwner='decision-maker';main.setAttribute('aria-busy','false');main.innerHTML=decisionForm(result);bindDecisionMaker(result);document.title='AI Decision Maker · Qelly Intelligence';rendering=false;
}

function unavailableTable(label){
  return `<div class="q-recovery-table" role="table" aria-label="${escapeHtml(label)}"><div role="row" class="is-head"><span>Source</span><span>Observation</span><span>Freshness</span><span>Truth</span><span>Action</span></div><div role="row"><span><strong>No authorized provider observation</strong><small>Qelly no-fabrication boundary</small></span><span>—</span><span>Unavailable</span><span>UNAVAILABLE</span><span><a href="#/market">Market Command</a></span></div></div>`;
}

function renderRankingsRecovery(message=''){
  if(!main)return;rendering=true;main.dataset.qellyRecoveryOwner='asset-rankings';main.setAttribute('aria-busy','false');main.innerHTML=`<section class="q-recovery-page"><header><div><p>Markets · governed degraded mode</p><h1>Asset rankings unavailable</h1><span>The ranking dependency is unavailable. Qelly does not insert fixed prices, generated movers or substitute rankings.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>No fabricated recovery data.</strong><span>${escapeHtml(message||'Use the Market Command external display and approved reference data while this route is unavailable.')}</span></div>${unavailableTable('Unavailable asset ranking evidence')}<div class="q-recovery-actions"><a href="#/market">Open Market Command</a><a href="https://www.tradingview.com/markets/" target="_blank" rel="noopener noreferrer nofollow">TradingView Markets ↗</a></div></section>`;document.title='Asset Rankings unavailable · Qelly Intelligence';rendering=false;
}

function renderMarketRecovery(message){
  if(!main)return;rendering=true;main.dataset.qellyRecoveryOwner='market';main.setAttribute('aria-busy','false');main.innerHTML=`<section class="q-recovery-page q-market-recovery"><header><div><p>Markets · governed degraded mode</p><h1>Market service unavailable</h1><span>The governed public market service could not be rendered. No substitute price, candle, volume or market movement has been generated.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>No authentication is required for this public route.</strong><span>${escapeHtml(message||'Retry the governed market request or use an external research surface. No execution, custody or personalized recommendation is available.')}</span></div>${unavailableTable('Unavailable public market evidence')}<div class="q-recovery-actions"><a href="#/market" data-qelly-market-retry>Retry Market Command</a><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer nofollow">TradingView ↗</a><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer nofollow">Forex Factory ↗</a><a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer nofollow">ECB ↗</a></div></section>`;document.title='Market unavailable · Qelly Intelligence';main.querySelector('[data-qelly-market-retry]')?.addEventListener('click',(event)=>{event.preventDefault();delete main.dataset.qellyRecoveryOwner;location.reload();});rendering=false;
}

function renderPublicRecovery(route,message){
  if(!main)return;if(route==='asset-rankings'){renderRankingsRecovery(message);return;}if(route==='market'){renderMarketRecovery(message);return;}
  rendering=true;main.dataset.qellyRecoveryOwner=route;main.setAttribute('aria-busy','false');main.innerHTML=`<section class="q-recovery-page"><header><div><p>Qelly public recovery</p><h1>${escapeHtml(route.split('-').map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '))}</h1><span>This public surface has been preserved while its required dependency is unavailable.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>Graceful degraded mode · no fabricated records</strong><span>${escapeHtml(message||'The requested dependency is unavailable. Deterministic tools and public navigation remain usable.')}</span></div><div class="q-recovery-actions"><a href="#/market">Return to markets</a><a href="#/calculator-center">Use deterministic calculators</a></div></section>`;document.title='Qelly Intelligence · Degraded public mode';rendering=false;
}

function brokenSurface(){if(!main||main.dataset.qellyRecoveryOwner)return false;const text=main.textContent?.toLowerCase()||'';return failureCopy.some((phrase)=>text.includes(phrase));}
function reconcile(){scheduled=false;if(rendering||!main)return;installStaticHeader();installDecisionNavigation();const {route,params}=parseRoute();if(route==='market'&&params.get('view')==='decision-maker'){if(main.dataset.qellyRecoveryOwner!=='decision-maker')renderDecisionMaker();return;}if(main.dataset.qellyRecoveryOwner&&main.dataset.qellyRecoveryOwner!==route)delete main.dataset.qellyRecoveryOwner;if(brokenSurface()&&publicRoutes.has(route))renderPublicRecovery(route,main.textContent?.trim());}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(reconcile);}

installStaticHeader();installDecisionNavigation();
if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:true,characterData:true});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{if(main)delete main.dataset.qellyRecoveryOwner;schedule();});
window.addEventListener('pageshow',schedule);
for(const delay of [0,100,350,900,1800,3500])setTimeout(schedule,delay);
window.QellyPublicRecovery=Object.freeze({reconcile,renderDecisionMaker,renderMarketRecovery,evaluateDecision});