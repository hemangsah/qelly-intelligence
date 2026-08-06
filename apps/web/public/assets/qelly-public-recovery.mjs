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
const parseRoute=()=>{
  const raw=location.hash.replace(/^#\/?/,'');
  const [path,query='']=raw.split('?');
  return {route:path.split('/')[0]||'market',params:new URLSearchParams(query)};
};
const previewBadge=()=>staticPreview?'<span class="q-recovery-badge">Deterministic preview</span>':'<span class="q-recovery-badge is-live">Read-only decision support</span>';

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
    const link=document.createElement('a');
    link.href='#/market?view=decision-maker';
    link.dataset.qellyDecisionLink='true';
    link.textContent='Decision Maker';
    nav.append(link);
  });
}

function decisionForm(result){
  return `<section class="q-decision-workspace" data-qelly-recovery-owned="decision-maker">
    <header class="q-decision-hero"><div><p>Qelly Intelligence · Explainable decision support</p><h1>AI Decision Maker</h1><span>Turn a market hypothesis into a transparent posture, risk boundary and verification plan. In preview mode this is a deterministic framework—not a live generative model.</span></div>${previewBadge()}</header>
    <div class="q-decision-boundary" role="note"><strong>No execution. No personalized advice.</strong><span>${escapeHtml(result.boundary)}</span></div>
    <div class="q-decision-grid">
      <form class="q-decision-controls" data-decision-form>
        <div><label for="q-decision-asset">Asset</label><select id="q-decision-asset" name="assetId">${decisionAssets.map((asset)=>`<option value="${asset.id}" ${asset.id===result.input.assetId?'selected':''}>${asset.name} · ${asset.symbol}</option>`).join('')}</select></div>
        <div><label for="q-decision-horizon">Decision horizon</label><select id="q-decision-horizon" name="horizon">${['24h','7d','30d','90d'].map((value)=>`<option ${value===result.input.horizon?'selected':''}>${value}</option>`).join('')}</select></div>
        <div><label for="q-decision-risk">Risk posture</label><select id="q-decision-risk" name="risk">${[['conservative','Conservative'],['balanced','Balanced'],['aggressive','Aggressive']].map(([value,label])=>`<option value="${value}" ${value===result.input.risk?'selected':''}>${label}</option>`).join('')}</select></div>
        <div><label for="q-decision-confidence">Evidence confidence <output>${result.input.evidenceConfidence}%</output></label><input id="q-decision-confidence" name="evidenceConfidence" type="range" min="25" max="95" step="5" value="${result.input.evidenceConfidence}"></div>
        <div><label for="q-decision-scenario">Scenario move <output>${result.input.scenarioMove}%</output></label><input id="q-decision-scenario" name="scenarioMove" type="range" min="-30" max="30" step="1" value="${result.input.scenarioMove}"></div>
        <button type="submit">Run decision analysis</button>
      </form>
      <section class="q-decision-output" aria-live="polite">
        <div class="q-decision-score"><span>Decision score</span><strong>${result.score}</strong><small>0–100 deterministic composite</small></div>
        <div class="q-decision-posture"><span>Current posture</span><h2>${escapeHtml(result.posture)}</h2><p>${escapeHtml(result.asset.name)} · ${escapeHtml(result.input.horizon)} · ${escapeHtml(result.confidenceBand)} confidence</p></div>
        <dl><div><dt>Risk state</dt><dd>${escapeHtml(result.riskPosture)}</dd></div><div><dt>Engine state</dt><dd>Explainable deterministic</dd></div><div><dt>Execution</dt><dd>Disabled</dd></div></dl>
      </section>
    </div>
    <div class="q-decision-evidence-grid"><article><h2>What supports the posture</h2><ul>${result.supports.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><h2>What contradicts it</h2><ul>${result.contradictions.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><h2>Required verification</h2><ol>${result.nextSteps.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ol></article></div>
    <footer class="q-decision-footer"><a href="#/asset-rankings">Compare market evidence</a><a href="#/decision-provenance">Open provenance graph</a><button type="button" data-decision-export>Export decision record</button></footer>
  </section>`;
}

function bindDecisionMaker(result){
  const form=main?.querySelector('[data-decision-form]');
  if(!form)return;
  const redraw=()=>{
    const data=new FormData(form);
    renderDecisionMaker(evaluateDecision({
      assetId:data.get('assetId'),
      horizon:data.get('horizon'),
      risk:data.get('risk'),
      evidenceConfidence:Number(data.get('evidenceConfidence')),
      scenarioMove:Number(data.get('scenarioMove'))
    }));
  };
  form.addEventListener('submit',(event)=>{event.preventDefault();redraw();});
  form.querySelectorAll('input[type="range"]').forEach((input)=>input.addEventListener('input',()=>{
    input.closest('div')?.querySelector('output')?.replaceChildren(`${input.value}%`);
  }));
  main.querySelector('[data-decision-export]')?.addEventListener('click',()=>{
    const record={generatedAt:new Date().toISOString(),product:'Qelly Intelligence',...result};
    const blob=new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`qelly-decision-${result.asset.symbol.toLowerCase()}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  });
}

function renderDecisionMaker(result=evaluateDecision()){
  if(!main)return;
  rendering=true;
  main.dataset.qellyRecoveryOwner='decision-maker';
  main.setAttribute('aria-busy','false');
  main.innerHTML=decisionForm(result);
  bindDecisionMaker(result);
  document.title='AI Decision Maker · Qelly Intelligence';
  rendering=false;
}

const demoAssets=[
  ['BTC','Bitcoin','$42,500','+1.84%','82'],['ETH','Ethereum','$2,280','−0.62%','79'],['SOL','Solana','$98.40','+3.21%','70'],['BNB','BNB','$312.60','+0.48%','68'],['XRP','XRP','$0.61','−1.17%','61'],['ADA','Cardano','$0.52','+2.03%','63']
];

function renderRankingsRecovery(){
  if(!main)return;
  rendering=true;
  main.dataset.qellyRecoveryOwner='asset-rankings';
  main.setAttribute('aria-busy','false');
  main.innerHTML=`<section class="q-recovery-page"><header><div><p>Markets · deterministic preview</p><h1>Asset rankings</h1><span>Preview-safe market comparison with explicit non-live evidence boundaries.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>Live providers are unavailable in this build.</strong><span>Values below are fixed demonstration observations and cannot support execution.</span></div><div class="q-recovery-table" role="table" aria-label="Deterministic asset rankings"><div role="row" class="is-head"><span>Asset</span><span>Price</span><span>24h</span><span>Evidence</span><span>Action</span></div>${demoAssets.map(([symbol,name,price,change,evidence])=>`<div role="row"><span><strong>${symbol}</strong><small>${name}</small></span><span>${price}</span><span>${change}</span><span>${evidence}/100</span><span><a href="#/market?view=decision-maker">Analyze</a></span></div>`).join('')}</div></section>`;
  document.title='Asset Rankings · Qelly Intelligence';
  rendering=false;
}

function renderMarketRecovery(message){
  if(!main)return;
  rendering=true;
  main.dataset.qellyRecoveryOwner='market';
  main.setAttribute('aria-busy','false');
  main.innerHTML=`<section class="q-recovery-page q-market-recovery"><header><div><p>Markets · safe degraded mode</p><h1>Market overview</h1><span>The public market service is temporarily unavailable. Qelly has replaced the failed route with one deterministic, read-only recovery surface.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>No authentication is required for this public route.</strong><span>${escapeHtml(message||'Retry the governed public market request. No trade, custody or personalized recommendation is available.')}</span></div><div class="q-recovery-table" role="table" aria-label="Deterministic public market recovery"><div role="row" class="is-head"><span>Asset</span><span>Price</span><span>24h</span><span>Evidence</span><span>Action</span></div>${demoAssets.slice(0,4).map(([symbol,name,price,change,evidence])=>`<div role="row"><span><strong>${symbol}</strong><small>${name}</small></span><span>${price}</span><span>${change}</span><span>${evidence}/100</span><span><a href="#/market?view=decision-maker">Analyze</a></span></div>`).join('')}</div><div class="q-recovery-actions"><a href="#/market" data-qelly-market-retry>Retry market overview</a><a href="#/asset-rankings">Open rankings</a><a href="#/market?view=decision-maker">Open Decision Maker</a></div></section>`;
  document.title='Market Overview · Qelly Intelligence';
  main.querySelector('[data-qelly-market-retry]')?.addEventListener('click',(event)=>{event.preventDefault();delete main.dataset.qellyRecoveryOwner;location.reload();});
  rendering=false;
}

function renderPublicRecovery(route,message){
  if(!main)return;
  if(route==='asset-rankings'){renderRankingsRecovery();return;}
  if(route==='market'){renderMarketRecovery(message);return;}
  rendering=true;
  main.dataset.qellyRecoveryOwner=route;
  main.setAttribute('aria-busy','false');
  main.innerHTML=`<section class="q-recovery-page"><header><div><p>Qelly public recovery</p><h1>${escapeHtml(route.split('-').map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '))}</h1><span>This public surface has been preserved while its live dependency is unavailable.</span></div>${previewBadge()}</header><div class="q-recovery-notice"><strong>Graceful degraded mode</strong><span>${escapeHtml(message||'The requested live dependency is unavailable. Deterministic tools and public navigation remain usable.')}</span></div><div class="q-recovery-actions"><a href="#/market">Return to markets</a><a href="#/market?view=decision-maker">Open Decision Maker</a><a href="#/calculator-center">Use deterministic calculators</a></div></section>`;
  document.title='Qelly Intelligence · Degraded public mode';
  rendering=false;
}

function brokenSurface(){
  if(!main||main.dataset.qellyRecoveryOwner)return false;
  const text=main.textContent?.toLowerCase()||'';
  return failureCopy.some((phrase)=>text.includes(phrase));
}

function reconcile(){
  scheduled=false;
  if(rendering||!main)return;
  installStaticHeader();
  installDecisionNavigation();
  const {route,params}=parseRoute();
  if(route==='market'&&params.get('view')==='decision-maker'){
    if(main.dataset.qellyRecoveryOwner!=='decision-maker')renderDecisionMaker();
    return;
  }
  if(main.dataset.qellyRecoveryOwner&&main.dataset.qellyRecoveryOwner!==route){
    delete main.dataset.qellyRecoveryOwner;
  }
  if(brokenSurface()&&publicRoutes.has(route))renderPublicRecovery(route,main.textContent?.trim());
}

function schedule(){
  if(scheduled)return;scheduled=true;requestAnimationFrame(reconcile);
}

installStaticHeader();
installDecisionNavigation();
if(main)new MutationObserver(schedule).observe(main,{childList:true,subtree:true,characterData:true});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{if(main)delete main.dataset.qellyRecoveryOwner;schedule();});
window.addEventListener('pageshow',schedule);
for(const delay of [0,100,350,900,1800,3500])setTimeout(schedule,delay);
window.QellyPublicRecovery=Object.freeze({reconcile,renderDecisionMaker,renderMarketRecovery,evaluateDecision});
