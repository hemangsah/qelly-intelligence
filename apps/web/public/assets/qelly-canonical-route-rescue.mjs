import {evaluateDecision} from './qelly-decision-engine.mjs';
import {providerAvailability,providerPolicyMessage} from './customer-copy.mjs';

const RESCUE_ROUTES=new Set(['notification-schedules','data-mesh','decision-provenance','platform-readiness','watchlist']);
const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const currentRoute=()=>decodeURIComponent((location.hash.replace(/^#\/?/,'').split('?')[0]||'').trim());
const failed=(main)=>/Unable to render this route|API route was not found|Request failed \((?:404|501)\)/i.test(main?.textContent||'');
const fetchJson=async(path)=>{const response=await fetch(path,{credentials:'include',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const body=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(body?.error?.message||`Request failed (${response.status})`);error.status=response.status;error.code=body?.error?.code;throw error;}return body;};
const status=(label,tone='unavailable')=>`<span class="q-status q-status--${tone}">${esc(label)}</span>`;
const shell=(eyebrow,title,description,body)=>`<section class="q-page q-canonical-rescue" data-canonical-route-rescue="${esc(currentRoute())}"><header class="q-page-head"><div><p class="q-eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div></header>${body}</section>`;
const record=(title,detail,badge,badgeTone='unavailable')=>`<div class="q-record-row"><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span>${status(badge,badgeTone)}</div>`;

function rescueNotifications(main){
  main.innerHTML=shell('Workspace · alerts','Notification Schedules','Scheduled alerts are being prepared. Your research workspace remains available while delivery options are connected.',`
    <div class="q-kpi-grid">
      <article class="q-kpi"><div class="q-kpi-label">Scheduled alerts</div><div class="q-kpi-value">Soon</div><div class="q-kpi-meta"><span>delivery setup in progress</span>${status('PLANNED','cached')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Email / SMS / push</div><div class="q-kpi-value">Soon</div><div class="q-kpi-meta"><span>notification channels in progress</span>${status('PLANNED','cached')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Webhooks</div><div class="q-kpi-value">Soon</div><div class="q-kpi-meta"><span>integrations in progress</span>${status('PLANNED','cached')}</div></article>
      <article class="q-kpi"><div class="q-kpi-label">Financial authority</div><div class="q-kpi-value">None</div><div class="q-kpi-meta"><span>notifications cannot execute actions</span>${status('READ ONLY','live')}</div></article>
    </div>
    <section class="q-panel"><div class="q-panel-head"><div><h2>What you can do now</h2><p>Create a private research note or review your alert rules while scheduled delivery is being prepared.</p></div>${status('COMING SOON','cached')}</div><div class="q-panel-body q-stack">
      ${record('Research notes','Capture catalysts and follow-up dates in your workspace.','AVAILABLE','live')}
      ${record('Alert rules','Review the conditions you want to monitor.','AVAILABLE','live')}
      ${record('Scheduled delivery','Email, SMS, push and webhooks are on the roadmap.','PLANNED','cached')}
    </div><div class="q-page-actions"><a class="q-button q-button--primary" href="#/research-workspace">Open research workspace</a><a class="q-button q-button--secondary" href="#/alert-center">Review alert rules</a></div></section>`);
}

async function rescueDataMesh(main){
  let providerData={items:[]};let providerError=null;
  try{providerData=await fetchJson('/api/v1/providers/runtime');}catch(error){providerError=error;}
  const providers=Array.isArray(providerData.items)?providerData.items:[];
  main.innerHTML=shell('Data · source coverage','Data Sources & Quality','See which sources are approved for customer display and where additional coverage is being prepared.',`
    <section class="q-panel"><div class="q-panel-head"><div><h2>Source coverage</h2><p>Permission and freshness are checked before data appears in Qelly.</p></div>${status(providerError?'CHECKING':'CURRENT',providerError?'cached':'live')}</div><div class="q-panel-body q-stack">
      ${providerError?record('Source status','Source status could not be refreshed. Try again shortly.','CHECKING','cached'):providers.length?providers.map((item)=>{const availability=providerAvailability(item);return record(item.id||item.provider||'provider',providerPolicyMessage(item),availability.label,availability.tone);}).join(''):record('Source coverage','No source records were returned.','CHECKING','cached')}
    </div></section>
    <div class="q-two-column"><section class="q-panel"><div class="q-panel-head"><div><h2>Data quality</h2><p>Qelly keeps missing or unapproved data out of customer analysis.</p></div>${status('PROTECTED','live')}</div><div class="q-panel-body">${record('Quality monitoring','Only approved observations can appear.','ACTIVE','live')}</div></section><section class="q-panel"><div class="q-panel-head"><div><h2>Permission checks</h2><p>Display approval remains separate from technical connectivity.</p></div>${status('ENFORCED','live')}</div><div class="q-panel-body">${record('Customer display','Provider permissions are checked before use.','ACTIVE','live')}</div></section></div>
    <div class="q-truth-callout"><span class="q-status q-status--live">TRUSTED BY DESIGN</span><p>Missing source coverage stays clearly identified instead of being replaced with sample market values.</p></div>`);
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
      <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Available</div><div class="q-kpi-value">${Number(summary.ready)||0}</div>${status('READY','live')}</article><article class="q-kpi"><div class="q-kpi-label">Limited</div><div class="q-kpi-value">${Number(summary.partial)||0}</div>${status('REVIEW','warning')}</article><article class="q-kpi"><div class="q-kpi-label">Planned</div><div class="q-kpi-value">${Number(summary.deferred)||0}</div>${status('PLANNED','cached')}</article><article class="q-kpi"><div class="q-kpi-label">Needs attention</div><div class="q-kpi-value">${Number(summary.blocked)||0}</div>${status('REVIEW','warning')}</article></div>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Runtime identity</h2><p>${esc(data.readinessReason||'No readiness reason supplied.')}</p></div>${status(data.ready?'PROVEN':'NOT PROVEN',data.ready?'live':'warning')}</div><div class="q-panel-body q-stack">${record('Release SHA',data.releaseSha||'unresolved','EVIDENCE','cached')}${record('Canonical terminal',data.canonicalSite||'unresolved','CLOUDFLARE','live')}</div></section>`);
  }catch(error){main.innerHTML=shell('Operations · production evidence','Platform Readiness','The readiness endpoint itself is unavailable.',`<section class="q-panel"><div class="q-panel-body">${record('Readiness endpoint',error.message,'UNAVAILABLE')}</div></section>`);}
}

async function rescueWatchlist(main){
  try{
    const listing=await fetchJson('/api/v1/workspace/watchlists');
    const items=Array.isArray(listing.items)?listing.items:[];
    main.innerHTML=shell('Work · private workspace','Workspace Watchlists','Your private lists remain available even when live price coverage has not yet been approved.',`
      <div class="q-kpi-grid"><article class="q-kpi"><div class="q-kpi-label">Watchlists</div><div class="q-kpi-value">${items.length}</div><div class="q-kpi-meta"><span>private workspace</span>${status('SECURE CLOUD','live')}</div></article><article class="q-kpi"><div class="q-kpi-label">Price coverage</div><div class="q-kpi-value">Soon</div><div class="q-kpi-meta"><span>approved source pending</span>${status('PLANNED','cached')}</div></article></div>
      <section class="q-panel"><div class="q-panel-head"><div><h2>Saved lists</h2><p>Prices appear only after an approved source is connected.</p></div>${status('PROTECTED','live')}</div><div class="q-panel-body q-stack">${items.length?items.map((item)=>record(item.name||'Watchlist',item.description||'Add a description',`${item.itemCount??0} ITEMS`,'cached')).join(''):record('No watchlists yet','Create your first list to organize assets for research.','GET STARTED','cached')}</div></section>`);
  }catch(error){main.innerHTML=shell('Work · private workspace','Workspace Watchlists','Your saved lists could not be refreshed for this session.',`<section class="q-panel"><div class="q-panel-body">${record('Watchlist refresh','Try again after refreshing your session.','TRY AGAIN','cached')}</div></section>`);}
}

async function applyRescue(){
  const main=document.getElementById('main');const route=currentRoute();
  if(!main||!RESCUE_ROUTES.has(route)||!failed(main))return;
  if(main.dataset.canonicalRescueRoute===route)return;
  main.dataset.canonicalRescueRoute=route;
  try{
    if(route==='notification-schedules')rescueNotifications(main);
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
