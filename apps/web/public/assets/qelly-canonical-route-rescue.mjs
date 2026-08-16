import {evaluateDecision} from './qelly-decision-engine.mjs';

const RESCUE_ROUTES=new Set(['news-research','notification-schedules','data-mesh','decision-provenance','platform-readiness','watchlist']);
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const currentRoute=()=>decodeURIComponent((location.hash.replace(/^#\/?/,'').split('?')[0]||'').trim());
const failed=(main)=>/Unable to render this route|API route was not found|Request failed \((?:404|501)\)/i.test(main?.textContent||'');
const fetchJson=async(path)=>{const response=await fetch(path,{credentials:'include',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const body=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(body?.error?.message||`Request failed (${response.status})`);error.status=response.status;error.code=body?.error?.code;throw error;}return body;};
const status=(label,tone='unavailable')=>`<span class="q-status q-status--${tone}">${esc(label)}</span>`;
const shell=(eyebrow,title,description,body)=>`<section class="q-page q-canonical-rescue" data-canonical-route-rescue="${esc(currentRoute())}"><header class="q-page-head"><div><p class="q-eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div></header>${body}</section>`;
const record=(title,detail,badge,badgeTone='unavailable')=>`<div class="q-record-row"><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${status(badge,badgeTone)}</div>`;

function rescueNews(main){
  main.innerHTML=shell('Research · governed source boundary','News & Research','The licensed discovery-news service is not enabled in the canonical runtime. The route remains usable without inventing headlines, sentiment, citations or provider observations.',`
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">Licensed news feed</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>rights not established</span>${status('UNAVAILABLE')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Research persistence</div><div class="q-kpi-value">Cloud</div><div class="q-kpi-meta"><span>workspace RLS</span>${status('AVAILABLE','live')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">AI summaries</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>no generated content presented as evidence</span>${status('GATED')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Execution</div><div class="q-kpi-value">Disabled</div><div class="q-kpi-meta"><span>research only</span>${status('READ ONLY','live')}</div></article>
    </div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Available research surfaces</h2><p>Use operational Qelly surfaces while external content rights remain gated.</p></div>${status('SAFE DEGRADED','cached')}</div><div class="q-panel-body q-stack">
      ${record('Research Workspace','Cloud-RLS research projects, evidence records and revision history.','OPEN','live')}
      ${record('Live Market Command','Provider-truth market surface with explicit availability and freshness.','OPEN','live')}
      ${record('Decision Provenance','Deterministic decision-support analysis remains available without persistence.','OPEN','cached')}
    </div><div class="q-page-actions"><a class="q-button q-button--primary" href="#/research-workspace">Open Research Workspace</a><a class="q-button q-button--secondary" href="#/live-markets">Open Live Market Command</a><a class="q-button q-button--secondary" href="#/decision-provenance">Open Decision Provenance</a></div></section>
    <div class="q-truth-callout"><span class="q-status q-status--unavailable">NO FABRICATED CONTENT</span><p>Qelly will not substitute packaged news fixtures for a licensed production feed.</p></div>`);
}

function rescueNotifications(main){
  main.innerHTML=shell('Operations · capability boundary','Notification Schedules','Persistent scheduling and external delivery are not enabled in this Cloudflare release. The controls are intentionally disabled instead of failing with a missing API route.',`
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">Scheduler worker</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>no background execution</span>${status('DEFERRED','cached')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Email / SMS / push</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>delivery contract not enabled</span>${status('UNAVAILABLE')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Webhook delivery</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>no event-triggered execution</span>${status('UNAVAILABLE')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Financial authority</div><div class="q-kpi-value">None</div><div class="q-kpi-meta"><span>notifications cannot execute actions</span>${status('READ ONLY','live')}</div></article>
    </div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>Release boundary</h2><p>Schedules will become operational only after persistent storage, worker execution, delivery retries, audit evidence and consent controls are implemented together.</p></div>${status('LIMITED RELEASE','warning')}</div><div class="q-panel-body q-stack">
      ${record('Create schedule','Disabled until the production scheduler exists.','DISABLED')}
      ${record('Run due schedules','No manual simulation is exposed as production behavior.','DISABLED')}
      ${record('External delivery','Email, SMS, push and webhook delivery are not active.','DISABLED')}
    </div><div class="q-page-actions"><a class="q-button q-button--secondary" href="#/platform-readiness">Review Platform Readiness</a><a class="q-button q-button--secondary" href="#/account-session">Open Session Center</a></div></section>`);
}

async function rescueDataMesh(main){
  let providerData={items:[]};let providerError=null;
  try{providerData=await fetchJson('/api/v1/providers/runtime');}catch(error){providerError=error;}
  const providers=Array.isArray(providerData.items)?providerData.items:[];
  main.innerHTML=shell('Data · provider truth','Provider Runtime & Data Quality','The provider runtime is operational where rights permit it. Data-quality incident workflow and entitlement-contract inspection remain separate unavailable capabilities and no longer collapse the entire page.',`
    <section class="q-panel"><div class="q-panel-head"><div><h2>Provider runtime</h2><p>Canonical Cloudflare provider-policy state.</p></div>${status(providerError?'UNAVAILABLE':'RUNTIME',''+(providerError?'unavailable':'live'))}</div><div class="q-panel-body q-stack">
      ${providerError?record('Provider runtime',providerError.message,'UNAVAILABLE'):providers.length?providers.map((item)=>record(item.id||item.provider||'provider',item.reason||item.termsState||item.policyState||'No detail supplied.',String(item.truthState||item.status||'UNKNOWN').toUpperCase(),String(item.truthState||'').toLowerCase()==='live'?'live':String(item.truthState||'').toLowerCase()==='cached'?'cached':'unavailable')).join(''):record('Provider registry','No provider records returned by the runtime.','EMPTY','cached')}
    </div></section>
    <div class="q-two-column"><section class="q-panel"><div class="q-panel-head"><div><h2>Data-quality incidents</h2><p>Persistent incident workflow has not been promoted to canonical Cloudflare storage.</p></div>${status('UNAVAILABLE')}</div><div class="q-panel-body">${record('Incident registry','No fixture incidents are substituted.','DEFERRED','cached')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Entitlement contracts</h2><p>The local entitlement contract registry is not a production browser API.</p></div>${status('UNAVAILABLE')}</div><div class="q-panel-body">${record('Contract inspection','Provider rights remain enforced by the production provider policy layer.','POLICY ENFORCED','live')}</div></section></div>
    <div class="q-truth-callout"><span class="q-status q-status--live">PARTIAL ROUTE</span><p>One unavailable operational subsystem can no longer blank the provider-runtime evidence that is actually available.</p></div>`);
}

function decisionMarkup(result){
  const list=(items)=>`<ul>${(items||[]).map((item)=>`<li>${esc(item)}</li>`).join('')||'<li>No item supplied.</li>'}</ul>`;
  return `<section class="q-panel"><div class="q-panel-head"><div><h2>${esc(result.posture)}</h2><p>${esc(result.asset?.name||'Asset')} · ${esc(result.input?.horizon||'horizon unavailable')} · deterministic local analysis</p></div>${status(`SCORE ${result.score}`,'cached')}</div><div class="q-panel-body"><div class="q-decision-evidence-grid"><article><h3>Supports</h3>${list(result.supports)}</article><article><h3>Contradicts</h3>${list(result.contradictions)}</article><article><h3>Verify next</h3>${list(result.nextSteps)}</article></div><div class="q-truth-callout is-compact"><span class="q-status q-status--unavailable">NO PERSISTENCE</span><p>${esc(result.boundary||'Decision support only. Human verification required. Execution disabled.')}</p></div></div></section>`;
}
function rescueDecision(main){
  let result=evaluateDecision();
  main.innerHTML=shell('Evidence · deterministic fallback','Decision Provenance','The persistent evidence-graph service is unavailable, but the local explainable decision engine remains usable. No graph persistence, provider observation or execution is implied.',`
    <section class="q-panel"><div class="q-panel-head"><div><h2>Deterministic decision support</h2><p>Scenario inputs remain separate from observed market evidence.</p></div>${status('LOCAL','cached')}</div><div class="q-panel-body"><form data-rescue-decision class="q-inline-form"><label class="q-setting"><span>Horizon</span><select name="horizon"><option value="24h">24 hours</option><option value="7d" selected>7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></select></label><label class="q-setting"><span>Risk posture</span><select name="risk"><option value="conservative">Conservative</option><option value="balanced" selected>Balanced</option><option value="aggressive">Aggressive</option></select></label><label class="q-setting"><span>Evidence confidence</span><input name="evidenceConfidence" type="number" min="25" max="95" step="5" value="60"></label><label class="q-setting"><span>Scenario move %</span><input name="scenarioMove" type="number" min="-30" max="30" step="1" value="0"></label><button class="q-button q-button--primary" type="submit">Run local analysis</button></form></div></section><div data-rescue-decision-result>${decisionMarkup(result)}</div>`);
  const form=main.querySelector('[data-rescue-decision]');
  form?.addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(form);result=evaluateDecision({horizon:data.get('horizon'),risk:data.get('risk'),evidenceConfidence:Number(data.get('evidenceConfidence')),scenarioMove:Number(data.get('scenarioMove'))});main.querySelector('[data-rescue-decision-result]').innerHTML=decisionMarkup(result);});
}

async function rescueReadiness(main){
  try{
    const data=await fetchJson('/api/v1/platform/readiness');
    const summary=data.summary||{};
    main.innerHTML=shell('Operations · production evidence','Platform Readiness','Direct canonical runtime evidence recovered even though the primary route renderer failed.',`
      <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Ready</div><div class="q-kpi-value">${Number(summary.ready)||0}</div>${status('READY','live')}</article><article class="q-kpi"><div class="q-kpi-label">Partial</div><div class="q-kpi-value">${Number(summary.partial)||0}</div>${status('PARTIAL','warning')}</article><article class="q-kpi"><div class="q-kpi-label">Deferred</div><div class="q-kpi-value">${Number(summary.deferred)||0}</div>${status('DEFERRED','cached')}</article><article class="q-kpi"><div class="q-kpi-label">Blocked</div><div class="q-kpi-value">${Number(summary.blocked)||0}</div>${status('BLOCKED')}</article></div>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Runtime identity</h2><p>${esc(data.readinessReason||'No readiness reason supplied.')}</p></div>${status(data.ready?'PROVEN':'NOT PROVEN',data.ready?'live':'warning')}</div><div class="q-panel-body q-stack">${record('Release SHA',data.releaseSha||'unresolved','EVIDENCE','cached')}${record('Canonical terminal',data.canonicalSite||'unresolved','CLOUDFLARE','live')}</div></section>`);
  }catch(error){main.innerHTML=shell('Operations · production evidence','Platform Readiness','The readiness endpoint itself is unavailable.',`<section class="q-panel"><div class="q-panel-body">${record('Readiness endpoint',error.message,'UNAVAILABLE')}</div></section>`);}
}

async function rescueWatchlist(main){
  try{
    const listing=await fetchJson('/api/v1/workspace/watchlists');
    const items=Array.isArray(listing.items)?listing.items:[];
    main.innerHTML=shell('Work · cloud persistence','Workspace Watchlists','Direct Cloud-RLS watchlist evidence recovered after the primary renderer failed. Quote data remains unavailable until a rights-approved observation exists.',`
      <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Watchlists</div><div class="q-kpi-value">${items.length}</div><div class="q-kpi-meta"><span>workspace scoped</span>${status('CLOUD RLS','live')}</div></article><article class="q-kpi"><div class="q-kpi-label">Quote truth</div><div class="q-kpi-value">Off</div><div class="q-kpi-meta"><span>no approved observation attached</span>${status('UNAVAILABLE')}</div></article></div>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Persisted lists</h2><p>No fixture prices are substituted.</p></div>${status('RLS GOVERNED','live')}</div><div class="q-panel-body q-stack">${items.length?items.map((item)=>record(item.name||'Watchlist',item.description||'No description',`${item.itemCount??0} ITEMS`,'cached')).join(''):record('No watchlists yet','Create a list after the primary workspace renderer is available.','EMPTY','cached')}</div></section>`);
  }catch(error){main.innerHTML=shell('Work · cloud persistence','Workspace Watchlists','The Cloud-RLS watchlist endpoint is unavailable for this session.',`<section class="q-panel"><div class="q-panel-body">${record('Watchlist persistence',error.message,'UNAVAILABLE')}</div></section>`);}
}

async function applyRescue(){
  const main=document.getElementById('main');const route=currentRoute();
  if(!main||!RESCUE_ROUTES.has(route)||!failed(main))return;
  if(main.dataset.canonicalRescueRoute===route)return;
  main.dataset.canonicalRescueRoute=route;
  try{
    if(route==='news-research')rescueNews(main);
    else if(route==='notification-schedules')rescueNotifications(main);
    else if(route==='data-mesh')await rescueDataMesh(main);
    else if(route==='decision-provenance')rescueDecision(main);
    else if(route==='platform-readiness')await rescueReadiness(main);
    else if(route==='watchlist')await rescueWatchlist(main);
  }catch(error){main.dataset.canonicalRescueError=String(error?.message||error);}
}

const main=document.getElementById('main');
if(main&&typeof MutationObserver==='function')new MutationObserver(()=>queueMicrotask(applyRescue)).observe(main,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(applyRescue,0));
queueMicrotask(applyRescue);
